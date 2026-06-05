import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { generateWaybillNumber, generateQrToken, DROPOFF_TTL_HOURS } from '@/lib/qr'

// POST /api/orders/:id/simulate-payment
// DEV/TEST ONLY — simulates a successful Stitch payment without real money.
// Only works when NEXT_PUBLIC_APP_URL contains "localhost" or "ngrok".

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const isTestEnv = appUrl.includes('localhost') || appUrl.includes('ngrok') || appUrl.includes('ngrok-free')
  if (!isTestEnv) {
    return NextResponse.json({ error: 'not_available_in_production' }, { status: 403 })
  }

  const { id: orderId } = await params
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user } } = await anon.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const server = createServerSupabaseClient()

  const { data: order } = await server
    .from('orders')
    .select('id, status, buyer_id')
    .eq('id', orderId)
    .single()

  if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (order.buyer_id !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (order.status !== 'PENDING_PAYMENT') {
    return NextResponse.json({ error: 'already_paid', status: order.status }, { status: 409 })
  }

  const now           = new Date()
  const autoDropoffAt = new Date(now.getTime() + DROPOFF_TTL_HOURS * 60 * 60 * 1000)

  await server.from('orders').update({
    status:          'AWAITING_DROPOFF',
    payment_status:  'HELD',
    paid_at:         now.toISOString(),
    auto_dropoff_at: autoDropoffAt.toISOString(),
  }).eq('id', orderId)

  const waybillNumber = generateWaybillNumber()
  const dropoffQr     = generateQrToken('DROPOFF', orderId, waybillNumber, DROPOFF_TTL_HOURS)

  const { data: waybill } = await server
    .from('waybills')
    .insert({ waybill_number: waybillNumber, order_id: orderId })
    .select('id')
    .single()

  if (waybill) {
    await server.from('qr_tokens').insert({
      order_id:   orderId,
      waybill_id: waybill.id,
      token_type: 'DROPOFF',
      token_raw:  dropoffQr.token,
      token_hash: dropoffQr.hash,
      expires_at: dropoffQr.expiresAt.toISOString(),
    })
  }

  await server.from('order_events').insert([
    {
      order_id:    orderId,
      from_status: 'PENDING_PAYMENT',
      to_status:   'PAYMENT_HELD',
      note:        '🧪 Simulated payment (test mode)',
      created_by:  user.id,
    },
    {
      order_id:    orderId,
      from_status: 'PAYMENT_HELD',
      to_status:   'AWAITING_DROPOFF',
      note:        `Waybill ${waybillNumber} generated`,
      created_by:  user.id,
    },
  ])

  console.log(`[SimulatePayment] ✅ Order ${orderId.slice(0, 8)} → AWAITING_DROPOFF | ${waybillNumber}`)
  return NextResponse.json({ ok: true, waybillNumber })
}
