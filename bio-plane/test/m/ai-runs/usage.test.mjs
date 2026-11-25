/* ai-runs R52, R53, R72, R76 (T33-50; K1481, K1503, K1755; T40-8: N812, K2373, K2400; T41-23: D12, K2482): the account a
   run carries (the member's own, the project's, or the group's API key, the act still the member's) and its paying owner
   recorded on the run; the paying account's limits judged by `ai-use.useCheck` at the open and at each tick; each tick's
   conversations counted through `ai-use.countUsage` under the run's id, inside the tick's transaction; a run's cost
   answered to the paying account's owners alone; and the tables declared explicitly. The counter, the limits and the
   reads of use are `ai-use`'s (its R1–R4, R10, R11; this module's R48–R51 retired there): they are reached here through
   `aiUseOf` on the world's storage, as ai-runs reaches them. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, OPEN, INQ, PROJ, ANN, ORG, T0, USAGE, sha, agentWorker } from "./world.mjs";
import { aiUseOf, AI_USE_TABLES } from "../../../src/ai-use/index.mjs";
import { AI_RUNS_CHECKS } from "../../../src/run-rules/index.mjs";

const at = (s) => `2026-07-01T${s}Z`;
const ROWS = AI_RUNS_CHECKS;
const usageRows = (w) => w.rows(`SELECT * FROM ai_usage ORDER BY owner, member, day, use, mode`);
const actRows = (w) => w.rows(`SELECT * FROM ai_use_acts ORDER BY owner, act`);
/** Every row ai-use holds, for "nothing counted". */
const useDump = (w) => AI_USE_TABLES.map((t) => JSON.stringify(w.rows(`SELECT * FROM ${t.name} ORDER BY rowid`))).join("\n");
/** Every row this module and ai-use hold, and the observation log: "nothing written". */
const all = (w) => `${w.dump()}\n${useDump(w)}`;
/** One conversation's entry, `{mode, model, usage, calls}` (agent-worker R26, agent-model R6). */
const call = (mode = "check", over = {}, calls = 1) => ({ mode, model: "claude-model-x", usage: USAGE(over), calls });
/** A refusal carrying its row (R35: read by key from `run-rules`' table, its R20). */
function refused(r, code) {
  assert.equal(r.code, code, JSON.stringify(r).slice(0, 300));
  assert.equal(r.check, ROWS[code].check, code);
  assert.equal(r.translation, ROWS[code].translation, code);
}
/** ai-use's `AI_LIMIT_REACHED` (its R3, R13), relayed as it came: its own row, its own words, naming no cost. */
function limitReached(r) {
  assert.equal(r.code, "AI_LIMIT_REACHED", JSON.stringify(r).slice(0, 300));
  assert.equal(typeof r.check, "string");
  assert.equal(typeof r.translation, "string");
  for (const text of [r.translation, r.detail]) assert.equal(COST.test(text), false, text);
  /* B11 (K2516; ai-use R13): its sentence whole, every `{…}` filled before it reaches a member */
  assert.doesNotMatch(r.translation, /\{[^}]*\}/, r.translation);
}
/** K1450: a member is never told a cost; a refusal in plain words names none. */
const COST = /\$|usd|cost|dollar|price/i;
/** A limit on `owner`'s account, set by `by` (ai-use R2). */
function limit(w, owner, by, { scope = "overall", unit = "calls", period = "day", amount = 1 } = {}) {
  const r = aiUseOf(w.ctx).aiLimitSet({ owner, scope, unit, period, amount, by, at: T0 });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  return r;
}

async function useWorld(opts = {}) {
  const w = world(opts);
  await w.group("ann", "bob", "dan", { noAccount: ["dan"] });
  w.bundle(INQ);
  w.project(PROJ, "ann", { joined: ["bob", "dan"] });
  aiUseOf(w.ctx);
  return w;
}

