'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Heart, Package, ShoppingCart, Check, Trash2 } from 'lucide-react';
import { useCart } from '@/lib/cart';

type WishlistEntry = {
  listing_id: string;
  price_at_save: number;
  created_at: string;
  listings: {
    id: string;
    title: string;
    category: string;
    price_cents: number;
    images: string[];
    size: string | null;
    status: string;
    seller_id: string;
  } | null;
};

export default function WishlistPage() {
  const router = useRouter();
  const { add, has } = useCart();
  const [items, setItems] = useState<WishlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/'); return; }
      loadWishlist(session.access_token);
    });
  }, []);

  async function loadWishlist(token: string) {
    setLoading(true);
    const res = await fetch('/api/wishlist', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const json = await res.json();
      setItems(json.items ?? []);
    }
    setLoading(false);
  }

  async function remove(listingId: string) {
    setRemoving(listingId);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch(`/api/wishlist/${listingId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    setItems(prev => prev.filter(i => i.listing_id !== listingId));
    setRemoving(null);
  }

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <p className="text-[#979797]">Loading your wishlist...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-6 py-8">

        <div className="flex items-center gap-3 mb-8">
          <Heart size={24} className="text-[#BE1E2D]" fill="#BE1E2D" />
          <h1 className="text-2xl font-bold text-[#111]">My Wishlist</h1>
          {items.length > 0 && (
            <span className="ml-1 text-sm text-[#979797]">({items.length} item{items.length !== 1 ? 's' : ''})</span>
          )}
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Heart size={48} strokeWidth={1.5} className="text-[#dedede] mb-4" />
            <p className="text-[#111] font-semibold text-lg">Your wishlist is empty</p>
            <p className="text-[#979797] text-sm mt-1 mb-6">Heart items you like while browsing and they'll appear here.</p>
            <button
              onClick={() => router.push('/browse')}
              className="px-6 py-2.5 bg-[#BE1E2D] hover:bg-[#9B1824] text-white rounded-full text-sm font-medium transition"
            >
              Browse listings
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map(entry => {
              const listing = entry.listings;
              if (!listing) return null;

              const priceDrop = listing.price_cents < entry.price_at_save;
              const isSold = listing.status !== 'ACTIVE';

              return (
                <div
                  key={entry.listing_id}
                  className={`bg-white border rounded-2xl overflow-hidden transition group ${
                    isSold ? 'border-[#dedede] opacity-60' : 'border-[#dedede] hover:shadow-md hover:border-[#BE1E2D]/40'
                  }`}
                >
                  {/* Image */}
                  <div
                    className="aspect-square bg-[#f4f4f4] overflow-hidden relative cursor-pointer"
                    onClick={() => !isSold && router.push(`/item/${listing.id}`)}
                  >
                    {listing.images?.[0] ? (
                      <img
                        src={listing.images[0]}
                        alt={listing.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package size={32} strokeWidth={1.5} className="text-[#dedede]" />
                      </div>
                    )}
                    {isSold && (
                      <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                        <span className="bg-[#111] text-white text-xs font-bold px-3 py-1 rounded-full">Sold</span>
                      </div>
                    )}
                    {priceDrop && !isSold && (
                      <div className="absolute top-2 left-2 bg-[#BE1E2D] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Price drop!
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="p-3">
                    <p className="text-xs text-[#979797] mb-0.5">{listing.category}</p>
                    <h3
                      className="text-sm font-medium text-[#111] line-clamp-2 leading-snug mb-2 cursor-pointer hover:text-[#BE1E2D] transition"
                      onClick={() => !isSold && router.push(`/item/${listing.id}`)}
                    >
                      {listing.title}
                    </h3>

                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-base font-bold text-[#BE1E2D]">
                        R{(listing.price_cents / 100).toLocaleString()}
                      </span>
                      {priceDrop && (
                        <span className="text-xs text-[#979797] line-through">
                          R{(entry.price_at_save / 100).toLocaleString()}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {!isSold && (
                        has(listing.id) ? (
                          <button
                            onClick={() => router.push('/cart')}
                            className="flex-1 flex items-center justify-center gap-1 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-full transition"
                          >
                            <Check size={12} strokeWidth={2.5} /> In cart
                          </button>
                        ) : (
                          <button
                            onClick={() => add({
                              listingId: listing.id,
                              title: listing.title,
                              price_cents: listing.price_cents,
                              image: listing.images?.[0] ?? null,
                              sellerId: listing.seller_id,
                              category: listing.category,
                              size: listing.size,
                            })}
                            className="flex-1 flex items-center justify-center gap-1 py-2 bg-[#BE1E2D] hover:bg-[#9B1824] text-white text-xs font-medium rounded-full transition"
                          >
                            <ShoppingCart size={12} strokeWidth={2} /> Add to cart
                          </button>
                        )
                      )}
                      <button
                        onClick={() => remove(entry.listing_id)}
                        disabled={removing === entry.listing_id}
                        className="p-2 border border-[#dedede] hover:border-red-300 hover:text-red-400 text-[#979797] rounded-full transition"
                        title="Remove from wishlist"
                      >
                        <Trash2 size={13} strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
