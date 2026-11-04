/* Notice ai-runs:213 (T53; ai-runs R52, ai-use R3, R18): ai-runs' open now judges a provider limit standing on the
   account the run is served on, refusing AI_LIMIT_REACHED (source provider). R10 opens its re-examination run "within
   its limits" and keeps a refusal without undoing anything, so this module confirms with no code change. Here this
   module's real code sends its open to ai-runs' real `open`, in ai-runs' own world, with only the values that name the
   world's member and project swapped for that world's (the argument names and the rest are this module's). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V } from "./fixture.mjs";
import { world as aiWorld, PROJ, T0, ENTRIES, agentWorker } from "../ai-runs/world.mjs";
import { aiUseOf } from "../../../src/ai-use/index.mjs";

/* ai-runs' real open takes more turns than the fixture's settle allows: wait (bounded) until the run's outcome is kept. */
const receive = async (w, action, at = "2026-10-03") => {
  const ord = w.correspond(action, "received", at);
  for (let i = 0; i < 200 && !(w.reexamined(action, ord)[0] || {}).run; i++) await new Promise((r) => setTimeout(r, 5));
  return ord;
};
const LATER = "2026-07-02T00:00:00Z";

/** ai-runs' world: ann holds two accounts of her own (each serving claude-a); her project PROJ. */
async function annRuns() {
  const a = aiWorld({ deployedModes: ["check", "plan"],
    env: { AGENT_WORKER: agentWorker({ status: 202, body: { accepted: true, run_id: "R1" } }), STORE: { idFromName: (n) => `id:${n}` }, AI_RUN_DISPATCH_WAIT_MS: "50" } });
  await a.group("ann", { noAccount: ["ann"] });
  for (let i = 0; i < 2; i++) await a.account("ann", "apikey", `secret-${i}-of-ann-0123456789`, { entries: [ENTRIES.a] });
  a.project(PROJ, "ann");
  /* mode plan's open check is action-plans' registration (ai-runs R47); passing every open, as ai-runs' own tests do */
  a.runs.registerOpenCheck("action-plans", "plan", () => null);
  return a;
}
const limitOn = (a, account_id) => aiUseOf(a.ctx).recordProviderLimit({ owner: "member:ann", account_id, entry_id: ENTRIES.a,
  kind: "spend", scope: "account", resets_at: LATER, at: T0 });

/** plan-work's world whose ai-runs is the real one in `a`: each open this module sends goes to ai-runs' open. */
function relayed(a) {
  const w = world();
  w.aiOpen = (x) => {
    const swap = (v) => (v === V("bob") ? "member:ann" : v === w.P ? PROJ : v);
    return a.runs.open({ ...Object.fromEntries(Object.entries(x).map(([k, v]) => [k, swap(v)])), at: T0 });
  };
  return w;
}

test("R10 (notice ai-runs:213): a provider limit on the account serving the re-examination run refuses its open AI_LIMIT_REACHED; the refusal is kept and the marks still stand", async () => {
  const a = await annRuns();
  const { account_id: head } = await a.served("ann", { project: PROJ });
  assert.equal(limitOn(a, head).ok, true);
  const w = relayed(a);
  const s = w.started({ subjects: [w.S1] });
  const ord = await receive(w, s.action);
  assert.equal(w.runs.length, 1, "one open was sent");
  const run = w.reexamined(s.action, ord)[0].run;
  assert.equal(run.opened, false, JSON.stringify(run).slice(0, 400));
  assert.equal(run.refused.code, "AI_LIMIT_REACHED");
  assert.equal(w.marksOf(w.PL).length, 1, "the marks written before the open stand");
  assert.deepEqual(w.pw.reexaminations({ plan: w.PL, viewer: V("bob") }).items.map((x) => [x.response, x.run.opened]),
    [[`${s.action}#${ord}`, false]]);
});

test("R10 (notice ai-runs:213) control: a provider limit on the member's other account leaves the re-examination run opened", async () => {
  const a = await annRuns();
  const { account_id: head } = await a.served("ann", { project: PROJ });
  const other = a.accountsOf("member:ann").find((id) => id !== head);
  assert.equal(limitOn(a, other).ok, true);
  const w = relayed(a);
  const s = w.started({ subjects: [w.S1] });
  const ord = await receive(w, s.action);
  const run = w.reexamined(s.action, ord)[0].run;
  assert.equal(run.opened, true, JSON.stringify(run).slice(0, 400));
  assert.equal(w.marksOf(w.PL).length, 1);
});
