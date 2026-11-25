/* extraction, fix round 6 wave 6 (T51; K4615; plan G38): `op=reading`'s answer is bounded by bytes (R93: a page of units holds about 1 MiB
   of unit text, a unit over the bound alone on its page; R94: a key of the stored reading over 256 KiB is named, never carried). The
   walker's cases: the Document screen's read of a long reading (1,328 units, 13.99 MB) and a 1 MB CSV whose `op=reading` answered
   12,872,074 B for 8 units, 11.8 MB of it the reading's `cells`. Each test names the requirement ids it checks. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fresh, bundle, bucket, doc, sha, homesOver } from "./fixture.mjs";
import { extractionOps, READING_PAGE_BYTES, READING_KEY_BYTES } from "../../../src/extraction/index.mjs";

const register = (rows) => homesOver(rows);
const viaOp = (w, d, after = null) => extractionOps(w.x, new URL(`http://x/reading?sha256=${d}&viewer=class:admin${after === null ? "" : `&after=${after}`}`), null, {}).reading();
const answerBytes = (a) => Buffer.byteLength(JSON.stringify(a));
const unit = (i, bytes) => ({ extent: { kind: "pdf-page", page: i }, text: String(i).padStart(5, "0") + " " + "x".repeat(bytes - 6) });

function written({ units = [], reading = {}, found = true } = {}) {
  const w = fresh({});
  bundle(w.s, "INFO-1");
  const d = sha("a long reading " + Math.random());
  w.x.writeReading({ bundleId: "INFO-1", captureSha: d, composed: true, textUnits: units,
    reading: { found, entities: [], content_type: "text/plain", text_source: null, basis: "t", ...reading } });
  return { w, d };
}

test("R93 (G38): a reading of 20 units of 100,000 B (2 MB) is answered in pages of about 1 MiB of unit text, `next` as before, and every unit is reached once, in order", () => {
  const { w, d } = written({ units: Array.from({ length: 20 }, (_, i) => unit(i, 100_000)) });
  const seen = []; let after = null, pages = 0;
  do {
    const a = viaOp(w, d, after);
    pages++;
    const bytes = a.text_units.reduce((n, u) => n + Buffer.byteLength(u.text), 0);
    assert.ok(bytes <= READING_PAGE_BYTES, `page ${pages} holds ${bytes} B of unit text`);
    assert.ok(a.text_units.length > 0);
    seen.push(...a.text_units.map((u) => u.text.slice(0, 5)));
    after = a.next;
  } while (after !== null && pages < 50);
  assert.equal(pages, 2, "2,000,000 B over a 1,048,576 B page");
  assert.deepEqual(seen, Array.from({ length: 20 }, (_, i) => String(i).padStart(5, "0")), "every unit once, in order");
});

test("R93 (G38): a unit over the byte bound is alone on its page, and a reading within both bounds is one page with next null (controls)", () => {
  const big = written({ units: [unit(0, 5000), unit(1, 5000), unit(2, 5000)] });
  const a = big.w.x.unitsOf(big.d, { maxBytes: 1000 });
  assert.equal(a.units.length, 1, "a unit over the bound is alone on its page");
  assert.equal(a.next, a.units[0].seq);
  const b = big.w.x.unitsOf(big.d, { after: a.next, maxBytes: 1000 });
  assert.equal(b.units.length, 1);
  assert.equal(big.w.x.unitsOf(big.d, { after: b.next, maxBytes: 1000 }).next, undefined, "the last page has no next");
  const small = written({ units: [unit(0, 500), unit(1, 500)] });
  const s = small.w.x.readingFor(small.d, "class:admin");
  assert.equal(s.text_units.length, 2);
  assert.equal(s.next, null);
  assert.equal(small.w.x.unitsOf(small.d).units.length, 2, "unitsOf without a byte bound is as it was");
});

test("R94 (G38): a key of the stored reading over 256 KiB is named in `reading_omitted` and left out of `reading`; every other key is carried; `readingOf` still answers it whole (R70)", () => {
  const cells = { "csv!A1": Array.from({ length: 6000 }, (_, i) => ({ source: `A${i}`, value: `value number ${i}`, type: "string" })) };
  assert.ok(JSON.stringify(cells).length > READING_KEY_BYTES);
  const { w, d } = written({ units: [unit(0, 500)], reading: { cells, page_count: 3 } });
  const a = viaOp(w, d);
  assert.equal("cells" in a.reading, false, "the bulky key is not carried");
  assert.deepEqual(a.reading_omitted, [{ key: "cells", bytes: JSON.stringify(cells).length }]);
  assert.equal(a.reading.page_count, 3);
  assert.equal(a.reading.found, true);
  assert.ok(answerBytes(a) < 20_000);
  assert.deepEqual(w.x.readingOf(d).reading.cells, cells, "the service a later reader uses answers the cells whole");
});

test("R94 (G38): controls: a reading whose keys are all within 256 KiB is answered whole with no `reading_omitted`; absent, empty and null `cells` stay three facts", () => {
  const some = { "csv!A1": [{ source: "A1", value: "1", type: "number" }] };
  for (const cells of [some, {}, null]) {
    const { w, d } = written({ units: [unit(0, 100)], reading: { cells } });
    const a = w.x.readingFor(d, "class:admin");
    assert.deepEqual(a.reading.cells, cells);
    assert.equal("reading_omitted" in a, false);
  }
  const { w, d } = written({ units: [unit(0, 100)] });
  assert.equal("cells" in w.x.readingFor(d, "class:admin").reading, false);
});

test("R93 R94 (G38): through the op: a 1 MB CSV, read by the real reader as the ledger reads it, answers `op=reading` under 2 MB in pages, its last row on the last page, `cells` named", async () => {
  let t = "id,name,amount,note\n"; let i = 0;
  while (t.length < 1_048_576) { t += `${i},"name ${i}",${(i * 37) % 9973}.${i % 100},"council note ${i} budget line"\n`; i++; }
  t += `LASTROWMARK,"last name",1.00,"the final row of the sheet"\n`;
  const rows = new Map(), evidence = bucket();
  const w = fresh({ evidence, provenance: register(rows) });
  bundle(w.s, "INFO-1");
  const bytes = new TextEncoder().encode(t), d = sha(bytes);
  rows.set(d, { bundleId: "INFO-1", path: "t.csv", encoding: "binary", bytes: bytes.length, registered: "t", authored: false });
  await evidence.put(`bio/captures/${d}`, bytes);
  const document = doc({ digest: d, bytes: bytes.length, ct: "text/csv", format: "csv", fromText: true });
  w.core.readFile = (b, p) => (b === "INFO-1" && p === "data/provenance.json" ? { text: JSON.stringify({ documents: [document] }) } : null);
  let a; do { a = await w.x.readHeld({ sha: d, kind: "reading", storeName: "bio", env: {} }); } while (a.more);
  let answer = viaOp(w, d), all = [...answer.text_units], guard = 0;
  assert.ok(answerBytes(answer) < 2_000_000, `the answer is ${answerBytes(answer)} B`);
  /* (G41) the sheet is held: its reading lists no cells (it names the sheet in `cells_held`), so no bulky key is left out of the answer */
  assert.deepEqual(answer.reading.cells_held, ["csv"]);
  assert.equal(answer.reading_omitted, undefined);
  while (answer.next !== null && guard++ < 20) { answer = viaOp(w, d, answer.next); assert.ok(answerBytes(answer) < 2_000_000); all = all.concat(answer.text_units); }
  assert.ok(all.some((u) => u.text.includes("LASTROWMARK")), "the last row is on a page");
});
