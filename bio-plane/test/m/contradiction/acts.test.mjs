/* contradiction R30–R38, R44, R46 (N345, RESOLVE): a member's attributed acts — dismiss, clarify, take up, resolve —
   the machine's one act (recommend), and the check registered at the record's one door, driven at the module's
   interface. Every refusal has a negative control, in order. */
import test from "node:test";
import assert from "node:assert/strict";
import { MACHINE, sha } from "./fixture.mjs";
import { seeded, cand, recommend, refusedWith, RUN, PRINCIPAL, IQ, INFO, CID, M1, M2, OUT } from "./seed.mjs";
import { CONTRADICTION_CANDIDATE_CHECKS, DISMISSAL_REASONS, TEXT_CAPS } from "../../../src/contradiction/index.mjs";

const ROWS = CONTRADICTION_CANDIDATE_CHECKS;
const refused = (r, code) => refusedWith(assert, ROWS, r, code);
const acts = (w) => w.count("contradiction_acts");
const shown = (w, id) => w.c.candidatesFor({ on: { candidate: id }, viewer: M1 }).candidates[0] ?? null;

test("R30: refusals common to every act, first and in order — a machine or empty author, no candidate, an absent, unseen or not-shown one alike, text over its cap naming the field", () => {
  const w = seeded();
  const duty = cand(w, "K2", "record");
  const hiddenNot = cand(w, "K4", "precision");
  const doors = {
    dismiss: (a) => w.c.dismiss({ reason: "not_same_matter", ...a }),
    clarify: (a) => w.c.clarify({ choice: "differs", coordinates: ["scope"], explanation: "x", ...a }),
    takeUp: (a) => w.c.takeUp({ question: "Q?", frame: "a", ...a }),
  };
  for (const [name, act] of Object.entries(doors)) {
    for (const author of [null, "", "  ", "class:ai", "token:member", "class:admin"])
      refused(act({ candidate: null, author, viewer: M1 }), "MACHINE_CANNOT_ACT_ON_CANDIDATE");
    for (const candidate of [null, "", "   ", 7]) refused(act({ candidate, author: M1, viewer: M1 }), "NO_CANDIDATE");
    const absent = act({ candidate: sha("none"), author: M1, viewer: M1 });
    const unseen = act({ candidate: duty, author: M1, viewer: null });
    const notShown = act({ candidate: hiddenNot, author: M1, viewer: M1 });
    for (const r of [absent, unseen, notShown]) refused(r, "NO_SUCH_CANDIDATE");
    assert.deepEqual({ ...absent, detail: null }, { ...notShown, detail: null }, name);
  }
  /* the caps, each field named */
  assert.deepEqual(TEXT_CAPS, { explanation: 1000, reason: 500, words: 500, qualifier: 200, question: 500, text: 2000 });
  const over = (n) => "x".repeat(n + 1);
  const cases = [
    [() => w.c.clarify({ candidate: duty, choice: "differs", coordinates: ["scope"], explanation: over(1000), viewer: M1, author: M1 }), "explanation", 1000],
    [() => w.c.clarify({ candidate: duty, choice: "one_wrong", wrongSide: "a", reason: over(500), viewer: M1, author: M1 }), "reason", 500],
    [() => w.c.clarify({ candidate: duty, choice: "differs", coordinates: ["scope"], explanation: "x", qualifiers: { a: over(200) }, viewer: M1, author: M1 }), "qualifier_a", 200],
    [() => w.c.clarify({ candidate: duty, choice: "differs", coordinates: ["scope"], explanation: "x", qualifiers: { b: over(200) }, viewer: M1, author: M1 }), "qualifier_b", 200],
    [() => w.c.takeUp({ candidate: duty, question: over(500), frame: "a", viewer: M1, author: M1 }), "question", 500],
    [() => w.c.dismiss({ candidate: duty, reason: "not_same_matter", words: over(500), viewer: M1, author: M1 }), "words", 500],
  ];
  for (const [f, field, limit] of cases) {
    const r = f();
    refused(r, "WORDS_MALFORMED");
    assert.deepEqual([r.field, r.limit], [field, limit]);
  }
  /* at the cap is not over it */
  assert.equal(w.c.clarify({ candidate: duty, choice: "differs", coordinates: ["scope"], explanation: "x".repeat(1000), viewer: M1, author: M1 }).ok, true);
  assert.equal(acts(w), 1);
});

test("R30: who may act is any member who may see both sides; no project position is asked", () => {
  const w = seeded();
  const duty = cand(w, "K2", "record");
  assert.equal(w.c.clarify({ candidate: duty, choice: "differs", coordinates: ["scope"], explanation: "x", viewer: OUT, author: OUT }).ok, true);
});

test("R30, R44: the acceptance basis — accepted naming a standing recommendation, else unaided — and the recommendations standing at the instant; a stale or unequal acceptance is refused", () => {
  const w = seeded();
  const duty = cand(w, "K2", "record");
  const recs = recommend(w, duty, [{ coordinate: "scope", reason: "one is the base fee" }, { coordinate: "time_or_occasion", reason: "two years" }]);
  assert.equal(recs.ok, true, JSON.stringify(recs));
  const [scope, time] = recs.recommendations.map((r) => r.recommendation);
  refused(w.c.clarify({ candidate: duty, choice: "differs", coordinates: ["scope"], explanation: "x", accepted: [sha("never")], viewer: M1, author: M1 }), "ACCEPTANCE_NOT_STANDING");
  refused(w.c.clarify({ candidate: duty, choice: "differs", coordinates: ["scope"], explanation: "x", accepted: [time], viewer: M1, author: M1 }), "ACCEPTANCE_VALUE_DIFFERS");
  refused(w.c.clarify({ candidate: duty, choice: "one_wrong", wrongSide: "a", reason: "r", accepted: scope, viewer: M1, author: M1 }), "ACCEPTANCE_VALUE_DIFFERS");
  /* accepted with no words of the member's own: recorded so */
  const r = w.c.clarify({ candidate: duty, choice: "differs", coordinates: ["scope", "meaning"], explanation: "base fee against total", accepted: [scope], viewer: M1, author: M1 });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.act.acceptance, { scope: { basis: "accepted", recommendation: scope }, meaning: { basis: "unaided" } });
  assert.deepEqual(r.act.standing.map((s) => s.coordinate).sort(), ["scope", "time_or_occasion"]);
  assert.equal(r.act.explanation, "base fee against total");       /* the member's own words; the machine's reason is never copied */
  assert.ok(!JSON.stringify(r.act).includes("one is the base fee"));
  /* R44: every value the act records is named by the act; the plane fills in none */
  assert.deepEqual(r.act.coordinates, ["scope", "meaning"]);
  const bare = seeded();
  const d2 = cand(bare, "K2", "record");
  const s2 = recommend(bare, d2, [{ coordinate: "scope", reason: "r" }]).recommendations[0].recommendation;
  const acc = bare.c.clarify({ candidate: d2, choice: "differs", coordinates: ["scope"], accepted: [s2], viewer: M1, author: M1 });
  assert.equal(acc.ok, true, JSON.stringify(acc));
  assert.equal(acc.own_words, false);
  assert.match(acc.says_words, /no words of the member's own/);
  /* once explained the recommendation still stands; once resolved it does not: a stale acceptance is refused */
  bare.c.clarify({ candidate: d2, choice: "one_wrong", wrongSide: "a", reason: "r", viewer: M1, author: M1 });
  const closed = bare.c.clarify({ candidate: d2, choice: "differs", coordinates: ["scope"], accepted: [s2], viewer: M1, author: M1 });
  refused(closed, "CANDIDATE_CLOSED");
});

test("R31: dismiss — closed and taken-up refused, a duty or plurality cannot be dismissed, one of three reasons; otherwise dismissed with the reason and words", () => {
  const w = seeded();
  const lead = cand(w, "K4", "world"), duty = cand(w, "K2", "record");
  const closedLead = cand(w, "K1", "undetermined");
  w.c.dismiss({ candidate: closedLead, reason: "real_conflict_not_pursued", viewer: M1, author: M1 });
  const closed = w.c.dismiss({ candidate: closedLead, reason: "not_same_matter", viewer: M1, author: M1 });
  refused(closed, "CANDIDATE_CLOSED");
  assert.equal(closed.by, M1);
  const t = seeded();
  const tl = cand(t, "K4", "world");
  const up = t.c.takeUp({ candidate: tl, question: "Q?", frame: "a", viewer: M1, author: M1 });
  const taken = t.c.dismiss({ candidate: tl, reason: "not_same_matter", viewer: M1, author: M1 });
  refused(taken, "CANDIDATE_TAKEN_UP");
  assert.equal(taken.inquiry, up.inquiry);
  const rec = w.c.dismiss({ candidate: duty, reason: "zzz", viewer: M1, author: M1 });
  refused(rec, "RECORD_CANNOT_BE_DISMISSED");                        /* asked before the reason */
  assert.match(rec.translation, /closes only when a member/);
  assert.deepEqual(DISMISSAL_REASONS, ["same_fact_different_precision", "not_same_matter", "real_conflict_not_pursued"]);
  for (const reason of [null, "", "precision", "Not_same_matter"]) refused(w.c.dismiss({ candidate: lead, reason, viewer: M1, author: M1 }), "DISMISSAL_REASON_UNKNOWN");
  const r = w.c.dismiss({ candidate: lead, reason: "same_fact_different_precision", words: " rounded ", viewer: M1, author: M1 });
  assert.equal(r.ok, true);
  assert.deepEqual([r.state, r.act.reason, r.act.words, r.act.author], ["dismissed", "same_fact_different_precision", "rounded", M1]);
  assert.equal(shown(w, lead).state, "dismissed");
});

test("R32: clarify — lead, choice, coordinate (by the key's vocabulary), explanation, evidence the viewer may not see or an undetermined fact; differs with evidence resolves dissolved, without it explains and softens", () => {
  const w = seeded();
  const lead = cand(w, "K4", "world"), duty = cand(w, "K2", "record");
  refused(w.c.clarify({ candidate: lead, choice: "differs", coordinates: ["scope"], explanation: "x", viewer: M1, author: M1 }), "CLARIFY_NOT_A_TENSION");
  for (const choice of [null, "", "same", "no_difference"])            /* no_difference is K5's alone (R34) */
    refused(w.c.clarify({ candidate: duty, choice, viewer: M1, author: M1 }), "CLARIFY_CHOICE_UNKNOWN");
  for (const coordinates of [null, [], ["standard"], ["scope", "precision"], "scope"])
    refused(w.c.clarify({ candidate: duty, choice: "differs", coordinates, explanation: "x", viewer: M1, author: M1 }), "CLARIFY_COORDINATE_UNKNOWN");
  for (const explanation of [null, "", "   "])
    refused(w.c.clarify({ candidate: duty, choice: "differs", coordinates: ["scope"], explanation, viewer: M1, author: M1 }), "CLARIFY_NO_EXPLANATION");
  /* evidence: a content row not seen, one not held, an inquiry leg not held, a fact the record does not state */
  const hiddenBundle = "PROJ-2026-0009-h"; w.project(hiddenBundle, ["m2"]);
  const hid = sha("hidden"); w.content(hid, "capH", hiddenBundle);
  for (const evidence of [[{ content: hid }], [{ content: sha("nope") }], [{ inquiry: IQ.c, ord: 9 }], [{ fact: "time_or_occasion" }], [null], ["x"], [{}]]) {
    const r = w.c.clarify({ candidate: duty, choice: "differs", coordinates: ["scope"], explanation: "x", evidence, viewer: M1, author: M1 });
    refused(r, "EVIDENCE_NOT_SEEN");
    assert.equal(r.index, 0);
  }
  assert.equal(acts(w), 0);
  /* without evidence: explained, hypothesis, the duty stays */
  const soft = w.c.clarify({ candidate: duty, choice: "differs", coordinates: ["scope"], explanation: "base fee", qualifiers: { a: "base" }, viewer: M1, author: M1 });
  assert.deepEqual([soft.ok, soft.state, soft.qualifier_standing], [true, "explained_not_shown", "hypothesis"]);
  assert.equal(shown(w, duty).weight, "duty");
  /* with evidence (a content row, an inquiry leg, a stated fact): dissolved, evidenced */
  const ev = w.c.clarify({ candidate: duty, choice: "differs", coordinates: ["subject"], explanation: "two fees",
    evidence: [{ content: CID.a }, { inquiry: IQ.c, ord: 0 }, { fact: "subject" }], viewer: M1, author: M1 });
  assert.deepEqual([ev.ok, ev.state, ev.kind, ev.qualifier_standing], [true, "resolved", "dissolved", "evidenced"]);
  assert.deepEqual(ev.act.evidence, [{ content: CID.a }, { inquiry: IQ.c, ord: 0 }, { fact: "subject" }]);
});

test("R32: on K4, `subject` reports a defect on each resolution that paired the two sides, with the explanation as its reason and the candidate as its source", () => {
  const w = seeded();
  const k4 = cand(w, "K4", "record");
  const r = w.c.clarify({ candidate: k4, choice: "differs", coordinates: ["subject"], explanation: "two different fees named alike", viewer: M1, author: M1 });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 400));
  assert.deepEqual(r.defects.map((d) => d.capture_sha).sort(), ["capA", "capB"]);
  const back = w.entities.resolutionsFor({ captureSha: "capA", viewer: M1 }).resolutions[0];
  assert.equal(back.defect_count, 1);
  assert.deepEqual([back.defects[0].reason, back.defects[0].source, back.defects[0].by],
                   ["two different fees named alike", { module: "contradiction", id: k4 }, M1]);
  /* another coordinate reports nothing */
  const w2 = seeded();
  const r2 = w2.c.clarify({ candidate: cand(w2, "K4", "record"), choice: "differs", coordinates: ["scope"], explanation: "x", viewer: M1, author: M1 });
  assert.equal(r2.defects, undefined);
  assert.equal(w2.count("resolution_defects"), 0);
});

test("R32 (K5): an evidenced differs is recorded on both projects' stances as the named difference", { todo: "K5 is unshown until its gate arm is measured, so no member can act on a K5 candidate (K488)" }, () => {});

test("R33: one_wrong — the side named, a reason, and no wrong side on K5; resolved corrected, the side marked stale, never deleted", () => {
  const w = seeded();
  const duty = cand(w, "K2", "record");
  for (const wrongSide of [null, "", "c", "A"]) refused(w.c.clarify({ candidate: duty, choice: "one_wrong", wrongSide, reason: "r", viewer: M1, author: M1 }), "WRONG_SIDE_UNNAMED");
  for (const reason of [null, "", "  "]) refused(w.c.clarify({ candidate: duty, choice: "one_wrong", wrongSide: "a", reason, viewer: M1, author: M1 }), "WRONG_SIDE_NO_REASON");
  const before = JSON.stringify(w.rows(`SELECT * FROM inquiry_basis_versions ORDER BY bundle_id`));
  const r = w.c.clarify({ candidate: duty, choice: "one_wrong", wrongSide: "b", reason: " misread ", viewer: M1, author: M1 });
  assert.deepEqual([r.ok, r.state, r.kind, r.wrong_side, r.act.wrong_reason], [true, "resolved", "corrected", "b", "misread"]);
  assert.equal(JSON.stringify(w.rows(`SELECT * FROM inquiry_basis_versions ORDER BY bundle_id`)), before);
});

