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
  }).nullable().optional(),
  // RULE: buyer's chosen PUDO locker — required for D2L and L2L shipments, null otherwise
  buyerLockerId:    z.string().nullable().optional(),
  buyerLockerName:  z.string().nullable().optional(),
  // Multi-item: which listing_items the buyer selected
  selectedItemIds:  z.array(z.string().uuid()).optional(),
  cartCheckout:     z.boolean().optional(),
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
  const { listingId, selectedQuote, buyerLockerId, buyerLockerName, selectedItemIds } = parsed.data

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
    .select('seller_id, price_cents, status, is_multi_item, available_count')
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

  // 4. Compute money
  // For multi-item: sum of selected item prices. For single-item: listing price.
  let itemPriceCents: number = listing.price_cents
  let purchasedItemIds: string[] = []

  if (listing.is_multi_item && selectedItemIds && selectedItemIds.length > 0) {
    const { data: items, error: itemsErr } = await serverClient
      .from('listing_items')
      .select('id, price_cents, status')
      .in('id', selectedItemIds)

    if (itemsErr || !items) {
      return NextResponse.json({ error: 'items_not_found' }, { status: 404 })
    }
    // Validate all items are available or reserved by this buyer
    const badItems = items.filter(i => i.status === 'sold')
    if (badItems.length > 0) {
      return NextResponse.json({ error: 'items_already_sold' }, { status: 409 })
    }
    itemPriceCents   = items.reduce((s, i) => s + i.price_cents, 0)
    purchasedItemIds = items.map(i => i.id)
  }

  const shippingCostCents: number = selectedQuote ? Math.round(selectedQuote.rate * 100) : 0
  const totalPaidCents: number    = itemPriceCents + shippingCostCents

  // 5. Insert the order
  const { data: order, error: orderError } = await serverClient
    .from('orders')
    .insert({
      buyer_id:  buyerId,
      seller_id: listing.seller_id,
      listing_id: listingId,
      item_price_cents:    itemPriceCents,
      shipping_cost_cents: shippingCostCents,
      total_paid_cents:    totalPaidCents,
      status:         'PENDING_PAYMENT',
      payment_status: 'PENDING',
      shipping_method:    selectedQuote?.method          ?? null,
      service_level_code: selectedQuote?.serviceLevelCode ?? null,
      quoted_rate_cents:  shippingCostCents,
      estimated_delivery: selectedQuote?.estimatedDeliveryTo ?? null,
      delivery_locker_id:   buyerLockerId   ?? null,
      delivery_locker_name: buyerLockerName ?? null,
    })
    .select('id')
    .single()

  if (orderError || !order) {
    console.error('Order insert error:', orderError)
    return NextResponse.json({ error: 'order_creation_failed' }, { status: 500 })
  }

  // 6. Record order_items and mark listing_items as sold (multi-item only)
  if (purchasedItemIds.length > 0) {
    const { data: itemPrices } = await serverClient
      .from('listing_items')
      .select('id, price_cents')
      .in('id', purchasedItemIds)

    await serverClient.from('order_items').insert(
      (itemPrices ?? []).map(i => ({
        order_id:         order.id,
        listing_item_id:  i.id,
        price_at_purchase: i.price_cents,
      }))
    )

    // Mark items as sold
    await serverClient.from('listing_items')
      .update({ status: 'sold' })
      .in('id', purchasedItemIds)

    // Update listing's available_count — if 0 remaining, mark listing SOLD
    const newAvailable = (listing.available_count ?? 0) - purchasedItemIds.length
    await serverClient.from('listings').update({
      available_count: Math.max(0, newAvailable),
      ...(newAvailable <= 0 ? { status: 'SOLD' } : {}),
    }).eq('id', listingId)

    // Clean up reservations for these items
    await serverClient.from('reservations')
      .delete()
      .in('listing_item_id', purchasedItemIds)
  }

  // 7. Append the first order event (RULE: never delete or mutate order history)
  await serverClient.from('order_events').insert({
    order_id:    order.id,
    from_status: null,
    to_status:   'PENDING_PAYMENT',
    note:        purchasedItemIds.length > 0
      ? `Order created — ${purchasedItemIds.length} item${purchasedItemIds.length !== 1 ? 's' : ''} selected`
      : 'Order created by buyer',
    created_by: buyerId,
  })

  return NextResponse.json({ orderId: order.id }, { status: 201 })
}
