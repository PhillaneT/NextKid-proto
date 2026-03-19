'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

export default function NewListingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);

  const [form, setForm] = useState({
    title: '',
    category: 'Electronics',
    price: '',
    listing_type: 'buy_now',
    auction_days: '3',
    part1: '',
    part2: '',
    part3: '',
    part4: '',
    part5: '',
  });

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    setUploading(true);
    const newPreviews: string[] = [];
    const newUrls: string[] = [];
    for (const file of files) {
      const preview = URL.createObjectURL(file);
      newPreviews.push(preview);
      const fileName = `items/${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
      const { error } = await supabase.storage.from('item-images').upload(fileName, file);
      if (!error) {
        const { data: urlData } = supabase.storage.from('item-images').getPublicUrl(fileName);
        newUrls.push(urlData.publicUrl);
      }
    }
    setImagePreviews(prev => [...prev, ...newPreviews]);
    setImageUrls(prev => [...prev, ...newUrls]);
    setUploading(false);
  };

  const removeImage = (index: number) => {
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    setImageUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const auctionEndsAt = form.listing_type === 'best_bids'
      ? new Date(Date.now() + parseInt(form.auction_days) * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { error } = await supabase.from('items').insert({
      seller_id: user.id,
      title: form.title,
      category: form.category,
      price: parseInt(form.price) * 100 || 0,
      listing_type: form.listing_type,
      auction_ends_at: auctionEndsAt,
      description_part1: form.part1 || null,
      description_part2: form.part2 || null,
      description_part3: form.part3 || null,
      description_part4: form.part4 || null,
      description_part5: form.part5 || null,
      images: imageUrls,
    });

    if (error) alert('Error: ' + error.message);
    else setShowSuccess(true);

    setLoading(false);
  };

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-6">🎉</div>
          <h2 className="text-3xl font-bold text-white mb-4">Listing Created Successfully!</h2>
          <p className="text-gray-400 mb-10">Your item is now live on the marketplace.</p>
          <div className="flex gap-4 justify-center">
            <button onClick={() => router.push('/browse')} className="bg-white text-black px-8 py-3 rounded-2xl font-medium">View in Browse</button>
            <button onClick={() => router.push('/dashboard')} className="border border-gray-600 text-white px-8 py-3 rounded-2xl font-medium">Back to Dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  const LISTING_TYPES = [
    { value: 'buy_now', label: 'Buy Now', emoji: '⚡', desc: 'Fixed price, instant purchase' },
    { value: 'make_offer', label: 'Make Offer', emoji: '🤝', desc: 'Buyers propose their own price' },
    { value: 'best_bids', label: 'Best Bids', emoji: '🏆', desc: 'Auction — highest bid wins' },
  ];

    return (
        <div className="min-h-screen bg-[#0a0a0a]">
        <div className="py-12">
        <div className="max-w-3xl mx-auto px-6">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white mb-6 flex items-center gap-2">← Back</button>
        <h1 className="text-4xl font-bold text-white mb-8">Create New Listing</h1>

        <form onSubmit={handleSubmit} className="bg-[#111] border border-[#222] rounded-3xl p-10 space-y-10">

          {/* Listing Type */}
          <div>
            <label className="block text-sm text-gray-400 mb-4">Listing Type</label>
            <div className="grid grid-cols-3 gap-4">
              {LISTING_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setForm({ ...form, listing_type: type.value })}
                  className={`p-5 rounded-2xl border-2 text-left transition ${
                    form.listing_type === type.value
                      ? 'border-violet-500 bg-violet-500/10'
                      : 'border-[#333] bg-[#1a1a1a] hover:border-[#555]'
                  }`}
                >
                  <div className="text-2xl mb-2">{type.emoji}</div>
                  <div className="text-white font-medium text-sm">{type.label}</div>
                  <div className="text-gray-400 text-xs mt-1">{type.desc}</div>
                </button>
              ))}
            </div>

            {form.listing_type === 'best_bids' && (
              <div className="mt-4">
                <label className="block text-sm text-gray-400 mb-2">Auction Duration</label>
                <select
                  value={form.auction_days}
                  onChange={(e) => setForm({ ...form, auction_days: e.target.value })}
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-2xl px-5 py-4 text-white"
                >
                  <option value="1">1 day</option>
                  <option value="3">3 days</option>
                  <option value="7">7 days</option>
                  <option value="14">14 days</option>
                </select>
              </div>
            )}
          </div>

          {/* Title, Category, Price */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-400 mb-2">Title</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-2xl px-5 py-4 text-white" placeholder="Product title" required />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-2xl px-5 py-4 text-white">
                <option>Electronics</option>
                <option>Fashion</option>
                <option>Home & Garden</option>
                <option>Sports</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                {form.listing_type === 'best_bids' ? 'Starting Price (Rands)' : 'Price (Rands)'}
              </label>
              <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-2xl px-5 py-4 text-white" placeholder="700" required />
            </div>
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm text-gray-400 mb-3">Photos</label>
            <div className="border-2 border-dashed border-[#444] rounded-3xl p-12 text-center">
              <input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" id="upload" />
              <label htmlFor="upload" className="bg-violet-600 hover:bg-violet-700 px-10 py-3 rounded-2xl text-white cursor-pointer">
                {uploading ? 'Uploading...' : 'Select Images'}
              </label>
            </div>
            {imagePreviews.length > 0 && (
              <div className="mt-6 flex gap-4 flex-wrap">
                {imagePreviews.map((src, i) => (
                  <div key={i} className="relative">
                    <img src={src} className="w-24 h-24 object-cover rounded-xl border border-[#333]" />
                    <button type="button" onClick={() => removeImage(i)} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1">
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 5 Part Description */}
          <div className="space-y-6">
            {['part1', 'part2', 'part3', 'part4', 'part5'].map((key, i) => (
              <div key={key}>
                <label className="text-sm text-gray-400 mb-1 block">
                  {i + 1}. {['Condition', 'Key Features', "Why I'm Selling", 'Specifications', 'Additional Info'][i]}
                </label>
                <textarea
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full h-28 bg-[#1a1a1a] border border-[#333] rounded-2xl px-5 py-4 text-white"
                />
              </div>
            ))}
          </div>

          <button type="submit" disabled={loading || uploading}
            className="w-full py-4 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-600 text-white font-medium rounded-2xl">
            {loading ? 'Creating Listing...' : 'Create & Publish Listing'}
          </button>
        </form>
      </div>
      </div>
    </div>
  );
}