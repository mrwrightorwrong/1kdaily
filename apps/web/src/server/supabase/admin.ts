import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

/**
 * Service-role client. Bypasses RLS, so it must only be used after an explicit
 * authorisation check and must never be imported into a client component.
 *
 * Legitimate uses in Phase 2:
 *   - inserting a masked identity record after vendor verification
 *   - writing audit entries from server actions
 *   - staff-only queries where the permission was already checked
 */
export function createSupabaseAdminClient() {
  const env = serverEnv();
  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
