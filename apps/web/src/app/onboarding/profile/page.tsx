import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/primitives";
import { ProfileForm } from "@/components/onboarding/forms";
import { StepHeading } from "@/components/onboarding/stepper";
import { requireProfile } from "@/server/auth/session";

export const metadata: Metadata = { title: "Your details" };

export default async function ProfileStepPage() {
  const profile = await requireProfile();

  if (profile.onboarding_step !== "profile") {
    redirect(
      profile.onboarding_step === "complete" ? "/app" : `/onboarding/${profile.onboarding_step}`,
    );
  }

  return (
    <div>
      <StepHeading
        title="Tell us who you are"
        description="We collect the minimum needed to open your account and prepare for verification. Nothing here is shared publicly."
      />

      <Card>
        <CardContent>
          <ProfileForm
            profile={{
              first_name: profile.first_name,
              last_name: profile.last_name,
              phone: profile.phone,
              date_of_birth: profile.date_of_birth,
              state: profile.state,
              address_line: profile.address_line,
            }}
          />
        </CardContent>
      </Card>

      <p className="mt-4 text-[0.6875rem] leading-relaxed text-subtle">
        Your date of birth is used to confirm you are 18 or older. Address details are used only for
        identity and, where required, service correspondence.
      </p>
    </div>
  );
}
