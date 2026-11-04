/* action-plans R51 against ai-runs PR 213 (notice ai-runs:213; ai-runs R52, R92 with ai-use R3, R18): ai-runs' use check now
   names the account and entry an open is served on, so a provider limit standing on that account holds the open back and
   one standing on the member's other account does not. planAsk names no account (ai-runs picks the one serving the
   member's act, its R52), so this module needs no change: its own open arguments, captured from the act, are handed to
   ai-runs' real `open` (its test world, its own code), with only the world's ids put in place of this world's. A refusal
   from that open is planAsk's answer, passed through unchanged (R51). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { seeded, opened, by } from "./fixture.mjs";
import { world, PROJ, T0, ENTRIES } from "../ai-runs/world.mjs";
import { aiUseOf } from "../../../src/ai-use/index.mjs";

const PLN = "PLN-2026-0001";
const LATER = "2026-07-02T00:00:00Z";

async function askArgs() {
  const w = seeded();
  opened(w);
  const r = await w.ap.planAsk({ plan: w.PL, ...by("bob") });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(w.ctl.opens.length, 1);
  return w.ctl.opens[0];
}

/** bob, a joined member of ann's project, holding two accounts of his own, each holding claude-a. */
async function bobWorld() {
  const aw = world({ deployedModes: ["check", "plan"] });
  await aw.group("ann", "bob", { noAccount: ["bob"] });
  for (let i = 0; i < 2; i++) await aw.account("bob", "apikey", `secret-${i}-of-bob-0123456789`, { entries: [ENTRIES.a] });
  aw.project(PROJ, "ann", { joined: ["bob"] });
  aw.runs.registerOpenCheck("action-plans", "plan", () => null);
  return aw;
}
const limitOn = (aw, account_id) => aiUseOf(aw.ctx).recordProviderLimit({ owner: "member:bob", account_id, entry_id: ENTRIES.a,
  kind: "spend", scope: "account", resets_at: LATER, at: T0 });

test("notice ai-runs:213 (R51): planAsk names no account, so ai-runs judges the limit on the account serving the member; a provider limit on his other account does not hold the planning run back, one on the serving account does (AI_LIMIT_REACHED, nothing written)", async () => {
  const args = await askArgs();
  for (const k of ["account", "account_id", "entry_id", "accountId"]) assert.equal(k in args, false, `planAsk names no ${k}`);
  const aw = await bobWorld();
  const [head, other] = aw.accountsOf("member:bob");
  assert.equal((await aw.served("bob", { project: PROJ })).account_id, head, "the head serves bob's act");
  const openOn = (run) => aw.runs.open({ ...args, run, contextId: PROJ, plan: PLN, at: T0 });
  /* a limit standing on his other account leaves the planning run's open on the head */
  assert.equal(limitOn(aw, other).ok, true);
  const o = await openOn(args.run);
  assert.equal(o.started, true, JSON.stringify(o).slice(0, 300));
  /* the serving account's own provider limit holds a new open back, nothing written */
  assert.equal(limitOn(aw, head).ok, true);
  const before = aw.dump();
  const o2 = await openOn(`${args.run}B`);
  assert.deepEqual([o2.started, o2.code, o2.source], [false, "AI_LIMIT_REACHED", "provider"], JSON.stringify(o2).slice(0, 300));
  assert.equal(aw.dump(), before, "nothing written");
});

test("notice ai-runs:213 (R51): an open ai-runs refuses for its limit is planAsk's answer, passed through unchanged, and records no planning run", async () => {
  const w = seeded();
  opened(w);
  w.ctl.refuse = "AI_LIMIT_REACHED";
  const r = await w.ap.planAsk({ plan: w.PL, ...by("bob") });
  assert.equal(r.started, false);
  assert.equal(r.code, "AI_LIMIT_REACHED");
  w.ctl.refuse = null;
  const again = await w.ap.planAsk({ plan: w.PL, ...by("bob") });
  assert.equal(again.ok, true, JSON.stringify(again));
  assert.equal(again.existed, undefined, "the refused open left no running planning run behind");
});
