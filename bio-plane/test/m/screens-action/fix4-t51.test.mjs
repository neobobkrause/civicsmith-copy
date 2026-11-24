/* screens-action, fix round 4 of T51 (K4429): C53-min (the reminder's date defaults to the option's first date), C64-more
   (the office she names herself: one agency box, one entry per name), C64-template and C64-law (a federal request through its
   steps), C65 (the door to keep a sent filing as the team's template) and C14 (this screens' read set). Each test enters by
   the member's act (a press), never by calling an act's done function; every sentence is read by its key (R19). */
import test from "node:test";
import assert from "node:assert/strict";
import { WORLD_FOUNDER_HANDLE } from "../interface-shell/world.mjs";
import { actionWorld, filingIn, correspond, openIn } from "./world-C.mjs";
import { actionDoc } from "./world.mjs";
import { until } from "./real.mjs";
import { naming, reach, BODY_NAME, DAYS } from "./naming.mjs";
import { open, main, text, ops, press, last, ok, W, D, DATA_PLANE, ROUTES, PLAN, PLAN_ID, DET, PROJECT, PROFILES, PROFILES_WITH_HELP, RECORDS_HELP, ACTION, ACTION_ID, FILING, FILINGS, draft, TEMPLATES, button, READER } from "./page.mjs";

const withPlan = (o) => ({ ...DATA_PLANE, plan: ok({ ...PLAN, ...o }) });
const markBtn = (p, option, disposition) => main(p).querySelectorAll('button[data-act="optiondispose"]').find((b) => b.dataset.option === option && b.dataset.disposition === disposition);

/* ---------- C53-min: choose without touching the reminder's date ---------- */

const TWO_DATES = withPlan({ options: [
  { id: "opt-1", summary: "Public comment", category: "legal", subjects: [`outcome:${DET}#STD-1`], dates: [{ date: "2026-11-30", basis: "law" }, { date: "2026-12-15", basis: "order" }], disposition: "open", dispositions: [], reminders: null, action: null },
  { id: "opt-2", summary: "Story with a reporter", category: "awareness", subjects: [`outcome:${DET}#STD-1`], dates: [{ date: "2026-12-20", basis: "law" }], disposition: "open", dispositions: [], reminders: null, action: null },
  { id: "opt-3", summary: "Write the board", category: "awareness", subjects: [`outcome:${DET}#STD-1`], dates: [], disposition: "open", dispositions: [], reminders: null, action: null }] });

test("R44 (c) (C53-min): choosing an option with a reminder day and the date list left blank succeeds: the reminder is for the option's first date; control: a date picked is the one sent, and no day sends no reminder", async () => {
  const p = await open(ROUTES.plan, { ...TWO_DATES, optiondispose: ok({}) });
  await press(p, markBtn(p, "opt-1", "chosen"), { values: { "plan-rem-on": "2026-11-27" }, reason: "worth it" });
  assert.equal(p.byOp("optiondispose").length, 1, "the choice is sent, not refused");
  assert.deepEqual(last(p, "optiondispose").body, { plan: PLAN_ID, options: ["opt-1"], disposition: "chosen", reason: "worth it",
    reminders: [{ option: "opt-1", date: "2026-11-30", on: "2026-11-27" }] });
  // control: the date she picks is the date sent
  await press(p, markBtn(p, "opt-1", "chosen"), { values: { "plan-rem-date": "opt-1|2026-12-15", "plan-rem-on": "2026-12-01" }, reason: "worth it" });
  assert.deepEqual(last(p, "optiondispose").body.reminders, [{ option: "opt-1", date: "2026-12-15", on: "2026-12-01" }]);
  // control: no day asked, no reminder sent
  await press(p, markBtn(p, "opt-1", "chosen"), { values: { "plan-rem-date": "", "plan-rem-on": "" }, reason: "worth it" });
  assert.ok(!("reminders" in last(p, "optiondispose").body));
});

