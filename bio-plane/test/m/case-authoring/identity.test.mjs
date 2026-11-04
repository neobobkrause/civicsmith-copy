/* case-authoring: the case an act publishes — its identity (R7), a member already recording this conclusion (R8), the
   draft the publisher names (R9) and C-21.1 at case altitude (R10). Every refusal is asked before a case id is drawn. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V, readingLines, currentLines, AUTHORED, WHAT_CHANGED } from "./fixture.mjs";
import { CASE_DERIVATION_CHECKS } from "../../../src/case-authoring/index.mjs";
import { mintExhausted } from "../../../src/record-core/index.mjs";

const DOC = "INFO-2026-0001-a", DOC2 = "INFO-2026-0002-b";
const Q = "INQ-2026-0001-q", Q2 = "INQ-2026-0002-q";
const ALICE = "member:alice";
const FRESH = { statement: "It does not cover the later amendments to the award.",
                subjectJustification: "The award is public, and the question is whether its terms were kept.",
                biasAcknowledgement: "We still read the minutes as the account of the meeting, as of this edition.",
                excluded: [{ description: "the amendments, which this edition names", reason: "not yet obtained" }] };

function setup(opts) {
  const w = world(opts);
  for (const m of ["alice", "bo"]) w.member(m);
  w.doc(DOC); w.doc(DOC2);
  w.finding(Q, [{ target: DOC }]);
  w.finding(Q2, [{ target: DOC2 }]);
  const A = w.project("A", "alice", [Q, Q2]);
  return { w, A };
}
const minted = (w) => w.count("minted_ids");
const rowOf = (key) => CASE_DERIVATION_CHECKS[key];
const carries = (r, key) => assert.deepEqual([r.ok, r.reason, r.code, r.check, r.translation],
  [false, key, key, rowOf(key).check, rowOf(key).translation]);

test("R7: caseId with newCase is CASE_IDENTITY_AMBIGUOUS (C-44.1), and so is naming neither when the members serve more than one published case, naming them; nothing is drawn", () => {
  const { w, A } = setup();
  const x = w.publish(A, "alice", [Q]); w.ratify(x);
  const both = w.publish(A, "alice", [Q2], { caseId: x.caseId, newCase: true });
  carries(both, "CASE_IDENTITY_AMBIGUOUS");
  assert.deepEqual(both.cases, [x.caseId]);
  /* Q now serves a second case too (a new case over the same finding, then signed) */
  const y = w.publish(A, "alice", [Q, Q2], { newCase: true, ...FRESH }); w.ratify(y);
  const before = w.snapshot();
  const amb = w.publish(A, "alice", [Q]);
  carries(amb, "CASE_IDENTITY_AMBIGUOUS");
  assert.deepEqual(amb.cases, [x.caseId, y.caseId].sort());
  assert.deepEqual(amb.members, [{ target: Q, cases: [x.caseId, y.caseId].sort() }]);
  assert.deepEqual(w.snapshot(), before, "nothing written, no id drawn");
});

