/* action-plans R51: a member's "Ask the assistant for options" opens the plan's planning run, and never records the
   member's own proposal. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { seeded, opened, option, V, MACHINE, by } from "./fixture.mjs";
import { noSuchPlan, actionPlansOps } from "../../../src/action-plans/index.mjs";

const code = (r) => r.code ?? r.reason;
const ask = (w, extra = {}) => w.ap.planAsk({ plan: w.PL, ...by("bob"), ...extra });
/* what the plan holds of the member's and the assistant's work: none of it may change on an ask */
const held = (w) => JSON.stringify([w.text(w.PL), w.rows(`SELECT * FROM plan_options`), w.rows(`SELECT * FROM plan_option_proposals`),
  w.rows(`SELECT * FROM plan_history`), w.rows(`SELECT * FROM plans`)]);

test("R51: a member's ask opens one planning run naming the plan, its project and the member, and records no option, proposal or disposition", async () => {
  const w = seeded();
  opened(w);
  option(w);
  const before = held(w);
  const r = await ask(w);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(Object.keys(r).sort(), ["ok", "plan", "run", "started"]);
  assert.equal(r.plan, w.PL); assert.equal(r.started, true);
  assert.equal(w.ctl.opens.length, 1, "one run opened");
  const o = w.ctl.opens[0];
  assert.deepEqual([o.run, o.contextType, o.contextId, o.mode, o.plan, o.actor, o.viewer],
    [r.run, "project", w.P, "plan", w.PL, V("bob"), V("bob")]);
  assert.equal(o.principalPlane, V("bob")); assert.equal(o.principalAi, V("bob")); assert.equal("principalClaude" in o, false);
  assert.equal(typeof o.skillVersion, "string"); assert.ok(o.skillVersion);
  assert.ok(o.bounds.some((b) => b.bound === "proposals" && b.allowed > 0), "the proposals bound");
  assert.equal(w.runs.get(r.run).plan, w.PL);
  assert.deepEqual(w.ap.planRead({ id: w.PL, viewer: V("bob") }).planning_runs.map((x) => x.run), [r.run], "the run reaches the tray");
  assert.equal(held(w), before, "no option, proposal, disposition or entry was recorded");
});

test("R51: while a planning run of the plan is running, a second ask answers that run and opens none; once it has ended a new ask opens a new run", async () => {
  const w = seeded();
  opened(w);
  const first = await ask(w);
  const again = await ask(w);
  assert.deepEqual(again, { ok: true, plan: w.PL, run: first.run, started: false, existed: true });
  assert.equal(w.ctl.opens.length, 1, "no second run");
  const other = await ask(w, { author: V("alice"), viewer: V("alice") });
  assert.equal(other.run, first.run, "any member who has joined is answered the running run");
  assert.equal(w.ctl.opens.length, 1);
  /* control: asks at once open one run */
  const w2 = seeded();
  opened(w2);
  const [a, b] = await Promise.all([ask(w2), ask(w2)]);
  assert.equal(a.run, b.run); assert.equal(w2.ctl.opens.length, 1);
  assert.deepEqual([a.started, b.started].sort(), [false, true]);
  /* control: a run that has ended is not a running one, and a run of another plan is not this plan's */
  w.runs.get(first.run).status = "stopped";
  const next = await ask(w);
  assert.equal(next.started, true); assert.notEqual(next.run, first.run); assert.equal(w.ctl.opens.length, 2);
  const plan2 = w.ap.planOpen({ project: w.P, subjects: [w.S2], title: "Other", ...by("bob") }).id;
  const there = await w.ap.planAsk({ plan: plan2, ...by("bob") });
  assert.equal(there.started, true); assert.notEqual(there.run, next.run);
});

