import type { Metadata } from "next";
import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { Money } from "@/components/finance/money";
import { Badge, Card, CardContent, EmptyState, buttonVariants } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { requireProfile } from "@/server/auth/session";

export const metadata: Metadata = { title: "Transactions" };

type ContributionRow = {
  readonly id: string;
  readonly reference: string;
  readonly amount_kobo: string;
  readonly status: string;
  readonly provider: string;
  readonly provider_reference: string | null;
  readonly channel: string | null;
  readonly created_at: string;
  readonly confirmed_at: string | null;
  readonly plan_id: string;
  readonly savings_plans: { name: string } | null;
};

const STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "neutral" | "info"> = {
  confirmed: "success",
  initiated: "info",
  pending: "warning",
  failed: "danger",
  reversed: "danger",
  refunded: "neutral",
};

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireProfile();
  const { error } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("savings_contributions")
    .select(
      "id, reference, amount_kobo, status, provider, provider_reference, channel, created_at, confirmed_at, plan_id, savings_plans(name)",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const transactions = (data ?? []) as unknown as ContributionRow[];

  return (
    <div className="animate-rise space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.5rem] font-semibold tracking-[-0.02em] text-ink-900">Transactions</h1>
          <p className="mt-1 text-[0.8125rem] text-muted">
            Every payment attempt, its provider reference and its verification status.
          </p>
        </div>
        <Link href="/app/plans" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
          Savings plans
        </Link>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-danger-600/25 bg-danger-50 px-3.5 py-3 text-[0.75rem] leading-relaxed text-[#8f1d1d]"
        >
          {error === "missing_reference"
            ? "That payment link was missing a reference."
            : "We could not match that payment to a contribution."}
        </div>
      ) : null}

      <Card>
        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={ReceiptText}
                title="No transactions yet"
                description="Contributions appear here the moment a payment is initiated, and only turn confirmed after server-side verification."
                action={
                  <Link
                    href="/app/plans"
                    className={cn(buttonVariants({ variant: "primary", size: "sm" }))}
                  >
                    Choose a plan
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line text-[0.625rem] uppercase tracking-[0.08em] text-subtle">
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Plan</th>
                    <th className="px-4 py-3 font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">Reference</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((entry) => (
                    <tr key={entry.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3 text-[0.6875rem] text-muted">
                        {new Date(entry.created_at).toLocaleString("en-NG", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/app/plans/${entry.plan_id}`}
                          className="text-[0.8125rem] font-medium text-ink-900 hover:underline"
                        >
                          {entry.savings_plans?.name ?? "Plan"}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[0.8125rem] font-semibold text-ink-900">
                        <Money value={BigInt(entry.amount_kobo)} />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-mono text-[0.625rem] text-muted">{entry.reference}</p>
                        {entry.provider_reference ? (
                          <p className="font-mono text-[0.5625rem] text-subtle">
                            provider: {entry.provider_reference}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[entry.status] ?? "neutral"}>
                          {entry.status}
                        </Badge>
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
        A contribution is credited only after the provider confirms it server-side. Initiated and
        failed attempts never affect your savings balance or your schedule.
      </p>
    </div>
  );
}
