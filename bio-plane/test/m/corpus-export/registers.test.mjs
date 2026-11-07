/* corpus-export R16 (T53; N1259; K4403 (2), (3); K1493): a register is exported as its descriptors and tombstones, never
   as rows; a limited register's rows in no form; an import shows the descriptors and the removals and restores no row.
   Over registers' own world (`registers-world.mjs`). At the module's interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { registersWorld, SENTINEL, V } from "./registers-world.mjs";
import { viewWith } from "../registers/fixture.mjs";
import { verifyCorpusExport } from "../../../src/corpus-export/index.mjs";

const DESCRIPTOR_KEYS = ["counts", "filter", "filter_fingerprint", "imported_at", "original_fingerprints", "reduction", "register", "scope",
                         "segment_shas", "source", "source_date"];

test("R16: an export of an instance with two imports holds two descriptors, one tombstone and no cell; no segment travels, named by its digest alone", async () => {
  const w = registersWorld();
  await w.importOnce();
  await w.importOnce({ scope: "project", project: w.P, author: V("bob"), viewer: V("bob") });
  await w.removeRow(3);
  /* control: the store holds the cells and the segment the export must leave behind */
  assert.ok(w.sql(`SELECT COUNT(*) AS n FROM register_cells`)[0].n > 0, "control: the store holds cells");
  assert.ok(JSON.stringify(w.sql(`SELECT * FROM register_cells`)).includes(SENTINEL), "control: the scan finds the sentinel cell in the store");
  const segShas = w.sql(`SELECT DISTINCT sha256 FROM register_segments ORDER BY sha256`).map((r) => r.sha256);
  const segBundles = w.sql(`SELECT DISTINCT bundle_id FROM register_segments WHERE bundle_id IS NOT NULL`).map((r) => r.bundle_id);
  assert.ok(segShas.length && segBundles.length, "control: a segment is filed as a capture in a bundle");
  assert.ok(w.sql(`SELECT COUNT(*) AS n FROM register WHERE bundle_id IN (${segBundles.map(() => "?").join(",")})`, ...segBundles)[0].n > 0,
            "control: the segment is a registered capture");

  const m = w.ce.exportManifest({});
  const r = m.registers;
  assert.equal(r.descriptors.length, 2, "two descriptors");
  for (const d of r.descriptors) {
    for (const k of DESCRIPTOR_KEYS) assert.ok(k in d, `a descriptor states ${k}`);
    assert.equal(d.register, "town_filings");
    assert.ok(d.segment_shas.length > 0 && d.segment_shas.every((s) => segShas.includes(s)), "its segments named by digest");
    assert.ok(d.original_fingerprints.length > 0 && d.original_fingerprints.every((f) => /^[0-9a-f]{64}$/.test(f.sha256)));
  }
  assert.deepEqual(r.descriptors.map((d) => d.scope), ["team", "project"]);
  assert.equal(r.tombstones.length, 1, "one tombstone");
  assert.deepEqual(Object.keys(r.tombstones[0]).sort(), ["at", "ground", "key", "table"]);
  assert.equal(r.tombstones[0].ground, "unlawful");
  assert.equal(r.rows, "not_carried");
  assert.equal(typeof r.said, "string");

  /* no segment travels: not in any bundle's files, nor in the register */
  const listed = m.bundles.flatMap((b) => b.files.map((f) => f.sha256));
  for (const s of segShas) {
    assert.ok(!listed.includes(s), "no bundle lists the segment");
    assert.ok(!m.register.some((x) => x.capture_sha === s), "the register lists no segment");
  }
  assert.ok(!m.register.some((x) => segBundles.includes(x.bundle_id)), "nor any capture a segment's bundle holds");
  for (const b of m.bundles.filter((x) => segBundles.includes(x.bundle_id)))
    assert.deepEqual(b.files.map((f) => f.inline), b.files.map(() => true), "a segment's bundle travels as its inline record only");
  /* no cell in the export: the scan of the manifest and every page finds none */
  const all = await w.everything(m);
  assert.ok(!all.includes(SENTINEL), "no cell in any form");
  for (const t of ["register_cells", "register_import_rows", "register_rows", "register_tokens"])
    assert.equal(m.tables.find((e) => e.table === t).carried === "rows", false, `${t} carries no row`);
  /* the log records it */
  assert.equal(w.sql(`SELECT scope FROM export_log ORDER BY seq DESC LIMIT 1`)[0].scope, "working-corpus");

  /* control: the other exported tables are carried as declared */
  const imports = m.tables.find((t) => t.table === "register_imports");
  assert.deepEqual([imports.carried, imports.rows], ["rows", 2]);
  assert.equal(m.tables.find((t) => t.table === "register_removed").rows, 1);
  assert.ok(m.tables.filter((t) => t.owner === "record-core" && t.carried === "rows").length > 0);
});

test("R16: importing the export shows both descriptors and the tombstone and restores no row; a descriptor that carries rows is refused", async () => {
  const w = registersWorld();
  await w.importOnce();
  await w.importOnce({ scope: "project", project: w.P, author: V("bob"), viewer: V("bob") });
  const key = await w.removeRow(3);
  const m = w.ce.exportManifest({});
  const v = verifyCorpusExport({ manifest: m, bytes: new Map() });
  assert.equal(v.registers.descriptors.length, 2);
  assert.deepEqual(v.registers.tombstones.map((t) => t.key.row_key), [key], "the removal shows where it was");
  assert.equal(v.registers.rows_restored, 0, "no row restored");
  assert.equal(typeof v.registers.said, "string");
  assert.ok(!JSON.stringify(v).includes(SENTINEL));
  const tampered = { ...m, registers: { ...m.registers, descriptors: [{ ...m.registers.descriptors[0], cells: [{ donor_name: SENTINEL }] }] } };
  assert.ok(verifyCorpusExport({ manifest: tampered, bytes: new Map() }).failures.some((f) => f.reason === "REGISTER_ROWS_CARRIED"));
});

test("R16: a limited register's descriptor holds no cell either, and none of its rows travel", async () => {
  const limited = viewWith((v) => { const r = v.registers.find((x) => x.key === "town_filings"); r.use_limit = "federal_contributor_use"; r.row_key_basis = "source"; });
  const w = registersWorld({ view: limited });
  await w.importOnce();
  assert.ok(JSON.stringify(w.sql(`SELECT * FROM register_cells`)).includes(SENTINEL), "control: the limited register's cells are held");
  const m = w.ce.exportManifest({});
  assert.equal(m.registers.descriptors.length, 1);
  assert.ok(!(await w.everything(m)).includes(SENTINEL), "a limited register's rows in no form");
});
