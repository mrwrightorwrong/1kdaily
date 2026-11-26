# Loan pricing, interest and fees — Phase 7 specification

Requested during Phase 6. Interest, processing fee and insurance fee are **admin-configured per loan
product**, disclosed before acceptance, and deducted at disbursement. This file fixes the accounting
and the disclosure rules so Phase 7 cannot implement them inconsistently.

---

## 1. Product configuration (administrator, versioned, audited)

| Field | Type | Notes |
| --- | --- | --- |
| `interest_rate_bps` | integer | basis points, never a float |
| `interest_method` | `flat` \| `declining_balance` | never presented as interchangeable |
| `processing_fee_bps` / `processing_fee_fixed_kobo` | integer | one or the other, plus min/max caps |
| `insurance_fee_bps` / `insurance_fee_fixed_kobo` | integer | may be a pass-through to an insurer |
| `min_loan_kobo`, `max_loan_kobo` | integer | |
| `tenor_months` | integer[] | allowed terms |
| `grace_period_days` | integer | |
| `late_fee_policy` | text | lawful, disclosed, capped |
| `fees_deducted_at_disbursement` | boolean | true for this product family |
| `policy_version` | text | snapshotted on every offer |

Any change requires `config:write`, a reason, and an audit entry. Existing loans keep the version
they were priced under.

---

## 2. Arithmetic

```
principal        P
processing fee   Fp = min(max(P × fee_bps/10000, min), max)   (or fixed)
insurance fee    Fi = P × insurance_bps/10000                  (or fixed)
interest         I  = flat: P × rate × tenor/12
                     declining: sum of monthly interest on the reducing balance
total payable    T  = P + I
net disbursed    N  = P − Fp − Fi
installment      S  = T / tenor      (integer kobo, remainder on the last installment)
```

Guard rails: `Fp + Fi < P` (otherwise the offer is invalid), all amounts integer kobo, and the
schedule's installments must sum exactly to `T`.

---

## 3. Ledger at disbursement (the part that is easy to get wrong)

The borrower receives `P − Fp − Fi`, but owes `P + I`. The fees are income recognised immediately;
they are **not** subtracted from the receivable.

```
Dr 1200 Loan receivable          P
Cr 1000 Cash at provider         N
Cr 4010 Fee income               Fp        (processing fee)
Cr 2000 Insurance payable        Fi        (owed to the insurer)
```

Balanced: `P = N + Fp + Fi`.

- Remitting insurance to the insurer: `Dr 2000 Insurance payable / Cr 1000 Cash`.
- Repayments: `Dr 1000 Cash / Cr 1200 Loan receivable (principal) / Cr 4000 Interest income`.
- Fee income is never recognised twice; it is booked once, at disbursement.
- If disbursement fails, the ledger transaction is not posted (or is reversed), and the fees remain
  unearned.

---

## 4. Disclosure before acceptance

The offer screen and contract must show, in naira:

- principal, interest rate and **method**, total interest
- processing fee (amount and basis), insurance fee (amount and basis)
- **net amount you receive**
- total payable and installment amount
- full schedule with due dates
- consequences of missed payments, and any guarantor/collateral

No fee may be deducted that was not disclosed. No fee may be taken before approval. The effective
annual cost must be shown, not just the nominal rate, because fees taken upfront raise it materially.

---

## 5. Insurance

If insurance is mandatory for a product, it is disclosed as a condition, with the insurer named and
the cover described. If optional, it requires separate consent. Premiums are held as a payable until
remitted and never treated as platform revenue.

---

## 6. Tests Phase 7 must pass

1. `Fp`, `Fi`, `N` and `T` match hand-computed values for flat and declining products.
2. Installments sum exactly to `T` (largest-remainder allocation).
3. Disbursement entries balance and net cash equals `N`.
4. Fee income equals `Fp` exactly once.
5. Insurance payable equals `Fi` until remittance, then zero.
6. An offer with `Fp + Fi ≥ P` is rejected.
7. Changing the product after an offer does not change that offer.
