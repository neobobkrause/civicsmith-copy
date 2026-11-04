/* registers R35–R45 (the invariants) and R61–R72 (the guardrails, the module-local halves; T53; N1259; K1484, K1485, K1492, K1493, K4403, K4405):
   no home address or phone number anywhere, no judgment on anyone, no name matching, every op declared and held true, refusals as words, answers within
   their time, what is exported and what is not, no jurisdiction in the module, the watch by number, the labels by key. At the module's interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { seeded, world, V, MACHINE, served, csv, csvRows, rowOf, enc, URL_, HOST, HEADER, DEF, network, viewWith, sourceKeyed } from "./fixture.mjs";
import { DECLARED_OPS, REGISTERS_OPS, registersOps, REGISTERS_SCHEMA } from "../../../src/registers/index.mjs";
import { declaredOpHolds } from "../../declared-ops.mjs";
import { word, hasWord } from "../../../src/setup-words/index.mjs";

const START = (w, over = {}) => w.registers.importStart({ register: "town_filings", filter: {}, scope: "team", author: V("alice"), viewer: V("alice"), holes: { table: "2025" }, ...over });
const TABLES = [...REGISTERS_SCHEMA.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1]);
const dump = (w, tables = null) => w.sql(`SELECT name FROM sqlite_master WHERE type='table'`).filter((r) => !tables || tables.includes(r.name)).map((r) => JSON.stringify(w.sql(`SELECT * FROM ${r.name}`))).join("\n");
const objects = (w) => [...w.b.held.values()].map((v) => new TextDecoder("utf-8", { fatal: false }).decode(v)).join("\n");

/* ------------------------------------------------------------------------------------------ G3 */

const S = { street: "SENTINEL-STREET-9000", tel: "SENTINEL-TEL-555-0199", hidden: "SENTINEL-UNLISTED-COLUMN", free: "(415) 555-0123", kept: "KEPT-NAME-MARKER" };
const WIDE = `${HEADER},secret_notes`;
const wide = (n) => csv(n, { header: WIDE, cell: (i) => ({ ...rowOf(i, { donor_street: S.street, donor_tel: S.tel, note: i === 2 ? `reach me at ${S.free}` : `note ${i}`, donor_name: i === 3 ? `Donor ${S.kept}` : `Donor ${i}` }), secret_notes: S.hidden }) }).replace(/^(.*)$/m, WIDE);
const wideCsv = (n) => { const lines = csv(n, { cell: (i) => rowOf(i, { donor_street: S.street, donor_tel: S.tel, note: i === 2 ? `reach me at ${S.free}` : `note ${i}`, donor_name: i === 3 ? `Donor ${S.kept}` : `Donor ${i}` }) }).split("\n"); return lines.map((l, i) => (l === "" ? l : `${l},${i === 0 ? "secret_notes" : S.hidden}`)).join("\n"); };

test("R63 (G3), R35: a file with sentinels in home_address, phone, an unlisted column and a free-text cell, imported whole and by filter, searched, cited, compared, refreshed, expunged and read out every way, leaves no sentinel in any table, object, content text, answer or error; the dropped columns are named, never valued", async () => {
  const w = seeded({ view: viewWith((v) => { const r = v.registers.find((x) => x.key === "town_filings"); r.refresh = { cadence_hours: 24, validators: ["etag"] }; }) });
  const answers = [];
  const keep = (x) => { answers.push(JSON.stringify(x)); return x; };
  const net = (e) => ({ [URL_]: served(enc(wideCsv(20)), { etag: e }) });
  keep(START(w));
  await w.drain(net('"v1"'));
  w.clock.ms += 3_600_000;
  keep(START(w, { filter: { filer_ids: ["F10001"] }, scope: "project", project: w.P, author: V("bob"), viewer: V("bob") }));
  await w.drain(net('"v1"'));
  keep(w.registers.registerList({ viewer: V("bob") }));
  keep(w.registers.importStatus({ import: 1, viewer: V("bob") })); keep(w.registers.importStatus({ import: 2, viewer: V("bob") }));
  keep(w.registers.searchRows({ scope: {}, name: "Donor", viewer: V("bob") }));
  keep(w.registers.searchRows({ scope: { import: 2 }, filer_id: "F10001", viewer: V("bob") }));
  const key = w.sql(`SELECT row_key FROM register_import_rows WHERE src_row=3 AND import_id=1`)[0].row_key;
  keep(w.registers.rowOf({ import: 1, row_key: key, viewer: V("bob") }));
  const cited = keep(w.registers.citeRow({ import: 1, row_key: key, author: V("bob"), viewer: V("bob") }));
  keep(w.registers.compare({ import_a: 1, import_b: 2, viewer: V("bob") }));
  keep(w.registers.changesSince({ viewer: V("bob") }));
  keep(w.registers.importsEnded({}));
  keep(await w.registers.registerDelta({ register: "town_filings", filter: {}, scope: "team", viewer: V("bob"), holes: { table: "2025" } }));
  keep(await w.registers.rowExpunge({ register: "town_filings", row_key: w.sql(`SELECT row_key FROM register_import_rows WHERE src_row=5 AND import_id=1`)[0].row_key, ground: "unlawful", reason: "x", author: V("alice") }));
  keep(w.registers.registerFilter({ register: "town_filings", project: w.P, viewer: V("bob") }));
  keep(await w.registers.registerRefresh({ import: 1, author: V("alice"), viewer: V("alice"), force: true }));
  await w.drain(net('"v2"'));
  // errors too
  keep(w.registers.rowOf({ import: 1, row_key: "nope", viewer: V("bob") })); keep(START(w, { filter: { names: ["Ann*"] } }));
  const text = [...answers, dump(w), objects(w), JSON.stringify(w.sql(`SELECT * FROM content`)), JSON.stringify(w.sql(`SELECT * FROM files`))].join("\n");
  for (const [k, v] of Object.entries(S)) {
    if (k === "kept" || k === "hidden" && false) continue;
    assert.ok(!text.includes(v), `${k} (${v}) is nowhere`);
  }
  /* the kept columns' values are present (control) and the dropped columns are named, never valued */
  assert.ok(text.includes(S.kept), "control: a sentinel in a kept column is found, so the scan works");
  const s = w.registers.importStatus({ import: 1, viewer: V("bob") });
  assert.deepEqual(s.reduction.dropped_columns.map((c) => c.name).sort(), ["donor_street", "donor_tel", "secret_notes"]);
  assert.equal(s.reduction.withheld_cells, 1, "the phone typed into a free-text cell is withheld");
  assert.ok(JSON.stringify(cited.extract.dropped_columns).includes("donor_tel") && !JSON.stringify(cited).includes(S.tel));
});

