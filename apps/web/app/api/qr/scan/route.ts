import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { sendOrderNotification, sendLedgerCreditNotification } from '@/lib/notifications'
import {
  verifyQrToken,
  generateQrToken,
  COLLECTION_TTL_HOURS,
} from '@/lib/qr'

// ── Helpers ───────────────────────────────────────────────────────────────────

function currentYearMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function currentMonthName() {
  return new Date().toLocaleString('en-ZA', { month: 'long' }) // e.g. 'May'
}

// Atomically add to school_ledger_summary and return the new grand total.
// Wrapped in try/catch — fails gracefully if migration 023 hasn't run yet.
async function incrementSummary(
  server:          ReturnType<typeof createServerSupabaseClient>,
  schoolId:        string,
  directCents:     number,
  referralCents:   number,
): Promise<number | null> {
  try {
    const { data } = await server.rpc('increment_school_ledger_summary', {
      p_school_id:      schoolId,
      p_month:          currentYearMonth(),
      p_direct_cents:   directCents,
      p_referral_cents: referralCents,
    })
    return typeof data === 'number' ? data : null
  } catch {
    return null
  }
}

// ── Referral earning helper ───────────────────────────────────────────────────
// L1 referrer earns R2, L2 referrer earns R0.50 — capped at 2 levels.

async function creditReferralEarnings(
  server:         ReturnType<typeof createServerSupabaseClient>,
  orderId:        string,
  waybillNumber:  string,
  sourceSchoolId: string | null,
) {
  if (!sourceSchoolId) return

  // Find L1 referrer
  const { data: source } = await server
    .from('schools').select('referred_by_school_id').eq('id', sourceSchoolId).single()

  const l1SchoolId = source?.referred_by_school_id
  if (!l1SchoolId) return

  await server.from('referral_earnings').upsert({
    earning_school_id: l1SchoolId,
    source_school_id:  sourceSchoolId,
    order_id:          orderId,
    waybill_number:    waybillNumber,
    amount_cents:      200,
    level:             1,
  }, { onConflict: 'earning_school_id,order_id,level', ignoreDuplicates: true })

  // Update L1 summary (+R2 referral)
  await incrementSummary(server, l1SchoolId, 0, 200)

  // Find L2 referrer
  const { data: l1 } = await server
    .from('schools').select('referred_by_school_id').eq('id', l1SchoolId).single()

  const l2SchoolId = l1?.referred_by_school_id
  if (!l2SchoolId) return

  await server.from('referral_earnings').upsert({
    earning_school_id: l2SchoolId,
    source_school_id:  sourceSchoolId,
    order_id:          orderId,
    waybill_number:    waybillNumber,
    amount_cents:      50,
    level:             2,
  }, { onConflict: 'earning_school_id,order_id,level', ignoreDuplicates: true })

  // Update L2 summary (+R0.50 referral)
  await incrementSummary(server, l2SchoolId, 0, 50)
}

// RULE: Only a verified Klerebank Admin account may call this endpoint.
// Any failure returns a generic 'invalid_qr' to avoid leaking scan logic.

const ScanSchema = z.object({
  token: z.string().min(10),
})

