/* case-authoring: the case document the act authors (R14) and its answer (R15), the citations (R16), the searched
   section (R17, and R11 when it cannot be computed), and the invariants that everything it asserts was argued or read
   (R22) and that undetermined is stated, never filled (R26). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V, AUTHORED, sha, infoMd } from "./fixture.mjs";
import { PLANE_VIEWER, searchedSection, SEARCHED_LEVEL_OUTCOMES, SEARCHED_SUBJECT_MAX, CASE_CITATION_WORDS, caseDocumentText }
  from "../../../src/case-authoring/index.mjs";
import { CASE_DOCUMENT_FORMAT } from "../../../src/publication/index.mjs";
import { STRENGTH_AXES } from "../../../src/strength/index.mjs";
import { word, localize } from "../../../src/setup-words/index.mjs";

const DOC = "INFO-2026-0001-a", DOC2 = "INFO-2026-0002-b", DOC3 = "INFO-2026-0003-c", DOC4 = "INFO-2026-0004-d";
const DOC5 = "INFO-2026-0005-e";
const Q = "INQ-2026-0001-q", Q2 = "INQ-2026-0002-q";
const EXCLUDED = [{ target: DOC2, description: "the second memo", reason: "it was withheld" },
                  { description: "the side letter", reason: "not in hand" }];

function setup(opts) {
  const w = world(opts);
  for (const m of ["alice", "bo"]) w.member(m);
  w.doc(DOC); w.doc(DOC2);
  return w;
}
const docOf = (w, r) => w.row(`SELECT * FROM case_documents WHERE case_id=? AND edition=?`, r.caseId, r.edition);
const bodyOf = (text) => text.slice(text.indexOf("\n---\n", 4) + 5);

test("R14: the document, in publication's CASE_DOCUMENT_FORMAT, which is bio-case-document/10 from T53 (case-grammar R35; /8 from T31, DEC-124), is stored unsigned through publication and states the case, edition and project, the scope, the roster with roles and pins, each member's own edition, frozen pair (capture and connection always, testimony when not unrated) with grounds and conclusion, the completeness block, the bias acknowledgement and manifest, the bar, the attributions, the citations, the searched section, the draft link and a receipt; its body prints every authored sentence", () => {
  const w = setup();
  /* a member's firsthand observation, reached through Q2's testimony leg */
  const obs = w.prov.testify({ words: "I was at the meeting.", observedAt: "2026-09-20", title: "At the meeting",
                               author: "alice" });
  assert.equal(obs.ok, true, JSON.stringify(obs).slice(0, 300));
  w.finding(Q, [{ target: DOC, grade: "C", grade_axis: "capture", grade_source: "capture" }]);
  w.finding(Q2, [{ target: obs.bundle_id, grade: "D", grade_axis: "testimony", grade_source: "testimony" }]);
  const P = w.project("Team", "alice", [Q, Q2], { extra: ["required_strength:", "  capture: C"] });
  w.draft("DRAFT-2026-0001", P, { statement: AUTHORED.statement }, { statementBy: "bo" });
  const r = w.publish(P, "alice", [Q, Q2], { excluded: EXCLUDED, draft: "DRAFT-2026-0001",
    roles: { [Q]: "load_bearing", [Q2]: "supporting" } });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 400));
  const row = docOf(w, r);
  assert.deepEqual([row.sig_armored ?? null, row.ratified_at ?? null, row.doc_sha, row.authored_by, row.draft_id],
    [null, null, sha(row.text), "alice", "DRAFT-2026-0001"], "stored unsigned, its hash over its bytes");
  const fm = w.fm(row.text);
  assert.deepEqual([fm.format, fm.case_id, fm.case_edition, fm.case_project, fm.case_scope],
    [CASE_DOCUMENT_FORMAT, r.caseId, 1, P, AUTHORED.scope]);
  assert.equal(fm.format, "bio-case-document/10", "op=publish writes the format in force, /10 (case-grammar R35), with no attestation sha too");
  /* its tension section, present with nothing to disclose (R55 (case-disclosures R1); `/5` and publication's reader: tensions.test.mjs) */
  assert.deepEqual([fm.tensions_disclosed, fm.tensions_highlighted, fm.case_tensions, fm.case_tension_sentences],
    [0, 0, [], []]);
  assert.deepEqual(fm.case_findings, [Q, Q2]);
  assert.deepEqual(fm.case_roles.map((m) => [m.target, m.role, m.version_sha, m.edition]),
    [[Q, "load_bearing", w.head(Q), 1], [Q2, "supporting", w.head(Q2), 1]]);
  /* the frozen pair per member and axis: capture and connection always, testimony only where it carries something */
  const axesOf = (m) => fm.case_strength.filter((x) => x.target === m).map((x) => x.axis);
  assert.deepEqual(axesOf(Q), ["capture", "connection"], "Q's testimony axis is unrated: not frozen");
  assert.deepEqual(axesOf(Q2), ["capture", "connection", "testimony"]);
  for (const x of fm.case_strength) {
    const a = w.strength.strengthOf(x.target)[x.axis];
    assert.deepEqual([x.state, x.grade === "null" ? null : x.grade], [a.state, a.grade], `${x.target} ${x.axis}`);
  }
  assert.ok(Array.isArray(fm.case_strength_grounds), "the grounds field is always written");
  assert.deepEqual(fm.case_conclusions.map((c) => [c.target, c.relationship]), [[Q, "no_project"], [Q2, "no_project"]]);
  /* the completeness block */
  const c = fm.completeness;
  assert.deepEqual([c.statement, c.subject_position, c.subject_justification, c.author, c.statement_by, c.at,
                    c.draft, c.draft_named_by, c.draft_named_at, c.statement_sha, c.acknowledged],
    [AUTHORED.statement, AUTHORED.subjectPosition, AUTHORED.subjectJustification, "alice", "bo", w.clock.now,
     "DRAFT-2026-0001", "alice", w.clock.now, r.completeness.statement_sha, 0]);
  assert.deepEqual(fm.completeness_acknowledgements, []);
  assert.deepEqual(fm.completeness_excluded.map((x) => [x.target ?? null, x.description, x.reason]),
    [[DOC2, "the second memo", "it was withheld"], [null, "the side letter", "not in hand"]]);
  assert.equal(fm.bias_acknowledgement, AUTHORED.biasAcknowledgement);
  assert.deepEqual([fm.bias_manifest.in_force, fm.bias_manifest.stated, fm.bias_manifest.pins_proposed],
    [false, word("bias.manifest_force"), 0]);
  assert.deepEqual([fm.required_strength.declared, fm.required_strength.capture, fm.required_strength.connection],
    [true, "C", null], "an undeclared axis is null");
  /* attributions: the observation Q2 reaches, its level unchosen */
  assert.deepEqual(fm.observation_attributions.map((a) => [a.observation, a.level]), [[obs.bundle_id, null]]);
  /* the citations and the searched section are their own tests (R16, R17); here, present */
  assert.ok(Array.isArray(fm.case_citations));
  assert.deepEqual([fm.searched.subject_source, fm.searched_levels.map((l) => l.level)],
    ["case_basis", ["document", "content", "meaning"]]);
  /* the body prints every authored sentence, the bar in words, the draft link and a receipt */
  const body = bodyOf(row.text);
  for (const s of [AUTHORED.scope, AUTHORED.statement, AUTHORED.subjectJustification, AUTHORED.biasAcknowledgement,
                   `- ${DOC2} — the second memo: it was withheld`, "- the side letter: not in hand",
                   word("case-authoring.body.position_putting_case", { position: AUTHORED.subjectPosition, justification: AUTHORED.subjectJustification }),
                   "capture C, no bar set on the connection axis", "Readings given on draft DRAFT-2026-0001",
                   "## Whose Words These Are", "## What Was Searched", "## Citations", "## Bias Manifest",
                   localize("case-authoring.document.session_at_case_published_author", "### Session {at} | Case published | {author}", { at: w.clock.now, author: "alice" }),
                   word("case-authoring.body.pinned_written", { member: Q, pin: w.head(Q),
                     edition_clause: localize("case-authoring.document.its_edition", ", its edition {edition}", { edition: "1" }) })])
    assert.ok(body.includes(s), `the body prints: ${s}`);
  /* never over a signed document: a later edition is a new document and the signed one is untouched */
  w.ratify(r);
  const signed = docOf(w, r);
  w.finding(Q, [{ target: DOC, grade: "C", grade_axis: "capture", grade_source: "capture" }, { target: DOC2 }]);
  const r2 = w.publish(P, "alice", [Q], { statement: "A second edition's own limits.",
    subjectJustification: "Put fresh for this edition.", biasAcknowledgement: "Our reading of the minutes, now.",
    excluded: [{ description: "the amendments", reason: "requested" }] });
  assert.deepEqual([r2.ok, r2.caseId, r2.edition], [true, r.caseId, 2], JSON.stringify(r2).slice(0, 300));
  assert.deepEqual(docOf(w, r), signed);
});

