import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/src/lib/supabase';
import { SA_PROVINCES } from '@nextkid/shared';
import type { School } from '@nextkid/shared';

type Step = 1 | 2 | 3;

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [userId, setUserId] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [saving, setSaving] = useState(false);

  // Step 1 — name
  const [fullName, setFullName] = useState('');

  // Step 2 — date of birth
  const [dob, setDob] = useState('');

  // Step 3 — school picker
  const [province, setProvince] = useState('');
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolSearch, setSchoolSearch] = useState('');
  const [selectedSchools, setSelectedSchools] = useState<School[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace('/' as never); return; }
      setUserId(user.id);
      setUserEmail(user.email ?? '');
    });
  }, []);

  useEffect(() => {
    if (!province) { setSchools([]); return; }
    setLoadingSchools(true);
    supabase.from('schools').select('*').eq('province', province).order('name')
      .then(({ data }) => { setSchools((data as School[]) ?? []); setLoadingSchools(false); });
  }, [province]);

  const getAge = (d: string) => {
    const birth = new Date(d), today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const toggleSchool = (school: School) => {
    setSelectedSchools(prev =>
      prev.find(s => s.id === school.id) ? prev.filter(s => s.id !== school.id) : [...prev, school]
    );
  };

  const handleFinish = async () => {
    if (!dob) { Alert.alert('Missing', 'Please enter your date of birth.'); return; }
    const isAdult = getAge(dob) >= 18;
    setSaving(true);

    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      email: userEmail,
      full_name: fullName,
      date_of_birth: dob,
      // RULE: users must be 18+ before transacting — under 18s get browse_only role
      is_age_verified: isAdult,
      role: isAdult ? 'buyer' : 'browse_only',
      school_ids: selectedSchools.map(s => s.id),
    });

    setSaving(false);
    if (error) { Alert.alert('Error', 'Something went wrong. Please try again.'); return; }
    router.replace('/(tabs)' as never);
  };

  const filteredSchools = schools.filter(s =>
    s.name.toLowerCase().includes(schoolSearch.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>NextKid</Text>

        {/* Progress */}
        <View style={styles.progressRow}>
          {([1, 2, 3] as Step[]).map(s => (
            <View key={s} style={[styles.progressDot, step >= s && styles.progressDotActive]} />
          ))}
        </View>

        {/* Step 1 — Name */}
        {step === 1 && <>
          <Text style={styles.title}>Welcome! 👋</Text>
          <Text style={styles.subtitle}>Let's get your account set up.</Text>
          <Text style={styles.label}>Full Name</Text>
          <TextInput style={styles.input} value={fullName} onChangeText={setFullName}
            placeholder="Your full name" placeholderTextColor="#555" autoCapitalize="words" />
          <TouchableOpacity style={[styles.btn, !fullName && styles.btnDisabled]} onPress={() => setStep(2)} disabled={!fullName}>
            <Text style={styles.btnText}>Continue →</Text>
          </TouchableOpacity>
        </>}

        {/* Step 2 — Age verification */}
        {step === 2 && <>
          <Text style={styles.title}>Verify your age</Text>
          {/* RULE: users must be 18+ before transacting */}
          <Text style={styles.subtitle}>You must be 18+ to buy or sell. Under 18s can browse only.</Text>
          <Text style={styles.label}>Date of Birth (YYYY-MM-DD)</Text>
          <TextInput style={styles.input} value={dob} onChangeText={setDob}
            placeholder="1990-06-15" placeholderTextColor="#555" keyboardType="numbers-and-punctuation" />
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>🔒 Your date of birth is used only for age verification and stored securely.</Text>
          </View>
          <View style={styles.rowBtns}>
            <TouchableOpacity style={[styles.btn, styles.btnOutline, { flex: 1 }]} onPress={() => setStep(1)}>
              <Text style={styles.btnOutlineText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, !dob && styles.btnDisabled, { flex: 2 }]} onPress={() => setStep(3)} disabled={!dob}>
              <Text style={styles.btnText}>Continue →</Text>
            </TouchableOpacity>
          </View>
        </>}

        {/* Step 3 — School picker */}
        {step === 3 && <>
          <Text style={styles.title}>Add your school(s)</Text>
          <Text style={styles.subtitle}>Pick the school(s) your child attends to see relevant uniform and gear. You can skip this.</Text>

          <Text style={styles.label}>Province</Text>
          <View style={styles.chipRow}>
            {SA_PROVINCES.map(p => (
              <TouchableOpacity key={p} onPress={() => { setProvince(p); setSchoolSearch(''); }}
                style={[styles.chip, province === p && styles.chipActive]}>
                <Text style={[styles.chipText, province === p && styles.chipTextActive]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {province && <>
            <Text style={styles.label}>Search school</Text>
            <TextInput style={styles.input} value={schoolSearch} onChangeText={setSchoolSearch}
              placeholder="Type school name..." placeholderTextColor="#555" />
            <View style={styles.schoolList}>
              {loadingSchools
                ? <ActivityIndicator color="#a855f7" style={{ padding: 16 }} />
                : filteredSchools.length === 0
                  ? <Text style={styles.emptyText}>No schools found.</Text>
                  : filteredSchools.map(school => {
                    const selected = selectedSchools.some(s => s.id === school.id);
                    return (
                      <TouchableOpacity key={school.id} onPress={() => toggleSchool(school)}
                        style={[styles.schoolRow, selected && styles.schoolRowActive]}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.schoolName}>{school.name}</Text>
                          <Text style={styles.schoolSub}>{school.city} · {school.type}</Text>
                        </View>
                        {selected && <Text style={{ color: '#a855f7', fontSize: 16 }}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })
              }
            </View>
          </>}

          {selectedSchools.length > 0 && (
            <View style={styles.selectedBox}>
              <Text style={styles.selectedLabel}>Selected ({selectedSchools.length}):</Text>
              <View style={styles.chipRow}>
                {selectedSchools.map(s => (
                  <TouchableOpacity key={s.id} onPress={() => toggleSchool(s)} style={styles.chipSelected}>
                    <Text style={styles.chipSelectedText}>{s.name} ✕</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={styles.rowBtns}>
            <TouchableOpacity style={[styles.btn, styles.btnOutline, { flex: 1 }]} onPress={() => setStep(2)}>
              <Text style={styles.btnOutlineText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, saving && styles.btnDisabled, { flex: 2 }]} onPress={handleFinish} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>{selectedSchools.length > 0 ? 'Finish ✓' : 'Skip & Finish →'}</Text>
              }
            </TouchableOpacity>
          </View>
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  inner: { padding: 24, paddingBottom: 60 },
  brand: { color: '#a855f7', fontSize: 22, fontWeight: '800', marginBottom: 20 },
  progressRow: { flexDirection: 'row', gap: 6, marginBottom: 24 },
  progressDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#222' },
  progressDotActive: { backgroundColor: '#7c3aed' },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 6 },
  subtitle: { color: '#888', fontSize: 13, marginBottom: 24, lineHeight: 20 },
  label: { color: '#aaa', fontSize: 12, marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a',
    borderRadius: 10, padding: 13, color: '#fff', fontSize: 14, marginBottom: 12,
  },
  infoBox: { backgroundColor: '#1e1b10', borderWidth: 1, borderColor: '#554', borderRadius: 8, padding: 12, marginBottom: 20 },
  infoText: { color: '#bba', fontSize: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a' },
  chipActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  chipText: { color: '#888', fontSize: 12 },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  chipSelected: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#2e1f5e', borderWidth: 1, borderColor: '#7c3aed' },
  chipSelectedText: { color: '#a78bfa', fontSize: 12, fontWeight: '600' },
  schoolList: { borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 10, marginBottom: 12, maxHeight: 220 },
  schoolRow: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a', flexDirection: 'row', alignItems: 'center' },
  schoolRowActive: { backgroundColor: '#2e1f5e40' },
  schoolName: { color: '#fff', fontSize: 13, fontWeight: '600' },
  schoolSub: { color: '#666', fontSize: 11 },
  emptyText: { color: '#666', textAlign: 'center', padding: 16, fontSize: 13 },
  selectedBox: { backgroundColor: '#111', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#222' },
  selectedLabel: { color: '#aaa', fontSize: 12, marginBottom: 8 },
  rowBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btn: { backgroundColor: '#7c3aed', borderRadius: 12, padding: 15, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#2a2a2a' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#333' },
  btnOutlineText: { color: '#888', fontWeight: '600', fontSize: 15 },
});
