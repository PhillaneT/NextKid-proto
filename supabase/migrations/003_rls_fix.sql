-- Migration 003: RLS fix
-- Fixes Supabase security alert: rls_disabled_in_public
--
-- Root cause: notifications table was created manually in the Supabase dashboard
-- without Row Level Security. Any user could read all other users' notifications.
--
-- This migration:
--   1. Formally defines the notifications table (CREATE TABLE IF NOT EXISTS — safe to re-run)
--   2. Enables RLS on notifications with appropriate policies
--   3. Re-asserts RLS on all 7 core tables as a safety net


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. NOTIFICATIONS TABLE
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists notifications (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  type         text        not null,   -- 'offer' | 'bid' | 'offer_accepted' | 'offer_declined' | 'purchase'
  message      text        not null,
  item_id      uuid        references listings(id) on delete set null,
  read         boolean     not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists idx_notifications_user   on notifications(user_id);
create index if not exists idx_notifications_unread on notifications(user_id, read) where read = false;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS POLICIES — NOTIFICATIONS
-- ─────────────────────────────────────────────────────────────────────────────

alter table notifications enable row level security;

-- RULE: Users see only their own notifications
drop policy if exists "Users can view own notifications" on notifications;
create policy "Users can view own notifications" on notifications
  for select using (auth.uid() = user_id);

-- RULE: Any authenticated user can create a notification for another user
-- Needed so sellers can notify buyers (offer accepted/declined) and
-- buyers can notify sellers (purchase intent).
drop policy if exists "Authenticated users can insert notifications" on notifications;
create policy "Authenticated users can insert notifications" on notifications
  for insert with check (auth.role() = 'authenticated');

-- RULE: Users can mark their own notifications as read
drop policy if exists "Users can update own notifications" on notifications;
create policy "Users can update own notifications" on notifications
  for update using (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RE-ASSERT RLS ON CORE TABLES (idempotent safety net)
-- Policies are already defined in 001_schema_and_seed.sql.
-- These statements are safe to re-run — they only enable the RLS flag.
-- ─────────────────────────────────────────────────────────────────────────────

alter table profiles      enable row level security;
alter table cities        enable row level security;
alter table suburbs       enable row level security;
alter table schools       enable row level security;
alter table listings      enable row level security;
alter table orders        enable row level security;
alter table order_events  enable row level security;
