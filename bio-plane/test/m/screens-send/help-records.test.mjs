/* screens-send R9, R22 on `help-records`: how a records request works, reached from `request`: what the office must do (filled from the
 * profile's `records_help` block, every fill answered or the sentence not drawn), the faster request, what a portal shows, what the team's
 * Civicsmith does with the due date and the sources; opened for an action, the help is for the law that action goes under. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { open, text, ops, drew, main, ok, ACT, FILINGS, DRAFT, PROJECT, word, norm } from "./kit.mjs";

const AID = "ACTN-2026-bbbbbbbbbbbbbbbb";
const HELP = "/app/help-records";
const FED = "5 U.S.C. § 552";
const FED_FIRST = "5 U.S.C. § 552(a)(6)(A)(i)";
/** The test profile's `records_help` block (`jurisdictions` R93). */
const BLOCK = { law: "Testland Records Act", days: 7, extra_days: 9, status: "researched", basis: "TEST",
  extension_reasons: [{ reason: "the records are kept elsewhere", citation: "TRA § 4(a)" }, { reason: "a very large volume", citation: "TRA § 4(b)" }],
  portal: { name: "OpenDoor", url: "https://records.testville.example" },
  faster: { ordinance: "Testville Open Ordinance", window: "two business days", request: "quick request", citation: "TOO § 1" },
  citations: { answer: "TRA § 1", extend: "TRA § 2", assist: "TRA § 3", segregate: "TRA § 5", refuse_in_writing: "TRA § 6", electronic: "TRA § 7",
    cost: "TRA § 8", cost_electronic: "TRA § 9", inspect_photograph: "TRA § 10", purpose: "TRA § 11" } };
const DEADLINES = [
  { rule: "records_response", applies_to: "records_request", units: "days", amount: 10, count: "calendar", citation: "Gov. Code § 7922.535(b)", extension: { days: 14, citation: "Gov. Code § 7922.535(c)" } },
  { rule: "immediate_disclosure", applies_to: "records_request", units: "days", amount: 3, count: "business", citation: "Mun. Code § 2.20.230" },
  { rule: "foia_response", applies_to: "records_request", units: "days", amount: 20, count: "business", citation: FED_FIRST },
  { rule: "meeting_notice", applies_to: "comment", amount: 72, count: "calendar", citation: "Open meetings law" }];
const LAWS = [
  { level: "state", name: "Testland Records Act", citation: "Gov. Code § 7922.535(b)", response: "records_response" },
  { level: "city", name: "Testville Sunshine Ordinance", citation: "Mun. Code § 2.20.230", response: "immediate_disclosure" },
  { level: "federal", name: "Freedom of Information Act", citation: FED, response: "foia_response" }];
/** `profiles` with its view; `view` over it. */
const PROFILES = (view = {}) => ok({ profiles: [{ id: "p", name: "p", covers: [] }], conflicts: [], choices: [], stage_findings: [],
  view: { name: "Testville", deadlines: DEADLINES, records_laws: LAWS, ...view } });
const WITH = (block = BLOCK, view = {}) => PROFILES({ records_help: block, ...view });
const stated = (level, citation) => ({ state: "stated", laws: [{ level, citation }], by: "member:mai", at: "2026-10-01T09:00:00Z" });
const REQ = (laws) => ok(ACT({ id: AID, kind: "records_request", project: PROJECT, addressee: { role: "FOIA Office", body: "Office of Government Information Services", entity_id: "ENT-9" }, governing_laws: laws }));
const FILLS = {
  1: { days: "7", cite: "TRA § 1" },
  2: { reasons: "the records are kept elsewhere, a very large volume", extra: "9", cite: "TRA § 2" },
  3: { cite: "TRA § 3" }, 4: { cite: "TRA § 5", cite2: "TRA § 6" }, 5: { cite: "TRA § 7" },
  6: { cite: "TRA § 8", cite2: "TRA § 9", cite3: "TRA § 10" }, 7: { cite: "TRA § 11" },
};
/** A sentence is drawn, whole or in part: any stretch of its words between its fills is on the page. */
const HOLE = new Proxy({}, { get: (t, k) => (typeof k === "string" ? "\u0001" : undefined), has: () => true,
  getOwnPropertyDescriptor: () => ({ value: "\u0001", configurable: true, enumerable: true, writable: true }) });
const part = (p, key) => word(key, HOLE).split("\u0001").map(norm).filter((x) => x.length > 8).some((x) => text(p).includes(x));
const section = (p, key) => main(p).querySelectorAll("section.cs-section").find((s) => norm(s.textContent).includes(norm(word(key))));

/* ---------- R9: what the office must do, the faster request, the portal, the due date, the sources ---------- */

