'use client'

// RULE: This file must ONLY be imported via dynamic() with { ssr: false }.
// Leaflet accesses window/document at import time and will crash Next.js SSR.

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export interface LockerMapLocker {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  distanceKm?: number
}

interface Props {
  lockers: LockerMapLocker[]
  center: { lat: number; lng: number }
  selectedId?: string
  onSelect: (locker: { id: string; name: string; address: string }) => void
}

// Custom HTML pin — avoids broken default Leaflet PNG icons in Next.js
function makePinIcon(selected: boolean) {
  const fill = selected ? '#BE1E2D' : '#ffffff'
  const stroke = selected ? '#BE1E2D' : '#666666'
  const dot = selected ? '#ffffff' : '#BE1E2D'
  return L.divIcon({
    className: '',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
      <path d="M14 0C6.27 0 0 6.27 0 14c0 9.63 14 22 14 22S28 23.63 28 14C28 6.27 21.73 0 14 0z"
        fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <circle cx="14" cy="14" r="5" fill="${dot}"/>
    </svg>`,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -38],
  })
}

// Smoothly re-centers the map when the suburb/city changes
function RecenterMap({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo([center.lat, center.lng], 13, { duration: 0.8 })
  }, [center.lat, center.lng, map])
  return null
}

export default function LockerMapInner({ lockers, center, selectedId, onSelect }: Props) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={13}
      style={{ height: '300px', width: '100%' }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <RecenterMap center={center} />
      {lockers.map(locker => (
        <Marker
          key={locker.id}
          position={[locker.lat, locker.lng]}
          icon={makePinIcon(locker.id === selectedId)}
        >
          <Popup>
            <div style={{ minWidth: '170px' }}>
              <p style={{ fontWeight: 700, margin: '0 0 3px', fontSize: '13px', color: '#111' }}>
                {locker.name}
              </p>
              <p style={{ color: '#777', margin: '0 0 5px', fontSize: '12px', lineHeight: 1.4 }}>
                {locker.address}
              </p>
              {locker.distanceKm !== undefined && (
                <p style={{ color: '#BE1E2D', margin: '0 0 8px', fontSize: '11px', fontWeight: 500 }}>
                  {locker.distanceKm.toFixed(1)} km away
                </p>
              )}
              <button
                onClick={() => onSelect({ id: locker.id, name: locker.name, address: locker.address })}
                style={{
                  background: locker.id === selectedId ? '#16a34a' : '#BE1E2D',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '7px 14px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  width: '100%',
                }}
              >
                {locker.id === selectedId ? '✓ Selected' : 'Use this locker'}
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
