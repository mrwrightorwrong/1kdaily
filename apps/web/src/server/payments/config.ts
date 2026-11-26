import "server-only";

export type PaystackConfig = {
  readonly secretKey: string;
  readonly publicKey: string;
  readonly baseUrl: string;
};

/**
 * Test keys are required everywhere except an explicitly enabled production
 * deployment. A live key in a development build is treated as a configuration
 * error, not a convenience.
 */
export function paystackConfig(): PaystackConfig {
  const secretKey = process.env.PAYSTACK_SECRET_KEY ?? "";
  const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ?? "";

  if (!secretKey) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured.");
  }

  if (secretKey.startsWith("sk_live_")) {
    const allowed =
      process.env.NODE_ENV === "production" && process.env.ALLOW_LIVE_PAYMENTS === "true";
    if (!allowed) {
      throw new Error(
        "A live Paystack key is configured, but live payments are not explicitly enabled for this deployment.",
      );
    }
  }

  if (!secretKey.startsWith("sk_test_") && !secretKey.startsWith("sk_live_")) {
    throw new Error("PAYSTACK_SECRET_KEY does not look like a Paystack secret key.");
  }

  return {
    secretKey,
    publicKey,
    baseUrl: process.env.PAYSTACK_BASE_URL ?? "https://api.paystack.co",
  };
}

export function isTestMode(): boolean {
  return (process.env.PAYSTACK_SECRET_KEY ?? "").startsWith("sk_test_");
}
