-- Migration 012 — Gauteng suburbs for cities missing from seed
-- Adds suburbs for Pretoria North, Pretoria East, and other Gauteng cities
-- Safe to re-run: uses ON CONFLICT DO NOTHING

-- ── Pretoria North ────────────────────────────────────────────
insert into suburbs (id, name, city_id, city_name, province_code, postal_code) values
  ('suburb_pta_n_wonderboom',   'Wonderboom',    'city_pta', 'Pretoria', 'Gauteng', '0084'),
  ('suburb_pta_n_montana',      'Montana',       'city_pta', 'Pretoria', 'Gauteng', '0182'),
  ('suburb_pta_n_karenpark',    'Karenpark',     'city_pta', 'Pretoria', 'Gauteng', '0182'),
  ('suburb_pta_n_akasia',       'Akasia',        'city_pta', 'Pretoria', 'Gauteng', '0182'),
  ('suburb_pta_n_berea_park',   'Berea Park',    'city_pta', 'Pretoria', 'Gauteng', '0082'),
  ('suburb_pta_n_rosslyn',      'Rosslyn',       'city_pta', 'Pretoria', 'Gauteng', '0200'),
  ('suburb_pta_n_pretoria_n',   'Pretoria North','city_pta', 'Pretoria', 'Gauteng', '0182')
on conflict (id) do nothing;

-- ── Pretoria East ─────────────────────────────────────────────
insert into suburbs (id, name, city_id, city_name, province_code, postal_code) values
  ('suburb_pta_e_lynnwood',     'Lynnwood',      'city_pta', 'Pretoria', 'Gauteng', '0081'),
  ('suburb_pta_e_menlyn',       'Menlyn',        'city_pta', 'Pretoria', 'Gauteng', '0063'),
  ('suburb_pta_e_garsfontein',  'Garsfontein',   'city_pta', 'Pretoria', 'Gauteng', '0042'),
  ('suburb_pta_e_moreleta',     'Moreleta Park', 'city_pta', 'Pretoria', 'Gauteng', '0044'),
  ('suburb_pta_e_faerie_glen',  'Faerie Glen',   'city_pta', 'Pretoria', 'Gauteng', '0043'),
  ('suburb_pta_e_silverton',    'Silverton',     'city_pta', 'Pretoria', 'Gauteng', '0184'),
  ('suburb_pta_e_pretoria_e',   'Pretoria East', 'city_pta', 'Pretoria', 'Gauteng', '0028'),
  ('suburb_pta_e_equestria',    'Equestria',     'city_pta', 'Pretoria', 'Gauteng', '0184'),
  ('suburb_pta_e_wapadrand',    'Wapadrand',     'city_pta', 'Pretoria', 'Gauteng', '0050')
on conflict (id) do nothing;

-- ── Pretoria West ─────────────────────────────────────────────
insert into suburbs (id, name, city_id, city_name, province_code, postal_code) values
  ('suburb_pta_w_pretoria_w',   'Pretoria West', 'city_pta', 'Pretoria', 'Gauteng', '0183'),
  ('suburb_pta_w_daspoort',     'Daspoort',      'city_pta', 'Pretoria', 'Gauteng', '0182'),
  ('suburb_pta_w_pretoria_gar', 'Pretoria Gardens','city_pta','Pretoria','Gauteng', '0183')
on conflict (id) do nothing;

-- ── Centurion ─────────────────────────────────────────────────
insert into suburbs (id, name, city_id, city_name, province_code, postal_code) values
  ('suburb_cen_centurion',      'Centurion',     'city_centurion', 'Centurion', 'Gauteng', '0157'),
  ('suburb_cen_lyttelton',      'Lyttelton',     'city_centurion', 'Centurion', 'Gauteng', '0157'),
  ('suburb_cen_rooihuiskraal',  'Rooihuiskraal', 'city_centurion', 'Centurion', 'Gauteng', '0154'),
  ('suburb_cen_highveld',       'Highveld',      'city_centurion', 'Centurion', 'Gauteng', '0169'),
  ('suburb_cen_irene',          'Irene',         'city_centurion', 'Centurion', 'Gauteng', '0157'),
  ('suburb_cen_wierda_park',    'Wierda Park',   'city_centurion', 'Centurion', 'Gauteng', '0157'),
  ('suburb_cen_eldoraigne',     'Eldoraigne',    'city_centurion', 'Centurion', 'Gauteng', '0157')
