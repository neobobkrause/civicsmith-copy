/* screens-action R4, R8, R10 (and R7 on `request`): a records request in the flow's order, its period, form and cost
   limit sent as `fills`, the portal's warning and number, and an action opened at the step it has reached. Every sentence is
   asserted by its key through `setup-words` (R19). */
const said = (p, key, vars) => assert.ok(text(p).includes(W(key, vars)), key);
import test from "node:test";
import assert from "node:assert/strict";
import { actionWorld, filingIn, openIn } from "./world-C.mjs";
import { open, main, text, ops, press, last, ok, refused, button, beside, W, D, DATA_PLANE, ACTION, ACTION_ID, PROJECT, FILING, FILINGS, READ, STAKE, ADMIN, draft } from "./page.mjs";
import { frameAnswers } from "../interface-shell/frame-answers.mjs";

const NEW = `/app/request/${PROJECT}`;
const AT = `/app/request/${ACTION_ID}`;
const OFFICES = { subject: PROJECT, offices: [
  { addressee: { state: "named", kind: "office", role: "City Clerk", body: "Office of the City Clerk", entity_id: "ENT-1" } },
  { addressee: { state: "named", kind: "office", role: "Director of Public Works", body: "Public Works", entity_id: "ENT-2" } }], suggestion: true };

const NAMES = { rows: [{ entity: "ENT-2026-1111111111111111", kind: "organisation", name: "Public Works" }, { entity: "ENT-2026-2222222222222222", kind: "office", name: "Pothole repair program" }], truncated: false };
const SUBJECT = "ENT-2026-2222222222222222";

test("R4, R39: says to look first (a public record is captured instead), asks which name the records concern, then 'Choose the office' brings the offices and 'Start the request', which creates the action and opens it", async () => {
  const p = await open(NEW, { ...DATA_PLANE, peopledirectory: ok(NAMES), addresseesuggest: ok(OFFICES), actioncreate: ok({ id: ACTION_ID }) });
  said(p, "screen.request.lookfirst");
  assert.ok(main(p).querySelector('a[href="/app/capture"]'));
  assert.equal(p.byOp("addresseesuggest").length, 0, "R39: the plane does not resolve the project's id, so no office is asked on load");
  assert.deepEqual(ops(p), ["addresseesuggest"], "R20: 'Start the request' is not drawn before an office is chosen");
  assert.equal(p.doc.getElementById("req-what"), null);
  assert.deepEqual(p.doc.getElementById("req-subject").querySelectorAll("option").map((o) => o.value), ["", "ENT-2026-1111111111111111", SUBJECT], "the names the record follows");
  await press(p, "addresseesuggest", { values: { "req-subject": SUBJECT } });
  assert.deepEqual(last(p, "addresseesuggest").query, { op: "addresseesuggest", subject: SUBJECT }, "the name she picked, never the project");
  assert.match(text(p), /Director of Public Works, Public Works/);
  assert.deepEqual(ops(p), ["addresseesuggest", "actioncreate"], "offices answered: what is wanted is asked");
  assert.equal(p.doc.getElementById("req-subject").value, SUBJECT, "the name picked stays picked");
  await press(p, "actioncreate", { values: { "req-office": "1" }, reason: "x" });
  const none = await press(p, "actioncreate", { reason: "x" });
  assert.ok(beside(p, none).includes(W("screen.request.what.needed")));
  await press(p, "actioncreate", { values: { "req-what": "Inspection logs for pothole reports closed in 2025", "req-office": "1" }, reason: "x" });
  const doc = last(p, "actioncreate").body.document;
  for (const line of ["object_type: action", 'title: "Inspection logs for pothole reports closed in 2025"', `project: ${PROJECT}`, 'action_kind: "records_request"',
    'role: "Director of Public Works"', 'body: "Public Works"', 'entity_id: "ENT-2"', "current_state: planned"]) assert.ok(doc.includes(line), line);
  assert.equal(p.location.pathname, `/app/request/${ACTION_ID}`);
});

