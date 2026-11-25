/* calculations, fix round 6 (T51; G41, K4636, K4642): a held sheet's cells are made from the file when a range is opened or
   cited, so `content.cellsAt` is asynchronous and this module awaits it at its three reads (a table's source rows, a cited
   figure, a table's or figure's engine). Part 1 drives the module over a content provider that answers `cellsAt` as the
   merged content does (a promise; `cells_truncated` for a range over the cells limit). Part 2 is the seam: a 1 MB CSV read
   by the real extraction, cited as a range and declared as a table through the real merged content (red by name until
   CSV-READER, OFFICE-READERS, READING-PIPELINE, EXTRACTION and CONTENT merge; run it under the platform's sqlite limit). */
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, V, R } from "./fixture.mjs";
import { FILE_ENGINE, Calculations } from "../../../src/calculations/index.mjs";
import { fresh, bundle, bucket, doc, sha } from "../extraction/fixture.mjs";
import { registeredHomes } from "../provenance/fixtures.mjs";

const PERIOD = { from: "2025-01-01", to: "2026-12-31" };
const F = [{ name: "dept", type: "string" }, { name: "amount", type: "number" }];
const SUM = R([{ op: "sum", from: "t", field: "amount", as: "s" }], "s");
const CHAIN = [{ step: "layer", tier: 1, container: "xlsx", cap: null, measured_by: null, calibration: null }];
const DIFF = R([{ op: "difference", a: "x", b: "y", as: "d" }], "d", [{ name: "x", kind: "figure" }, { name: "y", kind: "figure" }]);
/* a sheet-cell content row on a fresh document */
const cellRow = (w, cell) => {
  const book = w.document(`workbook ${cell} ${Math.random()}`);
  w.ex.readings[book.capSha] = { pageCount: 1, chain: CHAIN, textContainer: { sheets: ["S"] }, reading: { cells: { S: [] } } };
  const m = w.content.mint({ bundleId: book.bundleId, captureSha: book.capSha, extent: { kind: "sheet-cell", sheet: "S", cell }, mintedBy: V("bob") });
  assert.equal(m.ok, true, JSON.stringify(m).slice(0, 300));
  return m.content_id;
};
const later = () => new Promise((r) => setImmediate(r));

/* A world whose calculations reads a content provider whose `cellsAt` is `behave.cellsAt` (a promise, as content's now is). */
function world() {
  const w = seeded({ construct: false });
  const behave = { cellsAt: null, asked: 0 };
  const content = new Proxy(w.content, { get: (t, k) => (k === "cellsAt"
    ? async (id) => { behave.asked++; await later(); return behave.cellsAt ? behave.cellsAt(id) : t.cellsAt(id); }
    : typeof t[k] === "function" ? t[k].bind(t) : t[k]) });
  w.c = w.build({ content });
  w.behave = behave;
  return w;
}
const cellList = (rows, { formula = false } = {}) => {
  const out = [];
  for (let r = 1; r <= rows; r++) for (let c = 0; c < 4; c++) {
    const cell = `${"ABCD"[c]}${r}`;
    const header = r === 1;
    out.push({ source: { kind: "sheet-cell", cell }, value: header ? ["dept", "amount", "x", "y"][c] : c === 0 ? `d${r}` : String(r * (c + 1)),
      type: header || c === 0 ? "s" : "n", ...(formula && !header && c === 1 && r === 3 ? { formula: "B2+1", cached: "3" } : {}) });
  }
  return out;
};
const FOUR = [{ name: "dept", type: "string" }, { name: "amount", type: "number" }, { name: "x", type: "number" }, { name: "y", type: "number" }];
const head = ["dept", "amount", "x", "y"];

