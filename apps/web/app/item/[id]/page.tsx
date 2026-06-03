'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useParams } from 'next/navigation';
import { Pencil, Trash2, X, Check, Heart, MapPin, ShoppingBag, School as SchoolIcon, Truck, Box, CheckCircle2, ShoppingCart } from 'lucide-react';
import { useCart } from '@/lib/cart';
import type { SelectedListingItem } from '@/lib/cart';
import { ALL_CATEGORIES, SUBCATEGORIES, LISTING_CONDITIONS, CLOTHING_SIZES, SHOE_SIZES, GRADES, SA_PROVINCES, SCHOOL_SPECIFIC_CATEGORIES, getLockerSizeForParcel, canFitInLocker } from '@nextkid/shared';
import type { ListingCategory, School, SellerShippingOption, ParcelDimensions } from '@nextkid/shared';
import LockerMapPicker from '../../components/LockerMapPicker';
import type { SelectedLocker } from '../../components/LockerMapPicker';

const LOCKER_SIZE_LABELS: Record<string, string> = {
  'V4-XS': 'Extra Small', 'V4-S': 'Small', 'V4-M': 'Medium', 'V4-L': 'Large', 'V4-XL': 'Extra Large',
};

type Item = {
  id: string;
  title: string;
  category: string;
  subcategory: string | null;
  price_cents: number;
  description: string | null;
  images: string[];
  created_at: string;
  seller_id: string;
  seller_school_id: string | null;
  is_school_specific: boolean;
  is_multi_item: boolean;
  available_count: number;
  size: string | null;
  gender: string | null;
  grade: number | null;
  condition: string | null;
  status: string;
  shipping_methods: string[];
  parcel_length_cm: number | null;
  parcel_width_cm: number | null;
  parcel_height_cm: number | null;
  parcel_weight_kg: number | null;
  pudo_locker_id: string | null;
  pudo_locker_name: string | null;
};

type Offer = {
  id: string;
  amount: number;
  message: string | null;
  status: string;
  created_at: string;
  buyer_id: string;
};

type Bid = {
  id: string;
  amount: number;
  created_at: string;
  buyer_id: string;
};

const DESCRIPTION_LABELS = ['Condition', 'Key Features', "Why I'm Selling", 'Specifications', 'Additional Info'];

