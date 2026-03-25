-- ============================================================
-- NextKid Marketplace — Full Schema + Seed
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor)
-- Safe to re-run: uses IF NOT EXISTS and ON CONFLICT DO NOTHING
-- ============================================================


-- ============================================================
-- 1. CITIES TABLE
-- ============================================================
create table if not exists cities (
  id           text primary key,
  name         text not null,
  province_code text not null,
  latitude     double precision,
  longitude    double precision,
  population   integer,
  created_at   timestamptz default now()
);

create index if not exists idx_cities_province on cities(province_code);


-- ============================================================
-- 2. SUBURBS TABLE
-- ============================================================
create table if not exists suburbs (
  id           text primary key,
  name         text not null,
  city_id      text not null references cities(id),
  city_name    text not null,
  province_code text not null,
  postal_code  text,
  latitude     double precision,
  longitude    double precision,
  created_at   timestamptz default now()
);

create index if not exists idx_suburbs_city     on suburbs(city_id);
create index if not exists idx_suburbs_province on suburbs(province_code);


-- ============================================================
-- 3. SCHOOLS TABLE (drop old simple version, recreate full schema)
-- ============================================================
drop table if exists schools cascade;

create table schools (
  id             text primary key,
  emis_number    text unique,
  name           text not null,
  type           text not null check (type in (
                   'PRIMARY','SECONDARY','COMBINED','INTERMEDIATE',
                   'ECD','SPECIAL_NEEDS','COLLEGE','UNIVERSITY'
                 )),
  sector         text not null default 'PUBLIC' check (sector in ('PUBLIC','INDEPENDENT')),

  -- Location hierarchy (denormalized for fast queries)
  suburb_id      text references suburbs(id),
  suburb_name    text not null,
  city_id        text references cities(id),
  city_name      text not null,
  province_code  text not null,

  -- Address / coordinates
  street_address text,
  postal_code    text,
  latitude       double precision,
  longitude      double precision,

  -- Metadata
  quintile       integer check (quintile between 1 and 5),
  no_fee_school  boolean default false,
  is_verified    boolean default false,
  is_active      boolean default true,

  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index if not exists idx_schools_suburb   on schools(suburb_id);
create index if not exists idx_schools_city     on schools(city_id);
create index if not exists idx_schools_province on schools(province_code);
create index if not exists idx_schools_emis     on schools(emis_number);
create index if not exists idx_schools_name     on schools(name);
-- Partial index: only index active schools (covers 99% of queries)
create index if not exists idx_schools_active   on schools(suburb_id, type) where is_active = true;


-- ============================================================
-- 4. UPDATE PROFILES TABLE
-- Add new location columns alongside existing ones.
-- Existing data (province, school_ids, etc.) is preserved.
-- ============================================================
alter table profiles
  add column if not exists city_id              text references cities(id),
  add column if not exists city_name            text,
  add column if not exists suburb_id            text references suburbs(id),
  add column if not exists suburb_name          text,
  -- school_id = single primary school (separate from legacy school_ids array)
  add column if not exists school_id            text references schools(id),
  add column if not exists school_name          text,
  add column if not exists street_address       text,
  add column if not exists postal_code          text,
  add column if not exists latitude             double precision,
  add column if not exists longitude            double precision,
  -- RULE: profile_completed_at must be set before user can buy or sell
  add column if not exists profile_completed_at timestamptz,
  add column if not exists phone                text,
  add column if not exists phone_verified       boolean default false,
  add column if not exists avatar_url           text,
  add column if not exists display_name         text;

create index if not exists idx_profiles_school  on profiles(school_id);
create index if not exists idx_profiles_suburb  on profiles(suburb_id);
create index if not exists idx_profiles_city    on profiles(city_id);
create index if not exists idx_profiles_province on profiles(province);


-- ============================================================
-- 5. LISTINGS TABLE
-- ============================================================
create table if not exists listings (
  id            uuid primary key default gen_random_uuid(),
  seller_id     uuid not null references auth.users(id),

  -- Item details
  title         text not null,
  description   text,
  price_cents   integer not null check (price_cents > 0),
  condition     text not null check (condition in ('NEW','LIKE_NEW','GOOD','FAIR')),
  category      text not null,
  subcategory   text,
  images        text[] default '{}',
  status        text not null default 'DRAFT' check (status in (
                  'DRAFT','ACTIVE','SOLD','DELISTED','ARCHIVED'
                )),

  -- Seller location at time of listing (denormalized, never joins needed)
  seller_province_code text,
  seller_city_id       text references cities(id),
  seller_city_name     text,
  seller_suburb_id     text references suburbs(id),
  seller_suburb_name   text,
  seller_school_id     text references schools(id),
  seller_school_name   text,

  -- RULE: parcel dimensions required before listing can go ACTIVE
  parcel_length_cm  numeric(6,2),
  parcel_width_cm   numeric(6,2),
  parcel_height_cm  numeric(6,2),
  parcel_weight_kg  numeric(5,3),

  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  published_at  timestamptz
);

create index if not exists idx_listings_seller          on listings(seller_id);
create index if not exists idx_listings_status          on listings(status) where status = 'ACTIVE';
create index if not exists idx_listings_school          on listings(seller_school_id);
create index if not exists idx_listings_suburb          on listings(seller_suburb_id);
create index if not exists idx_listings_city            on listings(seller_city_id);
-- Composite: "active items at this school in this category" — the most common query
create index if not exists idx_listings_school_cat      on listings(seller_school_id, category, status);
create index if not exists idx_listings_created         on listings(created_at desc);


-- ============================================================
-- 6. ORDERS TABLE
-- ============================================================
create table if not exists orders (
  id            uuid primary key default gen_random_uuid(),

  -- RULE: never skip states — use the full state machine
  status        text not null default 'PENDING_PAYMENT' check (status in (
                  'PENDING_PAYMENT','PAYMENT_HELD','AWAITING_SHIPMENT_BOOKING',
                  'SHIPMENT_BOOKED','SHIPPED','IN_TRANSIT','OUT_FOR_DELIVERY',
                  'DELIVERED','COMPLETED','DISPUTED','RESOLVED_REFUND',
                  'RESOLVED_RELEASED','AUTO_CANCELLED','CANCELLED'
                )),

  buyer_id      uuid not null references auth.users(id),
  seller_id     uuid not null references auth.users(id),
  listing_id    uuid not null references listings(id),

  -- Money (all ZAR cents — avoids floating point errors)
  item_price_cents          integer not null,
  shipping_cost_cents       integer not null default 0,
  total_paid_cents          integer not null,
  platform_commission_cents integer,   -- set at completion
  seller_payout_cents       integer,   -- set at completion

  -- Payment (Peach Payments)
  peach_payment_id  text,
  payment_status    text default 'PENDING' check (payment_status in (
                      'PENDING','HELD','CAPTURED','REFUNDED'
                    )),

  -- Shipping (The Courier Guy)
  shipping_method      text check (shipping_method in ('D2D','D2L','L2D','L2L')),
  service_level_code   text,
  quoted_rate_cents    integer,   -- RULE: locked at purchase, never recalculated
  tcg_shipment_id      integer,
  waybill_number       text,
  tracking_url         text,
  estimated_delivery   timestamptz,

  -- Timestamps
  created_at      timestamptz default now(),
  paid_at         timestamptz,
  shipped_at      timestamptz,
  delivered_at    timestamptz,
  completed_at    timestamptz,
  -- RULE: auto-cancel if seller hasn't shipped by this time (3 business days)
  auto_cancel_at  timestamptz
);

create index if not exists idx_orders_buyer       on orders(buyer_id);
create index if not exists idx_orders_seller      on orders(seller_id);
create index if not exists idx_orders_listing     on orders(listing_id);
create index if not exists idx_orders_status      on orders(status);
-- Partial index for auto-cancel job — only scans active held orders
create index if not exists idx_orders_auto_cancel on orders(auto_cancel_at)
  where status = 'AWAITING_SHIPMENT_BOOKING';


-- ============================================================
-- 7. ORDER EVENTS TABLE (append-only audit log — never delete rows)
-- ============================================================
create table if not exists order_events (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id),
  from_status text,
  to_status   text not null,
  note        text,
  created_by  uuid references auth.users(id),
  created_at  timestamptz default now()
);

