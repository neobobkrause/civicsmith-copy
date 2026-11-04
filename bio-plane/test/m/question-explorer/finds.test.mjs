/* question-explorer: finds, their gauge, the gate, the offer and the member's doors (R4, R5, R6, R7, R11, R14). Each
   with a negative control (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { CIVICSMITH_TEST_SET } from "../../../src/run-rules/index.mjs";
import { world, bar, VERIFIED_CHECK, Q, Q2, DOC, DOC2, HDOC, PROJ, HPROJ, ENT, CAP, CAP2, HCAP, CALLER } from "./fixture.mjs";
import { EXPLORE_BEARINGS, EXPLORE_FALSE_ALARM_MAX } from "../../../src/question-explorer/index.mjs";
import { ACCEPTANCE_FORMS } from "../../../src/record-grammar/index.mjs";

const gauge = (w, run, over = {}) =>
  w.p.find({ run, kind: "capture", ref: CAP, bearing: "supports", how: "the minutes record the vote", caller: CALLER, ...over });

test("R4: each find (a capture, content row or connection the run located) is gauged supports, cuts_against or unclear against the question's live basis, answered {bearing, how, false_alarm_rate, gold_set, label: machine, enabled_by} (R16: untested null under the bar)", async () => {
  /* Under the bar: Gate 1 held for the entry ai-runs judges (run-rules R19 as T53 amends it), off a test instance. */
  const w = (await world().standard()).gate1();
  w.project(PROJ, ["alice"], { owners: ["alice"], setting: "discoverable" });
  w.draw(Q, PROJ);
  w.legEarning.writeBasis(Q, [{ target: DOC, role: "supports" }]);
  const o = await w.openRun("group");
  const a = gauge(w, o.run);
  assert.deepEqual(a.gauge, { bearing: "supports", how: "the minutes record the vote", false_alarm_rate: 0.1,
                              gold_set: "civicsmith@1", label: "machine", enabled_by: "group", untested: null });
  assert.deepEqual(a.against, { currents: [{ project: PROJ, current: `reading of ${PROJ}` }], legs: 1 }, "the live basis it was gauged against");
  assert.equal(a.step, o.step, "found under the run's step");
  w.content("CNT-1", DOC2, CAP2);
  assert.equal(w.p.find({ run: o.run, kind: "content", ref: "CNT-1", bearing: "cuts_against", how: "the passage says otherwise", caller: CALLER }).gauge.bearing, "cuts_against");
  w.conns.push({ a_capture_sha: CAP, b_capture_sha: CAP2, entity_id: ENT, a_bundle_id: DOC, b_bundle_id: DOC2 });
  const c = w.p.find({ run: o.run, kind: "connection", ref: { a: CAP2, b: CAP, entity: ENT }, bearing: "unclear", how: "both name the clerk", caller: CALLER });
  assert.equal(c.ref, `${[CAP, CAP2].sort().join(":")}:${ENT}`);
  assert.deepEqual(EXPLORE_BEARINGS, ["supports", "cuts_against", "unclear"]);
  /* Negative controls: a bearing outside the three, no account of how, a kind outside the three, an unheld find. */
  assert.equal(gauge(w, o.run, { bearing: "strong" }).code, "EXPLORE_BEARING_INVALID");
  assert.equal(gauge(w, o.run, { how: " " }).code, "EXPLORE_BEARING_INVALID");
  assert.equal(gauge(w, o.run, { kind: "score" }).code, "EXPLORE_FIND_UNKNOWN");
  assert.equal(gauge(w, o.run, { ref: "0".repeat(64) }).code, "EXPLORE_FIND_UNKNOWN");
  assert.equal(gauge(w, o.run).already, true, "the same find under the run answers its first record");
});

test("R4: the gauge is never a grade, never stored as a score, and never hides, ranks or orders what members see", async () => {
  const w = await world().standard();
  const o = await w.openRun("group");
  gauge(w, o.run);
  const cols = w.rows(`PRAGMA table_info(explore_finds)`).map((c) => c.name);
  assert.ok(!cols.some((c) => /score|grade|rank|weight|confidence/.test(c)), `no score column: ${cols}`);
  const f = w.p.findsFor({ viewer: "member:alice" }).finds[0];
  assert.ok(!Object.keys(f).some((k) => /score|grade|rank|weight|confidence/.test(k)));
  /* Negative control: an unclear find is offered exactly as a supporting one is. */
  const w2 = await world().standard();
  const o2 = await w2.openRun("group");
  gauge(w2, o2.run, { bearing: "unclear" });
  assert.equal(w2.p.findsFor({ viewer: "member:alice" }).finds.length, 1);
});

