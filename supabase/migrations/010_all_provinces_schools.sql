-- ============================================================
-- Migration 010 — Schools across all 9 SA provinces
-- Safe to re-run: uses ON CONFLICT DO NOTHING
-- ============================================================

-- ── WESTERN CAPE ─────────────────────────────────────────────
insert into suburbs (id, name, city_id, city_name, province_code) values
  ('suburb_cpt_cbd',       'Cape Town CBD',   'city_cpt', 'Cape Town',  'Western Cape'),
  ('suburb_claremont',     'Claremont',        'city_cpt', 'Cape Town',  'Western Cape'),
  ('suburb_rondebosch',    'Rondebosch',       'city_cpt', 'Cape Town',  'Western Cape'),
  ('suburb_paarl_central', 'Paarl Central',   'city_paarl','Paarl',     'Western Cape'),
  ('suburb_stellenbosch_c','Stellenbosch',    'city_stellenbosch','Stellenbosch','Western Cape'),
  ('suburb_george_central','George Central',  'city_george','George',   'Western Cape')
on conflict (id) do nothing;

insert into schools (id, name, type, sector, suburb_id, suburb_name, city_id, city_name, province_code, is_verified, is_active) values
  ('school_wc_001','Rondebosch Boys High School',       'SECONDARY','PUBLIC',      'suburb_rondebosch',    'Rondebosch',    'city_cpt','Cape Town','Western Cape',true,true),
  ('school_wc_002','SACS (South African College School)','SECONDARY','PUBLIC',     'suburb_rondebosch',    'Rondebosch',    'city_cpt','Cape Town','Western Cape',true,true),
  ('school_wc_003','Bishops (Diocesan College)',        'SECONDARY','INDEPENDENT', 'suburb_rondebosch',    'Rondebosch',    'city_cpt','Cape Town','Western Cape',true,true),
  ('school_wc_004','Westerford High School',            'SECONDARY','PUBLIC',      'suburb_rondebosch',    'Rondebosch',    'city_cpt','Cape Town','Western Cape',true,true),
  ('school_wc_005','Herzlia Middle & High School',      'SECONDARY','INDEPENDENT', 'suburb_claremont',     'Claremont',     'city_cpt','Cape Town','Western Cape',true,true),
  ('school_wc_006','Springfield Convent School',        'COMBINED', 'INDEPENDENT', 'suburb_claremont',     'Claremont',     'city_cpt','Cape Town','Western Cape',true,true),
  ('school_wc_007','Groote Schuur High School',         'SECONDARY','PUBLIC',      'suburb_rondebosch',    'Rondebosch',    'city_cpt','Cape Town','Western Cape',true,true),
  ('school_wc_008','Paarl Boys High School',            'SECONDARY','PUBLIC',      'suburb_paarl_central', 'Paarl Central', 'city_paarl','Paarl','Western Cape',true,true),
  ('school_wc_009','Paarl Girls High School',           'SECONDARY','PUBLIC',      'suburb_paarl_central', 'Paarl Central', 'city_paarl','Paarl','Western Cape',true,true),
  ('school_wc_010','Paul Roos Gymnasium',               'SECONDARY','PUBLIC',      'suburb_stellenbosch_c','Stellenbosch',  'city_stellenbosch','Stellenbosch','Western Cape',true,true),
  ('school_wc_011','Rhenish Girls High School',         'SECONDARY','PUBLIC',      'suburb_stellenbosch_c','Stellenbosch',  'city_stellenbosch','Stellenbosch','Western Cape',true,true),
  ('school_wc_012','George High School',                'SECONDARY','PUBLIC',      'suburb_george_central','George Central','city_george','George','Western Cape',true,true)
on conflict (id) do nothing;

-- ── EASTERN CAPE ─────────────────────────────────────────────
insert into suburbs (id, name, city_id, city_name, province_code) values
  ('suburb_gqeberha_central','Central',       'city_gqeberha','Gqeberha',  'Eastern Cape'),
  ('suburb_newton_park',     'Newton Park',   'city_gqeberha','Gqeberha',  'Eastern Cape'),
  ('suburb_el_central',      'East London Central','city_east_london','East London','Eastern Cape'),
  ('suburb_makhanda_c',      'Makhanda',      'city_makhanda','Makhanda',  'Eastern Cape')
on conflict (id) do nothing;