on conflict (id) do nothing;

-- ── Midrand ───────────────────────────────────────────────────
insert into suburbs (id, name, city_id, city_name, province_code, postal_code) values
  ('suburb_mid_midrand',        'Midrand',       'city_midrand', 'Midrand', 'Gauteng', '1685'),
  ('suburb_mid_halfway_house',  'Halfway House', 'city_midrand', 'Midrand', 'Gauteng', '1685'),
  ('suburb_mid_kyalami',        'Kyalami',       'city_midrand', 'Midrand', 'Gauteng', '1684'),
  ('suburb_mid_vorna_valley',   'Vorna Valley',  'city_midrand', 'Midrand', 'Gauteng', '1686'),
  ('suburb_mid_sunninghill',    'Sunninghill',   'city_midrand', 'Midrand', 'Gauteng', '2157')
on conflict (id) do nothing;

-- ── Randburg ──────────────────────────────────────────────────
insert into suburbs (id, name, city_id, city_name, province_code, postal_code) values
  ('suburb_rb_randburg',        'Randburg',      'city_randburg', 'Randburg', 'Gauteng', '2125'),
  ('suburb_rb_ferndale',        'Ferndale',      'city_randburg', 'Randburg', 'Gauteng', '2194'),
  ('suburb_rb_northcliff',      'Northcliff',    'city_randburg', 'Randburg', 'Gauteng', '2195'),
  ('suburb_rb_linden',          'Linden',        'city_randburg', 'Randburg', 'Gauteng', '2195'),
  ('suburb_rb_robindale',       'Robindale',     'city_randburg', 'Randburg', 'Gauteng', '2194'),
  ('suburb_rb_bordeaux',        'Bordeaux',      'city_randburg', 'Randburg', 'Gauteng', '2125')
on conflict (id) do nothing;

-- ── Roodepoort ────────────────────────────────────────────────
insert into suburbs (id, name, city_id, city_name, province_code, postal_code) values
  ('suburb_rood_roodepoort',    'Roodepoort',    'city_roodepoort', 'Roodepoort', 'Gauteng', '1724'),
  ('suburb_rood_florida',       'Florida',       'city_roodepoort', 'Roodepoort', 'Gauteng', '1710'),
  ('suburb_rood_strubensvalley','Strubens Valley','city_roodepoort','Roodepoort', 'Gauteng', '1735'),
  ('suburb_rood_weltevredenpark','Weltevredenpark','city_roodepoort','Roodepoort','Gauteng','1709'),
  ('suburb_rood_wilropark',     'Wilropark',     'city_roodepoort', 'Roodepoort', 'Gauteng', '1724')
on conflict (id) do nothing;

-- ── Ekurhuleni ────────────────────────────────────────────────
insert into suburbs (id, name, city_id, city_name, province_code, postal_code) values
  ('suburb_ek_boksburg',        'Boksburg',      'city_ekurhuleni', 'Ekurhuleni', 'Gauteng', '1459'),
  ('suburb_ek_germiston',       'Germiston',     'city_ekurhuleni', 'Ekurhuleni', 'Gauteng', '1401'),
  ('suburb_ek_springs',         'Springs',       'city_ekurhuleni', 'Ekurhuleni', 'Gauteng', '1559'),
  ('suburb_ek_kempton_park',    'Kempton Park',  'city_ekurhuleni', 'Ekurhuleni', 'Gauteng', '1619'),
  ('suburb_ek_alberton',        'Alberton',      'city_ekurhuleni', 'Ekurhuleni', 'Gauteng', '1449'),
  ('suburb_ek_brakpan',         'Brakpan',       'city_ekurhuleni', 'Ekurhuleni', 'Gauteng', '1540')
on conflict (id) do nothing;
