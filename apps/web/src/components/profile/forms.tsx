"use client";

import { useActionState } from "react";
import { FormAlert, TextField, TextareaField } from "@/components/forms/primitives";
import { Button } from "@/components/ui/primitives";
import { initialFormState } from "@/lib/form";
import { changePasswordAction, updateProfileAction } from "@/server/actions/profile";

export type ProfileValues = {
  readonly first_name: string;
  readonly last_name: string;
  readonly phone: string | null;
  readonly date_of_birth: string | null;
  readonly state: string | null;
  readonly address_line: string | null;
};

export function UpdateProfileForm({ profile }: { readonly profile: ProfileValues }) {
  const [state, action, pending] = useActionState(updateProfileAction, initialFormState);

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
        error={state.fieldErrors?.phone}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="date_of_birth"
          type="date"
          label="Date of birth"
          optional
          defaultValue={profile.date_of_birth ?? ""}
          error={state.fieldErrors?.date_of_birth}
        />
        <TextField
          id="state"
          label="State"
          optional
          defaultValue={profile.state ?? ""}
          error={state.fieldErrors?.state}
        />
      </div>

      <TextareaField
        id="address_line"
        label="Address"
        optional
        defaultValue={profile.address_line ?? ""}
        error={state.fieldErrors?.address_line}
      />

      <FormAlert state={state} />

      <Button type="submit" size="md" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, initialFormState);

  return (
    <form action={action} className="space-y-4" noValidate>
      <TextField
        id="current_password"
        type="password"
        label="Current password"
        autoComplete="current-password"
        required
        error={state.fieldErrors?.current_password}
      />
      <TextField
        id="password"
        type="password"
        label="New password"
        autoComplete="new-password"
        required
        minLength={12}
        hint="At least 12 characters, including a letter and a number."
        error={state.fieldErrors?.password}
      />
      <TextField
        id="confirm_password"
        type="password"
        label="Confirm new password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.confirm_password}
      />

      <FormAlert state={state} />

      <Button type="submit" size="md" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
