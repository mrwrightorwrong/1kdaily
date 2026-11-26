import { redirect } from "next/navigation";
import { requireProfile } from "@/server/auth/session";

export default async function OnboardingIndexPage() {
  const profile = await requireProfile();

  if (profile.onboarding_step === "complete") {
    redirect("/app");
  }

  redirect(`/onboarding/${profile.onboarding_step}`);
}
