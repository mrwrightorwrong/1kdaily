# Phase 8 — Guarantors and collateral

**Date:** 28 November 2026
**Status:** Database and rules complete; customer and staff screens are the remaining work.
**Evidence:** `tools/db/phase8-tests.mjs` — 29/29 assertions. Existing suites unaffected: 46/46 RLS, 5/5 loans, 10/10 repayments.

---

## 1. What is built

| Layer | Delivered |
| --- | --- |
| Guarantor invitations | `guarantor_invitations` — single-use token, 7-day expiry, lifecycle `invited → opened → accepted / declined / expired / revoked` |
| Guarantors | `guarantors` — consent timestamp, terms version, guarantee amount, review actor |
| Consent RPCs | `invite_guarantor`, `accept_guarantor_invitation`, `decline_guarantor_invitation` |
| Guarantor lifecycle | `verify_guarantor`, `release_guarantor` |
| Collateral | `collateral_records` — category, valuation, ownership evidence, agreement reference |
| Collateral documents | `collateral_documents` — private storage path, per-document review status |
| Collateral RPCs | `submit_collateral`, `attach_collateral_document`, `review_collateral_document`, `review_collateral`, `release_collateral` |
| Access | Owner read policies, staff read via `loans:read`; `collateral:verify` granted to `risk_officer` |

### The four rules enforced in SQL, not the UI

1. **Consent belongs to the guarantor.** Accepting requires the signed-in account's
   email to match the invited address, plus a live, unused token. A forwarded link,
   a reused token or the borrower accepting on their behalf all fail.
   A database check constraint also refuses `accepted`/`verified` without a
   `consented_at` timestamp, so no code path can bypass it.
2. **Verification is not release.** `status` and `release_status` are separate
   columns. A verified asset is still held; release is a distinct action, audited,
   and idempotent.
3. **Nothing is released while the loan is open.** `release_collateral` and
   `release_guarantor` both require the application to be `closed`.
4. **Ownership is checked server-side.** Submitting, documenting, and reading all
   scope to the caller; documents must sit under
   `collateral/<user>/<record>/`, with path traversal refused.

### Assurance is not a promise of credit

A guarantor's `guarantee_amount_kobo` is captured at consent (the requested
amount at that moment) but it is not a credit decision, an approval, or a claim on
the guarantor's funds. Removing that association is what `release_guarantor` records.

---

## 2. Test evidence

| Area | Assertions |
| --- | --- |
| Submission | owner can submit; stranger refused (`P0002`); unknown category refused; zero valuation refused |
| Documents | path inside own folder accepted; foreign folder refused; `..` traversal refused; stranger refused |
| Review | owner cannot verify (`42501`); risk officer verifies and is recorded as reviewer; released records cannot be re-reviewed; unverified records cannot be released |
| Release | blocked while open; allowed after `closed`; status becomes `released` |
| Isolation | another customer sees zero rows; staff with `loans:read` sees the record |
| Guarantors | self-invitation refused; wrong-email acceptance refused (`42501`); consent + amount recorded; token reuse refused; expired token refused; decline creates no liability |
| Guarantor review | constraint blocks `verified` without consent; staff cannot verify before consent; verify succeeds after; release blocked while open, allowed after closure |
| Audit | submission and verification both appear in `audit_logs` |

Each case runs inside a transaction that is rolled back, so no fixture data or
temporary role grants survive.

---

## 3. Deliberate limits

- **No automatic release.** Closing a loan does not free collateral or guarantors.
  A human releases them, so a disputed settlement cannot quietly surrender security.
- **Documents are references, not blobs.** Rows hold a private storage path; the
  bucket policy and signed URLs belong to the upload work.
- **A guarantor is not a co-borrower.** There is no collection path against a
  guarantor in this phase, and the guarantee amount is not treated as recoverable.
- **One reviewer.** Rejections allow re-review; approvals lock the record until release.

---

## 4. Remaining

1. Customer UI on the loan page: invite a guarantor, add collateral, attach documents.
2. Staff review queue in `/admin/loans`: verify/reject with reasons, release after closure.
3. Storage bucket for collateral documents with signed-URL access.
4. Email delivery of the guarantor invitation link.
