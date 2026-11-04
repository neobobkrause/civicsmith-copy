/* ai-use T48 (T48-29): R14, an account's use over thirty days and per period against each limit, summed and naming no
   member (N1026; DEC-215 (1); K3138, K1450, K3198), and the re-point to `ai-accounts` (N996 §5): R6's keep-away read
   failing closed with `KEPT_AWAY_UNREADABLE` (ai-accounts R34). At the interface, each with a negative control (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { standard, PLANS } from "./fixture.mjs";
import { AiUse, aiUseOps } from "../../../src/ai-use/index.mjs";
import { KEPT_AWAY_UNREADABLE } from "../../../src/ai-accounts/index.mjs";

const AT = "2026-10-20T12:00:00Z";
const over = (w, owner, viewer = "ann", at = AT) => w.u.accountUseOverTime({ owner, viewer, at });
const near = (a, b) => Math.abs(a - b) < 1e-9;
/* (T53) a day's money: its estimate in usd (the fixture's calls carry an estimate), 0 where nothing was measured */
const dollars = (d) => (d.cost && d.cost.estimated ? d.cost.estimated.usd : 0);

/* ===== R14: days ===== */

test("R14 (T53) two members' uses on three days are answered as day totals of calls, tokens and cost, naming neither member", async () => {
  const w = await standard();
  w.count("project:P", "ann", "ask", { calls: 1, cost: 0.1, at: "2026-10-18T09:00:00Z" });
  w.count("project:P", "bob", "run", { calls: 2, cost: 0.25, at: "2026-10-18T15:00:00Z" });
  w.count("project:P", "bob", "ask", { calls: 3, cost: 0.5, at: "2026-10-19T10:00:00Z" });
  w.count("project:P", "ann", "draft", { calls: 4, cost: 1, at: "2026-10-20T08:00:00Z" });
  w.count("project:P", "bob", "draft", { calls: 1, cost: null, at: "2026-10-20T09:00:00Z" });
  w.count("group", "bob", "ask", { calls: 9, cost: 9, at: "2026-10-19T10:00:00Z" });
  const r = over(w, "project:P");
  assert.equal(r.ok, true);
  const last3 = r.days.slice(-3);
  assert.deepEqual(last3.map((d) => [d.day, d.calls]), [["2026-10-18", 3], ["2026-10-19", 3], ["2026-10-20", 5]]);
  assert.ok(near(dollars(last3[0]), 0.35) && near(dollars(last3[1]), 0.5) && near(dollars(last3[2]), 1), JSON.stringify(last3));
  assert.deepEqual(last3.map((d) => d.tokens), [200, 100, 200]);
  assert.doesNotMatch(JSON.stringify(r).replace(/"member:[a-z]+"/g, ""), /"ann"|"bob"/, "names no member");
  /* negative control: the group's use is the group account's, not the project's */
  assert.equal(over(w, "group", "admin").days.find((d) => d.day === "2026-10-19").calls, 9);
});

test("R14 days are the thirty local days ending with the day of at, oldest first; a day with no use is answered with zeros; a use outside them is not answered", async () => {
  const w = await standard({ zone: "America/Los_Angeles" });
  w.count("member:ann", "ann", "ask", { calls: 2, cost: 0.2, at: "2026-10-21T03:00:00Z" });
  w.count("member:ann", "ann", "ask", { calls: 7, cost: 0.7, at: "2026-09-20T12:00:00Z" });
  w.count("member:ann", "ann", "ask", { calls: 8, cost: 0.8, at: "2026-10-22T12:00:00Z" });
  const r = over(w, "member:ann", "ann", "2026-10-21T06:00:00Z");
  assert.equal(r.days.length, 30);
  assert.equal(r.days[0].day, "2026-09-21");
  assert.equal(r.days[29].day, "2026-10-20", "the day of at in Los Angeles");
  for (let i = 1; i < 30; i++) assert.ok(r.days[i - 1].day < r.days[i].day, "oldest first, each day once");
  assert.deepEqual([r.days[29].day, r.days[29].calls, dollars(r.days[29])], ["2026-10-20", 2, 0.2], "03:00Z is the 20th in Los Angeles");
  assert.deepEqual(r.days[10], { day: "2026-10-01", calls: 0, tokens: 0, cost: null, not_measurable: true }, "a day with no use: zeros, its cost null, never 0");
  assert.equal(r.days.reduce((s, d) => s + d.calls, 0), 2, "the 20th of September and the 22nd of October lie outside");
  /* the thirty days cross a clock change (1 November in Los Angeles) without skipping or repeating one */
  const dst = over(w, "member:ann", "ann", "2026-11-15T12:00:00Z").days.map((d) => d.day);
  assert.deepEqual([dst[0], dst[29], new Set(dst).size], ["2026-10-17", "2026-11-15", 30]);
});

