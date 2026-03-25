'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import {
  X, Shirt, Trophy, Footprints, Dumbbell, BookOpen, ShoppingBag, Package,
  School, CheckCircle2,
} from 'lucide-react';
import {
  ALL_CATEGORIES, SCHOOL_SPECIFIC_CATEGORIES, SUBCATEGORIES,
  LISTING_CONDITIONS, CLOTHING_SIZES, SHOE_SIZES, GRADES, SA_PROVINCES,
} from '@nextkid/shared';
import type { ListingCategory, School as SchoolType } from '@nextkid/shared';

type Step = 1 | 2 | 3 | 4;

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  'School Uniforms': <Shirt size={22} strokeWidth={2} />,
  'School Sports Kit': <Trophy size={22} strokeWidth={2} />,
  'Shoes': <Footprints size={22} strokeWidth={2} />,
  'Sports Equipment': <Dumbbell size={22} strokeWidth={2} />,
  'Books & Stationery': <BookOpen size={22} strokeWidth={2} />,
  'Bags & Accessories': <ShoppingBag size={22} strokeWidth={2} />,
  'Other': <Package size={22} strokeWidth={2} />,
};

const inputCls = 'w-full bg-[#f4f4f4] border border-[#dedede] rounded-xl px-4 py-3 text-[#111] focus:outline-none focus:border-[#4757bf] transition placeholder-[#979797]';
const labelCls = 'block text-sm text-[#979797] mb-2 font-medium';

