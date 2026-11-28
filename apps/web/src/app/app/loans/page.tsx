import type { Metadata } from "next";
import Link from "next/link";
import { Money } from "@/components/finance/money";
import { ApplyForLoanForm } from "@/components/loans/apply-form";
import { CollateralCard, type CollateralRow } from "@/components/loans/collateral-card";
import {
  GuarantorsCard,
  type GuarantorInvitationRow,
  type GuarantorRow,
} from "@/components/loans/guarantors-card";
import { Badge, Card, CardContent, CardHeader, CardTitle, buttonVariants } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { requireProfile } from "@/server/auth/session";
import { acceptLoanOfferAction } from "@/server/actions/loans";

export const metadata: Metadata = { title: "My loans" };

type Product = { code: string; name: string; tenor_months: number[] };

type OfferRow = {
  id: string;
  expires_at: string;
  accepted_at: string | null;
  net_disbursed_kobo: string;
  total_payable_kobo: string;
  installment_kobo: string;
  principal_kobo: string;
  processing_fee_kobo: string;
  insurance_fee_kobo: string;
  interest_kobo: string;
};

export default async function LoansPage({
  searchParams,
}: {
  searchParams: Promise<{ applied?: string; accepted?: string; expired?: string }>;
}) {
  await requireProfile();
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();

  const [{ data: products }, { data: assessment }, { data: application }] = await Promise.all([
    supabase.from("loan_products").select("code, name, tenor_months").eq("is_active", true),
    supabase
      .from("loan_eligibility_assessments")
      .select("eligible, assessed_limit_kobo")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("loan_applications")
      .select("id, reference, status, requested_amount_kobo, tenor_months, loan_offers(*)")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const offer = (application as { loan_offers?: OfferRow[] } | null)?.loan_offers?.[0];

  const applicationId = (application as { id?: string } | null)?.id;
  const applicationStatus = (application as { status?: string } | null)?.status ?? "";
  const arranging = ["submitted", "under_review", "approved", "awaiting_disbursement"].includes(
    applicationStatus,
  );

  const [invitationsResult, guarantorsResult, collateralResult] = applicationId
    ? await Promise.all([
        supabase
          .from("guarantor_invitations")
          .select("id, email, status, expires_at, token")
          .eq("application_id", applicationId)
          .order("created_at", { ascending: false }),
        supabase
          .from("guarantors")
          .select("id, full_name, email, status, guarantee_amount_kobo, consented_at, verified_at")
          .eq("application_id", applicationId)
          .order("created_at", { ascending: false }),
        supabase
          .from("collateral_records")
          .select(
            "id, category, description, estimated_value_kobo, valuation_method, valuation_date, ownership_evidence, status, release_status, review_notes, created_at, collateral_documents(id, document_type, status)",
          )
          .eq("application_id", applicationId)
          .order("created_at", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const invitations = (invitationsResult.data ?? []) as GuarantorInvitationRow[];
  const guarantors = (guarantorsResult.data ?? []) as GuarantorRow[];
  const collateral = (collateralResult.data ?? []) as unknown as CollateralRow[];

  return (
    <div className="animate-rise space-y-4">
      <div>
        <h1 className="text-[1.5rem] font-semibold tracking-[-0.02em] text-ink-900">My loans</h1>
        <p className="mt-1 text-[0.8125rem] text-muted">
          Apply within your assessed limit. Offers show the full cost and the net amount you receive.
        </p>
      </div>

      {query.accepted ? (
        <div role="status" className="rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-3 text-[0.75rem] text-brand-800">
          Offer accepted. Your application is awaiting disbursement.
        </div>
      ) : null}
      {query.expired ? (
        <div role="alert" className="rounded-xl border border-warn-500/25 bg-warn-50 px-3.5 py-3 text-[0.75rem] text-[#7a5300]">
          That offer expired. Apply again to get a fresh quote.
        </div>
      ) : null}

      {!assessment?.eligible ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-[0.9375rem] font-semibold text-ink-900">Run an assessment first</p>
            <p className="mx-auto mt-1 max-w-md text-[0.75rem] leading-relaxed text-muted">
              An application needs an eligible assessment. It takes a moment and uses your confirmed
              savings and declared affordability.
            </p>
            <Link href="/app/eligibility" className={cn(buttonVariants({ variant: "primary", size: "sm" }), "mt-4")}>
              Check eligibility
            </Link>
          </CardContent>
        </Card>
      ) : offer ? (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Your offer</CardTitle>
              <p className="mt-1 text-[0.75rem] text-muted">
                {application?.reference} · expires{" "}
                {new Date(offer.expires_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
              </p>
            </div>
            <Badge variant={offer.accepted_at ? "success" : "warning"}>
              {offer.accepted_at ? "Accepted" : "Awaiting acceptance"}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-[0.5625rem] uppercase tracking-[0.1em] text-subtle">You receive</p>
                <p className="mt-1 text-[1.375rem] font-semibold text-ink-900">
                  <Money value={BigInt(offer.net_disbursed_kobo)} dimDecimals />
                </p>
              </div>
              <div>
                <p className="text-[0.5625rem] uppercase tracking-[0.1em] text-subtle">Total payable</p>
                <p className="mt-1 text-[1.375rem] font-semibold text-ink-900">
                  <Money value={BigInt(offer.total_payable_kobo)} dimDecimals />
                </p>
              </div>
              <div>
                <p className="text-[0.5625rem] uppercase tracking-[0.1em] text-subtle">Monthly</p>
                <p className="mt-1 text-[1.375rem] font-semibold text-ink-900">
                  <Money value={BigInt(offer.installment_kobo)} dimDecimals />
                </p>
              </div>
            </div>

            <dl className="mt-4 grid gap-2 border-t border-line pt-3 text-[0.75rem] sm:grid-cols-4">
              <div className="flex justify-between gap-2 sm:block">
                <dt className="text-muted">Principal</dt>
                <dd className="font-medium text-ink-900"><Money value={BigInt(offer.principal_kobo)} decimals={0} /></dd>
              </div>
              <div className="flex justify-between gap-2 sm:block">
                <dt className="text-muted">Processing fee</dt>
                <dd className="font-medium text-ink-900"><Money value={BigInt(offer.processing_fee_kobo)} decimals={0} /></dd>
              </div>
              <div className="flex justify-between gap-2 sm:block">
                <dt className="text-muted">Insurance</dt>
                <dd className="font-medium text-ink-900"><Money value={BigInt(offer.insurance_fee_kobo)} decimals={0} /></dd>
              </div>
              <div className="flex justify-between gap-2 sm:block">
                <dt className="text-muted">Interest</dt>
                <dd className="font-medium text-ink-900"><Money value={BigInt(offer.interest_kobo)} decimals={0} /></dd>
              </div>
            </dl>

            {!offer.accepted_at ? (
              <form action={acceptLoanOfferAction} className="mt-4">
                <input type="hidden" name="offer_id" value={offer.id} />
                <button type="submit" className={cn(buttonVariants({ variant: "primary", size: "md" }))}>
                  Accept these terms
                </button>
              </form>
            ) : null}

            <p className="mt-3 text-[0.625rem] leading-relaxed text-subtle">
              Fees are deducted from the amount disbursed. Approval is not automatic and disbursement
              is subject to review.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Apply for a loan</CardTitle>
          </CardHeader>
          <CardContent>
            <ApplyForLoanForm
              products={((products ?? []) as Product[]).map((product) => ({
                code: product.code,
                name: product.name,
                tenors: product.tenor_months,
              }))}
              maxAmountKobo={String(assessment.assessed_limit_kobo)}
            />
          </CardContent>
        </Card>
      )}

      {arranging && applicationId ? (
        <>
          <GuarantorsCard
            applicationId={applicationId}
            invitations={invitations}
            guarantors={guarantors}
          />
          <CollateralCard applicationId={applicationId} records={collateral} />
        </>
      ) : null}

      {application ? (
        <p className="text-[0.625rem] text-subtle">
          Latest application {application.reference} · {application.status.replace(/_/g, " ")}
        </p>
      ) : null}
    </div>
  );
}