test("R7: a named case not published is NO_SUCH_CASE; otherwise the named case, else the one case the members serve, else the case this act's own unsigned preparation names, else a minted opaque CASE id (newCase skips the derivation); MINT_EXHAUSTED when none is free; a case never changes project", () => {
  const { w, A } = setup();
  const before = w.snapshot();
  const none = w.publish(A, "alice", [Q], { caseId: "CASE-2026-0001" });
  assert.deepEqual([none.reason, none.caseId], ["NO_SUCH_CASE", "CASE-2026-0001"]);
  assert.deepEqual(w.snapshot(), before);
  /* minted: opaque, never a counter */
  const x = w.publish(A, "alice", [Q]);
  assert.deepEqual([x.ok, x.minted, x.edition], [true, true, 1]);
  assert.match(x.caseId, /^CASE-2026-\d{4}$/);
  w.ratify(x);
  /* derived: the one case the members serve */
  w.finding(Q, [{ target: DOC }, { target: DOC2 }]);
  const derived = w.publish(A, "alice", [Q], FRESH);
  assert.deepEqual([derived.ok, derived.caseId, derived.minted, derived.edition], [true, x.caseId, false, 2]);
  /* named: the named case's next edition */
  const w2 = setup();
  const x2 = w2.w.publish(w2.A, "alice", [Q]); w2.w.ratify(x2);
  const named = w2.w.publish(w2.A, "alice", [Q2], { caseId: x2.caseId, ...FRESH });
  assert.deepEqual([named.ok, named.caseId, named.edition, named.minted], [true, x2.caseId, 2, false]);
  /* newCase skips the derivation even over a finding that serves a case */
  const fresh = w2.w.publish(w2.A, "alice", [Q], { newCase: true, ...FRESH });
  assert.deepEqual([fresh.ok, fresh.minted, fresh.edition], [true, true, 1]);
  assert.notEqual(fresh.caseId, x2.caseId);
});

test("R7: the case this act's own unsigned preparation names is found again, so preparing again lands on the same case; and it is that case's project that owns it", () => {
  const w = world();
  for (const m of ["alice", "bo"]) w.member(m);
  w.doc(DOC);
  w.finding(Q, [{ target: DOC }], { state: "open", lines: readingLines("first", [DOC]) });
  const A = w.project("A", "alice", [Q], { extra: currentLines(Q) });
  const B = w.project("B", "bo", [Q], { extra: currentLines(Q) });
  const concl = (P, who) => w.basisVersions.conclude({ target: Q, project: P, falsifier: "a later amendment",
    author: who, viewer: V(who), identity: `member:${who}` });
  w.clock.now = "2026-09-28T01:00:00Z"; assert.equal(concl(A, "alice").ok, true);
  const x = w.publish(A, "alice", [Q]);
  assert.equal(x.ok, true, JSON.stringify(x).slice(0, 300));
  /* A's conclusion moves (withdrawn and taken again later): a new preparation is warranted, and it is the same case */
  w.clock.now = "2026-09-28T01:05:00Z";
  assert.equal(w.basisVersions.withdrawConclusion({ target: Q, project: A, reason: "restated", who: ALICE,
                                                    viewer: V("alice"), identity: ALICE }).ok, true);
  w.clock.now = "2026-09-28T01:10:00Z"; assert.equal(concl(A, "alice").ok, true);
  const again = w.publish(A, "alice", [Q]);
  assert.deepEqual([again.ok, again.caseId, again.edition, again.minted], [true, x.caseId, 1, false]);
  assert.equal(w.count("case_documents"), 1, "the one unsigned preparation, re-authored");
  /* B concludes Q for itself and derives the same preparation: it is A's, and a case does not change hands */
  w.clock.now = "2026-09-28T01:15:00Z"; assert.equal(concl(B, "bo").ok, true);
  const before = w.snapshot();
  const other = w.publish(B, "bo", [Q]);
  assert.deepEqual([other.reason, other.caseId, other.project, other.owner, other.ratified],
    ["CASE_BELONGS_TO_ANOTHER_PROJECT", x.caseId, B, A, false]);
  assert.deepEqual(w.snapshot(), before, "nothing written, the drawn id not spent");
  /* once signed, the ratified owner answers */
  w.ratify(again);
  const named = w.publish(B, "bo", [Q], { caseId: x.caseId });
  assert.deepEqual([named.reason, named.owner, named.ratified], ["CASE_BELONGS_TO_ANOTHER_PROJECT", A, true]);
  assert.equal(w.publish(B, "bo", [Q], { newCase: true }).ok, true, "B's own new case over the same finding");
});

