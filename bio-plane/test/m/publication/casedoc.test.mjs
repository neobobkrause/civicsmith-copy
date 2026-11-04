/* publication — the case document: its fenced reads (R1, R2, R29), its exclusions (R3), its writes (R21), the review
   provider (R23) and the read contract (R40). Its grammar is `case-grammar`'s since K651 (tested there), re-exported
   here unchanged. Driven at the module's interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { planeWorld as world, caseDoc, V, SIG, NOW, sha } from "./fixture.mjs";
import { CASE_DOCUMENT_FORMAT, REAUTHORABLE_SECTIONS, PUBLICATION_TABLES } from "../../../src/publication/index.mjs";

/* One project owned by olive, one finding prepared into CASE-2026-0001 edition 1 (unsigned). */
function prepared(opts = {}) {
  const w = world();
  w.member("olive"); w.member("bo");
  const proj = w.project("Parks", "olive");
  w.doc("INFO-2026-0001-minutes");
  w.inquiry("INQ-2026-0001", { legs: [{ target: "INFO-2026-0001-minutes" }] });
  const pin = w.head("INQ-2026-0001");
  const roles = [{ target: "INQ-2026-0001", version_sha: pin }];
  w.prepare("CASE-2026-0001", 1, { project: proj, roles, excluded: [{ target: "INFO-2026-0009-old" }], ...opts });
  return { w, proj, pin, roles };
}
const roster = (roles) => roles.map((r) => ({ bundle_id: r.target, version_sha: r.version_sha, role: "load_bearing" }));

test("R1 an unsigned case document answers a viewer with standing in its project, and everyone else exactly as one never authored", () => {
  const { w } = prepared();
  const owner = w.p.caseDocument("CASE-2026-0001", 1, V("olive"));
  assert.equal(owner.ok, true);
  assert.equal(owner.ratified, false);
  assert.equal(owner.text, w.row(`SELECT text FROM case_documents`).text);
  assert.equal(owner.doc_sha, sha(owner.text));
  assert.equal(owner.authored_by, V("olive"));
  assert.equal(owner.delivered_by, null, "no delivery yet: unsigned");
  const fresh = world();
  const never = fresh.p.caseDocument("CASE-2026-0001", 1, V("bo"));
  for (const viewer of [V("bo"), null, "garbage", "member:"])
    assert.deepEqual(w.p.caseDocument("CASE-2026-0001", 1, viewer), never, `viewer ${viewer}`);
  assert.equal(never.reason, "NO_CASE_DOCUMENT");
  assert.deepEqual(w.p.caseDocument("CASE-2026-0001", 2, V("olive")), fresh.p.caseDocument("CASE-2026-0001", 2, V("olive")),
                   "an edition never authored answers the same");
  /* the machine credential's unfiltered scope has standing (viewerPredicate's member scope) */
  assert.equal(w.p.caseDocument("CASE-2026-0001", 1, "class:daemon").ok, true);
});

test("R1 hasCaseStanding is the standing test, exported, and a live review grant bound to exactly that edition admits", () => {
  const { w } = prepared();
  const doc = w.row(`SELECT * FROM case_documents`);
  assert.equal(w.p.hasCaseStanding(doc, V("olive")), true);
  assert.equal(w.p.hasCaseStanding(doc, V("bo")), false);
  assert.equal(w.p.hasCaseStanding(doc, "nobody"), false);
  const secret = "a".repeat(64);
  assert.equal(w.p.caseDocument("CASE-2026-0001", 1, V("bo"), secret).ok, false, "no provider: no grant admits");
  w.p.registerReviewProvider("review", {
    draftForMember: () => null, draftIdentity: () => null, caseIdentitySentence: () => null, statedEdition: () => null,
    liveGrant: () => null, deadAnswer: () => null,
    grantAdmitsCaseEdition: (s, c, e) => s === secret && c === "CASE-2026-0001" && e === 1 });
  assert.equal(w.p.caseDocument("CASE-2026-0001", 1, V("bo"), secret).ok, true);
  assert.equal(w.p.caseDocument("CASE-2026-0001", 1, V("bo"), "b".repeat(64)).ok, false);
});

test("R1 a signed document answers anybody, with its signature, deliverer and the citations its /4 bytes signed; an older one states them undetermined", () => {
  const { w, proj, roles } = prepared({ citations: [{ target: "INFO-2026-0001-minutes", version: "pinned" }] });
  assert.equal(w.signCase("CASE-2026-0001", 1, { project: proj, roster: roster(roles) }).ok, true);
  const any = w.p.caseDocument("CASE-2026-0001", 1, null);
  assert.equal(any.ok, true);
  assert.equal(any.ratified, true);
  assert.equal(any.sig_armored, SIG(1));
  assert.equal(any.attestor_member, "olive");
  assert.deepEqual(any.delivered_by, { kind: "member", member: "olive" });
  assert.deepEqual(any.citations, { state: "signed", rows: [{ target: "INFO-2026-0001-minutes", version: "pinned" }] });
  assert.deepEqual(w.op("casedocument", { case: "CASE-2026-0001", edition: 1 }), any, "op=casedocument is the same read");
  /* an older format signed no citation: stated, never read from today's edges */
  const { w: w3, proj: p3, roles: r3 } = prepared({ format: "bio-case-document/3", citations: [{ target: "X", version: "pinned" }] });
  w3.signLegacy("CASE-2026-0001", 1, { project: p3, roster: roster(r3) });
  const old = w3.p.caseDocument("CASE-2026-0001", 1, null);
  assert.equal(old.citations.state, "undetermined");
  assert.equal(old.citations.rows, null);
  assert.match(old.citations.stated, /version undetermined/);
});

test("R79 caseDocumentFacts' memberBasis for a member whose pinned bytes hold references is that member's {basis, references}, the severed row included", () => {
  const w = world();
  w.member("olive"); w.member("bo");
  const proj = w.project("Parks", "olive");
  w.doc("INFO-2026-0001-minutes"); w.doc("INFO-2026-0002-notes");
  w.inquiry("INQ-2026-0001", {
    legs: [{ target: "INFO-2026-0001-minutes" }, { target: "INFO-2026-0002-notes" }],
    refs: [{ target: "INFO-2026-0001-minutes", rel: "cites", status: "confirmed" },
           { target: "INFO-2026-0002-notes", rel: "cites", status: "severed" }] });
  const pin = w.head("INQ-2026-0001");
  w.prepare("CASE-2026-0001", 1, { project: proj, roles: [{ target: "INQ-2026-0001", version_sha: pin }] });
  const f = w.p.caseDocumentFacts("CASE-2026-0001", 1, V("olive"));
  assert.equal(f.ok, true);
  const member = f.memberBasis["INQ-2026-0001"];
  assert.deepEqual(member.basis.map((l) => l.target), ["INFO-2026-0001-minutes", "INFO-2026-0002-notes"]);
  assert.deepEqual(member.references.map((r) => [r.target, r.status]),
                   [["INFO-2026-0001-minutes", "confirmed"], ["INFO-2026-0002-notes", "severed"]],
                   "the references are read at the pin, so the severed citation reaches the case document's member arm");
});

