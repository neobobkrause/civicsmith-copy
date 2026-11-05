/* A question's subject (R87–R90; T53, DEC-457, DEC-481): `setSubject` names, changes or takes off who a question is about,
   with a reason, by a revision that moves only `subject_entity`; `subjectHistory` reads the subject and every change,
   oldest first, with the strength pair at each and, for a divided question, the part whose subject changed. R59's
   private-person warning covers the subject (R89). Driven through the real promotion, entities, lines and membership. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, V, MACHINE, inquiryMd } from "./fixture.mjs";
import { linesOf } from "../../../src/lines/index.mjs";

const A = "INFO-2026-0001-a", B = "INFO-2026-0002-b";
const Q = "INQ-2026-0001-q", C1 = "INQ-2026-0002-a", C2 = "INQ-2026-0003-b";
const E1 = "ENT-2026-0001", E2 = "ENT-2026-0002";
const pair = (c) => ({ capture: { state: "graded", grade: c }, connection: { state: "undetermined", grade: null } });

function setup(opts = {}) {
  const w = world(opts); w.doc(A); w.doc(B);
  w.entity(E1, "Harbor Board"); w.entity(E2, "Paving Office");
  w.member("alice"); w.member("bob"); w.member("carol", { role: "admin" });
  w.inquiry(Q, { legs: [{ target: A }, { target: B }], ...(opts.inq || {}) });
  return w;
}
const set = (w, extra = {}) => w.k.setSubject({ target: Q, subject: E1, reason: "the board signed it", viewer: "admin",
                                                author: V("alice"), ...extra });
const H = (w, extra = {}) => w.k.subjectHistory({ id: Q, viewer: "admin", ...extra });
const basisRows = (w, id = Q) => w.rows(`SELECT * FROM inquiry_basis WHERE bundle_id=? ORDER BY ord`, id);

test("R87 naming and then changing the subject, each with a reason, land: the document, subjectEntityOf and both pairs read right; legs, state and grounds untouched", () => {
  const w = setup();
  const seq = [pair("C"), pair("B"), pair("B"), pair("A")];
  let i = 0; w.k.onGrounded("strength", () => seq[Math.min(i++, seq.length - 1)]);
  const legsBefore = basisRows(w);
  const named = set(w);
  assert.equal(named.ok, true, JSON.stringify(named).slice(0, 400));
  assert.deepEqual([named.target, named.act, named.subject, named.previous, named.reason], [Q, "named", E1, null, "the board signed it"]);
  assert.deepEqual([named.strength_before, named.strength_after], [seq[0], seq[1]]);
  assert.equal(w.fm(Q).subject_entity, E1);
  assert.equal(w.k.subjectEntityOf(Q), E1);
  const changed = set(w, { subject: E2, reason: "the office let the contract" });
  assert.equal(changed.ok, true);
  assert.deepEqual([changed.act, changed.subject, changed.previous], ["changed", E2, E1]);
  assert.deepEqual([changed.strength_before, changed.strength_after], [seq[2], seq[3]]);
  assert.equal(w.fm(Q).subject_entity, E2); assert.equal(w.k.subjectEntityOf(Q), E2);
  assert.deepEqual(basisRows(w), legsBefore, "legs untouched");
  assert.equal(w.fm(Q).current_state, "open", "the state does not move");
  assert.equal(w.fm(Q).grounds, undefined);
  assert.match(w.text(Q), /Reason: the office let the contract/, "the reason is kept with the act");
});

test("R87 refusals in order, each writing nothing: machine, no target, absent or invisible, not a question, not the owner, no reason, bad reason, unchanged, an unregistered entity", () => {
  const w = setup();
  assert.equal(set(w).ok, true);
  const text = w.text(Q), legs = basisRows(w), changes = w.count("inquiry_subject_changes");
  const cases = [
    [{ author: MACHINE }, "MACHINE_CANNOT_SET_SUBJECT"],
    [{ author: "" }, "MACHINE_CANNOT_SET_SUBJECT"],
    [{ target: "" }, "NO_TARGET"],
    [{ target: "INQ-2026-0099-none" }, "NO_SUCH_BUNDLE"],
    [{ viewer: null }, "NO_SUCH_BUNDLE"],
    [{ target: A }, "NOT_AN_INQUIRY"],
    [{ author: V("bob"), viewer: V("bob") }, "NOT_THE_QUESTION_OWNER"],
    [{ subject: E2, reason: "" }, "NO_REASON"],
    [{ subject: E2, reason: "x".repeat(501) }, "BAD_REASON"],
    [{ subject: E2, reason: 'a "quoted" reason' }, "BAD_REASON"],
    [{ subject: E1 }, "SUBJECT_UNCHANGED"],
    [{ subject: "ENT-2026-9999" }, "SUBJECT_REFUSED"],
  ];
  for (const [extra, code] of cases) {
    const r = set(w, { subject: E2, ...extra });
    assert.deepEqual([r.ok, r.reason], [false, code], JSON.stringify(extra));
    assert.equal(w.text(Q), text, `${code} leaves the document`);
    assert.deepEqual(basisRows(w), legs, `${code} leaves inquiry_basis`);
    assert.equal(w.count("inquiry_subject_changes"), changes, `${code} records no change`);
  }
  /* the machine is told first, even when it is not the owner either */
  assert.equal(set(w, { author: MACHINE, viewer: V("bob"), subject: E2 }).reason, "MACHINE_CANNOT_SET_SUBJECT");
  assert.equal(set(w, { author: V("bob"), viewer: V("bob"), subject: E2 }).key, "question.refused.notowner");
  /* an invisible question answers as an absent one, to a member who may not see it */
  const hidden = w.project("Bob's own", "bob");
  w.st.sql.exec(`UPDATE bundles SET project=? WHERE bundle_id=?`, hidden, Q);
  assert.deepEqual(set(w, { viewer: V("alice"), subject: E2 }), { ok: false, reason: "NO_SUCH_BUNDLE", target: Q });
  w.st.sql.exec(`UPDATE bundles SET project=NULL WHERE bundle_id=?`, Q);
  assert.equal(w.k.subjectEntityOf(Q), E1, "the subject stands");
});

