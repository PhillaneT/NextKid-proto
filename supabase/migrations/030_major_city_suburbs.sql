-- Migration 030 — Suburbs for major SA cities
-- Adds Johannesburg city + suburbs for Cape Town, Durban, Johannesburg,
-- Bloemfontein, Polokwane, Port Elizabeth (Gqeberha), and other key cities.
-- Safe to re-run: uses ON CONFLICT DO NOTHING

-- ── Add missing Gauteng cities ────────────────────────────────
insert into cities (id, name, province_code, latitude, longitude) values
  ('city_jhb',      'Johannesburg',  'Gauteng', -26.2041, 28.0473),
  ('city_soweto',   'Soweto',        'Gauteng', -26.2677, 27.8584),
  ('city_tshwane',  'Tshwane',       'Gauteng', -25.7479, 28.2293)
on conflict (id) do nothing;

-- ── Cape Town suburbs ─────────────────────────────────────────
insert into suburbs (id, name, city_id, city_name, province_code, postal_code) values
  ('sub_cpt_sea_point',     'Sea Point',         'city_cpt', 'Cape Town', 'Western Cape', '8005'),
  ('sub_cpt_green_point',   'Green Point',       'city_cpt', 'Cape Town', 'Western Cape', '8001'),
  ('sub_cpt_bo_kaap',       'Bo-Kaap',           'city_cpt', 'Cape Town', 'Western Cape', '8001'),
  ('sub_cpt_gardens',       'Gardens',           'city_cpt', 'Cape Town', 'Western Cape', '8001'),
  ('sub_cpt_tamboerskloof', 'Tamboerskloof',     'city_cpt', 'Cape Town', 'Western Cape', '8001'),
  ('sub_cpt_oranjezicht',   'Oranjezicht',       'city_cpt', 'Cape Town', 'Western Cape', '8001'),
  ('sub_cpt_vredehoek',     'Vredehoek',         'city_cpt', 'Cape Town', 'Western Cape', '8001'),
  ('sub_cpt_woodstock',     'Woodstock',         'city_cpt', 'Cape Town', 'Western Cape', '7925'),
  ('sub_cpt_salt_river',    'Salt River',        'city_cpt', 'Cape Town', 'Western Cape', '7925'),
  ('sub_cpt_observatory',   'Observatory',       'city_cpt', 'Cape Town', 'Western Cape', '7925'),
  ('sub_cpt_mowbray',       'Mowbray',           'city_cpt', 'Cape Town', 'Western Cape', '7700'),
  ('sub_cpt_rondebosch',    'Rondebosch',        'city_cpt', 'Cape Town', 'Western Cape', '7700'),
  ('sub_cpt_newlands',      'Newlands',          'city_cpt', 'Cape Town', 'Western Cape', '7700'),
  ('sub_cpt_claremont',     'Claremont',         'city_cpt', 'Cape Town', 'Western Cape', '7708'),
  ('sub_cpt_kenilworth',    'Kenilworth',        'city_cpt', 'Cape Town', 'Western Cape', '7708'),
  ('sub_cpt_wynberg',       'Wynberg',           'city_cpt', 'Cape Town', 'Western Cape', '7800'),
  ('sub_cpt_plumstead',     'Plumstead',         'city_cpt', 'Cape Town', 'Western Cape', '7800'),
  ('sub_cpt_constantia',    'Constantia',        'city_cpt', 'Cape Town', 'Western Cape', '7806'),
  ('sub_cpt_tokai',         'Tokai',             'city_cpt', 'Cape Town', 'Western Cape', '7945'),
  ('sub_cpt_retreat',       'Retreat',           'city_cpt', 'Cape Town', 'Western Cape', '7945'),
  ('sub_cpt_muizenberg',    'Muizenberg',        'city_cpt', 'Cape Town', 'Western Cape', '7950'),
  ('sub_cpt_mitchells_plain','Mitchells Plain',  'city_cpt', 'Cape Town', 'Western Cape', '7785'),
  ('sub_cpt_khayelitsha',   'Khayelitsha',       'city_cpt', 'Cape Town', 'Western Cape', '7784'),
  ('sub_cpt_gugulethu',     'Gugulethu',         'city_cpt', 'Cape Town', 'Western Cape', '7750'),
  ('sub_cpt_athlone',       'Athlone',           'city_cpt', 'Cape Town', 'Western Cape', '7764'),
  ('sub_cpt_goodwood',      'Goodwood',          'city_cpt', 'Cape Town', 'Western Cape', '7460'),
  ('sub_cpt_parow',         'Parow',             'city_cpt', 'Cape Town', 'Western Cape', '7500'),
  ('sub_cpt_bellville',     'Bellville',         'city_cpt', 'Cape Town', 'Western Cape', '7530'),
  ('sub_cpt_durbanville',   'Durbanville',       'city_cpt', 'Cape Town', 'Western Cape', '7550'),
  ('sub_cpt_brackenfell',   'Brackenfell',       'city_cpt', 'Cape Town', 'Western Cape', '7560'),
  ('sub_cpt_kuils_river',   'Kuils River',       'city_cpt', 'Cape Town', 'Western Cape', '7580'),
  ('sub_cpt_blue_downs',    'Blue Downs',        'city_cpt', 'Cape Town', 'Western Cape', '7100'),
  ('sub_cpt_pinelands',     'Pinelands',         'city_cpt', 'Cape Town', 'Western Cape', '7405'),
  ('sub_cpt_milnerton',     'Milnerton',         'city_cpt', 'Cape Town', 'Western Cape', '7441'),
  ('sub_cpt_tableview',     'Table View',        'city_cpt', 'Cape Town', 'Western Cape', '7441'),
  ('sub_cpt_blouberg',      'Blouberg',          'city_cpt', 'Cape Town', 'Western Cape', '7441'),
  ('sub_cpt_hout_bay',      'Hout Bay',          'city_cpt', 'Cape Town', 'Western Cape', '7872'),
  ('sub_cpt_camps_bay',     'Camps Bay',         'city_cpt', 'Cape Town', 'Western Cape', '8005'),
  ('sub_cpt_simons_town',   'Simon''s Town',     'city_cpt', 'Cape Town', 'Western Cape', '7995'),
  ('sub_cpt_fish_hoek',     'Fish Hoek',         'city_cpt', 'Cape Town', 'Western Cape', '7975')
