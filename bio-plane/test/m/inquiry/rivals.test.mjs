/* R91 (F2, IV-H3; BD-17): a rival explanation's standing changes only when a conclusion on the question that meets the
   project's bar names it. The naming a conclusion carries (`rivals_named`), judged by R11's arm at every promotion; the
   bar judgment registered with `onBarJudged` (a stand-in the test controls, as strength's `onGrounded` is in
   `fixture.mjs`); and `rivalStanding`, computed each time it is asked. Driven through the real `promotion.promote`. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, inquiryMd } from "./fixture.mjs";
import { RIVAL_NAMINGS, RIVAL_STANDINGS, RIVALS_MAX } from "../../../src/inquiry/rivals.mjs";
import { INQUIRY_RIVAL_CHECKS } from "../../../src/inquiry/checks.mjs";

const A = "INFO-2026-0001-a";
const Q = "INQ-2026-0001-q";
const H1 = "HYP-2026-0001", H2 = "HYP-2026-0002", H3 = "HYP-2026-0003";
const RIVALS = [H1, H2, H3];
const CONCLUDED = ['conclusion: "the budget closed the pool, and the deck did not"',
                   'falsifier: "a budget record showing the pool funded"'];
const HISTORY = ["  - from_state: open", "    to_state: concluded", '    timestamp: "2026-09-28T00:00:00Z"', "    author: member:alice"];
const naming = (pairs) => (pairs.length ? ["rivals_named:", ...pairs.flatMap(([r, n]) => [`  - rival: ${r}`, `    named: ${n}`])] : []);
const doc = (extra, { state = "concluded" } = {}) => inquiryMd(Q, { legs: [{ target: A }], state,
  history: state === "concluded" ? HISTORY : "[]", extra: [...(state === "concluded" ? CONCLUDED : []), ...extra] });
function setup() { const w = world(); w.doc(A); w.inquiry(Q, { legs: [{ target: A }] }); return w; }
const land = (w, text) => { const r = w.promote(Q, text); assert.equal(r.ok, true, JSON.stringify(r).slice(0, 500)); return r; };
const judge = (w, answer) => {
  const calls = [];
  w.k.onBarJudged("strength", (a) => { calls.push(a); if (answer instanceof Error) throw answer; return answer; });
  return calls;
};
const standing = (w, extra = {}) => w.k.rivalStanding({ question: Q, project: "PRJ-x", rivals: RIVALS, viewer: "admin", ...extra });
const by = (r) => Object.fromEntries(r.standings.map((s) => [s.rival, s.standing]));

test("R91 the vocabularies are frozen", () => {
  assert.deepEqual([...RIVAL_NAMINGS], ["case", "not_case", "neither"]);
  assert.deepEqual([...RIVAL_STANDINGS], ["not_established", "concluded_at_bar", "ruled_out_at_bar"]);
  assert.equal(RIVALS_MAX, 6);
  assert.ok(Object.isFrozen(RIVAL_NAMINGS) && Object.isFrozen(RIVAL_STANDINGS));
});

test("R91, R11 a conclusion names each rival the case, not the case, or neither; a malformed naming is refused and nothing is written", () => {
  const w = setup();
  const before = w.text(Q);
  const bad = [
    ["rivals_named: HYP-2026-0001"],
    naming([["INFO-2026-0001-a", "case"]]),
    naming([[H1, "probably"]]),
    naming([[H1, "case"], [H1, "not_case"]]),
    ["rivals_named:", `  - rival: ${H1}`, "    named: case", "    grade: A"],
    naming(Array.from({ length: 7 }, (_, i) => [`HYP-2026-000${i + 1}`, "neither"])),
  ];
  for (const extra of bad) {
    const r = w.promote(Q, doc(extra));
    assert.equal(r.ok, false, extra.join("|"));
    assert.equal(r.reason, "BASIS_REFUSED");
    assert.deepEqual(r.findings.map((f) => f.code), ["RIVALS_NAMED_MALFORMED"], extra.join("|"));
    assert.equal(w.text(Q), before, "a refused naming writes nothing");
  }
  /* negative controls: each well-formed naming lands, at concluded and (kept, unread) at open */
  land(w, doc(naming([[H1, "case"], [H2, "not_case"], [H3, "neither"]])));
  land(w, doc(naming([]).concat(["rivals_named: []"])));
  land(w, doc(naming([[H1, "case"]]), { state: "open" }));
});