test("R72, R52: tick takes usage, one entry per conversation {mode, model, usage, calls}; each is counted through ai-use under the run's paying owner, its member and use run (a null calls counting as one, never none), inside the tick's transaction; nothing of it reaches the run's log, an observation or a bundle", async () => {
  const w = await useWorld();
  await w.runs.open(OPEN());
  const logBefore = w.rows(`SELECT * FROM observation_log`);
  const bundlesBefore = w.rows(`SELECT * FROM bundles ORDER BY bundle_id`);
  const t = await w.runs.tick({ run: "R1", viewer: "admin", caller: ORG, at: at("00:05:00"),
    usage: [call("check", {}, 4), call("check", { input_tokens: 10, output_tokens: 5, total_cost_usd: 0.5 }, 1),
            call("check", { total_cost_usd: null }, null)] });
  assert.deepEqual([t.ticked, t.counted, t.appended], [true, 3, 0]);
  /* three conversations: 4 calls, 1 call, and one whose runner stated none, counted as one */
  assert.deepEqual(usageRows(w), [{ owner: "member:ann", member: "ann", day: "2026-07-01", use: "run", mode: "check", calls: 6,
    input_tokens: 2010, output_tokens: 405, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, cost_micro_usd: 512000,
    tokens_unstated: 0, cost_unstated: 1 }]);
  assert.deepEqual(w.rows(`SELECT * FROM observation_log`), logBefore, "no entry for the calls");
  assert.deepEqual(w.rows(`SELECT * FROM bundles ORDER BY bundle_id`), bundlesBefore);
  assert.equal(JSON.stringify(w.rows(`SELECT * FROM ai_runs`)).includes("claude-model-x"), false, "nothing of a call on the run");
  /* the counter joins the tick's transaction: a tick inside a caller's refused transaction counts nothing */
  const before = all(w);
  const out = w.record.transact(() => { w.runs.tick({ run: "R1", viewer: "admin", caller: ORG, at: at("00:06:00"), usage: [call()] });
    return { ok: false, reason: "CALLER_REFUSED" }; });
  assert.equal(out.reason, "CALLER_REFUSED");
  assert.equal(all(w), before);
  /* a member-kind credential's run is counted to that member, on that member's own account */
  await w.runs.open(OPEN({ run: "RB", principalPlane: "member:bob/t1", principalClaude: ANN }));
  await w.runs.tick({ run: "RB", viewer: "admin", caller: "member:bob/t1", at: at("00:07:00"), usage: [call("check")] });
  assert.deepEqual(w.row(`SELECT owner, use, calls FROM ai_usage WHERE member='bob'`), { owner: "member:bob", use: "run", calls: 1 });
  /* no usage, or an empty list: nothing counted and no `counted` key */
  const plain = await w.runs.tick({ run: "R1", viewer: "admin", caller: ORG, at: at("00:08:00"), usage: [] });
  assert.equal(plain.ticked, true);
  assert.equal("counted" in plain, false);
});

test("R72: a usage entry not of that shape refuses the whole tick AI_RUN_CONSUME_INVALID, counting nothing and writing nothing (no log entry, consumption, tick or count); a null figure, and estimated_cost_usd null, absent or an amount, are accepted and counted, a null as unstated, never as 0", async () => {
  const w = await useWorld();
  await w.runs.open(OPEN({ bounds: [{ bound: "fetches", allowed: 9 }] }));
  const look = { level: "document", subject: "https://example.org/a", state: "LOOKED_ABSENT", detail: "none" };
  const before = all(w);
  const { input_tokens: _drop, ...missing } = USAGE();
  for (const usage of [{}, "x", [null], [1], [{ model: "m", usage: USAGE(), calls: 1 }], [{ mode: "", model: "m", usage: USAGE(), calls: 1 }],
                       [{ mode: "check", model: 7, usage: USAGE(), calls: 1 }], [{ mode: "check", model: "m", calls: 1 }],
                       [{ mode: "check", model: "m", usage: [], calls: 1 }],
                       /* N588: `calls` absent, or neither null nor a positive whole number */
                       [{ mode: "check", model: "m", usage: USAGE() }], [call("check", {}, 0)], [call("check", {}, -1)], [call("check", {}, 1.5)],
                       [call("check", {}, "2")], [call("check", {}, Number.NaN)], [call("check", {}, Infinity)], [call("check", {}, 2 ** 53)],
                       [{ ...call(), calls: undefined }], [call("check", {}, true)], [call("check"), call("check", {}, [3])],
                       [{ mode: "check", model: "m", usage: missing, calls: 1 }], [call("check", { input_tokens: -1 })], [call("check", { output_tokens: 1.5 })],
                       [call("check", { cache_read_input_tokens: "5" })], [call("check", { total_cost_usd: -0.1 })],
                       [call("check", { total_cost_usd: Number.NaN })], [call("check", { estimated_cost_usd: -1 })],
                       [call("check", { estimated_cost_usd: "0.2" })],
                       /* a good entry before a bad one: the whole tick refused, the good one not counted either */
                       [call("check"), call("check", { cache_creation_input_tokens: Infinity })]]) {
    const r = await w.runs.tick({ run: "R1", viewer: "admin", caller: ORG, at: at("00:05:00"), usage, log: [look], consume: { fetches: 1 } });
    assert.deepEqual([r.ticked, r.found], [false, true], JSON.stringify(usage));
    refused(r, "AI_RUN_CONSUME_INVALID");
    assert.equal(typeof r.detail, "string");
    assert.equal("counted" in r, false, JSON.stringify(usage));
  }
  assert.equal(all(w), before, "no entry, figure, lease, tick or count");
  /* the control: every figure stated or null, estimated_cost_usd among them, is accepted; nulls count as unstated */
  const nulls = { input_tokens: null, output_tokens: null, cache_read_input_tokens: null, cache_creation_input_tokens: null,
                  total_cost_usd: null, estimated_cost_usd: null };
  assert.equal((await w.runs.tick({ run: "R1", viewer: "admin", caller: ORG, at: at("00:05:00"),
    usage: [{ mode: "check", model: null, usage: nulls, calls: null }] })).counted, 1);
  assert.deepEqual(w.row(`SELECT calls, input_tokens, cost_micro_usd, tokens_unstated, cost_unstated FROM ai_usage`),
    { calls: 1, input_tokens: 0, cost_micro_usd: 0, tokens_unstated: 1, cost_unstated: 1 });
  /* an estimated_cost_usd stated is the entry's cost (ai-use R1) */
  const est = await w.runs.tick({ run: "R1", viewer: "admin", caller: ORG, at: at("00:05:30"),
    usage: [call("check", { total_cost_usd: null, estimated_cost_usd: 0.25 }, 2)] });
  assert.deepEqual([est.ticked, est.counted], [true, 1]);
  assert.deepEqual(w.row(`SELECT calls, cost_micro_usd, cost_unstated FROM ai_usage`), { calls: 3, cost_micro_usd: 250000, cost_unstated: 1 });
  /* the order: the run's own refusals come first (an absent run is absent; a stranger is not its principal) */
  assert.equal((await w.runs.tick({ run: "R404", viewer: "admin", caller: ORG, usage: "x" })).found, false);
  assert.equal((await w.runs.tick({ run: "R1", viewer: "admin", caller: "class:ai/other", usage: "x" })).code, "AI_RUN_NOT_PRINCIPAL");
  /* R52: a run carrying no member (opened before T33-50) cannot have calls counted: refused by name, nothing written */
  w.sql.exec(`UPDATE ai_runs SET principal_claude = 'instance', principal_claude_ref = NULL WHERE run = 'R1'`);
  const was = all(w);
  const legacy = await w.runs.tick({ run: "R1", viewer: "admin", caller: ORG, at: at("00:09:00"), usage: [call()], log: [look] });
  assert.equal(legacy.ticked, false);
  refused(legacy, "AI_NO_ACCOUNT");
  assert.equal(all(w), was);
  assert.equal((await w.runs.tick({ run: "R1", viewer: "admin", caller: ORG, at: at("00:09:00"), log: [look] })).ticked, true,
    "without calls it ticks as before");
});

