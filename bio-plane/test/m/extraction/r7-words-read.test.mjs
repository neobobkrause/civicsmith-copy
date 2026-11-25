/* extraction R90, R91, R27 (fix round 7, G71; K4736): `words_read` of a PDF read in pieces. The first piece of a PDF read by page ranges answers
   `words_total` null (reading-pipeline R40, G56), so `readingFor` kept the first piece's `words_read` beside a reading that is whole. The
   override applies to any piece-read state, not only to one with `words_total`. Real PDF bytes through the real range reader (no scripted
   entry), each tick one `readHeld`, as the plane's ledger calls it. Each test names the requirement ids it checks. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fresh, bundle, bucket, doc, sha, homesOver } from "./fixture.mjs";
import { synthPdf } from "./bigpdf.mjs";
import { wordsIn } from "../../../src/reading-pipeline/index.mjs";

const register = (rows) => homesOver(rows);

async function pdfHome(pages) {
  const bytes = synthPdf({ pages, linesPerPage: 4, targetBytes: 0 });
  const rows = new Map(), evidence = bucket();
  const w = fresh({ evidence, provenance: register(rows) });
  bundle(w.s, "INFO-1");
  const d = sha(bytes);
  rows.set(d, { bundleId: "INFO-1", path: "a.pdf", encoding: "binary", bytes: bytes.length, registered: "t", authored: false });
  await evidence.put(`bio/captures/${d}`, bytes);
  const document = doc({ digest: d, bytes: bytes.length, ct: "application/pdf", format: "pdf" });
  w.core.readFile = (b, p) => (b === "INFO-1" && p === "data/provenance.json" ? { text: JSON.stringify({ documents: [document] }) } : null);
  return { w, d };
}
const toEnd = async (w, d) => {
  let ticks = 0, a;
  do { a = await w.x.readHeld({ sha: d, kind: "reading", storeName: "bio", env: {} }); ticks++; assert.equal(a.ok, true, JSON.stringify(a)); } while (a.more === true && ticks < 20);
  return ticks;
};
const wordsHeld = (w, d) => w.rows(`SELECT text FROM capture_text WHERE capture_sha=?`, d).reduce((n, r) => n + wordsIn(r.text), 0);

test("R90 R91 R27 (G71): a PDF read in several pieces states `words_read` as the sum of its pieces' words, beside completeness whole; not the first piece's", { timeout: 120_000 }, async () => {
  const { w, d } = await pdfHome(250);
  const first = await w.x.readHeld({ sha: d, kind: "reading", storeName: "bio", env: {} });
  assert.deepEqual([first.read, first.more], [true, true], JSON.stringify(first));
  const firstWords = w.x.readingFor(d, "class:admin").reading.words_read;
  assert.ok(firstWords > 0);
  const ticks = await toEnd(w, d);
  assert.ok(ticks >= 2, `${ticks} more ticks`);
  const got = w.x.readingFor(d, "class:admin");
  assert.equal(got.completeness.state, "whole");
  const held = wordsHeld(w, d);
  assert.ok(held > firstWords, "the later pieces hold words");
  assert.equal(got.reading.words_read, held, "the words read are the pieces' sum, as the index holds them");
  assert.ok(got.reading.words_read > firstWords, "not the first piece's");
});

test("R90 R91 R27 (G71): midway, `words_read` is the words of the pieces read so far", { timeout: 120_000 }, async () => {
  const { w, d } = await pdfHome(250);
  await w.x.readHeld({ sha: d, kind: "reading", storeName: "bio", env: {} });
  const r2 = await w.x.readHeld({ sha: d, kind: "reading", storeName: "bio", env: {} });
  assert.equal(r2.ok, true);
  const got = w.x.readingFor(d, "class:admin");
  assert.equal(got.more, true);
  assert.equal(got.reading.words_read, wordsHeld(w, d));
});

test("R90 R91 R27 (G71 control): a 5-page PDF read in one piece states its words, whole, and a reading with no piece state is answered as stored", { timeout: 60_000 }, async () => {
  const { w, d } = await pdfHome(5);
  await toEnd(w, d);
  const got = w.x.readingFor(d, "class:admin");
  assert.equal(got.completeness.state, "whole");
  assert.equal(got.reading.words_read, wordsHeld(w, d));
  const stored = JSON.parse(w.one(`SELECT reading FROM readings WHERE capture_sha=?`, d).reading);
  w.s.sql.exec(`DELETE FROM capture_text_state WHERE capture_sha=?`, d);
  assert.equal(w.x.readingFor(d, "class:admin").reading.words_read, stored.words_read, "no piece state: the stored figure, untouched");
});
