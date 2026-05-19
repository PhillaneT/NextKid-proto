import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const q        = request.nextUrl.searchParams.get('q')?.trim()
  const province = request.nextUrl.searchParams.get('province')?.trim()

  if (!q || q.length < 2) {
    return NextResponse.json({ error: 'q must be at least 2 characters' }, { status: 400 })
  }

  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') ?? '15'), 30)

  let query = supabase
    .from('schools')
    .select('id, name, type, sector, suburb_name, city_name, province_code')
    .eq('is_active', true)
    .ilike('name', `%${q}%`)
    .order('name')
    .limit(limit)

  if (province) query = query.eq('province_code', province)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