test("R20, R39: with no office known the request says so and points an administrator to Places and offices, and draws no later step; control: a member sees no reference, a team with offices draws R4's flow", async () => {
  const plane = { ...DATA_PLANE, peopledirectory: ok(NAMES), addresseesuggest: ok({ subject: SUBJECT, offices: [], suggestion: true }) };
  const admin = await open(NEW, { ...plane, whoami: ok(ADMIN) });
  assert.ok(!text(admin).includes(W("screen.request.nooffice")), "R39: none is known before a name is asked about");
  await press(admin, "addresseesuggest", { values: { "req-subject": SUBJECT } });
  said(admin, "screen.request.nooffice");
  said(admin, "screen.request.nooffice.admin");
  const places = main(admin).querySelector('a[href="/app/places"]');
  assert.ok(places && places.textContent.includes(W("screen.places.name")), "the reference to where an office is added");
  said(admin, "screen.places.purpose");
  assert.deepEqual(ops(admin), ["addresseesuggest", "entitycreate"], "the name can be changed and asked again, or the office named (C64); no start and no later step");
  for (const id of ["req-office", "req-what"]) assert.equal(admin.doc.getElementById(id), null, id);
  assert.equal(admin.byOp("actioncreate").length + admin.byOp("filingprepare").length, 0);
  // a session for which the shell draws no Places screen is shown the sentences and no reference
  const member = await open(NEW, plane);
  await press(member, "addresseesuggest", { values: { "req-subject": SUBJECT } });
  said(member, "screen.request.nooffice");
  said(member, "screen.request.nooffice.admin");
  assert.equal(main(member).querySelector('a[href="/app/places"]'), null);
  // control: with offices known, the sentences and the reference are not drawn and the flow is
  const known = await open(NEW, { ...DATA_PLANE, peopledirectory: ok(NAMES), addresseesuggest: ok(OFFICES), whoami: ok(ADMIN) });
  await press(known, "addresseesuggest", { values: { "req-subject": SUBJECT } });
  assert.ok(!text(known).includes(W("screen.request.nooffice")));
  assert.equal(main(known).querySelector('a[href="/app/places"]'), null);
  assert.deepEqual(ops(known), ["addresseesuggest", "actioncreate"]);
  // B7: opened with no subject, the screen asks nothing (addresseesuggest refuses NO_SUBJECT) and draws its no-office state
  const bare = await open("/app/request", { ...DATA_PLANE, whoami: ok(ADMIN), addresseesuggest: refused("NO_SUBJECT", "no subject", 400) });
  assert.equal(bare.byOp("addresseesuggest").length, 0, "no call without a subject");
  said(bare, "screen.request.nooffice");
  assert.ok(main(bare).querySelector('a[href="/app/places"]'));
  assert.deepEqual(ops(bare), ["entitycreate"], "no ask and no later step; the office may be named (C64)");
  assert.ok(!main(bare).querySelector('[data-state="failed"]'));
  // a project whose record follows no name has none to ask about: it says no office is known and draws no act
  const nameless = await open(NEW, { ...DATA_PLANE, peopledirectory: ok({ rows: [], truncated: false }), whoami: ok(ADMIN) });
  said(nameless, "screen.request.nooffice");
  assert.deepEqual(ops(nameless), ["entitycreate"], "no ask and no later step; the office may be named (C64)");
  // control: a read that failed is not "no office known"
  const failed = await open(NEW, { ...DATA_PLANE, peopledirectory: refused("STORE_DID_NOT_ANSWER", null, 502) });
  assert.ok(main(failed).querySelector('[data-state="failed"]'));
  assert.ok(!text(failed).includes(W("screen.request.nooffice")));
  const refusedAsk = await open(NEW, { ...DATA_PLANE, peopledirectory: ok(NAMES), addresseesuggest: refused("STORE_DID_NOT_ANSWER", null, 502) });
  await press(refusedAsk, "addresseesuggest", { values: { "req-subject": SUBJECT } });
  assert.ok(!text(refusedAsk).includes(W("screen.request.nooffice")), "an ask that was refused is not 'no office known'");
});

