/* hypotheses F1 (BD-17, Bob 7 Nov; the investigation lane's redraft rev 7 of IV-H1 and IV-H2; screen reference: the ux
   lane's Rival Explanations Walkthrough v5): rival explanations are hypotheses, and members' "Explore this next" marks set
   the order of exploring and nothing else. At the interface: the acts, the reads, the leg check through a
   promotion, and the store read directly for what an act wrote. Each with a negative control (K874). */
import test from "node:test";
import assert from "node:assert/strict";
import { world, ANN, OUTSIDER, BOSS, INQ, E1, E2, E3 } from "./fixture.mjs";
import { RIVALS_MIN, RIVALS_MAX, RIVAL_CODES, RIVALS_TABLES, EXPLORE_NEXT_NOTICE_KEY, exploreNextNotice,
         SYSTEM_LABEL, HYPOTHESIS_LABEL, HYPOTHESES_CHECKS, hypothesesOps } from "../../../src/hypotheses/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const PROJ = "PROJ-2026-0001";
const HIDDEN = "INQ-2026-0009-hidden";
const OTHER = "INQ-2026-0003-other";
const MACHINES = ["class:ai", "class:daemon"];
const everything = (w) => w.rows(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
  .map((t) => `${t.name}:${JSON.stringify(w.rows(`SELECT * FROM "${t.name}"`))}`).join("\n");
/* CR2-19: each rival refusal is its row of C-134 (C-134.29–.33), its translation the ux lane's `refusal.<CODE>` (DEC-502) */
const refusedBare = (r, code) => {
  assert.deepEqual([r.ok, r.reason, r.code, r.check], [false, code, code, HYPOTHESES_CHECKS[code].check], JSON.stringify(r).slice(0, 200));
  assert.equal(r.translation, word(`refusal.${code}`));
  assert.ok(typeof r.detail === "string" && r.detail.length > 0);
};

/** An open question with three hypotheses Ann holds (A, B, C), a fourth in another question, a withdrawn one, an open
 *  proposal of the system's, a set-aside one, and a fenced question only Ann sees. */
function setup() {
  const w = world();
  w.bundle(INQ);
  w.bundle(OTHER);
  w.fenced(HIDDEN, PROJ, "ann");
  const A = w.hold({ statement: "A budget shortfall." });
  const B = w.hold({ statement: "The deck was unsafe.", about: { from: E2, to: E3 } });
  const C = w.hold({ kind: "other", statement: "Too few people used it.", about: [E1] });
  const elsewhere = w.hold({ inquiry: OTHER });
  const gone = w.hold({ statement: "Withdrawn." });
  assert.equal(w.h.withdraw({ hypothesisId: gone, reason: "no", by: ANN }).ok, true);
  const P = w.h.hypothesisPropose({ inquiry: INQ, kind: "relation", statement: "The two share an officer.", about: { from: E1, to: E3 },
                                    how: "Two filings name the same treasurer.", false_alarm_rate: 0.2, run: "RUN-1" }).proposal;
  const aside = w.h.hypothesisPropose({ inquiry: INQ, kind: "other", statement: "Set aside.", about: [E1], how: "h", false_alarm_rate: 0.5, run: "RUN-1" }).proposal;
  assert.equal(w.h.hypothesisSetAside({ proposal: aside, reason: "not so", by: ANN }).ok, true);
  return { w, A, B, C, P, elsewhere, gone, aside };
}

/* ---- IV-H1: the rivals ---------------------------------------------------------------------------------------------- */

test("F1 IV-H1 a question holds 2 to 6 rival explanations, each a hypothesis already held in it (R1) or one the system proposed (R16), labelled a hypothesis, never a fact, with no grade; the system's labelled as the system's", () => {
  const { w, A, B, P } = setup();
  assert.deepEqual([RIVALS_MIN, RIVALS_MAX], [2, 6]);
  const r = w.h.hypothesisRivals({ inquiry: INQ, rivals: [A, B, P], by: ANN });
  assert.deepEqual([r.ok, r.inquiry, r.rivals, r.added, r.removed], [true, INQ, [A, B, P], [A, B, P], []], JSON.stringify(r));
  const read = w.h.rivalsOf({ inquiry: INQ, viewer: OUTSIDER });
  assert.equal(read.ok, true);
  assert.equal(read.label, HYPOTHESIS_LABEL);
  assert.deepEqual(read.rivals.map((x) => [x.order, x.rival, x.label, x.fact, x.grade, x.source]),
    [[1, A, HYPOTHESIS_LABEL, false, null, "member"], [2, B, HYPOTHESIS_LABEL, false, null, "member"], [3, P, HYPOTHESIS_LABEL, false, null, SYSTEM_LABEL]]);
  const sys = read.rivals[2];
  assert.deepEqual([sys.by, sys.statement, sys.how, sys.false_alarm_rate, sys.status], [SYSTEM_LABEL, "The two share an officer.", "Two filings name the same treasurer.", 0.2, "open"]);
  assert.deepEqual([read.rivals[0].statement, read.rivals[0].status], ["A budget shortfall.", "live"]);
  /* a member's rivals stay hers; the system's proposal is not held by being made a rival (R16: never in hypothesesOf as held) */
  assert.deepEqual(w.h.hypothesesOf({ inquiry: INQ, viewer: ANN }).hypotheses.map((h) => h.hypothesis_id).includes(P), false);
  /* exactly six lands; the negative control is the seventh, below */
  const ids = [A, B, P];
  for (let i = 0; i < 3; i++) ids.push(w.hold({ statement: `More ${i}.` }));
  assert.equal(w.h.hypothesisRivals({ inquiry: INQ, rivals: ids, by: BOSS }).ok, true);
  assert.equal(w.h.rivalsOf({ inquiry: INQ, viewer: ANN }).rivals.length, 6);
});

test("F1 IV-H1 refusals in order, each writing nothing: NO_SUCH_BUNDLE (absent or unseen, one answer), MACHINE_CANNOT_HYPOTHESISE, RIVALS_TOO_FEW / RIVALS_TOO_MANY (naming 2 and 6), NOT_IN_INQUIRY (another question's, a withdrawn one, a set-aside proposal, no hypothesis)", () => {
  const { w, A, B, C, P, elsewhere, gone, aside } = setup();
  const before = everything(w);
  const seven = [A, B, C, P, w.hold({ statement: "4" }), w.hold({ statement: "5" }), w.hold({ statement: "6" })];
  const before7 = everything(w);
  /* unseen first: a fenced question to an outsider answers exactly as an absent one */
  const hidden = w.h.hypothesisRivals({ inquiry: HIDDEN, rivals: [], by: OUTSIDER });
  const absent = w.h.hypothesisRivals({ inquiry: "INQ-2026-0404-none", rivals: [], by: OUTSIDER });
  assert.deepEqual([hidden.reason, absent.reason, hidden.check], ["NO_SUCH_BUNDLE", "NO_SUCH_BUNDLE", HYPOTHESES_CHECKS.NO_SUCH_BUNDLE.check]);
  assert.equal(w.h.hypothesisRivals({ inquiry: PROJ, rivals: [A, B], by: ANN }).reason, "NOT_AN_INQUIRY");
  for (const m of MACHINES) assert.equal(w.h.hypothesisRivals({ inquiry: INQ, rivals: seven, by: m }).reason, "MACHINE_CANNOT_HYPOTHESISE");
  for (const few of [undefined, [], [A], [A, A], "A,B"]) {
    const r = w.h.hypothesisRivals({ inquiry: INQ, rivals: few, by: ANN });
    refusedBare(r, "RIVALS_TOO_FEW");
    assert.deepEqual([r.min, r.max], [2, 6]);
  }
  const many = w.h.hypothesisRivals({ inquiry: INQ, rivals: [...seven, "HYP-2026-0404"], by: ANN });
  refusedBare(many, "RIVALS_TOO_MANY");
  assert.deepEqual([many.min, many.max], [2, 6]);
  refusedBare(w.h.hypothesisRivals({ inquiry: INQ, rivals: seven, by: ANN }), "RIVALS_TOO_MANY");
  for (const bad of [elsewhere, gone, aside, "HYP-2026-0404", "ENT-2026-0001", 7]) {
    const r = w.h.hypothesisRivals({ inquiry: INQ, rivals: [A, bad], by: ANN });
    refusedBare(r, "NOT_IN_INQUIRY");
    assert.equal(r.rival, typeof bad === "string" ? bad : null);
  }
  assert.equal(everything(w), before7, "nothing was written by any refusal");
  assert.notEqual(before, before7, "the negative control: a hold writes");
  /* the control: the same act by a member with good rivals writes */
  assert.equal(w.h.hypothesisRivals({ inquiry: INQ, rivals: [A, B], by: ANN }).ok, true);
  assert.notEqual(everything(w), before7);
});

test("F1 IV-H1 only a member adds or removes a rival, and each change is kept in the history with who and when; a rival already in the set stays even once withdrawn; the same set again writes nothing", () => {
  const { w, A, B, C } = setup();
  assert.equal(w.h.hypothesisRivals({ inquiry: INQ, rivals: [A, B], by: ANN }).ok, true);
  const r = w.h.hypothesisRivals({ inquiry: INQ, rivals: [A, C], by: BOSS });
  assert.deepEqual([r.ok, r.added, r.removed, r.rivals], [true, [C], [B], [A, C]]);
  const hist = w.h.rivalHistory({ inquiry: INQ, viewer: OUTSIDER });
  assert.deepEqual(hist.history.map((h) => [h.act, h.rival, h.by]), [["add", A, ANN], ["add", B, ANN], ["remove", B, BOSS], ["add", C, BOSS]]);
  assert.ok(hist.history.every((h) => typeof h.at === "string" && h.at.length > 0));
  const snap = everything(w);
  const again = w.h.hypothesisRivals({ inquiry: INQ, rivals: [C, A], by: ANN });
  assert.deepEqual([again.ok, again.already, again.added, again.removed], [true, true, [], []]);
  assert.equal(everything(w), snap, "the same set writes nothing");
  /* a withdrawn rival stays in the set, shown withdrawn, and the set keeps it on a later change */
  assert.equal(w.h.withdraw({ hypothesisId: C, reason: "no", by: ANN }).ok, true);
  assert.deepEqual(w.h.rivalsOf({ inquiry: INQ, viewer: ANN }).rivals.map((x) => [x.rival, x.status]), [[A, "live"], [C, "withdrawn"]]);
  const D = w.hold({ statement: "D." });
  assert.equal(w.h.hypothesisRivals({ inquiry: INQ, rivals: [A, C, D], by: ANN }).ok, true);
  /* the control: a withdrawn hypothesis not already a rival is refused */
  assert.equal(w.h.hypothesisRivals({ inquiry: INQ, rivals: [A, B, C, D], by: ANN }).ok, true);
  const E = w.hold({ statement: "E." });
  assert.equal(w.h.withdraw({ hypothesisId: E, reason: "no", by: ANN }).ok, true);
  assert.equal(w.h.hypothesisRivals({ inquiry: INQ, rivals: [A, E], by: ANN }).reason, "NOT_IN_INQUIRY");
});

test("F1 IV-H1 never evidence: a rival is never a leg (a promotion naming one is refused HYPOTHESIS_NOT_A_LEG, the system's included), and setting the rivals and marking one write nothing to any other module's table (R8)", () => {
  const { w, A, B, P } = setup();
  const others = w.others();
  assert.equal(w.h.hypothesisRivals({ inquiry: INQ, rivals: [A, B, P], by: ANN }).ok, true);
  assert.equal(w.h.exploreNext({ inquiry: INQ, rival: B, by: ANN }).ok, true);
  assert.deepEqual(w.others(), others);
  const q = "INQ-2026-0002-q";
  assert.equal(w.promote(q, [{ target: "INFO-2026-0001-doc" }]).ok, true, "the negative control: an ordinary leg passes");
  for (const rival of [A, B, P]) {
    const r = w.promote(q, [{ target: rival }]);
    assert.equal(r.reason, "BASIS_REFUSED");
    assert.deepEqual(r.findings.map((f) => f.code), ["HYPOTHESIS_NOT_A_LEG"]);
  }
});

/* ---- IV-H2: the order of exploration, and nothing else ---------------------------------------------------------------- */

test("F1 IV-H2 'Explore this next': each member holds one mark at a time, a new mark replaces their own earlier one, each kept with who and when; the not-evidence sentence is answered where the mark is made", () => {
  const { w, A, B, C } = setup();
  assert.equal(w.h.hypothesisRivals({ inquiry: INQ, rivals: [A, B, C], by: ANN }).ok, true);
  const m1 = w.h.exploreNext({ inquiry: INQ, rival: B, by: ANN });
  assert.deepEqual([m1.ok, m1.rival, m1.replaced], [true, B, null]);
  assert.equal(EXPLORE_NEXT_NOTICE_KEY, "hypotheses.rivals.explore_next_notice");
  assert.equal(m1.notice, word(EXPLORE_NEXT_NOTICE_KEY), "the sentence is the word table's, by its key");
  assert.equal(exploreNextNotice(), word(EXPLORE_NEXT_NOTICE_KEY));
  assert.ok(typeof m1.notice === "string" && m1.notice.length > 20);
  const m2 = w.h.exploreNext({ inquiry: INQ, rival: C, by: ANN });
  assert.deepEqual([m2.ok, m2.rival, m2.replaced], [true, C, B]);
  assert.deepEqual(w.rows(`SELECT member, rival_id FROM hypothesis_rival_marks WHERE bundle_id = ?`, INQ), [{ member: ANN, rival_id: C }], "one mark per member");
  const snap = everything(w);
  const same = w.h.exploreNext({ inquiry: INQ, rival: C, by: ANN });
  assert.deepEqual([same.ok, same.already, same.notice], [true, true, exploreNextNotice()]);
  assert.equal(everything(w), snap, "marking the one already marked writes nothing");
  assert.deepEqual(w.h.rivalHistory({ inquiry: INQ, viewer: ANN }).history.filter((h) => h.act === "mark").map((h) => [h.rival, h.by]), [[B, ANN], [C, ANN]]);
  /* the sentence is beside the rivals for the dialog before a mark is made */
  assert.equal(w.h.rivalsOf({ inquiry: INQ, viewer: OUTSIDER }).notice, exploreNextNotice());
});

test("F1 IV-H2 the order: rivals ordered by how many members currently mark each, ties to the one added first; no names or counts on the face, only the viewer's own mark", () => {
  const { w, A, B, C } = setup();
  assert.equal(w.h.hypothesisRivals({ inquiry: INQ, rivals: [A, B, C], by: ANN }).ok, true);
  const order = (viewer = ANN) => w.h.rivalsOf({ inquiry: INQ, viewer }).rivals.map((x) => x.rival);
  assert.deepEqual(order(), [A, B, C], "no marks: the order they were added");
  w.h.exploreNext({ inquiry: INQ, rival: C, by: ANN });
  assert.deepEqual(order(), [C, A, B]);
  w.h.exploreNext({ inquiry: INQ, rival: B, by: OUTSIDER });
  assert.deepEqual(order(), [B, C, A], "a tie of one each goes to the one added first");
  w.h.exploreNext({ inquiry: INQ, rival: C, by: BOSS });
  assert.deepEqual(order(), [C, B, A]);
  w.h.exploreNext({ inquiry: INQ, rival: B, by: BOSS });
  assert.deepEqual(order(), [B, C, A], "the boss's mark moved: the count is of current marks");
  const face = w.h.rivalsOf({ inquiry: INQ, viewer: OUTSIDER });
  assert.deepEqual(face.rivals.map((x) => [x.order, x.your_next]), [[1, true], [2, false], [3, false]]);
  assert.deepEqual(w.h.rivalsOf({ inquiry: INQ, viewer: ANN }).rivals.map((x) => x.your_next), [false, true, false]);
  const text = JSON.stringify(face);
  for (const who of [ANN, OUTSIDER, BOSS]) assert.ok(!text.includes(who), `the face names no member: ${who}`);
  for (const x of face.rivals) for (const k of Object.keys(x)) assert.ok(!/count|marks|members/.test(k), `no count on the face: ${k}`);
  /* a removed rival's marks go with it, and the order recounts */
  assert.equal(w.h.hypothesisRivals({ inquiry: INQ, rivals: [A, C], by: ANN }).ok, true);
  assert.deepEqual(order(), [C, A]);
  assert.equal(w.rows(`SELECT COUNT(*) AS n FROM hypothesis_rival_marks WHERE rival_id = ?`, B)[0].n, 0);
});

test("F1 IV-H2 the mark's refusals, each writing nothing: NO_SUCH_BUNDLE (unseen as absent), MACHINE_CANNOT_MARK_RIVAL (the system never marks, INV:108; never sources' MACHINE_CANNOT_MARK), NOT_A_RIVAL (a hypothesis held but not a rival, another question's rival, none named)", () => {
  const { w, A, B, C } = setup();
  assert.equal(w.h.hypothesisRivals({ inquiry: INQ, rivals: [A, B], by: ANN }).ok, true);
  const hiddenA = w.hold({ inquiry: HIDDEN });
  const hiddenB = w.hold({ inquiry: HIDDEN, statement: "Other." });
  assert.equal(w.h.hypothesisRivals({ inquiry: HIDDEN, rivals: [hiddenA, hiddenB], by: ANN }).ok, true);
  const snap = everything(w);
  assert.equal(w.h.exploreNext({ inquiry: HIDDEN, rival: hiddenA, by: OUTSIDER }).reason, "NO_SUCH_BUNDLE");
  assert.equal(w.h.rivalsOf({ inquiry: HIDDEN, viewer: OUTSIDER }).reason, "NO_SUCH_BUNDLE");
  assert.equal(w.h.rivalHistory({ inquiry: HIDDEN, viewer: OUTSIDER }).reason, "NO_SUCH_BUNDLE");
  for (const m of MACHINES) refusedBare(w.h.exploreNext({ inquiry: INQ, rival: "nonsense", by: m }), "MACHINE_CANNOT_MARK_RIVAL");
  for (const bad of [C, hiddenA, null, "HYP-2026-0404"]) refusedBare(w.h.exploreNext({ inquiry: INQ, rival: bad, by: ANN }), "NOT_A_RIVAL");
  assert.equal(everything(w), snap);
  /* the control: a rival of this question, marked by a member */
  assert.equal(w.h.exploreNext({ inquiry: INQ, rival: A, by: ANN }).ok, true);
  assert.notEqual(everything(w), snap);
  assert.deepEqual([...RIVAL_CODES].sort(), ["MACHINE_CANNOT_MARK_RIVAL", "NOT_A_RIVAL", "NOT_IN_INQUIRY", "RIVALS_TOO_FEW", "RIVALS_TOO_MANY"]);
  assert.deepEqual(RIVAL_CODES.map((c) => HYPOTHESES_CHECKS[c].check), ["C-134.29", "C-134.30", "C-134.31", "C-134.32", "C-134.33"]);
  assert.equal(Object.hasOwn(HYPOTHESES_CHECKS, "MACHINE_CANNOT_MARK"), false, "sources' C-121.7 is never this module's");
});

test("F1 IV-H2 what a mark never does: it touches no hypothesis, statement, history or proposal of this module, nor any other module's table; only the marks and their history move", () => {
  const { w, A, B, P } = setup();
  assert.equal(w.h.hypothesisRivals({ inquiry: INQ, rivals: [A, B, P], by: ANN }).ok, true);
  const keep = ["hypotheses", "hypothesis_revisions", "hypothesis_proposals", "hypothesis_rivals"]
    .map((t) => JSON.stringify(w.rows(`SELECT * FROM ${t}`))).join("\n");
  const others = w.others();
  for (const [who, r] of [[ANN, P], [OUTSIDER, B], [BOSS, P]]) assert.equal(w.h.exploreNext({ inquiry: INQ, rival: r, by: who }).ok, true);
  assert.equal(["hypotheses", "hypothesis_revisions", "hypothesis_proposals", "hypothesis_rivals"]
    .map((t) => JSON.stringify(w.rows(`SELECT * FROM ${t}`))).join("\n"), keep);
  assert.deepEqual(w.others(), others);
  assert.equal(w.h.read({ hypothesisId: B, viewer: ANN }).hypothesis.grade, null);
  assert.equal(w.rows(`SELECT COUNT(*) AS n FROM hypothesis_rival_marks`)[0].n, 3, "the control: the marks moved");
});

test("F1 the rivals' tables are declared with the inquiry's sight, purged with it and exported, keyed by its bundle_id (R10's rule)", () => {
  const { w } = setup();
  const declared = w.record.declaredTables().filter((d) => d.module === "hypotheses" && RIVALS_TABLES.includes(d.name));
  assert.deepEqual(declared.map((d) => d.name).sort(), [...RIVALS_TABLES].sort());
  for (const d of declared) assert.deepEqual([d.purge, d.export, d.sight, d.keys], ["clear", "yes", "bundle", ["bundle_id"]], JSON.stringify(d));
});

const opUrl = (op, q = {}) => { const u = new URL(`https://plane.example/?op=${op}`); for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v); return u; };

