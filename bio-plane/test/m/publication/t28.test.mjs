/* publication — what a case carries at its commit (T28): its materials held by SHA-256 (R57; DEC-112, K1315, K1316), a
   pre-/6 preparation refused (R58, C-122.2; a /7 one read as /6, N538), another group's accepted work re-read (R59, C-122.3, C-122.4; N522), the
   manifest's files registered (R15, K1315). The attesting member's credit for off-the-record material (R60) moved to
   `case-tensions` (its R7, T33-62) with its tests. `accepted-work` is the real module, with a stand-in registered as
   case-import registers; extraction's units are the fixture's stand-in. Driven at the module's interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { planeWorld as world, caseDoc, V, SIG, NOW, sha } from "./fixture.mjs";
import { CASE_SOURCES_CHECKS } from "../../../src/publication/checks.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { extractedTextOf } from "../../../src/case-grammar/index.mjs";

const F = "INQ-2026-0001", DOC = "INFO-2026-0001-minutes", CASE = "CASE-2026-0001";
const roster = (roles) => roles.map((r) => ({ bundle_id: r.target, version_sha: r.version_sha, role: "load_bearing" }));
const textOf = (id) => `the text of ${id}`;

function base() {
  const w = world();
  w.member("olive"); w.member("ann"); w.member("bo");
  const proj = w.project("Parks", "olive");
  w.doc(DOC);
  w.inquiry(F, { legs: [{ target: DOC }] });
  const roles = [{ target: F, version_sha: w.head(F) }];
  return { w, proj, roles };
}
const expectRow = (r, code, table = CASE_SOURCES_CHECKS) =>
  assert.deepEqual([r.ok, r.reason, r.code, r.check, r.translation],
                   [false, code, code, table[code].check, table[code].translation], code);

/* ---------------------------------------------------------------- R58 */

test("R58 commitCaseEdition refuses a case document whose format is not /6 (nor /7, read as /6: N538) with CASE_FORMAT_SUPERSEDED (C-122.2), nothing committed; a /6 preparation signs; a retry of an edition signed before T28 still answers existed", () => {
  const { w, proj, roles } = base();
  assert.equal(CASE_SOURCES_CHECKS.CASE_FORMAT_SUPERSEDED.translation, word("refusal.CASE_FORMAT_SUPERSEDED"));
  for (const format of ["bio-case-document/5", "bio-case-document/4", "bio-case-document/3", "bio-case-document/2",
                        "bio-case-document/1"]) {
    w.prepare(CASE, 1, { project: proj, roles, format });
    const before = w.snapshot();
    const r = w.signCase(CASE, 1, { project: proj, roster: roster(roles) });
    expectRow(r, "CASE_FORMAT_SUPERSEDED");
    assert.equal(r.format, format);
    assert.deepEqual(w.snapshot(), before, `${format}: nothing committed`);
  }
  /* the remedy: a new preparation, in /6, signs */
  w.prepare(CASE, 1, { project: proj, roles });
  assert.equal(w.signCase(CASE, 1, { project: proj, roster: roster(roles) }).ok, true);
  /* an edition signed before T28 (an older format) answers a retry of its own signature as existed, never re-read */
  w.prepare("CASE-2026-0002", 1, { project: proj, roles, format: "bio-case-document/5" });
  w.signLegacy("CASE-2026-0002", 1, { project: proj, roster: roster(roles), sig: SIG(7) });
  const again = w.signCase("CASE-2026-0002", 1, { project: proj, roster: roster(roles), sig: SIG(7) });
  assert.deepEqual([again.ok, again.existed], [true, true]);
});

