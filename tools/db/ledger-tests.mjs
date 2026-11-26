/**
 * Phase 4 ledger suite.
 *
 * Exercises the money core against the real database:
 * balanced transactions, append-only history, derived balances, FIFO allocation,
 * idempotent confirmation, duplicate provider references, and reconciliation.
 *
 * Every case runs inside a transaction that is rolled back. Deferred balance
 * constraints are forced with `set constraints all immediate` so the invariant
 * is checked inside the test rather than at commit.
 *
 * Usage: node tools/db/ledger-tests.mjs
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

const env = { ...loadEnv(".env.migrate.local"), ...process.env };
const TOKEN = env.SUPABASE_ACCESS_TOKEN;
const REF = env.SUPABASE_PROJECT_REF;

if (!TOKEN || !REF) {
  console.error("Missing SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_REF.");
  process.exit(1);
}

const CUSTOMER_A = "11111111-1111-1111-1111-111111111111";
const CUSTOMER_B = "22222222-2222-2222-2222-222222222222";
const PLAN = "aaaaaaaa-0000-4000-8000-000000000001";
const DAILY = 100000;

const claims = (userId) =>
  JSON.stringify({ sub: userId, role: "authenticated", aud: "authenticated" });

async function sql(query) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = text;
  }
  return {
    ok: response.ok,
    status: response.status,
    rows: Array.isArray(payload) ? payload : [],
    error: response.ok ? null : (payload?.message ?? String(payload)),
  };
}

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`PASS  ${name}`);
  } catch (error) {
    results.push({ name, passed: false, detail: error.message });
    console.log(`FAIL  ${name}\n      ${error.message}`);
  }
}
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const row = (response) => response.rows[0] ?? {};
const expectError = (response, { code, includes }) => {
  assert(!response.ok, "expected the query to fail, but it succeeded");
  const embedded = /ERROR:\s+([0-9A-Z]{5}):/.exec(response.error ?? "")?.[1];
  const actual = response.status === 400 ? embedded : embedded;
  if (code) assert(actual === code, `expected SQLSTATE ${code}, got ${actual} (${response.error})`);
  if (includes) {
    assert(
      (response.error ?? "").toLowerCase().includes(includes.toLowerCase()),
      `expected error to mention "${includes}", got: ${response.error}`,
    );
  }
};

/** Runs a script as an authenticated customer. */
const asUser = (userId, body) =>
  sql(`begin; set local role authenticated; select set_config('request.jwt.claims', '${claims(userId)}', true); ${body}; rollback;`);

if (!process.argv.includes("--no-fixtures")) {
  for (const file of ["supabase/tests/phase2_fixtures.sql", "supabase/tests/phase3_fixtures.sql"]) {
    const applied = await sql(readFileSync(file, "utf8"));
    if (!applied.ok) {
      console.error(`Fixture setup failed (${file}):`, applied.error);
      process.exit(1);
    }
  }
  console.log("Fixtures applied.\n");
}

// ---------------------------------------------------------------------------
// Invariants
// ---------------------------------------------------------------------------

await test("an unbalanced transaction is rejected", async () => {
  const response = await sql(`
    begin;
    select app.post_transaction(
      'TEST-UNBALANCED-' || gen_random_uuid(),
      'adjustment',
      'unbalanced test',
      jsonb_build_array(
        jsonb_build_object('account_code', '1000', 'direction', 'debit', 'amount_kobo', 100),
        jsonb_build_object('account_code', '2100', 'direction', 'credit', 'amount_kobo', 50)
      )
    );
    set constraints all immediate;
    rollback;`);
  expectError(response, { code: "23514", includes: "unbalanced" });
});

await test("a transaction with a single entry is rejected", async () => {
  const response = await sql(`
    begin;
    select app.post_transaction(
      'TEST-SINGLE-' || gen_random_uuid(),
      'adjustment',
      'single entry test',
      jsonb_build_array(
        jsonb_build_object('account_code', '1000', 'direction', 'debit', 'amount_kobo', 100)
      )
    );
    set constraints all immediate;
    rollback;`);
  expectError(response, { code: "22023", includes: "at least two entries" });
});

