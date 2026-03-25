'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { CheckCircle, Lock, Package, ArrowLeft } from 'lucide-react'

type OrderRow = {
  id: string
  status: string
  item_price_cents: number
  shipping_cost_cents: number
  total_paid_cents: number
  shipping_method: string | null
  service_level_code: string | null
  created_at: string
  listing_id: string
}

type ListingRow = {
  title: string
  images: string[]
}

function formatRands(cents: number) {
  return `R ${(cents / 100).toFixed(2)}`
}

const METHOD_LABELS: Record<string, string> = {
  D2D: 'Door-to-door delivery',
  D2L: 'PUDO locker delivery',
  L2D: 'PUDO locker drop-off → your door',
  L2L: 'PUDO locker to locker',
}

export default function OrderConfirmationPage() {
  const { id: orderId } = useParams<{ id: string }>()
  const router = useRouter()

  const [order, setOrder] = useState<OrderRow | null>(null)
  const [listing, setListing] = useState<ListingRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        router.push('/')
        return
      }

      // Fetch order — RLS policy "Order parties can view orders" allows buyer to read their own
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('id, status, item_price_cents, shipping_cost_cents, total_paid_cents, shipping_method, service_level_code, created_at, listing_id')
        .eq('id', orderId)
        .single()

      if (orderError || !orderData) {
        setLoading(false)
        return
      }
      setOrder(orderData)

      // Fetch listing for display (title + cover image)
      // TODO: RLS only allows reading ACTIVE listings — once sold this may return null
      const { data: listingData } = await supabase
        .from('listings')
        .select('title, images')
        .eq('id', orderData.listing_id)
        .single()

      setListing(listingData ?? null)
      setLoading(false)
    }

    load()
  }, [orderId, router])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #e0e0e0', borderTop: '3px solid #4757bf', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!order) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <p style={{ color: '#555', marginBottom: '20px' }}>Order not found.</p>
        <button onClick={() => router.push('/browse')} style={{ background: '#4757bf', color: '#fff', border: 'none', borderRadius: '12px', padding: '12px 24px', fontWeight: 600, cursor: 'pointer' }}>
          Browse items
        </button>
      </div>
    )
  }

  const coverImage = listing?.images?.[0] ?? null
  const shortId = order.id.slice(0, 8)
  const methodLabel = order.shipping_method ? (METHOD_LABELS[order.shipping_method] ?? order.shipping_method) : 'Unknown'
  const serviceLabel = order.service_level_code ?? ''

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: '24px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>

        {/* Back button */}
        <button
          onClick={() => router.push('/browse')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#4757bf', marginBottom: '24px', padding: 0 }}
        >
          <ArrowLeft size={18} />
          <span style={{ fontSize: '14px', fontWeight: 500 }}>Browse more items</span>
        </button>

        {/* Success header */}
        <div style={{ background: '#fff', borderRadius: '20px', padding: '32px', textAlign: 'center', marginBottom: '16px' }}>
          <CheckCircle size={56} color="#4757bf" style={{ marginBottom: '16px' }} />
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1a1a2e', margin: '0 0 8px' }}>Order Placed!</h1>
          <p style={{ fontSize: '14px', color: '#888', margin: 0 }}>The seller has been notified and will ship within 3 business days.</p>
        </div>

        {/* Item summary */}
        {listing && (
          <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', marginBottom: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
            {coverImage ? (
              <img src={coverImage} alt={listing.title} style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '12px', flexShrink: 0 }} />
            ) : (
              <div style={{ width: '64px', height: '64px', background: '#f0f0f0', borderRadius: '12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Package size={24} color="#aaa" />
              </div>
            )}
            <p style={{ fontWeight: 600, fontSize: '15px', color: '#1a1a2e', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listing.title}</p>
          </div>
        )}

        {/* Order details */}
        <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 14px' }}>Order details</p>

          {[
            ['Order ID', `#${shortId}`],
            ['Item price', formatRands(order.item_price_cents)],
            ['Shipping', formatRands(order.shipping_cost_cents)],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px', color: '#555' }}>{label}</span>
              <span style={{ fontSize: '14px', color: '#1a1a2e', fontWeight: 500 }}>{value}</span>
            </div>
          ))}

          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '10px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a2e' }}>Total paid</span>
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#4757bf' }}>{formatRands(order.total_paid_cents)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', color: '#555' }}>Shipping via</span>
            <span style={{ fontSize: '14px', color: '#1a1a2e', fontWeight: 500, textAlign: 'right', maxWidth: '220px' }}>
              {methodLabel}{serviceLabel ? ` (${serviceLabel})` : ''}
            </span>
          </div>
        </div>

        {/* Payment placeholder */}
        <div style={{
          border: '2px dashed #d0d0d0',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '16px',
          background: '#fafafa',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '8px',
        }}>
          <Lock size={28} color="#4757bf" />
          <p style={{ fontWeight: 700, fontSize: '15px', color: '#1a1a2e', margin: 0 }}>Payment processing coming soon</p>
          <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>
            Your order is reserved. Secure escrow payment via Peach Payments will be available shortly.
          </p>
        </div>

        {/* What happens next */}
        <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 14px' }}>What happens next?</p>
          {[
            'Your payment will be held securely in escrow',
            'Seller ships within 3 business days',
            'Confirm receipt to release funds to seller',
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: i < 2 ? '12px' : 0 }}>
              <div style={{ width: '24px', height: '24px', background: '#4757bf', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#fff', fontSize: '12px', fontWeight: 700 }}>{i + 1}</span>
              </div>
              <p style={{ fontSize: '14px', color: '#444', margin: 0, paddingTop: '3px' }}>{step}</p>
            </div>
          ))}
        </div>

        {/* Footer actions */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => router.push('/browse')}
            style={{ flex: 1, background: '#f0f0f0', color: '#1a1a2e', border: 'none', borderRadius: '14px', padding: '14px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
          >
            Browse more
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            style={{ flex: 1, background: '#4757bf', color: '#fff', border: 'none', borderRadius: '14px', padding: '14px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
          >
            Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
