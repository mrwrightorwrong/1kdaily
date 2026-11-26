import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { OnboardingStepper } from "@/components/onboarding/stepper";
import { signOutAction } from "@/server/actions/auth";
import { getProfile, requireUser } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Set up your account",
  robots: { index: false, follow: false },
};

export default async function OnboardingLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const user = await requireUser();
  const profile = await getProfile();

  if (!profile) redirect("/sign-in");
  if (profile.onboarding_completed_at) redirect("/app");

  const step = profile.onboarding_step === "complete" ? "financial" : profile.onboarding_step;

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-5 sm:px-8">
          <Logo size="sm" href="/app" />
          <div className="flex items-center gap-4">
            <span className="hidden text-[0.6875rem] text-muted sm:block">{user.email}</span>
            <form action={signOutAction}>
              <button
                type="submit"
                className="text-[0.75rem] font-medium text-muted transition-colors hover:text-ink-900"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
        <OnboardingStepper current={step} />
        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}
