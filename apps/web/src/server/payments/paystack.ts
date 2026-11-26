import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { paystackConfig } from "./config";

export class PaystackError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status = 502, code?: string) {
    super(message);
    this.name = "PaystackError";
    this.status = status;
    if (code) this.code = code;
  }
}

type InitializeInput = {
  readonly email: string;
  readonly amountKobo: bigint;
  readonly reference: string;
  readonly callbackUrl: string;
  readonly metadata?: Record<string, unknown>;
};

export type InitializeResult = {
  readonly authorizationUrl: string;
  readonly accessCode: string;
  readonly reference: string;
};

export type VerifiedTransaction = {
  readonly status: "success" | "failed" | "abandoned" | "pending" | "reversed";
  readonly reference: string;
  readonly amountKobo: bigint;
  readonly currency: string;
  readonly channel: string | null;
  readonly paidAt: string | null;
  readonly gatewayResponse: string | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { secretKey, baseUrl } = paystackConfig();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  const envelope = body as { status?: boolean; message?: string; data?: unknown } | null;

  if (!response.ok || !envelope?.status) {
    // Never echo the request body or key material into logs or errors.
    throw new PaystackError(
      envelope?.message ?? `Paystack request failed with status ${response.status}`,
      response.status,
    );
  }

  return envelope.data as T;
}

/** Amounts stay in kobo end to end; Paystack expects the integer subunit. */
export async function initializeTransaction(input: InitializeInput): Promise<InitializeResult> {
  const data = await request<{
    authorization_url: string;
    access_code: string;
    reference: string;
  }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      amount: Number(input.amountKobo),
      reference: input.reference,
      callback_url: input.callbackUrl,
      currency: "NGN",
      metadata: input.metadata ?? {},
      channels: ["card", "bank", "ussd", "bank_transfer"],
    }),
  });

  return {
    authorizationUrl: data.authorization_url,
    accessCode: data.access_code,
    reference: data.reference,
  };
}

export async function verifyTransaction(reference: string): Promise<VerifiedTransaction> {
  const data = await request<{
    status: string;
    reference: string;
    amount: number;
    currency: string;
    channel: string | null;
    paid_at: string | null;
    gateway_response: string | null;
  }>(`/transaction/verify/${encodeURIComponent(reference)}`, { method: "GET" });

  const status = ["success", "failed", "abandoned", "pending", "reversed"].includes(data.status)
    ? (data.status as VerifiedTransaction["status"])
    : "failed";

  return {
    status,
    reference: data.reference,
    amountKobo: BigInt(Math.round(data.amount)),
    currency: data.currency,
    channel: data.channel ?? null,
    paidAt: data.paid_at ?? null,
    gatewayResponse: data.gateway_response ?? null,
  };
}

/**
 * HMAC-SHA512 of the raw request body, keyed with the secret key. Comparison is
 * constant-time. The raw body must be the exact bytes Paystack signed — parsing
 * first and re-serialising will break the signature.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;

  const { secretKey } = paystackConfig();
  const expected = createHmac("sha512", secretKey).update(rawBody, "utf8").digest("hex");

  const provided = signature.trim().toLowerCase();
  if (provided.length !== expected.length) return false;

  try {
    return timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}
