/* publication — T33 (T33-63): the provider case-tensions reads this module's tables and splice through (R61; K1505 (3),
   K1634), a court order complied with openly (R62; K1480, K1632), the published timeline frozen at signing (R63; C11,
   K1494), and each calculation's inputs committed as a material's (R22; K1632, public-read R23). `case-tensions` and
   `case-grammar` are the real modules. Driven at the module's interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { planeWorld as world, V, SIG, NOW, sha } from "./fixture.mjs";
import { PUBLICATION_TABLES, PUBLICATION_EXEMPT, EDITION_STAMP_EFFECTS } from "../../../src/publication/index.mjs";
import { caseTensionsOf, CASE_TENSIONS_TABLES, PUBLICATION_DOORS } from "../../../src/case-tensions/index.mjs";
import { caseFilePath, timelineOf } from "../../../src/case-grammar/index.mjs";
import * as PUB from "../../../src/publication/index.mjs";
import * as CT from "../../../src/case-tensions/index.mjs";
import * as CG from "../../../src/case-grammar/index.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";

const F = "INQ-2026-0001", G = "INQ-2026-0002", DOC = "INFO-2026-0001-minutes", CASE = "CASE-2026-0001";
const roster = (roles) => roles.map((r) => ({ bundle_id: r.target, version_sha: r.version_sha, role: r.role ?? "load_bearing" }));

function base() {
  const w = world();
  w.member("olive"); w.member("ann");
  const proj = w.project("Parks", "olive");
  w.doc(DOC);
  w.inquiry(F, { legs: [{ target: DOC }] });
  const roles = [{ target: F, version_sha: w.head(F) }];
  return { w, proj, roles };
}
/* CASE edition 1 signed over F; edition 2 prepared, unsigned. */
function signed(opts = {}) {
  const b = base();
  b.w.prepare(CASE, 1, { project: b.proj, roles: b.roles, ...opts });
  assert.equal(b.w.signCase(CASE, 1, { project: b.proj, roster: roster(b.roles) }).ok, true);
  return b;
}

/* ---------------------------------------------------------------- R61 */

