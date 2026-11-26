"use server";

import { redirect } from "next/navigation";
import { LoanError, MoneyError, parseNairaToKobo, quoteLoan, type Kobo } from "@1kdaily/core";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { requireUser } from "@/server/auth/session";
import type { FormState } from "@/lib/form";

function reference(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().replace(/-/g, "")}`;
}

export async function applyForLoanAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const admin = createSupabaseAdminClient();

  const productCode = String(formData.get("product_code") ?? "");
  let amount: bigint;
  try {
    amount = parseNairaToKobo(String(formData.get("amount") ?? ""));
  } catch (error) {
    return {
      status: "error",
      message: error instanceof MoneyError ? error.message : "Enter a valid amount.",
      fieldErrors: { amount: "Enter a valid amount" },
    };
  }
  const tenor = Number(formData.get("tenor_months") ?? 0);
  const purpose = String(formData.get("purpose") ?? "").trim().slice(0, 300);

  const { data: product } = await admin
    .from("loan_products")
    .select("*")
    .eq("code", productCode)
    .eq("is_active", true)
    .maybeSingle();

  if (!product) return { status: "error", message: "That loan product is unavailable." };
  if (amount < BigInt(product.min_loan_kobo) || amount > BigInt(product.max_loan_kobo)) {
    return { status: "error", message: "Amount is outside the product limits." };
  }
  if (!(product.tenor_months as number[]).includes(tenor)) {
    return { status: "error", message: "That repayment duration is not offered." };
  }

  const { data: assessment } = await admin
    .from("loan_eligibility_assessments")
    .select("id, eligible, assessed_limit_kobo, policy_version")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!assessment?.eligible) {
    return { status: "error", message: "Run an eligibility assessment before applying." };
  }
  if (amount > BigInt(assessment.assessed_limit_kobo)) {
    return { status: "error", message: "That amount is above your assessed limit." };
  }

  let quote;
  try {
    quote = quoteLoan(amount as Kobo, {
      interestRateBps: product.interest_rate_bps,
      interestMethod: product.interest_method,
      ...(product.processing_fee_bps != null
        ? { processingFeeBps: product.processing_fee_bps }
        : { processingFeeFixedKobo: BigInt(product.processing_fee_fixed_kobo ?? 0) }),
      ...(product.insurance_fee_bps != null
        ? { insuranceFeeBps: product.insurance_fee_bps }
        : { insuranceFeeFixedKobo: BigInt(product.insurance_fee_fixed_kobo ?? 0) }),
      tenorMonths: tenor,
      minLoanKobo: BigInt(product.min_loan_kobo),
      maxLoanKobo: BigInt(product.max_loan_kobo),
    });
  } catch (error) {
    return {
      status: "error",
      message: error instanceof LoanError ? error.message : "Could not price that loan.",
    };
  }

  const applicationId = crypto.randomUUID();

  const { error: applicationError } = await admin.from("loan_applications").insert({
    id: applicationId,
    reference: reference("KD-LN"),
    user_id: user.id,
    product_id: product.id,
    assessment_id: assessment.id,
    requested_amount_kobo: amount.toString(),
    tenor_months: tenor,
    purpose: purpose || null,
    status: "under_review",
  });

  if (applicationError) {
    console.error("[loans] application failed", applicationError.code ?? "unknown");
    return { status: "error", message: "Could not submit the application. Try again." };
  }

  const { error: offerError } = await admin.from("loan_offers").insert({
    application_id: applicationId,
    user_id: user.id,
    product_snapshot: product,
    policy_version: assessment.policy_version,
    principal_kobo: quote.principalKobo.toString(),
    tenor_months: tenor,
    interest_rate_bps: product.interest_rate_bps,
    interest_method: product.interest_method,
    processing_fee_kobo: quote.processingFeeKobo.toString(),
    insurance_fee_kobo: quote.insuranceFeeKobo.toString(),
    net_disbursed_kobo: quote.netDisbursedKobo.toString(),
    interest_kobo: quote.interestKobo.toString(),
    total_payable_kobo: quote.totalPayableKobo.toString(),
    installment_kobo: quote.installmentKobo.toString(),
    schedule: quote.schedule.map((entry) => ({
      number: entry.number,
      principal: entry.principalKobo.toString(),
      interest: entry.interestKobo.toString(),
      total: entry.totalKobo.toString(),
      outstanding: entry.outstandingKobo.toString(),
    })),
    expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  });

  if (offerError) {
    console.error("[loans] offer failed", offerError.code ?? "unknown");
    return { status: "error", message: "Could not create the offer. Try again." };
  }

  await admin.from("audit_logs").insert({
    actor_id: user.id,
    action: "loan.apply",
    entity_type: "loan_application",
    entity_id: applicationId,
    after_state: {
      principal_kobo: quote.principalKobo.toString(),
      net_disbursed_kobo: quote.netDisbursedKobo.toString(),
      policy_version: assessment.policy_version,
    },
    reason: "Customer applied for a loan",
  });

  redirect("/app/loans?applied=1");
}

export async function acceptLoanOfferAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const offerId = String(formData.get("offer_id") ?? "");
  const admin = createSupabaseAdminClient();

  const { data: offer } = await admin
    .from("loan_offers")
    .select("id, application_id, accepted_at, expires_at")
    .eq("id", offerId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!offer || offer.accepted_at) redirect("/app/loans");
  if (new Date(offer.expires_at).getTime() < Date.now()) redirect("/app/loans?expired=1");

  await admin
    .from("loan_offers")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", offer.id);

  await admin
    .from("loan_applications")
    .update({ status: "awaiting_disbursement" })
    .eq("id", offer.application_id)
    .eq("user_id", user.id);

  await admin.from("audit_logs").insert({
    actor_id: user.id,
    action: "loan.offer_accepted",
    entity_type: "loan_offer",
    entity_id: offer.id,
    reason: "Customer accepted the offer terms",
  });

  redirect("/app/loans?accepted=1");
}
