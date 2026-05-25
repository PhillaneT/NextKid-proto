import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// GET  /api/children — list all active child profiles for the authenticated parent
// POST /api/children — create a new child profile (POPIA consent required)

async function resolveUser(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  if (!token) return null
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data } = await anon.auth.getUser(token)
  return data.user ?? null
}

export async function GET(req: NextRequest) {
  const user = await resolveUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const server = createServerSupabaseClient()

  const { data, error } = await server
    .from('child_profiles')
    .select(`
      id, nickname, gender, dob, grade, school_id, sports, interests,
      popia_consent, created_at,
      child_sizes ( id, recorded_date, top_size, bottom_size, shoe_size, source )
    `)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .order('recorded_date', { ascending: false, referencedTable: 'child_sizes' })
    .limit(1, { referencedTable: 'child_sizes' })

  if (error) return NextResponse.json({ error: 'fetch_failed' }, { status: 500 })

  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const user = await resolveUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const { nickname, gender, dob, grade, school_id, sports, interests, popia_consent } = body

  if (!nickname || !gender || !dob) {
    return NextResponse.json({ error: 'nickname, gender, and dob are required' }, { status: 400 })
  }
  if (!['boy', 'girl', 'other'].includes(gender)) {
    return NextResponse.json({ error: 'invalid gender' }, { status: 400 })
  }
  if (!popia_consent) {
    return NextResponse.json({ error: 'popia_consent is required' }, { status: 400 })
  }

  const server = createServerSupabaseClient()

  const { data, error } = await server
    .from('child_profiles')
    .insert({
      user_id:           user.id,
      nickname:          nickname.trim(),
      gender,
      dob,
      grade:             grade   ?? null,
      school_id:         school_id ?? null,
      sports:            sports    ?? [],
      interests:         interests ?? [],
      popia_consent:     true,
      popia_consented_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'create_failed', detail: error.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}
