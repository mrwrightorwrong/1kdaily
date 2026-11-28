import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { relativeTime, type NotificationRow } from "@/lib/notifications";

export function UpdatesCard({
  items,
  unread,
}: {
  readonly items: ReadonlyArray<NotificationRow>;
  readonly unread: number;
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Updates</CardTitle>
          <p className="mt-1 text-[0.75rem] text-muted">
            {unread === 1 ? "1 unread notification" : `${unread} unread notifications`}
          </p>
        </div>
        <Link
          href="/app/notifications"
          className="text-[0.6875rem] font-semibold text-brand-700 hover:underline"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent className="pt-3">
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-line px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-[0.75rem] font-medium text-ink-900">{item.title}</p>
                {item.body ? (
                  <p className="mt-0.5 line-clamp-2 text-[0.6875rem] leading-relaxed text-muted">
                    {item.body}
                  </p>
                ) : null}
              </div>
              <span className="shrink-0 text-[0.625rem] text-subtle">
                {relativeTime(item.created_at)}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
