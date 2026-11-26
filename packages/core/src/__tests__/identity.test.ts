import { describe, expect, it } from "vitest";
import {
  IDENTITY_LENGTH,
  identityLast4,
  isIdentityKind,
  isValidIdentityNumber,
  maskIdentityNumber,
  normalizeIdentityNumber,
} from "../identity";

/**
 * All identifiers in this file are synthetic. Real BVN/NIN values must never
 * appear in the repository, its tests, fixtures or logs.
 */
const SAMPLE_BVN = "12345678901";
const SAMPLE_NIN = "98765432109";

describe("normalizeIdentityNumber", () => {
  it("removes the separators people actually type", () => {
    expect(normalizeIdentityNumber("123 456 78901")).toBe(SAMPLE_BVN);
    expect(normalizeIdentityNumber("123-456-78901")).toBe(SAMPLE_BVN);
    expect(normalizeIdentityNumber("123.456.78901")).toBe(SAMPLE_BVN);
    expect(normalizeIdentityNumber(" 12345678901 ")).toBe(SAMPLE_BVN);
  });
});

describe("isValidIdentityNumber", () => {
  it("accepts 11-digit values for both kinds", () => {
    expect(isValidIdentityNumber("bvn", SAMPLE_BVN)).toBe(true);
    expect(isValidIdentityNumber("nin", SAMPLE_NIN)).toBe(true);
    expect(isValidIdentityNumber("nin", "987 654 3210 9")).toBe(true);
  });

  it("rejects wrong lengths and non-digits", () => {
    for (const value of ["", "123", "1234567890", "123456789012", "abcdefghijk", "1234567890a"]) {
      expect(isValidIdentityNumber("bvn", value)).toBe(false);
    }
  });

  it("rejects placeholder all-zero values", () => {
    expect(isValidIdentityNumber("bvn", "00000000000")).toBe(false);
  });

  it("uses an 11-digit contract", () => {
    expect(IDENTITY_LENGTH).toBe(11);
  });
});

describe("display masking", () => {
  it("returns only the last four digits", () => {
    expect(identityLast4(SAMPLE_BVN)).toBe("8901");
    expect(maskIdentityNumber(SAMPLE_BVN)).toBe("•••• 8901");
  });

  it("never leaks more than four digits", () => {
    const masked = maskIdentityNumber(SAMPLE_BVN);
    expect(masked.replace(/\D/g, "")).toHaveLength(4);
  });

  it("handles short input without throwing", () => {
    expect(maskIdentityNumber("12")).toBe("••••");
    expect(identityLast4("12")).toBe("");
  });
});

describe("isIdentityKind", () => {
  it("accepts only bvn and nin", () => {
    expect(isIdentityKind("bvn")).toBe(true);
    expect(isIdentityKind("nin")).toBe(true);
    expect(isIdentityKind("passport")).toBe(false);
    expect(isIdentityKind("BVN")).toBe(false);
  });
});
