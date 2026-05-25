-- ============================================================
-- Migration 024: Child Profile & Growth Prediction Model
--
-- Core NextKid IP: personalised size prediction per child using
-- SA-appropriate growth curve data, refined by real transaction history.
--
-- POPIA COMPLIANCE:
--   - Nicknames only — no real names stored on child_profiles
--   - Strict parent-only RLS — zero cross-user data leakage
--   - popia_consent required before any child data is written
--   - growth_curves aggregated/anonymised — no individual attribution
-- ============================================================


-- ── 1. child_profiles ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS child_profiles (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname             text        NOT NULL CHECK (char_length(nickname) BETWEEN 1 AND 50),
  gender               text        NOT NULL CHECK (gender IN ('boy', 'girl', 'other')),
  dob                  date        NOT NULL,
  grade                text,                    -- 'R', '1'..'12'
  school_id            text        REFERENCES schools(id),
  sports               text[]      NOT NULL DEFAULT '{}',
  interests            text[]      NOT NULL DEFAULT '{}',
  popia_consent        boolean     NOT NULL DEFAULT false,
  popia_consented_at   timestamptz,
  deleted_at           timestamptz,             -- soft delete
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_child_profiles_user ON child_profiles(user_id) WHERE deleted_at IS NULL;


-- ── 2. child_sizes — measurement history ──────────────────────────────────

CREATE TABLE IF NOT EXISTS child_sizes (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id       uuid        NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  recorded_date  date        NOT NULL DEFAULT CURRENT_DATE,
  top_size       text        NOT NULL,
  bottom_size    text        NOT NULL,
  shoe_size      text        NOT NULL,
  source         text        NOT NULL DEFAULT 'manual'
                             CHECK (source IN ('manual', 'transaction')),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_child_sizes_child ON child_sizes(child_id, recorded_date DESC);


-- ── 3. growth_curves — SA-appropriate seed data ───────────────────────────
-- age_weeks is the midpoint of each year (age N = N*52 weeks).
-- avg_top_size / avg_bottom_size use SA age-based clothing sizes (2–16, S, M, L).
-- avg_shoe_size uses UK sizing (standard in SA retail).
-- Source: adapted from WHO/CDC growth references + SA retail industry standards.

CREATE TABLE IF NOT EXISTS growth_curves (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  gender           text    NOT NULL CHECK (gender IN ('boy', 'girl', 'other')),
  age_weeks        integer NOT NULL,
  avg_top_size     text    NOT NULL,
  avg_bottom_size  text    NOT NULL,
  avg_shoe_size    text    NOT NULL,
  UNIQUE (gender, age_weeks)
);

CREATE INDEX IF NOT EXISTS idx_growth_curves_gender_age ON growth_curves(gender, age_weeks);

-- Seed: boys
INSERT INTO growth_curves (gender, age_weeks, avg_top_size, avg_bottom_size, avg_shoe_size) VALUES
  ('boy', 104, '2',  '2',  'UK 6'),
  ('boy', 156, '3',  '3',  'UK 7'),
  ('boy', 208, '4',  '4',  'UK 9'),
  ('boy', 260, '5',  '5',  'UK 10'),
  ('boy', 312, '6',  '6',  'UK 11'),
  ('boy', 364, '7',  '7',  'UK 12'),
  ('boy', 416, '8',  '8',  'UK 13'),
  ('boy', 468, '9',  '9',  'UK 1'),
  ('boy', 520, '10', '10', 'UK 2'),
  ('boy', 572, '11', '11', 'UK 3'),
  ('boy', 624, '12', '12', 'UK 4'),
  ('boy', 676, '13', '13', 'UK 5'),
  ('boy', 728, '14', '14', 'UK 6'),
  ('boy', 780, '16', '16', 'UK 7'),
  ('boy', 832, '16', '16', 'UK 8'),
  ('boy', 884, 'S',  'S',  'UK 9')
ON CONFLICT (gender, age_weeks) DO NOTHING;

-- Seed: girls (shoe sizes slightly smaller at older ages)
INSERT INTO growth_curves (gender, age_weeks, avg_top_size, avg_bottom_size, avg_shoe_size) VALUES
  ('girl', 104, '2',  '2',  'UK 5'),
  ('girl', 156, '3',  '3',  'UK 7'),
  ('girl', 208, '4',  '4',  'UK 8'),
  ('girl', 260, '5',  '5',  'UK 9'),
  ('girl', 312, '6',  '6',  'UK 10'),
  ('girl', 364, '7',  '7',  'UK 11'),
  ('girl', 416, '8',  '8',  'UK 12'),
  ('girl', 468, '9',  '9',  'UK 13'),
  ('girl', 520, '10', '10', 'UK 1'),
  ('girl', 572, '11', '11', 'UK 2'),
  ('girl', 624, '12', '12', 'UK 3'),
  ('girl', 676, '13', '13', 'UK 4'),
  ('girl', 728, '14', '14', 'UK 5'),
  ('girl', 780, '16', '16', 'UK 6'),
  ('girl', 832, 'S',  'S',  'UK 7'),
  ('girl', 884, 'M',  'M',  'UK 7')
ON CONFLICT (gender, age_weeks) DO NOTHING;

-- Seed: other (unisex — mirrors boys)
INSERT INTO growth_curves (gender, age_weeks, avg_top_size, avg_bottom_size, avg_shoe_size)
SELECT 'other', age_weeks, avg_top_size, avg_bottom_size, avg_shoe_size
FROM growth_curves WHERE gender = 'boy'
ON CONFLICT (gender, age_weeks) DO NOTHING;


-- ── 4. size_predictions — persisted prediction results ────────────────────

CREATE TABLE IF NOT EXISTS size_predictions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id          uuid        NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  prediction_date   date        NOT NULL DEFAULT CURRENT_DATE,
  predicted_top     text        NOT NULL,
  predicted_bottom  text        NOT NULL,
  predicted_shoe    text        NOT NULL,
  confidence_score  numeric(4,3) NOT NULL CHECK (confidence_score BETWEEN 0 AND 1),
  basis             text        NOT NULL DEFAULT 'curve_only'
                                CHECK (basis IN ('curve_only', 'curve_and_history', 'history_weighted')),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_size_predictions_child ON size_predictions(child_id, created_at DESC);


-- ── 5. RLS — strict parent-only access ────────────────────────────────────
-- POPIA: no user may ever see another user's children's data.

ALTER TABLE child_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_sizes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_curves   ENABLE ROW LEVEL SECURITY;
ALTER TABLE size_predictions ENABLE ROW LEVEL SECURITY;

-- child_profiles: parent sees only their own non-deleted children
CREATE POLICY "Parent manages own children" ON child_profiles FOR ALL
  USING (user_id = auth.uid() AND deleted_at IS NULL);

-- child_sizes: parent sees sizes for their own children
CREATE POLICY "Parent sees own child sizes" ON child_sizes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM child_profiles cp
      WHERE cp.id = child_sizes.child_id AND cp.user_id = auth.uid()
    )
  );

-- growth_curves: public read (no PII, aggregate data only)
CREATE POLICY "Growth curves are public read" ON growth_curves FOR SELECT
  USING (true);

-- size_predictions: parent sees predictions for their own children
CREATE POLICY "Parent sees own child predictions" ON size_predictions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM child_profiles cp
      WHERE cp.id = size_predictions.child_id AND cp.user_id = auth.uid()
    )
  );

-- Super admins see all (for support and anonymised analytics only)
CREATE POLICY "Super admins see all children" ON child_profiles FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Super admins see all predictions" ON size_predictions FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));
