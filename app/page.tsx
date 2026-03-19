'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async () => {
    setError('')
    setMessage('')
    setLoading(true)

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      } else {
        router.push('/onboarding')
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else {
        setMessage('Check your email for a confirmation link, then come back to log in!')
      }
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{
        background: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: '12px',
        padding: '40px',
        width: '100%',
        maxWidth: '400px'
      }}>
        <h1 style={{ color: '#fff', marginBottom: '8px', fontSize: '24px' }}>
          {isLogin ? 'Welcome back' : 'Create account'}
        </h1>
        <p style={{ color: '#888', marginBottom: '32px', fontSize: '14px' }}>
          {isLogin ? 'Sign in to your account' : 'Join us today'}
        </p>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ color: '#aaa', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{
              width: '100%', padding: '12px', borderRadius: '8px',
              background: '#2a2a2a', border: '1px solid #444',
              color: '#fff', fontSize: '14px', boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ color: '#aaa', fontSize: '13px', display: 'block', marginBottom: '6px' }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{
              width: '100%', padding: '12px', borderRadius: '8px',
              background: '#2a2a2a', border: '1px solid #444',
              color: '#fff', fontSize: '14px', boxSizing: 'border-box'
            }}
          />
        </div>

        {error && <p style={{ color: '#ff6b6b', fontSize: '13px', marginBottom: '16px' }}>{error}</p>}
        {message && <p style={{ color: '#6bffb8', fontSize: '13px', marginBottom: '16px' }}>{message}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%', padding: '13px', borderRadius: '8px',
            background: loading ? '#555' : '#6c63ff',
            color: '#fff', border: 'none', fontSize: '15px',
            fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
        </button>

        <p style={{ color: '#888', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <span
            onClick={() => { setIsLogin(!isLogin); setError(''); setMessage('') }}
            style={{ color: '#6c63ff', cursor: 'pointer' }}
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </span>
        </p>
      </div>
    </div>
  )
}