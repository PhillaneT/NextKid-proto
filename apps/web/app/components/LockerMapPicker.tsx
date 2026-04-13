'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect } from 'react'
import { Loader2, MapPin, X, LocateFixed } from 'lucide-react'
import type { LockerMapLocker } from './LockerMapInner'

export interface SelectedLocker {
  id: string
  name: string
  address: string
}

interface Props {
  /** Suburb name from the user's profile — used to geocode the map centre */
  suburb?: string
  /** City name from the user's profile — used alongside suburb */
  city?: string
  selectedId?: string
  selectedName?: string
  selectedAddress?: string
  onSelect: (locker: SelectedLocker | null) => void
}

// Dynamically imported to avoid SSR crash — Leaflet touches window at module load time
const MapInner = dynamic(() => import('./LockerMapInner'), {
  ssr: false,
  loading: () => (
    <div className="h-[300px] bg-[#f4f4f4] flex flex-col items-center justify-center gap-2">
      <Loader2 size={22} className="animate-spin text-[#BE1E2D]" />
      <p className="text-xs text-[#979797]">Loading map…</p>
    </div>
  ),
})

export default function LockerMapPicker({
  suburb,
  city,
  selectedId,
  selectedName,
  selectedAddress,
  onSelect,
}: Props) {
  const [lockers, setLockers] = useState<LockerMapLocker[]>([])
  const [center, setCenter] = useState({ lat: -26.2041, lng: 28.0473 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    const params = new URLSearchParams()
    if (suburb) params.set('suburb', suburb)
    if (city) params.set('city', city)

    fetch(`/api/lockers/nearby?${params.toString()}`)
      .then(r => r.json() as Promise<{ lockers: LockerMapLocker[]; center: { lat: number; lng: number } }>)
      .then(data => {
        setLockers(data.lockers ?? [])
        if (data.center?.lat) setCenter(data.center)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [suburb, city])

  if (loading) {
    return (
      <div className="rounded-xl overflow-hidden border border-[#dedede]">
        <div className="h-[300px] bg-[#f4f4f4] flex flex-col items-center justify-center gap-2">
          <Loader2 size={22} className="animate-spin text-[#BE1E2D]" />
          <p className="text-xs text-[#979797]">
            Finding lockers near {suburb ?? city ?? 'your area'}…
          </p>
        </div>
      </div>
    )
  }

  if (error || lockers.length === 0) {
    return (
      <div className="rounded-xl border border-[#dedede] p-5 text-center space-y-1">
        <MapPin size={20} className="text-[#979797] mx-auto" />
        <p className="text-sm text-[#979797]">
          No lockers found near {suburb ?? city ?? 'your area'}.
        </p>
        <p className="text-xs text-[#979797]">
          Update your suburb on your profile to see lockers nearby.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {/* Selected locker chip */}
      {selectedId && selectedName && (
        <div className="flex items-center justify-between bg-[#fde8ea] border border-[#c7d2fe] rounded-xl px-4 py-2.5">
          <div className="flex items-center gap-2 text-[#BE1E2D] text-sm min-w-0">
            <LocateFixed size={14} strokeWidth={2.5} className="shrink-0" />
            <span className="font-semibold truncate">{selectedName}</span>
            {selectedAddress && (
              <span className="text-[#BE1E2D]/60 text-xs hidden sm:inline truncate">
                · {selectedAddress}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-[#979797] hover:text-[#111] transition ml-2 shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Leaflet map — SSR-safe via dynamic import */}
      <div className="rounded-xl overflow-hidden border border-[#dedede]">
        <MapInner
          lockers={lockers}
          center={center}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      </div>

      <p className="text-xs text-[#979797] text-center">
        {lockers.length} PUDO locker{lockers.length !== 1 ? 's' : ''} near{' '}
        {suburb ?? city ?? 'your area'} · Tap a pin to select
      </p>
    </div>
  )
}
