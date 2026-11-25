/* money sets and the change notice at money's interface: R12, R13, R23, R32. */
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, sha, MACHINE, ANN, BOB, OUTSIDER } from "./fixture.mjs";
import { word } from "../../../src/setup-words/index.mjs";

test("R12 createSet refuses an unknown purpose, no label, and an attribution set concerning no contract; it allocates MSR-<year>-NNNN", () => {
  const s = seeded();
  assert.equal(s.m.createSet({ purpose: "ledger", label: "x", by: ANN }).reason, "UNKNOWN_PURPOSE");
  assert.equal(s.m.createSet({ purpose: "trail", label: " ", by: ANN }).reason, "NO_LABEL");
  assert.equal(s.m.createSet({ purpose: "attribution", label: "x", by: ANN }).reason, "NO_CONTRACT");
  assert.equal(s.m.createSet({ purpose: "attribution", label: "x", concerns: s.city, by: ANN }).reason, "NO_CONTRACT");
  const t = s.m.createSet({ purpose: "trail", label: "harbour money trail", by: ANN });
  assert.match(t.set_id, /^MSR-2026-\d{4}$/);
  assert.equal(s.m.createSet({ purpose: "attribution", label: "x", concerns: s.contract, by: ANN }).ok, true);
});

test("R12 include and exclude are a member's act, each with a reason, recorded with who, when and why; the latest act governs and every earlier one is kept", () => {
  const s = seeded();
  const set = s.m.createSet({ purpose: "trail", label: "t", by: ANN }).set_id;
  const f = s.rec();
  assert.equal(s.m.include({ setId: set, factId: f, reason: "r", by: MACHINE }).reason, "MEMBER_ACT_ONLY");
  assert.equal(s.m.include({ setId: set, factId: f, by: ANN }).reason, "NO_REASON");
  assert.equal(s.m.include({ setId: "MSR-2026-9999", factId: f, reason: "r", by: ANN }).reason, "NO_SUCH_SET");
  assert.equal(s.m.exclude({ setId: set, factId: "MNY-2026-aaaaaaaaaaaaaaaa", reason: "r", by: ANN }).reason, "NO_SUCH_FACT");
  assert.equal(s.m.include({ setId: set, factId: f, reason: "follows the transfer", by: ANN }).ok, true);
  assert.equal(s.m.exclude({ setId: set, factId: f, reason: "a different project", by: BOB }).ok, true);
  const r = s.m.readSet({ setId: set, viewer: ANN });
  assert.deepEqual(r.inclusions, []);
  assert.equal(r.exclusions.length, 1);
  assert.deepEqual([r.exclusions[0].by, r.exclusions[0].reason], [BOB, "a different project"]);
  assert.deepEqual(r.exclusions[0].history.map((h) => [h.act, h.by, h.reason]),
    [["include", ANN, "follows the transfer"], ["exclude", BOB, "a different project"]]);
});

test("R13 a machine's proposal is held apart, labelled with its method, and includes nothing until a member adopts it", () => {
  const s = seeded();
  const set = s.m.createSet({ purpose: "trail", label: "t", by: ANN }).set_id;
  const f = s.rec();
  assert.equal(s.m.proposeInclusion({ setId: set, factId: f, by: MACHINE }).reason, "NO_METHOD");
  const p = s.m.proposeInclusion({ setId: set, factId: f, method: "same fund code and period", by: MACHINE });
  assert.equal(p.ok, true);
  let r = s.m.readSet({ setId: set, viewer: ANN });
  assert.deepEqual(r.inclusions, []);
  assert.deepEqual([r.proposals.length, r.proposals[0].method, r.proposals[0].by], [1, "same fund code and period", MACHINE]);
  assert.equal(r.proposals[0].label, word("screen.money.proposed"));
  const inc = s.m.include({ setId: set, factId: f, reason: "checked the fund code", by: ANN });
  assert.equal(inc.adopted_proposal, p.proposal_id);
  r = s.m.readSet({ setId: set, viewer: ANN });
  assert.deepEqual([r.inclusions.length, r.proposals.length], [1, 0]);
  assert.equal(s.m.readSet({ setId: "", viewer: ANN }).reason, "NO_SET");
  assert.equal(s.m.readSet({ setId: "MSR-2026-9999", viewer: ANN }).found, false);
});

test("R32 R12 R13 exclude closes a figure's open proposal exactly as include does: after either act readSet lists the figure once, never also under proposals; control: include still closes one", () => {
  const s = seeded();
  const set = s.m.createSet({ purpose: "trail", label: "t", by: ANN }).set_id;
  const f = s.rec();
  const p = s.m.proposeInclusion({ setId: set, factId: f, method: "same fund code and period", by: MACHINE });
  const ex = s.m.exclude({ setId: set, factId: f, reason: "a different project", by: ANN });
  assert.equal(ex.ok, true);
  assert.equal(ex.adopted_proposal, p.proposal_id);
  let r = s.m.readSet({ setId: set, viewer: ANN });
  assert.deepEqual([r.inclusions.length, r.proposals.length, r.exclusions.length], [0, 0, 1]);
  assert.deepEqual([r.exclusions[0].by, r.exclusions[0].reason], [ANN, "a different project"]);
  /* control: include closes an open proposal as before */
  const g = s.rec();
  const q = s.m.proposeInclusion({ setId: set, factId: g, method: "same fund code and period", by: MACHINE });
  const inc = s.m.include({ setId: set, factId: g, reason: "checked the fund code", by: ANN });
  assert.equal(inc.adopted_proposal, q.proposal_id);
  r = s.m.readSet({ setId: set, viewer: ANN });
  assert.deepEqual([r.inclusions.length, r.proposals.length], [1, 0]);
});

