"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { requireUser } from "@/server/auth/session";

export async function decideLoanAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("application_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("decide_loan_application", {
    p_application_id: id,
    p_decision: decision,
    p_reason: reason,
  });

  revalidatePath("/admin/loans");
  if (error) redirect(`/admin/loans?error=${encodeURIComponent(error.message)}`);
  redirect(`/admin/loans?done=${decision}`);
}

export async function disburseLoanAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("application_id") ?? "");
  const reference = String(formData.get("provider_reference") ?? "").trim();

  if (!reference) redirect("/admin/loans?error=Provider%20reference%20is%20required");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("disburse_loan", {
    p_application_id: id,
    p_provider_reference: reference,
  });

  revalidatePath("/admin/loans");
  if (error) redirect(`/admin/loans?error=${encodeURIComponent(error.message)}`);
  redirect("/admin/loans?done=disbursed");
}
