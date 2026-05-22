-- ============================================================
-- Migration 022: School Referral Programme
--
-- Every active Klerebank gets a referral code + shareable link.
-- When a referred school closes a waybill:
--   Level 1 referrer earns R2 per waybill (permanent)
--   Level 2 referrer earns R0.50 per waybill (permanent)
-- Chain capped at 2 levels to avoid MLM perception.
-- ============================================================


-- ── 1. referral_earnings — one row per waybill per referral level ─────────

CREATE TABLE IF NOT EXISTS referral_earnings (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  earning_school_id text        NOT NULL REFERENCES schools(id),  -- school that earns
  source_school_id  text        NOT NULL REFERENCES schools(id),  -- school where waybill closed
  order_id          uuid        NOT NULL REFERENCES orders(id),
  waybill_number    text,
  amount_cents      integer     NOT NULL,  -- 200 = R2 (L1), 50 = R0.50 (L2)
  level             integer     NOT NULL CHECK (level IN (1, 2)),
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Prevent double-crediting the same order at the same level for the same school
CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_earnings_unique
  ON referral_earnings(earning_school_id, order_id, level);

CREATE INDEX IF NOT EXISTS idx_referral_earnings_school ON referral_earnings(earning_school_id);
CREATE INDEX IF NOT EXISTS idx_referral_earnings_source ON referral_earnings(source_school_id);


-- ── 2. school_tiers — tier thresholds and display ────────────────────────

CREATE TABLE IF NOT EXISTS school_tiers (
  tier_name      text    PRIMARY KEY,
  min_referrals  integer NOT NULL,  -- min active direct referrals to reach this tier
  badge_emoji    text    NOT NULL,
  description    text    NOT NULL,
  bonus_rate     numeric(5,4) NOT NULL DEFAULT 0  -- reserved for future bonus logic
);

INSERT INTO school_tiers (tier_name, min_referrals, badge_emoji, description, bonus_rate) VALUES
  ('Seedling', 0,  '🌱', 'Just getting started — welcome to the network!',   0),
  ('Grove',    3,  '🌿', '3+ schools in your network. Growing nicely.',       0),
  ('Campus',  10,  '🌳', '10+ schools. You are a cornerstone of the network.',0.005),
  ('District', 25, '🏫', '25+ schools. District-level impact. Legendary.',    0.01)
ON CONFLICT (tier_name) DO NOTHING;


-- ── 3. RLS ────────────────────────────────────────────────────────────────

ALTER TABLE referral_earnings ENABLE ROW LEVEL SECURITY;

-- Schools see earnings they receive (via their admins)
CREATE POLICY "School admins see their referral earnings" ON referral_earnings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM school_admins sa
      WHERE sa.school_id = referral_earnings.earning_school_id
        AND sa.user_id   = auth.uid()
        AND sa.active    = true
    )
  );

-- Super admins see everything
CREATE POLICY "Super admins see all referral earnings" ON referral_earnings FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );
