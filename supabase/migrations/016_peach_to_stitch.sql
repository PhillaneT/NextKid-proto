-- ============================================================
-- Migration 016: Rename Peach Payments column to Stitch
--
-- The platform switched from Peach Payments to Stitch as the
-- payment gateway. This renames the payment ID column to match.
-- ============================================================

ALTER TABLE orders RENAME COLUMN peach_payment_id TO stitch_payment_id;

-- Update the payment_status constraint values — unchanged (PENDING/HELD/CAPTURED/REFUNDED
-- are generic enough to work for Stitch without modification).

COMMENT ON COLUMN orders.stitch_payment_id IS 'Stitch payment ID returned after initiation';