test("R7: MINT_EXHAUSTED when the minter finds no free id answers through record-core.mintExhausted (its R62, C-59.6) for a case id, whole, and nothing is published or written", () => {
  const { w, A } = setup({ record: (r) => new Proxy(r, { get: (t, p) => (p === "mintOpaqueId" ? () => null
    : typeof t[p] === "function" ? t[p].bind(t) : t[p]) }) });
  const before = w.snapshot();
  const r = w.publish(A, "alice", [Q]);
  assert.deepEqual(r, mintExhausted("CASE"), "record-core's one answer, nothing added or reworded");
  assert.deepEqual([r.ok, r.reason, r.code, r.check, r.prefix], [false, "MINT_EXHAUSTED", "MINT_EXHAUSTED", "C-59.6", "CASE"]);
  assert.match(r.detail, /\bcase id\b/);
  assert.deepEqual(w.snapshot(), before, "no document, no case row, no id spent");
  assert.equal(w.count("case_documents"), 0);
  assert.deepEqual(w.publish(A, "alice", [Q], { newCase: true }), mintExhausted("CASE"), "newCase always mints");
});

test("R8 (K2540): ALREADY_A_CASE_MEMBER when an edition of this case, or an unsigned preparation of another case or of another edition of this one, pins a member's current bytes and already records the conclusion this act would record; a preparation of this same case edition is replaced by the new one; a finding may serve any number of cases", () => {
  const { w, A } = setup();
  const x = w.publish(A, "alice", [Q]);
  assert.equal(x.ok, true);
  const n = minted(w);
  /* (K2540) this case edition prepared again: the new preparation replaces the unsigned one, no id drawn */
  const again = w.publish(A, "alice", [Q, Q2]);
  assert.deepEqual([again.ok, again.caseId, again.edition, again.minted], [true, x.caseId, 1, false], JSON.stringify(again).slice(0, 300));
  assert.equal(minted(w), n, "no id is drawn");
  assert.deepEqual(w.rows(`SELECT case_id, edition FROM case_documents`).map((d) => [d.case_id, d.edition]), [[x.caseId, 1]],
                   "replaced, one document");
  assert.deepEqual(w.fm(w.row(`SELECT text FROM case_documents WHERE case_id=?`, x.caseId).text).case_findings, [Q, Q2]);
  /* negative control: an unsigned preparation of another case refuses: a new case over the same bytes */
  const other = w.publish(A, "alice", [Q], { newCase: true });
  assert.deepEqual([other.reason, other.target, other.project, other.relationship, other.recorded_by],
    ["ALREADY_A_CASE_MEMBER", Q, A, "no_project", [{ case_id: x.caseId, edition: 1, state: "prepared" }]]);
  assert.equal(minted(w), n, "asked before an id is drawn");
  const x2 = w.publish(A, "alice", [Q]);
  assert.equal(x2.ok, true);
  w.ratify(x2);
  const derived = w.publish(A, "alice", [Q], FRESH);
  assert.deepEqual([derived.reason, derived.recorded_by], ["ALREADY_A_CASE_MEMBER",
    [{ case_id: x.caseId, edition: 1, state: "ratified" }]]);
  /* another case over the same bytes: an edition of X says nothing about case Y */
  const y = w.publish(A, "alice", [Q], { newCase: true, ...FRESH });
  assert.deepEqual([y.ok, y.minted], [true, true]);
  /* the project's conclusion moved: a new edition of X is warranted, and the answer says why */
  const w2 = world();
  w2.member("alice"); w2.doc(DOC);
  w2.finding(Q, [{ target: DOC }], { state: "open", lines: readingLines("first", [DOC]) });
  const P = w2.project("A", "alice", [Q], { extra: currentLines(Q) });
  const concl = (f) => w2.basisVersions.conclude({ target: Q, project: P, falsifier: f, author: "alice",
                                                   viewer: V("alice"), identity: ALICE });
  assert.equal(concl("first falsifier").ok, true);
  const e1 = w2.publish(P, "alice", [Q]); w2.ratify(e1);
  w2.clock.now = "2026-09-28T03:00:00Z";
  assert.equal(concl("a second falsifier").ok, true);
  const e2 = w2.publish(P, "alice", [Q], FRESH);
  assert.deepEqual([e2.ok, e2.caseId, e2.edition], [true, e1.caseId, 2]);
  assert.deepEqual(e2.findings[0].edition_warranted.because, "the_publishing_projects_conclusion_moved");
  assert.deepEqual(e2.findings[0].edition_warranted.pinned_editions.map((e) => [e.case_id, e.edition]), [[e1.caseId, 1]]);
});

