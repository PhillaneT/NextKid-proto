'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, Clock, Banknote, AlertTriangle, RefreshCw } from 'lucide-react';

type BankRow = {
  id: string;
  seller_id: string;
  account_holder_name: string;
  bank_name: string;
  account_number: string;
  branch_code: string;
  account_type: string;
  verified: boolean;
  updated_at: string;
  profiles: { full_name: string | null; email: string | null } | null;
};

type PayoutRow = {
  id: string;
  order_id: string;
  seller_id: string;
  amount_cents: number;
  status: string;
  held_reason: string | null;
  paid_at: string | null;
  reference: string | null;
  bank_snapshot: Record<string, string> | null;
  created_at: string;
  profiles: { full_name: string | null; email: string | null } | null;
  orders: { listings: { title: string } | null } | null;
};

type Tab = 'verify' | 'pending' | 'held' | 'paid';

function fmt(cents: number) {
  return `R ${(cents / 100).toFixed(2)}`;
}

export default function AdminPayoutsPage() {
  const router = useRouter();
  const [tab, setTab]           = useState<Tab>('verify');
  const [bankRows, setBankRows] = useState<BankRow[]>([]);
  const [payouts, setPayouts]   = useState<PayoutRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [paying, setPaying]     = useState<string | null>(null);
  const [refInput, setRefInput] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/'); return; }

    // Check admin role
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', session.user.id).single();
    if (profile?.role !== 'admin') { router.push('/dashboard'); return; }

    // Load unverified bank details
    const { data: banks } = await supabase
      .from('seller_bank_details')
      .select('*, profiles!seller_id(full_name, email)')
      .order('updated_at', { ascending: false });
    setBankRows((banks ?? []) as unknown as BankRow[]);

    // Load payouts for current tab
    const statusMap: Record<Tab, string> = { verify: 'pending', pending: 'pending', held: 'held', paid: 'paid' };
    const res = await fetch(`/api/admin/payouts?status=${statusMap[tab] ?? tab}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) {
      const json = await res.json();
      setPayouts(json.payouts ?? []);
    }
    setLoading(false);
  }, [router, tab]);

  useEffect(() => { load(); }, [load]);

  async function handleVerify(bankId: string, sellerId: string, approve: boolean) {
    setVerifying(bankId);
    const { error } = await supabase
      .from('seller_bank_details')
      .update({ verified: approve })
      .eq('id', bankId);
    if (!error) {
      setBankRows(prev => prev.map(b => b.id === bankId ? { ...b, verified: approve } : b));
      // If approving, move any held payouts for this seller to pending
      if (approve) {
        await supabase.from('seller_payouts')
          .update({ status: 'pending', held_reason: null })
          .eq('seller_id', sellerId).eq('status', 'held');
      }
    }
    setVerifying(null);
  }

  async function handlePay(payoutId: string) {
    setPaying(payoutId);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch(`/api/admin/payouts/${payoutId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ reference: refInput[payoutId] ?? '' }),
    });
    if (res.ok) {
      setPayouts(prev => prev.filter(p => p.id !== payoutId));
    }
    setPaying(null);
  }

  const unverifiedBanks = bankRows.filter(b => !b.verified);
  const verifiedBanks   = bankRows.filter(b => b.verified);

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'verify',  label: `Verify Banks (${unverifiedBanks.length})` },
    { key: 'pending', label: 'Pending Payouts' },
    { key: 'held',    label: 'Held' },
    { key: 'paid',    label: 'Paid History' },
  ];

  return (
    <div className="min-h-screen bg-[#f4f4f4]">
      <div className="max-w-4xl mx-auto px-6 py-10">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#111]">Seller Payouts</h1>
            <p className="text-sm text-[#979797] mt-1">Verify bank details and pay out sellers</p>
          </div>
          <button onClick={load} className="flex items-center gap-2 text-sm text-[#979797] hover:text-[#111]">
            <RefreshCw size={14} strokeWidth={2} /> Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#dedede] mb-6 bg-white rounded-t-2xl overflow-hidden">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-5 py-3.5 text-sm font-medium transition ${tab === t.key ? 'text-[#BE1E2D] border-b-2 border-[#BE1E2D]' : 'text-[#979797] hover:text-[#111]'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-[#979797]">Loading...</div>
        ) : (
          <>
            {/* ── Verify Bank Details ── */}
            {tab === 'verify' && (
              <div className="space-y-4">
                {unverifiedBanks.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 text-center">
                    <CheckCircle2 size={36} className="text-green-400 mx-auto mb-3" strokeWidth={1.5} />
                    <p className="text-[#111] font-semibold">All bank details verified</p>
                    <p className="text-sm text-[#979797] mt-1">No pending verifications</p>
                  </div>
                ) : unverifiedBanks.map(b => (
                  <div key={b.id} className="bg-white rounded-2xl p-5 border border-amber-200 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-[#111]">{b.profiles?.full_name ?? 'Unknown'}</p>
                        <p className="text-xs text-[#979797]">{b.profiles?.email}</p>
                      </div>
                      <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-full">
                        ⏳ Awaiting verification
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm bg-[#f4f4f4] rounded-xl p-3">
                      <div><span className="text-[#979797]">Name: </span><span className="font-medium">{b.account_holder_name}</span></div>
                      <div><span className="text-[#979797]">Bank: </span><span className="font-medium">{b.bank_name}</span></div>
                      <div><span className="text-[#979797]">Account: </span><span className="font-medium font-mono">{b.account_number}</span></div>
                      <div><span className="text-[#979797]">Branch: </span><span className="font-medium font-mono">{b.branch_code}</span></div>
                      <div><span className="text-[#979797]">Type: </span><span className="font-medium capitalize">{b.account_type}</span></div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => handleVerify(b.id, b.seller_id, false)}
                        disabled={verifying === b.id}
                        className="flex-1 py-2.5 border border-red-300 text-red-500 hover:bg-red-50 rounded-full text-sm font-medium transition">
                        ✗ Reject
                      </button>
                      <button onClick={() => handleVerify(b.id, b.seller_id, true)}
                        disabled={verifying === b.id}
                        className="flex-2 flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-full text-sm font-semibold transition">
                        {verifying === b.id ? 'Verifying…' : '✓ Verify & Approve'}
                      </button>
                    </div>
                  </div>
                ))}

                {/* Already verified */}
                {verifiedBanks.length > 0 && (
                  <div className="mt-6">
                    <p className="text-xs font-semibold text-[#979797] uppercase tracking-wide mb-3">Already verified ({verifiedBanks.length})</p>
                    <div className="space-y-2">
                      {verifiedBanks.map(b => (
                        <div key={b.id} className="bg-white rounded-xl px-4 py-3 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-[#111]">{b.profiles?.full_name}</p>
                            <p className="text-xs text-[#979797]">{b.bank_name} · ****{b.account_number.slice(-4)}</p>
                          </div>
                          <CheckCircle2 size={16} className="text-green-500" strokeWidth={2} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Pending / Held Payouts ── */}
            {(tab === 'pending' || tab === 'held') && (
              <div className="space-y-4">
                {payouts.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 text-center">
                    <Banknote size={36} className="text-[#dedede] mx-auto mb-3" strokeWidth={1.5} />
                    <p className="text-[#111] font-semibold">No {tab} payouts</p>
                  </div>
                ) : payouts.map(p => (
                  <div key={p.id} className="bg-white rounded-2xl p-5 border border-[#dedede] space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-[#111]">{p.profiles?.full_name ?? 'Unknown seller'}</p>
                        <p className="text-xs text-[#979797]">{p.profiles?.email}</p>
                        <p className="text-xs text-[#979797] mt-0.5">{p.orders?.listings?.title ?? 'Item'}</p>
                      </div>
                      <p className="text-lg font-bold text-[#BE1E2D]">{fmt(p.amount_cents)}</p>
                    </div>

                    {p.bank_snapshot ? (
                      <div className="text-sm bg-[#f4f4f4] rounded-xl p-3 space-y-1">
                        <p><span className="text-[#979797]">Bank: </span>{p.bank_snapshot.bank_name}</p>
                        <p><span className="text-[#979797]">Account: </span><span className="font-mono">{p.bank_snapshot.account_number}</span></p>
                        <p><span className="text-[#979797]">Branch: </span><span className="font-mono">{p.bank_snapshot.branch_code}</span></p>
                        <p><span className="text-[#979797]">Name: </span>{p.bank_snapshot.account_holder_name}</p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 rounded-xl p-3">
                        <AlertTriangle size={14} strokeWidth={2} />
                        {p.held_reason === 'no_verified_bank_details'
                          ? 'Seller has not added verified bank details yet'
                          : p.held_reason ?? 'Held — no bank details'}
                      </div>
                    )}

                    {tab === 'pending' && p.bank_snapshot && (
                      <div className="flex gap-2">
                        <input
                          value={refInput[p.id] ?? ''}
                          onChange={e => setRefInput(prev => ({ ...prev, [p.id]: e.target.value }))}
                          placeholder="EFT reference (optional)"
                          className="flex-1 bg-[#f4f4f4] border border-[#dedede] rounded-full px-4 py-2 text-sm focus:outline-none focus:border-[#BE1E2D]"
                        />
                        <button onClick={() => handlePay(p.id)} disabled={paying === p.id}
                          className="px-6 py-2 bg-[#BE1E2D] hover:bg-[#9B1824] disabled:bg-[#dedede] text-white rounded-full text-sm font-semibold transition">
                          {paying === p.id ? 'Marking…' : 'Mark as paid'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── Paid History ── */}
            {tab === 'paid' && (
              <div className="space-y-3">
                {payouts.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 text-center">
                    <Clock size={36} className="text-[#dedede] mx-auto mb-3" strokeWidth={1.5} />
                    <p className="text-[#111] font-semibold">No paid payouts yet</p>
                  </div>
                ) : payouts.map(p => (
                  <div key={p.id} className="bg-white rounded-xl px-5 py-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#111]">{p.profiles?.full_name}</p>
                      <p className="text-xs text-[#979797]">{p.orders?.listings?.title}</p>
                      {p.reference && <p className="text-xs text-[#979797]">Ref: {p.reference}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">{fmt(p.amount_cents)}</p>
                      <p className="text-xs text-[#979797]">{p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-ZA') : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
