"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { identityLast4 } from "@1kdaily/core";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { getKycProvider } from "@/server/integrations/kyc";
import { IDENTITY_DIGEST_VERSION, identityDigest } from "@/server/security/identity";
import { getProfile, requireUser } from "@/server/auth/session";
import type { FormState } from "@/lib/form";
import { firstFieldErrors, formToObject, identitySchema } from "@/lib/validation";

const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Submit a BVN or NIN for verification.
 *
 * The raw value lives only in this function's scope:
 *   browser → server action → vendor API → discarded
 *
 * Persisted: last4, HMAC digest, vendor reference, status. Nothing else.
 * The digest is computed with a server-only pepper so a database leak cannot be
 * brute-forced against the 11-digit space.
 */
export async function submitIdentityAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const parsed = identitySchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the details and try again.",
      fieldErrors: firstFieldErrors(parsed.error),
    };
  }

  const { kind, number } = parsed.data;
  const label = kind.toUpperCase();

  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  // --- Existing state and rate limiting -----------------------------------
  const { data: existing } = await admin
    .from("identity_documents")
    .select("id, status, attempt_count, updated_at")
    .eq("user_id", user.id)
    .eq("kind", kind)
    .maybeSingle();

  if (existing?.status === "verified") {
    return { status: "error", message: `Your ${label} is already verified.` };
  }

  const withinWindow =
    existing !== null && Date.now() - new Date(existing.updated_at).getTime() < ATTEMPT_WINDOW_MS;
  const previousAttempts = withinWindow ? (existing?.attempt_count ?? 0) : 0;

  if (previousAttempts >= MAX_ATTEMPTS) {
    return {
      status: "error",
      message:
        "Too many attempts for this document. Try again in 24 hours, or contact support if your details are correct.",
    };
  }

  // --- Consent evidence, recorded before the vendor call -------------------
  const consent = await supabase.rpc("record_consent", {
    p_purpose: "identity_verification",
    p_document_version: "2026-11",
    p_granted: true,
  });

  if (consent.error) {
    console.error("[identity] consent write failed", consent.error.code ?? "unknown");
    return { status: "error", message: "We could not record your consent. Please try again." };
  }

  // --- Vendor verification -------------------------------------------------
  // The provider receives the value in memory only. Errors are never logged with
  // the value (and some vendors echo input in error messages).
  let result;
  try {
    result = await getKycProvider().verify({ kind, value: number, userId: user.id });
  } catch {
    console.error("[identity] provider call failed");
    return {
      status: "error",
      message: "Verification is temporarily unavailable. Please try again in a moment.",
    };
  }

  const digest = identityDigest(kind, number);
  const last4 = identityLast4(number);
  const documentStatus =
    result.status === "verified" ? "verified" : result.status === "failed" ? "failed" : "needs_review";
  const verificationStatus =
    documentStatus === "verified" ? "verified" : documentStatus === "failed" ? "failed" : "pending";

  // --- Persist the masked record only -------------------------------------
  const { data: saved, error: saveError } = await admin
    .from("identity_documents")
    .upsert(
      {
        user_id: user.id,
        kind,
        status: documentStatus,
        match_result: result.matchResult,
        last4,
        digest,
        digest_key_version: IDENTITY_DIGEST_VERSION,
        vendor: result.vendor,
        vendor_reference: result.reference,
        attempt_count: previousAttempts + 1,
        verified_at: documentStatus === "verified" ? new Date().toISOString() : null,
      },
      { onConflict: "user_id,kind" },
    )
    .select("id")
    .single();

  if (saveError) {
    if (saveError.code === "23505") {
      return {
        status: "error",
        message:
          "This identity number is already linked to another 1kDaily account. Contact support if you believe this is a mistake.",
      };
    }
    console.error("[identity] persistence failed", saveError.code ?? "unknown");
    return {
      status: "error",
      message: "We could not save your verification. Please try again.",
    };
  }

  // --- Status + audit ------------------------------------------------------
  await admin.from("user_verifications").upsert(
    {
      user_id: user.id,
      kind,
      status: verificationStatus,
      vendor: result.vendor,
      vendor_reference: result.reference,
      verified_at: documentStatus === "verified" ? new Date().toISOString() : null,
      failure_code: documentStatus === "failed" ? (result.reasonCode ?? null) : null,
    },
    { onConflict: "user_id,kind" },
  );

  await admin.from("audit_logs").insert({
    actor_id: user.id,
    actor_role: null,
    action: "identity.submit",
    entity_type: "identity_document",
    entity_id: saved.id,
    after_state: {
      kind,
      last4,
      status: documentStatus,
      vendor: result.vendor,
      digest_key_version: IDENTITY_DIGEST_VERSION,
    },
    reason: "Customer submitted identity for verification",
  });

  // --- Continue ------------------------------------------------------------
  const profile = await getProfile();
  const wasOnboarding = profile?.onboarding_step === "identity";

  if (wasOnboarding) {
    await supabase.rpc("advance_onboarding", { p_step: "financial" });
  }

  revalidatePath("/app");
  revalidatePath("/app/profile");

  redirect(
    wasOnboarding
      ? `/onboarding/financial?identity=${result.status}`
      : `/app/profile?identity=${result.status}`,
  );
}
