# Phase 2 — Authentication, profiles, identity verification, RBAC

**Date:** 26 November 2026
**Status:** Complete. Security suite 30/30, end-to-end journey 27/27, unit tests 53/53, production build green.
**Scope:** Phase 2 of the master specification (§37) plus the identity-protection requirement.

---

## 1. What was built

| Area | Delivered |
| --- | --- |
| Auth | Email + password sign-up, email confirmation, sign-in, sign-out, password reset, session refresh and route protection in middleware |
| Onboarding | Three steps (details → identity → affordability), forward-only progression enforced in the database |
| Identity | BVN/NIN submission through a provider abstraction, masked persistence, duplicate-identity detection, consent evidence, audit trail |
| Profiles | Personal details editing, verification status, masked identity summary, affordability summary, consent history |
| Security | Password change requiring re-authentication, honest MFA status, account protection summary |
| Admin | Permission-gated identity review queue, verify/reject/request-review with mandatory reason, audit on view and decision |
| RBAC | 9 roles, 16 permissions, matrix seeded, `app.has_permission()` used by every staff policy |
| Data | 5 migrations: platform/audit/RBAC, identity tables, RLS, functions, service-role grants |
| Tooling | SQL runner, 30-case RLS suite, role grant tool, Phase 2 E2E, key→env writer that never prints secrets |

### Routes added

`/sign-up`, `/sign-in`, `/forgot-password`, `/reset-password`, `/verify-email`, `/auth/callback`,
`/onboarding/{profile,identity,financial}`, `/app/{profile,security}`, `/admin/kyc`.

`/app` and `/admin` are now dynamic, authenticated routes. `/admin` previously existed as an
unauthenticated design shell; it now requires a staff permission.

---

## 2. The identity-number design

The requirement was explicit: protect BVN and NIN from public exposure. The implementation goes
further than "protect" — the values are never stored.

```
browser form
   │  (TLS, POST body)
   ▼
server action ──► HMAC-SHA256(pepper, kind:value) ──► digest (64 hex)
   │                                                  last4
   ├──► vendor adapter (value in memory, then discarded)
   │
   ▼
service role ──► identity_documents (kind, status, last4, digest, vendor_reference)
                 user_verifications (status only)
                 audit_logs (masked state, reason)
```

**Layers, each independently sufficient to prevent disclosure:**

1. **No column exists.** `identity_documents` cannot hold an 11-digit identifier. A test queries
   `information_schema.columns` for `bvn|nin|value|identifier|number` and requires zero matches.
2. **No privilege.** `REVOKE ALL ... FROM anon, authenticated` on the table. An RLS mistake cannot
   help, because the roles cannot reach the table at all.
3. **No policy.** `identity_documents` has zero RLS policies, asserted by a test. Deny-by-default is
   the documented intent, not an oversight.
4. **No API surface.** Staff read `kind/last4/status/match_result` through
   `admin_identity_queue()` and `admin_identity_detail()`. No function in the schema returns a full
   identifier. There is no "reveal" action to abuse.
5. **No reversible storage.** The digest uses a pepper held only in server configuration. Without
   the pepper, an 11-digit space is trivially brute-forced; with it, the dump is useless.
6. **No duplicate accounts.** A partial unique index on `(kind, digest) WHERE status = 'verified'`.
   This fired during acceptance testing and blocked a second account using the same number — the
   control works in practice, not just in theory.
7. **No leakage in logs or audits.** A test scans `identity_documents`, `audit_logs`,
   `user_verifications`, `consent_records` and `user_profiles` for the submitted value and requires
   zero hits. The E2E repeats this after a full journey.

**Consent is recorded before the vendor call**, so a verification cannot exist without evidence that
the customer authorised it.

---

## 3. Database changes

Migrations applied to the development project (`supabase/migrations/`):

