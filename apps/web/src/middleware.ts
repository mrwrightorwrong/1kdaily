import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";

const PROTECTED_PREFIXES = ["/app", "/onboarding", "/admin"] as const;
const AUTH_PAGES = ["/sign-in", "/sign-up"] as const;

function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function middleware(request: NextRequest) {
  // NEXT_PUBLIC_* values are inlined at build time. If the build ran before the
  // environment was configured they are empty, and throwing here would 500 every
  // route including the marketing site. Degrade instead of taking the site down.
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) {
    const pathname = request.nextUrl.pathname;
    if (matchesPrefix(pathname, PROTECTED_PREFIXES)) {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // IMPORTANT: getUser() validates the JWT with the Auth server. Do not replace
  // this with getSession(), which trusts the cookie without verification.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && matchesPrefix(pathname, PROTECTED_PREFIXES)) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = "";
    if (matchesPrefix(pathname, ["/app", "/admin"])) {
      url.searchParams.set("next", pathname);
    }
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  }

  if (user && matchesPrefix(pathname, AUTH_PAGES)) {
    const redirect = NextResponse.redirect(new URL("/app", request.url));
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on everything except static assets and image optimisation. Auth pages
     * are included so signed-in users are redirected away from them.
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|robots.txt|sitemap.xml|brand/|.*\\.(?:svg|png|jpg|jpeg|webp|avif|woff2?)$).*)",
  ],
};
