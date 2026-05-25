-- ============================================================
-- Migration 023: School Ledger Summary, Payouts & Finance Ledger
--
-- Builds the monthly financial layer on top of school_ledger:
--   school_ledger_summary  — running monthly totals per school (direct + referral)
--   payouts                — one disbursement record per school per month
--   praesignis_finance_ledger — platform-level monthly finance snapshot
--
-- RULE: No money moves in this migration or at ledger-credit time.
--       Stitch disbursements fire only when a payout row transitions to 'processing'.
-- ============================================================


-- ── 1. Extend school_ledger with waybill and month attribution ─────────────

ALTER TABLE school_ledger ADD COLUMN IF NOT EXISTS waybill_number text;
ALTER TABLE school_ledger ADD COLUMN IF NOT EXISTS month          text; -- 'YYYY-MM'

CREATE INDEX IF NOT EXISTS idx_school_ledger_month
  ON school_ledger(school_id, month) WHERE month IS NOT NULL;


-- ── 2. school_ledger_summary — atomic monthly rollup per school ────────────
-- Updated by increment_school_ledger_summary() on every credit event.
-- direct_earnings = sum of school_ledger for this school+month
-- referral_earnings = sum of referral_earnings table for this school+month
-- grand_total = direct + referral

CREATE TABLE IF NOT EXISTS school_ledger_summary (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id                text        NOT NULL REFERENCES schools(id),
  month                    text        NOT NULL,   -- 'YYYY-MM'
  direct_earnings_cents    integer     NOT NULL DEFAULT 0,
  referral_earnings_cents  integer     NOT NULL DEFAULT 0,
  grand_total_cents        integer     NOT NULL DEFAULT 0,
  status                   text        NOT NULL DEFAULT 'accumulating'
                           CHECK (status IN ('accumulating', 'processing', 'paid')),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, month)
);

CREATE INDEX IF NOT EXISTS idx_ledger_summary_school ON school_ledger_summary(school_id);
CREATE INDEX IF NOT EXISTS idx_ledger_summary_month  ON school_ledger_summary(month);


-- ── 3. payouts — one row per school per month at payout time ──────────────

CREATE TABLE IF NOT EXISTS payouts (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id                text        NOT NULL REFERENCES schools(id),
  month                    text        NOT NULL,   -- 'YYYY-MM' e.g. '2026-05'
  amount_cents             integer     NOT NULL,
  bank_details_snapshot    jsonb       NOT NULL DEFAULT '{}',  -- snapshot of bank details at payout time
  stitch_disbursement_id   text,                               -- filled when Stitch call succeeds
  status                   text        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'held')),
  held_reason              text,                               -- reason if status='held'
  processed_at             timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, month)
);

CREATE INDEX IF NOT EXISTS idx_payouts_school ON payouts(school_id);
CREATE INDEX IF NOT EXISTS idx_payouts_month  ON payouts(month);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);


-- ── 4. praesignis_finance_ledger — platform monthly snapshot ──────────────

CREATE TABLE IF NOT EXISTS praesignis_finance_ledger (
  id                           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  month                        text        NOT NULL UNIQUE,  -- 'YYYY-MM'
  school_direct_total_cents    integer     NOT NULL DEFAULT 0,
  school_referral_total_cents  integer     NOT NULL DEFAULT 0,
  school_payout_total_cents    integer     NOT NULL DEFAULT 0,
  platform_commission_cents    integer     NOT NULL DEFAULT 0,
  school_count                 integer     NOT NULL DEFAULT 0,
  order_count                  integer     NOT NULL DEFAULT 0,
  held_school_count            integer     NOT NULL DEFAULT 0,  -- schools with no verified bank details
  status                       text        NOT NULL DEFAULT 'open'
                               CHECK (status IN ('open', 'processing', 'closed')),
  allocated_at                 timestamptz,
  created_at                   timestamptz NOT NULL DEFAULT now()
);


-- ── 5. Atomic increment function ──────────────────────────────────────────
-- Called from application code whenever a school_ledger or referral_earnings
-- row is inserted. Returns the new grand_total_cents for notification use.
--
-- SECURITY DEFINER: runs as the function owner (service role) — bypasses RLS
-- so application code using anon/user tokens can safely call this via rpc().

CREATE OR REPLACE FUNCTION increment_school_ledger_summary(
  p_school_id       text,
  p_month           text,
  p_direct_cents    integer DEFAULT 0,
  p_referral_cents  integer DEFAULT 0
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total integer;
BEGIN
  INSERT INTO school_ledger_summary
    (school_id, month, direct_earnings_cents, referral_earnings_cents, grand_total_cents)
  VALUES
    (p_school_id, p_month, p_direct_cents, p_referral_cents, p_direct_cents + p_referral_cents)
  ON CONFLICT (school_id, month) DO UPDATE SET
    direct_earnings_cents   = school_ledger_summary.direct_earnings_cents   + EXCLUDED.direct_earnings_cents,
    referral_earnings_cents = school_ledger_summary.referral_earnings_cents + EXCLUDED.referral_earnings_cents,
    grand_total_cents       = school_ledger_summary.grand_total_cents
                              + EXCLUDED.direct_earnings_cents
                              + EXCLUDED.referral_earnings_cents,
    updated_at              = now();

  SELECT grand_total_cents INTO v_total
  FROM school_ledger_summary
  WHERE school_id = p_school_id AND month = p_month;

  RETURN v_total;
END;
$$;


-- ── 6. RLS ────────────────────────────────────────────────────────────────

ALTER TABLE school_ledger_summary    ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE praesignis_finance_ledger ENABLE ROW LEVEL SECURITY;

-- Summary: school admins see their own school's data
CREATE POLICY "School admins see own summary" ON school_ledger_summary FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM school_admins sa
      WHERE sa.school_id = school_ledger_summary.school_id
        AND sa.user_id   = auth.uid()
        AND sa.active    = true
    )
  );

CREATE POLICY "Super admins see all summaries" ON school_ledger_summary FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- Payouts: school admins see their own; super admins see all
CREATE POLICY "School admins see own payouts" ON payouts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM school_admins sa
      WHERE sa.school_id = payouts.school_id
        AND sa.user_id   = auth.uid()
        AND sa.active    = true
    )
  );

CREATE POLICY "Super admins manage all payouts" ON payouts FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- Finance ledger: super admins only
CREATE POLICY "Super admins manage finance ledger" ON praesignis_finance_ledger FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );
