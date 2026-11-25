/* corpus-export — every declared table, by class, paged (R7, R8, R9), and the import's page checks (R3), over the T33
   owners' world (`rich.mjs`). Driven at the module's interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { rich, ANN, BOSS } from "./rich.mjs";
import { verifyCorpusExport, PAGE_ROWS, PAGE_BYTES, canonical } from "../../../src/corpus-export/index.mjs";

const quote = (n) => `"${n}"`;
/* Every row of a table in its key order (its primary key columns, else rowid), as the store holds it. */
function heldRows(w, table) {
  const cols = w.rows(`PRAGMA table_info(${quote(table)})`);
  const pk = cols.filter((c) => Number(c.pk) > 0).sort((a, b) => a.pk - b.pk).map((c) => quote(c.name));
  return w.rows(`SELECT * FROM ${quote(table)} ORDER BY ${pk.length ? pk.join(", ") : "rowid"}`);
}
/* Every row the manifest's pages of one table carry, each page fetched alone. */
function carriedRows(w, entry) {
  const out = [];
  for (const p of entry.pages) {
    const g = w.ce.exportPage({ table: entry.table, index: p.index, after: p.after });
    assert.equal(g.ok, true, `${entry.table} page ${p.index}`);
    assert.equal(g.sha256, p.sha256, `${entry.table} page ${p.index}: fetched alone, the same bytes`);
    out.push(...g.rows);
  }
  return out;
}
const declare = (w, module, entries) => {
  const r = w.record.declareTable(module, entries);
  assert.deepEqual(r, { ok: true });
};
const cls = { purge: "clear", expunge: "none", sight: "group", derive: "stored", version_chain: false };

function populated() {
  const w = rich();
  const p = w.person("Ada Lane");
  const org = w.entity("institution", "Harbour Board", { sector: "government" });
  const c = w.capture("minutes");
  w.line("holds", p, w.entity("office", "Harbour Master"), { from: "2020-01-01" });
  w.eventOn(c, "meeting", [{ entity: p, role: "speaker" }]);
  w.factOn(c, { from: { entity: org, as_written: "Harbour Board" }, to: { entity: p, as_written: "Ada Lane" } });
  const tie = w.p.declareTie({ entity: org, kind: "employer", note: "I worked there", attribution: "name", by: ANN });
  assert.equal(tie.ok, true, JSON.stringify(tie));
  const home = w.p.recordPersonFact({ person: p, kind: "address", value: "12 Elm Row",
    valid: { valid: { from: null, to: null, precision: "day", zone: "UTC" }, basis: "the letter" },
    citation: { captureSha: c.captureSha, extent: { kind: "pdf-page", page: 0 } }, by: ANN });
  assert.equal(home.ok, true, JSON.stringify(home));
  return { w, p, org, c };
}

test("R7 the export carries every declared table under its owner with its classes: yes with its rows, admin-only marked, never named with no row, derived-rebuildable as its rule", () => {
  const { w } = populated();
  const declared = w.record.declaredTables();
  const x = w.ce.exportManifest({});
  assert.deepEqual(x.tables.map((t) => [t.owner, t.table]), declared.map((d) => [d.module, d.name]), "every declaration, in its order");
  let seen = { yes: 0, admin: 0, never: 0, rule: 0 };
  for (const [i, d] of declared.entries()) {
    const t = x.tables[i];
    assert.deepEqual(t.classes, { purge: d.purge, expunge: d.expunge, export: d.export, sight: d.sight, derive: d.derive,
                                  version_chain: d.version_chain }, d.name);
    if (d.export === "never") {
      assert.deepEqual([t.carried, t.rows, t.pages], ["named", null, []], `${d.name}: named, no row`);
      seen.never++;
    } else if (d.derive === "derived-rebuildable") {
      assert.deepEqual([t.carried, t.rows, t.pages], ["rule", null, []], `${d.name}: its rule, no row`);
      assert.equal(t.rule.owner, d.module);
      assert.deepEqual(t.rule.key, d.key);
      assert.deepEqual(t.rule.from, d.from, `${d.name}: its from exactly as declaredTables answers it`);
      seen.rule++;
    } else {
      assert.equal(t.carried, "rows", d.name);
      assert.equal(t.admin_only === true, d.export === "admin-only", `${d.name}: admin-only marked exactly when so declared`);
      const held = t.held ? heldRows(w, d.name) : [];
      /* export_log gains this export's own row after it is read */
      assert.equal(t.rows, held.length - (d.name === "export_log" ? 1 : 0), `${d.name}: every row`);
      const carried = carriedRows(w, t).map(canonical);
      const want = held.map(canonical);
      /* export_log gains this export's own row after it is read; every other table is carried whole */
      if (d.name === "export_log") assert.deepEqual(carried, want.slice(0, carried.length));
      else assert.deepEqual(carried, want, `${d.name}: the rows, whole, in key order`);
      seen[d.export === "yes" ? "yes" : "admin"]++;
    }
  }
  assert.ok(seen.yes && seen.admin && seen.never && seen.rule, JSON.stringify(seen));
  /* members' ties are never carried (K1490): people declares them `never` (N594, K1791), so the tie is held here and
     named with its owner and class, and no part of it travels, nor can its page be fetched */
  assert.equal(declared.find((d) => d.name === "member_ties").export, "never", "people's declaration (N594)");
  assert.equal(w.rows(`SELECT * FROM member_ties`).length, 1);
  assert.deepEqual((({ owner, table, carried, rows }) => ({ owner, table, carried, rows }))(x.tables.find((t) => t.table === "member_ties")),
                   { owner: "people", table: "member_ties", carried: "named", rows: null });
  assert.equal(JSON.stringify(x).includes("I worked there"), false);
  assert.equal(w.ce.exportPage({ table: "member_ties", index: 0 }).reason, "EXPORT_TABLE_NOT_CARRIED");
  /* a never table holding a row here (a person's address) carries none of it */
  const never = x.tables.filter((t) => t.classes.export === "never").map((t) => t.table);
  assert.ok(never.includes("source_person_links") && never.includes("person_contacts") && never.includes("leases"));
  assert.equal(w.rows(`SELECT * FROM person_contacts`).length, 1);
  assert.equal(JSON.stringify(x).includes("12 Elm Row"), false);
  for (const [, b] of w.pagesFor(x)) for (const v of ["12 Elm Row", "I worked there"]) assert.equal(new TextDecoder().decode(b).includes(v), false, v);
  /* the entities tables are exported (B0.13) */
  assert.ok(x.tables.find((t) => t.table === "entities" && t.carried === "rows" && t.rows > 0));
  assert.ok(x.tables.find((t) => t.table === "event_when_cache" && t.carried === "rule"));
});

test("R7 a derived-rebuildable table travels as its rule naming its from exactly as declaredTables answers it: a list as given, null when not stated", () => {
  const w = rich();
  for (const t of ["probe_src_a", "probe_src_b", "probe_cache_from", "probe_cache_bare"])
    w.st.sql.exec(`CREATE TABLE ${t} (k TEXT PRIMARY KEY, v TEXT)`);
  w.st.sql.exec(`INSERT INTO probe_cache_from VALUES ('a', 'derived one')`);
  w.st.sql.exec(`INSERT INTO probe_cache_bare VALUES ('b', 'derived two')`);
  const rule = { ...cls, export: "yes", derive: "derived-rebuildable", key: ["k"], rebuild: () => [] };
  declare(w, "probe", [{ name: "probe_src_a", ...cls, export: "yes" }, { name: "probe_src_b", ...cls, export: "yes" },
                       { name: "probe_cache_from", ...rule, from: ["probe_src_b", "probe_src_a"] },
                       { name: "probe_cache_bare", ...rule }]);
  const x = w.ce.exportManifest({});
  const withFrom = x.tables.find((t) => t.table === "probe_cache_from"), bare = x.tables.find((t) => t.table === "probe_cache_bare");
  /* a list given at declaration travels as given, in its order */
  assert.deepEqual([withFrom.carried, withFrom.rows, withFrom.pages], ["rule", null, []]);
  assert.deepEqual(withFrom.rule.from, ["probe_src_b", "probe_src_a"]);
  assert.deepEqual(withFrom.rule.owner, "probe");
  /* none stated: null, said not stated, never an empty list and never filled */
  assert.deepEqual([bare.carried, bare.rows, bare.pages], ["rule", null, []]);
  assert.equal(bare.rule.from, null);
  assert.match(bare.rule.rebuild, /did not state/);
  /* every derived-rebuildable entry in the store, the owners' own among them, follows declaredTables exactly */
  for (const d of w.record.declaredTables().filter((e) => e.derive === "derived-rebuildable"))
    assert.deepEqual(x.tables.find((t) => t.table === d.name).rule.from, d.from ?? null, d.name);
  /* the rule's tables' rows never travel, and their pages cannot be fetched */
  assert.equal(JSON.stringify(x).includes("derived one") || JSON.stringify(x).includes("derived two"), false);
  for (const name of ["probe_cache_from", "probe_cache_bare"])
    assert.equal(w.ce.exportPage({ table: name, index: 0 }).reason, "EXPORT_TABLE_NOT_CARRIED");
  /* a stored table's entry names no rule */
  assert.equal(x.tables.find((t) => t.table === "probe_src_a").rule, undefined);
});

