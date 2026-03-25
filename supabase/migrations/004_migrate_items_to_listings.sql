-- Migration 004: Migrate legacy items → listings
--
-- Context: The app originally used an `items` table created before the proper
-- schema was designed. The new `listings` table has the correct structure
-- (price in cents, single description field, uppercase status/condition enums,
-- seller location snapshot, parcel dims, shipping methods).
--
-- Both tables store price in cents — items.price and listings.price_cents are
-- the same values despite the naming difference.
--
-- This migration copies all rows from items into listings.
-- items is NOT dropped here because offers, bids, likes, and notifications
-- still FK to it — those tables will be migrated separately.
--
-- Nulls handled:
--   condition NULL → defaults to 'GOOD' (safe, visible to buyer as-is)
--   description parts → merged with double newline, NULLs skipped
--   seller location fields → left NULL (not stored in items)
--   parcel dims / shipping methods → left NULL/empty (not stored in items)

INSERT INTO listings (
  seller_id,
  title,
  description,
  price_cents,
  condition,
  category,
  subcategory,
  images,
  status,
  is_school_specific,
  size,
  gender,
  grade,
  created_at,
  updated_at
)
SELECT
  -- seller_id: items.seller_id references profiles.id = auth.users.id (same UUID)
  seller_id,

  title,

  -- Merge up to 5 description parts, skipping NULLs, separated by blank line
  NULLIF(
    CONCAT_WS(
      E'\n\n',
      description_part1,
      description_part2,
      description_part3,
      description_part4,
      description_part5
    ),
    ''
  ) AS description,

  -- price in items is already in cents (same as price_cents in listings)
  price AS price_cents,

  -- Normalise condition to the listings uppercase enum
  CASE LOWER(condition)
    WHEN 'new'      THEN 'NEW'
    WHEN 'like_new' THEN 'LIKE_NEW'
    WHEN 'good'     THEN 'GOOD'
    WHEN 'fair'     THEN 'FAIR'
    WHEN 'poor'     THEN 'POOR'
    ELSE            'GOOD'   -- safe default for the 2 rows with NULL condition
  END AS condition,

  category,
  subcategory,

  COALESCE(images, '{}') AS images,

  -- Normalise status to the listings uppercase enum
  CASE LOWER(status)
    WHEN 'active'   THEN 'ACTIVE'
    WHEN 'sold'     THEN 'SOLD'
    WHEN 'delisted' THEN 'DELISTED'
    ELSE            'ARCHIVED'
  END AS status,

  is_school_specific,
  size,
  gender,
  grade,

  created_at,
  updated_at

FROM items;