export async function POST(req: NextRequest) {
  // 1. Parse body
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  const parsed = ScanSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  const { token: rawToken } = parsed.data

  // 2. Authenticate — admin session required
  const authHeader  = req.headers.get('Authorization') ?? ''
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!bearerToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: userData, error: authError } = await anonClient.auth.getUser(bearerToken)
  if (authError || !userData.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const adminId = userData.user.id

  const server = createServerSupabaseClient()

  // 3. Verify admin role
  const { data: adminProfile, error: profileError } = await server
    .from('profiles').select('role, admin_verified').eq('id', adminId).single()

  if (profileError || !adminProfile) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (adminProfile.role !== 'admin' || !adminProfile.admin_verified) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // 4. Cryptographically verify the token
  const verified = verifyQrToken(rawToken)
  if (!verified) {
    return NextResponse.json({ error: 'invalid_qr' }, { status: 422 })
  }

  // 5. Look up token in DB
  const { data: qrRow, error: qrLookupError } = await server
    .from('qr_tokens')
    .select('id, order_id, token_type, expires_at, used_at, waybill_id')
    .eq('token_hash', verified.hash)
    .single()

  if (qrLookupError || !qrRow) {
    return NextResponse.json({ error: 'invalid_qr' }, { status: 422 })
  }

  if (new Date(qrRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'qr_expired' }, { status: 422 })
  }

  if (qrRow.used_at) {
    return NextResponse.json({ error: 'qr_already_used' }, { status: 422 })
  }

  // 6. Fetch order and validate state
  const { data: order, error: orderError } = await server
    .from('orders')
    .select('id, status, buyer_id, seller_id, item_price_cents, delivery_school_id')
    .eq('id', qrRow.order_id)
    .single()

  if (orderError || !order) {
    return NextResponse.json({ error: 'order_not_found' }, { status: 404 })
  }

  const expectedStatus = qrRow.token_type === 'DROPOFF' ? 'AWAITING_DROPOFF' : 'ITEM_AT_HUB'

  if (order.status !== expectedStatus) {
    return NextResponse.json({
      error: 'wrong_order_state', current: order.status, expected: expectedStatus,
    }, { status: 409 })
  }

  // 7. Mark token as used (atomic)
  const { error: useError } = await server
    .from('qr_tokens')
    .update({ used_at: new Date().toISOString(), used_by: adminId })
    .eq('id', qrRow.id)
    .is('used_at', null)

  if (useError) {
    return NextResponse.json({ error: 'scan_failed' }, { status: 500 })
  }

  // 8. Advance order state
  const now          = new Date().toISOString()
  const month        = currentYearMonth()
  const waybillNum   = verified.waybillNumber

  if (qrRow.token_type === 'DROPOFF') {
    // ── DROP-OFF scanned ───────────────────────────────────────────────────

    await server.from('orders').update({
      status: 'ITEM_AT_HUB', dropped_off_at: now,
    }).eq('id', order.id)

    await server.from('order_events').insert({
      order_id: order.id, from_status: 'AWAITING_DROPOFF', to_status: 'ITEM_AT_HUB',
      note: 'Drop-off QR scanned by Klerebank admin — item received at hub',
      created_by: adminId,
    })

    await server.from('order_status_log').insert({
      order_id: order.id, status: 'ITEM_AT_HUB', changed_by_user_id: adminId,
    })

    // Credit school R10 for drop-off handling
    const { data: adminSchool } = await server
      .from('school_admins').select('school_id').eq('user_id', adminId).eq('active', true).single()

    if (adminSchool) {
      await server.from('school_ledger').upsert({
        school_id:      adminSchool.school_id,
        order_id:       order.id,
        admin_id:       adminId,
        event_type:     'dropoff',
        amount_cents:   1000,
        waybill_number: waybillNum,
        month,
      }, { onConflict: 'order_id,event_type', ignoreDuplicates: true })

      // Update monthly summary (+R10 direct) — fire-and-forget
      incrementSummary(server, adminSchool.school_id, 1000, 0)
        .catch(err => console.error('[Ledger] summary update error:', err))
    }

    // Generate COLLECTION QR
    const collectionQr = generateQrToken('COLLECTION', order.id, waybillNum, COLLECTION_TTL_HOURS)

    await server.from('qr_tokens').insert({
      order_id:   order.id,
      waybill_id: qrRow.waybill_id,
      token_type: 'COLLECTION',
      token_raw:  collectionQr.token,
      token_hash: collectionQr.hash,
      expires_at: collectionQr.expiresAt.toISOString(),
    })

    sendOrderNotification({ orderId: order.id, newStatus: 'ITEM_AT_HUB', triggeredBy: 'admin' })
      .catch(err => console.error('[Notifications] dropoff scan error:', err))

    return NextResponse.json({
      success: true, action: 'DROPOFF_SCANNED', newStatus: 'ITEM_AT_HUB', waybill: waybillNum,
    })

  } else {
    // ── COLLECTION scanned ─────────────────────────────────────────────────

    const commissionRate  = parseFloat(process.env.PLATFORM_COMMISSION_RATE ?? '0.08')
    const commissionCents = Math.round(order.item_price_cents * commissionRate)
    const sellerPayout    = order.item_price_cents - commissionCents

    await server.from('orders').update({
      status:                    'COMPLETED',
      payment_status:            'CAPTURED',
      collected_at:              now,
      completed_at:              now,
      platform_commission_cents: commissionCents,
      seller_payout_cents:       sellerPayout,
    }).eq('id', order.id)

    // Add seller to payout queue — snapshot bank details at time of payout creation
    const { data: bankDetails } = await server
      .from('seller_bank_details')
      .select('bank_name, account_number, branch_code, account_holder_name, account_type, verified')
      .eq('seller_id', order.seller_id)
      .single()

    const hasBank = bankDetails?.verified === true
    await server.from('seller_payouts').upsert({
      order_id:      order.id,
      seller_id:     order.seller_id,
      amount_cents:  sellerPayout,
      status:        hasBank ? 'pending' : 'held',
      held_reason:   hasBank ? null : 'no_verified_bank_details',
      bank_snapshot: bankDetails ?? null,
    }, { onConflict: 'order_id', ignoreDuplicates: true })

    await server.from('order_events').insert({
      order_id: order.id, from_status: 'ITEM_AT_HUB', to_status: 'COMPLETED',
      note: 'Collection QR scanned by Klerebank admin — buyer collected item, funds released to seller',
      created_by: adminId,
    })

    await server.from('order_status_log').insert({
      order_id: order.id, status: 'COMPLETED', changed_by_user_id: adminId,
    })

    // Credit school R10 for collection handling
    // RULE: use delivery_school_id from order as authoritative source — falls back to admin's school
    const sourceSchoolId = order.delivery_school_id ?? null
    const { data: adminSchool2 } = await server
      .from('school_admins').select('school_id').eq('user_id', adminId).eq('active', true).single()

    const creditSchoolId = adminSchool2?.school_id ?? null

    if (creditSchoolId) {
      await server.from('school_ledger').upsert({
        school_id:      creditSchoolId,
        order_id:       order.id,
        admin_id:       adminId,
        event_type:     'collection',
        amount_cents:   1000,
        waybill_number: waybillNum,
        month,
      }, { onConflict: 'order_id,event_type', ignoreDuplicates: true })

      // Update summary and then send running-total notification
      const newTotal = await incrementSummary(server, creditSchoolId, 1000, 0)
      if (newTotal !== null) {
        sendLedgerCreditNotification(creditSchoolId, waybillNum, newTotal, currentMonthName())
          .catch(err => console.error('[Ledger] credit notification error:', err))
      }
    }

    // Referral earnings (fire-and-forget)
    creditReferralEarnings(server, order.id, waybillNum, sourceSchoolId)
      .catch(err => console.error('[Referral] error crediting earnings:', err))

    sendOrderNotification({ orderId: order.id, newStatus: 'COMPLETED', triggeredBy: 'admin' })
      .catch(err => console.error('[Notifications] collection scan error:', err))

    return NextResponse.json({
      success:      true,
      action:       'COLLECTION_SCANNED',
      newStatus:    'COMPLETED',
      waybill:      waybillNum,
      sellerPayout: `R ${(sellerPayout / 100).toFixed(2)}`,
    })
  }
}
