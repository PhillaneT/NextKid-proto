import { createHmac, timingSafeEqual } from 'crypto'

// ── Stitch API client ─────────────────────────────────────────────────────────
//
// Stitch is a South-African payment provider. This module handles:
//   1. OAuth2 client-credentials token (server-to-server)
//   2. Payment initiation request (LinkPay — hosted checkout)
//   3. Webhook signature verification (HMAC-SHA256)
//
// Required env vars:
//   STITCH_CLIENT_ID        — OAuth2 client ID from Stitch dashboard
//   STITCH_CLIENT_SECRET    — OAuth2 client secret from Stitch dashboard
//   STITCH_WEBHOOK_SECRET   — Webhook signing secret from Stitch dashboard
//   NEXT_PUBLIC_APP_URL     — Public base URL, e.g. https://app.nextkid.co.za

const TOKEN_URL   = 'https://secure.stitch.money/connect/token'
const GRAPHQL_URL = 'https://api.stitch.money/graphql'

// ── 1. OAuth2 token ───────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     process.env.STITCH_CLIENT_ID!,
      client_secret: process.env.STITCH_CLIENT_SECRET!,
      audience:      'https://secure.stitch.money/connect/token',
      scope:         'client_paymentrequest',
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Stitch token error ${res.status}: ${body}`)
  }
  const json = await res.json()
  if (!json.access_token) throw new Error('Stitch: no access_token in response')
  return json.access_token as string
}

// ── 2. Payment initiation request (LinkPay) ───────────────────────────────────

export type CreatePaymentRequestInput = {
  orderId:     string
  amountCents: number
  buyerName:   string
  webhookUrl:  string   // server-to-server callback (this app's /api/webhooks/stitch)
  returnUrl:   string   // browser redirect after buyer completes / cancels payment
}

export type CreatePaymentRequestResult = {
  paymentId:   string   // Stitch payment initiation request ID — stored in orders.stitch_payment_id
  redirectUrl: string   // Stitch-hosted checkout page — redirect the buyer here
}

export async function createPaymentRequest(
  opts: CreatePaymentRequestInput,
): Promise<CreatePaymentRequestResult> {
  const token  = await getAccessToken()
  const amount = (opts.amountCents / 100).toFixed(2)

  const res = await fetch(GRAPHQL_URL, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${token}`,
    },
    body: JSON.stringify({
      query: `
        mutation CreatePaymentRequest($input: ClientPaymentInitiationRequestInput!) {
          clientPaymentInitiationRequestCreate(input: $input) {
            paymentInitiationRequest { id url }
          }
        }
      `,
      variables: {
        input: {
          amount:               { quantity: amount, currency: 'ZAR' },
          payerReference:       opts.buyerName.slice(0, 20),
          merchantReference:    `NK-${opts.orderId.slice(0, 8).toUpperCase()}`,
          beneficiaryReference: 'NextKid',
          externalReference:    opts.orderId,   // used by webhook to find our order
          url:                  opts.webhookUrl,
        },
      },
    }),
  })

  if (!res.ok) throw new Error(`Stitch GraphQL HTTP error ${res.status}`)

  const json = await res.json()
  if (json.errors?.length) {
    throw new Error(`Stitch API: ${json.errors[0]?.message ?? 'unknown error'}`)
  }

  const request = json.data?.clientPaymentInitiationRequestCreate?.paymentInitiationRequest
  if (!request?.url) throw new Error('Stitch: no redirect URL in response')

  return { paymentId: request.id as string, redirectUrl: request.url as string }
}

// ── 3. Webhook signature verification ────────────────────────────────────────
//
// Stitch signs webhook bodies with HMAC-SHA256 using STITCH_WEBHOOK_SECRET.
// The signature is in the `x-stitch-signature` header as "sha256=<hex>".

export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.STITCH_WEBHOOK_SECRET
  if (!secret || !signature) return false

  try {
    const expected  = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
    const received  = signature.startsWith('sha256=') ? signature.slice(7) : signature
    const bufA = Buffer.from(expected, 'hex')
    const bufB = Buffer.from(received, 'hex')
    if (bufA.length !== bufB.length) return false
    return timingSafeEqual(bufA, bufB)
  } catch {
    return false
  }
}
