"use client";

import { useActionState, useState } from "react";
import { Banknote, Landmark } from "lucide-react";
import { FormAlert, SelectField, TextField } from "@/components/forms/primitives";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { initialFormState } from "@/lib/form";
import { addBankAccountAction, requestWithdrawalAction } from "@/server/actions/withdrawals";

const BANKS = [
  { code: "044", name: "Access Bank" },
  { code: "058", name: "GTBank" },
  { code: "011", name: "First Bank" },
  { code: "057", name: "Zenith Bank" },
  { code: "033", name: "UBA" },
  { code: "070", name: "Fidelity Bank" },
  { code: "232", name: "Sterling Bank" },
  { code: "076", name: "Polaris Bank" },
  { code: "221", name: "Stanbic IBTC" },
  { code: "214", name: "FCMB" },
] as const;

export function AddBankAccountForm({ hasAccount }: { readonly hasAccount: boolean }) {
  const [state, action, pending] = useActionState(addBankAccountAction, initialFormState);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Payout account</CardTitle>
          <p className="mt-1 text-[0.75rem] text-muted">
            {hasAccount
              ? "Add another account if you need to."
              : "Where completed savings should be paid."}
          </p>
        </div>
        <Landmark className="size-4 text-muted" aria-hidden />
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-3">
          <SelectField
            id="bank_code"
            label="Bank"
            required
            defaultValue=""
            error={state.fieldErrors?.bank_code}
            onChange={(event) => {
              const match = BANKS.find((bank) => bank.code === event.target.value);
              const hidden = event.currentTarget.form?.elements.namedItem("bank_name");
              if (hidden instanceof HTMLInputElement && match) hidden.value = match.name;
            }}
          >
            <option value="" disabled>
              Select your bank
            </option>
            {BANKS.map((bank) => (
              <option key={bank.code} value={bank.code}>
                {bank.name}
              </option>
            ))}
          </SelectField>
          <input type="hidden" name="bank_name" defaultValue="" />

          <TextField
            id="account_number"
            label="Account number"
            inputMode="numeric"
            maxLength={10}
            required
            error={state.fieldErrors?.account_number}
          />
          <TextField
            id="account_name"
            label="Account name"
            required
            maxLength={100}
            error={state.fieldErrors?.account_name}
          />

          <FormAlert state={state} />

          <Button type="submit" variant="secondary" size="sm" disabled={pending}>
            {pending ? "Verifying with bank…" : "Save account"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function RequestWithdrawalForm({
  plans,
  accounts,
}: {
  readonly plans: ReadonlyArray<{ id: string; name: string; availableKobo: string }>;
  readonly accounts: ReadonlyArray<{ id: string; label: string }>;
}) {
  const [state, action, pending] = useActionState(requestWithdrawalAction, initialFormState);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  if (plans.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Withdraw</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[0.8125rem] text-muted">
            Withdrawals open when a plan completes or is cancelled.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Request a withdrawal</CardTitle>
          <p className="mt-1 text-[0.75rem] text-muted">
            Finance reviews every request. The amount is reserved immediately.
          </p>
        </div>
        <Banknote className="size-4 text-muted" aria-hidden />
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-3">
          <input type="hidden" name="idempotency_key" value={idempotencyKey} />

          <SelectField id="plan_id" label="Plan" required defaultValue={plans[0]?.id}>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} — {Number(plan.availableKobo) / 100} available
              </option>
            ))}
          </SelectField>

          <SelectField id="bank_account_id" label="Pay into" required defaultValue={accounts[0]?.id}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.label}
              </option>
            ))}
          </SelectField>

          <TextField
            id="amount"
            label="Amount (₦)"
            inputMode="decimal"
            required
            error={state.fieldErrors?.amount}
          />

          <FormAlert state={state} />

          <Button type="submit" size="md" disabled={pending || accounts.length === 0}>
            {pending ? "Requesting…" : "Request withdrawal"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