test("R5: findsFor answers each find, once (keyed per find and question), to each of steps.findRecipients who may see both the find and the question; labelled the system's, never a project's; which account paid only to its owners", async () => {
  const w = await world().standard();
  w.project(HPROJ, ["bob"]);
  w.doc(HDOC, HCAP, { project: HPROJ });
  w.follow(Q, "alice", "bob", "dana");
  w.project(PROJ, ["alice"], { owners: ["alice"] });
  w.draw(Q, PROJ);
  await w.setExplore("group", "no");
  const o = await w.openRun(`project:${PROJ}`);
  gauge(w, o.run);
  const alice = w.p.findsFor({ viewer: "member:alice" }).finds;
  assert.equal(alice.length, 1);
  assert.equal(alice[0].key, `explore-find:${alice[0].find}:${Q}`);
  assert.deepEqual([alice[0].label, alice[0].by, alice[0].enabled_by], ["machine", "system", `project:${PROJ}`], "alice owns the paying account");
  const bob = w.p.findsFor({ viewer: "member:bob" }).finds;
  assert.equal(bob.length, 1);
  assert.equal("enabled_by" in bob[0], false, "bob does not own the paying account");
  assert.ok(!JSON.stringify(bob[0]).includes(PROJ), "never labelled a project's");
  assert.equal(w.p.findsFor({ viewer: "member:carol" }).finds.length, 0, "negative control: not a recipient");
  /* A recipient who may not see the find's document is not offered it. */
  w.p.find({ run: o.run, kind: "capture", ref: HCAP, bearing: "unclear", how: "x", caller: CALLER });
  assert.equal(w.p.findsFor({ viewer: "member:alice" }).finds.length, 1, "HDOC is outside the paying account's sight, never a find");
});

test("R5: a recipient who may not see the question, or the document a find rests on, is not offered it", async () => {
  const w = await world().standard();
  w.project(HPROJ, ["bob"]);
  w.doc(HDOC, HCAP, { project: HPROJ });
  w.follow(Q, "alice", "bob");
  w.draw(Q, HPROJ);
  await w.setExplore("group", "no");
  const o = await w.openRun(`project:${HPROJ}`);
  w.p.find({ run: o.run, kind: "capture", ref: HCAP, bearing: "unclear", how: "a mention", caller: CALLER });
  assert.equal(w.p.findsFor({ viewer: "member:bob" }).finds.length, 1);
  assert.equal(w.p.findsFor({ viewer: "member:alice" }).finds.length, 0, "alice may not see the hidden project's document");
});

