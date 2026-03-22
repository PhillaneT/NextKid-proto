'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Bell, Package, Tag, ShoppingBag, CheckCircle, XCircle } from 'lucide-react';

type Notification = {
  id: string;
  type: string;
  message: string;
  item_id: string | null;
  read: boolean;
  created_at: string;
};

function NotificationIcon({ type }: { type: string }) {
  if (type === 'offer') return <Tag size={20} className="text-green-400" />;
  if (type === 'offer_accepted') return <CheckCircle size={20} className="text-green-400" />;
  if (type === 'offer_declined') return <XCircle size={20} className="text-red-400" />;
  if (type === 'bid') return <ShoppingBag size={20} className="text-orange-400" />;
  if (type === 'purchase') return <Package size={20} className="text-violet-400" />;
  return <Bell size={20} className="text-gray-400" />;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  async function fetchNotifications() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/'); return; }

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    setNotifications(data || []);

    // Mark all as read
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);

    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="py-12">
            <div className="max-w-3xl mx-auto px-6">
                <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-white mb-6 flex items-center gap-2">
                ← Back to Dashboard
                </button>

                <h1 className="text-4xl font-bold text-white mb-2">Notifications</h1>
                <p className="text-gray-400 mb-10">Your offers, bids, and purchase activity</p>

                {loading ? (
                <p className="text-gray-400">Loading...</p>
                ) : notifications.length === 0 ? (
                <div className="text-center py-20">
                    <div className="text-6xl mb-4">🔔</div>
                    <p className="text-gray-400">No notifications yet.</p>
                </div>
                ) : (
                <div className="space-y-3">
                    {notifications.map((n) => (
                    <div
                        key={n.id}
                        onClick={() => n.item_id && router.push(`/item/${n.item_id}`)}
                        className={`flex items-start gap-4 p-6 rounded-2xl border transition ${
                        n.item_id ? 'cursor-pointer hover:border-violet-500' : ''
                        } ${!n.read ? 'bg-[#111] border-violet-500/30' : 'bg-[#111] border-[#222]'}`}
                    >
                        <div className="mt-1 p-2 bg-[#1a1a1a] rounded-xl">
                        <NotificationIcon type={n.type} />
                        </div>
                        <div className="flex-1">
                        <p className={`${!n.read ? 'text-white' : 'text-gray-300'}`}>{n.message}</p>
                        <p className="text-gray-500 text-xs mt-1">{new Date(n.created_at).toLocaleString()}</p>
                        </div>
                        {!n.read && <div className="w-2 h-2 rounded-full bg-violet-500 mt-2 shrink-0" />}
                    </div>
                    ))}
                </div>
                )}
            </div>
        </div> 
    </div>
  );
}