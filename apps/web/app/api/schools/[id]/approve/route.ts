import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

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

  const { data: school } = await server.from('schools').select('contact_email, name').eq('id', schoolId).single()

  if (action === 'approve') {
    await server.from('schools').update({
      klerebank_status: 'active',
      approved_at:      now,
      approved_by:      userData.user.id,
    }).eq('id', schoolId)

    // Notify applicant
    console.log(`[Klerebank] APPROVED: ${school?.name} <${school?.contact_email}>`)
    console.log(`Message: "Welcome to the NextKid Klerebank network! Your drop-off point is now live."`)
  } else {
    await server.from('schools').update({
      klerebank_status: 'rejected',
      rejection_reason: reason ?? null,
    }).eq('id', schoolId)

    console.log(`[Klerebank] REJECTED: ${school?.name} <${school?.contact_email}> — ${reason}`)
  }

  return NextResponse.json({ success: true })
}
