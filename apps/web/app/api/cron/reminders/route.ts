import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { sendReminderNotification } from '@/lib/notifications'

// GET /api/cron/reminders
//
// Runs daily (scheduled via vercel.json cron: "0 6 * * *" = 8am SAST).
// Protected by x-cron-secret header.
//
// Phase 1 — schedule: for every active child × active rule that matches
//   grade + gender, compute the anchor date for this SA school year and
//   upsert a scheduled_reminders row. The UNIQUE constraint prevents duplicates.
//
// Phase 2 — send: query all unsent reminders due today or earlier, send
//   a push + in-app notification per child, then mark sent_at.

const GRADE_ORDER = ['R','1','2','3','4','5','6','7','8','9','10','11','12']

function gradeIndex(g: string | null): number {
  return g ? GRADE_ORDER.indexOf(g) : -1
}

function gradeInRange(childGrade: string | null, from: string | null, to: string | null): boolean {
  if (!from && !to) return true
  if (!childGrade) return false
  const ci = gradeIndex(childGrade)
  if (ci === -1) return false
  const fi = from ? gradeIndex(from) : 0
  const ti = to   ? gradeIndex(to)   : GRADE_ORDER.length - 1
  return ci >= fi && ci <= ti
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + days)
  return r
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function computeScheduledFor(
  triggerType: string,
  timingOffsetDays: number,
  dob: string,
): string | null {
  const today = new Date()
  const year  = today.getFullYear()

  switch (triggerType) {
    case 'year_end': {
      // Anchor: Nov 30 of current year
      const anchor = new Date(year, 10, 30)
      if (anchor < today) return null
      return toDateStr(addDays(anchor, -timingOffsetDays))
    }
    case 'school_transition': {
      // Anchor: Jan 15 of next year (start of new SA school year)
      return toDateStr(addDays(new Date(year + 1, 0, 15), -timingOffsetDays))
    }
    case 'matric': {
      // Anchor: Oct 31 of current year (matric exam season)
      const anchor = new Date(year, 9, 31)
      if (anchor < today) return null
      return toDateStr(addDays(anchor, -timingOffsetDays))
    }
    case 'post_school': {
      // Anchor: Jan 31 of next year — alumni nudge after matric
      return toDateStr(new Date(year + 1, 0, 31))
    }
    case 'growth_spurt': {
      // Anchor: child's next birthday
      const d = new Date(dob)
      let next = new Date(year, d.getMonth(), d.getDate())
      if (next <= today) next = new Date(year + 1, d.getMonth(), d.getDate())
      return toDateStr(addDays(next, -timingOffsetDays))
    }
    default:
      return null
  }
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`)
}

export async function GET(req: NextRequest) {
  if (req.headers.get('x-cron-secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const server = createServerSupabaseClient()
  const today  = toDateStr(new Date())

  // ── Load data ──────────────────────────────────────────────────────────────

  const [childrenRes, rulesRes] = await Promise.all([
    server
      .from('child_profiles')
      .select(`
        id, user_id, nickname, gender, dob, grade,
        child_sizes       ( top_size, recorded_date ),
        size_predictions  ( predicted_top, prediction_date )
      `)
      .is('deleted_at', null)
      .order('recorded_date',   { ascending: false, referencedTable: 'child_sizes' })
      .order('prediction_date', { ascending: false, referencedTable: 'size_predictions' })
      .limit(1, { referencedTable: 'child_sizes' })
      .limit(1, { referencedTable: 'size_predictions' }),

    server
      .from('reminder_rules')
      .select('id, trigger_type, grade_from, grade_to, gender, message_template, timing_offset_days')
      .eq('active', true),
  ])

  const children = childrenRes.data ?? []
  const rules    = rulesRes.data    ?? []

  if (childrenRes.error || rulesRes.error) {
    return NextResponse.json({ error: 'db error' }, { status: 500 })
  }

  // ── Phase 1: schedule ──────────────────────────────────────────────────────

  let scheduled = 0

  for (const child of children) {
    const latestSize = (child.child_sizes as any[])?.[0]
    const latestPred = (child.size_predictions as any[])?.[0]

    for (const rule of rules) {
      if (!gradeInRange(child.grade, rule.grade_from, rule.grade_to)) continue
      if (rule.gender && rule.gender !== child.gender) continue

      // growth_spurt: skip if sizes aren't predicted to change
      if (rule.trigger_type === 'growth_spurt') {
        if (!latestSize || !latestPred) continue
        if (latestSize.top_size === latestPred.predicted_top) continue
      }

      const scheduledFor = computeScheduledFor(rule.trigger_type, rule.timing_offset_days, child.dob)
      if (!scheduledFor) continue

      await server
        .from('scheduled_reminders')
        .upsert(
          { child_id: child.id, rule_id: rule.id, scheduled_for: scheduledFor },
          { onConflict: 'child_id,rule_id,scheduled_for', ignoreDuplicates: true },
        )
      scheduled++
    }
  }

  // ── Phase 2: send due reminders ────────────────────────────────────────────

  const { data: due } = await server
    .from('scheduled_reminders')
    .select(`
      id,
      child_profiles ( user_id, nickname, grade ),
      reminder_rules ( message_template )
    `)
    .lte('scheduled_for', today)
    .is('sent_at', null)

  let sent = 0

  for (const reminder of (due ?? [])) {
    const child = reminder.child_profiles as any
    const rule  = reminder.reminder_rules  as any
    if (!child || !rule) continue

    const message = interpolate(rule.message_template, {
      child: child.nickname ?? 'your child',
      grade: child.grade    ?? '',
    })

    await sendReminderNotification(child.user_id, message)

    await server
      .from('scheduled_reminders')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', reminder.id)

    sent++
  }

  console.log(`[Reminders] scheduled=${scheduled} sent=${sent} date=${today}`)
  return NextResponse.json({ scheduled, sent, date: today })
}
