import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/src/lib/supabase';
import { ArrowLeft, Package, Truck, MapPin, Lock, Home } from 'lucide-react-native';
import LockerPicker from '@/src/components/LockerPicker';
import type { SelectedLocker } from '@/src/components/LockerPicker';
import { WEB_API_BASE } from '@/src/lib/api';
import type { ShippingQuote } from '@nextkid/shared';

// ── Types ─────────────────────────────────────────────────────────────────────

type CheckoutListing = {
  id: string; title: string; images: string[];
  price_cents: number; condition: string | null; seller_id: string; status: string;
};

type Step = 'loading' | 'error' | 'selecting' | 'placing';

// ── Helpers ───────────────────────────────────────────────────────────────────

const CRIMSON = '#BE1E2D';
const BORDER  = '#dedede';
const SURFACE = '#f4f4f4';

function fmt(cents: number) { return `R ${(cents / 100).toFixed(2)}`; }
function fmtF(n: number)    { return `R ${n.toFixed(2)}`; }

function fmtDateRange(from: Date | string, to: Date | string) {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const f = new Date(from).toLocaleDateString('en-ZA', opts);
  const t = new Date(to).toLocaleDateString('en-ZA', opts);
  return f === t ? f : `${f} – ${t}`;
}

const METHOD_LABELS: Record<string, string> = {
  D2D: 'Door-to-door delivery',
  D2L: 'PUDO locker delivery',
  L2D: 'PUDO drop-off → your door',
  L2L: 'PUDO locker to locker',
};

// ── Main screen ───────────────────────────────────────────────────────────────

