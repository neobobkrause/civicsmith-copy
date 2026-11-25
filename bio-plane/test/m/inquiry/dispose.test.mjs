/* dispose (R20–R22, R39): deferring or dismissing a selection of inquiries, refused whole with every offender named,
   moving the whole set or none of it, and never moving a question a project shown to the caller draws on (each project
   sets a question aside for itself, H10, H38). */
import test from "node:test";
import assert from "node:assert/strict";
import { world, V, MACHINE } from "./fixture.mjs";
import { DISPOSITIONS, PROJECTS_DRAWING_MAX, INQUIRY_MACHINE, INQUIRY_DISPOSE_CHECKS, QUESTION_WORDS } from "../../../src/inquiry/index.mjs";
import { readFileSync } from "node:fs";
import { notADisposition, DISPOSITIONS as PROGRESSION_DISPOSITIONS, PROGRESSION_CHECKS } from "../../../src/progressions/index.mjs";
import { listenerRefusal } from "../../../src/membership/index.mjs";

const A = "INFO-2026-0001-a";
const Q1 = "INQ-2026-0001-q", Q2 = "INQ-2026-0002-r";
const go = (w, handle, to, reason = "later", extra = {}) =>
  w.k.dispose({ handle, to, reason, viewer: "admin", owner: "o", author: V("alice"), ...extra });

test("R20 refusals in order, each moving nothing and naming every offender", () => {
  const caseMembers = new Set();
  const w = world({ caseMembers }); w.doc(A);
  w.inquiry(Q1); w.inquiry(Q2);
  const heads = () => [w.record.head(Q1).bundleSha, w.record.head(Q2).bundleSha];
  const before = heads();
  assert.deepEqual(DISPOSITIONS, ["deferred", "dismissed"]);
  assert.equal(DISPOSITIONS, PROGRESSION_DISPOSITIONS, "progressions' one list (its R35), no copy of its own");
  assert.equal(go(w, "h", "bogus").reason, "BAD_TARGET_STATE");
  /* NOT_A_DISPOSITION for every legal state but the two, answered through progressions' one site (its R35, N285):
     the whole answer is its answer, with its row C-100.20, and no field of this module's own */
  const others = INQUIRY_MACHINE.legal.filter((s) => !DISPOSITIONS.includes(s));
  assert.ok(others.length >= 4, JSON.stringify(others));
  for (const s of others) {
    const r = go(w, "h", s);
    assert.deepEqual(r, notADisposition(s), s);
    assert.deepEqual([r.reason, r.code, r.check, r.translation, r.to, r.dispositions],
      ["NOT_A_DISPOSITION", "NOT_A_DISPOSITION", "C-100.20", PROGRESSION_CHECKS.NOT_A_DISPOSITION.translation, s, DISPOSITIONS], s);
  }
  assert.equal(go(w, "h", "deferred", "  ").reason, "NO_REASON");
  assert.equal(go(w, "h", "deferred", "x".repeat(161)).reason, "BAD_REASON");
  assert.equal(go(w, "h", "deferred", 'a "quote"').reason, "BAD_REASON");
  assert.equal(go(w, "h", "deferred", "two\nlines").reason, "BAD_REASON");
  assert.equal(go(w, "missing", "deferred").reason, "NO_SUCH_SELECTION", "the selection at weight refuse (retrieval R19)");
  w.select("moved", [Q1], { moved: true });
  assert.equal(go(w, "moved", "deferred").reason, "SET_MOVED", "retrieval R20");
  w.select("empty", []);
  assert.equal(go(w, "empty", "deferred").reason, "EMPTY_SELECTION");
  w.select("mixed", [Q1, A]);
  const ni = go(w, "mixed", "deferred");
  assert.equal(ni.reason, "NOT_INQUIRIES"); assert.deepEqual(ni.offenders, [A]); assert.equal(ni.check, "C-33.13"); assert.ok(ni.translation);
  caseMembers.add(Q2);
  w.select("both", [Q1, Q2]);
  const pub = go(w, "both", "deferred");
  assert.equal(pub.reason, "PUBLISHED_CANNOT_BE_SET_DOWN"); assert.deepEqual(pub.offenders.map((o) => o.id), [Q2]);
  caseMembers.delete(Q2);
  w.select("q1", [Q1]);
  assert.equal(go(w, "q1", "deferred").ok, true);
  w.select("q1-again", [Q1]);   /* the set moved with the act, as a real selection does (retrieval R20): a new one */
  const again = go(w, "q1-again", "deferred");
  assert.equal(again.reason, "ILLEGAL_TRANSITION", "deferred -> deferred is not an edge"); assert.deepEqual(again.offenders.map((o) => o.id), [Q1]);
  /* CITED: a dismissal while a live leg rests on a member */
  w.inquiry("INQ-2026-0003-s", { legs: [{ target: Q2 }] });
  w.select("q2", [Q2]);
  const cited = go(w, "q2", "dismissed");
  assert.equal(cited.reason, "CITED"); assert.deepEqual(cited.offenders[0].citedBy.map((l) => l.bundle_id), ["INQ-2026-0003-s"]);
  assert.equal(w.record.head(Q2).bundleSha, before[1], "no refusal moved anything");
});

