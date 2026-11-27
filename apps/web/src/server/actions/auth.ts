"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { requestOrigin } from "@/server/http";
import { safeNextPath, type FormState } from "@/lib/form";
import {
  firstFieldErrors,
  forgotPasswordSchema,
  formToObject,
  resendVerificationSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validation";

const TERMS_VERSION = "2026-11";
const GENERIC_CREDENTIALS = "Email or password is incorrect.";
const GENERIC_FAILURE = "Something went wrong. Please try again.";

function mapAuthError(error: { message: string; code?: string }): string {
  const lower = error.message.toLowerCase();
  const code = error.code ?? "";

  if (code === "email_address_invalid" || lower.includes("is invalid")) {
    return "Enter a valid email address.";
  }
  if (code === "over_email_send_rate_limit" || lower.includes("email rate limit")) {
    return "Confirmation emails are temporarily rate-limited. Try again in a few minutes.";
  }
  if (lower.includes("invalid login credentials")) return GENERIC_CREDENTIALS;
  if (lower.includes("email not confirmed")) {
    return "Confirm your email address before signing in. Check your inbox for the link.";
  }
  if (lower.includes("already registered") || lower.includes("already been registered")) {
    return "An account with this email already exists. Sign in instead, or reset your password.";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Too many attempts. Wait a few minutes and try again.";
  }
  if (lower.includes("password should") || lower.includes("password is too")) return error.message;
  return GENERIC_FAILURE;
}

export async function signUpAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const raw = formToObject(formData);
  const parsed = signUpSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
    };
  }

  if (raw.terms !== "on") {
    return {
      status: "error",
      message: "Accept the terms and privacy notice to continue.",
      fieldErrors: { terms: "Required" },
    };
  }

  const { first_name, last_name, email, phone, password } = parsed.data;
  const origin = await requestOrigin();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name,
        last_name,
        accepted_terms: true,
        terms_version: TERMS_VERSION,
        ...(phone ? { phone } : {}),
      },
      emailRedirectTo: `${origin}/auth/callback?next=/onboarding/profile`,
    },
  });

  if (error) {
    return { status: "error", message: mapAuthError(error) };
  }

  // With email confirmation enabled Supabase returns a user with no identities
  // when the address is already registered. Do not reveal which case it is.
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return { status: "success", message: "Check your inbox to continue." };
  }

  if (data.session) {
    redirect("/onboarding/profile");
  }

  redirect("/verify-email");
}

export async function signInAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse(formToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
    };
  }

  let signInError: { message: string; code?: string } | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    const result = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    signInError = result.error;
  } catch (thrown) {
    console.error("[auth] sign-in threw", thrown instanceof Error ? thrown.message.slice(0, 150) : "unknown");
    return {
      status: "error",
      message:
        thrown instanceof Error
          ? `Sign-in could not start: ${thrown.message.slice(0, 160)}`
          : "Sign-in could not start.",
    };
  }

  if (signInError) {
    return { status: "error", message: mapAuthError(signInError) };
  }

  redirect(safeNextPath(String(formData.get("next") ?? "")));
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordResetAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Enter the email address on your account.",
      fieldErrors: firstFieldErrors(parsed.error),
    };
  }

  const origin = await requestOrigin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error && error.message.toLowerCase().includes("rate limit")) {
    return { status: "error", message: "Too many requests. Wait a few minutes and try again." };
  }

  // Always the same response: never disclose whether an address is registered.
  return {
    status: "success",
    message: "If that email is registered, a reset link is on its way. It expires shortly.",
  };
}

export async function resetPasswordAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      status: "error",
      message: "This reset link has expired. Request a new one from the sign-in page.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { status: "error", message: mapAuthError(error) };
  }

  return { status: "success", message: "Password updated. You can continue to your dashboard." };
}

export async function resendVerificationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = resendVerificationSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Enter the email you registered with.",
      fieldErrors: firstFieldErrors(parsed.error),
    };
  }

  const origin = await requestOrigin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/onboarding/profile` },
  });

  if (error && error.message.toLowerCase().includes("rate limit")) {
    return { status: "error", message: "Too many requests. Wait a few minutes and try again." };
  }

  return { status: "success", message: "If that address needs confirmation, a new link is on its way." };
}

