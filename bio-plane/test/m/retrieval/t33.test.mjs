/* retrieval: T33's fields, the local day, the saved query and the declared tables (R68–R71, T33-40), at the interface.
 *
 * The owners' tables the fields' views read (`fields.mjs`) are their owners' own schemas: entities' `entities` and
 * `resolutions` and extraction's `reading_refs` (the fixture); events' `event_attestations` and `event_when_cache`,
 * money's `money_facts` and `money_withdrawals`, duties' `duties` (here), written as their owners write them. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, V, MACHINE } from "./fixture.mjs";
import { FIELD_VIEWS, TERM_FIELDS, RETRIEVAL_TABLES, SAVED_LIMIT_DEFAULT } from "../../../src/retrieval/index.mjs";
import * as QL from "../../../src/query.mjs";
import { FIELDS, IDS_MAX } from "../../../src/query.mjs";
import { EVENTS_SCHEMA } from "../../../src/events/index.mjs";
import { MONEY_SCHEMA } from "../../../src/money/index.mjs";
import { DUTIES_SCHEMA } from "../../../src/duties/index.mjs";

/* INFO-1 (capture c1), INFO-2 (c2), INFO-3 (no capture), and a project only ann sees (c3). c1 names a person and an
   office and cites a code section; c2 an institution; c3 the same person and section. */
function corpus({ owners = true, deps = {} } = {}) {
  const w = world({ deps });
  const c1 = w.cap("c1", "council minutes"), c2 = w.cap("c2", "a budget"), c3 = w.cap("c3", "a secret memo");
  w.doc("INFO-1", { title: "Minutes" }, { captures: [c1] });
  w.doc("INFO-2", { title: "Budget" }, { captures: [c2] });
  w.doc("INFO-3", { title: "Note" });
  const proj = w.project("Hidden", "ann", { captures: [c3] });
  const ent = (id, kind) => w.st.sql.exec(`INSERT INTO entities (entity_id, kind, label, at) VALUES (?,?,?,?)`, id, kind, id, "2026-01-01T00:00:00Z");
  ent("ENT-P", "person"); ent("ENT-O", "office"); ent("ENT-X", "institution");
  const res = (c, b, e) => w.st.sql.exec(`INSERT INTO resolutions (capture_sha, bundle_id, ref, entity_id, grade, method, established)
                                          VALUES (?,?,?,?, 'B', 'alias', 1)`, c.sha, b, `ref ${e}`, e);
  res(c1, "INFO-1", "ENT-P"); res(c1, "INFO-1", "ENT-O"); res(c2, "INFO-2", "ENT-X"); res(c3, proj, "ENT-P");
  const ref = (c, b, r, k) => w.st.sql.exec(`INSERT INTO reading_refs (capture_sha, bundle_id, ref, ref_kind, ref_key) VALUES (?,?,?,?,?)`,
                                            c.sha, b, r, "cite", k);
  ref(c1, "INFO-1", "Gov. Code § 54950", "gov 54950"); ref(c3, proj, "Gov. Code § 54950", "gov 54950");
  if (owners) addOwners(w, { c1, c2, c3 });
  return { w, proj, c1, c2, c3 };
}

