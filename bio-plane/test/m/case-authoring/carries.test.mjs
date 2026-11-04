/* case-authoring (T28; DEC-112 (3)(4)(5), DEC-119; N519): what a `/7` case carries (identical in fields to `/6`, DEC-124) — the method it is signed under (R55 (case-disclosures R5)),
   every document and observation its findings reach with what travels whole and who attests it (R55 (case-disclosures R6, R7)), material from
   a source whose identity is withheld travelling like any other with its attesting member unnamed unless they chose
   otherwise (R55 (case-disclosures R4, R8–R10)), and a named member's self-attested capture unchanged (R55 (case-disclosures R11)). Read back through
   case-grammar's readers (its R1, R11, R12), the one reading of the bytes. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { caseTensionsOf } from "../../../src/case-tensions/index.mjs";
import { world, T0, sha } from "./fixture.mjs";
import { CASE_DOCUMENT_FORMAT, caseDocumentRequiresMaterials, methodOf, materialsOf, caseDocumentBlocks, gradingFactsOf,
         passagesOf, extractedTextOf, GRADING_FACT_FIELDS } from "../../../src/case-grammar/index.mjs";
import { unnamedSourceStatement } from "../../../src/publication/index.mjs";
import { GRADING_METHOD_VERSION, recomputePair } from "../../../src/strength/index.mjs";
import { CATALOG_VERSION } from "../../../src/promotion/index.mjs";
import { canonicalJson } from "../../../src/record-grammar/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const DOC = "INFO-2026-0001-a", DOC2 = "INFO-2026-0002-b", DOC3 = "INFO-2026-0003-c";
const Q = "INQ-2026-0001-q", Q2 = "INQ-2026-0002-q";
const CO_ATTESTED = { attestations: [{ kind: "rfc3161", service: "tsa.example", file: "snapshots/timestamp-abc.tsr",
                                       sha256: "d".repeat(64) }],
                      co_archive: { service: "archive.example", locator: "https://archive.example/web/x" } };
const REASON = "the site refuses the archive's crawler";
const docOf = (w, r) => w.row(`SELECT * FROM case_documents WHERE case_id=? AND edition=?`, r.caseId, r.edition).text;
const bodyOf = (text) => text.slice(text.indexOf("\n---\n", 4) + 5);
const textSha = (bundle) => sha(canonicalJson([{ extent: { kind: "doc-para", para: 1 }, ref: "paragraph 1",
                                                 text: `the text of ${bundle}` }]));
const account = (w, capture, text = "I saved it myself.") => w.st.sql.exec(`INSERT INTO capture_accounts (capture_sha, seq,
  by, text, signature, key_b64, at) VALUES (?, 1, 'alice', ?, 'SIG-of-alice-7f3', 'AAAA', ?)`, capture, text, "2026-09-27T12:00:00Z");

test("R14, R55 (case-disclosures R5): the document is bio-case-document/10 (case-grammar R35, the format in force), which requires the materials blocks as /6 does, and its method: block carries strength's GRADING_METHOD_VERSION and promotion's CATALOG_VERSION at the act, inside what the owner signs", () => {
  const w = world(); w.member("alice"); w.doc(DOC); w.finding(Q, [{ target: DOC }]);
  const r = w.publish(w.project("Team", "alice", [Q]), "alice", [Q]);
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  const fm = w.fm(docOf(w, r));
  assert.deepEqual([fm.format, CASE_DOCUMENT_FORMAT, caseDocumentRequiresMaterials(fm)], ["bio-case-document/10", "bio-case-document/10", true]);
  assert.deepEqual(methodOf(fm), { grading: GRADING_METHOD_VERSION, checks: CATALOG_VERSION });
  assert.ok(bodyOf(docOf(w, r)).includes(`by the grading method ${GRADING_METHOD_VERSION}`));
});

test("R55 (case-disclosures R7, R6): materials: lists every document a member's chain reaches — its fingerprint, its extracted text's fingerprint, its origin and archived copy, whether it travels whole and what rests on it — and material only a supporting member reaches, not held whole, is listed included: false, never refused", () => {
  const w = world(); w.member("alice");
  const a = w.graded(DOC, CO_ATTESTED), b = w.doc(DOC2, undefined, { text: false });
  w.finding(Q, [{ target: DOC }]);
  w.finding(Q2, [{ target: DOC2 }]);
  const P = w.project("Team", "alice", [Q, Q2]);
  const r = w.publish(P, "alice", [Q, Q2], { roles: { [Q]: "load_bearing", [Q2]: "supporting" } });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  const m = materialsOf(w.fm(docOf(w, r)));
  /* each row carries the document's `title` (case-grammar R12, case-disclosures R7): a sentence or null, checked by those modules */
  for (const row of m.materials) assert.ok(row.title === null || typeof row.title === "string", JSON.stringify(row));
  assert.deepEqual(m.materials.map(({ title, ...row }) => row), [
    { ref: DOC, kind: "document", sha: a, text_sha: textSha(DOC), origin: `https://example.org/${DOC}`,
      archived_copy: "https://archive.example/web/x", included: true, rests_under: "load_bearing", obscured: null },
    { ref: DOC2, kind: "document", sha: b, text_sha: null, origin: null, archived_copy: null, included: false,
      rests_under: "supporting", obscured: null }]);
  const body = bodyOf(docOf(w, r));
  assert.ok(body.includes(word("case-disclosures.case_carries")));
  assert.ok(body.includes(`- ${DOC2}, a document, fingerprint ${b}: NOT INCLUDED`));
});

