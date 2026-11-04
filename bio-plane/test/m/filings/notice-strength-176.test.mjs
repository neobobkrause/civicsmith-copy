/* filings — the provider notice `strength:176` (strength R46, R47 there, PR 176: a leg on a typed passage counts at
   the passage's grade, the typist's word, one step more once a second member checked it; the grading method's new
   version). This module states a never-published finding's grade as `strength.inquiryStrength` answers it (R9's facts
   section, kind `unpublished`), and a published one at the pair its edition froze. Driven at the module's interface over
   the real modules: a member types a page of a member document through `content.transcribe`, a second member checks it
   through `content.transcriptionAttest`, and the counsel packet's facts read the grade strength answers. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V, WHY, sha } from "./fixture.mjs";
import { TYPED_UNCHECKED_GRADE, TYPED_CHECKED_GRADE } from "../../../src/textchain.mjs";

const COUNSEL = { name: "A. Counsel", organisation: "Test Chambers" };

test("notice strength:176 (strength R46) R9 an unpublished finding resting on a member's typing reads, in the packet's facts, the typed passage's grade strength answers: the typist's word unchecked, one step more once a second member checked it", () => {
  const x = world();
  /* a document this copy fetched (publication's world: a direct receipt), so its capture is graded and a typing of it
     counts at the typing's own grade; the fixture's DOC is a member document, ungraded */
  const DOC = "INFO-2026-0176-deed";
  x.doc(DOC, { fetched: false });
  const rc = x.prov.recordReceipt({ address: `https://example.org/${DOC}`, addressNorm: `example.org/${DOC}`,
                                   captureSha: sha(`the text of ${DOC}`), retrieved: "2026-09-27T00:00:00Z", via: "direct" });
  assert.equal(rc.recorded, true, JSON.stringify(rc).slice(0, 300));
  const typed = x.f.content.transcribe({ bundleId: DOC, extent: { kind: "pdf-page", page: 0 }, text: "The order was let on 3 May.",
                                         transcriber: "bo", viewer: V("bo"), at: "2026-09-27T00:00:00Z" });
  assert.equal(typed.ok, true, JSON.stringify(typed).slice(0, 300));
  const Q = "INQ-2026-0176-typed";
  x.inquiry(Q, { extra: ["basis:", `  - target: ${DOC}`, "    role: supports", `    content_id: "${typed.content_id}"`],
                 legs: [], refs: [{ target: DOC }] });
  const A = x.action({ kind: "commitment_claim", legs: [{ target: Q, kind: "advances" }] });
  const f = x.filingsWith();
  const factOf = () => {
    const p = f.counselPacket({ reason: WHY, action: A, counsel: COUNSEL, author: V("olive"), viewer: V("olive") });
    assert.equal(p.ok, true, JSON.stringify(p).slice(0, 300));
    const it = p.sections.facts.items.find((i) => i.finding === Q);
    assert.ok(it, JSON.stringify(p.sections.facts).slice(0, 400));
    assert.equal(it.kind, "unpublished");
    return it;
  };
  const s = () => f.strength.inquiryStrength({ id: Q, viewer: V("olive") });
  let it = factOf();
  assert.equal(it.grade.source, `strength:${Q}`);
  assert.equal(it.grade.pair.capture.grade, TYPED_UNCHECKED_GRADE, JSON.stringify(it.grade).slice(0, 600));
  assert.deepEqual(it.grade.pair.capture, s().capture, "the pair as strength answers it, unchanged");
  const chk = x.f.content.transcriptionAttest({ contentId: typed.content_id, attestor: "cy", viewer: V("cy"),
                                               at: "2026-09-27T01:00:00Z", note: "The typing matches the page." });
  assert.equal(chk.ok, true, JSON.stringify(chk).slice(0, 300));
  it = factOf();
  assert.equal(it.grade.pair.capture.grade, TYPED_CHECKED_GRADE, "after its check, one step more, with no one re-stating it");
  assert.deepEqual(it.grade.pair.capture, s().capture);
});
