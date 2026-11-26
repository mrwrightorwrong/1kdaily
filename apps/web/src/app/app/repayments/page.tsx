import type { Metadata } from "next";
import Link from "next/link";
import { Receipt } from "lucide-react";
import { Money } from "@/components/finance/money";
import { Badge, Card, CardContent, EmptyState, buttonVariants } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { requireProfile } from "@/server/auth/session";

export const metadata: Metadata = { title: "Repayments" };

type Installment = {
  id: string;
  installment_number: number;
  due_date: string;
  principal_kobo: string;
  interest_kobo: string;
  total_kobo: string;
  paid_kobo: string;
  status: string;
  loan_applications: { reference: string; status: string } | null;
};

const VARIANT: Record<string, "success" | "warning" | "danger" | "neutral" | "info"> = {
  paid: "success",
  due: "warning",
  overdue: "danger",
  partially_paid: "info",
  upcoming: "neutral",
  rescheduled: "neutral",
};

export default async function RepaymentsPage() {
  await requireProfile();
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("loan_repayment_schedules")
    .select(
      "id, installment_number, due_date, principal_kobo, interest_kobo, total_kobo, paid_kobo, status, loan_applications(reference, status)",
    )
    .order("due_date", { ascending: true })
    .limit(120);

  const installments = (data ?? []) as unknown as Installment[];

  const outstanding = installments
    .filter((entry) => entry.status !== "paid")
    .reduce((total, entry) => total + BigInt(entry.total_kobo) - BigInt(entry.paid_kobo), 0n);

  const next = installments.find((entry) => entry.status !== "paid");

  return (
    <div className="animate-rise space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.5rem] font-semibold tracking-[-0.02em] text-ink-900">Repayments</h1>
          <p className="mt-1 text-[0.8125rem] text-muted">
            The schedule created when your loan was disbursed.
          </p>
        </div>
        <Link href="/app/loans" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
          My loans
        </Link>
      </div>

      {installments.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={Receipt}
              title="No repayment schedule"
              description="A schedule appears here once a loan is disbursed. Nothing is owed before that."
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-[0.5625rem] uppercase tracking-[0.1em] text-subtle">Outstanding</p>
              <p className="mt-1 text-[1.375rem] font-semibold text-ink-900">
                <Money value={outstanding} dimDecimals />
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-[0.5625rem] uppercase tracking-[0.1em] text-subtle">Next payment</p>
              <p className="mt-1 text-[1.375rem] font-semibold text-ink-900">
                {next ? <Money value={BigInt(next.total_kobo)} dimDecimals /> : "—"}
              </p>
              <p className="mt-0.5 text-[0.625rem] text-muted">
                {next
                  ? new Date(next.due_date).toLocaleDateString("en-NG", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "All settled"}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-[0.5625rem] uppercase tracking-[0.1em] text-subtle">Installments</p>
              <p className="mt-1 text-[1.375rem] font-semibold text-ink-900">
                {installments.filter((entry) => entry.status === "paid").length}
                <span className="ml-1 text-[0.75rem] font-medium text-muted">
                  of {installments.length}
                </span>
              </p>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[46rem] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-line text-[0.625rem] uppercase tracking-[0.08em] text-subtle">
                      <th className="px-4 py-3 font-semibold">#</th>
                      <th className="px-4 py-3 font-semibold">Due</th>
                      <th className="px-4 py-3 font-semibold">Principal</th>
                      <th className="px-4 py-3 font-semibold">Interest</th>
                      <th className="px-4 py-3 font-semibold">Total</th>
                      <th className="px-4 py-3 font-semibold">Paid</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {installments.map((entry) => (
                      <tr key={entry.id} className="border-b border-line last:border-0">
                        <td className="px-4 py-3 text-[0.6875rem] text-subtle">{entry.installment_number}</td>
                        <td className="px-4 py-3 text-[0.75rem] text-muted">
                          {new Date(entry.due_date).toLocaleDateString("en-NG", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-3 text-[0.8125rem] text-ink-900">
                          <Money value={BigInt(entry.principal_kobo)} decimals={0} />
                        </td>
                        <td className="px-4 py-3 text-[0.8125rem] text-ink-900">
                          <Money value={BigInt(entry.interest_kobo)} decimals={0} />
                        </td>
                        <td className="px-4 py-3 text-[0.8125rem] font-semibold text-ink-900">
                          <Money value={BigInt(entry.total_kobo)} decimals={0} />
                        </td>
                        <td className="px-4 py-3 text-[0.8125rem] text-muted">
                          <Money value={BigInt(entry.paid_kobo)} decimals={0} />
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={VARIANT[entry.status] ?? "neutral"}>
                            {entry.status.replace(/_/g, " ")}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          <p className="text-[0.625rem] leading-relaxed text-subtle">
            Repayment capture and provider verification are the next increment. This view reads the
            schedule materialised at disbursement; it does not create payments.
          </p>
        </>
      )}
    </div>
  );
}
