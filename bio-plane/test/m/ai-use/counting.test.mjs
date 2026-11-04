/* ai-use R1 (counting, T53's neutral record), R7 (the tables) and R8 (its codes and their rows), at the interface, each with
   a negative control (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, standard, usage, label, WORDS, ENTRIES } from "./fixture.mjs";
import { AI_USE_CHECKS, AI_USE_TABLES, AI_USE_WORDS, NOT_RECORDED } from "../../../src/ai-use/index.mjs";
import { AI_RUNS_CHECKS } from "../../../src/run-rules/index.mjs";

const AT = "2026-10-09T12:00:00Z";
const counter = (w) => w.rows(`SELECT * FROM ai_usage ORDER BY owner, member, day, use, mode`);
const use = (w, owner = "member:ann", viewer = "ann", u = "run") => w.u.aiUsage({ owner, viewer, at: AT }).uses.find((x) => x.use === u);

test("R1 (T53) two calls, one stating a cost and one stating none but priced, sum into cost_reported_sum and cost_estimated_sum apart; a call with neither adds to unpriced_calls and no sum; an unstated cache_read stays unstated (control: a negative token count is refused, counting nothing)", async () => {
  const w = await standard();
  const one = (u) => w.u.countUsage({ owner: "member:ann", member: "ann", use: "run", mode: "run", entry_id: ENTRIES.priced, label: label(), usage: u, calls: 1, at: AT });
  assert.equal(one(usage(10, 0, null, { reported: 0.5 })).ok, true);
  assert.equal(one(usage(10, 0, 0.25)).ok, true);
  assert.equal(one(usage(10, 0, null, { cache_read_input_tokens: null })).ok, true);
  const u = use(w);
  assert.deepEqual([u.cost_reported_sum, u.cost_estimated_sum, u.unpriced_calls, u.calls], [{ usd: 0.5 }, { usd: 0.25 }, 1, 3]);
  assert.ok(u.unstated.includes("cache_read_input_tokens"), "the unstated figure stays named");
  assert.equal(u.cost, undefined, "money is measured, so no cost: null");
  const before = w.snapshot();
  const r = one(usage(-1, 0, 0.1));
  assert.deepEqual([r.ok, r.code], [false, "AI_RUN_CONSUME_INVALID"]);
  assert.equal(w.snapshot(), before, "nothing was counted");
});

test("R1 (T53) the counter is kept per owner, member, local day, use and mode: the token sums (reasoning included) and the calls; a second count on the same key adds, another key is its own row; reported and estimated are never added together", async () => {
  const w = await standard();
  w.count("project:P", "bob", "run", { mode: "explore-run", usage: usage(100, 20, 0.5, { cache_read_input_tokens: 3, cache_creation_input_tokens: 4, reasoning_tokens: 6 }), calls: 2 });
  w.count("project:P", "bob", "run", { mode: "explore-run", usage: usage(1, 2, 0.25, { reported: 0.4 }), calls: 3 });
  w.count("group", "bob", "ask", { usage: usage(7, 0, null) });
  const rows = counter(w);
  assert.equal(rows.length, 2);
  const p = rows.find((r) => r.owner === "project:P");
  assert.deepEqual({ member: p.member, day: p.day, use: p.use, calls: p.calls, input: p.input_tokens, output: p.output_tokens,
    cr: p.cache_read_input_tokens, cw: p.cache_creation_input_tokens, reasoning: p.reasoning_tokens },
    { member: "bob", day: "2026-10-09", use: "run", calls: 5, input: 101, output: 22, cr: 3, cw: 4, reasoning: 6 });
  const money = w.rows(`SELECT unit, reported_micro, reported_calls, estimated_micro, estimated_calls FROM ai_usage_money WHERE owner='project:P'`);
  assert.deepEqual(money, [{ unit: "usd", reported_micro: 400000, reported_calls: 3, estimated_micro: 750000, estimated_calls: 5 }]);
  assert.equal(w.row(`SELECT unpriced_calls FROM ai_usage WHERE owner='group'`).unpriced_calls, 1);
});

test("R1 (T53) a figure not stated is never counted as 0: a day with any unstated figure keeps unstated listing it; one with all stated lists none (control)", async () => {
  const w = await standard();
  w.count("member:ann", "ann", "ask", { usage: usage(null, 5, null) });
  w.count("member:ann", "ann", "ask", { usage: usage(2, 5, null) });
  const r = w.row(`SELECT * FROM ai_usage`);
  assert.deepEqual([r.input_tokens, r.output_tokens, JSON.parse(r.unstated)], [2, 10, ["input_tokens"]]);
  w.count("member:ann", "ann", "draft", { usage: usage(2, 5, null) });
  assert.deepEqual(JSON.parse(w.row(`SELECT unstated FROM ai_usage WHERE use='draft'`).unstated), []);
});

test("R1 a null calls is counted as one, never none; a stated calls as given (negative control: calls 3 counts 3)", async () => {
  const w = await standard();
  w.count("member:ann", "ann", "ask", { calls: null });
  assert.equal(w.row(`SELECT calls FROM ai_usage`).calls, 1);
  w.count("member:ann", "ann", "ask", { calls: 3 });
  assert.equal(w.row(`SELECT calls FROM ai_usage`).calls, 4);
});

test("R1 the local day is the group's (civil-time.localDay in its zone): 03:00Z in Los Angeles is the day before", async () => {
  const w = await standard({ zone: "America/Los_Angeles" });
  w.count("member:ann", "ann", "ask", { at: "2026-10-09T03:00:00Z" });
  w.setZone("UTC");
  w.count("member:ann", "ann", "ask", { at: "2026-10-09T03:00:00Z" });
  assert.deepEqual(counter(w).map((r) => r.day), ["2026-10-08", "2026-10-09"]);
});

test("R1 a malformed entry is refused AI_RUN_CONSUME_INVALID with run-rules' row, counting nothing; a well-formed one counts (negative control)", async () => {
  const w = await standard();
  const before = w.snapshot();
  const row = AI_RUNS_CHECKS.AI_RUN_CONSUME_INVALID;
  const ok = { owner: "member:ann", member: "ann", use: "ask", mode: "ask", entry_id: ENTRIES.priced, label: label(), usage: usage(1), calls: 1 };
  const bad = [
    { ...ok, owner: "nobody" },
    { ...ok, member: null },
    { ...ok, use: "chat" },
    { ...ok, mode: "" },
    { ...ok, usage: null },
    { ...ok, usage: usage(-1) },
    { ...ok, usage: usage(1.5) },
    { ...ok, usage: usage(1, 0, -2) },
    { ...ok, usage: { ...usage(1), cost_reported: { amount: 1, unit: "US Dollars", source: "provider" } } },
    { ...ok, usage: { ...usage(1), unstated: "input_tokens" } },
    { ...ok, usage: (({ output_tokens, ...u }) => u)(usage(1)) },
    { ...ok, calls: undefined },
    { ...ok, calls: 0 },
    { ...ok, act: "bad act!" },
    { ...ok, entry_id: "not an id!" },
    { ...ok, label: "a label" },
    { ...ok, label: { ...label(), served_by: "x" } },
  ];
  for (const b of bad) {
    const r = w.u.countUsage({ ...b, at: AT });
    assert.deepEqual([r.ok, r.code, r.check, r.translation], [false, "AI_RUN_CONSUME_INVALID", row.check, row.translation], JSON.stringify(b));
  }
  assert.equal(w.snapshot(), before, "nothing was counted");
  assert.equal(w.u.countUsage({ ...ok, at: AT }).ok, true);
  assert.notEqual(w.snapshot(), before);
});

test("R1 countAskUsage counts an ask or a draft, its use its mode, to the owner the caller's accountFor answered; without an owner, as not recorded; any other mode refused AI_RUN_CONSUME_INVALID counting nothing", async () => {
  const w = await standard();
  const a = { entry_id: ENTRIES.priced, label: label(), at: AT };
  assert.equal(w.u.countAskUsage({ ...a, member: "ann", mode: "ask", usage: usage(5), calls: 1, owner: "member:ann" }).ok, true);
  assert.equal(w.u.countAskUsage({ ...a, member: "bob", mode: "draft", usage: usage(6), calls: null, owner: "group" }).ok, true);
  assert.equal(w.u.countAskUsage({ ...a, member: "bob", mode: "ask", usage: usage(7), calls: 1 }).owner, NOT_RECORDED);
  const before = w.snapshot();
  assert.equal(w.u.countAskUsage({ ...a, member: "bob", mode: "run", usage: usage(7), calls: 1, owner: "group" }).code, "AI_RUN_CONSUME_INVALID");
  assert.equal(w.u.countAskUsage({ ...a, member: "bob", mode: "ask", usage: null, calls: 1, owner: "group" }).code, "AI_RUN_CONSUME_INVALID");
  assert.equal(w.snapshot(), before);
  assert.deepEqual(counter(w).map((x) => [x.owner, x.member, x.use, x.mode]),
    [["group", "bob", "draft", "draft"], ["member:ann", "ann", "ask", "ask"], [NOT_RECORDED, "bob", "ask", "ask"]]);
});

test("R1 R15 the counter holds no content, question, address, entry or effort: its columns are the owner, the member, the day, the use, the mode and numbers; the label's served version is not kept in it", async () => {
  const w = await standard();
  const cols = w.rows(`PRAGMA table_info(ai_usage)`).map((c) => c.name);
  assert.deepEqual(cols.slice(0, 5), ["owner", "member", "day", "use", "mode"]);
  for (const c of cols) assert.ok(!/entry|effort|model|label|message|content|question/.test(c), c);
  w.count("group", "ann", "ask", { effort: "high" });
  /* negative control: the entry and label are kept beside the act only (R11), never in the counter */
  assert.equal(JSON.stringify(w.rows(`SELECT * FROM ai_usage`)).includes(`fake-version-of-${ENTRIES.priced}`), false);
  assert.equal(JSON.stringify(w.rows(`SELECT * FROM ai_usage`)).includes("high"), false);
});

