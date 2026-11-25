/* case-authoring (T22; DEC-101, K1019): what changed in an edition above 1, and why (R38). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V, AUTHORED, WHAT_CHANGED } from "./fixture.mjs";
import { PLANE_VIEWER } from "../../../src/case-authoring/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";
/* R38 (T47; N908): the 8,000-character bound is case-inputs' one spelling, imported by case-authoring. */
import { WHAT_CHANGED_MAX } from "../../../src/case-inputs/index.mjs";
import { whatChangedOf, whatChangedSectionLines, whatChangedBlockLines, WHAT_CHANGED_HEAD, lensOf, lensBlockLines,
         lensSectionLines, LENS_HEAD, LENS_NONE_SENTENCE, SECTIONS } from "../../../src/case-grammar/index.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";

const DOC = "INFO-2026-0001-a", DOC2 = "INFO-2026-0002-b", Q = "INQ-2026-0001-q";
/* A second edition's own completeness, fresh against the first's (R10). */
const FRESH = Object.freeze({ statement: "It does not cover the award's amendments.",
  subjectJustification: "A public record, so the question is whether it was followed.",
  biasAcknowledgement: "We read the minutes as the account of the meeting, as of this edition.",
  excluded: [{ description: "the amendments", reason: "requested and not yet held" }] });

/* Edition 1 of a case published and signed, and its finding moved, so the next act is edition 2. */
function setup() {
  const w = world();
  for (const m of ["alice", "bo"]) w.member(m);
  w.doc(DOC); w.doc(DOC2);
  w.finding(Q, [{ target: DOC }]);
  const P = w.project("Team", "alice", [Q]);
  const e1 = w.publish(P, "alice", [Q], { whatChanged: undefined });
  assert.equal(e1.ok, true, JSON.stringify(e1).slice(0, 300));
  w.ratify(e1);
  w.finding(Q, [{ target: DOC }, { target: DOC2 }]);
  return { w, P, e1 };
}
const second = (w, P, e1, over = {}) => w.publish(P, "alice", [Q], { caseId: e1.caseId, ...FRESH, ...over });

test("R38: an edition above 1 with no whatChanged, a blank text, or a text over 8,000 characters is refused by name (NO_WHAT_CHANGED, BAD_WHAT_CHANGED) before anything is written — no case document stored, no id allocated; a named draft is NO_SUCH_WHAT_CHANGED_DRAFT", () => {
  const { w, P, e1 } = setup();
  const before = w.snapshot();
  assert.equal(WHAT_CHANGED_MAX, 8000);
  for (const whatChanged of [undefined, null, "a sentence", [], {}, { text: null }, { text: 7 }, { text: "" },
                             { text: "   " }, { text: "\n\t" }]) {
    const r = second(w, P, e1, { whatChanged });
    assert.deepEqual([r.ok, r.reason, r.caseId, r.edition], [false, "NO_WHAT_CHANGED", e1.caseId, 2],
      `whatChanged ${JSON.stringify(whatChanged)}`);
  }
  /* 8,001 code points, ASCII or astral (two UTF-16 units each) */
  for (const text of ["x".repeat(8001), "\u{1F4DC}".repeat(8001)]) {
    const r = second(w, P, e1, { whatChanged: { text } });
    assert.deepEqual([r.ok, r.reason, r.length, r.max], [false, "BAD_WHAT_CHANGED", 8001, 8000]);
  }
  /* a named draft that is none of this case's (R39 holds none here) */
  for (const draft of ["WCD-2026-0001", 7]) {
    const r = second(w, P, e1, { whatChanged: { ...WHAT_CHANGED, draft } });
    assert.deepEqual([r.ok, r.reason, r.draft], [false, "NO_SUCH_WHAT_CHANGED_DRAFT", String(draft)]);
  }
  assert.deepEqual(w.snapshot(), before, "nothing written: no case document, no id, no row");
  assert.equal(w.rows(`SELECT 1 FROM case_documents WHERE case_id=? AND edition=2`, e1.caseId).length, 0);
  /* after R3's refusals: an act missing its statement too answers NO_STATEMENT first */
  assert.equal(second(w, P, e1, { whatChanged: undefined, statement: "" }).reason, "NO_STATEMENT");
  /* negative controls: exactly 8,000 code points, astral or not, publishes; a draft of null or blank names none */
  for (const text of ["x".repeat(8000), "\u{1F4DC}".repeat(8000)]) {
    const w2 = setup();
    const ok = second(w2.w, w2.P, w2.e1, { whatChanged: { text, draft: "  " } });
    assert.deepEqual([ok.ok, ok.edition], [true, 2], JSON.stringify(ok).slice(0, 300));
  }
  const ok = second(w, P, e1, { whatChanged: { ...WHAT_CHANGED, draft: null } });
  assert.deepEqual([ok.ok, ok.edition], [true, 2], JSON.stringify(ok).slice(0, 300));
});

