'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/lib/cart';
import { ShoppingCart, ScanLine, Menu, X, ArrowLeft, Heart } from 'lucide-react';

const AUTH_HIDDEN    = ['/', '/onboarding'];
const NAV_HIDDEN_PFX = ['/klerebank'];

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState('');
  const [isLoggedIn,   setIsLoggedIn]   = useState(false);
  const [isHubAdmin,   setIsHubAdmin]   = useState(false);
  const [menuOpen,     setMenuOpen]     = useState(false);

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
  const showBack = true;

  const nav = (close?: () => void) => (
    <>
      <NavTab label="Browse" active={isActive('/browse')} onClick={() => { router.push('/browse'); close?.(); }} />
      {isLoggedIn && (
        <NavTab label="Sell" active={isActive('/sell')} onClick={() => { router.push('/sell/new'); close?.(); }} />
      )}
      {isLoggedIn && (
        <button
          onClick={() => { router.push('/wishlist'); close?.(); }}
          className={`px-4 py-2 text-sm font-medium relative transition flex items-center gap-1.5 ${isActive('/wishlist') ? 'text-white' : 'text-white/60 hover:text-white'}`}
        >
          <Heart size={14} strokeWidth={2} fill={isActive('/wishlist') ? 'white' : 'none'} />
          Wishlist
          {isActive('/wishlist') && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#BE1E2D] rounded-full" />}
        </button>
      )}
      {isLoggedIn && (
        <NavTab label="Profile" active={isActive('/profile')} onClick={() => { router.push('/profile'); close?.(); }} />
      )}
      {isHubAdmin && !pathname.startsWith('/klerebank') && (
        <button
          onClick={() => { router.push('/klerebank'); close?.(); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#BE1E2D] hover:bg-[#9B1824] text-white rounded-full text-xs font-bold transition"
        >
          <ScanLine size={13} strokeWidth={2.5} />
          Hub Mode
        </button>
      )}
      {isHubAdmin && (
        <button
          onClick={() => { router.push('/admin/payouts'); close?.(); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full text-xs font-bold transition"
        >
          💸 Payouts
        </button>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-50 bg-[#6B6B6B]">
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center gap-4">

        {/* Back button */}
        {showBack && (
          <button
            onClick={() => router.back()}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-full transition text-sm font-medium"
          >
            <ArrowLeft size={16} strokeWidth={2.5} />
            Back
          </button>
        )}

        {/* Logo */}
        <a href="/dashboard" className="shrink-0">
          <img src="/logo.png" alt="NextKid" style={{ height: '72px', width: 'auto' }} />
        </a>

        {/* Pill search bar — hidden on mobile */}
        <form onSubmit={handleSearch} className="hidden md:block flex-1 max-w-xl">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search for school items..."
              className="w-full bg-white/15 rounded-full pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/50 outline-none focus:ring-2 focus:ring-white/30 transition"
            />
          </div>
        </form>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {nav()}
        </nav>

        {/* Spacer on mobile */}
        <div className="flex-1 md:hidden" />

        {/* Cart icon */}
        {isLoggedIn && (
          <button
            onClick={() => router.push('/cart')}
            className="relative shrink-0 p-2 text-white/70 hover:text-white transition"
          >
            <ShoppingCart size={22} strokeWidth={2} />
            {count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-[#BE1E2D] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {count > 9 ? '9+' : count}
              </span>
            )}
          </button>
        )}

        {/* Desktop auth button */}
        <div className="hidden md:block">
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
              className="shrink-0 px-5 py-2 text-sm font-medium rounded-full border border-white/30 text-white hover:bg-white/10 transition"
            >
              Sign out
            </button>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(o => !o)}
          className="md:hidden shrink-0 p-2 text-white"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile search bar */}
      <div className="md:hidden px-4 pb-3">
        <form onSubmit={handleSearch}>
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search for school items..."
              className="w-full bg-white/15 rounded-full pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/50 outline-none focus:ring-2 focus:ring-white/30 transition"
            />
          </div>
        </form>
      </div>

      {/* Mobile menu drawer */}
      {menuOpen && (
        <div className="md:hidden bg-[#5a5a5a] px-4 pb-4 flex flex-col gap-1">
          {nav(() => setMenuOpen(false))}
          <div className="mt-2 border-t border-white/20 pt-3">
            {!isLoggedIn ? (
              <button
                onClick={() => { router.push('/'); setMenuOpen(false); }}
                className="w-full py-2.5 text-sm font-medium rounded-full bg-[#BE1E2D] text-white hover:bg-[#9B1824] transition"
              >
                Sign in
              </button>
            ) : (
              <button
                onClick={async () => { await supabase.auth.signOut(); router.push('/'); setMenuOpen(false); }}
                className="w-full py-2.5 text-sm font-medium rounded-full border border-white/30 text-white hover:bg-white/10 transition"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

function NavTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium relative transition ${active ? 'text-white' : 'text-white/60 hover:text-white'}`}
    >
      {label}
      {active && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#BE1E2D] rounded-full" />
      )}
    </button>
  );
}