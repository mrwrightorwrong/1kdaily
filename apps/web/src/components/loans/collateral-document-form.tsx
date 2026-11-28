"use client";

import { useActionState } from "react";
import { FormAlert, TextField } from "@/components/forms/primitives";
import { Button } from "@/components/ui/primitives";
import { initialFormState } from "@/lib/form";
import { uploadCollateralDocumentAction } from "@/server/actions/collateral";

export function CollateralDocumentForm({
  collateralId,
}: {
  readonly collateralId: string;
}) {
  const [state, action, pending] = useActionState(uploadCollateralDocumentAction, initialFormState);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="collateral_id" value={collateralId} />

      <TextField
        id={`document_type_${collateralId}`}
        name="document_type"
        label="Document type"
        required
        maxLength={60}
        placeholder="e.g. Vehicle licence"
        error={state.fieldErrors?.document_type}
      />

      <div>
        <label
          htmlFor={`file_${collateralId}`}
          className="mb-1.5 block text-[0.75rem] font-medium text-ink-900"
        >
          File
        </label>
        <input
          id={`file_${collateralId}`}
          name="file"
          type="file"
          required
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          className="block w-full rounded-xl border border-line bg-surface px-3 py-2 text-[0.75rem] text-muted outline-none transition-[border-color,box-shadow] file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-[0.6875rem] file:font-semibold file:text-brand-800 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
        />
        <p className="mt-1.5 text-[0.625rem] text-subtle">PDF, JPEG, PNG or WebP · up to 8 MB.</p>
        {state.fieldErrors?.file ? (
          <p className="mt-1 text-[0.6875rem] font-medium text-danger-600">{state.fieldErrors.file}</p>
        ) : null}
      </div>

      <FormAlert state={state} />

      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? "Uploading…" : "Upload document"}
      </Button>
    </form>
  );
}
