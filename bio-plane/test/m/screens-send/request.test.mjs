/* screens-send R4, R8, R11, R20, R21, R29, R39, R46, R57 and R3's join-first rule on `request`: a records request in the flow's order
 * (the name it concerns, the office, what is wanted, the law, the text, its approval, recording the sending), the office a member names
 * herself, the matter's stake at preparation and the door to the composer for any other kind. Each sentence is asserted by its key. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { open, text, ops, drew, last, press, button, beside, main, day, ok, refused, refusedIn, MEMBER, ACT, FILINGS, DRAFT, PREPARED, PROJECT, word, norm } from "./kit.mjs";

const AID = "ACTN-2026-bbbbbbbbbbbbbbbb";
const FILING = "FIL-2026-0101";
const NEW = "/app/request/" + PROJECT;
const AT = "/app/request/" + AID;
const ADMIN = Object.freeze({ ...MEMBER, administer: true });
const SUBJECT = "ENT-2026-2222222222222222";
const BODY = "ENT-2026-3333333333333333";
const NAMED_OFFICE = "ENT-2026-4444444444444444";
/** `peopledirectory`'s rows: an organisation, an office and a body the record follows. */
const NAMES = { rows: [{ entity: "ENT-2026-1111111111111111", kind: "organisation", name: "Public Works" }, { entity: SUBJECT, kind: "office", name: "Pothole repair program" },
  { entity: BODY, kind: "body", name: "City of Port Ellery" }], truncated: false };
const OFFICES = { ok: true, subject: SUBJECT, offices: [
  { addressee: { state: "named", kind: "office", role: "City Clerk", body: "Office of the City Clerk", entity_id: "ENT-1" } },
  { addressee: { state: "named", kind: "office", role: "Director of Public Works", body: "Public Works", entity_id: "ENT-2" } }], undetermined: [], suggestion: true };
const NO_OFFICES = { ok: true, subject: SUBJECT, offices: [], undetermined: [], suggestion: true };
const FED = "5 U.S.C. § 552";
/** `profiles` with its view: the deadlines and the records laws (`jurisdictions` R7, R96), each law naming its own first-request window. */
const PROFILES = { profiles: [{ id: "p", name: "p", covers: [] }], conflicts: [], choices: [], stage_findings: [], view: {
  deadlines: [
    { rule: "records_response", applies_to: "records_request", units: "days", amount: 10, count: "calendar", citation: "Gov. Code § 7922.535(b)" },
    { rule: "immediate_disclosure", applies_to: "records_request", units: "days", amount: 3, count: "business", citation: "Mun. Code § 2.20.230" },
    { rule: "foia_response", applies_to: "records_request", units: "days", amount: 20, count: "business", citation: "5 U.S.C. § 552(a)(6)(A)(i)" },
    { rule: "foia_appeal_response", applies_to: "records_request", units: "days", amount: 20, count: "business", citation: "5 U.S.C. § 552(a)(6)(A)(ii)" },
    { rule: "meeting_notice", applies_to: "comment", amount: 72, count: "calendar", citation: "Open meetings law" }],
  records_laws: [
    { level: "state", name: "Testland Records Act", citation: "Gov. Code § 7922.535(b)", response: "records_response" },
    { level: "city", name: "Testville Sunshine Ordinance", citation: "Mun. Code § 2.20.230", response: "immediate_disclosure" },
    { level: "federal", name: "Freedom of Information Act", citation: FED, response: "foia_response" }] } };
/** actions' `action` answer for a records request in `PROJECT`, addressed to the Town Clerk's office. */
const REQ = (o = {}) => ACT({ id: AID, kind: "records_request", project: PROJECT,
  addressee: { role: "Town Clerk", body: "Town of Port Ellery", entity_id: "ENT-1", filled: "stated", holder_on_date: { holder: "Asha Rao", on: "2026-10-14" } },
  governing_laws: { state: "stated", laws: [{ level: "state", citation: "Gov. Code § 7922.535(b)" }], by: "member:mai", at: "2026-10-01T09:00:00Z" }, ...o });
const STAKE = (o = {}) => ({ ok: true, action: AID, higher_stakes: false, governing_tier: 1, group_stake: "We hold the city to its own rules.",
  matter_stake: { stake: "Two members live in buildings on the slow-repair list.", set_by: "mai", set_at: "2026-10-09T09:00:00Z", source: "project" }, ...o });
const APPROVAL = { approved_by: "member:mai", at: "2026-11-02T11:00:00Z", sha: "s" };
const TEMPLATES = { ok: true, action: AID, kind: "records_request", governing: { tier: 2 },
  versions: [{ template: "TPL-1", name: "Records request", origin: "group", state: "approved", approved_at: "2026-09-30T10:00:00Z", approved_by: "member:mai" }], not_offered: [], court_petition: false };

