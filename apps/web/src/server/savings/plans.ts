import "server-only";
import {
  asBusinessDate,
  summarisePlan,
  type BusinessDate,
  type MilestoneProgress,
  milestoneProgress,
  type PlanDay,
  type PlanDayStatus,
  type PlanProgress,
  type PlanStatus,
} from "@1kdaily/core";
import { createSupabaseServerClient } from "@/server/supabase/server";

export type SavingsProduct = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly daily_amount_kobo: string | null;
  readonly min_daily_kobo: string;
  readonly max_daily_kobo: string;
  readonly durations: number[];
  readonly grace_days: number;
  readonly withdrawal_policy: "completion_only" | "early_allowed";
  readonly withdrawal_terms: string;
  readonly is_custom: boolean;
};

export type SavingsPlan = {
  readonly id: string;
  readonly name: string;
  readonly daily_amount_kobo: string;
  readonly duration_days: number;
  readonly start_date: string;
  readonly end_date: string;
  readonly status: PlanStatus;
  readonly grace_days_total: number;
  readonly grace_days_used: number;
  readonly goal: string | null;
  readonly withdrawal_policy: string;
  readonly withdrawal_terms: string;
  readonly product_id: string;
  readonly created_at: string;
};

type DayRow = {
  readonly business_date: string;
  readonly status: string;
  readonly expected_kobo: string;
  readonly paid_kobo: string | null;
};

export type PlanWithProgress = {
  readonly plan: SavingsPlan;
  readonly days: readonly PlanDay[];
  readonly progress: PlanProgress;
  readonly milestones: MilestoneProgress;
};

const PLAN_COLUMNS =
  "id, name, daily_amount_kobo, duration_days, start_date, end_date, status, " +
  "grace_days_total, grace_days_used, goal, withdrawal_policy, withdrawal_terms, " +
  "product_id, created_at";

function toPlanDay(row: DayRow): PlanDay {
  return {
    date: asBusinessDate(row.business_date),
    status: row.status as PlanDayStatus,
    expectedKobo: BigInt(row.expected_kobo),
    paidKobo: row.paid_kobo === null ? undefined : BigInt(row.paid_kobo),
  };
}

export function toProgress(plan: SavingsPlan, days: readonly PlanDay[], today: BusinessDate): PlanProgress {
  return summarisePlan(
    {
      dailyAmountKobo: BigInt(plan.daily_amount_kobo),
      durationDays: plan.duration_days,
      startDate: asBusinessDate(plan.start_date),
      endDate: asBusinessDate(plan.end_date),
      graceDaysTotal: plan.grace_days_total,
      graceDaysUsed: plan.grace_days_used,
      status: plan.status,
    },
    days,
    today,
  );
}

/** Runs the lazy schedule maintenance (past days → grace/missed). Idempotent. */
export async function refreshPlanDays(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("refresh_my_plan_days");
  if (error) {
    console.error("[savings] refresh failed", error.code ?? "unknown");
  }
}

export async function getProducts(): Promise<SavingsProduct[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("savings_products")
    .select(
      "id, code, name, description, daily_amount_kobo, min_daily_kobo, max_daily_kobo, durations, grace_days, withdrawal_policy, withdrawal_terms, is_custom",
    )
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    console.error("[savings] products read failed", error.code ?? "unknown");
    return [];
  }
  return (data ?? []) as SavingsProduct[];
}

export async function getProductByCode(code: string): Promise<SavingsProduct | null> {
  const products = await getProducts();
  return products.find((product) => product.code === code) ?? null;
}

export async function getPlans(today: BusinessDate): Promise<PlanWithProgress[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("savings_plans")
    .select(`${PLAN_COLUMNS}, savings_plan_days(business_date, status, expected_kobo, paid_kobo)`)
    .order("created_at", { ascending: false })
    .order("business_date", { referencedTable: "savings_plan_days", ascending: true });

  if (error) {
    console.error("[savings] plans read failed", error.code ?? "unknown");
    return [];
  }

  return ((data ?? []) as Array<SavingsPlan & { savings_plan_days: DayRow[] }>).map((row) => {
    const { savings_plan_days: dayRows, ...plan } = row;
    const days = (dayRows ?? []).map(toPlanDay);
    const progress = toProgress(plan, days, today);
    return {
      plan,
      days,
      progress,
      milestones: milestoneProgress(progress.paidDays),
    };
  });
}

export async function getPlanById(
  planId: string,
  today: BusinessDate,
): Promise<PlanWithProgress | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("savings_plans")
    .select(`${PLAN_COLUMNS}, savings_plan_days(business_date, status, expected_kobo, paid_kobo)`)
    .eq("id", planId)
    .order("business_date", { referencedTable: "savings_plan_days", ascending: true })
    .maybeSingle();

  if (error) {
    console.error("[savings] plan read failed", error.code ?? "unknown");
    return null;
  }
  if (!data) return null;

  const { savings_plan_days: dayRows, ...plan } = data as SavingsPlan & {
    savings_plan_days: DayRow[];
  };
  const days = (dayRows ?? []).map(toPlanDay);
  const progress = toProgress(plan as SavingsPlan, days, today);

  return {
    plan: plan as SavingsPlan,
    days,
    progress,
    milestones: milestoneProgress(progress.paidDays),
  };
}

export function splitPlans(plans: readonly PlanWithProgress[]) {
  return {
    current: plans.filter((entry) => entry.plan.status === "active" || entry.plan.status === "paused"),
    past: plans.filter(
      (entry) =>
        entry.plan.status === "completed" ||
        entry.plan.status === "cancelled" ||
        entry.plan.status === "suspended",
    ),
  };
}

export type ReminderPreferences = {
  readonly enabled: boolean;
  readonly reminder_time: string;
  readonly channels: string[];
};

export async function getReminderPreferences(): Promise<ReminderPreferences> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("savings_reminder_preferences")
    .select("enabled, reminder_time, channels")
    .maybeSingle();

  if (error) {
    console.error("[savings] reminder prefs read failed", error.code ?? "unknown");
  }

  const row = data as ReminderPreferences | null;
  return {
    enabled: row?.enabled ?? true,
    reminder_time: (row?.reminder_time ?? "08:00").slice(0, 5),
    channels: row?.channels ?? ["in_app"],
  };
}

/** Aggregated calendar across every plan, using a deterministic priority. */
export function aggregateCalendar(
  plans: readonly PlanWithProgress[],
): Array<{ date: string; status: string }> {
  const rank: Record<string, number> = {
    missed: 5,
    grace: 4,
    partially_paid: 3,
    paid: 2,
    paused: 1,
    skipped: 0,
    scheduled: 0,
  };
  const byDate = new Map<string, { status: string; scheduled: boolean }>();

  for (const entry of plans) {
    if (entry.plan.status === "cancelled") continue;
    for (const day of entry.days) {
      const current = byDate.get(day.date);
      const scheduled = day.status === "scheduled";
      if (!current) {
        byDate.set(day.date, { status: day.status, scheduled });
        continue;
      }
      // A day is "paid" across plans only when every plan's day is settled.
      if (current.status === "paid" && day.status === "paid") continue;
      if (day.status === "paid" && current.scheduled && !scheduled) continue;
      if ((rank[day.status] ?? 0) > (rank[current.status] ?? 0)) {
        byDate.set(day.date, { status: day.status, scheduled });
      }
    }
  }

  return [...byDate.entries()].map(([date, value]) => ({ date, status: value.status }));
}
