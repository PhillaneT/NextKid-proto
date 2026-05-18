'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect, useCallback } from 'react'
import { Loader2, MapPin, X, LocateFixed, Navigation, Clock, Route } from 'lucide-react'
import type { LockerMapLocker, LatLng } from './LockerMapInner'

export interface SelectedLocker {
  id: string
  name: string
  address: string
}

interface RouteInfo {
  distanceKm: number
  durationMin: number
  toLocker: SelectedLocker
}

interface Props {
  suburb?: string
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
    <div className="h-[360px] bg-[#f4f4f4] flex flex-col items-center justify-center gap-2">
      <Loader2 size={22} className="animate-spin text-[#BE1E2D]" />
      <p className="text-xs text-[#979797]">Loading map…</p>
    </div>
  ),
})

// Nearest locker to a given point (straight-line, good enough for routing target selection)
function nearestLocker(lockers: LockerMapLocker[], pos: LatLng): LockerMapLocker {
  return lockers.reduce((best, l) => {
    const d = Math.hypot(l.lat - pos.lat, l.lng - pos.lng)
    const bd = Math.hypot(best.lat - pos.lat, best.lng - pos.lng)
    return d < bd ? l : best
  })
}

export default function LockerMapPicker({
  suburb, city, selectedId, selectedName, selectedAddress, onSelect,
}: Props) {
  const [lockers, setLockers] = useState<LockerMapLocker[]>([])
  const [center, setCenter] = useState<LatLng>({ lat: -26.2041, lng: 28.0473 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [userPos, setUserPos] = useState<LatLng | null>(null)
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([])
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null)
  const [routing, setRouting] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    const params = new URLSearchParams()
    if (suburb) params.set('suburb', suburb)
    if (city) params.set('city', city)

    fetch(`/api/lockers/nearby?${params.toString()}`)
      .then(r => r.json() as Promise<{ lockers: LockerMapLocker[]; center: LatLng }>)
      .then(data => {
        setLockers(data.lockers ?? [])
        if (data.center?.lat) setCenter(data.center)
        setLoading(false)
      })
      .catch(() => { setError(true); setLoading(false) })
  }, [suburb, city])

  const fetchRoute = useCallback(async (from: LatLng, target: LockerMapLocker) => {
    setRouting(true)
    setRouteCoords([])
    setRouteInfo(null)
    try {
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${target.lng},${target.lat}?overview=full&geometries=geojson`
      )
      const json = await res.json() as {
        routes: Array<{
          distance: number
          duration: number
          geometry: { coordinates: [number, number][] }
        }>
      }
      if (json.routes?.[0]) {
        const route = json.routes[0]
        // OSRM returns [lng, lat] — Leaflet needs [lat, lng]
        setRouteCoords(route.geometry.coordinates.map(([lng, lat]) => [lat, lng]))
        setRouteInfo({
          distanceKm: route.distance / 1000,
          durationMin: Math.round(route.duration / 60),
          toLocker: { id: target.id, name: target.name, address: target.address },
        })
      }
    } catch {
      // Silently fail — map still usable without the route overlay
    } finally {
      setRouting(false)
    }
  }, [])

  const handleMapClick = useCallback((pos: LatLng) => {
    if (lockers.length === 0) return
    setUserPos(pos)
    // Route to the selected locker if one is chosen, otherwise route to the nearest
    const target = selectedId
      ? lockers.find(l => l.id === selectedId) ?? nearestLocker(lockers, pos)
      : nearestLocker(lockers, pos)
    fetchRoute(pos, target)
  }, [lockers, selectedId, fetchRoute])

  // Re-calculate route when the selected locker changes (if user already placed a pin)
  useEffect(() => {
    if (!userPos || lockers.length === 0) return
    const target = selectedId
      ? lockers.find(l => l.id === selectedId) ?? nearestLocker(lockers, userPos)
      : nearestLocker(lockers, userPos)
    fetchRoute(userPos, target)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  const clearRoute = () => {
    setUserPos(null)
    setRouteCoords([])
    setRouteInfo(null)
  }

  if (loading) {
    return (
      <div className="rounded-xl overflow-hidden border border-[#dedede]">
        <div className="h-[360px] bg-[#f4f4f4] flex flex-col items-center justify-center gap-2">
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
        <div className="flex items-center justify-between bg-[#fde8ea] border border-[#BE1E2D]/20 rounded-xl px-4 py-2.5">
          <div className="flex items-center gap-2 text-[#BE1E2D] text-sm min-w-0">
            <LocateFixed size={14} strokeWidth={2.5} className="shrink-0" />
            <span className="font-semibold truncate">{selectedName}</span>
            {selectedAddress && (
              <span className="text-[#BE1E2D]/60 text-xs hidden sm:inline truncate">
                · {selectedAddress}
              </span>
            )}
          </div>
          <button type="button" onClick={() => onSelect(null)} className="text-[#979797] hover:text-[#111] transition ml-2 shrink-0">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Directions result chip */}
      {routing && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
          <Loader2 size={14} className="animate-spin text-blue-500 shrink-0" />
          <span className="text-blue-700 text-sm">Calculating driving directions…</span>
        </div>
      )}

      {routeInfo && !routing && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <Route size={15} className="text-blue-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-blue-800 text-sm font-semibold truncate">
                To {routeInfo.toLocker.name}
              </p>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="flex items-center gap-1 text-blue-600 text-xs">
                  <Navigation size={11} />
                  {routeInfo.distanceKm.toFixed(1)} km
                </span>
                <span className="flex items-center gap-1 text-blue-600 text-xs">
                  <Clock size={11} />
                  ~{routeInfo.durationMin} min drive
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <a
              href={`https://www.google.com/maps/dir/${userPos!.lat},${userPos!.lng}/${routeInfo.toLocker.address.replace(/ /g, '+')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-blue-600 hover:underline whitespace-nowrap"
            >
              Open in Google Maps
            </a>
            <button type="button" onClick={clearRoute} className="text-[#979797] hover:text-[#111] transition">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Leaflet map — SSR-safe via dynamic import */}
      <div className="rounded-xl overflow-hidden border border-[#dedede]">
        <MapInner
          lockers={lockers}
          center={center}
          selectedId={selectedId}
          userPos={userPos}
          routeCoords={routeCoords}
          onSelect={onSelect}
          onMapClick={handleMapClick}
        />
      </div>

      <p className="text-xs text-[#979797] text-center">
        {lockers.length} PUDO locker{lockers.length !== 1 ? 's' : ''} near{' '}
        {suburb ?? city ?? 'your area'} · Tap a pin to select · Click anywhere on the map for driving directions
      </p>
    </div>
  )
}
