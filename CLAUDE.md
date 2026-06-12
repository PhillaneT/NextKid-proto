# CLAUDE.md — NextKid App

## Project Overview
A peer-to-peer Marketplace platform (web + mobile) where users can buy and sell physical items — focused on school uniforms, textbooks, and kids' gear.
Features include escrow-based payments via Stitch, a hub-based fulfilment network of partner schools ("Klerebanks") using dual HMAC-signed QR codes (drop-off / collection), a school referral programme with monthly ledgers and payouts, children's profile-based size prediction and smart-feed targeting, a lifecycle reminder engine, wishlists with price-drop alerts, and a platform commission on completed sales. (Ratings/reviews are aspirational copy only — not yet implemented, see "Wishlists & Reviews".)

**Web:** Next.js (App Router)
**Mobile:** Expo (React Native)
**Backend:** Next.js API routes → will migrate to AWS (Lambda, API Gateway, DynamoDB, S3, SES, SNS)
**Payments:** Stitch (Express REST API, SA-based, platform-as-middleman model — no native escrow needed)
**Primary fulfilment:** Klerebank hub network — see "School (Klerebank) Hub Network" and "QR-Based Hub Fulfilment" below
**Secondary/legacy fulfilment:** The Courier Guy API (via api-pudo.co.za) — door/locker shipping, see "Shipping & Courier Integration"
**Auth:** Supabase Auth (`auth.users` + `supabase.auth.getUser()`/Bearer tokens). `NEXTAUTH_URL`/`NEXTAUTH_SECRET` env vars exist only as a fallback base URL for building links in transactional emails — NextAuth.js itself is not wired up. AWS Cognito is a future-migration candidate, not current state.
**Language:** TypeScript (strict mode — no `any`, ever)

---

## Known Prototype Trade-offs (Fix at AWS Migration)

These are conscious, documented shortcuts made during the prototype. Do not "fix" them before the AWS migration — they are not bugs.

### `profiles.school_ids` is `text[]`, not `uuid[]`
- **Why:** Seed school data uses slug IDs (`school_011`, `school_012`, etc.) instead of UUIDs. The `school_ids` column was originally `uuid[]`, which caused a type mismatch. Migration `005_school_ids_text_array.sql` changed it to `text[]` to unblock the prototype.
- **At AWS migration:** Real SA school data (from Dept. of Basic Education) will be imported with `gen_random_uuid()` IDs. At that point, change `school_ids` back to `uuid[]`, update `school_id` to `uuid references schools(id)`, and reseed. The rest of the schema (listings, profiles) already uses UUIDs correctly.
- **Do not add FK constraint** to `school_ids text[]` — it cannot reference a table. Referential integrity on the primary school is enforced via `school_id text references schools(id)`.

### TCG PUDO locker seed list
- **Why:** The TCG API key is provisioned but the account has not been activated for production API access by TCG. All endpoints (`/lockers-data`, `/rates`, etc.) return 404.
- **Workaround:** `apps/web/app/api/lockers/seed.ts` — 25 real Gauteng PUDO locker locations. The `/api/lockers/nearby` route falls back to this seed inside a `catch` block when the live API fails.
- **At activation:** Delete `seed.ts` and the `catch` fallback in `apps/web/app/api/lockers/nearby/route.ts`. The live API takes over automatically.

### Stitch payment webhook is not yet built
- **Why:** `apps/web/src/lib/stitch.ts` implements `createPaymentRequest()` (creates a Stitch Express payment link) and `verifyWebhookSignature()` (Svix HMAC verification, ready to use), and `POST /api/orders/[id]/pay` already points Stitch's webhook at `${NEXT_PUBLIC_APP_URL}/api/webhooks/stitch` — but that route does not exist yet, so a real payment never advances the order past `PENDING_PAYMENT`.
- **Workaround:** `POST /api/orders/[id]/simulate-payment` (gated to `localhost`/`ngrok` hosts or `NODE_ENV !== 'production'`) manually performs what the real webhook should do on `payment.succeeded`: order → `AWAITING_DROPOFF`, `payment_status='HELD'`, `auto_dropoff_at = now + 72h`, generates the waybill + DROPOFF QR.
- **At AWS migration / before going live:** Build `POST /api/webhooks/stitch` using the existing `verifyWebhookSignature()`, replicate the state transition from `simulate-payment`, then remove (or further lock down) `simulate-payment`.

### The Klerebank hub flow is the only fulfilment path currently wired up
- **Why:** `simulate-payment` routes **every** order — regardless of `delivery_type` (`'school'` vs `'courier'`) — into `AWAITING_DROPOFF` with a waybill + DROPOFF QR. The legacy TCG courier states (`AWAITING_SHIPMENT_BOOKING` → ... → `DELIVERED`) remain in the `orders_status_check` constraint, and `delivery_locker_id`/`shipping_method`/`service_level_code` are still captured at checkout for non-school orders, but nothing transitions an order through them.
- **At AWS migration:** Decide whether `delivery_type='courier'` orders should get a genuinely different fulfilment flow (TCG shipment booking + tracking) or whether the Klerebank hub network should be the only model and the TCG/locker checkout UI should be removed. This is a product decision — ask the user before building either direction.

### `auto_dropoff_at` / COLLECTION QR expiry are not enforced
- **Why:** `orders.auto_dropoff_at` (set to `paid_at + 72h`) and the COLLECTION QR's 14-day `expires_at` are both written, and notification copy for `AUTO_CANCELLED`/`UNCOLLECTED` exists in `sendOrderNotification()`, but no cron job currently checks these and flips overdue orders.
- **At AWS migration:** Add a scheduled job (alongside `/api/cron/reminders`) that finds orders past `auto_dropoff_at` still in `AWAITING_DROPOFF` → `AUTO_CANCELLED` + refund, and orders with an expired unused COLLECTION token still in `ITEM_AT_HUB` → `UNCOLLECTED`.

---

## Post-Prototype Backlog
> These features are intentionally deferred until the prototype is approved. Do not build them now.

- **Auto location detection on load** — Currently the onboarding location step uses an opt-in "Use my current location" button (mobile) and a suburb text search (web). After prototype approval, replace these with automatic location detection on page/screen load: browser Geolocation API (web) and `expo-location` on mount (mobile), with a permission prompt appearing immediately. Fall back gracefully to the manual cascade if permission is denied.

---

## Architecture Overview

```
/
├── apps/
│   ├── web/          # Next.js web app (App Router)
│   └── mobile/       # Expo React Native app
├── packages/
│   ├── shared/       # Shared types, utils, constants
│   ├── ui/           # Shared UI components (web + mobile)
│   └── api-client/   # Typed API client used by both apps
└── CLAUDE.md
```

---

## Core Business Rules (Never Violate These)

### Users
- All users must have a verified email AND phone before transacting (no age restriction — students with their own bank accounts can buy and sell)
- All users must complete location profile (Province → City → Suburb → School) before transacting
- Sellers must connect a verified payout bank account before listing
- Buyers must add at least one valid payment method before purchasing
- Fully anonymous, from Courier info to Delivery, both parties info only exist on their profiles, not on the items for sale or buying items.