test("R58 R57 R55 (N538; DEC-124, K1365 (1), K1367) a bio-case-document/7 preparation is read exactly as /6: it is not superseded and signs, the materials its block includes are held, its member blocks answer; a /6 preparation still signs", () => {
  for (const format of ["bio-case-document/7", "bio-case-document/6"]) {
    const { w, proj, roles } = base();
    const docSha = sha(textOf(DOC));
    const materials = [{ ref: DOC, kind: "document", sha: docSha, text_sha: null, origin: null, archived_copy: null,
                         included: true, rests_under: "load_bearing" }];
    w.prepare(CASE, 1, { project: proj, roles, format, materials });
    assert.equal(w.p.caseDocumentFacts(CASE, 1, V("olive")).ok, true, `${format}: its facts answer`);
    const r = w.signCase(CASE, 1, { project: proj, roster: roster(roles) });
    assert.equal(r.ok, true, `${format}: ${JSON.stringify(r)}`);
    assert.notEqual(r.reason, "CASE_FORMAT_SUPERSEDED");
    assert.deepEqual(r.materials, [{ sha: docSha, held: "inline" }], `${format}: its included material is held`);
    assert.deepEqual(w.p.publishedMaterialText(docSha), { found: true, sha256: docSha, kind: "document", text: textOf(DOC) });
    const frozen = w.p.caseDocMemberFrozen(CASE, 1);
    assert.ok(frozen && frozen.get(F), `${format}: its member blocks are read`);
    assert.equal(frozen.get(F).version_sha, roles[0].version_sha);
    assert.equal(w.p.caseEditionState(CASE, 1).document.doc_sha, r.doc_sha);
  }
});

/* ---------------------------------------------------------------- R59 */

const IMP = "a".repeat(64);
const REF = `imported:${IMP}/INQ-2026-0042-their-finding`;
const awRow = (over = {}) => ({ member: F, leg_of: F, ref: REF, group: "other-group", case: "CASE-2026-0042", edition: 2,
  finding: "INQ-2026-0042-their-finding", manifest_sha: "b".repeat(64),
  pair: { capture: { state: "graded", grade: "B" }, connection: { state: "graded", grade: "C" } }, result: "recreated", gaps: [],
  accepted_by: V("olive"), accepted_at: NOW, reason: "we checked it", ...over });
const flagRow = (flag, over = {}) => ({ ref: REF, edition: 2, flag, issue: "a date is wrong", flagged_at: NOW, words: "noted",
  acknowledged_by: V("olive"), acknowledged_at: NOW, ...over });

/* case-import's registration, as a stand-in: `state` decides each answer; every read is recorded. */
function importer(w, state) {
  const calls = [];
  const r = w.acceptedWork.registerAcceptedWork("case-import", {
    finding: (a) => { calls.push(["finding", a]); return state.finding(a); },
    openFlags: (a) => { calls.push(["openFlags", a]); return state.openFlags(a); },
    withdrawals: () => ({ withdrawals: [], cursor: null }) });
  assert.equal(r.ok, true);
  return calls;
}
const accepted = (a, edition = 2) => ({ ref: a.ref, import: IMP, group: "other-group", case: "CASE-2026-0042", edition,
  finding: "INQ-2026-0042-their-finding", manifest_sha: "b".repeat(64), result: "recreated", pair: { capture: "B" },
  acceptance: { by: V("olive"), at: NOW, reason: "we checked it", checked: "all of it", gaps: null } });

test("R59 commitCaseEdition re-reads each accepted_work row through accepted-work as the signer: an acceptance in force and every open flag disclosed signs", () => {
  const { w, proj, roles } = base();
  const calls = importer(w, { finding: (a) => accepted(a), openFlags: () => ({ flags: [{ flag: "FLAG-1", issue: "x", at: NOW }], complete: true }) });
  w.prepare(CASE, 1, { project: proj, roles, acceptedWork: [awRow(), awRow({ member: F, leg_of: F })], acceptedWorkFlags: [flagRow("FLAG-1")] });
  const r = w.signCase(CASE, 1, { project: proj, roster: roster(roles), signer: "olive" });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(calls, [["finding", { ref: REF, edition: 2, viewer: V("olive") }], ["openFlags", { ref: REF, edition: 2, viewer: V("olive") }]],
                   "one read per (ref, edition), as the signer's member");
});