test("R61 at start this module registers its provider with case-tensions, whose seven doors answer exactly the rows of its tables; the three tables, the caseMember fact and the revision step are case-tensions'", () => {
  const { w, proj, roles } = signed();
  const ct = caseTensionsOf(w.host);
  assert.equal(w.p.caseTensionsModule, ct, "created at this module's creation, one per host");
  assert.deepEqual(ct.publicationProvider(), { registered: true, module: "publication" });
  /* a second registration is refused by case-tensions: one provider */
  assert.equal(ct.registerPublicationProvider("publication", w.p.publicationProvider()).reason, "PROVIDER_DECLARED");
  const pv = w.p.publicationProvider();
  assert.deepEqual(PUBLICATION_DOORS.filter((d) => typeof pv[d] !== "function"), [], "every door given");
  const pin = roles[0].version_sha;
  /* pins: the roster rows of existing editions pinning that sha, with the owning project */
  assert.deepEqual(pv.pins(F, pin), [{ case_id: CASE, edition: 1, version_sha: pin, role: "load_bearing", project_id: proj }]);
  assert.deepEqual(pv.pins(F, "0".repeat(64)), []);
  /* preparations: the unsigned documents naming it, and whether that edition is ratified */
  w.inquiry(G);
  w.prepare(CASE, 2, { project: proj, roles: [...roles, { target: G, version_sha: w.head(G) }] });
  assert.deepEqual(pv.preparations(G).map((d) => [d.case_id, d.edition, d.ratified, typeof d.text]), [[CASE, 2, false, "string"]]);
  assert.deepEqual(pv.preparations(F).map((d) => d.edition), [2], "a signed document is no preparation");
  /* caseDocument: an edition's document as the plane, signed or not */
  const d1 = pv.caseDocument(CASE, 1), d2 = pv.caseDocument(CASE, 2);
  assert.deepEqual([d1.case_id, d1.edition, d1.signed, d1.project_id, d1.doc_sha],
                   [CASE, 1, true, proj, w.row(`SELECT doc_sha FROM case_documents WHERE edition=1`).doc_sha]);
  assert.equal(d2.signed, false);
  assert.equal(pv.caseDocument(CASE, 9), null);
  /* members: an edition's roster, in its order */
  assert.deepEqual(pv.members(CASE, 1), [{ bundle_id: F, version_sha: pin }]);
  assert.deepEqual(pv.members(CASE, 2), []);
  /* latestRatified: each case's latest ratified edition (every member published), by project, in case id order after
     `after`, at most `limit` */
  w.prepare("CASE-2026-0002", 1, { project: proj, roles });
  w.signCase("CASE-2026-0002", 1, { project: proj, roster: roster(roles) });
  assert.deepEqual(pv.latestRatified({ project: null, after: "", limit: 10 }), [], "no member published yet");
  assert.equal(w.signFinding(F).ok, true);
  const all = pv.latestRatified({ project: null, after: "", limit: 10 });
  assert.deepEqual(all.map((r) => [r.case_id, r.edition, r.project_id]), [[CASE, 1, proj], ["CASE-2026-0002", 1, proj]]);
  assert.deepEqual(pv.latestRatified({ project: null, after: CASE, limit: 10 }).map((r) => r.case_id), ["CASE-2026-0002"]);
  assert.deepEqual(pv.latestRatified({ project: null, after: "", limit: 1 }).length, 1);
  assert.deepEqual(pv.latestRatified({ project: "PROJ-OTHER", after: "", limit: 10 }), []);
  /* signedDocumentsNaming: ratified documents whose text holds the text, bounded */
  assert.equal(pv.signedDocumentsNaming(`case_id: ${CASE}`, 50).length, 1, "edition 2 is unsigned");
  assert.equal(pv.signedDocumentsNaming("case_project:", 1).length, 1, "bounded by limit");
  /* reauthorSection: R21's splice, refusing a signed document */
  assert.equal(pv.reauthorSection({ caseId: CASE, edition: 1, section: "attribution", lines: { frontmatter: [], body: [] } }).reauthored, false);
  /* the op arm is case-tensions' own (its map, spread beside this module's) */
  assert.deepEqual(w.op("attribute", {}, {}), ct.attributeObservation({}), "the op arm is case-tensions'");
  /* the fact and the step are case-tensions': prepared membership, and a revision flagged through its step */
  assert.equal(w.promotion.fact("caseMember", G).value, true);
  w.inquiry(F, { question: "Revised?", legs: [{ target: DOC }] });
  assert.deepEqual(w.rows(`SELECT case_id, bundle_id, pinned_sha FROM case_revision_flags`), [
    { case_id: CASE, bundle_id: F, pinned_sha: pin }, { case_id: "CASE-2026-0002", bundle_id: F, pinned_sha: pin }]);
  for (const t of CASE_TENSIONS_TABLES)
    assert.equal([...PUBLICATION_TABLES.map((x) => x.name), ...PUBLICATION_EXEMPT].includes(t.name), false, `${t.name} is not this module's`);
});

/* N597 (T35, T36): the names case-tensions serves, which this module delegated until each importer re-pointed;
   `caseRelation` the last (T36, K1643). */
const MOVED_METHODS = ["caseTensions", "observationsNamingAuthor", "attributionInForce", "attributionFacts", "attributionStatedFor",
                       "dischargeCaseFlags", "flagCasesOnRevision", "caseFlags", "attributionStatements", "attributeObservation",
                       "caseRelation"];
const MOVED_EXPORTS = ["ATTRIBUTION_ACT_CHECKS", "CASE_FLAGS_LIMIT", "ATTRIBUTION_REASON_MAX", "CASE_TENSIONS_MAX"];