test("R14 (D54): the bias manifest is frozen from bias.biasManifest at the project's scope, read as the plane (a machine viewer, never the founder's): in force (its bundles and hash), not in force, or undetermined (null, with its sentence), each with pins_proposed and its count", () => {
  const calls = [];
  let lens = null;
  const bias = { biasManifest: (a) => { calls.push(a); return lens; } };
  const w = setup({ deps: { bias } });
  w.finding(Q, [{ target: DOC }]); w.finding(Q2, [{ target: DOC2 }]);
  const P = w.project("Team", "alice", [Q, Q2]);
  lens = { in_force: true, statements_sha: "f".repeat(64), lock_violations: [{ id: "s1" }],
           bundles: [{ bundle_id: "BIAS-2026-0001-lens", revision: "a".repeat(64), scope: "instance", adopter: "x" }],
           pins_proposed: [{ bundle_id: "BIAS-2026-0002-new", revision: "b".repeat(64), scope: "project", pinned_state: "proposed" }] };
  const on = w.publish(P, "alice", [Q]);
  assert.deepEqual(calls.filter((c) => c.limit === 1), [{ scope: "project", scopeId: P, viewer: PLANE_VIEWER, limit: 1 }],
                   "the manifest stamped, read as the plane, once (R40's lens reads its pages beside it)");
  /* D54 (K2442): every read of the manifest is the plane's machine credential, never the founder's viewer, which is blind
     to a hidden project it is not in (this one: the founder is neither invited nor joined) */
  assert.ok(calls.length >= 2 && calls.every((c) => c.viewer === PLANE_VIEWER && c.viewer !== "admin"));
  assert.deepEqual(on.bias_manifest, { in_force: true, scope: "project", scope_id: P, statements_sha: "f".repeat(64),
    bundles: [{ bundle_id: "BIAS-2026-0001-lens", revision: "a".repeat(64), scope: "instance" }], lock_violations: 1,
    stated: word("case-authoring.stated.effective_bias_set", { proj: String(P) }),
    pins_proposed: [{ bundle_id: "BIAS-2026-0002-new", revision: "b".repeat(64), scope: "project", pinned_state: "proposed" }] });
  const fm = w.fm(docOf(w, on).text);
  assert.deepEqual([fm.bias_manifest.in_force, fm.bias_manifest.statements_sha, fm.bias_manifest.lock_violations,
                    fm.bias_manifest.pins_proposed, fm.bias_manifest_bundles.map((b) => b.bundle_id),
                    fm.bias_manifest_pins_proposed.map((b) => [b.bundle_id, b.pinned_state])],
    [true, "f".repeat(64), 1, 1, ["BIAS-2026-0001-lens"], [["BIAS-2026-0002-new", "proposed"]]]);
  assert.ok(bodyOf(docOf(w, on).text).includes(word("case-authoring.body.adoption_pinned_proposed",
    { adoptions: localize("case-authoring.document.one_adoption", "one adoption") })));
  lens = { in_force: null, stated: "a pinned revision's bytes cannot be read", pins_proposed: [] };
  const und = w.publish(P, "alice", [Q2]);
  assert.deepEqual([und.bias_manifest.in_force, und.bias_manifest.stated, und.bias_manifest.statements_sha,
                    und.bias_manifest.bundles], [null, "a pinned revision's bytes cannot be read", null, []]);
  const ufm = w.fm(docOf(w, und).text);
  assert.deepEqual([ufm.bias_manifest.in_force, ufm.bias_manifest.stated], [null, "a pinned revision's bytes cannot be read"]);
  assert.ok(bodyOf(docOf(w, und).text).includes(word("case-authoring.body.manifest_undetermined_claimed",
    { scope_id: P, stated: "a pinned revision's bytes cannot be read" })));
});

