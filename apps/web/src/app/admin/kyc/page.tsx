import type { Metadata } from "next";
import Link from "next/link";
import { Lock, ShieldCheck } from "lucide-react";
import { IdentityDecisionForm } from "@/components/admin/identity-decision";
import { Badge, Card, CardContent, buttonVariants } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { getPermissions, requireUser } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Identity verification",
  robots: { index: false, follow: false },
};

type QueueRow = {
  readonly document_id: string;
  readonly user_id: string;
  readonly full_name: string;
  readonly kind: "bvn" | "nin";
  readonly status: string;
  readonly last4: string;
  readonly match_result: string | null;
  readonly submitted_at: string;
  readonly attempt_count: number;
};

export default async function AdminKycPage() {
  await requireUser();
  const permissions = await getPermissions();

  if (!permissions.includes("kyc:read")) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-canvas text-muted ring-1 ring-line">
          <Lock className="size-5" strokeWidth={1.9} aria-hidden />
        </span>
        <h1 className="mt-4 text-[1.25rem] font-semibold text-ink-900">Restricted</h1>
        <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted">
          Your account does not hold the <code className="text-[0.75rem]">kyc:read</code> permission.
          Ask a platform administrator to grant it through a role if you need access.
        </p>
        <Link href="/admin" className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mt-5")}>
          Back to console
        </Link>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_identity_queue", { p_limit: 50 });
  const queue = (data ?? []) as QueueRow[];

  return (
    <div className="animate-rise">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.5rem] font-semibold tracking-[-0.02em] text-ink-900">
            Identity verification
          </h1>
          <p className="mt-1 text-[0.8125rem] text-muted">
            Masked review queue. The underlying number is never available to staff.
          </p>
        </div>
        <Badge variant={queue.length > 0 ? "warning" : "neutral"}>{queue.length} pending</Badge>
      </div>

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-line bg-surface p-3.5">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-700" strokeWidth={1.9} aria-hidden />
        <p className="text-[0.6875rem] leading-relaxed text-muted">
          Records show the last four digits only. Viewing or deciding a record writes an entry to the
          audit log with your account as actor.
        </p>
      </div>

      <Card className="mt-4">
        <CardContent className="p-0">
          {error ? (
            <p className="p-5 text-[0.8125rem] text-danger-600">
              Could not load the queue: {error.message}
            </p>
          ) : queue.length === 0 ? (
            <p className="p-8 text-center text-[0.8125rem] text-muted">
              Nothing waiting. Submitted identities will appear here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[52rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line text-[0.625rem] uppercase tracking-[0.08em] text-subtle">
                    <th className="px-4 py-3 font-semibold">Customer</th>
                    <th className="px-4 py-3 font-semibold">Document</th>
                    <th className="px-4 py-3 font-semibold">Match</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Submitted</th>
                    <th className="px-4 py-3 font-semibold">Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((row) => (
                    <tr key={row.document_id} className="border-b border-line align-top last:border-0">
                      <td className="px-4 py-3">
                        <p className="text-[0.8125rem] font-medium text-ink-900">
                          {row.full_name || "Unnamed customer"}
                        </p>
                        <p className="text-[0.625rem] text-subtle">{row.user_id.slice(0, 8)}…</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[0.8125rem] font-medium uppercase text-ink-900">
                          {row.kind}
                        </p>
                        <p className="text-[0.6875rem] text-subtle">•••• {row.last4}</p>
                      </td>
                      <td className="px-4 py-3 text-[0.75rem] text-muted">
                        {row.match_result ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={row.status === "needs_review" ? "warning" : "neutral"}>
                          {row.status.replace("_", " ")}
                        </Badge>
                        <p className="mt-1 text-[0.5625rem] text-subtle">
                          Attempt {row.attempt_count}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-[0.6875rem] text-muted">
                        {new Date(row.submitted_at).toLocaleString("en-NG", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <IdentityDecisionForm documentId={row.document_id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
