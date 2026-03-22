import { useEffect, useState } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, TextInput, Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/src/lib/supabase';

type Item = {
  id: string;
  title: string;
  category: string;
  price: number;
  description_part1: string | null;
  description_part2: string | null;
  images: string[];
  condition: string;
  seller_id: string;
  status: string;
};

const CONDITION_LABELS: Record<string, string> = {
  new: 'New', like_new: 'Like New', good: 'Good', fair: 'Fair', poor: 'Poor',
};

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [isOwner, setIsOwner] = useState(false);
  const [isAgeVerified, setIsAgeVerified] = useState(false);

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

  const handleMakeOffer = async () => {
    const cents = Math.round(parseFloat(offerAmount) * 100);
    if (!offerAmount || isNaN(cents) || cents <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid offer amount.');
      return;
    }
    setSubmittingOffer(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('offers').insert({
      item_id: id,
      buyer_id: user!.id,
      seller_id: item!.seller_id,
      amount: cents,
      message: offerMessage || null,
      status: 'pending',
    });
    setSubmittingOffer(false);
    if (error) {
      Alert.alert('Error', 'Could not submit offer. Please try again.');
    } else {
      setShowOfferModal(false);
      setOfferAmount('');
      setOfferMessage('');
      Alert.alert('Offer sent!', 'The seller will be notified.');
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#a855f7" size="large" />
      </View>
    );
  }

  if (!item) return null;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView>
        {/* Image carousel */}
        {item.images?.length > 0 ? (
          <>
            <Image source={{ uri: item.images[selectedImage] }} style={styles.mainImage} />
            {item.images.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow}>
                {item.images.map((img, i) => (
                  <TouchableOpacity key={i} onPress={() => setSelectedImage(i)}>
                    <Image
                      source={{ uri: img }}
                      style={[styles.thumb, selectedImage === i && styles.thumbActive]}
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </>
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={{ fontSize: 60 }}>📦</Text>
          </View>
        )}

        <View style={styles.body}>
          <Text style={styles.category}>{item.category}</Text>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.price}>R{(item.price / 100).toLocaleString()}</Text>

          <View style={styles.conditionBadge}>
            <Text style={styles.conditionText}>
              {CONDITION_LABELS[item.condition] ?? item.condition}
            </Text>
          </View>

          {item.description_part1 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Condition</Text>
              <Text style={styles.sectionBody}>{item.description_part1}</Text>
            </View>
          )}
          {item.description_part2 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Key Features</Text>
              <Text style={styles.sectionBody}>{item.description_part2}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* CTA */}
      {!isOwner && isAgeVerified && item.status === 'active' && (
        <View style={styles.cta}>
          <TouchableOpacity
            style={styles.offerButton}
            onPress={() => setShowOfferModal(true)}
          >
            <Text style={styles.offerButtonText}>Make an Offer</Text>
          </TouchableOpacity>
        </View>
      )}

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
              placeholderTextColor="#555"
              keyboardType="numeric"
            />

            <Text style={styles.label}>Message (optional)</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              value={offerMessage}
              onChangeText={setOfferMessage}
              placeholder="Say something to the seller..."
              placeholderTextColor="#555"
              multiline
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowOfferModal(false)}
              >
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
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  centered: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  mainImage: { width: '100%', height: 300, backgroundColor: '#111' },
  imagePlaceholder: { width: '100%', height: 300, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  thumbRow: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#0a0a0a' },
  thumb: { width: 60, height: 60, borderRadius: 8, marginRight: 8, borderWidth: 2, borderColor: 'transparent' },
  thumbActive: { borderColor: '#a855f7' },
  body: { padding: 20 },
  category: { color: '#a855f7', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 8 },
  price: { color: '#fff', fontSize: 28, fontWeight: '800', marginBottom: 12 },
  conditionBadge: { alignSelf: 'flex-start', backgroundColor: '#1a1a1a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: '#333', marginBottom: 20 },
  conditionText: { color: '#aaa', fontSize: 12, fontWeight: '600' },
  section: { marginBottom: 16 },
  sectionTitle: { color: '#888', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  sectionBody: { color: '#ccc', fontSize: 14, lineHeight: 22 },
  cta: { padding: 16, borderTopWidth: 1, borderTopColor: '#1a1a1a' },
  offerButton: { backgroundColor: '#7c3aed', borderRadius: 12, padding: 16, alignItems: 'center' },
  offerButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#111', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 1, borderColor: '#222' },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  modalSubtitle: { color: '#888', fontSize: 13, marginBottom: 20 },
  label: { color: '#aaa', fontSize: 13, marginBottom: 6 },
  input: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333', borderRadius: 10, padding: 12, color: '#fff', fontSize: 15, marginBottom: 14 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelButton: { backgroundColor: '#222', borderRadius: 12, padding: 16, alignItems: 'center', paddingHorizontal: 24 },
  cancelButtonText: { color: '#aaa', fontWeight: '600', fontSize: 15 },
});
