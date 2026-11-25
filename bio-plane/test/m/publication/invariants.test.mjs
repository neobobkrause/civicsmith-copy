/* publication — the invariants not driven elsewhere: purge (R31) beside corpus-export's (K1024), case-carriage's (N532)
   and case-tensions' (T33) declarations, the check rows held here (R33), no place named (R34), and the id that does not
   hold yet (R30). The export and its log are
   corpus-export's, written here through it (its R1), never through this module (N483). Driven at the module's
   interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { planeWorld as world, V, SIG, NOW } from "./fixture.mjs";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { corpusExportOf } from "../../../src/corpus-export/index.mjs";
import { caseCarriageOf, CASE_CARRIAGE_EXEMPT } from "../../../src/case-carriage/index.mjs";
import * as CHECKS from "../../../src/publication/checks.mjs";
import { CASE_SOURCES_CHECKS, rowOf } from "../../../src/publication/checks.mjs";
import { PUBLICATION_TABLES, PUBLICATION_EXEMPT, PUBLICATION_DECLARATIONS, publicationOwns,
         publicationOps } from "../../../src/publication/index.mjs";
import { caseTensionsOf, CASE_TENSIONS_TABLES, ATTRIBUTION_ACT_CHECKS } from "../../../src/case-tensions/index.mjs";
import { migratePublication } from "../../../src/publication/schema.mjs";
import { storage } from "./fixture.mjs";

const F = "INQ-2026-0001";
const MINE = { ...CASE_SOURCES_CHECKS };

test("R31 published bytes and the court-order stamps are exempt from purge; the derived and working tables are declared, with their classes, as the store declared them; the flags and attributions are case-tensions'", () => {
  const w = world();
  w.member("olive"); w.member("ann");
  const proj = w.project("Parks", "olive");
  const obs = w.observe("ann");
  w.inquiry(F, { legs: [{ target: obs }] });
  const pin = w.head(F);
  const roles = [{ target: F, version_sha: pin }];
  w.prepare("CASE-2026-0001", 1, { project: proj, roles, excluded: [{ target: obs }], attributions: [{ observation: obs }] });
  w.signCase("CASE-2026-0001", 1, { project: proj, roster: [{ bundle_id: F, version_sha: pin }] });
  w.signFinding(F, { edges: [{ to: obs, kind: "cites", disclosure: "name" }] });
  w.prepare("CASE-2026-0001", 2, { project: proj, roles, excluded: [{ target: obs }] });
  w.inquiry(F, { question: "Revised?", legs: [{ target: obs }] });
  corpusExportOf(w.host).exportManifest({});
  w.st.sql.exec(`INSERT INTO edition_stamps (case_id, edition, entry_seq, effect, parts, stamped_at)
                 VALUES ('CASE-2026-0001', 1, 4, 'seal', '["bundle.md"]', ?)`, NOW);
  const KEPT = [...PUBLICATION_EXEMPT, "export_log"];
  assert.equal(w.count("export_log"), 1);
  const exempt = w.snapshot(KEPT);
  /* one bundle's rows: the published graph's edges touching it */
  /* a reference F holds privately to evidence not yet published (N256) is working material, purged with either end */
  w.doc("INFO-2026-0003-annex");
  w.record.transact(() => w.p.publishEdges(F, [{ to: "INFO-2026-0003-annex", kind: "cites", disclosure: "serve" }], NOW));
  assert.equal(w.count("published_held_references"), 1);
  w.record.purge({ bundleId: F });
  assert.equal(w.row(`SELECT COUNT(*) AS n FROM published_edges WHERE from_bundle=?`, F).n, 0);
  assert.equal(w.count("published_held_references"), 0);
  /* the whole store: unsigned documents and their exclusions go, the signed one and every published row stay */
  w.record.purge({});
  assert.deepEqual(w.rows(`SELECT edition FROM case_documents`), [{ edition: 1 }]);
  assert.deepEqual(w.rows(`SELECT DISTINCT edition FROM case_exclusions`), [{ edition: 1 }]);
  assert.deepEqual(w.snapshot(KEPT), exempt, "published_*, cases and corpus-export's export_log are never cleared");
  assert.deepEqual([...PUBLICATION_EXEMPT].sort(), ["cases", "edition_stamps", "published_bundles", "published_case_members",
                                                    "published_cases", "published_shas"]);
  assert.equal(w.count("edition_stamps"), 1, "a stamp is never purged");
  /* plan T33 Rules (6): each table declared with its classes, the default form's values */
  const declared = Object.fromEntries(w.record.declaredTables().filter((d) => d.module === "publication").map((d) => [d.name, d]));
  assert.deepEqual(Object.keys(declared).sort(), [...PUBLICATION_TABLES.map((t) => t.name), ...PUBLICATION_EXEMPT].sort());
  for (const d of PUBLICATION_DECLARATIONS) {
    const got = declared[d.name];
    assert.deepEqual([got.purge, got.expunge, got.export, got.derive, got.version_chain],
                     [PUBLICATION_EXEMPT.includes(d.name) ? "exempt" : "clear", "none", "admin-only", "stored", false], d.name);
    assert.equal(got.sight, ["case_documents", "case_exclusions", "published_cases", "cases", "edition_stamps"].includes(d.name)
      ? "group" : "bundle", `${d.name}'s sight`);
  }
  /* T33-63 (K1634): the flags and attributions are case-tensions', declared by it, created at this module's creation */
  assert.equal(w.p.caseTensionsModule, caseTensionsOf(w.host), "created at this module's creation, one per host");
  assert.deepEqual(w.p.caseTensionsModule.purgeDeclaration, { ok: true });
  for (const t of CASE_TENSIONS_TABLES) {
    assert.equal(publicationOwns(t.name), false, `${t.name} is case-tensions'`);
    assert.equal(w.record.declaredTables().find((d) => d.name === t.name).module, "case-tensions");
  }
  /* N532: the two tables of held materials are case-carriage's, declared exempt by it (its R6), created at this
     module's creation on the same host; this module's declaration and its both answer ok */
  assert.equal(w.p.caseCarriage, caseCarriageOf(w.host), "created eagerly at this module's creation, one per host");
  assert.deepEqual([w.p.purgeDeclaration, w.p.caseCarriage.purgeDeclaration], [{ ok: true }, { ok: true }]);
  assert.deepEqual([...CASE_CARRIAGE_EXEMPT].sort(), ["published_case_materials", "published_material_texts"]);
  for (const t of CASE_CARRIAGE_EXEMPT) assert.equal(publicationOwns(t), false, `${t} is case-carriage's`);
  assert.deepEqual(PUBLICATION_TABLES.map((t) => t.name || t).sort(),
                   ["case_documents", "case_exclusions", "published_edges", "published_held_references"]);
  /* T41 (K2438): the waiting editions' table is publish-schedule's (its R10), neither created nor declared here */
  assert.equal(publicationOwns("scheduled_editions"), false, "publish-schedule's");
  assert.equal(w.row(`SELECT name FROM sqlite_master WHERE name='scheduled_editions'`), null, "not created by this module");
  assert.equal(publicationOwns("published_edges"), true);
  assert.equal(publicationOwns({ name: "export_log" }), false, "corpus-export's since K1024");
  assert.equal(publicationOwns("statement_acknowledgements"), false, "case-authoring's");
});