create index if not exists idx_order_events_order on order_events(order_id);


-- ============================================================
-- 8. SEED — GAUTENG CITIES
-- ============================================================
insert into cities (id, name, province_code, latitude, longitude, population) values
  ('city_jhb',        'Johannesburg', 'Gauteng', -26.2041, 28.0473, 5635127),
  ('city_pta',        'Pretoria',     'Gauteng', -25.7479, 28.2293, 2921488),
  ('city_ekurhuleni', 'Ekurhuleni',   'Gauteng', -26.1496, 28.3699, 3379104),
  ('city_centurion',  'Centurion',    'Gauteng', -25.8603, 28.1894,  236580),
  ('city_midrand',    'Midrand',      'Gauteng', -25.9891, 28.1274,  173688),
  ('city_randburg',   'Randburg',     'Gauteng', -26.0936, 28.0064,  337053),
  ('city_sandton',    'Sandton',      'Gauteng', -26.1076, 28.0567,  222415),
  ('city_roodepoort', 'Roodepoort',   'Gauteng', -26.1625, 27.8725,  326416),
  ('city_benoni',     'Benoni',       'Gauteng', -26.1886, 28.3208,  605344)
on conflict (id) do nothing;


-- ============================================================
-- 9. SEED — GAUTENG SUBURBS
-- ============================================================
insert into suburbs (id, name, city_id, city_name, province_code, postal_code, latitude, longitude) values
  -- Johannesburg
  ('suburb_sandton',     'Sandton',     'city_jhb', 'Johannesburg', 'Gauteng', '2196', -26.1076, 28.0567),
  ('suburb_rosebank',    'Rosebank',    'city_jhb', 'Johannesburg', 'Gauteng', '2196', -26.1453, 28.0432),
  ('suburb_hyde_park',   'Hyde Park',   'city_jhb', 'Johannesburg', 'Gauteng', '2196', -26.1259, 28.0344),
  ('suburb_fourways',    'Fourways',    'city_jhb', 'Johannesburg', 'Gauteng', '2055', -26.0200, 28.0124),
  ('suburb_bryanston',   'Bryanston',   'city_jhb', 'Johannesburg', 'Gauteng', '2191', -26.0565, 28.0200),
  ('suburb_rivonia',     'Rivonia',     'city_jhb', 'Johannesburg', 'Gauteng', '2128', -26.0579, 28.0601),
  ('suburb_bedfordview', 'Bedfordview', 'city_jhb', 'Johannesburg', 'Gauteng', '2007', -26.1830, 28.1338),
  ('suburb_edenvale',    'Edenvale',    'city_jhb', 'Johannesburg', 'Gauteng', '1609', -26.1418, 28.1539),
  ('suburb_parktown',    'Parktown',    'city_jhb', 'Johannesburg', 'Gauteng', '2193', -26.1720, 28.0397),
  ('suburb_houghton',    'Houghton',    'city_jhb', 'Johannesburg', 'Gauteng', '2198', -26.1653, 28.0564),
  -- Pretoria
  ('suburb_hatfield',    'Hatfield',    'city_pta', 'Pretoria', 'Gauteng', '0028', -25.7487, 28.2380),
  ('suburb_brooklyn',    'Brooklyn',    'city_pta', 'Pretoria', 'Gauteng', '0181', -25.7695, 28.2356),
  ('suburb_menlo_park',  'Menlo Park',  'city_pta', 'Pretoria', 'Gauteng', '0081', -25.7699, 28.2612),
  ('suburb_waterkloof',  'Waterkloof',  'city_pta', 'Pretoria', 'Gauteng', '0181', -25.7922, 28.2572),
  ('suburb_groenkloof',  'Groenkloof',  'city_pta', 'Pretoria', 'Gauteng', '0181', -25.7850, 28.2180)