test("R59 an acceptance no longer in force is ACCEPTANCE_WITHDRAWN_SINCE (C-122.3), nothing committed: withdrawn, another edition, absent, unreadable, a flags read not complete", () => {
  const cases = [
    ["withdrawn", { finding: (a) => ({ ...accepted(a), acceptance: null }) }],
    ["the finding not held", { finding: () => null }],
    ["accepted at another edition", { finding: (a) => accepted(a, 3) }],
    ["the read throws", { finding: () => { throw new Error("down"); } }],
    ["the flags read is incomplete", { finding: (a) => accepted(a), openFlags: () => ({ flags: [], complete: false }) }],
    ["the flags read throws", { finding: (a) => accepted(a), openFlags: () => { throw new Error("down"); } }],
  ];
  for (const [label, state] of cases) {
    const { w, proj, roles } = base();
    importer(w, { openFlags: () => ({ flags: [], complete: true }), ...state });
    w.prepare(CASE, 1, { project: proj, roles, acceptedWork: [awRow()] });
    const before = w.snapshot();
    const r = w.signCase(CASE, 1, { project: proj, roster: roster(roles) });
    expectRow(r, "ACCEPTANCE_WITHDRAWN_SINCE");
    assert.deepEqual(r.accepted_work, [{ ref: REF, edition: 2 }], label);
    assert.deepEqual(w.snapshot(), before, `${label}: nothing committed`);
  }
  /* nothing registered at all: absent counts as not in force */
  const { w, proj, roles } = base();
  w.prepare(CASE, 1, { project: proj, roles, acceptedWork: [awRow()] });
  expectRow(w.signCase(CASE, 1, { project: proj, roster: roster(roles) }), "ACCEPTANCE_WITHDRAWN_SINCE");
});

test("R59 an open flag on a row's edition the document does not disclose is FLAG_OPENED_SINCE (C-122.4), naming each, nothing committed; a document stating no accepted work reads nothing", () => {
  const { w, proj, roles } = base();
  const calls = importer(w, { finding: (a) => accepted(a),
    openFlags: () => ({ flags: [{ flag: "FLAG-1", issue: "a", at: NOW }, { flag: "FLAG-2", issue: "b", at: NOW }], complete: true }) });
  w.prepare(CASE, 1, { project: proj, roles, acceptedWork: [awRow()], acceptedWorkFlags: [flagRow("FLAG-1"), flagRow("FLAG-2", { edition: 3 })] });
  const before = w.snapshot();
  const r = w.signCase(CASE, 1, { project: proj, roster: roster(roles) });
  expectRow(r, "FLAG_OPENED_SINCE");
  assert.deepEqual(r.flags, [{ ref: REF, edition: 2, flag: "FLAG-2", issue: "b" }], "disclosed at another edition is not disclosed");
  assert.deepEqual(w.snapshot(), before);
  /* the same case with no accepted work: accepted-work is not asked */
  calls.length = 0;
  w.prepare("CASE-2026-0003", 1, { project: proj, roles });
  assert.equal(w.signCase("CASE-2026-0003", 1, { project: proj, roster: roster(roles) }).ok, true);
  assert.deepEqual(calls, []);
});

/* ---------------------------------------------------------------- R57 */

const UNITS = [{ seq: 0, extent: { kind: "document" }, ref: "¶1", text: "The minutes say so.", truncated: false }];

