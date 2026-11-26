"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MoneyError, parseNairaToKobo } from "@1kdaily/core";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { getProductByCode } from "@/server/savings/plans";
import { requireUser } from "@/server/auth/session";
import type { FormState } from "@/lib/form";
import { firstFieldErrors, formToObject, planSchema, reminderSchema } from "@/lib/validation";

function errorRedirect(planId: string, message: string): never {
  redirect(`/app/plans/${planId}?error=${encodeURIComponent(message)}`);
}

export async function createPlanAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const raw = formToObject(formData);
  const parsed = planSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the plan details.",
      fieldErrors: firstFieldErrors(parsed.error),
    };
  }

  if (raw.confirm !== "on") {
    return {
      status: "error",
      message: "Confirm that you understand the plan rules before activating.",
      fieldErrors: { confirm: "Required" },
    };
  }

  const product = await getProductByCode(parsed.data.product_code);
  if (!product) {
    return { status: "error", message: "That savings plan is no longer available." };
  }

  let dailyKobo: bigint;
  if (product.is_custom) {
    try {
      dailyKobo = parseNairaToKobo(parsed.data.daily_amount ?? "");
    } catch (error) {
      return {
        status: "error",
        message: error instanceof MoneyError ? error.message : "Enter a valid daily amount.",
        fieldErrors: { daily_amount: "Enter a daily amount" },
      };
    }
  } else {
    dailyKobo = BigInt(product.daily_amount_kobo ?? "0");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_savings_plan", {
    p_product_code: product.code,
    p_daily_kobo: String(dailyKobo),
    p_duration_days: parsed.data.duration_days,
    p_start_date: parsed.data.start_date,
    p_goal: parsed.data.goal || null,
  });

  if (error) {
    if (error.code === "22023") {
      return { status: "error", message: error.message };
    }
    console.error("[savings] create failed", error.code ?? "unknown");
    return { status: "error", message: "We could not create that plan. Try again." };
  }

  revalidatePath("/app");
  revalidatePath("/app/plans");
  revalidatePath("/app/calendar");

  redirect(`/app/plans/${String(data)}?created=1`);
}

export async function pausePlanAction(formData: FormData): Promise<void> {
  await requireUser();
  const planId = String(formData.get("plan_id") ?? "");
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("pause_my_plan", { p_plan_id: planId });
  if (error) errorRedirect(planId, "That plan could not be paused.");

  revalidatePath(`/app/plans/${planId}`);
  revalidatePath("/app");
  redirect(`/app/plans/${planId}?paused=1`);
}

export async function resumePlanAction(formData: FormData): Promise<void> {
  await requireUser();
  const planId = String(formData.get("plan_id") ?? "");
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("resume_my_plan", { p_plan_id: planId });
  if (error) errorRedirect(planId, "That plan could not be resumed.");

  revalidatePath(`/app/plans/${planId}`);
  revalidatePath("/app");
  redirect(`/app/plans/${planId}?resumed=1`);
}

export async function cancelPlanAction(formData: FormData): Promise<void> {
  await requireUser();
  const planId = String(formData.get("plan_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("cancel_my_plan", {
    p_plan_id: planId,
    p_reason: reason || null,
  });
  if (error) errorRedirect(planId, "That plan could not be cancelled.");

  revalidatePath(`/app/plans/${planId}`);
  revalidatePath("/app");
  redirect(`/app/plans/${planId}?cancelled=1`);
}

export async function saveReminderAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const parsed = reminderSchema.safeParse(formToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the reminder settings.",
      fieldErrors: firstFieldErrors(parsed.error),
    };
  }

  const channels = [
    ...(parsed.data.in_app === "on" ? ["in_app"] : []),
    ...(parsed.data.email === "on" ? ["email"] : []),
  ];

  if (channels.length === 0) {
    return {
      status: "error",
      message: "Choose at least one reminder channel.",
      fieldErrors: { in_app: "Choose a channel" },
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_reminder_preferences", {
    p_enabled: parsed.data.enabled === "on",
    p_time: parsed.data.reminder_time,
    p_channels: channels,
  });

  if (error) {
    return { status: "error", message: "Could not save reminder settings." };
  }

  revalidatePath("/app/plans");
  return { status: "success", message: "Reminder settings saved." };
}