await test("ledger entries and transactions are append-only", async () => {
  const entries = await sql(`
    begin;
    select app.post_transaction(
      'TEST-APPEND-' || gen_random_uuid(),
      'adjustment',
      'append-only test',
      jsonb_build_array(
        jsonb_build_object('account_code', '1000', 'direction', 'debit', 'amount_kobo', 100),
        jsonb_build_object('account_code', '2100', 'direction', 'credit', 'amount_kobo', 100)
      )
    );
    update public.ledger_entries set amount_kobo = 200
     where id = (select id from public.ledger_entries limit 1);
    rollback;`);
  expectError(entries, { code: "23001" });

  const transactions = await sql(`
    begin;
    select app.post_transaction(
      'TEST-APPEND2-' || gen_random_uuid(),
      'adjustment',
      'append-only test',
      jsonb_build_array(
        jsonb_build_object('account_code', '1000', 'direction', 'debit', 'amount_kobo', 100),
        jsonb_build_object('account_code', '2100', 'direction', 'credit', 'amount_kobo', 100)
      )
    );
    delete from public.ledger_transactions
     where id = (select id from public.ledger_transactions limit 1);
    rollback;`);
  expectError(transactions, { code: "23001" });
});

await test("a balanced posting updates derived balances", async () => {
  const response = await sql(`
    begin;
    create temp table before on commit drop as
      select
        coalesce((select b.balance_kobo from public.account_balances b
           join public.financial_accounts a on a.id = b.account_id where a.code = '1000'), 0) as cash,
        coalesce((select b.balance_kobo from public.account_balances b
           join public.financial_accounts a on a.id = b.account_id where a.code = '2100'), 0) as equity;
    select app.post_transaction(
      'TEST-BAL-' || gen_random_uuid(),
      'adjustment',
      'balanced test',
      jsonb_build_array(
        jsonb_build_object('account_code', '1000', 'direction', 'debit', 'amount_kobo', 5000),
        jsonb_build_object('account_code', '2100', 'direction', 'credit', 'amount_kobo', 5000)
      )
    );
    set constraints all immediate;
    select
      (select coalesce(b.balance_kobo, 0) from public.account_balances b
         join public.financial_accounts a on a.id = b.account_id where a.code = '1000')
        - (select cash from before) as cash_delta,
      (select coalesce(b.balance_kobo, 0) from public.account_balances b
         join public.financial_accounts a on a.id = b.account_id where a.code = '2100')
        - (select equity from before) as equity_delta;
    rollback;`);
  assert(response.ok, response.error);
  assert(Number(row(response).cash_delta) === 5000, `cash delta ${row(response).cash_delta}`);
  assert(Number(row(response).equity_delta) === 5000, `equity delta ${row(response).equity_delta}`);
});

// ---------------------------------------------------------------------------
// Contribution flow
// ---------------------------------------------------------------------------

await test("initiating and confirming a contribution posts balanced entries and pays days", async () => {
  const response = await sql(`
    begin;
    set local role authenticated;
    select set_config('request.jwt.claims', '${claims(CUSTOMER_A)}', true);
    create temp table ctx on commit drop as
      select * from public.initiate_contribution('${PLAN}', ${DAILY * 2}, 'ledger-test-1');
    reset role;
    select public.confirm_contribution(
      (select contribution_id from ctx), 'prov-test-1', ${DAILY * 2}, 'card', now()
    );
    set constraints all immediate;
    select
      (select status from public.savings_contributions where id = (select contribution_id from ctx)) as status,
      (select count(*)::int from public.savings_plan_days
        where plan_id = '${PLAN}' and status = 'paid') as paid_days,
      (select balance_kobo from public.account_balances b
        join public.financial_accounts a on a.id = b.account_id
       where a.code = '2200-${CUSTOMER_A}') as savings_balance,
      (select count(*)::int from public.ledger_transactions t
        join public.savings_contributions c on c.ledger_transaction_id = t.id
       where c.id = (select contribution_id from ctx)) as ledger_rows;
    rollback;`);
  assert(response.ok, response.error);
  assert(row(response).status === "confirmed", `status ${row(response).status}`);
  assert(row(response).paid_days === 2, `expected 2 paid days, got ${row(response).paid_days}`);
  assert(Number(row(response).savings_balance) === DAILY * 2, `savings ${row(response).savings_balance}`);
  assert(row(response).ledger_rows === 1, "contribution is not linked to a ledger transaction");
});

