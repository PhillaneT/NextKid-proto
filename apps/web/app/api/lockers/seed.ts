// Real PUDO locker dataset from TCG portal (769 locations across South Africa).
// Source: TCG portal localStorage — extracted 2025-06.
// RULE: When the TCG /lockers-data API is activated, this file can be removed
//       and the fallback in nearby/route.ts updated to return an empty array.

import rawData from './locker-data.json'

export interface SeedLocker {
  id: string
  name: string
  address: string
  lat: number
  lng: number
}

type RawLocker = {
  code: string
  name: string
  address: string
  latitude: string
  longitude: string
  status?: string
  detailed_address?: { formatted_address?: string }
}

export const SEED_LOCKERS: SeedLocker[] = (rawData as RawLocker[])
  .filter(l => !l.status || l.status === 'online')
  .map(l => ({
    id: l.code,
    name: l.name,
    address: l.address || l.detailed_address?.formatted_address || '',
    lat: parseFloat(l.latitude ?? '0'),
    lng: parseFloat(l.longitude ?? '0'),
  }))
  .filter(l => l.lat !== 0 && l.lng !== 0)