/** The plane behind a new request (the names asked about, the offices for the one picked). */
const fresh = (o = {}) => ({ peopledirectory: ok(NAMES), entitieskind: ok({ ok: true, entities: [], count: 0 }), profiles: ok(PROFILES), addresseesuggest: ok(OFFICES), ...o });
/** The plane behind a request already started. */
const started = (o = {}) => ({ action: ok(REQ()), profiles: ok(PROFILES), stakeatpreparation: ok(STAKE()), ...o });
const WEIGHTY = ["communicationprepare", "filingprepare", "filingapprove", "filingsecondapprove", "filingrecordsent", "templatesave"];

/* ---------- R4, R39: look first, the name, the office, what is wanted ---------- */

test("R4, R39: says to look first (capture instead) and asks which name the records concern before anything else; nothing is asked of the offices on load", async () => {
  const p = await open(NEW, { plane: fresh() });
  assert.ok(drew(p, "screen.request.lookfirst"));
  const cap = main(p).querySelector('a[href="/app/capture"]');
  assert.ok(cap && text(p, cap) === norm(word("screen.request.capture")), "the capture door");
  assert.equal(p.byOp("addresseesuggest").length, 0, "the project's id is never asked about");
  assert.ok(drew(p, "screen.request.subject.label") && drew(p, "screen.request.subject.help"));
  assert.deepEqual(p.doc.getElementById("req-subject").querySelectorAll("option").map((o) => o.value), ["", "ENT-2026-1111111111111111", SUBJECT, BODY]);
  assert.deepEqual(ops(p), ["addresseesuggest"], "only the ask; 'Start the request' is not drawn before an office is chosen");
  assert.equal(p.doc.getElementById("req-office"), null);
  assert.equal(p.doc.getElementById("req-what"), null);
});

test("R39: control: 'Choose the office' with no name picked is refused naming the field and sends nothing; after a pick it sends that name, never the project, and the offices are drawn", async () => {
  const p = await open(NEW, { plane: fresh() });
  const b = await press(p, "addresseesuggest", { "req-subject": "" });
  assert.equal(p.byOp("addresseesuggest").length, 0, "no name, no ask");
  assert.ok(beside(p, b).includes(norm(word("findin.fieldneeded", { field: word("screen.request.subject.label") }))));
  await press(p, "addresseesuggest", { "req-subject": SUBJECT });
  const sent = p.byOp("addresseesuggest");
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].query, { op: "addresseesuggest", subject: SUBJECT });
  assert.ok(text(p).includes("City Clerk, Office of the City Clerk") && text(p).includes("Director of Public Works, Public Works"), "each office by its role and body");
  assert.ok(drew(p, "screen.request.office") && drew(p, "screen.request.office.help"));
  assert.ok(!drew(p, "screen.request.nooffice"), "offices known: no 'no office'");
  assert.equal(p.doc.getElementById("req-subject").value, SUBJECT, "the name picked stays picked");
});

test("R39: control: an ask that is refused is not 'no office is known', and a directory that cannot be read is drawn as failed, not as no office", async () => {
  const p = await open(NEW, { plane: fresh({ addresseesuggest: refused("STORE_DID_NOT_ANSWER", null, 502) }) });
  await press(p, "addresseesuggest", { "req-subject": SUBJECT });
  assert.ok(!drew(p, "screen.request.nooffice"));
  assert.ok(!ops(p).includes("actioncreate"));
  const q = await open(NEW, { plane: fresh({ peopledirectory: refused("STORE_DID_NOT_ANSWER", null, 502) }) });
  assert.ok(main(q).querySelector('[data-state="failed"]'));
  assert.ok(!drew(q, "screen.request.nooffice"));
});

test("R4: 'Start the request' is drawn once an office is chosen and creates a records request in the project addressed to the office chosen, then opens it; control: no words is refused in place", async () => {
  const p = await open(NEW, { plane: fresh({ actioncreate: ok({ id: AID }) }) });
  await press(p, "addresseesuggest", { "req-subject": SUBJECT });
  assert.deepEqual(ops(p), ["addresseesuggest", "actioncreate"]);
  assert.ok(drew(p, "screen.request.what") && drew(p, "screen.request.what.help"));
  const b = await press(p, "actioncreate", { "req-what": "  " });
  assert.equal(p.byOp("actioncreate").length, 0, "nothing sent");
  assert.ok(beside(p, b).includes(norm(word("screen.request.what.needed"))));
  await press(p, "actioncreate", { "req-what": "Inspection logs for pothole reports closed in 2025", "req-office": "1" });
  const doc = last(p, "actioncreate").body.document;
  for (const line of ["object_type: action", 'title: "Inspection logs for pothole reports closed in 2025"', `project: ${PROJECT}`, 'action_kind: "records_request"',
    'role: "Director of Public Works"', 'body: "Public Works"', 'entity_id: "ENT-2"', "current_state: planned"]) assert.ok(doc.includes(line), line);
  assert.equal(p.location.pathname, AT, "the started request's own page");
});

