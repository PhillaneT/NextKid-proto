'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

export interface CartItem {
  listingId: string
  title: string
  price_cents: number
  image: string | null
  sellerId: string
  category: string
  size?: string | null
}

interface CartContextValue {
  items: CartItem[]
  count: number
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

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setItems(JSON.parse(stored))
    } catch { /* ignore */ }
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
    <CartContext.Provider value={{ items, count: items.length, add, remove, has, clear, bySeller }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
