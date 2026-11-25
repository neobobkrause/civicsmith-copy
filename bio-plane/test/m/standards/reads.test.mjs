/* standards: the reverse index (R21), the citation resolver and the connection owner delegated to law-relations (R48), the move's listener
   order (R29) and the tables' declarations (R14, R16) — T33-31. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { seeded, world, V, MACHINE, REASON } from "./fixture.mjs";
import { STANDARDS_TABLES, CONNECTION_KINDS, CONNECTION_OWNER, IN_FORCE_METHOD, connectionOwnerOf, standardsOps }
  from "../../../src/standards/index.mjs";
import { ownerConformance, createRegistry, derivedId, kindOf as defaultKindOf, neighbours as defaultNeighbours }
  from "../../../src/connection-grammar/index.mjs";
import { MODULE_ORDER } from "../../../src/membership/index.mjs";

const EV = (s) => `EVT-2026-${s.padEnd(16, "0").slice(0, 16)}`;
const KEY = "/eli/xx-port-ellery/selectboard/12";

test("R21 standardsFor: for a held standard (or an instrument key) every document whose reading cites it, by its recognised key (a code section, or a cite read through R3's patterns) or its cite, each saying how; for a document, the held standards its readings cite; a document the viewer may not see is neither answered nor counted; limit clamped 1–500 (default 100), truncated by reading one past", () => {
  const w = seeded();
  const std = w.declare({ cite: "PEBL § 12" }).id;
  const other = w.declare({ cite: "Some Code § 4" }).id;
  const doc = (name, refs, project = null) => {
    const p = w.passage(name);
    if (project) w.st.sql.exec(`UPDATE bundles SET project=? WHERE bundle_id=?`, project, p.bundleId);
    for (const r of refs) w.ref(p.capSha, p.bundleId, r);
    return p;
  };
  const byCode = doc("bycode", [{ ref: "code_section:pebl:12", ref_kind: "code_section", ref_key: "pebl:12", label: "P.E. Bylaws 12" }]);
  const byCite = doc("bycite", [{ ref: "instrument:x", ref_kind: "instrument", ref_key: "x", label: "PEBL § 12" }]);
  const byFold = doc("byfold", [{ ref: "law:some", ref_kind: "law", ref_key: "some", label: "some code  § 4" }]);
  doc("near", [{ ref: "code_section:pebl:120", ref_kind: "code_section", ref_key: "pebl:120", label: "P.E. Bylaws 120" }]);
  const P = w.project("Private", "alice");
  const hidden = doc("hidden", [{ ref: "code_section:pebl:12", ref_kind: "code_section", ref_key: "pebl:12", label: "P.E. Bylaws 12" }], P);
  const before = w.snapshot();
  const r = w.s.standardsFor({ target: std, viewer: V("carol") });
  assert.deepEqual(w.snapshot(), before, "it writes nothing");
  assert.deepEqual(r.items.map((i) => [i.capture_sha, i.references[0].how]).sort(),
                   [[byCode.capSha, "code_section"], [byCite.capSha, "instrument_key"]].sort());
  assert.deepEqual([r.of, r.key, r.count, r.truncated], ["standard", KEY, 2, false]);
  assert.equal(w.s.standardsFor({ target: std, viewer: V("alice") }).count, 3, "its participant sees the fenced document");
  assert.deepEqual(w.s.standardsFor({ target: KEY, viewer: V("carol") }).items.map((i) => i.capture_sha).sort(),
                   [byCode.capSha, byCite.capSha].sort(), "by instrument key");
  assert.deepEqual(w.s.standardsFor({ target: other, viewer: V("carol") }).items.map((i) => [i.capture_sha, i.references[0].how]),
                   [[byFold.capSha, "cite"]], "no key: by its cite, folded");
  /* a document: the standards its readings cite */
  const d = w.s.standardsFor({ target: byCode.capSha, viewer: V("carol") });
  assert.deepEqual([d.of, d.items.map((i) => [i.standard, i.references[0].how])], ["document", [[std, "code_section"]]]);
  assert.deepEqual(w.s.standardsFor({ target: byCite.bundleId, viewer: V("carol") }).items.map((i) => i.standard), [std], "by bundle");
  assert.deepEqual(w.s.standardsFor({ target: hidden.capSha, viewer: V("carol") }).items, [], "a hidden document answers nothing");
  assert.match(w.s.standardsFor({ target: hidden.capSha, viewer: V("carol") }).says, /no document you may see/);
  /* the limit */
  for (let i = 0; i < 3; i++) doc(`more${i}`, [{ ref: "code_section:pebl:12", ref_kind: "code_section", ref_key: "pebl:12" }]);
  const one = w.s.standardsFor({ target: std, viewer: V("carol"), limit: 1 });
  assert.deepEqual([one.count, one.limit, one.truncated], [1, 1, true]);
  assert.equal(w.s.standardsFor({ target: std, viewer: V("carol"), limit: 9999 }).limit, 500);
  assert.equal(w.s.standardsFor({ target: std, viewer: V("carol") }).limit, 100);
  assert.equal(w.s.standardsFor({ target: std, viewer: V("carol"), limit: 0 }).limit, 1);
  assert.equal(w.s.standardsFor({ target: "", viewer: V("carol") }).reason, "STANDARD_NO_ID");
  assert.equal(w.s.standardsFor({ target: std, viewer: "nobody" }).reason, "NO_SUCH_STANDARD");
});

