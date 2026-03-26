-- ============================================================
-- Migration 005: Change profiles.school_ids from uuid[] to text[]
--
-- RULE: schools.id values are text slugs (e.g. 'school_011'), not UUIDs.
-- The legacy school_ids column was created as uuid[] which is incompatible.
-- We drop and recreate it as text[] with no FK constraint (multi-school
-- references are validated at the application layer via school_id text FK).
-- ============================================================

alter table profiles
  drop column if exists school_ids;

alter table profiles
  add column school_ids text[] default '{}';