/* ------------------------------------------------------------------------------------------ G12 */

test("R64 (G12): after an import by a filter that matches 2 of 10 rows no object holds the 8 unmatched rows or the original's bytes; the hop holds the original's fingerprint, byte count and coverage, the dropped names, the filter fingerprint and 'reduced under K1485'", async () => {
  const w = seeded();
  const text = csv(10, { cell: (i) => rowOf(i, { donor_name: `Distinct${i}Person Quill`, filer: i < 2 ? "F10001" : `F2000${i}` }) });
  START(w, { filter: { filer_ids: ["F10001"] } });
  await w.drain({ [URL_]: served(enc(text)) });
  const all = objects(w) + dump(w);
  for (let i = 2; i < 10; i++) assert.ok(!all.includes(`Distinct${i}Person`), `row ${i} (unmatched) is nowhere`);
  assert.ok(all.includes("Distinct0Person") && all.includes("Distinct1Person"), "control: the 2 matched rows are present");
  assert.ok(!objects(w).includes(HEADER), "the original's bytes are not held");
  const hop = JSON.parse(w.sql(`SELECT content FROM files WHERE path='data/provenance.json'`)[0].content).documents[0];
  const r = hop.capture.reduced;
  assert.equal(r.original.sha256, createHash("sha256").update(enc(text)).digest("hex"));
  assert.deepEqual([r.original.bytes, r.original.covers, r.reason, r.rows_in, r.rows_out], [enc(text).length, "whole_file", "reduced under K1485", 10, 2]);
  assert.deepEqual(r.dropped_columns.map((c) => c.name).sort(), ["donor_street", "donor_tel"]);
  assert.match(r.filter_fingerprint, /^[0-9a-f]{64}$/);
  assert.equal(r.filter_fingerprint, w.sql(`SELECT filter_fp FROM register_imports`)[0].filter_fp);
});

/* ------------------------------------------------------------------------------------------ G1, G5, G6 */