test("R15: the answer carries the case, whether it was minted, its edition, the document to review (its sha and length), the findings with their pins, pairs, roles and bar, the scope, project, bar, roles, bias acknowledgement and manifest, citations, completeness, the tensions disclosed (R55 (case-disclosures R1)), author, instant, weight and next; target, bundleSha and state at the top only for one member", () => {
  const w = setup();
  w.finding(Q, [{ target: DOC }]); w.finding(Q2, [{ target: DOC2 }]);
  const P = w.project("Team", "alice", [Q, Q2]);
  const one = w.publish(P, "alice", [Q]);
  assert.deepEqual(Object.keys(one).sort(), ["author", "at", "bias_acknowledgement", "bias_manifest", "bundleSha",
    "caseDocument", "caseId", "case_citations", "completeness", "edition", "findings", "minted", "next", "ok", "project",
    "required", "roles", "scope", "state", "target", "tensions", "tensions_highlighted", "tensions_legs_unread",
    "timeline", "weight"].sort());
  /* R57 (T45): the published record of actions written and the count its sources did not mark public */
  assert.deepEqual(one.timeline, { we_did: 0, withheld: 0 });
  assert.deepEqual([one.tensions, one.tensions_highlighted], [[], 0], "nothing to disclose: stated, zero included");
  const row = docOf(w, one);
  assert.deepEqual(one.caseDocument, { case_id: one.caseId, edition: 1, doc_sha: row.doc_sha,
    bytes: Buffer.byteLength(row.text, "utf8"), read: `op=casedocument&case=${one.caseId}&edition=1` });
  assert.deepEqual([one.target, one.bundleSha, one.state, one.weight, one.author, one.at, one.project],
    [Q, w.head(Q), "concluded", "single", "alice", w.clock.now, P]);
  const f = one.findings[0];
  assert.deepEqual([f.target, f.bundleSha, f.promoted, f.edition, f.role, f.case_id, f.case_edition, f.frozen_in],
    [Q, w.head(Q), false, 1, "load_bearing", one.caseId, 1, "case_document"]);
  assert.deepEqual(f.required, w.strength.projectBar(P));
  assert.deepEqual(f.strength.map((a) => a.axis), ["capture", "connection"]);
  assert.match(one.next, /op=caseratify/);
  /* a second one-finding case answers its own member at the top, never the first's */
  const two = w.publish(P, "alice", [Q2], { newCase: true, roles: { [Q2]: "load_bearing" } });
  assert.deepEqual([two.ok, two.target, two.bundleSha, two.minted], [true, Q2, w.head(Q2), true]);
  assert.notEqual(two.caseId, one.caseId);
  const w2 = setup(); w2.finding(Q, [{ target: DOC }]); w2.finding(Q2, [{ target: DOC2 }]);
  const P2 = w2.project("Team", "alice", [Q, Q2]);
  const both = w2.publish(P2, "alice", [Q, Q2]);
  for (const k of ["target", "bundleSha", "state"]) assert.equal(k in both, false, `a case of two answers no ${k}`);
  assert.deepEqual(both.findings.map((x) => x.target), [Q, Q2], "in the order published");
});

