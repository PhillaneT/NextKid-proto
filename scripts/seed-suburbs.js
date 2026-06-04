/**
 * NextKid — SA Suburbs Seeder
 * Supports both OpenDB CSV and GeoNames ZA.txt formats.
 * Usage: node scripts/seed-suburbs.js
 */

require('./node_modules/dotenv').config({ path: '../apps/web/.env.local' })
const { createClient } = require('../node_modules/@supabase/supabase-js')
const fs   = require('fs')
const path = require('path')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Infer province from SA postal code ───────────────────────────────────────
function provinceFromPostal(postalStr) {
  const p = parseInt(postalStr)
  if (isNaN(p)) return null
  if (p <= 299)              return 'Gauteng'         // Pretoria
  if (p <= 699)              return 'Limpopo'         // Polokwane, Lephalale
  if (p <= 1099)             return 'Limpopo'         // far north
  if (p <= 1399)             return 'Mpumalanga'
  if (p <= 1599)             return 'Gauteng'         // East Rand
  if (p <= 2199)             return 'Gauteng'         // Johannesburg
  if (p <= 2499)             return 'Gauteng'         // Vaal / south JHB
  if (p <= 2999)             return 'North West'
  if (p <= 4999)             return 'KwaZulu-Natal'
  if (p <= 6999)             return 'Eastern Cape'
  if (p <= 8099)             return 'Western Cape'
  if (p <= 8999)             return 'Northern Cape'
  if (p <= 9299)             return 'Eastern Cape'    // Transkei
  return 'Free State'
}

// ── Map postal code to nearest major city ────────────────────────────────────
function cityFromPostal(p) {
  if (p <= 299)  return { id: 'city_pta',          name: 'Pretoria' }
  if (p <= 699)  return { id: 'city_polokwane',    name: 'Polokwane' }
  if (p <= 1099) return { id: 'city_lephalale',    name: 'Lephalale' }
  if (p <= 1299) return { id: 'city_mbombela',     name: 'Mbombela' }
  if (p <= 1399) return { id: 'city_emalahleni',   name: 'eMalahleni' }
  if (p <= 1499) return { id: 'city_ekurhuleni',   name: 'Ekurhuleni' }
  if (p <= 1599) return { id: 'city_ekurhuleni',   name: 'Ekurhuleni' }
  if (p <= 1799) return { id: 'city_jhb',          name: 'Johannesburg' }
  if (p <= 1999) return { id: 'city_jhb',          name: 'Johannesburg' }
  if (p <= 2199) return { id: 'city_jhb',          name: 'Johannesburg' }
  if (p <= 2299) return { id: 'city_jhb',          name: 'Johannesburg' }
  if (p <= 2499) return { id: 'city_jhb',          name: 'Johannesburg' }
  if (p <= 2599) return { id: 'city_rustenburg',   name: 'Rustenburg' }
  if (p <= 2999) return { id: 'city_mahikeng',     name: 'Mahikeng' }
  if (p <= 3299) return { id: 'city_pmb',          name: 'Pietermaritzburg' }
  if (p <= 3699) return { id: 'city_durban',       name: 'Durban' }
  if (p <= 3999) return { id: 'city_durban',       name: 'Durban' }
  if (p <= 4299) return { id: 'city_durban',       name: 'Durban' }
  if (p <= 4699) return { id: 'city_durban',       name: 'Durban' }
  if (p <= 4999) return { id: 'city_richards_bay', name: 'Richards Bay' }
  if (p <= 5299) return { id: 'city_gqeberha',     name: 'Gqeberha' }
  if (p <= 5799) return { id: 'city_gqeberha',     name: 'Gqeberha' }
  if (p <= 6299) return { id: 'city_east_london',  name: 'East London' }
  if (p <= 6999) return { id: 'city_gqeberha',     name: 'Gqeberha' }
  if (p <= 7199) return { id: 'city_cpt',          name: 'Cape Town' }
  if (p <= 7599) return { id: 'city_cpt',          name: 'Cape Town' }
  if (p <= 7999) return { id: 'city_cpt',          name: 'Cape Town' }
  if (p <= 8099) return { id: 'city_cpt',          name: 'Cape Town' }
  if (p <= 8399) return { id: 'city_kimberley',    name: 'Kimberley' }
  if (p <= 8999) return { id: 'city_upington',     name: 'Upington' }
  if (p <= 9299) return { id: 'city_mthatha',      name: 'Mthatha' }
  if (p <= 9499) return { id: 'city_bloemfontein', name: 'Bloemfontein' }
  return           { id: 'city_bloemfontein',      name: 'Bloemfontein' }
}

// ── Find data file ───────────────────────────────────────────────────────────
const dbeDir  = path.join(__dirname, 'dbe-data')
// Prefer GeoNames ZA file over OpenDB (more rows)
const allFiles = fs.readdirSync(dbeDir)
const csvFile  = allFiles.find(f => f.toLowerCase().startsWith('za'))
              || allFiles.find(f => f.toLowerCase().includes('opendb'))
              || allFiles.find(f => f.toLowerCase().includes('geonames') || f.toLowerCase().includes('postal'))
if (!csvFile) { console.error('No data file in scripts/dbe-data/'); process.exit(1) }
const csvPath   = path.join(dbeDir, csvFile)
const isGeoNames = csvFile.toUpperCase().startsWith('ZA')
console.log('Using:', csvFile, isGeoNames ? '(GeoNames format)' : '(OpenDB format)')

const lines = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/).filter(l => l.trim())