test("R87 K5539 only the question's owner or an administrator names or changes its subject; another member who sees it is refused", () => {
  const w = setup();
  const bob = set(w, { author: V("bob"), viewer: V("bob") });
  assert.deepEqual([bob.ok, bob.reason], [false, "NOT_THE_QUESTION_OWNER"]);
  assert.equal(w.k.subjectEntityOf(Q), null, "the subject stands");
  assert.equal(set(w).ok, true, "the owner (who created it) changes it");
  const admin = set(w, { author: V("carol"), viewer: V("carol"), subject: E2, reason: "an administrator corrects it" });
  assert.equal(admin.ok, true, JSON.stringify(admin).slice(0, 300));
  assert.equal(w.k.subjectEntityOf(Q), E2);
  assert.deepEqual(w.row(`SELECT owner FROM inquiry_owners WHERE bundle_id=?`, Q), { owner: V("alice") }, "the creator is the owner");
});

test("R87 K5536 a leg whose stated connection grade the new subject would not earn refuses the change as BASIS_REFUSED, naming the leg; no grade is lowered", () => {
  const w = world(); w.entity(E1); w.entity(E2); w.member("alice");
  const [cap] = w.doc(A);
  w.resolve(cap, A, "ref", E1, "B");
  w.resolve(cap, A, "ref2", E2, "C");
  w.inquiry(Q, { subject: E1, legs: [{ target: A, grade: "B", grade_axis: "connection", grade_source: "resolution" }] });
  const text = w.text(Q);
  const r = set(w, { subject: E2, reason: "it was the office" });
  assert.deepEqual([r.ok, r.reason], [false, "BASIS_REFUSED"], JSON.stringify(r).slice(0, 400));
  assert.ok(r.findings.length >= 1);
  assert.deepEqual([r.findings[0].ord, r.findings[0].target], [0, A], "the leg is named");
  assert.equal(w.text(Q), text, "nothing written; the grade stands");
  /* control: a leg at the grade the new subject earns lets the change land */
  w.resolve(cap, A, "ref2", E2, "B");
  assert.equal(set(w, { subject: E2, reason: "it was the office" }).ok, true);
});