test("R51: refusals in order, each writing nothing: a machine or unstamped author, no such plan (absent and unseen alike), a closed plan, then the open's own, passed through unchanged", async () => {
  const w = seeded();
  opened(w);
  const before = held(w);
  assert.equal(code(await ask(w, { author: MACHINE, viewer: MACHINE })), "MACHINE_CANNOT_PLAN");
  assert.equal(code(await ask(w, { author: undefined, viewer: V("bob") })), "MACHINE_CANNOT_PLAN", "an unstamped author");
  assert.equal(code(await w.ap.planAsk({ plan: "PLN-2026-0999-plan", author: MACHINE, viewer: MACHINE })), "MACHINE_CANNOT_PLAN",
    "the machine is refused before the plan is looked for");
  assert.deepEqual(await w.ap.planAsk({ plan: "PLN-2026-0999-plan", ...by("bob") }), noSuchPlan("PLN-2026-0999-plan"));
  assert.deepEqual(await ask(w, by("dave")), noSuchPlan(w.PL), "a plan the member may not see is answered as an absent one");
  /* the open's own refusals: a member who has not joined (R30's fence), and a mode not deployed */
  const carol = await ask(w, by("carol"));
  assert.equal(code(carol), "PROJECT_ACT_NOT_A_PARTICIPANT");
  assert.equal(carol.started, false, "the open's refusal in its own shape, unchanged");
  w.ctl.refuse = "AI_RUN_MODE_NOT_DEPLOYED";
  const off = await ask(w);
  assert.equal(code(off), "AI_RUN_MODE_NOT_DEPLOYED"); assert.equal(off.started, false);
  w.ctl.refuse = null;
  assert.equal(w.runs.size, 0, "no run was opened by any refusal");
  assert.equal(held(w), before);
  w.ap.planClose({ id: w.PL, reason: "closing", ...by("bob") });
  const closed = held(w);
  assert.equal(code(await ask(w)), "PLAN_CLOSED");
  assert.equal(code(await ask(w, by("carol"))), "PLAN_CLOSED", "a closed plan is refused before the open's refusals");
  assert.equal(w.runs.size, 0); assert.equal(held(w), closed);
  /* control: the same ask by a joined member on an open plan lands, and a paused plan may be asked about */
  const w2 = seeded();
  opened(w2);
  assert.equal(w2.ap.planPause({ id: w2.PL, reason: "waiting", ...by("bob") }).ok, true);
  assert.equal((await ask(w2)).started, true);
});

test("R51: a member who has not joined is not answered a running run, and a provider the ask needs that is absent refuses by name", async () => {
  const w = seeded();
  opened(w);
  assert.equal((await ask(w)).started, true);
  assert.equal(code(await ask(w, by("carol"))), "PROJECT_ACT_NOT_A_PARTICIPANT");
  assert.deepEqual(await ask(w, by("dave")), noSuchPlan(w.PL));
  const bare = seeded({ omit: ["aiRuns"] });
  opened(bare);
  assert.equal(code(await ask(bare)), "PLAN_PROVIDER_UNAVAILABLE");
});

test("R51: a member's optionpropose still records her own proposal and opens no run; op=planask is the ask", async () => {
  const w = seeded();
  opened(w);
  const mine = await w.ap.optionPropose({ plan: w.PL, summary: "Mine", category: "other", subjects: [w.S1], why: "I think so",
    proposer: V("bob"), viewer: V("bob") });
  assert.equal(mine.ok, true);
  assert.equal(w.ctl.opens.length, 0, "no run opened by her proposal");
  assert.equal(w.rows(`SELECT machine, run FROM plan_option_proposals`).map((x) => [x.machine, x.run]).join(";"), "0,", "her own, not machine work");
  const ops = actionPlansOps(w.ap, new URL(`http://plane/?op=planask&plan=${w.PL}&author=${encodeURIComponent(V("bob"))}&viewer=${encodeURIComponent(V("bob"))}`), {});
  const viaOp = await ops.planask();
  assert.equal(viaOp.ok, true); assert.equal(viaOp.started, true);
  assert.equal(w.ctl.opens.length, 1);
  assert.equal(w.rows(`SELECT COUNT(*) AS n FROM plan_option_proposals`)[0].n, 1, "the ask recorded no proposal");
  /* the body cannot name the author: the stamps are the query's */
  const spoof = await actionPlansOps(w.ap, new URL(`http://plane/?op=planask&plan=${w.PL}&author=${encodeURIComponent(MACHINE)}&viewer=${encodeURIComponent(MACHINE)}`),
    { author: V("bob"), viewer: V("bob") }).planask();
  assert.equal(code(spoof), "MACHINE_CANNOT_PLAN");
});