test("R1 R9 (G41): a formula range of a held workbook of 5,000 rows x 4 cells, its cells made by an asynchronous cellsAt, is declared and graded with its engine named exactly as a small workbook's is, never with engine null", async () => {
  const w = world();
  w.behave.cellsAt = () => ({ content_id: "big", cells: cellList(5001, { formula: true }) });
  const big = await w.c.declareTable({ source: w.sheet([], "A1:D5001"), schema: { fields: FOUR }, header: head, by: V("bob") });
  assert.equal(big.ok, true, JSON.stringify(big).slice(0, 300));
  assert.ok(w.behave.asked >= 1, "cellsAt was asked");
  const rows = await w.c.readTable({ sha: big.sha, viewer: V("bob"), limit: 10 });
  assert.equal(rows.table.grade_facts.engine, FILE_ENGINE, "readTable names the engine");
  assert.equal(rows.table.grade_facts.engine_measured, false);
  assert.equal(rows.table.grade_facts.grade, null);
  const a = await w.c.create({ question: "Q", period: PERIOD, kind: "total", inputs: [{ name: "t", table: big.sha }],
    recipe: R([{ op: "sum", from: "t", field: "amount", as: "s" }], "s"), by: V("bob") });
  assert.equal(a.ok, true, JSON.stringify(a).slice(0, 300));
  const [ia] = w.c.gradeFactsOf({ calcId: a.calc_id, viewer: V("carol") }).inputs;
  assert.equal(ia.engine, FILE_ENGINE);
  /* the small workbook, the same shape: the same marks */
  w.behave.cellsAt = () => ({ cells: cellList(5, { formula: true }) });
  const small = await w.c.declareTable({ source: w.sheet([], "A1:D5"), schema: { fields: FOUR }, header: head, by: V("bob") });
  const sa = await w.c.create({ question: "Q", period: PERIOD, kind: "total", inputs: [{ name: "t", table: small.sha }], recipe: SUM, by: V("bob") });
  const [is] = w.c.gradeFactsOf({ calcId: sa.calc_id, viewer: V("carol") }).inputs;
  assert.deepEqual({ ...ia, ref: null }, { ...is, ref: null }, "the big workbook's marks are the small one's");
});

test("R9 (G41): a figure citing a formula cell of a held sheet is graded with its engine (the await reaches the grade), and a sheet with no formula carries engine null (control)", async () => {
  const w = world();
  w.behave.cellsAt = () => ({ cells: [{ source: { kind: "sheet-cell", cell: "B3" }, value: "30", type: "n", formula: "B2+18", cached: "30" }] });
  const a = await w.c.create({ question: "Q", period: PERIOD, kind: "difference", inputs: [{ name: "x", figure: cellRow(w, "B3") }, { name: "y", value: "2" }], recipe: DIFF, by: V("bob") });
  assert.equal(a.ok, true, JSON.stringify(a).slice(0, 300));
  const [i] = w.c.gradeFactsOf({ calcId: a.calc_id, viewer: V("carol") }).inputs;
  assert.equal(i.engine, FILE_ENGINE);
  assert.equal(i.grade, null);
  w.behave.cellsAt = () => ({ cells: [{ source: { kind: "sheet-cell", cell: "B3" }, value: "31", type: "n" }] });
  const b = await w.c.create({ question: "Q2", period: PERIOD, kind: "difference", inputs: [{ name: "x", figure: cellRow(w, "B4") }, { name: "y", value: "2" }], recipe: DIFF, by: V("bob") });
  assert.equal(b.ok, true, JSON.stringify(b).slice(0, 300));
  assert.equal(w.c.gradeFactsOf({ calcId: b.calc_id, viewer: V("carol") }).inputs[0].engine, null);
});

test("R9 (G41): a cellsAt that answers cells_truncated, or that fails, when a figure is bound gives an explicit undetermined engine (never null), read and gradeFactsOf alike; a later read with cells available makes the mark and writes it", async () => {
  const w = world();
  const tbl = await w.c.declareTable({ source: w.sheet([], "A1:B3"), schema: { fields: F }, header: ["dept", "amount"], by: V("bob") });
  w.behave.cellsAt = () => ({ cells: [{ source: { kind: "sheet-cell", cell: "B3" }, value: "31", type: "n" }] });
  assert.equal(tbl.ok, true);
  for (const [label, behaviour] of [["truncated", () => ({ cells: null, cells_truncated: true, reason: "cells_truncated" })],
                                    ["rejected", () => { throw new Error("the held bytes could not be read"); }]]) {
    const row = cellRow(w, "B3");
    /* the figure's value is read first (it answers), then the engine read fails: the create stores the undetermined mark */
    let n = 0;
    w.behave.cellsAt = (id) => (n++ === 0 ? { cells: [{ source: { kind: "sheet-cell", cell: "B3" }, value: "31", type: "n" }] } : behaviour(id));
    const a = await w.c.create({ question: `Q ${label}`, period: PERIOD, kind: "difference", inputs: [{ name: "x", figure: row }, { name: "y", value: "2" }], recipe: DIFF, by: V("bob") });
    assert.equal(a.ok, true, JSON.stringify(a).slice(0, 300));
    w.behave.cellsAt = behaviour;
    const read = await w.c.read({ calcId: a.calc_id, viewer: V("carol") });
    const [i] = read.grade.inputs;
    assert.equal(i.engine, "undetermined", `${label}: an explicit engine`);
    assert.equal(i.engine_measured, false);
    assert.equal(i.grade, null);
    assert.match(i.why, /undetermined/);
    assert.deepEqual(w.c.gradeFactsOf({ calcId: a.calc_id, viewer: V("carol") }).inputs, read.grade.inputs, `${label}: R30 answers what read does`);
  }
  w.behave.cellsAt = () => { throw new Error("down"); };
  assert.equal((await w.c.readTable({ sha: tbl.sha, viewer: V("bob") })).table.grade_facts.engine, null, "a table declared before keeps its recorded engine: a later failure of cellsAt does not rewrite it");
});

