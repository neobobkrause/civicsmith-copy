/* registers R30–R34, R46 (T53; N1259; K1493; K4403 (2), (6), (7); K4405 (1), (5); K5498, K5532): a removal that leaves a tombstone and no byte, a
   re-import that never restores it, a project's stated interest, the refresh a watch asks for, the count-only change read, and the two doors of the
   state's company officers. At the module's interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { REGISTERS_SCHEMA } from "../../../src/registers/index.mjs";
import { seeded, world, V, MACHINE, served, csv, csvRows, rowOf, enc, URL_, HOST, DEF, network, sourceKeyed, viewWith } from "./fixture.mjs";

const START = (w, over = {}) => w.registers.importStart({ register: "town_filings", filter: {}, scope: "team", author: V("alice"), viewer: V("alice"), holes: { table: "2025" }, ...over });
const REGISTERS_TABLES = [...REGISTERS_SCHEMA.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1]);
const SENT_NAME = "SENTINEL-REMOVE Quillon";
const withSentinel = (n = 12, at = 5) => csv(n, { cell: (i) => rowOf(i, i === at ? { donor_name: SENT_NAME, note: `${SENT_NAME} note` } : {}) });
const keyOf = (w, src) => w.sql(`SELECT row_key FROM register_import_rows WHERE src_row=? ORDER BY import_id LIMIT 1`, src)[0].row_key;
const bucketText = (w) => [...w.b.held.values()].map((v) => new TextDecoder("utf-8", { fatal: false }).decode(v)).join("\n");
const dumpAll = (w) => w.sql(`SELECT name FROM sqlite_master WHERE type='table'`).map((r) => JSON.stringify(w.sql(`SELECT * FROM ${r.name}`))).join("\n");
const REMOVE = (w, key, over = {}) => w.registers.rowExpunge({ register: "town_filings", row_key: key, ground: "unlawful", reason: "the filer was a minor", author: V("alice"), ...over });

test("R30: a removal needs an administrator and a reason, and one of the grounds; each refusal removes nothing", async () => {
  const w = seeded();
  START(w);
  await w.drain({ [URL_]: served(enc(withSentinel())) });
  const key = keyOf(w, 6);
  const before = dumpAll(w);
  const cases = [
    ["a machine", { author: MACHINE }, "MACHINE_CANNOT_EXPUNGE_ROW"], ["no author", { author: undefined }, "MACHINE_CANNOT_EXPUNGE_ROW"], ["a member who is no administrator", { author: V("bob") }, "NOT_AN_ADMIN"],
    ["no reason", { reason: undefined }, "ROW_EXPUNGE_NO_REASON"], ["a blank reason", { reason: "   " }, "ROW_EXPUNGE_NO_REASON"],
    ["an unlisted ground", { ground: "annoyance" }, "EXPUNGE_GROUND_REFUSED"], ["a court order naming none", { ground: "court_order" }, "EXPUNGE_GROUND_REFUSED"],
    ["a demand of an unlisted kind", { ground: "lawful_demand", demandKind: "gossip" }, "DEMAND_KIND_UNLISTED"], ["no such row", { row_key: "nope" }, "NO_SUCH_REGISTER_ROW"],
  ];
  for (const [what, over, code] of cases) { const r = REMOVE(w, key, over); const out = await r; assert.deepEqual([what, out.ok, out.reason], [what, false, code]); }
  assert.equal(dumpAll(w), before, "each refusal removed nothing and wrote nothing");
  assert.equal(w.registers.rowOf({ import: 1, row_key: key, viewer: V("bob") }).ok, true, "the row stays");
});

test("R30 (G4, R69): a removed row is in no table, object, cache or log; searchRows and rowOf no longer answer it; the tombstone is listed and holds none of the row; a row over it is stale; a re-import does not restore it; any lawful ground the profile lists is accepted", async () => {
  const w = seeded();
  START(w);
  await w.drain({ [URL_]: served(enc(withSentinel())) });
  const key = keyOf(w, 6);
  const oldSha = w.sql(`SELECT sha256 FROM register_segments`)[0].sha256;
  const cite = w.registers.citeRow({ import: 1, row_key: key, author: V("bob"), viewer: V("bob") });
  assert.equal(cite.ok, true);
  assert.ok(dumpAll(w).includes(SENT_NAME) && bucketText(w).includes(SENT_NAME), "control: the scan finds the sentinel before");
  const out = await REMOVE(w, key);
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.deepEqual([out.segments_rewritten, out.objects_purged], [1, 1]);
  assert.ok(!dumpAll(w).includes(SENT_NAME), "in no table");
  assert.ok(!bucketText(w).includes(SENT_NAME), "in no object");
  assert.equal(w.b.held.has(`bio/captures/${oldSha}`), false, "the old segment object is purged");
  assert.equal(w.registers.searchRows({ scope: { register: "town_filings" }, name: "Quillon", viewer: V("bob") }).rows.length, 0);
  assert.equal(w.registers.rowOf({ import: 1, row_key: key, viewer: V("bob") }).reason, "NO_SUCH_REGISTER_ROW");
  assert.equal(w.registers.citeRow({ import: 1, row_key: key, author: V("bob"), viewer: V("bob") }).reason, "ROW_REMOVED");
  const t = w.record.tombstones({ table: "register_import_rows" }).tombstones;
  assert.equal(t.length, 1);
  assert.deepEqual([t[0].ground, t[0].by, t[0].key.register], ["unlawful", "alice", "town_filings"]);
  assert.ok(!JSON.stringify(t).includes(SENT_NAME), "the tombstone holds none of the row");
  const gone = await w.content.cellsAt(cite.content_id);
  assert.equal(gone.cells, null, "a content row over the removed row answers no cells");
  assert.ok(!JSON.stringify(gone).includes(SENT_NAME));
  assert.equal(w.sql(`SELECT COUNT(*) AS n FROM content WHERE content_id=?`, cite.content_id)[0].n, 1, "the content row is never deleted");
  /* control: another row of the same segment is intact and its extent resolves */
  const other = keyOf(w, 7);
  const read = w.registers.rowOf({ import: 1, row_key: other, viewer: V("bob") });
  assert.equal(read.cells.donor_name, "Donor 6");
  const seg = w.sql(`SELECT * FROM register_segments`)[0];
  assert.notEqual(seg.sha256, oldSha, "a new digest");
  assert.equal(seg.rows, 11);
  assert.equal(w.content.rowContext.rowAt(seg.sha256, read.segment.extent.row).cells.donor_name, "Donor 6", "the row stands where its place says");
  assert.equal(w.registers.rowOf({ import: 1, row_key: keyOf(w, 5), viewer: V("bob") }).cells.donor_name, "Donor 4");
  /* R31: a re-import never restores a removed row, and counts it tombstoned */
  w.clock.ms += 3_600_000;
  START(w, { scope: "project", project: w.P, author: V("bob"), viewer: V("bob") });
  await w.drain({ [URL_]: served(enc(withSentinel())) });
  assert.ok(!dumpAll(w).includes(SENT_NAME), "the key stays absent");
  assert.equal(w.sql(`SELECT rows_tombstoned FROM register_imports WHERE import_id=2`)[0].rows_tombstoned, 1);
  assert.equal(w.registers.importStatus({ import: 2, viewer: V("bob") }).counts.tombstoned, 1);
  assert.equal(w.sql(`SELECT COUNT(*) AS n FROM register_cells WHERE scope_key LIKE 'project:%'`)[0].n, 11, "the other keys land in the project's own copy");
});