test("R4: a started request draws its office by role with who holds it today, and the law chosen among the profile's records laws, each with its own window, never the deadlines", async () => {
  const p = await open(AT, { plane: started({ actionlaws: ok({}) }) });
  assert.ok(text(p).includes("Town Clerk, Town of Port Ellery"));
  assert.ok(drew(p, "screen.request.holder", { holder: "Asha Rao" }));
  assert.ok(drew(p, "screen.request.step.law"));
  const opts = p.doc.getElementById("req-law").querySelectorAll("option").map((o) => norm(o.textContent));
  assert.deepEqual(opts, [
    norm(word("screen.request.law.option", { citation: "Gov. Code § 7922.535(b)", window: word("screen.request.window.calendar", { n: "10" }) })),
    norm(word("screen.request.law.option", { citation: "Mun. Code § 2.20.230", window: word("screen.request.window.business", { n: "3" }) })),
    norm(word("screen.request.law.option", { citation: FED, window: word("screen.request.window.business", { n: "20" }) }))], "records_laws, not the appeal's or a comment's rule");
  assert.equal(p.doc.getElementById("req-level"), null, "every law states its own level: none asked");
  await press(p, "actionlaws", { "req-law": "2" });
  assert.deepEqual(last(p, "actionlaws").body, { target: AID, laws: [{ level: "federal", citation: FED }] }, "the law's own level");
  assert.ok(main(p).querySelector(`a[href="/app/help-records/${AID}"]`), "the help for this action's law");
});

test("R4: control: a law with no window of its own is offered by its citation alone, and a law that states no level asks for one and sends the one picked", async () => {
  const bare = { ...PROFILES, view: { ...PROFILES.view, records_laws: [{ name: "Old Act", citation: "Old Act § 1" }] } };
  const p = await open(AT, { plane: started({ profiles: ok(bare), actionlaws: ok({}) }) });
  assert.deepEqual(p.doc.getElementById("req-law").querySelectorAll("option").map((o) => norm(o.textContent)), ["Old Act § 1"]);
  assert.ok(drew(p, "screen.request.level"));
  await press(p, "actionlaws", { "req-law": "0", "req-level": "county" });
  assert.deepEqual(last(p, "actionlaws").body, { target: AID, laws: [{ level: "county", citation: "Old Act § 1" }] });
});

/* ---------- R4, R8: the text, its approval, the sending ---------- */

test("R4, R8: 'Prepare the text' sends communicationprepare with the action and the text, the period, form and cost limit as fills where the text names their blanks; then 'Approve this text' follows", async () => {
  let drafts = [];
  const p = await open(AT, { plane: started({ filingsfor: () => ok(FILINGS(drafts)), communicationprepare: () => { drafts = [DRAFT()]; return ok(PREPARED({ text: "We request the logs for {{period}}." })); } }) });
  for (const k of ["screen.request.from", "screen.request.to", "screen.request.form", "screen.request.cost", "screen.request.cost.help", "screen.request.text"]) assert.ok(drew(p, k), k);
  assert.deepEqual(ops(p).filter((o) => o !== "actionlaws"), ["communicationprepare"], "a request is prepared from her words");
  await press(p, "communicationprepare", { "req-from": "2025-07-01", "req-to": "2026-06-30", "req-form": "spreadsheet", "req-cost": "$25",
    "send-text-0": "We request the inspection logs for {{period}}, as a {{form}}, at no more than {{cost_limit}}." });
  const body = last(p, "communicationprepare").body;
  assert.equal(body.action, AID);
  assert.equal(body.text, "We request the inspection logs for {{period}}, as a {{form}}, at no more than {{cost_limit}}.");
  assert.deepEqual(body.fills, { period: "2025-07-01 – 2026-06-30", form: "spreadsheet", cost_limit: "$25" });
  assert.deepEqual(ops(p).filter((o) => o !== "actionlaws"), ["filingapprove"]);
  assert.equal(p.doc.getElementById("send-text-1").value, "We request the logs for {{period}}.", "the prepared text is drawn");
});

test("R8: a fill is sent only where the text names its blank: one blank sends one fill, a plain text none; control: no text is refused in place and nothing is sent", async () => {
  const boxes = { "req-from": "2025-01-01", "req-to": "2025-12-31", "req-form": "pdf", "req-cost": "$25" };
  const p = await open(AT, { plane: started({ communicationprepare: ok(PREPARED()) }) });
  const none = await press(p, "communicationprepare", boxes);
  assert.equal(p.byOp("communicationprepare").length, 0);
  assert.ok(beside(p, none).includes(norm(word("screen.start-send.text.needed"))));
  await press(p, "communicationprepare", { ...boxes, "send-text-0": "Records for {{period}}: the inspection logs." });
  assert.deepEqual(last(p, "communicationprepare").body.fills, { period: "2025-01-01 – 2025-12-31" });
  const q = await open(AT, { plane: started({ communicationprepare: ok(PREPARED()) }) });
  await press(q, "communicationprepare", { ...boxes, "send-text-0": "Please send the inspection logs." });
  assert.ok(!("fills" in last(q, "communicationprepare").body), "no blank named: no fills");
});

