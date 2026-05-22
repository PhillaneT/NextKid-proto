import { NextRequest, NextResponse } from 'next/server'
import { nudgeUncollectedBuyers } from '@/lib/notifications'

// POST /api/notifications/nudge
//
// Sends a friendly reminder to buyers who have not collected their order
// after 2 days at the hub. Call this from a cron job (e.g. daily at 10am).
//
// Secured with CRON_SECRET to prevent public abuse.

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const count = await nudgeUncollectedBuyers()
    return NextResponse.json({ success: true, nudged: count })
  } catch (err) {
    console.error('[Nudge] Error:', err)
    return NextResponse.json({ error: 'nudge_failed' }, { status: 500 })
  }
}
