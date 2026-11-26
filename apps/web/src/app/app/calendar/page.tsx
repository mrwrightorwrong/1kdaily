import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { todayBusinessDate } from "@1kdaily/core";
import { PlanCalendar } from "@/components/savings/plan-calendar";
import { Card, CardContent, buttonVariants } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { requireProfile } from "@/server/auth/session";
import { aggregateCalendar, getPlans, refreshPlanDays } from "@/server/savings/plans";

export const metadata: Metadata = { title: "Savings calendar" };

export default async function SavingsCalendarPage() {
  await requireProfile();
  await refreshPlanDays();

  const today = todayBusinessDate();
  const plans = await getPlans(today);
  const calendarDays = aggregateCalendar(plans);
  const hasPlans = plans.some((entry) => entry.plan.status !== "cancelled");

  return (
    <div className="animate-rise space-y-4">
      <div>
        <h1 className="text-[1.5rem] font-semibold tracking-[-0.02em] text-ink-900">
          Savings calendar
        </h1>
        <p className="mt-1 text-[0.8125rem] text-muted">
          Combined across your plans. A day is only paid when every plan due that day is settled.
        </p>
      </div>

      <Card>
        <CardContent>
          {hasPlans ? (
            <PlanCalendar days={calendarDays} />
          ) : (
            <div className="py-10 text-center">
              <span className="mx-auto grid size-11 place-items-center rounded-xl bg-canvas text-muted ring-1 ring-line">
                <CalendarDays className="size-5" strokeWidth={1.9} aria-hidden />
              </span>
              <p className="mt-3 text-[0.9375rem] font-semibold text-ink-900">No schedule yet</p>
              <p className="mx-auto mt-1 max-w-sm text-[0.75rem] leading-relaxed text-muted">
                Activate a plan and its contribution days appear here, with real statuses as they
                pass.
              </p>
              <Link
                href="/app/plans"
                className={cn(buttonVariants({ variant: "primary", size: "sm" }), "mt-4")}
              >
                Choose a plan
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {plans.length > 0 ? (
        <div className="rounded-xl border border-line bg-surface p-3.5">
          <p className="text-[0.625rem] leading-relaxed text-muted">
            {plans.length} plan{plans.length === 1 ? "" : "s"} on record. Open a plan for its exact
            schedule; this view is a convenience, not the source of truth.
          </p>
        </div>
      ) : null}
    </div>
  );
}
