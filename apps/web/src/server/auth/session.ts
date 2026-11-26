import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/server/supabase/server";

export type Profile = {
  readonly id: string;
  readonly email: string;
  readonly email_verified: boolean;
  readonly first_name: string;
  readonly last_name: string;
  readonly phone: string | null;
  readonly date_of_birth: string | null;
  readonly state: string | null;
  readonly address_line: string | null;
  readonly onboarding_step: "profile" | "identity" | "financial" | "complete";
  readonly onboarding_completed_at: string | null;
  readonly status: "active" | "restricted" | "suspended" | "closed";
  readonly created_at: string;
};

export type VerificationStatus = {
  readonly kind: string;
  readonly status: string;
  readonly verified_at: string | null;
  readonly vendor: string | null;
};

export type IdentitySummary = {
  readonly kind: "bvn" | "nin";
  readonly status: string;
  readonly last4: string;
  readonly match_result: string | null;
  readonly submitted_at: string;
  readonly verified_at: string | null;
};

export const getCurrentUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("my_profile");
  if (error) {
    console.error("[auth] my_profile failed", error.message);
    return null;
  }
  const rows = (data ?? []) as Profile[];
  return rows[0] ?? null;
});

export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) {
    // Authenticated but no profile row (should be impossible: the sign-up
    // trigger creates it). Send the user to sign in rather than loop.
    redirect("/sign-in");
  }
  return profile;
}

export const getVerificationStatuses = cache(async (): Promise<VerificationStatus[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("my_verification_status");
  if (error) {
    console.error("[auth] my_verification_status failed", error.message);
    return [];
  }
  return (data ?? []) as VerificationStatus[];
});

export const getIdentitySummary = cache(async (): Promise<IdentitySummary[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("my_identity_summary");
  if (error) {
    console.error("[auth] my_identity_summary failed", error.message);
    return [];
  }
  return (data ?? []) as IdentitySummary[];
});

export type FinancialProfile = {
  readonly employment_status: string;
  readonly income_source: string | null;
  readonly business_type: string | null;
  readonly monthly_income_kobo: string;
  readonly monthly_obligations_kobo: string;
  readonly existing_debt_kobo: string;
};

export const getFinancialProfile = cache(async (): Promise<FinancialProfile | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("user_financial_profiles")
    .select(
      "employment_status, income_source, business_type, monthly_income_kobo, monthly_obligations_kobo, existing_debt_kobo",
    )
    .maybeSingle();

  if (error) {
    console.error("[auth] financial profile read failed", error.code ?? "unknown");
    return null;
  }
  return (data as FinancialProfile | null) ?? null;
});

export const getPermissions = cache(async (): Promise<string[]> => {  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("my_permissions");
  if (error) {
    console.error("[auth] my_permissions failed", error.message);
    return [];
  }
  return ((data ?? []) as Array<{ my_permissions?: string } | string>).map((row) =>
    typeof row === "string" ? row : (row.my_permissions ?? ""),
  ).filter(Boolean);
});

export async function hasPermission(permission: string): Promise<boolean> {
  const permissions = await getPermissions();
  return permissions.includes(permission);
}

export type ConsentRecord = {
  readonly purpose: string;
  readonly document_version: string;
  readonly granted: boolean;
  readonly granted_at: string;
  readonly revoked_at: string | null;
};

export const getConsents = cache(async (): Promise<ConsentRecord[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("consent_records")
    .select("purpose, document_version, granted, granted_at, revoked_at")
    .order("granted_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[auth] consents read failed", error.code ?? "unknown");
    return [];
  }
  return (data ?? []) as ConsentRecord[];
});
