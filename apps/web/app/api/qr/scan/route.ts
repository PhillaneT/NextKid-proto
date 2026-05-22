import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { sendOrderNotification } from '@/lib/notifications'
import {
  verifyQrToken,
  generateQrToken,
  COLLECTION_TTL_HOURS,
} from '@/lib/qr'

// ── Referral earning helper ───────────────────────────────────────────────────
// L1 referrer earns R2, L2 referrer earns R0.50 — capped at 2 levels.

async function creditReferralEarnings(
  server:        ReturnType<typeof createServerSupabaseClient>,
  orderId:       string,
  waybillNumber: string,
  sourceSchoolId: string | null,
) {
  if (!sourceSchoolId) return

  // Find L1 referrer (the school that referred sourceSchoolId)
  const { data: source } = await server
    .from('schools').select('referred_by_school_id').eq('id', sourceSchoolId).single()

  const l1SchoolId = source?.referred_by_school_id
  if (!l1SchoolId) return

  // Credit R2 to L1
  await server.from('referral_earnings').upsert({
    earning_school_id: l1SchoolId,
    source_school_id:  sourceSchoolId,
    order_id:          orderId,
    waybill_number:    waybillNumber,
    amount_cents:      200,   // R2
    level:             1,
  }, { onConflict: 'earning_school_id,order_id,level', ignoreDuplicates: true })

  // Find L2 referrer (the school that referred the L1 school)
  const { data: l1 } = await server
    .from('schools').select('referred_by_school_id').eq('id', l1SchoolId).single()

  const l2SchoolId = l1?.referred_by_school_id
  if (!l2SchoolId) return

  // Credit R0.50 to L2
  await server.from('referral_earnings').upsert({
    earning_school_id: l2SchoolId,
    source_school_id:  sourceSchoolId,
    order_id:          orderId,
    waybill_number:    waybillNumber,
    amount_cents:      50,    // R0.50
    level:             2,
  }, { onConflict: 'earning_school_id,order_id,level', ignoreDuplicates: true })
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
  const authHeader = req.headers.get('Authorization') ?? ''
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

  // 3. Verify admin role — must be role='admin' AND admin_verified=true
  const { data: adminProfile, error: profileError } = await server
    .from('profiles')
    .select('role, admin_verified')
    .eq('id', adminId)
    .single()

  if (profileError || !adminProfile) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (adminProfile.role !== 'admin' || !adminProfile.admin_verified) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // 4. Cryptographically verify the token (HMAC + expiry check inside)
  const verified = verifyQrToken(rawToken)
  if (!verified) {
    return NextResponse.json({ error: 'invalid_qr' }, { status: 422 })
  }

  // 5. Look up token in DB by hash — single-use guard (atomic UPDATE)
  // RULE: UPDATE WHERE used_at IS NULL is atomic in PostgreSQL.
  // If two admins scan simultaneously, only one succeeds. The other gets no rows.
  const { data: qrRow, error: qrLookupError } = await server
    .from('qr_tokens')
    .select('id, order_id, token_type, expires_at, used_at, waybill_id')
    .eq('token_hash', verified.hash)
    .single()

  if (qrLookupError || !qrRow) {
    return NextResponse.json({ error: 'invalid_qr' }, { status: 422 })
  }

  // Check DB-side expiry (belt-and-suspenders — payload already checked above)
  if (new Date(qrRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'qr_expired' }, { status: 422 })
  }

  // Check already used
  if (qrRow.used_at) {
    return NextResponse.json({ error: 'qr_already_used' }, { status: 422 })
  }

  // 6. Fetch order and validate it is in the expected state
  const { data: order, error: orderError } = await server
    .from('orders')
    .select('id, status, buyer_id, seller_id, item_price_cents')
    .eq('id', qrRow.order_id)
    .single()

  if (orderError || !order) {
    return NextResponse.json({ error: 'order_not_found' }, { status: 404 })
  }

  const expectedStatus =
    qrRow.token_type === 'DROPOFF' ? 'AWAITING_DROPOFF' : 'ITEM_AT_HUB'

  if (order.status !== expectedStatus) {
    return NextResponse.json({
      error:   'wrong_order_state',
      current: order.status,
      expected: expectedStatus,
    }, { status: 409 })
  }

  // 7. Mark token as used (atomic — prevents replay in parallel requests)
  const { error: useError } = await server
    .from('qr_tokens')
    .update({ used_at: new Date().toISOString(), used_by: adminId })
    .eq('id', qrRow.id)
    .is('used_at', null) // double guard

  if (useError) {
    return NextResponse.json({ error: 'scan_failed' }, { status: 500 })
  }

  // 8. Advance order state and run type-specific logic
  const now = new Date().toISOString()

  if (qrRow.token_type === 'DROPOFF') {
    // ── DROP-OFF scanned: item received at hub ─────────────────────────────

    await server.from('orders').update({
      status:       'ITEM_AT_HUB',
      dropped_off_at: now,
    }).eq('id', order.id)

    await server.from('order_events').insert({
      order_id:    order.id,
      from_status: 'AWAITING_DROPOFF',
      to_status:   'ITEM_AT_HUB',
      note:        'Drop-off QR scanned by Klerebank admin — item received at hub',
      created_by:  adminId,
    })

    // Audit log
    await server.from('order_status_log').insert({
      order_id: order.id, status: 'ITEM_AT_HUB', changed_by_user_id: adminId,
    })

    // Credit admin R10 for processing this drop-off
    const { data: adminSchool } = await server
      .from('school_admins').select('school_id').eq('user_id', adminId).eq('active', true).single()
    if (adminSchool) {
      await server.from('school_ledger').upsert({
        school_id: adminSchool.school_id, order_id: order.id,
        admin_id: adminId, event_type: 'dropoff', amount_cents: 1000,
      }, { onConflict: 'order_id,event_type', ignoreDuplicates: true })
    }

    // Generate COLLECTION QR and store it — buyer can now come collect
    const collectionQr = generateQrToken(
      'COLLECTION',
      order.id,
      verified.waybillNumber,
      COLLECTION_TTL_HOURS,
    )

    await server.from('qr_tokens').insert({
      order_id:   order.id,
      waybill_id: qrRow.waybill_id,
      token_type: 'COLLECTION',
      token_raw:  collectionQr.token,
      token_hash: collectionQr.hash,
      expires_at: collectionQr.expiresAt.toISOString(),
    })

    // Notify both parties (fire-and-forget)
    sendOrderNotification({ orderId: order.id, newStatus: 'ITEM_AT_HUB', triggeredBy: 'admin' })
      .catch(err => console.error('[Notifications] dropoff scan error:', err))

    return NextResponse.json({
      success:    true,
      action:     'DROPOFF_SCANNED',
      newStatus:  'ITEM_AT_HUB',
      waybill:    verified.waybillNumber,
    })

  } else {
    // ── COLLECTION scanned: buyer has collected — complete the order ────────

    // RULE: Commission deducted before releasing funds to seller.
    const commissionRate  = parseFloat(process.env.PLATFORM_COMMISSION_RATE ?? '0.08')
    const commissionCents = Math.round(order.item_price_cents * commissionRate)
    const sellerPayout    = order.item_price_cents - commissionCents

    await server.from('orders').update({
      status:                   'COMPLETED',
      payment_status:           'CAPTURED',
      collected_at:             now,
      completed_at:             now,
      platform_commission_cents: commissionCents,
      seller_payout_cents:      sellerPayout,
    }).eq('id', order.id)

    await server.from('order_events').insert({
      order_id:    order.id,
      from_status: 'ITEM_AT_HUB',
      to_status:   'COMPLETED',
      note:        'Collection QR scanned by Klerebank admin — buyer collected item, funds released to seller',
      created_by:  adminId,
    })

    // Audit log
    await server.from('order_status_log').insert({
      order_id: order.id, status: 'COMPLETED', changed_by_user_id: adminId,
    })

    // Credit admin R10 for processing this collection
    const { data: adminSchool2 } = await server
      .from('school_admins').select('school_id').eq('user_id', adminId).eq('active', true).single()
    if (adminSchool2) {
      await server.from('school_ledger').upsert({
        school_id: adminSchool2.school_id, order_id: order.id,
        admin_id: adminId, event_type: 'collection', amount_cents: 1000,
      }, { onConflict: 'order_id,event_type', ignoreDuplicates: true })
    }

    // ── Referral earnings: credit R2 (L1) and R0.50 (L2) to referring schools ──
    // Uses delivery_school_id as the source school for the referral chain
    creditReferralEarnings(server, order.id, verified.waybillNumber, adminSchool2?.school_id ?? null)
      .catch(err => console.error('[Referral] Error crediting earnings:', err))

    // Notify both parties (fire-and-forget)
    sendOrderNotification({ orderId: order.id, newStatus: 'COMPLETED', triggeredBy: 'admin' })
      .catch(err => console.error('[Notifications] collection scan error:', err))

    return NextResponse.json({
      success:      true,
      action:       'COLLECTION_SCANNED',
      newStatus:    'COMPLETED',
      waybill:      verified.waybillNumber,
      sellerPayout: `R ${(sellerPayout / 100).toFixed(2)}`,
    })
  }
}
