"use client";

import { useActionState } from "react";
import { FormAlert, SelectField, TextField } from "@/components/forms/primitives";
import { Button } from "@/components/ui/primitives";
import { initialFormState } from "@/lib/form";
import { applyForLoanAction } from "@/server/actions/loans";

export function ApplyForLoanForm({
  products,
  maxAmountKobo,
}: {
  readonly products: ReadonlyArray<{ code: string; name: string; tenors: number[] }>;
  readonly maxAmountKobo: string;
}) {
  const [state, action, pending] = useActionState(applyForLoanAction, initialFormState);
  const first = products[0];

  return (
    <form action={action} className="space-y-3">
      <SelectField id="product_code" label="Product" required defaultValue={first?.code}>
        {products.map((product) => (
          <option key={product.code} value={product.code}>
            {product.name}
          </option>
        ))}
      </SelectField>

      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          id="amount"
          label="Amount (₦)"
          inputMode="numeric"
          required
          hint={`Up to ₦${Number(maxAmountKobo) / 100} assessed`}
          error={state.fieldErrors?.amount}
        />
        <SelectField id="tenor_months" label="Repayment period" required defaultValue={first?.tenors[0]}>
          {(first?.tenors ?? []).map((tenor) => (
            <option key={tenor} value={tenor}>
              {tenor} months
            </option>
          ))}
        </SelectField>
      </div>

      <TextField id="purpose" label="Purpose" optional maxLength={300} />

      <FormAlert state={state} />

      <Button type="submit" size="md" disabled={pending}>
        {pending ? "Creating your offer…" : "Get my offer"}
      </Button>
    </form>
  );
}