await test("confirmation is idempotent", async () => {
  const response = await sql(`
    begin;
    set local role authenticated;
    select set_config('request.jwt.claims', '${claims(CUSTOMER_A)}', true);
    create temp table ctx on commit drop as
      select * from public.initiate_contribution('${PLAN}', ${DAILY}, 'ledger-test-idem');
    reset role;
    select public.confirm_contribution((select contribution_id from ctx), 'prov-idem', ${DAILY}, 'card', now());
    select public.confirm_contribution((select contribution_id from ctx), 'prov-idem', ${DAILY}, 'card', now());
    set constraints all immediate;
    select
      (select count(*)::int from public.ledger_entries e
        where e.transaction_id = (select ledger_transaction_id from public.savings_contributions
                                   where id = (select contribution_id from ctx))) as entries,
      (select count(*)::int from public.savings_plan_days
        where plan_id = '${PLAN}' and status = 'paid') as paid_days;
    rollback;`);
  assert(response.ok, response.error);
  assert(row(response).entries === 2, `expected one transaction (2 entries), got ${row(response).entries}`);
  assert(row(response).paid_days === 1, `double allocation: ${row(response).paid_days} paid days`);
});

await test("a mismatched paid amount is refused", async () => {
  const response = await sql(`
    begin;
    set local role authenticated;
    select set_config('request.jwt.claims', '${claims(CUSTOMER_A)}', true);
    create temp table ctx on commit drop as
      select * from public.initiate_contribution('${PLAN}', ${DAILY}, 'ledger-test-mismatch');
    reset role;
    select public.confirm_contribution((select contribution_id from ctx), 'prov-mismatch', ${DAILY + 1}, 'card', now());
    rollback;`);
  expectError(response, { code: "22023", includes: "does not match" });
});

await test("the same provider reference cannot confirm two contributions", async () => {
  const response = await sql(`
    begin;
    set local role authenticated;
    select set_config('request.jwt.claims', '${claims(CUSTOMER_A)}', true);
    create temp table a on commit drop as
      select * from public.initiate_contribution('${PLAN}', ${DAILY}, 'ledger-dup-a');
    create temp table b on commit drop as
      select * from public.initiate_contribution('${PLAN}', ${DAILY}, 'ledger-dup-b');
    reset role;
    select public.confirm_contribution((select contribution_id from a), 'prov-dup', ${DAILY}, 'card', now());
    select public.confirm_contribution((select contribution_id from b), 'prov-dup', ${DAILY}, 'card', now());
    rollback;`);
  expectError(response, { code: "23505" });
});

await test("a partial payment marks the day partially paid", async () => {
  const response = await sql(`
    begin;
    set local role authenticated;
    select set_config('request.jwt.claims', '${claims(CUSTOMER_A)}', true);
    create temp table ctx on commit drop as
      select * from public.initiate_contribution('${PLAN}', ${Math.floor(DAILY / 2)}, 'ledger-partial');
    reset role;
    select public.confirm_contribution(
      (select contribution_id from ctx), 'prov-partial', ${Math.floor(DAILY / 2)}, 'card', now()
    );
    set constraints all immediate;
    select count(*)::int as partial,
           coalesce(sum(paid_kobo), 0) as paid
      from public.savings_plan_days
     where plan_id = '${PLAN}' and status = 'partially_paid';
    rollback;`);
  assert(response.ok, response.error);
  assert(row(response).partial === 1, `expected one partial day, got ${row(response).partial}`);
  assert(Number(row(response).paid) === Math.floor(DAILY / 2), `paid ${row(response).paid}`);
});