test("R4: the law it goes under is chosen among the laws the profile names for a records request, each with its window", async () => {
  const p = await open(AT, { ...DATA_PLANE, actionlaws: ok({}) });
  // R60 (T53): each law a box, none ticked, labelled with its level, name, citation and window
  const opts = p.doc.getElementById("req-law").querySelectorAll("label").map((o) => o.textContent.replace(/\s+/g, " ").trim());
  assert.equal(opts.length, 2);
  assert.ok(opts[0].includes("Gov. Code § 7922.535(b)") && opts[0].includes(W("screen.request.window.calendar", { n: "10" })));
  assert.ok(opts[1].includes("Mun. Code § 2.20.230") && opts[1].includes(W("screen.request.window.business", { n: "3" })));
  await press(p, "actionlaws", { values: { "req-law-1": true } });
  assert.deepEqual(last(p, "actionlaws").body, { target: ACTION_ID, laws: [{ level: "city", citation: "Mun. Code § 2.20.230" }] });
  assert.ok(main(p).querySelector(`a[href="/app/help-records/${ACTION_ID}"]`), "R9: help-records is reached from request, for this action's law");
  // the laws a member stated are `action`'s `governing_laws.laws` (actions R25), drawn above the choice
  const stated = main(p).querySelectorAll("section.cs-section").find((s) => s.textContent.includes(W("screen.request.step.law")));
  assert.ok(stated.querySelector(".cs-sheet").textContent.includes("Gov. Code § 7922.535(b)"));
});

test("R4, R8: 'Prepare the text' sends communicationprepare with the period, the form and the cost limit, those the text names, as fills; 'Approve this text' then follows", async () => {
  let drafts = [];
  const p = await open(AT, { ...DATA_PLANE, filingsfor: () => ok(FILINGS(drafts)),
    communicationprepare: () => { drafts = [draft()]; return ok({ id: FILING, text: "We request the logs.", blanks: [] }); }, filingapprove: ok({}) });
  // the sentence about describing the records names the law's citation, which the record does not give: not drawn, never drawn short
  assert.doesNotMatch(text(p), /\{\w+\}/, "no placeholder is drawn");
  await press(p, "communicationprepare", { values: { "req-from": "2025-07-01", "req-to": "2026-06-30", "req-form": "spreadsheet", "req-cost": "$25",
    "send-text-0": "We request the inspection logs for {{period}}, as a {{form}}, at no more than {{cost_limit}}." }, reason: "ready" });
  assert.deepEqual(last(p, "communicationprepare").body.fills, { period: "2025-07-01 – 2026-06-30", form: "spreadsheet", cost_limit: "$25" });
  assert.equal(last(p, "communicationprepare").body.action, ACTION_ID);
  assert.deepEqual(ops(p).filter((o) => o !== "actionlaws"), ["filingapprove"]);
});

test("R8: the outward warning names that the portal shows the text to anyone; 'I have sent it' takes the portal's request number; control: a malformed number is refused in words", async () => {
  const { world, me, action } = await actionWorld();
  const filing = await filingIn(me, action, { approve: true });
  const p = await openIn(world, me, `/app/request/${action}`);
  said(p, "screen.request.outward");
  said(p, "screen.request.howsend");
  // the portal's address and button and the department are the place's data the record does not give: those two steps are not drawn
  said(p, "screen.request.howsend.3");
  said(p, "screen.request.howsend.4");
  assert.doesNotMatch(text(p), /\{\w+\}/, "no placeholder is drawn");
  said(p, "screen.request.reference");
  const b = await press(p, "filingrecordsent", { values: { "send-at": "2026-10-10", "send-account": "on the portal", "send-reference": "x".repeat(101) }, reason: "sent" });
  assert.ok(beside(p, b).includes(W("screen.request.reference.malformed")));
  assert.equal((await me.read("filingsfor", { query: { action } })).drafts[0].sending, null, "the owner took no sending");
  await press(p, "filingrecordsent", { values: { "send-at": "2026-10-10", "send-account": "on the portal", "send-reference": "26-11902" }, reason: "sent" });
  assert.equal(last(p, "filingrecordsent").body.reference, "26-11902");
  assert.equal(last(p, "filingrecordsent").body.filing, filing);
  const [held] = (await me.read("filingsfor", { query: { action } })).drafts;
  assert.equal(held.sending.reference, "26-11902", "the store holds the number she gave");
});

