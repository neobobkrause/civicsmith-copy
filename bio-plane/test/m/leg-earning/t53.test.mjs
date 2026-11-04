/* T53 (DEC-464, DEC-457): a typed passage's capture ceiling is its own (R18); a leg on a typed passage is graded by the
   record without a member's act (R19, the one exception R10 names); and "no subject named" is a reason of its own
   (R20). Each with its controls (K874). Driven at the interface over the real modules (`fixture.mjs`): a member types
   a page through `content.transcribe` and a second member checks it through `content.transcriptionAttest`. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, V, inquiryMd } from "./fixture.mjs";
import { legCapped } from "../../../src/leg-earning/index.mjs";
import { ARCHIVE_VIA } from "../../../src/provenance/index.mjs";
import { EARNED_CAPTURE_CEILING, BASIS_GRADES } from "../../../src/record-grammar/index.mjs";
import { TYPED_UNCHECKED_GRADE, TYPED_CHECKED_GRADE } from "../../../src/textchain.mjs";

const below = (g) => BASIS_GRADES[BASIS_GRADES.indexOf(g) + 1];
const AT = "2026-09-27T00:00:00Z";
let qn = 0;

/* A member's typing of page 0 of `doc`. */
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
/* An inquiry whose legs each cite a typed row (`cid`) or a document whole, with an optional stated capture letter. */
const inquiry = (w, legs, { subject = null } = {}) => {
  const id = `INQ-2026-53${String(++qn).padStart(2, "0")}-t`;
  const lines = ["basis:", ...legs.flatMap((l) => [`  - target: ${l.target}`, "    role: supports",
    ...(l.cid ? [`    content_id: "${l.cid}"`] : []),
    ...(l.grade ? [`    grade: ${l.grade}`, "    grade_axis: capture", "    grade_source: capture"] : [])])];
  const r = w.promoteInquiry(id, inquiryMd(id, { subject, refs: [...new Set(legs.map((l) => l.target))].map((t) => ({ target: t })),
                                                 extra: lines }));
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 400));
  return id;
};
const read = (w, id) => { const r = w.k.earnedBasis({ id, viewer: "admin" }); assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300)); return r; };

/* ------------------------------------------------------------------------------------------------ R18 */

test("R18 a typed passage's capture ceiling is its own: byte grade B reads D unchecked and C checked; byte grade C reads C checked; an unruled route is undetermined", () => {
  const w = world(); w.member("ruth"); w.member("sam");
  const DIRECT = "INFO-2026-5301-typed-direct", REPLAY = "INFO-2026-5302-typed-replay", PIGEON = "INFO-2026-5303-typed-pigeon";
  const [dCap] = w.doc(DIRECT, ["a scanned title"], { chain: null });
  const [rCap] = w.doc(REPLAY, ["a replayed title"], { chain: null, via: ARCHIVE_VIA });
  w.doc(PIGEON, ["a pigeon's title"], { chain: null, via: "carrier-pigeon" });
  assert.equal(w.prov.captureGrade(dCap).grade, EARNED_CAPTURE_CEILING);
  assert.equal(w.prov.captureGrade(rCap).grade, below(EARNED_CAPTURE_CEILING));
  const d = type(w, DIRECT), r = type(w, REPLAY), p = type(w, PIGEON);
  const id = inquiry(w, [{ target: DIRECT, cid: d }, { target: REPLAY, cid: r }, { target: PIGEON, cid: p }]);
  let c = read(w, id).earned.content;
  assert.deepEqual([c[d].capture.grain, c[d].capture.mode, c[d].capture.grade, c[d].capture.determinant],
                   ["passage", "ceiling", TYPED_UNCHECKED_GRADE, "typist"]);
  assert.equal(c[d].capture.typed.label_key, "content.typed.unchecked", "content R64's typed block: who typed");
  assert.equal(c[r].capture.grade, TYPED_UNCHECKED_GRADE);
  assert.deepEqual([c[p].capture.grade, c[p].capture.determined, c[p].capture.undetermined_because],
                   [null, false, "CAPTURE_GRADE_VIA_UNRULED"]);
  for (const cid of [d, r, p]) check(w, cid);
  c = read(w, id).earned.content;
  assert.deepEqual([c[d].capture.grade, c[d].capture.determinant, c[d].capture.by], [TYPED_CHECKED_GRADE, "second_member", ["sam"]]);
  assert.equal(c[d].capture.typed.label_key, "content.typed.checked", "and who checked");
  assert.equal(c[r].capture.grade, TYPED_CHECKED_GRADE);
  assert.equal(c[p].capture.grade, null, "an undetermined document letter makes the typing undetermined");
  for (const cid of [d, r]) assert.ok(BASIS_GRADES.indexOf(c[cid].capture.grade) >= BASIS_GRADES.indexOf(TYPED_CHECKED_GRADE), "never stronger than C");
});

