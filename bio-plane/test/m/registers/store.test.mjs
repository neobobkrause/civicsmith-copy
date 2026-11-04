/* registers R21–R23 (T53; N1259; K4403 (2); K1727; K4354): a row version stored once, the row index a rebuildable bounded table behind one
   storage port (a contract suite run unchanged against both implementations), storage bounded in memory and in time. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { seeded, world, sourceKeyed, V, served, csv, rowOf, enc, URL_, DEF } from "./fixture.mjs";
import { memoryRowStore, sqliteRowStore, migrateRegisters, contentHashOf, REGISTERS_SCHEMA } from "../../../src/registers/index.mjs";
import { matches } from "../../../src/register-readers/index.mjs";
import { decodeAfter, countableFilter } from "../../../src/registers/port.mjs";

const START = (w, over = {}) => w.registers.importStart({ register: "town_filings", filter: {}, scope: "project", project: w.P, author: V("bob"), viewer: V("bob"), holes: { table: "2025" }, ...over });
const def = DEF("town_filings");
const kept = def.columns.filter((c) => c.keep).map((c) => c.name);
const version = (i, scope = "team", extra = {}) => {
  const cells = Object.fromEntries(kept.map((k) => [k, rowOf(i, extra)[k] ?? ""]));
  const content_hash = contentHashOf(cells, kept);
  return { scope_key: scope, register: "town_filings", row_key: `K${String(i).padStart(4, "0")}`, content_hash, project: scope === "team" ? null : scope.slice(8), first_import: 1, segment_sha: "a".repeat(64), src_row: i + 2, cells, definition: def };
};
const sqlitePort = () => {
  const db = new DatabaseSync(":memory:");
  const sql = { exec: (q, ...a) => { const st = db.prepare(q); return st.columns().length ? st.all(...a.map((x) => (x === undefined ? null : x))) : (st.run(...a), []); } };
  migrateRegisters(sql);
  return sqliteRowStore(sql, { termsOf: () => def, freeBytes: () => 12345 });
};
const impls = { memory: () => memoryRowStore({ termsOf: () => def, freeBytes: () => 12345 }), sqlite: sqlitePort };

for (const [name, make] of Object.entries(impls)) {
  test(`R22 contract (${name}): put is idempotent, get returns the cells, scan answers in the search order and by terms, paging equals unpaged, key ranges and counts hold, remove clears a key, rebuild equals the index`, () => {
    const p = make();
    const delta = Array.from({ length: 40 }, (_, i) => version(i));
    assert.deepEqual(p.put(delta), { written: 40, existed: 0 });
    assert.deepEqual(p.put(delta), { written: 0, existed: 40 }, "a version already held is not written again");
    assert.deepEqual(p.get(delta[3]).cells, delta[3].cells);
    assert.equal(p.get({ ...delta[3], content_hash: "0".repeat(64) }), null);
    assert.equal(p.count({ scopes: ["team"], register: "town_filings" }), 40);
    assert.equal(p.count({ scopes: ["project:X"], register: "town_filings" }), 0);
    assert.equal(p.freeBytes(), 12345);
    /* the search order: date descending, then key */
    const all = [...p.scan({ scopes: ["team"], register: "town_filings" })];
    assert.equal(all.length, 40);
    const dates = all.map((r) => r.date);
    assert.deepEqual(dates, [...dates].sort((a, b) => (a === null) - (b === null) || (a < b ? 1 : a > b ? -1 : 0)), "date descending, undetermined last");
    for (let i = 1; i < all.length; i++) if (all[i - 1].date === all[i].date) assert.ok(all[i - 1].row_key < all[i].row_key);
    /* terms: a name by tokens, a filer id, an amount range, a date range, each alone and together (verified as the caller verifies) */
    const hit = (filter) => [...p.scan({ scopes: ["team"], register: "town_filings", filter })].filter((r) => matches(r.cells, filter, def)).map((r) => r.row_key);
    assert.deepEqual(hit({ names: ["Donor 14"] }), ["K0014"]);
    assert.deepEqual(hit({ names: ["14 Donor"] }), ["K0014"], "either order");
    assert.deepEqual(hit({ filer_ids: ["F10003"] }).length, 6);
    assert.deepEqual(hit({ amount: { min: "110", max: "112" } }).sort(), ["K0010", "K0011", "K0012"]);
    assert.deepEqual(hit({ date: { from: "2025-03-01", to: "2025-03-31" } }).length, 5);
    assert.deepEqual(hit({ filer_ids: ["F10003"], date: { from: "2025-04-01", to: "2025-04-30" } }), ["K0003"]);
    assert.deepEqual(hit({ organizations: ["Firm 15"] }), ["K0015"]);
    /* paging by the cursor equals the unpaged order */
    const paged = [];
    let after = null;
    for (;;) {
      const it = p.scan({ scopes: ["team"], register: "town_filings", after })[Symbol.iterator]();
      const page = [];
      for (let n = 0; n < 15; n++) { const r = it.next(); if (r.done) break; page.push(r.value); }
      if (!page.length) break;
      paged.push(...page);
      const last = page[page.length - 1];
      after = btoa(JSON.stringify([last.date ?? null, last.row_key, last.content_hash, last.scope_key]));
      assert.ok(decodeAfter(after));
    }
    assert.deepEqual(paged.map((r) => r.row_key), all.map((r) => r.row_key));
    /* R23, R24: an exactly judged filter's matches after a cursor are counted from the index: the same number the verified scan gives, at most the cap */
    const mid = all[9];
    const at = btoa(JSON.stringify([mid.date ?? null, mid.row_key, mid.content_hash, mid.scope_key]));
    for (const filter of [{}, { filer_ids: ["F10003"] }, { names: ["Donor 14"] }, { date: { from: "2025-03-01" } }, { organizations: ["Firm 15"], forms: ["460-15"] }]) {
      assert.equal(countableFilter(filter), true);
      const verified = [...p.scan({ scopes: ["team"], register: "town_filings", filter, after: at })].filter((r) => matches(r.cells, filter, def)).length;
      assert.equal(p.countAfter({ scopes: ["team"], register: "town_filings", filter, after: at, cap: 1000 }), verified, JSON.stringify(filter));
    }
    assert.equal(p.countAfter({ scopes: ["team"], register: "town_filings", filter: {}, after: at, cap: 7 }), 7, "at most the cap");
    assert.equal(countableFilter({ amount: { min: "1" } }), false, "an amount is rounded in the index, so it is read and judged");
    assert.equal(countableFilter({ names: ["--"] }), false, "a name with no token");
    /* key ranges and versions */
    assert.deepEqual(p.listByKeyRange({ scopes: ["team"], register: "town_filings", from: "K0010", to: "K0013" }).map((r) => r.row_key), ["K0010", "K0011", "K0012"]);
    p.put([version(5, "team", { note: "changed" })]);
    assert.equal(p.versionsOf({ scopes: ["team"], register: "town_filings", row_key: "K0005" }).length, 2, "every version seen is kept");
    /* rebuild */
    assert.equal(p.rebuild(null).length, 41);
    assert.equal(p.rebuild({ scope_key: "team" }).length, 41);
    assert.equal(p.rebuild({ scope_key: "project:nope" }).length, 0);
    /* remove clears a key from cells and index */
    assert.deepEqual(p.remove({ register: "town_filings", row_key: "K0005" }).segments, ["a".repeat(64)]);
    assert.equal(p.versionsOf({ scopes: ["team"], register: "town_filings", row_key: "K0005" }).length, 0);
    assert.equal(p.count({ scopes: ["team"], register: "town_filings" }), 39);
  });
}