insert into schools (id, name, type, sector, suburb_id, suburb_name, city_id, city_name, province_code, is_verified, is_active) values
  ('school_ec_001','Grey High School',                  'SECONDARY','PUBLIC',      'suburb_gqeberha_central','Central',       'city_gqeberha','Gqeberha','Eastern Cape',true,true),
  ('school_ec_002','Collegiate Girls High School',      'SECONDARY','PUBLIC',      'suburb_gqeberha_central','Central',       'city_gqeberha','Gqeberha','Eastern Cape',true,true),
  ('school_ec_003','Pearson High School',               'SECONDARY','PUBLIC',      'suburb_newton_park',     'Newton Park',   'city_gqeberha','Gqeberha','Eastern Cape',true,true),
  ('school_ec_004','Westering High School',             'SECONDARY','PUBLIC',      'suburb_newton_park',     'Newton Park',   'city_gqeberha','Gqeberha','Eastern Cape',true,true),
  ('school_ec_005','Selborne College',                  'SECONDARY','PUBLIC',      'suburb_el_central',      'East London Central','city_east_london','East London','Eastern Cape',true,true),
  ('school_ec_006','Cambridge High School',             'SECONDARY','PUBLIC',      'suburb_el_central',      'East London Central','city_east_london','East London','Eastern Cape',true,true),
  ('school_ec_007','Clarendon Girls High School',       'SECONDARY','PUBLIC',      'suburb_el_central',      'East London Central','city_east_london','East London','Eastern Cape',true,true),
  ('school_ec_008','Victoria Girls High School',        'SECONDARY','PUBLIC',      'suburb_makhanda_c',      'Makhanda',      'city_makhanda','Makhanda','Eastern Cape',true,true),
  ('school_ec_009','Graeme College',                    'SECONDARY','PUBLIC',      'suburb_makhanda_c',      'Makhanda',      'city_makhanda','Makhanda','Eastern Cape',true,true)
on conflict (id) do nothing;

-- ── KWAZULU-NATAL ─────────────────────────────────────────────
insert into suburbs (id, name, city_id, city_name, province_code) values
  ('suburb_berea',         'Berea',            'city_durban','Durban',          'KwaZulu-Natal'),
  ('suburb_glenwood',      'Glenwood',         'city_durban','Durban',          'KwaZulu-Natal'),
  ('suburb_westville',     'Westville',        'city_durban','Durban',          'KwaZulu-Natal'),
  ('suburb_pmb_central',   'Pietermaritzburg Central','city_pmb','Pietermaritzburg','KwaZulu-Natal'),
  ('suburb_umhlanga_rocks','Umhlanga Rocks',   'city_umhlanga','Umhlanga',      'KwaZulu-Natal')
on conflict (id) do nothing;

insert into schools (id, name, type, sector, suburb_id, suburb_name, city_id, city_name, province_code, is_verified, is_active) values
  ('school_kzn_001','Kearsney College',                 'SECONDARY','INDEPENDENT','suburb_westville',      'Westville',     'city_durban','Durban','KwaZulu-Natal',true,true),
  ('school_kzn_002','Westville Boys High School',       'SECONDARY','PUBLIC',     'suburb_westville',      'Westville',     'city_durban','Durban','KwaZulu-Natal',true,true),
  ('school_kzn_003','Westville Girls High School',      'SECONDARY','PUBLIC',     'suburb_westville',      'Westville',     'city_durban','Durban','KwaZulu-Natal',true,true),
  ('school_kzn_004','Glenwood High School',             'SECONDARY','PUBLIC',     'suburb_glenwood',       'Glenwood',      'city_durban','Durban','KwaZulu-Natal',true,true),
  ('school_kzn_005','Berea Road Primary School',        'PRIMARY',  'PUBLIC',     'suburb_berea',          'Berea',         'city_durban','Durban','KwaZulu-Natal',true,true),
  ('school_kzn_006','Maritzburg College',               'SECONDARY','PUBLIC',     'suburb_pmb_central',    'Pietermaritzburg Central','city_pmb','Pietermaritzburg','KwaZulu-Natal',true,true),
  ('school_kzn_007','Epworth School',                   'SECONDARY','INDEPENDENT','suburb_pmb_central',    'Pietermaritzburg Central','city_pmb','Pietermaritzburg','KwaZulu-Natal',true,true),
  ('school_kzn_008','Durban Girls College',             'SECONDARY','INDEPENDENT','suburb_glenwood',       'Glenwood',      'city_durban','Durban','KwaZulu-Natal',true,true),
  ('school_kzn_009','Danville Park Girls High',         'SECONDARY','PUBLIC',     'suburb_westville',      'Westville',     'city_durban','Durban','KwaZulu-Natal',true,true),
  ('school_kzn_010','Crawford College Umhlanga',        'COMBINED', 'INDEPENDENT','suburb_umhlanga_rocks',  'Umhlanga Rocks','city_umhlanga','Umhlanga','KwaZulu-Natal',true,true)
