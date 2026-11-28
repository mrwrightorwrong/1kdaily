"use client";

import { useActionState } from "react";
import { FormAlert, TextField } from "@/components/forms/primitives";
import { Button } from "@/components/ui/primitives";
import { initialFormState } from "@/lib/form";
import { inviteGuarantorAction } from "@/server/actions/guarantors";

export function GuarantorInviteForm({
  applicationId,
}: {
  readonly applicationId: string;
}) {
  const [state, action, pending] = useActionState(inviteGuarantorAction, initialFormState);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="application_id" value={applicationId} />
      <TextField
        id="email"
        name="email"
        type="email"
        label="Guarantor's email"
        placeholder="name@example.com"
        autoComplete="email"
        required
        maxLength={200}
        error={state.fieldErrors?.email}
        hint="They accept from their own account. You cannot accept on their behalf, and a forwarded link will not work."
      />
      <FormAlert state={state} />
      <Button type="submit" variant="primary" size="md" disabled={pending}>
        {pending ? "Creating invitation…" : "Create invitation"}
      </Button>
    </form>
  );
}
