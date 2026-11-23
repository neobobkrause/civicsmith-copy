/* doc-clean: a package part that nothing changes is verified as it streams and written as it was (requirements R2,
 * R3, R4, R8). Its length and CRC-32 still decide whether the document is whole; its compressed bytes in the copy are
 * the original's; and a workbook whose one sheet is near CLEAN_MAX_PART_BYTES is cleaned without that sheet held
 * whole or deflated again, measured in a child. */
import "../../sandbox.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { inflateRawSync } from "node:zlib";
import { cleanDocument } from "../../../src/doc-clean/index.mjs";
import { readContainer, readPart } from "../../../src/ooxml.mjs";
import { xlsx, docx, png, makeZip, unzipCopy, has } from "./fixtures.mjs";

const run = promisify(execFile);
const SHEET = "xl/worksheets/sheet1.xml";

/** Each entry's own compressed bytes and method, by name, read from its local header. */
function rawParts(z) {
  const c = readContainer(z);
  assert.equal(c.ok, true);
  const b = Buffer.from(z);
  return new Map(c.entries.map((e) => {
    const at = e.localHeaderOffset, start = at + 30 + b.readUInt16LE(at + 26) + b.readUInt16LE(at + 28);
    return [e.name, { method: e.method, raw: b.subarray(start, start + e.compressedSize) }];
  }));
}

test("R2 R8 a part no rule changes is written with the original's own compressed bytes and method, and reads back whole, byte for byte; the changed parts are still changed", async () => {
  const sheet = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${
    Array.from({ length: 2000 }, (_, i) => `<row r="${i + 1}"><c r="A${i + 1}" t="inlineStr"><is><t>Line ${i}</t></is></c></row>`).join("")}</sheetData></worksheet>`;
  const parts = unzipCopy(xlsx()).parts.map((p) => ({ name: p.name, data: p.name === SHEET ? sheet : p.data }));
  const original = makeZip([...parts, { name: "xl/styles.bin", data: new Uint8Array(70_000).map((_, i) => (i * 7) & 255), method: 0 }]);
  const r = await cleanDocument(original);
  assert.equal(r.ok, true, r.detail);
  assert.equal(r.clean, false);
  const before = rawParts(original), after = rawParts(r.bytes);
  for (const name of [SHEET, "xl/styles.bin", "xl/_rels/workbook.xml.rels"]) {
    assert.equal(after.get(name).method, before.get(name).method, name);
    assert.ok(after.get(name).raw.equals(before.get(name).raw), `${name}: the original's compressed bytes`);
  }
  const c = readContainer(r.bytes);
  const read = await readPart(r.bytes, c, SHEET);
  assert.equal(read.ok, true);
  assert.equal(Buffer.from(read.bytes).toString("utf8"), sheet);
  assert.equal(has(r.bytes, "EDITORSECRET") || has(inflateRawSync(after.get("xl/workbook.xml").raw), "EDITORSECRET"), false, "the workbook's metadata is removed");
  assert.equal(has(inflateRawSync(after.get("xl/comments1.xml").raw), "COMMENTERSECRET"), false, "the comments' author is removed");
  assert.deepEqual(r.images, { stripped: 1, unchanged: 0 });
  assert.deepEqual(await cleanDocument(original), r, "the same bytes give the same answer");
});

test("R3 DOCUMENT_UNREADABLE: a part no rule changes that fails its CRC-32, or whose declared size is not its size, refuses the document naming it; nothing is answered but the refusal", async () => {
  const parts = unzipCopy(xlsx()).parts;
  for (const [what, over] of [["crc", { central: { crc32: 1 }, local: { crc32: 1 } }], ["short", { central: { uncompressedSize: 20 }, local: { uncompressedSize: 20 } }],
    ["long", { central: { uncompressedSize: 9000 }, local: { uncompressedSize: 9000 } }]]) {
    for (const method of [8, 0]) {
      if (method === 0 && what !== "crc") continue;
      const r = await cleanDocument(makeZip(parts.map((p) => ({ name: p.name, data: p.data, ...(p.name === SHEET ? { method, ...over } : {}) }))));
      assert.equal(r.ok, false, `${what}, method ${method}`);
      assert.equal(r.code, "DOCUMENT_UNREADABLE", `${what}, method ${method}`);
      assert.match(r.detail, /xl\/worksheets\/sheet1\.xml/);
      assert.equal(r.bytes, undefined);
    }
  }
});