test("R8: the text help says it was drafted from the team's template only where `templatesforaction` offers one; control: none offered, or a court petition, says the plain help", async () => {
  const offered = await open(AT, { plane: started({ templatesforaction: ok(TEMPLATES) }) });
  assert.ok(drew(offered, "screen.request.text.help"));
  for (const t of [{ ...TEMPLATES, versions: [] }, { ...TEMPLATES, court_petition: true }]) {
    const p = await open(AT, { plane: started({ templatesforaction: ok(t) }) });
    assert.ok(!drew(p, "screen.request.text.help"));
    assert.ok(drew(p, "screen.start-send.text.help"));
  }
  const unread = await open(AT, { plane: started({ templatesforaction: refused("NO_SUCH_ACTION", null, 404) }) });
  assert.ok(!drew(unread, "screen.request.text.help"), "a template not read is never claimed");
});

test("R4: 'Approve this text' sends the filing, and her edits to the prepared text with it; the screen says the team's Civicsmith sends nothing", async () => {
  const p = await open(AT, { plane: started({ filingsfor: ok(FILINGS([DRAFT()])), filingread: ok(PREPARED()), filingapprove: ok({ ok: true }) }) });
  assert.ok(drew(p, "screen.start-send.approvefixes") && drew(p, "screen.start-send.nosend"));
  await press(p, "filingapprove");
  assert.deepEqual(last(p, "filingapprove").body, { filing: FILING }, "unchanged text: only the filing");
  await press(p, "filingapprove", { "send-text-1": "We ask why the lease was renewed, and when." });
  assert.deepEqual(last(p, "filingapprove").body, { filing: FILING, text: "We ask why the lease was renewed, and when." });
});

test("R4, R8: approved, the request says how to send it, warns that the portal shows the text to anyone, and 'I have sent it' (outward) records the day, how and the portal's number", async () => {
  const p = await open(AT, { plane: started({ filingsfor: ok(FILINGS([DRAFT({ approval: APPROVAL })])), filingrecordsent: ok({ ok: true }) }) });
  assert.deepEqual(ops(p).filter((o) => o !== "actionlaws"), ["filingrecordsent"], "an approved request opens at the sending");
  assert.ok(drew(p, "screen.request.howsend") && drew(p, "screen.request.howsend.4"));
  assert.ok(drew(p, "screen.request.outward"), "the portal shows the text to anyone");
  assert.ok(drew(p, "screen.request.reference") && drew(p, "screen.request.reference.help"));
  assert.ok(drew(p, "screen.start-send.nosend"));
  const tip = String(button(p, "filingrecordsent").getAttribute("data-tip") || "").replace(/<[^>]*>/g, " ").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  assert.ok(norm(tip).includes(norm(word("mark.outward.means"))), "the outward mark on the act");
  assert.doesNotMatch(text(p), /\{\w+\}/, "a step whose particulars the record does not give is not drawn");
  await press(p, "filingrecordsent", { "send-at": "2026-11-03", "send-account": "on the portal", "send-reference": "26-11902" });
  const sent = last(p, "filingrecordsent").body;
  assert.deepEqual({ filing: sent.filing, at: sent.at, account: sent.account, reference: sent.reference }, { filing: FILING, at: "2026-11-03", account: "on the portal", reference: "26-11902" });
});

test("R4, R8: control: the sending is refused in place without its day or how, and a number the plane refuses is drawn by its words", async () => {
  const p = await open(AT, { plane: started({ filingsfor: ok(FILINGS([DRAFT({ approval: APPROVAL })])), filingrecordsent: refused("SENT_REFERENCE_MALFORMED", "x", 400) }) });
  const noDay = await press(p, "filingrecordsent", { "send-account": "on the portal" });
  assert.ok(beside(p, noDay).includes(norm(word("screen.start-send.sentat.needed"))));
  const noHow = await press(p, "filingrecordsent", { "send-at": "2026-11-03", "send-account": "" });
  assert.ok(beside(p, noHow).includes(norm(word("screen.start-send.how.needed"))));
  assert.equal(p.byOp("filingrecordsent").length, 0, "nothing sent while refused in place");
  const b = await press(p, "filingrecordsent", { "send-at": "2026-11-03", "send-account": "on the portal", "send-reference": "x".repeat(101) });
  assert.ok(beside(p, b).includes(norm(word("screen.request.reference.malformed"))));
});

test("R4: control: a request already sent draws its sending with the portal's number and offers no step of the flow but the law", async () => {
  const p = await open(AT, { plane: started({ filingsfor: ok(FILINGS([DRAFT({ approval: APPROVAL, sending: { ord: 1, sent_on: "2026-11-03", reference: "26-11902" } })])) }) });
  assert.ok(drew(p, "screen.start-send.sent", { date: day("2026-11-03") }));
  assert.ok(drew(p, "screen.start-send.reference", { reference: "26-11902" }));
  assert.deepEqual(ops(p), ["actionlaws"]);
});

/* ---------- R11: a draft prepared and not approved is read again on load ---------- */

