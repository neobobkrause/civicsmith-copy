/* registers R24–R29, R73 (T53; N1259; K4403 (2)–(4); K1484, K1492 (6); 11 CFR 104.15): search of held rows only, absence that says where it looked,
   no query ever logged, the data-use limit carried and enforced, a row read and cited as a labelled extract, two imports compared, content's
   row context answered. At the module's interface over the test profile's registers. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { seeded, world, V, MACHINE, served, csv, csvRows, rowOf, enc, URL_, DEF, network, sourceKeyed, sha } from "./fixture.mjs";
import { makeZip } from "../../make-zip.mjs";
import { contentIdFor } from "../../../src/content/extent.mjs";
import { REGISTERS_OPS } from "../../../src/registers/index.mjs";

const START = (w, over = {}) => w.registers.importStart({ register: "town_filings", filter: {}, scope: "team", author: V("alice"), viewer: V("alice"), holes: { table: "2025" }, ...over });
const SEARCH = (w, over = {}) => w.registers.searchRows({ scope: { register: "town_filings" }, viewer: V("bob"), ...over });
const all = (w) => Object.fromEntries(w.sql(`SELECT name FROM sqlite_master WHERE type='table'`).map((r) => [r.name, JSON.stringify(w.sql(`SELECT * FROM ${r.name}`))]));
async function imports(w, n, mk) {
  for (let i = 0; i < n; i++) { START(w, { filter: { filer_ids: [`F1000${i}`] } }); await w.drain({ [URL_]: served(enc(mk(i))) }); w.clock.ms += 3_600_000; }
}

test("R24: five imports are searched by name (either order), amount, date and filer id, each alone and together; every answer names the imports searched with their dates; nothing is fetched", async () => {
  const w = seeded();
  await imports(w, 5, () => csv(105));
  assert.equal(w.count("register_imports"), 5);
  const net = network({});
  let r;
  try {
    r = {
      name: SEARCH(w, { name: "Donor 14" }), swapped: SEARCH(w, { name: "14 Donor" }), amount: SEARCH(w, { amount: { min: "110", max: "112" } }),
      date: SEARCH(w, { date: { from: "2025-03-01", to: "2025-03-31" } }), filer: SEARCH(w, { filer_id: "F10003", limit: 200 }),
      together: SEARCH(w, { filer_id: "F10003", date: { from: "2025-04-01", to: "2025-04-30" }, amount: { min: "100", max: "200" } }),
      org: SEARCH(w, { organization: "Firm 15" }), form: SEARCH(w, { form: "460-8" }),
    };
  } finally { net.restore(); }
  assert.equal(net.seen.length, 0, "no request");
  assert.deepEqual(r.name.rows.map((x) => x.cells.donor_name), ["Donor 14"]);
  assert.deepEqual(r.swapped.rows.map((x) => x.row_key), r.name.rows.map((x) => x.row_key));
  assert.deepEqual(r.amount.rows.map((x) => x.cells.paid).sort(), ["110.00", "111.00"], "112 is a filer no import was asked for");
  assert.ok(r.date.rows.length > 0 && r.date.rows.every((x) => x.cells.received.startsWith("03/")));
  assert.ok(r.filer.rows.length === 15 && r.filer.rows.every((x) => x.cells.filer === "F10003"));
  assert.ok(r.together.rows.length > 0 && r.together.rows.every((x) => x.cells.filer === "F10003" && x.cells.received.startsWith("04/")));
  assert.deepEqual(r.org.rows.map((x) => x.cells.donor_org), ["Firm 15"]);
  assert.deepEqual(r.form.rows.map((x) => x.cells.form_no), ["460-8"]);
  for (const x of Object.values(r)) {
    assert.equal(x.imports.length, 5, "the imports searched, each with its dates");
    assert.ok(x.imports.every((i) => i.imported_at && i.source_date));
    assert.equal(x.ok, true);
    assert.equal(typeof x.matched, "number");
  }
  const row = r.name.rows[0];
  assert.deepEqual(Object.keys(row).sort(), ["cells", "cited", "import", "imported_at", "label_key", "register", "row_key", "source_date", "src_row", "version"]);
  assert.equal(row.version, 1);
  assert.equal(row.cited, false);
});

test("R24: limit and budget are bounded and refused before anything is read; a page marker is opaque; paging 130 rows by 50 equals the unpaged 130; the order is date descending, undetermined last, then key", async () => {
  const w = seeded();
  START(w);
  await w.drain({ [URL_]: served(enc(csv(130, { cell: (i) => rowOf(i, i % 10 === 0 ? { received: "garbled" } : {}) }))) });
  const before = all(w);
  assert.equal(SEARCH(w, { limit: 0 }).reason, "SEARCH_BAD_LIMIT");
  assert.equal(SEARCH(w, { limit: 201 }).reason, "SEARCH_BAD_LIMIT");
  assert.equal(SEARCH(w, { budget_ms: 10_001 }).reason, "SEARCH_BAD_BUDGET");
  assert.equal(SEARCH(w, { budget_ms: 10_000, limit: 5 }).ok, true);
  assert.equal(SEARCH(w, { after: "not-a-marker" }).reason, "BAD_CURSOR");
  assert.equal(SEARCH(w, { scope: { register: "nope" } }).reason, "NO_SUCH_REGISTER");
  assert.equal(SEARCH(w, { filer_id: "bogus" }).reason, "FILTER_VALUE_INVALID");
  assert.equal(SEARCH(w, { name: "Ann*" }).reason, "FILTER_PATTERN_REFUSED");
  assert.deepEqual(all(w), before, "each refusal and each search wrote nothing");
  const whole = SEARCH(w, { limit: 200 });
  assert.equal(whole.rows.length, 130);
  assert.equal(whole.matched, 130);
  assert.equal(whole.capped, false);
  const paged = [];
  let after;
  for (let i = 0; i < 5; i++) {
    const p = SEARCH(w, { limit: 50, ...(after ? { after } : {}) });
    paged.push(...p.rows);
    if (!p.next) break;
    after = p.next;
  }
  assert.equal(paged.length, 130);
  assert.deepEqual(paged.map((x) => x.row_key), whole.rows.map((x) => x.row_key));
  /* the order: dates descending, the undetermined ones last, then by key; a row whose date is undetermined is listed last, not coerced */
  const iso = (c) => { const m = /^(\d\d)\/(\d\d)\/(\d{4})$/.exec(c.received); return m ? `${m[3]}-${m[1]}-${m[2]}` : null; };
  const dates = whole.rows.map((x) => iso(x.cells));
  const firstNull = dates.indexOf(null);
  assert.ok(firstNull > 0 && dates.slice(firstNull).every((d) => d === null) && dates.slice(0, firstNull).every((d, i, a) => i === 0 || a[i - 1] >= d));
  assert.equal(dates.filter((d) => d === null).length, 13);
});