test("R57 at the commit the published projection comes to hold, by SHA-256, each included document's bytes and extracted text and each included observation's whole text; nothing for material not included; each answered, exempt from purge", () => {
  const { w, proj, roles } = base();
  const docSha = sha(textOf(DOC));
  w.units.set(docSha, { units: UNITS, state: "whole" });
  const extracted = extractedTextOf(UNITS);
  const obs = w.observe("ann");
  const obsSha = w.row(`SELECT capture_sha FROM register WHERE bundle_id=?`, obs).capture_sha;
  const obsText = w.row(`SELECT content FROM files WHERE bundle_id=? AND path=(SELECT path FROM register WHERE bundle_id=?)`, obs, obs).content;
  w.doc("INFO-2026-0002-annex");
  const annexSha = sha(textOf("INFO-2026-0002-annex"));
  const materials = [
    { ref: DOC, kind: "document", sha: docSha, text_sha: sha(extracted), origin: "https://example.org/m", archived_copy: null, included: true, rests_under: "load_bearing" },
    { ref: obs, kind: "observation", sha: obsSha, text_sha: null, origin: null, archived_copy: null, included: true, rests_under: "load_bearing" },
    { ref: "INFO-2026-0002-annex", kind: "document", sha: annexSha, text_sha: null, origin: null, archived_copy: null, included: false, rests_under: "supporting" },
  ];
  w.prepare(CASE, 1, { project: proj, roles, materials });
  const r = w.signCase(CASE, 1, { project: proj, roster: roster(roles) });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.materials, [{ sha: docSha, held: "inline" }, { sha: sha(extracted), held: "inline" },
                                 { sha: obsSha, held: "inline" }]);
  assert.deepEqual(r.materials_unheld, []);
  /* K1317: the same list, read back for the committed edition (a retried ratification's), and none for another */
  assert.deepEqual(w.p.heldMaterialsOf(CASE, 1), r.materials);
  assert.deepEqual(w.p.heldMaterialsOf(CASE, 2), []);
  assert.deepEqual(w.p.heldMaterialsOf("CASE-NONE", 1), []);
  for (const [s, kind, text] of [[docSha, "document", textOf(DOC)], [sha(extracted), "extracted_text", extracted], [obsSha, "observation", obsText]]) {
    assert.deepEqual(w.p.publishedMaterialText(s), { found: true, sha256: s, kind, text });
    assert.equal(sha(text), s, "held by its own SHA-256");
    assert.deepEqual(w.rows(`SELECT kind, path FROM published_shas WHERE sha256=? AND path LIKE 'materials/%'`, s), [{ kind, path: `materials/${s}` }]);
  }
  assert.deepEqual(w.p.publishedMaterialText(annexSha), { found: false }, "a material not included is not held");
  assert.equal(w.row(`SELECT COUNT(*) AS n FROM published_shas WHERE sha256=?`, annexSha).n, 0);
  /* exempt from purge, as published bytes are */
  const kept = w.snapshot(["published_material_texts", "published_shas"]);
  w.record.purge({});
  w.record.purge({ bundleId: DOC });
  assert.deepEqual(w.snapshot(["published_material_texts", "published_shas"]), kept);
});

test("R57 a document's bytes held only in the evidence store are registered and answered held evidence (ratification R39 copies them); a material this copy cannot hold at its digest is answered in materials_unheld and never refuses the commit", () => {
  const { w, proj, roles } = base();
  const big = sha("bytes held in the evidence store only");
  w.st.sql.exec(`INSERT INTO register (capture_sha, bundle_id, path, encoding, bytes, registered) VALUES (?, ?, 'snapshots/big.pdf', 'binary', 999, ?)`, big, DOC, NOW);
  /* fetched by this copy (provenance R62), so case-carriage carries it whole as captured (its R13; T39) */
  assert.equal(w.prov.recordReceipt({ addressNorm: "example.org/big.pdf", captureSha: big, retrieved: NOW, via: "direct" }).recorded, true);
  const docSha = sha(textOf(DOC));
  w.units.set(docSha, { units: UNITS, state: "partial" });
  const materials = [
    { ref: DOC, kind: "document", sha: big, text_sha: sha("whatever"), included: true, rests_under: "load_bearing" },
    { ref: DOC, kind: "document", sha: docSha, text_sha: sha(extractedTextOf(UNITS)), included: true, rests_under: "load_bearing" },
    { ref: "INFO-2026-0404-gone", kind: "document", sha: sha("never captured"), text_sha: null, included: true, rests_under: "supporting" },
    { ref: "INFO-2026-0405-obs", kind: "observation", sha: sha("no such words"), text_sha: null, included: true, rests_under: "supporting" },
  ];
  w.prepare(CASE, 1, { project: proj, roles, materials });
  const r = w.signCase(CASE, 1, { project: proj, roster: roster(roles) });
  assert.equal(r.ok, true, "never refused for a material it cannot hold");
  assert.deepEqual(r.materials, [{ sha: big, held: "evidence" }, { sha: docSha, held: "inline" }]);
  assert.deepEqual(w.p.heldMaterialsOf(CASE, 1), r.materials, "what is left for ratification R39 to copy is read back");
  assert.deepEqual(w.rows(`SELECT bundle_id, kind, bytes FROM published_shas WHERE sha256=?`, big), [{ bundle_id: DOC, kind: "document", bytes: 999 }]);
  assert.deepEqual(w.p.publishedMaterialText(big), { found: false }, "its bytes are not text here");
  assert.deepEqual(r.materials_unheld.map((m) => [m.ref, m.kind]), [[DOC, "extracted_text"], [DOC, "extracted_text"],
    ["INFO-2026-0404-gone", "document"], ["INFO-2026-0405-obs", "observation"]],
    "no text at a digest that matches (the store's), an index not whole, nothing captured, no such observation");
  for (const m of r.materials_unheld) assert.equal(typeof m.why, "string");
});

