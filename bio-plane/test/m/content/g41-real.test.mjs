/* content R52 (fix round 6, G41; K4636, K4639, K4642, K4645): `cellsAt` THROUGH THE REAL EXTRACTION, on the walker's shape. A 1 MB CSV is read by `readHeld` (the
   write path `op=readheld` and the plane's ledger call) under the platform's single-value limit (`platform-sqlite.mjs`, TEST-SUPPORT #9's preload: run this
   file with `node --import <that file> --test`), its sheet's cells are held, not listed (`cells_held`), and a member's cited range is answered by `cellsAt` from the
   held file by `extraction.cellsOf`. The cells expected are the generator's own. Red by name until the providers merge (csv-reader, office-readers,
   reading-pipeline: the entry that emits `cells_held`; extraction: `cellsOf`); g41-cells.test.mjs is the same cases on a stand-in. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fresh, bundle, bucket, doc, sha } from "../extraction/fixture.mjs";
import { registeredHomes } from "../provenance/fixtures.mjs";
import { contentOf } from "../../../src/content/index.mjs";

const csv = (bytes) => {
  const rows = ["id,name,amount,note"];
  for (let n = 20, i = 0; n < bytes; i++) { const r = `${i},"name ${i}",${(i * 37) % 9973}.${i % 100},"council note ${i} budget line"`; rows.push(r); n += r.length + 1; }
  rows.push(`LASTROWMARK,"last name",1.00,"the final row of the sheet"`);
  return rows;
};
/** The generator's cell values of row `r` (1-based, the header is row 1): the four fields, none of which holds a comma. */
const fieldsOf = (line) => [...line.matchAll(/"([^"]*)"|([^,]+)/g)].map((m) => m[1] ?? m[2]);
const COLS = "ABCD";

async function home(lines) {
  const evidence = bucket(), text = lines.join("\n") + "\n";
  const bytes = new TextEncoder().encode(text), d = sha(bytes);
  /* the capture's home is provenance's own: really promoted (its published fixture, K5044) */
  const homes = registeredHomes();
  const promoted = homes.register(d, { bundleId: "INFO-1", path: "table.csv", bytes: bytes.length, encoding: "binary" });
  assert.equal(promoted.ok, true, JSON.stringify(promoted).slice(0, 300));
  const w = fresh({ evidence, provenance: homes.provenance });
  bundle(w.s, "INFO-1");
  await evidence.put(`bio/captures/${d}`, bytes);
  const document = doc({ digest: d, bytes: bytes.length, ct: "text/csv", format: "csv", fromText: true });
  w.core.readFile = (b, p) => (b === "INFO-1" && p === "data/provenance.json" ? { text: JSON.stringify({ documents: [document] }) } : null);
  /* The read, to its end: the cursor loop `readHeld` answers `more` for. */
  let out;
  do out = await w.x.readHeld({ sha: d, kind: "reading", storeName: "bio", env: {} }); while (out && out.more);
  assert.deepEqual([out.ok, out.read], [true, true], JSON.stringify(out).slice(0, 300));
  const content = contentOf(w.ctx, { record: w.core, membership: w.membership, extraction: w.x,
                                    provenance: { capturesOf: () => [], onTestimony: () => ({ ok: true }) } });
  content.migrate();
  const sheet = (w.x.readingOf(d).reading.cells_held || [])[0];
  const cite = (extent) => {
    const m = content.mint({ bundleId: "INFO-1", captureSha: d, extent: { ...extent, sheet }, mintedBy: "member:bo" });
    assert.equal(m.ok, true, JSON.stringify(m));
    return m.content_id;
  };
  return { w, d, content, sheet, cite, lines };
}
const expectRows = (lines, from, to, cols = [1, 2, 3, 4]) => {
  const out = [];
  for (let r = from; r <= to; r++) { const f = fieldsOf(lines[r - 1]); for (const c of cols) out.push([`${COLS[c - 1]}${r}`, f[c - 1]]); }
  return out;
};
const shape = (cells) => cells.map((c) => [c.source.cell, c.value]);

