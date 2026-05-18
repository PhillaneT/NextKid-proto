-- ============================================================
-- Migration 015: Waybill + Dual QR Code System
--
-- Adds the hub-and-spoke fulfilment model:
--   Seller drops item at Klerebank → Admin scans DROP-OFF QR
--   → Item held at hub → Admin scans COLLECTION QR → Buyer collects
--   → Funds released to seller
-- ============================================================


-- ── 1. Extend orders status constraint to include hub states ──────────────────

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN (
  -- Pre-payment
  'PENDING_PAYMENT',
  'PAYMENT_HELD',

  -- Hub fulfilment flow (Klerebank model)
  'AWAITING_DROPOFF',    -- payment confirmed, seller must bring item to hub
  'ITEM_AT_HUB',         -- admin scanned DROP-OFF QR, item is at Klerebank
  'UNCOLLECTED',         -- COLLECTION QR expired, buyer didn't collect — admin flags

  -- Legacy TCG courier states (kept for items using direct shipping)
  'AWAITING_SHIPMENT_BOOKING',
  'SHIPMENT_BOOKED',
  'SHIPPED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',

  -- Terminal states
  'COMPLETED',
  'DISPUTED',
  'RESOLVED_REFUND',
  'RESOLVED_RELEASED',
  'AUTO_CANCELLED',
  'CANCELLED'
));


-- ── 2. Add hub-model timestamp columns to orders ──────────────────────────────

ALTER TABLE orders ADD COLUMN IF NOT EXISTS auto_dropoff_at  timestamptz; -- auto-cancel if seller misses
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dropped_off_at   timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS collected_at     timestamptz;


-- ── 3. Admin role on profiles ─────────────────────────────────────────────────
-- admin_verified = true is required to scan QR codes — two-factor admin check.
-- (role = 'admin' alone is not enough; the account must also be explicitly verified.)

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS admin_verified boolean NOT NULL DEFAULT false;

-- Update the role check if it exists (add 'admin' to allowed roles)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('buyer', 'seller', 'admin'));


-- ── 4. Waybills table ─────────────────────────────────────────────────────────
-- One waybill per order. The waybill_number is the human-readable reference.

CREATE TABLE IF NOT EXISTS waybills (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  waybill_number text        UNIQUE NOT NULL, -- e.g. NK-260518-AB3X7Q
  order_id       uuid        NOT NULL REFERENCES orders(id) UNIQUE,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waybills_order ON waybills(order_id);


-- ── 5. QR tokens table ────────────────────────────────────────────────────────
-- Two rows per order: one DROPOFF token (for seller) and one COLLECTION token (for buyer).
-- token_hash is SHA-256 of the full token string for fast lookup without
-- storing the plaintext token (which contains the HMAC signature).

CREATE TABLE IF NOT EXISTS qr_tokens (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid        NOT NULL REFERENCES orders(id),
  waybill_id  uuid        NOT NULL REFERENCES waybills(id),
  token_type  text        NOT NULL CHECK (token_type IN ('DROPOFF', 'COLLECTION')),
  token_raw   text        NOT NULL,        -- plaintext token (protected by RLS below)
  token_hash  text        UNIQUE NOT NULL, -- SHA-256(token_raw) for fast lookup + single-use
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,                 -- NULL = not yet used (single-use guard)
  used_by     uuid        REFERENCES profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Only one active (unused) token of each type may exist per order at a time.
-- This prevents duplicate QRs from floating around if regeneration is needed.
CREATE UNIQUE INDEX IF NOT EXISTS idx_qr_tokens_order_type_active
  ON qr_tokens(order_id, token_type)
  WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_qr_tokens_hash  ON qr_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_order ON qr_tokens(order_id);


-- ── 6. RLS policies ───────────────────────────────────────────────────────────

ALTER TABLE waybills  ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_tokens ENABLE ROW LEVEL SECURITY;

-- Waybills: buyer and seller can read their own order's waybill
CREATE POLICY "Parties can view their waybill" ON waybills FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = waybills.order_id
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

-- QR tokens: buyer and seller can read their respective token (not each other's)
CREATE POLICY "Seller can view DROPOFF token" ON qr_tokens FOR SELECT
  USING (
    token_type = 'DROPOFF'
    AND EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = qr_tokens.order_id AND o.seller_id = auth.uid()
    )
  );

CREATE POLICY "Buyer can view COLLECTION token" ON qr_tokens FOR SELECT
  USING (
    token_type = 'COLLECTION'
    AND EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = qr_tokens.order_id AND o.buyer_id = auth.uid()
    )
  );

-- Admins can read all tokens (needed for scan validation)
CREATE POLICY "Admins can view all tokens" ON qr_tokens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin' AND p.admin_verified = true
    )
  );