test("R31 control: the other keys of the re-import land; a lawful demand of a kind the profile lists is accepted as a ground", async () => {
  const w = seeded();
  START(w);
  await w.drain({ [URL_]: served(enc(csv(12))) });
  const out = await REMOVE(w, keyOf(w, 3), { ground: "lawful_demand", demandKind: "officer_privacy" });
  assert.equal(out.ok, true);
  assert.equal((await REMOVE(w, keyOf(w, 4), { ground: "court_order", order: "Case 12-345" })).ok, true);
  assert.deepEqual(w.record.tombstones({ table: "register_import_rows" }).tombstones.map((t) => [t.ground, t.demandKind ?? t.order]), [["lawful_demand", "officer_privacy"], ["court_order", "Case 12-345"]]);
  w.clock.ms += 3_600_000;
  START(w, { scope: "project", project: w.P, author: V("bob"), viewer: V("bob") });
  await w.drain({ [URL_]: served(enc(csv(12))) });
  assert.equal(w.sql(`SELECT rows_tombstoned, rows_out FROM register_imports WHERE import_id=2`)[0].rows_tombstoned, 2);
  assert.equal(w.registers.searchRows({ scope: { import: 2 }, viewer: V("bob"), limit: 200 }).rows.length, 10);
});

/* ------------------------------------------------------------------------------------------ interest */

