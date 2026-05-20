import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/src/lib/supabase';
import { WEB_API_BASE } from '@/src/lib/api';
import {
  ScanLine, Package, Clock, CheckCircle2, Banknote, ArrowRight, RefreshCw,
} from 'lucide-react-native';

const CRIMSON = '#BE1E2D';
const DARK    = '#111111';

type WaybillCard = {
  orderId:       string;
  waybillNumber: string;
  status:        string;
  dueBy:         string | null;
  droppedOffAt?: string | null;
};

type Dashboard = {
  schoolName:           string;
  cityName:             string;
  incoming:             WaybillCard[];
  atHub:                WaybillCard[];
  completedToday:       number;
  earningsThisMonth:    number;
  collectionsThisMonth: number;
};

function fmt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function fmtRands(cents: number) {
  return `R ${(cents / 100).toFixed(2)}`;
}

function timeUntil(iso: string | null): string | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return 'OVERDUE';
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'Due soon';
  if (h < 24) return `${h}h left`;
  return `${Math.floor(h / 24)}d left`;
}

function WaybillRow({ card, type }: { card: WaybillCard; type: 'incoming' | 'atHub' }) {
  const overdue   = type === 'incoming' && !!card.dueBy && new Date(card.dueBy) < new Date();
  const remaining = type === 'incoming' ? timeUntil(card.dueBy) : null;

  return (
    <View style={[styles.waybillRow, overdue && styles.waybillRowOverdue]}>
      <View style={[styles.dot, type === 'incoming' ? (overdue ? styles.dotRed : styles.dotAmber) : styles.dotGreen]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.waybillNumber}>{card.waybillNumber}</Text>
        <Text style={styles.waybillSub}>
          {type === 'incoming' ? `Due ${fmt(card.dueBy)}` : `Received ${fmt(card.droppedOffAt ?? null)}`}
        </Text>
      </View>
      {remaining && (
        <View style={[styles.tag, overdue ? styles.tagRed : styles.tagAmber]}>
          <Text style={[styles.tagText, overdue ? { color: '#dc2626' } : { color: '#92400e' }]}>{remaining}</Text>
        </View>
      )}
      {type === 'atHub' && (
        <View style={[styles.tag, styles.tagGreen]}>
          <Text style={[styles.tagText, { color: '#166534' }]}>Ready</Text>
        </View>
      )}
    </View>
  );
}

export default function KlerebankScreen() {
  const router = useRouter();
  const [data,      setData]      = useState<Dashboard | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,     setError]     = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace('/' as never); return; }

    const res = await fetch(`${WEB_API_BASE}/api/klerebank/dashboard`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (res.status === 403) { router.replace('/(tabs)' as never); return; }
    if (!res.ok) { setError('Could not load dashboard'); setLoading(false); setRefreshing(false); return; }

    setData(await res.json());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return (
    <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator color={CRIMSON} size="large" />
    </SafeAreaView>
  );

  if (!data) return (
    <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>{error || 'Dashboard unavailable'}</Text>
    </SafeAreaView>
  );

  const totalActive = data.incoming.length + data.atHub.length;

  return (
    <SafeAreaView style={styles.container}>

      {/* Hub Mode header */}
      <View style={styles.hubBar}>
        <View style={styles.hubPulse} />
        <Text style={styles.hubLabel}>HUB MODE</Text>
        <TouchableOpacity onPress={() => router.replace('/(tabs)' as never)} style={styles.switchBtn}>
          <Text style={styles.switchText}>Marketplace</Text>
          <ArrowRight size={12} strokeWidth={2.5} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={CRIMSON} />}
      >
        {/* School identity */}
        <View style={styles.schoolHeader}>
          <Text style={styles.schoolName}>{data.schoolName}</Text>
          <Text style={styles.schoolCity}>{data.cityName} · Klerebank Hub</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: 'Incoming',   value: String(data.incoming.length),     color: '#fbbf24' },
            { label: 'At hub',     value: String(data.atHub.length),        color: '#60a5fa' },
            { label: 'Done today', value: String(data.completedToday),      color: '#4ade80' },
            { label: 'This month', value: fmtRands(data.earningsThisMonth), color: CRIMSON },
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Primary action */}
        <TouchableOpacity style={styles.scanBtn} onPress={() => router.push('/admin/scan' as never)}>
          <ScanLine size={22} strokeWidth={2} color="#fff" />
          <Text style={styles.scanBtnText}>Scan QR Code</Text>
        </TouchableOpacity>

        {/* Incoming */}
        {data.incoming.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Clock size={14} strokeWidth={2} color="#fbbf24" />
              <Text style={styles.sectionTitle}>Expecting drop-offs</Text>
              <Text style={styles.sectionCount}>{data.incoming.length}</Text>
            </View>
            {data.incoming.map(c => <WaybillRow key={c.orderId} card={c} type="incoming" />)}
          </View>
        )}

        {/* At hub */}
        {data.atHub.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Package size={14} strokeWidth={2} color="#60a5fa" />
              <Text style={styles.sectionTitle}>Held — awaiting collection</Text>
              <Text style={styles.sectionCount}>{data.atHub.length}</Text>
            </View>
            {data.atHub.map(c => <WaybillRow key={c.orderId} card={c} type="atHub" />)}
          </View>
        )}

        {totalActive === 0 && (
          <View style={styles.emptyCard}>
            <CheckCircle2 size={36} strokeWidth={1.5} color="rgba(255,255,255,0.15)" />
            <Text style={styles.emptyText}>All clear — no active waybills</Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: DARK },
  scroll:      { padding: 16, paddingBottom: 40, gap: 14 },

  hubBar:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: CRIMSON, paddingHorizontal: 16, paddingVertical: 10 },
  hubPulse:    { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
  hubLabel:    { flex: 1, color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  switchBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  switchText:  { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '500' },

  schoolHeader: { gap: 2 },
  schoolName:   { color: '#fff', fontSize: 20, fontWeight: '700' },
  schoolCity:   { color: 'rgba(255,255,255,0.45)', fontSize: 13 },

  statsRow:  { flexDirection: 'row', gap: 10 },
  statCard:  { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 12, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 },

  scanBtn:     { backgroundColor: CRIMSON, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18 },
  scanBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  section:       { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f4f4f4' },
  sectionTitle:  { flex: 1, color: DARK, fontSize: 13, fontWeight: '600' },
  sectionCount:  { color: '#979797', fontSize: 12 },

  waybillRow:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f9f9f9' },
  waybillRowOverdue:  { backgroundColor: '#fff5f5' },
  dot:        { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  dotAmber:   { backgroundColor: '#fbbf24' },
  dotGreen:   { backgroundColor: '#4ade80' },
  dotRed:     { backgroundColor: '#ef4444' },
  waybillNumber: { fontFamily: 'monospace', fontSize: 14, fontWeight: '700', color: DARK, letterSpacing: 0.5 },
  waybillSub:    { color: '#979797', fontSize: 11, marginTop: 2 },

  tag:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  tagAmber:  { backgroundColor: '#fffbeb' },
  tagGreen:  { backgroundColor: '#f0fdf4' },
  tagRed:    { backgroundColor: '#fef2f2' },
  tagText:   { fontSize: 10, fontWeight: '700' },

  emptyCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 40, alignItems: 'center', gap: 10 },
  emptyText: { color: 'rgba(255,255,255,0.3)', fontSize: 13 },
});
