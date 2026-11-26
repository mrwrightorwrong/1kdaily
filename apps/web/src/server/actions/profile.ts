"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { requireUser } from "@/server/auth/session";
import type { FormState } from "@/lib/form";
import { firstFieldErrors, formToObject, profileSchema } from "@/lib/validation";

const passwordChangeSchema = z
  .object({
    current_password: z.string().min(1, "Enter your current password").max(72),
    password: z
      .string()
      .min(12, "Use at least 12 characters")
      .max(72, "Maximum 72 characters")
      .regex(/[A-Za-z]/, "Include at least one letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirm_password: z.string().min(1, "Confirm the new password"),
  })
  .refine((value) => value.password === value.confirm_password, {
    path: ["confirm_password"],
    message: "Passwords do not match",
  });

export async function updateProfileAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = profileSchema.safeParse(formToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
    };
  }

  const { first_name, last_name, phone, date_of_birth, state, address_line } = parsed.data;
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("update_my_profile", {
    p_first_name: first_name,
    p_last_name: last_name,
    p_phone: phone ?? null,
    p_date_of_birth: date_of_birth ?? null,
    p_state: state || null,
    p_address_line: address_line || null,
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  revalidatePath("/app/profile");
  revalidatePath("/app");
  return { status: "success", message: "Profile updated." };
}

/**
 * Password change requires the current password, even though the session is
 * already authenticated: a borrowed laptop should not be enough to lock the
 * owner out.
 */
export async function changePasswordAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = passwordChangeSchema.safeParse(formToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
    };
  }

  const user = await requireUser();
  if (!user.email) {
    return { status: "error", message: "This account has no email address on file." };
  }

  const supabase = await createSupabaseServerClient();

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.current_password,
  });

  if (reauthError) {
    return {
      status: "error",
      message: "Your current password is incorrect.",
      fieldErrors: { current_password: "Incorrect password" },
    };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { status: "error", message: error.message };
  }

  return {
    status: "success",
    message: "Password updated. Other sessions remain signed in until they expire.",
  };
}
