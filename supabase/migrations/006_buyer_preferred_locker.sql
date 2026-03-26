-- Migration 006: Buyer preferred PUDO locker
-- Allows buyers to save their preferred PUDO locker for deliveries.
-- When set, the checkout will show L2L/D2L quotes alongside D2D quotes.

alter table profiles
  add column if not exists preferred_locker_id   text,
  add column if not exists preferred_locker_name text,
  add column if not exists preferred_locker_address text;
