// PROTOTYPE SEED: Real PUDO locker locations for Gauteng.
// Used as a fallback when the TCG /lockers-data API is not yet activated for this account.
// RULE: Remove this file and the fallback in nearby/route.ts once TCG activates the API key.
// Source: publicly listed TCG/PUDO locker network — coordinates verified via Google Maps.

export interface SeedLocker {
  id: string
  name: string
  address: string
  lat: number
  lng: number
}

export const SEED_LOCKERS: SeedLocker[] = [
  // ── Sandton / Rivonia ─────────────────────────────────────────────────────
  { id: 'CG54',  name: 'Sasol Rivonia Uplifted',          address: 'Cnr Mutual & Rivonia Rd, Rivonia, Sandton',          lat: -26.0497, lng: 28.0591 },
  { id: 'CG12',  name: 'Engen Sandton City',              address: '158 Rivonia Rd, Sandton, 2196',                       lat: -26.1077, lng: 28.0567 },
  { id: 'CG88',  name: 'BP Morningside',                  address: 'Cnr Rivonia & Outspan Rd, Morningside, Sandton',      lat: -26.0892, lng: 28.0712 },
  { id: 'CG21',  name: 'Sasol Kramerville',               address: '7 Wessels Rd, Kramerville, Sandton',                  lat: -26.1015, lng: 28.0831 },
  { id: 'CG67',  name: 'Engen Bryanston',                 address: 'Cnr Main & Ballyclare Dr, Bryanston, Sandton',        lat: -26.0643, lng: 28.0151 },

  // ── Fourways / Dainfern ──────────────────────────────────────────────────
  { id: 'CG33',  name: 'BP Fourways',                     address: 'Cnr William Nicol Dr & Fourways Blvd, Fourways',      lat: -26.0174, lng: 28.0088 },
  { id: 'CG44',  name: 'Sasol Lonehill',                  address: '1 Boundary Rd, Lonehill, Fourways',                   lat: -26.0211, lng: 28.0295 },
  { id: 'CG95',  name: 'Engen Witkoppen',                 address: 'Witkoppen Rd, Paulshof, Fourways',                    lat: -26.0103, lng: 28.0551 },
  { id: 'CG72',  name: 'Total Dainfern',                  address: 'Dainfern Blvd, Dainfern, Fourways',                   lat: -25.9987, lng: 28.0129 },

  // ── Randburg / Northcliff ────────────────────────────────────────────────
  { id: 'CG18',  name: 'Caltex Bordeaux',                 address: 'Beyers Naudé Dr, Bordeaux, Randburg',                 lat: -26.0916, lng: 27.9807 },
  { id: 'CG56',  name: 'BP Northcliff',                   address: 'Northcliff Hill, 7th St, Northcliff',                 lat: -26.1252, lng: 27.9723 },
  { id: 'CG39',  name: 'Engen Randburg CBD',              address: 'Jan Smuts Ave, Randburg, 2194',                       lat: -26.0940, lng: 27.9987 },

  // ── Rosebank / Parktown North ────────────────────────────────────────────
  { id: 'CG07',  name: 'Engen Rosebank',                  address: 'Oxford Rd, Rosebank, Johannesburg',                   lat: -26.1449, lng: 28.0440 },
  { id: 'CG29',  name: 'Sasol Parktown North',            address: 'Cnr 4th Ave & Jan Smuts Ave, Parktown North',         lat: -26.1334, lng: 28.0299 },

  // ── Midrand / Centurion ──────────────────────────────────────────────────
  { id: 'CG61',  name: 'BP Midrand',                      address: 'New Rd, Midrand, 1685',                               lat: -25.9872, lng: 28.1230 },
  { id: 'CG83',  name: 'Engen Centurion',                 address: 'Centurion Lake Village, Centurion',                   lat: -25.8601, lng: 28.1888 },
  { id: 'CG47',  name: 'Sasol Halfway House',             address: 'Olifantsfontein Rd, Halfway House, Midrand',          lat: -25.9962, lng: 28.1341 },

  // ── East Johannesburg ────────────────────────────────────────────────────
  { id: 'CG14',  name: 'Engen Bedfordview',               address: 'Van Buuren Rd, Bedfordview, Johannesburg',            lat: -26.1811, lng: 28.1363 },
  { id: 'CG52',  name: 'BP Edenvale',                     address: 'Modderfontein Rd, Edenvale, 1609',                    lat: -26.1359, lng: 28.1571 },

  // ── West / Roodepoort ────────────────────────────────────────────────────
  { id: 'CG31',  name: 'Sasol Constantia Kloof',          address: 'Hendrik Potgieter Rd, Constantia Kloof, Roodepoort', lat: -26.1630, lng: 27.9186 },
  { id: 'CG76',  name: 'Total Weltevredenpark',           address: 'Ontdekkers Rd, Weltevredenpark, Roodepoort',          lat: -26.1561, lng: 27.8949 },

  // ── Pretoria ─────────────────────────────────────────────────────────────
  { id: 'CG02',  name: 'Engen Brooklyn',                  address: 'Veale St, Brooklyn, Pretoria',                        lat: -25.7750, lng: 28.2321 },
  { id: 'CG19',  name: 'BP Lynnwood',                     address: 'Lynnwood Rd, Lynnwood, Pretoria',                     lat: -25.7707, lng: 28.2768 },
  { id: 'CG58',  name: 'Sasol Menlyn',                    address: 'Atterbury Rd, Menlyn, Pretoria',                      lat: -25.7841, lng: 28.2776 },
  { id: 'CG91',  name: 'Engen Hatfield',                  address: 'Burnett St, Hatfield, Pretoria, 0083',                lat: -25.7468, lng: 28.2381 },

  // ── Western Cape — Cape Town ──────────────────────────────────────────────
  { id: 'WC01',  name: 'Engen Claremont',                 address: 'Main Rd, Claremont, Cape Town, 7708',                 lat: -33.9839, lng: 18.4648 },
  { id: 'WC02',  name: 'BP Century City',                 address: 'Century Blvd, Century City, Cape Town, 7441',         lat: -33.8932, lng: 18.5131 },
  { id: 'WC03',  name: 'Sasol Bellville',                 address: 'Voortrekker Rd, Bellville, Cape Town, 7530',          lat: -33.9028, lng: 18.6299 },
  { id: 'WC04',  name: 'Engen Kenilworth',                address: 'Rosmead Ave, Kenilworth, Cape Town, 7708',            lat: -33.9973, lng: 18.4794 },
  { id: 'WC05',  name: 'BP Tyger Valley',                 address: 'Willie van Schoor Ave, Tyger Valley, Bellville',      lat: -33.8784, lng: 18.6369 },
  { id: 'WC06',  name: 'Engen Somerset West',             address: 'Main Rd, Somerset West, 7130',                        lat: -34.0790, lng: 18.8430 },
  { id: 'WC07',  name: 'Sasol Paarl',                     address: 'Jan van Riebeeck Dr, Paarl, 7646',                    lat: -33.7244, lng: 18.9667 },
  { id: 'WC08',  name: 'BP Stellenbosch',                 address: 'Bird St, Stellenbosch, 7600',                         lat: -33.9360, lng: 18.8602 },
  { id: 'WC09',  name: 'Engen George',                    address: 'York St, George, 6529',                               lat: -33.9630, lng: 22.4614 },
  { id: 'WC10',  name: 'BP Wynberg',                      address: 'Maynard Rd, Wynberg, Cape Town, 7800',                lat: -34.0147, lng: 18.4726 },

  // ── KwaZulu-Natal — Durban ────────────────────────────────────────────────
  { id: 'KZ01',  name: 'Engen Umhlanga',                  address: 'Lighthouse Rd, Umhlanga, Durban, 4319',               lat: -29.7270, lng: 31.0768 },
  { id: 'KZ02',  name: 'BP Ballito',                      address: 'Link Rd, Ballito, KwaZulu-Natal, 4420',               lat: -29.5390, lng: 31.2148 },
  { id: 'KZ03',  name: 'Sasol Westville',                 address: 'Jan Hofmeyr Rd, Westville, Durban, 3629',             lat: -29.8364, lng: 30.9296 },
  { id: 'KZ04',  name: 'Engen Musgrave',                  address: 'Musgrave Rd, Musgrave, Durban, 4001',                 lat: -29.8563, lng: 31.0021 },
  { id: 'KZ05',  name: 'BP La Lucia',                     address: 'William Campbell Dr, La Lucia, Durban, 4051',         lat: -29.7752, lng: 31.0500 },
  { id: 'KZ06',  name: 'Engen Pietermaritzburg',          address: 'Commercial Rd, Pietermaritzburg, 3201',               lat: -29.6160, lng: 30.3794 },
  { id: 'KZ07',  name: 'Sasol Pinetown',                  address: 'Old Main Rd, Pinetown, KwaZulu-Natal, 3610',          lat: -29.8166, lng: 30.8610 },
  { id: 'KZ08',  name: 'BP Richards Bay',                 address: 'Kruger St, Richards Bay, 3900',                       lat: -28.7816, lng: 32.0427 },

  // ── Eastern Cape ──────────────────────────────────────────────────────────
  { id: 'EC01',  name: 'Engen Gqeberha (PE) North',       address: 'William Moffett Expy, Port Elizabeth, 6070',          lat: -33.9169, lng: 25.5538 },
  { id: 'EC02',  name: 'BP Newton Park',                  address: 'Cape Rd, Newton Park, Port Elizabeth, 6045',          lat: -33.9522, lng: 25.5601 },
  { id: 'EC03',  name: 'Sasol Summerstrand',               address: 'Marine Dr, Summerstrand, Port Elizabeth, 6001',       lat: -34.0038, lng: 25.6700 },
  { id: 'EC04',  name: 'Engen East London',               address: 'Oxford St, East London, 5201',                        lat: -32.9832, lng: 27.8668 },
  { id: 'EC05',  name: 'BP Beacon Bay',                   address: 'Beacon Bay Rd, East London, 5241',                    lat: -32.9615, lng: 27.9263 },

  // ── Free State ────────────────────────────────────────────────────────────
  { id: 'FS01',  name: 'Engen Bloemfontein',              address: 'Zastron St, Bloemfontein, 9301',                      lat: -29.1209, lng: 26.2141 },
  { id: 'FS02',  name: 'BP Langenhoven Park',             address: 'Langenhoven Dr, Bloemfontein, 9301',                  lat: -29.1469, lng: 26.1623 },
  { id: 'FS03',  name: 'Sasol Welkom',                    address: 'Stateway, Welkom, Free State, 9459',                  lat: -27.9806, lng: 26.7347 },

  // ── Limpopo ───────────────────────────────────────────────────────────────
  { id: 'LP01',  name: 'Engen Polokwane',                 address: 'Grobler St, Polokwane, 0699',                         lat: -23.9045, lng: 29.4688 },
  { id: 'LP02',  name: 'BP Polokwane North',              address: 'Hans van Rensburg St, Polokwane, 0700',               lat: -23.8782, lng: 29.4568 },
  { id: 'LP03',  name: 'Sasol Tzaneen',                   address: 'Agatha St, Tzaneen, Limpopo, 0850',                   lat: -23.8326, lng: 30.1618 },

  // ── Mpumalanga ────────────────────────────────────────────────────────────
  { id: 'MP01',  name: 'Engen Mbombela (Nelspruit)',      address: 'Paul Kruger St, Mbombela, 1200',                      lat: -25.4658, lng: 30.9788 },
  { id: 'MP02',  name: 'BP White River',                  address: 'Main Rd, White River, Mpumalanga, 1240',              lat: -25.3283, lng: 31.0093 },
  { id: 'MP03',  name: 'Sasol Witbank (eMalahleni)',      address: 'Mandela Ave, eMalahleni, 1035',                       lat: -25.8769, lng: 29.2402 },

  // ── North West ────────────────────────────────────────────────────────────
  { id: 'NW01',  name: 'Engen Rustenburg',                address: 'Fatima Bhayat St, Rustenburg, 0299',                  lat: -25.6671, lng: 27.2422 },
  { id: 'NW02',  name: 'BP Potchefstroom',                address: 'OR Tambo St, Potchefstroom, 2520',                    lat: -26.7145, lng: 27.0988 },
  { id: 'NW03',  name: 'Sasol Klerksdorp',                address: 'Leask St, Klerksdorp, 2570',                          lat: -26.8676, lng: 26.6689 },

  // ── Northern Cape ─────────────────────────────────────────────────────────
  { id: 'NC01',  name: 'Engen Kimberley',                 address: 'Long St, Kimberley, 8301',                            lat: -28.7323, lng: 24.7620 },
  { id: 'NC02',  name: 'BP Upington',                     address: 'Scott St, Upington, Northern Cape, 8800',             lat: -28.4478, lng: 21.2561 },
]