### Payments & Escrow
- All payments go through **Stitch** (Express REST API, SA-based) — no direct buyer-to-seller transfers
- **Funds are released to the seller when a Klerebank admin scans the buyer's COLLECTION QR** (`POST /api/qr/scan`) — order → `COMPLETED`, `payment_status` → `CAPTURED`, and a `seller_payouts` row is created. See "QR-Based Hub Fulfilment" below.
- Platform commission (`PLATFORM_COMMISSION_RATE`, currently 7.5%) is calculated and deducted at the moment of collection: `seller_payout_cents = item_price_cents - round(item_price_cents * commissionRate)`
- No commission is taken on refunded, cancelled, or auto-cancelled orders
- Stitch processes ZAR natively — no currency conversion needed
- For same-school orders, delivery costs a flat **R20** (`fee_config.school_delivery_fee`), split R10 platform / R10 to the matched school's Klerebank ledger — locked in at order creation via `delivery_school_id`
- Courier (TCG) cost, where applicable, is on the buyer and added to checkout from the locked shipping quote
- `POST /api/orders/[id]/confirm` (buyer-confirms-receipt → `COMPLETED`) is a **legacy** endpoint from the original TCG-courier model; it requires `status='DELIVERED'`, which no current code path produces — see "Order State Machine"

### Listings
- Prohibited items are strictly banned (weapons, counterfeits, illegal goods)
- Listings must include: photos, description, price, category (+ subcategory), location, AND parcel dimensions
- Sellers must specify parcel dimensions (L × W × H cm + weight kg) before listing goes live
- Sellers must have at least one shipping method configured in their profile
- A listing can be **multi-item** (`is_multi_item`) — buyers select individual `listing_items`; see "Multi-Item Listings, Reservations & Order Items" below
- **Categories/subcategories** are hardcoded constants in `packages/shared/src/constants.ts` (`ALL_CATEGORIES`, `SUBCATEGORIES`, `CATEGORY_EMOJI`) — not a database table. `SCHOOL_SPECIFIC_CATEGORIES` (Uniforms, Sports Kit) vs `NATIONWIDE_CATEGORIES` (Shoes, Books, etc.) drives whether school-based filtering applies
- **Photos** are uploaded client-side straight to the Supabase Storage bucket `item-images` (`apps/web/app/sell/new/page.tsx`), then the public URLs are stored in `listings.images text[]`. The bucket is **not created by any migration** — it must exist in the Supabase project already. **Mobile sell flow (`apps/mobile/app/(tabs)/sell.tsx`) does not yet implement photo upload** — it submits `images: []`

### Orders & Shipping
- Seller has **maximum 3 business days** (`DROPOFF_TTL_HOURS = 72`) to drop the item at the matched Klerebank hub after payment is confirmed — tracked via `orders.auto_dropoff_at`
- Buyer has **14 days** (`COLLECTION_TTL_HOURS = 336`) to collect after drop-off, using the COLLECTION QR
- Auto-cancel + full refund is the *intended* behaviour if the seller misses drop-off — **not yet enforced by a cron job** (see Known Prototype Trade-offs)
- Shipping address is pulled from buyer profile (editable before shipment) — applies to the legacy TCG courier path only

### Disputes
> **Not yet implemented.** No `disputes` table and no dispute-opening endpoint exist. `DISPUTED`/`RESOLVED_REFUND`/`RESOLVED_RELEASED` remain reserved values in `orders_status_check` and appear only in status-label maps on the web/mobile order screens. The rules below describe the *intended* design — confirm scope with the user before building any of this.

- Buyer has **14 days** from delivery confirmation to open a dispute
- Both parties must upload evidence (photos, videos, chat screenshots, tracking)
- Seller has 72 hours to respond before admin can rule in buyer's favour
- Admin resolves: full refund / partial refund / release funds to seller

### Filtering & Discovery (Critical Feature)
- Category → Subcategory → Sub-subcategory hierarchy must be strictly enforced
- Location filtering: country → province/state → city → suburb → school
- Filters: price range, condition, category, keywords, sort (newest, price asc/desc, distance)
- Search must be fast — use debounce on keyword input (300ms)
- Never show out-of-stock or delisted items in results
- **School-based filtering:** Users can filter to see items from their school only, or items for sale nationally
- **Smart Homepage feed:** additionally matches listings to the user's children's profiles via `size_numeric`/`gender_target`/`sport_tag`, cached per-user for 1 hour in `user_feed_cache` — see "Smart Feed & Listing Targeting" below

---

## User Profile & Location (Required for All Users)

### Overview
This is a **Marketplace** focused on textbooks, uniforms, and school-related items. All users must complete their location and school profile before they can buy or sell.

### Location Hierarchy
```
Province → City → Suburb → School
```

The database stores this hierarchy to enable fast cascading filters:
1. User selects **Province** → City dropdown populates with cities in that province
2. User selects **City** → Suburb dropdown populates with suburbs in that city
3. User selects **Suburb** → School dropdown populates with schools in that suburb
4. User selects **School** → Profile complete

### Data Models

```typescript
// packages/shared/types/location.ts

// South African Provinces (static, seeded data)
type Province = 
  | 'Eastern Cape'
  | 'Free State'
  | 'Gauteng'
  | 'KwaZulu-Natal'
  | 'Limpopo'
  | 'Mpumalanga'
  | 'Northern Cape'
  | 'North West'
  | 'Western Cape';

interface City {
  id: string;
  name: string;
  provinceCode: Province;
}

interface Suburb {
  id: string;
  name: string;
  cityId: string;
  // Denormalized for faster queries
  cityName: string;
  provinceCode: Province;
}

interface School {
  id: string;
  name: string;
  type: 'PRIMARY' | 'SECONDARY' | 'COMBINED' | 'COLLEGE' | 'UNIVERSITY';
  suburbId: string;
  // Denormalized for faster queries
  suburbName: string;
  cityId: string;
  cityName: string;
  provinceCode: Province;
  // Optional metadata
  address?: string;
  isVerified: boolean;  // Admin-verified school
}
```

### User Profile

```typescript
// packages/shared/types/user.ts

interface UserProfile {
  id: string;
  
  // Auth & Verification
  email: string;
  emailVerified: boolean;
  phone: string;
  phoneVerified: boolean;
  isOver18: boolean;
  
  // Personal Info
  firstName: string;
  lastName: string;
  displayName: string;
  avatarUrl?: string;
  
  // Location (ALL REQUIRED)
  location: {
    provinceCode: Province;
    cityId: string;
    cityName: string;           // Denormalized
    suburbId: string;
    suburbName: string;         // Denormalized
    
    // Full address for shipping
    streetAddress: string;
    postalCode: string;
    
    // Coordinates for distance calculations
    latitude?: number;
    longitude?: number;
  };
  
  // School (REQUIRED)
  school: {
    schoolId: string;
    schoolName: string;         // Denormalized
    schoolType: School['type'];
    graduationYear?: number;    // Optional: expected/actual graduation year
    isCurrentStudent: boolean;  // Currently attending vs alumni
  };
  
  // NextKid settings
  sellerProfile?: SellerShippingProfile;  // Only if user wants to sell
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  profileCompletedAt?: Date;    // Set when location + school are filled
}

// RULE: User cannot list or purchase until profileCompletedAt is set
```

### Critical Column Name Distinction — `province` vs `province_code`

**`profiles` table uses `province`** (full name, e.g. `'Gauteng'`) — NOT `province_code`.
**`schools`, `cities`, `suburbs` tables use `province_code`** (e.g. `'GP'`).

Querying `province_code` on `profiles` causes a **silent failure** — PostgREST returns an error, the query result is `null`, and no data loads. This burned us on the sell wizard school picker and the locker map. Always double-check the table before using either column name.

### Database Schema (Optimized for Fast Filtering)

