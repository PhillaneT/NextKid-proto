import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// POST /api/payout/trigger
//
// Runs on the 1st of each month (cron job or manual trigger by Praesignis).
// Secured with CRON_SECRET header — never exposed publicly.
//
// For each school with an accumulated balance in the closing month:
//   1. Snapshot their bank details
//   2. Create a payouts row (status = 'pending' or 'held' if no verified bank)
//   3. Mark school_ledger_summary as 'processing'
//   4. Notify school admins
//   5. Notify super admins with the full summary
//
// RULE: No Stitch API call happens here — that fires when status transitions
//       from 'pending' to 'processing' via the approve step (future endpoint).
//       This separation lets Praesignis review before money moves.

function prevYearMonth() {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthDisplayName(yyyyMm: string) {
  const [y, m] = yyyyMm.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-ZA', { month: 'long', year: 'numeric' })
}

async function sendPushToUser(token: string, title: string, body: string) {
  if (!token?.startsWith('ExponentPushToken')) return
  await fetch('https://exp.host/--/api/v2/push/send', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body:    JSON.stringify({ to: token, title, body, sound: 'default' }),
  }).catch(() => {})
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Support ?month=YYYY-MM override for manual re-runs; defaults to previous month
  const { searchParams } = new URL(req.url)
  const targetMonth = searchParams.get('month') ?? prevYearMonth()
  const monthLabel  = monthDisplayName(targetMonth)

  const server = createServerSupabaseClient()

  // 1. Fetch all school summaries for the target month with non-zero balances
  const { data: summaries, error: sumErr } = await server
    .from('school_ledger_summary')
    .select('school_id, grand_total_cents, direct_earnings_cents, referral_earnings_cents, status')
    .eq('month', targetMonth)
    .eq('status', 'accumulating')
    .gt('grand_total_cents', 0)

  if (sumErr) {
    console.error('[Payout] Failed to fetch summaries:', sumErr)
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 })
  }

  if (!summaries?.length) {
    return NextResponse.json({ success: true, message: 'No balances to process', month: targetMonth })
  }

  const schoolIds = summaries.map(s => s.school_id)

  // 2. Fetch bank details and school names in parallel
  const [bankRes, schoolRes] = await Promise.all([
    server
      .from('school_bank_details')
      .select('school_id, bank_name, account_number, branch_code, account_holder_name, verified')
      .in('school_id', schoolIds),
    server
      .from('schools')
      .select('id, name, contact_email')
      .in('id', schoolIds),
  ])

  const banks   = Object.fromEntries((bankRes.data ?? []).map(b => [b.school_id, b]))
  const schools = Object.fromEntries((schoolRes.data ?? []).map(s => [s.id, s]))

  // 3. Process each school
  let totalPayoutCents = 0
  let heldCount        = 0
  const results: { schoolId: string; status: string; amountCents: number }[] = []

  for (const summary of summaries) {
    const { school_id, grand_total_cents } = summary
    const bank   = banks[school_id]
    const school = schools[school_id]

    const hasVerifiedBank = bank?.verified === true
    const payoutStatus    = hasVerifiedBank ? 'pending' : 'held'
    const heldReason      = hasVerifiedBank ? null : 'no_verified_bank_details'

    const bankSnapshot = hasVerifiedBank
      ? {
          bank_name:           bank.bank_name,
          account_number:      bank.account_number,
          branch_code:         bank.branch_code,
          account_holder_name: bank.account_holder_name,
        }
      : {}

    // Upsert payout record (idempotent — safe to re-run)
    await server.from('payouts').upsert({
      school_id,
      month:                targetMonth,
      amount_cents:         grand_total_cents,
      bank_details_snapshot: bankSnapshot,
      status:               payoutStatus,
      held_reason:          heldReason,
    }, { onConflict: 'school_id,month', ignoreDuplicates: false })

    // Mark summary as processing (or held, same state from summary perspective)
    await server
      .from('school_ledger_summary')
      .update({ status: 'processing' })
      .eq('school_id', school_id)
      .eq('month', targetMonth)

    if (hasVerifiedBank) {
      totalPayoutCents += grand_total_cents
    } else {
      heldCount++
    }

    results.push({ schoolId: school_id, status: payoutStatus, amountCents: grand_total_cents })

    // 4. Notify school admins
    const { data: admins } = await server
      .from('school_admins')
      .select('profiles(id, expo_push_token)')
      .eq('school_id', school_id)
      .eq('active', true)

    const pushMsg = hasVerifiedBank
      ? `Your ${monthLabel} payout of R ${(grand_total_cents / 100).toFixed(2)} is on its way to ${bank.bank_name}. Should reflect within 24 hours.`
      : `Your ${monthLabel} earnings of R ${(grand_total_cents / 100).toFixed(2)} are ready but we are missing your verified bank details. Add them now to receive your payout.`

    for (const row of admins ?? []) {
      const prof = row.profiles as unknown as { id: string; expo_push_token: string | null } | null
      if (!prof) continue
      if (prof.expo_push_token) await sendPushToUser(prof.expo_push_token, 'NextKid Payout', pushMsg)
      await server.from('notifications').insert({
        user_id: prof.id, order_id: null,
        type:    hasVerifiedBank ? 'payout_initiated' : 'payout_held',
        message: pushMsg, item_id: null, read: false,
        sent_at: new Date().toISOString(),
      })
    }

    console.log(`[Payout] ${school?.name ?? school_id}: R ${(grand_total_cents / 100).toFixed(2)} → ${payoutStatus}`)
  }

  // 5. Record platform finance ledger entry
  await server.from('praesignis_finance_ledger').upsert({
    month:                       targetMonth,
    school_direct_total_cents:   summaries.reduce((s, r) => s + r.direct_earnings_cents, 0),
    school_referral_total_cents: summaries.reduce((s, r) => s + r.referral_earnings_cents, 0),
    school_payout_total_cents:   totalPayoutCents,
    school_count:                summaries.length,
    held_school_count:           heldCount,
    status:                      'processing',
    allocated_at:                new Date().toISOString(),
  }, { onConflict: 'month' })

  // 6. Notify all super admins
  const superAdminMsg = `Monthly payouts ready — ${summaries.length} school${summaries.length !== 1 ? 's' : ''}, total R ${(totalPayoutCents / 100).toFixed(2)}${heldCount > 0 ? `, ${heldCount} held (no bank details)` : ''}. Review and approve in Praesignis.`

  const { data: superAdmins } = await server
    .from('profiles')
    .select('id, expo_push_token')
    .eq('role', 'super_admin')

  for (const sa of superAdmins ?? []) {
    if (sa.expo_push_token) await sendPushToUser(sa.expo_push_token, 'Praesignis Finance', superAdminMsg)
    await server.from('notifications').insert({
      user_id: sa.id, order_id: null, type: 'payout_review_required',
      message: superAdminMsg, item_id: null, read: false,
      sent_at: new Date().toISOString(),
    })
  }

  console.log(`[Payout] Trigger complete: ${summaries.length} schools, R ${(totalPayoutCents / 100).toFixed(2)} pending, ${heldCount} held`)

  return NextResponse.json({
    success:       true,
    month:         targetMonth,
    schoolsCount:  summaries.length,
    totalCents:    totalPayoutCents,
    heldCount,
    results,
  })
}