test("R52 (B5): open asks ai-use.useCheck for the paying account and the member's use run; once the account's limit is reached the open is refused AI_LIMIT_REACHED, relayed as ai-use answers it, naming no cost, nothing written; before it is reached the open lands", async () => {
  const w = await useWorld();
  /* ann's own account, one call a day */
  const set = limit(w, "member:ann", "member:ann", { amount: 1 });
  assert.equal(set.owner, "member:ann");
  /* the control: under the limit, the open lands */
  const first = await w.runs.open(OPEN({ at: at("00:01:00") }));
  assert.equal(first.started, true, JSON.stringify(first).slice(0, 300));
  /* the limit reached by the run's own counted call */
  assert.equal((await w.runs.tick({ run: "R1", viewer: "admin", caller: ORG, at: at("00:02:00"), usage: [call()] })).counted, 1);
  assert.notEqual(aiUseOf(w.ctx).useCheck({ owner: "member:ann", member: "member:ann", use: "run", at: at("00:03:00") }), null);
  const before = all(w);
  const o = await w.runs.open(OPEN({ run: "R2", at: at("00:03:00") }));
  assert.equal(o.started, false);
  limitReached(o);
  assert.deepEqual([o.whose, o.scope, o.unit, o.period, o.use], ["own", "overall", "calls", "day", "run"]);
  assert.equal("ok" in o, false, "the open's own shape: `started: false` leads");
  assert.equal(all(w), before, "nothing written");
  /* it is the paying account's limit alone (D38): bob, on his own account, is not held by ann's */
  const bob = await w.runs.open(OPEN({ run: "RB", principalPlane: "member:bob/t1", at: at("00:03:00") }));
  assert.equal(bob.started, true, JSON.stringify(bob).slice(0, 300));
  /* after the refusals that come before it: the id already open, an unknown re-run */
  assert.equal((await w.runs.open(OPEN({ run: "R1", at: at("00:03:00") }))).code, "AI_RUN_ALREADY_OPEN");
  assert.equal((await w.runs.open(OPEN({ run: "R2", rerunOf: "R404", at: at("00:03:00") }))).code, "AI_RUN_RERUN_UNKNOWN", "re-run first");
  /* the next local day the account is free again */
  assert.equal((await w.runs.open(OPEN({ run: "R3", at: "2026-07-02T00:00:00Z" }))).started, true);
});

