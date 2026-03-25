import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const suburbId = request.nextUrl.searchParams.get('suburbId')
  if (!suburbId) {
    return NextResponse.json({ error: 'suburbId query param required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('schools')
    .select('id, name, type, sector, suburb_name, city_name, emis_number')
    .eq('suburb_id', suburbId)
    .eq('is_active', true)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
