'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Package, Clock, Truck, CheckCircle2, XCircle,
  AlertTriangle, ShoppingBag, ChevronRight,
} from 'lucide-react';
import Image from 'next/image';

// ── Types ─────────────────────────────────────────────────────────────────────

type OrderRow = {
  id: string;
  status: string;
  buyer_id: string;
  seller_id: string;
  item_price_cents: number;
  shipping_cost_cents: number;
  total_paid_cents: number;
  shipping_method: string | null;
  service_level_code: string | null;
  created_at: string;
  estimated_delivery: string | null;
  waybill_number: string | null;
  listings: {
    title: string;
    images: string[];
  } | null;
};

type TabFilter = 'all' | 'active' | 'completed';

// ── Status config ─────────────────────────────────────────────────────────────
// RULE: display labels and colours must reflect the order state machine exactly.
// Never invent statuses — only use those defined in the orders table check constraint.

type StatusConfig = {
  label: string;
  colour: string;       // Tailwind text colour
  bg: string;           // Tailwind bg colour
  border: string;       // Tailwind border colour
  icon: React.ReactNode;
  group: TabFilter;
};

function getStatusConfig(status: string, isSeller = false): StatusConfig {
  switch (status) {
    // Hub fulfilment flow
    case 'AWAITING_DROPOFF':
      return isSeller
        ? { label: 'Drop off needed',    colour: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', icon: <Package size={11} strokeWidth={2.5} />, group: 'active' }
        : { label: 'Seller bringing item', colour: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',   icon: <Clock size={11} strokeWidth={2.5} />, group: 'active' };
    case 'ITEM_AT_HUB':
      return isSeller
        ? { label: 'Buyer collecting',   colour: 'text-green-700', bg: 'bg-green-50',  border: 'border-green-200', icon: <CheckCircle2 size={11} strokeWidth={2.5} />, group: 'active' }
        : { label: 'Ready to collect!',  colour: 'text-green-700', bg: 'bg-green-50',  border: 'border-green-300', icon: <CheckCircle2 size={11} strokeWidth={2.5} />, group: 'active' };
    case 'UNCOLLECTED':
      return { label: 'Uncollected', colour: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: <AlertTriangle size={11} strokeWidth={2.5} />, group: 'active' };
    // Payment
    case 'PENDING_PAYMENT':
      return { label: 'Awaiting payment', colour: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: <Clock size={11} strokeWidth={2.5} />, group: 'active' };
    case 'PAYMENT_HELD':
      return { label: 'Payment held', colour: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', icon: <CheckCircle2 size={11} strokeWidth={2.5} />, group: 'active' };
    // Legacy courier flow
    case 'AWAITING_SHIPMENT_BOOKING':
      return { label: 'Waiting for seller to ship', colour: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', icon: <Clock size={11} strokeWidth={2.5} />, group: 'active' };
    case 'SHIPMENT_BOOKED':
      return { label: 'Shipment booked', colour: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200', icon: <Truck size={11} strokeWidth={2.5} />, group: 'active' };
    case 'SHIPPED':
      return { label: 'Shipped', colour: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200', icon: <Truck size={11} strokeWidth={2.5} />, group: 'active' };
    case 'IN_TRANSIT':
      return { label: 'In transit', colour: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', icon: <Truck size={11} strokeWidth={2.5} />, group: 'active' };
    case 'OUT_FOR_DELIVERY':
      return { label: 'Out for delivery', colour: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', icon: <Truck size={11} strokeWidth={2.5} />, group: 'active' };
    case 'DELIVERED':
      return { label: 'Delivered — confirm receipt', colour: 'text-green-700', bg: 'bg-green-50', border: 'border-green-300', icon: <CheckCircle2 size={11} strokeWidth={2.5} />, group: 'active' };
    // Terminal
    case 'COMPLETED':
      return { label: 'Completed', colour: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', icon: <CheckCircle2 size={11} strokeWidth={2.5} />, group: 'completed' };
    case 'DISPUTED':
      return { label: 'Disputed', colour: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: <AlertTriangle size={11} strokeWidth={2.5} />, group: 'active' };
    case 'RESOLVED_REFUND':
      return { label: 'Refunded', colour: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', icon: <CheckCircle2 size={11} strokeWidth={2.5} />, group: 'completed' };
    case 'RESOLVED_RELEASED':
      return { label: 'Resolved', colour: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', icon: <CheckCircle2 size={11} strokeWidth={2.5} />, group: 'completed' };
    case 'AUTO_CANCELLED':
      return { label: 'Auto-cancelled', colour: 'text-[#979797]', bg: 'bg-[#f4f4f4]', border: 'border-[#dedede]', icon: <XCircle size={11} strokeWidth={2.5} />, group: 'completed' };
    case 'CANCELLED':
      return { label: 'Cancelled', colour: 'text-[#979797]', bg: 'bg-[#f4f4f4]', border: 'border-[#dedede]', icon: <XCircle size={11} strokeWidth={2.5} />, group: 'completed' };
    default:
      return { label: status, colour: 'text-[#979797]', bg: 'bg-[#f4f4f4]', border: 'border-[#dedede]', icon: <Package size={11} strokeWidth={2.5} />, group: 'active' };
  }
}


function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatRands(cents: number) {
  return `R ${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Order card ────────────────────────────────────────────────────────────────

function OrderCard({ order, userId, onClick }: { order: OrderRow; userId: string; onClick: () => void }) {
  const isSeller = order.seller_id === userId;
  const cfg = getStatusConfig(order.status, isSeller);
  const cover = order.listings?.images?.[0] ?? null;
  const title = order.listings?.title ?? 'Item no longer available';
  const shortId = order.id.slice(0, 8).toUpperCase();
  const isDelivered = order.status === 'DELIVERED';

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border border-[#dedede] rounded-2xl p-4 hover:border-[#BE1E2D] hover:shadow-sm transition group"
    >
      <div className="flex gap-4 items-start">

        {/* Thumbnail */}
        <div className="w-16 h-16 rounded-xl bg-[#f4f4f4] overflow-hidden shrink-0 relative">
          {cover ? (
            <Image src={cover} alt={title} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package size={24} strokeWidth={1.5} className="text-[#dedede]" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-[#111] leading-snug line-clamp-2">{title}</p>
            <ChevronRight size={16} strokeWidth={2} className="text-[#dedede] group-hover:text-[#BE1E2D] transition shrink-0 mt-0.5" />
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
            <span className="text-xs text-[#979797]">#{shortId}</span>
            <span className="text-xs text-[#979797]">·</span>
            <span className="text-xs text-[#979797]">{formatDate(order.created_at)}</span>
            <span className="text-xs text-[#979797]">·</span>
            <span className="text-xs font-medium text-[#979797]">{isSeller ? 'Selling' : 'Buying'}</span>
          </div>

          {/* Bottom row: price + status */}
          <div className="flex items-center justify-between mt-2.5 gap-3">
            <span className="text-sm font-bold text-[#111]">{formatRands(order.total_paid_cents)}</span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${cfg.colour} ${cfg.bg} ${cfg.border}`}>
              {cfg.icon}
              {cfg.label}
            </span>
          </div>

          {/* Hub action banners */}
          {order.status === 'AWAITING_DROPOFF' && isSeller && (
            <div className="mt-3 px-3 py-2 bg-orange-50 border border-orange-200 rounded-xl">
              <p className="text-xs text-orange-700 font-semibold">📦 Bring item to a Klerebank hub within 3 business days.</p>
            </div>
          )}
          {order.status === 'ITEM_AT_HUB' && !isSeller && (
            <div className="mt-3 px-3 py-2 bg-green-50 border border-green-200 rounded-xl">
              <p className="text-xs text-green-700 font-semibold">🎉 Your item is at the hub — open order to get your collection QR.</p>
            </div>
          )}
          {isDelivered && !isSeller && (
            <div className="mt-3 px-3 py-2 bg-green-50 border border-green-200 rounded-xl">
              <p className="text-xs text-green-700 font-semibold">
                Item arrived? Tap to confirm receipt and release payment to seller.
              </p>
            </div>
          )}

          {/* Waybill if available */}
          {order.waybill_number && (
            <p className="mt-1.5 text-xs text-[#979797]">
              Waybill: <span className="font-mono text-[#555]">{order.waybill_number}</span>
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const router = useRouter();
  const [orders,  setOrders]  = useState<OrderRow[]>([]);
  const [userId,  setUserId]  = useState('');
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<TabFilter>('all');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/'); return; }
      setUserId(user.id);

      const { data } = await supabase
        .from('orders')
        .select(`
          id, status, buyer_id, seller_id,
          item_price_cents, shipping_cost_cents, total_paid_cents,
          shipping_method, service_level_code,
          created_at, estimated_delivery, waybill_number,
          listings ( title, images )
        `)
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      setOrders((data ?? []) as unknown as OrderRow[]);
      setLoading(false);
    }
    load();
  }, [router]);

  const activeCount    = orders.filter(o => getStatusConfig(o.status, o.seller_id === userId).group === 'active').length;
  const completedCount = orders.filter(o => getStatusConfig(o.status, o.seller_id === userId).group === 'completed').length;

  const displayed = tab === 'all'
    ? orders
    : orders.filter(o => getStatusConfig(o.status, o.seller_id === userId).group === tab);

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#dedede] border-t-[#BE1E2D] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#111]">Orders</h1>
          <p className="text-sm text-[#979797] mt-1">Items you&apos;re buying and selling on NextKid.</p>
        </div>

        {/* Summary pills */}
        {orders.length > 0 && (
          <div className="flex gap-3 mb-6">
            <div className="flex items-center gap-2 px-4 py-2 bg-[#f4f4f4] rounded-full">
              <ShoppingBag size={14} strokeWidth={2} className="text-[#BE1E2D]" />
              <span className="text-sm font-semibold text-[#111]">{orders.length} total</span>
            </div>
            {activeCount > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-full">
                <Truck size={14} strokeWidth={2} className="text-blue-600" />
                <span className="text-sm font-semibold text-blue-700">{activeCount} active</span>
              </div>
            )}
            {completedCount > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-full">
                <CheckCircle2 size={14} strokeWidth={2} className="text-green-600" />
                <span className="text-sm font-semibold text-green-700">{completedCount} completed</span>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        {orders.length > 0 && (
          <div className="flex border-b border-[#dedede] mb-6">
            {([
              ['all',       `All (${orders.length})`],
              ['active',    `Active (${activeCount})`],
              ['completed', `Completed (${completedCount})`],
            ] as [TabFilter, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`relative px-5 py-3 text-sm font-medium transition ${tab === key ? 'text-[#111]' : 'text-[#979797] hover:text-[#111]'}`}
              >
                {label}
                {tab === key && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#BE1E2D] rounded-full" />}
              </button>
            ))}
          </div>
        )}

        {/* Order list */}
        {displayed.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-[#f4f4f4] flex items-center justify-center mx-auto mb-5">
              <ShoppingBag size={28} strokeWidth={1.5} className="text-[#dedede]" />
            </div>
            <p className="text-[#111] font-semibold text-base">
              {tab === 'active' ? 'No active orders' : tab === 'completed' ? 'No completed orders yet' : 'No orders yet'}
            </p>
            <p className="text-[#979797] text-sm mt-1.5 max-w-xs mx-auto">
              {tab === 'all' ? 'Items you buy will appear here with live tracking.' : 'Check back once your orders progress.'}
            </p>
            {tab === 'all' && (
              <button
                onClick={() => router.push('/browse')}
                className="mt-5 px-6 py-2.5 bg-[#BE1E2D] text-white rounded-full text-sm font-semibold hover:bg-[#9B1824] transition"
              >
                Browse items
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                userId={userId}
                onClick={() => router.push(`/orders/${order.id}`)}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}