test("R9 (G41): the mark of a figure whose engine read failed at create is undetermined, then one read with the cells available makes it (null for a sheet with no formula) and the synchronous answer follows", async () => {
  const w = world();
  w.behave.cellsAt = () => ({ cells: [{ source: { kind: "sheet-cell", cell: "B3" }, value: "31", type: "n" }] });
  const row = cellRow(w, "B3");
  const a = await w.c.create({ question: "Q", period: PERIOD, kind: "difference", inputs: [{ name: "x", figure: row }, { name: "y", value: "2" }], recipe: DIFF, by: V("bob") });
  assert.equal(a.ok, true);
  w.st.sql.exec(`UPDATE calc_inputs SET engine_json='{"name":"undetermined","version":null}' WHERE calc_id=? AND input_name='x'`, a.calc_id);
  assert.equal(w.c.gradeFactsOf({ calcId: a.calc_id, viewer: V("carol") }).inputs[0].engine, "undetermined");
  assert.equal((await w.c.read({ calcId: a.calc_id, viewer: V("carol") })).grade.inputs[0].engine, null, "the read makes the mark, writes it, and answers by it");
  assert.equal(w.c.gradeFactsOf({ calcId: a.calc_id, viewer: V("carol") }).inputs[0].engine, null, "now made: no formula, no engine");
});

test("R9 (G41, K4650): a figure input's engine mark is stored with the calculation's inputs at create, so after a restart (a fresh instance over the same database) the synchronous gradeFactsOf answers the stored mark; a row stored before holds none and answers the explicit undetermined engine until one read makes and writes it", async () => {
  const w = world();
  const fresh2 = () => new Calculations({ storage: w.st, host: Object.create(w.host), record: w.record, membership: w.membership, content: w.c.content,
    provenance: w.prov, money: w.money, now: () => w.clock.now });
  w.behave.cellsAt = () => ({ cells: [{ source: { kind: "sheet-cell", cell: "B3" }, value: "30", type: "n", formula: "B2+18", cached: "30" }] });
  const withF = await w.c.create({ question: "Q", period: PERIOD, kind: "difference", inputs: [{ name: "x", figure: cellRow(w, "B3") }, { name: "y", value: "2" }], recipe: DIFF, by: V("bob") });
  w.behave.cellsAt = () => ({ cells: [{ source: { kind: "sheet-cell", cell: "B4" }, value: "31", type: "n" }] });
  const plain1 = await w.c.create({ question: "Q2", period: PERIOD, kind: "difference", inputs: [{ name: "x", figure: cellRow(w, "B4") }, { name: "y", value: "2" }], recipe: DIFF, by: V("bob") });
  assert.equal(withF.ok && plain1.ok, true);
  const engines = (c, id) => c.gradeFactsOf({ calcId: id, viewer: V("carol") }).inputs.map((i) => i.engine);
  const after = fresh2();
  assert.deepEqual(engines(after, withF.calc_id), [FILE_ENGINE, null], "the stored mark, after a restart");
  assert.deepEqual(engines(after, plain1.calc_id), [null, null], "a stored 'no engine' stays no engine, not undetermined");
  /* a row stored before: no mark */
  w.st.sql.exec(`UPDATE calc_inputs SET engine_json=NULL WHERE calc_id IN (?,?)`, withF.calc_id, plain1.calc_id);
  const old = fresh2();
  assert.deepEqual(engines(old, withF.calc_id), ["undetermined", null], "no mark yet: fail closed, never null");
  w.behave.cellsAt = () => ({ cells: [{ source: { kind: "sheet-cell", cell: "B3" }, value: "30", type: "n", formula: "B2+18", cached: "30" }] });
  const oldWithContent = new Calculations({ storage: w.st, host: Object.create(w.host), record: w.record, membership: w.membership, content: w.c.content,
    provenance: w.prov, money: w.money, now: () => w.clock.now });
  const read = await oldWithContent.read({ calcId: withF.calc_id, viewer: V("carol") });
  assert.equal(read.grade.inputs[0].engine, FILE_ENGINE, "one read makes it");
  assert.deepEqual(engines(fresh2(), withF.calc_id), [FILE_ENGINE, null], "and has written it");
});

test("R1 (G41): a range over the cells limit, answered cells_truncated, is a stated fault of the table (SOURCE_NOT_READ naming it), nothing written, never a short table", async () => {
  const w = world();
  w.behave.cellsAt = () => ({ cells: null, cells_truncated: true, reason: "cells_truncated", cells_range_max: 20000 });
  const before = w.count("calc_tables");
  const r = await w.c.declareTable({ source: w.sheet([], "A1:D9999"), schema: { fields: FOUR }, header: head, by: V("bob") });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "SOURCE_NOT_READ");
  assert.match(r.detail, /cells_truncated/);
  assert.equal(w.count("calc_tables"), before, "nothing written");
  w.behave.cellsAt = () => { throw new Error("down"); };
  const f = await w.c.declareTable({ source: w.sheet([], "A1:D9"), schema: { fields: FOUR }, header: head, by: V("bob") });
  assert.equal(f.reason, "SOURCE_NOT_READ", "a failed cellsAt is a stated fault too");
});

test("R1 (G41): a small sheet's table and grading are unchanged by the asynchronous cellsAt (control)", async () => {
  const w = world();
  const cells = [["A1", "dept"], ["B1", "amount"], ["A2", "parks"], ["B2", "12"], ["A3", "roads"], ["B3", "30"]]
    .map(([cell, value]) => ({ source: { cell }, value, type: "s" }));
  w.behave.cellsAt = null;   /* the real content, over the fixture's reading */
  const t = await w.c.declareTable({ source: w.sheet(cells, "A1:B3"), schema: { fields: F }, header: ["dept", "amount"], by: V("bob") });
  assert.equal(t.ok, true, JSON.stringify(t).slice(0, 300));
  const read = await w.c.readTable({ sha: t.sha, viewer: V("bob") });
  assert.deepEqual(read.page.rows, [["parks", "12"], ["roads", "30"]]);
  assert.equal(read.table.grade_facts.engine, null);
  const book = w.document("a figure workbook");
  w.ex.readings[book.capSha] = { pageCount: 1, chain: CHAIN, textContainer: { sheets: ["S"] }, reading: { cells: { S: [{ source: { cell: "B2" }, value: "12", type: "n" }] } } };
  const cm = w.content.mint({ bundleId: book.bundleId, captureSha: book.capSha, extent: { kind: "sheet-cell", sheet: "S", cell: "B2" }, mintedBy: V("bob") });
  const fig = await w.c.create({ question: "Q", period: PERIOD, kind: "difference", inputs: [{ name: "x", figure: cm.content_id }, { name: "y", value: "2" }], recipe: DIFF, by: V("bob") });
  assert.equal(fig.ok, true, JSON.stringify(fig).slice(0, 300));
});

/* ---- Part 2: the seam, through the real extraction and the real merged content ---- */

async function csvWorld() {
  let t = "id,name,amount,note\n"; let i = 0;
  while (t.length < 1_048_576) { t += `${i},"name ${i}",${(i * 37) % 9973}.${i % 100},"council note ${i} budget line"\n`; i++; }
  t += `LASTROWMARK,"last name",1.00,"the final row of the sheet"\n`;
  const lines = t.trimEnd().split("\n").length;
  const evidence = bucket();
  const { provenance, register } = registeredHomes();   /* provenance's own fixture: the real homeOf over captures really registered (K5044) */
  const x = fresh({ evidence, provenance });
  bundle(x.s, "INFO-1");
  const bytes = new TextEncoder().encode(t), d = sha(bytes);
  const reg = register(d, { bundleId: "INFO-1", path: "t.csv", encoding: "binary", bytes: bytes.length });
  assert.equal(reg.ok, true, JSON.stringify(reg).slice(0, 200));
  await evidence.put(`bio/captures/${d}`, bytes);
  const document = doc({ digest: d, bytes: bytes.length, ct: "text/csv", format: "csv", fromText: true });
  x.core.readFile = (b, p) => (b === "INFO-1" && p === "data/provenance.json" ? { text: JSON.stringify({ documents: [document] }) } : null);
  let a; do { a = await x.x.readHeld({ sha: d, kind: "reading", storeName: "bio", env: {} }); } while (a.more);
  assert.equal(a.ok, true, `the 1 MB CSV is read: ${JSON.stringify(a).slice(0, 200)}`);
  /* the calculations world: its document is the same bytes (same capture digest), its extraction the real one */
  const w = seeded({ construct: false });
  w.ex.readings = new Proxy({}, { get: (_t, s) => (typeof s === "string" ? x.x.readingOf(s) : undefined) });
  w.ex.cellsOf = (...args) => x.x.cellsOf(...args);
  w.c = w.build();
  const doc1 = w.document(t, {});
  assert.equal(doc1.capSha, d, "the fixture's capture is the digest the real extraction read");
  if (w.ev) w.ev.m.set(d, bytes);
  return { w, t, lines, d, header: ["id", "name", "amount", "note"] };
}

test("R1 (G41, seam: waits for CSV-READER, OFFICE-READERS, READING-PIPELINE, EXTRACTION, CONTENT): declareTable from a cited sheet-range of the last 100 rows of a 1 MB CSV yields a table whose rows equal the generator's (red today under the platform's value limit: the read fails)", async () => {
  const { w, t, lines, d } = await csvWorld();
  const from = lines - 99;
  const m = w.content.mint({ bundleId: doc1Bundle(w, d), captureSha: d,
    extent: { kind: "sheet-range", sheet: "csv", range: `A${from}:D${lines}` }, mintedBy: V("bob") });
  assert.equal(m.ok, true, JSON.stringify(m).slice(0, 300));
  const F4 = [{ name: "id", type: "string" }, { name: "name", type: "string" }, { name: "amount", type: "string" }, { name: "note", type: "string" }];
  const r = await w.c.declareTable({ source: m.content_id, schema: { fields: F4 }, header: ["id", "name", "amount", "note"], by: V("bob") });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  const body = t.trimEnd().split("\n").slice(from - 1);
  const read = await w.c.readTable({ sha: r.sha, viewer: V("bob"), limit: 1000 });
  assert.equal(read.table.rows.length, body.length, "the range's 100 rows");
  assert.equal(read.table.rows.at(-1).id, "LASTROWMARK");
  assert.equal(read.table.rows[0].id, body[0].split(",")[0]);
});

test("R1 (G41, seam): the ranged cells are numbered as a spreadsheet numbers them (K4647): row 1 of the 1 MB CSV is its header row, column 1 is A; the last row is row `lines`", async () => {
  const { w, t, lines, d } = await csvWorld();
  const first = w.content.mint({ bundleId: doc1Bundle(w, d), captureSha: d, extent: { kind: "sheet-range", sheet: "csv", range: "A1:D3" }, mintedBy: V("bob") });
  assert.equal(first.ok, true, JSON.stringify(first).slice(0, 300));
  const F4 = [{ name: "c1", type: "string" }, { name: "c2", type: "string" }, { name: "c3", type: "string" }, { name: "c4", type: "string" }];
  const r = await w.c.declareTable({ source: first.content_id, schema: { fields: F4 }, header: ["c1", "c2", "c3", "c4"], by: V("bob") });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  const read = await w.c.readTable({ sha: r.sha, viewer: V("bob") });
  assert.deepEqual(read.page.rows[0], ["id", "name", "amount", "note"], "row 1 is the header row, columns A to D");
  assert.equal(read.page.rows.length, 3);
  const last = w.content.mint({ bundleId: doc1Bundle(w, d), captureSha: d, extent: { kind: "sheet-range", sheet: "csv", range: `A${lines}:D${lines}` }, mintedBy: V("bob") });
  const r2 = await w.c.declareTable({ source: last.content_id, schema: { fields: F4 }, header: ["c1", "c2", "c3", "c4"], by: V("bob") });
  assert.equal(r2.ok, true, JSON.stringify(r2).slice(0, 300));
  assert.equal((await w.c.readTable({ sha: r2.sha, viewer: V("bob") })).page.rows[0][0], "LASTROWMARK", "the last row is row `lines`");
});

test("R1 R52 (G41, seam): a sheet-cell figure of the last row of the 1 MB CSV is read as its value (parseFigure)", async () => {
  const { w, lines, d } = await csvWorld();
  const m = w.content.mint({ bundleId: doc1Bundle(w, d), captureSha: d, extent: { kind: "sheet-cell", sheet: "csv", cell: `C${lines}` }, mintedBy: V("bob") });
  assert.equal(m.ok, true, JSON.stringify(m).slice(0, 300));
  const a = await w.c.evaluate({ recipe: DIFF, inputs: [{ name: "x", figure: m.content_id }, { name: "y", value: "0.25" }], viewer: V("bob") });
  assert.equal(a.ok, true, JSON.stringify(a).slice(0, 300));
  assert.match(JSON.stringify(a), /0\.75/, "1.00 less 0.25");
});

function doc1Bundle(w, capSha) {
  const r = w.rows(`SELECT bundle_id FROM bundles WHERE bundle_id LIKE 'INFO-%' ORDER BY rowid DESC LIMIT 1`)[0];
  return r.bundle_id;
}
