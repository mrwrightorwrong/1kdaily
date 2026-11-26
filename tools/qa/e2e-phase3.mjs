/**
 * Phase 3 end-to-end acceptance: plan catalogue, activation, schedule,
 * calendar, pause/resume, cancel and dashboard integration.
 *
 * Requirements: server on BASE, .env.migrate.local with a Management API token.
 * Auto-confirm is enabled for the run (the project's default SMTP quota is too
 * small for repeatable tests) and restored afterwards.
 *
 * Usage: node tools/qa/e2e-phase3.mjs [baseUrl]
 */
import { existsSync, readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://localhost:3100";
const SCREENSHOTS = ".screens/phase3";

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
const PAT = tooling.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF = tooling.SUPABASE_PROJECT_REF;

if (!PAT || !PROJECT_REF) {
  console.error("Missing Management API credentials.");
  process.exit(1);
}

const executionId = Date.now().toString(36);
const EMAIL = `ada.p3.${executionId}@example.com`;
const PASSWORD = "E2ePlanPassw0rd!";

const results = [];
function check(name, condition, detail = "") {
  results.push({ name, passed: Boolean(condition), detail });
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}${condition ? "" : `\n      ${detail}`}`);
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

async function waitFor(predicate, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await page.waitForTimeout(400);
  }
  return false;
}

const originalAutoconfirm = (await getAuthConfig()).mailer_autoconfirm === true;
await setAutoconfirm(true);
for (let attempt = 0; attempt < 15; attempt += 1) {
  if ((await getAuthConfig()).mailer_autoconfirm === true) break;
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
await new Promise((resolve) => setTimeout(resolve, 4000));
console.log("Auto-confirm temporarily enabled.\n");

try {
  // --------------------------------------------------------------- onboarding
  await page.goto("/sign-up");
  await page.getByLabel("First name").fill("Ada");
  await page.getByLabel("Last name").fill("Plans");
  await page.getByLabel("Email address").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL("**/onboarding/profile", { timeout: 25000 });

  await page.getByLabel("First name").fill("Ada");
  await page.getByLabel("Last name").fill("Plans");
  await page.getByLabel("Date of birth").fill("1994-04-12");
  await page.getByLabel("State").fill("Lagos");
  await page.getByRole("button", { name: /continue to identity/i }).click();
  await page.waitForURL("**/onboarding/identity", { timeout: 25000 });

  await page.getByRole("button", { name: /continue without verifying/i }).click();
  await page.waitForURL("**/onboarding/financial", { timeout: 25000 });

  await page.getByLabel("Employment status").selectOption("salaried");
  await page.getByLabel("Monthly income (₦)").fill("500,000");
  await page.getByLabel("Monthly obligations (₦)").fill("150,000");
  await page.getByRole("button", { name: /finish setup/i }).click();
  await page.waitForURL("**/app", { timeout: 25000 });
  check("onboarding completes", true);

  // ---------------------------------------------------------------- catalogue
  await page.goto("/app/plans");
  const catalogueText = (await page.locator("body").innerText()).toLowerCase();
  for (const name of ["Starter", "Growth", "Builder", "Power", "Custom"]) {
    check(`catalogue lists ${name}`, catalogueText.includes(name.toLowerCase()));
  }
  await shot("01-catalogue");

  // ------------------------------------------------------------ create starter
  const starterCard = page.locator("div.rounded-card").filter({ hasText: "Starter" }).first();
  await starterCard.getByRole("link", { name: /choose this plan/i }).click();
  await page.waitForURL("**/plans/new?product=starter", { timeout: 20000 });

  const builderText = await page.locator("body").innerText();
  check("builder shows the expected total", builderText.includes("₦30,000"));
  check("builder discloses grace days", /grace day/i.test(builderText));
  check("builder discloses withdrawal terms", /withdrawals? (are )?available/i.test(builderText));
  await shot("02-builder");

  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /activate plan/i }).click();
  await page.waitForURL(/\/app\/plans\/[0-9a-f-]{36}\?created=1/, { timeout: 25000 });
  const planUrl = page.url();
  const planId = planUrl.match(/\/app\/plans\/([0-9a-f-]{36})/)?.[1] ?? "";
  check("activation redirects to the plan detail", Boolean(planId));

  const detailText = await page.locator("body").innerText();
  check("plan is active", /active/i.test(await page.getByTestId("plan-status").innerText()));
  check("plan shows 30 days", /30 days/.test(detailText));
  check("plan shows expected total", detailText.includes("₦30,000"));
  check("plan shows the calendar", detailText.includes("Calendar"));
  check("plan explains the Phase 4 boundary", /Phase 4/.test(detailText));
  await shot("03-plan-detail");

  // --------------------------------------------------------- database schedule
  const schedule = await sql(
    `select count(*)::int as days,
            count(*) filter (where status = 'scheduled')::int as scheduled,
            min(business_date) = current_date as starts_today,
            max(business_date) = current_date + 29 as ends_day_30
       from public.savings_plan_days where plan_id = '${planId}'`,
  );
  const row = schedule.rows[0] ?? {};
  check("database materialised 30 days", row.days === 30, JSON.stringify(row));
  check("all days start scheduled", row.scheduled === 30, JSON.stringify(row));
  check("schedule starts today and ends on day 30", row.starts_today === true && row.ends_day_30 === true);

  // ------------------------------------------------------------------- pause
  await page.getByRole("button", { name: /pause plan/i }).click();
  await page.waitForURL(/paused=1/, { timeout: 20000 });
  check(
    "pause moves the plan to paused",
    /paused/i.test(await page.getByTestId("plan-status").innerText()),
  );
  await shot("04-paused");

  await page.getByRole("button", { name: /resume plan/i }).click();
  await page.waitForURL(/resumed=1/, { timeout: 20000 });
  check(
    "resume returns the plan to active",
    /active/i.test(await page.getByTestId("plan-status").innerText()),
  );

  // ------------------------------------------------------- custom + cancel
  await page.goto("/app/plans/new?product=custom");
  await page.getByLabel("Daily amount (₦)").fill("1,500");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /activate plan/i }).click();
  await page.waitForURL(/\/app\/plans\/[0-9a-f-]{36}\?created=1/, { timeout: 25000 });
  const customId = page.url().match(/\/app\/plans\/([0-9a-f-]{36})/)?.[1] ?? "";
  check("custom plan is created", Boolean(customId));

  await page.getByText(/cancel this plan/i).click();
  await page.getByPlaceholder(/reason/i).fill("E2E cancellation check");
  await page.getByRole("button", { name: /confirm cancel/i }).click();
  await page.waitForURL(/cancelled=1/, { timeout: 20000 });

  const cancelledText = await page.locator("body").innerText();
  check(
    "cancelled plan shows cancelled",
    /cancelled/i.test(await page.getByTestId("plan-status").innerText()),
    cancelledText.slice(0, 200),
  );
  await shot("05-cancelled");

  const cancelledRow = await sql(
    `select status,
            (select count(*) from public.savings_plan_days
              where plan_id = '${customId}' and status = 'skipped')::int as skipped
       from public.savings_plans where id = '${customId}'`,
  );
  check(
    "cancellation marks future days skipped",
    cancelledRow.rows[0]?.status === "cancelled" && cancelledRow.rows[0]?.skipped === 30,
    JSON.stringify(cancelledRow.rows[0]),
  );

  // --------------------------------------------------------------- dashboard
  await page.goto("/app");
  const dashboardText = await page.locator("body").innerText();
  check("dashboard shows the active plan", dashboardText.includes("Starter plan"));
  check("dashboard keeps accumulated savings at zero", dashboardText.includes("₦0.00"));
  check("dashboard shows the calendar", dashboardText.includes("Savings calendar"));
  await shot("06-dashboard");

  // -------------------------------------------------------------- isolation
  const leaked = await sql(
    `select count(*)::int as n from public.savings_plans
      where id = '${customId}' and user_id <> (
        select id from auth.users where email = '${EMAIL}'
      )`,
  );
  check("plan belongs only to its owner", leaked.rows[0]?.n === 0, JSON.stringify(leaked.rows[0]));
} catch (error) {
  check("run completed without an unhandled error", false, error.message);
  await shot("99-failure").catch(() => {});
} finally {
  await setAutoconfirm(originalAutoconfirm)
    .then(async () => {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        if ((await getAuthConfig()).mailer_autoconfirm === originalAutoconfirm) return;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      console.error("WARNING: auto-confirm did not return to its original value.");
    })
    .catch((error) => console.error("Could not restore auto-confirm:", error.message));
  await browser.close();
}

const passed = results.filter((entry) => entry.passed).length;
const failed = results.length - passed;
console.log(`\n${passed}/${results.length} checks passed${failed ? `, ${failed} failed` : ""}.`);
console.log(`Customer: ${EMAIL}`);
process.exitCode = failed ? 1 : 0;
