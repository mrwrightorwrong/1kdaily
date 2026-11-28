import { Money } from "@/components/finance/money";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { CopyInviteLink } from "./copy-invite-link";
import { GuarantorInviteForm } from "./guarantor-invite-form";

export type GuarantorInvitationRow = {
  readonly id: string;
  readonly email: string;
  readonly status: string;
  readonly expires_at: string;
  readonly token: string;
  readonly email_status: string;
  readonly email_sent_at: string | null;
};

export type GuarantorRow = {
  readonly id: string;
  readonly full_name: string;
  readonly email: string;
  readonly status: string;
  readonly guarantee_amount_kobo: string;
  readonly consented_at: string | null;
  readonly verified_at: string | null;
};

const INVITATION_VARIANT: Record<string, "warning" | "success" | "neutral" | "info" | "danger"> = {
  invited: "warning",
  opened: "info",
  accepted: "success",
  declined: "neutral",
  expired: "neutral",
  revoked: "neutral",
};

const GUARANTOR_VARIANT: Record<string, "warning" | "success" | "neutral" | "info" | "danger"> = {
  invited: "neutral",
  accepted: "warning",
  verified: "success",
  invalid: "danger",
  declined: "neutral",
  released: "neutral",
};

function when(value: string): string {
  return new Date(value).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function emailLine(invitation: GuarantorInvitationRow): string {
  switch (invitation.email_status) {
    case "sent":
      return invitation.email_sent_at
        ? `Emailed ${when(invitation.email_sent_at)}`
        : "Emailed";
    case "failed":
      return "Email could not be sent — share the link instead";
    case "skipped":
      return "Email delivery is not configured — share the link";
    default:
      return "Email queued";
  }
}

export function GuarantorsCard({
  applicationId,
  invitations,
  guarantors,
}: {
  readonly applicationId: string;
  readonly invitations: ReadonlyArray<GuarantorInvitationRow>;
  readonly guarantors: ReadonlyArray<GuarantorRow>;
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Guarantors</CardTitle>
          <p className="mt-1 max-w-xl text-[0.75rem] leading-relaxed text-muted">
            A guarantor confirms they know you and this loan. They are not a co-borrower, they
            cannot be charged, and they never gain access to your account.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-xl border border-line bg-canvas p-3.5">
          <GuarantorInviteForm applicationId={applicationId} />
        </div>

        {invitations.length > 0 ? (
          <div>
            <p className="text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-subtle">
              Invitations
            </p>
            <ul className="mt-2 space-y-2">
              {invitations.map((invitation) => (
                <li key={invitation.id} className="rounded-xl border border-line px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[0.8125rem] text-ink-900">{invitation.email}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={INVITATION_VARIANT[invitation.status] ?? "neutral"}>
                        {invitation.status}
                      </Badge>
                      <span className="text-[0.625rem] text-subtle">
                        {invitation.status === "invited"
                          ? `expires ${when(invitation.expires_at)}`
                          : when(invitation.expires_at)}
                      </span>
                    </div>
                  </div>
                  {invitation.status === "invited" ? (
                    <CopyInviteLink path={`/guarantee/${invitation.token}`} className="mt-2" />
                  ) : null}
                  <p className="mt-1 text-[0.625rem] text-subtle">{emailLine(invitation)}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {guarantors.length > 0 ? (
          <div>
            <p className="text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-subtle">
              On this application
            </p>
            <ul className="mt-2 space-y-2">
              {guarantors.map((guarantor) => (
                <li
                  key={guarantor.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2.5"
                >
                  <div>
                    <p className="text-[0.8125rem] font-medium text-ink-900">{guarantor.full_name}</p>
                    <p className="text-[0.625rem] text-subtle">
                      {guarantor.email} · guarantees{" "}
                      <Money value={BigInt(guarantor.guarantee_amount_kobo)} decimals={0} />
                    </p>
                  </div>
                  <Badge variant={GUARANTOR_VARIANT[guarantor.status] ?? "neutral"}>
                    {guarantor.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {invitations.length === 0 && guarantors.length === 0 ? (
          <p className="text-[0.75rem] text-muted">
            No guarantor yet. Most applications need one before disbursement.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
