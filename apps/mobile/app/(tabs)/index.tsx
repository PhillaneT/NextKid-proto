import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  Image, StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/src/lib/supabase';
import { WEB_API_BASE } from '@/src/lib/api';
import {
  Shirt, Trophy, Footprints, Dumbbell, BookOpen, ShoppingBag, Package,
  Lock, BadgeCheck, MapPin, Search, ShoppingCart, Check, School,
  Sparkles, Baby, Heart,
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

type BrowseTab = 'my_school' | 'all';

type FeedItem = {
  id: string; title: string; category: string; price_cents: number
  images: string[]; size: string | null; seller_id: string; seller_school_id: string | null
};
type FeedSection  = { type: string; title: string; items: FeedItem[] };
type ChildFeed    = { childId: string; nickname: string; gender: string; sections: FeedSection[] };
type PersonalFeed = { children: ChildFeed[]; fromCache: boolean } | null;

type Listing = {
  id: string;
  title: string;
  category: string;
  price_cents: number;
  images: string[];
  seller_id: string;
  seller_school_id: string | null;
  condition: string | null;
  created_at: string;
  is_multi_item: boolean;
  available_count: number;
  schools: { name: string } | null;
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
  const [firstName, setFirstName]         = useState('');
  const [userSchoolIds, setUserSchoolIds] = useState<string[]>([]);
  const [tab, setTab]                     = useState<BrowseTab>('all');
  const [search, setSearch]               = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [listings, setListings]           = useState<Listing[]>([]);
  const [filtered, setFiltered]           = useState<Listing[]>([]);
  const [loading, setLoading]             = useState(true);
  const [selectedCat, setSelectedCat]     = useState<ListingCategory | ''>('');
  const [personalFeed, setPersonalFeed]   = useState<PersonalFeed>(null);
  const [activeChild, setActiveChild]     = useState(0);
  const [feedLoading, setFeedLoading]     = useState(false);
  const [wishlistIds, setWishlistIds]     = useState<Set<string>>(new Set());
  const [wishlistLoading, setWishlistLoading] = useState<string | null>(null);
  const [otherListings, setOtherListings] = useState<Listing[]>([]);

  // Load user profile + school IDs on every focus; also refresh feed
  useFocusEffect(useCallback(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/' as never); return; }
      const { data: prof } = await supabase
        .from('profiles').select('full_name, school_ids').eq('id', session.user.id).single();
      setFirstName(prof?.full_name?.split(' ')[0] ?? '');
      setUserSchoolIds(prof?.school_ids ?? []);

      // Load personalised feed
      setFeedLoading(true);
      fetch(`${WEB_API_BASE}/api/feed`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => { setPersonalFeed(data); setFeedLoading(false); })
        .catch(() => setFeedLoading(false));

      // Load wishlist IDs
      fetch(`${WEB_API_BASE}/api/wishlist`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.items) {
            setWishlistIds(new Set(data.items.map((i: { listing_id: string }) => i.listing_id)));
          }
        })
        .catch(() => {});
    });
  }, []));

  // Fetch all active listings once
  useEffect(() => {
    setLoading(true);
    supabase
      .from('listings')
      .select('id, title, category, price_cents, images, seller_id, seller_school_id, condition, created_at, is_multi_item, available_count, schools(name)')
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setListings((data as unknown as Listing[]) ?? []); setLoading(false); });
  }, []);

  // Debounce search input 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Client-side filter: tab + category + debounced search
  useEffect(() => {
    let result = listings;
    if (tab === 'my_school' && userSchoolIds.length > 0) {
      result = result.filter(l => l.seller_school_id && userSchoolIds.includes(l.seller_school_id));
    }
    if (selectedCat) result = result.filter(l => l.category === selectedCat);
    if (debouncedSearch.trim()) result = result.filter(l => l.title.toLowerCase().includes(debouncedSearch.toLowerCase()));
    setFiltered(result);
  }, [listings, selectedCat, debouncedSearch, tab, userSchoolIds]);

  // Fetch "other listings" when on My School tab
  useEffect(() => {
    if (tab !== 'my_school' || userSchoolIds.length === 0) { setOtherListings([]); return; }
    supabase
      .from('listings')
      .select('id, title, category, price_cents, images, seller_id, seller_school_id, condition, created_at, is_multi_item, available_count, schools(name)')
      .eq('status', 'ACTIVE')
      .not('seller_school_id', 'in', `(${userSchoolIds.join(',')})`)
      .order('created_at', { ascending: false })
      .then(({ data }) => setOtherListings((data as unknown as Listing[]) ?? []));
  }, [tab, userSchoolIds]);

  async function toggleWishlist(listingId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setWishlistLoading(listingId);
    const token = session.access_token;
    if (wishlistIds.has(listingId)) {
      await fetch(`${WEB_API_BASE}/api/wishlist/${listingId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setWishlistIds(prev => { const n = new Set(prev); n.delete(listingId); return n; });
    } else {
      await fetch(`${WEB_API_BASE}/api/wishlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ listingId }),
      });
      setWishlistIds(prev => new Set(prev).add(listingId));
    }
    setWishlistLoading(null);
  }

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

            {/* ── Personalised feed ── */}
            {feedLoading ? (
              <View style={styles.feedLoadingRow}>
                <Sparkles size={14} strokeWidth={2} color={CRIMSON} />
                <Text style={styles.feedLoadingText}>Building your personalised feed...</Text>
              </View>
            ) : personalFeed && personalFeed.children.length > 0 ? (
              <View style={styles.feedSection}>
                <View style={styles.feedHeader}>
                  <Sparkles size={15} strokeWidth={2} color={CRIMSON} />
                  <Text style={styles.feedTitle}>Your Personalised Feed</Text>
                  <TouchableOpacity onPress={() => router.push('/children' as never)} style={styles.feedManageBtn}>
                    <Baby size={12} strokeWidth={2} color={CRIMSON} />
                    <Text style={styles.feedManageText}>Manage</Text>
                  </TouchableOpacity>
                </View>

                {/* Child tabs (multi-child) */}
                {personalFeed.children.length > 1 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.childTabScroll} contentContainerStyle={styles.childTabContent}>
                    {personalFeed.children.map((child, i) => (
                      <TouchableOpacity
                        key={child.childId}
                        style={[styles.childTab, activeChild === i && styles.childTabActive]}
                        onPress={() => setActiveChild(i)}
                      >
                        <Text style={[styles.childTabText, activeChild === i && styles.childTabTextActive]}>
                          {child.gender === 'boy' ? '👦' : child.gender === 'girl' ? '👧' : '🧒'} {child.nickname}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                {/* Sections for active child */}
                {(personalFeed.children[activeChild]?.sections ?? []).map(section => (
                  <View key={section.type} style={styles.sectionBlock}>
                    <Text style={styles.sectionBlockTitle}>{section.title}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 14 }}>
                      {section.items.map(item => (
                        <TouchableOpacity
                          key={item.id}
                          style={styles.feedCard}
                          onPress={() => router.push(`/item/${item.id}` as never)}
                          activeOpacity={0.85}
                        >
                          <View style={styles.feedCardImage}>
                            {item.images?.[0] ? (
                              <Image source={{ uri: item.images[0] }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                            ) : (
                              <CategoryIcon name={item.category} color="#dedede" size={28} />
                            )}
                            {item.size && (
                              <View style={styles.feedSizeChip}>
                                <Text style={styles.feedSizeText}>Size {item.size}</Text>
                              </View>
                            )}
                          </View>
                          <View style={styles.feedCardBody}>
                            <Text style={styles.feedCardCat} numberOfLines={1}>{item.category}</Text>
                            <Text style={styles.feedCardTitle} numberOfLines={2}>{item.title}</Text>
                            <Text style={styles.feedCardPrice}>R {(item.price_cents / 100).toFixed(2)}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                ))}
              </View>
            ) : !feedLoading && personalFeed && personalFeed.children.length === 0 ? (
              <TouchableOpacity style={styles.addChildBanner} onPress={() => router.push('/children' as never)}>
                <Baby size={18} strokeWidth={1.5} color={CRIMSON} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.addChildTitle}>Get a personalised feed</Text>
                  <Text style={styles.addChildSub}>Add your child's sizes to see what fits right now.</Text>
                </View>
                <Text style={styles.addChildArrow}>→</Text>
              </TouchableOpacity>
            ) : null}

            {/* My School / All Items tab switcher */}
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tabBtn, tab === 'my_school' && styles.tabBtnActive]}
                onPress={() => setTab('my_school')}
              >
                <School size={13} strokeWidth={2} color={tab === 'my_school' ? CRIMSON : '#979797'} />
                <Text style={[styles.tabBtnText, tab === 'my_school' && styles.tabBtnTextActive]}>My School</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, tab === 'all' && styles.tabBtnActive]}
                onPress={() => setTab('all')}
              >
                <Package size={13} strokeWidth={2} color={tab === 'all' ? CRIMSON : '#979797'} />
                <Text style={[styles.tabBtnText, tab === 'all' && styles.tabBtnTextActive]}>All Items</Text>
              </TouchableOpacity>
            </View>

            {/* No school warning */}
            {tab === 'my_school' && userSchoolIds.length === 0 && (
              <View style={styles.noSchoolBanner}>
                <Text style={styles.noSchoolText}>Add a school in your profile to see uniform and kit listings.</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/profile' as never)}>
                  <Text style={styles.noSchoolLink}>Add school →</Text>
                </TouchableOpacity>
              </View>
            )}

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
              <Text style={styles.sectionTitle}>
                {tab === 'my_school' ? 'At your school' : 'Recently listed'}
              </Text>
              <Text style={styles.recentSub}>
                {tab === 'my_school' ? 'Items from your school community' : 'Fresh items just added'}
              </Text>
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
        renderItem={({ item }) => <ListingCard item={item} wishlistIds={wishlistIds} wishlistLoading={wishlistLoading} has={has} add={add} toggleWishlist={toggleWishlist} router={router} />}
        ListFooterComponent={
          tab === 'my_school' && otherListings.length > 0 ? (
            <View style={{ marginTop: 8 }}>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>Other listings across South Africa</Text>
                <View style={styles.dividerLine} />
              </View>
              {otherListings.reduce((rows: Listing[][], item, i) => {
                if (i % 2 === 0) rows.push([item]);
                else rows[rows.length - 1].push(item);
                return rows;
              }, []).map((row, i) => (
                <View key={i} style={[styles.row, { paddingHorizontal: 12 }]}>
                  {row.map(item => (
                    <ListingCard key={item.id} item={item} wishlistIds={wishlistIds} wishlistLoading={wishlistLoading} has={has} add={add} toggleWishlist={toggleWishlist} router={router} />
                  ))}
                  {row.length === 1 && <View style={{ flex: 1 }} />}
                </View>
              ))}
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function ListingCard({ item, wishlistIds, wishlistLoading, has, add, toggleWishlist, router }: {
  item: Listing;
  wishlistIds: Set<string>;
  wishlistLoading: string | null;
  has: (id: string) => boolean;
  add: (item: any) => void;
  toggleWishlist: (id: string) => void;
  router: any;
}) {
  const schoolName = (item.schools as any)?.name ?? null;
  return (
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
        {item.is_multi_item && item.available_count > 0 && (
          <View style={styles.bundleChip}>
            <Text style={styles.bundleText}>Bundle · {item.available_count} items</Text>
          </View>
        )}
        <View style={styles.timeChip}>
          <Text style={styles.timeText}>{timeAgo(item.created_at)}</Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        {schoolName && (
          <View style={styles.schoolRow}>
            <School size={9} strokeWidth={2} color={CRIMSON} />
            <Text style={styles.schoolName} numberOfLines={1}>{schoolName}</Text>
          </View>
        )}
        <Text style={styles.cardCat}>{item.category}</Text>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.cardPrice}>R{(item.price_cents / 100).toFixed(2)}</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity
              onPress={() => toggleWishlist(item.id)}
              disabled={wishlistLoading === item.id}
              style={[styles.cartPill, wishlistIds.has(item.id) && styles.heartPillActive]}
              hitSlop={8}
            >
              <Heart size={11} strokeWidth={2} color={wishlistIds.has(item.id) ? '#fff' : CRIMSON} fill={wishlistIds.has(item.id) ? '#fff' : 'none'} />
            </TouchableOpacity>
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
      </View>
    </TouchableOpacity>
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

  // My School / All Items tabs
  tabBar:            { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER, marginTop: 4 },
  tabBtn:            { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 12 },
  tabBtnActive:      {},
  tabBtnText:        { color: '#979797', fontSize: 13, fontWeight: '500' },
  tabBtnTextActive:  { color: CRIMSON, fontWeight: '700' },
  tabUnderline:      { position: 'absolute' as const, bottom: 0, left: 8, right: 8, height: 2, backgroundColor: CRIMSON, borderRadius: 2 },
  noSchoolBanner:    { margin: 12, padding: 12, backgroundColor: '#fff5f5', borderRadius: 12, borderWidth: 1, borderColor: '#fecaca', gap: 4 },
  noSchoolText:      { color: '#979797', fontSize: 12, lineHeight: 17 },
  noSchoolLink:      { color: CRIMSON, fontSize: 12, fontWeight: '600' },

  recentHeader: { marginHorizontal: 14, marginTop: 16, marginBottom: 8 },
  recentSub:    { color: '#979797', fontSize: 12, marginTop: 2 },

  card:          { flex: 1, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: BORDER },
  cardImageWrap: { width: '100%', aspectRatio: 1, backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  bundleChip:    { position: 'absolute', top: 6, left: 6, backgroundColor: CRIMSON, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
  bundleText:    { color: '#fff', fontSize: 9, fontWeight: '700' },
  timeChip:      { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  timeText:      { color: '#555', fontSize: 9, fontWeight: '500' },
  cardBody:      { padding: 10 },
  cardCat:       { color: '#979797', fontSize: 10, fontWeight: '500', marginBottom: 2 },
  cardTitle:     { color: '#111', fontSize: 12, fontWeight: '600', marginBottom: 6, lineHeight: 16 },
  cardPrice:     { color: CRIMSON, fontSize: 15, fontWeight: '800' },
  cardFooter:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cartPill:       { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: CRIMSON, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  cartPillActive: { backgroundColor: CRIMSON, borderColor: CRIMSON },
  heartPillActive:{ backgroundColor: CRIMSON, borderColor: CRIMSON },
  schoolRow:      { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 },
  schoolName:     { color: CRIMSON, fontSize: 9, fontWeight: '600', flex: 1 },
  dividerRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 14, marginTop: 16, marginBottom: 12 },
  dividerLine:    { flex: 1, height: 1, backgroundColor: BORDER },
  dividerText:    { color: '#979797', fontSize: 11, fontWeight: '500', textAlign: 'center', flexShrink: 1 },

  emptyWrap:    { alignItems: 'center', paddingTop: 48, gap: 8 },
  emptyTitle:   { color: '#111', fontSize: 15, fontWeight: '600' },
  emptyText:    { color: '#979797', fontSize: 13 },
  emptyBtn:     { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: CRIMSON, borderRadius: 30 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Personalised feed
  feedLoadingRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 14, marginVertical: 12, padding: 12, backgroundColor: '#fff5f5', borderRadius: 12 },
  feedLoadingText: { color: CRIMSON, fontSize: 13, fontWeight: '500' },
  feedSection:     { marginTop: 4 },
  feedHeader:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 14, marginBottom: 10 },
  feedTitle:       { flex: 1, color: '#111', fontSize: 15, fontWeight: '700' },
  feedManageBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  feedManageText:  { color: CRIMSON, fontSize: 12, fontWeight: '600' },
  childTabScroll:  { flexGrow: 0 },
  childTabContent: { paddingHorizontal: 14, gap: 8, flexDirection: 'row', marginBottom: 10 },
  childTab:        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: '#fff' },
  childTabActive:  { backgroundColor: CRIMSON, borderColor: CRIMSON },
  childTabText:    { color: '#555', fontSize: 13, fontWeight: '600' },
  childTabTextActive: { color: '#fff' },
  sectionBlock:    { marginBottom: 16 },
  sectionBlockTitle: { color: '#111', fontSize: 13, fontWeight: '700', marginHorizontal: 14, marginBottom: 8 },
  feedCard:        { width: 140, backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: BORDER },
  feedCardImage:   { width: 140, height: 140, backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  feedSizeChip:    { position: 'absolute', top: 6, left: 6, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  feedSizeText:    { fontSize: 9, fontWeight: '700', color: '#111' },
  feedCardBody:    { padding: 8 },
  feedCardCat:     { color: '#979797', fontSize: 10, marginBottom: 2 },
  feedCardTitle:   { color: '#111', fontSize: 11, fontWeight: '600', lineHeight: 15, marginBottom: 4 },
  feedCardPrice:   { color: CRIMSON, fontSize: 13, fontWeight: '800' },
  addChildBanner:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 14, marginVertical: 10, padding: 14, backgroundColor: '#fff5f5', borderRadius: 14, borderWidth: 1, borderColor: '#fecaca' },
  addChildTitle:   { color: '#111', fontSize: 13, fontWeight: '700' },
  addChildSub:     { color: '#979797', fontSize: 11, marginTop: 2 },
  addChildArrow:   { color: CRIMSON, fontSize: 18, fontWeight: '700' },
});
