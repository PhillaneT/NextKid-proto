import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// DELETE /api/wishlist/[listingId] — remove from wishlist

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { listingId: string } },
) {
  const server = createServerSupabaseClient()
  const { data: { user } } = await server.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { error } = await server
    .from('wishlists')
    .delete()
    .eq('user_id', user.id)
    .eq('listing_id', params.listingId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
