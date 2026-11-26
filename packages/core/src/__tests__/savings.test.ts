import { describe, expect, it } from "vitest";
import { asBusinessDate, type BusinessDate } from "../time";
import { fromKobo } from "../money";
import {
  MILESTONES,
  buildSchedule,
  expectedTotal,
  isPlanFinished,
  milestoneProgress,
  planDaysByDate,
  planLength,
  summarisePlan,
  type PlanDay,
  type PlanDayStatus,
  type PlanInput,
} from "../savings";

const DAILY = fromKobo(100_000); // ₦1,000
const TODAY = asBusinessDate("2026-12-10");

function plan(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    dailyAmountKobo: DAILY,
    durationDays: 10,
    startDate: asBusinessDate("2026-12-01"),
    endDate: asBusinessDate("2026-12-10"),
    graceDaysTotal: 2,
    graceDaysUsed: 0,
    status: "active",
    ...overrides,
  };
}

function day(date: string, status: PlanDayStatus, paidKobo?: bigint): PlanDay {
  return {
    date: asBusinessDate(date),
    status,
    expectedKobo: DAILY,
    ...(paidKobo === undefined ? {} : { paidKobo }),
  };
}

describe("buildSchedule", () => {
  it("produces inclusive consecutive dates", () => {
    const schedule = buildSchedule(asBusinessDate("2026-12-30"), 3);
    expect(schedule).toEqual(["2026-12-30", "2026-12-31", "2027-01-01"]);
  });

  it("handles leap February", () => {
    const schedule = buildSchedule(asBusinessDate("2024-02-28"), 3);
    expect(schedule).toEqual(["2024-02-28", "2024-02-29", "2024-03-01"]);
  });

  it("rejects empty or invalid durations", () => {
    expect(() => buildSchedule(asBusinessDate("2026-01-01"), 0)).toThrow(RangeError);
    expect(() => buildSchedule(asBusinessDate("2026-01-01"), 1.5)).toThrow(RangeError);
  });
});

describe("planLength and expectedTotal", () => {
  it("counts days inclusively", () => {
    expect(planLength(asBusinessDate("2026-12-01"), asBusinessDate("2026-12-10"))).toBe(10);
    expect(planLength(asBusinessDate("2026-12-01"), asBusinessDate("2026-12-01"))).toBe(1);
  });

  it("multiplies without floating point", () => {
    expect(expectedTotal(DAILY, 30)).toBe(3_000_000n);
    expect(expectedTotal(fromKobo(1), 365)).toBe(365n);
  });
});

