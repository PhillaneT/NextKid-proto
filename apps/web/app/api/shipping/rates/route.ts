import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import {
  userLocationToTCGAddress,
  dimensionsToTCGParcel,
  type ShippingQuote,
  type TCGRateOption,
  type TCGAddress,
  type TCGLockerAddress,
  type UserLocation,
} from '@nextkid/shared'

const RequestSchema = z.object({
  listingId: z.string().uuid(),
})

// Profile row subset fetched for shipping address construction
interface ProfileAddressRow {
  street_address: string | null
  suburb_name: string | null
  city_name: string | null
  province: string | null
  postal_code: string | null
  latitude: number | null
  longitude: number | null
}

// TCG /rates API response shape
interface TCGRatesResponse {
  data?: TCGRateOption[]
  // TCG may return rates at top level or nested under data
  [key: string]: unknown
}

function profileToTCGAddress(profile: ProfileAddressRow): TCGAddress {
  // RULE: userLocationToTCGAddress expects a UserLocation shape;
  // we only provide the fields it reads internally.
  const location = {
    streetAddress: profile.street_address ?? '',
    suburbName: profile.suburb_name ?? '',
    cityName: profile.city_name ?? '',
    provinceCode: profile.province ?? 'Gauteng', // Full province name (e.g. 'Gauteng')
    postalCode: profile.postal_code ?? '',
    latitude: profile.latitude ?? undefined,
    longitude: profile.longitude ?? undefined,
  } as unknown as UserLocation

  return userLocationToTCGAddress(location, 'residential')
}

async function fetchTCGRates(
  collectionAddress: TCGAddress | TCGLockerAddress,
  deliveryAddress: TCGAddress | TCGLockerAddress,
  parcels: ReturnType<typeof dimensionsToTCGParcel>[]
): Promise<TCGRateOption[]> {
  const today = new Date().toISOString()
  const sevenDaysOut = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  // RULE: TCG API key must never be exposed client-side — server-only route.
  // Timeout after 8s so the route never hangs and returns an empty body to the client.
  const res = await fetch(`${process.env.TCG_API_BASE_URL}/rates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.TCG_API_KEY}`,
    },
    body: JSON.stringify({
      collection_address: collectionAddress,
      delivery_address: deliveryAddress,
      parcels,
      collection_min_date: today,
      delivery_min_date: sevenDaysOut,
    }),
    signal: AbortSignal.timeout(8000),
  })

  if (!res.ok) {
    throw new Error(`TCG rates API returned ${res.status}`)
  }

  const json = (await res.json()) as TCGRatesResponse
  // TCG may return rates as top-level array or nested under 'data'
  if (Array.isArray(json)) return json as TCGRateOption[]
  if (Array.isArray(json.data)) return json.data
  return []
}

export async function POST(req: NextRequest) {
  try {
    return await handleRates(req)
  } catch (err) {
    // RULE: Never let an unhandled exception return an empty body — always return JSON.
    // This wraps unexpected failures (TCG API timeout, malformed data, etc.)
    console.error('Unhandled error in /api/shipping/rates:', err)
    return NextResponse.json({ error: 'shipping_unavailable' }, { status: 503 })
  }
}

