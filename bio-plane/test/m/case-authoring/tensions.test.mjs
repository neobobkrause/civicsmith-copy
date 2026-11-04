/* case-authoring: disclosing a contradiction (R55 (case-disclosures R1)), the ceremony's read before the act (R32), sight at the act (R33),
   and the rows of "a case's disclosures", C-120.1–C-120.3 (R29: `case-disclosures`' own, re-exported), over the real `contradiction` module: every candidate
   here is laid down through its own doors (the pairing forms a pair, a run proposes it, a member acts on it). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V, AUTHORED, sha } from "./fixture.mjs";
import { CASE_DOCUMENT_FORMAT, caseTensionsOf } from "../../../src/publication/index.mjs";
import * as DISCLOSURES from "../../../src/case-disclosures/index.mjs";
import { caseAuthoringOps, CASE_DISCLOSURE_CHECKS, TENSION_TEMPLATES, HIGHLIGHT_SENTENCE,
         CEREMONY_HIGHLIGHT_SENTENCE, NOT_SHOWN_WORDS, TENSIONS_DEPTH_STATED } from "../../../src/case-authoring/index.mjs";
import { word, localize } from "../../../src/setup-words/index.mjs";

const DOC = "INFO-2026-0001-a", DOC2 = "INFO-2026-0002-b", F = "INQ-2026-0001-q", G = "INQ-2026-0002-g";
const RUN = "RUN-2026-0001", ADMIN = "class:admin";
const CA = sha("passage a"), CB = sha("passage b"), CH = sha("the hidden passage");

function content(w, id, capture, bundle, ref = `the page of ${bundle}`) {
  w.st.sql.exec(`INSERT INTO content (content_id, capture_sha, bundle_id, extent_kind, extent, ref, minted_by, at, stale)
                 VALUES (?, ?, ?, 'pdf-page', '{}', ?, 'plane', '2026-01-01', 0)`, id, capture, bundle, ref);
}
/* A K1 candidate (one inquiry, opposite roles) proposed by a run with `label`, answering its id. */
function propose(w, match, label = "record") {
  const p = w.contradiction.pairs({ key: "K1", viewer: ADMIN }).pairs.find(match);
  if (!p) throw new Error("no K1 pair formed");
  const r = w.contradiction.propose({ run: RUN, proposedBy: "class:ai/t", viewer: ADMIN, caller: "member:alice",
                                      proposals: [{ key: "K1", a: p.a, b: p.b, label, reason: "the machine's reason" }] });
  if (!r.ok) throw new Error(`propose refused: ${JSON.stringify(r).slice(0, 300)}`);
  return r.candidates[0].candidate;
}

/* F rests on two passages, one supporting and one cutting against it: a K1 duty on what F rests on, one level deep. */
function seen(opts) {
  const w = world(opts);
  for (const m of ["alice", "bo"]) w.member(m);
  content(w, CA, w.doc(DOC), DOC); content(w, CB, w.doc(DOC2), DOC2);
  w.finding(F, [{ target: DOC, content_id: CA }, { target: DOC2, role: "cuts_against", content_id: CB }]);
  const P = w.project("Team", "alice", [F]);
  w.runs.set(RUN, { status: "running", principal: "member:alice" });
  return { w, P, id: propose(w, (p) => p.inquiry === F) };
}
/* F rests on passage a; G sets passage a against a passage filed in bo's project H, which alice may not see. */
function hidden(opts) {
  const w = world(opts);
  for (const m of ["alice", "bo"]) w.member(m);
  content(w, CA, w.doc(DOC), DOC);
  w.finding(F, [{ target: DOC, content_id: CA }]);
  w.finding(G, [{ target: DOC, content_id: CA }]);
  const H = w.project("Hidden", "bo", [G]);
  content(w, CH, sha("the hidden capture"), H, "the hidden minutes, page 4");
  w.st.sql.exec(`INSERT INTO inquiry_basis (bundle_id, ord, target_id, target_type, role, note, content_id)
                 VALUES (?, 1, ?, 'information', 'cuts_against', NULL, ?)`, G, DOC, CH);
  const P = w.project("Team", "alice", [F, G]);
  w.runs.set(RUN, { status: "running", principal: "member:alice" });
  const id = propose(w, (p) => p.a.content_id === CH || p.b.content_id === CH);
  return { w, P, H, id };
}
const disclose = (id, words) => [{ candidate: id, ...(words === undefined ? {} : { words }) }];
const docOf = (w, r) => w.row(`SELECT * FROM case_documents WHERE case_id=? AND edition=?`, r.caseId, r.edition);
function refused(r, code) {
  assert.equal(r.ok, false, JSON.stringify(r).slice(0, 400));
  assert.deepEqual([r.reason, r.code, r.check, r.translation],
    [code, code, CASE_DISCLOSURE_CHECKS[code].check, CASE_DISCLOSURE_CHECKS[code].translation]);
}

