import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// GET  /api/children/[id]/sizes — full measurement history
// POST /api/children/[id]/sizes — add new measurement

async function resolveUser(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  if (!token) return null
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data } = await anon.auth.getUser(token)
  return data.user ?? null
}

async function ownsChild(server: ReturnType<typeof createServerSupabaseClient>, userId: string, childId: string) {
  const { data } = await server
    .from('child_profiles')
    .select('id')
    .eq('id', childId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .single()
  return !!data
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await resolveUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const server = createServerSupabaseClient()
  if (!(await ownsChild(server, user.id, params.id))) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const { data } = await server
    .from('child_sizes')
    .select('id, recorded_date, top_size, bottom_size, shoe_size, source, created_at')
    .eq('child_id', params.id)
    .order('recorded_date', { ascending: false })

  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await resolveUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const server = createServerSupabaseClient()
  if (!(await ownsChild(server, user.id, params.id))) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const body = await req.json()
  const { top_size, bottom_size, shoe_size, recorded_date, source } = body

  if (!top_size || !bottom_size || !shoe_size) {
    return NextResponse.json({ error: 'top_size, bottom_size, and shoe_size are required' }, { status: 400 })
  }

  const { data, error } = await server
    .from('child_sizes')
    .insert({
      child_id:      params.id,
      top_size,
      bottom_size,
      shoe_size,
      recorded_date: recorded_date ?? new Date().toISOString().split('T')[0],
      source:        source ?? 'manual',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'insert_failed' }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}
