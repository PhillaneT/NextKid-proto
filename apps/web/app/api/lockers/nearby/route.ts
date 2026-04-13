import { NextRequest, NextResponse } from 'next/server'
import { SEED_LOCKERS } from '../seed'

// RULE: TCG API key must never be exposed client-side — server-only route.
// Geocoding uses Nominatim (OpenStreetMap) — free, no key required.

interface NominatimResult {
  lat: string
  lon: string
}

interface LockerRaw {
  id: string
  name: string
  address: string
  lat: number
  lng: number
}

interface LockerOption extends LockerRaw {
  distanceKm: number
}

const DEFAULT_CENTER = { lat: -26.2041, lng: 28.0473 } // Johannesburg CBD

// Haversine distance between two lat/lng points in km
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// In-process locker cache — 1-hour TTL
let cachedLockers: LockerRaw[] | null = null
let cacheExpiresAt = 0

async function getAllLockers(): Promise<LockerRaw[]> {
  const now = Date.now()
  if (cachedLockers && now < cacheExpiresAt) return cachedLockers

  try {
    const res = await fetch(`${process.env.TCG_API_BASE_URL}/lockers-data`, {
      headers: { Authorization: `Bearer ${process.env.TCG_API_KEY}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`TCG lockers-data ${res.status}`)

    const raw = (await res.json()) as Array<{
      code: string
      name: string
      address: string
      latitude: string
      longitude: string
    }>

    cachedLockers = (Array.isArray(raw) ? raw : [])
      .map(l => ({
        id: l.code,
        name: l.name,
        address: l.address ?? '',
        lat: parseFloat(l.latitude ?? '0'),
        lng: parseFloat(l.longitude ?? '0'),
      }))
      .filter(l => l.lat !== 0 && l.lng !== 0)

    cacheExpiresAt = now + 60 * 60 * 1000
    return cachedLockers
  } catch {
    // PROTOTYPE FALLBACK: TCG API not yet activated for this account.
    // Return the Gauteng seed list so the map works during development.
    // RULE: Remove this fallback once TCG activates the API key.
    console.warn('TCG lockers-data unavailable — using prototype seed list')
    return SEED_LOCKERS
  }
}

// GET /api/lockers/nearby?suburb=Fourways&city=Johannesburg&radius=25
// Returns: { lockers: LockerOption[], center: { lat, lng } }
export async function GET(req: NextRequest) {
  const suburb = req.nextUrl.searchParams.get('suburb') ?? ''
  const city   = req.nextUrl.searchParams.get('city') ?? ''
  const radius = Math.min(parseFloat(req.nextUrl.searchParams.get('radius') ?? '25'), 100)

  let center = DEFAULT_CENTER

  // Geocode suburb + city using Nominatim to get a map center point.
  // Nominatim is free (no key) but rate-limited to 1 req/s — acceptable for this use case.
  if (suburb || city) {
    try {
      const q = [suburb, city, 'South Africa'].filter(Boolean).join(', ')
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=za`,
        {
          headers: { 'User-Agent': 'NextKid/1.0 (prototype; contact phillane.troskie@gmail.com)' },
          signal: AbortSignal.timeout(5000),
        }
      )
      if (geoRes.ok) {
        const geo = (await geoRes.json()) as NominatimResult[]
        if (geo.length > 0) {
          center = { lat: parseFloat(geo[0].lat), lng: parseFloat(geo[0].lon) }
        }
      }
    } catch {
      // Geocoding failed — fall back to Johannesburg centre
    }
  }

  try {
    const all = await getAllLockers()
    const nearby: LockerOption[] = all
      .map(l => ({ ...l, distanceKm: haversineKm(center.lat, center.lng, l.lat, l.lng) }))
      .filter(l => l.distanceKm <= radius)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 50) // cap for map performance

    return NextResponse.json({ lockers: nearby, center })
  } catch (err) {
    console.error('Lockers nearby error:', err)
    return NextResponse.json({ lockers: [], center })
  }
}