test("R16: citations — every non-severed cites edge of the project at the act, in order, each pinned (its capture), only_capture (the one held), undetermined (several held, never back-filled), no_capture or no_bytes", () => {
  const w = setup();
  w.doc(DOC3);
  /* DOC3 holds a second capture: a reading of other bytes */
  const other = "e".repeat(64);
  w.st.sql.exec(`INSERT INTO readings (capture_sha, bundle_id, content_type, found, entity_count, reading, at)
                 VALUES (?, ?, 'doc', 0, 0, '{}', ?)`, other, DOC3, w.clock.now);
  /* DOC4 holds no capture at all */
  assert.equal(w.promotion.promote({ bundleId: DOC4, base: null, snapKey: "d4", author: V("alice"),
    files: [{ path: "bundle.md", text: infoMd(DOC4) }], meta: { object_type: "information" } }).ok, true);
  w.doc(DOC5);
  w.finding(Q, [{ target: DOC }]);
  const pin = w.row(`SELECT capture_sha FROM register WHERE bundle_id=?`, DOC).capture_sha;
  const P = w.project("Team", "alice", [Q, { target: DOC, extent_capture: pin }, DOC2, DOC3, DOC4,
                                        { target: DOC5, status: "severed" }]);
  const r = w.publish(P, "alice", [Q]);
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  const only = w.row(`SELECT capture_sha FROM register WHERE bundle_id=?`, DOC2).capture_sha;
  const head = (id) => ({ bundle_sha: w.record.head(id).bundleSha });   /* K4609: a document row names the head too */
  const want = [{ target: Q, version: "no_bytes", capture: null }, { target: DOC, version: "pinned", capture: pin, ...head(DOC) },
                { target: DOC2, version: "only_capture", capture: only, ...head(DOC2) },
                { target: DOC3, version: "undetermined", capture: null, ...head(DOC3) },
                { target: DOC4, version: "no_capture", capture: null, ...head(DOC4) }];
  assert.deepEqual(r.case_citations, want);
  const fm = w.fm(docOf(w, r).text);
  assert.deepEqual(fm.case_citations.map((x) => [x.target, x.version, x.capture === "null" ? null : x.capture]),
    want.map((x) => [x.target, x.version, x.capture]));
  const body = bodyOf(docOf(w, r).text);
  for (const x of want) assert.ok(body.includes(`- ${x.target}: ${CASE_CITATION_WORDS[x.version]}${x.capture ? ` ${x.capture}` : ""}`));
  /* a project citing nothing says so */
  const w2 = setup(); w2.finding(Q2, [{ target: DOC }]); w2.finding(Q, [{ target: Q2 }]);   /* R86: resting on another finding names no document */
  const P2 = w2.project("Quiet", "alice", []);
  const q = w2.publish(P2, "alice", [Q]);
  assert.deepEqual(q.case_citations, []);
  assert.ok(bodyOf(docOf(w2, q).text).includes(word("case-authoring.body.case_project_cited")));
});