test("R2 caseDocumentFacts is fenced as R1 and answers the document, the previous edition's assertions, each member's basis at its pin, attribution and testimony", () => {
  const { w, proj, roles } = prepared();
  assert.deepEqual(w.p.caseDocumentFacts("CASE-2026-0001", 1, V("bo")), world().p.caseDocumentFacts("CASE-2026-0001", 1, V("bo")));
  assert.equal(w.p.caseDocumentFacts("", 1, V("olive")).reason, "MALFORMED");
  assert.equal(w.p.caseDocumentFacts("CASE-2026-0001", 0, V("olive")).reason, "MALFORMED");
  const f = w.p.caseDocumentFacts("CASE-2026-0001", 1, V("olive"));
  assert.equal(f.ok, true);
  assert.equal(f.doc.case_id, "CASE-2026-0001");
  assert.equal(f.priorCase, null, "no earlier ratified edition");
  assert.ok(Array.isArray(f.signers));
  assert.deepEqual(f.memberBasis["INQ-2026-0001"].basis.map((l) => l.target), ["INFO-2026-0001-minutes"]);
  assert.deepEqual(f.testimony, { self: [], via: [] });
  assert.deepEqual(Object.keys(f.attribution).sort(), ["current", "legacy", "reached", "stated"]);
  /* ratified and published, then the finding moves on: the basis is still read at the PIN */
  w.signCase("CASE-2026-0001", 1, { project: proj, roster: roster(roles) });
  assert.equal(w.signFinding("INQ-2026-0001").ok, true, "the edition completes when its last member is published");
  w.inquiry("INQ-2026-0001", { question: "Is it answered, revised?", legs: [] });
  assert.deepEqual(w.p.caseDocumentFacts("CASE-2026-0001", 1, V("bo")).memberBasis["INQ-2026-0001"].basis.map((l) => l.target),
                   ["INFO-2026-0001-minutes"], "read at the pin, never at the working version; a ratified document to anybody");
  /* the previous RATIFIED edition's assertions */
  w.prepare("CASE-2026-0001", 2, { project: proj, roles });
  const f2 = w.p.caseDocumentFacts("CASE-2026-0001", 2, V("olive"));
  assert.equal(f2.priorCase.edition, 1);
  assert.equal(f2.priorCase.bias_acknowledgement, "none declared");
  assert.deepEqual(JSON.parse(f2.priorCase.completeness), { statement: "It leaves out the minutes.", author: V("olive") });
});

test("R3 a document's exclusions are projected whole when it is stored or re-authored, and excludedBy reads them", () => {
  const { w, proj, roles } = prepared({ excluded: [{ target: "INFO-2026-0009-old", description: "old minutes" },
                                                  { target: "INFO-2026-0010-annex", description: "the annex" }] });
  const rows = () => w.rows(`SELECT target_id, description FROM case_exclusions ORDER BY ord`);
  assert.deepEqual(rows(), [{ target_id: "INFO-2026-0009-old", description: "old minutes" },
                            { target_id: "INFO-2026-0010-annex", description: "the annex" }]);
  /* stored again with fewer: the projection is replaced whole, never appended */
  w.prepare("CASE-2026-0001", 1, { project: proj, roles, excluded: [{ target: "INFO-2026-0010-annex", description: "the annex" }] });
  assert.deepEqual(rows(), [{ target_id: "INFO-2026-0010-annex", description: "the annex" }]);
  const by = w.p.excludedBy("INFO-2026-0010-annex", V("olive"));
  assert.equal(by.ok, true);
  assert.deepEqual(by.cases.map((c) => [c.case_id, c.case_edition, c.bundle_id, c.from]),
                   [["CASE-2026-0001", 1, "INQ-2026-0001", "case_document"]]);
});