function addOwners(w, { c1, c2, c3 }) {
  w.st.db.exec(EVENTS_SCHEMA);
  w.st.db.exec(MONEY_SCHEMA);
  w.st.db.exec(DUTIES_SCHEMA);
  const x = (q, ...a) => w.st.sql.exec(q, ...a);
  const T = "2026-01-01T00:00:00Z";
  const att = (ev, c) => x(`INSERT INTO event_attestations (event_id, form, capture_sha, extent, at) VALUES (?, 'extent', ?, '{}', ?)`, ev, c.sha, T);
  att("EVT-1", c2); att("EVT-2", c3);
  x(`INSERT INTO event_attestations (event_id, form, serves, statement, at) VALUES ('relation:EVT-1', 'testimony', 'relation', 'said so', ?)`, T);
  x(`INSERT INTO event_when_cache (event_id, start, end, precision, zone) VALUES ('EVT-1', '2026-03-15T17:00:00Z', NULL, 'minute', 'UTC')`);
  x(`INSERT INTO event_when_cache (event_id, start, end, precision, zone) VALUES ('EVT-2', '2026-04-01T17:00:00Z', NULL, 'minute', 'UTC')`);
  const fact = (id, c, kind, phase, stage, basis, from, to, fe, te, ff) => x(
    `INSERT INTO money_facts (fact_id, amount, sign, precision, as_read, currency, kind, phase, stage, basis, period_from, period_to,
       period_precision, period_zone, period_start, period_end, from_entity, to_entity, from_fund, source_capture_sha, method, at)
     VALUES (?, '10.00', '+', 'exact', '$10', 'USD', ?, ?, ?, ?, ?, ?, 'day', 'UTC', ?, ?, ?, ?, ?, ?, 'typed', ?)`,
    id, kind, phase, stage, basis, from, to, from, to, fe, te, ff, c.sha, T);
  fact("MNY-1", c1, "expenditure", "actual", "paid", "cash", "2025-07-01", "2026-06-30", "ENT-X", "ENT-P", "FUND-1");
  fact("MNY-2", c2, "revenue", "adopted", null, "modified accrual", "2024-07-01", "2025-06-30", "ENT-O", null, "FUND-2");
  x(`INSERT INTO money_withdrawals (fact_id, reason, at) VALUES ('MNY-2', 'misread', ?)`, T);
  fact("MNY-3", c3, "expenditure", "actual", "paid", "cash", "2025-07-01", "2026-06-30", "ENT-X", "ENT-P", "FUND-1");
  const duty = (id, obligor, obligee, c, withdrawn = null) => x(
    `INSERT INTO duties (duty_id, modality, obligor, obligee, arising_in, version, adopted_by, adopted_at, clause, withdrawn_at)
     VALUES (?, 'duty', ?, ?, ?, 1, 'member:ann', ?, 'clause 1', ?)`, id, obligor, obligee, c.sha, T, withdrawn);
  duty("DUT-1", "ENT-X", "ENT-P", c2);
  duty("DUT-2", "ENT-O", "ENT-X", c1, T);
}

const ids = (w, q, viewer) => w.retrieval.search({ q, viewer, mode: "ids", facets: false }).ids.slice().sort();
const t33 = new Map(FIELD_VIEWS.map((v) => [v.field, v]));

test("R68: person, post and cites are read through their owners' read contracts (entities' resolutions and kinds, extraction's reading_refs), many values to a bundle, gated: a hidden bundle never answers and no count includes it", () => {
  const { w, proj } = corpus();
  for (const f of ["person", "post", "cites"]) {
    assert.ok(Object.prototype.hasOwnProperty.call(FIELDS, f), `query-language holds ${f} (its R28)`);
    assert.deepEqual([w.retrieval.searchFields().fields[f].available, w.retrieval.searchFields().fields[f].route],
                     [true, "read contract"], f);
  }
  const cases = [["person:ENT-P", ["INFO-1"], ["INFO-1", proj]], ["post:ENT-O", ["INFO-1"], ["INFO-1"]],
                 ["person:ENT-O", [], []], ["post:ENT-P", [], []], ["person:ENT-X", [], []],
                 ['cites:"gov 54950"', ["INFO-1"], ["INFO-1", proj]], ['cites:"Gov. Code § 54950"', ["INFO-1"], ["INFO-1", proj]],
                 ["person:ENT-P post:ENT-O", ["INFO-1"], ["INFO-1"]], ["-person:ENT-P", ["INFO-2", "INFO-3"], ["INFO-2", "INFO-3"]]];
  for (const [q, vera, ann] of cases) {
    assert.deepEqual(ids(w, q, V("vera")), vera.slice().sort(), `${q} for vera`);
    assert.deepEqual(ids(w, q, V("ann")), ann.slice().sort(), `${q} for ann`);
    const c = w.retrieval.search({ q, viewer: V("vera"), mode: "count" });
    assert.equal(c.total, vera.length, `${q}: vera's total counts only what she sees`);
  }
  /* A page carries each bundle once, however many values it holds. */
  const page = w.retrieval.search({ q: "person:ENT-P", viewer: V("ann") });
  assert.deepEqual(page.hits.map((h) => h.bundle_id).sort(), ["INFO-1", proj].sort());
  /* An absent viewer sees nothing through any of them. */
  for (const q of ["person:ENT-P", "post:ENT-O", 'cites:"gov 54950"']) assert.deepEqual(ids(w, q, null), []);
});