test("R38: a first edition needs no statement of what changed, and carries none", () => {
  const w = world();
  w.member("alice"); w.doc(DOC); w.finding(Q, [{ target: DOC }]);
  const P = w.project("Team", "alice", [Q]);
  const r = w.ca.publishCase({ ...AUTHORED, project: P, targets: [Q], roles: { [Q]: "load_bearing" }, viewer: V("alice"),
                               author: "alice" });
  assert.deepEqual([r.ok, r.edition], [true, 1], JSON.stringify(r).slice(0, 300));
});

test("R38 (R34): the pre-flight's first is exactly the act's refusal for a missing, over-long or drafted statement, and it writes nothing", () => {
  const { w, P, e1 } = setup();
  const base = { ...AUTHORED, ...FRESH, project: P, targets: [Q], roles: { [Q]: "load_bearing" }, caseId: e1.caseId,
                 viewer: V("alice"), author: "alice" };
  for (const whatChanged of [undefined, { text: " " }, { text: "x".repeat(8001) }, { ...WHAT_CHANGED, draft: "WCD-1" }]) {
    const before = w.snapshot();
    const pre = w.ca.publishPreflight({ ...base, whatChanged });
    assert.deepEqual(w.snapshot(), before, "the pre-flight wrote nothing");
    const act = w.ca.publishCase({ ...base, whatChanged });
    assert.equal(act.ok, false);
    assert.deepEqual(pre.first, act, `first is the act's own refusal (${act.reason})`);
    assert.equal(pre.ready, false);
  }
});

const docOf = (w, caseId, edition) => w.row(`SELECT * FROM case_documents WHERE case_id=? AND edition=?`, caseId, edition);

