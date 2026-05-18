'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Supabase writes the session from the URL hash automatically on load.
    // We just need to confirm a user session exists before showing the form.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
      else setError('This reset link is invalid or has expired. Please request a new one.')
    })
  }, [])

  const handleReset = async () => {
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
    } else {
      router.replace('/dashboard')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f4f4] p-8">
      <div className="w-full max-w-sm">

        <div className="mb-8 text-center">
          <span style={{ fontFamily: 'var(--font-bebas, Impact, "Arial Black", sans-serif)', fontSize: '2.5rem', letterSpacing: '0.04em', color: '#3A3A3A' }}>NEXT</span>
          <span style={{ fontFamily: 'var(--font-bebas, Impact, "Arial Black", sans-serif)', fontSize: '2.5rem', letterSpacing: '0.04em', color: '#BE1E2D' }}>KID</span>
        </div>

        <h1 className="text-2xl font-bold text-[#111] mb-1">Choose a new password</h1>
        <p className="text-[#979797] text-sm mb-8">Must be at least 8 characters.</p>

        {!ready && !error && (
          <p className="text-[#979797] text-sm text-center">Verifying your link…</p>
        )}

        {error && (
          <>
            <p className="text-red-500 text-sm mb-6">{error}</p>
            <button
              onClick={() => router.replace('/')}
              className="w-full py-3 rounded-full bg-[#BE1E2D] text-white font-semibold text-sm hover:bg-[#9B1824] transition"
            >
              Back to Sign In
            </button>
          </>
        )}

        {ready && !error && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-[#111] mb-1.5">New password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && handleReset()}
                className="w-full bg-white border border-[#dedede] rounded-xl px-4 py-3 text-sm text-[#111] placeholder-[#979797] outline-none focus:ring-2 focus:ring-[#BE1E2D]/20 focus:border-[#BE1E2D] transition"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-[#111] mb-1.5">Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && handleReset()}
                className="w-full bg-white border border-[#dedede] rounded-xl px-4 py-3 text-sm text-[#111] placeholder-[#979797] outline-none focus:ring-2 focus:ring-[#BE1E2D]/20 focus:border-[#BE1E2D] transition"
              />
            </div>

            <button
              onClick={handleReset}
              disabled={loading}
              className="w-full py-3 rounded-full bg-[#BE1E2D] text-white font-semibold text-sm hover:bg-[#9B1824] disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Updating…' : 'Set New Password'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