test("R55 (case-disclosures R7): material_attestations: states, per material, the attesting member's signed accounts, its co-attestation, the project's record that holds it, and the group's own row whose signature is the case's; no new table holds them", () => {
  const w = world(); w.member("alice");
  const a = w.graded(DOC, CO_ATTESTED);
  account(w, a);
  w.finding(Q, [{ target: DOC }]);
  const P = w.project("Team", "alice", [Q]);
  const tables = w.rows(`SELECT name FROM sqlite_master WHERE type='table'`).length;
  const r = w.publish(P, "alice", [Q]);
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  const reg = w.row(`SELECT bundle_id, registered FROM register WHERE capture_sha=?`, a);
  assert.deepEqual(materialsOf(w.fm(docOf(w, r))).attestations, [
    { ref: DOC, by_kind: "member", by: "alice", level: "name", at: "2026-09-27T12:00:00Z", signature: "SIG-of-alice-7f3", recorded_in: null, sha: null },
    { ref: DOC, by_kind: "co_attestation", by: "https://archive.example/web/x", level: null, at: null, signature: null,
      recorded_in: null, sha: null },
    { ref: DOC, by_kind: "project", by: P, level: null, at: reg.registered, signature: null, recorded_in: reg.bundle_id, sha: null },
    { ref: DOC, by_kind: "group", by: "test-group", level: null, at: w.clock.now, signature: "case", recorded_in: null, sha: null }]);
  assert.equal(w.rows(`SELECT name FROM sqlite_master WHERE type='table'`).length, tables, "no new table");
  assert.ok(bodyOf(docOf(w, r)).includes("test-group vouches for it by signing this case"));
});

test("R55 (case-disclosures R4, R8, R9, R10): a load-bearing document from a knocker with no publishable name publishes: it travels whole, its source shows \"Withheld\" with its reason, and its attesting member's row and signed account name no handle and carry no signature while no level is chosen; its grade is the capture's as recorded", () => {
  const w = world(); w.member("alice");
  const k = w.graded(DOC, CO_ATTESTED, { receipt: false });
  w.knocked(k);
  account(w, k, "Handed to me at the door.");
  w.finding(Q, [{ target: DOC }]);
  const P = w.project("Team", "alice", [Q]);
  const r = w.publish(P, "alice", [Q]);
  assert.equal(r.ok, true, `never refused because material is off-the-record: ${JSON.stringify(r).slice(0, 300)}`);
  const text = docOf(w, r), fm = w.fm(text);
  const blocks = caseDocumentBlocks(text);
  assert.deepEqual(blocks.sources, [{ capture: k, stated: unnamedSourceStatement({ capture: k, received: T0 }), basis: null }]);
  const m = materialsOf(fm);
  assert.deepEqual([m.materials[0].included, m.materials[0].origin], [true, null], "travels whole; no knock address");
  assert.deepEqual(m.attestations.filter((x) => x.by_kind === "member"),
    [{ ref: DOC, by_kind: "member", by: null, level: null, at: "2026-09-27T12:00:00Z", signature: null, recorded_in: null, sha: null }]);
  const row = blocks.captures.find((c) => c.capture === k);
  assert.deepEqual(row.accounts, [{ by: null, at: "2026-09-27T12:00:00Z", text: "Handed to me at the door.", signature: null }],
    "the account's text travels; the member's handle and signature do not");
  assert.equal(row.grade, w.prov.captureGrade(k).grade, "the grade as recorded");
  for (const leak of ["SIG-of-alice-7f3", "AAAA", "h_alice", "by alice"]) assert.equal(text.includes(leak), false, `names ${leak}`);
  /* K1316: the attribution section carries the capture's row, written though the case reaches no observation */
  assert.deepEqual((fm.observation_attributions || []).map((x) => [x.capture, x.level === "null" ? null : x.level]), [[k, null]]);
  assert.match(blocks.sources[0].stated, /^Withheld: /, "R55 (case-disclosures R4)'s label and reason");
  /* R55 (case-disclosures R10), publication R60: the attesting member chooses `name`, and their row is re-authored at that level */
  w.st.sql.exec(`INSERT OR IGNORE INTO capture_actors (capture_sha, actor, at) VALUES (?, 'member:alice', ?)`, k, T0);
  const chose = caseTensionsOf(w.host).attributeObservation({ caseId: r.caseId, edition: 1, capture: k, level: "name",
                                                     reason: "I stand behind it by name.", by: "alice" });
  assert.equal(chose.ok, true, JSON.stringify(chose).slice(0, 300));
  const after = materialsOf(w.fm(docOf(w, r))).attestations.filter((x) => x.by_kind === "member");
  assert.deepEqual(after.map((x) => x.level), ["name"]);
});

