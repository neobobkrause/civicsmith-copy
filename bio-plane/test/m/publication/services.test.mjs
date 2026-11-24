/* publication — the services `public-read` calls (K651): what a case edition is (R53), the sole case of a membership
   list (R54) and a case document's per-member frozen facts (R55); and the manifest's record (R15), which public-read's
   container assembly reaches through its op. Driven at the module's interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { planeWorld as world, caseDoc, V, SIG, KEY, NOW } from "./fixture.mjs";

const F = "INQ-2026-0001", G = "INQ-2026-0002", DOC = "INFO-2026-0001-minutes";
const CASE = "CASE-2026-0001";
const roster = (roles) => roles.map((r) => ({ bundle_id: r.target, version_sha: r.version_sha, role: r.role ?? "load_bearing" }));
const STATE_KEYS = ["awaiting", "bar", "bias_acknowledgement", "caseId", "complete", "completeness", "criteria", "detail", "document",
                    "edition", "findings", "group", "manifest_sha", "opened", "project", "ratified_at", "scope", "timeline"].sort();

/* CASE edition 1 over F (load-bearing, B/C in the document) and G (supporting, stated nothing), signed; nothing published. */
function signed({ format = null, strength = [{ target: F, axis: "capture", grade: "B" }, { target: F, axis: "connection", grade: "C" }] } = {}) {
  const w = world();
  w.member("olive");
  const proj = w.project("Parks", "olive");
  w.doc(DOC);
  w.inquiry(F, { legs: [{ target: DOC }] });
  w.inquiry(G);
  const roles = [{ target: F, version_sha: w.head(F), edition: 3 }, { target: G, version_sha: w.head(G), role: "supporting" }];
  w.prepare(CASE, 1, { project: proj, roles, strength, excludes: "The annex.", ...(format ? { format } : {}) });
  const bar = { declared: true, capture: "B", connection: "C" };
  /* an older format is signed as a store signed it before T28 (R58 refuses committing one now) */
  assert.equal((format ? w.signLegacy : w.signCase)(CASE, 1, { project: proj, roster: roster(roles), bar }).ok, true);
  return { w, proj, roles, bar };
}

test("R53 caseEditionState answers null for no published case edition, else every field it names; a member not yet published awaits, and complete only when every rostered member is", () => {
  const { w, proj, roles, bar } = signed();
  assert.equal(w.p.caseEditionState(CASE, 2), null);
  assert.equal(w.p.caseEditionState("CASE-NONE", 1), null);
  const s0 = w.p.caseEditionState(CASE, 1, "test-group");
  assert.deepEqual(Object.keys(s0).sort(), STATE_KEYS);
  assert.deepEqual([s0.caseId, s0.edition, s0.group, s0.project, s0.bar, s0.scope, s0.bias_acknowledgement],
                   [CASE, 1, "test-group", proj, bar, "The question.", "none declared"]);
  assert.deepEqual(s0.completeness, { statement: "It leaves out the minutes.", author: V("olive") });
  assert.deepEqual([s0.complete, s0.awaiting, s0.findings, s0.ratified_at, s0.manifest_sha], [false, [F, G], [], null, null]);
  assert.match(s0.detail, /INCOMPLETE: 2 of 2 findings are not yet ratified/);
  assert.equal(w.p.caseEditionState(CASE, 1).group, null, "no group given: null, stated");
  /* the signed document: signature, attestor, deliverer, gate version, instant (commitCaseEdition ratified it) */
  const d = s0.document;
  assert.deepEqual([d.sig_armored, d.attestor, d.delivered_by, d.gate_version, d.ratified_at],
                   [SIG(1), { member: "olive", key_b64: KEY }, { kind: "member", member: "olive" }, "plane-gate/test", NOW]);
  assert.equal(d.doc_sha, w.row(`SELECT doc_sha FROM case_documents`).doc_sha);
  assert.equal(typeof d.text, "string");
  assert.deepEqual(s0.timeline, { they_did: [], we_did: [] }, "R63: a document without the block states both lanes empty");
  /* one member published: it is in findings with everything R53 names, the other still awaits */
  w.clock.now = "2026-09-28T02:00:00Z";
  assert.equal(w.signFinding(F, { sig: SIG(2), at: "2026-09-28T02:00:00Z" }).ok, true);
  const s1 = w.p.caseEditionState(CASE, 1);
  assert.deepEqual([s1.complete, s1.awaiting, s1.findings.length], [false, [G], 1]);
  const f = s1.findings[0];
  assert.deepEqual([f.bundle_id, f.bundle_sha, f.version_sha, f.edition, f.role, f.sig_armored, f.gate_version],
                   [F, roles[0].version_sha, roles[0].version_sha, 3, "load_bearing", SIG(2), "plane-gate/test"]);
  assert.deepEqual([f.attestor, f.delivered_by], [{ member: "olive", key_b64: KEY }, { kind: "member", member: "olive" }]);
  assert.deepEqual(f.parts, [{ path: "bundle.md", sha256: roles[0].version_sha, kind: "bundle", bytes: 10 }]);
  /* the pair and grounds read from the case document where it states them, and it says so */
  assert.deepEqual([f.frozen_from, f.strength.map((s) => [s.axis, s.grade]), f.grounds], ["case_document", [["capture", "B"], ["connection", "C"]], []]);
  assert.match(f.case_excludes, /The annex\./);
  assert.equal(f.edition, w.row(`SELECT edition FROM published_bundles WHERE bundle_id=?`, F).edition,
               "the member's own edition, its published row's (rule 12 took it from the case document, 3), never the case's (1)");
  assert.equal("strength" in s1, false, "no case-level strength (R26)");
});

