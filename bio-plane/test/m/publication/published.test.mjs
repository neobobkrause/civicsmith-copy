/* publication — the published projection: its registries (R7), what stays here of the public read path (R12, R25,
   R26), the deliverer (R14, R27, R28) and the commits the ceremonies make (R22, R24, R35). Driven at the module's
   interface. The public reads themselves (verify, the lists, the published case, the manifest, the evidence-package
   block) are `public-read`'s since K651 and tested there; here they are observed through this module's own answers
   (R53's case edition state, R1's case document, R7's registry) and its tables. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { planeWorld as world, cursor, V, SIG, NOW } from "./fixture.mjs";
import { delivererOf, deliveringPrincipal, DELIVERER_UNDETERMINED_DETAIL } from "../../../src/deliverer.mjs";

const F = "INQ-2026-0001", G = "INQ-2026-0002", DOC = "INFO-2026-0001-minutes";
const PUBLISHED = ["published_bundles", "published_shas", "published_cases", "published_case_members", "cases",
                   "published_edges", "case_documents"];
const roster = (roles) => roles.map((r) => ({ bundle_id: r.target, version_sha: r.version_sha, role: r.role ?? "load_bearing" }));

/* CASE-2026-0001 edition 1 over F (pinned), ratified and published; DOC a document F rests on. */
function published({ strength = [{ target: F, axis: "capture", grade: "B" }, { target: F, axis: "connection", grade: "C" }],
                     publishFinding = true } = {}) {
  const w = world();
  w.member("olive"); w.member("bo");
  const proj = w.project("Parks", "olive");
  w.doc(DOC);
  w.inquiry(F, { legs: [{ target: DOC }] });
  const pin = w.head(F);
  const roles = [{ target: F, version_sha: pin }];
  w.prepare("CASE-2026-0001", 1, { project: proj, roles, strength, excluded: [{ target: DOC, description: "the minutes" }] });
  assert.equal(w.signCase("CASE-2026-0001", 1, { project: proj, roster: roster(roles) }).ok, true);
  if (publishFinding)
    assert.equal(w.signFinding(F, { edges: [{ to: DOC, kind: "cites", disclosure: "serve" }] }).ok, true);
  return { w, proj, pin, roles };
}

test("R7 publishedRegistryFor answers each published edition and its frozen pair keyed on the record's object_type; publishedCaseRegistryFor each ratified case edition; both are promotion's facts", () => {
  const { w, pin } = published();
  const reg = w.p.publishedRegistryFor(F, [DOC, "NOPE"]);
  assert.deepEqual(Object.keys(reg), [F]);
  assert.equal(reg[F].object_type, "inquiry");
  assert.equal(reg[F].latest, 1);
  const e = reg[F].editions["1"];
  assert.deepEqual([e.edition, e.bundle_sha, e.case_ids, e.case_id], [1, pin, ["CASE-2026-0001"], "CASE-2026-0001"]);
  assert.deepEqual([e.capture, e.connection], [{ state: "graded", grade: "B" }, { state: "graded", grade: "C" }]);
  assert.equal("testimony" in e, false, "the testimony axis only where the edition froze one");
  assert.deepEqual(w.p.publishedRegistryFor(null, []), {});
  /* a published row with no bundles row reads its type as undetermined (null) */
  w.st.sql.exec(`INSERT INTO published_bundles (bundle_id, edition, bundle_sha, ratified_at, attestor_key, gate_version, sig_armored)
                 VALUES ('GONE-1', 1, 'x', ?, 'k', 'g', 's')`, NOW);
  assert.equal(w.p.publishedRegistryFor("GONE-1")["GONE-1"].object_type, null);
  assert.deepEqual(w.promotion.fact("publishedRegistry", F, [DOC]).value, w.p.publishedRegistryFor(F, [DOC]));
  const creg = w.p.publishedCaseRegistryFor(["CASE-2026-0001", "CASE-NONE"]);
  assert.deepEqual(Object.keys(creg), ["CASE-2026-0001"]);
  assert.equal(creg["CASE-2026-0001"].latest, 1);
  assert.deepEqual(Object.keys(creg["CASE-2026-0001"].editions["1"]).sort(),
                   ["bias_acknowledgement", "completeness", "edition", "ratified_at", "scope"]);
  assert.deepEqual(w.promotion.fact("publishedCaseRegistry", ["CASE-2026-0001"]).value, creg);
  assert.deepEqual(w.p.publishedCaseRegistryFor([]), {});
});

test("R12 publishedTargets answers R7's registry for those ids; excludedBy answers every case naming a document in its exclusions", () => {
  const { w } = published();
  assert.deepEqual(w.op("publishedtargets", { ids: `${F},${DOC}, ,NOPE` }).registry, w.p.publishedRegistryFor(null, [F, DOC, "NOPE"]));
  assert.equal(Object.keys(w.p.publishedTargets(Array.from({ length: 300 }, (_, i) => `X-${i}`)).registry).length, 0);
  /* a ratified case document's exclusion answers anybody a member of its roster is visible to */
  const by = w.op("excludedby", { id: DOC, viewer: V("bo") });
  assert.deepEqual(by.cases.map((c) => [c.case_id, c.bundle_id, c.description, c.from]),
                   [["CASE-2026-0001", F, "the minutes", "case_document"]]);
  /* an inquiry's live exclusions answer too, through inquiry's read */
  w.inquiry(G, { extra: ["completeness_excluded:", `  - target: ${DOC}`, '    description: "live row"', '    reason: "scope"'] });
  const both = w.p.excludedBy(DOC, V("bo")).cases;
  assert.ok(both.some((c) => c.bundle_id === G && c.description === "live row" && !c.from));
  assert.deepEqual(w.p.excludedBy(DOC, "nobody").cases, [], "a viewer the gate does not recognise sees none");
  assert.equal(w.op("excludedby", {}).reason, "NO_ID");
});

test("R14 delivererOf answers founder, member or undetermined from the stored value alone; deliveringPrincipal from the session alone", () => {
  assert.deepEqual(delivererOf("founder"), { kind: "founder", member: null });
  assert.deepEqual(delivererOf("member:olive"), { kind: "member", member: "olive" });
  for (const v of [null, undefined, "", "member:", "admin", "olive", 7])
    assert.deepEqual(delivererOf(v), { kind: "undetermined", member: null, detail: DELIVERER_UNDETERMINED_DETAIL });
  assert.equal(deliveringPrincipal({ role: "admin" }), "founder");
  assert.equal(deliveringPrincipal({ role: "member:bo" }), "member:bo");
  for (const s of [null, {}, { role: "member:" }, { role: "class:ai" }, { role: 3 }]) assert.equal(deliveringPrincipal(s), null);
});

