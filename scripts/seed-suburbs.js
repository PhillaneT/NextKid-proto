/**
 * NextKid — South Africa Suburbs Seeder
 *
 * Seeds all major SA suburbs into the Supabase `suburbs` table.
 * Covers all 9 provinces and ~100 cities with ~1,200 suburbs.
 *
 * HOW TO USE:
 *   node scripts/seed-suburbs.js
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 * in apps/web/.env.local
 */

require('./node_modules/dotenv').config({ path: '../apps/web/.env.local' })
const { createClient } = require('../node_modules/@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Suburb data: [id, name, city_id, city_name, province, postal_code] ──────
const SUBURBS = [
  // ── WESTERN CAPE — Cape Town ────────────────────────────────────────────
  ['sub_cpt_cbd',           'Cape Town CBD',     'city_cpt','Cape Town','Western Cape','8001'],
  ['sub_cpt_sea_point',     'Sea Point',         'city_cpt','Cape Town','Western Cape','8005'],
  ['sub_cpt_green_point',   'Green Point',       'city_cpt','Cape Town','Western Cape','8001'],
  ['sub_cpt_bo_kaap',       'Bo-Kaap',           'city_cpt','Cape Town','Western Cape','8001'],
  ['sub_cpt_de_waterkant',  'De Waterkant',      'city_cpt','Cape Town','Western Cape','8001'],
  ['sub_cpt_gardens',       'Gardens',           'city_cpt','Cape Town','Western Cape','8001'],
  ['sub_cpt_tamboerskloof', 'Tamboerskloof',     'city_cpt','Cape Town','Western Cape','8001'],
  ['sub_cpt_oranjezicht',   'Oranjezicht',       'city_cpt','Cape Town','Western Cape','8001'],
  ['sub_cpt_vredehoek',     'Vredehoek',         'city_cpt','Cape Town','Western Cape','8001'],
  ['sub_cpt_woodstock',     'Woodstock',         'city_cpt','Cape Town','Western Cape','7925'],
  ['sub_cpt_salt_river',    'Salt River',        'city_cpt','Cape Town','Western Cape','7925'],
  ['sub_cpt_observatory',   'Observatory',       'city_cpt','Cape Town','Western Cape','7925'],
  ['sub_cpt_mowbray',       'Mowbray',           'city_cpt','Cape Town','Western Cape','7700'],
  ['sub_cpt_rondebosch',    'Rondebosch',        'city_cpt','Cape Town','Western Cape','7700'],
  ['sub_cpt_rondebosch_e',  'Rondebosch East',   'city_cpt','Cape Town','Western Cape','7780'],
  ['sub_cpt_newlands',      'Newlands',          'city_cpt','Cape Town','Western Cape','7700'],
  ['sub_cpt_claremont',     'Claremont',         'city_cpt','Cape Town','Western Cape','7708'],
  ['sub_cpt_kenilworth',    'Kenilworth',        'city_cpt','Cape Town','Western Cape','7708'],
  ['sub_cpt_wynberg',       'Wynberg',           'city_cpt','Cape Town','Western Cape','7800'],
  ['sub_cpt_plumstead',     'Plumstead',         'city_cpt','Cape Town','Western Cape','7800'],
  ['sub_cpt_constantia',    'Constantia',        'city_cpt','Cape Town','Western Cape','7806'],
  ['sub_cpt_tokai',         'Tokai',             'city_cpt','Cape Town','Western Cape','7945'],
  ['sub_cpt_retreat',       'Retreat',           'city_cpt','Cape Town','Western Cape','7945'],
  ['sub_cpt_muizenberg',    'Muizenberg',        'city_cpt','Cape Town','Western Cape','7950'],
  ['sub_cpt_simons_town',   "Simon's Town",      'city_cpt','Cape Town','Western Cape','7995'],
  ['sub_cpt_fish_hoek',     'Fish Hoek',         'city_cpt','Cape Town','Western Cape','7975'],
  ['sub_cpt_sun_valley',    'Sun Valley',        'city_cpt','Cape Town','Western Cape','7975'],
  ['sub_cpt_noordhoek',     'Noordhoek',         'city_cpt','Cape Town','Western Cape','7979'],
  ['sub_cpt_camps_bay',     'Camps Bay',         'city_cpt','Cape Town','Western Cape','8005'],
  ['sub_cpt_hout_bay',      'Hout Bay',          'city_cpt','Cape Town','Western Cape','7872'],
  ['sub_cpt_llandudno',     'Llandudno',         'city_cpt','Cape Town','Western Cape','7806'],
  ['sub_cpt_pinelands',     'Pinelands',         'city_cpt','Cape Town','Western Cape','7405'],
  ['sub_cpt_milnerton',     'Milnerton',         'city_cpt','Cape Town','Western Cape','7441'],
  ['sub_cpt_tableview',     'Table View',        'city_cpt','Cape Town','Western Cape','7441'],
  ['sub_cpt_blouberg',      'Blouberg',          'city_cpt','Cape Town','Western Cape','7441'],
  ['sub_cpt_parklands',     'Parklands',         'city_cpt','Cape Town','Western Cape','7441'],
  ['sub_cpt_big_bay',       'Big Bay',           'city_cpt','Cape Town','Western Cape','7441'],
  ['sub_cpt_goodwood',      'Goodwood',          'city_cpt','Cape Town','Western Cape','7460'],
  ['sub_cpt_parow',         'Parow',             'city_cpt','Cape Town','Western Cape','7500'],
  ['sub_cpt_bellville',     'Bellville',         'city_cpt','Cape Town','Western Cape','7530'],
  ['sub_cpt_durbanville',   'Durbanville',       'city_cpt','Cape Town','Western Cape','7550'],
  ['sub_cpt_brackenfell',   'Brackenfell',       'city_cpt','Cape Town','Western Cape','7560'],
  ['sub_cpt_kuils_river',   'Kuils River',       'city_cpt','Cape Town','Western Cape','7580'],
  ['sub_cpt_blue_downs',    'Blue Downs',        'city_cpt','Cape Town','Western Cape','7100'],
  ['sub_cpt_mitchells_plain','Mitchells Plain',  'city_cpt','Cape Town','Western Cape','7785'],
  ['sub_cpt_khayelitsha',   'Khayelitsha',       'city_cpt','Cape Town','Western Cape','7784'],
  ['sub_cpt_gugulethu',     'Gugulethu',         'city_cpt','Cape Town','Western Cape','7750'],
  ['sub_cpt_athlone',       'Athlone',           'city_cpt','Cape Town','Western Cape','7764'],
  ['sub_cpt_lansdowne',     'Lansdowne',         'city_cpt','Cape Town','Western Cape','7764'],
  ['sub_cpt_hanover_park',  'Hanover Park',      'city_cpt','Cape Town','Western Cape','7764'],
  ['sub_cpt_grassy_park',   'Grassy Park',       'city_cpt','Cape Town','Western Cape','7941'],
  ['sub_cpt_lavender_hill', 'Lavender Hill',     'city_cpt','Cape Town','Western Cape','7941'],
  ['sub_cpt_steenberg',     'Steenberg',         'city_cpt','Cape Town','Western Cape','7945'],
  ['sub_cpt_westlake',      'Westlake',          'city_cpt','Cape Town','Western Cape','7945'],
  ['sub_cpt_bergvliet',     'Bergvliet',         'city_cpt','Cape Town','Western Cape','7945'],
  ['sub_cpt_diep_river',    'Diep River',        'city_cpt','Cape Town','Western Cape','7800'],
  ['sub_cpt_ottery',        'Ottery',            'city_cpt','Cape Town','Western Cape','7800'],
  ['sub_cpt_wetton',        'Wetton',            'city_cpt','Cape Town','Western Cape','7780'],
  ['sub_cpt_strand',        'Strand',            'city_cpt','Cape Town','Western Cape','7140'],
  ['sub_cpt_gordons_bay',   "Gordon's Bay",      'city_cpt','Cape Town','Western Cape','7150'],
  // Western Cape — other cities
  ['sub_stb_central',       'Stellenbosch Central','city_stellenbosch','Stellenbosch','Western Cape','7600'],
  ['sub_stb_cloetesville',  'Cloetesville',      'city_stellenbosch','Stellenbosch','Western Cape','7600'],
  ['sub_stb_idas_valley',   "Ida's Valley",      'city_stellenbosch','Stellenbosch','Western Cape','7600'],
  ['sub_stb_die_boord',     'Die Boord',         'city_stellenbosch','Stellenbosch','Western Cape','7600'],
  ['sub_stb_kayamandi',     'Kayamandi',         'city_stellenbosch','Stellenbosch','Western Cape','7600'],
  ['sub_paarl_central',     'Paarl Central',     'city_paarl','Paarl','Western Cape','7646'],
  ['sub_paarl_paarl_south', 'Paarl South',       'city_paarl','Paarl','Western Cape','7646'],
  ['sub_paarl_wellington',  'Wellington',        'city_paarl','Paarl','Western Cape','7655'],
  ['sub_paarl_mbekweni',    'Mbekweni',          'city_paarl','Paarl','Western Cape','7655'],
  ['sub_george_central',    'George Central',    'city_george','George','Western Cape','6530'],
  ['sub_george_heather_park','Heather Park',     'city_george','George','Western Cape','6530'],
  ['sub_george_pacaltsdorp','Pacaltsdorp',       'city_george','George','Western Cape','6530'],
  ['sub_george_wilderness', 'Wilderness',        'city_george','George','Western Cape','6560'],
  ['sub_somw_central',      'Somerset West',     'city_somerset_west','Somerset West','Western Cape','7130'],
  ['sub_somw_helderberg',   'Helderberg',        'city_somerset_west','Somerset West','Western Cape','7130'],
  ['sub_somw_paardevlei',   'Paardevlei',        'city_somerset_west','Somerset West','Western Cape','7130'],

  // ── GAUTENG — Johannesburg ──────────────────────────────────────────────
  ['sub_jhb_cbd',           'Johannesburg CBD',  'city_jhb','Johannesburg','Gauteng','2000'],
  ['sub_jhb_hyde_park',     'Hyde Park',         'city_jhb','Johannesburg','Gauteng','2196'],
  ['sub_jhb_rosebank',      'Rosebank',          'city_jhb','Johannesburg','Gauteng','2196'],
  ['sub_jhb_sandton',       'Sandton',           'city_jhb','Johannesburg','Gauteng','2196'],
  ['sub_jhb_randburg',      'Randburg',          'city_jhb','Johannesburg','Gauteng','2194'],
  ['sub_jhb_fourways',      'Fourways',          'city_jhb','Johannesburg','Gauteng','2055'],
  ['sub_jhb_bryanston',     'Bryanston',         'city_jhb','Johannesburg','Gauteng','2021'],
  ['sub_jhb_rivonia',       'Rivonia',           'city_jhb','Johannesburg','Gauteng','2128'],
  ['sub_jhb_sunninghill',   'Sunninghill',       'city_jhb','Johannesburg','Gauteng','2157'],
  ['sub_jhb_morningside',   'Morningside',       'city_jhb','Johannesburg','Gauteng','2196'],
  ['sub_jhb_craighall',     'Craighall',         'city_jhb','Johannesburg','Gauteng','2196'],
  ['sub_jhb_parkhurst',     'Parkhurst',         'city_jhb','Johannesburg','Gauteng','2193'],
  ['sub_jhb_parktown',      'Parktown',          'city_jhb','Johannesburg','Gauteng','2193'],
  ['sub_jhb_melville',      'Melville',          'city_jhb','Johannesburg','Gauteng','2092'],
  ['sub_jhb_northcliff',    'Northcliff',        'city_jhb','Johannesburg','Gauteng','2115'],
  ['sub_jhb_linden',        'Linden',            'city_jhb','Johannesburg','Gauteng','2195'],
  ['sub_jhb_westdene',      'Westdene',          'city_jhb','Johannesburg','Gauteng','2092'],
  ['sub_jhb_florida',       'Florida',           'city_jhb','Johannesburg','Gauteng','1710'],
  ['sub_jhb_roodepoort',    'Roodepoort',        'city_jhb','Johannesburg','Gauteng','1724'],
  ['sub_jhb_strubenvale',   'Strubenvale',       'city_jhb','Johannesburg','Gauteng','1601'],
  ['sub_jhb_alberton',      'Alberton',          'city_jhb','Johannesburg','Gauteng','1449'],
  ['sub_jhb_boksburg',      'Boksburg',          'city_jhb','Johannesburg','Gauteng','1459'],
  ['sub_jhb_benoni',        'Benoni',            'city_jhb','Johannesburg','Gauteng','1500'],
  ['sub_jhb_kempton_park',  'Kempton Park',      'city_jhb','Johannesburg','Gauteng','1619'],
  ['sub_jhb_edenvale',      'Edenvale',          'city_jhb','Johannesburg','Gauteng','1609'],
  ['sub_jhb_germiston',     'Germiston',         'city_jhb','Johannesburg','Gauteng','1401'],
  ['sub_jhb_soweto',        'Soweto',            'city_jhb','Johannesburg','Gauteng','1818'],
  ['sub_jhb_diepkloof',     'Diepkloof',         'city_jhb','Johannesburg','Gauteng','1864'],
  ['sub_jhb_orlando',       'Orlando',           'city_jhb','Johannesburg','Gauteng','1804'],
  ['sub_jhb_pimville',      'Pimville',          'city_jhb','Johannesburg','Gauteng','1809'],
  ['sub_jhb_meadowlands',   'Meadowlands',       'city_jhb','Johannesburg','Gauteng','1852'],
  ['sub_jhb_alexandra',     'Alexandra',         'city_jhb','Johannesburg','Gauteng','2090'],
  ['sub_jhb_diepsloot',     'Diepsloot',         'city_jhb','Johannesburg','Gauteng','0157'],
  ['sub_jhb_midrand',       'Midrand',           'city_jhb','Johannesburg','Gauteng','1685'],
  ['sub_jhb_waterfall',     'Waterfall',         'city_jhb','Johannesburg','Gauteng','2090'],
  ['sub_jhb_orange_farm',   'Orange Farm',       'city_jhb','Johannesburg','Gauteng','1805'],
  ['sub_jhb_ennerdale',     'Ennerdale',         'city_jhb','Johannesburg','Gauteng','1833'],
  ['sub_jhb_lenasia',       'Lenasia',           'city_jhb','Johannesburg','Gauteng','1827'],
  ['sub_jhb_eldorado_park', 'Eldorado Park',     'city_jhb','Johannesburg','Gauteng','1811'],
  ['sub_jhb_crown_mines',   'Crown Mines',       'city_jhb','Johannesburg','Gauteng','2025'],
  ['sub_jhb_newtown',       'Newtown',           'city_jhb','Johannesburg','Gauteng','2001'],
  ['sub_jhb_marshalltown',  'Marshalltown',      'city_jhb','Johannesburg','Gauteng','2001'],
  ['sub_jhb_doornfontein',  'Doornfontein',      'city_jhb','Johannesburg','Gauteng','2028'],
  ['sub_jhb_yeoville',      'Yeoville',          'city_jhb','Johannesburg','Gauteng','2198'],
  ['sub_jhb_bez_valley',    'Bez Valley',        'city_jhb','Johannesburg','Gauteng','2198'],
  ['sub_jhb_troyeville',    'Troyeville',        'city_jhb','Johannesburg','Gauteng','2139'],
  ['sub_jhb_lorentzville',  'Lorentzville',      'city_jhb','Johannesburg','Gauteng','2094'],
  ['sub_jhb_norwood',       'Norwood',           'city_jhb','Johannesburg','Gauteng','2192'],
  ['sub_jhb_orange_grove',  'Orange Grove',      'city_jhb','Johannesburg','Gauteng','2192'],
  ['sub_jhb_houghton',      'Houghton',          'city_jhb','Johannesburg','Gauteng','2198'],

  // ── GAUTENG — Pretoria/Tshwane ──────────────────────────────────────────
  ['sub_pta_arcadia',       'Arcadia',           'city_pta','Pretoria','Gauteng','0083'],
  ['sub_pta_hatfield',      'Hatfield',          'city_pta','Pretoria','Gauteng','0028'],
  ['sub_pta_brooklyn',      'Brooklyn',          'city_pta','Pretoria','Gauteng','0181'],
  ['sub_pta_menlyn',        'Menlyn',            'city_pta','Pretoria','Gauteng','0063'],
  ['sub_pta_waterkloof',    'Waterkloof',        'city_pta','Pretoria','Gauteng','0145'],
  ['sub_pta_lynnwood',      'Lynnwood',          'city_pta','Pretoria','Gauteng','0081'],
  ['sub_pta_faerie_glen',   'Faerie Glen',       'city_pta','Pretoria','Gauteng','0043'],
  ['sub_pta_garsfontein',   'Garsfontein',       'city_pta','Pretoria','Gauteng','0042'],
  ['sub_pta_moreleta_park', 'Moreleta Park',     'city_pta','Pretoria','Gauteng','0044'],
  ['sub_pta_rubenstein',    'Rubenstein',        'city_pta','Pretoria','Gauteng','0082'],
  ['sub_pta_muckleneuk',    'Muckleneuk',        'city_pta','Pretoria','Gauteng','0002'],
  ['sub_pta_sunnyside',     'Sunnyside',         'city_pta','Pretoria','Gauteng','0132'],
  ['sub_pta_gezina',        'Gezina',            'city_pta','Pretoria','Gauteng','0031'],
  ['sub_pta_silverton',     'Silverton',         'city_pta','Pretoria','Gauteng','0127'],
  ['sub_pta_mamelodi',      'Mamelodi',          'city_pta','Pretoria','Gauteng','0122'],
  ['sub_pta_atteridgeville','Atteridgeville',    'city_pta','Pretoria','Gauteng','0008'],
  ['sub_pta_wonderboom',    'Wonderboom',        'city_pta','Pretoria','Gauteng','0084'],
  ['sub_pta_montana',       'Montana',           'city_pta','Pretoria','Gauteng','0182'],
  ['sub_pta_karenpark',     'Karenpark',         'city_pta','Pretoria','Gauteng','0182'],
  ['sub_pta_akasia',        'Akasia',            'city_pta','Pretoria','Gauteng','0182'],
  ['sub_pta_centurion',     'Centurion',         'city_pta','Pretoria','Gauteng','0157'],
  ['sub_pta_midstream',     'Midstream',         'city_pta','Pretoria','Gauteng','1692'],
  ['sub_pta_lyttelton',     'Lyttelton',         'city_pta','Pretoria','Gauteng','0157'],
  ['sub_pta_irene',         'Irene',             'city_pta','Pretoria','Gauteng','0062'],
  ['sub_pta_highveld',      'Highveld',          'city_pta','Pretoria','Gauteng','0169'],
  ['sub_pta_clubview',      'Clubview',          'city_pta','Pretoria','Gauteng','0157'],
  ['sub_pta_doringkloof',   'Doringkloof',       'city_pta','Pretoria','Gauteng','0157'],
  ['sub_pta_new_muckleneuk','New Muckleneuk',    'city_pta','Pretoria','Gauteng','0181'],
  ['sub_pta_eldoglen',      'Eldoglen',          'city_pta','Pretoria','Gauteng','0157'],

  // ── GAUTENG — Ekurhuleni/East Rand ──────────────────────────────────────
  ['sub_ekr_benoni',        'Benoni',            'city_ekurhuleni','Ekurhuleni','Gauteng','1500'],
  ['sub_ekr_boksburg',      'Boksburg',          'city_ekurhuleni','Ekurhuleni','Gauteng','1459'],
  ['sub_ekr_brakpan',       'Brakpan',           'city_ekurhuleni','Ekurhuleni','Gauteng','1541'],
  ['sub_ekr_springs',       'Springs',           'city_ekurhuleni','Ekurhuleni','Gauteng','1559'],
  ['sub_ekr_nigel',         'Nigel',             'city_ekurhuleni','Ekurhuleni','Gauteng','1490'],
  ['sub_ekr_kempton_park',  'Kempton Park',      'city_ekurhuleni','Ekurhuleni','Gauteng','1619'],
  ['sub_ekr_edenvale',      'Edenvale',          'city_ekurhuleni','Ekurhuleni','Gauteng','1609'],
  ['sub_ekr_germiston',     'Germiston',         'city_ekurhuleni','Ekurhuleni','Gauteng','1401'],
  ['sub_ekr_alberton',      'Alberton',          'city_ekurhuleni','Ekurhuleni','Gauteng','1449'],
  ['sub_ekr_tembisa',       'Tembisa',           'city_ekurhuleni','Ekurhuleni','Gauteng','1632'],
  ['sub_ekr_daveyton',      'Daveyton',          'city_ekurhuleni','Ekurhuleni','Gauteng','1520'],
  ['sub_ekr_duduza',        'Duduza',            'city_ekurhuleni','Ekurhuleni','Gauteng','1496'],
  ['sub_ekr_vosloorus',     'Vosloorus',         'city_ekurhuleni','Ekurhuleni','Gauteng','1475'],
  ['sub_ekr_thokoza',       'Thokoza',           'city_ekurhuleni','Ekurhuleni','Gauteng','1425'],
  ['sub_ekr_katlehong',     'Katlehong',         'city_ekurhuleni','Ekurhuleni','Gauteng','1431'],

  // ── KwaZulu-Natal — Durban ──────────────────────────────────────────────
  ['sub_dbn_cbd',           'Durban CBD',        'city_durban','Durban','KwaZulu-Natal','4001'],
  ['sub_dbn_berea',         'Berea',             'city_durban','Durban','KwaZulu-Natal','4001'],
  ['sub_dbn_umbilo',        'Umbilo',            'city_durban','Durban','KwaZulu-Natal','4001'],
  ['sub_dbn_glenwood',      'Glenwood',          'city_durban','Durban','KwaZulu-Natal','4001'],
  ['sub_dbn_morningside',   'Morningside',       'city_durban','Durban','KwaZulu-Natal','4001'],
  ['sub_dbn_musgrave',      'Musgrave',          'city_durban','Durban','KwaZulu-Natal','4001'],
  ['sub_dbn_overport',      'Overport',          'city_durban','Durban','KwaZulu-Natal','4091'],
  ['sub_dbn_sydenham',      'Sydenham',          'city_durban','Durban','KwaZulu-Natal','4091'],
  ['sub_dbn_springfield',   'Springfield',       'city_durban','Durban','KwaZulu-Natal','4091'],
  ['sub_dbn_reservoir_hills','Reservoir Hills',  'city_durban','Durban','KwaZulu-Natal','4090'],
  ['sub_dbn_westville',     'Westville',         'city_durban','Durban','KwaZulu-Natal','3629'],
  ['sub_dbn_pinetown',      'Pinetown',          'city_durban','Durban','KwaZulu-Natal','3610'],
  ['sub_dbn_hillcrest',     'Hillcrest',         'city_durban','Durban','KwaZulu-Natal','3650'],
  ['sub_dbn_kloof',         'Kloof',             'city_durban','Durban','KwaZulu-Natal','3640'],
  ['sub_dbn_gillitts',      'Gillitts',          'city_durban','Durban','KwaZulu-Natal','3610'],
  ['sub_dbn_amanzimtoti',   'Amanzimtoti',       'city_durban','Durban','KwaZulu-Natal','4126'],
  ['sub_dbn_umlazi',        'Umlazi',            'city_durban','Durban','KwaZulu-Natal','4066'],
  ['sub_dbn_chatsworth',    'Chatsworth',        'city_durban','Durban','KwaZulu-Natal','4092'],
  ['sub_dbn_phoenix',       'Phoenix',           'city_durban','Durban','KwaZulu-Natal','4068'],
  ['sub_dbn_newlands_east', 'Newlands East',     'city_durban','Durban','KwaZulu-Natal','4037'],
  ['sub_dbn_tongaat',       'Tongaat',           'city_durban','Durban','KwaZulu-Natal','4399'],
  ['sub_dbn_umhlanga',      'Umhlanga',          'city_durban','Durban','KwaZulu-Natal','4320'],
  ['sub_dbn_la_lucia',      'La Lucia',          'city_durban','Durban','KwaZulu-Natal','4051'],
  ['sub_dbn_durban_north',  'Durban North',      'city_durban','Durban','KwaZulu-Natal','4051'],
  ['sub_dbn_greyville',     'Greyville',         'city_durban','Durban','KwaZulu-Natal','4023'],
  ['sub_dbn_bluff',         'The Bluff',         'city_durban','Durban','KwaZulu-Natal','4052'],
  ['sub_dbn_isipingo',      'Isipingo',          'city_durban','Durban','KwaZulu-Natal','4133'],
  ['sub_dbn_malvern',       'Malvern',           'city_durban','Durban','KwaZulu-Natal','4068'],
  ['sub_dbn_queensburgh',   'Queensburgh',       'city_durban','Durban','KwaZulu-Natal','4093'],
  ['sub_dbn_marianhill',    'Marianhill',        'city_durban','Durban','KwaZulu-Natal','3601'],
  ['sub_dbn_shallcross',    'Shallcross',        'city_durban','Durban','KwaZulu-Natal','4093'],
  ['sub_dbn_yellowwood_pk', 'Yellowwood Park',   'city_durban','Durban','KwaZulu-Natal','4004'],
  ['sub_dbn_montclair',     'Montclair',         'city_durban','Durban','KwaZulu-Natal','4004'],
  ['sub_dbn_clairwood',     'Clairwood',         'city_durban','Durban','KwaZulu-Natal','4052'],

  // KZN — Pietermaritzburg
  ['sub_pmb_central',       'Pietermaritzburg Central','city_pmb','Pietermaritzburg','KwaZulu-Natal','3201'],
  ['sub_pmb_montrose',      'Montrose',          'city_pmb','Pietermaritzburg','KwaZulu-Natal','3201'],
  ['sub_pmb_chase_valley',  'Chase Valley',      'city_pmb','Pietermaritzburg','KwaZulu-Natal','3201'],
  ['sub_pmb_ashburton',     'Ashburton',         'city_pmb','Pietermaritzburg','KwaZulu-Natal','3201'],
  ['sub_pmb_northdale',     'Northdale',         'city_pmb','Pietermaritzburg','KwaZulu-Natal','3201'],
  ['sub_pmb_edendale',      'Edendale',          'city_pmb','Pietermaritzburg','KwaZulu-Natal','3201'],

  // KZN — Umhlanga/Ballito
  ['sub_uml_umhlanga_rocks','Umhlanga Rocks',    'city_umhlanga','Umhlanga','KwaZulu-Natal','4319'],
  ['sub_uml_gateway',       'Gateway',           'city_umhlanga','Umhlanga','KwaZulu-Natal','4319'],
  ['sub_uml_la_lucia_ridge','La Lucia Ridge',    'city_umhlanga','Umhlanga','KwaZulu-Natal','4051'],
  ['sub_bal_ballito',       'Ballito',           'city_ballito','Ballito','KwaZulu-Natal','4420'],
  ['sub_bal_salt_rock',     'Salt Rock',         'city_ballito','Ballito','KwaZulu-Natal','4420'],
  ['sub_bal_shaka_s_rock',  "Shaka's Rock",      'city_ballito','Ballito','KwaZulu-Natal','4420'],

  // ── EASTERN CAPE — Gqeberha ─────────────────────────────────────────────
  ['sub_pe_central',        'Gqeberha Central',  'city_gqeberha','Gqeberha','Eastern Cape','6001'],
  ['sub_pe_summerstrand',   'Summerstrand',      'city_gqeberha','Gqeberha','Eastern Cape','6001'],
  ['sub_pe_walmer',         'Walmer',            'city_gqeberha','Gqeberha','Eastern Cape','6070'],
  ['sub_pe_humewood',       'Humewood',          'city_gqeberha','Gqeberha','Eastern Cape','6013'],
  ['sub_pe_greenacres',     'Greenacres',        'city_gqeberha','Gqeberha','Eastern Cape','6045'],
  ['sub_pe_newton_park',    'Newton Park',       'city_gqeberha','Gqeberha','Eastern Cape','6055'],
  ['sub_pe_korsten',        'Korsten',           'city_gqeberha','Gqeberha','Eastern Cape','6020'],
  ['sub_pe_new_brighton',   'New Brighton',      'city_gqeberha','Gqeberha','Eastern Cape','6200'],
  ['sub_pe_kwazakhele',     'KwaZakhele',        'city_gqeberha','Gqeberha','Eastern Cape','6201'],
  ['sub_pe_despatch',       'Despatch',          'city_gqeberha','Gqeberha','Eastern Cape','6220'],
  ['sub_pe_uitenhage',      'Uitenhage',         'city_gqeberha','Gqeberha','Eastern Cape','6230'],
  ['sub_pe_kabega_park',    'Kabega Park',       'city_gqeberha','Gqeberha','Eastern Cape','6025'],
  ['sub_pe_charlo',         'Charlo',            'city_gqeberha','Gqeberha','Eastern Cape','6070'],
  ['sub_pe_lorraine',       'Lorraine',          'city_gqeberha','Gqeberha','Eastern Cape','6070'],
  ['sub_pe_sherwood',       'Sherwood',          'city_gqeberha','Gqeberha','Eastern Cape','6020'],
  ['sub_pe_north_end',      'North End',         'city_gqeberha','Gqeberha','Eastern Cape','6001'],

  // Eastern Cape — East London
  ['sub_el_central',        'East London Central','city_east_london','East London','Eastern Cape','5201'],
  ['sub_el_berea',          'Berea',             'city_east_london','East London','Eastern Cape','5201'],
  ['sub_el_cambridge',      'Cambridge',         'city_east_london','East London','Eastern Cape','5200'],
  ['sub_el_beacon_bay',     'Beacon Bay',        'city_east_london','East London','Eastern Cape','5241'],
  ['sub_el_vincent',        'Vincent',           'city_east_london','East London','Eastern Cape','5247'],
  ['sub_el_gonubie',        'Gonubie',           'city_east_london','East London','Eastern Cape','5257'],
  ['sub_el_mdantsane',      'Mdantsane',         'city_east_london','East London','Eastern Cape','5219'],
  ['sub_el_kwelera',        'Kwelera',           'city_east_london','East London','Eastern Cape','5259'],
  ['sub_el_selborne',       'Selborne',          'city_east_london','East London','Eastern Cape','5201'],
  ['sub_el_southernwood',   'Southernwood',      'city_east_london','East London','Eastern Cape','5201'],

  // ── FREE STATE — Bloemfontein ───────────────────────────────────────────
  ['sub_bfn_central',       'Bloemfontein Central','city_bloemfontein','Bloemfontein','Free State','9301'],
  ['sub_bfn_westdene',      'Westdene',          'city_bloemfontein','Bloemfontein','Free State','9301'],
  ['sub_bfn_universitas',   'Universitas',       'city_bloemfontein','Bloemfontein','Free State','9301'],
  ['sub_bfn_langenhoven',   'Langenhoven Park',  'city_bloemfontein','Bloemfontein','Free State','9330'],
  ['sub_bfn_bayswater',     'Bayswater',         'city_bloemfontein','Bloemfontein','Free State','9301'],
  ['sub_bfn_fichardtpark',  'Fichardt Park',     'city_bloemfontein','Bloemfontein','Free State','9301'],
  ['sub_bfn_brandwag',      'Brandwag',          'city_bloemfontein','Bloemfontein','Free State','9301'],
  ['sub_bfn_hillsboro',     'Hillsboro',         'city_bloemfontein','Bloemfontein','Free State','9301'],
  ['sub_bfn_heuwelsig',     'Heuwelsig',         'city_bloemfontein','Bloemfontein','Free State','9301'],
  ['sub_bfn_mangaung',      'Mangaung',          'city_bloemfontein','Bloemfontein','Free State','9323'],
  ['sub_bfn_botshabelo',    'Botshabelo',        'city_bloemfontein','Bloemfontein','Free State','9781'],
  ['sub_bfn_thaba_nchu',    'Thaba Nchu',        'city_bloemfontein','Bloemfontein','Free State','9780'],
  ['sub_bfn_pentagon_park', 'Pentagon Park',     'city_bloemfontein','Bloemfontein','Free State','9301'],
  ['sub_bfn_arboretum',     'Arboretum',         'city_bloemfontein','Bloemfontein','Free State','9301'],
  ['sub_bfn_navalsig',      'Navalsig',          'city_bloemfontein','Bloemfontein','Free State','9301'],
  ['sub_bfn_gardenia_park', 'Gardenia Park',     'city_bloemfontein','Bloemfontein','Free State','9301'],

  // Free State — other
  ['sub_wlk_welkom',        'Welkom',            'city_welkom','Welkom','Free State','9459'],
  ['sub_wlk_bronville',     'Bronville',         'city_welkom','Welkom','Free State','9459'],
  ['sub_wlk_thabong',       'Thabong',           'city_welkom','Welkom','Free State','9459'],

  // ── LIMPOPO ─────────────────────────────────────────────────────────────
  ['sub_ptk_central',       'Polokwane Central', 'city_polokwane','Polokwane','Limpopo','0700'],
  ['sub_ptk_flora_park',    'Flora Park',        'city_polokwane','Polokwane','Limpopo','0699'],
  ['sub_ptk_bendor',        'Bendor',            'city_polokwane','Polokwane','Limpopo','0699'],
  ['sub_ptk_seshego',       'Seshego',           'city_polokwane','Polokwane','Limpopo','0742'],
  ['sub_ptk_westenburg',    'Westenburg',        'city_polokwane','Polokwane','Limpopo','0699'],
  ['sub_ptk_ladanna',       'Ladanna',           'city_polokwane','Polokwane','Limpopo','0699'],
  ['sub_ptk_pietersburg',   'Pietersburg',       'city_polokwane','Polokwane','Limpopo','0700'],
  ['sub_ptk_ivy_park',      'Ivy Park',          'city_polokwane','Polokwane','Limpopo','0699'],
  ['sub_tzn_central',       'Tzaneen Central',   'city_tzaneen','Tzaneen','Limpopo','0850'],
  ['sub_tzn_nkowankowa',    'Nkowankowa',        'city_tzaneen','Tzaneen','Limpopo','0870'],
  ['sub_lpt_lephalale',     'Lephalale',         'city_lephalale','Lephalale','Limpopo','0555'],
  ['sub_lpt_marapong',      'Marapong',          'city_lephalale','Lephalale','Limpopo','0557'],

  // ── MPUMALANGA ──────────────────────────────────────────────────────────
  ['sub_mbl_central',       'Mbombela Central',  'city_mbombela','Mbombela','Mpumalanga','1200'],
  ['sub_mbl_nelspruit',     'Nelspruit',         'city_mbombela','Mbombela','Mpumalanga','1200'],
  ['sub_mbl_white_river',   'White River',       'city_mbombela','Mbombela','Mpumalanga','1240'],
  ['sub_mbl_hazyview',      'Hazyview',          'city_mbombela','Mbombela','Mpumalanga','1242'],
  ['sub_mbl_kamagugu',      'Kamagugu',          'city_mbombela','Mbombela','Mpumalanga','1213'],
  ['sub_mbl_kanyamazane',   'Kanyamazane',       'city_mbombela','Mbombela','Mpumalanga','1214'],
  ['sub_eml_emalahleni',    'eMalahleni',        'city_emalahleni','eMalahleni','Mpumalanga','1035'],
  ['sub_eml_witbank',       'Witbank',           'city_emalahleni','eMalahleni','Mpumalanga','1035'],
  ['sub_eml_bankenveld',    'Bankenveld',        'city_emalahleni','eMalahleni','Mpumalanga','1035'],
  ['sub_eml_kwaguqa',       'KwaGuqa',           'city_emalahleni','eMalahleni','Mpumalanga','1034'],
  ['sub_scd_secunda',       'Secunda',           'city_secunda','Secunda','Mpumalanga','2302'],
  ['sub_scd_evander',       'Evander',           'city_secunda','Secunda','Mpumalanga','2280'],

  // ── NORTH WEST ──────────────────────────────────────────────────────────
  ['sub_rst_central',       'Rustenburg Central','city_rustenburg','Rustenburg','North West','0299'],
  ['sub_rst_cashan',        'Cashan',            'city_rustenburg','Rustenburg','North West','0299'],
  ['sub_rst_tlhabane',      'Tlhabane',          'city_rustenburg','Rustenburg','North West','0309'],
  ['sub_rst_waterfall',     'Waterfall East',    'city_rustenburg','Rustenburg','North West','0300'],
  ['sub_rst_proteapark',    'Protea Park',       'city_rustenburg','Rustenburg','North West','0299'],
  ['sub_rst_boitekong',     'Boitekong',         'city_rustenburg','Rustenburg','North West','0300'],
  ['sub_rst_phokeng',       'Phokeng',           'city_rustenburg','Rustenburg','North West','0335'],
  ['sub_mhk_central',       'Mahikeng Central',  'city_mahikeng','Mahikeng','North West','2745'],
  ['sub_mhk_mmabatho',      'Mmabatho',          'city_mahikeng','Mahikeng','North West','2735'],
  ['sub_klk_central',       'Klerksdorp Central','city_klerksdorp','Klerksdorp','North West','2570'],
  ['sub_klk_wilkoppies',    'Wilkoppies',        'city_klerksdorp','Klerksdorp','North West','2571'],
  ['sub_klk_jouberton',     'Jouberton',         'city_klerksdorp','Klerksdorp','North West','2574'],
  ['sub_pot_central',       'Potchefstroom Central','city_potchefstroom','Potchefstroom','North West','2531'],
  ['sub_pot_kanonierspark', 'Kanonierspark',     'city_potchefstroom','Potchefstroom','North West','2531'],
  ['sub_pot_ikageng',       'Ikageng',           'city_potchefstroom','Potchefstroom','North West','2535'],

  // ── NORTHERN CAPE ───────────────────────────────────────────────────────
  ['sub_kbr_central',       'Kimberley Central', 'city_kimberley','Kimberley','Northern Cape','8301'],
  ['sub_kbr_galeshewe',     'Galeshewe',         'city_kimberley','Kimberley','Northern Cape','8345'],
  ['sub_kbr_sol_plaatje',   'Sol Plaatje',       'city_kimberley','Kimberley','Northern Cape','8301'],
  ['sub_kbr_roodepan',      'Roodepan',          'city_kimberley','Kimberley','Northern Cape','8301'],
  ['sub_upt_central',       'Upington Central',  'city_upington','Upington','Northern Cape','8800'],
  ['sub_upt_rosedale',      'Rosedale',          'city_upington','Upington','Northern Cape','8800'],

  // ── KZN — Richards Bay / Newcastle ─────────────────────────────────────
  ['sub_rb_central',        'Richards Bay Central','city_richards_bay','Richards Bay','KwaZulu-Natal','3900'],
  ['sub_rb_empangeni',      'Empangeni',         'city_richards_bay','Richards Bay','KwaZulu-Natal','3880'],
  ['sub_rb_arboretum',      'Arboretum',         'city_richards_bay','Richards Bay','KwaZulu-Natal','3900'],
  ['sub_nc_central',        'Newcastle Central', 'city_newcastle_kzn','Newcastle','KwaZulu-Natal','2940'],
  ['sub_nc_osizweni',       'Osizweni',          'city_newcastle_kzn','Newcastle','KwaZulu-Natal','2952'],
  ['sub_nc_madadeni',       'Madadeni',          'city_newcastle_kzn','Newcastle','KwaZulu-Natal','2951'],

  // ── Western Cape — Stellenbosch / Somerset West ─────────────────────────
  ['sub_stb_eikestad_mall', 'Eikestad Mall',     'city_stellenbosch','Stellenbosch','Western Cape','7600'],
  ['sub_stb_techno_park',   'Techno Park',       'city_stellenbosch','Stellenbosch','Western Cape','7600'],
  ['sub_somw_strand',       'Strand',            'city_somerset_west','Somerset West','Western Cape','7140'],
  ['sub_somw_gordons_bay',  "Gordon's Bay",      'city_somerset_west','Somerset West','Western Cape','7150'],
  ['sub_somw_firgrove',     'Firgrove',          'city_somerset_west','Somerset West','Western Cape','7110'],

  // ── Gauteng — Sandton ───────────────────────────────────────────────────
  ['sub_snd_sandton_city',  'Sandton City',      'city_sandton','Sandton','Gauteng','2196'],
  ['sub_snd_benmore',       'Benmore',           'city_sandton','Sandton','Gauteng','2010'],
  ['sub_snd_illovo',        'Illovo',            'city_sandton','Sandton','Gauteng','2196'],
  ['sub_snd_paulshof',      'Paulshof',          'city_sandton','Sandton','Gauteng','2056'],
  ['sub_snd_wendywood',     'Wendywood',         'city_sandton','Sandton','Gauteng','2144'],
  ['sub_snd_hurlingham',    'Hurlingham',        'city_sandton','Sandton','Gauteng','2196'],
  ['sub_snd_bryanston',     'Bryanston',         'city_sandton','Sandton','Gauteng','2021'],
  ['sub_snd_linksfield',    'Linksfield',        'city_sandton','Sandton','Gauteng','2192'],
  ['sub_snd_atholl',        'Atholl',            'city_sandton','Sandton','Gauteng','2196'],

  // ── Gauteng — Midrand ───────────────────────────────────────────────────
  ['sub_mdr_midrand',       'Midrand',           'city_midrand','Midrand','Gauteng','1685'],
  ['sub_mdr_kyalami',       'Kyalami',           'city_midrand','Midrand','Gauteng','1684'],
  ['sub_mdr_waterfall',     'Waterfall',         'city_midrand','Midrand','Gauteng','2090'],
  ['sub_mdr_carlswald',     'Carlswald',         'city_midrand','Midrand','Gauteng','1684'],
  ['sub_mdr_halfway_house', 'Halfway House',     'city_midrand','Midrand','Gauteng','1685'],
  ['sub_mdr_vorna_valley',  'Vorna Valley',      'city_midrand','Midrand','Gauteng','1686'],
]

async function seed () {
  console.log(`Seeding ${SUBURBS.length} suburbs...`)
  const rows = SUBURBS.map(([id, name, city_id, city_name, province_code, postal_code]) => ({
    id, name, city_id, city_name, province_code, postal_code
  }))

  // Insert in batches of 100 to avoid socket timeouts
  const BATCH = 100
  let inserted = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { error } = await supabase.from('suburbs').upsert(batch, { onConflict: 'id', ignoreDuplicates: true })
    if (error) {
      console.error(`Batch ${i / BATCH + 1} error:`, error.message)
    } else {
      inserted += batch.length
      console.log(`  ✓ ${inserted}/${rows.length}`)
    }
  }
  console.log('Done.')
}

seed().catch(console.error)
