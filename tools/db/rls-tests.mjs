/**
 * Phase 2 security suite.
 *
 * Runs real RLS and RPC assertions against the linked Supabase project. Every
 * case executes in a transaction that is rolled back, with a real JWT claim so
 * `auth.uid()` behaves exactly as it does in production.
 *
 * Covers the guarantee that matters most: a BVN or NIN is unreachable from any
 * client role, and administrators only ever see a masked record.
 *
 * Usage:
 *   node tools/db/rls-tests.mjs            # apply fixtures + run
 *   node tools/db/rls-tests.mjs --no-fixtures
 */
import { existsSync, readFileSync } from "node:fs";

function loadEnv(file) {
  if (!existsSync(file)) return {};
  const output = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) output[match[1]] = match[2].trim();
  }
  return output;
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
const STAFF = "33333333-3333-3333-3333-333333333333";
const AUDITOR = "44444444-4444-4444-4444-444444444444";

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
    code: response.ok ? null : payload?.code,
  };
}

const claims = (userId) => JSON.stringify({ sub: userId, role: "authenticated", aud: "authenticated" });

/** Runs a body as an authenticated customer, then rolls back. */
function asUser(userId, body) {
  return sql(`
    begin;
    set local role authenticated;
    select set_config('request.jwt.claims', '${claims(userId)}', true);
    ${body};
    rollback;
  `);
}

