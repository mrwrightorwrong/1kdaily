import { ArrowRight, Plus, Target } from "lucide-react";
import Link from "next/link";
import { Money } from "@/components/finance/money";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Progress,
  buttonVariants,
} from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import type { PlanWithProgress } from "@/server/savings/plans";

export function PlanProgressCard({ entry }: { readonly entry: PlanWithProgress | null }) {
  if (!entry) {
    return (
      <Card className="flex flex-col">
        <CardHeader>
          <div>
            <CardTitle>Plan progress</CardTitle>
            <p className="mt-1 text-[0.75rem] text-muted">Your current daily plan and its target.</p>
          </div>
          <Badge variant="neutral">No plan</Badge>
        </CardHeader>
        <CardContent className="flex-1">
          <EmptyState
            icon={Target}
            title="No active savings plan"
            description="Choose a daily amount and duration. You will see the full total, end date, grace rules and withdrawal terms before you confirm."
            action={
              <Link
                href="/app/plans"
                className={cn(buttonVariants({ variant: "primary", size: "sm" }))}
              >
                Choose a plan
                <Plus className="size-3.5" aria-hidden />
              </Link>
            }
          />
        </CardContent>
      </Card>
    );
  }

  const { plan, progress } = entry;

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div>
          <CardTitle>{plan.name} plan</CardTitle>
          <p className="mt-1 text-[0.75rem] text-muted">
            <Money value={BigInt(plan.daily_amount_kobo)} decimals={0} /> / day ·{" "}
            {plan.duration_days} days
          </p>
        </div>
        <Badge variant={plan.status === "paused" ? "warning" : "success"}>
          {plan.status === "paused" ? "Paused" : "Active"}
        </Badge>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[0.625rem] uppercase tracking-[0.1em] text-subtle">Accumulated</p>
            <p className="mt-0.5 text-[1.5rem] font-semibold leading-none text-ink-900">
              <Money value={progress.accumulatedKobo} dimDecimals />
            </p>
          </div>
          <p className="text-[0.6875rem] text-muted">
            {progress.paidDays} / {progress.totalDays} days
          </p>
        </div>

        <div className="mt-3">
          <Progress value={progress.percentPaid} label="Plan progress" />
        </div>

        <dl className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-canvas p-2.5">
            <dt className="text-[0.5rem] uppercase tracking-[0.08em] text-subtle">Remaining</dt>
            <dd className="mt-0.5 text-[0.8125rem] font-semibold text-ink-900">
              {progress.daysRemaining}d
            </dd>
          </div>
          <div className="rounded-lg bg-canvas p-2.5">
            <dt className="text-[0.5rem] uppercase tracking-[0.08em] text-subtle">Streak</dt>
            <dd className="mt-0.5 text-[0.8125rem] font-semibold text-ink-900">
              {progress.currentStreak}
            </dd>
          </div>
          <div className="rounded-lg bg-canvas p-2.5">
            <dt className="text-[0.5rem] uppercase tracking-[0.08em] text-subtle">Grace</dt>
            <dd className="mt-0.5 text-[0.8125rem] font-semibold text-ink-900">
              {progress.graceRemaining}
            </dd>
          </div>
        </dl>

        <div className="mt-auto pt-4">
          <Link
            href={`/app/plans/${plan.id}`}
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "w-full")}
          >
            View plan
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
