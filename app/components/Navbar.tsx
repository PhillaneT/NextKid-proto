'use client';

import { usePathname } from 'next/navigation';

const HIDDEN_ROUTES = ['/dashboard'];

export default function Navbar() {
  const pathname = usePathname();

  if (HIDDEN_ROUTES.includes(pathname)) return null;

  return (
    <div className="bg-[#111] border-b border-[#222] px-8 py-4 flex items-center">
      <a href="/dashboard" className="flex items-center gap-2">
        <i className="fa-solid fa-paper-plane text-xl" style={{ color: 'rgb(228, 37, 205)' }}></i>
        <span className="text-white font-bold text-xl">NextKid</span>
      </a>
    </div>
  );
}