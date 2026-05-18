-- Migration 014 — Missing Gauteng suburbs
-- Fixes cities that showed 0 suburbs after migration 012 partially ran
-- Safe to re-run: ON CONFLICT DO NOTHING

-- ── Sandton ───────────────────────────────────────────────────
insert into suburbs (id, name, city_id, city_name, province_code, postal_code) values
  ('suburb_san_sandton',         'Sandton',           'city_sandton', 'Sandton', 'Gauteng', '2196'),
  ('suburb_san_morningside',     'Morningside',        'city_sandton', 'Sandton', 'Gauteng', '2057'),
  ('suburb_san_rivonia',         'Rivonia',            'city_sandton', 'Sandton', 'Gauteng', '2128'),
  ('suburb_san_paulshof',        'Paulshof',           'city_sandton', 'Sandton', 'Gauteng', '2056'),
  ('suburb_san_bryanston',       'Bryanston',          'city_sandton', 'Sandton', 'Gauteng', '2191'),
  ('suburb_san_lonehill',        'Lonehill',           'city_sandton', 'Sandton', 'Gauteng', '2062'),
  ('suburb_san_sunninghill',     'Sunninghill',        'city_sandton', 'Sandton', 'Gauteng', '2157'),
  ('suburb_san_kramerville',     'Kramerville',        'city_sandton', 'Sandton', 'Gauteng', '2196'),
  ('suburb_san_illovo',          'Illovo',             'city_sandton', 'Sandton', 'Gauteng', '2196'),
  ('suburb_san_strathavon',      'Strathavon',         'city_sandton', 'Sandton', 'Gauteng', '2196')
on conflict (id) do nothing;

-- ── Midrand ───────────────────────────────────────────────────
insert into suburbs (id, name, city_id, city_name, province_code, postal_code) values
  ('suburb_mid_midrand2',        'Midrand',            'city_midrand', 'Midrand', 'Gauteng', '1685'),
  ('suburb_mid_halfway',         'Halfway House',      'city_midrand', 'Midrand', 'Gauteng', '1685'),
  ('suburb_mid_kyalami2',        'Kyalami',            'city_midrand', 'Midrand', 'Gauteng', '1684'),
  ('suburb_mid_vorna',           'Vorna Valley',       'city_midrand', 'Midrand', 'Gauteng', '1686'),
  ('suburb_mid_sunning',         'Sunninghill',        'city_midrand', 'Midrand', 'Gauteng', '2157'),
  ('suburb_mid_noordwyk',        'Noordwyk',           'city_midrand', 'Midrand', 'Gauteng', '1687'),
  ('suburb_mid_waterfall',       'Waterfall',          'city_midrand', 'Midrand', 'Gauteng', '1685'),
  ('suburb_mid_carlswald',       'Carlswald',          'city_midrand', 'Midrand', 'Gauteng', '1684')
on conflict (id) do nothing;

-- ── Randburg ──────────────────────────────────────────────────
insert into suburbs (id, name, city_id, city_name, province_code, postal_code) values
  ('suburb_rb_randburg2',        'Randburg',           'city_randburg', 'Randburg', 'Gauteng', '2125'),
  ('suburb_rb_ferndale2',        'Ferndale',           'city_randburg', 'Randburg', 'Gauteng', '2194'),
  ('suburb_rb_northcliff2',      'Northcliff',         'city_randburg', 'Randburg', 'Gauteng', '2195'),
  ('suburb_rb_linden2',          'Linden',             'city_randburg', 'Randburg', 'Gauteng', '2195'),
  ('suburb_rb_robindale2',       'Robindale',          'city_randburg', 'Randburg', 'Gauteng', '2194'),
  ('suburb_rb_bordeaux2',        'Bordeaux',           'city_randburg', 'Randburg', 'Gauteng', '2125'),
  ('suburb_rb_malanshof',        'Malanshof',          'city_randburg', 'Randburg', 'Gauteng', '2194'),
  ('suburb_rb_blairgowrie',      'Blairgowrie',        'city_randburg', 'Randburg', 'Gauteng', '2194'),
  ('suburb_rb_radiokop',         'Radiokop',           'city_randburg', 'Randburg', 'Gauteng', '1724'),
  ('suburb_rb_sundowner',        'Sundowner',          'city_randburg', 'Randburg', 'Gauteng', '2161')
on conflict (id) do nothing;

