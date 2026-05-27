'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  CheckCircle2, Clock, Truck, Package, ArrowLeft,
  Lock, AlertTriangle, XCircle, ShieldCheck, Banknote,
  QrCode, Timer,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type Order = {
  id: string;
  status: string;
  buyer_id: string;
  seller_id: string;
  item_price_cents: number;
  shipping_cost_cents: number;
  total_paid_cents: number;
  shipping_method: string | null;
  service_level_code: string | null;
  waybill_number: string | null;
  estimated_delivery: string | null;
  delivery_locker_id: string | null;
  delivery_locker_name: string | null;
  created_at: string;
  paid_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  completed_at: string | null;
  listing_id: string;
};

type Listing = { title: string; images: string[] };

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(cents: number) {
  return `R ${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

const SHIPPING_LABELS: Record<string, string> = {
  D2D: 'Door-to-door delivery',
  D2L: 'PUDO locker delivery',
  L2D: 'Drop-off → door delivery',
  L2L: 'Locker to locker',
};

// ── Order timeline config ─────────────────────────────────────────────────────
// RULE: mirrors the state machine in the orders table check constraint exactly.

const TIMELINE_STEPS = [
  { statuses: ['PENDING_PAYMENT'],              label: 'Order placed' },
  { statuses: ['AWAITING_DROPOFF'],             label: 'Payment held' },
  { statuses: ['ITEM_AT_HUB'],                  label: 'At hub' },
  { statuses: ['COMPLETED'],                    label: 'Complete' },
];

function getTimelineIndex(status: string): number {
  return TIMELINE_STEPS.findIndex(s => s.statuses.includes(status));
}

// ── QR Panel ─────────────────────────────────────────────────────────────────

function QrPanel({
  orderId,
  tokenType,
  label,
  instructions,
}: {
  orderId:      string
  tokenType:    'dropoff' | 'collection'
  label:        string
  instructions: string
}) {
  const [qrDataUrl,     setQrDataUrl]     = useState<string | null>(null)
  const [waybillNumber, setWaybillNumber] = useState<string | null>(null)
  const [expiresAt,     setExpiresAt]     = useState<string | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Session expired.'); setLoading(false); return }

      const res = await fetch(`/api/orders/${orderId}/qr/${tokenType}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) {
        setError(tokenType === 'collection' ? 'Collection QR not ready yet — drop-off must be confirmed first.' : 'QR not available.')
        setLoading(false)
        return
      }
      const data = await res.json()
      setQrDataUrl(data.qrDataUrl)
      setWaybillNumber(data.waybillNumber)
      setExpiresAt(data.expiresAt)
      setLoading(false)
    }
    load()
  }, [orderId, tokenType])

  const expiry = expiresAt
    ? new Date(expiresAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null

  const accent = tokenType === 'dropoff' ? 'blue' : 'green'
  const bg     = accent === 'blue' ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'
  const text   = accent === 'blue' ? 'text-blue-800' : 'text-green-800'
  const sub    = accent === 'blue' ? 'text-blue-600' : 'text-green-700'

  return (
    <div className={`rounded-2xl border p-5 space-y-4 ${bg}`}>
      <div className="flex items-start gap-3">
        <QrCode size={20} strokeWidth={1.5} className={sub + ' shrink-0 mt-0.5'} />
        <div>
          <p className={`text-sm font-semibold ${text}`}>{label}</p>
          <p className={`text-xs mt-0.5 ${sub}`}>{instructions}</p>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-6">
          <div className="w-6 h-6 border-2 border-[#dedede] border-t-[#BE1E2D] rounded-full animate-spin" />
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      {!loading && !error && qrDataUrl && (
        <div className="flex flex-col items-center gap-3">
          <div className="bg-white rounded-xl p-3 border border-[#dedede]">
            <img src={qrDataUrl} alt={`${label} QR Code`} className="w-48 h-48" />
          </div>

          {waybillNumber && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#979797]">Waybill</span>
              <span className="text-sm font-mono font-bold text-[#111]">{waybillNumber}</span>
            </div>
          )}

          {expiry && (
            <div className="flex items-center gap-1.5">
              <Timer size={12} strokeWidth={2} className="text-[#979797]" />
              <span className="text-xs text-[#979797]">Valid until {expiry}</span>
            </div>
          )}

          <p className="text-[10px] text-center text-[#979797] max-w-[220px]">
            This QR is fully shareable — only a verified Klerebank Admin can action it.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Stitch payment panel ──────────────────────────────────────────────────────
//
// Calls /api/orders/:id/pay → receives a Stitch-hosted checkout URL → redirects
// the buyer. Order stays PENDING_PAYMENT until the Stitch webhook confirms.

function StitchPaymentPanel({ order }: { order: Order }) {
  const [initiating, setInitiating] = useState(false);
  const [error, setError]           = useState('');

  async function handlePay() {
    setInitiating(true);
    setError('');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError('Session expired — please sign in again.');
      setInitiating(false);
      return;
    }

    const res  = await fetch(`/api/orders/${order.id}/pay`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const json = await res.json();

    if (!res.ok) {
      setError(
        json.error === 'order_not_payable'
          ? 'This order has already been paid.'
          : json.message ?? 'Payment unavailable — please try again.',
      );
      setInitiating(false);
      return;
    }

    // Redirect to Stitch-hosted checkout page
    window.location.href = json.redirectUrl;
  }

  return (
    <div className="space-y-5">
      {/* Amount summary */}
      <div className="bg-[#f4f4f4] rounded-2xl px-5 py-4">
        <p className="text-xs text-[#979797] font-semibold uppercase tracking-wide mb-3">Amount due</p>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[#555]">Item</span>
            <span className="text-[#111] font-medium">{fmt(order.item_price_cents)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#555]">
              Shipping{order.shipping_method ? ` (${SHIPPING_LABELS[order.shipping_method] ?? order.shipping_method})` : ''}
            </span>
            <span className="text-[#111] font-medium">{fmt(order.shipping_cost_cents)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold pt-2 border-t border-[#dedede]">
            <span className="text-[#111]">Total</span>
            <span className="text-[#BE1E2D] text-base">{fmt(order.total_paid_cents)}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle size={14} strokeWidth={2} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {/* Pay button */}
      <button
        onClick={handlePay}
        disabled={initiating}
        className="w-full py-4 bg-[#BE1E2D] hover:bg-[#9B1824] disabled:bg-[#dedede] text-white font-bold rounded-full transition flex items-center justify-center gap-2 text-base"
      >
        {initiating ? (
          <>
            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            Redirecting to Stitch…
          </>
        ) : (
          <>
            <Lock size={16} strokeWidth={2.5} />
            Pay {fmt(order.total_paid_cents)} with Stitch
          </>
        )}
      </button>

      <div className="flex flex-col items-center gap-1 pt-1">
        <div className="flex items-center gap-1.5">
          <ShieldCheck size={13} strokeWidth={2} className="text-[#979797]" />
          <p className="text-xs text-[#979797]">Secured by Stitch · Released only after you confirm receipt</p>
        </div>
        <p className="text-[11px] text-[#c0c0c0]">
          You will be redirected to Stitch to complete payment via instant EFT or card.
        </p>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const { id: orderId } = useParams<{ id: string }>();
  const router = useRouter();

  const [order,   setOrder]   = useState<Order | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [userId,  setUserId]  = useState('');
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  useEffect(() => { load(); }, [orderId]);

  async function load() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/'); return; }
    setUserId(session.user.id);

    const { data: orderData, error } = await supabase
      .from('orders')
      .select(`
        id, status, buyer_id, seller_id,
        item_price_cents, shipping_cost_cents, total_paid_cents,
        shipping_method, service_level_code,
        waybill_number, estimated_delivery,
        delivery_locker_id, delivery_locker_name,
        created_at, paid_at, shipped_at, delivered_at, completed_at,
        listing_id
      `)
      .eq('id', orderId)
      .single();

    if (error || !orderData) { setLoading(false); return; }
    setOrder(orderData as Order);

    // Fetch listing — may return null if delisted, that is expected
    const { data: listingData } = await supabase
      .from('listings')
      .select('title, images')
      .eq('id', orderData.listing_id)
      .single();
    setListing(listingData ?? null);
    setLoading(false);
  }

  async function handleConfirmReceipt() {
    if (!order) return;
    setConfirming(true);
    setConfirmError('');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setConfirmError('Session expired.'); setConfirming(false); return; }

    const res = await fetch(`/api/orders/${order.id}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const json = await res.json();

    if (!res.ok) {
      setConfirmError(json.error ?? 'Failed to confirm receipt.');
      setConfirming(false);
      return;
    }

    // Refresh order to show COMPLETED state
    await load();
    setConfirming(false);
  }

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#dedede] border-t-[#BE1E2D] rounded-full animate-spin" />
    </div>
  );

  if (!order) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 px-6">
      <Package size={48} strokeWidth={1.5} className="text-[#dedede]" />
      <p className="text-[#111] font-semibold">Order not found</p>
      <button onClick={() => router.push('/orders')} className="px-6 py-2 bg-[#BE1E2D] text-white rounded-full text-sm font-semibold">
        My orders
      </button>
    </div>
  );

  const shortId       = order.id.slice(0, 8).toUpperCase();
  const cover         = listing?.images?.[0] ?? null;
  const title         = listing?.title ?? 'Item';
  const timelineIdx   = getTimelineIndex(order.status);
  const isSeller      = order.seller_id === userId;
  const isCancelled   = ['CANCELLED', 'AUTO_CANCELLED'].includes(order.status);
  const isDisputed    = order.status === 'DISPUTED';
  const isPending     = order.status === 'PENDING_PAYMENT';
  const isDelivered   = order.status === 'DELIVERED';
  const isCompleted   = order.status === 'COMPLETED';
  const isAwaitingDropoff = order.status === 'AWAITING_DROPOFF';
  const isAtHub           = order.status === 'ITEM_AT_HUB';

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-lg mx-auto px-6 py-10 space-y-5">

        {/* Back */}
        <button
          onClick={() => router.push('/orders')}
          className="flex items-center gap-1.5 text-[#BE1E2D] text-sm font-medium hover:underline"
        >
          <ArrowLeft size={16} strokeWidth={2} /> My orders
        </button>

        {/* Status hero card */}
        <div className={`rounded-3xl p-6 text-center ${
          isCompleted  ? 'bg-green-50 border border-green-200' :
          isCancelled  ? 'bg-[#f4f4f4] border border-[#dedede]' :
          isDisputed   ? 'bg-red-50 border border-red-200' :
          isPending    ? 'bg-amber-50 border border-amber-200' :
          'bg-[#f0f4ff] border border-[#c7d2fe]'
        }`}>
          <div className="flex justify-center mb-3">
            {isCompleted  && <CheckCircle2 size={44} strokeWidth={1.5} className="text-green-500" />}
            {isCancelled  && <XCircle      size={44} strokeWidth={1.5} className="text-[#979797]" />}
            {isDisputed   && <AlertTriangle size={44} strokeWidth={1.5} className="text-red-500" />}
            {isPending    && <Clock        size={44} strokeWidth={1.5} className="text-amber-500" />}
            {isDelivered  && <Package      size={44} strokeWidth={1.5} className="text-green-500" />}
            {!isCompleted && !isCancelled && !isDisputed && !isPending && !isDelivered && (
              <Truck size={44} strokeWidth={1.5} className="text-[#BE1E2D]" />
            )}
          </div>
          <h1 className={`text-lg font-bold ${isCompleted ? 'text-green-800' : isCancelled ? 'text-[#555]' : isDisputed ? 'text-red-800' : 'text-[#111]'}`}>
            {isCompleted         ? 'Order complete'
            : isCancelled        ? 'Order cancelled'
            : isDisputed         ? 'Dispute open'
            : isPending          ? 'Awaiting payment'
            : isAwaitingDropoff  ? (isSeller ? 'Drop off your item at Klerebank' : 'Payment held — seller bringing item to hub')
            : isAtHub            ? (isSeller ? 'Item received at Klerebank hub' : 'Your item is ready to collect!')
            : order.status === 'AWAITING_SHIPMENT_BOOKING' ? 'Payment secured — waiting for seller'
            : order.status === 'SHIPMENT_BOOKED'           ? 'Shipment booked'
            : order.status === 'SHIPPED'                   ? 'On its way to you'
            : order.status === 'IN_TRANSIT'                ? 'In transit'
            : order.status === 'OUT_FOR_DELIVERY'          ? 'Out for delivery today!'
            : order.status}
          </h1>
          <p className="text-xs text-[#979797] mt-1">Order #{shortId} · {fmtDate(order.created_at)}</p>
        </div>

        {/* Progress timeline — hidden for cancelled/disputed */}
        {!isCancelled && !isDisputed && timelineIdx >= 0 && (
          <div className="bg-[#f4f4f4] rounded-2xl px-5 py-4">
            <div className="flex items-center justify-between">
              {TIMELINE_STEPS.map((step, i) => (
                <div key={i} className="flex flex-col items-center flex-1">
                  {/* Connector line + dot row */}
                  <div className="flex items-center w-full">
                    {/* Left connector */}
                    <div className={`flex-1 h-0.5 ${i === 0 ? 'opacity-0' : i <= timelineIdx ? 'bg-[#BE1E2D]' : 'bg-[#dedede]'}`} />
                    {/* Dot */}
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      i < timelineIdx  ? 'bg-[#BE1E2D] border-[#BE1E2D]' :
                      i === timelineIdx ? 'bg-white border-[#BE1E2D]' :
                      'bg-white border-[#dedede]'
                    }`}>
                      {i < timelineIdx && <CheckCircle2 size={12} strokeWidth={3} className="text-white" />}
                      {i === timelineIdx && <div className="w-2 h-2 rounded-full bg-[#BE1E2D]" />}
                    </div>
                    {/* Right connector */}
                    <div className={`flex-1 h-0.5 ${i === TIMELINE_STEPS.length - 1 ? 'opacity-0' : i < timelineIdx ? 'bg-[#BE1E2D]' : 'bg-[#dedede]'}`} />
                  </div>
                  {/* Label */}
                  <p className={`text-center mt-1.5 leading-tight ${
                    i === timelineIdx ? 'text-[10px] font-bold text-[#BE1E2D]' : 'text-[10px] text-[#979797]'
                  }`} style={{ maxWidth: '52px' }}>
                    {step.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Item summary */}
        <div className="bg-white border border-[#dedede] rounded-2xl p-4 flex gap-4 items-center">
          <div className="w-14 h-14 rounded-xl bg-[#f4f4f4] overflow-hidden shrink-0 relative">
            {cover
              ? <img src={cover} alt={title} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center"><Package size={22} strokeWidth={1.5} className="text-[#dedede]" /></div>
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#111] line-clamp-2">{title}</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-[#979797]">{order.shipping_method ? SHIPPING_LABELS[order.shipping_method] ?? order.shipping_method : ''}</span>
            </div>
          </div>
          <p className="text-base font-bold text-[#BE1E2D] shrink-0">{fmt(order.total_paid_cents)}</p>
        </div>

        {/* ── State-specific content ─────────────────────────────────────────── */}

        {/* PENDING_PAYMENT: Stitch payment */}
        {isPending && (
          <StitchPaymentPanel order={order} />
        )}

        {/* AWAITING_DROPOFF: seller sees DROP-OFF QR, buyer sees waiting message */}
        {isAwaitingDropoff && isSeller && (
          <QrPanel
            orderId={order.id}
            tokenType="dropoff"
            label="Your Drop-Off QR"
            instructions="Show or print this QR at any Klerebank location. The admin will scan it to confirm receipt of your item."
          />
        )}
        {isAwaitingDropoff && !isSeller && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex gap-3">
            <ShieldCheck size={20} strokeWidth={1.5} className="text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-800">Payment held safely</p>
              <p className="text-xs text-blue-600 mt-1">
                Your {fmt(order.total_paid_cents)} is locked safely. The seller has been notified
                and must drop the item off at a Klerebank hub within 3 business days.
                You'll receive your collection QR once the item is confirmed at the hub.
              </p>
            </div>
          </div>
        )}

        {/* ITEM_AT_HUB: buyer sees COLLECTION QR, seller sees confirmation */}
        {isAtHub && !isSeller && (
          <QrPanel
            orderId={order.id}
            tokenType="collection"
            label="Your Collection QR"
            instructions="Show this QR at any Klerebank location to collect your item. You can share it with someone collecting on your behalf."
          />
        )}
        {isAtHub && isSeller && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex gap-3">
            <CheckCircle2 size={20} strokeWidth={1.5} className="text-green-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-green-800">Item received at Klerebank hub</p>
              <p className="text-xs text-green-700 mt-1">
                The buyer has been sent their collection QR. Once they collect, payment will be
                released to you automatically.
              </p>
            </div>
          </div>
        )}

        {/* AWAITING_SHIPMENT_BOOKING: payment confirmed, waiting for seller */}
        {order.status === 'AWAITING_SHIPMENT_BOOKING' && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex gap-3">
            <ShieldCheck size={20} strokeWidth={1.5} className="text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-800">Payment held safely</p>
              <p className="text-xs text-blue-600 mt-1">
                Your {fmt(order.total_paid_cents)} is locked safely. The seller has been notified and
                must ship within 3 business days. You'll be notified when it ships.
              </p>
            </div>
          </div>
        )}

        {/* SHIPPED / IN_TRANSIT / OUT_FOR_DELIVERY: tracking info */}
        {['SHIPMENT_BOOKED', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(order.status) && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 space-y-3">
            <div className="flex gap-3">
              <Truck size={20} strokeWidth={1.5} className="text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-indigo-800">Your order is on its way</p>
                {order.estimated_delivery && (
                  <p className="text-xs text-indigo-600 mt-0.5">Estimated delivery: {fmtDate(order.estimated_delivery)}</p>
                )}
              </div>
            </div>
            {order.waybill_number && (
              <div className="flex items-center gap-2 pt-2 border-t border-indigo-200">
                <span className="text-xs text-indigo-600">Waybill:</span>
                <span className="text-xs font-mono font-semibold text-indigo-800">{order.waybill_number}</span>
              </div>
            )}
          </div>
        )}

        {/* DELIVERED: confirm receipt */}
        {isDelivered && (
          <div className="bg-green-50 border border-green-300 rounded-2xl p-5 space-y-3">
            <div className="flex gap-3">
              <CheckCircle2 size={20} strokeWidth={1.5} className="text-green-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-800">Item delivered!</p>
                <p className="text-xs text-green-700 mt-1">
                  Please confirm you received your item in good condition.
                  This releases the payment to the seller. You have 14 days before it auto-releases.
                </p>
              </div>
            </div>
            {confirmError && <p className="text-red-500 text-sm">{confirmError}</p>}
            <button
              onClick={handleConfirmReceipt}
              disabled={confirming}
              className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-[#dedede] text-white font-bold rounded-full transition flex items-center justify-center gap-2"
            >
              {confirming
                ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Confirming...</>
                : <><CheckCircle2 size={16} strokeWidth={2.5} /> Yes, I received my item</>
              }
            </button>
          </div>
        )}

        {/* COMPLETED */}
        {isCompleted && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex gap-3">
            <Banknote size={20} strokeWidth={1.5} className="text-green-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-green-800">All done!</p>
              <p className="text-xs text-green-700 mt-1">
                Payment has been released to the seller. Order completed {fmtDate(order.completed_at)}.
              </p>
            </div>
          </div>
        )}

        {/* CANCELLED */}
        {isCancelled && (
          <div className="bg-[#f4f4f4] border border-[#dedede] rounded-2xl p-5 flex gap-3">
            <XCircle size={20} strokeWidth={1.5} className="text-[#979797] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[#555]">
                {order.status === 'AUTO_CANCELLED' ? 'Auto-cancelled — seller did not ship in time' : 'Order cancelled'}
              </p>
              <p className="text-xs text-[#979797] mt-1">Any payment has been fully refunded.</p>
            </div>
          </div>
        )}

        {/* Order breakdown — always shown */}
        <div className="bg-[#f4f4f4] rounded-2xl px-5 py-4 space-y-2">
          <p className="text-xs font-semibold text-[#979797] uppercase tracking-wide mb-3">Order details</p>
          {[
            ['Order ID',    `#${shortId}`],
            ['Placed',      fmtDate(order.created_at)],
            ['Item price',  fmt(order.item_price_cents)],
            ['Shipping',    fmt(order.shipping_cost_cents)],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between">
              <span className="text-sm text-[#555]">{label}</span>
              <span className="text-sm text-[#111] font-medium">{value}</span>
            </div>
          ))}
          {/* Show collection locker for PUDO delivery orders */}
          {order.delivery_locker_name && (
            <div className="flex justify-between items-start pt-1">
              <span className="text-sm text-[#555]">Collect from</span>
              <span className="text-sm text-[#111] font-medium text-right max-w-[60%]">{order.delivery_locker_name}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t border-[#dedede]">
            <span className="text-sm font-bold text-[#111]">Total paid</span>
            <span className="text-sm font-bold text-[#BE1E2D]">{fmt(order.total_paid_cents)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => router.push('/orders')}
            className="flex-1 py-3 border border-[#dedede] text-[#111] rounded-full text-sm font-semibold hover:border-[#BE1E2D] hover:text-[#BE1E2D] transition"
          >
            My orders
          </button>
          <button
            onClick={() => router.push('/browse')}
            className="flex-1 py-3 bg-[#BE1E2D] hover:bg-[#9B1824] text-white rounded-full text-sm font-semibold transition"
          >
            Browse more
          </button>
        </div>

      </div>
    </div>
  );
}