test("R61 (T35, T36; N597, K1643) this module serves none of case-tensions' services and re-exports none of its names: no delegate, caseRelation included, and no re-exported constant is left, while case-tensions answers each; the case-grammar re-exports are unchanged", () => {
  const { w, proj, roles } = signed();
  const ct = caseTensionsOf(w.host);
  for (const name of MOVED_METHODS) {
    assert.equal(typeof ct[name], "function", `the control: case-tensions serves ${name}`);
    assert.equal(name in w.p, false, `${name}: no delegate here`);
  }
  for (const name of [...MOVED_METHODS, ...MOVED_EXPORTS])
    assert.equal(name in PUB, false, `${name}: not exported here`);
  for (const name of MOVED_EXPORTS) assert.ok(name in CT, `the control: case-tensions exports ${name}`);
  /* the case relation is case-tensions' alone, at every state: pinned, prepared, in none */
  w.inquiry(G);
  w.prepare(CASE, 2, { project: proj, roles: [...roles, { target: G, version_sha: w.head(G) }] });
  assert.deepEqual([F, G, DOC].map((id) => !!ct.caseRelation(id).member), [true, true, false], "the control: case-tensions answers it");
  /* the case-grammar re-exports, unchanged: each the same binding as case-grammar's */
  for (const name of ["CASE_DOCUMENT_FORMAT", "caseDocumentStatesMemberBlocks", "caseDocumentBlocks", "captureBlockLines",
                      "sourceBlockLines", "publishedGraphEdges", "ATTRIBUTION_LEVELS", "REAUTHORABLE_SECTIONS", "caseTensionsOf"])
    assert.equal(PUB[name], CG[name], `${name} is case-grammar's`);
});

test("R61 a commit discharges the case's outstanding flags through case-tensions, and caseDocumentFacts' attribution facts are case-tensions' (R2)", () => {
  const { w, proj, roles } = signed();
  w.signFinding(F, { sig: SIG(5) });
  w.inquiry(F, { question: "Revised?", legs: [{ target: DOC }] });
  assert.equal(w.row(`SELECT acted_at FROM case_revision_flags`).acted_at, null);
  const roles2 = [{ target: F, version_sha: w.head(F), edition: 2 }];
  w.prepare(CASE, 2, { project: proj, roles: roles2 });
  assert.equal(w.signCase(CASE, 2, { project: proj, roster: roster(roles2), sig: SIG(2) }).ok, true);
  assert.equal(w.signFinding(F, { sig: SIG(6) }).ok, true);
  assert.deepEqual(w.row(`SELECT acted_by, acted_edition FROM case_revision_flags`), { acted_by: "olive", acted_edition: 2 });
  const doc = w.row(`SELECT case_id, edition, text FROM case_documents WHERE edition=2`);
  assert.deepEqual(w.p.caseDocumentFacts(CASE, 2, V("olive")).attribution, caseTensionsOf(w.host).attributionFacts(doc));
});

/* ---------------------------------------------------------------- R62 */

/* docket's source, as a stand-in: the posted court-order entries it holds, by case and seq. */
function orders(w, entries) {
  const asked = [];
  const r = w.p.registerOrderSource("docket", { courtOrderOf: (c, entry) => {
    asked.push([c, entry]);
    const seq = typeof entry === "object" && entry ? entry.seq : entry;
    return entries.find((e) => e.case === c && e.seq === seq) || null;
  } });
  assert.deepEqual(r, { ok: true, module: "docket" });
  return asked;
}

test("R62 with no court-order source registered every stamp is refused STAMP_NO_ORDER and nothing is written; the source is registered once, with its door", () => {
  const { w } = signed();
  assert.deepEqual(w.p.orderSource(), { registered: false, module: null });
  const before = w.snapshot();
  const r = w.p.stampEdition({ case: CASE, editions: [1], entry: 4, effect: "seal", parts: ["bundle.md"] });
  assert.deepEqual([r.ok, r.reason], [false, "STAMP_NO_ORDER"]);
  assert.deepEqual(w.snapshot(), before);
  assert.equal(w.p.registerOrderSource({ module: "docket" }).reason, "PROVIDER_MALFORMED");
  assert.equal(w.p.registerOrderSource(null).reason, "PROVIDER_MALFORMED");
  orders(w, []);
  assert.deepEqual(w.p.orderSource(), { registered: true, module: "docket" });
  assert.equal(w.p.registerOrderSource("other", { courtOrderOf: () => null }).reason, "PROVIDER_DECLARED");
});

