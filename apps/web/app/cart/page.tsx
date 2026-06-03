'use client'

import { useCart } from '@/lib/cart'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { ShoppingCart, Trash2, Package, ArrowRight } from 'lucide-react'
import Image from 'next/image'

type SellerInfo = { id: string; name: string }

export default function CartPage() {
  const { items, remove, clear, bySeller, count, isLoaded } = useCart()
  const router = useRouter()
  const [sellers, setSellers] = useState<Record<string, SellerInfo>>({})

  // Fetch seller display names
  useEffect(() => {
    const sellerIds = Object.keys(bySeller)
    if (!sellerIds.length) return
    supabase
      .from('profiles')
      .select('id, full_name, display_name')
      .in('id', sellerIds)
      .then(({ data }) => {
        const map: Record<string, SellerInfo> = {}
        data?.forEach(p => {
          map[p.id] = { id: p.id, name: p.display_name ?? p.full_name ?? 'Seller' }
        })
        setSellers(map)
      })
  }, [count])

  const fmt = (cents: number) => `R ${(cents / 100).toFixed(2)}`

  const sellerTotal = (sellerId: string) =>
    (bySeller[sellerId] ?? []).reduce((s, i) => s + i.price_cents, 0)

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-[#979797] text-sm">Loading cart…</p>
      </div>
    )
  }

  if (count === 0) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 px-6">
        <ShoppingCart size={56} strokeWidth={1.5} className="text-[#dedede]" />
        <p className="text-xl font-bold text-[#111]">Your cart is empty</p>
        <p className="text-[#979797] text-sm text-center max-w-xs">
          Browse listings and add items to your cart to checkout multiple items from the same seller.
        </p>
        <button
          onClick={() => router.push('/browse')}
          className="px-6 py-3 bg-[#BE1E2D] text-white rounded-full font-semibold text-sm hover:bg-[#9B1824] transition"
        >
          Browse listings
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f4f4f4]">
      <div className="max-w-3xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#111]">Your Cart</h1>
            <p className="text-[#979797] text-sm mt-1">{count} item{count !== 1 ? 's' : ''} from {Object.keys(bySeller).length} seller{Object.keys(bySeller).length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={clear}
            className="flex items-center gap-1.5 text-xs text-[#979797] hover:text-red-500 transition"
          >
            <Trash2 size={13} strokeWidth={2} />
            Clear cart
          </button>
        </div>

        {/* One section per seller */}
        <div className="space-y-6">
          {Object.entries(bySeller).map(([sellerId, sellerItems]) => (
            <div key={sellerId} className="bg-white rounded-2xl border border-[#dedede] overflow-hidden">

              {/* Seller header */}
              <div className="px-5 py-3.5 border-b border-[#f4f4f4] flex items-center justify-between">
                <p className="text-sm font-semibold text-[#111]">
                  Seller: {sellers[sellerId]?.name ?? 'Loading...'}
                </p>
                <p className="text-xs text-[#979797]">{sellerItems.length} item{sellerItems.length !== 1 ? 's' : ''}</p>
              </div>

              {/* Items */}
              <div className="divide-y divide-[#f4f4f4]">
                {sellerItems.map(item => (
                  <div key={item.listingId} className="flex items-center gap-4 px-5 py-4">
                    {/* Image */}
                    <div className="w-16 h-16 rounded-xl bg-[#f4f4f4] overflow-hidden shrink-0 relative">
                      {item.image ? (
                        <Image src={item.image} alt={item.title} fill className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package size={20} strokeWidth={1.5} className="text-[#dedede]" />
                        </div>
                      )}
                    </div>
                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#111] truncate">{item.title}</p>
                      <p className="text-xs text-[#979797] mt-0.5">{item.category}{item.size ? ` · ${item.size}` : ''}</p>
                    </div>
                    {/* Price + remove */}
                    <div className="flex items-center gap-4 shrink-0">
                      <p className="text-base font-bold text-[#BE1E2D]">{fmt(item.price_cents)}</p>
                      <button
                        onClick={() => remove(item.listingId)}
                        className="text-[#dedede] hover:text-red-500 transition"
                      >
                        <Trash2 size={15} strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Seller subtotal + checkout */}
              <div className="px-5 py-4 bg-[#fafafa] border-t border-[#f4f4f4] flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#979797]">Items subtotal</p>
                  <p className="text-lg font-bold text-[#111]">{fmt(sellerTotal(sellerId))}</p>
                  <p className="text-xs text-[#979797] mt-0.5">+ shipping calculated at checkout</p>
                </div>
                <button
                  onClick={() => router.push(`/cart/checkout?seller=${sellerId}`)}
                  className="flex items-center gap-2 px-6 py-3 bg-[#BE1E2D] hover:bg-[#9B1824] text-white rounded-full font-semibold text-sm transition"
                >
                  Checkout
                  <ArrowRight size={15} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Info note */}
        {Object.keys(bySeller).length > 1 && (
          <p className="text-xs text-[#979797] text-center mt-6">
            Items from different sellers are checked out separately — each seller ships their own items.
          </p>
        )}
      </div>
    </div>
  )
}