test("R22 commitEdition appends one published edition inside the caller's transaction, answers existed for a retry, and refuses anything else there with nothing written", () => {
  const { w, pin } = published();
  const retry = w.signFinding(F, { edges: [{ to: DOC, kind: "cites", disclosure: "serve" }] });
  assert.deepEqual([retry.ok, retry.existed, retry.edition], [true, true, 1]);
  assert.equal(w.count("published_bundles"), 1);
  const before = w.snapshot(PUBLISHED);
  /* other bytes claiming the same edition */
  const exists = w.record.transact(() => w.p.commitEdition({ bundleId: F, bundleSha: "f".repeat(64), edition: 1, title: "t",
    shas: [], attestorKey: "k", gateVersion: "g", sigArmored: SIG(3), edges: [], at: NOW }));
  assert.deepEqual([exists.ok, exists.reason, exists.published], [false, "EDITION_EXISTS", pin]);
  const stale = w.record.transact(() => w.p.commitEdition({ bundleId: F, bundleSha: "e".repeat(64), edition: 1,
    shas: [], attestorKey: "k", gateVersion: "g", sigArmored: SIG(3), edges: [] }));
  assert.equal(stale.reason, "EDITION_EXISTS");
  const low = w.record.transact(() => w.p.commitEdition({ bundleId: F, bundleSha: "d".repeat(64), edition: 0,
    shas: [], attestorKey: "k", gateVersion: "g", sigArmored: SIG(3), edges: [] }));
  assert.deepEqual([low.reason, low.highest], ["EDITION_NOT_INCREMENTED", 1]);
  assert.deepEqual(w.snapshot(PUBLISHED), before, "a refusal writes nothing");
  assert.equal(w.p.commitEdition({ bundleId: F }).reason, "MALFORMED");
  /* the next edition of other bytes is appended, and edition 1 keeps answering */
  const next = w.record.transact(() => w.p.commitEdition({ bundleId: F, bundleSha: "c".repeat(64), title: "t",
    shas: [{ sha256: "c".repeat(64), path: "bundle.md", kind: "bundle" }], attestorKey: "k", attestorMember: "bo",
    gateVersion: "g", sigArmored: SIG(4), edges: [], at: "2026-09-29T00:00:00Z" }));
  assert.deepEqual([next.ok, next.edition, next.existed], [true, 2, false]);
  assert.deepEqual(w.rows(`SELECT edition, bundle_sha FROM published_bundles ORDER BY edition`).map((r) => r.edition), [1, 2]);
  /* a refusing caller rolls it back */
  const rolled = w.record.transact(() => {
    w.p.commitEdition({ bundleId: G, bundleSha: "b".repeat(64), shas: [], attestorKey: "k", gateVersion: "g",
                        sigArmored: SIG(5), edges: [] });
    return { ok: false, reason: "CALLER_REFUSED" };
  });
  assert.equal(rolled.reason, "CALLER_REFUSED");
  assert.equal(w.row(`SELECT COUNT(*) AS n FROM published_bundles WHERE bundle_id=?`, G).n, 0);
});

test("R22 commitCaseEdition records the owner, the edition's assertions, the roster with its pins and the signature, answers existed, awaiting and state, and refuses a signed or foreign case", () => {
  const w = world();
  w.member("olive");
  const proj = w.project("Parks", "olive");
  w.inquiry(F); w.inquiry(G);
  const roles = [{ target: F, version_sha: w.head(F) }, { target: G, version_sha: w.head(G), role: "supporting" }];
  assert.equal(w.signCase("CASE-2026-0001", 1, { project: proj, roster: roster(roles) }).reason, "NO_CASE_DOCUMENT");
  w.prepare("CASE-2026-0001", 1, { project: proj, roles });
  const bar = { declared: true, capture: "B", connection: "C" };
  const c = w.signCase("CASE-2026-0001", 1, { project: proj, roster: roster(roles), bar });
  assert.deepEqual([c.ok, c.existed, c.awaiting, c.state.complete, c.state.project], [true, false, [F, G], false, proj]);
  assert.equal(w.row(`SELECT project_id FROM cases`).project_id, proj);
  const pc = w.row(`SELECT * FROM published_cases`);
  assert.deepEqual([pc.scope, pc.bias_acknowledgement, JSON.parse(pc.bar).capture], ["The question.", "none declared", "B"]);
  assert.deepEqual(w.rows(`SELECT ord, bundle_id, role FROM published_case_members ORDER BY ord`),
                   [{ ord: 0, bundle_id: F, role: "load_bearing" }, { ord: 1, bundle_id: G, role: "supporting" }]);
  const d = w.row(`SELECT sig_armored, attestor_member, delivered_by, ratified_at FROM case_documents`);
  assert.deepEqual([d.sig_armored, d.attestor_member, d.delivered_by, d.ratified_at], [SIG(1), "olive", V("olive"), NOW]);
  const before = w.snapshot(PUBLISHED);
  const again = w.signCase("CASE-2026-0001", 1, { project: proj, roster: roster(roles) });
  assert.deepEqual([again.ok, again.existed], [true, true]);
  const other = w.signCase("CASE-2026-0001", 1, { project: proj, roster: roster(roles), sig: SIG(8) });
  assert.equal(other.reason, "CASE_EDITION_ALREADY_RATIFIED");
  w.prepare("CASE-2026-0001", 2, { project: "PROJ-OTHER", roles });
  const foreign = w.signCase("CASE-2026-0001", 2, { project: "PROJ-OTHER", roster: roster(roles) });
  assert.deepEqual([foreign.reason, foreign.declared, foreign.signed], ["CASE_PRODUCTION_DIVERGED", proj, "PROJ-OTHER"]);
  const after = w.snapshot(PUBLISHED);
  delete before.case_documents; delete after.case_documents;
  assert.deepEqual(after, before, "a retry and a refusal write nothing published");
  assert.equal(w.p.commitCaseEdition({ case: "", edition: 1 }).reason, "MALFORMED");
});

