# NextKid — End of Day Brief
**Date:** 2026-05-11

Paste this file into a new Claude Code session to resume exactly where we left off.

---

## What NextKid Is

Peer-to-peer school marketplace (SA). Parents/students buy & sell textbooks, uniforms, school gear.

- **Web:** Next.js App Router — `apps/web/`
- **Mobile:** Expo React Native — `apps/mobile/`
- **Backend:** Next.js API routes → Supabase (PostgreSQL + Auth)
- **Shipping:** The Courier Guy (TCG) via `https://api-pudo.co.za`
- **Payments:** Peach Payments (escrow) — credentials pending, demo mode in place
- **Monorepo:** pnpm workspaces — `apps/web`, `apps/mobile`, `packages/shared`

---

## What's Been Built (completed & working)

### Web
| Feature | Status |
|---|---|
| Auth (Supabase email) + Forgot password flow | ✅ Done |
| Password reset page (`/auth/reset-password`) | ✅ Done |
| Onboarding 4-step flow (name → dob optional → location → address) | ✅ Done |
| Location cascade: Province → City → Suburb (all 9 provinces + 54+ cities) | ✅ Done |
| Global school search — all 25,527 SA schools via DBE EMIS import | ✅ Done |
| Browse page with filters | ✅ Done |
| Listing detail (item page) + Buy Now button | ✅ Done |
| Sell wizard (listing creation with parcel dims + shipping method config) | ✅ Done |
| Profile page — Delivery Address + My Schools cards | ✅ Done |
| Multi-school select — global cross-province search | ✅ Done |
| Buyer orders list (`/orders`) — tabs, status chips | ✅ Done |
| Order detail (`/orders/[id]`) — progress timeline, demo payment, confirm receipt | ✅ Done |
| Shipping quotes API (`/api/shipping/rates`) — D2D + L2D + D2L + L2L | ✅ Done |
| Checkout page — quote selection, locker picker, order summary, place order | ✅ Done |
| PUDO locker map with driving directions — click anywhere, OSRM route draws, ETA chip, Open in Google Maps | ✅ Done |
| Brand: crimson `#BE1E2D`, charcoal `#3A3A3A`, Bebas Neue font, logo SVG, favicon | ✅ Done |
| Age restriction removed — all users `role: 'buyer'`, DOB optional | ✅ Done |

### Mobile (Expo React Native)
| Feature | Status |
|---|---|
| Auth + Forgot password | ✅ Done |
| Onboarding — location cascade, global school search, GPS detect | ✅ Done |
| Browse screen — queries `listings` table, crimson brand | ✅ Done |
| Sell wizard — full 5-step, writes to `listings` table | ✅ Done |
| Profile — listings tab, school search (global API), crimson brand | ✅ Done |
| Orders list tab — All / Active / Done tabs, status chips | ✅ Done |
| Order detail — timeline, demo payment form, confirm receipt | ✅ Done |
| Checkout — shipping quotes (via web API), PUDO locker picker (list), place order | ✅ Done |
| Item detail — `listings` table, Buy Now button → checkout | ✅ Done |
| Tab bar — Browse / Sell / Orders / Profile with Lucide icons | ✅ Done |

---

## How to Run

**Web server** (Terminal 1):
```powershell
cd C:\NextKid\NextKid-proto\apps\web
node .\node_modules\next\dist\bin\next dev -p 5000 -H 0.0.0.0
```

**Mobile (Expo)** (Terminal 2):
```powershell
cd C:\NextKid\NextKid-proto\apps\mobile
node .\node_modules\expo\bin\cli start --port 8082
```

Scan QR code with Expo Go app on phone. Phone and PC must be on same Wi-Fi.

---

## Brand / Design System

| Token | Value | Usage |
|---|---|---|
| Crimson | `#BE1E2D` | Accent — buttons, prices, links, highlights |
| Crimson dark | `#9B1824` | Hover state for crimson elements |
| Charcoal | `#3A3A3A` | Hero banners, primary dark backgrounds |
| Surface | `#f4f4f4` | Card/input backgrounds |
| Border | `#dedede` | Dividers, input borders |
| Muted | `#979797` | Secondary text |

**Font:** Bebas Neue (display/brand) + Roboto (body) — web only via `next/font/google`.

---

## DB Notes

- **Two tables exist:** `items` (legacy, do not use) and `listings` (active, all new data goes here)
- `listings.price_cents` — stored in cents (integer), display as `R {cents/100}`
- `listings.status` — uppercase: `'ACTIVE'`, `'SOLD'`, `'DELISTED'`, `'ARCHIVED'`
- `listings.condition` — uppercase: `'NEW'`, `'LIKE_NEW'`, `'GOOD'`, `'FAIR'`
- `profiles.province` — stores full province name (e.g. `'Gauteng'`), **NOT** `province_code`
- `profiles.school_ids` — `text[]`, source of truth for multi-school
- `profiles.role` — always `'buyer'` (age gate removed)
- `schools.province_code` — uses full province name (e.g. `'Gauteng'`) matching cities/suburbs
- `schools` — 25,527 rows imported from DBE EMIS National Excel (Q3 2025)