test("R32: an interest by a filer id with watch true calls the listener once; a name is not watchable and is saved with watch false; a changed filter keeps the earlier version; a hidden project's interest is invisible; planning and a search never create one; forgetting ends the watch and keeps history", () => {
  const w = seeded();
  const heard = [];
  assert.equal(w.registers.onInterest("following", (e) => heard.push(e)).ok, true);
  assert.equal(w.registers.onInterest("following", () => {}).reason, "LISTENER_DECLARED");
  const set = (over) => w.registers.interestSet({ register: "town_filings", project: w.P, filter: { filer_ids: ["F10001"] }, author: V("bob"), viewer: V("bob"), ...over });
  const a = set({ watch: true });
  assert.deepEqual([a.ok, a.watch, a.interest.version, heard.length], [true, true, 1, 1]);
  assert.deepEqual([heard[0].watch, heard[0].interest.filter], [true, { filer_ids: ["F10001"] }]);
  const bad = set({ filter: { names: ["Donor Eleven"] }, watch: true });
  assert.deepEqual([bad.ok, bad.reason], [false, "INTEREST_NOT_WATCHABLE"]);
  assert.equal(heard.length, 1, "nothing was written or told");
  const named = w.registers.interestSet({ register: "town_filings", project: "PLACEHOLDER", filter: {}, author: V("bob"), viewer: V("bob") });
  assert.equal(named.reason, "NO_SUCH_PROJECT");
  const p2 = w.project("Names", "bob", ["carol"]);
  const byName = w.registers.interestSet({ register: "town_filings", project: p2, filter: { names: ["Donor Eleven"] }, author: V("bob"), viewer: V("bob") });
  assert.deepEqual([byName.ok, byName.watch, byName.watch_note], [true, false, "INTEREST_NOT_WATCHABLE"]);
  /* a changed filter keeps the earlier version */
  const b = set({ filter: { filer_ids: ["F10002"] } });
  assert.equal(b.interest.version, 2);
  assert.deepEqual(w.registers.interestOf({ project: w.P, viewer: V("bob") }).history.map((h) => [h.version, h.filter.filer_ids[0]]), [[1, "F10001"], [2, "F10002"]]);
  assert.equal(w.registers.interestOf({ project: w.P, viewer: V("carol") }).interests.length, 1);
  /* a hidden project's interest is invisible to others; machines state none */
  const H = w.project("Secret", "bob", [], { hidden: true });
  assert.equal(w.registers.interestSet({ register: "town_filings", project: H, filter: { filer_ids: ["F10001"] }, author: V("bob"), viewer: V("bob") }).ok, true);
  assert.equal(w.registers.interestOf({ project: H, viewer: V("dave") }).reason, "NO_SUCH_PROJECT");
  assert.equal(w.registers.interestSet({ register: "town_filings", project: w.P, filter: {}, author: MACHINE, viewer: MACHINE }).reason, "MACHINE_CANNOT_STATE_INTEREST");
  assert.equal(w.registers.interestSet({ register: "town_filings", project: w.P, filter: { filer_ids: ["F10001"] }, author: V("dave"), viewer: V("dave") }).reason, "NO_SUCH_PROJECT");
  /* planning and a search never create one */
  const n = w.count("register_interests");
  w.registers.registerFilter({ register: "town_filings", project: w.P, viewer: V("bob") });
  w.registers.searchRows({ scope: { register: "town_filings" }, filer_id: "F10001", viewer: V("bob") });
  assert.equal(w.count("register_interests"), n);
  /* control: forgetting ends the listener's watch and keeps its history */
  const f = w.registers.interestForget({ interest: a.interest.id, author: V("bob"), viewer: V("bob") });
  assert.deepEqual([f.ok, f.interest.ended, f.interest.watch], [true, true, false]);
  assert.deepEqual([heard.at(-1).watch, w.registers.interestOf({ project: w.P, viewer: V("bob") }).history.length], [false, 3]);
  assert.equal(w.registers.interestForget({ interest: a.interest.id, author: V("bob"), viewer: V("bob") }).existed, true);
});