test("R24 nothing updates or deletes a published row, a signed document or a published hash: a correction is a new edition, and an edition answers forever", () => {
  const { w, proj, pin, roles } = published();
  const frozen = w.snapshot(["published_bundles", "published_shas", "published_cases", "published_case_members", "cases"]);
  const signedDoc = w.row(`SELECT * FROM case_documents`);
  /* every write this module offers, aimed at what is already published */
  w.p.storeCaseDocument({ case: "CASE-2026-0001", edition: 1, text: "---\nx: 1\n---\n", author: V("bo") });
  w.p.reauthorSection({ case: "CASE-2026-0001", edition: 1, docSha: signedDoc.doc_sha, section: "attribution",
                        lines: { frontmatter: [], body: [] } });
  w.signCase("CASE-2026-0001", 1, { project: proj, roster: roster(roles), sig: SIG(8) });
  w.record.transact(() => w.p.commitEdition({ bundleId: F, bundleSha: "a".repeat(64), edition: 1, shas: [],
    attestorKey: "k", gateVersion: "g", sigArmored: SIG(9), edges: [] }));
  w.p.recordCaseManifest({ caseId: "CASE-2026-0001", edition: 1, manifest: { m: 1 }, manifestSha: "1".repeat(64) });
  const moved = w.p.recordCaseManifest({ caseId: "CASE-2026-0001", edition: 1, manifest: { m: 2 }, manifestSha: "2".repeat(64) });
  assert.equal(moved.reason, "MANIFEST_EXISTS");
  assert.deepEqual(w.row(`SELECT * FROM case_documents`), signedDoc);
  const now = w.snapshot(["published_bundles", "published_shas", "published_cases", "published_case_members", "cases"]);
  /* the only changes: the manifest recorded once (its hash appended, its case row naming it) */
  assert.deepEqual(now.published_bundles, frozen.published_bundles);
  assert.deepEqual(now.published_case_members, frozen.published_case_members);
  assert.deepEqual(now.cases, frozen.cases);
  const shas = JSON.parse(now.published_shas);
  assert.deepEqual(shas.slice(0, JSON.parse(frozen.published_shas).length), JSON.parse(frozen.published_shas), "append-only");
  assert.ok(shas.some((r) => r.sha256 === pin), "the published hash still answers");
});

