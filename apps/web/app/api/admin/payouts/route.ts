import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

async function requireAdmin(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  if (!token) return null
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data } = await anon.auth.getUser(token)
  if (!data.user) return null
  const server = createServerSupabaseClient()
  const { data: profile } = await server.from('profiles').select('role').eq('id', data.user.id).single()
  if (profile?.role !== 'admin') return null
  return data.user
}

// GET /api/admin/payouts — list all pending seller payouts
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const server = createServerSupabaseClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'pending'

  const { data, error } = await server
    .from('seller_payouts')
    .select(`
      id, order_id, seller_id, amount_cents, status,
      held_reason, paid_at, reference, bank_snapshot, created_at,
      orders ( listing_id, listings ( title ) ),
      profiles!seller_id ( full_name, email )
    `)
    .eq('status', status)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ payouts: data ?? [] })
}
