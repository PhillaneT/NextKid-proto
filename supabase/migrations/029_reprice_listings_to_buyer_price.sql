-- Migration 029: Reprice all existing listings from seller payout → buyer gross-up price
--
-- Before this migration, price_cents stored the seller's asking price (e.g. R280).
-- Going forward, price_cents stores the buyer gross-up price (e.g. R350) so listing
-- cards show what the buyer actually pays.
--
-- Gross-up formula (matches calculateBuyerPrice() in packages/shared/src/pricing.ts):
--   Step 1: seller_payout  = price_cents
--   Step 2: subtotal       = seller_payout + 2000  (+ R20 school delivery fee)
--   Step 3: after_markup   = ROUND(subtotal / 0.92) (gross up 8% NextKid markup)
--   Step 4: buyer_raw      = ROUND(after_markup / 0.975) (gross up 2.5% Stitch fee)
--   Step 5: buyer_price    = CEIL(buyer_raw / 2500) * 2500  (round UP to nearest R25)

UPDATE listings
SET price_cents = (
  CEIL(
    ROUND(
      ROUND((price_cents + 2000)::numeric / 0.92)
      / 0.975
    ) / 2500.0
  ) * 2500
)::integer
WHERE status NOT IN ('COMPLETED', 'CANCELLED', 'AUTO_CANCELLED');
