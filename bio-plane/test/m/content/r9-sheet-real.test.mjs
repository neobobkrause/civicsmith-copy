/* content R61 and R46 (fix round 9, G128g; K4831, K4837): `heldTextAt` THROUGH THE REAL EXTRACTION. A comma CSV and an xlsx sheet over the unit cap are read by
   `readHeld` (the write path the plane's ledger calls), their sheets held as blocks that each repeat the header, and a `document` extent's text read by
   `passageText` is the file's lines once each. Run with the platform's single-value shim: `node --import ./test/platform-sqlite.mjs --test`. The size is the
   smallest that shows the cause (a sheet over `CAPTURE_TEXT_UNIT_CAP`, 128 KiB); the walker's 18,098 rows are the corpus's and the seam's (control-plane,
   section 4). Controls: a sheet just under the cap (one unit) and just over it (two blocks).
   RED BY NAME (R-SEAM) until extraction-2 (job 41) merges: `unitsOf` stores no `lineRows` today (extraction R107), so the block's repeated header cannot yet
   be told from a data line; r9-units.test.mjs holds the same cases on units shaped as that contract states. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fresh, bundle, bucket, doc, sha } from "../extraction/fixture.mjs";
import { xlsx } from "./realread.mjs";
import { registeredHomes } from "../provenance/fixtures.mjs";
import { contentOf } from "../../../src/content/index.mjs";
import { heldTextAt, normUnits } from "../../../src/content/notice.mjs";

const CAP = 128 * 1024;
/** `n` data rows under a header, the fields of each a function of its row; one in `multi` has a quoted line break. */
function rowsOf(n, { multi = 0 } = {}) {
  const rows = [["id", "name", "amount", "note"]];
  for (let i = 0; i < n; i++)
    rows.push([String(i), `name ${i}`, `${(i * 37) % 9973}.${i % 100}`, multi && i % multi === 0 ? `council line one ${i}\nline two ${i}` : `council note ${i} budget line`]);
  return rows;
}
const csvOf = (rows) => rows.map((r) => r.map((f) => (/[",\n]/.test(f) ? `"${f.replace(/"/g, '""')}"` : f)).join(",")).join("\n") + "\n";
/** The text a reader gives a sheet: each row's cells tab-joined, a line break inside a quoted field kept. */
const textOf = (rows) => rows.map((r) => r.join("\t")).join("\n");
/** Rows until the sheet text is `target` characters (the CSV's row text is what the unit cap counts). */
function rowsToSize(target, opts) {
  let n = 1;
  for (let lo = 0, hi = 200000; lo < hi;) { const mid = (lo + hi + 1) >> 1; if (textOf(rowsOf(mid, opts)).length <= target) lo = mid; else hi = mid - 1; n = lo; }
  return rowsOf(n, opts);
}

async function home(bytes, { format, ct }) {
  const evidence = bucket();
  const d = sha(bytes);
  /* the capture's home is provenance's own: really promoted (its published fixture, K5044) */
  const homes = registeredHomes();
  const promoted = homes.register(d, { bundleId: "INFO-1", path: "table", bytes: bytes.length, encoding: "binary" });
  assert.equal(promoted.ok, true, JSON.stringify(promoted).slice(0, 300));
  const w = fresh({ evidence, provenance: homes.provenance });
  bundle(w.s, "INFO-1");
  await evidence.put(`bio/captures/${d}`, bytes);
  const document = doc({ digest: d, bytes: bytes.length, ct, format, fromText: format === "csv" });
  w.core.readFile = (b, p) => (b === "INFO-1" && p === "data/provenance.json" ? { text: JSON.stringify({ documents: [document] }) } : null);
  let out;
  do out = await w.x.readHeld({ sha: d, kind: "reading", storeName: "bio", env: {} }); while (out && out.more);
  assert.deepEqual([out.ok, out.read], [true, true], JSON.stringify(out).slice(0, 300));
  const content = contentOf(w.ctx, { record: w.core, membership: w.membership, extraction: w.x,
                                    provenance: { capturesOf: () => [], onTestimony: () => ({ ok: true }) } });
  content.migrate();
  const whole = content.mint({ bundleId: "INFO-1", captureSha: d, extent: { kind: "document" }, mintedBy: "member:bo" });
  assert.equal(whole.ok, true, JSON.stringify(whole));
  return { w, d, content, id: whole.content_id };
}
const csvHome = (rows) => home(new TextEncoder().encode(csvOf(rows)), { format: "csv", ct: "text/csv" });

test("R61 (G128g): the text of a comma CSV over the unit cap is its lines once each: the repeated header of every later block is not a data line", async () => {
  const rows = rowsToSize(3 * CAP);
  const { w, d, content, id } = await csvHome(rows);
  const units = w.x.unitsOf(d);
  assert.ok(units.units.length >= 3, `the sheet is held as blocks (${units.units.length} units)`);
  const heads = units.units.filter((u) => u.text.startsWith("id\tname\tamount\tnote\n") || u.text === "id\tname\tamount\tnote");
  assert.ok(heads.length >= 3, "each later block repeats the header (the cause)");
  assert.equal(units.state, "whole");
  const text = content.passageText(id);
  assert.equal(text, textOf(rows), "every row once, in order, the header once");
  assert.equal(text.split("\n").filter((l) => l === "id\tname\tamount\tnote").length, 1);
});

test("R61 (G128g): a CSV with quoted line breaks keeps every line of a record and drops only a block's repeated header, across the cut", async () => {
  const rows = rowsToSize(2 * CAP + 5000, { multi: 7 });
  const { d, w, content, id } = await csvHome(rows);
  assert.ok(w.x.unitsOf(d).units.length >= 2);
  assert.equal(content.passageText(id), textOf(rows));
});

test("R61 (G128g): the controls: a sheet just under the cap is one unit and one just over is two blocks, each read as the file's lines once", async () => {
  for (const [target, blocks] of [[CAP - 1024, 1], [CAP + 1024, 2]]) {
    const rows = rowsToSize(target);
    const { d, w, content, id } = await csvHome(rows);
    assert.equal(w.x.unitsOf(d).units.length, blocks, `${target} characters`);
    assert.equal(content.passageText(id), textOf(rows), `${target} characters`);
  }
});

test("R61 (G128g): an xlsx sheet over the unit cap reads as its rows once each (the same rule over a second reader)", async () => {
  const n = 5200;
  const rows = [["id", "name", "note"]];
  for (let i = 0; i < n; i++) rows.push([String(i), `name ${i}`, `council note ${i} budget line`]);
  /* every value is written as a string, so the reader's value is the field as written */
  const bytes = xlsx({ sheets: [{ name: "Budget", rows: rows.map((row, r) => row.map((v, c) => ({ r: `${"ABC"[c]}${r + 1}`, t: "str", v }))) }] });
  const { d, w, content, id } = await home(bytes, { format: "xlsx", ct: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const units = w.x.unitsOf(d);
  assert.ok(units.units.length >= 2, `held as blocks (${units.units.length})`);
  assert.equal(content.passageText(id), textOf(rows));
});

test("R22 (G4, walk B10a): a cited range of a later block is read back from the range's first row, without the header the block repeats at its head", async () => {
  const rows = rowsToSize(3 * CAP);
  const { w, d, content } = await csvHome(rows);
  const units = w.x.unitsOf(d).units;
  assert.ok(units.length >= 3, `the sheet is held as blocks (${units.length} units)`);
  const header = "id\tname\tamount\tnote";
  const mintAt = (u) => content.mint({ bundleId: "INFO-1", captureSha: d, extent: u.extent, mintedBy: "member:bo" });
  /* block 1 keeps the header: it is the sheet's first row, not a repeat */
  const first = mintAt(units[0]);
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.ok(content.passageText(first.content_id).startsWith(`${header}\n`), "block 0 keeps its header");
  for (const k of [1, units.length - 1]) {
    const e = units[k].extent;
    const m = mintAt(units[k]);
    assert.equal(m.ok, true, JSON.stringify(m));
    const text = content.passageText(m.content_id);
    assert.notEqual(text, null, `block ${k} is held`);
    const [r0, r1] = e.range.split(":").map((a) => Number(a.replace(/[^0-9]/g, "")));
    const lines = text.split("\n");
    assert.equal(lines[0], textOf(rows).split("\n")[r0 - 1], `block ${k} begins at the range's first row (${e.range}), not the header`);
    assert.equal(lines.length, r1 - r0 + 1, "its line count equals the range's rows");
    assert.equal(text, textOf(rows).split("\n").slice(r0 - 1, r1).join("\n"));
    /* the notice's grade reads the same text on both sides (R31 through the one rule, R61) */
    assert.equal(heldTextAt(e, normUnits(w.x.unitsOf(d))).text, text);
  }
});
