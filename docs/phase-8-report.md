# Phase 8 — Guarantors and collateral

**Date:** 28 November 2026
**Status:** Complete. Email delivery is optional and off until a provider key is set; everything else works without it.
**Evidence:** `tools/db/phase8-tests.mjs` — 41/41 assertions. Browser journey (Playwright, local build): 11/11 — invite, accept, add collateral, upload, verify. Existing suites unaffected: 46/46 RLS, 5/5 loans, 10/10 repayments.

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
| Storage | private `collateral` bucket (8 MiB, PDF/JPEG/PNG/WebP); uploads and signed links issued server-side only |
| Customer UI | `/app/loans`: invite a guarantor, copy the single-use link, add collateral, upload evidence, follow review status |
| Guarantor UI | `/guarantee/[token]`: sign-in required, invitation summary, consent, accept or decline |
| Staff UI | `/admin/loans`: collateral queue with signed document links and per-document review, guarantor queue, release after closure |
| Notifications | `notifications` table written by triggers on guarantor response, collateral review, guarantor review and loan closure; unread badge, dashboard card, `/app/notifications` |
| Invitation email | Optional provider delivery (Resend); every invitation records `queued` / `sent` / `failed` / `skipped`, and the share link always works |
| Retention | Release starts a 90-day window (`documents_retain_until`); `purge_released_collateral_documents` plus `tools/db/purge-collateral-documents.mjs` |

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

### The loop closes

Every state change writes its own notification inside the same transaction, so a
guarantor cannot accept without the borrower being told, and a loan cannot close
without the guarantor being told. Email is an optional extra: when no provider is
configured the invitation is marked `skipped` and the borrower is told to share
the link — the application never claims a delivery that did not happen.

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
| Notifications | accepting and declining each notify the borrower; verifying collateral notifies its owner; another customer sees none; marking read affects only the caller |
| Email state | an invitation starts `queued`; a client cannot mark it sent (`42501`); the service role can record delivery |
| Retention | release sets `documents_retain_until = current_date + 90`; a customer cannot run the purge (`42501`); the purge deletes only due evidence and keeps a still-held asset's documents |

Browser journey (Playwright against a local production build): invite a guarantor →
accept from the invited account → collateral added → PDF uploaded to the private
bucket → risk officer verifies from the queue. 11/11 checks, with the database
confirming `verified` + `held` and a `pending` document.

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

1. **Connect an email provider.** Set `RESEND_API_KEY` and `EMAIL_FROM`; until then invitations are created and marked `skipped`, and the link is shared by hand.
2. **Schedule the retention purge.** `tools/db/purge-collateral-documents.mjs --apply` is idempotent and safe to run daily; it is not yet on a schedule.
3. Notification preferences (email/SMS per event) belong to the notification phase; the in-app record already exists.
4. Surface guarantor and collateral status in `/admin/risk` as well as the loans queue.