test("R1 rows from before T40 are kept with owner not recorded, their use read from their mode, and count toward no limit", async () => {
  const w = await world({ before: (db) => {
    db.exec(`CREATE TABLE ai_usage (member TEXT NOT NULL, day TEXT NOT NULL, mode TEXT NOT NULL, calls INTEGER NOT NULL DEFAULT 0,
      input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, cache_read_input_tokens INTEGER NOT NULL DEFAULT 0,
      cache_creation_input_tokens INTEGER NOT NULL DEFAULT 0, cost_micro_usd INTEGER NOT NULL DEFAULT 0,
      tokens_unstated INTEGER NOT NULL DEFAULT 0, cost_unstated INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (member, day, mode))`);
    db.exec(`INSERT INTO ai_usage (member, day, mode, calls, input_tokens) VALUES ('ann', '2026-10-09', 'ask', 4, 900),
             ('ann', '2026-10-09', 'investigate', 2, 800), ('ann', '2026-10-09', 'draft', 1, 50)`);
  } });
  await w.group("ann");
  assert.deepEqual(counter(w).map((r) => [r.owner, r.member, r.use, r.mode, r.calls, r.input_tokens]),
    [[NOT_RECORDED, "ann", "ask", "ask", 4, 900], [NOT_RECORDED, "ann", "draft", "draft", 1, 50], [NOT_RECORDED, "ann", "run", "investigate", 2, 800]]);
  await w.account("member:ann", "ann");
  assert.equal(w.u.aiLimitSet({ owner: "member:ann", scope: "overall", unit: "tokens", period: "day", amount: 100, by: "ann" }).ok, true);
  assert.equal(w.u.useCheck({ owner: "member:ann", member: "ann", use: "ask", at: AT }), null, "1,750 tokens not recorded count toward no limit");
  /* negative control: the same figure counted to her account reaches it */
  w.count("member:ann", "ann", "ask", { input: 100 });
  assert.equal(w.u.useCheck({ owner: "member:ann", member: "ann", use: "ask", at: AT }).code, "AI_LIMIT_REACHED");
});