test("R44 (c) (C53-min): the picked options chosen together with a day and no date each take their own first date; an option with no date takes none", async () => {
  const p = await open(ROUTES.plan, { ...TWO_DATES, optiondispose: ok({}) });
  for (const id of ["opt-1", "opt-2", "opt-3"]) await p.click(p.doc.getElementById(`pick-options-${id}`));
  const hold = main(p).querySelector(".cs-hold").querySelectorAll('button[data-act="optiondispose"]');
  await press(p, hold.find((b) => b.dataset.disposition === "chosen"), { values: { "plan-rem-on": "2026-11-27" }, reason: "all three" });
  assert.deepEqual(last(p, "optiondispose").body.reminders, [{ option: "opt-1", date: "2026-11-30", on: "2026-11-27" }, { option: "opt-2", date: "2026-12-20", on: "2026-11-27" }]);
});

/* ---------- C64-more: the office she names herself (DEC-412): two fields, drawn once, one entry per name ---------- */

const NEW = `/app/request/${PROJECT}`;
const OGIS = "Office of Government Information Services";
/* the real `entities` (naming.mjs) answers a member's naming as R65 states: a held office with the same folded name is answered with `existed: true`, otherwise
   one is registered, so naming twice meets the first entry; `page()` opens the request in the world and reaches the fold that names an office */
const namingWorld = () => {
  // no law is offered: these tests are of the names, and the real `entities` refuses a law the active profile does not hold
  const w = naming({ ...DATA_PLANE, profiles: ok({ ...PROFILES, view: { ...PROFILES.view, records_laws: [] } }) });
  return { ...w, page: async () => { const p = await open(w.path, w.plane); await reach(p, w.body, until); return p; } };
};
const officeOptions = (p) => p.doc.getElementById("req-office").querySelectorAll("option").map((o) => o.textContent.trim());

test("R20 (C64-more): an office named by its agency alone (no comma, no office within it) is drawn once; the two fields are the agency and the office within it, the entity labelled by both", async () => {
  const w = namingWorld(), { body } = w;
  const p = await w.page();
  for (const k of ["screen.request.nameoffice.name", "screen.request.nameoffice.role", "screen.request.nameoffice.role.help", "screen.request.nameoffice.why", "screen.request.nameoffice.why.help"])
    assert.ok(text(p).includes(W(k)), k);
  assert.ok(!text(p).includes(W("shell.reason")), "the note is the design's own (DEC-412), not the kit's reason field");
  await press(p, "entitycreate", { values: { ...DAYS, "req-noff-body": body, "req-noff-name": OGIS, "req-noff-note": "It answers federal records requests." } });
  await until(p, () => p.doc.getElementById("req-office"), "the office she named to be chosen");
  assert.equal(last(p, "entitycreate").body.label, OGIS, "the label is the name as typed, not split at a comma");
  assert.deepEqual(officeOptions(p), [`${OGIS}, ${BODY_NAME}`], "drawn once, never 'Office, Office': the office in its body");
  assert.ok(!text(p).includes(`${OGIS}, ${OGIS}`));
  // an agency and the office within it: both are kept, the office first as every office line draws it
  const q = await w.page();
  await press(q, "entitycreate", { values: { ...DAYS, "req-noff-body": body, "req-noff-name": "City of Oakland", "req-noff-role": "Office of the City Clerk", "req-noff-note": "It holds the council's records." } });
  await until(q, () => q.doc.getElementById("req-office"), "the office she named to be chosen");
  assert.equal(last(q, "entitycreate").body.label, "City of Oakland, Office of the City Clerk");
  assert.deepEqual(officeOptions(q), [`City of Oakland, Office of the City Clerk, ${BODY_NAME}`], "as the owner answers it: the office by its label, in its body");
  await press(q, "actioncreate", { values: { "req-what": "Council minutes", "req-office": "0" }, reason: "x" });
  const doc = last(q, "actioncreate").body.document;
  assert.ok(doc.includes('role: "City of Oakland, Office of the City Clerk"') && doc.includes(`body: "${BODY_NAME}"`));
  // control: a comma in the agency's own name is kept whole (it is no longer a separator)
  const c = await w.page();
  await press(c, "entitycreate", { values: { ...DAYS, "req-noff-body": body, "req-noff-name": "Housing, Planning and Building Department", "req-noff-note": "x" } });
  await until(c, () => c.doc.getElementById("req-office"), "the office she named to be chosen");
  assert.equal(last(c, "entitycreate").body.label, "Housing, Planning and Building Department");
  assert.deepEqual(officeOptions(c), [`Housing, Planning and Building Department, ${BODY_NAME}`]);
});

