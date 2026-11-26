import "server-only";
import { serverEnv } from "@/lib/env";

export type KycVerificationInput = {
  readonly kind: "bvn" | "nin";
  /** Raw identifier. Present only in memory for the duration of the call. */
  readonly value: string;
  readonly userId: string;
};

export type KycVerificationResult = {
  readonly vendor: string;
  readonly reference: string;
  readonly status: "verified" | "needs_review" | "failed";
  readonly matchResult: "exact" | "partial" | "no_match" | "unavailable";
  readonly reasonCode?: string;
};

export interface KycProvider {
  readonly name: string;
  readonly isMock: boolean;
  verify(input: KycVerificationInput): Promise<KycVerificationResult>;
}

/**
 * Development provider.
 *
 * Behaviour is deterministic so tests can rely on it:
 *   * a number ending in 0000 fails (no record)
 *   * KYC_MOCK_AUTO_VERIFY=true verifies everything else
 *   * otherwise the record is queued for human review
 *
 * It does not call any external service and does not persist the value.
 */
const mockProvider: KycProvider = {
  name: "mock",
  isMock: true,
  async verify({ kind, value }) {
    const reference = `mock_${kind}_${crypto.randomUUID()}`;
    if (value.endsWith("0000")) {
      return {
        vendor: "mock",
        reference,
        status: "failed",
        matchResult: "no_match",
        reasonCode: "no_record",
      };
    }
    if (serverEnv().kycMockAutoVerify) {
      return { vendor: "mock", reference, status: "verified", matchResult: "exact" };
    }
    return {
      vendor: "mock",
      reference,
      status: "needs_review",
      matchResult: "unavailable",
      reasonCode: "manual_review",
    };
  },
};

/**
 * Real providers are intentionally not implemented until commercial and data
 * processing agreements are in place. Failing loudly is safer than pretending
 * a verification happened.
 */
export function getKycProvider(): KycProvider {
  const { kycProvider } = serverEnv();
  switch (kycProvider) {
    case "mock":
      return mockProvider;
    case "dojah":
    case "smile":
    case "prembly":
      throw new Error(
        `KYC_PROVIDER=${kycProvider} is configured but no adapter is implemented. ` +
          "Add the provider adapter and its credentials before enabling it.",
      );
    default:
      throw new Error("Unknown KYC provider configuration.");
  }
}
