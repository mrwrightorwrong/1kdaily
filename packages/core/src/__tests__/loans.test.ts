import { describe, expect, it } from "vitest";
import { sumKobo } from "../money";
import { LoanError, quoteLoan, type LoanProduct } from "../loans";

const base: LoanProduct = {
  interestRateBps: 2400,
  interestMethod: "flat",
  processingFeeBps: 150,
  insuranceFeeBps: 100,
  tenorMonths: 12,
  minLoanKobo: 10_000_000n,
  maxLoanKobo: 100_000_000n,
};

const P = 10_000_000n; // ₦100,000

describe("quoteLoan", () => {
  it("prices a flat loan with fees deducted from disbursement", () => {
    const quote = quoteLoan(P, base);
    expect(quote.interestKobo).toBe(2_400_000n);
    expect(quote.processingFeeKobo).toBe(150_000n);
    expect(quote.insuranceFeeKobo).toBe(100_000n);
    expect(quote.netDisbursedKobo).toBe(9_750_000n);
    expect(quote.totalPayableKobo).toBe(12_400_000n);
  });

  it("splits installments so principal and total both sum exactly", () => {
    const quote = quoteLoan(P, base);
    expect(quote.schedule).toHaveLength(12);
    expect(sumKobo(quote.schedule.map((entry) => entry.principalKobo))).toBe(P);
    expect(sumKobo(quote.schedule.map((entry) => entry.totalKobo))).toBe(12_400_000n);
    expect(quote.schedule.at(-1)?.outstandingKobo).toBe(0n);
  });

  it("charges declining interest on the reducing balance", () => {
    const quote = quoteLoan(P, { ...base, interestMethod: "declining_balance" });
    expect(quote.interestKobo).toBeLessThan(2_400_000n);
    expect(sumKobo(quote.schedule.map((entry) => entry.principalKobo))).toBe(P);
    expect(quote.schedule.at(-1)?.outstandingKobo).toBe(0n);
    // first month: 2% of ₦100,000
    expect(quote.schedule[0]?.interestKobo).toBe(200_000n);
  });

  it("supports fixed fees", () => {
    const quote = quoteLoan(P, {
      ...base,
      processingFeeBps: undefined,
      processingFeeFixedKobo: 500_000n,
      insuranceFeeBps: undefined,
      insuranceFeeFixedKobo: 250_000n,
    });
    expect(quote.processingFeeKobo).toBe(500_000n);
    expect(quote.insuranceFeeKobo).toBe(250_000n);
    expect(quote.netDisbursedKobo).toBe(9_250_000n);
  });

  it("rejects a loan outside the product limits", () => {
    expect(() => quoteLoan(5_000_000n, base)).toThrow(LoanError);
    expect(() => quoteLoan(200_000_000n, base)).toThrow(LoanError);
  });

  it("rejects fees that consume the principal", () => {
    expect(() =>
      quoteLoan(P, {
        ...base,
        processingFeeBps: undefined,
        processingFeeFixedKobo: 6_000_000n,
        insuranceFeeBps: undefined,
        insuranceFeeFixedKobo: 5_000_000n,
      }),
    ).toThrow(/fees/i);
  });
});
