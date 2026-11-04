/* ai-use R4 (the reads of use), R5 (limits reached), R12 (an account's limits, with its history) and R13 (the refusals'
   words by key), at the interface, each with a negative control (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { standard, WORDS, PLANS, ENTRIES } from "./fixture.mjs";
import { AI_USE_WORDS, LIMIT_WORD_BY_SCOPE, WHOSE_WORD, aiUseOps } from "../../../src/ai-use/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const AT = "2026-10-09T12:00:00Z";

/* ===== R4 ===== */

test("R4 aiUsage answers an account's owners its month of use per kind of use, summed over members and naming none; anyone else is refused as R2 refuses; it writes nothing", async () => {
  const w = await standard();
  w.count("project:P", "ann", "ask", { input: 10, cost: 0.1 });
  w.count("project:P", "bob", "ask", { input: 5, cost: 0.2 });
  w.count("project:P", "bob", "run", { input: 7 });
  w.count("project:P", "bob", "run", { input: 1000, at: "2026-09-30T12:00:00Z" });
  w.count("group", "bob", "ask", { input: 99 });
  const before = w.snapshot();
  const r = w.u.aiUsage({ owner: "project:P", viewer: "ann", at: AT });
  assert.deepEqual(r.uses.map((u) => [u.use, u.tokens, u.calls]), [["ask", 15, 2], ["run", 7, 1]]);
  assert.ok(Math.abs(r.uses[0].cost_estimated_sum.usd - 0.3) < 1e-9, "the account's owners see its cost");
  assert.doesNotMatch(JSON.stringify(r), /"(ann|bob)"|member/);
  assert.deepEqual(w.u.aiUsage({ owner: "project:P", viewer: "ann", month: "2026-09" }).uses.map((u) => u.tokens), [1000]);
  for (const viewer of ["bob", "admin", null]) assert.equal(w.u.aiUsage({ owner: "project:P", viewer }).ok, false, String(viewer));
  assert.equal(w.u.aiUsage({ owner: "group", viewer: "ann" }).code, "NOT_AN_ADMIN");
  assert.equal(w.u.aiUsage({ owner: "member:ann", viewer: "bob" }).code, "NOT_YOUR_CEILING");
  assert.equal(w.u.aiUsage({ owner: "group", viewer: "second", at: AT }).uses[0].tokens, 99, "control: an administrator reads the group's");
  assert.equal(w.snapshot(), before);
});

test("R4 aiUsageMine answers a member their own use per payer and per use, with each limit that bound them; a cost only for the accounts they own; never another member's spending", async () => {
  const w = await standard();
  w.u.aiLimitSet({ owner: "group", scope: "per_member", unit: "calls", period: "day", amount: 1, by: "admin" });
  w.u.aiLimitSet({ owner: "project:P", scope: "ask", unit: "calls", period: "day", amount: 9, by: "ann" });
  w.count("group", "bob", "ask", { input: 3, cost: 0.5 });
  w.count("project:P", "bob", "ask", { input: 4, cost: 0.25 });
  w.count("project:P", "ann", "ask", { input: 400, cost: 9 });
  const bob = w.u.aiUsageMine({ viewer: "bob", at: AT });
  assert.deepEqual(bob.payers.map((p) => [p.owner, p.whose, p.uses.map((u) => [u.use, u.tokens])]),
    [["group", "group", [["ask", 3]]], ["project:P", "project", [["ask", 4]]]]);
  assert.equal(/cost|not_measurable/.test(JSON.stringify(bob)), false, "bob owns neither account: no cost");
  assert.deepEqual(bob.payers[0].limits.map((l) => [l.scope, l.reached]), [["per_member", true]]);
  assert.deepEqual(bob.payers[1].limits.map((l) => [l.scope, l.reached]), [["ask", false]]);
  assert.equal(JSON.stringify(bob).includes("400"), false, "ann's use is not shown to bob");
  /* control: ann owns P, so its cost is hers to see */
  const ann = w.u.aiUsageMine({ viewer: "ann", at: AT });
  assert.deepEqual(ann.payers[0].uses[0].cost_estimated_sum, { usd: 9 });
  assert.equal(w.u.aiUsageMine({ viewer: "bob", month: "2026-10", at: AT }).payers.length, 2);
  assert.equal(w.u.aiUsageMine({ viewer: null }).code, "NOT_YOUR_CEILING");
  assert.equal(w.u.aiUsageMine({ viewer: "machine:agent" }).code, "NOT_YOUR_CEILING");
});

