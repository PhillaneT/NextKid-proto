import { useEffect, useState } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, TextInput, Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/src/lib/supabase';
import { Pencil, Check, X, MapPin, School as SchoolIcon } from 'lucide-react-native';

const BLUE = '#BE1E2D';
const BORDER = '#dedede';
const SURFACE = '#f4f4f4';

type Item = {
  id: string;
  title: string;
  category: string;
  price: number;
  description_part1: string | null;
  description_part2: string | null;
  images: string[];
  condition: string | null;
  seller_id: string;
  status: string;
  listing_type: string | null;
  school_id: string | null;
  is_school_specific: boolean;
};

const CONDITION_LABELS: Record<string, string> = {
  new: 'New', like_new: 'Like New', good: 'Good', fair: 'Fair', poor: 'Poor',
};

const CONDITIONS = ['new', 'like_new', 'good', 'fair', 'poor'] as const;

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [isOwner, setIsOwner] = useState(false);
  const [isAgeVerified, setIsAgeVerified] = useState(false);
  const [sellerProvince, setSellerProvince] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editDesc1, setEditDesc1] = useState('');
  const [editDesc2, setEditDesc2] = useState('');
  const [editCondition, setEditCondition] = useState('');
  const [saving, setSaving] = useState(false);

  // Offer state
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [submittingOffer, setSubmittingOffer] = useState(false);

  useEffect(() => {
    async function load() {
      const [{ data: itemData }, { data: { user } }] = await Promise.all([
        supabase.from('items').select('*').eq('id', id).single(),
        supabase.auth.getUser(),
      ]);

      if (!itemData) { router.back(); return; }
      setItem(itemData);

      // Fetch seller province and school name (no personal info exposed)
      const [{ data: sellerProfile }, { data: schoolRow }] = await Promise.all([
        supabase.from('profiles').select('province').eq('id', itemData.seller_id).single(),
        itemData.school_id
          ? supabase.from('schools').select('name').eq('id', itemData.school_id).single()
          : Promise.resolve({ data: null }),
      ]);
      setSellerProvince(sellerProfile?.province ?? null);
      setSchoolName((schoolRow as { name: string } | null)?.name ?? null);

      if (user) {
        setIsOwner(user.id === itemData.seller_id);
        const { data: profile } = await supabase
          .from('profiles').select('is_age_verified').eq('id', user.id).single();
        setIsAgeVerified(profile?.is_age_verified ?? false);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  const startEdit = () => {
    if (!item) return;
    setEditTitle(item.title);
    setEditPrice(String(item.price / 100));
    setEditDesc1(item.description_part1 ?? '');
    setEditDesc2(item.description_part2 ?? '');
    setEditCondition(item.condition ?? '');
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const saveEdit = async () => {
    if (!item) return;
    const cents = Math.round(parseFloat(editPrice) * 100);
    if (!editTitle.trim()) { Alert.alert('Required', 'Title cannot be empty.'); return; }
    if (isNaN(cents) || cents <= 0) { Alert.alert('Invalid price', 'Please enter a valid price.'); return; }

    setSaving(true);
    const { error } = await supabase.from('items').update({
      title: editTitle.trim(),
      price: cents,
      description_part1: editDesc1 || null,
      description_part2: editDesc2 || null,
      condition: editCondition || null,
    }).eq('id', item.id);

    setSaving(false);
    if (error) {
      Alert.alert('Error', 'Could not save changes. Please try again.');
    } else {
      setItem(prev => prev ? {
        ...prev,
        title: editTitle.trim(),
        price: cents,
        description_part1: editDesc1 || null,
        description_part2: editDesc2 || null,
        condition: editCondition || null,
      } : prev);
      setEditing(false);
      Alert.alert('Saved!', 'Your listing has been updated.');
    }
  };

  const handleMakeOffer = async () => {
    const cents = Math.round(parseFloat(offerAmount) * 100);
    if (!offerAmount || isNaN(cents) || cents <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid offer amount.');
      return;
    }
    setSubmittingOffer(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('offers').insert({
      item_id: id, buyer_id: user!.id, seller_id: item!.seller_id,
      amount: cents, message: offerMessage || null, status: 'pending',
    });
    setSubmittingOffer(false);
    if (error) {
      Alert.alert('Error', 'Could not submit offer. Please try again.');
    } else {
      setShowOfferModal(false); setOfferAmount(''); setOfferMessage('');
      Alert.alert('Offer sent!', 'The seller will be notified.');
    }
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator color={BLUE} size="large" /></View>;
  }

  if (!item) return null;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Back + edit header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        {isOwner && !editing && (
          <TouchableOpacity onPress={startEdit} style={styles.editBtn}>
            <Pencil size={15} strokeWidth={2} color={BLUE} />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        )}
        {editing && (
          <TouchableOpacity onPress={cancelEdit} style={styles.editBtn}>
            <X size={15} strokeWidth={2} color="#979797" />
            <Text style={[styles.editBtnText, { color: '#979797' }]}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Images */}
        <View style={styles.imageWrapper}>
          {item.images?.length > 0 ? (
            <Image
              source={{ uri: item.images[selectedImage] }}
              style={styles.mainImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={{ fontSize: 48, color: '#dedede' }}>📦</Text>
            </View>
          )}
          {item.images?.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              style={styles.thumbRow} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
              {item.images.map((img, i) => (
                <TouchableOpacity key={i} onPress={() => setSelectedImage(i)}>
                  <Image
                    source={{ uri: img }}
                    style={[styles.thumb, selectedImage === i && styles.thumbActive]}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.body}>
          {/* Category + badges row */}
          <View style={styles.metaRow}>
            <Text style={styles.category}>{item.category}</Text>
            <View style={styles.badgeRow}>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Live</Text>
              </View>
              {item.condition ? (
                <View style={styles.conditionBadge}>
                  <Text style={styles.conditionText}>{CONDITION_LABELS[item.condition] ?? item.condition}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Title */}
          {editing ? (
            <TextInput
              style={styles.editInput}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Item title"
              placeholderTextColor="#979797"
            />
          ) : (
            <Text style={styles.title}>{item.title}</Text>
          )}

          {/* Price */}
          {editing ? (
            <View style={styles.priceInputRow}>
              <Text style={styles.pricePrefix}>R</Text>
              <TextInput
                style={[styles.editInput, { flex: 1, marginBottom: 0 }]}
                value={editPrice}
                onChangeText={setEditPrice}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor="#979797"
              />
            </View>
          ) : (
            <Text style={styles.price}>R{(item.price / 100).toLocaleString()}</Text>
          )}

          {/* Location + school — shown to buyers, school links to future filtering */}
          {!editing && (sellerProvince || schoolName) && (
            <View style={styles.metaInfoRow}>
              {sellerProvince && (
                <View style={styles.metaInfoItem}>
                  <MapPin size={13} strokeWidth={2} color={BLUE} />
                  <Text style={styles.locationText}>{sellerProvince}</Text>
                </View>
              )}
              {schoolName && (
                <View style={styles.metaInfoItem}>
                  <SchoolIcon size={13} strokeWidth={2} color={BLUE} />
                  <Text style={styles.locationText}>{schoolName}</Text>
                </View>
              )}
            </View>
          )}

          {/* Condition picker (edit mode) */}
          {editing && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Condition</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                {CONDITIONS.map(c => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setEditCondition(c)}
                    style={[styles.conditionChip, editCondition === c && styles.conditionChipActive]}
                  >
                    <Text style={[styles.conditionChipText, editCondition === c && styles.conditionChipTextActive]}>
                      {CONDITION_LABELS[c]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Description */}
          <View style={styles.divider} />
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Description</Text>
            {editing ? (
              <TextInput
                style={[styles.editInput, { height: 80, textAlignVertical: 'top' }]}
                value={editDesc1}
                onChangeText={setEditDesc1}
                placeholder="Describe the item..."
                placeholderTextColor="#979797"
                multiline
              />
            ) : item.description_part1 ? (
              <Text style={styles.sectionBody}>{item.description_part1}</Text>
            ) : (
              <Text style={styles.sectionEmpty}>No description provided.</Text>
            )}
          </View>

          {/* Details */}
          {(editing || item.description_part2) && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Details</Text>
              {editing ? (
                <TextInput
                  style={[styles.editInput, { height: 64, textAlignVertical: 'top' }]}
                  value={editDesc2}
                  onChangeText={setEditDesc2}
                  placeholder="Size, colour, additional info..."
                  placeholderTextColor="#979797"
                  multiline
                />
              ) : (
                <Text style={styles.sectionBody}>{item.description_part2}</Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      {editing ? (
        <View style={styles.cta}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={saveEdit}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <><Check size={16} strokeWidth={2.5} color="#fff" /><Text style={styles.saveBtnText}>Save Changes</Text></>
            }
          </TouchableOpacity>
        </View>
      ) : !isOwner && item.status !== 'delisted' ? (
        <View style={styles.cta}>
          {isAgeVerified ? (
            <TouchableOpacity style={styles.offerButton} onPress={() => setShowOfferModal(true)}>
              <Text style={styles.offerButtonText}>Make an Offer</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.ageWall}>
              <Text style={styles.ageWallText}>You must be 18+ to make offers.</Text>
            </View>
          )}
        </View>
      ) : null}

      {/* Offer modal */}
      <Modal visible={showOfferModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Make an Offer</Text>
            <Text style={styles.modalSubtitle}>Listed at R{(item.price / 100).toLocaleString()}</Text>
            <Text style={styles.label}>Your offer (R)</Text>
            <TextInput
              style={styles.input}
              value={offerAmount}
              onChangeText={setOfferAmount}
              placeholder="e.g. 150"
              placeholderTextColor="#979797"
              keyboardType="numeric"
            />
            <Text style={styles.label}>Message (optional)</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              value={offerMessage}
              onChangeText={setOfferMessage}
              placeholder="Say something to the seller..."
              placeholderTextColor="#979797"
              multiline
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowOfferModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.offerButton, { flex: 1 }, submittingOffer && { opacity: 0.5 }]}
                onPress={handleMakeOffer}
                disabled={submittingOffer}
              >
                {submittingOffer
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.offerButtonText}>Send Offer</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  backBtn: {},
  backText: { color: BLUE, fontSize: 15, fontWeight: '600' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: BLUE },
  editBtnText: { color: BLUE, fontSize: 13, fontWeight: '600' },

  imageWrapper: { backgroundColor: SURFACE },
  mainImage: { width: '100%', height: 240 },
  imagePlaceholder: { width: '100%', height: 240, alignItems: 'center', justifyContent: 'center' },
  thumbRow: { paddingVertical: 8, backgroundColor: '#fff' },
  thumb: { width: 56, height: 56, borderRadius: 8, borderWidth: 2, borderColor: 'transparent' },
  thumbActive: { borderColor: BLUE },

  body: { padding: 16 },

  metaRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 },
  category: { color: '#979797', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, flex: 1 },
  badgeRow: { flexDirection: 'row', gap: 6, flexShrink: 0 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f0fdf4', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#bbf7d0' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#16a34a' },
  liveText: { color: '#16a34a', fontSize: 11, fontWeight: '600' },
  conditionBadge: { backgroundColor: SURFACE, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: BORDER },
  conditionText: { color: '#555', fontSize: 11, fontWeight: '600' },

  title: { color: '#111', fontSize: 20, fontWeight: '700', marginBottom: 6, lineHeight: 26 },
  price: { color: BLUE, fontSize: 26, fontWeight: '800', marginBottom: 12 },

  divider: { height: 1, backgroundColor: BORDER, marginVertical: 12 },
  section: { marginBottom: 14 },
  sectionLabel: { color: '#979797', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  sectionBody: { color: '#111', fontSize: 14, lineHeight: 21 },
  sectionEmpty: { color: '#979797', fontSize: 13, fontStyle: 'italic' },

  // Edit mode
  editInput: {
    backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER,
    borderRadius: 12, padding: 12, color: '#111', fontSize: 15, marginBottom: 12,
  },
  priceInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  pricePrefix: { color: BLUE, fontSize: 20, fontWeight: '700' },
  conditionChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE },
  conditionChipActive: { borderColor: BLUE, backgroundColor: '#eef0fb' },
  conditionChipText: { color: '#979797', fontSize: 13, fontWeight: '600' },
  conditionChipTextActive: { color: BLUE },

  metaInfoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  metaInfoItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  locationText: { color: '#979797', fontSize: 13 },

  // CTA
  cta: { padding: 14, borderTopWidth: 1, borderTopColor: BORDER, backgroundColor: '#fff' },
  saveBtn: { backgroundColor: BLUE, borderRadius: 30, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  offerButton: { backgroundColor: BLUE, borderRadius: 30, padding: 15, alignItems: 'center' },
  offerButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  ageWall: { backgroundColor: SURFACE, borderRadius: 12, padding: 14, alignItems: 'center' },
  ageWallText: { color: '#979797', fontSize: 14 },

  // Offer modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 1, borderColor: BORDER },
  modalTitle: { color: '#111', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  modalSubtitle: { color: '#979797', fontSize: 13, marginBottom: 20 },
  label: { color: '#111', fontSize: 13, fontWeight: '500', marginBottom: 6 },
  input: { backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 12, color: '#111', fontSize: 15, marginBottom: 14 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelButton: { backgroundColor: SURFACE, borderRadius: 30, padding: 15, alignItems: 'center', paddingHorizontal: 24 },
  cancelButtonText: { color: '#979797', fontWeight: '600', fontSize: 15 },
});
