import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type PurgedDocument = { readonly document_id: string; readonly storage_path: string };

/**
 * Daily retention purge, invoked by Vercel Cron with `Authorization: Bearer
 * $CRON_SECRET`. Deletes evidence whose 90-day post-release window has elapsed,
 * then removes the stored objects. Rows are the source of truth: if an object
 * removal fails it is reported, never silently ignored.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("purge_released_collateral_documents", {
    p_limit: 200,
  });

  if (error) {
    console.error("[cron] collateral purge failed", error.message);
    return NextResponse.json({ error: "Purge failed." }, { status: 500 });
  }

  const documents = (data ?? []) as PurgedDocument[];
  let removed = 0;
  let failed = 0;

  for (const document of documents) {
    const { error: removeError } = await admin.storage
      .from("collateral")
      .remove([document.storage_path]);

    if (removeError) {
      failed += 1;
      console.error("[cron] object removal failed", document.document_id, removeError.message);
    } else {
      removed += 1;
    }
  }

  if (documents.length > 0) {
    console.log(`[cron] collateral retention purged ${documents.length} document(s)`);
  }

  return NextResponse.json({ deleted: documents.length, removed, failed });
}