```sql
-- Indexes for fast cascading dropdowns
CREATE INDEX idx_cities_province ON cities(province_code);
CREATE INDEX idx_suburbs_city ON suburbs(city_id);
CREATE INDEX idx_schools_suburb ON schools(suburb_id);

-- Indexes for listing discovery
CREATE INDEX idx_users_school ON users(school_id);
CREATE INDEX idx_users_suburb ON users(suburb_id);
CREATE INDEX idx_users_city ON users(city_id);
CREATE INDEX idx_users_province ON users(province_code);

CREATE INDEX idx_listings_school ON listings(seller_school_id);
CREATE INDEX idx_listings_suburb ON listings(seller_suburb_id);
CREATE INDEX idx_listings_city ON listings(seller_city_id);

-- Composite index for common filter: "items at my school in this category"
CREATE INDEX idx_listings_school_category ON listings(seller_school_id, category_id, status);
```

### API Endpoints for Location Selection

```typescript
// Cascading dropdown endpoints - each returns only relevant options

// GET /api/locations/provinces
// Returns: Province[] (static list)

// GET /api/locations/cities?province=Gauteng
// Returns: City[] filtered by province

// GET /api/locations/suburbs?cityId=xxx
// Returns: Suburb[] filtered by city

// GET /api/locations/schools?suburbId=xxx
// Returns: School[] filtered by suburb

// Optional: Search schools across all locations
// GET /api/locations/schools/search?q=hoerskool&limit=10
// Returns: School[] with full location path for display
```

### Filtering Logic for Listings

```typescript
// packages/shared/types/filters.ts

interface ListingFilters {
  // Location filters (cascading)
  provinceCode?: Province;
  cityId?: string;
  suburbId?: string;
  schoolId?: string;
  
  // Special location modes
  locationMode: 
    | 'MY_SCHOOL'           // Only items from user's school
    | 'MY_SUBURB'           // Items from any school in user's suburb
    | 'MY_CITY'             // Items from any school in user's city
    | 'NEARBY'              // Within radius (requires coordinates)
    | 'ANYWHERE';           // No location filter
  
  nearbyRadiusKm?: number;  // For NEARBY mode (default: 25km)
  
  // Category filters
  categoryId?: string;
  subcategoryId?: string;
  
  // Item filters
  condition?: 'NEW' | 'LIKE_NEW' | 'GOOD' | 'FAIR';
  priceMin?: number;
  priceMax?: number;
  keywords?: string;
  
  // Sorting
  sortBy: 'NEWEST' | 'PRICE_ASC' | 'PRICE_DESC' | 'DISTANCE' | 'RELEVANCE';
}

// Default filter for homepage: MY_SCHOOL + NEWEST
// Shows items from user's school first, sorted by newest
```

### UI Flow: Profile Completion

```
1. User signs up → Email/Phone verification
2. "Complete Your Profile" screen:
   ┌─────────────────────────────────────┐
   │ Where are you located?              │
   │                                     │
   │ Province:    [Select Province    ▼] │
   │ City:        [Select City        ▼] │  ← Disabled until province selected
   │ Suburb:      [Select Suburb      ▼] │  ← Disabled until city selected
   │                                     │
   │ Your School:                        │
   │ School:      [Select School      ▼] │  ← Disabled until suburb selected
   │                                     │
   │ ○ I'm currently a student           │
   │ ○ I'm an alumni                     │
   │                                     │
   │ [Continue →]                        │  ← Disabled until all selected
   └─────────────────────────────────────┘

3. If school not found:
   - "Can't find your school?" link
   - Opens request form for admin to add school
   - User can proceed with suburb-level location temporarily

4. Profile complete → Can now browse, buy, and list items
```

### School Data Source
- Initial seed: SA Department of Basic Education school list
- Ongoing: Admin can add new schools, merge duplicates
- Users can request missing schools (requires admin approval)
- `isVerified` flag distinguishes official schools from user-requested ones

### Location Rules

1. **All fields required** — User cannot transact without complete location + school
2. **Denormalize for speed** — Store names alongside IDs to avoid joins on every query
3. **Index for filtering** — Every location level needs indexes for fast cascading
4. **School-first discovery** — Default listing view shows user's school items first
5. **Privacy consideration** — Exact address only shown to counterparty after purchase
6. **Allow school changes** — Users can update school (e.g., graduated, transferred)

---

## Buyer Pricing Model (Gross-Up Calculator)

NextKid uses a **reverse "gross-up" pricing model** — the seller names the payout they want, and the buyer's price is calculated so the seller receives exactly that amount after all fees.

**Source of truth:** `packages/shared/src/pricing.ts` — `calculateBuyerPrice(sellerPayoutRands, config = DEFAULT_PRICING)`

```
Step 1: seller_price                        (guaranteed seller payout)
Step 2: ÷ (1 - platformRate)                (gross up for NextKid commission, currently 7.5%)
Step 3: ÷ (1 - gatewayRate)                 (gross up for Stitch fee, 2.5%)
Step 4: CEILING(raw ÷ R25) × R25            (round UP to nearest R25)
Step 5: admin_fee = buyer_price - buyer_raw (rounding surplus → Praesignis Finance)
```

`DEFAULT_PRICING = { platformRate: 0.075, gatewayRate: 0.025, roundTo: 25 }`

- Delivery cost is **not** part of this calculator — the buyer chooses a delivery method (school pick-up, courier, etc.) at checkout and pays that separately, on top of the buyer price computed here
- `platformRate` mirrors `PLATFORM_COMMISSION_RATE` (7.5%, testing — update before going live)
- All money handled internally in **cents** to avoid floating point errors; `fmtRands()` formats for display
- Used by both web (`apps/web/app/sell/new/page.tsx`) and mobile (`apps/mobile/app/(tabs)/sell.tsx`) sell flows to show the seller their predicted buyer price live as they type
- **RULE:** Never add fees on top of the seller price in a different order, and never recompute this client-side with different constants — always import from `packages/shared/src/pricing.ts`

---

## School (Klerebank) Hub Network & Delivery

Partner schools ("Klerebanks") act as physical drop-off and collection points for orders, replacing direct courier-to-door delivery for same-school transactions.

### Schools table & Klerebank status
- `schools` (`001_schema_and_seed.sql`) — base SA school directory (location hierarchy, `quintile`, `is_verified`, `is_active`)
- `018_school_registration.sql` adds: `klerebank_status text CHECK IN ('pending','active','rejected')`, `contact_name/email/phone`, `referral_code text UNIQUE`, `referred_by_school_id text REFERENCES schools(id)`, `applied_at/approved_at/approved_by/rejection_reason`
- **A school is a usable hub only when `klerebank_status = 'active'`** — there is no separate `is_klerebank_hub` flag
- `school_tiers` (`022_referral_programme.sql`) — Seedling (0 referrals) / Grove (3+) / Campus (10+, `bonus_rate=0.005`) / District (25+, `bonus_rate=0.01`). `bonus_rate` is reserved for future bonus logic and is **not currently applied** anywhere

### Delivery school matching
- `GET /api/checkout/school-match?listingId=` (`apps/web/app/api/checkout/school-match/route.ts`) — intersects the listing seller's `seller_school_id` with the buyer's `school_id`/`school_ids`, then filters to schools with `klerebank_status='active'`. If a match exists, returns `hubActive: true` plus the fee split
- `orders.delivery_type CHECK IN ('school','courier')` and `orders.delivery_school_id text REFERENCES schools(id)` (`020_school_delivery.sql`) are set once at checkout and **never change** — single source of truth for which school's ledger gets credited
- **`fee_config` table** (`020_school_delivery.sql`) seeds `school_delivery_fee=2000`, `school_nextkid_split=1000`, `school_klerebank_split=1000` (cents) — **but `apps/web/app/api/orders/route.ts` does not read from this table**; it hardcodes `SCHOOL_DELIVERY_FEE_CENTS = 2000` / `SCHOOL_KLEREBANK_SPLIT = 1000` as constants that must match `fee_config`. If you change the fee, update **both** the `fee_config` seed and these constants — or better, refactor the route to read `fee_config` at runtime (flag this to the user as a fix candidate)

