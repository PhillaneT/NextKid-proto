'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useParams } from 'next/navigation';
import { Pencil, Trash2, X, Check, Bell } from 'lucide-react';

type Item = {
  id: string;
  title: string;
  category: string;
  price: number;
  listing_type: string;
  auction_ends_at: string | null;
  description_part1: string | null;
  description_part2: string | null;
  description_part3: string | null;
  description_part4: string | null;
  description_part5: string | null;
  images: string[];
  created_at: string;
  seller_id: string;
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
const CATEGORIES = ['Electronics', 'Fashion', 'Home & Garden', 'Sports', 'Other'];

export default function ItemPage() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [isOwner, setIsOwner] = useState(false);
  const [isAgeVerified, setIsAgeVerified] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editImagePreviews, setEditImagePreviews] = useState<string[]>([]);
  const [editImageUrls, setEditImageUrls] = useState<string[]>([]);
  const [uploadingEdit, setUploadingEdit] = useState(false);

  // Offer state
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [submittingOffer, setSubmittingOffer] = useState(false);
  const [offerSuccess, setOfferSuccess] = useState(false);

  // Bid state
  const [showBidModal, setShowBidModal] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [submittingBid, setSubmittingBid] = useState(false);
  const [bidSuccess, setBidSuccess] = useState(false);
  const [highestBid, setHighestBid] = useState<number | null>(null);
  const [userHasBid, setUserHasBid] = useState(false);

  // Seller view
  const [offers, setOffers] = useState<Offer[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [activeSellerTab, setActiveSellerTab] = useState<'offers' | 'bids'>('offers');

  const [editForm, setEditForm] = useState({
  title: '', category: '', price: '',
  listing_type: 'buy_now', auction_days: '3',
  part1: '', part2: '', part3: '', part4: '', part5: '',
});

  const handleEditImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    setUploadingEdit(true);
    const newPreviews: string[] = [];
    const newUrls: string[] = [];
    for (const file of files) {
      const preview = URL.createObjectURL(file);
      newPreviews.push(preview);
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

  useEffect(() => {
    if (id) fetchItem();
  }, [id]);

  async function fetchItem() {
  const { data, error } = await supabase.from('items').select('*').eq('id', id).single();
  if (error) { console.error(error); setLoading(false); return; }

  setItem(data);

  setEditForm({
    title: data.title, category: data.category,
    price: String(data.price / 100),
    listing_type: data.listing_type || 'buy_now',
    auction_days: '3',
    part1: data.description_part1 || '', part2: data.description_part2 || '',
    part3: data.description_part3 || '', part4: data.description_part4 || '',
    part5: data.description_part5 || '',
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    setCurrentUserId(user.id);
    const owner = user.id === data.seller_id;
    setIsOwner(owner);

    const { data: profileData } = await supabase.from('profiles').select('is_age_verified').eq('id', user.id).single();
    setIsAgeVerified(profileData?.is_age_verified || false);

    if (owner) {
      fetchOffers(data.id);
      fetchBids(data.id);
    } else {
      fetchHighestBid(data.id);
      checkUserBid(data.id, user.id);
    }
  } else {
    // Unauthenticated visitor — just load bid info for display
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
    const { error } = await supabase.from('items').delete().eq('id', item!.id);
    if (error) { alert('Error deleting: ' + error.message); setDeleting(false); }
    else router.push('/dashboard');
  }

  async function handleSave() {
    setSaving(true);
const auctionEndsAt = editForm.listing_type === 'best_bids'
  ? new Date(Date.now() + parseInt(editForm.auction_days) * 24 * 60 * 60 * 1000).toISOString()
  : null;

    const { error } = await supabase.from('items').update({
      title: editForm.title, category: editForm.category,
      price: parseInt(editForm.price) * 100 || 0,
      listing_type: editForm.listing_type,
      auction_ends_at: auctionEndsAt,
      description_part1: editForm.part1 || null, description_part2: editForm.part2 || null,
      description_part3: editForm.part3 || null, description_part4: editForm.part4 || null,
      description_part5: editForm.part5 || null,
      images: editImageUrls.length > 0 ? editImageUrls : item!.images,
    }).eq('id', item!.id);
    if (error) alert('Error saving: ' + error.message);
    else { await fetchItem(); setIsEditing(false); }
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
        user_id: item!.seller_id,
        type: 'offer',
        message: `New offer of R${offerAmount} on "${item!.title}"`,
        item_id: item!.id,
      });
      setOfferSuccess(true);
    } else {
      alert('Error submitting offer: ' + error.message);
    }
    setSubmittingOffer(false);
  }

  async function handleSubmitBid() {
    if (!bidAmount || !currentUserId) return;
    setSubmittingBid(true);
    const amount = parseInt(bidAmount) * 100;

    if (highestBid && amount <= highestBid) {
      alert(`Your bid must be higher than the current highest bid of R${highestBid / 100}`);
      setSubmittingBid(false);
      return;
    }

    if (amount <= item!.price) {
      alert(`Your bid must be higher than the starting price of R${item!.price / 100}`);
      setSubmittingBid(false);
      return;
    }

    const { error } = await supabase.from('bids').insert({
      item_id: item!.id, buyer_id: currentUserId, amount,
    });

    if (!error) {
      await supabase.from('notifications').insert({
        user_id: item!.seller_id,
        type: 'bid',
        message: `New bid of R${bidAmount} on "${item!.title}"`,
        item_id: item!.id,
      });
      setHighestBid(amount);
      setUserHasBid(true);
      setBidSuccess(true);
    } else {
      alert('Error submitting bid: ' + error.message);
    }
    setSubmittingBid(false);
  }

  async function handleOfferAction(offerId: string, status: 'accepted' | 'declined', buyerId: string) {
    await supabase.from('offers').update({ status }).eq('id', offerId);
    await supabase.from('notifications').insert({
      user_id: buyerId,
      type: status === 'accepted' ? 'offer_accepted' : 'offer_declined',
      message: status === 'accepted'
        ? `Your offer on "${item!.title}" was accepted! 🎉`
        : `Your offer on "${item!.title}" was declined.`,
      item_id: item!.id,
    });
    fetchOffers(item!.id);
  }

  async function handleBuyNow() {
    if (!currentUserId) return;
    await supabase.from('notifications').insert({
      user_id: item!.seller_id,
      type: 'purchase',
      message: `Someone purchased "${item!.title}" at R${(item!.price / 100).toLocaleString()} 🎉`,
      item_id: item!.id,
    });
    alert('Purchase recorded! The seller has been notified.');
  }

  const auctionEnded = item?.auction_ends_at ? new Date(item.auction_ends_at) < new Date() : false;
  const timeLeft = item?.auction_ends_at ? getTimeLeft(item.auction_ends_at) : null;

  function getTimeLeft(endDate: string) {
    const diff = new Date(endDate).getTime() - Date.now();
    if (diff <= 0) return 'Auction ended';
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (d > 0) return `${d}d ${h}h left`;
    if (h > 0) return `${h}h ${m}m left`;
    return `${m}m left`;
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <p className="text-gray-400">Loading listing...</p>
    </div>
  );

  if (!item) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4">📦</div>
        <h2 className="text-2xl font-bold text-white mb-2">Item not found</h2>
        <p className="text-gray-400 mb-6">This listing may have been removed.</p>
        <button onClick={() => router.push('/browse')} className="bg-violet-600 hover:bg-violet-700 text-white px-8 py-3 rounded-2xl font-medium">Back to Browse</button>
      </div>
    </div>
  );

  const descriptionParts = [item.description_part1, item.description_part2, item.description_part3, item.description_part4, item.description_part5];

  return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <div className="py-12">
        <div className="max-w-5xl mx-auto px-6">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.push('/browse')} className="text-gray-400 hover:text-white flex items-center gap-2">← Back to Browse</button>
          <div className="flex items-center gap-3">
            {!isOwner && (
              <button onClick={() => router.push('/notifications')} className="relative p-2 text-gray-400 hover:text-white">
                <Bell size={20} />
              </button>
            )}
            {isOwner && !isEditing && (
              <>
                <button onClick={() => { setIsEditing(true); setEditImagePreviews(item.images || []); setEditImageUrls(item.images || []); }}
                  className="flex items-center gap-2 px-5 py-2 bg-[#111] border border-[#333] hover:border-violet-500 text-white rounded-2xl transition text-sm">
                  <Pencil size={15} /> Edit
                </button>
                <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-2 px-5 py-2 bg-[#111] border border-[#333] hover:border-red-500 text-red-400 rounded-2xl transition text-sm">
                  <Trash2 size={15} /> Delete
                </button>
              </>
            )}
            {isOwner && isEditing && (
              <>
                <button onClick={() => setIsEditing(false)} className="flex items-center gap-2 px-5 py-2 bg-[#111] border border-[#333] text-gray-400 rounded-2xl text-sm">
                  <X size={15} /> Cancel
                </button>
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-600 text-white rounded-2xl text-sm">
                  <Check size={15} /> {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Delete modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-[#111] border border-[#222] rounded-3xl p-10 max-w-md w-full mx-6 text-center">
              <div className="text-5xl mb-4">🗑️</div>
              <h2 className="text-2xl font-bold text-white mb-2">Delete Listing?</h2>
              <p className="text-gray-400 mb-8">This action cannot be undone.</p>
              <div className="flex gap-4 justify-center">
                <button onClick={() => setShowDeleteConfirm(false)} className="px-8 py-3 border border-[#333] text-white rounded-2xl">Cancel</button>
                <button onClick={handleDelete} disabled={deleting} className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl">
                  {deleting ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Offer modal */}
        {showOfferModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-[#111] border border-[#222] rounded-3xl p-10 max-w-md w-full mx-6">
              {offerSuccess ? (
                <div className="text-center">
                  <div className="text-5xl mb-4">🤝</div>
                  <h2 className="text-2xl font-bold text-white mb-2">Offer Sent!</h2>
                  <p className="text-gray-400 mb-6">The seller will review your offer and get back to you.</p>
                  <button onClick={() => { setShowOfferModal(false); setOfferSuccess(false); setOfferAmount(''); setOfferMessage(''); }}
                    className="bg-violet-600 hover:bg-violet-700 text-white px-8 py-3 rounded-2xl">Done</button>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-white">Make an Offer</h2>
                    <button onClick={() => setShowOfferModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
                  </div>
                  <p className="text-gray-400 text-sm mb-6">Seller's asking price: <span className="text-white font-semibold">R{(item.price / 100).toLocaleString()}</span></p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Your Offer (Rands)</label>
                      <input type="number" value={offerAmount} onChange={(e) => setOfferAmount(e.target.value)}
                        className="w-full bg-[#1a1a1a] border border-[#333] rounded-2xl px-5 py-4 text-white" placeholder="e.g. 500" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Message (optional)</label>
                      <textarea value={offerMessage} onChange={(e) => setOfferMessage(e.target.value)}
                        className="w-full h-24 bg-[#1a1a1a] border border-[#333] rounded-2xl px-5 py-4 text-white resize-none"
                        placeholder="Why should the seller accept your offer?" />
                    </div>
                    <button onClick={handleSubmitOffer} disabled={submittingOffer || !offerAmount}
                      className="w-full py-4 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-600 text-white font-medium rounded-2xl">
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
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-[#111] border border-[#222] rounded-3xl p-10 max-w-md w-full mx-6">
              {bidSuccess ? (
                <div className="text-center">
                  <div className="text-5xl mb-4">🏆</div>
                  <h2 className="text-2xl font-bold text-white mb-2">Bid Placed!</h2>
                  <p className="text-gray-400 mb-6">You're in the running. Check back to see if you win.</p>
                  <button onClick={() => { setShowBidModal(false); setBidSuccess(false); setBidAmount(''); }}
                    className="bg-violet-600 hover:bg-violet-700 text-white px-8 py-3 rounded-2xl">Done</button>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-white">Place a Bid</h2>
                    <button onClick={() => setShowBidModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
                  </div>
                  <div className="bg-[#1a1a1a] rounded-2xl p-4 mb-6 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Starting price</span>
                      <span className="text-white">R{(item.price / 100).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Highest bid</span>
                      <span className="text-violet-400 font-semibold">{highestBid ? `R${(highestBid / 100).toLocaleString()}` : 'No bids yet'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Time left</span>
                      <span className={auctionEnded ? 'text-red-400' : 'text-green-400'}>{timeLeft}</span>
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm text-gray-400 mb-2">Your Bid (Rands)</label>
                    <input type="number" value={bidAmount} onChange={(e) => setBidAmount(e.target.value)}
                      className="w-full bg-[#1a1a1a] border border-[#333] rounded-2xl px-5 py-4 text-white"
                      placeholder={`Min: R${highestBid ? (highestBid / 100) + 1 : (item.price / 100) + 1}`} />
                  </div>
                  <button onClick={handleSubmitBid} disabled={submittingBid || !bidAmount || auctionEnded}
                    className="w-full py-4 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-600 text-white font-medium rounded-2xl">
                    {auctionEnded ? 'Auction Ended' : submittingBid ? 'Placing Bid...' : 'Place Bid'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Images */}
        <div>
          <div className="bg-[#111] border border-[#222] rounded-3xl overflow-hidden h-96 relative group">
            {(isEditing ? editImagePreviews : item.images)?.length > 0 ? (
              <img src={(isEditing ? editImagePreviews : item.images)[selectedImage]} alt={item.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-8xl text-gray-600">📦</div>
            )}

            {/* Edit overlay — visible to owner always */}
            {isOwner && (
              <>
                <input type="file" accept="image/*" multiple onChange={handleEditImageChange} className="hidden" id="edit-upload" />
                <label htmlFor="edit-upload"
                  className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition cursor-pointer rounded-3xl">
                  <div className="text-center">
                    <div className="text-4xl mb-2">📷</div>
                    <div className="text-white text-sm font-medium">{uploadingEdit ? 'Uploading...' : 'Change Photos'}</div>
                  </div>
                </label>
              </>
            )}
          </div>

          {/* Thumbnails */}
          {(isEditing ? editImagePreviews : item.images)?.length > 1 && (
            <div className="flex gap-3 mt-4 flex-wrap">
              {(isEditing ? editImagePreviews : item.images).map((src, i) => (
                <div key={i} className="relative group/thumb">
                  <button onClick={() => setSelectedImage(i)}
                    className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition ${selectedImage === i ? 'border-violet-500' : 'border-[#333]'}`}>
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </button>
                  {isEditing && (
                    <button onClick={() => removeEditImage(i)}
                      className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover/thumb:opacity-100 transition">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

          {/* Right panel */}
          <div>
          {isEditing ? (
            <div className="space-y-5">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Title</label>
                <input type="text" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-2xl px-5 py-4 text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Category</label>
                  <select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-2xl px-5 py-4 text-white">
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    {editForm.listing_type === 'best_bids' ? 'Starting Price (Rands)' : 'Price (Rands)'}
                  </label>
                  <input type="number" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-2xl px-5 py-4 text-white" />
                </div>
              </div>

              {/* Listing type */}
              <div>
                <label className="block text-sm text-gray-400 mb-3">Listing Type</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'buy_now', label: 'Buy Now', emoji: '⚡' },
                    { value: 'make_offer', label: 'Make Offer', emoji: '🤝' },
                    { value: 'best_bids', label: 'Best Bids', emoji: '🏆' },
                  ].map((type) => (
                    <button key={type.value} type="button"
                      onClick={() => setEditForm({ ...editForm, listing_type: type.value })}
                      className={`p-4 rounded-2xl border-2 text-center transition ${
                        editForm.listing_type === type.value
                          ? 'border-violet-500 bg-violet-500/10'
                          : 'border-[#333] bg-[#1a1a1a] hover:border-[#555]'
                      }`}>
                      <div className="text-xl mb-1">{type.emoji}</div>
                      <div className="text-white text-xs font-medium">{type.label}</div>
                    </button>
                  ))}
                </div>

                {editForm.listing_type === 'best_bids' && (
                  <div className="mt-3">
                    <label className="block text-sm text-gray-400 mb-2">Auction Duration</label>
                    <select value={editForm.auction_days} onChange={(e) => setEditForm({ ...editForm, auction_days: e.target.value })}
                      className="w-full bg-[#1a1a1a] border border-[#333] rounded-2xl px-5 py-4 text-white">
                      <option value="1">1 day</option>
                      <option value="3">3 days</option>
                      <option value="7">7 days</option>
                      <option value="14">14 days</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
            ) : (
              <>
                {/* Listing type badge */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-xs uppercase tracking-widest text-violet-400">{item.category}</div>
                  <div className={`text-xs px-3 py-1 rounded-full font-medium ${
                    item.listing_type === 'buy_now' ? 'bg-blue-500/20 text-blue-400' :
                    item.listing_type === 'make_offer' ? 'bg-green-500/20 text-green-400' :
                    'bg-orange-500/20 text-orange-400'
                  }`}>
                    {item.listing_type === 'buy_now' ? '⚡ Buy Now' : item.listing_type === 'make_offer' ? '🤝 Make Offer' : '🏆 Best Bids'}
                  </div>
                </div>

                <h1 className="text-3xl font-bold text-white mb-4">{item.title}</h1>

                {item.listing_type === 'best_bids' ? (
                  <div className="bg-[#1a1a1a] rounded-2xl p-4 mb-6 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400 text-sm">Starting price</span>
                      <span className="text-white font-semibold">R{(item.price / 100).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400 text-sm">Highest bid</span>
                      <span className="text-violet-400 font-bold text-lg">{highestBid ? `R${(highestBid / 100).toLocaleString()}` : 'No bids yet'}</span>
                    </div>
                    {timeLeft && (
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">Time left</span>
                        <span className={`font-medium text-sm ${auctionEnded ? 'text-red-400' : 'text-green-400'}`}>{timeLeft}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-4xl font-bold text-white mb-6">R{(item.price / 100).toLocaleString()}</div>
                )}

                {/* Buyer actions */}
                {!isOwner && isAgeVerified && (
                  <div className="space-y-3">
                    {!isOwner && !isAgeVerified && (
                      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-5 text-center">
                        <p className="text-yellow-400 font-medium">🔞 You must be 18+ to buy or make offers.</p>
                        <p className="text-gray-400 text-sm mt-1">You can browse but cannot purchase on this account.</p>
                      </div>
                    )}
                    {item.listing_type === 'buy_now' && (
                      <button onClick={handleBuyNow} className="w-full py-4 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-2xl transition">
                        ⚡ Buy Now — R{(item.price / 100).toLocaleString()}
                      </button>
                    )}
                    {item.listing_type === 'make_offer' && (
                      <button onClick={() => setShowOfferModal(true)} className="w-full py-4 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-2xl transition">
                        🤝 Make an Offer
                      </button>
                    )}
                    {item.listing_type === 'best_bids' && (
                      <button onClick={() => setShowBidModal(true)} disabled={auctionEnded}
                        className="w-full py-4 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-600 text-white font-medium rounded-2xl transition">
                        {auctionEnded ? 'Auction Ended' : userHasBid ? '🏆 Update My Bid' : '🏆 Place a Bid'}
                      </button>
                    )}
                    <button className="w-full py-4 border border-[#333] hover:border-violet-500 text-white font-medium rounded-2xl transition">
                      Save Listing
                    </button>
                  </div>
                )}

                {/* Seller summary */}
                {isOwner && item.listing_type !== 'buy_now' && (
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    {item.listing_type === 'make_offer' && (
                      <div className="bg-[#1a1a1a] rounded-2xl p-4 text-center col-span-2">
                        <div className="text-2xl font-bold text-white">{offers.length}</div>
                        <div className="text-gray-400 text-sm">Offers</div>
                      </div>
                    )}
                    {item.listing_type === 'best_bids' && (
                      <div className="bg-[#1a1a1a] rounded-2xl p-4 text-center col-span-2">
                        <div className="text-2xl font-bold text-white">{bids.length}</div>
                        <div className="text-gray-400 text-sm">Bids</div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Description sections */}
        <div className="mt-12 space-y-6">
          {isEditing ? (
            ['part1', 'part2', 'part3', 'part4', 'part5'].map((key, i) => (
              <div key={key} className="bg-[#111] border border-[#222] rounded-3xl p-8">
                <label className="block text-sm uppercase tracking-widest text-violet-400 mb-3">{DESCRIPTION_LABELS[i]}</label>
                <textarea value={editForm[key as keyof typeof editForm]}
                  onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                  className="w-full h-28 bg-[#1a1a1a] border border-[#333] rounded-2xl px-5 py-4 text-white resize-none" />
              </div>
            ))
          ) : (
            descriptionParts.map((part, i) =>
              part ? (
                <div key={i} className="bg-[#111] border border-[#222] rounded-3xl p-8">
                  <h3 className="text-sm uppercase tracking-widest text-violet-400 mb-3">{DESCRIPTION_LABELS[i]}</h3>
                  <p className="text-gray-300 leading-relaxed">{part}</p>
                </div>
              ) : null
            )
          )}
        </div>

        {/* Seller offers/bids panel */}
        {isOwner && (item.listing_type === 'make_offer' || item.listing_type === 'best_bids') && (
          <div className="mt-12 bg-[#111] border border-[#222] rounded-3xl p-8">
            <h2 className="text-xl font-bold text-white mb-6">
              {item.listing_type === 'make_offer' ? '📬 Incoming Offers' : '🏆 Bid Leaderboard'}
            </h2>

            {item.listing_type === 'make_offer' && (
              offers.length === 0 ? (
                <p className="text-gray-400">No offers yet.</p>
              ) : (
                <div className="space-y-4">
                  {offers.map((offer) => (
                    <div key={offer.id} className="bg-[#1a1a1a] rounded-2xl p-6 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-white font-bold text-xl">R{(offer.amount / 100).toLocaleString()}</div>
                        {offer.message && <p className="text-gray-400 text-sm mt-1">"{offer.message}"</p>}
                        <div className="text-gray-500 text-xs mt-1">{new Date(offer.created_at).toLocaleDateString()}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        {offer.status === 'pending' ? (
                          <>
                            <button onClick={() => handleOfferAction(offer.id, 'accepted', offer.buyer_id)}
                              className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm">Accept</button>
                            <button onClick={() => handleOfferAction(offer.id, 'declined', offer.buyer_id)}
                              className="px-5 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-xl text-sm">Decline</button>
                          </>
                        ) : (
                          <span className={`text-sm px-4 py-2 rounded-xl font-medium ${
                            offer.status === 'accepted' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {offer.status === 'accepted' ? '✓ Accepted' : '✗ Declined'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {item.listing_type === 'best_bids' && (
              bids.length === 0 ? (
                <p className="text-gray-400">No bids yet.</p>
              ) : (
                <div className="space-y-3">
                  {bids.map((bid, i) => (
                    <div key={bid.id} className={`bg-[#1a1a1a] rounded-2xl p-5 flex items-center justify-between ${i === 0 ? 'border border-violet-500/50' : ''}`}>
                      <div className="flex items-center gap-4">
                        <div className={`text-lg font-bold w-8 ${i === 0 ? 'text-violet-400' : 'text-gray-500'}`}>#{i + 1}</div>
                        <div>
                          <div className={`font-bold text-xl ${i === 0 ? 'text-white' : 'text-gray-300'}`}>
                            R{(bid.amount / 100).toLocaleString()}
                          </div>
                          <div className="text-gray-500 text-xs">{new Date(bid.created_at).toLocaleDateString()}</div>
                        </div>
                      </div>
                      {i === 0 && <span className="text-xs bg-violet-500/20 text-violet-400 px-3 py-1 rounded-full">🏆 Leading</span>}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}