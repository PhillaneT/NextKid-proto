import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const cityId = request.nextUrl.searchParams.get('cityId')
  if (!cityId) {
    return NextResponse.json({ error: 'cityId query param required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('suburbs')
    .select('id, name, city_id, city_name, province_code, postal_code')
    .eq('city_id', cityId)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
