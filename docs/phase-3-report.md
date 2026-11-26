# Phase 3 — Savings plans, schedules, calendar and discipline

**Date:** 26 November 2026
**Status:** Complete. Database suite 46/46, plan journey 27/27, unit tests 72/72, production build green.
**Scope:** Phase 3 of the master specification (§6, §8, §37), with contribution confirmation deliberately deferred to the Phase 4 ledger.

---

## 1. The decision this phase turns on

Phase 3 asks for savings plans, contribution tracking, streaks, a calendar, milestones and reminders.
Contribution *confirmation* requires the ledger (Phase 4). Rather than invent a parallel source of
truth or seed fake "paid" days, this phase builds the **schedule** and the **engine**, and leaves
`paid` unwritten until the ledger can write it.

Consequences, deliberately accepted:

- A new plan shows `₦0.00` accumulated and `0%` progress. That is the truth.
- Days that pass without a confirmed payment become `grace` (while the allowance lasts) then `missed`.
- Streaks are zero until real payments land, but the logic that will compute them is complete and
  tested against synthetic day sets.
- There is **no simulation mode**. Adding one would create a path for fabricated money to look real.

---

## 2. What was built

| Area | Delivered |
| --- | --- |
| Catalogue | 5 administrator-managed products (Starter ₦1,000, Growth ₦2,000, Builder ₦5,000, Power ₦10,000, Custom ₦500–₦50,000), each with allowed durations, grace days and withdrawal terms |
| Plan activation | RPC validates product, amount, duration, start date and the 3-active-plan limit; materialises every expected day; writes events and an audit entry |
| Schedule | `savings_plan_days`, one row per business date, with `scheduled / paid / partially_paid / missed / grace / paused / skipped` |
| Maintenance | `refresh_my_plan_days()` converts past-due days to grace then missed, incrementing `grace_days_used` once per plan |
| Lifecycle | Pause, resume (shifting remaining days and extending the end date), cancel (future days become `skipped`) |
| Engine | Pure TypeScript: schedule build, progress, money totals, streaks, consistency, milestones, calendar indexing |
| UI | Catalogue, plan builder with full disclosure, plan detail (progress, calendar, schedule, terms, lifecycle), all-plans view, combined calendar |
| Dashboard | Real active plan, accumulated savings, streak, calendar, milestone progress |
| Reminders | Preferences stored (time, channels) with delivery deferred to Phase 11 |
| Admin | Catalogue is DB-driven; the editing screen remains Phase 10 (permission `config:write`) |

### Routes added

`/app/plans`, `/app/plans/new`, `/app/plans/[planId]`, `/app/savings`, `/app/calendar`.
`/app/savings`, `/app/plans` and `/app/calendar` were removed from the placeholder generator.

---

## 3. Money and schedule integrity

- `daily_amount_kobo`, `expected_kobo`, `paid_kobo` are `numeric(20,0)` kobo. Application code uses
  `bigint`; no floating point enters a calculation.
- Expected total is `daily × duration`, computed in the engine (`bigint`) rather than trusted from the
  client.
- The schedule is unique per `(plan_id, business_date)`; the constraint is **deferrable** so a pause
  can shift an entire future schedule in one statement without transient key collisions.
- Days are never deleted by lifecycle actions: they change status, preserving history.
- `savings_plan_events` is append-only (trigger), so pause/resume/cancel history cannot be rewritten.
- Plan rules (grace days, withdrawal policy and terms) are **snapshotted** on the plan at creation.
  Editing the catalogue later cannot rewrite an existing agreement.

---

## 4. Engine rules (the part that must be explainable)

| Rule | Definition |
| --- | --- |
| Missed | `business_date < today`, no confirmed payment, no grace left |
| Grace | the earliest missed days are covered first, up to the plan's allowance |
| Current streak | consecutive `paid` days ending at the latest judged day |
| Longest streak | maximum run of consecutive `paid` days |
| Neutral days | `paused` and `skipped` neither extend nor break a streak |
| Consistency | `(paid + partial) ÷ (paid + partial + missed + grace)` |
| Days remaining | `scheduled` days on or after today |
| Next due | earliest `scheduled` day on or after today |
| Milestone | total **paid** days against 7/14/30/60/90/180/365 |

