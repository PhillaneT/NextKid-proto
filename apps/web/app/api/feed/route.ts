import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// GET /api/feed
//
// Returns a personalised feed assembled per child profile:
//   - "Fits Now"    — listings matching child's current sizes (school-first)
//   - "Plan Ahead"  — listings matching predicted next-year sizes
//   - "Sports"      — listings matching child's sports & interests
//
// Cache: stored in user_feed_cache for 1 hour. Stale cache is returned while
// a fresh computation runs (fire-and-forget) to keep latency low.
// Falls back gracefully if no children: returns generic recent items.

const SECTION_LIMIT = 12
const OVER_FETCH    = 30   // fetch more, sort school-first, slice to SECTION_LIMIT
const CACHE_TTL_MS  = 60 * 60 * 1000  // 1 hour

const LISTING_FIELDS = 'id, title, category, price_cents, images, size, seller_id, seller_school_id, created_at'

type FeedItem = {
  id: string; title: string; category: string; price_cents: number
  images: string[]; size: string | null; seller_id: string; seller_school_id: string | null
}

type FeedSection = {
  type: 'fits_now' | 'plan_ahead' | 'sports' | 'recent'
  title: string
  items: FeedItem[]
}

type ChildFeed = {
  childId: string; nickname: string; gender: string
  sections: FeedSection[]
}

type FeedResponse = {
  children: ChildFeed[]
  generic: FeedSection[]
  generatedAt: string
  fromCache: boolean
}

function schoolFirst(items: FeedItem[], schoolId: string | null): FeedItem[] {
  if (!schoolId) return items.slice(0, SECTION_LIMIT)
  return [
    ...items.filter(i => i.seller_school_id === schoolId),
    ...items.filter(i => i.seller_school_id !== schoolId),
  ].slice(0, SECTION_LIMIT)
}