test("R25: a search that finds nothing says where it looked, with the dates, never 'does not exist'; with no import held it says so; a search stopped by its budget returns rows, says stopped, and carries no absence", async () => {
  const w = seeded();
  assert.deepEqual([SEARCH(w, { name: "Nobody Here" }).no_import_held, SEARCH(w, { name: "Nobody Here" }).imports], [true, []]);
  START(w);
  await w.drain({ [URL_]: served(enc(csv(40))) });
  const none = SEARCH(w, { name: "Nobody Here" });
  assert.deepEqual([none.rows, none.absence.level, none.absence.text_key], [[], "import", "register.absence.import"]);
  assert.equal(none.absence.imports.length, 1);
  assert.deepEqual(Object.keys(none.absence.imports[0]).sort(), ["imported_at", "import", "source_date"].sort());
  assert.equal(none.absence.imports[0].source_date, "2025-10-01");
  assert.ok(!JSON.stringify(none).toLowerCase().includes("does not exist"));
  /* a fixture slowed past the budget */
  const port = w.registers.port;
  w.registers.port = { ...port, scan: function* (q) { for (const r of port.scan(q)) { w.clock.ms += 600; yield r; } } };
  const slow = SEARCH(w, { filer_id: "F10003", budget_ms: 1000, limit: 50 });
  assert.equal(slow.stopped.reason, "time");
  assert.equal(slow.more_may_exist, true);
  assert.equal(slow.absence, undefined, "a stopped search never says nothing was found");
  assert.ok(slow.rows.length >= 1 && slow.rows.length < 6);
  /* control: a complete search with matches carries no absence */
  w.registers.port = port;
  const full = SEARCH(w, { filer_id: "F10003" });
  assert.equal(full.absence, undefined);
  assert.ok(full.rows.length > 0 && full.stopped === undefined);
});

test("R26 (G5 (6), R62, R65): searches are not logged: after a battery by name, amount and date no table holds a query string or the member's id against it; nothing is written, fetched, resolved or linked; control: the scan finds the sentinel in the search's own response", async () => {
  const w = seeded();
  START(w);
  await w.drain({ [URL_]: served(enc(csv(40, { cell: (i) => rowOf(i, i === 3 ? { donor_name: "Quillon Zappa" } : {}) }))) });
  const before = all(w), counts0 = Object.fromEntries(Object.keys(before).map((t) => [t, w.count(t)]));
  const net = network({});
  let sentinel;
  try {
    for (const q of [{ name: "ZZQUERYSENTINEL Quillon" }, { name: "Quillon Zappa" }, { amount: { min: "123456.78", max: "123456.79" } }, { date: { from: "2031-11-11", to: "2031-11-12" } }, { filer_id: "F99999" }, { organization: "Zzqueryorg Holdings" }])
      SEARCH(w, q);
    sentinel = SEARCH(w, { name: "Quillon Zappa" });
  } finally { net.restore(); }
  assert.equal(net.seen.length, 0, "no request (R62)");
  assert.deepEqual(all(w), before, "no table, observation row, tally or log changed");
  for (const t of Object.keys(counts0)) assert.equal(w.count(t), counts0[t], `${t} unchanged`);
  const dump = JSON.stringify(Object.values(all(w)));
  for (const needle of ["ZZQUERYSENTINEL", "123456.78", "2031-11-11", "F99999", "Zzqueryorg"]) assert.ok(!dump.includes(needle), `${needle} is nowhere`);
  assert.ok(JSON.stringify(sentinel).includes("Quillon Zappa"), "control: the sentinel is in the response itself");
  /* nothing in an answer resolves, scores or flags */
  assert.ok(!/"(score|rank|suspect|flag|risk)"/.test(JSON.stringify(sentinel)));
});

/* ------------------------------------------------------------------------------------------ the data-use limit */

const FED = DEF("federal_individual");
const fedRows = (n) => ["CMTE_ID|NAME|AMT|DT|CITY|ZIP", ...Array.from({ length: n }, (_, i) => `F${10000 + (i % 3)}|Giver ${i}|${10 + i}.00|2025-0${1 + (i % 9)}-15|Port Ellery|04101`)].join("\n").split("\n").slice(1).join("\n") + "\n";
async function federal(w, n, { scope = "team" } = {}) {
  const zip = makeZip([{ name: "itcont.txt", data: fedRows(n) }]);
  const routes = { "https://bulk.federal.example/headers/indiv_header.csv": served(enc("CMTE_ID,NAME,AMT,DT,CITY,ZIP\n"), { type: "text/csv" }), "https://store.federal.example/indiv2026.zip": served(zip, { type: "application/zip" }) };
  const r = w.registers.importStart({ register: "federal_individual", filter: {}, scope, author: V("alice"), viewer: V("alice"), holes: { cycle: "2026" } });
  assert.equal(r.ok, true, JSON.stringify(r));
  await w.drain(routes, { max: 500 });
  assert.equal(w.registers.importStatus({ import: r.import, viewer: V("alice") }).state, "indexed");
  return r.import;
}

test("R27 (G6, R66): rows of a register with a use limit carry it, a search needs a criterion and pages to at most 1,000 rows, and no op lists rows out or sends them", async () => {
  const w = seeded();
  const imp = await federal(w, 1200);
  const lim = { key: "federal_contributor_use", citation: "Test Reg. § 9.15; Test Stat. § 301(a)(4)", text_key: "jurisdictions.use_limit.test_contributor_names" };
  assert.equal(w.registers.searchRows({ scope: { register: "federal_individual" }, viewer: V("bob") }).reason, "NO_CRITERIA");
  assert.equal(w.registers.searchRows({ scope: {}, viewer: V("bob") }).reason, "NO_CRITERIA", "all registers includes a limited one");
  const q = { scope: { register: "federal_individual" }, amount: { min: "0" }, viewer: V("bob") };
  const first = w.registers.searchRows({ ...q, limit: 200 });
  assert.equal(first.ok, true);
  assert.ok(first.rows.every((r) => JSON.stringify(r.use_limit) === JSON.stringify(lim)), "every row carries the limit");
  let n = first.rows.length, next = first.next, pages = 1, last;
  while (next && pages < 8) { last = w.registers.searchRows({ ...q, limit: 200, after: next }); if (!last.ok) break; n += last.rows.length; next = last.next; pages++; }
  assert.equal(n, 1000, "at most 1,000 rows");
  assert.deepEqual([last.ok, last.reason], [false, "RESULT_CAP"], "the 1,001st row");
  const row = w.registers.rowOf({ import: imp, src_row: 1, viewer: V("bob") });
  assert.deepEqual(row.use_limit, lim);
  /* the ops map holds no op that exports, sends or fetches by name */
  const ops = [...REGISTERS_OPS];
  assert.ok(!ops.some((o) => /export|send|download|mail|solicit|byname|lookupname/i.test(o)), ops.join());
  /* control: a limit-free register pages without the cap and carries no limit key */
  START(w, { holes: { table: "2025" } });
  await w.drain({ [URL_]: served(enc(csv(1100))) });
  const free = w.registers.searchRows({ scope: { register: "town_filings" }, viewer: V("bob"), limit: 200 });
  assert.equal(free.ok, true);
  assert.ok(free.rows.every((r) => !("use_limit" in r)));
  assert.equal(free.matched, 1100);
});

/* ------------------------------------------------------------------------------------------ rows and extracts */

test("R28: rowOf answers a row's kept cells, its place, fingerprints and the other imports' versions; an absent or hidden row is one answer; citeRow mints a content row over the row's extent, the extract's fingerprints equal the segment's hop, citing again answers existed, a machine is refused", async () => {
  const w = seeded();
  START(w);
  await w.drain({ [URL_]: served(enc(csv(10))) });
  const key = w.sql(`SELECT row_key FROM register_import_rows WHERE src_row=4`)[0].row_key;
  const read = w.registers.rowOf({ import: 1, row_key: key, viewer: V("bob") });
  assert.equal(read.ok, true);
  assert.equal(read.cells.donor_name, "Donor 3");
  assert.deepEqual([read.src_row, read.segment.n, read.segment.piece], [4, 0, "all"]);
  assert.deepEqual(read.dropped_columns.sort(), ["donor_street", "donor_tel"]);
  assert.match(read.original.sha256, /^[0-9a-f]{64}$/);
  assert.equal(read.content_id, null);
  assert.ok(!JSON.stringify(read).includes("SENTINEL"));
  assert.deepEqual([w.registers.rowOf({ import: 1, row_key: "nope", viewer: V("bob") }).reason, w.registers.rowOf({ import: 99, row_key: key, viewer: V("bob") }).reason], ["NO_SUCH_REGISTER_ROW", "NO_SUCH_REGISTER_ROW"]);
  const H = w.project("Secret", "bob", [], { hidden: true });
  w.registers.importStart({ register: "county_raw", filter: {}, scope: "project", project: H, author: V("bob"), viewer: V("bob"), pieces: ["receipts"] });
  const cite = w.registers.citeRow({ import: 1, row_key: key, author: V("bob"), viewer: V("bob") });
  assert.equal(cite.ok, true, JSON.stringify(cite));
  assert.equal(cite.existed, false);
  const seg = w.sql(`SELECT * FROM register_segments WHERE import_id=1`)[0];
  const ex = cite.extract;
  assert.deepEqual([ex.register, ex.reduced_sha256, ex.original_sha256, ex.original_covers, ex.src_row, ex.label_key], ["town_filings", seg.sha256, seg.original_sha256, "whole_file", 4, "register.extract"]);
  assert.equal(ex.source_date, "2025-10-01");
  assert.deepEqual(ex.dropped_columns.sort(), ["donor_street", "donor_tel"]);
  assert.ok(ex.kept_columns.includes("src_row") && !ex.kept_columns.includes("donor_street"));
  /* the content id recomputes by contentIdFor over the capture and the row's extent */
  const extent = { kind: "sheet-range", sheet: ex.file, range: `A5:${String.fromCharCode(64 + ex.kept_columns.length)}5` };
  const ctx = w.content.contentContextFor(seg.sha256, { searched: false });
  assert.equal(cite.content_id, contentIdFor(seg.sha256, extent, ctx.chain));
  assert.equal(w.registers.rowOf({ import: 1, row_key: key, viewer: V("bob") }).content_id, cite.content_id);
  const again = w.registers.citeRow({ import: 1, row_key: key, author: V("carol"), viewer: V("carol") });
  assert.deepEqual([again.ok, again.existed, again.content_id], [true, true, cite.content_id]);
  assert.equal(w.registers.citeRow({ import: 1, row_key: key, author: MACHINE, viewer: MACHINE }).reason, "MACHINE_CANNOT_CITE_ROW");
  assert.equal(SEARCH(w, { form: "460-3" }).rows[0].cited, true);
  /* control: citing another row mints a different content id */
  const key2 = w.sql(`SELECT row_key FROM register_import_rows WHERE src_row=5`)[0].row_key;
  assert.notEqual(w.registers.citeRow({ import: 1, row_key: key2, author: V("bob"), viewer: V("bob") }).content_id, cite.content_id);
});

