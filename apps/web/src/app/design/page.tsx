import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Money } from "@/components/finance/money";
import { DailyInlineLoader } from "@/components/brand/loaders";
import { LogoMark } from "@/components/brand/logo";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Progress,
  Skeleton,
  buttonVariants,
} from "@/components/ui/primitives";
import { fromKobo } from "@1kdaily/core";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Design system",
  description: "1kDaily design tokens and component inventory (internal reference).",
  robots: { index: false, follow: false },
};

const BRAND_SCALE = [
  ["brand-50", "#ecfdf5"],
  ["brand-100", "#d1fae5"],
  ["brand-200", "#a7f3d0"],
  ["brand-300", "#6ee7b7"],
  ["brand-400", "#34d399"],
  ["brand-500", "#10b981"],
  ["brand-600", "#16a34a"],
  ["brand-700", "#15803d"],
  ["brand-800", "#166534"],
  ["brand-900", "#14532d"],
] as const;

const CORE_TOKENS = [
  ["ink-900", "#0b1739"],
  ["body", "#172033"],
  ["muted", "#64748b"],
  ["line", "#e4e9f2"],
  ["canvas", "#f6f8fc"],
  ["accent-600", "#2563eb"],
  ["gold-500", "#f5b942"],
  ["danger-600", "#dc2626"],
  ["warn-500", "#f59e0b"],
  ["info-500", "#0ea5e9"],
] as const;

const BUTTON_VARIANTS = [
  "primary",
  "dark",
  "secondary",
  "outline",
  "ghost",
  "gold",
  "danger",
] as const;

function Swatch({ name, hex }: { name: string; hex: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <div className="h-12 w-full" style={{ backgroundColor: hex }} />
      <div className="bg-surface px-2.5 py-2">
        <p className="text-[0.625rem] font-semibold text-ink-900">{name}</p>
        <p className="text-[0.5625rem] uppercase text-subtle">{hex}</p>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-3 border-b border-line py-4 last:border-0 sm:grid-cols-[10rem_1fr]">
      <p className="text-[0.6875rem] font-medium uppercase tracking-[0.1em] text-subtle">{label}</p>
      <div>{children}</div>
    </div>
  );
}

export default function DesignSystemPage() {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <LogoMark className="size-7" />
            <span className="text-[0.8125rem] font-semibold text-ink-900">Design system</span>
            <Badge variant="brand">Internal</Badge>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[0.75rem] font-medium text-muted hover:text-ink-900"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Home
          </Link>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-5xl px-5 py-10">
        <h1 className="text-[1.75rem] font-semibold tracking-[-0.02em] text-ink-900">
          Design foundations
        </h1>
        <p className="mt-2 max-w-2xl text-[0.875rem] leading-relaxed text-muted">
          Tokens and primitives used across the consumer app and the operations console. Three rules
          are non-negotiable: green never represents money, gold is reserved for milestones, and every
          amount uses tabular numerals.
        </p>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Colour</CardTitle>
            <Badge variant="neutral">10 + 10 tokens</Badge>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <p className="mb-2 text-[0.625rem] font-medium uppercase tracking-[0.1em] text-subtle">
                Brand — growth
              </p>
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
                {BRAND_SCALE.map(([name, hex]) => (
                  <Swatch key={name} name={name} hex={hex} />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[0.625rem] font-medium uppercase tracking-[0.1em] text-subtle">
                Core and semantic
              </p>
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
                {CORE_TOKENS.map(([name, hex]) => (
                  <Swatch key={name} name={name} hex={hex} />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Typography and money</CardTitle>
            <Badge variant="neutral">Inter variable</Badge>
          </CardHeader>
          <CardContent>
            <Row label="Display">
              <p className="text-[2.5rem] font-semibold leading-tight tracking-[-0.03em] text-ink-900">
                Build capacity
              </p>
            </Row>
            <Row label="Page heading">
              <p className="text-[1.5rem] font-semibold tracking-[-0.02em] text-ink-900">
                Overview
              </p>
            </Row>
            <Row label="Section">
              <p className="text-[0.9375rem] font-semibold text-ink-900">Savings growth</p>
            </Row>
            <Row label="Body">
              <p className="text-[0.875rem] leading-relaxed text-body">
                Daily contributions become a verified savings history.
              </p>
            </Row>
            <Row label="Supporting">
              <p className="text-[0.75rem] text-muted">Updated after server-side verification.</p>
            </Row>
            <Row label="Financial">
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                <Money value={fromKobo(0)} className="text-[2rem] font-semibold text-ink-900" />
                <Money
                  value={fromKobo(125_050)}
                  className="text-[1.25rem] font-semibold text-ink-900"
                />
                <Money
                  value={fromKobo(900_000_000)}
                  compact
                  className="text-[1.25rem] font-semibold text-ink-900"
                />
                <span className="text-[0.75rem] text-muted">
                  ₦0.00 · ₦1,250.50 · ₦9m (compact)
                </span>
              </div>
            </Row>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Actions and status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              {BUTTON_VARIANTS.map((variant) => (
                <Button key={variant} variant={variant} size="sm">
                  {variant}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="brand">Active</Badge>
              <Badge variant="success">Confirmed</Badge>
              <Badge variant="warning">Pending</Badge>
              <Badge variant="danger">Overdue</Badge>
              <Badge variant="info">Info</Badge>
              <Badge variant="gold">Milestone</Badge>
              <Badge variant="neutral">Draft</Badge>
              <Badge variant="outline">Outline</Badge>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-line p-4">
                <p className="text-[0.6875rem] text-muted">Progress</p>
                <p className="mb-2 mt-1 text-[1.125rem] font-semibold text-ink-900">52%</p>
                <Progress value={52} label="Example progress" />
              </div>
              <div className="rounded-xl border border-line p-4">
                <p className="text-[0.6875rem] text-muted">Progress (milestone)</p>
                <p className="mb-2 mt-1 text-[1.125rem] font-semibold text-ink-900">3 of 7</p>
                <Progress value={43} label="Example milestone progress" tone="gold" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Empty state</CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={ArrowLeft}
                title="No active savings plan"
                description="A designed empty state is a product surface, not a placeholder."
                action={
                  <Link
                    href="/app/plans"
                    className={cn(buttonVariants({ variant: "primary", size: "sm" }))}
                  >
                    Choose a plan
                  </Link>
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Loading</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <DailyInlineLoader label="Verifying payment" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              <div className="hero-surface rounded-xl p-4">
                <p className="text-[0.6875rem] uppercase tracking-[0.14em] text-white/40">
                  Hero surface
                </p>
                <p className="mt-1 text-[1.25rem] font-semibold text-white">
                  <Money value={fromKobo(4_700_000)} dimDecimals />
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <p className="mt-8 text-[0.6875rem] leading-relaxed text-subtle">
          Accessibility: focus rings use brand-600 at 2px with 2px offset; muted text on canvas
          meets 4.5:1; all motion respects <code>prefers-reduced-motion</code>; charts always have a
          text alternative; every interactive target is at least 40px.
        </p>
      </main>
    </div>
  );
}
