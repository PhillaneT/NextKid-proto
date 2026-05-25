import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// GET    /api/children/[id] — full child detail (sizes history + latest prediction)
// PUT    /api/children/[id] — update profile fields
// DELETE /api/children/[id] — soft delete

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

  const [profileRes, sizesRes, predictionRes] = await Promise.all([
    server
      .from('child_profiles')
      .select('id, nickname, gender, dob, grade, school_id, sports, interests, popia_consent, created_at')
      .eq('id', params.id)
      .single(),

    server
      .from('child_sizes')
      .select('id, recorded_date, top_size, bottom_size, shoe_size, source, created_at')
      .eq('child_id', params.id)
      .order('recorded_date', { ascending: false })
      .limit(10),

    server
      .from('size_predictions')
      .select('predicted_top, predicted_bottom, predicted_shoe, confidence_score, basis, created_at')
      .eq('child_id', params.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  return NextResponse.json({
    ...profileRes.data,
    sizes:      sizesRes.data ?? [],
    prediction: predictionRes.data ?? null,
  })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await resolveUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const server = createServerSupabaseClient()
  if (!(await ownsChild(server, user.id, params.id))) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const body = await req.json()
  const allowed = ['nickname', 'gender', 'dob', 'grade', 'school_id', 'sports', 'interests']
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  if (updates.nickname) updates.nickname = (updates.nickname as string).trim()

  const { data, error } = await server
    .from('child_profiles')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await resolveUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const server = createServerSupabaseClient()
  if (!(await ownsChild(server, user.id, params.id))) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  await server
    .from('child_profiles')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', params.id)

  return NextResponse.json({ success: true })
}
