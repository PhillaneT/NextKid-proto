# NextKid — Marketplace App on Replit

## Overview
A peer-to-peer marketplace platform (web + mobile) where users can buy and sell physical items.
Features include escrow-based payments via Peach Payments, in-app chat, dispute resolution, shipping tracking via The Courier Guy API, ratings/reviews, and a platform commission on completed sales.

## Architecture
- **Web:** Next.js 15 (App Router) — `apps/web/`
- **Mobile:** Expo React Native — `apps/mobile/`
- **Backend:** Next.js API routes
- **Auth/DB:** Supabase
- **Payments:** Peach Payments (ZAR, delayed capture escrow)
- **Shipping:** The Courier Guy API (via api-pudo.co.za)
- **Monorepo:** pnpm workspaces + Turborepo
- **Language:** TypeScript (strict)

## Project Structure
```
/
├── apps/
│   ├── web/          # Next.js web app (App Router) — main focus
│   └── mobile/       # Expo React Native app
├── packages/
│   ├── shared/       # Shared types, utils, constants
│   ├── ui/           # Shared UI components
│   └── api-client/   # Typed API client
├── supabase/         # Supabase migrations
└── CLAUDE.md         # Full project context & rules
```

## Running on Replit

### Workflow
- **Name:** `Start application`
- **Command:** `bash -c 'export PATH=$HOME/.local/bin:$PATH && cd apps/web && pnpm run dev'`
- **Port:** 5000 (webview)

### Package Manager
pnpm is installed globally to `~/.local/bin` via:
```
npm config set prefix ~/.local && npm install -g pnpm@10.32.1
```
If pnpm is missing after a Repl restart, re-run the above.

### Dev Script
`apps/web/package.json` dev script: `next dev -p 5000 -H 0.0.0.0`

## Required Environment Variables
Set these in Replit Secrets:
- `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — your Supabase anon/public key
- `TCG_API_KEY` — The Courier Guy API key
- `TCG_API_BASE_URL` — The Courier Guy API base URL
- `PLATFORM_COMMISSION_RATE` — commission rate (e.g. `0.1` for 10%)

## Key Files
- `apps/web/next.config.ts` — Next.js config (image domains for Supabase storage)
- `apps/web/app/` — App Router pages and API routes
- `apps/web/src/lib/supabase.ts` — Supabase client init
- `supabase/` — DB migration files
- `CLAUDE.md` — Full business rules, architecture decisions, known trade-offs
