'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { School, Lock, Package } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  // If already logged in, skip the login page
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).single()
      router.replace(profile ? '/dashboard' : '/onboarding')
    })
  }, [router])

  // After login: go to dashboard if profile exists, onboarding if not
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

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      } else {
        await redirectAfterLogin()
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
    <div className="min-h-screen bg-[#f4f4f4] flex">
      {/* Left panel — branding */}
      <div className="hidden md:flex flex-col justify-between w-1/2 bg-[#4757bf] p-12">
        <div>
          <span className="text-3xl font-bold text-white">NextKid</span>
        </div>
        <div>
          <h2 className="text-4xl font-bold text-white mb-4 leading-tight">
            South Africa&apos;s school marketplace
          </h2>
          <p className="text-white/80 text-lg">
            Buy and sell uniforms, books, sports kit and more — safely and securely.
          </p>
          <div className="mt-10 flex flex-col gap-4 text-white/90 text-sm">
            <div className="flex items-center gap-3"><School size={18} strokeWidth={2} className="shrink-0" /><span>School-specific listings</span></div>
            <div className="flex items-center gap-3"><Lock size={18} strokeWidth={2} className="shrink-0" /><span>Escrow payments via Peach Payments</span></div>
            <div className="flex items-center gap-3"><Package size={18} strokeWidth={2} className="shrink-0" /><span>Tracked shipping on every order</span></div>
          </div>
        </div>
        <p className="text-white/50 text-xs">NextKid © 2025</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="md:hidden mb-8 text-center">
            <span className="text-2xl font-bold" style={{ color: '#4757bf' }}>NextKid</span>
          </div>

          <h1 className="text-2xl font-bold text-[#111] mb-1">
            {isLogin ? 'Welcome back' : 'Create account'}
          </h1>
          <p className="text-[#979797] text-sm mb-8">
            {isLogin ? 'Sign in to your account' : 'Join NextKid today'}
          </p>

          <div className="mb-4">
            <label className="block text-sm font-medium text-[#111] mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className="w-full bg-[#f4f4f4] border border-[#dedede] rounded-xl px-4 py-3 text-sm text-[#111] placeholder-[#979797] outline-none focus:ring-2 focus:ring-[#4757bf]/30 focus:border-[#4757bf] transition"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-[#111] mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className="w-full bg-[#f4f4f4] border border-[#dedede] rounded-xl px-4 py-3 text-sm text-[#111] placeholder-[#979797] outline-none focus:ring-2 focus:ring-[#4757bf]/30 focus:border-[#4757bf] transition"
            />
          </div>

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          {message && <p className="text-green-600 text-sm mb-4">{message}</p>}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-3 rounded-full bg-[#4757bf] text-white font-semibold text-sm hover:bg-[#3a48a8] disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>

          <p className="text-[#979797] text-sm text-center mt-6">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setIsLogin(!isLogin); setError(''); setMessage('') }}
              className="text-[#4757bf] font-medium hover:underline"
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
