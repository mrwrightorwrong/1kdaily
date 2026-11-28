import type { Metadata } from "next";
import { Money } from "@/components/finance/money";
import { Badge, Card, CardContent, buttonVariants } from "@/components/ui/primitives";
import { COLLATERAL_CATEGORY_LABEL, COLLATERAL_STATUS_VARIANT } from "@/lib/collateral";
import { cn } from "@/lib/cn";
import {
  releaseCollateralAction,
  releaseGuarantorAction,
  reviewCollateralAction,
  reviewCollateralDocumentAction,
  reviewGuarantorAction,
} from "@/server/actions/admin-collateral";
import { decideLoanAction, disburseLoanAction } from "@/server/actions/admin-loans";
import { getPermissions, requireUser } from "@/server/auth/session";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";

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

type CollateralDocument = {
  id: string;
  document_type: string;
  status: string;
  storage_path: string;
};

type CollateralQueueRow = {
  id: string;
  category: string;
  description: string;
  estimated_value_kobo: string | null;
  status: string;
  release_status: string;
  review_notes: string | null;
  created_at: string;
  loan_applications: { reference: string; status: string } | null;
  collateral_documents: CollateralDocument[];
};

type GuarantorQueueRow = {
  id: string;
  full_name: string;
  email: string;
  status: string;
  guarantee_amount_kobo: string;
  consented_at: string | null;
  verified_at: string | null;
  loan_applications: { reference: string; status: string } | null;
};

const VARIANT: Record<string, "warning" | "success" | "danger" | "info" | "neutral"> = {
  submitted: "warning",
  under_review: "warning",
  approved: "info",
  rejected: "danger",
  disbursed: "success",
  awaiting_disbursement: "info",
  closed: "neutral",
};

const GUARANTOR_VARIANT: Record<string, "warning" | "success" | "danger" | "neutral"> = {
  accepted: "warning",
  verified: "success",
  invalid: "danger",
  released: "neutral",
};

const REVIEWABLE = ["submitted", "pending_verification", "under_review", "rejected"];

const inputClass =
  "h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 text-[0.75rem] outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10";

