import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/forms";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <AuthShell
        title="Link expired"
        subtitle="Password reset links are single-use and short-lived. Request a fresh one and open it in the same browser."
        footer={
          <Link href="/sign-in" className="font-semibold text-brand-700 hover:underline">
            Back to sign in
          </Link>
        }
      >
        <Link
          href="/forgot-password"
          className="inline-flex h-11 w-full items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white"
        >
          Request a new link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle={`Signed in as ${user.email ?? "your account"}. Choose a password you have not used elsewhere.`}
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
