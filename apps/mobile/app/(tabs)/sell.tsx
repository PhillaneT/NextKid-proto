import { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/src/lib/supabase';
import {
  Shirt, Trophy, Footprints, Dumbbell, BookOpen, ShoppingBag, Package,
} from 'lucide-react-native';
import {
  ALL_CATEGORIES, SCHOOL_SPECIFIC_CATEGORIES, SUBCATEGORIES,
  LISTING_CONDITIONS, CLOTHING_SIZES, SHOE_SIZES, GRADES, SA_PROVINCES,
  canFitInLocker, getLockerSizeForParcel,
  calculateBuyerPrice, fmtRands,
} from '@nextkid/shared';
import type { ListingCategory, School, ParcelDimensions, SellerShippingOption } from '@nextkid/shared';

function CategoryIcon({ name, color }: { name: string; color: string }) {
  const props = { size: 28, strokeWidth: 2, color };
  switch (name) {
    case 'School Uniforms':    return <Shirt {...props} />;
    case 'School Sports Kit':  return <Trophy {...props} />;
    case 'Shoes':              return <Footprints {...props} />;
    case 'Sports Equipment':   return <Dumbbell {...props} />;
    case 'Books & Stationery': return <BookOpen {...props} />;
    case 'Bags & Accessories': return <ShoppingBag {...props} />;
    default:                   return <Package {...props} />;
  }
}

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

const LOCKER_SIZE_LABELS: Record<string, string> = {
  'V4-XS': 'Extra Small', 'V4-S': 'Small', 'V4-M': 'Medium',
  'V4-L': 'Large', 'V4-XL': 'Extra Large',
};

// Steps: 1=Category, 2=School(optional), 3=Details, 4=Parcel+Shipping, 5=Review+Publish
type Step = 1 | 2 | 3 | 4 | 5;

export default function SellScreen() {
  const [step, setStep]       = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Step 1
  const [category, setCategory] = useState<ListingCategory | ''>('');
  const isSchoolSpecific = SCHOOL_SPECIFIC_CATEGORIES.includes(category as typeof SCHOOL_SPECIFIC_CATEGORIES[number]);

  // Step 2
  const [province, setProvince]           = useState('');
  const [schools, setSchools]             = useState<School[]>([]);
  const [schoolSearch, setSchoolSearch]   = useState('');
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [profileSchools, setProfileSchools] = useState<School[]>([]);

  // Step 3
  const [title, setTitle]             = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [price, setPrice]             = useState('');
  const [condition, setCondition]     = useState<typeof LISTING_CONDITIONS[number]>('good');
  const [size, setSize]               = useState('');
  const [gender, setGender]           = useState<'boys' | 'girls' | 'unisex' | ''>('');
  const [grade, setGrade]             = useState('');
  const [description, setDescription] = useState('');

  // Step 3 — multi-item support
  type ItemDraft = { key: string; name: string; price: string; size_label: string }
  const [isMultiItem, setIsMultiItem] = useState(false);
  const [draftItems, setDraftItems]   = useState<ItemDraft[]>([
    { key: Math.random().toString(36), name: '', price: '', size_label: '' },
  ]);
  const addDraftItem    = () => setDraftItems(p => [...p, { key: Math.random().toString(36), name: '', price: '', size_label: '' }]);
  const removeDraftItem = (key: string) => setDraftItems(p => p.filter(i => i.key !== key));
  const updateDraftItem = (key: string, field: keyof ItemDraft, value: string) =>
    setDraftItems(p => p.map(i => i.key === key ? { ...i, [field]: value } : i));
  const validItems = draftItems.filter(i => i.name.trim() && parseFloat(i.price) > 0);

  // Step 4 — parcel dimensions + shipping methods
  const [parcel, setParcel] = useState({ l: '', w: '', h: '', weight: '' });
  const [shippingMethods, setShippingMethods] = useState<SellerShippingOption[]>([]);

  const parcelDims = useMemo<ParcelDimensions | null>(() => {
    const l = parseFloat(parcel.l), w = parseFloat(parcel.w);
    const h = parseFloat(parcel.h), wt = parseFloat(parcel.weight);
    if ([l, w, h, wt].some(isNaN) || [l, w, h, wt].some(v => v <= 0)) return null;
    return { lengthCm: l, widthCm: w, heightCm: h, weightKg: wt };
  }, [parcel]);

  const lockerSize   = parcelDims ? getLockerSizeForParcel(parcelDims) : null;
  const fitsInLocker = parcelDims ? canFitInLocker(parcelDims) : false;
  const parcelComplete  = parcelDims !== null;
  // RULE: at least one shipping method required before listing goes ACTIVE
  const shippingComplete = shippingMethods.length > 0;

  const toggleShipping = (method: SellerShippingOption) =>
    setShippingMethods(prev =>
      prev.includes(method) ? prev.filter(m => m !== method) : [...prev, method]
    );

  useState(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: prof } = await supabase.from('profiles').select('school_ids, province').eq('id', user.id).single();
      if (prof?.province) setProvince(prof.province);
      if (prof?.school_ids?.length) {
        const { data: saved } = await supabase.from('schools').select('*').in('id', prof.school_ids).order('name');
        setProfileSchools((saved as School[]) ?? []);
      }
    });
  });

  const loadSchools = (prov: string) => {
    if (!prov) { setSchools([]); return; }
    setLoadingSchools(true);
    supabase.from('schools').select('*').eq('province_code', prov).order('name')
      .then(({ data }) => { setSchools((data as School[]) ?? []); setLoadingSchools(false); });
  };

  const nextStep = () => {
    if (step === 1 && !category) return;
    if (step === 1 && isSchoolSpecific) {
      if (profileSchools.length === 1) { setSelectedSchool(profileSchools[0]); setStep(3); return; }
      setStep(2); return;
    }
    if (step === 1) { setStep(3); return; }
    if (step < 5) setStep((step + 1) as Step);
  };

  const prevStep = () => {
    if (step === 3 && !isSchoolSpecific) { setStep(1); return; }
    if (step === 3 && isSchoolSpecific && profileSchools.length === 1) { setStep(1); return; }
    if (step > 1) setStep((step - 1) as Step);
  };

  const handleSubmit = async () => {
    if (!title) { Alert.alert('Missing fields', 'Title is required.'); return; }
    if (!isMultiItem && !price) { Alert.alert('Missing fields', 'Price is required.'); return; }
    if (isMultiItem && validItems.length === 0) { Alert.alert('Missing items', 'Add at least one item with a name and price.'); return; }
    if (!parcelComplete || !shippingComplete) {
      Alert.alert('Incomplete', 'Please fill in parcel dimensions and select at least one shipping method.');
      return;
    }

    const priceCents = isMultiItem
      ? Math.round(Math.min(...validItems.map(i => parseFloat(i.price))) * 100)
      : Math.round(parseFloat(price) * 100);

    if (!isMultiItem && (isNaN(priceCents) || priceCents <= 0)) {
      Alert.alert('Invalid price', 'Enter a valid price.'); return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: prof } = await supabase.from('profiles')
      .select('province, city_id, city_name, suburb_id, suburb_name, school_id, school_name')
      .eq('id', user.id).single();

    // RULE: condition stored uppercase to match DB check constraint
    // RULE: price stored in cents — Stitch processes ZAR in cents natively
    const { data: newListing, error } = await supabase.from('listings').insert({
      seller_id:            user.id,
      title:                title.trim(),
      description:          description.trim() || null,
      price_cents:          priceCents,
      condition:            condition.toUpperCase(),
      category,
      subcategory:          subcategory || null,
      images:               [],
      status:               'ACTIVE',
      published_at:         new Date().toISOString(),

      seller_province_code: prof?.province ?? null,
      seller_city_id:       prof?.city_id ?? null,
      seller_city_name:     prof?.city_name ?? null,
      seller_suburb_id:     prof?.suburb_id ?? null,
      seller_suburb_name:   prof?.suburb_name ?? null,
      seller_school_id:     selectedSchool?.id ?? prof?.school_id ?? null,
      seller_school_name:   selectedSchool?.name ?? prof?.school_name ?? null,

      is_school_specific:   isSchoolSpecific,
      size:                 size || null,
      gender:               gender || null,
      grade:                grade ? parseInt(grade) : null,

      parcel_length_cm:     parcelDims!.lengthCm,
      parcel_width_cm:      parcelDims!.widthCm,
      parcel_height_cm:     parcelDims!.heightCm,
      parcel_weight_kg:     parcelDims!.weightKg,
      shipping_methods:     shippingMethods,

      is_multi_item:        isMultiItem,
      item_count:           isMultiItem ? validItems.length : 1,
      available_count:      isMultiItem ? validItems.length : 1,
    }).select('id').single();

    if (error || !newListing) { setLoading(false); Alert.alert('Error', error?.message ?? 'Unknown error'); return; }

    if (isMultiItem && validItems.length > 0) {
      const { error: itemsErr } = await supabase.from('listing_items').insert(
        validItems.map(i => ({
          listing_id:  newListing.id,
          name:        i.name.trim(),
          price_cents: Math.round(parseFloat(i.price) * 100),
          size_label:  i.size_label.trim() || null,
        }))
      );
      if (itemsErr) { setLoading(false); Alert.alert('Error saving items', itemsErr.message); return; }
    }

    setLoading(false);
    setSuccess(true);
  };

  const reset = () => {
    setStep(1); setCategory(''); setSelectedSchool(null); setProvince('');
    setTitle(''); setPrice(''); setCondition('good'); setSize('');
    setGender(''); setGrade(''); setDescription(''); setSubcategory('');
    setParcel({ l: '', w: '', h: '', weight: '' }); setShippingMethods([]);
    setSuccess(false);
  };

  const filteredSchools  = schools.filter(s => s.name.toLowerCase().includes(schoolSearch.toLowerCase()));
  const TOTAL_STEPS      = isSchoolSpecific ? 5 : 4;
  const displayStep      = step === 1 ? 1 : step === 2 ? 2 : isSchoolSpecific ? step : step - 1;

  if (success) return (
    <SafeAreaView style={styles.container}>
      <View style={styles.successBox}>
        <Text style={{ fontSize: 64, marginBottom: 16 }}>🎉</Text>
        <Text style={styles.successTitle}>Listing Live!</Text>
        <Text style={styles.successSub}>Your item is now active on NextKid.</Text>
        <TouchableOpacity style={styles.btn} onPress={reset}>
          <Text style={styles.btnText}>Sell Another Item</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Create Listing</Text>

        {/* Progress bar */}
        <View style={styles.progressRow}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View key={i} style={[styles.progressDot, i < displayStep && styles.progressDotActive]} />
          ))}
        </View>

        {/* ── Step 1 — Category ──────────────────────────────── */}
        {step === 1 && <>
          <Text style={styles.stepTitle}>What are you selling?</Text>
          <Text style={styles.stepSub}>Choose the category that best fits your item.</Text>
          <View style={styles.categoryGrid}>
            {ALL_CATEGORIES.map(cat => (
              <TouchableOpacity key={cat} onPress={() => setCategory(cat)}
                style={[styles.categoryCard, category === cat && styles.categoryCardActive]}>
                <View style={{ marginBottom: 8 }}>
                  <CategoryIcon name={cat} color={category === cat ? BLUE : '#979797'} />
                </View>
                <Text style={[styles.categoryName, category === cat && styles.categoryNameActive]}>{cat}</Text>
                {SCHOOL_SPECIFIC_CATEGORIES.includes(cat as typeof SCHOOL_SPECIFIC_CATEGORIES[number]) && (
                  <Text style={styles.schoolTag}>School-specific</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={[styles.btn, !category && styles.btnDisabled]} onPress={nextStep} disabled={!category}>
            <Text style={styles.btnText}>Continue →</Text>
          </TouchableOpacity>
        </>}

        {/* ── Step 2 — School picker ─────────────────────────── */}
        {step === 2 && isSchoolSpecific && <>
          <Text style={styles.stepTitle}>Which school?</Text>
          <Text style={styles.stepSub}>
            {profileSchools.length > 0
              ? 'Select which of your schools this item belongs to.'
              : 'Link this listing to a school so the right buyers find it.'}
          </Text>

          {profileSchools.length > 0 ? (
            <View style={{ gap: 10, marginBottom: 12 }}>
              {profileSchools.map(school => (
                <TouchableOpacity key={school.id} onPress={() => setSelectedSchool(school)}
                  style={[styles.schoolCard, selectedSchool?.id === school.id && styles.schoolCardActive]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.schoolName, selectedSchool?.id === school.id && { color: BLUE }]}>{school.name}</Text>
                    <Text style={styles.schoolSub}>{school.city}</Text>
                  </View>
                  {selectedSchool?.id === school.id && <Text style={{ color: BLUE, fontSize: 18, fontWeight: '700' }}>✓</Text>}
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => setProfileSchools([])}>
                <Text style={styles.switchLink}>Wrong school? Search all schools →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.label}>Province</Text>
              <View style={styles.chipRow}>
                {SA_PROVINCES.map(p => (
                  <TouchableOpacity key={p}
                    onPress={() => { setProvince(p); loadSchools(p); setSchoolSearch(''); setSelectedSchool(null); }}
                    style={[styles.chip, province === p && styles.chipActive]}>
                    <Text style={[styles.chipText, province === p && styles.chipTextActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {province && <>
                <Text style={styles.label}>Search school</Text>
                <TextInput style={styles.input} value={schoolSearch} onChangeText={setSchoolSearch}
                  placeholder="Type school name..." placeholderTextColor="#979797" />
                <View style={styles.schoolList}>
                  {loadingSchools
                    ? <ActivityIndicator color={BLUE} style={{ padding: 16 }} />
                    : filteredSchools.length === 0
                      ? <Text style={styles.emptyText}>No schools found.</Text>
                      : filteredSchools.map(school => (
                        <TouchableOpacity key={school.id} onPress={() => setSelectedSchool(school)}
                          style={[styles.schoolRow, selectedSchool?.id === school.id && styles.schoolRowActive]}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.schoolName}>{school.name}</Text>
                            <Text style={styles.schoolSub}>{school.city} · {school.type}</Text>
                          </View>
                          {selectedSchool?.id === school.id && <Text style={{ color: BLUE, fontSize: 16, fontWeight: '700' }}>✓</Text>}
                        </TouchableOpacity>
                      ))
                  }
                </View>
              </>}
              {selectedSchool && (
                <View style={styles.selectedBanner}>
                  <Text style={styles.selectedBannerText}>🏫 {selectedSchool.name}</Text>
                  <TouchableOpacity onPress={() => setSelectedSchool(null)}>
                    <Text style={{ color: '#979797', fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          <View style={styles.rowBtns}>
            <TouchableOpacity style={[styles.btn, styles.btnOutline, { flex: 1 }]} onPress={prevStep}>
              <Text style={styles.btnOutlineText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, !selectedSchool && styles.btnDisabled, { flex: 2 }]} onPress={nextStep} disabled={!selectedSchool}>
              <Text style={styles.btnText}>Continue →</Text>
            </TouchableOpacity>
          </View>
        </>}

        {/* ── Step 3 — Item details ──────────────────────────── */}
        {step === 3 && <>
          <Text style={styles.stepTitle}>Item details</Text>

          <Text style={styles.label}>Title *</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle}
            placeholder="e.g. Grey flannel trousers size 32" placeholderTextColor="#979797" />

          <Text style={styles.label}>Subcategory</Text>
          <View style={styles.chipRow}>
            {category && SUBCATEGORIES[category as ListingCategory].map(s => (
              <TouchableOpacity key={s} onPress={() => setSubcategory(s)} style={[styles.chip, subcategory === s && styles.chipActive]}>
                <Text style={[styles.chipText, subcategory === s && styles.chipTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Condition</Text>
          <View style={styles.chipRow}>
            {LISTING_CONDITIONS.map(c => (
              <TouchableOpacity key={c} onPress={() => setCondition(c)} style={[styles.chip, condition === c && styles.chipActive]}>
                <Text style={[styles.chipText, condition === c && styles.chipTextActive]}>{c.replace(/_/g, ' ')}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Context-aware fields */}
          {(() => {
            const fields = CATEGORY_FIELDS[category] ?? {};
            return (
              <>
                {fields.clothingSize && <>
                  <Text style={styles.label}>Clothing Size</Text>
                  <View style={styles.chipRow}>
                    {CLOTHING_SIZES.map(s => (
                      <TouchableOpacity key={s} onPress={() => setSize(s)} style={[styles.chip, size === s && styles.chipActive]}>
                        <Text style={[styles.chipText, size === s && styles.chipTextActive]}>{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>}
                {fields.shoeSize && <>
                  <Text style={styles.label}>Shoe Size</Text>
                  <View style={styles.chipRow}>
                    {SHOE_SIZES.map(s => (
                      <TouchableOpacity key={s} onPress={() => setSize(s)} style={[styles.chip, size === s && styles.chipActive]}>
                        <Text style={[styles.chipText, size === s && styles.chipTextActive]}>{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>}
                {fields.dimensions && <>
                  <Text style={styles.label}>Dimensions / Capacity</Text>
                  <TextInput style={styles.input} value={size} onChangeText={setSize}
                    placeholder="e.g. 42L, 30×20×10 cm" placeholderTextColor="#979797" />
                </>}
                {fields.gender && <>
                  <Text style={styles.label}>Gender</Text>
                  <View style={styles.chipRow}>
                    {(['boys', 'girls', 'unisex'] as const).map(g => (
                      <TouchableOpacity key={g} onPress={() => setGender(g)} style={[styles.chip, gender === g && styles.chipActive]}>
                        <Text style={[styles.chipText, gender === g && styles.chipTextActive]}>{g}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>}
                {fields.grade && <>
                  <Text style={styles.label}>Grade</Text>
                  <View style={styles.chipRow}>
                    {GRADES.map(g => (
                      <TouchableOpacity key={g} onPress={() => setGrade(String(g))} style={[styles.chip, grade === String(g) && styles.chipActive]}>
                        <Text style={[styles.chipText, grade === String(g) && styles.chipTextActive]}>Gr {g}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>}
              </>
            );
          })()}

          {/* Multi-item toggle */}
          <View style={styles.multiToggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.multiToggleTitle}>Multiple items in this listing?</Text>
              <Text style={styles.multiToggleSub}>e.g. shoes, shirt and pants — each priced separately</Text>
            </View>
            <TouchableOpacity
              style={[styles.toggle, isMultiItem && styles.toggleOn]}
              onPress={() => setIsMultiItem(v => !v)}
            >
              <View style={[styles.toggleThumb, isMultiItem && styles.toggleThumbOn]} />
            </TouchableOpacity>
          </View>

          {/* Single item: price + buyer price calculator */}
          {!isMultiItem && (
            <>
              <Text style={styles.label}>Price (R) *</Text>
              <TextInput style={styles.input} value={price} onChangeText={setPrice}
                placeholder="250" placeholderTextColor="#979797" keyboardType="numeric" />
              {parseFloat(price) >= 10 && <BuyerPriceWidget sellerRands={parseFloat(price)} />}
            </>
          )}

          {/* Multi-item: per-item list */}
          {isMultiItem && (
            <>
              <Text style={styles.label}>Items in this listing <Text style={{ color: '#979797', fontWeight: '400' }}>(at least 1)</Text></Text>
              {draftItems.map((item, idx) => (
                <View key={item.key} style={styles.itemCard}>
                  <View style={styles.itemCardHeader}>
                    <Text style={styles.itemCardNum}>Item {idx + 1}</Text>
                    {draftItems.length > 1 && (
                      <TouchableOpacity onPress={() => removeDraftItem(item.key)} hitSlop={8}>
                        <Text style={{ color: '#979797', fontSize: 18, lineHeight: 20 }}>×</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.label}>Name *</Text>
                  <TextInput style={styles.input} value={item.name}
                    onChangeText={v => updateDraftItem(item.key, 'name', v)}
                    placeholder="e.g. Grey school trousers" placeholderTextColor="#979797" />
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Price (R) *</Text>
                      <TextInput style={styles.input} value={item.price}
                        onChangeText={v => updateDraftItem(item.key, 'price', v)}
                        placeholder="80" placeholderTextColor="#979797" keyboardType="numeric" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Size <Text style={{ color: '#979797', fontWeight: '400' }}>(optional)</Text></Text>
                      <TextInput style={styles.input} value={item.size_label}
                        onChangeText={v => updateDraftItem(item.key, 'size_label', v)}
                        placeholder="e.g. Size 32" placeholderTextColor="#979797" />
                    </View>
                  </View>
                </View>
              ))}
              <TouchableOpacity style={styles.addItemBtn} onPress={addDraftItem}>
                <Text style={styles.addItemBtnText}>+ Add another item</Text>
              </TouchableOpacity>
              {validItems.length > 0 && (
                <View style={styles.itemsSummary}>
                  <Text style={styles.itemsSummaryText}>{validItems.length} item{validItems.length !== 1 ? 's' : ''} · from R{Math.min(...validItems.map(i => parseFloat(i.price))).toFixed(2)}</Text>
                  <Text style={styles.itemsSummaryTotal}>Total R{validItems.reduce((s, i) => s + parseFloat(i.price), 0).toFixed(2)}</Text>
                </View>
              )}
            </>
          )}

          <Text style={styles.label}>Description</Text>
          <TextInput style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
            value={description} onChangeText={setDescription}
            placeholder="Condition, why you're selling, any defects..." placeholderTextColor="#979797" multiline />

          <View style={styles.rowBtns}>
            <TouchableOpacity style={[styles.btn, styles.btnOutline, { flex: 1 }]} onPress={prevStep}>
              <Text style={styles.btnOutlineText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, (!title || (isMultiItem ? validItems.length === 0 : !price)) && styles.btnDisabled, { flex: 2 }]}
              onPress={nextStep}
              disabled={!title || (isMultiItem ? validItems.length === 0 : !price)}>
              <Text style={styles.btnText}>Continue →</Text>
            </TouchableOpacity>
          </View>
        </>}

        {/* ── Step 4 — Parcel dimensions + Shipping methods ──── */}
        {step === 4 && <>
          <Text style={styles.stepTitle}>Parcel & Shipping</Text>
          {/* RULE: parcel dimensions and at least one shipping method required before listing goes ACTIVE */}
          <Text style={styles.stepSub}>Required so buyers can get an accurate shipping quote at checkout.</Text>

          {/* Parcel dimensions — 2×2 grid */}
          <Text style={styles.label}>Parcel dimensions</Text>
          <View style={styles.dimsGrid}>
            {([
              { key: 'l',      label: 'Length (cm)', kb: 'numeric' },
              { key: 'w',      label: 'Width (cm)',  kb: 'numeric' },
              { key: 'h',      label: 'Height (cm)', kb: 'numeric' },
              { key: 'weight', label: 'Weight (kg)', kb: 'decimal-pad' },
            ] as const).map(({ key, label, kb }) => (
              <View key={key} style={styles.dimField}>
                <Text style={styles.label}>{label}</Text>
                <TextInput
                  style={styles.input}
                  value={parcel[key]}
                  onChangeText={v => setParcel(p => ({ ...p, [key]: v }))}
                  keyboardType={kb as 'numeric' | 'decimal-pad'}
                  placeholder="0"
                  placeholderTextColor="#979797"
                />
              </View>
            ))}
          </View>

          {/* Locker size indicator */}
          {parcelComplete && (
            <View style={[styles.infoBox, fitsInLocker ? styles.infoBoxGreen : styles.infoBoxAmber]}>
              <Text style={[styles.infoBoxText, fitsInLocker ? { color: '#166534' } : { color: '#92400e' }]}>
                {fitsInLocker
                  ? `📦 Fits a ${LOCKER_SIZE_LABELS[lockerSize!]} (${lockerSize}) PUDO locker`
                  : '⚠ Too large for PUDO lockers — Door-to-Door only'
                }
              </Text>
            </View>
          )}

          {/* Shipping method cards */}
          <Text style={[styles.label, { marginTop: 16 }]}>
            Shipping methods <Text style={{ color: '#979797', fontWeight: '400' }}>(select at least one)</Text>
          </Text>

          {/* Door-to-Door — always available */}
          <TouchableOpacity
            onPress={() => toggleShipping('PICKUP')}
            style={[styles.shippingCard, shippingMethods.includes('PICKUP') && styles.shippingCardActive]}>
            <Text style={styles.shippingIcon}>🚚</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.shippingTitle, shippingMethods.includes('PICKUP') && { color: BLUE }]}>Door-to-Door pickup</Text>
              <Text style={styles.shippingSub}>A courier collects directly from your address</Text>
            </View>
            {shippingMethods.includes('PICKUP') && <Text style={{ color: BLUE, fontSize: 18, fontWeight: '700' }}>✓</Text>}
          </TouchableOpacity>

          {/* PUDO Locker — only if parcel fits */}
          <TouchableOpacity
            onPress={() => fitsInLocker && toggleShipping('PUDO_DROPOFF')}
            disabled={parcelComplete && !fitsInLocker}
            style={[
              styles.shippingCard,
              shippingMethods.includes('PUDO_DROPOFF') && styles.shippingCardActive,
              parcelComplete && !fitsInLocker && styles.shippingCardDisabled,
            ]}>
            <Text style={styles.shippingIcon}>📦</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.shippingTitle, shippingMethods.includes('PUDO_DROPOFF') && { color: BLUE }]}>PUDO Locker drop-off</Text>
              <Text style={styles.shippingSub}>
                {parcelComplete && !fitsInLocker
                  ? 'Not available — parcel too large for any locker'
                  : lockerSize
                    ? `Drop at nearest TCG locker · Needs ${LOCKER_SIZE_LABELS[lockerSize]} (${lockerSize})`
                    : 'Drop at your nearest The Courier Guy locker'
                }
              </Text>
            </View>
            {shippingMethods.includes('PUDO_DROPOFF') && <Text style={{ color: BLUE, fontSize: 18, fontWeight: '700' }}>✓</Text>}
          </TouchableOpacity>

          <View style={styles.rowBtns}>
            <TouchableOpacity style={[styles.btn, styles.btnOutline, { flex: 1 }]} onPress={prevStep}>
              <Text style={styles.btnOutlineText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, (!parcelComplete || !shippingComplete) && styles.btnDisabled, { flex: 2 }]}
              onPress={nextStep}
              disabled={!parcelComplete || !shippingComplete}>
              <Text style={styles.btnText}>Continue →</Text>
            </TouchableOpacity>
          </View>
        </>}

        {/* ── Step 5 — Review & Publish ──────────────────────── */}
        {step === 5 && <>
          <Text style={styles.stepTitle}>Review & Publish</Text>
          <Text style={styles.stepSub}>Check your listing before it goes live.</Text>

          <View style={styles.summaryBox}>
            <SummaryRow label="Category"  value={category} />
            {selectedSchool && <SummaryRow label="School" value={selectedSchool.name} />}
            <SummaryRow label="Title"     value={title} />
            {isMultiItem
              ? <SummaryRow label="Items" value={`${validItems.length} items · from R${Math.min(...validItems.map(i => parseFloat(i.price))).toFixed(2)}`} />
              : <SummaryRow label="Price" value={`R${price}`} />
            }
            {subcategory && <SummaryRow label="Subcategory" value={subcategory} />}
            <SummaryRow label="Condition" value={condition.replace(/_/g, ' ')} />
            {size   && <SummaryRow label="Size"   value={size} />}
            {gender && <SummaryRow label="Gender" value={gender} />}
            {grade  && <SummaryRow label="Grade"  value={`Grade ${grade}`} />}
            <SummaryRow label="Parcel"    value={`${parcel.l}×${parcel.w}×${parcel.h} cm · ${parcel.weight} kg`} />
            <SummaryRow label="Shipping"  value={shippingMethods.join(' + ')} />
          </View>

          <View style={styles.rowBtns}>
            <TouchableOpacity style={[styles.btn, styles.btnOutline, { flex: 1 }]} onPress={prevStep}>
              <Text style={styles.btnOutlineText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled, { flex: 2 }]} onPress={handleSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Publish 🚀</Text>}
            </TouchableOpacity>
          </View>
        </>}

      </ScrollView>
    </SafeAreaView>
  );
}

function BuyerPriceWidget({ sellerRands }: { sellerRands: number }) {
  const b = calculateBuyerPrice(sellerRands);
  return (
    <View style={styles.priceWidget}>
      <View style={styles.priceWidgetHeader}>
        <Text style={styles.priceWidgetTitle}>What the buyer pays</Text>
        <Text style={styles.priceWidgetSub}>Gross-up formula</Text>
      </View>
      <View style={styles.priceWidgetBody}>
        <PriceRow step="1" label="Your guaranteed payout"      value={fmtRands(b.sellerPayoutCents)} />
        <PriceRow step="2" label="+ School delivery fee"       value={fmtRands(b.subtotalCents)}     sub={`+${fmtRands(b.deliveryFeeCents)}`} />
        <PriceRow step="3" label="÷ (1-8%) NextKid markup"     value={fmtRands(b.afterMarkupCents)}  sub={`+${fmtRands(b.platformFeeCents)}`}  muted />
        <PriceRow step="4" label="÷ (1-2.5%) Stitch fee"       value={fmtRands(b.buyerRawCents)}     sub={`+${fmtRands(b.gatewayFeeCents)}`}   muted />
        <View style={styles.priceWidgetDivider} />
        <PriceRow step="5" label="Round UP to nearest R25"     value={fmtRands(b.buyerPriceCents)}   highlight />
        <PriceRow step="6" label="Admin fee (rounding surplus)" value={fmtRands(b.adminFeeCents)}    muted />
      </View>
      <View style={styles.priceWidgetFooter}>
        <View>
          <Text style={styles.priceFooterLabel}>Buyer pays</Text>
          <Text style={styles.priceFooterValue}>{fmtRands(b.buyerPriceCents)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.priceFooterLabel}>You receive</Text>
          <Text style={styles.priceFooterValueSm}>{fmtRands(b.sellerPayoutCents)}</Text>
        </View>
      </View>
      <Text style={styles.priceWidgetNote}>8% markup is for testing only — will be updated before going live</Text>
    </View>
  );
}

function PriceRow({ step, label, value, sub, muted, highlight }: {
  step: string; label: string; value: string;
  sub?: string; muted?: boolean; highlight?: boolean;
}) {
  return (
    <View style={styles.priceRow}>
      <View style={styles.priceStepBadge}>
        <Text style={styles.priceStepText}>{step}</Text>
      </View>
      <Text style={[styles.priceRowLabel, muted && styles.priceRowLabelMuted]} numberOfLines={1}>{label}</Text>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.priceRowValue, highlight && styles.priceRowValueHighlight, muted && styles.priceRowValueMuted]}>
          {value}
        </Text>
        {sub && <Text style={styles.priceRowSub}>({sub})</Text>}
      </View>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#dedede' }}>
      <Text style={{ color: '#979797', fontSize: 13 }}>{label}</Text>
      <Text style={{ color: '#111', fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

const BLUE   = '#BE1E2D';
const BORDER = '#dedede';
const SURF   = '#f4f4f4';

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#ffffff' },
  inner:              { padding: 20, paddingBottom: 60 },
  heading:            { color: '#111', fontSize: 24, fontWeight: '800', marginBottom: 12 },
  progressRow:        { flexDirection: 'row', gap: 6, marginBottom: 24 },
  progressDot:        { flex: 1, height: 4, borderRadius: 2, backgroundColor: BORDER },
  progressDotActive:  { backgroundColor: BLUE },
  stepTitle:          { color: '#111', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  stepSub:            { color: '#979797', fontSize: 13, marginBottom: 20 },
  label:              { color: '#111', fontSize: 12, fontWeight: '500', marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: SURF, borderWidth: 1, borderColor: BORDER,
    borderRadius: 12, padding: 12, color: '#111', fontSize: 14, marginBottom: 4,
  },
  categoryGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  categoryCard:       { width: '47%', padding: 14, borderRadius: 14, backgroundColor: SURF, borderWidth: 1.5, borderColor: BORDER },
  categoryCardActive: { borderColor: BLUE, backgroundColor: '#eef0fb' },
  categoryName:       { color: '#979797', fontSize: 13, fontWeight: '600' },
  categoryNameActive: { color: '#111' },
  schoolTag:          { color: BLUE, fontSize: 10, marginTop: 2 },
  chipRow:            { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  chip:               { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: SURF, borderWidth: 1, borderColor: BORDER },
  chipActive:         { backgroundColor: BLUE, borderColor: BLUE },
  chipText:           { color: '#111', fontSize: 12 },
  chipTextActive:     { color: '#fff', fontWeight: '600' },
  schoolList:         { borderWidth: 1, borderColor: BORDER, borderRadius: 12, marginBottom: 12, maxHeight: 220, backgroundColor: '#fff' },
  schoolRow:          { padding: 12, borderBottomWidth: 1, borderBottomColor: BORDER, flexDirection: 'row', alignItems: 'center' },
  schoolRowActive:    { backgroundColor: '#eef0fb' },
  schoolCard:         { flexDirection: 'row', alignItems: 'center', padding: 16, borderWidth: 2, borderColor: BORDER, borderRadius: 14, backgroundColor: '#fff' },
  schoolCardActive:   { borderColor: BLUE, backgroundColor: '#eef0fb' },
  switchLink:         { color: BLUE, fontSize: 12, textDecorationLine: 'underline', marginTop: 4 },
  schoolName:         { color: '#111', fontSize: 13, fontWeight: '600' },
  schoolSub:          { color: '#979797', fontSize: 11 },
  emptyText:          { color: '#979797', textAlign: 'center', padding: 16, fontSize: 13 },
  selectedBanner:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#eef0fb', borderWidth: 1, borderColor: BLUE, borderRadius: 12, padding: 12, marginBottom: 16 },
  selectedBannerText: { color: BLUE, fontSize: 13, fontWeight: '600' },
  // Parcel + shipping styles
  dimsGrid:           { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  dimField:           { width: '47%' },
  infoBox:            { borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1 },
  infoBoxGreen:       { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  infoBoxAmber:       { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  infoBoxText:        { fontSize: 13, fontWeight: '500' },
  shippingCard:       { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderWidth: 2, borderColor: BORDER, borderRadius: 14, backgroundColor: '#fff', marginBottom: 10 },
  shippingCardActive: { borderColor: BLUE, backgroundColor: '#eef0fb' },
  shippingCardDisabled: { opacity: 0.45 },
  shippingIcon:       { fontSize: 24 },
  shippingTitle:      { color: '#111', fontSize: 14, fontWeight: '600' },
  shippingSub:        { color: '#979797', fontSize: 12, marginTop: 2 },
  summaryBox:         { backgroundColor: SURF, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: BORDER, marginBottom: 20 },
  rowBtns:            { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn:                { backgroundColor: BLUE, borderRadius: 30, padding: 15, alignItems: 'center' },
  btnDisabled:        { backgroundColor: '#dedede' },
  btnText:            { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnOutline:         { backgroundColor: 'transparent', borderWidth: 1, borderColor: BORDER },
  btnOutlineText:     { color: '#979797', fontWeight: '600', fontSize: 15 },
  successBox:         { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successTitle:       { color: '#111', fontSize: 26, fontWeight: '800', marginBottom: 8 },
  successSub:         { color: '#979797', fontSize: 14, marginBottom: 32, textAlign: 'center' },

  // Multi-item toggle
  multiToggleRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: SURF, borderRadius: 14, borderWidth: 1, borderColor: BORDER, marginBottom: 4 },
  multiToggleTitle: { color: '#111', fontSize: 13, fontWeight: '600', marginBottom: 2 },
  multiToggleSub:   { color: '#979797', fontSize: 11, lineHeight: 16 },
  toggle:           { width: 44, height: 24, borderRadius: 12, backgroundColor: BORDER, justifyContent: 'center', paddingHorizontal: 3, flexShrink: 0 },
  toggleOn:         { backgroundColor: BLUE },
  toggleThumb:      { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 },
  toggleThumbOn:    { alignSelf: 'flex-end' },

  // Per-item cards
  itemCard:       { borderWidth: 1, borderColor: BORDER, borderRadius: 14, padding: 14, marginBottom: 10, backgroundColor: '#fff' },
  itemCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  itemCardNum:    { color: '#979797', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  addItemBtn:     { borderWidth: 1.5, borderStyle: 'dashed' as const, borderColor: BLUE, borderRadius: 14, paddingVertical: 12, alignItems: 'center', marginBottom: 8 },
  addItemBtnText: { color: BLUE, fontSize: 13, fontWeight: '600' },
  itemsSummary:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: SURF, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  itemsSummaryText:  { color: '#979797', fontSize: 12 },
  itemsSummaryTotal: { color: BLUE, fontSize: 14, fontWeight: '700' },

  // Buyer price widget
  priceWidget:           { marginTop: 10, marginBottom: 8, borderRadius: 14, borderWidth: 1, borderColor: BORDER, backgroundColor: SURF, overflow: 'hidden' },
  priceWidgetHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: BORDER, backgroundColor: '#fff' },
  priceWidgetTitle:      { color: '#979797', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  priceWidgetSub:        { color: '#979797', fontSize: 9 },
  priceWidgetBody:       { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4, gap: 7 },
  priceWidgetDivider:    { height: 1, backgroundColor: BORDER, marginVertical: 3 },
  priceWidgetFooter:     { margin: 10, backgroundColor: BLUE, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceWidgetNote:       { color: '#979797', fontSize: 9, textAlign: 'center', paddingBottom: 10 },
  priceFooterLabel:      { color: 'rgba(255,255,255,0.7)', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 },
  priceFooterValue:      { color: '#fff', fontSize: 18, fontWeight: '800' },
  priceFooterValueSm:    { color: '#fff', fontSize: 14, fontWeight: '600' },
  priceRow:              { flexDirection: 'row', alignItems: 'center', gap: 7 },
  priceStepBadge:        { width: 16, height: 16, borderRadius: 8, backgroundColor: BORDER, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  priceStepText:         { color: '#555', fontSize: 7, fontWeight: '700' },
  priceRowLabel:         { flex: 1, color: '#555', fontSize: 10 },
  priceRowLabelMuted:    { color: '#979797' },
  priceRowValue:         { color: '#111', fontSize: 10, fontWeight: '600' },
  priceRowValueHighlight:{ color: BLUE },
  priceRowValueMuted:    { color: '#979797' },
  priceRowSub:           { color: '#979797', fontSize: 8 },
});
