/* The notice of strength PR 176 (its R46, R47; DEC-464), answered here: a leg on a typed passage now counts on the
   capture axis at the typing's grade (D unchecked, C once a second member checked it). This module reads strength
   through `strengthOf` only (R4: the pair carried unaltered; R17: `weakened` when the derived pair reads below a
   published edition's frozen one), so it is confirmed with no code change. Driven over the real modules (this
   module's fixture: content, inquiry, strength, each the real one); a member types a page through
   `content.transcribe`, a second member checks it through `content.transcriptionAttest`. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, V } from "./fixture.mjs";
import { TYPED_UNCHECKED_GRADE, TYPED_CHECKED_GRADE } from "../../../src/textchain.mjs";

const ADMIN = "class:admin";
const DOC = "INFO-2026-7601-typed", DEP = "INQ-2026-7601-dep";
const AT = "2026-09-27T00:00:00Z";

function typedWorld() {
  const w = world();
  w.member("ruth"); w.member("sam");
  w.doc(DOC);
  const tx = w.content.transcribe({ bundleId: DOC, extent: { kind: "pdf-page", page: 0 }, text: "Lot 7, Block 3.",
                                    transcriber: "ruth", viewer: V("ruth"), at: AT });
  assert.equal(tx.ok, true, JSON.stringify(tx).slice(0, 300));
  w.inquiry(DEP, { legs: [{ target: DOC, content_id: `"${tx.content_id}"` }] });
  const check = () => {
    const r = w.content.transcriptionAttest({ contentId: tx.content_id, attestor: "sam", viewer: V("sam"),
                                              at: "2026-09-27T01:00:00Z", note: "The typing matches the page." });
    assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  };
  return { w, check };
}

test("notice strength:176 R4: an obligation's strength is strength's own pair for a leg on a typed passage (D unchecked, C checked), unaltered", () => {
  const { w, check } = typedWorld();
  w.publish(DEP, 1, { capture: { state: "graded", grade: "B" } });
  let [o] = w.r.reevaluations({ target: DEP, viewer: ADMIN }).obligations;
  const own = w.strength.strengthOf(DEP);
  assert.deepEqual([o.strength.capture.state, o.strength.capture.grade, o.strength.capture.weakest?.target_id],
                   ["graded", TYPED_UNCHECKED_GRADE, DOC], JSON.stringify(o.strength.capture).slice(0, 400));
  assert.deepEqual(o.strength.capture, own.capture, "carried as strength answers it");
  assert.doesNotMatch(o.strength.capture.weakest.why, /Civicsmith read/);
  check();
  [o] = w.r.reevaluations({ target: DEP, viewer: ADMIN }).obligations;
  assert.equal(o.strength.capture.grade, TYPED_CHECKED_GRADE, "after its check, C");
  assert.deepEqual(o.strength.capture, w.strength.strengthOf(DEP).capture);
});

test("notice strength:176 R17: an edition frozen at B whose leg rests on a typing now derives weaker and carries `weakened`; at C after the check, none", () => {
  const { w, check } = typedWorld();
  w.publish(DEP, 1, { capture: { state: "graded", grade: "B" } });
  let r = w.r.reevaluations({ viewer: ADMIN });
  assert.equal(r.count, 1);
  assert.deepEqual(r.obligations[0].causes.map((c) => c.source), ["weakened"]);
  assert.deepEqual(r.obligations[0].causes[0].axes, [{ axis: "capture", frozen: { state: "graded", grade: "B" },
                                                       derived: { state: "graded", grade: TYPED_UNCHECKED_GRADE } }]);
  check();
  r = w.r.reevaluations({ viewer: ADMIN });
  assert.deepEqual(r.obligations[0].causes[0].axes[0].derived, { state: "graded", grade: TYPED_CHECKED_GRADE },
                   "still below B once checked: a typing never reads B");
  /* Control: an edition frozen at the checked typing's own grade reads nothing weaker. */
  w.publish(DEP, 2, { capture: { state: "graded", grade: TYPED_CHECKED_GRADE } });
  assert.equal(w.r.reevaluations({ viewer: ADMIN }).count, 0);
});
