/* calculations: the provider notice content:440 (content F1; citation R28, registers R30). content.cellsAt now answers a content row
   over a register row an expunge removed with {cells: null, reason: "removed"}. Confirmed, no code change: R1's range read takes any
   answer with no cells as unread, so a table declared over such a row is refused SOURCE_NOT_READ naming the reason, and nothing is
   written. Driven over registers' and content's real code (registers' own test world, K4990); control: before the removal the same
   declaration reads the row. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { seeded, V, served, csv, rowOf, enc, URL_ } from "../registers/fixture.mjs";
import { calculationsOf } from "../../../src/calculations/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const START = (w) => w.registers.importStart({ register: "town_filings", filter: {}, scope: "team", author: V("alice"), viewer: V("alice"), holes: { table: "2025" } });
const keyOf = (w, src) => w.sql(`SELECT row_key FROM register_import_rows WHERE src_row=? ORDER BY import_id LIMIT 1`, src)[0].row_key;

test("content:440 (R1): a table over a register row an expunge removed is refused SOURCE_NOT_READ with reason removed, writing nothing; control: before the removal the row is read", async () => {
  const w = seeded();
  START(w);
  await w.drain({ [URL_]: served(enc(csv(12, { cell: (i) => rowOf(i) }))) });
  const key = keyOf(w, 6);
  const cite = w.registers.citeRow({ import: 1, row_key: key, author: V("bob"), viewer: V("bob") });
  assert.equal(cite.ok, true, JSON.stringify(cite));
  const c = calculationsOf(w.host, { record: w.record, membership: w.membership, content: w.content, provenance: w.content.provenance,
    now: () => new Date(w.clock.ms).toISOString(), clock: () => w.clock.ms });
  if (typeof c.migrate === "function") c.migrate();
  const ask = () => c.declareTable({ source: cite.content_id, schema: { fields: [{ name: "x", type: "string" }] }, header: ["x"], by: V("bob") });
  const tables = () => w.count("calc_tables");

  /* control: the row's cells are read; whatever the declaration answers, it is not the unread refusal */
  const before = await ask();
  assert.notEqual(before.detail, `${word("calculations.range_cells_held", { got: "removed" })}. Nothing was written.`);
  const pre = await w.content.cellsAt(cite.content_id);
  assert.ok(Array.isArray(pre.cells) && pre.reason === undefined, "control: content answers the row with cells, not removed, before the removal");

  const out = await w.registers.rowExpunge({ register: "town_filings", row_key: key, ground: "unlawful", reason: "the filer was a minor", author: V("alice") });
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal((await w.content.cellsAt(cite.content_id)).reason, "removed", "content's answer the notice names");
  const n = tables();
  const after = await ask();
  assert.deepEqual([after.ok, after.reason], [false, "SOURCE_NOT_READ"], JSON.stringify(after));
  assert.equal(after.detail, `${word("calculations.range_cells_held", { got: "removed" })}. Nothing was written.`, "the refusal names the reason");
  assert.equal(after.content_id, cite.content_id);
  assert.equal(tables(), n, "nothing was written");
});