test("R68: event and occurred, the money fields, obligor and owed_to are each available exactly when their owner's tables are held; until then the field is named to no relation, so query-language drops it with its warning and searchFields says it is unavailable", () => {
  const { w, c1, c2, c3 } = corpus({ owners: false });
  const later = ["event", "occurred", "kind", "phase", "stage", "basis", "period", "fund", "party", "obligor", "owed_to"];
  for (const f of later) {
    assert.deepEqual([w.retrieval.searchFields().fields[f].available, w.retrieval.searchFields().fields[f].route], [false, null], f);
    const s = w.retrieval.search({ q: `${f}:x`, viewer: V("vera"), mode: "ids", facets: false });
    assert.ok(s.query.warnings.some((m) => m.includes(f)), `${f}: the compiler says it dropped the term`);
    assert.equal(s.total, 3, `${f}: a dropped term widens the answer, never narrows it to nothing`);
  }
  addOwners(w, { c1, c2, c3 });
  for (const f of later)
    assert.deepEqual([w.retrieval.searchFields().fields[f].available, w.retrieval.searchFields().fields[f].route],
                     [true, "read contract"], f);
});

test("R68: event and occurred read events' attestations through the captures a bundle registers; the money fields read the facts a bundle's captures are the source of, a withdrawn fact left out; obligor and owed_to the duties arising in them; every answer gated", () => {
  const { w, proj } = corpus();
  const cases = [
    ["event:EVT-1", ["INFO-2"], ["INFO-2"]], ["event:EVT-2", [], [proj]],
    ["occurred:>=2026-03-01T00:00:00Z", ["INFO-2"], ["INFO-2", proj]], ["occurred:<2026-03-20T00:00:00Z", ["INFO-2"], ["INFO-2"]],
    ["kind:expenditure", ["INFO-1"], ["INFO-1", proj]], ["kind:revenue", [], []],
    ["phase:actual", ["INFO-1"], ["INFO-1", proj]], ["stage:paid", ["INFO-1"], ["INFO-1", proj]],
    ["basis:cash", ["INFO-1"], ["INFO-1", proj]], ['basis:"modified accrual"', [], []], ["phase:adopted", [], []],
    ["fund:FUND-1", ["INFO-1"], ["INFO-1", proj]], ["fund:FUND-2", [], []],
    ["party:ENT-P", ["INFO-1"], ["INFO-1", proj]], ["party:ENT-X", ["INFO-1"], ["INFO-1", proj]], ["party:ENT-O", [], []],
    ["obligor:ENT-X", ["INFO-2"], ["INFO-2"]], ["owed_to:ENT-P", ["INFO-2"], ["INFO-2"]], ["owed_to:ENT-X", [], []], ["obligor:ENT-O", [], []],
  ];
  for (const [q, vera, ann] of cases) {
    assert.deepEqual(ids(w, q, V("vera")), vera.slice().sort(), `${q} for vera`);
    assert.deepEqual(ids(w, q, V("ann")), ann.slice().sort(), `${q} for ann`);
    assert.equal(w.retrieval.search({ q, viewer: V("vera"), mode: "count" }).total, vera.length, `${q}: vera's count`);
  }
  assert.ok(ids(w, "period:2025-07-01", V("ann")).includes("INFO-1"), "period reads the fact's period");
});