test("R21 R42 each member gains its history entry, prior and current state, reason and Session Log; a deferral answers the re-evaluation it raised", () => {
  const w = world(); w.inquiry(Q1); w.inquiry(Q2); w.listen();
  w.select("h", [Q1, Q2]);
  const r = go(w, "h", "deferred", "waiting on the budget");
  assert.equal(r.ok, true); assert.deepEqual(r.disposed, [Q1, Q2]); assert.equal(r.weight, "refuse");
  for (const id of [Q1, Q2]) {
    const fm = w.fm(id); const text = w.text(id);
    assert.equal(fm.current_state, "deferred"); assert.equal(fm.prior_state, "open");
    assert.equal(fm.disposition_reason, "waiting on the budget");
    const h = fm.state_history.at(-1);
    assert.deepEqual([h.from_state, h.to_state, h.blurb, h.author], ["open", "deferred", "waiting on the budget", V("alice")]);
    assert.match(text, /### Session .* \| Deferred \| member:alice\nTrigger: selection h\nChanges: state open to deferred\. Reason: waiting on the budget\./);
  }
  assert.equal(r.reevaluation.source, "deferred"); assert.ok(r.reevaluation.since);
  assert.deepEqual(w.raisedCalls.map((c) => [c.target, c.cause, c.since]), [[Q1, "deferred", r.reevaluation.since], [Q2, "deferred", r.reevaluation.since]]);
  assert.deepEqual(r.reevaluation.raised.map((d) => d.target), [Q1, Q2]);
  /* with no module registered to raise it, the act answers without the field and says so */
  const w2 = world(); w2.inquiry(Q1); w2.select("h", [Q1]);
  const r2 = go(w2, "h", "deferred");
  assert.equal(r2.reevaluation, undefined); assert.match(r2.reevaluation_absent, /no module/);
  /* R42: one registration in the slot, whoever makes it; a malformed one refused; both through membership R81 */
  const again = w.k.onRaised("other", () => []);
  assert.deepEqual([again.ok, again.reason, again.code, again.module], [false, "LISTENER_DECLARED", "LISTENER_DECLARED", "reevaluation"]);
  assert.deepEqual(w.k.onRaised("reevaluation", () => []), listenerRefusal({ module: "reevaluation" }, "reevaluation", () => []));
  for (const [m, fn] of [["", () => []], [7, () => []], ["x", null]]) {
    const bad = w2.k.onRaised(m, fn);
    assert.deepEqual(bad, listenerRefusal(null, m, fn)); assert.equal(bad.reason, "LISTENER_MALFORMED");
  }
  /* a dismissal raises none */
  w2.inquiry(Q2); w2.select("d", [Q2]);
  const d = go(w2, "d", "dismissed");
  assert.equal(d.ok, true); assert.equal(d.reevaluation, undefined); assert.equal(d.reevaluation_absent, undefined);
});

test("R22 the whole set moves or none of it does: a refusal after the first member rolls back every member already moved", () => {
  const w = world(); w.inquiry(Q1); w.inquiry(Q2);
  /* Q2's state_history is in a shape the splice cannot extend: its promotion is refused after Q1's */
  const text = w.text(Q2).replace("state_history: []", 'state_history: "odd"');
  assert.equal(w.promote(Q2, text).ok, true);
  const before = [w.record.head(Q1).bundleSha, w.record.head(Q2).bundleSha];
  w.select("h", [Q1, Q2]);
  const r = go(w, "h", "deferred");
  assert.equal(r.ok, false); assert.equal(r.reason, "UNSPLICEABLE_STATE_HISTORY"); assert.equal(r.bundleId, Q2);
  assert.equal(r.disposedSoFar, undefined, "no partial answer");
  assert.deepEqual([w.record.head(Q1).bundleSha, w.record.head(Q2).bundleSha], before, "Q1 was rolled back with the set");
  assert.equal(w.fm(Q1).current_state, "open");
});

const WORDS = JSON.parse(readFileSync(new URL("../../../../docs/development/ux-substrate/screens/words.json", import.meta.url), "utf8"));
const wordOf = (key) => (Array.isArray(WORDS) ? WORDS : WORDS.words ?? Object.values(WORDS)).find((x) => x && x.key === key)?.en;
const discoverable = (w, P, by) => {
  const r = w.membership.projectVisibilitySet({ projectId: P, setting: "discoverable", reason: "open to the team",
                                                by, viewer: V(by) });
  assert.equal(r.ok, true, JSON.stringify(r));
};

test("R39 a member a project shown to the caller draws on is refused DRAWN_ON_BY_A_PROJECT, the shown projects as data and never a hidden one; the words by key", () => {
  const caseMembers = new Set();
  const w = world({ caseMembers }); w.member("alice"); w.member("bob");
  const Q3 = "INQ-2026-0003-s";
  w.inquiry(Q1); w.inquiry(Q2); w.inquiry(Q3);
  const P1 = w.project("Budget", "alice", [Q1]);
  const P2 = w.project("Audit", "bob", [Q1, Q2]);
  const P3 = w.project("Severed", "bob", [{ target: Q3, status: "severed" }]);
  discoverable(w, P1, "alice"); discoverable(w, P3, "bob");
  assert.equal(w.membership.visibilityOf(P2), "hidden");
  const heads = () => [Q1, Q2, Q3].map((id) => w.record.head(id).bundleSha);
  const before = heads();
  for (const viewer of [V("alice"), V("bob"), "admin"])
    for (const to of ["deferred", "dismissed"]) {
      w.select("all", [Q1, Q2, Q3]);
      const r = w.k.dispose({ handle: "all", to, reason: "later", viewer, owner: "o", author: V("alice") });
      assert.deepEqual([r.ok, r.reason, r.code, r.check, r.key], [false, "DRAWN_ON_BY_A_PROJECT", "DRAWN_ON_BY_A_PROJECT",
                                                                  "C-106.2", "question.refused.drawnon"], `${viewer} ${to}`);
      assert.equal(r.translation, wordOf("question.refused.drawnon"), "words.json's words, read by key");
      assert.equal(r.translation, QUESTION_WORDS["question.refused.drawnon"]);
      /* Q1 only: P1 is shown; P2, hidden, is never named, even to bob, its owner; Q2 is drawn on only by hidden P2, and
         Q3's one citer is severed */
      assert.deepEqual(r.offenders, [{ id: Q1, projects: [{ id: P1, name: "Budget" }] }], `${viewer} ${to}`);
      assert.doesNotMatch(JSON.stringify(r), new RegExp(P2), "a hidden project is never named");
      assert.doesNotMatch(JSON.stringify(r), /count|several|others|out_of_view/i, "nothing counts the drawing projects");
    }
  assert.deepEqual(heads(), before, "nothing moved");
  /* one shown project suffices: no outcome depends on how many draw */
  w.select("q1", [Q1]);
  assert.equal(w.k.dispose({ handle: "q1", to: "deferred", reason: "later", viewer: V("alice"), owner: "o", author: V("alice") }).reason,
               "DRAWN_ON_BY_A_PROJECT");
  /* the retired code and its number are gone from this module's rows (C-106.1 never reused) */
  assert.deepEqual(Object.keys(INQUIRY_DISPOSE_CHECKS), ["DRAWN_ON_BY_A_PROJECT"]);
  assert.ok(Object.values(INQUIRY_DISPOSE_CHECKS).every((x) => x.check !== "C-106.1"));
  /* R35 still first: a published case member is refused by name before this */
  caseMembers.add(Q1);
  w.select("pub", [Q1]);
  assert.equal(go(w, "pub", "deferred").reason, "PUBLISHED_CANNOT_BE_SET_DOWN");
});

test("R39 a question drawn on only by hidden projects is moved on its own state, answered exactly as one no project draws on; each hidden project's own relationship stands", () => {
  const answers = [];
  for (const hiddenDraws of [true, false]) {
    const w = world(); w.member("alice"); w.member("bob");
    w.inquiry(Q1);
    const P = hiddenDraws ? w.project("Audit", "bob", [Q1]) : w.project("Audit", "bob");
    w.select("h", [Q1]);
    const r = w.k.dispose({ handle: "h", to: "deferred", reason: "later", viewer: V("alice"), owner: "o", author: V("alice") });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(w.fm(Q1).current_state, "deferred", "the question's own state moved");
    /* the hidden project's own relationship is untouched: its document still cites the question, unsevered */
    if (hiddenDraws) assert.deepEqual([...w.k.projectsDrawingOn(Q1)], [P]);
    const { since, ...rest } = r;
    answers.push(JSON.stringify(rest));
  }
  assert.equal(answers[0], answers[1], "the act reveals no hidden project");
  /* negative control: the same project set discoverable, the question is refused */
  const w = world(); w.member("alice"); w.member("bob");
  w.inquiry(Q1);
  const P = w.project("Audit", "bob", [Q1]);
  discoverable(w, P, "bob");
  w.select("h", [Q1]);
  assert.equal(w.k.dispose({ handle: "h", to: "deferred", reason: "later", viewer: V("alice"), owner: "o", author: V("alice") }).reason,
               "DRAWN_ON_BY_A_PROJECT");
  assert.equal(w.fm(Q1).current_state, "open");
});

test("R39 fail closed: a read of the shown projects that fails refuses the set PROJECTS_UNDETERMINED, naming no project, moving nothing", () => {
  for (const bad of [() => { throw new Error("boom"); }, () => null, () => ({ nope: 1 }), undefined]) {
    const w = world(); w.member("bob");
    w.inquiry(Q1);
    w.project("Audit", "bob", [Q1]);
    const real = w.k.legEarning.projectsShownOn;
    w.k.legEarning.projectsShownOn = bad;
    w.select("h", [Q1]);
    const r = go(w, "h", "deferred");
    assert.deepEqual([r.ok, r.reason, r.offenders], [false, "PROJECTS_UNDETERMINED", [Q1]]);
    assert.doesNotMatch(JSON.stringify(r), /PROJ-/);
    assert.equal(w.fm(Q1).current_state, "open");
    /* negative control: the read restored, the hidden-only question moves */
    w.k.legEarning.projectsShownOn = real;
    assert.equal(go(w, "h", "deferred").ok, true);
  }
});

test("R21 the history entry records the stamped author as it is", () => {
  const w = world(); w.inquiry(Q1); w.select("h", [Q1]);
  const r = w.k.dispose({ handle: "h", to: "deferred", reason: "later", viewer: "admin", owner: "o", author: MACHINE });
  assert.equal(r.ok, true);
  assert.equal(w.fm(Q1).state_history.at(-1).author, MACHINE);
});

test("R39 leg-earning R7 re-exported: the projects drawing on a member are read at most 32, the first by id, with truncated; a severed citer takes no slot", () => {
  const w = world(); w.member("alice"); w.member("bob");
  w.inquiry(Q1); w.inquiry(Q2);
  assert.equal(PROJECTS_DRAWING_MAX, 32);
  for (let i = 0; i < 40; i++) w.project(`Severed ${i}`, "bob", [{ target: Q2, status: "severed" }]);
  const two = [w.project("One", "alice", [Q2]), w.project("Two", "bob", [Q2])];
  const d2 = w.k.projectsDrawingOn(Q2);
  assert.deepEqual([[...d2], d2.truncated], [two.sort(), false]);
  const all = [];
  for (let i = 0; i < 34; i++) all.push(w.project(`P${i}`, i % 2 ? "bob" : "alice", [Q1]));
  const d1 = w.k.projectsDrawingOn(Q1);
  assert.deepEqual([[...d1], d1.truncated], [all.sort().slice(0, 32), true]);
  assert.deepEqual([...w.k.projectsDrawingOn("")], []); assert.equal(w.k.projectsDrawingOn("").truncated, false);
  /* every one of them hidden: the shared act moves both on their own state (R39), however many draw */
  w.select("h", [Q1, Q2]);
  assert.equal(go(w, "h", "deferred").ok, true);
});

test("R42 R21 a listener's own failures are carried as reevaluation.listeners_failed through dispose; a listener that throws is named and undoes nothing", () => {
  const w = world(); w.inquiry(Q1); w.inquiry(Q2);
  w.k.onRaised("reevaluation", ({ target }) => target === Q1
    ? { source: "deferred", raised: [{ bundle_id: "DEP", ord: 0 }], listeners_failed: ["intent"] }
    : { raised: [], listeners_failed: ["intent", "queue"] });
  w.select("h", [Q1, Q2]);
  const r = go(w, "h", "deferred");
  assert.equal(r.ok, true);
  assert.deepEqual(r.reevaluation.raised, [{ bundle_id: "DEP", ord: 0, target: Q1 }]);
  assert.deepEqual(r.reevaluation.listeners_failed, ["intent", "queue"]);
  const w2 = world(); w2.inquiry(Q1);
  w2.k.onRaised("reevaluation", () => { throw new Error("boom"); });
  w2.select("h", [Q1]);
  const t = go(w2, "h", "deferred");
  assert.equal(t.ok, true); assert.equal(w2.fm(Q1).current_state, "deferred", "the act stands");
  assert.deepEqual(t.reevaluation, { source: "deferred", since: t.reevaluation.since, raised: [], listeners_failed: ["reevaluation"] });
  /* a listener answering only the dependents carries no field */
  const w3 = world(); w3.inquiry(Q1); w3.listen(); w3.select("h", [Q1]);
  assert.equal(go(w3, "h", "deferred").reevaluation.listeners_failed, undefined);
});
