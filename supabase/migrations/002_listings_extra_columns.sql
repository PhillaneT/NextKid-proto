-- ============================================================
-- NextKid — Migration 002: Add missing columns to listings
-- Run in Supabase SQL Editor after 001_schema_and_seed.sql
-- ============================================================

-- Add item-attribute columns used by the listing creation flow
alter table listings
  add column if not exists is_school_specific boolean  not null default false,
  add column if not exists size               text,
  add column if not exists gender             text      check (gender in ('boys','girls','unisex')),
  add column if not exists grade              integer,
  -- RULE: at least one shipping method required before listing goes ACTIVE
  add column if not exists shipping_methods   text[]    not null default '{}',
  add column if not exists pudo_locker_id     text,
  add column if not exists pudo_locker_name   text;

-- Fix condition constraint to include POOR (matches shared LISTING_CONDITIONS)
alter table listings drop constraint if exists listings_condition_check;
alter table listings add constraint listings_condition_check
  check (condition in ('NEW','LIKE_NEW','GOOD','FAIR','POOR'));

-- Index to filter by school-specific listings (common browse query)
create index if not exists idx_listings_school_specific
  on listings(is_school_specific, seller_school_id) where is_school_specific = true;
