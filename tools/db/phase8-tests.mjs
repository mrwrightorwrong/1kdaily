/**
 * Phase 8 — guarantor consent and collateral lifecycle, against the real
 * database. Every case runs in a transaction that is rolled back, so fixtures
 * and grants never leak into the project.
 *
 * Run: node tools/db/phase8-tests.mjs
 */
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.migrate.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const TOKEN = env.SUPABASE_ACCESS_TOKEN;
const REF = env.SUPABASE_PROJECT_REF;

const claims = (id) => JSON.stringify({ sub: id, role: "authenticated", aud: "authenticated" });

const A = "11111111-1111-1111-1111-111111111111"; // alice — borrower
const B = "22222222-2222-2222-2222-222222222222"; // bola — other customer, invited guarantor
const VERIFIER = "33333333-3333-3333-3333-333333333333"; // granted risk_officer per test
const AUDITOR = "44444444-4444-4444-4444-444444444444"; // auditor; granted loan_officer per test
const APP = "dddddddd-0000-4000-8000-000000000001";

const results = [];

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await r.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = text;
  }
  return { ok: r.ok, rows: Array.isArray(payload) ? payload : [], error: r.ok ? null : text };
}

const row = (r) => r.rows[0] ?? {};
const check = (name, cond, detail = "") => {
  results.push(cond);
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : `\n      ${detail}`}`);
};

const setup = `
  insert into public.loan_applications
    (id, reference, user_id, product_id, requested_amount_kobo, tenor_months, status)
  select '${APP}', 'KD-C8-TEST-1', '${A}', id, 5000000, 6, 'submitted'
    from public.loan_products where code = 'standard'
  on conflict (id) do update
    set status = 'submitted', user_id = excluded.user_id, requested_amount_kobo = excluded.requested_amount_kobo;

  delete from public.collateral_records where application_id = '${APP}';
  delete from public.guarantors where application_id = '${APP}';
  delete from public.guarantor_invitations where application_id = '${APP}';

  insert into public.admin_user_roles (user_id, role_id)
  select '${VERIFIER}', id from public.admin_roles where key = 'risk_officer' on conflict do nothing;
  insert into public.admin_user_roles (user_id, role_id)
  select '${AUDITOR}', id from public.admin_roles where key = 'loan_officer' on conflict do nothing;
`;

const asUser = (id) => `
  set local role authenticated;
  select set_config('request.jwt.claims', '${claims(id)}', true);
`;

const COLLATERAL_OF_APP = `(select id from public.collateral_records where application_id = '${APP}' limit 1)`;
const OPEN_TOKEN = `(select token from public.guarantor_invitations where application_id = '${APP}' order by created_at desc limit 1)`;

// Invitations created by the borrower are not visible to the invitee under RLS
// until they act, so cases that must accept as the guarantor seed a known token.
const seedInvitation = (token, email = "bola.tests@1kdaily.test") => `
  insert into public.guarantor_invitations (application_id, borrower_id, email, token)
  values ('${APP}', '${A}', '${email}', '${token}');
