import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { ageInWeeks, computePrediction, GrowthCurveRow, ChildMeasurement } from '@/lib/growth-prediction'

// GET /api/children/[id]/prediction
//
// Returns the latest persisted prediction for a child, or computes + saves a
// fresh one if none exists or if the child's sizes have been updated since the
// last prediction. Prediction is deterministic so re-computing is always safe.

async function resolveUser(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  if (!token) return null
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data } = await anon.auth.getUser(token)
  return data.user ?? null
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await resolveUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const server = createServerSupabaseClient()

  // Verify ownership and get child profile
  const { data: child } = await server
    .from('child_profiles')
    .select('id, gender, dob')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .single()

  if (!child) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const ageWeeks = ageInWeeks(child.dob)

  // Fetch curves, measurement history, and latest prediction in parallel
  const [curvesRes, sizesRes, latestPredRes] = await Promise.all([
    server
      .from('growth_curves')
      .select('age_weeks, avg_top_size, avg_bottom_size, avg_shoe_size')
      .eq('gender', child.gender)
      .order('age_weeks', { ascending: true }),

    server
      .from('child_sizes')
      .select('top_size, bottom_size, shoe_size, recorded_date')
      .eq('child_id', params.id)
      .order('recorded_date', { ascending: false }),

    server
      .from('size_predictions')
      .select('predicted_top, predicted_bottom, predicted_shoe, confidence_score, basis, created_at')
      .eq('child_id', params.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const curves  = (curvesRes.data ?? []) as GrowthCurveRow[]
  const history = (sizesRes.data ?? []) as ChildMeasurement[]
  const latest  = latestPredRes.data

  // Re-compute if: no prediction yet, or new size data was added after the last prediction
  const latestSizeDate  = history[0]?.recorded_date
  const latestPredDate  = latest?.created_at
  const needsRefresh    = !latest || (latestSizeDate && latestPredDate && latestSizeDate > latestPredDate.slice(0,10))

  if (!needsRefresh && latest) {
    return NextResponse.json({ ...latest, fresh: false })
  }

  const prediction = computePrediction(ageWeeks, curves, history)

  // Persist the new prediction (fire-and-forget on error — never block the response)
  server.from('size_predictions').insert({
    child_id:         params.id,
    prediction_date:  new Date().toISOString().split('T')[0],
    predicted_top:    prediction.predicted_top,
    predicted_bottom: prediction.predicted_bottom,
    predicted_shoe:   prediction.predicted_shoe,
    confidence_score: prediction.confidence_score,
    basis:            prediction.basis,
  }).then(() => {}).catch(() => {})

  return NextResponse.json({ ...prediction, created_at: new Date().toISOString(), fresh: true })
}
