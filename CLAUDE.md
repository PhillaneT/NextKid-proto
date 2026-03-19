# CLAUDE.md — Marketplace App

## Project Overview
A peer-to-peer marketplace platform (web + mobile) where users can buy and sell physical items.
Features include escrow-based payments via Stripe, in-app chat, dispute resolution, shipping tracking,
ratings/reviews, and a platform commission on completed sales.

**Web:** Next.js (App Router)
**Mobile:** Expo (React Native)
**Backend:** Next.js API routes → will migrate to AWS (Lambda, API Gateway, DynamoDB, S3, SES, SNS)
**Payments:** Peach Payments (escrow via delayed capture — SA-based alternative to Stripe)
**Auth:** NextAuth.js or AWS Cognito (18+ verified users only)
**Language:** TypeScript (strict mode — no `any`, ever)

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
- All users must be 18+ with verified email AND phone before transacting
- Sellers must connect and verify a Stripe payout account before listing
- Buyers must add at least one valid payment method before purchasing

### Payments & Escrow
- All payments go through **Peach Payments** with **delayed capture (escrow)** — no direct transfers
- Funds are only released to seller after buyer confirms receipt OR 7-day auto-confirm window passes
- Platform commission is deducted automatically before releasing funds to seller
- No commission is taken on refunded or cancelled orders
- Peach Payments supports ZAR natively — no currency conversion needed

### Listings
- Prohibited items are strictly banned (weapons, counterfeits, illegal goods)
- Listings must include: photos, description, price, category (+ subcategory), and location

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
- Location filtering: country → province/state → city → radius (km/miles)
- Filters: price range, condition, category, keywords, sort (newest, price asc/desc, distance)
- Search must be fast — use debounce on keyword input (300ms)
- Never show out-of-stock or delisted items in results

---

## Coding Standards

### TypeScript
- Strict mode always on — zero `any` types
- Define all API response shapes as interfaces in `packages/shared/types`
- Use Zod for runtime validation of all API inputs and external data

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
- Comment all Peach Payments-related code thoroughly — payment logic must be crystal clear
- Document all escrow state transitions explicitly

### File Naming
- Components: `PascalCase.tsx`
- Utilities/hooks: `camelCase.ts`
- Constants: `SCREAMING_SNAKE_CASE`
- API routes: `kebab-case`

---

## Order State Machine
Track orders through these statuses only — never skip states:

```
PENDING_PAYMENT → PAYMENT_HELD → PENDING_SHIPMENT → SHIPPED → DELIVERED
                                                              → DISPUTED → RESOLVED_REFUND
                                                                         → RESOLVED_RELEASED
                                                   → AUTO_CANCELLED (not shipped in time)
```

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
- Never use `any` in TypeScript — use `unknown` and narrow the type
- Never bypass escrow — funds must never go directly from buyer to seller
- Never expose Peach Payments access tokens in client-side code
- Never skip input validation on API routes
- Never use class components in React or React Native
- Never hardcode commission rates — always read from a config/env variable
- Never delete or mutate order history — use append-only event logs
- Never show prohibited item categories in listing creation flows
- Never allow a listing to go live without seller Peach Payments verification check
- Never comment Peach Payments integration code lightly — payment logic must be crystal clear

---

## Environment Variables Pattern
```
# Peach Payments
PEACH_PAYMENTS_ENTITY_ID=
PEACH_PAYMENTS_ACCESS_TOKEN=
PEACH_PAYMENTS_WEBHOOK_SECRET=
PLATFORM_COMMISSION_RATE=0.08   # e.g. 8% — never hardcode this

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
