/* screens-action's T51 fix round (FR-31) on `request`: R39 (which name the records concern is asked first; `addresseesuggest` is sent that
   name, never the project) and R46 (a request that knows no office points to the organization's page where its records lines are kept).
   Every request is checked against its owner's declaration by the harness. */
import test from "node:test";
import assert from "node:assert/strict";
import { actionWorld, entityOf, officeFor, openIn } from "./world-C.mjs";
import { SCREENS, open, main, text, ops, press, last, ok, W, hasWord, DATA_PLANE, PROJECT } from "./page.mjs";
import { DECLARED_FIELDS } from "./declared.mjs";

const NEW = `/app/request/${PROJECT}`;
const SUBJECT = "ENT-2026-2222222222222222";
const NAMES = { rows: [{ entity: "ENT-2026-1111111111111111", kind: "organisation", name: "Public Works" }, { entity: SUBJECT, kind: "office", name: "Pothole repair program" }], truncated: false };
const OFFICES = { ok: true, subject: SUBJECT, offices: [{ addressee: { state: "named", kind: "office", role: "City Clerk", body: "Office of the City Clerk", entity_id: "ENT-1" } }], suggestion: true };

test("R39: a request opened for a project sends no `addresseesuggest` with the project's id, asks which name it concerns first, and after the pick sends that id; the offices are then drawn", async () => {
  const p = await open(NEW, { ...DATA_PLANE, peopledirectory: ok(NAMES), addresseesuggest: ok(OFFICES) });
  assert.equal(p.byOp("addresseesuggest").length, 0, "nothing is asked with the project's id on load");
  assert.ok(text(p).includes(W("screen.request.subject.label")) && text(p).includes(W("screen.request.subject.help")), "which name it concerns is asked first");
  assert.deepEqual(ops(p), ["addresseesuggest"], "only the ask is drawn before a name is picked");
  assert.equal(p.doc.getElementById("req-office"), null, "no office before the ask is answered");
  // control: pressing with no name picked sends nothing
  await press(p, "addresseesuggest", { values: { "req-subject": "" } });
  assert.equal(p.byOp("addresseesuggest").length, 0, "no name, no ask");
  await press(p, "addresseesuggest", { values: { "req-subject": SUBJECT } });
  const sent = p.byOp("addresseesuggest");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].query.subject, SUBJECT, "the name she picked");
  assert.notEqual(sent[0].query.subject, PROJECT);
  for (const name of Object.keys(sent[0].query).filter((k) => k !== "op")) assert.ok(DECLARED_FIELDS("addresseesuggest").includes(name), `${name} is declared`);
  assert.match(text(p), /City Clerk, Office of the City Clerk/, "the offices the record holds for that name are drawn");
  assert.ok(p.doc.getElementById("req-office"));
});

test("R46: a records request that knows no office points to the organization's page; with offices none; a request opened with no name known to ask about draws no pointer", async () => {
  const { world, me, project } = await actionWorld();
  const at = `/app/request/${project}`;
  // a project whose record follows no name has none to ask about
  const nameless = await openIn(world, me, at);
  assert.equal(main(nameless).querySelector('[data-list="person"]'), null, "control: no name picked, no page to point to");
  await entityOf(me, "institution", "Public Works");
  const subject = await entityOf(me, "person", "Pothole repair program");
  const p = await openIn(world, me, at);
  assert.equal(main(p).querySelector('[data-list="person"]'), null, "nothing is pointed to before an office is known to be missing");
  await press(p, "addresseesuggest", { values: { "req-subject": subject } });
  const link = main(p).querySelector('[data-list="person"] a[data-screen="person"]');
  assert.ok(link, "the reference");
  assert.equal(link.getAttribute("href"), `/app/person/${encodeURIComponent(subject)}`);
  assert.equal(link.textContent.trim(), W("screen.person.name"));
  // R74 (T53): the pointer reads as one sentence: where to go and what to add there
  for (const k of ["screen.request.nooffice.pointer.people", "screen.person.purpose"]) assert.ok(text(p).includes(W(k)), k);
  assert.deepEqual((await me.read("addresseesuggest", { query: { subject } })).offices, [], "the store holds no office for that name");
  await officeFor(me, subject, "City Clerk", "Office of the City Clerk");
  const known = await openIn(world, me, at);
  await press(known, "addresseesuggest", { values: { "req-subject": subject } });
  assert.equal(main(known).querySelector('[data-list="person"]'), null, "control: with offices none");
});

test("R39, R46 (R19): each key the new lines name is a word of setup-words, on the screen that draws it", () => {
  const words = new Set(SCREENS.find((s) => s.id === "request").words);
  for (const k of ["screen.request.subject.label", "screen.request.subject.help", "screen.request.nooffice.pointer.people", "screen.person.name", "screen.person.purpose"]) {
    assert.ok(hasWord(k), `${k} is a word`);
    assert.ok(words.has(k), `request reads ${k}`);
  }
});
