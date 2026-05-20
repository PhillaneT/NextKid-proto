-- ============================================================
-- Migration 019: School Ledger & Order Status Log
--
-- school_ledger  — tracks per-admin earnings from processing waybills
-- order_status_log — immutable audit trail of every order status change
-- ============================================================


-- ── 1. order_status_log — append-only, never update or delete ─────────────

CREATE TABLE IF NOT EXISTS order_status_log (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid        NOT NULL REFERENCES orders(id),
  status              text        NOT NULL,
  changed_at          timestamptz NOT NULL DEFAULT now(),
  changed_by_user_id  uuid        REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_order_status_log_order ON order_status_log(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_log_at    ON order_status_log(changed_at DESC);


-- ── 2. school_ledger — R10 credit per waybill processed by each admin ─────
-- Admin earns a small fee for each drop-off confirmed or collection completed.
-- amount_cents defaults to 1000 (R10). Praesignis can configure per school.

CREATE TABLE IF NOT EXISTS school_ledger (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    text        NOT NULL REFERENCES schools(id),
  order_id     uuid        NOT NULL REFERENCES orders(id),
  admin_id     uuid        NOT NULL REFERENCES auth.users(id),
  event_type   text        NOT NULL CHECK (event_type IN ('dropoff', 'collection')),
  amount_cents integer     NOT NULL DEFAULT 1000,  -- R10 per event
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_school_ledger_order_event
  ON school_ledger(order_id, event_type); -- one entry per event type per order

CREATE INDEX IF NOT EXISTS idx_school_ledger_school ON school_ledger(school_id);
CREATE INDEX IF NOT EXISTS idx_school_ledger_admin  ON school_ledger(admin_id);


-- ── 3. RLS ────────────────────────────────────────────────────────────────

ALTER TABLE order_status_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_ledger     ENABLE ROW LEVEL SECURITY;

-- Status log: only admins and super_admins can read
CREATE POLICY "Admins read order_status_log" ON order_status_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
    OR
    EXISTS (
      SELECT 1 FROM school_admins WHERE user_id = auth.uid() AND active = true
    )
  );

-- Ledger: admin sees their own entries; super_admin sees all
CREATE POLICY "Admin sees own ledger" ON school_ledger FOR SELECT
  USING (admin_id = auth.uid());

CREATE POLICY "Super admin sees all ledger" ON school_ledger FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );
