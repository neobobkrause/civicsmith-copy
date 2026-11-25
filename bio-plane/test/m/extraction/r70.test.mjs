/* extraction, R70 (T36-13; N724, K1972, K2092): a document table's cells, read from `.docx` bytes as a sheet's are
   (office-readers R11, R16; reading-pipeline R28), kept by R19's writer and answered by `readingOf` (R30) unchanged;
   `cells: null` and `{}` two facts (R45); R23's history across a re-read that gains cells; and R66's N26 migration
   moving a stored reading's `cells` keys by `tables[old].new`. A cell carries office-readers R11's seven keys, `paras`
   included (T37-45, K2173). Each test names the requirement ids it checks. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fresh, bundle, hold, doc, docx, wp, wr, wtbl, box } from "./fixture.mjs";
import { n26MigratedReading } from "../../../src/extraction/index.mjs";
import { docxRenumbering } from "../../../src/docx.mjs";
import { getFormat } from "../../../src/formats.mjs";

const DOCX_CT = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
/* A Word table over its own grid: `rows` is a list of rows, each a list of cell texts ("" an empty cell). */
const table = (rows) => `<w:tbl><w:tblGrid>${rows[0].map(() => "<w:gridCol/>").join("")}</w:tblGrid>`
  + rows.map((r) => `<w:tr>${r.map((t) => `<w:tc>${t ? wp(wr(t)) : "<w:p/>"}</w:tc>`).join("")}</w:tr>`).join("") + "</w:tbl>";
const LEDGER = [["Date", "Amount", "Payee"], ["2026-03-01", "$1,250.00", "Hall rental"], ["2026-04-15", "312.50", ""],
                ["March 9, 2026", "-40", "Refund"]];
const BODY = wp(wr("Expenditures for the quarter")) + table(LEDGER) + wp(wr("Signed")) + table([["Total", "$1,522.50"]]);

/* What the docx entry emits over the same bytes: the expectation the reading is held to, field for field. */
async function emitted(bytes) {
  const entry = getFormat("docx");
  return entry.text(await entry.parts(bytes));
}
async function readDocx(w, body) {
  const bytes = docx(body);
  const d = await hold(w.evidence, bytes);
  const r = await w.x.read(doc({ digest: d, bytes: bytes.length, ct: DOCX_CT, format: "docx", headers: [["content-type", DOCX_CT]] }));
  return { d, bytes, r };
}

test("R70 R1 R19 R30: a .docx table of dates and amounts read from its bytes carries its cells keyed by table ref, written by R19 and answered by readingOf unchanged, field for field as office-readers emitted them, the seventh key `paras` included", async () => {
  const w = fresh();
  bundle(w.s, "INFO-1");
  const { d, bytes, r } = await readDocx(w, BODY);
  const text = await emitted(bytes);
  assert.equal(text.tables.length, 2, "the fixture holds two tables");
  const want = Object.fromEntries(text.tables.map((t) => [t.ref, t.cells]));
  assert.deepEqual(Object.keys(want), ["table 1", "table 2"]);
  /* the emission itself, so the expectation is the fixture's and not only the reader's word */
  assert.deepEqual(want["table 1"].map((c) => [c.source.ref, c.value]), [
    ["table 1, A1", "Date"], ["table 1, B1", "Amount"], ["table 1, C1", "Payee"],
    ["table 1, A2", "2026-03-01"], ["table 1, B2", "$1,250.00"], ["table 1, C2", "Hall rental"],
    ["table 1, A3", "2026-04-15"], ["table 1, B3", "312.50"],
    ["table 1, A4", "March 9, 2026"], ["table 1, B4", "-40"], ["table 1, C4", "Refund"]]);
  /* office-readers R11 (N758; K2118): each cell names the paragraphs its text was read from; the empty C3 is no cell,
     and its paragraph (¶10) is no cell's */
  assert.deepEqual([...want["table 1"], ...want["table 2"]].map((c) => [c.source.ref, c.paras]), [
    ["table 1, A1", [1]], ["table 1, B1", [2]], ["table 1, C1", [3]], ["table 1, A2", [4]], ["table 1, B2", [5]],
    ["table 1, C2", [6]], ["table 1, A3", [7]], ["table 1, B3", [8]], ["table 1, A4", [10]], ["table 1, B4", [11]],
    ["table 1, C4", [12]], ["table 2, A1", [14]], ["table 2, B1", [15]]]);
  for (const c of [...want["table 1"], ...want["table 2"]]) {
    assert.deepEqual(Object.keys(c).sort(), ["cached", "declared", "formula", "paras", "source", "type", "value"]);
    assert.deepEqual(c.paras.map((n) => text.paragraphs[n].text), [c.value], "a cell's paragraphs are the text it carries");
    assert.equal(c.source.kind, "doc-table");
    assert.deepEqual([c.type, c.declared, c.cached, c.formula], ["text", null, null, null]);
  }
  /* read (R1): the reading carries the cells as reading-pipeline R28 composes them */
  assert.equal(r.reading.text_container, "docx");
  assert.deepEqual(r.reading.cells, want);
  /* R19: written, the stored reading holds them unchanged; R30: readingOf answers them in `reading` */
  w.x.writeReading({ bundleId: "INFO-1", captureSha: d, reading: r.reading, textUnits: r.text_units, profileFormat: "docx" });
  const stored = JSON.parse(w.one(`SELECT reading FROM readings WHERE capture_sha=?`, d).reading);
  assert.deepEqual(stored.cells, want);
  const of = w.x.readingOf(d);
  assert.deepEqual(of.reading.cells, want);
  assert.deepEqual(of.reading, r.reading);
  assert.equal(of.captureFormat, "docx");
  /* op=reading's read (R27) carries the same reading */
  assert.deepEqual(w.x.readingFor(d).reading.cells, want);
});

