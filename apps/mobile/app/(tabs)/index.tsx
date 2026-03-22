import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  Image, StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/src/lib/supabase';
import { ALL_CATEGORIES, PLATFORM_DEFAULTS } from '@nextkid/shared';
import type { ListingCategory, School } from '@nextkid/shared';

type Item = {
  id: string;
  title: string;
  category: string;
  price: number;
  images: string[];
  school_id: string | null;
  is_school_specific: boolean;
  size: string | null;
};

type BrowseTab = 'my_school' | 'all';

export default function BrowseScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<BrowseTab>('all');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<ListingCategory | 'All'>('All');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [userSchools, setUserSchools] = useState<School[]>([]);

  // RULE: debounce search input at 300ms to keep results fast
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), PLATFORM_DEFAULTS.SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  // Load the user's saved schools for the "My School" tab
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('school_ids').eq('id', user.id).single();
      if (profile?.school_ids?.length) {
        const { data: schools } = await supabase.from('schools').select('*').in('id', profile.school_ids);
        setUserSchools((schools as School[]) ?? []);
      }
    });
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('items')
      .select('id, title, category, price, images, school_id, is_school_specific, size')
      .order('created_at', { ascending: false });

    if (category !== 'All') query = query.eq('category', category);
    if (debouncedSearch) query = query.ilike('title', `%${debouncedSearch}%`);

    if (tab === 'my_school' && userSchools.length > 0) {
      query = query.in('school_id', userSchools.map(s => s.id));
    } else if (tab === 'all') {
      query = query.or('is_school_specific.eq.false,is_school_specific.is.null');
    }

    const { data, error } = await query;
    if (error) console.error('Browse error:', error);
    setItems(data ?? []);
    setLoading(false);
  }, [category, debouncedSearch, tab, userSchools]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const hasSchools = userSchools.length > 0;
  const PILL_CATEGORIES: Array<ListingCategory | 'All'> = ['All', ...ALL_CATEGORIES];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.brand}>NextKid</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search listings..."
          placeholderTextColor="#555"
        />
      </View>

      {/* Tab switcher */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'my_school' && styles.tabActive]}
          onPress={() => setTab('my_school')}
        >
          <Text style={[styles.tabText, tab === 'my_school' && styles.tabTextActive]}>
            🏫 My School
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'all' && styles.tabActive]}
          onPress={() => setTab('all')}
        >
          <Text style={[styles.tabText, tab === 'all' && styles.tabTextActive]}>
            🌍 All Items
          </Text>
        </TouchableOpacity>
      </View>

      {/* No school banner */}
      {tab === 'my_school' && !hasSchools && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>Add a school in your profile to see uniform and gear listings.</Text>
        </View>
      )}

      {/* Category pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pillList}
        contentContainerStyle={styles.pills}
      >
        {PILL_CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            onPress={() => setCategory(cat)}
            style={[styles.pill, category === cat && styles.pillActive]}
          >
            <Text style={[styles.pillText, category === cat && styles.pillTextActive]} numberOfLines={1}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Listings grid */}
      {loading ? (
        <ActivityIndicator color="#a855f7" style={{ marginTop: 40 }} />
      ) : items.length === 0 ? (
        <Text style={styles.empty}>
          {tab === 'my_school' && !hasSchools ? 'Add a school to see listings.' : 'No listings found.'}
        </Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/item/${item.id}` as never)}
              activeOpacity={0.8}
            >
              {item.images?.[0] ? (
                <Image source={{ uri: item.images[0] }} style={styles.cardImage} />
              ) : (
                <View style={styles.cardImagePlaceholder}>
                  <Text style={{ fontSize: 36 }}>📦</Text>
                </View>
              )}
              <View style={styles.cardBody}>
                <Text style={styles.cardCategory}>{item.category}</Text>
                {item.size && <Text style={styles.cardSize}>Size {item.size}</Text>}
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.cardPrice}>R{(item.price / 100).toLocaleString()}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  brand: { color: '#a855f7', fontWeight: '800', fontSize: 22, marginBottom: 10 },
  searchInput: {
    backgroundColor: '#1a1a1a', borderRadius: 10, padding: 12,
    color: '#fff', fontSize: 14, borderWidth: 1, borderColor: '#2a2a2a',
  },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 4 },
  tab: {
    flex: 1, paddingVertical: 8, borderRadius: 20, alignItems: 'center',
    backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a',
  },
  tabActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  tabText: { color: '#888', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  banner: {
    marginHorizontal: 16, marginTop: 8, padding: 12,
    backgroundColor: '#1a1a1a', borderRadius: 10, borderWidth: 1, borderColor: '#333',
  },
  bannerText: { color: '#888', fontSize: 13, textAlign: 'center' },
  pillList: { flexGrow: 0 },
  pills: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a',
  },
  pillActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  pillText: { color: '#888', fontSize: 12, fontWeight: '500' },
  pillTextActive: { color: '#fff' },
  grid: { paddingHorizontal: 12, paddingBottom: 20 },
  row: { gap: 12, marginBottom: 12 },
  card: {
    flex: 1, backgroundColor: '#111', borderRadius: 16,
    overflow: 'hidden', borderWidth: 1, borderColor: '#222',
  },
  cardImage: { width: '100%', height: 130 },
  cardImagePlaceholder: {
    width: '100%', height: 130, backgroundColor: '#1a1a1a',
    alignItems: 'center', justifyContent: 'center',
  },
  cardBody: { padding: 10 },
  cardCategory: { color: '#a855f7', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 1 },
  cardSize: { color: '#666', fontSize: 10, marginBottom: 2 },
  cardTitle: { color: '#fff', fontSize: 12, fontWeight: '600', marginBottom: 5 },
  cardPrice: { color: '#fff', fontSize: 15, fontWeight: '800' },
  empty: { color: '#555', textAlign: 'center', marginTop: 60, fontSize: 15 },
});