test("R20 (C64-more): naming the same office again returns the first entry, which is the one chosen; a different office within the same agency is another entry", async () => {
  const w = namingWorld(), { body } = w;
  const first = await w.page();
  await press(first, "entitycreate", { values: { ...DAYS, "req-noff-body": body, "req-noff-name": OGIS, "req-noff-note": "x" } });
  await until(first, () => first.doc.getElementById("req-office"), "the office she named to be chosen");
  await press(first, "actioncreate", { values: { "req-what": "A", "req-office": "0" }, reason: "x" });
  const firstId = /entity_id: "([^"]+)"/.exec(last(first, "actioncreate").body.document)[1];
  const again = await w.page();
  await press(again, "entitycreate", { values: { ...DAYS, "req-noff-body": body, "req-noff-name": ` ${OGIS.toUpperCase()} `, "req-noff-note": "x again" } });
  await until(again, () => again.doc.getElementById("req-office"), "the office she named to be chosen");
  assert.equal(again.byOp("entitycreate").length, 1);
  assert.deepEqual(ops(again), ["actioncreate"], "chosen at once: what is wanted is asked");
  await press(again, "actioncreate", { values: { "req-what": "B", "req-office": "0" }, reason: "x" });
  assert.equal(/entity_id: "([^"]+)"/.exec(last(again, "actioncreate").body.document)[1], firstId, "the first entry, not another");
  // control: another office within the same agency is not the first one
  const other = await w.page();
  await press(other, "entitycreate", { values: { ...DAYS, "req-noff-body": body, "req-noff-name": OGIS, "req-noff-role": "FOIA Public Liaison", "req-noff-note": "x" } });
  await until(other, () => other.doc.getElementById("req-office"), "the office she named to be chosen");
  await press(other, "actioncreate", { values: { "req-what": "C", "req-office": "0" }, reason: "x" });
  assert.notEqual(/entity_id: "([^"]+)"/.exec(last(other, "actioncreate").body.document)[1], firstId);
});

/* ---------- C64-template and C64-law: a federal request through its steps (the walker's, K4429) ---------- */

const FED = "5 U.S.C. § 552";
const FED_FIRST = "5 U.S.C. § 552(a)(6)(A)(i)";
const FED_APPEAL = "5 U.S.C. § 552(a)(6)(A)(ii)";
/* the profile as `profiles` answers it: the state's records law with its help block, the city's, and the federal Freedom of Information Act
   (`jurisdictions` R95, R96, R97: each law names its own first-request window; the federal deadlines carry their words) */
const FED_VIEW = (over = {}) => ({ ...PROFILES_WITH_HELP().view, ...over,
  records_laws: [...PROFILES.view.records_laws, { level: "federal", name: "Freedom of Information Act", citation: FED, response: "foia_response" }],
  deadlines: [...PROFILES.view.deadlines,
    { rule: "foia_response", label: "answer to a first request", applies_to: "records_request", units: "days", amount: 20, count: "business", citation: FED_FIRST },
    { rule: "foia_appeal_response", label: "decision on an appeal", applies_to: "records_request", units: "days", amount: 20, count: "business", citation: FED_APPEAL }] });
const FED_PROFILES = ok({ ...PROFILES, view: FED_VIEW() });
const lawsStated = (level, citation) => ({ state: "stated", laws: [{ level, citation }], by: "member:mai", at: "2026-10-01T09:00:00Z", stated: "x" });
const SENT_ONLY = [{ ord: 1, direction: "sent", at: "2026-10-20", medium: "portal", party: "Office of Government Information Services", author: "member:mai" }];
const FED_ACTION = { ...ACTION, addressee: { role: OGIS, body: OGIS, entity_id: "ENT-2026-9999999999999999" }, correspondence: SENT_ONLY, entries: [],
  governing_laws: lawsStated("federal", FED), governing_laws_proposals: { proposals: [] },
  clock: [{ text: "foia_response", description: "20 business days from received", date: "2026-11-19", basis: FED_FIRST, status: "pending" }] };
