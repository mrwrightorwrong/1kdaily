/**
 * Identity-leak audit.
 *
 * Confirms that the operator's real BVN/NIN values appear nowhere in the source
 * tree and, optionally, in the database and the full git object store.
 *
 * The values are read from the operator's key file at runtime and are never
 * printed, logged or written anywhere.
 *
 * Usage:
 *   node tools/check-identity-leak.mjs --keys "C:\path\to\keys.txt"
 *   node tools/check-identity-leak.mjs --keys ... --db --git
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { execFile } from "node:child_process";
import path from "node:path";

const args = process.argv.slice(2);
const readFlag = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const keysPath = readFlag("--keys");
const checkDb = args.includes("--db");
const checkGit = args.includes("--git");

if (!keysPath || !existsSync(keysPath)) {
  console.error("usage: node tools/check-identity-leak.mjs --keys <path> [--db] [--git]");
  process.exit(1);
}

const values = [];
for (const line of readFileSync(keysPath, "utf8").split(/\r?\n/)) {
  const match = line.match(/^(BVN|NIN)\s*:?\s*(\d{11})\s*$/i);
  if (match) values.push({ kind: match[1].toUpperCase(), value: match[2] });
}

if (values.length === 0) {
  console.error("No BVN/NIN values found in the key file.");
  process.exit(1);
}
console.log(`Auditing ${values.length} identifier(s). Values are never printed.`);

// ---------------------------------------------------------------------------
// Source tree
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".screens", ".vercel"]);

function walk(directory, onFile) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(full, onFile);
      continue;
    }
    const stat = statSync(full);
    if (!stat.isFile() || stat.size > 2_000_000) continue;
    onFile(full);
  }
}

let treeLeaks = 0;
let filesScanned = 0;
walk(".", (file) => {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return;
  }
  filesScanned += 1;
  for (const entry of values) {
    if (text.includes(entry.value)) {
      treeLeaks += 1;
      console.error(`LEAK ${entry.kind} in ${file}`);
    }
  }
});
console.log(`Source tree: ${filesScanned} files scanned, ${treeLeaks} leak(s).`);

// ---------------------------------------------------------------------------
// Git object store (every blob, including unreachable-but-present objects)
// ---------------------------------------------------------------------------

let gitLeaks = 0;
if (checkGit) {
  const buffer = await new Promise((resolve, reject) => {
    execFile(
      "git",
      ["cat-file", "--batch-all-objects", "--batch"],
      { maxBuffer: 512 * 1024 * 1024, encoding: "buffer" },
      (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout);
      },
    );
  });

  const haystack = buffer.toString("latin1");
  for (const entry of values) {
    const count = haystack.split(entry.value).length - 1;
    if (count > 0) {
      gitLeaks += count;
      console.error(`LEAK ${entry.kind}: ${count} occurrence(s) in git objects`);
    }
  }
  console.log(
    `Git object store: ${(buffer.length / 1024 / 1024).toFixed(1)} MB scanned, ${gitLeaks} leak(s).`,
  );
}

// ---------------------------------------------------------------------------
// Database (via Management API)
// ---------------------------------------------------------------------------

let dbLeaks = 0;
if (checkDb) {
  const env = Object.fromEntries(
    readFileSync(".env.migrate.local", "utf8")
      .split(/\r?\n/)
      .filter((line) => /^[A-Z0-9_]+=/.test(line))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
  );

  const tables = [
    "identity_documents",
    "audit_logs",
    "user_verifications",
    "user_profiles",
    "user_financial_profiles",
    "consent_records",
    "admin_user_roles",
  ];

  for (const entry of values) {
    for (const table of tables) {
      const response = await fetch(
        `https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: `select count(*)::int as n from public.${table} where to_jsonb(${table})::text like '%${entry.value}%'`,
          }),
        },
      );
      if (!response.ok) {
        console.error(`Database check failed on ${table}.`);
        process.exitCode = 1;
        break;
      }
      const rows = await response.json();
      const count = rows[0]?.n ?? 0;
      if (count > 0) {
        dbLeaks += count;
        console.error(`LEAK ${entry.kind} in public.${table}: ${count} row(s)`);
      }
    }
  }
  console.log(`Database: ${tables.length} tables checked, ${dbLeaks} leak(s).`);
}

const total = treeLeaks + gitLeaks + dbLeaks;
console.log(total === 0 ? "\nIdentity-leak audit: CLEAN." : `\nIdentity-leak audit: ${total} leak(s).`);
process.exitCode = total > 0 ? 1 : 0;