test("F1 R7 (CR2-19) the door: op=hypothesisrivals and op=explorenext drive the acts from the body, the member the body's stamp; op=rivals reads the rivals, and with history every change, the viewer the query's stamp; a machine's stamp and an empty body are refused, never thrown, writing nothing", () => {
  const { w, A, B } = setup();
  const snap = everything(w);
  refusedBare(hypothesesOps(w.h, opUrl("explorenext"), { inquiry: INQ, rival: A, by: "class:ai" }).explorenext(), "MACHINE_CANNOT_MARK_RIVAL");
  assert.equal(hypothesesOps(w.h, opUrl("hypothesisrivals"), { inquiry: INQ, rivals: [A, B], by: "class:ai" }).hypothesisrivals().reason, "MACHINE_CANNOT_HYPOTHESISE");
  assert.equal(hypothesesOps(w.h, opUrl("hypothesisrivals"), null).hypothesisrivals().reason, "NO_SUCH_BUNDLE");
  assert.equal(hypothesesOps(w.h, opUrl("explorenext"), null).explorenext().reason, "NO_SUCH_BUNDLE");
  assert.equal(everything(w), snap);
  const set = hypothesesOps(w.h, opUrl("hypothesisrivals"), { inquiry: INQ, rivals: [A, B], by: ANN, extra: "dropped" }).hypothesisrivals();
  assert.deepEqual([set.ok, set.rivals], [true, [A, B]]);
  const mark = hypothesesOps(w.h, opUrl("explorenext"), { inquiry: INQ, rival: B, by: ANN }).explorenext();
  assert.deepEqual([mark.ok, mark.notice], [true, exploreNextNotice()]);
  const read = hypothesesOps(w.h, opUrl("rivals", { inquiry: INQ, viewer: ANN }), {}).rivals();
  assert.deepEqual(read.rivals.map((r) => [r.rival, r.your_next]), [[B, true], [A, false]]);
  const hist = hypothesesOps(w.h, opUrl("rivals", { inquiry: INQ, viewer: ANN, history: "1" }), {}).rivals();
  assert.deepEqual(hist.history.map((h) => h.act), ["add", "add", "mark"]);
  assert.equal(hypothesesOps(w.h, opUrl("rivals", { inquiry: HIDDEN, viewer: OUTSIDER }), {}).rivals().reason, "NO_SUCH_BUNDLE");
  /* the read's viewer is the query's stamp, never the body's */
  assert.equal(hypothesesOps(w.h, opUrl("rivals", { inquiry: HIDDEN }), { viewer: ANN }).rivals().reason, "NO_SUCH_BUNDLE");
});

