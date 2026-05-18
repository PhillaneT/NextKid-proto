import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { supabase } from '@/src/lib/supabase';
import { WEB_API_BASE } from '@/src/lib/api';
import { SA_PROVINCES } from '@nextkid/shared';

type Step = 1 | 2 | 3;

interface CityOption   { id: string; name: string }
interface SuburbOption { id: string; name: string }
interface SchoolOption { id: string; name: string; type: string; suburb_name: string; city_name: string }

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep]         = useState<Step>(1);
  const [userId, setUserId]     = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [saving, setSaving]     = useState(false);

  // Step 1
  const [fullName, setFullName] = useState('');

  // Step 2 — optional DOB
  const [dob, setDob] = useState('');

  // Step 3 — location cascade
  const [province, setProvince]     = useState('');
  const [cities, setCities]         = useState<CityOption[]>([]);
  const [cityId, setCityId]         = useState('');
  const [cityName, setCityName]     = useState('');
  const [suburbs, setSuburbs]       = useState<SuburbOption[]>([]);
  const [suburbId, setSuburbId]     = useState('');
  const [suburbName, setSuburbName] = useState('');
  const [schools, setSchools]             = useState<SchoolOption[]>([]);
  const [schoolSearch, setSchoolSearch]   = useState('');
  const [globalSchools, setGlobalSchools] = useState<SchoolOption[]>([]);
  const [searchingSchools, setSearchingSchools] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<SchoolOption | null>(null);

  const [loadingCities, setLoadingCities]   = useState(false);
  const [loadingSuburbs, setLoadingSuburbs] = useState(false);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);

  // Refs to suppress cascade resets during GPS auto-fill
  const skipProvinceRef = useRef('');
  const skipCityRef     = useRef('');

  // Which cascade panel is expanded: 'city' | 'suburb' | 'school' | null
  const [expandedPanel, setExpandedPanel] = useState<'city' | 'suburb' | 'school' | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace('/' as never); return; }
      setUserId(user.id);
      setUserEmail(user.email ?? '');
      supabase.from('profiles').select('profile_completed_at').eq('id', user.id).single()
        .then(({ data }) => { if (data?.profile_completed_at) router.replace('/(tabs)' as never); });
    });
  }, []);

  // Fetch cities when province changes
  useEffect(() => {
    if (!province) { setCities([]); setCityId(''); setCityName(''); return; }
    // Skip cascade reset when GPS auto-fill has pre-populated city/suburb
    if (skipProvinceRef.current === province) { skipProvinceRef.current = ''; return; }
    setLoadingCities(true);
    supabase.from('cities').select('id, name').eq('province_code', province).order('name')
      .then(({ data }) => { setCities(data ?? []); setLoadingCities(false); });
    // Reset downstream
    setCityId(''); setCityName(''); setSuburbs([]); setSuburbId(''); setSuburbName('');
    setSchools([]); setSelectedSchool(null); setSchoolSearch('');
    setExpandedPanel('city');
  }, [province]);

  // Fetch suburbs when city changes
  useEffect(() => {
    if (!cityId) { setSuburbs([]); setSuburbId(''); setSuburbName(''); return; }
    // Skip cascade reset when GPS auto-fill has pre-populated suburb
    if (skipCityRef.current === cityId) { skipCityRef.current = ''; return; }
    setLoadingSuburbs(true);
    supabase.from('suburbs').select('id, name').eq('city_id', cityId).order('name')
      .then(({ data }) => { setSuburbs(data ?? []); setLoadingSuburbs(false); });
    // Reset downstream
    setSuburbId(''); setSuburbName(''); setSchools([]); setSelectedSchool(null); setSchoolSearch('');
    setExpandedPanel('suburb');
  }, [cityId]);

  // Fetch schools by suburb/city for the location-based list (shown when no search query)
  useEffect(() => {
    if (!suburbId && !cityId) { setSchools([]); setSelectedSchool(null); return; }
    setLoadingSchools(true);
    const query = suburbId
      ? supabase.from('schools').select('id, name, type, suburb_name, city_name').eq('suburb_id', suburbId).eq('is_active', true).order('name')
      : supabase.from('schools').select('id, name, type, suburb_name, city_name').eq('city_id', cityId).eq('is_active', true).order('name').limit(100);
    query.then(({ data }) => { setSchools(data ?? []); setLoadingSchools(false); });
    setSelectedSchool(null); setSchoolSearch('');
    setExpandedPanel('school');
  }, [suburbId, cityId]);

  // Debounced global school search — searches all 25k+ SA schools as user types
  useEffect(() => {
    if (schoolSearch.trim().length < 2) { setGlobalSchools([]); return; }
    const timer = setTimeout(async () => {
      setSearchingSchools(true);
      try {
        const res = await fetch(`${WEB_API_BASE}/api/locations/schools/search?q=${encodeURIComponent(schoolSearch.trim())}&limit=20`);
        const data = await res.json();
        setGlobalSchools(Array.isArray(data) ? data as SchoolOption[] : []);
      } catch { setGlobalSchools([]); }
      finally { setSearchingSchools(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [schoolSearch]);

  const handleDetectLocation = async () => {
    setDetectingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Permission', 'Permission denied. Please select your location manually below.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [geo] = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      // geo.subregion = suburb, geo.city = city, geo.region = province, geo.postalCode
      const searchTerm = geo.subregion || geo.district || geo.city || '';
      if (!searchTerm && !geo.postalCode) {
        Alert.alert('Location Not Found', 'Could not determine your suburb. Please select manually.');
        return;
      }
      // Search our suburbs table by name or postal code
      const { data } = await (searchTerm
        ? supabase.from('suburbs').select('id, name, city_id, city_name, province_code').ilike('name', `%${searchTerm}%`).limit(3)
        : supabase.from('suburbs').select('id, name, city_id, city_name, province_code').eq('postal_code', geo.postalCode!).limit(3)
      );
      if (!data || data.length === 0) {
        Alert.alert('Location Not Found', `Couldn't match "${searchTerm}" to a suburb in our database. Please select manually.`);
        return;
      }
      const suburb = data[0];
      // Pre-fetch dropdown lists so the cascade pickers are correctly populated
      const [{ data: citiesData }, { data: suburbsData }] = await Promise.all([
        supabase.from('cities').select('id, name').eq('province_code', suburb.province_code).order('name'),
        supabase.from('suburbs').select('id, name').eq('city_id', suburb.city_id).order('name'),
      ]);
      // Set refs BEFORE state to prevent cascade useEffects from resetting our values
      skipProvinceRef.current = suburb.province_code;
      skipCityRef.current     = suburb.city_id;
      setProvince(suburb.province_code);
      setCities(citiesData ?? []);
      setCityId(suburb.city_id);
      setCityName(suburb.city_name);
      setSuburbs(suburbsData ?? []);
      setSuburbId(suburb.id);
      setSuburbName(suburb.name);
      setExpandedPanel('school');
    } catch {
      Alert.alert('Location Error', 'Could not detect location. Please select manually.');
    } finally {
      setDetectingLocation(false);
    }
  };

  const isGlobalSearch  = schoolSearch.trim().length >= 2;
  const filteredSchools = isGlobalSearch ? globalSchools : schools;

  const locationComplete = !!(province && cityId && suburbId);

  const handleFinish = async () => {
    if (!locationComplete) { Alert.alert('Required', 'Please select your province, city, and suburb.'); return; }
    setSaving(true);

    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      email: userEmail,
      full_name: fullName,
      date_of_birth: dob || null,
      role: 'buyer',

      province,
      city_id: cityId,
      city_name: cityName,
      suburb_id: suburbId,
      suburb_name: suburbName,

      school_id: selectedSchool?.id ?? null,
      school_name: selectedSchool?.name ?? null,
      school_ids: selectedSchool ? [selectedSchool.id] : [],

      // RULE: profile_completed_at gates all buying and listing
      profile_completed_at: new Date().toISOString(),
    });

    setSaving(false);
    if (error) { Alert.alert('Error', 'Something went wrong. Please try again.'); return; }
    router.replace('/(tabs)' as never);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>NextKid</Text>

        {/* Progress bar */}
        <View style={styles.progressRow}>
          {([1, 2, 3] as Step[]).map(s => (
            <View key={s} style={[styles.progressDot, step >= s && styles.progressDotActive]} />
          ))}
        </View>

        {/* ── Step 1: Name ──────────────────────────────────── */}
        {step === 1 && <>
          <Text style={styles.title}>Welcome! 👋</Text>
          <Text style={styles.subtitle}>Let's get your account set up.</Text>
          <Text style={styles.label}>Full Name</Text>
          <TextInput style={styles.input} value={fullName} onChangeText={setFullName}
            placeholder="Your full name" placeholderTextColor="#979797" autoCapitalize="words" />
          <TouchableOpacity style={[styles.btn, !fullName && styles.btnDisabled]} onPress={() => setStep(2)} disabled={!fullName}>
            <Text style={styles.btnText}>Continue →</Text>
          </TouchableOpacity>
        </>}

        {/* ── Step 2: Date of birth (optional) ─────────────── */}
        {step === 2 && <>
          <Text style={styles.title}>Date of birth</Text>
          <Text style={styles.subtitle}>Optional — helps us personalise your experience.</Text>
          <Text style={styles.label}>Date of Birth (YYYY-MM-DD)</Text>
          <TextInput style={styles.input} value={dob} onChangeText={setDob}
            placeholder="1990-06-15" placeholderTextColor="#979797" keyboardType="numbers-and-punctuation" />
          <View style={styles.rowBtns}>
            <TouchableOpacity style={[styles.btn, styles.btnOutline, { flex: 1 }]} onPress={() => setStep(1)}>
              <Text style={styles.btnOutlineText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, { flex: 2 }]} onPress={() => setStep(3)}>
              <Text style={styles.btnText}>Continue →</Text>
            </TouchableOpacity>
          </View>
        </>}

        {/* ── Step 3: Location cascade ─────────────────────── */}
        {step === 3 && <>
          <Text style={styles.title}>Where are you located?</Text>
          <Text style={styles.subtitle}>Helps us show listings from your area and school.</Text>

          {/* GPS auto-detect */}
          <TouchableOpacity
            style={[styles.gpsBtn, detectingLocation && styles.btnDisabled]}
            onPress={handleDetectLocation}
            disabled={detectingLocation}>
            {detectingLocation
              ? <ActivityIndicator color={BLUE} size="small" />
              : <Text style={styles.gpsBtnText}>📍 Use my current location</Text>
            }
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or select manually</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Province chips */}
          <Text style={styles.label}>Province</Text>
          <View style={styles.chipRow}>
            {SA_PROVINCES.map(p => (
              <TouchableOpacity key={p} onPress={() => setProvince(p)}
                style={[styles.chip, province === p && styles.chipActive]}>
                <Text style={[styles.chipText, province === p && styles.chipTextActive]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* City picker */}
          {province && (
            <>
              <Text style={styles.label}>City</Text>
              <TouchableOpacity style={[styles.pickerBtn, cityId && styles.pickerBtnSelected]}
                onPress={() => setExpandedPanel(expandedPanel === 'city' ? null : 'city')}>
                <Text style={[styles.pickerBtnText, cityId && styles.pickerBtnTextSelected]}>
                  {loadingCities ? 'Loading...' : cityId ? cityName : 'Select a city...'}
                </Text>
                <Text style={{ color: '#aaa' }}>▾</Text>
              </TouchableOpacity>
              {expandedPanel === 'city' && (
                <View style={styles.dropList}>
                  {cities.map(c => (
                    <TouchableOpacity key={c.id} style={[styles.dropRow, cityId === c.id && styles.dropRowActive]}
                      onPress={() => { setCityId(c.id); setCityName(c.name); setExpandedPanel(null); }}>
                      <Text style={[styles.dropText, cityId === c.id && styles.dropTextActive]}>{c.name}</Text>
                      {cityId === c.id && <Text style={{ color: BLUE }}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}

          {/* Suburb picker */}
          {cityId && (
            <>
              <Text style={[styles.label, { marginTop: 10 }]}>Suburb</Text>
              <TouchableOpacity style={[styles.pickerBtn, suburbId && styles.pickerBtnSelected]}
                onPress={() => setExpandedPanel(expandedPanel === 'suburb' ? null : 'suburb')}>
                <Text style={[styles.pickerBtnText, suburbId && styles.pickerBtnTextSelected]}>
                  {loadingSuburbs ? 'Loading...' : suburbId ? suburbName : 'Select a suburb...'}
                </Text>
                <Text style={{ color: '#aaa' }}>▾</Text>
              </TouchableOpacity>
              {expandedPanel === 'suburb' && (
                <View style={styles.dropList}>
                  {suburbs.map(s => (
                    <TouchableOpacity key={s.id} style={[styles.dropRow, suburbId === s.id && styles.dropRowActive]}
                      onPress={() => { setSuburbId(s.id); setSuburbName(s.name); setExpandedPanel(null); }}>
                      <Text style={[styles.dropText, suburbId === s.id && styles.dropTextActive]}>{s.name}</Text>
                      {suburbId === s.id && <Text style={{ color: BLUE }}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}

          {/* School picker — shown once city is selected; narrows when suburb is also chosen */}
          {/* School — always visible, global search works without location */}
          <>
            <Text style={[styles.label, { marginTop: 10 }]}>
              School <Text style={{ color: '#979797', fontWeight: '400' }}>(optional)</Text>
            </Text>
            <TextInput
              style={[styles.input, { marginBottom: 6 }]}
              value={schoolSearch}
              onChangeText={text => { setSchoolSearch(text); if (text.length > 0) setExpandedPanel('school'); }}
              placeholder="Search any school in South Africa..."
              placeholderTextColor="#979797"
            />

            {expandedPanel === 'school' && (
              <View style={styles.dropList}>
                {(loadingSchools || searchingSchools)
                  ? <ActivityIndicator color={BLUE} style={{ padding: 12 }} />
                  : filteredSchools.length === 0
                    ? <Text style={styles.emptyText}>
                        {isGlobalSearch ? 'No schools found — try a different name.' : 'Type to search all SA schools.'}
                      </Text>
                    : filteredSchools.map(school => {
                      const sel = selectedSchool?.id === school.id;
                      const location = [school.suburb_name, school.city_name].filter(Boolean).join(' · ');
                      return (
                        <TouchableOpacity key={school.id}
                          style={[styles.dropRow, sel && styles.dropRowActive]}
                          onPress={() => { setSelectedSchool(sel ? null : school); setExpandedPanel(null); setSchoolSearch(''); }}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.dropText, sel && styles.dropTextActive]}>{school.name}</Text>
                            <Text style={styles.dropSub}>{location} · {school.type}</Text>
                          </View>
                          {sel && <Text style={{ color: BLUE }}>✓</Text>}
                        </TouchableOpacity>
                      );
                    })
                }
              </View>
            )}

            {expandedPanel !== 'school' && !selectedSchool && (
              <TouchableOpacity onPress={() => setExpandedPanel('school')} style={styles.pickerBtn}>
                <Text style={styles.pickerBtnText}>Select a school...</Text>
                <Text style={{ color: '#aaa' }}>▾</Text>
              </TouchableOpacity>
            )}
          </>

          {/* Selected school badge */}
          {selectedSchool && (
            <View style={styles.selectedBadge}>
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedBadgeName}>{selectedSchool.name}</Text>
                <Text style={styles.selectedBadgeSub}>{selectedSchool.city_name} · {selectedSchool.type}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedSchool(null)}>
                <Text style={{ color: BLUE, fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {!locationComplete && province && (
            <Text style={styles.hintText}>Select your city and suburb to continue</Text>
          )}

          <View style={[styles.rowBtns, { marginTop: 16 }]}>
            <TouchableOpacity style={[styles.btn, styles.btnOutline, { flex: 1 }]} onPress={() => setStep(2)}>
              <Text style={styles.btnOutlineText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, (!locationComplete || saving) && styles.btnDisabled, { flex: 2 }]}
              onPress={handleFinish}
              disabled={!locationComplete || saving}>
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>{selectedSchool ? 'Finish ✓' : 'Finish (add school later)'}</Text>
              }
            </TouchableOpacity>
          </View>
        </>}

      </ScrollView>
    </SafeAreaView>
  );
}

const BLUE   = '#BE1E2D';
const BORDER = '#dedede';
const SURF   = '#f4f4f4';

const styles = StyleSheet.create({
  container:            { flex: 1, backgroundColor: '#ffffff' },
  inner:                { padding: 24, paddingBottom: 60 },
  brand:                { color: BLUE, fontSize: 22, fontWeight: '800', marginBottom: 20 },
  progressRow:          { flexDirection: 'row', gap: 6, marginBottom: 24 },
  progressDot:          { flex: 1, height: 4, borderRadius: 2, backgroundColor: BORDER },
  progressDotActive:    { backgroundColor: BLUE },
  title:                { color: '#111', fontSize: 22, fontWeight: '700', marginBottom: 6 },
  subtitle:             { color: '#979797', fontSize: 13, marginBottom: 24, lineHeight: 20 },
  label:                { color: '#111', fontSize: 12, fontWeight: '500', marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: SURF, borderWidth: 1, borderColor: BORDER,
    borderRadius: 12, padding: 13, color: '#111', fontSize: 14, marginBottom: 12,
  },
  infoBox:              { backgroundColor: '#fff8f7', borderWidth: 1, borderColor: '#ffd5cf', borderRadius: 10, padding: 12, marginBottom: 20 },
  infoText:             { color: '#979797', fontSize: 12 },
  chipRow:              { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 16 },
  chip:                 { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: SURF, borderWidth: 1, borderColor: BORDER },
  chipActive:           { backgroundColor: BLUE, borderColor: BLUE },
  chipText:             { color: '#111', fontSize: 12 },
  chipTextActive:       { color: '#fff', fontWeight: '600' },
  pickerBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: SURF, borderWidth: 1, borderColor: BORDER,
    borderRadius: 12, padding: 13, marginBottom: 4,
  },
  pickerBtnSelected:    { borderColor: BLUE, backgroundColor: '#eef0ff' },
  pickerBtnText:        { color: '#979797', fontSize: 14 },
  pickerBtnTextSelected:{ color: BLUE, fontWeight: '600', fontSize: 14 },
  dropList: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 12,
    marginBottom: 8, maxHeight: 200, backgroundColor: '#fff',
    overflow: 'hidden',
  },
  dropRow:              { padding: 13, borderBottomWidth: 1, borderBottomColor: BORDER, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropRowActive:        { backgroundColor: '#eef0ff' },
  dropText:             { color: '#111', fontSize: 13 },
  dropTextActive:       { color: BLUE, fontWeight: '700' },
  dropSub:              { color: '#979797', fontSize: 11, marginTop: 2 },
  emptyText:            { color: '#979797', textAlign: 'center', padding: 16, fontSize: 13 },
  selectedBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#eef0ff', borderWidth: 1, borderColor: BLUE,
    borderRadius: 12, padding: 12, marginTop: 8, marginBottom: 8,
  },
  selectedBadgeName:    { color: BLUE, fontWeight: '700', fontSize: 13 },
  selectedBadgeSub:     { color: '#6b7fd7', fontSize: 11, marginTop: 2 },
  hintText:             { color: '#979797', fontSize: 12, textAlign: 'center', marginTop: 8 },
  gpsBtn:               { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: BLUE, borderRadius: 30, padding: 13, marginBottom: 12, minHeight: 46 },
  gpsBtnText:           { color: BLUE, fontWeight: '600', fontSize: 14 },
  dividerRow:           { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  dividerLine:          { flex: 1, height: 1, backgroundColor: BORDER },
  dividerText:          { color: '#979797', fontSize: 11 },
  rowBtns:              { flexDirection: 'row', gap: 10, marginTop: 8 },
  btn:                  { backgroundColor: BLUE, borderRadius: 30, padding: 15, alignItems: 'center' },
  btnDisabled:          { backgroundColor: '#dedede' },
  btnText:              { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnOutline:           { backgroundColor: 'transparent', borderWidth: 1, borderColor: BORDER },
  btnOutlineText:       { color: '#979797', fontWeight: '600', fontSize: 15 },
});
