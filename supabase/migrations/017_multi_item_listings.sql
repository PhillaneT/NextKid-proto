-- ============================================================
-- Migration 017: Multi-Item Listings with Selective Buying
--
-- A single listing can contain multiple items. Buyers pick only
-- the items they want. Unpurchased items stay listed automatically.
-- ============================================================


-- ── 1. Extend listings table ──────────────────────────────────────────────────

ALTER TABLE listings ADD COLUMN IF NOT EXISTS is_multi_item   boolean NOT NULL DEFAULT false;
-- item_count = total items ever added; available_count = still for sale
ALTER TABLE listings ADD COLUMN IF NOT EXISTS item_count      integer NOT NULL DEFAULT 1;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS available_count integer NOT NULL DEFAULT 1;


-- ── 2. listing_items — individual sellable units inside a listing ─────────────

CREATE TABLE IF NOT EXISTS listing_items (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id   uuid        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  name         text        NOT NULL,         -- e.g. "Grey school trousers"
  price_cents  integer     NOT NULL CHECK (price_cents > 0),
  size_label   text,                         -- e.g. "Size 32", "L", "UK 6"
  -- status: available → reserved (during checkout) → sold
  status       text        NOT NULL DEFAULT 'available'
               CHECK (status IN ('available', 'reserved', 'sold')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listing_items_listing  ON listing_items(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_items_status   ON listing_items(listing_id, status);


-- ── 3. order_items — which listing_items were purchased in an order ───────────
-- RULE: price_at_purchase is locked at the time of sale — never recalculate.

CREATE TABLE IF NOT EXISTS order_items (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  listing_item_id   uuid        NOT NULL REFERENCES listing_items(id),
  price_at_purchase integer     NOT NULL,  -- cents, locked at purchase
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order   ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_item    ON order_items(listing_item_id);


-- ── 4. reservations — 15-minute hold during checkout ─────────────────────────
-- Prevents two buyers from purchasing the same item simultaneously.
-- RULE: Only one active reservation per item at a time (enforced by partial unique index).

CREATE TABLE IF NOT EXISTS reservations (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_item_id  uuid        NOT NULL REFERENCES listing_items(id) ON DELETE CASCADE,
  user_id          uuid        NOT NULL REFERENCES auth.users(id),
  expires_at       timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Only one unexpired reservation per item — prevents double-booking
CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_active
  ON reservations(listing_item_id)
  WHERE expires_at > now();

CREATE INDEX IF NOT EXISTS idx_reservations_user    ON reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_expires ON reservations(expires_at);


-- ── 5. RLS policies ───────────────────────────────────────────────────────────

ALTER TABLE listing_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations  ENABLE ROW LEVEL SECURITY;

-- listing_items: anyone can view items on active listings; seller can manage their own
CREATE POLICY "Anyone can view listing items" ON listing_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM listings l
      WHERE l.id = listing_items.listing_id AND l.status = 'ACTIVE'
    )
  );

CREATE POLICY "Seller can manage their listing items" ON listing_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM listings l
      WHERE l.id = listing_items.listing_id AND l.seller_id = auth.uid()
    )
  );

-- order_items: buyer and seller can view their own order items
CREATE POLICY "Parties can view their order items" ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

-- reservations: user can manage their own reservations
CREATE POLICY "Users manage their own reservations" ON reservations
  FOR ALL
  USING (user_id = auth.uid());