test("R4 the ops: aiusage with owner is R4's account read, without it the viewer's own; ailimitset and ailimits take who from the control plane's stamp, never the body", async () => {
  const w = await standard();
  w.count("member:ann", "ann", "ask");
  const ops = (q, body = null) => aiUseOps(w.u, new URL(`http://x/?${q}`), body);
  assert.equal(ops("owner=member:ann&viewer=ann").aiusage().owner, "member:ann");
  assert.equal(ops("viewer=ann").aiusage().member, "ann");
  assert.equal(ops("by=bob", { owner: "member:ann", scope: "ask", unit: "calls", period: "day", amount: 3, by: "ann" }).ailimitset().code,
    "NOT_YOUR_CEILING", "the body's by is not believed");
  assert.equal(ops("by=ann", { owner: "member:ann", scope: "ask", unit: "calls", period: "day", amount: 3 }).ailimitset().ok, true);
  assert.equal(ops("owner=member:ann&viewer=ann").ailimits().limits.length, 1);
});

test("R4 R21 (T53) a none plan's month answers tokens and calls and not_measurable, no cost field equal to 0; a priced plan answers both cost sums apart; a non-owner is refused as R2 refuses (control: an owner of a reported plan sees cost_reported_sum)", async () => {
  const w = await standard();
  await w.account("member:cy", "cy", PLANS.none);
  await w.account("member:bob", "bob", PLANS.reported);
  w.count("member:cy", "cy", "ask", { input: 10, cost: 0.4 });
  const cy = w.u.aiUsage({ owner: "member:cy", viewer: "cy", at: AT }).uses[0];
  assert.deepEqual([cy.tokens, cy.calls, cy.cost, cy.not_measurable, cy.word], [10, 1, null, true, "ai.use.notmeasurable"]);
  assert.equal(cy.cost_estimated_sum, undefined, "a none plan never shows an estimate as spend");
  const zero = (o) => Object.entries(o).some(([k, v]) => /cost/.test(k) && (v === 0 || (v && typeof v === "object" && Object.values(v).includes(0))));
  assert.equal(zero(cy), false);
  w.count("member:ann", "ann", "ask", { cost: 0.1, reported: 0.3 });
  const ann = w.u.aiUsage({ owner: "member:ann", viewer: "ann", at: AT }).uses[0];
  assert.deepEqual([ann.cost_reported_sum, ann.cost_estimated_sum], [{ usd: 0.3 }, { usd: 0.1 }]);
  w.count("member:ann", "ann", "draft", { cost: null, entry_id: ENTRIES.unpriced });
  const d = w.u.aiUsage({ owner: "member:ann", viewer: "ann", at: AT }).uses.find((u) => u.use === "draft");
  assert.deepEqual([d.cost, d.not_measurable, d.unpriced_calls], [null, true, 1], "unpriced entries are not measurable, never 0");
  assert.equal(w.u.aiUsage({ owner: "member:cy", viewer: "ann" }).code, "NOT_YOUR_CEILING");
  w.count("member:bob", "bob", "ask", { reported: 0.7 });
  assert.deepEqual(w.u.aiUsage({ owner: "member:bob", viewer: "bob", at: AT }).uses[0].cost_reported_sum, { usd: 0.7 });
});

test("R21 (T53) a unit other than usd is summed only with its own unit: a euro cost is kept apart and not added into the usd sum (control: two usd costs add)", async () => {
  const w = await standard();
  w.count("member:ann", "ann", "ask", { reported: 0.5 });
  w.count("member:ann", "ann", "ask", { usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0,
    reasoning_tokens: 0, cost_reported: { amount: 2, unit: "eur", source: "provider" }, cost_estimated: null, unstated: [] } });
  w.count("member:ann", "ann", "ask", { reported: 0.25 });
  assert.deepEqual(w.u.aiUsage({ owner: "member:ann", viewer: "ann", at: AT }).uses[0].cost_reported_sum, { eur: 2, usd: 0.75 });
});