test("R28: a team's hidden row is NO_SUCH_REGISTER_ROW for a non-participant, the same answer as an absent one", async () => {
  const w = seeded();
  const H = w.project("Secret", "bob", [], { hidden: true });
  w.registers.importStart({ register: "town_filings", filter: {}, scope: "project", project: H, author: V("bob"), viewer: V("bob"), holes: { table: "2025" } });
  await w.drain({ [URL_]: served(enc(csv(6))) });
  const key = w.sql(`SELECT row_key FROM register_import_rows WHERE src_row=2`)[0].row_key;
  assert.equal(w.registers.rowOf({ import: 1, row_key: key, viewer: V("bob") }).ok, true);
  const a = w.registers.rowOf({ import: 1, row_key: key, viewer: V("dave") }), b = w.registers.rowOf({ import: 77, row_key: key, viewer: V("dave") });
  assert.deepEqual([a.reason, a.detail], [b.reason, b.detail]);
  assert.equal(w.registers.citeRow({ import: 1, row_key: key, author: V("dave"), viewer: V("dave") }).reason, "NO_SUCH_REGISTER_ROW");
});

/* ------------------------------------------------------------------------------------------ compare */

test("R29: an added, a removed and a changed row are each reported; a different filter makes removals possibly_removed; two equal imports answer all counts 0; no answer holds a finding, score or suspect", async () => {
  const w = seeded({ view: sourceKeyed() });
  START(w);
  await w.drain({ [URL_]: served(enc(csv(30))) });
  w.clock.ms += 3_600_000;
  START(w);
  const second = Array.from({ length: 31 }, (_, i) => rowOf(i, i === 7 ? { note: "changed" } : {})).filter((_, i) => i !== 4);
  await w.drain({ [URL_]: served(enc(csvRows(second))) });
  const c = w.registers.compare({ import_a: 1, import_b: 2, viewer: V("bob") });
  assert.equal(c.ok, true);
  assert.deepEqual(c.counts, { added: 1, changed: 1, removed: 1, possibly_removed: 0 });
  const kinds = Object.fromEntries(c.rows.map((r) => [r.kind, r]));
  assert.deepEqual(kinds.changed.changes, [{ key: kinds.changed.key, field: "note", before: "note 7", after: "changed" }]);
  assert.equal(kinds.added.cells.donor_name, "Donor 30");
  assert.equal(kinds.removed.cells.donor_name, "Donor 4");
  assert.ok(!/"(finding|score|suspect)"/.test(JSON.stringify(c)));
  assert.equal(w.registers.compare({ import_a: 1, import_b: 1, viewer: V("bob") }).counts.added, 0);
  assert.deepEqual(w.registers.compare({ import_a: 2, import_b: 2, viewer: V("bob") }).counts, { added: 0, changed: 0, removed: 0, possibly_removed: 0 }, "two equal imports");
  /* a different filter: removals cannot be stated */
  w.clock.ms += 3_600_000;
  START(w, { filter: { filer_ids: ["F10001"] } });
  await w.drain({ [URL_]: served(enc(csv(31))) });
  const f = w.registers.compare({ import_a: 2, import_b: 3, viewer: V("bob") });
  assert.equal(f.counts.removed, 0);
  assert.ok(f.counts.possibly_removed > 0);
  assert.ok(f.rows.every((r) => r.kind !== "removed"));
  /* refusals */
  START(w, { register: "county_raw", filter: {}, holes: undefined, pieces: ["receipts"] });
  assert.equal(w.registers.compare({ import_a: 1, import_b: 4, viewer: V("bob") }).reason, "COMPARE_REFUSED");
  assert.equal(w.registers.compare({ import_a: 1, import_b: 99, viewer: V("bob") }).reason, "NO_SUCH_REGISTER_IMPORT");
});

