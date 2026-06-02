import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { sendPriceDropNotifications } from '@/lib/notifications'

// POST /api/wishlist/price-drop
// Called server-side when a seller lowers a listing price.
// Sends push + email notifications to everyone who wishlisted the item.

export async function POST(req: NextRequest) {
  const server = createServerSupabaseClient()
  const { data: { user } } = await server.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { listingId, itemTitle, oldPriceCents, newPriceCents } = await req.json()
  if (!listingId || !oldPriceCents || !newPriceCents) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }

  // Verify the caller owns the listing
  const { data: listing } = await server
    .from('listings')
    .select('seller_id')
    .eq('id', listingId)
    .single()

  if (!listing || listing.seller_id !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    await sendPriceDropNotifications(listingId, itemTitle, oldPriceCents, newPriceCents)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PriceDrop] Error:', err)
    return NextResponse.json({ error: 'notification_failed' }, { status: 500 })
  }
}
