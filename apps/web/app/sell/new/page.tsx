'use client';

import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import {
  X, Shirt, Trophy, Footprints, Dumbbell, BookOpen,
  ShoppingBag, Package, School, CheckCircle2, Truck, Box,
} from 'lucide-react';
import {
  ALL_CATEGORIES, SCHOOL_SPECIFIC_CATEGORIES, SUBCATEGORIES,
  SA_PROVINCES, SHOE_SIZE_GROUPS, SELLER_CONDITIONS,
  buildListingTitle,
  canFitInLocker, getLockerSizeForParcel,
  calculateBuyerPrice, fmtRands,
} from '@nextkid/shared';
import type { ListingCategory, School as SchoolType, ParcelDimensions, SellerShippingOption } from '@nextkid/shared';
import LockerMapPicker from '../../components/LockerMapPicker';
import type { SelectedLocker } from '../../components/LockerMapPicker';

// Steps: 1=Category, 2=School(optional), 3=Details, 4=Parcel+Shipping, 5=Photos+Publish
type Step = 1 | 2 | 3 | 4 | 5;

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  'School Uniforms':    <Shirt size={22} strokeWidth={2} />,
  'School Sports Kit':  <Trophy size={22} strokeWidth={2} />,
  'Shoes':              <Footprints size={22} strokeWidth={2} />,
  'Sports Equipment':   <Dumbbell size={22} strokeWidth={2} />,
  'Books & Stationery': <BookOpen size={22} strokeWidth={2} />,
  'Bags & Accessories': <ShoppingBag size={22} strokeWidth={2} />,
  'Other':              <Package size={22} strokeWidth={2} />,
};

const inputCls = 'w-full bg-[#f4f4f4] border border-[#dedede] rounded-xl px-4 py-3 text-[#111] focus:outline-none focus:border-[#BE1E2D] transition placeholder-[#979797]';
const labelCls = 'block text-sm text-[#979797] mb-2 font-medium';