test("R70 R45: a .docx with no tables stores and answers `cells: {}`, a stored `cells: null` answers null, and neither is answered as the other; a reading stored before R70 carries no cells and is not re-read for them", async () => {
  const w = fresh();
  bundle(w.s, "INFO-1");
  const { d, r } = await readDocx(w, wp(wr("No tables here")));
  assert.deepEqual(r.reading.cells, {});
  w.x.writeReading({ bundleId: "INFO-1", captureSha: d, reading: r.reading, textUnits: r.text_units, profileFormat: "docx" });
  const empty = w.x.readingOf(d).reading;
  assert.ok(Object.prototype.hasOwnProperty.call(empty, "cells"));
  assert.deepEqual(empty.cells, {});
  assert.notEqual(empty.cells, null);
  /* the body not read (reading-pipeline R28: the entry's `tables` null): null, stored and answered as null */
  const nullSha = "c".repeat(64);
  w.x.writeReading({ bundleId: "INFO-1", captureSha: nullSha, reading: { ...r.reading, cells: null }, profileFormat: "docx" });
  assert.equal(w.x.readingOf(nullSha).reading.cells, null);
  assert.ok(Object.prototype.hasOwnProperty.call(w.x.readingOf(nullSha).reading, "cells"));
  /* a reading stored before R70: no `cells` key, and none appears on reading it back */
  const oldSha = "d".repeat(64);
  const old = { ...r.reading };
  delete old.cells;
  w.x.writeReading({ bundleId: "INFO-1", captureSha: oldSha, reading: old, profileFormat: "docx" });
  assert.equal(Object.prototype.hasOwnProperty.call(w.x.readingOf(oldSha).reading, "cells"), false);
  assert.deepEqual(w.x.readingOf(oldSha).reading, old);
});

test("R70 R23: a capture whose pre-cells reading is read again keeps the old reading in its history and the new one, with its cells, as a distinct reading by digest", async () => {
  const w = fresh();
  bundle(w.s, "INFO-1");
  const { d, r } = await readDocx(w, BODY);
  const before = { ...r.reading };
  delete before.cells;
  w.x.writeReading({ bundleId: "INFO-1", captureSha: d, reading: before, textUnits: r.text_units, profileFormat: "docx" });
  const out = w.x.writeReading({ bundleId: "INFO-1", captureSha: d, reading: r.reading, textUnits: r.text_units, profileFormat: "docx" });
  assert.equal(out.kept.added, true);
  const hist = w.rows(`SELECT reading, reading_sha256 FROM reading_history WHERE capture_sha=? ORDER BY seq`, d);
  assert.deepEqual(hist.map((h) => JSON.parse(h.reading)), [before, r.reading]);
  assert.notEqual(hist[0].reading_sha256, hist[1].reading_sha256);
  assert.deepEqual(w.x.readingOf(d).reading.cells, r.reading.cells);
  assert.equal(w.x.readingFor(d).reading_history.kept, 2);
});

/* N26's document (as n26.test.mjs's): the old walk numbered three tables, N26 reads two (old 0 → 0, 1 → not read, 2 → 1). */
const N26_BODY = wp(wr("before "), box([wp(wr("boxed"))]), wr("after")) + wp(wr("next"))
  + wp(box([wtbl("t in box")])) + wtbl("after table");
const T = (table, cell) => ({ kind: "doc-table", ref: `table ${table + 1}${cell ? `, ${cell}` : ""}`, table, ...(cell ? { cell } : {}) });
/* A cell as office-readers R11 emits it; `paras` are bare ordinals N26 does not move (no stored reading holds both). */
const PARAS = { "first": [2], "t in box": [5], "after table": [6] };
const cell = (table, value) => ({ source: T(table, "A1"), value, type: "text", declared: null, cached: null, formula: null, paras: PARAS[value] });

test("R70 R66: N26's migration of a reading carrying cells moves each key to tables[old].new with its cells' sources, keeps each cell's `paras` as stored, drops a table N26 does not read, counts no cell as a moved reference, and keeps null and {} as stored", () => {
  const map = docxRenumbering(`<w:document><w:body>${N26_BODY}</w:body></w:document>`);
  assert.deepEqual(map.tables.map((t) => t.new), [0, null, 1]);
  const text = { paragraphs: [], document: "", counts: { chars: 0, undetermined: 0 } };
  const base = { content_type: "doc", found: true, at: "2026-09-01T00:00:00Z", entities: [{ ref: "tbl:t", kind: "tbl", key: "t", source: T(2, "A1") }],
                 text_source: [{ step: "layer", container: "docx", tier: 1 }] };
  const reading = { ...base, cells: { "table 1": [cell(0, "first")], "table 2": [cell(1, "t in box")], "table 3": [cell(2, "after table")] } };
  const copy = JSON.parse(JSON.stringify(reading));
  const next = n26MigratedReading(reading, map, text);
  assert.deepEqual(reading, copy, "the reading handed in is not changed");
  assert.deepEqual(next.cells, { "table 1": [cell(0, "first")], "table 2": [cell(1, "after table")] });
  assert.deepEqual(Object.keys(next.cells), ["table 1", "table 2"]);
  /* the cells are not references the reading names: the counts are what they are without them */
  assert.deepEqual(next.migrated.n26.moved, n26MigratedReading(base, map, text).migrated.n26.moved);
  assert.deepEqual(next.entities[0].source, T(1, "A1"));
  /* null and {} stay as stored; a reading with no cells gains none */
  assert.equal(n26MigratedReading({ ...base, cells: null }, map, text).cells, null);
  assert.deepEqual(n26MigratedReading({ ...base, cells: {} }, map, text).cells, {});
  assert.equal(Object.prototype.hasOwnProperty.call(n26MigratedReading(base, map, text), "cells"), false);
});

/* A cell as a reading made before N26 could hold it: no `paras`, which only the N26 reader writes (T37-4), so no reading
   carrying them is migrated (R66, T38; N786: n26.test.mjs proves it). */
const oldCell = (table, value) => { const c = cell(table, value); delete c.paras; return c; };

test("R70 R66: a stored pre-N26 reading carrying cells (without `paras`, which no pre-N26 reading holds) is migrated through the store, its cells keys following the tables", async () => {
  const w = fresh();
  bundle(w.s, "INFO-1");
  const d = await hold(w.evidence, docx(N26_BODY));
  const old = { content_type: "doc", reader_version: 1, found: true, at: "2026-09-01T00:00:00Z",
                entities: [{ ref: "tbl:t", kind: "tbl", key: "t", label: null, facts: {}, source: T(2, "A1") }],
                text_source: [{ step: "layer", container: "docx", tier: 1 }], text_tier: 1, text_container: "docx",
                container_extent: { container: "docx", levels: ["paragraphs", "tables"], paragraphs: 8, tables: [{}, {}, {}] },
                cells: { "table 1": [oldCell(0, "first")], "table 2": [oldCell(1, "t in box")], "table 3": [oldCell(2, "after table")] } };
  w.x.writeReading({ bundleId: "INFO-1", captureSha: d, reading: old, profileFormat: "docx", composed: true });
  const out = await w.x.migrateDocxReadings();
  assert.deepEqual(out.migrated.map((m) => m.capture_sha), [d]);
  const got = w.x.readingOf(d).reading;
  assert.deepEqual(got.cells, { "table 1": [oldCell(0, "first")], "table 2": [oldCell(1, "after table")] });
  assert.deepEqual(got.entities[0].source, T(1, "A1"));
});