test("R11: prepared, reloaded: the same text, blanks with their sources, her fills labelled hers, unfilled blanks with why, the advisory and the offers are drawn; nothing is prepared again", async () => {
  const read = PREPARED({ text: "We request the logs for 2025.", blanks: [{ name: "period", value: "2025", source: "fills:member:mai", label: { kind: "member_fill", by: "member:mai" } },
    { name: "office", value: "Town Clerk", source: AID }], unfilled: [{ name: "cost_limit", why: "the record holds no value for it" }],
    advisory: "Name the years exactly.", offers: ["counsel_packet"] });
  let drafts = [];
  const plane = started({ filingsfor: () => ok(FILINGS(drafts)), filingread: ok(read), communicationprepare: () => { drafts = [DRAFT()]; return ok(read); } });
  const first = await open(AT, { plane });
  await press(first, "communicationprepare", { "send-text-0": "We request the logs for {{period}}." });
  const p = await open(AT, { plane });
  assert.deepEqual(p.byOp("filingread").map((r) => r.query.filing), [FILING], "the filing the action holds, read once");
  assert.equal(p.doc.getElementById("send-text-1").value, "We request the logs for 2025.");
  assert.equal(p.doc.getElementById("send-text-1").value, first.doc.getElementById("send-text-1").value, "the same text as before the reload");
  assert.ok(drew(p, "screen.start-send.blank.own", { name: "period", value: "2025" }));
  assert.ok(drew(p, "screen.start-send.blank", { name: "office", value: "Town Clerk", source: AID }));
  assert.ok(drew(p, "screen.start-send.unfilled", { names: "cost_limit" }));
  assert.ok(drew(p, "screen.start-send.unfilled.why", { name: "cost_limit", why: "the record holds no value for it" }));
  assert.ok(drew(p, "screen.start-send.advisory", { advisory: "Name the years exactly." }));
  assert.ok(drew(p, "screen.start-send.offer.counsel_packet"));
  assert.equal(p.byOp("communicationprepare").length + p.byOp("filingprepare").length, 0, "reading prepares nothing");
  assert.ok(button(p, "filingapprove"));
});

test("R11: control: a filing that is not there is drawn as 'Nothing is here', with no approval offered and nothing prepared", async () => {
  const p = await open(AT, { plane: started({ filingsfor: ok(FILINGS([DRAFT()])), filingread: refused("NO_SUCH_FILING", "x", 404) }) });
  assert.ok(drew(p, "shell.unavailable.nothing"));
  assert.ok(!button(p, "filingapprove"));
  assert.equal(p.byOp("communicationprepare").length + p.byOp("filingprepare").length, 0);
});

/* ---------- R21 (request side): the two lines, and no question ---------- */

test("R21: request draws 'Sent with' (the team's name and statement) and 'In this matter' (the stake and its source) above the approval, and no question even at higher stakes", async () => {
  const p = await open(AT, { plane: started({ filingsfor: ok(FILINGS([DRAFT()])), filingread: ok(PREPARED()) }) });
  assert.ok(drew(p, "stake.sentwith") && drew(p, "stake.inmatter"));
  assert.ok(text(p).includes("Lakeshore Tenants") && text(p).includes("We hold the city to its own rules."));
  assert.ok(text(p).includes("Two members live in buildings on the slow-repair list."));
  assert.ok(drew(p, "stake.source.project", { who: "mai", date: day("2026-10-09") }));
  const html = main(p).innerHTML;
  assert.ok(html.indexOf("mk-dl") >= 0 && html.indexOf("mk-dl") < html.indexOf('data-act="filingapprove"'), "above the approval");
  for (const [tier, more] of [[2, {}], ["undetermined", {}]]) {
    const q = await open(AT, { plane: started({ stakeatpreparation: ok(STAKE({ higher_stakes: true, governing_tier: tier, ...more })) }) });
    assert.ok(!drew(q, "stake.ask.title") && !drew(q, "stake.ask.undetermined"), `tier ${tier}: no question`);
    assert.ok(!ops(q).includes("actionstake"));
    assert.equal(q.doc.getElementById("action-stake"), null);
    assert.ok(drew(q, "stake.inmatter") && ops(q).includes("communicationprepare"), "the lines, and preparing, whatever the tier");
  }
});

test("R21: the action's own stake with its source; none beyond the team's says so; control: a stake that cannot be read says so and is never none", async () => {
  const own = await open(AT, { plane: started({ stakeatpreparation: ok(STAKE({ matter_stake: { stake: "A member is a party.", set_by: "mai", set_at: "2026-10-09T09:00:00Z", source: "action" } })) }) });
  assert.ok(text(own).includes("A member is a party."));
  assert.ok(drew(own, "stake.source.action", { who: "mai", date: day("2026-10-09") }));
  const none = await open(AT, { plane: started({ stakeatpreparation: ok(STAKE({ matter_stake: null })) }) });
  assert.ok(drew(none, "stake.none") && !drew(none, "stake.unreadable"));
  for (const s of [{ matter_stake: { stake: "undetermined", set_by: null, set_at: null, source: "project" } }, { group_stake: "undetermined" }]) {
    const p = await open(AT, { plane: started({ stakeatpreparation: ok(STAKE(s)) }) });
    assert.ok(drew(p, "stake.unreadable"));
    assert.ok(main(p).querySelector("details[open] p[data-state='stake']"), "in its fold, open");
    if (s.matter_stake) assert.ok(!drew(p, "stake.none"));
  }
  const failed = await open(AT, { plane: started({ stakeatpreparation: refused("STORE_DID_NOT_ANSWER", null, 502) }) });
  assert.ok(main(failed).querySelector('[data-state="failed"]'));
  assert.ok(!drew(failed, "stake.none"));
  assert.ok(ops(failed).includes("communicationprepare"), "nothing waits on the stake");
});