test("R32: the watch of a stated interest can be switched off and on again, by a number only", () => {
  const w = seeded();
  const heard = [];
  w.registers.onInterest("following", (e) => heard.push(e));
  const a = w.registers.interestSet({ register: "town_filings", project: w.P, filter: { filer_ids: ["F10001"] }, author: V("bob"), viewer: V("bob") });
  assert.equal(w.registers.watchSet({ interest: a.interest.id, watch: false, author: V("bob"), viewer: V("bob") }).interest.watch, false);
  assert.equal(w.registers.watchSet({ interest: a.interest.id, watch: true, author: V("bob"), viewer: V("bob") }).interest.watch, true);
  assert.deepEqual(heard.map((h) => h.watch), [true, false, true]);
  const named = w.registers.interestSet({ register: "town_filings", project: w.P, filter: { names: ["Donor Eleven"] }, author: V("bob"), viewer: V("bob") });
  assert.equal(w.registers.watchSet({ interest: named.interest.id, watch: true, author: V("bob"), viewer: V("bob") }).reason, "INTEREST_NOT_WATCHABLE");
});

/* ------------------------------------------------------------------------------------------ refresh */

const etagged = (etag, text, extra = {}) => ({ [URL_]: served(enc(text), { etag, ...extra }) });
const watchView = () => viewWith((v) => { const r = v.registers.find((x) => x.key === "town_filings"); r.row_key_basis = "source"; r.refresh = { cadence_hours: 24, validators: ["etag"] }; });

test("R33: a moved validator starts a refresh; agreeing validators fetch no body (REFRESH_UNCHANGED); only changed rows are stored; a name interest is REFRESH_NEEDS_MEMBER on the alarm and runs by registerRefresh; a gated register is member_act_required", async () => {
  const w = seeded({ view: watchView() });
  const base = Array.from({ length: 20 }, (_, i) => rowOf(i));
  const i1 = w.registers.interestSet({ register: "town_filings", project: w.P, filter: { filer_ids: ["F10001"] }, author: V("bob"), viewer: V("bob") });
  START(w, { scope: "project", project: w.P, author: V("bob"), viewer: V("bob"), filter: { filer_ids: ["F10001"] } });
  await w.drain(etagged('"v1"', csvRows(base)));
  assert.equal(w.count("register_cells"), 3);
  /* agreeing validators: no body */
  const same = await w.withNet(etagged('"v1"', csvRows(base)), () => w.registers.refreshImport({ interest: i1.interest.id, now: w.clock.ms }));
  assert.deepEqual([same.out.ok, same.out.reason], [false, "REFRESH_UNCHANGED"]);
  assert.ok(same.net.seen.length > 0 && same.net.seen.every((r) => r.init.method === "HEAD" || (r.init.headers && r.init.headers.range)), "only probes: no body fetched");
  assert.equal(w.count("register_imports"), 1);
  /* a moved validator and changed rows (F10001 rows: i = 1, 8, 15) */
  const next = base.map((r, i) => (i === 8 ? { ...r, note: "changed" } : r)).concat([rowOf(22, { filer: "F10001" })]);
  w.clock.ms += 3_600_000;
  const r = await w.withNet(etagged('"v2"', csvRows(next)), () => w.registers.refreshImport({ interest: i1.interest.id, now: w.clock.ms }));
  assert.deepEqual([r.out.ok, r.out.existed], [true, false]);
  const imp = w.sql(`SELECT kind, previous, on_behalf, author FROM register_imports WHERE import_id=?`, r.out.import)[0];
  assert.deepEqual([imp.kind, imp.previous, imp.on_behalf, imp.author], ["refresh", 1, V("bob"), V("bob")]);
  await w.drain(etagged('"v2"', csvRows(next)));
  assert.equal(w.count("register_cells"), 3 + 2, "only the changed and the new row are stored");
  assert.equal(w.sql(`SELECT rows_new, rows_unchanged FROM register_imports WHERE import_id=2`)[0].rows_new, 2);
  /* a name interest: not on the alarm, by a member's act */
  const p2 = w.project("Names", "bob", ["carol"]);
  const named = w.registers.interestSet({ register: "town_filings", project: p2, filter: { names: ["Donor 11"] }, author: V("bob"), viewer: V("bob") });
  assert.equal((await w.registers.refreshImport({ interest: named.interest.id })).reason, "NO_SUCH_INTEREST", "it is not watched");
  const forced = await w.withNet(etagged('"v2"', csvRows(next)), () => w.registers.registerRefresh({ interest: named.interest.id, author: V("bob"), viewer: V("bob"), force: true }));
  assert.equal(forced.out.ok, true);
  assert.equal(w.sql(`SELECT kind FROM register_imports WHERE import_id=?`, forced.out.import)[0].kind, "refresh");
  assert.equal((await w.registers.registerRefresh({ interest: named.interest.id, author: MACHINE, viewer: MACHINE })).reason, "MACHINE_CANNOT_REFRESH_REGISTER");
  assert.equal((await w.registers.registerRefresh({ interest: 999, author: V("bob"), viewer: V("bob") })).reason, "NO_SUCH_PROJECT");
  /* control: a gated register is member_act_required */
  w.sql(`UPDATE register_interests SET register='trades_licences' WHERE interest_id=${i1.interest.id}`);
  assert.equal((await w.registers.refreshImport({ interest: i1.interest.id })).reason, "member_act_required");
});

