-- ============================================================
-- Migration 020: Same-School Delivery Detection & R20 School Fee
--
-- When buyer and seller share a school, delivery costs R20 flat:
--   R10 → NextKid platform
--   R10 → matched school's Klerebank ledger (delivery_school_id)
-- ============================================================


-- ── 1. Add delivery columns to orders ────────────────────────────────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_type       text CHECK (delivery_type IN ('school', 'courier')),
  ADD COLUMN IF NOT EXISTS delivery_school_id  text REFERENCES schools(id);

-- RULE: delivery_school_id is set at checkout and never changes after that.
-- It is the single source of truth for which school's ledger gets credited R10.
CREATE INDEX IF NOT EXISTS idx_orders_delivery_school ON orders(delivery_school_id)
  WHERE delivery_school_id IS NOT NULL;


-- ── 2. fee_config — central fee configuration (never hardcode fees) ───────

CREATE TABLE IF NOT EXISTS fee_config (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key                      text        UNIQUE NOT NULL,
  value_cents              integer     NOT NULL,
  description              text,
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- Seed default fee values
INSERT INTO fee_config (key, value_cents, description) VALUES
  ('school_delivery_fee',      2000, 'Total R20 school delivery fee charged to buyer'),
  ('school_nextkid_split',     1000, 'R10 of delivery fee that goes to NextKid'),
  ('school_klerebank_split',   1000, 'R10 of delivery fee that goes to school Klerebank ledger')
ON CONFLICT (key) DO NOTHING;


-- ── 3. Extend school_ledger to support delivery events ───────────────────

ALTER TABLE school_ledger DROP CONSTRAINT IF EXISTS school_ledger_event_type_check;
ALTER TABLE school_ledger ADD CONSTRAINT school_ledger_event_type_check
  CHECK (event_type IN ('dropoff', 'collection', 'delivery'));
