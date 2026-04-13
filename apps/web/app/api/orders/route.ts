import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const CreateOrderSchema = z.object({
  listingId: z.string().uuid(),
  selectedQuote: z.object({
    quoteId: z.string(),
    method: z.enum(['D2D', 'D2L', 'L2D', 'L2L']),
    serviceLevelCode: z.string(),
    serviceLevelName: z.string(),
    rate: z.number().positive(),       // ZAR float — converted to cents server-side
    estimatedDeliveryFrom: z.string(), // ISO string
    estimatedDeliveryTo: z.string(),
  }),
  // RULE: buyer's chosen PUDO locker — required for D2L and L2L shipments, null otherwise
  buyerLockerId:   z.string().nullable().optional(),
  buyerLockerName: z.string().nullable().optional(),
})

export async function POST(req: NextRequest) {
  // 1. Parse and validate body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const parsed = CreateOrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', message: parsed.error.message }, { status: 400 })
  }
  const { listingId, selectedQuote, buyerLockerId, buyerLockerName } = parsed.data

  // 2. Authenticate the buyer
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: userData, error: authError } = await anonClient.auth.getUser(token)
  if (authError || !userData.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const buyerId = userData.user.id

  const serverClient = createServerSupabaseClient()

  // 3. Re-fetch listing to validate it is still available
  // RULE: Always re-validate at order creation — state may have changed since quote was fetched
  const { data: listing, error: listingError } = await serverClient
    .from('listings')
    .select('seller_id, price_cents, status')
    .eq('id', listingId)
    .single()

  if (listingError || !listing) {
    return NextResponse.json({ error: 'listing_not_found' }, { status: 404 })
  }
  if (listing.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'listing_no_longer_available' }, { status: 409 })
  }
  if (listing.seller_id === buyerId) {
    return NextResponse.json({ error: 'cannot_buy_own_item' }, { status: 400 })
  }

  // 4. Compute money — all in integer cents to avoid floating point errors
  // RULE: Buyer pays shipping. Seller only sees item price. Commission calculated at completion.
  const itemPriceCents: number = listing.price_cents
  const shippingCostCents: number = Math.round(selectedQuote.rate * 100)
  const totalPaidCents: number = itemPriceCents + shippingCostCents

  // 5. Insert the order (service-role bypasses RLS — we've already verified auth above)
  // TODO: snapshot buyer's delivery address to the order row before go-live
  const { data: order, error: orderError } = await serverClient
    .from('orders')
    .insert({
      buyer_id: buyerId,
      seller_id: listing.seller_id,
      listing_id: listingId,
      item_price_cents: itemPriceCents,
      shipping_cost_cents: shippingCostCents,
      total_paid_cents: totalPaidCents,
      status: 'PENDING_PAYMENT',
      payment_status: 'PENDING',
      shipping_method: selectedQuote.method,
      service_level_code: selectedQuote.serviceLevelCode,
      // RULE: Lock the quoted shipping price at order creation — never recalculate
      quoted_rate_cents: shippingCostCents,
      estimated_delivery: selectedQuote.estimatedDeliveryTo,
      // RULE: snapshot buyer's chosen locker at order time for D2L / L2L shipment booking
      delivery_locker_id:   buyerLockerId   ?? null,
      delivery_locker_name: buyerLockerName ?? null,
    })
    .select('id')
    .single()

  if (orderError || !order) {
    console.error('Order insert error:', orderError)
    return NextResponse.json({ error: 'order_creation_failed' }, { status: 500 })
  }

  // 6. Append the first order event (RULE: never delete or mutate order history)
  await serverClient.from('order_events').insert({
    order_id: order.id,
    from_status: null,
    to_status: 'PENDING_PAYMENT',
    note: 'Order created by buyer',
    created_by: buyerId,
  })

  return NextResponse.json({ orderId: order.id }, { status: 201 })
}
