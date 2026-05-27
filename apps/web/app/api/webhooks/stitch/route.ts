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
// Receives payment status events from Stitch.
// This is the authoritative trigger for order state advances after payment.
//
// Handled event types:
//   payment_initiation_request.complete  → AWAITING_DROPOFF (funds held)
//   payment_initiation_request.failed    → CANCELLED
//   payment_initiation_request.expired   → CANCELLED
//
// Security: HMAC-SHA256 signature verified via x-stitch-signature header.
// Never advance order status without a valid signature.

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const sig     = req.headers.get('x-stitch-signature')

  if (!verifyWebhookSignature(rawBody, sig)) {
    console.warn('[Stitch webhook] Invalid signature — rejected')
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
  }

  let event: { type: string; data: Record<string, unknown> }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const server  = createServerSupabaseClient()
  const orderId = event.data?.externalReference as string | undefined

  // ── Payment confirmed ─────────────────────────────────────────────────────
  if (event.type === 'payment_initiation_request.complete') {
    if (!orderId) {
      console.error('[Stitch webhook] complete event missing externalReference')
      return NextResponse.json({ error: 'missing_reference' }, { status: 400 })
    }

    const { data: order } = await server
      .from('orders')
      .select('id, status, buyer_id')
      .eq('id', orderId)
      .single()

    // Idempotency — skip if already advanced (webhook may fire more than once)
    if (!order || order.status !== 'PENDING_PAYMENT') {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const now           = new Date()
    const autoDropoffAt = new Date(now.getTime() + DROPOFF_TTL_HOURS * 60 * 60 * 1000)

    await server.from('orders').update({
      status:          'AWAITING_DROPOFF',
      payment_status:  'HELD',
      paid_at:         now.toISOString(),
      auto_dropoff_at: autoDropoffAt.toISOString(),
    }).eq('id', orderId)

    // ── Waybill + DROP-OFF QR ───────────────────────────────────────────────
    const waybillNumber = generateWaybillNumber()
    const dropoffQr     = generateQrToken('DROPOFF', orderId, waybillNumber, DROPOFF_TTL_HOURS)

    const { data: waybill } = await server
      .from('waybills')
      .insert({ waybill_number: waybillNumber, order_id: orderId })
      .select('id')
      .single()

    if (waybill) {
      await server.from('qr_tokens').insert({
        order_id:   orderId,
        waybill_id: waybill.id,
        token_type: 'DROPOFF',
        token_raw:  dropoffQr.token,
        token_hash: dropoffQr.hash,
        expires_at: dropoffQr.expiresAt.toISOString(),
      })
    }

    // ── Order events (append-only audit log) ────────────────────────────────
    await server.from('order_events').insert([
      {
        order_id:    orderId,
        from_status: 'PENDING_PAYMENT',
        to_status:   'PAYMENT_HELD',
        note:        'Stitch payment confirmed — funds held in escrow',
        created_by:  order.buyer_id,
      },
      {
        order_id:    orderId,
        from_status: 'PAYMENT_HELD',
        to_status:   'AWAITING_DROPOFF',
        note:        `Waybill ${waybillNumber} generated — seller notified to drop off`,
        created_by:  order.buyer_id,
      },
    ])

    // ── Notify buyer, seller, school admins (fire-and-forget) ───────────────
    sendOrderNotification({ orderId, newStatus: 'AWAITING_DROPOFF', triggeredBy: 'buyer' })
      .catch(err => console.error('[Stitch webhook] notification error:', err))

    console.log(`[Stitch webhook] ✅ Order ${orderId.slice(0, 8)} → AWAITING_DROPOFF | ${waybillNumber}`)
  }

  // ── Payment failed or expired ─────────────────────────────────────────────
  if (
    event.type === 'payment_initiation_request.failed' ||
    event.type === 'payment_initiation_request.expired'
  ) {
    if (orderId) {
      const { data: order } = await server
        .from('orders')
        .select('id, status')
        .eq('id', orderId)
        .single()

      if (order?.status === 'PENDING_PAYMENT') {
        const reason = event.type === 'payment_initiation_request.failed' ? 'failed' : 'expired'

        await server.from('orders')
          .update({ status: 'CANCELLED' })
          .eq('id', orderId)

        await server.from('order_events').insert({
          order_id:    orderId,
          from_status: 'PENDING_PAYMENT',
          to_status:   'CANCELLED',
          note:        `Stitch payment ${reason} — order cancelled automatically`,
          created_by:  null,
        })

        console.log(`[Stitch webhook] ❌ Order ${orderId.slice(0, 8)} → CANCELLED (${reason})`)
      }
    }
  }

  return NextResponse.json({ ok: true })
}