describe("summarisePlan", () => {
  it("counts statuses and money", () => {
    const days = [
      day("2026-12-01", "paid"),
      day("2026-12-02", "paid"),
      day("2026-12-03", "grace"),
      day("2026-12-04", "missed"),
      day("2026-12-05", "paid"),
      day("2026-12-06", "partially_paid", 40_000n),
      day("2026-12-07", "scheduled"),
      day("2026-12-08", "scheduled"),
      day("2026-12-09", "scheduled"),
      day("2026-12-10", "scheduled"),
    ];

    const summary = summarisePlan(plan(), days, TODAY);

    expect(summary.paidDays).toBe(3);
    expect(summary.partiallyPaidDays).toBe(1);
    expect(summary.graceDays).toBe(1);
    expect(summary.missedDays).toBe(1);
    expect(summary.scheduledDays).toBe(4);
    expect(summary.judgedDays).toBe(6);
    expect(summary.accumulatedKobo).toBe(340_000n); // 3 × 100k + 40k
    expect(summary.expectedTotalKobo).toBe(1_000_000n);
    expect(summary.remainingKobo).toBe(660_000n);
    expect(summary.percentPaid).toBe(30);
    expect(summary.consistencyPercent).toBe(67); // 4 settled of 6 judged
  });

  it("computes current and longest streaks, breaking on grace and missed", () => {
    const days = [
      day("2026-12-01", "paid"),
      day("2026-12-02", "paid"),
      day("2026-12-03", "paid"),
      day("2026-12-04", "grace"),
      day("2026-12-05", "paid"),
      day("2026-12-06", "paid"),
      day("2026-12-07", "scheduled"),
      day("2026-12-08", "scheduled"),
      day("2026-12-09", "scheduled"),
      day("2026-12-10", "scheduled"),
    ];

    const summary = summarisePlan(plan(), days, TODAY);
    expect(summary.longestStreak).toBe(3);
    expect(summary.currentStreak).toBe(2);
  });

  it("does not let paused or skipped days break a streak", () => {
    const days = [
      day("2026-12-01", "paid"),
      day("2026-12-02", "paid"),
      day("2026-12-03", "paused"),
      day("2026-12-04", "paid"),
      day("2026-12-05", "skipped"),
      day("2026-12-06", "paid"),
      day("2026-12-07", "scheduled"),
      day("2026-12-08", "scheduled"),
      day("2026-12-09", "scheduled"),
      day("2026-12-10", "scheduled"),
    ];

    const summary = summarisePlan(plan(), days, TODAY);
    expect(summary.currentStreak).toBe(4);
    expect(summary.longestStreak).toBe(4);
    expect(summary.pausedDays).toBe(1);
    expect(summary.skippedDays).toBe(1);
  });

  it("reports the next due date and remaining days", () => {
    const days = [
      day("2026-12-08", "paid"),
      day("2026-12-09", "paid"),
      day("2026-12-10", "scheduled"),
      day("2026-12-11", "scheduled"),
    ];
    const summary = summarisePlan(plan({ durationDays: 4, startDate: asBusinessDate("2026-12-08"), endDate: asBusinessDate("2026-12-11") }), days, TODAY);
    expect(summary.nextDueDate).toBe("2026-12-10");
    expect(summary.daysRemaining).toBe(2);
  });

  it("shows zero consistency before any day is judged", () => {
    const days = [day("2026-12-10", "scheduled")];
    const summary = summarisePlan(plan({ durationDays: 1, startDate: TODAY, endDate: TODAY }), days, TODAY);
    expect(summary.judgedDays).toBe(0);
    expect(summary.consistencyPercent).toBe(0);
    expect(summary.percentPaid).toBe(0);
  });

  it("keeps the schedule total when days are missing from the input", () => {
    const summary = summarisePlan(plan(), [], TODAY);
    expect(summary.totalDays).toBe(10);
    expect(summary.expectedTotalKobo).toBe(1_000_000n);
  });

  it("never reports negative remaining money", () => {
    const days = Array.from({ length: 10 }, (_, index) =>
      day(`2026-12-${String(index + 1).padStart(2, "0")}`, "paid"),
    );
    const summary = summarisePlan(plan(), days, TODAY);
    expect(summary.remainingKobo).toBe(0n);
    expect(summary.percentPaid).toBe(100);
  });
});

describe("isPlanFinished", () => {
  it("is true after the end date with nothing scheduled", () => {
    const days = [day("2026-12-01", "paid")];
    expect(isPlanFinished(plan({ durationDays: 1, endDate: asBusinessDate("2026-12-01") }), days, TODAY)).toBe(true);
  });

  it("is false while days remain scheduled", () => {
    const days = [day("2026-12-20", "scheduled")];
    expect(isPlanFinished(plan({ endDate: asBusinessDate("2026-12-20") }), days, TODAY)).toBe(false);
  });

  it("treats cancelled plans as finished", () => {
    expect(isPlanFinished(plan({ status: "cancelled" }), [], TODAY)).toBe(true);
  });
});

describe("milestoneProgress", () => {
  it("tracks the next threshold and progress between thresholds", () => {
    expect(MILESTONES[0]).toBe(7);
    const progress = milestoneProgress(10);
    expect(progress.next).toBe(14);
    expect(progress.daysToNext).toBe(4);
    expect(progress.achieved).toEqual([7]);
    expect(progress.percent).toBe(43); // 3 of 7 days toward the next milestone
  });

  it("starts at zero and completes at 365", () => {
    expect(milestoneProgress(0).next).toBe(7);
    expect(milestoneProgress(0).percent).toBe(0);
    const done = milestoneProgress(400);
    expect(done.next).toBeNull();
    expect(done.percent).toBe(100);
    expect(done.achieved.at(-1)).toBe(365);
  });
});

describe("planDaysByDate", () => {
  it("indexes days by business date", () => {
    const map = planDaysByDate([day("2026-12-01", "paid"), day("2026-12-02", "missed")]);
    expect(map.get(asBusinessDate("2026-12-01"))?.status).toBe("paid");
    expect(map.get(asBusinessDate("2026-12-03"))).toBeUndefined();
  });
});

describe("business date typing", () => {
  it("accepts ISO dates only", () => {
    expect(() => asBusinessDate("2026-13-01")).toThrow();
    const date: BusinessDate = asBusinessDate("2026-12-01");
    expect(date).toBe("2026-12-01");
  });
});