on conflict (id) do nothing;

-- ── Durban suburbs ────────────────────────────────────────────
insert into suburbs (id, name, city_id, city_name, province_code, postal_code) values
  ('sub_dbn_berea',         'Berea',             'city_durban', 'Durban', 'KwaZulu-Natal', '4001'),
  ('sub_dbn_umbilo',        'Umbilo',            'city_durban', 'Durban', 'KwaZulu-Natal', '4001'),
  ('sub_dbn_glenwood',      'Glenwood',          'city_durban', 'Durban', 'KwaZulu-Natal', '4001'),
  ('sub_dbn_morningside',   'Morningside',       'city_durban', 'Durban', 'KwaZulu-Natal', '4001'),
  ('sub_dbn_musgrave',      'Musgrave',          'city_durban', 'Durban', 'KwaZulu-Natal', '4001'),
  ('sub_dbn_overport',      'Overport',          'city_durban', 'Durban', 'KwaZulu-Natal', '4091'),
  ('sub_dbn_sydenham',      'Sydenham',          'city_durban', 'Durban', 'KwaZulu-Natal', '4091'),
  ('sub_dbn_westville',     'Westville',         'city_durban', 'Durban', 'KwaZulu-Natal', '3629'),
  ('sub_dbn_pinetown',      'Pinetown',          'city_durban', 'Durban', 'KwaZulu-Natal', '3610'),
  ('sub_dbn_hillcrest',     'Hillcrest',         'city_durban', 'Durban', 'KwaZulu-Natal', '3650'),
  ('sub_dbn_kloof',         'Kloof',             'city_durban', 'Durban', 'KwaZulu-Natal', '3640'),
  ('sub_dbn_amanzimtoti',   'Amanzimtoti',       'city_durban', 'Durban', 'KwaZulu-Natal', '4126'),
  ('sub_dbn_umlazi',        'Umlazi',            'city_durban', 'Durban', 'KwaZulu-Natal', '4066'),
  ('sub_dbn_chatsworth',    'Chatsworth',        'city_durban', 'Durban', 'KwaZulu-Natal', '4092'),
  ('sub_dbn_phoenix',       'Phoenix',           'city_durban', 'Durban', 'KwaZulu-Natal', '4068'),
  ('sub_dbn_tongaat',       'Tongaat',           'city_durban', 'Durban', 'KwaZulu-Natal', '4399'),
  ('sub_dbn_umhlanga',      'Umhlanga',          'city_durban', 'Durban', 'KwaZulu-Natal', '4320'),
  ('sub_dbn_la_lucia',      'La Lucia',          'city_durban', 'Durban', 'KwaZulu-Natal', '4051'),
  ('sub_dbn_durban_north',  'Durban North',      'city_durban', 'Durban', 'KwaZulu-Natal', '4051'),
  ('sub_dbn_stamford_hill', 'Stamford Hill',     'city_durban', 'Durban', 'KwaZulu-Natal', '4023'),
  ('sub_dbn_greyville',     'Greyville',         'city_durban', 'Durban', 'KwaZulu-Natal', '4023'),
  ('sub_dbn_bluff',         'The Bluff',         'city_durban', 'Durban', 'KwaZulu-Natal', '4052'),
  ('sub_dbn_isipingo',      'Isipingo',          'city_durban', 'Durban', 'KwaZulu-Natal', '4133'),
  ('sub_dbn_springfield',   'Springfield',       'city_durban', 'Durban', 'KwaZulu-Natal', '4091'),
  ('sub_dbn_reservoir_hills','Reservoir Hills',  'city_durban', 'Durban', 'KwaZulu-Natal', '4090')
