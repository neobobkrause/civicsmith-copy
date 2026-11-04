/* reading-pipeline R55 (fix round 9, G126b, G126j; K4811 (6)): the inline pass makes no OCR call, and the `owe` hook is retired.
 * Through `read`, over real PDF bytes in the registered `pdf` entry, with a counting OCR member honouring its one-page contract. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fresh, hold, doc, evidenceStore } from "./fixture.mjs";
import { scanPdf, chunked } from "./scans.mjs";
import { read } from "../../../src/reading-pipeline/index.mjs";

const pdfDoc = (digest, bytes) => doc({ digest, bytes, ct: "application/pdf", format: "pdf" });

test("R55 (G126b): read with ocrInvocations 0 makes no OCR call: a 3-page scan states every page ocr_left and counts them owed, whole read and first piece alike", async () => {
  for (const pieces of [{}, { cursor: null }]) {
    const bytes = scanPdf(3);
    const m = chunked();
    const w = fresh({ env: { OCR_WORKER: m } });
    const d = await hold(w.evidence, bytes);
    const out = await read(pdfDoc(d, bytes.length), { evidence: evidenceStore(w.evidence), env: w.env, ocrInvocations: 0, ...pieces });
    assert.equal(m.calls.length, 0, "no OCR call inside the request");
    assert.deepEqual(out.reading.ocr_left, { cursor: 0, pages: 3 });
    assert.equal(out.counters.owed, 3, "the pages are owed, counted");
    assert.equal(out.reading.tier3_candidate, true);
    assert.notEqual(out.reading.failure, "final", "pages owed are read by the ticks that follow, never a final reading");
  }
});

test("R55 control: without ocrInvocations the continuation's read calls the OCR member as R4 states, one page a call", async () => {
  const bytes = scanPdf(3);
  const m = chunked();
  const w = fresh({ env: { OCR_WORKER: m } });
  const d = await hold(w.evidence, bytes);
  const out = await read(pdfDoc(d, bytes.length), { evidence: evidenceStore(w.evidence), env: w.env });
  assert.equal(m.calls.length, 3);
  assert.equal(out.reading.ocr_left, undefined);
  assert.equal(out.counters.owed, 0);
});

test("R55 R37 (G126j): the owe hook is retired: a hook handed in is never called, and the module's source calls no owe", async () => {
  const bytes = scanPdf(30);
  const w = fresh({ env: { OCR_WORKER: chunked() } });
  const d = await hold(w.evidence, bytes);
  const owed = [];
  const out = await read(pdfDoc(d, bytes.length), { evidence: evidenceStore(w.evidence), env: w.env, owe: async (o) => { owed.push(o); } });
  assert.deepEqual(out.reading.ocr_left, { cursor: 24, pages: 6 });
  assert.equal(out.counters.owed, 6);
  assert.deepEqual(owed, [], "nothing here registers owed work");
  /* this module's source and, since BOB's split (PR 274), `reader-contract`'s, which it re-exports */
  const src = ["../../../src/reading-pipeline/index.mjs", "../../../src/reader-contract/index.mjs"].map((f) => readFileSync(new URL(f, import.meta.url), "utf8")).join("\n");
  assert.doesNotMatch(src, /\bowe\s*\(/, "no call of an owe hook remains");
});
