import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, Image,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/src/lib/supabase';

type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_age_verified: boolean;
};

type Item = {
  id: string;
  title: string;
  price: number;
  images: string[];
  status: string;
};

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [listings, setListings] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace('/' as never); return; }

    const [{ data: prof }, { data: items }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('items').select('id, title, price, images, status').eq('seller_id', user.id).order('created_at', { ascending: false }),
    ]);

    if (!prof) { router.replace('/onboarding' as never); return; }
    setProfile(prof);
    setListings(items ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const signOut = async () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out', style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/' as never);
        },
      },
    ]);
  };

  const deleteListing = async (itemId: string) => {
    Alert.alert('Delete listing', 'This will delist the item. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await supabase.from('items').update({ status: 'delisted' }).eq('id', itemId);
          setListings(prev => prev.filter(i => i.id !== itemId));
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#a855f7" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Profile header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile?.full_name?.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.name}>{profile?.full_name}</Text>
          <Text style={styles.email}>{profile?.email}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, profile?.is_age_verified ? styles.badgeGreen : styles.badgeGray]}>
              <Text style={styles.badgeText}>
                {profile?.is_age_verified ? 'Verified 18+' : 'Browse only'}
              </Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{profile?.role}</Text>
            </View>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      {/* My listings */}
      <Text style={styles.sectionTitle}>My Listings ({listings.length})</Text>

      {listings.length === 0 ? (
        <Text style={styles.empty}>You haven't listed anything yet.</Text>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={i => i.id}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.listingRow}
              onPress={() => router.push(`/item/${item.id}` as never)}
              activeOpacity={0.8}
            >
              {item.images?.[0] ? (
                <Image source={{ uri: item.images[0] }} style={styles.listingThumb} />
              ) : (
                <View style={[styles.listingThumb, styles.listingThumbPlaceholder]}>
                  <Text>📦</Text>
                </View>
              )}
              <View style={styles.listingInfo}>
                <Text style={styles.listingTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.listingPrice}>R{(item.price / 100).toLocaleString()}</Text>
                <View style={[styles.statusBadge, item.status !== 'active' && styles.statusInactive]}>
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => deleteListing(item.id)} style={styles.deleteBtn}>
                <Text style={styles.deleteText}>✕</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  centered: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', padding: 20, gap: 16, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '700' },
  headerInfo: { flex: 1, gap: 2 },
  name: { color: '#fff', fontSize: 18, fontWeight: '700' },
  email: { color: '#888', fontSize: 13 },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  badge: { backgroundColor: '#1a1a1a', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: '#333' },
  badgeGreen: { borderColor: '#16a34a', backgroundColor: '#052e16' },
  badgeGray: { borderColor: '#555' },
  badgeText: { color: '#aaa', fontSize: 11, fontWeight: '600' },
  signOutBtn: { marginHorizontal: 20, marginVertical: 12, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#333', alignItems: 'center' },
  signOutText: { color: '#888', fontWeight: '600', fontSize: 14 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', paddingHorizontal: 20, paddingBottom: 12 },
  empty: { color: '#555', textAlign: 'center', marginTop: 40 },
  listContainer: { paddingHorizontal: 16, paddingBottom: 20 },
  listingRow: { flexDirection: 'row', backgroundColor: '#111', borderRadius: 12, marginBottom: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#1a1a1a', alignItems: 'center' },
  listingThumb: { width: 70, height: 70 },
  listingThumbPlaceholder: { backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center' },
  listingInfo: { flex: 1, padding: 10, gap: 3 },
  listingTitle: { color: '#fff', fontSize: 13, fontWeight: '600' },
  listingPrice: { color: '#a855f7', fontSize: 14, fontWeight: '700' },
  statusBadge: { alignSelf: 'flex-start', backgroundColor: '#052e16', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  statusInactive: { backgroundColor: '#1a1a1a' },
  statusText: { color: '#aaa', fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  deleteBtn: { padding: 16 },
  deleteText: { color: '#555', fontSize: 16 },
});