test("R1 (T53; B6) rows from before this change keep their dollars as cost_estimated_sum in usd, with entry_id null; once (control: a second migration adds nothing)", async () => {
  const w = await world({ before: (db) => {
    db.exec(`CREATE TABLE ai_usage (owner TEXT NOT NULL, member TEXT NOT NULL, day TEXT NOT NULL, use TEXT NOT NULL, mode TEXT NOT NULL,
      calls INTEGER NOT NULL DEFAULT 0, input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0,
      cache_read_input_tokens INTEGER NOT NULL DEFAULT 0, cache_creation_input_tokens INTEGER NOT NULL DEFAULT 0,
      cost_micro_usd INTEGER NOT NULL DEFAULT 0, tokens_unstated INTEGER NOT NULL DEFAULT 0, cost_unstated INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (owner, member, day, use, mode))`);
    db.exec(`INSERT INTO ai_usage (owner, member, day, use, mode, calls, input_tokens, cost_micro_usd) VALUES
             ('member:ann', 'ann', '2026-10-09', 'ask', 'ask', 2, 10, 1500000)`);
  } });
  await w.group("ann");
  await w.account("member:ann", "ann");
  const u = w.u.aiUsage({ owner: "member:ann", viewer: "ann", at: AT }).uses[0];
  assert.deepEqual([u.cost_estimated_sum, u.cost_reported_sum, u.calls], [{ usd: 1.5 }, null, 2]);
  w.u.migrate();
  assert.deepEqual(w.u.aiUsage({ owner: "member:ann", viewer: "ann", at: AT }).uses[0].cost_estimated_sum, { usd: 1.5 });
});