test("R53 its one write: when the edition first reads complete, the instant the last member landed is stamped as ratified_at, once, never re-stamped", () => {
  const { w } = signed();
  w.st.sql.exec(`UPDATE published_cases SET ratified_at=NULL`);
  w.signFinding(F, { sig: SIG(2), at: "2026-09-28T02:00:00Z" });
  w.signFinding(G, { sig: SIG(3), at: "2026-09-28T05:00:00Z" });
  w.st.sql.exec(`UPDATE published_cases SET ratified_at=NULL`);
  const before = w.snapshot();
  const s = w.p.caseEditionState(CASE, 1);
  assert.deepEqual([s.complete, s.awaiting, s.ratified_at], [true, [], "2026-09-28T05:00:00Z"]);
  assert.match(s.detail, /every finding in this case edition is ratified/);
  const after = w.snapshot();
  assert.equal(w.row(`SELECT ratified_at FROM published_cases`).ratified_at, "2026-09-28T05:00:00Z");
  delete before.published_cases; delete after.published_cases;
  assert.deepEqual(after, before, "no other table is written");
  /* never re-stamped: a later read, and a later ratification of the same bytes, leave it */
  w.st.sql.exec(`UPDATE published_bundles SET ratified_at='2026-09-29T00:00:00Z'`);
  assert.equal(w.p.caseEditionState(CASE, 1).ratified_at, "2026-09-28T05:00:00Z");
  assert.equal(w.row(`SELECT ratified_at FROM published_cases`).ratified_at, "2026-09-28T05:00:00Z");
});

