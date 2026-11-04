/* run-productions: the provider notice leg-earning:138 (PR 138: leg-earning R10, R18, R19, R20). This module reads one
   thing of leg-earning: `earned(null, [document])`'s capture ceiling for the document R21 reads inside (index.mjs
   #quoteTextFor). PR 138 adds, for a call naming no subject, a `connection_why` map saying "no subject named" (R20), and
   answers a typed passage's capture ceiling at the passage's grain (R18, R19, R10), only for content ids named. Neither
   moves the document-grain capture ceiling R21 keeps, so the module's code is confirmed unchanged. This test drives the
   real leg-earning, built by its own factory over this world's record, membership and content (K4990), never a stand-in. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { legEarningOf } from "../../../src/leg-earning/index.mjs";
import { provenanceOf } from "../../../src/provenance/index.mjs";
import { world, Q, DOC, ALICE } from "./fixture.mjs";

const AK = "class:ai/k1";
const P1 = { kind: "pdf-page", page: 0, ref: "page 1" };
const TEXT = ["The Board approved ordinance 12 on 3 March 2026, for $4,500.", "Minutes of the Clerk, page two."];
const OCR_B = [{ step: "pixels", extent: { kind: "pages", pages: [0, 1] } },
               { step: "ocr", engine: "tesseract", version: "5.3.4", cap: "B", confidence: { basis: "none" },
                 extent: { kind: "pages", pages: [0, 1] } }];

function realWorld() {
  const w = world();
  w.inquiry(Q);
  const cap = w.doc(DOC);
  w.ex.readings[cap] = { chain: OCR_B, pageCount: 2 };
  w.units(cap, TEXT);
  w.run("RUN-E", { mode: "extract", principal_plane: AK, mints: 10, pages: 3 });
  /* provenance, which leg-earning reads a capture's route grade from (its R1), the real one migrated on this host. */
  const provenance = provenanceOf(w.host, { record: w.record, membership: w.membership });
  provenance.migrate();
  const real = legEarningOf(w.host, { record: w.record, membership: w.membership, content: w.content, provenance });
  return { w, real };
}

test("notice leg-earning:138 (R20, R18; run-productions R21): the real earned(null, [document]) still answers the document's capture ceiling, beside R20's no-subject reason, and adds no passage grain when no content id is named", () => {
  const { real } = realWorld();
  const e = real.earned(null, [DOC]);
  assert.equal(e.earned.connection_why?.[DOC]?.reason, "NO_SUBJECT_NAMED", "R20: the no-subject reason is a map of its own");
  const c = e.earned.capture?.[DOC];
  assert.ok(c && "grade" in c, JSON.stringify(e.earned.capture));
  assert.equal(c.grain === "passage", false, "R18's passage grain answers only for content ids named");
  assert.equal(e.earned.content, undefined, "no content ids, no content map");
});

test("notice leg-earning:138 (run-productions R21): a verified quote keeps the ceiling the real leg-earning answers for the document", () => {
  const { w, real } = realWorld();
  w.p.legEarning = real;
  const want = real.earned(null, [DOC]).earned.capture[DOC].grade;
  assert.equal(want, "B", "a capture with no recorded route keeps the ceiling, B (leg-earning R1, provenance R26)");
  const r = w.p.extractPropose({ run: "RUN-E", bundleId: DOC, fn: "propose-reading", version: "0.1.0",
    refs: [{ ref: "the board", label: "The Board", quote: "The Board approved", source: P1 }],
    proposedBy: AK, viewer: ALICE, caller: AK });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  const p = r.proposed[0];
  assert.deepEqual([p.earned, p.verified_quote], [want, true]);
});
