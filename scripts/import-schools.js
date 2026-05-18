/**
 * NextKid — SA Schools Import Script
 *
 * Downloads all South African schools from the DBE EMIS Excel files
 * and imports them into your Supabase schools table.
 *
 * HOW TO USE:
 *   1. Download Excel files from https://www.education.gov.za/Programmes/EMIS/EMISDownloads.aspx
 *   2. Save them into the  scripts/dbe-data/  folder
 *   3. Run:  node scripts/import-schools.js
 */

require('./node_modules/dotenv').config({ path: '../apps/web/.env.local' })

const XLSX       = require('./node_modules/xlsx')
const { createClient } = require('../node_modules/@supabase/supabase-js')
const fs         = require('fs')
const path       = require('path')

// ── Supabase (service role bypasses RLS for bulk inserts) ────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Province name normalisation ───────────────────────────────────────────────
// DBE files use different capitalisations — map them all to our standard names.
const PROVINCE_MAP = {
  // Abbreviations used in the National file
  'ec':  'Eastern Cape',
  'fs':  'Free State',
  'gt':  'Gauteng',
  'gp':  'Gauteng',
  'kzn': 'KwaZulu-Natal',
  'lp':  'Limpopo',
  'mp':  'Mpumalanga',
  'nc':  'Northern Cape',
  'nw':  'North West',
  'wc':  'Western Cape',
  // Full names (fallback)
  'eastern cape':   'Eastern Cape',
  'free state':     'Free State',
  'gauteng':        'Gauteng',
  'kwazulu-natal':  'KwaZulu-Natal',
  'kwazulu natal':  'KwaZulu-Natal',
  'limpopo':        'Limpopo',
  'mpumalanga':     'Mpumalanga',
  'northern cape':  'Northern Cape',
  'north west':     'North West',
  'western cape':   'Western Cape',
}

// ── School type mapping ───────────────────────────────────────────────────────
const TYPE_MAP = {
  'primary school':             'PRIMARY',
  'primary':                    'PRIMARY',
  'secondary school':           'SECONDARY',
  'secondary':                  'SECONDARY',
  'combined school':            'COMBINED',
  'combined':                   'COMBINED',
  'intermediate school':        'INTERMEDIATE',
  'intermediate':               'INTERMEDIATE',
  'pre-primary':                'ECD',
  'early childhood development':'ECD',
  'ecd':                        'ECD',
  'special school':             'SPECIAL_NEEDS',
  'special needs':              'SPECIAL_NEEDS',
  'special':                    'SPECIAL_NEEDS',
  'college':                    'COLLEGE',
  'university':                 'UNIVERSITY',
}

// ── Slug helper — makes a simple ID from a string ────────────────────────────
function slug(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60)
}

// ── Find a column in the Excel headers (case-insensitive, partial match) ─────
function findCol(headers, ...candidates) {
  for (const candidate of candidates) {
    const found = headers.find(h =>
      h && h.toString().toLowerCase().includes(candidate.toLowerCase())
    )
    if (found) return found
  }
  return null
}

// ── In-memory lookup maps (populated by bulk insert before schools) ───────────
const cityCache   = new Map()  // "Province__CityName" → cityId
const suburbCache = new Map()  // "cityId__SuburbName" → suburbId

async function bulkInsertCities(rows, COL, PROVINCE_MAP) {
  const cities = new Map()
  for (const row of rows) {
    const rawProvince = String(row[COL.province] || '').trim().toLowerCase()
    const province    = PROVINCE_MAP[rawProvince]
    if (!province) continue
    const cityName = String(row[COL.city] || row[COL.suburb] || '').trim()
    if (!cityName) continue
    const key = `${province}__${cityName}`
    if (!cities.has(key)) {
      cities.set(key, { id: `city_${slug(province)}_${slug(cityName)}`, name: cityName, province_code: province })
    }
  }
  const batch = [...cities.values()]
  console.log(`  Upserting ${batch.length} cities...`)
  for (let i = 0; i < batch.length; i += 200) {
    const { error } = await supabase.from('cities')
      .upsert(batch.slice(i, i + 200), { onConflict: 'id', ignoreDuplicates: true })
    if (error) console.error('  Cities batch error:', error.message)
  }
  // Populate cache
  for (const [key, city] of cities) cityCache.set(key, city.id)
  console.log(`  ✓ Cities done`)
}

async function bulkInsertSuburbs(rows, COL, PROVINCE_MAP) {
  const suburbs = new Map()
  for (const row of rows) {
    const rawProvince = String(row[COL.province] || '').trim().toLowerCase()
    const province    = PROVINCE_MAP[rawProvince]
    if (!province) continue
    const cityName   = String(row[COL.city]    || row[COL.suburb] || '').trim()
    const suburbName = String(row[COL.suburb]  || row[COL.city]   || '').trim()
    if (!suburbName || !cityName) continue
    const cityId = cityCache.get(`${province}__${cityName}`)
    if (!cityId) continue
    const key = `${cityId}__${suburbName}`
    if (!suburbs.has(key)) {
      suburbs.set(key, {
        id: `suburb_${slug(province)}_${slug(cityName)}_${slug(suburbName)}`,
        name: suburbName, city_id: cityId, city_name: cityName, province_code: province
      })
    }
  }
  const batch = [...suburbs.values()]
  console.log(`  Upserting ${batch.length} suburbs...`)
  for (let i = 0; i < batch.length; i += 200) {
    const { error } = await supabase.from('suburbs')
      .upsert(batch.slice(i, i + 200), { onConflict: 'id', ignoreDuplicates: true })
    if (error) console.error('  Suburbs batch error:', error.message)
  }
  // Populate cache
  for (const [key, suburb] of suburbs) suburbCache.set(key, suburb.id)
  console.log(`  ✓ Suburbs done`)
}

// ── Process one Excel file ────────────────────────────────────────────────────
async function processFile(filePath) {
  console.log(`\n📂 Reading: ${path.basename(filePath)}`)

  const workbook = XLSX.readFile(filePath)
  const sheetName = workbook.SheetNames[0]
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' })

  if (rows.length === 0) {
    console.log('  ⚠  No rows found — skipping')
    return 0
  }

  const headers = Object.keys(rows[0])
  console.log(`  Found ${rows.length} rows | Columns: ${headers.slice(0, 8).join(', ')}...`)

  // Detect column names (DBE files vary between downloads)
  const COL = {
    emis:     findCol(headers, 'emis', 'institution id', 'school id'),
    name:     findCol(headers, 'institution name', 'school name', 'name'),
    province: findCol(headers, 'province'),
    phase:    findCol(headers, 'phase', 'school phase', 'type'),
    sector:   findCol(headers, 'sector', 'ownership'),
    suburb:   findCol(headers, 'suburb', 'sub-place'),
    city:     findCol(headers, 'town', 'city', 'urban'),
    status:   findCol(headers, 'status'),
    quintile: findCol(headers, 'quintile'),
    nofee:    findCol(headers, 'no fee', 'nofee', 'no-fee'),
    lat:      findCol(headers, 'latitude', 'lat'),
    lng:      findCol(headers, 'longitude', 'lng', 'long'),
  }

  console.log(`  Column map: name="${COL.name}" emis="${COL.emis}" province="${COL.province}" phase="${COL.phase}" status="${COL.status}"`)

  if (!COL.name) {
    console.log('  ❌ Could not find school name column — skipping file')
    console.log('  Available columns:', headers.join(', '))
    return 0
  }

  // Debug: print first 3 rows to understand the data
  console.log('\n  Sample rows:')
  rows.slice(0, 3).forEach((row, i) => {
    console.log(`  [${i+1}] name="${row[COL.name]}" province="${row[COL.province]}" status="${row[COL.status]}" phase="${row[COL.phase]}"`)
  })
  console.log()

  // Bulk insert all cities and suburbs first (avoids one-by-one timeout errors)
  await bulkInsertCities(rows, COL, PROVINCE_MAP)
  await bulkInsertSuburbs(rows, COL, PROVINCE_MAP)

  let inserted = 0
  let skipped  = 0
  let skipNoName = 0, skipClosed = 0, skipNoProvince = 0
  const BATCH  = 100
  const unknownProvinces = new Set()

  const schoolBatch = []

  for (const row of rows) {
    const rawName     = String(row[COL.name]   || '').trim()
    const rawProvince = String(row[COL.province]|| '').trim().toLowerCase()
    const rawPhase    = String(row[COL.phase]   || '').trim().toLowerCase()
    const rawSector   = String(row[COL.sector]  || '').trim().toLowerCase()
    const rawCity     = String(row[COL.city]    || '').trim()
    const rawSuburb   = String(row[COL.suburb]  || '').trim()
    const rawStatus   = String(row[COL.status]  || '').trim().toLowerCase()
    const rawEmis     = String(row[COL.emis]    || '').trim()
    const rawQuintile = parseInt(row[COL.quintile]) || null
    const quintile = (rawQuintile >= 1 && rawQuintile <= 5) ? rawQuintile : null
    const rawNoFee    = String(row[COL.nofee]   || '').trim().toLowerCase()
    const lat         = parseFloat(row[COL.lat]) || null
    const lng         = parseFloat(row[COL.lng]) || null

    if (!rawName) { skipped++; skipNoName++; continue }

    // Skip closed schools
    if (rawStatus && (rawStatus.includes('clos') || rawStatus === 'n')) {
      skipped++; skipClosed++; continue
    }

    const province = PROVINCE_MAP[rawProvince] || null
    if (!province) {
      skipped++; skipNoProvince++
      unknownProvinces.add(String(row[COL.province] || '').trim())
      continue
    }

    const schoolType = TYPE_MAP[rawPhase] ?? 'COMBINED'
    const sector     = rawSector.includes('ind') ? 'INDEPENDENT' : 'PUBLIC'
    const noFee      = rawNoFee === 'yes' || rawNoFee === 'y' || rawNoFee === '1'

    const cityName   = rawCity   || rawSuburb || province
    const suburbName = rawSuburb || rawCity   || null

    const cityId   = cityCache.get(`${province}__${cityName}`) ?? null
    const suburbId = suburbName
      ? suburbCache.get(`${cityId}__${suburbName}`) ?? null
      : null

    const emisNum  = rawEmis || null
    const schoolId = emisNum
      ? `emis_${emisNum}`
      : `school_${slug(province)}_${slug(rawName)}`

    schoolBatch.push({
      id:            schoolId,
      emis_number:   emisNum,
      name:          rawName,
      type:          schoolType,
      sector,
      province_code: province,
      city_id:       cityId,
      city_name:     cityName,
      suburb_id:     suburbId,
      suburb_name:   suburbName ?? cityName,
      latitude:      lat,
      longitude:     lng,
      quintile:      quintile,
      no_fee_school: noFee,
      is_verified:   true,
      is_active:     true,
    })

    // Insert in batches of 100
    if (schoolBatch.length >= BATCH) {
      const batch = schoolBatch.splice(0, BATCH)
      const { error } = await supabase.from('schools')
        .upsert(batch, { onConflict: 'id', ignoreDuplicates: true })
      if (error) console.error('  Batch error:', error.message)
      else { inserted += batch.length; process.stdout.write('.') }
    }
  }

  // Insert remaining
  if (schoolBatch.length > 0) {
    const { error } = await supabase.from('schools')
      .upsert(schoolBatch, { onConflict: 'id', ignoreDuplicates: true })
    if (error) console.error('  Final batch error:', error.message)
    else inserted += schoolBatch.length
  }

  console.log(`\n  ✅ Inserted: ${inserted} | Skipped: ${skipped}`)
  if (skipNoName)     console.log(`     - No name: ${skipNoName}`)
  if (skipClosed)     console.log(`     - Closed:  ${skipClosed}`)
  if (skipNoProvince) console.log(`     - Unknown province: ${skipNoProvince} | Values seen: ${[...unknownProvinces].slice(0,5).join(', ')}`)
  return inserted
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const dataDir = path.join(__dirname, 'dbe-data')

  if (!fs.existsSync(dataDir)) {
    console.error('❌ Folder not found: scripts/dbe-data/')
    console.error('   Create it and put your DBE Excel files inside.')
    process.exit(1)
  }

  const files = fs.readdirSync(dataDir)
    .filter(f => f.match(/\.(xlsx|xls)$/i))
    .map(f => path.join(dataDir, f))

  if (files.length === 0) {
    console.log('❌ No Excel files found in scripts/dbe-data/')
    console.log('\n📥 Download files from:')
    console.log('   https://www.education.gov.za/Programmes/EMIS/EMISDownloads.aspx')
    console.log('   Download each province file and save into scripts/dbe-data/')
    process.exit(1)
  }

  console.log(`\n🏫 NextKid — SA Schools Import`)
  console.log(`   Found ${files.length} file(s) to process\n`)

  let total = 0
  for (const file of files) {
    total += await processFile(file)
  }

  console.log(`\n🎉 Done! Total schools imported: ${total}`)
  console.log('   Your school search will now find all South African schools.')
}

main().catch(err => { console.error('Fatal error:', err); process.exit(1) })
