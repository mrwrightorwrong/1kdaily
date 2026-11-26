/**
 * Loan eligibility engine.
 *
 * Pure and deterministic: every input is explicit, including the policy and the
 * injected "today". The result names the constraint that actually limits the
 * customer, because "no hidden rules" is a product promise, not a slogan.
 *
 * This computes a *preliminary ceiling*. It does not price a loan, build a
 * schedule, or approve anything. Those are Phase 7 concerns.
 */

import type { Kobo } from "./money";

export type EligibilityPolicy = {
  readonly version: string;
  readonly maxMultiplier: 2 | 3;
  readonly minSavingsKobo: Kobo;
  readonly minTenureDays: number;
  readonly minConsistencyPercent: number;
  readonly maxDtiPercent: number;
  readonly maxTenorMonths: number;
  readonly maxLoanKobo: Kobo;
};

export type RepaymentHistory = "none" | "good" | "late" | "defaulted";

export type EligibilityInput = {
  readonly eligibleSavingsKobo: Kobo;
  readonly savingsTenureDays: number;
  readonly consistencyPercent: number;
  readonly monthlyIncomeKobo: Kobo;
  readonly monthlyObligationsKobo: Kobo;
  readonly existingDebtKobo: Kobo;
  readonly repaymentHistory: RepaymentHistory;
};

export type BindingConstraint =
  | "eligibility"
  | "multiplier"
  | "affordability"
  | "risk"
  | "policy";

export type EligibilityAssessment = {
  readonly eligible: boolean;
  readonly eligibleSavingsKobo: Kobo;
  readonly multiplierCeilingKobo: Kobo;
  readonly affordabilityCeilingKobo: Kobo;
  readonly riskCeilingKobo: Kobo;
  readonly policyCeilingKobo: Kobo;
  readonly assessedLimitKobo: Kobo;
  readonly bindingConstraint: BindingConstraint;
  readonly reasons: readonly string[];
  readonly blockers: readonly string[];
  readonly policyVersion: string;
};

const ZERO = 0n;

function minKobo(...values: readonly Kobo[]): { value: Kobo; index: number } {
  let value = values[0] ?? ZERO;
  let index = 0;
  values.forEach((candidate, position) => {
    if (candidate < value) {
      value = candidate;
      index = position;
    }
  });
  return { value, index };
}

/** Fraction of an amount, rounded down. Rates are basis points, never floats. */
function portion(amount: Kobo, basisPoints: number): Kobo {
  if (basisPoints <= 0 || amount <= 0n) return ZERO;
  return (amount * BigInt(basisPoints)) / 10_000n;
}

function riskCeiling(
  multiplierCeiling: Kobo,
  history: RepaymentHistory,
): { ceiling: Kobo; reason: string } {
  switch (history) {
    case "defaulted":
      return {
        ceiling: ZERO,
        reason: "A defaulted 1kDaily loan blocks new credit until it is settled.",
      };
    case "late":
      return {
        ceiling: portion(multiplierCeiling, 5_000),
        reason: "Late repayments halve the preliminary ceiling.",
      };
    case "none":
      return {
        ceiling: multiplierCeiling,
        reason: "No repayment history yet; the savings-based ceiling applies.",
      };
    case "good":
      return {
        ceiling: multiplierCeiling,
        reason: "Repayments are up to date.",
      };
  }
}

export function assessEligibility(
  input: EligibilityInput,
  policy: EligibilityPolicy,
): EligibilityAssessment {
  const blockers: string[] = [];
  const reasons: string[] = [];

  if (input.eligibleSavingsKobo < policy.minSavingsKobo) {
    blockers.push(
      `Eligible savings of ${policy.minSavingsKobo / 100n} naira are required before an assessment.`,
    );
  }
  if (input.savingsTenureDays < policy.minTenureDays) {
    blockers.push(
      `At least ${policy.minTenureDays} days of savings history are required.`,
    );
  }
  if (input.consistencyPercent < policy.minConsistencyPercent) {
    blockers.push(
      `Contribution consistency of ${policy.minConsistencyPercent}% is required.`,
    );
  }
  if (input.monthlyIncomeKobo <= ZERO) {
    blockers.push("A verified monthly income is required for an affordability check.");
  }

  const multiplierCeiling = input.eligibleSavingsKobo * BigInt(policy.maxMultiplier);
  const disposable = input.monthlyIncomeKobo - input.monthlyObligationsKobo;
  const affordablePerMonth = portion(disposable > ZERO ? disposable : ZERO, policy.maxDtiPercent * 100);
  const affordabilityCeiling = affordablePerMonth * BigInt(policy.maxTenorMonths);
  const risk = riskCeiling(multiplierCeiling, input.repaymentHistory);
  const policyCeiling = policy.maxLoanKobo;

  if (disposable <= ZERO) {
    blockers.push("Monthly obligations consume your entire verified income.");
  } else if (input.existingDebtKobo > ZERO) {
    reasons.push("Existing debt is included in your monthly obligations.");
  }

  if (input.eligibleSavingsKobo > ZERO) {
    reasons.push(
      `Eligible savings set a ${policy.maxMultiplier}x ceiling of ${multiplierCeiling / 100n} naira.`,
    );
  }
  if (input.monthlyIncomeKobo > ZERO) {
    reasons.push(
      `Affordability supports up to ${affordabilityCeiling / 100n} naira over ${policy.maxTenorMonths} months at a ${policy.maxDtiPercent}% debt-to-income limit.`,
    );
  }
  reasons.push(risk.reason);

  const eligible = blockers.length === 0;

  if (!eligible) {
    return {
      eligible: false,
      eligibleSavingsKobo: input.eligibleSavingsKobo,
      multiplierCeilingKobo: multiplierCeiling,
      affordabilityCeilingKobo: affordabilityCeiling,
      riskCeilingKobo: risk.ceiling,
      policyCeilingKobo: policyCeiling,
      assessedLimitKobo: ZERO,
      bindingConstraint: "eligibility",
      reasons,
      blockers,
      policyVersion: policy.version,
    };
  }

  const candidates: ReadonlyArray<{ value: Kobo; constraint: BindingConstraint; label: string }> = [
    { value: multiplierCeiling, constraint: "multiplier", label: "savings multiplier" },
    { value: affordabilityCeiling, constraint: "affordability", label: "affordability" },
    { value: risk.ceiling, constraint: "risk", label: "repayment risk" },
    { value: policyCeiling, constraint: "policy", label: "policy maximum" },
  ];

  const smallest = minKobo(...candidates.map((candidate) => candidate.value));
  const binding = candidates[smallest.index] ?? candidates[0]!;

  reasons.push(`Your assessed limit is set by ${binding.label}.`);

  return {
    eligible: true,
    eligibleSavingsKobo: input.eligibleSavingsKobo,
    multiplierCeilingKobo: multiplierCeiling,
    affordabilityCeilingKobo: affordabilityCeiling,
    riskCeilingKobo: risk.ceiling,
    policyCeilingKobo: policyCeiling,
    assessedLimitKobo: smallest.value,
    bindingConstraint: binding.constraint,
    reasons,
    blockers,
    policyVersion: policy.version,
  };
}

/** The policy the product ships with until administrators configure their own. */
export const DEFAULT_POLICY: EligibilityPolicy = {
  version: "2026-11",
  maxMultiplier: 3,
  minSavingsKobo: 10_000_000n, // ₦100,000
  minTenureDays: 30,
  minConsistencyPercent: 60,
  maxDtiPercent: 33,
  maxTenorMonths: 6,
  maxLoanKobo: 50_000_000n, // ₦500,000
};
