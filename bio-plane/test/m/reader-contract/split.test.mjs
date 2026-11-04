/* reader-contract after BOB's split from `reading-pipeline` (4 Nov 2026, PR 274): the module stands on its own (it imports nothing of
   `reading-pipeline`, layer order and its `uses`), and its pieces answer at its own interface: `completenessOf` (R48), `chunkUnits`
   (R47), `partsOf` (R65) and `interpretUnits` (R64), which reads a document's units only with the reader it is handed. The readers'
   behaviour through `reading-pipeline.read` stays tested in `reading-pipeline`'s tests, which call them through it. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import * as rc from "../../../src/reader-contract/index.mjs";

const SRC = new URL("../../../src/reader-contract/", import.meta.url);

test("reader-contract imports nothing of reading-pipeline: every relative import of its source stays outside src/reading-pipeline/", () => {
  const files = readdirSync(SRC).filter((f) => f.endsWith(".mjs"));
  assert.ok(files.includes("index.mjs") && files.includes("html.mjs"));
  for (const f of files) {
    const text = readFileSync(new URL(f, SRC), "utf8");
    const specs = [...text.matchAll(/\b(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]);
    for (const s of specs) assert.doesNotMatch(s, /reading-pipeline/, `${f} imports ${s}`);
  }
});

test("R48: completenessOf answers from the counters alone: whole, partial, none and stated", () => {
  assert.equal(rc.completenessOf({ written: 3, skipped: 0, owed: 0, failed: 0 }), "whole");
  assert.equal(rc.completenessOf({ written: 3, skipped: 1, owed: 0, failed: 0 }), "partial");
  assert.equal(rc.completenessOf({ written: 3, skipped: 0, owed: 0, failed: 0 }, { more: true }), "partial");
  assert.equal(rc.completenessOf({ written: 0, skipped: 0, owed: 0, failed: 0 }), "none");
  assert.equal(rc.completenessOf({ written: 0 }, { refused: true }), "stated");
});

test("R47: chunkUnits keeps every character, breaks at a space and carries the overlap of the words before the seam", () => {
  const text = Array.from({ length: 60000 }, (_, i) => `word${i}`).join(" ");
  const chunks = rc.chunkUnits(text, 4096);
  assert.ok(chunks.length > 1);
  assert.equal(chunks.map((c) => c.text).join(""), text);
  for (const c of chunks.slice(1)) assert.ok(c.overlap.length > 0);
  assert.equal(chunks[0].overlap, "");
});

test("R65: partsOf names a reading's pages in runs, in document order, with the shape of a part", () => {
  const reading = { page_count: 25, text_units: Array.from({ length: 25 }, (_, i) => ({ extent: { kind: "pdf-page", page: i, rect: null }, seq: i, text: `p${i}` })) };
  const p = rc.partsOf(reading);
  assert.deepEqual(p.parts.map((x) => [x.kind, x.from, x.to]), [["pdf-page", 0, 9], ["pdf-page", 10, 19], ["pdf-page", 20, 24]]);
  assert.deepEqual([p.total, p.truncated], [3, false]);
  assert.deepEqual(rc.partsOf({}), { parts: [], total: 0, truncated: false, why: "NO_UNITS" });
});

test("R64: interpretUnits with no reader handed in reads nothing and answers READING_FAILED; a part not of the four kinds is PART_NOT_VALID; never throws", async () => {
  const part = { kind: "pdf-page", from: 0, to: 0 };
  assert.deepEqual(await rc.interpretUnits({ capture: { content_type: "text/plain" } }, part, {}), { ok: false, reason: "READING_FAILED" });
  assert.deepEqual(await rc.interpretUnits({}, { kind: "nope" }, {}), { ok: false, reason: "PART_NOT_VALID" });
});
