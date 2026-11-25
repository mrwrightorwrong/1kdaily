# Phase 1 — Brand, design system and application shell

**Date:** 25 November 2026
**Status:** Complete. Build, typecheck and unit tests green. Visual QA passed at desktop and mobile widths.
**Scope delivered:** Phase 1 of the master specification (§37) plus the Phase 0 artefacts (§40).

---

## 1. What was built

A working Next.js 16 application with two distinct surfaces:

| Surface | Route | State |
| --- | --- | --- |
| Marketing site | `/` | Complete for Phase 1; every link resolves |
| Consumer app shell + dashboard | `/app` | Complete, honest empty states, no fabricated data |
| Consumer section placeholders | `/app/{savings,plans,calendar,eligibility,loans,repayments,transactions,notifications,profile,security,support}` | Resolve, state their phase, no dead links |
| Operations console | `/admin` + 7 section placeholders | Design shell only, unauthenticated, clearly marked restricted |
| Design system reference | `/design` | Tokens, type, money formatting, buttons, badges, progress, empty/loading states |
| Auth entry | `/sign-in` | States Phase 2 status; no fake form |
| Legal drafts | `/legal/{terms,privacy,loan-terms}` | Draft copy, marked pending legal review |
| System | `/manifest.webmanifest`, `/robots.txt`, `/sitemap.xml`, `/icon.svg`, 404, error boundary | Complete |

**Brand assets:** primary mark, horizontal lockups (light/dark), monochrome lockup, favicon, 192/512/maskable PWA icons. All vector.

**Design system:** emerald/navy/gold token set, Inter variable type scale, tabular-numeral money component, button/badge/card/progress/skeleton/empty-state primitives, hero surface and glass-card utilities, reduced-motion support.

**Motion:** one-shot splash reveal (once per session, skipped for reduced-motion), page rise, loaders (`DailyLoadingScreen`, `DailySectionLoader`, `DailyInlineLoader`).

---

## 2. Files created

### Root
- `package.json`, `.gitignore`, `README.md`
- `docs/architecture-decisions.md` (10 ADRs), `docs/phase-1-report.md` (this file)

### Track M — `packages/core`
- `package.json`, `tsconfig.json`, `src/index.ts`
- `src/money.ts` — kobo arithmetic, strict parsing, integer formatting, compact formatting, basis-point maths, largest-remainder allocation
- `src/time.ts` — business-date derivation in `Africa/Lagos`, date arithmetic, month helpers, display formatting
- `src/__tests__/money.test.ts`, `src/__tests__/time.test.ts`

### Track E — `apps/web`
- Config: `package.json`, `tsconfig.json`, `next.config.ts` (security headers, `transpilePackages`), `postcss.config.mjs`
- Theme: `src/app/globals.css`
- Root: `layout.tsx` (local Inter, metadata, viewport, skip link), `icon.svg`, `manifest.ts`, `robots.ts`, `sitemap.ts`, `not-found.tsx`, `error.tsx`
- Marketing: `page.tsx`; `components/marketing/{marketing-header,marketing-footer,phone-preview}.tsx`
- App shell: `app/app/{layout,loading,page}.tsx`, `app/app/[section]/page.tsx`
- App chrome: `components/layout/{app-sidebar,app-topbar,app-bottom-nav,mobile-nav}.tsx`
- Dashboard: `components/dashboard/{savings-hero,metric-strip,plan-progress-card,growth-card,calendar-card,eligibility-card,milestone-card,activity-card}.tsx`
- Admin: `app/admin/{layout,page}.tsx`, `app/admin/[section]/page.tsx`, `components/admin/{admin-sidebar,admin-mobile-nav}.tsx`
- Supporting: `components/brand/{logo,splash-screen,loaders}.tsx`, `components/ui/primitives.tsx`, `components/finance/money.tsx`, `components/marketing/*`
- Library: `lib/{cn,site,content,nav,calendar}.ts`, `server/dashboard/get-dashboard-snapshot.ts`
- Other routes: `app/design/page.tsx`, `app/sign-in/page.tsx`, `app/legal/[doc]/page.tsx`
- Assets: `src/app/fonts/InterVariable.woff2`, `public/brand/*.svg`

### Tooling
- `tools/check-encoding.mjs` — BOM / mojibake scanner
- `tools/qa/probe.mjs` — overflow, console-error and screenshot sweep
- `tools/qa/mobile.mjs` — fixed-size mobile frames, optional drawer capture
- `tools/qa/sections.mjs` — element-level section screenshots + font verification
- `tools/qa/inspect.mjs` — computed-style inspection

---

## 3. Database changes

**None.** No Supabase project, migrations or schema exist yet. Phase 1 is intentionally a static, data-free shell. The first migration lands in Phase 2 (`supabase/migrations`), and financial tables in Phase 4.

---

## 4. Tests performed