test("R87 K5540 K5541 K5542 a published member and a divided question accept the change; an empty subject takes it off with a reason; a concluded question keeps its conclusion", () => {
  const caseMembers = new Set([Q]);
  const w = setup({ caseMembers });
  const pub = set(w);
  assert.equal(pub.ok, true, JSON.stringify(pub).slice(0, 300));
  assert.equal(w.k.ground({ target: Q, grounds: [{ ground: "g", legs: [0] }], viewer: "admin", author: V("alice") }).reason,
    "PUBLISHED_CANNOT_RESTRUCTURE", "control: the restructure is still refused on the published member");
  /* clearing */
  assert.equal(set(w, { subject: "", reason: "" }).reason, "NO_REASON", "taking it off takes a reason");
  const cleared = set(w, { subject: "", reason: "no single subject" });
  assert.deepEqual([cleared.ok, cleared.act, cleared.subject, cleared.previous], [true, "cleared", null, E1]);
  assert.equal(w.fm(Q).subject_entity, undefined); assert.equal(w.k.subjectEntityOf(Q), null);
  caseMembers.delete(Q);
  /* divided */
  const d = w.k.divide({ target: Q, reason: "two questions", viewer: "admin", author: V("alice"),
    children: [{ id: C1, question: "First half?", legs: [0] }, { id: C2, question: "Second half?", legs: [1] }] });
  assert.equal(d.ok, true, JSON.stringify(d).slice(0, 300));
  const div = set(w, { subject: E2, reason: "the parent is about the office" });
  assert.equal(div.ok, true, JSON.stringify(div).slice(0, 300));
  assert.equal(div.reason, "the parent is about the office");
  assert.equal(w.fm(Q).current_state, "divided"); assert.equal(w.fm(Q).subject_entity, E2);
  assert.equal(w.k.subjectEntityOf(C1), null, "a part keeps its own subject");
  /* control: R64's door stays closed to any other revision of the divided question */
  assert.equal(w.promote(Q, w.text(Q).replace("subject_entity: " + E2, "subject_entity: " + E1)).reason, "DIVIDED_CANNOT_RESTRUCTURE");
  /* concluded */
  const w2 = setup({ inq: { state: "concluded", prior: "open",
    extra: ['conclusion: "the board signed it"', 'falsifier: "a signature by anyone else"'] } });
  const conc = w2.k.setSubject({ target: Q, subject: E1, reason: "named after the finding", viewer: "admin", author: V("alice") });
  assert.equal(conc.ok, true, JSON.stringify(conc).slice(0, 300));
  assert.equal(w2.fm(Q).current_state, "concluded");
  assert.equal(w2.fm(Q).conclusion, "the board signed it", "the conclusion is kept");
});

test("R88 opened with a subject, changed with a reason: two entries in order with both pairs, and subject the last; a never-named question answers subject null and no change", () => {
  const w = setup({ inq: { subject: E1 } });
  const seq = [pair("C"), pair("B"), pair("B")];
  let i = 0; w.k.onGrounded("strength", () => seq[Math.min(i++, seq.length - 1)]);
  w.clock.now = "2026-09-28T02:00:00Z";
  assert.equal(set(w, { subject: E2, reason: "the office let the contract" }).ok, true);
  const r = H(w);
  assert.equal(r.ok, true); assert.equal(r.id, Q);
  assert.deepEqual(r.subject, { entity_id: E2, label: "Paving Office", kind: "body" });
  assert.equal(r.changes.length, 2);
  const [o, c] = r.changes;
  assert.deepEqual([o.act, o.from, o.to, o.reason, o.strength_before, o.strength_after, o.by], ["opened", null, E1, null, null, null, V("alice")]);
  assert.deepEqual([c.at, c.by, c.act, c.from, c.to, c.reason], ["2026-09-28T02:00:00Z", V("alice"), "changed", E1, E2, "the office let the contract"]);
  assert.deepEqual([c.strength_before, c.strength_after], [seq[0], seq[1]]);
  assert.deepEqual(r.strength_now, seq[2]);
  assert.ok("projects" in r, "R60: a read of a question answers its projects");
  /* never named */
  const w2 = setup();
  const n = w2.k.subjectHistory({ id: Q, viewer: "admin" });
  assert.deepEqual([n.ok, n.subject, n.changes], [true, null, []]);
  assert.equal(n.strength_now, null); assert.ok(n.strength_absent, "no module answers strength: said so");
});