test("R9: draft= binds the draft's readings to this case, refused before any id is drawn when it is not a draft of this project the caller can read (C-44.3; with no review provider every draft= is C-44.3), stands at another case identity (C-44.4), or was already named for another case edition (C-44.5)", () => {
  const { w, A } = setup();
  const B = w.project("B", "bo", [Q]);
  w.draft("DRAFT-2026-0001", A, { statement: "x" });
  w.draft("DRAFT-2026-0002", B, { statement: "x" }, { by: "bo" });
  const n = minted(w);
  carries(w.publish(A, "alice", [Q], { draft: "DRAFT-2026-0099" }), "PUBLISH_DRAFT_NOT_FOUND");
  const other = w.publish(A, "alice", [Q], { draft: "DRAFT-2026-0002" });
  carries(other, "PUBLISH_DRAFT_NOT_FOUND");
  assert.deepEqual([other.draft, other.project], ["DRAFT-2026-0002", A]);
  /* a draft naming no case is a new case's: a further edition of an existing case is not it */
  const x = w.publish(A, "alice", [Q2]); w.ratify(x);
  const notThis = w.publish(A, "alice", [Q], { caseId: x.caseId, draft: "DRAFT-2026-0001" });
  carries(notThis, "PUBLISH_DRAFT_NOT_THIS_CASE");
  assert.deepEqual([notThis.draft_case, notThis.draft_edition, notThis.case_id, notThis.edition], [null, 1, x.caseId, 2]);
  /* a draft naming case X stands at X's next edition: a new case is not it */
  w.draft("DRAFT-2026-0003", A, { statement: "x" }, { caseId: x.caseId });
  const notNew = w.publish(A, "alice", [Q], { newCase: true, draft: "DRAFT-2026-0003" });
  carries(notNew, "PUBLISH_DRAFT_NOT_THIS_CASE");
  assert.deepEqual([notNew.draft_case, notNew.draft_edition, notNew.case_id, notNew.edition], [x.caseId, 2, null, 1]);
  assert.equal(minted(w), n + 1, "only the one act that published drew an id");
  /* bound: the link is recorded as an act, with its author and time */
  const bound = w.publish(A, "alice", [Q], { draft: "DRAFT-2026-0001" });
  assert.equal(bound.ok, true, JSON.stringify(bound).slice(0, 300));
  assert.deepEqual(bound.completeness.draft, { draft_id: "DRAFT-2026-0001", named_by: "alice", named_at: w.clock.now,
                                               acknowledgements_bound: 0 });
  const row = w.row(`SELECT draft_id, text FROM case_documents WHERE case_id=?`, bound.caseId);
  const c = w.fm(row.text).completeness;
  assert.deepEqual([row.draft_id, c.draft, c.draft_named_by, c.draft_named_at], ["DRAFT-2026-0001", "DRAFT-2026-0001", "alice", w.clock.now]);
  /* one draft, one case edition it produced */
  w.ratify(bound);
  const again = w.publish(A, "alice", [Q2], { newCase: true, draft: "DRAFT-2026-0001", ...FRESH });
  carries(again, "PUBLISH_DRAFT_ALREADY_BOUND");
  assert.deepEqual(again.bound_to, { case_id: bound.caseId, edition: 1 });
  /* no review provider: no draft door, so every draft= is C-44.3 */
  const bare = setup({ provider: false });
  bare.w.draft("DRAFT-2026-0001", bare.A, { statement: "x" });
  carries(bare.w.publish(bare.A, "alice", [Q], { draft: "DRAFT-2026-0001" }), "PUBLISH_DRAFT_NOT_FOUND");
  assert.equal(bare.w.publish(bare.A, "alice", [Q]).ok, true, "without draft= nothing changes");
});