test("R6: a find's only doors are a member's: dismiss (the queue's in a drawing project; a follower outside every one mutes it), accept by one act in record-grammar R52's forms, hold a hypothesis, or start a step; nothing here writes a leg, a grade, a conclusion or a hypothesis", async () => {
  const w = await world().standard();
  w.follow(Q, "alice", "bob");
  w.project(PROJ, ["alice"], { owners: ["alice"], setting: "discoverable" });
  w.draw(Q, PROJ);
  const o = await w.openRun("group");
  const { find } = gauge(w, o.run);
  const doors = w.p.findDoors({ find, question: Q, viewer: "member:alice" });
  assert.deepEqual(doors.doors.map((d) => d.door), ["dismiss", "accept", "hypothesis", "step"]);
  assert.match(doors.doors[0].by, /queue R27/, "alice draws on it through a project");
  assert.equal(w.p.findDoors({ find, question: Q, viewer: "member:bob" }).doors[0].by, "findMute", "bob follows outside every project");
  assert.equal(w.p.findDoors({ find, question: Q, viewer: "member:carol" }), null, "not offered to carol");
  const before = w.snapshot();
  /* Accept, as found: the acceptance record and the leg her own promotion carries; no leg written. */
  const acc = w.p.findAccept({ find, question: Q, form: "as_proposed", by: "member:alice" });
  assert.deepEqual([acc.ok, acc.accepted.form, acc.accepted.by, acc.wrote_leg], [true, "as_proposed", "member:alice", false]);
  assert.deepEqual(acc.leg, { question: Q, target: DOC, note: "the minutes record the vote" });
  const after = w.snapshot();
  for (const t of Object.keys(before).filter((t) => t !== "explore_doors"))
    assert.equal(after[t], before[t], `${t} unchanged: no leg, grade, conclusion or hypothesis`);
  assert.equal(w.p.findsFor({ viewer: "member:alice" }).finds.length, 0, "accepted, no longer offered to her");
  assert.equal(w.p.findMute({ find, question: Q, by: "member:alice" }).code, "EXPLORE_NO_SUCH_FIND");
  /* Edited carries her words; own_instead carries none. */
  const ed = w.p.findAccept({ find, question: Q, form: "edited", edit: "my reading of it", by: "member:bob" });
  assert.equal(ed.leg.note, "my reading of it");
  w.content("CNT-1", DOC2, CAP2);
  const passage = w.p.find({ run: o.run, kind: "content", ref: "CNT-1", bearing: "unclear", how: "a passage", caller: CALLER }).find;
  assert.deepEqual(w.p.findAccept({ find: passage, question: Q, form: "as_proposed", by: "member:alice" }).leg,
                   { question: Q, target: DOC2, content_id: "CNT-1", note: "a passage" }, "a passage's leg names its document and row");
  assert.equal(w.p.findAccept({ find: passage, question: Q, form: "own_instead", by: "member:bob" }).leg, null, "her own instead: no leg proposed");
  const own = w.p.findAccept({ find, question: Q, form: "own_instead", by: "member:carol" });
  assert.equal(own.code, "EXPLORE_NO_SUCH_FIND", "carol is not a recipient");
  assert.deepEqual(ACCEPTANCE_FORMS, ["as_proposed", "edited", "own_instead"]);
  /* Negative controls: a machine, an unknown form, `edited` without words, a find not offered. */
  assert.equal(w.p.findAccept({ find, question: Q, form: "as_proposed", by: CALLER }).code, "EXPLORE_ACCEPT_INVALID");
  assert.equal(w.p.findAccept({ find, question: Q, form: "approve", by: "member:alice" }).code, "EXPLORE_ACCEPT_INVALID");
  assert.equal(w.p.findAccept({ find, question: Q, form: "edited", by: "member:alice" }).code, "EXPLORE_ACCEPT_INVALID");
  assert.equal(w.p.findAccept({ find, question: Q, form: "own_instead", by: "member:carol" }).code, "EXPLORE_NO_SUCH_FIND");
});

test("R6: a follower outside every drawing project mutes a find; a participant of a drawing project dismisses it through the queue, not here", async () => {
  const w = await world().standard();
  w.follow(Q, "alice", "bob");
  w.project(PROJ, ["alice"], { owners: ["alice"], setting: "discoverable" });
  w.draw(Q, PROJ);
  const o = await w.openRun("group");
  const { find } = gauge(w, o.run);
  assert.equal(w.p.findMute({ find, question: Q, by: "member:bob" }).muted, true);
  assert.equal(w.p.findsFor({ viewer: "member:bob" }).finds.length, 0, "muted, no longer offered to him");
  assert.equal(w.p.findsFor({ viewer: "member:alice" }).finds.length, 1, "his mute is his alone");
  assert.equal(w.p.findMute({ find, question: Q, by: "member:alice" }).code, "EXPLORE_MUTE_IN_PROJECT");
});

