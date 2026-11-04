/* notice strength:176 (its R46, R47; PR 176): a leg on a typed passage counts at the passage's grade (D unchecked,
   C checked), and the grading method gains a version. This module reads strength only through `inquiryStrength` for an
   established causation (R5) and answers its pair per axis, never composed (R11, R12); it states no grade and no method
   version of its own. Confirmed with no code change: a part whose causation inquiry rests on a member's typing of a page
   answers the causation's capture axis at the typing's grade, D before a second member checks it and C after, never the
   capture's own B, read live through the real strength, content and inquiry on this module's world. The one change is this
   module's test world: it handed strength an `inquiry` whose `earned` dropped the passage ids strength now passes
   (R46's third argument), so a typed passage read as ungraded; it now passes every argument through. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, V, inquiryMd } from "./fixture.mjs";
import { TYPED_UNCHECKED_GRADE, TYPED_CHECKED_GRADE } from "../../../src/textchain.mjs";
import { EARNED_CAPTURE_CEILING } from "../../../src/record-grammar/index.mjs";

const S = "STD-2026-0001-law";
const INQ = "INQ-2026-0176-cause";
const DOC = "INFO-2026-0176-deed";

/* The causation inquiry, concluded, its one leg citing `cid` (a passage of DOC), stating `grade` on capture if given. */
function causation(w, cid, grade = null) {
  const stated = grade ? `\n    grade: ${grade}\n    grade_axis: capture\n    grade_source: capture` : "";
  let n = 0;
  for (const [state, prior] of [["open", "null"], ["concluded", "open"]]) {
    const md = inquiryMd(INQ, { state, prior, target: DOC })
      .replace(`basis:\n  - target: ${DOC}\n    role: supports`, `basis:\n  - target: ${DOC}\n    role: supports\n    content_id: "${cid}"${stated}`);
    assert.match(md, /content_id:/);
    const head = w.record.head(INQ);
    const res = w.promotion.promote({ bundleId: INQ, base: head ? head.bundleSha : null, snapKey: `n176-${++n}`,
      author: V("alice"), files: [{ path: "bundle.md", text: md }], meta: { object_type: "inquiry" } });
    assert.equal(res.ok, true, JSON.stringify(res).slice(0, 600));
  }
}

function setup({ typed = true } = {}) {
  const w = world();
  w.D = w.determination("CONF-2026-0176-act", w.P, { [S]: "noncompliant" });
  const cap = w.doc(DOC, "Lot 7, Block 3.");
  w.receipt(cap, `example.org/${DOC}`);
  let cid;
  if (typed) {
    const tx = w.content.transcribe({ bundleId: DOC, extent: { kind: "pdf-page", page: 0 }, text: "Lot 7, Block 3.",
                                      transcriber: "alice", viewer: V("alice"), at: "2026-09-27T00:00:00Z" });
    assert.equal(tx.ok, true, JSON.stringify(tx).slice(0, 300));
    cid = tx.content_id;
  } else {
    cid = w.passage(DOC, cap, "Lot 7, Block 3.");
  }
  /* Control: a passage the capture holds counts at a stated letter bounded by the capture (a plain document leg
     stating none is inert, strength R3). */
  causation(w, cid, typed ? null : EARNED_CAPTURE_CEILING);
  const r = w.c.consequenceRecord({ determination: w.D, standard: S, affected: { kind: "fund", description: "a fund" },
    period: { from: "2026-01-01", to: "2026-12-31" }, measure: { unit: "count", value: 3 }, basis: { rationale: "r" },
    causation: INQ, author: V("alice") });
  assert.equal(r.ok, true, JSON.stringify(r));
  w.id = r.id; w.cid = cid;
  return w;
}
const causationOf = (w) => {
  const r = w.c.consequencesOf({ determination: w.D, viewer: V("alice") });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  return r.parts.find((p) => p.id === w.id).causation;
};

test("notice strength:176 (its R46, R47): a causation resting on a typed passage answers its capture axis at the typing's grade, D unchecked then C checked, never B", () => {
  const w = setup();
  let c = causationOf(w);
  assert.equal(c.state, "established");
  assert.deepEqual([c.strength.capture.state, c.strength.capture.grade], ["graded", TYPED_UNCHECKED_GRADE],
                   JSON.stringify(c.strength.capture).slice(0, 400));
  assert.ok(c.strength.connection && c.strength.testimony, "the pair stays per axis, never composed");
  const chk = w.content.transcriptionAttest({ contentId: w.cid, attestor: "bob", viewer: V("bob"),
                                             at: "2026-09-27T01:00:00Z", note: "The typing matches the page." });
  assert.equal(chk.ok, true, JSON.stringify(chk).slice(0, 300));
  c = causationOf(w);
  assert.equal(c.strength.capture.grade, TYPED_CHECKED_GRADE, "after its check, C, read live with no revision of the part");
  assert.notEqual(c.strength.capture.grade, EARNED_CAPTURE_CEILING, "never the capture's own B for a typing");
  /* The same live answer through the part's own read. */
  assert.equal(w.c.consequenceRead({ id: w.id, viewer: V("alice") }).part.causation.strength.capture.grade, TYPED_CHECKED_GRADE);
});

test("notice strength:176 control: a causation resting on a passage the capture holds, stating its letter, keeps the capture's grade B", () => {
  const w = setup({ typed: false });
  const c = causationOf(w);
  assert.equal(c.strength.capture.grade, EARNED_CAPTURE_CEILING, JSON.stringify(c.strength.capture).slice(0, 400));
});