test("R18 a machine reading of the page does not bind a typing: a typed page of a document OCR'd at an unmeasured fidelity still reads the typing's grade", () => {
  const w = world(); w.member("ruth"); w.member("sam");
  const DOC = "INFO-2026-5304-typed-ocr";
  w.doc(DOC, ["ocr'd badly"], { chain: [{ step: "pixels" }, { step: "ocr", engine: "tesseract", version: "5.3.4", cap: null, confidence: { basis: "none" } }] });
  const cid = type(w, DOC);
  const id = inquiry(w, [{ target: DOC, cid }]);
  const e = read(w, id).earned;
  assert.equal(e.capture[DOC].grade, null, "the document's own machine-chain bound is undetermined");
  assert.equal(e.content[cid].capture.grade, TYPED_UNCHECKED_GRADE, "the passage's ceiling is its own");
});

test("R18 control: an attested AI passage keeps R15's grade, and is not graded by the record", () => {
  const w = world(); w.member("sam");
  const DOC = "INFO-2026-5305-ai";
  const [cap] = w.doc(DOC, ["read by an AI"], { chain: [{ step: "pixels", cap: null },
    { step: "ai_transcription", engine: "claude-reader", version: "1", cap: null, confidence: { basis: "none" } }] });
  const id = `INQ-2026-5399-ai`;
  const r = w.promoteInquiry(id, inquiryMd(id, { refs: [{ target: DOC }], extra: ["basis:", `  - target: ${DOC}`, "    role: supports"] }));
  assert.equal(r.ok, true);
  const at = w.content.attestText({ captureSha: cap, member: "sam", at: AT, extent: { kind: "document" }, viewer: V("sam"),
                                    note: "Checked against the page." });
  assert.equal(at.ok, true, JSON.stringify(at).slice(0, 300));
  const got = read(w, id);
  const c = got.earned.content[r.content[0].content_id].capture;
  assert.deepEqual([c.grain, c.grade, c.determinant, c.record_graded], ["passage", EARNED_CAPTURE_CEILING, "attestation", undefined]);
  assert.equal(got.legs[0].capture, undefined);
});

/* ------------------------------------------------------------------------------------------------ R19, R10 */

test("R19 R10 a leg on a typed passage is graded by the record: stating no letter it reads D, then C after the check with no one re-stating it; stating A it reads D with why", () => {
  const w = world(); w.member("ruth"); w.member("sam");
  const DOC = "INFO-2026-5306-typed", DOC2 = "INFO-2026-5307-typed";
  w.doc(DOC, ["a scanned deed"], { chain: null });
  w.doc(DOC2, ["another scanned deed"], { chain: null });
  const cid = type(w, DOC), cid2 = type(w, DOC2);
  const id = inquiry(w, [{ target: DOC, cid }, { target: DOC2, cid: cid2, grade: "A" }]);
  let legs = read(w, id).legs;
  assert.deepEqual([legs[0].capture.stated, legs[0].capture.grade, legs[0].capture.graded_by], [null, TYPED_UNCHECKED_GRADE, "record"]);
  assert.deepEqual([legs[1].capture.stated, legs[1].capture.grade], ["A", TYPED_UNCHECKED_GRADE], "none above R18's grade is taken");
  assert.equal(typeof legs[1].capture.why, "string"); assert.ok(legs[1].capture.why.includes(DOC2), "with why");
  check(w, cid); check(w, cid2);
  legs = read(w, id).legs;
  assert.deepEqual([legs[0].capture.grade, legs[0].capture.graded_by], [TYPED_CHECKED_GRADE, "record"], "the grade follows the check");
  assert.equal(legs[1].capture.grade, TYPED_CHECKED_GRADE);
});

