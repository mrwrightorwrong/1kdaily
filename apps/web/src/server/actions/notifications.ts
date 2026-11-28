"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/supabase/server";

export async function markNotificationsReadAction(): Promise<void> {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("mark_notifications_read", { p_ids: null });

  if (error) {
    console.error("[notifications] mark read failed", error.message);
    return;
  }

  revalidatePath("/app");
  revalidatePath("/app/notifications");
}
