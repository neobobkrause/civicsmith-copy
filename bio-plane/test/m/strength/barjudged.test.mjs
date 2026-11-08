/* R48 (CR2-32; inquiry R91, R92 (3)): strength registers inquiry's bar judgment itself when its factory first builds, and
   answers it with whether the question's live strength meets the project's own bar now. Driven on inquiry's real world
   (its fixture, K4990) with the real strength factory, the real `projectBarSet` and the real `rivalStanding`: nothing
   here registers a stand-in judgment. IV-1's key assumptions (F3) are not yet read. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, inquiryMd, V } from "../inquiry/fixture.mjs";
import { strengthOf } from "../../../src/strength/index.mjs";

const A = "INFO-2026-4801-a", Q = "INQ-2026-4801-q", E = "ENT-2026-4801";
const H1 = "HYP-2026-0001", H2 = "HYP-2026-0002", H3 = "HYP-2026-0003";
const RIVALS = [H1, H2, H3];
const ALICE = V("alice");
const WHY = "Our readers are the council's own auditors.";
/* one leg graded B on each axis: capture B from the capture, connection B from the subject's resolution */
const LEGS = [{ target: A, grade: "B", grade_axis: "capture", grade_source: "capture" },
              { target: A, grade: "B", grade_axis: "connection", grade_source: "resolution" }];
const concluded = (legs = LEGS) => inquiryMd(Q, { subject: E, legs, state: "concluded",
  history: ["  - from_state: open", "    to_state: concluded", '    timestamp: "2026-09-28T00:00:00Z"', "    author: member:alice"],
  extra: ['conclusion: "the budget closed the pool"', 'falsifier: "a budget record showing the pool funded"',
          "rivals_named:", `  - rival: ${H1}`, "    named: case", `  - rival: ${H2}`, "    named: not_case",
          `  - rival: ${H3}`, "    named: neither"] });

function setup({ capture = "B", connection = "B", legs = LEGS } = {}) {
  const w = world(); w.member("alice"); w.entity(E);
  const [cap] = w.doc(A); w.resolve(cap, A, "ref", E, "B");
  w.inquiry(Q, { subject: E, legs });
  const s = strengthOf(w.host, { record: w.record, membership: w.membership, promotion: w.promotion });
  const P = w.project("Pool", "alice");
  w.st.sql.exec(`INSERT OR REPLACE INTO project_participants (project_id, member_id, state, owner, created, updated)
                 VALUES (?, 'alice', 'joined', 1, 't', 't')`, P);
  if (capture || connection) {
    const set = s.projectBarSet({ project: P, capture, connection, reason: WHY, author: "alice", viewer: ALICE });
    assert.equal(set.ok, true, JSON.stringify(set).slice(0, 400));
  }
  const r = w.promote(Q, concluded(legs));
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 400));
  const standing = (project = P) => w.k.rivalStanding({ question: Q, project, rivals: RIVALS, viewer: ALICE });
  return { w, s, P, standing };
}
const by = (r) => Object.fromEntries(r.standings.map((x) => [x.rival, x.standing]));
const NONE = { [H1]: "not_established", [H2]: "not_established", [H3]: "not_established" };

test("R48 the factory registers the bar judgment with inquiry: a conclusion whose strength meets the project's bar moves the rivals it names, through the real rivalStanding", () => {
  const { w, s, P, standing } = setup();
  const pair = s.strengthOf(Q);
  assert.deepEqual([pair.capture.grade, pair.connection.grade], ["B", "B"], "the question reads B on both axes");
  const r = standing();
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 400));
  assert.equal(r.at_bar, true, "strength answered the judgment it registered");
  assert.deepEqual(by(r), { [H1]: "concluded_at_bar", [H2]: "ruled_out_at_bar", [H3]: "not_established" });
  assert.equal(s.barJudged({ question: Q, project: P, viewer: ALICE }), true);
  /* one registration, strength's: another module is refused, naming the holder */
  const other = w.k.onBarJudged("other", () => true);
  assert.equal(other.ok, false);
  assert.equal(other.reason, "LISTENER_DECLARED");
  assert.equal(other.module, "strength");
});

test("R48 a bar above the question's strength, on either axis, is not met: the rivals stay not established", () => {
  for (const bar of [{ capture: "A", connection: "B" }, { capture: "B", connection: "A" }, { capture: null, connection: "A" }]) {
    const { s, P, standing } = setup(bar);
    const r = standing();
    assert.equal(r.at_bar, false, JSON.stringify(bar));
    assert.deepEqual(by(r), NONE, JSON.stringify(bar));
    assert.equal(s.barJudged({ question: Q, project: P, viewer: ALICE }), false);
  }
  /* control: a bar below the strength, on one axis only, is met */
  for (const bar of [{ capture: "C", connection: null }, { capture: null, connection: "B" }]) {
    const { standing } = setup(bar);
    assert.equal(standing().at_bar, true, JSON.stringify(bar));
  }
});

test("R48 an axis the question cannot grade meets no declared bar on it; an absent bar is not a bar of zero", () => {
  /* the question rests on its capture leg only: connection is unrated */
  const capOnly = [LEGS[0]];
  let t = setup({ capture: "C", connection: "C", legs: capOnly });
  assert.equal(t.s.strengthOf(Q).connection.grade, null);
  assert.equal(t.standing().at_bar, false, "an unrated axis does not meet a declared bar");
  t = setup({ capture: "C", connection: null, legs: capOnly });
  assert.equal(t.standing().at_bar, true, "control: the bar declares no connection axis, so it asks none");
  /* no bar declared at all */
  t = setup({ capture: null, connection: null });
  assert.equal(t.s.projectBar(t.P).declared, false);
  assert.equal(t.standing().at_bar, false, "a project declaring no bar is not met by anything");
  assert.deepEqual(by(t.standing()), NONE);
});

test("R48 a project that is absent, unseen, not a project, or not named is judged not met; the judgment never throws", () => {
  const { s, P, standing } = setup();
  assert.equal(standing("PROJ-2026-9999-zzz").at_bar, false, "an absent project");
  assert.equal(standing(A).at_bar, false, "a document is no project");
  assert.equal(standing(null).at_bar, false, "no project named");
  assert.equal(s.barJudged({ question: Q, project: P, viewer: V("dave") }), false, "a project the viewer may not see");
  assert.equal(s.barJudged({ question: Q, project: P, viewer: ALICE }), true, "control: a viewer who sees it");
  assert.equal(s.barJudged(), false);
  assert.equal(s.barJudged({ question: null, project: P }), false);
  assert.equal(s.barJudged({ question: 42, project: { x: 1 } }), false);
  assert.equal(standing().at_bar, true, "control: the project itself");
});