test("R17: the searched section is computed from the observation log at authoring over the members' legs (subject source case_basis only), states what was looked for at each level with its outcome and why where undetermined, is bounded by SEARCHED_SUBJECT_MAX, and is never recomputed", () => {
  const w = setup();
  w.finding(Q, [{ target: DOC }, { target: Q2 }]);   /* a question leg names no content: an unidentified referent */
  const capA = w.row(`SELECT capture_sha FROM register WHERE bundle_id=?`, DOC).capture_sha;
  /* the document was fetched at an address (provenance's receipt; observation-log records the look, its R5) */
  w.prov.recordReceipt({ address: "https://example.org/a", addressNorm: "example.org/a", captureSha: capA,
                         retrieved: "2026-09-27T00:00:00Z" });
  const P = w.project("Team", "alice", [Q]);
  /* fetched direct, so Grade B, and not co-attested: published as self-attested only (R55 (case-disclosures R2)) */
  const r = w.publish(P, "alice", [Q], { selfAttested: [{ capture: capA, reason: "the site refuses the archive" }] });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  const text = docOf(w, r).text;
  const fm = w.fm(text);
  assert.deepEqual([fm.searched.computed_at, fm.searched.subject_source, fm.searched.levels_reported],
    [w.clock.now, "case_basis", 3]);
  const lv = Object.fromEntries(fm.searched_levels.map((l) => [l.level, l]));
  assert.deepEqual([lv.document.subject_kind, lv.document.outcome, lv.document.subjects, lv.document.looked, lv.document.unidentified],
    ["address", "partial", 1, 1, 1], "the address was looked at; the question leg could not be named");
  assert.deepEqual([lv.content.subject_kind, lv.content.outcome, lv.content.subjects, lv.content.undetermined],
    ["capture", "undetermined", 1, 1], "no content row: the pre-log or purge cause cannot be excluded");
  assert.equal(lv.meaning.subject_kind, "capture");
  assert.ok(lv.content.detail.startsWith(SEARCHED_LEVEL_OUTCOMES.undetermined));
  assert.ok(bodyOf(text).includes("**content level** (capture): UNDETERMINED"));
  /* never recomputed: the log moves and the document does not */
  w.prov.recordReceipt({ address: "https://example.org/b", addressNorm: "example.org/b", captureSha: capA,
                         retrieved: "2026-09-27T01:00:00Z" });
  assert.equal(docOf(w, r).text, text);
  /* the bound: past SEARCHED_SUBJECT_MAX captures the overflow is unidentified, never searched over a truncated set */
  assert.equal(SEARCHED_SUBJECT_MAX, 500);
  /* Q's synthetic captures are not held, so Q travels supporting (R55 (case-disclosures R6)), beside a load-bearing Q2 on the same document */
  const w2 = setup();
  w2.finding(Q, [{ target: DOC }]);
  w2.finding(Q2, [{ target: DOC }]);
  const P2 = w2.project("Team", "alice", [Q, Q2]);
  const ord0 = w2.row(`SELECT MAX(ord) AS m FROM inquiry_basis WHERE bundle_id=?`, Q).m + 1;
  for (let i = 0; i < SEARCHED_SUBJECT_MAX + 1; i++) {
    const cid = sha(`content ${i}`), cap = sha(`capture ${i}`);
    w2.st.sql.exec(`INSERT INTO content (content_id, capture_sha, bundle_id, extent_kind, extent, ref, minted_by, at, cited_as)
                    VALUES (?, ?, ?, 'document', '{"kind":"document"}', 'the document', 'plane', ?, 'text')`,
                   cid, cap, DOC, w2.clock.now);
    w2.st.sql.exec(`INSERT INTO inquiry_basis (bundle_id, ord, role, target_id, target_type, content_id)
                    VALUES (?, ?, 'supports', ?, 'information', ?)`, Q, ord0 + i, DOC, cid);
  }
  const big = w2.publish(P2, "alice", [Q2, Q], { roles: { [Q2]: "load_bearing", [Q]: "supporting" } });
  assert.equal(big.ok, true, JSON.stringify(big).slice(0, 300));
  const blv = Object.fromEntries(w2.fm(docOf(w2, big).text).searched_levels.map((l) => [l.level, l]));
  /* 502 captures (the leg's own and the 501 above): 500 computed over, 2 folded into unidentified */
  assert.deepEqual([blv.content.subjects, blv.content.unidentified], [SEARCHED_SUBJECT_MAX, 2]);
  assert.notEqual(blv.content.outcome, "searched");
  /* R14 (G47 4; case-grammar R35): 501 captures of one source carry attestation shas; case-grammar's helper answers the
     format in force, /10, with or without a sha (it answered /9 here before R35) */
  const bigFm = w2.fm(docOf(w2, big).text);
  assert.equal((bigFm.material_attestations || []).some((a) => a.sha), true);
  assert.equal(bigFm.format, "bio-case-document/10");
});

