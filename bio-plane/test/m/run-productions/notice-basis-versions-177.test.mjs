/* run-productions: the provider notice basis-versions:177 (PR 177, answering leg-earning:138; basis-versions R60, R10).
   PR 177 changed how basis-versions reads a version's legs back: a leg naming a member's typing (a content row the record
   grades, `record_graded`) is now graded by the record at the passage's ceiling and answers `graded_by`. This module
   reads that read back for R5's `record` group (`legs`), and writes through `appendVersion` (R4). R4 makes every
   suggested leg a document leg: the candidate's frontmatter carries no `content_id` (`suggestionFrontmatter`), so a
   leg sent naming a member's typing lands on the document, pinned to the capture R9 names. The new grading therefore
   never reaches a suggestion's legs, and R5's legs stay the bytes `op=basisversions` answers. Code confirmed unchanged.
   Driven on inquiry's real world, with the real basis-versions (its own factory, so its own inquiry and leg-earning) and
   the real content's typing (K4990); the run is the one stand-in, as this module's own fixture holds it (ai-runs' Terms). */
import test from "node:test";
import assert from "node:assert/strict";
import { world, V } from "../inquiry/fixture.mjs";
import { inquiryOf } from "../../../src/inquiry/index.mjs";
import { basisVersionsOf } from "../../../src/basis-versions/index.mjs";
import { runProductionsOf } from "../../../src/run-productions/index.mjs";

const AT = "2026-09-27T00:00:00Z";
const Q = "INQ-2026-5391-sugg", DOC = "INFO-2026-5391-typed";

function setup() {
  const w = world(); w.member("ruth"); w.member("alice");
  w.inquiry(Q);
  w.doc(DOC, ["a scanned deed"], { chain: null });
  const tx = w.content.transcribe({ bundleId: DOC, extent: { kind: "pdf-page", page: 0 }, text: "Lot 7, Block 3.",
                                    transcriber: "ruth", viewer: V("ruth"), at: AT });
  assert.equal(tx.ok, true, JSON.stringify(tx).slice(0, 300));
  const bv = basisVersionsOf(w.host, { record: w.record, membership: w.membership, promotion: w.promotion, content: w.content });
  bv.migrate();
  const inquiry = inquiryOf(w.host);
  const run = { run: "RUN-1", status: "running", mode: "check", context_type: "inquiry", context_id: Q, principal_plane: V("alice") };
  const aiRuns = { runFor: (r) => (r === "RUN-1" ? { ...run } : null), boundOf: () => null, consumeBound: () => ({ ok: true }) };
  const p = runProductionsOf(w.host, { record: w.record, membership: w.membership, content: w.content, connections: w.connections,
    extraction: w.extraction, basisVersions: bv, inquiry, aiRuns, now: () => Date.parse(AT) });
  p.migrate();
  const suggest = (name, leg) => p.suggest({ target: Q, kind: "basis-version", run: "RUN-1", name,
    description: "the deed names lot seven", claim: "lot seven", relationship: "and",
    legs: [{ target: DOC, role: "supports", ground: "paper", ...leg }],
    grounds: [{ ground: "paper", statement: "the typing of the deed" }],
    author: V("alice"), viewer: V("alice"), caller: V("alice") });
  return { w, bv, inquiry, tx, suggest };
}

test("notice basis-versions:177 (run-productions R4, R5): a suggested leg sent naming a member's typing lands as a document leg, so the record's typed grading (graded_by) never reaches it, and R5's legs are the bytes op=basisversions answers", () => {
  const { bv, inquiry, tx, suggest } = setup();
  /* The premise: the real record grades this typing (PR 177's input), so a leg on it would be graded by the record. */
  const typed = inquiry.earned(null, [DOC], [tx.content_id]).earned.content?.[tx.content_id]?.capture;
  assert.equal(typed?.record_graded, true, JSON.stringify(typed).slice(0, 300));
  const r = suggest("typed", { content_id: tx.content_id });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 400));
  assert.equal(r.read_back, true);
  const [leg] = r.legs;
  assert.notEqual(leg.content_id, tx.content_id, "R4: the leg is a document leg, never the typed passage");
  assert.equal(Object.hasOwn(leg, "graded_by"), false, "no record grading on a suggestion's leg");
  assert.deepEqual([leg.grade, leg.grade_authored, leg.grade_why], [null, null, null]);
  const read = bv.basisVersions({ id: Q, viewer: V("alice") }).versions.find((v) => v.name === "typed");
  assert.deepEqual(r.legs, read.legs, "R5: the legs are read back as op=basisversions reads them");
});

test("notice basis-versions:177 control: a stated capture letter on a suggested leg reads back as authored, the same bytes op=basisversions answers", () => {
  const { bv, suggest } = setup();
  const r = suggest("stated", { grade: "C", grade_axis: "capture", grade_source: "capture", note: "the deed's page" });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 400));
  const [leg] = r.legs;
  assert.equal(leg.grade_authored, "C");
  assert.equal(Object.hasOwn(leg, "graded_by"), false);
  const read = bv.basisVersions({ id: Q, viewer: V("alice") }).versions.find((v) => v.name === "stated");
  assert.deepEqual(r.legs, read.legs);
});
