'use client';

import { useEffect, useState, useRef } from 'react';
import { SA_PROVINCES } from '@nextkid/shared';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import {
  MapPin, School, CheckCircle2, Package,
  Tag, Clock, ShoppingBag, Pencil, X, Check, Home, Search, LocateFixed,
} from 'lucide-react';
import Image from 'next/image';

// ── Types ─────────────────────────────────────────────────────────────────────

type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  province: string | null;
  city_id: string | null;
  city_name: string | null;
  suburb_id: string | null;
  suburb_name: string | null;
  street_address: string | null;
  postal_code: string | null;
  preferred_locker_id: string | null;
  preferred_locker_name: string | null;
  preferred_locker_address: string | null;
  school_ids: string[] | null;
  school_id: string | null;
  school_name: string | null;
};

type SchoolRow = { id: string; name: string; city_name: string; province_code?: string };

type CityOption   = { id: string; name: string };
type SuburbOption = { id: string; name: string; postal_code?: string };

type ListingItem = {
  id: string;
  title: string;
  price_cents: number;
  images: string[];
  status: string;
  category: string;
  created_at: string;
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  if (s === 'ACTIVE') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f0fdf4] border border-[#bbf7d0] text-green-700 text-xs font-semibold">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> Live
    </span>
  );
  if (s === 'SOLD') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f0f4ff] border border-[#c7d2fe] text-[#BE1E2D] text-xs font-semibold">
      <CheckCircle2 size={11} strokeWidth={2.5} /> Sold
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f4f4f4] border border-[#dedede] text-[#979797] text-xs font-semibold capitalize">
      {status.toLowerCase()}
    </span>
  );
}