test("R68: standard and holder are projected here from the providers the composition root hands (the owners' own rules), written in the promotion's transaction, cleared with the projection and rewritten by reproject; with no provider the field is unavailable, never an empty relation", () => {
  const calls = [];
  const terms = {
    standard: ({ bundleId, files }) => { calls.push(bundleId); const md = files.find((f) => f.path === "bundle.md").text;
                                         return /Minutes/.test(md) ? ["STD-2026-ralph", "STD-2026-cpra"] : []; },
    holder: ({ bundleId }) => (bundleId === "INFO-2" ? ["ENT-P", "ENT-P", "", 7] : bundleId === "INFO-3" ? (() => { throw new Error("x"); })() : null),
  };
  const { w, proj } = corpus({ deps: { terms } });
  for (const f of TERM_FIELDS)
    assert.deepEqual([w.retrieval.searchFields().fields[f].available, w.retrieval.searchFields().fields[f].route], [true, "projected"], f);
  assert.deepEqual(ids(w, "standard:STD-2026-ralph", V("vera")), ["INFO-1"]);
  assert.deepEqual(ids(w, "standard:STD-2026-cpra", V("vera")), ["INFO-1"]);
  assert.deepEqual(ids(w, "holder:ENT-P", V("vera")), ["INFO-2"]);
  assert.equal(w.row(`SELECT COUNT(*) n FROM bundle_terms WHERE bundle_id='INFO-2'`).n, 1, "a value once; a non-string or empty value never");
  assert.equal(w.row(`SELECT COUNT(*) n FROM bundle_terms WHERE bundle_id='INFO-3'`).n, 0, "a provider that throws gives nothing");
  assert.ok(calls.includes(proj), "every promotion is projected");
  /* Cleared with the projection, and back with reproject (R3). */
  w.retrieval.projectionClear({ bundleId: "INFO-1" });
  assert.deepEqual(ids(w, "standard:STD-2026-ralph", V("vera")), []);
  w.retrieval.reproject({});
  assert.deepEqual(ids(w, "standard:STD-2026-ralph", V("vera")), ["INFO-1"]);
  /* A revision replaces the bundle's values. */
  w.doc("INFO-1", { title: "Agenda" }, { captures: [w.cap("c1", "council minutes")] });
  assert.deepEqual(ids(w, "standard:STD-2026-ralph", V("vera")), []);
  /* No provider: unavailable, dropped by the compiler. */
  const { w: bare } = corpus();
  for (const f of TERM_FIELDS) {
    assert.equal(bare.retrieval.searchFields().fields[f].available, false, f);
    assert.equal(bare.retrieval.search({ q: `${f}:STD-1`, viewer: V("vera"), mode: "count" }).total, 3, f);
  }
  assert.equal(bare.count("bundle_terms"), 0, "nothing is written without a provider");
});

test("R30, R68: a promotion that fails leaves the projected values unchanged", () => {
  const terms = { standard: ({ bundleId }) => [`STD-for-${bundleId}`] };
  const { w } = corpus({ deps: { terms } });
  const before = w.rows(`SELECT * FROM bundle_terms ORDER BY bundle_id, field, value`);
  const head = w.row(`SELECT bundle_sha FROM bundles WHERE bundle_id='INFO-1'`).bundle_sha;
  const r = w.promotion.promote({ bundleId: "INFO-1", base: "0".repeat(64), snapKey: "kx", author: "member:ann",
                                  files: [{ path: "bundle.md", text: "---\nnot: [closed\n---\n" }], meta: { object_type: "information" } });
  assert.equal(r.ok, false);
  assert.equal(w.row(`SELECT bundle_sha FROM bundles WHERE bundle_id='INFO-1'`).bundle_sha, head);
  assert.deepEqual(w.rows(`SELECT * FROM bundle_terms ORDER BY bundle_id, field, value`), before);
});