| File | Contents |
| --- | --- |
| `phase2_01_platform` | `app` schema, audit log (append-only), roles/permissions/role-permissions/user-roles, permission matrix, `app.has_permission`, `app.log_audit` |
| `phase2_02_identity` | `user_profiles`, `user_verifications`, `identity_documents`, `user_financial_profiles`, `consent_records`, sign-up trigger, duplicate-digest index |
| `phase2_03_rls` | privilege revokes, RLS enablement, owner and staff policies, zero-policy identity table |
| `phase2_04_functions` | `my_profile`, `update_my_profile`, `save_financial_profile`, `advance_onboarding`, `record_consent`, `my_verification_status`, `my_identity_summary`, `my_permissions`, `admin_identity_queue`, `admin_identity_detail`, `admin_decide_identity` |
| `phase2_05_service_grants` | explicit `service_role` DML grants and default privileges (see §6) |

Notable constraints: age ≥ 18 (function + trigger-level validation), obligations ≤ income, 11-digit
identity validation, immutable consent and audit rows, forward-only onboarding.

---

## 4. Tests performed

| Suite | Command | Result |
| --- | --- | --- |
| Unit (money, time, identity masking) | `npm test` | **53 passed** |
| RLS / RPC security | `npm run db:test` | **30/30 passed** |
| End-to-end journey | `npm run e2e` | **27/27 passed** |
| TypeScript | `npm run typecheck` | clean |
| Production build | `npm run build` | clean, 42 routes |
| Visual/overflow probe | `npm run qa` | 10 public surfaces, no overflow, no console errors |
| Encoding hygiene | `npm run check:encoding` | clean |

**RLS suite highlights** (each in a rolled-back transaction with a real JWT claim):

- anon cannot read profiles or identity documents
- a customer sees exactly one profile, their own
- a customer cannot read another customer's profile, affordability or consents
- no client role can INSERT/UPDATE/DELETE any table
- a customer cannot call the staff queue or the decision RPC
- a verification officer cannot read the audit log; an auditor can
- the staff queue returns masked columns only
- one identity number cannot verify two accounts
- no raw identifier appears in any audit payload
- onboarding cannot skip a step

**E2E journey:** sign-up → auto-confirm (test harness) → onboarding → BVN queued for review →
dashboard shows "identity in review" → non-staff blocked from `/admin` → verification officer sees a
masked queue → approves with a reason → customer sees "Identity verified" → database stores
`last4` + 64-hex digest only → raw value absent from every stored row.

---

## 5. Defects found and fixed during the phase

| Defect | Impact | Fix |
| --- | --- | --- |
| `service_role` had only TRIGGER/REFERENCES on new tables | Identity persistence failed in production with SQLSTATE 42501 | Explicit grants + default privileges in migration 05 |
| `needs_review` rendered as "Not provided" | Customer saw the wrong verification state | Status mapping corrected |
| `.test` email domain rejected by GoTrue | Sign-up failed with a generic error | Error mapping for `email_address_invalid`; test domain changed |
| Email rate limit surfaced as "Something went wrong" | Confusing failure | Explicit rate-limit message |
| E2E raced the revalidation after a decision | Flaky assertion (not a product bug) | Polling helper replaces fixed sleeps |
| Fixture cleanup blocked by append-only triggers | Security suite could not re-run | Fixtures made idempotent without deleting users |
| Reused synthetic BVN across E2E runs | Duplicate-identity control blocked verification (correct behaviour) | Unique identifier per run |
| `AccessTokin` / keys file has no separators | Setup tool could not parse it | Label-based parser, values never printed |
| Real BVN/NIN copy-pasted into a unit test | Exactly the exposure this phase must prevent | Synthetic constants, commit amended, object store pruned, audit tool added |

---

## 6. Security considerations

**Implemented**

