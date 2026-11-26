import type { Metadata } from "next";
import Link from "next/link";
import { todayBusinessDate } from "@1kdaily/core";
import { Money } from "@/components/finance/money";
import { AddBankAccountForm, RequestWithdrawalForm } from "@/components/withdrawals/forms";
import { Badge, Card, CardContent, CardHeader, CardTitle, buttonVariants } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { requireProfile } from "@/server/auth/session";
import { getPlans, refreshPlanDays } from "@/server/savings/plans";

export const metadata: Metadata = { title: "Withdrawals" };

const STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "neutral" | "info"> = {
  paid: "success",
  approved: "info",
  processing: "info",
  requested: "warning",
  under_review: "warning",
  rejected: "danger",
  failed: "danger",
  cancelled: "neutral",
};

export default async function WithdrawalsPage() {
  await requireProfile();
  await refreshPlanDays();

  const supabase = await createSupabaseServerClient();
  const plans = await getPlans(todayBusinessDate());

  const withdrawable = [];
  for (const entry of plans) {
    if (entry.plan.status !== "completed" && entry.plan.status !== "cancelled") continue;
    const { data } = await supabase.rpc("my_withdrawal_eligibility", { p_plan_id: entry.plan.id });
    const row = (Array.isArray(data) ? data[0] : data) as
      | { eligible: boolean; available_kobo: string; reason: string | null }
      | undefined;
    if (row?.eligible) {
      withdrawable.push({
        id: entry.plan.id,
        name: entry.plan.name,
        availableKobo: String(row.available_kobo),
      });
    }
  }

  const { data: accounts } = await supabase
    .from("user_bank_accounts")
    .select("id, bank_name, account_last4, account_name")
    .eq("status", "active")
    .order("created_at", { ascending: true });

  const { data: requests } = await supabase
    .from("withdrawal_requests")
    .select("id, reference, amount_kobo, status, requested_at, decision_reason, savings_plans(name)")
    .order("requested_at", { ascending: false })
    .limit(20);

  const bankAccounts = (accounts ?? []) as Array<{
    id: string;
    bank_name: string;
    account_last4: string;
    account_name: string;
  }>;

  const history = (requests ?? []) as unknown as Array<{
    id: string;
    reference: string;
    amount_kobo: string;
    status: string;
    requested_at: string;
    decision_reason: string | null;
    savings_plans: { name: string } | null;
  }>;

  return (
    <div className="animate-rise space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.5rem] font-semibold tracking-[-0.02em] text-ink-900">Withdrawals</h1>
          <p className="mt-1 text-[0.8125rem] text-muted">
            Withdraw from completed or cancelled plans. Requests are reviewed before payout.
          </p>
        </div>
        <Link href="/app/savings" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
          My savings
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RequestWithdrawalForm
          plans={withdrawable}
          accounts={bankAccounts.map((account) => ({
            id: account.id,
            label: `${account.bank_name} · ••••${account.account_last4}`,
          }))}
        />
        <AddBankAccountForm hasAccount={bankAccounts.length > 0} />
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>History</CardTitle>
            <p className="mt-1 text-[0.75rem] text-muted">
              Every request, its decision and its payout reference.
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {history.length === 0 ? (
            <p className="p-8 text-center text-[0.8125rem] text-muted">No withdrawal requests yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line text-[0.625rem] uppercase tracking-[0.08em] text-subtle">
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Plan</th>
                    <th className="px-4 py-3 font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry) => (
                    <tr key={entry.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3 text-[0.6875rem] text-muted">
                        {new Date(entry.requested_at).toLocaleDateString("en-NG", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 text-[0.8125rem] text-ink-900">
                        {entry.savings_plans?.name ?? "Plan"}
                      </td>
                      <td className="px-4 py-3 text-[0.8125rem] font-semibold text-ink-900">
                        <Money value={BigInt(entry.amount_kobo)} />
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[entry.status] ?? "neutral"}>
                          {entry.status.replace("_", " ")}
                        </Badge>
                        {entry.decision_reason ? (
                          <p className="mt-1 max-w-[24ch] text-[0.5625rem] text-subtle">
                            {entry.decision_reason}
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-[0.625rem] leading-relaxed text-subtle">
        Account numbers are sent once to the payment provider to create a payout recipient; only the
        last four digits and the provider reference are stored. Finance approval is required, and the
        payout posts a balanced ledger entry.
      </p>
    </div>
  );
}