async function computeFeed(
  server: ReturnType<typeof createServerSupabaseClient>,
  userId: string,
): Promise<Omit<FeedResponse, 'fromCache'>> {
  // Load children with latest sizes + predictions in parallel with generic items
  const [childrenRes, genericRes] = await Promise.all([
    server
      .from('child_profiles')
      .select(`
        id, nickname, gender, school_id,
        child_sizes ( top_size, bottom_size, shoe_size, recorded_date ),
        size_predictions ( predicted_top, predicted_bottom, predicted_shoe, confidence_score )
      `)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('recorded_date', { ascending: false, referencedTable: 'child_sizes' })
      .order('created_at', { ascending: false, referencedTable: 'size_predictions' })
      .limit(1, { referencedTable: 'child_sizes' })
      .limit(1, { referencedTable: 'size_predictions' }),

    server
      .from('listings')
      .select(LISTING_FIELDS)
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: false })
      .limit(SECTION_LIMIT),
  ])

  const children = childrenRes.data ?? []
  const genericItems = (genericRes.data ?? []) as FeedItem[]

  const childFeeds: ChildFeed[] = []

  for (const child of children) {
    const latestSize  = (child.child_sizes as any[])?.[0]
    const prediction  = (child.size_predictions as any[])?.[0]
    const schoolId    = child.school_id as string | null
    const sections: FeedSection[] = []

    // ── Section 1: Fits Now ───────────────────────────────────────────────
    if (latestSize) {
      const currentSizes = [latestSize.top_size, latestSize.bottom_size, latestSize.shoe_size]
        .filter(Boolean)

      const { data: fitsNowRaw } = await server
        .from('listings')
        .select(LISTING_FIELDS)
        .eq('status', 'ACTIVE')
        .in('size', currentSizes)
        .order('created_at', { ascending: false })
        .limit(OVER_FETCH)

      const fitsNow = schoolFirst((fitsNowRaw ?? []) as FeedItem[], schoolId)
      if (fitsNow.length > 0) {
        sections.push({
          type:  'fits_now',
          title: `Fits ${child.nickname} Right Now`,
          items: fitsNow,
        })
      }
    }

    // ── Section 2: Plan Ahead ─────────────────────────────────────────────
    if (prediction) {
      const predictedSizes = [prediction.predicted_top, prediction.predicted_bottom, prediction.predicted_shoe]
        .filter(Boolean)

      // Exclude sizes already in Fits Now to keep sections distinct
      const latestSizeSet = new Set([
        latestSize?.top_size, latestSize?.bottom_size, latestSize?.shoe_size,
      ].filter(Boolean))
      const aheadSizes = predictedSizes.filter(s => !latestSizeSet.has(s))

      if (aheadSizes.length > 0) {
        const { data: aheadRaw } = await server
          .from('listings')
          .select(LISTING_FIELDS)
          .eq('status', 'ACTIVE')
          .in('size', aheadSizes)
          .order('created_at', { ascending: false })
          .limit(OVER_FETCH)

        const ahead = schoolFirst((aheadRaw ?? []) as FeedItem[], schoolId)
        if (ahead.length > 0) {
          sections.push({
            type:  'plan_ahead',
            title: `Plan Ahead for ${child.nickname} — Next Year's Sizes`,
            items: ahead,
          })
        }
      }
    }

    // ── Section 3: Sports & Interests ─────────────────────────────────────
    const sports    = (child as any).sports    as string[] | undefined ?? []
    const interests = (child as any).interests as string[] | undefined ?? []
    const sportTerms = [...sports, ...interests].filter(Boolean)

    let sportsQuery = server
      .from('listings')
      .select(LISTING_FIELDS)
      .eq('status', 'ACTIVE')
      .limit(OVER_FETCH)

    if (sportTerms.length > 0) {
      const sportFilter = sportTerms.map(s => `sport_tag.eq.${s}`).join(',')
      sportsQuery = sportsQuery.or(
        `category.eq.School Sports Kit,category.eq.Sports Equipment,${sportFilter}`
      )
    } else {
      sportsQuery = sportsQuery.in('category', ['School Sports Kit', 'Sports Equipment'])
    }

    const { data: sportsRaw } = await sportsQuery.order('created_at', { ascending: false })
    const sportsItems = schoolFirst((sportsRaw ?? []) as FeedItem[], schoolId)

    if (sportsItems.length > 0) {
      sections.push({
        type:  'sports',
        title: sportTerms.length > 0
          ? `${child.nickname}'s Sports & Interests`
          : 'Sports & Kit',
        items: sportsItems,
      })
    }

    if (sections.length > 0) {
      childFeeds.push({ childId: child.id, nickname: child.nickname, gender: child.gender, sections })
    }
  }

  return {
    children:    childFeeds,
    generic:     [{ type: 'recent', title: 'Recently Listed', items: genericItems }],
    generatedAt: new Date().toISOString(),
  }
}

async function resolveUser(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  if (!token) return null
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data } = await anon.auth.getUser(token)
  return data.user ?? null
}

export async function GET(req: NextRequest) {
  const user = await resolveUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const server = createServerSupabaseClient()
  const now    = new Date()

  // Check cache
  const { data: cached } = await server
    .from('user_feed_cache')
    .select('feed_json, expires_at, generated_at')
    .eq('user_id', user.id)
    .maybeSingle()

  const cacheValid = cached && new Date(cached.expires_at) > now

  if (cacheValid) {
    return NextResponse.json({ ...cached.feed_json, fromCache: true })
  }

  // Compute fresh feed
  const feed = await computeFeed(server, user.id)

  // Persist to cache (upsert — fire and forget on error)
  const expiresAt = new Date(now.getTime() + CACHE_TTL_MS).toISOString()
  void Promise.resolve(server.from('user_feed_cache').upsert({
    user_id:      user.id,
    feed_json:    feed,
    generated_at: now.toISOString(),
    expires_at:   expiresAt,
  }, { onConflict: 'user_id' })).catch(() => {})

  return NextResponse.json({ ...feed, fromCache: false })
}

// DELETE /api/feed — force invalidate cache (e.g. after adding a child)
export async function DELETE(req: NextRequest) {
  const user = await resolveUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const server = createServerSupabaseClient()
  await server.from('user_feed_cache').delete().eq('user_id', user.id)

  return NextResponse.json({ success: true })
}
