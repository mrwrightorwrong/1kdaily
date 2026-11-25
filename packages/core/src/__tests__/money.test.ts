import { describe, expect, it } from "vitest";
import {
  MAX_KOBO,
  MoneyError,
  allocateKobo,
  applyBps,
  formatKobo,
  formatKoboCompact,
  fromKobo,
  parseNairaToKobo,
  sumKobo,
} from "../money";

describe("parseNairaToKobo", () => {
  it("parses whole naira", () => {
    expect(parseNairaToKobo("1000")).toBe(100_000n);
    expect(parseNairaToKobo("0")).toBe(0n);
  });

  it("accepts thousands separators and one or two decimals", () => {
    expect(parseNairaToKobo("1,000.50")).toBe(100_050n);
    expect(parseNairaToKobo("2500.5")).toBe(250_050n);
    expect(parseNairaToKobo("0.01")).toBe(1n);
  });

  it("accepts negatives for adjustments", () => {
    expect(parseNairaToKobo("-1,250")).toBe(-125_000n);
  });

  it.each(["1.234", "1e3", "₦100", "abc", "", "1.2.3", "1 000", "1,00", "12,34", "1,0000"])(
    "rejects %s",
    (input) => {
      expect(() => parseNairaToKobo(input)).toThrow(MoneyError);
    },
  );
});

describe("formatKobo", () => {
  it("groups and always shows two decimal places by default", () => {
    expect(formatKobo(100_050n)).toBe("₦1,000.50");
    expect(formatKobo(0n)).toBe("₦0.00");
    expect(formatKobo(1n)).toBe("₦0.01");
  });

  it("supports whole-naira display", () => {
    expect(formatKobo(100_050n, { decimals: 0 })).toBe("₦1,000");
  });

  it("places the sign outside the symbol", () => {
    expect(formatKobo(-100_050n)).toBe("-₦1,000.50");
    expect(formatKobo(100_050n, { sign: "always" })).toBe("+₦1,000.50");
  });

  it("exceeds Number.MAX_SAFE_INTEGER without precision loss", () => {
    expect(formatKobo(9_007_199_254_740_993n)).toBe("₦90,071,992,547,409.93");
  });
});

describe("formatKoboCompact", () => {
  it("abbreviates thousands, millions and billions", () => {
    expect(formatKoboCompact(1_234_500n)).toBe("₦12.3k");
    expect(formatKoboCompact(150_000_000n)).toBe("₦1.5m");
    expect(formatKoboCompact(2_000_000_000_000n)).toBe("₦2b");
  });

  it("rounds up at a unit boundary instead of showing 1000.0k", () => {
    expect(formatKoboCompact(99_999_999n)).toBe("₦1m");
    expect(formatKoboCompact(99_960_000n)).toBe("₦999.6k");
  });

  it("falls back to grouped naira below a thousand", () => {
    expect(formatKoboCompact(99_900n)).toBe("₦999");
  });
});

describe("applyBps", () => {
  it("applies basis points with half-up rounding", () => {
    expect(applyBps(100_000n, 250)).toBe(2_500n); // 2.5% of ₦1,000
    expect(applyBps(1n, 5_000)).toBe(1n); // 50% of 1 kobo rounds up
    expect(applyBps(5n, 1_000)).toBe(1n); // 10% of 5 kobo = 0.5, rounds up
    expect(applyBps(3n, 1_000)).toBe(0n); // 10% of 3 kobo = 0.3, rounds down
  });

  it("rejects invalid rates", () => {
    expect(() => applyBps(100n, -1)).toThrow(MoneyError);
    expect(() => applyBps(100n, 1.5)).toThrow(MoneyError);
  });
});

describe("allocateKobo", () => {
  it("never loses a kobo", () => {
    expect(allocateKobo(1_000n, [1, 1, 1])).toEqual([334n, 333n, 333n]);
    expect(sumKobo(allocateKobo(1_000n, [1, 1, 1]))).toBe(1_000n);
  });

  it("respects weight proportions", () => {
    expect(allocateKobo(1_000n, [1, 3])).toEqual([250n, 750n]);
  });

  it("holds the sum invariant across awkward splits", () => {
    const cases: Array<[bigint, number[]]> = [
      [7n, [1, 1, 1]],
      [99_999n, [7, 11, 13]],
      [1n, [5, 5, 5, 5]],
      [0n, [1, 2, 3]],
    ];
    for (const [total, weights] of cases) {
      expect(sumKobo(allocateKobo(total, weights))).toBe(total);
    }
  });

  it("rejects empty or non-positive weights", () => {
    expect(() => allocateKobo(100n, [])).toThrow(MoneyError);
    expect(() => allocateKobo(100n, [1, 0])).toThrow(MoneyError);
  });
});

describe("guards", () => {
  it("rejects amounts above the supported maximum", () => {
    expect(() => fromKobo(MAX_KOBO + 1n)).toThrow(MoneyError);
  });

  it("rejects fractional kobo from numbers", () => {
    expect(() => fromKobo(10.5)).toThrow(MoneyError);
  });
});
