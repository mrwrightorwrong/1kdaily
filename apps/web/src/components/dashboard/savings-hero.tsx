import { ArrowRight, Check, Plus } from "lucide-react";
import Link from "next/link";
import type { Kobo } from "@1kdaily/core";
import { Money } from "@/components/finance/money";
import { buttonVariants } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

export function SavingsHero({
  eligibleSavingsKobo,
  activePlans,
  currentStreakDays,
  emailVerified,
  identitySubmitted,
}: {
  readonly eligibleSavingsKobo: Kobo;
  readonly activePlans: number;
  readonly currentStreakDays: number;
  readonly emailVerified: boolean;
  readonly identitySubmitted: boolean;
}) {
  const steps = [
    { label: "Confirm your email address", done: emailVerified, href: "/app/profile" },
    { label: "Verify your identity", done: identitySubmitted, href: "/app/profile" },
    { label: "Activate a daily savings plan", done: false, href: "/app/plans" },
  ] as const;

  return (
    <section
      aria-labelledby="savings-hero-heading"
      className="hero-surface relative overflow-hidden rounded-hero p-6 shadow-hero sm:p-7"
    >
      <div aria-hidden className="hero-grid-lines absolute inset-0 opacity-30" />
      <div
        aria-hidden
        className="absolute -right-24 -top-24 size-72 rounded-full bg-brand-500/20 blur-3xl"
      />

      <div className="relative grid gap-7 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-10">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p
              id="savings-hero-heading"
              className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-white/45"
            >
              Total eligible savings
            </p>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.5rem] font-semibold uppercase tracking-[0.1em] text-white/55">
              Ledger not live
            </span>
          </div>

          <p className="mt-3 text-[2.5rem] font-semibold leading-none tracking-[-0.03em] text-white sm:text-[3rem]">
            <Money value={eligibleSavingsKobo} dimDecimals />
          </p>

          <p className="mt-3 max-w-md text-[0.8125rem] leading-relaxed text-white/55">
            When the ledger is live, this figure is derived from confirmed contributions on eligible
            plans — never from a stored, editable balance.
          </p>

          <div className="mt-6 grid max-w-sm grid-cols-2 gap-3">
            <div className="glass-card rounded-xl px-3.5 py-3">
              <p className="text-[0.5625rem] uppercase tracking-[0.12em] text-white/40">
                Active plans
              </p>
              <p className="mt-1 text-[1.25rem] font-semibold leading-none text-white">
                {activePlans}
              </p>
            </div>
            <div className="glass-card rounded-xl px-3.5 py-3">
              <p className="text-[0.5625rem] uppercase tracking-[0.12em] text-white/40">
                Current streak
              </p>
              <p className="mt-1 text-[1.25rem] font-semibold leading-none text-white">
                {currentStreakDays}
                <span className="ml-1 text-[0.625rem] font-medium text-white/50">days</span>
              </p>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <p className="text-[0.75rem] font-semibold text-white">Your setup</p>
            <span className="text-[0.5625rem] font-semibold uppercase tracking-[0.1em] text-white/40">
              {steps.filter((step) => step.done).length} of {steps.length}
            </span>
          </div>

          <ol className="mt-3 space-y-2.5">
            {steps.map((step) => (
              <li key={step.label} className="flex items-start gap-2.5">
                <span
                  className={cn(
                    "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full",
                    step.done ? "bg-brand-400/25 text-brand-200" : "bg-white/10 text-white/40",
                  )}
                >
                  <Check className="size-2.5" strokeWidth={3} aria-hidden />
                </span>
                <span
                  className={cn(
                    "text-[0.75rem] leading-snug",
                    step.done ? "text-white/45 line-through decoration-white/25" : "text-white/70",
                  )}
                >
                  {step.label}
                </span>
              </li>
            ))}
          </ol>

          <Link
            href="/app/plans"
            className={cn(buttonVariants({ variant: "gold", size: "md" }), "mt-4 w-full")}
          >
            Create a savings plan
            <Plus className="size-4" aria-hidden />
          </Link>
          <Link
            href="/app/eligibility"
            className="mt-2.5 flex items-center justify-center gap-1 text-[0.6875rem] font-medium text-white/50 transition-colors hover:text-white/80"
          >
            How eligibility works
            <ArrowRight className="size-3" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