test("R2 R3 a part judged by its first bytes: an image under any name is stripped, media under any name is refused, and a large plain part is not mistaken for either", async () => {
  const strip = await cleanDocument(docx({ extra: [{ name: "word/media/picture.bin", data: png() }] }));
  assert.equal(strip.ok, true, strip.detail);
  assert.equal(has(strip.bytes, "PNGSECRET"), false);
  assert.ok(strip.images.stripped >= 1);
  const wav = new Uint8Array(64);
  wav.set(Buffer.from("RIFF\0\0\0\0WAVEfmt "));
  const media = await cleanDocument(docx({ extra: [{ name: "word/fonts/font1.odttf", data: wav }] }));
  assert.equal(media.code, "EMBEDDED_MEDIA");
  assert.match(media.detail, /word\/fonts\/font1\.odttf/);
  const plain = await cleanDocument(docx({ extra: [{ name: "word/fonts/font2.odttf", data: new Uint8Array(200_000).map((_, i) => 33 + (i % 90)) }] }));
  assert.equal(plain.ok, true, plain.detail);
});

/* The measurement: a workbook of one sheet near CLEAN_MAX_PART_BYTES (the shape the plane meets with a 150,000-row
 * table), cleaned in a child; the heap and buffers it holds live above its idle, sampled every millisecond after a
 * collection while it works, are a small part of the sheet. Holding the sheet whole and its deflated copy beside it,
 * as the copy once did, is over 32 MB. What the inflation leaves for the collector is not held, and is not counted. */
test("R4 a workbook whose one sheet is near CLEAN_MAX_PART_BYTES is cleaned holding live under a quarter of the sheet's size above idle: the sheet is not held whole nor deflated again", { timeout: 300_000 }, async (t) => {
  const index = new URL("../../../src/doc-clean/index.mjs", import.meta.url).href, fixtures = new URL("./fixtures.mjs", import.meta.url).href;
  const child = `
import { cleanDocument, CLEAN_MAX_PART_BYTES } from ${JSON.stringify(index)};
import { xlsx, makeZip, unzipCopy } from ${JSON.stringify(fixtures)};
const row = (i) => '<row r="' + (i + 1) + '"><c r="A' + (i + 1) + '" t="inlineStr"><is><t>Item ' + i + ' of the budget</t></is></c><c r="B' + (i + 1) + '"><v>' + (i * 37 % 100003) + '</v></c></row>';
const rows = []; let n = 0;
for (let i = 0; n < CLEAN_MAX_PART_BYTES - 8192; i++) { const r = row(i); rows.push(r); n += r.length + 1; }
const sheet = '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + rows.join("\\n") + '</sheetData></worksheet>';
rows.length = 0;
const doc = makeZip(unzipCopy(xlsx()).parts.map((p) => ({ name: p.name, data: p.name === "xl/worksheets/sheet1.xml" ? sheet : p.data })));
const used = () => { const m = process.memoryUsage(); return m.heapUsed + m.arrayBuffers; };
for (let i = 0; i < 4; i++) { globalThis.gc(); await new Promise((r) => setTimeout(r, 5)); }
const idle = used(); let peak = idle;
const tick = setInterval(() => { globalThis.gc(); peak = Math.max(peak, used()); }, 1);
const r = await cleanDocument(doc);
peak = Math.max(peak, used());
clearInterval(tick);
console.log(JSON.stringify({ ok: r.ok, code: r.code, sheet: sheet.length, document: doc.length, copy: r.bytes?.length, aboveIdle: peak - idle }));`;
  /* one run: a collection before each sample leaves no late collector to average out */
  const best = JSON.parse((await run(process.execPath, ["--expose-gc", "--input-type=module", "-e", child], { maxBuffer: 1 << 24 })).stdout);
  t.diagnostic(`live above idle ${(best.aboveIdle / 1048576).toFixed(1)} MB for a sheet of ${(best.sheet / 1048576).toFixed(1)} MB in a document of ${(best.document / 1048576).toFixed(1)} MB`);
  assert.equal(best.ok, true, best.code);
  assert.ok(best.sheet > 30 * 1048576, "the sheet is near CLEAN_MAX_PART_BYTES");
  assert.ok(best.aboveIdle < best.sheet / 4, `${(best.aboveIdle / 1048576).toFixed(1)} MB above idle`);
});
