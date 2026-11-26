import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResendVerificationForm } from "@/components/auth/forms";

export const metadata: Metadata = {
  title: "Confirm your email",
  robots: { index: false, follow: false },
};

export default function VerifyEmailPage() {
  return (
    <AuthShell
      title="Confirm your email"
      subtitle="We sent a confirmation link to the address you registered with. Open it in this browser to finish setting up your account."
      footer={
        <Link href="/sign-in" className="font-semibold text-brand-700 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl border border-line bg-canvas p-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
            <MailCheck className="size-4" strokeWidth={1.9} aria-hidden />
          </span>
          <div>
            <p className="text-[0.8125rem] font-medium text-ink-900">Nothing arrived?</p>
            <p className="mt-1 text-[0.75rem] leading-relaxed text-muted">
              Check spam, then request another link. Links expire; the most recent one is the valid
              one.
            </p>
          </div>
        </div>

        <ResendVerificationForm />
      </div>
    </AuthShell>
  );
}
