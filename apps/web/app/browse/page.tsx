'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Shirt, Trophy, Footprints, Dumbbell, BookOpen, ShoppingBag, Package,
  School as SchoolIcon, Search, ShoppingCart, Check, Heart,
} from 'lucide-react';
import { useCart } from '@/lib/cart';
import { ALL_CATEGORIES, PLATFORM_DEFAULTS } from '@nextkid/shared';
import type { ListingCategory, School } from '@nextkid/shared';

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  'School Uniforms': <Shirt size={14} strokeWidth={2} />,
  'School Sports Kit': <Trophy size={14} strokeWidth={2} />,
  'Shoes': <Footprints size={14} strokeWidth={2} />,
  'Sports Equipment': <Dumbbell size={14} strokeWidth={2} />,
  'Books & Stationery': <BookOpen size={14} strokeWidth={2} />,
  'Bags & Accessories': <ShoppingBag size={14} strokeWidth={2} />,
  'Other': <Package size={14} strokeWidth={2} />,
};

const CATEGORY_ICON_LG: Record<string, React.ReactNode> = {
  'School Uniforms': <Shirt size={32} strokeWidth={1.5} />,
  'School Sports Kit': <Trophy size={32} strokeWidth={1.5} />,
  'Shoes': <Footprints size={32} strokeWidth={1.5} />,
  'Sports Equipment': <Dumbbell size={32} strokeWidth={1.5} />,
  'Books & Stationery': <BookOpen size={32} strokeWidth={1.5} />,
  'Bags & Accessories': <ShoppingBag size={32} strokeWidth={1.5} />,
  'Other': <Package size={32} strokeWidth={1.5} />,
};

type Item = {
  id: string;
  title: string;
  category: string;
  price_cents: number;
  images: string[];
  seller_id: string;
  seller_school_id: string | null;
  is_school_specific: boolean;
  size: string | null;
  is_multi_item: boolean;
  available_count: number;
  schools: { name: string } | null;
};

type BrowseTab = 'my_school' | 'all';

