import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { sendOrderNotification } from '@/lib/notifications'
import {
  generateWaybillNumber,
  generateQrToken,
  DROPOFF_TTL_HOURS,
} from '@/lib/qr'

// RULE: This is a DEMO payment endpoint. It simulates Stitch escrow by
// advancing the order directly to AWAITING_DROPOFF without real payment
// processing. When Stitch credentials arrive, replace the status transition
// here with a real Stitch payment initiation, and move the status advance
// to the Stitch webhook handler (payment.complete event).
//
// PROTOTYPE TRADE-OFF: documented in CLAUDE.md "Known Prototype Trade-offs".

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params

  // 1. Authenticate buyer from Authorization header
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: userData, error: authError } = await anonClient.auth.getUser(token)
  if (authError || !userData.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const buyerId = userData.user.id

  const server = createServerSupabaseClient()

  // 2. Fetch order — verify it belongs to this buyer and is payable
  const { data: order, error: orderError } = await server
    .from('orders')
    .select('id, status, buyer_id, total_paid_cents')
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    return NextResponse.json({ error: 'order_not_found' }, { status: 404 })
  }
  if (order.buyer_id !== buyerId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (order.status !== 'PENDING_PAYMENT') {
    return NextResponse.json({ error: 'order_not_payable', status: order.status }, { status: 409 })
  }

  // 3. Advance order to AWAITING_DROPOFF and set auto-cancel deadline (72h)
  const now           = new Date()
  const autoDropoffAt = new Date(now.getTime() + DROPOFF_TTL_HOURS * 60 * 60 * 1000)

  const { error: updateError } = await server
    .from('orders')
    .update({
      status:          'AWAITING_DROPOFF',
      payment_status:  'HELD',
      paid_at:         now.toISOString(),
      auto_dropoff_at: autoDropoffAt.toISOString(),
    })
    .eq('id', orderId)

  if (updateError) {
    console.error('Order pay update error:', updateError)
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }

  // 4. Generate waybill number + DROP-OFF QR token
  const waybillNumber = generateWaybillNumber()
  const dropoffQr     = generateQrToken('DROPOFF', orderId, waybillNumber, DROPOFF_TTL_HOURS)

  // 4a. Insert waybill
  const { data: waybill, error: waybillError } = await server
    .from('waybills')
    .insert({ waybill_number: waybillNumber, order_id: orderId })
    .select('id')
    .single()

  if (waybillError || !waybill) {
    console.error('Waybill insert error:', waybillError)
    // Non-fatal for prototype — order is paid, waybill can be regenerated
  } else {
    // 4b. Insert DROP-OFF QR token
    const { error: qrError } = await server
      .from('qr_tokens')
      .insert({
        order_id:   orderId,
        waybill_id: waybill.id,
        token_type: 'DROPOFF',
        token_raw:  dropoffQr.token,
        token_hash: dropoffQr.hash,
        expires_at: dropoffQr.expiresAt.toISOString(),
      })

    if (qrError) {
      console.error('QR token insert error:', qrError)
    }
  }

  // 5. Append order events (RULE: never delete or mutate order history)
  await server.from('order_events').insert([
    {
      order_id:    orderId,
      from_status: 'PENDING_PAYMENT',
      to_status:   'PAYMENT_HELD',
      note:        'Demo payment initiated — funds held in Stitch escrow',
      created_by:  buyerId,
    },
    {
      order_id:    orderId,
      from_status: 'PAYMENT_HELD',
      to_status:   'AWAITING_DROPOFF',
      note:        `Waybill ${waybillNumber} generated — seller notified to drop off item`,
      created_by:  buyerId,
    },
  ])

  // 6. Notify seller (fire-and-forget)
  sendOrderNotification({ orderId, newStatus: 'AWAITING_DROPOFF', triggeredBy: 'buyer' })
    .catch(err => console.error('[Notifications] pay route error:', err))

  return NextResponse.json({
    success:       true,
    newStatus:     'AWAITING_DROPOFF',
    waybillNumber,
  })
}
