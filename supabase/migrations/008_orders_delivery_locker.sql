-- Migration 008: Add delivery locker columns to orders
-- Stores the buyer's chosen PUDO locker at checkout for D2L and L2L shipments.
-- The collection locker (seller's side) is already on listings.pudo_locker_id
-- and will be snapshotted to orders when TCG shipment creation is implemented.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_locker_id   text,
  ADD COLUMN IF NOT EXISTS delivery_locker_name text;

COMMENT ON COLUMN orders.delivery_locker_id   IS 'TCG terminal_id of the buyer''s chosen collection locker (D2L / L2L only)';
COMMENT ON COLUMN orders.delivery_locker_name IS 'Human name of the buyer''s collection locker — denormalised for display';
