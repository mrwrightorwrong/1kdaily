import type { Metadata } from "next";
import { KeyRound, ShieldCheck, Smartphone } from "lucide-react";
import { ChangePasswordForm } from "@/components/profile/forms";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { requireProfile } from "@/server/auth/session";

export const metadata: Metadata = { title: "Security" };

export default async function SecurityPage() {
  const profile = await requireProfile();

  return (
    <div className="animate-rise space-y-4">
      <div>
        <h1 className="text-[1.5rem] font-semibold tracking-[-0.02em] text-ink-900">Security</h1>
        <p className="mt-1 text-[0.8125rem] text-muted">
          Protect the account that holds your savings record.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Password</CardTitle>
              <p className="mt-1 text-[0.75rem] text-muted">
                Changing your password requires your current one.
              </p>
            </div>
            <span className="grid size-8 place-items-center rounded-lg bg-canvas text-muted">
              <KeyRound className="size-4" strokeWidth={1.9} aria-hidden />
            </span>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Two-factor authentication</CardTitle>
                <p className="mt-1 text-[0.75rem] text-muted">
                  A second factor for sign-in, using an authenticator app.
                </p>
              </div>
              <Badge variant="warning">Not enabled</Badge>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-2.5 rounded-xl bg-canvas p-3.5">
                <Smartphone className="mt-0.5 size-4 shrink-0 text-muted" strokeWidth={1.9} aria-hidden />
                <p className="text-[0.6875rem] leading-relaxed text-muted">
                  TOTP enrolment is enabled on the authentication service but the enrolment screen
                  ships in the next increment. Until then, treat your password and device lock as
                  the only factors protecting this account.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Account protection</CardTitle>
                <p className="mt-1 text-[0.75rem] text-muted">What is already enforced.</p>
              </div>
              <span className="grid size-8 place-items-center rounded-lg bg-brand-50 text-brand-700">
                <ShieldCheck className="size-4" strokeWidth={1.9} aria-hidden />
              </span>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-[0.75rem] leading-relaxed text-muted">
                <li>· Sessions are refreshed and revalidated with the auth server on every request.</li>
                <li>· Row-level security isolates your profile, consent and affordability data.</li>
                <li>· Identity numbers are never stored; only a masked record and a one-way digest.</li>
                <li>
                  · Signed in as <span className="font-medium text-ink-900">{profile.email}</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