test("R33 a machine's proposal of a figure the set already includes or excludes holds no proposal: the member's latest act stands; control: a figure with no member act is held as a proposal", () => {
  const s = seeded();
  const set = s.m.createSet({ purpose: "trail", label: "t", by: ANN }).set_id;
  const f = s.rec();
  const g = s.rec();
  const h = s.rec();
  s.m.exclude({ setId: set, factId: f, reason: "a different project", by: ANN });
  const after = s.m.proposeInclusion({ setId: set, factId: f, method: "same fund code and period", by: MACHINE });
  assert.deepEqual([after.ok, after.already], [true, "excluded"]);
  let r = s.m.readSet({ setId: set, viewer: ANN });
  assert.deepEqual([r.inclusions.length, r.proposals.length, r.exclusions.length], [0, 0, 1]);
  s.m.include({ setId: set, factId: g, reason: "checked the fund code", by: ANN });
  const again = s.m.proposeInclusion({ setId: set, factId: g, method: "same fund code and period", by: MACHINE });
  assert.deepEqual([again.ok, again.already], [true, "included"]);
  r = s.m.readSet({ setId: set, viewer: ANN });
  assert.deepEqual([r.inclusions.length, r.proposals.length, r.exclusions.length], [1, 0, 1]);
  /* control: no member act, so the machine's proposal is held apart as before */
  const held = s.m.proposeInclusion({ setId: set, factId: h, method: "same fund code and period", by: MACHINE });
  assert.equal(held.already, undefined);
  r = s.m.readSet({ setId: set, viewer: ANN });
  assert.deepEqual([r.inclusions.length, r.proposals.length, r.exclusions.length], [1, 1, 1]);
});

test("R13 readSet answers only the facts the viewer may see", () => {
  const s = seeded();
  s.project("PROJ-1", "bob");
  const hidden = s.held("INFO-H", sha("hidden"), { project: "PROJ-1" });
  const set = s.m.createSet({ purpose: "trail", label: "t", by: BOB }).set_id;
  const h = s.rec({ source: { capture_sha: hidden }, by: BOB });
  s.m.include({ setId: set, factId: h, reason: "r", by: BOB });
  assert.equal(s.m.readSet({ setId: set, viewer: BOB }).inclusions.length, 1);
  assert.equal(s.m.readSet({ setId: set, viewer: OUTSIDER }).inclusions.length, 0);
});

test("R23 onFactChanged: one registration per module, refused through membership's listenerRefusal; listeners run in MODULE_ORDER inside the write", () => {
  const s = seeded();
  const heard = [];
  assert.equal(s.m.onFactChanged("calculations", (n) => heard.push(["calculations", n])).ok, true);
  assert.equal(s.m.onFactChanged("money-checks", (n) => heard.push(["money-checks", n])).ok, true);
  assert.equal(s.m.onFactChanged("calculations", () => {}).reason, "LISTENER_DECLARED");
  assert.equal(s.m.onFactChanged("x", "not a function").reason, "LISTENER_MALFORMED");
  const a = s.rec();
  assert.deepEqual(heard.map(([m, n]) => [m, n.factId, n.change]), [["money-checks", a, "added"], ["calculations", a, "added"]]);
  heard.length = 0;
  const adj = s.rec({ phase: "adjusted", stage: null, adjusts: a });
  assert.deepEqual(heard.filter(([m]) => m === "calculations").map(([, n]) => [n.factId, n.change]), [[adj, "added"], [a, "adjusted"]]);
  heard.length = 0;
  s.m.withdrawFact({ factId: a, reason: "dup", by: ANN });
  assert.deepEqual(heard.filter(([m]) => m === "calculations").map(([, n]) => [n.factId, n.change]), [[a, "withdrawn"]]);
  heard.length = 0;
  const set = s.m.createSet({ purpose: "trail", label: "t", by: ANN }).set_id;
  s.m.include({ setId: set, factId: adj, reason: "r", by: ANN });
  assert.deepEqual(heard.filter(([m]) => m === "calculations").map(([, n]) => [n.factId, n.change, n.setId]), [[adj, "set_changed", set]]);
});

test("R23 a listener that throws fails the write, and nothing is written", () => {
  const s = seeded();
  s.m.onFactChanged("calculations", () => { throw new Error("recompute failed"); });
  const r = s.m.recordFact(s.fact());
  assert.deepEqual([r.ok, r.reason], [false, "LISTENER_FAILED"]);
  assert.equal(s.one(`SELECT count(*) AS n FROM money_facts`).n, 0);
});
