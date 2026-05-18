import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json([])
  }

  const province = request.nextUrl.searchParams.get('province')?.trim()

  let query = supabase
    .from('cities')
    .select('id, name, province_code')
    .ilike('name', `${q}%`)
    .order('name')
    .limit(10)

  if (province) query = query.eq('province_code', province)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
