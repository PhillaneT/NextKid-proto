import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

async function resolveUser(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  if (!token) return null
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data } = await anon.auth.getUser(token)
  return data.user ?? null
}

export async function GET(req: NextRequest) {
  const user = await resolveUser(req)
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const server = createServerSupabaseClient()
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
  const user = await resolveUser(req)
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { listingId } = await req.json()
  if (!listingId) return NextResponse.json({ error: 'listingId required' }, { status: 400 })

  const server = createServerSupabaseClient()

  // Fetch listing + seller info
  const { data: listing } = await server
    .from('listings')
    .select('price_cents, title, seller_id')
    .eq('id', listingId)
    .single()

  if (!listing) return NextResponse.json({ error: 'listing not found' }, { status: 404 })

  // Save to wishlist
  const { error } = await server.from('wishlists').upsert({
    user_id:       user.id,
    listing_id:    listingId,
    price_at_save: listing.price_cents,
  }, { onConflict: 'user_id,listing_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify seller — fire-and-forget, don't block the response
  if (listing.seller_id && listing.seller_id !== user.id) {
    notifySeller(server, listing.seller_id, listing.title, listingId).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}

async function notifySeller(
  server: ReturnType<typeof createServerSupabaseClient>,
  sellerId: string,
  itemTitle: string,
  listingId: string,
) {
  // Save in-app notification
  try {
    await server.from('notifications').insert({
      user_id: sellerId,
      title:   '❤️ Someone saved your item',
      body:    `"${itemTitle}" was added to a wishlist. Consider lowering the price to make a sale!`,
      type:    'wishlist_save',
      data:    { listing_id: listingId },
      read:    false,
    })
  } catch { /* non-critical */ }

  // Push notification if seller has Expo token
  const { data: profile } = await server
    .from('profiles')
    .select('expo_push_token')
    .eq('id', sellerId)
    .single()

  const token = profile?.expo_push_token
  if (token?.startsWith('ExponentPushToken')) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        to:       token,
        title:    '❤️ Someone saved your item',
        body:     `"${itemTitle}" was added to a wishlist. Lower the price to make a sale!`,
        sound:    'default',
        priority: 'normal',
        data:     { listingId },
      }),
    }).catch(() => {})
  }
}