test("R69: every compile is handed the zone that governs: local-facts' governing value for the active profiles' time_zone, else the profiles' own (jurisdictions R41), else none", () => {
  const { w } = corpus();
  assert.equal(w.retrieval.zone(), null, "no active profile: no zone");
  w.record.setSetting("jurisdiction_profiles", ["test-port-ellery"], "member:ann");
  assert.equal(w.retrieval.zone(), "America/Halifax", "the profile's zone, through local-facts' governing value");
  /* A local correction governs (local-facts R2). */
  const lf = { factStatus: ({ path }) => ({ ok: true, path, governs: { value: path === "test-port-ellery/time_zone" ? "America/Chicago" : null } }) };
  const { w: w2 } = corpus({ deps: { localFacts: lf } });
  w2.record.setSetting("jurisdiction_profiles", ["test-port-ellery"], "member:ann");
  assert.equal(w2.retrieval.zone(), "America/Chicago");
  /* local-facts answering nothing: the profiles' own zone. */
  const { w: w3 } = corpus({ deps: { localFacts: { factStatus: () => ({ ok: true, governs: null }) } } });
  w3.record.setSetting("jurisdiction_profiles", ["test-port-ellery"], "member:ann");
  assert.equal(w3.retrieval.zone(), "America/Halifax");
  /* Neither: none. */
  const { w: w4 } = corpus({ deps: { localFacts: null, combine: () => ({ ok: false }) } });
  w4.record.setSetting("jurisdiction_profiles", ["test-port-ellery"], "member:ann");
  assert.equal(w4.retrieval.zone(), null);
  /* Two profiles governing different zones govern none. */
  const two = { factStatus: ({ path }) => ({ ok: true, governs: { value: path.startsWith("a/") ? "America/Chicago" : "Europe/Paris" } }) };
  const { w: w5 } = corpus({ deps: { localFacts: two } });
  w5.record.setSetting("jurisdiction_profiles", ["a", "b"], "member:ann");
  assert.equal(w5.retrieval.zone(), null);
});

test("R69: a date term is read as a local day in the governing zone (query-language R27), and with no zone it is dropped with the compiler's warning, carried in the answer", () => {
  const { w } = corpus();
  const created = w.row(`SELECT created FROM bundles WHERE bundle_id='INFO-1'`).created;
  const localDay = (zone) => new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(created));
  const none = w.retrieval.search({ q: `created:${localDay("America/Halifax")}`, viewer: V("vera"), mode: "ids", facets: false });
  assert.equal(none.total, 3, "no zone: the date term is dropped, so the answer widens");
  assert.ok(none.query.warnings.some((m) => /zone/i.test(m)), "and the answer says why");
  w.record.setSetting("jurisdiction_profiles", ["test-port-ellery"], "member:ann");
  const day = localDay("America/Halifax");
  const hit = w.retrieval.search({ q: `created:${day}`, viewer: V("vera"), mode: "ids", facets: false });
  assert.ok(hit.ids.includes("INFO-1"), `created on ${day} in Halifax`);
  const other = new Date(Date.parse(`${day}T12:00:00Z`) + 2 * 86400000).toISOString().slice(0, 10);
  assert.ok(!w.retrieval.search({ q: `created:${other}`, viewer: V("vera"), mode: "ids", facets: false }).ids.includes("INFO-1"));
});