test("R52 (G41 a): the last rows of a 1 MB CSV's held sheet are answered from the held file, equal to the generator's cells, naming the rows interpreted", async () => {
  const { w, d, content, sheet, cite, lines } = await home(csv(1_048_576));
  assert.equal(typeof sheet, "string", "the reading names its sheet in cells_held (the sheet's cells are held, not listed)");
  assert.equal(w.x.readingOf(d).reading.cells[sheet], null);
  const n = lines.length;
  const got = await content.cellsAt(cite({ kind: "sheet-range", range: `A${n - 3}:D${n}` }));
  assert.deepEqual(shape(got.cells), expectRows(lines, n - 3, n));
  assert.deepEqual(got.interpreted, { sheet, from_row: n - 3, to_row: n });
  assert.equal(got.cells_truncated, undefined);
  assert.equal(got.cells.at(-4).value, "LASTROWMARK");
});

test("R52 (G41 b): one cell of a 1 MB CSV's held sheet is one cell", async () => {
  const { content, cite, lines } = await home(csv(1_048_576));
  const n = lines.length;
  const got = await content.cellsAt(cite({ kind: "sheet-cell", cell: `D${n}` }));
  assert.deepEqual(shape(got.cells), expectRows(lines, n, n, [4]));
  /* K4647's numbering at its other end: row 1 is the sheet's first row (the header), column 1 is A. */
  const head = await content.cellsAt(cite({ kind: "sheet-range", range: "A1:B1" }));
  assert.deepEqual(shape(head.cells), expectRows(lines, 1, 1, [1, 2]));
  assert.deepEqual(head.interpreted.from_row, 1);
});

test("R52 (G41 b2): a column subset and a reversed-corner range of the held sheet answer exactly their cells", async () => {
  const { content, cite, lines } = await home(csv(1_048_576));
  const n = lines.length;
  const sub = await content.cellsAt(cite({ kind: "sheet-range", range: `B${n - 2}:C${n}` }));
  assert.deepEqual(shape(sub.cells), expectRows(lines, n - 2, n, [2, 3]));
  const rev = await content.cellsAt(cite({ kind: "sheet-range", range: `$C$${n}:b${n - 2}` }));
  assert.deepEqual(shape(rev.cells), shape(sub.cells));
});

test("R52 (G41 c): a small CSV lists its cells in the reading and `cellsAt` answers as before, with no `interpreted`", async () => {
  const lines = ["id,name,amount,note", `1,"a",2.50,"x"`, `2,"b",3.50,"y"`];
  const { w, content, sheet, d } = await home(lines);
  assert.equal(sheet, undefined, "a small sheet has no cells_held");
  assert.ok(w.x.readingOf(d).reading.cells, "its cells are listed in the reading");
  const m = content.mint({ bundleId: "INFO-1", captureSha: d, extent: { kind: "sheet-range", sheet: Object.keys(w.x.readingOf(d).reading.cells)[0], range: "A2:D3" }, mintedBy: "member:bo" });
  assert.equal(m.ok, true, JSON.stringify(m));
  const got = await content.cellsAt(m.content_id);
  assert.deepEqual(shape(got.cells), expectRows(lines, 2, 3));
  assert.equal("interpreted" in got, false);
});

test("R52 (G41 d): a range over the bound of one call (`CELLS_RANGE_MAX`) says `cells_truncated` and names `next_row`, with whole rows and no silent short list", async () => {
  const { content, cite, lines } = await home(csv(1_048_576));
  const n = lines.length;
  const got = await content.cellsAt(cite({ kind: "sheet-range", range: `A1:D${n}` }));
  assert.equal(got.cells_truncated, true);
  assert.ok(Number.isInteger(got.next_row) && got.next_row > 1 && got.next_row <= n, `next_row ${got.next_row}`);
  assert.equal(got.cells.length, (got.next_row - 1) * 4, "whole rows, from the first up to the row before next_row");
  assert.deepEqual(got.interpreted.to_row, got.next_row - 1);
  assert.deepEqual(shape(got.cells.slice(-4)), expectRows(lines, got.next_row - 1, got.next_row - 1));
});