function asAnon(body) {
  return sql(`begin; set local role anon; ${body}; rollback;`);
}

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push({ name, passed: true, detail: "" });
    console.log(`PASS  ${name}`);
  } catch (error) {
    results.push({ name, passed: false, detail: error.message });
    console.log(`FAIL  ${name}\n      ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function expectError(response, { code, includes }) {
  assert(!response.ok, "expected the query to fail, but it succeeded");
  // The Management API returns SQLSTATE inside the message, not as a field.
  const embedded = /ERROR:\s+([0-9A-Z]{5}):/.exec(response.error ?? "")?.[1];
  const actualCode = response.code ?? embedded;
  if (code) {
    assert(
      actualCode === code,
      `expected SQLSTATE ${code}, got ${actualCode ?? "none"} (${response.error})`,
    );
  }
  if (includes) {
    assert(
      (response.error ?? "").toLowerCase().includes(includes.toLowerCase()),
      `expected error to mention "${includes}", got: ${response.error}`,
    );
  }
}

const row = (response) => response.rows[0] ?? {};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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
// Anonymous access
// ---------------------------------------------------------------------------

await test("anon cannot read user_profiles", async () => {
  const response = await asAnon("select count(*) from public.user_profiles");
  expectError(response, { code: "42501" });
});

await test("anon cannot read identity_documents", async () => {
  const response = await asAnon("select count(*) from public.identity_documents");
  expectError(response, { code: "42501" });
});

// ---------------------------------------------------------------------------
// Customer isolation
// ---------------------------------------------------------------------------

await test("customer sees exactly one profile (their own)", async () => {
  const response = await asUser(CUSTOMER_A, "select count(*)::int as n from public.user_profiles");
  assert(response.ok, response.error);
  assert(row(response).n === 1, `expected 1 profile, got ${row(response).n}`);
});

await test("customer cannot read another customer's profile", async () => {
  const response = await asUser(
    CUSTOMER_A,
    `select count(*)::int as n from public.user_profiles where id = '${CUSTOMER_B}'`,
  );
  assert(response.ok, response.error);
  assert(row(response).n === 0, `expected 0 rows for another customer, got ${row(response).n}`);
});

await test("financial profiles are isolated", async () => {
  const response = await asUser(
    CUSTOMER_A,
    `select count(*)::int as own, count(*) filter (where user_id = '${CUSTOMER_B}')::int as other
       from public.user_financial_profiles`,
  );
  assert(response.ok, response.error);
  assert(row(response).own === 1, `expected own financial profile, got ${row(response).own}`);
  assert(row(response).other === 0, `expected no access to another profile, got ${row(response).other}`);
});

await test("consent records are isolated", async () => {
  const response = await asUser(
    CUSTOMER_A,
    `select count(*) filter (where user_id = '${CUSTOMER_B}')::int as other
       from public.consent_records`,
  );
  assert(response.ok, response.error);
  assert(row(response).other === 0, "another customer's consents were visible");
});

await test("customer has no SELECT privilege on identity_documents", async () => {
  const response = await asUser(CUSTOMER_A, "select count(*) from public.identity_documents");
  expectError(response, { code: "42501" });
});

// ---------------------------------------------------------------------------
// No client writes
// ---------------------------------------------------------------------------

await test("customer cannot update their profile table directly", async () => {
  const response = await asUser(
    CUSTOMER_A,
    "update public.user_profiles set first_name = 'Hacked' where id = auth.uid()",
  );
  expectError(response, { code: "42501" });
});

await test("customer cannot insert a profile row", async () => {
  const response = await asUser(
    CUSTOMER_A,
    `insert into public.user_profiles (id, first_name, last_name)
     values ('11111111-1111-1111-1111-111111111111', 'X', 'Y')`,
  );
  expectError(response, { code: "42501" });
});

await test("customer cannot write consent records directly", async () => {
  const response = await asUser(
    CUSTOMER_A,
    `insert into public.consent_records (user_id, purpose, document_version, granted)
     values (auth.uid(), 'marketing', 'v1', true)`,
  );
  expectError(response, { code: "42501" });
});

await test("customer cannot delete their account row", async () => {
  const response = await asUser(CUSTOMER_A, "delete from public.user_profiles where id = auth.uid()");
  expectError(response, { code: "42501" });
});

// ---------------------------------------------------------------------------
// Audit log access
// ---------------------------------------------------------------------------

await test("customer cannot read the audit log", async () => {
  const response = await asUser(CUSTOMER_A, "select count(*)::int as n from public.audit_logs");
  assert(response.ok, response.error);
  assert(row(response).n === 0, `expected 0 audit rows, got ${row(response).n}`);
});

await test("verification officer cannot read the audit log", async () => {
  const response = await asUser(STAFF, "select count(*)::int as n from public.audit_logs");
  assert(response.ok, response.error);
  assert(row(response).n === 0, `verification officer read ${row(response).n} audit rows`);
});

await test("auditor can read the audit log", async () => {
  const response = await asUser(AUDITOR, "select count(*)::int as n from public.audit_logs");
  assert(response.ok, response.error);
  assert(row(response).n > 0, "auditor could not read the audit log");
});

// ---------------------------------------------------------------------------
// Profile writes through the sanctioned RPC
// ---------------------------------------------------------------------------

await test("customer can update their own profile through the RPC", async () => {
  const response = await asUser(
    CUSTOMER_A,
    `select public.update_my_profile(
       'Alice', 'Adeyemi', '+2348012345678', null, 'Lagos', '1 Test Street'
     );
     reset role;
     select first_name, phone, state from public.user_profiles
      where id = '${CUSTOMER_A}'`,
  );
  assert(response.ok, response.error);
  assert(row(response).phone === "+2348012345678", `phone not saved: ${JSON.stringify(row(response))}`);
  assert(row(response).state === "Lagos", "state not saved");
});

await test("under-18 date of birth is rejected", async () => {
  const response = await asUser(
    CUSTOMER_A,
    `select public.update_my_profile(
       'Alice', 'Adeyemi', null, (current_date - interval '12 years')::date, null, null
     )`,
  );
  expectError(response, { code: "22023", includes: "18" });
});

await test("invalid phone format is rejected", async () => {
  const response = await asUser(
    CUSTOMER_A,
    `select public.update_my_profile('Alice', 'Adeyemi', '08012345678', null, null, null)`,
  );
  expectError(response, { code: "22023", includes: "international" });
});

// ---------------------------------------------------------------------------
// Identity: masked access only
// ---------------------------------------------------------------------------

await test("identity_documents has no policy at all", async () => {
  const response = await sql(
    `select count(*)::int as n from pg_policies
      where schemaname = 'public' and tablename = 'identity_documents'`,
  );
  assert(response.ok, response.error);
  assert(row(response).n === 0, `expected zero policies, found ${row(response).n}`);
});

await test("no column exists that could hold a raw identifier", async () => {
  const response = await sql(
    `select count(*)::int as n
       from information_schema.columns
      where table_schema = 'public'
        and table_name = 'identity_documents'
        and (column_name ~* '(bvn|nin|value|identifier|number)')`,
  );
  assert(response.ok, response.error);
  assert(row(response).n === 0, `found ${row(response).n} suspicious column(s)`);
});

await test("customer cannot read identity_documents via any client path", async () => {
  const response = await asUser(CUSTOMER_A, "select * from public.identity_documents limit 1");
  expectError(response, { code: "42501" });
});

await test("customer sees only masked identity fields for themselves", async () => {
  const response = await asUser(
    CUSTOMER_A,
    "select kind, status, last4, match_result from public.my_identity_summary()",
  );
  assert(response.ok, response.error);
  assert(response.rows.length === 1, `expected one identity record, got ${response.rows.length}`);
  const record = row(response);
  assert(record.last4 === "1234", `unexpected last4: ${record.last4}`);
  assert(
    Object.keys(record).sort().join(",") === "kind,last4,match_result,status",
    `unexpected columns returned: ${Object.keys(record).join(",")}`,
  );
});

await test("staff queue exposes masked fields only", async () => {
  const response = await asUser(STAFF, "select * from public.admin_identity_queue(50)");
  assert(response.ok, response.error);
  assert(response.rows.length >= 1, "expected at least one pending identity record");
  const record = row(response);
  const columns = Object.keys(record).sort();
  assert(
    columns.join(",") ===
      "attempt_count,document_id,full_name,kind,last4,match_result,status,submitted_at,user_id",
    `unexpected queue columns: ${columns.join(",")}`,
  );
  assert(/^[0-9]{4}$/.test(record.last4), `last4 is not masked: ${record.last4}`);
});

await test("customer cannot call the staff queue", async () => {
  const response = await asUser(CUSTOMER_A, "select * from public.admin_identity_queue(50)");
  expectError(response, { code: "42501", includes: "permission" });
});

await test("customer cannot call the identity decision RPC", async () => {
  const docId = row(
    await sql(
      `select id from public.identity_documents
        where user_id = '${CUSTOMER_A}' and kind = 'bvn'`,
    ),
  ).id;
  const response = await asUser(
    CUSTOMER_A,
    `select public.admin_decide_identity('${docId}', 'verify', 'attempted escalation by customer')`,
  );
  expectError(response, { code: "42501" });
});

await test("staff review verifies the record and writes an audit entry", async () => {
  const docId = row(
    await sql(
      `select id from public.identity_documents
        where user_id = '${CUSTOMER_A}' and kind = 'bvn'`,
    ),
  ).id;

  const response = await asUser(
    STAFF,
    `select public.admin_decide_identity('${docId}', 'verify', 'Vendor match confirmed, exact name match');
     reset role;
     select
       (select status from public.identity_documents where id = '${docId}') as document_status,
       (select status from public.user_verifications
         where user_id = '${CUSTOMER_A}' and kind = 'bvn') as verification_status,
       (select count(*)::int from public.audit_logs
         where action = 'identity.verify' and entity_id = '${docId}') as audit_rows`,
  );
  assert(response.ok, response.error);
  assert(row(response).document_status === "verified", "document not verified");
  assert(row(response).verification_status === "verified", "verification row not updated");
  assert(row(response).audit_rows === 1, `expected one audit row, got ${row(response).audit_rows}`);
});

await test("one identity number cannot verify two accounts", async () => {
  const response = await sql(
    `begin;
     insert into public.identity_documents (user_id, kind, status, last4, digest, vendor)
     values ('${CUSTOMER_A}', 'nin', 'verified', '9876', repeat('b', 64), 'mock');
     rollback;`,
  );
  expectError(response, { code: "23505" });
});

await test("no raw identifier leaked into the audit trail", async () => {
  const response = await sql(
    `select count(*)::int as n
       from public.audit_logs
      where coalesce(after_state::text, '') ~ '[0-9]{11}'
         or coalesce(before_state::text, '') ~ '[0-9]{11}'`,
  );
  assert(response.ok, response.error);
  assert(row(response).n === 0, `${row(response).n} audit row(s) contain an 11-digit sequence`);
});

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

await test("onboarding cannot skip a step", async () => {
  const response = await asUser(CUSTOMER_A, "select public.advance_onboarding('financial')");
  expectError(response, { code: "22023", includes: "in order" });
});

await test("onboarding advances one step at a time", async () => {
  const response = await asUser(
    CUSTOMER_A,
    `select public.advance_onboarding('identity');
     reset role;
     select onboarding_step from public.user_profiles where id = '${CUSTOMER_A}'`,
  );
  assert(response.ok, response.error);
  assert(row(response).onboarding_step === "identity", `step is ${row(response).onboarding_step}`);
});

await test("profile RPC returns the caller's verified email", async () => {
  const response = await asUser(
    CUSTOMER_A,
    "select first_name, email, email_verified from public.my_profile()",
  );
  assert(response.ok, response.error);
  assert(row(response).email === "alice.tests@1kdaily.test", "wrong email");
  assert(row(response).email_verified === true, "email should be confirmed in fixtures");
});

// ---------------------------------------------------------------------------
// Phase 3: savings plans
// ---------------------------------------------------------------------------

const FIXTURE_PLAN = "aaaaaaaa-0000-4000-8000-000000000001";

await test("customer can read the product catalogue", async () => {
  const response = await asUser(CUSTOMER_A, "select count(*)::int as n from public.savings_products");
  assert(response.ok, response.error);
  assert(row(response).n >= 4, `expected catalogue rows, got ${row(response).n}`);
});

await test("schedule maintenance applies grace before marking missed", async () => {
  const response = await asUser(
    CUSTOMER_A,
    `select public.refresh_my_plan_days();
     reset role;
     select
       (select count(*)::int from public.savings_plan_days
         where plan_id = '${FIXTURE_PLAN}' and status = 'grace') as grace,
       (select count(*)::int from public.savings_plan_days
         where plan_id = '${FIXTURE_PLAN}' and status = 'missed') as missed,
       (select grace_days_used from public.savings_plans where id = '${FIXTURE_PLAN}') as used`,
  );
  assert(response.ok, response.error);
  assert(row(response).grace === 2, `expected 2 grace days, got ${row(response).grace}`);
  assert(row(response).missed === 3, `expected 3 missed days, got ${row(response).missed}`);
  assert(row(response).used === 2, `expected grace used 2, got ${row(response).used}`);
});

await test("another customer cannot see the plan or its days", async () => {
  const response = await asUser(
    CUSTOMER_B,
    `select
       (select count(*)::int from public.savings_plans) as plans,
       (select count(*)::int from public.savings_plan_days) as days`,
  );
  assert(response.ok, response.error);
  assert(row(response).plans === 0, `expected 0 plans, got ${row(response).plans}`);
  assert(row(response).days === 0, `expected 0 days, got ${row(response).days}`);
});

await test("another customer cannot pause a plan they do not own", async () => {
  const response = await asUser(CUSTOMER_B, `select public.pause_my_plan('${FIXTURE_PLAN}')`);
  expectError(response, { code: "P0002" });
});

await test("auditor with savings:read can read plans", async () => {
  const response = await asUser(AUDITOR, "select count(*)::int as n from public.savings_plans");
  assert(response.ok, response.error);
  assert(row(response).n >= 1, "auditor could not read the fixture plan");
});

await test("verification officer without savings:read cannot read plans", async () => {
  const response = await asUser(STAFF, "select count(*)::int as n from public.savings_plans");
  assert(response.ok, response.error);
  assert(row(response).n === 0, `expected 0 plans, got ${row(response).n}`);
});

await test("customer cannot write plans or days directly", async () => {
  const plans = await asUser(
    CUSTOMER_A,
    `insert into public.savings_plans
       (user_id, product_id, name, daily_amount_kobo, duration_days, start_date, end_date,
        withdrawal_policy, withdrawal_terms)
     select auth.uid(), id, 'Hack', 100000, 30, current_date, current_date + 29,
            withdrawal_policy, withdrawal_terms
       from public.savings_products where code = 'starter'`,
  );
  expectError(plans, { code: "42501" });

  const days = await asUser(
    CUSTOMER_A,
    `update public.savings_plan_days set status = 'paid'
      where plan_id = '${FIXTURE_PLAN}'`,
  );
  expectError(days, { code: "42501" });
});

await test("preset plans reject a different daily amount", async () => {
  const response = await asUser(
    CUSTOMER_A,
    `select public.create_savings_plan('starter', 200000, 30, current_date, null)`,
  );
  expectError(response, { code: "22023", includes: "daily amount" });
});

await test("custom plans enforce the configured limits", async () => {
  const response = await asUser(
    CUSTOMER_A,
    `select public.create_savings_plan('custom', 1000, 30, current_date, null)`,
  );
  expectError(response, { code: "22023" });
});

await test("a duration must be offered by the product", async () => {
  const response = await asUser(
    CUSTOMER_A,
    `select public.create_savings_plan('starter', 100000, 365, current_date, null)`,
  );
  expectError(response, { code: "22023", includes: "duration" });
});

await test("a plan cannot start in the past", async () => {
  const response = await asUser(
    CUSTOMER_A,
    `select public.create_savings_plan('starter', 100000, 30, current_date - 1, null)`,
  );
  expectError(response, { code: "22023", includes: "past" });
});

await test("creating a plan materialises its schedule", async () => {
  const response = await asUser(
    CUSTOMER_A,
    `create temp table ctx on commit drop as
       select public.create_savings_plan('growth', 200000, 60, current_date, 'Test goal') as id;
     reset role;
     select
       (select count(*)::int from public.savings_plan_days d
         where d.plan_id = (select id from ctx)) as days,
       (select status from public.savings_plans where id = (select id from ctx)) as status,
       (select end_date = start_date + 59 from public.savings_plans
         where id = (select id from ctx)) as end_ok`,
  );
  assert(response.ok, response.error);
  assert(row(response).days === 60, `expected 60 days, got ${row(response).days}`);
  assert(row(response).status === "active", `expected active, got ${row(response).status}`);
  assert(row(response).end_ok === true, "end date is not start + duration - 1");
});

await test("a customer cannot hold more than three active plans", async () => {
  const response = await asUser(
    CUSTOMER_A,
    `select public.create_savings_plan('starter', 100000, 30, current_date, null);
     select public.create_savings_plan('starter', 100000, 30, current_date, null);
     select public.create_savings_plan('starter', 100000, 30, current_date, null);`,
  );
  expectError(response, { code: "22023", includes: "three active" });
});

await test("pause then resume extends the schedule by the paused time", async () => {
  const response = await sql(`
    begin;
    create temp table ctx(id uuid) on commit drop;
    grant all on ctx to authenticated;
    set local role authenticated;
    select set_config('request.jwt.claims', '${claims(CUSTOMER_A)}', true);
    insert into ctx select public.create_savings_plan('starter', 100000, 30, current_date, null);
    select public.pause_my_plan((select id from ctx));
    reset role;
    update public.savings_plans
       set paused_at = now() - interval '2 days'
     where id = (select id from ctx);
    set local role authenticated;
    select public.resume_my_plan((select id from ctx));
    reset role;
    select
      (select end_date - start_date + 1 from public.savings_plans where id = (select id from ctx)) as span,
      (select pause_days_used from public.savings_plans where id = (select id from ctx)) as paused_days,
      (select count(*)::int from public.savings_plan_days
        where plan_id = (select id from ctx) and status = 'paused') as paused_rows;
    rollback;`);
  assert(response.ok, response.error);
  assert(row(response).span === 32, `expected a 32-day span, got ${row(response).span}`);
  assert(row(response).paused_days === 2, `expected 2 paused days, got ${row(response).paused_days}`);
  assert(row(response).paused_rows === 0, "expected no paused day rows for a same-day start");
});

await test("cancelling a plan marks future days skipped", async () => {
  const response = await sql(`
    begin;
    create temp table ctx(id uuid) on commit drop;
    grant all on ctx to authenticated;
    set local role authenticated;
    select set_config('request.jwt.claims', '${claims(CUSTOMER_A)}', true);
    insert into ctx select public.create_savings_plan('starter', 100000, 30, current_date, null);
    select public.cancel_my_plan((select id from ctx), 'Test cancellation');
    reset role;
    select
      (select status from public.savings_plans where id = (select id from ctx)) as status,
      (select count(*)::int from public.savings_plan_days
        where plan_id = (select id from ctx) and status = 'skipped') as skipped;
    rollback;`);
  assert(response.ok, response.error);
  assert(row(response).status === "cancelled", `expected cancelled, got ${row(response).status}`);
  assert(row(response).skipped === 30, `expected 30 skipped days, got ${row(response).skipped}`);
});

await test("reminder preferences are private", async () => {
  const response = await asUser(
    CUSTOMER_A,
    `select public.set_reminder_preferences(true, '07:30', array['in_app', 'email']);
     reset role;
     select enabled, reminder_time, array_length(channels, 1) as channels
       from public.savings_reminder_preferences where user_id = '${CUSTOMER_A}'`,
  );
  assert(response.ok, response.error);
  assert(row(response).reminder_time === "07:30:00", `unexpected time ${row(response).reminder_time}`);
  assert(row(response).channels === 2, `unexpected channel count ${row(response).channels}`);

  const other = await asUser(
    CUSTOMER_B,
    "select count(*)::int as n from public.savings_reminder_preferences",
  );
  assert(other.ok, other.error);
  assert(row(other).n === 0, "another customer's reminder preferences were visible");
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const passed = results.filter((result) => result.passed).length;
const failed = results.length - passed;
console.log(`\n${passed}/${results.length} passed${failed ? `, ${failed} failed` : ""}.`);
process.exitCode = failed ? 1 : 0;
