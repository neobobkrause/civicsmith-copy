/* Provider notice leg-earning:138 (leg-earning R10, R18, R19, R20; DEC-464, DEC-457): this module confirmed, with no
   code change. What it asks of leg-earning, each at the provider's real shape over the real modules (`fixture.mjs`): a
   member types a page through `content.transcribe`, a second member checks it through `content.transcriptionAttest`.
   - R11's write check (R6's earned arms, through `earnedForDoc`) judges a stated letter against the target's
     document-grain ceiling, as R6 states it, so a typed leg stating no letter lands (it is inert at the write, R32) and
     the grammar's refusals are unchanged; R20's `connection_why` map is never read as a grade.
   - R52 (2)'s leg grades answer `legCapped` against the target's capture ceiling, a document's, which no typing changes.
   - The re-exported reads (`earned`, `earnedForDoc`, `earnedBasis`, `legCapped`) answer leg-earning's answer, so R18's
     passage ceiling, R19's record grade and R20's reason reach this module's callers unchanged. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, V, inquiryMd } from "./fixture.mjs";
import { legCapped as inquiryLegCapped } from "../../../src/inquiry/index.mjs";
import { legCapped } from "../../../src/leg-earning/index.mjs";
import { EARNED_CAPTURE_CEILING } from "../../../src/record-grammar/index.mjs";
import { TYPED_UNCHECKED_GRADE, TYPED_CHECKED_GRADE } from "../../../src/textchain.mjs";

const AT = "2026-09-27T00:00:00Z";
let qn = 0;
const type = (w, doc) => {
  const tx = w.content.transcribe({ bundleId: doc, extent: { kind: "pdf-page", page: 0 }, text: "Lot 7, Block 3.",
                                    transcriber: "ruth", viewer: V("ruth"), at: AT });
  assert.equal(tx.ok, true, JSON.stringify(tx).slice(0, 300));
  return tx.content_id;
};
const check = (w, cid) => {
  const r = w.content.transcriptionAttest({ contentId: cid, attestor: "sam", viewer: V("sam"), at: "2026-09-27T01:00:00Z",
                                           note: "The typing matches the page." });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
};
/* An inquiry over legs `{target, cid?, grade?, source?}` (a stated letter on the capture axis unless `source` says
   otherwise), promoted through this module's check and projection. */
const promote = (w, legs, { subject = null } = {}) => {
  const id = `INQ-2026-138${++qn}-n`;
  const extra = ["basis:", ...legs.flatMap((l) => [`  - target: ${l.target}`, "    role: supports",
    ...(l.cid ? [`    content_id: "${l.cid}"`] : []),
    ...(l.grade ? [`    grade: ${l.grade}`, `    grade_axis: ${l.source === "resolution" ? "connection" : "capture"}`,
                   `    grade_source: ${l.source || "capture"}`] : [])])];
  return { id, r: w.promote(id, inquiryMd(id, { subject, refs: [...new Set(legs.map((l) => l.target))].map((t) => ({ target: t })), extra })) };
};

test("notice leg-earning:138 R18 R19: a typed leg stating no letter lands through R11's check and earnedBasis reads it graded by the record, D then C after the check", () => {
  const w = world(); w.member("ruth"); w.member("sam");
  const DOC = "INFO-2026-1381-typed";
  w.doc(DOC, ["a scanned deed"], { chain: null });
  const cid = type(w, DOC);
  const { id, r } = promote(w, [{ target: DOC, cid }]);
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 400));
  let got = w.k.earnedBasis({ id, viewer: "admin" });
  assert.equal(got.ok, true, JSON.stringify(got).slice(0, 300));
  assert.deepEqual([got.earned.content[cid].capture.grain, got.earned.content[cid].capture.grade], ["passage", TYPED_UNCHECKED_GRADE]);
  assert.deepEqual([got.legs[0].capture.grade, got.legs[0].capture.graded_by], [TYPED_UNCHECKED_GRADE, "record"]);
  check(w, cid);
  got = w.k.earnedBasis({ id, viewer: "admin" });
  assert.deepEqual([got.legs[0].capture.grade, got.legs[0].capture.graded_by], [TYPED_CHECKED_GRADE, "record"]);
  assert.equal(inquiryLegCapped, legCapped, "the re-export is leg-earning's binding");
  assert.equal(inquiryLegCapped(undefined, got.earned.content[cid].capture, DOC).graded_by, "record");
});

