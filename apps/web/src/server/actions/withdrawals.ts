"use server";

import { revalidatePath } from "next/cache";
import { MoneyError, parseNairaToKobo } from "@1kdaily/core";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { requireUser } from "@/server/auth/session";
import { createTransferRecipient } from "@/server/payments/paystack";
import type { FormState } from "@/lib/form";

const BANK_ACCOUNT = /^\d{10}$/;

export async function addBankAccountAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const bankName = String(formData.get("bank_name") ?? "").trim();
  const bankCode = String(formData.get("bank_code") ?? "").trim();
  const accountName = String(formData.get("account_name") ?? "").trim();
  const accountNumber = String(formData.get("account_number") ?? "").replace(/\s/g, "");

  if (!bankName || !/^\d{3}$/.test(bankCode)) {
    return { status: "error", message: "Choose your bank." };
  }
  if (!accountName || accountName.length > 100) {
    return { status: "error", message: "Enter the account name.", fieldErrors: { account_name: "Required" } };
  }
  if (!BANK_ACCOUNT.test(accountNumber)) {
    return {
      status: "error",
      message: "Enter a 10-digit account number.",
      fieldErrors: { account_number: "Must be 10 digits" },
    };
  }

  let recipient: { recipientCode: string; last4: string };
  try {
    recipient = await createTransferRecipient({
      name: accountName,
      accountNumber,
      bankCode,
    });
  } catch {
    console.error("[withdrawals] recipient creation failed");
    return {
      status: "error",
      message: "That account could not be verified with the bank. Check the details and try again.",
    };
  }

  // The account number is not stored: only the provider recipient and last4.
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("user_bank_accounts").insert({
    user_id: user.id,
    bank_code: bankCode,
    bank_name: bankName,
    account_name: accountName,
    account_last4: recipient.last4,
    recipient_code: recipient.recipientCode,
  });

  if (error) {
    if (error.code === "23505") return { status: "success", message: "That account is already saved." };
    console.error("[withdrawals] bank account save failed", error.code ?? "unknown");
    return { status: "error", message: "Could not save that account. Try again." };
  }

  revalidatePath("/app/withdrawals");
  return { status: "success", message: "Payout account saved." };
}

export async function requestWithdrawalAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();

  const planId = String(formData.get("plan_id") ?? "");
  const bankId = String(formData.get("bank_account_id") ?? "");
  const idempotencyKey = String(formData.get("idempotency_key") ?? "").trim();

  if (!/^[0-9a-f-]{36}$/i.test(planId) || !/^[0-9a-f-]{36}$/i.test(bankId) || !idempotencyKey) {
    return { status: "error", message: "Reload the page and try again." };
  }

  let amountKobo: bigint;
  try {
    amountKobo = parseNairaToKobo(String(formData.get("amount") ?? ""));
  } catch (error) {
    return {
      status: "error",
      message: error instanceof MoneyError ? error.message : "Enter a valid amount.",
      fieldErrors: { amount: "Enter a valid amount" },
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("request_withdrawal", {
    p_plan_id: planId,
    p_bank_account_id: bankId,
    p_amount_kobo: String(amountKobo),
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  revalidatePath("/app/withdrawals");
  revalidatePath(`/app/plans/${planId}`);
  return {
    status: "success",
    message: "Withdrawal requested. It is now under review; your balance is reserved.",
  };
}