test("R33, R36: on K5 no side is wrong (PLURALITY_HAS_NO_WRONG_SIDE)", { todo: "K5 is unshown until its gate arm is measured, so no member can act on a K5 candidate (K488)" }, () => {});
test("R34: no_difference applies to K5 only, and makes the candidate a duty for both projects", { todo: "the K5 half is unreachable while K5 is unshown (K488); the refusal on K1–K4 is tested under R32" }, () => {});

test("R35: take up — closed refused, a taken-up one answers its inquiry and writes nothing, a question, a frame; otherwise one act through promotion: an open inquiry linked to the candidate with both sides as legs", () => {
  const w = seeded();
  const duty = cand(w, "K2", "record");
  refused(w.c.takeUp({ candidate: duty, question: "  ", frame: "a", viewer: M1, author: M1 }), "TAKE_UP_NO_QUESTION");
  const nq = w.c.takeUp({ candidate: duty, question: null, frame: "a", viewer: M1, author: M1 });
  assert.equal(nq.default_question, shown(w, duty).default_question);
  for (const frame of [null, "", "c", "A"]) refused(w.c.takeUp({ candidate: duty, question: "Q?", frame, viewer: M1, author: M1 }), "TAKE_UP_NO_FRAME");
  const r = w.c.takeUp({ candidate: duty, question: "Did the fee rise, given the minutes say it fell?", frame: "a", viewer: M1, author: M1 });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 800));
  assert.match(r.inquiry, /^INQ-\d{4}-\d{4}-contradiction$/);
  const fm = w.fm(r.inquiry);
  assert.deepEqual([fm.object_type, fm.current_state, fm.surfaced_by], ["inquiry", "open", "human"]);
  assert.equal(fm.title, "Did the fee rise, given the minutes say it fell?");
  assert.deepEqual(fm.contradiction, { candidate: duty });
  assert.deepEqual(fm.basis.map((l) => [l.target, l.role]), [[IQ.a, "supports"], [IQ.b, "cuts_against"]]);
  assert.ok(fm.basis.every((l) => l.grade === undefined && /of contradiction/.test(l.note)));
  assert.match(fm.basis[0].note, /side a/); assert.match(fm.basis[1].note, /side b/);
  assert.equal(w.k.contradictionLink(r.inquiry).candidate, duty);
  assert.equal(shown(w, duty).state, "taken_up");
  /* again: existed, nothing written */
  const again = w.c.takeUp({ candidate: duty, question: "Another?", frame: "b", viewer: M1, author: M1 });
  assert.deepEqual([again.ok, again.existed, again.inquiry, again.wrote], [true, true, r.inquiry, false]);
  assert.equal(w.count("contradiction_acts"), 1);
  /* a part side becomes a leg on its information bundle naming its content row; framed on b */
  const k1 = cand(w, "K1", "record");
  const r1 = w.c.takeUp({ candidate: k1, question: "Which passage holds?", frame: "b", viewer: M1, author: M1 });
  assert.equal(r1.ok, true, JSON.stringify(r1).slice(0, 800));
  const legs = w.fm(r1.inquiry).basis;
  const view = shown(w, k1);
  assert.deepEqual(legs.map((l) => [l.target, l.role, l.content_id]),
                   [[view.b.source.bundle, "supports", view.b.content_id], [view.a.source.bundle, "cuts_against", view.a.content_id]]);
  /* closed */
  const c2 = cand(w, "K4", "record");
  w.c.clarify({ candidate: c2, choice: "one_wrong", wrongSide: "a", reason: "r", viewer: M1, author: M1 });
  refused(w.c.takeUp({ candidate: c2, question: "Q?", frame: "a", viewer: M1, author: M1 }), "CANDIDATE_CLOSED");
});

