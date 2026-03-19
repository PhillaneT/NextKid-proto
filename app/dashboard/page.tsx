'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';

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
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/'); return; }

      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (!data) { router.push('/onboarding'); return; }

      setProfile(data);

      if (data.is_age_verified) {
        const { count } = await supabase.from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id).eq('read', false);
        setUnreadCount(count || 0);
      }

      setLoading(false);
    }
    loadData();
  }, [router]);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-gray-400">Loading...</div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] font-sans">
      <div className="bg-[#111] border-b border-[#222] px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-paper-plane text-xl" style={{ color: 'rgb(228, 37, 205)' }}></i>
          <span className="text-white font-bold text-xl">NextKid</span>
        </div>
        <div className="flex items-center gap-4">
          {profile?.is_age_verified && (
            <button onClick={() => router.push('/notifications')} className="relative p-2 text-gray-400 hover:text-white transition">
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-violet-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          )}
          <span className="text-gray-400 text-sm">{profile?.email}</span>
          <button onClick={signOut} className="px-5 py-2 text-sm border border-gray-600 rounded-lg hover:bg-gray-800 transition">Sign out</button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold text-white mb-2">
          Welcome back, {profile?.full_name?.split(' ')[0]} 👋
        </h1>
        <p className="text-gray-400 mb-12">What would you like to do today?</p>

        {profile?.is_age_verified ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
              <div onClick={() => router.push('/sell/new')}
                className="bg-[#111] border border-violet-500/30 hover:border-violet-500 rounded-3xl p-10 cursor-pointer transition group">
                <div className="text-6xl mb-6">➕</div>
                <h3 className="text-2xl font-semibold text-white mb-3">Sell Something</h3>
                <p className="text-gray-400">Create a new listing and start selling</p>
                <div className="mt-8 text-violet-500 font-medium group-hover:underline">Add Listing →</div>
              </div>
              <div onClick={() => router.push('/browse')}
                className="bg-[#111] border border-blue-500/30 hover:border-blue-500 rounded-3xl p-10 cursor-pointer transition group">
                <div className="text-6xl mb-6">🔍</div>
                <h3 className="text-2xl font-semibold text-white mb-3">Browse & Buy</h3>
                <p className="text-gray-400">Discover items from other sellers</p>
                <div className="mt-8 text-blue-500 font-medium group-hover:underline">Browse Listings →</div>
              </div>
            </div>

            <div className="mt-16 bg-[#111] border border-green-900 rounded-2xl p-6 flex gap-4">
              <div className="text-3xl">✅</div>
              <div>
                <p className="text-green-400 font-semibold">Age Verified — 18+</p>
                <p className="text-gray-400 text-sm mt-1">You have full access to buy and sell on the platform.</p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="max-w-2xl">
              <div onClick={() => router.push('/browse')}
                className="bg-[#111] border border-blue-500/30 hover:border-blue-500 rounded-3xl p-10 cursor-pointer transition group">
                <div className="text-6xl mb-6">🔍</div>
                <h3 className="text-2xl font-semibold text-white mb-3">Browse Listings</h3>
                <p className="text-gray-400">Discover items on the marketplace</p>
                <div className="mt-8 text-blue-500 font-medium group-hover:underline">Browse Listings →</div>
              </div>
            </div>

            <div className="mt-10 bg-[#111] border border-yellow-900 rounded-2xl p-6 flex gap-4">
              <div className="text-3xl">🔞</div>
              <div>
                <p className="text-yellow-400 font-semibold">Browse Only — Under 18</p>
                <p className="text-gray-400 text-sm mt-1">You can browse listings but must be 18 or older to buy or sell.</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}