test("R53 each member resolved by its pin: a member at its own edition in a case at another edition is found; a member with no pin is read at the case's edition number; a case older than DEC-72 has project null", () => {
  const { w, proj, roles } = signed();
  w.signFinding(F, { sig: SIG(2) });
  w.signFinding(G, { sig: SIG(3) });
  w.prepare(CASE, 2, { project: proj, roles: [roles[0]] });
  w.signCase(CASE, 2, { project: proj, roster: roster([roles[0]]), sig: SIG(20) });
  const s2 = w.p.caseEditionState(CASE, 2);
  assert.deepEqual([s2.complete, s2.findings.map((f) => [f.bundle_id, f.edition])], [true, [[F, 3]]],
                   "found by its pin in the case's edition 2, at its own edition");
  /* a pre-CASE-3 roster row, its pin null: read at the case's edition number */
  w.st.sql.exec(`INSERT INTO published_cases (case_id, edition, opened) VALUES ('CASE-LEGACY', 1, ?)`, NOW);
  w.st.sql.exec(`INSERT INTO published_case_members (case_id, edition, ord, bundle_id, version_sha, role)
                 VALUES ('CASE-LEGACY', 1, 0, ?, NULL, NULL)`, G);
  const legacy = w.p.caseEditionState("CASE-LEGACY", 1);
  assert.deepEqual([legacy.project, legacy.complete, legacy.findings[0].bundle_id, legacy.findings[0].version_sha,
                    legacy.findings[0].role, legacy.findings[0].frozen_from, legacy.document],
                   [null, true, G, null, null, "member_bytes", null]);
  /* an empty roster is never complete */
  w.st.sql.exec(`INSERT INTO published_cases (case_id, edition, opened) VALUES ('CASE-EMPTY', 1, ?)`, NOW);
  const empty = w.p.caseEditionState("CASE-EMPTY", 1);
  assert.deepEqual([empty.complete, empty.findings, empty.awaiting], [false, [], []]);
});

test("R53 a legacy (/1) document states no member blocks: each member's own ratified pair is read, frozen_from member_bytes", () => {
  const { w } = signed({ format: "bio-case-document/1" });
  w.signFinding(F, { sig: SIG(2), strength: [{ axis: "capture", state: "graded", grade: "A" }] });
  const f = w.p.caseEditionState(CASE, 1).findings[0];
  assert.deepEqual([f.frozen_from, f.strength, "grounds" in f, "case_excludes" in f],
                   ["member_bytes", [{ axis: "capture", state: "graded", grade: "A" }], false, false]);
});

test("R54 soleCase answers the one case a list names at its highest edition listed, or null for none or several; pure, never throws", () => {
  const { w } = signed();
  const p = w.p;
  assert.equal(p.soleCase([]), null);
  assert.deepEqual(p.soleCase([{ case_id: "A", edition: 1 }]), { case_id: "A", edition: 1 });
  assert.deepEqual(p.soleCase([{ case_id: "A", edition: 1 }, { case_id: "A", edition: 3 }, { case_id: "A", edition: "2" }]),
                   { case_id: "A", edition: 3 }, "editions of one case collapse to the highest");
  assert.equal(p.soleCase([{ case_id: "A", edition: 1 }, { case_id: "B", edition: 1 }]), null, "never chooses among cases");
  for (const odd of [null, undefined, 7, "A", {}, [null], [7], [{}], [{ edition: 1 }], [{ case_id: null, edition: 2 }]])
    assert.equal(p.soleCase(odd), null, JSON.stringify(odd));
  assert.deepEqual(p.soleCase([null, { case_id: "A", edition: 2 }, 7]), { case_id: "A", edition: 2 }, "a row is what names a case");
  const before = w.snapshot();
  p.soleCase([{ case_id: "A", edition: 1 }]);
  assert.deepEqual(w.snapshot(), before);
});