/* A bare host: record-core alone, so a declaration can be made before corpus-export's on it. */
function bareHost() {
  const st = storage({ workerd: true });
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const t of bare.split(";")) if (t.trim()) st.db.exec(t);
  const host = { storage: st };
  const record = recordOf(host, { evidence: null, evidencePrefix: "bio/captures/" });
  record.migrate();
  return { host, st, record };
}

test("R31 (K1024) on one host publication's purge declaration and corpus-export's both answer ok: export_log is declared once, by corpus-export, and a whole-store purge leaves it and this module's exempt tables byte-identical", () => {
  const w = world();
  assert.deepEqual(w.p.purgeDeclaration, { ok: true });
  assert.equal(w.p.corpusExport, corpusExportOf(w.host), "created eagerly at this module's creation, one per host");
  assert.deepEqual(w.p.corpusExport.purgeDeclaration, { ok: true });
  assert.equal(w.count("export_log"), 0, "export_log exists at boot, before any export");
  corpusExportOf(w.host).exportManifest({ note: "kept" });
  w.st.sql.exec(`INSERT INTO cases (case_id, project_id, opened) VALUES ('CASE-2026-0009', 'PROJ-1', ?)`, NOW);
  const kept = w.snapshot(["export_log", ...PUBLICATION_EXEMPT]);
  w.record.purge({});
  assert.deepEqual(w.snapshot(["export_log", ...PUBLICATION_EXEMPT]), kept);
  assert.equal(w.count("export_log"), 1);
  /* the same order on a bare host, with this module's exempt list as it is: both declarations answer ok */
  const ok = bareHost();
  assert.deepEqual(ok.record.declareTable("publication", PUBLICATION_DECLARATIONS.map((t) => ({ ...t }))), { ok: true });
  assert.deepEqual(corpusExportOf(ok.host, { record: ok.record }).purgeDeclaration, { ok: true });
  /* negative control: export_log restored to this module's exempt list, corpus-export's declaration is refused */
  const bad = bareHost();
  assert.deepEqual(bad.record.declareTable("publication", [...PUBLICATION_DECLARATIONS.map((t) => ({ ...t })),
    { ...PUBLICATION_DECLARATIONS.find((t) => t.name === "cases"), name: "export_log" }]), { ok: true });
  const refused = corpusExportOf(bad.host, { record: bad.record }).purgeDeclaration;
  assert.deepEqual([refused.ok, refused.reason, refused.table, refused.declaredBy], [false, "TABLE_DECLARED", "export_log", "publication"]);
});