test("R52 (B11, K2516): a monthly limit reached refuses the open and the tick AI_LIMIT_REACHED with its sentence whole (no `{…}` left), naming the month; control: under it both land", async () => {
  const w = await useWorld();
  limit(w, "member:ann", "member:ann", { period: "month", amount: 2 });
  const first = await w.runs.open(OPEN({ at: at("00:01:00") }));
  assert.equal(first.started, true, JSON.stringify(first).slice(0, 300));
  assert.equal((await w.runs.tick({ run: "R1", viewer: "admin", caller: ORG, at: at("00:02:00"), usage: [call("check", {}, 2)] })).ticked, true);
  /* later in the same month: the open and the tick both refused, each relayed whole */
  const o = await w.runs.open(OPEN({ run: "R2", at: "2026-07-20T00:00:00Z" }));
  assert.equal(o.started, false);
  limitReached(o);
  assert.equal(o.period, "month");
  const t = await w.runs.tick({ run: "R1", viewer: "admin", caller: ORG, at: "2026-07-20T00:00:00Z" });
  assert.equal(t.ticked, false);
  limitReached(t);
  assert.equal(t.period, "month");
  /* the next month the account is free again */
  assert.equal((await w.runs.open(OPEN({ run: "R3", at: "2026-08-01T12:00:00Z" }))).started, true);
});

test("R52, R72: a tick's usage is counted by ai-use under the run's paying owner, its member, use run and act the run's id, so actualOf answers the run's own measure; a malformed entry refuses the tick whole and counts nothing toward the act", async () => {
  const w = await useWorld();
  const u = aiUseOf(w.ctx);
  await w.runs.open(OPEN());
  await w.runs.open(OPEN({ run: "R2" }));
  /* the control: well-formed entries are counted, to the counter and to the run's act */
  const t = await w.runs.tick({ run: "R1", viewer: "admin", caller: ORG, at: at("00:05:00"), usage: [call("check", {}, 2), call("check", {}, 3)] });
  assert.deepEqual([t.ticked, t.counted], [true, 2]);
  assert.deepEqual(usageRows(w).map((r) => [r.owner, r.member, r.use, r.mode, r.calls]), [["member:ann", "ann", "run", "check", 5]]);
  assert.deepEqual(actRows(w).map((r) => [r.owner, r.act, r.use, r.mode, r.calls, r.tokens]), [["member:ann", "R1", "run", "check", 5, 2400]]);
  const a = u.actualOf({ act: "R1", viewer: "member:ann" });
  assert.deepEqual([a.found, a.owner, a.use, a.calls, a.tokens, a.cost], [true, "member:ann", "run", 5, 2400, { usd: 0.024 }]);
  /* another run of the same member is its own act */
  await w.runs.tick({ run: "R2", viewer: "admin", caller: ORG, at: at("00:05:30"), usage: [call("check", {}, 1)] });
  assert.deepEqual(actRows(w).map((r) => [r.act, r.calls]), [["R1", 5], ["R2", 1]]);
  /* a malformed entry: the whole tick refused, not one entry of it counted, to the counter or the act */
  const before = all(w);
  const bad = await w.runs.tick({ run: "R1", viewer: "admin", caller: ORG, at: at("00:06:00"),
    usage: [call("check", {}, 7), call("check", {}, 0)] });
  assert.equal(bad.ticked, false);
  refused(bad, "AI_RUN_CONSUME_INVALID");
  assert.equal(all(w), before);
  assert.equal(u.actualOf({ act: "R1", viewer: "member:ann" }).calls, 5, "the act's measure unchanged");
});

test("R52 (J5 (13)): a tick over the paying account's limit still counts its calls (they were made), answers counted, and is refused AI_LIMIT_REACHED, appending nothing, spending nothing and raising no tick; under the limit the same tick lands", async () => {
  const w = await useWorld();
  limit(w, "member:ann", "member:ann", { amount: 3 });
  await w.runs.open(OPEN({ bounds: [{ bound: "fetches", allowed: 9 }] }));
  const look = { level: "document", subject: "https://example.org/a", state: "LOOKED_ABSENT" };
  /* the control: two calls, under the limit — the tick lands, its entry appended and its fetch spent */
  const ok = await w.runs.tick({ run: "R1", viewer: "admin", caller: ORG, at: at("00:05:00"), usage: [call("check", {}, 2)],
    log: [look], consume: { fetches: 1 } });
  assert.deepEqual([ok.ticked, ok.counted, ok.appended], [true, 1, 1]);
  /* a third call: the limit reached by the use counted so far */
  assert.equal((await w.runs.tick({ run: "R1", viewer: "admin", caller: ORG, at: at("00:06:00"), usage: [call()] })).ticked, true);
  const runBefore = w.row(`SELECT * FROM ai_runs WHERE run='R1'`);
  const boundsBefore = w.rows(`SELECT * FROM ai_run_bounds WHERE run='R1' ORDER BY bound`);
  const logBefore = w.rows(`SELECT * FROM observation_log ORDER BY seq`);
  const t = await w.runs.tick({ run: "R1", viewer: "admin", caller: ORG, at: at("00:07:00"),
    usage: [call("check", {}, 2), call("check", {}, null)], log: [look], consume: { fetches: 1 } });
  assert.deepEqual([t.ticked, t.found, t.counted], [false, true, 2]);
  limitReached(t);
  assert.deepEqual(w.row(`SELECT * FROM ai_runs WHERE run='R1'`), runBefore, "no tick, no lease");
  assert.deepEqual(w.rows(`SELECT * FROM ai_run_bounds WHERE run='R1' ORDER BY bound`), boundsBefore, "nothing spent");
  assert.deepEqual(w.rows(`SELECT * FROM observation_log ORDER BY seq`), logBefore, "nothing appended");
  /* yet the calls it reports were counted: 3 before, 3 more (a null counting as one), to the counter and the act */
  assert.equal(w.row(`SELECT SUM(calls) n FROM ai_usage WHERE owner='member:ann'`).n, 6);
  assert.equal(w.row(`SELECT calls FROM ai_use_acts WHERE act='R1'`).calls, 6);
  /* over the limit, a malformed entry still counts nothing: refused as malformed */
  const was = all(w);
  const bad = await w.runs.tick({ run: "R1", viewer: "admin", caller: ORG, at: at("00:08:00"), usage: [call(), call("check", {}, 0)] });
  assert.equal(bad.ticked, false);
  refused(bad, "AI_RUN_CONSUME_INVALID");
  assert.equal(all(w), was);
  /* and a tick reporting no calls over the limit is refused, counting none */
  const none = await w.runs.tick({ run: "R1", viewer: "admin", caller: ORG, at: at("00:08:30"), log: [look] });
  assert.deepEqual([none.ticked, none.counted], [false, 0]);
  limitReached(none);
  assert.equal(all(w), was);
});

