'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/lib/cart';
import { ShoppingCart, ScanLine, MapPin, BadgeCheck, Lock, Package } from 'lucide-react';

const AUTH_HIDDEN    = ['/', '/onboarding'];
const NAV_HIDDEN_PFX = ['/klerebank'];  // Hub Mode has its own header

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState('');
  const [isLoggedIn,   setIsLoggedIn]   = useState(false);
  const [isHubAdmin,   setIsHubAdmin]   = useState(false);

  useEffect(() => {
    async function check(userId: string | undefined) {
      setIsLoggedIn(!!userId);
      if (!userId) { setIsHubAdmin(false); return; }
      const { data } = await supabase
        .from('school_admins')
        .select('id')
        .eq('user_id', userId)
        .eq('active', true)
        .limit(1)
        .single();
      setIsHubAdmin(!!data);
    }
    supabase.auth.getUser().then(({ data: { user } }) => check(user?.id));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      check(session?.user?.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (AUTH_HIDDEN.includes(pathname)) return null;
  if (NAV_HIDDEN_PFX.some(p => pathname.startsWith(p))) return null;

  const handleSearch = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (search.trim()) router.push(`/browse?q=${encodeURIComponent(search.trim())}`);
  };

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');
  const { count } = useCart();

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#dedede]">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-6">

        {/* Logo */}
        <a href="/dashboard" className="shrink-0">
          <img src="/logo.png" alt="NextKid" height={88} style={{ height: '88px', width: 'auto' }} />
        </a>

        {/* Pill search bar */}
        <form onSubmit={handleSearch} className="flex-1 max-w-xl">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-[#979797] w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search for school items..."
              className="w-full bg-[#f4f4f4] rounded-full pl-10 pr-4 py-2.5 text-sm text-[#111] placeholder-[#979797] outline-none focus:ring-2 focus:ring-[#BE1E2D]/30 transition"
            />
          </div>
        </form>

        {/* Nav tabs */}
        <nav className="flex items-center gap-1">
          <NavTab label="Browse" active={isActive('/browse')} onClick={() => router.push('/browse')} />
          {isLoggedIn && (
            <NavTab label="Sell" active={isActive('/sell')} onClick={() => router.push('/sell/new')} />
          )}
          {isLoggedIn && (
            <NavTab label="Orders" active={isActive('/orders')} onClick={() => router.push('/orders')} />
          )}
          {isLoggedIn && (
            <NavTab label="Profile" active={isActive('/profile')} onClick={() => router.push('/profile')} />
          )}
        </nav>

        {/* Hub Mode button — only visible to active Klerebank Admins */}
        {isHubAdmin && !pathname.startsWith('/klerebank') && (
          <button
            onClick={() => router.push('/klerebank')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#BE1E2D] hover:bg-[#9B1824] text-white rounded-full text-xs font-bold transition shrink-0"
          >
            <ScanLine size={13} strokeWidth={2.5} />
            Hub Mode
          </button>
        )}

        {/* Cart icon */}
        {isLoggedIn && (
          <button
            onClick={() => router.push('/cart')}
            className="relative shrink-0 p-2 text-[#979797] hover:text-[#BE1E2D] transition"
          >
            <ShoppingCart size={22} strokeWidth={2} />
            {count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-[#BE1E2D] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {count > 9 ? '9+' : count}
              </span>
            )}
          </button>
        )}

        {/* Auth button */}
        {!isLoggedIn ? (
          <button
            onClick={() => router.push('/')}
            className="shrink-0 px-5 py-2 text-sm font-medium rounded-full bg-[#BE1E2D] text-white hover:bg-[#9B1824] transition"
          >
            Sign in
          </button>
        ) : (
          <button
            onClick={async () => { await supabase.auth.signOut(); router.push('/'); }}
            className="shrink-0 px-5 py-2 text-sm font-medium rounded-full border border-[#dedede] text-[#111] hover:bg-[#f4f4f4] transition"
          >
            Sign out
          </button>
        )}
      </div>

      {/* Trust bar — light grey strip below the main nav */}
      <div className="bg-[#f4f4f4] border-t border-[#dedede]">
        <div className="max-w-7xl mx-auto px-6 py-2 flex flex-wrap items-center gap-6">
          <span className="flex items-center gap-1.5 text-xs text-[#555]">
            <MapPin size={11} strokeWidth={2} className="text-[#BE1E2D]" /> South Africa&apos;s school marketplace
          </span>
          <span className="flex items-center gap-1.5 text-xs text-[#555]">
            <BadgeCheck size={11} strokeWidth={2} className="text-[#BE1E2D]" /> Verified sellers
          </span>
          <span className="flex items-center gap-1.5 text-xs text-[#555]">
            <Lock size={11} strokeWidth={2} className="text-[#BE1E2D]" /> Funds held safely
          </span>
          <span className="flex items-center gap-1.5 text-xs text-[#555]">
            <Package size={11} strokeWidth={2} className="text-[#BE1E2D]" /> Real tracking on every order
          </span>
        </div>
      </div>
    </header>
  );
}

function NavTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium relative transition ${active ? 'text-[#BE1E2D]' : 'text-[#979797] hover:text-[#111]'}`}
    >
      {label}
      {active && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#BE1E2D] rounded-full" />
      )}
    </button>
  );
}