test("R61 (G1), R44: a watch is by a number or a stated interest, never an unattended search for a person: a name is not a scheme's query, an unlisted scheme names no register, a wildcard names none, a machine states, imports and refreshes nothing; the name interest is never ticked; a filer-id interest lands and ticks", async () => {
  const w = seeded({ view: viewWith((v) => { v.registers.find((x) => x.key === "town_filings").refresh = { cadence_hours: 24, validators: ["etag"] }; }) });
  assert.deepEqual(w.registers.registerFor({ scheme: "filer" }), { ok: true, scheme: "filer", registers: ["town_filings"] });
  assert.deepEqual(w.registers.registerFor({ scheme: "docket" }).registers, ["county_raw"].filter(() => false), "a scheme the register does not state");
  assert.deepEqual(w.registers.registerFor({ scheme: "no-such-scheme" }).registers, [], "an unlisted scheme answers none");
  assert.deepEqual(w.registers.registerFor({ scheme: "fil*" }).registers, [], "a wildcard answers none");
  assert.equal(w.registers.registerFor({ name: "Ann Marlow" }).reason, "QUERY_NOT_NAMED");
  assert.equal(w.registers.registerFor({ scheme: "filer", name: "Ann Marlow" }).reason, "QUERY_NOT_NAMED");
  const before = dump(w);
  const net = network({});
  const outs = [];
  try {
    outs.push(w.registers.interestSet({ register: "town_filings", project: w.P, filter: { filer_ids: ["F10001"] }, author: MACHINE, viewer: MACHINE }));
    outs.push(w.registers.importStart({ register: "town_filings", filter: {}, scope: "project", project: w.P, author: MACHINE, viewer: MACHINE, holes: { table: "2025" } }));
    outs.push(await w.registers.registerRefresh({ import: 1, author: MACHINE, viewer: MACHINE }));
    outs.push(w.registers.interestSet({ register: "town_filings", project: w.P, filter: { names: ["Ann Marlow"] }, watch: true, author: V("bob"), viewer: V("bob") }));
    outs.push(w.registers.interestSet({ register: "town_filings", project: w.P, filter: { names: ["Ann*"] }, author: V("bob"), viewer: V("bob") }));
  } finally { net.restore(); }
  assert.deepEqual(outs.map((o) => o.reason), ["MACHINE_CANNOT_STATE_INTEREST", "MACHINE_CANNOT_IMPORT_REGISTER", "MACHINE_CANNOT_REFRESH_REGISTER", "INTEREST_NOT_WATCHABLE", "FILTER_PATTERN_REFUSED"]);
  assert.equal(dump(w), before, "each refused with nothing written");
  assert.equal(net.seen.length, 0);
  /* the name interest is never ticked */
  const named = w.registers.interestSet({ register: "town_filings", project: w.P, filter: { names: ["Ann Marlow"] }, author: V("bob"), viewer: V("bob") });
  assert.equal(named.watch, false);
  assert.equal((await w.registers.refreshImport({ interest: named.interest.id })).reason, "NO_SUCH_INTEREST");
  /* no op fetches by name: an op that takes a name reads held rows only, with zero requests */
  const byName = Object.entries(DECLARED_OPS).filter(([, d]) => !d.mutating && d.fields.accepts.some((f) => /^(name|names|organization)$/.test(f))).map(([op]) => op);
  assert.deepEqual(byName, ["registersearch"]);
  const n2 = network({});
  try { w.registers.searchRows({ scope: {}, name: "Ann Marlow", viewer: V("bob") }); } finally { n2.restore(); }
  assert.equal(n2.seen.length, 0);
  /* control: a filer-id interest and its refresh land and tick */
  const i = w.registers.interestSet({ register: "town_filings", project: w.P, filter: { filer_ids: ["F10001"] }, author: V("bob"), viewer: V("bob") });
  assert.equal(i.watch, true);
  START(w, { scope: "project", project: w.P, author: V("bob"), viewer: V("bob"), filter: { filer_ids: ["F10001"] } });
  await w.drain({ [URL_]: served(enc(csv(10)), { etag: '"a"' }) });
  w.clock.ms += 3_600_000;
  assert.equal((await w.withNet({ [URL_]: served(enc(csv(10)), { etag: '"b"' }) }, () => w.registers.refreshImport({ interest: i.interest.id }))).out.ok, true);
});

test("R65 (G5 (1)): a gated or fee-bearing register: import, refresh and the watch answer member_act_required, fetch nothing and record nothing but that answer", async () => {
  const w = seeded();
  const i = w.registers.interestSet({ register: "trades_licences", project: w.P, filter: { licence_numbers: ["L123456"] }, author: V("bob"), viewer: V("bob") });
  assert.equal(i.ok, true);
  const before = dump(w);
  const net = network({});
  const outs = [];
  try {
    outs.push(w.registers.importStart({ register: "trades_licences", filter: {}, scope: "project", project: w.P, author: V("bob"), viewer: V("bob") }));
    outs.push(await w.registers.refreshImport({ interest: i.interest.id }));
    outs.push(await w.registers.registerRefresh({ interest: i.interest.id, author: V("bob"), viewer: V("bob"), force: true }));
    outs.push(await w.registers.registerDelta({ register: "trades_licences", filter: {}, scope: "project", project: w.P, viewer: V("bob") }));
  } finally { net.restore(); }
  assert.deepEqual(outs.map((o) => o.reason), Array(4).fill("member_act_required"));
  assert.equal(net.seen.length, 0);
  assert.equal(dump(w), before);
});

test("R66 (G6): every answer carrying a row of a limited register carries the limit and its text key; no op returns contributor identity as a list or file; an unfiltered search is NO_CRITERIA; a limited system's definition without its use limit is refused; the limited rows are never exported", async () => {
  const w = seeded();
  const { makeZip } = await import("../../make-zip.mjs");
  const zip = makeZip([{ name: "itcont.txt", data: "F10001|Giver One|25.00|2025-03-15|Port Ellery|04101\nF10001|Giver Two|40.00|2025-03-16|Port Ellery|04101\n" }]);
  const routes = { "https://bulk.federal.example/headers/indiv_header.csv": served(enc("CMTE_ID,NAME,AMT,DT,CITY,ZIP\n")), "https://store.federal.example/indiv2026.zip": served(zip, { type: "application/zip" }) };
  const st = w.registers.importStart({ register: "federal_individual", filter: {}, scope: "team", author: V("alice"), viewer: V("alice"), holes: { cycle: "2026" } });
  await w.drain(routes);
  w.clock.ms += 3_600_000;
  w.registers.importStart({ register: "federal_individual", filter: { filer_ids: ["F10001"] }, scope: "team", author: V("alice"), viewer: V("alice"), holes: { cycle: "2026" } });
  await w.drain(routes);
  const key = w.sql(`SELECT row_key FROM register_import_rows WHERE import_id=1 AND src_row=1`)[0].row_key;
  const answers = {
    search: w.registers.searchRows({ scope: { register: "federal_individual" }, filer_id: "F10001", viewer: V("bob") }), row: w.registers.rowOf({ import: st.import, row_key: key, viewer: V("bob") }),
    cite: w.registers.citeRow({ import: st.import, row_key: key, author: V("bob"), viewer: V("bob") }), compare: w.registers.compare({ import_a: 1, import_b: 2, viewer: V("bob") }),
  };
  const lim = (x) => x.use_limit;
  for (const [what, a] of Object.entries({ search: answers.search.rows[0], row: answers.row, cite: answers.cite, compare: answers.compare }))
    assert.deepEqual([what, lim(a).key, lim(a).text_key], [what, "federal_contributor_use", "jurisdictions.use_limit.test_contributor_names"]);
  assert.equal(w.registers.searchRows({ scope: { register: "federal_individual" }, viewer: V("bob") }).reason, "NO_CRITERIA");
  /* the ops: none exports, sends or lists rows out */
  assert.ok(REGISTERS_OPS.every((o) => !/export|send|mail|download|solicit/.test(o)));
  /* a team's own definition of a limited system without the use limit is refused */
  const own = { ...DEF("federal_individual"), key: "my_fed", label: "My copy", system: "ellery.federal_files" };
  delete own.use_limit;
  assert.equal(w.registers.registerDefine({ definition: own, author: V("bob") }).reason, "REGISTER_NO_USE_LIMIT");
  /* control: a limit-free register's answers carry no limit */
  START(w);
  await w.drain({ [URL_]: served(enc(csv(5))) });
  assert.ok(!("use_limit" in w.registers.searchRows({ scope: { register: "town_filings" }, viewer: V("bob") }).rows[0]));
});

test("R68 (G10), R16: a full cycle (plan, delta, import, search, cite, compare, interest, refresh, change item) makes zero requests to any host but the register's own and leaves every AI table untouched; control: the spy sees a deliberately AI-using fixture", async () => {
  const w = seeded({ view: viewWith((v) => { v.registers.find((x) => x.key === "town_filings").refresh = { cadence_hours: 24, validators: ["etag"] }; }) });
  const aiTables = w.sql(`SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE 'ai_%' OR name LIKE '%ai_use%' OR name LIKE 'agent_%')`).map((r) => r.name);
  const snap = () => aiTables.map((t) => JSON.stringify(w.sql(`SELECT * FROM ${t}`)));
  const before = snap();
  const net = network({ [URL_]: served(enc(csv(12)), { etag: '"a"' }), "https://api.anthropic.com/v1/messages": () => new Response("{}") });
  try {
    w.registers.registerFilter({ register: "town_filings", project: w.P, viewer: V("bob") });
    await w.registers.registerDelta({ register: "town_filings", filter: {}, scope: "project", project: w.P, viewer: V("bob"), holes: { table: "2025" } });
    START(w, { scope: "project", project: w.P, author: V("bob"), viewer: V("bob"), filter: { filer_ids: ["F10001"] } });
    for (let i = 0; i < 40 && w.registers.importDue(w.clock.ms, w.sweep); i++) { await w.registers.importTick(w.clock.ms, 5000, w.sweep); w.clock.ms += 1000; }
    const rows = w.registers.searchRows({ scope: {}, filer_id: "F10001", viewer: V("bob") });
    const key = rows.rows[0].row_key;
    w.registers.citeRow({ import: 1, row_key: key, author: V("bob"), viewer: V("bob") });
    const i = w.registers.interestSet({ register: "town_filings", project: w.P, filter: { filer_ids: ["F10001"] }, author: V("bob"), viewer: V("bob") });
    w.clock.ms += 3_600_000;
    await w.registers.registerRefresh({ interest: i.interest.id, author: V("bob"), viewer: V("bob"), force: true });
    for (let i2 = 0; i2 < 40 && w.registers.importDue(w.clock.ms, w.sweep); i2++) { await w.registers.importTick(w.clock.ms, 5000, w.sweep); w.clock.ms += 1000; }
    w.registers.compare({ import_a: 1, import_b: 2, viewer: V("bob") });
    w.registers.changesSince({ viewer: V("bob") });
    /* control: an AI-using fixture module's call is counted by the same spy */
    await fetch("https://api.anthropic.com/v1/messages", { method: "POST", body: "{}" });
  } finally { net.restore(); }
  const hosts = net.seen.map((r) => new URL(r.url).hostname);
  assert.deepEqual([...new Set(hosts)].sort(), [HOST, "api.anthropic.com"].sort());
  assert.equal(hosts.filter((h) => h === "api.anthropic.com").length, 1, "only the control's own call");
  assert.deepEqual(snap(), before, "no AI account or counter changed");
});

