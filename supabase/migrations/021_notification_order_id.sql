-- ============================================================
-- Migration 021: Add order_id + sent_at to notifications
-- ============================================================

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sent_at  timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_notifications_order ON notifications(order_id)
  WHERE order_id IS NOT NULL;
