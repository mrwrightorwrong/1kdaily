import { Home, PiggyBank, Plus, User } from "lucide-react";
import { Money } from "@/components/finance/money";
import { fromKobo } from "@1kdaily/core";
import { cn } from "@/lib/cn";

const DAILY = fromKobo(100_000); // ₦1,000
const DAYS = 90;
const DAYS_SAVED = 47;
const SAVED = DAILY * BigInt(DAYS_SAVED);
const TARGET = DAILY * BigInt(DAYS);
const PROGRESS = Math.round((DAYS_SAVED / DAYS) * 100);

const week = [
  { day: "M", done: true },
  { day: "T", done: true },
  { day: "W", done: true },
  { day: "T", done: true },
  { day: "F", done: false },
  { day: "S", done: false },
  { day: "S", done: false },
] as const;

/**
 * Marketing device frame. The figures are a single, internally consistent
 * example (47 × ₦1,000 of 90 × ₦1,000) and are labelled as illustrative —
 * this is product imagery, never account data.
 */
export function PhonePreview({ className }: { readonly className?: string }) {
  return (
    <figure className={cn("relative mx-auto w-full max-w-[336px]", className)}>
      <div className="rounded-[2.75rem] border border-ink-900/10 bg-ink-900 p-2.5 shadow-[0_40px_90px_-40px_rgba(11,23,57,0.65)]">
        <div className="overflow-hidden rounded-[2.25rem] bg-canvas">
          <div className="hero-surface px-5 pb-5 pt-4">
            <div className="flex items-center justify-between text-[0.5625rem] font-medium tracking-wide text-white/45">
              <span>9:41</span>
              <span>WAT · Nigeria</span>
            </div>

            <div className="mt-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.5625rem] font-medium uppercase tracking-[0.18em] text-white/45">
                  Total savings
                </p>
                <p className="mt-1.5 text-[1.875rem] font-semibold leading-none tracking-[-0.02em] text-white">
                  <Money value={SAVED} dimDecimals />
                </p>
              </div>
              <span className="rounded-full bg-brand-400/15 px-2.5 py-1 text-[0.5625rem] font-semibold uppercase tracking-[0.1em] text-brand-200 ring-1 ring-inset ring-brand-300/25">
                Active
              </span>
            </div>

            <div className="mt-5">
              <div className="flex items-baseline justify-between text-[0.625rem]">
                <span className="text-white/60">Growth plan · ₦1,000/day</span>
                <span className="font-semibold text-white">{PROGRESS}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/12">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-300"
                  style={{ width: `${PROGRESS}%` }}
                />
              </div>
              <p className="mt-2 text-[0.5625rem] text-white/45">
                {DAYS_SAVED} of {DAYS} days · <Money value={TARGET} className="text-white/60" />
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="glass-card rounded-xl px-3 py-2.5">
                <p className="text-[0.5rem] uppercase tracking-[0.14em] text-white/45">Streak</p>
                <p className="mt-0.5 text-[0.9375rem] font-semibold text-white">
                  {DAYS_SAVED} <span className="text-[0.625rem] font-medium text-white/50">days</span>
                </p>
              </div>
              <div className="glass-card rounded-xl px-3 py-2.5">
                <p className="text-[0.5rem] uppercase tracking-[0.14em] text-white/45">Next</p>
                <p className="mt-0.5 text-[0.9375rem] font-semibold text-white">
                  <Money value={DAILY} />
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 px-5 py-4">
            <div className="flex items-center justify-between">
              <p className="text-[0.6875rem] font-semibold text-ink-900">This week</p>
              <p className="text-[0.5625rem] text-muted">Mon 23 — Sun 29 Nov</p>
            </div>
            <div className="flex justify-between gap-1.5">
              {week.map((entry, index) => (
                <div key={index} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-[0.5rem] font-medium text-subtle">{entry.day}</span>
                  <span
                    className={cn(
                      "grid size-7 place-items-center rounded-full text-[0.5625rem] font-semibold",
                      entry.done
                        ? "bg-brand-600 text-white"
                        : "bg-white text-subtle ring-1 ring-line",
                    )}
                  >
                    {entry.done ? "✓" : "·"}
                  </span>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-line bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="text-[0.5625rem] font-semibold uppercase tracking-[0.12em] text-subtle">
                  Potential ceiling
                </p>
                <span className="text-[0.5rem] text-subtle">not approval</span>
              </div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <p className="text-[0.875rem] font-semibold text-ink-900">
                  <Money value={SAVED * 2n} compact />
                </p>
                <span className="text-[0.5rem] font-medium text-muted">2× eligible savings</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-around border-t border-line bg-white px-4 py-3">
            {[Home, PiggyBank, Plus, User].map((Icon, index) => (
              <span
                key={index}
                className={cn(
                  "grid size-8 place-items-center rounded-full",
                  index === 1 ? "bg-brand-50 text-brand-700" : "text-subtle",
                )}
              >
                <Icon className="size-4" strokeWidth={1.75} />
              </span>
            ))}
          </div>
        </div>
      </div>

      <figcaption className="mt-4 text-center text-[0.6875rem] text-subtle">
        Illustrative example — not live account data.
      </figcaption>
    </figure>
  );
}
