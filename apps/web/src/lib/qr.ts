/**
 * QR token generation and verification.
 *
 * Token format:  NK:DROPOFF:<base64url(JSON payload)>.<HMAC-SHA256 hex>
 *
 * Security properties:
 *  - HMAC signature prevents forgery (server secret never leaves the API)
 *  - Payload includes a nonce (UUID) so each token is unique even for the same order
 *  - Expiry is baked into the payload AND stored in the DB (belt-and-suspenders)
 *  - token_hash (SHA-256 of full token) is stored in DB — used for O(1) lookup
 *    and single-use enforcement via atomic UPDATE WHERE used_at IS NULL
 */

import { createHmac, createHash, randomUUID } from 'crypto'

// ── Types ─────────────────────────────────────────────────────────────────────

export type QrTokenType = 'DROPOFF' | 'COLLECTION'

interface QrPayload {
  t: QrTokenType // type
  o: string      // orderId
  w: string      // waybill number
  n: string      // nonce (UUID — ensures uniqueness across regenerations)
  e: number      // expiry unix timestamp (seconds)
}

export interface GeneratedQr {
  token:     string   // full token string that goes into the QR code
  hash:      string   // SHA-256(token) — stored in DB
  expiresAt: Date
}

// ── Waybill number generation ─────────────────────────────────────────────────

// Character set avoids visually ambiguous chars: I, O, 0, 1
const WAYBILL_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateWaybillNumber(): string {
  const d   = new Date()
  const yy  = String(d.getFullYear()).slice(2)
  const mm  = String(d.getMonth() + 1).padStart(2, '0')
  const dd  = String(d.getDate()).padStart(2, '0')
  let suffix = ''
  for (let i = 0; i < 6; i++) {
    suffix += WAYBILL_CHARS[Math.floor(Math.random() * WAYBILL_CHARS.length)]
  }
  return `NK-${yy}${mm}${dd}-${suffix}` // e.g. NK-260518-AB3X7Q
}

// ── Token generation ──────────────────────────────────────────────────────────

function getSecret(): string {
  const s = process.env.QR_SECRET
  if (!s) throw new Error('QR_SECRET env var is not set')
  return s
}

export function generateQrToken(
  type:          QrTokenType,
  orderId:       string,
  waybillNumber: string,
  ttlHours:      number,
): GeneratedQr {
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + ttlHours)

  const payload: QrPayload = {
    t: type,
    o: orderId,
    w: waybillNumber,
    n: randomUUID(),
    e: Math.floor(expiresAt.getTime() / 1000),
  }

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig        = createHmac('sha256', getSecret()).update(payloadB64).digest('hex')
  const token      = `NK:${type}:${payloadB64}.${sig}`
  const hash       = createHash('sha256').update(token).digest('hex')

  return { token, hash, expiresAt }
}

// ── Token verification ────────────────────────────────────────────────────────

export interface VerifiedQr {
  type:          QrTokenType
  orderId:       string
  waybillNumber: string
  hash:          string  // pre-computed so callers can do the DB lookup
}

export function verifyQrToken(raw: string): VerifiedQr | null {
  try {
    // Expect exactly 3 colon-separated segments: NK:<TYPE>:<payload.sig>
    const parts = raw.split(':')
    if (parts.length !== 3 || parts[0] !== 'NK') return null

    const type = parts[1] as QrTokenType
    if (type !== 'DROPOFF' && type !== 'COLLECTION') return null

    const rest   = parts[2]
    const dotIdx = rest.lastIndexOf('.')
    if (dotIdx === -1) return null

    const payloadB64 = rest.slice(0, dotIdx)
    const sig        = rest.slice(dotIdx + 1)

    // Verify HMAC — constant-time comparison not strictly needed here because
    // we still check the DB before actioning, but good practice
    const expectedSig = createHmac('sha256', getSecret()).update(payloadB64).digest('hex')
    if (sig !== expectedSig) return null

    const payload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8')
    ) as QrPayload

    // Check expiry baked into the token
    if (payload.e < Math.floor(Date.now() / 1000)) return null

    // Cross-check type in header matches payload
    if (payload.t !== type) return null

    const hash = createHash('sha256').update(raw).digest('hex')

    return {
      type,
      orderId:       payload.o,
      waybillNumber: payload.w,
      hash,
    }
  } catch {
    return null
  }
}

// ── TTL constants ─────────────────────────────────────────────────────────────
// RULE: seller has 3 business days (72h) to drop off.
// RULE: collection QR is valid for 14 days from when item is received.

export const DROPOFF_TTL_HOURS    = 72   // 3 business days
export const COLLECTION_TTL_HOURS = 336  // 14 days
