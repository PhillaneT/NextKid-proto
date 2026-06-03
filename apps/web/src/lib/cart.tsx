'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

// A single item within a multi-item listing that the buyer has selected
export interface SelectedListingItem {
  id:          string   // listing_items.id
  name:        string
  price_cents: number
  size_label:  string | null
}

export interface CartItem {
  listingId:   string
  title:       string
  price_cents: number   // total: sum of selectedItems prices (or single price)
  image:       string | null
  sellerId:    string
  category:    string
  size?:       string | null
  // Multi-item: which specific items the buyer chose
  selectedItems?: SelectedListingItem[]
}

interface CartContextValue {
  items: CartItem[]
  count: number
  isLoaded: boolean
  add: (item: CartItem) => void
  remove: (listingId: string) => void
  has: (listingId: string) => boolean
  clear: () => void
  // Items grouped by seller
  bySeller: Record<string, CartItem[]>
}

const CartContext = createContext<CartContextValue | null>(null)

const STORAGE_KEY = 'nextkid_cart'

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Load from localStorage on mount — deduplicate on read to fix any existing duplicates
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed: CartItem[] = JSON.parse(stored)
        const seen = new Set<string>()
        const deduped = parsed.filter(item => {
          if (seen.has(item.listingId)) return false
          seen.add(item.listingId)
          return true
        })
        setItems(deduped)
      }
    } catch { /* ignore */ }
    setIsLoaded(true)
  }, [])

  // Persist to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const add = useCallback((item: CartItem) => {
    setItems(prev => prev.some(i => i.listingId === item.listingId)
      ? prev
      : [...prev, item]
    )
  }, [])

  const remove = useCallback((listingId: string) => {
    setItems(prev => prev.filter(i => i.listingId !== listingId))
  }, [])

  const has = useCallback((listingId: string) => {
    return items.some(i => i.listingId === listingId)
  }, [items])

  const clear = useCallback(() => setItems([]), [])

  const bySeller = items.reduce<Record<string, CartItem[]>>((acc, item) => {
    if (!acc[item.sellerId]) acc[item.sellerId] = []
    acc[item.sellerId].push(item)
    return acc
  }, {})

  return (
    <CartContext.Provider value={{ items, count: items.length, isLoaded, add, remove, has, clear, bySeller }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
