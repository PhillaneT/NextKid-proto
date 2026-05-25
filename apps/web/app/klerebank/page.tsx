'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Package, CheckCircle2, Clock,
  ScanLine, Banknote, RefreshCw, ArrowRight,
  Share2, Copy, CheckCheck, TrendingUp, Users, AlertTriangle,
} from 'lucide-react';

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

type LedgerData = {
  monthName:       string;
  nextPayoutDate:  string;
  daysToPayday:    number;
  balance: {
    directCents:     number;
    referralCents:   number;
    grandTotalCents: number;
    status:          string;
  };
  bank: { bankName: string; accountHolderName: string; verified: boolean } | null;
  recentEntries: { eventType: string; amountCents: number; waybillNumber: string | null; createdAt: string }[];
  previousPayouts: { month: string; amountCents: number; status: string; processedAt: string | null }[];
};

type ReferralData = {
  referralCode:  string | null;
  referralLink:  string | null;
  tier: {
    name:        string;
    emoji:       string;
    directCount: number;
    nextTier:    string | null;
    toNextTier:  number;
  };
  earnings: {
    totalCents:     number;
    thisMonthCents: number;
    recentEvents:   { level: number; amountCents: number; waybill: string; createdAt: string }[];
  };
  referredSchools: { id: string; name: string; city: string; status: string }[];
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

const TIER_COLOURS: Record<string, { bg: string; text: string; bar: string }> = {
  Seedling: { bg: 'bg-green-500/10',  text: 'text-green-400',  bar: 'bg-green-500' },
  Grove:    { bg: 'bg-emerald-500/10', text: 'text-emerald-400', bar: 'bg-emerald-500' },
  Campus:   { bg: 'bg-blue-500/10',   text: 'text-blue-400',   bar: 'bg-blue-500' },
  District: { bg: 'bg-purple-500/10', text: 'text-purple-400', bar: 'bg-purple-500' },
};


function PayoutSection({ ledger }: { ledger: LedgerData }) {
  const bankOk      = ledger.bank?.verified === true;
  const nextDate    = new Date(ledger.nextPayoutDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long' });
  const eventLabel  = (t: string) => t === 'dropoff' ? 'Drop-off' : t === 'collection' ? 'Collection' : 'Delivery';

  return (
    <div className="space-y-4">
      {/* Monthly balance */}
      <div className="bg-white/5 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Banknote size={15} className="text-[#BE1E2D]" />
          <span className="text-white text-sm font-semibold">{ledger.monthName} balance</span>
        </div>
        <p className="text-white text-3xl font-bold mb-1">{fmtRands(ledger.balance.grandTotalCents)}</p>
        <div className="flex gap-4 text-xs text-white/40">
          <span>Waybill fees {fmtRands(ledger.balance.directCents)}</span>
          {ledger.balance.referralCents > 0 && <span>Referrals {fmtRands(ledger.balance.referralCents)}</span>}
        </div>
      </div>

      {/* Bank + payout date */}
      <div className={`rounded-2xl p-5 ${bankOk ? 'bg-green-500/10' : 'bg-amber-500/10'}`}>
        <div className="flex items-start gap-3">
          {bankOk
            ? <CheckCircle2 size={16} className="text-green-400 mt-0.5 shrink-0" />
            : <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />}
          <div className="flex-1 min-w-0">
            {bankOk ? (
              <>
                <p className="text-green-400 text-sm font-semibold">Bank details on file</p>
                <p className="text-white/50 text-xs mt-0.5">{ledger.bank!.bankName} · {ledger.bank!.accountHolderName}</p>
              </>
            ) : (
              <>
                <p className="text-amber-400 text-sm font-semibold">Bank details missing</p>
                <p className="text-white/50 text-xs mt-0.5">Your {ledger.monthName} balance will be held until verified bank details are on file.</p>
              </>
            )}
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
          <span className="text-white/40 text-xs">Next payout</span>
          <span className="text-white text-xs font-semibold">{nextDate} · {ledger.daysToPayday}d away</span>
        </div>
      </div>

      {/* Recent waybill entries */}
      {ledger.recentEntries.length > 0 && (
        <div className="bg-white/5 rounded-2xl overflow-hidden">
          <p className="px-5 pt-4 pb-2 text-white/30 text-xs uppercase tracking-widest">Recent entries</p>
          {ledger.recentEntries.slice(0, 8).map((e, i) => (
            <div key={i} className="flex items-center px-5 py-3 border-b border-white/5 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-white/70 text-xs">{eventLabel(e.eventType)}</p>
                {e.waybillNumber && <p className="text-white/40 text-xs font-mono">{e.waybillNumber}</p>}
              </div>
              <span className="text-green-400 text-xs font-bold">+{fmtRands(e.amountCents)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Previous payouts */}
      {ledger.previousPayouts.length > 0 && (
        <div className="bg-white/5 rounded-2xl overflow-hidden">
          <p className="px-5 pt-4 pb-2 text-white/30 text-xs uppercase tracking-widest">Previous payouts</p>
          {ledger.previousPayouts.map((p, i) => (
            <div key={i} className="flex items-center px-5 py-3 border-b border-white/5 last:border-0">
              <div className="flex-1">
                <p className="text-white/70 text-xs">{p.month}</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mr-3 ${
                p.status === 'paid' ? 'bg-green-500/20 text-green-400' :
                p.status === 'held' ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-white/40'
              }`}>{p.status}</span>
              <span className="text-white text-xs font-bold">{fmtRands(p.amountCents)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReferralCard({ data, ledger }: { data: ReferralData; ledger?: LedgerData | null }) {
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const colours = TIER_COLOURS[data.tier.name] ?? TIER_COLOURS.Seedling;
  const current = data.tier.directCount;
  const pct     = data.tier.nextTier ? Math.min(100, (current / (current + data.tier.toNextTier)) * 100) : 100;

  async function copyCode() {
    if (!data.referralCode) return;
    await navigator.clipboard.writeText(data.referralCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  async function copyLink() {
    if (!data.referralLink) return;
    await navigator.clipboard.writeText(data.referralLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  return (
    <div className="space-y-4">

      {/* Payout & balance — shown when ledger data available */}
      {ledger && <PayoutSection ledger={ledger} />}

      {/* Tier badge + progress */}
      <div className={`${colours.bg} rounded-2xl p-5`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Your tier</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{data.tier.emoji}</span>
              <span className={`text-xl font-bold ${colours.text}`}>{data.tier.name}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Direct referrals</p>
            <p className={`text-2xl font-bold ${colours.text}`}>{current}</p>
          </div>
        </div>

        {data.tier.nextTier ? (
          <>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
              <div className={`h-full ${colours.bar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
            </div>
            <p className="text-white/40 text-xs">
              {data.tier.toNextTier} more school{data.tier.toNextTier !== 1 ? 's' : ''} to reach <span className="text-white/70 font-semibold">{data.tier.nextTier}</span>
            </p>
          </>
        ) : (
          <p className={`text-xs font-semibold ${colours.text}`}>Maximum tier reached — you are a legend!</p>
        )}
      </div>

      {/* Referral earnings */}
      <div className="bg-white/5 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={15} className="text-[#BE1E2D]" />
          <span className="text-white text-sm font-semibold">Referral earnings</span>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-white/40 text-xs uppercase tracking-widest mb-1">This month</p>
            <p className="text-white text-xl font-bold">{fmtRands(data.earnings.thisMonthCents)}</p>
          </div>
          <div>
            <p className="text-white/40 text-xs uppercase tracking-widest mb-1">All time</p>
            <p className="text-white text-xl font-bold">{fmtRands(data.earnings.totalCents)}</p>
          </div>
        </div>

        {data.earnings.recentEvents.length > 0 && (
          <div className="space-y-2">
            <p className="text-white/30 text-xs uppercase tracking-widest">Recent</p>
            {data.earnings.recentEvents.slice(0, 5).map((e, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-white/30 text-xs">L{e.level}</span>
                  <span className="text-white/50 text-xs font-mono">{e.waybill}</span>
                </div>
                <span className="text-green-400 text-xs font-bold">+{fmtRands(e.amountCents)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Share your code */}
      {data.referralCode && (
        <div className="bg-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Share2 size={15} className="text-[#BE1E2D]" />
            <span className="text-white text-sm font-semibold">Grow your network</span>
          </div>
          <p className="text-white/40 text-xs mb-3">
            When a school you refer closes a waybill, you earn R2. When their referral closes one, you earn R0.50.
          </p>

          {/* Code */}
          <div className="mb-3">
            <p className="text-white/30 text-xs uppercase tracking-widest mb-1.5">Your referral code</p>
            <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-3">
              <span className="flex-1 font-mono font-bold text-white tracking-widest text-sm">{data.referralCode}</span>
              <button onClick={copyCode}
                className="text-white/60 hover:text-white transition flex items-center gap-1 text-xs">
                {codeCopied ? <><CheckCheck size={13} className="text-green-400" /> Copied</> : <><Copy size={13} /> Copy</>}
              </button>
            </div>
          </div>

          {/* Link */}
          {data.referralLink && (
            <div>
              <p className="text-white/30 text-xs uppercase tracking-widest mb-1.5">Shareable link</p>
              <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-3">
                <span className="flex-1 text-white/60 text-xs truncate">{data.referralLink}</span>
                <button onClick={copyLink}
                  className="text-white/60 hover:text-white transition flex items-center gap-1 text-xs shrink-0">
                  {linkCopied ? <><CheckCheck size={13} className="text-green-400" /> Copied</> : <><Copy size={13} /> Copy</>}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Referred schools */}
      {data.referredSchools.length > 0 && (
        <div className="bg-white/5 rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/10 flex items-center gap-2">
            <Users size={15} className="text-[#BE1E2D]" />
            <span className="text-white text-sm font-semibold">Schools in your network</span>
            <span className="ml-auto text-white/30 text-xs">{data.referredSchools.length}</span>
          </div>
          {data.referredSchools.slice(0, 8).map(s => (
            <div key={s.id} className="flex items-center px-5 py-3.5 border-b border-white/5 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{s.name}</p>
                <p className="text-white/30 text-xs">{s.city}</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                s.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/40'
              }`}>
                {s.status === 'active' ? 'Active' : 'Pending'}
              </span>
            </div>
          ))}
          {data.referredSchools.length > 8 && (
            <div className="px-5 py-3 text-center text-white/30 text-xs">
              +{data.referredSchools.length - 8} more schools
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function KlerebankDashboardPage() {
  const router = useRouter();
  const [data,         setData]         = useState<Dashboard | null>(null);
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [ledgerData,   setLedgerData]   = useState<LedgerData | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [lastSync,     setLastSync]     = useState<Date>(new Date());
  const [activeTab,    setActiveTab]    = useState<'operations' | 'referrals'>('operations');

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/'); return; }

    const token   = session.access_token;
    const headers = { Authorization: `Bearer ${token}` };

    const [dashRes, refRes, ledgerRes] = await Promise.all([
      fetch('/api/klerebank/dashboard', { headers }),
      fetch('/api/klerebank/referrals',  { headers }),
      fetch('/api/klerebank/ledger',     { headers }),
    ]);

    if (dashRes.status === 403) { router.push('/dashboard'); return; }
    if (!dashRes.ok) { setError('Failed to load dashboard'); setLoading(false); return; }

    const [dashJson, refJson, ledgerJson] = await Promise.all([
      dashRes.json(),
      refRes.ok    ? refRes.json()    : null,
      ledgerRes.ok ? ledgerRes.json() : null,
    ]);
    setData(dashJson);
    if (refJson)    setReferralData(refJson);
    if (ledgerJson) setLedgerData(ledgerJson);
    setLastSync(new Date());
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

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
            { label: 'This month', value: fmtRands(ledgerData?.balance.grandTotalCents ?? data.earningsThisMonth), icon: <Banknote size={16} className="text-[#BE1E2D]" />, bg: 'bg-[#BE1E2D]/10' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-2xl p-3.5 text-center`}>
              <div className="flex justify-center mb-1.5">{s.icon}</div>
              <p className="text-white font-bold text-lg leading-none">{s.value}</p>
              <p className="text-white/40 text-[10px] mt-1 uppercase tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Scan button */}
        <button
          onClick={() => router.push('/admin/scan' as never)}
          className="w-full flex items-center justify-center gap-3 py-5 bg-[#BE1E2D] hover:bg-[#9B1824] rounded-2xl transition"
        >
          <ScanLine size={22} strokeWidth={2} className="text-white" />
          <span className="text-white font-bold text-lg">Scan QR Code</span>
        </button>

        {/* Tabs */}
        <div className="flex bg-white/5 rounded-xl p-1 gap-1">
          {(['operations', 'referrals'] as const).map(tab => (
            <button key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                activeTab === tab
                  ? 'bg-white text-[#111]'
                  : 'text-white/40 hover:text-white/70'
              }`}>
              {tab === 'operations' ? 'Waybills' : 'Referrals'}
              {tab === 'referrals' && referralData && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab ? 'bg-[#BE1E2D] text-white' : 'bg-white/10 text-white/40'}`}>
                  {referralData.tier.emoji}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Operations tab */}
        {activeTab === 'operations' && (
          <>
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
          </>
        )}

        {/* Referrals tab */}
        {activeTab === 'referrals' && (
          referralData
            ? <ReferralCard data={referralData} ledger={ledgerData} />
            : (
              <div className="bg-white/5 rounded-2xl px-6 py-10 text-center">
                <p className="text-white/40 text-sm">Referral data unavailable</p>
              </div>
            )
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
