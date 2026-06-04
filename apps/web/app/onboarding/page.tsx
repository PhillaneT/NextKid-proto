'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { SA_PROVINCES } from '@nextkid/shared'

interface CityOption   { id: string; name: string }
interface SuburbOption { id: string; name: string; postal_code?: string }
interface SchoolOption { id: string; name: string; type: string; suburb_name?: string; city_name: string; province_code?: string }
interface SuburbSearchResult { id: string; name: string; city_id: string; city_name: string; province_code: string; postal_code?: string }

// ── Design tokens (match globals.css) ────────────────────────────────────────
const BLUE    = '#BE1E2D'
const BORDER  = '#dedede'
const SURFACE = '#f4f4f4'
const TEXT    = '#111111'
const MUTED   = '#979797'

const s = {
  page:  { minHeight: '100vh', background: '#fff', fontFamily: "'Roboto', system-ui, sans-serif" } as const,
  wrap:  { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 57px)', padding: '24px' } as const,
  card:  { background: '#fff', border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '40px', width: '100%', maxWidth: '480px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' } as const,
  label: { color: MUTED, fontSize: '13px', display: 'block', marginBottom: '6px', fontWeight: '500' } as const,
  input: { width: '100%', padding: '13px', borderRadius: '10px', background: SURFACE, border: `1px solid ${BORDER}`, color: TEXT, fontSize: '14px', boxSizing: 'border-box', outline: 'none' } as const,
  select: { width: '100%', padding: '13px', borderRadius: '10px', background: SURFACE, border: `1px solid ${BORDER}`, color: TEXT, fontSize: '14px', boxSizing: 'border-box', cursor: 'pointer', appearance: 'auto' } as const,
  selectDisabled: { width: '100%', padding: '13px', borderRadius: '10px', background: '#fafafa', border: `1px solid ${BORDER}`, color: MUTED, fontSize: '14px', boxSizing: 'border-box', cursor: 'not-allowed' } as const,
}

const btn = (active: boolean): React.CSSProperties => ({
  padding: '14px', borderRadius: '30px', border: 'none', fontSize: '15px',
  fontWeight: '700', cursor: active ? 'pointer' : 'not-allowed',
  background: active ? BLUE : BORDER, color: active ? '#fff' : MUTED,
  transition: 'background 0.15s',
})

function NavBar() {
  return (
    <div style={{ background: '#fff', borderBottom: `1px solid ${BORDER}`, padding: '16px 32px', display: 'flex', alignItems: 'center' }}>
      <span style={{ color: BLUE, fontWeight: '800', fontSize: '20px' }}>NextKid</span>
    </div>
  )
}