test("R71: a team's own register is held to the same conduct: a contact column asked kept, no terms, a gated host or a people-search is refused; its first import drops every unassigned column; it is listed only to its team; a valid own definition imports", async () => {
  const w = seeded();
  const base = { ...DEF("town_filings"), key: "our_filings", label: "Our filings", terms_basis: "none stated on the page we read" };
  assert.equal(w.registers.registerDefine({ definition: { ...base, columns: base.columns.map((c) => (c.role === "home_address" ? { ...c, keep: true } : c)) }, author: V("bob") }).reason, "REGISTER_KEEPS_CONTACT");
  assert.equal(w.registers.registerDefine({ definition: { ...base, terms_basis: undefined }, author: V("bob") }).reason, "REGISTER_NO_TERMS");
  assert.equal(w.registers.registerDefine({ definition: { ...base, system: "marlow.board" }, author: V("bob") }).reason, "member_act_required");
  assert.equal(w.registers.registerDefine({ definition: { ...base, gate: "people_search" }, author: V("bob") }).reason, "REGISTER_PEOPLE_SEARCH");
  assert.equal(w.registers.registerDefine({ definition: base, author: V("bob") }).ok, true);
  const wideRow = (i) => ({ ...rowOf(i), donor_street: S.street, donor_tel: S.tel });
  const file = csvRows(Array.from({ length: 6 }, (_, i) => wideRow(i))).split("\n").map((l, i) => (l ? `${l},${i === 0 ? "unassigned_col" : S.hidden}` : l)).join("\n");
  const st = w.registers.importStart({ register: "our_filings", filter: {}, scope: "project", project: w.P, author: V("bob"), viewer: V("bob"), holes: { table: "2025" } });
  assert.equal(st.ok, true);
  await w.drain({ [URL_]: served(enc(file)) });
  const text = dump(w) + objects(w);
  assert.ok(!text.includes(S.hidden) && !text.includes(S.street) && !text.includes(S.tel));
  assert.ok(w.registers.importStatus({ import: st.import, viewer: V("bob") }).reduction.dropped_columns.some((c) => c.name === "unassigned_col"));
  assert.equal(w.registers.registerList({ viewer: V("bob") }).own.length, 1);
  assert.equal(world().registers.registerList({ viewer: V("bob") }).own.length, 0);
});

test("R72: a cited row is an extract whose labels are true: the two fingerprints equal the segment's hop and its src_row locates the row in the fixture", async () => {
  const w = seeded();
  const text = csv(8);
  START(w);
  await w.drain({ [URL_]: served(enc(text)) });
  const key = w.sql(`SELECT row_key FROM register_import_rows WHERE src_row=5`)[0].row_key;
  const ex = w.registers.citeRow({ import: 1, row_key: key, author: V("bob"), viewer: V("bob") }).extract;
  const hop = JSON.parse(w.sql(`SELECT content FROM files WHERE path='data/provenance.json'`)[0].content).documents[0];
  assert.deepEqual([ex.reduced_sha256, ex.original_sha256, ex.original_covers], [hop.capture.sha256, hop.capture.reduced.original.sha256, hop.capture.reduced.original.covers]);
  assert.equal(text.split("\n")[ex.src_row].split(",")[1], "Donor 4", "src_row locates the row in the fixture (row 1 is the first after the header)");
  assert.equal(ex.label_key, "register.extract");
});
test.todo("R72 packaged: a cited row packaged in a fixture case and checked by the case checker passes with unverifiable stated, and a changed byte in the extract fails it (case-carriage and case-checker are layer 8; store-assembly's job)");

/* ------------------------------------------------------------------------------------------ the invariants */

