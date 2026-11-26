"use client";

import { useActionState } from "react";
import { Bell } from "lucide-react";
import { FormAlert } from "@/components/forms/primitives";
import { Button } from "@/components/ui/primitives";
import { initialFormState } from "@/lib/form";
import { saveReminderAction } from "@/server/actions/savings";

export function ReminderForm({
  enabled,
  time,
  channels,
}: {
  readonly enabled: boolean;
  readonly time: string;
  readonly channels: readonly string[];
}) {
  const [state, action, pending] = useActionState(saveReminderAction, initialFormState);

  return (
    <form action={action} className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="reminder_enabled" className="flex items-center gap-2 text-[0.8125rem] text-body">
          <input
            id="reminder_enabled"
            name="enabled"
            type="checkbox"
            defaultChecked={enabled}
            className="size-4 rounded border-line accent-[#16A34A]"
          />
          Daily reminder
        </label>
        <label className="flex items-center gap-2 text-[0.6875rem] text-muted">
          Time (WAT)
          <input
            name="reminder_time"
            type="time"
            defaultValue={time}
            className="h-9 rounded-lg border border-line bg-surface px-2 text-[0.75rem] text-ink-900"
          />
        </label>
      </div>

      <fieldset className="flex flex-wrap gap-4">
        <legend className="sr-only">Channels</legend>
        <label className="flex items-center gap-2 text-[0.75rem] text-muted">
          <input
            type="checkbox"
            name="in_app"
            defaultChecked={channels.includes("in_app")}
            className="size-4 rounded border-line accent-[#16A34A]"
          />
          In-app
        </label>
        <label className="flex items-center gap-2 text-[0.75rem] text-muted">
          <input
            type="checkbox"
            name="email"
            defaultChecked={channels.includes("email")}
            className="size-4 rounded border-line accent-[#16A34A]"
          />
          Email
        </label>
      </fieldset>

      <p className="text-[0.625rem] leading-relaxed text-subtle">
        Preferences are saved now. Delivery starts with the notification engine (Phase 11); SMS and
        WhatsApp are not configured.
      </p>

      <FormAlert state={state} />

      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        <Bell className="size-3.5" aria-hidden />
        {pending ? "Saving…" : "Save reminders"}
      </Button>
    </form>
  );
}
