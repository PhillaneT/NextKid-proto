-- ============================================================
-- Migration 009 — Cities for all 9 SA provinces
-- Run in Supabase SQL Editor
-- Safe to re-run: uses ON CONFLICT DO NOTHING
-- ============================================================

-- ── WESTERN CAPE ─────────────────────────────────────────────
insert into cities (id, name, province_code, latitude, longitude) values
  ('city_cpt',         'Cape Town',       'Western Cape', -33.9249, 18.4241),
  ('city_stellenbosch','Stellenbosch',    'Western Cape', -33.9321, 18.8602),
  ('city_paarl',       'Paarl',           'Western Cape', -33.7323, 18.9622),
  ('city_george',      'George',          'Western Cape', -33.9646, 22.4617),
  ('city_knysna',      'Knysna',          'Western Cape', -34.0359, 23.0474),
  ('city_worcester',   'Worcester',       'Western Cape', -33.6461, 19.4483),
  ('city_hermanus',    'Hermanus',        'Western Cape', -34.4187, 19.2345),
  ('city_bellville',   'Bellville',       'Western Cape', -33.8994, 18.6273),
  ('city_somerset_west','Somerset West',  'Western Cape', -34.0842, 18.8467)
on conflict (id) do nothing;

-- ── EASTERN CAPE ─────────────────────────────────────────────
insert into cities (id, name, province_code, latitude, longitude) values
  ('city_gqeberha',    'Gqeberha',        'Eastern Cape', -33.9608, 25.6022),
  ('city_east_london', 'East London',     'Eastern Cape', -33.0292, 27.8546),
  ('city_makhanda',    'Makhanda',        'Eastern Cape', -33.3048, 26.5246),
  ('city_queenstown',  'Queenstown',      'Eastern Cape', -31.8973, 26.8714),
  ('city_king_williams_town','King William''s Town','Eastern Cape',-32.8783,27.3984),
  ('city_mthatha',     'Mthatha',         'Eastern Cape', -31.5892, 28.7844),
  ('city_uitenhage',   'Uitenhage',       'Eastern Cape', -33.7633, 25.3964),
  ('city_jeffreys_bay','Jeffreys Bay',    'Eastern Cape', -34.0529, 24.9261)
on conflict (id) do nothing;

-- ── KWAZULU-NATAL ─────────────────────────────────────────────
insert into cities (id, name, province_code, latitude, longitude) values
  ('city_durban',      'Durban',          'KwaZulu-Natal', -29.8587, 31.0218),
  ('city_pmb',         'Pietermaritzburg','KwaZulu-Natal', -29.6006, 30.3794),
  ('city_newcastle_kzn','Newcastle',      'KwaZulu-Natal', -27.7573, 29.9317),
  ('city_richards_bay','Richards Bay',    'KwaZulu-Natal', -28.7833, 32.0423),
  ('city_ladysmith',   'Ladysmith',       'KwaZulu-Natal', -28.5599, 29.7797),
  ('city_pinetown',    'Pinetown',        'KwaZulu-Natal', -29.8166, 30.8635),
  ('city_umlazi',      'Umlazi',          'KwaZulu-Natal', -29.9666, 30.9010),
  ('city_ballito',     'Ballito',         'KwaZulu-Natal', -29.5396, 31.2134),
  ('city_umhlanga',    'Umhlanga',        'KwaZulu-Natal', -29.7245, 31.0805)
on conflict (id) do nothing;

-- ── LIMPOPO ──────────────────────────────────────────────────
insert into cities (id, name, province_code, latitude, longitude) values
  ('city_polokwane',   'Polokwane',       'Limpopo', -23.9045, 29.4689),
  ('city_tzaneen',     'Tzaneen',         'Limpopo', -23.8308, 30.1614),
  ('city_louis_trichardt','Louis Trichardt','Limpopo',-23.0433,29.9109),
  ('city_phalaborwa',  'Phalaborwa',      'Limpopo', -23.9355, 31.1462),
  ('city_thohoyandou', 'Thohoyandou',     'Limpopo', -22.9445, 30.4842),
  ('city_modimolle',   'Modimolle',       'Limpopo', -24.6997, 28.4083),
  ('city_lephalale',   'Lephalale',       'Limpopo', -23.6791, 27.7143)
on conflict (id) do nothing;

-- ── MPUMALANGA ───────────────────────────────────────────────
insert into cities (id, name, province_code, latitude, longitude) values
  ('city_mbombela',    'Mbombela',        'Mpumalanga', -25.4753, 30.9694),
  ('city_emalahleni',  'eMalahleni',      'Mpumalanga', -25.8731, 29.2369),
  ('city_middelburg_mp','Middelburg',     'Mpumalanga', -25.7740, 29.4636),
  ('city_secunda',     'Secunda',         'Mpumalanga', -26.5621, 29.1867),
  ('city_standerton',  'Standerton',      'Mpumalanga', -26.9461, 29.2435),
  ('city_lydenburg',   'Lydenburg',       'Mpumalanga', -25.0952, 30.4661)
on conflict (id) do nothing;

-- ── FREE STATE ───────────────────────────────────────────────
insert into cities (id, name, province_code, latitude, longitude) values
  ('city_bloemfontein','Bloemfontein',    'Free State', -29.0852, 26.1596),
  ('city_welkom',      'Welkom',          'Free State', -27.9877, 26.7339),
  ('city_sasolburg',   'Sasolburg',       'Free State', -26.8161, 27.8285),
  ('city_kroonstad',   'Kroonstad',       'Free State', -27.6503, 27.2319),
  ('city_bethlehem_fs','Bethlehem',       'Free State', -28.2312, 28.3083),
  ('city_harrismith',  'Harrismith',      'Free State', -28.2747, 29.1248)
on conflict (id) do nothing;

-- ── NORTH WEST ───────────────────────────────────────────────
insert into cities (id, name, province_code, latitude, longitude) values
  ('city_rustenburg',  'Rustenburg',      'North West', -25.6675, 27.2421),
  ('city_mahikeng',    'Mahikeng',        'North West', -25.8570, 25.6440),
  ('city_klerksdorp',  'Klerksdorp',      'North West', -26.8644, 26.6662),
  ('city_potchefstroom','Potchefstroom',  'North West', -26.7145, 27.1025),
  ('city_brits',       'Brits',           'North West', -25.6292, 27.7776),
  ('city_stilfontein', 'Stilfontein',     'North West', -26.8440, 26.7884)
on conflict (id) do nothing;

-- ── NORTHERN CAPE ────────────────────────────────────────────
insert into cities (id, name, province_code, latitude, longitude) values
  ('city_kimberley',   'Kimberley',       'Northern Cape', -28.7282, 24.7499),
  ('city_upington',    'Upington',        'Northern Cape', -28.4478, 21.2561),
  ('city_springbok',   'Springbok',       'Northern Cape', -29.6637, 17.8866),
  ('city_de_aar',      'De Aar',          'Northern Cape', -30.6491, 24.0089),
  ('city_kuruman',     'Kuruman',         'Northern Cape', -27.4516, 23.4333)
on conflict (id) do nothing;

-- ── INDEX (catches any not already created) ───────────────────
create index if not exists idx_cities_province on cities(province_code);