export default function OnboardingPage() {
  const router = useRouter()
  const TOTAL_STEPS = 4

  const [step, setStep]           = useState(1)
  const [userId, setUserId]       = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [saving, setSaving]       = useState(false)
  const [saveError, setSaveError] = useState('')

  // Step 1
  const [fullName, setFullName] = useState('')

  // Step 2
  const [dob, setDob] = useState('')

  // Step 3 — location cascade
  const [province, setProvince]     = useState('')
  const [cityId, setCityId]         = useState('')
  const [cityName, setCityName]     = useState('')

  // City search
  const [cityQuery, setCityQuery]         = useState('')
  const [cityResults, setCityResults]     = useState<(CityOption & { province_code: string })[]>([])
  const [searchingCities, setSearchingCities] = useState(false)
  const [cityInputFocused, setCityInputFocused] = useState(false)
  const [suburbId, setSuburbId]     = useState('')
  const [suburbName, setSuburbName] = useState('')
  const [suburbs, setSuburbs]       = useState<SuburbOption[]>([])
  const [loadingSuburbs, setLoadingSuburbs] = useState(false)
  const [schools, setSchools]             = useState<SchoolOption[]>([])
  const [schoolSearch, setSchoolSearch]   = useState('')
  const [globalSchools, setGlobalSchools] = useState<SchoolOption[]>([])
  const [searchingSchools, setSearchingSchools] = useState(false)
  const [selectedSchools, setSelectedSchools] = useState<SchoolOption[]>([])

  // Step 4 — delivery address (needed for D2D shipping)
  const [streetAddress, setStreetAddress]       = useState('')
  const [deliveryPostalCode, setDeliveryPostalCode] = useState('')

  const [loadingSchools, setLoadingSchools] = useState(false)
  const [fetchError, setFetchError]         = useState('')

  // Quick suburb / postal-code search
  const [suburbQuery, setSuburbQuery]         = useState('')
  const [suburbResults, setSuburbResults]     = useState<SuburbSearchResult[]>([])
  const [searchingSuburbs, setSearchingSuburbs] = useState(false)

  // Refs to suppress cascade resets when quick-search auto-fills all values
  const skipCityRef = useRef('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      setUserId(user.id)
      setUserEmail(user.email ?? '')
      supabase.from('profiles').select('profile_completed_at').eq('id', user.id).single()
        .then(({ data }) => { if (data?.profile_completed_at) router.push('/dashboard') })
    })
  }, [router])


  // Load suburbs whenever city changes
  useEffect(() => {
    if (!cityId) { setSuburbs([]); setSuburbId(''); setSuburbName(''); return }
    setSuburbId(''); setSuburbName('')
    setSchools([]); setSelectedSchools([]); setSchoolSearch('')
    setLoadingSuburbs(true)
    const params = new URLSearchParams({ cityId })
    if (cityName) params.set('cityName', cityName)
    fetch(`/api/locations/suburbs?${params}`)
      .then(r => r.json())
      .then(data => { setSuburbs(Array.isArray(data) ? data : []); setLoadingSuburbs(false) })
      .catch(() => setLoadingSuburbs(false))
  }, [cityId, cityName])

  useEffect(() => {
    if (!suburbId && !cityId) { setSchools([]); setSelectedSchools([]); return }
    setFetchError(''); setLoadingSchools(true)
    const params = new URLSearchParams()
    if (suburbId)   params.set('suburbId',   suburbId)
    if (suburbName) params.set('suburbName', suburbName)
    if (cityId)     params.set('cityId',     cityId)
    if (cityName)   params.set('cityName',   cityName)
    fetch(`/api/locations/schools?${params}`)
      .then(r => r.json())
      .then(data => { Array.isArray(data) ? setSchools(data) : setFetchError(`Schools: ${data.error ?? 'unknown error'}`); setLoadingSchools(false) })
      .catch(e => { setFetchError(`Schools failed: ${e.message}`); setLoadingSchools(false) })
    setSchoolSearch('')
  }, [suburbId, cityId, suburbName, cityName])


  // Debounced city search — starts after 2 letters, searches all SA cities
  useEffect(() => {
    if (cityQuery.trim().length < 2) { setCityResults([]); return }
    const timer = setTimeout(async () => {
      setSearchingCities(true)
      try {
        const params = new URLSearchParams({ q: cityQuery.trim() })
        if (province) params.set('province', province)
        const res = await fetch(`/api/locations/cities/search?${params}`)
        const data = await res.json()
        setCityResults(Array.isArray(data) ? data : [])
      } catch { setCityResults([]) }
      finally { setSearchingCities(false) }
    }, 200)
    return () => clearTimeout(timer)
  }, [cityQuery])

  const handleCitySelect = (city: CityOption & { province_code: string }) => {
    setCityId(city.id)
    setCityName(city.name)
    setCityQuery(city.name)
    setCityResults([])
    setCityInputFocused(false)
    setProvince(city.province_code)
  }

  const handleSchoolSearch = useCallback((q: string) => setSchoolSearch(q), [])

  // Debounced global school search — runs on every keystroke regardless of location
  useEffect(() => {
    if (schoolSearch.trim().length < 2) { setGlobalSchools([]); return }
    const timer = setTimeout(async () => {
      setSearchingSchools(true)
      try {
        const res = await fetch(`/api/locations/schools/search?q=${encodeURIComponent(schoolSearch.trim())}&limit=20`)
        const data = await res.json()
        setGlobalSchools(Array.isArray(data) ? data : [])
      } catch { setGlobalSchools([]) }
      finally { setSearchingSchools(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [schoolSearch])

  // Debounced suburb search
  useEffect(() => {
    if (!suburbQuery || suburbQuery.length < 2) { setSuburbResults([]); return }
    const timer = setTimeout(async () => {
      setSearchingSuburbs(true)
      try {
        const res = await fetch(`/api/locations/suburbs/search?q=${encodeURIComponent(suburbQuery)}`)
        const data = await res.json()
        setSuburbResults(Array.isArray(data) ? data : [])
      } catch { setSuburbResults([]) }
      finally { setSearchingSuburbs(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [suburbQuery])

  // Called when user picks a suburb from the quick-search results
  const applySuburbResult = async (r: SuburbSearchResult) => {
    setSearchingSuburbs(true)
    setSearchingSuburbs(false)
    skipCityRef.current = r.city_id
    setProvince(r.province_code)
    setCityId(r.city_id)
    setCityName(r.city_name)
    setCityQuery(r.city_name)
    setSuburbId(r.id)
    setSuburbName(r.name)
    if (r.postal_code) setDeliveryPostalCode(r.postal_code)
    setSuburbQuery('')
    setSuburbResults([])
  }

  const isGlobalSearch = schoolSearch.trim().length >= 2 && globalSchools.length > 0
  const filteredSchools = isGlobalSearch
    ? globalSchools
    : schoolSearch.trim().length > 0
      ? schools.filter(s => s.name.toLowerCase().includes(schoolSearch.toLowerCase()))
      : schools

  const locationComplete = !!(province && cityId && suburbId)

  const handleFinish = async () => {
    if (!locationComplete) return
    setSaveError('')
    setSaving(true)

    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      email: userEmail,
      full_name: fullName,
      date_of_birth: dob || null,
      role: 'buyer',
      province,
      city_id: cityId,
      city_name: cityName,
      suburb_id: suburbId,
      suburb_name: suburbName,
      school_id: selectedSchools[0]?.id ?? null,
      school_name: selectedSchools[0]?.name ?? null,
      school_ids: selectedSchools.map(s => s.id),
      street_address: streetAddress || null,
      postal_code: deliveryPostalCode || null,
      // RULE: profile_completed_at gates all buying and listing
      profile_completed_at: new Date().toISOString(),
    })

    if (error) { setSaveError('Something went wrong. Please try again.'); setSaving(false); return }
    router.push('/dashboard')
  }

  return (
    <div style={s.page}>
      <NavBar />
      <div style={s.wrap}>
        <div style={s.card}>

          {/* Progress */}
          <p style={{ color: BLUE, fontSize: '13px', marginBottom: '4px', fontWeight: '600' }}>Step {step} of {TOTAL_STEPS}</p>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '32px' }}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div key={i} style={{ flex: 1, height: '4px', borderRadius: '2px', background: i < step ? BLUE : BORDER }} />
            ))}
          </div>

          {/* ── Step 1: Name ─────────────────────────────────── */}
          {step === 1 && <>
            <h2 style={{ color: TEXT, fontSize: '22px', fontWeight: '700', marginBottom: '8px' }}>Welcome to NextKid!</h2>
            <p style={{ color: MUTED, fontSize: '14px', marginBottom: '28px' }}>Let's get your account set up.</p>
            <label style={s.label}>Full Name</label>
            <input style={s.input} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" autoFocus />
            <button style={{ ...btn(!!fullName), width: '100%', marginTop: '20px' }} disabled={!fullName} onClick={() => setStep(2)}>
              Continue →
            </button>
          </>}

          {/* ── Step 2: Date of birth ────────────────────────── */}
          {step === 2 && <>
            <h2 style={{ color: TEXT, fontSize: '22px', fontWeight: '700', marginBottom: '8px' }}>Date of birth</h2>
            <p style={{ color: MUTED, fontSize: '14px', marginBottom: '28px' }}>
              Optional — helps us personalise your experience.
            </p>
            <label style={s.label}>Date of Birth</label>
            <input type="date" style={s.input} value={dob} onChange={e => setDob(e.target.value)} />
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button style={{ ...btn(true), flex: 1, background: 'transparent', border: `1px solid ${BORDER}`, color: MUTED }} onClick={() => setStep(1)}>← Back</button>
              <button style={{ ...btn(true), flex: 2 }} onClick={() => setStep(3)}>Continue →</button>
            </div>
          </>}

          {/* ── Step 3: Location cascade ─────────────────────── */}
          {step === 3 && <>
            <h2 style={{ color: TEXT, fontSize: '22px', fontWeight: '700', marginBottom: '8px' }}>Where are you located?</h2>
            <p style={{ color: MUTED, fontSize: '14px', marginBottom: '24px' }}>
              Helps us show listings from your area and school.
            </p>

            {/* Debug: fetch errors surface here */}
            {fetchError && (
              <div style={{ background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px' }}>
                <p style={{ color: '#c53030', fontSize: '12px', margin: 0 }}>⚠ {fetchError}</p>
              </div>
            )}

            {/* Quick suburb / postal-code search */}
            <label style={s.label}>Search suburb or postal code</label>
            <div style={{ position: 'relative', marginBottom: '6px' }}>
              <input
                style={{ ...s.input, marginBottom: 0, paddingRight: '40px' }}
                value={suburbQuery}
                onChange={e => setSuburbQuery(e.target.value)}
                placeholder="e.g. Sandton or 2196"
                autoComplete="off"
              />
              {searchingSuburbs && (
                <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: MUTED, fontSize: '12px' }}>...</span>
              )}
            </div>
            {suburbResults.length > 0 && (
              <div style={{ border: `1px solid ${BORDER}`, borderRadius: '10px', marginBottom: '12px', overflow: 'hidden', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                {suburbResults.map(r => (
                  <div key={r.id} onClick={() => applySuburbResult(r)}
                    style={{ padding: '11px 14px', cursor: 'pointer', borderBottom: `1px solid ${BORDER}`, background: suburbId === r.id ? '#eef0ff' : '#fff' }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '13px', color: suburbId === r.id ? BLUE : TEXT }}>
                      {r.name}{r.postal_code ? ` · ${r.postal_code}` : ''}
                      {suburbId === r.id && <span style={{ marginLeft: '6px', color: BLUE }}>✓</span>}
                    </p>
                    <p style={{ margin: 0, fontSize: '11px', color: MUTED }}>{r.city_name}, {r.province_code}</p>
                  </div>
                ))}
              </div>
            )}
            {suburbQuery.length >= 2 && !searchingSuburbs && suburbResults.length === 0 && (
              <div style={{ marginBottom: '12px' }}>
                <p style={{ color: MUTED, fontSize: '12px', marginBottom: '8px' }}>No suburbs found for "{suburbQuery}"</p>
                <button
                  type="button"
                  onClick={() => {
                    setSuburbName(suburbQuery.trim());
                    setSuburbId(`manual_${suburbQuery.trim().toLowerCase().replace(/\s+/g, '_')}`);
                  }}
                  style={{ fontSize: '12px', color: BLUE, background: 'none', border: `1px solid ${BLUE}`, borderRadius: '20px', padding: '5px 14px', cursor: 'pointer' }}
                >
                  Use "{suburbQuery.trim()}" as my suburb
                </button>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '4px 0 20px' }}>
              <div style={{ flex: 1, height: '1px', background: BORDER }} />
              <span style={{ color: MUTED, fontSize: '11px', whiteSpace: 'nowrap' }}>or select manually</span>
              <div style={{ flex: 1, height: '1px', background: BORDER }} />
            </div>

            {/* Province */}
            <label style={s.label}>Province</label>
            <select
              style={{ ...s.select, marginBottom: '12px' }}
              value={province}
              onChange={e => {
                setProvince(e.target.value);
                setCityQuery(''); setCityId(''); setCityName('');
                setSuburbId(''); setSuburbName(''); setSuburbs([]);
                setSchools([]); setSelectedSchools([]); setSchoolSearch('');
              }}
            >
              <option value="">Select a province...</option>
              {SA_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            {/* City search — type 2 letters to see matching cities */}
            <label style={s.label}>City</label>
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <input
                style={{ ...s.input, marginBottom: 0, borderColor: cityId ? BLUE : BORDER }}
                value={cityQuery}
                onChange={e => {
                  setCityQuery(e.target.value)
                  if (e.target.value !== cityName) {
                    setCityId(''); setCityName('')
                    setSuburbs([]); setSuburbId(''); setSuburbName('')
                  }
                }}
                onFocus={() => setCityInputFocused(true)}
                onBlur={() => setTimeout(() => setCityInputFocused(false), 150)}
                placeholder="Type 2 letters to search city (e.g. Jo, Ca, Pre...)"
                autoComplete="off"
              />
              {searchingCities && (
                <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: MUTED, fontSize: '12px' }}>...</span>
              )}
              {cityId && (
                <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: BLUE, fontSize: '13px', fontWeight: 700 }}>✓</span>
              )}
              {/* City results dropdown */}
              {cityResults.length > 0 && cityInputFocused && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: '4px', overflow: 'hidden' }}>
                  {cityResults.map(city => (
                    <div
                      key={city.id}
                      onMouseDown={() => handleCitySelect(city)}
                      style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${BORDER}`, background: cityId === city.id ? '#fde8ea' : '#fff' }}
                    >
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '13px', color: cityId === city.id ? BLUE : TEXT }}>{city.name}</p>
                      <p style={{ margin: 0, fontSize: '11px', color: MUTED }}>{city.province_code}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {cityQuery.length >= 2 && !searchingCities && cityResults.length === 0 && !cityId && (
              <p style={{ color: MUTED, fontSize: '12px', marginBottom: '8px' }}>No cities found — try a different name</p>
            )}

            {/* Suburb search */}
            <label style={{ ...s.label, color: cityId ? MUTED : BORDER }}>Suburb</label>
            <select
              style={{ ...(cityId ? s.select : s.selectDisabled), marginBottom: '16px' }}
              disabled={!cityId || loadingSuburbs}
              value={suburbId}
              onChange={e => {
                const opt = suburbs.find(s => s.id === e.target.value)
                setSuburbId(e.target.value)
                setSuburbName(opt?.name ?? '')
                if ((opt as SuburbOption & { postal_code?: string })?.postal_code) {
                  setDeliveryPostalCode((opt as SuburbOption & { postal_code?: string }).postal_code!)
                }
              }}
            >
              <option value="">
                {!cityId ? 'Select a city first' : loadingSuburbs ? 'Loading suburbs...' : suburbs.length === 0 ? 'No suburbs found' : 'Select a suburb...'}
              </option>
              {suburbs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            {/* School — auto-loads for selected suburb, allows filtering + global search */}
            {true && <>
              <label style={s.label}>
                School{' '}
                <span style={{ color: BORDER, fontWeight: 400 }}>(optional — add now or later)</span>
              </label>

              {/* Context label */}
              {suburbId && schools.length > 0 && !isGlobalSearch && (
                <p style={{ color: BLUE, fontSize: '12px', fontWeight: 600, marginBottom: '6px', margin: '0 0 6px' }}>
                  📍 {schools.length} school{schools.length !== 1 ? 's' : ''} near {suburbName || cityName}
                </p>
              )}

              <input
                style={{ ...s.input, marginBottom: '8px' }}
                value={schoolSearch}
                onChange={e => handleSchoolSearch(e.target.value)}
                placeholder={suburbId && schools.length > 0
                  ? `Filter ${schools.length} schools near ${suburbName || cityName}...`
                  : 'Search any school in South Africa...'}
              />

              <div style={{ maxHeight: '220px', overflowY: 'auto', border: `1px solid ${BORDER}`, borderRadius: '10px', marginBottom: '10px', background: '#fff' }}>
                {(loadingSchools || searchingSchools)
                  ? <p style={{ color: MUTED, padding: '14px', textAlign: 'center', margin: 0, fontSize: '13px' }}>
                      {loadingSchools ? `Loading schools near ${suburbName || cityName}...` : 'Searching...'}
                    </p>
                  : filteredSchools.length === 0
                    ? <p style={{ color: MUTED, padding: '14px', textAlign: 'center', margin: 0, fontSize: '13px' }}>
                        {schoolSearch.trim().length >= 2
                          ? 'No schools found — try a different name.'
                          : suburbId
                            ? `No schools found near ${suburbName}. Type to search all SA schools.`
                            : 'Select a suburb to see nearby schools, or type to search.'}
                      </p>
                    : filteredSchools.map(school => {
                      const selected = selectedSchools.some(s => s.id === school.id)
                      const location = [school.suburb_name, school.city_name].filter(Boolean).join(' · ')
                      return (
                        <div key={school.id} onClick={() => {
                          setSelectedSchools(prev =>
                            selected ? prev.filter(s => s.id !== school.id) : [...prev, school]
                          )
                        }}
                          style={{
                            padding: '11px 14px', cursor: 'pointer',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            background: selected ? '#fde8ea' : '#fff',
                            borderBottom: `1px solid ${BORDER}`,
                          }}>
                          <div>
                            <p style={{ color: selected ? BLUE : TEXT, margin: 0, fontSize: '13px', fontWeight: 600 }}>{school.name}</p>
                            {location && <p style={{ color: MUTED, margin: 0, fontSize: '11px' }}>{location}</p>}
                          </div>
                          {selected && <span style={{ color: BLUE, fontSize: '16px', fontWeight: '700' }}>✓</span>}
                        </div>
                      )
                    })
                }
              </div>

              {isGlobalSearch && (
                <p style={{ color: MUTED, fontSize: '12px', marginBottom: '10px' }}>
                  Showing results from all SA schools
                </p>
              )}
            </>}

            {/* Selected school chips */}
            {selectedSchools.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                {selectedSchools.map(school => (
                  <div key={school.id} style={{ background: '#eef0ff', border: `1px solid ${BLUE}`, borderRadius: '20px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: BLUE, fontSize: '13px', fontWeight: 600 }}>{school.name}</span>
                    <span
                      onClick={() => setSelectedSchools(prev => prev.filter(s => s.id !== school.id))}
                      style={{ color: BLUE, cursor: 'pointer', fontSize: '14px', lineHeight: 1, fontWeight: 700 }}
                    >✕</span>
                  </div>
                ))}
              </div>
            )}

            {saveError && <p style={{ color: '#e53e3e', fontSize: '13px', marginBottom: '12px' }}>{saveError}</p>}

            {!locationComplete && (
              <p style={{ color: MUTED, fontSize: '12px', textAlign: 'center', marginBottom: '10px' }}>
                Select province, city, and suburb to continue
              </p>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button style={{ ...btn(true), flex: 1, background: 'transparent', border: `1px solid ${BORDER}`, color: MUTED }} onClick={() => setStep(2)}>← Back</button>
              <button style={{ ...btn(locationComplete), flex: 2 }} disabled={!locationComplete} onClick={() => setStep(4)}>
                Continue →
              </button>
            </div>
          </>}

          {/* ── Step 4: Delivery address ──────────────────────── */}
          {step === 4 && <>
            <h2 style={{ color: TEXT, fontSize: '22px', fontWeight: '700', marginBottom: '8px' }}>Your delivery address</h2>
            <p style={{ color: MUTED, fontSize: '14px', marginBottom: '24px' }}>
              Used for door-to-door pickups and deliveries. You can skip this now and add it from your profile.
            </p>

            {/* Suburb confirmation */}
            <div style={{ background: '#f4f4f4', borderRadius: '10px', padding: '10px 14px', marginBottom: '20px' }}>
              <p style={{ color: MUTED, fontSize: '12px', margin: '0 0 2px' }}>Delivering to</p>
              <p style={{ color: TEXT, fontSize: '13px', fontWeight: 600, margin: 0 }}>{suburbName}, {cityName}</p>
            </div>

            <label style={s.label}>Street address</label>
            <input
              style={{ ...s.input, marginBottom: '12px' }}
              value={streetAddress}
              onChange={e => setStreetAddress(e.target.value)}
              placeholder="e.g. 12 Main Street, Apt 4"
              autoFocus
            />

            <label style={s.label}>Postal code</label>
            <input
              style={{ ...s.input, marginBottom: '24px' }}
              value={deliveryPostalCode}
              onChange={e => setDeliveryPostalCode(e.target.value)}
              placeholder="e.g. 2196"
              inputMode="numeric"
            />

            {saveError && <p style={{ color: '#e53e3e', fontSize: '13px', marginBottom: '12px' }}>{saveError}</p>}

            <button
              style={{ ...btn(!saving), width: '100%', marginBottom: '10px' }}
              disabled={saving}
              onClick={handleFinish}
            >
              {saving ? 'Saving...' : 'Finish Setup ✓'}
            </button>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                style={{ ...btn(true), flex: 1, background: 'transparent', border: `1px solid ${BORDER}`, color: MUTED }}
                onClick={() => setStep(3)}
              >
                ← Back
              </button>
              <button
                style={{ ...btn(!saving), flex: 2, background: 'transparent', border: `1px solid ${BORDER}`, color: MUTED }}
                disabled={saving}
                onClick={() => { setStreetAddress(''); setDeliveryPostalCode(''); handleFinish(); }}
              >
                {saving ? 'Saving...' : 'Skip for now'}
              </button>
            </div>
          </>}

        </div>
      </div>
    </div>
  )
}