test("R48 resolveCourtCitation, delegated to law-relations (its R4), answers verified only when a held capture the viewer may see states the citation (a court standard's text stating volume, reporter and page), naming the capture and extent; otherwise not verified, refusing nothing; with lookup and the keyed service on it adds the service's matches labelled as the service's and never verified; switched off it says so; it writes nothing", async () => {
  const calls = [];
  const lookup = async (store, { text, viewer }) => {
    calls.push({ store, text, viewer });
    if (!store.on) return { ok: false, reason: "KEYED_SERVICE_OFF" };
    return { ok: true, service: "courtlistener", verified: false, label: "the service's answer",
             citations: [{ citation: text, matches: [{ case_name: "A v. B", basis: "service_answer" }], verified: false }] };
  };
  const w = seeded({ citationLookup: lookup, keyedStore: () => ({ on: w.on }) });
  const opinion = w.passage("opinion", { text: "The court so held. Reported at 5 Cal. 4th 100." });
  const std = w.declare({ cite: "Doe v. Roe", kind: "court", issuer: "Supreme Court", text: [opinion.contentId] }).id;
  const P = w.project("Private", "alice");
  const sealed = w.passage("sealed", { text: "See 410 U.S. 113." });
  w.st.sql.exec(`UPDATE content SET bundle_id=? WHERE content_id=?`, P, sealed.contentId);
  w.st.sql.exec(`UPDATE bundles SET project=? WHERE bundle_id=?`, P, sealed.bundleId);
  w.declare({ cite: "X v. Y", kind: "court", issuer: "Supreme Court", text: [sealed.contentId], author: V("alice"), viewer: V("alice") });
  w.declare({ cite: "7 Cal. 4th 7", kind: "court", issuer: "Supreme Court", text: [w.passage("unindexed").contentId] });
  const before = w.snapshot();
  const v = await w.s.resolveCourtCitation({ citation: "5 Cal. 4th 100", viewer: V("carol") });
  assert.deepEqual([v.state, v.verified, v.held.map((h) => [h.standard, h.capture_sha, h.extent.kind])],
                   ["verified", true, [[std, opinion.capSha, "pdf-page"]]]);
  assert.equal(v.lookup, null, "no lookup asked");
  assert.deepEqual((await w.s.resolveCourtCitation({ citation: { volume: 5, reporter: "Cal.", page: 100 }, viewer: V("carol") })).state, "verified",
                   "a citation as id-spaces reads it");
  const no = await w.s.resolveCourtCitation({ citation: "6 Cal. 4th 100", viewer: V("carol") });
  assert.deepEqual([no.ok, no.state, no.verified], [true, "not verified", false], "refusing nothing");
  assert.equal((await w.s.resolveCourtCitation({ citation: "410 U.S. 113", viewer: V("carol") })).state, "not verified", "a capture the viewer may not see");
  assert.equal((await w.s.resolveCourtCitation({ citation: "410 U.S. 113", viewer: V("alice") })).state, "verified");
  assert.match((await w.s.resolveCourtCitation({ citation: "no citation here", viewer: V("carol") })).why, /no court citation/);
  /* the member's own typing of the cite is not a capture: a court standard whose cite alone states it is not verification */
  assert.equal((await w.s.resolveCourtCitation({ citation: "7 Cal. 4th 7", viewer: V("carol") })).state, "not verified");
  /* the keyed lookup */
  w.on = false;
  const off = await w.s.resolveCourtCitation({ citation: "6 Cal. 4th 100", viewer: V("carol"), lookup: true });
  assert.deepEqual([off.state, off.lookup.on, off.lookup.reason], ["not verified", false, "KEYED_SERVICE_OFF"]);
  assert.match(off.lookup.says, /stands without it/);
  w.on = true;
  const on = await w.s.resolveCourtCitation({ citation: "6 Cal. 4th 100", viewer: V("carol"), lookup: true });
  assert.deepEqual([on.state, on.verified, on.lookup.on, on.lookup.verified, on.lookup.citations[0].matches[0].case_name],
                   ["not verified", false, true, false, "A v. B"], "the service's matches never verify");
  assert.equal(calls.at(-1).viewer, V("carol"), "asked with the member viewer (K1551)");
  assert.deepEqual(w.snapshot(), before, "it writes nothing");
});