### School ledger & referral programme
- `school_ledger` (`019_school_ledger.sql`, extended `020`/`023`) — one row per `(order_id, event_type)` where `event_type IN ('dropoff','collection','delivery')`, `amount_cents` defaults to `1000` (R10)
- `school_ledger_summary` (`023_ledger_and_payouts.sql`) — one row per `(school_id, month)`: `direct_earnings_cents`, `referral_earnings_cents`, `grand_total_cents`, `status IN ('accumulating','processing','paid')`
- `increment_school_ledger_summary(p_school_id, p_month, p_direct_cents, p_referral_cents)` — **`SECURITY DEFINER`** RPC, atomically upserts/adds into `school_ledger_summary` and returns the new grand total. Always call this for ledger writes — never update `school_ledger_summary` directly from a user-token client (RLS will block it, which is the point)
- **Referral programme** — `referral_earnings` (`022_referral_programme.sql`): when a waybill completes at school A, A's `referred_by_school_id` (L1) earns **R2** (`amount_cents=200, level=1`), and L1's own referrer (L2) earns **R0.50** (`level=2`), capped at 2 levels. Both inserts use `ON CONFLICT (earning_school_id, order_id, level) DO NOTHING` to prevent double-crediting on retries. Implemented in `creditReferralEarnings()` in `apps/web/app/api/qr/scan/route.ts`

### School payouts (Praesignis Finance)
- `praesignis_finance_ledger` (`023_ledger_and_payouts.sql`) — one row per month: platform-wide totals (`school_direct_total_cents`, `school_referral_total_cents`, `school_payout_total_cents`, `platform_commission_cents`, `school_count`, `order_count`, `held_school_count`), `status IN ('open','processing','closed')`
- `payouts` table (`023_ledger_and_payouts.sql`) — one row per `(school_id, month)`: `amount_cents`, `bank_details_snapshot`, `stitch_disbursement_id`, `status IN ('pending','processing','paid','failed','held')`, `held_reason`
- `POST /api/payout/trigger` — cron-secured (`x-cron-secret` header = `CRON_SECRET`), runs monthly: rolls every `school_ledger_summary` row with `status='accumulating'` and `grand_total_cents > 0` into a `payouts` row (`held` if the school has no verified bank details), flips the summary to `'processing'`, notifies school + super admins, and updates `praesignis_finance_ledger`. **No money actually moves** — Stitch disbursement is a future "approve" step that would flip `payouts.status` from `pending` → `processing` → `paid`

### School admin roles
- `school_admins` (`018_school_registration.sql`, extended `028_super_admin.sql`) — `user_id`, `school_id` (nullable for super admins), `role DEFAULT 'klerebank_admin'` (also allows `'super_admin'`), `active boolean DEFAULT false` (gates dashboard/ledger access until an invite is accepted), `invite_token UNIQUE`
- Invite flow: `POST /api/schools/[id]/admins/invite` (caller must be `profiles.role IN ('admin','super_admin')`) generates an invite token and an inactive `school_admins` row; accept page is `apps/web/app/klerebank/accept-invite/page.tsx`
- `profiles.admin_verified boolean` + `profiles.role IN ('buyer','seller','admin','super_admin')` — **`admin_verified=true` is required to scan QR codes**, on top of `role='admin'` (two-factor admin check)
- `028_super_admin.sql` seeds two hardcoded super-admin emails directly into `school_admins`

---

## QR-Based Hub Fulfilment

The core fulfilment loop after payment: seller drops the item at a Klerebank hub (DROPOFF QR), an admin scans it, the buyer collects it later (COLLECTION QR), and a second admin scan releases funds.

