/* ai-use R2 (setting limits) and R3 (judging a use against them), at the interface, each refusal with a negative
   control (K874), R3's inclusive and exclusive arms, exploring at no and at yes, as the requirements' Suggestions ask. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, standard, WORDS, PLANS, ENTRIES } from "./fixture.mjs";
import { AI_USE_CHECKS, LIMIT_FIELD_WORD } from "../../../src/ai-use/index.mjs";
import { AI_RUNS_CHECKS } from "../../../src/run-rules/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const AT = "2026-10-09T12:00:00Z";
const set = (w, owner, scope, unit, period, amount, by, extra = {}) => w.u.aiLimitSet({ owner, scope, unit, period, amount, by, at: AT, ...extra });
const check = (w, owner, member, use, at = AT, more = {}) => w.u.useCheck({ owner, member, use, at, ...more });

/* ===== R2 ===== */

test("R2 aiLimitSet holds at most one limit per owner, scope, unit and period: set, changed, removed (amount null), each appended to the history with who and when", async () => {
  const w = await standard();
  assert.equal(set(w, "member:ann", "ask", "calls", "day", 5, "ann").change, "set");
  assert.equal(set(w, "member:ann", "ask", "calls", "day", 7, "ann").change, "changed");
  assert.equal(set(w, "member:ann", "ask", "calls", "month", 70, "ann").change, "set");
  assert.deepEqual(w.rows(`SELECT scope, unit, period, amount FROM ai_limits ORDER BY period`),
    [{ scope: "ask", unit: "calls", period: "day", amount: 7 }, { scope: "ask", unit: "calls", period: "month", amount: 70 }]);
  assert.equal(set(w, "member:ann", "ask", "calls", "day", null, "ann").change, "removed");
  assert.equal(w.rows(`SELECT * FROM ai_limits`).length, 1);
  assert.deepEqual(w.rows(`SELECT change, amount, by FROM ai_limit_history ORDER BY seq`),
    [{ change: "set", amount: 5, by: "member:ann" }, { change: "changed", amount: 7, by: "member:ann" },
     { change: "set", amount: 70, by: "member:ann" }, { change: "removed", amount: null, by: "member:ann" }]);
  for (const h of w.rows(`SELECT at FROM ai_limit_history`)) assert.equal(h.at, AT);
  /* negative control: removing a limit not held changes nothing and appends nothing */
  const before = w.snapshot();
  assert.equal(set(w, "member:ann", "draft", "calls", "day", null, "ann").change, "none");
  assert.equal(w.snapshot(), before);
});

test("R2 scope is overall, a USE_KINDS entry, or per_member for a group or project account; unit usd, tokens or calls; period day or month; amount positive (usd to the cent, the others whole) or null; inclusive only for a use scope; anything else AI_LIMIT_INVALID naming the field, writing nothing", async () => {
  const w = await standard();
  const before = w.snapshot();
  const cases = [
    [{ owner: "someone" }, "owner"],
    [{ scope: "everything" }, "scope"], [{ owner: "member:ann", scope: "per_member" }, "scope"],
    [{ unit: "euros" }, "unit"], [{ period: "week" }, "period"],
    [{ amount: 0 }, "amount"], [{ amount: -3 }, "amount"], [{ amount: 1.5 }, "amount"], [{ amount: "5" }, "amount"],
    [{ amount: undefined }, "amount"], [{ unit: "usd", amount: 1.234 }, "amount"],
    [{ scope: "overall", inclusive: false }, "inclusive"], [{ scope: "per_member", inclusive: true }, "inclusive"],
    [{ inclusive: "yes" }, "inclusive"],
  ];
  for (const [over, field] of cases) {
    const a = { owner: "group", scope: "ask", unit: "calls", period: "day", amount: 5, by: "admin", ...over };
    if (a.owner === "member:ann") a.by = "ann";
    if ("amount" in over && over.amount === undefined) delete a.amount;
    const r = w.u.aiLimitSet(a);
    assert.deepEqual([r.ok, r.code, r.check, r.field], [false, "AI_LIMIT_INVALID", "C-143.2", field], JSON.stringify(over));
    assert.equal(r.translation, WORDS["ai.refused.limitinvalid"].replace("{field}", WORDS[LIMIT_FIELD_WORD[field]]));
  }
  assert.equal(w.snapshot(), before);
  /* negative controls: each field's good values are taken */
  for (const a of [{ scope: "overall" }, { scope: "per_member" }, { scope: "explore", inclusive: false }, { unit: "usd", amount: 1.25 },
                   { unit: "tokens", period: "month", amount: 1000 }])
    assert.equal(w.u.aiLimitSet({ owner: "group", scope: "ask", unit: "calls", period: "day", amount: 5, by: "admin", ...a }).ok, true, JSON.stringify(a));
  assert.equal(w.row(`SELECT amount FROM ai_limits WHERE unit='usd'`).amount, 125, "usd held to the cent");
});

