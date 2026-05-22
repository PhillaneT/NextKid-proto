import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// GET /api/checkout/school-match?listingId=xxx
//
// Checks whether the buyer and seller share a school.
// Returns matching schools — buyer selects one to get R20 school delivery.

export async function GET(req: NextRequest) {
  const listingId = req.nextUrl.searchParams.get('listingId')
  if (!listingId) return NextResponse.json({ match: false }, { status: 400 })

  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  if (!token) return NextResponse.json({ match: false }, { status: 401 })

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: userData } = await anonClient.auth.getUser(token)
  if (!userData.user) return NextResponse.json({ match: false }, { status: 401 })

  const server = createServerSupabaseClient()

  // Fetch listing's seller school
  const { data: listing } = await server
    .from('listings')
    .select('seller_id, seller_school_id, seller_school_name')
    .eq('id', listingId)
    .single()

  if (!listing?.seller_school_id) {
    return NextResponse.json({ match: false })
  }

  // Fetch buyer's schools (school_id = primary, school_ids = all linked schools)
  const { data: buyerProfile } = await server
    .from('profiles')
    .select('school_id, school_ids')
    .eq('id', userData.user.id)
    .single()

  if (!buyerProfile) return NextResponse.json({ match: false })

  // Collect all buyer school IDs (deduplicated)
  const buyerSchoolIds = Array.from(new Set([
    ...(buyerProfile.school_ids ?? []),
    ...(buyerProfile.school_id ? [buyerProfile.school_id] : []),
  ])).filter(Boolean)

  if (buyerSchoolIds.length === 0) return NextResponse.json({ match: false })

  // Find matching schools between buyer and seller
  const matchingIds = buyerSchoolIds.filter(id => id === listing.seller_school_id)

  if (matchingIds.length === 0) return NextResponse.json({ match: false })

  // Fetch full school details for matching schools (for the picker UI)
  const { data: matchingSchools } = await server
    .from('schools')
    .select('id, name, city_name, klerebank_status')
    .in('id', matchingIds)

  // Only offer school delivery if the school is an active Klerebank hub
  const activeSchools = (matchingSchools ?? []).filter(s => s.klerebank_status === 'active')

  if (activeSchools.length === 0) {
    // School matched but not a Klerebank hub yet — inform but don't block
    return NextResponse.json({
      match:         true,
      hubActive:     false,
      schools:       matchingSchools ?? [],
      schoolDeliveryFeeCents: 2000,
    })
  }

  return NextResponse.json({
    match:                  true,
    hubActive:              true,
    schools:                activeSchools,
    schoolDeliveryFeeCents: 2000,  // R20 — matches fee_config.school_delivery_fee
    nextkidSplitCents:      1000,  // R10 to NextKid
    klerebankSplitCents:    1000,  // R10 to school Klerebank
  })
}
