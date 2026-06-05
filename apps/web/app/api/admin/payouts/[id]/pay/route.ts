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

// POST /api/admin/payouts/:id/pay
// Marks a payout as paid and notifies the seller
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id } = await params
  const { reference } = await req.json().catch(() => ({ reference: '' }))

  const server = createServerSupabaseClient()

  const { data: payout } = await server
    .from('seller_payouts')
    .select('id, seller_id, amount_cents, status, bank_snapshot')
    .eq('id', id)
    .single()

  if (!payout) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (payout.status === 'paid') return NextResponse.json({ error: 'already_paid' }, { status: 409 })

  // Mark as paid
  await server.from('seller_payouts').update({
    status:    'paid',
    paid_at:   new Date().toISOString(),
    paid_by:   admin.id,
    reference: reference ?? null,
  }).eq('id', id)

  // Notify seller
  const bank = payout.bank_snapshot as { bank_name?: string; account_number?: string } | null
  const bankLabel = bank?.bank_name
    ? `${bank.bank_name} ****${(bank.account_number ?? '').slice(-4)}`
    : 'your bank account'

  const message = `R ${(payout.amount_cents / 100).toFixed(2)} has been paid to ${bankLabel}.${reference ? ` Ref: ${reference}` : ''}`

  // In-app notification
  await server.from('notifications').insert({
    user_id: payout.seller_id,
    title:   '💸 Payment sent!',
    body:    message,
    type:    'seller_payout',
    read:    false,
  }).catch(() => {})

  // Push notification
  const { data: profile } = await server
    .from('profiles')
    .select('expo_push_token')
    .eq('id', payout.seller_id)
    .single()

  if (profile?.expo_push_token?.startsWith('ExponentPushToken')) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        to:       profile.expo_push_token,
        title:    '💸 Payment sent!',
        body:     message,
        sound:    'default',
        priority: 'high',
      }),
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, message })
}