test("R35: a promotion refusal is relayed whole, and nothing is written", () => {
  const w = seeded();
  const duty = cand(w, "K2", "record");
  let refuse = true;
  w.promotion.registerStep("zz-test", { check: (c) => (refuse && c.docFm && c.docFm.contradiction
    ? { ok: false, reason: "TEST_REFUSED", code: "TEST_REFUSED", detail: "refused by the test's own step", extra: 1 } : null) });
  const before = [w.count("bundles"), w.count("contradiction_acts"), w.count("inquiry_contradiction_links")];
  const r = w.c.takeUp({ candidate: duty, question: "Q?", frame: "a", viewer: M1, author: M1 });
  assert.deepEqual(r, { ok: false, reason: "TEST_REFUSED", code: "TEST_REFUSED", detail: "refused by the test's own step", extra: 1 });
  assert.deepEqual([w.count("bundles"), w.count("contradiction_acts"), w.count("inquiry_contradiction_links")], before);
  assert.equal(shown(w, duty).state, "open");
  refuse = false;
  assert.equal(w.c.takeUp({ candidate: duty, question: "Q?", frame: "a", viewer: M1, author: M1 }).ok, true);
  /* inquiry's C-2.17: a second contradiction inquiry naming the same candidate is refused at the one door */
  const first = w.k.inquiryOfCandidate(duty);
  const text = w.text(first).replace(/^id: .*$/m, "id: INQ-2026-0999-dup");
  const dup = w.promotion.promote({ bundleId: "INQ-2026-0999-dup", base: null, snapKey: "dup", author: M1,
                                    files: [{ path: "bundle.md", text }], meta: { object_type: "inquiry" } });
  assert.equal(dup.ok, false);
});