test("R22: the two implementations answer the same for the same sequence", () => {
  const [m, s] = [impls.memory(), impls.sqlite()];
  const delta = [...Array.from({ length: 30 }, (_, i) => version(i)), ...Array.from({ length: 10 }, (_, i) => version(i, "project:P1"))];
  for (const p of [m, s]) p.put(delta);
  const run = (p) => ({ scan: [...p.scan({ scopes: ["team", "project:P1"], register: "town_filings", filter: { filer_ids: ["F10002"] } })].map((r) => [r.scope_key, r.row_key, r.date]),
                       count: p.count({ scopes: ["team", "project:P1"] }), range: p.listByKeyRange({ scopes: ["project:P1"], register: "town_filings", limit: 3 }).map((r) => r.row_key) });
  assert.deepEqual(run(m), run(s));
});

test("R21, R30: each held version points at the segment that first held it, by row number and byte range: the range is that row's bytes; a changed row points into the new import's segment; after a removal the other rows' pointers still resolve", async () => {
  const w = seeded();
  START(w);
  await w.drain({ [URL_]: served(enc(csv(30))) });
  const dec = new TextDecoder();
  const check = async () => {
    const held = w.sql(`SELECT segment_sha, seg_row, byte_at, byte_len, src_row, first_import FROM register_cells ORDER BY src_row, first_import`);
    for (const c of held) {
      const bytes = await w.registers.bytesOf(c.segment_sha);
      const line = dec.decode(bytes.subarray(c.byte_at, c.byte_at + c.byte_len));
      assert.ok(line.endsWith("\n") && line.startsWith(`${c.src_row},`), `the range of source row ${c.src_row} is its row (${JSON.stringify(line.slice(0, 20))})`);
      assert.equal(dec.decode(bytes).split("\n")[c.seg_row] + "\n", line, "the row number names the same row");
    }
    return held;
  };
  const first = await check();
  assert.equal(first.length, 30);
  w.clock.ms += 3_600_000;
  START(w);
  await w.drain({ [URL_]: served(enc(csv(30, { cell: (i) => rowOf(i, i === 7 ? { note: "changed" } : {}) }))) });
  const second = await check();
  const changed = second.filter((c) => c.first_import === 2);
  assert.equal(changed.length, 1, "one new version");
  assert.notEqual(changed[0].segment_sha, first[0].segment_sha, "it points into the second import's segment");
  assert.equal(second.filter((c) => c.first_import === 1).every((c) => c.segment_sha === first[0].segment_sha), true, "the rest still point where they were first held");
  const key = w.sql(`SELECT row_key FROM register_import_rows WHERE import_id=1 AND src_row=5`)[0].row_key;
  const out = await w.registers.rowExpunge({ register: "town_filings", row_key: key, ground: "unlawful", reason: "the filer was a minor", author: V("alice") });
  assert.equal(out.ok, true);
  const after = await check();
  assert.equal(after.length, 30, "31 versions less the removed row's");
  assert.equal(after.some((c) => c.src_row === 5), false);
});

