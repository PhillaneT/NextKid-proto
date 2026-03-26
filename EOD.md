# NextKid — End of Day Brief
**Date:** 2026-03-26

Paste this file into a new Claude Code session to resume exactly where we left off.

---

## What NextKid Is

Peer-to-peer school marketplace (SA). Parents/students buy & sell textbooks, uniforms, school gear.

- **Web:** Next.js App Router — `apps/web/`
- **Mobile:** Expo (not touched yet this sprint)
- **Backend:** Next.js API routes → Supabase (PostgreSQL + Auth)
- **Shipping:** The Courier Guy (TCG) via `https://api-pudo.co.za`
- **Payments:** Peach Payments (escrow) — credentials pending, demo mode in place
- **Monorepo:** pnpm workspaces — `apps/web`, `apps/mobile`, `packages/shared`

---

## What's Been Built (completed & working)

| Feature | Status |
|---|---|
| Auth (Supabase email) | ✅ Done |
| Onboarding 4-step flow (name → age → location → address) | ✅ Done |
| Location cascade: Province → City → Suburb | ✅ Done |
| Browse page with filters | ✅ Done |
| Listing detail (item page) | ✅ Done |
| Sell wizard (listing creation with parcel dims + shipping method config) | ✅ Done |
| Profile page — split into Delivery Address + My Schools cards | ✅ Done |
| Multi-school select — global cross-province search, single source of truth state | ✅ Done |
| Buyer orders list (`/orders`) — tabs, status chips, confirm receipt inline | ✅ Done |
| Order detail (`/orders/[id]`) — progress timeline, demo payment form, state-aware UI | ✅ Done |
| Demo payment flow — pre-filled test card, advances PENDING_PAYMENT → AWAITING_SHIPMENT_BOOKING | ✅ Done |
| Buyer confirms receipt — advances DELIVERED → COMPLETED, calculates commission | ✅ Done |
| Shipping quotes API (`/api/shipping/rates`) — D2D + L2D + D2L + L2L | ✅ Done |
| Checkout page — quote selection, order summary, place order | ✅ Done |
| Checkout: pre-check buyer street address client-side (clear error + CTA before calling API) | ✅ Done today |
| Checkout: "Almost there" motivational address card with two options (door / locker) | ✅ Done today |
| Profile: Preferred PUDO Locker section in Delivery Address card | ✅ Done today |
| `/api/lockers/search` — server-side TCG locker proxy, 1-hour cache, safe key handling | ✅ Done today |
| Shipping rates: D2L + L2L quotes when buyer has a preferred locker saved | ✅ Done today |
| Navbar "Orders" tab for logged-in buyers | ✅ Done |
| `profiles.school_ids` migrated to `text[]` (prototype trade-off, revert at AWS) | ✅ Done |

---

## DB Notes

- **Two tables exist:** `items` (legacy, do not use) and `listings` (active, all new data goes here)
- `listings.price_cents` — stored in cents (integer), display as `R {cents/100}`
- `listings.status` — uppercase: `'ACTIVE'`, `'SOLD'`, `'DELISTED'`, `'ARCHIVED'`
- `listings.condition` — uppercase: `'NEW'`, `'LIKE_NEW'`, `'GOOD'`, `'FAIR'`, `'POOR'`
- `listings.shipping_methods` — `text[]` e.g. `ARRAY['PICKUP', 'PUDO_DROPOFF']`
  - `PICKUP` = seller ships from home address → enables D2D (+ D2L if buyer has locker)
  - `PUDO_DROPOFF` = seller drops at a PUDO locker → enables L2D (+ L2L if buyer has locker)
- `listings.pudo_locker_id` / `pudo_locker_name` — seller's collection locker for PUDO_DROPOFF
- `profiles.province` — stores full province name (e.g. `'Gauteng'`), NOT a code
- `profiles.school_ids` — `text[]`, source of truth for multi-school. No FK constraint (prototype trade-off).
- `profiles.school_id` — single text with FK to `schools.id` — first school in school_ids
- `profiles.preferred_locker_id` / `preferred_locker_name` / `preferred_locker_address` — buyer's preferred PUDO locker (NEW — migration 006)

---

## Migrations Run / Pending

| # | File | Status |
|---|---|---|
| 001 | `001_schema_and_seed.sql` | ✅ Applied |
| 002 | `002_listings_extra_columns.sql` | ✅ Applied |
| 003 | `003_rls_fix.sql` | ✅ Applied |
| 004 | `004_migrate_items_to_listings.sql` | ✅ Applied |
| 005 | `005_school_ids_text_array.sql` | ✅ Applied |
| 006 | `006_buyer_preferred_locker.sql` | ⏳ **Needs to be run** |
| 007 | `007_demo_listings_shipping_methods.sql` | ⏳ **Needs to be run** |

**Run 006 + 007 in Supabase SQL editor before next demo session.**

Migration 007 seeds `shipping_methods = ARRAY['PICKUP']` on all active listings with parcel dims, and adds `PUDO_DROPOFF` + locker code `CG23` (Sasol Rivonia) to the 3 most recent listings. Update the locker code if you want a different one.

---

## Test Accounts

