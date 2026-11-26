import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import { todayBusinessDate } from "@1kdaily/core";
import { PlanCard, ProductCard } from "@/components/savings/ui";
import { Badge, Card, SectionHeading, buttonVariants } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { requireProfile } from "@/server/auth/session";
import { getPlans, getProducts, refreshPlanDays, splitPlans } from "@/server/savings/plans";

export const metadata: Metadata = { title: "Savings plans" };

export default async function SavingsPlansPage() {
  await requireProfile();
  await refreshPlanDays();

  const today = todayBusinessDate();
  const [products, plans] = await Promise.all([getProducts(), getPlans(today)]);
  const { current } = splitPlans(plans);

  return (
    <div className="animate-rise space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.5rem] font-semibold tracking-[-0.02em] text-ink-900">
            Savings plans
          </h1>
          <p className="mt-1 text-[0.8125rem] text-muted">
            Pick a daily amount and a duration. Rules are shown before you activate anything.
          </p>
        </div>
        <Link
          href="/app/plans/new?product=custom"
          className={cn(buttonVariants({ variant: "primary", size: "sm" }))}
        >
          <Plus className="size-3.5" aria-hidden />
          Custom plan
        </Link>
      </div>

      {current.length > 0 ? (
        <section aria-labelledby="current-plans">
          <div className="flex items-center justify-between gap-2 pb-2">
            <h2 id="current-plans" className="text-[0.9375rem] font-semibold text-ink-900">
              Your plans
            </h2>
            <Badge variant="neutral">
              {current.length} active · max 3
            </Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
                  entry.progress.nextDueDate
                    ? entry.progress.nextDueDate.slice(8, 10)
                    : null
                }
              />
            ))}
          </div>
        </section>
      ) : (
        <Card className="flex items-start gap-3 p-5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
            <Sparkles className="size-4" strokeWidth={1.9} aria-hidden />
          </span>
          <div>
            <p className="text-[0.875rem] font-semibold text-ink-900">No active plan yet</p>
            <p className="mt-1 text-[0.75rem] leading-relaxed text-muted">
              Choose one of the plans below, or build a custom amount. You will see the total, end
              date, grace rule and withdrawal terms before confirming.
            </p>
          </div>
        </Card>
      )}

      <section aria-labelledby="catalogue">
        <SectionHeading
          eyebrow="Catalogue"
          title="Choose a pace you can keep"
          description="Daily amounts and durations are administered centrally. A plan can be paused or cancelled; its schedule and history are kept either way."
          action={<Badge variant="neutral">Configured by 1kDaily</Badge>}
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <p className="text-[0.6875rem] leading-relaxed text-subtle">
        Contribution recording arrives with the verified-payment ledger in Phase 4. Until then a plan
        records its schedule and the days that pass; no payment is simulated or credited.
      </p>
    </div>
  );
}
