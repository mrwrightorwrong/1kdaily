"use client";

import { useActionState } from "react";
import { FormAlert } from "@/components/forms/primitives";
import { Button } from "@/components/ui/primitives";
import { initialFormState } from "@/lib/form";
import { decideIdentityAction } from "@/server/actions/admin";

export function IdentityDecisionForm({ documentId }: { readonly documentId: string }) {
  const [state, action, pending] = useActionState(decideIdentityAction, initialFormState);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="document_id" value={documentId} />

      <div className="flex flex-wrap items-center gap-2">
        <select
          name="decision"
          defaultValue="verify"
          aria-label="Decision"
          className="h-9 rounded-lg border border-line bg-surface px-2.5 text-[0.75rem] text-ink-900"
        >
          <option value="verify">Verify</option>
          <option value="reject">Reject</option>
          <option value="request_review">Send for review</option>
        </select>

        <input
          name="reason"
          placeholder="Reason (min 10 chars)"
          aria-label="Reason"
          maxLength={500}
          className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 text-[0.75rem] text-ink-900 placeholder:text-subtle"
        />

        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Record"}
        </Button>
      </div>

      {state.status !== "idle" ? (
        <div className="max-w-md">
          <FormAlert state={state} />
        </div>
      ) : null}
    </form>
  );
}
