-- Migration 030: Account deletions log
-- Stores anonymised deletion reasons for product analytics.
-- No PII — user_id is NOT stored (user is already deleted by the time this is written).

create table if not exists account_deletions (
  id          uuid primary key default gen_random_uuid(),
  reason      text,
  deleted_at  timestamptz not null default now()
);

alter table account_deletions enable row level security;
-- Only service role can read/write (no user policies needed)
