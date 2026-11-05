/* run-productions: the provider notice basis-versions:356 (PR 356; basis-versions R59, R60; exports
   TYPED_FROZEN_CHECKED_KEY, TYPED_FROZEN_UNCHECKED_KEY). PR 356 makes `op=basisversions` answer, on each leg whose content
   row is a member's typing, `typed_at_freeze` and `typed`, derived at the read. This module copies the read-back legs into
   R5's `record` group. R4 makes every suggested leg a document leg (no `content_id`), so a suggestion's legs never carry
   the new keys, even when the leg was sent naming a typing that a member has since checked; and the legs stay the bytes
   `op=basisversions` answers (R5). Code confirmed unchanged. Driven on inquiry's real world with the real basis-versions
   and the real content's typing and attestation (K4990); the run is the one stand-in, as this module's fixture holds it. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, V } from "../inquiry/fixture.mjs";
import { inquiryOf } from "../../../src/inquiry/index.mjs";
import { basisVersionsOf } from "../../../src/basis-versions/index.mjs";
import { runProductionsOf } from "../../../src/run-productions/index.mjs";

const AT = "2026-09-27T00:00:00Z";
const Q = "INQ-2026-5392-sugg", DOC = "INFO-2026-5392-typed";

function setup() {
  const w = world(); w.member("ruth"); w.member("alice"); w.member("bob");
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
  return { w, bv, tx, suggest };
}

test("notice basis-versions:356 (run-productions R4, R5): a suggested leg sent naming a member's typing carries neither typed_at_freeze nor typed, before or after a check, and R5's legs are the bytes op=basisversions answers", () => {
  const { w, bv, tx, suggest } = setup();
  const r = suggest("typed", { content_id: tx.content_id });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 400));
  assert.equal(r.read_back, true);
  const [leg] = r.legs;
  assert.notEqual(leg.content_id, tx.content_id, "R4: a document leg, never the typed passage");
  assert.equal(Object.hasOwn(leg, "typed_at_freeze"), false);
  assert.equal(Object.hasOwn(leg, "typed"), false);
  const read = () => bv.basisVersions({ id: Q, viewer: V("alice") }).versions.find((v) => v.name === "typed");
  assert.deepEqual(r.legs, read().legs, "R5: the legs read back as op=basisversions reads them");
  /* a later check of the typing (R60's case) moves nothing on the suggestion's legs */
  const att = w.content.transcriptionAttest({ contentId: tx.content_id, attestor: "bob", viewer: V("bob"), at: "2026-09-28T00:00:00Z",
    note: "read page one against the deed" });
  assert.equal(att?.ok, true, JSON.stringify(att).slice(0, 300));
  assert.deepEqual(read().legs, r.legs, "a check after the suggestion leaves its legs as R5 answered them");
});
