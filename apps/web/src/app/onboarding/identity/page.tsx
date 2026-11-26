import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { IdentityForm } from "@/components/onboarding/forms";
import { StepHeading } from "@/components/onboarding/stepper";
import { Card, CardContent } from "@/components/ui/primitives";
import { serverEnv } from "@/lib/env";
import { skipIdentityAction } from "@/server/actions/onboarding";
import { getIdentitySummary, requireProfile } from "@/server/auth/session";

export const metadata: Metadata = { title: "Verify your identity" };

export default async function IdentityStepPage() {
  const profile = await requireProfile();

  if (profile.onboarding_step === "profile") redirect("/onboarding/profile");
  if (profile.onboarding_step === "financial" || profile.onboarding_step === "complete") {
    redirect("/onboarding/financial");
  }

  const identity = await getIdentitySummary();
  const existing = identity.map((record) => ({
    kind: record.kind,
    status: record.status,
    last4: record.last4,
  }));

  return (
    <div>
      <StepHeading
        title="Verify your identity"
        description="A verified identity is required before credit can be assessed. You can add the second document later from your profile."
      />

      <Card>
        <CardContent>
          <IdentityForm existing={existing} isMockProvider={serverEnv().kycProvider === "mock"} />
        </CardContent>
      </Card>

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-line bg-surface p-3.5">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-700" strokeWidth={1.9} aria-hidden />
        <p className="text-[0.6875rem] leading-relaxed text-muted">
          The number is used once, in memory, to call the verification provider. 1kDaily stores only
          the last four digits, the vendor reference and a one-way fingerprint used to stop the same
          identity being used on two accounts.
        </p>
      </div>

      <form action={skipIdentityAction} className="mt-5">
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 text-[0.75rem] font-medium text-muted transition-colors hover:text-ink-900"
        >
          Continue without verifying for now
          <ArrowRight className="size-3.5" aria-hidden />
        </button>
      </form>
    </div>
  );
}
