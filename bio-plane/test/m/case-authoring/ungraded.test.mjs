/* case-authoring R88, R89, R90 (T53; DEC-461; K5548): the passages a case would be signed with that the team has not
   graded. R88: the pre-flight's sign step lists them (`ungraded_passages: {rows, count}`), never a blocker. R89: the
   document states them (`ungraded_passages:` block) and carries the one fixed body sentence, from the same rows. R90: an
   ungraded passage never refuses the act. Driven through the real `publishCase` and `publishPreflight`, the rows read by
   the real `case-disclosures` (its R35) over the real strength and inquiry. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V } from "./fixture.mjs";
import { ungradedPassagesOf } from "../../../src/case-grammar/index.mjs";
import { UNGRADED_BODY_KEY } from "../../../src/case-disclosures/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { caseFile, SOURCE, CASE } from "../case-import/fixture.mjs";

const D1 = "INFO-2026-0001-a", D2 = "INFO-2026-0002-b", D3 = "INFO-2026-0003-c";
const Q = "INQ-2026-0001-q", F = "INQ-2026-0002-f", THEIRS = "INQ-2026-0001-transfers";
const GRADED = { grade: "B", grade_axis: "capture", grade_source: "capture" };
const HUNCH = { grade: "B", grade_axis: "connection", grade_source: "hunch", author: "member:alice", date: "2026-09-27" };
const PAIR = { capture: { state: "graded", grade: "B" }, connection: { state: "graded", grade: "C" } };
const SENTENCE = () => word(UNGRADED_BODY_KEY);

/* Q rests on D1 and D2, F on D3; `graded` names the documents whose leg carries a member's grade; `hunch` makes F's leg a
   hunch. A grade is given later by revising Q (`regrade`). */
function setup({ graded = [], hunch = false } = {}) {
  const w = world(); w.member("alice");
  for (const d of [D1, D2, D3]) w.doc(d);
  const leg = (d) => ({ target: d, ...(graded.includes(d) ? GRADED : {}) });
  w.finding(Q, [leg(D1), leg(D2)]);
  w.finding(F, [hunch ? { target: D3, ...HUNCH } : leg(D3)]);
  const P = w.project("Team", "alice", [Q, F]);
  return { w, P, targets: [Q, F] };
}
const args = (x, over = {}) => ({ scope: "s", statement: "It does not cover the amendments.", subjectPosition: "not_sought",
  subjectJustification: "A public record.", biasAcknowledgement: "We read the minutes as the account.", excluded: [],
  project: x.P, targets: x.targets, roles: Object.fromEntries(x.targets.map((t) => [t, "load_bearing"])),
  viewer: V("alice"), author: "alice", tieAttested: true, ...over });
const sign = (pre) => pre.steps.find((s) => s.name === "sign");
const docOf = (w, r) => w.row(`SELECT text FROM case_documents WHERE case_id=? AND edition=?`, r.caseId, r.edition).text;
const regrade = (x, graded) => {
  const leg = (d) => ({ target: d, ...(graded.includes(d) ? GRADED : {}) });
  x.w.finding(Q, [leg(D1), leg(D2)]);
};

/* ----------------------------------------------------------------------------------------------- R88 */

test("R88 (T53; DEC-461): the sign step lists every passage still ungraded — three over two findings, roster then passage order, each with its finding, number, title and role, count 3; grading one and looking again lists two; ready and first are the same with and without rows", () => {
  const x = setup();
  const pre = x.w.ca.publishPreflight(args(x));
  const u = sign(pre).ungraded_passages;
  assert.equal(u.count, 3, JSON.stringify(u).slice(0, 400));
  assert.deepEqual(u.rows.map((r) => [r.finding, r.ord]), [[Q, 0], [Q, 1], [F, 0]]);
  for (const r of u.rows) {
    assert.deepEqual(Object.keys(r).sort(), ["finding", "ord", "role", "title"]);
    assert.ok(r.title === null || (typeof r.title === "string" && r.title.length), "a title, or null");
    assert.equal(r.role, "supports");
  }
  assert.ok(!pre.blockers.some((b) => /UNGRADED/.test(String(b.reason))), "never a blocker");
  assert.ok(!pre.first || !/UNGRADED/.test(String(pre.first.reason)), "never first");
  /* graded, D1's leg is no longer listed (a world where Q's revision gave it a grade before the look: a revision after
     a rolled-back pre-flight is refused by this fixture's retrieval stand-in, which holds no projection table) */
  const g = setup();
  regrade(g, [D1]);
  const again = g.w.ca.publishPreflight(args(g));
  assert.deepEqual(sign(again).ungraded_passages.rows.map((r) => [r.finding, r.ord]), [[Q, 1], [F, 0]]);
  assert.equal(sign(again).ungraded_passages.count, 2);
  /* ready and first equal with and without rows */
  const y = setup({ graded: [D1, D2, D3] });
  const none = y.w.ca.publishPreflight(args(y));
  assert.equal(sign(none).ungraded_passages.count, 0);
  assert.deepEqual([none.ready, none.first, none.blockers.map((b) => b.reason)],
                   [pre.ready, pre.first, pre.blockers.map((b) => b.reason)]);
});

