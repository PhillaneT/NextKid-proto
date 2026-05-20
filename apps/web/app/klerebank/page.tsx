'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  QrCode, Package, CheckCircle2, Clock, AlertTriangle,
  ScanLine, Banknote, RefreshCw, ArrowRight,
} from 'lucide-react';

const CRIMSON = '#BE1E2D';

type WaybillCard = {
  orderId:      string;
  waybillNumber: string;
  status:       string;
  dueBy:        string | null;
  receivedAt?:  string;
  droppedOffAt?: string;
};

type Dashboard = {
  schoolName:          string;
  cityName:            string;
  incoming:            WaybillCard[];
  atHub:               WaybillCard[];
  completedToday:      number;
  earningsThisMonth:   number;
  collectionsThisMonth: number;
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function fmtRands(cents: number) {
  return `R ${(cents / 100).toFixed(2)}`;
}

function timeUntil(iso: string | null) {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return 'Overdue';
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'Due soon';
  if (h < 24) return `${h}h remaining`;
  return `${Math.floor(h / 24)}d remaining`;
}

function WaybillRow({ card, type }: { card: WaybillCard; type: 'incoming' | 'atHub' }) {
  const isOverdue = type === 'incoming' && card.dueBy && new Date(card.dueBy) < new Date();
  const remaining = type === 'incoming' ? timeUntil(card.dueBy) : null;

  return (
    <div className={`flex items-center gap-4 px-5 py-4 border-b border-[#f4f4f4] last:border-0 ${isOverdue ? 'bg-red-50' : ''}`}>
      <div className={`w-2 h-2 rounded-full shrink-0 ${type === 'incoming' ? (isOverdue ? 'bg-red-500' : 'bg-amber-400') : 'bg-green-500'}`} />
      <div className="flex-1 min-w-0">
        <p className="font-mono font-bold text-[#111] text-sm tracking-wide">{card.waybillNumber}</p>
        <p className="text-xs text-[#979797] mt-0.5">
          {type === 'incoming'
            ? `Expected by ${fmtDate(card.dueBy)}`
            : `Received ${fmtDate(card.droppedOffAt ?? null)}`
          }
        </p>
      </div>
      {remaining && (
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
          isOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-50 text-amber-700'
        }`}>{remaining}</span>
      )}
      {type === 'atHub' && (
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-700">Ready</span>
      )}
    </div>
  );
}

export default function KlerebankDashboardPage() {
  const router = useRouter();
  const [data,     setData]     = useState<Dashboard | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [lastSync, setLastSync] = useState<Date>(new Date());

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/'); return; }

    const res = await fetch('/api/klerebank/dashboard', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (res.status === 403) { router.push('/dashboard'); return; }
    if (!res.ok) { setError('Failed to load dashboard'); setLoading(false); return; }

    setData(await res.json());
    setLastSync(new Date());
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 60 seconds so new waybills appear without manual refresh
  useEffect(() => {
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (loading) return (
    <div className="min-h-screen bg-[#111] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen bg-[#111] flex items-center justify-center px-6">
      <p className="text-white/60">{error || 'Dashboard unavailable'}</p>
    </div>
  );

  const totalActive = data.incoming.length + data.atHub.length;

  return (
    <div className="min-h-screen bg-[#111]">

      {/* Hub Mode header bar */}
      <div className="bg-[#BE1E2D] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span className="text-white text-xs font-bold uppercase tracking-widest">Hub Mode</span>
        </div>
        <button onClick={() => router.push('/dashboard')}
          className="text-white/80 hover:text-white text-xs font-medium transition flex items-center gap-1">
          Switch to marketplace <ArrowRight size={12} />
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-5">

        {/* School identity */}
        <div>
          <h1 className="text-white text-xl font-bold">{data.schoolName}</h1>
          <p className="text-white/50 text-sm">{data.cityName} · Klerebank Hub</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Incoming',   value: data.incoming.length,   icon: <Clock size={16} className="text-amber-400" />,      bg: 'bg-amber-400/10' },
            { label: 'At hub',     value: data.atHub.length,      icon: <Package size={16} className="text-blue-400" />,     bg: 'bg-blue-400/10' },
            { label: 'Done today', value: data.completedToday,    icon: <CheckCircle2 size={16} className="text-green-400" />, bg: 'bg-green-400/10' },
            { label: 'This month', value: fmtRands(data.earningsThisMonth), icon: <Banknote size={16} className="text-[#BE1E2D]" />, bg: 'bg-[#BE1E2D]/10' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-2xl p-3.5 text-center`}>
              <div className="flex justify-center mb-1.5">{s.icon}</div>
              <p className="text-white font-bold text-lg leading-none">{s.value}</p>
              <p className="text-white/40 text-[10px] mt-1 uppercase tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Scan button — the primary action */}
        <button
          onClick={() => router.push('/admin/scan' as never)}
          className="w-full flex items-center justify-center gap-3 py-5 bg-[#BE1E2D] hover:bg-[#9B1824] rounded-2xl transition"
        >
          <ScanLine size={22} strokeWidth={2} className="text-white" />
          <span className="text-white font-bold text-lg">Scan QR Code</span>
        </button>

        {/* Incoming drop-offs */}
        {data.incoming.length > 0 && (
          <div className="bg-white rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#f4f4f4] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={15} strokeWidth={2} className="text-amber-500" />
                <span className="font-semibold text-[#111] text-sm">Expecting drop-offs</span>
              </div>
              <span className="text-xs text-[#979797]">{data.incoming.length} waybill{data.incoming.length !== 1 ? 's' : ''}</span>
            </div>
            {data.incoming.map(c => <WaybillRow key={c.orderId} card={c} type="incoming" />)}
          </div>
        )}

        {/* Items at hub */}
        {data.atHub.length > 0 && (
          <div className="bg-white rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#f4f4f4] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package size={15} strokeWidth={2} className="text-blue-500" />
                <span className="font-semibold text-[#111] text-sm">Held at hub — awaiting collection</span>
              </div>
              <span className="text-xs text-[#979797]">{data.atHub.length} item{data.atHub.length !== 1 ? 's' : ''}</span>
            </div>
            {data.atHub.map(c => <WaybillRow key={c.orderId} card={c} type="atHub" />)}
          </div>
        )}

        {totalActive === 0 && (
          <div className="bg-white/5 rounded-2xl px-6 py-10 text-center">
            <CheckCircle2 size={40} strokeWidth={1.5} className="text-white/20 mx-auto mb-3" />
            <p className="text-white/40 text-sm">All clear — no active waybills</p>
          </div>
        )}

        {/* Last sync + refresh */}
        <div className="flex items-center justify-between text-white/30 text-xs pt-1">
          <span>Last updated {lastSync.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}</span>
          <button onClick={load} className="flex items-center gap-1 hover:text-white/60 transition">
            <RefreshCw size={11} /> Refresh
          </button>
        </div>

      </div>
    </div>
  );
}
