"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { requireUser } from "@/server/auth/session";

async function run(
  rpc: string,
  args: Record<string, unknown>,
  done: string,
  anchor: string,
): Promise<never> {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc(rpc, args);

  revalidatePath("/admin/loans");
  if (error) redirect(`/admin/loans?error=${encodeURIComponent(error.message)}${anchor}`);
  redirect(`/admin/loans?done=${done}${anchor}`);
}

export async function reviewCollateralAction(formData: FormData): Promise<void> {
  const id = String(formData.get("collateral_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  await run(
    "review_collateral",
    { p_collateral_id: id, p_decision: decision, p_notes: notes || null },
    `collateral ${decision === "verify" ? "verified" : "rejected"}`,
    "#collateral",
  );
}

export async function releaseCollateralAction(formData: FormData): Promise<void> {
  const id = String(formData.get("collateral_id") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  await run(
    "release_collateral",
    { p_collateral_id: id, p_notes: notes || null },
    "collateral released",
    "#collateral",
  );
}

export async function reviewCollateralDocumentAction(formData: FormData): Promise<void> {
  const id = String(formData.get("document_id") ?? "");
  const decision = String(formData.get("decision") ?? "");

  await run(
    "review_collateral_document",
    { p_document_id: id, p_decision: decision },
    `document ${decision === "verify" ? "accepted" : "rejected"}`,
    "#collateral",
  );
}

export async function reviewGuarantorAction(formData: FormData): Promise<void> {
  const id = String(formData.get("guarantor_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  await run(
    "verify_guarantor",
    { p_guarantor_id: id, p_decision: decision, p_notes: notes || null },
    `guarantor ${decision === "verify" ? "verified" : "rejected"}`,
    "#guarantors",
  );
}

export async function releaseGuarantorAction(formData: FormData): Promise<void> {
  const id = String(formData.get("guarantor_id") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  await run(
    "release_guarantor",
    { p_guarantor_id: id, p_notes: notes || null },
    "guarantor released",
    "#guarantors",
  );
}