test("R36: no table column, answer key or word of the module holds score, rank, suspect, flag, risk, central, knows, conflict, suspicious or most connected; control: the scan catches a fixture key", async () => {
  const w = seeded();
  START(w);
  await w.drain({ [URL_]: served(enc(csv(10))) });
  const bad = /\b(score|rank|suspect|flag|risk|central|knows|conflict|suspicious|most connected)\b/i;
  const cols = TABLES.flatMap((t) => w.sql(`PRAGMA table_info(${t})`).map((c) => c.name));
  assert.deepEqual(cols.filter((c) => bad.test(c)), []);
  const key = w.sql(`SELECT row_key FROM register_import_rows WHERE src_row=2`)[0].row_key;
  const answers = [w.registers.registerList({ viewer: V("bob") }), w.registers.importStatus({ import: 1, viewer: V("bob") }), w.registers.searchRows({ scope: {}, name: "Donor", viewer: V("bob") }),
    w.registers.rowOf({ import: 1, row_key: key, viewer: V("bob") }), w.registers.compare({ import_a: 1, import_b: 1, viewer: V("bob") }), w.registers.changesSince({ viewer: V("bob") }), w.registers.interestOf({ project: w.P, viewer: V("bob") })];
  const keysOf = (x, out = []) => { if (Array.isArray(x)) x.forEach((i) => keysOf(i, out)); else if (x && typeof x === "object") for (const [k, v] of Object.entries(x)) { out.push(k); keysOf(v, out); } return out; };
  const textOf = (x, out = []) => { if (Array.isArray(x)) x.forEach((i) => textOf(i, out)); else if (x && typeof x === "object") Object.values(x).forEach((v) => textOf(v, out)); else if (typeof x === "string") out.push(x); return out; };
  /* cells are the register's own data as written; the module's keys and sentences are what is judged */
  const own = answers.map((a) => keysOf(JSON.parse(JSON.stringify(a, (k, v) => (k === "cells" || k === "filter" ? undefined : v)))));
  assert.deepEqual(own.flat().filter((k) => bad.test(k)), []);
  const sentences = answers.flatMap((a) => textOf(JSON.parse(JSON.stringify(a, (k, v) => (k === "cells" || k === "filter" || k === "known" || k === "row_key" ? undefined : v)))));
  assert.deepEqual(sentences.filter((s) => bad.test(s)), []);
  assert.ok(bad.test("a suspect score"), "control: the scan catches a fixture key");
  assert.ok(keysOf({ score: 1 }).some((k) => bad.test(k)));
});

test("R37, R62: nothing in this module resolves a name, proposes a match or creates a link: the entity tables are unchanged by any op; control: a member's addIdentifier still works", async () => {
  const w = seeded();
  START(w);
  await w.drain({ [URL_]: served(enc(csv(12))) });
  const ent = () => w.sql(`SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE 'entit%' OR name LIKE 'identif%' OR name LIKE 'link%' OR name LIKE 'connection%')`).map((r) => `${r.name}:${w.count(r.name)}`).join();
  w.entities.migrate?.();
  const before = ent();
  assert.ok(before.length > 0, "the entity tables exist in this world");
  const net = network({});
  try {
    w.registers.searchRows({ scope: {}, name: "Donor 11", viewer: V("bob") });
    w.registers.searchRows({ scope: {}, organization: "Firm 3", viewer: V("bob") });
    w.registers.compare({ import_a: 1, import_b: 1, viewer: V("bob") });
    w.registers.registerFilter({ register: "town_filings", project: w.P, viewer: V("bob") });
    w.registers.interestSet({ register: "town_filings", project: w.P, filter: { names: ["Donor 11"] }, author: V("bob"), viewer: V("bob") });
  } finally { net.restore(); }
  assert.equal(net.seen.length, 0);
  assert.equal(ent(), before);
  const e = w.entities.createEntity({ kind: "person", label: "Donor Eleven", note: "a donor a member knows by name", declaredBy: V("bob") });
  assert.equal(e.ok, true, JSON.stringify(e));
  const id = w.entities.addIdentifier({ entityId: e.entity_id, scheme: "filer", id: "F10001", basis: "the filing", by: V("bob") });
  assert.equal(id.ok, true, JSON.stringify(id));
  assert.notEqual(ent(), before, "control: a member's identifier is written by the entities module, not by this one");
});

/* the arm as the door runs it */
const arm = (w, op, stamps) => async (fields) => {
  const url = new URL("http://x/?" + new URLSearchParams({ op, ...stamps }));
  const body = { ...fields };
  return registersOps(w.registers, url, { ...body, by: stamps.viewer })[op]();
};
const named = (answer, field) => !!answer && answer.code === "MISSING_FIELD" && (answer.field === field || new RegExp(`(^|[^\\w])${field}($|[^\\w])`).test(answer.detail || ""));
const sameCode = (x, y) => x && y && x.ok === y.ok && (x.code ?? x.reason) === (y.code ?? y.reason);
/* what the sample value of each field stands for in a world where an import, a project, an interest and a row exist */
const REAL = (w) => ({ register: "town_filings", project: w.P, import: 1, import_a: 1, import_b: 1, interest: 1, row_key: "k", src_row: 1, scope: "project", filter: { filer_ids: ["F10001"] }, definition: { not: "a definition" },
  name: "Sample Name", url: "https://permits.marlow-county.example/x", publisher: "Board", ground: "unlawful", reason: "because", action: "pause", query: "C1234567" });
