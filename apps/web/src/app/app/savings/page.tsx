import type { Metadata } from "next";
import Link from "next/link";
import { PiggyBank, Plus } from "lucide-react";
import { sumKobo, todayBusinessDate } from "@1kdaily/core";
import { Money } from "@/components/finance/money";
import { PlanCard } from "@/components/savings/ui";
import { Card, CardContent, SectionHeading, buttonVariants } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { requireProfile } from "@/server/auth/session";
import { getPlans, refreshPlanDays, splitPlans } from "@/server/savings/plans";

export const metadata: Metadata = { title: "My savings" };

export default async function SavingsPage() {
  await requireProfile();
  await refreshPlanDays();

  const today = todayBusinessDate();
  const plans = await getPlans(today);
  const { current, past } = splitPlans(plans);

  const accumulated = sumKobo(plans.map((entry) => entry.progress.accumulatedKobo));
  const expected = sumKobo(plans.map((entry) => entry.progress.expectedTotalKobo));
  const paidDays = plans.reduce((total, entry) => total + entry.progress.paidDays, 0);
  const judgedDays = plans.reduce((total, entry) => total + entry.progress.judgedDays, 0);
  const consistency = judgedDays > 0 ? Math.round((paidDays / judgedDays) * 100) : null;

  return (
    <div className="animate-rise space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.5rem] font-semibold tracking-[-0.02em] text-ink-900">My savings</h1>
          <p className="mt-1 text-[0.8125rem] text-muted">
            Every plan, its schedule and its confirmed record.
          </p>
        </div>
        <Link
          href="/app/plans"
          className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
        >
          <Plus className="size-3.5" aria-hidden />
          New plan
        </Link>
      </div>

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-subtle">
              Accumulated
            </p>
            <p className="mt-1 text-[1.5rem] font-semibold leading-none text-ink-900">
              <Money value={accumulated} dimDecimals />
            </p>
            <p className="mt-1 text-[0.6875rem] text-muted">
              of <Money value={expected} decimals={0} /> committed across plans
            </p>
          </div>
          <div>
            <p className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-subtle">
              Contribution days
            </p>
            <p className="mt-1 text-[1.5rem] font-semibold leading-none text-ink-900">
              {paidDays}
              <span className="ml-1 text-[0.75rem] font-medium text-muted">paid</span>
            </p>
            <p className="mt-1 text-[0.6875rem] text-muted">{judgedDays} days judged so far</p>
          </div>
          <div>
            <p className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-subtle">
              Consistency
            </p>
            <p className="mt-1 text-[1.5rem] font-semibold leading-none text-ink-900">
              {consistency === null ? "—" : `${consistency}%`}
            </p>
            <p className="mt-1 text-[0.6875rem] text-muted">
              Paid days over judged days, across plans
            </p>
          </div>
        </CardContent>
      </Card>

      {plans.length === 0 ? (
        <Card className="p-8 text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-700">
            <PiggyBank className="size-5" strokeWidth={1.9} aria-hidden />
          </span>
          <p className="mt-3 text-[0.9375rem] font-semibold text-ink-900">Nothing saved yet</p>
          <p className="mx-auto mt-1 max-w-sm text-[0.75rem] leading-relaxed text-muted">
            Activate a daily plan and your schedule appears here immediately. Contributions are
            recorded when the verified-payment ledger is live.
          </p>
          <Link
            href="/app/plans"
            className={cn(buttonVariants({ variant: "primary", size: "sm" }), "mt-4")}
          >
            Choose a plan
          </Link>
        </Card>
      ) : (
        <>
          {current.length > 0 ? (
            <section aria-labelledby="current">
              <SectionHeading eyebrow="In progress" title="Current plans" />
              <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {current.map((entry) => (
                  <PlanCard
                    key={entry.plan.id}
                    planId={entry.plan.id}
                    name={entry.plan.name}
                    dailyAmountKobo={BigInt(entry.plan.daily_amount_kobo)}
                    durationDays={entry.plan.duration_days}
                    status={entry.plan.status}
                    progress={entry.progress}
                    nextDueLabel={
                      entry.progress.nextDueDate ? entry.progress.nextDueDate.slice(8, 10) : null
                    }
                  />
                ))}
              </div>
            </section>
          ) : null}

          {past.length > 0 ? (
            <section aria-labelledby="past">
              <SectionHeading eyebrow="History" title="Closed plans" />
              <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {past.map((entry) => (
                  <PlanCard
                    key={entry.plan.id}
                    planId={entry.plan.id}
                    name={entry.plan.name}
                    dailyAmountKobo={BigInt(entry.plan.daily_amount_kobo)}
                    durationDays={entry.plan.duration_days}
                    status={entry.plan.status}
                    progress={entry.progress}
                    nextDueLabel={null}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
