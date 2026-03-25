import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  Image, StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/src/lib/supabase';
import {
  Shirt, Trophy, Footprints, Dumbbell, BookOpen, ShoppingBag, Package,
  School as SchoolIcon, Globe,
} from 'lucide-react-native';
import { ALL_CATEGORIES, PLATFORM_DEFAULTS } from '@nextkid/shared';
import type { ListingCategory, School } from '@nextkid/shared';

function CategoryIcon({ name, color, size = 20 }: { name: string; color: string; size?: number }) {
  const props = { size, strokeWidth: 2, color };
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

    if (tab === 'my_school') {
      // No school saved — return nothing (user needs to add a school first)
      if (userSchools.length === 0) { setItems([]); setLoading(false); return; }
      query = query.in('school_id', userSchools.map(s => s.id));
    }
    // All Items tab — no school filter, everything is visible for maximum seller reach

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
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search listings..."
            placeholderTextColor="#979797"
          />
        </View>
      </View>

      {/* Tab switcher */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'my_school' && styles.tabActive]}
          onPress={() => setTab('my_school')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <SchoolIcon size={14} strokeWidth={2} color={tab === 'my_school' ? '#111' : '#979797'} />
            <Text style={[styles.tabText, tab === 'my_school' && styles.tabTextActive]}>My School</Text>
          </View>
          {tab === 'my_school' && <View style={styles.tabIndicator} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'all' && styles.tabActive]}
          onPress={() => setTab('all')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Globe size={14} strokeWidth={2} color={tab === 'all' ? '#111' : '#979797'} />
            <Text style={[styles.tabText, tab === 'all' && styles.tabTextActive]}>All Items</Text>
          </View>
          {tab === 'all' && <View style={styles.tabIndicator} />}
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              {cat !== 'All' && (
                <CategoryIcon
                  name={cat}
                  color={category === cat ? '#ffffff' : '#979797'}
                  size={14}
                />
              )}
              <Text style={[styles.pillText, category === cat && styles.pillTextActive]}>{cat}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Listings grid */}
      {loading ? (
        <ActivityIndicator color="#4757bf" style={{ marginTop: 40 }} />
      ) : items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>🔍</Text>
          <Text style={styles.emptyTitle}>No listings found</Text>
          <Text style={styles.emptyText}>
            {tab === 'my_school' && !hasSchools ? 'Add a school to see listings.' : 'Try adjusting your filters.'}
          </Text>
        </View>
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
              activeOpacity={0.85}
            >
              {item.images?.[0] ? (
                <Image source={{ uri: item.images[0] }} style={styles.cardImage} />
              ) : (
                <View style={styles.cardImagePlaceholder}>
                  <CategoryIcon name={item.category} color="#dedede" size={36} />
                </View>
              )}
              <View style={styles.cardBody}>
                <Text style={styles.cardCategory}>{item.category}</Text>
                {item.size && (
                  <View style={styles.sizeBadge}>
                    <Text style={styles.sizeBadgeText}>Size {item.size}</Text>
                  </View>
                )}
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

const CORAL = '#4757bf';
const BORDER = '#dedede';
const SURFACE = '#f4f4f4';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },

  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, backgroundColor: '#ffffff' },
  brand: { color: CORAL, fontWeight: '800', fontSize: 22, marginBottom: 10 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: SURFACE, borderRadius: 24, paddingHorizontal: 14, paddingVertical: 10,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, color: '#111', fontSize: 14 },

  tabs: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER,
    backgroundColor: '#ffffff',
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, position: 'relative' },
  tabActive: {},
  tabText: { color: '#979797', fontSize: 13, fontWeight: '500' },
  tabTextActive: { color: CORAL, fontWeight: '600' },
  tabIndicator: {
    position: 'absolute', bottom: 0, left: 16, right: 16, height: 2,
    backgroundColor: CORAL, borderRadius: 2,
  },

  banner: {
    marginHorizontal: 16, marginTop: 10, padding: 12,
    backgroundColor: '#fff8f7', borderRadius: 12, borderWidth: 1, borderColor: '#ffd5cf',
  },
  bannerText: { color: '#979797', fontSize: 13, textAlign: 'center' },

  pillList: { flexGrow: 0, flexShrink: 0, height: 50, backgroundColor: '#ffffff' },
  pills: { paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row' },
  pill: {
    height: 34, paddingHorizontal: 14, borderRadius: 17,
    backgroundColor: SURFACE, marginRight: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  pillActive: { backgroundColor: CORAL },
  pillText: { color: '#111', fontSize: 12, fontWeight: '500' },
  pillTextActive: { color: '#ffffff' },

  grid: { paddingHorizontal: 12, paddingBottom: 20, paddingTop: 4 },
  row: { gap: 10, marginBottom: 10 },
  card: {
    flex: 1, backgroundColor: '#ffffff', borderRadius: 16,
    overflow: 'hidden', borderWidth: 1, borderColor: BORDER,
  },
  cardImage: { width: '100%', aspectRatio: 1 },
  cardImagePlaceholder: {
    width: '100%', aspectRatio: 1, backgroundColor: SURFACE,
    alignItems: 'center', justifyContent: 'center',
  },
  cardBody: { padding: 10 },
  cardCategory: { color: '#979797', fontSize: 10, fontWeight: '500', marginBottom: 2 },
  sizeBadge: {
    alignSelf: 'flex-start', backgroundColor: SURFACE,
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 4,
  },
  sizeBadgeText: { color: '#979797', fontSize: 10 },
  cardTitle: { color: '#111', fontSize: 12, fontWeight: '500', marginBottom: 6, lineHeight: 16 },
  cardPrice: { color: CORAL, fontSize: 15, fontWeight: '800' },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: '#111', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  emptyText: { color: '#979797', fontSize: 13 },
});