on conflict (id) do nothing;

-- ── Johannesburg suburbs ──────────────────────────────────────
insert into suburbs (id, name, city_id, city_name, province_code, postal_code) values
  ('sub_jhb_sandton',       'Sandton',           'city_jhb', 'Johannesburg', 'Gauteng', '2196'),
  ('sub_jhb_randburg',      'Randburg',          'city_jhb', 'Johannesburg', 'Gauteng', '2194'),
  ('sub_jhb_fourways',      'Fourways',          'city_jhb', 'Johannesburg', 'Gauteng', '2055'),
  ('sub_jhb_midrand',       'Midrand',           'city_jhb', 'Johannesburg', 'Gauteng', '1685'),
  ('sub_jhb_roodepoort',    'Roodepoort',        'city_jhb', 'Johannesburg', 'Gauteng', '1724'),
  ('sub_jhb_soweto',        'Soweto',            'city_jhb', 'Johannesburg', 'Gauteng', '1818'),
  ('sub_jhb_alberton',      'Alberton',          'city_jhb', 'Johannesburg', 'Gauteng', '1449'),
  ('sub_jhb_boksburg',      'Boksburg',          'city_jhb', 'Johannesburg', 'Gauteng', '1459'),
  ('sub_jhb_benoni',        'Benoni',            'city_jhb', 'Johannesburg', 'Gauteng', '1500'),
  ('sub_jhb_kempton_park',  'Kempton Park',      'city_jhb', 'Johannesburg', 'Gauteng', '1619'),
  ('sub_jhb_edenvale',      'Edenvale',          'city_jhb', 'Johannesburg', 'Gauteng', '1609'),
  ('sub_jhb_germiston',     'Germiston',         'city_jhb', 'Johannesburg', 'Gauteng', '1401'),
  ('sub_jhb_hyde_park',     'Hyde Park',         'city_jhb', 'Johannesburg', 'Gauteng', '2196'),
  ('sub_jhb_rosebank',      'Rosebank',          'city_jhb', 'Johannesburg', 'Gauteng', '2196'),
  ('sub_jhb_parkhurst',     'Parkhurst',         'city_jhb', 'Johannesburg', 'Gauteng', '2193'),
  ('sub_jhb_parktown',      'Parktown',          'city_jhb', 'Johannesburg', 'Gauteng', '2193'),
  ('sub_jhb_melville',      'Melville',          'city_jhb', 'Johannesburg', 'Gauteng', '2092'),
  ('sub_jhb_northcliff',    'Northcliff',        'city_jhb', 'Johannesburg', 'Gauteng', '2115'),
  ('sub_jhb_craighall',     'Craighall',         'city_jhb', 'Johannesburg', 'Gauteng', '2196'),
  ('sub_jhb_sunninghill',   'Sunninghill',       'city_jhb', 'Johannesburg', 'Gauteng', '2157'),
  ('sub_jhb_bryanston',     'Bryanston',         'city_jhb', 'Johannesburg', 'Gauteng', '2021'),
  ('sub_jhb_rivonia',       'Rivonia',           'city_jhb', 'Johannesburg', 'Gauteng', '2128'),
  ('sub_jhb_morningside_jhb','Morningside',      'city_jhb', 'Johannesburg', 'Gauteng', '2196'),
  ('sub_jhb_linden',        'Linden',            'city_jhb', 'Johannesburg', 'Gauteng', '2195'),
  ('sub_jhb_westdene',      'Westdene',          'city_jhb', 'Johannesburg', 'Gauteng', '2092'),
  ('sub_jhb_florida',       'Florida',           'city_jhb', 'Johannesburg', 'Gauteng', '1710'),
  ('sub_jhb_crown_gardens', 'Crown Gardens',     'city_jhb', 'Johannesburg', 'Gauteng', '2092'),
  ('sub_jhb_orange_farm',   'Orange Farm',       'city_jhb', 'Johannesburg', 'Gauteng', '1805'),
  ('sub_jhb_diepsloot',     'Diepsloot',         'city_jhb', 'Johannesburg', 'Gauteng', '0157'),
  ('sub_jhb_alexandra',     'Alexandra',         'city_jhb', 'Johannesburg', 'Gauteng', '2090')