/* ---------- R3: join first ---------- */

const standing = (participation) => ok({ projects: [{ id: PROJECT, participation }] });

test("R3: an invited member who has not joined is told at the start, in the fold with Join in place, and offered none of the weighty steps, prepared or approved", async () => {
  for (const drafts of [[], [DRAFT({ approval: APPROVAL })], [DRAFT({ approval: APPROVAL, second_needed: true })]]) {
    const p = await open(AT, { plane: started({ projectlist: standing("invited"), filingsfor: ok(FILINGS(drafts)) }) });
    const fold = main(p).querySelector("details[data-gap=join]");
    assert.ok(fold, "the fold");
    assert.equal(text(p, fold.querySelector("summary")), norm(word("screen.projectact.invited.head")));
    assert.ok(drew(p, "refusal.PROJECT_ACT_NOT_A_PARTICIPANT.invited", {}, fold));
    assert.ok(button(p, "projectjoin"), "Join in place");
    for (const op of WEIGHTY) assert.ok(!button(p, op), op);
    assert.equal(p.requests.filter((r) => WEIGHTY.includes(r.op)).length, 0, "nothing sent");
    assert.ok(drew(p, "screen.start-send.nosend"));
  }
});

test("R3: Join sends the project, her place is read again, and the step is then offered; control: joined, no row and a place not read change nothing", async () => {
  let place = "invited";
  const p = await open(AT, { plane: started({ projectlist: () => standing(place), projectjoin: () => { place = "joined"; return ok({ ok: true }); } }) });
  const before = p.byOp("projectlist").length;
  await press(p, "projectjoin");
  assert.deepEqual(last(p, "projectjoin").query, { op: "projectjoin", projectId: PROJECT });
  assert.ok(p.byOp("projectlist").length > before, "her place is read again");
  assert.ok(button(p, "communicationprepare"), "joined: the step is offered");
  assert.equal(main(p).querySelector("details[data-gap=join]"), null);
  for (const projectlist of [standing("joined"), ok({ projects: [] }), refused("BAD", null, 500)]) {
    const q = await open(AT, { plane: started({ projectlist }) });
    assert.ok(button(q, "communicationprepare"));
    assert.ok(!drew(q, "refusal.PROJECT_ACT_NOT_A_PARTICIPANT.invited"));
  }
});

/* ---------- R20, R46: no office known ---------- */

test("R20, R46: no office known for the name picked: both sentences, the reference to Places for an administrator, the pointer to the organization's page, and no choose-office, start or later step", async () => {
  const p = await open(NEW, { plane: fresh({ whoami: ok(ADMIN), addresseesuggest: ok(NO_OFFICES) }) });
  assert.ok(!drew(p, "screen.request.nooffice"), "none is said before the ask answers");
  assert.equal(main(p).querySelector('[data-list="person"]'), null, "R46: no name asked about, no pointer");
  await press(p, "addresseesuggest", { "req-subject": SUBJECT });
  assert.ok(drew(p, "screen.request.nooffice") && drew(p, "screen.request.nooffice.admin"));
  const places = main(p).querySelector('[data-list="places"] a[data-screen="places"]');
  assert.ok(places && places.getAttribute("href") === "/app/places" && text(p, places).includes(norm(word("screen.places.name"))));
  assert.ok(drew(p, "screen.places.purpose"));
  const keeper = main(p).querySelector('[data-list="person"] a[data-screen="person"]');
  assert.ok(keeper, "R46: the pointer");
  assert.equal(keeper.getAttribute("href"), "/app/person/" + encodeURIComponent(SUBJECT));
  assert.equal(text(p, keeper), norm(word("screen.person.name")));
  for (const k of ["screen.request.nooffice.pointer.a", "screen.request.nooffice.pointer.b", "screen.person.purpose"]) assert.ok(drew(p, k), k);
  const html = main(p).innerHTML;
  assert.ok(html.indexOf(word("screen.request.nooffice.admin").slice(0, 20)) < html.indexOf('data-list="person"'), "R46: after R20's sentences");
  assert.deepEqual(ops(p), ["addresseesuggest", "entitycreate"], "the name may be asked again or the office named; no start, no later step");
  for (const id of ["req-office", "req-what"]) assert.equal(p.doc.getElementById(id), null, id);
});