/* A world for the owner: two statutes related, a court link, a fenced relation, an event provider. */
function ownerWorld() {
  const w = seeded();
  const meeting = w.event({ value: "2022-05-05" }), fenced = w.event({ value: "2022-05-05", fencedTo: "alice" });
  const P = w.project("Private", "alice");
  const t = () => w.passage().contentId;
  const st = [t(), t(), t(), t(), t()];
  const node = w.declare({ cite: "PEBL § 12", text: [st[0]], period: { from: "2010-01-01", to: "2030-12-31" } }).id;
  const inside = w.declare({ cite: "PEBL § 13", text: [st[1]], period: { from: "2010-01-01", to: "2030-12-31" } }).id;
  const open = w.declare({ cite: "PEBL § 14", text: [st[2]], period: { from: "2010-01-01", to: null } }).id;
  const later = w.declare({ cite: "PEBL § 15", text: [st[3]], period: { from: "2023-01-01", to: "2030-12-31" } }).id;
  const ct = t();
  const court = w.declare({ cite: "1 Marlow 1", kind: "court", text: [ct], period: { from: "2015-01-01", to: "2030-12-31" } }).id;
  const rel = (type, from, to, citation, effective, by = "bob") => {
    const r = w.s.lawRelate({ type, from, to, citation, effective, reason: REASON, author: V(by), viewer: V(by) });
    assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
    return r.relation.id;
  };
  const ids = {
    in: rel("refers_to", inside, node, st[1]),
    undetermined: rel("refers_to", open, node, st[2]),
    out: rel("amends", later, node, st[3], "2023-01-01"),
  };
  const link = w.s.courtLink({ type: "interprets", from: court, to: node, citation: ct, reason: REASON, author: V("bob"), viewer: V("bob") });
  ids.link = link.link.id;
  const hidden = w.passage();
  w.st.sql.exec(`UPDATE content SET bundle_id=? WHERE content_id=?`, P, hidden.contentId);
  w.st.sql.exec(`UPDATE bundles SET project=? WHERE bundle_id=?`, P, hidden.bundleId);
  const fencedFrom = w.declare({ cite: "PEBL § 16", text: [hidden.contentId], period: { from: "2010-01-01", to: "2030-12-31" }, author: V("alice"), viewer: V("alice") }).id;
  ids.fenced = rel("defines", fencedFrom, node, hidden.contentId, undefined, "alice");
  const withdrawn = rel("excepts", inside, node, st[1]);
  w.s.lawWithdraw({ relation: withdrawn, reason: "recorded twice", author: V("bob") });
  return { w, node, ids, withdrawn, open, inside, meeting, fenced };
}