test("R88 a subject stated before changes were recorded has its subject and no opened entry; a revision by another door is a change with no reason", () => {
  const w = setup({ inq: { subject: E1 } });
  w.st.sql.exec(`DELETE FROM inquiry_subject_changes WHERE bundle_id=?`, Q);   /* as a store written before R88 */
  const r = H(w);
  assert.deepEqual([r.subject.entity_id, r.changes], [E1, []], "stated, never composed");
  assert.equal(w.promote(Q, w.text(Q).replace(`subject_entity: ${E1}`, `subject_entity: ${E2}`)).ok, true);
  const [c] = H(w).changes;
  assert.deepEqual([c.act, c.from, c.to, c.reason, c.strength_before], ["changed", E1, E2, null, null]);
});

test("R88 control: an invisible or not-a-question id answers as absent; a published question is read; it never throws", () => {
  const caseMembers = new Set();
  const w = setup({ caseMembers, inq: { subject: E1 } });
  assert.deepEqual(H(w, { id: "INQ-2026-0099-none" }), { ok: false, reason: "NO_SUCH_BUNDLE", target: "INQ-2026-0099-none" });
  assert.deepEqual(H(w, { viewer: null }), { ok: false, reason: "NO_SUCH_BUNDLE", target: Q });
  assert.equal(H(w, { id: A }).reason, "NOT_AN_INQUIRY");
  const hidden = w.project("Bob's own", "bob");
  w.st.sql.exec(`UPDATE bundles SET project=? WHERE bundle_id=?`, hidden, Q);
  assert.deepEqual(H(w, { viewer: V("alice") }), { ok: false, reason: "NO_SUCH_BUNDLE", target: Q });
  w.st.sql.exec(`UPDATE bundles SET project=NULL WHERE bundle_id=?`, Q);
  caseMembers.add(Q);
  assert.equal(H(w).ok, true, "a published question is read");
  for (const a of [undefined, null, {}, { id: 7 }, { id: {} , viewer: 3 }]) assert.doesNotThrow(() => w.k.subjectHistory(a));
  /* the registry cannot be read: label null, said so */
  w.st.sql.exec(`ALTER TABLE entities RENAME TO entities_gone`);
  const u = H(w);
  assert.deepEqual([u.subject.entity_id, u.subject.label], [E1, null]); assert.ok(u.subject.label_unread);
});

test("R90 a divided question whose part B has its subject changed answers one entry naming B, with date, member, old and new subject and reason; its own change answers part null", () => {
  const w = setup();
  const d = w.k.divide({ target: Q, reason: "two questions", viewer: "admin", author: V("alice"),
    children: [{ id: C1, question: "First half?", legs: [0] }, { id: C2, question: "Second half?", legs: [1] }] });
  assert.equal(d.ok, true, JSON.stringify(d).slice(0, 300));
  w.clock.now = "2026-09-29T03:00:00Z";
  const b = w.k.setSubject({ target: C2, subject: E2, reason: "the second half is the office's", viewer: "admin", author: V("alice") });
  assert.equal(b.ok, true, JSON.stringify(b).slice(0, 300));
  const r = H(w);
  assert.equal(r.changes.length, 1);
  const [c] = r.changes;
  assert.deepEqual(c.part, { id: C2, title: "Second half?" });
  assert.deepEqual([c.at, c.by, c.from, c.to, c.reason, c.act], ["2026-09-29T03:00:00Z", V("alice"), null, E2, "the second half is the office's", "named"]);
  w.clock.now = "2026-09-29T04:00:00Z";
  assert.equal(set(w, { reason: "the whole is the board's" }).ok, true);
  const all = H(w).changes;
  assert.deepEqual(all.map((x) => [x.part ? x.part.id : null, x.to]), [[C2, E2], [null, E1]], "oldest first, each part on its own entry");
  /* the part's own history names no part */
  assert.deepEqual(w.k.subjectHistory({ id: C2, viewer: "admin" }).changes.map((x) => x.part), [null]);
  /* a viewer who may not see the divided question reads none */
  const hidden = w.project("Bob's own", "bob");
  w.st.sql.exec(`UPDATE bundles SET project=? WHERE bundle_id=?`, hidden, Q);
  assert.deepEqual(H(w, { viewer: V("alice") }), { ok: false, reason: "NO_SUCH_BUNDLE", target: Q });
});

