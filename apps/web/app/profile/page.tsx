'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import {
  MapPin, School, CheckCircle2, AlertTriangle, Package,
  Tag, Clock, ShoppingBag, Pencil, X, Check, Home,
} from 'lucide-react';
import Image from 'next/image';
import { SA_PROVINCES } from '@nextkid/shared';

// ── Types ─────────────────────────────────────────────────────────────────────

type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_age_verified: boolean;
  province: string | null;
  city_id: string | null;
  city_name: string | null;
  suburb_id: string | null;
  suburb_name: string | null;
  street_address: string | null;
  postal_code: string | null;
  school_ids: string[] | null;
  school_id: string | null;
  school_name: string | null;
};

type SchoolRow = { id: string; name: string; city_name: string };
type GlobalSchoolResult = { id: string; name: string; city_name: string; province_code: string };

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
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f0f4ff] border border-[#c7d2fe] text-[#4757bf] text-xs font-semibold">
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
        <p className="text-[#4757bf] font-bold text-base mt-1">R{(item.price_cents / 100).toLocaleString()}</p>
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

  // ── Edit state ───────────────────────────────────────────────────────────────
  const [editing, setEditing]               = useState(false);
  const [editName, setEditName]             = useState('');
  const [editStreet, setEditStreet]         = useState('');

  // Location cascade
  const [editProvince, setEditProvince]     = useState('');
  const [cities, setCities]                 = useState<CityOption[]>([]);
  const [editCityId, setEditCityId]         = useState('');
  const [editCityName, setEditCityName]     = useState('');
  const [suburbs, setSuburbs]               = useState<SuburbOption[]>([]);
  const [editSuburbId, setEditSuburbId]     = useState('');
  const [editSuburbName, setEditSuburbName] = useState('');
  const [editPostalCode, setEditPostalCode] = useState('');
  const [loadingCities, setLoadingCities]   = useState(false);
  const [loadingSuburbs, setLoadingSuburbs] = useState(false);

  // School multi-select
  const [editSchoolIds, setEditSchoolIds]       = useState<string[]>([]);
  const [editSchools, setEditSchools]           = useState<SchoolRow[]>([]);
  const [schoolSearch, setSchoolSearch]         = useState('');
  const [suburbSchools, setSuburbSchools]       = useState<SchoolRow[]>([]);
  const [loadingSchools, setLoadingSchools]     = useState(false);
  // Global school search (for schools outside current suburb/province)
  const [globalQuery, setGlobalQuery]           = useState('');
  const [globalResults, setGlobalResults]       = useState<GlobalSchoolResult[]>([]);
  const [searchingGlobal, setSearchingGlobal]   = useState(false);

  const [saving, setSaving]                 = useState(false);
  const [saveError, setSaveError]           = useState('');

  // Suppress cascade resets when location is pre-filled from profile
  const skipProvinceRef = useRef('');
  const skipCityRef     = useRef('');

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
        .from('schools').select('id, name, city_name').in('id', prof.school_ids);
      setSchools(schoolData ?? []);
    }

    const all = items ?? [];
    setActiveListings(all.filter(i => i.status === 'ACTIVE'));
    setSoldListings(all.filter(i => i.status === 'SOLD'));
    setLoading(false);
  }

  // ── Cascade: province → cities ───────────────────────────────────────────────
  useEffect(() => {
    if (!editProvince) { setCities([]); setEditCityId(''); setEditCityName(''); return; }
    if (skipProvinceRef.current === editProvince) { skipProvinceRef.current = ''; return; }
    setLoadingCities(true);
    fetch(`/api/locations/cities?province=${encodeURIComponent(editProvince)}`)
      .then(r => r.json())
      .then(data => { setCities(Array.isArray(data) ? data : []); setLoadingCities(false); });
    setEditCityId(''); setEditCityName(''); setSuburbs([]); setEditSuburbId(''); setEditSuburbName('');
  }, [editProvince]);

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

  // ── Schools: reload when suburb changes ──────────────────────────────────────
  useEffect(() => {
    if (!editSuburbId) { setSuburbSchools([]); return; }
    setLoadingSchools(true);
    fetch(`/api/locations/schools?suburbId=${encodeURIComponent(editSuburbId)}`)
      .then(r => r.json())
      .then(data => { setSuburbSchools(Array.isArray(data) ? data : []); setLoadingSchools(false); })
      .catch(() => { setSuburbSchools([]); setLoadingSchools(false); });
  }, [editSuburbId]);

  // ── Global school search (debounced, cross-province) ─────────────────────────
  useEffect(() => {
    if (!globalQuery || globalQuery.length < 2) { setGlobalResults([]); return; }
    const timer = setTimeout(async () => {
      setSearchingGlobal(true);
      const { data } = await supabase
        .from('schools')
        .select('id, name, city_name, province_code')
        .ilike('name', `%${globalQuery}%`)
        .limit(10);
      setGlobalResults((data ?? []) as GlobalSchoolResult[]);
      setSearchingGlobal(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [globalQuery]);

  // ── Start editing ─────────────────────────────────────────────────────────────
  async function startEdit() {
    if (!profile) return;
    setEditName(profile.full_name ?? '');
    setEditStreet(profile.street_address ?? '');
    setEditPostalCode(profile.postal_code ?? '');
    // Use DB-verified schools as source of truth (not profile.school_ids which may have stale IDs)
    setEditSchools(schools);
    setEditSchoolIds(schools.map(s => s.id));
    setSchoolSearch('');
    setGlobalQuery('');
    setSaveError('');

    // Pre-fill location cascade — use skip refs to avoid cascade resets
    if (profile.province && profile.city_id && profile.suburb_id) {
      const [citiesRes, suburbsRes] = await Promise.all([
        fetch(`/api/locations/cities?province=${encodeURIComponent(profile.province)}`).then(r => r.json()),
        fetch(`/api/locations/suburbs?cityId=${encodeURIComponent(profile.city_id)}`).then(r => r.json()),
      ]);
      skipProvinceRef.current = profile.province;
      skipCityRef.current = profile.city_id;
      setCities(Array.isArray(citiesRes) ? citiesRes : []);
      setSuburbs(Array.isArray(suburbsRes) ? suburbsRes : []);
    }

    setEditProvince(profile.province ?? '');
    setEditCityId(profile.city_id ?? '');
    setEditCityName(profile.city_name ?? '');
    setEditSuburbId(profile.suburb_id ?? '');
    setEditSuburbName(profile.suburb_name ?? '');
    setEditing(true);
  }

  function cancelEdit() { setEditing(false); setSaveError(''); }

  function toggleSchool(school: SchoolRow) {
    const already = editSchoolIds.includes(school.id);
    if (already) {
      setEditSchoolIds(prev => prev.filter(id => id !== school.id));
      setEditSchools(prev => prev.filter(s => s.id !== school.id));
    } else {
      setEditSchoolIds(prev => [...prev, school.id]);
      setEditSchools(prev => [...prev, school]);
    }
    setGlobalQuery('');
    setGlobalResults([]);
  }

  async function saveEdit() {
    if (!profile || !editName.trim()) return;
    setSaving(true);
    setSaveError('');

    const { error } = await supabase.from('profiles').update({
      full_name:    editName.trim(),
      province:     editProvince || null,
      city_id:      editCityId   || null,
      city_name:    editCityName || null,
      suburb_id:    editSuburbId   || null,
      suburb_name:  editSuburbName || null,
      street_address: editStreet.trim() || null,
      postal_code:  editPostalCode.trim() || null,
      // RULE: derive school_ids from editSchools (DB-verified) to avoid FK violations
      school_ids:   editSchools.map(s => s.id),
      school_id:    editSchools[0]?.id ?? null,
      school_name:  editSchools[0]?.name ?? null,
    }).eq('id', profile.id);

    if (error) {
      setSaveError('Error saving profile: ' + error.message);
    } else {
      setProfile(prev => prev ? {
        ...prev,
        full_name:     editName.trim(),
        province:      editProvince || null,
        city_id:       editCityId   || null,
        city_name:     editCityName || null,
        suburb_id:     editSuburbId   || null,
        suburb_name:   editSuburbName || null,
        street_address: editStreet.trim() || null,
        postal_code:   editPostalCode.trim() || null,
        school_ids:    editSchools.map(s => s.id),
        school_id:     editSchools[0]?.id ?? null,
        school_name:   editSchools[0]?.name ?? null,
      } : prev);
      setSchools(editSchools);
      setEditing(false);
    }
    setSaving(false);
  }

  const signOut = async () => { await supabase.auth.signOut(); router.push('/'); };

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center text-[#979797]">Loading...</div>
  );

  const initials = profile?.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? '?';
  const displayListings = tab === 'active' ? activeListings : soldListings;
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-10">

        {/* Profile card */}
        <div className="bg-[#f4f4f4] rounded-3xl p-6 mb-8">
          <div className="flex flex-col sm:flex-row items-start gap-6">

            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-[#4757bf] flex items-center justify-center shrink-0">
              <span className="text-white text-2xl font-bold">{initials}</span>
            </div>

            {/* View or edit */}
            <div className="flex-1 min-w-0">
              {editing ? (

                <div className="space-y-4">
                  {/* Name */}
                  <div>
                    <label className="block text-xs font-semibold text-[#979797] uppercase tracking-wide mb-1.5">Full name</label>
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="w-full bg-white border border-[#dedede] rounded-xl px-4 py-2.5 text-[#111] text-sm focus:outline-none focus:border-[#4757bf] transition"
                      placeholder="Your full name"
                    />
                  </div>

                  {/* Province */}
                  <div>
                    <label className="block text-xs font-semibold text-[#979797] uppercase tracking-wide mb-1.5">Province</label>
                    <select
                      value={editProvince}
                      onChange={e => setEditProvince(e.target.value)}
                      className="w-full bg-white border border-[#dedede] rounded-xl px-4 py-2.5 text-[#111] text-sm focus:outline-none focus:border-[#4757bf] transition"
                    >
                      <option value="">Select province...</option>
                      {SA_PROVINCES.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>

                  {/* City */}
                  {editProvince && (
                    <div>
                      <label className="block text-xs font-semibold text-[#979797] uppercase tracking-wide mb-1.5">City</label>
                      <select
                        value={editCityId}
                        onChange={e => {
                          const opt = cities.find(c => c.id === e.target.value);
                          setEditCityId(e.target.value);
                          setEditCityName(opt?.name ?? '');
                        }}
                        disabled={loadingCities}
                        className="w-full bg-white border border-[#dedede] rounded-xl px-4 py-2.5 text-[#111] text-sm focus:outline-none focus:border-[#4757bf] transition disabled:opacity-50"
                      >
                        <option value="">{loadingCities ? 'Loading...' : 'Select city...'}</option>
                        {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  )}

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
                        className="w-full bg-white border border-[#dedede] rounded-xl px-4 py-2.5 text-[#111] text-sm focus:outline-none focus:border-[#4757bf] transition disabled:opacity-50"
                      >
                        <option value="">{loadingSuburbs ? 'Loading...' : 'Select suburb...'}</option>
                        {suburbs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Street address */}
                  <div>
                    <label className="block text-xs font-semibold text-[#979797] uppercase tracking-wide mb-1.5">
                      Street address <span className="text-[#dedede] font-normal normal-case">(for door-to-door delivery)</span>
                    </label>
                    <input
                      value={editStreet}
                      onChange={e => setEditStreet(e.target.value)}
                      className="w-full bg-white border border-[#dedede] rounded-xl px-4 py-2.5 text-[#111] text-sm focus:outline-none focus:border-[#4757bf] transition"
                      placeholder="e.g. 12 Main Street, Apt 4"
                    />
                  </div>

                  {/* Postal code */}
                  <div>
                    <label className="block text-xs font-semibold text-[#979797] uppercase tracking-wide mb-1.5">Postal code</label>
                    <input
                      value={editPostalCode}
                      onChange={e => setEditPostalCode(e.target.value)}
                      className="w-full bg-white border border-[#dedede] rounded-xl px-4 py-2.5 text-[#111] text-sm focus:outline-none focus:border-[#4757bf] transition"
                      placeholder="e.g. 2196"
                      inputMode="numeric"
                    />
                  </div>

                  {/* Schools (multi-select, loaded by suburb) */}
                  {editSuburbId && (
                    <div>
                      <label className="block text-xs font-semibold text-[#979797] uppercase tracking-wide mb-1.5">
                        Schools <span className="text-[#dedede] font-normal normal-case">(optional — select all that apply)</span>
                      </label>

                      {/* Selected school chips */}
                      {editSchools.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {editSchools.map(s => (
                            <span key={s.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eef0fb] border border-[#c7d2fe] text-[#4757bf] text-xs font-semibold rounded-full">
                              {s.name}
                              <button onClick={() => toggleSchool(s)} className="hover:text-red-500 transition">
                                <X size={11} strokeWidth={2.5} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Search filter */}
                      <input
                        value={schoolSearch}
                        onChange={e => setSchoolSearch(e.target.value)}
                        className="w-full bg-white border border-[#dedede] rounded-xl px-4 py-2.5 text-[#111] text-sm focus:outline-none focus:border-[#4757bf] transition mb-2"
                        placeholder="Search school name..."
                        disabled={loadingSchools}
                      />

                      {/* Scrollable school list */}
                      <div className="border border-[#dedede] rounded-xl overflow-hidden max-h-44 overflow-y-auto bg-white">
                        {loadingSchools ? (
                          <p className="text-[#979797] text-sm text-center py-3">Loading...</p>
                        ) : suburbSchools.filter(s =>
                            s.name.toLowerCase().includes(schoolSearch.toLowerCase())
                          ).length === 0 ? (
                          <p className="text-[#979797] text-sm text-center py-3">
                            {suburbSchools.length === 0 ? 'No schools in this suburb yet.' : 'No match — try a different search.'}
                          </p>
                        ) : suburbSchools.filter(s =>
                            s.name.toLowerCase().includes(schoolSearch.toLowerCase())
                          ).map(s => {
                            const selected = editSchoolIds.includes(s.id);
                            return (
                              <button
                                key={s.id}
                                onClick={() => toggleSchool(s)}
                                className={`w-full flex items-center justify-between px-4 py-2.5 text-left border-b border-[#f4f4f4] last:border-0 transition ${selected ? 'bg-[#eef0fb]' : 'hover:bg-[#f4f4f4]'}`}
                              >
                                <div>
                                  <span className={`text-sm font-semibold ${selected ? 'text-[#4757bf]' : 'text-[#111]'}`}>{s.name}</span>
                                  <span className="block text-xs text-[#979797]">{s.city_name}</span>
                                </div>
                                {selected && <Check size={14} strokeWidth={2.5} className="text-[#4757bf] shrink-0" />}
                              </button>
                            );
                          })
                        }
                      </div>

                      {/* Global school search — for schools outside current suburb */}
                      <div className="mt-3">
                        <p className="text-xs text-[#979797] mb-1.5">School not listed? Search across all areas:</p>
                        <div className="relative">
                          <input
                            value={globalQuery}
                            onChange={e => setGlobalQuery(e.target.value)}
                            className="w-full bg-white border border-[#dedede] rounded-xl px-4 py-2.5 text-[#111] text-sm focus:outline-none focus:border-[#4757bf] transition"
                            placeholder="e.g. Rondebosch Boys, St John's..."
                          />
                          {globalQuery.length >= 2 && (
                            <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-[#dedede] rounded-xl shadow-lg max-h-48 overflow-y-auto">
                              {searchingGlobal ? (
                                <p className="text-[#979797] text-sm text-center py-3">Searching...</p>
                              ) : globalResults.filter(r => !editSchoolIds.includes(r.id)).length === 0 ? (
                                <p className="text-[#979797] text-sm text-center py-3">No schools found</p>
                              ) : globalResults.filter(r => !editSchoolIds.includes(r.id)).map(r => (
                                <button
                                  key={r.id}
                                  onClick={() => toggleSchool(r)}
                                  className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-[#f4f4f4] transition border-b border-[#f4f4f4] last:border-0"
                                >
                                  <div>
                                    <span className="text-sm font-semibold text-[#111]">{r.name}</span>
                                    <span className="block text-xs text-[#979797]">{r.city_name} · {r.province_code}</span>
                                  </div>
                                  <Check size={13} strokeWidth={2.5} className="text-[#4757bf] shrink-0 opacity-0" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {saveError && <p className="text-red-500 text-sm">{saveError}</p>}
                </div>

              ) : (
                <>
                  <h1 className="text-2xl font-bold text-[#111]">{profile?.full_name}</h1>
                  <p className="text-[#979797] text-sm mt-0.5">{profile?.email}</p>

                  <div className="flex flex-wrap gap-3 mt-3">
                    {/* Location breadcrumb */}
                    {(profile?.suburb_name || profile?.city_name || profile?.province) && (
                      <span className="inline-flex items-center gap-1.5 text-sm text-[#555]">
                        <MapPin size={14} strokeWidth={2} className="text-[#4757bf]" />
                        {[profile.suburb_name, profile.city_name, profile.province].filter(Boolean).join(', ')}
                      </span>
                    )}

                    {/* Street address */}
                    {profile?.street_address && (
                      <span className="inline-flex items-center gap-1.5 text-sm text-[#555]">
                        <Home size={14} strokeWidth={2} className="text-[#4757bf]" />
                        {profile.street_address}{profile.postal_code ? `, ${profile.postal_code}` : ''}
                      </span>
                    )}

                    {/* Schools */}
                    {schools.map(s => (
                      <span key={s.id} className="inline-flex items-center gap-1.5 text-sm text-[#555]">
                        <School size={14} strokeWidth={2} className="text-[#4757bf]" />
                        {s.name}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3">
                    {profile?.is_age_verified ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f0fdf4] border border-[#bbf7d0] text-green-700 text-xs font-semibold">
                        <CheckCircle2 size={12} strokeWidth={2.5} /> Verified 18+
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fffbeb] border border-[#fde68a] text-yellow-700 text-xs font-semibold">
                        <AlertTriangle size={12} strokeWidth={2.5} /> Browse only
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#f0f4ff] border border-[#c7d2fe] text-[#4757bf] text-xs font-semibold capitalize">
                      {profile?.role?.replace('_', ' ')}
                    </span>
                    {!profile?.street_address && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fffbeb] border border-[#fde68a] text-yellow-700 text-xs font-semibold">
                        <Home size={12} strokeWidth={2.5} /> No delivery address
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2 shrink-0">
              {editing ? (
                <>
                  <button
                    onClick={saveEdit}
                    disabled={saving || !editName.trim()}
                    className="flex items-center gap-2 px-5 py-2 bg-[#4757bf] hover:bg-[#3a48a8] disabled:bg-[#dedede] text-white rounded-full text-sm font-semibold transition"
                  >
                    <Check size={14} strokeWidth={2.5} />
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="flex items-center gap-2 px-5 py-2 border border-[#dedede] text-[#979797] rounded-full text-sm transition hover:border-[#979797]"
                  >
                    <X size={14} strokeWidth={2} /> Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={startEdit}
                    className="flex items-center gap-2 px-5 py-2 border border-[#dedede] hover:border-[#4757bf] text-[#111] hover:text-[#4757bf] rounded-full text-sm transition"
                  >
                    <Pencil size={14} strokeWidth={2} /> Edit profile
                  </button>
                  <button
                    onClick={signOut}
                    className="px-5 py-2 border border-[#dedede] rounded-full text-sm text-[#979797] hover:border-red-300 hover:text-red-400 transition"
                  >
                    Sign out
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-[#f4f4f4] rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-[#4757bf]">{activeListings.length}</p>
            <p className="text-xs text-[#979797] mt-1 flex items-center justify-center gap-1"><Tag size={12} strokeWidth={2} /> Live listings</p>
          </div>
          <div className="bg-[#f4f4f4] rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-[#4757bf]">{soldListings.length}</p>
            <p className="text-xs text-[#979797] mt-1 flex items-center justify-center gap-1"><ShoppingBag size={12} strokeWidth={2} /> Items sold</p>
          </div>
          <div className="bg-[#f4f4f4] rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-[#4757bf]">
              R{(soldListings.reduce((s, i) => s + i.price_cents, 0) / 100).toLocaleString()}
            </p>
            <p className="text-xs text-[#979797] mt-1 flex items-center justify-center gap-1"><Clock size={12} strokeWidth={2} /> Total earned</p>
          </div>
        </div>

        {/* Listings tabs */}
        <div className="flex border-b border-[#dedede] mb-6">
          {(['active', 'sold'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative px-5 py-3 text-sm font-medium transition ${tab === t ? 'text-[#111]' : 'text-[#979797] hover:text-[#111]'}`}
            >
              {t === 'active' ? `Live listings (${activeListings.length})` : `Sold (${soldListings.length})`}
              {tab === t && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4757bf] rounded-full" />}
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
                className="mt-4 px-6 py-2 bg-[#4757bf] text-white rounded-full text-sm font-semibold hover:bg-[#3a48a8] transition"
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
  );
}