test("R1 with an act, its sums are also measured per act (for R10, R11); without one, no act is measured", async () => {
  const w = await standard();
  w.count("member:ann", "ann", "run", { act: "RUN-1", input: 10, cost: 0.01 });
  w.count("member:ann", "ann", "run", { act: "RUN-1", input: 5, cost: 0.02 });
  w.count("member:ann", "ann", "run", { input: 5 });
  const acts = w.rows(`SELECT act, tokens, calls, estimated_micro, money_unit FROM ai_use_acts`);
  assert.deepEqual(acts, [{ act: "RUN-1", tokens: 15, calls: 2, estimated_micro: 30000, money_unit: "usd" }]);
});

const TABLES = ["ai_explore_asks", "ai_health", "ai_health_sent", "ai_health_switch", "ai_limit_history", "ai_limit_reached", "ai_limits",
  "ai_provider_limits", "ai_reconcile_gaps", "ai_retest", "ai_threshold_crossed", "ai_threshold_history", "ai_thresholds", "ai_usage",
  "ai_usage_entries", "ai_usage_money", "ai_use_act_entries", "ai_use_act_models", "ai_use_acts", "ai_use_migrations"];

test("R7 (T53) the tables (the counter, the limits and their history, the provider limits, the thresholds and their alerts, the health counts and the switch's history) are declared through record-core.declareTable: export admin-only, sight group, purged with the whole store", async () => {
  const w = await standard();
  const mine = w.rc.declaredTables().filter((d) => d.module === "ai-use");
  assert.deepEqual(mine.map((d) => d.name).sort(), TABLES);
  for (const d of mine) assert.deepEqual([d.export, d.sight, d.purge, d.expunge], ["admin-only", "group", "clear", "none"], d.name);
  assert.deepEqual(AI_USE_TABLES.map((t) => t.name).sort(), mine.map((d) => d.name).sort());
  w.count("member:ann", "ann", "ask");
  w.u.aiLimitSet({ owner: "member:ann", scope: "ask", unit: "calls", period: "day", amount: 5, by: "ann" });
  w.u.countHealth({ entry_id: ENTRIES.priced, personal: false, outcome: "result", at: AT });
  w.rc.purge();
  for (const t of ["ai_usage", "ai_limits", "ai_limit_history", "ai_health"]) assert.equal(w.rows(`SELECT * FROM ${t}`).length, 0, t);
});

test("R7 (T53) the tables hold no content, secret or provider message: no column names one, and a row with a provider message is refused by the schema (control: the same row without it is kept)", async () => {
  const w = await standard();
  for (const t of TABLES) for (const c of w.rows(`PRAGMA table_info(${t})`).map((x) => x.name))
    assert.ok(!/message|content|secret|question|address|text/.test(c), `${t}.${c}`);
  assert.throws(() => w.db.prepare(`INSERT INTO ai_provider_limits (owner, account_id, entry_id, kind, scope, resets_at, recorded_at, message)
    VALUES ('group', 'a', '', 'spend', 'account', '', '2026-10-09T00:00:00Z', 'Your credit balance is too low')`).run());
  w.db.prepare(`INSERT INTO ai_provider_limits (owner, account_id, entry_id, kind, scope, resets_at, recorded_at)
    VALUES ('group', 'a', '', 'spend', 'account', '', '2026-10-09T00:00:00Z')`).run();
  assert.equal(w.rows(`SELECT * FROM ai_provider_limits`).length, 1);
});