test("R2 who may set it is the owner's own act: the member alone (NOT_YOUR_CEILING), a project's owner (ai-accounts' R10 refusals), an active administrator (NOT_AN_ADMIN); each refusal writes nothing", async () => {
  const w = await standard();
  const before = w.snapshot();
  const notYours = AI_RUNS_CHECKS.NOT_YOUR_CEILING;
  for (const by of ["bob", "admin", "second", "machine:agent", null]) {
    const r = set(w, "member:ann", "ask", "calls", "day", 5, by);
    assert.deepEqual([r.code, r.check], ["NOT_YOUR_CEILING", notYours.check], String(by));
  }
  for (const by of ["bob", "admin", "cy", null]) {
    const r = set(w, "project:P", "ask", "calls", "day", 5, by);
    const own = w.a.accountActBar({ owner: "project:P", by });
    assert.equal(r.ok, false, String(by));
    assert.deepEqual([r.code, r.check], [own.code, own.check], `${by}: ai-accounts' own refusal, relayed`);
    assert.ok(["PROJECT_ACT_NOT_THE_OWNER", "PROJECT_SEEN_NOT_A_PARTICIPANT", "NO_SUCH_PROJECT"].includes(r.code), r.code);
  }
  assert.equal(set(w, "project:P", "ask", "calls", "day", 5, "bob").code, "PROJECT_ACT_NOT_THE_OWNER", "a joined participant is not an owner");
  for (const by of ["ann", "bob", "machine:agent", null]) assert.equal(set(w, "group", "ask", "calls", "day", 5, by).code, "NOT_AN_ADMIN", String(by));
  assert.equal(w.snapshot(), before);
  /* negative controls */
  assert.equal(set(w, "member:ann", "ask", "calls", "day", 5, "ann").ok, true);
  assert.equal(set(w, "project:P", "ask", "calls", "day", 5, "ann").ok, true);
  assert.equal(set(w, "group", "ask", "calls", "day", 5, "second").ok, true);
  assert.equal(set(w, "group", "ask", "calls", "day", 6, "admin").ok, true);
});

test("R2 (T53; B1) usd is allowed only on an account whose plan's money is reported or priced: on none and on OPEN it is refused LIMIT_UNIT_UNAVAILABLE, writing nothing; tokens and calls are set on all (control: the same owner's plan changed to reported accepts usd)", async () => {
  const w = await standard();
  const flat = await w.account("member:cy", "cy", PLANS.none);
  await w.account("member:bob", "bob", PLANS.open);
  w.project("S", "cy");
  await w.account("project:S", "cy", PLANS.none);
  const before = w.snapshot();
  for (const [owner, by] of [["member:cy", "cy"], ["project:S", "cy"], ["member:bob", "bob"]]) {
    const r = set(w, owner, "overall", "usd", "month", 10, by);
    assert.deepEqual([r.code, r.check, r.translation], ["LIMIT_UNIT_UNAVAILABLE", "C-143.3", WORDS["ai.refused.unitunavailable"]], owner);
  }
  assert.equal(w.snapshot(), before);
  for (const [owner, by] of [["member:cy", "cy"], ["project:S", "cy"], ["member:bob", "bob"]])
    for (const unit of ["tokens", "calls"]) assert.equal(set(w, owner, "overall", unit, "month", 10, by).ok, true, `${owner} ${unit}`);
  assert.equal(set(w, "member:ann", "overall", "usd", "month", 10, "ann").ok, true, "priced");
  assert.equal(set(w, "project:P", "overall", "usd", "month", 10, "ann").ok, true);
  assert.equal(set(w, "group", "overall", "usd", "month", 10, "admin").ok, true);
  /* control: cy's account moved to a plan that reports money: usd is set */
  w.a.accountRemove({ account_id: flat, by: "cy" });
  await w.account("member:cy", "cy", PLANS.reported);
  assert.equal(set(w, "member:cy", "overall", "usd", "month", 10, "cy").ok, true);
});

