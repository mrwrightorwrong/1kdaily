import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/forms";
import { safeNextPath } from "@/lib/form";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  link_expired: "That link has expired. Sign in, or request a new one.",
  callback_failed: "We could not complete that sign-in link. Try again.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; reset?: string }>;
}) {
  const params = await searchParams;
  const next = params.next ? safeNextPath(params.next) : undefined;
  const error = params.error ? ERRORS[params.error] : undefined;

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to see your savings record, verification status and eligibility position."
      footer={
        <span>
          New to 1kDaily?{" "}
          <Link href="/sign-up" className="font-semibold text-brand-700 hover:underline">
            Create an account
          </Link>
        </span>
      }
    >
      <div className="space-y-4">
        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-danger-600/25 bg-danger-50 px-3.5 py-3 text-[0.75rem] leading-relaxed text-[#8f1d1d]"
          >
            {error}
          </div>
        ) : null}

        {params.reset === "success" ? (
          <div
            role="status"
            className="rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-3 text-[0.75rem] leading-relaxed text-brand-800"
          >
            Password updated. Sign in with your new password.
          </div>
        ) : null}

        <SignInForm next={next} />
      </div>
    </AuthShell>
  );
}