test("R57 (K1315) the timestamp tokens an included document's provenance names are held too: inline as text, blob-backed as evidence", () => {
  const { w, proj, roles } = base();
  const id = "INFO-2026-0003-stamped", body = textOf(id), token = "TSA-TOKEN-BYTES";
  const prov = { documents: [{ file: `snapshots/${id}.txt`, locator: `https://example.org/${id}`, retrieved: "2026-09-27T00:00:00Z",
    authority: "the publisher", authority_state: "determined", authority_basis: "named on the document",
    capture: { method: "acquire", grade: "B", actor_class: "session", sha256: sha(body), encoding: "utf8", bytes: Buffer.byteLength(body) },
    origin: { kind: "named_request" }, timestamp: { service: "tsa.example", token_file: "attestations/stamp.tsr" } }] };
  const md = w.text(DOC).replace(new RegExp(DOC, "g"), id);
  const res = w.promotion.promote({ bundleId: id, base: null, snapKey: "k-stamped", author: V("alice"),
    files: [{ path: "bundle.md", text: md }, { path: `snapshots/${id}.txt`, text: body },
            { path: "attestations/stamp.tsr", text: token }, { path: "data/provenance.json", text: JSON.stringify(prov) }],
    meta: { object_type: "information" }, register: [{ sha256: sha(body), path: `snapshots/${id}.txt`, encoding: "utf8", bytes: Buffer.byteLength(body) }] });
  assert.equal(res.ok, true, JSON.stringify(res).slice(0, 300));
  /* fetched by this copy (provenance R62), so case-carriage carries it whole as captured (its R13; T39) */
  assert.equal(w.prov.recordReceipt({ addressNorm: `example.org/${id}`, captureSha: sha(body), retrieved: NOW, via: "direct" }).recorded, true);
  w.prepare(CASE, 1, { project: proj, roles, materials: [{ ref: id, kind: "document", sha: sha(body), text_sha: null, included: true, rests_under: "load_bearing" }] });
  const r = w.signCase(CASE, 1, { project: proj, roster: roster(roles) });
  assert.deepEqual(r.materials, [{ sha: sha(body), held: "inline" }, { sha: sha(token), held: "inline" }]);
  assert.deepEqual(w.p.publishedMaterialText(sha(token)), { found: true, sha256: sha(token), kind: "attestation", text: token });
});

/* ---------------------------------------------------------------- R15 (K1315) */

test("R15 recordCaseManifest registers every file the manifest lists in published_shas in the same act, so each is served by hash; a refusal registers none", () => {
  const { w, proj, roles } = base();
  w.prepare(CASE, 1, { project: proj, roles });
  w.signCase(CASE, 1, { project: proj, roster: roster(roles) });
  const files = [{ path: "case-document.md", sha256: "1".repeat(64), bytes: 10, part: 0, kind: "case_document" },
                 { path: "complete-edition.html", sha256: "2".repeat(64), bytes: 20, part: 0, kind: "complete_edition" }];
  const r = w.p.recordCaseManifest({ caseId: CASE, edition: 1, manifest: { files }, manifestSha: "3".repeat(64) });
  assert.deepEqual([r.ok, r.files], [true, 2]);
  assert.deepEqual(w.rows(`SELECT sha256, bundle_id, path, kind, bytes FROM published_shas WHERE kind IN ('case_document','complete_edition') AND path NOT LIKE 'case-document-edition-%' ORDER BY path`),
                   files.map((f) => ({ sha256: f.sha256, bundle_id: CASE, path: f.path, kind: f.kind, bytes: f.bytes })));
  const before = w.snapshot();
  assert.equal(w.p.recordCaseManifest({ caseId: CASE, edition: 1, manifest: { files: [{ path: "x", sha256: "4".repeat(64) }] },
                                        manifestSha: "5".repeat(64) }).reason, "MANIFEST_EXISTS");
  assert.deepEqual(w.snapshot(), before);
});