test("R25 R12 what stays here of the public read path needs no credential and reads the published projection only: working material is never answered", () => {
  const w = world();
  w.member("olive");
  const proj = w.project("Parks", "olive");
  w.doc(DOC);
  w.inquiry(F, { extra: ["completeness_excluded:", `  - target: ${DOC}`, '    description: "live row"', '    reason: "scope"'] });
  const pin = w.head(F);
  w.prepare("CASE-2026-0001", 1, { project: proj, roles: [{ target: F, version_sha: pin }],
                                   excluded: [{ target: DOC, description: "the minutes" }] });
  const fresh = world();
  /* a prepared (unsigned) case and a working finding answer the credential-free reads as if nothing were there */
  for (const [op, q] of [["publishedtargets", { ids: `${F},${DOC}` }], ["caseflags", {}], ["caseflags", { case: "CASE-2026-0001" }],
                         ["caseflags", { target: F }]]) {
    const a = w.op(op, q), b = fresh.op(op, q);
    assert.deepEqual(a, b, `${op} ${JSON.stringify(q)} answers as if nothing were there`);
  }
  assert.deepEqual(w.p.caseEditionState("CASE-2026-0001", 1), null, "an unsigned preparation is no published case edition");
  const doc = w.row(`SELECT doc_sha FROM case_documents`).doc_sha;
  assert.deepEqual(w.p.publishedCaseDocumentText(doc), { found: false }, "an unsigned document's text is unreachable");
  /* excludedBy (R12) answers an unsigned document's exclusion only to standing, never to a stranger */
  assert.deepEqual(w.p.excludedBy(DOC, "nobody").cases, []);
  assert.equal(w.p.excludedBy(DOC, V("stranger")).cases.some((c) => c.from === "case_document"), false);
});
test("R26 no answer, document or row this module serves composes a case-level strength: every pair is per member and per axis", () => {
  const { w } = published();
  const st = w.p.caseEditionState("CASE-2026-0001", 1);
  assert.equal("strength" in st, false);
  assert.equal("strength" in st.document, false);
  for (const f of st.findings) assert.ok(Array.isArray(f.strength) && f.strength.every((s) => s.axis));
  const doc = w.p.caseDocument("CASE-2026-0001", 1, null);
  assert.equal("strength" in doc, false);
  for (const c of Object.values(w.p.publishedCaseRegistryFor(["CASE-2026-0001"])))
    for (const e of Object.values(c.editions)) assert.equal("strength" in e, false);
  for (const e of w.p.publishedEditionsOf({ finding: F }).items)
    assert.deepEqual(Object.keys(e.strength).sort(), ["capture", "connection"], "per axis, never composed");
  for (const r of w.rows(`SELECT * FROM published_cases`)) assert.equal("strength" in r, false);
});

test("R27 signer and deliverer are two facts, and neither is copied from the other", () => {
  const w = world();
  w.member("olive");
  const proj = w.project("Parks", "olive");
  w.inquiry(F);
  const pin = w.head(F);
  w.prepare("CASE-2026-0001", 1, { project: proj, roles: [{ target: F, version_sha: pin }] });
  w.record.transact(() => w.p.commitCaseEdition({ case: "CASE-2026-0001", edition: 1, project: proj,
    roster: [{ bundle_id: F, version_sha: pin }], sigArmored: SIG(1), attestorKey: "k", attestorMember: "olive",
    gateVersion: "g", deliveredBy: "founder", at: NOW }));
  w.record.transact(() => w.p.commitEdition({ bundleId: F, bundleSha: pin, shas: [], attestorKey: "k",
    attestorMember: "olive", gateVersion: "g", sigArmored: SIG(2), deliveredBy: null, edges: [] }));
  const doc = w.p.caseDocument("CASE-2026-0001", 1, null);
  assert.deepEqual([doc.attestor_member, doc.delivered_by], ["olive", { kind: "founder", member: null }]);
  const row = w.p.caseEditionState("CASE-2026-0001", 1).findings[0];
  assert.equal(row.attestor.member, "olive");
  assert.equal(row.delivered_by.kind, "undetermined", "a deliverer never recorded is not read off the signer");
});

test("R28 undetermined is stated and never filled: a deliverer, an acknowledgement list a document is silent about, a citation's version before /4", () => {
  const { w } = published();
  w.st.sql.exec(`UPDATE published_bundles SET delivered_by=NULL`);
  const f = w.p.caseEditionState("CASE-2026-0001", 1).findings[0];
  assert.deepEqual(f.delivered_by, { kind: "undetermined", member: null, detail: DELIVERER_UNDETERMINED_DETAIL });
  assert.equal(w.p.caseDocument("CASE-2026-0001", 1, null).citations.state, "signed");
  /* the completeness a caller commits is stored as given: a list the document was silent about stays null */
  const w2 = world();
  w2.member("olive");
  const proj = w2.project("Parks", "olive");
  w2.inquiry(F);
  const pin = w2.head(F);
  w2.prepare("CASE-2026-0001", 1, { project: proj, roles: [{ target: F, version_sha: pin }] });
  w2.signCase("CASE-2026-0001", 1, { project: proj, roster: [{ bundle_id: F, version_sha: pin }],
                                     completeness: { statement: "s", acknowledgements: null } });
  assert.equal(JSON.parse(w2.row(`SELECT completeness FROM published_cases`).completeness).acknowledgements, null);
  /* a document signed before /4 (as a store signed it before T28) states its citations undetermined */
  w2.prepare("CASE-2026-0002", 1, { project: proj, roles: [{ target: F, version_sha: pin }], format: "bio-case-document/2" });
  w2.signLegacy("CASE-2026-0002", 1, { project: proj, roster: [{ bundle_id: F, version_sha: pin }] });
  assert.equal(w2.p.caseDocument("CASE-2026-0002", 1, null).citations.state, "undetermined");
});

