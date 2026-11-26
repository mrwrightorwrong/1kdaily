"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addDays,
  asBusinessDate,
  daysInMonth,
  formatBusinessDate,
  startOfMonth,
  todayBusinessDate,
  weekdayOf,
  type BusinessDate,
} from "@1kdaily/core";
import { cn } from "@/lib/cn";

export type CalendarDay = {
  readonly date: string;
  readonly status: string;
};

const STATUS_STYLE: Record<string, string> = {
  paid: "bg-brand-600 text-white",
  partially_paid: "bg-brand-300 text-brand-900",
  grace: "bg-gold-500 text-ink-900",
  missed: "bg-danger-50 text-danger-600 ring-1 ring-danger-600/30",
  paused: "bg-ink-900/5 text-subtle ring-1 ring-line",
  skipped: "bg-canvas text-subtle/60",
  scheduled: "bg-surface text-muted ring-1 ring-line",
};

const LEGEND = [
  { label: "Paid", className: "bg-brand-600" },
  { label: "Partial", className: "bg-brand-300" },
  { label: "Grace", className: "bg-gold-500" },
  { label: "Missed", className: "bg-danger-50 ring-1 ring-danger-600/40" },
  { label: "Paused", className: "bg-line" },
  { label: "Scheduled", className: "bg-surface ring-1 ring-line" },
] as const;

function monthKey(date: BusinessDate): string {
  return date.slice(0, 7);
}

export function PlanCalendar({
  days,
  initialMonth,
}: {
  readonly days: readonly CalendarDay[];
  readonly initialMonth?: string;
}) {
  const today = todayBusinessDate();
  const firstOfMonth = startOfMonth(asBusinessDate(initialMonth ? `${initialMonth}-01` : today));
  const [month, setMonth] = useState<BusinessDate>(firstOfMonth);

  const byDate = useMemo(() => new Map(days.map((day) => [day.date, day.status])), [days]);

  const cells = useMemo(() => {
    const leading = weekdayOf(month);
    const total = daysInMonth(month);
    const gridStart = addDays(month, -leading);
    const cellCount = Math.ceil((leading + total) / 7) * 7;

    return Array.from({ length: cellCount }, (_, index) => {
      const date = addDays(gridStart, index);
      return {
        date,
        dayOfMonth: Number(date.slice(8, 10)),
        inMonth: date.slice(0, 7) === monthKey(month),
        status: byDate.get(date),
      };
    });
  }, [byDate, month]);

  const monthStats = useMemo(() => {
    let paid = 0;
    let missed = 0;
    let grace = 0;
    for (const day of days) {
      if (day.date.slice(0, 7) !== monthKey(month)) continue;
      if (day.status === "paid" || day.status === "partially_paid") paid += 1;
      else if (day.status === "missed") missed += 1;
      else if (day.status === "grace") grace += 1;
    }
    return { paid, missed, grace };
  }, [days, month]);

  const canGoBack = month > addDays(today, -366);
  const canGoForward = month < addDays(today, 366);

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMonth(startOfMonth(addDays(month, -1)))}
            disabled={!canGoBack}
            aria-label="Previous month"
            className="grid size-8 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink-900 disabled:opacity-40"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <p className="min-w-32 text-center text-[0.8125rem] font-semibold text-ink-900">
            {formatBusinessDate(month, "monthYear")}
          </p>
          <button
            type="button"
            onClick={() => setMonth(startOfMonth(addDays(month, 32)))}
            disabled={!canGoForward}
            aria-label="Next month"
            className="grid size-8 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink-900 disabled:opacity-40"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>

        <p className="text-[0.625rem] text-subtle">
          {monthStats.paid} paid · {monthStats.grace} grace · {monthStats.missed} missed
        </p>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
          <span
            key={label}
            aria-hidden
            className="pb-1 text-center text-[0.5625rem] font-semibold uppercase tracking-wide text-subtle"
          >
            {label.slice(0, 1)}
          </span>
        ))}

        {cells.map((cell) => {
          const isToday = cell.date === today;
          const style = cell.status ? STATUS_STYLE[cell.status] : undefined;

          return (
            <div
              key={cell.date}
              title={
                cell.status
                  ? `${formatBusinessDate(cell.date, "medium")} — ${cell.status.replace(/_/g, " ")}`
                  : formatBusinessDate(cell.date, "medium")
              }
              aria-label={
                cell.status
                  ? `${formatBusinessDate(cell.date, "medium")}: ${cell.status.replace(/_/g, " ")}`
                  : undefined
              }
              className={cn(
                "relative grid aspect-square place-items-center rounded-lg text-[0.625rem] font-medium",
                cell.inMonth ? "opacity-100" : "opacity-35",
                style ?? "bg-transparent text-subtle",
                isToday && "ring-2 ring-ink-900 ring-offset-1",
              )}
            >
              {cell.dayOfMonth}
              {cell.status === "paid" ? (
                <span aria-hidden className="absolute bottom-1 size-0.5 rounded-full bg-white/80" />
              ) : null}
            </div>
          );
        })}
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5">
        {LEGEND.map((item) => (
          <li key={item.label} className="flex items-center gap-1.5">
            <span className={cn("size-1.5 rounded-full", item.className)} aria-hidden />
            <span className="text-[0.625rem] text-muted">{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
