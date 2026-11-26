import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FinancialForm } from "@/components/onboarding/forms";
import { StepHeading } from "@/components/onboarding/stepper";
import { Card, CardContent } from "@/components/ui/primitives";
import { requireProfile } from "@/server/auth/session";

export const metadata: Metadata = { title: "Affordability" };

const IDENTITY_MESSAGES: Record<string, { tone: "ok" | "warn" | "bad"; text: string }> = {
  verified: { tone: "ok", text: "Identity verified. One more step and your account is ready." },
  needs_review: {
    tone: "warn",
    text: "Identity submitted and queued for review. You can continue; we will update your status.",
  },
  failed: {
    tone: "bad",
    text: "That check did not match a record. You can retry from your profile after finishing setup.",
  },
};

export default async function FinancialStepPage({
  searchParams,
}: {
  searchParams: Promise<{ identity?: string }>;
}) {
  const profile = await requireProfile();

  if (profile.onboarding_step === "profile" || profile.onboarding_step === "identity") {
    redirect(`/onboarding/${profile.onboarding_step}`);
  }

  const { identity } = await searchParams;
  const notice = identity ? IDENTITY_MESSAGES[identity] : undefined;

  return (
    <div>
      <StepHeading
        title="What does your month look like?"
        description="These figures help assess what repayment would be responsible — never to maximise a loan. They are self-declared and used only for affordability."
      />

      {notice ? (
        <div
          role="status"
          className={
            notice.tone === "ok"
              ? "mb-4 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-3 text-[0.75rem] leading-relaxed text-brand-800"
              : notice.tone === "warn"
                ? "mb-4 rounded-xl border border-warn-500/25 bg-warn-50 px-3.5 py-3 text-[0.75rem] leading-relaxed text-[#7a5300]"
                : "mb-4 rounded-xl border border-danger-600/25 bg-danger-50 px-3.5 py-3 text-[0.75rem] leading-relaxed text-[#8f1d1d]"
          }
        >
          {notice.text}
        </div>
      ) : null}

      <Card>
        <CardContent>
          <FinancialForm />
        </CardContent>
      </Card>
    </div>
  );
}