const fedPlane = (over = {}) => ({ ...DATA_PLANE, action: ok(FED_ACTION), profiles: FED_PROFILES, filingsfor: ok(FILINGS([])), communicationprepare: ok({ id: "FIL-2026-cccccccccccccccc", text: "x" }), ...over });
const REQUEST = `/app/request/${ACTION_ID}`;
const said = (p, key, vars) => assert.ok(text(p).includes(W(key, vars)), key);
const unsaid = (p, key, vars) => assert.ok(!text(p).includes(W(key, vars)), key);
const optionTexts = (p, id) => p.doc.getElementById(id).querySelectorAll("option").map((o) => o.textContent.replace(/\s+/g, " ").trim());

test("R4, R9 (C64-law): the law picker lists the profile's records laws, each with its own first-request window, never the deadlines; the federal law goes with its level", async () => {
  const p = await open(REQUEST, fedPlane({ actionlaws: ok({}) }));
  const texts = optionTexts(p, "req-law");
  assert.deepEqual(texts, [
    `Gov. Code § 7922.535(b) · ${W("screen.request.window.calendar", { n: "10" })}`,
    `Mun. Code § 2.20.230 · ${W("screen.request.window.business", { n: "3" })}`,
    `${FED} · ${W("screen.request.window.business", { n: "20" })}`], "records_laws, not deadlines: the appeal and the other rules are not laws");
  assert.ok(!texts.some((t) => t.includes(FED_APPEAL)));
  await press(p, "actionlaws", { values: { "req-law": "2" } });
  assert.deepEqual(last(p, "actionlaws").body, { target: ACTION_ID, laws: [{ level: "federal", citation: FED }] }, "the law's own level, not a default");
  // control: a law with no window of its own is offered by its citation alone, never with a guessed window
  const bare = await open(REQUEST, fedPlane({ profiles: ok({ ...PROFILES, view: { ...FED_VIEW(), records_laws: [{ level: "federal", name: "Freedom of Information Act", citation: FED }] } }) }));
  assert.deepEqual(optionTexts(bare, "req-law"), [FED]);
});

test("R9 (C64-law): the help for a federal request names 5 U.S.C. § 552(a)(6)(A)(i) and its 20 business days, no state or city statute and no 'the city'; control: a California request keeps its statute and window", async () => {
  const HELP = `/app/help-records/${ACTION_ID}`;
  const p = await open(HELP, fedPlane());
  const body = text(p);
  assert.ok(body.includes(FED_FIRST), "the chosen law's own citation");
  said(p, "screen.request.window.business", { n: "20" });
  assert.ok(body.includes(W("screen.help-records.must.1", { days: "20", cite: FED_FIRST })));
  for (const state of ["Gov. Code", "Mun. Code", "TRA §", RECORDS_HELP.law, "OpenDoor", "Testville Open Ordinance"]) assert.ok(!body.includes(state), `no ${state}`);
  for (const key of ["screen.help-records.portal.2", "screen.help-records.faster", "screen.help-records.faster.when"]) unsaid(p, key);
  assert.ok(!/\bcity\b/i.test(body.replace(W("screen.help-records.purpose"), "").replace(W("screen.help-records.title"), "")), "no 'the city' in the help's body");
  // control: a request under the state's law keeps the state's help, its statute and its window
  const ca = await open(HELP, fedPlane({ action: ok({ ...FED_ACTION, governing_laws: lawsStated("state", "Gov. Code § 7922.535(b)") }) }));
  assert.ok(text(ca).includes(W("screen.help-records.must.1", { days: String(RECORDS_HELP.days), cite: RECORDS_HELP.citations.answer })));
  assert.ok(text(ca).includes("TRA § 2"));
  // control: opened for no action (no law is chosen) it is the place's help as before
  const plain = await open("/app/help-records", fedPlane());
  assert.ok(text(plain).includes(W("screen.help-records.must.1", { days: String(RECORDS_HELP.days), cite: RECORDS_HELP.citations.answer })));
});