test("R14 the days of a month sum to that month's total as R4's aiUsage answers it, in calls, tokens and money", async () => {
  const w = await standard();
  const uses = [["ann", "ask", 1, 0.13, "2026-10-01"], ["bob", "run", 2, 0.27, "2026-10-05"], ["bob", "ask", 3, 1.11, "2026-10-12"],
    ["ann", "draft", 4, 0.05, "2026-10-20"], ["bob", "explore", 1, null, "2026-10-20"], ["ann", "ask", 5, 0.4, "2026-09-25"]];
  for (const [member, use, calls, cost, day] of uses) w.count("project:P", member, use, { calls, cost, at: `${day}T12:00:00Z` });
  const days = over(w, "project:P").days.filter((d) => d.day.startsWith("2026-10"));
  const month = w.u.aiUsage({ owner: "project:P", viewer: "ann", month: "2026-10", at: AT });
  const sum = (xs, f) => xs.reduce((s, x) => s + f(x), 0);
  assert.equal(sum(days, (d) => d.calls), sum(month.uses, (u) => u.calls));
  assert.ok(near(sum(days, dollars), sum(month.uses, (u) => (u.cost_estimated_sum ? u.cost_estimated_sum.usd : 0))));
  assert.equal(sum(days, (d) => d.tokens), sum(month.uses, (u) => u.tokens));
  assert.equal(sum(days, (d) => d.calls), 11, "September's use is September's");
});

/* ===== R14: periods ===== */

test("R14 a day limit and a month limit are each answered with the use counted against it in its current period up to at, and the limit in its unit", async () => {
  const w = await standard();
  w.u.aiLimitSet({ owner: "project:P", scope: "ask", unit: "calls", period: "day", amount: 10, by: "ann" });
  w.u.aiLimitSet({ owner: "project:P", scope: "overall", unit: "usd", period: "month", amount: 5, by: "ann" });
  w.count("project:P", "ann", "ask", { calls: 2, cost: 0.5, at: "2026-10-20T08:00:00Z" });
  w.count("project:P", "bob", "ask", { calls: 3, cost: 0.25, at: "2026-10-20T09:00:00Z" });
  w.count("project:P", "bob", "ask", { calls: 4, cost: 1, at: "2026-10-19T09:00:00Z" });
  w.count("project:P", "bob", "run", { calls: 1, cost: 2, at: "2026-10-02T09:00:00Z" });
  w.count("project:P", "bob", "run", { calls: 1, cost: 3, at: "2026-10-21T09:00:00Z" });
  const by = Object.fromEntries(over(w, "project:P").periods.map((p) => [`${p.scope}/${p.period}`, p]));
  assert.deepEqual(by["ask/day"], { scope: "ask", unit: "calls", period: "day", period_start: "2026-10-20", used: 5, limit: 10 });
  assert.deepEqual(by["overall/month"], { scope: "overall", unit: "usd", period: "month", period_start: "2026-10-01", used: 3.75, limit: 5 },
    "the month up to the 20th, the 21st's use not yet counted");
  assert.equal(Object.keys(by).length, 2);
});

