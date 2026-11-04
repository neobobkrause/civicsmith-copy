/* T53 (DEC-464): a leg on a typed passage counts at the passage's grade (R46), and the grading method gains its rule
   and a new version (R47); the notice of leg-earning PR 138 (its R18, R19, R10, R20), answered here. Driven over the
   real modules: leg-earning's own world (`../leg-earning/fixture.mjs`: record-core, membership, promotion, provenance,
   content, extraction, entities, connections and leg-earning, each the real one), with strength composed on the same
   host by its factory, so the earned registry and the basis it reads are leg-earning's real answers. A member types a
   page through `content.transcribe`; a second member checks it through `content.transcriptionAttest`. */
import test from "node:test";
import assert from "node:assert/strict";
import { world as earningWorld, V, inquiryMd } from "../leg-earning/fixture.mjs";
import { strengthOf, recomputePair, gradingMethodText, GRADING_METHOD_VERSION, GRADING_METHOD_VERSIONS }
  from "../../../src/strength/index.mjs";
import { EARNED_CAPTURE_CEILING } from "../../../src/record-grammar/index.mjs";
import { TYPED_UNCHECKED_GRADE, TYPED_CHECKED_GRADE } from "../../../src/textchain.mjs";
import { migrateObservationLog } from "../../../src/observation-log/schema.mjs";
import { retrievalOf } from "../../../src/retrieval/index.mjs";
import { migrateInquiry } from "../../../src/inquiry/schema.mjs";

const AT = "2026-09-27T00:00:00Z";
let qn = 0;

function world() {
  const w = earningWorld();
  w.member("ruth"); w.member("sam");
  /* The tables strength's cache projection reaches on the same host (the modules it reads lazily), from their own schema. */
  migrateObservationLog(w.st.sql);
  migrateInquiry(w.st.sql);
  const retrieval = retrievalOf(w.host, { record: w.record, membership: w.membership });
  if (typeof retrieval.migrate === "function") retrieval.migrate();
  w.s = strengthOf(w.host, { record: w.record, membership: w.membership, promotion: w.promotion });
  return w;
}
/* A member's typing of page 0 of `doc`, and a second member's check of it. */
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
/* An inquiry whose legs each cite a row (`cid`) or a document whole, with an optional stated capture letter. */
const inquiry = (w, legs) => {
  const id = `INQ-2026-63${String(++qn).padStart(2, "0")}-t`;
  const lines = ["basis:", ...legs.flatMap((l) => [`  - target: ${l.target}`, "    role: supports",
    ...(l.cid ? [`    content_id: "${l.cid}"`] : []),
    ...(l.grade ? [`    grade: ${l.grade}`, "    grade_axis: capture", "    grade_source: capture"] : [])])];
  const r = w.promoteInquiry(id, inquiryMd(id, { refs: [...new Set(legs.map((l) => l.target))].map((t) => ({ target: t })),
                                                 extra: lines }));
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 400));
  return id;
};
const capture = (w, id) => { const r = w.s.strengthOf(id); assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300)); return r.capture; };
const memberOf = (axis, target) => [...(axis.population || []), ...(axis.not_load_bearing || [])].find((m) => m.target_id === target)
  ?? (axis.weakest && axis.weakest.target_id === target ? axis.weakest : null);

/* An AI transcription of DOC whose passage a member attested: leg-earning R15's passage, at the capture's own grade.
   Answers its content row, read off a question that cites it (the citation mints it). */
function attestedAi(w, doc) {
  const [cap] = w.doc(doc, ["read by an AI"], { chain: [{ step: "pixels", cap: null },
    { step: "ai_transcription", engine: "claude-reader", version: "1", cap: null, confidence: { basis: "none" } }] });
  const at = w.content.attestText({ captureSha: cap, member: "sam", at: AT, extent: { kind: "document" }, viewer: V("sam"),
                                    note: "Checked against the page." });
  assert.equal(at.ok, true, JSON.stringify(at).slice(0, 300));
  const probe = `INQ-2026-6399-probe${++qn}`;
  const r = w.promoteInquiry(probe, inquiryMd(probe, { refs: [{ target: doc }], extra: ["basis:", `  - target: ${doc}`, "    role: supports"] }));
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  return r.content[0].content_id;
}
const leg = (target, content_id, grade = null) => ({ target, role: "supports", content_id,
  ...(grade ? { grade, grade_axis: "capture", grade_source: "capture" } : {}) });

/* ------------------------------------------------------------------------------------------------ R46 */

