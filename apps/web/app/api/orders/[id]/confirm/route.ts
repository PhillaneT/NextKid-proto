import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Buyer confirms receipt of item → DELIVERED → COMPLETED
// RULE: This triggers fund release to seller in production (Peach Payments capture).
// In demo mode it just advances the status.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params

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

  const { data: order, error: orderError } = await server
    .from('orders')
    .select('id, status, buyer_id, seller_id, item_price_cents, platform_commission_cents')
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    return NextResponse.json({ error: 'order_not_found' }, { status: 404 })
  }
  if (order.buyer_id !== buyerId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (order.status !== 'DELIVERED') {
    return NextResponse.json({ error: 'order_not_delivered', status: order.status }, { status: 409 })
  }

  // RULE: Commission is deducted before releasing funds to seller.
  // Rate is read from env — never hardcoded.
  const commissionRate = parseFloat(process.env.PLATFORM_COMMISSION_RATE ?? '0.08')
  const commissionCents = Math.round(order.item_price_cents * commissionRate)
  const sellerPayoutCents = order.item_price_cents - commissionCents

  const now = new Date().toISOString()
  const { error: updateError } = await server
    .from('orders')
    .update({
      status: 'COMPLETED',
      payment_status: 'CAPTURED',
      completed_at: now,
      platform_commission_cents: commissionCents,
      seller_payout_cents: sellerPayoutCents,
    })
    .eq('id', orderId)

  if (updateError) {
    console.error('Confirm receipt error:', updateError)
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }

  await server.from('order_events').insert({
    order_id: orderId,
    from_status: 'DELIVERED',
    to_status: 'COMPLETED',
    note: 'Buyer confirmed receipt — funds released to seller',
    created_by: buyerId,
  })

  return NextResponse.json({ success: true, newStatus: 'COMPLETED' })
}
