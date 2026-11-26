import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { todayBusinessDate } from "@1kdaily/core";
import { PlanCalendar, type CalendarDay } from "@/components/savings/plan-calendar";
import { Badge, Card, CardContent, CardHeader, CardTitle, buttonVariants } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

export function CalendarCard({
  days,
  hasPlans,
}: {
  readonly days: readonly CalendarDay[];
  readonly hasPlans: boolean;
}) {
  const month = todayBusinessDate().slice(0, 7);
  const paidThisMonth = days.filter(
    (day) => day.date.slice(0, 7) === month && (day.status === "paid" || day.status === "partially_paid"),
  ).length;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Savings calendar</CardTitle>
          <p className="mt-1 text-[0.75rem] text-muted">
            {hasPlans ? "All plans · West Africa Time" : "No schedule yet"}
          </p>
        </div>
        <Badge variant={hasPlans ? "neutral" : "warning"}>
          {hasPlans ? `${paidThisMonth} paid this month` : "No plan"}
        </Badge>
      </CardHeader>

      <CardContent>
        {hasPlans ? (
          <PlanCalendar days={days} />
        ) : (
          <div className="py-8 text-center">
            <span className="mx-auto grid size-10 place-items-center rounded-xl bg-canvas text-muted ring-1 ring-line">
              <CalendarDays className="size-4.5" strokeWidth={1.9} aria-hidden />
            </span>
            <p className="mt-3 text-[0.8125rem] font-semibold text-ink-900">No contribution days</p>
            <p className="mx-auto mt-1 max-w-[30ch] text-[0.6875rem] leading-relaxed text-muted">
              Activate a plan and its schedule appears here immediately.
            </p>
            <Link
              href="/app/plans"
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mt-3")}
            >
              Choose a plan
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