test("R55 caseDocMemberFrozen answers, for a document stating member blocks, each case_roles member's edition, pin, pair, grounds and excludes; null for one stating none or none held; writes nothing, never throws", () => {
  const { w, proj, roles } = signed();
  const m = w.p.caseDocMemberFrozen(CASE, 1);
  assert.ok(m instanceof Map);
  assert.deepEqual([...m.keys()], [F, G]);
  const { excludes, ...rest } = m.get(F);
  assert.deepEqual(rest, { edition: 3, version_sha: roles[0].version_sha,
    strength: [{ axis: "capture", state: "graded", grade: "B" }, { axis: "connection", state: "graded", grade: "C" }],
    grounds: [] });
  assert.match(excludes, /^## What This Excludes\n\nThe annex\.\n$/, "the document's own section");
  assert.equal(m.get(G).excludes, excludes, "the case's one section, beside each member");
  assert.deepEqual(m.get(G).strength, [], "a member the document states no pair for has none");
  /* grounds, as case_strength_grounds states them for that member alone */
  const text = caseDoc(CASE, 5, { project: proj, roles }).replace("case_citations: []",
    `case_strength_grounds:\n  - target: ${F}\n    axis: capture\n    ground: the minutes\n  - target: ${G}\n    axis: capture\n    ground: other\ncase_citations: []`);
  w.p.storeCaseDocument({ case: CASE, edition: 5, text, author: V("olive") });
  assert.deepEqual(w.p.caseDocMemberFrozen(CASE, 5).get(F).grounds, [{ axis: "capture", ground: "the minutes" }]);
  /* a /1 document states none; no document; an unreadable store */
  w.prepare(CASE, 6, { project: proj, roles, format: "bio-case-document/1" });
  assert.equal(w.p.caseDocMemberFrozen(CASE, 6), null);
  assert.equal(w.p.caseDocMemberFrozen(CASE, 9), null);
  assert.equal(w.p.caseDocMemberFrozen(null, "x"), null);
  const before = w.snapshot();
  w.p.caseDocMemberFrozen(CASE, 1);
  assert.deepEqual(w.snapshot(), before, "it writes nothing");
  w.st.sql.exec(`UPDATE case_documents SET text='---\nformat: [' WHERE edition=5`);
  assert.doesNotThrow(() => w.p.caseDocMemberFrozen(CASE, 5));
  w.st.db.exec(`DROP TABLE case_exclusions`);
  w.st.db.exec(`ALTER TABLE case_documents RENAME TO gone`);
  assert.equal(w.p.caseDocMemberFrozen(CASE, 1), null, "a read that fails answers null, never throws");
});

test("R15 recordCaseManifest records a case edition's manifest once, through its op only (no caller's route): MALFORMED, NO_SUCH_CASE_EDITION, MANIFEST_EXISTS", () => {
  const { w } = signed();
  const sha = "1".repeat(64);
  assert.equal(w.op("recordcasemanifest", {}, { caseId: CASE, edition: 1 }).reason, "MALFORMED");
  assert.equal(w.op("recordcasemanifest", {}, null).reason, "MALFORMED");
  const none = w.op("recordcasemanifest", {}, { caseId: CASE, edition: 7, manifest: { m: 1 }, manifestSha: sha });
  assert.deepEqual([none.ok, none.reason], [false, "NO_SUCH_CASE_EDITION"]);
  const ok = w.op("recordcasemanifest", {}, { caseId: CASE, edition: 1, manifest: { m: 1 }, manifestSha: sha, bytes: 42 });
  assert.deepEqual(ok, { ok: true, caseId: CASE, edition: 1, manifest_sha: sha });
  assert.deepEqual(w.row(`SELECT manifest_sha, manifest FROM published_cases`), { manifest_sha: sha, manifest: '{"m":1}' });
  assert.deepEqual(w.rows(`SELECT bundle_id, path, kind, bytes FROM published_shas WHERE sha256=?`, sha),
                   [{ bundle_id: CASE, path: "MANIFEST.json", kind: "manifest", bytes: 42 }]);
  assert.equal(w.p.caseEditionState(CASE, 1).manifest_sha, sha);
  /* once: the same hash again answers, another is refused and nothing moves */
  assert.equal(w.op("recordcasemanifest", {}, { caseId: CASE, edition: 1, manifest: { m: 1 }, manifestSha: sha }).ok, true);
  const before = w.snapshot();
  const other = w.p.recordCaseManifest({ caseId: CASE, edition: 1, manifest: { m: 2 }, manifestSha: "2".repeat(64) });
  assert.deepEqual([other.reason, other.manifest_sha], ["MANIFEST_EXISTS", sha]);
  assert.deepEqual(w.snapshot(), before);
});
