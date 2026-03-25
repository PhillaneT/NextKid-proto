# NextKid — End of Day Brief
**Date:** 2026-03-25

Paste this file into a new Claude Code session to resume exactly where we left off.

---

## What NextKid Is

Peer-to-peer school marketplace (SA). Parents/students buy & sell textbooks, uniforms, school gear.

- **Web:** Next.js App Router — `apps/web/`
- **Mobile:** Expo (not touched yet this sprint)
- **Backend:** Next.js API routes → Supabase (PostgreSQL + Auth)
- **Shipping:** The Courier Guy (TCG) via `https://api-pudo.co.za`
- **Payments:** Peach Payments (escrow) — credentials pending, placeholder in place
- **Monorepo:** pnpm workspaces — `apps/web`, `apps/mobile`, `packages/shared`

---

## What's Been Built (completed & working)

| Feature | Status |
|---|---|
| Auth (Supabase email) | ✅ Done |
| Onboarding 4-step flow (name → age → location → address) | ✅ Done |
| Location cascade: Province → City → Suburb (with postal code search) | ✅ Done |
| Browse page with filters | ✅ Done |
| Listing detail (item page) | ✅ Done |
| Sell wizard (listing creation with parcel dims + shipping method config) | ✅ Done |
| Profile page (view + edit) | ✅ Done (see bugs below) |
| Dashboard | ✅ Done |
| Shipping quotes API (`/api/shipping/rates`) — TCG D2D + L2D | ✅ Done |
| Checkout page (`/checkout/[listingId]`) | ✅ Done |
| Order creation API (`/api/orders`) | ✅ Done |
| Order confirmation page (`/orders/[id]`) — Peach Payments placeholder | ✅ Done |
| "Buy Now" button wired to checkout | ✅ Done |
| `items` table data migrated to `listings` table (6 rows) | ✅ Done |
| Multi-school select in onboarding Step 3 | ✅ Done today |
| Multi-school select in profile edit + global cross-province school search | ✅ Done today (see bugs) |

---

## DB Notes

- **Two tables exist:** `items` (legacy, do not use) and `listings` (active, all new data goes here)
- `listings.price_cents` — stored in cents (integer), display as `R {cents/100}`
- `listings.status` — uppercase enum: `'ACTIVE'`, `'SOLD'`, `'DELISTED'`, `'ARCHIVED'`
- `listings.condition` — uppercase enum: `'NEW'`, `'LIKE_NEW'`, `'GOOD'`, `'FAIR'`, `'POOR'`
- `profiles.province` — stores province name (e.g. `'Gauteng'`), NOT province_code
- `schools.province_code` — stores province name (confusingly named, same values as `profiles.province`)
- `profiles.school_ids` — text array, source of truth for multi-school. No FK constraint.
- `profiles.school_id` — single UUID with FK to `schools.id` — must be null or a real school ID

---

## Active Bugs / Issues

### 🔴 Bug: Multi-school on profile edit — still has issues
**Reported:** End of session today — user couldn't select a second school.
**What was fixed today:**
- Schools now load by suburb (not province-wide) when editing
- Global cross-province search added ("Search across all areas" input)
- FK constraint error fixed (`school_id` now derived from DB-verified `editSchools[0]?.id`)

**What's still wrong:** User reported they still can't add a second school. Not fully debugged — needs fresh look tomorrow. Likely causes:
1. The global search dropdown shows but clicking doesn't persist
2. The suburb school list may not visually show the second selection
3. State sync between `editSchoolIds` and `editSchools` may drift

**Files to check:** `apps/web/app/profile/page.tsx` — `toggleSchool()`, `saveEdit()`, the school UI section (~line 430–530)

---

### 🟡 Bug: `items` table FK dependencies not migrated
`offers`, `bids`, `likes`, `notifications` tables still FK to `items.id`, not `listings.id`.
`items` table cannot be dropped yet.
**Next step:** Migration to update those FKs, then drop `items`.

---

### 🟡 Missing: Street address in onboarding has no autocomplete
Step 4 of onboarding is a plain text input. Should eventually integrate Google Places or similar.
**Deferred** — low priority for prototype.

---

## Pending Features / Tasks

### High priority
1. **Debug multi-school profile edit** (pick up first thing tomorrow — already half done)
2. **Order state machine** — transitions beyond `PENDING_PAYMENT`, seller ships, auto-cancel after 3 business days, buyer confirms receipt
3. **Peach Payments integration** — waiting on credentials from user. Once received: replace the placeholder on `/orders/[id]` with actual payment initiation

### Medium priority
4. **Drop `items` table** — migrate FKs from `offers`, `bids`, `likes`, `notifications` → `listings`, then drop `items`
5. **Seller order flow** — seller needs to see incoming orders, upload tracking number, mark as shipped (no UI yet)
6. **Buyer order list** — `/orders` page listing all buyer's orders with status

### Low priority / post-prototype
7. **Dark/Light theme toggle** (Feature #2 from user's list)
8. **Street address autocomplete** (Feature #4 — Google Places or ZA-specific)
9. **Dispute flow** — 14-day window, evidence upload, admin resolution
10. **Push notifications** — buyer/seller order updates
11. **Mobile app** (Expo) — not started this sprint

---

## Key File Map

```
apps/web/
  app/
    browse/page.tsx          — Browse + filter listings
    item/[id]/page.tsx       — Listing detail + Buy Now button
    sell/new/page.tsx        — Sell wizard (listing creation)
    checkout/[listingId]/page.tsx   — Shipping quote selection + order confirm
    orders/[id]/page.tsx     — Order confirmation (Peach placeholder)
    profile/page.tsx         — User profile view + edit (multi-school bug here)
    onboarding/page.tsx      — 4-step signup flow
    dashboard/page.tsx       — Dashboard
    api/
      shipping/rates/route.ts — TCG rate fetch (D2D + L2D)
      orders/route.ts         — Order creation
      locations/
        cities/route.ts
        suburbs/route.ts
        suburbs/search/route.ts
        schools/route.ts
  src/lib/
    supabase.ts              — Anon client (browser)
    supabase-server.ts       — Service-role client (API routes only)

packages/shared/
  types/shipping.ts          — ShippingQuote, TCGRateOption, helpers
  types/location.ts          — Province, City, Suburb, School types
  src/index.ts               — Re-exports for @nextkid/shared

supabase/migrations/
  001_schema_and_seed.sql    — Full schema
  003_rls_fix.sql            — RLS policies
  004_migrate_items_to_listings.sql — Data migration
```

---

## Environment Variables Needed

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
TCG_API_KEY=54041081|6SxxLLpujh5lV91PJjrVuxmO3aE38y6qgQubcFbG33fbe7be
TCG_API_BASE_URL=https://api-pudo.co.za
PEACH_PAYMENTS_ENTITY_ID=          ← PENDING
PEACH_PAYMENTS_ACCESS_TOKEN=       ← PENDING
PLATFORM_COMMISSION_RATE=0.08
```

---

## Start Tomorrow With

1. Open `apps/web/app/profile/page.tsx`
2. Test the multi-school edit flow in browser — pick suburb, select school 1, try global search for school 2
3. Console.log `editSchools` state after each `toggleSchool` call to see where the state breaks
4. Fix and verify save works without FK error
5. Then move on to order state machine or Peach Payments (whichever the user prioritises)
