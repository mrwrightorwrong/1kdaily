/**
 * Identity-number primitives for BVN and NIN.
 *
 * These functions are deliberately the *only* place in the codebase that
 * handles the shape of a raw identity number. They live in Track M (no React,
 * no IO) so they can be tested exhaustively.
 *
 * Nothing here persists or logs a value. The storage rule is enforced elsewhere
 * (server action + database schema): a raw BVN/NIN never reaches Postgres.
 */

export type IdentityKind = "bvn" | "nin";

export const IDENTITY_KINDS: readonly IdentityKind[] = ["bvn", "nin"];

/** Both BVN and NIN are 11 digits in Nigeria. */
export const IDENTITY_LENGTH = 11;

/** Strip the separators people naturally type: spaces, hyphens, dots. */
export function normalizeIdentityNumber(input: string): string {
  return input.replace(/[\s\-.]/g, "");
}

export function isIdentityKind(value: string): value is IdentityKind {
  return (IDENTITY_KINDS as readonly string[]).includes(value);
}

export function isValidIdentityNumber(kind: IdentityKind, input: string): boolean {
  const normalized = normalizeIdentityNumber(input);
  if (normalized.length !== IDENTITY_LENGTH) return false;
  if (!/^\d+$/.test(normalized)) return false;
  // All-zero (and other trivially invalid) values are rejected by the vendor;
  // reject the obvious placeholder here so it never becomes a verification.
  if (/^0+$/.test(normalized)) return false;
  switch (kind) {
    case "bvn":
    case "nin":
      return true;
  }
}

/**
 * The only representation allowed in UI, logs or support screens.
 * Returns the last four digits, never a partially masked full value.
 */
export function maskIdentityNumber(input: string): string {
  const normalized = normalizeIdentityNumber(input);
  if (normalized.length < 4) return "••••";
  return `•••• ${normalized.slice(-4)}`;
}

/** Last four digits, for storage alongside the HMAC digest. */
export function identityLast4(input: string): string {
  const normalized = normalizeIdentityNumber(input);
  return normalized.length >= 4 ? normalized.slice(-4) : "";
}
