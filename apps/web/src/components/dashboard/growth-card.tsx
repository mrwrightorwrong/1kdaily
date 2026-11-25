"use client";

import { useState } from "react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

const RANGES = ["Weekly", "Monthly", "Plan duration"] as const;
type Range = (typeof RANGES)[number];

const CAPTIONS: Record<Range, string> = {
  Weekly:
    "No weekly series yet. Once contributions are confirmed, this chart is built from ledger entries grouped by business date.",
  Monthly:
    "Your growth chart appears after your first confirmed contribution. It plots actual ledger balances, never estimates.",
  "Plan duration":
    "Select a plan to see its full-duration projection. The line will follow confirmed contributions only.",
};

export function GrowthCard() {
  const [range, setRange] = useState<Range>("Monthly");

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Savings growth</CardTitle>
          <p className="mt-1 text-[0.75rem] text-muted">Derived from confirmed ledger entries.</p>
        </div>
        <Badge variant="neutral">No data</Badge>
      </CardHeader>

      <CardContent>
        <div className="flex w-fit gap-1 rounded-full bg-canvas p-1" role="group" aria-label="Chart range">
          {RANGES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setRange(option)}
              aria-pressed={range === option}
              className={cn(
                "rounded-full px-3 py-1 text-[0.6875rem] font-medium transition-colors",
                range === option
                  ? "bg-surface text-ink-900 shadow-card"
                  : "text-muted hover:text-ink-900",
              )}
            >
              {option}
            </button>
          ))}
        </div>

        <div className="relative mt-4 h-44 overflow-hidden rounded-xl border border-line bg-canvas/60">
          <svg
            viewBox="0 0 640 176"
            preserveAspectRatio="none"
            className="absolute inset-0 size-full"
            aria-hidden
          >
            {[28, 66, 104, 142].map((y) => (
              <line
                key={y}
                x1="0"
                x2="640"
                y1={y}
                y2={y}
                stroke="#e4e9f2"
                strokeDasharray="4 7"
                strokeWidth="1"
              />
            ))}
            <line x1="0" x2="640" y1="164" y2="164" stroke="#cbd5e1" strokeWidth="1" />
          </svg>

          <div className="absolute inset-0 grid place-items-center px-6">
            <p className="max-w-[38ch] text-center text-[0.75rem] leading-relaxed text-muted">
              {CAPTIONS[range]}
            </p>
          </div>

          <span className="absolute bottom-2 left-3 text-[0.5625rem] font-medium text-subtle">₦0</span>
        </div>
      </CardContent>
    </Card>
  );
}