test("R7 a project's limits and thresholds are deleted with its project, and nothing else is: another account's limits and the counter stay", async () => {
  const w = await standard();
  w.u.aiLimitSet({ owner: "project:P", scope: "overall", unit: "calls", period: "day", amount: 5, by: "ann" });
  w.u.aiThresholdSet({ owner: "project:P", scope: "overall", unit: "calls", period: "day", kind: "percent", level: 50, by: "ann" });
  w.u.aiLimitSet({ owner: "member:ann", scope: "overall", unit: "calls", period: "day", amount: 5, by: "ann" });
  w.count("project:P", "bob", "run");
  assert.equal(w.rows(`SELECT * FROM ai_thresholds WHERE owner='project:P'`).length, 1);
  w.rc.purge({ bundleId: "P" });
  assert.deepEqual(w.rows(`SELECT owner FROM ai_limits`).map((r) => r.owner), ["member:ann"]);
  assert.equal(w.rows(`SELECT * FROM ai_limit_history WHERE owner='project:P'`).length, 0);
  assert.equal(w.rows(`SELECT * FROM ai_thresholds WHERE owner='project:P'`).length, 0);
  assert.equal(w.rows(`SELECT * FROM ai_usage WHERE owner='project:P'`).length, 1, "use counted stays, purged only with the whole store");
});

test("R8 (T53) each code this module mints has its row in its own checks.mjs, family C-143 (K2480), numbered once, never a retired run-rules number; AI_THRESHOLD_INVALID the next free number (control: the retired codes are not this module's)", () => {
  const rows = Object.entries(AI_USE_CHECKS);
  assert.deepEqual(rows.map(([c, r]) => [c, r.check]), [["AI_LIMIT_REACHED", "C-143.1"], ["AI_LIMIT_INVALID", "C-143.2"],
    ["LIMIT_UNIT_UNAVAILABLE", "C-143.3"], ["EXPLORE_NOT_ENABLED", "C-143.4"], ["EXPLORE_OUT_OF_SCOPE", "C-143.5"],
    ["EXPLORE_ASK_INVALID", "C-143.6"], ["AI_THRESHOLD_INVALID", "C-143.7"], ["NOT_A_PAYING_ACCOUNT", "C-143.8"]]);
  for (const [, r] of rows) assert.match(r.where, /^src\/ai-use\/index\.mjs \S+ > is-[a-z-]+$/);
  const retired = ["C-109.8", "C-109.9", "C-109.12"];
  for (const [, r] of rows) assert.ok(!retired.includes(r.check));
  assert.equal(AI_USE_CHECKS.AI_LIMIT_REACHED.translation, WORDS["ai.refused.limit"]);
  assert.equal(AI_USE_CHECKS.AI_LIMIT_INVALID.translation, WORDS["ai.refused.limitinvalid"]);
  assert.equal(AI_USE_CHECKS.LIMIT_UNIT_UNAVAILABLE.translation, WORDS["ai.refused.unitunavailable"]);
  assert.equal(AI_USE_CHECKS.EXPLORE_NOT_ENABLED.translation, WORDS["ai.refused.explorenotenabled"]);
  assert.equal(typeof AI_USE_CHECKS.AI_THRESHOLD_INVALID.translation, "string");
  for (const c of ["AI_USE_CEILING_REACHED", "AI_USE_COPY_CEILING_REACHED", "AI_CEILING_INVALID"]) assert.equal(AI_USE_CHECKS[c], undefined);
  assert.ok(Object.keys(AI_USE_WORDS).length >= 10);
});

test("R8 (T53) AI_LIMIT_REACHED carries whose (group, project or own), scope and period, and now source and walkable; each refusal carries its row's check (control: AI_THRESHOLD_INVALID carries its own)", async () => {
  const w = await standard();
  for (const [owner, member, whose] of [["group", "bob", "group"], ["project:P", "bob", "project"], ["member:ann", "ann", "own"]]) {
    const by = owner === "group" ? "admin" : "ann";
    w.u.aiLimitSet({ owner, scope: "overall", unit: "calls", period: "month", amount: 1, by });
    w.count(owner, member, "ask");
    const r = w.u.useCheck({ owner, member, use: "ask", at: AT });
    assert.deepEqual([r.code, r.check, r.whose, r.scope, r.period, r.source, r.walkable], ["AI_LIMIT_REACHED", "C-143.1", whose, "overall", "month", "own", true], owner);
  }
  const t = w.u.aiThresholdSet({ owner: "member:ann", scope: "overall", unit: "calls", period: "month", kind: "percent", level: 500, by: "ann" });
  assert.deepEqual([t.code, t.check, t.field], ["AI_THRESHOLD_INVALID", "C-143.7", "level"]);
});