test("R10 (DEC-212): an action opened at its address opens at the step it has reached: approved and not sent opens at the send; control: nothing prepared opens at the text", async () => {
  const unsent = draft({ approval: { approved_by: "member:mai", at: "2026-10-09", sha: "s" } });
  const p = await open(AT, { ...DATA_PLANE, filingsfor: ok(FILINGS([unsent])) });
  assert.deepEqual(ops(p).filter((o) => o !== "actionlaws"), ["filingrecordsent"]);
  assert.ok(button(p, "filingrecordsent"));
  const q = await open(AT, { ...DATA_PLANE, filingsfor: ok(FILINGS([])) });
  assert.deepEqual(ops(q).filter((o) => o !== "actionlaws"), ["communicationprepare"]);
});

test("R4: control: an action already sent draws its sending and offers no act of the flow but the law", async () => {
  const done = draft({ approval: { approved_by: "member:mai", at: "x", sha: "s" }, sending: { ord: 1, sent_on: "2026-10-02", reference: "26-11902" } });
  const p = await open(AT, { ...DATA_PLANE, action: ok(ACTION), filingsfor: ok(FILINGS([done])) });
  assert.ok(text(p).includes(`${W("screen.start-send.sent", { date: D("2026-10-02") })} · ${W("screen.start-send.reference", { reference: "26-11902" })}`));
  assert.deepEqual(ops(p), ["actionlaws"]);
});

/* R11 (T48; N1034; K3145; filings R59) on `request`: a draft prepared and not yet approved is read again on load. */
test("R11: a request reloaded between preparing and approving draws the same text and fills; control: nothing is prepared again by reading", async () => {
  const prepared = READ({ text: "We request inspection logs for 2025 – 2026.", blanks: [], unfilled: [] });
  const p = await open(AT, { ...DATA_PLANE, filingsfor: ok(FILINGS([draft()])), filingread: ok(prepared), communicationprepare: ok(prepared) });
  assert.equal(p.byOp("filingread")[0].query.filing, FILING);
  assert.equal(p.doc.getElementById("send-text-1").value, "We request inspection logs for 2025 – 2026.");
  assert.deepEqual(ops(p).filter((o) => o === "filingapprove" || o === "communicationprepare"), ["filingapprove"]);
  assert.equal(p.byOp("communicationprepare").length, 0);
});

/* ---------- R21 (T50; N933; K3230; DEC-231; DEC-320; filings R60 to R62): the matter's stake at preparation, a prompt and never a gate ---------- */

/* the frame's four reads, each answered by its owner's fixture (K5217, K5219); the team's name is read from its `groupidentity` answer */
const FRAME_ANSWERS = await frameAnswers();
const TEAM = FRAME_ANSWERS.groupidentity.json.result.display_name;
const SAID = "Some members rent from landlords the city licenses.";
const PROJECT_STAKE = "Two members live in buildings on the city's list of slow repairs.";
const stakeSaid = (p, from = "project") => said(p, "stake.source." + from, { who: "dev", date: D("2026-10-09") });

