'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { ALL_CATEGORIES, PLATFORM_DEFAULTS } from '@nextkid/shared';
import type { ListingCategory, School } from '@nextkid/shared';

type Item = {
  id: string;
  title: string;
  category: string;
  price: number;
  images: string[];
  school_id: string | null;
  is_school_specific: boolean;
  size: string | null;
};

type BrowseTab = 'my_school' | 'all';

export default function BrowsePage() {
  const router = useRouter();
  const [tab, setTab] = useState<BrowseTab>('all');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<ListingCategory | 'All'>('All');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [userSchools, setUserSchools] = useState<School[]>([]);

  // RULE: debounce search input at 300ms to keep results fast
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), PLATFORM_DEFAULTS.SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  // Load the user's saved schools for the "My School" tab
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('school_ids').eq('id', user.id).single();
      if (profile?.school_ids?.length) {
        const { data: schools } = await supabase.from('schools').select('*').in('id', profile.school_ids);
        setUserSchools((schools as School[]) ?? []);
      }
    });
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('items')
      .select('id, title, category, price, images, school_id, is_school_specific, size')
      .order('created_at', { ascending: false });

    if (category !== 'All') query = query.eq('category', category);
    if (debouncedSearch) query = query.ilike('title', `%${debouncedSearch}%`);

    if (tab === 'my_school') {
      // No school saved — return nothing (user needs to add a school first)
      if (userSchools.length === 0) { setItems([]); setLoading(false); return; }
      // Show items linked to the user's schools
      query = query.in('school_id', userSchools.map(s => s.id));
    } else {
      // All Items tab — show only nationwide/generic items
      query = query.or('is_school_specific.eq.false,is_school_specific.is.null');
    }

    const { data, error } = await query;
    if (error) console.error('Browse error:', error);
    setItems(data ?? []);
    setLoading(false);
  }, [category, debouncedSearch, tab, userSchools]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const hasSchools = userSchools.length > 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="text-4xl font-bold text-white mb-1">Browse Listings</h1>
        <p className="text-gray-400 mb-6">Discover second-hand school items across South Africa</p>

        {/* Tab switcher */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab('my_school')}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition ${tab === 'my_school' ? 'bg-violet-600 text-white' : 'bg-[#111] text-gray-400 border border-[#222] hover:bg-[#1a1a1a]'}`}
          >
            🏫 My School{hasSchools ? ` (${userSchools.map(s => s.name.split(' ')[0]).join(', ')})` : ''}
          </button>
          <button
            onClick={() => setTab('all')}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition ${tab === 'all' ? 'bg-violet-600 text-white' : 'bg-[#111] text-gray-400 border border-[#222] hover:bg-[#1a1a1a]'}`}
          >
            🌍 All Items
          </button>
        </div>

        {tab === 'my_school' && !hasSchools && (
          <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-5 mb-6 flex items-center justify-between">
            <p className="text-gray-400 text-sm">You haven&apos;t added a school yet. Add one to see uniform and sports kit listings.</p>
            <button onClick={() => router.push('/dashboard')} className="ml-4 px-4 py-2 bg-violet-600 text-white text-sm rounded-lg shrink-0">Add School</button>
          </div>
        )}

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search listings..."
          className="w-full bg-[#111] border border-[#222] text-white placeholder-gray-600 rounded-xl px-4 py-3 mb-6 focus:outline-none focus:border-violet-500"
        />

        {/* Category pills */}
        <div className="flex flex-wrap gap-2 mb-8">
          {(['All', ...ALL_CATEGORIES] as Array<ListingCategory | 'All'>).map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${category === cat ? 'bg-violet-600 text-white' : 'bg-[#111] text-gray-400 border border-[#222] hover:bg-[#1a1a1a]'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Results */}
        {loading ? (
          <p className="text-gray-500 text-center py-20">Loading...</p>
        ) : items.length === 0 ? (
          <p className="text-gray-500 text-center py-20">
            {tab === 'my_school' && !hasSchools ? 'Add a school to see listings.' : 'No listings found.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {items.map(item => (
              <div
                key={item.id}
                onClick={() => router.push(`/item/${item.id}`)}
                className="bg-[#111] border border-[#222] rounded-2xl overflow-hidden hover:border-violet-500 transition cursor-pointer group"
              >
                <div className="h-48 bg-[#1a1a1a]">
                  {item.images?.[0] ? (
                    <img src={item.images[0]} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl text-gray-700">📦</div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs uppercase tracking-widest text-violet-400 font-semibold">{item.category}</span>
                    {item.size && <span className="text-xs text-gray-500 bg-[#222] px-2 py-0.5 rounded-full">Size {item.size}</span>}
                  </div>
                  <h3 className="font-semibold text-white text-sm line-clamp-2 mb-2">{item.title}</h3>
                  <p className="text-xl font-bold text-white">R{(item.price / 100).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