test("R38, R14: an edition 2 with a statement stores case-grammar R8's block and section — whatChangedOf reads it back as began_as member — at the top of the body, outside the acknowledgement list's runs, and an acknowledgement's re-authoring leaves it whole; a first edition carries neither", () => {
  const { w, P, e1 } = setup();
  const e1doc = docOf(w, e1.caseId, 1).text;
  assert.equal(whatChangedOf(parseFrontmatter(e1doc).data, parseFrontmatter(e1doc).body), null, "edition 1 carries none");
  assert.equal(e1doc.includes(WHAT_CHANGED_HEAD), false);
  /* several lines, one that would begin a heading: the section holds it escaped, so it cannot end the section early */
  const text = "We added the amendments to the exclusions.\n\n## Not a heading\nThe award stands.";
  const e2 = second(w, P, e1, { whatChanged: { text } });
  assert.equal(e2.ok, true, JSON.stringify(e2).slice(0, 300));
  const doc = docOf(w, e1.caseId, 2), p = parseFrontmatter(doc.text);
  assert.deepEqual(whatChangedOf(p.data, p.body),
    { statement: "We added the amendments to the exclusions.\n\n\\## Not a heading\nThe award stands.", began_as: "member",
      draft: null, adopted_as_drafted: null });
  /* written through case-grammar's builders, byte for byte */
  const lines = doc.text.split("\n");
  for (const run of [whatChangedBlockLines({ statement: text, began_as: "member" }), whatChangedSectionLines(text)])
    assert.ok(doc.text.includes(run.join("\n")), run[0]);
  /* at the top: the first section after the title */
  const heads = lines.filter((l) => l.startsWith("## ") || l.startsWith("# "));
  assert.deepEqual(heads.slice(0, 3), [`# Case ${e1.caseId} — edition 2`, WHAT_CHANGED_HEAD, "## Scope"]);
  /* outside the acknowledgement list's runs (case-grammar R3), which publication R21 re-authors */
  const at = SECTIONS.acknowledgements(lines);
  const wc = lines.indexOf(WHAT_CHANGED_HEAD), block = lines.indexOf("what_changed:");
  assert.ok(at && (wc < at.b0 || wc > at.b1) && (block < at.f0 || block > at.f1));
  /* an acknowledgement re-authors the list: the statement and its block survive unchanged */
  w.member("cy"); w.join(P, "bo"); w.join(P, "cy");
  const a = w.ci.acknowledgeStatement({ viewer: V("bo"), caseId: e1.caseId, edition: 2, reason: "Read it." });
  assert.equal(a.ok, true, JSON.stringify(a).slice(0, 300));
  const after = docOf(w, e1.caseId, 2);
  assert.notEqual(after.doc_sha, doc.doc_sha, "the list was re-authored");
  const q = parseFrontmatter(after.text);
  assert.deepEqual(whatChangedOf(q.data, q.body), whatChangedOf(p.data, p.body));
  assert.equal(q.data.completeness.acknowledged, 1);
  /* the answer's document is the stored one: the publisher is shown exactly what will be printed */
  assert.equal(e2.caseDocument.bytes, new TextEncoder().encode(doc.text).length);
});

/* ===== R40: the lens printed into the signed case (DEC-103) ===== */

const BIAS = "BIAS-2026-0001-a";
const yaml = (fm) => ["---", ...Object.entries(fm).flatMap(([k, v]) => (Array.isArray(v) && v.length && typeof v[0] === "object"
  ? [`${k}:`, ...v.flatMap((row) => Object.entries(row).map(([rk, rv], i) => `${i ? "    " : "  - "}${rk}: ${JSON.stringify(rv)}`))]
  : [`${k}: ${JSON.stringify(v)}`])), "---"].join("\n");
const biasMd = (fm) => [yaml(fm), "", "## Statements", "", "The lens.", "", "## What This Does Not Enforce", "",
  "It does not check whether a second source was independent of the first.", ""].join("\n");
/* A bias set promoted along its machine to adopted, then adopted for the project with the adopter's reason (bias R11). */
function adoptLens(w, P, statements) {
  let prior = null;
  for (const st of ["draft", "proposed", "adopted"]) {
    const head = w.record.head(BIAS);
    const r = w.promotion.promote({ bundleId: BIAS, base: head ? head.bundleSha : null, snapKey: `bias-${st}`,
      author: V("alice"), files: [{ path: "bundle.md", text: biasMd({ id: BIAS, object_type: "bias", title: "Our lens",
        current_state: st, prior_state: prior, created: "2026-09-27T00:00:00Z", last_updated: "2026-09-27T00:00:00Z",
        group: "test-group", statements }) }], meta: { object_type: "bias" } });
    assert.equal(r.ok, true, JSON.stringify(r).slice(0, 400));
    prior = st;
  }
  const a = w.bias.biasAdopt({ bundleId: BIAS, scope: "project", scopeId: P, author: "alice", identity: V("alice"),
                               viewer: V("alice"), reason: "We adopt this lens because the office is a party here." });
  assert.equal(a.ok, true, JSON.stringify(a).slice(0, 400));
}