// RULE: Only show fields relevant to the chosen category — never ask pointless questions
const CATEGORY_FIELDS: Record<string, { clothingSize?: true; shoeSize?: true; gender?: true; grade?: true; dimensions?: true }> = {
  'School Uniforms':    { clothingSize: true, gender: true, grade: true },
  'School Sports Kit':  { clothingSize: true, gender: true },
  'Shoes':              { shoeSize: true },
  'Sports Equipment':   {},
  'Books & Stationery': { grade: true },
  'Bags & Accessories': { dimensions: true },
  'Other':              {},
};

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
  const [schools, setSchools] = useState<SchoolType[]>([]);
  const [schoolSearch, setSchoolSearch] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<SchoolType | null>(null);
  const [loadingSchools, setLoadingSchools] = useState(false);

  // Profile schools — pre-loaded from user's saved schools to skip/simplify step 2
  const [profileSchools, setProfileSchools] = useState<SchoolType[]>([]);

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

  // Load user's saved schools from their profile on mount
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: prof } = await supabase.from('profiles').select('school_ids, province').eq('id', user.id).single();
      if (prof?.province) setProvince(prof.province);
      if (prof?.school_ids?.length) {
        const { data: saved } = await supabase.from('schools').select('*').in('id', prof.school_ids).order('name');
        setProfileSchools((saved as SchoolType[]) ?? []);
      }
    });
  }, []);

  useEffect(() => {
    if (!province) { setSchools([]); return; }
    setLoadingSchools(true);
    supabase.from('schools').select('*').eq('province', province).order('name')
      .then(({ data }) => { setSchools((data as SchoolType[]) ?? []); setLoadingSchools(false); });
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
    if (step === 1 && !isSchoolSpecific) { setStep(3); return; }
    if (step === 1 && isSchoolSpecific) {
      // Auto-select if user has exactly one saved school — skip step 2
      if (profileSchools.length === 1) {
        setSelectedSchool(profileSchools[0]);
        setStep(3);
        return;
      }
      setStep(2); return;
    }
    if (step < 4) setStep((step + 1) as Step);
  };

  const prevStep = () => {
    if (step === 3 && !isSchoolSpecific) { setStep(1); return; }
    // If step 2 was skipped (single profile school), go back to step 1
    if (step === 3 && isSchoolSpecific && profileSchools.length === 1) { setStep(1); return; }
    if (step > 1) setStep((step - 1) as Step);
  };

  const filteredSchools = schools.filter(s => s.name.toLowerCase().includes(schoolSearch.toLowerCase()));
  const TOTAL_STEPS = isSchoolSpecific ? 4 : 3;
  const currentStep = step === 1 ? 1 : step === 2 ? 2 : isSchoolSpecific ? step : step - 1;

  if (showSuccess) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <CheckCircle2 size={64} className="text-[#4757bf] mx-auto mb-6" strokeWidth={2} />
        <h2 className="text-3xl font-bold text-[#111] mb-4">Listing Created!</h2>
        <p className="text-[#979797] mb-10">Your item is now live on NextKid.</p>
        <div className="flex gap-4 justify-center">
          <button onClick={() => router.push('/browse')} className="bg-[#4757bf] hover:bg-[#3a48a8] text-white px-8 py-3 rounded-full font-medium transition">View in Browse</button>
          <button onClick={() => router.push('/dashboard')} className="border border-[#dedede] text-[#111] hover:bg-[#f4f4f4] px-8 py-3 rounded-full font-medium transition">Dashboard</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <button onClick={() => router.back()} className="text-[#979797] hover:text-[#111] mb-6 flex items-center gap-2 text-sm transition">← Back</button>
        <h1 className="text-3xl font-bold text-[#111] mb-2">Create Listing</h1>

        {/* Progress bar */}
        <div className="flex gap-2 mb-8">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} className={`flex-1 h-1 rounded-full transition-colors ${i < currentStep ? 'bg-[#4757bf]' : 'bg-[#dedede]'}`} />
          ))}
        </div>

        <div className="bg-white border border-[#dedede] rounded-2xl p-8 space-y-6 shadow-sm">

          {/* Step 1 — Category */}
          {step === 1 && <>
            <div>
              <h2 className="text-[#111] font-semibold text-lg mb-1">What are you selling?</h2>
              <p className="text-[#979797] text-sm mb-6">Choose the category that best fits your item.</p>
              <div className="grid grid-cols-2 gap-3">
                {ALL_CATEGORIES.map(cat => (
                  <button key={cat} type="button" onClick={() => setCategory(cat)}
                    className={`p-4 rounded-xl border-2 text-left transition flex items-start gap-3 ${
                      category === cat
                        ? 'border-[#4757bf] bg-[#eef0fb]'
                        : 'border-[#dedede] bg-white hover:border-[#4757bf]/40'
                    }`}>
                    <span className={`mt-0.5 ${category === cat ? 'text-[#4757bf]' : 'text-[#979797]'}`}>
                      {CATEGORY_ICON[cat] ?? <Package size={22} strokeWidth={2} />}
                    </span>
                    <div>
                      <span className="text-[#111] text-sm font-medium block">{cat}</span>
                      {SCHOOL_SPECIFIC_CATEGORIES.includes(cat as typeof SCHOOL_SPECIFIC_CATEGORIES[number]) && (
                        <span className="text-[#4757bf] text-xs block mt-0.5">School-specific</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <button disabled={!category} onClick={nextStep}
              className="w-full py-3 rounded-full bg-[#4757bf] disabled:bg-[#dedede] disabled:text-[#979797] text-white font-semibold transition">
              Continue →
            </button>
          </>}

          {/* Step 2 — School picker (school-specific only) */}
          {step === 2 && isSchoolSpecific && <>
            <div>
              <h2 className="text-[#111] font-semibold text-lg mb-1">Which school is this for?</h2>
              <p className="text-[#979797] text-sm mb-6">
                {profileSchools.length > 0
                  ? 'Select which of your schools this item belongs to.'
                  : 'Uniform and sports kit listings are linked to a specific school so the right buyers see them.'}
              </p>

              {profileSchools.length > 0 ? (
                /* User has saved schools — show them as simple cards */
                <div className="space-y-3">
                  {profileSchools.map(school => (
                    <button key={school.id} type="button" onClick={() => setSelectedSchool(school)}
                      className={`w-full p-4 rounded-xl border-2 text-left flex items-center justify-between transition ${
                        selectedSchool?.id === school.id
                          ? 'border-[#4757bf] bg-[#eef0fb]'
                          : 'border-[#dedede] bg-white hover:border-[#4757bf]/40'
                      }`}>
                      <div className="flex items-center gap-3">
                        <School size={18} className={selectedSchool?.id === school.id ? 'text-[#4757bf]' : 'text-[#979797]'} />
                        <div>
                          <p className="text-[#111] text-sm font-medium">{school.name}</p>
                          <p className="text-[#979797] text-xs">{school.city}</p>
                        </div>
                      </div>
                      {selectedSchool?.id === school.id && <CheckCircle2 size={18} className="text-[#4757bf] shrink-0" />}
                    </button>
                  ))}
                  <p className="text-xs text-[#979797] pt-1">
                    Wrong school?{' '}
                    <button type="button" onClick={() => setProfileSchools([])} className="text-[#4757bf] underline">Search all schools instead</button>
                  </p>
                </div>
              ) : (
                /* No saved schools — full province + search flow */
                <>
                  <label className={labelCls}>Province</label>
                  <select className={`${inputCls} mb-4`} value={province} onChange={e => { setProvince(e.target.value); setSchoolSearch(''); setSelectedSchool(null); }}>
                    <option value="">Select province...</option>
                    {SA_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>

                  {province && <>
                    <label className={labelCls}>Search school</label>
                    <input className={`${inputCls} mb-3`} value={schoolSearch} onChange={e => setSchoolSearch(e.target.value)} placeholder="Type school name..." />
                    <div className="border border-[#dedede] rounded-xl overflow-hidden max-h-52 overflow-y-auto mb-4">
                      {loadingSchools
                        ? <p className="text-[#979797] p-4 text-center text-sm">Loading...</p>
                        : filteredSchools.length === 0
                          ? <p className="text-[#979797] p-4 text-center text-sm">No schools found.</p>
                          : filteredSchools.map(school => (
                            <div key={school.id} onClick={() => setSelectedSchool(school)}
                              className={`p-3 cursor-pointer flex justify-between items-center border-b border-[#dedede] ${
                                selectedSchool?.id === school.id ? 'bg-[#eef0fb]' : 'hover:bg-[#f4f4f4]'
                              }`}>
                              <div>
                                <p className="text-[#111] text-sm">{school.name}</p>
                                <p className="text-[#979797] text-xs">{school.city} · {school.type}</p>
                              </div>
                              {selectedSchool?.id === school.id && <CheckCircle2 size={16} className="text-[#4757bf]" />}
                            </div>
                          ))
                      }
                    </div>
                  </>}

                  {selectedSchool && (
                    <div className="bg-[#eef0fb] border border-[#4757bf]/30 rounded-xl p-3 flex justify-between items-center">
                      <span className="text-[#4757bf] text-sm flex items-center gap-2">
                        <School size={14} /> {selectedSchool.name}
                      </span>
                      <button onClick={() => setSelectedSchool(null)} className="text-[#979797] hover:text-[#111]"><X size={14} /></button>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={prevStep} className="flex-1 py-3 rounded-full border border-[#dedede] text-[#979797] hover:bg-[#f4f4f4] transition">← Back</button>
              <button onClick={nextStep} disabled={!selectedSchool}
                className="flex-grow py-3 rounded-full bg-[#4757bf] disabled:bg-[#dedede] disabled:text-[#979797] text-white font-semibold transition">
                Continue →
              </button>
            </div>
          </>}

          {/* Step 3 — Item details */}
          {step === 3 && <>
            <h2 className="text-[#111] font-semibold text-lg mb-4">Item details</h2>

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

            {/* Context-aware fields — only show what makes sense for the chosen category */}
            {(() => {
              const fields = CATEGORY_FIELDS[category] ?? {};
              return (
                <>
                  {(fields.clothingSize || fields.gender) && (
                    <div className="grid grid-cols-2 gap-4">
                      {fields.clothingSize && (
                        <div>
                          <label className={labelCls}>Clothing Size</label>
                          <select className={inputCls} value={form.size} onChange={e => setForm({ ...form, size: e.target.value })}>
                            <option value="">Select size...</option>
                            {CLOTHING_SIZES.map(s => <option key={s}>{s}</option>)}
                          </select>
                        </div>
                      )}
                      {fields.gender && (
                        <div>
                          <label className={labelCls}>Gender</label>
                          <select className={inputCls} value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value as typeof form.gender })}>
                            <option value="">Select...</option>
                            <option value="boys">Boys</option>
                            <option value="girls">Girls</option>
                            <option value="unisex">Unisex</option>
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                  {fields.shoeSize && (
                    <div>
                      <label className={labelCls}>Shoe Size</label>
                      <select className={inputCls} value={form.size} onChange={e => setForm({ ...form, size: e.target.value })}>
                        <option value="">Select size...</option>
                        {SHOE_SIZES.map(s => <option key={s} value={String(s)}>{s}</option>)}
                      </select>
                    </div>
                  )}
                  {fields.dimensions && (
                    <div>
                      <label className={labelCls}>Dimensions / Capacity</label>
                      <input className={inputCls} value={form.size} onChange={e => setForm({ ...form, size: e.target.value })}
                        placeholder="e.g. 42L, 30×20×10 cm" />
                    </div>
                  )}
                  {fields.grade && (
                    <div>
                      <label className={labelCls}>Grade</label>
                      <select className={inputCls} value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })}>
                        <option value="">Select grade...</option>
                        {GRADES.map(g => <option key={g} value={g}>Grade {g}</option>)}
                      </select>
                    </div>
                  )}
                </>
              );
            })()}

            <div>
              <label className={labelCls}>Price (Rands)</label>
              <input type="number" className={inputCls} value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="250" />
            </div>

            <div>
              <label className={labelCls}>Description</label>
              <textarea className={`${inputCls} h-28 resize-none`} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Describe the item — condition, why you're selling, any defects..." />
            </div>

            <div className="flex gap-3">
              <button onClick={prevStep} className="flex-1 py-3 rounded-full border border-[#dedede] text-[#979797] hover:bg-[#f4f4f4] transition">← Back</button>
              <button onClick={nextStep} disabled={!form.title || !form.price}
                className="flex-grow py-3 rounded-full bg-[#4757bf] disabled:bg-[#dedede] disabled:text-[#979797] text-white font-semibold transition">
                Continue →
              </button>
            </div>
          </>}

          {/* Step 4 — Photos & publish */}
          {step === 4 && <>
            <h2 className="text-[#111] font-semibold text-lg mb-4">Add photos</h2>

            <div className="border-2 border-dashed border-[#dedede] rounded-xl p-10 text-center hover:border-[#4757bf]/40 transition">
              <input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" id="upload" />
              <label htmlFor="upload" className="cursor-pointer">
                <Package size={32} className="text-[#979797] mx-auto mb-3" strokeWidth={2} />
                <p className="text-[#979797] mb-3 text-sm">Drag photos here or</p>
                <span className="bg-[#4757bf] hover:bg-[#3a48a8] px-6 py-2 rounded-full text-white text-sm font-medium transition">
                  {uploading ? 'Uploading...' : 'Select Photos'}
                </span>
              </label>
            </div>

            {imagePreviews.length > 0 && (
              <div className="flex gap-3 flex-wrap mt-2">
                {imagePreviews.map((src, i) => (
                  <div key={i} className="relative">
                    <img src={src} className="w-20 h-20 object-cover rounded-xl border border-[#dedede]" alt="" />
                    <button type="button" onClick={() => removeImage(i)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"><X size={14} /></button>
                  </div>
                ))}
              </div>
            )}

            {error && <p className="text-red-500 text-sm">{error}</p>}

            {/* Summary */}
            <div className="bg-[#f4f4f4] border border-[#dedede] rounded-xl p-4 text-sm space-y-1.5">
              <p className="text-[#979797]">Category: <span className="text-[#111] font-medium">{category}</span></p>
              {selectedSchool && <p className="text-[#979797]">School: <span className="text-[#111] font-medium">{selectedSchool.name}</span></p>}
              <p className="text-[#979797]">Title: <span className="text-[#111] font-medium">{form.title}</span></p>
              <p className="text-[#979797]">Price: <span className="text-[#4757bf] font-bold">R{form.price}</span></p>
              {form.size && <p className="text-[#979797]">Size: <span className="text-[#111] font-medium">{form.size}</span></p>}
            </div>

            <div className="flex gap-3">
              <button onClick={prevStep} className="flex-1 py-3 rounded-full border border-[#dedede] text-[#979797] hover:bg-[#f4f4f4] transition">← Back</button>
              <button onClick={handleSubmit} disabled={loading || uploading}
                className="flex-grow py-3 rounded-full bg-[#4757bf] hover:bg-[#3a48a8] disabled:bg-[#dedede] disabled:text-[#979797] text-white font-semibold transition">
                {loading ? 'Publishing...' : 'Publish Listing'}
              </button>
            </div>
          </>}
        </div>
      </div>
    </div>
  );
}