test("R29 (N529): C-120.1–C-120.3, a case's disclosures, are case-disclosures' own rows (its R22), re-exported here as that one table, never a copy, with the translations of the requirements, each naming its raising method there; publishCase's refusals carry them", () => {
  assert.equal(CASE_DISCLOSURE_CHECKS, DISCLOSURES.CASE_DISCLOSURE_CHECKS, "the one table, re-exported");
  assert.deepEqual(Object.entries(CASE_DISCLOSURE_CHECKS).slice(0, 3).map(([k, v]) => [k, v.check]),
    [["TENSION_NOT_DISCLOSED", "C-120.1"], ["DISCLOSURE_NOT_STANDING", "C-120.2"], ["TENSIONS_UNDETERMINED", "C-120.3"]]);
  assert.deepEqual(Object.values(CASE_DISCLOSURE_CHECKS).slice(0, 3).map((v) => v.translation), [
    word("refusal.TENSION_NOT_DISCLOSED"),
    word("refusal.DISCLOSURE_NOT_STANDING"),
    word("refusal.TENSIONS_UNDETERMINED")]);
  for (const row of Object.values(CASE_DISCLOSURE_CHECKS))
    assert.match(row.where, /^src\/case-disclosures\/index\.mjs \S+ > [a-z-]+$/);
  assert.deepEqual(Object.values(CASE_DISCLOSURE_CHECKS).slice(0, 3).map((v) => v.where), [
    "src/case-disclosures/index.mjs tensionsJudged > is-tension-disclosed",
    "src/case-disclosures/index.mjs tensionsJudged > is-disclosure-standing",
    "src/case-disclosures/index.mjs tensionsUndetermined > is-tensions-determined"]);
});

test("R55 (case-disclosures R1) (C-120.1): an undisclosed tension is refused, naming each, before any id is drawn and with nothing written; disclosed, the case publishes — disclose, never block (DEC-76 item 4)", () => {
  const { w, P, id } = seen();
  const before = w.snapshot();
  const r = w.publish(P, "alice", [F]);
  refused(r, "TENSION_NOT_DISCLOSED");
  assert.deepEqual(r.undisclosed.map((u) => [u.candidate, u.finding, u.state]), [[id, F, "open"]]);
  assert.ok(r.undisclosed[0].a && r.undisclosed[0].b, "a conflict the owner sees whole is named with both sides");
  assert.deepEqual(w.snapshot(), before, "no id drawn, nothing written");
  /* an empty list discloses nothing; a list naming it publishes */
  refused(w.publish(P, "alice", [F], { tensionsDisclosed: [] }), "TENSION_NOT_DISCLOSED");
  const ok = w.publish(P, "alice", [F], { tensionsDisclosed: disclose(id) });
  assert.equal(ok.ok, true, JSON.stringify(ok).slice(0, 400));
  assert.deepEqual(ok.tensions.map((t) => [t.candidate, t.finding, t.state]), [[id, F, "open"]]);
  /* negative control: a case with no tension on it needs no list */
  const n = world(); n.member("alice"); n.doc(DOC); n.finding(F, [{ target: DOC }]);
  assert.equal(n.publish(n.project("Team", "alice", [F]), "alice", [F]).ok, true);
});

