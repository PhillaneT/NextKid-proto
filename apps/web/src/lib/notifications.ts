/**
 * NextKid — Full Order Lifecycle Notification System
 *
 * Covers every status change in the order lifecycle with:
 * - Real push notifications (Expo Push API)
 * - Email (Resend when API key present, console log otherwise)
 * - In-app notifications (saved to notifications table)
 *
 * Messages use dynamic context: waybill number, school name, deadline date.
 */

import { createServerSupabaseClient } from './supabase-server'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NotificationPayload {
  orderId:     string
  newStatus:   string
  triggeredBy: 'buyer' | 'seller' | 'system' | 'admin'
}

interface OrderContext {
  id:           string
  buyerId:      string
  sellerId:     string
  listingId:    string
  waybill:      string       // e.g. NK-260521-AB3X7Q
  schoolName:   string       // e.g. Noordwyk High School
  itemTitle:    string       // e.g. Grey school trousers
  deadline:     string       // formatted date for drop-off
  deliverySchoolId: string | null
}

interface Profile {
  id:              string
  full_name:       string | null
  email:           string | null
  expo_push_token: string | null
}

// ── Push notification ─────────────────────────────────────────────────────────

async function sendPush(token: string, title: string, body: string) {
  if (!token?.startsWith('ExponentPushToken')) return
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body:    JSON.stringify({ to: token, title, body, sound: 'default', priority: 'high' }),
    })
  } catch (err) {
    console.error('[Push] Failed to send:', err)
  }
}