test("R90 control: an undivided question's entries all carry part null", () => {
  const w = setup({ inq: { subject: E1 } });
  assert.equal(set(w, { subject: E2, reason: "the office" }).ok, true);
  assert.equal(set(w, { subject: "", reason: "nobody in particular" }).ok, true);
  const r = H(w);
  assert.deepEqual(r.changes.map((x) => [x.act, x.part]), [["opened", null], ["changed", null], ["cleared", null]]);
  assert.equal(r.changes[2].to, null, "a removal's new subject is null");
});

function personSetup() {
  const w = world(); w.doc(A); w.member("alice");
  const lines = linesOf(w.host, { record: w.record, provenance: w.prov, content: w.content, entities: w.entities });
  lines.migrate();
  const ent = (kind, label, extra = {}) => {
    const r = w.entities.createEntity({ kind, label, note: `${label}, registered for the test`, declaredBy: V("alice"), ...extra });
    assert.equal(r.ok, true, JSON.stringify(r)); return r.entity_id;
  };
  const roe = ent("person", "Jane Roe"), clerk = ent("person", "Kim Clerk"), office = ent("office", "City Clerk");
  assert.equal(lines.recordLine({ kind: "holds", from: clerk, to: office, capacity: "appointed",
    valid: { from: null, to: null, zone: "America/Los_Angeles" }, basis: { statement: "as the roster says" }, by: V("alice") }).ok, true);
  return { w, roe, clerk };
}
const warnings = (w, id = Q) => w.rows(`SELECT choice, persons FROM inquiry_person_warnings WHERE bundle_id=? ORDER BY warning_id`, id)
  .map((r) => [r.choice, JSON.parse(r.persons).map((p) => p.label)]);

test("R89 a question created stating a private person as its subject, and setSubject naming one, carry R59's warning, never an error; the act writes, her choice recorded", () => {
  const { w, roe, clerk } = personSetup();
  /* a question naming nobody in its text, with her as its subject entity */
  const made = w.promote(Q, inquiryMd(Q, { question: "Was the paving contract signed?", subject: roe, legs: [{ target: A }] }), null);
  assert.equal(made.ok, true);
  assert.deepEqual(made.warning.persons.map((p) => p.label), ["Jane Roe"], "a creation stating her as subject warns");
  /* setSubject naming her on another question, seen before the act: written, recorded as went_on */
  w.inquiry(C1, { question: "Was the paving contract signed?", legs: [{ target: A }] });
  const r = w.k.setSubject({ target: C1, subject: roe, reason: "she signed it", viewer: "admin", author: V("alice"), personWarningSeen: true });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  assert.deepEqual([r.warning.code, r.warning.choice, r.warning.persons.map((p) => p.label)], ["PERSON_IN_NO_PUBLIC_ROLE", "went_on", ["Jane Roe"]]);
  assert.equal(w.k.subjectEntityOf(C1), roe, "the act wrote");
  assert.deepEqual(warnings(w, C1), [["went_on", ["Jane Roe"]]]);
  /* an officeholder carries none */
  const off = w.k.setSubject({ target: C1, subject: clerk, reason: "the clerk signed", viewer: "admin", author: V("alice") });
  assert.equal(off.ok, true); assert.equal(off.warning, undefined);
  /* control: taking the subject off carries none */
  const back = w.k.setSubject({ target: C1, subject: roe, reason: "she did", viewer: "admin", author: V("alice") });
  assert.equal(back.warning.choice, "warned_at_act");
  const gone = w.k.setSubject({ target: C1, subject: "", reason: "no single subject", viewer: "admin", author: V("alice") });
  assert.equal(gone.ok, true); assert.equal(gone.warning, undefined);
  assert.equal(warnings(w, C1).length, 2);
});
