import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { assertPublicEnv, publicEnv } from "@/lib/env";

/**
 * Request-scoped Supabase client. Uses the caller's session from cookies, so
 * RLS and `auth.uid()` apply exactly as they do in the browser.
 *
 * `setAll` can throw inside a Server Component (cookies are read-only there);
 * middleware handles the refresh, so swallowing the error is correct.
 */
export async function createSupabaseServerClient() {
  assertPublicEnv();
  const cookieStore = await cookies();

  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set({ name, value, ...options });
          }
        } catch {
          // Called from a Server Component: the middleware refreshes the session.
        }
      },
    },
  });
}
