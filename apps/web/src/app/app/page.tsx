import { formatBusinessDate, todayBusinessDate } from "@1kdaily/core";
import { ArrowUpRight, CircleCheck, CircleDashed } from "lucide-react";
import Link from "next/link";
import { ActivityCard } from "@/components/dashboard/activity-card";
import { CalendarCard } from "@/components/dashboard/calendar-card";
import { EligibilityCard } from "@/components/dashboard/eligibility-card";
import { GrowthCard } from "@/components/dashboard/growth-card";
import { MetricStrip } from "@/components/dashboard/metric-strip";
import { MilestoneCard } from "@/components/dashboard/milestone-card";
import { PlanProgressCard } from "@/components/dashboard/plan-progress-card";
import { SavingsHero } from "@/components/dashboard/savings-hero";
import { Badge, buttonVariants } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import {
  getIdentitySummary,
  getVerificationStatuses,
  requireProfile,
} from "@/server/auth/session";
import { getDashboardSnapshot } from "@/server/dashboard/get-dashboard-snapshot";

export default async function OverviewPage() {
  const profile = await requireProfile();
  const [snapshot, verifications, identity] = await Promise.all([
    getDashboardSnapshot(),
    getVerificationStatuses(),
    getIdentitySummary(),
  ]);

  const today = todayBusinessDate();
  const emailVerified = verifications.some(
    (record) => record.kind === "email" && record.status === "verified",
  );
  const identitySubmitted = identity.length > 0;
  const identityVerified = identity.some((record) => record.status === "verified");

  return (
    <div className="animate-rise">
      <div className="flex flex-wrap items-end justify-between gap-3 pb-5">
        <div>
          <h1 className="text-[1.5rem] font-semibold tracking-[-0.02em] text-ink-900">
            {profile.first_name ? `Welcome, ${profile.first_name}` : "Overview"}
          </h1>
          <p className="mt-1 text-[0.8125rem] text-muted">
            {formatBusinessDate(today, "long")} · West Africa Time
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/app/profile"
            className="inline-flex items-center gap-1 text-[0.75rem] font-semibold text-brand-700 hover:underline"
          >
            Account & verification
            <ArrowUpRight className="size-3" aria-hidden />
          </Link>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[0.6875rem] font-medium text-ink-900 ring-1 ring-line">
          {emailVerified ? (
            <CircleCheck className="size-3.5 text-brand-600" strokeWidth={2} aria-hidden />
          ) : (
            <CircleDashed className="size-3.5 text-warn-500" strokeWidth={2} aria-hidden />
          )}
          Email {emailVerified ? "verified" : "unconfirmed"}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[0.6875rem] font-medium text-ink-900 ring-1 ring-line">
          {identityVerified ? (
            <CircleCheck className="size-3.5 text-brand-600" strokeWidth={2} aria-hidden />
          ) : (
            <CircleDashed
              className={cn("size-3.5", identitySubmitted ? "text-warn-500" : "text-subtle")}
              strokeWidth={2}
              aria-hidden
            />
          )}
          Identity{" "}
          {identityVerified ? "verified" : identitySubmitted ? "in review" : "not provided"}
        </span>
        <Badge variant="neutral">Phase 2 · identity</Badge>
      </div>

      <div className="space-y-4">
        <SavingsHero
          eligibleSavingsKobo={snapshot.totals.eligibleSavingsKobo}
          activePlans={snapshot.totals.activePlans}
          currentStreakDays={snapshot.totals.currentStreakDays}
          emailVerified={emailVerified}
          identitySubmitted={identitySubmitted}
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

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface p-4">
        <p className="max-w-2xl text-[0.6875rem] leading-relaxed text-muted">
          Accounts, profiles and identity verification are live. Savings figures stay at zero until
          the double-entry ledger and verified payments exist (Phase 4) — displaying sample balances
          here would be fabricated financial data.
        </p>
        <Link
          href="/app/profile"
          className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
        >
          Review your verification
        </Link>
      </div>
    </div>
  );
}
