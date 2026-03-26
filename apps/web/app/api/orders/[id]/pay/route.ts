import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// RULE: This is a DEMO payment endpoint. It simulates Peach Payments escrow by
// advancing the order directly to AWAITING_SHIPMENT_BOOKING without real card
// processing. When Peach Payments credentials arrive, replace the status
// transition here with a real delayed-capture payment initiation, and move the
// status advance to the Peach Payments webhook handler (payment.held event).
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

  // 3. Advance order status
  // RULE: In production this becomes two steps:
  //   a. Initiate Peach Payments delayed-capture → status = PAYMENT_HELD
  //   b. Peach webhook (payment.captured) → status = AWAITING_SHIPMENT_BOOKING
  // For demo we go straight to AWAITING_SHIPMENT_BOOKING in one step.
  const now = new Date().toISOString()
  const { error: updateError } = await server
    .from('orders')
    .update({
      status: 'AWAITING_SHIPMENT_BOOKING',
      payment_status: 'HELD',
      paid_at: now,
    })
    .eq('id', orderId)

  if (updateError) {
    console.error('Order pay update error:', updateError)
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }

  // 4. Append order events (RULE: never delete or mutate order history)
  await server.from('order_events').insert([
    {
      order_id: orderId,
      from_status: 'PENDING_PAYMENT',
      to_status: 'PAYMENT_HELD',
      note: 'Demo payment initiated',
      created_by: buyerId,
    },
    {
      order_id: orderId,
      from_status: 'PAYMENT_HELD',
      to_status: 'AWAITING_SHIPMENT_BOOKING',
      note: 'Demo payment confirmed — funds held in escrow',
      created_by: buyerId,
    },
  ])

  return NextResponse.json({ success: true, newStatus: 'AWAITING_SHIPMENT_BOOKING' })
}