---

## Migrations Run

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
| 009 | `009_all_provinces_cities.sql` | ✅ Applied |
| 010 | `010_all_provinces_schools.sql` | ✅ Applied (run in Supabase SQL editor) |

**Schools import:** Run `node scripts/import-schools.js` to re-import from `scripts/dbe-data/National.xlsx`.

---

## TCG API Status

The TCG `/lockers-data` endpoints return **404** — API key exists but account not activated.

**Workaround:** `apps/web/app/api/lockers/seed.ts` — 25 real Gauteng PUDO lockers used as fallback.

**To activate:** Delete `seed.ts` and the `catch` fallback in `apps/web/app/api/lockers/nearby/route.ts`.

---

## Test Accounts

- **Seller:** `phillane.troskie@gmail.com` — Waterkloof House Prep, Sandton/Johannesburg
- **Buyer:** `phillane.troskie+buyer@gmail.com` — Fourways/Gauteng

Both need a street address on profile for real TCG quote flow.

---

## Active Bugs / Issues

### 🟡 items table FK dependencies not migrated
`offers`, `bids`, `likes`, `notifications` tables still FK to `items.id`.
`items` table cannot be dropped yet.

### 🟡 Seller has no street address
Real TCG quotes require seller's street address. Demo fallback fires for now.

---

## Pending Features / Tasks

### High priority
1. **Seller order flow** — seller needs to see incoming orders, upload tracking, mark as shipped
   - New page: `/seller/orders`
   - New API: `POST /api/orders/[id]/ship` — accepts waybill + carrier, advances to `SHIPPED`

### Medium priority
2. **Peach Payments integration** — waiting on credentials
3. **Order auto-cancel** — 3 business days, TCG webhook for SHIPPED → IN_TRANSIT
4. **Drop `items` table** — migrate FKs first

### Low priority / post-prototype
5. **Dispute flow** — 14-day window, evidence upload, admin resolution
6. **Push notifications** — Supabase Realtime or SNS
7. **Street address autocomplete**

---

## Environment Variables

**Web (`apps/web/.env.local`):**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          ← needed for scripts/import-schools.js
TCG_API_KEY=54041081|6SxxLLpujh5lV91PJjrVuxmO3aE38y6qgQubcFbG33fbe7be
TCG_API_BASE_URL=https://api-pudo.co.za
PEACH_PAYMENTS_ENTITY_ID=           ← PENDING
PEACH_PAYMENTS_ACCESS_TOKEN=        ← PENDING
PLATFORM_COMMISSION_RATE=0.08
```

**Mobile (`apps/mobile/.env`):**
```
EXPO_PUBLIC_WEB_API_URL=http://192.168.0.190:5000   ← your local IP when testing
EXPO_PUBLIC_COMMISSION_RATE=0.08
```

---

## Key File Map

```
apps/web/app/
  page.tsx                         — Login + forgot password
  auth/reset-password/page.tsx     — Password reset (after email link)
  dashboard/page.tsx               — Dashboard
  browse/page.tsx                  — Browse + filter listings
  item/[id]/page.tsx               — Listing detail + Buy Now
  sell/new/page.tsx                — Sell wizard
  checkout/[listingId]/page.tsx    — Checkout (shipping quotes + locker picker)
  orders/page.tsx                  — Buyer orders list
  orders/[id]/page.tsx             — Order detail (timeline, demo pay, confirm)
  profile/page.tsx                 — Delivery Address + My Schools
  onboarding/page.tsx              — 4-step signup
  components/
    Navbar.tsx
    LockerMapPicker.tsx            — Map with OSRM driving directions
    LockerMapInner.tsx
  api/
    shipping/rates/route.ts
    orders/route.ts
    orders/[id]/pay/route.ts
    orders/[id]/confirm/route.ts
    lockers/nearby/route.ts
    lockers/seed.ts                — Gauteng locker seed (fallback)
    lockers/search/route.ts
    locations/cities, suburbs, schools, schools/search

apps/mobile/app/
  index.tsx                        — Login + forgot password
  onboarding.tsx                   — Location + global school search + GPS
  (tabs)/
    _layout.tsx                    — Browse / Sell / Orders / Profile tabs
    index.tsx                      — Browse (queries listings)
    sell.tsx                       — Sell wizard
    orders.tsx                     — Orders list
    profile.tsx                    — Profile + global school search
  order/[id].tsx                   — Order detail + pay + confirm
  checkout/[listingId].tsx         — Checkout + locker picker
  item/[id].tsx                    — Listing detail + Buy Now

apps/mobile/src/
  lib/supabase.ts
  lib/api.ts                       — WEB_API_BASE constant
  components/LockerPicker.tsx      — List-based PUDO locker picker

scripts/
  import-schools.js               — DBE school bulk import script
  dbe-data/National.xlsx          — Source file (25,527 schools)
```
