'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import {
  Shirt, Trophy, Footprints, Dumbbell, BookOpen, ShoppingBag, Package,
  Lock, CheckCircle2, AlertTriangle, BadgeCheck, MapPin,
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
  role: 'buyer' | 'seller' | 'browse_only';
  email: string;
  is_age_verified: boolean;
};

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center text-[#979797]">Loading...</div>
  );

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';

  return (
    <div className="min-h-screen bg-white">

      {/* Hero banner */}
      <div className="bg-[#4757bf]">
        <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              Welcome back, {firstName}!
            </h1>
            <p className="text-white/80 text-lg">
              South Africa&apos;s school marketplace — buy &amp; sell uniforms, books, sports kit and more.
            </p>
            <div className="flex gap-4 mt-6">
              <button
                onClick={() => router.push('/browse')}
                className="px-6 py-3 bg-white text-[#4757bf] font-semibold rounded-full hover:bg-white/90 transition text-sm"
              >
                Browse listings
              </button>
              {profile?.is_age_verified && (
                <button
                  onClick={() => router.push('/sell/new')}
                  className="px-6 py-3 bg-white/20 text-white font-semibold rounded-full hover:bg-white/30 transition text-sm border border-white/40"
                >
                  + Sell an item
                </button>
              )}
            </div>
          </div>
          <ShoppingBag size={96} strokeWidth={1.5} className="text-white/30 hidden md:block" />
        </div>
      </div>

      {/* Trust bar */}
      <div className="border-b border-[#dedede] bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap gap-8 text-sm text-[#979797]">
          <span className="flex items-center gap-2"><MapPin size={14} strokeWidth={2} /> South Africa&apos;s school marketplace</span>
          <span className="flex items-center gap-2"><BadgeCheck size={14} strokeWidth={2} /> Verified sellers</span>
          <span className="flex items-center gap-2"><Lock size={14} strokeWidth={2} /> Secure payments via Peach Payments</span>
          <span className="flex items-center gap-2"><Package size={14} strokeWidth={2} /> Real tracking on every order</span>
        </div>
      </div>

      {/* Category grid */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <h2 className="text-xl font-bold text-[#111] mb-6">Shop by category</h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
          {(ALL_CATEGORIES as readonly ListingCategory[]).map(cat => (
            <button
              key={cat}
              onClick={() => router.push(`/browse?category=${encodeURIComponent(cat)}`)}
              className="flex flex-col items-center gap-2 p-4 bg-[#f4f4f4] rounded-2xl hover:bg-[#eef0fb] hover:text-[#4757bf] transition group text-center"
            >
              <span className="text-[#4757bf] group-hover:text-[#4757bf]">{CATEGORY_ICON[cat] ?? <Package size={26} strokeWidth={2} />}</span>
              <span className="text-xs font-medium text-[#111] group-hover:text-[#4757bf] leading-tight">{cat}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Status banner */}
      <div className="max-w-7xl mx-auto px-6 pb-12">
        {profile?.is_age_verified ? (
          <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-2xl px-6 py-4 flex items-center gap-3">
            <CheckCircle2 size={20} strokeWidth={2} className="text-green-500 shrink-0" />
            <div>
              <p className="font-semibold text-green-800 text-sm">Age Verified — 18+</p>
              <p className="text-green-700 text-xs mt-0.5">You have full access to buy and sell on the platform.</p>
            </div>
          </div>
        ) : (
          <div className="bg-[#fffbeb] border border-[#fde68a] rounded-2xl px-6 py-4 flex items-center gap-3">
            <AlertTriangle size={20} strokeWidth={2} className="text-yellow-500 shrink-0" />
            <div>
              <p className="font-semibold text-yellow-800 text-sm">Browse Only — Under 18</p>
              <p className="text-yellow-700 text-xs mt-0.5">You can browse but must be 18+ to buy or sell.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
