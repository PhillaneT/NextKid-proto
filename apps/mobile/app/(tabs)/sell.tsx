import { useState, useEffect } from 'react';
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
} from '@nextkid/shared';
import type { ListingCategory, School } from '@nextkid/shared';

function CategoryIcon({ name, color }: { name: string; color: string }) {
  const props = { size: 28, strokeWidth: 2, color };
  switch (name) {
    case 'School Uniforms': return <Shirt {...props} />;
    case 'School Sports Kit': return <Trophy {...props} />;
    case 'Shoes': return <Footprints {...props} />;
    case 'Sports Equipment': return <Dumbbell {...props} />;
    case 'Books & Stationery': return <BookOpen {...props} />;
    case 'Bags & Accessories': return <ShoppingBag {...props} />;
    default: return <Package {...props} />;
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

type Step = 1 | 2 | 3 | 4;

export default function SellScreen() {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [category, setCategory] = useState<ListingCategory | ''>('');
  const isSchoolSpecific = SCHOOL_SPECIFIC_CATEGORIES.includes(category as typeof SCHOOL_SPECIFIC_CATEGORIES[number]);

  const [province, setProvince] = useState('');
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolSearch, setSchoolSearch] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [profileSchools, setProfileSchools] = useState<School[]>([]);

  const [title, setTitle] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [price, setPrice] = useState('');
  const [condition, setCondition] = useState<typeof LISTING_CONDITIONS[number]>('good');
  const [size, setSize] = useState('');
  const [gender, setGender] = useState<'boys' | 'girls' | 'unisex' | ''>('');
  const [grade, setGrade] = useState('');
  const [description, setDescription] = useState('');

  // Load user's saved schools from their profile on mount
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: prof } = await supabase.from('profiles').select('school_ids, province').eq('id', user.id).single();
      if (prof?.province) setProvince(prof.province);
      if (prof?.school_ids?.length) {
        const { data: saved } = await supabase.from('schools').select('*').in('id', prof.school_ids).order('name');
        setProfileSchools((saved as School[]) ?? []);
      }
    });
  }, []);

  useEffect(() => {
    if (!province) { setSchools([]); return; }
    setLoadingSchools(true);
    supabase.from('schools').select('*').eq('province', province).order('name')
      .then(({ data }) => { setSchools((data as School[]) ?? []); setLoadingSchools(false); });
  }, [province]);

  const filteredSchools = schools.filter(s =>
    s.name.toLowerCase().includes(schoolSearch.toLowerCase())
  );

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

  const handleSubmit = async () => {
    if (!title || !price) { Alert.alert('Missing fields', 'Title and price are required.'); return; }
    const priceZarCents = Math.round(parseFloat(price) * 100);
    if (isNaN(priceZarCents) || priceZarCents <= 0) { Alert.alert('Invalid price', 'Enter a valid price.'); return; }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // RULE: price stored in cents — matches Peach Payments ZAR format
    const { error } = await supabase.from('items').insert({
      seller_id: user.id,
      title: title.trim(),
      category,
      subcategory: subcategory || null,
      price: priceZarCents,
      condition,
      is_school_specific: isSchoolSpecific,
      school_id: selectedSchool?.id ?? null,
      size: size || null,
      gender: gender || null,
      grade: grade ? parseInt(grade) : null,
      description_part1: description.trim() || null,
      images: [],
    });

    setLoading(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setSuccess(true);
  };

  const reset = () => {
    setStep(1); setCategory(''); setSelectedSchool(null); setProvince('');
    setTitle(''); setPrice(''); setCondition('good'); setSize('');
    setGender(''); setGrade(''); setDescription(''); setSubcategory('');
    setSuccess(false);
  };

  const TOTAL_STEPS = isSchoolSpecific ? 4 : 3;
  const displayStep = step === 1 ? 1 : step === 2 ? 2 : isSchoolSpecific ? step : step - 1;

  if (success) return (
    <SafeAreaView style={styles.container}>
      <View style={styles.successBox}>
        <Text style={{ fontSize: 64, marginBottom: 16 }}>🎉</Text>
        <Text style={styles.successTitle}>Listing Created!</Text>
        <Text style={styles.successSub}>Your item is now live on NextKid.</Text>
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

        {/* Step 1 — Category */}
        {step === 1 && <>
          <Text style={styles.stepTitle}>What are you selling?</Text>
          <Text style={styles.stepSub}>Choose the category that best fits your item.</Text>
          <View style={styles.categoryGrid}>
            {ALL_CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                onPress={() => setCategory(cat)}
                style={[styles.categoryCard, category === cat && styles.categoryCardActive]}
              >
                <View style={{ marginBottom: 8 }}>
                  <CategoryIcon name={cat} color={category === cat ? CORAL : '#979797'} />
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

        {/* Step 2 — School picker */}
        {step === 2 && isSchoolSpecific && <>
          <Text style={styles.stepTitle}>Which school?</Text>
          <Text style={styles.stepSub}>
            {profileSchools.length > 0
              ? 'Select which of your schools this item belongs to.'
              : 'Link this listing to a school so the right buyers find it.'}
          </Text>

          {profileSchools.length > 0 ? (
            /* User has saved schools — show them as simple cards */
            <View style={{ gap: 10, marginBottom: 12 }}>
              {profileSchools.map(school => (
                <TouchableOpacity key={school.id} onPress={() => setSelectedSchool(school)}
                  style={[styles.schoolCard, selectedSchool?.id === school.id && styles.schoolCardActive]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.schoolName, selectedSchool?.id === school.id && { color: CORAL }]}>{school.name}</Text>
                    <Text style={styles.schoolSub}>{school.city}</Text>
                  </View>
                  {selectedSchool?.id === school.id && (
                    <Text style={{ color: CORAL, fontSize: 18, fontWeight: '700' }}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => setProfileSchools([])}>
                <Text style={styles.switchLink}>Wrong school? Search all schools instead →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* No saved schools — full province + search flow */
            <>
              <Text style={styles.label}>Province</Text>
              <View style={styles.chipRow}>
                {SA_PROVINCES.map(p => (
                  <TouchableOpacity key={p} onPress={() => { setProvince(p); setSchoolSearch(''); setSelectedSchool(null); }}
                    style={[styles.chip, province === p && styles.chipActive]}>
                    <Text style={[styles.chipText, province === p && styles.chipTextActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {province && <>
                <Text style={styles.label}>Search school</Text>
                <TextInput style={styles.input} value={schoolSearch} onChangeText={setSchoolSearch} placeholder="Type school name..." placeholderTextColor="#979797" />
                <View style={styles.schoolList}>
                  {loadingSchools
                    ? <ActivityIndicator color={CORAL} style={{ padding: 16 }} />
                    : filteredSchools.length === 0
                      ? <Text style={styles.emptyText}>No schools found.</Text>
                      : filteredSchools.map(school => (
                        <TouchableOpacity key={school.id} onPress={() => setSelectedSchool(school)}
                          style={[styles.schoolRow, selectedSchool?.id === school.id && styles.schoolRowActive]}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.schoolName}>{school.name}</Text>
                            <Text style={styles.schoolSub}>{school.city} · {school.type}</Text>
                          </View>
                          {selectedSchool?.id === school.id && <Text style={{ color: CORAL, fontSize: 16, fontWeight: '700' }}>✓</Text>}
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

        {/* Step 3 — Details */}
        {step === 3 && <>
          <Text style={styles.stepTitle}>Item details</Text>

          <Text style={styles.label}>Title *</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Grey flannel trousers size 32" placeholderTextColor="#979797" />

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
                <Text style={[styles.chipText, condition === c && styles.chipTextActive]}>{c.replace('_', ' ')}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Context-aware fields — only show what makes sense for the chosen category */}
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
                      <TouchableOpacity key={s} onPress={() => setSize(String(s))} style={[styles.chip, size === String(s) && styles.chipActive]}>
                        <Text style={[styles.chipText, size === String(s) && styles.chipTextActive]}>{s}</Text>
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

          <Text style={styles.label}>Price (R) *</Text>
          <TextInput style={styles.input} value={price} onChangeText={setPrice} placeholder="250" placeholderTextColor="#979797" keyboardType="numeric" />

          <Text style={styles.label}>Description</Text>
          <TextInput style={[styles.input, { height: 90, textAlignVertical: 'top' }]} value={description} onChangeText={setDescription}
            placeholder="Condition, why you're selling, any defects..." placeholderTextColor="#979797" multiline />

          <View style={styles.rowBtns}>
            <TouchableOpacity style={[styles.btn, styles.btnOutline, { flex: 1 }]} onPress={prevStep}>
              <Text style={styles.btnOutlineText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, (!title || !price) && styles.btnDisabled, { flex: 2 }]} onPress={nextStep} disabled={!title || !price}>
              <Text style={styles.btnText}>Continue →</Text>
            </TouchableOpacity>
          </View>
        </>}

        {/* Step 4 — Review & publish */}
        {step === 4 && <>
          <Text style={styles.stepTitle}>Review & Publish</Text>
          <Text style={styles.stepSub}>Check your listing before it goes live.</Text>

          <View style={styles.summaryBox}>
            <SummaryRow label="Category" value={category} />
            {selectedSchool && <SummaryRow label="School" value={selectedSchool.name} />}
            <SummaryRow label="Title" value={title} />
            <SummaryRow label="Price" value={`R${price}`} />
            {subcategory && <SummaryRow label="Subcategory" value={subcategory} />}
            <SummaryRow label="Condition" value={condition.replace('_', ' ')} />
            {size && <SummaryRow label="Size" value={size} />}
            {gender && <SummaryRow label="Gender" value={gender} />}
            {grade && <SummaryRow label="Grade" value={`Grade ${grade}`} />}
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#dedede' }}>
      <Text style={{ color: '#979797', fontSize: 13 }}>{label}</Text>
      <Text style={{ color: '#111', fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

const CORAL = '#4757bf';
const BORDER = '#dedede';
const SURFACE = '#f4f4f4';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  inner: { padding: 20, paddingBottom: 60 },
  heading: { color: '#111', fontSize: 24, fontWeight: '800', marginBottom: 12 },
  progressRow: { flexDirection: 'row', gap: 6, marginBottom: 24 },
  progressDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: BORDER },
  progressDotActive: { backgroundColor: CORAL },
  stepTitle: { color: '#111', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  stepSub: { color: '#979797', fontSize: 13, marginBottom: 20 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  categoryCard: {
    width: '47%', padding: 14, borderRadius: 14,
    backgroundColor: SURFACE, borderWidth: 1.5, borderColor: BORDER,
  },
  categoryCardActive: { borderColor: CORAL, backgroundColor: '#eef0fb' },
  categoryName: { color: '#979797', fontSize: 13, fontWeight: '600' },
  categoryNameActive: { color: '#111' },
  schoolTag: { color: CORAL, fontSize: 10, marginTop: 2 },
  label: { color: '#111', fontSize: 12, fontWeight: '500', marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER,
    borderRadius: 12, padding: 12, color: '#111', fontSize: 14, marginBottom: 4,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER },
  chipActive: { backgroundColor: CORAL, borderColor: CORAL },
  chipText: { color: '#111', fontSize: 12 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  schoolList: { borderWidth: 1, borderColor: BORDER, borderRadius: 12, marginBottom: 12, maxHeight: 220, backgroundColor: '#fff' },
  schoolRow: { padding: 12, borderBottomWidth: 1, borderBottomColor: BORDER, flexDirection: 'row', alignItems: 'center' },
  schoolRowActive: { backgroundColor: '#eef0fb' },
  schoolCard: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    borderWidth: 2, borderColor: BORDER, borderRadius: 14, backgroundColor: '#fff',
  },
  schoolCardActive: { borderColor: CORAL, backgroundColor: '#eef0fb' },
  switchLink: { color: CORAL, fontSize: 12, textDecorationLine: 'underline', marginTop: 4 },
  schoolName: { color: '#111', fontSize: 13, fontWeight: '600' },
  schoolSub: { color: '#979797', fontSize: 11 },
  emptyText: { color: '#979797', textAlign: 'center', padding: 16, fontSize: 13 },
  selectedBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff0ee', borderWidth: 1, borderColor: CORAL,
    borderRadius: 12, padding: 12, marginBottom: 16,
  },
  selectedBannerText: { color: CORAL, fontSize: 13, fontWeight: '600' },
  summaryBox: { backgroundColor: SURFACE, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: BORDER, marginBottom: 20 },
  rowBtns: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: { backgroundColor: CORAL, borderRadius: 30, padding: 15, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#dedede' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: BORDER },
  btnOutlineText: { color: '#979797', fontWeight: '600', fontSize: 15 },
  successBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successTitle: { color: '#111', fontSize: 26, fontWeight: '800', marginBottom: 8 },
  successSub: { color: '#979797', fontSize: 14, marginBottom: 32, textAlign: 'center' },
});
