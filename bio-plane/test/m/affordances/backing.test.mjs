/* affordances: R19's backing — of `op-grades`' rungs (its R1, R3), including those a published act or a terminal state
   backs, and (R24) of the stated absences that ask no reason — for the acts the plane fixture does not reach, each
   driven at its owning module's own interface over that module's fixture: `narrow`, `triage`, layer 9's,
   action-plans', action-holds' (was actions R52's), filing-templates' and local-facts', and (T22) every op DEC-88 bands `reasoned` or
   `terminal` and T22's four new reasoned acts. Everything else R19 drives is in `plane.test.mjs`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, block, version, merge, V } from "../basis-versions/fixture.mjs";
import { seeded, V as IV } from "../intent/fixture.mjs";
import { JUSTIFICATION_REFUSALS, RUNGS, RUNG_ABSENT } from "../../../src/op-grades/index.mjs";

test("R19: narrow, graded `reasoned` (K211), called well-formed but without its account of what changed, is refused "
   + "with a code in JUSTIFICATION_REFUSALS, and with one it is accepted", () => {
  const DOC = "INFO-2026-0001-a", Q2 = "INQ-2026-0002-r", Q = "INQ-2026-0001-q";
  const w = world();
  w.doc(DOC);
  assert.equal(w.inquiry(Q2, block({})).ok, true);
  assert.equal(w.inquiry(Q, block(merge(version("first", [DOC, Q2], { claim: "the claim" }), { grounds: [], legs: [] }))).ok, true);
  const args = { target: Q, version: "first", ord: 0, author: "member:alice", viewer: V("alice"), name: "first narrowed",
                 extent: { extent_kind: "pdf-page", extent_page: "2" } };
  assert.equal(RUNGS.narrow, "reasoned");
  for (const description of [undefined, "", "   "]) {
    const r = w.bv.narrow({ ...args, description });
    assert.ok(JUSTIFICATION_REFUSALS.includes(r.reason), `${JSON.stringify(description)}: ${r.reason}`);
  }
  assert.equal(w.bv.narrow({ ...args, description: "points at page three, where the vote is recorded" }).ok, true);
});

test("R19: triage, graded `reasoned` (K219), is refused without a reason where it sets a proposal down (defer, dismiss), "
   + "and adopting — which revises nothing — asks none (K212)", async () => {
  const w = seeded();
  w.entity("ENT-1"); w.define();
  await w.thread("ENT-1", { need: "A" });
  w.i.registerSource("monitoring", () => [{ key: "c-1", kind: "capture-failed", grade: null, basis: { n: 1 }, instances: [] },
                                          { key: "c-2", kind: "capture-failed", grade: null, basis: { n: 2 }, instances: [] }]);
  assert.equal(RUNGS.triage, "reasoned");
  for (const act of ["defer", "dismiss"])
    for (const reason of [undefined, "", "  "]) {
      const r = w.i.triage({ proposal: "monitoring::c-2", act, reason, author: IV("bob") });
      assert.ok(JUSTIFICATION_REFUSALS.includes(r.reason), `${act} ${JSON.stringify(reason)}: ${r.reason}`);
    }
  assert.equal(w.i.triage({ proposal: "monitoring::c-1", act: "adopt", project: w.P, author: IV("bob"), viewer: IV("bob") }).ok, true);
  assert.equal(w.i.triage({ proposal: "monitoring::c-2", act: "defer", reason: "not now", author: IV("bob"), viewer: IV("bob") }).ok, true);
});

/* Layer 9's six acts graded `reasoned` (K264; their rows restored in T9 with N216), driven at their own modules'
   interfaces over their fixtures. Each is called well-formed but without its reason, then with one; escalationresume,
   graded `reversible`, is taken back by a further suspension. */
import { world as cWorld, V as CV } from "../consequences/fixture.mjs";
import { seeded as escSeeded, opened, toStage, V as EV } from "../escalation/fixture.mjs";

const cScene = () => {
  const S = "STD-2026-0001-law", DOC = "INFO-2026-0001-doc", INQ = "INQ-2026-0001-cause";
  const w = cWorld();
  w.D = w.determination("CONF-2026-0001-act", w.P, { [S]: "noncompliant" });
  w.cid = w.figure(DOC, "Restored 100");
  w.inquiryAt(INQ, "open", { target: DOC });
  w.inquiryAt(INQ, "concluded", { target: DOC, prior: "open" });
  const r = w.c.consequenceRecord({ determination: w.D, standard: S, affected: { kind: "fund", description: "f" },
    period: { from: "2026-01-01", to: "2026-12-31" }, measure: { unit: "money", value: 10 }, basis: { rationale: "r" },
    causation: INQ, author: CV("alice") });
  assert.equal(r.ok, true, JSON.stringify(r));
  w.id = r.id;
  return w;
};
const NO_WHY = [undefined, "", "   "];

test("R19: consequencerevise and addressedrecord, graded `reasoned` (K264), are refused without their reason with a code in "
   + "JUSTIFICATION_REFUSALS, and accepted with one", () => {
  for (const reason of NO_WHY) {
    const w = cScene();
    const rv = w.c.consequenceRevise({ id: w.id, reason, author: CV("alice") });
    assert.ok(JUSTIFICATION_REFUSALS.includes(rv.reason), `revise ${JSON.stringify(reason)}: ${JSON.stringify(rv).slice(0, 200)}`);
    const ad = w.c.addressedRecord({ id: w.id, state: "addressed", evidence: [w.cid], reason, author: CV("alice") });
    assert.ok(JUSTIFICATION_REFUSALS.includes(ad.reason), `addressed ${JSON.stringify(reason)}: ${JSON.stringify(ad).slice(0, 200)}`);
  }
  const w = cScene();
  const ad = w.c.addressedRecord({ id: w.id, state: "addressed", evidence: [w.cid], reason: "the fund was restored", author: CV("alice") });
  assert.equal(ad.ok, true, JSON.stringify(ad));
  const rv = w.c.consequenceRevise({ id: w.id, reason: "the figure was corrected", author: CV("alice") });
  assert.equal(rv.ok, true, JSON.stringify(rv).slice(0, 300));
});

test("R19: escalationevaluate, escalationadvance, escalationdecline and escalationsuspend, graded `reasoned`, are "
   + "refused without their reason with a code in JUSTIFICATION_REFUSALS, and accepted with one", () => {
  const who = { author: EV("bob"), viewer: EV("bob") };
  for (const reason of NO_WHY) {
    const a = escSeeded(); opened(a);
    for (const [op, r] of [["advance", a.esc.escalationAdvance({ id: a.E, to: 2, reason, ...who })],
                           ["decline", a.esc.escalationDecline({ id: a.E, to: 2, reason, ...who })],
                           ["suspend", a.esc.escalationSuspend({ id: a.E, reason, ...who })]])
      assert.ok(JUSTIFICATION_REFUSALS.includes(r.reason), `${op} ${JSON.stringify(reason)}: ${JSON.stringify(r).slice(0, 200)}`);
    const e = escSeeded(); toStage(e, 4);
    const ev = e.esc.escalationEvaluate({ id: e.E, reading: "none", reason, ...who });
    assert.ok(JUSTIFICATION_REFUSALS.includes(ev.reason), `evaluate ${JSON.stringify(reason)}: ${JSON.stringify(ev).slice(0, 200)}`);
  }
  const a = escSeeded(); opened(a);
  assert.equal(a.esc.escalationDecline({ id: a.E, to: 2, reason: "not yet", ...who }).ok, true);
  assert.equal(a.esc.escalationAdvance({ id: a.E, to: 2, reason: "the notice is due", ...who }).ok, true);
  const e = escSeeded(); toStage(e, 4);
  const ev = e.esc.escalationEvaluate({ id: e.E, reading: "none", reason: "no response came", ...who });
  assert.equal(ev.ok, true, JSON.stringify(ev).slice(0, 300));
});

