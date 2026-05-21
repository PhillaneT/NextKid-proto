'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { School, Lock, Package, Users } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).single()
      router.replace(profile ? '/dashboard' : '/onboarding')
    })
  }, [router])

  const redirectAfterLogin = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).single()
    router.push(profile ? '/dashboard' : '/onboarding')
  }

  const handleSubmit = async () => {
    setError('')
    setMessage('')
    setLoading(true)
    if (isForgotPassword) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (error) setError(error.message)
      else setMessage('Check your email for a password reset link.')
    } else if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else await redirectAfterLogin()
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setMessage('Check your email for a confirmation link, then come back to log in!')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex">

      {/* Left panel — brand */}
      <div className="hidden md:flex flex-col justify-between w-1/2 bg-[#3A3A3A] p-12">

        {/* Logo */}
        <div className="flex flex-col items-start gap-4">
          <div style={{ display: 'inline-block', marginLeft: '-10px' }}>
            <img src="/logo.png" alt="NextKid" style={{ height: '108px', width: 'auto', display: 'block' }} />
            <p style={{ letterSpacing: '0.22em', fontSize: '0.65rem', color: 'rgba(255,255,255,0.45)', fontWeight: 500, textTransform: 'uppercase', textAlign: 'center', marginTop: '6px' }}>
              Wear.&nbsp; Grow.&nbsp; Repeat.
            </p>
          </div>

          {/* Community badge — below tagline */}
          <div className="inline-flex items-center gap-2 border border-[#BE1E2D]/50 rounded-full px-4 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#BE1E2D]" />
            <span style={{ color: '#BE1E2D', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Community Focused</span>
          </div>
        </div>

        {/* Manifesto */}
        <div>
          <h2 className="text-3xl font-bold text-white mb-5 leading-snug">
            South Africa&apos;s school<br />marketplace
          </h2>
          <p className="text-white/60 text-sm leading-relaxed mb-10">
            We believe in the power of community, where families support one another and small acts of sharing create meaningful change. Every uniform or sports item passed on becomes more than just clothing — it becomes a gesture of care, connection, and opportunity. Together, we&apos;re building a network where children are supported, parents feel empowered, and no one is left behind.
          </p>

          {/* Feature list */}
          <div className="flex flex-col gap-3.5">
            {[
              { icon: School,  label: 'School-specific listings near you' },
              { icon: Lock,    label: 'Funds held safely until delivery' },
              { icon: Package, label: 'Tracked shipping on every order' },
              { icon: Users,   label: 'Trusted community of parents and students' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 text-white/75 text-sm">
                <Icon size={15} strokeWidth={2} className="text-[#BE1E2D] shrink-0" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/25 text-xs">NextKid © 2025</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[#f4f4f4]">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="md:hidden mb-8 flex justify-center">
            <img src="/logo.png" alt="NextKid" style={{ height: '104px', width: 'auto' }} />
          </div>

          <h1 className="text-2xl font-bold text-[#111] mb-1">
            {isForgotPassword ? 'Reset password' : isLogin ? 'Welcome back' : 'Create account'}
          </h1>
          <p className="text-[#979797] text-sm mb-8">
            {isForgotPassword
              ? "Enter your email and we'll send you a reset link"
              : isLogin ? 'Sign in to your account' : 'Join the NextKid community'}
          </p>

          <div className="mb-4">
            <label className="block text-sm font-medium text-[#111] mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className="w-full bg-white border border-[#dedede] rounded-xl px-4 py-3 text-sm text-[#111] placeholder-[#979797] outline-none focus:ring-2 focus:ring-[#BE1E2D]/20 focus:border-[#BE1E2D] transition"
            />
          </div>

          {!isForgotPassword && (
            <div className="mb-2">
              <label className="block text-sm font-medium text-[#111] mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className="w-full bg-white border border-[#dedede] rounded-xl px-4 py-3 text-sm text-[#111] placeholder-[#979797] outline-none focus:ring-2 focus:ring-[#BE1E2D]/20 focus:border-[#BE1E2D] transition"
              />
            </div>
          )}

          {isLogin && !isForgotPassword && (
            <div className="flex justify-end mb-4">
              <button
                onClick={() => { setIsForgotPassword(true); setError(''); setMessage('') }}
                className="text-[#BE1E2D] text-xs font-medium hover:underline"
              >
                Forgot password?
              </button>
            </div>
          )}

          {!isLogin && !isForgotPassword && <div className="mb-4" />}
          {isForgotPassword && <div className="mb-4" />}

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          {message && <p className="text-green-600 text-sm mb-4">{message}</p>}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-3 rounded-full bg-[#BE1E2D] text-white font-semibold text-sm hover:bg-[#9B1824] disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Please wait…' : isForgotPassword ? 'Send Reset Link' : isLogin ? 'Sign In' : 'Create Account'}
          </button>

          <p className="text-[#979797] text-sm text-center mt-6">
            {isForgotPassword ? (
              <>
                Remember your password?{' '}
                <button
                  onClick={() => { setIsForgotPassword(false); setError(''); setMessage('') }}
                  className="text-[#BE1E2D] font-medium hover:underline"
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                {isLogin ? "Don't have an account? " : 'Already have an account? '}
                <button
                  onClick={() => { setIsLogin(!isLogin); setError(''); setMessage('') }}
                  className="text-[#BE1E2D] font-medium hover:underline"
                >
                  {isLogin ? 'Sign up' : 'Sign in'}
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}