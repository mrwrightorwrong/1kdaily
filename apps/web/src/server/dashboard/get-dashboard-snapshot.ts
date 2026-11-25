import { fromKobo, type Kobo } from "@1kdaily/core";

/**
 * Dashboard read model.
 *
 * Phase 1 has no authentication, no database and no ledger, so this returns an
 * explicit "no account" state. That is deliberate: the dashboard must render
 * honest empty states rather than fabricated balances.
 *
 * Phase 2: resolve the session and return the authenticated, KYC-gated view.
 * Phase 4: replace the zeroed totals with ledger-derived figures from a SQL
 *          view, never from application-side addition of contributions.
 */
export type DashboardSnapshot = {
  readonly state: "no_account";
  readonly totals: {
    readonly eligibleSavingsKobo: Kobo;
    readonly activePlans: number;
    readonly currentStreakDays: number;
    readonly longestStreakDays: number;
  };
  readonly activePlan: null;
  readonly eligibility: null;
  readonly nextMilestone: {
    readonly label: string;
    readonly targetDays: number;
    readonly progressDays: number;
  };
  readonly recentActivity: readonly [];
};

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  return {
    state: "no_account",
    totals: {
      eligibleSavingsKobo: fromKobo(0),
      activePlans: 0,
      currentStreakDays: 0,
      longestStreakDays: 0,
    },
    activePlan: null,
    eligibility: null,
    nextMilestone: { label: "First week", targetDays: 7, progressDays: 0 },
    recentActivity: [],
  };
}