// ── Parse GeoNames tab-separated format ──────────────────────────────────────
function parseGeoNames() {
  const seen    = new Set()
  const suburbs = []

  for (const line of lines) {
    const cols   = line.split('\t')
    if (cols.length < 3) continue
    const postal = cols[1]?.trim()
    const name   = cols[2]?.trim()
    if (!name || !postal) continue

    const p        = parseInt(postal)
    const province = provinceFromPostal(postal)
    const city     = cityFromPostal(p)
    if (!province) continue

    const key = `${name.toLowerCase()}|${postal}`
    if (seen.has(key)) continue
    seen.add(key)

    const suburbId = 'sub_' + name.toLowerCase()
      .replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/, '')
      + '_' + postal

    suburbs.push({
      id:            suburbId,
      name,
      city_id:       city.id,
      city_name:     city.name,
      province_code: province,
      postal_code:   postal,
    })
  }
  return suburbs
}

// ── Parse OpenDB CSV format ───────────────────────────────────────────────────
const PROVINCE_CODES = {
  'western cape':'Western Cape','eastern cape':'Eastern Cape',
  'kwazulu-natal':'KwaZulu-Natal','kwazulu natal':'KwaZulu-Natal',
  'gauteng':'Gauteng','free state':'Free State','limpopo':'Limpopo',
  'mpumalanga':'Mpumalanga','north west':'North West','northern cape':'Northern Cape',
}
function parseOpenDB() {
  const header = lines[0].split(',').map(h => h.trim())
  function parseRow(line) {
    const cols=[]; let cur='', inQ=false
    for (const ch of line) {
      if (ch==='"') inQ=!inQ
      else if (ch===',' && !inQ) { cols.push(cur.trim()); cur='' }
      else cur+=ch
    }
    cols.push(cur.trim())
    const obj={}; header.forEach((h,i)=>{ obj[h]=cols[i]??'' }); return obj
  }
  const allRows = lines.slice(1).map(parseRow)
  const byId    = new Map(); for (const r of allRows) byId.set(r.id, r)

  function getProvince(row) {
    let cur=row
    for (let d=0; d<10; d++) {
      if (cur.place_type==='province') return PROVINCE_CODES[cur.eng?.toLowerCase()] ?? cur.eng
      if (!cur.parent || !byId.has(cur.parent)) break
      cur=byId.get(cur.parent)
    }
    return null
  }
  function getParentCity(row) {
    let cur=row
    for (let d=0; d<10; d++) {
      const parent=byId.get(cur.parent); if (!parent) break
      if (['local_municipality','metro_municipality','city','district_municipality'].includes(parent.place_type))
        return parent.eng||null
      cur=parent
    }
    return null
  }

  const seen=[]; const suburbs=[]; const citiesMap=new Map()
  const seenSet=new Set()
  for (const row of allRows.filter(r=>['town','suburb','city'].includes(r.place_type)&&r.eng?.trim())) {
    const name=row.eng.trim(), province=getProvince(row)
    if (!province) continue
    const cityName=getParentCity(row)||name
    const cityId='city_'+cityName.toLowerCase().replace(/[^a-z0-9]/g,'_').replace(/_+/g,'_').replace(/^_|_$/,'')
    if (!citiesMap.has(cityId)) citiesMap.set(cityId,{id:cityId,name:cityName,province_code:province,latitude:null,longitude:null})
    const postal=row.street_code?.trim()||row.box_code?.trim()||null
    const key=`${name.toLowerCase()}|${cityId}`
    if (seenSet.has(key)) continue; seenSet.add(key)
    const suburbId='sub_'+name.toLowerCase().replace(/[^a-z0-9]/g,'_').replace(/_+/g,'_').replace(/^_|_$/,'')+'_'+(postal||row.id.slice(-4))
    suburbs.push({id:suburbId,name,city_id:cityId,city_name:cityName,province_code:province,postal_code:postal})
  }
  return { suburbs, cities: Array.from(citiesMap.values()) }
}

// ── Batch upsert ─────────────────────────────────────────────────────────────
async function batchUpsert(table, rows) {
  const BATCH=100; let done=0
  for (let i=0; i<rows.length; i+=BATCH) {
    const {error}=await supabase.from(table).upsert(rows.slice(i,i+BATCH),{onConflict:'id',ignoreDuplicates:true})
    if (error) console.error(`  ${table} error:`, error.message)
    else { done+=Math.min(BATCH,rows.length-i); process.stdout.write(`  ${table}: ${done}/${rows.length}\r`) }
  }
  console.log(`  ${table}: ${done}/${rows.length} done`)
}

async function seed() {
  let suburbs, cities=[]

  if (isGeoNames) {
    suburbs = parseGeoNames()
    console.log(`Parsed ${suburbs.length} suburbs from GeoNames`)
    // Collect unique cities and upsert them first
    const cityMap = new Map()
    for (const s of suburbs) {
      if (!cityMap.has(s.city_id)) {
        cityMap.set(s.city_id, { id: s.city_id, name: s.city_name, province_code: s.province_code, latitude: null, longitude: null })
      }
    }
    console.log(`\nUpserting ${cityMap.size} cities first...`)
    await batchUpsert('cities', Array.from(cityMap.values()))
  } else {
    const result = parseOpenDB()
    suburbs = result.suburbs; cities = result.cities
    console.log(`Parsed ${cities.length} cities and ${suburbs.length} suburbs from OpenDB`)
    if (cities.length) { console.log('\nUpserting cities...'); await batchUpsert('cities', cities) }
  }

  console.log('\nUpserting suburbs...')
  await batchUpsert('suburbs', suburbs)
  console.log('\nAll done!')
}

seed().catch(console.error)