test("K651 the case document's grammar is case-grammar's, re-exported here unchanged: every name is the same binding", async () => {
  const pub = await import("../../../src/publication/index.mjs");
  const chk = await import("../../../src/publication/checks.mjs");
  const cg = await import("../../../src/case-grammar/index.mjs");
  for (const name of ["CASE_DOCUMENT_FORMAT", "CASE_DOCUMENT_FORMAT_V6", "CASE_DOCUMENT_FORMATS_ACCEPTED", "caseDocumentStatesMemberBlocks",
                      "caseDocumentRequiresDisclosures", "caseDocumentRequiresV4Disclosures", "caseDocumentRequiresTensionSection",
                      "caseTensionsOf", "caseDocumentBlocks", "captureBlockLines", "sourceBlockLines", "sourceStatement",
                      "unnamedSourceStatement", "REAUTHORABLE_SECTIONS", "ATTRIBUTION_LEVELS", "ATTRIBUTION_PROSE_HEAD",
                      "attributionFrontmatterLines", "attributionBodyLines", "publishedGraphEdges",
                      "CASE_DOCUMENT_FORMAT_V7", "WORDS", "caseWordsOf", "lensClosingSentencesOf"])
    assert.equal(pub[name], cg[name], name);
  for (const name of ["CASE_DOCUMENT_FORMAT", "CASE_DOCUMENT_FORMAT_V6", "caseDocumentStatesMemberBlocks",
                      "caseDocumentRequiresTensionSection"])
    assert.equal(chk[name], cg[name], `checks.mjs ${name}`);
  /* case-grammar PR 202 (its R35): the format in force is /10, the first to state the passages published without a
     grade and the typed passages (its R36, R37); this module re-exports it unchanged. */
  assert.equal(CASE_DOCUMENT_FORMAT, "bio-case-document/10");
});
test("R21 storeCaseDocument replaces an unsigned document, never a signed one, and answers what the store holds", () => {
  const { w, proj, roles } = prepared();
  const text2 = caseDoc("CASE-2026-0001", 1, { project: proj, roles, excludes: "Now this." });
  const r = w.p.storeCaseDocument({ case: "CASE-2026-0001", edition: 1, text: text2, author: V("olive") });
  assert.deepEqual([r.case_id, r.edition, r.doc_sha, r.stored], ["CASE-2026-0001", 1, sha(text2), true]);
  w.signCase("CASE-2026-0001", 1, { project: proj, roster: roster(roles) });
  const before = w.snapshot(["case_documents", "case_exclusions"]);
  const again = w.p.storeCaseDocument({ case: "CASE-2026-0001", edition: 1, text: "---\nx: 1\n---\n", author: V("bo") });
  assert.deepEqual([again.ok, again.doc_sha, again.stored], [true, sha(text2), false], "the signed document is what is held");
  assert.deepEqual(w.snapshot(["case_documents", "case_exclusions"]), before, "a signed document is never touched");
  assert.equal(w.p.storeCaseDocument({ case: "", edition: 1, text: "t" }).reason, "MALFORMED");
  assert.equal(w.p.storeCaseDocument({ case: "C", edition: 0, text: "t" }).reason, "MALFORMED");
});

test("R21 writes only inside the caller's transaction: a caller that refuses leaves nothing written", () => {
  const w = world();
  const r = w.record.transact(() => {
    w.p.storeCaseDocument({ case: "CASE-2026-0002", edition: 1, text: caseDoc("CASE-2026-0002", 1), author: V("olive") });
    return { ok: false, reason: "CALLER_REFUSED" };
  });
  assert.equal(r.reason, "CALLER_REFUSED");
  assert.equal(w.count("case_documents"), 0);
});