test("R91 every rival is not established until a conclusion at the bar names it; marks nothing and asks no bar while none is named", () => {
  const w = setup();
  const calls = judge(w, true);
  let r = standing(w);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(by(r), { [H1]: "not_established", [H2]: "not_established", [H3]: "not_established" }, "an open question");
  land(w, doc([]));
  r = standing(w);
  assert.deepEqual(by(r), { [H1]: "not_established", [H2]: "not_established", [H3]: "not_established" }, "concluded, naming none");
  assert.equal(r.at_bar, null);
  assert.equal(calls.length, 0, "the bar is asked only when the conclusion names a rival either way");
});

test("R91 a conclusion at the bar: the rival it names the case is concluded at the bar, the one it names not the case ruled out, every other stays not established, each change linked to its conclusion and legs", () => {
  const w = setup();
  const calls = judge(w, true);
  land(w, doc(naming([[H1, "case"], [H2, "not_case"], [H3, "neither"]])));
  const r = standing(w);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.at_bar, true);
  assert.deepEqual(by(r), { [H1]: "concluded_at_bar", [H2]: "ruled_out_at_bar", [H3]: "not_established" });
  const link = { question: Q, at: "2026-09-28T00:00:00Z", legs: [{ target: A, role: "supports" }] };
  assert.deepEqual(r.standings[0].conclusion, link);
  assert.deepEqual(r.standings[1].conclusion, link);
  assert.equal("conclusion" in r.standings[2], false, "an unchanged standing links to nothing");
  assert.deepEqual(calls, [{ question: Q, project: "PRJ-x", viewer: "admin" }], "the bar is the asking project's, judged once per read");
  /* a rival the conclusion does not name at all stays not established: concluding one never rules out another */
  const other = w.k.rivalStanding({ question: Q, project: "PRJ-x", rivals: ["HYP-2026-0009"], viewer: "admin" });
  assert.deepEqual(by(other), { "HYP-2026-0009": "not_established" });
});

test("R91 below the bar, with no judgment registered, or a judgment that throws or answers anything but true: the conclusion names nothing for standing", () => {
  for (const answer of [false, null, "yes", 1, { meets: true }, new Error("strength unavailable"), undefined]) {
    const w = setup();
    if (answer !== undefined) judge(w, answer);
    land(w, doc(naming([[H1, "case"], [H2, "not_case"]])));
    const r = standing(w);
    assert.equal(r.ok, true, String(answer));
    assert.deepEqual(by(r), { [H1]: "not_established", [H2]: "not_established", [H3]: "not_established" }, String(answer));
    assert.equal(r.at_bar, answer === undefined ? null : false, String(answer));
  }
});

test("R91 computed, not stored: when the bar is no longer met, or the question is reopened, the rivals it named return to not established with no member act", () => {
  const w = setup();
  let meets = true;
  w.k.onBarJudged("strength", () => meets);
  land(w, doc(naming([[H1, "case"], [H2, "not_case"]])));
  assert.deepEqual(by(standing(w)), { [H1]: "concluded_at_bar", [H2]: "ruled_out_at_bar", [H3]: "not_established" });
  meets = false;   /* a leg went stale, or the bar was raised */
  assert.deepEqual(by(standing(w)), { [H1]: "not_established", [H2]: "not_established", [H3]: "not_established" });
  meets = true;
  assert.deepEqual(by(standing(w)), { [H1]: "concluded_at_bar", [H2]: "ruled_out_at_bar", [H3]: "not_established" });
  /* reopened: the naming is kept in the bytes, and not read */
  land(w, doc(naming([[H1, "case"], [H2, "not_case"]]), { state: "open" }));
  assert.deepEqual(by(standing(w)), { [H1]: "not_established", [H2]: "not_established", [H3]: "not_established" });
});

test("R91 refusals: an absent or unseen question answers one way, a bundle that is no question, a malformed list of rivals; and one bar judgment is registered", () => {
  const w = setup();
  assert.equal(w.k.rivalStanding({ question: "INQ-2026-0099-none", rivals: RIVALS, viewer: "admin" }).reason, "NO_SUCH_BUNDLE");
  assert.equal(w.k.rivalStanding({ question: Q, rivals: RIVALS, viewer: null }).reason, "NO_SUCH_BUNDLE");
  assert.equal(w.k.rivalStanding({ question: A, rivals: RIVALS, viewer: "admin" }).reason, "NOT_AN_INQUIRY");
  for (const rivals of ["HYP-2026-0001", [A], [H1, H1], Array.from({ length: 7 }, (_, i) => `HYP-2026-000${i + 1}`)])
    assert.equal(w.k.rivalStanding({ question: Q, rivals, viewer: "admin" }).reason, "RIVALS_MALFORMED", JSON.stringify(rivals));
  assert.equal(w.k.rivalStanding({ question: Q, rivals: [], viewer: "admin" }).ok, true, "a question with no rivals asked answers none");
  assert.equal(w.k.onBarJudged("strength", () => true).ok, true);
  assert.equal(w.k.onBarJudged("other", () => true).ok, false, "one registration");
});