await test("FIFO allocation fills the oldest due days first", async () => {
  const response = await sql(`
    begin;
    set local role authenticated;
    select set_config('request.jwt.claims', '${claims(CUSTOMER_A)}', true);
    select public.refresh_my_plan_days();
    create temp table ctx on commit drop as
      select * from public.initiate_contribution('${PLAN}', ${DAILY * 3}, 'ledger-fifo');
    reset role;
    select public.confirm_contribution(
      (select contribution_id from ctx), 'prov-fifo', ${DAILY * 3}, 'card', now()
    );
    set constraints all immediate;
    select
      (select count(*)::int from public.savings_plan_days
        where plan_id = '${PLAN}' and status = 'paid' and business_date < current_date) as past_paid,
      (select count(*)::int from public.savings_plan_days
        where plan_id = '${PLAN}' and status = 'paid' and business_date >= current_date) as future_paid,
      (select count(*)::int from public.savings_plan_days
        where plan_id = '${PLAN}' and status = 'grace') as grace_left;
    rollback;`);
  assert(response.ok, response.error);
  assert(Number(row(response).past_paid) === 3, `expected 3 due days paid, got ${row(response).past_paid}`);
  assert(
    Number(row(response).future_paid) === 0,
    `a future day was paid before due days: ${row(response).future_paid}`,
  );
  assert(Number(row(response).grace_left) === 0, "grace days were not converted first");
});

await test("a paused plan refuses contributions", async () => {
  const response = await asUser(
    CUSTOMER_A,
    `select public.pause_my_plan('${PLAN}');
     select * from public.initiate_contribution('${PLAN}', ${DAILY}, 'ledger-paused')`,
  );
  expectError(response, { code: "22023", includes: "active" });
});

await test("another customer cannot see the contribution", async () => {
  const response = await asUser(
    CUSTOMER_B,
    "select count(*)::int as n from public.savings_contributions",
  );
  assert(response.ok, response.error);
  assert(row(response).n === 0, `expected 0 contributions, got ${row(response).n}`);
});

await test("a customer cannot confirm their own contribution", async () => {
  const response = await sql(`
    begin;
    set local role authenticated;
    select set_config('request.jwt.claims', '${claims(CUSTOMER_A)}', true);
    create temp table ctx on commit drop as
      select * from public.initiate_contribution('${PLAN}', ${DAILY}, 'ledger-self-confirm');
    select public.confirm_contribution(
      (select contribution_id from ctx), 'prov-self', ${DAILY}, 'card', now()
    );
    rollback;`);
  expectError(response, { code: "42501" });
});

await test("provider events are not readable by customers", async () => {
  const response = await asUser(CUSTOMER_A, "select count(*) from public.payment_provider_events");
  expectError(response, { code: "42501" });
});

// ---------------------------------------------------------------------------
// Reconciliation
// ---------------------------------------------------------------------------

await test("reconciliation reports no exceptions for a clean ledger", async () => {
  const response = await sql(`
    begin;
    set local role authenticated;
    select set_config('request.jwt.claims', '${claims(CUSTOMER_A)}', true);
    create temp table ctx on commit drop as
      select * from public.initiate_contribution('${PLAN}', ${DAILY}, 'ledger-recon');
    reset role;
    select public.confirm_contribution((select contribution_id from ctx), 'prov-recon', ${DAILY}, 'card', now());
    set constraints all immediate;
    create temp table run on commit drop as select app.run_ledger_reconciliation('test') as id;
    select (select exceptions from public.reconciliation_runs where id = (select id from run)) as exceptions;
    rollback;`);
  assert(response.ok, response.error);
  assert(row(response).exceptions === 0, `expected 0 exceptions, got ${row(response).exceptions}`);
});

await test("reconciliation detects a corrupted cached balance", async () => {
  const response = await sql(`
    begin;
    insert into public.account_balances (account_id, balance_kobo, updated_at)
    select id, 12345, now() from public.financial_accounts where code = '1000'
    on conflict (account_id) do update
      set balance_kobo = public.account_balances.balance_kobo + 12345;
    create temp table run on commit drop as select app.run_ledger_reconciliation('drift test') as id;
    select
      (select exceptions from public.reconciliation_runs where id = (select id from run)) as exceptions,
      (select count(*)::int from public.reconciliation_exceptions
        where run_id = (select id from run) and kind = 'balance_drift') as drift;
    rollback;`);
  assert(response.ok, response.error);
  assert(Number(row(response).drift) >= 1, "drift was not detected");
  assert(Number(row(response).exceptions) >= 1, "exception count was not recorded");
});