test("R2 (T53) an owner holding no account cannot set usd (the plan cannot be read: fail closed); tokens it can", async () => {
  const w = await standard();
  assert.equal(set(w, "member:cy", "overall", "usd", "month", 10, "cy").code, "LIMIT_UNIT_UNAVAILABLE");
  assert.equal(set(w, "member:cy", "overall", "tokens", "month", 10, "cy").ok, true);
});

test("R2 the migration writes today's ceilings: a member's own daily ceiling becomes that member's account's overall day limits in tokens and calls; the copy-wide ceiling the group account's per_member day limits; once", async () => {
  const w = await world({ before: (db) => {
    db.exec(`CREATE TABLE ai_ceilings (holder TEXT PRIMARY KEY, tokens INTEGER, calls INTEGER, set_by TEXT NOT NULL, set_at TEXT NOT NULL)`);
    db.exec(`INSERT INTO ai_ceilings VALUES ('member:ann', 5000, 20, 'member:ann', '2026-09-01T00:00:00Z'),
             ('member:bob', NULL, 9, 'member:bob', '2026-09-01T00:00:00Z'), ('copy', 9000, 40, 'member:second', '2026-09-01T00:00:00Z')`);
  } });
  assert.deepEqual(w.rows(`SELECT owner, scope, unit, period, amount FROM ai_limits ORDER BY owner, unit`), [
    { owner: "group", scope: "per_member", unit: "calls", period: "day", amount: 40 },
    { owner: "group", scope: "per_member", unit: "tokens", period: "day", amount: 9000 },
    { owner: "member:ann", scope: "overall", unit: "calls", period: "day", amount: 20 },
    { owner: "member:ann", scope: "overall", unit: "tokens", period: "day", amount: 5000 },
    { owner: "member:bob", scope: "overall", unit: "calls", period: "day", amount: 9 }]);
  assert.ok(w.rows(`SELECT by FROM ai_limit_history`).every((h) => h.by === "migration:ceilings"));
  /* negative control: a later boot carries nothing again, though ann removed hers */
  await w.group("ann");
  set(w, "member:ann", "overall", "calls", "day", null, "ann");
  w.u.migrate();
  assert.equal(w.rows(`SELECT * FROM ai_limits WHERE owner='member:ann' AND unit='calls'`).length, 0);
});

/* ===== R3 ===== */

test("R3 useCheck answers null under every limit, and AI_LIMIT_REACHED once the use's own limit is reached for the current period (its words ai.refused.limit, {whose} filled, never a cost)", async () => {
  const w = await standard();
  set(w, "project:P", "ask", "calls", "day", 2, "ann");
  w.count("project:P", "bob", "ask");
  assert.equal(check(w, "project:P", "bob", "ask"), null);
  w.count("project:P", "bob", "ask");
  const r = check(w, "project:P", "bob", "ask");
  assert.deepEqual([r.code, r.whose, r.scope, r.unit, r.period, r.use], ["AI_LIMIT_REACHED", "project", "ask", "calls", "day", "ask"]);
  assert.equal(r.translation, word("ai.refused.limit", { whose: word("ai.whose.project"), period: word("ai.period.day"),
    use: word("ai.use.ask.inline"), when: word("ai.when.day") }));
  assert.doesNotMatch(r.translation + r.detail, /\$|usd|cost/i);
  /* the next local day it passes again */
  assert.equal(check(w, "project:P", "bob", "ask", "2026-10-10T12:00:00Z"), null);
});

test("R3 inclusive (the default): a use counts toward its own limit and the overall one, refused at either; the overall limit is judged over the uses that are not exclusive", async () => {
  const w = await standard();
  set(w, "member:ann", "overall", "tokens", "day", 300, "ann");
  set(w, "member:ann", "draft", "tokens", "day", 1000, "ann");
  w.count("member:ann", "ann", "draft", { input: 200 });
  assert.equal(check(w, "member:ann", "ann", "ask"), null);
  w.count("member:ann", "ann", "ask", { input: 100 });
  for (const use of ["ask", "draft", "run"]) assert.equal(check(w, "member:ann", "ann", use).scope, "overall", use);
});

