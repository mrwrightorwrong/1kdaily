import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { safeNextPath } from "@/lib/form";

/**
 * OAuth / magic-link / recovery callback. Exchanges the one-time code for a
 * session (PKCE verifier lives in the initiating browser's cookies) and then
 * redirects to a same-origin path only.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));
  const errorDescription = url.searchParams.get("error_description");

  if (errorDescription) {
    return NextResponse.redirect(new URL("/sign-in?error=callback_failed", url.origin));
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
    console.error("[auth] code exchange failed", error.message);
  }

  return NextResponse.redirect(new URL("/sign-in?error=link_expired", url.origin));
}
