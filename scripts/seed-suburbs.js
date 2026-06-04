/**
 * NextKid — South Africa Full Suburbs Seeder
 *
 * Downloads the complete SA postal-code dataset from a public source
 * and seeds all suburbs into Supabase.
 *
 * ── HOW TO USE ──────────────────────────────────────────────────
 *
 * OPTION A — Auto-download (tries public GitHub mirror):
 *   node scripts/seed-suburbs.js
 *
 * OPTION B — Use a local CSV file (more reliable):
 *   1. Download from ONE of these free sources:
 *      • OpenDB:   https://opendb.co.za/db/ZA_postal_codes/ZA_postal_codes.csv
 *      • DataHub:  https://datahub.io/core/south-africa-postal-codes
 *      • GeoNames: https://download.geonames.org/export/zip/ZA.zip  (extract ZA.txt)
 *   2. Save the file as:  scripts/sa-postcodes.csv
 *   3. Run:  node scripts/seed-suburbs.js
 *
 * ── EXPECTED CSV COLUMNS (auto-detected) ────────────────────────
 *   OpenDB/DataHub:  PostalCode, Suburb, City, Province
 *   GeoNames ZA.txt: tab-separated: country,postal,place,admin1,...
 * ────────────────────────────────────────────────────────────────
 */

require('./node_modules/dotenv').config({ path: '../apps/web/.env.local' })
const { createClient } = require('../node_modules/@supabase/supabase-js')
const fs   = require('fs')
const path = require('path')
const https = require('https')
const http  = require('http')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Province name normaliser ─────────────────────────────────────────────────
const PROVINCE_MAP = {
  'western cape':   'Western Cape',
  'wc':             'Western Cape',
  'eastern cape':   'Eastern Cape',
  'ec':             'Eastern Cape',
  'kwazulu-natal':  'KwaZulu-Natal',
  'kwazulu natal':  'KwaZulu-Natal',
  'kzn':            'KwaZulu-Natal',
  'gauteng':        'Gauteng',
  'gp':             'Gauteng',
  'gt':             'Gauteng',
  'free state':     'Free State',
  'fs':             'Free State',
  'limpopo':        'Limpopo',
  'lp':             'Limpopo',
  'mpumalanga':     'Mpumalanga',
  'mp':             'Mpumalanga',
  'north west':     'North West',
  'nw':             'North West',
  'northern cape':  'Northern Cape',
  'nc':             'Northern Cape',
}

function normaliseProvince(raw) {
  if (!raw) return null
  return PROVINCE_MAP[raw.trim().toLowerCase()] ?? raw.trim()
}

// ── Simple CSV parser ────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []

  // Detect delimiter
  const first = lines[0]
  const delim = first.includes('\t') ? '\t' : ','

  const headers = first.split(delim).map(h => h.replace(/^"|"$/g, '').trim().toLowerCase())

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delim).map(c => c.replace(/^"|"$/g, '').trim())
    const row = {}
    headers.forEach((h, idx) => { row[h] = cols[idx] ?? '' })
    rows.push(row)
  }
  return rows
}

// ── Column-name guessing ─────────────────────────────────────────────────────
function extractFields(row) {
  // Try various column naming conventions
  const suburb   = row['suburb']    || row['place name'] || row['place_name'] || row['suburb_name'] || row['name']   || ''
  const city     = row['city']      || row['municipality']|| row['admin2']    || row['admin_name2'] || row['town']   || ''
  const province = row['province']  || row['admin1']     || row['admin_name1']|| row['state']      || ''
  const postal   = row['postalcode']|| row['postal_code'] || row['postal code']|| row['postcode']  || row['zip']    || ''
  return { suburb: suburb.trim(), city: city.trim(), province: province.trim(), postal: postal.trim() }
}

// ── Fetch helper ─────────────────────────────────────────────────────────────
function fetchURL(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    lib.get(url, { headers: { 'User-Agent': 'NextKid-seeder/1.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchURL(res.headers.location).then(resolve).catch(reject)
        return
      }
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve(data))
      res.on('error', reject)
    }).on('error', reject)
  })
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function seed() {
  let csvText = ''

  // 1. Try local file first
  const localPath = path.join(__dirname, 'sa-postcodes.csv')
  if (fs.existsSync(localPath)) {
    console.log('Reading local file:', localPath)
    csvText = fs.readFileSync(localPath, 'utf8')
  } else {
    // 2. Try public GitHub mirror of OpenDB SA postal codes
    const URLS = [
      'https://raw.githubusercontent.com/nickkearney/south-african-addresses/main/postal_codes.csv',
      'https://raw.githubusercontent.com/CodeForAfrica/southernhemisphere/main/data/ZA_postal_codes.csv',
    ]
    for (const url of URLS) {
      try {
        console.log('Trying:', url)
        csvText = await fetchURL(url)
        if (csvText.length > 1000) { console.log('  ✓ Downloaded', csvText.length, 'bytes'); break }
      } catch (e) {
        console.log('  ✗ Failed:', e.message)
      }
    }
  }

  if (!csvText || csvText.length < 100) {
    console.error(`
No data found. Please:
  1. Download the CSV from:
     https://opendb.co.za/db/ZA_postal_codes/ZA_postal_codes.csv
     OR
     https://download.geonames.org/export/zip/ZA.zip  (extract ZA.txt, rename to sa-postcodes.csv)
  2. Save it as: scripts/sa-postcodes.csv
  3. Re-run: node scripts/seed-suburbs.js
`)
    process.exit(1)
  }

  const rows = parseCSV(csvText)
  console.log(`Parsed ${rows.length} rows`)

  // Build suburb records, deduplicate by composite key
  const seen   = new Set()
  const suburbs = []
  // Also collect unique cities for upsert
  const cities = new Map()

  for (const row of rows) {
    const { suburb, city, province, postal } = extractFields(row)
    if (!suburb || !city) continue

    const prov = normaliseProvince(province)
    if (!prov) continue

    const key  = `${suburb.toLowerCase()}|${city.toLowerCase()}|${prov}`
    if (seen.has(key)) continue
    seen.add(key)

    const cityId  = `city_${city.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}`
    const suburbId = `sub_${suburb.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}_${postal || Math.random().toString(36).slice(2, 6)}`

    if (!cities.has(cityId)) {
      cities.set(cityId, { id: cityId, name: city, province_code: prov, latitude: null, longitude: null })
    }

    suburbs.push({ id: suburbId, name: suburb, city_id: cityId, city_name: city, province_code: prov, postal_code: postal || null })
  }

  console.log(`Found ${cities.size} unique cities and ${suburbs.length} unique suburbs`)

  // Upsert cities first
  const cityArr = Array.from(cities.values())
  console.log('\nUpserting cities...')
  const BATCH = 100
  for (let i = 0; i < cityArr.length; i += BATCH) {
    const { error } = await supabase.from('cities').upsert(cityArr.slice(i, i + BATCH), { onConflict: 'id', ignoreDuplicates: true })
    if (error) console.error('  City batch error:', error.message)
    else process.stdout.write(`  ${Math.min(i + BATCH, cityArr.length)}/${cityArr.length}\r`)
  }
  console.log('\nCities done.')

  // Upsert suburbs in batches
  console.log('\nUpserting suburbs...')
  let done = 0
  for (let i = 0; i < suburbs.length; i += BATCH) {
    const { error } = await supabase.from('suburbs').upsert(suburbs.slice(i, i + BATCH), { onConflict: 'id', ignoreDuplicates: true })
    if (error) {
      console.error(`  Suburb batch error (row ${i}):`, error.message)
    } else {
      done += Math.min(BATCH, suburbs.length - i)
      process.stdout.write(`  ${done}/${suburbs.length}\r`)
    }
  }
  console.log(`\nSuburbs done — ${done} inserted/updated.`)
}

seed().catch(console.error)