test("R19: escalationresume, graded `reversible` (K264), is taken back by a published act — a further suspension — and "
   + "escalationsuspend, which it takes back, is stated at its higher rung `reasoned`", () => {
  const who = { author: EV("bob"), viewer: EV("bob") };
  const w = escSeeded(); opened(w);
  assert.equal(w.esc.escalationSuspend({ id: w.E, reason: "waiting on counsel", ...who }).ok, true);
  assert.equal(w.esc.escalationResume({ id: w.E, ...who }).ok, true);
  assert.equal(w.esc.escalationRead({ id: w.E, viewer: EV("bob") }).state, "open");
  assert.equal(w.esc.escalationSuspend({ id: w.E, reason: "waiting again", ...who }).ok, true);
  const state = () => w.esc.escalationRead({ id: w.E, viewer: EV("bob") }).state;
  assert.equal(state(), "suspended");
  assert.equal(w.esc.escalationResume({ id: w.E, ...who }).ok, true);
  assert.equal(state(), "open");
});

/* N310 (with conformance's N233): `determine`, graded `reasoned`, driven at conformance's interface over its fixture's
   scene (a published finding and a standard in force). A first determination replaces nothing and asks no reason
   (K212); a supersession, which revises what stands, is refused without its reason and accepted with one. */
import { scene as confScene } from "../conformance/fixture.mjs";

test("R19: determine, graded `reasoned` (N310), superseding a determination without its reason is refused with a code "
   + "in JUSTIFICATION_REFUSALS, and with one it is accepted; a first determination, which replaces nothing, asks none", () => {
  assert.equal(RUNGS.determine, "reasoned");
  const { w, input } = confScene();
  const first = w.c.determine(input());
  assert.equal(first.ok, true, JSON.stringify(first).slice(0, 300));
  for (const reason of NO_WHY) {
    const r = w.c.determine(input({ supersedes: first.id, reason }));
    assert.ok(JUSTIFICATION_REFUSALS.includes(r.reason), `${JSON.stringify(reason)}: ${JSON.stringify(r).slice(0, 200)}`);
  }
  const next = w.c.determine(input({ supersedes: first.id, reason: "a second notice rule applies" }));
  assert.equal(next.ok, true, JSON.stringify(next).slice(0, 300));
});

/* K727 (T18): action-plans' five acts graded `reasoned` and its scenario graded `reversible`, driven at action-plans'
   interface over its fixture (a project, a plan over its subjects, options). */
import { seeded as apSeeded, opened as apOpened, option as apOption, choose as apChoose, by as apBy } from "../action-plans/fixture.mjs";

test("R19: plansubjectadd, plansubjectremove, optionrevise, optiondispose (setting an option down) and planclose, graded "
   + "`reasoned` (K727), are refused without their reason with a code in JUSTIFICATION_REFUSALS, and accepted with one", () => {
  for (const op of ["plansubjectadd", "plansubjectremove", "optionrevise", "optiondispose", "planclose"])
    assert.equal(RUNGS[op], "reasoned", op);
  const scene = () => { const w = apSeeded(); apOpened(w, [w.SI, w.S1]); w.A = apOption(w); return w; };
  const acts = {
    plansubjectadd: (w, reason) => w.ap.planSubjectAdd({ plan: w.PL, subject: w.S3, reason, ...apBy("bob") }),
    plansubjectremove: (w, reason) => w.ap.planSubjectRemove({ plan: w.PL, subject: w.S1, reason, ...apBy("bob") }),
    optionrevise: (w, reason) => w.ap.optionRevise({ plan: w.PL, option: w.A, summary: "Write again", reason, ...apBy("bob") }),
    optiondispose: (w, reason) => w.ap.optionDispose({ plan: w.PL, options: [w.A], disposition: "declined", reason, ...apBy("bob") }),
    planclose: (w, reason) => w.ap.planClose({ id: w.PL, reason, ...apBy("bob") }),
  };
  for (const [op, act] of Object.entries(acts)) {
    for (const reason of NO_WHY) {
      const r = act(scene(), reason);
      assert.ok(JUSTIFICATION_REFUSALS.includes(r.reason ?? r.code), `${op} ${JSON.stringify(reason)}: ${JSON.stringify(r).slice(0, 200)}`);
    }
    const ok = act(scene(), "the group decided so at its meeting");
    assert.equal(ok.ok, true, `${op}: ${JSON.stringify(ok).slice(0, 300)}`);
  }
  /* optiondispose asks no reason where it revises nothing that stands (choosing), K212 */
  const w = scene();
  assert.equal(w.ap.optionDispose({ plan: w.PL, options: [w.A], disposition: "chosen", ...apBy("bob") }).ok, true);
});

test("R19: scenarioset, graded `reversible` (K727), asks no reason and is taken back by a published act — a further "
   + "scenarioset replaces it whole, the earlier version kept in history", () => {
  assert.equal(RUNGS.scenarioset, "reversible");
  const w = apSeeded(); apOpened(w); const A = apOption(w); apChoose(w, [A]);
  const phases = [{ id: "ask", name: "Ask", options: [A], starts: "plan_start" }];
  assert.equal(w.ap.scenarioSet({ plan: w.PL, scenario: 1, name: "First line", phases, ...apBy("bob") }).ok, true);
  assert.equal(w.ap.scenarioSet({ plan: w.PL, scenario: 1, name: "Second line", phases, ...apBy("bob") }).ok, true);
  const sc = w.ap.planRead({ id: w.PL, nowMs: Date.now(), viewer: "member:bob" }).scenarios.find((s) => s.scenario === 1);
  assert.deepEqual([sc.name, sc.version], ["Second line", 2]);
  assert.ok(sc.history.some((h) => h.name === "First line"), "the earlier version is kept");
});

/* K918 (T20): the hold statement (`action-holds` R2, moved from actions R52 in T45, K2781 (1)), graded `reasoned`, driven
   at action-holds' interface over its fixture: on a `legal` pressure mark, a hold stated well-formed but without its
   reason is refused HOLD_REFUSED, in the justification family, and with one it is accepted; a later statement corrects
   it forward, the earlier kept. Since DEC-113 (T27) a release is its own act (op-grades R8, action-holds R5), so
   `actionhold` is driven `in_place` only and the release through `actionHoldRelease`. */
import { world as hWorld, V as HV, received as hReceived } from "../action-holds/fixture.mjs";
/* With `inProject`, the action sits in a project alice owns, so a hold covers it (action-holds R2). */
const holdScene = ({ inProject = false } = {}) => {
  const w = hWorld(), A = "ACTN-2026-0001-a", M = HV("alice");
  const P = inProject ? w.project("alice") : null;
  w.action(A, [...(P ? [`project: ${P}`] : []), ...hReceived(1)]);
  w.mark(A, 0, "legal", M, "a threatened suit");
  return { w, A, M, P };
};
const holdsAt = (w, A, M) => w.h.holdsOf({ target: A, ord: 0, viewer: M }).holds.map((h) => h.hold);
test("R19: actionhold, graded `reasoned` (K918), is refused without its reason on a legal pressure mark, with a code "
   + "in JUSTIFICATION_REFUSALS, and accepted with one; a later statement corrects it forward, the earlier kept", () => {
  const { w, A, M } = holdScene();
  assert.equal(RUNGS.actionhold, "reasoned");
  for (const reason of [undefined, null, "", "   "]) {
    const before = dump(sqlOf(w));
    const r = w.h.actionHold({ target: A, ord: 0, hold: "in_place", reason, viewer: M, author: M });
    assert.equal(r.reason, "HOLD_REFUSED", JSON.stringify(reason));
    assert.ok(JUSTIFICATION_REFUSALS.includes(r.reason));
    assert.equal(dump(sqlOf(w)), before, "nothing written");
  }
  assert.equal(w.h.actionHold({ target: A, ord: 0, hold: "in_place", reason: "preserving the emails", viewer: M, author: M }).ok, true);
  assert.equal(w.h.actionHold({ target: A, ord: 0, hold: "in_place", reason: "and the texts", viewer: M, author: M }).ok, true);
  assert.deepEqual(holdsAt(w, A, M), ["in_place", "in_place"]);
});

