import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createPaymentRequest } from '@/lib/stitch'

// POST /api/orders/:id/pay
//
// Initiates a Stitch payment for a PENDING_PAYMENT order.
// Returns { redirectUrl } — the client redirects the buyer to this Stitch-hosted page.
// Order status stays PENDING_PAYMENT here; the Stitch webhook handler
// (/api/webhooks/stitch) advances it to AWAITING_DROPOFF once payment confirms.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params

  // ── Auth ──────────────────────────────────────────────────────────────────
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data: { user }, error: authError } = await anon.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const server = createServerSupabaseClient()

  // ── Validate order ────────────────────────────────────────────────────────
  const { data: order } = await server
    .from('orders')
    .select('id, status, buyer_id, total_paid_cents')
    .eq('id', orderId)
    .single()

  if (!order)                  return NextResponse.json({ error: 'order_not_found' }, { status: 404 })
  if (order.buyer_id !== user.id) return NextResponse.json({ error: 'forbidden' },      { status: 403 })
  if (order.status !== 'PENDING_PAYMENT') {
    return NextResponse.json({ error: 'order_not_payable', status: order.status }, { status: 409 })
  }

  // ── Create Stitch payment link ────────────────────────────────────────────
  const { data: profile } = await server
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:5000'

  try {
    const { paymentId, redirectUrl } = await createPaymentRequest({
      orderId,
      amountCents: order.total_paid_cents,
      buyerName:   profile?.full_name ?? 'NextKid Buyer',
      webhookUrl:  `${baseUrl}/api/webhooks/stitch`,
      returnUrl:   `${baseUrl}/orders/${orderId}`,
    })

    // Store Stitch payment ID so the webhook can find this order
    await server
      .from('orders')
      .update({ stitch_payment_id: paymentId })
      .eq('id', orderId)

    return NextResponse.json({ redirectUrl })
  } catch (err: any) {
    console.error('[Stitch] Payment initiation error:', err?.message ?? err)
    return NextResponse.json(
      { error: 'payment_unavailable', message: err?.message ?? 'Stitch unavailable' },
      { status: 502 },
    )
  }
}
