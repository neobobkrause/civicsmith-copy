/* strength: the provider notice inquiry:360 (PR 360; inquiry R87–R90: setSubject, subjectHistory, the subject's
   private-person warning, a part's subject change). This module calls none of the new ops. It reads the question's
   subject through `inquiry.subjectEntityOf` (Uses) to earn a stored version's legs (R9: `versionStrength`, and the
   version arms of `gradingFacts` and `testimonyCorroboration`), and the live pair through `basisFor`, whose earned
   grades rest on the same subject; and it fills R28's registration that setSubject's `strength_before`/`strength_after`
   read (R17). R87 makes the subject change after creation, and afterwards `subjectEntityOf` answers the new value, so
   every one of those reads follows the subject the question now holds. Code confirmed unchanged. Driven on inquiry's real
   world with the real strength, basis-versions and entities (K4990). */
import test from "node:test";
import assert from "node:assert/strict";
import { world, V } from "../inquiry/fixture.mjs";
import { strengthOf } from "../../../src/strength/index.mjs";
import { basisVersionsOf } from "../../../src/basis-versions/index.mjs";

const A = "INFO-2026-5601-a", Q = "INQ-2026-5601-q", E1 = "ENT-2026-5601", E2 = "ENT-2026-5602";

function setup({ live = [{ target: A }], e2 = "A" } = {}) {
  const w = world(); w.entity(E1, "Harbor Board"); w.entity(E2, "Paving Office"); w.member("alice");
  const [cap] = w.doc(A);
  w.resolve(cap, A, "ref", E1, "B");
  w.resolve(cap, A, "ref2", E2, e2);
  w.inquiry(Q, { subject: E1, legs: live });
  const bv = basisVersionsOf(w.host, { record: w.record, membership: w.membership, promotion: w.promotion, content: w.content });
  bv.migrate();
  const s = strengthOf(w.host, { record: w.record, membership: w.membership });
  const ap = bv.appendVersion({ target: Q, author: V("alice"),
    version: { name: "v1", description: "the board approved the contract, read from its minutes", relationship: "and", author: V("alice") },
    legs: [{ target: A, role: "supports", grade: "B", grade_axis: "connection", grade_source: "resolution" }] });
  assert.equal(ap.ok, true, JSON.stringify(ap).slice(0, 300));
  const setSubject = (subject, reason) => w.k.setSubject({ target: Q, subject, reason, viewer: "admin", author: V("alice") });
  const version = () => s.versionStrength({ id: Q, version: "v1", states: ["suggested"], viewer: "admin" });
  return { w, s, setSubject, version };
}

test("notice inquiry:360 (R9): after setSubject changes the question's subject, a stored version's connection leg carries what the record earns under the subject the question now holds, its authored letter kept beside it", () => {
  const { setSubject, version } = setup();
  const before = version();
  assert.equal(before.ok, true, JSON.stringify(before).slice(0, 300));
  assert.equal(before.subject_entity, E1);
  assert.deepEqual([before.pair.connection.state, before.pair.connection.grade], ["graded", "B"]);
  const r = setSubject(E2, "the office let the contract");
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  const after = version();
  assert.equal(after.subject_entity, E2, "the subject inquiry's subjectEntityOf now answers");
  assert.deepEqual([after.pair.connection.state, after.pair.connection.grade], ["graded", "A"]);
  assert.deepEqual([after.graded[0].grade, after.graded[0].authored], ["A", "B"], "earned, never the authored letter alone");
  assert.ok(after.graded[0].why.includes(E2), "the why names the new subject's resolution");
});

test("notice inquiry:360 (R9) control: with the subject cleared, nothing is earned for the version's connection leg, so it is inert and named, never counted at its authored letter", () => {
  const { setSubject, version } = setup();
  const r = setSubject("", "no single subject");
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  const v = version();
  assert.equal(v.subject_entity, null);
  assert.equal(v.pair.connection.grade, null);
  assert.equal(v.graded.length, 0);
  assert.deepEqual(v.ungraded.map((u) => u.target_id), [A]);
});

test("notice inquiry:360 (R1, R6, R17): a live leg stating the grade both subjects earn keeps counting after the change, and setSubject's strength_after is strengthOf's pair under the new subject", () => {
  const { s, setSubject } = setup({ live: [{ target: A, grade: "B", grade_axis: "connection", grade_source: "resolution" }], e2: "B" });
  const live0 = s.inquiryStrength({ id: Q, viewer: "admin" });
  assert.equal(live0.connection.grade, "B", JSON.stringify(live0).slice(0, 300));
  const r = setSubject(E2, "the office let the contract");
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  const now = s.strengthOf(Q);
  assert.deepEqual([now.connection.state, now.connection.grade], ["graded", "B"]);
  assert.deepEqual(r.strength_after.connection, now.connection, "R17: the registered pair is strengthOf's");
  assert.deepEqual(s.inquiryStrength({ id: Q, viewer: "admin" }).connection.grade, "B");
  /* control: a change the new subject would not earn is refused by inquiry, and the pair stands */
  const refused = setSubject("", "no single subject");
  assert.equal(refused.reason, "BASIS_REFUSED");
  assert.deepEqual(s.strengthOf(Q).connection, now.connection);
});