test("R21 reauthorSection splices one named section only while unsigned and at docSha, projects the exclusions, and says when it did not", () => {
  const obs = "INFO-2026-0099-observation";
  const { w, proj, roles } = prepared({ attributions: [{ observation: obs }], ack: true });
  assert.deepEqual(REAUTHORABLE_SECTIONS, ["attribution", "acknowledgements", "attestations"]);
  const held = w.row(`SELECT doc_sha, text FROM case_documents`);
  const lines = { frontmatter: ["observation_attributions:", `  - observation: ${obs}`, "    level: group",
                                '    shown: "g"', "    chosen_at_edition: 1"], body: ["## Whose Words These Are", "", "new words", ""] };
  const moved = w.p.reauthorSection({ case: "CASE-2026-0001", edition: 1, docSha: "0".repeat(64), section: "attribution", lines });
  assert.deepEqual([moved.reauthored, moved.doc_sha], [false, held.doc_sha]);
  assert.match(moved.why, /moved/);
  const done = w.p.reauthorSection({ case: "CASE-2026-0001", edition: 1, docSha: held.doc_sha, section: "attribution", lines });
  assert.equal(done.reauthored, true);
  const now = w.row(`SELECT doc_sha, text FROM case_documents`);
  assert.equal(done.doc_sha, now.doc_sha);
  assert.equal(now.doc_sha, sha(now.text));
  assert.match(now.text, /level: group[\s\S]*new words/);
  assert.equal(now.text.replace(/observation_attributions:[\s\S]*?(?=case_citations)/, "")
                 .replace(/## Whose Words These Are[\s\S]*?(?=## What This Excludes)/, ""),
               held.text.replace(/observation_attributions:[\s\S]*?(?=case_citations)/, "")
                 .replace(/## Whose Words These Are[\s\S]*?(?=## What This Excludes)/, ""),
               "only the two runs changed");
  /* the acknowledgement list is the other section */
  const ack = w.p.reauthorSection({ case: "CASE-2026-0001", edition: 1, docSha: now.doc_sha, section: "acknowledgements",
    lines: { frontmatter: ["  statement_sha: abc", "  acknowledged: 1"], body: ["**Who else read this statement.** Bo did."] } });
  assert.equal(ack.reauthored, true);
  assert.match(w.row(`SELECT text FROM case_documents`).text, /acknowledged: 1[\s\S]*Bo did\.\n\n## What Was Searched/);
  /* signed: left as it is */
  const cur = w.row(`SELECT doc_sha FROM case_documents`).doc_sha;
  w.signCase("CASE-2026-0001", 1, { project: proj, roster: roster(roles) });
  const signed = w.p.reauthorSection({ case: "CASE-2026-0001", edition: 1, docSha: cur, section: "attribution", lines });
  assert.deepEqual([signed.reauthored, signed.doc_sha], [false, cur]);
  assert.match(signed.why, /signed/);
  /* a document carrying no such section, an unknown section, and an absent document */
  const { w: w2 } = prepared();
  const d2 = w2.row(`SELECT doc_sha FROM case_documents`).doc_sha;
  const none = w2.p.reauthorSection({ case: "CASE-2026-0001", edition: 1, docSha: d2, section: "attribution", lines });
  assert.deepEqual([none.reauthored, none.doc_sha], [false, d2]);
  assert.equal(w2.p.reauthorSection({ case: "CASE-2026-0001", edition: 1, section: "scope", lines }).reason, "MALFORMED");
  assert.equal(w2.p.reauthorSection({ case: "CASE-2026-0001", edition: 5, section: "attribution", lines }).doc_sha, null);
});

test("R23 one review provider, once; with none, no grant admits and every door refuses, the dead answer a bare NO_REVIEW_COPY", () => {
  const w = world();
  const none = w.p.reviewProvider();
  assert.equal(none.registered, false);
  assert.equal(none.grantAdmitsCaseEdition("a".repeat(64), "CASE-2026-0001", 1), false);
  assert.equal(none.draftForMember("DRAFT-1", V("olive")), null);
  assert.equal(none.liveGrant("a".repeat(64)), null);
  assert.equal(none.draftIdentity({}), null);
  assert.equal(none.caseIdentitySentence("C", 1, false), null);
  assert.equal(none.statedEdition({}, false), null);
  const dead = none.deadAnswer();
  assert.deepEqual(dead, { ok: false, reason: "NO_REVIEW_COPY", code: "NO_REVIEW_COPY" }, "a bare refusal: C-87 is review's");
  const doors = { draftForMember: () => "d", draftIdentity: () => "i", caseIdentitySentence: () => "s",
                  statedEdition: () => 2, liveGrant: () => "g", grantAdmitsCaseEdition: () => true, deadAnswer: () => "x" };
  assert.equal(w.p.registerReviewProvider("review", { ...doors, deadAnswer: 3 }).reason, "PROVIDER_MALFORMED");
  assert.deepEqual(w.p.registerReviewProvider("review", doors), { ok: true, module: "review" });
  assert.equal(w.p.registerReviewProvider("review", doors).reason, "PROVIDER_DECLARED");
  const got = w.p.reviewProvider();
  assert.deepEqual([got.registered, got.module, got.draftForMember(), got.statedEdition()], [true, "review", "d", 2]);
});

test("R29 working material answers an outsider exactly as something that does not exist: the unsigned document, its facts and its exclusions", () => {
  const { w } = prepared();
  const fresh = world();
  for (const viewer of [V("bo"), null]) {
    assert.deepEqual(w.p.caseDocument("CASE-2026-0001", 1, viewer), fresh.p.caseDocument("CASE-2026-0001", 1, viewer));
    assert.deepEqual(w.p.caseDocumentFacts("CASE-2026-0001", 1, viewer), fresh.p.caseDocumentFacts("CASE-2026-0001", 1, viewer));
  }
  assert.deepEqual(w.p.excludedBy("INFO-2026-0009-old", V("bo")).cases, [], "an unsigned document's exclusion is not shown");
  assert.equal(w.p.excludedBy("INFO-2026-0009-old", V("olive")).cases.length, 1);
  assert.equal(w.p.excludedBy("", V("olive")).reason, "NO_ID");
});

test("R40 the seven tables and their named columns are the stated read contract, and a later module's SQL reads them as named", () => {
  const w = world();
  const cols = (t) => w.rows(`PRAGMA table_info(${t})`).map((c) => c.name);
  const contract = { cases: ["case_id", "project_id"],
    published_cases: ["case_id", "edition", "completeness", "bias_acknowledgement", "ratified_at", "bar", "scope", "manifest",
                      "manifest_sha", "signed_at", "published_at", "criteria"],
    published_case_members: ["case_id", "bundle_id", "ord", "version_sha", "role"],
    published_edges: ["from_bundle", "to_bundle", "kind", "disclosure", "published"],
    published_shas: ["sha256", "bundle_id", "path", "kind", "bytes", "published"],
    case_documents: ["case_id", "edition", "doc_sha", "text", "draft_id", "authored_by", "authored_at", "sig_armored",
                     "ratified_at"] };
  for (const [t, want] of Object.entries(contract))
    for (const c of want) assert.ok(cols(t).includes(c), `${t}.${c}`);
  /* published_bundles: every column, as the contract says */
  assert.deepEqual(cols("published_bundles").sort(), ["attestor_key", "attestor_member", "bundle_id", "bundle_sha", "delivered_by",
    "edition", "gate_version", "parts", "ratified_at", "required", "sig_armored", "strength", "title"]);
  assert.ok(PUBLICATION_TABLES.some((t) => (t.name || t) === "case_documents"));
  /* each read a later module makes under the contract (public-read R1–R5, project-stage R3, docket R1, R4, R9, R12, R14) is
     answerable as written */
  for (const q of [`SELECT sha256, bundle_id, path, kind, bytes, published FROM published_shas`,
                   `SELECT from_bundle, to_bundle, kind, disclosure, published FROM published_edges`,
                   `SELECT case_id, edition, scope, bar, ratified_at, manifest, manifest_sha, signed_at, published_at, criteria FROM published_cases`,
                   `SELECT case_id, edition, ord, bundle_id, version_sha, role FROM published_case_members`,
                   `SELECT c.case_id, k.project_id FROM published_cases c LEFT JOIN cases k ON k.case_id=c.case_id`,
                   `SELECT case_id, edition, text, sig_armored FROM case_documents`])
    assert.deepEqual(w.rows(q), [], q);
});

/* R56: the prepared, unsigned editions as queue-producers R23 lists them (`queue-producers/index.mjs`, its
   `attribution-unchosen` read): plain SQL over `case_documents`, `sig_armored` null meaning authored and unsigned. */
const PREPARED_EDITIONS = `SELECT cd.case_id, cd.edition, cd.authored_at FROM case_documents cd
  WHERE cd.sig_armored IS NULL
    AND NOT EXISTS (SELECT 1 FROM case_documents later WHERE later.case_id = cd.case_id AND later.edition > cd.edition)
  ORDER BY cd.case_id, cd.edition`;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
/* Every row's four contract columns read with plain SQL, each held against what this module's own read answers of that
   edition (R1, through a viewer with standing): the case and edition it names, the instant it was authored, and the
   signature that null means absent. Answers the rows that break the contract, by column; none is the contract kept. */
function r56Broken(w) {
  let rows;
  try { rows = w.rows(`SELECT case_id, edition, authored_at, sig_armored FROM case_documents ORDER BY case_id, edition`); }
  catch (e) { return [`unreadable: ${e.message}`]; }
  const out = [];
  for (const r of rows) {
    const d = w.p.caseDocument(r.case_id, r.edition, "class:daemon");
    const at = `${r.case_id}#${r.edition}`;
    if (!d.ok) { out.push(`${at}: case_id/edition name no case document`); continue; }
    if (typeof r.case_id !== "string" || !Number.isInteger(r.edition)) out.push(`${at}: case_id/edition types`);
    if (typeof r.authored_at !== "string" || !INSTANT.test(r.authored_at) || r.authored_at !== d.authored_at)
      out.push(`${at}: authored_at`);
    if (r.sig_armored === null ? d.ratified !== false || d.sig_armored !== null
                               : typeof r.sig_armored !== "string" || !r.sig_armored || r.sig_armored !== d.sig_armored)
      out.push(`${at}: sig_armored`);
  }
  return out;
}

test("R56 case_documents' case_id, edition, authored_at and sig_armored hold what they state, read with plain SQL as queue-producers R23 reads them: sig_armored null while authored and unsigned, set once signed, never moved after", () => {
  const { w, proj, roles } = prepared();
  const row = (ed) => w.row(`SELECT case_id, edition, authored_at, sig_armored FROM case_documents WHERE case_id=? AND edition=?`,
                            "CASE-2026-0001", ed);
  /* authored, unsigned: listed, with the instant its preparation was stored */
  assert.deepEqual(row(1), { case_id: "CASE-2026-0001", edition: 1, authored_at: NOW, sig_armored: null });
  assert.deepEqual(w.rows(PREPARED_EDITIONS), [{ case_id: "CASE-2026-0001", edition: 1, authored_at: NOW }]);
  assert.deepEqual(r56Broken(w), []);
  /* re-authored while unsigned (R21): still unsigned, its authored_at the new preparation's */
  const later = "2026-09-28T04:00:00Z";
  w.p.storeCaseDocument({ case: "CASE-2026-0001", edition: 1, author: V("olive"), at: later,
                          text: caseDoc("CASE-2026-0001", 1, { project: proj, roles, excludes: "Again." }) });
  assert.deepEqual(w.rows(PREPARED_EDITIONS), [{ case_id: "CASE-2026-0001", edition: 1, authored_at: later }]);
  assert.deepEqual(r56Broken(w), []);
  /* signed (R22): sig_armored is the signature, and the edition is no longer a preparation */
  assert.equal(w.signCase("CASE-2026-0001", 1, { project: proj, roster: roster(roles) }).ok, true);
  assert.deepEqual(row(1), { case_id: "CASE-2026-0001", edition: 1, authored_at: later, sig_armored: SIG(1) });
  assert.deepEqual(w.rows(PREPARED_EDITIONS), []);
  assert.deepEqual(r56Broken(w), []);
  /* set once: a later store, re-author or second signature leaves all four columns as they are */
  const held = row(1);
  w.p.storeCaseDocument({ case: "CASE-2026-0001", edition: 1, text: "---\nx: 1\n---\n", author: V("bo"), at: "2026-09-29T00:00:00Z" });
  w.p.reauthorSection({ case: "CASE-2026-0001", edition: 1, section: "attribution", lines: { frontmatter: [], body: [] } });
  assert.equal(w.signCase("CASE-2026-0001", 1, { project: proj, roster: roster(roles), sig: SIG(8) }).reason,
               "CASE_EDITION_ALREADY_RATIFIED");
  assert.deepEqual(row(1), held);
  /* a later edition prepared, and another case: each case's latest unsigned edition is listed, in case order */
  w.p.storeCaseDocument({ case: "CASE-2026-0001", edition: 2, author: V("olive"), at: "2026-09-30T00:00:00Z",
                          text: caseDoc("CASE-2026-0001", 2, { project: proj, roles }) });
  w.p.storeCaseDocument({ case: "CASE-2026-0000", edition: 1, author: V("olive"), at: "2026-09-30T01:00:00Z",
                          text: caseDoc("CASE-2026-0000", 1, { project: proj, roles }) });
  assert.deepEqual(w.rows(PREPARED_EDITIONS), [{ case_id: "CASE-2026-0000", edition: 1, authored_at: "2026-09-30T01:00:00Z" },
                                               { case_id: "CASE-2026-0001", edition: 2, authored_at: "2026-09-30T00:00:00Z" }]);
  assert.deepEqual(row(1), held, "edition 1 untouched by edition 2");
  assert.deepEqual(r56Broken(w), []);
  /* with no instant given, the act's own clock stamps authored_at, an instant */
  w.clock.now = "2026-10-01T00:00:00Z";
  w.p.storeCaseDocument({ case: "CASE-2026-0002", edition: 1, author: V("olive"), text: caseDoc("CASE-2026-0002", 1, { project: proj, roles }) });
  assert.equal(w.row(`SELECT authored_at FROM case_documents WHERE case_id='CASE-2026-0002'`).authored_at, "2026-10-01T00:00:00Z");
  assert.deepEqual(r56Broken(w), []);
});

test("R56 negative control: the contract check fails by name when a column's meaning or name moves", () => {
  /* an unsigned row whose sig_armored is not null reads as signed to the SQL reader, and is caught */
  const a = prepared().w;
  a.st.sql.exec(`UPDATE case_documents SET sig_armored=''`);
  assert.deepEqual(a.rows(PREPARED_EDITIONS), [], "the reader would miss the preparation");
  assert.deepEqual(r56Broken(a), ["CASE-2026-0001#1: sig_armored"]);
  /* a signed row whose sig_armored is cleared reads as a preparation */
  const b = prepared();
  b.w.signCase("CASE-2026-0001", 1, { project: b.proj, roster: roster(b.roles) });
  b.w.st.sql.exec(`UPDATE case_documents SET sig_armored=NULL`);
  assert.equal(b.w.rows(PREPARED_EDITIONS).length, 1, "the reader would list a signed edition");
  assert.deepEqual(r56Broken(b.w), ["CASE-2026-0001#1: sig_armored"]);
  /* authored_at not the instant of the preparation, or not an instant */
  const c = prepared().w;
  c.st.sql.exec(`UPDATE case_documents SET authored_at='yesterday'`);
  assert.deepEqual(r56Broken(c), ["CASE-2026-0001#1: authored_at"]);
  /* a column renamed: the reader's SQL no longer answers */
  const d = prepared().w;
  d.st.db.exec(`ALTER TABLE case_documents RENAME COLUMN sig_armored TO signature`);
  assert.throws(() => d.rows(PREPARED_EDITIONS), /sig_armored/);
  assert.match(r56Broken(d)[0], /^unreadable: /);
});
