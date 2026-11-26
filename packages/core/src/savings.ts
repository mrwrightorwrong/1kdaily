/**
 * Savings plan engine.
 *
 * Pure functions over a materialised schedule. The database stores the days;
 * this module interprets them. Nothing here reads the clock: `today` is always
 * injected, so results are reproducible and testable.
 *
 * Terminology:
 *   paid          a fully settled contribution for that business date
 *   partially_paid settlement below the expected amount (Phase 4)
 *   missed        due date passed with no contribution and no grace left
 *   grace         a missed day covered by the plan's grace allowance
 *   paused        inside an agreed pause; not an expectation, not a miss
 *   skipped       plan cancelled before that date
 *   scheduled     still expected (today or future)
 */

import { addDays, diffDays, type BusinessDate } from "./time";
import { sumKobo, type Kobo } from "./money";

export type PlanStatus =
  | "draft"
  | "pending_activation"
  | "active"
  | "paused"
  | "completed"
  | "cancelled"
  | "suspended";

export type PlanDayStatus =
  | "scheduled"
  | "paid"
  | "partially_paid"
  | "missed"
  | "grace"
  | "paused"
  | "skipped";

export type PlanDay = {
  readonly date: BusinessDate;
  readonly status: PlanDayStatus;
  readonly expectedKobo: Kobo;
  readonly paidKobo?: Kobo;
};

export type PlanInput = {
  readonly dailyAmountKobo: Kobo;
  readonly durationDays: number;
  readonly startDate: BusinessDate;
  readonly endDate: BusinessDate;
  readonly graceDaysTotal: number;
  readonly graceDaysUsed: number;
  readonly status: PlanStatus;
};

export type PlanProgress = {
  readonly totalDays: number;
  readonly paidDays: number;
  readonly partiallyPaidDays: number;
  readonly missedDays: number;
  readonly graceDays: number;
  readonly scheduledDays: number;
  readonly pausedDays: number;
  readonly skippedDays: number;
  readonly judgedDays: number;
  readonly expectedTotalKobo: Kobo;
  readonly accumulatedKobo: Kobo;
  readonly remainingKobo: Kobo;
  readonly percentPaid: number;
  readonly consistencyPercent: number;
  readonly currentStreak: number;
  readonly longestStreak: number;
  readonly daysRemaining: number;
  readonly nextDueDate: BusinessDate | null;
  readonly graceRemaining: number;
};

/** Every expected contribution date, inclusive of start and end. */
export function buildSchedule(start: BusinessDate, durationDays: number): BusinessDate[] {
  if (!Number.isSafeInteger(durationDays) || durationDays <= 0) {
    throw new RangeError("A plan must have at least one day.");
  }
  return Array.from({ length: durationDays }, (_, index) => addDays(start, index));
}

const SETTLED: ReadonlySet<PlanDayStatus> = new Set<PlanDayStatus>(["paid", "partially_paid"]);
const JUDGED: ReadonlySet<PlanDayStatus> = new Set<PlanDayStatus>(["paid", "partially_paid", "missed", "grace"]);
const NEUTRAL: ReadonlySet<PlanDayStatus> = new Set<PlanDayStatus>(["paused", "skipped"]);

function percent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

