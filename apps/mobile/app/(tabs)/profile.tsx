import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, Image,
  StyleSheet, ActivityIndicator, Alert, TextInput, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/src/lib/supabase';
import {
  MapPin, School, CheckCircle2, AlertTriangle, Tag,
  ShoppingBag, Package, ChevronRight, Pencil, X, Check, Plus,
} from 'lucide-react-native';
import { SA_PROVINCES } from '@nextkid/shared';

const BLUE = '#BE1E2D';
const BORDER = '#dedede';
const SURFACE = '#f4f4f4';

type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_age_verified: boolean;
  province: string | null;
  school_ids: string[] | null;
};

type SchoolRow = { id: string; name: string; city: string };

type Item = {
  id: string;
  title: string;
  price: number;
  images: string[];
  status: string;
  category: string;
};

function StatusDot({ status }: { status: string }) {
  if (status === 'active') {
    return (
      <View style={[styles.statusBadge, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#16a34a', marginRight: 4 }} />
        <Text style={[styles.statusText, { color: '#16a34a' }]}>Live</Text>
      </View>
    );
  }
  if (status === 'sold') {
    return (
      <View style={[styles.statusBadge, { backgroundColor: '#eef0fb', borderColor: '#c7d2fe' }]}>
        <CheckCircle2 size={10} strokeWidth={2.5} color={BLUE} style={{ marginRight: 4 }} />
        <Text style={[styles.statusText, { color: BLUE }]}>Sold</Text>
      </View>
    );
  }
  return (
    <View style={styles.statusBadge}>
      <Text style={styles.statusText}>{status}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [activeListings, setActiveListings] = useState<Item[]>([]);
  const [soldListings, setSoldListings] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'active' | 'sold'>('active');

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editProvince, setEditProvince] = useState('');
  const [editSchoolIds, setEditSchoolIds] = useState<string[]>([]);
  const [editSchools, setEditSchools] = useState<SchoolRow[]>([]);
  const [schoolSearch, setSchoolSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SchoolRow[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace('/' as never); return; }

    const [{ data: prof }, { data: items }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('items')
        .select('id, title, price, images, status, category')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false }),
    ]);

    if (!prof) { router.replace('/onboarding' as never); return; }
    setProfile(prof);

    if (prof.school_ids?.length) {
      const { data: schoolData } = await supabase
        .from('schools').select('id, name, city').in('id', prof.school_ids);
      setSchools(schoolData ?? []);
    }

    const all = items ?? [];
    setActiveListings(all.filter(i => i.status === 'active'));
    setSoldListings(all.filter(i => i.status === 'sold'));
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const startEdit = () => {
    if (!profile) return;
    setEditName(profile.full_name);
    setEditProvince(profile.province ?? '');
    setEditSchoolIds(profile.school_ids ?? []);
    setEditSchools(schools);
    setSchoolSearch('');
    setSearchResults([]);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setSchoolSearch('');
    setSearchResults([]);
  };

  // Search schools as user types — filter by province + name
  const searchSchools = useCallback(async (query: string) => {
    setSchoolSearch(query);
    if (query.trim().length < 2) { setSearchResults([]); return; }
    let q = supabase.from('schools').select('id, name, city').ilike('name', `%${query}%`).limit(8);
    if (editProvince) q = q.eq('province', editProvince);
    const { data } = await q;
    setSearchResults((data ?? []).filter(s => !editSchoolIds.includes(s.id)));
  }, [editProvince, editSchoolIds]);

  const addSchool = (school: SchoolRow) => {
    setEditSchoolIds(prev => [...prev, school.id]);
    setEditSchools(prev => [...prev, school]);
    setSchoolSearch('');
    setSearchResults([]);
  };

  const removeSchool = (id: string) => {
    setEditSchoolIds(prev => prev.filter(s => s !== id));
    setEditSchools(prev => prev.filter(s => s.id !== id));
  };

  const saveEdit = async () => {
    if (!profile) return;
    setSaving(true);
    await supabase.from('profiles').update({
      full_name: editName.trim(),
      province: editProvince || null,
      school_ids: editSchoolIds,
    }).eq('id', profile.id);

    setProfile(prev => prev ? {
      ...prev,
      full_name: editName.trim(),
      province: editProvince || null,
      school_ids: editSchoolIds,
    } : prev);
    setSchools(editSchools);
    setSaving(false);
    setEditing(false);
  };

  const signOut = async () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out', style: 'destructive',
        onPress: async () => { await supabase.auth.signOut(); router.replace('/' as never); },
      },
    ]);
  };

  const deleteListing = async (itemId: string) => {
    Alert.alert('Remove listing', 'This will delist the item. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          await supabase.from('items').update({ status: 'delisted' }).eq('id', itemId);
          setActiveListings(prev => prev.filter(i => i.id !== itemId));
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={BLUE} size="large" />
      </View>
    );
  }

  const initials = profile?.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? '?';
  const displayListings = tab === 'active' ? activeListings : soldListings;
  const totalEarned = soldListings.reduce((s, i) => s + i.price, 0);

  const renderListing = ({ item }: { item: Item }) => (
    <TouchableOpacity
      style={styles.listingRow}
      onPress={() => router.push(`/item/${item.id}` as never)}
      activeOpacity={0.8}
    >
      {item.images?.[0] ? (
        <Image source={{ uri: item.images[0] }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Package size={24} strokeWidth={1.5} color="#dedede" />
        </View>
      )}
      <View style={styles.listingInfo}>
        <Text style={styles.listingCategory}>{item.category}</Text>
        <Text style={styles.listingTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.listingPrice}>R{(item.price / 100).toLocaleString()}</Text>
        <StatusDot status={item.status} />
      </View>
      <View style={styles.listingActions}>
        <ChevronRight size={16} strokeWidth={2} color="#dedede" />
        {tab === 'active' && (
          <TouchableOpacity onPress={() => deleteListing(item.id)} style={styles.deleteBtn}>
            <Text style={styles.deleteText}>Remove</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  const ProfileCard = (
    <View style={styles.profileCard}>
      <View style={styles.avatarRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          {editing ? (
            <TextInput
              style={styles.nameInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              placeholderTextColor="#979797"
            />
          ) : (
            <Text style={styles.name}>{profile?.full_name}</Text>
          )}
          <Text style={styles.email}>{profile?.email}</Text>

          {/* Location — view mode */}
          {!editing && profile?.province && (
            <View style={styles.infoRow}>
              <MapPin size={13} strokeWidth={2} color={BLUE} />
              <Text style={styles.infoText}>{profile.province}</Text>
            </View>
          )}

          {/* Schools — view mode */}
          {!editing && schools.map(s => (
            <View key={s.id} style={styles.infoRow}>
              <School size={13} strokeWidth={2} color={BLUE} />
              <Text style={styles.infoText}>{s.name}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Edit mode fields */}
      {editing && (
        <View style={styles.editSection}>
          {/* Province picker */}
          <Text style={styles.editLabel}>Province</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.provincePillScroll}>
            <View style={styles.provincePills}>
              {SA_PROVINCES.map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.provincePill, editProvince === p && styles.provincePillActive]}
                  onPress={() => {
                    setEditProvince(p);
                    setSearchResults([]);
                    setSchoolSearch('');
                  }}
                >
                  <Text style={[styles.provincePillText, editProvince === p && styles.provincePillTextActive]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* School search */}
          <Text style={styles.editLabel}>Schools</Text>
          <View style={styles.schoolSearchWrap}>
            <School size={14} strokeWidth={2} color="#979797" />
            <TextInput
              style={styles.schoolSearchInput}
              value={schoolSearch}
              onChangeText={searchSchools}
              placeholder="Search school name..."
              placeholderTextColor="#979797"
            />
          </View>
          {searchResults.length > 0 && (
            <View style={styles.searchDropdown}>
              {searchResults.map(s => (
                <TouchableOpacity key={s.id} style={styles.dropdownItem} onPress={() => addSchool(s)}>
                  <Plus size={13} strokeWidth={2.5} color={BLUE} />
                  <Text style={styles.dropdownText}>{s.name}</Text>
                  <Text style={styles.dropdownCity}>{s.city}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {/* Selected schools */}
          {editSchools.length > 0 && (
            <View style={styles.selectedSchools}>
              {editSchools.map(s => (
                <View key={s.id} style={styles.schoolChip}>
                  <Text style={styles.schoolChipText}>{s.name}</Text>
                  <TouchableOpacity onPress={() => removeSchool(s.id)} hitSlop={8}>
                    <X size={12} strokeWidth={2.5} color={BLUE} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Badges — view mode only */}
      {!editing && (
        <View style={styles.badgeRow}>
          {profile?.is_age_verified ? (
            <View style={[styles.badge, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
              <CheckCircle2 size={11} strokeWidth={2.5} color="#16a34a" />
              <Text style={[styles.badgeText, { color: '#16a34a' }]}>Verified 18+</Text>
            </View>
          ) : (
            <View style={[styles.badge, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
              <AlertTriangle size={11} strokeWidth={2.5} color="#ca8a04" />
              <Text style={[styles.badgeText, { color: '#ca8a04' }]}>Browse only</Text>
            </View>
          )}
          <View style={[styles.badge, { backgroundColor: '#eef0fb', borderColor: '#c7d2fe' }]}>
            <Text style={[styles.badgeText, { color: BLUE, textTransform: 'capitalize' }]}>
              {profile?.role?.replace('_', ' ')}
            </Text>
          </View>
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.actionRow}>
        {editing ? (
          <>
            <TouchableOpacity style={styles.saveBtn} onPress={saveEdit} disabled={saving}>
              <Check size={15} strokeWidth={2.5} color="#fff" />
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit}>
              <X size={15} strokeWidth={2.5} color="#979797" />
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.editBtn} onPress={startEdit}>
              <Pencil size={14} strokeWidth={2} color={BLUE} />
              <Text style={styles.editBtnText}>Edit profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
              <Text style={styles.signOutText}>Sign out</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={displayListings}
        keyExtractor={i => i.id}
        renderItem={renderListing}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            {ProfileCard}

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{activeListings.length}</Text>
                <View style={styles.statLabelRow}>
                  <Tag size={11} strokeWidth={2} color="#979797" />
                  <Text style={styles.statLabel}> Live</Text>
                </View>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{soldListings.length}</Text>
                <View style={styles.statLabelRow}>
                  <ShoppingBag size={11} strokeWidth={2} color="#979797" />
                  <Text style={styles.statLabel}> Sold</Text>
                </View>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>R{(totalEarned / 100).toLocaleString()}</Text>
                <Text style={styles.statLabel}>Earned</Text>
              </View>
            </View>

            {/* Tab switcher */}
            <View style={styles.tabBar}>
              {(['active', 'sold'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
                  onPress={() => setTab(t)}
                >
                  <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                    {t === 'active' ? `Live (${activeListings.length})` : `Sold (${soldListings.length})`}
                  </Text>
                  {tab === t && <View style={styles.tabUnderline} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Package size={48} strokeWidth={1.5} color="#dedede" />
            <Text style={styles.emptyTitle}>
              {tab === 'active' ? 'No active listings' : 'Nothing sold yet'}
            </Text>
            <Text style={styles.emptyText}>
              {tab === 'active' ? 'Tap Sell to create your first listing.' : 'Your sold items will appear here.'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  centered: { flex: 1, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingBottom: 32 },

  // Profile card
  profileCard: { margin: 16, backgroundColor: SURFACE, borderRadius: 20, padding: 16 },
  avatarRow: { flexDirection: 'row', gap: 14, marginBottom: 12 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  name: { color: '#111', fontSize: 18, fontWeight: '700' },
  nameInput: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
    color: '#111', fontSize: 16, fontWeight: '600', backgroundColor: '#fff',
    marginBottom: 4,
  },
  email: { color: '#979797', fontSize: 13, marginTop: 2, marginBottom: 6 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  infoText: { color: '#555', fontSize: 13 },

  // Edit section
  editSection: { marginTop: 4, marginBottom: 8 },
  editLabel: { color: '#979797', fontSize: 11, fontWeight: '600', marginBottom: 6, marginTop: 10 },
  provincePillScroll: { flexGrow: 0 },
  provincePills: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  provincePill: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER,
  },
  provincePillActive: { backgroundColor: BLUE, borderColor: BLUE },
  provincePillText: { color: '#555', fontSize: 12 },
  provincePillTextActive: { color: '#fff', fontWeight: '600' },
  schoolSearchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
  },
  schoolSearchInput: { flex: 1, color: '#111', fontSize: 14 },
  searchDropdown: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER,
    borderRadius: 10, marginTop: 4, overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: SURFACE,
  },
  dropdownText: { flex: 1, color: '#111', fontSize: 13 },
  dropdownCity: { color: '#979797', fontSize: 12 },
  selectedSchools: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  schoolChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#eef0fb', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#c7d2fe',
  },
  schoolChipText: { color: BLUE, fontSize: 12, fontWeight: '600' },

  badgeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 12 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    borderWidth: 1, borderColor: BORDER,
  },
  badgeText: { color: '#979797', fontSize: 11, fontWeight: '600' },

  actionRow: { flexDirection: 'row', gap: 10 },
  editBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: BLUE, borderRadius: 30, paddingVertical: 10,
  },
  editBtnText: { color: BLUE, fontWeight: '600', fontSize: 14 },
  signOutBtn: {
    flex: 1, borderWidth: 1, borderColor: BORDER, borderRadius: 30, paddingVertical: 10, alignItems: 'center',
  },
  signOutText: { color: '#979797', fontWeight: '600', fontSize: 14 },
  saveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: BLUE, borderRadius: 30, paddingVertical: 10,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  cancelBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: BORDER, borderRadius: 30, paddingVertical: 10,
  },
  cancelBtnText: { color: '#979797', fontWeight: '600', fontSize: 14 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: SURFACE, borderRadius: 14, padding: 12, alignItems: 'center' },
  statNumber: { color: BLUE, fontSize: 20, fontWeight: '800' },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  statLabel: { color: '#979797', fontSize: 11, marginTop: 2 },

  // Tabs
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER, marginHorizontal: 16, marginBottom: 8 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, position: 'relative' },
  tabBtnActive: {},
  tabText: { color: '#979797', fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: '#111' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: BLUE, borderRadius: 2 },

  // Listing rows
  listingRow: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, marginHorizontal: 16,
    marginBottom: 10, overflow: 'hidden', borderWidth: 1, borderColor: BORDER, alignItems: 'center',
  },
  thumb: { width: 80, height: 80 },
  thumbPlaceholder: { backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center' },
  listingInfo: { flex: 1, padding: 10, gap: 2 },
  listingCategory: { color: '#979797', fontSize: 11 },
  listingTitle: { color: '#111', fontSize: 13, fontWeight: '600' },
  listingPrice: { color: BLUE, fontSize: 14, fontWeight: '700' },
  listingActions: { paddingRight: 12, alignItems: 'center', gap: 8 },
  deleteBtn: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fff5f5' },
  deleteText: { color: '#dc2626', fontSize: 11, fontWeight: '600' },

  // Status badge
  statusBadge: {
    flexDirection: 'row', alignItems: 'center',
    alignSelf: 'flex-start', backgroundColor: SURFACE,
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: BORDER, marginTop: 2,
  },
  statusText: { color: '#979797', fontSize: 10, fontWeight: '700' },

  // Empty
  emptyWrap: { alignItems: 'center', paddingTop: 48, paddingBottom: 40 },
  emptyTitle: { color: '#111', fontSize: 15, fontWeight: '600', marginTop: 12 },
  emptyText: { color: '#979797', fontSize: 13, marginTop: 4 },
});
