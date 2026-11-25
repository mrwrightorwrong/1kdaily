import { describe, expect, it } from "vitest";
import {
  addDays,
  asBusinessDate,
  businessDateOf,
  daysInMonth,
  diffDays,
  eachDay,
  endOfMonth,
  formatBusinessDate,
  isBusinessDate,
  startOfMonth,
  todayBusinessDate,
  weekdayOf,
} from "../time";

describe("businessDateOf", () => {
  it("uses West Africa Time, not UTC", () => {
    // 23:30 UTC on 28 Feb is 00:30 WAT on 1 Mar.
    expect(businessDateOf(new Date("2026-02-28T23:30:00Z"))).toBe("2026-03-01");
    expect(businessDateOf(new Date("2026-02-28T22:59:59Z"))).toBe("2026-02-28");
  });

  it("is stable across the local machine time zone", () => {
    const instant = new Date("2026-11-24T09:15:00+01:00");
    expect(businessDateOf(instant, "Africa/Lagos")).toBe("2026-11-24");
    expect(businessDateOf(instant, "UTC")).toBe("2026-11-24");
  });

  it("rejects invalid dates", () => {
    expect(() => businessDateOf(new Date("nope"))).toThrow(RangeError);
  });

  it("derives today from an injected clock", () => {
    expect(todayBusinessDate(new Date("2026-01-01T00:30:00+01:00"))).toBe("2026-01-01");
  });
});

describe("business date validation", () => {
  it("accepts ISO calendar dates", () => {
    expect(isBusinessDate("2026-11-24")).toBe(true);
    expect(asBusinessDate("2026-11-24")).toBe("2026-11-24");
  });

  it.each(["2026-13-01", "2026-02-30", "2026-1-1", "24-11-2026", ""])(
    "rejects %s",
    (value) => {
      expect(isBusinessDate(value)).toBe(false);
      expect(() => asBusinessDate(value)).toThrow(RangeError);
    },
  );
});

describe("date arithmetic", () => {
  it("crosses month, leap-year and year boundaries", () => {
    expect(addDays(asBusinessDate("2026-02-28"), 1)).toBe("2026-03-01");
    expect(addDays(asBusinessDate("2024-02-28"), 1)).toBe("2024-02-29");
    expect(addDays(asBusinessDate("2026-12-31"), 1)).toBe("2027-01-01");
    expect(addDays(asBusinessDate("2026-01-01"), -1)).toBe("2025-12-31");
  });

  it("measures whole days in both directions", () => {
    expect(diffDays(asBusinessDate("2026-01-01"), asBusinessDate("2026-03-01"))).toBe(59);
    expect(diffDays(asBusinessDate("2026-03-01"), asBusinessDate("2026-01-01"))).toBe(-59);
    expect(diffDays(asBusinessDate("2026-01-01"), asBusinessDate("2026-01-01"))).toBe(0);
  });

  it("enumerates consecutive days for a plan schedule", () => {
    expect(eachDay(asBusinessDate("2026-12-30"), 3)).toEqual([
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
    ]);
    expect(eachDay(asBusinessDate("2026-12-30"), 0)).toEqual([]);
  });

  it("reports weekdays in UTC", () => {
    // 24 Nov 2026 is a Tuesday.
    expect(weekdayOf(asBusinessDate("2026-11-24"))).toBe(2);
    expect(weekdayOf(asBusinessDate("2026-11-29"))).toBe(0);
  });
});

describe("month helpers", () => {
  it("finds month boundaries including leap February", () => {
    expect(startOfMonth(asBusinessDate("2026-11-24"))).toBe("2026-11-01");
    expect(endOfMonth(asBusinessDate("2026-11-24"))).toBe("2026-11-30");
    expect(daysInMonth(asBusinessDate("2024-02-10"))).toBe(29);
    expect(daysInMonth(asBusinessDate("2026-02-10"))).toBe(28);
  });
});

describe("formatBusinessDate", () => {
  it("renders stable labels without zone drift", () => {
    expect(formatBusinessDate(asBusinessDate("2026-11-24"), "compact")).toBe("24 Nov");
    expect(formatBusinessDate(asBusinessDate("2026-11-24"), "monthYear")).toBe("November 2026");
    expect(formatBusinessDate(asBusinessDate("2026-11-24"), "long")).toBe(
      "Tuesday, 24 November 2026",
    );
  });
});