on conflict (id) do nothing;

-- ── Bloemfontein suburbs ──────────────────────────────────────
insert into suburbs (id, name, city_id, city_name, province_code, postal_code) values
  ('sub_bfn_westdene',      'Westdene',          'city_bloemfontein', 'Bloemfontein', 'Free State', '9301'),
  ('sub_bfn_universitas',   'Universitas',       'city_bloemfontein', 'Bloemfontein', 'Free State', '9301'),
  ('sub_bfn_langenhoven',   'Langenhoven Park',  'city_bloemfontein', 'Bloemfontein', 'Free State', '9330'),
  ('sub_bfn_bayswater',     'Bayswater',         'city_bloemfontein', 'Bloemfontein', 'Free State', '9301'),
  ('sub_bfn_fichardtpark',  'Fichardt Park',     'city_bloemfontein', 'Bloemfontein', 'Free State', '9301'),
  ('sub_bfn_brandwag',      'Brandwag',          'city_bloemfontein', 'Bloemfontein', 'Free State', '9301'),
  ('sub_bfn_hillsboro',     'Hillsboro',         'city_bloemfontein', 'Bloemfontein', 'Free State', '9301'),
  ('sub_bfn_new_westdene',  'Heuwelsig',         'city_bloemfontein', 'Bloemfontein', 'Free State', '9301'),
  ('sub_bfn_mangaung',      'Mangaung',          'city_bloemfontein', 'Bloemfontein', 'Free State', '9323'),
  ('sub_bfn_botshabelo',    'Botshabelo',        'city_bloemfontein', 'Bloemfontein', 'Free State', '9781')
