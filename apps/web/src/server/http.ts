import "server-only";
import { headers } from "next/headers";
import { publicEnv } from "@/lib/env";

/**
 * Absolute origin for auth redirect URLs. Prefers the configured site URL so
 * email links never point at an unexpected host (open-redirect / phishing).
 */
export async function requestOrigin(): Promise<string> {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";

  const configured = publicEnv.siteUrl.replace(/\/$/, "");
  if (host) {
    const origin = `${protocol}://${host}`;
    // In local development the configured URL may be the other port; trusting
    // the actual host keeps magic links usable without widening production.
    if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) return origin;
  }

  return configured;
}
