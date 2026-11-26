# Phase 4 (first increment) — Ledger, payments and verified contributions

**Date:** 26 November 2026
**Status:** Complete. Verified end-to-end with a real ₦1,000 sandbox payment.
**Evidence:** contribution `KD-CON-737eec…4669` confirmed → Dr `1000` ₦1,000 / Cr `2200-<user>` ₦1,000 → one plan day paid → user savings ₦1,000 → ledger reconciliation 0 exceptions, 0 drift.

---

## 1. What is built

| Layer | Delivered |
| --- | --- |
| Ledger | `financial_accounts` (chart of accounts), `ledger_transactions`, `ledger_entries`, `account_balances`, `app.post_transaction` |
| Invariants | Balanced-at-commit (deferred constraint trigger), append-only entries and transactions, balances derived and rebuildable |
| Contributions | `savings_contributions` with provider reference, idempotency key and ledger link |
| Provider events | `payment_provider_events`, unique per `(provider, event_id)`; replays are harmless |
| Reconciliation | `reconciliation_runs` / `reconciliation_exceptions`; `app.run_ledger_reconciliation()` checks missing ledger rows, mismatched credits and balance drift |
| Paystack | Adapter: initialize, verify, HMAC-SHA512 webhook signature; live-key refusal outside an explicitly enabled production |
| Webhook | `POST /api/webhooks/paystack` — signature → store → verify → confirm |
| Return path | `GET /app/savings/confirm` — verifies, confirms idempotently, returns to the plan |
| UI | "Save now" on the plan page, `/app/transactions` history |
| Tests | 16 ledger assertions, 7 webhook integration checks, existing 72 unit / 46 DB / 27+27 journeys |

### The flow

```
Save now → initiate_contribution (status: initiated, reference KD-CON-…)
        → Paystack checkout
        → webhook (signature checked) ─┐
        → return URL (browser)         ├→ verify_transaction (server → Paystack)
                                       ┘        ↓
                     amount + currency match? ── no → fail, never credit
                                       ↓ yes
                     confirm_contribution (idempotent)
                       Dr 1000 Cash at provider
                       Cr 2200-<user> Savings liability
                       FIFO allocate to savings_plan_days
```

A webhook body alone never credits anything: the handler only uses it to find a reference, then calls Paystack's verify endpoint.

---

## 2. Test evidence

| Suite | Command | Result |
| --- | --- | --- |
| Ledger invariants + contribution flow | `npm run db:ledger` | **16/16** |
| Webhook security | `npm run webhook:test` | **7/7** |
| RLS/RPC (Phase 2+3) | `npm run db:test` | 46/46 |
| Unit | `npm test` | 72/72 |
| Build / typecheck | `npm run build` | clean |

Ledger suite covers: unbalanced transactions rejected, single-entry transactions rejected, append-only enforcement, derived balances, confirmation idempotency, amount mismatch, duplicate provider reference, partial payment, **FIFO fills overdue days before future ones**, paused-plan rejection, cross-customer isolation, service-role-only confirmation, provider events unreadable, clean reconciliation, and drift detection.

Webhook suite covers: unsigned rejected (401), forged signature rejected (401), unknown reference stored and ignored, replay creates no second row, **a valid signature with an unverifiable reference leaves the contribution `initiated` and writes no ledger entry**, non-charge events ignored.

Two harness defects were found and fixed during this increment: PostgreSQL numerics arrive as strings over PostgREST (assertions compared strings to numbers), and one FIFO test passed without asserting ordering.

---

## 3. Deliberately not done yet

- **Positive end-to-end payment.** Requires completing a Paystack test checkout. The code path is implemented and the verification logic is exercised by the ledger suite, but until one real test charge flows through, this is the honest gap. Test card: `4084 0840 8408 4081`, CVV `408`, any future expiry, PIN `0000`, OTP `123456`.
- **Provider-side reconciliation.** The ledger is reconciled against itself; comparing to Paystack's settlement list needs the settlements API and a scheduled job.
- **Reversals and refunds.** The ledger supports reversal transactions (`reverses_transaction_id`); the admin workflow is not built.
- **Reconciliation UI.** Tables exist; the admin screen is Phase 10.
- **Webhook retry/backoff for failures.** Handled events return 200; an unexpected failure returns 500 so Paystack retries, but there is no dead-letter queue.

---

## 4. Security posture

- No client write path to any ledger table; `authenticated` has SELECT only, and ledger tables are visible only with `finance:read`.
- `payment_provider_events` has no client privileges and no policy.
- Confirmation is service-role only and idempotent; duplicate provider references are a unique violation.
- Amount and currency are compared against the verified provider response, not the webhook body.
- Live keys are refused unless `ALLOW_LIVE_PAYMENTS=true` in a production build.
- No card data touches the application: checkout is hosted by Paystack.

---

## 5. Next

1. Complete one sandbox payment and verify the credit appears in the plan calendar and ledger.
2. Add provider reconciliation (`/settlement` + `/transaction` listing) and the exception review queue.
3. Build reversals with `finance:reverse` and separation of duties (Phase 5/13).
4. Then Phase 5: withdrawals, gated on reconciliation being green.
