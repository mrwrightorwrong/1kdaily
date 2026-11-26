import type { Metadata } from "next";
import Link from "next/link";
import { Info, Percent, ShieldCheck } from "lucide-react";
import { Money } from "@/components/finance/money";
import { Badge, Card, CardContent, CardHeader, CardTitle, buttonVariants } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { requireProfile } from "@/server/auth/session";
import { runEligibilityAssessment } from "@/server/actions/eligibility";

export const metadata: Metadata = { title: "Loan eligibility" };

type Assessment = {
  id: string;
  eligible: boolean;
  eligible_savings_kobo: string;
  multiplier_ceiling_kobo: string;
  affordability_ceiling_kobo: string;
  risk_ceiling_kobo: string;
  policy_ceiling_kobo: string;
  assessed_limit_kobo: string;
  binding_constraint: string;
  reasons: string[];
  blockers: string[];
  policy_version: string;
  engine_version: string;
  created_at: string;
};

const CONSTRAINT_LABEL: Record<string, string> = {
  multiplier: "your savings multiplier",
  affordability: "affordability",
  risk: "repayment history",
  policy: "the policy maximum",
  eligibility: "eligibility requirements",
};

export default async function EligibilityPage({
  searchParams,
}: {
  searchParams: Promise<{ assessed?: string; error?: string }>;
}) {
  await requireProfile();
  const query = await searchParams;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("loan_eligibility_assessments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const assessment = data as Assessment | null;

  return (
    <div className="animate-rise space-y-4">
      <div>
        <h1 className="text-[1.5rem] font-semibold tracking-[-0.02em] text-ink-900">
          Loan eligibility
        </h1>
        <p className="mt-1 max-w-2xl text-[0.8125rem] leading-relaxed text-muted">
          A preliminary ceiling based on your savings record, affordability and policy. It is not an
          offer and not an approval.
        </p>
      </div>

      {query.error ? (
        <div role="alert" className="rounded-xl border border-danger-600/25 bg-danger-50 px-3.5 py-3 text-[0.75rem] text-[#8f1d1d]">
          We could not save the assessment. Try again.
        </div>
      ) : null}

      {!assessment ? (
        <Card>
          <CardContent className="py-10 text-center">
            <span className="mx-auto grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <Percent className="size-5" strokeWidth={1.9} aria-hidden />
            </span>
            <p className="mt-3 text-[0.9375rem] font-semibold text-ink-900">No assessment yet</p>
            <p className="mx-auto mt-1 max-w-md text-[0.75rem] leading-relaxed text-muted">
              We will read your confirmed savings, contribution consistency and declared income, then
              record the result with the policy version used, so it can be explained later.
            </p>
            <form action={runEligibilityAssessment} className="mt-4">
              <button type="submit" className={cn(buttonVariants({ variant: "primary", size: "md" }))}>
                Run my assessment
              </button>
            </form>
            <p className="mt-3 text-[0.625rem] text-subtle">
              Requires at least 30 days of savings and a verified identity.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[0.625rem] uppercase tracking-[0.12em] text-subtle">
                    Preliminary ceiling
                  </p>
                  <p className="mt-1 text-[2rem] font-semibold leading-none tracking-[-0.02em] text-ink-900">
                    {assessment.eligible ? (
                      <Money value={BigInt(assessment.assessed_limit_kobo)} dimDecimals />
                    ) : (
                      "Not yet eligible"
                    )}
                  </p>
                  <p className="mt-1 text-[0.6875rem] text-muted">
                    Set by {CONSTRAINT_LABEL[assessment.binding_constraint] ?? assessment.binding_constraint}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={assessment.eligible ? "success" : "warning"}>
                    {assessment.eligible ? "Assessed" : "Not eligible"}
                  </Badge>
                  <form action={runEligibilityAssessment}>
                    <button type="submit" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
                      Reassess
                    </button>
                  </form>
                </div>
              </div>

              <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  { label: "Eligible savings", value: assessment.eligible_savings_kobo },
                  { label: "3× ceiling", value: assessment.multiplier_ceiling_kobo },
                  { label: "Affordability", value: assessment.affordability_ceiling_kobo },
                  { label: "Risk", value: assessment.risk_ceiling_kobo },
                  { label: "Policy max", value: assessment.policy_ceiling_kobo },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl bg-canvas p-3">
                    <dt className="text-[0.5625rem] uppercase tracking-[0.08em] text-subtle">
                      {item.label}
                    </dt>
                    <dd className="mt-1 text-[0.875rem] font-semibold text-ink-900">
                      <Money value={BigInt(item.value)} decimals={0} />
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>How this was decided</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {assessment.reasons.map((reason) => (
                    <li key={reason} className="flex items-start gap-2 text-[0.75rem] leading-relaxed text-muted">
                      <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-brand-700" aria-hidden />
                      {reason}
                    </li>
                  ))}
                </ul>
                {assessment.blockers.length > 0 ? (
                  <div className="mt-4 rounded-xl border border-warn-500/25 bg-warn-50 p-3">
                    <p className="text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-[#7a5300]">
                      What is holding you back
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {assessment.blockers.map((blocker) => (
                        <li key={blocker} className="text-[0.75rem] leading-relaxed text-[#7a5300]">
                          · {blocker}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>What happens next</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-[0.75rem] leading-relaxed text-muted">
                <p>
                  An application is assessed on the same inputs plus documents, guarantors or
                  collateral if the product requires them. Approval is never automatic.
                </p>
                <p className="flex items-start gap-2 rounded-xl bg-canvas p-3 text-[0.6875rem]">
                  <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  Interest, processing fee and insurance fee will be disclosed in full before you
                  accept an offer, including the net amount paid to you.
                </p>
                <Link
                  href="/app/savings"
                  className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                >
                  Review my savings
                </Link>
              </CardContent>
            </Card>
          </div>

          <p className="text-[0.625rem] leading-relaxed text-subtle">
            Assessment {assessment.id.slice(0, 8)} · policy {assessment.policy_version} · engine{" "}
            {assessment.engine_version} ·{" "}
            {new Date(assessment.created_at).toLocaleString("en-NG", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </>
      )}
    </div>
  );
}