- Session integrity: middleware calls `auth.getUser()` (server-validated), never trusts the cookie.
- Safe redirects: `safeNextPath` allows same-origin, path-relative targets only.
- Password reset responses are identical whether or not an account exists.
- Password change requires re-authentication with the current password.
- No client writes: RLS + revoked privileges; every write is a function or an audited server action.
- `identity_documents`: no privileges, no policies, masked RPCs only.
- Append-only audit and consent tables (triggers raise on UPDATE/DELETE).
- Staff actions require permissions; separation of duties is encoded in the role matrix.
- Service-role key confined to `src/server/**`; `server-only` guards the module.
- Secrets live in `.env.local` / `.env.migrate.local` (git-ignored, mode 0600 where supported).

**Deferred**

- TOTP enrolment UI (service capability enabled; screen is next increment).
- Custom SMTP — the project's default email quota is too small for real use.
- CSP and nonce strategy (needs final script inventory).
- Rate limiting on identity submissions is per-record (5 attempts / 24h) but not yet IP-based.
- Phone/SMS verification requires a provider; the field is collected and honestly marked unverified.
- Financial profile editing from `/app/profile` is display-only until Phase 6.

---

## 7. Operational notes

- The database was migrated through the Supabase **Management API** (`tools/db/sql.mjs`) because
  Docker is not installed and direct Postgres access from this machine is unreliable. This is a
  development convenience; CI and production should use `supabase db push` with a linked project.
- `npm run e2e` temporarily enables `mailer_autoconfirm` to avoid the SMTP quota, then restores the
  previous value and verifies the restore. It never runs against production.
- Test identities are synthetic. The BVN used in the E2E is generated per run and is not a real
  person's number.
- Fixture accounts (`alice.tests@`, `bola.tests@`, `verifier.tests@`, `auditor.tests@`
  `1kdaily.test`) exist in the development project with synthetic data.
- The keys file on the Desktop contains a database password in plaintext. Rotate it in the Supabase
  dashboard; nothing in the codebase depends on its current value.

---

## 9. Identity-leak audit

Requested explicitly: protect BVN and NIN from public exposure. After the implementation, the
actual identifiers from the operator's key file were searched for across three surfaces:

| Surface | Method | Result |
| --- | --- | --- |
| Source tree | every file, excluding `node_modules`/`.next`/`.git`/screenshots | 0 occurrences (139 files) |
| Git object store | `git cat-file --batch-all-objects`, including unreachable objects | 0 occurrences (1.6 MB) |
| Database | `to_jsonb(row)::text LIKE` across 7 identity-related tables | 0 rows |

Repeatable: `npm run check:identity -- --keys <path> --db --git`. Values are read at runtime and
never printed.

**Incident during the phase.** The first version of `packages/core/src/__tests__/identity.test.ts`
contained the operator's real BVN/NIN as test data — exactly the failure mode this requirement is
about. It was found by the audit above, replaced with synthetic constants, and the Phase 2 commit was
amended, the reflog expired and the object store pruned (`git gc --prune=now`). The old commit object
was confirmed absent and the full object-store scan returned clean. The lesson is recorded in ADR-011:
identity values must never be copy-pasted into fixtures, even "temporarily".

---

## 10. Phase 3 prerequisites

1. Confirm plan rules with the business: minimum/maximum daily amounts, durations, grace-day policy,
   missed-day consequences, pause rules, withdrawal restrictions.
2. Confirm the custody partner so `savings_products` terms match the real arrangement.
3. Decide whether plans can be denominated in naira only (assumed) or need a currency column now.
4. Approve Phase 3 scope: products/plan catalogue (admin-managed), plan activation with
   `savings_plan_days` materialisation, contribution recording against confirmed payments later,
   streaks, calendar, milestones, pause/resume, reminder scheduling.

Phase 3 builds against the ledger-free world: contributions cannot be "confirmed" until Phase 4, so
Phase 3 must ship plan creation, schedules and the calendar with a clearly-labelled simulation mode
for development only — or defer contribution recording entirely to Phase 4. Recommendation: ship the
plan engine, schedules, streaks and calendar now, and wire confirmation to the Phase 4 ledger rather
than inventing a parallel source of truth.
