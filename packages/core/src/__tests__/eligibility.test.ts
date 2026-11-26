import { describe, expect, it } from "vitest";
import { fromKobo } from "../money";
import {
  DEFAULT_POLICY,
  assessEligibility,
  type EligibilityInput,
  type EligibilityPolicy,
} from "../eligibility";

const POLICY: EligibilityPolicy = {
  ...DEFAULT_POLICY,
  minSavingsKobo: fromKobo(10_000_000),
  minTenureDays: 30,
  minConsistencyPercent: 60,
  maxDtiPercent: 33,
  maxTenorMonths: 6,
  maxLoanKobo: fromKobo(50_000_000),
  maxMultiplier: 3,
};

function input(overrides: Partial<EligibilityInput> = {}): EligibilityInput {
  return {
    eligibleSavingsKobo: fromKobo(20_000_000), // ₦200k
    savingsTenureDays: 120,
    consistencyPercent: 90,
    monthlyIncomeKobo: fromKobo(50_000_000), // ₦500k
    monthlyObligationsKobo: fromKobo(10_000_000),
    existingDebtKobo: 0n,
    repaymentHistory: "none",
    ...overrides,
  };
}

describe("assessEligibility", () => {
  it("computes the 3x multiplier ceiling from eligible savings", () => {
    const result = assessEligibility(input(), POLICY);
    expect(result.multiplierCeilingKobo).toBe(fromKobo(60_000_000));
  });

  it("limits the result by affordability when income is modest", () => {
    const result = assessEligibility(
      input({ monthlyIncomeKobo: fromKobo(12_000_000), monthlyObligationsKobo: fromKobo(2_000_000) }),
      POLICY,
    );
    // disposable ₦100k * 33% = ₦33k/month * 6 months = ₦198k
    expect(result.affordabilityCeilingKobo).toBe(fromKobo(19_800_000));
    expect(result.assessedLimitKobo).toBe(fromKobo(19_800_000));
    expect(result.bindingConstraint).toBe("affordability");
  });

  it("limits by the savings multiplier when income is high", () => {
    const result = assessEligibility(input(), { ...POLICY, maxLoanKobo: fromKobo(100_000_000) });
    expect(result.assessedLimitKobo).toBe(fromKobo(60_000_000));
    expect(result.bindingConstraint).toBe("multiplier");
  });

  it("caps at the policy maximum", () => {
    const result = assessEligibility(
      input({
        eligibleSavingsKobo: fromKobo(100_000_000),
        monthlyIncomeKobo: fromKobo(500_000_000),
        monthlyObligationsKobo: 0n,
      }),
      POLICY,
    );
    expect(result.assessedLimitKobo).toBe(POLICY.maxLoanKobo);
    expect(result.bindingConstraint).toBe("policy");
  });

  it("halves the ceiling for late repayment history", () => {
    const result = assessEligibility(input({ repaymentHistory: "late" }), POLICY);
    expect(result.riskCeilingKobo).toBe(fromKobo(30_000_000));
    expect(result.assessedLimitKobo).toBe(fromKobo(30_000_000));
    expect(result.bindingConstraint).toBe("risk");
  });

  it("blocks a defaulted borrower with zero limit and a reason", () => {
    const result = assessEligibility(input({ repaymentHistory: "defaulted" }), POLICY);
    expect(result.eligible).toBe(true);
    expect(result.assessedLimitKobo).toBe(0n);
    expect(result.bindingConstraint).toBe("risk");
    expect(result.reasons.join(" ")).toMatch(/defaulted/i);
  });

  it("blocks savings that are too small, too new or inconsistent", () => {
    const result = assessEligibility(
      input({
        eligibleSavingsKobo: fromKobo(5_000_000),
        savingsTenureDays: 12,
        consistencyPercent: 40,
      }),
      POLICY,
    );
    expect(result.eligible).toBe(false);
    expect(result.assessedLimitKobo).toBe(0n);
    expect(result.blockers).toHaveLength(3);
    expect(result.bindingConstraint).toBe("eligibility");
  });

  it("blocks when obligations exceed income", () => {
    const result = assessEligibility(
      input({ monthlyIncomeKobo: fromKobo(10_000_000), monthlyObligationsKobo: fromKobo(12_000_000) }),
      POLICY,
    );
    expect(result.eligible).toBe(false);
    expect(result.blockers.join(" ")).toMatch(/obligations/i);
  });

  it("requires verified income", () => {
    const result = assessEligibility(input({ monthlyIncomeKobo: 0n }), POLICY);
    expect(result.eligible).toBe(false);
    expect(result.blockers.join(" ")).toMatch(/income/i);
  });

  it("is deterministic for identical inputs", () => {
    const first = assessEligibility(input(), POLICY);
    const second = assessEligibility(input(), POLICY);
    expect(first).toEqual(second);
  });

  it("names the binding constraint in the reasons", () => {
    const result = assessEligibility(
      input({ monthlyIncomeKobo: fromKobo(12_000_000), monthlyObligationsKobo: fromKobo(2_000_000) }),
      POLICY,
    );
    expect(result.reasons.join(" ")).toMatch(/affordability/i);
  });

  it("uses integer arithmetic throughout", () => {
    const result = assessEligibility(
      input({ monthlyIncomeKobo: 3_333_333n, monthlyObligationsKobo: 1_111_111n }),
      POLICY,
    );
    expect(typeof result.assessedLimitKobo).toBe("bigint");
    expect(result.assessedLimitKobo >= 0n).toBe(true);
  });
});
