"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import {
  CheckboxField,
  FormAlert,
  TextField,
} from "@/components/forms/primitives";
import { Button } from "@/components/ui/primitives";
import { initialFormState } from "@/lib/form";
import {
  requestPasswordResetAction,
  resendVerificationAction,
  resetPasswordAction,
  signInAction,
  signUpAction,
} from "@/server/actions/auth";

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUpAction, initialFormState);

  return (
    <form action={action} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="first_name"
          label="First name"
          autoComplete="given-name"
          required
          maxLength={80}
          error={state.fieldErrors?.first_name}
        />
        <TextField
          id="last_name"
          label="Last name"
          autoComplete="family-name"
          required
          maxLength={80}
          error={state.fieldErrors?.last_name}
        />
      </div>

      <TextField
        id="email"
        type="email"
        label="Email address"
        autoComplete="email"
        inputMode="email"
        required
        error={state.fieldErrors?.email}
      />

      <TextField
        id="phone"
        type="tel"
        label="Phone number"
        autoComplete="tel"
        optional
        placeholder="+2348012345678"
        hint="International format. SMS verification arrives when an SMS provider is configured."
        error={state.fieldErrors?.phone}
      />

      <TextField
        id="password"
        type="password"
        label="Password"
        autoComplete="new-password"
        required
        minLength={12}
        maxLength={72}
        hint="At least 12 characters, including a letter and a number."
        error={state.fieldErrors?.password}
      />

      <CheckboxField
        id="terms"
        label={
          <>
            I accept the <Link href="/legal/terms" className="underline">terms of use</Link> and{" "}
            <Link href="/legal/privacy" className="underline">privacy notice</Link>, and I understand
            that saving does not guarantee a loan.
          </>
        }
        error={state.fieldErrors?.terms}
      />

      <FormAlert state={state} />

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Creating your account…" : "Create account"}
        {pending ? null : <ArrowRight className="size-4" aria-hidden />}
      </Button>
    </form>
  );
}

export function SignInForm({ next }: { readonly next?: string }) {
  const [state, action, pending] = useActionState(signInAction, initialFormState);

  return (
    <form action={action} className="space-y-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <TextField
        id="email"
        type="email"
        label="Email address"
        autoComplete="email"
        inputMode="email"
        required
        error={state.fieldErrors?.email}
      />

      <div>
        <TextField
          id="password"
          type="password"
          label="Password"
          autoComplete="current-password"
          required
          error={state.fieldErrors?.password}
        />
        <div className="mt-2 text-right">
          <Link
            href="/forgot-password"
            className="text-[0.6875rem] font-medium text-brand-700 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
      </div>

      <FormAlert state={state} />

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
        {pending ? null : <ArrowRight className="size-4" aria-hidden />}
      </Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, initialFormState);

  return (
    <form action={action} className="space-y-4" noValidate>
      <TextField
        id="email"
        type="email"
        label="Email address"
        autoComplete="email"
        inputMode="email"
        required
        error={state.fieldErrors?.email}
      />

      <FormAlert state={state} />

      <Button type="submit" size="lg" className="w-full" disabled={pending || state.status === "success"}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(resetPasswordAction, initialFormState);
  const done = state.status === "success";

  return (
    <form action={action} className="space-y-4" noValidate>
      <TextField
        id="password"
        type="password"
        label="New password"
        autoComplete="new-password"
        required
        minLength={12}
        maxLength={72}
        hint="At least 12 characters, including a letter and a number."
        error={state.fieldErrors?.password}
      />
      <TextField
        id="confirm_password"
        type="password"
        label="Confirm new password"
        autoComplete="new-password"
        required
        minLength={12}
        maxLength={72}
        error={state.fieldErrors?.confirm_password}
      />

      <FormAlert state={state} />

      {done ? (
        <Link
          href="/app"
          className="inline-flex h-11 w-full items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white"
        >
          Go to dashboard
        </Link>
      ) : (
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Updating…" : "Update password"}
        </Button>
      )}
    </form>
  );
}

export function ResendVerificationForm() {
  const [state, action, pending] = useActionState(resendVerificationAction, initialFormState);

  return (
    <form action={action} className="space-y-4" noValidate>
      <TextField
        id="email"
        type="email"
        label="Email address"
        autoComplete="email"
        inputMode="email"
        required
        error={state.fieldErrors?.email}
      />

      <FormAlert state={state} />

      <Button type="submit" variant="secondary" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Resend confirmation email"}
      </Button>
    </form>
  );
}