test("R62: take up writes one title into the envelope and the document, so promotion's comparison holds for a question holding a quote, a backslash or a line break — the default question included", () => {
  const w = seeded();
  const taken = (key, question) => {
    const candidate = cand(w, key, "record");
    const q = question ?? shown(w, candidate).default_question;
    const r = w.c.takeUp({ candidate, question: q, frame: "a", viewer: M1, author: M1 });
    assert.equal(r.ok, true, JSON.stringify(r).slice(0, 800));
    return r;
  };
  const quoted = taken("K2", 'Does the "fee" rise, given the minutes?');
  assert.equal(w.fm(quoted.inquiry).title, "Does the 'fee' rise, given the minutes?");
  const dflt = taken("K1", null);
  assert.ok(!/["\\]/.test(w.fm(dflt.inquiry).title));
  taken("K4", "Back\\slash or\nbreak?");
});

test("R36: resolve — machine, not a contradiction inquiry (absent, invisible, plain alike), acceptance; writes the resolution and concludes the question without a project, together or not at all", () => {
  const w = seeded();
  const duty = cand(w, "K2", "record");
  const up = w.c.takeUp({ candidate: duty, question: "Q?", frame: "a", viewer: M1, author: M1 });
  for (const author of [null, "", "class:ai"]) refused(w.c.resolve({ inquiry: up.inquiry, resolution: { kind: "irreconcilable" }, viewer: M1, author }), "MACHINE_CANNOT_ACT_ON_CANDIDATE");
  const plain = w.c.resolve({ inquiry: IQ.a, resolution: { kind: "irreconcilable" }, viewer: M1, author: M1 });
  const absent = w.c.resolve({ inquiry: "INQ-2026-0404-x", resolution: { kind: "irreconcilable" }, viewer: M1, author: M1 });
  const unseen = w.c.resolve({ inquiry: up.inquiry, resolution: { kind: "irreconcilable" }, viewer: null, author: M1 });
  for (const r of [plain, absent, unseen]) refused(r, "NOT_A_CONTRADICTION_INQUIRY");
  refused(w.c.resolve({ inquiry: up.inquiry, resolution: { kind: "dissolved", coordinates: ["scope"] }, accepted: [sha("x")], viewer: M1, author: M1 }), "ACCEPTANCE_NOT_STANDING");
  /* a refusal of either step is relayed whole and nothing lands: the resolution's grammar (inquiry R47) */
  const shaBefore = w.record.head(up.inquiry).bundleSha;
  const bad = w.c.resolve({ inquiry: up.inquiry, resolution: { kind: "misquote" }, conclusion: "c", viewer: M1, author: M1 });
  assert.equal(bad.ok, false);
  assert.equal(w.record.head(up.inquiry).bundleSha, shaBefore);
  /* conclude's refusal, after the resolution was written: both roll back */
  w.bv.concludeRefusal = { ok: false, reason: "NO_CLAIM", detail: "no claim" };
  const nc = w.c.resolve({ inquiry: up.inquiry, resolution: { kind: "irreconcilable" }, conclusion: "c", viewer: M1, author: M1 });
  assert.deepEqual(nc, { ok: false, reason: "NO_CLAIM", detail: "no claim" });
  assert.equal(w.record.head(up.inquiry).bundleSha, shaBefore);
  assert.equal(w.count("contradiction_acts"), 1);
  w.bv.concludeRefusal = null;
  const ok = w.c.resolve({ inquiry: up.inquiry, resolution: { kind: "dissolved", coordinates: ["scope"], qualifiers: { a: "base", b: "total" } },
                          conclusion: "two fees, two bases", viewer: M1, author: M1 });
  assert.equal(ok.ok, true, JSON.stringify(ok).slice(0, 600));
  assert.deepEqual([ok.kind, ok.family, ok.state], ["dissolved", "DISSOLVED", "resolved"]);
  const call = w.bv.concludeCalls.at(-1);
  assert.deepEqual([call.target, call.project, call.author, call.conclusion], [up.inquiry, undefined, M1, "two fees, two bases"]);
  assert.deepEqual(w.k.contradictionLink(up.inquiry).resolution, { kind: "dissolved", coordinates: ["scope"], qualifiers: { a: "base", b: "total" } });
  assert.deepEqual(ok.act.acceptance, { scope: { basis: "unaided" } });
  assert.equal(shown(w, duty).resolution.kind, "dissolved");
});

test("R36 (T51, B5): resolve on a freshly taken-up question concludes in one act on the member's own words (reading), its BAD_READING reaching the member; a named accepted version still adopts that claim", () => {
  const w = seeded({ strictConclude: true });
  const fresh = (key = "K2") => w.c.takeUp({ candidate: cand(w, key, "record"), question: "Q?", frame: "a", viewer: M1, author: M1 });
  const resolve = (up, extra) => w.c.resolve({ inquiry: up.inquiry, resolution: { kind: "irreconcilable" }, viewer: M1, author: M1, ...extra });
  const words = "both fees are in the record";
  /* no version: the conclusion's words are the reading, and the call succeeds */
  const up = fresh();
  const ok = resolve(up, { conclusion: words });
  assert.equal(ok.ok, true, JSON.stringify(ok).slice(0, 600));
  assert.equal(ok.state, "resolved");
  const call = w.bv.concludeCalls.at(-1);
  assert.deepEqual([call.reading, call.version, call.conclusion], [words, "", words]);
  assert.equal(shown(w, w.k.contradictionLink(up.inquiry).candidate).state, "resolved");
  /* a blank or whitespace version is no version */
  const blank = fresh("K4");
  assert.equal(resolve(blank, { conclusion: words, version: "   " }).ok, true);
  /* BAD_READING reaches the member (12 to 500 characters), and nothing lands */
  const bad = fresh("K1");
  const before = [w.record.head(bad.inquiry).bundleSha, w.count("contradiction_acts")];
  for (const conclusion of ["too short", "x".repeat(501), "", null]) {
    const r = resolve(bad, { conclusion });
    assert.equal(r.ok, false, String(conclusion).slice(0, 20));
    assert.equal(r.code, "BAD_READING", String(conclusion).slice(0, 20));
    assert.deepEqual([w.record.head(bad.inquiry).bundleSha, w.count("contradiction_acts")], before);
  }
  /* control: a version it does not carry is still NO_CLAIM, relayed whole, and no reading is sent with it */
  const nope = resolve(bad, { conclusion: words, version: "nope" });
  assert.equal(nope.code, "NO_CLAIM");
  assert.equal(w.bv.concludeCalls.at(-1).reading, undefined);
  /* control: a named accepted version adopts that claim, whatever the conclusion's length */
  w.bv.accepted.add(`${bad.inquiry}|v1`);
  const adopted = resolve(bad, { conclusion: "short", version: "v1" });
  assert.equal(adopted.ok, true, JSON.stringify(adopted).slice(0, 600));
  const c2 = w.bv.concludeCalls.at(-1);
  assert.deepEqual([c2.version, c2.reading], ["v1", undefined]);
});

test("R36: a conclusion reached by basis-versions' own door carries its resolution the same way, and records no acceptance basis", () => {
  const w = seeded();
  const duty = cand(w, "K2", "record");
  const up = w.c.takeUp({ candidate: duty, question: "Q?", frame: "a", viewer: M1, author: M1 });
  const head = w.record.head(up.inquiry);
  const text = w.text(up.inquiry).replace(/^current_state: .*$/m, "current_state: concluded").replace(/^prior_state: .*$/m, "prior_state: open")
    .replace(/\n---\n/, `\nconclusion: "irreconcilable"\nfalsifier: "none"\nresolution:\n  kind: "irreconcilable"\n---\n`);
  const r = w.promotion.promote({ bundleId: up.inquiry, base: head.bundleSha, snapKey: "other-door", author: M1,
                                  files: [{ path: "bundle.md", text }], meta: { object_type: "inquiry" } });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 600));
  const c = shown(w, duty);
  assert.deepEqual([c.state, c.resolution.kind], ["resolved", "irreconcilable"]);
  assert.equal(w.count("contradiction_acts"), 1);               /* the take-up only: no acceptance basis recorded */
});