/* ===== R5 ===== */

test("R5 limitsReached answers, for each account the viewer owns, each limit first reached in its current period with a stable key; not before it is reached, not to anyone else, not in the next period; it writes nothing", async () => {
  const w = await standard();
  w.u.aiLimitSet({ owner: "project:P", scope: "overall", unit: "calls", period: "day", amount: 2, by: "ann" });
  w.u.aiLimitSet({ owner: "member:ann", scope: "ask", unit: "calls", period: "month", amount: 1, by: "ann" });
  w.count("project:P", "bob", "run", { at: "2026-10-09T10:00:00Z" });
  assert.deepEqual(w.u.limitsReached({ viewer: "ann", at: AT }).reached, [], "not yet reached");
  w.count("project:P", "bob", "run", { at: "2026-10-09T11:00:00Z" });
  w.count("project:P", "bob", "run", { at: "2026-10-09T11:30:00Z" });
  w.count("member:ann", "ann", "ask", { at: "2026-10-09T11:45:00Z" });
  const before = w.snapshot();
  const r = w.u.limitsReached({ viewer: "ann", at: AT }).reached;
  assert.deepEqual(r, [
    { key: "ai-limit:project:P:overall:calls:day:2026-10-09", owner: "project:P", scope: "overall", unit: "calls", period: "day",
      period_start: "2026-10-09", reached_at: "2026-10-09T11:00:00Z", source: "own" },
    { key: "ai-limit:member:ann:ask:calls:month:2026-10-01", owner: "member:ann", scope: "ask", unit: "calls", period: "month",
      period_start: "2026-10-01", reached_at: "2026-10-09T11:45:00Z", source: "own" }]);
  assert.deepEqual(w.u.limitsReached({ viewer: "ann", at: AT }).reached, r, "the same keys again");
  assert.equal(w.snapshot(), before);
  assert.deepEqual(w.u.limitsReached({ viewer: "bob", at: AT }).reached, [], "bob owns neither account");
  assert.deepEqual(w.u.limitsReached({ viewer: "ann", at: "2026-10-10T12:00:00Z" }).reached.map((x) => x.owner), ["member:ann"],
    "the day's limit is a new period; the month's is not");
  assert.doesNotThrow(() => w.u.limitsReached({}));
});

test("R5 a limit set below what is already used is reached when set; the group's limits are answered to its administrators", async () => {
  const w = await standard();
  w.count("group", "bob", "ask", { calls: 3 });
  w.u.aiLimitSet({ owner: "group", scope: "ask", unit: "calls", period: "day", amount: 2, by: "admin", at: AT });
  assert.equal(w.u.limitsReached({ viewer: "second", at: AT }).reached[0].reached_at, AT);
  assert.deepEqual(w.u.limitsReached({ viewer: "ann", at: AT }).reached, []);
});

test("R5 (T53) a recorded provider limit appears once with its key per owner, kind and resets_at; a second read mints no new key; to the account's owners alone (control: past resets_at it no longer appears)", async () => {
  const w = await standard();
  const rec = () => w.u.recordProviderLimit({ owner: "project:P", account_id: w.acct.P, entry_id: ENTRIES.priced, kind: "quota", scope: "entry",
    resets_at: "2026-10-09T20:00:00Z", at: "2026-10-09T11:00:00Z" });
  rec();
  w.u.aiLimitSet({ owner: "project:P", scope: "overall", unit: "calls", period: "day", amount: 1, by: "ann" });
  w.count("project:P", "bob", "run", { at: "2026-10-09T11:30:00Z" });
  const r = w.u.limitsReached({ viewer: "ann", at: AT }).reached;
  assert.deepEqual(r.map((x) => [x.source, x.key]), [["own", "ai-limit:project:P:overall:calls:day:2026-10-09"],
    ["provider", "ai-provider-limit:project:P:quota:2026-10-09T20:00:00Z"]]);
  assert.deepEqual(r[1].resets_at, "2026-10-09T20:00:00Z");
  rec();
  assert.deepEqual(w.u.limitsReached({ viewer: "ann", at: AT }).reached, r, "the same keys again");
  assert.deepEqual(w.u.limitsReached({ viewer: "bob", at: AT }).reached, []);
  assert.deepEqual(w.u.limitsReached({ viewer: "ann", at: "2026-10-09T21:00:00Z" }).reached.map((x) => x.source), ["own"]);
});

