/* corpus-export — its route arms (R6; N483, K1122): `corpusExportOps(ce, q)` answers each op as the service it names
   answers, with the query's parameter passed through. Driven at the module's interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, NOW } from "./fixture.mjs";
import * as CE from "../../../src/corpus-export/index.mjs";
const { corpusExportOps, EXPORT_NOTE_MAX } = CE;

const A = "INFO-2026-0001-minutes", B = "INQ-2026-0001";
const query = (params) => { const asked = []; const q = (k) => { asked.push(k); return params[k] ?? null; }; return { q, asked }; };

test("R6 corpusExportOps publishes exactly the arms export, exportlog, exportpage and exportrender, each a function of no arguments", () => {
  const w = world();
  const ops = corpusExportOps(w.ce, query({}).q);
  assert.deepEqual(Object.keys(ops).sort(), ["export", "exportlog", "exportpage", "exportrender"]);
  for (const [name, arm] of Object.entries(ops)) {
    assert.equal(typeof arm, "function", name);
    assert.equal(arm.length, 0, `${name} takes no arguments`);
  }
  assert.deepEqual(Object.keys({ ...ops }).sort(), ["export", "exportlog", "exportpage", "exportrender"], "a spread carries every arm");
});

test("R6 the export arm answers R1 with q(\"note\") passed through: the same manifest exportManifest answers, and the same log row", () => {
  const w = world();
  w.doc(A, ["the minutes, as captured"]);
  w.inquiry(B, { cites: [A] });
  w.inquiry(B, { question: "Revised?", cites: [A] });
  for (const note of ["for the archive", "n".repeat(400), null]) {
    const { q, asked } = query({ note });
    const viaOps = corpusExportOps(w.ce, q).export();
    assert.deepEqual(asked, ["note"], "the arm reads note, and only note");
    const direct = w.ce.exportManifest({ note });
    /* export_log is itself a carried table, so the second export carries the first's row: compared without it */
    const bare = (m) => ({ ...m, tables: m.tables.filter((t) => t.table !== "export_log"), counts: { ...m.counts, rows: null } });
    assert.deepEqual(bare(viaOps), bare(direct), `the arm answers what R1 answers (note ${String(note).slice(0, 12)})`);
    const [byArm, byService] = w.rows(`SELECT at, scope, bundles, files, note FROM export_log ORDER BY seq DESC LIMIT 2`).reverse();
    assert.deepEqual(byArm, byService, "the arm logs the row R1 logs");
    assert.equal(byArm.note, note === null ? null : note.slice(0, EXPORT_NOTE_MAX), "the note passed through, cut as R1 cuts it");
  }
  /* the arm reads the query when it runs, not when the map is made */
  const params = { note: "early" };
  const arm = corpusExportOps(w.ce, (k) => params[k] ?? null).export;
  params.note = "late";
  arm();
  assert.equal(w.row(`SELECT note FROM export_log ORDER BY seq DESC LIMIT 1`).note, "late");
});

test("R6 the exportlog arm answers R2 with q(\"limit\") passed through: the same rows, bound and truncated as exportLog", () => {
  const w = world();
  for (let i = 0; i < 5; i++)
    w.st.sql.exec(`INSERT INTO export_log (at, scope, bundles, files, note) VALUES (?, 'working-corpus', ?, 0, NULL)`, NOW, i);
  for (const limit of [null, "2", "0", "-5", "5000", "x", "2.9", "5", "4"]) {
    const { q, asked } = query({ limit });
    const viaOps = corpusExportOps(w.ce, q).exportlog();
    assert.deepEqual(asked, ["limit"], "the arm reads limit, and only limit");
    assert.deepEqual(viaOps, w.ce.exportLog({ limit }), `limit ${limit}`);
  }
  const { q } = query({ limit: "2" });
  const two = corpusExportOps(w.ce, q).exportlog();
  assert.deepEqual([two.exports.map((e) => e.bundles), two.limit, two.truncated], [[4, 3], 2, true]);
  assert.equal(w.count("export_log"), 5, "reading the log writes nothing");
});

test("R6 the exportpage arm answers R8's page with q(\"table\"), q(\"index\") and q(\"after\") passed through", () => {
  const w = world();
  w.doc(A, ["the minutes, as captured"]);
  w.inquiry(B, { cites: [A] });
  const x = w.ce.exportManifest({});
  for (const t of x.tables.filter((e) => e.pages.length))
    for (const p of t.pages) {
      const { q, asked } = query({ table: t.table, index: String(p.index), after: JSON.stringify(p.after) });
      const viaOps = corpusExportOps(w.ce, q).exportpage();
      assert.deepEqual(asked.sort(), ["after", "index", "table"]);
      assert.deepEqual(viaOps, w.ce.exportPage({ table: t.table, index: p.index, after: p.after }), `${t.table} ${p.index}`);
      assert.equal(viaOps.sha256, p.sha256);
    }
  assert.equal(corpusExportOps(w.ce, query({ table: "nothing", index: "0" }).q).exportpage().reason, "EXPORT_TABLE_UNKNOWN");
});

test("R6 the exportrender arm answers R10 with q(\"format\"), q(\"viewer\") and q(\"part\") passed through", () => {
  const w = world();
  for (const [format, viewer, part] of [["ftm", "admin", null], ["popolo", "member:olive", "1"], ["csv", "admin", null], [null, null, null], ["fdp", "admin", "2"], ["fdp", "admin", "0"]]) {
    const { q, asked } = query({ format, viewer, part });
    const viaOps = corpusExportOps(w.ce, q).exportrender();
    assert.deepEqual(asked.sort(), ["format", "part", "viewer"]);
    assert.deepEqual(viaOps, w.ce.exportRendering({ format, viewer, part }), `${format} ${viewer} ${part}`);
  }
});

test("R18 the exportwholepart arm answers one part with q(\"file\"), q(\"offset\") and q(\"bytes\") passed through", async () => {
  assert.equal(typeof CE.wholeExportOps, "function", "the whole-record arms are published");
  const w = world();
  w.doc(A, ["the minutes, as captured"]);
  const x = await w.ce.exportWhole({});
  assert.ok(x.parts.length > 0);
  for (const p of x.parts) {
    const { q, asked } = query({ file: p.file, offset: String(p.offset), bytes: String(p.bytes) });
    const viaOps = await CE.wholeExportOps(w.ce, q).exportwholepart();
    assert.deepEqual(asked.sort(), ["bytes", "file", "offset"]);
    assert.deepEqual(viaOps, await w.ce.exportWholePart({ file: p.file, offset: p.offset, bytes: p.bytes }));
    assert.equal(viaOps.sha256, p.sha256);
  }
});