test("R7 a table declared after an export was taken is named by the next export", () => {
  const w = rich();
  const first = w.ce.exportManifest({});
  assert.equal(first.tables.some((t) => t.table === "late_table"), false);
  w.st.sql.exec(`CREATE TABLE late_table (k TEXT PRIMARY KEY, v TEXT)`);
  w.st.sql.exec(`INSERT INTO late_table VALUES ('a', 'one')`);
  declare(w, "probe", [{ name: "late_table", ...cls, export: "yes" }]);
  const next = w.ce.exportManifest({});
  const t = next.tables.find((x) => x.table === "late_table");
  assert.deepEqual([t.owner, t.carried, t.rows], ["probe", "rows", 1]);
  assert.equal(next.counts.tables, first.counts.tables + 1);
});

test("R8 rows travel in pages in key order, each within the stated bound, with index, row count and SHA-256, fetched and resumed alone", () => {
  const w = rich();
  w.st.sql.exec(`CREATE TABLE probe_many (a TEXT, b INTEGER, v TEXT, PRIMARY KEY (a, b))`);
  w.st.sql.exec(`CREATE TABLE probe_wide (v TEXT)`);
  /* 2,345 rows inserted out of key order; 40 rows of 20 KB, a page bound by bytes */
  for (let i = 2344; i >= 0; i--) w.st.sql.exec(`INSERT INTO probe_many VALUES (?, ?, ?)`, `k${i % 7}`, i, `row ${i}`);
  for (let i = 0; i < 40; i++) w.st.sql.exec(`INSERT INTO probe_wide VALUES (?)`, "x".repeat(20000) + i);
  declare(w, "probe", [{ name: "probe_many", ...cls, export: "yes" }, { name: "probe_wide", ...cls, export: "admin-only" }]);
  const x = w.ce.exportManifest({});
  const many = x.tables.find((t) => t.table === "probe_many"), wide = x.tables.find((t) => t.table === "probe_wide");
  assert.deepEqual([PAGE_ROWS, PAGE_BYTES], [1000, 262144]);
  assert.deepEqual(many.page_bound, { rows: PAGE_ROWS, bytes: PAGE_BYTES });
  assert.deepEqual(many.key, ["a", "b"]);
  assert.deepEqual(many.pages.map((p) => [p.index, p.rows]), [[0, 1000], [1, 1000], [2, 345]]);
  assert.deepEqual(wide.key, ["rowid"]);
  assert.ok(wide.pages.length >= 4, "a page bound by bytes");
  for (const t of [many, wide]) {
    for (const p of t.pages) {
      assert.ok(p.rows <= PAGE_ROWS && p.rows > 0);
      assert.match(p.sha256, /^[0-9a-f]{64}$/);
      const g = w.ce.exportPage({ table: t.table, index: p.index, after: JSON.stringify(p.after) });
      assert.deepEqual([g.sha256, g.bytes.length, g.rows.length], [p.sha256, p.bytes, p.rows], "fetched alone, from its after");
      assert.ok(canonical(g.rows).length <= PAGE_BYTES + g.rows.length, "within the byte bound");
      /* resumed: the page's next names the following page's after */
      const following = t.pages[p.index + 1];
      assert.deepEqual(g.next, following ? following.after : null);
    }
    assert.deepEqual(carriedRows(w, t).map(canonical), heldRows(w, t.table).map((r) => {
      const { ...row } = r; return canonical(row);
    }), `${t.table}: the pages, joined, are the table in key order`);
  }
  /* a page is refused by name when its table cannot travel */
  assert.equal(w.ce.exportPage({ table: "leases", index: 0 }).reason, "EXPORT_TABLE_NOT_CARRIED");
  assert.equal(w.ce.exportPage({ table: "event_when_cache", index: 0 }).reason, "EXPORT_TABLE_NOT_CARRIED");
  assert.equal(w.ce.exportPage({ table: "no_such", index: 0 }).reason, "EXPORT_TABLE_UNKNOWN");
  assert.equal(w.ce.exportPage({ table: "probe_many", index: -1 }).reason, "EXPORT_PAGE_MALFORMED");
});

