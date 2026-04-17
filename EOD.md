# NextKid — End of Day Brief
**Date:** 2026-04-01

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
| Onboarding 4-step flow (name → dob → location → address) | ✅ Done |
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
| Checkout: pre-check buyer street address client-side | ✅ Done |
| Profile: Preferred PUDO Locker section in Delivery Address card | ✅ Done |
| `/api/lockers/search` — server-side TCG locker proxy, 1-hour cache | ✅ Done |
| Shipping rates: D2L + L2L quotes when buyer has a preferred locker saved | ✅ Done |
| Navbar "Orders" tab for logged-in buyers | ✅ Done |
| PUDO locker map: Gauteng seed list (25 real lockers) — fallback until TCG API active | ✅ Done |
| `/api/lockers/nearby` — geocodes suburb+city via Nominatim, returns nearest PUDO lockers | ✅ Done |
| Migration 008: `orders.delivery_locker_id` + `delivery_locker_name` for D2L/L2L | ✅ Done |
| **Brand colours applied** — NextKid crimson `#BE1E2D` replacing old blue across web + mobile | ✅ Done today |
| **Bebas Neue font** — loaded via `next/font/google`, registered as `--font-bebas` | ✅ Done today |
| **Logo SVG** — `public/logo.svg`: NEXT(charcoal)/KID(crimson) + "WEAR. GROW. REPEAT." tagline | ✅ Done today |
| **Favicon** — `app/icon.svg`: NK monogram, charcoal bg, crimson K (auto-picked up by Next.js) | ✅ Done today |
| **Login page redesign** — charcoal left panel, PDF manifesto copy, community badge, feature list | ✅ Done today |
| **Navbar logo** — NEXT(charcoal)/KID(crimson) in Bebas Neue | ✅ Done today |
| **Dashboard hero** — charcoal banner, gray trust bar, crimson CTA | ✅ Done today |
| **Age restriction removed** — no more 18+ gate; all users get `role: 'buyer'`; DOB kept as optional | ✅ Done today |

---

## Brand / Design System

| Token | Value | Usage |
|---|---|---|
| Crimson | `#BE1E2D` | Accent — buttons, prices, links, highlights |
| Crimson dark | `#9B1824` | Hover state for crimson elements |
| Charcoal | `#3A3A3A` | Hero banners, primary dark backgrounds |
| Gray | `#6B6B6B` | Secondary banners (trust bar etc.) |
| Surface | `#f4f4f4` | Card/input backgrounds |
| Border | `#dedede` | Dividers, input borders |
| Text secondary | `#979797` | Muted labels |

**Font:** Bebas Neue (display/brand headings) + Roboto (body). Both loaded via `next/font/google`.
- Use `var(--font-bebas)` in inline styles for brand text (NEXTKID logo, section headers)
- Tailwind classes `bg-[#3A3A3A]`, `bg-[#6B6B6B]` for banner backgrounds

---

## DB Notes

- **Two tables exist:** `items` (legacy, do not use) and `listings` (active, all new data goes here)
- `listings.price_cents` — stored in cents (integer), display as `R {cents/100}`
- `listings.status` — uppercase: `'ACTIVE'`, `'SOLD'`, `'DELISTED'`, `'ARCHIVED'`
- `listings.condition` — uppercase: `'NEW'`, `'LIKE_NEW'`, `'GOOD'`, `'FAIR'`, `'POOR'`
- `listings.shipping_methods` — `text[]` e.g. `ARRAY['PICKUP', 'PUDO_DROPOFF']`
- `profiles.province` — stores full province name (e.g. `'Gauteng'`), **NOT** `province_code`
- `profiles.school_ids` — `text[]`, source of truth for multi-school. No FK constraint (prototype trade-off).
- `profiles.school_id` — single text with FK to `schools.id` — first school in school_ids
- `profiles.role` — always `'buyer'` now (age gate removed; `browse_only` no longer assigned)
- `profiles.is_age_verified` — column still exists in DB but is no longer read or written by the app
- `profiles.preferred_locker_id` / `preferred_locker_name` / `preferred_locker_address` — buyer's preferred PUDO locker
- `orders.delivery_locker_id` / `delivery_locker_name` — buyer's chosen collection locker (D2L/L2L)
- `schools.province_code` — the schools table DOES use `province_code` (not `province`)

---

## Migrations Run / Pending

| # | File | Status |
|---|---|---|
| 001 | `001_schema_and_seed.sql` | ✅ Applied |
| 002 | `002_listings_extra_columns.sql` | ✅ Applied |
| 003 | `003_rls_fix.sql` | ✅ Applied |
| 004 | `004_migrate_items_to_listings.sql` | ✅ Applied |
| 005 | `005_school_ids_text_array.sql` | ✅ Applied |
| 006 | `006_buyer_preferred_locker.sql` | ✅ Applied |
| 007 | `007_demo_listings_shipping_methods.sql` | ✅ Applied |
| 008 | `008_orders_delivery_locker.sql` | ✅ Applied |