test("R7: finds are offered only while the gate is open: the explorer passed its bar on Civicsmith's test investigations, its false-alarm rate at most 20% and recorded, and run-rules R19 lets investigate and the explorer's use deploy; closed, findsFor answers nothing and counts nothing, and no member is offered exploring", async () => {
  assert.equal(EXPLORE_FALSE_ALARM_MAX, 0.2);
  /* (T53) run-rules R19 lets investigate and the explorer's use deploy only on a Gate 1 record for the entry ai-runs
     judges: held here (`w.gate1`), off a test instance, so the gate opens on R7's bar alone. */
  const w = (await world().standard()).gate1();
  const o = await w.openRun("group");
  gauge(w, o.run);
  const open = w.p.findsFor({ viewer: "member:alice" });
  assert.equal(open.finds.length, 1);
  assert.deepEqual([w.p.gate().false_alarm_rate, w.p.gate().untested], [0.1, null], "open on the bar, unlabelled");
  for (const [name, shut] of [
    ["no record", () => { w.testBars = [bar("investigate")]; }],
    ["not passed", () => { w.testBars = [bar("investigate"), bar("explore", { passed: false })]; }],
    ["false alarms above 20%", () => { w.testBars = [bar("investigate"), bar("explore", { false_alarm_rate: 0.21 })]; }],
    ["false-alarm rate not recorded", () => { w.testBars = [bar("investigate"), bar("explore", { false_alarm_rate: null })]; }],
    ["an earlier version of the set", () => { w.testBars = [bar("investigate"), bar("explore", { set_version: 0 })]; }],
    ["Gate 1 not yet rated for the entry", () => { w.gate1("claude-a", "not_yet_rated"); }],
    ["Gate 1 not suitable for the entry", () => { w.gate1("claude-a", "not_suitable"); }],
    ["Gate 1 held for another entry only", () => { w.gate1("claude-a"); w.servedOn = "claude-b"; }],
    ["investigate's chain not verified", () => { w.verifications = []; }],
  ]) {
    shut();
    assert.equal(w.p.gate().open, false, name);
    assert.deepEqual(w.p.findsFor({ viewer: "member:alice" }), { ok: true, finds: [], truncated: false }, `${name}: nothing, no count`);
    assert.equal(await w.p.exploreDue(w.clock.now), 0, name);
    assert.equal(await w.p.exploreWake(w.clock.now), null, name);
    assert.equal((await w.p.exploreTick(w.clock.now)).gate, "closed", name);
    w.testBars = [bar("investigate"), bar("explore")]; w.verifications = [VERIFIED_CHECK]; w.gate1();
  }
  /* Negative control: at exactly 20% the gate is open. */
  w.testBars = [bar("investigate"), bar("explore", { false_alarm_rate: 0.2 })];
  assert.equal(w.p.gate().open, true);
  /* Civicsmith's own set no longer opens the gate (run-rules R19 as T53 amends it): over it, off a test instance and
     with no Gate 1 record, nothing opens. */
  const civ = await world({ testSet: CIVICSMITH_TEST_SET }).standard();
  civ.testInstance = false;
  assert.equal(civ.p.gate().open, false);
});

test("R11: a group's own test investigations measure the explorer too; the result, with its false-alarm rate, is answered to that group's members only, and never opens or closes R7's gate", async () => {
  const w = (await world().standard()).gate1();
  w.groupResults = [{ matter: "a test matter", false_alarm_rate: 0.5, passed: false }];
  const r = w.p.groupTestResults({ viewer: "member:alice" });
  assert.deepEqual(r.results, w.groupResults);
  assert.deepEqual(w.calledAs("groupTestResults")[0], { part: "explore", viewer: "member:alice" });
  assert.equal(w.p.groupTestResults({ viewer: "member:stranger" }), null, "negative control: not a member of the team");
  assert.equal(w.p.groupTestResults({ viewer: CALLER }), null);
  assert.equal(w.p.gate().open, true, "a failing group result does not shut the gate");
  w.testBars = [bar("investigate")];
  w.groupResults = [{ matter: "a test matter", false_alarm_rate: 0, passed: true }];
  assert.equal(w.p.gate().open, false, "a passing group result does not open it");
  assert.equal(w.calledAs("groupTestResults").length, 1, "the gate never asks for the group's results");
});

test("R14: a find that cuts against what the question's members hold is offered exactly as prominently as one that supports it: the same item, kind, place and order rule; nothing orders, groups or filters by bearing", async () => {
  const w = await world().standard();
  const o = await w.openRun("group");
  w.clock.now = "2026-10-10T09:01:00Z";
  gauge(w, o.run, { bearing: "cuts_against", how: "the minutes record the vote failed", at: "2026-10-10T09:01:00Z" });
  w.content("CNT-1", DOC2, CAP2);
  w.p.find({ run: o.run, kind: "content", ref: "CNT-1", bearing: "supports", how: "the passage records it passed", caller: CALLER, at: "2026-10-10T09:02:00Z" });
  const items = w.p.findsFor({ viewer: "member:alice" }).finds;
  assert.deepEqual(items.map((f) => f.bearing), ["supports", "cuts_against"], "newest first, whatever the bearing");
  const shape = (f) => Object.keys(f).sort();
  assert.deepEqual(shape(items[0]), shape(items[1]), "the same item");
  assert.equal(items[0].says, items[1].says);
  assert.equal(items[0].label, items[1].label);
  /* Negative control: swap the bearings; the order is unchanged (time decides, never bearing). */
  const w2 = await world().standard();
  const o2 = await w2.openRun("group");
  gauge(w2, o2.run, { bearing: "supports", at: "2026-10-10T09:01:00Z" });
  w2.content("CNT-1", DOC2, CAP2);
  w2.p.find({ run: o2.run, kind: "content", ref: "CNT-1", bearing: "cuts_against", how: "x", caller: CALLER, at: "2026-10-10T09:02:00Z" });
  assert.deepEqual(w2.p.findsFor({ viewer: "member:alice" }).finds.map((f) => f.bearing), ["cuts_against", "supports"]);
});