test("R46 a leg on a typed passage counts at the passage's grade: checked typing (C) and unchecked typing (D) read D naming the unchecked typing; after its check, C; never B for a typing", () => {
  const w = world();
  const CHK = "INFO-2026-6302-typed", UNC = "INFO-2026-6303-typed";
  w.doc(CHK, ["a scanned deed"], { chain: null });
  w.doc(UNC, ["another scanned deed"], { chain: null });
  const c = type(w, CHK), u = type(w, UNC);
  check(w, c);
  const id = inquiry(w, [{ target: CHK, cid: c }, { target: UNC, cid: u }]);
  let axis = capture(w, id);
  assert.deepEqual([axis.state, axis.grade, axis.weakest?.target_id], ["graded", TYPED_UNCHECKED_GRADE, UNC],
                   JSON.stringify(axis).slice(0, 600));
  const typedLabel = w.k.earnedBasis({ id, viewer: "admin" }).earned.content[u].capture.typed.label;
  assert.ok(axis.weakest.why.includes(typedLabel), "its why names who typed it, by content R64's typed label");
  assert.doesNotMatch(axis.weakest.why, /Civicsmith read/);
  check(w, u);
  axis = capture(w, id);
  assert.deepEqual([axis.grade, axis.state], [TYPED_CHECKED_GRADE, "graded"], "after its check, C, with no one re-stating it");
  assert.notEqual(axis.grade, EARNED_CAPTURE_CEILING, "never B for a typing, though the capture's own letter is B");
});

test("R46 beside an attested AI passage (B): the axis reads D naming the unchecked typing, then C after its check; the AI passage alone reads B", () => {
  const w = world();
  const AI = "INFO-2026-6301-ai", CHK = "INFO-2026-6312-typed", UNC = "INFO-2026-6313-typed";
  const ai = attestedAi(w, AI);
  w.doc(CHK, ["a scanned deed"], { chain: null });
  w.doc(UNC, ["another scanned deed"], { chain: null });
  const c = type(w, CHK), u = type(w, UNC);
  check(w, c);
  const host = inquiry(w, [{ target: CHK, cid: c }]);
  const legs = [leg(AI, ai, EARNED_CAPTURE_CEILING), leg(CHK, c), leg(UNC, u)];
  let p = w.s.candidatePair({ inquiry: host, legs });
  assert.equal(p.error, null, p.error);
  assert.deepEqual([p.pair.capture.grade, p.pair.capture.weakest?.target_id], [TYPED_UNCHECKED_GRADE, UNC]);
  check(w, u);
  p = w.s.candidatePair({ inquiry: host, legs });
  assert.equal(p.pair.capture.grade, TYPED_CHECKED_GRADE);
  /* Control: the attested AI passage alone counts at the capture's own grade. */
  assert.equal(w.s.candidatePair({ inquiry: host, legs: [legs[0]] }).pair.capture.grade, EARNED_CAPTURE_CEILING);
});

test("R46 the same grade in every reading: inquiryStrength, candidatePair and recomputePair over gradingFacts agree with strengthOf", () => {
  const w = world();
  const DOC = "INFO-2026-6304-typed";
  w.doc(DOC, ["a scanned deed"], { chain: null });
  const cid = type(w, DOC);
  const id = inquiry(w, [{ target: DOC, cid }]);
  assert.equal(capture(w, id).grade, TYPED_UNCHECKED_GRADE);
  assert.equal(w.s.inquiryStrength({ id, viewer: "admin" }).capture.grade, TYPED_UNCHECKED_GRADE);
  const cand = w.s.candidatePair({ inquiry: id, legs: [{ target: DOC, role: "supports", content_id: cid }] });
  assert.equal(cand.error, null);
  assert.equal(cand.pair.capture.grade, TYPED_UNCHECKED_GRADE);
  const facts = w.s.gradingFacts({ inquiry: id, viewer: "admin" });
  assert.equal(facts.ok, true, JSON.stringify(facts).slice(0, 300));
  assert.equal(recomputePair({ legs: facts.legs, version: facts.method }).capture.grade, TYPED_UNCHECKED_GRADE);
  /* Control: the same candidate leg naming no passage is a document leg stating nothing, inert. */
  assert.equal(w.s.candidatePair({ inquiry: id, legs: [{ target: DOC, role: "supports" }] }).pair.capture.state, "unrated");
});

/* ------------------------------------------------------------------------------------------------ R47 */