test("N483 N501 (K1119) this module answers no export: no op `export` or `exportlog`, no delegate, and no corpus-export constant re-exported; corpus-export is still created at boot", async () => {
  const w = world();
  const ops = Object.keys(publicationOps(w.p, new URL("http://do/x"), null));
  assert.deepEqual(ops.filter((k) => /export/i.test(k)), [], "no export op is this module's");
  assert.ok(ops.includes("casedocument") && ops.includes("excludedby"), "the map itself is still answered");
  for (const name of ["exportManifest", "exportLog"]) assert.equal(name in w.p, false, `${name}: no delegate`);
  assert.equal(w.p.corpusExport, corpusExportOf(w.host), "created at this module's creation, one per host");
  assert.equal(w.count("export_log"), 0, "export_log exists at boot");
  const pub = await import("../../../src/publication/index.mjs");
  const ce = await import("../../../src/corpus-export/index.mjs");
  /* every constant corpus-export exports is its alone (N501: the last re-export, its log's default page, retired) */
  const constants = Object.keys(ce).filter((k) => /^[A-Z][A-Z0-9_]*$/.test(k));
  assert.ok(constants.includes("EXPORT_LOG_LIMIT_DEFAULT") && constants.length >= 3, "the control: corpus-export's own constants");
  for (const name of constants) assert.equal(name in pub, false, `${name} is corpus-export's alone`);
});

test("R33 R78 this module's table holds exactly C-122.1–.4, .6, .7 and .8 (C-122.5 moved with its raiser to publish-schedule R9; T41; C-122.8 R78's, T45), each with its code, sentence and its raiser's site here; C-92.1–.9 and C-92.13 left it for case-tensions' (its R9), C-44.2, C-68.5 and C-98 for public-read's (its R17)", () => {
  /* every table this file exports, not a sample: one, and every row in it is one of the seven */
  const tables = Object.entries(CHECKS).filter(([, v]) => v && typeof v === "object" && !Array.isArray(v)
    && Object.values(v).some((r) => r && typeof r.check === "string"));
  assert.deepEqual(tables.map(([k]) => k).sort(), ["CASE_SOURCES_CHECKS"]);
  const ids = Object.values(MINE).map((r) => r.check).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  assert.deepEqual(ids, ["C-122.1", "C-122.2", "C-122.3", "C-122.4", "C-122.6", "C-122.7", "C-122.8"]);
  for (const [code, row] of Object.entries(MINE)) {
    assert.ok(typeof row.translation === "string" && row.translation.length > 40, `${code} has its sentence`);
    assert.match(row.where, /^src\/publication\/index\.mjs \w+ > is-[a-z-]+$/, `${code}'s site is this module's`);
    assert.deepEqual(rowOf(code), { code, check: row.check, translation: row.translation });
  }
  /* the moved rows answer nothing here: a code with no row in this table is a defect, and says so loudly */
  for (const code of ["FINDING_IN_SEVERAL_CASES", "NO_PUBLISHED_STORE", "NO_PUBLISHED_PART", "OBJECT_MISSING", "NOT_A_CONTAINER",
                      "MANIFEST_UNREADABLE", "PART_MISSING", "DUPLICATE_PATH", "CONTAINER_TOO_LARGE", "NOT_PUBLISHED",
                      "CASE_DOCUMENT_UNSERVABLE", "NOT_A_CODE", "SCHEDULED_CHECK_UNAVAILABLE", ...Object.keys(ATTRIBUTION_ACT_CHECKS)])
    assert.throws(() => rowOf(code), /no row with a canned translation/, code);
  for (const id of ["C-44.2", "C-68.5", "C-122.5", ...Array.from({ length: 9 }, (_, i) => `C-98.${i + 1}`),
                    ...Object.values(ATTRIBUTION_ACT_CHECKS).map((r) => r.check)])
    assert.equal(tables.some(([, t]) => Object.values(t).some((r) => r.check === id)), false, `${id} is not held here`);
});