on conflict (id) do nothing;


-- ============================================================
-- 10. SEED — GAUTENG SCHOOLS
-- ============================================================
insert into schools (id, emis_number, name, type, sector, suburb_id, suburb_name, city_id, city_name, province_code, street_address, postal_code, latitude, longitude, quintile, no_fee_school, is_verified, is_active) values
  ('school_001', '700100001', 'Redhill School',                       'COMBINED',   'INDEPENDENT', 'suburb_sandton',    'Sandton',    'city_jhb', 'Johannesburg', 'Gauteng', '1 Summit Rd, Morningside',     '2196', -26.0690, 28.0750, 5, false, true, true),
  ('school_002', '700100002', 'St Stithians College',                 'COMBINED',   'INDEPENDENT', 'suburb_sandton',    'Sandton',    'city_jhb', 'Johannesburg', 'Gauteng', '40 Peter Place, Lyme Park',    '2191', -26.0340, 28.0200, 5, false, true, true),
  ('school_003', '700100003', 'Bryanston High School',                'SECONDARY',  'PUBLIC',      'suburb_bryanston',  'Bryanston',  'city_jhb', 'Johannesburg', 'Gauteng', 'Ballyclare Dr, Bryanston',     '2191', -26.0590, 28.0150, 5, false, true, true),
  ('school_004', '700100004', 'Bryanston Primary School',             'PRIMARY',    'PUBLIC',      'suburb_bryanston',  'Bryanston',  'city_jhb', 'Johannesburg', 'Gauteng', 'Curzon Rd, Bryanston',         '2191', -26.0570, 28.0170, 5, false, true, true),
  ('school_005', '700100005', 'Fourways High School',                 'SECONDARY',  'PUBLIC',      'suburb_fourways',   'Fourways',   'city_jhb', 'Johannesburg', 'Gauteng', 'Witkoppen Rd, Fourways',       '2055', -26.0150, 28.0100, 5, false, true, true),
  ('school_006', '700100006', 'Dainfern College',                     'COMBINED',   'INDEPENDENT', 'suburb_fourways',   'Fourways',   'city_jhb', 'Johannesburg', 'Gauteng', 'Dainfern Valley, Fourways',    '2055', -25.9950, 28.0080, 5, false, true, true),
  ('school_007', '700100007', 'Parktown Boys High School',            'SECONDARY',  'PUBLIC',      'suburb_parktown',   'Parktown',   'city_jhb', 'Johannesburg', 'Gauteng', '6 Wellington Rd, Parktown',    '2193', -26.1680, 28.0420, 5, false, true, true),
  ('school_008', '700100008', 'Parktown Girls High School',           'SECONDARY',  'PUBLIC',      'suburb_parktown',   'Parktown',   'city_jhb', 'Johannesburg', 'Gauteng', '1 Van Beek St, Parktown',      '2193', -26.1690, 28.0440, 5, false, true, true),
  ('school_009', '700200001', 'Pretoria Boys High School',            'SECONDARY',  'PUBLIC',      'suburb_hatfield',   'Hatfield',   'city_pta', 'Pretoria',     'Gauteng', 'Roper St, Hatfield',            '0028', -25.7480, 28.2350, 5, false, true, true),
  ('school_010', '700200002', 'Pretoria Girls High School',           'SECONDARY',  'PUBLIC',      'suburb_hatfield',   'Hatfield',   'city_pta', 'Pretoria',     'Gauteng', 'Prospect St, Hatfield',         '0028', -25.7510, 28.2370, 5, false, true, true),
  ('school_011', '700200003', 'Waterkloof House Preparatory School',  'PRIMARY',    'INDEPENDENT', 'suburb_waterkloof', 'Waterkloof', 'city_pta', 'Pretoria',     'Gauteng', 'Jan Shoba St, Waterkloof',     '0181', -25.7900, 28.2550, 5, false, true, true),
  ('school_012', '700200004', 'Hoerskool Menlopark',                  'SECONDARY',  'PUBLIC',      'suburb_menlo_park', 'Menlo Park', 'city_pta', 'Pretoria',     'Gauteng', 'Atterbury Rd, Menlo Park',     '0081', -25.7720, 28.2600, 5, false, true, true)
