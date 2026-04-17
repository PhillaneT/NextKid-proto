'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import {
  Shirt, Trophy, Footprints, Dumbbell, BookOpen, ShoppingBag, Package,
  Lock, BadgeCheck, MapPin, Clock,
} from 'lucide-react';
import { ALL_CATEGORIES } from '@nextkid/shared';
import type { ListingCategory } from '@nextkid/shared';

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  'School Uniforms': <Shirt size={26} strokeWidth={2} />,
  'School Sports Kit': <Trophy size={26} strokeWidth={2} />,
  'Shoes': <Footprints size={26} strokeWidth={2} />,
  'Sports Equipment': <Dumbbell size={26} strokeWidth={2} />,
  'Books & Stationery': <BookOpen size={26} strokeWidth={2} />,
  'Bags & Accessories': <ShoppingBag size={26} strokeWidth={2} />,
  'Other': <Package size={26} strokeWidth={2} />,
};

type Profile = {
  id: string;
  full_name: string;
  role: 'buyer' | 'seller';
  email: string;
};

type RecentItem = {
  id: string;
  title: string;
  category: string;
  price_cents: number;
  images: string[];
  size: string | null;
  condition: string | null;
  created_at: string;
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function ItemCard({ item, onClick }: { item: RecentItem; onClick: () => void }) {
  const imgUrl = item.images?.[0] ?? null;
  return (
    <button
      onClick={onClick}
      className="group text-left bg-white rounded-2xl border border-[#dedede] overflow-hidden hover:shadow-md hover:border-[#BE1E2D]/30 transition-all"
    >
      {/* Image */}
      <div className="aspect-square bg-[#f4f4f4] overflow-hidden relative">
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#dedede]">
            <Package size={40} strokeWidth={1.5} />
          </div>
        )}
        <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-full px-2 py-0.5 text-[10px] text-[#979797] flex items-center gap-1">
          <Clock size={9} />
          {timeAgo(item.created_at)}
        </div>
      </div>
      {/* Info */}
      <div className="p-3">
        <p className="text-xs text-[#979797] mb-0.5 truncate">{item.category}{item.size ? ` · ${item.size}` : ''}</p>
        <p className="text-sm font-semibold text-[#111] leading-snug line-clamp-2 mb-2">{item.title}</p>
        <p className="text-base font-bold text-[#BE1E2D]">
          R {(item.price_cents / 100).toFixed(2)}
        </p>
      </div>
    </button>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/'); return; }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (!data) { router.push('/onboarding'); return; }
      setProfile(data);
      setLoading(false);
    }
    loadData();
  }, [router]);

  useEffect(() => {
    async function loadRecentItems() {
      setItemsLoading(true);
      const { data } = await supabase
        .from('listings')
        .select('id, title, category, price_cents, images, size, condition, created_at')
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false })
        .limit(16);
      setRecentItems(data ?? []);
      setItemsLoading(false);
    }
    loadRecentItems();
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center text-[#979797]">Loading...</div>
  );

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';

  return (
    <div className="min-h-screen bg-white">

      {/* Hero banner */}
      <div className="bg-[#3A3A3A]">
        <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-[#BE1E2D] text-xs font-semibold tracking-widest uppercase mb-2">Welcome back</p>
            <h1 className="text-4xl font-bold text-white mb-2">
              {firstName}
            </h1>
            <p className="text-white/60 text-base">
              Buy &amp; sell uniforms, books, sports kit and more — right at your school.
            </p>
            <div className="flex gap-4 mt-6">
              <button
                onClick={() => router.push('/browse')}
                className="px-6 py-3 bg-[#BE1E2D] text-white font-semibold rounded-full hover:bg-[#9B1824] transition text-sm"
              >
                Browse listings
              </button>
              <button
                onClick={() => router.push('/sell/new')}
                className="px-6 py-3 bg-white/10 text-white font-semibold rounded-full hover:bg-white/20 transition text-sm border border-white/20"
              >
                + Sell an item
              </button>
            </div>
          </div>
          <ShoppingBag size={96} strokeWidth={1.5} className="text-white/15 hidden md:block" />
        </div>
      </div>

      {/* Trust bar */}
      <div className="bg-[#6B6B6B]">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex flex-wrap gap-8 text-sm text-white/80">
          <span className="flex items-center gap-2"><MapPin size={13} strokeWidth={2} className="text-[#BE1E2D]" /> South Africa&apos;s school marketplace</span>
          <span className="flex items-center gap-2"><BadgeCheck size={13} strokeWidth={2} className="text-[#BE1E2D]" /> Verified sellers</span>
          <span className="flex items-center gap-2"><Lock size={13} strokeWidth={2} className="text-[#BE1E2D]" /> Secure payments via Peach Payments</span>
          <span className="flex items-center gap-2"><Package size={13} strokeWidth={2} className="text-[#BE1E2D]" /> Real tracking on every order</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12 space-y-14">

        {/* Category grid */}
        <section>
          <h2 className="text-xl font-bold text-[#111] mb-6">Shop by category</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
            {(ALL_CATEGORIES as readonly ListingCategory[]).map(cat => (
              <button
                key={cat}
                onClick={() => router.push(`/browse?category=${encodeURIComponent(cat)}`)}
                className="flex flex-col items-center gap-2 p-4 bg-[#f4f4f4] rounded-2xl hover:bg-[#fde8ea] hover:text-[#BE1E2D] transition group text-center"
              >
                <span className="text-[#BE1E2D] group-hover:text-[#BE1E2D]">{CATEGORY_ICON[cat] ?? <Package size={26} strokeWidth={2} />}</span>
                <span className="text-xs font-medium text-[#111] group-hover:text-[#BE1E2D] leading-tight">{cat}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Recently listed */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-[#111]">Recently listed</h2>
              <p className="text-sm text-[#979797] mt-0.5">Fresh items just added by sellers near you</p>
            </div>
            <button
              onClick={() => router.push('/browse')}
              className="text-sm font-medium text-[#BE1E2D] hover:underline"
            >
              View all →
            </button>
          </div>

          {itemsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-2xl bg-[#f4f4f4] animate-pulse aspect-[3/4]" />
              ))}
            </div>
          ) : recentItems.length === 0 ? (
            <div className="text-center py-16 text-[#979797]">
              <Package size={40} strokeWidth={1.5} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No listings yet — be the first to sell something!</p>
              <button
                onClick={() => router.push('/sell/new')}
                className="mt-4 px-5 py-2 bg-[#BE1E2D] text-white text-sm font-semibold rounded-full hover:bg-[#9B1824] transition"
              >
                + List an item
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {recentItems.map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onClick={() => router.push(`/item/${item.id}`)}
                />
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
