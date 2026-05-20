import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { randomBytes } from 'crypto'

const Schema = z.object({ email: z.string().email() })

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

  const { email } = parsed.data

  // Check if user exists in auth
  const { data: existingProfile } = await server
    .from('profiles').select('id').eq('email', email).single()

  const inviteToken = randomBytes(24).toString('hex')

  if (existingProfile) {
    // User already exists — create school_admin row (inactive until accepted)
    await server.from('school_admins').upsert({
      user_id:      existingProfile.id,
      school_id:    schoolId,
      role:         'klerebank_admin',
      active:       false,
      invited_by:   userData.user.id,
      invite_token: inviteToken,
    }, { onConflict: 'user_id,school_id' })
  }

  // Generate accept link and log it (in production, send via Resend/email)
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const acceptLink = `${baseUrl}/klerebank/accept-invite?token=${inviteToken}`

  console.log(`
[Klerebank Admin Invite]
To: ${email}
Subject: You have been nominated as a Klerebank Admin
Message: "You have been nominated as a Klerebank Admin for your school on NextKid.
Tap the link below to set up your account and access the waybill scanner."
Link: ${acceptLink}
  `)

  return NextResponse.json({ success: true, inviteToken })
}
