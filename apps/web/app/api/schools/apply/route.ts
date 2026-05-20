import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const Schema = z.object({
  schoolId:      z.string(),
  contactName:   z.string().min(2),
  contactEmail:  z.string().email(),
  contactPhone:  z.string().optional(),
  referralCode:  z.string().nullable().optional(),
  bankName:      z.string().min(2),
  accountHolder: z.string().min(2),
  accountNumber: z.string().min(5),
  branchCode:    z.string().min(4),
})

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 })

  const { schoolId, contactName, contactEmail, contactPhone, referralCode,
          bankName, accountHolder, accountNumber, branchCode } = parsed.data

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: userData, error: authErr } = await anonClient.auth.getUser(token)
  if (authErr || !userData.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const server = createServerSupabaseClient()

  // Check school exists and isn't already applied
  const { data: school } = await server
    .from('schools').select('id, name, klerebank_status').eq('id', schoolId).single()

  if (!school) return NextResponse.json({ error: 'school_not_found' }, { status: 404 })
  if (school.klerebank_status) return NextResponse.json({ error: 'already_applied' }, { status: 409 })

  // Resolve referral code to school ID
  let referredBySchoolId: string | null = null
  if (referralCode) {
    const { data: referrer } = await server
      .from('schools').select('id').eq('referral_code', referralCode).single()
    referredBySchoolId = referrer?.id ?? null
  }

  // Generate a unique referral code for this school
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const code = school.name.slice(0, 4).toUpperCase().replace(/[^A-Z]/g, 'X').padEnd(4, 'X')
    + '-' + Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')

  // Update school with application details
  await server.from('schools').update({
    klerebank_status:    'pending',
    contact_name:        contactName,
    contact_email:       contactEmail,
    contact_phone:       contactPhone ?? null,
    referral_code:       code,
    referred_by_school_id: referredBySchoolId,
    applied_at:          new Date().toISOString(),
  }).eq('id', schoolId)

  // Save bank details
  await server.from('school_bank_details').insert({
    school_id:           schoolId,
    bank_name:           bankName,
    account_holder_name: accountHolder,
    account_number:      accountNumber,
    branch_code:         branchCode,
  })

  // Notify Praesignis (console log for demo — replace with real email)
  console.log(`[Klerebank Application] ${school.name} applied. Contact: ${contactEmail}`)

  return NextResponse.json({ success: true, referralCode: code }, { status: 201 })
}