test("F1 (steps R31) isRival, what this module registers with steps: true only for a rival in the question's set and a viewer who sees the question; false for a held hypothesis not in the set, another question, an unseen question, no viewer and malformed input, never thrown", () => {
  const { w, A, B, C } = setup();
  assert.equal(w.h.hypothesisRivals({ inquiry: INQ, rivals: [A, B], by: ANN }).ok, true);
  const hiddenA = w.hold({ inquiry: HIDDEN });
  const hiddenB = w.hold({ inquiry: HIDDEN, statement: "Other." });
  assert.equal(w.h.hypothesisRivals({ inquiry: HIDDEN, rivals: [hiddenA, hiddenB], by: ANN }).ok, true);
  assert.equal(w.h.isRival({ question: INQ, rival: A, viewer: ANN }), true);
  assert.equal(w.h.isRival({ question: HIDDEN, rival: hiddenA, viewer: ANN }), true);
  for (const a of [{ question: INQ, rival: C, viewer: ANN }, { question: OTHER, rival: A, viewer: ANN },
                   { question: HIDDEN, rival: hiddenA, viewer: OUTSIDER }, { question: INQ, rival: A, viewer: null },
                   { question: INQ, rival: null, viewer: ANN }, {}, undefined])
    assert.equal(w.h.isRival(a), false, JSON.stringify(a));
});

test("F1 IV-H2 with no steps bound, each rival lists no legs and says it could not read them (legs_read false), never a guess; a binding that is not a steps instance is refused, binding nothing", () => {
  const { w, A, B } = setup();
  assert.equal(w.h.hypothesisRivals({ inquiry: INQ, rivals: [A, B], by: ANN }).ok, true);
  for (const r of w.h.rivalsOf({ inquiry: INQ, viewer: ANN }).rivals) assert.deepEqual([r.legs, r.legs_read], [[], false]);
  for (const bad of [null, {}, { registerRivalSource: 1 }]) assert.equal(w.h.bindSteps(bad).reason, "STEPS_NOT_A_STEPS");
  for (const r of w.h.rivalsOf({ inquiry: INQ, viewer: ANN }).rivals) assert.equal(r.legs_read, false);
});

test.todo("F1 IV-H2 'Evidence found while exploring' over steps' real module (steps R31): a step opened from a rival records it, and the rival lists the question's legs whose target a step opened from it produced, each with its grades and its role, in the basis's order; a leg on another product, and a step on another rival, list nothing; a mark writes no leg. Owed: build/modules.json gives hypotheses no `uses` edge to steps, so neither this module nor its tests may import steps or its published fixtures (ARC-1)");