test("R40, R14 (D54): every statement in force is printed through case-grammar R9 — kind in plain words, subject, text, justification — with each citation that is public material (a public web address, a bundle or hash this copy has published) and the rest only counted, named nowhere in the document; the stored unsigned bytes are what is printed", () => {
  const w = world();
  for (const m of ["alice", "bo"]) w.member(m);
  w.doc(DOC); w.doc(DOC2);
  w.finding(Q, [{ target: DOC }]);
  const P = w.project("Team", "alice", [Q]);
  /* DOC2 published by this copy: its id and its bytes' hash are public material */
  const pubSha = w.head(DOC2);
  assert.equal(w.publication.commitEdition({ bundleId: DOC2, edition: 1, bundleSha: pubSha, title: "d", attestorKey: "k",
    gateVersion: "1.37.0", sigArmored: "s-d-1", shas: [], edges: [], at: "2026-09-28T02:00:00Z" }).ok, true);
  const PRIVATE = ["INFO-2026-0077-private", "e".repeat(64), "http://internal.example/memo", "https://intranet/x"];
  const S1 = { id: "s1", kind: "scrutiny", subject: "ENT-2026-0007", text: "Claims from this office need a second record.",
               justification: "The office is a party to matters this group examines.",
               citations: ["https://example.org/report", DOC2, ...PRIVATE] };
  const S2 = { id: "s2", kind: "pattern", subject: "ENT-2026-0008", text: "This office revises minutes after the vote.",
               justification: "Three revisions found in a year.", citations: [pubSha.toUpperCase()] };
  adoptLens(w, P, [S1, S2]);
  const r = w.publish(P, "alice", [Q]);
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  const doc = docOf(w, r.caseId, 1), p = parseFrontmatter(doc.text);
  assert.deepEqual(lensOf(p.data), { statements: [
    { bundle: BIAS, id: "s1", kind: "scrutiny", subject: "ENT-2026-0007", text: S1.text, justification: S1.justification,
      withheld: 4, citations: ["https://example.org/report", DOC2] },
    { bundle: BIAS, id: "s2", kind: "pattern", subject: "ENT-2026-0008", text: S2.text, justification: S2.justification,
      withheld: 0, citations: [pubSha.toUpperCase()] }] });
  for (const c of PRIVATE) assert.equal(doc.text.includes(c), false, `${c} is named nowhere in the document`);
  /* the body: the acknowledgement first, each statement with its words, its printed evidence and its withheld count */
  const statements = [S1, S2].map((s) => ({ bundle: BIAS, id: s.id, kind: s.kind, subject: s.subject, text: s.text,
    justification: s.justification, citations: s.citations.map((c) => ({ citation: c, printed: !PRIVATE.includes(c) })) }));
  const section = lensSectionLines({ acknowledgement: AUTHORED.biasAcknowledgement, statements, inForce: true });
  const blocks = lensBlockLines(statements);
  /* the unsigned document R14 stores holds every byte that will be printed, as case-grammar spells it */
  assert.ok(doc.text.includes(section.join("\n")), "the section, byte for byte");
  assert.ok(doc.text.includes(blocks.join("\n")), "the blocks, byte for byte");
  assert.match(doc.text, /Citations withheld: 4 \(which ones is not stated\)/);
  assert.equal(r.caseDocument.doc_sha, doc.doc_sha);
  /* D54 (K2442): P is hidden and the founder is neither invited nor joined, so the founder's viewer no longer sees its
     lens; the act reads it as the plane (`PLANE_VIEWER`) and prints it. Negative control: a member's own read of the
     manifest stays fenced by its sight of the project (bo is no participant), and so does the founder's. */
  assert.equal(w.row(`SELECT 1 AS x FROM project_participants WHERE project_id=? AND member_id='admin'`, P), null);
  assert.equal(w.bias.biasManifest({ scope: "project", scopeId: P, viewer: PLANE_VIEWER, limit: 1 }).in_force, true);
  for (const outside of [V("bo"), "admin"]) {
    const fenced = w.bias.biasManifest({ scope: "project", scopeId: P, viewer: outside, limit: 1 });
    assert.notEqual(fenced.in_force, true, `${outside} does not read a hidden project's lens`);
    assert.equal(JSON.stringify(fenced).includes(S1.text), false);
  }
  /* negative control: a citation becomes public when this copy publishes it */
  const w2 = world(); w2.member("alice"); w2.doc(DOC); w2.doc(DOC2); w2.finding(Q, [{ target: DOC }]);
  const P2 = w2.project("Team", "alice", [Q]);
  adoptLens(w2, P2, [{ ...S1, citations: [DOC2] }]);
  const before = lensOf(parseFrontmatter(docOf(w2, w2.publish(P2, "alice", [Q]).caseId, 1).text).data);
  assert.deepEqual([before.statements[0].citations, before.statements[0].withheld], [[], 1], "unpublished: withheld");
});

