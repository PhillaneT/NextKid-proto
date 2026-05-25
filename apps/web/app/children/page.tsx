'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { Baby, Plus, Ruler, Sparkles, AlertTriangle, ChevronRight, ChevronLeft, X, Check } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

const CLOTHING_SIZES = ['2','3','4','5','6','7','8','9','10','11','12','13','14','16','S','M','L']
const SHOE_SIZES     = ['UK 4','UK 5','UK 6','UK 7','UK 8','UK 9','UK 10','UK 11','UK 12','UK 13','UK 1','UK 2','UK 3','UK 4','UK 5','UK 6','UK 7','UK 8']
const GRADES         = ['R','1','2','3','4','5','6','7','8','9','10','11','12']

type Gender = 'boy' | 'girl' | 'other'

type ChildSize = {
  id: string; recorded_date: string
  top_size: string; bottom_size: string; shoe_size: string; source: string
}

type Prediction = {
  predicted_top: string; predicted_bottom: string; predicted_shoe: string
  confidence_score: number; basis: string
}

type Child = {
  id: string; nickname: string; gender: Gender; dob: string
  grade: string | null; sports: string[]; interests: string[]
  child_sizes: ChildSize[]; prediction?: Prediction | null
}

function ageLabel(dob: string) {
  const born = new Date(dob)
  const now  = new Date()
  let years  = now.getFullYear() - born.getFullYear()
  const hasBirthday = now.getMonth() > born.getMonth() || (now.getMonth() === born.getMonth() && now.getDate() >= born.getDate())
  if (!hasBirthday) years--
  return `${years} yrs`
}

function confidenceColor(score: number) {
  if (score >= 0.85) return 'text-green-600'
  if (score >= 0.70) return 'text-amber-600'
  return 'text-gray-500'
}

function confidenceLabel(score: number) {
  if (score >= 0.85) return 'High'
  if (score >= 0.70) return 'Good'
  return 'Estimate'
}

function genderEmoji(g: Gender) {
  return g === 'boy' ? '👦' : g === 'girl' ? '👧' : '🧒'
}

// ── Pickers ────────────────────────────────────────────────────────────────

function Select({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void
}) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wide">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#BE1E2D]/30"
      >
        <option value="">Select...</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

// ── POPIA Consent ──────────────────────────────────────────────────────────

function PopiaBanner({ onAccept, onDecline }: { onAccept: () => void; onDecline: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full">
        <h2 className="text-lg font-bold text-gray-900 mb-3">Child Data Notice</h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          Before adding a child profile, please confirm you agree to the following:
        </p>
        <ul className="mt-3 space-y-1.5 text-sm text-gray-600">
          <li>• Only a <strong>nickname</strong> is stored — no real names.</li>
          <li>• Size data is used only to generate personalised predictions for your family.</li>
          <li>• Your child's data is <strong>never visible</strong> to other users.</li>
          <li>• Anonymised, aggregated data may improve predictions for all families.</li>
        </ul>
        <p className="mt-3 text-xs text-gray-400">Required under the Protection of Personal Information Act (POPIA).</p>
        <div className="flex gap-3 mt-5">
          <button onClick={onDecline} className="flex-1 border border-gray-200 rounded-full py-3 text-sm font-semibold text-gray-500 hover:bg-gray-50">Decline</button>
          <button onClick={onAccept} className="flex-1 bg-[#BE1E2D] rounded-full py-3 text-sm font-bold text-white hover:bg-[#a01826]">I Agree</button>
        </div>
      </div>
    </div>
  )
}

// ── Add Child Form ─────────────────────────────────────────────────────────

type AddStep = 'popia' | 'profile' | 'sizes'

