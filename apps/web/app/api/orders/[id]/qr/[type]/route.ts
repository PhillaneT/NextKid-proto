import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import QRCode from 'qrcode'

// GET /api/orders/[id]/qr/dropoff    — DROP-OFF QR for the seller
// GET /api/orders/[id]/qr/collection — COLLECTION QR for the buyer
//
// Returns: { tokenType, token, qrDataUrl, waybillNumber, expiresAt }
// qrDataUrl is a base64 PNG the client renders directly.

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; type: string }> }
) {
  const { id: orderId, type: rawType } = await params
  const tokenType = rawType.toUpperCase()

  if (tokenType !== 'DROPOFF' && tokenType !== 'COLLECTION') {
    return NextResponse.json({ error: 'invalid_type' }, { status: 400 })
  }

  // 1. Authenticate
  const bearerToken = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
  if (!bearerToken) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: userData, error: authError } = await anonClient.auth.getUser(bearerToken)
  if (authError || !userData.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const userId = userData.user.id

  const server = createServerSupabaseClient()

  // 2. Fetch order and enforce role-based access
  const { data: order, error: orderError } = await server
    .from('orders')
    .select('id, buyer_id, seller_id')
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // Seller sees DROP-OFF, buyer sees COLLECTION — no cross-access
  if (tokenType === 'DROPOFF'    && order.seller_id !== userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (tokenType === 'COLLECTION' && order.buyer_id !== userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // 3. Find the active (unused, unexpired) QR token — fetch token_raw in one query
  const { data: qrRow, error: qrError } = await server
    .from('qr_tokens')
    .select('id, token_raw, expires_at')
    .eq('order_id', orderId)
    .eq('token_type', tokenType)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (qrError || !qrRow?.token_raw) {
    return NextResponse.json({ error: 'qr_not_available' }, { status: 404 })
  }

  // 4. Fetch waybill number
  const { data: waybill } = await server
    .from('waybills')
    .select('waybill_number')
    .eq('order_id', orderId)
    .single()

  // 5. Generate QR PNG from the token string
  const qrDataUrl = await QRCode.toDataURL(qrRow.token_raw, {
    width:                300,
    margin:               2,
    color:                { dark: '#111111', light: '#FFFFFF' },
    errorCorrectionLevel: 'M',
  })

  return NextResponse.json({
    tokenType,
    token:         qrRow.token_raw,
    qrDataUrl,
    waybillNumber: waybill?.waybill_number ?? null,
    expiresAt:     qrRow.expires_at,
  })
}