/* ===== R12 ===== */

test("R12 aiLimits answers each limit of one account (scope, use, unit, period, inclusive or on top) with its use in the current period naming no member, and its history (set, changed, removed; who and when), to its owners only", async () => {
  const w = await standard();
  w.u.aiLimitSet({ owner: "project:P", scope: "run", unit: "tokens", period: "day", amount: 500, inclusive: false, by: "ann", at: "2026-10-09T08:00:00Z" });
  w.u.aiLimitSet({ owner: "project:P", scope: "overall", unit: "usd", period: "month", amount: 2, by: "ann", at: "2026-10-09T08:01:00Z" });
  w.u.aiLimitSet({ owner: "project:P", scope: "per_member", unit: "calls", period: "day", amount: 4, by: "ann", at: "2026-10-09T08:02:00Z" });
  w.u.aiLimitSet({ owner: "project:P", scope: "ask", unit: "calls", period: "day", amount: 1, by: "ann", at: "2026-10-09T08:03:00Z" });
  w.u.aiLimitSet({ owner: "project:P", scope: "ask", unit: "calls", period: "day", amount: null, by: "ann", at: "2026-10-09T08:04:00Z" });
  w.count("project:P", "bob", "run", { input: 300, cost: 0.5, calls: 2 });
  w.count("project:P", "ann", "ask", { input: 10, cost: 0.25, calls: 1 });
  const r = w.u.aiLimits({ owner: "project:P", viewer: "ann", at: AT });
  const by = Object.fromEntries(r.limits.map((l) => [l.scope, l]));
  assert.deepEqual([by.run.use, by.run.inclusive, by.run.on_top, by.run.used, by.run.reached], ["run", false, true, 300, false]);
  assert.deepEqual([by.overall.use, by.overall.inclusive, by.overall.amount, by.overall.used], [null, null, 2, 0.25],
    "overall counts the uses that are not exclusive");
  assert.deepEqual([by.per_member.used, by.per_member.amount], [2, 4], "the most any one member used, naming none");
  assert.equal(by.ask, undefined, "a removed limit is not held");
  assert.deepEqual(r.history.map((h) => [h.change, h.scope, h.by, h.at]), [
    ["set", "run", "member:ann", "2026-10-09T08:00:00Z"], ["set", "overall", "member:ann", "2026-10-09T08:01:00Z"],
    ["set", "per_member", "member:ann", "2026-10-09T08:02:00Z"], ["set", "ask", "member:ann", "2026-10-09T08:03:00Z"],
    ["removed", "ask", "member:ann", "2026-10-09T08:04:00Z"]]);
  assert.doesNotMatch(JSON.stringify(r.limits), /bob/);
});

test("R12 anyone but the account's owners is refused as ai-accounts R15 refuses them, writing nothing", async () => {
  const w = await standard();
  w.u.aiLimitSet({ owner: "member:ann", scope: "ask", unit: "calls", period: "day", amount: 1, by: "ann" });
  const before = w.snapshot();
  for (const [owner, viewer] of [["member:ann", "bob"], ["member:ann", "admin"], ["project:P", "bob"], ["project:P", "cy"],
                                 ["group", "ann"], ["group", null], ["group", "machine:agent"]]) {
    const r = w.u.aiLimits({ owner, viewer });
    const own = w.a.accountActBar({ owner, by: viewer });
    assert.equal(r.ok, false, `${owner} ${viewer}`);
    assert.deepEqual([r.code, r.check], [own.code, own.check], `${owner} ${viewer}`);
  }
  assert.equal(w.snapshot(), before);
  /* negative controls: each account's owners read it */
  for (const [owner, viewer] of [["member:ann", "ann"], ["project:P", "ann"], ["group", "admin"], ["group", "second"]])
    assert.equal(w.u.aiLimits({ owner, viewer }).ok, true, `${owner} ${viewer}`);
});

/* ===== R13 ===== */