test("R20, R46: control: a member for whom no Places screen is drawn reads the sentences without the reference; with offices known none of it is drawn; a record that follows no name says no office is known and points nowhere", async () => {
  const member = await open(NEW, { plane: fresh({ addresseesuggest: ok(NO_OFFICES) }) });
  await press(member, "addresseesuggest", { "req-subject": SUBJECT });
  assert.ok(drew(member, "screen.request.nooffice") && drew(member, "screen.request.nooffice.admin"));
  assert.equal(main(member).querySelector('a[href="/app/places"]'), null);
  const known = await open(NEW, { plane: fresh({ whoami: ok(ADMIN) }) });
  await press(known, "addresseesuggest", { "req-subject": SUBJECT });
  assert.ok(!drew(known, "screen.request.nooffice"));
  assert.equal(main(known).querySelector('a[href="/app/places"]'), null);
  assert.equal(main(known).querySelector('[data-list="person"]'), null, "R46: with offices, no pointer");
  assert.equal(known.doc.getElementById("req-noff-name"), null, "no fold");
  const nameless = await open(NEW, { plane: fresh({ peopledirectory: ok({ rows: [], truncated: false }), whoami: ok(ADMIN) }) });
  assert.ok(drew(nameless, "screen.request.nooffice"));
  assert.equal(nameless.byOp("addresseesuggest").length, 0);
  assert.deepEqual(ops(nameless), ["entitycreate"]);
  assert.equal(main(nameless).querySelector('[data-list="person"]'), null, "R46: no name picked, no pointer");
});

/** The fold reached: a name asked about, no office known. */
const fold = async (o = {}) => {
  const p = await open(NEW, { plane: fresh({ addresseesuggest: (req) => ok(req.query.subject === NAMED_OFFICE
    ? { ok: true, subject: NAMED_OFFICE, offices: [{ addressee: { state: "named", kind: "office", role: "Records Office", body: "City of Port Ellery", entity_id: NAMED_OFFICE } }], undetermined: [], suggestion: true }
    : NO_OFFICES), entitycreate: ok({ ok: true, entity_id: NAMED_OFFICE, kind: "office", label: "Records Office" }), linesof: ok({ ok: true, lines: [] }), recordline: ok({ ok: true, line_id: "LIN-1" }),
    actioncreate: ok({ id: AID }), ...o }) });
  await press(p, "addresseesuggest", { "req-subject": SUBJECT });
  return p;
};
const NAMING = { "req-noff-name": "Town of Port Ellery", "req-noff-role": "Records Office", "req-noff-body": BODY, "req-noff-since": "2000-01-01", "req-noff-until": "2099-12-31",
  "req-noff-where": "https://records.example/portal", "req-noff-law": "2", "req-noff-note": "It keeps the town's records." };

test("R20: 'Name the office yourself' draws the agency and office, where requests go, the records laws and her reason, and sends `entitycreate` with the office, its contact and law; the office is then chosen, marked, and the request addressed to it", async () => {
  const p = await fold();
  for (const k of ["screen.request.nameoffice.head", "screen.request.nameoffice.name", "screen.request.nameoffice.role", "screen.request.nameoffice.where", "screen.request.nameoffice.why", "screen.request.nameoffice.law"]) assert.ok(drew(p, k), k);
  assert.deepEqual(p.doc.getElementById("req-noff-law").querySelectorAll("option").map((o) => norm(o.textContent)),
    ["Testland Records Act · Gov. Code § 7922.535(b)", "Testville Sunshine Ordinance · Mun. Code § 2.20.230", `Freedom of Information Act · ${FED}`], "the profile's records laws");
  await press(p, "entitycreate", NAMING);
  const body = last(p, "entitycreate").body;
  assert.equal(body.kind, "office");
  assert.equal(body.label, "Town of Port Ellery, Records Office", "labelled by the agency and the office within it");
  assert.deepEqual(body.contact, { kind: "portal", value: "https://records.example/portal" });
  assert.equal(body.law, FED);
  assert.equal(typeof body.note, "string");
  assert.ok(body.note.length > 0, "her reason");
  assert.ok(main(p).querySelector('[data-named="1"]') && drew(p, "screen.request.nameoffice.mark"), "marked as named by a member");
  assert.deepEqual(last(p, "addresseesuggest").query, { op: "addresseesuggest", subject: NAMED_OFFICE });
  assert.deepEqual(ops(p), ["actioncreate"], "chosen: what is wanted is asked");
  await press(p, "actioncreate", { "req-what": "The council's minutes", "req-office": "0" });
  assert.ok(last(p, "actioncreate").body.document.includes(`entity_id: "${NAMED_OFFICE}"`), "addressed to the office she named");
});

test("R20: control: where requests go is sent as an email or an address by its form, and not at all when left empty; a refused office is drawn beside the act and nothing is chosen", async () => {
  for (const [where, contact] of [["foia@agency.example", { kind: "email", value: "foia@agency.example" }], ["1 Main St, Port Ellery", { kind: "address", value: "1 Main St, Port Ellery" }], ["", undefined]]) {
    const p = await fold();
    await press(p, "entitycreate", { ...NAMING, "req-noff-where": where });
    assert.deepEqual(last(p, "entitycreate").body.contact, contact, where || "empty");
  }
  const no = await fold({ entitycreate: refused("UNKNOWN_LAW", "That law is not one the profile holds.") });
  const b = await press(no, "entitycreate", NAMING);
  assert.ok(beside(no, b).includes("That law is not one the profile holds."));
  assert.equal(no.doc.getElementById("req-office"), null);
  assert.equal(main(no).querySelector('[data-named="1"]'), null);
  assert.equal(no.byOp("recordline").length, 0);
  const nameless = await fold();
  const n = await press(nameless, "entitycreate", { ...NAMING, "req-noff-name": " " });
  assert.equal(nameless.byOp("entitycreate").length, 0);
  assert.ok(beside(nameless, n).includes(norm(word("findin.fieldneeded", { field: word("screen.request.nameoffice.name") }))));
});