test("R21: a re-import of the same bytes writes no cell, no index row and no segment object beyond its descriptor; one changed row writes one of each; the first import still reads the old version", async () => {
  const w = seeded({ view: sourceKeyed() });
  START(w);
  await w.drain({ [URL_]: served(enc(csv(40))) });
  const objects = w.b.held.size;
  const n = () => [w.count("register_cells"), w.count("register_rows"), w.count("register_import_rows")];
  assert.deepEqual(n(), [40, 40, 40]);
  w.clock.ms += 3_600_000;
  START(w);
  await w.drain({ [URL_]: served(enc(csv(40))) });
  assert.deepEqual([w.count("register_cells"), w.count("register_rows")], [40, 40], "no cell and no index row written");
  assert.equal(w.b.held.size, objects, "no segment object written");
  assert.equal(w.count("register_import_rows"), 80, "the descriptor says which version stood where");
  assert.equal(w.sql(`SELECT rows_new, rows_unchanged FROM register_imports WHERE import_id=2`)[0].rows_new, 0);
  assert.equal(w.sql(`SELECT rows_unchanged FROM register_imports WHERE import_id=2`)[0].rows_unchanged, 40, "records unchanged for the rest");
  /* one changed row */
  w.clock.ms += 3_600_000;
  START(w);
  await w.drain({ [URL_]: served(enc(csv(40, { cell: (i) => rowOf(i, i === 7 ? { note: "changed" } : {}) }))) });
  assert.deepEqual([w.count("register_cells"), w.count("register_rows")], [41, 41]);
  assert.equal(w.b.held.size, objects + 1, "one new segment object");
  /* the old version is still returned for the first import; the new for the third */
  const key = w.sql(`SELECT row_key FROM register_import_rows WHERE import_id=1 AND src_row=8`)[0].row_key;
  assert.equal(w.registers.rowOf({ import: 1, row_key: key, viewer: V("bob") }).cells.note, "note 7");
  assert.equal(w.registers.rowOf({ import: 3, row_key: key, viewer: V("bob") }).cells.note, "changed");
  assert.equal(w.registers.rowOf({ import: 3, row_key: key, viewer: V("bob") }).version, 2);
  /* control: another scope stores its own copy */
  START(w, { scope: "team", project: undefined, author: V("alice"), viewer: V("alice") });
  await w.drain({ [URL_]: served(enc(csv(40, { cell: (i) => rowOf(i, i === 7 ? { note: "changed" } : {}) }))) });
  assert.equal(w.count("register_cells"), 41 + 40);
});

