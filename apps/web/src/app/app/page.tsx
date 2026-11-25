import { formatBusinessDate, todayBusinessDate } from "@1kdaily/core";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { ActivityCard } from "@/components/dashboard/activity-card";
import { CalendarCard } from "@/components/dashboard/calendar-card";
import { EligibilityCard } from "@/components/dashboard/eligibility-card";
import { GrowthCard } from "@/components/dashboard/growth-card";
import { MetricStrip } from "@/components/dashboard/metric-strip";
import { MilestoneCard } from "@/components/dashboard/milestone-card";
import { PlanProgressCard } from "@/components/dashboard/plan-progress-card";
import { SavingsHero } from "@/components/dashboard/savings-hero";
import { Badge } from "@/components/ui/primitives";
import { getDashboardSnapshot } from "@/server/dashboard/get-dashboard-snapshot";

export default async function OverviewPage() {
  const snapshot = await getDashboardSnapshot();
  const today = todayBusinessDate();

  return (
    <div className="animate-rise">
      <div className="flex flex-wrap items-end justify-between gap-3 pb-5">
        <div>
          <h1 className="text-[1.5rem] font-semibold tracking-[-0.02em] text-ink-900">Overview</h1>
          <p className="mt-1 text-[0.8125rem] text-muted">
            {formatBusinessDate(today, "long")} · West Africa Time
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="warning">Phase 1 preview</Badge>
          <Link
            href="/design"
            className="inline-flex items-center gap-1 text-[0.75rem] font-semibold text-brand-700 hover:underline"
          >
            Design system
            <ArrowUpRight className="size-3" aria-hidden />
          </Link>
        </div>
      </div>

      <div className="space-y-4">
        <SavingsHero
          eligibleSavingsKobo={snapshot.totals.eligibleSavingsKobo}
          activePlans={snapshot.totals.activePlans}
          currentStreakDays={snapshot.totals.currentStreakDays}
        />

        <MetricStrip
          activePlans={snapshot.totals.activePlans}
          currentStreakDays={snapshot.totals.currentStreakDays}
        />

        <div className="grid gap-4 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-7">
            <PlanProgressCard />
            <GrowthCard />
          </div>
          <div className="space-y-4 lg:col-span-5">
            <CalendarCard />
            <MilestoneCard
              label={snapshot.nextMilestone.label}
              targetDays={snapshot.nextMilestone.targetDays}
              progressDays={snapshot.nextMilestone.progressDays}
            />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <EligibilityCard eligibleSavingsKobo={snapshot.totals.eligibleSavingsKobo} />
          <ActivityCard />
        </div>
      </div>

      <p className="mt-6 max-w-3xl text-[0.625rem] leading-relaxed text-subtle">
        This dashboard intentionally renders empty states. Phase 1 has no authentication, database
        or ledger, so displaying sample balances here would be fabricated financial data. Figures
        become real in Phase 2 (identity) and Phase 4 (verified payments and double-entry ledger).
      </p>
    </div>
  );
}
