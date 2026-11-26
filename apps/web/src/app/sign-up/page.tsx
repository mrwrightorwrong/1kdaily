import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/forms";

export const metadata: Metadata = {
  title: "Create your account",
  robots: { index: false, follow: false },
};

export default function SignUpPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="One account for daily savings, your contribution record and any future credit assessment."
      badge="Accounts are live"
      footer={
        <span>
          Already have an account?{" "}
          <Link href="/sign-in" className="font-semibold text-brand-700 hover:underline">
            Sign in
          </Link>
        </span>
      }
    >
      <SignUpForm />
    </AuthShell>
  );
}