test("R9 (C64-law): the request page's help link carries the action, so the help is for the law chosen", async () => {
  const p = await open(REQUEST, fedPlane());
  assert.ok(main(p).querySelector(`a[href="/app/help-records/${ACTION_ID}"]`), "the link names the action");
});

const APPROVED = FILINGS([draft({ approval: { approved_by: "member:mai", at: "x", sha: "s" } })]);

test("R9 (C64-law): the send step and the reply form say nothing of 'the city' for a federal request; control: the state's law and an undetermined law keep their wording", async () => {
  const fed = await open(REQUEST, fedPlane({ filingsfor: ok(APPROVED) }));
  unsaid(fed, "screen.request.howsend.3");
  said(fed, "screen.request.howsend.4");
  const act = await open(`/app/action/${ACTION_ID}`, fedPlane());
  const mediums = optionTexts(act, "reply-medium");
  assert.ok(!mediums.includes(W("screen.action.reply.medium.portal")), "not 'The city's portal'");
  assert.ok(mediums.includes("portal"), "the vocabulary's own token stands in for the portal");
  for (const [law, drawn] of [[lawsStated("state", "Gov. Code § 7922.535(b)"), true], [lawsStated("city", "Mun. Code § 2.20.230"), true], [{ state: "undetermined" }, true]]) {
    const q = await open(REQUEST, fedPlane({ action: ok({ ...FED_ACTION, governing_laws: law }), filingsfor: ok(APPROVED) }));
    assert.equal(text(q).includes(W("screen.request.howsend.3")), drawn, JSON.stringify(law));
    const r = await open(`/app/action/${ACTION_ID}`, fedPlane({ action: ok({ ...FED_ACTION, governing_laws: law }) }));
    assert.ok(optionTexts(r, "reply-medium").includes(W("screen.action.reply.medium.portal")), JSON.stringify(law));
  }
});

test("R9 (C64-law): the action's due dates name the kind in the profile's words, never a rule's code; an entry with no words of the profile's is not drawn as a code", async () => {
  const p = await open(`/app/action/${ACTION_ID}`, fedPlane());
  said(p, "screen.action.clock.pending");
  assert.ok(text(p).includes("answer to a first request"), "the profile's label for foia_response");
  assert.ok(!text(p).includes("foia_response"), "no raw code");
  // a rule the profile gives no label: the entry's own description stands in, never the code
  const nolabel = await open(`/app/action/${ACTION_ID}`, fedPlane({ profiles: ok({ ...PROFILES, view: { ...FED_VIEW(), deadlines: FED_VIEW().deadlines.map(({ label, ...d }) => d) } }) }));
  assert.ok(!text(nolabel).includes("foia_response"));
  assert.ok(text(nolabel).includes("20 business days from received"));
  // control: an entry whose text is not a rule (a member's own) is drawn as written
  const own = await open(`/app/action/${ACTION_ID}`, fedPlane({ action: ok({ ...FED_ACTION, clock: [{ text: "Reply to the clerk", description: "x", date: "2026-11-19", basis: "our note", status: "pending" }] }) }));
  assert.ok(text(own).includes("Reply to the clerk"));
});

test("R3, R8 (C64-template): a typed plain request prepares: the period, form and cost are sent only where the text names those blanks; control: a text naming all three sends all three", async () => {
  const p = await open(REQUEST, fedPlane());
  const boxes = { "req-from": "2025-01-01", "req-to": "2025-12-31", "req-form": "pdf", "req-cost": "$25" };
  await press(p, "communicationprepare", { values: { ...boxes, "send-text-0": "Please send me the inspection logs for the Oakland field office." }, reason: "ready" });
  assert.equal(p.byOp("communicationprepare").length, 1, "prepared, not refused in place");
  assert.ok(!("fills" in last(p, "communicationprepare").body), "no blank the text has: no fills");
  const named = await open(REQUEST, fedPlane());
  await press(named, "communicationprepare", { values: { ...boxes, "send-text-0": "Records for {{period}} in {{ form }}, up to {{cost_limit}}: the inspection logs." }, reason: "ready" });
  assert.deepEqual(last(named, "communicationprepare").body.fills, { period: "2025-01-01 – 2025-12-31", form: "pdf", cost_limit: "$25" });
  const some = await open(REQUEST, fedPlane());
  await press(some, "communicationprepare", { values: { ...boxes, "send-text-0": "Records for {{period}}: the inspection logs." }, reason: "ready" });
  assert.deepEqual(last(some, "communicationprepare").body.fills, { period: "2025-01-01 – 2025-12-31" }, "only the blank the text names");
  // control: no text is still asked for
  const empty = await open(REQUEST, fedPlane());
  await press(empty, "communicationprepare", { values: boxes, reason: "ready" });
  assert.equal(empty.byOp("communicationprepare").length, 0);
  said(empty, "screen.start-send.text.needed");
});

