/* proposeDispose (op=proposedispose) at its interface: the set, the dispatch to progressions, the project arm and its
   refusals (R27), the class bridge (R28), and the catalogued no-scope refusal (R29). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, NOW } from "./world.mjs";
import { QUEUE_ACT_CHECKS } from "../../../src/queue/index.mjs";
import { disposeProposalOk } from "../progressions/fixtures.mjs";
import { notADisposition } from "../../../src/progressions/index.mjs";

function setup() {
  const calls = [];
  const w = world({ progressions: { disposeProposal: (a) => { calls.push(a); return disposeProposalOk(a); } } });
  w.member("alice"); w.member("bob");
  w.bundle("PRJ-1", "project"); w.join("PRJ-1", "alice"); w.join("PRJ-1", "bob", { state: "invited" });
  w.bundle("PRJ-H", "project"); w.bundle("INQ-1", "inquiry");
  w.calls = calls;
  return w;
}
const pd = (w, a) => w.q.proposeDispose({ decidedBy: "alice", viewer: "member:alice", identity: "member:alice", ...a });
const F = "FINDING::stance-changed-here-not-elsewhere::INQ-1::PRJ-1";

test("R27: a call naming neither project nor finding goes to progressions.disposeProposal, by key or by the pair", () => {
  const w = setup();
  assert.equal(pd(w, { key: "proc::award", to: "deferred", reason: "r", definitionVersion: 1 }).ok, true);
  assert.equal(pd(w, { progressionKey: "proc", stageKey: "need", to: "dismissed", reason: "r", definitionVersion: 1 }).ok, true);
  assert.deepEqual(w.calls.map((c) => [c.progressionKey, c.stageKey, c.to, c.definitionVersion, c.decidedBy]),
    [["proc", "award", "deferred", 1, "alice"], ["proc", "need", "dismissed", 1, "alice"]]);
});

test("R27: the project arm's refusals in order, as progressions R21 words the shared four", () => {
  const w = setup();
  assert.equal(pd(w, { project: "PRJ-1", to: "deferred", reason: "r" }).reason, "NO_FINDING");
  assert.equal(pd(w, { finding: F, to: "deferred", reason: "r" }).reason, "NO_PROJECT_SCOPE");
  assert.deepEqual(pd(w, { project: "PRJ-1", finding: F, to: "adopted", reason: "r" }), notADisposition("adopted"));
  assert.equal(pd(w, { project: "PRJ-1", finding: F, to: "deferred", reason: " " }).reason, "NO_REASON");
  assert.equal(pd(w, { project: "PRJ-1", finding: F, to: "deferred", reason: "x".repeat(161) }).reason, "BAD_REASON");
  assert.equal(pd(w, { project: "PRJ-1", finding: F, to: "deferred", reason: 'a "quote"' }).reason, "BAD_REASON");
  assert.equal(pd(w, { project: "PRJ-1", finding: F, to: "deferred", reason: "r", decidedBy: "" }).reason, "NO_DECIDER");
  const absent = pd(w, { project: "PRJ-NONE", finding: F, to: "deferred", reason: "r" });
  const hidden = pd(w, { project: "PRJ-H", finding: F, to: "deferred", reason: "r" });
  const notp = pd(w, { project: "INQ-1", finding: F, to: "deferred", reason: "r" });
  for (const r of [absent, hidden, notp]) { assert.equal(r.reason, "NO_SUCH_PROJECT"); assert.equal(r.finding, F); }
  assert.equal(absent.detail, hidden.detail);
  const inv = w.q.proposeDispose({ project: "PRJ-1", finding: F, to: "deferred", reason: "r", decidedBy: "bob",
                                   viewer: "member:bob", identity: "member:bob" });
  assert.equal(inv.reason, "PROJECT_ACT_NOT_A_PARTICIPANT");
  assert.equal(w.all(`SELECT count(*) c FROM finding_dispositions`)[0].c, 0, "a refusal writes nothing");
});

test("R27: success keeps one decision per (project, finding), replaced on re-decision, at the instance's clock; no bundle is written", () => {
  const w = setup();
  const bundles = w.all(`SELECT count(*) c FROM bundles`)[0].c;
  const a = pd(w, { project: "PRJ-1", finding: F, kind: "stance-changed-here-not-elsewhere", to: "deferred", reason: "later" });
  assert.deepEqual([a.ok, a.scope, a.key, a.state, a.decided_by, a.bundle], [true, "project", `PRJ-1::${F}`, "deferred", "alice", null]);
  assert.equal(a.at, new Date(NOW).toISOString(), "stamped at the instance's clock");
  pd(w, { project: "PRJ-1", finding: F, to: "dismissed", reason: "no" });
  const rows = w.all(`SELECT * FROM finding_dispositions`);
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].state, rows[0].reason, rows[0].kind], ["dismissed", "no", null]);
  assert.equal(w.all(`SELECT count(*) c FROM bundles`)[0].c, bundles);
});

test("R27: with items, each item on its own through record-core's perItem, the decider, viewer and identity forced onto every item", () => {
  const w = setup();
  const r = w.q.proposeDispose({ items: [{ project: "PRJ-1", finding: F, decidedBy: "mallory" }, { key: "CONDITION::x::y" },
                                         { project: "PRJ-1", finding: "FINDING::other" }],
                                 to: "deferred", reason: "r", decidedBy: "alice", viewer: "member:alice", identity: "member:alice" });
  assert.equal(r.weight, "per-item"); assert.equal(r.count, 3); assert.equal(r.applied, 2);
  assert.deepEqual(r.items.map((i) => i.outcome), ["applied", "retained", "applied"]);
  assert.deepEqual(w.all(`SELECT decided_by FROM finding_dispositions`).map((x) => x.decided_by), ["alice", "alice"]);
});

test("R28, R50: the bridge: a CONDITION or OBLIGATION key is CLASS_NOT_DISPOSED with instead, the per-kind door R12 names; a FINDING key NO_PROJECT_SCOPE; nothing written", () => {
  const w = setup();
  for (const [key, cls, kind, instead] of [["CONDITION::governor-holding-host::h", "CONDITION", "governor-holding-host", "queuemute"],
                                           ["render-deferred::CR-1", "CONDITION", "render-deferred", "queuemute"],
                                           ["bias-debt::r1", "OBLIGATION", "bias-debt", "biasdebtresolve"],
                                           ["signer-self-registered::K1", "OBLIGATION", "signer-self-registered", ["signerset", "signerknown"]],
                                           ["authority-undetermined::TASK-1", "OBLIGATION", "authority-undetermined", "taskresolve"],
                                           ["plan-checkpoint-due::PLN-1::S::2", "OBLIGATION", "plan-checkpoint-due", "checkpointrecord"],
                                           ["escalation-stage-proposed::ESC-1::filed", "OBLIGATION", "escalation-stage-proposed", "escalationadvance"],
                                           ["action-reminder::ACT-1::0::2026-09-02", "OBLIGATION", "action-reminder", "reminderanswer"],
                                           ["action-clock-overdue::ACT-1::0", "CONDITION", "action-clock-overdue", "queuemute"],
                                           ["CONDITION::action-clock-overdue::ACT-1::0", "CONDITION", "action-clock-overdue", "queuemute"],
                                           // the published id of an OBLIGATION not held in tasks, read as R26 reads it
                                           ["OBLIGATION::bias-debt::r1", "OBLIGATION", "bias-debt", "biasdebtresolve"],
                                           ["OBLIGATION::plan-checkpoint-due::PLN-1::S::2", "OBLIGATION", "plan-checkpoint-due", "checkpointrecord"],
                                           ["OBLIGATION::escalation-stage-proposed::ESC-1::filed", "OBLIGATION", "escalation-stage-proposed", "escalationadvance"],
                                           ["OBLIGATION::action-reminder::ACT-1::0::2026-09-02", "OBLIGATION", "action-reminder", "reminderanswer"],
                                           // R50 (DEC-116 item 2): the docket's core item has two doors
                                           ["OBLIGATION::docket-core-due::CASE-1::response::DKT-1", "OBLIGATION", "docket-core-due", ["docketprepare", "docketdecline"]],
                                           ["docket-core-due::CASE-1::edition::2", "OBLIGATION", "docket-core-due", ["docketprepare", "docketdecline"]],
                                           // R46: a contradiction duty's doors, before it is taken up (the bridge holds no subject)
                                           ["contradiction-duty::C1", "OBLIGATION", "contradiction-duty", ["contradictionclarify", "contradictiontakeup"]],
                                           ["contradiction-duty-unseen::C2", "OBLIGATION", "contradiction-duty-unseen", ["contradictionoptin"]]]) {
    const r = pd(w, { key, to: "deferred", reason: "r" });
    assert.deepEqual([r.reason, r.class, r.kind, r.instead, r.check, r.translation],
      ["CLASS_NOT_DISPOSED", cls, kind, instead, "C-33.44", QUEUE_ACT_CHECKS.CLASS_NOT_DISPOSED.translation], key);
  }
  for (const key of [F, "stance-changed-here-not-elsewhere::INQ-1::PRJ-1"]) {
    const r = pd(w, { key, to: "deferred", reason: "r" });
    assert.equal(r.reason, "NO_PROJECT_SCOPE"); assert.equal(r.kind, "stance-changed-here-not-elsewhere");
    assert.deepEqual(r.requires, ["project", "finding"]);
  }
  assert.equal(w.calls.length, 0); assert.equal(w.all(`SELECT count(*) c FROM finding_dispositions`)[0].c, 0);
  // an OBLIGATION:: key whose second segment is no obligation kind is not read as one
  pd(w, { key: "OBLIGATION::no-such-kind::x", to: "deferred", reason: "r" });
  assert.equal(w.calls.length, 1);
});

test("R29: both NO_PROJECT_SCOPE refusals carry a catalogued check id and a translation", () => {
  const w = setup();
  const arm = pd(w, { finding: F, to: "deferred", reason: "r" });
  const bridge = pd(w, { key: F, to: "deferred", reason: "r" });
  for (const r of [arm, bridge]) {
    assert.deepEqual([r.ok, r.reason, r.code, r.check, r.translation],
      [false, "NO_PROJECT_SCOPE", "NO_PROJECT_SCOPE", "C-33.50", QUEUE_ACT_CHECKS.NO_PROJECT_SCOPE.translation]);
    assert.equal(typeof r.detail, "string");
  }
  assert.doesNotMatch(QUEUE_ACT_CHECKS.NO_PROJECT_SCOPE.translation, /finding/i, "N301: no member-facing word calls it a finding");
});