test("R55 (case-disclosures R1), R14: the tension section lists each one — the finding, both sides verbatim with source, date and doctype, its state, the explanation, the owner's words, acknowledged_by (the author stamp) and the instant, and the one-level sentence — and each member's block gains its template's sentence; nothing composes a strength (R24)", () => {
  const { w, P, id } = seen();
  /* explained, not yet shown: a member's differs without evidence (contradiction R32) */
  const ex = w.contradiction.clarify({ candidate: id, choice: "differs", coordinates: ["scope"],
    explanation: "the two pages speak of different years", viewer: V("alice"), author: V("alice") });
  assert.equal(ex.ok, true, JSON.stringify(ex).slice(0, 300));
  const r = w.publish(P, "alice", [F], { tensionsDisclosed: disclose(id, "we read the later page as the award") });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 400));
  const text = docOf(w, r).text, fm = w.fm(text);
  assert.deepEqual([fm.tensions_disclosed, fm.tensions_highlighted, fm.tensions_depth_stated], [1, 0, TENSIONS_DEPTH_STATED]);
  const t = fm.case_tensions[0];
  assert.deepEqual([t.candidate, t.finding, t.state, t.kind, t.unseen_other_side, t.depth, t.acknowledged_by, t.acknowledged_at,
                    t.words, t.explanation],
    [id, F, "explained_not_shown", null, false, 1, "alice", w.clock.now, "we read the later page as the award",
     "the two pages speak of different years"]);
  assert.deepEqual([t.a_kind, t.a_text, t.a_source, t.b_kind, t.b_text, t.b_source],
    ["leg", `the page of ${DOC}`, DOC, "leg", `the page of ${DOC2}`, DOC2]);
  assert.ok("a_date" in t && "a_doctype" in t && "a_capture" in t && "b_date" in t, "date, doctype and capture stated");
  assert.equal(t.a_capture, w.row(`SELECT capture_sha FROM content WHERE content_id=?`, CA).capture_sha);
  const s = fm.case_tension_sentences;
  assert.deepEqual(s.map((x) => [x.target, x.candidate, x.template]), [[F, id, "explained"]]);
  assert.ok(s[0].sentence.startsWith(TENSION_TEMPLATES.explained), s[0].sentence);
  assert.match(s[0].sentence, /Disclosed by alice/);
  /* the body: the section, the owner's words marked as the owner's, the member block's sentence */
  const body = text.slice(text.indexOf("\n---\n", 4) + 5);
  assert.ok(body.includes(localize("case-disclosures.document.tensions_disclosed_heading", "## Tensions Disclosed")));
  assert.ok(body.includes("In the owner's words: we read the later page as the award"));
  assert.ok(body.includes("The explanation recorded: the two pages speak of different years"));
  assert.ok(body.includes(`Acknowledged by alice on ${w.clock.now}`));
  assert.ok(body.includes(TENSIONS_DEPTH_STATED));
  const block = body.slice(body.indexOf("## Findings In This Case"), body.indexOf("## The Conclusions"));
  assert.ok(block.includes(`   - ${TENSION_TEMPLATES.explained}`), "the sentence sits in its member's block");
  assert.equal(JSON.stringify(r.tensions).includes("strength"), false);
  assert.equal("strength" in r, false);
  /* open, the in-tension template */
  const o = seen();
  const ro = o.w.publish(o.P, "alice", [F], { tensionsDisclosed: disclose(o.id) });
  const so = o.w.fm(docOf(o.w, ro).text).case_tension_sentences[0];
  assert.deepEqual([so.template, so.sentence.startsWith(TENSION_TEMPLATES.in_tension)], ["in_tension", true]);
  assert.equal(o.w.fm(docOf(o.w, ro).text).case_tensions[0].words, null, "no words given: null, never filled");
});

test("R55 (case-disclosures R1): an irreconcilable conclusion must be disclosed, and its member's block holds it irreconcilable; a taken-up one is in tension", () => {
  const { w, P, id } = seen();
  const up = w.contradiction.takeUp({ candidate: id, question: "Which page governs?", frame: "a", viewer: V("alice"), author: V("alice") });
  assert.equal(up.ok, true, JSON.stringify(up).slice(0, 300));
  refused(w.publish(P, "alice", [F]), "TENSION_NOT_DISCLOSED");
  const t = w.publish(P, "alice", [F], { tensionsDisclosed: disclose(id) });
  assert.equal(t.ok, true, JSON.stringify(t).slice(0, 300));
  const tf = w.fm(docOf(w, t).text);
  assert.deepEqual([tf.case_tensions[0].state, tf.case_tension_sentences[0].template], ["taken_up", "in_tension"]);
  /* resolved irreconcilable (contradiction R29 still answers it): as contradiction answers it, through its interface */
  const side = (ref, bundle) => ({ kind: "leg", ref, source: { bundle, ref }, capture_sha: null, date: null, doctype: null });
  const irr = { candidate: id, key: "K1", a: side("page 1", DOC), b: side("page 2", DOC2), state: "resolved",
                kind: "irreconcilable", explanation: null, inquiry: up.inquiry, depth: 1 };
  const x = world({ deps: { contradiction: { unresolvedRecordOn: () => ({ ok: true, candidates: [irr], truncated: false }) } } });
  x.member("alice"); x.doc(DOC); x.finding(F, [{ target: DOC }]);
  const XP = x.project("Team", "alice", [F]);
  refused(x.publish(XP, "alice", [F]), "TENSION_NOT_DISCLOSED");
  const r = x.publish(XP, "alice", [F], { tensionsDisclosed: disclose(id) });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  const fm = x.fm(docOf(x, r).text);
  assert.deepEqual([fm.case_tensions[0].state, fm.case_tensions[0].kind, fm.case_tension_sentences[0].template],
    ["resolved", "irreconcilable", "irreconcilable"]);
  assert.ok(fm.case_tension_sentences[0].sentence.startsWith(TENSION_TEMPLATES.irreconcilable));
});