test("R62 stampEdition records one stamp per named ratified edition, linked to the entry, appending and altering nothing published; stampsOf answers them in order; a repeated stamp answers existed", () => {
  const { w, proj, roles } = signed();
  w.prepare(CASE, 2, { project: proj, roles });
  w.signCase(CASE, 2, { project: proj, roster: roster(roles), sig: SIG(2) });
  w.prepare(CASE, 3, { project: proj, roles });   /* unsigned: never stamped by `all` */
  const asked = orders(w, [{ case: CASE, seq: 4, effect: "seal", editions: [1], parts: ["bundle.md"] },
                           { case: CASE, seq: 5, effect: "unseal", editions: [1], parts: ["bundle.md"] },
                           { case: CASE, seq: 6, effect: "remove", editions: "all", parts: null }]);
  const before = w.snapshot();
  w.clock.now = "2026-10-01T00:00:00Z";
  const s = w.p.stampEdition({ case: CASE, editions: [1], entry: 4, effect: "seal", parts: ["bundle.md"] });
  assert.deepEqual([s.ok, s.entry, s.effect, s.parts, s.editions, s.existed], [true, 4, "seal", ["bundle.md"], [1], false]);
  assert.deepEqual(asked, [[CASE, 4]], "the entry is confirmed through the source");
  const after = w.snapshot();
  assert.deepEqual(Object.keys(after).filter((t) => after[t] !== before[t]), ["edition_stamps"], "nothing else is written (R24)");
  w.clock.now = "2026-10-02T00:00:00Z";
  w.p.stampEdition({ case: CASE, editions: [1], entry: 5, effect: "unseal", parts: ["bundle.md"] });
  assert.deepEqual(w.p.stampsOf({ case: CASE, edition: 1 }), { ok: true, case: CASE, edition: 1, stamps: [
    { case: CASE, edition: 1, effect: "seal", parts: ["bundle.md"], entry: 4, stamped_at: "2026-10-01T00:00:00Z" },
    { case: CASE, edition: 1, effect: "unseal", parts: ["bundle.md"], entry: 5, stamped_at: "2026-10-02T00:00:00Z" }] });
  /* `all`: every ratified edition then held, never the unsigned one; parts none named, null */
  const all = w.p.stampEdition({ case: CASE, editions: "all", entry: { seq: 6 }, effect: "remove" });
  assert.deepEqual([all.ok, all.editions, all.parts, all.stamps.map((x) => x.edition)], [true, [1, 2], null, [1, 2]]);
  assert.deepEqual(w.p.stampsOf({ case: CASE, edition: 3 }).stamps, []);
  /* the same stamp again writes nothing */
  const snap = w.snapshot();
  const again = w.p.stampEdition({ case: CASE, editions: [1], entry: 4, effect: "seal", parts: ["bundle.md"] });
  assert.deepEqual([again.ok, again.existed], [true, true]);
  assert.deepEqual(w.snapshot(), snap);
  assert.equal(w.p.stampsOf({ case: "" , edition: 1 }).reason, "NO_ID");
  assert.deepEqual(EDITION_STAMP_EFFECTS, ["remove", "redact", "seal", "unseal"]);
});

