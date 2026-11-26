import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  Flame,
  Landmark,
  Lock,
  Receipt,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import Link from "next/link";
import { Money } from "@/components/finance/money";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { PhonePreview } from "@/components/marketing/phone-preview";
import {
  Badge,
  Card,
  SectionHeading,
  buttonVariants,
} from "@/components/ui/primitives";
import { ELIGIBILITY_FACTORS, FAQS, HOW_IT_WORKS, SHOWCASE_PLANS } from "@/lib/content";
import { cn } from "@/lib/cn";
import { disclaimers, siteConfig, trustPoints } from "@/lib/site";

const TRUST_ICONS = [Landmark, Receipt, ShieldCheck, Lock] as const;

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-canvas">
      <MarketingHeader />

      <main id="main">
        {/* ---------------------------------------------------------------- */}
        {/* Hero                                                             */}
        {/* ---------------------------------------------------------------- */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="grid-lines absolute inset-0 opacity-60 [mask-image:radial-gradient(65%_55%_at_50%_0%,black,transparent)]" />
            <div className="absolute -left-32 top-0 size-[30rem] rounded-full bg-brand-200/45 blur-3xl" />
            <div className="absolute -right-24 top-24 size-[26rem] rounded-full bg-accent-500/10 blur-3xl" />
          </div>

          <div className="relative mx-auto grid w-full max-w-6xl gap-14 px-5 pb-16 pt-12 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-10 lg:pb-24 lg:pt-20">
            <div className="animate-rise">
              <Badge variant="brand" className="mb-5">
                Phase 2 · identity live
              </Badge>

              <h1 className="text-balance text-[2.5rem] font-semibold leading-[1.04] tracking-[-0.03em] text-ink-900 sm:text-[3.25rem] lg:text-[3.5rem]">
                Save ₦1,000 a day.
                <br />
                Build a record that{" "}
                <span className="bg-gradient-to-r from-brand-600 to-brand-500 bg-clip-text text-transparent">
                  opens doors.
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-[0.9375rem] leading-relaxed text-muted sm:text-base">
                Daily deposits become a verified savings history. That history — together with
                affordability and policy — informs whether credit is responsible. Not a promise.
                A process you can see.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/sign-up" className={cn(buttonVariants({ variant: "primary", size: "lg" }))}>
                  Create your account
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="/#how-it-works"
                  className={cn(buttonVariants({ variant: "secondary", size: "lg" }))}
                >
                  See how it works
                </Link>
              </div>

              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-line pt-6">
                {[
                  { term: "From", value: "₦1,000", note: "per day" },
                  { term: "Plans", value: "30–365", note: "days" },
                  { term: "Promises", value: "None", note: "on approval" },
                ].map((item) => (
                  <div key={item.term}>
                    <dt className="text-[0.625rem] font-medium uppercase tracking-[0.14em] text-subtle">
                      {item.term}
                    </dt>
                    <dd className="mt-1 text-[1.0625rem] font-semibold tracking-tight text-ink-900">
                      {item.value}
                      <span className="ml-1 text-[0.6875rem] font-medium text-subtle">{item.note}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="relative lg:pl-6">
              <div
                aria-hidden
                className="absolute inset-x-6 top-10 -z-10 h-[80%] rounded-[3rem] bg-gradient-to-b from-brand-200/60 to-transparent blur-2xl"
              />
              <PhonePreview className="animate-rise" />
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Trust strip                                                      */}
        {/* ---------------------------------------------------------------- */}
        <section aria-label="Platform guarantees" className="border-y border-line bg-surface">
          <div className="mx-auto grid w-full max-w-6xl gap-px px-5 py-2 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
            {trustPoints.map((point, index) => {
              const Icon = TRUST_ICONS[index] ?? ShieldCheck;
              return (
                <div key={point.title} className="flex gap-3 py-5 lg:px-5 lg:first:pl-0 lg:last:pr-0">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                    <Icon className="size-4" strokeWidth={1.9} aria-hidden />
                  </span>
                  <div>
                    <p className="text-[0.8125rem] font-semibold text-ink-900">{point.title}</p>
                    <p className="mt-1 text-[0.75rem] leading-relaxed text-muted">{point.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* How it works                                                     */}
        {/* ---------------------------------------------------------------- */}
        <section id="how-it-works" className="mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-20 sm:px-8">
          <SectionHeading
            eyebrow="How it works"
            title="Three steps, no shortcuts"
            description="The product is deliberately simple to use and deliberately strict underneath."
          />

          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {HOW_IT_WORKS.map((step) => (
              <li key={step.step}>
                <Card className="h-full p-6">
                  <span className="text-[0.6875rem] font-semibold tracking-[0.16em] text-brand-700">
                    {step.step}
                  </span>
                  <h3 className="mt-4 text-[1.0625rem] font-semibold tracking-tight text-ink-900">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted">{step.body}</p>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Plans                                                            */}
        {/* ---------------------------------------------------------------- */}
        <section id="plans" className="scroll-mt-20 border-y border-line bg-surface">
          <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
            <SectionHeading
              eyebrow="Savings plans"
              title="Pick a pace you can actually keep"
              description="Amounts and durations are illustrative configurations; administrators manage the live catalogue with limits, grace rules and withdrawal terms."
              action={<Badge variant="neutral">Illustrative</Badge>}
            />

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {SHOWCASE_PLANS.map((plan) => {
                const total = plan.dailyKobo * BigInt(plan.durationDays);
                const featured = plan.featured === true;
                return (
                  <div
                    key={plan.name}
                    className={cn(
                      "relative flex h-full flex-col rounded-card border p-5 transition-transform duration-200 hover:-translate-y-0.5",
                      featured
                        ? "hero-surface border-transparent text-white shadow-hero"
                        : "border-line bg-surface shadow-card",
                    )}
                  >
                    {featured ? (
                      <span className="absolute right-4 top-4 rounded-full bg-white/12 px-2.5 py-1 text-[0.5625rem] font-semibold uppercase tracking-[0.1em] text-brand-200 ring-1 ring-inset ring-white/15">
                        Most chosen
                      </span>
                    ) : null}

                    <p
                      className={cn(
                        "text-[0.6875rem] font-semibold uppercase tracking-[0.14em]",
                        featured ? "text-brand-200" : "text-subtle",
                      )}
                    >
                      {plan.name}
                    </p>

                    <p className="mt-3 flex items-baseline gap-1.5">
                      <Money
                        value={plan.dailyKobo}
                        decimals={0}
                        className={cn(
                          "text-[1.75rem] font-semibold leading-none tracking-[-0.02em]",
                          featured ? "text-white" : "text-ink-900",
                        )}
                      />
                      <span className={cn("text-[0.75rem]", featured ? "text-white/55" : "text-muted")}>
                        / day
                      </span>
                    </p>

                    <p className={cn("mt-1.5 text-[0.75rem]", featured ? "text-white/60" : "text-muted")}>
                      {plan.durationDays} days
                    </p>

                    <div
                      className={cn(
                        "mt-5 rounded-xl px-3 py-2.5",
                        featured ? "bg-white/8" : "bg-canvas",
                      )}
                    >
                      <p
                        className={cn(
                          "text-[0.5625rem] font-medium uppercase tracking-[0.12em]",
                          featured ? "text-white/45" : "text-subtle",
                        )}
                      >
                        Total contributions
                      </p>
                      <p
                        className={cn(
                          "mt-0.5 text-[0.9375rem] font-semibold",
                          featured ? "text-white" : "text-ink-900",
                        )}
                      >
                        <Money value={total} decimals={0} />
                      </p>
                    </div>

                    <p
                      className={cn(
                        "mt-4 flex-1 text-[0.75rem] leading-relaxed",
                        featured ? "text-white/60" : "text-muted",
                      )}
                    >
                      {plan.blurb}
                    </p>

                    <Link
                      href="/app/plans"
                      className={cn(
                        buttonVariants({ variant: featured ? "onDark" : "secondary", size: "sm" }),
                        "mt-5 w-full",
                      )}
                    >
                      Plan details
                      <ArrowUpRight className="size-3.5" />
                    </Link>
                  </div>
                );
              })}
            </div>

            <p className="mt-4 text-[0.6875rem] text-subtle">{disclaimers.illustration}</p>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Eligibility                                                      */}
        {/* ---------------------------------------------------------------- */}
        <section id="eligibility" className="mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-20 sm:px-8">
          <div className="hero-surface relative overflow-hidden rounded-hero p-7 sm:p-10">
            <div aria-hidden className="hero-grid-lines absolute inset-0 opacity-40" />
            <div className="relative grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:gap-14">
              <div>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-brand-300">
                  Credit eligibility
                </p>
                <h2 className="mt-3 text-balance text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-white sm:text-[2rem]">
                  2× and 3× are ceilings. Never entitlements.
                </h2>
                <p className="mt-4 max-w-lg text-[0.875rem] leading-relaxed text-white/65">
                  Your eligible savings define a preliminary ceiling. Affordability, obligations,
                  repayment history, policy and available lending capital define what is actually
                  responsible — and you see which one binds your result.
                </p>

                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  {[
                    { multiple: "2×", label: "Potential ceiling", amount: 18_000_000n },
                    { multiple: "3×", label: "Potential ceiling", amount: 27_000_000n },
                  ].map((tier) => (
                    <div key={tier.multiple} className="glass-card rounded-2xl p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[1.375rem] font-semibold text-white">{tier.multiple}</span>
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.5rem] font-semibold uppercase tracking-[0.1em] text-white/60">
                          Not approval
                        </span>
                      </div>
                      <p className="mt-3 text-[0.5625rem] uppercase tracking-[0.12em] text-white/40">
                        {tier.label}
                      </p>
                      <p className="mt-0.5 text-[1rem] font-semibold text-brand-200">
                        <Money value={tier.amount} decimals={0} />
                      </p>
                    </div>
                  ))}
                </div>

                <p className="mt-4 text-[0.6875rem] leading-relaxed text-white/45">
                  Example assumes ₦90,000 in eligible savings. {disclaimers.credit}
                </p>
              </div>

              <div className="glass-card rounded-2xl p-5 sm:p-6">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-white/45">
                  What the assessment looks at
                </p>
                <ul className="mt-4 space-y-3">
                  {ELIGIBILITY_FACTORS.map((factor) => (
                    <li key={factor} className="flex items-start gap-2.5">
                      <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-brand-400/20 text-brand-300">
                        <Check className="size-2.5" strokeWidth={3} aria-hidden />
                      </span>
                      <span className="text-[0.8125rem] leading-snug text-white/75">{factor}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[0.6875rem] leading-relaxed text-white/55">
                    Every assessment is recorded with the inputs, policy version and engine version
                    used — so a decision can be explained and reviewed later.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Discipline                                                       */}
        {/* ---------------------------------------------------------------- */}
        <section className="border-y border-line bg-surface">
          <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
            <SectionHeading
              eyebrow="Discipline, not gamification"
              title="Streaks that follow the money"
              description="Every streak, badge and calendar mark is derived from confirmed ledger entries. No streak can outrun an unconfirmed payment."
            />

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              <Card className="p-6">
                <span className="grid size-9 place-items-center rounded-xl bg-warn-50 text-warn-500">
                  <Flame className="size-4.5" strokeWidth={1.9} aria-hidden />
                </span>
                <h3 className="mt-4 text-[0.9375rem] font-semibold text-ink-900">Streaks and grace</h3>
                <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">
                  Current and longest streaks, plus grace days you can see being used — never applied
                  silently after the fact.
                </p>
                <div className="mt-5 flex items-center gap-2">
                  <span className="text-[1.5rem] font-semibold tracking-tight text-ink-900">47</span>
                  <span className="text-[0.6875rem] text-muted">day streak</span>
                  <div className="ml-auto flex gap-1" aria-hidden>
                    {Array.from({ length: 7 }, (_, index) => (
                      <span
                        key={index}
                        className={cn(
                          "h-6 w-1.5 rounded-full",
                          index < 5 ? "bg-brand-500" : "bg-line",
                        )}
                      />
                    ))}
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <span className="grid size-9 place-items-center rounded-xl bg-accent-50 text-accent-600">
                  <CalendarDays className="size-4.5" strokeWidth={1.9} aria-hidden />
                </span>
                <h3 className="mt-4 text-[0.9375rem] font-semibold text-ink-900">A truthful calendar</h3>
                <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">
                  Each day shows its real status: paid, multiple contributions, missed, grace, paused
                  or upcoming — one business date per row.
                </p>
                <div className="mt-5 grid grid-cols-7 gap-1" aria-hidden>
                  {["p", "p", "p", "g", "p", "p", "m", "p", "p", "p", "p", "p", "g", "u"].map(
                    (state, index) => (
                      <span
                        key={index}
                        className={cn(
                          "aspect-square rounded-[5px]",
                          state === "p" && "bg-brand-500/85",
                          state === "g" && "bg-gold-500/70",
                          state === "m" && "bg-danger-600/25",
                          state === "u" && "bg-line",
                        )}
                      />
                    ),
                  )}
                </div>
              </Card>

              <Card className="p-6">
                <span className="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-700">
                  <Sparkles className="size-4.5" strokeWidth={1.9} aria-hidden />
                </span>
                <h3 className="mt-4 text-[0.9375rem] font-semibold text-ink-900">Milestones with meaning</h3>
                <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">
                  7, 14, 30, 60, 90, 180 and 365-day marks reward consistency — without implying they
                  unlock a loan.
                </p>
                <div className="mt-5 flex items-center gap-1.5">
                  {["7", "14", "30", "60", "90"].map((day, index) => (
                    <span
                      key={day}
                      className={cn(
                        "grid h-7 min-w-7 place-items-center rounded-full px-1.5 text-[0.5625rem] font-semibold",
                        index < 3
                          ? "bg-ink-900 text-white"
                          : "bg-canvas text-subtle ring-1 ring-line",
                      )}
                    >
                      {day}
                    </span>
                  ))}
                  <span className="ml-1 text-[0.6875rem] text-muted">…365</span>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Security                                                         */}
        {/* ---------------------------------------------------------------- */}
        <section id="security" className="mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-20 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <SectionHeading
              eyebrow="Security architecture"
              title="Built like a ledger, not a wallet screen"
              description="The consumer experience is one layer. Underneath it sits a financial engine designed to be auditable, idempotent and reconciled."
            />

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  icon: Receipt,
                  title: "Double-entry ledger",
                  body: "Every transaction produces balanced entries. Balances are derived, rebuildable and immutable at the original-entry level.",
                },
                {
                  icon: ShieldCheck,
                  title: "Server-verified payments",
                  body: "Contributions are credited only after the provider confirms the reference server-side. Duplicate callbacks are harmless.",
                },
                {
                  icon: Lock,
                  title: "Least-privilege access",
                  body: "Row-level security, permission-based staff roles, and separation of duties between approval and disbursement.",
                },
                {
                  icon: Target,
                  title: "Reconciliation as a feature",
                  body: "Provider settlements are matched to the ledger daily. Exceptions are surfaced, never silently resolved.",
                },
              ].map((item) => (
                <Card key={item.title} className="p-5">
                  <span className="grid size-8 place-items-center rounded-lg bg-ink-900 text-white">
                    <item.icon className="size-4" strokeWidth={1.9} aria-hidden />
                  </span>
                  <h3 className="mt-3.5 text-[0.875rem] font-semibold text-ink-900">{item.title}</h3>
                  <p className="mt-1.5 text-[0.75rem] leading-relaxed text-muted">{item.body}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* FAQ                                                              */}
        {/* ---------------------------------------------------------------- */}
        <section id="faq" className="scroll-mt-20 border-t border-line bg-surface">
          <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
              <SectionHeading
                eyebrow="Questions"
                title="Straight answers"
                description="If something is unclear before you save, that is a product problem — not yours."
                className="self-start"
              />

              <div className="divide-y divide-line border-y border-line">
                {FAQS.map((faq) => (
                  <details key={faq.q} className="group py-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[0.9375rem] font-medium text-ink-900 [&::-webkit-details-marker]:hidden">
                      {faq.q}
                      <span
                        aria-hidden
                        className="grid size-6 shrink-0 place-items-center rounded-full border border-line text-muted transition-transform duration-200 group-open:rotate-45"
                      >
                        +
                      </span>
                    </summary>
                    <p className="mt-3 max-w-[58ch] text-[0.8125rem] leading-relaxed text-muted">
                      {faq.a}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Final CTA                                                        */}
        {/* ---------------------------------------------------------------- */}
        <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
          <div className="hero-surface relative overflow-hidden rounded-hero px-7 py-12 text-center sm:px-12">
            <div aria-hidden className="hero-grid-lines absolute inset-0 opacity-30" />
            <div className="relative mx-auto max-w-xl">
              <h2 className="text-balance text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-white sm:text-[2.125rem]">
                Start with one day. Let the record do the rest.
              </h2>
              <p className="mx-auto mt-3 max-w-md text-[0.875rem] leading-relaxed text-white/60">
                Create an account, complete your profile and verify your identity. Savings figures
                stay at zero until a real ledger exists — that is the point.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Link href="/sign-up" className={cn(buttonVariants({ variant: "gold", size: "lg" }))}>
                  Create your account
                  <ArrowRight className="size-4" />
                </Link>
                <Link href="/design" className={cn(buttonVariants({ variant: "onDark", size: "lg" }))}>
                  View design system
                </Link>
              </div>
              <p className="mt-5 text-[0.625rem] uppercase tracking-[0.18em] text-white/35">
                {siteConfig.tagline}
              </p>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}

