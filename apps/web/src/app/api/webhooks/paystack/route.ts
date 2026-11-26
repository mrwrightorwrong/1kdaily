import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { verifyTransaction, verifyWebhookSignature } from "@/server/payments/paystack";

export const runtime = "nodejs";

/**
 * Paystack webhook.
 *
 * Order of operations matters:
 *   1. verify the HMAC signature over the exact raw body
 *   2. store the event (unique per provider event id) so replays are harmless
 *   3. verify the transaction with Paystack — never trust the body alone
 *   4. confirm idempotently through the ledger RPC
 *
 * Any handled event returns 200, including duplicates and failures, so Paystack
 * stops retrying. Only an invalid signature returns 401.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return new Response("invalid signature", { status: 401 });
  }

  let event: {
    event?: string;
    data?: {
      id?: number | string;
      reference?: string;
      status?: string;
      amount?: number;
      currency?: string;
      channel?: string;
    };
  };

  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("invalid payload", { status: 400 });
  }

  const eventType = event.event ?? "unknown";
  const reference = event.data?.reference ?? null;
  const eventId =
    event.data?.id !== undefined
      ? `paystack:${String(event.data.id)}`
      : `paystack:${eventType}:${reference ?? "unknown"}`;

  const admin = createSupabaseAdminClient();

  const stored = await admin.from("payment_provider_events").insert({
    provider: "paystack",
    event_id: eventId,
    event_type: eventType,
    provider_reference: reference,
    payload: event,
    signature_valid: true,
    status: "received",
  });

  if (stored.error) {
    if (stored.error.code === "23505") {
      // Already seen this event. Acknowledge so the provider stops retrying.
      return new Response("duplicate", { status: 200 });
    }
    console.error("[webhook] could not store event", stored.error.code ?? "unknown");
    return new Response("storage error", { status: 500 });
  }

  if (eventType !== "charge.success" || !reference) {
    await admin
      .from("payment_provider_events")
      .update({ status: "ignored", processed_at: new Date().toISOString() })
      .eq("provider", "paystack")
      .eq("event_id", eventId);
    return new Response("ignored", { status: 200 });
  }

  const { data: contribution, error: contributionError } = await admin
    .from("savings_contributions")
    .select("id, reference, amount_kobo, status, user_id")
    .eq("reference", reference)
    .maybeSingle();

  if (contributionError || !contribution) {
    await admin
      .from("payment_provider_events")
      .update({ status: "ignored", processed_at: new Date().toISOString() })
      .eq("provider", "paystack")
      .eq("event_id", eventId);
    return new Response("unknown reference", { status: 200 });
  }

  if (contribution.status === "confirmed") {
    await admin
      .from("payment_provider_events")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("provider", "paystack")
      .eq("event_id", eventId);
    return new Response("already confirmed", { status: 200 });
  }

  let verified;
  try {
    verified = await verifyTransaction(reference);
  } catch (verifyError) {
    console.error(
      "[webhook] verify failed",
      verifyError instanceof Error ? verifyError.message.slice(0, 120) : "unknown",
    );
    await admin
      .from("payment_provider_events")
      .update({ status: "failed", processed_at: new Date().toISOString() })
      .eq("provider", "paystack")
      .eq("event_id", eventId);
    return new Response("verify failed", { status: 200 });
  }

  if (verified.status !== "success") {
    await admin.rpc("fail_contribution", {
      p_contribution_id: contribution.id,
      p_failure_code: `provider_${verified.status}`,
    });
    await admin
      .from("payment_provider_events")
      .update({ status: "ignored", processed_at: new Date().toISOString() })
      .eq("provider", "paystack")
      .eq("event_id", eventId);
    return new Response("not successful", { status: 200 });
  }

  if (
    verified.currency !== "NGN" ||
    verified.amountKobo !== BigInt(contribution.amount_kobo)
  ) {
    console.error("[webhook] amount or currency mismatch");
    await admin.rpc("fail_contribution", {
      p_contribution_id: contribution.id,
      p_failure_code: "amount_mismatch",
    });
    await admin
      .from("payment_provider_events")
      .update({ status: "failed", processed_at: new Date().toISOString() })
      .eq("provider", "paystack")
      .eq("event_id", eventId);
    return new Response("amount mismatch", { status: 200 });
  }

  const { error: confirmError } = await admin.rpc("confirm_contribution", {
    p_contribution_id: contribution.id,
    p_provider_reference: verified.reference,
    p_paid_kobo: String(verified.amountKobo),
    p_channel: verified.channel,
    p_paid_at: verified.paidAt ?? new Date().toISOString(),
  });

  if (confirmError) {
    console.error("[webhook] confirmation failed", confirmError.code ?? "unknown");
    await admin
      .from("payment_provider_events")
      .update({ status: "failed", processed_at: new Date().toISOString() })
      .eq("provider", "paystack")
      .eq("event_id", eventId);
    return new Response("confirmation failed", { status: 200 });
  }

  await admin
    .from("payment_provider_events")
    .update({ status: "processed", processed_at: new Date().toISOString() })
    .eq("provider", "paystack")
    .eq("event_id", eventId);

  return new Response("ok", { status: 200 });
}
