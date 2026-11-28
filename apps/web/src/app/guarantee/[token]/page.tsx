import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Money } from "@/components/finance/money";
import { CheckboxField, TextField } from "@/components/forms/primitives";
import { Badge, Button, Card, CardContent } from "@/components/ui/primitives";
import { signOutAction } from "@/server/actions/auth";
import { respondToGuarantorInvitationAction } from "@/server/actions/guarantors";
import { getCurrentUser } from "@/server/auth/session";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

export const metadata: Metadata = {
  title: "Guarantor invitation",
  robots: { index: false, follow: false },
};

function Shell({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 py-10">
      <div className="mb-6">
        <Logo href={null} size="md" />
      </div>
      <Card>
        <CardContent className="space-y-4 py-6">{children}</CardContent>
      </Card>
      <p className="mt-4 text-center text-[0.625rem] leading-relaxed text-subtle">
        Private invitation · only the invited email address can accept it.
      </p>
    </div>
  );
}

function Notice({
  tone,
  title,
  children,
}: {
  readonly tone: "success" | "danger" | "neutral";
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  const Icon = tone === "success" ? CheckCircle2 : tone === "danger" ? XCircle : ShieldCheck;
  return (
    <div className="space-y-2 text-center">
      <Icon
        className={
          tone === "success"
            ? "mx-auto size-8 text-brand-600"
            : tone === "danger"
              ? "mx-auto size-8 text-danger-600"
              : "mx-auto size-8 text-muted"
        }
        strokeWidth={1.7}
        aria-hidden
      />
      <h1 className="text-[1.125rem] font-semibold text-ink-900">{title}</h1>
      <div className="text-[0.8125rem] leading-relaxed text-muted">{children}</div>
    </div>
  );
}

export default async function GuaranteePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/guarantee/${token}`)}`);

  const admin = createSupabaseAdminClient();
  const { data: invitation } = await admin
    .from("guarantor_invitations")
    .select("id, application_id, email, status, expires_at, borrower_id")
    .eq("token", token)
    .maybeSingle();

  if (!invitation) {
    return (
      <Shell>
        <Notice tone="danger" title="Invitation not found">
          This link is not valid. Ask the borrower to send a fresh invitation.
        </Notice>
      </Shell>
    );
  }

  const [{ data: application }, { data: borrower }, { data: guarantor }] = await Promise.all([
    admin
      .from("loan_applications")
      .select("reference, requested_amount_kobo, status")
      .eq("id", invitation.application_id)
      .maybeSingle(),
    admin
      .from("user_profiles")
      .select("first_name, last_name")
      .eq("id", invitation.borrower_id)
      .maybeSingle(),
    admin
      .from("guarantors")
      .select("status, consented_at")
      .eq("invitation_id", invitation.id)
      .maybeSingle(),
  ]);

  const expired = new Date(invitation.expires_at).getTime() < Date.now();
  const sameEmail = (user.email ?? "").toLowerCase() === invitation.email.toLowerCase();
  const open = invitation.status === "invited" && !expired;

  const borrowerName = [borrower?.first_name, borrower?.last_name]
    .filter(Boolean)
    .join(" ");
  const displayName = borrowerName || "The borrower";
  const amount = application ? BigInt(application.requested_amount_kobo) : null;

  if (!sameEmail) {
    return (
      <Shell>
        <Notice tone="danger" title="This invitation is for a different address">
          It was sent to <span className="font-medium text-ink-900">{invitation.email}</span>. You are
          signed in as <span className="font-medium text-ink-900">{user.email}</span>.
        </Notice>
        <form action={signOutAction}>
          <Button type="submit" variant="secondary" size="md" className="w-full">
            Sign out and switch account
          </Button>
        </form>
      </Shell>
    );
  }

  if (query.done === "accepted" || invitation.status === "accepted") {
    return (
      <Shell>
        <Notice tone="success" title="You are recorded as a guarantor">
          You consented{guarantor?.consented_at ? ` on ${new Date(guarantor.consented_at).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}` : ""} for{" "}
          {displayName}&apos;s loan{amount ? <> of <Money value={amount} decimals={0} /></> : null}.
        </Notice>
        <ul className="space-y-2 rounded-xl border border-line bg-canvas p-3.5 text-[0.75rem] leading-relaxed text-muted">
          <li>This is a reference check, not a payment obligation to 1kDaily.</li>
          <li>You have no access to the borrower&apos;s account and no funds are taken from you.</li>
          <li>You will be released when the loan is settled, and you can contact support at any time.</li>
        </ul>
      </Shell>
    );
  }

  if (query.done === "declined" || invitation.status === "declined") {
    return (
      <Shell>
        <Notice tone="neutral" title="You declined this invitation">
          Nothing else is needed. The borrower has been told and can invite someone else.
        </Notice>
      </Shell>
    );
  }

  if (!open) {
    return (
      <Shell>
        <Notice tone="neutral" title={expired ? "This invitation has expired" : "This invitation is closed"}>
          {expired
            ? "Invitations last seven days. Ask the borrower to send a new one."
            : "This invitation has already been used or withdrawn."}
        </Notice>
      </Shell>
    );
  }

  return (
    <Shell>
      <div>
        <Badge variant="warning">Guarantor request</Badge>
        <h1 className="mt-2 text-[1.25rem] font-semibold tracking-[-0.01em] text-ink-900">
          {displayName} has asked you to guarantee a loan
        </h1>
        <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">
          {amount ? (
            <>
              Requested amount: <span className="font-medium text-ink-900"><Money value={amount} decimals={0} /></span>.
            </>
          ) : null}{" "}
          Review this carefully before you accept.
        </p>
      </div>

      {query.error ? (
        <div role="alert" className="rounded-xl border border-danger-600/25 bg-danger-50 px-3.5 py-3 text-[0.75rem] text-[#8f1d1d]">
          {query.error}
        </div>
      ) : null}

      <ul className="space-y-2 rounded-xl border border-line bg-canvas p-3.5 text-[0.75rem] leading-relaxed text-muted">
        <li>You are confirming that you know this person and that they have told you about this loan.</li>
        <li>This is not a co-borrower role: no money is taken from you and you get no account access.</li>
        <li>1kDaily may contact you to confirm the reference before disbursement.</li>
      </ul>

      <form action={respondToGuarantorInvitationAction} className="space-y-3">
        <input type="hidden" name="token" value={token} />
        <TextField
          id="full_name"
          name="full_name"
          label="Your full name"
          required
          maxLength={120}
          autoComplete="name"
          placeholder="As it appears on your ID"
        />
        <TextField
          id="relationship"
          name="relationship"
          label="Relationship to the borrower"
          optional
          maxLength={80}
          placeholder="e.g. Colleague, sibling, friend"
        />
        <CheckboxField
          id="consent"
          name="consent"
          required
          label="I agree to be named as a guarantor for this loan on these terms."
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" name="decision" value="accept" variant="primary" size="md">
            Accept as guarantor
          </Button>
        </div>
      </form>

      <form action={respondToGuarantorInvitationAction}>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="decision" value="decline" />
        <Button type="submit" variant="secondary" size="md" className="w-full">
          Decline this request
        </Button>
      </form>
    </Shell>
  );
}