export default function CheckoutScreen() {
  const { listingId } = useLocalSearchParams<{ listingId: string }>();
  const router        = useRouter();

  const [step,           setStep]           = useState<Step>('loading');
  const [listing,        setListing]        = useState<CheckoutListing | null>(null);
  const [quotes,         setQuotes]         = useState<ShippingQuote[]>([]);
  const [selectedId,     setSelectedId]     = useState<string | null>(null);
  const [itemPriceCents, setItemPriceCents] = useState(0);
  const [errorCode,      setErrorCode]      = useState<string | null>(null);

  const [buyerLockerId,      setBuyerLockerId]      = useState('');
  const [buyerLockerName,    setBuyerLockerName]    = useState('');
  const [buyerLockerAddress, setBuyerLockerAddress] = useState('');
  const [buyerSuburb,        setBuyerSuburb]        = useState('');
  const [buyerCity,          setBuyerCity]          = useState('');

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/' as never); return; }

      // 1. Fetch listing
      const { data: listingData, error: listingErr } = await supabase
        .from('listings')
        .select('id, title, images, price_cents, condition, seller_id, status')
        .eq('id', listingId).single();

      if (listingErr || !listingData) { setErrorCode('listing_not_found'); setStep('error'); return; }
      if (listingData.status !== 'ACTIVE') { setErrorCode('listing_unavailable'); setStep('error'); return; }
      if (listingData.seller_id === session.user.id) { setErrorCode('cannot_buy_own_item'); setStep('error'); return; }
      setListing(listingData as CheckoutListing);

      // 2. Check buyer has a delivery address
      const { data: prof } = await supabase
        .from('profiles')
        .select('street_address, suburb_name, city_name, preferred_locker_id, preferred_locker_name, preferred_locker_address')
        .eq('id', session.user.id).single();

      if (!prof?.street_address) { setErrorCode('no_delivery_address'); setStep('error'); return; }

      if (prof.suburb_name) setBuyerSuburb(prof.suburb_name);
      if (prof.city_name)   setBuyerCity(prof.city_name);
      if (prof.preferred_locker_id) {
        setBuyerLockerId(prof.preferred_locker_id);
        setBuyerLockerName(prof.preferred_locker_name ?? '');
        setBuyerLockerAddress(prof.preferred_locker_address ?? '');
      }

      // 3. Fetch shipping quotes from the web API
      try {
        const res = await fetch(`${WEB_API_BASE}/api/shipping/rates`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ listingId }),
        });
        const json = await res.json() as { quotes?: ShippingQuote[]; itemPriceCents?: number; error?: string };
        if (!res.ok) { setErrorCode(json.error ?? 'unknown'); setStep('error'); return; }
        const fetchedQuotes = json.quotes ?? [];
        setQuotes(fetchedQuotes);
        setItemPriceCents(json.itemPriceCents ?? listingData.price_cents);
        if (fetchedQuotes.length > 0) setSelectedId(fetchedQuotes[0].quoteId);
      } catch {
        setErrorCode('shipping_unavailable'); setStep('error'); return;
      }

      setStep('selecting');
    }
    load();
  }, [listingId]);

  const selectedQuote  = quotes.find(q => q.quoteId === selectedId) ?? null;
  const shippingCents  = selectedQuote ? Math.round(selectedQuote.rate * 100) : 0;
  const totalCents     = itemPriceCents + shippingCents;
  const isPudoDelivery = selectedQuote?.method === 'D2L' || selectedQuote?.method === 'L2L';

  const handleConfirmOrder = async () => {
    if (!selectedQuote) return;
    if (isPudoDelivery && !buyerLockerId) {
      Alert.alert('Select a locker', 'Please choose a PUDO collection locker for this delivery option.');
      return;
    }
    setStep('placing');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace('/' as never); return; }

    try {
      const res = await fetch(`${WEB_API_BASE}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          listingId,
          selectedQuote: {
            quoteId:            selectedQuote.quoteId,
            method:             selectedQuote.method,
            serviceLevelCode:   selectedQuote.serviceLevelCode,
            serviceLevelName:   selectedQuote.serviceLevelName,
            rate:               selectedQuote.rate,
            estimatedDeliveryFrom: new Date(selectedQuote.estimatedDeliveryFrom).toISOString(),
            estimatedDeliveryTo:   new Date(selectedQuote.estimatedDeliveryTo).toISOString(),
          },
          buyerLockerId:   buyerLockerId   || null,
          buyerLockerName: buyerLockerName || null,
        }),
      });
      const json = await res.json() as { orderId?: string; error?: string };
      if (!res.ok) { setErrorCode(json.error ?? 'unknown'); setStep('error'); return; }
      router.replace(`/order/${json.orderId}` as never);
    } catch {
      setErrorCode('unknown'); setStep('error');
    }
  };

  // ── Error state ───────────────────────────────────────────────────────────

  if (step === 'error') {
    const isAddressError = errorCode === 'no_delivery_address';
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
            <ArrowLeft size={16} strokeWidth={2} color={CRIMSON} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <View style={styles.errorCard}>
            {isAddressError ? (
              <>
                <MapPin size={28} strokeWidth={1.5} color="#d97706" />
                <Text style={styles.errorTitle}>Add your delivery info</Text>
                <Text style={styles.errorText}>
                  To get this item shipped to you, we need a street address. You can also save a preferred PUDO locker.
                </Text>
                <View style={styles.deliveryTips}>
                  <View style={styles.tip}><Home size={13} strokeWidth={2} color={CRIMSON} /><Text style={styles.tipText}><Text style={{ fontWeight: '700' }}>Street address</Text> — for door-to-door delivery</Text></View>
                  <View style={styles.tip}><MapPin size={13} strokeWidth={2} color={CRIMSON} /><Text style={styles.tipText}><Text style={{ fontWeight: '700' }}>PUDO locker</Text> — collect nearby (often cheaper)</Text></View>
                </View>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/(tabs)/profile' as never)}>
                  <Text style={styles.primaryBtnText}>Update my delivery info →</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Package size={28} strokeWidth={1.5} color="#dedede" />
                <Text style={styles.errorTitle}>Something went wrong</Text>
                <Text style={styles.errorText}>
                  {({
                    listing_not_found:           'This listing no longer exists.',
                    listing_unavailable:         'This item is not available for purchase.',
                    cannot_buy_own_item:         'You cannot buy your own listing.',
                    listing_no_longer_available: 'This item was just sold — sorry!',
                    shipping_unavailable:        'Shipping quotes unavailable. Make sure the web server is running and EXPO_PUBLIC_WEB_API_URL is set.',
                    no_shipping_methods:         'This item has no shipping options configured.',
                  } as Record<string, string>)[errorCode ?? ''] ?? 'Please try again.'}
                </Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()}>
                  <Text style={styles.primaryBtnText}>Go back</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (step === 'loading') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={CRIMSON} size="large" />
          <Text style={styles.loadingText}>Getting shipping quotes…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main checkout UI ──────────────────────────────────────────────────────

  const coverImage = listing?.images?.[0] ?? null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
            <ArrowLeft size={16} strokeWidth={2} color={CRIMSON} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.heading}>Checkout</Text>
        </View>

        {/* Item card */}
        {listing && (
          <View style={styles.itemCard}>
            <View style={styles.itemThumb}>
              {coverImage
                ? <Image source={{ uri: coverImage }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                : <Package size={24} strokeWidth={1.5} color="#dedede" />
              }
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.itemTitle} numberOfLines={2}>{listing.title}</Text>
              {listing.condition && (
                <Text style={styles.itemMeta}>Condition: {listing.condition.charAt(0) + listing.condition.slice(1).toLowerCase()}</Text>
              )}
              <Text style={styles.itemPrice}>{fmt(listing.price_cents)}</Text>
            </View>
          </View>
        )}

        {/* Shipping options */}
        <Text style={styles.sectionLabel}>Shipping options</Text>
        {quotes.length === 0 ? (
          <View style={styles.emptyQuotes}><Text style={styles.emptyQuotesText}>No shipping options available.</Text></View>
        ) : (
          quotes.map(quote => {
            const isSelected = quote.quoteId === selectedId;
            const isLocker   = quote.method === 'D2L' || quote.method === 'L2D' || quote.method === 'L2L';
            return (
              <TouchableOpacity
                key={quote.quoteId}
                style={[styles.quoteCard, isSelected && styles.quoteCardActive]}
                onPress={() => setSelectedId(quote.quoteId)}
              >
                <View style={styles.quoteRow}>
                  {isLocker
                    ? <MapPin size={17} strokeWidth={2} color={isSelected ? CRIMSON : '#979797'} />
                    : <Truck  size={17} strokeWidth={2} color={isSelected ? CRIMSON : '#979797'} />
                  }
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.quoteMethod, isSelected && { color: CRIMSON }]}>
                      {METHOD_LABELS[quote.method] ?? quote.method}{' '}
                      <Text style={styles.quoteSub}>({quote.serviceLevelName})</Text>
                    </Text>
                    <Text style={styles.quoteMeta}>
                      Est. {fmtDateRange(quote.estimatedDeliveryFrom, quote.estimatedDeliveryTo)}
                    </Text>
                  </View>
                  <Text style={[styles.quotePrice, isSelected && { color: CRIMSON }]}>{fmtF(quote.rate)}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* PUDO locker picker */}
        {isPudoDelivery && buyerSuburb && (
          <View style={styles.lockerSection}>
            <Text style={styles.lockerSectionTitle}>
              {buyerLockerId ? 'Your collection locker' : 'Choose a collection locker'}
            </Text>
            <Text style={styles.lockerSectionSub}>Your order will be delivered to this PUDO locker.</Text>
            <LockerPicker
              suburb={buyerSuburb}
              city={buyerCity}
              selectedId={buyerLockerId}
              selectedName={buyerLockerName}
              onSelect={(locker: SelectedLocker | null) => {
                setBuyerLockerId(locker?.id ?? '');
                setBuyerLockerName(locker?.name ?? '');
                setBuyerLockerAddress(locker?.address ?? '');
              }}
            />
          </View>
        )}

        {/* Order summary */}
        <View style={styles.summaryBox}>
          <Text style={[styles.sectionLabel, { marginBottom: 10 }]}>Order summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Item price</Text>
            <Text style={styles.summaryValue}>{fmt(itemPriceCents)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Shipping</Text>
            <Text style={styles.summaryValue}>{selectedQuote ? fmtF(selectedQuote.rate) : '—'}</Text>
          </View>
          <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: BORDER, marginTop: 6, paddingTop: 10 }]}>
            <Text style={[styles.summaryLabel, { color: '#111', fontWeight: '700', fontSize: 15 }]}>Total</Text>
            <Text style={[styles.summaryValue, { color: CRIMSON, fontWeight: '800', fontSize: 16 }]}>
              {selectedQuote ? fmt(totalCents) : '—'}
            </Text>
          </View>
        </View>

        {/* Confirm button */}
        <TouchableOpacity
          style={[styles.primaryBtn, (!selectedQuote || step === 'placing') && styles.btnDisabled]}
          onPress={handleConfirmOrder}
          disabled={!selectedQuote || step === 'placing'}
        >
          {step === 'placing'
            ? <ActivityIndicator color="#fff" />
            : <><Lock size={16} strokeWidth={2.5} color="#fff" /><Text style={styles.primaryBtnText}>Confirm Order</Text></>
          }
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f5f5f5' },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#979797', fontSize: 13 },
  scroll:      { padding: 16, paddingBottom: 40 },

  header:   { marginBottom: 16 },
  backRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  backText: { color: CRIMSON, fontSize: 14, fontWeight: '600' },
  heading:  { color: '#111', fontSize: 22, fontWeight: '700' },

  itemCard: {
    flexDirection: 'row', gap: 14, backgroundColor: '#fff',
    borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: BORDER,
  },
  itemThumb: {
    width: 68, height: 68, borderRadius: 12, backgroundColor: SURFACE,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
  },
  itemTitle: { color: '#111', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  itemMeta:  { color: '#979797', fontSize: 12, marginBottom: 4 },
  itemPrice: { color: CRIMSON, fontSize: 16, fontWeight: '800' },

  sectionLabel: { color: '#979797', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },

  emptyQuotes:    { backgroundColor: '#fff', borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 12 },
  emptyQuotesText: { color: '#979797', fontSize: 13 },

  quoteCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10,
    borderWidth: 2, borderColor: BORDER,
  },
  quoteCardActive: { borderColor: CRIMSON },
  quoteRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  quoteMethod: { color: '#111', fontSize: 13, fontWeight: '600', marginBottom: 2 },
  quoteSub:   { color: '#979797', fontWeight: '400' },
  quoteMeta:  { color: '#979797', fontSize: 11 },
  quotePrice: { color: '#111', fontSize: 15, fontWeight: '700', flexShrink: 0, marginLeft: 8 },

  lockerSection:     { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: BORDER },
  lockerSectionTitle: { color: '#111', fontSize: 14, fontWeight: '600', marginBottom: 3 },
  lockerSectionSub:   { color: '#979797', fontSize: 12, marginBottom: 10 },

  summaryBox:  { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: BORDER },
  summaryRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  summaryLabel: { color: '#555', fontSize: 13 },
  summaryValue: { color: '#111', fontSize: 13, fontWeight: '500' },

  primaryBtn:     { backgroundColor: CRIMSON, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnDisabled:    { backgroundColor: '#c0c0c0' },

  errorCard:    { backgroundColor: '#fff', borderRadius: 20, padding: 28, alignItems: 'center', gap: 12 },
  errorTitle:   { color: '#111', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  errorText:    { color: '#555', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  deliveryTips: { backgroundColor: SURFACE, borderRadius: 12, padding: 14, gap: 10, width: '100%' },
  tip:          { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  tipText:      { color: '#555', fontSize: 12, flex: 1, lineHeight: 17 },
});
