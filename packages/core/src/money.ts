/**
 * Money primitives.
 *
 * Rules enforced here (see Phase 0 report §0):
 *  - Amounts are integer kobo held as `bigint`. There is no floating point
 *    path into or out of this module.
 *  - Parsing is strict: no exponents, no more than two decimal places, no
 *    locale-dependent separators beyond the thousands comma.
 *  - Formatting is implemented with integer arithmetic so that it is
 *    deterministic across runtimes and does not depend on ICU currency data.
 *
 * Anything that needs to be displayed, stored or compared goes through here.
 */

export type Kobo = bigint;

/** ₦10 trillion — a hard ceiling that keeps arithmetic inside safe bounds. */
export const MAX_KOBO = 1_000_000_000_000_000n;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

export type FormatKoboOptions = {
  /** Currency symbol. Defaults to the naira sign. */
  readonly symbol?: string;
  /** 2 shows kobo, 0 hides them. Defaults to 2. */
  readonly decimals?: 0 | 2;
  /** "auto" only shows a minus for negatives. "always" shows + and -. */
  readonly sign?: "auto" | "always";
};

export type FormatCompactOptions = {
  readonly symbol?: string;
  /** Decimal places on the abbreviated magnitude. Defaults to 1. */
  readonly precision?: 0 | 1;
};

function assertKobo(value: Kobo): Kobo {
  const magnitude = value < 0n ? -value : value;
  if (magnitude > MAX_KOBO) {
    throw new MoneyError("Amount exceeds the supported maximum.");
  }
  return value;
}

/** Coerce an integer kobo value. Rejects fractional or unsafe input. */
export function fromKobo(value: bigint | number | string): Kobo {
  let coerced: bigint;
  if (typeof value === "bigint") {
    coerced = value;
  } else if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new MoneyError("Kobo amounts must be safe integers.");
    }
    coerced = BigInt(value);
  } else {
    if (!/^-?\d+$/.test(value.trim())) {
      throw new MoneyError("Kobo amounts must be whole numbers.");
    }
    coerced = BigInt(value.trim());
  }
  return assertKobo(coerced);
}

/**
 * Parse a user-entered naira string into kobo.
 * Accepts "1000", "1,000", "1000.5", "1,000.50". Rejects "1.234", "1e3", "₦1".
 */
