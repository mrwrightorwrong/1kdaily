/**
 * Deletes collateral evidence whose retention window has elapsed.
 *
 * Release starts a 90-day window (set by release_collateral). This tool removes
 * both the document row and the stored object. It is a dry run unless --apply is
 * passed.
 *
 * Usage:
 *   node tools/db/purge-collateral-documents.mjs            # report what is due
 *   node tools/db/purge-collateral-documents.mjs --apply     # delete
 */
import { existsSync, readFileSync } from "node:fs";

function loadEnv(file) {
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((line) => /^[A-Z0-9_]+=/.test(line))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim()]),
  );
}

const mig = loadEnv(".env.migrate.local");
const web = loadEnv("apps/web/.env.local");
const apply = process.argv.includes("--apply");

if (!mig.SUPABASE_ACCESS_TOKEN || !mig.SUPABASE_PROJECT_REF) {
  console.error("Missing SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_REF (.env.migrate.local).");
  process.exit(1);
}

async function sql(query) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${mig.SUPABASE_PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mig.SUPABASE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    },
  );
  const text = await response.text();
  if (!response.ok) throw new Error(text.slice(0, 500));
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const DUE_QUERY = `
  select count(*)::int as documents,
         count(distinct c.id)::int as records,
         min(c.documents_retain_until)::text as oldest
    from public.collateral_documents d
    join public.collateral_records c on c.id = d.collateral_id
   where c.release_status = 'released'
     and c.documents_retain_until is not null
     and c.documents_retain_until < current_date`;

if (!apply) {
  const [summary] = await sql(DUE_QUERY);
  console.log(
    `dry run: ${summary.documents} document(s) across ${summary.records} released record(s) are due` +
      (summary.oldest ? ` (oldest window ended ${summary.oldest})` : ""),
  );
  console.log("re-run with --apply to delete them.");
  process.exit(0);
}

if (!web.NEXT_PUBLIC_SUPABASE_URL || !web.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (apps/web/.env.local).");
  process.exit(1);
}

const purged = await sql("select document_id, storage_path from public.purge_released_collateral_documents(200)");
console.log(`deleted ${purged.length} document row(s).`);

let removed = 0;
let failed = 0;

for (const row of purged) {
  const response = await fetch(
    `${web.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/collateral/${row.storage_path}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${web.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: web.SUPABASE_SERVICE_ROLE_KEY,
      },
    },
  );

  if (response.ok || response.status === 404) {
    removed += 1;
  } else {
    failed += 1;
    console.error(`  object not removed (${response.status}): ${row.storage_path}`);
  }
}

console.log(`removed ${removed} stored object(s), ${failed} failure(s).`);
if (failed > 0) {
  console.error("Rows are gone but objects remain unreachable; re-run storage cleanup by path.");
  process.exitCode = 1;
}