test("R55 (case-disclosures R1) (C-120.2): a listed candidate the read does not answer — one resolved since, or one nothing holds — is DISCLOSURE_NOT_STANDING, and nothing is written", () => {
  const { w, P, id } = seen();
  const other = sha("no such candidate");
  const before = w.snapshot();
  const r = w.publish(P, "alice", [F], { tensionsDisclosed: [...disclose(id), { candidate: other }] });
  refused(r, "DISCLOSURE_NOT_STANDING");
  assert.deepEqual(r.not_standing.map((x) => x.candidate), [other]);
  assert.deepEqual(w.snapshot(), before);
  /* resolved corrected: no longer standing, so listing it is refused and not listing it publishes */
  assert.equal(w.contradiction.clarify({ candidate: id, choice: "one_wrong", wrongSide: "b", reason: "a misread page",
                                         viewer: V("alice"), author: V("alice") }).ok, true);
  refused(w.publish(P, "alice", [F], { tensionsDisclosed: disclose(id) }), "DISCLOSURE_NOT_STANDING");
  const ok = w.publish(P, "alice", [F]);
  assert.equal(ok.ok, true, JSON.stringify(ok).slice(0, 300));
  assert.deepEqual(ok.tensions, []);
});

test("R55 (case-disclosures R1) (C-120.3): a read that fails or is truncated is TENSIONS_UNDETERMINED — what cannot be read cannot be disclosed — and nothing is written; a whole read publishes", () => {
  for (const [answer, why] of [[{ ok: true, candidates: [], undetermined: true, why: word("case-disclosures.why.read_failed") }, /the read failed/],
                               [{ ok: true, candidates: [], truncated: true, bound: 200 }, /more than 200/],
                               [null, /no answer/], ["throws", /boom/]]) {
    const calls = [];
    const stub = { unresolvedRecordOn(a) { calls.push(a); if (answer === "throws") throw new Error("boom"); return answer; } };
    const w = world({ deps: { contradiction: stub } });
    w.member("alice"); w.doc(DOC); w.finding(F, [{ target: DOC }]);
    const P = w.project("Team", "alice", [F]);
    const before = w.snapshot();
    const r = w.publish(P, "alice", [F]);
    refused(r, "TENSIONS_UNDETERMINED");
    assert.match(r.undetermined[0].why, why);
    assert.deepEqual(w.snapshot(), before);
    assert.deepEqual(calls[0], { finding: F, sha: w.head(F), viewer: V("alice") }, "each member at the bytes this act pins, as the viewer");
    refused(w.ca.tensionsToDisclose({ project: P, targets: [F], viewer: V("alice"), author: "alice" }), "TENSIONS_UNDETERMINED");
  }
  const w = world({ deps: { contradiction: { unresolvedRecordOn: () => ({ ok: true, candidates: [], truncated: false }) } } });
  w.member("alice"); w.doc(DOC); w.finding(F, [{ target: DOC }]);
  assert.equal(w.publish(w.project("Team", "alice", [F]), "alice", [F]).ok, true, "negative control");
});