test("R88 (control): all graded answers no rows and count 0; a hunch leg is not listed; the list writes nothing", () => {
  const x = setup({ graded: [D1, D2, D3] });
  const before = x.w.snapshot();
  const pre = x.w.ca.publishPreflight(args(x));
  assert.deepEqual(x.w.snapshot(), before, "nothing written");
  assert.deepEqual(sign(pre).ungraded_passages, { rows: [], count: 0 });
  /* a hunch leg refuses the act first (hunch debt, case-disclosures R16), and the list states it was not reached: it never
     lists the hunch leg */
  const h = setup({ graded: [D1, D2], hunch: true });
  const hp = h.w.ca.publishPreflight(args(h));
  assert.equal(hp.first.reason, "UNCLEARED_HUNCH");
  assert.equal(typeof sign(hp).ungraded_passages.stated, "string");
  assert.equal("rows" in sign(hp).ungraded_passages, false, "a hunch leg is not listed");
});

test("R88 (control): an imported finding adds no row — another group graded it", async () => {
  const w = world({ realImports: true });
  for (const m of ["alice", "bob"]) w.member(m);
  w.doc(D1);
  Object.assign(w.checks, { group: SOURCE, case: CASE, edition: 1, findings: [{ finding: THEIRS, pair: PAIR }] });
  const imp = await w.imports.importCaseFile({ parts: caseFile({ findings: [THEIRS] }).parts, by: V("alice"), viewer: V("alice") });
  assert.equal(imp.ok, true, JSON.stringify(imp).slice(0, 300));
  const acc = w.imports.acceptImported({ import: imp.import, edition: 1, findings: [THEIRS], checked: "every passage",
                                         reason: "We recreated it whole and read it.", by: V("alice"), viewer: V("alice") });
  assert.equal(acc.ok, true, JSON.stringify(acc).slice(0, 300));
  const ref = w.imports.importedCase({ import: imp.import, edition: 1, viewer: V("alice") }).edition.findings[0].ref;
  w.finding(Q, [{ target: D1, ...GRADED }, { target: ref, target_edition: 1 }]);
  const x = { w, P: w.project("Team", "alice", [Q]), targets: [Q] };
  const pre = w.ca.publishPreflight(args(x));
  assert.equal(pre.first, null, JSON.stringify(pre.first).slice(0, 300));
  assert.deepEqual(sign(pre).ungraded_passages, { rows: [], count: 0 });
});

/* ----------------------------------------------------------------------------------------------- R89 */

test("R89 (T53; DEC-461): the document lists exactly the ungraded passages, equal to R88's rows, and carries the one fixed sentence once", () => {
  const x = setup({ graded: [D3] });
  const pre = x.w.ca.publishPreflight(args(x));
  const r = x.w.ca.publishCase(args(x));
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  const text = docOf(x.w, r);
  const u = ungradedPassagesOf(x.w.fm(text));
  assert.equal(u.state, "stated");
  assert.deepEqual(u.rows.map((p) => [p.finding, p.ord]), sign(pre).ungraded_passages.rows.map((p) => [p.finding, p.ord]));
  assert.deepEqual(u.rows.map((p) => [p.finding, p.ord]), [[Q, 0], [Q, 1]]);
  assert.equal(text.split(SENTENCE()).length - 1, 1, "the sentence once");
});

test("R89 (control): all graded writes neither the rows nor the sentence; a replaced preparation keeps no stale list", () => {
  const x = setup({ graded: [D3] });
  const first = x.w.ca.publishCase(args(x));
  assert.equal(first.ok, true, JSON.stringify(first).slice(0, 300));
  assert.ok(docOf(x.w, first).includes(SENTENCE()));
  regrade(x, [D1, D2]);
  const again = x.w.ca.publishCase(args(x));
  assert.equal(again.ok, true, JSON.stringify(again).slice(0, 300));
  const text = docOf(x.w, again);
  assert.deepEqual(ungradedPassagesOf(x.w.fm(text)).rows, []);
  assert.ok(!text.includes(SENTENCE()), "no sentence");
  const held = x.w.rows(`SELECT text FROM case_documents WHERE case_id=? AND sig_armored IS NULL`, again.caseId);
  assert.equal(held.length, 1, "one preparation");
  assert.ok(!held[0].text.includes(SENTENCE()));
});

/* ----------------------------------------------------------------------------------------------- R90 */

test("R90 (T53; DEC-461): a case with an ungraded load-bearing passage prepares and signs, the pre-flight refusing nothing for it, the statement in the document", () => {
  const x = setup();
  const pre = x.w.ca.publishPreflight(args(x));
  assert.equal(pre.first, null, JSON.stringify(pre.first).slice(0, 300));
  /* the signer's key is ratification's to ask (credentials R9), not this module's: every other blocker is none */
  assert.deepEqual(pre.blockers.map((b) => b.reason).filter((c) => c !== "NO_ATTESTING_KEY" && !c.startsWith("CASE_SIGNER")), []);
  const r = x.w.ca.publishCase(args(x));
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  assert.ok(docOf(x.w, r).includes(SENTENCE()));
  x.w.ratify(r);
});

test("R90 (control): the same case fully graded prepares and writes no statement", () => {
  const x = setup({ graded: [D1, D2, D3] });
  const r = x.w.ca.publishCase(args(x));
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  assert.ok(!docOf(x.w, r).includes(SENTENCE()));
  assert.deepEqual(sign(x.w.ca.publishPreflight(args(x))).ungraded_passages, { rows: [], count: 0 });
});