- **Seller:** `phillane.troskie@gmail.com` — has listings, needs street address added for real TCG quotes
- **Buyer:** `phillane.troskie+buyer@gmail.com` — test account, has Fourways/Gauteng location, **no street address yet**

Both users need a street address set on their profile (and optionally a preferred PUDO locker) before the real TCG quote flow works. Demo quotes (R142 Economy / R205 Overnight) fire as fallback if TCG returns nothing.

---

## Active Bugs / Issues

### 🟡 items table FK dependencies not migrated
`offers`, `bids`, `likes`, `notifications` tables still FK to `items.id`, not `listings.id`.
`items` table cannot be dropped yet.
**Next step:** Migration to update those FKs, then drop `items`.

### 🟡 Seller has no street address
Real TCG quotes require the seller's street address. For now, the demo fallback fires.
**Fix:** Phillane (seller account) needs to add street address on profile before real quotes work.

---

## Pending Features / Tasks

### High priority — next session
1. **Seller order flow** — seller needs to see their incoming orders, upload a tracking number, and mark as shipped. No UI or API exists yet.
   - New page: `/seller/orders` (or a tab on `/orders`)
   - New API: `POST /api/orders/[id]/ship` — accepts waybill + carrier, advances to `SHIPPED`
   - Seller sees: item sold, buyer's suburb (not full address), drop-off method, due date
2. **Run migrations 006 + 007** in Supabase before demoing locker flow
3. **Add street addresses** to both test accounts on profile page so real TCG quotes fire

### Medium priority
4. **Peach Payments integration** — waiting on credentials. Once received: replace the demo card form on `/orders/[id]` with actual Peach initiation
5. **Order state machine beyond demo** — auto-cancel after 3 business days, SHIPPED → IN_TRANSIT webhook from TCG, OUT_FOR_DELIVERY → DELIVERED
6. **Drop `items` table** — migrate FKs, then drop

### Low priority / post-prototype
7. **Dispute flow** — 14-day window, evidence upload, admin resolution
8. **Push notifications** — buyer/seller order updates via Supabase Realtime or SNS
9. **Mobile app** (Expo) — not started this sprint
10. **Street address autocomplete** — Google Places or ZA-specific
11. **Dark/Light theme toggle**

---

## Key File Map

```
apps/web/
  app/
    browse/page.tsx                     — Browse + filter listings
    item/[id]/page.tsx                  — Listing detail + Buy Now button
    sell/new/page.tsx                   — Sell wizard (listing creation)
    checkout/[listingId]/page.tsx       — Shipping quote selection + order confirm
                                          ← pre-checks street address client-side
    orders/page.tsx                     — Buyer orders list (tabs, status chips)
    orders/[id]/page.tsx                — Order detail (timeline, demo pay, confirm)
    profile/page.tsx                    — Delivery Address card + My Schools card
                                          ← Preferred PUDO Locker section added today
    onboarding/page.tsx                 — 4-step signup flow
    api/
      shipping/rates/route.ts           — TCG rate fetch (D2D + L2D + D2L + L2L)
      orders/route.ts                   — Order creation
      orders/[id]/pay/route.ts          — Demo payment (PENDING → AWAITING_SHIPMENT_BOOKING)
      orders/[id]/confirm/route.ts      — Buyer confirms receipt (DELIVERED → COMPLETED)
      lockers/search/route.ts           — TCG locker search proxy (NEW today)
      locations/
        cities/route.ts
        suburbs/route.ts
        suburbs/search/route.ts
        schools/route.ts
  src/lib/
    supabase.ts                         — Anon client (browser)
    supabase-server.ts                  — Service-role client (API routes only)

packages/shared/
  types/shipping.ts     — ShippingQuote, TCGRateOption, all 4 shipping methods, helpers
  types/location.ts     — Province, City, Suburb, School types
  src/index.ts          — Re-exports for @nextkid/shared

supabase/migrations/
  001–005               — Applied
  006_buyer_preferred_locker.sql        — ⏳ Run this
  007_demo_listings_shipping_methods.sql — ⏳ Run this
```

---

## Shipping Logic Summary (important — read before touching rates/checkout)

```
Seller config (per listing)     →    Buyer options at checkout
─────────────────────────────────────────────────────────────────
PICKUP                          →    D2D (always)
PICKUP + buyer has locker       →    D2D + D2L
PUDO_DROPOFF + seller locker    →    L2D (always)
PUDO_DROPOFF + both have lockers →   L2D + L2L
```

- Seller's locker: `listings.pudo_locker_id` / `pudo_locker_name`
- Buyer's locker: `profiles.preferred_locker_id` / `preferred_locker_name`
- If TCG returns no quotes (API unavailable / missing addresses): demo fallback fires (R142 Economy, R205 Overnight), response includes `{ demo: true }`

---

## Environment Variables

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

## Start Next Session With

1. Run migrations 006 and 007 in Supabase SQL editor
2. Add a street address to both test accounts on the profile page
3. Optionally: set a preferred PUDO locker on the buyer account to test D2L / L2L quotes
4. Verify the full buy flow end-to-end: Buy Now → checkout shows real quotes → place order → demo pay → AWAITING_SHIPMENT_BOOKING
5. Then build the **seller order flow** (see High Priority #1 above)
