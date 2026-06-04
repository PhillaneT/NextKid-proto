/**
 * NextKid — SA Suburbs Seeder (OpenDB format)
 *
 * Reads the OpenDB CSV: scripts/dbe-data/opendb-*.csv
 *
 * Column layout:
 *   id, parent, place_type, place_code, code_type,
 *   eng, afr, nbl, xho, zul, nso, sot, tsn, ssw, ven, tso,
 *   street_code, box_code, latitude, longitude, last_modified
 *
 * HOW TO USE:
 *   node scripts/seed-suburbs.js
 */

require('./node_modules/dotenv').config({ path: '../apps/web/.env.local' })
const { createClient } = require('../node_modules/@supabase/supabase-js')
const fs   = require('fs')
const path = require('path')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Province code normaliser ─────────────────────────────────────────────────
const PROVINCE_CODES = {
  'western cape':   'Western Cape',
  'eastern cape':   'Eastern Cape',
  'kwazulu-natal':  'KwaZulu-Natal',
  'gauteng':        'Gauteng',
  'free state':     'Free State',
  'limpopo':        'Limpopo',
  'mpumalanga':     'Mpumalanga',
  'north west':     'North West',
  'northern cape':  'Northern Cape',
}

// ── Find the CSV file in dbe-data/ ───────────────────────────────────────────
const dbeDir = path.join(__dirname, 'dbe-data')
const csvFile = fs.readdirSync(dbeDir).find(f => f.endsWith('.csv') && f.toLowerCase().includes('opendb'))
if (!csvFile) {
  console.error('No opendb CSV found in scripts/dbe-data/. Download from opendb.co.za and save it there.')
  process.exit(1)
}
const csvPath = path.join(dbeDir, csvFile)
console.log('Using:', csvPath)

// ── Parse CSV ────────────────────────────────────────────────────────────────
const lines  = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/).filter(l => l.trim())
const header = lines[0].split(',').map(h => h.trim())

function parseRow(line) {
  // Handle commas inside quoted fields
  const cols = []
  let cur = '', inQ = false
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ }
    else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = '' }
    else cur += ch
  }
  cols.push(cur.trim())
  const obj = {}
  header.forEach((h, i) => { obj[h] = cols[i] ?? '' })
  return obj
}

const allRows = lines.slice(1).map(parseRow)

// ── Build ID → row lookup ────────────────────────────────────────────────────
const byId = new Map()
for (const row of allRows) byId.set(row.id, row)

// ── Trace province for a given row ──────────────────────────────────────────
function getProvince(row) {
  let cur = row
  for (let depth = 0; depth < 10; depth++) {
    if (cur.place_type === 'province') {
      return PROVINCE_CODES[cur.eng?.toLowerCase()] ?? cur.eng
    }
    if (!cur.parent || !byId.has(cur.parent)) break
    cur = byId.get(cur.parent)
  }
  return null
}

// ── Get parent municipality/city name (used as "city" in our schema) ─────────
function getParentCityName(row) {
  let cur = row
  for (let depth = 0; depth < 10; depth++) {
    const parent = byId.get(cur.parent)
    if (!parent) break
    if (['local_municipality', 'metro_municipality', 'city', 'district_municipality'].includes(parent.place_type)) {
      return parent.eng || null
    }
    cur = parent
  }
  return null
}

// ── Filter: towns, suburbs, cities ──────────────────────────────────────────
const INCLUDE_TYPES = new Set(['town', 'suburb', 'city'])
const places = allRows.filter(r => INCLUDE_TYPES.has(r.place_type) && r.eng?.trim())

console.log(`Found ${places.length} towns/suburbs/cities in CSV`)

// ── Build unique city list ───────────────────────────────────────────────────
const citiesMap = new Map()   // cityId → { id, name, province_code, latitude, longitude }
const suburbRows = []

for (const row of places) {
  const name     = row.eng.trim()
  const province = getProvince(row)
  if (!province) continue

  const cityName = getParentCityName(row) || name
  const cityId   = 'city_' + cityName.toLowerCase()
    .replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/, '')

  if (!citiesMap.has(cityId)) {
    citiesMap.set(cityId, {
      id:            cityId,
      name:          cityName,
      province_code: province,
      latitude:      null,
      longitude:     null,
    })
  }

  const postal   = row.street_code?.trim() || row.box_code?.trim() || null
  const suburbId = 'sub_' + name.toLowerCase()
    .replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/, '')
    + '_' + (postal || row.id.slice(-4))

  suburbRows.push({
    id:            suburbId,
    name,
    city_id:       cityId,
    city_name:     cityName,
    province_code: province,
    postal_code:   postal,
  })
}

console.log(`Prepared ${citiesMap.size} cities and ${suburbRows.length} suburbs`)

// ── Batch upsert ─────────────────────────────────────────────────────────────
async function batchUpsert(table, rows) {
  const BATCH = 100
  let done = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase
      .from(table)
      .upsert(rows.slice(i, i + BATCH), { onConflict: 'id', ignoreDuplicates: true })
    if (error) console.error(`  ${table} batch error:`, error.message)
    else {
      done += Math.min(BATCH, rows.length - i)
      process.stdout.write(`  ${table}: ${done}/${rows.length}\r`)
    }
  }
  console.log(`  ${table}: ${done}/${rows.length} done       `)
}

async function seed() {
  console.log('\nUpserting cities...')
  await batchUpsert('cities', Array.from(citiesMap.values()))

  console.log('Upserting suburbs...')
  await batchUpsert('suburbs', suburbRows)

  console.log('\nAll done!')
}

seed().catch(console.error)