test("R35 publishing a target turns every name edge a published finding holds to it into a serve edge, in the same transaction", () => {
  const { w } = published();
  /* F named G (not yet published) and holds a division disclosure to DOC by kind */
  w.st.sql.exec(`INSERT INTO published_edges (from_bundle, to_bundle, kind, disclosure, published) VALUES (?,?,?,?,?)`,
                F, G, "cites", "name", NOW);
  w.st.sql.exec(`INSERT INTO published_edges (from_bundle, to_bundle, kind, disclosure, published) VALUES (?,?,?,?,?)`,
                F, G, "division_sibling", "name", NOW);
  w.st.sql.exec(`INSERT INTO published_edges (from_bundle, to_bundle, kind, disclosure, published) VALUES (?,?,?,?,?)`,
                "UNPUBLISHED-1", G, "cites", "name", NOW);
  w.inquiry(G);
  const r = w.record.transact(() => w.p.commitEdition({ bundleId: G, bundleSha: w.head(G), shas: [], attestorKey: "k",
    gateVersion: "g", sigArmored: SIG(6), edges: [] }));
  assert.equal(r.namesServed, 1);
  assert.deepEqual(w.rows(`SELECT from_bundle, kind, disclosure FROM published_edges WHERE to_bundle=? ORDER BY from_bundle, kind`, G),
                   [{ from_bundle: F, kind: "cites", disclosure: "serve" },
                    { from_bundle: F, kind: "division_sibling", disclosure: "name" },
                    { from_bundle: "UNPUBLISHED-1", kind: "cites", disclosure: "name" }]);
  assert.equal(w.row(`SELECT COUNT(*) AS n FROM published_edges WHERE from_bundle=? AND disclosure='serve'`, F).n, 1,
               "F serves G alone: DOC's reference stays held");
});

test("R22 (N256) a reference to evidence not yet published is held privately, never in the published graph, and becomes a serve edge when the evidence is published", () => {
  /* F is published citing DOC, which is not published yet */
  const { w } = published();
  const edgesTo = (to) => w.rows(`SELECT from_bundle, kind, disclosure FROM published_edges WHERE to_bundle=? ORDER BY from_bundle`, to);
  assert.deepEqual(w.rows(`SELECT from_bundle, to_bundle, kind, linked_at FROM published_held_references`),
                   [{ from_bundle: F, to_bundle: DOC, kind: "cites", linked_at: null }]);
  assert.deepEqual(edgesTo(DOC), [], "held, not in the published graph");
  const retry = w.signFinding(F, { edges: [{ to: DOC, kind: "cites", disclosure: "serve" }] });
  assert.deepEqual([retry.existed, retry.edges], [true, { serve: 0, name: 0, held: 1, dropped: 0 }]);
  assert.equal(w.count("published_held_references"), 1, "held once");
  /* the id is never published while held: the published graph and the registry name it nowhere (the case's own signed
     document names DOC among its exclusions: that is the case's statement, not the graph's) */
  assert.equal(w.row(`SELECT COUNT(*) AS n FROM published_edges WHERE to_bundle=? OR from_bundle=?`, DOC, DOC).n, 0);
  for (const read of [w.op("publishedtargets", { ids: F }), w.p.caseEditionState("CASE-2026-0001", 1).findings])
    assert.equal(JSON.stringify(read).includes(DOC), false);
  /* a held reference to another target stays held when DOC is published */
  w.record.transact(() => w.p.publishEdges(F, [{ to: G, kind: "cites", disclosure: "serve" }], NOW));
  w.clock.now = "2026-09-29T00:00:00Z";
  const pub = w.signFinding(DOC, { sig: SIG(7), at: "2026-09-29T00:00:00Z" });
  assert.deepEqual([pub.ok, pub.heldLinked], [true, 1]);
  assert.deepEqual(edgesTo(DOC), [{ from_bundle: F, kind: "cites", disclosure: "serve" }]);
  assert.deepEqual(w.rows(`SELECT to_bundle, linked_at FROM published_held_references ORDER BY to_bundle`),
                   [{ to_bundle: G, linked_at: null }, { to_bundle: DOC, linked_at: "2026-09-29T00:00:00Z" }]
                     .sort((a, b) => (a.to_bundle < b.to_bundle ? -1 : 1)));
  assert.deepEqual(w.rows(`SELECT to_bundle FROM published_edges WHERE from_bundle=? AND disclosure='serve'`, F).map((e) => e.to_bundle), [DOC]);
  /* publishing it again links nothing more */
  assert.equal("heldLinked" in w.signFinding(DOC, { sig: SIG(7) }), false);
  assert.equal(edgesTo(G).length, 0);
});