test("R56 (N365): candidateSidesSeen answers true exactly when R36's NOT_A_CONTRADICTION_INQUIRY check passes for the viewer — the one predicate, so the offer and the act cannot disagree", () => {
  const w = seeded();
  /* a candidate with one side in a project m1 takes no part in, taken up by m2, who sees both */
  const hb = "PROJ-2026-0009-h"; w.project(hb, ["m2"]);
  const hid = sha("hidden"); w.content(hid, "capH", hb);
  w.leg(IQ.c, 2, "cuts_against", { content: hid, target: INFO.b });
  const pair = w.c.pairs({ key: "K1", viewer: MACHINE }).pairs.find((p) => p.b.content_id === hid);
  const half = w.c.propose({ run: RUN, proposedBy: "class:ai/t", viewer: MACHINE, caller: PRINCIPAL,
                             proposals: [{ key: "K1", a: pair.a, b: pair.b, label: "record", reason: "r" }] }).candidates[0].candidate;
  /* its contradiction inquiry, promoted by m2 (a leg cannot rest on the project the hidden side is filed in, so it is
     linked by its document alone, as R38's test links one) */
  const linkDoc = (id, candidate) => ["---", `id: ${id}`, "object_type: inquiry", "schema: inquiry@1", `title: "Q"`, "current_state: open",
    "prior_state: null", `created: "2026-09-27T00:00:00Z"`, `last_updated: "2026-09-27T00:00:00Z"`, "surfaced_by: human",
    "contradiction:", `  candidate: "${candidate}"`, "references: []", "state_history: []", "---", "", "## Question", "", "Q?", ""].join("\n");
  const upHalf = { inquiry: "INQ-2026-0600-half" };
  const pr = w.promotion.promote({ bundleId: upHalf.inquiry, base: null, snapKey: "half", author: M2, actorViewer: M2,
                                   files: [{ path: "bundle.md", text: linkDoc(upHalf.inquiry, half) }], meta: { object_type: "inquiry" } });
  assert.equal(pr.ok, true, JSON.stringify(pr).slice(0, 400));
  const whole = cand(w, "K2", "record");
  const upWhole = w.c.takeUp({ candidate: whole, question: "Which?", frame: "a", viewer: M1, author: M1 });
  const cases = [
    [upWhole.inquiry, M1, true], [upWhole.inquiry, M2, true], [upWhole.inquiry, OUT, true],
    [upHalf.inquiry, M2, true], [upHalf.inquiry, M1, false],               /* sees the question, not both sides */
    [upWhole.inquiry, null, false], [upWhole.inquiry, "", false], [upWhole.inquiry, "somebody", false],
    [IQ.a, M1, false],                                                     /* a plain inquiry */
    ["INQ-2026-0404-none", M1, false], ["", M1, false], [null, M1, false], [7, M1, false], [{}, M1, false],
  ];
  for (const [inquiry, viewer, want] of cases) {
    assert.equal(w.c.candidateSidesSeen({ inquiry, viewer }), want, JSON.stringify([inquiry, viewer]));
    /* the act asks the same: an incomplete resolution is refused after C-93.27, never by it, where the read says true */
    const r = w.c.resolve({ inquiry, resolution: { kind: "misquote" }, conclusion: "c", viewer, author: M1 });
    assert.equal(r.ok, false);
    assert.equal(r.code === "NOT_A_CONTRADICTION_INQUIRY", !want, JSON.stringify([inquiry, viewer, r.code]));
  }
  /* an inquiry the viewer may not see: the same false */
  const hq = "PROJ-2026-0010-q"; w.project(hq, ["m2"]);
  assert.equal(w.c.candidateSidesSeen({ inquiry: hq, viewer: M1 }), false);
  /* it writes nothing and never throws */
  const before = w.count("contradiction_acts");
  assert.doesNotThrow(() => w.c.candidateSidesSeen());
  assert.doesNotThrow(() => w.c.candidateSidesSeen({ inquiry: {}, viewer: [] }));
  assert.equal(w.count("contradiction_acts"), before);
});