test("R76: read and close answer the run's cost (ai-use.actualOf for the run) to the paying account's owner alone, final once the run has ended; another member who sees the run, an administrator included, gets no cost key at all", async () => {
  const w = await useWorld();
  await w.runs.open(OPEN());
  await w.runs.tick({ run: "R1", viewer: "admin", caller: ORG, at: at("00:05:00"), usage: [call("check", {}, 2)] });
  /* the owner: ann's own account pays */
  const mine = (await w.runs.read({ run: "R1", viewer: ANN })).session;
  assert.deepEqual(mine.cost && [mine.cost.final, mine.cost.owner, mine.cost.calls, mine.cost.tokens, mine.cost.cost],
    [false, "member:ann", 2, 1200, { usd: 0.012 }], JSON.stringify(mine.cost));
  /* the negative control: others who see the run, the founder and another administrator among them */
  for (const viewer of ["member:bob", "admin", "member:second"]) {
    const r = await w.runs.read({ run: "R1", viewer });
    assert.equal(r.found, true, viewer);
    assert.equal("cost" in r.session, false, viewer);
  }
  /* close, read by its viewer: the owner is answered the final cost */
  const closed = await w.runs.close({ run: "R1", bound: "completed", caller: ORG, viewer: ANN, at: at("00:06:00") });
  assert.equal(closed.terminated, true, JSON.stringify(closed).slice(0, 300));
  assert.deepEqual([closed.cost.final, closed.cost.calls, closed.cost.cost], [true, 2, { usd: 0.012 }]);
  assert.equal((await w.runs.read({ run: "R1", viewer: ANN })).session.cost.final, true);
  assert.equal("cost" in (await w.runs.read({ run: "R1", viewer: "member:bob" })).session, false);
  /* a close whose viewer is not the paying account's owner answers no cost key */
  await w.runs.open(OPEN({ run: "R2" }));
  await w.runs.tick({ run: "R2", viewer: "admin", caller: ORG, at: at("00:07:00"), usage: [call()] });
  const other = await w.runs.close({ run: "R2", bound: "completed", caller: ORG, viewer: "admin", at: at("00:08:00") });
  assert.equal(other.terminated, true);
  assert.equal("cost" in other, false);
  assert.equal((await w.runs.read({ run: "R2", viewer: ANN })).session.cost.final, true, "the owner still reads it");
});