test("R34 no place is named in this module's behaviour or outward text", () => {
  const w = world();
  w.member("olive");
  const proj = w.project("Parks", "olive");
  w.inquiry(F);
  const pin = w.head(F);
  w.prepare("CASE-2026-0001", 1, { project: proj, roles: [{ target: F, version_sha: pin }] });
  w.signCase("CASE-2026-0001", 1, { project: proj, roster: [{ bundle_id: F, version_sha: pin }] });
  w.signFinding(F);
  const outward = JSON.stringify([MINE, w.p.caseEditionState("CASE-2026-0001", 1), w.op("publishedtargets", { ids: F }),
    w.op("caseflags", {}), w.op("excludedby", { id: F, viewer: V("olive") }),
    w.op("casedocument", { case: "CASE-2026-0001", edition: 1 }), w.op("casedocument", { case: "CASE-2026-0002", edition: 1 }),
    w.p.reviewProvider().deadAnswer(), w.p.publishedEditionsOf({ finding: F }), w.p.caseTensionsModule.caseTensions({}),
    w.p.caseTensionsModule.caseFlags({}).doctrine, w.op("attribute", {}, {}), w.op("attribute", { by: "olive" }, { level: "group" })]);
  for (const place of ["Oakland", "California", "Alameda", "Berkeley", "San Francisco", "Sacramento", "Brown Act", "CPRA",
                       "United States", "County", "City of"])
    assert.equal(outward.includes(place), false, `names ${place}`);
});

test("R24 an existing store migrates: every ratified row of the old, edition-less shape survives as edition 1, and nothing is invented", () => {
  const st = storage({ workerd: true });
  st.db.exec(`CREATE TABLE published_bundles (bundle_id TEXT PRIMARY KEY, bundle_sha TEXT NOT NULL, ratified_at TEXT NOT NULL,
    attestor_key TEXT NOT NULL, attestor_member TEXT, gate_version TEXT NOT NULL, sig_armored TEXT NOT NULL)`);
  st.sql.exec(`INSERT INTO published_bundles VALUES ('INQ-2026-0001-legacy','legacysha','2026-01-01T00:00:00Z','LEGACYKEY','bob','plane-gate/0.9','sig')`);
  migratePublication(st.sql);
  migratePublication(st.sql);   /* every boot: idempotent */
  const rows = st.sql.exec(`SELECT * FROM published_bundles`).toArray();
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].edition, rows[0].bundle_sha, rows[0].attestor_member, rows[0].gate_version, rows[0].sig_armored],
                   [1, "legacysha", "bob", "plane-gate/0.9", "sig"]);
  assert.deepEqual([rows[0].strength, rows[0].required, rows[0].delivered_by], [null, null, null], "nothing invented");
  assert.equal(st.sql.exec(`SELECT name FROM sqlite_master WHERE name='published_bundles_preeditions'`).toArray().length, 0);
  assert.ok(st.sql.exec(`PRAGMA table_info(published_case_members)`).toArray().some((c) => c.name === "version_sha"));
});

test.todo("R30 a published rendering is verified by pixels_sha256 over its normalised samples — NOT YET MET (D-246): nothing in the plane publishes a rendering yet (no `kind: rendering` part is written to published_shas or a container), so there is no rendering to carry the pixel hash; it joins when the rendering path does");