/* op-grades R8 (DEC-113; K1134 (3); action-holds R5, R6, was actions R56, R57): the release, graded `terminal` as a named
   exception to op-grades R3, driven at action-holds' interface. Its reason is backed by HOLD_REFUSED as `actionhold`'s is
   (in the justification family, nothing written). Its rung by what it does: it records, with the release, the projects
   it restarted (what R6's preview answered at that instant, the statement's projects); once released, the hold is not
   released again (HOLD_ALREADY_RELEASED), and the restarted projects stand released — no act takes a release back into
   the same hold: a later `in_place` is a new hold, stated anew, and the release stays in the record. */
test("R19: actionholdrelease, graded `terminal` (K1134), is refused without its reason (HOLD_REFUSED, in the family) and "
   + "writes nothing; with one it records what it restarted — R57's answer — and cannot be walked back: released again is "
   + "refused HOLD_ALREADY_RELEASED, and the release stays in the record under any later hold", () => {
  assert.equal(RUNGS.actionholdrelease, "terminal");
  const { w, A, M, P } = holdScene({ inProject: true });
  assert.equal(w.h.actionHold({ target: A, ord: 0, hold: "in_place", reason: "preserving the emails", viewer: M, author: M }).ok, true);
  for (const reason of [undefined, null, "", "   "]) {
    const before = dump(sqlOf(w));
    const r = w.h.actionHoldRelease({ target: A, ord: 0, reason, viewer: M, author: M });
    assert.equal(r.reason, "HOLD_REFUSED", JSON.stringify(reason));
    assert.ok(JUSTIFICATION_REFUSALS.includes(r.reason));
    assert.equal(dump(sqlOf(w)), before, "nothing written");
  }
  const preview = w.h.holdReleasePreview({ target: A, ord: 0, viewer: M });
  assert.equal(preview.ok, true, JSON.stringify(preview).slice(0, 300));
  const rel = w.h.actionHoldRelease({ target: A, ord: 0, reason: "the claim was withdrawn", viewer: M, author: M });
  assert.deepEqual([rel.ok, rel.hold], [true, "released"], JSON.stringify(rel).slice(0, 300));
  assert.deepEqual(preview.restarts, [P], "the hold covers the action's own project, and nothing else holds it");
  assert.deepEqual(rel.restarted, preview.restarts, "the release records what the preview said it would restart");
  assert.deepEqual(w.h.holdReleasePreview({ target: A, ord: 0, viewer: M }).restarts, [], "released, it restarts nothing more");
  const again = w.h.actionHoldRelease({ target: A, ord: 0, reason: "once more", viewer: M, author: M });
  assert.equal(again.reason, "HOLD_ALREADY_RELEASED", JSON.stringify(again).slice(0, 300));
  /* a later hold is stated anew; the release stays */
  assert.equal(w.h.actionHold({ target: A, ord: 0, hold: "in_place", reason: "a new threat", viewer: M, author: M }).ok, true);
  assert.deepEqual(holdsAt(w, A, M), ["in_place", "released", "in_place"]);
});

/* R34 (DEC-116, N520): the docket's two reasoned acts and its attested post, driven at docket's interface over its
   fixture (real record-core, membership, credentials, promotion, provenance, publication tables and signatures). */
import * as dk from "../docket/fixture.mjs";
test("R19 R34: docketfile and docketdecline, graded `reasoned`, are refused without their reason with DOCKET_NO_REASON "
   + "(in the family) and write nothing — the filing, its take-back and the manager's decline — and are accepted with one", () => {
  for (const op of ["docketfile", "docketdecline"]) assert.equal(RUNGS[op], "reasoned", op);
  const bad = [];
  const check = (label, w, act) => {
    const before = dump(w.st.sql);
    const r = act();
    if (!(r && r.ok !== true && r.reason === "DOCKET_NO_REASON" && JUSTIFICATION_REFUSALS.includes(r.reason))) bad.push(`${label}: ${JSON.stringify(r).slice(0, 200)}`);
    else if (dump(w.st.sql) !== before) bad.push(`${label}: refused, but wrote`);
  };
  for (const reason of [undefined, null, "", "   "]) {
    const w = dk.seeded();
    check(`file ${JSON.stringify(reason)}`, w, () => dk.file(w, { reason }));
    const f = dk.file(w);
    assert.equal(f.ok, true, JSON.stringify(f).slice(0, 300));
    check(`take back ${JSON.stringify(reason)}`, w, () => dk.file(w, { takesBack: f.entry, reason }));
    check(`decline ${JSON.stringify(reason)}`, w, () => w.docket.docketDecline({ entry: f.entry, reason, by: dk.V("alice"), viewer: dk.V("alice") }));
  }
  assert.deepEqual(bad, []);
  const w = dk.seeded();
  const f = dk.file(w);
  assert.equal(f.ok, true);
  const d = w.docket.docketDecline({ entry: f.entry, reason: "It contains redactions.", by: dk.V("alice"), viewer: dk.V("alice") });
  assert.equal(d.ok, true, JSON.stringify(d).slice(0, 300));
  const g = dk.file(w);
  const t = dk.file(w, { takesBack: g.entry, reason: "filed in error" });
  assert.equal(t.ok, true, JSON.stringify(t).slice(0, 300));
});

test("R19: docketpost, graded `attested` (DEC-116), publishes only under the manager's own registered signature over the "
   + "prepared statement — another member's key, or a signature over other bytes, is refused DOCKET_SIGNATURE_REFUSED "
   + "and writes nothing; signed by the manager, it is posted", async () => {
  assert.equal(RUNGS.docketpost, "attested");
  const w = dk.seeded();
  const f = dk.file(w);
  assert.equal(f.ok, true);
  const p = dk.prepare(w, { kind: "response", entry: f.entry });
  assert.equal(p.ok, true, JSON.stringify(p).slice(0, 300));
  const before = dump(w.st.sql);
  for (const signature of [dk.sign(p, "bob"), dk.sign({ statement: p.statement + " " }, "alice")]) {
    const r = await w.docket.docketPost({ digest: p.digest, signature, acknowledged: true, by: dk.V("alice"), viewer: dk.V("alice") });
    assert.equal(r.reason, "DOCKET_SIGNATURE_REFUSED", JSON.stringify(r).slice(0, 300));
  }
  assert.equal(dump(w.st.sql), before, "nothing written");
  const ok = await w.docket.docketPost({ digest: p.digest, signature: dk.sign(p, "alice"), acknowledged: true, by: dk.V("alice"), viewer: dk.V("alice") });
  assert.equal(ok.ok, true, JSON.stringify(ok).slice(0, 300));
});

/* R30 (K921, T21): `templateretire` and `factconfirm`, graded `reasoned`, driven at filing-templates' and local-facts'
   own interfaces over their fixtures (real record-core, membership and jurisdiction profiles). Each is called
   well-formed but without its account, then with one. */
import * as ft from "../filing-templates/fixture.mjs";
import * as lf from "../local-facts/fixture.mjs";
import { LOCAL_FACT_ACTS } from "../../../src/local-facts/index.mjs";