test("R52, R19: a run carries the account of the member whose act started it — the session member, else the member a member-kind key acts for, else the member a machine credential names — recorded as principal_claude (the paying owner) and principal_claude_ref (the member), both answered by R19's principal; with no member's act AI_RUN_NOT_A_MEMBER_ACT (run-rules R18, K1606), with none held AI_NO_ACCOUNT, before anything is written", async () => {
  const w = await useWorld();
  const before = all(w);
  /* a machine credential naming no member, or a level word: no member's act at all (run-rules R18, relayed, K1606) */
  for (const principalClaude of ["instance", "project", "member", "class:ai/x"])
    refused(await w.runs.open(OPEN({ principalClaude })), "AI_RUN_NOT_A_MEMBER_ACT");
  /* a member who holds no account: by session, by their own key, or named by a machine credential */
  refused(await w.runs.open(OPEN({ contextType: "project", contextId: PROJ, actor: "dan", viewer: "member:dan", principalPlane: "member:dan" })), "AI_NO_ACCOUNT");
  refused(await w.runs.open(OPEN({ principalPlane: "member:dan/t1" })), "AI_NO_ACCOUNT");
  const named = await w.runs.open(OPEN({ principalClaude: "member:dan" }));
  assert.equal(named.started, false);
  refused(named, "AI_NO_ACCOUNT");
  assert.equal(COST.test(named.translation + named.detail), false);
  assert.equal(all(w), before, "nothing written");
  /* after the earlier refusals: a malformed request is still its own refusal */
  assert.equal((await w.runs.open(OPEN({ principalClaude: "instance", skillVersion: "" }))).code, "AI_RUN_SKILL_VERSION_UNNAMED");
  assert.equal((await w.runs.open(OPEN({ principalClaude: "instance", rerunOf: "R404" }))).code, "AI_RUN_RERUN_UNKNOWN");
  /* the account member, in each case */
  const opened = async (run, o) => { const r = await w.runs.open(OPEN({ run, ...o })); assert.equal(r.started, true, JSON.stringify(r));
    return w.row(`SELECT principal_claude, principal_claude_ref FROM ai_runs WHERE run=?`, run); };
  const bob = { principal_claude: "member:bob", principal_claude_ref: "member:bob" };
  assert.deepEqual(await opened("S1", { contextType: "project", contextId: PROJ, actor: "bob", viewer: "member:bob", principalPlane: "member:bob",
                                         principalClaude: "member:ann" }), bob, "a session's own account, whatever the body names");
  assert.deepEqual(await opened("K1", { principalPlane: "member:bob/t1", principalClaude: "member:ann" }), bob, "a member key's member");
  assert.deepEqual(await opened("M1", { principalClaude: "member:bob" }), bob, "the member a machine credential names");
  const p = (await w.runs.read({ run: "M1", viewer: "admin" })).session.principal;
  assert.deepEqual([p.claude, p.ref], ["member:bob", "member:bob"]);
});

test("R52 (K1755): a member with no account of their own is served by the group's API key while it is held and on — the run opens as that member's act (principal_claude the group's key, principal_claude_ref the member), its use counted to the group's account and that member, held by the group account's limits; the key off or removed, AI_NO_ACCOUNT; ai-accounts' other refusals (the key's notice unread) relayed as given; nothing written on any refusal", async () => {
  const w = await useWorld();
  const C = w.aiAccounts;
  const danOpen = (run, over = {}) => w.runs.open(OPEN({ run, contextType: "project", contextId: PROJ, actor: "dan", viewer: "member:dan",
                                                          principalPlane: "member:dan", ...over }));
  /* no key yet: dan has no assistant */
  const before = all(w);
  refused(await danOpen("D0"), "AI_NO_ACCOUNT");
  /* held but off (off when first set): still none */
  assert.equal((await C.groupKeySet({ key: "group-key-secret", by: "admin" })).ok, true);
  refused(await danOpen("D0"), "AI_NO_ACCOUNT");
  /* on, the notice unread: accountFor refuses GROUP_KEY_NOTICE_DUE (ai-accounts R8), relayed with its row */
  assert.equal(C.groupKeySwitch({ on: true, by: "admin" }).ok, true);
  const due = await danOpen("D0");
  assert.deepEqual([due.started, due.code], [false, "GROUP_KEY_NOTICE_DUE"], JSON.stringify(due).slice(0, 300));
  assert.equal(typeof due.check, "string");
  assert.equal(typeof due.translation, "string");
  assert.equal(all(w), before, "nothing written on any refusal");
  /* the notice read: the run opens, and it is dan's act */
  assert.equal(C.groupKeyNoticeSeen({ member: "member:dan", by: "member:dan" }).ok, true);
  const o = await danOpen("D1");
  assert.equal(o.started, true, JSON.stringify(o).slice(0, 300));
  /* R52 (T41): the paying owner is the group's key, and the act is dan's */
  assert.deepEqual(w.row(`SELECT principal_claude, principal_claude_ref FROM ai_runs WHERE run='D1'`),
    { principal_claude: "group", principal_claude_ref: "member:dan" });
  const p = (await w.runs.read({ run: "D1", viewer: "member:dan" })).session.principal;
  assert.deepEqual([p.claude, p.ref], ["group", "member:dan"]);
  assert.equal(JSON.stringify(w.rows(`SELECT * FROM ai_runs`)).includes("group-key-secret"), false, "the key enters no record");
  assert.equal(JSON.stringify(o).includes("group-key-secret"), false);
  /* its use is the group account's, and dan's within it */
  await w.runs.tick({ run: "D1", viewer: "member:dan", actor: "dan", caller: "member:dan", at: at("00:05:00"), usage: [call("check", {}, 2)] });
  assert.deepEqual(w.rows(`SELECT owner, member, use, calls FROM ai_usage`), [{ owner: "group", member: "dan", use: "run", calls: 2 }]);
  /* the group account's limits hold dan's run: a per-member limit of two calls a day, set by an administrator */
  limit(w, "group", "admin", { scope: "per_member", amount: 2 });
  const capped = await danOpen("D2", { at: at("00:06:00") });
  limitReached(capped);
  assert.equal(capped.whose, "group");
  /* the control: ann, on her own account, is not held by the group's limits */
  assert.equal((await w.runs.open(OPEN({ run: "A1", at: at("00:06:00") }))).started, true);
  limit(w, "group", "admin", { scope: "per_member", amount: null });
  assert.equal((await danOpen("D2", { at: at("00:06:30") })).started, true, "the limit removed, dan's run opens");
  /* the key switched off: dan has none again */
  assert.equal(C.groupKeySwitch({ on: false, by: "admin" }).ok, true);
  const was = all(w);
  refused(await danOpen("D3", { at: at("00:07:00") }), "AI_NO_ACCOUNT");
  assert.equal(all(w), was);
});

