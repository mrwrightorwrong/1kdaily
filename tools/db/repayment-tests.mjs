import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.migrate.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const REF = env.SUPABASE_PROJECT_REF;
const claims = (id) => JSON.stringify({ sub: id, role: "authenticated", aud: "authenticated" });
const A = "11111111-1111-1111-1111-111111111111";
const APPROVER = "44444444-4444-4444-4444-444444444444";
const DISBURSER = "33333333-3333-3333-3333-333333333333";
const APP = "dddddddd-0000-4000-8000-000000000001";
let pass = 0;
let fail = 0;
const check = (name, cond, detail = "") => {
  if (cond) { pass++; console.log(`PASS  ${name}`); } else { fail++; console.log(`FAIL  ${name} ${detail}`); }
};

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await r.text();
  let p; try { p = JSON.parse(text); } catch { p = text; }
  return { ok: r.ok, rows: Array.isArray(p) ? p : [], error: r.ok ? null : text };
}

const setup = `
  delete from public.loan_repayments where application_id = '${APP}';
  delete from public.loan_repayment_schedules where application_id = '${APP}';
  insert into public.loan_applications (id, reference, user_id, product_id, requested_amount_kobo, tenor_months, status)
  select '${APP}', 'KD-LN-RP', '${A}', id, 2000000, 2, 'submitted' from public.loan_products where code='standard'
  on conflict (id) do update set status='submitted', disbursed_at=null, disbursement_transaction_id=null;
  insert into public.loan_offers
    (application_id, user_id, product_snapshot, policy_version, principal_kobo, tenor_months, interest_rate_bps,
     interest_method, processing_fee_kobo, insurance_fee_kobo, net_disbursed_kobo, interest_kobo,
     total_payable_kobo, installment_kobo, schedule, expires_at)
  values ('${APP}', '${A}', '{}'::jsonb, '2026-11', 2000000, 2, 2400, 'declining_balance', 20000, 10000, 1970000,
          200000, 2200000, 1100000,
          '[{"number":1,"principal":"1000000","interest":"100000","total":"1100000","outstanding":"1000000"},
            {"number":2,"principal":"1000000","interest":"100000","total":"1100000","outstanding":"0"}]'::jsonb,
          now() + interval '7 days')
  on conflict (application_id) do update set accepted_at=null, schedule=excluded.schedule, expires_at=excluded.expires_at;
  insert into public.admin_user_roles (user_id, role_id)
    select '${APPROVER}', id from public.admin_roles where key='loan_officer' on conflict do nothing;
  insert into public.admin_user_roles (user_id, role_id)
    select '${DISBURSER}', id from public.admin_roles where key='finance_admin' on conflict do nothing;
`;

const run = await sql(`begin; ${setup}
  set local role authenticated;
  select set_config('request.jwt.claims', '${claims(APPROVER)}', true);
  select public.decide_loan_application('${APP}', 'approve', 'Affordability verified for repayment test');
  reset role;
  set local role authenticated;
  select set_config('request.jwt.claims', '${claims(DISBURSER)}', true);
  select public.disburse_loan('${APP}', 'TRF-RP');
  reset role;

  select public.record_repayment('${APP}', 550000, 'RP-1');
  create temp table snap on commit drop as
    select status, paid_kobo from public.loan_repayment_schedules where application_id='${APP}' and installment_number=1;

  select public.record_repayment('${APP}', 1650000, 'RP-2');
  select public.record_repayment('${APP}', 1650000, 'RP-2'); -- replay
  set constraints all immediate;
  select
    (select status from snap) as first_status,
    (select paid_kobo from snap) as first_paid,
    (select count(*)::int from public.loan_repayment_schedules where application_id='${APP}' and status<>'paid') as open_rows,
    (select count(*)::int from public.loan_repayments where application_id='${APP}') as repayments,
    (select status from public.loan_applications where id='${APP}') as app_status,
    (select count(*)::int from public.ledger_entries e where e.transaction_id =
       (select ledger_transaction_id from public.loan_repayments where provider_reference='RP-2')) as entries,
    (select sum(case when direction='debit' then amount_kobo else -amount_kobo end) from public.ledger_entries e
      where e.transaction_id = (select ledger_transaction_id from public.loan_repayments where provider_reference='RP-1')) as rp1_balance,
    (select sum(case when direction='debit' then amount_kobo else -amount_kobo end) from public.ledger_entries e
      where e.transaction_id = (select ledger_transaction_id from public.loan_repayments where provider_reference='RP-2')) as rp2_balance;
  rollback;`);

const row = run.rows[0] ?? {};
check("repayment run succeeded", run.ok, run.error ?? "");
check("partial payment marks the installment partially paid", row.first_status === "partially_paid", String(row.first_status));
check("partial payment records the amount", Number(row.first_paid) === 550000, String(row.first_paid));
check("final payment settles every installment", Number(row.open_rows) === 0, String(row.open_rows));
check("loan closes when fully repaid", row.app_status === "closed", String(row.app_status));
check("replayed reference does not duplicate", Number(row.repayments) === 2, String(row.repayments));
check("repayment posts three balanced entries", Number(row.entries) === 3, String(row.entries));
check("first repayment balances", Number(row.rp1_balance) === 0, String(row.rp1_balance));
check("second repayment balances", Number(row.rp2_balance) === 0, String(row.rp2_balance));

const over = await sql(`begin; ${setup}
  set local role authenticated;
  select set_config('request.jwt.claims', '${claims(APPROVER)}', true);
  select public.decide_loan_application('${APP}', 'approve', 'Affordability verified for repayment test');
  reset role;
  set local role authenticated;
  select set_config('request.jwt.claims', '${claims(DISBURSER)}', true);
  select public.disburse_loan('${APP}', 'TRF-RP2');
  reset role;
  select public.record_repayment('${APP}', 5000000, 'RP-OVER');
  rollback;`);
check("overpayment is rejected", !over.ok && /exceeds/.test(over.error ?? ""), over.error ?? "");

console.log(`\n${pass}/${pass + fail} passed.`);
process.exitCode = fail ? 1 : 0;