test("R33: the member's own refresh of a team pre-read runs the same; the daemon paused refuses; the phase and the host stop a watch", async () => {
  const w = seeded({ view: watchView() });
  START(w);
  await w.drain(etagged('"v1"', csv(10)));
  w.clock.ms += 3_600_000;
  const none = await w.withNet(etagged('"v1"', csv(10)), () => w.registers.registerRefresh({ import: 1, author: V("alice"), viewer: V("alice") }));
  assert.equal(none.out.reason, "REFRESH_UNCHANGED");
  const forced = await w.withNet(etagged('"v1"', csv(10)), () => w.registers.registerRefresh({ import: 1, author: V("alice"), viewer: V("alice"), force: true }));
  assert.equal(forced.out.ok, true);
  assert.equal(w.sql(`SELECT scope FROM register_imports WHERE import_id=?`, forced.out.import)[0].scope, "team");
  const w2 = seeded({ view: watchView() });
  const i = w2.registers.interestSet({ register: "town_filings", project: w2.P, filter: { filer_ids: ["F10001"] }, author: V("bob"), viewer: V("bob") });
  assert.equal((await w2.registers.refreshImport({ interest: i.interest.id, host: { paused: () => ({ paused: true }) } })).reason, "HOST_PAUSED");
});

test("R34: a refresh adding 3 and changing 1 row answers one entry with counts 3, 1, 0 and total 4; one with no difference answers none; a hidden project's entry is absent for others; no entry holds a cell; two refreshes with changes answer two entries", async () => {
  const w = seeded({ view: watchView() });
  const base = Array.from({ length: 12 }, (_, i) => rowOf(i));
  const i1 = w.registers.interestSet({ register: "town_filings", project: w.P, filter: { filer_ids: ["F10001"] }, author: V("bob"), viewer: V("bob") });
  START(w, { scope: "project", project: w.P, author: V("bob"), viewer: V("bob"), filter: { filer_ids: ["F10001"] } });
  await w.drain(etagged('"v1"', csvRows(base)));
  const refresh = async (etag, rows) => { w.clock.ms += 3_600_000; const r = await w.withNet(etagged(etag, csvRows(rows)), () => w.registers.refreshImport({ interest: i1.interest.id, now: w.clock.ms })); assert.equal(r.out.ok, true, JSON.stringify(r.out)); await w.drain(etagged(etag, csvRows(rows))); };
  const rows2 = base.map((r, i) => (i === 1 ? { ...r, note: "changed" } : r)).concat([rowOf(21, { filer: "F10001" }), rowOf(22, { filer: "F10001" }), rowOf(23, { filer: "F10001" })]);
  await refresh('"v2"', rows2);
  const first = w.registers.changesSince({ viewer: V("bob") });
  assert.equal(first.changes.length, 1);
  const e = first.changes[0];
  assert.deepEqual([e.counts, e.total, e.project, e.register, e.import, e.previous_import, e.interest], [{ added: 3, changed: 1, removed: 0, possibly_removed: 0 }, 4, w.P, "town_filings", 2, 1, i1.interest.id]);
  assert.ok(!/Donor|F1000|note/.test(JSON.stringify(e).replace(/F10001/g, "")), "no entry holds a cell or a name");
  /* no difference: an import whose rows are the same */
  await refresh('"v3"', rows2);
  assert.equal(w.registers.changesSince({ viewer: V("bob") }).changes.length, 1, "a refresh with no difference answers none");
  /* a second change: two entries */
  await refresh('"v4"', rows2.concat([rowOf(30, { filer: "F10001" })]));
  const two = w.registers.changesSince({ viewer: V("bob") });
  assert.equal(two.changes.length, 2);
  assert.deepEqual(w.registers.changesSince({ after: two.cursor, viewer: V("bob") }).changes, []);
  assert.equal(w.registers.changesSince({ viewer: V("bob"), limit: 1 }).changes.length, 1);
  assert.equal(w.registers.changesSince({ viewer: V("bob"), limit: 201 }).reason, "SEARCH_BAD_LIMIT");
  assert.equal(w.registers.changesSince({ viewer: V("bob"), since: new Date(w.clock.ms + 1).toISOString() }).changes.length, 0);
  /* a project the viewer cannot see leaves its entry out whole */
  assert.equal(w.registers.changesSince({ viewer: V("dave") }).changes.length, 0);
  assert.equal(w.registers.changesSince({ viewer: V("carol") }).changes.length, 2);
});

