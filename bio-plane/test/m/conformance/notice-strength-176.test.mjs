/* The notice of strength PR 176 (its R46, R47), answered here. conformance passes strength's pairs through unchanged
   (R9): each finding's live pair is `strength.inquiryStrength`'s answer per axis and its frozen pair the one publication
   froze. Driven over the real modules (./fixture.mjs): a member types a page through `content.transcribe`, a second
   member checks it through `content.transcriptionAttest`, and a published finding rests on that typed passage. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { scene, V } from "./fixture.mjs";

const AT = "2026-09-27T00:00:00Z";
const TYPED = "INQ-2026-0176-typed";

function typedScene() {
  const s = scene();
  const { w, proj } = s;
  const doc = "INFO-2026-0176-scan";
  w.doc(doc);
  const tx = w.content.transcribe({ bundleId: doc, extent: { kind: "pdf-page", page: 0 }, text: "Lot 7, Block 3.",
                                    transcriber: "pat", viewer: V("pat"), at: AT });
  assert.equal(tx.ok, true, JSON.stringify(tx).slice(0, 300));
  w.inquiry(TYPED, { legs: [{ target: doc, role: "supports", content_id: tx.content_id }] });
  w.publish(TYPED, proj, { caseId: "CASE-2026-0176" });
  const d = w.c.determine(s.input({ findings: [TYPED] }));
  assert.equal(d.ok, true, JSON.stringify(d).slice(0, 400));
  return { ...s, doc, cid: tx.content_id, d };
}
const findingOf = (w, d) => {
  const r = w.c.determinationRead({ id: d.id, viewer: V("olive") });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  return r.findings.find((f) => f.finding === TYPED);
};

test("notice strength:176 (R46 via R9): a finding resting on an unchecked typed passage reads its live capture axis at D, at C once a second member checks it, never B; the frozen pair keeps its stored grade", () => {
  const { w, cid, d } = typedScene();
  const before = findingOf(w, d);
  assert.equal(before.live.capture.grade, "D");
  assert.deepEqual(before.frozen.capture, { state: "graded", grade: "B" });
  const ck = w.content.transcriptionAttest({ contentId: cid, attestor: "olive", viewer: V("olive"),
                                             at: "2026-09-27T01:00:00Z", note: "The typing matches the page." });
  assert.equal(ck.ok, true, JSON.stringify(ck).slice(0, 300));
  const after = findingOf(w, d);
  assert.equal(after.live.capture.grade, "C");
  assert.deepEqual(after.frozen.capture, { state: "graded", grade: "B" }, "a stored pair keeps its grade (R47's control)");
});
