import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const suburbId   = request.nextUrl.searchParams.get('suburbId')
  const cityId     = request.nextUrl.searchParams.get('cityId')
  const suburbName = request.nextUrl.searchParams.get('suburbName')
  const cityName   = request.nextUrl.searchParams.get('cityName')

  if (!suburbId && !cityId && !suburbName && !cityName) {
    return NextResponse.json({ error: 'suburbId, cityId, suburbName or cityName required' }, { status: 400 })
  }

  const cols = 'id, name, type, sector, suburb_name, city_name, emis_number'
  let data: unknown[] = []

  // 1. Try exact suburb ID match
  if (suburbId) {
    const { data: byId } = await supabase
      .from('schools').select(cols).eq('is_active', true)
      .eq('suburb_id', suburbId).order('name').limit(200)
    data = byId ?? []
  }

  // 2. Fallback: suburb name match (handles DBE import ID mismatch)
  if (data.length === 0 && suburbName) {
    const { data: bySuburbName } = await supabase
      .from('schools').select(cols).eq('is_active', true)
      .ilike('suburb_name', suburbName).order('name').limit(200)
    data = bySuburbName ?? []
  }

  // 3. Try exact city ID match
  if (data.length === 0 && cityId) {
    const { data: byCityId } = await supabase
      .from('schools').select(cols).eq('is_active', true)
      .eq('city_id', cityId).order('name').limit(200)
    data = byCityId ?? []
  }

  // 4. Fallback: city name match
  if (data.length === 0 && cityName) {
    const { data: byCityName } = await supabase
      .from('schools').select(cols).eq('is_active', true)
      .ilike('city_name', cityName).order('name').limit(200)
    data = byCityName ?? []
  }

  return NextResponse.json(data)
}
