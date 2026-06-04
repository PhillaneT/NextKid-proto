/**
 * Stitch Express payment integration
 * REST API at https://express.stitch.money
 *
 * Required env vars:
 *   STITCH_CLIENT_ID        — from Stitch Express Dashboard
 *   STITCH_CLIENT_SECRET    — from Stitch Express Dashboard
 *   STITCH_WEBHOOK_SECRET   — signing secret from Stitch Express Dashboard → Webhooks (starts with whsec_)
 *   NEXT_PUBLIC_APP_URL     — public base URL e.g. https://your-ngrok.ngrok-free.app
 */

import { createHmac, timingSafeEqual } from 'crypto'

const BASE = 'https://express.stitch.money/api/v1'

// ── 1. Get short-lived access token (expires 15 min) ─────────────────────────

async function getAccessToken(): Promise<string> {
  const res = await fetch(`${BASE}/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId:     process.env.STITCH_CLIENT_ID,
      clientSecret: process.env.STITCH_CLIENT_SECRET,
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Stitch auth error ${res.status}: ${body}`)
  }
  const json = await res.json()
  const token = json?.data?.accessToken
  if (!token) throw new Error('Stitch: no accessToken in response')
  return token as string
}

// ── 2. Create a payment link ──────────────────────────────────────────────────

export type CreatePaymentRequestInput = {
  orderId:     string
  amountCents: number
  buyerName:   string
  returnUrl:   string
  webhookUrl:  string
}

export type CreatePaymentRequestResult = {
  paymentId:   string   // payment link ID — stored in orders.stitch_payment_id
  redirectUrl: string   // Stitch-hosted payment page — redirect buyer here
}

export async function createPaymentRequest(
  opts: CreatePaymentRequestInput,
): Promise<CreatePaymentRequestResult> {
  const token = await getAccessToken()

  // Link expires in 2 hours
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()

  const res = await fetch(`${BASE}/payment-links`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${token}`,
    },
    body: JSON.stringify({
      amount:            opts.amountCents,
      payerName:         opts.buyerName,
      merchantReference: `NK-${opts.orderId.slice(0, 8).toUpperCase()}`,
      expiresAt,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Stitch payment link error ${res.status}: ${body}`)
  }

  const json = await res.json()
  const link = json?.data?.payment
  if (!link?.id || !link?.link) throw new Error('Stitch: no payment link in response')

  return {
    paymentId:   link.id   as string,
    redirectUrl: link.link as string,
  }
}

// ── 3. Webhook signature verification (Svix) ─────────────────────────────────
// Stitch Express uses Svix for webhook delivery.
// Headers: svix-id, svix-timestamp, svix-signature
// Signed message: `${svix-id}.${svix-timestamp}.${rawBody}`
// Secret format:  whsec_<base64-encoded-secret>

export function verifyWebhookSignature(
  rawBody: string,
  headers: { svixId: string | null; svixTimestamp: string | null; svixSignature: string | null }
): boolean {
  const secret = process.env.STITCH_WEBHOOK_SECRET
  if (!secret) return true  // skip verification if not configured yet

  const { svixId, svixTimestamp, svixSignature } = headers
  if (!svixId || !svixTimestamp || !svixSignature) return false

  try {
    // Decode the whsec_ secret
    const secretBytes = Buffer.from(
      secret.startsWith('whsec_') ? secret.slice(6) : secret,
      'base64'
    )
    const toSign  = `${svixId}.${svixTimestamp}.${rawBody}`
    const computed = createHmac('sha256', secretBytes).update(toSign).digest('base64')

    // svix-signature may contain multiple space-separated "v1,<sig>" values
    const signatures = svixSignature.split(' ')
    for (const sig of signatures) {
      const val = sig.startsWith('v1,') ? sig.slice(3) : sig
      const bufA = Buffer.from(computed, 'base64')
      const bufB = Buffer.from(val, 'base64')
      if (bufA.length === bufB.length && timingSafeEqual(bufA, bufB)) return true
    }
    return false
  } catch {
    return false
  }
}
