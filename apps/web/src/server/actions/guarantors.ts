"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/supabase/server";
import type { FormState } from "@/lib/form";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function inviteGuarantorAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();

  const applicationId = String(formData.get("application_id") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!applicationId) {
    return { status: "error", message: "Start a loan application before inviting a guarantor." };
  }
  if (!EMAIL.test(email) || email.length > 200) {
    return {
      status: "error",
      message: "Enter a valid email address.",
      fieldErrors: { email: "Enter a valid email address" },
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("invite_guarantor", {
    p_application_id: applicationId,
    p_email: email,
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  revalidatePath("/app/loans");
  return {
    status: "success",
    message: `Invitation created for ${email}. Share the private link below — only that address can accept it.`,
  };
}

export async function respondToGuarantorInvitationAction(formData: FormData): Promise<void> {
  await requireUser();

  const token = String(formData.get("token") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const back = `/guarantee/${encodeURIComponent(token)}`;

  if (!token || (decision !== "accept" && decision !== "decline")) {
    redirect(`${back}?error=${encodeURIComponent("That response could not be read. Try again.")}`);
  }

  const supabase = await createSupabaseServerClient();

  if (decision === "decline") {
    const { error } = await supabase.rpc("decline_guarantor_invitation", { p_token: token });
    if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
    redirect(`${back}?done=declined`);
  }

  const fullName = String(formData.get("full_name") ?? "").trim();
  const relationship = String(formData.get("relationship") ?? "").trim();
  const consented = formData.get("consent") === "on";

  if (!consented) {
    redirect(`${back}?error=${encodeURIComponent("Tick the consent box before accepting.")}`);
  }
  if (fullName.length < 2) {
    redirect(`${back}?error=${encodeURIComponent("Enter your full name as it appears on your ID.")}`);
  }

  const { error } = await supabase.rpc("accept_guarantor_invitation", {
    p_token: token,
    p_full_name: fullName.slice(0, 120),
    p_relationship: relationship ? relationship.slice(0, 80) : null,
  });

  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  redirect(`${back}?done=accepted`);
}