test("R52 (T41; ai-accounts R11): a run over a project whose own account is held and on is paid by the project (principal_claude project:<id>, principal_claude_ref the member), its use counted to the project's account and that member, its cost answered to the project's owner and not to the member whose act it is; without the project's account the member's own pays", async () => {
  const w = await useWorld();
  const C = w.aiAccounts;
  const bobOpen = (run, over = {}) => w.runs.open(OPEN({ run, contextType: "project", contextId: PROJ, actor: "bob", viewer: "member:bob",
                                                          principalPlane: "member:bob", ...over }));
  /* the control: no project account, bob's own pays */
  assert.equal((await bobOpen("P0")).started, true);
  assert.deepEqual(w.row(`SELECT principal_claude, principal_claude_ref FROM ai_runs WHERE run='P0'`),
    { principal_claude: "member:bob", principal_claude_ref: "member:bob" });
  /* ann, the project's owner, holds a key for it and switches it on */
  assert.equal((await C.projectKeySet({ project: PROJ, key: "project-key-secret", by: "member:ann" })).ok, true);
  assert.equal(C.projectAccountSwitch({ project: PROJ, on: true, by: "member:ann" }).ok, true);
  /* bob's notice unread: ai-accounts' refusal relayed, nothing written */
  const before = all(w);
  const due = await bobOpen("P1");
  assert.deepEqual([due.started, due.code], [false, "PROJECT_KEY_NOTICE_DUE"], JSON.stringify(due).slice(0, 300));
  assert.equal(all(w), before, "nothing written");
  assert.equal(C.projectKeyNoticeSeen({ member: "member:bob", project: PROJ, by: "member:bob" }).ok, true);
  const o = await bobOpen("P1");
  assert.equal(o.started, true, JSON.stringify(o).slice(0, 300));
  assert.deepEqual(w.row(`SELECT principal_claude, principal_claude_ref FROM ai_runs WHERE run='P1'`),
    { principal_claude: `project:${PROJ}`, principal_claude_ref: "member:bob" });
  assert.equal(JSON.stringify(w.rows(`SELECT * FROM ai_runs`)).includes("project-key-secret"), false, "the key enters no record");
  await w.runs.tick({ run: "P1", viewer: "member:bob", actor: "bob", caller: "member:bob", at: at("00:05:00"), usage: [call("check", {}, 2)] });
  assert.deepEqual(w.rows(`SELECT owner, member, use, calls FROM ai_usage WHERE owner LIKE 'project:%'`),
    [{ owner: `project:${PROJ}`, member: "bob", use: "run", calls: 2 }]);
  /* R76: the cost to the project's owner, not to bob, whose act it is */
  assert.equal((await w.runs.read({ run: "P1", viewer: ANN })).session.cost.owner, `project:${PROJ}`);
  assert.equal("cost" in (await w.runs.read({ run: "P1", viewer: "member:bob" })).session, false);
  /* the project's own limits hold the run */
  limit(w, `project:${PROJ}`, "member:ann", { amount: 2 });
  const capped = await bobOpen("P2", { at: at("00:06:00") });
  limitReached(capped);
  assert.equal(capped.whose, "project");
});