| Check | Command | Result |
| --- | --- | --- |
| TypeScript (both workspaces) | `npm run typecheck` | Pass, no errors |
| Unit tests | `npm test` | **44 passed** (2 files) |
| Production build | `npm run build` | Pass — 32 routes, 32/32 static pages generated |
| Encoding hygiene | `node tools/check-encoding.mjs .` | Clean |
| Visual/overflow QA | `node tools/qa/probe.mjs` | 10 routes × desktop + mobile, no horizontal overflow, no console errors (except the intentional 404 probe) |

**Unit coverage highlights**
- Money: strict parsing (`1,00` rejected, `1,234.56` accepted), grouping, sign placement, values above `Number.MAX_SAFE_INTEGER`, compact unit promotion (`₦999,999.99 → ₦1m`, never `₦1000.0k`), basis-point half-up rounding, allocation sum invariant, maximum guard.
- Time: 23:30 UTC → next Lagos day, leap year, year boundary, negative deltas, weekday indexing, month lengths, stable display labels.

**Manual/visual checks:** marketing page, dashboard at 1440 and 390, admin at 1440 and 390, design system, placeholder route, legal page, 404, mobile drawer open/close.

---

## 5. Defects found and fixed during the phase

| Defect | Impact | Fix |
| --- | --- | --- |
| `parseNairaToKobo("1,00")` silently accepted | Would corrupt user-entered amounts | Grouping validated before separators are stripped |
| Compact money could render `₦1000.0k` | Unreadable, unit boundary bug | Unit promotion after rounding |
| Marketing 2×/3× cards used 1×/1.5× values | Factually wrong illustration of the core concept | Corrected to ₦180,000 / ₦270,000 on ₦90,000 |
| FAQ column misaligned to the page grid | Visible layout inconsistency | Two-column grid with `self-start` |
| Mobile drawer clipped to 64px | Navigation unusable on phones | Portal to `body`, `AnimatePresence` inside the portal (backdrop-filter was creating the containing block) |
| Admin mobile tab strip widened the page to 406px | Horizontal scroll | Removed the negative-margin bleed |
| PowerShell round-trip mangled UTF-8 in test fixtures | Tests failed with mojibake | Files rewritten; `tools/check-encoding.mjs` added |
| Duplicate font fallback stack | Redundant CSS | Rely on `next/font` fallback + theme stack |

---

## 6. Security considerations

**Implemented**
- Response headers: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, restrictive `Permissions-Policy`, `poweredByHeader: false`.
- `/app`, `/admin`, `/design`, `/sign-in` are `noindex, nofollow` and disallowed in `robots.txt`.
- No secrets, keys or `.env` files exist in the repository.
- No client-side financial arithmetic: all formatting and maths come from `packages/core`.
- No service worker, so no financial payload is cached.
- Every external link is internal; no third-party scripts, fonts or trackers are loaded at runtime (Inter is self-hosted).

**Deliberately deferred**
- CSP (needs a nonce/hash strategy once Supabase and payment scripts exist) — Phase 13.
- Authentication and RLS — Phase 2.
- Admin authorisation — the console is an unauthenticated shell and must not be exposed as a live tool.
- Rate limiting, CSRF strategy for server actions, upload validation — Phases 2/4.

---

## 7. Known limitations / deviations

1. **No ESLint and no CI.** TypeScript strict mode and the production build are the current gates. Both should be added before Phase 2 merges any auth code.
2. **PWA icons are SVG only.** iOS home-screen icons require PNG (180/192/512). Deferred to Phase 12 alongside the manifest/service-worker work.
3. **Wordmark in exported SVG lockups uses `<text>`.** Renders with the viewer's font. The in-app wordmark is live text; a fully outlined lockup should be produced before external brand use.
4. **Drawer has no focus trap.** Escape, backdrop click and a labelled close button work; focus is not cycled within the dialog. Add with a focus-trap utility in Phase 2.
5. **Splash shows once per session for 1.5s.** It does not run when storage is blocked or reduced motion is set.
6. **Local Supabase cannot run** — Docker is not installed on this machine. Phase 2 needs either Docker Desktop or a cloud Supabase development project.
7. **Chart is a designed empty state.** Recharts is not installed yet; there is no series to plot until Phase 4.
8. **Admin metrics are em-dashes.** Intentional: no data layer exists.

---

## 8. Phase 2 prerequisites

1. Decide local database approach: Docker Desktop (enables pgTAP and a full local stack) or cloud Supabase dev project.
2. Create the Supabase project(s): local/dev/staging/prod separation, with the service-role key confined to server code.
3. Confirm the identity verification vendor for BVN/NIN (tokenised storage only — never raw identifiers).
4. Confirm the custody partner so the `financial_accounts` model in Phase 4 matches the real arrangement.
5. Approve Phase 2 scope: auth (email + phone, TOTP MFA), onboarding, profiles, verification levels, RBAC foundation, RLS policies + pgTAP suite.

---

## 9. Process note

The repository is initialised with a single Phase 1 commit. `.screens/` and build artefacts are ignored. `npm run verify` (typecheck → tests → build) is the pre-commit gate until CI exists.