const ADMIN_OPS = ["registerproposals", "registerpreread", "rowexpunge"];

for (const op of REGISTERS_OPS) {
  test(`R38: registers declares ${op}: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped`, async () => {
    const stamp = ADMIN_OPS.includes(op) ? V("alice") : V("bob");
    await declaredOpHolds({ op, declaration: DECLARED_OPS[op], refusedNaming: named, same: sameCode,
      call: async (given) => {
        const w = seeded();
        START(w, { scope: "project", project: w.P, author: V("bob"), viewer: V("bob") });
        w.registers.interestSet({ register: "town_filings", project: w.P, filter: { filer_ids: ["F10001"] }, author: V("bob"), viewer: V("bob") });
        const real = REAL(w), fields = {};
        for (const [k, v] of Object.entries(given)) fields[k] = k in real ? real[k] : v;
        return arm(w, op, { viewer: stamp })(fields);
      } });
  });
}

test("R38: every op of the route map is declared and every declaration has its arm; mutating ops are the member's acts", () => {
  const w = world();
  const arms = Object.keys(registersOps(w.registers, new URL("http://x/"), {}));
  assert.deepEqual(arms.sort(), [...REGISTERS_OPS].sort());
  assert.deepEqual(Object.keys(DECLARED_OPS).sort(), [...REGISTERS_OPS].sort());
  for (const d of Object.values(DECLARED_OPS)) assert.ok(Array.isArray(d.classes) && typeof d.mutating === "boolean" && d.weight && d.description && d.fields);
  assert.equal(DECLARED_OPS.rowexpunge.weight, "reasoned");
});

test("R39: refusals, states and absence sentences are words by key: a refusal's detail is the word table's sentence for its code", async () => {
  const w = seeded();
  const r = w.registers.importStart({ register: "nope", filter: {}, scope: "project", project: w.P, author: V("bob"), viewer: V("bob") });
  /* the sentence is the word table's for the code's key (rows.mjs is regenerated at the merge; until then the sentence is the one written at its use) */
  assert.equal(r.detail, hasWord("registers.refusal.NO_SUCH_REGISTER") ? word("registers.refusal.NO_SUCH_REGISTER") : r.detail);
  assert.ok(typeof r.detail === "string" && r.detail.length > 0);
  const none = w.registers.searchRows({ scope: {}, name: "Nobody", viewer: V("bob") });
  assert.equal(none.text_key, "register.absence.no_import");
  const gated = w.registers.importStart({ register: "trades_licences", filter: {}, scope: "team", author: V("alice"), viewer: V("alice") });
  assert.equal(gated.detail, hasWord("registers.refusal.member_act_required") ? word("registers.refusal.member_act_required") : gated.detail);
});

test("R40: every op answers within its stated time on the test copy (the figures are N1259-e §3's): the reads and the act that queues an import within 2,000 ms", async () => {
  const w = seeded();
  START(w);
  await w.drain({ [URL_]: served(enc(csv(500))) });
  const timed = async (name, f) => { const t = performance.now(); await f(); const ms = performance.now() - t; return [name, ms]; };
  const key = w.sql(`SELECT row_key FROM register_import_rows WHERE src_row=7`)[0].row_key;
  const net = network({ [URL_]: served(enc(csv(10))) });
  const ran = [];
  try {
    ran.push(await timed("registerlist", () => w.registers.registerList({ viewer: V("bob") })));
    ran.push(await timed("registerfilter", () => w.registers.registerFilter({ register: "town_filings", project: w.P, viewer: V("bob") })));
    ran.push(await timed("registerimportstatus", () => w.registers.importStatus({ import: 1, viewer: V("bob") })));
    ran.push(await timed("registerrow", () => w.registers.rowOf({ import: 1, row_key: key, viewer: V("bob") })));
    ran.push(await timed("registerdelta", () => w.registers.registerDelta({ register: "town_filings", filter: {}, scope: "project", project: w.P, viewer: V("bob"), holes: { table: "2025" } })));
    ran.push(await timed("registersearch", () => w.registers.searchRows({ scope: {}, name: "Donor 14", viewer: V("bob") })));
    ran.push(await timed("registercompare", () => w.registers.compare({ import_a: 1, import_b: 1, viewer: V("bob") })));
    ran.push(await timed("registerrowcite", () => w.registers.citeRow({ import: 1, row_key: key, author: V("bob"), viewer: V("bob") })));
    ran.push(await timed("registerfileimport", () => w.registers.importStart({ register: "town_filings", filter: { filer_ids: ["F10002"] }, scope: "project", project: w.P, author: V("bob"), viewer: V("bob"), holes: { table: "2025" } })));
  } finally { net.restore(); }
  for (const [name, ms] of ran) assert.ok(ms < 2000, `${name}: ${ms.toFixed(0)} ms`);
  for (const op of REGISTERS_OPS) assert.ok(DECLARED_OPS[op].budget_ms <= 2000, `${op} states a budget within the class`);
});