`;

// ---------------------------------------------------------------------------

const submitted = await sql(`begin; ${setup}
  ${asUser(A)}
  select public.submit_collateral('${APP}', 'vehicle', 'Toyota Corolla 2015', 250000000,
    'Market valuation', current_date, 'Vehicle licence', 'SEC-2026-001') as id;
  reset role;
  select status, release_status, user_id, estimated_value_kobo
    from public.collateral_records where application_id = '${APP}';
  rollback;`);
check(
  "a borrower can submit collateral on their own application",
  submitted.ok && row(submitted).status === "submitted" && row(submitted).release_status === "held",
  submitted.error ?? JSON.stringify(row(submitted)),
);
check(
  "submitted collateral records the owner and the stated value",
  row(submitted).user_id === A && Number(row(submitted).estimated_value_kobo) === 250000000,
  JSON.stringify(row(submitted)),
);

const strangerSubmit = await sql(`begin; ${setup}
  ${asUser(B)}
  select public.submit_collateral('${APP}', 'vehicle', 'Someone else''s car', null, null, null, null, null);
  rollback;`);
check(
  "a stranger cannot add collateral to another customer's application",
  !strangerSubmit.ok && /P0002/.test(strangerSubmit.error ?? ""),
  strangerSubmit.error ?? "",
);

const badCategory = await sql(`begin; ${setup}
  ${asUser(A)}
  select public.submit_collateral('${APP}', 'jewellery', 'Gold chain', null, null, null, null, null);
  rollback;`);
check(
  "an unknown collateral category is refused",
  !badCategory.ok && /22023/.test(badCategory.error ?? ""),
  badCategory.error ?? "",
);

const zeroValue = await sql(`begin; ${setup}
  ${asUser(A)}
  select public.submit_collateral('${APP}', 'equipment', 'Generator', 0, null, null, null, null);
  rollback;`);
check(
  "a zero valuation is refused",
  !zeroValue.ok && /22023/.test(zeroValue.error ?? ""),
  zeroValue.error ?? "",
);

// ---------------------------------------------------------------------------

const documentAttached = await sql(`begin; ${setup}
  ${asUser(A)}
  select public.submit_collateral('${APP}', 'vehicle', 'Toyota Corolla 2015', null, null, null, null, null);
  select public.attach_collateral_document(${COLLATERAL_OF_APP}, 'Vehicle licence',
    'collateral/${A}/' || ${COLLATERAL_OF_APP}::text || '/licence.pdf');
  reset role;
  select count(*)::int as docs from public.collateral_documents
   where collateral_id = ${COLLATERAL_OF_APP} and status = 'pending';
  rollback;`);
check(
  "the owner can attach a document inside their own folder",
  documentAttached.ok && Number(row(documentAttached).docs) === 1,
  documentAttached.error ?? JSON.stringify(row(documentAttached)),
);

const documentElsewhere = await sql(`begin; ${setup}
  ${asUser(A)}
  select public.submit_collateral('${APP}', 'vehicle', 'Toyota Corolla 2015', null, null, null, null, null);
  select public.attach_collateral_document(${COLLATERAL_OF_APP}, 'Vehicle licence',
    'collateral/${B}/' || ${COLLATERAL_OF_APP}::text || '/stolen.pdf');
  rollback;`);
check(
  "a document path outside the borrower's folder is refused",
  !documentElsewhere.ok && /22023/.test(documentElsewhere.error ?? ""),
  documentElsewhere.error ?? "",
);

const documentTraversal = await sql(`begin; ${setup}
  ${asUser(A)}
  select public.submit_collateral('${APP}', 'vehicle', 'Toyota Corolla 2015', null, null, null, null, null);
  select public.attach_collateral_document(${COLLATERAL_OF_APP}, 'Vehicle licence',
    'collateral/${A}/' || ${COLLATERAL_OF_APP}::text || '/../other/secret.pdf');
  rollback;`);
check(
  "path traversal in a document path is refused",
  !documentTraversal.ok && /22023/.test(documentTraversal.error ?? ""),
  documentTraversal.error ?? "",
);

const strangerDocument = await sql(`begin; ${setup}
  ${asUser(A)}
  select public.submit_collateral('${APP}', 'vehicle', 'Toyota Corolla 2015', null, null, null, null, null);
  ${asUser(B)}
  select public.attach_collateral_document(${COLLATERAL_OF_APP}, 'Vehicle licence',
    'collateral/${A}/' || ${COLLATERAL_OF_APP}::text || '/licence.pdf');
  rollback;`);
check(
  "another customer cannot attach documents to that collateral",
  !strangerDocument.ok && /P0002/.test(strangerDocument.error ?? ""),
  strangerDocument.error ?? "",
);

// ---------------------------------------------------------------------------

const ownerReview = await sql(`begin; ${setup}
  ${asUser(A)}
  select public.submit_collateral('${APP}', 'vehicle', 'Toyota Corolla 2015', null, null, null, null, null);
  select public.review_collateral(${COLLATERAL_OF_APP}, 'verify', 'Looks fine to me');
  rollback;`);
check(
  "a borrower cannot verify their own collateral",
  !ownerReview.ok && /42501/.test(ownerReview.error ?? ""),
  ownerReview.error ?? "",
);

const verified = await sql(`begin; ${setup}
  ${asUser(A)}
  select public.submit_collateral('${APP}', 'vehicle', 'Toyota Corolla 2015', null, null, null, null, null);
  ${asUser(VERIFIER)}
  select public.review_collateral(${COLLATERAL_OF_APP}, 'verify', 'Valuation report matches the market');
  reset role;
  select status, reviewed_by, (reviewed_at is not null) as reviewed
    from public.collateral_records where application_id = '${APP}';
  rollback;`);
check(
  "a risk officer can verify collateral and is recorded as reviewer",
  verified.ok && row(verified).status === "verified" && row(verified).reviewed_by === VERIFIER &&
    row(verified).reviewed === true,
  verified.error ?? JSON.stringify(row(verified)),
);

const releaseBeforeClose = await sql(`begin; ${setup}
  ${asUser(A)}
  select public.submit_collateral('${APP}', 'vehicle', 'Toyota Corolla 2015', null, null, null, null, null);
  ${asUser(VERIFIER)}
  select public.review_collateral(${COLLATERAL_OF_APP}, 'verify', 'Valuation report matches the market');
  select public.release_collateral(${COLLATERAL_OF_APP}, 'Customer asked for the car back');
  rollback;`);
check(
  "collateral cannot be released while the loan is open",
  !releaseBeforeClose.ok && /22023/.test(releaseBeforeClose.error ?? "") &&
    /closed/.test(releaseBeforeClose.error ?? ""),
  releaseBeforeClose.error ?? "",
);

const releaseAfterClose = await sql(`begin; ${setup}
  ${asUser(A)}
  select public.submit_collateral('${APP}', 'vehicle', 'Toyota Corolla 2015', null, null, null, null, null);
  ${asUser(VERIFIER)}
  select public.review_collateral(${COLLATERAL_OF_APP}, 'verify', 'Valuation report matches the market');
  reset role;
  update public.loan_applications set status = 'closed' where id = '${APP}';
  ${asUser(VERIFIER)}
  select public.release_collateral(${COLLATERAL_OF_APP}, 'Loan settled in full; title returned');
  reset role;
  select status, release_status from public.collateral_records where application_id = '${APP}';
  rollback;`);
check(
  "verified collateral is released once the loan is closed",
  releaseAfterClose.ok && row(releaseAfterClose).status === "released" &&
    row(releaseAfterClose).release_status === "released",
  releaseAfterClose.error ?? JSON.stringify(row(releaseAfterClose)),
);

const reviewAfterRelease = await sql(`begin; ${setup}
  ${asUser(A)}
  select public.submit_collateral('${APP}', 'vehicle', 'Toyota Corolla 2015', null, null, null, null, null);
  ${asUser(VERIFIER)}
  select public.review_collateral(${COLLATERAL_OF_APP}, 'verify', 'Valuation report matches the market');
  reset role;
  update public.loan_applications set status = 'closed' where id = '${APP}';
  ${asUser(VERIFIER)}
  select public.release_collateral(${COLLATERAL_OF_APP}, 'Loan settled in full; title returned');
  select public.review_collateral(${COLLATERAL_OF_APP}, 'reject', 'Changed my mind about this asset');
  rollback;`);
check(
  "released collateral cannot be reviewed again",
  !reviewAfterRelease.ok && /22023/.test(reviewAfterRelease.error ?? ""),
  reviewAfterRelease.error ?? "",
);

const releaseUnverified = await sql(`begin; ${setup}
  ${asUser(A)}
  select public.submit_collateral('${APP}', 'vehicle', 'Toyota Corolla 2015', null, null, null, null, null);
  reset role;
  update public.loan_applications set status = 'closed' where id = '${APP}';
  ${asUser(VERIFIER)}
  select public.release_collateral(${COLLATERAL_OF_APP}, null);
  rollback;`);
check(
  "unverified collateral cannot be released",
  !releaseUnverified.ok && /22023/.test(releaseUnverified.error ?? ""),
  releaseUnverified.error ?? "",
);

// ---------------------------------------------------------------------------

const ownerIsolation = await sql(`begin; ${setup}
  ${asUser(A)}
  select public.submit_collateral('${APP}', 'vehicle', 'Toyota Corolla 2015', null, null, null, null, null);
  ${asUser(B)}
  select count(*)::int as visible from public.collateral_records;
  rollback;`);
check(
  "another customer sees none of the borrower's collateral",
  ownerIsolation.ok && Number(row(ownerIsolation).visible) === 0,
  ownerIsolation.error ?? JSON.stringify(row(ownerIsolation)),
);

const staffRead = await sql(`begin; ${setup}
  ${asUser(A)}
  select public.submit_collateral('${APP}', 'vehicle', 'Toyota Corolla 2015', null, null, null, null, null);
  ${asUser(AUDITOR)}
  select count(*)::int as visible from public.collateral_records;
  rollback;`);
check(
  "staff with loans:read can see collateral for review",
  staffRead.ok && Number(row(staffRead).visible) === 1,
  staffRead.error ?? JSON.stringify(row(staffRead)),
);

// ---------------------------------------------------------------------------
// Guarantors
// ---------------------------------------------------------------------------

const selfInvite = await sql(`begin; ${setup}
  ${asUser(A)}
  select public.invite_guarantor('${APP}', 'alice.tests@1kdaily.test');
  rollback;`);
check(
  "a borrower cannot guarantee their own loan",
  !selfInvite.ok && /22023/.test(selfInvite.error ?? ""),
  selfInvite.error ?? "",
);

const wrongEmail = await sql(`begin; ${setup}
  ${asUser(A)}
  select public.invite_guarantor('${APP}', 'bola.tests@1kdaily.test');
  ${asUser(A)}
  select public.accept_guarantor_invitation(${OPEN_TOKEN}, 'Alice Nwosu', 'friend');
  rollback;`);
check(
  "the invitation can only be accepted by the invited address",
  !wrongEmail.ok && /42501/.test(wrongEmail.error ?? ""),
  wrongEmail.error ?? "",
);

const accepted = await sql(`begin; ${setup}
  ${seedInvitation("tok-accepted")}
  ${asUser(B)}
  select public.accept_guarantor_invitation('tok-accepted', 'Bola Adeyemi', 'colleague');
  reset role;
  select g.status, g.guarantee_amount_kobo, (g.consented_at is not null) as consented,
         (select status from public.guarantor_invitations where application_id = '${APP}' limit 1) as invitation
    from public.guarantors g where g.application_id = '${APP}';
  rollback;`);
check(
  "accepting records consent, the guarantee amount and consumes the invitation",
  accepted.ok && row(accepted).status === "accepted" && row(accepted).consented === true &&
    row(accepted).invitation === "accepted" && Number(row(accepted).guarantee_amount_kobo) === 5000000,
  accepted.error ?? JSON.stringify(row(accepted)),
);

const tokenReuse = await sql(`begin; ${setup}
  ${seedInvitation("tok-reuse")}
  ${asUser(B)}
  select public.accept_guarantor_invitation('tok-reuse', 'Bola Adeyemi', 'colleague');
  select public.accept_guarantor_invitation('tok-reuse', 'Bola Adeyemi', 'colleague');
  rollback;`);
check(
  "a guarantor token cannot be used twice",
  !tokenReuse.ok && /22023/.test(tokenReuse.error ?? ""),
  tokenReuse.error ?? "",
);

const expired = await sql(`begin; ${setup}
  insert into public.guarantor_invitations (application_id, borrower_id, email, token, expires_at)
  values ('${APP}', '${A}', 'bola.tests@1kdaily.test', 'expiredtoken0001', now() - interval '1 hour');
  ${asUser(B)}
  select public.accept_guarantor_invitation('expiredtoken0001', 'Bola Adeyemi', null);
  rollback;`);
check(
  "an expired guarantor invitation is refused",
  !expired.ok && /22023/.test(expired.error ?? "") && /expired/i.test(expired.error ?? ""),
  expired.error ?? "",
);

const declined = await sql(`begin; ${setup}
  ${seedInvitation("tok-declined")}
  ${asUser(B)}
  select public.decline_guarantor_invitation('tok-declined');
  reset role;
  select (select status from public.guarantor_invitations where application_id = '${APP}' limit 1) as invitation,
         (select count(*)::int from public.guarantors where application_id = '${APP}') as guarantors;
  rollback;`);
check(
  "declining consumes the invitation and creates no guarantor",
  declined.ok && row(declined).invitation === "declined" && Number(row(declined).guarantors) === 0,
  declined.error ?? JSON.stringify(row(declined)),
);

const consentConstraint = await sql(`begin; ${setup}
  insert into public.guarantors
    (application_id, full_name, email, guarantee_amount_kobo, status, terms_version)
  values ('${APP}', 'Silent Guarantor', 'silent@example.com', 100000, 'verified', '2026-11');
  rollback;`);
check(
  "the database refuses a guarantor marked verified without consent",
  !consentConstraint.ok && /23514/.test(consentConstraint.error ?? ""),
  consentConstraint.error ?? "",
);

const verifyWithoutConsent = await sql(`begin; ${setup}
  insert into public.guarantors
    (application_id, full_name, email, guarantee_amount_kobo, status)
  values ('${APP}', 'Invited Guarantor', 'invited@example.com', 100000, 'invited');
  ${asUser(AUDITOR)}
  select public.verify_guarantor(
    (select id from public.guarantors where application_id = '${APP}' limit 1), 'verify', null);
  rollback;`);
check(
  "staff cannot verify a guarantor who has not consented",
  !verifyWithoutConsent.ok && /22023/.test(verifyWithoutConsent.error ?? ""),
  verifyWithoutConsent.error ?? "",
);

const verifiedGuarantor = await sql(`begin; ${setup}
  ${seedInvitation("tok-verified")}
  ${asUser(B)}
  select public.accept_guarantor_invitation('tok-verified', 'Bola Adeyemi', 'colleague');
  ${asUser(AUDITOR)}
  select public.verify_guarantor(
    (select id from public.guarantors where application_id = '${APP}' limit 1), 'verify', 'Income confirmed');
  reset role;
  select status, (verified_at is not null) as verified
    from public.guarantors where application_id = '${APP}';
  rollback;`);
check(
  "a consented guarantor can be verified",
  verifiedGuarantor.ok && row(verifiedGuarantor).status === "verified" && row(verifiedGuarantor).verified === true,
  verifiedGuarantor.error ?? JSON.stringify(row(verifiedGuarantor)),
);

const guarantorRelease = await sql(`begin; ${setup}
  ${seedInvitation("tok-release-open")}
  ${asUser(B)}
  select public.accept_guarantor_invitation('tok-release-open', 'Bola Adeyemi', 'colleague');
  ${asUser(AUDITOR)}
  select public.verify_guarantor(
    (select id from public.guarantors where application_id = '${APP}' limit 1), 'verify', 'Income confirmed');
  select public.release_guarantor(
    (select id from public.guarantors where application_id = '${APP}' limit 1), null);
  rollback;`);
check(
  "a guarantor cannot be released while the loan is open",
  !guarantorRelease.ok && /22023/.test(guarantorRelease.error ?? ""),
  guarantorRelease.error ?? "",
);

const guarantorReleasedAfterClose = await sql(`begin; ${setup}
  ${seedInvitation("tok-release-closed")}
  ${asUser(B)}
  select public.accept_guarantor_invitation('tok-release-closed', 'Bola Adeyemi', 'colleague');
  ${asUser(AUDITOR)}
  select public.verify_guarantor(
    (select id from public.guarantors where application_id = '${APP}' limit 1), 'verify', 'Income confirmed');
  reset role;
  update public.loan_applications set status = 'closed' where id = '${APP}';
  ${asUser(AUDITOR)}
  select public.release_guarantor(
    (select id from public.guarantors where application_id = '${APP}' limit 1), 'Loan settled in full');
  reset role;
  select status from public.guarantors where application_id = '${APP}';
  rollback;`);
check(
  "a guarantor is released after the loan closes",
  guarantorReleasedAfterClose.ok && row(guarantorReleasedAfterClose).status === "released",
  guarantorReleasedAfterClose.error ?? JSON.stringify(row(guarantorReleasedAfterClose)),
);

const auditTrail = await sql(`begin; ${setup}
  ${asUser(A)}
  select public.submit_collateral('${APP}', 'vehicle', 'Toyota Corolla 2015', null, null, null, null, null);
  ${asUser(VERIFIER)}
  select public.review_collateral(${COLLATERAL_OF_APP}, 'verify', 'Valuation report matches the market');
  reset role;
  select count(*)::int as events from public.audit_logs
   where entity_id in ((select id::text from public.collateral_records where application_id = '${APP}'))
     and action in ('collateral.submitted', 'collateral.verify');
  rollback;`);
check(
  "submission and verification are both audited",
  auditTrail.ok && Number(row(auditTrail).events) === 2,
  auditTrail.error ?? JSON.stringify(row(auditTrail)),
);

// ---------------------------------------------------------------------------
// Notifications, email state and retention
// ---------------------------------------------------------------------------

const acceptedNotifies = await sql(`begin; ${setup}
  ${seedInvitation("tok-notify")}
  ${asUser(B)}
  select public.accept_guarantor_invitation('tok-notify', 'Bola Adeyemi', 'colleague');
  reset role;
  select count(*)::int as notices from public.notifications
   where user_id = '${A}' and kind = 'guarantor.accepted';
  rollback;`);
check(
  "accepting a guarantee notifies the borrower",
  acceptedNotifies.ok && Number(row(acceptedNotifies).notices) === 1,
  acceptedNotifies.error ?? JSON.stringify(row(acceptedNotifies)),
);

const declinedNotifies = await sql(`begin; ${setup}
  ${seedInvitation("tok-notify-decline")}
  ${asUser(B)}
  select public.decline_guarantor_invitation('tok-notify-decline');
  reset role;
  select count(*)::int as notices from public.notifications
   where user_id = '${A}' and kind = 'guarantor.declined';
  rollback;`);
check(
  "declining a guarantee notifies the borrower",
  declinedNotifies.ok && Number(row(declinedNotifies).notices) === 1,
  declinedNotifies.error ?? JSON.stringify(row(declinedNotifies)),
);

const collateralNotifies = await sql(`begin; ${setup}
  ${asUser(A)}
  select public.submit_collateral('${APP}', 'vehicle', 'Toyota Corolla 2015', null, null, null, null, null);
  ${asUser(VERIFIER)}
  select public.review_collateral(${COLLATERAL_OF_APP}, 'verify', 'Valuation report matches the market');
  reset role;
  select count(*)::int as notices from public.notifications
   where user_id = '${A}' and kind = 'collateral.verified';
  rollback;`);
check(
  "verifying collateral notifies its owner",
  collateralNotifies.ok && Number(row(collateralNotifies).notices) === 1,
  collateralNotifies.error ?? JSON.stringify(row(collateralNotifies)),
);

const notificationIsolation = await sql(`begin; ${setup}
  ${seedInvitation("tok-isolation")}
  ${asUser(B)}
  select public.accept_guarantor_invitation('tok-isolation', 'Bola Adeyemi', null);
  ${asUser(B)}
  select count(*)::int as visible from public.notifications;
  rollback;`);
check(
  "a customer cannot read another customer's notifications",
  notificationIsolation.ok && Number(row(notificationIsolation).visible) === 0,
  notificationIsolation.error ?? JSON.stringify(row(notificationIsolation)),
);

const markRead = await sql(`begin; ${setup}
  ${seedInvitation("tok-read")}
  ${asUser(B)}
  select public.accept_guarantor_invitation('tok-read', 'Bola Adeyemi', null);
  ${asUser(A)}
  create temp table _read_result on commit drop as
    select public.mark_notifications_read() as marked;

  select (select marked from _read_result) as marked,
         (select count(*) filter (where read_at is not null)::int
            from public.notifications where user_id = '${A}') as read_count;
  rollback;`);
check(
  "marking notifications read only affects the caller's own rows",
  markRead.ok && Number(row(markRead).marked) === 1 && Number(row(markRead).read_count) === 1,
  markRead.error ?? JSON.stringify(row(markRead)),
);

const emailStatus = await sql(`begin; ${setup}
  ${seedInvitation("tok-email")}
  select email_status from public.guarantor_invitations where token = 'tok-email';
  rollback;`);
check(
  "an invitation starts with a queued email",
  emailStatus.ok && row(emailStatus).email_status === "queued",
  emailStatus.error ?? JSON.stringify(row(emailStatus)),
);

const emailStatusGuard = await sql(`begin; ${setup}
  ${seedInvitation("tok-email-guard")}
  ${asUser(A)}
  select public.mark_guarantor_invitation_email('tok-email-guard', 'sent', null);
  rollback;`);
check(
  "a client cannot claim an invitation email was sent",
  !emailStatusGuard.ok && /42501/.test(emailStatusGuard.error ?? ""),
  emailStatusGuard.error ?? "",
);

const emailStatusMarked = await sql(`begin; ${setup}
  ${seedInvitation("tok-email-ok")}
  select public.mark_guarantor_invitation_email('tok-email-ok', 'sent', null);
  select email_status, (email_sent_at is not null) as sent
    from public.guarantor_invitations where token = 'tok-email-ok';
  rollback;`);
check(
  "the service role can record a delivered invitation email",
  emailStatusMarked.ok && row(emailStatusMarked).email_status === "sent" &&
    row(emailStatusMarked).sent === true,
  emailStatusMarked.error ?? JSON.stringify(row(emailStatusMarked)),
);

const retentionWindow = await sql(`begin; ${setup}
  ${asUser(A)}
  select public.submit_collateral('${APP}', 'vehicle', 'Toyota Corolla 2015', null, null, null, null, null);
  ${asUser(VERIFIER)}
  select public.review_collateral(${COLLATERAL_OF_APP}, 'verify', 'Valuation report matches the market');
  reset role;
  update public.loan_applications set status = 'closed' where id = '${APP}';
  ${asUser(VERIFIER)}
  select public.release_collateral(${COLLATERAL_OF_APP}, 'Loan settled in full; title returned');
  reset role;
  select documents_retain_until = current_date + 90 as retained_for_ninety_days
    from public.collateral_records where application_id = '${APP}';
  rollback;`);
check(
  "release starts a 90-day document retention window",
  retentionWindow.ok && row(retentionWindow).retained_for_ninety_days === true,
  retentionWindow.error ?? JSON.stringify(row(retentionWindow)),
);

const purgeGuard = await sql(`begin; ${setup}
  ${asUser(A)}
  select * from public.purge_released_collateral_documents(10);
  rollback;`);
check(
  "a customer cannot run the retention purge",
  !purgeGuard.ok && /42501/.test(purgeGuard.error ?? ""),
  purgeGuard.error ?? "",
);

const purge = await sql(`begin; ${setup}
  ${asUser(A)}
  select public.submit_collateral('${APP}', 'vehicle', 'Toyota Corolla 2015', null, null, null, null, null);
  ${asUser(VERIFIER)}
  select public.review_collateral(${COLLATERAL_OF_APP}, 'verify', 'Valuation report matches the market');
  reset role;
  update public.loan_applications set status = 'closed' where id = '${APP}';
  ${asUser(VERIFIER)}
  select public.release_collateral(${COLLATERAL_OF_APP}, 'Loan settled in full; title returned');
  reset role;

  update public.collateral_records set documents_retain_until = current_date - 1
   where application_id = '${APP}';
  insert into public.collateral_documents (collateral_id, document_type, storage_path)
  select id, 'Vehicle licence', 'collateral/${A}/' || id::text || '/due.pdf'
    from public.collateral_records where application_id = '${APP}';

  insert into public.collateral_records (application_id, user_id, category, description)
  values ('${APP}', '${A}', 'other', 'Still-held asset');
  insert into public.collateral_documents (collateral_id, document_type, storage_path)
  select id, 'Receipt', 'collateral/${A}/' || id::text || '/kept.pdf'
    from public.collateral_records where description = 'Still-held asset';

  create temp table _purge_result on commit drop as
    select count(*)::int as purged from public.purge_released_collateral_documents(10);

  select (select purged from _purge_result) as purged,
         (select count(*)::int
            from public.collateral_documents d
            join public.collateral_records c on c.id = d.collateral_id
           where c.application_id = '${APP}') as remaining;
  rollback;`);
check(
  "retention purge deletes only evidence whose window elapsed",
  purge.ok && Number(row(purge).purged) === 1,
  purge.error ?? JSON.stringify(row(purge)),
);
check(
  "a still-held asset keeps its evidence",
  purge.ok && Number(row(purge).remaining) === 1,
  purge.error ?? JSON.stringify(row(purge)),
);

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed.`);
process.exitCode = passed === results.length ? 0 : 1;
