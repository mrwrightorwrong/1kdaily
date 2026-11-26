import "server-only";
import { createHmac } from "node:crypto";
import { normalizeIdentityNumber, type IdentityKind } from "@1kdaily/core";
import { serverEnv } from "@/lib/env";

/**
 * Non-reversible identity fingerprint.
 *
 * Purpose: detect the same BVN/NIN being used to verify two accounts without
 * storing the number. The pepper lives only in server configuration and never
 * enters the database, so a database dump alone cannot be brute-forced against
 * the (small) 11-digit space.
 *
 * The digest is deterministic per (kind, value), so it is also stable across
 * retries of the same submission.
 */
export function identityDigest(kind: IdentityKind, rawValue: string): string {
  const pepper = serverEnv().kycHashPepper;
  return createHmac("sha256", pepper)
    .update(`${kind}:${normalizeIdentityNumber(rawValue)}`)
    .digest("hex");
}

export const IDENTITY_DIGEST_VERSION = 1;
