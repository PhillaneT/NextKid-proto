import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// GET /api/klerebank/dashboard
//
// Returns waybill-only operational data for a verified Klerebank Admin.
// RULE: Zero PII returned — no buyer names, seller names, item details or prices.
// The admin sees only: waybill number, status, timing, and their own earnings.

export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: userData } = await anonClient.auth.getUser(token)
  if (!userData.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const server = createServerSupabaseClient()

  // Verify admin role (klerebank_admin OR super_admin)
  const { data: adminRow } = await server
    .from('school_admins')
    .select('school_id, role, schools(name, city_name)')
    .eq('user_id', userData.user.id)
    .eq('active', true)
    .single()

  if (!adminRow) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const isSuperAdmin = adminRow.role === 'super_admin'
  const schoolId     = adminRow.school_id
  const schoolName   = isSuperAdmin ? 'All Schools' : ((adminRow.schools as any)?.name ?? 'Your school')
  const cityName     = isSuperAdmin ? '' : ((adminRow.schools as any)?.city_name ?? '')

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  // Super admins see all listings; school admins see only their school's listings
  let listingIds: string[] = []
  if (isSuperAdmin) {
    const { data: allListings } = await server.from('listings').select('id')
    listingIds = (allListings ?? []).map(l => l.id)
  } else {
    const { data: schoolListings } = await server
      .from('listings')
      .select('id')
      .eq('seller_school_id', schoolId)
    listingIds = (schoolListings ?? []).map(l => l.id)
  }

  // RULE: join only to get waybill + timing — never select buyer_id, seller_id, listing details
  // Incoming: seller must bring item in (AWAITING_DROPOFF)
  const { data: incoming } = listingIds.length === 0 ? { data: [] } : await server
    .from('orders')
    .select(`
      id,
      status,
      auto_dropoff_at,
      created_at,
      waybills ( waybill_number )
    `)
    .eq('status', 'AWAITING_DROPOFF')
    .in('listing_id', listingIds)
    .order('auto_dropoff_at', { ascending: true })
    .limit(50)

  // At hub: waiting for buyer to collect (ITEM_AT_HUB)
  const { data: atHub } = listingIds.length === 0 ? { data: [] } : await server
    .from('orders')
    .select(`
      id,
      status,
      dropped_off_at,
      waybills ( waybill_number )
    `)
    .eq('status', 'ITEM_AT_HUB')
    .in('listing_id', listingIds)
    .order('dropped_off_at', { ascending: false })
    .limit(50)

  // Completed today
  const { count: completedToday } = listingIds.length === 0 ? { count: 0 } : await server
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'COMPLETED')
    .gte('collected_at', todayStart.toISOString())
    .in('listing_id', listingIds)

  // School's earnings this month — uses school_ledger_summary (grand total: direct + referral).
  // Falls back to summing school_ledger directly if migration 023 hasn't run yet.
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

  let earningsThisMonth    = 0
  let collectionsThisMonth = 0

  if (isSuperAdmin) {
    // Super admin sees totals across all schools
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
    const { data: ledger } = await server
      .from('school_ledger')
      .select('amount_cents, event_type')
      .gte('created_at', monthStart.toISOString())
    earningsThisMonth    = (ledger ?? []).reduce((s, r) => s + r.amount_cents, 0)
    collectionsThisMonth = (ledger ?? []).filter(r => r.event_type === 'collection').length
  } else {
    const { data: summary } = await server
      .from('school_ledger_summary')
      .select('grand_total_cents, direct_earnings_cents')
      .eq('school_id', schoolId)
      .eq('month', currentMonth)
      .maybeSingle()

    earningsThisMonth = summary?.grand_total_cents ?? 0

    if (!summary) {
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
      const { data: ledger } = await server
        .from('school_ledger')
        .select('amount_cents, event_type')
        .eq('school_id', schoolId)
        .gte('created_at', monthStart.toISOString())
      earningsThisMonth    = (ledger ?? []).reduce((s, r) => s + r.amount_cents, 0)
      collectionsThisMonth = (ledger ?? []).filter(r => r.event_type === 'collection').length
    }
  }

  // Format — only waybill-safe fields
  const formatIncoming = (rows: typeof incoming) => (rows ?? []).map(o => ({
    orderId:       o.id,
    waybillNumber: (o.waybills as any)?.waybill_number ?? '—',
    status:        o.status,
    dueBy:         o.auto_dropoff_at,
    receivedAt:    o.created_at,
  }))

  const formatAtHub = (rows: typeof atHub) => (rows ?? []).map(o => ({
    orderId:       o.id,
    waybillNumber: (o.waybills as any)?.waybill_number ?? '—',
    status:        o.status,
    droppedOffAt:  o.dropped_off_at,
  }))

  return NextResponse.json({
    schoolName,
    cityName,
    incoming:            formatIncoming(incoming),
    atHub:               formatAtHub(atHub),
    completedToday:      completedToday ?? 0,
    earningsThisMonth,
    collectionsThisMonth,
  })
}
