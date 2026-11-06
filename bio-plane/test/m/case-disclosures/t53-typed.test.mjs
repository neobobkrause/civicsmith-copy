/* case-disclosures T53: R37 (a typed passage is printed as typed) and R39 (the label is as of signing), with R38's
   "no choice" credit, which is every typing's while `case-tensions` holds no credit act for one.
   Over the module's own world (`fixture.mjs`): a member types a page through content's own `transcribe` and a second
   member checks it through `transcriptionAttest`, so the typing, its chain and its checks are the real modules'. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V, sha } from "./fixture.mjs";
import { contentOf } from "../../../src/content/index.mjs";
import { TYPED_FROZEN_UNCHECKED_KEY, TYPED_FROZEN_CHECKED_KEY } from "../../../src/basis-versions/index.mjs";
/* R38: the key a typist or checker with no credit choice is named by (this module's own). */
const TEAM_MEMBER_CREDIT_KEY = "credit.team_member";

const D1 = "INFO-2026-0001-a", Q = "INQ-2026-0001-q";
const TYPED_AT = "2026-09-27T00:00:00Z";
const TEXT = "Lot 7, Block 3, as typed from the page.";
const cited = (cid) => `"${cid}"`;

/* A finding on one typed page of D1, typed by alice. */
function typedWorld() {
  const w = world(); w.member("alice"); w.member("bo"); w.member("cy");
  w.doc(D1, {}, { receipt: true });
  const content = contentOf(w.host);
  const tx = content.transcribe({ bundleId: D1, extent: { kind: "pdf-page", page: 0 }, text: TEXT,
                                  transcriber: "alice", viewer: V("alice"), at: TYPED_AT });
  assert.equal(tx.ok, true, JSON.stringify(tx).slice(0, 300));
  w.finding(Q, [{ target: D1, content_id: cited(tx.content_id) }]);
  const check = (who, at) => {
    const r = content.transcriptionAttest({ contentId: tx.content_id, attestor: who, viewer: V(who), at,
                                            note: "The typing matches the page." });
    assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  };
  return { w, tx, check };
}

test("R37 (T53; DEC-464): a leg on a typed chain answers `quoted` as the typed words byte for byte, never null for want of an extracted unit, and carries `typed`", () => {
  const { w, tx } = typedWorld();
  w.clock.now = "2026-09-28T00:00:00Z";
  const f = w.cd.findingFacts([{ id: Q }], V("alice"));
  assert.equal(f.passages.length, 1);
  const p = f.passages[0];
  assert.equal(p.content_id, tx.content_id);
  assert.equal(p.quoted, TEXT);
  assert.ok(p.typed && typeof p.typed === "object", "the typed field is present");
  assert.equal(p.typed.label_key, TYPED_FROZEN_UNCHECKED_KEY);
});

test("R37 (control): a machine-read passage is unchanged: its quoted text is the extracted unit's, and it has no typed field", () => {
  const w = world(); w.member("alice");
  const a = w.doc(D1, {}, { receipt: true });
  w.content(sha("p0"), a, D1, "p0", JSON.stringify({ kind: "pdf-page", page: 0 }));
  w.finding(Q, [{ target: D1, content_id: cited(sha("p0")) }]);
  const f = w.cd.findingFacts([{ id: Q }], V("alice"));
  assert.equal(f.passages.length, 1);
  assert.equal(Object.hasOwn(f.passages[0], "typed"), false);
  assert.notEqual(f.passages[0].quoted, TEXT);
});

test("R39 (T53; DEC-464): the label is as of signing: typed, signed, then checked, the signed row has checked_by [] and the frozen unchecked key; a later edition lists the checker with the frozen checked key", () => {
  const { w, check } = typedWorld();
  w.clock.now = "2026-09-28T00:00:00Z";
  const signed = w.cd.findingFacts([{ id: Q }], V("alice")).passages[0].typed;
  check("bo", "2026-09-29T00:00:00Z");
  assert.deepEqual(signed.checked_by, []);
  assert.equal(signed.label_key, TYPED_FROZEN_UNCHECKED_KEY);
  assert.equal(signed.frozen_at, "2026-09-28T00:00:00Z");
  /* the same preparation instant still answers the signed label: a later check changes nothing signed */
  assert.deepEqual(w.cd.findingFacts([{ id: Q }], V("alice")).passages[0].typed, signed);
  w.clock.now = "2026-09-30T00:00:00Z";
  const later = w.cd.findingFacts([{ id: Q }], V("alice")).passages[0].typed;
  assert.equal(later.label_key, TYPED_FROZEN_CHECKED_KEY);
  assert.equal(later.checked_by.length, 1);
  assert.equal(later.checked_by[0].at, "2026-09-29T00:00:00Z");
  assert.equal(later.frozen_at, "2026-09-30T00:00:00Z");
});

test("R39 (control): a check before frozen_at appears, in time order; the typist is never a checker; R38's no-choice credit names no member id, handle or key", () => {
  const { w, check } = typedWorld();
  check("cy", "2026-09-27T03:00:00Z");
  check("bo", "2026-09-27T02:00:00Z");
  w.clock.now = "2026-09-28T00:00:00Z";
  const t = w.cd.findingFacts([{ id: Q }], V("alice")).passages[0].typed;
  assert.equal(t.label_key, TYPED_FROZEN_CHECKED_KEY);
  assert.deepEqual(t.checked_by.map((c) => c.at), ["2026-09-27T02:00:00Z", "2026-09-27T03:00:00Z"]);
  assert.equal(t.typist.key, TEAM_MEMBER_CREDIT_KEY);
  assert.ok(t.checked_by.every((c) => c.checker.key === TEAM_MEMBER_CREDIT_KEY));
  const said = JSON.stringify(t);
  for (const who of ["alice", "bo", "cy", "h_alice", "h_bo", "h_cy"])
    assert.equal(said.includes(`"${who}"`), false, `no id or handle of ${who}`);
});
