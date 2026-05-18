# CLAUDE.md — NextKid App

## Project Overview
A peer-to-peer Marketplace platform (web + mobile) where users can buy and sell physical items.
Features include escrow-based payments via Stitch, dispute resolution, hub-based fulfilment via Klerebank, ratings/reviews, and a platform commission on completed sales.

**Web:** Next.js (App Router)
**Mobile:** Expo (React Native)
**Backend:** Next.js API routes → will migrate to AWS (Lambda, API Gateway, DynamoDB, S3, SES, SNS)
**Payments:** Stitch (GraphQL API, SA-based, platform-as-middleman model — no native escrow needed)
**Shipping:** The Courier Guy API (via api-pudo.co.za)
**Auth:** NextAuth.js or AWS Cognito 
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
- All payments go through **Stitch** (GraphQL API, SA-based) — no direct buyer-to-seller transfers
- Funds are only released to seller after buyer confirms receipt OR 7-day auto-confirm window passes
- Platform commission is deducted automatically before releasing funds to seller
- No commission is taken on refunded or cancelled orders
- Stitch processes ZAR natively — no currency conversion needed
- Courier cost is on the buyer and added to the checkout once waybill is printed and sent to Seller.

### Listings
- Prohibited items are strictly banned (weapons, counterfeits, illegal goods)
- Listings must include: photos, description, price, category (+ subcategory), location, AND parcel dimensions
- Sellers must specify parcel dimensions (L × W × H cm + weight kg) before listing goes live
- Sellers must have at least one shipping method configured in their profile

### Orders & Shipping
- Seller has **maximum 3 business days** to ship after order is placed
- Seller must upload a valid tracking number and carrier in-app
- Auto-cancel + full refund if seller does not ship within 3 business days
- Shipping address is pulled from buyer profile (editable before shipment)

### Disputes
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

## Shipping & Courier Integration (The Courier Guy)

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

## Order State Machine
Track orders through these statuses only — never skip states:

```
PENDING_PAYMENT → PAYMENT_HELD → AWAITING_SHIPMENT_BOOKING → SHIPMENT_BOOKED → 
SHIPPED → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED → COMPLETED

                                                        ↓ (if issue)
                                                    DISPUTED → RESOLVED_REFUND
                                                             → RESOLVED_RELEASED
                                          
→ AUTO_CANCELLED (not shipped in time, full refund)
→ CANCELLED (buyer/seller cancelled before shipment)
```

### Order Data Model

```typescript
// packages/shared/types/order.ts

interface Order {
  id: string;
  status: OrderStatus;
  
  // Parties
  buyerId: string;
  sellerId: string;
  listingId: string;
  
  // Money (all in ZAR cents to avoid floating point)
  itemPriceCents: number;           // What seller listed
  shippingCostCents: number;        // What buyer paid for shipping
  totalPaidCents: number;           // itemPrice + shippingCost
  platformCommissionCents: number;  // Calculated at completion
  sellerPayoutCents: number;        // itemPrice - commission
  
  // Payment
  stitchPaymentId: string;
  paymentStatus: 'PENDING' | 'HELD' | 'CAPTURED' | 'REFUNDED';
  
  // Shipping
  shipping: {
    method: 'D2D' | 'D2L' | 'L2D' | 'L2L';
    serviceLevelCode: string;
    quotedRateCents: number;
    tcgShipmentId?: number;
    waybillNumber?: string;
    trackingUrl?: string;
    estimatedDelivery?: Date;
    
    // Addresses used
    collectionAddress: Address | { lockerId: string; lockerName: string };
    deliveryAddress: Address | { lockerId: string; lockerName: string };
  };
  
  // Timestamps
  createdAt: Date;
  paidAt?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
  completedAt?: Date;
  
  // Dispute (if any)
  dispute?: {
    openedAt: Date;
    reason: string;
    buyerEvidence: string[];
    sellerEvidence: string[];
    sellerRespondedAt?: Date;
    resolvedAt?: Date;
    resolution?: 'REFUND_FULL' | 'REFUND_PARTIAL' | 'RELEASE_TO_SELLER';
  };
}
```

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
- Never hardcode commission rates — always read from a config/env variable

### User Profiles & Location
- Never allow a user to list or purchase without a completed profile (location + school)
- Never show a user's exact street address to other users before a purchase is confirmed
- Never allow school selection before suburb is selected (enforce cascade)
- Never skip location hierarchy validation — province/city/suburb/school must be consistent
- Never allow unverified schools to appear in the main dropdown — show "request school" flow instead

### Payments
- Never bypass escrow — funds must never go directly from buyer to seller
- Never expose Stitch API keys or tokens in client-side code
- Never skip input validation on API routes
- Never comment Stitch payment integration code lightly — payment logic must be crystal clear

### Orders
- Never delete or mutate order history — use append-only event logs
- Never skip order states in the state machine

### Listings
- Never show prohibited item categories in listing creation flows
- Never allow a listing to go live without seller bank account verification
- Never allow a listing to go live without parcel dimensions specified
- Never allow a listing to go live without at least one shipping method configured

### Shipping
- Never expose TCG API keys in client-side code
- Never show shipping cost to seller — they only see their item price
- Never show buyer's exact address to seller until shipment is booked
- Never allow shipment booking before payment is held in escrow
- Never recalculate shipping cost after purchase — use the locked quote
- Never skip tracking status updates — both parties must be notified

---

## Environment Variables Pattern
```
# Stitch (payment gateway)
STITCH_CLIENT_ID=
STITCH_CLIENT_SECRET=
STITCH_WEBHOOK_SECRET=
PLATFORM_COMMISSION_RATE=0.08   # e.g. 8% — never hardcode this

# QR Code signing (waybill system)
QR_SECRET=                      # 32+ random chars — signs DROP-OFF and COLLECTION QR tokens

# The Courier Guy
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
5. For shipping questions, refer to TCG API docs at https://api-pudo.co.za