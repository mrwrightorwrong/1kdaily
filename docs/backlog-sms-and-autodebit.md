# Backlog decisions — SMS gateway (Phase 11) and card auto-debit

Captured from the updated `Application Plan.txt` (SMS section, lines 2646–4067) and a product
request from the operator. Neither is in Phase 4's scope; this file exists so neither is lost.

---

## SMS gateway — Phase 11

The plan specifies a full messaging platform, broader than "send an SMS":

- **Providers:** SmartSMS and Termii adapters behind one interface, primary + automatic failover.
- **Configuration:** provider credentials, sender IDs per provider, cost per unit, test-send tool.
- **Templates:** 20 defaults (welcome, OTP, password reset, contribution, failed contribution,
  reminder, milestone, maturity, withdrawal request/approval, loan received/approved/rejected/
  disbursed, repayment reminder/confirmation, guarantor request/approval, security alert, account).
  Variables, preview, categories and priority (transactional > security > reminder > marketing).
- **Delivery:** queue, retries with backoff, delivery webhooks from providers, per-message attempts,
  status timeline, logs and detail view.
- **Cost control:** credit/balance monitoring, daily usage, budget limits, bulk SMS with filters.
- **Preferences:** per-user channel opt-in; transactional security alerts cannot be muted; marketing
  requires consent (NDPA 2023, DND rules).
- **Security:** SMS RBAC (`sms:read`, `sms:send`, `sms:configure`, `sms:bulk`), phone numbers masked
  in logs, audit trail, no balances or identity numbers in message bodies.

**Schema to add (Phase 11):** `sms_providers`, `sms_sender_ids`, `sms_templates`, `sms_messages`,
`sms_attempts`, `sms_webhook_events`, `sms_provider_pricing`, `sms_usage_daily`, `sms_settings`,
and a unified `notification_preferences`.

**Reconciliation with what exists:** Phase 3 added `savings_reminder_preferences` (time + channels).
Phase 11 should migrate that into one `notification_preferences` table (channel × category), keeping
the reminder time, so there is a single place users manage contact preferences.

**Architecture rule:** the SMS layer is an adapter, like KYC and payments. Domain code emits
`notification.requested` events; the messaging service decides channel, provider, template, retry
and cost. No domain module calls an SMS API directly.

---

## Card auto-debit — proposed, needs a decision

**Request:** a user adds a card once and their daily contribution is charged automatically.

**How it works with Paystack:** the first successful charge returns an `authorization_code`. Store
that (never the PAN) and later call `POST /charge_authorization` for each debit. Some issuers still
require OTP per charge, so failures are normal and must be designed for.

**Proposed schema:** `payment_authorizations` (user, provider, authorization code, brand, last4,
bank, expiry, consent record, status), `plan_auto_debit` (plan, authorization, enabled, next run),
`auto_debit_attempts` with a unique `(plan_id, business_date)` so a scheduler rerun cannot double
charge.

**Scheduler:** a daily job creates one contribution per active plan with an idempotency key of
`plan + business_date`, charges it, and lets the existing webhook/verify path confirm it. Failures
retry at most twice, then the day follows the normal grace/missed rule. A pre-debit notice goes out
the evening before; the user can pause or cancel at any time, effective from the next run.

**Two things to decide before building:**

1. **Economics.** A percentage-plus-fixed fee on a ₦1,000 daily debit is a material share of the
   amount. Daily card debits can cost ~10%+ of the contribution depending on Paystack's schedule.
   Weekly debit, a monthly top-up into the savings balance, or bank-transfer funding may be far
   cheaper. This is a product decision, not a coding one.
2. **Compliance.** Recurring card charges need explicit mandate consent, clear disclosure of amount
   and frequency, a simple cancellation path, and a dispute process. Legal review is required
   alongside CBN tokenisation expectations; the card data itself stays with the processor.

No code should be written for auto-debit until those two are answered.