test("R14 a per_member limit's used is the most any one member used, naming none; an overall limit counts the uses that are not exclusive, as R3 judges them", async () => {
  const w = await standard();
  w.u.aiLimitSet({ owner: "group", scope: "per_member", unit: "calls", period: "day", amount: 6, by: "admin" });
  w.u.aiLimitSet({ owner: "group", scope: "overall", unit: "calls", period: "day", amount: 20, by: "admin" });
  w.u.aiLimitSet({ owner: "group", scope: "run", unit: "calls", period: "day", amount: 9, inclusive: false, by: "admin" });
  w.count("group", "ann", "ask", { calls: 2, at: AT });
  w.count("group", "bob", "ask", { calls: 4, at: AT });
  w.count("group", "bob", "run", { calls: 5, at: AT });
  const r = over(w, "group", "second");
  const by = Object.fromEntries(r.periods.map((p) => [p.scope, p.used]));
  assert.deepEqual(by, { per_member: 9, overall: 6, run: 5 });
  assert.doesNotMatch(JSON.stringify(r), /ann|bob/);
  /* control: what useCheck judges agrees: bob has reached his per-member share, ann has not */
  assert.equal(w.u.useCheck({ owner: "group", member: "bob", use: "ask", at: AT }).scope, "per_member");
  assert.equal(w.u.useCheck({ owner: "group", member: "ann", use: "ask", at: AT }), null);
});

test("R14 with no limit set, periods is one entry for the month with limit null, its use the month's dollars to the day of at; a limit set replaces it (control)", async () => {
  const w = await standard();
  w.count("member:ann", "ann", "ask", { calls: 2, cost: 0.4, at: "2026-10-03T12:00:00Z" });
  w.count("member:ann", "ann", "ask", { calls: 1, cost: 0.35, at: "2026-10-20T12:00:00Z" });
  w.count("member:ann", "ann", "ask", { calls: 1, cost: 0.6, at: "2026-09-30T12:00:00Z" });
  const [only, ...rest] = over(w, "member:ann").periods;
  assert.deepEqual(rest, []);
  assert.deepEqual({ ...only, used: Math.round(only.used * 100) / 100 },
    { scope: "overall", unit: "usd", period: "month", period_start: "2026-10-01", used: 0.75, limit: null });
  w.u.aiLimitSet({ owner: "member:ann", scope: "overall", unit: "calls", period: "month", amount: 50, by: "ann" });
  assert.deepEqual(over(w, "member:ann").periods.map((p) => [p.unit, p.used, p.limit]), [["calls", 3, 50]]);
});

test("R14 (T53) a none plan's days answer cost: null with not_measurable, never zero, its tokens and calls shown; with no limit set its one period is in tokens (control: a priced plan's is in usd)", async () => {
  const w = await standard();
  await w.account("member:cy", "cy", PLANS.none);
  w.count("member:cy", "cy", "ask", { calls: 2, input: 50, cost: 0.3, at: AT });
  const r = over(w, "member:cy", "cy");
  assert.deepEqual(r.days[29], { day: "2026-10-20", calls: 2, tokens: 50, cost: null, not_measurable: true });
  assert.deepEqual(r.periods.map((p) => [p.scope, p.unit, p.period, p.used, p.limit]), [["overall", "tokens", "month", 50, null]]);
  assert.equal(over(w, "member:ann").periods[0].unit, "usd");
});

/* ===== R14: who reads it ===== */

test("R14 anyone but the account's owners is refused as R12 refuses them (ai-accounts R15's refusals), writing nothing; each owner reads it (control)", async () => {
  const w = await standard();
  w.count("project:P", "bob", "ask", { at: AT });
  const before = w.snapshot();
  for (const [owner, viewer] of [["member:ann", "bob"], ["member:ann", "admin"], ["project:P", "bob"], ["project:P", "cy"],
                                 ["project:P", "admin"], ["group", "ann"], ["group", null], ["group", "machine:agent"]]) {
    const r = over(w, owner, viewer);
    const r12 = w.u.aiLimits({ owner, viewer });
    const own = w.a.accountActBar({ owner, by: viewer });
    assert.equal(r.ok, false, `${owner} ${viewer}`);
    assert.deepEqual([r.code, r.check], [r12.code, r12.check], `${owner} ${viewer}: as R12`);
    assert.deepEqual([r.code, r.check], [own.code, own.check], `${owner} ${viewer}: as ai-accounts R15`);
    assert.equal(r.days, undefined);
  }
  assert.equal(over(w, "nobody", "ann").code, "AI_LIMIT_INVALID", "an owner not spelled as the Terms spell it");
  assert.equal(w.snapshot(), before);
  for (const [owner, viewer] of [["member:ann", "ann"], ["project:P", "ann"], ["group", "admin"], ["group", "second"]])
    assert.equal(over(w, owner, viewer).ok, true, `${owner} ${viewer}`);
});

