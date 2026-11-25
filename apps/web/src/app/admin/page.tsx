import { ArrowRight, Info } from "lucide-react";
import Link from "next/link";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  buttonVariants,
} from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

const KPIS = [
  { label: "Registered users", note: "identity" },
  { label: "Verified users", note: "KYC" },
  { label: "Active savers", note: "savings" },
  { label: "Eligible savings", note: "ledger" },
  { label: "Active loans", note: "credit" },
  { label: "Outstanding principal", note: "credit" },
  { label: "Recon. exceptions", note: "finance" },
  { label: "Platform revenue", note: "finance" },
] as const;

const QUEUES = [
  { label: "Withdrawal requests", detail: "Awaiting finance approval" },
  { label: "Loan applications", detail: "Awaiting credit review" },
  { label: "KYC backlog", detail: "Awaiting verification" },
  { label: "Reconciliation exceptions", detail: "Awaiting investigation" },
] as const;

export default function AdminOverviewPage() {
  return (
    <div className="animate-rise">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.5rem] font-semibold tracking-[-0.02em] text-ink-900">
            Portfolio overview
          </h1>
          <p className="mt-1 text-[0.8125rem] text-muted">
            Operations, credit and finance health — every figure traceable to a query.
          </p>
        </div>
        <Badge variant="neutral">No data layer connected</Badge>
      </div>

      <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-warn-500/25 bg-warn-50 p-3.5">
        <Info className="mt-0.5 size-4 shrink-0 text-warn-500" strokeWidth={2} aria-hidden />
        <p className="text-[0.75rem] leading-relaxed text-[#7a5300]">
          This console is a Phase 1 shell. Analytics arrive in Phase 10, backed by ledger and
          reconciliation views. Placeholders below are intentionally empty rather than populated with
          sample figures.
        </p>
      </div>

      <section aria-label="Key metrics" className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {KPIS.map((kpi) => (
          <Card key={kpi.label} className="p-4">
            <p className="text-[0.625rem] font-medium uppercase tracking-[0.1em] text-subtle">
              {kpi.label}
            </p>
            <p className="mt-2 text-[1.5rem] font-semibold leading-none text-line-strong">—</p>
            <p className="mt-2 text-[0.625rem] text-subtle">Source: {kpi.note}</p>
          </Card>
        ))}
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Operational queues</CardTitle>
              <p className="mt-1 text-[0.75rem] text-muted">
                Work that needs a human decision, oldest first.
              </p>
            </div>
            <Badge variant="neutral">0 open</Badge>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-line">
              {QUEUES.map((queue) => (
                <li key={queue.label} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-[0.8125rem] font-medium text-ink-900">{queue.label}</p>
                    <p className="text-[0.6875rem] text-muted">{queue.detail}</p>
                  </div>
                  <span className="rounded-full bg-canvas px-2.5 py-1 text-[0.6875rem] font-semibold text-subtle ring-1 ring-line">
                    0
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Originations vs repayments</CardTitle>
              <p className="mt-1 text-[0.75rem] text-muted">Portfolio cash flow, by period.</p>
            </div>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={ArrowRight}
              title="Awaiting financial data"
              description="This chart reads from loan, repayment and ledger tables once Phase 4 and Phase 9 are live."
              action={
                <Link
                  href="/admin/finance"
                  className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                >
                  Finance module
                </Link>
              }
            />
          </CardContent>
        </Card>
      </div>

      <p className="mt-6 text-[0.625rem] leading-relaxed text-subtle">
        Access to this console requires staff authentication, permission-based authorisation and
        separation of duties (Phase 2 / Phase 10). Until then it is an unauthenticated design shell
        in a preview build — it must not be deployed as a live operations tool.
      </p>
    </div>
  );
}
