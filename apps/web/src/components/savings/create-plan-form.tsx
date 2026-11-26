"use client";

import { useActionState, useState } from "react";
import { CalendarDays, Info, Lock, ShieldCheck } from "lucide-react";
import {
  addDays,
  asBusinessDate,
  formatBusinessDate,
  isBusinessDate,
  parseNairaToKobo,
  type BusinessDate,
} from "@1kdaily/core";
import { Money } from "@/components/finance/money";
import { CheckboxField, FormAlert, TextField } from "@/components/forms/primitives";
import { Button, Card, CardContent } from "@/components/ui/primitives";
import { initialFormState } from "@/lib/form";
import { createPlanAction } from "@/server/actions/savings";
import type { SavingsProduct } from "@/server/savings/plans";

function safeLength(startDate: string, days: number): string | null {
  if (!isBusinessDate(startDate)) return null;
  return formatBusinessDate(addDays(asBusinessDate(startDate), days - 1), "compact");
}

export function CreatePlanForm({
  product,
  today,
}: {
  readonly product: SavingsProduct;
  readonly today: BusinessDate;
}) {
  const [state, action, pending] = useActionState(createPlanAction, initialFormState);
  const [duration, setDuration] = useState<number>(product.durations[0] ?? 30);
  const [startDate, setStartDate] = useState<string>(today);
  const [amount, setAmount] = useState<string>(
    product.daily_amount_kobo
      ? String(Number(product.daily_amount_kobo) / 100)
      : String(Number(product.min_daily_kobo) / 100),
  );

  const fixedDaily = product.daily_amount_kobo ? BigInt(product.daily_amount_kobo) : null;
  let dailyKobo = fixedDaily ?? 0n;
  let amountValid = true;

  if (product.is_custom) {
    try {
      dailyKobo = parseNairaToKobo(amount);
      amountValid =
        dailyKobo >= BigInt(product.min_daily_kobo) && dailyKobo <= BigInt(product.max_daily_kobo);
    } catch {
      dailyKobo = 0n;
      amountValid = false;
    }
  }

  const totalKobo = dailyKobo * BigInt(duration);
  const endDateLabel = safeLength(startDate, duration);
  const maxStart = addDays(today, 30);

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="product_code" value={product.code} />
      <input type="hidden" name="duration_days" value={duration} />
      <input type="hidden" name="start_date" value={startDate} />
      <input
        type="hidden"
        name="daily_amount"
        value={product.is_custom ? amount : String(Number(product.daily_amount_kobo) / 100)}
      />

      <Card>
        <CardContent className="space-y-4">
          {product.is_custom ? (
            <TextField
              id="daily_amount"
              label="Daily amount (₦)"
              inputMode="decimal"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              hint={`Between ${Number(product.min_daily_kobo) / 100} and ${Number(product.max_daily_kobo) / 100} naira per day.`}
              error={
                state.fieldErrors?.daily_amount ??
                (!amountValid ? "Enter an amount within the limits" : undefined)
              }
            />
          ) : (
            <div className="flex items-baseline justify-between rounded-xl bg-canvas px-3.5 py-3">
              <span className="text-[0.75rem] text-muted">Daily amount</span>
              <span className="text-[1rem] font-semibold text-ink-900">
                <Money value={fixedDaily ?? 0n} decimals={0} />
                <span className="ml-1 text-[0.6875rem] font-medium text-muted">/ day</span>
              </span>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-[0.75rem] font-medium text-ink-900">Duration</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Duration in days">
              {product.durations.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setDuration(option)}
                  aria-pressed={duration === option}
                  className={
                    duration === option
                      ? "rounded-full bg-ink-900 px-3 py-1.5 text-[0.75rem] font-semibold text-white"
                      : "rounded-full bg-canvas px-3 py-1.5 text-[0.75rem] font-medium text-muted ring-1 ring-line hover:text-ink-900"
                  }
                >
                  {option} days
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="start_date_display"
                className="mb-1.5 block text-[0.75rem] font-medium text-ink-900"
              >
                Start date
              </label>
              <input
                id="start_date_display"
                type="date"
                value={startDate}
                min={today}
                max={maxStart}
                onChange={(event) => setStartDate(event.target.value)}
                className="h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-[0.875rem] text-ink-900 shadow-card outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
              />
            </div>
            <TextField
              id="goal"
              label="What are you saving for?"
              optional
              placeholder="Rent, stock, school fees"
              maxLength={160}
              error={state.fieldErrors?.goal}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-subtle">
            Confirm the plan
          </p>

          <dl className="mt-3 divide-y divide-line">
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-[0.8125rem] text-muted">Expected total</dt>
              <dd className="text-[0.9375rem] font-semibold text-ink-900">
                <Money value={totalKobo} decimals={0} />
              </dd>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-[0.8125rem] text-muted">Contribution days</dt>
              <dd className="text-[0.8125rem] font-medium text-ink-900">{duration} days</dd>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <dt className="flex items-center gap-1.5 text-[0.8125rem] text-muted">
                <CalendarDays className="size-3.5" aria-hidden />
                Starts / ends
              </dt>
              <dd className="text-right text-[0.8125rem] font-medium text-ink-900">
                {isBusinessDate(startDate) ? formatBusinessDate(asBusinessDate(startDate), "compact") : "—"}
                {endDateLabel ? ` → ${endDateLabel}` : ""}
              </dd>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-[0.8125rem] text-muted">Grace days</dt>
              <dd className="text-[0.8125rem] font-medium text-ink-900">
                {product.grace_days} day{product.grace_days === 1 ? "" : "s"}
              </dd>
            </div>
          </dl>

          <div className="mt-3 space-y-2 rounded-xl border border-line bg-canvas p-3.5">
            <p className="flex items-start gap-2 text-[0.6875rem] leading-relaxed text-muted">
              <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
              A missed day without grace remaining is recorded as missed and resets your streak. It
              is never hidden and never charged a fee.
            </p>
            <p className="flex items-start gap-2 text-[0.6875rem] leading-relaxed text-muted">
              <Lock className="mt-0.5 size-3 shrink-0" aria-hidden />
              {product.withdrawal_terms}
            </p>
            <p className="flex items-start gap-2 text-[0.6875rem] leading-relaxed text-muted">
              <ShieldCheck className="mt-0.5 size-3 shrink-0" aria-hidden />
              Saving builds a record. It does not guarantee a loan; eligibility is assessed separately.
            </p>
          </div>

          <div className="mt-4">
            <CheckboxField
              id="confirm"
              label={
                <>
                  I have read the daily amount, duration, end date, grace-day rule and withdrawal
                  terms above, and I understand that missed days are recorded.
                </>
              }
              error={state.fieldErrors?.confirm}
            />
          </div>

          <div className="mt-4">
            <FormAlert state={state} />
          </div>

          <Button
            type="submit"
            size="lg"
            className="mt-4 w-full"
            disabled={pending || (product.is_custom && !amountValid) || duration <= 0}
          >
            {pending ? "Activating…" : "Activate plan"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
