'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { SA_PROVINCES } from '@nextkid/shared'

interface CityOption   { id: string; name: string }
interface SuburbOption { id: string; name: string; postal_code?: string }
interface SchoolOption { id: string; name: string; type: string; city_name: string }
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
  const [cities, setCities]         = useState<CityOption[]>([])
  const [cityId, setCityId]         = useState('')
  const [cityName, setCityName]     = useState('')
  const [suburbs, setSuburbs]       = useState<SuburbOption[]>([])
  const [suburbId, setSuburbId]     = useState('')
  const [suburbName, setSuburbName] = useState('')
  const [schools, setSchools]       = useState<SchoolOption[]>([])
  const [schoolSearch, setSchoolSearch] = useState('')
  const [selectedSchools, setSelectedSchools] = useState<SchoolOption[]>([])

  // Step 4 — delivery address (needed for D2D shipping)
  const [streetAddress, setStreetAddress]       = useState('')
  const [deliveryPostalCode, setDeliveryPostalCode] = useState('')

  const [loadingCities, setLoadingCities]   = useState(false)
  const [loadingSuburbs, setLoadingSuburbs] = useState(false)
  const [loadingSchools, setLoadingSchools] = useState(false)
  const [fetchError, setFetchError]         = useState('')

  // Quick suburb / postal-code search
  const [suburbQuery, setSuburbQuery]         = useState('')
  const [suburbResults, setSuburbResults]     = useState<SuburbSearchResult[]>([])
  const [searchingSuburbs, setSearchingSuburbs] = useState(false)

  // Refs to suppress cascade resets when quick-search auto-fills all values
  const skipProvinceRef = useRef('')
  const skipCityRef     = useRef('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      setUserId(user.id)
      setUserEmail(user.email ?? '')
      supabase.from('profiles').select('profile_completed_at').eq('id', user.id).single()
        .then(({ data }) => { if (data?.profile_completed_at) router.push('/dashboard') })
    })
  }, [router])

  useEffect(() => {
    if (!province) { setCities([]); setCityId(''); setCityName(''); return }
    // Skip cascade reset when quick-search already pre-filled city/suburb
    if (skipProvinceRef.current === province) { skipProvinceRef.current = ''; return }
    setFetchError(''); setLoadingCities(true)
    fetch(`/api/locations/cities?province=${encodeURIComponent(province)}`)
      .then(r => r.json())
      .then(data => { Array.isArray(data) ? setCities(data) : setFetchError(`Cities: ${data.error ?? 'unknown error'}`); setLoadingCities(false) })
      .catch(e => { setFetchError(`Cities failed: ${e.message}`); setLoadingCities(false) })
    setCityId(''); setCityName(''); setSuburbs([]); setSuburbId(''); setSuburbName('')
    setSchools([]); setSelectedSchools([]); setSchoolSearch('')
  }, [province])

  useEffect(() => {
    if (!cityId) { setSuburbs([]); setSuburbId(''); setSuburbName(''); return }
    // Skip cascade reset when quick-search already pre-filled suburb
    if (skipCityRef.current === cityId) { skipCityRef.current = ''; return }
    setFetchError(''); setLoadingSuburbs(true)
    fetch(`/api/locations/suburbs?cityId=${encodeURIComponent(cityId)}`)
      .then(r => r.json())
      .then(data => { Array.isArray(data) ? setSuburbs(data) : setFetchError(`Suburbs: ${data.error ?? 'unknown error'}`); setLoadingSuburbs(false) })
      .catch(e => { setFetchError(`Suburbs failed: ${e.message}`); setLoadingSuburbs(false) })
    setSuburbId(''); setSuburbName(''); setSchools([]); setSelectedSchools([]); setSchoolSearch('')
  }, [cityId])

  useEffect(() => {
    if (!suburbId) { setSchools([]); setSelectedSchools([]); return }
    setFetchError(''); setLoadingSchools(true)
    fetch(`/api/locations/schools?suburbId=${encodeURIComponent(suburbId)}`)
      .then(r => r.json())
      .then(data => { Array.isArray(data) ? setSchools(data) : setFetchError(`Schools: ${data.error ?? 'unknown error'}`); setLoadingSchools(false) })
      .catch(e => { setFetchError(`Schools failed: ${e.message}`); setLoadingSchools(false) })
    setSchoolSearch('')
  }, [suburbId])


  const handleSchoolSearch = useCallback((q: string) => setSchoolSearch(q), [])

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
    // Pre-fetch dropdown lists so the manual cascade pickers show correctly
    const [citiesRes, suburbsRes] = await Promise.all([
      fetch(`/api/locations/cities?province=${encodeURIComponent(r.province_code)}`).then(x => x.json()),
      fetch(`/api/locations/suburbs?cityId=${encodeURIComponent(r.city_id)}`).then(x => x.json()),
    ])
    setSearchingSuburbs(false)
    // Set refs BEFORE state so the cascade useEffects see them and skip their resets
    skipProvinceRef.current = r.province_code
    skipCityRef.current     = r.city_id
    setCities(Array.isArray(citiesRes) ? citiesRes : [])
    setSuburbs(Array.isArray(suburbsRes) ? suburbsRes : [])
    setProvince(r.province_code)
    setCityId(r.city_id)
    setCityName(r.city_name)
    setSuburbId(r.id)
    setSuburbName(r.name)
    if (r.postal_code) setDeliveryPostalCode(r.postal_code)
    setSuburbQuery('')
    setSuburbResults([])
  }

  const filteredSchools = schools.filter(s =>
    s.name.toLowerCase().includes(schoolSearch.toLowerCase())
  )

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
              <p style={{ color: MUTED, fontSize: '12px', marginBottom: '12px' }}>No suburbs found — try a different name or postal code</p>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '4px 0 20px' }}>
              <div style={{ flex: 1, height: '1px', background: BORDER }} />
              <span style={{ color: MUTED, fontSize: '11px', whiteSpace: 'nowrap' }}>or select manually</span>
              <div style={{ flex: 1, height: '1px', background: BORDER }} />
            </div>

            {/* Province */}
            <label style={s.label}>Province</label>
            <select style={{ ...s.select, marginBottom: '12px' }} value={province} onChange={e => setProvince(e.target.value)}>
              <option value="">Select a province...</option>
              {SA_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            {/* City */}
            <label style={{ ...s.label, color: province ? MUTED : BORDER }}>City</label>
            <select
              style={{ ...(province ? s.select : s.selectDisabled), marginBottom: '12px' }}
              disabled={!province || loadingCities}
              value={cityId}
              onChange={e => {
                const opt = cities.find(c => c.id === e.target.value)
                setCityId(e.target.value); setCityName(opt?.name ?? '')
              }}
            >
              <option value="">{loadingCities ? 'Loading...' : 'Select a city...'}</option>
              {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            {/* Suburb */}
            <label style={{ ...s.label, color: cityId ? MUTED : BORDER }}>Suburb</label>
            <select
              style={{ ...(cityId ? s.select : s.selectDisabled), marginBottom: '16px' }}
              disabled={!cityId || loadingSuburbs}
              value={suburbId}
              onChange={e => {
                const opt = suburbs.find(s => s.id === e.target.value)
                setSuburbId(e.target.value)
                setSuburbName(opt?.name ?? '')
                if (opt?.postal_code) setDeliveryPostalCode(opt.postal_code)
              }}
            >
              <option value="">{loadingSuburbs ? 'Loading...' : 'Select a suburb...'}</option>
              {suburbs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            {/* School */}
            {suburbId && <>
              <label style={s.label}>
                School <span style={{ color: BORDER, fontWeight: 400 }}>(optional — add now or later)</span>
              </label>
              <input
                style={{ ...s.input, marginBottom: '8px' }}
                value={schoolSearch}
                onChange={e => handleSchoolSearch(e.target.value)}
                placeholder="Search school name..."
                disabled={loadingSchools}
              />

              <div style={{ maxHeight: '180px', overflowY: 'auto', border: `1px solid ${BORDER}`, borderRadius: '10px', marginBottom: '10px', background: '#fff' }}>
                {loadingSchools
                  ? <p style={{ color: MUTED, padding: '14px', textAlign: 'center', margin: 0, fontSize: '13px' }}>Loading...</p>
                  : filteredSchools.length === 0
                    ? <p style={{ color: MUTED, padding: '14px', textAlign: 'center', margin: 0, fontSize: '13px' }}>
                        {schools.length === 0 ? 'No schools in this suburb yet.' : 'No match — try a different search.'}
                      </p>
                    : filteredSchools.map(school => {
                      const selected = selectedSchools.some(s => s.id === school.id)
                      return (
                        <div key={school.id} onClick={() => {
                          setSelectedSchools(prev =>
                            selected ? prev.filter(s => s.id !== school.id) : [...prev, school]
                          )
                        }}
                          style={{
                            padding: '11px 14px', cursor: 'pointer',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            background: selected ? '#eef0ff' : '#fff',
                            borderBottom: `1px solid ${BORDER}`,
                          }}>
                          <div>
                            <p style={{ color: selected ? BLUE : TEXT, margin: 0, fontSize: '13px', fontWeight: 600 }}>{school.name}</p>
                            <p style={{ color: MUTED, margin: 0, fontSize: '11px' }}>{school.city_name} · {school.type}</p>
                          </div>
                          {selected && <span style={{ color: BLUE, fontSize: '16px', fontWeight: '700' }}>✓</span>}
                        </div>
                      )
                    })
                }
              </div>

              {schools.length > 0 && selectedSchools.length === 0 && (
                <p style={{ color: MUTED, fontSize: '12px', marginBottom: '10px' }}>
                  Can't find your school?{' '}
                  <span style={{ color: BLUE, cursor: 'pointer', fontWeight: '600' }}>Request it to be added</span>
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