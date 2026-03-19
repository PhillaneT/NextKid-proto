'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

type Item = {
  id: string;
  title: string;
  category: string;
  price: number;
  description_part1: string | null;
  images: string[];
  created_at: string;
};

const CATEGORIES = [
  'All',
  'Electronics',
  'Fashion',
  'Home & Garden',
  'Sports',
  'Other'
];

export default function BrowsePage() {
  const [isAgeVerified, setIsAgeVerified] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const router = useRouter();

  useEffect(() => {
    fetchItems();
  }, [selectedCategory]);

  async function fetchItems() {
    setLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
    const { data: profile } = await supabase.from('profiles').select('is_age_verified').eq('id', user.id).single();
    setIsAgeVerified(profile?.is_age_verified || false);
    }

    let query = supabase.from('items').select('*').order('created_at', { ascending: false });

    if (selectedCategory !== 'All') {
      query = query.eq('category', selectedCategory);
    }

    const { data, error } = await query;

    if (error) console.error(error);
    else setItems(data || []);
    
    setLoading(false);
  }

    return (
        <div className="min-h-screen bg-[#0a0a0a]">
            <div className="py-12">
                <div className="max-w-6xl mx-auto px-6">
                    <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-white mb-6 flex items-center gap-2">
                    ← Back to Dashboard
                    </button>

                    <h1 className="text-4xl font-bold text-white mb-2">Browse Listings</h1>
                    <p className="text-gray-400 mb-8">Discover items from sellers</p>

                    {/* Category Filters */}
                    <div className="flex flex-wrap gap-3 mb-10">
                    {CATEGORIES.map((cat) => (
                        <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-6 py-2 rounded-full text-sm font-medium transition ${
                            selectedCategory === cat 
                            ? 'bg-violet-600 text-white' 
                            : 'bg-[#111] text-gray-400 hover:bg-[#1a1a1a]'
                        }`}
                        >
                        {cat}
                        </button>
                    ))}
                    </div>

                    {loading ? (
                    <p className="text-gray-400">Loading listings...</p>
                    ) : items.length === 0 ? (
                    <p className="text-gray-400 text-center py-20">No listings found in this category.</p>
                    ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                        {items.map((item) => (
                        <div
                            key={item.id}
                            onClick={() => router.push(`/item/${item.id}`)}
                            className="bg-[#111] border border-[#222] rounded-3xl overflow-hidden hover:border-violet-500 transition cursor-pointer group"
                        >
                            {/* Image Thumbnail */}
                            <div className="h-56 bg-[#1a1a1a] relative">
                            {item.images && item.images.length > 0 ? (
                                <img 
                                src={item.images[0]} 
                                alt={item.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-6xl text-gray-600">
                                📦
                                </div>
                            )}
                            </div>

                            <div className="p-6">
                            <div className="text-xs uppercase tracking-widest text-violet-400 mb-1">
                                {item.category}
                            </div>
                            <h3 className="font-semibold text-white text-lg line-clamp-2 mb-3">
                                {item.title}
                            </h3>
                            <div className="text-2xl font-bold text-white">
                                R{(item.price / 100).toLocaleString()}
                            </div>
                            </div>
                        </div>
                        ))}
                    </div>
                 )}
             </div>
         </div>
    </div>
  );
}