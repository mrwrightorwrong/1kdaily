"use server";

import { redirect } from "next/navigation";
import { MoneyError, parseNairaToKobo } from "@1kdaily/core";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { requireUser } from "@/server/auth/session";
import { requestOrigin } from "@/server/http";
import { initializeTransaction } from "@/server/payments/paystack";
import type { FormState } from "@/lib/form";

/**
 * Start a contribution: create the intent, then hand off to Paystack's hosted
 * checkout. Nothing is credited here — only a verified payment can confirm.
 */
export async function startContributionAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const planId = String(formData.get("plan_id") ?? "");
  const idempotencyKey = String(formData.get("idempotency_key") ?? "").trim();

  if (!/^[0-9a-f-]{36}$/i.test(planId)) {
    return { status: "error", message: "Unknown plan." };
  }
  if (!idempotencyKey) {
    return { status: "error", message: "Reload the page and try again." };
  }

  let amountKobo: bigint;
  try {
    amountKobo = parseNairaToKobo(String(formData.get("amount") ?? ""));
  } catch (error) {
    return {
      status: "error",
      message: error instanceof MoneyError ? error.message : "Enter a valid amount.",
      fieldErrors: { amount: "Enter a valid amount" },
    };
  }

  if (amountKobo <= 0n) {
    return { status: "error", message: "Enter an amount greater than zero." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("initiate_contribution", {
    p_plan_id: planId,
    p_amount_kobo: String(amountKobo),
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { contribution_id: string; reference: string }
    | undefined;

  if (!row?.reference || !row?.contribution_id) {
    return { status: "error", message: "We could not start that payment. Try again." };
  }

  const origin = await requestOrigin();

  let authorizationUrl: string;
  try {
    const initialized = await initializeTransaction({
      email: user.email ?? "",
      amountKobo,
      reference: row.reference,
      callbackUrl: `${origin}/app/savings/confirm`,
      metadata: { plan_id: planId, contribution_id: row.contribution_id },
    });
    authorizationUrl = initialized.authorizationUrl;
  } catch (initError) {
    console.error(
      "[payments] initialize failed",
      initError instanceof Error ? initError.message.slice(0, 120) : "unknown",
    );
    const admin = createSupabaseAdminClient();
    await admin.rpc("fail_contribution", {
      p_contribution_id: row.contribution_id,
      p_failure_code: "initialize_failed",
    });
    return {
      status: "error",
      message: "The payment provider is unavailable right now. Try again in a moment.",
    };
  }

  redirect(authorizationUrl);
}
