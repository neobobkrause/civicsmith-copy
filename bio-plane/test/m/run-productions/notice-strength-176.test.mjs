/* run-productions: the provider notice strength:176 (PR 176: strength R46, R47). PR 176 counts a leg on a member's
   typing at the passage's own grade (leg-earning R18, R19: D unchecked, C checked) in every reading of strength, the
   candidate pair included, when the leg names the passage's content row. This module asks `candidatePair` for C-27.9 and
   R5's `derived.pair` over the candidate's legs (R3). R4 makes every suggested leg a document leg, so the candidate legs
   it hands strength name no content row: a leg sent naming a typing is weighed as the document leg the suggestion writes,
   never at the typing's grade. Code confirmed unchanged. Driven on inquiry's real world with the real strength,
   basis-versions and content (K4990); the run is the one stand-in, as this module's own fixture holds it. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, V } from "../inquiry/fixture.mjs";
import { inquiryOf } from "../../../src/inquiry/index.mjs";
import { strengthOf } from "../../../src/strength/index.mjs";
import { basisVersionsOf } from "../../../src/basis-versions/index.mjs";
import { runProductionsOf } from "../../../src/run-productions/index.mjs";
import { TYPED_UNCHECKED_GRADE } from "../../../src/textchain.mjs";

const AT = "2026-09-27T00:00:00Z";
const Q = "INQ-2026-5392-sugg", DOC = "INFO-2026-5392-typed";

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
  const strength = strengthOf(w.host, { record: w.record, membership: w.membership });
  const run = { run: "RUN-1", status: "running", mode: "check", context_type: "inquiry", context_id: Q, principal_plane: V("alice") };
  const aiRuns = { runFor: (r) => (r === "RUN-1" ? { ...run } : null), boundOf: () => null, consumeBound: () => ({ ok: true }) };
  const p = runProductionsOf(w.host, { record: w.record, membership: w.membership, content: w.content, connections: w.connections,
    extraction: w.extraction, basisVersions: bv, inquiry, strength, aiRuns, now: () => Date.parse(AT) });
  p.migrate();
  const suggest = (name, leg) => p.suggest({ target: Q, kind: "basis-version", run: "RUN-1", name,
    description: "the deed names lot seven", claim: "lot seven", relationship: "and",
    legs: [{ target: DOC, role: "supports", ground: "paper", ...leg }],
    grounds: [{ ground: "paper", statement: "the typing of the deed" }],
    author: V("alice"), viewer: V("alice"), caller: V("alice") });
  return { p, strength, tx, suggest };
}

test("notice strength:176 (run-productions R3, R4, R5): a suggested leg sent naming a member's typing is weighed as the document leg the suggestion writes, never at the typing's grade (strength R46)", () => {
  const { p, strength, tx, suggest } = setup();
  assert.equal(p.strength, strength, "the real strength, the one this module asks");
  /* The premise: the real candidate pair counts a leg naming this typing at the typing's grade (R46). */
  const premise = strength.candidatePair({ inquiry: Q, legs: [{ target: DOC, role: "supports", ground: "paper", content_id: tx.content_id }] });
  assert.equal(premise.pair?.capture?.grade, TYPED_UNCHECKED_GRADE, JSON.stringify(premise).slice(0, 400));
  const r = suggest("typed", { content_id: tx.content_id });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 400));
  assert.notEqual(r.pair.capture.grade, TYPED_UNCHECKED_GRADE, "R4: weighed as a document leg, not the typing");
  assert.equal(r.pair.capture.state, "unrated", "a document leg stating no letter counts nothing");
  assert.equal(Object.hasOwn(r.legs[0], "graded_by"), false);
});

test("notice strength:176 control: a capture letter stated on the document leg is weighed, and the same suggestion differing only in the typing it named is the same in substance (C-27.10)", () => {
  const { suggest, tx } = setup();
  const typed = suggest("typed", { content_id: tx.content_id });
  assert.equal(typed.ok, true, JSON.stringify(typed).slice(0, 400));
  const again = suggest("plain", {});
  assert.deepEqual([again.ok, again.code], [false, "SUGGEST_NOT_DIFFERENT"], "the named typing is not part of what was suggested");
  const stated = suggest("stated", { grade: "C", grade_axis: "capture", grade_source: "capture", note: "the deed's page" });
  assert.equal(stated.ok, true, JSON.stringify(stated).slice(0, 400));
  assert.deepEqual([stated.pair.capture.state, stated.pair.capture.grade], ["graded", "C"], JSON.stringify(stated.pair.capture).slice(0, 300));
});
