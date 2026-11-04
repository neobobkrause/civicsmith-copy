/* registers: the gaps the review of PR #60 found (T53; BOB #338's CHANGE), each shown at the module's interface: paging past the counted matches (R24),
   the use limit on compare and on a repeated cite (R27), the labels by key (R15, R45), no service named in code (R43), the lookup a member's only (R46),
   a member's re-check of a team pre-read (R33), the doors to an interest's forgetting and reading (R32), a resume past the warning mark (R23), the file
   act bounded (R11, R23). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { seeded, V, served, csv, rowOf, enc, URL_, viewWith, sourceKeyed } from "./fixture.mjs";
import { registersOps } from "../../../src/registers/index.mjs";

const START = (w, over = {}) => w.registers.importStart({ register: "town_filings", filter: {}, scope: "team", author: V("alice"), viewer: V("alice"), holes: { table: "2025" }, ...over });
const limited = () => viewWith((v) => { const r = v.registers.find((x) => x.key === "town_filings"); r.use_limit = "federal_contributor_use"; r.row_key_basis = "source"; });

test("R24: rows past the counted matches are still answered: 150 matches paged by 50 with the count bound at 100 join to all 150, the count capped", async () => {
  const w = seeded({ bounds: { MATCH_COUNT_MAX: 100 } });
  START(w);
  await w.drain({ [URL_]: served(enc(csv(150))) });
  const seen = [];
  let after, first;
  for (let i = 0; i < 10; i++) {
    const p = w.registers.searchRows({ scope: { register: "town_filings" }, limit: 50, viewer: V("bob"), ...(after ? { after } : {}) });
    first ??= p;
    seen.push(...p.rows.map((r) => r.row_key));
    if (!p.next) break;
    after = p.next;
  }
  assert.equal(seen.length, 150);
  assert.equal(new Set(seen).size, 150);
  assert.deepEqual([first.matched, first.capped], [100, true]);
});

test("R24, R23: past the page the count is exact whether the filter is counted from the index (a number, a name, a date) or read row by row (an amount): each equals the rows the pages join to", async () => {
  const w = seeded();
  START(w);
  await w.drain({ [URL_]: served(enc(csv(400))) });
  for (const q of [{ filer_id: "F10003" }, { name: "Donor" }, { date: { from: "2025-03-01", to: "2025-06-30" } }, { amount: { min: "150", max: "420" } }, { filer_id: "F10003", amount: { min: "150" } }]) {
    const rows = [];
    let after, first;
    for (let i = 0; i < 60; i++) {
      const p = w.registers.searchRows({ scope: { register: "town_filings" }, limit: 10, viewer: V("bob"), ...q, ...(after ? { after } : {}) });
      first ??= p;
      rows.push(...p.rows);
      if (!p.next) break;
      after = p.next;
    }
    assert.ok(rows.length > 10, JSON.stringify(q));
    assert.deepEqual([first.matched, first.capped], [rows.length, false], JSON.stringify(q));
  }
});

test("R27: compare on a use-limited register pages to RESULT_CAP rows in all and carries the limit; a repeated cite carries it too", async () => {
  const w = seeded({ view: limited(), bounds: { RESULT_CAP: 30 } });
  START(w);
  await w.drain({ [URL_]: served(enc(csv(5))) });
  w.clock.ms += 3_600_000;
  START(w);
  await w.drain({ [URL_]: served(enc(csv(60))) });
  let n = 0, next, last;
  for (let i = 0; i < 10; i++) {
    last = w.registers.compare({ import_a: 1, import_b: 2, viewer: V("bob"), limit: 20, ...(next ? { after: next } : {}) });
    if (!last.ok) break;
    assert.equal(last.use_limit.key, "federal_contributor_use");
    n += last.rows.length;
    next = last.next;
    if (!next) break;
  }
  assert.equal(n, 30, "at most RESULT_CAP rows");
  assert.deepEqual([last.ok, last.reason], [false, "RESULT_CAP"]);
  const key = w.sql(`SELECT row_key FROM register_import_rows WHERE import_id=1 AND src_row=2`)[0].row_key;
  const a = w.registers.citeRow({ import: 1, row_key: key, author: V("bob"), viewer: V("bob") });
  const b = w.registers.citeRow({ import: 1, row_key: key, author: V("bob"), viewer: V("bob") });
  assert.deepEqual([a.existed, b.existed], [false, true]);
  assert.equal(b.use_limit.key, "federal_contributor_use");
});

test("R45, R15: search and compare rows carry label_key; the listing's held entry and a cite's extract carry the reduced key", async () => {
  const w = seeded({ view: sourceKeyed() });
  START(w);
  await w.drain({ [URL_]: served(enc(csv(10))) });
  w.clock.ms += 3_600_000;
  START(w);
  await w.drain({ [URL_]: served(enc(csv(12))) });
  assert.equal(w.registers.searchRows({ scope: { register: "town_filings" }, viewer: V("bob") }).rows[0].label_key, "register.extract");
  const c = w.registers.compare({ import_a: 1, import_b: 2, viewer: V("bob") });
  assert.ok(c.rows.length > 0 && c.rows.every((r) => r.label_key === "register.extract"));
  const held = w.registers.registerList({ viewer: V("bob") }).known.find((k) => k.key === "town_filings").held;
  assert.ok(held.length === 2 && held.every((h) => h.reduced_key === "register.reduced"));
  const key = w.sql(`SELECT row_key FROM register_import_rows WHERE import_id=1 AND src_row=2`)[0].row_key;
  assert.equal(w.registers.citeRow({ import: 1, row_key: key, author: V("bob"), viewer: V("bob") }).extract.reduced_key, "register.reduced");
});

test("R43: no keyed service of a jurisdiction is named in the module's code", () => {
  const dir = new URL("../../../src/registers/", import.meta.url);
  const src = ["core", "runner", "search", "watch", "ops", "port", "schema", "limits", "reduced", "index"].map((f) => readFileSync(new URL(`${f}.mjs`, dir), "utf8")).join("\n");
  assert.ok(!/ca-officers|courtlistener/.test(src));
});

test("R46: the officers lookup is a member's: an author who is no member reaches no keyed fetch; control: a member's does", async () => {
  const w = seeded();
  const calls = [];
  w.registers.acq = { ...w.registers.acq, keyedFetch: async (store, a) => { calls.push(a); return { ok: true, text: "[]" }; } };
  const stranger = await w.registers.officersLookup({ query: "C1234567", author: "stranger", viewer: "stranger" });
  assert.deepEqual([stranger.ok, stranger.reason, calls.length], [false, "MACHINE_CANNOT_LOOK_UP_OFFICERS", 0]);
  const member = await w.registers.officersLookup({ query: "C1234567", author: V("bob"), viewer: V("bob") });
  assert.equal(member.ok, true);
  assert.equal(calls.length, 1);
});

test("R33: a member who is no administrator re-checks a team pre-read by registerRefresh; a new team pre-read stays an administrator's act", async () => {
  const w = seeded({ view: viewWith((v) => { v.registers.find((r) => r.key === "town_filings").refresh = { cadence_hours: 24, validators: ["etag"] }; }) });
  START(w);
  await w.drain({ [URL_]: served(enc(csv(10)), { etag: '"a"' }) });
  w.clock.ms += 3_600_000;
  const r = await w.withNet({ [URL_]: served(enc(csv(11)), { etag: '"b"' }) }, () => w.registers.registerRefresh({ import: 1, author: V("bob"), viewer: V("bob") }));
  assert.equal(r.out.ok, true, JSON.stringify(r.out));
  assert.equal(w.sql(`SELECT scope, kind FROM register_imports WHERE import_id=?`, r.out.import)[0].kind, "refresh");
  assert.equal(w.registers.importStart({ register: "town_filings", filter: { filer_ids: ["F10002"] }, scope: "team", author: V("bob"), viewer: V("bob"), holes: { table: "2025" } }).reason, "NOT_AN_ADMIN");
});

test("R32: the door reaches forgetting an interest (forget: true) and reading a project's interests", async () => {
  const w = seeded();
  const door = (op, fields) => registersOps(w.registers, new URL(`http://x/?op=${op}&viewer=${encodeURIComponent(V("bob"))}`), { ...fields, by: V("bob") })[op]();
  const set = await door("registerinterest", { register: "town_filings", project: w.P, filter: { filer_ids: ["F10001"] } });
  assert.equal(set.ok, true);
  const read = await door("registerinterests", { project: w.P });
  assert.deepEqual([read.ok, read.interests.length], [true, 1]);
  const gone = await door("registerinterest", { register: "town_filings", project: w.P, forget: true });
  assert.deepEqual([gone.ok, gone.interest.ended], [true, true]);
  assert.equal((await door("registerinterests", { project: w.P })).history.length, 2);
});

test("R23: an import paused at the warning mark and resumed by its member between 70% and 90% runs to its end; past 90% the resume is refused", async () => {
  const total = 10 * 1024 ** 3;
  let free = total * 0.2;
  const w = seeded({ freeBytes: () => free });
  START(w);
  await w.drain({ [URL_]: served(enc(csv(30))) }, { max: 6 });
  assert.equal(w.sql(`SELECT paused_reason FROM register_imports`)[0].paused_reason, "shelf");
  assert.equal(w.registers.importSet({ import: 1, action: "resume", author: V("alice"), viewer: V("alice") }).ok, true);
  await w.drain({ [URL_]: served(enc(csv(30))) });
  assert.equal(w.sql(`SELECT state FROM register_imports`)[0].state, "indexed");
  free = total * 0.05;
  START(w, { filter: { filer_ids: ["F10001"] } });
  await w.drain({ [URL_]: served(enc(csv(30))) }, { max: 6 });
  assert.equal(w.registers.importSet({ import: 2, action: "resume", author: V("alice"), viewer: V("alice") }).reason, "SHELF_NEARLY_FULL");
});

test("R11, R23: a file larger than one act reads is refused before anything is written, and so is one the shelf cannot take; control: a small file lands", async () => {
  let free = null;
  const w = seeded({ bounds: { SLICE_MEMORY_MB: 0.01 }, freeBytes: () => free });
  const file = enc(csv(400));
  const big = await w.registers.importStart({ register: "town_filings", filter: {}, scope: "project", project: w.P, author: V("bob"), viewer: V("bob"), file, holes: { table: "2025" } });
  assert.deepEqual([big.ok, big.reason], [false, "FILE_TOO_LARGE"]);
  free = 10 * 1024 ** 3 * 0.05;
  const full = await w.registers.importStart({ register: "town_filings", filter: {}, scope: "project", project: w.P, author: V("bob"), viewer: V("bob"), file: enc(csv(3)), holes: { table: "2025" } });
  assert.deepEqual([full.ok, full.reason], [false, "SHELF_NEARLY_FULL"]);
  assert.deepEqual([w.count("register_imports"), w.count("register_segments")], [0, 0]);
  free = null;
  assert.equal((await w.registers.importStart({ register: "town_filings", filter: {}, scope: "project", project: w.P, author: V("bob"), viewer: V("bob"), file: enc(csv(3)), holes: { table: "2025" } })).ok, true);
});

test("R22: a removal reaches the cells and the index only through the port: with the in-memory rowStore the row is removed, its tombstone recorded, and search no longer finds it", async () => {
  const { memoryRowStore } = await import("../../../src/registers/index.mjs");
  const { DEF } = await import("./fixture.mjs");
  let w;
  const port = memoryRowStore({ termsOf: () => DEF("town_filings"), members: (imp, key, hash) => w.sql(`SELECT 1 AS x FROM register_import_rows WHERE import_id=? AND row_key=? AND content_hash=?`, imp, key, hash).length > 0 });
  w = seeded({ port });
  START(w);
  await w.drain({ [URL_]: served(enc(csv(12, { cell: (i) => rowOf(i, i === 5 ? { donor_name: "Quillon Removed" } : {}) }))) });
  assert.equal(w.count("register_cells"), 0, "the SQL cells are not this port's");
  assert.equal(w.registers.searchRows({ scope: { register: "town_filings" }, name: "Quillon", viewer: V("bob") }).rows.length, 1);
  const key = w.sql(`SELECT row_key FROM register_import_rows WHERE src_row=6`)[0].row_key;
  const out = await w.registers.rowExpunge({ register: "town_filings", row_key: key, ground: "unlawful", reason: "a minor's name", author: V("alice") });
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(w.registers.searchRows({ scope: { register: "town_filings" }, name: "Quillon", viewer: V("bob") }).rows.length, 0);
  assert.equal(port.versionsOf({ scopes: ["team"], register: "town_filings", row_key: key }).length, 0);
  assert.equal(w.record.tombstones({ table: "register_import_rows" }).tombstones.length, 1);
});

test("R23: a name or organization criterion is read from the token index, not by scanning the rows; the token index is declared rebuildable and rebuilds the same", async () => {
  const w = seeded();
  START(w);
  await w.drain({ [URL_]: served(enc(csv(40))) });
  const plan = w.sql(`EXPLAIN QUERY PLAN SELECT r.row_key FROM register_rows r WHERE r.register=? AND (r.scope_key, r.register, r.row_key, r.content_hash) IN (SELECT scope_key, register, row_key, content_hash FROM register_tokens WHERE kind='n' AND token=?)`, "town_filings", "donor").map((r) => r.detail).join(" | ");
  assert.match(plan, /register_tokens USING (COVERING )?INDEX|SEARCH register_tokens/);
  assert.doesNotMatch(plan, /SCAN r\b|SCAN register_rows/);
  assert.deepEqual(w.record.rebuildAndCompare("registers", "register_tokens"), { same: true });
  assert.deepEqual(w.registers.searchRows({ scope: { register: "town_filings" }, name: "Donor 14", viewer: V("bob") }).rows.map((r) => r.cells.donor_name), ["Donor 14"]);
});
