import type { Metadata } from "next";
import Link from "next/link";
import { BellRing } from "lucide-react";
import { Badge, Button, Card, CardContent } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { relativeTime, type NotificationRow } from "@/lib/notifications";
import { markNotificationsReadAction } from "@/server/actions/notifications";
import { createSupabaseServerClient } from "@/server/supabase/server";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, kind, title, body, href, read_at, created_at")
    .order("read_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false })
    .limit(50);

  const items = (data ?? []) as NotificationRow[];
  const unread = items.filter((item) => !item.read_at).length;

  return (
    <div className="animate-rise space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.5rem] font-semibold tracking-[-0.02em] text-ink-900">
            Notifications
          </h1>
          <p className="mt-1 text-[0.8125rem] text-muted">
            Guarantor responses, collateral decisions and loan updates appear here.
          </p>
        </div>
        {unread > 0 ? (
          <form action={markNotificationsReadAction}>
            <Button type="submit" variant="secondary" size="sm">
              Mark all as read
            </Button>
          </form>
        ) : null}
      </div>

      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <BellRing className="mx-auto size-7 text-subtle" strokeWidth={1.7} aria-hidden />
              <p className="mt-3 text-[0.875rem] font-medium text-ink-900">Nothing yet</p>
              <p className="mx-auto mt-1 max-w-sm text-[0.75rem] leading-relaxed text-muted">
                When a guarantor responds to an invitation, or collateral is reviewed, you will see
                it here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3.5",
                    !item.read_at && "bg-brand-50/50",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      item.read_at ? "bg-line-strong" : "bg-brand-500",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[0.8125rem] font-medium text-ink-900">{item.title}</p>
                      {item.read_at ? null : <Badge variant="success">New</Badge>}
                    </div>
                    {item.body ? (
                      <p className="mt-1 text-[0.75rem] leading-relaxed text-muted">{item.body}</p>
                    ) : null}
                    <div className="mt-1.5 flex items-center gap-3">
                      <span className="text-[0.625rem] text-subtle">
                        {relativeTime(item.created_at)}
                      </span>
                      {item.href ? (
                        <Link
                          href={item.href}
                          className="text-[0.6875rem] font-medium text-brand-700 hover:underline"
                        >
                          Open
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-[0.625rem] leading-relaxed text-subtle">
        Notifications are a record of what happened, not a promise of what comes next. Decisions
        themselves are shown on the loan page.
      </p>
    </div>
  );
}
