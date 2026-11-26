/**
 * Phase 2 end-to-end acceptance.
 *
 * Drives the real UI against the real Supabase project:
 *   sign-up → email confirmation → sign-in → onboarding → identity submission
 *   → staff review of a masked record → verified customer → database assertions.
 *
 * Requirements:
 *   - dev/prod server running on BASE (default http://localhost:3100)
 *   - KYC_MOCK_AUTO_VERIFY=false so submissions queue for review
 *   - fixtures applied (tools/db/rls-tests.mjs) for the staff account
 *
 * Usage: node tools/qa/e2e-phase2.mjs [baseUrl]
 */
import { existsSync, readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://localhost:3100";
const SCREENSHOTS = ".screens/phase2";

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
const PAT = tooling.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF = tooling.SUPABASE_PROJECT_REF;
const SERVICE_PASSWORD = "CorrectHorseBattery1!";

if (!SUPABASE_URL || !SERVICE_KEY || !PAT || !PROJECT_REF) {
  console.error("Missing Supabase configuration.");
  process.exit(1);
}

const executionId = Date.now().toString(36);
const CUSTOMER_EMAIL = `ada.e2e.${executionId}@example.com`;
const CUSTOMER_PASSWORD = "E2eCustomerPassw0rd!";
// Synthetic, unique per run: 11 digits, never ending in 0000 (which the mock
// treats as "no record"), and never a real person's number.
const BVN = `9${String(Date.now()).slice(-9)}1`;
const BVN_LAST4 = BVN.slice(-4);

const results = [];
function check(name, condition, detail = "") {
  results.push({ name, passed: Boolean(condition), detail });
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}${condition ? "" : `\n      ${detail}`}`);
}

async function supabaseAdmin(path, init = {}) {
  return fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function sql(query) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
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

async function confirmUser(email) {
  const list = await supabaseAdmin(`/admin/users?page=1&per_page=1000`);
  const body = await list.json();
  const user = (body.users ?? []).find((candidate) => candidate.email === email);
  if (!user) throw new Error(`user ${email} not found`);
  const update = await supabaseAdmin(`/admin/users/${user.id}`, {
    method: "PUT",
    body: JSON.stringify({ email_confirm: true }),
  });
  if (!update.ok) throw new Error(`confirm failed: ${await update.text()}`);
  return user.id;
}

async function getAuthConfig() {
  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
    headers: { Authorization: `Bearer ${PAT}` },
  });
  return response.json();
}

async function setAutoconfirm(enabled) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ mailer_autoconfirm: enabled }),
  });
  if (!response.ok) throw new Error(`autoconfirm toggle failed: ${await response.text()}`);
}

const BROWSERS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
];
const executablePath = BROWSERS.find((candidate) => existsSync(candidate));

const browser = await chromium.launch({ executablePath });
const context = await browser.newContext({
  baseURL: BASE,
  viewport: { width: 1280, height: 1000 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
page.setDefaultTimeout(20000);

async function shot(name) {
  await page.screenshot({ path: `${SCREENSHOTS}/${name}.png`, fullPage: true });
}

async function waitForCondition(predicate, timeoutMs = 15000, intervalMs = 400) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await page.waitForTimeout(intervalMs);
  }
  return false;
}

// The project's default SMTP has a small hourly quota. For a repeatable local
// acceptance run, auto-confirm is enabled for the duration and restored after.
// GoTrue caches auth config, so wait until the change is actually visible.
const originalAutoconfirm = (await getAuthConfig()).mailer_autoconfirm === true;

// Remove leftover identity records from previous acceptance runs so the queue
// reflects only this run. Audit history is append-only and intentionally kept.
await sql(
  `delete from public.identity_documents d
     using auth.users u
    where d.user_id = u.id
      and u.email like 'ada.e2e.%@example.com'`,
);

await setAutoconfirm(true);
{
  let applied = false;
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const config = await getAuthConfig();
    if (config.mailer_autoconfirm === true) {
      applied = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (!applied) throw new Error("Auto-confirm did not propagate to the auth service.");
  await new Promise((resolve) => setTimeout(resolve, 4000));
}
console.log("Auto-confirm temporarily enabled for this run.\n");

let customerId = "";

try {
  // ---------------------------------------------------------------- sign-up
  await page.goto("/sign-up");
  await page.getByLabel("First name").fill("Ada");
  await page.getByLabel("Last name").fill("E2E");
  await page.getByLabel("Email address").fill(CUSTOMER_EMAIL);
  await page.getByLabel("Password").fill(CUSTOMER_PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /create account/i }).click();

  await page.waitForURL(
    (url) => url.pathname === "/verify-email" || url.pathname === "/onboarding/profile",
    { timeout: 25000 },
  );
  check("sign-up completes with the account created", true);

  if (new URL(page.url()).pathname === "/verify-email") {
    await shot("01-verify-email");
    customerId = await confirmUser(CUSTOMER_EMAIL);
    check("email confirmed through the admin API (test harness only)", Boolean(customerId));

    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill(CUSTOMER_EMAIL);
    await page.getByLabel("Password").fill(CUSTOMER_PASSWORD);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await page.waitForURL("**/onboarding/profile", { timeout: 25000 });
    check("sign-in redirects a new account into onboarding", true);
  } else {
    customerId = (await sql(`select id from auth.users where email = '${CUSTOMER_EMAIL}'`)).rows[0]?.id ?? "";
    check("auto-confirmed sign-up lands directly in onboarding", Boolean(customerId));
  }

  // ---------------------------------------------------------------- profile
  await page.getByLabel("First name").fill("Ada");
  await page.getByLabel("Last name").fill("E2E");
  await page.getByLabel("Phone number").fill("+2348012345678");
  await page.getByLabel("Date of birth").fill("1995-05-10");
  await page.getByLabel("State").fill("Lagos");
  await page.getByLabel("Address").fill("12 Test Close, Yaba");
  await page.getByRole("button", { name: /continue to identity/i }).click();

  await page.waitForURL("**/onboarding/identity", { timeout: 25000 });
  check("profile step advances to identity", true);
  await shot("02-identity-step");

  // ---------------------------------------------------------------- identity
  await page.getByLabel("Document type").selectOption("bvn");
  await page.getByLabel("11-digit number").fill(BVN);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /submit for verification/i }).click();

  await page.waitForURL("**/onboarding/financial?identity=needs_review", { timeout: 25000 });
  check("identity submission queues for review (mock provider, no auto-verify)", true);

  // ----------------------------------------------------------- affordability
  await page.getByLabel("Employment status").selectOption("salaried");
  await page.getByLabel("Income source").fill("Salary");
  await page.getByLabel("Monthly income (₦)").fill("450,000");
  await page.getByLabel("Monthly obligations (₦)").fill("120,000");
  await page.getByLabel("Existing debt (₦)").fill("0");
  await page.getByRole("button", { name: /finish setup/i }).click();

  await page.waitForURL("**/app", { timeout: 25000 });
  check("onboarding completes and lands on the dashboard", true);
  await page.waitForTimeout(500);
  await shot("03-dashboard-review");

  const bodyText = await page.locator("body").innerText();
  check("dashboard greets the customer", bodyText.includes("Welcome, Ada"), bodyText.slice(0, 200));
  check("dashboard shows identity in review", bodyText.toLowerCase().includes("identity in review"));
  check("raw BVN is absent from the dashboard", !bodyText.includes(BVN));

  // ----------------------------------------------------------------- profile
  await page.goto("/app/profile");
  const profileText = await page.locator("body").innerText();
  check("profile shows the masked identifier", profileText.includes(`•••• ${BVN_LAST4}`));
  check("profile never renders the raw identifier", !profileText.includes(BVN));
  check("profile lists the consent record", profileText.toLowerCase().includes("identity verification"));
  await shot("04-profile");

  const pageHtml = await page.content();
  check("raw BVN absent from the entire profile document", !pageHtml.includes(BVN));

  // ------------------------------------------------------- non-staff denial
  await page.goto("/admin");
  const adminText = await page.locator("body").innerText();
  check(
    "customer without a staff role sees the access-required screen",
    adminText.includes("Staff access required"),
  );
  await shot("05-admin-denied");

  // ------------------------------------------------------------- staff review
  await page.goto("/app/profile");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(`${BASE}/`, { timeout: 20000 });

  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill("verifier.tests@1kdaily.test");
  await page.getByLabel("Password").fill(SERVICE_PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/app", { timeout: 25000 });

  await page.goto("/admin/kyc");
  await page.waitForTimeout(500);
  const queueText = await page.locator("body").innerText();
  check("verification officer can open the review queue", queueText.includes("Identity verification"));
  check("queue shows the customer name", queueText.includes("Ada E2E"), queueText.slice(0, 400));
  check("queue shows the masked identifier", queueText.includes(`•••• ${BVN_LAST4}`));
  check("queue never shows the raw identifier", !queueText.includes(BVN));
  await shot("06-admin-queue");

  const row = page.locator("tr", { hasText: BVN_LAST4 }).first();
  await row.getByLabel("Decision").selectOption("verify");
  await row.getByLabel("Reason").fill("Vendor match confirmed, exact name match on BVN.");
  await row.getByRole("button", { name: /record/i }).click();
  const rowCleared = await waitForCondition(
    async () => (await page.locator("tr", { hasText: BVN_LAST4 }).count()) === 0,
  );

  const remainingRows = await page.locator("tr", { hasText: BVN_LAST4 }).count();
  check(
    "decided record leaves the pending queue",
    rowCleared && remainingRows === 0,
    `${remainingRows} row(s) still listed`,
  );
  await shot("07-admin-decided");

  // ------------------------------------------------------- verified customer
  await page.goto("/app");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(`${BASE}/`, { timeout: 20000 });

  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(CUSTOMER_EMAIL);
  await page.getByLabel("Password").fill(CUSTOMER_PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/app", { timeout: 25000 });

  const verifiedText = await page.locator("body").innerText();
  const showsVerified = await waitForCondition(async () => {
    const text = await page.locator("body").innerText();
    return text.includes("Identity verified");
  });
  check("customer now sees identity verified", showsVerified, verifiedText.slice(0, 300));
  await shot("08-dashboard-verified");

  // ------------------------------------------------------------- database
  const doc = await sql(
    `select kind, status, last4, digest, char_length(digest) as digest_len,
            vendor, attempt_count
       from public.identity_documents
      where user_id = '${customerId}'`,
  );
  const record = doc.rows[0] ?? {};
  check("database stores the masked record as verified", record.status === "verified", JSON.stringify(record));
  check("database stores only last4", record.last4 === BVN_LAST4, String(record.last4));
  check("database stores a 64-hex digest", record.digest_len === 64, String(record.digest_len));

  const leak = await sql(
    `select
       (select count(*)::int from public.identity_documents d
         where to_jsonb(d)::text like '%${BVN}%') as doc_hits,
       (select count(*)::int from public.audit_logs a
         where coalesce(a.before_state::text,'') || coalesce(a.after_state::text,'')
               || coalesce(a.reason,'') like '%${BVN}%') as audit_hits,
       (select count(*)::int from public.user_verifications v
         where to_jsonb(v)::text like '%${BVN}%') as verification_hits,
       (select count(*)::int from public.consent_records c
         where to_jsonb(c)::text like '%${BVN}%') as consent_hits,
       (select count(*)::int from public.user_profiles p
         where to_jsonb(p)::text like '%${BVN}%') as profile_hits`,
  );
  const hits = leak.rows[0] ?? {};
  check(
    "raw identifier appears nowhere in any stored row",
    Object.values(hits).every((value) => value === 0),
    JSON.stringify(hits),
  );

  const audits = await sql(
    `select action, entity_id, after_state
       from public.audit_logs
      where entity_id in (select id::text from public.identity_documents where user_id = '${customerId}')
      order by created_at`,
  );
  const actions = audits.rows.map((entry) => entry.action);
  check(
    "audit trail contains submission and a decision",
    actions.includes("identity.submit") &&
      actions.some((action) => ["identity.verify", "identity.reject"].includes(action)),
    JSON.stringify(actions),
  );
  check(
    "audit payload contains no raw identifier",
    audits.rows.every((entry) => !JSON.stringify(entry).includes(BVN)),
  );

  const consent = await sql(
    `select count(*)::int as n from public.consent_records
      where user_id = '${customerId}' and purpose = 'identity_verification'`,
  );
  check("consent evidence recorded before verification", (consent.rows[0]?.n ?? 0) >= 1);

  const profileRow = await sql(
    `select onboarding_step, onboarding_completed_at is not null as completed
       from public.user_profiles where id = '${customerId}'`,
  );
  check("profile is marked onboarded", profileRow.rows[0]?.completed === true);
} catch (error) {
  check("run completed without an unhandled error", false, error.message);
  await shot("99-failure").catch(() => {});
} finally {
  await setAutoconfirm(originalAutoconfirm)
    .then(async () => {
      // Verify the restore took effect; config propagation is asynchronous.
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const config = await getAuthConfig();
        if (config.mailer_autoconfirm === originalAutoconfirm) return;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      console.error("WARNING: auto-confirm did not return to its original value.");
    })
    .catch((error) => console.error("Could not restore auto-confirm:", error.message));
  await browser.close();
}

const passed = results.filter((result) => result.passed).length;
const failed = results.length - passed;
console.log(`\n${passed}/${results.length} checks passed${failed ? `, ${failed} failed` : ""}.`);
console.log(`Customer: ${CUSTOMER_EMAIL}`);
process.exitCode = failed ? 1 : 0;