test("R17: searchedSection refuses to compute dishonestly — no instant, a subject source other than case_basis, no levels, a level or subject kind the vocabulary does not name — and never says never_looked where the evidence is one-sided", () => {
  const ok = { at: "2026-09-28T01:00:00Z", subjectSource: "case_basis", levels: [] };
  assert.equal(searchedSection(ok).ok, true);
  assert.deepEqual(searchedSection(ok).levels, []);
  for (const bad of [{ ...ok, at: "" }, { ...ok, at: null }, { ...ok, subjectSource: "observation_log" },
                     { ...ok, levels: null }, { ...ok, levels: [{ level: "ether", subject_kind: "capture" }] },
                     { ...ok, levels: [{ level: "content", subject_kind: "rumour" }] }]) {
    const r = searchedSection(bad);
    assert.equal(r.ok, false); assert.equal(typeof r.why, "string");
  }
  const one = (level, kind, subjects, unidentified = 0) =>
    searchedSection({ ...ok, levels: [{ level, subject_kind: kind, subjects, unidentified }] }).levels[0];
  assert.equal(one("content", "capture", []).outcome, "no_subjects", "zero of zero is not searched");
  assert.equal(one("content", "capture", [], 2).outcome, "partial");
  assert.equal(one("content", "capture", [{ subject: "a", state: "PRESENT" }]).outcome, "searched");
  assert.equal(one("content", "capture", [{ subject: "a", state: "PRESENT" }], 1).outcome, "partial");
  assert.equal(one("content", "capture", [{ subject: "a", state: null, cause: "never_looked" }]).outcome, "never_looked");
  const coerced = one("meaning", "reference", [{ subject: "a", state: null, cause: "never_looked" }]);
  assert.deepEqual([coerced.outcome, coerced.evidence_one_sided], ["undetermined", true],
    "one-sided evidence cannot establish that nobody looked");
});

