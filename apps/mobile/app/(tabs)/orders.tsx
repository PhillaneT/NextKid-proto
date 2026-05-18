import { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/src/lib/supabase';
import {
  Package, ShoppingBag, Truck, CheckCircle2, Clock,
  AlertTriangle, XCircle, ChevronRight, MapPin,
} from 'lucide-react-native';

// ── Types ─────────────────────────────────────────────────────────────────────

type OrderRow = {
  id: string;
  status: string;
  item_price_cents: number;
  shipping_cost_cents: number;
  total_paid_cents: number;
  shipping_method: string | null;
  created_at: string;
  waybill_number: string | null;
  listings: { title: string; images: string[] } | null;
};

type TabFilter = 'all' | 'active' | 'completed';

// ── Status config ─────────────────────────────────────────────────────────────

type StatusCfg = { label: string; color: string; bg: string; group: TabFilter };

function getStatus(status: string): StatusCfg {
  switch (status) {
    case 'PENDING_PAYMENT':           return { label: 'Awaiting payment',           color: '#92400e', bg: '#fffbeb', group: 'active' };
    case 'PAYMENT_HELD':              return { label: 'Payment held',                color: '#1e40af', bg: '#eff6ff', group: 'active' };
    case 'AWAITING_SHIPMENT_BOOKING': return { label: 'Waiting for seller to ship', color: '#1e40af', bg: '#eff6ff', group: 'active' };
    case 'SHIPMENT_BOOKED':           return { label: 'Shipment booked',             color: '#3730a3', bg: '#eef2ff', group: 'active' };
    case 'SHIPPED':                   return { label: 'Shipped',                     color: '#3730a3', bg: '#eef2ff', group: 'active' };
    case 'IN_TRANSIT':                return { label: 'In transit',                  color: '#5b21b6', bg: '#f5f3ff', group: 'active' };
    case 'OUT_FOR_DELIVERY':          return { label: 'Out for delivery',             color: '#5b21b6', bg: '#f5f3ff', group: 'active' };
    case 'DELIVERED':                 return { label: 'Delivered — confirm receipt', color: '#166534', bg: '#f0fdf4', group: 'active' };
    case 'COMPLETED':                 return { label: 'Completed',                   color: '#166534', bg: '#f0fdf4', group: 'completed' };
    case 'DISPUTED':                  return { label: 'Disputed',                    color: '#991b1b', bg: '#fef2f2', group: 'active' };
    case 'RESOLVED_REFUND':           return { label: 'Refunded',                    color: '#c2410c', bg: '#fff7ed', group: 'completed' };
    case 'RESOLVED_RELEASED':         return { label: 'Resolved',                    color: '#166534', bg: '#f0fdf4', group: 'completed' };
    case 'AUTO_CANCELLED':            return { label: 'Auto-cancelled',              color: '#979797', bg: '#f4f4f4', group: 'completed' };
    case 'CANCELLED':                 return { label: 'Cancelled',                   color: '#979797', bg: '#f4f4f4', group: 'completed' };
    default:                          return { label: status,                         color: '#979797', bg: '#f4f4f4', group: 'active' };
  }
}

const SHIPPING_LABELS: Record<string, string> = {
  D2D: 'Door-to-door', D2L: 'PUDO locker', L2D: 'Drop-off → door', L2L: 'Locker to locker',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtRands(cents: number) {
  return `R ${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
}

// ── Order card ────────────────────────────────────────────────────────────────

function OrderCard({ order, onPress }: { order: OrderRow; onPress: () => void }) {
  const cfg      = getStatus(order.status);
  const cover    = order.listings?.images?.[0] ?? null;
  const title    = order.listings?.title ?? 'Item no longer available';
  const shortId  = order.id.slice(0, 8).toUpperCase();

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardRow}>
        {/* Thumbnail */}
        <View style={styles.thumb}>
          {cover
            ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            : <Package size={22} strokeWidth={1.5} color="#dedede" />
          }
        </View>

        {/* Content */}
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <Text style={styles.cardTitle} numberOfLines={2}>{title}</Text>
            <ChevronRight size={15} strokeWidth={2} color="#dedede" />
          </View>

          <View style={styles.cardMeta}>
            <Text style={styles.metaText}>#{shortId}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>{fmtDate(order.created_at)}</Text>
            {order.shipping_method && (
              <>
                <Text style={styles.metaDot}>·</Text>
                <MapPin size={10} strokeWidth={2} color="#979797" />
                <Text style={styles.metaText}>{SHIPPING_LABELS[order.shipping_method] ?? order.shipping_method}</Text>
              </>
            )}
          </View>

          <View style={styles.cardBottom}>
            <Text style={styles.cardPrice}>{fmtRands(order.total_paid_cents)}</Text>
            <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
              <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>

          {order.status === 'DELIVERED' && (
            <View style={styles.deliveredBanner}>
              <Text style={styles.deliveredText}>Item arrived? Tap to confirm receipt.</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function OrdersScreen() {
  const router = useRouter();
  const [orders, setOrders]   = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<TabFilter>('all');

  useFocusEffect(useCallback(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/' as never); return; }

      const { data } = await supabase
        .from('orders')
        .select('id, status, item_price_cents, shipping_cost_cents, total_paid_cents, shipping_method, created_at, waybill_number, listings(title, images)')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });

      if (active) { setOrders((data ?? []) as unknown as OrderRow[]); setLoading(false); }
    }
    load();
    return () => { active = false; };
  }, []));

  const activeCount    = orders.filter(o => getStatus(o.status).group === 'active').length;
  const completedCount = orders.filter(o => getStatus(o.status).group === 'completed').length;
  const displayed      = tab === 'all' ? orders : orders.filter(o => getStatus(o.status).group === tab);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator color={CRIMSON} size="large" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.heading}>My Orders</Text>
        <Text style={styles.subheading}>Items you've purchased on NextKid.</Text>
      </View>

      {/* Tabs */}
      {orders.length > 0 && (
        <View style={styles.tabs}>
          {([
            ['all',       `All (${orders.length})`],
            ['active',    `Active (${activeCount})`],
            ['completed', `Done (${completedCount})`],
          ] as [TabFilter, string][]).map(([key, label]) => (
            <TouchableOpacity key={key} style={styles.tab} onPress={() => setTab(key)}>
              <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
              {tab === key && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <FlatList
        data={displayed}
        keyExtractor={o => o.id}
        contentContainerStyle={orders.length === 0 ? styles.emptyContainer : styles.list}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <OrderCard order={item} onPress={() => router.push(`/order/${item.id}` as never)} />
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <ShoppingBag size={44} strokeWidth={1.5} color="#dedede" />
            <Text style={styles.emptyTitle}>
              {tab === 'active' ? 'No active orders' : tab === 'completed' ? 'No completed orders' : 'No orders yet'}
            </Text>
            <Text style={styles.emptyText}>
              {tab === 'all' ? 'Items you buy will appear here with live tracking.' : 'Check back once orders progress.'}
            </Text>
            {tab === 'all' && (
              <TouchableOpacity style={styles.browseBtn} onPress={() => router.replace('/(tabs)' as never)}>
                <Text style={styles.browseBtnText}>Browse items</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const CRIMSON = '#BE1E2D';
const BORDER  = '#dedede';
const SURFACE = '#f4f4f4';

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#fff' },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:     { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  heading:    { color: '#111', fontSize: 22, fontWeight: '700' },
  subheading: { color: '#979797', fontSize: 13, marginTop: 2 },

  tabs:         { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER, marginBottom: 4 },
  tab:          { flex: 1, alignItems: 'center', paddingVertical: 12, position: 'relative' },
  tabText:      { color: '#979797', fontSize: 12, fontWeight: '500' },
  tabTextActive: { color: '#111', fontWeight: '700' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 8, right: 8, height: 2, backgroundColor: CRIMSON, borderRadius: 2 },

  list:           { paddingHorizontal: 14, paddingVertical: 12 },
  emptyContainer: { flex: 1, paddingHorizontal: 14 },

  card: {
    backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: BORDER,
    overflow: 'hidden',
  },
  cardRow:  { flexDirection: 'row', gap: 12, padding: 14 },
  thumb: {
    width: 62, height: 62, borderRadius: 12, backgroundColor: SURFACE,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardTop:  { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginBottom: 4 },
  cardTitle: { flex: 1, color: '#111', fontSize: 13, fontWeight: '600', lineHeight: 18 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 3, marginBottom: 8 },
  metaText: { color: '#979797', fontSize: 11 },
  metaDot:  { color: '#979797', fontSize: 11 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardPrice:  { color: '#111', fontSize: 14, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, maxWidth: '65%' },
  statusText:  { fontSize: 10, fontWeight: '700' },

  deliveredBanner: { marginTop: 8, backgroundColor: '#f0fdf4', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  deliveredText:   { color: '#166534', fontSize: 11, fontWeight: '600' },

  emptyWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60, gap: 8 },
  emptyTitle: { color: '#111', fontSize: 16, fontWeight: '600', marginTop: 8 },
  emptyText:  { color: '#979797', fontSize: 13, textAlign: 'center', maxWidth: 240 },
  browseBtn:  { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: CRIMSON, borderRadius: 30 },
  browseBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