All migrations up to date. No pending migrations.

---

## TCG API Status

The TCG `/lockers-data` (and all other) endpoints return **404** — the API key exists but the account has not been activated for production API access by TCG yet.

**Workaround in place:** `apps/web/app/api/lockers/seed.ts` — 25 real Gauteng PUDO locker locations used as a fallback in `/api/lockers/nearby/route.ts`.

**To remove the seed once TCG activates the key:**
1. Delete `apps/web/app/api/lockers/seed.ts`
2. Remove the `catch` fallback block in `apps/web/app/api/lockers/nearby/route.ts`

---

## Test Accounts

- **Seller:** `phillane.troskie@gmail.com` — 2 profile schools (Waterkloof House Prep + school_014), Sandton/Johannesburg
- **Buyer:** `phillane.troskie+buyer@gmail.com` — Fourways/Gauteng location

Both users need a street address set on their profile before real TCG quote flow works.

---

## Active Bugs / Issues

### 🟡 items table FK dependencies not migrated
`offers`, `bids`, `likes`, `notifications` tables still FK to `items.id`, not `listings.id`.
`items` table cannot be dropped yet.
**Next step:** Migration to update those FKs, then drop `items`.

### 🟡 Seller has no street address
Real TCG quotes require the seller's street address. For now, the demo fallback fires.

---

## Pending Features / Tasks

### High priority — next session
1. **Seller order flow** — seller needs to see their incoming orders, upload a tracking number, and mark as shipped. No UI or API exists yet.
   - New page: `/seller/orders` (or a tab on `/orders`)
   - New API: `POST /api/orders/[id]/ship` — accepts waybill + carrier, advances to `SHIPPED`
   - Seller sees: item sold, buyer's suburb (not full address), drop-off method, due date

### Medium priority
2. **Peach Payments integration** — waiting on credentials. Once received: replace the demo card form on `/orders/[id]` with actual Peach initiation
3. **Order state machine beyond demo** — auto-cancel after 3 business days, SHIPPED → IN_TRANSIT webhook from TCG
4. **Drop `items` table** — migrate FKs, then drop
5. **TCG API activation** — contact TCG to activate the API key, then remove the locker seed fallback

### Low priority / post-prototype
6. **Dispute flow** — 14-day window, evidence upload, admin resolution
7. **Push notifications** — buyer/seller order updates via Supabase Realtime or SNS
8. **Mobile app** (Expo) — brand colours applied but UI not yet aligned with new design system
9. **Street address autocomplete** — Google Places or ZA-specific

---

## Key File Map

```
apps/web/
  app/
    page.tsx                             — Login/landing page (redesigned with brand)
    layout.tsx                           — Loads Bebas Neue + Roboto from Google Fonts
    globals.css                          — CSS vars: --coral, --charcoal, --gray-mid etc.
    icon.svg                             — Favicon (NK monogram, auto-picked by Next.js)
    dashboard/page.tsx                   — Dashboard (charcoal hero, gray trust bar)
    browse/page.tsx                      — Browse + filter listings
    item/[id]/page.tsx                   — Listing detail + Buy Now (no age gate)
    sell/new/page.tsx                    — Sell wizard
    checkout/[listingId]/page.tsx        — Shipping quote selection + order confirm
    orders/page.tsx                      — Buyer orders list
    orders/[id]/page.tsx                 — Order detail (timeline, demo pay, confirm)
    profile/page.tsx                     — Delivery Address card + My Schools card
    onboarding/page.tsx                  — 4-step signup (DOB now optional, no age gate)
    components/
      Navbar.tsx                         — NEXT(charcoal)/KID(crimson) logo in Bebas Neue
      LockerMapPicker.tsx
      LockerMapInner.tsx
    api/
      shipping/rates/route.ts
      orders/route.ts
      orders/[id]/pay/route.ts
      orders/[id]/confirm/route.ts
      lockers/nearby/route.ts
      lockers/seed.ts                    — Gauteng locker seed (fallback until TCG API active)
      lockers/search/route.ts
      locations/cities, suburbs, schools

public/
  logo.svg                               — NEXTKID brand logo SVG

packages/shared/
  types/shipping.ts
  types/location.ts
  src/index.ts
```

---

## Shipping Logic Summary

```
Seller config (per listing)      →    Buyer options at checkout
─────────────────────────────────────────────────────────────────
PICKUP                           →    D2D (always)
PICKUP + buyer has locker        →    D2D + D2L
PUDO_DROPOFF + seller locker     →    L2D (always)
PUDO_DROPOFF + both have lockers →    L2D + L2L
```

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

1. Build the **seller order flow** (see High Priority #1 above)
2. Add a street address to both test accounts (needed for real TCG quotes)
3. Optionally verify full buy flow end-to-end with the new brand applied