test("R19 R30: templateretire, graded `reasoned`, is refused without its reason with a code in JUSTIFICATION_REFUSALS "
   + "— retiring a whole template by an approver, and withdrawing a draft by its author — and accepted with one", () => {
  assert.equal(RUNGS.templateretire, "reasoned");
  for (const reason of [undefined, null, "", "   "]) {
    const w = ft.seeded();
    const a = ft.approved(w);
    const whole = w.ft.templateRetire({ template: a.template, reason, by: ft.V("bob"), viewer: ft.V("bob") });
    assert.ok(JUSTIFICATION_REFUSALS.includes(whole.reason), `retire ${JSON.stringify(reason)}: ${JSON.stringify(whole).slice(0, 200)}`);
    const d = ft.draft(w, { name: "Another ask" });
    const one = w.ft.templateRetire({ template: d.template, version: d.version, reason, by: ft.V("alice"), viewer: ft.V("alice") });
    assert.ok(JUSTIFICATION_REFUSALS.includes(one.reason), `withdraw ${JSON.stringify(reason)}: ${JSON.stringify(one).slice(0, 200)}`);
  }
  const w = ft.seeded();
  const a = ft.approved(w);
  const ok = w.ft.templateRetire({ template: a.template, reason: "the law it relied on was repealed", by: ft.V("bob"), viewer: ft.V("bob") });
  assert.equal(ok.ok, true, JSON.stringify(ok).slice(0, 300));
  const d = ft.draft(w, { name: "Another ask" });
  const wd = w.ft.templateRetire({ template: d.template, version: d.version, reason: "drafted in error", by: ft.V("alice"), viewer: ft.V("alice") });
  assert.equal(wd.ok, true, JSON.stringify(wd).slice(0, 300));
});

test("R19 R30: factconfirm, graded `reasoned`, is refused without how the member checked, for each of its three acts, "
   + "with a code in JUSTIFICATION_REFUSALS, and accepted with it; a later act supersedes it on read", () => {
  assert.equal(RUNGS.factconfirm, "reasoned");
  const w = lf.world();
  const fields = (act) => (act === "correct" ? { value: w.status(lf.P.tz).profile.value, source: "the office's posted notice" } : {});
  for (const act of LOCAL_FACT_ACTS)
    for (const how of [undefined, null, "", "   "]) {
      const r = w.act(lf.P.tz, act, { ...fields(act), how });
      assert.ok(JUSTIFICATION_REFUSALS.includes(r.reason), `${act} ${JSON.stringify(how)}: ${JSON.stringify(r).slice(0, 200)}`);
    }
  for (const act of LOCAL_FACT_ACTS)
    assert.equal(w.act(lf.P.tz, act, { ...fields(act), how: "called the clerk's office" }).ok, true, act);
  assert.equal(w.status(lf.P.tz).status, "disputed", "the latest act, a dispute, governs on read");
  assert.equal(w.act(lf.P.tz, "confirm", { how: "checked the posted notice again" }).ok, true);
  assert.equal(w.status(lf.P.tz).status, "confirmed", "and a later confirmation supersedes it");
});

/* ============================================================ DEC-88 (K1038) and T22's four (K1019, K1023)
   R19's backing for every op DEC-88 banded `reasoned` and for T22's four new reasoned acts, each driven at its owning
   module's own interface over that module's fixture: called well-formed but without its authored reason (absent,
   empty, blank), it is refused with a code in JUSTIFICATION_REFUSALS and nothing is written to the record's tables; with
   the reason, it is accepted. Four acts' own words are their reason (`testify`, `transcribe`, `lead`, `goaldeclare`),
   refused absent (R19). K1025's four, whose grounds serve, follow in the tests after this block. */
import * as provFix from "../provenance/fixture.mjs";
import * as contentFix from "../content/fixture.mjs";
import * as obsFix from "../observation-log/fixture.mjs";
import * as entFix from "../entities/fixture.mjs";
import * as progFix from "../progressions/fixture.mjs";
import * as biasFix from "../bias/world.mjs";
import * as strengthFix from "../strength/fixture.mjs";
import * as reevalFix from "../reevaluation/fixture.mjs";
import * as intentFix from "../intent/fixture.mjs";
import * as pubFix from "../publication/fixture.mjs";
import * as caFix from "../case-authoring/fixture.mjs";
import * as stdFix from "../standards/fixture.mjs";
import * as filFix from "../filings/fixture.mjs";
import * as escFix from "../escalation/fixture.mjs";
import * as capFix from "../capture/fixture.mjs";
import * as monFix from "../monitoring/fixture.mjs";
/* T42 (N826; K2656): `inboxresolve` is driven at `doorbell`'s interface (its R3), never capture's copy (deleted T43) */
import * as dbFix from "../doorbell/fixture.mjs";

