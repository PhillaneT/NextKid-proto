'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Lock, Package, Truck, MapPin, Loader2 } from 'lucide-react'
import type { ShippingQuote } from '@nextkid/shared'

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

      // 3. Fetch shipping quotes
      const res = await fetch('/api/shipping/rates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ listingId }),
      })

      const json = await res.json() as { quotes?: ShippingQuote[]; itemPriceCents?: number; error?: string; message?: string }

      if (!res.ok) {
        const code = json.error ?? 'unknown'
        if (code === 'profile_incomplete') {
          // TODO: pass return URL once onboarding supports it
          router.push('/onboarding')
          return
        }
        setErrorCode(code)
        setErrorMessage(json.message ?? null)
        setStep('error')
        return
      }

      const fetchedQuotes = json.quotes ?? []
      setQuotes(fetchedQuotes)
      setItemPriceCents(json.itemPriceCents ?? listingData.price_cents)
      if (fetchedQuotes.length > 0) {
        setSelectedQuoteId(fetchedQuotes[0].quoteId)
      }
      setStep('selecting')
    }

    load()
  }, [listingId, router])

  const selectedQuote = quotes.find((q) => q.quoteId === selectedQuoteId) ?? null
  const shippingCents = selectedQuote ? Math.round(selectedQuote.rate * 100) : 0
  const totalCents = itemPriceCents + shippingCents

  async function handleConfirmOrder() {
    if (!selectedQuote) return
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
        selectedQuote: {
          quoteId: selectedQuote.quoteId,
          method: selectedQuote.method,
          serviceLevelCode: selectedQuote.serviceLevelCode,
          serviceLevelName: selectedQuote.serviceLevelName,
          rate: selectedQuote.rate,
          estimatedDeliveryFrom: new Date(selectedQuote.estimatedDeliveryFrom).toISOString(),
          estimatedDeliveryTo: new Date(selectedQuote.estimatedDeliveryTo).toISOString(),
        },
      }),
    })

    const json = await res.json() as { orderId?: string; error?: string }

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

    router.push(`/orders/${json.orderId}`)
  }

  // ─── Error state ──────────────────────────────────────────────────────────
  if (step === 'error') {
    const messages: Record<string, string> = {
      listing_not_found: 'This listing no longer exists.',
      listing_unavailable: 'This item is not available for purchase.',
      cannot_buy_own_item: 'You cannot buy your own listing.',
      listing_no_longer_available: 'This item was just sold — sorry! Browse for something similar.',
      shipping_unavailable: 'Shipping quotes are temporarily unavailable. Please try again.',
      no_shipping_methods: 'This item has no shipping options configured.',
    }
    const message = errorMessage ?? messages[errorCode ?? ''] ?? 'Something went wrong. Please try again.'

    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ background: '#fff', borderRadius: '16px', padding: '32px', maxWidth: '480px', width: '100%', textAlign: 'center' }}>
          <p style={{ fontSize: '16px', color: '#555', marginBottom: '24px' }}>{message}</p>
          <button
            onClick={() => router.back()}
            style={{ background: '#4757bf', color: '#fff', border: 'none', borderRadius: '12px', padding: '12px 24px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}
          >
            Go back
          </button>
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
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#4757bf' }}
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
              <p style={{ fontSize: '16px', fontWeight: 700, color: '#4757bf', margin: 0 }}>{formatRands(listing.price_cents)}</p>
            </div>
          </div>
        )}

        {/* Shipping options */}
        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Shipping options</p>
          {quotes.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', textAlign: 'center', color: '#888' }}>
              No shipping options available.
            </div>
          ) : (
            quotes.map((quote) => {
              const isSelected = quote.quoteId === selectedQuoteId
              const isLocker = quote.method === 'D2L' || quote.method === 'L2D' || quote.method === 'L2L'
              const METHOD_LABELS: Record<string, string> = {
                D2D: 'Door-to-door delivery',
                D2L: 'PUDO locker delivery',
                L2D: 'PUDO locker drop-off → your door',
                L2L: 'PUDO locker to locker',
              }
              const methodLabel = METHOD_LABELS[quote.method] ?? quote.method

              return (
                <button
                  key={quote.quoteId}
                  onClick={() => setSelectedQuoteId(quote.quoteId)}
                  style={{
                    width: '100%',
                    background: '#fff',
                    border: `2px solid ${isSelected ? '#4757bf' : '#e0e0e0'}`,
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
                      {isLocker ? <MapPin size={18} color={isSelected ? '#4757bf' : '#888'} /> : <Truck size={18} color={isSelected ? '#4757bf' : '#888'} />}
                      <div>
                        <p style={{ fontWeight: 600, fontSize: '14px', color: isSelected ? '#4757bf' : '#1a1a2e', margin: 0 }}>
                          {methodLabel} <span style={{ fontWeight: 400, color: '#888' }}>({quote.serviceLevelName})</span>
                        </p>
                        <p style={{ fontSize: '12px', color: '#888', margin: '2px 0 0' }}>
                          Est. {formatDateRange(quote.estimatedDeliveryFrom, quote.estimatedDeliveryTo)}
                          {quote.collectionLockerName ? ` · Drop at: ${quote.collectionLockerName}` : ''}
                        </p>
                      </div>
                    </div>
                    <p style={{ fontWeight: 700, fontSize: '15px', color: isSelected ? '#4757bf' : '#1a1a2e', margin: 0, flexShrink: 0, marginLeft: '12px' }}>
                      {formatRandFloat(quote.rate)}
                    </p>
                  </div>
                </button>
              )
            })
          )}
        </div>

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
              {selectedQuote ? formatRandFloat(selectedQuote.rate) : '—'}
            </span>
          </div>
          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#1a1a2e' }}>Total</span>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#4757bf' }}>
              {selectedQuote ? formatRands(totalCents) : '—'}
            </span>
          </div>
        </div>

        {/* Confirm button */}
        <button
          onClick={handleConfirmOrder}
          disabled={!selectedQuote || step === 'placing'}
          style={{
            width: '100%',
            background: selectedQuote ? '#4757bf' : '#c0c0c0',
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
