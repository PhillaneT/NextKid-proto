import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// GET  /api/wishlist         — returns the current user's wishlisted listings
// POST /api/wishlist         — add { listingId } to wishlist

export async function GET() {
  const server = createServerSupabaseClient()
  const { data: { user } } = await server.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { data, error } = await server
    .from('wishlists')
    .select(`
      listing_id,
      price_at_save,
      created_at,
      listings (
        id, title, category, price_cents, images, size, status, seller_id
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

export async function POST(req: NextRequest) {
  const server = createServerSupabaseClient()
  const { data: { user } } = await server.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { listingId } = await req.json()
  if (!listingId) return NextResponse.json({ error: 'listingId required' }, { status: 400 })

  // Fetch current price to store for price-drop detection later
  const { data: listing } = await server
    .from('listings')
    .select('price_cents')
    .eq('id', listingId)
    .single()

  if (!listing) return NextResponse.json({ error: 'listing not found' }, { status: 404 })

  const { error } = await server.from('wishlists').upsert({
    user_id:       user.id,
    listing_id:    listingId,
    price_at_save: listing.price_cents,
  }, { onConflict: 'user_id,listing_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
