'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Package, Truck, MapPin, Loader2, Home, School, CheckCircle2 } from 'lucide-react'
import type { ShippingQuote } from '@nextkid/shared'
import LockerMapPicker from '../../components/LockerMapPicker'
import type { SelectedLocker } from '../../components/LockerMapPicker'

type CheckoutListing = {
  id: string
  title: string
  images: string[]
  price_cents: number
  condition: string | null
  seller_id: string
  status: string
}

type Step = 'loading' | 'error' | 'selecting' | 'placing'

function formatRands(cents: number) {
  return `R ${(cents / 100).toFixed(2)}`
}

function formatRandFloat(amount: number) {
  return `R ${amount.toFixed(2)}`
}

function formatDateRange(from: Date, to: Date) {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const f = new Date(from).toLocaleDateString('en-ZA', opts)
  const t = new Date(to).toLocaleDateString('en-ZA', opts)
  return f === t ? f : `${f} – ${t}`
}

export default function CheckoutPage() {
  const { listingId } = useParams<{ listingId: string }>()
  const router = useRouter()

  const [step, setStep] = useState<Step>('loading')
  const [listing, setListing] = useState<CheckoutListing | null>(null)
  const [quotes, setQuotes] = useState<ShippingQuote[]>([])
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null)
  const [itemPriceCents, setItemPriceCents] = useState(0)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Buyer locker — pre-populated from profile, changeable inline at checkout
  const [buyerLockerId, setBuyerLockerId]       = useState('')
  const [buyerLockerName, setBuyerLockerName]   = useState('')
  const [buyerLockerAddress, setBuyerLockerAddress] = useState('')
  const [buyerSuburb, setBuyerSuburb] = useState('')
  const [buyerCity, setBuyerCity]     = useState('')

  // School delivery state
  type SchoolOption = { id: string; name: string; city_name: string }
  const [schoolMatch,        setSchoolMatch]        = useState(false)
  const [schoolHubActive,    setSchoolHubActive]    = useState(false)
  const [matchingSchools,    setMatchingSchools]     = useState<SchoolOption[]>([])
  const [deliveryType,       setDeliveryType]        = useState<'school' | 'courier'>('courier')
  const [deliverySchoolId,   setDeliverySchoolId]    = useState<string | null>(null)
  const [deliverySchoolName, setDeliverySchoolName]  = useState<string | null>(null)
  const SCHOOL_FEE_CENTS = 2000  // R20 — matches fee_config

  // Set if courier/PUDO quotes couldn't be loaded — non-fatal when school pick-up
  // is available, since the buyer still has an immediate delivery option.
  const [courierError, setCourierError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      // 1. Get session
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        router.push('/')
        return
      }
      const session = sessionData.session

      // 2. Fetch listing
      const { data: listingData, error: listingError } = await supabase
        .from('listings')
        .select('id, title, images, price_cents, condition, seller_id, status')
        .eq('id', listingId)
        .single()

      if (listingError || !listingData) {
        setErrorCode('listing_not_found')
        setStep('error')
        return
      }
      if (listingData.status !== 'ACTIVE') {
        setErrorCode('listing_unavailable')
        setStep('error')
        return
      }
      if (listingData.seller_id === session.user.id) {
        setErrorCode('cannot_buy_own_item')
        setStep('error')
        return
      }
      setListing(listingData)

      // 3. Fetch buyer profile — address + locker prefs for courier/PUDO options
      const { data: buyerProfile } = await supabase
        .from('profiles')
        .select('street_address, suburb_name, city_name, preferred_locker_id, preferred_locker_name, preferred_locker_address')
        .eq('id', session.user.id)
        .single()

      // Pre-populate buyer locker + location for the map
      if (buyerProfile?.suburb_name) setBuyerSuburb(buyerProfile.suburb_name)
      if (buyerProfile?.city_name) setBuyerCity(buyerProfile.city_name)
      if (buyerProfile?.preferred_locker_id) {
        setBuyerLockerId(buyerProfile.preferred_locker_id)
        setBuyerLockerName(buyerProfile.preferred_locker_name ?? '')
        setBuyerLockerAddress(buyerProfile.preferred_locker_address ?? '')
      }

      // 4. Check for same-school delivery match. School pick-up needs neither a
      // street address nor a courier quote, so it's pre-selected and never blocks
      // checkout — courier/PUDO options (below) still load alongside it.
      let isSchoolMatch = false
      const matchRes = await fetch(`/api/checkout/school-match?listingId=${listingId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (matchRes.ok) {
        const matchData = await matchRes.json()
        if (matchData.match && matchData.hubActive && matchData.schools?.length > 0) {
          isSchoolMatch = true
          setSchoolMatch(true)
          setSchoolHubActive(true)
          setMatchingSchools(matchData.schools)
          // Pre-select school pick-up with the first matching school
          setDeliveryType('school')
          setDeliverySchoolId(matchData.schools[0].id)
          setDeliverySchoolName(matchData.schools[0].name)
        }
      }

      let resolvedItemPriceCents = listingData.price_cents

      // 5. Courier/PUDO requires a saved street address. Without a school match
      // it's the only delivery method, so a missing address blocks checkout —
      // otherwise school pick-up remains available and this is non-fatal.
      if (!buyerProfile?.street_address) {
        if (!isSchoolMatch) {
          setErrorCode('no_delivery_address')
          setStep('error')
          return
        }
        setCourierError('Add a delivery address in your profile to see courier delivery options.')
      } else {
        // 6. Fetch courier/PUDO quotes — shown alongside school pick-up so the
        // buyer can compare. If a school match exists, a failure here is
        // non-fatal since pick-up is still immediately available.
        const res = await fetch('/api/shipping/rates', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ listingId }),
        })

        let json: { quotes?: ShippingQuote[]; itemPriceCents?: number; error?: string; message?: string } = {}
        try { json = await res.json() } catch { /* empty body — treat as server error */ }

        if (!res.ok) {
          if (!isSchoolMatch) {
            const code = json.error ?? 'unknown'
            if (code === 'profile_incomplete' || code === 'no_delivery_address') {
              setErrorCode('no_delivery_address')
              setStep('error')
              return
            }
            setErrorCode(code)
            setErrorMessage(json.message ?? null)
            setStep('error')
            return
          }
          setCourierError(json.message ?? 'Courier delivery is unavailable for this item right now.')
        } else {
          const fetchedQuotes = json.quotes ?? []
          setQuotes(fetchedQuotes)
          resolvedItemPriceCents = json.itemPriceCents ?? listingData.price_cents
          if (fetchedQuotes.length > 0) {
            setSelectedQuoteId(fetchedQuotes[0].quoteId)
          }
        }
      }

      setItemPriceCents(resolvedItemPriceCents)
      setStep('selecting')
    }

    load()
  }, [listingId, router])

  const selectedQuote  = quotes.find((q) => q.quoteId === selectedQuoteId) ?? null
  // Group courier/PUDO quotes by whether the buyer collects (locker) or it's delivered to their door
  const pickupQuotes   = quotes.filter((q) => q.method === 'D2L' || q.method === 'L2L')
  const deliveryQuotes = quotes.filter((q) => q.method === 'D2D' || q.method === 'L2D')
  // School delivery costs R20 flat; courier costs come from TCG quote
  const shippingCents  = deliveryType === 'school' ? SCHOOL_FEE_CENTS : (selectedQuote ? Math.round(selectedQuote.rate * 100) : 0)
  const totalCents     = itemPriceCents + shippingCents

  // RULE: D2L and L2L quotes require a buyer collection locker to be selected
  const isPudoDelivery = deliveryType === 'courier' && (selectedQuote?.method === 'D2L' || selectedQuote?.method === 'L2L')

  async function handleConfirmOrder() {
    if (deliveryType === 'courier' && !selectedQuote) return
    setStep('placing')

    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      router.push('/')
      return
    }

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
      body: JSON.stringify({
        listingId,
        deliveryType,
        deliverySchoolId: deliveryType === 'school' ? deliverySchoolId : null,
        selectedQuote: deliveryType === 'school' || !selectedQuote ? null : {
          quoteId:               selectedQuote.quoteId,
          method:                selectedQuote.method,
          serviceLevelCode:      selectedQuote.serviceLevelCode,
          serviceLevelName:      selectedQuote.serviceLevelName,
          rate:                  selectedQuote.rate,
          estimatedDeliveryFrom: new Date(selectedQuote.estimatedDeliveryFrom).toISOString(),
          estimatedDeliveryTo:   new Date(selectedQuote.estimatedDeliveryTo).toISOString(),
        },
        buyerLockerId:   buyerLockerId   || null,
        buyerLockerName: buyerLockerName || null,
      }),
    })

    let json: { orderId?: string; error?: string } = {}
    try { json = await res.json() } catch { /* empty body */ }

    if (!res.ok) {
      if (json.error === 'listing_no_longer_available') {
        setErrorCode('listing_no_longer_available')
        setStep('error')
        return
      }
      setErrorCode(json.error ?? 'unknown')
      setStep('error')
      return
    }

    router.push('/orders')
  }

  const METHOD_LABELS: Record<string, string> = {
    D2D: 'Door-to-door delivery',
    D2L: 'PUDO locker delivery',
    L2D: 'PUDO locker drop-off → your door',
    L2L: 'PUDO locker to locker',
  }

  function renderQuoteCard(quote: ShippingQuote) {
    const isSelected = deliveryType === 'courier' && quote.quoteId === selectedQuoteId
    const isLocker = quote.method === 'D2L' || quote.method === 'L2D' || quote.method === 'L2L'
    const methodLabel = METHOD_LABELS[quote.method] ?? quote.method

    return (
      <button
        key={quote.quoteId}
        onClick={() => { setDeliveryType('courier'); setSelectedQuoteId(quote.quoteId) }}
        style={{
          width: '100%',
          background: '#fff',
          border: `2px solid ${isSelected ? '#BE1E2D' : '#e0e0e0'}`,
          borderRadius: '16px',
          padding: '16px 20px',
          marginBottom: '10px',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'border-color 0.15s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isLocker ? <MapPin size={18} color={isSelected ? '#BE1E2D' : '#888'} /> : <Truck size={18} color={isSelected ? '#BE1E2D' : '#888'} />}
            <div>
              <p style={{ fontWeight: 600, fontSize: '14px', color: isSelected ? '#BE1E2D' : '#1a1a2e', margin: 0 }}>
                {methodLabel} <span style={{ fontWeight: 400, color: '#888' }}>({quote.serviceLevelName})</span>
              </p>
              <p style={{ fontSize: '12px', color: '#888', margin: '2px 0 0' }}>
                Est. {formatDateRange(quote.estimatedDeliveryFrom, quote.estimatedDeliveryTo)}
                {quote.collectionLockerName ? ` · Seller drops at: ${quote.collectionLockerName}` : ''}
                {quote.deliveryLockerName ? ` · You collect at: ${quote.deliveryLockerName}` : ''}
              </p>
            </div>
          </div>
          <p style={{ fontWeight: 700, fontSize: '15px', color: isSelected ? '#BE1E2D' : '#1a1a2e', margin: 0, flexShrink: 0, marginLeft: '12px' }}>
            {formatRandFloat(quote.rate)}
          </p>
        </div>
      </button>
    )
  }

  // ─── Error state ──────────────────────────────────────────────────────────
  if (step === 'error') {
    const isAddressError = errorCode === 'no_delivery_address'

    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center px-6 py-10">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-sm">
          {isAddressError ? (
            <>
              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-5">
                <MapPin size={26} strokeWidth={1.5} className="text-amber-500" />
              </div>
              <h2 className="text-lg font-bold text-[#111] mb-2">Almost there — just add your delivery info</h2>
              <p className="text-sm text-[#555] mb-4">
                To get this item shipped to you, we need a street address.
                You can also save a preferred PUDO locker if you&apos;d rather
                collect nearby — it&apos;s usually cheaper!
              </p>
              <div className="bg-[#f4f4f4] rounded-xl p-3 mb-6 text-left text-xs text-[#555] space-y-1.5">
                <div className="flex items-start gap-2">
                  <Home size={13} strokeWidth={2} className="text-[#BE1E2D] mt-0.5 shrink-0" />
                  <span><strong className="text-[#111]">Street address</strong> — for door-to-door delivery</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin size={13} strokeWidth={2} className="text-[#BE1E2D] mt-0.5 shrink-0" />
                  <span><strong className="text-[#111]">PUDO locker</strong> — collect at a locker near you (often cheaper)</span>
                </div>
              </div>
              <button
                onClick={() => router.push('/profile')}
                className="w-full py-3 bg-[#BE1E2D] hover:bg-[#9B1824] text-white rounded-full font-semibold text-sm transition mb-3"
              >
                Update my delivery info →
              </button>
              <button
                onClick={() => router.back()}
                className="w-full py-3 border border-[#dedede] text-[#979797] rounded-full text-sm hover:border-[#979797] transition"
              >
                Go back
              </button>
            </>
          ) : (
            <>
              <p className="text-[#555] mb-6 text-sm">
                {errorMessage ?? {
                  listing_not_found:           'This listing no longer exists.',
                  listing_unavailable:         'This item is not available for purchase.',
                  cannot_buy_own_item:         'You cannot buy your own listing.',
                  listing_no_longer_available: 'This item was just sold — sorry!',
                  shipping_unavailable:        'Shipping quotes are temporarily unavailable. Please try again.',
                  no_shipping_methods:         'This item has no shipping options configured.',
                }[errorCode ?? ''] ?? 'Something went wrong. Please try again.'}
              </p>
              <button
                onClick={() => router.back()}
                className="px-8 py-3 bg-[#BE1E2D] hover:bg-[#9B1824] text-white rounded-full font-semibold text-sm transition"
              >
                Go back
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  // ─── Loading skeleton ─────────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', padding: '24px' }}>
        <div style={{ maxWidth: '560px', margin: '0 auto' }}>
          {/* Header skeleton */}
          <div style={{ height: '24px', width: '120px', background: '#e0e0e0', borderRadius: '8px', marginBottom: '24px' }} />
          {/* Item card skeleton */}
          <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', marginBottom: '16px', display: 'flex', gap: '16px' }}>
            <div style={{ width: '72px', height: '72px', background: '#e0e0e0', borderRadius: '12px', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: '16px', background: '#e0e0e0', borderRadius: '6px', marginBottom: '8px' }} />
              <div style={{ height: '14px', width: '60%', background: '#e0e0e0', borderRadius: '6px' }} />
            </div>
          </div>
          {/* Quote skeletons */}
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ background: '#fff', borderRadius: '16px', padding: '20px', marginBottom: '12px', height: '80px' }} />
          ))}
          {/* Summary skeleton */}
          <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', height: '100px' }} />
        </div>
      </div>
    )
  }

  // ─── Main checkout UI ─────────────────────────────────────────────────────
  const coverImage = listing?.images?.[0] ?? null

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', padding: '24px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <button
            onClick={() => router.back()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#BE1E2D' }}
          >
            <ArrowLeft size={20} />
          </button>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#1a1a2e', margin: 0 }}>Checkout</h1>
        </div>

        {/* Item card */}
        {listing && (
          <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', marginBottom: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
            {coverImage ? (
              <img
                src={coverImage}
                alt={listing.title}
                style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '12px', flexShrink: 0 }}
              />
            ) : (
              <div style={{ width: '72px', height: '72px', background: '#f0f0f0', borderRadius: '12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Package size={28} color="#aaa" />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 600, fontSize: '15px', color: '#1a1a2e', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listing.title}</p>
              {listing.condition && (
                <p style={{ fontSize: '13px', color: '#888', margin: '0 0 4px' }}>Condition: {listing.condition.charAt(0) + listing.condition.slice(1).toLowerCase()}</p>
              )}
              <p style={{ fontSize: '16px', fontWeight: 700, color: '#BE1E2D', margin: 0 }}>{formatRands(listing.price_cents)}</p>
            </div>
          </div>
        )}

        {/* ── Pick-up options: school pick-up + any PUDO locker quotes ── */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-[#979797] uppercase tracking-wide mb-2">Pick-up options</p>

          {/* School pick-up card (shown when buyer & seller share a school) */}
          {schoolMatch && schoolHubActive && (
            <button
              onClick={() => setDeliveryType('school')}
              className={`w-full text-left p-4 rounded-2xl border-2 mb-2 transition ${
                deliveryType === 'school' ? 'border-[#BE1E2D] bg-red-50' : 'border-[#dedede] bg-white hover:border-[#BE1E2D]/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${deliveryType === 'school' ? 'bg-[#BE1E2D]' : 'bg-[#f4f4f4]'}`}>
                    <School size={15} strokeWidth={2} className={deliveryType === 'school' ? 'text-white' : 'text-[#979797]'} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#111]">School pick-up — R20</p>
                    <p className="text-xs text-[#979797] mt-0.5">Collect from {deliverySchoolName ?? matchingSchools[0]?.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold text-[#BE1E2D]">R 20.00</p>
                  {deliveryType === 'school' && <CheckCircle2 size={16} className="text-[#BE1E2D] ml-auto mt-1" />}
                </div>
              </div>
              {deliveryType === 'school' && matchingSchools.length > 1 && (
                <div className="mt-3 pt-3 border-t border-red-100">
                  <p className="text-xs text-[#979797] mb-2">You have children at multiple matching schools — choose one:</p>
                  <div className="flex flex-wrap gap-2">
                    {matchingSchools.map(s => (
                      <button key={s.id} onClick={e => { e.stopPropagation(); setDeliverySchoolId(s.id); setDeliverySchoolName(s.name); }}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                          deliverySchoolId === s.id ? 'bg-[#BE1E2D] text-white border-[#BE1E2D]' : 'bg-white text-[#111] border-[#dedede] hover:border-[#BE1E2D]'
                        }`}>
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </button>
          )}

          {/* PUDO locker quotes — buyer collects from a locker (D2L, L2L) */}
          {pickupQuotes.map(renderQuoteCard)}

          {!(schoolMatch && schoolHubActive) && pickupQuotes.length === 0 && (
            <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', textAlign: 'center', color: '#888' }}>
              {courierError ?? 'No pick-up options available.'}
            </div>
          )}
        </div>

        {/* ── Delivery options: door-to-door courier quotes (D2D, L2D) ── */}
        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
            Delivery options
          </p>
          {deliveryQuotes.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', textAlign: 'center', color: '#888' }}>
              {courierError ?? 'No delivery options available.'}
            </div>
          ) : (
            deliveryQuotes.map(renderQuoteCard)
          )}
        </div>

        {/* PUDO locker picker — appears when buyer selects a D2L or L2L quote */}
        {isPudoDelivery && buyerSuburb && (
          <div className="bg-white rounded-2xl p-5 mb-4 border border-[#e0e0e0]">
            <p className="text-sm font-semibold text-[#1a1a2e] mb-1">
              {buyerLockerId ? 'Your collection locker' : 'Choose a collection locker'}
            </p>
            <p className="text-xs text-[#888] mb-3">
              Your order will be delivered to this PUDO locker for you to collect.
            </p>
            <LockerMapPicker
              suburb={buyerSuburb}
              city={buyerCity}
              selectedId={buyerLockerId}
              selectedName={buyerLockerName}
              selectedAddress={buyerLockerAddress}
              onSelect={(locker: SelectedLocker | null) => {
                setBuyerLockerId(locker?.id ?? '')
                setBuyerLockerName(locker?.name ?? '')
                setBuyerLockerAddress(locker?.address ?? '')
              }}
            />
          </div>
        )}

        {/* Order summary */}
        <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Order summary</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', color: '#555' }}>Item price</span>
            <span style={{ fontSize: '14px', color: '#1a1a2e', fontWeight: 500 }}>{formatRands(itemPriceCents)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '14px', color: '#555' }}>Shipping</span>
            <span style={{ fontSize: '14px', color: '#1a1a2e', fontWeight: 500 }}>
              {deliveryType === 'school'
                ? formatRands(SCHOOL_FEE_CENTS)
                : selectedQuote ? formatRandFloat(selectedQuote.rate) : '—'}
            </span>
          </div>
          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#1a1a2e' }}>Total</span>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#BE1E2D' }}>
              {deliveryType === 'school' || selectedQuote ? formatRands(totalCents) : '—'}
            </span>
          </div>
        </div>

        {/* Confirm button */}
        <button
          onClick={handleConfirmOrder}
          disabled={(deliveryType === 'courier' && !selectedQuote) || step === 'placing'}
          style={{
            width: '100%',
            background: (deliveryType === 'school' || selectedQuote) ? '#BE1E2D' : '#c0c0c0',
            color: '#fff',
            border: 'none',
            borderRadius: '14px',
            padding: '16px',
            fontSize: '16px',
            fontWeight: 700,
            cursor: selectedQuote ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          {step === 'placing' ? (
            <>
              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
              Placing order…
            </>
          ) : (
            'Confirm Order'
          )}
        </button>

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}
