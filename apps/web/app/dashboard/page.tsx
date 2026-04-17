'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import {
  Shirt, Trophy, Footprints, Dumbbell, BookOpen, ShoppingBag, Package,
  Lock, BadgeCheck, MapPin,
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

      {/* Category grid */}
      <div className="max-w-7xl mx-auto px-6 py-12">
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
      </div>

    </div>
  );
}