test("R40: with no manifest in force the section states that none was, and the blocks are empty; an undetermined manifest prints no statement and says so", () => {
  const w = world(); w.member("alice"); w.doc(DOC); w.finding(Q, [{ target: DOC }]);
  const P = w.project("Team", "alice", [Q]);
  const r = w.publish(P, "alice", [Q]);
  const doc = docOf(w, r.caseId, 1), p = parseFrontmatter(doc.text);
  assert.deepEqual([p.data.lens_statements, p.data.lens_citations, lensOf(p.data)], [[], [], { statements: [] }]);
  assert.ok(doc.text.includes(lensSectionLines({ acknowledgement: AUTHORED.biasAcknowledgement, inForce: false }).join("\n")));
  assert.ok(doc.text.includes(LENS_NONE_SENTENCE));
  const UNDETERMINED = word("bias.undetermined_adoption_pins");
  const u = world({ deps: { bias: { biasManifest: () => ({ ok: true, in_force: null, statements: [], bundles: [],
    stated: UNDETERMINED }) } } });
  u.member("alice"); u.doc(DOC); u.finding(Q, [{ target: DOC }]);
  const ur = u.publish(u.project("Team", "alice", [Q]), "alice", [Q]);
  const ut = docOf(u, ur.caseId, 1).text;
  assert.deepEqual(parseFrontmatter(ut).data.lens_statements, []);
  assert.ok(ut.includes(lensSectionLines({ acknowledgement: AUTHORED.biasAcknowledgement, inForce: null,
    stated: UNDETERMINED }).join("\n")));
});

test("R40: the frozen manifest is read every page — a lens longer than one page is printed whole, in its order", () => {
  const total = 2501;
  const all = Array.from({ length: total }, (_, i) => ({ bundle_id: BIAS, statement_id: `s${String(i).padStart(4, "0")}`,
    kind: "inference", subject: "ENT-2026-0007", text: `Statement ${i}.`, justification: `Why ${i}.`, citations: [] }));
  const asked = [];
  const bias = { biasManifest: ({ limit = 200, offset = 0 } = {}) => {
    asked.push([limit, offset]);
    const page = all.slice(offset, offset + Math.min(limit, 2000));
    return { ok: true, in_force: true, statements_sha: "f".repeat(64), bundles: [{ bundle_id: BIAS, revision: "a".repeat(64),
             scope: "project" }], lock_violations: [], statements: page, total, truncated: offset + page.length < total };
  } };
  const w = world({ deps: { bias } }); w.member("alice"); w.doc(DOC); w.finding(Q, [{ target: DOC }]);
  const r = w.publish(w.project("Team", "alice", [Q]), "alice", [Q]);
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  const lens = lensOf(parseFrontmatter(docOf(w, r.caseId, 1).text).data);
  assert.deepEqual(lens.statements.map((s) => s.id), all.map((s) => s.statement_id));
  assert.ok(asked.some(([, o]) => o === 2000), "the second page was read");
});
