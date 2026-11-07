/* Provider notice registers:426 (PR 426): registers declares a new `export: "yes"` table, `register_segment_removed`
   (registers R30, citation R28: a reduced file's row a removal took, by the digest the file had then). Confirmed, no code
   change: corpus-export carries it as any declared table (R7, R8), and it holds a digest and a row number only, so R16's
   "no cell, no row, no segment" holds over it. Over registers' own world, at this module's interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { registersWorld, SENTINEL } from "./registers-world.mjs";
import { verifyCorpusExport } from "../../../src/corpus-export/index.mjs";

test("R16, R7 (registers:426): a removal's register_segment_removed rows travel as declared, digest and row only, no cell; the export verifies", async () => {
  const w = registersWorld();
  await w.importOnce();
  const before = w.ce.exportManifest({}).tables.find((t) => t.table === "register_segment_removed");
  assert.equal(before.rows, 0, "control: no removal, no row");
  await w.removeRow(3);
  const held = w.sql(`SELECT sha256, row FROM register_segment_removed`);
  assert.equal(held.length, 1, "control: the removal recorded the row it took");

  const m = w.ce.exportManifest({});
  const t = m.tables.find((e) => e.table === "register_segment_removed");
  assert.deepEqual([t.owner, t.carried, t.rows], ["registers", "rows", 1], "carried as its declaration says");
  const rows = t.pages.flatMap((p) => JSON.parse(new TextDecoder().decode(w.ce.exportPage({ table: t.table, index: p.index, after: p.after }).bytes)).rows);
  assert.deepEqual(rows.map((r) => Object.keys(r).sort()), [["row", "sha256"]], "a digest and a row number, nothing else");
  assert.deepEqual(rows.map((r) => [r.sha256, r.row]), held.map((r) => [r.sha256, r.row]));
  /* the digest is the reduced file's before the removal: not a segment that travels, and no segment's bytes do */
  const live = m.registers.descriptors.flatMap((d) => d.segment_shas);
  assert.ok(!live.includes(rows[0].sha256), "the old digest is not a live segment");
  assert.ok(!m.bundles.flatMap((b) => b.files.map((f) => f.sha256)).includes(rows[0].sha256), "no bundle lists it");
  assert.ok(!(await w.everything(m)).includes(SENTINEL), "no cell in any form");

  /* the verifying import re-derives its page: handed, it raises nothing on this table; withheld, BYTES_MISSING names it */
  const pages = new Map(t.pages.map((p) => [p.sha256, w.ce.exportPage({ table: t.table, index: p.index, after: p.after }).bytes]));
  const mine = (v) => (v.failures || []).filter((f) => f.table === "register_segment_removed").map((f) => f.reason);
  assert.deepEqual(mine(verifyCorpusExport({ manifest: m, bytes: pages })), [], "its page verifies");
  assert.deepEqual(mine(verifyCorpusExport({ manifest: m, bytes: new Map() })), ["BYTES_MISSING"], "control: withheld, it is named");
});
