import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Statuses a buyer can cancel from (no money has moved yet)
const CANCELLABLE_STATUSES = ['PENDING_PAYMENT']

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const orderId = params.id

  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: userData, error: authError } = await anonClient.auth.getUser(token)
  if (authError || !userData.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = userData.user.id

  const server = createServerSupabaseClient()

  const { data: order, error: fetchErr } = await server
    .from('orders')
    .select('id, buyer_id, status')
    .eq('id', orderId)
    .single()

  if (fetchErr || !order) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (order.buyer_id !== userId) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    return NextResponse.json(
      { error: 'not_cancellable', message: 'Only unpaid orders can be cancelled.' },
      { status: 409 }
    )
  }

  const { error: updateErr } = await server
    .from('orders')
    .update({ status: 'CANCELLED' })
    .eq('id', orderId)

  if (updateErr) return NextResponse.json({ error: 'update_failed' }, { status: 500 })

  await server.from('order_events').insert({
    order_id:    orderId,
    from_status: order.status,
    to_status:   'CANCELLED',
    note:        'Cancelled by buyer',
    created_by:  userId,
  })

  return NextResponse.json({ ok: true })
}
