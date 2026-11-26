# 1kDaily

**Save Daily. Build Capacity. Unlock Opportunity.**

A daily savings and credit-eligibility platform for the Nigerian market. Built in gated phases; see [`docs/phase-2-report.md`](docs/phase-2-report.md) for current status.

> **Status: Phase 3 complete — savings plans, schedules, calendar, streaks and milestones.**
> Authentication, identity verification and the plan engine are live. Contributions, the ledger and credit decisions are not.
> BVN and NIN are never stored: the database has no column that can hold one.

---

## Quick start

Requires Node.js 22 or newer (`.nvmrc` pins 22).

```bash
npm install
npm run secrets:setup -- "C:\path\to\keys.txt"   # writes .env.local (git-ignored)
npm run dev                                      # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` / `start` | Production build and serve |
| `npm run typecheck` | TypeScript across all workspaces |
| `npm test` | Unit tests (money, time, identity primitives) |
| `npm run verify` | typecheck → tests → build |
| `npm run db:sql -- --file <path>` | Run SQL through the Supabase Management API |
| `npm run db:test` | 46 RLS/RPC security and savings-engine assertions against the live project |
| `npm run db:role -- <email> <role>` | Grant/revoke a staff role |
| `npm run e2e` | Identity journey: sign-up → onboarding → verification → staff review |
| `npm run e2e:phase3` | Plan journey: catalogue → activation → pause/resume → cancel → dashboard |
| `npm run qa` | Headless render probe: overflow, console errors, screenshots |
| `npm run check:encoding` | UTF-8 BOM / mojibake guard |
| `npm run check:identity -- --keys <path> --db --git` | Prove real BVN/NIN values are absent from source, git history and database |

QA scripts drive the locally installed Edge/Chrome through `playwright-core` — no browser download. Artefacts land in `.screens/` (git-ignored).

---

## Repository layout

```
apps/web/               Next.js App Router application (Track E — Experience)
  src/app/              marketing, (auth), onboarding, app, admin, legal, api
  src/components/       brand, ui, layout, dashboard, forms, auth, onboarding, admin
  src/lib/              validation, env, nav, formatting, form state
  src/server/
    actions/            server actions (the only write path from the UI)
    auth/               session, profile, verification helpers
    integrations/kyc/   verification provider abstraction + deterministic mock
    security/           HMAC identity digest
    supabase/           server / browser / service-role clients
  src/middleware.ts     session refresh + route protection
packages/core/          Track M — money, time and identity primitives (no React, no IO)
supabase/migrations/    schema, RLS, functions, grants
supabase/tests/         security fixtures
tools/db/               SQL runner, RLS suite, role grant
tools/qa/               visual probe, mobile frames, Phase 2 E2E
tools/setup/            key-file → env writer (never prints secrets)
docs/                   ADRs and phase reports
```

---

## Savings plans (Phase 3)

A plan is a **materialised schedule**, not a running total. On activation the database writes one
row per expected contribution day (`savings_plan_days`). Everything else is a query over those rows:

| Concept | Rule |
| --- | --- |
| Missed day | the business date passed with no confirmed contribution |
| Grace | the first N missed days per plan (product-configured) are marked `grace` instead |
| Streak | consecutive `paid` days; grace and missed break it, paused and skipped are neutral |
| Consistency | paid days ÷ judged days (paid + partial + missed + grace) |
| Milestone | 7/14/30/60/90/180/365 **paid** days, per plan |
| Pause | days inside the pause are not missed; on resume the remaining schedule shifts by the pause length |
| Cancel | future days become `skipped`; paid days stay in the record |

**No contributions are recorded in this phase.** There is no simulation mode, no seeded "paid" days
and no fake balance: a plan created today shows zero paid, and its days become grace or missed as
real time passes. Confirmation is wired to the ledger in Phase 4, which is the only thing allowed to
write `paid_kobo`.

---

## Identity protection (the core Phase 2 guarantee)

A BVN or NIN travels **browser → server action → vendor API → discarded**.

Persisted, at most:

| Field | Purpose |
| --- | --- |
| `last4` | the only human-readable fragment |
| `digest` | `HMAC-SHA256(pepper, kind:value)`, for "one number, one account" |
| `vendor_reference` | the provider's record identifier |
| `status`, `match_result`, timestamps | the outcome |

Enforced by:

1. **Schema** — `identity_documents` has no column that could hold the number; a test asserts this.
2. **Privileges** — `anon` and `authenticated` have *no* privilege on the table, and there are **zero RLS policies** on it. Even a compromised RLS policy cannot expose it.
3. **API shape** — staff read a queue of `kind / last4 / status` through a `SECURITY DEFINER` function. There is no endpoint that returns a full number, for anyone.
4. **Pepper** — the HMAC key lives only in server env (`KYC_HASH_PEPPER`), never in the database. A database dump cannot be brute-forced against the 11-digit space.
5. **Logging** — provider errors are logged without payloads; audit entries store masked state only. A test scans every stored row for an 11-digit leak.
6. **Duplicate control** — a partial unique index on `(kind, digest) WHERE status = 'verified'` prevents the same number verifying two accounts.

Real BVN/NIN values never belong in this repository, its env files, tests or logs. Local development uses a deterministic mock provider that stores nothing.

**Audit it yourself:**

```bash
node tools/check-identity-leak.mjs --keys "<your keys file>" --db --git
# Source tree: 0 leak(s) · Git objects: 0 leak(s) · Database: 0 leak(s)
```

The scanner reads the identifiers at runtime and prints only counts. It checks every tracked file, every git object (including unreachable ones), and every row of the identity-related tables. At the time of the Phase 2 commit it reported **CLEAN** on all three.

---

## Security posture (Phase 2)

- Supabase Auth (email + password, email confirmation) with server-side session revalidation in middleware.
- No client role can INSERT/UPDATE/DELETE any table: RLS plus revoked privileges, writes go through `SECURITY DEFINER` functions or audited server actions.
- Permission-based staff authorisation (`app.has_permission`) with separation of duties; `/admin` is unreachable without a staff role.
- Append-only `audit_logs` and `consent_records` enforced by triggers.
- Identity decisions require a written reason and record actor, before/after state.
- Security headers, `noindex` on private routes, service-role key confined to server code.

Deferred: CSP, rate limiting beyond auth defaults, TOTP enrolment screen, custom SMTP, PNG PWA icons, service worker.

---

## What is intentionally not here yet

- Contributions, the double-entry ledger, reconciliation (Phase 4)
- Withdrawals (Phase 5)
- Loan eligibility, applications, disbursement, repayment (Phases 6–9)
- Admin analytics beyond the identity queue and plan catalogue (Phase 10)
- Notification delivery and support (Phase 11)
- Service worker / offline caching (Phase 12)

---

## Compliance posture

1kDaily is a technology platform. Customer funds are intended to be held by appropriately authorised financial partners. The codebase must not be used to take deposits, lend, or pool customer savings without the relevant licences and partner agreements. See `apps/web/src/lib/site.ts` and the drafts under `/legal`.