/* R92 (CR2-20): the rivals list read from its one registration when a read names none, and each rival refusal with its
   own catalogue row. The list's source is a stand-in the test controls, as the bar judgment is above. */
const ROWS = INQUIRY_RIVAL_CHECKS;

test("R92 a read naming no rivals asks the registered list, in its order, and stands each as R91 does", () => {
  const w = setup();
  judge(w, true);
  const asked = [];
  assert.equal(w.k.onRivalsListed("hypotheses", (a) => { asked.push(a); return [H3, ` ${H1} `]; }).ok, true);
  land(w, doc(naming([[H1, "case"], [H2, "not_case"]])));
  for (const rivals of [undefined, null]) {
    const r = w.k.rivalStanding({ question: Q, project: "PRJ-x", viewer: "admin", ...(rivals === undefined ? {} : { rivals }) });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual(r.standings.map((s) => [s.rival, s.standing]), [[H3, "not_established"], [H1, "concluded_at_bar"]],
      "the registered list's rivals, in its order; a named rival not on it is not shown");
  }
  assert.deepEqual(asked, [{ question: Q, viewer: "admin" }, { question: Q, viewer: "admin" }]);
  /* negative control: a list the caller names wins, and the registered one is not asked */
  const r = standing(w);
  assert.deepEqual(by(r), { [H1]: "concluded_at_bar", [H2]: "ruled_out_at_bar", [H3]: "not_established" });
  assert.equal(asked.length, 2);
  assert.equal(w.k.onRivalsListed("other", () => []).ok, false, "one registration");
});

test("R92 a list that cannot be read is refused RIVALS_UNREAD with its row, never answered as no rivals", () => {
  const nothing = setup();
  const r0 = nothing.k.rivalStanding({ question: Q, viewer: "admin" });
  assert.equal(r0.reason, "RIVALS_UNREAD", "none registered");
  assert.equal(r0.check, ROWS.RIVALS_UNREAD.check);
  assert.equal(r0.translation, ROWS.RIVALS_UNREAD.translation);
  for (const answer of [new Error("hypotheses unavailable"), null, "HYP-2026-0001", [A], [H1, H1], { rivals: [H1] },
                        Array.from({ length: 7 }, (_, i) => `HYP-2026-000${i + 1}`)]) {
    const w = setup();
    w.k.onRivalsListed("hypotheses", () => { if (answer instanceof Error) throw answer; return answer; });
    const r = w.k.rivalStanding({ question: Q, viewer: "admin" });
    assert.equal(r.ok, false, String(answer));
    assert.equal(r.reason, "RIVALS_UNREAD", String(answer));
    assert.equal(r.check, ROWS.RIVALS_UNREAD.check);
  }
  /* negative control: an empty list is a list, and answers no standings */
  const w = setup();
  w.k.onRivalsListed("hypotheses", () => []);
  const ok = w.k.rivalStanding({ question: Q, viewer: "admin" });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.standings, []);
});

test("R92 each rival refusal carries its own C-2 row: the naming C-2.21, a malformed list C-2.22, an unread list C-2.23", () => {
  assert.deepEqual(Object.fromEntries(Object.entries(ROWS).map(([k, v]) => [k, v.check])),
    { RIVALS_NAMED_MALFORMED: "C-2.21", RIVALS_MALFORMED: "C-2.22", RIVALS_UNREAD: "C-2.23" });
  for (const v of Object.values(ROWS)) assert.ok(typeof v.translation === "string" && v.translation.length > 0);
  const w = setup();
  const bad = w.promote(Q, doc(naming([[H1, "probably"]])));
  assert.equal(bad.reason, "BASIS_REFUSED");
  assert.equal(bad.findings[0].check, ROWS.RIVALS_NAMED_MALFORMED.check);
  assert.equal(bad.findings[0].translation, ROWS.RIVALS_NAMED_MALFORMED.translation);
  const m = w.k.rivalStanding({ question: Q, rivals: [H1, H1], viewer: "admin" });
  assert.equal(m.reason, "RIVALS_MALFORMED");
  assert.equal(m.check, ROWS.RIVALS_MALFORMED.check);
  assert.equal(m.translation, ROWS.RIVALS_MALFORMED.translation);
  /* negative control: a well-formed list is not refused and carries no row */
  const ok = w.k.rivalStanding({ question: Q, rivals: [H1], viewer: "admin" });
  assert.equal(ok.ok, true);
  assert.equal("check" in ok, false);
});
