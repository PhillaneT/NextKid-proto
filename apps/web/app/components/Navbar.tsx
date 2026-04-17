'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const AUTH_HIDDEN = ['/', '/onboarding'];

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsLoggedIn(!!session?.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (AUTH_HIDDEN.includes(pathname)) return null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) router.push(`/browse?q=${encodeURIComponent(search.trim())}`);
  };

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#dedede]">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-6">

        {/* Logo */}
        <a href="/dashboard" className="flex items-center shrink-0 leading-none">
          <span style={{ fontFamily: 'var(--font-bebas, Impact, "Arial Black", sans-serif)', fontSize: '1.75rem', letterSpacing: '0.04em', color: '#3A3A3A' }}>NEXT</span>
          <span style={{ fontFamily: 'var(--font-bebas, Impact, "Arial Black", sans-serif)', fontSize: '1.75rem', letterSpacing: '0.04em', color: '#BE1E2D' }}>KID</span>
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