test("R55 (case-disclosures R1), R26: a leg the read could name no referent for is stated in the document, never read as no conflict", () => {
  const w = world({ deps: { contradiction: { unresolvedRecordOn: () => ({ ok: true, candidates: [], truncated: false,
                                                                          undetermined_legs: 1 }) } } });
  w.member("alice"); w.doc(DOC); w.finding(F, [{ target: DOC }]);
  const r = w.publish(w.project("Team", "alice", [F]), "alice", [F]);
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  assert.deepEqual(r.tensions_legs_unread, [{ finding: F, legs: 1 }]);
  const text = docOf(w, r).text;
  assert.deepEqual(w.fm(text).case_tensions_unread.map((u) => [u.target, u.legs]), [[F, 1]]);
  assert.match(text, /1 leg\(s\) of INQ-2026-0001-q name no passage the record holds/);
});

test("R55 (case-disclosures R1), R33 (DEC-85): a tension with a side the owner may not see is named in C-120.1 by its candidate and finding only; disclosed, it publishes highlighted, and neither the document's bytes nor the answer hold anything of that side", () => {
  const { w, P, H, id } = hidden();
  /* the explanation a member who sees both sides recorded quotes the hidden side */
  assert.equal(w.contradiction.clarify({ candidate: id, choice: "differs", coordinates: ["scope"],
    explanation: "the hidden minutes say otherwise", viewer: V("bo"), author: V("bo") }).ok, true);
  const r = w.publish(P, "alice", [F]);
  refused(r, "TENSION_NOT_DISCLOSED");
  assert.deepEqual(r.undisclosed, [{ candidate: id, finding: F, unseen_other_side: true, says: NOT_SHOWN_WORDS }]);
  const ok = w.publish(P, "alice", [F], { tensionsDisclosed: disclose(id, "we rest on the page we hold") });
  assert.equal(ok.ok, true, JSON.stringify(ok).slice(0, 400));
  const text = docOf(w, ok).text, fm = w.fm(text);
  const t = fm.case_tensions[0];
  assert.deepEqual([t.candidate, t.finding, t.unseen_other_side, t.state, t.acknowledged_by, t.words, t.highlight, fm.tensions_highlighted],
    [id, F, true, "explained_not_shown", "alice", "we rest on the page we hold", HIGHLIGHT_SENTENCE, 1]);
  assert.deepEqual([t.side_text, t.side_source], [`the page of ${DOC}`, DOC], "the seen side");
  for (const k of Object.keys(t)) assert.ok(!/^(a|b)_|^explanation$/.test(k), `no field ${k} for the unseen side`);
  const s = fm.case_tension_sentences[0];
  assert.deepEqual([s.template, s.sentence.startsWith(TENSION_TEMPLATES.unseen)], ["unseen", true],
    "the last template, and not the state's own");
  assert.equal(ok.tensions_highlighted, 1);
  for (const said of [text, JSON.stringify(ok)])
    for (const leak of [CH, sha("the hidden capture"), "hidden minutes", "page 4", H, "Hidden", "member:bo", "say otherwise"])
      assert.equal(said.includes(leak), false, `names ${leak}`);
});

test("R33 (DEC-85): a publisher whose project was revealed to the hidden party (contradiction R52) still publishes that side as not shown", () => {
  const { w, P, H, id } = hidden();
  assert.equal(w.contradiction.optIn({ candidate: id, project: P, viewer: V("alice"), author: "alice" }).ok, true);
  const rev = w.contradiction.optIn({ candidate: id, project: H, viewer: V("bo"), author: "bo" });
  assert.equal(rev.revealed, true, JSON.stringify(rev).slice(0, 300));
  const ok = w.publish(P, "alice", [F], { tensionsDisclosed: disclose(id) });
  assert.equal(ok.ok, true, JSON.stringify(ok).slice(0, 300));
  const text = docOf(w, ok).text;
  assert.equal(w.fm(text).case_tensions[0].unseen_other_side, true);
  for (const leak of [CH, "hidden minutes", H, "Hidden"]) assert.equal(text.includes(leak), false, `names ${leak}`);
});

