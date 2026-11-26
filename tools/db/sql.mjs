/**
 * Executes SQL against the linked Supabase project through the Management API.
 * This avoids direct Postgres connectivity (IPv4/IPv6 and pooler issues) while
 * still applying real migrations to a real database.
 *
 * Usage:
 *   node tools/db/sql.mjs --file supabase/migrations/0001_identity.sql
 *   node tools/db/sql.mjs --sql "select 1"
 *   node tools/db/sql.mjs --files supabase/migrations/*.sql
 *
 * Credentials come from .env.migrate.local (git-ignored). Nothing is printed.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

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
const token = env.SUPABASE_ACCESS_TOKEN;
const projectRef = env.SUPABASE_PROJECT_REF ?? process.env.SUPABASE_PROJECT_REF;

if (!token || !projectRef) {
  console.error("Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF (.env.migrate.local).");
  process.exit(1);
}

const args = process.argv.slice(2);
const readArg = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

let statements = [];
if (readArg("--sql")) {
  statements = [{ label: "inline", sql: readArg("--sql") }];
} else if (readArg("--file")) {
  const file = readArg("--file");
  statements = [{ label: file, sql: readFileSync(file, "utf8") }];
} else if (readArg("--files")) {
  const index = args.indexOf("--files");
  const files = args.slice(index + 1).filter((value) => !value.startsWith("--"));
  statements = files.map((file) => ({ label: file, sql: readFileSync(file, "utf8") }));
} else {
  console.error("Provide --sql, --file or --files.");
  process.exit(1);
}

async function runQuery(sql) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    },
  );

  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = text;
  }
  return { ok: response.ok, status: response.status, payload };
}

let failed = false;
for (const statement of statements) {
  const started = Date.now();
  const result = await runQuery(statement.sql);
  const elapsed = Date.now() - started;

  if (result.ok) {
    const rows = Array.isArray(result.payload) ? result.payload : [];
    console.log(`ok   ${path.basename(statement.label)} (${elapsed}ms, ${rows.length} row(s))`);
    if (rows.length > 0 && rows.length <= 12) {
      console.log(JSON.stringify(rows, null, 2).slice(0, 4000));
    } else if (rows.length > 12) {
      console.log(JSON.stringify(rows.slice(0, 2), null, 2).slice(0, 1200), "\n  …");
    }
  } else {
    failed = true;
    console.error(`FAIL ${path.basename(statement.label)} (${result.status})`);
    const message =
      typeof result.payload === "object" && result.payload !== null
        ? (result.payload.message ?? result.payload.error ?? JSON.stringify(result.payload))
        : String(result.payload);
    console.error(message.slice(0, 2000));
    break;
  }
}

process.exitCode = failed ? 1 : 0;