test("R11: a searched section that cannot be computed honestly is CASE_SEARCHED_UNCOMPUTABLE, and nothing is written", () => {
  const w = setup({ now: () => "" });   /* a clock that answers no instant */
  w.finding(Q, [{ target: DOC }]);
  const P = w.project("Team", "alice", [Q]);
  const before = w.snapshot();
  const r = w.publish(P, "alice", [Q]);
  assert.deepEqual([r.ok, r.reason, r.code], [false, "CASE_SEARCHED_UNCOMPUTABLE", "CASE_SEARCHED_UNCOMPUTABLE"]);
  assert.match(r.detail, /searched section could not be computed: a searched section requires the time/);
  assert.deepEqual(w.snapshot(), before, "no case id, no document, no row");
});

test("R22: everything the document asserts arrived as an argument or was read from the record at the act — pins, pairs, conclusions, manifest, citations, searched section, acknowledgements — or is a stated fact; nothing is composed", () => {
  const w = setup();
  w.finding(Q, [{ target: DOC, grade: "C", grade_axis: "capture", grade_source: "capture" }]);
  const P = w.project("Team", "alice", [Q, DOC2]);
  const r = w.publish(P, "alice", [Q], { excluded: EXCLUDED });
  const fm = w.fm(docOf(w, r).text);
  assert.equal(fm.case_roles[0].version_sha, w.head(Q), "the pin is the member's head");
  for (const axis of ["capture", "connection"]) {
    const read = w.strength.strengthOf(Q)[axis];
    const row = fm.case_strength.find((x) => x.axis === axis);
    assert.deepEqual([row.state, row.grade === "null" ? null : row.grade, row.population], [read.state, read.grade, read.population]);
  }
  const conc = w.ratification.caseConclusionFor(P, Q, V("alice"), "concluded");
  assert.deepEqual([fm.case_conclusions[0].relationship, fm.case_conclusions[0].falsifier], [conc.relationship, conc.falsifier]);
  assert.deepEqual(r.bias_manifest.stated, w.bias.biasManifest({ scope: "project", scopeId: P, viewer: PLANE_VIEWER, limit: 1 }).stated);
  const list = w.ci.statementAcknowledgements(P, r.caseId, 1, AUTHORED.statement, "alice", { by: "alice" }, null, null);
  assert.deepEqual([fm.completeness.statement_sha, fm.completeness.acknowledged], [list.statementSha, list.rows.length]);
  /* the same arguments and the same record give the same bytes (nothing is composed at random) */
  const text = caseDocumentText({ caseId: "CASE-2026-0001", edition: 1, project: P, scope: "s", bias: "b",
    bar: w.strength.projectBar(P), roster: [Q], roles: [{ target: Q, role: "load_bearing" }], pins: new Map([[Q, "p"]]),
    statement: "st", position: "not_sought", justification: "j", excluded: [], author: "alice", at: "t",
    searched: searchedSection({ at: "t", subjectSource: "case_basis", levels: [] }), frozen: new Map() });
  assert.equal(caseDocumentText({ caseId: "CASE-2026-0001", edition: 1, project: P, scope: "s", bias: "b",
    bar: w.strength.projectBar(P), roster: [Q], roles: [{ target: Q, role: "load_bearing" }], pins: new Map([[Q, "p"]]),
    statement: "st", position: "not_sought", justification: "j", excluded: [], author: "alice", at: "t",
    searched: searchedSection({ at: "t", subjectSource: "case_basis", levels: [] }), frozen: new Map() }), text);
  assert.ok(text.includes(localize("case-authoring.document.m_no_frozen_strength_was", "- **{m}** — NO FROZEN STRENGTH WAS RECORDED FOR THIS MEMBER.", { m: Q })), "an absent fact is stated, never invented");
  assert.deepEqual(STRENGTH_AXES.includes("testimony"), true);
});