test("R32: tensionsToDisclose answers the candidates R55 (case-disclosures R1) then requires, read as R55 (case-disclosures R1) reads them, with the ceremony's sentence for a highlighted one and the count; it writes nothing and never throws", () => {
  const { w, P, H, id } = hidden();
  const before = w.snapshot();
  const r = w.ca.tensionsToDisclose({ project: P, targets: [F, F], viewer: V("alice"), author: "alice" });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  assert.deepEqual(w.snapshot(), before, "writes nothing");
  assert.deepEqual([r.wrote, r.count, r.highlighted], [false, 1, 1]);
  assert.deepEqual(r.candidates.map((c) => [c.candidate, c.finding, c.highlighted, c.sentence]),
    [[id, F, true, CEREMONY_HIGHLIGHT_SENTENCE]]);
  assert.match(r.says, /never blocked by a conflict/);
  /* exactly what R55 (case-disclosures R1) then requires: publishing without them names the same, and with them publishes */
  const refusedNow = w.publish(P, "alice", [F]);
  assert.deepEqual(refusedNow.undisclosed.map((u) => u.candidate), r.candidates.map((c) => c.candidate));
  assert.equal(w.publish(P, "alice", [F], { tensionsDisclosed: r.candidates.map((c) => ({ candidate: c.candidate })) }).ok, true);
  const bytes = JSON.stringify(r);
  for (const leak of [CH, "hidden minutes", H, "Hidden"]) assert.equal(bytes.includes(leak), false, leak);
  /* a seen one carries both sides and no ceremony sentence */
  const s = seen();
  const rs = s.w.ca.tensionsToDisclose({ project: s.P, target: F, viewer: V("alice"), author: "alice" });
  assert.deepEqual([rs.count, rs.highlighted, rs.candidates[0].highlighted, !!rs.candidates[0].a], [1, 0, undefined, true]);
  /* no targets: nothing to disclose */
  assert.deepEqual(w.ca.tensionsToDisclose({ project: P, targets: [], viewer: V("alice"), author: "alice" }).candidates, []);
});

test("R32: its refusals are R2's authority refusals and R4's per-member refusals, each in its order, then C-120.3 — each with a negative control", () => {
  const { w, P } = seen();
  w.join(P, "bo");
  const ask = (over) => w.ca.tensionsToDisclose({ project: P, targets: [F], viewer: V("alice"), author: "alice", ...over });
  assert.equal(ask({}).ok, true, "negative control");
  assert.equal(ask({ project: null }).reason, "NO_PUBLISHING_PROJECT");
  assert.equal(ask({ project: "PROJ-2026-0000-none" }).reason, "NO_SUCH_PROJECT");
  assert.equal(ask({ project: F }).reason, "NOT_A_PROJECT");
  assert.equal(ask({ author: "bo", viewer: V("bo") }).reason, "NOT_THE_PROJECT_OWNER");
  assert.equal(ask({ targets: ["INQ-2026-0404-none"] }).reason, "NO_SUCH_BUNDLE");
  assert.equal(ask({ targets: [DOC] }).reason, "NOT_AN_INQUIRY");
  w.finding("INQ-2026-0003-open", [], { state: "open" });
  assert.equal(ask({ targets: ["INQ-2026-0003-open"] }).reason, "NOT_CONCLUDED");
  assert.equal(ask({ project: null, targets: ["INQ-2026-0404-none"] }).reason, "NO_PUBLISHING_PROJECT", "R2 before R4");
});

test("R32, R55 (case-disclosures R1): op=publishtensions takes its stamps from the query after the body, and op=publish carries tensionsDisclosed in its body", async () => {
  const { w, P, id } = seen();
  const q = (op, s) => new URL(`http://do/${op}?viewer=${encodeURIComponent(V("alice"))}&author=alice&${s}`);
  const read = caseAuthoringOps(w.ca, q("publishtensions", `project=${P}&targets=${F}`), { author: "bo", viewer: V("bo") })
    .publishtensions();
  assert.deepEqual([read.ok, read.candidates.map((c) => c.candidate)], [true, [id]]);
  const pub = await caseAuthoringOps(w.ca, q("publishcase", `project=${P}`),
    { ...AUTHORED, targets: [F], roles: { [F]: "load_bearing" }, tensionsDisclosed: disclose(id), author: "bo" }).publishcase();
  assert.equal(pub.ok, true, JSON.stringify(pub).slice(0, 300));
  assert.equal(pub.tensions[0].acknowledged_by, "alice", "the author stamp, never a body's");
});

