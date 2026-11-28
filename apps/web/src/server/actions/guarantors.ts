"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { emailConfigured, sendEmail } from "@/server/email/send";
import { getProfile, requireUser } from "@/server/auth/session";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { publicEnv } from "@/lib/env";
import type { FormState } from "@/lib/form";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function naira(kobo: string | number | null): string {
  const value = Number(kobo ?? 0) / 100;
  return `₦${value.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

export async function inviteGuarantorAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const profile = await getProfile();

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
  const { data: token, error } = await supabase.rpc("invite_guarantor", {
    p_application_id: applicationId,
    p_email: email,
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  const admin = createSupabaseAdminClient();
  const { data: application } = await supabase
    .from("loan_applications")
    .select("requested_amount_kobo")
    .eq("id", applicationId)
    .maybeSingle();

  const borrowerName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "A 1kDaily customer";
  const link = `${publicEnv.siteUrl.replace(/\/+$/, "")}/guarantee/${token}`;
  const amount = naira(application?.requested_amount_kobo ?? null);

  // Without a provider the invitation is still valid — it just travels by hand.
  if (!emailConfigured()) {
    await admin.rpc("mark_guarantor_invitation_email", {
      p_token: token,
      p_status: "skipped",
      p_error: null,
    });

    revalidatePath("/app/loans");
    return {
      status: "success",
      message: `Invitation created for ${email}. Email delivery is not configured yet, so share the private link below.`,
    };
  }

  const result = await sendEmail({
    to: email,
    subject: `${borrowerName} asked you to guarantee a 1kDaily loan`,
    text: [
      `${borrowerName} has asked you to act as a guarantor for a 1kDaily loan of ${amount}.`,
      "",
      "A guarantor confirms they know the borrower and are aware of the loan. It is not a co-borrower role: no money is taken from you and you get no access to their account.",
      "",
      `Accept or decline within 7 days: ${link}`,
      "",
      "Only the address this email was sent to can respond. If you were not expecting this, you can ignore it.",
      "",
      "1kDaily — Save Daily, Build Capacity",
    ].join("\n"),
    html: `
      <div style="font-family:Inter,Segoe UI,Arial,sans-serif;color:#172033;line-height:1.6;max-width:520px">
        <p style="font-weight:600;font-size:18px;color:#0b1739;margin:0 0 12px">1kDaily</p>
        <p>${escapeHtml(borrowerName)} has asked you to act as a <strong>guarantor</strong> for a 1kDaily loan of <strong>${amount}</strong>.</p>
        <p>A guarantor confirms they know the borrower and are aware of the loan. It is not a co-borrower role: no money is taken from you and you get no access to their account.</p>
        <p style="margin:24px 0">
          <a href="${escapeHtml(link)}" style="background:#15803d;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600;display:inline-block">
            Review the request
          </a>
        </p>
        <p style="font-size:13px;color:#64748b">This link expires in 7 days and only the address this email was sent to can respond. If you were not expecting this, you can ignore it.</p>
        <p style="font-size:12px;color:#94a3b8;margin-top:24px">1kDaily — Save Daily, Build Capacity</p>
      </div>`,
  });

  await admin.rpc("mark_guarantor_invitation_email", {
    p_token: token,
    p_status: result.ok ? "sent" : "failed",
    p_error: result.ok ? null : result.error,
  });

  revalidatePath("/app/loans");
  return result.ok
    ? {
        status: "success",
        message: `Invitation emailed to ${email}. You can also share the link below.`,
      }
    : {
        status: "error",
        message: `Invitation created, but the email could not be sent (${result.error}). Share the private link below — only that address can accept it.`,
      };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
