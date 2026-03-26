import { NextRequest, NextResponse } from 'next/server'

// RULE: TCG API key must never be exposed client-side — server-only route.
// This route proxies locker search so the key stays server-side.

interface TCGLockerRaw {
  code: string
  name: string
  address: string
  latitude: string
  longitude: string
}

interface LockerResult {
  id: string       // TCG terminal_id / code (e.g. "CG54")
  name: string     // Human name (e.g. "Sasol Rivonia Uplifted")
  address: string
  latitude: number
  longitude: number
}

// In-process cache: lockers list is large (~300 entries) and changes rarely.
// We cache for 1 hour to avoid hammering the TCG endpoint.
let cachedLockers: LockerResult[] | null = null
let cacheExpiresAt = 0

async function getLockers(): Promise<LockerResult[]> {
  const now = Date.now()
  if (cachedLockers && now < cacheExpiresAt) return cachedLockers

  const res = await fetch(`${process.env.TCG_API_BASE_URL}/lockers-data`, {
    headers: { Authorization: `Bearer ${process.env.TCG_API_KEY}` },
    signal: AbortSignal.timeout(8000),
  })

  if (!res.ok) throw new Error(`TCG lockers-data returned ${res.status}`)

  const raw = (await res.json()) as TCGLockerRaw[]
  const lockers: LockerResult[] = (Array.isArray(raw) ? raw : []).map(l => ({
    id: l.code,
    name: l.name,
    address: l.address ?? '',
    latitude: parseFloat(l.latitude ?? '0'),
    longitude: parseFloat(l.longitude ?? '0'),
  }))

  cachedLockers = lockers
  cacheExpiresAt = now + 60 * 60 * 1000 // 1 hour
  return lockers
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? ''
  if (q.length < 2) {
    return NextResponse.json([])
  }

  try {
    const all = await getLockers()
    const lower = q.toLowerCase()
    const matches = all
      .filter(l => l.name.toLowerCase().includes(lower) || l.address.toLowerCase().includes(lower))
      .slice(0, 12)
    return NextResponse.json(matches)
  } catch (err) {
    console.error('Locker search error:', err)
    // Return empty rather than erroring — locker selection is optional
    return NextResponse.json([])
  }
}
