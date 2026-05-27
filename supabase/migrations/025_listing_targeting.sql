-- ============================================================
-- Migration 025: Listing Targeting Columns & Feed Cache
--
-- Adds metadata to listings that powers the Smart Homepage:
--   size_label    — normalised size text (mirrors existing 'size' field)
--   size_numeric  — integer index in the SA clothing scale (for range queries)
--   gender_target — 'boy' | 'girl' | 'unisex' (null = unspecified)
--   sport_tag     — free-text sport label matching child profiles
--
-- user_feed_cache — one row per user, stores the full personalised feed
-- as JSONB. Expires after 1 hour; refreshed on next API call.
-- ============================================================


-- ── 1. Extend listings ────────────────────────────────────────────────────

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS size_label    text,
  ADD COLUMN IF NOT EXISTS size_numeric  integer,
  ADD COLUMN IF NOT EXISTS gender_target text CHECK (gender_target IN ('boy', 'girl', 'unisex')),
  ADD COLUMN IF NOT EXISTS sport_tag     text;

CREATE INDEX IF NOT EXISTS idx_listings_size_label    ON listings(size_label)    WHERE size_label    IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_listings_gender_target ON listings(gender_target) WHERE gender_target IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_listings_sport_tag     ON listings(sport_tag)     WHERE sport_tag     IS NOT NULL;


-- ── 2. user_feed_cache ────────────────────────────────────────────────────
-- One cache row per user. Contains the full personalised feed (all children)
-- as a single JSONB blob. Cheap to invalidate: just delete the row.

CREATE TABLE IF NOT EXISTS user_feed_cache (
  user_id      uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  feed_json    jsonb       NOT NULL DEFAULT '{}',
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL
);

-- ── 3. RLS — users only see their own cache ───────────────────────────────

ALTER TABLE user_feed_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own feed cache" ON user_feed_cache FOR ALL
  USING (user_id = auth.uid());
    
    