### Token format (`apps/web/src/lib/qr.ts`)
- Token string: `NK:<TYPE>:<base64url(JSON payload)>.<HMAC-SHA256 hex>`, where `TYPE ∈ {DROPOFF, COLLECTION}`
- `QrPayload = { t: 'DROPOFF'|'COLLECTION', o: orderId, w: waybillNumber, n: uuid nonce, e: expiry (unix seconds) }`
- `generateWaybillNumber()` → `NK-YYMMDD-XXXXXX` (6-char suffix from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` — excludes `I/O/0/1` to avoid OCR/visual ambiguity)
- `generateQrToken(type, orderId, waybillNumber, ttlHours)` → `{ token, hash, expiresAt }` (`hash = SHA-256(token)`)
- `verifyQrToken(raw)` → `{ type, orderId, waybillNumber, hash } | null` — validates HMAC signature, JSON shape, expiry, and type
- `DROPOFF_TTL_HOURS = 72` (3 business days), `COLLECTION_TTL_HOURS = 336` (14 days)

### Database
- `waybills` — one row per order: `waybill_number UNIQUE`, `order_id UNIQUE REFERENCES orders(id)`
- `qr_tokens` — up to 2 rows per order (`token_type IN ('DROPOFF','COLLECTION')`), `token_hash UNIQUE`, `expires_at`, `used_at`/`used_by` (single-use guard). Partial unique index ensures only one **unused** token per `(order_id, token_type)`
- RLS: seller can read their order's DROPOFF token, buyer can read COLLECTION — never each other's. Verified admins (`role='admin' AND admin_verified=true`) can read all tokens

### Scan endpoint — `POST /api/qr/scan`
Caller must be an authenticated, `admin_verified` admin. Body: `{ token }`. Steps: verify HMAC + lookup `qr_tokens` by hash → check not expired/not used → check `orders.status` matches the expected state for the token type → mark token used → advance order:

- **DROPOFF scanned** (order must be `AWAITING_DROPOFF`): order → `ITEM_AT_HUB`, `dropped_off_at = now`. Credits the scanning admin's school R10 via `school_ledger` (`event_type='dropoff'`). Generates and stores the COLLECTION QR (`COLLECTION_TTL_HOURS` from now)
- **COLLECTION scanned** (order must be `ITEM_AT_HUB`): order → `COMPLETED`, `payment_status='CAPTURED'`, `collected_at`/`completed_at = now`, computes `platform_commission_cents`/`seller_payout_cents` from `PLATFORM_COMMISSION_RATE`, upserts a `seller_payouts` row (`status='pending'` if the seller has `seller_bank_details.verified=true`, else `'held'`/`'no_verified_bank_details'`). Credits `delivery_school_id`'s ledger R10 (`event_type='collection'`), then runs `creditReferralEarnings()`

Both branches write an `order_events` row (audit trail) and an `order_status_log` row, and call `sendOrderNotification()`.

### Displaying QR codes to users
- **Web** (`apps/web/app/orders/[id]/page.tsx`, `QrPanel`): fetches `GET /api/orders/[id]/qr/[type]`, renders the returned `qrDataUrl` image + waybill number + expiry. Shown to the seller (DROPOFF) when `status='AWAITING_DROPOFF'`, and to the buyer (COLLECTION) when `status='ITEM_AT_HUB'`
- **Mobile** (`apps/mobile/app/order/[id].tsx`, `QrMobilePanel`): renders the raw token with `react-native-qrcode-svg`'s `<QRCode value={token} size={180}/>` under the same status conditions

---

## Multi-Item Listings, Reservations & Order Items

A single listing can represent multiple individual items for sale (e.g. a bundle of uniform pieces), each tracked and sold independently.

### Schema (`017_multi_item_listings.sql`)
- `listings` gains `is_multi_item boolean DEFAULT false`, `item_count integer DEFAULT 1` (total ever added), `available_count integer DEFAULT 1` (still for sale)
- `listing_items` — `listing_id REFERENCES listings(id) ON DELETE CASCADE`, `name`, `price_cents CHECK > 0`, `size_label`, `status CHECK IN ('available','reserved','sold')`
- `reservations` — `listing_item_id REFERENCES listing_items(id) ON DELETE CASCADE`, `user_id`, `expires_at`. Partial unique index `(listing_item_id) WHERE expires_at > now()` enforces one active reservation per item
- `order_items` — `order_id REFERENCES orders(id) ON DELETE CASCADE`, `listing_item_id REFERENCES listing_items(id)`, `price_at_purchase integer` (locked at purchase, **never recalculated**)

### Reservation flow
- `RESERVATION_MINUTES = 15` (`apps/web/app/api/reservations/route.ts`)
- `POST /api/reservations` — body `{ itemIds[] }`: verifies all are `status='available'`, flips them to `'reserved'`, inserts `reservations` rows with `expires_at = now + 15min`
- `DELETE /api/reservations` — releases items back to `'available'` and removes the reservation rows
- **No cron/cleanup job exists for silently-expired reservations** — an expired reservation only stops counting via the partial unique index (allowing a new reservation), but `listing_items.status` stays `'reserved'` until an explicit `DELETE` call. This is the same class of gap as the unenforced `auto_dropoff_at`/COLLECTION-expiry — flag to the user before relying on reservation expiry

### Buying multi-item listings
- Web (`apps/web/app/item/[id]/page.tsx`) and mobile (`apps/mobile/app/item/[id].tsx`) both show a checklist of `listing_items` when `is_multi_item=true`, with a running total and "Add N items to cart" button (`selectedItemIds`)
- **A multi-item purchase creates ONE order with multiple `order_items` rows** — never multiple orders. `apps/web/app/api/orders/route.ts` validates the selected `listing_items`, sums `price_cents` for `item_price_cents`, then after inserting the order: inserts one `order_items` row per item, marks those `listing_items.status='sold'`, decrements `listings.available_count` (setting `listings.status='SOLD'` at zero), and deletes any matching `reservations`

---

## Shipping & Courier Integration (The Courier Guy)

> **Secondary/legacy path.** This entire section describes the original direct-courier (`delivery_type='courier'`) flow. As documented in "Known Prototype Trade-offs" above, `simulate-payment` currently routes **every** order into the Klerebank hub flow regardless of `delivery_type`, so none of the TCG shipment-booking states below are actually reached today. The TCG fields (`delivery_locker_id`, `shipping_method`, `service_level_code`) are still captured at checkout and the `/api/lockers/*` and `/api/shipping/*` routes still work standalone — but they don't currently feed into order state transitions. Keep this code working (don't delete it), but treat the Klerebank hub network as the primary fulfilment model for any new work.

### API Details
- **Base URL:** `https://api-pudo.co.za`
- **Authentication:** API key required (stored in env vars, never exposed client-side)
- **Supported shipping types:**
  - D2D (Door to Door) — pickup from seller address, deliver to buyer address
  - D2L (Door to Locker) — pickup from seller address, deliver to PUDO locker
  - L2D (Locker to Door) — seller drops at locker, deliver to buyer address
  - L2L (Locker to Locker) — seller drops at locker, buyer collects from locker

### Seller Shipping Configuration (Set During Account Creation)
Sellers configure their preferred shipping methods when creating their account, then confirm/adjust when creating each listing.

```typescript
// packages/shared/types/shipping.ts

interface SellerShippingProfile {
  sellerId: string;
  
  // Seller's origin options (at least one required)
  allowPickupFromAddress: boolean;
  pickupAddress?: Address;
  
  allowPudoDropoff: boolean;
  preferredPudoLockerId?: string;  // TCG locker code e.g. "CG54"
  preferredPudoLockerName?: string; // e.g. "Sasol Rivonia Uplifted"
  
  // Default parcel handling
  defaultParcelHandling: 'FRAGILE' | 'STANDARD';
}

interface ListingShippingConfig {
  listingId: string;
  
  // Parcel dimensions (REQUIRED before listing goes live)
  parcel: {
    lengthCm: number;
    widthCm: number;
    heightCm: number;
    weightKg: number;
  };
  
  // Which methods seller will use for THIS listing
  // Inherited from SellerShippingProfile, can be narrowed per listing
  shippingMethods: Array<'PICKUP' | 'PUDO_DROPOFF'>;
  
  // If PUDO_DROPOFF, which locker (defaults to profile preference)
  pudoLockerId?: string;
}
```

### Locker Box Sizes (TCG Standard)
Map parcel dimensions to locker sizes for D2L/L2D/L2L shipments:

| Size Code | Name   | Width (cm) | Height (cm) | Length (cm) | Max Weight (kg) |
|-----------|--------|------------|-------------|-------------|-----------------|
| V4-XS     | Extra Small | 17     | 8           | 60          | 2               |
| V4-S      | Small  | 41         | 8           | 60          | 5               |
| V4-M      | Medium | 41         | 19          | 60          | 10              |
| V4-L      | Large  | 41         | 41          | 60          | 15              |
| V4-XL     | Extra Large | 41    | 69          | 60          | 20              |

### Buyer Checkout Flow (Shipping Cost Calculation)

**RULE: Buyer pays shipping. Seller only sees their item price.**

```typescript
// packages/shared/types/checkout.ts

interface ShippingQuote {
  quoteId: string;
  method: 'D2D' | 'D2L' | 'L2D' | 'L2L';
  serviceLevelCode: string;      // e.g. "OVN", "ECO", "D2LXS - ECO"
  serviceLevelName: string;      // e.g. "Overnight", "Economy"
  rate: number;                  // Total cost in ZAR (inc VAT)
  rateExcludingVat: number;
  estimatedDeliveryFrom: Date;
  estimatedDeliveryTo: Date;
  collectionDate: Date;
  
  // For locker options
  lockerCode?: string;
  lockerName?: string;
  lockerAddress?: string;
}

interface CheckoutShipping {
  availableQuotes: ShippingQuote[];  // All options from seller's config
  selectedQuote: ShippingQuote;      // Buyer's choice
  
  // Addresses
  sellerOrigin: Address | { lockerId: string };
  buyerDestination: Address | { lockerId: string };
}

// What buyer sees at checkout:
// ┌─────────────────────────────────────┐
// │ Item price:              R 500.00   │
// │                                     │
// │ Shipping options:                   │
// │ ○ PUDO Locker (Economy)   R 68.75  │ ← Cheapest shown first
// │ ○ Door delivery (Economy) R 142.31  │
// │ ○ Door delivery (Overnight) R 205.56│
// │                                     │
// │ ─────────────────────────────────── │
// │ Total:                   R 568.75   │
// └─────────────────────────────────────┘

// What seller sees after sale:
// "You sold your item for R 500!"
// "Drop off at: Sasol Rivonia Locker by [date]"
// Seller does NOT see: shipping cost, total buyer paid, commission
```

### Get Shipping Rates (API Call)

```typescript
// Example: Get rates for D2D shipment
// POST https://api-pudo.co.za/rates

const getRatesD2D = async (
  collectionAddress: TCGAddress,
  deliveryAddress: TCGAddress,
  parcels: TCGParcel[]
): Promise<TCGRateResponse> => {
  const response = await fetch('https://api-pudo.co.za/rates', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.TCG_API_KEY}`
    },
    body: JSON.stringify({
      collection_address: collectionAddress,
      delivery_address: deliveryAddress,
      parcels,
      collection_min_date: new Date().toISOString(),
      delivery_min_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    })
  });
  return response.json();
};

// For D2L (Door to Locker):
// delivery_address: { terminal_id: "CG54" }

// For L2D (Locker to Door):
// collection_address: { terminal_id: "CG54" }

// For L2L (Locker to Locker):
// Both use terminal_id
```

### Create Shipment (After Payment Confirmed)

```typescript
// POST https://api-pudo.co.za/shipments

interface CreateShipmentRequest {
  collection_address: TCGAddress | { terminal_id: string };
  collection_contact: {
    name: string;
    email: string;
    mobile_number: string;  // Format: +27xxxxxxxxx
  };
  delivery_address: TCGAddress | { terminal_id: string };
  delivery_contact: {
    name: string;
    email: string;
    mobile_number: string;
  };
  parcels?: TCGParcel[];  // Required for D2D
  service_level_code: string;  // From quote
  collection_min_date: string;
  delivery_min_date: string;
  special_instructions_collection?: string;
}

// Response includes:
// - id: shipment ID
// - custom_tracking_reference: waybill number (e.g. "TCGD000500")
// - pincode: for locker pickups
// - status: "submitted" | "deposit-pending" etc.
```

### Shipment Status Flow

```
submitted → collection-assigned → collected → in-transit → 
out-for-delivery → delivered

For lockers:
deposit-pending → deposited → ready-for-collection → collected-by-recipient
```

### Tracking Updates (Webhook or Polling)

```typescript
// GET https://api-pudo.co.za/tracking/shipments/public?waybill=TCGD000500

interface TrackingEvent {
  id: number;
  date: string;
  status: string;
  message: string;
  location: string;
}
```

### Get Waybill PDF

```typescript
// GET https://api-pudo.co.za/generate/waybill/{shipment_id}?api_key={key}
// Returns signed S3 URL to PDF
```

### Get All Lockers (For Locker Selection UI)

```typescript
// GET https://api-pudo.co.za/lockers-data

interface TCGLocker {
  code: string;           // e.g. "CG54"
  name: string;           // e.g. "Sasol Rivonia Uplifted"
  latitude: string;
  longitude: string;
  address: string;
  openinghours: Array<{
    day: string;
    open_time: string;
    close_time: string;
  }>;
  lstTypesBoxes: Array<{
    id: number;
    name: string;         // e.g. "V4-XS"
    width: number;
    height: number;
    length: number;
    weight: number;
  }>;
}
```

### Shipping Integration Rules

1. **Quote at checkout, book after payment** — Get rates when buyer views checkout, create shipment only after payment is held in escrow
2. **Lock the quoted price** — Store the exact quote amount at purchase time, don't recalculate later
3. **Seller sees only what they need** — Item price, shipping method, where/when to drop off. NOT: shipping cost, buyer paid total, commission
4. **Buyer sees full breakdown** — Item price + shipping = total
5. **Auto-cancel if not shipped** — If seller doesn't create shipment within 3 business days, auto-refund buyer
6. **Tracking updates to both parties** — Webhook or poll for status, push notifications to buyer AND seller
7. **Store all TCG responses** — Keep full API response for disputes and auditing

---

## Children's Profiles, Smart Feed & Lifecycle Reminders

Personalized size prediction and feed targeting per child is core NextKid IP — described in `024_child_profiles.sql` as the platform's differentiator.

### Children's profiles (`024_child_profiles.sql`)
- `child_profiles` — `user_id REFERENCES auth.users ON DELETE CASCADE`, `nickname text CHECK (1-50 chars)` (**POPIA: nicknames only, never real names**), `gender CHECK IN ('boy','girl','other')`, `dob date`, `grade text` (`'R'`..`'12'`), `school_id REFERENCES schools(id)`, `sports text[]`, `interests text[]`, `popia_consent`/`popia_consented_at`, `deleted_at` (soft delete)
- `child_sizes` — measurement history: `child_id`, `recorded_date`, `top_size`/`bottom_size`/`shoe_size`, `source CHECK IN ('manual','transaction')`
- `growth_curves` — seeded SA reference data: `(gender, age_weeks)` → `avg_top_size`/`avg_bottom_size`/`avg_shoe_size` (UK shoe sizing), seeded for boy/girl/other
- `size_predictions` — persisted predictions: `predicted_top`/`predicted_bottom`/`predicted_shoe`, `confidence_score numeric(4,3)` (0–1), `basis CHECK IN ('curve_only','curve_and_history','history_weighted')`

### Smart feed (`025_listing_targeting.sql`)
- `listings` gains `size_label`, `size_numeric`, `gender_target CHECK IN ('boy','girl','unisex')`, `sport_tag`
- `user_feed_cache` — `user_id PK`, `feed_json jsonb`, `generated_at`, `expires_at`
- `GET /api/feed` — `CACHE_TTL_MS = 1 hour`. Returns the cached `feed_json` if `expires_at > now`, else recomputes via `computeFeed()` and upserts the cache
- `computeFeed()` builds per-child sections: **"Fits Now"** (matches `listings.size` to the child's latest `child_sizes`), **"Plan Ahead"** (matches against `size_predictions`), **"Sports & Interests"** (matches `listings.sport_tag` against the child's `sports`/`interests`). `schoolFirst()` sorts results by the child's `school_id` matching `seller_school_id`
- Note: although migration 025 adds `size_numeric`/`gender_target` columns, the current `computeFeed()` query matches on the older `size` text column and `sport_tag` only — `size_numeric`/`gender_target` are not yet wired into the matching query

### Lifecycle reminder engine (`026_reminder_engine.sql`)
- `reminder_rules` — trigger types: `growth_spurt`, `year_end`, `school_transition`, `matric`, `post_school`, each with `grade_from`/`grade_to`/`gender` filters, `message_template`, `timing_offset_days`
- `scheduled_reminders` — `(child_id, rule_id, scheduled_for)` unique, `sent_at`
- `GET /api/cron/reminders` — daily Vercel cron (`0 6 * * *`), guarded by `x-cron-secret`. Phase 1: for each active child × matching rule, computes anchor dates (year-end = Nov 30, school transition = Jan 15, matric = Oct 31, post-school = Jan 31, growth spurt = child's birthday) and upserts `scheduled_reminders`. Phase 2: finds due unsent reminders, interpolates `{child}`/`{grade}` into `message_template`, sends via `sendReminderNotification()`, marks `sent_at`

### Notifications (`apps/web/src/lib/notifications.ts`)
- `sendOrderNotification()` — main order-lifecycle notifier (`AWAITING_DROPOFF`, `ITEM_AT_HUB`, `COMPLETED`, `AUTO_CANCELLED`, `CANCELLED`) — push (Expo) + email + in-app to buyer/seller/school admins as relevant
- `sendLedgerCreditNotification()` — notifies school admins via push + in-app when a waybill closes and credits their ledger
- `sendReminderNotification()` — push + in-app for lifecycle reminders
- `sendPriceDropNotifications()` — push + email to wishlisters when a seller drops a listing's price
- `nudgeUncollectedBuyers()` — finds `ITEM_AT_HUB` orders >2 days old and nudges buyers; **exists but is not currently scheduled by any cron** (same class of gap as `auto_dropoff_at` enforcement)

---

## Wishlists & Reviews

### Wishlists (`027_wishlists.sql`)
`wishlists` — `(user_id, listing_id)` unique, `price_at_save integer`. RLS: users manage their own; service role can read for price-drop notifications.

- `GET/POST /api/wishlist` — GET returns the user's wishlist joined with listing data; POST upserts (`onConflict: 'user_id,listing_id'`) and notifies the seller ("Someone saved your item") via in-app + Expo push
- `DELETE /api/wishlist/[listingId]` — removes a wishlist entry
- `POST /api/wishlist/price-drop` — seller-triggered (validates `listing.seller_id === user.id`), calls `sendPriceDropNotifications()` to alert everyone who wishlisted that listing

### Ratings & reviews
> **Not yet implemented.** No `reviews`/`ratings` table or endpoints exist. The only trace is aspirational UI copy in `sendOrderNotification`'s `COMPLETED` case ("Don't forget to leave the seller a review") — there is nowhere for that review to go yet. Treat as a future feature; confirm scope before building.

---

## Roles, Admin Hierarchy & Account Deletion

### Roles
- `profiles.role CHECK IN ('buyer','seller','admin','super_admin')` — every user can both buy and sell regardless of role; `role` only gates admin surfaces
- `profiles.admin_verified boolean DEFAULT false` — **required in addition to `role='admin'`** to scan QR codes (two-factor admin check). Set manually by Praesignis, not self-service
- `school_admins` — per-school Klerebank admins (`role DEFAULT 'klerebank_admin'`, also `'super_admin'`), `active boolean DEFAULT false` until an email invite is accepted via `apps/web/app/klerebank/accept-invite/page.tsx`. Invited via `POST /api/schools/[id]/admins/invite` (caller must be `admin`/`super_admin`)
- `028_super_admin.sql` seeds two hardcoded super-admin emails directly into `school_admins`

### Admin surfaces
- `apps/web/app/admin/scan/page.tsx` — QR scanning UI for Klerebank admins (calls `POST /api/qr/scan`)
- `POST /api/admin/payouts/[id]/pay` — `role='admin'` only; marks a `seller_payouts` row `'paid'`, sets `paid_at`/`paid_by`/`reference`, notifies the seller

### Account deletion
`POST /api/account/delete` — **hard delete with cascade**, not a soft delete:
1. Logs an anonymized reason to `account_deletions` (`030_account_deletions.sql` — no `user_id` stored, by design for POPIA)
2. Cancels the user's `PENDING_PAYMENT` orders as buyer
3. Deletes the user's `listings`
4. Deletes `child_profiles` rows — **bug:** the route filters on `parent_id`, but `024_child_profiles.sql` defines the column as `user_id`; this currently no-ops and orphans child profiles on account deletion. Fix this if you're touching this route
5. Deletes `school_admins` entries
6. Deletes the `profiles` row (comment claims `ON DELETE CASCADE` handles `notifications`/`wishlists`/`push_tokens`)
7. Deletes the Supabase auth user via the service-role admin client

---

## Seller Payouts & Bank Details

- `seller_bank_details` (`031_seller_payouts.sql`) — one row per seller (`UNIQUE seller_id`): `account_holder_name`, `bank_name`, `account_number`, `branch_code`, `account_type DEFAULT 'cheque'` (`cheque`|`savings`), `verified boolean DEFAULT false`
- `GET/POST /api/seller/bank-details` — POST always upserts with `verified: false`; **Praesignis verifies manually** (no self-verification flow)
- `seller_payouts` (`031_seller_payouts.sql`) — one row per order (`UNIQUE order_id`): `amount_cents`, `status DEFAULT 'pending' CHECK IN ('pending','processing','paid','failed','held')`, `held_reason`, `paid_at`, `paid_by REFERENCES auth.users(id)`, `reference` (EFT reference), `bank_snapshot jsonb`
- Created at COLLECTION-scan time in `POST /api/qr/scan` (see "QR-Based Hub Fulfilment") — `status='pending'` if `seller_bank_details.verified=true`, else `status='held', held_reason='no_verified_bank_details'`. `bank_snapshot` is captured at creation time so later bank-detail edits don't retroactively change a payout already in flight
- `POST /api/admin/payouts/[id]/pay` — `role='admin'` only, marks `'paid'` and notifies the seller (push + in-app). Returns 409 if already paid

---

## Order State Machine

> The diagram below reflects the **actual flow every order takes today** (the Klerebank hub model). The full `orders_status_check` constraint (`015_waybill_qr.sql`) also includes legacy TCG-courier states and dispute states reserved for future/secondary use — see "Reserved / not-yet-reachable states" below. Never skip states in the primary flow.

### Primary flow (Klerebank hub)

```
PENDING_PAYMENT
  → POST /api/orders/[id]/pay creates a Stitch payment link
  → payment.succeeded webhook (not yet built) OR
    POST /api/orders/[id]/simulate-payment (dev-only fallback)
  → AWAITING_DROPOFF
      payment_status='HELD', auto_dropoff_at = paid_at + 72h
      waybill + DROPOFF QR generated
  → seller brings item to Klerebank hub, admin scans DROPOFF QR (POST /api/qr/scan)
  → ITEM_AT_HUB
      dropped_off_at set, COLLECTION QR generated (14-day expiry)
      hub school credited R10 (school_ledger, event_type='dropoff')
  → buyer collects item, admin scans COLLECTION QR (POST /api/qr/scan)
  → COMPLETED
      collected_at/completed_at set, payment_status='CAPTURED'
      platform_commission_cents + seller_payout_cents calculated
      seller_payouts row created (pending/held)
      delivery_school_id's ledger credited R10 (event_type='collection')
      L1/L2 referral earnings credited
```

### Reserved / not-yet-reachable states
These remain in `orders_status_check` but no current code path produces them — do not build features that assume they're reachable without confirming with the user first:

- **`UNCOLLECTED`** — intended for COLLECTION QR expiry (14 days) with no scan; not enforced (see "Known Prototype Trade-offs")
- **`AUTO_CANCELLED`** — intended for missed drop-off (72h); not enforced
- **`CANCELLED`** — buyer/seller cancel before drop-off; no cancel endpoint currently exists
- **Legacy TCG courier states** — `PAYMENT_HELD`, `AWAITING_SHIPMENT_BOOKING`, `SHIPMENT_BOOKED`, `SHIPPED`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED` — part of the original design described in "Shipping & Courier Integration"; `simulate-payment` never produces them
- **`DISPUTED`, `RESOLVED_REFUND`, `RESOLVED_RELEASED`** — see "Disputes" in Core Business Rules; no dispute system exists yet
- **`POST /api/orders/[id]/confirm`** — legacy "buyer confirms receipt" endpoint requiring `status='DELIVERED'`; unreachable in the current flow but left in place

### Audit trails
Every transition writes to **both**:
- `order_events` — human-readable `{ order_id, from_status, to_status, note, created_by }`, RLS-readable by buyer/seller
- `order_status_log` — append-only `{ order_id, status, changed_at, changed_by_user_id }`, admin-only read

### Order Data Model

```typescript
// orders table — supabase/migrations/001_schema_and_seed.sql,
// extended by 008_orders_delivery_locker.sql, 015_waybill_qr.sql,
// 016_peach_to_stitch.sql, 020_school_delivery.sql

interface Order {
  id: string;
  status: OrderStatus;   // full list = orders_status_check, see above

  // Parties
  buyerId: string;
  sellerId: string;
  listingId: string;

  // Money (all in ZAR cents to avoid floating point)
  itemPriceCents: number;
  shippingCostCents: number;        // 2000 (R20) for delivery_type='school'
  totalPaidCents: number;
  platformCommissionCents?: number; // set at COMPLETED
  sellerPayoutCents?: number;       // set at COMPLETED

  // Payment
  stitchPaymentId?: string;
  paymentStatus: 'PENDING' | 'HELD' | 'CAPTURED' | 'REFUNDED';

  // Klerebank hub delivery (primary path)
  deliveryType?: 'school' | 'courier';
  deliverySchoolId?: string;   // locked at checkout — drives ledger credit, never changes

  // Legacy TCG courier fields — still captured at checkout, not used in state transitions
  shippingMethod?: 'D2D' | 'D2L' | 'L2D' | 'L2L';
  serviceLevelCode?: string;
  quotedRateCents?: number;    // RULE: locked at purchase, never recalculated
  tcgShipmentId?: number;
  trackingUrl?: string;
  estimatedDelivery?: Date;
  deliveryLockerId?: string;
  deliveryLockerName?: string;

  // Hub fulfilment timestamps
  autoDropoffAt?: Date;        // paidAt + 72h (not yet enforced by a cron)
  droppedOffAt?: Date;
  collectedAt?: Date;

  // General timestamps
  createdAt: Date;
  paidAt?: Date;
  completedAt?: Date;

  // Legacy timestamps (TCG courier path)
  shippedAt?: Date;
  deliveredAt?: Date;
  autoCancelAt?: Date;
}
```

A `waybills` row and up to two `qr_tokens` rows (DROPOFF/COLLECTION) accompany every order that enters the Klerebank hub flow — see "QR-Based Hub Fulfilment".

---

## Coding Standards

### TypeScript
- Strict mode always on — zero `any` types
- Define all API response shapes as interfaces in `packages/shared/types`
- Use Zod for runtime validation of all API inputs and external data (including TCG API responses)

### React / Next.js
- Functional components only — no class components
- Use React Server Components (RSC) for data fetching where possible
- Client components must be explicitly marked with `"use client"`
- Co-locate component styles, tests, and types in the same folder
- No inline styles — use Tailwind CSS utility classes

### Expo / React Native
- Share business logic and types from `packages/shared`
- Use Expo Router for navigation
- Platform-specific code in `.ios.tsx` / `.android.tsx` files where needed
- Always test on both iOS and Android simulators before marking done

### Comments
- Comment all complex business logic with a `// RULE:` prefix explaining WHY, not just what
- Comment all Stitch payment-related code thoroughly — payment logic must be crystal clear
- Comment all TCG API integration code — shipping logic must be traceable
- Document all escrow state transitions explicitly
- Document all shipping state transitions explicitly

### File Naming
- Components: `PascalCase.tsx`
- Utilities/hooks: `camelCase.ts`
- Constants: `SCREAMING_SNAKE_CASE`
- API routes: `kebab-case`

---

## AWS Services Roadmap (future migration)
When implementing backend features, keep these services in mind so code is easy to migrate:

| Current | Future AWS Equivalent |
|---|---|
| Next.js API routes | AWS Lambda + API Gateway |
| Local/Vercel storage | S3 |
| PostgreSQL/Supabase | DynamoDB or Aurora |
| Email (SMTP) | SES |
| Push notifications | SNS + Expo Push |
| Background jobs | SQS + Lambda |

---

## Things Claude Must NEVER Do

### General
- Never use `any` in TypeScript — use `unknown` and narrow the type
- Never use class components in React or React Native
- Never hardcode commission rates — always read from `PLATFORM_COMMISSION_RATE` (currently 7.5%)
- Never hardcode the school delivery fee split (R20 / R10 / R10) in a new location without keeping it in sync with `fee_config` and the existing constants in `apps/web/app/api/orders/route.ts` — see "School (Klerebank) Hub Network & Delivery"

### User Profiles & Location
- Never allow a user to list or purchase without a completed profile (location + school)
- Never show a user's exact street address to other users before a purchase is confirmed
- Never allow school selection before suburb is selected (enforce cascade)
- Never skip location hierarchy validation — province/city/suburb/school must be consistent
- Never allow unverified schools to appear in the main dropdown — show "request school" flow instead

### Children's Profiles (POPIA)
- Never store a child's real name — only `nickname` (1–50 chars)
- Never expose `child_profiles`/`child_sizes`/`size_predictions` to any user other than the owning parent
- Never create a child profile without `popia_consent`

### Payments
- Never bypass the Klerebank hub release flow — funds reach the seller only when a verified admin scans the buyer's COLLECTION QR (`POST /api/qr/scan`), never on buyer "confirm receipt" alone (`POST /api/orders/[id]/confirm` is legacy and unreachable)
- Never expose Stitch API keys, `QR_SECRET`, or `CRON_SECRET` in client-side code
- Never skip input validation on API routes
- Never comment Stitch payment integration or QR-signing code lightly — this logic must be crystal clear

### Orders
- Never delete or mutate order history — use append-only `order_events` and `order_status_log`
- Never skip order states in the primary Klerebank flow (`AWAITING_DROPOFF` → `ITEM_AT_HUB` → `COMPLETED`)
- Never build features assuming `UNCOLLECTED` / `AUTO_CANCELLED` / `CANCELLED` / `DISPUTED` / the legacy TCG courier states are reachable — they are reserved/unenforced (see "Order State Machine")

### Listings
- Never show prohibited item categories in listing creation flows
- Never allow a listing to go live without parcel dimensions specified
- Never allow a listing to go live without at least one shipping method configured
- Note: a listing **can** go live without verified `seller_bank_details` — verification only determines whether a future `seller_payouts` row is `pending` or `held`. Don't add a hard listing-creation block for this without confirming with the user first

### QR / Hub Fulfilment
- Never construct or parse QR tokens manually — always go through `lib/qr.ts` (`generateQrToken`/`verifyQrToken`)
- Never let `POST /api/qr/scan` be reachable by an account that isn't `role='admin' AND admin_verified=true`
- Never let a `qr_tokens` row be reused — `used_at`/`used_by` must be set atomically on first scan

### Shipping (legacy/secondary path)
- Never expose TCG API keys in client-side code
- Never show shipping cost to seller — they only see their item price
- Never show buyer's exact address to seller until shipment is booked
- Never allow shipment booking before payment is held in escrow
- Never recalculate shipping cost after purchase — use the locked quote
- Never skip tracking status updates — both parties must be notified

---

## Environment Variables Pattern
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # server-only — bypasses RLS, never expose to client

# Stitch (payment gateway)
STITCH_CLIENT_ID=
STITCH_CLIENT_SECRET=
STITCH_WEBHOOK_SECRET=
PLATFORM_COMMISSION_RATE=0.075   # e.g. 7.5% — never hardcode this

# QR Code signing (waybill system)
QR_SECRET=                      # 32+ random chars — signs DROP-OFF and COLLECTION QR tokens

# Cron-secured routes (/api/cron/reminders, /api/payout/trigger, /api/notifications/nudge)
CRON_SECRET=                    # sent as x-cron-secret header by Vercel Cron

# App
NEXT_PUBLIC_APP_URL=             # used to build the Stitch webhook callback URL and email links

# Notifications
RESEND_API_KEY=                 # transactional email (order/ledger/reminder notifications)

# The Courier Guy (legacy/secondary shipping path)
TCG_API_KEY= 54041081|6SxxLLpujh5lV91PJjrVuxmO3aE38y6qgQubcFbG33fbe7be
TCG_API_BASE_URL=https://api-pudo.co.za
TCG_WEBHOOK_SECRET=

# Auth
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# AWS (future)
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

---

## When In Doubt
1. Check the business rules section above first
2. Protect the buyer's money — default to the safer/more cautious path
3. Ask before making architectural decisions that affect the order state machine
4. Keep web and mobile in sync — shared logic goes in `packages/shared`
5. For shipping questions, refer to TCG API docs at https://api-pudo.co.za — but remember the TCG courier flow is the legacy/secondary path; the Klerebank hub network (QR-based drop-off/collection) is primary
6. Before assuming a status, fee, or enforcement rule is "live," check "Known Prototype Trade-offs" — several documented behaviours (Stitch webhook, auto-cancel/expiry enforcement, reservation cleanup) are intentionally not yet built
7. When changing fees, commission rates, or fulfilment fields, search for **all** places a value is duplicated (e.g. `fee_config` vs hardcoded constants in `apps/web/app/api/orders/route.ts`) — don't update just one