test("R48 the module registers once at load as the connection owner `standards` of law-relations' kinds of its law-relation kinds and court links (evidentiary) and \"in force at an event's date\" (derived), each with its members' word; for a standard node, neighbours answers its relations and links valid at `at`, an undetermined one marked so, withdrawn ones not at all, a fenced one only to who may read its passage; the owner-conformance battery passes", () => {
  /* registered at load, in the default registry, with the members' words */
  for (const k of CONNECTION_KINDS) assert.deepEqual(defaultKindOf(k.kind), { owner: CONNECTION_OWNER, word: k.word, class: k.class }, k.kind);
  assert.deepEqual(CONNECTION_KINDS.map((k) => k.class).filter((c) => c === "derived"), ["derived"]);
  assert.ok(CONNECTION_KINDS.every((k) => /^(law_|court_|in_force_at_event$)/.test(k.kind)), "names of its own, never events' amends (K1521)");
  const { w, node, ids } = ownerWorld();
  const reg = connectionOwnerOf(w.s);
  const r = ownerConformance({ ...reg, fixture: { node, at: "2022-06-01T12:00:00Z", in: ids.in, out: ids.out, undetermined: ids.undetermined,
    viewers: { sees: V("alice"), blind: V("carol") }, fenced: ids.fenced, expected: [ids.in, ids.undetermined, ids.link, ids.fenced] } });
  assert.deepEqual(r, { ok: true, failures: [] }, JSON.stringify(r.failures));
  /* the items: shape, grades, evidence */
  const a = w.s.neighbours({ node, at: "2022-06-01T12:00:00Z", viewer: V("carol") });
  const byId = new Map(a.items.map((i) => [i.id, i]));
  assert.deepEqual([...byId.keys()].sort(), [ids.in, ids.undetermined, ids.link].sort());
  assert.deepEqual([byId.get(ids.in).kind, byId.get(ids.link).kind, byId.get(ids.in).grade.assertion], ["law_refers_to", "court_interprets", "D"]);
  assert.match(byId.get(ids.in).grade_why, /lowest grade/);
  assert.ok(byId.get(ids.undetermined).undetermined.why);
  /* before the amendment took effect the amending relation is out too: valid from its effective date */
  assert.ok(!w.s.neighbours({ node, at: "2022-06-01T12:00:00Z", viewer: V("carol") }).items.some((i) => i.id === ids.out));
  assert.ok(w.s.neighbours({ node, at: "2023-06-01T12:00:00Z", viewer: V("carol") }).items.some((i) => i.id === ids.out));
  /* kinds asked, a missing viewer, the registry's own read through the module's load registration */
  assert.deepEqual(w.s.neighbours({ node, at: "2024-06-01T12:00:00Z", viewer: V("carol"), kinds: ["court_interprets"] }).items.map((i) => i.id), [ids.link]);
  assert.equal(w.s.neighbours({ node, at: "2024-06-01T12:00:00Z" }).refused, "VIEWER_MISSING");
  const via = defaultNeighbours({ owner: CONNECTION_OWNER, node, at: "2022-06-01T12:00:00Z", viewer: V("carol"), host: w.host });
  assert.deepEqual(via.items.map((i) => i.id).sort(), a.items.map((i) => i.id).sort(), "the load registration, given the host");
  assert.equal(defaultNeighbours({ owner: CONNECTION_OWNER, node, at: "2024-06-01T12:00:00Z", viewer: V("carol"), host: {} }).refused, "OWNER_NOT_READY");
  assert.equal(defaultNeighbours({ owner: CONNECTION_OWNER, node, at: "2024-06-01T12:00:00Z", viewer: V("carol") }).refused, "OWNER_HOST_AMBIGUOUS",
               "several instances in this isolate and no host named (K1563 (1))");
});

test("R48 neighbours, delegated to law-relations (its R7): for an event node, it answers the held standards in force at the event's when (R20), each a derived item with its method and connection-grammar's derivedId, an undetermined in-force answer marked so; an event the viewer may not read, or none, answers nothing", () => {
  const { w, meeting, fenced } = ownerWorld();
  const at = "2022-05-05T18:00:00Z", day = "2022-05-05";
  const a = w.s.neighbours({ node: meeting, at, viewer: V("carol") });
  const reg = createRegistry();
  const own = connectionOwnerOf(w.s);
  assert.equal(reg.registerOwner(own).ok, true);
  assert.equal(reg.neighbours({ owner: CONNECTION_OWNER, node: meeting, at, viewer: V("carol") }).items.length, a.items.length,
               "the registry judges the answer conforming");
  const ids = new Set(a.items.map((i) => i.to));
  assert.ok(a.items.length >= 5, JSON.stringify(a).slice(0, 600));
  for (const i of a.items) {
    assert.equal(i.kind, "in_force_at_event");
    assert.deepEqual(i.derived, { method: IN_FORCE_METHOD, inputs: [meeting, i.to], as_of: day });
    assert.equal(i.id, derivedId({ kind: i.kind, from: meeting, to: i.to, as_of: day, method: IN_FORCE_METHOD }));
    assert.equal(i.in_force.state, w.s.inForceAt({ standard: i.to, date: day }).state);
    assert.ok(i.in_force.state !== "not_in_force");
    assert.equal(reg.checkConnection(i).ok, true, JSON.stringify(reg.checkConnection(i)));
  }
  /* a standard not in force on the event's date is not answered */
  const gone = w.declare({ cite: "PEBL § 90", period: { from: "2010-01-01", to: "2011-01-01" } }).id;
  assert.ok(!w.s.neighbours({ node: meeting, at, viewer: V("carol") }).items.some((i) => i.to === gone));
  assert.ok(!ids.has(gone));
  /* undetermined in force: returned, marked */
  const open = a.items.find((i) => i.in_force.state === "undetermined");
  assert.ok(open && open.undetermined && open.undetermined.why, "an undetermined in-force answer is marked");
  assert.deepEqual(w.s.neighbours({ node: fenced, at, viewer: V("carol") }).items, [], "an event the viewer may not read");
  assert.ok(w.s.neighbours({ node: fenced, at, viewer: V("alice") }).items.length > 0);
  assert.deepEqual(w.s.neighbours({ node: EV("nothing"), at, viewer: V("carol") }).items, []);
});

