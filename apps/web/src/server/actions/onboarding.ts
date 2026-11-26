"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseNairaToKobo, MoneyError } from "@1kdaily/core";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { requireProfile } from "@/server/auth/session";
import type { FormState } from "@/lib/form";
import {
  financialProfileSchema,
  firstFieldErrors,
  formToObject,
  profileSchema,
} from "@/lib/validation";

export async function saveProfileAction(_previous: FormState, formData: FormData): Promise<FormState> {
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

  const advanced = await supabase.rpc("advance_onboarding", { p_step: "identity" });
  if (advanced.error) {
    // Non-fatal: the step is cosmetic, the profile is saved.
    console.error("[onboarding] advance failed", advanced.error.message);
  }

  revalidatePath("/app");
  redirect("/onboarding/identity");
}

function parseOptionalMoney(value: string | undefined): bigint {
  if (!value || value.trim() === "") return 0n;
  return parseNairaToKobo(value);
}

export async function saveFinancialAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = financialProfileSchema.safeParse(formToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
    };
  }

  const fieldErrors: Record<string, string> = {};

  const parseMoneyField = (field: string, raw: string | undefined): bigint => {
    try {
      return parseOptionalMoney(raw);
    } catch (error) {
      fieldErrors[field] = error instanceof MoneyError ? error.message : "Enter a valid amount.";
      return 0n;
    }
  };

  const income = parseMoneyField("monthly_income", parsed.data.monthly_income);
  const obligations = parseMoneyField("monthly_obligations", parsed.data.monthly_obligations);
  const debt = parseMoneyField("existing_debt", parsed.data.existing_debt);

  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", message: "Check the amounts you entered.", fieldErrors };
  }

  if (obligations > income && income > 0n) {
    return {
      status: "error",
      message: "Monthly obligations cannot be higher than monthly income.",
      fieldErrors: { monthly_obligations: "Must not exceed your monthly income" },
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("save_financial_profile", {
    p_employment_status: parsed.data.employment_status,
    p_income_source: parsed.data.income_source || null,
    p_business_type: parsed.data.business_type || null,
    p_monthly_income_kobo: String(income),
    p_monthly_obligations_kobo: String(obligations),
    p_existing_debt_kobo: String(debt),
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  const advanced = await supabase.rpc("advance_onboarding", { p_step: "complete" });
  if (advanced.error) {
    console.error("[onboarding] completion failed", advanced.error.message);
  }

  revalidatePath("/app");
  redirect("/app");
}

export async function skipIdentityAction(): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();

  if (profile.onboarding_step === "identity") {
    await supabase.rpc("advance_onboarding", { p_step: "financial" });
  }

  redirect("/onboarding/financial");
}
