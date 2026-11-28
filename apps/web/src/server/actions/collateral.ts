"use server";

import { revalidatePath } from "next/cache";
import { MoneyError, parseNairaToKobo } from "@1kdaily/core";
import { isCollateralCategory } from "@/lib/collateral";
import { requireUser } from "@/server/auth/session";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";
import type { FormState } from "@/lib/form";

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export async function submitCollateralAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const applicationId = String(formData.get("application_id") ?? "");
  const category = String(formData.get("category") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const estimatedValue = String(formData.get("estimated_value") ?? "").trim();
  const valuationMethod = String(formData.get("valuation_method") ?? "").trim();
  const valuationDate = String(formData.get("valuation_date") ?? "").trim();
  const ownershipEvidence = String(formData.get("ownership_evidence") ?? "").trim();
  const agreementRef = String(formData.get("security_agreement_ref") ?? "").trim();

  if (!applicationId) {
    return { status: "error", message: "Start a loan application before adding collateral." };
  }
  if (!isCollateralCategory(category)) {
    return { status: "error", message: "Choose a collateral category.", fieldErrors: { category: "Choose a category" } };
  }
  if (description.length < 3) {
    return {
      status: "error",
      message: "Describe the asset in a few words.",
      fieldErrors: { description: "Add a short description" },
    };
  }

  let valueKobo: bigint | null = null;
  if (estimatedValue) {
    try {
      valueKobo = parseNairaToKobo(estimatedValue);
    } catch (error) {
      return {
        status: "error",
        message: error instanceof MoneyError ? error.message : "Enter a valid estimated value.",
        fieldErrors: { estimated_value: "Enter a valid amount" },
      };
    }
    if (valueKobo <= 0n) {
      return {
        status: "error",
        message: "An estimated value must be greater than zero.",
        fieldErrors: { estimated_value: "Enter an amount above zero" },
      };
    }
  }

  if (valuationDate && !/^\d{4}-\d{2}-\d{2}$/.test(valuationDate)) {
    return { status: "error", message: "Enter a valid valuation date." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("submit_collateral", {
    p_application_id: applicationId,
    p_category: category,
    p_description: description.slice(0, 400),
    p_estimated_value_kobo: valueKobo === null ? null : valueKobo.toString(),
    p_valuation_method: valuationMethod || null,
    p_valuation_date: valuationDate || null,
    p_ownership_evidence: ownershipEvidence || null,
    p_security_agreement_ref: agreementRef || null,
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  revalidatePath("/app/loans");
  return {
    status: "success",
    message: "Collateral added. It stays pending until a risk officer reviews it.",
  };
}

export async function uploadCollateralDocumentAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const collateralId = String(formData.get("collateral_id") ?? "");
  const documentType = String(formData.get("document_type") ?? "").trim();
  const file = formData.get("file");

  if (!collateralId) return { status: "error", message: "Collateral not found." };
  if (documentType.length < 2) {
    return {
      status: "error",
      message: "Name the document type.",
      fieldErrors: { document_type: "e.g. Vehicle licence" },
    };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose a file to upload.", fieldErrors: { file: "Choose a file" } };
  }
  if (file.size > MAX_BYTES) {
    return { status: "error", message: "Files must be 8 MB or smaller.", fieldErrors: { file: "Too large" } };
  }
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return {
      status: "error",
      message: "Upload a PDF, JPEG, PNG or WebP file.",
      fieldErrors: { file: "Unsupported file type" },
    };
  }

  // Ownership is checked through RLS before a single byte is uploaded.
  const session = await createSupabaseServerClient();
  const { data: record } = await session
    .from("collateral_records")
    .select("id, release_status")
    .eq("id", collateralId)
    .maybeSingle();

  if (!record) return { status: "error", message: "Collateral not found." };
  if (record.release_status !== "held") {
    return { status: "error", message: "This collateral has been released." };
  }

  const safeName =
    file.name
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(-80) || "document";
  const path = `collateral/${user.id}/${collateralId}/${crypto.randomUUID()}-${safeName}`;

  const admin = createSupabaseAdminClient();
  const { error: uploadError } = await admin.storage.from("collateral").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadError) {
    console.error("[collateral] upload failed", uploadError.message);
    return { status: "error", message: "Could not upload the document. Try again." };
  }

  const { error: attachError } = await session.rpc("attach_collateral_document", {
    p_collateral_id: collateralId,
    p_document_type: documentType.slice(0, 60),
    p_storage_path: path,
  });

  if (attachError) {
    // The object must not outlive a failed attach: it would be unreachable.
    await admin.storage.from("collateral").remove([path]);
    return { status: "error", message: attachError.message };
  }

  revalidatePath("/app/loans");
  return {
    status: "success",
    message: `${documentType} uploaded. A risk officer will review it.`,
  };
}