test("R8 the export of a large declared table stays within the plane's CPU and memory bounds (measured: 200,000 rows)", () => {
  const w = rich();
  w.st.sql.exec(`CREATE TABLE probe_large (id INTEGER PRIMARY KEY, a TEXT, b TEXT, n INTEGER)`);
  w.st.db.exec("BEGIN");
  const ins = w.st.db.prepare(`INSERT INTO probe_large VALUES (?, ?, ?, ?)`);
  for (let i = 1; i <= 200000; i++) ins.run(i, `ENT-2026-${String(i).padStart(6, "0")}`, "a value of some length ".repeat(4), i * 7);
  w.st.db.exec("COMMIT");
  declare(w, "probe", [{ name: "probe_large", ...cls, export: "yes" }]);
  global.gc?.();
  const heap0 = process.memoryUsage().heapUsed, cpu0 = process.cpuUsage();
  const x = w.ce.exportManifest({});
  const cpu = process.cpuUsage(cpu0), heap = process.memoryUsage().heapUsed - heap0;
  const t = x.tables.find((e) => e.table === "probe_large");
  assert.equal(t.rows, 200000);
  assert.equal(t.pages.length, Math.ceil(200000 / PAGE_ROWS));
  const ms = (cpu.user + cpu.system) / 1000;
  console.log(`# R8 measured: 200,000 rows, ${t.pages.length} pages, ${Math.round(ms)} ms CPU, heap delta ${Math.round(heap / 1048576)} MB`);
  assert.ok(ms < 30000, `within 30 s CPU (${ms} ms)`);
  assert.ok(heap < 128 * 1048576, `within 128 MB (${heap} bytes)`);
});

test("R9 an expunged row is not carried and its tombstone travels in its place, holding none of the removed content", () => {
  const { w, p, c } = populated();
  const f = w.p.recordPersonFact({ person: p, kind: "birth", value: "1970-05-01",
    valid: { valid: { from: null, to: null, precision: "day", zone: "UTC" }, basis: "the cv" },
    citation: { captureSha: c.captureSha, extent: { kind: "pdf-page", page: 0 } }, by: ANN });
  assert.equal(f.ok, true);
  const before = w.ce.exportManifest({}).tables.find((t) => t.table === "person_facts");
  assert.equal(before.rows, 1);
  assert.deepEqual(before.tombstones, []);
  const gone = w.p.expunge({ id: f.fact_id, ground: "unlawful", reason: "held unlawfully", by: BOSS });
  assert.equal(gone.ok, true, JSON.stringify(gone));
  const x = w.ce.exportManifest({});
  const t = x.tables.find((e) => e.table === "person_facts");
  assert.equal(t.rows, 0, "the removed row is not carried");
  assert.equal(t.tombstones.length, 1);
  assert.deepEqual(Object.keys(t.tombstones[0]).sort(), ["at", "ground", "key", "table"]);
  assert.deepEqual([t.tombstones[0].table, t.tombstones[0].ground], ["person_facts", "unlawful"]);
  assert.equal(JSON.stringify(x).includes("1970-05-01"), false, "none of the removed content, anywhere in the export");
  for (const [sha, bytes] of w.pagesFor(x)) assert.equal(new TextDecoder().decode(bytes).includes("1970-05-01"), false, sha);
  /* every later export carries it */
  assert.deepEqual(w.ce.exportManifest({}).tables.find((e) => e.table === "person_facts").tombstones, t.tombstones);
});

