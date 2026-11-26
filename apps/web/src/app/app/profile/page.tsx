import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, CircleDashed, Lock, ShieldCheck } from "lucide-react";
import { Money } from "@/components/finance/money";
import { IdentityForm } from "@/components/onboarding/forms";
import { UpdateProfileForm } from "@/components/profile/forms";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  buttonVariants,
} from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { serverEnv } from "@/lib/env";
import {
  getConsents,
  getFinancialProfile,
  getIdentitySummary,
  getVerificationStatuses,
  requireProfile,
} from "@/server/auth/session";

export const metadata: Metadata = { title: "Profile" };

const EMPLOYMENT_LABELS: Record<string, string> = {
  salaried: "Salaried employee",
  self_employed: "Self-employed",
  business_owner: "Business owner",
  student: "Student",
  unemployed: "Not currently earning",
  retired: "Retired",
  other: "Other",
};

function statusBadge(status: string) {
  if (status === "verified") return <Badge variant="success">Verified</Badge>;
  if (status === "failed") return <Badge variant="danger">Failed</Badge>;
  if (status === "needs_review" || status === "pending") {
    return <Badge variant="warning">In review</Badge>;
  }
  if (status === "unverified") return <Badge variant="neutral">Not provided</Badge>;
  return <Badge variant="neutral">{status.replace(/_/g, " ")}</Badge>;
}

export default async function ProfilePage() {
  const profile = await requireProfile();
  const [verifications, identity, financial, consents] = await Promise.all([
    getVerificationStatuses(),
    getIdentitySummary(),
    getFinancialProfile(),
    getConsents(),
  ]);

  const byKind = new Map(verifications.map((record) => [record.kind, record]));
  const identityByKind = new Map(identity.map((record) => [record.kind, record]));
  const emailStatus = byKind.get("email")?.status ?? "unverified";
  const phoneStatus = byKind.get("phone")?.status ?? (profile.phone ? "unverified" : "unverified");
  const displayName =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email;
  const initials =
    `${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}`.trim().toUpperCase() ||
    profile.email.slice(0, 2).toUpperCase();

  return (
    <div className="animate-rise space-y-4">
      <div className="flex flex-wrap items-center gap-4 rounded-card border border-line bg-surface p-5 shadow-card">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-ink-900 text-[1rem] font-semibold text-white">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[1.375rem] font-semibold tracking-[-0.02em] text-ink-900">
            {displayName}
          </h1>
          <p className="truncate text-[0.8125rem] text-muted">{profile.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={profile.status === "active" ? "success" : "danger"}>{profile.status}</Badge>
          <Link href="/app/security" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
            <Lock className="size-3.5" aria-hidden />
            Security
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Personal details</CardTitle>
              <p className="mt-1 text-[0.75rem] text-muted">
                Used for your account and, where required, verification.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <UpdateProfileForm
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

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Verification</CardTitle>
                <p className="mt-1 text-[0.75rem] text-muted">
                  What we have confirmed, and what is still open.
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex items-center justify-between gap-3 border-b border-line py-2.5">
                <span className="text-[0.8125rem] text-body">Email</span>
                <div className="flex items-center gap-2">
                  <span className="text-[0.6875rem] text-subtle">{profile.email}</span>
                  {statusBadge(emailStatus)}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 border-b border-line py-2.5">
                <span className="text-[0.8125rem] text-body">Phone</span>
                <div className="flex items-center gap-2">
                  <span className="text-[0.6875rem] text-subtle">{profile.phone ?? "Not provided"}</span>
                  {phoneStatus === "verified" ? (
                    statusBadge("verified")
                  ) : (
                    <Badge variant="neutral">Unverified</Badge>
                  )}
                </div>
              </div>

              {(["bvn", "nin"] as const).map((kind) => {
                const record = identityByKind.get(kind);
                return (
                  <div
                    key={kind}
                    className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-0"
                  >
                    <span className="text-[0.8125rem] text-body">{kind.toUpperCase()}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[0.6875rem] text-subtle">
                        {record ? `•••• ${record.last4}` : "Not provided"}
                      </span>
                      {statusBadge(record?.status ?? "unverified")}
                    </div>
                  </div>
                );
              })}

              <div className="flex items-start gap-2 rounded-xl bg-canvas p-3">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-brand-700" aria-hidden />
                <p className="text-[0.625rem] leading-relaxed text-muted">
                  Only the last four digits are stored. The number itself is sent once to the
                  verification provider and never written to our database.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Identity documents</CardTitle>
                <p className="mt-1 text-[0.75rem] text-muted">
                  Add the other document to raise your verification level.
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-[0.75rem] font-medium text-ink-900">
                  Add or retry a document
                  <span className="text-subtle transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <div className="pt-4">
                  <IdentityForm
                    existing={identity.map((record) => ({
                      kind: record.kind,
                      status: record.status,
                      last4: record.last4,
                    }))}
                    isMockProvider={serverEnv().kycProvider === "mock"}
                  />
                </div>
              </details>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Affordability</CardTitle>
              <p className="mt-1 text-[0.75rem] text-muted">
                Self-declared. Verified income is a separate, later step.
              </p>
            </div>
            <Badge variant="neutral">Declared</Badge>
          </CardHeader>
          <CardContent>
            {financial ? (
              <dl className="divide-y divide-line">
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-[0.75rem] text-muted">Employment</dt>
                  <dd className="text-[0.8125rem] font-medium text-ink-900">
                    {EMPLOYMENT_LABELS[financial.employment_status] ?? financial.employment_status}
                  </dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-[0.75rem] text-muted">Monthly income</dt>
                  <dd className="text-[0.8125rem] font-medium text-ink-900">
                    <Money value={BigInt(financial.monthly_income_kobo)} decimals={0} />
                  </dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-[0.75rem] text-muted">Monthly obligations</dt>
                  <dd className="text-[0.8125rem] font-medium text-ink-900">
                    <Money value={BigInt(financial.monthly_obligations_kobo)} decimals={0} />
                  </dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-[0.75rem] text-muted">Existing debt</dt>
                  <dd className="text-[0.8125rem] font-medium text-ink-900">
                    <Money value={BigInt(financial.existing_debt_kobo)} decimals={0} />
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-[0.8125rem] text-muted">
                No affordability profile on file. It is collected during onboarding and revisited
                with the eligibility engine in Phase 6.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Consent record</CardTitle>
              <p className="mt-1 text-[0.75rem] text-muted">
                Immutable evidence of what you agreed to, and when.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {consents.length === 0 ? (
              <p className="text-[0.8125rem] text-muted">No consent records yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {consents.map((consent) => (
                  <li
                    key={`${consent.purpose}-${consent.granted_at}`}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div>
                      <p className="text-[0.8125rem] font-medium capitalize text-ink-900">
                        {consent.purpose.replace(/_/g, " ")}
                      </p>
                      <p className="text-[0.625rem] text-subtle">
                        {new Date(consent.granted_at).toLocaleDateString("en-NG", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}{" "}
                        · {consent.document_version}
                      </p>
                    </div>
                    {consent.granted ? (
                      <CircleCheck className="size-4 text-brand-600" aria-label="Granted" />
                    ) : (
                      <CircleDashed className="size-4 text-subtle" aria-label="Declined" />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