test("R9: reads the profile once and draws what the office must do from the response period, the faster request, what a portal shows, what Civicsmith does with the due date, and the sources; it offers no act", async () => {
  const p = await open(HELP, { plane: { profiles: PROFILES() } });
  assert.equal(p.byOp("profiles").length, 1);
  assert.equal(p.byOp("action").length, 0, "opened for no action, no action is read");
  assert.ok(drew(p, "screen.help-records.must"));
  assert.ok(drew(p, "screen.help-records.must.1", { days: "10", cite: "Gov. Code § 7922.535(b)" }));
  assert.ok(drew(p, "screen.help-records.faster") && drew(p, "screen.help-records.faster.when"));
  assert.ok(text(p).includes(`Mun. Code § 2.20.230 · ${norm(word("screen.request.window.business", { n: "3" }))}`));
  assert.ok(drew(p, "screen.help-records.thefaster"));
  assert.ok(drew(p, "screen.help-records.portal"));
  for (const n of [1, 2, 3]) assert.ok(drew(p, `screen.help-records.portal.${n}`), `portal.${n}`);
  assert.ok(drew(p, "screen.help-records.does") && drew(p, "screen.help-records.does.text"));
  const src = text(p, section(p, "screen.help-records.sources"));
  for (const c of ["Gov. Code § 7922.535(b)", "Gov. Code § 7922.535(c)", "Mun. Code § 2.20.230"]) assert.ok(src.includes(c), c);
  assert.ok(!text(p).includes("Open meetings law"), "only the records request's laws");
  assert.doesNotMatch(text(p), /\{\w+\}/, "no sentence drawn short");
  assert.deepEqual(ops(p), []);
});

test("R9: control: a profile naming no records law draws no must, faster or sources section, and still says what a portal shows and what Civicsmith does", async () => {
  const p = await open(HELP, { plane: { profiles: PROFILES({ deadlines: [], records_laws: [] }) } });
  for (const k of ["screen.help-records.must", "screen.help-records.faster", "screen.help-records.sources"]) assert.ok(!drew(p, k), k);
  assert.ok(drew(p, "screen.help-records.portal") && drew(p, "screen.help-records.does"));
});

test("R9: for a federal request the help names 5 U.S.C. § 552(a)(6)(A)(i) and its 20 business days, and no state or city statute and no 'the city'", async () => {
  const p = await open(`${HELP}/${AID}`, { plane: { profiles: WITH(), action: REQ(stated("federal", FED)) } });
  assert.deepEqual(p.byOp("action").map((r) => r.query.id), [AID], "the action's law is read");
  assert.ok(drew(p, "screen.help-records.must.1", { days: "20", cite: FED_FIRST }));
  assert.ok(drew(p, "screen.request.window.business", { n: "20" }));
  const src = text(p, section(p, "screen.help-records.sources"));
  assert.ok(src.includes(FED) && src.includes(FED_FIRST));
  for (const other of ["Gov. Code", "Mun. Code", "TRA §", BLOCK.law, "OpenDoor", "Testville Open Ordinance"]) assert.ok(!text(p).includes(other), `no ${other}`);
  for (const k of ["screen.help-records.portal.2", "screen.help-records.faster", "screen.help-records.faster.when", "screen.help-records.notheld"]) assert.ok(!drew(p, k), k);
  for (const k of ["screen.help-records.sub", "screen.help-records.faster.what", "screen.help-records.portal.where"]) assert.ok(!part(p, k), k);
  const body = text(p).replace(norm(word("screen.help-records.title")), "");
  assert.ok(!/\bthe city\b/i.test(body), "no 'the city'");
  assert.ok(drew(p, "screen.help-records.does.text"));
});

test("R9: control: a California request keeps the place's block, its statute and window; opened for no action, the place's help as before", async () => {
  const ca = await open(`${HELP}/${AID}`, { plane: { profiles: WITH(), action: REQ(stated("state", "Gov. Code § 7922.535(b)")) } });
  assert.ok(drew(ca, "screen.help-records.must.1", FILLS[1]));
  assert.ok(drew(ca, "screen.help-records.must.2", FILLS[2]));
  assert.ok(drew(ca, "screen.help-records.sub", { law: BLOCK.law, place: "Testville" }));
  const plain = await open(HELP, { plane: { profiles: WITH() } });
  assert.ok(drew(plain, "screen.help-records.must.1", FILLS[1]));
});

test("R9: an action with a law the profile does not list, or none stated, is helped by the place's block, never by a guessed law", async () => {
  for (const laws of [stated("state", "Repealed Act § 9"), { state: "undetermined", laws: [] }]) {
    const p = await open(`${HELP}/${AID}`, { plane: { profiles: WITH(), action: REQ(laws) } });
    assert.ok(drew(p, "screen.help-records.must.1", FILLS[1]));
    assert.ok(!text(p).includes("Repealed Act"));
  }
});