test("R3, R8 (C64-template): when the kind holds no template the request says so in words and never 'Drafted from your team's template'; control: with a template offered it says that", async () => {
  const none = await open(REQUEST, fedPlane({ templatesforaction: ok({ ...TEMPLATES, versions: [] }) }));
  said(none, "screen.start-send.text.help");
  unsaid(none, "screen.request.text.help");
  const read = await open(REQUEST, fedPlane({ templatesforaction: ok({ ...TEMPLATES, versions: [], court_petition: true }) }));
  unsaid(read, "screen.request.text.help");
  const offered = await open(REQUEST, fedPlane({ templatesforaction: ok(TEMPLATES) }));
  said(offered, "screen.request.text.help");
  // a template that cannot be read is never claimed: over the real store, an action that is not there is refused by `action` and by `templatesforaction` alike (filings R65's one gate)
  const { world, me } = await actionWorld();
  const absent = await openIn(world, me, `/app/request/${ACTION_ID}`);
  await assert.rejects(me.read("templatesforaction", { query: { action: ACTION_ID } }), /NO_SUCH_ACTION/, "the owner refuses");
  unsaid(absent, "screen.request.text.help");
});

test("R16, R54, R4 (C64-law): 'Change the law…' on a records request lists the records laws and sends the chosen law's own level; a law that states no level asks for one; control: other kinds list their deadlines' laws as before", async () => {
  const p = await open(`/app/action/${ACTION_ID}`, fedPlane({ actionlaws: ok({}) }));
  assert.deepEqual(p.doc.getElementById("law-pick").querySelectorAll("option").map((o) => o.value), ["Gov. Code § 7922.535(b)", "Mun. Code § 2.20.230", FED], "records_laws, not the appeal's or any other rule's citation");
  assert.equal(p.doc.getElementById("law-level"), null, "every law states its level: none is asked");
  await press(p, "actionlaws", { values: { "law-pick": "Mun. Code § 2.20.230" } });
  assert.deepEqual(last(p, "actionlaws").body.laws, [{ level: "city", citation: "Mun. Code § 2.20.230" }]);
  const plain = await open(`/app/action/${ACTION_ID}`, fedPlane({ actionlaws: ok({}), profiles: ok({ ...PROFILES, view: { ...FED_VIEW(), records_laws: [{ citation: "Mun. Code § 2.20.230", response: "immediate_disclosure" }] } }) }));
  assert.ok(plain.doc.getElementById("law-level"), "a law that states no level: the member's choice");
  await press(plain, "actionlaws", { values: { "law-pick": "Mun. Code § 2.20.230", "law-level": "county" } });
  assert.deepEqual(last(plain, "actionlaws").body.laws, [{ level: "county", citation: "Mun. Code § 2.20.230" }]);
  const other = await open(`/app/action/${ACTION_ID}`, fedPlane({ action: ok({ ...FED_ACTION, kind: "public_comment" }), profiles: ok({ ...PROFILES, view: { ...FED_VIEW(), deadlines: [...FED_VIEW().deadlines, { rule: "agenda", applies_to: "public_comment", amount: 72, citation: "Open meetings law" }] } }) }));
  assert.deepEqual(other.doc.getElementById("law-pick").querySelectorAll("option").map((o) => o.value), ["Open meetings law"]);
});