test("R55 (case-disclosures R11): a named member's capture, a load-bearing self-attested Grade B one included, is governed by R55 (case-disclosures R2 and R3) unchanged: its account names its member and carries the signature", () => {
  const w = world(); w.member("alice");
  const b = w.graded(DOC);
  account(w, b);
  w.finding(Q, [{ target: DOC }]);
  const r = w.publish(w.project("Team", "alice", [Q]), "alice", [Q], { selfAttested: [{ capture: b, reason: REASON }] });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  const text = docOf(w, r);
  const row = caseDocumentBlocks(text).captures.find((c) => c.capture === b);
  assert.deepEqual([row.self_attested_only, row.accounts[0].by, row.accounts[0].signature], [true, "alice", "SIG-of-alice-7f3"]);
  assert.deepEqual(materialsOf(w.fm(text)).attestations.find((x) => x.by_kind === "member"),
    { ref: DOC, by_kind: "member", by: "alice", level: "name", at: "2026-09-27T12:00:00Z", signature: "SIG-of-alice-7f3", recorded_in: null, sha: null });
  void DOC3;
});

test("R55 (case-disclosures R15): grading_facts: and passages: are written at the act through case-grammar's R17 — one row per leg of each finding a member's chain reaches, as strength.gradingFacts answers it, so recomputePair over the signed facts answers the pair strengthOf answers; one passage row per leg naming a content row, its quoted text found in the document's extracted text", () => {
  const w = world(); w.member("alice");
  const a = w.graded(DOC);
  w.doc(DOC2);
  const cid = sha("passage of DOC");
  w.st.sql.exec(`INSERT INTO content (content_id, capture_sha, bundle_id, extent_kind, extent, ref, minted_by, at, stale)
                 VALUES (?, ?, ?, 'doc-para', ?, 'paragraph 1', 'plane', '2026-01-01', 0)`, cid, a, DOC,
                canonicalJson({ kind: "doc-para", para: 1 }));
  w.finding(Q2, [{ target: DOC2, grade: "C", grade_axis: "capture", grade_source: "capture" }]);
  w.finding(Q, [{ target: DOC, content_id: cid, grade: "B", grade_axis: "capture", grade_source: "capture" },
                { target: Q2 }]);
  const r = w.publish(w.project("Team", "alice", [Q]), "alice", [Q], { selfAttested: [{ capture: a, reason: REASON }] });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  const fm = w.fm(docOf(w, r));
  const facts = gradingFactsOf(fm);
  assert.deepEqual(Object.keys(facts), [Q, Q2], "each finding the chain reaches, members first");
  for (const id of [Q, Q2]) {
    const given = w.strength.gradingFacts({ inquiry: id, levels: null, viewer: "member:alice" }).legs;
    assert.deepEqual(facts[id].map(({ finding, ord, ...leg }) => leg),
      given.map((g) => Object.fromEntries(GRADING_FACT_FIELDS.slice(2).map((f) => [f, g[f] ?? null]))), id);
    const re = recomputePair({ legs: facts[id], version: methodOf(fm).grading });
    const live = w.strength.strengthOf(id);
    for (const axis of ["capture", "connection"])
      assert.deepEqual([re[axis].state, re[axis].grade], [live[axis].state, live[axis].grade], `${id} ${axis}`);
  }
  const p = passagesOf(fm);
  assert.deepEqual(p[Q], [{ finding: Q, ord: 0, content_id: cid, capture_sha: a,
    extent: { kind: "doc-para", para: 1 }, chain: null, quoted: `the text of ${DOC}` }]);
  assert.ok(extractedTextOf(w.extraction.unitsOf(a).units).includes(JSON.stringify(p[Q][0].quoted)),
    "the passage is found in the extracted text");
});