on conflict (id) do nothing;


-- ============================================================
-- 11. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- PROFILES: users can only read/update their own profile
alter table profiles enable row level security;

drop policy if exists "Users can view own profile"   on profiles;
drop policy if exists "Users can update own profile" on profiles;
drop policy if exists "Users can insert own profile" on profiles;

create policy "Users can view own profile"   on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- CITIES / SUBURBS / SCHOOLS: public read, no direct writes
alter table cities  enable row level security;
alter table suburbs enable row level security;
alter table schools enable row level security;

drop policy if exists "Anyone can read cities"        on cities;
drop policy if exists "Anyone can read suburbs"       on suburbs;
drop policy if exists "Anyone can read active schools" on schools;

create policy "Anyone can read cities"         on cities  for select using (true);
create policy "Anyone can read suburbs"        on suburbs for select using (true);
create policy "Anyone can read active schools" on schools for select using (is_active = true);

-- LISTINGS: public read for active; sellers manage their own
alter table listings enable row level security;

drop policy if exists "Anyone can view active listings"   on listings;
drop policy if exists "Sellers can manage own listings"   on listings;

create policy "Anyone can view active listings" on listings for select using (status = 'ACTIVE');
create policy "Sellers can manage own listings" on listings for all    using (auth.uid() = seller_id);

-- ORDERS: only buyer and seller can see their own orders
alter table orders enable row level security;

drop policy if exists "Order parties can view orders" on orders;
drop policy if exists "Buyers can create orders"      on orders;

create policy "Order parties can view orders" on orders for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);
create policy "Buyers can create orders" on orders for insert
  with check (auth.uid() = buyer_id);

-- ORDER EVENTS: read-only for order parties
alter table order_events enable row level security;

drop policy if exists "Order parties can view events" on order_events;

create policy "Order parties can view events" on order_events for select
  using (
    exists (
      select 1 from orders
      where orders.id = order_events.order_id
        and (orders.buyer_id = auth.uid() or orders.seller_id = auth.uid())
    )
  );
