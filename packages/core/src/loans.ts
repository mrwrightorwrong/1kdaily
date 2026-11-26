import { applyBps, sumKobo, type Kobo } from "./money";

export type InterestMethod = "flat" | "declining_balance";

export type LoanProduct = {
  readonly interestRateBps: number;
  readonly interestMethod: InterestMethod;
  readonly processingFeeBps?: number | undefined;
  readonly processingFeeFixedKobo?: Kobo | undefined;
  readonly insuranceFeeBps?: number | undefined;
  readonly insuranceFeeFixedKobo?: Kobo | undefined;
  readonly tenorMonths: number;
  readonly minLoanKobo: Kobo;
  readonly maxLoanKobo: Kobo;
};

export type LoanInstallment = {
  readonly number: number;
  readonly principalKobo: Kobo;
  readonly interestKobo: Kobo;
  readonly totalKobo: Kobo;
  readonly outstandingKobo: Kobo;
};

export type LoanQuote = {
  readonly principalKobo: Kobo;
  readonly processingFeeKobo: Kobo;
  readonly insuranceFeeKobo: Kobo;
  readonly netDisbursedKobo: Kobo;
  readonly interestKobo: Kobo;
  readonly totalPayableKobo: Kobo;
  readonly installmentKobo: Kobo;
  readonly schedule: readonly LoanInstallment[];
};

export class LoanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoanError";
  }
}

function fee(bps: number | undefined, fixed: Kobo | undefined, principal: Kobo): Kobo {
  if (fixed !== undefined) return fixed;
  return applyBps(principal, bps ?? 0);
}

/** annual rate applied over n months, rounded half-up, integer only */
function flatInterest(principal: Kobo, rateBps: number, months: number): Kobo {
  return (principal * BigInt(rateBps) * BigInt(months) + 60_000n) / 120_000n;
}

export function quoteLoan(principal: Kobo, product: LoanProduct): LoanQuote {
  if (principal < product.minLoanKobo || principal > product.maxLoanKobo) {
    throw new LoanError("Amount is outside the product limits.");
  }
  if (product.tenorMonths < 1) throw new LoanError("Tenor must be at least one month.");

  const processingFee = fee(product.processingFeeBps, product.processingFeeFixedKobo, principal);
  const insuranceFee = fee(product.insuranceFeeBps, product.insuranceFeeFixedKobo, principal);
  const netDisbursed = principal - processingFee - insuranceFee;

  if (netDisbursed <= 0n) {
    throw new LoanError("Fees cannot consume the whole principal.");
  }

  const months = product.tenorMonths;
  const perMonthPrincipal = principal / BigInt(months);
  const principalRemainder = principal - perMonthPrincipal * BigInt(months);

  const schedule: LoanInstallment[] = [];
  let outstanding = principal;

  if (product.interestMethod === "flat") {
    const interest = flatInterest(principal, product.interestRateBps, months);
    const total = principal + interest;
    const base = total / BigInt(months);
    let allocated = 0n;

    for (let index = 0; index < months; index += 1) {
      const isLast = index === months - 1;
      const totalPart = isLast ? total - allocated : base;
      allocated += totalPart;
      const principalPart = isLast
        ? principal - perMonthPrincipal * BigInt(months - 1)
        : perMonthPrincipal;
      outstanding -= principalPart;
      schedule.push({
        number: index + 1,
        principalKobo: principalPart,
        interestKobo: totalPart - principalPart,
        totalKobo: totalPart,
        outstandingKobo: outstanding,
      });
    }
  } else {
    // Equal principal, interest on the reducing balance. Monthly rate is the
    // annual rate divided by twelve, in basis points.
    const monthlyBps = Math.round(product.interestRateBps / 12);
    for (let index = 0; index < months; index += 1) {
      const isLast = index === months - 1;
      const principalPart = isLast
        ? principal - perMonthPrincipal * BigInt(months - 1) - principalRemainder + principalRemainder
        : perMonthPrincipal;
      const interestPart = applyBps(outstanding, monthlyBps);
      outstanding -= principalPart;
      schedule.push({
        number: index + 1,
        principalKobo: principalPart,
        interestKobo: interestPart,
        totalKobo: principalPart + interestPart,
        outstandingKobo: outstanding,
      });
    }
  }

  const interest = sumKobo(schedule.map((entry) => entry.interestKobo));

  return {
    principalKobo: principal,
    processingFeeKobo: processingFee,
    insuranceFeeKobo: insuranceFee,
    netDisbursedKobo: netDisbursed,
    interestKobo: interest,
    totalPayableKobo: principal + interest,
    installmentKobo: schedule[0]?.totalKobo ?? 0n,
    schedule,
  };
}
