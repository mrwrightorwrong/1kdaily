import { ArrowUpRight, Receipt } from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@/components/ui/primitives";

export function ActivityCard() {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div>
          <CardTitle>Recent activity</CardTitle>
          <p className="mt-1 text-[0.75rem] text-muted">Confirmed transactions and ledger events.</p>
        </div>
        <Link
          href="/app/transactions"
          className="inline-flex items-center gap-1 text-[0.6875rem] font-semibold text-brand-700 hover:underline"
        >
          All
          <ArrowUpRight className="size-3" aria-hidden />
        </Link>
      </CardHeader>

      <CardContent className="flex-1">
        <EmptyState
          compact
          icon={Receipt}
          title="No transactions yet"
          description="Contributions, withdrawals, disbursements and repayments will appear here with a reference and status."
        />
      </CardContent>

      <CardFooter>
        <p className="text-[0.625rem] leading-relaxed text-subtle">
          Entries appear only after server-side verification. Pending or failed payments are never
          shown as savings.
        </p>
      </CardFooter>
    </Card>
  );
}
