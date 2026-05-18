'use client'

import { useCart } from '@/lib/cart'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useState, useEffect, Suspense } from 'react'
import { Package, ArrowLeft, ShoppingBag, Check } from 'lucide-react'
import Image from 'next/image'

function CartCheckoutInner() {
  const { bySeller, remove } = useCart()
  const router = useRouter()
  const searchParams = useSearchParams()
  const sellerId = searchParams.get('seller') ?? ''

  const items = bySeller[sellerId] ?? []
  const [placing, setPlacing] = useState(false)
  const [done, setDone] = useState(false)
  const [orderIds, setOrderIds] = useState<string[]>([])
  const [error, setError] = useState('')

  const fmt = (cents: number) => `R ${(cents / 100).toFixed(2)}`
  const subtotal = items.reduce((s, i) => s + i.price_cents, 0)

  useEffect(() => {
    if (!sellerId || items.length === 0) router.replace('/cart')
  }, [sellerId, items.length, router])

  const handleCheckout = async () => {
    setPlacing(true)
    setError('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.replace('/'); return }

    const createdIds: string[] = []

    for (const item of items) {
      // Create a PENDING_PAYMENT order for each item
      // Shipping quote is collected per-item in the individual order page
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          listingId: item.listingId,
          selectedQuote: null,  // buyer selects shipping on the order page
          cartCheckout: true,
        }),
      })
      const json = await res.json() as { orderId?: string; error?: string }
      if (res.ok && json.orderId) {
        createdIds.push(json.orderId)
        remove(item.listingId)
      } else {
        setError(`Could not order "${item.title}": ${json.error ?? 'unknown error'}`)
        break
      }
    }

    setOrderIds(createdIds)
    setDone(true)
    setPlacing(false)
  }

  if (done) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 px-6">
        <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center border border-green-200">
          <Check size={32} strokeWidth={2} className="text-green-500" />
        </div>
        <h2 className="text-xl font-bold text-[#111]">Orders placed!</h2>
        <p className="text-[#979797] text-sm text-center max-w-xs">
          {orderIds.length} order{orderIds.length !== 1 ? 's' : ''} created. Go to each order to complete payment and select shipping.
        </p>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/orders')}
            className="px-6 py-3 bg-[#BE1E2D] text-white rounded-full font-semibold text-sm hover:bg-[#9B1824] transition"
          >
            View my orders
          </button>
          <button
            onClick={() => router.push('/browse')}
            className="px-6 py-3 border border-[#dedede] text-[#111] rounded-full text-sm font-semibold hover:border-[#BE1E2D] transition"
          >
            Keep browsing
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f4f4f4]">
      <div className="max-w-lg mx-auto px-6 py-10">

        {/* Back */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-[#BE1E2D] text-sm font-medium mb-8 hover:underline"
        >
          <ArrowLeft size={16} strokeWidth={2} /> Back to cart
        </button>

        <h1 className="text-2xl font-bold text-[#111] mb-1">Checkout</h1>
        <p className="text-[#979797] text-sm mb-8">
          {items.length} item{items.length !== 1 ? 's' : ''} from this seller
        </p>

        {/* Items list */}
        <div className="bg-white rounded-2xl border border-[#dedede] overflow-hidden mb-4">
          <div className="px-5 py-3 border-b border-[#f4f4f4]">
            <p className="text-xs font-semibold text-[#979797] uppercase tracking-wide">Items</p>
          </div>
          <div className="divide-y divide-[#f4f4f4]">
            {items.map(item => (
              <div key={item.listingId} className="flex items-center gap-4 px-5 py-4">
                <div className="w-12 h-12 rounded-xl bg-[#f4f4f4] overflow-hidden shrink-0 relative">
                  {item.image ? (
                    <Image src={item.image} alt={item.title} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package size={16} strokeWidth={1.5} className="text-[#dedede]" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#111] truncate">{item.title}</p>
                  <p className="text-xs text-[#979797]">{item.category}</p>
                </div>
                <p className="text-sm font-bold text-[#BE1E2D] shrink-0">{fmt(item.price_cents)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-2xl border border-[#dedede] px-5 py-4 mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-[#555]">Items subtotal</span>
            <span className="text-sm font-medium text-[#111]">{fmt(subtotal)}</span>
          </div>
          <div className="flex justify-between pb-2 border-b border-[#f4f4f4] mb-2">
            <span className="text-sm text-[#555]">Shipping</span>
            <span className="text-sm text-[#979797]">Selected per order</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm font-bold text-[#111]">Estimated total</span>
            <span className="text-sm font-bold text-[#BE1E2D]">{fmt(subtotal)} + shipping</span>
          </div>
        </div>

        {/* Note */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 mb-6 flex gap-3">
          <ShoppingBag size={18} strokeWidth={1.5} className="text-blue-500 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700">
            Each item gets its own order. After placing, go to each order to select shipping and complete payment.
          </p>
        </div>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        <button
          onClick={handleCheckout}
          disabled={placing || items.length === 0}
          className="w-full py-4 bg-[#BE1E2D] hover:bg-[#9B1824] disabled:bg-[#dedede] text-white font-bold rounded-full transition flex items-center justify-center gap-2"
        >
          {placing ? 'Placing orders…' : `Place ${items.length} order${items.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}

export default function CartCheckoutPage() {
  return (
    <Suspense>
      <CartCheckoutInner />
    </Suspense>
  )
}
