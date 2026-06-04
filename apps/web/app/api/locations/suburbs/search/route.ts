import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json([])

  const cityId = request.nextUrl.searchParams.get('cityId')?.trim()

  let query = supabase
    .from('suburbs')
    .select('id, name, city_id, city_name, province_code, postal_code')
    .ilike('name', `%${q}%`)
    .order('name')
    .limit(15)

  if (cityId) query = query.eq('city_id', cityId)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