function ListingCard({ item, onClick }: { item: ListingItem; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group text-left bg-white border border-[#dedede] rounded-2xl overflow-hidden hover:shadow-md transition">
      <div className="aspect-square bg-[#f4f4f4] relative overflow-hidden">
        {item.images?.[0] ? (
          <Image src={item.images[0]} alt={item.title} fill className="object-cover group-hover:scale-105 transition duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package size={36} strokeWidth={1.5} className="text-[#dedede]" />
          </div>
        )}
        <div className="absolute top-2 left-2"><StatusBadge status={item.status} /></div>
      </div>
      <div className="p-3">
        <p className="text-xs text-[#979797] mb-0.5">{item.category}</p>
        <p className="text-sm font-semibold text-[#111] leading-snug line-clamp-2">{item.title}</p>
        <p className="text-[#BE1E2D] font-bold text-base mt-1">R{(item.price_cents / 100).toLocaleString()}</p>
      </div>
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();

  const [profile, setProfile]               = useState<Profile | null>(null);
  const [schools, setSchools]               = useState<SchoolRow[]>([]);
  const [activeListings, setActiveListings] = useState<ListingItem[]>([]);
  const [soldListings, setSoldListings]     = useState<ListingItem[]>([]);
  const [loading, setLoading]               = useState(true);
  const [tab, setTab]                       = useState<'active' | 'sold'>('active');

  // ── Address edit state ────────────────────────────────────────────────────────
  const [editingAddress, setEditingAddress] = useState(false);
  const [editName, setEditName]             = useState('');
  const [editStreet, setEditStreet]         = useState('');
  const [editPostalCode, setEditPostalCode] = useState('');
  const [editProvince, setEditProvince]     = useState('');
  const [editCityId, setEditCityId]         = useState('');
  const [editCityName, setEditCityName]     = useState('');
  const [cityQuery, setCityQuery]           = useState('');
  const [cityResults, setCityResults]       = useState<(CityOption & { province_code: string })[]>([]);
  const [searchingCities, setSearchingCities] = useState(false);
  const [cityInputFocused, setCityInputFocused] = useState(false);
  const [suburbs, setSuburbs]               = useState<SuburbOption[]>([]);
  const [editSuburbId, setEditSuburbId]     = useState('');
  const [editSuburbName, setEditSuburbName] = useState('');
  const [loadingSuburbs, setLoadingSuburbs] = useState(false);
  const [savingAddress, setSavingAddress]   = useState(false);
  const [addressError, setAddressError]     = useState('');

  // ── Locker edit state ─────────────────────────────────────────────────────────
  type LockerResult = { id: string; name: string; address: string }
  const [editLockerId, setEditLockerId]         = useState('');
  const [editLockerName, setEditLockerName]     = useState('');
  const [editLockerAddress, setEditLockerAddress] = useState('');
  const [lockerQuery, setLockerQuery]           = useState('');
  const [lockerResults, setLockerResults]       = useState<LockerResult[]>([]);
  const [searchingLockers, setSearchingLockers] = useState(false);
  const [quickAddingLocker, setQuickAddingLocker] = useState(false);
  const [savingQuickLocker, setSavingQuickLocker] = useState(false);

  // Suppress cascade resets when location is pre-filled from profile
  const skipCityRef = useRef('');

  // ── Schools edit state ────────────────────────────────────────────────────────
  // RULE: schools are independent of delivery address — a user can follow schools
  // in any province (e.g. a parent with kids at different schools across SA).
  const [editingSchools, setEditingSchools] = useState(false);
  const [editSchools, setEditSchools]       = useState<SchoolRow[]>([]);
  const [schoolQuery, setSchoolQuery]       = useState('');
  const [schoolResults, setSchoolResults]   = useState<SchoolRow[]>([]);
  const [searchingSchools, setSearchingSchools] = useState(false);
  const [savingSchools, setSavingSchools]   = useState(false);
  const [schoolsError, setSchoolsError]     = useState('');

  // ── Load profile ──────────────────────────────────────────────────────────────
  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/'); return; }

    const [{ data: prof }, { data: items }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('listings')
        .select('id, title, price_cents, images, status, category, created_at')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false }),
    ]);

    if (!prof) { router.push('/onboarding'); return; }
    setProfile(prof);

    if (prof.school_ids?.length) {
      const { data: schoolData } = await supabase
        .from('schools').select('id, name, city_name, province_code').in('id', prof.school_ids);
      setSchools(schoolData ?? []);
    }

    const all = items ?? [];
    setActiveListings(all.filter(i => i.status === 'ACTIVE'));
    setSoldListings(all.filter(i => i.status === 'SOLD'));
    setLoading(false);
  }

  // ── Cascade: province → cities ───────────────────────────────────────────────
  useEffect(() => {
    return; // Province cascade removed — city is now searched directly
  }, [editProvince]);

  // City search — type 2 letters to find any SA city
  useEffect(() => {
    if (cityQuery.trim().length < 2) { setCityResults([]); return; }
    if (cityQuery === editCityName) return; // already selected, don't re-search
    const timer = setTimeout(async () => {
      setSearchingCities(true);
      try {
        const params = new URLSearchParams({ q: cityQuery.trim() });
        if (editProvince) params.set('province', editProvince);
        const res = await fetch(`/api/locations/cities/search?${params}`);
        const data = await res.json();
        setCityResults(Array.isArray(data) ? data : []);
      } catch { setCityResults([]); }
      finally { setSearchingCities(false); }
    }, 200);
    return () => clearTimeout(timer);
  }, [cityQuery, editCityName, editProvince]);

  const handleCitySelect = (city: CityOption & { province_code: string }) => {
    setEditCityId(city.id);
    setEditCityName(city.name);
    setCityQuery(city.name);
    setCityResults([]);
    setCityInputFocused(false);
    setEditProvince(city.province_code);
    setSuburbs([]); setEditSuburbId(''); setEditSuburbName('');
    setLoadingSuburbs(true);
    fetch(`/api/locations/suburbs?cityId=${encodeURIComponent(city.id)}`)
      .then(r => r.json())
      .then(data => { setSuburbs(Array.isArray(data) ? data : []); setLoadingSuburbs(false); })
      .catch(() => setLoadingSuburbs(false));
  };

  // ── Cascade: city → suburbs ──────────────────────────────────────────────────
  useEffect(() => {
    if (!editCityId) { setSuburbs([]); setEditSuburbId(''); setEditSuburbName(''); return; }
    if (skipCityRef.current === editCityId) { skipCityRef.current = ''; return; }
    setLoadingSuburbs(true);
    fetch(`/api/locations/suburbs?cityId=${encodeURIComponent(editCityId)}`)
      .then(r => r.json())
      .then(data => { setSuburbs(Array.isArray(data) ? data : []); setLoadingSuburbs(false); });
    setEditSuburbId(''); setEditSuburbName('');
  }, [editCityId]);

  // ── School search: debounced national search via API ─────────────────────────
  useEffect(() => {
    if (!schoolQuery || schoolQuery.length < 2) { setSchoolResults([]); return; }
    const timer = setTimeout(async () => {
      setSearchingSchools(true);
      try {
        const res = await fetch(`/api/locations/schools/search?q=${encodeURIComponent(schoolQuery.trim())}&limit=15`);
        const data = await res.json();
        setSchoolResults(Array.isArray(data) ? data as SchoolRow[] : []);
      } catch { setSchoolResults([]); }
      finally { setSearchingSchools(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [schoolQuery]);

  // ── Locker search: debounced, queries our server-side proxy ─────────────────
  useEffect(() => {
    if (!lockerQuery || lockerQuery.length < 2) { setLockerResults([]); return; }
    const timer = setTimeout(async () => {
      setSearchingLockers(true);
      const res = await fetch(`/api/lockers/search?q=${encodeURIComponent(lockerQuery)}`);
      const data = await res.json() as LockerResult[];
      setLockerResults(Array.isArray(data) ? data : []);
      setSearchingLockers(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [lockerQuery]);

  // ── Address editing ───────────────────────────────────────────────────────────
  async function startEditAddress() {
    if (!profile) return;
    setEditName(profile.full_name ?? '');
    setEditStreet(profile.street_address ?? '');
    setEditPostalCode(profile.postal_code ?? '');
    setEditLockerId(profile.preferred_locker_id ?? '');
    setEditLockerName(profile.preferred_locker_name ?? '');
    setEditLockerAddress(profile.preferred_locker_address ?? '');
    setLockerQuery('');
    setLockerResults([]);
    setAddressError('');

    if (profile.city_id && profile.suburb_id) {
      const suburbsRes = await fetch(`/api/locations/suburbs?cityId=${encodeURIComponent(profile.city_id)}`).then(r => r.json());
      skipCityRef.current = profile.city_id;
      setSuburbs(Array.isArray(suburbsRes) ? suburbsRes : []);
    }

    setEditProvince(profile.province ?? '');
    setEditCityId(profile.city_id ?? '');
    setEditCityName(profile.city_name ?? '');
    setCityQuery(profile.city_name ?? '');
    setEditSuburbId(profile.suburb_id ?? '');
    setEditSuburbName(profile.suburb_name ?? '');
    setEditingAddress(true);
  }

  async function saveAddress() {
    if (!profile || !editName.trim()) return;
    setSavingAddress(true);
    setAddressError('');

    const { error } = await supabase.from('profiles').update({
      full_name:               editName.trim(),
      province:                editProvince   || null,
      city_id:                 editCityId     || null,
      city_name:               editCityName   || null,
      suburb_id:               editSuburbId   || null,
      suburb_name:             editSuburbName || null,
      street_address:          editStreet.trim()        || null,
      postal_code:             editPostalCode.trim()    || null,
      preferred_locker_id:     editLockerId             || null,
      preferred_locker_name:   editLockerName           || null,
      preferred_locker_address: editLockerAddress       || null,
    }).eq('id', profile.id);

    if (error) {
      setAddressError('Error saving: ' + error.message);
    } else {
      setProfile(prev => prev ? {
        ...prev,
        full_name:               editName.trim(),
        province:                editProvince   || null,
        city_id:                 editCityId     || null,
        city_name:               editCityName   || null,
        suburb_id:               editSuburbId   || null,
        suburb_name:             editSuburbName || null,
        street_address:          editStreet.trim()        || null,
        postal_code:             editPostalCode.trim()    || null,
        preferred_locker_id:     editLockerId             || null,
        preferred_locker_name:   editLockerName           || null,
        preferred_locker_address: editLockerAddress       || null,
      } : prev);
      setEditingAddress(false);
    }
    setSavingAddress(false);
  }

  // ── Quick locker add (from profile view, no full edit needed) ────────────────
  function openQuickLockerPicker() {
    setLockerQuery(profile?.suburb_name ?? profile?.city_name ?? '');
    setLockerResults([]);
    setQuickAddingLocker(true);
  }

  async function quickSaveLocker(locker: LockerResult) {
    if (!profile) return;
    setSavingQuickLocker(true);
    const { error } = await supabase.from('profiles').update({
      preferred_locker_id:      locker.id,
      preferred_locker_name:    locker.name,
      preferred_locker_address: locker.address,
    }).eq('id', profile.id);
    if (!error) {
      setProfile(prev => prev ? {
        ...prev,
        preferred_locker_id:      locker.id,
        preferred_locker_name:    locker.name,
        preferred_locker_address: locker.address,
      } : prev);
    }
    setQuickAddingLocker(false);
    setLockerQuery('');
    setLockerResults([]);
    setSavingQuickLocker(false);
  }

  // ── Schools editing ───────────────────────────────────────────────────────────
  function startEditSchools() {
    setEditSchools(schools);
    setSchoolQuery('');
    setSchoolResults([]);
    setSchoolsError('');
    setEditingSchools(true);
  }

  function toggleSchool(school: SchoolRow) {
    setEditSchools(prev => {
      const already = prev.some(s => s.id === school.id);
      return already ? prev.filter(s => s.id !== school.id) : [...prev, school];
    });
    setSchoolQuery('');
    setSchoolResults([]);
  }

  async function saveSchools() {
    if (!profile) return;
    setSavingSchools(true);
    setSchoolsError('');

    const { error } = await supabase.from('profiles').update({
      // RULE: school_ids is the multi-school array; school_id/school_name are the
      // primary school (first in list) used for legacy queries and display.
      school_ids:  editSchools.map(s => s.id),
      school_id:   editSchools[0]?.id   ?? null,
      school_name: editSchools[0]?.name ?? null,
    }).eq('id', profile.id);

    if (error) {
      setSchoolsError('Error saving: ' + error.message);
    } else {
      setProfile(prev => prev ? {
        ...prev,
        school_ids:  editSchools.map(s => s.id),
        school_id:   editSchools[0]?.id   ?? null,
        school_name: editSchools[0]?.name ?? null,
      } : prev);
      setSchools(editSchools);
      setEditingSchools(false);
    }
    setSavingSchools(false);
  }

  const signOut = async () => { await supabase.auth.signOut(); router.push('/'); };

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center text-[#979797]">Loading...</div>
  );

  const initials = profile?.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? '?';
  const displayListings = tab === 'active' ? activeListings : soldListings;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">

        {/* ── Profile header ──────────────────────────────────────────────────── */}
        <div className="bg-[#f4f4f4] rounded-3xl p-6">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-full bg-[#BE1E2D] flex items-center justify-center shrink-0">
              <span className="text-white text-xl font-bold">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-[#111]">{profile?.full_name}</h1>
              <p className="text-[#979797] text-sm mt-0.5">{profile?.email}</p>
            </div>
            <button
              onClick={signOut}
              className="shrink-0 px-4 py-2 border border-[#dedede] rounded-full text-sm text-[#979797] hover:border-red-300 hover:text-red-400 transition"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* ── Delivery Address card ────────────────────────────────────────────── */}
        <div className="bg-[#f4f4f4] rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-[#111]">Delivery Address</h2>
              <p className="text-xs text-[#979797] mt-0.5">Used for door-to-door deliveries when you buy.</p>
            </div>
            {!editingAddress && (
              <button
                onClick={startEditAddress}
                className="flex items-center gap-1.5 px-4 py-2 border border-[#dedede] hover:border-[#BE1E2D] text-[#111] hover:text-[#BE1E2D] rounded-full text-sm transition"
              >
                <Pencil size={13} strokeWidth={2} /> Edit
              </button>
            )}
          </div>

          {editingAddress ? (
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-[#979797] uppercase tracking-wide mb-1.5">Full name</label>
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full bg-white border border-[#dedede] rounded-xl px-4 py-2.5 text-[#111] text-sm focus:outline-none focus:border-[#BE1E2D] transition"
                  placeholder="Your full name"
                />
              </div>

              {/* Province */}
              <div>
                <label className="block text-xs font-semibold text-[#979797] uppercase tracking-wide mb-1.5">Province</label>
                <select
                  value={editProvince}
                  onChange={e => {
                    setEditProvince(e.target.value);
                    setCityQuery(''); setEditCityId(''); setEditCityName('');
                    setSuburbs([]); setEditSuburbId(''); setEditSuburbName('');
                  }}
                  className="w-full bg-white border border-[#dedede] rounded-xl px-4 py-2.5 text-[#111] text-sm focus:outline-none focus:border-[#BE1E2D] transition"
                >
                  <option value="">Select province...</option>
                  {SA_PROVINCES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>

              {/* City search */}
              <div className="relative">
                <label className="block text-xs font-semibold text-[#979797] uppercase tracking-wide mb-1.5">City</label>
                <input
                  value={cityQuery}
                  onChange={e => {
                    setCityQuery(e.target.value);
                    if (e.target.value !== editCityName) {
                      setEditCityId(''); setEditCityName('');
                      setSuburbs([]); setEditSuburbId(''); setEditSuburbName('');
                    }
                  }}
                  onFocus={() => setCityInputFocused(true)}
                  onBlur={() => setTimeout(() => setCityInputFocused(false), 150)}
                  placeholder="Type 2 letters to search (e.g. Jo, Ca, Pre...)"
                  autoComplete="off"
                  className="w-full bg-white border border-[#dedede] rounded-xl px-4 py-2.5 text-[#111] text-sm focus:outline-none focus:border-[#BE1E2D] transition"
                />
                {searchingCities && <span className="absolute right-3 top-9 text-xs text-[#979797]">...</span>}
                {editCityId && <span className="absolute right-3 top-9 text-sm font-bold text-[#BE1E2D]">✓</span>}

                {cityResults.length > 0 && cityInputFocused && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-[#dedede] rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {cityResults.map(city => (
                      <button
                        key={city.id}
                        type="button"
                        onMouseDown={() => handleCitySelect(city)}
                        className="w-full text-left px-4 py-2.5 hover:bg-[#fde8ea] transition border-b border-[#f4f4f4] last:border-0"
                      >
                        <p className="text-sm font-semibold text-[#111]">{city.name}</p>
                        <p className="text-xs text-[#979797]">{city.province_code}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Suburb */}
              {editCityId && (
                <div>
                  <label className="block text-xs font-semibold text-[#979797] uppercase tracking-wide mb-1.5">Suburb</label>
                  <select
                    value={editSuburbId}
                    onChange={e => {
                      const opt = suburbs.find(s => s.id === e.target.value);
                      setEditSuburbId(e.target.value);
                      setEditSuburbName(opt?.name ?? '');
                      if (opt?.postal_code) setEditPostalCode(opt.postal_code);
                    }}
                    disabled={loadingSuburbs}
                    className="w-full bg-white border border-[#dedede] rounded-xl px-4 py-2.5 text-[#111] text-sm focus:outline-none focus:border-[#BE1E2D] transition disabled:opacity-50"
                  >
                    <option value="">{loadingSuburbs ? 'Loading...' : 'Select suburb...'}</option>
                    {suburbs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}

              {/* Street address */}
              <div>
                <label className="block text-xs font-semibold text-[#979797] uppercase tracking-wide mb-1.5">
                  Street address <span className="text-[#dedede] font-normal normal-case">(optional)</span>
                </label>
                <input
                  value={editStreet}
                  onChange={e => setEditStreet(e.target.value)}
                  className="w-full bg-white border border-[#dedede] rounded-xl px-4 py-2.5 text-[#111] text-sm focus:outline-none focus:border-[#BE1E2D] transition"
                  placeholder="e.g. 12 Main Street, Apt 4"
                />
              </div>

              {/* Postal code */}
              <div>
                <label className="block text-xs font-semibold text-[#979797] uppercase tracking-wide mb-1.5">Postal code</label>
                <input
                  value={editPostalCode}
                  onChange={e => setEditPostalCode(e.target.value)}
                  className="w-full bg-white border border-[#dedede] rounded-xl px-4 py-2.5 text-[#111] text-sm focus:outline-none focus:border-[#BE1E2D] transition"
                  placeholder="e.g. 0157"
                  inputMode="numeric"
                />
              </div>

              {/* ── Preferred PUDO locker ──────────────────────────────────── */}
              <div className="pt-2 border-t border-[#ebebeb]">
                <label className="block text-xs font-semibold text-[#979797] uppercase tracking-wide mb-0.5">
                  Preferred PUDO Locker <span className="font-normal normal-case text-[#c0c0c0]">(optional)</span>
                </label>
                <p className="text-xs text-[#979797] mb-2">
                  Add a locker near you to unlock cheaper locker-delivery options at checkout.
                </p>

                {/* Currently selected locker chip */}
                {editLockerId && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#fde8ea] border border-[#c7d2fe] text-[#BE1E2D] text-xs font-semibold rounded-full">
                      <LocateFixed size={11} strokeWidth={2.5} />
                      {editLockerName}
                      <button type="button" onClick={() => { setEditLockerId(''); setEditLockerName(''); setEditLockerAddress(''); }} className="hover:text-red-500 transition ml-0.5">
                        <X size={11} strokeWidth={2.5} />
                      </button>
                    </span>
                  </div>
                )}

                {/* Search for a locker */}
                {!editLockerId && (
                  <div className="relative">
                    <Search size={15} strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#979797]" />
                    <input
                      value={lockerQuery}
                      onChange={e => setLockerQuery(e.target.value)}
                      className="w-full bg-white border border-[#dedede] rounded-xl pl-9 pr-4 py-2.5 text-[#111] text-sm focus:outline-none focus:border-[#BE1E2D] transition"
                      placeholder="Search by locker name or area, e.g. Rivonia, Fourways..."
                    />
                    {lockerQuery.length >= 2 && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-[#dedede] rounded-xl shadow-lg max-h-56 overflow-y-auto">
                        {searchingLockers ? (
                          <p className="text-[#979797] text-sm text-center py-3">Searching…</p>
                        ) : lockerResults.length === 0 ? (
                          <p className="text-[#979797] text-sm text-center py-3">No lockers found for &ldquo;{lockerQuery}&rdquo;</p>
                        ) : lockerResults.map(l => (
                          <button
                            type="button"
                            key={l.id}
                            onClick={() => {
                              setEditLockerId(l.id);
                              setEditLockerName(l.name);
                              setEditLockerAddress(l.address);
                              setLockerQuery('');
                              setLockerResults([]);
                            }}
                            className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-[#f4f4f4] transition border-b border-[#f4f4f4] last:border-0"
                          >
                            <div>
                              <span className="text-sm font-semibold text-[#111]">{l.name}</span>
                              <span className="block text-xs text-[#979797]">{l.address}</span>
                            </div>
                            <LocateFixed size={13} strokeWidth={2} className="text-[#BE1E2D] shrink-0 ml-2" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {addressError && <p className="text-red-500 text-sm">{addressError}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={saveAddress}
                  disabled={savingAddress || !editName.trim()}
                  className="flex items-center gap-2 px-5 py-2 bg-[#BE1E2D] hover:bg-[#9B1824] disabled:bg-[#dedede] text-white rounded-full text-sm font-semibold transition"
                >
                  <Check size={14} strokeWidth={2.5} />
                  {savingAddress ? 'Saving...' : 'Save address'}
                </button>
                <button
                  onClick={() => setEditingAddress(false)}
                  className="flex items-center gap-2 px-5 py-2 border border-[#dedede] text-[#979797] rounded-full text-sm transition hover:border-[#979797]"
                >
                  <X size={14} strokeWidth={2} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {(profile?.suburb_name || profile?.city_name || profile?.province) ? (
                <div className="flex items-center gap-2 text-sm text-[#555]">
                  <MapPin size={14} strokeWidth={2} className="text-[#BE1E2D] shrink-0" />
                  {[profile.suburb_name, profile.city_name, profile.province].filter(Boolean).join(', ')}
                </div>
              ) : (
                <p className="text-sm text-[#979797] italic">No location set</p>
              )}
              {profile?.street_address ? (
                <div className="flex items-center gap-2 text-sm text-[#555]">
                  <Home size={14} strokeWidth={2} className="text-[#BE1E2D] shrink-0" />
                  {profile.street_address}{profile.postal_code ? `, ${profile.postal_code}` : ''}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fffbeb] border border-[#fde68a] text-yellow-700 text-xs font-semibold">
                    <Home size={12} strokeWidth={2.5} /> No street address — door-to-door delivery unavailable
                  </span>
                </div>
              )}
              {/* PUDO locker preference (view) */}
              {profile?.preferred_locker_id ? (
                <div className="flex items-center gap-2 text-sm text-[#555]">
                  <LocateFixed size={14} strokeWidth={2} className="text-[#BE1E2D] shrink-0" />
                  <span>
                    <span className="font-semibold">{profile.preferred_locker_name}</span>
                    {profile.preferred_locker_address && (
                      <span className="text-[#979797]"> · {profile.preferred_locker_address}</span>
                    )}
                  </span>
                </div>
              ) : quickAddingLocker ? (
                <div className="mt-1 space-y-2">
                  <p className="text-xs text-[#979797]">
                    {profile?.suburb_name
                      ? `Showing lockers near ${profile.suburb_name} — type to refine`
                      : 'Search by locker name or area'}
                  </p>
                  <div className="relative">
                    <Search size={15} strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#979797]" />
                    <input
                      autoFocus
                      value={lockerQuery}
                      onChange={e => setLockerQuery(e.target.value)}
                      className="w-full bg-white border border-[#BE1E2D] rounded-xl pl-9 pr-4 py-2.5 text-[#111] text-sm focus:outline-none focus:ring-2 focus:ring-[#BE1E2D]/20 transition"
                      placeholder="e.g. Rivonia, Fourways, Sandton..."
                    />
                    {lockerQuery.length >= 2 && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-[#dedede] rounded-xl shadow-lg max-h-56 overflow-y-auto">
                        {searchingLockers ? (
                          <p className="text-[#979797] text-sm text-center py-3">Searching…</p>
                        ) : lockerResults.length === 0 ? (
                          <p className="text-[#979797] text-sm text-center py-3">No lockers found — try a different area</p>
                        ) : lockerResults.map(l => (
                          <button
                            type="button"
                            key={l.id}
                            disabled={savingQuickLocker}
                            onClick={() => quickSaveLocker(l)}
                            className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-[#fde8ea] transition border-b border-[#f4f4f4] last:border-0 disabled:opacity-50"
                          >
                            <div>
                              <span className="text-sm font-semibold text-[#111]">{l.name}</span>
                              <span className="block text-xs text-[#979797]">{l.address}</span>
                            </div>
                            <LocateFixed size={13} strokeWidth={2} className="text-[#BE1E2D] shrink-0 ml-2" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setQuickAddingLocker(false); setLockerQuery(''); setLockerResults([]); }}
                    className="text-xs text-[#979797] hover:text-[#111] transition"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={openQuickLockerPicker}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f4f4f4] border border-dashed border-[#c0c0c0] text-[#979797] text-xs hover:border-[#BE1E2D] hover:text-[#BE1E2D] hover:bg-[#fde8ea] transition cursor-pointer"
                  >
                    <LocateFixed size={11} strokeWidth={2} /> No preferred PUDO locker set — tap to add
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── My Schools card ──────────────────────────────────────────────────── */}
        {/* RULE: schools are independent of delivery location. A parent or student  */}
        {/* can follow schools in any province. The homepage shows items from all    */}
        {/* followed schools, sorted by newest.                                      */}
        <div className="bg-[#f4f4f4] rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-[#111]">My Schools</h2>
              <p className="text-xs text-[#979797] mt-0.5">Items from these schools appear first on your home feed.</p>
            </div>
            {!editingSchools && (
              <button
                onClick={startEditSchools}
                className="flex items-center gap-1.5 px-4 py-2 border border-[#dedede] hover:border-[#BE1E2D] text-[#111] hover:text-[#BE1E2D] rounded-full text-sm transition"
              >
                <Pencil size={13} strokeWidth={2} /> Edit
              </button>
            )}
          </div>

          {editingSchools ? (
            <div className="space-y-4">
              {/* Selected school chips */}
              {editSchools.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {editSchools.map(s => (
                    <span key={s.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#fde8ea] border border-[#c7d2fe] text-[#BE1E2D] text-xs font-semibold rounded-full">
                      <School size={11} strokeWidth={2.5} />
                      {s.name}
                      {s.province_code && <span className="font-normal text-[#7c8fd4]">· {s.province_code}</span>}
                      <button type="button" onClick={() => toggleSchool(s)} className="hover:text-red-500 transition ml-0.5">
                        <X size={11} strokeWidth={2.5} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* National school search */}
              <div>
                <label className="block text-xs font-semibold text-[#979797] uppercase tracking-wide mb-1.5">
                  Search any school in South Africa
                </label>
                <div className="relative">
                  <Search size={15} strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#979797]" />
                  <input
                    value={schoolQuery}
                    onChange={e => setSchoolQuery(e.target.value)}
                    className="w-full bg-white border border-[#dedede] rounded-xl pl-9 pr-4 py-2.5 text-[#111] text-sm focus:outline-none focus:border-[#BE1E2D] transition"
                    placeholder="e.g. Grey College, Hoërskool Eldoraigne..."
                  />
                  {schoolQuery.length >= 2 && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-[#dedede] rounded-xl shadow-lg max-h-56 overflow-y-auto">
                      {searchingSchools ? (
                        <p className="text-[#979797] text-sm text-center py-3">Searching...</p>
                      ) : schoolResults.filter(r => !editSchools.some(es => es.id === r.id)).length === 0 ? (
                        <p className="text-[#979797] text-sm text-center py-3">No schools found for &ldquo;{schoolQuery}&rdquo;</p>
                      ) : schoolResults.filter(r => !editSchools.some(es => es.id === r.id)).map(r => (
                        <button
                          type="button"
                          key={r.id}
                          onClick={() => toggleSchool(r)}
                          className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-[#f4f4f4] transition border-b border-[#f4f4f4] last:border-0"
                        >
                          <div>
                            <span className="text-sm font-semibold text-[#111]">{r.name}</span>
                            <span className="block text-xs text-[#979797]">{r.city_name}{r.province_code ? ` · ${r.province_code}` : ''}</span>
                          </div>
                          <Check size={13} strokeWidth={2.5} className="text-[#BE1E2D] shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {editSchools.length === 0 && (
                <p className="text-xs text-[#979797]">No schools added yet — search above to add one.</p>
              )}

              {schoolsError && <p className="text-red-500 text-sm">{schoolsError}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={saveSchools}
                  disabled={savingSchools}
                  className="flex items-center gap-2 px-5 py-2 bg-[#BE1E2D] hover:bg-[#9B1824] disabled:bg-[#dedede] text-white rounded-full text-sm font-semibold transition"
                >
                  <Check size={14} strokeWidth={2.5} />
                  {savingSchools ? 'Saving...' : 'Save schools'}
                </button>
                <button
                  onClick={() => setEditingSchools(false)}
                  className="flex items-center gap-2 px-5 py-2 border border-[#dedede] text-[#979797] rounded-full text-sm transition hover:border-[#979797]"
                >
                  <X size={14} strokeWidth={2} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              {schools.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {schools.map(s => (
                    <span key={s.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#dedede] text-[#111] text-sm rounded-full">
                      <School size={13} strokeWidth={2} className="text-[#BE1E2D]" />
                      {s.name}
                      {s.province_code && <span className="text-xs text-[#979797]">· {s.province_code}</span>}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#979797] italic">No schools added — tap Edit to add your school(s).</p>
              )}
            </div>
          )}
        </div>

        {/* ── Stats row ────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#f4f4f4] rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-[#BE1E2D]">{activeListings.length}</p>
            <p className="text-xs text-[#979797] mt-1 flex items-center justify-center gap-1"><Tag size={12} strokeWidth={2} /> Live listings</p>
          </div>
          <div className="bg-[#f4f4f4] rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-[#BE1E2D]">{soldListings.length}</p>
            <p className="text-xs text-[#979797] mt-1 flex items-center justify-center gap-1"><ShoppingBag size={12} strokeWidth={2} /> Items sold</p>
          </div>
          <div className="bg-[#f4f4f4] rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-[#BE1E2D]">
              R{(soldListings.reduce((s, i) => s + i.price_cents, 0) / 100).toLocaleString()}
            </p>
            <p className="text-xs text-[#979797] mt-1 flex items-center justify-center gap-1"><Clock size={12} strokeWidth={2} /> Total earned</p>
          </div>
        </div>

        {/* ── Listings tabs ─────────────────────────────────────────────────────── */}
        <div>
          <div className="flex border-b border-[#dedede] mb-6">
            {(['active', 'sold'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative px-5 py-3 text-sm font-medium transition ${tab === t ? 'text-[#111]' : 'text-[#979797] hover:text-[#111]'}`}
              >
                {t === 'active' ? `Live listings (${activeListings.length})` : `Sold (${soldListings.length})`}
                {tab === t && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#BE1E2D] rounded-full" />}
              </button>
            ))}
          </div>

          {displayListings.length === 0 ? (
            <div className="text-center py-16">
              <Package size={48} strokeWidth={1.5} className="text-[#dedede] mx-auto mb-4" />
              <p className="text-[#111] font-semibold">
                {tab === 'active' ? 'No active listings' : 'Nothing sold yet'}
              </p>
              <p className="text-[#979797] text-sm mt-1">
                {tab === 'active' ? 'Head to Sell to create your first listing.' : 'Your sold items will appear here.'}
              </p>
              {tab === 'active' && (
                <button
                  onClick={() => router.push('/sell/new')}
                  className="mt-4 px-6 py-2 bg-[#BE1E2D] text-white rounded-full text-sm font-semibold hover:bg-[#9B1824] transition"
                >
                  + Create listing
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {displayListings.map(item => (
                <ListingCard key={item.id} item={item} onClick={() => router.push(`/item/${item.id}`)} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}