test("R3 exclusive: an exclusive use is refused only at its own limit, and the overall limit is judged without it (a separate allowance on top)", async () => {
  const w = await standard();
  set(w, "member:ann", "overall", "tokens", "day", 300, "ann");
  set(w, "member:ann", "run", "tokens", "day", 500, "ann", { inclusive: false });
  w.count("member:ann", "ann", "run", { input: 400 });
  assert.equal(check(w, "member:ann", "ann", "ask"), null, "the overall limit does not count the exclusive run's 400");
  assert.equal(check(w, "member:ann", "ann", "run"), null, "under its own 500");
  w.count("member:ann", "ann", "ask", { input: 300 });
  assert.equal(check(w, "member:ann", "ann", "ask").scope, "overall");
  assert.equal(check(w, "member:ann", "ann", "run"), null, "an exclusive use is not refused at the overall limit");
  w.count("member:ann", "ann", "run", { input: 100 });
  assert.equal(check(w, "member:ann", "ann", "run").scope, "run");
});

test("R3 per_member: a group or project account's per-member limit is counted over that member's use of that account alone (words ai.refused.limit.member)", async () => {
  const w = await standard();
  set(w, "group", "per_member", "calls", "day", 2, "admin");
  w.count("group", "bob", "ask", { calls: 2 });
  const r = check(w, "group", "bob", "ask");
  assert.deepEqual([r.code, r.scope, r.whose], ["AI_LIMIT_REACHED", "per_member", "group"]);
  assert.equal(r.translation, word("ai.refused.limit.member", { period: word("ai.period.day"), whose: word("ai.whose.group"),
    when: word("ai.when.day") }));
  assert.equal(check(w, "group", "cy", "ask"), null, "another member's use of the account is theirs");
  /* negative control: bob's use paid by his project is not the group account's */
  w.count("project:P", "cy", "ask", { calls: 5 });
  assert.equal(check(w, "group", "cy", "ask"), null);
});

test("R3 it judges only the paying account's limits (D38): the group's limits never bind a member's own account, nor a member's own the group's", async () => {
  const w = await standard();
  set(w, "group", "overall", "calls", "day", 1, "admin");
  set(w, "member:ann", "overall", "calls", "day", 1, "ann");
  w.count("group", "ann", "ask");
  assert.equal(check(w, "member:ann", "ann", "ask"), null);
  assert.equal(check(w, "group", "ann", "ask").whose, "group");
  w.count("member:ann", "ann", "ask");
  assert.equal(check(w, "member:ann", "ann", "ask").whose, "own");
});

test("R3 a month's limit resets on the 1st of the group's local month; a day's at local midnight", async () => {
  const w = await standard({ zone: "America/Los_Angeles" });
  set(w, "member:ann", "overall", "calls", "month", 1, "ann");
  w.count("member:ann", "ann", "ask", { at: "2026-10-31T12:00:00Z" });
  assert.equal(check(w, "member:ann", "ann", "ask", "2026-11-01T06:00:00Z").code, "AI_LIMIT_REACHED", "still October in Los Angeles");
  assert.equal(check(w, "member:ann", "ann", "ask", "2026-11-01T08:00:00Z"), null, "November 1st in Los Angeles");
});

test("R3 for explore: EXPLORE_NOT_ENABLED when the owner's explore is no; at yes with no explore limit held it is judged against the overall limit alone (control: under it, it passes); ask is not R3's refusal", async () => {
  const w = await standard();
  const r = check(w, "group", null, "explore");
  assert.deepEqual([r.code, r.check, r.whose], ["EXPLORE_NOT_ENABLED", "C-143.4", "group"]);
  assert.equal(r.translation, WORDS["ai.refused.explorenotenabled"].replace("{whose}", WORDS["ai.whose.group"]));
  const g = { account_id: w.acct.group };
  w.explore(w.acct.group, "yes", "admin");
  set(w, "group", "overall", "calls", "day", 2, "admin");
  assert.equal(check(w, "group", null, "explore", AT, g), null, "under the overall limit it passes");
  w.count("group", "bob", "ask", { calls: 2 });
  assert.equal(check(w, "group", null, "explore", AT, g).scope, "overall");
  w.explore(w.acct.group, "ask", "admin");
  assert.equal(check(w, "group", null, "explore", AT, g).code, "AI_LIMIT_REACHED", "at ask, R3 judges the limits only");
  set(w, "group", "overall", "calls", "day", null, "admin");
  assert.equal(check(w, "group", null, "explore", AT, g), null);
  assert.equal(check(w, "group", null, "explore").walkable, false, "a use switched off is never walkable");
});

