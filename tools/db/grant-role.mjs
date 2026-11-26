/**
 * Grant (or revoke) a staff role for an existing account.
 *
 * Usage:
 *   node tools/db/grant-role.mjs person@example.com super_admin
 *   node tools/db/grant-role.mjs person@example.com super_admin --revoke
 *
 * This is an operational tool, not an application endpoint: it runs SQL through
 * the Management API using .env.migrate.local. Every grant is still recorded by
 * the application's audit log when staff act, but the grant itself should be
 * performed by a named operator.
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

const [, , email, roleKey, ...flags] = process.argv;
const revoke = flags.includes("--revoke");

if (!TOKEN || !REF) {
  console.error("Missing SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_REF.");
  process.exit(1);
}
if (!email || !roleKey) {
  console.error("usage: node tools/db/grant-role.mjs <email> <role-key> [--revoke]");
  process.exit(1);
}
if (!/^[a-z][a-z0-9_]{2,40}$/.test(roleKey)) {
  console.error("Invalid role key.");
  process.exit(1);
}

const quotedEmail = email.replace(/'/g, "''");

const statement = revoke
  ? `delete from public.admin_user_roles ur
       using auth.users u, public.admin_roles r
      where ur.user_id = u.id and ur.role_id = r.id
        and lower(u.email) = lower('${quotedEmail}')
        and r.key = '${roleKey}'
      returning ur.user_id;`
  : `insert into public.admin_user_roles (user_id, role_id)
     select u.id, r.id
       from auth.users u
       join public.admin_roles r on r.key = '${roleKey}'
      where lower(u.email) = lower('${quotedEmail}')
     on conflict do nothing
     returning user_id;`;

const response = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: statement }),
});

if (!response.ok) {
  console.error("Failed:", (await response.text()).slice(0, 500));
  process.exit(1);
}

const rows = await response.json();
if (!Array.isArray(rows) || rows.length === 0) {
  console.error(
    revoke
      ? `No matching grant to revoke for ${email} / ${roleKey}.`
      : `No account found for ${email}, or the role is already granted (role: ${roleKey}).`,
  );
  process.exit(1);
}

console.log(`${revoke ? "Revoked" : "Granted"} ${roleKey} for ${email}.`);