/* ---------- C65: "Keep this filing as your team's template" is reachable once the request was sent and answered ---------- */

/** An action in a project of its own, with the reply the office gave (`actioncorrespond`), over the real store. */
async function answeredWorld(o = {}) {
  const w = await actionWorld(o);
  await correspond(w.me, w.action, "received", { at: "2026-10-28", account: "They sent the logs." });
  return w;
}

test("R43, R48, R59 (C65; DEC-439 E H2): a request prepared, approved, sent and answered offers the way to keep its filing as the team's template: the action draws the reference, it opens `start-send`, which draws the form; control: an unsent action and an action with no filing do not", async () => {
  const { world, me, project, action } = await actionWorld();
  const req = await openIn(world, me, `/app/request/${action}`);
  await press(req, "communicationprepare", { values: { "send-text-0": "Please send me the logs." }, reason: "ready" });
  await press(req, "filingapprove", { reason: "ready", confirm: true });
  await press(req, "filingrecordsent", { values: { "send-at": "2026-10-20", "send-account": "through the portal", "send-reference": "26-0001" }, reason: "sent" });
  said(req, "screen.start-send.sent", { date: D("2026-10-20") });
  said(req, "screen.start-send.sent.next");
  assert.equal(ops(req).includes("templatesave"), false, "the request page itself draws no template act (the registry lists it on start-send alone)");
  const [kept] = (await me.read("filingsfor", { query: { action } })).drafts;
  assert.equal(kept.sending.reference, "26-0001", "the store holds the filing as sent");
  await correspond(me, action, "received", { at: "2026-10-28", account: "They sent the logs." });
  // the member returns to the action after the answer came
  const act = await openIn(world, me, `/app/action/${action}`);
  const door = main(act).querySelector(`a[href="/app/start-send/${action}"]`);
  assert.ok(door, "the action draws a reference to start-send for a sent filing");
  assert.ok(door.textContent.includes(W("screen.start-send.template.heading")), "worded 'Keep this filing as your team's template'");
  assert.equal(main(act).querySelector('[data-list="start-send"]'), null, "not the card of an action still to be prepared");
  const send = await openIn(world, me, `/app/start-send/${action}`);
  assert.ok(button(send, "templatesave"), "start-send draws the form for a sent filing");
  await press(send, "templatesave", { values: { "template-name": "A federal records request", "template-use": "file" }, reason: "keep" });
  assert.deepEqual({ ...last(send, "templatesave").body, reason: undefined }, { filing: kept.filing, name: "A federal records request", use: "file", project, reason: undefined });
  assert.equal(send.byOp("templatesave").length, 1);
  // control: an action not sent draws the door to prepare a text and not this one
  const other = await me.act("actioncreate", { body: { document: actionDoc(project, { title: "Another request" }), project } });
  const unsent = await openIn(world, me, `/app/action/${other.id}`);
  assert.ok(main(unsent).querySelector('[data-list="start-send"]'), "the card to prepare");
  assert.ok(!text(unsent).includes(W("screen.start-send.template.heading")));
  // control: an action sent with no filing (a direct sending) has nothing to keep
  await correspond(me, other.id, "sent");
  const direct = await openIn(world, me, `/app/action/${other.id}`);
  assert.equal(main(direct).querySelector(`a[href="/app/start-send/${other.id}"]`), null);
});

test("R27, R43, R48 (C65): a member who may read and not act is shown no way to keep the filing as a template (the control is an act); control: a member who may act is", async () => {
  const { world, me, action } = await answeredWorld({ admin: false, capabilities: ["contribute", "create_projects"] });
  await filingIn(me, action, { sent: true, at: "2026-10-20" });
  const member = await openIn(world, me, `/app/action/${action}`);
  assert.ok(main(member).querySelector(`a[href="/app/start-send/${action}"]`));
  const founder = await world.signIn(WORLD_FOUNDER_HANDLE);
  await founder.act("membercaps", { body: { memberId: me.handle, capabilities: [] } });
  const reader = await openIn(world, me, `/app/action/${action}`);
  assert.equal(main(reader).querySelector(`a[href="/app/start-send/${action}"]`), null);
});