// ── Email ─────────────────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, body: string, name: string) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  const baseUrl        = process.env.NEXTAUTH_URL ?? 'http://localhost:5000'

  if (RESEND_API_KEY) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: 'NextKid <support@nextkid.co.za>',
        to:   [to],
        subject,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
            <div style="background:#3A3A3A;padding:16px 24px;border-radius:12px 12px 0 0">
              <img src="${baseUrl}/logo.png" alt="NextKid" style="height:80px;width:auto" />
            </div>
            <div style="background:#fff;border:1px solid #dedede;border-top:none;padding:28px;border-radius:0 0 12px 12px">
              <p style="color:#979797;font-size:13px;margin:0 0 4px">Hi ${name},</p>
              <h2 style="color:#111;font-size:20px;margin:0 0 16px">${subject}</h2>
              <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 24px">${body}</p>
              <a href="${baseUrl}/orders"
                style="background:#BE1E2D;color:#fff;text-decoration:none;padding:12px 24px;border-radius:30px;font-weight:700;font-size:14px">
                View my orders
              </a>
              <p style="color:#979797;font-size:11px;margin:24px 0 0">
                NextKid · South Africa's school marketplace · Wear. Grow. Repeat.
              </p>
            </div>
          </div>
        `,
      }),
    })
    console.log(`[Email] ✅ Sent to ${to}: "${subject}"`)
  } else {
    console.log(`[Email DEMO] To: ${to} | Subject: ${subject}`)
  }
}

// ── Save to DB ────────────────────────────────────────────────────────────────

async function save(
  server:  ReturnType<typeof createServerSupabaseClient>,
  userId:  string,
  orderId: string | null,
  type:    string,
  message: string,
  listingId: string | null,
) {
  await server.from('notifications').insert({
    user_id:  userId,
    order_id: orderId,
    type,
    message,
    item_id:  listingId,
    read:     false,
    sent_at:  new Date().toISOString(),
  })
}

// ── Notify one person (push + email + DB) ─────────────────────────────────────

async function notify(
  server:   ReturnType<typeof createServerSupabaseClient>,
  profile:  Profile,
  orderId:  string,
  listingId: string,
  type:     string,
  pushMsg:  string,
  emailSubject: string,
  emailBody:    string,
) {
  if (profile.expo_push_token) {
    await sendPush(profile.expo_push_token, 'NextKid', pushMsg)
  }
  if (profile.email) {
    await sendEmail(profile.email, emailSubject, emailBody, profile.full_name ?? 'there')
  }
  await save(server, profile.id, orderId, type, pushMsg, listingId)
}

// ── Notify all active school admins for a given school ────────────────────────

async function notifySchoolAdmins(
  server:    ReturnType<typeof createServerSupabaseClient>,
  schoolId:  string,
  orderId:   string,
  type:      string,
  pushMsg:   string,
) {
  if (!schoolId) return
  const { data: admins } = await server
    .from('school_admins')
    .select('user_id, profiles(id, expo_push_token, full_name, email)')
    .eq('school_id', schoolId)
    .eq('active', true)

  for (const row of admins ?? []) {
    const prof = (row.profiles as unknown as Profile)
    if (!prof) continue
    if (prof.expo_push_token) await sendPush(prof.expo_push_token, 'NextKid Hub', pushMsg)
    await save(server, prof.id, orderId, type, pushMsg, null)
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function sendOrderNotification({ orderId, newStatus }: NotificationPayload) {
  const server = createServerSupabaseClient()

  // Fetch everything needed for dynamic messages
  const { data: order } = await server
    .from('orders')
    .select(`
      id, buyer_id, seller_id, listing_id,
      auto_dropoff_at, delivery_school_id,
      waybills ( waybill_number )
    `)
    .eq('id', orderId)
    .single()

  if (!order) return

  const { data: listing } = await server
    .from('listings').select('title').eq('id', order.listing_id).single()

  const { data: school } = order.delivery_school_id
    ? await server.from('schools').select('name').eq('id', order.delivery_school_id).single()
    : { data: null }

  const { data: profiles } = await server
    .from('profiles')
    .select('id, full_name, email, expo_push_token')
    .in('id', [order.buyer_id, order.seller_id]) as { data: Profile[] | null }

  const buyer  = profiles?.find(p => p.id === order.buyer_id)
  const seller = profiles?.find(p => p.id === order.seller_id)

  // Build context for dynamic messages
  const ctx: OrderContext = {
    id:           order.id,
    buyerId:      order.buyer_id,
    sellerId:     order.seller_id,
    listingId:    order.listing_id,
    waybill:      (order.waybills as any)?.waybill_number ?? 'NK-XXXXXX',
    schoolName:   school?.name ?? 'the Klerebank hub',
    itemTitle:    listing?.title ?? 'your item',
    deadline:     order.auto_dropoff_at
      ? new Date(order.auto_dropoff_at).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })
      : 'within 3 days',
    deliverySchoolId: order.delivery_school_id ?? null,
  }

  // ── Per-status notification logic ──────────────────────────────────────────

  switch (newStatus) {

    case 'AWAITING_DROPOFF': {
      // SELLER: Ka-ching!
      if (seller) {
        await notify(server, seller, ctx.id, ctx.listingId,
          'awaiting_dropoff',
          `Ka-ching! 🎉 Pack those items and drop them at the Klerebank by ${ctx.deadline}.\n${ctx.waybill}`,
          'New order — drop-off required',
          `Great news — someone bought your item "${ctx.itemTitle}"! Your funds are held safely. Please pack the item and drop it off at ${ctx.schoolName} by ${ctx.deadline}. Use your Drop-Off QR code in the order details.`,
        )
      }
      // BUYER: payment confirmed
      if (buyer) {
        await notify(server, buyer, ctx.id, ctx.listingId,
          'awaiting_dropoff',
          `Payment confirmed! 💳 The seller is bringing your item to ${ctx.schoolName}.`,
          'Payment confirmed — item on its way to hub',
          `Your payment for "${ctx.itemTitle}" has been secured. The seller has been notified and must drop the item at ${ctx.schoolName} by ${ctx.deadline}. You'll get a collection QR once it arrives.`,
        )
      }
      // ADMIN: heads up
      if (ctx.deliverySchoolId) {
        await notifySchoolAdmins(server, ctx.deliverySchoolId, ctx.id,
          'dropoff_expected',
          `📦 Expecting ${ctx.waybill}. Drop-off due ${ctx.deadline}.`,
        )
      }
      break
    }

    case 'ITEM_AT_HUB': {
      // SELLER: parcel received
      if (seller) {
        await notify(server, seller, ctx.id, ctx.listingId,
          'item_at_hub',
          `Your parcel has been received at ${ctx.schoolName}. Sit tight. 🏫`,
          'Item received at Klerebank hub',
          `Good news — your item "${ctx.itemTitle}" (${ctx.waybill}) has been received at ${ctx.schoolName}. The buyer has been notified and sent their collection QR. Payment will be released automatically once they collect.`,
        )
      }
      // BUYER: go collect!
      if (buyer) {
        await notify(server, buyer, ctx.id, ctx.listingId,
          'item_at_hub',
          `Your order is at ${ctx.schoolName}! 🎁 Go collect with your QR.`,
          'Your order is ready to collect!',
          `"${ctx.itemTitle}" is waiting for you at ${ctx.schoolName}. Open the app to get your Collection QR, show it to the Klerebank admin, and you're done! Your QR is valid for 14 days.`,
        )
      }
      break
    }

    case 'COMPLETED': {
      // BUYER: enjoy!
      if (buyer) {
        await notify(server, buyer, ctx.id, ctx.listingId,
          'completed',
          `Enjoy your new goodies! 🎉 Don't forget to leave the seller a review.`,
          'Order complete — enjoy your item!',
          `You've collected "${ctx.itemTitle}" — we hope you love it! Consider leaving the seller a review to help the NextKid community grow. Wear it well. Grow. Repeat.`,
        )
      }
      // SELLER: payment coming
      if (seller) {
        await notify(server, seller, ctx.id, ctx.listingId,
          'completed',
          `Your buyer collected their order. 💰 Payment is on its way — reflects within 24 hours.`,
          'Payment released — funds on their way',
          `Your buyer has collected "${ctx.itemTitle}" (${ctx.waybill}). Your payout (minus platform commission) has been released and will reflect in your account within 24 hours. Thank you for selling on NextKid!`,
        )
      }
      // ADMIN: WB closed
      if (ctx.deliverySchoolId) {
        await notifySchoolAdmins(server, ctx.deliverySchoolId, ctx.id,
          'collection_complete',
          `${ctx.waybill} closed. ✅ Your R10 is included in this month's payout.`,
        )
      }
      break
    }

    case 'AUTO_CANCELLED': {
      if (buyer) {
        await notify(server, buyer, ctx.id, ctx.listingId,
          'auto_cancelled',
          `❌ Your order was auto-cancelled — the seller didn't drop off in time. Full refund issued.`,
          'Order auto-cancelled — full refund issued',
          `Unfortunately the seller did not drop off "${ctx.itemTitle}" at the Klerebank by ${ctx.deadline}, so your order has been automatically cancelled. A full refund has been issued.`,
        )
      }
      if (seller) {
        await notify(server, seller, ctx.id, ctx.listingId,
          'auto_cancelled',
          `⚠️ Your order was cancelled — you missed the drop-off deadline.`,
          'Order cancelled — drop-off deadline missed',
          `Your order for "${ctx.itemTitle}" was automatically cancelled because you didn't drop it off by ${ctx.deadline}. The buyer received a full refund. Please ensure future orders are dropped off on time.`,
        )
      }
      break
    }

    case 'CANCELLED': {
      if (buyer) {
        await notify(server, buyer, ctx.id, ctx.listingId,
          'cancelled',
          `❌ Your order has been cancelled. Any payment has been refunded.`,
          'Order cancelled — refund issued',
          `Your order for "${ctx.itemTitle}" has been cancelled. Any payment has been fully refunded.`,
        )
      }
      break
    }

    default:
      console.log(`[Notifications] No handler for status: ${newStatus}`)
  }

  console.log(`[Notifications] ✅ Sent for order ${orderId.slice(0, 8)} → ${newStatus}`)
}

