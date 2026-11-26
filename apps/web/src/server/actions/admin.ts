"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { requireUser } from "@/server/auth/session";
import type { FormState } from "@/lib/form";
import { firstFieldErrors, formToObject, identityDecisionSchema } from "@/lib/validation";

/**
 * Staff decision on a masked identity record.
 *
 * Authorisation is enforced twice: the SQL function checks `kyc:review` for the
 * caller before doing anything, and this action re-checks for a clear message.
 * The RPC writes the audit entry itself, so a decision cannot exist without a
 * trace.
 */
export async function decideIdentityAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();

  const parsed = identityDecisionSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the decision and reason.",
      fieldErrors: firstFieldErrors(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_decide_identity", {
    p_document_id: parsed.data.document_id,
    p_decision: parsed.data.decision,
    p_reason: parsed.data.reason,
  });

  if (error) {
    if (error.code === "42501") {
      return {
        status: "error",
        message: "You do not have permission to make identity decisions.",
      };
    }
    if (error.code === "23505") {
      return {
        status: "error",
        message:
          "This identity number is already verified on another account. Reject this one and investigate.",
      };
    }
    console.error("[admin] identity decision failed", error.code ?? "unknown");
    return { status: "error", message: "The decision could not be recorded. Try again." };
  }

  revalidatePath("/admin/kyc");
  revalidatePath("/admin");
  return { status: "success", message: "Decision recorded and audited." };
}