/* ------------------------------------------------------------------------------------------ the officers register */

const KEY = "OFFICERS-KEY-SENTINEL";
const withCreds = (w, on = true) => { w.store.credentials = { calls: [], async keyedServiceFor({ service }) { this.calls.push(service); return on ? { ok: true, service, key: KEY } : { ok: false, reason: "KEYED_SERVICE_OFF", code: "KEYED_SERVICE_OFF", service }; } }; return w; };
const OFF_URL = "https://api.company.state.example/officers?company=C1234567";
const officersFile = () => enc("company,entity,officer,office,residence,telephone\nC1234567,Ellery Ferries Ltd,Ann Marlow,Chair,9000 SENTINEL-STREET,555-0199-SENTINEL\nC1234567,Ellery Ferries Ltd,Bo Hale,Secretary,12 Other Rd,555-0100\n");

test("R46: the lookup by company number sends the key only to the service's host, keeps only the definition's kept columns and writes only a count; the service off sends nothing; a machine and the daemon are refused; a name is not a query", async () => {
  const w = withCreds(seeded());
  const body = JSON.stringify([{ company: "C1234567", entity: "Ellery Ferries Ltd", officer: "Ann Marlow", office: "Chair", residence: "9000 SENTINEL-STREET", telephone: "555-0199-SENTINEL" }]);
  const mine = () => w.sql(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'register_%' AND name <> 'register_lookup_use'`).filter((r) => REGISTERS_TABLES.includes(r.name)).map((r) => JSON.stringify(w.sql(`SELECT * FROM ${r.name}`)));
  const before = mine();
  const ok = await w.withNet({ [OFF_URL]: () => new Response(body, { headers: { "content-type": "application/json" } }) }, () => w.registers.officersLookup({ query: "C1234567", author: V("bob"), viewer: V("bob") }));
  assert.equal(ok.out.ok, true, JSON.stringify(ok.out));
  assert.deepEqual(ok.out.rows, [{ company: "C1234567", entity: "Ellery Ferries Ltd", officer: "Ann Marlow", office: "Chair" }]);
  assert.ok(!JSON.stringify(ok.out).includes("SENTINEL"), "no contact cell, and not the key");
  assert.equal(ok.net.seen.length, 1);
  assert.equal(new URL(ok.net.seen[0].url).hostname, "api.company.state.example");
  assert.equal(ok.net.seen[0].init.headers["ocp-apim-subscription-key"], KEY, "the key rides the one request");
  assert.deepEqual(w.sql(`SELECT count FROM register_lookup_use`).map((r) => r.count), [1]);
  assert.deepEqual(mine(), before, "nothing else written");
  assert.ok(!JSON.stringify(w.sql(`SELECT * FROM register_lookup_use`)).includes(KEY));
  /* refusals */
  const net = network({});
  const outs = {};
  try {
    outs.name = await w.registers.officersLookup({ query: "Ann Marlow", author: V("bob"), viewer: V("bob") });
    outs.machine = await w.registers.officersLookup({ query: "C1234567", author: MACHINE, viewer: MACHINE });
    outs.daemon = await w.registers.officersLookup({ query: "C1234567", author: "class:daemon", viewer: "class:daemon" });
    const off = withCreds(seeded(), false);
    outs.off = await off.registers.officersLookup({ query: "C1234567", author: V("bob"), viewer: V("bob") });
  } finally { net.restore(); }
  assert.equal(net.seen.length, 0, "zero requests");
  assert.deepEqual([outs.name.reason, outs.machine.reason, outs.daemon.reason, outs.off.reason], ["QUERY_NOT_NAMED", "MACHINE_CANNOT_LOOK_UP_OFFICERS", "NOT_PERMITTED", "KEYED_SERVICE_OFF"]);
  /* any other act on the register is the phase's refusal; the lookup is not */
  for (const act of [() => w.registers.registerFilter({ register: "company_officers", viewer: V("bob") }), () => w.registers.importStart({ register: "company_officers", filter: {}, scope: "project", project: w.P, author: V("bob"), viewer: V("bob") })])
    assert.equal((await act()).reason, "REGISTER_NOT_IN_ALPHA");
});

test("R46: the state's bulk file, in a member's hand, is brought in through importStart reduced as it is read; without the file it is refused and nothing is fetched; the original is not kept", async () => {
  const w = seeded();
  const net = network({});
  let none;
  try { none = w.registers.importStart({ register: "company_officers", filter: {}, scope: "project", project: w.P, author: V("bob"), viewer: V("bob") }); } finally { net.restore(); }
  assert.deepEqual([none.ok, none.reason], [false, "REGISTER_NOT_IN_ALPHA"]);
  assert.equal(net.seen.length, 0);
  const net2 = network({});
  let got;
  try { got = await w.registers.importStart({ register: "company_officers", filter: {}, scope: "project", project: w.P, author: V("bob"), viewer: V("bob"), file: officersFile() }); await w.drain({}); } finally { net2.restore(); }
  assert.deepEqual([got.ok, got.source], [true, "file"], JSON.stringify(got));
  assert.equal(net2.seen.length, 0, "nothing is fetched from that site");
  const s = w.registers.importStatus({ import: got.import, viewer: V("bob") });
  assert.equal(s.state, "indexed");
  assert.deepEqual(s.reduction.dropped_columns.map((c) => c.name).sort(), ["residence", "telephone"]);
  assert.equal(s.reduction.rows_out, 2);
  assert.ok(!dumpAll(w).includes("SENTINEL") && !bucketText(w).includes("SENTINEL"), "no contact cell anywhere");
  assert.ok(!bucketText(w).includes("company,entity,officer,office,residence"), "the original is not stored");
  const found = w.registers.searchRows({ scope: { register: "company_officers" }, name: "Ann Marlow", viewer: V("bob") });
  assert.deepEqual(found.rows.map((r) => r.cells.office), ["Chair"]);
  assert.equal(JSON.stringify(s).includes(s.reduction.original_fingerprints[0].sha256), true, "its fingerprint is");
  /* a machine and an empty file are refused */
  assert.equal((await w.registers.importStart({ register: "company_officers", filter: {}, scope: "project", project: w.P, author: MACHINE, viewer: MACHINE, file: officersFile() })).reason, "MACHINE_CANNOT_IMPORT_REGISTER");
  assert.equal((await w.registers.importStart({ register: "company_officers", filter: {}, scope: "project", project: w.P, author: V("bob"), viewer: V("bob"), file: new Uint8Array(0) })).reason, "FILE_EMPTY");
  /* the listing never offers a fetch of it, and no definition names the aggregator */
  assert.ok(!JSON.stringify(w.registers.view()).toLowerCase().includes("opencorporates"));
});

test("R46 control: a gate-none register is unaffected by the file door's exceptions", async () => {
  const w = seeded();
  assert.equal((await w.registers.importStart({ register: "town_filings", filter: {}, scope: "project", project: w.P, author: V("bob"), viewer: V("bob"), file: enc(csv(5)), holes: { table: "2025" } })).ok, true);
});