// ── Nudge uncollected buyers (called by cron / scheduled job) ─────────────────

export async function nudgeUncollectedBuyers() {
  const server    = createServerSupabaseClient()
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()

  // Find orders that have been at the hub for > 2 days with no collection
  const { data: orders } = await server
    .from('orders')
    .select(`
      id, buyer_id, listing_id, delivery_school_id,
      waybills ( waybill_number ),
      listings ( title )
    `)
    .eq('status', 'ITEM_AT_HUB')
    .lt('dropped_off_at', twoDaysAgo)

  if (!orders?.length) return 0

  for (const order of orders) {
    const { data: buyer } = await server
      .from('profiles')
      .select('id, full_name, email, expo_push_token')
      .eq('id', order.buyer_id)
      .single() as { data: Profile | null }

    if (!buyer) continue

    const schoolName = order.delivery_school_id
      ? (await server.from('schools').select('name').eq('id', order.delivery_school_id).single()).data?.name ?? 'the hub'
      : 'the hub'

    const waybill   = (order.waybills as any)?.waybill_number ?? 'NK-XXXXXX'
    const itemTitle = (order.listings as any)?.title ?? 'your item'

    await notify(
      server, buyer, order.id, order.listing_id,
      'nudge_uncollected',
      `⏰ Your order is still waiting at ${schoolName}. It's not going anywhere — but the admin would love the shelf space back!`,
      'Friendly reminder — your order is waiting',
      `Just a nudge: "${itemTitle}" (${waybill}) is still waiting for you at ${schoolName}. Pop in whenever you're ready — the Klerebank admin will scan your QR to complete the handover. Your collection QR is in the order details.`,
    )
  }

  console.log(`[Nudge] Sent to ${orders.length} uncollected buyer${orders.length !== 1 ? 's' : ''}`)
  return orders.length
}
