-- Migration 007: Seed shipping methods on existing demo listings
-- PROTOTYPE ONLY — production listings will have these set by the seller
-- during listing creation.
--
-- Rule:
--   PICKUP      = seller ships from home address (enables D2D and D2L)
--   PUDO_DROPOFF = seller drops at a PUDO locker  (enables L2D and L2L)
--
-- For demo: give all listings with parcel dims at least PICKUP so checkout works.
-- A random subset also gets PUDO_DROPOFF + a demo locker so both flows are testable.

-- 1. All active listings that have parcel dimensions → enable PICKUP (D2D)
update listings
set shipping_methods = array['PICKUP']
where status = 'ACTIVE'
  and parcel_length_cm is not null
  and parcel_width_cm  is not null
  and parcel_height_cm is not null
  and parcel_weight_kg is not null
  and (shipping_methods is null or shipping_methods = '{}');

-- 2. Give a couple of listings PUDO_DROPOFF as well so L2D / L2L can be demoed.
--    "CG23" is the Sasol Rivonia locker — change to any real locker code near you.
update listings
set shipping_methods = array['PICKUP', 'PUDO_DROPOFF'],
    pudo_locker_id   = 'CG23',
    pudo_locker_name = 'Sasol Rivonia Uplifted'
where id in (
  select id from listings
  where status = 'ACTIVE'
    and parcel_length_cm is not null
  order by created_at desc
  limit 3
);
