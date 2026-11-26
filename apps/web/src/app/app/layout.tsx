import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppBottomNav } from "@/components/layout/app-bottom-nav";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { getPermissions, requireProfile, requireUser } from "@/server/auth/session";

export const metadata: Metadata = {
  title: { default: "Overview", template: "%s · 1kDaily" },
  robots: { index: false, follow: false },
};

function initialsFrom(firstName: string, lastName: string, email: string): string {
  const fromName = `${firstName.charAt(0)}${lastName.charAt(0)}`.trim();
  if (fromName) return fromName.toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

export default async function AppLayout({ children }: { readonly children: React.ReactNode }) {
  const user = await requireUser();
  const profile = await requireProfile();

  // Onboarding is not optional: it establishes the identity and affordability
  // record every later phase depends on.
  if (!profile.onboarding_completed_at) {
    redirect(profile.onboarding_step === "complete" ? "/app" : `/onboarding/${profile.onboarding_step}`);
  }

  const permissions = await getPermissions();
  const displayName =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") || (user.email ?? "Your account");

  return (
    <div className="min-h-dvh bg-canvas">
      <AppSidebar
        displayName={displayName}
        email={user.email ?? ""}
        initials={initialsFrom(profile.first_name, profile.last_name, user.email ?? "1K")}
        isAdmin={permissions.includes("admin:read")}
      />
      <div className="lg:pl-[15.5rem]">
        <AppTopbar
          initials={initialsFrom(profile.first_name, profile.last_name, user.email ?? "1K")}
        />
        <main
          id="main"
          className="mx-auto w-full max-w-[76rem] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-16"
        >
          {children}
        </main>
      </div>
      <AppBottomNav />
    </div>
  );
}
