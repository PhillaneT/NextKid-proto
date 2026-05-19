/**
 * NextKid — Order Notification Helper
 *
 * Sends push notifications (real, via Expo) and emails (demo — logs to console).
 * To enable real emails: sign up at resend.com, add RESEND_API_KEY to .env.local,
 * and uncomment the Resend block in sendEmail() below.
 */

import { createServerSupabaseClient } from './supabase-server'

// ── Types ─────────────────────────────────────────────────────────────────────

interface NotificationPayload {
  orderId: string
  newStatus: string
  triggeredBy: 'buyer' | 'seller' | 'system' | 'admin'
}

interface OrderData {
  id: string
  status: string
  item_price_cents: number
  total_paid_cents: number
  buyer_id: string
  seller_id: string
  listing_id: string
}

interface Profile {
  id: string
  full_name: string | null
  email: string | null
  expo_push_token: string | null
}

// ── Status message config ─────────────────────────────────────────────────────

const STATUS_MESSAGES: Record<string, {
  buyer?: { push: string; email: { subject: string; body: string } }
  seller?: { push: string; email: { subject: string; body: string } }
}> = {
  // ── Multi-item partial sale ────────────────────────────────────────────────
  PARTIAL_SALE: {
    seller: {
      push: '🛒 Some items from your listing just sold!',
      email: {
        subject: 'Items sold — remaining items still listed',
        body: 'A buyer has purchased some items from your multi-item listing. The unsold items are still active and available for other buyers to purchase.',
      },
    },
    buyer: {
      push: '🎉 Your selected items are reserved! Complete checkout to confirm.',
      email: {
        subject: 'Your selected items — complete your order',
        body: 'You have selected items from a listing. Your items are reserved for 15 minutes. Please complete checkout before your reservation expires.',
      },
    },
  },

  // ── Hub fulfilment flow ────────────────────────────────────────────────────
  AWAITING_DROPOFF: {
    buyer: {
      push: '💳 Payment secured! Waiting for the seller to bring your item to a Klerebank hub.',
      email: {
        subject: 'Payment confirmed — seller is bringing your item to Klerebank',
        body: 'Your payment has been secured in escrow. The seller has 3 business days to drop your item off at a Klerebank hub. You\'ll receive your collection QR once the item is confirmed at the hub.',
      },
    },
    seller: {
      push: '📦 New order! Drop your item off at a Klerebank hub within 3 business days.',
      email: {
        subject: 'New order — drop off your item at Klerebank within 3 days',
        body: 'A buyer has paid for your item and the funds are held in escrow. Please bring the item to your nearest Klerebank hub within 3 business days. Use the Drop-Off QR in your order details — the admin will scan it to confirm receipt.',
      },
    },
  },
  ITEM_AT_HUB: {
    buyer: {
      push: '🎉 Your item is at the Klerebank hub and ready to collect! Open the app for your QR.',
      email: {
        subject: 'Your item is ready to collect at Klerebank',
        body: 'Great news — the seller has dropped off your item and it\'s been confirmed at the Klerebank hub. Open the app to get your Collection QR, then visit any Klerebank location to collect your item. Your QR is valid for 14 days.',
      },
    },
    seller: {
      push: '✅ Item received at Klerebank hub. Payment will be released once the buyer collects.',
      email: {
        subject: 'Item confirmed at Klerebank — waiting for buyer to collect',
        body: 'Your item has been received and confirmed at the Klerebank hub. The buyer has been notified and sent their collection QR. Once they collect, your payment (minus platform commission) will be released automatically.',
      },
    },
  },
  // ── Legacy courier flow ────────────────────────────────────────────────────
  AWAITING_SHIPMENT_BOOKING: {
    buyer: {
      push: '💳 Payment secured! Waiting for seller to ship your order.',
      email: {
        subject: 'Payment confirmed — your order is being prepared',
        body: 'Your payment has been secured in escrow. The seller has 3 business days to ship your item. We\'ll notify you the moment it\'s on its way.',
      },
    },
    seller: {
      push: '🎉 New order! Payment received. Ship within 3 business days.',
      email: {
        subject: 'You have a new order — ship within 3 business days',
        body: 'A buyer has paid for your item. Please package and ship it within 3 business days. Failure to ship will result in automatic cancellation and a full refund to the buyer.',
      },
    },
  },
  SHIPMENT_BOOKED: {
    buyer: {
      push: '📦 Your order has been booked for shipping!',
      email: {
        subject: 'Your order has been booked for shipping',
        body: 'The seller has booked your shipment. You\'ll receive another notification with your tracking details once it\'s collected.',
      },
    },
  },
  SHIPPED: {
    buyer: {
      push: '🚚 Your order is on its way!',
      email: {
        subject: 'Your order has been shipped',
        body: 'Your order has been collected and is on its way to you. Check your order details for tracking information.',
      },
    },
  },
  IN_TRANSIT: {
    buyer: {
      push: '📍 Your order is in transit.',
      email: {
        subject: 'Your order is in transit',
        body: 'Your order is on its way and currently in transit. Expected delivery is on track.',
      },
    },
  },
  OUT_FOR_DELIVERY: {
    buyer: {
      push: '🏠 Your order is out for delivery today!',
      email: {
        subject: 'Your order is out for delivery today!',
        body: 'Great news — your order is with the courier and will be delivered today. Make sure someone is available to receive it.',
      },
    },
  },
  DELIVERED: {
    buyer: {
      push: '✅ Your order has arrived! Please confirm receipt to release payment.',
      email: {
        subject: 'Your order has been delivered — please confirm receipt',
        body: 'Your order has been marked as delivered. Please open the app and confirm that you received your item in good condition. If you don\'t confirm within 14 days, payment will be automatically released to the seller.',
      },
    },
  },
  COMPLETED: {
    buyer: {
      push: '🎉 Order complete! Thanks for shopping on NextKid.',
      email: {
        subject: 'Order complete — thank you!',
        body: 'Your order is complete. We hope you\'re happy with your purchase! Feel free to browse more listings on NextKid.',
      },
    },
    seller: {
      push: '💰 Payment released! Your funds are on their way.',
      email: {
        subject: 'Payment released — your payout is on its way',
        body: 'The buyer has confirmed receipt of their order. Your payment (minus the platform commission) has been released. Thank you for selling on NextKid!',
      },
    },
  },
  AUTO_CANCELLED: {
    buyer: {
      push: '❌ Your order was auto-cancelled. Full refund issued.',
      email: {
        subject: 'Order auto-cancelled — full refund issued',
        body: 'Unfortunately the seller did not ship your order within 3 business days, so it has been automatically cancelled. A full refund has been issued.',
      },
    },
    seller: {
      push: '⚠️ Order cancelled — you did not ship in time.',
      email: {
        subject: 'Order cancelled — shipping deadline missed',
        body: 'Your order was automatically cancelled because you did not ship within 3 business days. The buyer has received a full refund. Please ensure future orders are shipped on time.',
      },
    },
  },
  CANCELLED: {
    buyer: {
      push: '❌ Your order has been cancelled. Refund issued.',
      email: {
        subject: 'Order cancelled — refund issued',
        body: 'Your order has been cancelled and any payment has been fully refunded.',
      },
    },
  },
}