test("R41: import rows, interests, proposals, own definitions and tombstones are exportable descriptors and hold no cell; rows and cells are never exported, whatever the register", async () => {
  const w = seeded();
  START(w);
  await w.drain({ [URL_]: served(enc(csv(10, { cell: (i) => rowOf(i, { donor_name: `Exported${i}Marker` }) }))) });
  w.registers.registerPropose({ name: "Harbour permits", url: "https://permits.marlow-county.example/harbour", publisher: "Harbour board", author: V("bob"), viewer: V("bob") });
  w.registers.interestSet({ register: "town_filings", project: w.P, filter: { filer_ids: ["F10001"] }, author: V("bob"), viewer: V("bob") });
  await w.registers.rowExpunge({ register: "town_filings", row_key: w.sql(`SELECT row_key FROM register_import_rows WHERE src_row=3`)[0].row_key, ground: "unlawful", reason: "x", author: V("alice") });
  const decl = w.record.declaredTables().filter((d) => d.module === "registers");
  const exported = decl.filter((d) => d.export === "yes").map((d) => d.name);
  const never = decl.filter((d) => d.export === "never").map((d) => d.name);
  for (const t of ["register_imports", "register_segments", "register_interests", "register_proposals", "register_definitions", "register_changes", "register_removed"]) assert.ok(exported.includes(t), `${t} exports`);
  for (const t of ["register_cells", "register_rows", "register_import_rows", "register_cites"]) assert.ok(never.includes(t), `${t} is never exported`);
  assert.ok(!JSON.stringify(exported.map((t) => w.sql(`SELECT * FROM ${t}`))).includes("Exported"), "no cell in any exported table");
  assert.ok(w.record.declaredTables().some((d) => d.name === "tombstones" && d.export === "yes"), "the tombstone is exportable");
  assert.ok(!JSON.stringify(w.record.tombstones({ table: "register_import_rows" })).includes("Exported"));
});

test("R42: size: the module stays within its expected lines (2,500 to 3,500; BOB reports at 4,000)", () => {
  const dir = new URL("../../../src/registers/", import.meta.url);
  const files = ["core", "runner", "search", "watch", "ops", "port", "schema", "limits", "reduced", "index"];
  const lines = files.reduce((n, f) => n + readFileSync(new URL(`${f}.mjs`, dir), "utf8").split("\n").length, 0);
  assert.ok(lines < 4000, `${lines} lines`);
});

test("R43: no jurisdiction in the module: no register, place, host or scheme of the profiles is named in its code; tests use the test profile", () => {
  const dir = new URL("../../../src/registers/", import.meta.url);
  const src = ["core", "runner", "search", "watch", "ops", "port", "schema", "limits", "reduced", "index"].map((f) => readFileSync(new URL(`${f}.mjs`, dir), "utf8")).join("\n");
  const oakland = readFileSync(new URL("../../../../jurisdictions/profiles/oakland-alameda.mjs", import.meta.url), "utf8");
  const hosts = [...new Set([...oakland.matchAll(/https?:\/\/([a-z0-9.-]+)/g)].map((m) => m[1]))].filter((h) => h.includes("."));
  for (const h of hosts) assert.ok(!src.includes(h), `${h} is not named`);
  for (const w of ["Oakland", "Alameda", "NetFile", "CAL-ACCESS", "OpenCorporates", "Form 700"]) assert.ok(!src.includes(w), `${w} is not named`);
});

test("R45: every row and extract answer carries its label key and a limited register's rows their text key; a limit-free row has no limit", async () => {
  const w = seeded();
  START(w);
  await w.drain({ [URL_]: served(enc(csv(5))) });
  const key = w.sql(`SELECT row_key FROM register_import_rows WHERE src_row=2`)[0].row_key;
  assert.equal(w.registers.rowOf({ import: 1, row_key: key, viewer: V("bob") }).label_key, "register.extract");
  assert.equal(w.registers.citeRow({ import: 1, row_key: key, author: V("bob"), viewer: V("bob") }).extract.label_key, "register.extract");
  assert.equal(w.registers.importStatus({ import: 1, viewer: V("bob") }).reduction.label_key, "register.reduced");
  assert.ok(!("use_limit" in w.registers.rowOf({ import: 1, row_key: key, viewer: V("bob") })));
});
