import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const province = request.nextUrl.searchParams.get('province')
  if (!province) {
    return NextResponse.json({ error: 'province query param required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('cities')
    .select('id, name, province_code')
    .eq('province_code', province)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
