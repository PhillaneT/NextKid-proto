import { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/src/lib/supabase';
import { WEB_API_BASE } from '@/src/lib/api';
import {
  Shirt, Trophy, Footprints, Dumbbell, BookOpen, ShoppingBag, Package,
} from 'lucide-react-native';
import {
  ALL_CATEGORIES, SCHOOL_SPECIFIC_CATEGORIES, SUBCATEGORIES,
  SA_PROVINCES, SHOE_SIZE_GROUPS, SELLER_CONDITIONS,
  buildListingTitle,
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
  const isOptionalSchool = isSchoolSpecific || category === 'Books & Stationery';
  const showsSchoolStep  = isOptionalSchool;

  // Step 2
  const [province, setProvince]           = useState('');
  const [schools, setSchools]             = useState<School[]>([]);
  const [schoolSearch, setSchoolSearch]   = useState('');
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [profileSchools, setProfileSchools] = useState<School[]>([]);

  // Step 3
  const [subcategory, setSubcategory] = useState('');
  const [condition, setCondition]     = useState<typeof SELLER_CONDITIONS[number]>('good');
  const [price, setPrice]             = useState('');
  const [size, setSize]               = useState('');
  const [description, setDescription] = useState('');

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
  // School drop-off only makes sense if this listing is tied to a school
  const hasSchoolContext = selectedSchool !== null || profileSchools.length > 0;

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

  const searchSchools = async (q: string, prov: string) => {
    if (q.trim().length < 2) { setSchools([]); return; }
    setLoadingSchools(true);
    try {
      const params = new URLSearchParams({ q: q.trim(), limit: '20' });
      if (prov) params.set('province', prov);
      const res  = await fetch(`${WEB_API_BASE}/api/locations/schools/search?${params}`);
      const data = await res.json();
      setSchools(Array.isArray(data) ? data as School[] : []);
    } catch { setSchools([]); }
    setLoadingSchools(false);
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

  const handleSubmit = async () => {
    if (!price) { Alert.alert('Missing fields', 'Price is required.'); return; }
    if (!parcelComplete || !shippingComplete) {
      Alert.alert('Incomplete', 'Please fill in parcel dimensions and select at least one shipping method.');
      return;
    }

    const priceCents = Math.round(parseFloat(price) * 100);

    if (isNaN(priceCents) || priceCents <= 0) {
      Alert.alert('Invalid price', 'Enter a valid price.'); return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: prof } = await supabase.from('profiles')
      .select('province, city_id, city_name, suburb_id, suburb_name, school_id, school_name')
      .eq('id', user.id).single();

    const sellerPayoutRands = parseFloat(price);
    const buyerPriceCents = calculateBuyerPrice(sellerPayoutRands).buyerPriceCents;

    const { data: newListing, error } = await supabase.from('listings').insert({
      seller_id:            user.id,
      title:                buildListingTitle(category, subcategory, size),
      description:          description.trim() || null,
      price_cents:          buyerPriceCents,
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

      parcel_length_cm:     parcelDims!.lengthCm,
      parcel_width_cm:      parcelDims!.widthCm,
      parcel_height_cm:     parcelDims!.heightCm,
      parcel_weight_kg:     parcelDims!.weightKg,
      shipping_methods:     shippingMethods,
    }).select('id').single();

    if (error || !newListing) { setLoading(false); Alert.alert('Error', error?.message ?? 'Unknown error'); return; }

    setLoading(false);
    setSuccess(true);
  };

  const reset = () => {
    setStep(1); setCategory(''); setSelectedSchool(null); setProvince('');
    setPrice(''); setSize(''); setDescription('');
    setSubcategory(''); setCondition('good');
    setParcel({ l: '', w: '', h: '', weight: '' }); setShippingMethods([]);
    setSuccess(false);
  };

  const TOTAL_STEPS = showsSchoolStep ? 5 : 4;
  const displayStep = step === 1 ? 1 : step === 2 ? 2 : showsSchoolStep ? step : step - 1;

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
                {(SCHOOL_SPECIFIC_CATEGORIES.includes(cat as typeof SCHOOL_SPECIFIC_CATEGORIES[number]) || cat === 'Books & Stationery') && (
                  <Text style={styles.schoolTag}>Can link to school</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={[styles.btn, !category && styles.btnDisabled]} onPress={nextStep} disabled={!category}>
            <Text style={styles.btnText}>Continue →</Text>
          </TouchableOpacity>
        </>}

        {/* ── Step 2 — School picker ─────────────────────────── */}
        {step === 2 && showsSchoolStep && <>
          <Text style={styles.stepTitle}>Link to a school? (optional)</Text>
          <Text style={styles.stepSub}>Linking your item to a school helps the right buyers find it. You can skip this if it's not school-specific.</Text>

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
                    onPress={() => { setProvince(p); setSchools([]); setSchoolSearch(''); setSelectedSchool(null); }}
                    style={[styles.chip, province === p && styles.chipActive]}>
                    <Text style={[styles.chipText, province === p && styles.chipTextActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>Search school (type at least 2 letters)</Text>
              <TextInput style={styles.input} value={schoolSearch}
                onChangeText={v => { setSchoolSearch(v); searchSchools(v, province); }}
                placeholder="e.g. Noordwyk, Hoërskool..." placeholderTextColor="#979797" />
              {schoolSearch.trim().length >= 2 && (
                <View style={styles.schoolList}>
                  {loadingSchools
                    ? <ActivityIndicator color={BLUE} style={{ padding: 16 }} />
                    : schools.length === 0
                      ? <Text style={styles.emptyText}>No schools found — try a shorter name.</Text>
                      : schools.map(school => (
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
              )}
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
            <TouchableOpacity style={[styles.btn, styles.btnOutline, { flex: 1 }]}
              onPress={() => { setSelectedSchool(null); setStep(3); }}>
              <Text style={styles.btnOutlineText}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, { flex: 2 }]} onPress={nextStep}>
              <Text style={styles.btnText}>Continue →</Text>
            </TouchableOpacity>
          </View>
        </>}

        {/* ── Step 3 — Item details ──────────────────────────── */}
        {step === 3 && <>
          <Text style={styles.stepTitle}>Item details</Text>

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
            {SELLER_CONDITIONS.map(c => (
              <TouchableOpacity key={c} onPress={() => setCondition(c)} style={[styles.chip, condition === c && styles.chipActive]}>
                <Text style={[styles.chipText, condition === c && styles.chipTextActive]}>{c.charAt(0).toUpperCase() + c.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Size</Text>
          {category === 'Shoes' ? (
            <>
              {SHOE_SIZE_GROUPS.map(group => (
                <View key={group.label}>
                  <Text style={[styles.label, { color: '#979797', fontSize: 10, marginTop: 4 }]}>{group.label} (UK)</Text>
                  <View style={styles.chipRow}>
                    {group.sizes.map(s => (
                      <TouchableOpacity key={s} onPress={() => setSize(s)} style={[styles.chip, size === s && styles.chipActive]}>
                        <Text style={[styles.chipText, size === s && styles.chipTextActive]}>{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </>
          ) : (
            <TextInput style={styles.input} value={size} onChangeText={setSize}
              placeholder="e.g. Size 32, UK 8, Grade 5" placeholderTextColor="#979797" />
          )}

          <Text style={styles.label}>Price (R) *</Text>
          <TextInput style={styles.input} value={price} onChangeText={setPrice}
            placeholder="250" placeholderTextColor="#979797" keyboardType="numeric" />
          {parseFloat(price) >= 10 && <BuyerPriceWidget sellerRands={parseFloat(price)} />}

          <Text style={styles.label}>Description (optional)</Text>
          <TextInput style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
            value={description} onChangeText={t => setDescription(t.slice(0, 100))}
            placeholder="e.g. Still in good condition, selling because my child outgrew it"
            placeholderTextColor="#979797" multiline maxLength={100} />
          <Text style={styles.charCount}>{description.length}/100</Text>

          <View style={styles.rowBtns}>
            <TouchableOpacity style={[styles.btn, styles.btnOutline, { flex: 1 }]} onPress={prevStep}>
              <Text style={styles.btnOutlineText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, !price && styles.btnDisabled, { flex: 2 }]}
              onPress={nextStep}
              disabled={!price}>
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

          {/* School drop-off — only shown if this listing is tied to a school */}
          {hasSchoolContext && (
            <TouchableOpacity
              onPress={() => toggleShipping('SCHOOL_DROPOFF')}
              style={[styles.shippingCard, shippingMethods.includes('SCHOOL_DROPOFF') && styles.shippingCardActive]}>
              <Text style={styles.shippingIcon}>🏫</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.shippingTitle, shippingMethods.includes('SCHOOL_DROPOFF') && { color: BLUE }]}>School drop-off — R20</Text>
                <Text style={styles.shippingSub}>Drop off at school for buyers from the same school to collect — flat R20 fee</Text>
              </View>
              {shippingMethods.includes('SCHOOL_DROPOFF') && <Text style={{ color: BLUE, fontSize: 18, fontWeight: '700' }}>✓</Text>}
            </TouchableOpacity>
          )}

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
            <SummaryRow label="Listing title" value={buildListingTitle(category, subcategory, size)} />
            <SummaryRow label="Price"     value={`R${price}`} />
            {subcategory && <SummaryRow label="Subcategory" value={subcategory} />}
            <SummaryRow label="Condition" value={condition.charAt(0).toUpperCase() + condition.slice(1)} />
            {size && <SummaryRow label="Size" value={size} />}
            {description && <SummaryRow label="Description" value={description} />}
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
        <PriceRow step="3" label="÷ (1-7.5%) NextKid markup"   value={fmtRands(b.afterMarkupCents)}  sub={`+${fmtRands(b.platformFeeCents)}`}  muted />
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
      <Text style={styles.priceWidgetNote}>7.5% markup is for testing only — will be updated before going live</Text>
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
  charCount:          { color: '#979797', fontSize: 11, textAlign: 'right', marginBottom: 4 },
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