test("R37: recommend — R13's first four through the run gate, then coordinates, vocabulary, reason, a standing candidate; one per coordinate, a repeat writes nothing", () => {
  const w = seeded();
  w.runs.set("RUN-2026-0002", { status: "ended", principal: PRINCIPAL });
  const duty = cand(w, "K2", "record");
  const good = [{ coordinate: "scope", reason: "one is a base fee" }];
  const call = (extra) => w.c.recommend({ run: RUN, candidate: duty, coordinates: good, proposedBy: "class:ai/t", viewer: MACHINE, caller: PRINCIPAL, ...extra });
  refused(call({ proposedBy: "" }), "CANDIDATE_NO_PROPOSER");
  refused(call({ run: "RUN-2026-0404" }), "CANDIDATE_NO_RUN");
  assert.equal(call({ caller: "member:else" }).code, "AI_RUN_NOT_PRINCIPAL");
  refused(call({ run: "RUN-2026-0002" }), "CANDIDATE_RUN_NOT_RUNNING");
  for (const coordinates of [null, [], "scope"]) refused(call({ coordinates }), "RECOMMEND_NO_COORDINATES");
  for (const bad of [[{ coordinate: "standard", reason: "r" }], [{ coordinate: "precision", reason: "r" }], [{ coordinate: "a", reason: "r" }], [null]])
    refused(call({ coordinates: bad }), "RECOMMEND_COORDINATE_UNKNOWN");
  for (const reason of [null, "", "  "]) refused(call({ coordinates: [{ coordinate: "scope", reason }] }), "RECOMMEND_NO_REASON");
  refused(call({ candidate: sha("none") }), "RECOMMEND_CANDIDATE_NOT_STANDING");
  refused(call({ candidate: cand(w, "K4", "precision") }), "RECOMMEND_CANDIDATE_NOT_STANDING");
  assert.equal(w.count("contradiction_recommendations"), 0);
  const r = call({ coordinates: [...good, { coordinate: "time_or_occasion", reason: "x".repeat(2100) }] });
  assert.deepEqual([r.ok, r.written, r.unchanged], [true, 2, 0]);
  for (const rec of r.recommendations) {
    assert.deepEqual([rec.run, rec.proposed_by, rec.origin, rec.machine_work], [RUN, "class:ai/t", "machine", true]);
    assert.equal(typeof rec.recommendation, "string");
  }
  assert.equal(r.recommendations[1].reason.length, 2000);
  assert.match(r.says, /machine work, not a member's choice/);
  assert.deepEqual([call({}).written, call({}).unchanged], [0, 1]);
  /* not standing once resolved */
  w.c.clarify({ candidate: duty, choice: "one_wrong", wrongSide: "a", reason: "r", viewer: M1, author: M1 });
  refused(call({}), "RECOMMEND_CANDIDATE_NOT_STANDING");
  assert.equal(shown(w, duty).recommendations.length, 0);         /* no longer standing */
});

test("R37, R46: a recommendation names only a respect — never a side or a kind — and a machine credential holds no act of R31–R36", () => {
  const w = seeded();
  const duty = cand(w, "K2", "record");
  for (const coordinate of ["a", "b", "misquote", "irreconcilable", "corrected"])
    refused(recommend(w, duty, [{ coordinate, reason: "r" }]), "RECOMMEND_COORDINATE_UNKNOWN");
  const up = w.c.takeUp({ candidate: cand(w, "K1", "record"), question: "Q?", frame: "a", viewer: M1, author: M1 });
  for (const machine of ["class:ai", "class:admin", "token:ai", "class:daemon"]) {
    refused(w.c.dismiss({ candidate: duty, reason: "not_same_matter", viewer: MACHINE, author: machine }), "MACHINE_CANNOT_ACT_ON_CANDIDATE");
    refused(w.c.clarify({ candidate: duty, choice: "one_wrong", wrongSide: "a", reason: "r", viewer: MACHINE, author: machine }), "MACHINE_CANNOT_ACT_ON_CANDIDATE");
    refused(w.c.takeUp({ candidate: duty, question: "Q?", frame: "a", viewer: MACHINE, author: machine }), "MACHINE_CANNOT_ACT_ON_CANDIDATE");
    refused(w.c.resolve({ inquiry: up.inquiry, resolution: { kind: "irreconcilable" }, viewer: MACHINE, author: machine }), "MACHINE_CANNOT_ACT_ON_CANDIDATE");
  }
});

test("R38: a non-replay promotion naming a candidate this module does not hold, or one whose side its author may not see, is refused C-93.32", () => {
  const w = seeded();
  const duty = cand(w, "K2", "record");
  const doc = (id, candidate) => ["---", `id: ${id}`, "object_type: inquiry", "schema: inquiry@1", `title: "Q"`, "current_state: open",
    "prior_state: null", `created: "2026-09-27T00:00:00Z"`, `last_updated: "2026-09-27T00:00:00Z"`, "surfaced_by: human",
    "contradiction:", `  candidate: "${candidate}"`, "references: []", "state_history: []", "---", "", "## Question", "", "Q?", ""].join("\n");
  const promote = (id, candidate, extra = {}) => w.promotion.promote({ bundleId: id, base: null, snapKey: id, author: M1,
    files: [{ path: "bundle.md", text: doc(id, candidate) }], meta: { object_type: "inquiry" }, ...extra });
  refused(promote("INQ-2026-0500-a", sha("not held")), "CANDIDATE_NOT_HELD");
  /* a side its author may not see: a candidate with a side in a project m1 does not take part in */
  const hb = "PROJ-2026-0009-h"; w.project(hb, ["m2"]);
  const hid = sha("hidden"); w.content(hid, "capH", hb);
  w.leg(IQ.c, 2, "cuts_against", { content: hid, target: INFO.b });
  const pair = w.c.pairs({ key: "K1", viewer: MACHINE }).pairs.find((p) => p.b.content_id === hid);
  const hc = w.c.propose({ run: RUN, proposedBy: "class:ai/t", viewer: MACHINE, caller: PRINCIPAL,
                           proposals: [{ key: "K1", a: pair.a, b: pair.b, label: "record", reason: "r" }] }).candidates[0].candidate;
  refused(promote("INQ-2026-0501-b", hc, { actorViewer: M1 }), "CANDIDATE_NOT_HELD");
  assert.equal(promote("INQ-2026-0502-c", hc, { actorViewer: M2 }).ok, true);
  /* a held, seen candidate passes; a replay is not asked */
  assert.equal(promote("INQ-2026-0503-d", duty).ok, true);
  assert.equal(w.c.promotionCheck({ replay: true, docFm: { contradiction: { candidate: sha("x") } } }), null);
  assert.equal(w.c.promotionCheck({ docFm: { title: "no link" } }), null);
});