test("R3 every table page is re-derived on import: a changed page, a page missing from the sequence and a declared table neither carried nor named are refused by name", () => {
  const { w } = populated();
  w.st.sql.exec(`CREATE TABLE probe_many (k INTEGER PRIMARY KEY, v TEXT)`);
  for (let i = 0; i < 2500; i++) w.st.sql.exec(`INSERT INTO probe_many VALUES (?, ?)`, i, `v${i}`);
  declare(w, "probe", [{ name: "probe_many", ...cls, export: "yes" }]);
  const x = w.ce.exportManifest({});
  const bytes = new Map([...w.bytesFor(x)]);
  const declared = w.record.declaredTables();
  const ok = verifyCorpusExport({ manifest: x, bytes, declared });
  assert.equal(ok.verified, true, JSON.stringify(ok.failures?.slice(0, 3)));
  assert.equal(ok.counts.pages, x.tables.reduce((n, t) => n + t.pages.length, 0));
  const named = (r) => r.failures.map(({ expected, found, ...at }) => at);
  const t = x.tables.find((e) => e.table === "probe_many");
  /* every page, not a sample: a changed page is refused there */
  for (const p of t.pages) {
    const r = verifyCorpusExport({ manifest: x, declared, bytes: new Map([...bytes, [p.sha256, new TextEncoder().encode("tampered")]]) });
    assert.deepEqual(named(r), [{ reason: "PAGE_HASH_MISMATCH", table: "probe_many", page: p.index }]);
  }
  /* a page dropped from the sequence */
  const m1 = JSON.parse(JSON.stringify(x));
  m1.tables.find((e) => e.table === "probe_many").pages.splice(1, 1);
  assert.deepEqual(named(verifyCorpusExport({ manifest: m1, bytes, declared })).map((f) => f.reason).slice(0, 1), ["PAGE_MISSING"]);
  assert.deepEqual(named(verifyCorpusExport({ manifest: m1, bytes, declared }))[0], { reason: "PAGE_MISSING", table: "probe_many", page: 1 });
  /* a page's stated rows not what its bytes hold, and a page moved to another index */
  const m2 = JSON.parse(JSON.stringify(x));
  m2.tables.find((e) => e.table === "probe_many").pages[2].rows = 7;
  assert.deepEqual(named(verifyCorpusExport({ manifest: m2, bytes, declared })), [{ reason: "PAGE_ROWS_MISMATCH", table: "probe_many", page: 2 }]);
  const m3 = JSON.parse(JSON.stringify(x));
  const ps = m3.tables.find((e) => e.table === "probe_many").pages;
  [ps[0].sha256, ps[1].sha256, ps[0].bytes, ps[1].bytes] = [ps[1].sha256, ps[0].sha256, ps[1].bytes, ps[0].bytes];
  assert.deepEqual(named(verifyCorpusExport({ manifest: m3, bytes, declared })).map((f) => f.reason), ["PAGE_MISPLACED", "PAGE_MISPLACED"]);
  /* a declared table the manifest neither carries nor names */
  const m4 = JSON.parse(JSON.stringify(x));
  m4.tables = m4.tables.filter((e) => e.table !== "person_contacts");
  m4.counts.tables -= 1;
  assert.deepEqual(named(verifyCorpusExport({ manifest: m4, bytes, declared })), [{ reason: "TABLE_NOT_CARRIED", table: "person_contacts" }]);
  /* a never table that carries rows */
  const m5 = JSON.parse(JSON.stringify(x));
  m5.tables.find((e) => e.table === "person_contacts").pages = [t.pages[0]];
  assert.ok(named(verifyCorpusExport({ manifest: m5, bytes, declared })).some((f) => f.reason === "TABLE_NEVER_CARRIED"));
  /* a page's bytes missing */
  const r6 = verifyCorpusExport({ manifest: x, declared, bytes: new Map([...bytes].filter(([k]) => k !== t.pages[0].sha256)) });
  assert.deepEqual(named(r6), [{ reason: "BYTES_MISSING", table: "probe_many", page: 0 }]);
  /* the stated table count is checked */
  const m7 = JSON.parse(JSON.stringify(x));
  m7.counts.tables += 1;
  assert.deepEqual(named(verifyCorpusExport({ manifest: m7, bytes, declared })), [{ reason: "COUNTS_MISMATCH", path: "counts.tables" }]);
});