const WHYLESS = [undefined, "", "   "];
const sqlOf = (w) => w.st?.sql ?? w.s?.sql ?? w.sql ?? w.storage?.sql;
const dump = (sql) => JSON.stringify([...sql.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
  .map(({ name }) => [name, [...sql.exec(`SELECT * FROM "${name}"`)]]));

/* Each case: `scene()` builds the module's world and answers `{ w, act(why) }`, `act` calling the method with `why` in
   the field that carries the act's reason (or its own words). */
const intentMeasured = async () => {
  const w = intentFix.seeded();
  w.entity("ENT-1"); w.entity("ENT-2"); w.relate("ENT-2", "ENT-1", "member_of"); w.define();
  await w.thread("ENT-1", { need: "A", award: "B" }); await w.thread("ENT-2", { award: "C" });
  return w;
};
const capHeld = () => {
  const f = capFix.fresh();
  const s = f.s;
  s.sql.exec(`INSERT INTO members (member_id, cover, role, status, created, updated) VALUES ('m1', 'c', 'member', 'active', '2026-01-01', '2026-01-01')`);
  s.sql.exec(`INSERT INTO bundles (bundle_id, object_type, group_id, title, current_state, prior_state, created, last_updated, bundle_sha, row_version, project)
              VALUES ('INFO-1', 'information', 'g', 'title INFO-1', 'collected', NULL, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 'x', 1, NULL)`);
  s.sql.exec(`INSERT INTO register (capture_sha, bundle_id, path) VALUES (?, 'INFO-1', 'x')`, capFix.H("1"));
  return f;
};
const MON_ADDR = "https://records.example.org/agenda", MON_P = "PROJ-2026-0400-p";
const monOwned = () => {
  const w = monFix.world();
  w.inProject(MON_P, { owner: "carol" });
  const a = w.monitored("INFO-2026-0400-a", MON_ADDR, "agenda v1", { freq: "weekly", lines: [`project: ${MON_P}`] });
  w.prov.recordReceipt({ address: MON_ADDR, addressNorm: MON_ADDR, captureSha: a.cap, retrieved: "2026-09-01T00:00:00Z",
    via: "direct", retrievalLocator: MON_ADDR, context: { authorityKind: "sweep", authority: "x", actorClass: "plane", actor: null, observe: false } });
  return w;
};

const REASONED_CASES = {
  testify: () => { const w = provFix.world();
    return { w, act: (why) => w.prov.testify({ words: why, observedAt: "2026-09-20", author: provFix.V("ruth") }) }; },
  transcribe: () => { const w = contentFix.world(); const a = w.cap("a"); w.doc("INFO-2026-0001-a", [a]); w.read(a.sha, { pageCount: 3 });
    return { w, act: (why) => w.content.transcribe({ bundleId: "INFO-2026-0001-a", extent: { kind: "pdf-page", page: 1 }, text: why,
      transcriber: contentFix.V("ty"), viewer: contentFix.V("ty") }) }; },
  transcriptionattest: () => { const w = contentFix.world(); const a = w.cap("a"); w.doc("INFO-2026-0001-a", [a]); w.read(a.sha, { pageCount: 3 });
    const t = w.content.transcribe({ bundleId: "INFO-2026-0001-a", extent: { kind: "pdf-page", page: 1 }, text: "In the year 1921",
      transcriber: contentFix.V("ty"), viewer: contentFix.V("ty") });
    assert.equal(t.ok, true, JSON.stringify(t).slice(0, 300));
    return { w, act: (why) => w.content.transcriptionAttest({ contentId: t.content_id, note: why, attestor: contentFix.V("zo"), viewer: contentFix.V("zo") }) }; },
  attesttext: () => { const w = contentFix.world(); const a = w.cap("a"); w.doc("INFO-2026-0001-a", [a]);
    w.read(a.sha, { pageCount: 3, chain: [{ step: "layer", tier: 1 }, { step: "ocr", engine: "t", version: "1", cap: "C", measured_by: "m" }] });
    return { w, act: (why) => w.content.attestText({ captureSha: a.sha, note: why, viewer: contentFix.V("bo"), member: contentFix.V("cy"), extent: { kind: "page", page: 1 } }) }; },
  lead: () => { const w = obsFix.world();
    return { w, act: (why) => w.obs.lead({ words: why, author: "alice" }) }; },
  leadlook: () => { const w = obsFix.world(); w.project("PROJ-A"); w.participant("PROJ-A", "alice");
    const L = w.obs.lead({ words: "the words", author: "alice" }).lead_id;
    return { w, act: (why) => w.obs.leadLook({ lead: L, state: "LOOKED_ABSENT", detail: why, looker: "alice", viewer: obsFix.V("alice") }) }; },
  leadshare: () => { const w = obsFix.world(); w.project("PROJ-A"); w.participant("PROJ-A", "alice");
    const L = w.obs.lead({ words: "the words", author: "alice" }).lead_id;
    return { w, act: (why) => w.obs.leadShare({ lead: L, project: "PROJ-A", reason: why, sharer: "alice", viewer: obsFix.V("alice") }) }; },
  entitycreate: () => { const w = entFix.world();
    return { w, act: (why) => w.e.createEntity({ kind: "body", label: "Port Board", note: why, declaredBy: "member:ann" }) }; },
  resolvetestify: () => { const w = entFix.world();
    const ent = w.e.createEntity({ note: "a subject the test registers", kind: "person", label: "Pat" }).entity_id;
    w.read("INFO-1", entFix.sha("r12"), [{ kind: "x", key: "1", label: "unrelated" }]);
    return { w, act: (why) => w.e.testify({ captureSha: entFix.sha("r12"), ref: "x:1", entityId: ent, basis: why, resolvedBy: "member:ann" }) }; },
  progressiondefine: () => { const w = progFix.world();
    const S = (o = {}) => ({ key: "a", cardinality: "1", required: "always", ...o });
    return { w, act: (why) => w.p.defineProgression({ progressionKey: "k", label: "L", stages: [S(), S({ key: "b", after: "a" })],
      declaredBy: "member:alice", citation: "Ord. 1", basis: why }) }; },
  biasadopt: async () => { const w = biasFix.world(); await w.group("mo", "owner", "joiner");
    w.set("BIAS-2026-0001-a", [biasFix.S("s1")], "adopted", {});
    return { w, act: (why) => w.bias.biasAdopt({ bundleId: "BIAS-2026-0001-a", reason: why, author: "admin", identity: "member:admin",
      viewer: "admin", at: biasFix.T0 }) }; },
  strengthbar: () => { const w = strengthFix.world(); w.member(strengthFix.ADMIN, "admin");
    return { w, act: (why) => w.s.strengthBarSet({ reason: why, capture: "B", author: strengthFix.ADMIN }) }; },
  versionadopt: () => { const w = reevalFix.world(); const { U } = reevalFix;
    const OLD = "INFO-2026-0001-old", NEW = "INFO-2026-0002-new";
    const a = w.cap("a", "old"), b = w.cap("b", "new");
    w.doc(OLD, [a]); w.doc(NEW, [b]);
    w.read(a.sha, [U(0, "alpha"), U(1, "the budget was cut")]); w.read(b.sha, [U(0, "alpha"), U(1, "something else entirely")]);
    w.at(a.sha, "ex.org/doc", "2026-09-01T00:00:00Z"); w.at(b.sha, "ex.org/doc", "2026-09-20T00:00:00Z");
    const cid = w.passage(OLD, a.sha);
    w.inquiry("INQ-2026-0001-q", { legs: [{ target: OLD, content_id: cid }, { target: NEW }] });
    const [n] = w.r.raiseNotices({}).raised;
    return { w, act: (why) => w.r.adoptVersion({ notice: n.notice, why, author: "alice", viewer: "class:admin" }) }; },
  goaldeclare: () => { const w = intentFix.seeded();
    return { w, act: (why) => w.i.declareGoal({ statement: why, bounds: "the 2026 procurement cycle", author: intentFix.V("bob") }) }; },
  aspirationdeclare: () => { const w = intentFix.seeded();
    return { w, act: (why) => w.i.declareAspiration({ scope: "member", owner: "bob", statement: why, author: intentFix.V("bob") }) }; },
  aspirationdeadend: () => { const w = intentFix.seeded();
    const a = w.i.declareAspiration({ scope: "project", owner: w.P, statement: "Name every signatory", author: intentFix.V("bob") }).aspiration;
    return { w, act: (why) => w.i.recordDeadEnd({ aspiration: a, note: why, author: intentFix.V("bob") }) }; },
  objectivecondition: async () => { const w = await intentMeasured();
    return { w, act: (why) => w.i.setCondition({ project: w.P, condition: intentFix.COND, reason: why, author: intentFix.V("bob"), viewer: intentFix.V("bob") }) }; },
  workobjective: async () => { const w = await intentMeasured();
    assert.equal(w.i.setCondition({ reason: "Measured by the record.", project: w.P, condition: { ...intentFix.COND, relation: "member_of" },
      author: intentFix.V("bob"), viewer: intentFix.V("bob") }).ok, true);
    return { w, act: (why) => w.i.workObjective({ reason: why, project: w.P, author: intentFix.V("bob"), viewer: intentFix.V("bob"),
      run: { run: "R-1", principalPlane: "member:bob/tok", principalClaude: "acct", skillVersion: "bio-pack@3",
             bounds: [{ bound: "fetches", allowed: 10 }], contextType: "inquiry", contextId: "INQ-X" } }) }; },
  attribute: () => { const w = pubFix.planeWorld(); w.member("olive"); w.member("ann"); w.member("bo");
    const proj = w.project("Parks", "olive"); const obs = w.observe("ann");
    w.inquiry("INQ-2026-0001", { legs: [{ target: obs }] });
    w.prepare("CASE-2026-0001", 1, { project: proj, roles: [{ target: "INQ-2026-0001", version_sha: w.head("INQ-2026-0001") }], attributions: [{ observation: obs }] });
    return { w, act: (why) => w.op("attribute", { by: "ann" }, { caseId: "CASE-2026-0001", edition: 1, observation: obs, level: "group", reason: why }) }; },
  statementack: () => { const w = caFix.world();
    for (const m of ["alice", "bo"]) w.member(m);
    w.doc("INFO-2026-0001-a"); w.finding("INQ-2026-0001-q", [{ target: "INFO-2026-0001-a" }]);
    const P = w.project("Team", "alice", ["INQ-2026-0001-q"]); w.join(P, "bo");
    const pub = w.publish(P, "alice", ["INQ-2026-0001-q"]);
    /* T47 (N908 §5): the acknowledgement is case-inputs' since the split (K3116), driven on the real case-inputs the fixture
       builds beside case-authoring (`w.ci`) */
    return { w, act: (why) => w.ci.acknowledgeStatement({ viewer: caFix.V("bo"), caseId: pub.caseId, edition: 1, reason: why }) }; },
  standarddeclare: () => { const w = stdFix.seeded(); const p = w.passage().contentId;
    return { w, act: (why) => w.s.standardDeclare({ cite: stdFix.BYLAW, kind: "ordinance", issuer: "Port Ellery Selectboard", reason: why,
      text: [p], author: stdFix.V("bob"), viewer: stdFix.V("bob") }) }; },
  standardadopt: () => { const w = stdFix.seeded(); const text = w.passage().contentId;
    const p = w.s.standardPropose({ cite: stdFix.BYLAW, kind: "ordinance", issuer: "Port Ellery Selectboard", text: [text],
      why: "It governs the permits named in the act.", proposer: stdFix.V("carol") }).proposal;
    return { w, act: (why) => w.s.standardAdopt({ proposal: p.id, reason: why, author: stdFix.V("bob"), viewer: stdFix.V("bob") }) }; },
  counselpacket: () => { const w = filFix.world(); const A = w.action({ kind: "commitment_claim" });
    return { w, act: (why) => w.f.counselPacket({ reason: why, action: A, counsel: { name: "A. Counsel", organisation: "Test Chambers" },
      author: filFix.V("olive"), viewer: filFix.V("olive") }) }; },
  escalationopen: () => { const w = escFix.seeded();
    return { w, act: (why) => w.esc.escalationOpen({ determination: w.D, reason: why, author: escFix.V("bob"), viewer: escFix.V("bob") }) }; },
  escalationattach: () => { const w = escFix.seeded(); escFix.toStage(w, 2); const a = w.action({ project: w.P, restsOn: [w.D] });
    return { w, act: (why) => w.esc.escalationAttach({ id: w.E, action: a, reason: why, author: escFix.V("bob"), viewer: escFix.V("bob") }) }; },
  inboxresolve: async () => { const f = dbFix.fresh({ evidence: dbFix.bucket(), env: { INSTANCE_NAME: "inst" } });
    const k = await f.c.knock({ content: "a tip", sourceAddress: "1.1.1.1" });
    return { w: f, act: (why) => f.c.inboxResolve({ knockId: k.knockId, status: "discarded", by: "member:m1", reason: why }) }; },
  /* T22's four */
  declinetoescalate: () => { const w = escFix.seeded();
    return { w, act: (why) => w.esc.declineToEscalate({ determination: w.D, reason: why, author: escFix.V("bob"), viewer: escFix.V("bob") }) }; },
  heldsetaside: () => { const f = capHeld();
    return { w: f, act: (why) => f.c.setAside({ ids: ["INFO-1"], reason: why, author: "member:m1", viewer: "member:m1" }) }; },
  heldrestore: () => { const f = capHeld();
    assert.equal(f.c.setAside({ ids: ["INFO-1"], reason: "not ours to hold", author: "member:m1", viewer: "member:m1" }).ok, true);
    return { w: f, act: (why) => f.c.restoreHeld({ ids: ["INFO-1"], reason: why, author: "member:m1", viewer: "member:m1" }) }; },
  addressfrequencyset: () => { const w = monOwned();
    return { w, act: (why) => w.m.addressFrequencySet({ address: MON_ADDR, frequency: "daily", reason: why === undefined ? undefined : "custom",
      reasonText: why, author: "carol", viewer: monFix.V("carol") }) }; },
};
/* What a reasoned act is given when it is given its reason: its owner's own word for it. `addressfrequencyset` takes a
   canned reason or `custom` with the member's words; `custom` with none is refused as an absent reason. */
const GIVEN = "the member's own account of why";
/* The code each owner answers, as RUNGS' comments name it (read from each module's checks: catalogue.test.mjs's R19). */
const CODE = { testify: "TESTIMONY_NO_WORDS", transcribe: "TRANSCRIBE_NO_TEXT", transcriptionattest: "ATTEST_NO_NOTE",
  attesttext: "ATTEST_NO_NOTE", lead: "LEAD_NO_WORDS", leadlook: "LEAD_LOOK_NO_DETAIL", leadshare: "LEAD_SHARE_NO_REASON",
  entitycreate: "ENTITY_NO_NOTE", resolvetestify: "NO_BASIS", progressiondefine: "NO_BASIS", biasadopt: "BIAS_ADOPTION_NO_REASON",
  strengthbar: "BAR_NO_REASON", versionadopt: "VERSION_ADOPT_NO_REASON", goaldeclare: "PURSUIT_UNSTATED",
  aspirationdeclare: "PURSUIT_UNSTATED", aspirationdeadend: "NO_NOTE", objectivecondition: "INTENT_NO_REASON",
  workobjective: "INTENT_NO_REASON", attribute: "ATTRIBUTION_NO_REASON", statementack: "STATEMENT_ACK_NO_REASON",
  standarddeclare: "STANDARD_NO_REASON", standardadopt: "STANDARD_NO_REASON", counselpacket: "PACKET_NO_REASON",
  escalationopen: "ESCALATION_NO_REASON", escalationattach: "ESCALATION_NO_REASON", inboxresolve: "RESOLVE_NO_REASON",
  declinetoescalate: "ESCALATION_NO_REASON", heldsetaside: "SET_ASIDE_NO_REASON", heldrestore: "SET_ASIDE_NO_REASON",
  addressfrequencyset: "FREQUENCY_NO_REASON" };

test("R19: every op DEC-88 bands `reasoned` and T22's four, called well-formed without its authored reason (or "
   + "words), is refused with a code in JUSTIFICATION_REFUSALS and writes nothing; given one, it is accepted", async () => {
  const want = [...Object.keys(REASONED_CASES)].sort();
  assert.deepEqual(want, Object.keys(CODE).sort(), "every reasoned op that asks a reason has its case and its code here");
  for (const op of want) assert.equal(RUNGS[op], "reasoned", op);
  const bad = [];
  for (const op of want) {
    for (const why of WHYLESS) {
      const { w, act } = await REASONED_CASES[op]();
      const sql = sqlOf(w);
      assert.ok(sql, `${op}: the fixture's record`);
      const before = dump(sql);
      const r = await act(why);
      const code = r?.reason ?? r?.code;
      if (!(r && r.ok !== true && JUSTIFICATION_REFUSALS.includes(code) && code === CODE[op])) bad.push(`${op} ${JSON.stringify(why)}: ${JSON.stringify(r).slice(0, 200)}`);
      else if (dump(sql) !== before) bad.push(`${op} ${JSON.stringify(why)}: refused, but wrote`);
    }
    const { act } = await REASONED_CASES[op]();
    const ok = await act(GIVEN);
    if (!(ok && (ok.ok === true || ok.started === true))) bad.push(`${op} with its reason: ${JSON.stringify(ok).slice(0, 300)}`);
  }
  assert.deepEqual(bad, []);
});

/* K3152 (T47): `adminremove` is one of `REAUTH_ACTS` since op-declarations R58, so the plane asks for the password again
   (credentials R66, admission R25) before it routes the act, and that question is not routed to the store until the
   plane's L11 job; its reason refusal is driven here at membership's own interface (its R7), as the other owners' are.
   (T53; membership R154, notice membership:77; member-roster R84, R87) The founder's endorsement alone now issues an
   administrator's invitation and her removal now carries alone, so the third administrator is proposed by `second` and
   issued by the founder, and the removal that carries is the founder's; a vote by `second` is still refused without its
   reason. */
import { world as memWorld } from "../membership/fixture.mjs";
test("R19: membership's adminremove, graded `reasoned`, is refused without the administrator's reason with NO_REASON "
   + "(membership R7), in JUSTIFICATION_REFUSALS, writing nothing, whoever removes, and the founder's removal is accepted with it", async () => {
  assert.equal(RUNGS.adminremove, "reasoned");
  /* three administrators (admin, second, third) */
  const scene = async () => {
    const w = await memWorld().group();
    assert.equal((await w.m.memberAdd({ memberId: "third", cover: "c3", role: "admin", by: "second" })).reason, "CONSENSUS_REQUIRED");
    const e = await w.m.adminEndorse({ memberId: "third", by: "admin" });
    assert.equal((await w.m.enroll({ invite: e.invite, handle: "third", password: "third-passphrase-x" })).ok, true);
    return w;
  };
  for (const by of ["admin", "second"]) for (const why of WHYLESS) {
    const w = await scene();
    const before = dump(w.sql);
    const r = w.m.adminRemove({ memberId: "third", by, ...(why === undefined ? {} : { reason: why }) });
    assert.equal(r.ok, false, `${by} ${JSON.stringify(why)}`);
    assert.equal(r.reason, "NO_REASON", JSON.stringify(r).slice(0, 200));
    assert.ok(JUSTIFICATION_REFUSALS.includes(r.reason));
    assert.equal(dump(w.sql), before, `${by} ${JSON.stringify(why)}: refused, but wrote`);
  }
  const w = await scene();
  const ok = w.m.adminRemove({ memberId: "third", by: "admin", reason: GIVEN });
  assert.equal(ok.ok, true, JSON.stringify(ok).slice(0, 300));
});

/* K1025's four (R19): an act op-grades R1 bands `reasoned` whose recorded grounds serve as its reason is backed by those grounds
   and is not refused for a reason it does not take. Each is driven at its owner's interface: refused, with nothing
   written, where the grounds are absent; accepted with its grounds and no further reason. */
import * as conFix from "../consequences/fixture.mjs";
import * as actFix from "../actions/fixture.mjs";

test("R19: resolve is backed by its recorded grounds — each resolution it writes records its `basis` (the matched "
   + "string) and its `method`, on every tier — and takes no reason", () => {
  assert.equal(RUNGS.resolve, "reasoned");
  const w = entFix.world();
  w.e.createEntity({ note: "a subject the test registers", kind: "office", label: "Harbour Office" });
  w.read("INFO-1", entFix.sha("r9"), [{ kind: "doc", key: "9", label: "harbour  OFFICE" }]);
  const r = w.e.resolve({ captureSha: entFix.sha("r9"), resolvedBy: entFix.MACHINE });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  assert.ok(r.resolved.length > 0, "the instrument resolves something");
  for (const x of r.resolved) assert.ok(typeof x.basis === "string" && x.basis.length > 0 && typeof x.method === "string" && x.method.length > 10, JSON.stringify(x));
  const stored = w.rows(`SELECT basis, method FROM resolutions`);
  assert.ok(stored.length > 0 && stored.every((x) => typeof x.method === "string" && x.method.length > 10 && typeof x.basis === "string"));
});

test("R19: actioncorrespond and filingsent are backed by their grounds — refused NEITHER_CAPTURE_NOR_TESTIMONY, nothing "
   + "written, with neither the bytes nor the member's account — and accepted on an account, with no further reason", async () => {
  for (const op of ["actioncorrespond", "filingsent"]) assert.equal(RUNGS[op], "reasoned", op);
  const A = "ACTN-2026-0001-a", M = actFix.V("alice");
  const corr = () => { const w = actFix.world(); w.doc("INFO-2026-0001-d"); w.action(A);
    return { w, c: (x) => w.a.actionCorrespond({ target: A, direction: "sent", at: "2026-09-02", account: "we asked", viewer: M, author: M, ...x }) }; };
  for (const account of [undefined, "", "   "]) {
    const { w, c } = corr(); const before = dump(sqlOf(w));
    assert.equal(c({ account }).reason, "NEITHER_CAPTURE_NOR_TESTIMONY", JSON.stringify(account));
    assert.equal(dump(sqlOf(w)), before, "nothing written");
  }
  const ok = corr().c({});
  assert.deepEqual([ok.ok, ok.held_as], [true, "testimony"], JSON.stringify(ok).slice(0, 300));
  const sent = async () => {
    const x = filFix.world(); const act = x.action({});
    const d = x.f.filingPrepare({ action: act, text: filFix.WORDS, preparer: filFix.MACHINE, viewer: filFix.MACHINE });
    assert.equal(d.ok, true, JSON.stringify(d).slice(0, 300));
    const ap = await x.f.filingApprove({ filing: d.id, author: filFix.V("bo"), viewer: filFix.V("bo"), text: d.text.replace("[UNFILLED: law]", filFix.LAW) });
    assert.equal(ap.ok, true, JSON.stringify(ap).slice(0, 300));
    return { x, send: (o = {}) => x.f.filingRecordSent({ filing: d.id, at: "2026-09-29", medium: "in person", account: "handed to the clerk",
      author: filFix.V("bo"), viewer: filFix.V("bo"), ...o }) };
  };
  for (const account of [undefined, null, ""]) {
    const { x, send } = await sent(); const before = dump(sqlOf(x));
    assert.equal((await send({ account })).reason, "NEITHER_CAPTURE_NOR_TESTIMONY", JSON.stringify(account));
    assert.equal(dump(sqlOf(x)), before, "nothing written");
  }
  const s = await (await sent()).send();
  assert.equal(s.ok, true, JSON.stringify(s).slice(0, 300));
});

test("R19: consequencerecord is backed by its arms — the assessed arm's absent rationale refused NO_RATIONALE (in the "
   + "family), nothing written; the computed arm accepted on its operands and the undetermined arm on its stated why, "
   + "neither asked a further reason", () => {
  assert.equal(RUNGS.consequencerecord, "reasoned");
  const S = "STD-2026-0001-law";
  const scene = () => { const w = conFix.world(); const D = w.determination("CONF-2026-0001-act", w.P, { [S]: "noncompliant" });
    const base = { determination: D, standard: S, affected: { kind: "service", description: "library hours" },
      period: { from: "2026-01-01", to: "2026-03-31" }, author: conFix.V("alice") };
    return { w, base }; };
  for (const rationale of [undefined, "", "   "]) {
    const { w, base } = scene(); const before = dump(sqlOf(w));
    const r = w.c.consequenceRecord({ ...base, measure: { unit: "time", range: { low: 10, high: 20 } }, basis: { rationale, rests_on: [] } });
    assert.equal(r.reason, "NO_RATIONALE", JSON.stringify(r).slice(0, 200));
    assert.ok(JUSTIFICATION_REFUSALS.includes(r.reason));
    assert.equal(dump(sqlOf(w)), before, "nothing written");
  }
  const a = scene();
  const assessed = a.w.c.consequenceRecord({ ...a.base, measure: { unit: "time", range: { low: 10, high: 20 } },
    basis: { rationale: "the schedule shows fewer hours", rests_on: [] } });
  assert.deepEqual([assessed.ok, assessed.part?.state], [true, "assessed"], JSON.stringify(assessed).slice(0, 300));
  const c = scene();
  const x = c.w.figure("INFO-2026-0003-c", "Rate 0.1"), y = c.w.figure("INFO-2026-0004-d", "Rate 0.2");
  const computed = c.w.c.consequenceRecord({ ...c.base, measure: { unit: "money", currency: "USD" },
    basis: { op: "sum", operands: [{ content: x, figure: "0.1" }, { content: y, figure: "0.2" }] } });
  assert.deepEqual([computed.ok, computed.part?.state], [true, "computed"], JSON.stringify(computed).slice(0, 300));
  assert.equal(computed.part.computation.operands.length, 2, "its grounds are recorded");
  const u = scene();
  const undetermined = u.w.c.consequenceRecord({ ...u.base, measure: { unit: "count" }, basis: { why: "not_in_record" } });
  assert.deepEqual([undetermined.ok, undetermined.part?.state, undetermined.part?.undetermined?.code], [true, "undetermined", "not_in_record"]);
  assert.ok(undetermined.part.undetermined.why.length > 10, "its why is stated");
});

/* DEC-88's two `terminal` acts: each cannot be walked back — an ended escalation takes no further act and is never
   reopened (escalation R14), and a filing is approved at most once (filings R6, ALREADY_APPROVED). */
test("R19: escalationend and filingapprove, graded `terminal` (DEC-88), cannot be walked back — a second approval is "
   + "refused ALREADY_APPROVED, and no act moves an ended escalation", async () => {
  assert.deepEqual([RUNGS.escalationend, RUNGS.filingapprove], ["terminal", "terminal"]);
  const x = filFix.world(); const act = x.action({});
  const d = x.f.filingPrepare({ action: act, text: filFix.WORDS, preparer: filFix.MACHINE, viewer: filFix.MACHINE });
  const text = d.text.replace("[UNFILLED: law]", filFix.LAW);
  assert.equal((await x.f.filingApprove({ filing: d.id, text, author: filFix.V("bo"), viewer: filFix.V("bo") })).ok, true);
  const again = await x.f.filingApprove({ filing: d.id, text: text + " Amended.", author: filFix.V("bo"), viewer: filFix.V("bo") });
  assert.equal(again.reason, "ALREADY_APPROVED", JSON.stringify(again).slice(0, 300));
  /* an escalation's end, reached through escalation's own fixture, and every act after it refused */
  /* an escalation ended on R14's conditions (compliance restored for both standards, consequences addressed) over
     escalation's own fixture, then every act on it refused */
  const w = escFix.seeded();
  w.clock.now = "2026-09-20T00:00:00Z";
  escFix.opened(w);
  w.determine({ project: w.P, act: w.determinations.get(w.D).act.id, at: "2026-09-21T00:00:00Z",
    outcomes: [{ standard: "STD-2026-0001-a", outcome: "compliant" }, { standard: "STD-2026-0002-b", outcome: "compliant" }] });
  w.addressedBy.set(w.D, { state: "addressed", parts: [{ id: "CONS-2026-0001-p" }] });
  w.clock.now = "2026-09-22T00:00:00Z";
  const who = { author: escFix.V("bob"), viewer: escFix.V("bob") };
  const end = w.esc.escalationEnd({ id: w.E, ...who });
  assert.deepEqual([end.ok, end.state], [true, "ended"], JSON.stringify(end).slice(0, 300));
  assert.equal(w.esc.escalationEnd({ id: w.E, ...who }).reason, "ALREADY_ENDED");
  for (const r of [w.esc.escalationResume({ id: w.E, ...who }), w.esc.escalationSuspend({ id: w.E, reason: "again", ...who }),
                   w.esc.escalationAdvance({ id: w.E, to: 2, reason: "again", ...who })])
    assert.notEqual(r.ok, true, JSON.stringify(r).slice(0, 200));
  assert.equal(w.esc.escalationRead({ id: w.E, viewer: escFix.V("bob") }).state, "ended", "never reopened");
});

/* op-grades R10 (DEC-96 items 1, 2; N520, N522): case-import's four reasoned acts, driven at case-import's interface over its
   fixture (real record-core, membership, strength and accepted-work tables; case-checker's answer scripted). Each is
   called well-formed but without its account — absent, null, empty, blank, or past its 2,000-character bound — and is
   refused with its owner's code, in the family, writing nothing; with it, it is accepted. Each is corrected forward and
   never erased: a withdrawn acceptance and a cleared flag stay in the record. The two `undetermined` writes ask no reason
   at all: an import and a completion are accepted with none given. */
import * as ci from "../case-import/fixture.mjs";
test("R19: importaccept, importacceptwithdraw, importflag and importflagclear, graded `reasoned`, are refused "
   + "without their account with IMPORT_ACCEPT_NO_REASON or IMPORT_FLAG_NO_ISSUE (in the family) and write nothing, are "
   + "accepted with it, and are corrected forward: the acceptance and the flag stay in the record", async () => {
  for (const op of ["importaccept", "importacceptwithdraw", "importflag", "importflagclear"]) assert.equal(RUNGS[op], "reasoned", op);
  const scene = async () => {
    const w = ci.seeded();
    const a = await ci.imp(w);
    assert.equal(a.ok, true, JSON.stringify(a).slice(0, 300));
    const by = { by: ci.V("alice"), viewer: ci.V("alice") };
    const acts = {
      importaccept: (x) => w.ci.acceptImported({ import: a.import, edition: 1, findings: [ci.F1], checked: "every passage against its document",
        reason: "the chain holds", ...by, ...x }),
      importacceptwithdraw: (x) => w.ci.withdrawAcceptance({ import: a.import, edition: 1, reason: "the source corrected it", ...by, ...x }),
      importflag: (x) => w.ci.flagImported({ import: a.import, edition: 1, finding: ci.F1, issue: "the payroll figure is a year off", ...by, ...x }),
      importflagclear: (x) => w.ci.clearFlag({ flag: w.flag, reason: "checked against the budget: it is right", ...by, ...x }),
    };
    return { w, a, acts };
  };
  /* the act's own account fields, each withheld in turn */
  const FIELDS = { importaccept: ["checked", "reason"], importacceptwithdraw: ["reason"], importflag: ["issue"], importflagclear: ["reason"] };
  const CODES = { importaccept: "IMPORT_ACCEPT_NO_REASON", importacceptwithdraw: "IMPORT_ACCEPT_NO_REASON",
                  importflag: "IMPORT_FLAG_NO_ISSUE", importflagclear: "IMPORT_FLAG_NO_ISSUE" };
  /* what each act needs standing before it: a withdrawal an acceptance in force, a clear an open flag */
  const before = { importacceptwithdraw: (s) => assert.equal(s.acts.importaccept({}).ok, true),
                   importflagclear: (s) => { const f = s.acts.importflag({}); assert.equal(f.ok, true); s.w.flag = f.flag; } };
  const bad = [];
  for (const [op, fields] of Object.entries(FIELDS))
    for (const field of fields)
      for (const why of [undefined, null, "", "   ", "x".repeat(2001)]) {
        const s = await scene();
        before[op]?.(s);
        const snap = s.w.snapshot();
        const r = s.acts[op]({ [field]: why });
        if (!(r && r.ok !== true && r.reason === CODES[op] && JUSTIFICATION_REFUSALS.includes(r.reason))) bad.push(`${op} ${field}=${JSON.stringify(why)?.slice(0, 20)}: ${JSON.stringify(r).slice(0, 200)}`);
        else if (JSON.stringify(s.w.snapshot()) !== JSON.stringify(snap)) bad.push(`${op} ${field}: refused, but wrote`);
      }
  assert.deepEqual(bad, []);
  /* with the account: accepted, and corrected forward — the withdrawn acceptance and the cleared flag are kept */
  const s = await scene();
  assert.equal(s.acts.importaccept({}).ok, true);
  assert.equal(s.acts.importacceptwithdraw({}).ok, true);
  assert.equal(s.w.count("case_import_acceptances"), 1, "the acceptance stays in the history after its withdrawal");
  assert.equal(s.acts.importaccept({ reason: "accepted again after the correction" }).ok, true, "a later acceptance moves it forward");
  const f = s.acts.importflag({});
  assert.equal(f.ok, true, JSON.stringify(f).slice(0, 300));
  s.w.flag = f.flag;
  assert.equal(s.acts.importflagclear({}).ok, true);
  assert.equal(s.w.count("case_import_flags"), 1, "the flag stays in the history after its clear");
});

test("R24: caseimport and caseimportdocument, stated absent (`undetermined`) and never ranked, ask no authored reason — "
   + "each is accepted with none given", async () => {
  const w = ci.seeded();
  const LETTER = ci.bytes("%PDF the letter the case relies on");
  w.script.set(ci.F2, { role: "supporting", result: "recreated_in_part", missing: [{ sha: ci.sha(LETTER), words: "the letter" }],
                        pair: { capture: { state: "graded", grade: "D" }, connection: { state: "graded", grade: "D" } } });
  const a = await ci.imp(w);
  assert.equal(a.ok, true, JSON.stringify(a).slice(0, 300));
  const c = await w.ci.completeImportedDocument({ import: a.import, edition: 1, bytes: LETTER, by: ci.V("bob"), viewer: ci.V("bob") });
  assert.equal(c.ok, true, JSON.stringify(c).slice(0, 300));
  for (const op of ["caseimport", "caseimportdocument"]) {
    assert.equal(RUNG_ABSENT[op]?.ground, "undetermined", op);
    assert.ok(!Object.hasOwn(RUNGS, op), op);
  }
});
