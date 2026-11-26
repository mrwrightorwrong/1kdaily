"use server";

import { redirect } from "next/navigation";
import {
  DEFAULT_POLICY,
  assessEligibility,
  diffDays,
  todayBusinessDate,
  type EligibilityPolicy,
} from "@1kdaily/core";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { requireUser, getFinancialProfile } from "@/server/auth/session";
import { getPlans, refreshPlanDays } from "@/server/savings/plans";

const ENGINE_VERSION = "2026-11.1";

export async function runEligibilityAssessment(): Promise<void> {
  const user = await requireUser();
  await refreshPlanDays();

  const today = todayBusinessDate();
  const [plans, financial] = await Promise.all([getPlans(today), getFinancialProfile()]);

  const admin = createSupabaseAdminClient();

  const { data: account } = await admin
    .from("financial_accounts")
    .select("id")
    .eq("code", `2200-${user.id}`)
    .maybeSingle();

  const { data: balance } = account
    ? await admin.from("account_balances").select("balance_kobo").eq("account_id", account.id).maybeSingle()
    : { data: null };

  const eligibleSavings = BigInt(balance?.balance_kobo ?? "0");

  const starts = plans.map((entry) => entry.plan.start_date).sort();
  const tenureDays = starts[0] ? Math.max(diffDays(starts[0] as never, today), 0) : 0;

  const judged = plans.filter((entry) => entry.progress.judgedDays > 0);
  const consistency =
    judged.length === 0
      ? 0
      : Math.round(
          judged.reduce((sum, entry) => sum + entry.progress.consistencyPercent, 0) / judged.length,
        );

  const { data: policyRow } = await admin
    .from("eligibility_policies")
    .select("version, config")
    .eq("is_active", true)
    .maybeSingle();

  const policy: EligibilityPolicy = policyRow
    ? {
        version: policyRow.version as string,
        maxMultiplier: (policyRow.config as Record<string, unknown>).maxMultiplier as 2 | 3,
        minSavingsKobo: BigInt((policyRow.config as Record<string, unknown>).minSavingsKobo as number),
        minTenureDays: (policyRow.config as Record<string, unknown>).minTenureDays as number,
        minConsistencyPercent: (policyRow.config as Record<string, unknown>).minConsistencyPercent as number,
        maxDtiPercent: (policyRow.config as Record<string, unknown>).maxDtiPercent as number,
        maxTenorMonths: (policyRow.config as Record<string, unknown>).maxTenorMonths as number,
        maxLoanKobo: BigInt((policyRow.config as Record<string, unknown>).maxLoanKobo as number),
      }
    : DEFAULT_POLICY;

  const inputs = {
    eligibleSavingsKobo: eligibleSavings.toString(),
    savingsTenureDays: tenureDays,
    consistencyPercent: consistency,
    monthlyIncomeKobo: String(financial?.monthly_income_kobo ?? "0"),
    monthlyObligationsKobo: String(financial?.monthly_obligations_kobo ?? "0"),
    existingDebtKobo: String(financial?.existing_debt_kobo ?? "0"),
    repaymentHistory: "none" as const,
  };

  const assessment = assessEligibility(
    {
      eligibleSavingsKobo: eligibleSavings,
      savingsTenureDays: tenureDays,
      consistencyPercent: consistency,
      monthlyIncomeKobo: BigInt(inputs.monthlyIncomeKobo),
      monthlyObligationsKobo: BigInt(inputs.monthlyObligationsKobo),
      existingDebtKobo: BigInt(inputs.existingDebtKobo),
      repaymentHistory: "none",
    },
    policy,
  );

  const { error } = await admin.from("loan_eligibility_assessments").insert({
    user_id: user.id,
    policy_version: policy.version,
    engine_version: ENGINE_VERSION,
    inputs,
    eligible: assessment.eligible,
    eligible_savings_kobo: assessment.eligibleSavingsKobo.toString(),
    multiplier_ceiling_kobo: assessment.multiplierCeilingKobo.toString(),
    affordability_ceiling_kobo: assessment.affordabilityCeilingKobo.toString(),
    risk_ceiling_kobo: assessment.riskCeilingKobo.toString(),
    policy_ceiling_kobo: assessment.policyCeilingKobo.toString(),
    assessed_limit_kobo: assessment.assessedLimitKobo.toString(),
    binding_constraint: assessment.bindingConstraint,
    reasons: assessment.reasons,
    blockers: assessment.blockers,
  });

  if (error) {
    console.error("[eligibility] assessment write failed", error.code ?? "unknown");
    redirect("/app/eligibility?error=1");
  }

  redirect("/app/eligibility?assessed=1");
}
