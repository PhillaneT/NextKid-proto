import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const DELETION_REASONS = [
  'No longer need the app',
  'Found what I was looking for',
  'Privacy concerns',
  'Too many emails / notifications',
  'App not working properly',
  'Other',
] as const

export async function POST(req: NextRequest) {
  // 1. Auth
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user }, error: authErr } = await anon.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { reason } = await req.json().catch(() => ({ reason: 'Not provided' }))

  const server = createServerSupabaseClient()

  // 2. Log reason before wiping (anonymised — no PII, just the reason text + timestamp)
  await server.from('account_deletions').insert({
    reason:     reason ?? 'Not provided',
    deleted_at: new Date().toISOString(),
  }).catch(() => {}) // non-blocking — table may not exist yet

  // 3. Cancel any active orders (buyer side — refund protection)
  await server
    .from('orders')
    .update({ status: 'CANCELLED' })
    .eq('buyer_id', user.id)
    .in('status', ['PENDING_PAYMENT'])
    .catch(() => {})

  // 4. Delete user's listings
  await server.from('listings').delete().eq('seller_id', user.id).catch(() => {})

  // 5. Delete child profiles
  await server.from('child_profiles').delete().eq('parent_id', user.id).catch(() => {})

  // 6. Delete school_admins entries
  await server.from('school_admins').delete().eq('user_id', user.id).catch(() => {})

  // 7. Delete profile (ON DELETE CASCADE handles notifications, wishlists, push_tokens)
  await server.from('profiles').delete().eq('id', user.id).catch(() => {})

  // 8. Delete the auth user — must use service role admin client
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { error: deleteErr } = await admin.auth.admin.deleteUser(user.id)
  if (deleteErr) {
    console.error('[DeleteAccount] Failed to delete auth user:', deleteErr.message)
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export { DELETION_REASONS }
