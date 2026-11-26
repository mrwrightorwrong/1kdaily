import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CircleCheck,
  CircleDashed,
  Flame,
  Info,
  Lock,
  Target,
} from "lucide-react";
import { asBusinessDate, formatBusinessDate, todayBusinessDate } from "@1kdaily/core";
import { Money } from "@/components/finance/money";
import { PlanLifecycleActions } from "@/components/savings/plan-actions";
import { PlanCalendar } from "@/components/savings/plan-calendar";
import { ReminderForm } from "@/components/savings/reminder-form";
import { SaveNowForm } from "@/components/savings/save-now-form";
import { PlanStatusBadge } from "@/components/savings/ui";
import { isTestMode } from "@/server/payments/config";
import { Badge, Card, CardContent, CardHeader, CardTitle, Progress } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { requireProfile } from "@/server/auth/session";
import {
  getPlanById,
  getReminderPreferences,
  refreshPlanDays,
} from "@/server/savings/plans";

export const metadata: Metadata = { title: "Savings plan" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NOTICES: Record<string, { tone: "ok" | "warn"; text: string }> = {
  created: { tone: "ok", text: "Plan activated. Your schedule is ready and the calendar is live." },
  paused: { tone: "warn", text: "Plan paused. Days will not be marked missed while it is paused." },
  resumed: { tone: "ok", text: "Plan resumed. Future days shifted by the pause length." },
  cancelled: { tone: "warn", text: "Plan cancelled. Future days were marked skipped." },
};

function dateLabel(value: string): string {
  return formatBusinessDate(asBusinessDate(value), "medium");
}

export default async function PlanDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ planId: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  await requireProfile();
  const { planId } = await params;
  const query = await searchParams;

  if (!UUID.test(planId)) notFound();

  await refreshPlanDays();
  const today = todayBusinessDate();
  const entry = await getPlanById(planId, today);
  if (!entry) notFound();

  const reminders = await getReminderPreferences();
  const { plan, days, progress } = entry;
  const notice = query.created
    ? NOTICES.created
    : query.paused
      ? NOTICES.paused
      : query.resumed
        ? NOTICES.resumed
        : query.cancelled
          ? NOTICES.cancelled
          : undefined;

  const upcoming = days.filter((day) => day.date >= today && day.status === "scheduled").slice(0, 7);
  const history = days
    .filter((day) => day.status !== "scheduled" && day.date <= today)
    .slice(-8)
    .reverse();

  return (
    <div className="animate-rise space-y-4">
      <Link
        href="/app/plans"
        className="inline-flex items-center gap-1.5 text-[0.75rem] font-medium text-muted transition-colors hover:text-ink-900"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Savings plans
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[1.5rem] font-semibold tracking-[-0.02em] text-ink-900">
              {plan.name} plan
            </h1>
            <PlanStatusBadge status={plan.status} />
          </div>
          <p className="mt-1 text-[0.8125rem] text-muted">
            <Money value={BigInt(plan.daily_amount_kobo)} decimals={0} /> per day ·{" "}
            {plan.duration_days} days · {dateLabel(plan.start_date)} → {dateLabel(plan.end_date)}
          </p>
        </div>
        {plan.goal ? (
          <Badge variant="neutral">
            <Target className="size-2.5" aria-hidden />
            {plan.goal}
          </Badge>
        ) : null}
      </div>

      {notice ? (
        <div
          role="status"
          className={cn(
            "rounded-xl border px-3.5 py-3 text-[0.75rem] leading-relaxed",
            notice.tone === "ok"
              ? "border-brand-200 bg-brand-50 text-brand-800"
              : "border-warn-500/25 bg-warn-50 text-[#7a5300]",
          )}
        >
          {notice.text}
        </div>
      ) : null}

      {query.paid ? (
        <div
          role="status"
          className="rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-3 text-[0.75rem] leading-relaxed text-brand-800"
        >
          Payment verified and credited. Your schedule has been updated.
        </div>
      ) : null}

      {query.pending ? (
        <div
          role="status"
          className="rounded-xl border border-warn-500/25 bg-warn-50 px-3.5 py-3 text-[0.75rem] leading-relaxed text-[#7a5300]"
        >
          We have not received confirmation from the provider yet. This page will update once the
          payment is verified — nothing is credited before that.
        </div>
      ) : null}

      {query.error ? (
        <div
          role="alert"
          className="rounded-xl border border-danger-600/25 bg-danger-50 px-3.5 py-3 text-[0.75rem] leading-relaxed text-[#8f1d1d]"
        >
          {query.error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <Card>
            <CardContent>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-subtle">
                    Accumulated
                  </p>
                  <p className="mt-1 text-[2rem] font-semibold leading-none tracking-[-0.02em] text-ink-900">
                    <Money value={progress.accumulatedKobo} dimDecimals />
                  </p>
                  <p className="mt-1 text-[0.6875rem] text-muted">
                    of <Money value={progress.expectedTotalKobo} decimals={0} /> expected
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[0.625rem] uppercase tracking-[0.1em] text-subtle">Progress</p>
                  <p className="text-[1.25rem] font-semibold text-ink-900">{progress.percentPaid}%</p>
                </div>
              </div>

              <div className="mt-4">
                <Progress value={progress.percentPaid} label="Plan progress" />
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-canvas p-3">
                  <dt className="text-[0.5625rem] uppercase tracking-[0.08em] text-subtle">Paid</dt>
                  <dd className="mt-0.5 text-[0.9375rem] font-semibold text-ink-900">
                    {progress.paidDays} <span className="text-[0.625rem] text-muted">days</span>
                  </dd>
                </div>
                <div className="rounded-xl bg-canvas p-3">
                  <dt className="text-[0.5625rem] uppercase tracking-[0.08em] text-subtle">Missed</dt>
                  <dd className="mt-0.5 text-[0.9375rem] font-semibold text-ink-900">
                    {progress.missedDays}
                  </dd>
                </div>
                <div className="rounded-xl bg-canvas p-3">
                  <dt className="text-[0.5625rem] uppercase tracking-[0.08em] text-subtle">
                    Grace left
                  </dt>
                  <dd className="mt-0.5 text-[0.9375rem] font-semibold text-ink-900">
                    {progress.graceRemaining}
                  </dd>
                </div>
                <div className="rounded-xl bg-canvas p-3">
                  <dt className="text-[0.5625rem] uppercase tracking-[0.08em] text-subtle">Streak</dt>
                  <dd className="mt-0.5 flex items-center gap-1 text-[0.9375rem] font-semibold text-ink-900">
                    <Flame className="size-3 text-warn-500" aria-hidden />
                    {progress.currentStreak}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-3 text-[0.6875rem] text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-3" aria-hidden />
                  {progress.nextDueDate ? dateLabel(progress.nextDueDate) : "No upcoming day"}
                </span>
                <span>{progress.daysRemaining} days remaining</span>
                <span>Consistency {progress.judgedDays > 0 ? `${progress.consistencyPercent}%` : "—"}</span>
                <span>Longest streak {progress.longestStreak}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Calendar</CardTitle>
                <p className="mt-1 text-[0.75rem] text-muted">
                  One row per business date, in West Africa Time.
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <PlanCalendar
                days={days.map((day) => ({ date: day.date, status: day.status }))}
                initialMonth={plan.start_date.slice(0, 7)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Schedule</CardTitle>
                <p className="mt-1 text-[0.75rem] text-muted">
                  {history.length > 0 ? "Recent days and what is next." : "Your next contribution days."}
                </p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-line">
                {[...history, ...upcoming].map((day) => (
                  <li key={day.date} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <span className="text-[0.8125rem] text-body">{dateLabel(day.date)}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-[0.75rem] text-muted">
                        <Money value={day.expectedKobo} decimals={0} />
                      </span>
                      <PlanDayStatus status={day.status} />
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Plan terms</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-line">
                <div className="flex items-center justify-between py-2">
                  <dt className="text-[0.75rem] text-muted">Daily amount</dt>
                  <dd className="text-[0.8125rem] font-medium text-ink-900">
                    <Money value={BigInt(plan.daily_amount_kobo)} decimals={0} />
                  </dd>
                </div>
                <div className="flex items-center justify-between py-2">
                  <dt className="text-[0.75rem] text-muted">Duration</dt>
                  <dd className="text-[0.8125rem] font-medium text-ink-900">
                    {plan.duration_days} days
                  </dd>
                </div>
                <div className="flex items-center justify-between py-2">
                  <dt className="text-[0.75rem] text-muted">Grace days</dt>
                  <dd className="text-[0.8125rem] font-medium text-ink-900">
                    {plan.grace_days_total} total
                  </dd>
                </div>
                <div className="flex items-center justify-between py-2">
                  <dt className="text-[0.75rem] text-muted">Withdrawal</dt>
                  <dd className="text-right text-[0.75rem] font-medium text-ink-900">
                    {plan.withdrawal_policy === "completion_only" ? "On completion" : "Early allowed"}
                  </dd>
                </div>
              </dl>

              <p className="mt-3 rounded-xl bg-canvas p-3 text-[0.625rem] leading-relaxed text-muted">
                {plan.withdrawal_terms}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Manage plan</CardTitle>
            </CardHeader>
            <CardContent>
              <PlanLifecycleActions planId={plan.id} status={plan.status} />
            </CardContent>
          </Card>

          {plan.status === "active" ? (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Save now</CardTitle>
                  <p className="mt-1 text-[0.75rem] text-muted">Verified payment only.</p>
                </div>
                <Badge variant="brand">Paystack</Badge>
              </CardHeader>
              <CardContent>
                <SaveNowForm
                  planId={plan.id}
                  dailyAmountKobo={BigInt(plan.daily_amount_kobo)}
                  testMode={isTestMode()}
                />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Reminders</CardTitle>
            </CardHeader>
            <CardContent>
              <ReminderForm
                enabled={reminders.enabled}
                time={reminders.reminder_time}
                channels={reminders.channels}
              />
            </CardContent>
          </Card>

          <div className="flex items-start gap-2.5 rounded-xl border border-line bg-surface p-3.5">
            <Info className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden />
            <p className="text-[0.625rem] leading-relaxed text-muted">
              Contribution verification arrives with the ledger in Phase 4. Until then, days that
              pass without a confirmed payment are marked grace or missed — the schedule is real, the
              money is not yet.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanDayStatus({ status }: { readonly status: string }) {
  const map: Record<string, { label: string; className: string; icon: typeof CircleCheck }> = {
    paid: { label: "Paid", className: "bg-brand-50 text-brand-700", icon: CircleCheck },
    partially_paid: { label: "Partial", className: "bg-brand-50 text-brand-700", icon: CircleCheck },
    grace: { label: "Grace", className: "bg-gold-100 text-[#7a5605]", icon: CircleDashed },
    missed: { label: "Missed", className: "bg-danger-50 text-danger-600", icon: CircleDashed },
    paused: { label: "Paused", className: "bg-canvas text-muted", icon: CircleDashed },
    skipped: { label: "Skipped", className: "bg-canvas text-subtle", icon: CircleDashed },
    scheduled: { label: "Scheduled", className: "bg-canvas text-muted", icon: CircleDashed },
  };
  const entry = map[status] ?? map.scheduled!;
  const Icon = entry.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.5625rem] font-semibold uppercase tracking-[0.06em]",
        entry.className,
      )}
    >
      <Icon className="size-2.5" aria-hidden />
      {entry.label}
    </span>
  );
}
