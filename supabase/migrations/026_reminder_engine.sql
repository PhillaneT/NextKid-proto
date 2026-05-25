-- ============================================================
-- Migration 026: Lifecycle Reminder Engine
--
-- reminder_rules   — seeded rules for each trigger type
-- scheduled_reminders — one row per child+rule per trigger period;
--                       UNIQUE(child_id, rule_id, scheduled_for)
--                       prevents the cron from double-scheduling.
-- ============================================================


-- ── 1. reminder_rules ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reminder_rules (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type       text        NOT NULL
                                 CHECK (trigger_type IN (
                                   'growth_spurt', 'year_end',
                                   'school_transition', 'matric', 'post_school'
                                 )),
  grade_from         text,       -- 'R','1'..'12'; NULL = any grade
  grade_to           text,
  gender             text        CHECK (gender IN ('boy','girl','other')),  -- NULL = any
  message_template   text        NOT NULL,   -- supports {child} and {grade}
  timing_offset_days integer     NOT NULL DEFAULT 0,
  active             boolean     NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now()
);


-- ── 2. scheduled_reminders ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scheduled_reminders (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id      uuid        NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  rule_id       uuid        NOT NULL REFERENCES reminder_rules(id)  ON DELETE CASCADE,
  scheduled_for date        NOT NULL,
  sent_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, rule_id, scheduled_for)
);

-- Partial index — only unsent, due reminders need fast lookup
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_due
  ON scheduled_reminders(scheduled_for)
  WHERE sent_at IS NULL;


-- ── 3. RLS ────────────────────────────────────────────────────────────────

ALTER TABLE reminder_rules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reminders ENABLE ROW LEVEL SECURITY;

-- Rules are publicly readable; only super admins can mutate them
CREATE POLICY "reminder_rules public read" ON reminder_rules
  FOR SELECT USING (true);

CREATE POLICY "super admins manage reminder_rules" ON reminder_rules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- Parents manage their own children's reminders
CREATE POLICY "users manage own scheduled_reminders" ON scheduled_reminders
  FOR ALL USING (
    child_id IN (
      SELECT id FROM child_profiles
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );

CREATE POLICY "super admins manage all scheduled_reminders" ON scheduled_reminders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );


-- ── 4. Seed reminder_rules ────────────────────────────────────────────────
--
-- SA school calendar anchors used by the cron:
--   year_end        → Nov 30   (timing_offset_days before)
--   school_transition → Jan 15 next year
--   matric          → Oct 31
--   post_school     → Jan 31 next year
--   growth_spurt    → child's next birthday

INSERT INTO reminder_rules
  (trigger_type, grade_from, grade_to, gender, message_template, timing_offset_days)
VALUES
  -- 8 weeks before predicted growth spurt (birthday) — any grade, any gender
  ('growth_spurt', NULL, NULL, NULL,
   'Heads up — {child} is about to hit that growth spurt 📏 We''ve already found the next size up near you.',
   56),

  -- 60 days before Nov 30 (≈ Oct 1) — grades R through 11
  ('year_end', 'R', '11', NULL,
   'Grade {grade} is almost done! 🎒 Will the uniform still fit next year? List it now while other parents are buying.',
   60),

  -- 90 days before Jan 15 next year (≈ Oct 17) — grade 7 only
  ('school_transition', '7', '7', NULL,
   'Big move coming! 🏫 Everything Laerskool must go. List it all and let another kid benefit.',
   90),

  -- 60 days before Oct 31 (≈ Sep 1) — grade 12
  ('matric', '12', '12', NULL,
   'Last year of school gear 🎓 After matric none of this fits the plan anymore. List it and fund the gap year.',
   60),

  -- Jan 31 next year — grade 12 (post-matric alumni nudge)
  ('post_school', '12', '12', NULL,
   'School is done! 🎉 Those uniforms deserve a second life. List them today.',
   0)

ON CONFLICT DO NOTHING;