test("R35 turns every name edge and every held reference to a target set-wise, over many edges, reading none into the worker's memory, and counts what it turned (N237, N277)", () => {
  const { w } = published();
  const N = 400;
  for (let i = 0; i < N; i++) {
    const id = `INQ-2026-9${String(i).padStart(3, "0")}`;
    w.st.sql.exec(`INSERT INTO published_bundles (bundle_id, edition, bundle_sha, ratified_at, attestor_key, gate_version, sig_armored)
                   VALUES (?, 1, ?, ?, 'k', 'g', 's')`, id, `s${i}`, NOW);
    w.st.sql.exec(`INSERT INTO published_edges (from_bundle, to_bundle, kind, disclosure, published) VALUES (?,?,?,?,?)`,
                  id, G, "cites", "name", NOW);
    w.st.sql.exec(`INSERT INTO published_held_references (from_bundle, to_bundle, kind, held_at) VALUES (?,?,?,?)`,
                  id, G, "supports", NOW);
  }
  /* a name edge from an unpublished finding and a division's disclosure never turn; a held row from one is never linked */
  w.st.sql.exec(`INSERT INTO published_edges (from_bundle, to_bundle, kind, disclosure, published) VALUES ('UNPUB-1', ?, 'cites', 'name', ?)`, G, NOW);
  w.st.sql.exec(`INSERT INTO published_edges (from_bundle, to_bundle, kind, disclosure, published) VALUES (?, ?, 'division_sibling', 'name', ?)`, F, G, NOW);
  w.st.sql.exec(`INSERT INTO published_held_references (from_bundle, to_bundle, kind, held_at) VALUES ('UNPUB-1', ?, 'supports', ?)`, G, NOW);
  w.inquiry(G);
  /* every read the commit makes, measured at the storage: the most rows any one statement handed the worker */
  const exec = w.st.sql.exec;
  let most = 0;
  w.st.sql.exec = (q, ...a) => { const rows = exec.call(w.st.sql, q, ...a).toArray(); most = Math.max(most, rows.length); return cursor(rows); };
  const r = w.record.transact(() => w.p.commitEdition({ bundleId: G, bundleSha: w.head(G), shas: [], attestorKey: "k",
    gateVersion: "g", sigArmored: SIG(6), edges: [], at: NOW }));
  w.st.sql.exec = exec;
  assert.deepEqual([r.ok, r.namesServed, r.heldLinked], [true, N, N]);
  assert.ok(most <= 2, `no statement read the edges into memory (most rows handed back: ${most})`);
  const by = (d, k) => w.row(`SELECT COUNT(*) AS n FROM published_edges WHERE to_bundle=? AND disclosure=? AND kind=?`, G, d, k).n;
  assert.deepEqual([by("serve", "cites"), by("serve", "supports"), by("name", "cites"), by("name", "division_sibling")], [N, N, 1, 1]);
  assert.deepEqual(w.rows(`SELECT from_bundle FROM published_held_references WHERE to_bundle=? AND linked_at IS NULL`, G),
                   [{ from_bundle: "UNPUB-1" }], "the unpublished finding's stays held");
});

