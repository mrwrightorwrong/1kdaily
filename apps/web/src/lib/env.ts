/**
 * Environment access.
 *
 * Public values are inlined at build time and are safe in the browser bundle.
 * Server values are read lazily so a missing variable fails at the call site
 * with a clear message, never at import time (which would break builds and
 * prerendering).
 */

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const;

export function assertPublicEnv(): void {
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
}

export type ServerEnv = {
  readonly supabaseUrl: string;
  readonly supabaseAnonKey: string;
  readonly serviceRoleKey: string;
  readonly kycHashPepper: string;
  readonly kycProvider: "mock" | "dojah" | "smile" | "prembly";
  readonly kycMockAutoVerify: boolean;
};

export function serverEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() must never be called from the browser.");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const kycHashPepper = process.env.KYC_HASH_PEPPER ?? "";

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY (server-only).");
  }

  const provider = (process.env.KYC_PROVIDER ?? "mock") as ServerEnv["kycProvider"];
  if (!["mock", "dojah", "smile", "prembly"].includes(provider)) {
    throw new Error(`Unknown KYC_PROVIDER "${provider}".`);
  }

  if (!kycHashPepper) {
    throw new Error(
      "Missing KYC_HASH_PEPPER. It is required to detect duplicate identity numbers without storing them.",
    );
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    serviceRoleKey,
    kycHashPepper,
    kycProvider: provider,
    kycMockAutoVerify: process.env.KYC_MOCK_AUTO_VERIFY === "true",
  };
}