function AddChildPanel({ token, onSave, onClose }: {
  token: string; onSave: (child: Child) => void; onClose: () => void
}) {
  const [step, setStep] = useState<AddStep>('popia')
  const [nickname, setNickname] = useState('')
  const [gender, setGender]     = useState<Gender | ''>('')
  const [dob, setDob]           = useState('')
  const [grade, setGrade]       = useState('')
  const [topSize, setTopSize]   = useState('')
  const [botSize, setBotSize]   = useState('')
  const [shoeSize, setShoeSize] = useState('')
  const [saving, setSaving]     = useState(false)

  const canNext = nickname.trim() && gender && dob
  const canSave = canNext && topSize && botSize && shoeSize

  const save = async () => {
    setSaving(true)
    const r1 = await fetch('/api/children', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ nickname: nickname.trim(), gender, dob, grade: grade || null, popia_consent: true }),
    })
    if (!r1.ok) { setSaving(false); return }
    const child: Child = await r1.json()
    child.child_sizes = []

    if (topSize && botSize && shoeSize) {
      const r2 = await fetch(`/api/children/${child.id}/sizes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ top_size: topSize, bottom_size: botSize, shoe_size: shoeSize }),
      })
      if (r2.ok) {
        const sz = await r2.json()
        child.child_sizes = [sz]
      }
    }

    setSaving(false)
    onSave(child)
  }

  if (step === 'popia') return <PopiaBanner onAccept={() => setStep('profile')} onDecline={onClose} />

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <button onClick={onClose}><X size={20} className="text-gray-500" /></button>
          <h2 className="font-bold text-gray-900">{step === 'profile' ? 'Child Details' : 'Current Sizes'}</h2>
          <div className="w-5" />
        </div>
        <div className="p-5">
          {step === 'profile' ? (
            <>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wide">Nickname</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#BE1E2D]/30"
                  value={nickname} onChange={e => setNickname(e.target.value)}
                  placeholder="e.g. Boo, Champ, Lily" maxLength={50}
                />
              </div>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wide">Gender</label>
                <div className="flex gap-2">
                  {(['boy','girl','other'] as Gender[]).map(g => (
                    <button
                      key={g} onClick={() => setGender(g)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${gender === g ? 'bg-[#BE1E2D] text-white border-[#BE1E2D]' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                    >
                      {g === 'boy' ? '👦 Boy' : g === 'girl' ? '👧 Girl' : '🧒 Other'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wide">Date of Birth</label>
                <input
                  type="date"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#BE1E2D]/30"
                  value={dob} onChange={e => setDob(e.target.value)}
                />
              </div>
              <Select label="Grade" value={grade} options={GRADES} onChange={setGrade} />
              <button
                onClick={() => canNext && setStep('sizes')}
                disabled={!canNext}
                className="w-full bg-[#BE1E2D] text-white rounded-full py-3 font-bold text-sm mt-2 disabled:opacity-40 flex items-center justify-center gap-2 hover:bg-[#a01826]"
              >
                Next: Add Current Sizes <ChevronRight size={16} />
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-4">Tell us what size your child wears now — we'll predict next year's sizes.</p>
              <Select label="Top size" value={topSize} options={CLOTHING_SIZES} onChange={setTopSize} />
              <Select label="Bottom size" value={botSize} options={CLOTHING_SIZES} onChange={setBotSize} />
              <Select label="Shoe size (UK)" value={shoeSize} options={SHOE_SIZES} onChange={setShoeSize} />
              <div className="flex gap-3 mt-2">
                <button onClick={() => setStep('profile')} className="flex items-center gap-1 px-5 py-3 border border-gray-200 rounded-full text-sm font-semibold text-gray-600 hover:bg-gray-50">
                  <ChevronLeft size={15} /> Back
                </button>
                <button
                  onClick={() => canSave && save()} disabled={!canSave || saving}
                  className="flex-1 bg-[#BE1E2D] text-white rounded-full py-3 font-bold text-sm disabled:opacity-40 hover:bg-[#a01826]"
                >
                  {saving ? 'Saving...' : 'Save Child'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Child Detail ───────────────────────────────────────────────────────────

function ChildDetail({ child, token, onBack, onUpdate }: {
  child: Child; token: string; onBack: () => void; onUpdate: (c: Child) => void
}) {
  const [localChild, setLocalChild]   = useState(child)
  const [prediction, setPrediction]   = useState<Prediction | null>(child.prediction ?? null)
  const [loadingPred, setLoadingPred] = useState(false)
  const [showSizes, setShowSizes]     = useState(false)
  const [topSize, setTopSize]   = useState('')
  const [botSize, setBotSize]   = useState('')
  const [shoeSize, setShoeSize] = useState('')
  const [savingSizes, setSavingSizes] = useState(false)

  const latest = localChild.child_sizes[0]

  const fetchPrediction = useCallback(async () => {
    setLoadingPred(true)
    const res = await fetch(`/api/children/${localChild.id}/prediction`, { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) setPrediction(await res.json())
    setLoadingPred(false)
  }, [localChild.id, token])

  const saveSizes = async () => {
    setSavingSizes(true)
    const res = await fetch(`/api/children/${localChild.id}/sizes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ top_size: topSize, bottom_size: botSize, shoe_size: shoeSize }),
    })
    if (res.ok) {
      const sz = await res.json()
      const updated = { ...localChild, child_sizes: [sz, ...localChild.child_sizes] }
      setLocalChild(updated)
      onUpdate(updated)
      setShowSizes(false)
      setTopSize(''); setBotSize(''); setShoeSize('')
      fetchPrediction()
    }
    setSavingSizes(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="flex items-center gap-1 text-gray-600 hover:text-gray-900 text-sm font-semibold">
          <ChevronLeft size={18} /> All Children
        </button>
        <button
          onClick={() => setShowSizes(!showSizes)}
          className="flex items-center gap-1.5 text-[#BE1E2D] border border-[#BE1E2D] rounded-full px-4 py-2 text-sm font-semibold hover:bg-[#fef2f2]"
        >
          <Ruler size={14} /> Update Sizes
        </button>
      </div>

      {/* Update sizes inline */}
      {showSizes && (
        <div className="bg-gray-50 rounded-2xl p-5 mb-5 border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-4">New Measurement</h3>
          <div className="grid grid-cols-3 gap-3">
            <Select label="Top" value={topSize} options={CLOTHING_SIZES} onChange={setTopSize} />
            <Select label="Bottom" value={botSize} options={CLOTHING_SIZES} onChange={setBotSize} />
            <Select label="Shoe (UK)" value={shoeSize} options={SHOE_SIZES} onChange={setShoeSize} />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowSizes(false)} className="px-5 py-2.5 border border-gray-200 rounded-full text-sm font-semibold text-gray-500 hover:bg-gray-100">Cancel</button>
            <button
              onClick={() => topSize && botSize && shoeSize && saveSizes()}
              disabled={!topSize || !botSize || !shoeSize || savingSizes}
              className="flex-1 bg-[#BE1E2D] text-white rounded-full py-2.5 text-sm font-bold disabled:opacity-40 hover:bg-[#a01826]"
            >
              {savingSizes ? 'Saving...' : 'Save Measurement'}
            </button>
          </div>
        </div>
      )}

      {/* Meta */}
      <div className="bg-gray-50 rounded-2xl p-5 mb-5 flex items-center gap-4">
        <span className="text-5xl">{genderEmoji(localChild.gender)}</span>
        <div>
          <h2 className="text-xl font-bold text-gray-900">{localChild.nickname}</h2>
          <p className="text-gray-400 text-sm mt-0.5">{ageLabel(localChild.dob)}{localChild.grade ? ` · Grade ${localChild.grade}` : ''}</p>
        </div>
      </div>

      {/* Current sizes */}
      {latest ? (
        <div className="bg-gray-50 rounded-2xl p-5 mb-5">
          <h3 className="font-bold text-gray-900 text-sm mb-4">Current Sizes</h3>
          <div className="grid grid-cols-3 gap-3">
            {[['Top', latest.top_size], ['Bottom', latest.bottom_size], ['Shoe', latest.shoe_size]].map(([lbl, val]) => (
              <div key={lbl} className="bg-white rounded-xl p-4 text-center border border-gray-100">
                <p className="text-xs text-gray-400 font-semibold">{lbl}</p>
                <p className="text-2xl font-black text-gray-900 mt-1">{val}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">Recorded {latest.recorded_date}</p>
        </div>
      ) : (
        <div className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl p-8 text-center mb-5 cursor-pointer hover:bg-gray-100" onClick={() => setShowSizes(true)}>
          <Ruler size={24} className="mx-auto text-gray-300 mb-2" />
          <p className="text-gray-400 text-sm">Add current sizes to unlock predictions</p>
        </div>
      )}

      {/* Prediction */}
      <div className="bg-gray-50 rounded-2xl p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[#BE1E2D]" />
            <h3 className="font-bold text-gray-900 text-sm">Next Year's Prediction</h3>
          </div>
          <button onClick={fetchPrediction} disabled={loadingPred} className="text-[#BE1E2D] text-xs font-semibold disabled:opacity-40">
            {loadingPred ? 'Updating...' : 'Refresh'}
          </button>
        </div>
        {prediction ? (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[['Top', prediction.predicted_top], ['Bottom', prediction.predicted_bottom], ['Shoe', prediction.predicted_shoe]].map(([lbl, val]) => (
                <div key={lbl} className="bg-white rounded-xl p-4 text-center border border-gray-100">
                  <p className="text-xs text-gray-400 font-semibold">{lbl}</p>
                  <p className="text-2xl font-black text-[#BE1E2D] mt-1">{val}</p>
                </div>
              ))}
            </div>
            <p className={`text-xs font-semibold ${confidenceColor(prediction.confidence_score)}`}>
              {confidenceLabel(prediction.confidence_score)} confidence ({Math.round(prediction.confidence_score * 100)}%)
            </p>
            {prediction.basis === 'curve_only' && (
              <div className="flex items-center gap-2 mt-2 bg-amber-50 border border-amber-100 rounded-xl p-3">
                <AlertTriangle size={13} className="text-amber-600 shrink-0" />
                <p className="text-xs text-amber-700">Add more size updates over time to improve accuracy.</p>
              </div>
            )}
          </>
        ) : latest ? (
          <button onClick={fetchPrediction} disabled={loadingPred} className="w-full flex items-center justify-center gap-2 py-4 text-[#BE1E2D] font-semibold text-sm">
            <Sparkles size={16} /> {loadingPred ? 'Generating...' : 'Generate Prediction'}
          </button>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">Add sizes first to get a prediction.</p>
        )}
      </div>

      {/* Size history */}
      {localChild.child_sizes.length > 1 && (
        <div className="bg-gray-50 rounded-2xl p-5">
          <h3 className="font-bold text-gray-900 text-sm mb-3">Size History</h3>
          <div className="space-y-2">
            {localChild.child_sizes.slice(0, 6).map((s, i) => (
              <div key={s.id || i} className="flex items-center justify-between border-t border-gray-100 pt-2 first:border-0 first:pt-0">
                <span className="text-xs text-gray-400">{s.recorded_date}</span>
                <span className="text-sm text-gray-700 font-medium">Top {s.top_size} · Bottom {s.bottom_size} · Shoe {s.shoe_size}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function ChildrenPage() {
  const router = useRouter()
  const [token, setToken]       = useState('')
  const [children, setChildren] = useState<Child[]>([])
  const [loading, setLoading]   = useState(true)
  const [showAdd, setShowAdd]   = useState(false)
  const [selected, setSelected] = useState<Child | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/'); return }
      setToken(session.access_token)
      fetch('/api/children', { headers: { Authorization: `Bearer ${session.access_token}` } })
        .then(r => r.ok ? r.json() : [])
        .then(data => { setChildren(data); setLoading(false) })
    })
  }, [router])

  const handleAdd = (child: Child) => {
    setChildren(prev => [...prev, child])
    setShowAdd(false)
    setSelected(child)
  }

  const handleUpdate = (updated: Child) => {
    setChildren(prev => prev.map(c => c.id === updated.id ? updated : c))
    setSelected(updated)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#BE1E2D] border-t-transparent" />
    </div>
  )

  return (
    <div className="min-h-screen bg-white">
      {showAdd && <AddChildPanel token={token} onSave={handleAdd} onClose={() => setShowAdd(false)} />}

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900">My Children</h1>
            <p className="text-sm text-gray-400 mt-0.5">Personalised size predictions for each child</p>
          </div>
          <button
            onClick={() => { setSelected(null); setShowAdd(true) }}
            className="flex items-center gap-2 bg-[#BE1E2D] text-white rounded-full px-5 py-2.5 text-sm font-bold hover:bg-[#a01826]"
          >
            <Plus size={16} /> Add Child
          </button>
        </div>

        {selected ? (
          <ChildDetail
            child={selected} token={token}
            onBack={() => setSelected(null)}
            onUpdate={handleUpdate}
          />
        ) : children.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Baby size={56} className="text-gray-200" />
            <h2 className="text-lg font-bold text-gray-900">No children added yet</h2>
            <p className="text-sm text-gray-400 text-center max-w-xs">Add a child profile to get personalised size predictions for back-to-school shopping.</p>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 bg-[#BE1E2D] text-white rounded-full px-6 py-3 text-sm font-bold hover:bg-[#a01826] mt-2"
            >
              <Plus size={16} /> Add Child
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {children.map(child => {
              const latest = child.child_sizes[0]
              return (
                <button
                  key={child.id}
                  onClick={() => setSelected(child)}
                  className="w-full bg-gray-50 rounded-2xl p-4 flex items-center gap-4 hover:bg-gray-100 transition-colors text-left"
                >
                  <span className="text-4xl">{genderEmoji(child.gender)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900">{child.nickname}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{ageLabel(child.dob)}{child.grade ? ` · Grade ${child.grade}` : ''}</p>
                    {latest && (
                      <p className="text-xs text-gray-500 mt-1">Top {latest.top_size} · Bottom {latest.bottom_size} · Shoe {latest.shoe_size}</p>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-gray-300 shrink-0" />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
