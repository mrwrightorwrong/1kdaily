import { existsSync, readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.migrate.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const TOKEN = env.SUPABASE_ACCESS_TOKEN;
const REF = env.SUPABASE_PROJECT_REF;
const claims = (id) => JSON.stringify({ sub: id, role: "authenticated", aud: "authenticated" });
const A = "11111111-1111-1111-1111-111111111111";
const APPROVER = "44444444-4444-4444-4444-444444444444"; // auditor, granted loan_officer here
const DISBURSER = "33333333-3333-3333-3333-333333333333"; // verifier, granted finance_admin here
const results = [];

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await r.text();
  let p;
  try { p = JSON.parse(text); } catch { p = text; }
  return { ok: r.ok, rows: Array.isArray(p) ? p : [], error: r.ok ? null : text };
}
const row = (r) => r.rows[0] ?? {};
const check = (name, cond, detail = "") => {
  results.push(cond);
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : `\n      ${detail}`}`);
};

const setup = `
  insert into public.loan_applications
    (id, reference, user_id, product_id, requested_amount_kobo, tenor_months, status)
  select 'cccccccc-0000-4000-8000-000000000001', 'KD-LN-TEST-1', '${A}', id,
         10000000, 12, 'submitted'
    from public.loan_products where code = 'standard'
  on conflict (id) do update set status = 'submitted', disbursed_at = null;

  insert into public.loan_offers
    (application_id, user_id, product_snapshot, policy_version, principal_kobo, tenor_months,
     interest_rate_bps, interest_method, processing_fee_kobo, insurance_fee_kobo,
     net_disbursed_kobo, interest_kobo, total_payable_kobo, installment_kobo, schedule, expires_at)
  values
    ('cccccccc-0000-4000-8000-000000000001', '${A}', '{}'::jsonb, '2026-11',
     10000000, 12, 2400, 'declining_balance', 150000, 100000,
     9750000, 1200000, 11200000, 933333,
     (select jsonb_agg(jsonb_build_object(
        'number', n, 'principal', (10000000/12)::text,
        'interest', (100000)::text, 'total', ((10000000/12)+100000)::text,
        'outstanding', '0')) from generate_series(1, 12) n),
     now() + interval '7 days')
  on conflict (application_id) do update set accepted_at = null, expires_at = excluded.expires_at;

  insert into public.admin_user_roles (user_id, role_id)
  select '${APPROVER}', id from public.admin_roles where key = 'loan_officer' on conflict do nothing;
  insert into public.admin_user_roles (user_id, role_id)
  select '${DISBURSER}', id from public.admin_roles where key = 'finance_admin' on conflict do nothing;
`;

const unauthorised = await sql(`begin; ${setup}
  set local role authenticated;
  select set_config('request.jwt.claims', '${claims(A)}', true);
  select public.decide_loan_application('cccccccc-0000-4000-8000-000000000001', 'approve', 'Customer requested approval');
  rollback;`);
check("a customer cannot approve their own loan", !unauthorised.ok && /42501/.test(unauthorised.error ?? ""), unauthorised.error ?? "");

const sod = await sql(`begin; ${setup}
  set local role authenticated;
  select set_config('request.jwt.claims', '${claims(APPROVER)}', true);
  select public.decide_loan_application('cccccccc-0000-4000-8000-000000000001', 'approve', 'Affordability and savings verified');
  select public.disburse_loan('cccccccc-0000-4000-8000-000000000001', 'TRF-sod');
  rollback;`);
check("the approver cannot also disburse", !sod.ok && /42501/.test(sod.error ?? ""), sod.error ?? "");

const disbursed = await sql(`begin; ${setup}
  set local role authenticated;
  select set_config('request.jwt.claims', '${claims(APPROVER)}', true);
  select public.decide_loan_application('cccccccc-0000-4000-8000-000000000001', 'approve', 'Affordability and savings verified');
  reset role;
  set local role authenticated;
  select set_config('request.jwt.claims', '${claims(DISBURSER)}', true);
  select public.disburse_loan('cccccccc-0000-4000-8000-000000000001', 'TRF-ok');
  set constraints all immediate;
  reset role;
  select
    (select status from public.loan_applications where id = 'cccccccc-0000-4000-8000-000000000001') as status,
    (select count(*)::int from public.ledger_entries e
      where e.transaction_id = (select disbursement_transaction_id from public.loan_applications
                                 where id = 'cccccccc-0000-4000-8000-000000000001')) as entries,
    (select count(*)::int from public.loan_repayment_schedules
      where application_id = 'cccccccc-0000-4000-8000-000000000001') as installments,
    (select sum(total_kobo) from public.loan_repayment_schedules
      where application_id = 'cccccccc-0000-4000-8000-000000000001') as scheduled_total;
  rollback;`);
check("finance can disburse", disbursed.ok && row(disbursed).status === "disbursed", disbursed.error ?? "");
check("disbursement posts a balanced four-entry transaction", Number(row(disbursed).entries) === 4, String(row(disbursed).entries));
check("the frozen schedule is materialised", Number(row(disbursed).installments) === 12, String(row(disbursed).installments));

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed.`);
process.exitCode = passed === results.length ? 0 : 1;