test("R72, R18: a provider's refusal for a spent limit (429 enforced_spend_limit_reached) at the wake's dispatch is a plain LIMIT, never an error; its log entry says so without an error code or a cost", async () => {
  const TOKEN = "instance-ai-secret-value-7f3c";
  const aw = agentWorker({ status: 429, body: { ok: false, reason: "enforced_spend_limit_reached" } });
  const x = world({ env: { AGENT_WORKER: aw, INSTANCE_AI_TOKEN: TOKEN, STORE: { idFromName: (n) => `id:${n}` }, AI_RUN_DISPATCH_WAIT_MS: "50" } });
  await x.group("ann");
  x.bundle(INQ);
  x.ctx.id = { equals: (v) => v === "id:bio" };
  x.credentials.aiCredentialMint({ who: "admin", tokenId: "tok-org", secretSha: sha(TOKEN), principalKind: "organisation",
    taskScope: "investigative", writes: ["airuntick"], note: "the instance's key" });
  const cred = x.credentials.aiCredentialLook({ secretSha: sha(TOKEN) }).credential;
  await x.runs.open(OPEN({ principalPlane: `${cred.principal}/${cred.tokenId}` }));
  const reqs = [{ request: "q1", state: "captured" }];
  x.runs.registerWaitSource("capture-requests", { tickMs: () => 5000, configured: () => true, holds: () => [],
    woken: () => (reqs[0].woken ? [] : ["R1"]), completions: () => (reqs[0].woken ? [] : [{ request: "q1", state: "captured" }]),
    markWoken: () => { reqs[0].woken = true; } });
  const k = await x.runs.wake(Date.parse(at("00:00:10")));
  const d = k.wakes[0].dispatch;
  assert.deepEqual([d.state, d.provider_limit, k.dispatched], ["LIMIT", true, 0], JSON.stringify(d));
  assert.equal(aw.calls.length, 1, "the dispatch was made, carrying ann's account");
  assert.equal(aw.calls[0].body.account.member, "member:ann");
  const last = x.rows(`SELECT detail FROM observation_log WHERE authority='R1' ORDER BY seq`).pop().detail;
  assert.match(last, /^Resumption: not continued now — The Claude account that serves this run has reached the spending limit/);
  assert.equal(/did not complete|REFUSED|429/.test(last), false);
  assert.equal(COST.test(last), false, last);
  /* the control: any other refusal is REFUSED, said as the dispatch not completing */
  const aw2 = agentWorker({ status: 500, body: { ok: false, reason: "overloaded_error" } });
  const y = world({ env: { AGENT_WORKER: aw2, INSTANCE_AI_TOKEN: TOKEN, STORE: { idFromName: (n) => `id:${n}` }, AI_RUN_DISPATCH_WAIT_MS: "50" } });
  await y.group("ann");
  y.bundle(INQ);
  y.ctx.id = { equals: (v) => v === "id:bio" };
  y.credentials.aiCredentialMint({ who: "admin", tokenId: "tok-org", secretSha: sha(TOKEN), principalKind: "organisation",
    taskScope: "investigative", writes: ["airuntick"], note: "the instance's key" });
  await y.runs.open(OPEN({ principalPlane: `${cred.principal}/${cred.tokenId}` }));
  const reqs2 = [{ request: "q1", state: "captured" }];
  y.runs.registerWaitSource("capture-requests", { tickMs: () => 5000, configured: () => true, holds: () => [],
    woken: () => (reqs2[0].woken ? [] : ["R1"]), completions: () => (reqs2[0].woken ? [] : [{ request: "q1", state: "captured" }]),
    markWoken: () => { reqs2[0].woken = true; } });
  const k2 = await y.runs.wake(Date.parse(at("00:00:10")));
  assert.equal(k2.wakes[0].dispatch.state, "REFUSED");
  assert.equal("provider_limit" in k2.wakes[0].dispatch, false);
});

test("R53: the module's tables are declared explicitly through record-core's declareTable, ai_runs, ai_run_bounds and inquiry_run_surfacings with a run's sight, as R38 purges them; the counter and the limits are no longer this module's (ai-use R7), and a bundle's purge leaves them", async () => {
  const w = await useWorld();
  const decl = Object.fromEntries(w.record.declaredTables().filter((t) => t.module === "ai-runs").map((t) => [t.name, t]));
  assert.deepEqual(Object.keys(decl).sort(), ["ai_group_tests", "ai_mode_verifications", "ai_run_bounds", "ai_run_looks",
                                               "ai_runs", "ai_test_bar", "inquiry_run_surfacings"]);
  for (const t of Object.values(decl))
    assert.deepEqual([t.purge, t.expunge, t.export, t.derive, t.version_chain], ["clear", "none", "admin-only", "stored", false], t.name);
  /* T41: R73's step looks and R75's test bar and group test matters, group-wide, as the verifications are */
  const groupWide = ["ai_mode_verifications", "ai_run_looks", "ai_test_bar", "ai_group_tests"];
  assert.deepEqual(groupWide.map((n) => [decl[n].sight, decl[n].keys]), groupWide.map(() => ["group", []]));
  assert.deepEqual(["ai_runs", "ai_run_bounds", "inquiry_run_surfacings"].map((n) => decl[n].sight), ["bundle", "bundle", "bundle"]);
  assert.deepEqual([decl.ai_runs.keys, decl.ai_run_bounds.keys, decl.inquiry_run_surfacings.keys], [[], [], undefined]);
  /* ai_usage is declared, by ai-use */
  assert.equal(w.record.declaredTables().find((t) => t.name === "ai_usage").module, "ai-use");
  /* a bundle's purge leaves the counted use of a run over it; the whole store's clears it */
  await w.runs.open(OPEN());
  await w.runs.tick({ run: "R1", viewer: "admin", caller: ORG, at: at("00:05:00"), usage: [call()] });
  w.purge({ bundleId: INQ });
  assert.equal(w.count("ai_usage"), 1);
  w.purge({});
  assert.deepEqual([w.count("ai_runs"), w.count("ai_usage")], [0, 0]);
});
