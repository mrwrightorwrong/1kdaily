import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { todayBusinessDate } from "@1kdaily/core";
import { CreatePlanForm } from "@/components/savings/create-plan-form";
import { requireProfile } from "@/server/auth/session";
import { getProductByCode } from "@/server/savings/plans";

export const metadata: Metadata = { title: "New savings plan" };

export default async function NewPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  await requireProfile();
  const { product: code } = await searchParams;
  const product = await getProductByCode(code ?? "");

  if (!product) notFound();

  const today = todayBusinessDate();

  return (
    <div className="animate-rise mx-auto max-w-2xl">
      <Link
        href="/app/plans"
        className="inline-flex items-center gap-1.5 text-[0.75rem] font-medium text-muted transition-colors hover:text-ink-900"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Savings plans
      </Link>

      <h1 className="mt-4 text-[1.5rem] font-semibold tracking-[-0.02em] text-ink-900">
        {product.name} plan
      </h1>
      <p className="mt-1 text-[0.8125rem] text-muted">
        Nothing is charged here. You are creating a schedule; contributions are recorded when the
        payment ledger is live.
      </p>

      <div className="mt-5">
        <CreatePlanForm product={product} today={today} />
      </div>
    </div>
  );
}