test("R10: the statement, subject justification, exclusion list or bias acknowledgement byte-identical to the previous ratified edition of this case is COMPLETENESS_CARRIED_FORWARD (the acknowledgement BIAS_ACKNOWLEDGEMENT_CARRIED_FORWARD), naming the field (C-21.1); the scope is not compared", () => {
  const { w, A } = setup();
  const x = w.publish(A, "alice", [Q], { excluded: [{ description: "the side letter", reason: "not in hand" }] });
  w.ratify(x);
  const before = w.snapshot();
  const next = { caseId: x.caseId, excluded: [{ description: "the side letter, now requested", reason: "not in hand" }] };
  const cases = [
    [{ ...FRESH, statement: x.completeness.statement }, "COMPLETENESS_CARRIED_FORWARD", "statement"],
    [{ ...FRESH, subjectJustification: x.completeness.subject_justification }, "COMPLETENESS_CARRIED_FORWARD", "subject_justification"],
    [{ ...FRESH, excluded: [{ description: "the side letter", reason: "not in hand" }] }, "COMPLETENESS_CARRIED_FORWARD", "excluded"],
    [{ ...FRESH, excluded: [], statement: FRESH.statement }, null, null],
    [{ ...FRESH, biasAcknowledgement: x.bias_acknowledgement }, "BIAS_ACKNOWLEDGEMENT_CARRIED_FORWARD", "bias_acknowledgement"],
  ];
  for (const [over, reason, field] of cases) {
    /* the negative control: an exclusion list that differs (here emptied) is no carried-forward claim; asked of the
       pre-flight, which runs op=publish and writes nothing */
    if (!reason) {
      const pre = w.ca.publishPreflight({ ...AUTHORED, whatChanged: WHAT_CHANGED, project: A, targets: [Q2],
        roles: { [Q2]: "load_bearing" }, viewer: V("alice"), author: "alice", ...next, ...over });
      assert.equal(/CARRIED_FORWARD$/.test(String(pre.first && pre.first.reason)), false, JSON.stringify(pre.first).slice(0, 200));
      continue;
    }
    const r = w.publish(A, "alice", [Q2], { ...next, ...over });
    assert.deepEqual([r.ok, r.reason, r.field, r.check, r.caseId, r.edition, r.prior], [false, reason, field, "C-21.1", x.caseId, 2, 1], field);
  }
  assert.deepEqual(w.snapshot(), before);
  const ok = w.publish(A, "alice", [Q2], { ...FRESH, caseId: x.caseId, scope: x.scope });
  assert.deepEqual([ok.ok, ok.edition, ok.scope], [true, 2, x.scope], "the same scope is not a carried-forward claim");
});

test("R91 (T53; JOURNEYS R-100): a refusal for an unchanged statement, subject justification, exclusion list or bias acknowledgement names which one in the answer's field; with the other three changed and the bias acknowledgement left, the field is the bias acknowledgement, and the subject position is never named", () => {
  const { w, A } = setup();
  const x = w.publish(A, "alice", [Q], { excluded: [{ description: "the side letter", reason: "not in hand" }] });
  w.ratify(x);
  const r = w.publish(A, "alice", [Q2], { ...FRESH, caseId: x.caseId, biasAcknowledgement: x.bias_acknowledgement });
  assert.deepEqual([r.ok, r.reason, r.field], [false, "BIAS_ACKNOWLEDGEMENT_CARRIED_FORWARD", "bias_acknowledgement"]);
  /* control: the subject position, the same as edition 1's, with all four fresh, is no carried-forward claim and is named nowhere */
  const ok = w.publish(A, "alice", [Q2], { ...FRESH, caseId: x.caseId });
  assert.deepEqual([ok.ok, ok.edition], [true, 2], JSON.stringify(ok).slice(0, 200));
});