test("R47 the method's new version names the typed-passage rule; earlier versions keep their words; a stored pair recomputes at its own version", () => {
  assert.equal(GRADING_METHOD_VERSION, "bio-grading/5");
  const words = gradingMethodText(GRADING_METHOD_VERSION);
  const rule = words.match(/^12\. Typed passages\..*$/m);
  assert.ok(rule, "rule 12 states the typed-passage rule");
  assert.match(rule[0], /typist's word/);
  assert.match(rule[0], /once a second member\s+has checked/);
  /* Take rule 12 out, renumber what is named, and version 4's words stand byte for byte. */
  const prev = GRADING_METHOD_VERSIONS.at(-2);
  assert.equal(prev, "bio-grading/4");
  assert.equal(words.replace(`(method ${GRADING_METHOD_VERSION})`, `(method ${prev})`).replace(`${rule[0]}\n`, "").replace(/^13\. /m, "12. "),
               gradingMethodText(prev));
  assert.doesNotMatch(gradingMethodText(prev), /Typed passages/, "control: version 4 has no such rule");
  /* Control: a stored pair keeps its version: the same recorded facts recompute at version 4 as they did. */
  const legs = [{ target: "INFO-2026-6305-x", kind: "document", role: "supports", grade: TYPED_CHECKED_GRADE, grade_axis: "capture",
                  grade_source: "capture" }];
  assert.equal(recomputePair({ legs, version: prev }).capture.grade, TYPED_CHECKED_GRADE);
});

test("R47 the grading facts of a leg on a typed passage say it is typed and whether it is checked, with no names", () => {
  const w = world();
  const DOC = "INFO-2026-6306-typed", PLAIN = "INFO-2026-6307-plain";
  w.doc(DOC, ["a scanned deed"], { chain: null });
  w.doc(PLAIN, ["publisher-typed"], { chain: null });
  const cid = type(w, DOC);
  const id = inquiry(w, [{ target: DOC, cid }, { target: PLAIN, grade: EARNED_CAPTURE_CEILING }]);
  let f = w.s.gradingFacts({ inquiry: id, viewer: "admin" });
  const typed = () => f.legs.find((l) => l.target === DOC);
  assert.deepEqual([typed().typed, typed().grade, typed().grade_axis], [{ checked: false }, TYPED_UNCHECKED_GRADE, "capture"]);
  assert.doesNotMatch(JSON.stringify(typed()), /ruth|sam/, "no names");
  check(w, cid);
  f = w.s.gradingFacts({ inquiry: id, viewer: "admin" });
  assert.deepEqual([typed().typed, typed().grade], [{ checked: true }, TYPED_CHECKED_GRADE]);
  assert.equal(f.legs.find((l) => l.target === PLAIN).typed, undefined, "control: a plain document leg is not typed");
});

/* ------------------------------------------------------------------------------------------------ notice leg-earning:138 */

test("notice leg-earning:138 (its R18, R19, R10): a typed leg stating no letter is graded by the record, not inert; stating A it reads the typing's grade with why; a weaker letter stands", () => {
  const w = world();
  const DOC = "INFO-2026-6308-typed", DOC2 = "INFO-2026-6309-typed", DOC3 = "INFO-2026-6310-typed";
  for (const d of [DOC, DOC2, DOC3]) w.doc(d, ["a scanned deed " + d], { chain: null });
  const a = type(w, DOC), b = type(w, DOC2), c = type(w, DOC3);
  let axis = capture(w, inquiry(w, [{ target: DOC, cid: a }]));
  assert.deepEqual([axis.state, axis.grade], ["graded", TYPED_UNCHECKED_GRADE], "stating nothing it counts at D");
  /* A letter above the capture's own is refused at write (inquiry's C-2.8), so a candidate states it. */
  axis = w.s.candidatePair({ inquiry: inquiry(w, [{ target: DOC, cid: a }]), legs: [leg(DOC2, b, "A")] }).pair.capture;
  assert.equal(axis.grade, TYPED_UNCHECKED_GRADE, "none above R18's grade is taken");
  assert.match(axis.weakest.why, /\bA\b/, "with why");
  check(w, c);
  axis = capture(w, inquiry(w, [{ target: DOC3, cid: c, grade: TYPED_UNCHECKED_GRADE }]));
  assert.equal(axis.grade, TYPED_UNCHECKED_GRADE, "a weaker stated letter stands under a checked typing");
  /* Controls (its R10, R20): a document leg stating nothing stays inert, and one naming no passage keeps the document's
     own ceiling. */
  const PLAIN = "INFO-2026-6311-plain";
  w.doc(PLAIN, ["publisher-typed"], { chain: null });
  assert.equal(capture(w, inquiry(w, [{ target: PLAIN }])).state, "unrated", "the record grades no other kind");
  assert.equal(capture(w, inquiry(w, [{ target: PLAIN, grade: EARNED_CAPTURE_CEILING }])).grade, EARNED_CAPTURE_CEILING);
});