/* ---------- R57: the office is recorded with its body ---------- */

test("R57: the fold asks the body among the team's bodies and its Since and Until; the office is recorded in that body between those days, then answered as named and chosen at once", async () => {
  const p = await fold();
  assert.deepEqual(p.doc.getElementById("req-noff-body").querySelectorAll("option").map((o) => [o.value, norm(o.textContent)]), [["", ""], [BODY, "City of Port Ellery"]], "the team's bodies only");
  assert.ok(drew(p, "screen.request.office.body") && drew(p, "screen.person.keeper.from.label") && drew(p, "screen.person.keeper.to.label"));
  assert.ok(p.doc.getElementById("req-noff-since") && p.doc.getElementById("req-noff-until"));
  await press(p, "entitycreate", NAMING);
  assert.deepEqual(last(p, "linesof").query, { op: "linesof", entity: NAMED_OFFICE, kinds: "post_in", direction: "from", limit: "20" });
  const line = last(p, "recordline").body;
  assert.equal(line.kind, "post_in");
  assert.equal(line.from, NAMED_OFFICE);
  assert.equal(line.to, BODY, "the body she chose");
  assert.equal(line.valid.from, "2000-01-01");
  assert.equal(line.valid.to, "2099-12-31");
  assert.ok(p.doc.getElementById("req-office"), "offered and chosen in this visit");
  assert.ok(!drew(p, "screen.request.office.undated"));
});

test("R57: control: an office named with no body is refused naming the field, and nothing is sent or recorded", async () => {
  const p = await fold();
  const b = await press(p, "entitycreate", { ...NAMING, "req-noff-body": "" });
  assert.ok(beside(p, b).includes(norm(word("findin.fieldneeded", { field: word("screen.request.office.body") }))));
  assert.equal(p.byOp("entitycreate").length + p.byOp("recordline").length, 0);
});

test("R57: an office named without both days is recorded and its body line sent with the bound unstated, not offered, and the design's sentence says why; an office already in a body records no second line", async () => {
  const p = await fold({ addresseesuggest: ok(NO_OFFICES) });
  await press(p, "entitycreate", { ...NAMING, "req-noff-since": "", "req-noff-until": "" });
  const line = last(p, "recordline").body;
  assert.equal(line.valid.from, null);
  assert.equal(line.valid.to, null);
  assert.ok(main(p).querySelector('[data-undated="1"]') && drew(p, "screen.request.office.undated"));
  assert.equal(p.doc.getElementById("req-office"), null, "not offered");
  const held = await fold({ linesof: ok({ ok: true, lines: [{ line_id: "LIN-0", kind: "post_in", from: NAMED_OFFICE, to: BODY, withdrawn: false }] }) });
  await press(held, "entitycreate", NAMING);
  assert.equal(held.byOp("recordline").length, 0, "the record already holds one");
  assert.ok(held.doc.getElementById("req-office"));
});

test("R57: control: a body line the plane refuses is drawn by its words and the office is not chosen", async () => {
  const p = await fold({ recordline: refusedIn("LINE_REFUSED", "The line could not be recorded.") });
  await press(p, "entitycreate", NAMING);
  assert.ok(text(p).includes("The line could not be recorded."));
  assert.equal(p.doc.getElementById("req-office"), null);
});

/* ---------- R29: the door to the composer for any other kind ---------- */

test("R29: under the title, the door to 'Start another kind of action' opens `actionnew` on the same project, before the office is chosen, in both states", async () => {
  const check = (p, what) => {
    assert.ok(drew(p, "screen.request.other"), what);
    const a = main(p).querySelector('[data-list="actionnew"] a[data-screen="actionnew"]');
    assert.ok(a, what + ": the reference");
    assert.equal(a.getAttribute("href"), "/app/actionnew/" + PROJECT);
    assert.equal(text(p, a), norm(word("screen.request.other.go")));
    assert.ok(drew(p, "screen.actionnew.name") && drew(p, "screen.actionnew.purpose"), what + ": its card");
  };
  const p = await open(NEW, { plane: fresh() });
  check(p, "before the ask");
  await press(p, "addresseesuggest", { "req-subject": SUBJECT });
  check(p, "offices known");
  const none = await open(NEW, { plane: fresh({ addresseesuggest: ok(NO_OFFICES) }) });
  await press(none, "addresseesuggest", { "req-subject": SUBJECT });
  check(none, "none known");
  const nameless = await open(NEW, { plane: fresh({ peopledirectory: ok({ rows: [], truncated: false }) }) });
  check(nameless, "no name to ask about");
  await p.click(main(p).querySelector('[data-list="actionnew"] a'));
  assert.equal(p.location.pathname, "/app/actionnew/" + PROJECT, "it opens the composer");
});