test("R70: runSaved runs a saved form for its owner under the owner's sight now: the ids in the compiler's order, at most limit, the gated total, truncated, the set's digest, the instant; a changed answer changes the digest", () => {
  const { w, proj } = corpus();
  const form = { v: 1, q: "person:ENT-P OR type:information", implicitOp: "and", sort: null, dir: null };
  const run = w.retrieval.runSaved({ form, owner: V("ann"), viewer: V("ann") });
  const order = w.retrieval.search({ q: form.q, viewer: V("ann"), mode: "ids", facets: false }).ids;
  assert.equal(run.ok, true);
  assert.deepEqual(run.ids, order, "the compiler's order, the owner's sight (her project included)");
  assert.ok(run.ids.includes(proj));
  assert.deepEqual([run.total, run.truncated, run.limit], [order.length, false, SAVED_LIMIT_DEFAULT]);
  assert.equal(typeof run.digest, "string");
  assert.equal(run.at, new Date(w.clock.now).toISOString());
  /* The same answer, the same digest; at most `limit`, the digest still the whole set's. */
  const cut = w.retrieval.runSaved({ form, owner: V("ann"), viewer: V("ann"), limit: 2 });
  assert.deepEqual([cut.ids, cut.total, cut.truncated, cut.limit, cut.digest], [order.slice(0, 2), order.length, true, 2, run.digest]);
  assert.equal(w.retrieval.runSaved({ form, owner: V("ann"), viewer: V("ann"), limit: 10 ** 9 }).limit, IDS_MAX);
  /* A swap at a constant count changes the digest. */
  w.st.sql.exec(`UPDATE resolutions SET entity_id='ENT-X' WHERE bundle_id=?`, proj);
  w.doc("INFO-9", {});
  const again = w.retrieval.runSaved({ form, owner: V("ann"), viewer: V("ann") });
  assert.equal(again.total, run.total);
  assert.notEqual(again.digest, run.digest);
});

