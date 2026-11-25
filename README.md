# 1kDaily

**Save Daily. Build Capacity. Unlock Opportunity.**

A daily savings and credit-eligibility platform for the Nigerian market. This repository is being built in gated phases; see [`docs/phase-1-report.md`](docs/phase-1-report.md) for current status.

> **Status: Phase 1 complete — brand, design system, application shell.**
> No authentication, payments, ledger or credit logic is live. Nothing in this build moves or represents real money.

---

## Quick start

Requires Node.js 22 or newer (`.nvmrc` pins 22).

```bash
npm install
npm run dev        # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build (Turbopack) |
| `npm run start` | Serve the production build |
| `npm run typecheck` | TypeScript across all workspaces |
| `npm test` | Unit tests (`packages/core`) |
| `npm run verify` | typecheck → tests → build |
| `npm run qa` | Headless render probe: overflow + console errors + screenshots |
| `npm run qa:mobile` | Fixed-size mobile frames at real scale |
| `npm run qa:sections` | Capture individual page sections |

The QA scripts drive the locally installed Edge/Chrome via `playwright-core` — no browser download, no external service. Artefacts land in `.screens/` (git-ignored).

---

## Repository layout

```
apps/web/               Next.js App Router application (Track E — Experience)
  src/app/              routes: marketing, (app), admin, design, legal, api
  src/components/       brand, ui primitives, layout, dashboard, marketing, finance
  src/lib/              nav config, calendar, formatting, site copy
  src/server/           read models and (later) command handlers
packages/core/          Track M — money and time primitives. No React, no IO, no ambient clock
packages/config/        shared TypeScript base config
supabase/               (Phase 2+) migrations, pgTAP tests, seed data
tools/qa/               headless visual QA scripts
docs/                   architecture decisions and phase reports
```

---

## Architectural guardrails

These are not preferences; later phases depend on them.

1. **Two tracks, one-way dependency.** `apps/web` may not compute money. Financial arithmetic lives in `packages/core`, which cannot import React, Next, the Supabase client, or read the clock.
2. **Money is integer kobo as `bigint`.** No floats enter or leave `packages/core`. Formatting is integer-based so it cannot drift with ICU data.
3. **Balances are derived.** Once the ledger exists (Phase 4), no balance is a stored, editable number.
4. **A savings day is an explicit fact.** `business_date` is computed in `Africa/Lagos` at confirmation time and stored; it is never re-derived from `now()`.
5. **No fabricated financial data.** Empty states are designed product surfaces. Marketing imagery is labelled illustrative and internally consistent.
6. **Credit is never promised.** Multipliers are described as potential ceilings, in the UI and in copy.

Full rationale: [`docs/architecture-decisions.md`](docs/architecture-decisions.md).

---

## What is intentionally not here yet

- Authentication, sessions, RBAC, RLS (Phase 2)
- Savings plans, `savings_plan_days`, streaks, calendar data (Phase 3)
- Payments, ledger, reconciliation (Phase 4)
- Loan eligibility, applications, disbursement, repayment (Phases 6–9)
- Admin analytics and permissions (Phase 10)
- Notifications and support (Phase 11)
- Service worker / offline caching (Phase 12) — `manifest.webmanifest` exists, caching does not
- ESLint and CI pipelines (Phase 13 hardening)

The admin console is an **unauthenticated design shell**. It must not be deployed as a live operations tool.

---

## Compliance posture

1kDaily is a technology platform. Customer funds are intended to be held by appropriately authorised financial partners. The codebase must not be used to take deposits, lend, or pool customer savings without the relevant licences and partner agreements. See the disclaimers in `apps/web/src/lib/site.ts` and the draft policies under `/legal`.
