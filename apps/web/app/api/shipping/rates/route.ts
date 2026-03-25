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
  deliveryAddress: TCGAddress,
  parcels: ReturnType<typeof dimensionsToTCGParcel>[]
): Promise<TCGRateOption[]> {
  const today = new Date().toISOString()
  const sevenDaysOut = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const res = await fetch(`${process.env.TCG_API_BASE_URL}/rates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // RULE: TCG API key must never be exposed client-side — server-only route
      Authorization: `Bearer ${process.env.TCG_API_KEY}`,
    },
    body: JSON.stringify({
      collection_address: collectionAddress,
      delivery_address: deliveryAddress,
      parcels,
      collection_min_date: today,
      delivery_min_date: sevenDaysOut,
    }),
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

  if (sellerError || !sellerProfile || !sellerProfile.street_address) {
    return NextResponse.json(
      { error: 'shipping_unavailable', message: 'Seller shipping address is unavailable.' },
      { status: 503 }
    )
  }

  // 5. Fetch buyer profile for delivery address
  const { data: buyerProfile, error: buyerError } = await serverClient
    .from('profiles')
    .select('street_address, suburb_name, city_name, province, postal_code, latitude, longitude')
    .eq('id', buyerId)
    .single()

  if (buyerError || !buyerProfile || !buyerProfile.street_address) {
    return NextResponse.json(
      { error: 'profile_incomplete', message: 'Please complete your delivery address in your profile.' },
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
  const sellerTCGAddress = profileToTCGAddress(sellerProfile)
  const buyerTCGAddress = profileToTCGAddress(buyerProfile)

  // 7. Fan out TCG rate calls — one per seller shipping method
  type RateCallResult = { method: 'D2D' | 'L2D'; rates: TCGRateOption[] }

  const calls: Promise<RateCallResult>[] = []

  if (shippingMethods.includes('PICKUP')) {
    // D2D: seller's home address → buyer's home address
    calls.push(
      fetchTCGRates(sellerTCGAddress, buyerTCGAddress, [parcel]).then((rates) => ({
        method: 'D2D' as const,
        rates,
      }))
    )
  }

  if (shippingMethods.includes('PUDO_DROPOFF') && listing.pudo_locker_id) {
    // L2D: seller drops at locker → buyer's home address
    const lockerAddress: TCGLockerAddress = { terminal_id: listing.pudo_locker_id }
    calls.push(
      fetchTCGRates(lockerAddress, buyerTCGAddress, [parcel]).then((rates) => ({
        method: 'L2D' as const,
        rates,
      }))
    )
  }

  if (calls.length === 0) {
    return NextResponse.json({ error: 'no_shipping_methods' }, { status: 400 })
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
        // For L2D, populate collection locker details
        ...(method === 'L2D' && listing.pudo_locker_id
          ? {
              collectionLockerCode: listing.pudo_locker_id,
              collectionLockerName: listing.pudo_locker_name ?? undefined,
            }
          : {}),
        rawResponse: rate,
      })
    }
  }

  // 9. If no quotes at all, all calls failed
  if (quotes.length === 0) {
    return NextResponse.json({ error: 'shipping_unavailable' }, { status: 503 })
  }

  // Sort cheapest first
  quotes.sort((a, b) => a.rate - b.rate)

  return NextResponse.json({
    quotes,
    itemPriceCents: listing.price_cents,
  })
}