async function handleRates(req: NextRequest) {
  // 1. Parse and validate body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', message: parsed.error.message }, { status: 400 })
  }
  const { listingId } = parsed.data

  // 2. Authenticate the buyer via the Supabase JWT in the Authorization header
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: userData, error: authError } = await anonClient.auth.getUser(token)
  if (authError || !userData.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const buyerId = userData.user.id

  const serverClient = createServerSupabaseClient()

  // 3. Fetch the listing
  const { data: listing, error: listingError } = await serverClient
    .from('listings')
    .select(
      'seller_id, price_cents, parcel_length_cm, parcel_width_cm, parcel_height_cm, parcel_weight_kg, shipping_methods, pudo_locker_id, pudo_locker_name, status'
    )
    .eq('id', listingId)
    .single()

  if (listingError || !listing) {
    return NextResponse.json({ error: 'listing_not_found' }, { status: 404 })
  }
  if (listing.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'listing_unavailable' }, { status: 400 })
  }
  if (listing.seller_id === buyerId) {
    return NextResponse.json({ error: 'cannot_buy_own_item' }, { status: 400 })
  }
  if (
    !listing.parcel_length_cm ||
    !listing.parcel_width_cm ||
    !listing.parcel_height_cm ||
    !listing.parcel_weight_kg
  ) {
    return NextResponse.json({ error: 'listing_unavailable', message: 'This listing is missing parcel dimensions.' }, { status: 400 })
  }

  const shippingMethods: string[] = listing.shipping_methods ?? []
  if (shippingMethods.length === 0) {
    return NextResponse.json({ error: 'no_shipping_methods' }, { status: 400 })
  }

  // 4. Fetch seller profile for collection address
  const { data: sellerProfile, error: sellerError } = await serverClient
    .from('profiles')
    .select('street_address, suburb_name, city_name, province, postal_code, latitude, longitude')
    .eq('id', listing.seller_id)
    .single()

  // If seller has no street address we can't get real quotes — skip to demo fallback.
  // RULE: before go-live, re-enable the hard check so listings without a seller
  // address can't be purchased (seller must add address before listing goes live).
  const sellerHasAddress = !sellerError && sellerProfile?.street_address

  // 5. Fetch buyer profile for delivery address + preferred locker
  const { data: buyerProfile, error: buyerError } = await serverClient
    .from('profiles')
    .select('street_address, suburb_name, city_name, province, postal_code, latitude, longitude, preferred_locker_id, preferred_locker_name')
    .eq('id', buyerId)
    .single()

  // If buyer has no street address they need to add one before buying.
  // Direct them to their profile rather than failing silently.
  const buyerHasAddress = !buyerError && buyerProfile?.street_address
  if (!buyerHasAddress) {
    return NextResponse.json(
      { error: 'no_delivery_address', message: 'Please add a delivery address to your profile before buying.' },
      { status: 400 }
    )
  }

  // 6. Build TCG request objects
  const parcel = dimensionsToTCGParcel(
    {
      lengthCm: listing.parcel_length_cm,
      widthCm: listing.parcel_width_cm,
      heightCm: listing.parcel_height_cm,
      weightKg: listing.parcel_weight_kg,
    },
    'Marketplace item'
  )
  const sellerTCGAddress = sellerProfile ? profileToTCGAddress(sellerProfile) : null
  const buyerTCGAddress = profileToTCGAddress(buyerProfile!)

  // 7. Fan out TCG rate calls — only if seller has an address; otherwise falls
  // through to demo quotes below.
  type RateCallResult = { method: 'D2D' | 'D2L' | 'L2D' | 'L2L'; rates: TCGRateOption[] }

  const calls: Promise<RateCallResult>[] = []
  const buyerLockerId = buyerProfile?.preferred_locker_id ?? null
  const buyerLockerName = buyerProfile?.preferred_locker_name ?? undefined

  if (sellerHasAddress && sellerTCGAddress && shippingMethods.includes('PICKUP')) {
    // D2D: seller's home address → buyer's home address
    calls.push(
      fetchTCGRates(sellerTCGAddress, buyerTCGAddress, [parcel]).then((rates) => ({
        method: 'D2D' as const,
        rates,
      }))
    )

    // D2L: seller's home address → buyer's preferred locker
    if (buyerLockerId) {
      const buyerLockerAddress: TCGLockerAddress = { terminal_id: buyerLockerId }
      calls.push(
        fetchTCGRates(sellerTCGAddress, buyerLockerAddress, [parcel]).then((rates) => ({
          method: 'D2L' as const,
          rates,
        }))
      )
    }
  }

  if (sellerHasAddress && shippingMethods.includes('PUDO_DROPOFF') && listing.pudo_locker_id) {
    // L2D: seller drops at locker → buyer's home address
    const sellerLockerAddress: TCGLockerAddress = { terminal_id: listing.pudo_locker_id }
    calls.push(
      fetchTCGRates(sellerLockerAddress, buyerTCGAddress, [parcel]).then((rates) => ({
        method: 'L2D' as const,
        rates,
      }))
    )

    // L2L: seller drops at their locker → buyer collects from their locker
    if (buyerLockerId) {
      const buyerLockerAddress: TCGLockerAddress = { terminal_id: buyerLockerId }
      calls.push(
        fetchTCGRates(sellerLockerAddress, buyerLockerAddress, [parcel]).then((rates) => ({
          method: 'L2L' as const,
          rates,
        }))
      )
    }
  }

  const results = await Promise.allSettled(calls)

  // 8. Map TCG rate options to ShippingQuote objects
  const quotes: ShippingQuote[] = []

  for (const result of results) {
    if (result.status === 'rejected') continue

    const { method, rates } = result.value
    for (const rate of rates) {
      quotes.push({
        quoteId: crypto.randomUUID(),
        method,
        serviceLevelCode: rate.service_level_code,
        serviceLevelName: rate.service_level,
        rate: rate.rate,
        rateExcludingVat: rate.rate_excluding_vat,
        vatAmount: rate.vat_amount,
        estimatedCollectionDate: new Date(rate.collection_date),
        estimatedDeliveryFrom: new Date(rate.delivery_date_from),
        estimatedDeliveryTo: new Date(rate.delivery_date_to),
        // For L2D / L2L: seller drops at their locker
        ...((method === 'L2D' || method === 'L2L') && listing.pudo_locker_id
          ? {
              collectionLockerCode: listing.pudo_locker_id,
              collectionLockerName: listing.pudo_locker_name ?? undefined,
            }
          : {}),
        // For D2L / L2L: buyer collects from their preferred locker
        ...((method === 'D2L' || method === 'L2L') && buyerLockerId
          ? {
              deliveryLockerCode: buyerLockerId,
              deliveryLockerName: buyerLockerName,
            }
          : {}),
        rawResponse: rate,
      })
    }
  }

  // 9. If TCG returned nothing, fall back to demo quotes so checkout is always demoable.
  // PROTOTYPE TRADE-OFF: remove demo fallback before go-live and surface the real error.
  if (quotes.length === 0) {
    const now = new Date()
    const d = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString()
    const demoQuotes: ShippingQuote[] = [
      {
        quoteId: crypto.randomUUID(),
        method: 'D2D',
        serviceLevelCode: 'ECO',
        serviceLevelName: 'Economy (3–5 days)',
        rate: 142.31,
        rateExcludingVat: 123.75,
        vatAmount: 18.56,
        estimatedCollectionDate: new Date(d(1)),
        estimatedDeliveryFrom:   new Date(d(3)),
        estimatedDeliveryTo:     new Date(d(5)),
      },
      {
        quoteId: crypto.randomUUID(),
        method: 'D2D',
        serviceLevelCode: 'OVN',
        serviceLevelName: 'Overnight',
        rate: 205.56,
        rateExcludingVat: 178.75,
        vatAmount: 26.81,
        estimatedCollectionDate: new Date(d(1)),
        estimatedDeliveryFrom:   new Date(d(2)),
        estimatedDeliveryTo:     new Date(d(2)),
      },
    ]
    return NextResponse.json({ quotes: demoQuotes, itemPriceCents: listing.price_cents, demo: true })
  }

  // Sort cheapest first
  quotes.sort((a, b) => a.rate - b.rate)

  return NextResponse.json({
    quotes,
    itemPriceCents: listing.price_cents,
  })
}
