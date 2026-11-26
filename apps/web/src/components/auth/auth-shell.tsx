import Link from "next/link";
import type { ReactNode } from "react";
import { Logo, LogoMark } from "@/components/brand/logo";
import { Badge } from "@/components/ui/primitives";

const PROMISES = [
  "Your savings record is built from verified contributions only.",
  "Balances come from an auditable double-entry ledger.",
  "A potential credit ceiling is never a promise of approval.",
] as const;

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  badge,
}: {
  readonly title: string;
  readonly subtitle: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly badge?: string;
}) {
  return (
    <main id="main" className="grid min-h-dvh lg:grid-cols-[1.02fr_0.98fr]">
      <aside className="hero-surface relative hidden flex-col justify-between overflow-hidden p-10 lg:flex">
        <div aria-hidden className="hero-grid-lines absolute inset-0 opacity-30" />
        <div aria-hidden className="absolute -right-24 top-32 size-80 rounded-full bg-brand-500/20 blur-3xl" />

        <div className="relative">
          <Logo tone="dark" size="md" />
        </div>

        <div className="relative max-w-md">
          <LogoMark className="size-12 rounded-2xl" />
          <h2 className="mt-6 text-balance text-[2rem] font-semibold leading-tight tracking-[-0.02em] text-white">
            Save daily. Build a record you can point to.
          </h2>
          <p className="mt-3 text-[0.875rem] leading-relaxed text-white/60">
            1kDaily turns consistent saving into a verifiable financial history — and treats credit
            as a decision to be earned, not a promise to be made.
          </p>

          <ul className="mt-7 space-y-3">
            {PROMISES.map((promise) => (
              <li key={promise} className="flex items-start gap-2.5">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-400" aria-hidden />
                <span className="text-[0.8125rem] leading-relaxed text-white/70">{promise}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative space-y-3">
          <Badge variant="onDark">Partner-held funds · NDPA-aligned design</Badge>
          <p className="text-[0.625rem] leading-relaxed text-white/35">
            No payments are collected in this build. Identity verification uses a mock provider
            locally; no real BVN or NIN is stored.
          </p>
        </div>
      </aside>

      <section className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[23rem]">
          <div className="mb-8 lg:hidden">
            <Logo size="md" />
          </div>

          {badge ? (
            <Badge variant="brand" className="mb-3">
              {badge}
            </Badge>
          ) : null}

          <h1 className="text-[1.75rem] font-semibold tracking-[-0.02em] text-ink-900">{title}</h1>
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted">{subtitle}</p>

          <div className="mt-7">{children}</div>

          {footer ? <div className="mt-6 text-[0.75rem] text-muted">{footer}</div> : null}

          <p className="mt-8 text-[0.625rem] leading-relaxed text-subtle">
            By continuing you agree to our{" "}
            <Link href="/legal/terms" className="underline hover:text-ink-900">
              terms
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="underline hover:text-ink-900">
              privacy notice
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