test("R21: request draws 'Sent with' (the team's name and its statement) and 'In this matter' with the stake and its source, above the approval, and no question", async () => {
  const p = await open(AT, { ...DATA_PLANE, ...FRAME_ANSWERS, filingsfor: ok(FILINGS([draft()])), filingread: ok(READ()) });
  assert.equal(p.byOp("stakeatpreparation")[0].query.action, ACTION_ID);
  for (const k of ["stake.sentwith", "stake.inmatter"]) said(p, k);
  for (const t of [TEAM, SAID, PROJECT_STAKE]) assert.ok(text(p).includes(t), t);
  stakeSaid(p);
  assert.ok(main(p).innerHTML.indexOf("mk-dl") < main(p).innerHTML.indexOf('data-act="filingapprove"'), "above the approval");
  // control: the question is start-send's alone, whatever the tier, and `request` offers no `actionstake`
  const higher = await open(AT, { ...DATA_PLANE, stakeatpreparation: ok(STAKE({ higher_stakes: true, governing_tier: 2 })) });
  assert.ok(!text(higher).includes(W("stake.ask.title")));
  assert.ok(!ops(higher).includes("actionstake"));
  assert.equal(higher.doc.getElementById("action-stake"), null);
  // the lines are drawn at the first preparation too, and approving is offered whatever the stake
  const first = await open(AT, DATA_PLANE);
  said(first, "stake.inmatter");
  assert.deepEqual(ops(first).filter((o) => o !== "actionlaws"), ["communicationprepare"]);
});

test("R21: the stake shown is the action's own when it has one, else the project's, else 'none beyond the team's'; control: one that cannot be read says so and is never none", async () => {
  const own = await open(AT, { ...DATA_PLANE, stakeatpreparation: ok(STAKE({ matter_stake: { stake: "A member is a party.", set_by: "member:dev", set_at: "2026-10-09T09:00:00Z", source: "action" } })) });
  assert.ok(text(own).includes("A member is a party."));
  stakeSaid(own, "action");
  assert.ok(!text(own).includes(PROJECT_STAKE));
  const none = await open(AT, { ...DATA_PLANE, stakeatpreparation: ok(STAKE({ matter_stake: null })) });
  said(none, "stake.none");
  assert.ok(!text(none).includes(W("stake.unreadable")));
  // the team's statement unread, or none: the lines still say what they hold
  const quiet = await open(AT, { ...DATA_PLANE, ...FRAME_ANSWERS, stakeatpreparation: ok(STAKE({ group_stake: null })) });
  assert.ok(text(quiet).includes(TEAM) && !text(quiet).includes(SAID));
  // control: unreadable, whichever source, is its own sentence in its fold, open whenever drawn, and not "none"
  for (const matter_stake of [{ stake: "undetermined", set_by: null, set_at: null, source: "action" }, { stake: "undetermined", set_by: null, set_at: null, source: "project" }]) {
    const p = await open(AT, { ...DATA_PLANE, stakeatpreparation: ok(STAKE({ matter_stake })) });
    said(p, "stake.unreadable.summary");
    said(p, "stake.unreadable");
    assert.ok(main(p).querySelector("details[open] p[data-state='stake']"), "inside its fold, open");
    assert.ok(!text(p).includes(W("stake.none")));
    assert.ok(!text(p).includes(PROJECT_STAKE));
  }
  const group = await open(AT, { ...DATA_PLANE, stakeatpreparation: ok(STAKE({ group_stake: "undetermined" })) });
  said(group, "stake.unreadable");
  // a read that failed is drawn as failed, never as none
  const failed = await open(AT, { ...DATA_PLANE, stakeatpreparation: refused("STORE_DID_NOT_ANSWER", null, 502) });
  assert.ok(main(failed).querySelector('[data-state="failed"]'));
  assert.ok(!text(failed).includes(W("stake.none")));
});

test("R21: nothing waits on the stake on request: preparing, approving and recording the sending are drawn whether or not it can be read", async () => {
  const failed = refused("STORE_DID_NOT_ANSWER", null, 502);
  const prepare = await open(AT, { ...DATA_PLANE, stakeatpreparation: failed, identity: failed });
  assert.ok(ops(prepare).includes("communicationprepare"));
  const approve = await open(AT, { ...DATA_PLANE, stakeatpreparation: failed, filingsfor: ok(FILINGS([draft()])), filingread: ok(READ()) });
  assert.ok(ops(approve).includes("filingapprove"));
  const send = await open(AT, { ...DATA_PLANE, stakeatpreparation: failed, filingsfor: ok(FILINGS([draft({ approval: { approved_by: "member:mai", at: "x", sha: "s" } })])) });
  assert.deepEqual(ops(send).filter((o) => o !== "actionlaws"), ["filingrecordsent"]);
});
