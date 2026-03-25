import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json([])

  const { data, error } = await supabase
    .from('suburbs')
    .select('id, name, city_id, city_name, province_code, postal_code')
    // Search by suburb name (partial) OR postal code (prefix)
    .or(`name.ilike.%${q}%,postal_code.ilike.${q}%`)
    .order('name')
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
