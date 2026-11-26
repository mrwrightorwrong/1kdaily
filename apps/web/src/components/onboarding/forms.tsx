"use client";

import { useActionState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import {
  CheckboxField,
  FormAlert,
  SelectField,
  TextField,
  TextareaField,
} from "@/components/forms/primitives";
import { Badge, Button, Card, CardContent } from "@/components/ui/primitives";
import { initialFormState } from "@/lib/form";
import { employmentStatuses } from "@/lib/validation";
import { saveFinancialAction, saveProfileAction } from "@/server/actions/onboarding";
import { submitIdentityAction } from "@/server/actions/identity";

const EMPLOYMENT_LABELS: Record<(typeof employmentStatuses)[number], string> = {
  salaried: "Salaried employee",
  self_employed: "Self-employed",
  business_owner: "Business owner",
  student: "Student",
  unemployed: "Not currently earning",
  retired: "Retired",
  other: "Other",
};

export type ProfileDefaults = {
  readonly first_name: string;
  readonly last_name: string;
  readonly phone: string | null;
  readonly date_of_birth: string | null;
  readonly state: string | null;
  readonly address_line: string | null;
};

export function ProfileForm({ profile }: { readonly profile: ProfileDefaults }) {
  const [state, action, pending] = useActionState(saveProfileAction, initialFormState);

  return (
    <form action={action} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="first_name"
          label="First name"
          autoComplete="given-name"
          required
          defaultValue={profile.first_name}
          error={state.fieldErrors?.first_name}
        />
        <TextField
          id="last_name"
          label="Last name"
          autoComplete="family-name"
          required
          defaultValue={profile.last_name}
          error={state.fieldErrors?.last_name}
        />
      </div>

      <TextField
        id="phone"
        type="tel"
        label="Phone number"
        autoComplete="tel"
        optional
        placeholder="+2348012345678"
        defaultValue={profile.phone ?? ""}
        hint="International format. SMS delivery is not configured in this environment yet."
        error={state.fieldErrors?.phone}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="date_of_birth"
          type="date"
          label="Date of birth"
          autoComplete="bday"
          optional
          defaultValue={profile.date_of_birth ?? ""}
          hint="You must be 18 or older."
          error={state.fieldErrors?.date_of_birth}
        />
        <TextField
          id="state"
          label="State"
          optional
          defaultValue={profile.state ?? ""}
          placeholder="Lagos"
          error={state.fieldErrors?.state}
        />
      </div>

      <TextareaField
        id="address_line"
        label="Address"
        optional
        defaultValue={profile.address_line ?? ""}
        placeholder="Street, area, city"
        error={state.fieldErrors?.address_line}
      />

      <FormAlert state={state} />

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Continue to identity"}
        {pending ? null : <ArrowRight className="size-4" aria-hidden />}
      </Button>
    </form>
  );
}

export type IdentityDefaults = {
  readonly kind: "bvn" | "nin" | null;
  readonly status: string | null;
  readonly last4: string | null;
};

export function IdentityForm({
  existing,
  isMockProvider,
}: {
  readonly existing: readonly IdentityDefaults[];
  readonly isMockProvider: boolean;
}) {
  const [state, action, pending] = useActionState(submitIdentityAction, initialFormState);

  return (
    <form action={action} className="space-y-4" noValidate>
      {existing.length > 0 ? (
        <Card>
          <CardContent className="space-y-2">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-subtle">
              Submitted
            </p>
            {existing.map((record) => (
              <div key={record.kind} className="flex items-center justify-between gap-3">
                <p className="text-[0.8125rem] font-medium text-ink-900">
                  {record.kind?.toUpperCase()} {record.last4 ? `•••• ${record.last4}` : ""}
                </p>
                <Badge
                  variant={
                    record.status === "verified"
                      ? "success"
                      : record.status === "failed"
                        ? "danger"
                        : "warning"
                  }
                >
                  {record.status?.replace("_", " ")}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <SelectField
        id="kind"
        label="Document type"
        required
        error={state.fieldErrors?.kind}
        defaultValue={existing[0]?.kind === "bvn" ? "nin" : "bvn"}
      >
        <option value="bvn">BVN — Bank Verification Number</option>
        <option value="nin">NIN — National Identification Number</option>
      </SelectField>

      <TextField
        id="number"
        label="11-digit number"
        inputMode="numeric"
        autoComplete="off"
        required
        maxLength={18}
        placeholder="•••• ••• ••••"
        hint="Sent once to the verification provider. Only the last four digits are ever stored."
        error={state.fieldErrors?.number}
      />

      <CheckboxField
        id="consent"
        label="I consent to 1kDaily verifying this number with an authorised identity provider. I understand the number itself is not stored on 1kDaily's servers."
        error={state.fieldErrors?.consent}
      />

      {isMockProvider ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-warn-500/25 bg-warn-50 p-3">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-warn-500" strokeWidth={2} aria-hidden />
          <p className="text-[0.6875rem] leading-relaxed text-[#7a5300]">
            This environment uses a mock verification provider. Do not enter a real BVN or NIN.
            A number ending in 0000 simulates a failed check.
          </p>
        </div>
      ) : null}

      <FormAlert state={state} />

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Verifying…" : "Submit for verification"}
      </Button>
    </form>
  );
}

export function FinancialForm() {
  const [state, action, pending] = useActionState(saveFinancialAction, initialFormState);

  return (
    <form action={action} className="space-y-4" noValidate>
      <SelectField
        id="employment_status"
        label="Employment status"
        required
        defaultValue=""
        error={state.fieldErrors?.employment_status}
      >
        <option value="" disabled>
          Select one
        </option>
        {employmentStatuses.map((status) => (
          <option key={status} value={status}>
            {EMPLOYMENT_LABELS[status]}
          </option>
        ))}
      </SelectField>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="income_source"
          label="Income source"
          optional
          placeholder="Salary, trading, freelance"
          error={state.fieldErrors?.income_source}
        />
        <TextField
          id="business_type"
          label="Business type"
          optional
          placeholder="Retail, services, agriculture"
          error={state.fieldErrors?.business_type}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          id="monthly_income"
          label="Monthly income (₦)"
          inputMode="decimal"
          placeholder="450,000"
          hint="Before deductions"
          error={state.fieldErrors?.monthly_income}
        />
        <TextField
          id="monthly_obligations"
          label="Monthly obligations (₦)"
          inputMode="decimal"
          placeholder="120,000"
          hint="Rent, family, existing loans"
          error={state.fieldErrors?.monthly_obligations}
        />
        <TextField
          id="existing_debt"
          label="Existing debt (₦)"
          inputMode="decimal"
          placeholder="0"
          hint="Total outstanding"
          error={state.fieldErrors?.existing_debt}
        />
      </div>

      <div className="rounded-xl border border-line bg-canvas p-3.5">
        <p className="text-[0.6875rem] leading-relaxed text-muted">
          These figures are self-declared and used only to assess affordability. They are visible to
          you and to staff with a credit permission. Verified income is a separate, later step and is
          never inferred from this form.
        </p>
      </div>

      <FormAlert state={state} />

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Finish setup"}
        {pending ? null : <ArrowRight className="size-4" aria-hidden />}
      </Button>
    </form>
  );
}