test("R29: a content-keyed register reports a change as one removed and one added row, never changed; pages are bounded and the counts exact", async () => {
  const w = seeded();
  START(w);
  await w.drain({ [URL_]: served(enc(csv(30))) });
  w.clock.ms += 3_600_000;
  START(w);
  await w.drain({ [URL_]: served(enc(csv(30, { cell: (i) => rowOf(i, i === 7 ? { note: "changed" } : {}) }))) });
  const c = w.registers.compare({ import_a: 1, import_b: 2, viewer: V("bob") });
  assert.deepEqual(c.counts, { added: 1, changed: 0, removed: 1, possibly_removed: 0 });
  assert.deepEqual(c.rows.map((r) => r.kind).sort(), ["added", "removed"]);
  assert.equal(w.registers.compare({ import_a: 1, import_b: 2, viewer: V("bob"), limit: 201 }).reason, "SEARCH_BAD_LIMIT");
  const one = w.registers.compare({ import_a: 1, import_b: 2, viewer: V("bob"), limit: 1 });
  assert.equal(one.rows.length, 1);
  assert.ok(one.next);
  const two = w.registers.compare({ import_a: 1, import_b: 2, viewer: V("bob"), limit: 1, after: one.next });
  assert.equal(two.rows.length, 1);
  assert.notEqual(two.rows[0].key, one.rows[0].key);
  assert.deepEqual(two.counts, c.counts);
});

/* ------------------------------------------------------------------------------------------ R73: content's row context */

test("R73: registers answers content's row context for the captures it holds: holds, rowAt with the kept cells and the reduction block, null past the end; a capture of no import is not held", async () => {
  const w = seeded();
  START(w);
  await w.drain({ [URL_]: served(enc(csv(5))) });
  const seg = w.sql(`SELECT * FROM register_segments`)[0];
  const p = w.content.rowContext;
  assert.ok(p, "registered once at start with content.registerRowContext");
  assert.equal(p.holds(seg.sha256), true);
  assert.equal(p.holds(sha("another")), false, "a capture of no import");
  const header = p.rowAt(seg.sha256, 1);
  assert.deepEqual(Object.keys(header.cells), ["src_row", "filer", "donor_name", "donor_org", "paid", "received", "form_no", "donor_city", "donor_state", "donor_zip", "note"]);
  const row3 = p.rowAt(seg.sha256, 3);
  assert.equal(row3.cells.donor_name, "Donor 1");
  assert.equal(row3.cells.src_row, "2");
  assert.deepEqual(row3.reduced, { segment_sha: seg.sha256, original_sha256: seg.original_sha256, original_covers: "whole_file", dropped_columns: ["donor_street", "donor_tel"], src_row: 2, import: 1 });
  assert.equal(p.rowAt(seg.sha256, 7), null, "past the segment's rows");
  assert.equal(p.rowAt(sha("another"), 2), null);
  /* a content row minted over it carries the same block */
  const key = w.sql(`SELECT row_key FROM register_import_rows WHERE src_row=2`)[0].row_key;
  const cite = w.registers.citeRow({ import: 1, row_key: key, author: V("bob"), viewer: V("bob") });
  assert.equal(cite.ok, true);
  const stored = JSON.parse(w.sql(`SELECT register FROM content WHERE content_id=?`, cite.content_id)[0].register);
  assert.deepEqual(stored, row3.reduced);
});