test("R14 the op aiuseovertime answers the account named, its viewer the control plane's stamp, never the body's", async () => {
  const w = await standard();
  w.count("project:P", "bob", "ask");
  const ops = (q, body = null) => aiUseOps(w.u, new URL(`http://x/?${q}`), body);
  const r = ops("owner=project:P&viewer=ann").aiuseovertime();
  assert.deepEqual([r.ok, r.owner, r.days.length], [true, "project:P", 30]);
  assert.equal(ops("owner=project:P&viewer=bob", { viewer: "ann" }).aiuseovertime().ok, false, "the body's viewer is not believed");
  assert.equal(ops("viewer=ann", { owner: "project:P" }).aiuseovertime().owner, "project:P");
});

/* ===== R14: unreadable ===== */

test("R14 it writes nothing and never throws; control: the counter made unreadable answers unreadable: true, never zeros", async () => {
  const w = await standard();
  w.u.aiLimitSet({ owner: "member:ann", scope: "overall", unit: "calls", period: "day", amount: 5, by: "ann" });
  w.count("member:ann", "ann", "ask", { at: AT });
  const before = w.snapshot();
  for (const a of [{}, { owner: "member:ann" }, { owner: "member:ann", viewer: "ann", at: "not a time" }, { owner: 3, viewer: "ann" }])
    assert.doesNotThrow(() => w.u.accountUseOverTime(a), JSON.stringify(a));
  assert.equal(w.snapshot(), before);
  assert.equal(over(w, "member:ann").days.some((d) => d.calls > 0), true, "readable: the use is answered");
  w.db.exec(`ALTER TABLE ai_usage RENAME TO ai_usage_away`);
  const r = over(w, "member:ann");
  assert.deepEqual([r.ok, r.unreadable, r.days, r.periods], [true, true, null, null]);
  w.db.exec(`ALTER TABLE ai_usage_away RENAME TO ai_usage`);
  assert.equal(over(w, "member:ann").unreadable, undefined);
});

/* ===== R6: the keep-away read through ai-accounts, failing closed ===== */

test("R6 (T48) the keep-away is read from ai-accounts: when its aiKeptAway or projectsKeptAway throws, exploreAllowed answers KEPT_AWAY_UNREADABLE as given, never passing; read as usual, it passes (control)", async () => {
  const w = await standard();
  w.bundle("INQ-1", "inquiry");
  w.cite("P", "INQ-1");
  w.explore(w.acct.group, "yes", "admin");
  w.explore(w.acct.P, "yes", "ann");
  const ids = { group: w.acct.group, "project:P": w.acct.P };
  const make = (broken) => new AiUse(w.ctx, { record: w.rc, membership: w.m, zone: "UTC",
    connections: { citesInto: (id) => ({ confirmed: id === "INQ-1" ? ["P"] : [], severed: [] }) },
    accounts: new Proxy(w.a, { get(t, name) {
      const v = t[name];
      if (name === broken) return () => { throw new Error("down"); };
      return typeof v === "function" ? v.bind(t) : v;
    } }) });
  for (const [broken, owner] of [["aiKeptAway", "group"], ["aiKeptAway", "project:P"], ["projectsKeptAway", "group"]]) {
    const r = make(broken).exploreAllowed({ owner, account_id: ids[owner], question: "INQ-1", at: AT });
    assert.deepEqual(r, KEPT_AWAY_UNREADABLE, `${broken} ${owner}`);
    assert.equal(r.code, "AI_KEPT_AWAY");
  }
  for (const owner of ["group", "project:P"])
    assert.equal(make(null).exploreAllowed({ owner, account_id: ids[owner], question: "INQ-1", at: AT }).ask, false, `control: ${owner}`);
});
