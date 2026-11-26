import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, CardContent } from "@/components/ui/primitives";
import { ADMIN_NAV } from "@/lib/nav";

const COPY: Record<string, string> = {
  users: "Search, verify, review and restrict accounts — with KYC data behind a restricted permission and every action audited.",
  savings: "Plans, contribution records, withdrawal requests and contribution exceptions, filterable by status and period.",
  loans: "The review pipeline: applications, affordability, offers, approvals, disbursement and closure — with separation of duties.",
  finance: "The ledger, reconciliation runs, exceptions, reversals, refunds and settlement records. Nothing auto-resolves.",
  risk: "Risk policies, indicators, review queues and the history of every assessment decision.",
  reports: "Savings, contribution, withdrawal, loan, repayment, overdue, reconciliation and risk reports with permissioned CSV/PDF export.",
  settings: "Plan limits, durations, grace policies, loan products, interest rules, multipliers and provider configuration — audited and Super-admin only.",
};

export const dynamicParams = false;

export function generateStaticParams() {
  return ADMIN_NAV.filter((item) => item.href !== "/admin").map((item) => ({
    section: item.href.replace("/admin/", ""),
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}): Promise<Metadata> {
  const { section } = await params;
  const item = ADMIN_NAV.find((entry) => entry.href === `/admin/${section}`);
  return { title: item?.label ?? "Not found", robots: { index: false, follow: false } };
}

export default async function AdminSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const item = ADMIN_NAV.find((entry) => entry.href === `/admin/${section}`);
  const copy = COPY[section];
  if (!item || !copy) notFound();

  return (
    <div className="animate-rise">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-[0.75rem] font-medium text-muted transition-colors hover:text-ink-900"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Portfolio overview
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.5rem] font-semibold tracking-[-0.02em] text-ink-900">{item.label}</h1>
          <p className="mt-1 max-w-2xl text-[0.8125rem] leading-relaxed text-muted">{copy}</p>
        </div>
        <Badge variant="danger">Restricted · Phase 10</Badge>
      </div>

      <Card className="mt-6">
        <CardContent>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-subtle">
            Not yet implemented
          </p>
          <p className="mt-2 max-w-2xl text-[0.8125rem] leading-relaxed text-body">
            This module requires authenticated staff access, permission checks and audited server
            actions before it can display or change financial data. It is intentionally empty in the
            The current build shows the shell rather than invented figures.
          </p>
          <Link
            href="/admin"
            className="mt-4 inline-block text-[0.75rem] font-semibold text-brand-700 hover:underline"
          >
            Back to portfolio overview
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