on conflict (id) do nothing;

-- ── LIMPOPO ──────────────────────────────────────────────────
insert into suburbs (id, name, city_id, city_name, province_code) values
  ('suburb_polokwane_c',   'Polokwane Central','city_polokwane','Polokwane','Limpopo'),
  ('suburb_tzaneen_c',     'Tzaneen Central',  'city_tzaneen','Tzaneen',   'Limpopo')
on conflict (id) do nothing;

insert into schools (id, name, type, sector, suburb_id, suburb_name, city_id, city_name, province_code, is_verified, is_active) values
  ('school_lim_001','Pietersburg High School',          'SECONDARY','PUBLIC',     'suburb_polokwane_c','Polokwane Central','city_polokwane','Polokwane','Limpopo',true,true),
  ('school_lim_002','Capricorn High School',            'SECONDARY','PUBLIC',     'suburb_polokwane_c','Polokwane Central','city_polokwane','Polokwane','Limpopo',true,true),
  ('school_lim_003','Merensky High School',             'SECONDARY','PUBLIC',     'suburb_tzaneen_c',  'Tzaneen Central',  'city_tzaneen','Tzaneen','Limpopo',true,true),
  ('school_lim_004','Ben Vorster High School',          'SECONDARY','PUBLIC',     'suburb_tzaneen_c',  'Tzaneen Central',  'city_tzaneen','Tzaneen','Limpopo',true,true),
  ('school_lim_005','Louis Trichardt High School',      'SECONDARY','PUBLIC',     'suburb_polokwane_c','Polokwane Central','city_polokwane','Polokwane','Limpopo',true,true)
on conflict (id) do nothing;

-- ── MPUMALANGA ───────────────────────────────────────────────
insert into suburbs (id, name, city_id, city_name, province_code) values
  ('suburb_nelspruit_c',   'Nelspruit Central','city_mbombela','Mbombela',  'Mpumalanga'),
  ('suburb_emalahleni_c',  'eMalahleni Central','city_emalahleni','eMalahleni','Mpumalanga'),
  ('suburb_middelburg_c',  'Middelburg Central','city_middelburg_mp','Middelburg','Mpumalanga')
on conflict (id) do nothing;

insert into schools (id, name, type, sector, suburb_id, suburb_name, city_id, city_name, province_code, is_verified, is_active) values
  ('school_mp_001','Nelspruit High School',             'SECONDARY','PUBLIC',     'suburb_nelspruit_c', 'Nelspruit Central','city_mbombela','Mbombela','Mpumalanga',true,true),
  ('school_mp_002','Laerskool Nelspruit',               'PRIMARY',  'PUBLIC',     'suburb_nelspruit_c', 'Nelspruit Central','city_mbombela','Mbombela','Mpumalanga',true,true),
  ('school_mp_003','Hoerskool Witbank',                 'SECONDARY','PUBLIC',     'suburb_emalahleni_c','eMalahleni Central','city_emalahleni','eMalahleni','Mpumalanga',true,true),
  ('school_mp_004','Middelburg High School',            'SECONDARY','PUBLIC',     'suburb_middelburg_c','Middelburg Central','city_middelburg_mp','Middelburg','Mpumalanga',true,true),
  ('school_mp_005','Greenside Primary School Nelspruit','PRIMARY',  'PUBLIC',     'suburb_nelspruit_c', 'Nelspruit Central','city_mbombela','Mbombela','Mpumalanga',true,true)
on conflict (id) do nothing;

-- ── FREE STATE ───────────────────────────────────────────────
insert into suburbs (id, name, city_id, city_name, province_code) values
  ('suburb_bloem_westdene','Westdene',        'city_bloemfontein','Bloemfontein','Free State'),
  ('suburb_bloem_bayswater','Bayswater',      'city_bloemfontein','Bloemfontein','Free State'),
  ('suburb_welkom_c',      'Welkom Central',  'city_welkom','Welkom',       'Free State')
on conflict (id) do nothing;

