"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

let client: ReturnType<typeof createBrowserClient> | undefined;

/**
 * Browser client for interactive auth flows only (MFA enrolment, password
 * change). Financial reads and all writes go through server actions.
 */
export function getSupabaseBrowserClient() {
  client ??= createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
  return client;
}