// ---------------------------------------------------------------------------
// Reversals
// ---------------------------------------------------------------------------

await test("a customer cannot reverse a contribution", async () => {
  const response = await asUser(
    CUSTOMER_A,
    `select public.reverse_contribution(
       (select id from public.savings_contributions where status = 'confirmed' limit 1),
       'customer attempted a reversal')`,
  );
  expectError(response, { code: "42501" });
});

await test("an authorised reversal restores the day and balances the ledger", async () => {
  const response = await sql(`
    begin;
    set local role authenticated;
    select set_config('request.jwt.claims', '${claims(CUSTOMER_A)}', true);
    create temp table ctx on commit drop as
      select * from public.initiate_contribution('${PLAN}', ${DAILY}, 'ledger-reversal');
    reset role;
    select public.confirm_contribution((select contribution_id from ctx), 'prov-reversal', ${DAILY}, 'card', now());

    insert into public.admin_user_roles (user_id, role_id)
    select '44444444-4444-4444-4444-444444444444', id from public.admin_roles where key = 'finance_admin'
    on conflict do nothing;

    set local role authenticated;
    select set_config('request.jwt.claims', '${claims("44444444-4444-4444-4444-444444444444")}', true);
    select public.reverse_contribution(
      (select contribution_id from ctx),
      'Duplicate test charge reversed after provider confirmation'
    );
    reset role;
    set constraints all immediate;

    select
      (select status from public.savings_contributions where id = (select contribution_id from ctx)) as status,
      (select count(*)::int from public.savings_plan_days
        where plan_id = '${PLAN}' and status = 'paid' and contribution_id is not null) as still_paid,
      (select count(*)::int from public.savings_contribution_allocations
        where contribution_id = (select contribution_id from ctx)) as allocations,
      (select balance_kobo from public.account_balances b
        join public.financial_accounts a on a.id = b.account_id
       where a.code = '2200-${CUSTOMER_A}') as savings,
      (select count(*)::int from public.ledger_entries e
        where e.transaction_id = (select reversal_transaction_id from public.savings_contributions
                                   where id = (select contribution_id from ctx))) as reversal_entries;
    rollback;`);
  assert(response.ok, response.error);
  assert(row(response).status === "reversed", `status ${row(response).status}`);
  assert(Number(row(response).still_paid) === 0, "a day remained paid after reversal");
  assert(Number(row(response).allocations) === 1, "allocation record missing");
  assert(Number(row(response).savings) === 0, `savings balance ${row(response).savings}`);
  assert(Number(row(response).reversal_entries) === 2, "reversal is not a balanced two-entry transaction");
});

await test("a contribution cannot be reversed twice", async () => {
  const response = await sql(`
    begin;
    set local role authenticated;
    select set_config('request.jwt.claims', '${claims(CUSTOMER_A)}', true);
    create temp table ctx on commit drop as
      select * from public.initiate_contribution('${PLAN}', ${DAILY}, 'ledger-reversal-twice');
    reset role;
    select public.confirm_contribution((select contribution_id from ctx), 'prov-rev2', ${DAILY}, 'card', now());
    insert into public.admin_user_roles (user_id, role_id)
    select '44444444-4444-4444-4444-444444444444', id from public.admin_roles where key = 'finance_admin'
    on conflict do nothing;
    set local role authenticated;
    select set_config('request.jwt.claims', '${claims("44444444-4444-4444-4444-444444444444")}', true);
    select public.reverse_contribution((select contribution_id from ctx), 'First reversal reason text');
    select public.reverse_contribution((select contribution_id from ctx), 'Second reversal attempt text');
    rollback;`);
  expectError(response, { code: "22023", includes: "confirmed" });
});

const passed = results.filter((entry) => entry.passed).length;
const failed = results.length - passed;
console.log(`\n${passed}/${results.length} passed${failed ? `, ${failed} failed` : ""}.`);
process.exitCode = failed ? 1 : 0;
