'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart';
import {
  Shirt, Trophy, Footprints, Dumbbell, BookOpen, ShoppingBag, Package,
  Lock, BadgeCheck, MapPin, Clock, Sparkles, Baby, Check, ShoppingCart, GraduationCap,
} from 'lucide-react';
import { ALL_CATEGORIES } from '@nextkid/shared';
import type { ListingCategory } from '@nextkid/shared';

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  'School Uniforms':   <Shirt size={26} strokeWidth={2} />,
  'School Sports Kit': <Trophy size={26} strokeWidth={2} />,
  'Shoes':             <Footprints size={26} strokeWidth={2} />,
  'Sports Equipment':  <Dumbbell size={26} strokeWidth={2} />,
  'Books & Stationery':   <BookOpen size={26} strokeWidth={2} />,
  'University Textbooks': <GraduationCap size={26} strokeWidth={2} />,
  'Bags & Accessories':   <ShoppingBag size={26} strokeWidth={2} />,
  'Other':             <Package size={26} strokeWidth={2} />,
};

type FeedItem = {
  id: string; title: string; category: string; price_cents: number
  images: string[]; size: string | null; seller_id: string; seller_school_id: string | null
  created_at: string
};

type FeedSection = { type: string; title: string; items: FeedItem[] }
type ChildFeed   = { childId: string; nickname: string; gender: string; sections: FeedSection[] }
type Feed        = { children: ChildFeed[]; generic: FeedSection[]; fromCache: boolean }

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function sectionIcon(type: string) {
  if (type === 'fits_now')   return <Check size={14} strokeWidth={2.5} className="text-green-600" />;
  if (type === 'plan_ahead') return <Sparkles size={14} strokeWidth={2} className="text-[#BE1E2D]" />;
  if (type === 'sports')     return <Trophy size={14} strokeWidth={2} className="text-amber-600" />;
  return <Clock size={14} strokeWidth={2} className="text-gray-400" />;
}