test("R13 each refusal's member-facing sentence is read by key from words.json, verbatim: AI_LIMIT_REACHED by its scope with {whose} filled from ai.whose.*, never a cost; AI_LIMIT_INVALID, LIMIT_UNIT_UNAVAILABLE, EXPLORE_NOT_ENABLED; the Ask item ai.queue.exploreask", async () => {
  for (const [key, en] of Object.entries(AI_USE_WORDS)) assert.equal(en, WORDS[key], `${key} is words.json's own sentence`);
  for (const key of ["ai.refused.limit", "ai.refused.limit.overall", "ai.refused.limit.member", "ai.whose.group", "ai.whose.project",
                     "ai.whose.own", "ai.refused.limitinvalid", "ai.refused.unitunavailable", "ai.refused.explorenotenabled",
                     "ai.queue.exploreask"])
    assert.ok(typeof WORDS[key] === "string" && AI_USE_WORDS[key] === WORDS[key], `${key} in words.json`);
  assert.deepEqual(LIMIT_WORD_BY_SCOPE, { overall: "ai.refused.limit.overall", per_member: "ai.refused.limit.member" });
  assert.deepEqual(WHOSE_WORD, { group: "ai.whose.group", project: "ai.whose.project", own: "ai.whose.own" });
  const w = await standard();
  w.u.aiLimitSet({ owner: "member:ann", scope: "ask", unit: "usd", period: "day", amount: 0.01, by: "ann" });
  w.u.aiLimitSet({ owner: "member:ann", scope: "overall", unit: "calls", period: "day", amount: 1, by: "ann" });
  w.count("member:ann", "ann", "ask", { cost: 0.5 });
  const r = w.u.useCheck({ owner: "member:ann", member: "ann", use: "ask", at: AT });
  assert.equal(r.word, "ai.refused.limit");
  assert.equal(r.translation, word("ai.refused.limit", { whose: word("ai.whose.own"), period: word("ai.period.day"),
    use: word("ai.use.ask.inline"), when: word("ai.when.day") }));
  assert.doesNotMatch(r.translation, /0\.5|\$|cent|dollar/i, "never a cost");
  /* negative control: a different scope reads a different key */
  assert.equal(w.u.useCheck({ owner: "member:ann", member: "ann", use: "draft", at: AT }).word, "ai.refused.limit.overall");
  assert.equal(w.u.aiLimitSet({ owner: "member:ann", scope: "ask", unit: "x", period: "day", amount: 1, by: "ann" }).word, "ai.refused.limitinvalid");
});