export default function BrowsePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { add, has } = useCart();
  const [tab, setTab] = useState<BrowseTab>('all');
  const [items, setItems] = useState<Item[]>([]);
  const [otherItems, setOtherItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [wishlistLoading, setWishlistLoading] = useState<string | null>(null);
  const [category, setCategory] = useState<ListingCategory | 'All'>('All');
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('q') ?? '');
  const [userSchools, setUserSchools] = useState<School[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), PLATFORM_DEFAULTS.SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const token = session.access_token;
      const headers = { Authorization: `Bearer ${token}` };
      const [{ data: profile }, wishlistRes] = await Promise.all([
        supabase.from('profiles').select('school_ids').eq('id', session.user.id).single(),
        fetch('/api/wishlist', { headers }),
      ]);
      if (profile?.school_ids?.length) {
        const { data: schools } = await supabase.from('schools').select('*').in('id', profile.school_ids);
        setUserSchools((schools as School[]) ?? []);
      }
      if (wishlistRes.ok) {
        const json = await wishlistRes.json();
        setWishlistIds(new Set((json.items ?? []).map((i: { listing_id: string }) => i.listing_id)));
      }
    });
  }, []);

  useEffect(() => {
    if (userSchools.length > 0) setTab('my_school');
  }, [userSchools]);

  useEffect(() => {
    const cat = searchParams.get('category');
    if (cat && ALL_CATEGORIES.includes(cat as ListingCategory)) {
      setCategory(cat as ListingCategory);
    }
  }, [searchParams]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setOtherItems([]);

    const baseSelect = 'id, title, category, price_cents, images, seller_id, seller_school_id, is_school_specific, size, is_multi_item, available_count, schools(name)';

    let query = supabase
      .from('listings')
      .select(baseSelect)
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: false });

    if (category !== 'All') query = query.eq('category', category);
    if (debouncedSearch) query = query.ilike('title', `%${debouncedSearch}%`);

    if (tab === 'my_school') {
      if (userSchools.length === 0) { setItems([]); setLoading(false); return; }

      const schoolIds = userSchools.map(s => s.id);

      // Fetch school-specific items
      const { data: schoolData } = await query.in('seller_school_id', schoolIds);
      setItems((schoolData as unknown as Item[]) ?? []);

      // Fetch other listings (not from user's schools)
      let otherQuery = supabase
        .from('listings')
        .select(baseSelect)
        .eq('status', 'ACTIVE')
        .not('seller_school_id', 'in', `(${schoolIds.join(',')})`)
        .order('created_at', { ascending: false });

      if (category !== 'All') otherQuery = otherQuery.eq('category', category);
      if (debouncedSearch) otherQuery = otherQuery.ilike('title', `%${debouncedSearch}%`);

      const { data: otherData } = await otherQuery;
      setOtherItems((otherData as unknown as Item[]) ?? []);
    } else {
      const { data, error } = await query;
      if (error) console.error('Browse error:', error);
      setItems((data as unknown as Item[]) ?? []);
    }

    setLoading(false);
  }, [category, debouncedSearch, tab, userSchools]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  async function toggleWishlist(e: React.MouseEvent, listingId: string) {
    e.stopPropagation();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const token = session.access_token;
    setWishlistLoading(listingId);
    if (wishlistIds.has(listingId)) {
      await fetch(`/api/wishlist/${listingId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setWishlistIds(prev => { const n = new Set(prev); n.delete(listingId); return n; });
    } else {
      await fetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ listingId }),
      });
      setWishlistIds(prev => new Set(prev).add(listingId));
    }
    setWishlistLoading(null);
  }

  const hasSchools = userSchools.length > 0;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#111]">Browse Listings</h1>
          <p className="text-[#979797] text-sm mt-1">Second-hand school items across South Africa</p>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-[#dedede] mb-6">
          <TabBtn icon={<SchoolIcon size={14} strokeWidth={2} />} label={`My School${hasSchools ? ` (${userSchools.map(s => s.name.split(' ')[0]).join(', ')})` : ''}`} active={tab === 'my_school'} onClick={() => setTab('my_school')} />
          <TabBtn icon={<Package size={14} strokeWidth={2} />} label="All Items" active={tab === 'all'} onClick={() => setTab('all')} />
        </div>

        {tab === 'my_school' && !hasSchools && (
          <div className="bg-[#fff5f5] border border-[#BE1E2D]/30 rounded-2xl p-5 mb-6 flex items-center justify-between">
            <p className="text-[#979797] text-sm">You haven&apos;t added a school yet. Add one to see uniform and sports kit listings.</p>
            <button onClick={() => router.push('/dashboard')} className="ml-4 px-4 py-2 bg-[#BE1E2D] text-white text-sm rounded-full shrink-0 hover:bg-[#9B1824] transition">Add School</button>
          </div>
        )}

        {/* Search */}
        <div className="relative mb-6">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-[#979797] w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search listings..."
            className="w-full bg-[#f4f4f4] rounded-full pl-10 pr-4 py-3 text-sm text-[#111] placeholder-[#979797] outline-none focus:ring-2 focus:ring-[#BE1E2D]/30 transition"
          />
        </div>

        {/* Category pills */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-1 scrollbar-hide">
          {(['All', ...ALL_CATEGORIES] as Array<ListingCategory | 'All'>).map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition shrink-0 ${
                category === cat
                  ? 'bg-[#BE1E2D] text-white'
                  : 'bg-[#f4f4f4] text-[#111] hover:bg-[#fde8ea] hover:text-[#BE1E2D]'
              }`}
            >
              {cat !== 'All' && (
                <span className="flex items-center">{CATEGORY_ICON[cat as ListingCategory] ?? null}</span>
              )}
              {cat}
            </button>
          ))}
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-24 text-[#979797]">Loading...</div>
        ) : items.length === 0 && otherItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Search size={48} strokeWidth={1.5} className="text-[#dedede] mb-4" />
            <p className="text-[#111] font-semibold">No listings found</p>
            <p className="text-[#979797] text-sm mt-1">
              {tab === 'my_school' && !hasSchools ? 'Add a school to see listings.' : 'Try adjusting your filters.'}
            </p>
          </div>
        ) : (
          <>
            {/* My school listings */}
            {items.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {items.map(item => (
                  <ListingCard
                    key={item.id}
                    item={item}
                    wishlisted={wishlistIds.has(item.id)}
                    wishlistLoading={wishlistLoading === item.id}
                    inCart={has(item.id)}
                    onToggleWishlist={toggleWishlist}
                    onAddToCart={() => add({
                      listingId: item.id,
                      title: item.title,
                      price_cents: item.price_cents,
                      image: item.images?.[0] ?? null,
                      sellerId: item.seller_id,
                      category: item.category,
                      size: item.size,
                    })}
                    onClick={() => router.push(`/item/${item.id}`)}
                  />
                ))}
              </div>
            )}

            {/* Other listings section — only shown on My School tab */}
            {tab === 'my_school' && otherItems.length > 0 && (
              <div className="mt-12">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex-1 h-px bg-[#dedede]" />
                  <p className="text-sm font-semibold text-[#979797] shrink-0">Other listings across South Africa</p>
                  <div className="flex-1 h-px bg-[#dedede]" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {otherItems.map(item => (
                    <ListingCard
                      key={item.id}
                      item={item}
                      wishlisted={wishlistIds.has(item.id)}
                      wishlistLoading={wishlistLoading === item.id}
                      inCart={has(item.id)}
                      onToggleWishlist={toggleWishlist}
                      onAddToCart={() => add({
                        listingId: item.id,
                        title: item.title,
                        price_cents: item.price_cents,
                        image: item.images?.[0] ?? null,
                        sellerId: item.seller_id,
                        category: item.category,
                        size: item.size,
                      })}
                      onClick={() => router.push(`/item/${item.id}`)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Listing card ──────────────────────────────────────────────────────────────

function ListingCard({
  item,
  wishlisted,
  wishlistLoading,
  inCart,
  onToggleWishlist,
  onAddToCart,
  onClick,
}: {
  item: Item;
  wishlisted: boolean;
  wishlistLoading: boolean;
  inCart: boolean;
  onToggleWishlist: (e: React.MouseEvent, id: string) => void;
  onAddToCart: () => void;
  onClick: () => void;
}) {
  const schoolName = item.schools?.name ?? null;

  return (
    <div
      onClick={onClick}
      className="bg-white border border-[#dedede] rounded-2xl overflow-hidden hover:shadow-md hover:border-[#BE1E2D]/40 transition cursor-pointer group"
    >
      {/* Image */}
      <div className="aspect-square bg-[#f4f4f4] overflow-hidden relative">
        {item.images?.[0] ? (
          <img
            src={item.images[0]}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#dedede]">
            {CATEGORY_ICON_LG[item.category as ListingCategory] ?? <Package size={32} strokeWidth={1.5} />}
          </div>
        )}
        {item.is_multi_item && item.available_count > 0 && (
          <div className="absolute top-2 left-2 bg-[#BE1E2D] text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
            Bundle · {item.available_count} items
          </div>
        )}
      </div>

      {/* Details */}
      <div className="p-3">
        {/* School name badge */}
        {schoolName && (
          <div className="flex items-center gap-1 mb-1.5">
            <SchoolIcon size={10} strokeWidth={2} className="text-[#BE1E2D] shrink-0" />
            <span className="text-[10px] text-[#BE1E2D] font-medium truncate">{schoolName}</span>
          </div>
        )}

        <p className="text-xs text-[#979797] mb-1 flex items-center gap-1">
          <span className="text-[#979797]">{CATEGORY_ICON[item.category as ListingCategory] ?? null}</span>
          <span>{item.category}</span>
          {item.size && <span className="ml-auto bg-[#f4f4f4] px-1.5 py-0.5 rounded text-[10px]">Size {item.size}</span>}
        </p>
        <h3 className="text-sm font-medium text-[#111] line-clamp-2 leading-snug mb-2">{item.title}</h3>
        <div className="flex items-center justify-between gap-2">
          <p className="text-base font-bold text-[#BE1E2D]">R{(item.price_cents / 100).toLocaleString()}</p>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Wishlist heart */}
            <button
              onClick={e => onToggleWishlist(e, item.id)}
              disabled={wishlistLoading}
              className={`p-1.5 rounded-full border transition ${
                wishlisted
                  ? 'border-[#BE1E2D] text-[#BE1E2D]'
                  : 'border-[#dedede] text-[#979797] hover:border-[#BE1E2D] hover:text-[#BE1E2D]'
              }`}
              title={wishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
            >
              <Heart size={13} strokeWidth={2} fill={wishlisted ? '#BE1E2D' : 'none'} />
            </button>
            {/* Cart */}
            <button
              onClick={e => { e.stopPropagation(); onAddToCart(); }}
              className={`p-1.5 rounded-full border transition ${
                inCart
                  ? 'bg-[#BE1E2D] border-[#BE1E2D] text-white'
                  : 'border-[#dedede] text-[#979797] hover:border-[#BE1E2D] hover:text-[#BE1E2D]'
              }`}
              title={inCart ? 'In cart' : 'Add to cart'}
            >
              {inCart
                ? <Check size={13} strokeWidth={2.5} />
                : <ShoppingCart size={13} strokeWidth={2} />
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabBtn({ icon, label, active, onClick }: { icon?: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-5 py-3 text-sm font-medium border-b-2 transition -mb-px ${
        active
          ? 'border-[#BE1E2D] text-[#BE1E2D]'
          : 'border-transparent text-[#979797] hover:text-[#111]'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
