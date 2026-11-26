/**
 * Provider-side reconciliation.
 *
 * Fetches Paystack transactions, stages them in `provider_transactions`, then
 * runs `app.run_provider_reconciliation()` which compares them to confirmed
 * contributions and records exceptions. Nothing is auto-resolved.
 *
 * Usage:
 *   node tools/db/reconcile-provider.mjs [--days 30] [--pages 5]
 */
import { existsSync, readFileSync } from "node:fs";

function loadEnv(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) out[match[1]] = match[2].trim();
  }
  return out;
}

const runtime = loadEnv("apps/web/.env.local");
const tooling = loadEnv(".env.migrate.local");

const SUPABASE_URL = runtime.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = runtime.SUPABASE_SERVICE_ROLE_KEY ?? "";
const PAYSTACK_SECRET = runtime.PAYSTACK_SECRET_KEY ?? "";
const PAT = tooling.SUPABASE_ACCESS_TOKEN;
const REF = tooling.SUPABASE_PROJECT_REF;

if (!SUPABASE_URL || !SERVICE_KEY || !PAYSTACK_SECRET || !PAT || !REF) {
  console.error("Missing Supabase or Paystack configuration.");
  process.exit(1);
}
if (!PAYSTACK_SECRET.startsWith("sk_test_")) {
  console.error("Refusing to reconcile with a non-test Paystack key from a developer machine.");
  process.exit(1);
}

const args = process.argv.slice(2);
const readArg = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? Number(args[index + 1]) : fallback;
};
const days = readArg("--days", 30);
const maxPages = readArg("--pages", 5);

async function paystack(path) {
  const response = await fetch(`https://api.paystack.co${path}`, {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.status) {
    throw new Error(body?.message ?? `Paystack error ${response.status}`);
  }
  return body.data;
}

async function stage(rows) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/provider_transactions?on_conflict=provider,provider_transaction_id`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
    },
  );
  if (!response.ok) {
    throw new Error(`staging failed: ${(await response.text()).slice(0, 200)}`);
  }
}

async function sql(query) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text.slice(0, 300));
  return JSON.parse(text);
}

const from = new Date(Date.now() - days * 86_400_000).toISOString();
const to = new Date().toISOString();

let staged = 0;
for (let page = 1; page <= maxPages; page += 1) {
  const batch = await paystack(
    `/transaction?perPage=100&page=${page}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
  if (!Array.isArray(batch) || batch.length === 0) break;

  await stage(
    batch.map((transaction) => ({
      provider: "paystack",
      provider_transaction_id: String(transaction.id),
      reference: transaction.reference ?? null,
      amount_kobo: String(transaction.amount ?? 0),
      currency: transaction.currency ?? "NGN",
      status: transaction.status ?? "unknown",
      channel: transaction.channel ?? null,
      paid_at: transaction.paid_at ?? null,
      fees_kobo: transaction.fees != null ? String(transaction.fees) : null,
      payload: transaction,
      fetched_at: new Date().toISOString(),
    })),
  );

  staged += batch.length;
  if (batch.length < 100) break;
}

const run = await sql(`select app.run_provider_reconciliation('paystack') as id`);
const runId = run[0]?.id;

const summary = await sql(`
  select
    r.checked, r.exceptions,
    coalesce((select jsonb_object_agg(kind, n) from (
      select kind, count(*)::int as n
        from public.reconciliation_exceptions
       where run_id = '${runId}'
       group by kind
    ) s), '{}'::jsonb) as by_kind
  from public.reconciliation_runs r
  where r.id = '${runId}'
`);

console.log(`Fetched ${staged} provider transaction(s) for the last ${days} day(s).`);
console.log(`Reconciliation run ${runId}`);
console.log(`  checked: ${summary[0]?.checked}`);
console.log(`  exceptions: ${summary[0]?.exceptions}`);
console.log(`  by kind: ${JSON.stringify(summary[0]?.by_kind)}`);
console.log(
  summary[0]?.exceptions === 0
    ? "Provider statement matches the ledger."
    : "Exceptions recorded for review — nothing was auto-resolved.",
);
process.exitCode = summary[0]?.exceptions === 0 ? 0 : 2;