test("notice leg-earning:138 R6 R11: the write judges a stated capture letter on a typed leg against the document's ceiling, unchanged: above it refused, at it lands and reads capped at the passage's grade", () => {
  const w = world(); w.member("ruth"); w.member("sam");
  const DOC = "INFO-2026-1382-typed";
  w.doc(DOC, ["a scanned deed"], { chain: null });
  const cid = type(w, DOC);
  assert.equal(w.k.earnedForDoc({}, [{ target: DOC, content_id: cid }]).earned.capture[DOC].grade, EARNED_CAPTURE_CEILING,
               "earnedForDoc answers the document's grain");
  const above = promote(w, [{ target: DOC, cid, grade: "A" }]).r;
  assert.equal(above.reason, "BASIS_REFUSED", JSON.stringify(above).slice(0, 300));
  const at = promote(w, [{ target: DOC, cid, grade: EARNED_CAPTURE_CEILING }]);
  assert.equal(at.r.ok, true, JSON.stringify(at.r).slice(0, 400));
  const leg = w.k.earnedBasis({ id: at.id, viewer: "admin" }).legs[0];
  assert.deepEqual([leg.capture.stated, leg.capture.grade], [EARNED_CAPTURE_CEILING, TYPED_UNCHECKED_GRADE],
                   "none above R18's grade is taken at the read (leg-earning R19)");
});

test("notice leg-earning:138 R52 (2): leg grades answer legCapped against the target's document ceiling; a typing on the target changes none of them", () => {
  const w = world(); w.member("ruth"); w.member("sam");
  const DOC = "INFO-2026-1383-typed";
  w.doc(DOC, ["a scanned deed"], { chain: null });
  const legs = [{ grade: "A", target_id: DOC }, { grade: EARNED_CAPTURE_CEILING, target_id: DOC }, { grade: null, target_id: DOC }];
  const before = w.k.legGrades(legs);
  const cid = type(w, DOC); check(w, cid);
  const after = w.k.legGrades(legs);
  assert.deepEqual(after, before);
  const cap = w.k.earned(null, [DOC]).earned.capture[DOC];
  assert.equal(cap.record_graded, undefined, "a document's ceiling is never record-graded");
  assert.deepEqual(after, legs.map((l) => legCapped(l.grade, cap, DOC)));
  assert.equal(after[0].grade, EARNED_CAPTURE_CEILING);
});

test("notice leg-earning:138 R20: with no subject named, this module's reads carry 'no subject named' and R11's check is unchanged; with one named, no such reason", () => {
  const w = world();
  const DOC = "INFO-2026-1384-conn", SUBJ = "ENT-2026-1381";
  const [cap] = w.doc(DOC, ["the board met"], { chain: null });
  w.entity(SUBJ, "The Board");
  w.resolve(cap, DOC, "p1", SUBJ, "B");
  assert.equal(w.k.earned(null, [DOC]).earned.connection_why[DOC].reason, "NO_SUBJECT_NAMED");
  assert.equal(w.k.earnedForDoc({}, [{ target: DOC }]).earned.connection_why[DOC].reason, "NO_SUBJECT_NAMED");
  assert.deepEqual(w.k.earned(null, [DOC]).earned.connection, {}, "no connection grade is made of the reason");
  const plain = promote(w, [{ target: DOC }]);
  assert.equal(plain.r.ok, true, JSON.stringify(plain.r).slice(0, 400));
  assert.equal(w.k.earnedBasis({ id: plain.id, viewer: "admin" }).earned.connection_why[DOC].reason, "NO_SUBJECT_NAMED");
  const noSubj = promote(w, [{ target: DOC, grade: "B", source: "resolution" }]).r;
  assert.equal(noSubj.reason, "BASIS_REFUSED", "an earned resolution grade with no subject is still refused");
  const named = promote(w, [{ target: DOC, grade: "B", source: "resolution" }], { subject: SUBJ });
  assert.equal(named.r.ok, true, JSON.stringify(named.r).slice(0, 400));
  assert.equal(w.k.earned(SUBJ, [DOC]).earned.connection_why, undefined);
  assert.equal(w.k.subjectEntityOf(named.id), SUBJ);
});
