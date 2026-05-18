-- Migration 013 — Suburbs for Pretoria East and Pretoria North
-- The DBE import created these as separate cities with their own IDs.
-- City IDs follow the import script pattern: city_${slug(province)}_${slug(cityName)}

-- ── Pretoria East suburbs ─────────────────────────────────────
insert into suburbs (id, name, city_id, city_name, province_code, postal_code) values
  ('suburb_pte_lynnwood',      'Lynnwood',       'city_gauteng_pretoria_east', 'Pretoria East', 'Gauteng', '0081'),
  ('suburb_pte_menlyn',        'Menlyn',         'city_gauteng_pretoria_east', 'Pretoria East', 'Gauteng', '0063'),
  ('suburb_pte_garsfontein',   'Garsfontein',    'city_gauteng_pretoria_east', 'Pretoria East', 'Gauteng', '0042'),
  ('suburb_pte_moreleta',      'Moreleta Park',  'city_gauteng_pretoria_east', 'Pretoria East', 'Gauteng', '0044'),
  ('suburb_pte_faerie_glen',   'Faerie Glen',    'city_gauteng_pretoria_east', 'Pretoria East', 'Gauteng', '0043'),
  ('suburb_pte_silverton',     'Silverton',      'city_gauteng_pretoria_east', 'Pretoria East', 'Gauteng', '0184'),
  ('suburb_pte_equestria',     'Equestria',      'city_gauteng_pretoria_east', 'Pretoria East', 'Gauteng', '0184'),
  ('suburb_pte_wapadrand',     'Wapadrand',      'city_gauteng_pretoria_east', 'Pretoria East', 'Gauteng', '0050'),
  ('suburb_pte_waterglen',     'Waterglen',      'city_gauteng_pretoria_east', 'Pretoria East', 'Gauteng', '0048'),
  ('suburb_pte_menlopark',     'Menlo Park',     'city_gauteng_pretoria_east', 'Pretoria East', 'Gauteng', '0081')
on conflict (id) do nothing;

-- ── Pretoria North suburbs ────────────────────────────────────
insert into suburbs (id, name, city_id, city_name, province_code, postal_code) values
  ('suburb_ptn_wonderboom',    'Wonderboom',     'city_gauteng_pretoria_north', 'Pretoria North', 'Gauteng', '0084'),
  ('suburb_ptn_montana',       'Montana',        'city_gauteng_pretoria_north', 'Pretoria North', 'Gauteng', '0182'),
  ('suburb_ptn_karenpark',     'Karenpark',      'city_gauteng_pretoria_north', 'Pretoria North', 'Gauteng', '0182'),
  ('suburb_ptn_akasia',        'Akasia',         'city_gauteng_pretoria_north', 'Pretoria North', 'Gauteng', '0182'),
  ('suburb_ptn_berea_park',    'Berea Park',     'city_gauteng_pretoria_north', 'Pretoria North', 'Gauteng', '0082'),
  ('suburb_ptn_rosslyn',       'Rosslyn',        'city_gauteng_pretoria_north', 'Pretoria North', 'Gauteng', '0200'),
  ('suburb_ptn_sinoville',     'Sinoville',      'city_gauteng_pretoria_north', 'Pretoria North', 'Gauteng', '0182'),
  ('suburb_ptn_doornpoort',    'Doornpoort',     'city_gauteng_pretoria_north', 'Pretoria North', 'Gauteng', '0017'),
  ('suburb_ptn_amandasig',     'Amandasig',      'city_gauteng_pretoria_north', 'Pretoria North', 'Gauteng', '0182'),
  ('suburb_ptn_clarina',       'Clarina',        'city_gauteng_pretoria_north', 'Pretoria North', 'Gauteng', '0182')
on conflict (id) do nothing;

-- Also ensure the city records exist (in case the import created them differently)
insert into cities (id, name, province_code) values
  ('city_gauteng_pretoria_east',  'Pretoria East',  'Gauteng'),
  ('city_gauteng_pretoria_north', 'Pretoria North', 'Gauteng')
on conflict (id) do nothing;