test("R29 the move to layer 5 changes no answer: with a promotion step, a projection and a committed listener registered for every module of layers 5–8, a standard's promotion answers the same with the same checks, and the steps run in membership's MODULE_ORDER, standards' own check in its place among them", async () => {
  const modules = JSON.parse(readFileSync(new URL("../../../../build/modules.json", import.meta.url), "utf8")).modules;
  const layer58 = modules.filter((m) => m.layer >= 5 && m.layer <= 8 && m.id !== "standards").map((m) => m.id);
  assert.ok(layer58.length > 40);
  const declare = (w) => w.declare({ text: w.passage("same").contentId });
  const strip = (r) => ({ ...r, bundleSha: null, texts: null });
  const plain = seeded();
  const base = declare(plain);
  const w = seeded();
  const ran = [];
  for (const m of layer58) {
    w.promotion.registerStep(m, { check: (c) => { if (c.promotedType === "standard" || c.head?.type === "standard") ran.push(`check:${m}`); return null; },
                                  project: (c) => { if (c.promotedType === "standard") ran.push(`project:${m}`); return null; } });
    w.promotion.onCommitted(m, (e) => { if (e.type === "standard") ran.push(`committed:${m}`); });
  }
  const r = declare(w);
  await new Promise((res) => setTimeout(res, 0));   // promotion R45 announces after commit, in a microtask
  assert.deepEqual(strip(r), strip(base), "the same answer with every listener of layers 5–8 registered");
  const order = (kind) => ran.filter((x) => x.startsWith(`${kind}:`)).map((x) => x.slice(kind.length + 1));
  const expected = [...layer58].sort((a, b) => MODULE_ORDER.indexOf(a) - MODULE_ORDER.indexOf(b));
  for (const kind of ["check", "project", "committed"]) assert.deepEqual(order(kind), expected, kind);
  assert.ok(MODULE_ORDER.indexOf("observation-log") < MODULE_ORDER.indexOf("standards")
            && MODULE_ORDER.indexOf("standards") < MODULE_ORDER.indexOf("progressions"), "standards between observation-log and progressions (K1438)");
  /* standards' own check runs in its place: a raw promotion of a standard is refused by it, so the checks of the
     modules after it in the order never run, and those before it do */
  ran.length = 0;
  const doc = w.record.readFile(r.id, "bundle.md").text;
  const raw = w.promotion.promote({ bundleId: "STD-2026-0099-ordinance", base: null, snapKey: "raw", author: V("bob"),
                                    files: [{ path: "bundle.md", text: doc.replaceAll(r.id, "STD-2026-0099-ordinance") }], meta: {} });
  assert.equal(raw.reason, "STANDARD_WRITTEN_ELSEWHERE");
  const at = MODULE_ORDER.indexOf("standards");
  assert.deepEqual(order("check"), expected.filter((m) => MODULE_ORDER.indexOf(m) < at));
  assert.ok(order("check").includes("observation-log") && !order("check").includes("progressions"));
});