const LOCKER_SIZE_LABELS: Record<string, string> = {
  'V4-XS': 'Extra Small',
  'V4-S':  'Small',
  'V4-M':  'Medium',
  'V4-L':  'Large',
  'V4-XL': 'Extra Large',
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
  // All three school-related categories have an optional school picker
  const isOptionalSchool = isSchoolSpecific || category === 'Books & Stationery';
  const showsSchoolStep = isOptionalSchool;

  // Step 2 — school picker (school-specific categories only)
  const [province, setProvince] = useState('');
  const [schools, setSchools] = useState<SchoolType[]>([]);
  const [schoolSearch, setSchoolSearch] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<SchoolType | null>(null);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [profileSchools, setProfileSchools] = useState<SchoolType[]>([]);

  // Step 3 — item details
  const [form, setForm] = useState({
    subcategory: '',
    condition: 'good' as typeof SELLER_CONDITIONS[number],
    price: '',
    size: '',
    description: '',
  });

  // Step 3 — multi-item listings (bundle of separately-priced items)
  type ItemDraft = { key: string; name: string; price: string; size_label: string };
  const [isMultiItem, setIsMultiItem] = useState(false);
  const [draftItems, setDraftItems] = useState<ItemDraft[]>([
    { key: crypto.randomUUID(), name: '', price: '', size_label: '' },
  ]);
  const addDraftItem    = () => setDraftItems(prev => [...prev, { key: crypto.randomUUID(), name: '', price: '', size_label: '' }]);
  const removeDraftItem = (key: string) => setDraftItems(prev => prev.filter(i => i.key !== key));
  const updateDraftItem = (key: string, field: keyof ItemDraft, value: string) =>
    setDraftItems(prev => prev.map(i => i.key === key ? { ...i, [field]: value } : i));
  const validItems = draftItems.filter(i => i.name.trim() && parseFloat(i.price) > 0);

  // Step 4 — parcel dimensions + shipping methods
  const [parcel, setParcel] = useState({ l: '', w: '', h: '', weight: '' });
  const [shippingMethods, setShippingMethods] = useState<SellerShippingOption[]>([]);

  // Step 4 — PUDO locker selection (required when PUDO_DROPOFF is chosen and parcel fits)
  const [pudoLockerId, setPudoLockerId]       = useState('');
  const [pudoLockerName, setPudoLockerName]   = useState('');
  const [pudoLockerAddress, setPudoLockerAddress] = useState('');

  // Seller's suburb + city — used to pre-center the locker map
  const [sellerSuburb, setSellerSuburb] = useState('');
  const [sellerCity, setSellerCity]     = useState('');

  // Derived: parcel dimensions as numbers (for locker size calc)
  const parcelDims = useMemo<ParcelDimensions | null>(() => {
    const l = parseFloat(parcel.l), w = parseFloat(parcel.w);
    const h = parseFloat(parcel.h), weight = parseFloat(parcel.weight);
    if ([l, w, h, weight].some(isNaN) || [l, w, h, weight].some(v => v <= 0)) return null;
    return { lengthCm: l, widthCm: w, heightCm: h, weightKg: weight };
  }, [parcel]);

  const lockerSize   = parcelDims ? getLockerSizeForParcel(parcelDims) : null;
  const fitsInLocker = parcelDims ? canFitInLocker(parcelDims) : false;

  const parcelComplete = parcelDims !== null;
  // RULE: listing must not go ACTIVE without at least one shipping method
  // RULE: if PUDO_DROPOFF is selected and parcel fits a locker, a drop-off locker is required
  const pudoDropoffNeedsLocker = shippingMethods.includes('PUDO_DROPOFF') && fitsInLocker;
  const shippingComplete = shippingMethods.length > 0 && (!pudoDropoffNeedsLocker || !!pudoLockerId);
  // School drop-off only makes sense if this listing is tied to a school
  const hasSchoolContext = selectedSchool !== null || profileSchools.length > 0;

  // RULE: sellers choose exactly one shipping method (radio-style, not multi-select)
  const selectShipping = (method: SellerShippingOption) => {
    setShippingMethods([method]);
    // Clear saved locker unless PUDO_DROPOFF is the selected method
    if (method !== 'PUDO_DROPOFF') {
      setPudoLockerId('');
      setPudoLockerName('');
      setPudoLockerAddress('');
    }
  };

  // Load profile schools on mount — pre-populates step 2 with all schools linked to the user's profile
  // (school_ids is the text[] of all schools their children attend; school_id is their primary school)
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: prof } = await supabase.from('profiles').select('school_id, school_ids, province, suburb_name, city_name').eq('id', user.id).single();
      if (prof?.province) setProvince(prof.province);
      if (prof?.suburb_name) setSellerSuburb(prof.suburb_name);
      if (prof?.city_name) setSellerCity(prof.city_name);

      // Collect all unique school IDs from both the primary school and the multi-school array
      const allIds = Array.from(new Set([
        ...(prof?.school_ids ?? []),
        ...(prof?.school_id ? [prof.school_id] : []),
      ])).filter(Boolean);

      if (allIds.length > 0) {
        const { data: saved } = await supabase.from('schools').select('*').in('id', allIds).order('name');
        setProfileSchools((saved as SchoolType[]) ?? []);
      }
    });
  }, []);

  // Search schools live via API — avoids the 1000-row PostgREST default limit
  const searchSchools = async (q: string, prov: string) => {
    if (q.trim().length < 2) { setSchools([]); return; }
    setLoadingSchools(true);
    try {
      const params = new URLSearchParams({ q: q.trim(), limit: '20' });
      if (prov) params.set('province', prov);
      const res  = await fetch(`/api/locations/schools/search?${params}`);
      const data = await res.json();
      setSchools(Array.isArray(data) ? data as SchoolType[] : []);
    } catch { setSchools([]); }
    setLoadingSchools(false);
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    setUploading(true);
    for (const file of files) {
      const preview = URL.createObjectURL(file);
      const fileName = `items/${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
      const { error: uploadError } = await supabase.storage.from('item-images').upload(fileName, file);
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('item-images').getPublicUrl(fileName);
        setImageUrls(prev => [...prev, urlData.publicUrl]);
      }
      setImagePreviews(prev => [...prev, preview]);
    }
    setUploading(false);
  };

  const removeImage = (i: number) => {
    setImagePreviews(prev => prev.filter((_, idx) => idx !== i));
    setImageUrls(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async () => {
    setError('');
    if (isMultiItem && validItems.length === 0) {
      setError('Add at least one item with a name and price.');
      return;
    }
    if (!parcelComplete || !shippingComplete) {
      setError('Parcel dimensions and at least one shipping method are required.');
      return;
    }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: prof } = await supabase.from('profiles')
      .select('province, city_id, city_name, suburb_id, suburb_name, school_id, school_name')
      .eq('id', user.id).single();

    // price_cents stores the BUYER price (gross-up) so listing cards show what the buyer pays.
    // RULE: for multi-item listings, price_cents reflects the cheapest item ("from R...")
    const sellerPayoutRands = isMultiItem
      ? Math.min(...validItems.map(i => parseFloat(i.price)))
      : parseFloat(form.price);
    const priceCents = calculateBuyerPrice(sellerPayoutRands).buyerPriceCents;

    const { data: newListing, error: insertError } = await supabase.from('listings').insert({
      seller_id:            user.id,
      title:                buildListingTitle(category, form.subcategory, form.size),
      description:          form.description || null,
      // RULE: price stored in cents — Stitch processes ZAR in cents natively
      price_cents:          priceCents,
      condition:            form.condition.toUpperCase(),
      category,
      subcategory:          form.subcategory || null,
      images:               imageUrls,
      status:               'ACTIVE',
      published_at:         new Date().toISOString(),

      // Seller location snapshot (denormalized — never join needed at query time)
      // RULE: profiles table uses 'province', listings table uses 'seller_province_code'
      seller_province_code: prof?.province ?? null,
      seller_city_id:       prof?.city_id ?? null,
      seller_city_name:     prof?.city_name ?? null,
      seller_suburb_id:     prof?.suburb_id ?? null,
      seller_suburb_name:   prof?.suburb_name ?? null,
      seller_school_id:     selectedSchool?.id ?? prof?.school_id ?? null,
      seller_school_name:   selectedSchool?.name ?? prof?.school_name ?? null,

      // Item attributes
      is_school_specific:   isSchoolSpecific,
      size:                 form.size || null,

      // RULE: parcel dimensions required before listing can go ACTIVE
      parcel_length_cm:     parcelDims!.lengthCm,
      parcel_width_cm:      parcelDims!.widthCm,
      parcel_height_cm:     parcelDims!.heightCm,
      parcel_weight_kg:     parcelDims!.weightKg,

      // RULE: at least one shipping method required before listing goes ACTIVE
      shipping_methods:     shippingMethods,

      // RULE: if PUDO_DROPOFF selected, seller's chosen drop-off locker is required and stored here
      pudo_locker_id:       pudoLockerId   || null,
      pudo_locker_name:     pudoLockerName || null,

      // Multi-item listings — see "Multi-Item Listings, Reservations & Order Items"
      is_multi_item:        isMultiItem,
      item_count:           isMultiItem ? validItems.length : 1,
      available_count:      isMultiItem ? validItems.length : 1,
    }).select('id').single();

    if (insertError || !newListing) {
      setLoading(false);
      setError('Error: ' + (insertError?.message ?? 'Unknown error'));
      return;
    }

    if (isMultiItem && validItems.length > 0) {
      const { error: itemsError } = await supabase.from('listing_items').insert(
        validItems.map(i => ({
          listing_id:  newListing.id,
          name:        i.name.trim(),
          price_cents: Math.round(parseFloat(i.price) * 100),
          size_label:  i.size_label.trim() || null,
        }))
      );
      if (itemsError) {
        setLoading(false);
        setError('Error: ' + itemsError.message);
        return;
      }
    }

    setLoading(false);
    setShowSuccess(true);
  };

  const nextStep = () => {
    if (step === 1 && !category) return;
    if (step === 1 && showsSchoolStep) {
      if (isSchoolSpecific && profileSchools.length === 1) { setSelectedSchool(profileSchools[0]); setStep(3); return; }
      setStep(2); return;
    }
    if (step === 1) { setStep(3); return; }
    if (step < 5) setStep((step + 1) as Step);
  };

  const prevStep = () => {
    if (step === 3 && !showsSchoolStep) { setStep(1); return; }
    if (step === 3 && showsSchoolStep && isSchoolSpecific && profileSchools.length === 1) { setStep(1); return; }
    if (step > 1) setStep((step - 1) as Step);
  };

  const TOTAL_STEPS = showsSchoolStep ? 5 : 4;
  const displayStep = step === 1 ? 1 : step === 2 ? 2 : showsSchoolStep ? step : step - 1;

  if (showSuccess) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <CheckCircle2 size={64} className="text-[#BE1E2D] mx-auto mb-6" strokeWidth={2} />
        <h2 className="text-3xl font-bold text-[#111] mb-4">Listing Live!</h2>
        <p className="text-[#979797] mb-10">Your item is now active on NextKid.</p>
        <div className="flex gap-4 justify-center">
          <button onClick={() => router.push('/browse')} className="bg-[#BE1E2D] hover:bg-[#9B1824] text-white px-8 py-3 rounded-full font-medium transition">View in Browse</button>
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
            <div key={i} className={`flex-1 h-1 rounded-full transition-colors ${i < displayStep ? 'bg-[#BE1E2D]' : 'bg-[#dedede]'}`} />
          ))}
        </div>

        <div className="bg-white border border-[#dedede] rounded-2xl p-8 space-y-6 shadow-sm">

          {/* ── Step 1 — Category ────────────────────────────────── */}
          {step === 1 && <>
            <div>
              <h2 className="text-[#111] font-semibold text-lg mb-1">What are you selling?</h2>
              <p className="text-[#979797] text-sm mb-6">Choose the category that best fits your item.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ALL_CATEGORIES.map(cat => (
                  <button key={cat} type="button" onClick={() => setCategory(cat)}
                    className={`p-3 rounded-xl border-2 text-left transition flex items-center gap-3 ${
                      category === cat ? 'border-[#BE1E2D] bg-[#fde8ea]' : 'border-[#dedede] bg-white hover:border-[#BE1E2D]/40'
                    }`}>
                    <span className={`shrink-0 ${category === cat ? 'text-[#BE1E2D]' : 'text-[#979797]'}`}>
                      {CATEGORY_ICON[cat] ?? <Package size={20} strokeWidth={2} />}
                    </span>
                    <div className="min-w-0">
                      <span className="text-[#111] text-sm font-medium block truncate">{cat}</span>
                      {(SCHOOL_SPECIFIC_CATEGORIES.includes(cat as typeof SCHOOL_SPECIFIC_CATEGORIES[number]) || cat === 'Books & Stationery') && (
                        <span className="text-[#979797] text-xs block">Can link to school</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <button disabled={!category} onClick={nextStep}
              className="w-full py-3 rounded-full bg-[#BE1E2D] disabled:bg-[#dedede] disabled:text-[#979797] text-white font-semibold transition">
              Continue →
            </button>
          </>}

          {/* ── Step 2 — School picker ────── */}
          {step === 2 && showsSchoolStep && <>
            <div>
              <h2 className="text-[#111] font-semibold text-lg mb-1">Link to a school? (optional)</h2>
              <p className="text-[#979797] text-sm mb-6">
                Linking your item to a school helps the right buyers find it. You can skip this if it's not school-specific.
              </p>

              {profileSchools.length > 0 ? (
                <div className="space-y-3">
                  {profileSchools.map(school => (
                    <button key={school.id} type="button" onClick={() => setSelectedSchool(school)}
                      className={`w-full p-4 rounded-xl border-2 text-left flex items-center justify-between transition ${
                        selectedSchool?.id === school.id ? 'border-[#BE1E2D] bg-[#fde8ea]' : 'border-[#dedede] bg-white hover:border-[#BE1E2D]/40'
                      }`}>
                      <div className="flex items-center gap-3">
                        <School size={18} className={selectedSchool?.id === school.id ? 'text-[#BE1E2D]' : 'text-[#979797]'} />
                        <div>
                          <p className="text-[#111] text-sm font-medium">{school.name}</p>
                          <p className="text-[#979797] text-xs">{school.city_name}</p>
                        </div>
                      </div>
                      {selectedSchool?.id === school.id && <CheckCircle2 size={18} className="text-[#BE1E2D] shrink-0" />}
                    </button>
                  ))}
                  <p className="text-xs text-[#979797] pt-1">
                    Wrong school?{' '}
                    <button type="button" onClick={() => setProfileSchools([])} className="text-[#BE1E2D] underline">Search all schools instead</button>
                  </p>
                </div>
              ) : (
                <>
                  <label className={labelCls}>Province <span className="text-[#979797] font-normal">(optional — narrows results)</span></label>
                  <select className={`${inputCls} mb-4`} value={province}
                    onChange={e => { setProvince(e.target.value); setSchools([]); setSchoolSearch(''); setSelectedSchool(null); }}>
                    <option value="">All provinces</option>
                    {SA_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>

                  <label className={labelCls}>Search school <span className="text-[#979797] font-normal">(type at least 2 letters)</span></label>
                  <input className={`${inputCls} mb-3`} value={schoolSearch}
                    onChange={e => { setSchoolSearch(e.target.value); searchSchools(e.target.value, province); }}
                    placeholder="e.g. Noordwyk, Hoërskool, St John's..." />
                  {schoolSearch.trim().length >= 2 && (
                    <div className="border border-[#dedede] rounded-xl overflow-hidden max-h-52 overflow-y-auto mb-4">
                      {loadingSchools
                        ? <p className="text-[#979797] p-4 text-center text-sm">Searching...</p>
                        : schools.length === 0
                          ? <p className="text-[#979797] p-4 text-center text-sm">No schools found — try a shorter name or different spelling.</p>
                          : schools.map(school => (
                            <div key={school.id} onClick={() => setSelectedSchool(school)}
                              className={`p-3 cursor-pointer flex justify-between items-center border-b border-[#dedede] ${
                                selectedSchool?.id === school.id ? 'bg-[#fde8ea]' : 'hover:bg-[#f4f4f4]'
                              }`}>
                              <div>
                                <p className="text-[#111] text-sm">{school.name}</p>
                                <p className="text-[#979797] text-xs">{school.city_name ?? school.city} · {school.type}</p>
                              </div>
                              {selectedSchool?.id === school.id && <CheckCircle2 size={16} className="text-[#BE1E2D]" />}
                            </div>
                          ))
                      }
                    </div>
                  )}

                  {selectedSchool && (
                    <div className="bg-[#fde8ea] border border-[#BE1E2D]/30 rounded-xl p-3 flex justify-between items-center">
                      <span className="text-[#BE1E2D] text-sm flex items-center gap-2">
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
              {isOptionalSchool && (
                <button onClick={() => { setSelectedSchool(null); setStep(3); }}
                  className="flex-1 py-3 rounded-full border border-[#dedede] text-[#979797] hover:bg-[#f4f4f4] transition text-sm">
                  Skip
                </button>
              )}
              <button onClick={nextStep} disabled={!isOptionalSchool && !selectedSchool}
                className="flex-grow py-3 rounded-full bg-[#BE1E2D] disabled:bg-[#dedede] disabled:text-[#979797] text-white font-semibold transition">
                Continue →
              </button>
            </div>
          </>}

          {/* ── Step 3 — Item details ─────────────────────────────── */}
          {step === 3 && <>
            <h2 className="text-[#111] font-semibold text-lg mb-4">Item details</h2>

            {/* Multi-item toggle — choose first, before filling anything else */}
            <div className="bg-[#f4f4f4] border border-[#dedede] rounded-xl p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-[#111] text-sm font-medium">Multiple items in this listing?</p>
                <p className="text-[#979797] text-xs mt-0.5">e.g. shoes, shirt and pants — each priced separately</p>
              </div>
              <button type="button" role="switch" aria-checked={isMultiItem}
                onClick={() => setIsMultiItem(v => !v)}
                className={`relative w-12 h-7 rounded-full transition shrink-0 ${isMultiItem ? 'bg-[#BE1E2D]' : 'bg-[#dedede]'}`}>
                <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${isMultiItem ? 'translate-x-5' : ''}`} />
              </button>
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
                <select className={inputCls} value={form.condition}
                  onChange={e => setForm({ ...form, condition: e.target.value as typeof SELLER_CONDITIONS[number] })}>
                  {SELLER_CONDITIONS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>Size</label>
              {category === 'Shoes' ? (
                <select className={inputCls} value={form.size} onChange={e => setForm({ ...form, size: e.target.value })}>
                  <option value="">Select size...</option>
                  {SHOE_SIZE_GROUPS.map(group => (
                    <optgroup key={group.label} label={`${group.label} (UK)`}>
                      {group.sizes.map(s => <option key={s} value={s}>{s}</option>)}
                    </optgroup>
                  ))}
                </select>
              ) : (
                <input className={inputCls} value={form.size} onChange={e => setForm({ ...form, size: e.target.value })}
                  placeholder="e.g. Size 32, UK 8, Grade 5" />
              )}
            </div>

            {/* Single item: price + buyer price calculator */}
            {!isMultiItem && (
              <div>
                <label className={labelCls}>Your asking price (Rands)</label>
                <input type="number" className={inputCls} value={form.price}
                  onChange={e => setForm({ ...form, price: e.target.value })} placeholder="250" min="10" />
                {parseFloat(form.price) >= 10 && <BuyerPriceWidget sellerRands={parseFloat(form.price)} />}
              </div>
            )}

            {/* Multi-item: per-item list */}
            {isMultiItem && (
              <div className="space-y-3">
                <label className={labelCls}>Items in this listing <span className="text-[#979797] font-normal">(at least 1)</span></label>
                {draftItems.map((item, idx) => (
                  <div key={item.key} className="border border-[#dedede] rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[#979797] text-xs font-semibold uppercase tracking-wide">Item {idx + 1}</p>
                      {draftItems.length > 1 && (
                        <button type="button" onClick={() => removeDraftItem(item.key)} className="text-[#979797] hover:text-[#BE1E2D] transition">
                          <X size={16} />
                        </button>
                      )}
                    </div>
                    <div>
                      <label className={labelCls}>Name</label>
                      <input className={inputCls} value={item.name}
                        onChange={e => updateDraftItem(item.key, 'name', e.target.value)}
                        placeholder="e.g. Grey school trousers" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>Price (Rands)</label>
                        <input type="number" className={inputCls} value={item.price}
                          onChange={e => updateDraftItem(item.key, 'price', e.target.value)} placeholder="80" min="10" />
                      </div>
                      <div>
                        <label className={labelCls}>Size <span className="text-[#979797] font-normal">(optional)</span></label>
                        <input className={inputCls} value={item.size_label}
                          onChange={e => updateDraftItem(item.key, 'size_label', e.target.value)} placeholder="e.g. Size 32" />
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={addDraftItem}
                  className="w-full py-2.5 rounded-xl border border-dashed border-[#BE1E2D] text-[#BE1E2D] text-sm font-medium hover:bg-[#fde8ea] transition">
                  + Add another item
                </button>
                {validItems.length > 0 && (
                  <div className="bg-[#f4f4f4] rounded-xl px-4 py-2.5 flex items-center justify-between text-sm">
                    <span className="text-[#979797]">{validItems.length} item{validItems.length !== 1 ? 's' : ''} · from R{Math.min(...validItems.map(i => parseFloat(i.price))).toFixed(2)}</span>
                    <span className="text-[#BE1E2D] font-semibold">Total R{validItems.reduce((s, i) => s + parseFloat(i.price), 0).toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className={labelCls}>Description <span className="text-[#979797] font-normal">(optional)</span></label>
              <textarea className={`${inputCls} h-28 resize-none`} value={form.description} maxLength={100}
                onChange={e => setForm({ ...form, description: e.target.value.slice(0, 100) })}
                placeholder="e.g. Still in good condition, selling because my child outgrew it" />
              <p className="text-xs text-[#979797] text-right mt-1">{form.description.length}/100</p>
            </div>

            <div className="flex gap-3">
              <button onClick={prevStep} className="flex-1 py-3 rounded-full border border-[#dedede] text-[#979797] hover:bg-[#f4f4f4] transition">← Back</button>
              <button onClick={nextStep}
                disabled={isMultiItem ? validItems.length === 0 : !form.price}
                className="flex-grow py-3 rounded-full bg-[#BE1E2D] disabled:bg-[#dedede] disabled:text-[#979797] text-white font-semibold transition">
                Continue →
              </button>
            </div>
          </>}

          {/* ── Step 4 — Parcel dimensions + Shipping methods ────── */}
          {step === 4 && <>
            <div>
              <h2 className="text-[#111] font-semibold text-lg mb-1">Parcel & Shipping</h2>
              {/* RULE: parcel dimensions and at least one shipping method required before listing goes ACTIVE */}
              <p className="text-[#979797] text-sm mb-6">
                Required so buyers can get an accurate shipping quote at checkout.
              </p>

              {/* Parcel dimensions */}
              <p className="text-[#111] text-sm font-medium mb-3">Parcel dimensions</p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                {([
                  { key: 'l', label: 'Length (cm)', placeholder: '30' },
                  { key: 'w', label: 'Width (cm)',  placeholder: '20' },
                  { key: 'h', label: 'Height (cm)', placeholder: '10' },
                  { key: 'weight', label: 'Weight (kg)', placeholder: '0.5' },
                ] as const).map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className={labelCls}>{label}</label>
                    <input type="number" min="0" step={key === 'weight' ? '0.1' : '1'}
                      className={inputCls}
                      value={parcel[key]}
                      onChange={e => setParcel(p => ({ ...p, [key]: e.target.value }))}
                      placeholder={placeholder} />
                  </div>
                ))}
              </div>

              {/* Locker size indicator */}
              {parcelComplete && (
                <div className={`rounded-xl p-3 text-sm mb-6 flex items-center gap-2 ${
                  fitsInLocker
                    ? 'bg-[#f0fdf4] border border-[#bbf7d0] text-[#166534]'
                    : 'bg-[#fffbeb] border border-[#fde68a] text-[#92400e]'
                }`}>
                  {fitsInLocker
                    ? <>📦 Fits a <strong>{LOCKER_SIZE_LABELS[lockerSize!]} ({lockerSize})</strong> PUDO locker — both shipping options available</>
                    : <>⚠ Too large for any PUDO locker — Door-to-Door only</>
                  }
                </div>
              )}

              {/* Shipping methods */}
              <p className="text-[#111] text-sm font-medium mb-3">Shipping method <span className="text-[#979797] font-normal">(select one)</span></p>
              <div className="space-y-3">
                {/* Door-to-Door — always available */}
                <button type="button" onClick={() => selectShipping('PICKUP')}
                  className={`w-full p-4 rounded-xl border-2 text-left flex items-start gap-4 transition ${
                    shippingMethods.includes('PICKUP')
                      ? 'border-[#BE1E2D] bg-[#fde8ea]'
                      : 'border-[#dedede] bg-white hover:border-[#BE1E2D]/40'
                  }`}>
                  <Truck size={22} className={`mt-0.5 shrink-0 ${shippingMethods.includes('PICKUP') ? 'text-[#BE1E2D]' : 'text-[#979797]'}`} />
                  <div>
                    <p className="text-[#111] font-medium text-sm">Door-to-Door pickup</p>
                    <p className="text-[#979797] text-xs mt-0.5">A courier collects directly from your address</p>
                  </div>
                  {shippingMethods.includes('PICKUP') && <CheckCircle2 size={18} className="text-[#BE1E2D] ml-auto shrink-0 mt-0.5" />}
                </button>

                {/* PUDO Locker — only shown if parcel fits */}
                <button type="button"
                  onClick={() => fitsInLocker && selectShipping('PUDO_DROPOFF')}
                  disabled={parcelComplete && !fitsInLocker}
                  className={`w-full p-4 rounded-xl border-2 text-left flex items-start gap-4 transition ${
                    shippingMethods.includes('PUDO_DROPOFF')
                      ? 'border-[#BE1E2D] bg-[#fde8ea]'
                      : parcelComplete && !fitsInLocker
                        ? 'border-[#dedede] bg-[#fafafa] opacity-50 cursor-not-allowed'
                        : 'border-[#dedede] bg-white hover:border-[#BE1E2D]/40'
                  }`}>
                  <Box size={22} className={`mt-0.5 shrink-0 ${shippingMethods.includes('PUDO_DROPOFF') ? 'text-[#BE1E2D]' : 'text-[#979797]'}`} />
                  <div>
                    <p className="text-[#111] font-medium text-sm">PUDO Locker drop-off</p>
                    <p className="text-[#979797] text-xs mt-0.5">
                      {parcelComplete && !fitsInLocker
                        ? 'Not available — parcel is too large for any locker'
                        : lockerSize
                          ? `Drop at your nearest TCG locker · Needs ${LOCKER_SIZE_LABELS[lockerSize]} (${lockerSize}) slot`
                          : 'Drop at your nearest The Courier Guy locker'
                      }
                    </p>
                  </div>
                  {shippingMethods.includes('PUDO_DROPOFF') && <CheckCircle2 size={18} className="text-[#BE1E2D] ml-auto shrink-0 mt-0.5" />}
                </button>

                {/* RULE: seller must choose their drop-off locker when PUDO_DROPOFF is selected */}
                {shippingMethods.includes('PUDO_DROPOFF') && fitsInLocker && (
                  <div className="mt-4 space-y-2">
                    <p className="text-[#111] text-sm font-medium">
                      Choose your drop-off locker{' '}
                      <span className="text-red-500">*</span>
                    </p>
                    <p className="text-[#979797] text-xs">
                      Buyers will see this locker as the collection point for their orders.
                    </p>
                    <LockerMapPicker
                      suburb={sellerSuburb}
                      city={sellerCity}
                      selectedId={pudoLockerId}
                      selectedName={pudoLockerName}
                      selectedAddress={pudoLockerAddress}
                      onSelect={(locker: SelectedLocker | null) => {
                        setPudoLockerId(locker?.id ?? '');
                        setPudoLockerName(locker?.name ?? '');
                        setPudoLockerAddress(locker?.address ?? '');
                      }}
                    />
                  </div>
                )}

                {/* School drop-off — only shown if this listing is tied to a school */}
                {hasSchoolContext && (
                  <button type="button" onClick={() => selectShipping('SCHOOL_DROPOFF')}
                    className={`w-full p-4 rounded-xl border-2 text-left flex items-start gap-4 transition ${
                      shippingMethods.includes('SCHOOL_DROPOFF')
                        ? 'border-[#BE1E2D] bg-[#fde8ea]'
                        : 'border-[#dedede] bg-white hover:border-[#BE1E2D]/40'
                    }`}>
                    <School size={22} className={`mt-0.5 shrink-0 ${shippingMethods.includes('SCHOOL_DROPOFF') ? 'text-[#BE1E2D]' : 'text-[#979797]'}`} />
                    <div>
                      <p className="text-[#111] font-medium text-sm">School drop-off — R20</p>
                      <p className="text-[#979797] text-xs mt-0.5">
                        Drop off at school for buyers from the same school to collect — flat R20 fee
                      </p>
                    </div>
                    {shippingMethods.includes('SCHOOL_DROPOFF') && <CheckCircle2 size={18} className="text-[#BE1E2D] ml-auto shrink-0 mt-0.5" />}
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={prevStep} className="flex-1 py-3 rounded-full border border-[#dedede] text-[#979797] hover:bg-[#f4f4f4] transition">← Back</button>
              <button onClick={nextStep} disabled={!parcelComplete || !shippingComplete}
                className="flex-grow py-3 rounded-full bg-[#BE1E2D] disabled:bg-[#dedede] disabled:text-[#979797] text-white font-semibold transition">
                Continue →
              </button>
            </div>
          </>}

          {/* ── Step 5 — Photos + Publish ─────────────────────────── */}
          {step === 5 && <>
            <h2 className="text-[#111] font-semibold text-lg mb-4">Add photos</h2>

            <div className="border-2 border-dashed border-[#dedede] rounded-xl p-10 text-center hover:border-[#BE1E2D]/40 transition">
              <input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" id="upload" />
              <label htmlFor="upload" className="cursor-pointer">
                <Package size={32} className="text-[#979797] mx-auto mb-3" strokeWidth={2} />
                <p className="text-[#979797] mb-3 text-sm">Drag photos here or</p>
                <span className="bg-[#BE1E2D] hover:bg-[#9B1824] px-6 py-2 rounded-full text-white text-sm font-medium transition">
                  {uploading ? 'Uploading...' : 'Select Photos'}
                </span>
              </label>
            </div>

            {imagePreviews.length > 0 && (
              <div className="flex gap-3 flex-wrap mt-2">
                {imagePreviews.map((src, i) => (
                  <div key={i} className="relative">
                    <img src={src} className="w-20 h-20 object-cover rounded-xl border border-[#dedede]" alt="" />
                    <button type="button" onClick={() => removeImage(i)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"><X size={14} /></button>
                  </div>
                ))}
              </div>
            )}

            {/* Summary card */}
            <div className="bg-[#f4f4f4] border border-[#dedede] rounded-xl p-4 text-sm space-y-1.5">
              <p className="text-[#979797]">Category: <span className="text-[#111] font-medium">{category}</span></p>
              {selectedSchool && <p className="text-[#979797]">School: <span className="text-[#111] font-medium">{selectedSchool.name}</span></p>}
              <p className="text-[#979797]">Listing title: <span className="text-[#111] font-medium">{buildListingTitle(category, form.subcategory, form.size)}</span></p>
              {isMultiItem
                ? <p className="text-[#979797]">Items: <span className="text-[#BE1E2D] font-bold">{validItems.length} items · from R{Math.min(...validItems.map(i => parseFloat(i.price))).toFixed(2)}</span></p>
                : <p className="text-[#979797]">Price: <span className="text-[#BE1E2D] font-bold">R{form.price}</span></p>
              }
              {!isMultiItem && form.size && <p className="text-[#979797]">Size: <span className="text-[#111] font-medium">{form.size}</span></p>}
              <p className="text-[#979797]">Parcel: <span className="text-[#111] font-medium">{parcel.l}×{parcel.w}×{parcel.h} cm · {parcel.weight} kg</span></p>
              <p className="text-[#979797]">Shipping: <span className="text-[#111] font-medium">{shippingMethods.join(', ')}</span></p>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div className="flex gap-3">
              <button onClick={prevStep} className="flex-1 py-3 rounded-full border border-[#dedede] text-[#979797] hover:bg-[#f4f4f4] transition">← Back</button>
              <button onClick={handleSubmit} disabled={loading || uploading}
                className="flex-grow py-3 rounded-full bg-[#BE1E2D] hover:bg-[#9B1824] disabled:bg-[#dedede] disabled:text-[#979797] text-white font-semibold transition">
                {loading ? 'Publishing...' : 'Publish Listing 🚀'}
              </button>
            </div>
          </>}

        </div>
      </div>
    </div>
  );
}

// ── Buyer Price Widget ─────────────────────────────────────────────────────────
// RULE: sellers only see the final totals — never the fee/markup breakdown
function BuyerPriceWidget({ sellerRands }: { sellerRands: number }) {
  const b = calculateBuyerPrice(sellerRands)

  return (
    <div className="mt-3 bg-[#BE1E2D] rounded-xl px-4 py-3 flex items-center justify-between">
      <div>
        <p className="text-white/70 text-[10px] uppercase tracking-wide">Buyer pays</p>
        <p className="text-white text-lg font-bold">{fmtRands(b.buyerPriceCents)}</p>
      </div>
      <div className="text-right">
        <p className="text-white/70 text-[10px] uppercase tracking-wide">You receive</p>
        <p className="text-white text-base font-semibold">{fmtRands(b.sellerPayoutCents)}</p>
      </div>
    </div>
  )
}