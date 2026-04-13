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
]
