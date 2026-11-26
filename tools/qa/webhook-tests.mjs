/**
 * Webhook integration checks against a running server.
 *
 * Proves the negative paths that matter: unsigned or forged callbacks are
 * rejected, a valid signature alone never credits savings, and replays are
 * idempotent. The positive path requires a real Paystack test payment.
 *
 * Usage: node tools/qa/webhook-tests.mjs [baseUrl]
 */
import { existsSync, readFileSync } from "node:fs";
import { createHmac } from "node:crypto";

const BASE = process.argv[2] ?? "http://localhost:3100";

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
const SECRET = runtime.PAYSTACK_SECRET_KEY ?? "";
const PAT = tooling.SUPABASE_ACCESS_TOKEN;
const REF = tooling.SUPABASE_PROJECT_REF;

if (!SECRET.startsWith("sk_test_") || !PAT || !REF) {
  console.error("Need a Paystack test secret key and Management API credentials.");
  process.exit(1);
}

const results = [];
function check(name, condition, detail = "") {
  results.push({ name, passed: Boolean(condition) });
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}${condition ? "" : `\n      ${detail}`}`);
}

async function db(query) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = text;
  }
  return { ok: response.ok, rows: Array.isArray(payload) ? payload : [], error: response.ok ? null : text };
}

function sign(body) {
  return createHmac("sha512", SECRET).update(body, "utf8").digest("hex");
}

async function post(body, signature) {
  const headers = { "Content-Type": "application/json" };
  if (signature !== null) headers["x-paystack-signature"] = signature;
  const response = await fetch(`${BASE}/api/webhooks/paystack`, {
    method: "POST",
    headers,
    body,
  });
  return { status: response.status, text: await response.text() };
}

const stamp = Date.now();

// 1. Unsigned
const unsigned = await post(JSON.stringify({ event: "charge.success", data: { id: 1 } }), null);
check("unsigned callback is rejected", unsigned.status === 401, `status ${unsigned.status}`);

// 2. Forged
const forged = await post(JSON.stringify({ event: "charge.success", data: { id: 2 } }), "0".repeat(128));
check("forged signature is rejected", forged.status === 401, `status ${forged.status}`);

// 3. Valid signature, unknown reference
const unknownBody = JSON.stringify({
  event: "charge.success",
  data: {
    id: `unknown-${stamp}`,
    reference: `KD-TEST-UNKNOWN-${stamp}`,
    status: "success",
    amount: 100000,
    currency: "NGN",
    channel: "card",
  },
});
const unknown = await post(unknownBody, sign(unknownBody));
check("valid signature for an unknown reference is acknowledged", unknown.status === 200, unknown.text);

const stored = await db(
  `select count(*)::int as n, max(status) as status from public.payment_provider_events
    where event_id = 'paystack:unknown-${stamp}'`,
);
check(
  "unknown reference event is stored and marked ignored",
  stored.rows[0]?.n === 1 && stored.rows[0]?.status === "ignored",
  JSON.stringify(stored.rows[0]),
);

// 4. Replay
const replay = await post(unknownBody, sign(unknownBody));
const replayRows = await db(
  `select count(*)::int as n from public.payment_provider_events
    where event_id = 'paystack:unknown-${stamp}'`,
);
check(
  "replaying the same event does not create a second row",
  replay.status === 200 && replayRows.rows[0]?.n === 1,
  `${replay.status}, rows ${replayRows.rows[0]?.n}`,
);

// 5. A known contribution with a reference Paystack cannot verify
const knownRef = `KD-TEST-KNOWN-${stamp}`;
await db(
  `insert into public.savings_contributions
     (reference, user_id, plan_id, amount_kobo, status, provider)
   values
     ('${knownRef}', '11111111-1111-1111-1111-111111111111',
      'aaaaaaaa-0000-4000-8000-000000000001', 100000, 'initiated', 'paystack')`,
);

const ledgerBefore = await db(
  `select count(*)::int as n from public.ledger_transactions where reference = '${knownRef}'`,
);

const knownBody = JSON.stringify({
  event: "charge.success",
  data: {
    id: `known-${stamp}`,
    reference: knownRef,
    status: "success",
    amount: 100000,
    currency: "NGN",
    channel: "card",
  },
});
const known = await post(knownBody, sign(knownBody));

const contributionAfter = await db(
  `select status from public.savings_contributions where reference = '${knownRef}'`,
);
const ledgerAfter = await db(
  `select count(*)::int as n from public.ledger_transactions where reference = '${knownRef}'`,
);

check(
  "a webhook body alone never credits savings",
  known.status === 200 &&
    contributionAfter.rows[0]?.status === "initiated" &&
    ledgerAfter.rows[0]?.n === ledgerBefore.rows[0]?.n,
  `status ${contributionAfter.rows[0]?.status}, ledger ${ledgerAfter.rows[0]?.n}`,
);

// 6. Non-charge events are ignored
const otherBody = JSON.stringify({
  event: "transfer.success",
  data: { id: `other-${stamp}`, reference: `KD-OTHER-${stamp}` },
});
const other = await post(otherBody, sign(otherBody));
check("non-charge events are acknowledged and ignored", other.status === 200, other.text);

const passed = results.filter((entry) => entry.passed).length;
console.log(`\n${passed}/${results.length} checks passed.`);
process.exitCode = passed === results.length ? 0 : 1;
