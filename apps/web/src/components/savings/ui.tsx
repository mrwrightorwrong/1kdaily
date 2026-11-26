import Link from "next/link";
import { ArrowRight, CalendarDays, Flame, Target } from "lucide-react";
import type { PlanProgress, PlanStatus } from "@1kdaily/core";
import { Money } from "@/components/finance/money";
import { Badge, Card, buttonVariants } from "@/components/ui/primitives";
import type { SavingsProduct } from "@/server/savings/plans";
import { cn } from "@/lib/cn";

const STATUS_VARIANT: Record<PlanStatus, "success" | "warning" | "neutral" | "danger" | "info"> = {
  active: "success",
  paused: "warning",
  completed: "info",
  cancelled: "neutral",
  suspended: "danger",
  draft: "neutral",
  pending_activation: "info",
};

const STATUS_LABEL: Record<PlanStatus, string> = {
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
  suspended: "Suspended",
  draft: "Draft",
  pending_activation: "Pending",
};

export function PlanStatusBadge({ status }: { readonly status: PlanStatus }) {
  return (
    <Badge data-testid="plan-status" variant={STATUS_VARIANT[status] ?? "neutral"}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

export function PlanCard({
  planId,
  name,
  dailyAmountKobo,
  durationDays,
  status,
  progress,
  nextDueLabel,
}: {
  readonly planId: string;
  readonly name: string;
  readonly dailyAmountKobo: bigint;
  readonly durationDays: number;
  readonly status: PlanStatus;
  readonly progress: PlanProgress;
  readonly nextDueLabel: string | null;
}) {
  return (
    <Link
      href={`/app/plans/${planId}`}
      className="group flex flex-col rounded-card border border-line bg-surface p-5 shadow-card transition-[border-color,transform] hover:-translate-y-0.5 hover:border-line-strong"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.9375rem] font-semibold tracking-tight text-ink-900">{name}</p>
          <p className="mt-0.5 text-[0.75rem] text-muted">
            <Money value={dailyAmountKobo} decimals={0} /> / day · {durationDays} days
          </p>
        </div>
        <PlanStatusBadge status={status} />
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-[0.6875rem]">
          <span className="text-muted">
            {progress.paidDays} of {progress.totalDays} days paid
          </span>
          <span className="font-semibold text-ink-900">{progress.percentPaid}%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#e9eef6]">
          <div
            className={cn(
              "h-full rounded-full",
              status === "paused" ? "bg-gold-500" : "bg-brand-600",
            )}
            style={{ width: `${progress.percentPaid}%` }}
          />
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-[0.8125rem] font-semibold text-ink-900">
            <Money value={progress.accumulatedKobo} />
          </span>
          <span className="text-[0.625rem] text-subtle">
            of <Money value={progress.expectedTotalKobo} decimals={0} />
          </span>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3">
        <div>
          <dt className="text-[0.5625rem] uppercase tracking-[0.08em] text-subtle">Streak</dt>
          <dd className="mt-0.5 flex items-center gap-1 text-[0.75rem] font-semibold text-ink-900">
            <Flame className="size-3 text-warn-500" aria-hidden />
            {progress.currentStreak}
          </dd>
        </div>
        <div>
          <dt className="text-[0.5625rem] uppercase tracking-[0.08em] text-subtle">Remaining</dt>
          <dd className="mt-0.5 flex items-center gap-1 text-[0.75rem] font-semibold text-ink-900">
            <Target className="size-3 text-muted" aria-hidden />
            {progress.daysRemaining}
          </dd>
        </div>
        <div>
          <dt className="text-[0.5625rem] uppercase tracking-[0.08em] text-subtle">Next</dt>
          <dd className="mt-0.5 flex items-center gap-1 text-[0.75rem] font-semibold text-ink-900">
            <CalendarDays className="size-3 text-muted" aria-hidden />
            {nextDueLabel ?? "—"}
          </dd>
        </div>
      </dl>

      <span className="mt-3 inline-flex items-center gap-1 text-[0.6875rem] font-semibold text-brand-700">
        View plan
        <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  );
}

export function ProductCard({ product }: { readonly product: SavingsProduct }) {
  const daily = product.daily_amount_kobo ? BigInt(product.daily_amount_kobo) : null;

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-subtle">
          {product.name}
        </p>
        {product.is_custom ? <Badge variant="info">Custom</Badge> : null}
      </div>

      <p className="mt-2.5 flex items-baseline gap-1.5">
        {daily ? (
          <>
            <Money
              value={daily}
              decimals={0}
              className="text-[1.625rem] font-semibold leading-none tracking-[-0.02em] text-ink-900"
            />
            <span className="text-[0.75rem] text-muted">/ day</span>
          </>
        ) : (
          <span className="text-[1rem] font-semibold text-ink-900">
            <Money value={BigInt(product.min_daily_kobo)} decimals={0} /> –{" "}
            <Money value={BigInt(product.max_daily_kobo)} decimals={0} />
            <span className="ml-1 text-[0.75rem] font-medium text-muted">/ day</span>
          </span>
        )}
      </p>

      <p className="mt-2 flex-1 text-[0.75rem] leading-relaxed text-muted">
        {product.description ?? "A custom daily plan within the configured limits."}
      </p>

      <div className="mt-4 flex flex-wrap gap-1">
        {product.durations.map((duration) => (
          <span
            key={duration}
            className="rounded-full bg-canvas px-2 py-0.5 text-[0.625rem] font-medium text-muted ring-1 ring-line"
          >
            {duration}d
          </span>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between text-[0.625rem] text-subtle">
        <span>{product.grace_days} grace day{product.grace_days === 1 ? "" : "s"}</span>
        <span>
          {product.withdrawal_policy === "completion_only"
            ? "Withdrawal at completion"
            : "Early withdrawal allowed"}
        </span>
      </div>

      <Link
        href={`/app/plans/new?product=${product.code}`}
        className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mt-4 w-full")}
      >
        {product.is_custom ? "Build a custom plan" : "Choose this plan"}
      </Link>
    </Card>
  );
}