export default function ItemPage() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { add, has } = useCart();

  const [item, setItem] = useState<Item | null>(null);
  const [listingItems, setListingItems] = useState<SelectedListingItem[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [isOwner, setIsOwner] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [wishlisted, setWishlisted] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [sellerProvince, setSellerProvince] = useState<string | null>(null);
  const [sellerSoldCount, setSellerSoldCount] = useState(0);
  const [viewSchoolName, setViewSchoolName] = useState<string | null>(null);
  const [showLightbox, setShowLightbox] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editImagePreviews, setEditImagePreviews] = useState<string[]>([]);
  const [editImageUrls, setEditImageUrls] = useState<string[]>([]);
  const [uploadingEdit, setUploadingEdit] = useState(false);

  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [submittingOffer, setSubmittingOffer] = useState(false);
  const [offerSuccess, setOfferSuccess] = useState(false);

  const [showBidModal, setShowBidModal] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [submittingBid, setSubmittingBid] = useState(false);
  const [bidSuccess, setBidSuccess] = useState(false);
  const [highestBid, setHighestBid] = useState<number | null>(null);
  const [userHasBid, setUserHasBid] = useState(false);

  const [offers, setOffers] = useState<Offer[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);

  const [editForm, setEditForm] = useState({
    title: '', category: '', subcategory: '', price: '',
    description: '',
    size: '', gender: '', grade: '', is_school_specific: false,
  });
  const [editSchoolId, setEditSchoolId] = useState<string | null>(null);
  const [editSchoolName, setEditSchoolName] = useState('');
  const [editProvince, setEditProvince] = useState('');
  const [editSchools, setEditSchools] = useState<School[]>([]);
  const [editSchoolSearch, setEditSchoolSearch] = useState('');
  const [loadingEditSchools, setLoadingEditSchools] = useState(false);
  const [showSchoolPicker, setShowSchoolPicker] = useState(false);

  // Shipping edit state — mirrors the sell wizard's step 4
  const [editParcel, setEditParcel] = useState({ l: '', w: '', h: '', weight: '' });
  const [editShippingMethods, setEditShippingMethods] = useState<SellerShippingOption[]>([]);
  const [editPudoLockerId, setEditPudoLockerId]       = useState('');
  const [editPudoLockerName, setEditPudoLockerName]   = useState('');
  const [editPudoLockerAddress, setEditPudoLockerAddress] = useState('');
  const [editSellerSuburb, setEditSellerSuburb] = useState('');
  const [editSellerCity, setEditSellerCity]     = useState('');

  const editParcelDims = useMemo<ParcelDimensions | null>(() => {
    const l = parseFloat(editParcel.l), w = parseFloat(editParcel.w);
    const h = parseFloat(editParcel.h), weight = parseFloat(editParcel.weight);
    if ([l, w, h, weight].some(isNaN) || [l, w, h, weight].some(v => v <= 0)) return null;
    return { lengthCm: l, widthCm: w, heightCm: h, weightKg: weight };
  }, [editParcel]);
  const editLockerSize    = editParcelDims ? getLockerSizeForParcel(editParcelDims) : null;
  const editFitsInLocker  = editParcelDims ? canFitInLocker(editParcelDims) : false;

  const toggleEditShipping = (method: SellerShippingOption) => {
    setEditShippingMethods(prev =>
      prev.includes(method) ? prev.filter(m => m !== method) : [...prev, method]
    );
    if (method === 'PUDO_DROPOFF' && editShippingMethods.includes('PUDO_DROPOFF')) {
      setEditPudoLockerId(''); setEditPudoLockerName(''); setEditPudoLockerAddress('');
    }
  };

  const handleEditImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    setUploadingEdit(true);
    const newPreviews: string[] = [];
    const newUrls: string[] = [];
    for (const file of files) {
      newPreviews.push(URL.createObjectURL(file));
      const fileName = `items/${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
      const { error } = await supabase.storage.from('item-images').upload(fileName, file);
      if (!error) {
        const { data: urlData } = supabase.storage.from('item-images').getPublicUrl(fileName);
        newUrls.push(urlData.publicUrl);
      }
    }
    setEditImagePreviews(prev => [...prev, ...newPreviews]);
    setEditImageUrls(prev => [...prev, ...newUrls]);
    setUploadingEdit(false);
  };

  const removeEditImage = (index: number) => {
    setEditImagePreviews(prev => prev.filter((_, i) => i !== index));
    setEditImageUrls(prev => prev.filter((_, i) => i !== index));
  };

  useEffect(() => { if (id) fetchItem(); }, [id]);

  useEffect(() => {
    if (!editProvince) { setEditSchools([]); return; }
    setLoadingEditSchools(true);
    supabase.from('schools').select('*').eq('province_code', editProvince).order('name')
      .then(({ data }) => { setEditSchools((data as School[]) ?? []); setLoadingEditSchools(false); });
  }, [editProvince]);

  async function fetchItem() {
    const { data, error } = await supabase.from('listings').select('*').eq('id', id).single();
    if (error) { console.error(error); setLoading(false); return; }
    setItem(data);

    // Load individual items for multi-item listings
    if (data.is_multi_item) {
      const { data: items } = await supabase
        .from('listing_items')
        .select('id, name, price_cents, size_label')
        .eq('listing_id', id)
        .eq('status', 'available')
        .order('price_cents', { ascending: true });
      setListingItems((items ?? []).map(i => ({
        id:          i.id,
        name:        i.name,
        price_cents: i.price_cents,
        size_label:  i.size_label,
      })));
    }
    setEditForm({
      title: data.title, category: data.category, subcategory: data.subcategory || '',
      price: String(data.price_cents / 100),
      description: data.description || '',
      size: data.size || '', gender: data.gender || '',
      grade: data.grade ? String(data.grade) : '',
      is_school_specific: data.is_school_specific || false,
    });
    setEditSchoolId(data.seller_school_id || null);
    if (data.seller_school_id) {
      supabase.from('schools').select('name').eq('id', data.seller_school_id).single()
        .then(({ data: s }) => { if (s) setEditSchoolName(s.name); });
    }
    // Pre-populate shipping edit state from the fetched listing
    setEditParcel({
      l:      data.parcel_length_cm != null ? String(data.parcel_length_cm) : '',
      w:      data.parcel_width_cm  != null ? String(data.parcel_width_cm)  : '',
      h:      data.parcel_height_cm != null ? String(data.parcel_height_cm) : '',
      weight: data.parcel_weight_kg != null ? String(data.parcel_weight_kg) : '',
    });
    setEditShippingMethods((data.shipping_methods ?? []) as SellerShippingOption[]);
    setEditPudoLockerId(data.pudo_locker_id ?? '');
    setEditPudoLockerName(data.pudo_locker_name ?? '');
    setEditPudoLockerAddress('');

    // Fetch seller stats (province + sold count) and school name for school-specific items
    const [{ data: sellerProfile }, { count: soldCount }, { data: schoolRow }] = await Promise.all([
      supabase.from('profiles').select('province, suburb_name, city_name').eq('id', data.seller_id).single(),
      supabase.from('listings').select('*', { count: 'exact', head: true }).eq('seller_id', data.seller_id).eq('status', 'COMPLETED'),
      data.seller_school_id
        ? supabase.from('schools').select('name').eq('id', data.seller_school_id).single()
        : Promise.resolve({ data: null }),
    ]);
    setSellerProvince(sellerProfile?.province ?? null);
    setSellerSoldCount(soldCount ?? 0);
    if (sellerProfile?.suburb_name) setEditSellerSuburb(sellerProfile.suburb_name);
    if (sellerProfile?.city_name)   setEditSellerCity(sellerProfile.city_name);
    setViewSchoolName(schoolRow?.name ?? null);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setIsLoggedIn(true);
      setCurrentUserId(user.id);
      const owner = user.id === data.seller_id;
      setIsOwner(owner);
      if (!owner) {
        // Check if already wishlisted
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const res = await fetch('/api/wishlist', {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (res.ok) {
            const json = await res.json();
            const ids = (json.items ?? []).map((i: { listing_id: string }) => i.listing_id);
            setWishlisted(ids.includes(data.id));
          }
        }
      }
    } else {
      fetchHighestBid(data.id);
    }
    setLoading(false);
  }

  async function fetchOffers(itemId: string) {
    const { data } = await supabase.from('offers').select('*').eq('item_id', itemId).order('created_at', { ascending: false });
    setOffers(data || []);
  }
  async function fetchBids(itemId: string) {
    const { data } = await supabase.from('bids').select('*').eq('item_id', itemId).order('amount', { ascending: false });
    setBids(data || []);
  }
  async function fetchHighestBid(itemId: string) {
    const { data } = await supabase.from('bids').select('amount').eq('item_id', itemId).order('amount', { ascending: false }).limit(1);
    if (data && data.length > 0) setHighestBid(data[0].amount);
  }
  async function checkUserBid(itemId: string, userId: string) {
    const { data } = await supabase.from('bids').select('id').eq('item_id', itemId).eq('buyer_id', userId).limit(1);
    setUserHasBid(!!(data && data.length > 0));
  }

  async function handleDelete() {
    setDeleting(true);
    const { error } = await supabase.from('listings').delete().eq('id', item!.id);
    if (error) { alert('Error deleting: ' + error.message); setDeleting(false); }
    else router.push('/dashboard');
  }

  async function handleSave() {
    setSaving(true);
    const oldPriceCents = item!.price_cents;
    const newPriceCents = parseInt(editForm.price) * 100 || 0;

    const { error } = await supabase.from('listings').update({
      title: editForm.title, category: editForm.category, subcategory: editForm.subcategory || null,
      price_cents: newPriceCents,
      description: editForm.description || null,
      size: editForm.size || null, gender: editForm.gender || null,
      grade: editForm.grade ? parseInt(editForm.grade) : null,
      is_school_specific: editForm.is_school_specific,
      seller_school_id: editForm.is_school_specific ? editSchoolId : null,
      images: editImageUrls,
      // Shipping fields
      shipping_methods:  editShippingMethods,
      parcel_length_cm:  editParcelDims?.lengthCm  ?? null,
      parcel_width_cm:   editParcelDims?.widthCm   ?? null,
      parcel_height_cm:  editParcelDims?.heightCm  ?? null,
      parcel_weight_kg:  editParcelDims?.weightKg  ?? null,
      pudo_locker_id:    editPudoLockerId   || null,
      pudo_locker_name:  editPudoLockerName || null,
    }).eq('id', item!.id);

    if (error) {
      alert('Error saving: ' + error.message);
    } else {
      // Notify anyone who wishlisted this item if the price dropped
      if (newPriceCents < oldPriceCents) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!session) return;
          fetch('/api/wishlist/price-drop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({
              listingId:     item!.id,
              itemTitle:     editForm.title,
              oldPriceCents,
              newPriceCents,
            }),
          }).catch(() => {});
        });
      }
      await fetchItem();
      setIsEditing(false);
    }
    setSaving(false);
  }

  async function handleSubmitOffer() {
    if (!offerAmount || !currentUserId) return;
    setSubmittingOffer(true);
    const amount = parseInt(offerAmount) * 100;
    const { error } = await supabase.from('offers').insert({
      item_id: item!.id, buyer_id: currentUserId,
      amount, message: offerMessage || null, status: 'pending',
    });
    if (!error) {
      await supabase.from('notifications').insert({
        user_id: item!.seller_id, type: 'offer',
        message: `New offer of R${offerAmount} on "${item!.title}"`, item_id: item!.id,
      });
      setOfferSuccess(true);
    } else { alert('Error submitting offer: ' + error.message); }
    setSubmittingOffer(false);
  }

  async function handleSubmitBid() {
    if (!bidAmount || !currentUserId) return;
    setSubmittingBid(true);
    const amount = parseInt(bidAmount) * 100;
    if (highestBid && amount <= highestBid) { alert(`Your bid must be higher than R${highestBid / 100}`); setSubmittingBid(false); return; }
    if (amount <= item!.price_cents) { alert(`Your bid must be higher than the starting price of R${item!.price_cents / 100}`); setSubmittingBid(false); return; }
    const { error } = await supabase.from('bids').insert({ item_id: item!.id, buyer_id: currentUserId, amount });
    if (!error) {
      await supabase.from('notifications').insert({
        user_id: item!.seller_id, type: 'bid',
        message: `New bid of R${bidAmount} on "${item!.title}"`, item_id: item!.id,
      });
      setHighestBid(amount); setUserHasBid(true); setBidSuccess(true);
    } else { alert('Error submitting bid: ' + error.message); }
    setSubmittingBid(false);
  }

  async function handleOfferAction(offerId: string, status: 'accepted' | 'declined', buyerId: string) {
    await supabase.from('offers').update({ status }).eq('id', offerId);
    await supabase.from('notifications').insert({
      user_id: buyerId,
      type: status === 'accepted' ? 'offer_accepted' : 'offer_declined',
      message: status === 'accepted' ? `Your offer on "${item!.title}" was accepted! 🎉` : `Your offer on "${item!.title}" was declined.`,
      item_id: item!.id,
    });
    fetchOffers(item!.id);
  }

  function handleBuyNow() {
    if (!currentUserId || !item) return;
    router.push(`/checkout/${item.id}`);
  }

  function toggleItemSelect(itemId: string) {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return next;
    });
  }

  function handleAddSelectedToCart() {
    if (!item || selectedItemIds.size === 0) return;
    const selected = listingItems.filter(i => selectedItemIds.has(i.id));
    const total    = selected.reduce((s, i) => s + i.price_cents, 0);
    add({
      listingId:     item.id,
      title:         item.title,
      price_cents:   total,
      image:         item.images?.[0] ?? null,
      sellerId:      item.seller_id,
      category:      item.category,
      selectedItems: selected,
    });
  }

  async function toggleWishlist() {
    if (!currentUserId || !item) return;
    setWishlistLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setWishlistLoading(false); return; }
    const token = session.access_token;
    if (wishlisted) {
      await fetch(`/api/wishlist/${item.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setWishlisted(false);
    } else {
      await fetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ listingId: item.id }),
      });
      setWishlisted(true);
    }
    setWishlistLoading(false);
  }

  const auctionEnded = false;
  const timeLeft = null;

  function getTimeLeft(endDate: string) {
    const diff = new Date(endDate).getTime() - Date.now();
    if (diff <= 0) return 'Auction ended';
    const d = Math.floor(diff / 86400000), h = Math.floor((diff % 86400000) / 3600000), m = Math.floor((diff % 3600000) / 60000);
    if (d > 0) return `${d}d ${h}h left`;
    if (h > 0) return `${h}h ${m}m left`;
    return `${m}m left`;
  }

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <p className="text-[#979797]">Loading listing...</p>
    </div>
  );

  if (!item) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4">📦</div>
        <h2 className="text-2xl font-bold text-[#111] mb-2">Item not found</h2>
        <p className="text-[#979797] mb-6">This listing may have been removed.</p>
        <button onClick={() => router.push('/browse')} className="bg-[#BE1E2D] hover:bg-[#9B1824] text-white px-8 py-3 rounded-full font-medium transition">Back to Browse</button>
      </div>
    </div>
  );

  const descriptionParts = [item.description];

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => router.push('/browse')} className="text-[#979797] hover:text-[#BE1E2D] flex items-center gap-1 text-sm transition">
            ← Back to Browse
          </button>
          <div className="flex items-center gap-3">
            {isOwner && !isEditing && (
              <>
                <button onClick={() => { setIsEditing(true); setEditImagePreviews(item.images || []); setEditImageUrls(item.images || []); }}
                  className="flex items-center gap-2 px-4 py-2 border border-[#dedede] hover:border-[#BE1E2D] text-[#111] rounded-full transition text-sm">
                  <Pencil size={14} /> Edit
                </button>
                <button onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 border border-[#dedede] hover:border-red-400 text-red-400 rounded-full transition text-sm">
                  <Trash2 size={14} /> Delete
                </button>
              </>
            )}
            {isOwner && isEditing && (
              <>
                <button onClick={() => setIsEditing(false)}
                  className="flex items-center gap-2 px-4 py-2 border border-[#dedede] text-[#979797] rounded-full text-sm">
                  <X size={14} /> Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-[#BE1E2D] hover:bg-[#9B1824] disabled:bg-[#dedede] text-white rounded-full text-sm transition">
                  <Check size={14} /> {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Delete modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-3xl p-10 max-w-md w-full mx-6 text-center shadow-xl">
              <div className="text-5xl mb-4">🗑️</div>
              <h2 className="text-2xl font-bold text-[#111] mb-2">Delete Listing?</h2>
              <p className="text-[#979797] mb-8">This action cannot be undone.</p>
              <div className="flex gap-4 justify-center">
                <button onClick={() => setShowDeleteConfirm(false)} className="px-8 py-3 border border-[#dedede] text-[#111] rounded-full">Cancel</button>
                <button onClick={handleDelete} disabled={deleting} className="px-8 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full transition">
                  {deleting ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Offer modal */}
        {showOfferModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-3xl p-8 max-w-md w-full mx-6 shadow-xl">
              {offerSuccess ? (
                <div className="text-center">
                  <div className="text-5xl mb-4">🤝</div>
                  <h2 className="text-2xl font-bold text-[#111] mb-2">Offer Sent!</h2>
                  <p className="text-[#979797] mb-6">The seller will review your offer and get back to you.</p>
                  <button onClick={() => { setShowOfferModal(false); setOfferSuccess(false); setOfferAmount(''); setOfferMessage(''); }}
                    className="bg-[#BE1E2D] hover:bg-[#9B1824] text-white px-8 py-3 rounded-full transition">Done</button>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-[#111]">Make an Offer</h2>
                    <button onClick={() => setShowOfferModal(false)} className="text-[#979797] hover:text-[#111]"><X size={20} /></button>
                  </div>
                  <p className="text-[#979797] text-sm mb-6">Asking price: <span className="text-[#111] font-semibold">R{(item.price_cents / 100).toLocaleString()}</span></p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[#111] mb-1.5">Your Offer (Rands)</label>
                      <input type="number" value={offerAmount} onChange={(e) => setOfferAmount(e.target.value)}
                        className="w-full bg-[#f4f4f4] border border-[#dedede] rounded-xl px-4 py-3 text-[#111] focus:outline-none focus:border-[#BE1E2D]" placeholder="e.g. 500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#111] mb-1.5">Message (optional)</label>
                      <textarea value={offerMessage} onChange={(e) => setOfferMessage(e.target.value)}
                        className="w-full h-24 bg-[#f4f4f4] border border-[#dedede] rounded-xl px-4 py-3 text-[#111] resize-none focus:outline-none focus:border-[#BE1E2D]"
                        placeholder="Why should the seller accept your offer?" />
                    </div>
                    <button onClick={handleSubmitOffer} disabled={submittingOffer || !offerAmount}
                      className="w-full py-3 bg-[#BE1E2D] hover:bg-[#9B1824] disabled:bg-[#dedede] text-white font-medium rounded-full transition">
                      {submittingOffer ? 'Sending...' : 'Send Offer'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Bid modal */}
        {showBidModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-3xl p-8 max-w-md w-full mx-6 shadow-xl">
              {bidSuccess ? (
                <div className="text-center">
                  <div className="text-5xl mb-4">🏆</div>
                  <h2 className="text-2xl font-bold text-[#111] mb-2">Bid Placed!</h2>
                  <p className="text-[#979797] mb-6">You&apos;re in the running. Check back to see if you win.</p>
                  <button onClick={() => { setShowBidModal(false); setBidSuccess(false); setBidAmount(''); }}
                    className="bg-[#BE1E2D] hover:bg-[#9B1824] text-white px-8 py-3 rounded-full transition">Done</button>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-[#111]">Place a Bid</h2>
                    <button onClick={() => setShowBidModal(false)} className="text-[#979797] hover:text-[#111]"><X size={20} /></button>
                  </div>
                  <div className="bg-[#f4f4f4] rounded-2xl p-4 mb-6 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#979797]">Starting price</span>
                      <span className="text-[#111] font-medium">R{(item.price_cents / 100).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#979797]">Highest bid</span>
                      <span className="text-[#BE1E2D] font-semibold">{highestBid ? `R${(highestBid / 100).toLocaleString()}` : 'No bids yet'}</span>
                    </div>
                    {timeLeft && (
                      <div className="flex justify-between text-sm">
                        <span className="text-[#979797]">Time left</span>
                        <span className={auctionEnded ? 'text-red-500' : 'text-green-600'}>{timeLeft}</span>
                      </div>
                    )}
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-[#111] mb-1.5">Your Bid (Rands)</label>
                    <input type="number" value={bidAmount} onChange={(e) => setBidAmount(e.target.value)}
                      className="w-full bg-[#f4f4f4] border border-[#dedede] rounded-xl px-4 py-3 text-[#111] focus:outline-none focus:border-[#BE1E2D]"
                      placeholder={`Min: R${highestBid ? (highestBid / 100) + 1 : (item.price_cents / 100) + 1}`} />
                  </div>
                  <button onClick={handleSubmitBid} disabled={submittingBid || !bidAmount || auctionEnded}
                    className="w-full py-3 bg-[#BE1E2D] hover:bg-[#9B1824] disabled:bg-[#dedede] text-white font-medium rounded-full transition">
                    {auctionEnded ? 'Auction Ended' : submittingBid ? 'Placing Bid...' : 'Place Bid'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">

          {/* Images — sticky on desktop */}
          <div className="lg:sticky lg:top-6">
            <div
              className={`bg-[#f4f4f4] rounded-3xl overflow-hidden aspect-square relative group ${!isEditing && item.images?.length > 0 ? 'cursor-zoom-in' : ''}`}
              onClick={() => { if (!isEditing && item.images?.length > 0) setShowLightbox(true); }}
            >
              {(isEditing ? editImagePreviews : item.images)?.length > 0 ? (
                <img
                  src={(isEditing ? editImagePreviews : item.images)[selectedImage]}
                  alt={item.title}
                  className="w-full h-full object-contain transition-opacity duration-200"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-8xl">📦</div>
              )}
              {!isEditing && item.images?.length > 0 && (
                <div className="absolute bottom-3 right-3 bg-black/40 text-white text-xs px-2.5 py-1 rounded-full opacity-0 group-hover:opacity-100 transition pointer-events-none">
                  Click to zoom
                </div>
              )}
              {isOwner && isEditing && (
                <>
                  <input type="file" accept="image/*" multiple onChange={handleEditImageChange} className="hidden" id="edit-upload" />
                  <label htmlFor="edit-upload"
                    className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition cursor-pointer rounded-3xl">
                    <div className="text-center">
                      <div className="text-4xl mb-2">📷</div>
                      <div className="text-white text-sm font-medium">{uploadingEdit ? 'Uploading...' : 'Change Photos'}</div>
                    </div>
                  </label>
                </>
              )}
            </div>
            {(isEditing ? editImagePreviews : item.images)?.length > 1 && (
              <div className="flex gap-3 mt-4 flex-wrap">
                {(isEditing ? editImagePreviews : item.images).map((src, i) => (
                  <div key={i} className="relative group/thumb">
                    <button
                      onClick={() => setSelectedImage(i)}
                      className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition ${selectedImage === i ? 'border-[#BE1E2D]' : 'border-[#dedede] hover:border-[#BE1E2D]/50'}`}
                    >
                      <img src={src} alt="" className="w-full h-full object-contain bg-[#f4f4f4]" />
                    </button>
                    {isEditing && (
                      <button onClick={() => removeEditImage(i)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover/thumb:opacity-100 transition">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lightbox */}
          {showLightbox && (
            <div
              className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
              onClick={() => setShowLightbox(false)}
            >
              <button
                className="absolute top-4 right-4 text-white/70 hover:text-white transition"
                onClick={() => setShowLightbox(false)}
              >
                <X size={28} />
              </button>
              <img
                src={item.images[selectedImage]}
                alt={item.title}
                className="max-w-full max-h-full object-contain rounded-xl"
                onClick={e => e.stopPropagation()}
              />
              {item.images.length > 1 && (
                <div className="absolute bottom-6 flex gap-3">
                  {item.images.map((src, i) => (
                    <button
                      key={i}
                      onClick={e => { e.stopPropagation(); setSelectedImage(i); }}
                      className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition ${selectedImage === i ? 'border-white' : 'border-white/30'}`}
                    >
                      <img src={src} alt="" className="w-full h-full object-contain bg-black" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Right panel */}
          <div className="flex flex-col gap-5">
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#111] mb-1.5">Title</label>
                  <input type="text" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full bg-[#f4f4f4] border border-[#dedede] rounded-xl px-4 py-3 text-[#111] focus:outline-none focus:border-[#BE1E2D]" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-[#111] mb-1.5">Category</label>
                    <select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value, subcategory: '' })}
                      className="w-full bg-[#f4f4f4] border border-[#dedede] rounded-xl px-4 py-3 text-[#111] focus:outline-none">
                      {ALL_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#111] mb-1.5">Subcategory</label>
                    <select value={editForm.subcategory} onChange={(e) => setEditForm({ ...editForm, subcategory: e.target.value })}
                      className="w-full bg-[#f4f4f4] border border-[#dedede] rounded-xl px-4 py-3 text-[#111] focus:outline-none">
                      <option value="">Select...</option>
                      {editForm.category && SUBCATEGORIES[editForm.category as ListingCategory]?.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-[#111] mb-1.5">Size</label>
                    <select value={editForm.size} onChange={(e) => setEditForm({ ...editForm, size: e.target.value })}
                      className="w-full bg-[#f4f4f4] border border-[#dedede] rounded-xl px-4 py-3 text-[#111] focus:outline-none">
                      <option value="">N/A</option>
                      <optgroup label="Clothing">{CLOTHING_SIZES.map(s => <option key={s}>{s}</option>)}</optgroup>
                      <optgroup label="Shoes">{SHOE_SIZES.map(s => <option key={`shoe-${s}`} value={`Shoe ${s}`}>Shoe {s}</option>)}</optgroup>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#111] mb-1.5">Gender</label>
                    <select value={editForm.gender} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                      className="w-full bg-[#f4f4f4] border border-[#dedede] rounded-xl px-4 py-3 text-[#111] focus:outline-none">
                      <option value="">N/A</option>
                      <option value="boys">Boys</option>
                      <option value="girls">Girls</option>
                      <option value="unisex">Unisex</option>
                    </select>
                  </div>
                </div>
                {editForm.category === 'Books & Stationery' && (
                  <div>
                    <label className="block text-sm font-medium text-[#111] mb-1.5">Grade</label>
                    <select value={editForm.grade} onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })}
                      className="w-full bg-[#f4f4f4] border border-[#dedede] rounded-xl px-4 py-3 text-[#111] focus:outline-none">
                      <option value="">Select grade...</option>
                      {GRADES.map(g => <option key={g} value={g}>Grade {g}</option>)}
                    </select>
                  </div>
                )}
                {SCHOOL_SPECIFIC_CATEGORIES.includes(editForm.category as typeof SCHOOL_SPECIFIC_CATEGORIES[number]) && (
                  <div>
                    <label className="flex items-center gap-3 cursor-pointer mb-3">
                      <input type="checkbox" checked={editForm.is_school_specific}
                        onChange={e => setEditForm({ ...editForm, is_school_specific: e.target.checked })}
                        className="w-4 h-4 accent-[#BE1E2D]" />
                      <span className="text-sm text-[#111]">Link to a specific school</span>
                    </label>
                    {editForm.is_school_specific && (
                      <div className="bg-[#f4f4f4] border border-[#dedede] rounded-xl p-4 space-y-3">
                        {editSchoolId && !showSchoolPicker && (
                          <div className="flex items-center justify-between">
                            <span className="text-[#BE1E2D] text-sm">🏫 {editSchoolName || 'School linked'}</span>
                            <button onClick={() => setShowSchoolPicker(true)} className="text-xs text-[#979797] hover:text-[#111]">Change</button>
                          </div>
                        )}
                        {(!editSchoolId || showSchoolPicker) && <>
                          <select className="w-full bg-white border border-[#dedede] rounded-xl px-4 py-2.5 text-[#111] text-sm focus:outline-none"
                            value={editProvince} onChange={e => { setEditProvince(e.target.value); setEditSchoolSearch(''); }}>
                            <option value="">Select province...</option>
                            {SA_PROVINCES.map(p => <option key={p}>{p}</option>)}
                          </select>
                          {editProvince && <>
                            <input className="w-full bg-white border border-[#dedede] rounded-xl px-4 py-2.5 text-[#111] text-sm focus:outline-none"
                              value={editSchoolSearch} onChange={e => setEditSchoolSearch(e.target.value)} placeholder="Search school..." />
                            <div className="max-h-40 overflow-y-auto border border-[#dedede] rounded-xl bg-white">
                              {loadingEditSchools
                                ? <p className="text-[#979797] text-center py-3 text-sm">Loading...</p>
                                : editSchools.filter(s => s.name.toLowerCase().includes(editSchoolSearch.toLowerCase())).map(school => (
                                  <div key={school.id} onClick={() => { setEditSchoolId(school.id); setEditSchoolName(school.name); setShowSchoolPicker(false); }}
                                    className="px-4 py-2.5 cursor-pointer hover:bg-[#f4f4f4] border-b border-[#dedede] text-sm text-[#111]">
                                    {school.name} <span className="text-[#979797] text-xs">· {school.city}</span>
                                  </div>
                                ))
                              }
                            </div>
                          </>}
                        </>}
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-[#111] mb-1.5">Price (Rands)</label>
                  <input type="number" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                    className="w-full bg-[#f4f4f4] border border-[#dedede] rounded-xl px-4 py-3 text-[#111] focus:outline-none focus:border-[#BE1E2D]" />
                </div>
              </div>
            ) : (
              <>
                {/* Category + listing type */}
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-semibold uppercase tracking-widest text-[#979797]">{item.category}</span>
                  <span className="text-xs px-3 py-1 rounded-full font-medium bg-blue-50 text-blue-600">⚡ Buy Now</span>
                </div>

                <h1 className="text-3xl font-bold text-[#111] mb-4">{item.title}</h1>

                {/* Seller info bar — location + school + sales count, no personal details */}
                <div className="flex flex-wrap items-center gap-4 text-sm text-[#979797]">
                  {sellerProvince && (
                    <span className="flex items-center gap-1.5">
                      <MapPin size={13} strokeWidth={2} className="text-[#BE1E2D]" />
                      {sellerProvince}
                    </span>
                  )}
                  {viewSchoolName && (
                    <span className="flex items-center gap-1.5">
                      <SchoolIcon size={13} strokeWidth={2} className="text-[#BE1E2D]" />
                      {viewSchoolName}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <ShoppingBag size={13} strokeWidth={2} className="text-[#BE1E2D]" />
                    {sellerSoldCount === 0 ? 'New seller' : `${sellerSoldCount} sold`}
                  </span>
                </div>

                {/* Multi-item banner — shown prominently before price */}
                {item.is_multi_item && item.available_count > 0 && (
                  <div className="flex items-center gap-2 bg-[#fde8ea] border border-[#BE1E2D]/30 rounded-xl px-4 py-3 mb-4">
                    <Box size={16} strokeWidth={2} className="text-[#BE1E2D] shrink-0" />
                    <p className="text-sm font-semibold text-[#BE1E2D]">
                      Bundle listing — {item.available_count} item{item.available_count !== 1 ? 's' : ''} available
                    </p>
                    <span className="ml-auto text-xs text-[#BE1E2D] font-medium bg-white border border-[#BE1E2D]/30 rounded-full px-2 py-0.5">Pick what you need</span>
                  </div>
                )}

                <div className="text-4xl font-bold text-[#BE1E2D] mb-6">
                  {item.is_multi_item ? `from R${(item.price_cents / 100).toLocaleString()}` : `R${(item.price_cents / 100).toLocaleString()}`}
                </div>

                {/* Buyer actions — shown to all non-owners */}
                {!isOwner && (
                  <div className="flex flex-col gap-3">
                    {!isLoggedIn && (
                      <div className="bg-[#f4f4f4] border border-[#dedede] rounded-2xl p-5 text-center">
                        <p className="text-[#111] font-medium mb-2">Sign in to buy or make offers</p>
                        <button onClick={() => router.push('/')} className="px-6 py-2 bg-[#BE1E2D] hover:bg-[#9B1824] text-white rounded-full text-sm font-medium transition">Sign In</button>
                      </div>
                    )}

                    {/* Multi-item selector — shown FIRST so buyer sees it immediately */}
                    {isLoggedIn && item.is_multi_item && listingItems.length > 0 && (
                      <div className="bg-[#fff9f9] border-2 border-[#BE1E2D]/30 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={16} strokeWidth={2} className="text-[#BE1E2D]" />
                          <p className="text-sm font-bold text-[#111]">
                            Choose the items you want
                          </p>
                          <span className="ml-auto text-xs text-[#979797]">{item.available_count} available</span>
                        </div>
                        <div className="border border-[#dedede] rounded-xl overflow-hidden divide-y divide-[#dedede] bg-white">
                          {listingItems.map(li => {
                            const checked = selectedItemIds.has(li.id);
                            return (
                              <button key={li.id} type="button"
                                onClick={() => toggleItemSelect(li.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition ${checked ? 'bg-[#fde8ea]' : 'hover:bg-[#f4f4f4]'}`}
                              >
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition ${checked ? 'bg-[#BE1E2D] border-[#BE1E2D]' : 'border-[#dedede]'}`}>
                                  {checked && <Check size={12} strokeWidth={3} className="text-white" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-medium text-[#111]">{li.name}</span>
                                  {li.size_label && <span className="text-xs text-[#979797] ml-2">Size {li.size_label}</span>}
                                </div>
                                <span className="text-sm font-bold text-[#BE1E2D] shrink-0">R{(li.price_cents / 100).toFixed(2)}</span>
                              </button>
                            );
                          })}
                        </div>
                        {selectedItemIds.size > 0 && (
                          <div className="flex items-center justify-between px-1 py-1">
                            <span className="text-sm text-[#979797]">{selectedItemIds.size} item{selectedItemIds.size !== 1 ? 's' : ''} selected</span>
                            <span className="text-base font-bold text-[#BE1E2D]">
                              Total R{(listingItems.filter(i => selectedItemIds.has(i.id)).reduce((s, i) => s + i.price_cents, 0) / 100).toFixed(2)}
                            </span>
                          </div>
                        )}
                        {has(item.id) ? (
                          <button onClick={() => router.push('/cart')}
                            className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-full transition flex items-center justify-center gap-2">
                            <Check size={16} strokeWidth={2.5} /> Added — View Cart
                          </button>
                        ) : (
                          <button onClick={handleAddSelectedToCart} disabled={selectedItemIds.size === 0}
                            className="w-full py-4 bg-[#BE1E2D] hover:bg-[#9B1824] disabled:bg-[#dedede] disabled:text-[#979797] disabled:cursor-not-allowed text-white font-semibold rounded-full transition flex items-center justify-center gap-2">
                            <ShoppingCart size={16} strokeWidth={2} />
                            {selectedItemIds.size === 0 ? '← Tick the items you want above' : `Add ${selectedItemIds.size} item${selectedItemIds.size !== 1 ? 's' : ''} to cart`}
                          </button>
                        )}
                      </div>
                    )}

                    {isLoggedIn && item.is_multi_item && listingItems.length === 0 && (
                      <div className="w-full py-4 text-center text-[#979797] text-sm bg-[#f4f4f4] rounded-full">All items sold</div>
                    )}

                    {isLoggedIn && !item.is_multi_item && (
                      <button onClick={handleBuyNow}
                        className="w-full py-4 bg-[#BE1E2D] hover:bg-[#9B1824] text-white font-semibold rounded-full transition">
                        ⚡ Buy Now — R{(item.price_cents / 100).toLocaleString()}
                      </button>
                    )}

                    {isLoggedIn && (
                      <button
                        onClick={toggleWishlist}
                        disabled={wishlistLoading}
                        className={`flex items-center justify-center gap-2 w-full py-3 rounded-full border-2 text-sm font-medium transition ${
                          wishlisted
                            ? 'border-[#BE1E2D] bg-[#fde8ea] text-[#BE1E2D]'
                            : 'border-[#dedede] text-[#979797] hover:border-[#BE1E2D] hover:text-[#BE1E2D]'
                        }`}
                      >
                        <Heart size={16} strokeWidth={2} fill={wishlisted ? '#BE1E2D' : 'none'} />
                        {wishlisted ? 'Saved to Wishlist' : 'Save to Wishlist'}
                      </button>
                    )}
                  </div>
                )}

                {/* Owner status — compact pill + offer/bid count if applicable */}
                {isOwner && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f0fdf4] border border-[#bbf7d0] text-green-700 text-xs font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                      Live
                    </span>
                  </div>
                )}

                {/* Item tags */}
                {(item.size || item.gender || item.grade || item.subcategory || item.condition) && (
                  <>
                    <hr className="border-[#dedede]" />
                    <div className="flex flex-wrap gap-2">
                      {item.size && (
                        <span className="px-3 py-1 rounded-full border border-[#dedede] text-[#111] text-xs font-medium">Size: {item.size}</span>
                      )}
                      {item.condition && (
                        <span className="px-3 py-1 rounded-full border border-[#dedede] text-[#111] text-xs font-medium capitalize">
                          {item.condition.replace(/_/g, ' ')}
                        </span>
                      )}
                      {item.gender && (
                        <span className="px-3 py-1 rounded-full border border-[#dedede] text-[#111] text-xs font-medium capitalize">{item.gender}</span>
                      )}
                      {item.grade && (
                        <span className="px-3 py-1 rounded-full border border-[#dedede] text-[#111] text-xs font-medium">Grade {item.grade}</span>
                      )}
                      {item.subcategory && (
                        <span className="px-3 py-1 rounded-full border border-[#dedede] text-[#979797] text-xs font-medium">{item.subcategory}</span>
                      )}
                      <span className="px-3 py-1 rounded-full border border-[#dedede] text-[#979797] text-xs font-medium">{item.category}</span>
                    </div>
                  </>
                )}

                {/* Description sections — inline in right panel */}
                {descriptionParts.some(Boolean) && (
                  <>
                    <hr className="border-[#dedede]" />
                    <div className="space-y-4">
                      {descriptionParts.map((part, i) =>
                        part ? (
                          <div key={i}>
                            <h3 className="text-xs uppercase tracking-widest text-[#979797] font-semibold mb-1.5">{DESCRIPTION_LABELS[i]}</h3>
                            <p className="text-[#111] text-sm leading-relaxed">{part}</p>
                          </div>
                        ) : null
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Shipping fields — only shown in edit mode */}
        {isEditing && (
          <div className="mt-8 border border-[#dedede] rounded-2xl p-6 space-y-6">
            <h3 className="text-[#111] font-semibold text-base">Parcel &amp; Shipping</h3>

            {/* Parcel dimensions */}
            <div>
              <p className="text-sm font-medium text-[#111] mb-3">Parcel dimensions</p>
              <div className="grid grid-cols-2 gap-4">
                {([
                  { key: 'l', label: 'Length (cm)', placeholder: '30' },
                  { key: 'w', label: 'Width (cm)',  placeholder: '20' },
                  { key: 'h', label: 'Height (cm)', placeholder: '10' },
                  { key: 'weight', label: 'Weight (kg)', placeholder: '0.5' },
                ] as const).map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-[#979797] uppercase tracking-wide mb-1.5">{label}</label>
                    <input
                      type="number" min="0" step={key === 'weight' ? '0.1' : '1'}
                      value={editParcel[key]}
                      onChange={e => setEditParcel(p => ({ ...p, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full bg-[#f4f4f4] border border-[#dedede] rounded-xl px-4 py-2.5 text-[#111] text-sm focus:outline-none focus:border-[#BE1E2D] transition"
                    />
                  </div>
                ))}
              </div>

              {/* Locker size indicator */}
              {editParcelDims && (
                <div className={`mt-3 rounded-xl p-3 text-sm flex items-center gap-2 ${
                  editFitsInLocker
                    ? 'bg-[#f0fdf4] border border-[#bbf7d0] text-[#166534]'
                    : 'bg-[#fffbeb] border border-[#fde68a] text-[#92400e]'
                }`}>
                  {editFitsInLocker
                    ? <>📦 Fits a <strong>{LOCKER_SIZE_LABELS[editLockerSize!]} ({editLockerSize})</strong> PUDO locker</>
                    : <>⚠ Too large for any PUDO locker — Door-to-Door only</>
                  }
                </div>
              )}
            </div>

            {/* Shipping methods */}
            <div>
              <p className="text-sm font-medium text-[#111] mb-1">Shipping methods <span className="text-[#979797] font-normal">(select at least one)</span></p>
              {!editParcelDims && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                  Fill in the parcel dimensions above first — PUDO Locker availability depends on the size.
                </p>
              )}
              {editParcelDims && !editFitsInLocker && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                  This parcel is too large for any PUDO locker — only Door-to-Door is available. Adjust the dimensions if they look wrong.
                </p>
              )}
              {editParcelDims && editFitsInLocker && !editShippingMethods.length && (
                <p className="text-xs text-[#979797] mb-3">Select at least one method below.</p>
              )}
              <div className="space-y-3">
                <button type="button" onClick={() => toggleEditShipping('PICKUP')}
                  className={`w-full p-4 rounded-xl border-2 text-left flex items-start gap-4 transition ${
                    editShippingMethods.includes('PICKUP')
                      ? 'border-[#BE1E2D] bg-[#fde8ea]'
                      : 'border-[#dedede] bg-white hover:border-[#BE1E2D]/40'
                  }`}>
                  <Truck size={20} className={`mt-0.5 shrink-0 ${editShippingMethods.includes('PICKUP') ? 'text-[#BE1E2D]' : 'text-[#979797]'}`} />
                  <div className="flex-1">
                    <p className="text-[#111] font-medium text-sm">Door-to-Door pickup</p>
                    <p className="text-[#979797] text-xs mt-0.5">A courier collects directly from your address</p>
                  </div>
                  {editShippingMethods.includes('PICKUP') && <CheckCircle2 size={18} className="text-[#BE1E2D] shrink-0 mt-0.5" />}
                </button>

                <button type="button"
                  onClick={() => editFitsInLocker && toggleEditShipping('PUDO_DROPOFF')}
                  disabled={!!editParcelDims && !editFitsInLocker}
                  className={`w-full p-4 rounded-xl border-2 text-left flex items-start gap-4 transition ${
                    editShippingMethods.includes('PUDO_DROPOFF')
                      ? 'border-[#BE1E2D] bg-[#fde8ea]'
                      : editParcelDims && !editFitsInLocker
                        ? 'border-[#dedede] bg-[#fafafa] opacity-50 cursor-not-allowed'
                        : 'border-[#dedede] bg-white hover:border-[#BE1E2D]/40'
                  }`}>
                  <Box size={20} className={`mt-0.5 shrink-0 ${editShippingMethods.includes('PUDO_DROPOFF') ? 'text-[#BE1E2D]' : 'text-[#979797]'}`} />
                  <div className="flex-1">
                    <p className="text-[#111] font-medium text-sm">PUDO Locker drop-off</p>
                    <p className="text-[#979797] text-xs mt-0.5">
                      {editParcelDims && !editFitsInLocker
                        ? 'Not available — parcel is too large for any locker'
                        : editLockerSize
                          ? `Drop at your nearest TCG locker · Needs ${LOCKER_SIZE_LABELS[editLockerSize]} (${editLockerSize}) slot`
                          : 'Drop at your nearest The Courier Guy locker'
                      }
                    </p>
                  </div>
                  {editShippingMethods.includes('PUDO_DROPOFF') && <CheckCircle2 size={18} className="text-[#BE1E2D] shrink-0 mt-0.5" />}
                </button>

                {/* RULE: seller must choose their drop-off locker when PUDO_DROPOFF is selected */}
                {editShippingMethods.includes('PUDO_DROPOFF') && editFitsInLocker && (
                  <div className="pt-2 space-y-2">
                    <p className="text-sm font-medium text-[#111]">
                      Your drop-off locker <span className="text-red-500">*</span>
                    </p>
                    <p className="text-xs text-[#979797]">Buyers will see this as the collection point for their orders.</p>
                    <LockerMapPicker
                      suburb={editSellerSuburb}
                      city={editSellerCity}
                      selectedId={editPudoLockerId}
                      selectedName={editPudoLockerName}
                      selectedAddress={editPudoLockerAddress}
                      onSelect={(locker: SelectedLocker | null) => {
                        setEditPudoLockerId(locker?.id ?? '');
                        setEditPudoLockerName(locker?.name ?? '');
                        setEditPudoLockerAddress(locker?.address ?? '');
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Description fields — only shown in edit mode (view mode shows these inline in right panel) */}
        {isEditing && (
          <div className="mt-12 space-y-4">
            {['part1', 'part2', 'part3', 'part4', 'part5'].map((key, i) => (
              <div key={key} className="border border-[#dedede] rounded-2xl p-6">
                <label className="block text-xs uppercase tracking-widest text-[#979797] font-semibold mb-3">{DESCRIPTION_LABELS[i]}</label>
                <textarea value={String(editForm[key as keyof typeof editForm])}
                  onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                  className="w-full h-24 bg-[#f4f4f4] border border-[#dedede] rounded-xl px-4 py-3 text-[#111] resize-none focus:outline-none focus:border-[#BE1E2D]" />
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

// Suppress unused import warning — LISTING_CONDITIONS is available for future use
void LISTING_CONDITIONS;
