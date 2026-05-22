import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const TIERS = [
  { name: 'District', emoji: '🏫', min: 25, rateL1: 200, rateL2: 50 },
  { name: 'Campus',   emoji: '🌳', min: 10, rateL1: 200, rateL2: 50 },
  { name: 'Grove',    emoji: '🌿', min: 3,  rateL1: 200, rateL2: 50 },
  { name: 'Seedling', emoji: '🌱', min: 0,  rateL1: 200, rateL2: 50 },
]

export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const anonClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: userData } = await anonClient.auth.getUser(token)
  if (!userData.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const server = createServerSupabaseClient()

  // Verify school admin
  const { data: adminRow } = await server
    .from('school_admins')
    .select('school_id, schools(id, name, referral_code)')
    .eq('user_id', userData.user.id).eq('active', true).single()

  if (!adminRow) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const schoolId      = adminRow.school_id
  const school        = adminRow.schools as any
  const referralCode  = school?.referral_code ?? null
  const baseUrl       = process.env.NEXTAUTH_URL ?? 'http://localhost:5000'
  const referralLink  = referralCode ? `${baseUrl}/schools/apply?ref=${referralCode}` : null

  // Count active direct referrals (L1)
  const { count: directReferrals } = await server
    .from('schools')
    .select('id', { count: 'exact', head: true })
    .eq('referred_by_school_id', schoolId)
    .eq('klerebank_status', 'active')

  // Determine tier
  const tier = TIERS.find(t => (directReferrals ?? 0) >= t.min) ?? TIERS[TIERS.length - 1]

  // Referral earnings this month
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
  const { data: earnings } = await server
    .from('referral_earnings')
    .select('amount_cents, level, source_school_id, waybill_number, created_at')
    .eq('earning_school_id', schoolId)
    .order('created_at', { ascending: false })
    .limit(50)

  const totalEarningsCents     = (earnings ?? []).reduce((s, r) => s + r.amount_cents, 0)
  const thisMonthEarningsCents = (earnings ?? [])
    .filter(r => new Date(r.created_at) >= monthStart)
    .reduce((s, r) => s + r.amount_cents, 0)

  // List of referred schools
  const { data: referredSchools } = await server
    .from('schools')
    .select('id, name, klerebank_status, city_name')
    .eq('referred_by_school_id', schoolId)
    .order('approved_at', { ascending: false })

  // Next tier
  const currentIdx = TIERS.findIndex(t => t.name === tier.name)
  const nextTier   = currentIdx > 0 ? TIERS[currentIdx - 1] : null
  const toNextTier = nextTier ? Math.max(0, nextTier.min - (directReferrals ?? 0)) : 0

  return NextResponse.json({
    schoolId,
    schoolName:   school?.name,
    referralCode,
    referralLink,
    tier: {
      name:        tier.name,
      emoji:       tier.emoji,
      directCount: directReferrals ?? 0,
      nextTier:    nextTier?.name ?? null,
      toNextTier,
    },
    earnings: {
      totalCents:     totalEarningsCents,
      thisMonthCents: thisMonthEarningsCents,
      recentEvents:   (earnings ?? []).slice(0, 10).map(e => ({
        level:        e.level,
        amountCents:  e.amount_cents,
        waybill:      e.waybill_number,
        createdAt:    e.created_at,
      })),
    },
    referredSchools: (referredSchools ?? []).map(s => ({
      id:     s.id,
      name:   s.name,
      city:   s.city_name,
      status: s.klerebank_status,
    })),
  })
}
