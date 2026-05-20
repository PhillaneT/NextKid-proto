'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, School, MapPin, Phone, Mail, CreditCard, ChevronRight } from 'lucide-react';

const BANKS = ['ABSA', 'Capitec', 'FNB', 'Nedbank', 'Standard Bank', 'African Bank', 'Investec', 'TymeBank'];

type Step = 1 | 2 | 3;

export default function SchoolApplyPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // Step 1 — find your school
  const [schoolQuery, setSchoolQuery] = useState('');
  const [schoolResults, setSchoolResults] = useState<{ id: string; name: string; city_name: string; province_code: string }[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<{ id: string; name: string; city_name: string; province_code: string } | null>(null);
  const [searching, setSearching] = useState(false);

  // Step 2 — contact details
  const [contactName,  setContactName]  = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [referralCode, setReferralCode] = useState('');

  // Step 3 — bank details
  const [bankName,          setBankName]          = useState('');
  const [accountHolder,     setAccountHolder]     = useState('');
  const [accountNumber,     setAccountNumber]     = useState('');
  const [branchCode,        setBranchCode]        = useState('');

  const searchSchools = async (q: string) => {
    setSchoolQuery(q);
    if (q.trim().length < 2) { setSchoolResults([]); return; }
    setSearching(true);
    try {
      const res  = await fetch(`/api/locations/schools/search?q=${encodeURIComponent(q)}&limit=8`);
      const data = await res.json();
      setSchoolResults(Array.isArray(data) ? data : []);
    } catch { setSchoolResults([]); }
    setSearching(false);
  };

  const handleSubmit = async () => {
    if (!selectedSchool || !contactName || !contactEmail || !bankName || !accountHolder || !accountNumber || !branchCode) return;
    setSubmitting(true);
    setError('');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/'); return; }

    const res = await fetch('/api/schools/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        schoolId:     selectedSchool.id,
        contactName,  contactEmail, contactPhone,
        referralCode: referralCode || null,
        bankName, accountHolder, accountNumber, branchCode,
      }),
    });

    const json = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      if (json.error === 'already_applied') setError('This school has already submitted an application.');
      else setError(json.error ?? 'Submission failed — please try again.');
      return;
    }
    setSubmitted(true);
  };

  if (submitted) return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="w-20 h-20 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center mx-auto">
          <CheckCircle2 size={40} strokeWidth={1.5} className="text-green-500" />
        </div>
        <h1 className="text-2xl font-bold text-[#111]">Application submitted!</h1>
        <p className="text-[#979797]">
          Your Klerebank application is under review. We will notify you within 48 hours at <strong>{contactEmail}</strong>.
        </p>
        <button onClick={() => router.push('/dashboard')}
          className="w-full py-3 bg-[#BE1E2D] hover:bg-[#9B1824] text-white rounded-full font-semibold transition">
          Back to marketplace
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-xl mx-auto px-6 py-10 space-y-8">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-[#BE1E2D] text-sm font-medium mb-4">
            <School size={16} strokeWidth={2} />
            Klerebank Partner Application
          </div>
          <h1 className="text-2xl font-bold text-[#111]">Register your school as a drop-off point</h1>
          <p className="text-[#979797] text-sm mt-2">
            Join the NextKid Klerebank network. Your school becomes a trusted hub where buyers and sellers safely exchange items — with full anonymity protected.
          </p>
        </div>

        {/* Progress */}
        <div className="flex gap-2">
          {([1, 2, 3] as Step[]).map(s => (
            <div key={s} className={`flex-1 h-1.5 rounded-full transition ${step >= s ? 'bg-[#BE1E2D]' : 'bg-[#dedede]'}`} />
          ))}
        </div>
        <p className="text-xs text-[#979797] -mt-6">Step {step} of 3 — {step === 1 ? 'Find your school' : step === 2 ? 'Contact details' : 'Bank details'}</p>

        {/* ── Step 1: Find school ───────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#111] mb-2">Search your school</label>
              <input
                value={schoolQuery}
                onChange={e => searchSchools(e.target.value)}
                placeholder="e.g. Noordwyk, Hoërskool Waterkloof..."
                className="w-full bg-[#f4f4f4] border border-[#dedede] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#BE1E2D] transition"
              />
            </div>

            {searching && <p className="text-sm text-[#979797]">Searching...</p>}

            {schoolResults.length > 0 && !selectedSchool && (
              <div className="border border-[#dedede] rounded-2xl overflow-hidden divide-y divide-[#dedede]">
                {schoolResults.map(s => (
                  <button key={s.id} onClick={() => { setSelectedSchool(s); setSchoolResults([]); setSchoolQuery(s.name); }}
                    className="w-full text-left px-4 py-3 hover:bg-[#f4f4f4] transition flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[#111]">{s.name}</p>
                      <p className="text-xs text-[#979797]">{s.city_name} · {s.province_code}</p>
                    </div>
                    <ChevronRight size={16} strokeWidth={2} className="text-[#dedede]" />
                  </button>
                ))}
              </div>
            )}

            {selectedSchool && (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={18} strokeWidth={2} className="text-green-500 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-[#111]">{selectedSchool.name}</p>
                    <p className="text-xs text-[#979797]">{selectedSchool.city_name} · {selectedSchool.province_code}</p>
                  </div>
                </div>
                <button onClick={() => { setSelectedSchool(null); setSchoolQuery(''); }} className="text-xs text-[#979797] hover:text-red-500">Change</button>
              </div>
            )}

            <button onClick={() => setStep(2)} disabled={!selectedSchool}
              className="w-full py-3 bg-[#BE1E2D] disabled:bg-[#dedede] disabled:text-[#979797] text-white rounded-full font-semibold transition">
              Continue →
            </button>
          </div>
        )}

        {/* ── Step 2: Contact details ───────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {[
                { label: 'Contact person name *', value: contactName, set: setContactName, placeholder: 'e.g. Mrs Thandi Mokoena', icon: <School size={15} className="text-[#979797]" /> },
                { label: 'Contact email *', value: contactEmail, set: setContactEmail, placeholder: 'principal@school.edu.za', icon: <Mail size={15} className="text-[#979797]" /> },
                { label: 'Contact phone', value: contactPhone, set: setContactPhone, placeholder: '+27 82 000 0000', icon: <Phone size={15} className="text-[#979797]" /> },
              ].map(f => (
                <div key={f.label}>
                  <label className="block text-sm font-medium text-[#111] mb-2">{f.label}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2">{f.icon}</span>
                    <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                      className="w-full bg-[#f4f4f4] border border-[#dedede] rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-[#BE1E2D] transition" />
                  </div>
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-[#111] mb-1">Referral code <span className="text-[#979797] font-normal">(optional)</span></label>
                <p className="text-xs text-[#979797] mb-2">Were you referred by another school in the Klerebank network?</p>
                <input value={referralCode} onChange={e => setReferralCode(e.target.value)}
                  placeholder="e.g. NWYK-2026"
                  className="w-full bg-[#f4f4f4] border border-[#dedede] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#BE1E2D] transition" />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep(1)} className="flex-1 py-3 border border-[#dedede] text-[#979797] rounded-full font-medium transition hover:border-[#111]">← Back</button>
              <button onClick={() => setStep(3)} disabled={!contactName || !contactEmail}
                className="flex-grow py-3 bg-[#BE1E2D] disabled:bg-[#dedede] disabled:text-[#979797] text-white rounded-full font-semibold transition">
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Bank details ──────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-xs text-amber-700">
              Bank details are used to pay out your school's share of Klerebank handling fees. They are verified by Praesignis before going live and are never shared with buyers or sellers.
            </div>

            <div>
              <label className="block text-sm font-medium text-[#111] mb-2">Bank *</label>
              <select value={bankName} onChange={e => setBankName(e.target.value)}
                className="w-full bg-[#f4f4f4] border border-[#dedede] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#BE1E2D] transition">
                <option value="">Select bank...</option>
                {BANKS.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>

            {[
              { label: 'Account holder name *', value: accountHolder, set: setAccountHolder, placeholder: 'Legal name on account' },
              { label: 'Account number *', value: accountNumber, set: setAccountNumber, placeholder: '1234567890' },
              { label: 'Branch code *', value: branchCode, set: setBranchCode, placeholder: '250655' },
            ].map(f => (
              <div key={f.label}>
                <label className="block text-sm font-medium text-[#111] mb-2">{f.label}</label>
                <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                  className="w-full bg-[#f4f4f4] border border-[#dedede] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#BE1E2D] transition" />
              </div>
            ))}

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep(2)} className="flex-1 py-3 border border-[#dedede] text-[#979797] rounded-full font-medium transition hover:border-[#111]">← Back</button>
              <button onClick={handleSubmit}
                disabled={submitting || !bankName || !accountHolder || !accountNumber || !branchCode}
                className="flex-grow py-3 bg-[#BE1E2D] disabled:bg-[#dedede] disabled:text-[#979797] text-white rounded-full font-semibold transition">
                {submitting ? 'Submitting...' : 'Submit application 🎓'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
