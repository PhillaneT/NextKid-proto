import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// GET /api/klerebank/ledger
//
// Returns a school's monthly financial summary:
//   - Running balance (direct waybill fees + referral earnings)
//   - Recent ledger entries with waybill attribution
//   - Bank details verification status
//   - Next payout date (1st of next month)
//
// Falls back gracefully if migration 023 hasn't run yet.

export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: userData } = await anonClient.auth.getUser(token)
  if (!userData.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const server = createServerSupabaseClient()

  // Verify school admin
  const { data: adminRow } = await server
    .from('school_admins')
    .select('school_id')
    .eq('user_id', userData.user.id)
    .eq('active', true)
    .single()

  if (!adminRow) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const schoolId = adminRow.school_id

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthName    = now.toLocaleString('en-ZA', { month: 'long' })

  // Next payout: 1st of next calendar month
  const nextPayoutDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const daysToPayday   = Math.ceil((nextPayoutDate.getTime() - now.getTime()) / 86_400_000)

  // Fetch summary, recent ledger entries, and bank details in parallel
  const [summaryRes, entriesRes, bankRes, prevPayoutRes] = await Promise.all([
    server
      .from('school_ledger_summary')
      .select('direct_earnings_cents, referral_earnings_cents, grand_total_cents, status')
      .eq('school_id', schoolId)
      .eq('month', currentMonth)
      .maybeSingle(),

    server
      .from('school_ledger')
      .select('event_type, amount_cents, waybill_number, created_at, month')
      .eq('school_id', schoolId)
      .eq('month', currentMonth)
      .order('created_at', { ascending: false })
      .limit(20),

    server
      .from('school_bank_details')
      .select('bank_name, account_holder_name, verified')
      .eq('school_id', schoolId)
      .maybeSingle(),

    server
      .from('payouts')
      .select('month, amount_cents, status, processed_at')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  const summary   = summaryRes.data
  const entries   = entriesRes.data ?? []
  const bank      = bankRes.data
  const prevPayouts = prevPayoutRes.data ?? []

  // If summary table doesn't exist yet (migration pending), fall back to live calculation
  let directCents   = summary?.direct_earnings_cents   ?? 0
  let referralCents = summary?.referral_earnings_cents ?? 0
  let grandTotal    = summary?.grand_total_cents        ?? 0

  if (!summary && entries.length > 0) {
    // Fallback: compute from raw school_ledger entries for this month
    directCents = entries.reduce((s, e) => s + e.amount_cents, 0)
    grandTotal  = directCents
  }

  return NextResponse.json({
    month:       currentMonth,
    monthName,
    nextPayoutDate: nextPayoutDate.toISOString(),
    daysToPayday,

    balance: {
      directCents,
      referralCents,
      grandTotalCents: grandTotal,
      status:          summary?.status ?? 'accumulating',
    },

    bank: bank ? {
      bankName:           bank.bank_name,
      accountHolderName:  bank.account_holder_name,
      verified:           bank.verified,
    } : null,

    recentEntries: entries.map(e => ({
      eventType:     e.event_type,
      amountCents:   e.amount_cents,
      waybillNumber: e.waybill_number ?? null,
      createdAt:     e.created_at,
    })),

    previousPayouts: prevPayouts.map(p => ({
      month:        p.month,
      amountCents:  p.amount_cents,
      status:       p.status,
      processedAt:  p.processed_at,
    })),
  })
}
