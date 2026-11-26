"use client";

import { useActionState, useState } from "react";
import { CreditCard } from "lucide-react";
import { Money } from "@/components/finance/money";
import { FormAlert, TextField } from "@/components/forms/primitives";
import { Badge, Button } from "@/components/ui/primitives";
import { initialFormState } from "@/lib/form";
import { startContributionAction } from "@/server/actions/payments";

export function SaveNowForm({
  planId,
  dailyAmountKobo,
  testMode,
}: {
  readonly planId: string;
  readonly dailyAmountKobo: bigint;
  readonly testMode: boolean;
}) {
  const [state, action, pending] = useActionState(startContributionAction, initialFormState);
  // One key per rendered form: retries reuse it, so a double submit cannot
  // create two contributions.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="plan_id" value={planId} />
      <input type="hidden" name="idempotency_key" value={idempotencyKey} />

      <TextField
        id="amount"
        label="Amount (₦)"
        inputMode="decimal"
        required
        defaultValue={String(Number(dailyAmountKobo) / 100)}
        hint={`Usual daily amount: ${Number(dailyAmountKobo) / 100}. Paying more fills the next days in order.`}
        error={state.fieldErrors?.amount}
      />

      <FormAlert state={state} />

      <Button type="submit" size="md" className="w-full" disabled={pending}>
        <CreditCard className="size-4" aria-hidden />
        {pending ? "Opening checkout…" : "Pay with Paystack"}
      </Button>

      <div className="flex items-center justify-between text-[0.625rem] text-subtle">
        <span>Card, bank transfer or USSD</span>
        {testMode ? <Badge variant="warning">Test mode</Badge> : null}
      </div>

      <p className="text-[0.625rem] leading-relaxed text-subtle">
        You will be redirected to Paystack. Nothing is credited until the payment is verified
        server-side; the schedule fills oldest-first.
      </p>
    </form>
  );
}