test("R19 a weaker stated letter stands on a typed passage; legCapped grades a typed entry stating nothing at the record's grade", () => {
  const w = world(); w.member("ruth"); w.member("sam");
  const DOC = "INFO-2026-5308-typed";
  w.doc(DOC, ["a scanned deed"], { chain: null });
  const cid = type(w, DOC);
  check(w, cid);
  const id = inquiry(w, [{ target: DOC, cid, grade: TYPED_UNCHECKED_GRADE }]);
  const got = read(w, id);
  assert.deepEqual([got.legs[0].capture.grade, got.legs[0].capture.graded_by], [TYPED_UNCHECKED_GRADE, "stated"]);
  const entry = got.earned.content[cid].capture;
  assert.deepEqual([legCapped(undefined, entry, DOC).grade, legCapped(undefined, entry, DOC).graded_by], [TYPED_CHECKED_GRADE, "record"]);
  assert.equal(legCapped(TYPED_UNCHECKED_GRADE, entry, DOC), null);
  assert.equal(legCapped("A", entry, DOC).grade, TYPED_CHECKED_GRADE);
});

test("R19 R10 control: a document leg stating nothing is inert — the record grades no other kind", () => {
  const w = world();
  const DOC = "INFO-2026-5309-plain";
  w.doc(DOC, ["publisher-typed"], { chain: null });
  const id = inquiry(w, [{ target: DOC }]);
  const got = read(w, id);
  assert.equal(got.legs[0].capture, undefined, "no grade given by the record");
  for (const st of Object.values(got.earned.content || {})) assert.notEqual(st.capture?.record_graded, true);
  assert.equal(got.earned.capture[DOC].record_graded, undefined);
});

/* ------------------------------------------------------------------------------------------------ R20 */

test("R20 a document with no subject_entity answers each target's connection why as no subject named; after one is named, the why is the resolution's own", () => {
  const w = world();
  const DOC = "INFO-2026-5310-conn", SUBJ = "ENT-2026-5301";
  const [cap] = w.doc(DOC, ["the board met"], { chain: null });
  w.entity(SUBJ, "The Board");
  w.resolve(cap, DOC, "p1", SUBJ, "B");
  const none = read(w, inquiry(w, [{ target: DOC }]));
  assert.deepEqual(none.earned.connection, {}, "the connection grade is answered as today");
  assert.deepEqual([none.earned.connection_why[DOC].reason, none.earned.connection_why[DOC].grade], ["NO_SUBJECT_NAMED", null]);
  assert.ok(none.earned.connection_why[DOC].why.includes(DOC));
  const viaDoc = w.k.earnedForDoc({}, [{ target: DOC }]);
  assert.equal(viaDoc.earned.connection_why[DOC].reason, "NO_SUBJECT_NAMED", "earnedForDoc with no subject_entity");
  assert.equal(w.k.earned(null, [DOC]).earned.connection_why[DOC].reason, "NO_SUBJECT_NAMED", "earned given none");
  const named = read(w, inquiry(w, [{ target: DOC }], { subject: SUBJ }));
  assert.equal(named.earned.connection_why, undefined);
  assert.equal(named.earned.connection[DOC].grade, "B");
  assert.ok(named.earned.connection[DOC].why.includes(SUBJ), "the resolution's own why");
});

test("R20 controls: a subject with a D resolution answers its old why, not this reason; capture and testimony answers are the same with and without a subject", () => {
  const w = world();
  const DOC = "INFO-2026-5311-dres", SUBJ = "ENT-2026-5302";
  const [cap] = w.doc(DOC, ["a mention"], { chain: null });
  w.entity(SUBJ, "The Council");
  w.resolve(cap, DOC, "p1", SUBJ, "D");
  const withSubj = w.k.earned(SUBJ, [DOC]);
  assert.equal(withSubj.earned.connection[DOC], undefined, "a D resolution earns nothing, as before");
  assert.equal(withSubj.earned.connection_why, undefined, "no other case answers NO_SUBJECT_NAMED");
  const without = w.k.earned(null, [DOC]);
  assert.deepEqual(without.earned.capture, withSubj.earned.capture);
  assert.deepEqual(without.earned.testimony, withSubj.earned.testimony);
});