test("R62 refusals each write nothing: MALFORMED, NO_SUCH_CASE_EDITION for an edition that is not a ratified edition of the case, STAMP_NO_ORDER for an entry the source does not answer as a posted court-order of the case with this effect", () => {
  const { w, proj, roles } = signed();
  w.prepare(CASE, 2, { project: proj, roles });
  orders(w, [{ case: CASE, seq: 4, effect: "seal", editions: [1], parts: ["x"] }]);
  const before = w.snapshot();
  const ok = { case: CASE, editions: [1], entry: 4, effect: "seal", parts: ["x"] };
  for (const [label, call] of [["no case", { ...ok, case: "" }], ["no effect", { ...ok, effect: null }],
                               ["an unknown effect", { ...ok, effect: "delete" }], ["no editions", { ...ok, editions: [] }],
                               ["a bad edition", { ...ok, editions: [0] }], ["editions not a list", { ...ok, editions: 1 }],
                               ["no entry", { ...ok, entry: null }], ["parts not names", { ...ok, parts: [3] }],
                               ["parts a string", { ...ok, parts: "x" }]])
    assert.equal(w.p.stampEdition(call).reason, "MALFORMED", label);
  assert.equal(w.p.stampEdition().reason, "MALFORMED");
  const unsigned = w.p.stampEdition({ ...ok, editions: [1, 2] });
  assert.deepEqual([unsigned.reason, unsigned.editions], ["NO_SUCH_CASE_EDITION", [2]]);
  assert.equal(w.p.stampEdition({ ...ok, editions: [7] }).reason, "NO_SUCH_CASE_EDITION");
  assert.equal(w.p.stampEdition({ ...ok, case: "CASE-NONE", editions: "all" }).reason, "NO_SUCH_CASE_EDITION");
  for (const [label, call] of [["another entry", { ...ok, entry: 9 }], ["another case's entry", { ...ok, case: CASE, entry: 3 }],
                               ["another effect", { ...ok, effect: "remove" }]])
    assert.equal(w.p.stampEdition(call).reason, "STAMP_NO_ORDER", label);
  assert.deepEqual(w.snapshot(), before, "nothing written");
  /* a source that throws confirms nothing */
  const { w: w2 } = signed();
  w2.p.registerOrderSource("docket", { courtOrderOf: () => { throw new Error("down"); } });
  assert.equal(w2.p.stampEdition(ok).reason, "STAMP_NO_ORDER");
  assert.equal(w2.count("edition_stamps"), 0);
});

/* ---------------------------------------------------------------- R63 */

const TIMELINE = [
  { lane: "we_did", ord: 1, when: "2026-09-02", label: "We asked for the minutes.", ref: "ACT-2026-0001", source: "docket:1" },
  { lane: "they_did", ord: 2, when: "2026-09-03", label: "The body met.", ref: "EVT-aaaaaaaaaaaaaaaa", source: sha("cap-1") },
  { lane: "they_did", ord: 1, when: "undetermined", label: "The notice went up.", ref: "EVT-bbbbbbbbbbbbbbbb", source: sha("cap-2") },
];

test("R63 a ratified edition's timeline is its signed document's timeline block, the lanes apart, as signed: editionTimeline and caseEditionState answer it, never a later read; no block, both lanes empty; an unsigned edition answers none", () => {
  const { w, proj, roles } = signed({ timeline: TIMELINE });
  const signedText = w.row(`SELECT text FROM case_documents WHERE edition=1`).text;
  const t = w.p.editionTimeline({ case: CASE, edition: 1 });
  assert.equal(t.ok, true);
  assert.deepEqual({ they_did: t.they_did, we_did: t.we_did }, timelineOf(parseFrontmatter(signedText).data));
  assert.deepEqual(t.they_did.map((i) => i.ref), ["EVT-bbbbbbbbbbbbbbbb", "EVT-aaaaaaaaaaaaaaaa"], "its lane, in its own order");
  assert.deepEqual(t.we_did.map((i) => [i.ref, i.source]), [["ACT-2026-0001", "docket:1"]], "never mixed with the other");
  assert.deepEqual(w.p.caseEditionState(CASE, 1).timeline, { they_did: t.they_did, we_did: t.we_did });
  /* a later edition with another timeline, and a change in the record, leave the signed one as it was */
  w.prepare(CASE, 2, { project: proj, roles, timeline: [TIMELINE[0]] });
  w.inquiry(F, { question: "Revised?", legs: [{ target: DOC }] });
  assert.deepEqual(w.p.editionTimeline({ case: CASE, edition: 1 }), t);
  assert.deepEqual([w.p.editionTimeline({ case: CASE, edition: 2 }).reason, w.p.caseEditionState(CASE, 2)], ["NO_SUCH_CASE_EDITION", null]);
  assert.equal(w.p.editionTimeline({ case: CASE, edition: 9 }).reason, "NO_SUCH_CASE_EDITION");
  assert.equal(w.p.editionTimeline({ case: "", edition: 1 }).reason, "NO_ID");
  /* a document without the block answers both lanes empty */
  const { w: bare } = signed();
  assert.deepEqual(bare.p.editionTimeline({ case: CASE, edition: 1 }), { ok: true, case: CASE, edition: 1, they_did: [], we_did: [] });
  const before = w.snapshot();
  w.p.editionTimeline({ case: CASE, edition: 1 });
  assert.deepEqual(w.snapshot(), before, "it writes nothing");
});

