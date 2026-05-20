'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, XCircle, Clock, School, Mail, Phone, UserPlus, Building2 } from 'lucide-react';

type Application = {
  id: string;
  name: string;
  city_name: string;
  province_code: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  klerebank_status: string;
  applied_at: string | null;
  approved_at: string | null;
  referral_code: string | null;
};

type SchoolAdmin = {
  id: string;
  user_id: string;
  active: boolean;
  invited_at: string;
  accepted_at: string | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

const STATUS_COLOURS: Record<string, string> = {
  pending:  'bg-amber-50 text-amber-700 border-amber-200',
  active:   'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
};

function fmt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminSchoolsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selected, setSelected]         = useState<Application | null>(null);
  const [admins, setAdmins]             = useState<SchoolAdmin[]>([]);
  const [inviteEmail, setInviteEmail]   = useState('');
  const [inviting, setInviting]         = useState(false);
  const [actioning, setActioning]       = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectBox, setShowRejectBox] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/'); return; }
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (prof?.role !== 'super_admin' && prof?.role !== 'admin') {
        router.push('/dashboard'); return;
      }
      loadApplications();
    });
  }, []);

  async function loadApplications() {
    const { data } = await supabase
      .from('schools')
      .select('id, name, city_name, province_code, contact_name, contact_email, contact_phone, klerebank_status, applied_at, approved_at, referral_code')
      .not('klerebank_status', 'is', null)
      .order('applied_at', { ascending: false });
    setApplications((data ?? []) as Application[]);
    setLoading(false);
  }

  async function loadAdmins(schoolId: string) {
    const { data } = await supabase
      .from('school_admins')
      .select('id, user_id, active, invited_at, accepted_at, profiles(full_name, email)')
      .eq('school_id', schoolId);
    setAdmins((data ?? []) as unknown as SchoolAdmin[]);
  }

  async function selectSchool(app: Application) {
    setSelected(app);
    setShowRejectBox(false);
    setRejectionReason('');
    await loadAdmins(app.id);
  }

  async function approve() {
    if (!selected) return;
    setActioning(true);
    const { data: { session } } = await supabase.auth.getSession();
    await fetch(`/api/schools/${selected.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` },
      body: JSON.stringify({ action: 'approve' }),
    });
    await loadApplications();
    setSelected(prev => prev ? { ...prev, klerebank_status: 'active' } : null);
    setActioning(false);
  }

  async function reject() {
    if (!selected || !rejectionReason) return;
    setActioning(true);
    const { data: { session } } = await supabase.auth.getSession();
    await fetch(`/api/schools/${selected.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` },
      body: JSON.stringify({ action: 'reject', reason: rejectionReason }),
    });
    await loadApplications();
    setSelected(prev => prev ? { ...prev, klerebank_status: 'rejected' } : null);
    setShowRejectBox(false);
    setActioning(false);
  }

  async function inviteAdmin() {
    if (!selected || !inviteEmail.trim()) return;
    setInviting(true);
    const { data: { session } } = await supabase.auth.getSession();
    await fetch(`/api/schools/${selected.id}/admins/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` },
      body: JSON.stringify({ email: inviteEmail.trim() }),
    });
    setInviteEmail('');
    await loadAdmins(selected.id);
    setInviting(false);
  }

  const pending  = applications.filter(a => a.klerebank_status === 'pending');
  const active   = applications.filter(a => a.klerebank_status === 'active');
  const rejected = applications.filter(a => a.klerebank_status === 'rejected');

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#dedede] border-t-[#BE1E2D] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f4f4f4]">
      <div className="max-w-6xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-[#BE1E2D] text-sm font-medium mb-2">
            <Building2 size={15} strokeWidth={2} /> Praesignis Admin
          </div>
          <h1 className="text-2xl font-bold text-[#111]">Klerebank Applications</h1>
          <div className="flex gap-4 mt-3 text-sm">
            <span className="text-amber-600 font-semibold">{pending.length} pending</span>
            <span className="text-green-600 font-semibold">{active.length} active</span>
            <span className="text-[#979797]">{rejected.length} rejected</span>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-6">

          {/* Application list */}
          <div className="col-span-2 space-y-3">
            {applications.length === 0 && (
              <div className="bg-white rounded-2xl p-8 text-center">
                <School size={36} strokeWidth={1.5} className="text-[#dedede] mx-auto mb-3" />
                <p className="text-[#979797]">No applications yet</p>
              </div>
            )}
            {applications.map(app => (
              <button key={app.id} onClick={() => selectSchool(app)}
                className={`w-full text-left bg-white rounded-2xl p-4 border transition ${
                  selected?.id === app.id ? 'border-[#BE1E2D] shadow-sm' : 'border-[#dedede] hover:border-[#BE1E2D]/50'
                }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#111] truncate">{app.name}</p>
                    <p className="text-xs text-[#979797] mt-0.5">{app.city_name} · {fmt(app.applied_at)}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0 ${STATUS_COLOURS[app.klerebank_status] ?? ''}`}>
                    {app.klerebank_status}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Detail panel */}
          <div className="col-span-3">
            {!selected ? (
              <div className="bg-white rounded-2xl p-10 text-center border border-[#dedede]">
                <School size={40} strokeWidth={1.5} className="text-[#dedede] mx-auto mb-4" />
                <p className="text-[#979797]">Select an application to review</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#dedede] overflow-hidden">
                {/* School header */}
                <div className="px-6 py-5 border-b border-[#dedede]">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-[#111]">{selected.name}</h2>
                      <p className="text-sm text-[#979797] mt-0.5">{selected.city_name} · {selected.province_code}</p>
                    </div>
                    <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${STATUS_COLOURS[selected.klerebank_status] ?? ''}`}>
                      {selected.klerebank_status}
                    </span>
                  </div>
                </div>

                {/* Contact info */}
                <div className="px-6 py-5 border-b border-[#dedede] space-y-2">
                  <p className="text-xs font-semibold text-[#979797] uppercase tracking-wide mb-3">Contact</p>
                  <div className="flex items-center gap-2 text-sm">
                    <School size={14} strokeWidth={2} className="text-[#979797]" />
                    <span className="text-[#111]">{selected.contact_name ?? '—'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail size={14} strokeWidth={2} className="text-[#979797]" />
                    <span className="text-[#111]">{selected.contact_email ?? '—'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone size={14} strokeWidth={2} className="text-[#979797]" />
                    <span className="text-[#111]">{selected.contact_phone ?? '—'}</span>
                  </div>
                  {selected.referral_code && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-[#979797]">Referral code:</span>
                      <span className="font-mono font-semibold text-[#BE1E2D]">{selected.referral_code}</span>
                    </div>
                  )}
                </div>

                {/* Approve / Reject */}
                {selected.klerebank_status === 'pending' && (
                  <div className="px-6 py-5 border-b border-[#dedede] space-y-3">
                    <p className="text-xs font-semibold text-[#979797] uppercase tracking-wide">Decision</p>
                    <div className="flex gap-3">
                      <button onClick={approve} disabled={actioning}
                        className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-full text-sm font-semibold transition disabled:opacity-60">
                        <CheckCircle2 size={14} /> Approve
                      </button>
                      <button onClick={() => setShowRejectBox(v => !v)} disabled={actioning}
                        className="flex items-center gap-2 px-5 py-2.5 border border-red-300 text-red-600 hover:bg-red-50 rounded-full text-sm font-semibold transition">
                        <XCircle size={14} /> Reject
                      </button>
                    </div>
                    {showRejectBox && (
                      <div className="space-y-2">
                        <textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)}
                          placeholder="Reason for rejection (sent to applicant)..."
                          className="w-full border border-[#dedede] rounded-xl px-4 py-3 text-sm resize-none h-20 focus:outline-none focus:border-red-400" />
                        <button onClick={reject} disabled={!rejectionReason || actioning}
                          className="px-5 py-2 bg-red-500 text-white rounded-full text-sm font-semibold disabled:opacity-50">
                          Confirm rejection
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Invite Klerebank Admins */}
                {selected.klerebank_status === 'active' && (
                  <div className="px-6 py-5 border-b border-[#dedede] space-y-4">
                    <p className="text-xs font-semibold text-[#979797] uppercase tracking-wide">Klerebank Admins</p>

                    {admins.length > 0 && (
                      <div className="space-y-2">
                        {admins.map(a => (
                          <div key={a.id} className="flex items-center justify-between py-2">
                            <div>
                              <p className="text-sm font-medium text-[#111]">{(a.profiles as any)?.full_name ?? (a.profiles as any)?.email ?? 'Invited user'}</p>
                              <p className="text-xs text-[#979797]">{a.active ? 'Active' : 'Invite pending'} · {fmt(a.invited_at)}</p>
                            </div>
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${a.active ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                              {a.active ? 'Active' : 'Pending'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                        placeholder="admin@school.co.za" type="email"
                        className="flex-1 bg-[#f4f4f4] border border-[#dedede] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#BE1E2D] transition" />
                      <button onClick={inviteAdmin} disabled={!inviteEmail || inviting}
                        className="flex items-center gap-2 px-4 py-2.5 bg-[#BE1E2D] disabled:bg-[#dedede] text-white rounded-xl text-sm font-semibold transition">
                        <UserPlus size={14} />
                        {inviting ? 'Sending...' : 'Invite'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="px-6 py-4 text-xs text-[#979797]">
                  Applied {fmt(selected.applied_at)}
                  {selected.approved_at && ` · Approved ${fmt(selected.approved_at)}`}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
