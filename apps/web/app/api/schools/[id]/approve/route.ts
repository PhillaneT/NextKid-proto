import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const TIERS = [
  { name: 'District', min: 25 },
  { name: 'Campus',   min: 10 },
  { name: 'Grove',    min: 3  },
  { name: 'Seedling', min: 0  },
]

function tierForCount(n: number) {
  return TIERS.find(t => n >= t.min)?.name ?? 'Seedling'
}

async function notifyReferrer(
  server:       ReturnType<typeof createServerSupabaseClient>,
  referrerId:   string,
  newSchoolName: string,
) {
  // Count active direct referrals for the referrer (including the one just approved)
  const { count } = await server
    .from('schools')
    .select('id', { count: 'exact', head: true })
    .eq('referred_by_school_id', referrerId)
    .eq('klerebank_status', 'active')

  const activeCount = count ?? 0
  const prevCount   = activeCount - 1
  const oldTier     = tierForCount(prevCount)
  const newTier     = tierForCount(activeCount)
  const upgradedMsg = oldTier !== newTier ? ` You've reached ${newTier} tier!` : ''

  const pushMsg = `🎉 ${newSchoolName} just joined your network!${upgradedMsg} You now have ${activeCount} active school${activeCount !== 1 ? 's' : ''}.`

  // Push to all active admins of the referring school
  const { data: admins } = await server
    .from('school_admins')
    .select('profiles(id, expo_push_token)')
    .eq('school_id', referrerId)
    .eq('active', true)

  for (const row of admins ?? []) {
    const prof = row.profiles as unknown as { id: string; expo_push_token: string | null } | null
    if (!prof?.expo_push_token?.startsWith('ExponentPushToken')) continue
    await fetch('https://exp.host/--/api/v2/push/send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body:    JSON.stringify({ to: prof.expo_push_token, title: 'NextKid', body: pushMsg, sound: 'default' }),
    })
  }

  // Save in-app notification for each admin
  for (const row of admins ?? []) {
    const prof = row.profiles as unknown as { id: string; expo_push_token: string | null } | null
    if (!prof) continue
    await server.from('notifications').insert({
      user_id:  prof.id,
      order_id: null,
      type:     'referral_joined',
      message:  pushMsg,
      item_id:  null,
      read:     false,
      sent_at:  new Date().toISOString(),
    })
  }
}

const Schema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: schoolId } = await params
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const anonClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: userData } = await anonClient.auth.getUser(token)
  if (!userData.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const server = createServerSupabaseClient()
  const { data: prof } = await server.from('profiles').select('role').eq('id', userData.user.id).single()
  if (prof?.role !== 'super_admin' && prof?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid_body' }, { status: 400 }) }
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 })

  const { action, reason } = parsed.data
  const now = new Date().toISOString()

  const { data: school } = await server
    .from('schools')
    .select('contact_email, name, referred_by_school_id')
    .eq('id', schoolId).single()

  if (action === 'approve') {
    await server.from('schools').update({
      klerebank_status: 'active',
      approved_at:      now,
      approved_by:      userData.user.id,
    }).eq('id', schoolId)

    console.log(`[Klerebank] APPROVED: ${school?.name} <${school?.contact_email}>`)

    // Notify referring school (fire-and-forget)
    if (school?.referred_by_school_id) {
      notifyReferrer(server, school.referred_by_school_id, school.name ?? 'A school')
        .catch(err => console.error('[Referral] notify referrer error:', err))
    }
  } else {
    await server.from('schools').update({
      klerebank_status: 'rejected',
      rejection_reason: reason ?? null,
    }).eq('id', schoolId)

    console.log(`[Klerebank] REJECTED: ${school?.name} <${school?.contact_email}> — ${reason}`)
  }

  return NextResponse.json({ success: true })
}