test("R13 (K2514) every refusal's sentence reaches its caller whole, no placeholder left: AI_LIMIT_REACHED for every owner, scope and period with {whose}, {use}, {period} and {when} filled (daily: tomorrow; monthly: the 1st of the next month, December's in January), also when R3 fails closed; AI_LIMIT_INVALID with {field} filled for every field", async () => {
  const PLACEHOLDER = /\{[A-Za-z_]+\}/;
  /* negative control: the words file's own sentences carry placeholders, so the test can see one left */
  for (const key of ["ai.refused.limit", "ai.refused.limit.overall", "ai.refused.limit.member", "ai.refused.limitinvalid"])
    assert.match(WORDS[key], PLACEHOLDER, key);
  const USE_WORD = { ask: "asking", draft: "drafting", run: word("ai.use.run.inline"), standing: word("ai.use.standing.inline"), explore: "exploring" };
  const PERIOD_WORD = { day: "daily", month: "monthly" };
  const expected = (scope, whose, use, period, when) => WORDS[scope === "overall" ? "ai.refused.limit.overall"
    : scope === "per_member" ? "ai.refused.limit.member" : "ai.refused.limit"]
    .replace("{whose}", WORDS[`ai.whose.${whose}`]).replace("{use}", USE_WORD[use]).replace("{period}", PERIOD_WORD[period])
    .replace("{when}", when);
  const w = await standard();
  const owners = [["group", "admin", "bob", "group"], ["project:P", "ann", "bob", "project"], ["member:ann", "ann", "ann", "own"]];
  const acct = { group: w.acct.group, "project:P": w.acct.P, "member:ann": w.acct.ann };
  for (const [owner, by] of owners) assert.equal(w.explore(acct[owner], "yes", by).ok, true, owner);
  let seen = 0;
  /* the month's {when} read from ai.when.month with the next month's date.month.* (T44, DEC-192 (4); DEC-333: "on {month} 1") */
  const onThe1st = (month) => WORDS["ai.when.month"].replace("{month}", WORDS[`date.month.${month}`]);
  assert.equal(onThe1st("november"), "on November 1", "words.json's own order, read verbatim");
  for (const [at, monthWhen] of [["2026-10-09T12:00:00Z", onThe1st("november")], ["2026-12-15T12:00:00Z", onThe1st("january")]]) {
    for (const [owner, by, member, whose] of owners) {
      for (const use of Object.keys(USE_WORD)) w.count(owner, member, use, { at });
      const scopes = [...Object.keys(USE_WORD), "overall", ...(whose === "own" ? [] : ["per_member"])];
      for (const scope of scopes) for (const period of ["day", "month"]) {
        assert.equal(w.u.aiLimitSet({ owner, scope, unit: "calls", period, amount: 1, by, at }).ok, true);
        for (const use of scope in USE_WORD ? [scope] : Object.keys(USE_WORD)) {
          const r = w.u.useCheck({ owner, member, use, at, account_id: acct[owner] });
          assert.deepEqual([r.code, r.scope, r.period, r.whose], ["AI_LIMIT_REACHED", scope, period, whose], `${owner} ${scope} ${period} ${use}`);
          assert.equal(r.translation, expected(scope, whose, use, period, period === "day" ? "tomorrow" : monthWhen), `${owner} ${scope} ${period} ${use}`);
          assert.doesNotMatch(r.translation, PLACEHOLDER);
          seen++;
        }
        w.u.aiLimitSet({ owner, scope, unit: "calls", period, amount: null, by, at });
      }
    }
  }
  assert.equal(seen, 2 * (2 * 2 * (5 + 5 + 5) + 2 * (5 + 5)), "every owner, scope, period and use was judged");
  /* R3 failing closed names no limit: its own sentence, ai.refused.limit.unjudged, {whose} its only fill (T43) */
  for (const r of [w.u.useCheck({ owner: "nobody", member: "bob", use: "ask" }), w.u.useCheck({ owner: "group", member: "bob", use: "chat" })]) {
    assert.equal(r.code, "AI_LIMIT_REACHED");
    assert.equal(r.translation, WORDS["ai.refused.limit.unjudged"].replace("{whose}", WORDS["ai.whose.group"]));
    assert.doesNotMatch(r.translation, PLACEHOLDER);
  }
  /* AI_LIMIT_INVALID: {field} filled for every field it names, the limit's and the estimate's */
  const invalid = [w.u.aiLimitSet({ owner: "x", by: "admin" }), w.u.aiLimitSet({ owner: "group", scope: "x", by: "admin" }),
    w.u.aiLimitSet({ owner: "group", scope: "ask", unit: "x", by: "admin" }),
    w.u.aiLimitSet({ owner: "group", scope: "ask", unit: "calls", period: "x", by: "admin" }),
    w.u.aiLimitSet({ owner: "group", scope: "ask", unit: "calls", period: "day", amount: 0, by: "admin" }),
    w.u.aiLimitSet({ owner: "group", scope: "overall", unit: "calls", period: "day", amount: 1, inclusive: false, by: "admin" }),
    w.u.estimate({ owner: "group", use: "x", viewer: "admin" }), w.u.estimate({ owner: "group", use: "ask", count: 0, viewer: "admin" })];
  assert.deepEqual(invalid.map((r) => r.field), ["owner", "scope", "unit", "period", "amount", "inclusive", "use", "count"]);
  for (const r of invalid) {
    assert.equal(r.code, "AI_LIMIT_INVALID");
    assert.equal(r.translation, word("ai.refused.limitinvalid", { field: word(`ai.limitfield.${r.field}`) }), r.translation);
    assert.ok(!PLACEHOLDER.test(r.translation), r.translation);
  }
  assert.equal(new Set(invalid.map((r) => r.translation)).size, invalid.length, "each field fills its own words");
});