insert into schools (id, name, type, sector, suburb_id, suburb_name, city_id, city_name, province_code, is_verified, is_active) values
  ('school_fs_001','Grey College',                      'SECONDARY','PUBLIC',     'suburb_bloem_westdene','Westdene',    'city_bloemfontein','Bloemfontein','Free State',true,true),
  ('school_fs_002','Eunice Girls High School',          'SECONDARY','PUBLIC',     'suburb_bloem_westdene','Westdene',    'city_bloemfontein','Bloemfontein','Free State',true,true),
  ('school_fs_003','Sand du Plessis High School',       'SECONDARY','PUBLIC',     'suburb_bloem_bayswater','Bayswater',  'city_bloemfontein','Bloemfontein','Free State',true,true),
  ('school_fs_004','Fichardtpark High School',          'SECONDARY','PUBLIC',     'suburb_bloem_bayswater','Bayswater',  'city_bloemfontein','Bloemfontein','Free State',true,true),
  ('school_fs_005','Welkom High School',                'SECONDARY','PUBLIC',     'suburb_welkom_c',      'Welkom Central','city_welkom','Welkom','Free State',true,true),
  ('school_fs_006','St Andrew''s School Bloemfontein',  'COMBINED', 'INDEPENDENT','suburb_bloem_westdene','Westdene',    'city_bloemfontein','Bloemfontein','Free State',true,true)
on conflict (id) do nothing;

-- ── NORTH WEST ───────────────────────────────────────────────
insert into suburbs (id, name, city_id, city_name, province_code) values
  ('suburb_rustenburg_c',  'Rustenburg Central','city_rustenburg','Rustenburg','North West'),
  ('suburb_potch_c',       'Potchefstroom Central','city_potchefstroom','Potchefstroom','North West'),
  ('suburb_klerksdorp_c',  'Klerksdorp Central','city_klerksdorp','Klerksdorp','North West')
on conflict (id) do nothing;

insert into schools (id, name, type, sector, suburb_id, suburb_name, city_id, city_name, province_code, is_verified, is_active) values
  ('school_nw_001','Rustenburg High School',            'SECONDARY','PUBLIC',     'suburb_rustenburg_c','Rustenburg Central','city_rustenburg','Rustenburg','North West',true,true),
  ('school_nw_002','Hoerskool Rustenburg',              'SECONDARY','PUBLIC',     'suburb_rustenburg_c','Rustenburg Central','city_rustenburg','Rustenburg','North West',true,true),
  ('school_nw_003','Potchefstroom Gimnasium',           'SECONDARY','PUBLIC',     'suburb_potch_c',    'Potchefstroom Central','city_potchefstroom','Potchefstroom','North West',true,true),
  ('school_nw_004','Hoerskool Klerksdorp',              'SECONDARY','PUBLIC',     'suburb_klerksdorp_c','Klerksdorp Central','city_klerksdorp','Klerksdorp','North West',true,true),
  ('school_nw_005','Laerskool Potchefstroom',           'PRIMARY',  'PUBLIC',     'suburb_potch_c',    'Potchefstroom Central','city_potchefstroom','Potchefstroom','North West',true,true)
on conflict (id) do nothing;

-- ── NORTHERN CAPE ────────────────────────────────────────────
insert into suburbs (id, name, city_id, city_name, province_code) values
  ('suburb_kimberley_c',   'Kimberley Central','city_kimberley','Kimberley','Northern Cape'),
  ('suburb_upington_c',    'Upington Central', 'city_upington','Upington',  'Northern Cape')
on conflict (id) do nothing;

insert into schools (id, name, type, sector, suburb_id, suburb_name, city_id, city_name, province_code, is_verified, is_active) values
  ('school_nc_001','Kimberley Boys High School',        'SECONDARY','PUBLIC',     'suburb_kimberley_c','Kimberley Central','city_kimberley','Kimberley','Northern Cape',true,true),
  ('school_nc_002','Kimberley Girls High School',       'SECONDARY','PUBLIC',     'suburb_kimberley_c','Kimberley Central','city_kimberley','Kimberley','Northern Cape',true,true),
  ('school_nc_003','Sol Plaatje High School',           'SECONDARY','PUBLIC',     'suburb_kimberley_c','Kimberley Central','city_kimberley','Kimberley','Northern Cape',true,true),
  ('school_nc_004','Upington High School',              'SECONDARY','PUBLIC',     'suburb_upington_c', 'Upington Central', 'city_upington','Upington','Northern Cape',true,true)
on conflict (id) do nothing;

-- ── INDEXES (catch any missing) ───────────────────────────────
create index if not exists idx_schools_name_search on schools using gin(to_tsvector('simple', name));