export function summarisePlan(
  plan: PlanInput,
  days: readonly PlanDay[],
  today: BusinessDate,
): PlanProgress {
  const ordered = [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  let paidDays = 0;
  let partiallyPaidDays = 0;
  let missedDays = 0;
  let graceDays = 0;
  let scheduledDays = 0;
  let pausedDays = 0;
  let skippedDays = 0;
  let accumulated = 0n;
  let expected = 0n;

  for (const day of ordered) {
    expected += day.expectedKobo;
    switch (day.status) {
      case "paid":
        paidDays += 1;
        accumulated += day.paidKobo ?? day.expectedKobo;
        break;
      case "partially_paid":
        partiallyPaidDays += 1;
        accumulated += day.paidKobo ?? 0n;
        break;
      case "missed":
        missedDays += 1;
        break;
      case "grace":
        graceDays += 1;
        break;
      case "scheduled":
        scheduledDays += 1;
        break;
      case "paused":
        pausedDays += 1;
        break;
      case "skipped":
        skippedDays += 1;
        break;
    }
  }

  // Streaks: consecutive settled days among days that have actually been judged.
  // Paused and skipped days are neutral; grace and missed days break the run.
  let longestStreak = 0;
  let run = 0;
  let currentStreak = 0;
  for (const day of ordered) {
    if (NEUTRAL.has(day.status)) continue;
    if (!JUDGED.has(day.status)) continue; // future/ungraded days do not affect history
    if (day.status === "paid") {
      run += 1;
      longestStreak = Math.max(longestStreak, run);
      currentStreak = run;
    } else {
      run = 0;
      currentStreak = 0;
    }
  }

  const judgedDays = paidDays + partiallyPaidDays + missedDays + graceDays;

  const upcoming = ordered.filter((day) => day.status === "scheduled" && day.date >= today);
  const nextDueDate = upcoming[0]?.date ?? null;
  const daysRemaining = upcoming.length;

  const totalDays = ordered.length || plan.durationDays;
  const expectedTotal = expected > 0n ? expected : plan.dailyAmountKobo * BigInt(plan.durationDays);
  const remaining = expectedTotal > accumulated ? expectedTotal - accumulated : 0n;

  return {
    totalDays,
    paidDays,
    partiallyPaidDays,
    missedDays,
    graceDays,
    scheduledDays,
    pausedDays,
    skippedDays,
    judgedDays,
    expectedTotalKobo: expectedTotal,
    accumulatedKobo: accumulated,
    remainingKobo: remaining,
    percentPaid: percent(paidDays, totalDays),
    consistencyPercent: percent(paidDays + partiallyPaidDays, judgedDays),
    currentStreak,
    longestStreak,
    daysRemaining,
    nextDueDate,
    graceRemaining: Math.max(plan.graceDaysTotal - plan.graceDaysUsed, 0),
  };
}

/** True when the plan's final date has passed and nothing remains scheduled. */
export function isPlanFinished(plan: PlanInput, days: readonly PlanDay[], today: BusinessDate): boolean {
  if (plan.status === "cancelled" || plan.status === "completed") return true;
  if (today <= plan.endDate) return false;
  return days.every((day) => day.status !== "scheduled");
}

export const MILESTONES = [7, 14, 30, 60, 90, 180, 365] as const;
export type Milestone = (typeof MILESTONES)[number];

export type MilestoneProgress = {
  readonly achieved: readonly Milestone[];
  readonly next: Milestone | null;
  readonly paidDays: number;
  readonly daysToNext: number;
  /** Progress toward the next milestone, 0–100. 100 when all are achieved. */
  readonly percent: number;
};

export function milestoneProgress(paidDays: number): MilestoneProgress {
  const achieved = MILESTONES.filter((milestone) => paidDays >= milestone);
  const next = MILESTONES.find((milestone) => paidDays < milestone) ?? null;

  if (!next) {
    return { achieved, next: null, paidDays, daysToNext: 0, percent: 100 };
  }

  const previous = achieved.length > 0 ? achieved[achieved.length - 1]! : 0;
  const span = next - previous;
  const progressed = paidDays - previous;

  return {
    achieved,
    next,
    paidDays,
    daysToNext: next - paidDays,
    percent: Math.round((progressed / span) * 100),
  };
}

/**
 * Groups a month of days for calendar rendering. Days outside the plan are
 * returned as null so the UI can distinguish "no expectation" from "scheduled".
 */
export function planDaysByDate(days: readonly PlanDay[]): ReadonlyMap<BusinessDate, PlanDay> {
  return new Map(days.map((day) => [day.date, day]));
}

/** Inclusive day count between two business dates. */
export function planLength(start: BusinessDate, end: BusinessDate): number {
  return diffDays(start, end) + 1;
}

/** Total a plan will collect if every day is paid. */
export function expectedTotal(dailyAmountKobo: Kobo, durationDays: number): Kobo {
  return sumKobo(Array.from({ length: durationDays }, () => dailyAmountKobo));
}
