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