export function parseNairaToKobo(input: string): Kobo {
  const trimmed = input.trim();
  // Validate grouping before stripping separators: "1,00" is a typo, not 100.
  const groupingIsValid = trimmed.includes(",")
    ? /^-?\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(trimmed)
    : /^-?\d+(\.\d{1,2})?$/.test(trimmed);
  if (!groupingIsValid) {
    throw new MoneyError("Enter a valid amount with at most two decimal places.");
  }

  const cleaned = trimmed.replace(/,/g, "");
  const negative = cleaned.startsWith("-");
  const unsigned = negative ? cleaned.slice(1) : cleaned;
  const [whole = "0", fraction = ""] = unsigned.split(".");
  const kobo = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return assertKobo(negative ? -kobo : kobo);
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Format kobo as "₦1,250.00" (never via Intl.NumberFormat — ICU drift). */
export function formatKobo(value: Kobo, options: FormatKoboOptions = {}): string {
  const { symbol = "₦", decimals = 2, sign = "auto" } = options;
  const negative = value < 0n;
  const magnitude = negative ? -value : value;
  const whole = magnitude / 100n;
  const koboPart = magnitude % 100n;
  const body =
    groupThousands(whole.toString()) +
    (decimals === 2 ? `.${koboPart.toString().padStart(2, "0")}` : "");
  const mark = negative ? "-" : sign === "always" ? "+" : "";
  return `${mark}${symbol}${body}`;
}

const COMPACT_UNITS: ReadonlyArray<{ readonly threshold: Kobo; readonly unit: Kobo; readonly suffix: string }> = [
  { threshold: 1_000_000_000_000n, unit: 1_000_000_000_000n, suffix: "b" },
  { threshold: 100_000_000n, unit: 100_000_000n, suffix: "m" },
  { threshold: 100_000n, unit: 100_000n, suffix: "k" },
];

/**
 * Abbreviate for tight spaces: ₦12.3k, ₦1.5m, ₦2.0b.
 * Rounded half-up with integer arithmetic so it never shows 999.9k for 1m.
 */
export function formatKoboCompact(value: Kobo, options: FormatCompactOptions = {}): string {
  const { symbol = "₦", precision = 1 } = options;
  const negative = value < 0n;
  const magnitude = negative ? -value : value;
  const mark = negative ? "-" : "";

  let unitIndex = COMPACT_UNITS.findIndex((candidate) => magnitude >= candidate.threshold);
  let unit = COMPACT_UNITS[unitIndex];
  if (!unit) {
    return `${mark}${symbol}${groupThousands((magnitude / 100n).toString())}`;
  }

  const scale = precision === 1 ? 10n : 1n;
  let scaled = (magnitude * scale + unit.unit / 2n) / unit.unit;

  // Rounding can push a value across the next boundary (₦999,999.99 must render
  // as ₦1m, never ₦1000.0k), so promote the unit and recompute.
  const larger = COMPACT_UNITS[unitIndex - 1];
  if (larger && scaled * unit.unit >= larger.threshold * scale) {
    unit = larger;
    scaled = (magnitude * scale + unit.unit / 2n) / unit.unit;
  }

  const whole = scaled / scale;
  const fraction = precision === 1 ? scaled % scale : 0n;
  const fractionText = precision === 1 && fraction > 0n ? `.${fraction.toString()}` : "";

  return `${mark}${symbol}${whole.toString()}${fractionText}${unit.suffix}`;
}

export function addKobo(...amounts: readonly Kobo[]): Kobo {
  return assertKobo(amounts.reduce((total, amount) => total + amount, 0n));
}

export function subKobo(minuend: Kobo, subtrahend: Kobo): Kobo {
  return assertKobo(minuend - subtrahend);
}

export function sumKobo(amounts: readonly Kobo[]): Kobo {
  return assertKobo(amounts.reduce((total, amount) => total + amount, 0n));
}

/**
 * Apply a basis-point rate (1 bps = 0.01%) with half-up rounding.
 * Used for interest and fee math where the rate is a policy input, never a float.
 */
export function applyBps(value: Kobo, basisPoints: number): Kobo {
  if (!Number.isSafeInteger(basisPoints) || basisPoints < 0) {
    throw new MoneyError("Basis points must be a non-negative safe integer.");
  }
  const negative = value < 0n;
  const magnitude = negative ? -value : value;
  const scaled = (magnitude * BigInt(basisPoints) + 5_000n) / 10_000n;
  return assertKobo(negative ? -scaled : scaled);
}

/**
 * Split an amount by weights without losing a kobo (largest-remainder method).
 * Invariant: sum(result) === total, always. This is the basis of FIFO
 * contribution allocation and installment allocation.
 */
export function allocateKobo(total: Kobo, weights: readonly number[]): Kobo[] {
  if (weights.length === 0) {
    throw new MoneyError("Allocation requires at least one weight.");
  }
  if (weights.some((weight) => !Number.isSafeInteger(weight) || weight <= 0)) {
    throw new MoneyError("Allocation weights must be positive integers.");
  }
  const negative = total < 0n;
  const magnitude = negative ? -total : total;
  const weightSum = weights.reduce<bigint>((sum, weight) => sum + BigInt(weight), 0n);

  const shares = weights.map((weight) => (magnitude * BigInt(weight)) / weightSum);
  const remainders = weights.map((weight) => (magnitude * BigInt(weight)) % weightSum);
  let left = magnitude - shares.reduce((sum, share) => sum + share, 0n);

  const order = weights
    .map((_, index) => index)
    .sort((a, b) => {
      const remainderA = remainders[a] ?? 0n;
      const remainderB = remainders[b] ?? 0n;
      if (remainderA === remainderB) return a - b;
      return remainderA > remainderB ? -1 : 1;
    });

  let cursor = 0;
  while (left > 0n && order.length > 0) {
    const index = order[cursor % order.length] ?? 0;
    shares[index] = (shares[index] ?? 0n) + 1n;
    left -= 1n;
    cursor += 1;
  }

  assertKobo(magnitude);
  return shares.map((share) => (negative ? -share : share));
}