-- ── Roodepoort ────────────────────────────────────────────────
insert into suburbs (id, name, city_id, city_name, province_code, postal_code) values
  ('suburb_rp_roodepoort2',      'Roodepoort',         'city_roodepoort', 'Roodepoort', 'Gauteng', '1724'),
  ('suburb_rp_florida2',         'Florida',            'city_roodepoort', 'Roodepoort', 'Gauteng', '1710'),
  ('suburb_rp_strubens',         'Strubens Valley',    'city_roodepoort', 'Roodepoort', 'Gauteng', '1735'),
  ('suburb_rp_weltevredenpark2', 'Weltevredenpark',    'city_roodepoort', 'Roodepoort', 'Gauteng', '1709'),
  ('suburb_rp_wilropark2',       'Wilropark',          'city_roodepoort', 'Roodepoort', 'Gauteng', '1724'),
  ('suburb_rp_helderkruin',      'Helderkruin',        'city_roodepoort', 'Roodepoort', 'Gauteng', '1733'),
  ('suburb_rp_princess',         'Princess',           'city_roodepoort', 'Roodepoort', 'Gauteng', '1724'),
  ('suburb_rp_constantia_kloof', 'Constantia Kloof',   'city_roodepoort', 'Roodepoort', 'Gauteng', '1709')
on conflict (id) do nothing;

-- ── Ekurhuleni ────────────────────────────────────────────────
insert into suburbs (id, name, city_id, city_name, province_code, postal_code) values
  ('suburb_ek_boksburg2',        'Boksburg',           'city_ekurhuleni', 'Ekurhuleni', 'Gauteng', '1459'),
  ('suburb_ek_germiston2',       'Germiston',          'city_ekurhuleni', 'Ekurhuleni', 'Gauteng', '1401'),
  ('suburb_ek_springs2',         'Springs',            'city_ekurhuleni', 'Ekurhuleni', 'Gauteng', '1559'),
  ('suburb_ek_kempton_park2',    'Kempton Park',       'city_ekurhuleni', 'Ekurhuleni', 'Gauteng', '1619'),
  ('suburb_ek_alberton2',        'Alberton',           'city_ekurhuleni', 'Ekurhuleni', 'Gauteng', '1449'),
  ('suburb_ek_brakpan2',         'Brakpan',            'city_ekurhuleni', 'Ekurhuleni', 'Gauteng', '1540'),
  ('suburb_ek_edenvale2',        'Edenvale',           'city_ekurhuleni', 'Ekurhuleni', 'Gauteng', '1609'),
  ('suburb_ek_bedfordview2',     'Bedfordview',        'city_ekurhuleni', 'Ekurhuleni', 'Gauteng', '2007'),
  ('suburb_ek_benoni2',          'Benoni',             'city_ekurhuleni', 'Ekurhuleni', 'Gauteng', '1501'),
  ('suburb_ek_daveyton',         'Daveyton',           'city_ekurhuleni', 'Ekurhuleni', 'Gauteng', '1520')
on conflict (id) do nothing;

-- ── Benoni ────────────────────────────────────────────────────
insert into suburbs (id, name, city_id, city_name, province_code, postal_code) values
  ('suburb_ben_benoni2',         'Benoni',             'city_benoni', 'Benoni', 'Gauteng', '1501'),
  ('suburb_ben_lakefield',       'Lakefield',          'city_benoni', 'Benoni', 'Gauteng', '1501'),
  ('suburb_ben_northmead',       'Northmead',          'city_benoni', 'Benoni', 'Gauteng', '1501'),
  ('suburb_ben_rynfield',        'Rynfield',           'city_benoni', 'Benoni', 'Gauteng', '1501'),
  ('suburb_ben_farrarmere',      'Farrarmere',         'city_benoni', 'Benoni', 'Gauteng', '1518'),
  ('suburb_ben_dawn_park',       'Dawn Park',          'city_benoni', 'Benoni', 'Gauteng', '1459'),
  ('suburb_ben_crystal_park',    'Crystal Park',       'city_benoni', 'Benoni', 'Gauteng', '1501')
on conflict (id) do nothing;

-- ── Pretoria extra suburbs (city_pta) ─────────────────────────
insert into suburbs (id, name, city_id, city_name, province_code, postal_code) values
  ('suburb_pta_sunnyside',       'Sunnyside',          'city_pta', 'Pretoria', 'Gauteng', '0002'),
  ('suburb_pta_arcadia',         'Arcadia',            'city_pta', 'Pretoria', 'Gauteng', '0083'),
  ('suburb_pta_capital_park',    'Capital Park',       'city_pta', 'Pretoria', 'Gauteng', '0084'),
  ('suburb_pta_silverton2',      'Silverton',          'city_pta', 'Pretoria', 'Gauteng', '0184'),
  ('suburb_pta_queenswood',      'Queenswood',         'city_pta', 'Pretoria', 'Gauteng', '0186'),
  ('suburb_pta_lynnwood2',       'Lynnwood',           'city_pta', 'Pretoria', 'Gauteng', '0081'),
  ('suburb_pta_monumentpark',    'Monument Park',      'city_pta', 'Pretoria', 'Gauteng', '0181'),
  ('suburb_pta_erasmia',         'Erasmia',            'city_pta', 'Pretoria', 'Gauteng', '0183'),
  ('suburb_pta_atteridgeville',  'Atteridgeville',     'city_pta', 'Pretoria', 'Gauteng', '0008'),
  ('suburb_pta_mamelodi',        'Mamelodi',           'city_pta', 'Pretoria', 'Gauteng', '0122')
on conflict (id) do nothing;