test("R22: the index is declared derived-rebuildable over the cells; after an import sequence rebuildAndCompare is {same: true}; a corrupted index row gives {same: false, first}; every table is declared with classes", async () => {
  const w = seeded();
  START(w);
  await w.drain({ [URL_]: served(enc(csv(60))) });
  w.clock.ms += 3_600_000;
  START(w, { scope: "team", project: undefined, author: V("alice"), viewer: V("alice") });
  await w.drain({ [URL_]: served(enc(csv(60, { cell: (i) => rowOf(i, i % 9 === 0 ? { paid: `${700 + i}.00` } : {}) }))) });
  assert.deepEqual(w.record.rebuildAndCompare("registers", "register_rows"), { same: true });
  const decl = w.record.declaredTables().filter((d) => d.module === "registers");
  const mine = [...REGISTERS_SCHEMA.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1]);
  const tables = w.sql(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'register_%' ORDER BY name`).map((r) => r.name).filter((n) => mine.includes(n));
  assert.deepEqual(decl.map((d) => d.name).sort(), tables, "every table is declared");
  const by = Object.fromEntries(decl.map((d) => [d.name, d]));
  assert.deepEqual([by.register_rows.purge, by.register_rows.expunge, by.register_rows.export, by.register_rows.sight, by.register_rows.derive], ["clear", "tombstone", "never", "source", "derived-rebuildable"]);
  assert.deepEqual(by.register_rows.from, ["register_cells"]);
  for (const t of ["register_imports", "register_interests", "register_segments", "register_changes"]) assert.equal(by[t].export, "yes", `${t} is an exportable descriptor`);
  for (const t of ["register_cells", "register_rows", "register_import_rows"]) assert.equal(by[t].export, "never", `${t} is never exported`);
  for (const t of ["register_proposals", "register_definitions"]) assert.equal(by[t].sight, "group");
  /* control: a corrupted index row */
  w.sql(`UPDATE register_rows SET date='1900-01-01' WHERE rowid = (SELECT MIN(rowid) FROM register_rows)`);
  const bad = w.record.rebuildAndCompare("registers", "register_rows");
  assert.equal(bad.same, false);
  assert.ok(bad.first && bad.first.key && bad.first.held && bad.first.rebuilt);
});

test("R22: the point lookup and the one-criterion page are index reads, not scans, so their time does not grow with the number of imports held", async () => {
  const w = seeded();
  START(w);
  await w.drain({ [URL_]: served(enc(csv(30))) });
  const plan = (q, ...a) => w.sql(`EXPLAIN QUERY PLAN ${q}`, ...a).map((r) => r.detail).join(" | ");
  assert.match(plan(`SELECT * FROM register_cells WHERE scope_key=? AND register=? AND row_key=? AND content_hash=?`, "t", "r", "k", "h"), /USING (COVERING )?INDEX|PRIMARY KEY/);
  assert.match(plan(`SELECT * FROM register_rows WHERE register=? AND filer_id IN (?)`, "r", "F"), /INDEX/);
  assert.match(plan(`SELECT * FROM register_rows WHERE register=? AND scope_key IN (?) AND date >= ?`, "r", "t", "2025-01-01"), /INDEX/);
  assert.match(plan(`SELECT * FROM register_import_rows WHERE import_id=? AND row_key=?`, 1, "k"), /INDEX|PRIMARY KEY/);
  assert.match(plan(`SELECT * FROM register_cells WHERE register=? AND row_key >= ? AND row_key < ?`, "r", "a", "b"), /INDEX/);
});

test("R23: a page by a number criterion (filer, form, licence, docket) reads its rows already in the search order: no sort of every match, so the page's time does not grow with the rows held", async () => {
  const w = seeded();
  START(w);
  await w.drain({ [URL_]: served(enc(csv(30))) });
  for (const col of ["filer_id", "form", "licence_no", "docket_no"]) {
    const plan = w.sql(`EXPLAIN QUERY PLAN SELECT r.scope_key, r.register, r.row_key, r.content_hash, r.date, c.cells FROM register_rows r JOIN register_cells c ON c.scope_key=r.scope_key AND c.register=r.register AND c.row_key=r.row_key AND c.content_hash=r.content_hash
                        WHERE r.scope_key IN (?,?) AND r.register=? AND r.${col} IN (?) ORDER BY (r.date IS NULL), r.date DESC, r.row_key, r.content_hash, r.scope_key`, "team", "project:P", "town_filings", "X").map((r) => r.detail).join(" | ");
    assert.match(plan, new RegExp(`SEARCH r USING (COVERING )?INDEX \\w+ \\(register=\\? AND ${col}=\\?\\)`), `${col}: ${plan}`);
    assert.doesNotMatch(plan, /TEMP B-TREE/, `${col}: no sort of the matches (${plan})`);
  }
});

test("R23: with the shelf nearly full an import pauses with reason shelf and the figures, nothing written past the pause; resume is refused while it would pass 90%; with room it runs", async () => {
  const total = 10 * 1024 ** 3;
  let free = total * 0.05;
  const w = seeded({ freeBytes: () => free });
  START(w);
  const { ticks } = await w.drain({ [URL_]: served(enc(csv(30))) }, { max: 6 });
  const row = w.sql(`SELECT state, paused_reason, reason FROM register_imports`)[0];
  assert.deepEqual([row.state, row.paused_reason], ["paused", "shelf"]);
  assert.match(row.reason, /shelf/);
  assert.equal(ticks.at(-1).paused, "shelf");
  assert.deepEqual([w.count("register_cells"), w.count("register_rows"), w.count("register_import_rows"), w.count("register_segments")], [0, 0, 0, 0], "nothing is partly written");
  const refused = w.registers.importSet({ import: 1, action: "resume", author: V("bob"), viewer: V("bob") });
  assert.deepEqual([refused.ok, refused.reason], [false, "SHELF_NEARLY_FULL"]);
  assert.ok(refused.shelf.would_use_pct >= 90);
  free = total * 0.5;
  assert.equal(w.registers.importSet({ import: 1, action: "resume", author: V("bob"), viewer: V("bob") }).ok, true);
  await w.drain({ [URL_]: served(enc(csv(30))) });
  assert.equal(w.sql(`SELECT state FROM register_imports`)[0].state, "indexed");
  /* the delta states the shelf too */
  free = total * 0.2;
  const d = (await w.withNet({ [URL_]: served(enc(csv(30))) }, () => w.registers.registerDelta({ register: "town_filings", filter: {}, scope: "project", project: w.P, viewer: V("bob"), holes: { table: "2025" } }))).out;
  assert.deepEqual([d.shelf.free_bytes, d.shelf.warn], [free, true]);
});

test("R23: a slice holds one segment and little else: no segment of an import is larger than half of SLICE_MEMORY_MB, whatever segment size was asked for", async () => {
  const w = seeded({ bounds: { segment_max: 1024 ** 3 } });
  assert.equal(w.registers.bounds.segment_max, Math.floor((w.registers.bounds.SLICE_MEMORY_MB * 1048576) / 2));
  const rows = 4000;
  const small = seeded({ bounds: { SLICE_MEMORY_MB: 0.02 } });
  small.registers.importStart({ register: "town_filings", filter: {}, scope: "project", project: small.P, author: V("bob"), viewer: V("bob"), holes: { table: "2025" } });
  await small.drain({ [URL_]: served(enc(csv(rows))) });
  const sizes = small.sql(`SELECT bytes FROM register_segments`).map((r) => r.bytes);
  assert.ok(sizes.length > 3);
  assert.ok(Math.max(...sizes) <= 0.02 * 1048576 / 2 + 400, `segments stay within the bound (${Math.max(...sizes)})`);
  assert.equal(small.count("register_cells"), rows);
});

test("R23: an index at the suite's size (30,000 rows) answers rowOf and a one-criterion page within 1,500 ms; at 1,000,000 rows that time is a measurement (M-R3), never a module test (K5819)", async () => {
  const rows = 30000;
  const w = seeded({ bounds: { segment_max: 1024 * 1024 } });
  START(w);
  await w.drain({ [URL_]: served(enc(csv(rows))) }, { max: Math.max(400, Math.ceil(rows / 2000)) });
  assert.equal(w.count("register_cells"), rows);
  const key = w.sql(`SELECT row_key FROM register_import_rows WHERE src_row=?`, Math.floor(rows / 2))[0].row_key;
  const timed = (f) => { const t = performance.now(); const out = f(); return [out, performance.now() - t]; };
  const [row, rowMs] = timed(() => w.registers.rowOf({ import: 1, row_key: key, viewer: V("bob") }));
  assert.equal(row.ok, true);
  const [page, pageMs] = timed(() => w.registers.searchRows({ scope: { register: "town_filings" }, filer_id: "F10003", limit: 50, viewer: V("bob") }));
  assert.equal(page.rows.length, 50);
  assert.ok(rowMs < 1500, `rowOf ${rowMs.toFixed(0)} ms over ${rows} rows`);
  assert.ok(pageMs < 1500, `one-criterion page ${pageMs.toFixed(0)} ms over ${rows} rows`);
  console.log(`R23 measured: ${rows} rows, rowOf ${rowMs.toFixed(1)} ms, one-criterion page ${pageMs.toFixed(1)} ms`);
});
