'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import {
  ALL_CATEGORIES, SCHOOL_SPECIFIC_CATEGORIES, SUBCATEGORIES,
  CATEGORY_EMOJI, LISTING_CONDITIONS, CLOTHING_SIZES, SHOE_SIZES, GRADES, SA_PROVINCES,
} from '@nextkid/shared';
import type { ListingCategory, School } from '@nextkid/shared';

type Step = 1 | 2 | 3 | 4;

const inputCls = 'w-full bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500';
const labelCls = 'block text-sm text-gray-400 mb-2';

export default function NewListingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');

  // Step 1 — category
  const [category, setCategory] = useState<ListingCategory | ''>('');
  const isSchoolSpecific = SCHOOL_SPECIFIC_CATEGORIES.includes(category as typeof SCHOOL_SPECIFIC_CATEGORIES[number]);

  // Step 2 — school picker (only for school-specific categories)
  const [province, setProvince] = useState('');
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolSearch, setSchoolSearch] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [loadingSchools, setLoadingSchools] = useState(false);

  // Step 3 — details
  const [form, setForm] = useState({
    title: '',
    subcategory: '',
    price: '',
    condition: 'good' as typeof LISTING_CONDITIONS[number],
    size: '',
    gender: '' as 'boys' | 'girls' | 'unisex' | '',
    grade: '' as string,
    description: '',
    listing_type: 'buy_now',
  });

  // Load schools when province changes
  useEffect(() => {
    if (!province) { setSchools([]); return; }
    setLoadingSchools(true);
    supabase.from('schools').select('*').eq('province', province).order('name')
      .then(({ data }) => { setSchools((data as School[]) ?? []); setLoadingSchools(false); });
  }, [province]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    setUploading(true);
    const newPreviews: string[] = [];
    const newUrls: string[] = [];
    for (const file of files) {
      newPreviews.push(URL.createObjectURL(file));
      const fileName = `items/${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
      const { error: uploadError } = await supabase.storage.from('item-images').upload(fileName, file);
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('item-images').getPublicUrl(fileName);
        newUrls.push(urlData.publicUrl);
      }
    }
    setImagePreviews(prev => [...prev, ...newPreviews]);
    setImageUrls(prev => [...prev, ...newUrls]);
    setUploading(false);
  };

  const removeImage = (i: number) => {
    setImagePreviews(prev => prev.filter((_, idx) => idx !== i));
    setImageUrls(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async () => {
    setError('');
    if (!form.title || !form.price) { setError('Title and price are required.'); return; }
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error: insertError } = await supabase.from('items').insert({
      seller_id: user.id,
      title: form.title,
      category,
      subcategory: form.subcategory || null,
      price: Math.round(parseFloat(form.price) * 100),
      condition: form.condition,
      listing_type: form.listing_type,
      is_school_specific: isSchoolSpecific,
      school_id: selectedSchool?.id ?? null,
      size: form.size || null,
      gender: form.gender || null,
      grade: form.grade ? parseInt(form.grade) : null,
      description_part1: form.description || null,
      images: imageUrls,
    });

    if (insertError) { setError('Error: ' + insertError.message); setLoading(false); return; }
    setShowSuccess(true);
    setLoading(false);
  };

  const nextStep = () => {
    if (step === 1 && !category) return;
    // Skip step 2 (school picker) if not school-specific
    if (step === 1 && !isSchoolSpecific) { setStep(3); return; }
    if (step < 4) setStep((step + 1) as Step);
  };

  const prevStep = () => {
    if (step === 3 && !isSchoolSpecific) { setStep(1); return; }
    if (step > 1) setStep((step - 1) as Step);
  };

  const filteredSchools = schools.filter(s => s.name.toLowerCase().includes(schoolSearch.toLowerCase()));
  const TOTAL_STEPS = isSchoolSpecific ? 4 : 3;
  const currentStep = step === 1 ? 1 : step === 2 ? 2 : isSchoolSpecific ? step : step - 1;

  if (showSuccess) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-6">🎉</div>
        <h2 className="text-3xl font-bold text-white mb-4">Listing Created!</h2>
        <p className="text-gray-400 mb-10">Your item is now live on NextKid.</p>
        <div className="flex gap-4 justify-center">
          <button onClick={() => router.push('/browse')} className="bg-violet-600 text-white px-8 py-3 rounded-xl font-medium">View in Browse</button>
          <button onClick={() => router.push('/dashboard')} className="border border-gray-600 text-white px-8 py-3 rounded-xl font-medium">Dashboard</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white mb-6 flex items-center gap-2">← Back</button>
        <h1 className="text-3xl font-bold text-white mb-2">Create Listing</h1>

        {/* Progress bar */}
        <div className="flex gap-2 mb-8">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} className={`flex-1 h-1 rounded-full ${i < currentStep ? 'bg-violet-600' : 'bg-[#222]'}`} />
          ))}
        </div>

        <div className="bg-[#111] border border-[#222] rounded-2xl p-8 space-y-6">

          {/* Step 1 — Category */}
          {step === 1 && <>
            <div>
              <h2 className="text-white font-semibold text-lg mb-1">What are you selling?</h2>
              <p className="text-gray-500 text-sm mb-6">Choose the category that best fits your item.</p>
              <div className="grid grid-cols-2 gap-3">
                {ALL_CATEGORIES.map(cat => (
                  <button key={cat} type="button" onClick={() => setCategory(cat)}
                    className={`p-4 rounded-xl border-2 text-left transition ${category === cat ? 'border-violet-500 bg-violet-500/10' : 'border-[#333] bg-[#1a1a1a] hover:border-[#555]'}`}>
                    <span className="text-2xl block mb-1">{CATEGORY_EMOJI[cat]}</span>
                    <span className="text-white text-sm font-medium">{cat}</span>
                    {SCHOOL_SPECIFIC_CATEGORIES.includes(cat as typeof SCHOOL_SPECIFIC_CATEGORIES[number]) && (
                      <span className="text-violet-400 text-xs block mt-0.5">School-specific</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <button disabled={!category} onClick={nextStep}
              className="w-full py-3 rounded-xl bg-violet-600 disabled:bg-[#333] disabled:text-gray-600 text-white font-semibold">
              Continue →
            </button>
          </>}

          {/* Step 2 — School picker (school-specific only) */}
          {step === 2 && isSchoolSpecific && <>
            <div>
              <h2 className="text-white font-semibold text-lg mb-1">Which school is this for?</h2>
              <p className="text-gray-500 text-sm mb-6">Uniform and sports kit listings are linked to a specific school so the right buyers see them.</p>

              <label className={labelCls}>Province</label>
              <select className={`${inputCls} mb-4`} value={province} onChange={e => { setProvince(e.target.value); setSchoolSearch(''); setSelectedSchool(null); }}>
                <option value="">Select province...</option>
                {SA_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>

              {province && <>
                <label className={labelCls}>Search school</label>
                <input className={`${inputCls} mb-3`} value={schoolSearch} onChange={e => setSchoolSearch(e.target.value)} placeholder="Type school name..." />
                <div className="border border-[#333] rounded-xl overflow-hidden max-h-52 overflow-y-auto mb-4">
                  {loadingSchools
                    ? <p className="text-gray-500 p-4 text-center text-sm">Loading...</p>
                    : filteredSchools.length === 0
                      ? <p className="text-gray-500 p-4 text-center text-sm">No schools found.</p>
                      : filteredSchools.map(school => (
                        <div key={school.id} onClick={() => setSelectedSchool(school)}
                          className={`p-3 cursor-pointer flex justify-between items-center border-b border-[#222] ${selectedSchool?.id === school.id ? 'bg-violet-900/30' : 'hover:bg-[#1a1a1a]'}`}>
                          <div>
                            <p className="text-white text-sm">{school.name}</p>
                            <p className="text-gray-500 text-xs">{school.city} · {school.type}</p>
                          </div>
                          {selectedSchool?.id === school.id && <span className="text-violet-400">✓</span>}
                        </div>
                      ))
                  }
                </div>
              </>}

              {selectedSchool && (
                <div className="bg-violet-900/20 border border-violet-700 rounded-xl p-3 flex justify-between items-center">
                  <span className="text-violet-300 text-sm">🏫 {selectedSchool.name}</span>
                  <button onClick={() => setSelectedSchool(null)} className="text-gray-500 hover:text-white"><X size={14} /></button>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={prevStep} className="flex-1 py-3 rounded-xl border border-[#333] text-gray-400 hover:bg-[#1a1a1a]">← Back</button>
              <button onClick={nextStep} disabled={!selectedSchool}
                className="flex-2 flex-grow py-3 rounded-xl bg-violet-600 disabled:bg-[#333] disabled:text-gray-600 text-white font-semibold">
                Continue →
              </button>
            </div>
          </>}

          {/* Step 3 — Item details */}
          {step === 3 && <>
            <h2 className="text-white font-semibold text-lg mb-4">Item details</h2>

            <div>
              <label className={labelCls}>Title</label>
              <input className={inputCls} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Grey flannel trousers size 32" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Subcategory</label>
                <select className={inputCls} value={form.subcategory} onChange={e => setForm({ ...form, subcategory: e.target.value })}>
                  <option value="">Select...</option>
                  {category && SUBCATEGORIES[category as ListingCategory].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Condition</label>
                <select className={inputCls} value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value as typeof LISTING_CONDITIONS[number] })}>
                  {LISTING_CONDITIONS.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Size</label>
                <select className={inputCls} value={form.size} onChange={e => setForm({ ...form, size: e.target.value })}>
                  <option value="">N/A</option>
                  <optgroup label="Clothing">
                    {CLOTHING_SIZES.map(s => <option key={s}>{s}</option>)}
                  </optgroup>
                  <optgroup label="Shoes">
                    {SHOE_SIZES.map(s => <option key={`shoe-${s}`} value={`Shoe ${s}`}>Shoe {s}</option>)}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className={labelCls}>Gender</label>
                <select className={inputCls} value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value as typeof form.gender })}>
                  <option value="">N/A</option>
                  <option value="boys">Boys</option>
                  <option value="girls">Girls</option>
                  <option value="unisex">Unisex</option>
                </select>
              </div>
            </div>

            {(category === 'Books & Stationery') && (
              <div>
                <label className={labelCls}>Grade</label>
                <select className={inputCls} value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })}>
                  <option value="">Select grade...</option>
                  {GRADES.map(g => <option key={g} value={g}>Grade {g}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className={labelCls}>Price (Rands)</label>
              <input type="number" className={inputCls} value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="250" />
            </div>

            <div>
              <label className={labelCls}>Description</label>
              <textarea className={`${inputCls} h-28 resize-none`} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Describe the item — condition, why you're selling, any defects..." />
            </div>

            <div className="flex gap-3">
              <button onClick={prevStep} className="flex-1 py-3 rounded-xl border border-[#333] text-gray-400 hover:bg-[#1a1a1a]">← Back</button>
              <button onClick={nextStep} disabled={!form.title || !form.price}
                className="flex-grow py-3 rounded-xl bg-violet-600 disabled:bg-[#333] disabled:text-gray-600 text-white font-semibold">
                Continue →
              </button>
            </div>
          </>}

          {/* Step 4 — Photos & publish */}
          {step === 4 && <>
            <h2 className="text-white font-semibold text-lg mb-4">Add photos</h2>

            <div className="border-2 border-dashed border-[#333] rounded-xl p-10 text-center">
              <input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" id="upload" />
              <label htmlFor="upload" className="cursor-pointer">
                <p className="text-gray-400 mb-3">Drag photos here or</p>
                <span className="bg-violet-600 hover:bg-violet-700 px-6 py-2 rounded-lg text-white text-sm">
                  {uploading ? 'Uploading...' : 'Select Photos'}
                </span>
              </label>
            </div>

            {imagePreviews.length > 0 && (
              <div className="flex gap-3 flex-wrap mt-2">
                {imagePreviews.map((src, i) => (
                  <div key={i} className="relative">
                    <img src={src} className="w-20 h-20 object-cover rounded-lg border border-[#333]" alt="" />
                    <button type="button" onClick={() => removeImage(i)} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-0.5"><X size={14} /></button>
                  </div>
                ))}
              </div>
            )}

            {error && <p className="text-red-400 text-sm">{error}</p>}

            {/* Summary */}
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 text-sm space-y-1">
              <p className="text-gray-400">Category: <span className="text-white">{category}</span></p>
              {selectedSchool && <p className="text-gray-400">School: <span className="text-white">{selectedSchool.name}</span></p>}
              <p className="text-gray-400">Title: <span className="text-white">{form.title}</span></p>
              <p className="text-gray-400">Price: <span className="text-white">R{form.price}</span></p>
              {form.size && <p className="text-gray-400">Size: <span className="text-white">{form.size}</span></p>}
            </div>

            <div className="flex gap-3">
              <button onClick={prevStep} className="flex-1 py-3 rounded-xl border border-[#333] text-gray-400 hover:bg-[#1a1a1a]">← Back</button>
              <button onClick={handleSubmit} disabled={loading || uploading}
                className="flex-grow py-3 rounded-xl bg-violet-600 disabled:bg-[#333] disabled:text-gray-600 text-white font-semibold">
                {loading ? 'Publishing...' : 'Publish Listing 🚀'}
              </button>
            </div>
          </>}
        </div>
      </div>
    </div>
  );
}
