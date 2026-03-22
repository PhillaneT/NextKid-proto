'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { School } from '@nextkid/shared'
import { SA_PROVINCES } from '@nextkid/shared'

const input: React.CSSProperties = {
  width: '100%', padding: '12px', borderRadius: '8px',
  background: '#2a2a2a', border: '1px solid #444',
  color: '#fff', fontSize: '14px', boxSizing: 'border-box',
}
const card: React.CSSProperties = {
  background: '#1a1a1a', border: '1px solid #333',
  borderRadius: '12px', padding: '40px', width: '100%', maxWidth: '480px',
}
const btn = (active: boolean): React.CSSProperties => ({
  padding: '13px', borderRadius: '8px', border: 'none', fontSize: '15px',
  fontWeight: '600', cursor: active ? 'pointer' : 'not-allowed',
  background: active ? '#7c3aed' : '#333', color: active ? '#fff' : '#666',
})

function NavBar() {
  return (
    <div style={{ background: '#111', borderBottom: '1px solid #222', padding: '16px 32px', display: 'flex', alignItems: 'center' }}>
      <i className="fa-solid fa-paper-plane" style={{ color: 'rgb(228,37,205)', fontSize: '18px', marginRight: '8px' }} />
      <span style={{ color: '#fff', fontWeight: '700', fontSize: '20px' }}>NextKid</span>
    </div>
  )
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const TOTAL_STEPS = 3

  // Step 1
  const [fullName, setFullName] = useState('')

  // Step 2
  const [dob, setDob] = useState('')
  const [ageError, setAgeError] = useState('')

  // Step 3 — school picker
  const [province, setProvince] = useState('')
  const [schools, setSchools] = useState<School[]>([])
  const [schoolSearch, setSchoolSearch] = useState('')
  const [selectedSchools, setSelectedSchools] = useState<School[]>([])
  const [loadingSchools, setLoadingSchools] = useState(false)

  const [userId, setUserId] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      setUserId(user.id)
      setUserEmail(user.email ?? '')
      supabase.from('profiles').select('full_name').eq('id', user.id).single()
        .then(({ data }) => { if (data?.full_name) router.push('/dashboard') })
    })
  }, [router])

  // Fetch schools when province changes
  useEffect(() => {
    if (!province) { setSchools([]); return }
    setLoadingSchools(true)
    supabase.from('schools').select('*').eq('province', province).order('name')
      .then(({ data }) => { setSchools((data as School[]) ?? []); setLoadingSchools(false) })
  }, [province])

  const getAge = (d: string) => {
    const birth = new Date(d), today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--
    return age
  }

  const toggleSchool = (school: School) => {
    setSelectedSchools(prev =>
      prev.find(s => s.id === school.id) ? prev.filter(s => s.id !== school.id) : [...prev, school]
    )
  }

  const handleFinish = async () => {
    setSaveError('')
    if (!dob) return
    const isAdult = getAge(dob) >= 18
    setSaving(true)
    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      email: userEmail,
      full_name: fullName,
      date_of_birth: dob,
      is_age_verified: isAdult,
      role: isAdult ? 'buyer' : 'browse_only',
      school_ids: selectedSchools.map(s => s.id),
    })
    if (error) { setSaveError('Something went wrong. Please try again.'); setSaving(false); return }
    router.push('/dashboard')
  }

  const filteredSchools = schools.filter(s =>
    s.name.toLowerCase().includes(schoolSearch.toLowerCase())
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'system-ui, sans-serif' }}>
      <NavBar />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 57px)', padding: '24px' }}>
        <div style={card}>
          {/* Progress */}
          <p style={{ color: '#7c3aed', fontSize: '13px', marginBottom: '4px' }}>Step {step} of {TOTAL_STEPS}</p>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '28px' }}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div key={i} style={{ flex: 1, height: '4px', borderRadius: '2px', background: i < step ? '#7c3aed' : '#333' }} />
            ))}
          </div>

          {/* Step 1 — Name */}
          {step === 1 && <>
            <h2 style={{ color: '#fff', marginBottom: '8px' }}>Welcome to NextKid!</h2>
            <p style={{ color: '#888', fontSize: '14px', marginBottom: '28px' }}>Let's get your account set up.</p>
            <label style={{ color: '#aaa', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Full Name</label>
            <input style={input} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" />
            <button style={{ ...btn(!!fullName), width: '100%', marginTop: '20px' }} disabled={!fullName} onClick={() => setStep(2)}>
              Continue →
            </button>
          </>}

          {/* Step 2 — Age verification */}
          {step === 2 && <>
            <h2 style={{ color: '#fff', marginBottom: '8px' }}>Verify your age</h2>
            <p style={{ color: '#888', fontSize: '14px', marginBottom: '28px' }}>
              {/* RULE: users must be 18+ before transacting */}
              You must be 18+ to buy or sell. Under 18s can browse only.
            </p>
            <label style={{ color: '#aaa', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Date of Birth</label>
            <input type="date" style={input} value={dob} onChange={e => { setDob(e.target.value); setAgeError('') }} />
            <div style={{ background: '#1e1b10', border: '1px solid #554', borderRadius: '8px', padding: '12px', margin: '16px 0' }}>
              <p style={{ color: '#bba', fontSize: '12px', margin: 0 }}>🔒 Your date of birth is used only for age verification and stored securely.</p>
            </div>
            {ageError && <p style={{ color: '#ff6b6b', fontSize: '13px', marginBottom: '12px' }}>{ageError}</p>}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button style={{ ...btn(true), flex: 1, background: 'transparent', border: '1px solid #444', color: '#aaa' }} onClick={() => setStep(1)}>← Back</button>
              <button style={{ ...btn(!!dob), flex: 2 }} disabled={!dob} onClick={() => { if (!dob) { setAgeError('Please enter your date of birth.'); return } setStep(3) }}>Continue →</button>
            </div>
          </>}

          {/* Step 3 — School picker */}
          {step === 3 && <>
            <h2 style={{ color: '#fff', marginBottom: '8px' }}>Add your school(s)</h2>
            <p style={{ color: '#888', fontSize: '14px', marginBottom: '20px' }}>
              Pick the school(s) your child attends so we can show relevant uniform and gear listings. You can skip this and add later.
            </p>

            {/* Province filter */}
            <label style={{ color: '#aaa', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Province</label>
            <select style={{ ...input, marginBottom: '12px' }} value={province} onChange={e => { setProvince(e.target.value); setSchoolSearch('') }}>
              <option value="">Select a province...</option>
              {SA_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            {/* School search */}
            {province && <>
              <label style={{ color: '#aaa', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Search school</label>
              <input style={{ ...input, marginBottom: '10px' }} value={schoolSearch} onChange={e => setSchoolSearch(e.target.value)} placeholder="Type school name..." />

              <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #333', borderRadius: '8px', marginBottom: '16px' }}>
                {loadingSchools
                  ? <p style={{ color: '#666', padding: '16px', textAlign: 'center', margin: 0 }}>Loading...</p>
                  : filteredSchools.length === 0
                    ? <p style={{ color: '#666', padding: '16px', textAlign: 'center', margin: 0 }}>No schools found.</p>
                    : filteredSchools.map(school => {
                      const selected = selectedSchools.some(s => s.id === school.id)
                      return (
                        <div key={school.id} onClick={() => toggleSchool(school)}
                          style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: selected ? '#2e1f5e' : 'transparent', borderBottom: '1px solid #222' }}>
                          <div>
                            <p style={{ color: '#fff', margin: 0, fontSize: '14px' }}>{school.name}</p>
                            <p style={{ color: '#666', margin: 0, fontSize: '12px' }}>{school.city} · {school.type}</p>
                          </div>
                          {selected && <span style={{ color: '#7c3aed', fontSize: '18px' }}>✓</span>}
                        </div>
                      )
                    })
                }
              </div>
            </>}

            {/* Selected schools summary */}
            {selectedSchools.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <p style={{ color: '#aaa', fontSize: '13px', marginBottom: '8px' }}>Selected ({selectedSchools.length}):</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {selectedSchools.map(s => (
                    <span key={s.id} onClick={() => toggleSchool(s)} style={{ background: '#2e1f5e', color: '#a78bfa', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer' }}>
                      {s.name} ✕
                    </span>
                  ))}
                </div>
              </div>
            )}

            {saveError && <p style={{ color: '#ff6b6b', fontSize: '13px', marginBottom: '12px' }}>{saveError}</p>}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button style={{ ...btn(true), flex: 1, background: 'transparent', border: '1px solid #444', color: '#aaa' }} onClick={() => setStep(2)}>← Back</button>
              <button style={{ ...btn(!saving), flex: 2 }} disabled={saving} onClick={handleFinish}>
                {saving ? 'Saving...' : selectedSchools.length > 0 ? 'Finish Setup ✓' : 'Skip & Finish →'}
              </button>
            </div>
          </>}
        </div>
      </div>
    </div>
  )
}
