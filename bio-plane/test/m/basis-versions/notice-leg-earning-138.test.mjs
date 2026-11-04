/* Provider notice leg-earning:138 (leg-earning R10, R18, R19, R20; DEC-464), and R60's first clause: a version's leg on a
   member's typing is graded in `basisVersions` as the record grades it (leg-earning R19), at the passage's own capture
   ceiling (R18), not the document's; the grade follows a second member's check with no one re-stating it, and the
   composition keeps the authored grades (`composition_grades: "authored"`, R10). Driven on inquiry's real world, with
   this module's factory reaching inquiry's own `earned` and leg-earning's own `legCapped` on the same host (K4990). */
import test from "node:test";
import assert from "node:assert/strict";
import { world, V } from "../inquiry/fixture.mjs";
import { inqMd, block } from "./fixture.mjs";
import { basisVersionsOf } from "../../../src/basis-versions/index.mjs";
import { TYPED_UNCHECKED_GRADE, TYPED_CHECKED_GRADE } from "../../../src/textchain.mjs";

const AT = "2026-09-27T00:00:00Z";
const Q = "INQ-2026-5381-typed";

const setup = () => {
  const w = world(); w.member("ruth"); w.member("sam"); w.member("alice");
  const bv = basisVersionsOf(w.host, { record: w.record, membership: w.membership, promotion: w.promotion, content: w.content });
  bv.migrate();
  return { w, bv };
};
const type = (w, doc, typist = "ruth") => {
  const tx = w.content.transcribe({ bundleId: doc, extent: { kind: "pdf-page", page: 0 }, text: "Lot 7, Block 3.",
                                    transcriber: typist, viewer: V(typist), at: AT });
  assert.equal(tx.ok, true, JSON.stringify(tx).slice(0, 300));
  return tx.content_id;
};
const check = (w, cid, member = "sam") => {
  const r = w.content.transcriptionAttest({ contentId: cid, attestor: member, viewer: V(member), at: "2026-09-27T01:00:00Z",
                                           note: "The typing matches the page." });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
};
const question = (w, legs) => {
  const lines = block({ refs: [...new Set(legs.map((l) => l.target))],
    versions: [{ name: "typed", description: "the reading on the typings", relationship: "and", state: "suggested",
                 hidden: false, derived_from: null, author: "member:alice", at: AT }],
    grounds: [{ version: "typed", ground: "main", asserted_by: "member:alice", at: AT }],
    legs: legs.map((l) => ({ version: "typed", target: l.target, role: "supports", ground: "main",
      ...(l.cid ? { content_id: l.cid } : {}),
      ...(l.grade ? { grade: l.grade, grade_axis: "capture", grade_source: "capture" } : {}) })) });
  const r = w.promote(Q, inqMd(Q, lines));
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 600));
};
const legsOf = (bv) => {
  const r = bv.basisVersions({ id: Q, viewer: "admin" });
  assert.equal(r.ok !== false, true, JSON.stringify(r).slice(0, 300));
  return r.versions[0];
};

test("notice leg-earning:138 R60: a version's leg on a typing is graded by the record — stating nothing it reads D, then C after a second member's check; stating A it reads D with why", () => {
  const { w, bv } = setup();
  const DOC = "INFO-2026-5381-typed", DOC2 = "INFO-2026-5382-typed";
  w.doc(DOC, ["a scanned deed"], { chain: null });
  w.doc(DOC2, ["another scanned deed"], { chain: null });
  const cid = type(w, DOC), cid2 = type(w, DOC2);
  question(w, [{ target: DOC, cid }, { target: DOC2, cid: cid2, grade: "A" }]);
  let v = legsOf(bv);
  assert.deepEqual(v.legs.map((l) => [l.content_id, l.grade_authored, l.grade, l.graded_by]),
    [[cid, null, TYPED_UNCHECKED_GRADE, "record"], [cid2, "A", TYPED_UNCHECKED_GRADE, "record_cap"]]);
  assert.ok(typeof v.legs[1].grade_why === "string" && v.legs[1].grade_why.includes(DOC2), "the cap says why");
  assert.equal(v.composition_grades, "authored");
  const composition = v.composition;
  check(w, cid); check(w, cid2);
  v = legsOf(bv);
  assert.deepEqual(v.legs.map((l) => [l.grade_authored, l.grade, l.graded_by]),
    [[null, TYPED_CHECKED_GRADE, "record"], ["A", TYPED_CHECKED_GRADE, "record_cap"]], "the grade follows the check");
  assert.equal(v.composition, composition, "a later check changes no frozen composition (R29)");
});

test("notice leg-earning:138 R60: a weaker stated letter on a typing stands, graded_by stated", () => {
  const { w, bv } = setup();
  const DOC = "INFO-2026-5383-typed";
  w.doc(DOC, ["a scanned deed"], { chain: null });
  const cid = type(w, DOC);
  check(w, cid);
  question(w, [{ target: DOC, cid, grade: TYPED_UNCHECKED_GRADE }]);
  const [leg] = legsOf(bv).legs;
  assert.deepEqual([leg.grade, leg.grade_authored, leg.graded_by, leg.grade_why], [TYPED_UNCHECKED_GRADE, TYPED_UNCHECKED_GRADE, "stated", null]);
});

test("notice leg-earning:138 control: a version's leg on a document stating nothing stays inert — the record grades no other kind", () => {
  const { w, bv } = setup();
  const DOC = "INFO-2026-5384-plain";
  w.doc(DOC, ["publisher-typed"], { chain: null });
  question(w, [{ target: DOC }]);
  const [leg] = legsOf(bv).legs;
  assert.deepEqual([leg.grade, leg.grade_authored, leg.grade_why, Object.hasOwn(leg, "graded_by")], [null, null, null, false]);
});
