import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { getCurrentUser } from "@/server/auth/session";
import { verifyTransaction } from "@/server/payments/paystack";

export const runtime = "nodejs";

/**
 * Paystack return URL. Verifies server-side, confirms idempotently, then sends
 * the customer back to the plan. The webhook remains the primary path; this is
 * the case where the customer's browser comes back first.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.redirect(new URL("/sign-in", url.origin));
  }

  const reference = url.searchParams.get("reference") ?? url.searchParams.get("trxref") ?? "";
  if (!reference) {
    return NextResponse.redirect(new URL("/app/transactions?error=missing_reference", url.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { data: contribution } = await supabase
    .from("savings_contributions")
    .select("id, reference, amount_kobo, status, plan_id")
    .eq("reference", reference)
    .maybeSingle();

  if (!contribution) {
    return NextResponse.redirect(new URL("/app/transactions?error=unknown_reference", url.origin));
  }

  const planUrl = new URL(`/app/plans/${contribution.plan_id}`, url.origin);

  if (contribution.status === "confirmed") {
    planUrl.searchParams.set("paid", "1");
    return NextResponse.redirect(planUrl);
  }

  let verified;
  try {
    verified = await verifyTransaction(reference);
  } catch {
    planUrl.searchParams.set("pending", "1");
    return NextResponse.redirect(planUrl);
  }

  if (verified.status !== "success") {
    planUrl.searchParams.set("pending", "1");
    return NextResponse.redirect(planUrl);
  }

  if (verified.amountKobo !== BigInt(contribution.amount_kobo)) {
    planUrl.searchParams.set("error", "The amount paid did not match the contribution.");
    return NextResponse.redirect(planUrl);
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("confirm_contribution", {
    p_contribution_id: contribution.id,
    p_provider_reference: verified.reference,
    p_paid_kobo: String(verified.amountKobo),
    p_channel: verified.channel,
    p_paid_at: verified.paidAt ?? new Date().toISOString(),
  });

  if (error) {
    console.error("[payments] callback confirmation failed", error.code ?? "unknown");
    planUrl.searchParams.set("pending", "1");
    return NextResponse.redirect(planUrl);
  }

  planUrl.searchParams.set("paid", "1");
  return NextResponse.redirect(planUrl);
}