test("R9: the send step of a federal request leaves out the city's sentence; control: a request under the state's law keeps it", async () => {
  const approved = FILINGS([DRAFT({ approval: { approved_by: "member:mai", at: "2026-11-02T11:00:00Z", sha: "s" } })]);
  const fed = await open(`/app/request/${AID}`, { plane: { profiles: WITH(), action: REQ(stated("federal", FED)), filingsfor: ok(approved) } });
  assert.ok(drew(fed, "screen.request.howsend.4"));
  assert.ok(!part(fed, "screen.request.howsend.3"), "no 'the city can't send you updates'");
  const ca = await open(`/app/request/${AID}`, { plane: { profiles: WITH(), action: REQ(stated("state", "Gov. Code § 7922.535(b)")), filingsfor: ok(approved) } });
  assert.ok(drew(ca, "screen.request.howsend.3"));
});

/* ---------- R22: the records help is filled from the profile ---------- */

test("R22: the test profile's block fills each must sentence, the sub-line, the faster request and the portal, and its sources list the block's citations and the portal's address", async () => {
  const p = await open(HELP, { plane: { profiles: WITH() } });
  for (const n of [1, 2, 3, 4, 5, 6, 7]) assert.ok(drew(p, `screen.help-records.must.${n}`, FILLS[n]), `must.${n}`);
  assert.ok(drew(p, "screen.help-records.sub", { law: "Testland Records Act", place: "Testville" }));
  assert.ok(drew(p, "screen.help-records.faster.what", { place: "Testville", ordinance: "Testville Open Ordinance", request: "quick request", window: "two business days", cite: "TOO § 1" }));
  assert.ok(drew(p, "screen.help-records.portal.where", { place: "Testville", portal: "OpenDoor" }));
  assert.ok(!drew(p, "screen.help-records.notheld"));
  assert.doesNotMatch(text(p), /\{\w+\}/);
  const src = text(p, section(p, "screen.help-records.sources"));
  for (const c of ["TRA § 1", "TRA § 2", "TRA § 3", "TRA § 4(a)", "TRA § 4(b)", "TRA § 5", "TRA § 6", "TRA § 7", "TRA § 8", "TRA § 9", "TRA § 10", "TRA § 11", "TOO § 1", "https://records.testville.example"])
    assert.ok(src.includes(c), `a source: ${c}`);
  assert.deepEqual(ops(p), []);
});

test("R22: a profile with no records help draws none of those sentences and says so", async () => {
  const p = await open(HELP, { plane: { profiles: PROFILES() } });
  assert.ok(drew(p, "screen.help-records.notheld"));
  for (const k of ["must.2", "must.3", "must.4", "must.5", "must.6", "must.7", "sub", "faster.what", "portal.where"]) assert.ok(!part(p, `screen.help-records.${k}`), k);
  const bare = await open(HELP, { plane: { profiles: PROFILES({ deadlines: [], records_laws: [] }) } });
  assert.ok(drew(bare, "screen.help-records.notheld"));
  assert.ok(!part(bare, "screen.help-records.must.1"));
});

test("R22: control: a block missing a field leaves that sentence out, never blank, and the others are still drawn", async () => {
  const cut = (f) => { const h = structuredClone(BLOCK); f(h); return h; };
  const cases = [
    [(h) => delete h.citations.segregate, "must.4"], [(h) => delete h.citations.refuse_in_writing, "must.4"], [(h) => delete h.citations.extend, "must.2"],
    [(h) => delete h.extra_days, "must.2"], [(h) => { h.extension_reasons = []; }, "must.2"], [(h) => delete h.citations.assist, "must.3"],
    [(h) => delete h.citations.electronic, "must.5"], [(h) => delete h.citations.cost_electronic, "must.6"], [(h) => delete h.citations.purpose, "must.7"],
    [(h) => delete h.law, "sub"], [(h) => delete h.faster.window, "faster.what"], [(h) => delete h.faster, "faster.what"],
    [(h) => delete h.portal.name, "portal.where"], [(h) => delete h.portal, "portal.where"]];
  const all = ["must.1", "must.2", "must.3", "must.4", "must.5", "must.6", "must.7", "sub", "faster.what", "portal.where"];
  for (const [f, gone] of cases) {
    const p = await open(HELP, { plane: { profiles: WITH(cut(f)) } });
    assert.ok(!part(p, `screen.help-records.${gone}`), `${gone} is left out`);
    assert.doesNotMatch(text(p), /\{\w+\}/, `${gone}: never blank`);
    for (const other of all.filter((x) => x !== gone)) assert.ok(part(p, `screen.help-records.${other}`), `${gone} cut: ${other} still drawn`);
  }
  const noPlace = await open(HELP, { plane: { profiles: WITH(BLOCK, { name: undefined }) } });
  for (const k of ["sub", "faster.what", "portal.where"]) assert.ok(!part(noPlace, `screen.help-records.${k}`), `no place: ${k} left out`);
  assert.ok(drew(noPlace, "screen.help-records.must.1", FILLS[1]));
});