test("R70: anyone but the owner (another member, an administrator, a machine, no one) is refused NOT_YOUR_QUERY exactly as an absent query is, and nothing runs; a run writes nothing; a form that does not compile as saved is refused with query-language's refusal", () => {
  const w = world({ admins: ["root"] });
  w.doc("INFO-1", {});
  const form = { v: 1, q: "type:information", implicitOp: "and", sort: null, dir: null };
  const absent = w.retrieval.runSaved({ form: null, owner: V("ann"), viewer: V("ann") });
  assert.equal(absent.reason, "NOT_YOUR_QUERY");
  for (const viewer of [V("vera"), V("root"), MACHINE, null, undefined, ""])
    assert.deepEqual(w.retrieval.runSaved({ form, owner: V("ann"), viewer }), absent, String(viewer));
  for (const f of [{}, { v: 2, q: "x" }, { v: 1 }, "type:information", [form]])
    assert.deepEqual(w.retrieval.runSaved({ form: f, owner: V("ann"), viewer: V("ann") }), absent);
  /* Nothing written by a run. */
  const tables = w.rows(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%fts%'`).map((r) => r.name);
  const snap = () => tables.map((t) => [t, w.count(t)]);
  const before = snap();
  assert.equal(w.retrieval.runSaved({ form, owner: V("ann"), viewer: V("ann") }).ok, true);
  assert.deepEqual(snap(), before);
  /* query-language's refusal, as it gives it. */
  const bad = { v: 1, q: "nosuchfield:x", implicitOp: "and", sort: null, dir: null };
  const refusal = QL.savedForm({ q: bad.q, implicitOp: bad.implicitOp, sort: bad.sort, dir: bad.dir });
  assert.equal(refusal.ok, false);
  assert.deepEqual(w.retrieval.runSaved({ form: bad, owner: V("ann"), viewer: V("ann") }), refusal);
});

test("R71: every table is declared explicitly with its classes: the projection, the projected values and the text index derived-rebuildable and seen with their bundle, the selections stored and seen by their owner; record-core's rebuild-and-compare holds the derived ones equal, and finds a divergence", () => {
  const terms = { standard: ({ bundleId }) => [`STD-for-${bundleId}`] };
  const { w } = corpus({ deps: { terms } });
  const mine = w.record.declaredTables().filter((d) => d.module === "retrieval");
  assert.deepEqual(mine.map((d) => d.name).sort(), [...RETRIEVAL_TABLES].sort());
  const cls = (d) => [d.purge, d.expunge, d.export, d.sight, d.derive, d.version_chain];
  const by = Object.fromEntries(mine.map((d) => [d.name, d]));
  for (const t of ["bundle_projection", "bundles_fts", "bundle_terms"])
    assert.deepEqual(cls(by[t]), ["clear", "none", "admin-only", "bundle", "derived-rebuildable", false], t);
  for (const t of ["selections", "selection_items"])
    assert.deepEqual(cls(by[t]), ["clear", "none", "admin-only", "owner", "stored", false], t);
  for (const t of ["bundle_projection", "bundles_fts", "bundle_terms"]) {
    assert.deepEqual(w.record.rebuildAndCompare("retrieval", t), { same: true }, t);
    assert.deepEqual(w.record.rebuildAndCompare("retrieval", t, { bundle_id: "INFO-1" }), { same: true }, `${t} for one bundle`);
  }
  /* Byte for byte: a tampered row is found, and rebuilding restores it with the key the index is aligned on. */
  w.st.sql.exec(`UPDATE bundle_projection SET schema_id='tampered' WHERE bundle_id='INFO-2'`);
  w.st.sql.exec(`UPDATE bundles_fts SET body='tampered' WHERE bundle_id='INFO-2'`);
  w.st.sql.exec(`DELETE FROM bundle_terms WHERE bundle_id='INFO-2'`);
  for (const t of ["bundle_projection", "bundles_fts", "bundle_terms"]) {
    const r = w.record.rebuildAndCompare("retrieval", t);
    assert.equal(r.same, false, t);
    assert.equal(r.first.key.bundle_id, "INFO-2", t);
  }
  const key = w.row(`SELECT fts_id FROM bundle_projection WHERE bundle_id='INFO-2'`).fts_id;
  for (const t of ["bundle_projection", "bundles_fts", "bundle_terms"]) w.record.rebuildDerived("retrieval", t);
  for (const t of ["bundle_projection", "bundles_fts", "bundle_terms"])
    assert.deepEqual(w.record.rebuildAndCompare("retrieval", t), { same: true }, `${t} rebuilt`);
  assert.equal(w.row(`SELECT rowid FROM bundles_fts WHERE bundle_id='INFO-2'`).rowid, key, "the index keeps its key");
  assert.equal(w.retrieval.searchIndexCheck({ viewer: MACHINE }).ok, true);
  /* The selections are cleared only by the whole-store purge (R33). */
  assert.equal(w.record.purge({ bundleId: "INFO-1" }).removed.bundle_terms, 1);
});

test("R68: money's closed words reach the compiler with every compile this module runs (K1563 (1), while money is injected): a word in money's list filters, one outside it is dropped with the warning naming the list", () => {
  const money = { kinds: () => ["revenue", "expenditure"], phases: () => ["proposed", "adopted", "adjusted", "actual"],
                  stages: () => ["encumbered", "incurred", "paid", "assessed", "collected"],
                  bases: () => ["budgetary", "cash", "modified accrual", "accrual", "undetermined"] };
  const { w } = corpus({ deps: { money } });
  assert.deepEqual(ids(w, "kind:expenditure", V("vera")), ["INFO-1"]);
  const s = w.retrieval.search({ q: "kind:bogus", viewer: V("vera"), mode: "ids", facets: false });
  assert.equal(s.total, 3, "a dropped word widens the answer");
  assert.ok(s.query.warnings.some((m) => m.includes("bogus") && m.includes("expenditure")), "the warning names money's list");
  const run = w.retrieval.runSaved({ form: { v: 1, q: "kind:bogus", implicitOp: "and", sort: null, dir: null },
                                     owner: V("ann"), viewer: V("ann") });
  assert.equal(run.ok, false, "a saved form that drops a word does not run");
});
