import { Flame, Percent, Target } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

type Metric = {
  readonly label: string;
  readonly value: string;
  readonly unit?: string;
  readonly helper: string;
  readonly icon: typeof Target;
  readonly href?: string;
  readonly hrefLabel?: string;
  readonly accent?: boolean;
};

export function MetricStrip({
  activePlans,
  currentStreakDays,
}: {
  readonly activePlans: number;
  readonly currentStreakDays: number;
}) {
  const metrics: readonly Metric[] = [
    {
      label: "Active plans",
      value: String(activePlans),
      unit: activePlans === 1 ? "plan" : "plans",
      helper: "Nothing active yet.",
      icon: Target,
    },
    {
      label: "Current streak",
      value: String(currentStreakDays),
      unit: "days",
      helper: "Starts with your first confirmed contribution.",
      icon: Flame,
    },
    {
      label: "Potential ceiling",
      value: "—",
      helper: "Requires a completed eligibility assessment.",
      icon: Percent,
      href: "/app/eligibility",
      hrefLabel: "See requirements",
      accent: true,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {metrics.map((metric) => (
        <Card key={metric.label} className="p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[0.6875rem] font-medium uppercase tracking-[0.1em] text-subtle">
              {metric.label}
            </p>
            <span
              className={cn(
                "grid size-7 place-items-center rounded-lg",
                metric.accent ? "bg-accent-50 text-accent-600" : "bg-canvas text-muted",
              )}
            >
              <metric.icon className="size-3.5" strokeWidth={1.9} aria-hidden />
            </span>
          </div>

          <p className="mt-2.5 text-[1.5rem] font-semibold leading-none tracking-[-0.02em] text-ink-900">
            <span className="tabular-nums">{metric.value}</span>
            {metric.unit ? (
              <span className="ml-1 text-[0.6875rem] font-medium text-subtle">{metric.unit}</span>
            ) : null}
          </p>

          <p className="mt-2 text-[0.6875rem] leading-relaxed text-muted">{metric.helper}</p>

          {metric.href ? (
            <Link
              href={metric.href}
              className="mt-2 inline-block text-[0.6875rem] font-semibold text-brand-700 hover:underline"
            >
              {metric.hrefLabel}
            </Link>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