test("R55 (case-disclosures R1): tensionsDisclosed absent or null is none; a candidate listed twice is disclosed once; any malformed shape — not a list, an entry naming no candidate, words outside the grammar — is R3's BAD_COMPLETENESS naming the field (K498)", () => {
  const { w, P, id } = seen();
  const twice = w.publish(P, "alice", [F], { tensionsDisclosed: [...disclose(id, "first"), ...disclose(id, "second")] });
  assert.equal(twice.ok, true, JSON.stringify(twice).slice(0, 300));
  assert.deepEqual(twice.tensions.map((t) => [t.candidate, t.words]), [[id, "first"]]);
  for (const words of ['a "quoted" word', "a back\\slash", "two\nlines", "x".repeat(2001)]) {
    const r = w.publish(P, "alice", [F], { tensionsDisclosed: disclose(id, words), newCase: true });
    assert.deepEqual([r.reason, r.field], ["BAD_COMPLETENESS", "tensionsDisclosed[0].words"]);
  }
  for (const [list, field] of [[{ candidate: id }, "tensionsDisclosed"], ["x", "tensionsDisclosed"],
                               [[id], "tensionsDisclosed[0]"], [[{}], "tensionsDisclosed[0]"],
                               [[...disclose(id), { candidate: 7 }], "tensionsDisclosed[1]"],
                               [[{ candidate: id, words: 5 }], "tensionsDisclosed[0].words"]]) {
    const r = w.publish(P, "alice", [F], { tensionsDisclosed: list, newCase: true });
    assert.deepEqual([r.reason, r.field], ["BAD_COMPLETENESS", field], JSON.stringify(list));
  }
  const a = seen();
  const apostrophe = a.w.publish(a.P, "alice", [F], { tensionsDisclosed: disclose(a.id, "the team's reading") });
  assert.equal(apostrophe.ok, true, "an apostrophe is legal inside the grammar's quoted string");
  assert.equal(a.w.fm(docOf(a.w, apostrophe).text).case_tensions[0].words, "the team's reading");
  const n = world(); n.member("alice"); n.doc(DOC); n.finding(F, [{ target: DOC }]);
  assert.equal(n.publish(n.project("Team", "alice", [F]), "alice", [F], { tensionsDisclosed: null }).ok, true);
});

test("R14: the document's format is bio-case-document/10 (case-grammar R35: what /9 states plus the ungraded and typed passages; /9 states what /8 does, identical in fields to /6, which states everything /5 states; DEC-124), and its tension section reads back through publication's caseTensionsOf (K498) — both sides of a seen one, the seen side only of a highlighted one, each member's sentences, the unread legs", () => {
  assert.equal(CASE_DOCUMENT_FORMAT, "bio-case-document/10");
  const { w, P, id } = seen();
  const r = w.publish(P, "alice", [F], { tensionsDisclosed: disclose(id, "we read the later page") });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  const text = docOf(w, r).text;
  assert.equal(w.fm(text).format, "bio-case-document/10");
  const back = caseTensionsOf(text);
  assert.equal(back.detail, null);
  assert.deepEqual([back.highlighted, back.depth, back.tensions.length], [0, TENSIONS_DEPTH_STATED, 1]);
  const t = back.tensions[0];
  assert.deepEqual([t.candidate, t.finding, t.unseen_other_side, t.owner_words.text, t.acknowledged_by, t.acknowledged_at],
    [id, F, false, "we read the later page", "alice", w.clock.now]);
  assert.deepEqual([t.sides.a.text, t.sides.a.source, t.sides.b.text, t.sides.b.source],
    [`the page of ${DOC}`, DOC, `the page of ${DOC2}`, DOC2]);
  assert.deepEqual(back.members[F].map((m) => [m.candidate, m.template, m.highlighted]), [[id, "in_tension", false]]);
  assert.equal(back.members[F][0].sentence, w.fm(text).case_tension_sentences[0].sentence);
  assert.deepEqual(back.unread, []);
  /* highlighted: the seen side and the fixed sentence, read the same way on both sides of the interface */
  const h = hidden();
  const hr = h.w.publish(h.P, "alice", [F], { tensionsDisclosed: disclose(h.id) });
  const hb = caseTensionsOf(docOf(h.w, hr).text);
  assert.deepEqual([hb.highlighted, hb.tensions[0].unseen_other_side, hb.tensions[0].sentence, hb.tensions[0].side.source],
    [1, true, HIGHLIGHT_SENTENCE, DOC]);
  assert.equal("sides" in hb.tensions[0], false);
  assert.deepEqual(hb.members[F].map((m) => [m.template, m.highlighted]), [["unseen", true]]);
  /* no tension: the section is present and empty */
  const n = world(); n.member("alice"); n.doc(DOC); n.finding(F, [{ target: DOC }]);
  const nr = n.publish(n.project("Team", "alice", [F]), "alice", [F]);
  assert.deepEqual(caseTensionsOf(docOf(n, nr).text).tensions, []);
});