Grace **breaks** a streak: it is not a payment, and softening that would make the record flattering
rather than accurate.

---

## 5. Database changes

| Migration | Contents |
| --- | --- |
| `phase3_01_savings` | `savings_products` (+ seed), `savings_plans`, `savings_plan_days`, `savings_plan_events`, `savings_reminder_preferences`, indexes and triggers |
| `phase3_02_savings_functions` | `create_savings_plan`, `refresh_my_plan_days`, `pause_my_plan`, `resume_my_plan`, `cancel_my_plan`, `set_reminder_preferences`, privileges and RLS |

RLS: customers read only their own plans/days/events/preferences; staff need `savings:read`; no
client role can insert, update or delete a plan or a day.

---

## 6. Tests performed

| Suite | Command | Result |
| --- | --- | --- |
| Unit (engine, money, time, identity) | `npm test` | **72 passed** |
| Database security + engine | `npm run db:test` | **46/46 passed** |
| Phase 2 identity journey | `npm run e2e` | 27/27 passed |
| Phase 3 plan journey | `npm run e2e:phase3` | **27/27 passed** |
| Typecheck / build | `npm run typecheck`, `npm run build` | clean |
| Visual review | screenshots in `.screens/phase3` | catalogue, builder, detail, paused, cancelled, dashboard |

**New database assertions:** catalogue readability; grace-before-missed ordering (2 grace, 3 missed,
`grace_days_used = 2`); cross-customer isolation of plans and days; ownership check on pause; staff
visibility by permission; no direct client writes; preset amount mismatch; custom limits; duration
validation; past start date; schedule materialisation (60 days, correct end date); three-active-plan
limit; pause/resume shift (32-day span after a 2-day pause); cancellation marks 30 days skipped;
reminder privacy.

**Phase 3 journey:** onboarding → catalogue → builder disclosure → activation → 30 materialised days →
pause → resume → custom plan → cancellation → dashboard shows the active plan with zero accumulated.

---

## 7. Defects found and fixed

| Defect | Impact | Fix |
| --- | --- | --- |
| A CTE calling `create_savings_plan` created rows invisible to the same statement | Misleading test (0 days) — not a product bug, but it hid the check | Test rewritten with a temp table and a second statement |
| E2E asserted sentence case against CSS-uppercased badges | Three false failures | Added `data-testid="plan-status"` and case-insensitive assertions |
| `getDashboardSnapshot` became dead code | Noise | Removed |

No production defect was found in the plan engine; the two failures above were test defects.

---

## 8. Known limitations

- **No contribution recording.** `paid_kobo` is writable only by the Phase 4 ledger; nothing in this
  build writes it.
- **No plan completion transition.** A plan whose end date has passed stays `active` until Phase 4 can
  determine that every day is settled. The engine exposes `isPlanFinished`, which Phase 4 will use.
- **Reminders are stored, not delivered** (Phase 11).
- **Admin catalogue editing** is Phase 10; products are seeded by migration.
- **No withdrawal flow**; plans declare withdrawal terms only.
- Pause has no configured maximum duration yet; `pause_days_used` records usage so a policy can be
  enforced without a schema change.

---

## 9. Phase 4 prerequisites

1. Confirm the payment provider account and sandbox keys (Paystack assumed).
2. Confirm the chart of accounts and the custody partner's settlement model.
3. Decide the confirmation SLA: webhook + verify, with a polling reconciler as backstop.
4. Approve the ledger design: append-only entries, deferred balance constraint, `account_balances` as a
   rebuildable cache, `(provider, provider_reference)` uniqueness, idempotency keys.
5. Phase 4 must also link `savings_plan_days.contribution_id` to the ledger transaction, allocate FIFO
   to the oldest unpaid day, and recompute nothing in the UI.

Recommendation: build the ledger and payment adapters **before** any withdrawal work (Phase 5), and
gate Phase 5 on the duplicate-webhook, replay and reconciliation suites passing.