// ── Push notification (real — Expo Push API, free) ────────────────────────────

async function sendPush(token: string, title: string, body: string) {
  if (!token || !token.startsWith('ExponentPushToken')) return

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to: token, title, body, sound: 'default', priority: 'high' }),
    })
  } catch (err) {
    console.error('[Push] Failed to send:', err)
  }
}

// ── Email (demo mode — logs to console) ──────────────────────────────────────
// To send real emails: add RESEND_API_KEY to .env.local and uncomment below.

async function sendEmail(to: string, subject: string, body: string, name: string) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY

  if (RESEND_API_KEY) {
    // ── Real email via Resend (uncomment when you have an API key) ──
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'NextKid <orders@nextkid.co.za>',
        to: [to],
        subject,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
            <div style="background:#3A3A3A;padding:16px 24px;border-radius:12px 12px 0 0">
              <img src="${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/logo.png" alt="NextKid" style="height:40px;width:auto" />
            </div>
            <div style="background:#fff;border:1px solid #dedede;border-top:none;padding:28px;border-radius:0 0 12px 12px">
              <p style="color:#979797;font-size:13px;margin:0 0 4px">Hi ${name},</p>
              <h2 style="color:#111;font-size:20px;margin:0 0 16px">${subject}</h2>
              <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 24px">${body}</p>
              <a href="${process.env.NEXTAUTH_URL ?? 'http://localhost:5000'}/orders"
                style="background:#BE1E2D;color:#fff;text-decoration:none;padding:12px 24px;border-radius:30px;font-weight:700;font-size:14px">
                View my orders
              </a>
              <p style="color:#979797;font-size:11px;margin:24px 0 0">NextKid · South Africa's school marketplace · Wear. Grow. Repeat.</p>
            </div>
          </div>
        `,
      }),
    })
    console.log(`[Email] ✅ Sent to ${to}: "${subject}"`)
  } else {
    // ── DEMO MODE — log what would be sent ──
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║  DEMO EMAIL (add RESEND_API_KEY to send real emails)         ║
╠══════════════════════════════════════════════════════════════╣
║  To:      ${to.padEnd(52)}║
║  Name:    ${name.padEnd(52)}║
║  Subject: ${subject.padEnd(52)}║
╠══════════════════════════════════════════════════════════════╣
║  ${body.slice(0, 60).padEnd(60)}║
╚══════════════════════════════════════════════════════════════╝
    `)
  }
}

