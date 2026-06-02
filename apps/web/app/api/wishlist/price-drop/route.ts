import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { sendPriceDropNotifications } from '@/lib/notifications'

async function resolveUser(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  if (!token) return null
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data } = await anon.auth.getUser(token)
  return data.user ?? null
}

export async function POST(req: NextRequest) {
  const user = await resolveUser(req)
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { listingId, itemTitle, oldPriceCents, newPriceCents } = await req.json()
  if (!listingId || !oldPriceCents || !newPriceCents) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }

  const server = createServerSupabaseClient()
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