function day(value: string): string {
  return new Date(value).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function AdminLoansPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; done?: string }>;
}) {
  await requireUser();
  const permissions = await getPermissions();
  const canReview = permissions.includes("loans:review") || permissions.includes("loans:approve");
  const canDisburse = permissions.includes("loans:disburse");
  const canVerifyCollateral = permissions.includes("collateral:verify");
  const canVerifyGuarantor = permissions.includes("loans:approve");
  const query = await searchParams;

  const supabase = await createSupabaseServerClient();
  const [{ data }, { data: collateralData }, { data: guarantorData }] = await Promise.all([
    supabase
      .from("loan_applications")
      .select(
        "id, reference, status, requested_amount_kobo, tenor_months, created_at, loan_products(name), loan_offers(principal_kobo, net_disbursed_kobo)",
      )
      .in("status", [
        "submitted",
        "under_review",
        "approved",
        "awaiting_disbursement",
        "disbursed",
        "rejected",
        "closed",
      ])
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("collateral_records")
      .select(
        "id, category, description, estimated_value_kobo, status, release_status, review_notes, created_at, loan_applications(reference, status), collateral_documents(id, document_type, status, storage_path)",
      )
      .eq("release_status", "held")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("guarantors")
      .select(
        "id, full_name, email, status, guarantee_amount_kobo, consented_at, verified_at, loan_applications(reference, status)",
      )
      .in("status", ["accepted", "verified"])
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const applications = (data ?? []) as unknown as Application[];
  const collateral = (collateralData ?? []) as unknown as CollateralQueueRow[];
  const guarantors = (guarantorData ?? []) as unknown as GuarantorQueueRow[];

  // Signed links are short-lived and only issued to staff who may verify.
  const documentLinks = new Map<string, string>();
  if (canVerifyCollateral) {
    const admin = createSupabaseAdminClient();
    const documents = collateral.flatMap((record) => record.collateral_documents ?? []).slice(0, 30);
    await Promise.all(
      documents.map(async (document) => {
        const { data: signed } = await admin.storage
          .from("collateral")
          .createSignedUrl(document.storage_path, 600);
        if (signed?.signedUrl) documentLinks.set(document.id, signed.signedUrl);
      }),
    );
  }

  return (
    <div className="animate-rise space-y-6">
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

      <section className="space-y-3">
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
      </section>

      <section id="collateral" className="scroll-mt-24 space-y-3">
        <div>
          <h2 className="text-[1.125rem] font-semibold tracking-[-0.01em] text-ink-900">
            Collateral queue
          </h2>
          <p className="mt-1 text-[0.8125rem] text-muted">
            Verification is not release. Security can only be released once the loan is closed.
          </p>
        </div>

        {collateral.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-[0.8125rem] text-muted">
              No collateral is held.
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {collateral.map((record) => {
              const application = record.loan_applications;
              const closed = application?.status === "closed";
              return (
                <li key={record.id}>
                  <Card>
                    <CardContent className="space-y-3 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-[0.875rem] font-medium text-ink-900">
                            {COLLATERAL_CATEGORY_LABEL[record.category] ?? record.category} ·{" "}
                            {record.description}
                          </p>
                          <p className="mt-0.5 text-[0.625rem] text-subtle">
                            {application?.reference ?? "—"} · loan {application?.status.replace(/_/g, " ") ?? "unknown"} ·
                            added {day(record.created_at)}
                            {record.estimated_value_kobo ? (
                              <>
                                {" · "}
                                <Money value={BigInt(record.estimated_value_kobo)} decimals={0} />
                              </>
                            ) : null}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant={COLLATERAL_STATUS_VARIANT[record.status] ?? "neutral"}>
                            {record.status.replace(/_/g, " ")}
                          </Badge>
                          <Badge variant="info">{record.release_status}</Badge>
                        </div>
                      </div>

                      {record.review_notes ? (
                        <p className="rounded-lg bg-canvas px-2.5 py-2 text-[0.6875rem] text-muted">
                          Note: {record.review_notes}
                        </p>
                      ) : null}

                      {record.collateral_documents.length > 0 ? (
                        <ul className="divide-y divide-line rounded-lg border border-line">
                          {record.collateral_documents.map((document) => (
                            <li
                              key={document.id}
                              className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-2"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-[0.75rem] text-ink-900">{document.document_type}</span>
                                <Badge
                                  variant={
                                    document.status === "verified"
                                      ? "success"
                                      : document.status === "rejected"
                                        ? "danger"
                                        : "neutral"
                                  }
                                >
                                  {document.status}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                {documentLinks.get(document.id) ? (
                                  <a
                                    href={documentLinks.get(document.id)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[0.6875rem] font-medium text-brand-700 underline underline-offset-2"
                                  >
                                    Open
                                  </a>
                                ) : null}
                                {canVerifyCollateral && document.status === "pending" ? (
                                  <form action={reviewCollateralDocumentAction} className="flex gap-1">
                                    <input type="hidden" name="document_id" value={document.id} />
                                    <button
                                      name="decision"
                                      value="verify"
                                      className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "h-7 px-2 text-[0.625rem]")}
                                    >
                                      Accept
                                    </button>
                                    <button
                                      name="decision"
                                      value="reject"
                                      className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 px-2 text-[0.625rem]")}
                                    >
                                      Reject
                                    </button>
                                  </form>
                                ) : null}
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[0.6875rem] text-subtle">No documents attached.</p>
                      )}

                      {canVerifyCollateral && REVIEWABLE.includes(record.status) ? (
                        <form action={reviewCollateralAction} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="collateral_id" value={record.id} />
                          <input
                            name="notes"
                            placeholder="Review note (required to reject)"
                            className={inputClass}
                          />
                          <button
                            name="decision"
                            value="verify"
                            className={cn(buttonVariants({ variant: "primary", size: "sm" }))}
                          >
                            Verify collateral
                          </button>
                          <button
                            name="decision"
                            value="reject"
                            className={cn(buttonVariants({ variant: "danger", size: "sm" }))}
                          >
                            Reject
                          </button>
                        </form>
                      ) : null}

                      {canVerifyCollateral && record.status === "verified" && closed ? (
                        <form action={releaseCollateralAction} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="collateral_id" value={record.id} />
                          <input name="notes" placeholder="Release note (optional)" className={inputClass} />
                          <button className={cn(buttonVariants({ variant: "dark", size: "sm" }))}>
                            Release security
                          </button>
                        </form>
                      ) : null}

                      {record.status === "verified" && !closed ? (
                        <p className="text-[0.625rem] text-subtle">
                          Held until the loan closes. Release is deliberately manual.
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section id="guarantors" className="scroll-mt-24 space-y-3">
        <div>
          <h2 className="text-[1.125rem] font-semibold tracking-[-0.01em] text-ink-900">
            Guarantor queue
          </h2>
          <p className="mt-1 text-[0.8125rem] text-muted">
            Only a guarantor who consented can be verified. Release happens after the loan closes.
          </p>
        </div>

        {guarantors.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-[0.8125rem] text-muted">
              No consented guarantors are waiting.
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {guarantors.map((guarantor) => {
              const application = guarantor.loan_applications;
              const closed = application?.status === "closed";
              return (
                <li key={guarantor.id}>
                  <Card>
                    <CardContent className="space-y-3 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-[0.875rem] font-medium text-ink-900">{guarantor.full_name}</p>
                          <p className="mt-0.5 text-[0.625rem] text-subtle">
                            {guarantor.email} · {application?.reference ?? "—"} · guarantees{" "}
                            <Money value={BigInt(guarantor.guarantee_amount_kobo)} decimals={0} />
                            {guarantor.consented_at ? ` · consented ${day(guarantor.consented_at)}` : ""}
                          </p>
                        </div>
                        <Badge variant={GUARANTOR_VARIANT[guarantor.status] ?? "neutral"}>
                          {guarantor.status}
                        </Badge>
                      </div>

                      {canVerifyGuarantor && guarantor.status === "accepted" ? (
                        <form action={reviewGuarantorAction} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="guarantor_id" value={guarantor.id} />
                          <input name="notes" placeholder="Note (required to reject)" className={inputClass} />
                          <button
                            name="decision"
                            value="verify"
                            className={cn(buttonVariants({ variant: "primary", size: "sm" }))}
                          >
                            Verify guarantor
                          </button>
                          <button
                            name="decision"
                            value="reject"
                            className={cn(buttonVariants({ variant: "danger", size: "sm" }))}
                          >
                            Reject
                          </button>
                        </form>
                      ) : null}

                      {canVerifyGuarantor && guarantor.status === "verified" && closed ? (
                        <form action={releaseGuarantorAction} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="guarantor_id" value={guarantor.id} />
                          <input name="notes" placeholder="Release note (optional)" className={inputClass} />
                          <button className={cn(buttonVariants({ variant: "dark", size: "sm" }))}>
                            Release guarantor
                          </button>
                        </form>
                      ) : null}

                      {guarantor.status === "verified" && !closed ? (
                        <p className="text-[0.625rem] text-subtle">
                          Verified and held until the loan closes.
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
