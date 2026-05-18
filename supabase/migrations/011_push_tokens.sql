-- Migration 011 — Expo push token storage
-- Stores the device push token so the server can send push notifications.
-- One token per user (last device wins — fine for prototype).

alter table profiles
  add column if not exists expo_push_token text;

create index if not exists idx_profiles_push_token on profiles(expo_push_token)
  where expo_push_token is not null;