test("R14 R16 R48 every table is declared explicitly through record-core.declareTable: version_chain true, sight group, the other classes declarePurge's default form; constructing the instance creates them all (the law tables law-relations', constructed with it), and law relations and withdrawals are append-only", () => {
  const w = world({ construct: false });
  w.member("bob");
  const tables = () => new Set(w.rows(`SELECT name FROM sqlite_master WHERE type='table'`).map((r) => r.name));
  for (const t of STANDARDS_TABLES) assert.ok(!tables().has(t.name), t.name);
  const s = w.build();
  for (const t of STANDARDS_TABLES) assert.ok(tables().has(t.name), t.name);
  const declared = w.record.declaredTables().filter((d) => d.module === "standards");
  assert.deepEqual(declared.map((d) => d.name), STANDARDS_TABLES.map((t) => t.name));
  for (const d of declared)
    assert.deepEqual({ purge: d.purge, expunge: d.expunge, export: d.export, sight: d.sight, derive: d.derive, version_chain: d.version_chain }, { purge: "clear", expunge: "none", export: "admin-only", sight: "group", derive: "stored", version_chain: true }, d.name);
  /* append-only: a relation, its withdrawal and a treatment leave every earlier row as it was */
  const t1 = w.passage().contentId, t2 = w.passage().contentId;
  const a = s.standardDeclare({ cite: "PEBL § 1", kind: "ordinance", issuer: "S", reason: REASON, text: [t1], author: V("bob"), viewer: V("bob") }).id;
  const b = s.standardDeclare({ cite: "PEBL § 2", kind: "ordinance", issuer: "S", reason: REASON, text: [t2], author: V("bob"), viewer: V("bob") }).id;
  const snap = () => Object.fromEntries(["law_relations", "law_withdrawals"].map((t) => [t, w.rows(`SELECT * FROM ${t}`)]));
  const r = s.lawRelate({ type: "amends", from: b, to: a, citation: t2, effective: "2020-01-01", reason: REASON, author: V("bob"), viewer: V("bob") });
  const one = snap();
  s.lawWithdraw({ relation: r.relation.id, reason: "wrong", author: V("bob") });
  const two = snap();
  assert.deepEqual(two.law_relations, one.law_relations, "the relation row is untouched by its withdrawal");
  assert.equal(two.law_withdrawals.length, 1);
  /* purge: a single-bundle purge clears the relation keyed to that standard; the whole-store form every row */
  const p = w.record.purge({ bundleId: a });
  assert.equal(p.removed.law_relations, 1);
  const all = w.record.purge({});
  for (const t of STANDARDS_TABLES) assert.ok(t.name in all.removed, t.name);
});

test("R20 R21 R48 the ops map holds (the law ops kept, each delegated) the new acts and reads, reading stamps from the URL and acts' fields from the body", async () => {
  const w = seeded();
  const t = w.passage().contentId, u = w.passage().contentId;
  const a = w.declare({ text: [t] }).id, b = w.declare({ cite: "PEBL § 30", text: [u] }).id;
  const url = (q) => new URL(`https://plane.test/?viewer=${encodeURIComponent(V("bob"))}&${q}`);
  const ops = (q, body = {}) => standardsOps(w.s, url(q), body);
  assert.equal(ops(`id=${a}&date=2025-01-01`).inforceat().standard, a);
  assert.equal(ops(`key=${encodeURIComponent(KEY)}&date=2025-01-01`).inforceat().key, KEY);
  const rel = ops("", { type: "refers_to", from: b, to: a, citation: u, reason: REASON, author: V("bob") }).lawrelate();
  assert.equal(rel.ok, true, JSON.stringify(rel).slice(0, 200));
  assert.equal(ops(`id=${a}`).lawrelations().referential.length, 1);
  assert.equal(ops(`target=${a}`).standardsfor().of, "standard");
  assert.equal(ops(`key=${encodeURIComponent(KEY)}`).lawaddresses().key, KEY);
  assert.equal(ops("", { relation: rel.relation.id, reason: "x", author: V("bob") }).lawwithdraw().ok, true);
  assert.equal(ops("", { what: "relation", why: "w", proposer: MACHINE }).lawpropose().ok, true);
  assert.equal(ops("", { type: "applies", from: a, to: b, citation: t, reason: REASON, author: V("bob") }).courtlink().reason, "NOT_A_COURT_STANDARD");
  assert.equal(ops("", { decision: a, treatment: "affirmed", by_decision: b, citation: u, reason: REASON, author: V("bob") }).courttreat().reason, "NOT_A_COURT_STANDARD");
  assert.equal(ops(`id=${a}&date=2025-01-01`).stillstanding().reason, "NOT_A_COURT_STANDARD");
  assert.equal((await ops("citation=5%20Cal.%204th%20100").citationresolve()).state, "not verified");
  /* a viewer in the body never reaches the act: the URL's is read after it */
  assert.equal(standardsOps(w.s, new URL("https://plane.test/?viewer=nobody"), { type: "refers_to", from: b, to: a, citation: u,
    reason: REASON, author: V("bob"), viewer: V("bob") }).lawrelate().reason, "NO_SUCH_STANDARD");
});
