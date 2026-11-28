"use client";

import { useActionState } from "react";
import { FormAlert, SelectField, TextField, TextareaField } from "@/components/forms/primitives";
import { Button } from "@/components/ui/primitives";
import { initialFormState } from "@/lib/form";
import { submitCollateralAction } from "@/server/actions/collateral";

export function CollateralForm({
  applicationId,
}: {
  readonly applicationId: string;
}) {
  const [state, action, pending] = useActionState(submitCollateralAction, initialFormState);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="application_id" value={applicationId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          id="category"
          label="Category"
          required
          defaultValue="vehicle"
          error={state.fieldErrors?.category}
        >
          <option value="vehicle">Vehicle</option>
          <option value="equipment">Equipment</option>
          <option value="property">Property</option>
          <option value="business_asset">Business asset</option>
          <option value="other">Other</option>
        </SelectField>
        <TextField
          id="estimated_value"
          label="Estimated value (₦)"
          inputMode="decimal"
          optional
          error={state.fieldErrors?.estimated_value}
          hint="Your estimate, not a 1kDaily valuation."
        />
      </div>

      <TextareaField
        id="description"
        label="Description"
        required
        maxLength={400}
        placeholder="e.g. 2015 Toyota Corolla, registered in my name"
        error={state.fieldErrors?.description}
        hint="What the asset is and how a reviewer can identify it."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <TextField id="valuation_method" label="Valuation method" optional maxLength={120} />
        <TextField id="valuation_date" label="Valuation date" type="date" optional />
      </div>

      <TextField
        id="ownership_evidence"
        label="Ownership evidence"
        optional
        maxLength={300}
        placeholder="e.g. Vehicle licence, C of O, receipt"
        hint="Describe the document. Upload the file once the asset is saved."
      />
      <TextField
        id="security_agreement_ref"
        label="Security agreement reference"
        optional
        maxLength={120}
      />

      <FormAlert state={state} />

      <Button type="submit" variant="primary" size="md" disabled={pending}>
        {pending ? "Adding collateral…" : "Add collateral"}
      </Button>
    </form>
  );
}
