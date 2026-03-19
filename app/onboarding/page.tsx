'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [fullName, setFullName] = useState('')
  const [dob, setDob] = useState('')
  const [ageError, setAgeError] = useState('')
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState('')
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setUserId(user.id)
      setUserEmail(user.email ?? '')
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (profile?.full_name) router.push('/dashboard')
    }
    getUser()
  }, [router])

  const getAge = (dateString: string) => {
    const birth = new Date(dateString)
    const today = new Date()
    const age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    return monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate()) ? age - 1 : age
  }

  const handleFinish = async () => {
    setAgeError('')
    if (!dob) { setAgeError('Please enter your date of birth.'); return }

    const age = getAge(dob)
    const isAdult = age >= 18
    setLoading(true)

    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      email: userEmail,
      role: isAdult ? 'buyer' : 'browse_only',
      full_name: fullName,
      date_of_birth: dob,
      is_age_verified: isAdult,
    })

    if (error) {
      setAgeError('Something went wrong. Please try again.')
    } else {
      router.push('/dashboard')
    }
    setLoading(false)
  }

  const cardStyle = {
    background: '#1a1a1a', border: '1px solid #333', borderRadius: '12px',
    padding: '40px', width: '100%', maxWidth: '460px'
  }
  const pageStyle = {
    minHeight: '100vh', background: '#0a0a0a', display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif'
  }

  if (step === 1) return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ background: '#111', borderBottom: '1px solid #222', padding: '16px 32px', display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-paper-plane" style={{ color: 'rgb(228, 37, 205)', fontSize: '18px' }}></i>
            <span style={{ color: '#fff', fontWeight: '700', fontSize: '20px' }}>NextKid</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 57px)' }}>
          <div style={cardStyle}>
          <p style={{ color: '#6c63ff', fontSize: '13px', marginBottom: '8px' }}>Step 1 of 2</p>
          <h2 style={{ color: '#fff', marginBottom: '8px' }}>Welcome!</h2>
          <p style={{ color: '#888', fontSize: '14px', marginBottom: '28px' }}>Let's get your account set up.</p>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ color: '#aaa', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Full Name</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name"
              style={{ width: '100%', padding: '12px', borderRadius: '8px', background: '#2a2a2a', border: '1px solid #444', color: '#fff', fontSize: '14px', boxSizing: 'border-box' as const }} />
          </div>

          <button onClick={() => setStep(2)} disabled={!fullName}
            style={{
              width: '100%', padding: '13px', borderRadius: '8px', marginTop: '8px',
              background: !fullName ? '#333' : '#6c63ff',
              color: !fullName ? '#666' : '#fff', border: 'none',
              fontSize: '15px', fontWeight: '600', cursor: !fullName ? 'not-allowed' : 'pointer'
            }}>
            Continue →
          </button>
        </div>
      </div>
    </div>
  )

  return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ background: '#111', borderBottom: '1px solid #222', padding: '16px 32px', display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-paper-plane" style={{ color: 'rgb(228, 37, 205)', fontSize: '18px' }}></i>
            <span style={{ color: '#fff', fontWeight: '700', fontSize: '20px' }}>Marketplace</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 57px)' }}>
          <div style={cardStyle}>
        <p style={{ color: '#6c63ff', fontSize: '13px', marginBottom: '8px' }}>Step 2 of 2</p>
        <h2 style={{ color: '#fff', marginBottom: '8px' }}>Verify your age</h2>
        <p style={{ color: '#888', fontSize: '14px', marginBottom: '28px' }}>We need your date of birth to continue</p>

        <div style={{ marginBottom: '8px' }}>
          <label style={{ color: '#aaa', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Date of Birth</label>
          <input type="date" value={dob} onChange={e => setDob(e.target.value)}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', background: '#2a2a2a', border: '1px solid #444', color: '#fff', fontSize: '14px', boxSizing: 'border-box' as const }} />
        </div>

        <div style={{ background: '#1e1b10', border: '1px solid #554', borderRadius: '8px', padding: '12px', marginBottom: '20px', marginTop: '12px' }}>
          <p style={{ color: '#bba', fontSize: '12px', margin: 0 }}>
            🔒 Your date of birth is used only for age verification and stored securely.
          </p>
        </div>

        {ageError && <p style={{ color: '#ff6b6b', fontSize: '13px', marginBottom: '16px' }}>{ageError}</p>}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => setStep(1)}
            style={{ flex: 1, padding: '13px', borderRadius: '8px', background: 'transparent', border: '1px solid #444', color: '#aaa', fontSize: '14px', cursor: 'pointer' }}>
            ← Back
          </button>
          <button onClick={handleFinish} disabled={!dob || loading}
            style={{
              flex: 2, padding: '13px', borderRadius: '8px',
              background: (!dob || loading) ? '#333' : '#6c63ff',
              color: (!dob || loading) ? '#666' : '#fff',
              border: 'none', fontSize: '15px', fontWeight: '600',
              cursor: (!dob || loading) ? 'not-allowed' : 'pointer'
            }}>
            {loading ? 'Saving...' : 'Complete Setup ✓'}
          </button>
        </div>
      </div>
    </div>
    </div>
  )
}