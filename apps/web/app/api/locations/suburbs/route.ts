import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const cityId   = request.nextUrl.searchParams.get('cityId')
  const cityName = request.nextUrl.searchParams.get('cityName')

  if (!cityId && !cityName) {
    return NextResponse.json({ error: 'cityId or cityName required' }, { status: 400 })
  }

  // Try by cityId first; if no results fall back to cityName match.
  // This handles the case where the DBE import created suburbs under a
  // different city ID than what migration 009 seeded.
  let data: unknown[] = []

  if (cityId) {
    const { data: byId } = await supabase
      .from('suburbs')
      .select('id, name, city_id, city_name, province_code, postal_code')
      .eq('city_id', cityId)
      .order('name')
    data = byId ?? []
  }

  if (data.length === 0 && cityName) {
    // Exact case-insensitive match first
    const { data: byExact } = await supabase
      .from('suburbs')
      .select('id, name, city_id, city_name, province_code, postal_code')
      .ilike('city_name', cityName)
      .order('name')
    data = byExact ?? []
  }

  if (data.length === 0 && cityName) {
    // Partial match — handles "Pretoria North" matching "PRETORIA NORTH" or vice versa
    const { data: byPartial } = await supabase
      .from('suburbs')
      .select('id, name, city_id, city_name, province_code, postal_code')
      .ilike('city_name', `%${cityName}%`)
      .order('name')
      .limit(50)
    data = byPartial ?? []
  }

  return NextResponse.json(data)
}
