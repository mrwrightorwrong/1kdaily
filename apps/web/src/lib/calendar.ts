import {
  addDays,
  daysInMonth,
  formatBusinessDate,
  startOfMonth,
  todayBusinessDate,
  weekdayOf,
  type BusinessDate,
} from "@1kdaily/core";

export type CalendarCell = {
  readonly date: BusinessDate;
  readonly dayOfMonth: number;
  readonly inMonth: boolean;
};

export type MonthCalendar = {
  readonly monthLabel: string;
  readonly weekdayLabels: readonly string[];
  readonly cells: readonly CalendarCell[];
  readonly today: BusinessDate;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const WEEKS_SHOWN = 6;

/**
 * Fixed 6-week grid so the calendar never changes height between months
 * (prevents layout shift on the dashboard).
 */
export function buildMonthCalendar(now: Date = new Date()): MonthCalendar {
  const today = todayBusinessDate(now);
  const first = startOfMonth(today);
  const leading = weekdayOf(first);
  const gridStart = addDays(first, -leading);
  const cells = Array.from({ length: WEEKS_SHOWN * 7 }, (_, index) => {
    const date = addDays(gridStart, index);
    return {
      date,
      dayOfMonth: Number(date.slice(8, 10)),
      inMonth: date.slice(0, 7) === first.slice(0, 7),
    };
  });

  return {
    monthLabel: formatBusinessDate(today, "monthYear"),
    weekdayLabels: WEEKDAYS,
    cells,
    today,
  };
}

export function monthLength(now: Date = new Date()): number {
  return daysInMonth(todayBusinessDate(now));
}
