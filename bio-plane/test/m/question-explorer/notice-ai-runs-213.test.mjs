/* question-explorer over ai-runs PR 213: ai-runs' open (and tick) now asks ai-use's limit check with the account and entry
   the act is served on, so a provider limit standing on that account holds the run back (AI_LIMIT_REACHED, source
   provider) and one standing on the owner's other account does not. The exploring run's open (R3) is the explorer's
   own; confirmed with no change here: replayed on ai-runs' real code (its published world, with steps' published world),
   it is held back by a limit on the serving account and starts past a limit on another; and the explorer, handed that
   refusal as ai-runs answered it, opens nothing that day: no run row, no system step, the question and owner considered
   refused (R1, R3, R17: a refused open is no run). */
/* (F1, ai-runs F2) The replays move the owner, and the member who turned exploring on (dana in the explorer's world), onto ann in ai-runs' world. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, Q } from "./fixture.mjs";
import { world as runsWorld, OPEN, INQ, T0, ENTRIES } from "../ai-runs/world.mjs";
import { stepsWorld } from "../steps/fixtures.mjs";
import { aiUseOf } from "../../../src/ai-use/index.mjs";

const LATER = "2026-07-02T00:00:00Z";

/** The explorer's own open for the group's account, as its tick sent it. */
async function explorersOpen() {
  const w = await world().standard();
  await w.openRun("group");
  const [open] = w.calledAs("open");
  assert.equal(open.contextId, Q);
  return open;
}

/** ai-runs' real world: `investigate` deployed and `check` verified live (run-rules R19's chain), and ann holding two
 *  accounts of her own, the first serving her acts. */
async function realRuns() {
  const f = stepsWorld();
  const r = runsWorld({ steps: f.steps, deployedModes: ["check", "investigate"] });
  await r.group("ann", { noAccount: ["ann"] });
  for (let i = 0; i < 2; i++) await r.account("ann", "apikey", `secret-${i}-of-ann-0123456789`, { entries: [ENTRIES.a] });
  r.bundle(INQ);
  const v = await r.runs.open(OPEN({ run: "V" }));
  assert.equal(v.started, true, JSON.stringify(v).slice(0, 300));
  assert.equal(r.runs.verificationRecord({ mode: "check", run: "V", evidence: ["seen live"], by: "member:ann", at: T0 }).ok, true);
  return { r, f };
}
const limitOn = (r, account_id) => aiUseOf(r.ctx).recordProviderLimit({ owner: "member:ann", account_id, entry_id: ENTRIES.a,
  kind: "spend", scope: "account", resets_at: LATER, at: T0 });

test("notice ai-runs:213 (R3; ai-runs R52): the explorer's open, on ai-runs' real code, is held back AI_LIMIT_REACHED (source provider) by a provider limit on the account serving its owner, nothing written; control: a limit on the owner's other account leaves it to start", async () => {
  const open = await explorersOpen();
  const { r, f } = await realRuns();
  const [head, other] = r.accountsOf("member:ann");
  assert.equal((await r.served("ann")).account_id, head, "the head serves her act");
  const moved = { ...open, contextId: INQ, place: f.place, at: T0, principalAi: "member:ann", enabledBy: "member:ann" };
  assert.equal(limitOn(r, other).ok, true);
  const x = await r.runs.open({ ...moved, run: "XPL-1" });
  assert.deepEqual([x.started, x.origin], [true, "explore"], JSON.stringify(x).slice(0, 300));
  assert.equal(limitOn(r, head).ok, true);
  const y = await r.runs.open({ ...moved, run: "XPL-2" });
  assert.deepEqual([y.started, y.code, y.source], [false, "AI_LIMIT_REACHED", "provider"], JSON.stringify(y).slice(0, 300));
  assert.equal(r.row(`SELECT run FROM ai_runs WHERE run='XPL-2'`), null);
});

test("notice ai-runs:213 (R1, R3, R17): handed ai-runs' real AI_LIMIT_REACHED refusal of its open, the explorer opens no run that day: no run row, no system step, the question considered refused; control: the next day, the open answered, it opens", async () => {
  const open = await explorersOpen();
  const { r, f } = await realRuns();
  const [head] = r.accountsOf("member:ann");
  assert.equal(limitOn(r, head).ok, true);
  const refusal = await r.runs.open({ ...open, run: "XPL-3", contextId: INQ, place: f.place, at: T0, principalAi: "member:ann", enabledBy: "member:ann" });
  assert.equal(refusal.code, "AI_LIMIT_REACHED", JSON.stringify(refusal).slice(0, 300));

  const w = await world().standard();
  await w.setExplore("group", "yes");
  w.openRefuse = refusal;
  const t = await w.p.exploreTick(w.clock.now);
  assert.equal(t.opened.length, 0, JSON.stringify(t).slice(0, 300));
  assert.ok(t.refused >= 1);
  assert.equal(w.calledAs("open").length >= 1, true, "the open was asked");
  assert.equal(w.count("explore_runs"), 0);
  assert.equal(w.calledAs("stepCreate").length, 0, "no system step");
  assert.equal(w.row(`SELECT outcome FROM explore_considered WHERE question=? AND owner='group'`, Q)?.outcome, "refused");
  /* control: the next day, the open answered, a run opens */
  w.openRefuse = null;
  w.clock.now = "2026-10-11T09:00:00Z";
  const t2 = await w.p.exploreTick(w.clock.now);
  assert.deepEqual(t2.opened.map((o) => o.owner), ["group"], JSON.stringify(t2).slice(0, 300));
  assert.equal(w.count("explore_runs"), 1);
});