test("R26: undetermined is stated and never filled — a statement writer, an undeclared bar axis, a bias manifest not established, a citation's version", () => {
  const w = setup({ deps: { bias: { biasManifest: () => ({ in_force: null, stated: "a pin cannot be read", pins_proposed: [] }) } } });
  w.doc(DOC3);
  w.st.sql.exec(`INSERT INTO readings (capture_sha, bundle_id, content_type, found, entity_count, reading, at)
                 VALUES (?, ?, 'doc', 0, 0, '{}', ?)`, "e".repeat(64), DOC3, w.clock.now);
  w.finding(Q, [{ target: DOC, grade: "C", grade_axis: "capture", grade_source: "capture" }]);
  const P = w.project("Team", "alice", [Q, DOC3], { extra: ["required_strength:", "  capture: D"] });
  /* two drafts at this identity hold the sentence and name different writers */
  w.draft("DRAFT-2026-0001", P, { statement: AUTHORED.statement }, { statementBy: "alice" });
  w.draft("DRAFT-2026-0002", P, { statement: AUTHORED.statement }, { statementBy: "bo" });
  const r = w.publish(P, "alice", [Q]);
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  assert.equal(r.completeness.statement_by, null);
  assert.match(r.completeness.statement_by_stated, /^UNDETERMINED: 2 drafts .* name different authors \(alice, bo\)/);
  const text = docOf(w, r).text, fm = w.fm(text), body = bodyOf(text);
  assert.equal(fm.completeness.statement_by, null);
  assert.ok(body.includes(localize("case-authoring.document.who_wrote_this_statement", "**Who wrote this statement.** {stated}",
    { stated: r.completeness.statement_by_stated })));
  assert.deepEqual([fm.required_strength.connection, body.includes("no bar set on the connection axis")], [null, true]);
  assert.deepEqual([fm.bias_manifest.in_force, fm.bias_manifest.stated], [null, "a pin cannot be read"]);
  assert.deepEqual(r.case_citations.find((x) => x.target === DOC3), { target: DOC3, version: "undetermined", capture: null, bundle_sha: w.record.head(DOC3).bundleSha });
  /* a draft from before the stamp: undetermined, never filled from the publisher */
  const w2 = setup(); w2.finding(Q, [{ target: DOC }]);
  const P2 = w2.project("Team", "alice", [Q]);
  w2.draft("DRAFT-2026-0001", P2, { statement: AUTHORED.statement }, { statementBy: null });
  const u = w2.publish(P2, "alice", [Q]);
  assert.equal(u.completeness.statement_by, null);
  assert.match(u.completeness.statement_by_stated, /records no author/);
});
