import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { verifyWebhookSignature } from '@/lib/stitch'
import { sendOrderNotification } from '@/lib/notifications'
import {
  generateWaybillNumber,
  generateQrToken,
  DROPOFF_TTL_HOURS,
} from '@/lib/qr'

// POST /api/webhooks/stitch
//
// Receives payment events from Stitch Express (delivered via Svix).
// Handled event types:
//   payment.paid     → AWAITING_DROPOFF (funds held)
//   payment.failed   → CANCELLED
//   payment.expired  → CANCELLED
//
// Order is found by stitch_payment_id (the payment link ID we stored at checkout).

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  const svixId        = req.headers.get('svix-id')
  const svixTimestamp = req.headers.get('svix-timestamp')
  const svixSignature = req.headers.get('svix-signature')

  if (!verifyWebhookSignature(rawBody, { svixId, svixTimestamp, svixSignature })) {
    console.warn('[Stitch webhook] Invalid signature — rejected')
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
  }

  let event: { type: string; data: Record<string, unknown> }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const server = createServerSupabaseClient()

  // Find order by the payment link ID stored in orders.stitch_payment_id
  const paymentLinkId = event.data?.id as string | undefined

  async function findOrder() {
    if (!paymentLinkId) return null
    const { data } = await server
      .from('orders')
      .select('id, status, buyer_id')
      .eq('stitch_payment_id', paymentLinkId)
      .single()
    return data
  }

  // ── payment.paid → advance to AWAITING_DROPOFF ────────────────────────────
  if (event.type === 'payment.paid') {
    const order = await findOrder()
    if (!order) {
      console.warn('[Stitch webhook] payment.paid: no order found for link', paymentLinkId)
      return NextResponse.json({ ok: true, skipped: true })
    }
    if (order.status !== 'PENDING_PAYMENT') {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const now           = new Date()
    const autoDropoffAt = new Date(now.getTime() + DROPOFF_TTL_HOURS * 60 * 60 * 1000)

    await server.from('orders').update({
      status:          'AWAITING_DROPOFF',
      payment_status:  'HELD',
      paid_at:         now.toISOString(),
      auto_dropoff_at: autoDropoffAt.toISOString(),
    }).eq('id', order.id)

    const waybillNumber = generateWaybillNumber()
    const dropoffQr     = generateQrToken('DROPOFF', order.id, waybillNumber, DROPOFF_TTL_HOURS)

    const { data: waybill } = await server
      .from('waybills')
      .insert({ waybill_number: waybillNumber, order_id: order.id })
      .select('id')
      .single()

    if (waybill) {
      await server.from('qr_tokens').insert({
        order_id:   order.id,
        waybill_id: waybill.id,
        token_type: 'DROPOFF',
        token_raw:  dropoffQr.token,
        token_hash: dropoffQr.hash,
        expires_at: dropoffQr.expiresAt.toISOString(),
      })
    }

    await server.from('order_events').insert([
      {
        order_id:    order.id,
        from_status: 'PENDING_PAYMENT',
        to_status:   'PAYMENT_HELD',
        note:        'Stitch Express payment confirmed — funds held',
        created_by:  order.buyer_id,
      },
      {
        order_id:    order.id,
        from_status: 'PAYMENT_HELD',
        to_status:   'AWAITING_DROPOFF',
        note:        `Waybill ${waybillNumber} generated — seller notified to drop off`,
        created_by:  order.buyer_id,
      },
    ])

    sendOrderNotification({ orderId: order.id, newStatus: 'AWAITING_DROPOFF', triggeredBy: 'buyer' })
      .catch(err => console.error('[Stitch webhook] notification error:', err))

    console.log(`[Stitch webhook] ✅ Order ${order.id.slice(0, 8)} → AWAITING_DROPOFF | ${waybillNumber}`)
  }

  // ── payment.failed / payment.expired → CANCELLED ──────────────────────────
  if (event.type === 'payment.failed' || event.type === 'payment.expired') {
    const order = await findOrder()
    if (order?.status === 'PENDING_PAYMENT') {
      const reason = event.type === 'payment.failed' ? 'failed' : 'expired'
      await server.from('orders').update({ status: 'CANCELLED' }).eq('id', order.id)
      await server.from('order_events').insert({
        order_id:    order.id,
        from_status: 'PENDING_PAYMENT',
        to_status:   'CANCELLED',
        note:        `Stitch payment ${reason} — order cancelled automatically`,
        created_by:  null,
      })
      console.log(`[Stitch webhook] ❌ Order ${order.id.slice(0, 8)} → CANCELLED (${reason})`)
    }
  }

  return NextResponse.json({ ok: true })
}
