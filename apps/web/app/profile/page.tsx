'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import {
  MapPin, School, CheckCircle2, AlertTriangle, Package,
  Tag, Clock, ShoppingBag, Pencil, X, Check, Plus,
} from 'lucide-react';
import Image from 'next/image';
import { SA_PROVINCES } from '@nextkid/shared';
import type { School as SchoolType } from '@nextkid/shared';

type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_age_verified: boolean;
  province: string | null;
  school_ids: string[] | null;
};

type SchoolRow = { id: string; name: string; city: string };

type Item = {
  id: string;
  title: string;
  price: number;
  images: string[];
  status: string;
  category: string;
  created_at: string;
};

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f0fdf4] border border-[#bbf7d0] text-green-700 text-xs font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
        Live
      </span>
    );
  }
  if (status === 'sold') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f0f4ff] border border-[#c7d2fe] text-[#4757bf] text-xs font-semibold">
        <CheckCircle2 size={11} strokeWidth={2.5} />
        Sold
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f4f4f4] border border-[#dedede] text-[#979797] text-xs font-semibold capitalize">
      {status}
    </span>
  );
}

function ListingCard({ item, onClick }: { item: Item; onClick: () => void }) {
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
        <p className="text-[#4757bf] font-bold text-base mt-1">R{(item.price / 100).toLocaleString()}</p>
      </div>
    </button>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [activeListings, setActiveListings] = useState<Item[]>([]);
  const [soldListings, setSoldListings] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'active' | 'sold'>('active');

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editProvince, setEditProvince] = useState('');
  const [editSchoolIds, setEditSchoolIds] = useState<string[]>([]);
  const [editSchools, setEditSchools] = useState<SchoolRow[]>([]); // currently selected school objects
  const [schoolSearch, setSchoolSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SchoolType[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/'); return; }

    const [{ data: prof }, { data: items }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('items')
        .select('id, title, price, images, status, category, created_at')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false }),
    ]);

    if (!prof) { router.push('/onboarding'); return; }
    setProfile(prof);

    if (prof.school_ids?.length) {
      const { data: schoolData } = await supabase
        .from('schools').select('id, name, city').in('id', prof.school_ids);
      setSchools(schoolData ?? []);
    }

    const all = items ?? [];
    setActiveListings(all.filter(i => i.status === 'active'));
    setSoldListings(all.filter(i => i.status === 'sold'));
    setLoading(false);
  }

  // Load schools when province changes in edit mode
  useEffect(() => {
    if (!editProvince) { setSearchResults([]); return; }
    setLoadingSchools(true);
    supabase.from('schools').select('*').eq('province', editProvince).order('name')
      .then(({ data }) => { setSearchResults((data as SchoolType[]) ?? []); setLoadingSchools(false); });
  }, [editProvince]);

  function startEdit() {
    if (!profile) return;
    setEditName(profile.full_name);
    setEditProvince(profile.province ?? '');
    setEditSchoolIds(profile.school_ids ?? []);
    setEditSchools(schools);
    setSchoolSearch('');
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setSchoolSearch('');
  }

  function toggleSchool(school: SchoolType) {
    const already = editSchoolIds.includes(school.id);
    if (already) {
      setEditSchoolIds(prev => prev.filter(id => id !== school.id));
      setEditSchools(prev => prev.filter(s => s.id !== school.id));
    } else {
      setEditSchoolIds(prev => [...prev, school.id]);
      setEditSchools(prev => [...prev, { id: school.id, name: school.name, city: school.city }]);
    }
  }

  async function saveEdit() {
    if (!profile || !editName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      full_name: editName.trim(),
      province: editProvince || null,
      school_ids: editSchoolIds,
    }).eq('id', profile.id);

    if (error) {
      alert('Error saving profile: ' + error.message);
    } else {
      setProfile(prev => prev ? { ...prev, full_name: editName.trim(), province: editProvince || null, school_ids: editSchoolIds } : prev);
      setSchools(editSchools);
      setEditing(false);
    }
    setSaving(false);
  }

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading) {
    return <div className="min-h-screen bg-white flex items-center justify-center text-[#979797]">Loading...</div>;
  }

  const initials = profile?.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? '?';
  const displayListings = tab === 'active' ? activeListings : soldListings;
  const filteredResults = searchResults.filter(s =>
    s.name.toLowerCase().includes(schoolSearch.toLowerCase()) && !editSchoolIds.includes(s.id)
  );

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-10">

        {/* Profile card */}
        <div className="bg-[#f4f4f4] rounded-3xl p-6 mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-[#4757bf] flex items-center justify-center shrink-0">
              <span className="text-white text-2xl font-bold">{initials}</span>
            </div>

            {/* Info or edit form */}
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
                      onChange={e => { setEditProvince(e.target.value); setSchoolSearch(''); }}
                      className="w-full bg-white border border-[#dedede] rounded-xl px-4 py-2.5 text-[#111] text-sm focus:outline-none focus:border-[#4757bf] transition"
                    >
                      <option value="">Select province...</option>
                      {SA_PROVINCES.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>

                  {/* Schools */}
                  {editProvince && (
                    <div>
                      <label className="block text-xs font-semibold text-[#979797] uppercase tracking-wide mb-1.5">Schools</label>

                      {/* Selected schools */}
                      {editSchools.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {editSchools.map(s => (
                            <span key={s.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#eef0fb] border border-[#c7d2fe] text-[#4757bf] text-xs font-semibold rounded-full">
                              {s.name}
                              <button onClick={() => toggleSchool(s as unknown as SchoolType)} className="hover:text-red-500 transition">
                                <X size={11} strokeWidth={2.5} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Search */}
                      <div className="relative">
                        <input
                          value={schoolSearch}
                          onChange={e => setSchoolSearch(e.target.value)}
                          className="w-full bg-white border border-[#dedede] rounded-xl px-4 py-2.5 text-[#111] text-sm focus:outline-none focus:border-[#4757bf] transition"
                          placeholder="Search school to add..."
                        />
                        {schoolSearch && (
                          <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-[#dedede] rounded-xl shadow-lg max-h-48 overflow-y-auto">
                            {loadingSchools ? (
                              <p className="text-[#979797] text-sm text-center py-3">Loading...</p>
                            ) : filteredResults.length === 0 ? (
                              <p className="text-[#979797] text-sm text-center py-3">No schools found</p>
                            ) : filteredResults.map(s => (
                              <button
                                key={s.id}
                                onClick={() => { toggleSchool(s); setSchoolSearch(''); }}
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-[#f4f4f4] transition border-b border-[#f4f4f4] last:border-0"
                              >
                                <Plus size={13} strokeWidth={2.5} className="text-[#4757bf] shrink-0" />
                                <span className="text-sm text-[#111]">{s.name}</span>
                                <span className="text-xs text-[#979797] ml-auto">{s.city}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <h1 className="text-2xl font-bold text-[#111]">{profile?.full_name}</h1>
                  <p className="text-[#979797] text-sm mt-0.5">{profile?.email}</p>
                  <div className="flex flex-wrap gap-3 mt-3">
                    {profile?.province && (
                      <span className="inline-flex items-center gap-1.5 text-sm text-[#555]">
                        <MapPin size={14} strokeWidth={2} className="text-[#4757bf]" />
                        {profile.province}
                      </span>
                    )}
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
                    <X size={14} strokeWidth={2} />
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={startEdit}
                    className="flex items-center gap-2 px-5 py-2 border border-[#dedede] hover:border-[#4757bf] text-[#111] hover:text-[#4757bf] rounded-full text-sm transition"
                  >
                    <Pencil size={14} strokeWidth={2} />
                    Edit profile
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
              R{(soldListings.reduce((s, i) => s + i.price, 0) / 100).toLocaleString()}
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