function ItemCard({ item }: { item: FeedItem }) {
  const router = useRouter();
  const { add, has } = useCart();
  return (
    <div
      onClick={() => router.push(`/item/${item.id}`)}
      className="bg-white border border-[#dedede] rounded-2xl overflow-hidden hover:shadow-md hover:border-[#BE1E2D]/40 transition cursor-pointer group shrink-0 w-44"
    >
      <div className="aspect-square bg-[#f4f4f4] overflow-hidden relative">
        {item.images?.[0] ? (
          <img src={item.images[0]} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#dedede]">
            <Package size={32} strokeWidth={1.5} />
          </div>
        )}
        {item.size && (
          <span className="absolute top-2 left-2 bg-white/90 text-[10px] font-bold text-gray-700 px-1.5 py-0.5 rounded-full">
            Size {item.size}
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="text-xs text-[#979797] mb-0.5 truncate">{item.category}</p>
        <p className="text-sm font-semibold text-[#111] line-clamp-2 leading-snug mb-2">{item.title}</p>
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-[#BE1E2D]">R{(item.price_cents / 100).toLocaleString()}</p>
          <button
            onClick={e => { e.stopPropagation(); add({ listingId: item.id, title: item.title, price_cents: item.price_cents, image: item.images?.[0] ?? null, sellerId: item.seller_id, category: item.category, size: item.size }) }}
            className={`p-1.5 rounded-full border transition ${has(item.id) ? 'bg-[#BE1E2D] border-[#BE1E2D] text-white' : 'border-[#dedede] text-[#979797] hover:border-[#BE1E2D] hover:text-[#BE1E2D]'}`}
          >
            {has(item.id) ? <Check size={11} strokeWidth={2.5} /> : <ShoppingCart size={11} strokeWidth={2} />}
          </button>
        </div>
      </div>
    </div>
  );
}

function FeedSectionRow({ section }: { section: FeedSection }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        {sectionIcon(section.type)}
        <h3 className="text-base font-bold text-[#111]">{section.title}</h3>
        <span className="text-xs text-[#979797] ml-1">({section.items.length})</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
        {section.items.map(item => <ItemCard key={item.id} item={item} />)}
      </div>
    </div>
  );
}

function ItemGrid({ items }: { items: FeedItem[] }) {
  const router = useRouter();
  const { add, has } = useCart();
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {items.map(item => (
        <div
          key={item.id}
          onClick={() => router.push(`/item/${item.id}`)}
          className="bg-white border border-[#dedede] rounded-2xl overflow-hidden hover:shadow-md hover:border-[#BE1E2D]/40 transition cursor-pointer group"
        >
          <div className="aspect-square bg-[#f4f4f4] overflow-hidden relative">
            {item.images?.[0] ? (
              <img src={item.images[0]} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#dedede]"><Package size={40} strokeWidth={1.5} /></div>
            )}
            <div className="absolute top-2 right-2 bg-white/90 rounded-full px-2 py-0.5 text-[10px] text-[#979797] flex items-center gap-1">
              <Clock size={9} />{timeAgo(item.created_at)}
            </div>
          </div>
          <div className="p-3">
            <p className="text-xs text-[#979797] mb-0.5 truncate">{item.category}{item.size ? ` · ${item.size}` : ''}</p>
            <p className="text-sm font-semibold text-[#111] line-clamp-2 leading-snug mb-2">{item.title}</p>
            <div className="flex items-center justify-between gap-2">
              <p className="text-base font-bold text-[#BE1E2D]">R {(item.price_cents / 100).toFixed(2)}</p>
              <button
                onClick={e => { e.stopPropagation(); add({ listingId: item.id, title: item.title, price_cents: item.price_cents, image: item.images?.[0] ?? null, sellerId: item.seller_id, category: item.category, size: item.size }) }}
                className={`shrink-0 p-1.5 rounded-full border transition ${has(item.id) ? 'bg-[#BE1E2D] border-[#BE1E2D] text-white' : 'border-[#dedede] text-[#979797] hover:border-[#BE1E2D] hover:text-[#BE1E2D]'}`}
              >
                {has(item.id) ? <Check size={13} strokeWidth={2.5} /> : <ShoppingCart size={13} strokeWidth={2} />}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const router   = useRouter();
  const [profile, setProfile]     = useState<{ full_name: string } | null>(null);
  const [feed, setFeed]           = useState<Feed | null>(null);
  const [feedLoading, setFeedLoading] = useState(true);
  const [activeChild, setActiveChild] = useState(0);
  const [token, setToken]         = useState('');

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/'); return; }
      setToken(session.access_token);

      const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', session.user.id).single();
      if (!prof) { router.push('/onboarding'); return; }
      setProfile(prof);
    }
    load();
  }, [router]);

  const loadFeed = useCallback(async (t: string) => {
    if (!t) return;
    setFeedLoading(true);
    const res = await fetch('/api/feed', { headers: { Authorization: `Bearer ${t}` } });
    if (res.ok) setFeed(await res.json());
    setFeedLoading(false);
  }, []);

  useEffect(() => { if (token) loadFeed(token); }, [token, loadFeed]);

  const firstName    = profile?.full_name?.split(' ')[0] ?? 'there';
  const hasChildren  = (feed?.children?.length ?? 0) > 0;
  const currentChild = feed?.children?.[activeChild] ?? null;
  const genericItems = feed?.generic?.[0]?.items ?? [];

  return (
    <div className="min-h-screen bg-white">

      {/* Hero */}
      <div className="bg-[#3A3A3A]">
        <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-[#BE1E2D] text-xs font-semibold tracking-widest uppercase mb-2">Welcome back</p>
            <h1 className="text-4xl font-bold text-white mb-2">{firstName}</h1>
            <p className="text-white/60 text-base">
              {hasChildren
                ? `Showing personalised picks for your ${feed!.children.length === 1 ? 'child' : `${feed!.children.length} children`}.`
                : 'Buy & sell uniforms, books, sports kit and more — right at your school.'}
            </p>
            <div className="flex gap-4 mt-6">
              <button onClick={() => router.push('/browse')} className="px-6 py-3 bg-[#BE1E2D] text-white font-semibold rounded-full hover:bg-[#9B1824] transition text-sm">
                Browse listings
              </button>
              <button onClick={() => router.push('/sell/new')} className="px-6 py-3 bg-white/10 text-white font-semibold rounded-full hover:bg-white/20 transition text-sm border border-white/20">
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
          <span className="flex items-center gap-2"><MapPin size={13} strokeWidth={2} className="text-[#BE1E2D]" /> South Africa's school marketplace</span>
          <span className="flex items-center gap-2"><BadgeCheck size={13} strokeWidth={2} className="text-[#BE1E2D]" /> Verified sellers</span>
          <span className="flex items-center gap-2"><Lock size={13} strokeWidth={2} className="text-[#BE1E2D]" /> Secure payments via Stitch</span>
          <span className="flex items-center gap-2"><Package size={13} strokeWidth={2} className="text-[#BE1E2D]" /> Real tracking on every order</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12 space-y-12">

        {/* Category grid */}
        <section>
          <h2 className="text-xl font-bold text-[#111] mb-4">Shop by category</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {(ALL_CATEGORIES as readonly ListingCategory[]).map(cat => (
              <button
                key={cat}
                onClick={() => router.push(`/browse?category=${encodeURIComponent(cat)}`)}
                className="flex flex-col items-center gap-2 p-4 bg-[#f4f4f4] rounded-2xl hover:bg-[#fde8ea] hover:text-[#BE1E2D] transition group text-center shrink-0 min-w-[90px]"
              >
                <span className="text-[#BE1E2D]">{CATEGORY_ICON[cat] ?? <Package size={26} strokeWidth={2} />}</span>
                <span className="text-xs font-medium text-[#111] group-hover:text-[#BE1E2D] leading-tight">{cat}</span>
              </button>
            ))}
          </div>
        </section>

        {/* ── Personalised feed ── */}
        {feedLoading ? (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={16} className="text-[#BE1E2D]" />
              <h2 className="text-xl font-bold text-[#111]">Building your personalised feed...</h2>
            </div>
            <div className="flex gap-3 overflow-x-auto">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="shrink-0 w-44 rounded-2xl bg-[#f4f4f4] animate-pulse aspect-[3/4]" />
              ))}
            </div>
          </section>
        ) : hasChildren ? (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-[#BE1E2D]" />
                <h2 className="text-xl font-bold text-[#111]">Your Personalised Feed</h2>
              </div>
              <button
                onClick={() => router.push('/children')}
                className="text-sm text-[#BE1E2D] font-semibold hover:underline flex items-center gap-1"
              >
                <Baby size={14} /> Manage children
              </button>
            </div>

            {/* Child tab switcher */}
            {feed!.children.length > 1 && (
              <div className="flex gap-2 mb-6 border-b border-[#dedede] overflow-x-auto scrollbar-hide">
                {feed!.children.map((child, i) => (
                  <button
                    key={child.childId}
                    onClick={() => setActiveChild(i)}
                    className={`flex items-center gap-1.5 px-5 py-3 text-sm font-semibold border-b-2 transition shrink-0 -mb-px ${
                      activeChild === i
                        ? 'border-[#BE1E2D] text-[#BE1E2D]'
                        : 'border-transparent text-[#979797] hover:text-[#111]'
                    }`}
                  >
                    {child.gender === 'boy' ? '👦' : child.gender === 'girl' ? '👧' : '🧒'}
                    {child.nickname}
                  </button>
                ))}
              </div>
            )}

            {/* Sections for active child */}
            {currentChild ? (
              currentChild.sections.length > 0 ? (
                currentChild.sections.map(section => (
                  <FeedSectionRow key={section.type} section={section} />
                ))
              ) : (
                <div className="py-10 text-center text-[#979797]">
                  <p className="text-sm">No matching listings yet for {currentChild.nickname}.</p>
                  <p className="text-xs mt-1">More items appear as sellers list in {currentChild.nickname}'s sizes.</p>
                </div>
              )
            ) : null}
          </section>
        ) : (
          // No children — show CTA card
          <div className="bg-gradient-to-br from-[#fef2f2] to-[#fff] border border-[#BE1E2D]/20 rounded-2xl p-6 flex items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={16} className="text-[#BE1E2D]" />
                <h3 className="font-bold text-[#111]">Get a personalised feed</h3>
              </div>
              <p className="text-sm text-[#555] leading-relaxed max-w-md">
                Add your child's profile and sizes — we'll show you exactly what fits right now, what to plan ahead for next year, and sports gear matching their interests.
              </p>
            </div>
            <button
              onClick={() => router.push('/children')}
              className="shrink-0 flex items-center gap-2 px-5 py-3 bg-[#BE1E2D] text-white font-bold text-sm rounded-full hover:bg-[#9B1824] transition"
            >
              <Baby size={15} /> Add Child
            </button>
          </div>
        )}

        {/* Recently listed (always shown) */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-[#111]">Recently listed</h2>
              <p className="text-sm text-[#979797] mt-0.5">Fresh items just added by sellers</p>
            </div>
            <button onClick={() => router.push('/browse')} className="text-sm font-medium text-[#BE1E2D] hover:underline">
              View all →
            </button>
          </div>

          {feedLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="rounded-2xl bg-[#f4f4f4] animate-pulse aspect-[3/4]" />)}
            </div>
          ) : genericItems.length === 0 ? (
            <div className="text-center py-16 text-[#979797]">
              <Package size={40} strokeWidth={1.5} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No listings yet — be the first to sell something!</p>
              <button onClick={() => router.push('/sell/new')} className="mt-4 px-5 py-2 bg-[#BE1E2D] text-white text-sm font-semibold rounded-full hover:bg-[#9B1824] transition">
                + List an item
              </button>
            </div>
          ) : (
            <ItemGrid items={genericItems} />
          )}
        </section>

      </div>
    </div>
  );
}
