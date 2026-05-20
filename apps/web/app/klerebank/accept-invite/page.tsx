'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';

export default function AcceptInvitePage() {
  const router      = useRouter();
  const params      = useSearchParams();
  const token       = params.get('token') ?? '';
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [school, setSchool] = useState('');

  useEffect(() => {
    if (!token) { setState('error'); return; }

    async function accept() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Not signed in — redirect to login, come back after
        router.push(`/?redirect=/klerebank/accept-invite?token=${token}`);
        return;
      }

      // Find the invite row by token
      const { data: invite, error } = await supabase
        .from('school_admins')
        .select('id, school_id, schools(name)')
        .eq('invite_token', token)
        .eq('user_id', session.user.id)
        .single();

      if (error || !invite) { setState('error'); return; }

      // Activate the admin row
      const { error: updateErr } = await supabase
        .from('school_admins')
        .update({ active: true, accepted_at: new Date().toISOString() })
        .eq('id', invite.id);

      if (updateErr) { setState('error'); return; }

      setSchool((invite.schools as any)?.name ?? 'your school');
      setState('success');
    }

    accept();
  }, [token]);

  if (state === 'loading') return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#dedede] border-t-[#BE1E2D] rounded-full animate-spin" />
    </div>
  );

  if (state === 'error') return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="max-w-sm text-center space-y-4">
        <XCircle size={48} strokeWidth={1.5} className="text-red-400 mx-auto" />
        <h1 className="text-xl font-bold text-[#111]">Invite not found</h1>
        <p className="text-[#979797] text-sm">This link may have expired or already been used. Contact Praesignis for a new invite.</p>
        <button onClick={() => router.push('/dashboard')}
          className="w-full py-3 bg-[#BE1E2D] text-white rounded-full font-semibold">
          Go to marketplace
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#111] flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-[#BE1E2D]/20 border-2 border-[#BE1E2D]/40 flex items-center justify-center mx-auto">
          <ShieldCheck size={40} strokeWidth={1.5} className="text-[#BE1E2D]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">You're a Klerebank Admin!</h1>
          <p className="text-white/60 text-sm mt-2">
            You've been activated as a Klerebank Admin for <strong className="text-white">{school}</strong>.
            You now have access to the Hub dashboard.
          </p>
        </div>
        <div className="bg-white/5 rounded-2xl p-4 text-left space-y-2">
          {[
            'Scan DROP-OFF QRs when sellers arrive',
            'Scan COLLECTION QRs when buyers collect',
            'Earn R10 for each waybill processed',
            'No buyer or seller info is ever shown',
          ].map(t => (
            <div key={t} className="flex items-center gap-2.5 text-sm text-white/70">
              <CheckCircle2 size={14} strokeWidth={2.5} className="text-[#BE1E2D] shrink-0" />
              {t}
            </div>
          ))}
        </div>
        <button onClick={() => router.push('/klerebank')}
          className="w-full py-4 bg-[#BE1E2D] hover:bg-[#9B1824] text-white rounded-2xl font-bold text-lg transition">
          Open Hub Dashboard →
        </button>
        <button onClick={() => router.push('/dashboard')}
          className="w-full py-2.5 text-white/40 hover:text-white/70 text-sm transition">
          Go to marketplace instead
        </button>
      </div>
    </div>
  );
}