// ── Save notification to DB ───────────────────────────────────────────────────

async function saveNotification(
  server: ReturnType<typeof createServerSupabaseClient>,
  userId: string,
  type: string,
  message: string,
  itemId: string | null
) {
  await server.from('notifications').insert({
    user_id: userId,
    type,
    message,
    item_id: itemId,
    read: false,
  }).select()
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function sendOrderNotification({ orderId, newStatus }: NotificationPayload) {
  const config = STATUS_MESSAGES[newStatus]
  if (!config) return // No notification configured for this status

  const server = createServerSupabaseClient()

  // Fetch order
  const { data: order } = await server
    .from('orders')
    .select('id, status, item_price_cents, total_paid_cents, buyer_id, seller_id, listing_id')
    .eq('id', orderId)
    .single() as { data: OrderData | null }

  if (!order) return

  // Fetch listing title for notifications
  const { data: listing } = await server
    .from('listings')
    .select('title')
    .eq('id', order.listing_id)
    .single()

  const itemTitle = listing?.title ?? 'your item'
  const shortTitle = itemTitle.length > 30 ? itemTitle.slice(0, 30) + '…' : itemTitle

  // Fetch buyer + seller profiles
  const { data: profiles } = await server
    .from('profiles')
    .select('id, full_name, email, expo_push_token')
    .in('id', [order.buyer_id, order.seller_id]) as { data: Profile[] | null }

  const buyer  = profiles?.find(p => p.id === order.buyer_id)
  const seller = profiles?.find(p => p.id === order.seller_id)

  // ── Buyer notifications ──────────────────────────────────────────────────
  if (config.buyer && buyer) {
    const pushMsg = `${config.buyer.push}\n${shortTitle}`

    // Push
    if (buyer.expo_push_token) {
      await sendPush(buyer.expo_push_token, 'NextKid — Order Update', pushMsg)
    }

    // Email
    if (buyer.email) {
      await sendEmail(buyer.email, config.buyer.email.subject, config.buyer.email.body, buyer.full_name ?? 'there')
    }

    // Save to notifications table
    await saveNotification(server, buyer.id, newStatus.toLowerCase(), pushMsg, order.listing_id)
  }

  // ── Seller notifications ─────────────────────────────────────────────────
  if (config.seller && seller) {
    const pushMsg = `${config.seller.push}\n${shortTitle}`

    if (seller.expo_push_token) {
      await sendPush(seller.expo_push_token, 'NextKid — Order Update', pushMsg)
    }

    if (seller.email) {
      await sendEmail(seller.email, config.seller.email.subject, config.seller.email.body, seller.full_name ?? 'there')
    }

    await saveNotification(server, seller.id, newStatus.toLowerCase(), pushMsg, order.listing_id)
  }

  console.log(`[Notifications] ✅ Sent for order ${orderId.slice(0, 8)} → ${newStatus}`)
}
