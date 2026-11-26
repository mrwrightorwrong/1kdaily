import type { Metadata } from "next";
import { Money } from "@/components/finance/money";
import { Badge, Card, CardContent, buttonVariants } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { getPermissions, requireUser } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { decideLoanAction, disburseLoanAction } from "@/server/actions/admin-loans";

export const metadata: Metadata = { title: "Loan applications", robots: { index: false } };

type Application = {
  id: string;
  reference: string;
  status: string;
  requested_amount_kobo: string;
  tenor_months: number;
  created_at: string;
  loan_products: { name: string } | null;
  loan_offers: Array<{ principal_kobo: string; net_disbursed_kobo: string }> | null;
};

const VARIANT: Record<string, "warning" | "success" | "danger" | "info" | "neutral"> = {
  submitted: "warning",
  under_review: "warning",
  approved: "info",
  rejected: "danger",
  disbursed: "success",
  awaiting_disbursement: "info",
};

export default async function AdminLoansPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; done?: string }>;
}) {
  await requireUser();
  const permissions = await getPermissions();
  const canReview = permissions.includes("loans:review") || permissions.includes("loans:approve");
  const canDisburse = permissions.includes("loans:disburse");
  const query = await searchParams;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("loan_applications")
    .select("id, reference, status, requested_amount_kobo, tenor_months, created_at, loan_products(name), loan_offers(principal_kobo, net_disbursed_kobo)")
    .in("status", ["submitted", "under_review", "approved", "awaiting_disbursement", "disbursed", "rejected"])
    .order("created_at", { ascending: false })
    .limit(50);

  const applications = (data ?? []) as unknown as Application[];

  return (
    <div className="animate-rise space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.5rem] font-semibold tracking-[-0.02em] text-ink-900">
            Loan applications
          </h1>
          <p className="mt-1 text-[0.8125rem] text-muted">
            Approval and disbursement are separate permissions; one officer cannot do both.
          </p>
        </div>
        <Badge variant="danger">Restricted</Badge>
      </div>

      {query.error ? (
        <div role="alert" className="rounded-xl border border-danger-600/25 bg-danger-50 px-3.5 py-3 text-[0.75rem] text-[#8f1d1d]">
          {query.error}
        </div>
      ) : null}
      {query.done ? (
        <div role="status" className="rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-3 text-[0.75rem] text-brand-800">
          Recorded: {query.done}.
        </div>
      ) : null}

      <Card>
        <CardContent className="p-0">
          {applications.length === 0 ? (
            <p className="p-8 text-center text-[0.8125rem] text-muted">No applications yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[60rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line text-[0.625rem] uppercase tracking-[0.08em] text-subtle">
                    <th className="px-4 py-3 font-semibold">Reference</th>
                    <th className="px-4 py-3 font-semibold">Product</th>
                    <th className="px-4 py-3 font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">Net</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((application) => {
                    const offer = application.loan_offers?.[0];
                    return (
                      <tr key={application.id} className="border-b border-line align-top last:border-0">
                        <td className="px-4 py-3 font-mono text-[0.625rem] text-muted">{application.reference}</td>
                        <td className="px-4 py-3 text-[0.8125rem] text-ink-900">
                          {application.loan_products?.name ?? "—"}
                          <span className="block text-[0.625rem] text-subtle">{application.tenor_months} months</span>
                        </td>
                        <td className="px-4 py-3 text-[0.8125rem] font-semibold text-ink-900">
                          <Money value={BigInt(application.requested_amount_kobo)} decimals={0} />
                        </td>
                        <td className="px-4 py-3 text-[0.8125rem] text-ink-900">
                          {offer ? <Money value={BigInt(offer.net_disbursed_kobo)} decimals={0} /> : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={VARIANT[application.status] ?? "neutral"}>
                            {application.status.replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {canReview && ["submitted", "under_review"].includes(application.status) ? (
                            <div className="space-y-2">
                              <form action={decideLoanAction} className="flex flex-wrap gap-1.5">
                                <input type="hidden" name="application_id" value={application.id} />
                                <input
                                  name="reason"
                                  placeholder="Reason (min 10 chars)"
                                  className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 text-[0.6875rem]"
                                />
                                <button name="decision" value="approve" className={cn(buttonVariants({ variant: "primary", size: "sm" }))}>
                                  Approve
                                </button>
                                <button name="decision" value="reject" className={cn(buttonVariants({ variant: "danger", size: "sm" }))}>
                                  Reject
                                </button>
                              </form>
                            </div>
                          ) : null}

                          {canDisburse && ["approved", "awaiting_disbursement"].includes(application.status) ? (
                            <form action={disburseLoanAction} className="mt-2 flex flex-wrap gap-1.5">
                              <input type="hidden" name="application_id" value={application.id} />
                              <input
                                name="provider_reference"
                                placeholder="Transfer reference"
                                className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 text-[0.6875rem]"
                              />
                              <button className={cn(buttonVariants({ variant: "dark", size: "sm" }))}>
                                Disburse
                              </button>
                            </form>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-[0.625rem] leading-relaxed text-subtle">
        Disbursement posts Dr receivable, Cr cash (net), Cr fee income and Cr insurance payable, then
        materialises the frozen repayment schedule. Every decision is audited.
      </p>
    </div>
  );
}