test("R3 it writes nothing and never throws; a counter that cannot be read answers the refusal (fail closed)", async () => {
  const w = await standard();
  set(w, "member:ann", "overall", "calls", "day", 5, "ann");
  const before = w.snapshot();
  for (const args of [{}, { owner: "member:ann", member: "ann", use: "ask" }, { owner: "x", use: "ask" }, { owner: "group", use: "nope" }])
    assert.doesNotThrow(() => w.u.useCheck(args));
  assert.equal(w.snapshot(), before);
  assert.equal(w.u.useCheck({ owner: "x", use: "ask" }).code, "AI_LIMIT_REACHED");
  w.db.exec(`ALTER TABLE ai_usage RENAME TO ai_usage_away`);
  const r = check(w, "member:ann", "ann", "ask");
  assert.deepEqual([r.code, r.check, r.unjudged, r.walkable, r.scope], ["AI_LIMIT_REACHED", AI_USE_CHECKS.AI_LIMIT_REACHED.check, true, false, undefined]);
  /* negative control: readable again, under the limit, it passes */
  w.db.exec(`ALTER TABLE ai_usage_away RENAME TO ai_usage`);
  assert.equal(check(w, "member:ann", "ann", "ask"), null);
});

/* ===== R3 (T53): the source, the provider's limits, walkable, the unjudged dollar limit ===== */

test("R3 R18 (T53) a recorded provider limit with a future resets_at answers source provider, its reset time and walkable true; after resets_at (pinned clock) it answers null; an own limit reached answers source own, walkable true (control: under every limit it answers null)", async () => {
  const w = await standard();
  const a = { account_id: w.acct.ann, entry_id: ENTRIES.priced };
  assert.equal(check(w, "member:ann", "ann", "ask", AT, a), null);
  assert.equal(w.u.recordProviderLimit({ owner: "member:ann", account_id: w.acct.ann, entry_id: null, kind: "spend", scope: "account",
    resets_at: "2026-10-09T18:00:00Z", at: AT }).ok, true);
  const r = check(w, "member:ann", "ann", "ask", AT, a);
  assert.deepEqual([r.code, r.source, r.resets_at, r.walkable, r.kind, r.scope, r.whose], ["AI_LIMIT_REACHED", "provider", "2026-10-09T18:00:00Z", true, "spend", "account", "own"]);
  assert.equal(r.word, "ai.refused.limit.provider");
  assert.equal(check(w, "member:ann", "ann", "ask", "2026-10-09T18:00:01Z", a), null, "past resets_at it passes");
  assert.equal(check(w, "member:ann", "ann", "ask", AT, { account_id: w.acct.group }), null, "another account's provider limit is its own");
  set(w, "member:ann", "ask", "calls", "day", 1, "ann");
  w.count("member:ann", "ann", "ask");
  const own = check(w, "member:ann", "ann", "ask", "2026-10-09T19:00:00Z", a);
  assert.deepEqual([own.source, own.walkable, own.scope], ["own", true, "ask"]);
});

test("R3 (T53; B2) a usd limit bearing on an act whose entry carries neither a price nor a reported cost is refused LIMIT_UNIT_UNAVAILABLE with unjudged, never counted as zero (control: a priced entry, and a tokens limit on the unpriced one, are judged)", async () => {
  const w = await standard();
  set(w, "member:ann", "overall", "usd", "day", 5, "ann");
  const r = check(w, "member:ann", "ann", "ask", AT, { account_id: w.acct.ann, entry_id: ENTRIES.unpriced });
  assert.deepEqual([r.code, r.unjudged, r.walkable, r.entry_id], ["LIMIT_UNIT_UNAVAILABLE", true, false, ENTRIES.unpriced]);
  assert.equal(check(w, "member:ann", "ann", "ask", AT, { account_id: w.acct.ann, entry_id: ENTRIES.priced }), null);
  set(w, "member:ann", "overall", "usd", "day", null, "ann");
  set(w, "member:ann", "overall", "tokens", "day", 5000, "ann");
  assert.equal(check(w, "member:ann", "ann", "ask", AT, { account_id: w.acct.ann, entry_id: ENTRIES.unpriced }), null);
});

test("R3 (T53) a usd limit is judged from the money counted: the reported cost where every call stated one, else the estimate; reached, it refuses source own", async () => {
  const w = await standard();
  set(w, "member:ann", "overall", "usd", "day", 1, "ann");
  w.count("member:ann", "ann", "ask", { cost: 0.4, reported: 0.6 });
  assert.equal(check(w, "member:ann", "ann", "ask"), null, "0.60 reported is under 1.00");
  w.count("member:ann", "ann", "ask", { cost: 0.5, reported: 0.5 });
  assert.equal(check(w, "member:ann", "ann", "ask").unit, "usd", "1.10 reported reaches 1.00");
});