/* ---------------------------------------------------------------- R22 (K1632) */

const IN_A = sha("table-a"), IN_B = sha("table-b");
const CALCS = [
  { calc: "CALC-0001", recipe: { select: "a" }, inputs: { a: IN_A, b: IN_B }, method_version: "1.0.0", results: { total: 3 },
    recompute: "agrees", disclosed: null },
  { calc: "CALC-0002", recipe: { select: "b" }, inputs: { b: IN_B }, method_version: "1.0.0", results: { total: 1 },
    recompute: "agrees", disclosed: null },
];

test("R22 (K1632) a case edition's commit also commits each calculations row's input bytes at their SHA-256, as a material's: registered at its case-file path and answered held evidence once each, read back for a retry; a refused commit registers none", () => {
  const docSha = sha(`the text of ${DOC}`);
  const materials = [{ ref: DOC, kind: "document", sha: docSha, text_sha: null, origin: null, archived_copy: null,
                       included: true, rests_under: "load_bearing" }];
  const { w, proj, roles } = base();
  /* an input whose bytes are also an included material is held once, as the material */
  const calcs = [...CALCS, { ...CALCS[1], calc: "CALC-0003", inputs: { doc: docSha } }];
  w.prepare(CASE, 1, { project: proj, roles, materials, calculations: calcs });
  const r = w.signCase(CASE, 1, { project: proj, roster: roster(roles) });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.materials, [{ sha: docSha, held: "inline" }, { sha: IN_A, held: "evidence" }, { sha: IN_B, held: "evidence" }]);
  assert.deepEqual(w.p.heldMaterialsOf(CASE, 1), r.materials, "a retried ratification reads the same list (ratification R39)");
  assert.deepEqual(w.rows(`SELECT sha256, bundle_id, path, kind FROM published_shas WHERE kind='calculation_input' ORDER BY path`), [
    { sha256: IN_A, bundle_id: CASE, path: caseFilePath("calculation", ["CALC-0001", IN_A]), kind: "calculation_input" },
    { sha256: IN_B, bundle_id: CASE, path: caseFilePath("calculation", ["CALC-0001", IN_B]), kind: "calculation_input" },
    { sha256: IN_B, bundle_id: CASE, path: caseFilePath("calculation", ["CALC-0002", IN_B]), kind: "calculation_input" },
    { sha256: docSha, bundle_id: CASE, path: caseFilePath("calculation", ["CALC-0003", docSha]), kind: "calculation_input" }]);
  /* exempt from purge, as published bytes are */
  const kept = w.snapshot(["published_shas"]);
  w.record.purge({});
  assert.deepEqual(w.snapshot(["published_shas"]), kept);
  /* a retry of the signed edition writes nothing more */
  const snap = w.snapshot();
  assert.equal(w.signCase(CASE, 1, { project: proj, roster: roster(roles) }).existed, true);
  assert.deepEqual(w.snapshot(), snap);
  /* a document with no calculations commits none; an unsigned edition answers none */
  w.prepare("CASE-2026-0002", 1, { project: proj, roles });
  assert.deepEqual(w.signCase("CASE-2026-0002", 1, { project: proj, roster: roster(roles) }).materials, []);
  w.prepare("CASE-2026-0003", 1, { project: proj, roles, calculations: CALCS });
  assert.deepEqual(w.p.heldMaterialsOf("CASE-2026-0003", 1), []);
  /* a refused commit (a pre-/6 format) registers no input */
  const { w: w2, proj: p2, roles: r2 } = base();
  w2.prepare(CASE, 1, { project: p2, roles: r2, calculations: CALCS, format: "bio-case-document/5" });
  assert.equal(w2.signCase(CASE, 1, { project: p2, roster: roster(r2) }).reason, "CASE_FORMAT_SUPERSEDED");
  assert.equal(w2.row(`SELECT COUNT(*) AS n FROM published_shas WHERE kind='calculation_input'`).n, 0);
});
