import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// RULE: 15-minute reservation holds listing_items during checkout.
// Only one active reservation per item at a time (enforced by DB unique index).
const RESERVATION_MINUTES = 15

const Schema = z.object({
  itemIds: z.array(z.string().uuid()).min(1),
})

function auth(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  if (!token) return null
  return token
}

// POST /api/reservations — reserve items for 15 min
export async function POST(req: NextRequest) {
  const token = auth(req)
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  const { itemIds } = parsed.data

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: userData, error: authErr } = await anonClient.auth.getUser(token)
  if (authErr || !userData.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = userData.user.id

  const server    = createServerSupabaseClient()
  const expiresAt = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000).toISOString()

  // Verify all items are still available (not reserved or sold)
  const { data: items, error: itemsErr } = await server
    .from('listing_items')
    .select('id, status')
    .in('id', itemIds)

  if (itemsErr || !items) return NextResponse.json({ error: 'items_not_found' }, { status: 404 })

  const unavailable = items.filter(i => i.status !== 'available')
  if (unavailable.length > 0) {
    return NextResponse.json({
      error:        'items_unavailable',
      unavailableIds: unavailable.map(i => i.id),
    }, { status: 409 })
  }

  // Mark items as reserved
  const { error: updateErr } = await server
    .from('listing_items')
    .update({ status: 'reserved' })
    .in('id', itemIds)

  if (updateErr) return NextResponse.json({ error: 'reserve_failed' }, { status: 500 })

  // Insert reservation records (for expiry tracking)
  await server.from('reservations').insert(
    itemIds.map(id => ({ listing_item_id: id, user_id: userId, expires_at: expiresAt }))
  )

  return NextResponse.json({ reserved: true, expires_at: expiresAt })
}

// DELETE /api/reservations — release reserved items back to available
export async function DELETE(req: NextRequest) {
  const token = auth(req)
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  const { itemIds } = parsed.data

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: userData, error: authErr } = await anonClient.auth.getUser(token)
  if (authErr || !userData.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = userData.user.id

  const server = createServerSupabaseClient()

  // Only release items reserved by this user
  await server.from('reservations').delete()
    .in('listing_item_id', itemIds)
    .eq('user_id', userId)

  await server.from('listing_items').update({ status: 'available' })
    .in('id', itemIds)
    .eq('status', 'reserved')

  return NextResponse.json({ released: true })
}