on conflict (id) do nothing;

-- ── Polokwane suburbs ─────────────────────────────────────────
insert into suburbs (id, name, city_id, city_name, province_code, postal_code) values
  ('sub_ptk_flora_park',    'Flora Park',        'city_polokwane', 'Polokwane', 'Limpopo', '0699'),
  ('sub_ptk_bendor',        'Bendor',            'city_polokwane', 'Polokwane', 'Limpopo', '0699'),
  ('sub_ptk_ivan_tuko',     'Ivan Tukos',        'city_polokwane', 'Polokwane', 'Limpopo', '0700'),
  ('sub_ptk_seshego',       'Seshego',           'city_polokwane', 'Polokwane', 'Limpopo', '0742'),
  ('sub_ptk_westenburg',    'Westenburg',        'city_polokwane', 'Polokwane', 'Limpopo', '0699'),
  ('sub_ptk_university',    'University Area',   'city_polokwane', 'Polokwane', 'Limpopo', '0700'),
  ('sub_ptk_ladanna',       'Ladanna',           'city_polokwane', 'Polokwane', 'Limpopo', '0699')
on conflict (id) do nothing;

-- ── Gqeberha (Port Elizabeth) suburbs ────────────────────────
insert into suburbs (id, name, city_id, city_name, province_code, postal_code) values
  ('sub_pe_summerstrand',   'Summerstrand',      'city_gqeberha', 'Gqeberha', 'Eastern Cape', '6001'),
  ('sub_pe_walmer',         'Walmer',            'city_gqeberha', 'Gqeberha', 'Eastern Cape', '6070'),
  ('sub_pe_humewood',       'Humewood',          'city_gqeberha', 'Gqeberha', 'Eastern Cape', '6013'),
  ('sub_pe_greenacres',     'Greenacres',        'city_gqeberha', 'Gqeberha', 'Eastern Cape', '6045'),
  ('sub_pe_newton_park',    'Newton Park',       'city_gqeberha', 'Gqeberha', 'Eastern Cape', '6055'),
  ('sub_pe_korsten',        'Korsten',           'city_gqeberha', 'Gqeberha', 'Eastern Cape', '6020'),
  ('sub_pe_new_brighton',   'New Brighton',      'city_gqeberha', 'Gqeberha', 'Eastern Cape', '6200'),
  ('sub_pe_kwazakhele',     'KwaZakhele',        'city_gqeberha', 'Gqeberha', 'Eastern Cape', '6201'),
  ('sub_pe_despatch',       'Despatch',          'city_gqeberha', 'Gqeberha', 'Eastern Cape', '6220'),
  ('sub_pe_uitenhage',      'Uitenhage',         'city_gqeberha', 'Gqeberha', 'Eastern Cape', '6230')
on conflict (id) do nothing;

-- ── Rustenburg suburbs ────────────────────────────────────────
insert into suburbs (id, name, city_id, city_name, province_code, postal_code) values
  ('sub_rst_waterfall',     'Waterfall East',    'city_rustenburg', 'Rustenburg', 'North West', '0300'),
  ('sub_rst_cashan',        'Cashan',            'city_rustenburg', 'Rustenburg', 'North West', '0299'),
  ('sub_rst_tlhabane',      'Tlhabane',          'city_rustenburg', 'Rustenburg', 'North West', '0309'),
  ('sub_rst_rustenburg_cbd','Rustenburg CBD',    'city_rustenburg', 'Rustenburg', 'North West', '0299'),
  ('sub_rst_proteapark',    'Protea Park',       'city_rustenburg', 'Rustenburg', 'North West', '0299')
on conflict (id) do nothing;
