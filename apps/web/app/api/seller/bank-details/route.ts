import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

async function resolveUser(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  if (!token) return null
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data } = await anon.auth.getUser(token)
  return data.user ?? null
}

// GET — fetch seller's bank details
export async function GET(req: NextRequest) {
  const user = await resolveUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const server = createServerSupabaseClient()
  const { data } = await server.from('seller_bank_details').select('*').eq('seller_id', user.id).single()
  return NextResponse.json({ bankDetails: data ?? null })
}

// POST — save/update seller's bank details
export async function POST(req: NextRequest) {
  const user = await resolveUser(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const { accountHolderName, bankName, accountNumber, branchCode, accountType } = body

  if (!accountHolderName || !bankName || !accountNumber || !branchCode) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 })
  }

  const server = createServerSupabaseClient()
  const { error } = await server.from('seller_bank_details').upsert({
    seller_id:           user.id,
    account_holder_name: accountHolderName,
    bank_name:           bankName,
    account_number:      accountNumber,
    branch_code:         branchCode,
    account_type:        accountType ?? 'cheque',
    verified:            false, // Praesignis verifies manually
    updated_at:          new Date().toISOString(),
  }, { onConflict: 'seller_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
