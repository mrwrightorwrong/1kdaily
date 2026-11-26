# Architecture decisions

Decisions made in Phase 0 and implemented (or scheduled) in later phases. Each entry records the decision, the reason, and what it constrains.

---

## ADR-001 — Split the product into a Money track and an Experience track

**Decision.** Financial logic lives in `packages/core` as pure TypeScript. The Next.js app renders typed read models and issues commands. RLS denies client writes to financial tables.

**Why.** The consumer surface needs rapid visual iteration; the financial engine needs deterministic, replayable behaviour. Separating them means a UI refactor cannot change a calculation, and the money layer can be tested without a browser or a database.

**Constrains.** No currency formatting, rounding, eligibility or schedule logic inside components. No direct client writes to `savings_contributions`, `ledger_entries`, `account_balances` or `loan_repayments`.

---

## ADR-002 — Money is integer kobo, represented as `bigint`

**Decision.** All amounts are `bigint` kobo in the domain, `numeric(20,0)` in Postgres, and strings at transport boundaries. Parsing is strict; formatting uses integer arithmetic rather than `Intl.NumberFormat`.

**Why.** Float arithmetic fails silently in exactly the cases that matter (installment splits, fee allocation, rounding across many rows). ICU currency formatting also changes between runtimes and can break snapshot tests.

**Constrains.** `applyBps` is the only rate primitive; `allocateKobo` is the only split primitive and guarantees `sum(output) === input`.

---

## ADR-003 — Balances are derived from an append-only double-entry ledger

**Decision.** Every financial event produces balanced ledger entries. `account_balances` is a rebuildable cache. Entries cannot be updated or deleted; corrections are reversals.

**Why.** A stored balance is an invitation to drift. An immutable, balanced journal is auditable, reconcilable, and defensible to a partner or regulator.

**Constrains.** Phase 4 must ship a deferred constraint trigger enforcing per-transaction balance, plus a nightly rebuild-and-compare job whose failure is a Sev-1 alert.

---

## ADR-004 — Materialise `savings_plan_days` at plan activation

**Decision.** One row per expected contribution day, created when the plan activates. Statuses: `pending`, `paid`, `missed`, `grace`, `paused`.

**Why.** Streaks, consistency, missed days, grace consumption and the calendar are all queries over this table. Deriving them from date arithmetic against contribution timestamps produces disputes at day boundaries and cannot explain grace usage.

**Constrains.** Phase 3 cannot begin without this table. Contributions allocate FIFO to the oldest unpaid day.

---

## ADR-005 — `business_date` is stored, not inferred

**Decision.** Contributions and repayments store the Lagos calendar date at confirmation time.

**Why.** "I paid at 11:58pm" must be resolvable forever, independent of server time zone or a later code change. Recomputation is non-deterministic.

---

## ADR-006 — Payments are credited only after server-side verification

**Decision.** Webhooks verify the provider signature and are stored idempotently; crediting requires a server-to-server `verify` call and a unique `(provider, provider_reference)` constraint.

**Why.** Webhook bodies can be replayed, delayed or spoofed. Browser responses are never evidence of payment.

**Constrains.** Phase 4 must pass duplicate-webhook, out-of-order and verify-mismatch tests before Phase 5 starts.

---

## ADR-007 — Eligibility is an explainable, versioned pipeline

**Decision.** The assessment computes: eligible savings → multiplier ceiling → affordability ceiling → risk ceiling → capital ceiling → `min(...)`, and stores inputs, engine version, policy version and the binding constraint.

**Why.** "No hidden rules" is a product promise. Storing the inputs makes a decision reproducible after policy changes.

**Constrains.** No eligibility number may be rendered without its binding constraint or a "not assessed" state.

---

## ADR-008 — Light canvas, dark emerald reserved for hero surfaces

**Decision.** Content surfaces use `#F6F8FC` with `#172033` text. The dark emerald gradient is used only for the savings hero, plan detail, splash and marketing bands.

**Why.** The supplied mobile reference is visually strong but its near-black canvas reduces daylight legibility of financial figures and conflicts with the brand palette. The reference's *language* (glass cards, big numerals, tiered detail) is adopted without its full-dark constraint.

**Constrains.** Any new component takes tokens from `globals.css`; no ad-hoc hex values. Green never represents money, gold is reserved for milestones.

---

## ADR-009 — Partner custody, not an internal pooled fund

**Decision.** The architecture assumes savings are held by a licensed partner and credit is funded by an authorised lender. 1kDaily is the technology and record-keeping layer.

**Why.** Deposit-taking and lending are licensed activities. Separating the ledger subtrees (`USER_SAVINGS_LIABILITY` vs `LOAN_RECEIVABLE`, `PARTNER_CAPITAL`) keeps customer funds and lending capital provably apart in accounting.

**Constrains.** No feature may treat savings balances as lending capital. Launch requires executed partner agreements and legal review of loan terms.

---

## ADR-010 — Empty states instead of sample data in the product

**Decision.** A user with no history sees ₦0, "not assessed", and a designed explanation. Marketing imagery is labelled illustrative.

**Why.** Fabricated financial figures in a fintech product destroy trust the first time a user compares them to reality, and they hide genuine loading/empty-state bugs.

**Constrains.** `getDashboardSnapshot()` returns an explicit `no_account` state until Phase 2/4 provide real data.

---

## ADR-011 — Identity numbers are never stored, only fingerprinted

**Decision.** A BVN/NIN is sent browser → server action → vendor → discarded. Persisted: `last4`,
`HMAC-SHA256(pepper, kind:value)`, vendor reference and status. The table has no column for the
value, no client privileges and zero RLS policies. Staff read masked data through RPCs only.

**Why.** "Protect the field" invites a future bug that exposes it: a new admin screen, a debug log, a
`select *`. Removing the value from the data model makes disclosure impossible rather than
discouraged. The HMAC still supports the one control that genuinely needs the number — preventing
the same identity verifying two accounts — without keeping it.

**Constrains.** Any future feature needing the raw number (re-verification, bureau checks) must go
through the vendor again; it cannot be read back. Rotating `KYC_HASH_PEPPER` invalidates duplicate
detection for existing records, so version the digest (`digest_key_version`) before rotating.

---

## ADR-012 — Server privileges are granted explicitly, never assumed

**Decision.** Every table's grants to `service_role` are declared in a migration, and default
privileges are set for future tables. The client roles receive SELECT only, where policies allow.

**Why.** During Phase 2, `service_role` inherited only trigger/reference privileges from the platform
defaults, so the first production-shaped write failed with SQLSTATE 42501 — invisible in local tests
that ran as `postgres`. Privileges are part of the schema contract, so they belong in version control
and must be asserted by tests.

**Constrains.** New tables must either add explicit grants or rely on the `alter default privileges`
that migration 05 installs. A migration that creates a table and forgets both will fail at runtime,
not at review time.
