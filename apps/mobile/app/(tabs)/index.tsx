import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  Image, StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/src/lib/supabase';
import {
  Shirt, Trophy, Footprints, Dumbbell, BookOpen, ShoppingBag, Package,
  Lock, BadgeCheck, MapPin, Search, ShoppingCart, Check,
} from 'lucide-react-native';
import { useCart } from '@/src/lib/cart';
import { ALL_CATEGORIES } from '@nextkid/shared';
import type { ListingCategory } from '@nextkid/shared';

const CRIMSON = '#BE1E2D';
const BORDER  = '#dedede';
const SURFACE = '#f4f4f4';

function CategoryIcon({ name, color, size = 22 }: { name: string; color: string; size?: number }) {
  const p = { size, strokeWidth: 2, color };
  switch (name) {
    case 'School Uniforms':    return <Shirt {...p} />;
    case 'School Sports Kit':  return <Trophy {...p} />;
    case 'Shoes':              return <Footprints {...p} />;
    case 'Sports Equipment':   return <Dumbbell {...p} />;
    case 'Books & Stationery': return <BookOpen {...p} />;
    case 'Bags & Accessories': return <ShoppingBag {...p} />;
    default:                   return <Package {...p} />;
  }
}

type Listing = {
  id: string;
  title: string;
  category: string;
  price_cents: number;
  images: string[];
  seller_id: string;
  condition: string | null;
  created_at: string;
};

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function HomeScreen() {
  const router = useRouter();
  const { add, has, count } = useCart();
  const [firstName, setFirstName]       = useState('');
  const [search, setSearch]             = useState('');
  const [listings, setListings]         = useState<Listing[]>([]);
  const [filtered, setFiltered]         = useState<Listing[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selectedCat, setSelectedCat]   = useState<ListingCategory | ''>('');

  useFocusEffect(useCallback(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/' as never); return; }
      const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
      setFirstName(prof?.full_name?.split(' ')[0] ?? '');
    });
  }, []));

  useEffect(() => {
    setLoading(true);
    supabase
      .from('listings')
      .select('id, title, category, price_cents, images, seller_id, condition, created_at')
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => { setListings(data ?? []); setLoading(false); });
  }, []);

  useEffect(() => {
    let result = listings;
    if (selectedCat) result = result.filter(l => l.category === selectedCat);
    if (search.trim()) result = result.filter(l => l.title.toLowerCase().includes(search.toLowerCase()));
    setFiltered(result);
  }, [listings, selectedCat, search]);

  const CATS = ['', ...ALL_CATEGORIES] as const;

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Hero banner */}
            <View style={styles.hero}>
              <View style={styles.heroTop}>
                <View>
                  <Text style={styles.heroEyebrow}>Welcome back</Text>
                  <Text style={styles.heroName}>{firstName || 'NextKid'} 👋</Text>
                </View>
                {/* Cart icon with badge */}
                <TouchableOpacity style={styles.cartBtn} onPress={() => router.push('/cart' as never)}>
                  <ShoppingCart size={22} strokeWidth={2} color="#fff" />
                  {count > 0 && (
                    <View style={styles.cartBadge}>
                      <Text style={styles.cartBadgeText}>{count > 9 ? '9+' : count}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
              <Text style={styles.heroSub}>Buy &amp; sell uniforms, books, sports kit and more.</Text>
              <View style={styles.heroButtons}>
                <TouchableOpacity style={styles.heroBtn} onPress={() => router.push('/(tabs)/sell' as never)}>
                  <Text style={styles.heroBtnText}>+ Sell an item</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Trust bar */}
            <View style={styles.trustBar}>
              {[
                { icon: <MapPin size={11} strokeWidth={2} color={CRIMSON} />, label: "SA's school marketplace" },
                { icon: <Lock size={11} strokeWidth={2} color={CRIMSON} />, label: 'Secure payments' },
                { icon: <BadgeCheck size={11} strokeWidth={2} color={CRIMSON} />, label: 'Verified sellers' },
              ].map(t => (
                <View key={t.label} style={styles.trustItem}>
                  {t.icon}
                  <Text style={styles.trustText}>{t.label}</Text>
                </View>
              ))}
            </View>

            {/* Search bar */}
            <View style={styles.searchWrap}>
              <Search size={15} strokeWidth={2} color="#979797" />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search listings..."
                placeholderTextColor="#979797"
              />
            </View>

            {/* Category pills */}
            <Text style={styles.sectionTitle}>Shop by category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={styles.catContent}>
              {CATS.map(cat => (
                <TouchableOpacity
                  key={cat || 'all'}
                  style={[styles.catPill, selectedCat === cat && styles.catPillActive]}
                  onPress={() => setSelectedCat(cat as ListingCategory | '')}
                >
                  {cat ? <CategoryIcon name={cat} color={selectedCat === cat ? '#fff' : '#979797'} size={14} /> : null}
                  <Text style={[styles.catPillText, selectedCat === cat && styles.catPillTextActive]}>
                    {cat || 'All'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.recentHeader}>
              <Text style={styles.sectionTitle}>Recently listed</Text>
              <Text style={styles.recentSub}>Fresh items just added</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={CRIMSON} style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.emptyWrap}>
              <Package size={44} strokeWidth={1.5} color="#dedede" />
              <Text style={styles.emptyTitle}>No listings yet</Text>
              <Text style={styles.emptyText}>Be the first to sell something!</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(tabs)/sell' as never)}>
                <Text style={styles.emptyBtnText}>+ List an item</Text>
              </TouchableOpacity>
            </View>
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/item/${item.id}` as never)}
            activeOpacity={0.85}
          >
            <View style={styles.cardImageWrap}>
              {item.images?.[0] ? (
                <Image source={{ uri: item.images[0] }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <CategoryIcon name={item.category} color="#dedede" size={36} />
              )}
              <View style={styles.timeChip}>
                <Text style={styles.timeText}>{timeAgo(item.created_at)}</Text>
              </View>
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardCat}>{item.category}</Text>
              <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
              <View style={styles.cardFooter}>
                <Text style={styles.cardPrice}>R {(item.price_cents / 100).toFixed(2)}</Text>
                <TouchableOpacity
                  onPress={() => add({
                    listingId:   item.id,
                    title:       item.title,
                    price_cents: item.price_cents,
                    image:       item.images?.[0] ?? null,
                    sellerId:    item.seller_id,
                    category:    item.category,
                  })}
                  style={[styles.cartPill, has(item.id) && styles.cartPillActive]}
                  hitSlop={8}
                >
                  {has(item.id)
                    ? <Check size={12} strokeWidth={2.5} color="#fff" />
                    : <ShoppingCart size={12} strokeWidth={2} color={CRIMSON} />
                  }
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#fff' },
  listContent: { paddingBottom: 24 },
  row:         { paddingHorizontal: 12, gap: 10, marginBottom: 10 },

  hero:         { backgroundColor: '#3A3A3A', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },
  heroTop:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 },
  heroEyebrow:  { color: CRIMSON, fontSize: 11, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
  heroName:     { color: '#fff', fontSize: 28, fontWeight: '800', marginBottom: 6 },
  heroSub:      { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 16 },
  heroButtons:  { flexDirection: 'row', gap: 10 },
  heroBtn:      { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: CRIMSON, borderRadius: 30 },
  heroBtnText:  { color: '#fff', fontWeight: '700', fontSize: 13 },
  cartBtn:      { position: 'relative', padding: 6 },
  cartBadge:    { position: 'absolute', top: 0, right: 0, width: 18, height: 18, borderRadius: 9, backgroundColor: CRIMSON, alignItems: 'center', justifyContent: 'center' },
  cartBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },

  trustBar:   { backgroundColor: '#6B6B6B', paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  trustItem:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  trustText:  { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '500' },

  searchWrap:  { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, backgroundColor: SURFACE, borderRadius: 24, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: BORDER },
  searchInput: { flex: 1, color: '#111', fontSize: 14 },

  sectionTitle: { color: '#111', fontSize: 16, fontWeight: '700', marginHorizontal: 14, marginTop: 8, marginBottom: 10 },
  catScroll:    { flexGrow: 0 },
  catContent:   { paddingHorizontal: 12, paddingBottom: 8, gap: 8, flexDirection: 'row' },
  catPill:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER },
  catPillActive:{ backgroundColor: CRIMSON, borderColor: CRIMSON },
  catPillText:  { color: '#111', fontSize: 12, fontWeight: '500' },
  catPillTextActive: { color: '#fff' },

  recentHeader: { marginHorizontal: 14, marginTop: 16, marginBottom: 8 },
  recentSub:    { color: '#979797', fontSize: 12, marginTop: 2 },

  card:          { flex: 1, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: BORDER },
  cardImageWrap: { width: '100%', aspectRatio: 1, backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  timeChip:      { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  timeText:      { color: '#555', fontSize: 9, fontWeight: '500' },
  cardBody:      { padding: 10 },
  cardCat:       { color: '#979797', fontSize: 10, fontWeight: '500', marginBottom: 2 },
  cardTitle:     { color: '#111', fontSize: 12, fontWeight: '600', marginBottom: 6, lineHeight: 16 },
  cardPrice:     { color: CRIMSON, fontSize: 15, fontWeight: '800' },
  cardFooter:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cartPill:      { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: CRIMSON, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  cartPillActive:{ backgroundColor: CRIMSON, borderColor: CRIMSON },

  emptyWrap:    { alignItems: 'center', paddingTop: 48, gap: 8 },
  emptyTitle:   { color: '#111', fontSize: 15, fontWeight: '600' },
  emptyText:    { color: '#979797', fontSize: 13 },
  emptyBtn:     { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: CRIMSON, borderRadius: 30 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
