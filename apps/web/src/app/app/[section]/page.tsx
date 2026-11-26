import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Badge,
  Card,
  CardContent,
  buttonVariants,
} from "@/components/ui/primitives";
import { PRIMARY_NAV } from "@/lib/nav";
import { cn } from "@/lib/cn";

type SectionCopy = {
  readonly summary: string;
  readonly bullets: readonly string[];
};

const COPY: Record<string, SectionCopy> = {
  savings: {
    summary:
      "A full view of every eligible savings plan: accumulated balance, days remaining, missed days and grace usage.",
    bullets: [
      "Plan-by-plan balances derived from confirmed contributions",
      "Contribution history with provider references",
      "Pause, resume and eligible withdrawal requests",
    ],
  },
  plans: {
    summary:
      "Choose a predefined plan or build a custom daily amount, duration and goal — with the total, end date and rules shown before confirmation.",
    bullets: [
      "Starter, Growth, Builder and Power presets plus custom plans",
      "Duration from 30 to 365 days within administered limits",
      "Informed confirmation of grace, missed-day and withdrawal rules",
    ],
  },
  calendar: {
    summary:
      "Every business day of your plan, with its real status: paid, multiple, missed, grace, paused or upcoming.",
    bullets: [
      "Month and plan-duration views",
      "Historical contributions per day",
      "Explicit grace days — never applied silently",
    ],
  },
  eligibility: {
    summary:
      "Understand your potential credit ceilings, the factors that shape them, and which constraint is limiting your result.",
    bullets: [
      "Eligible savings and 2× / 3× potential ceilings",
      "Affordability and obligations assessment",
      "Recorded, explainable and reviewable decisions",
    ],
  },
  loans: {
    summary:
      "Apply for credit within your assessed limit, track each application and review the offer terms before accepting.",
    bullets: [
      "Application states from draft to disbursed",
      "Offer breakdown: principal, interest, fees, total payable",
      "Guarantor and collateral requirements where applicable",
    ],
  },
  repayments: {
    summary:
      "Your repayment schedule, amounts paid, outstanding balance and receipts — generated from the approved loan terms.",
    bullets: [
      "Installment-by-installment schedule",
      "Partial payments and rescheduling",
      "Overdue tracking under a lawful collection policy",
    ],
  },
  transactions: {
    summary:
      "The financial record: contributions, withdrawals, disbursements and repayments, each with a reference and status.",
    bullets: [
      "Server-verified status for every movement",
      "Ledger references and reconciliation state",
      "Downloadable receipts",
    ],
  },
  notifications: {
    summary:
      "Reminders, confirmations and account updates across in-app, email and SMS — with your preferences in control.",
    bullets: [
      "Savings reminders at a time you choose",
      "Payment and loan status updates",
      "Security alerts that cannot be muted",
    ],
  },
  profile: {
    summary:
      "Your personal details, verification levels and financial profile, kept to the minimum the product actually needs.",
    bullets: [
      "Identity verification status (BVN/NIN via an authorised vendor)",
      "Contact details and bank account for permitted operations",
      "Consent records and data rights requests",
    ],
  },
  security: {
    summary:
      "Password, multi-factor authentication, active sessions and the alerts that tell you when something changes.",
    bullets: [
      "TOTP-based MFA",
      "Session and device review",
      "Sensitive-change confirmations",
    ],
  },
  support: {
    summary:
      "Raise a ticket by category, attach documents securely and follow the resolution from your account.",
    bullets: [
      "Savings, payments, loans, verification and security categories",
      "Secure document attachments",
      "Ticket status and response history",
    ],
  },
};

export const dynamicParams = false;

export function generateStaticParams() {
  // Routes that now have real implementations must not also be prerendered as
  // placeholders.
  const implemented = new Set([
    "savings",
    "plans",
    "calendar",
    "eligibility",
    "withdrawals",
    "transactions",
    "profile",
    "security",
  ]);
  return PRIMARY_NAV.filter(
    (item) => item.href !== "/app" && !implemented.has(item.href.replace("/app/", "")),
  ).map((item) => ({
    section: item.href.replace("/app/", ""),
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}): Promise<Metadata> {
  const { section } = await params;
  const item = PRIMARY_NAV.find((entry) => entry.href === `/app/${section}`);
  return { title: item?.label ?? "Not found" };
}

export default async function SectionPlaceholderPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const item = PRIMARY_NAV.find((entry) => entry.href === `/app/${section}`);
  const copy = COPY[section];

  if (!item || !copy) notFound();

  return (
    <div className="animate-rise">
      <Link
        href="/app"
        className="inline-flex items-center gap-1.5 text-[0.75rem] font-medium text-muted transition-colors hover:text-ink-900"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Overview
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
            <item.icon className="size-5" strokeWidth={1.9} aria-hidden />
          </span>
          <div>
            <h1 className="text-[1.5rem] font-semibold tracking-[-0.02em] text-ink-900">
              {item.label}
            </h1>
            <p className="mt-1 max-w-xl text-[0.8125rem] leading-relaxed text-muted">
              {copy.summary}
            </p>
          </div>
        </div>
        <Badge variant="warning">Arrives in Phase {item.phase}</Badge>
      </div>

      <Card className="mt-6">
        <CardContent>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-subtle">
            What this screen will contain
          </p>
          <ul className="mt-3 space-y-2.5">
            {copy.bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-2.5">
                <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                  <Check className="size-2.5" strokeWidth={3} aria-hidden />
                </span>
                <span className="text-[0.8125rem] leading-relaxed text-body">{bullet}</span>
              </li>
            ))}
          </ul>

          <div className="mt-5 rounded-xl border border-line bg-canvas p-4">
            <p className="text-[0.75rem] font-medium text-ink-900">Why this page exists now</p>
            <p className="mt-1 text-[0.75rem] leading-relaxed text-muted">
              The shell ships ahead of the data. Every destination resolves to a real page that
              states its status — no dead links and no mocked financial data.
            </p>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/app" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
              Back to overview
            </Link>
            <Link href="/design" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Design system
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
