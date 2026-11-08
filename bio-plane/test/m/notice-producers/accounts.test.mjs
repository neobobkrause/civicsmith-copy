/* R16 (B7; K2353, K2376, K2488; DEC-188 (6), (7)): the AI accounts' items, over the real `ai-use` (its R5
   `limitsReached`, R9 `exploreAsksPending`) and the real `ai-accounts` and `membership`, on ai-use's own test world: ann
   owns P (bob joined) and her own key; cy owns project S; second is an administrator. (T53, K5571 (2); F1) ai-accounts R13
   and its `projectAccountsSuspended` are retired, and with them the `project-account-suspended` item. Each item's sentence and every fill are read by key from the design stream's
   `words.json` (DEC-189 (5), (6); N856), the expected words built here from that file, never from this module; every
   test has its negative control (K874). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { standard, WORDS } from "../ai-use/fixture.mjs";
import { NONE, fresh, reader, ofKind, sentences, texts, byId, dayOn } from "./fixture.mjs";
import { NOTICE_KINDS, NOTICED_LABEL, ASK_LABEL, EXPLORE_APPROVE, ACCOUNT_ITEMS_MAX } from "../../../src/notice-producers/index.mjs";

const AT = "2026-10-09T12:00:00Z";
const UTC = () => ({ time_zone: { value: "UTC" } });
/* `words.json`'s sentence of `key`, its placeholders filled (a key the file lacks fails here) */
const say = (key, fills = {}) => {
  assert.equal(typeof WORDS[key], "string", `${key} is in words.json`);
  return WORDS[key].replace(/\{([A-Za-z_]+)\}/g, (m, k) => (k in fills ? fills[k] : m));
};
const LIMIT_KEYS = ["ai.queue.limitreached", "ai.queue.limitreached.overall", "ai.queue.limitreached.member"];

async function setup() {
  const w = await standard();
  w.sql.exec(`CREATE TABLE IF NOT EXISTS duties (duty_id TEXT, obligor TEXT)`);   /* duties' table, empty (R5) */
  w.project("S", "cy");
  const n = fresh(w.ctx, { membership: w.m, aiUse: w.u, aiAccounts: w.a, view: UTC });
  const { read } = reader(n);
  const items = (member, kind, at = AT) => ofKind(read(member, { now: at }), kind);
  return { w, n, read, items };
}
/* No member's id, handle or cover in any member-facing word or in the item's subject. */
/* (the administrator's handle, "second", is also an English word the suspended item's words use; it reads no account here) */
const MEMBERS = [/\bann\b/, /\bbob\b/, /\bcy\b/, /cover of/, /member:/];
function namesNoMember(it) {
  const bad = [];
  for (const t of [...sentences(it), ...texts(it.subject), ...texts(it.fills || {})]) for (const m of MEMBERS) if (m.test(t)) bad.push(`${m} in ${t}`);
  return bad;
}

test("R16 a use's limit reached reads ai.queue.limitreached, by key: {account} from ai.account.project with the project's name, {period} from ai.period.day, {use} from ai.use.<use>.inline, {date} the local day reached_at falls on (date.daymonth), {when} from ai.until.day; keyed by the entry's own key; nothing before it is reached, nothing to another member", async () => {
  const { w, items } = await setup();
  w.u.aiLimitSet({ owner: "project:P", scope: "ask", unit: "calls", period: "day", amount: 1, by: "ann" });
  assert.deepEqual(items("ann", "ai-limit-reached"), [], "negative control: not yet reached");
  w.count("project:P", "bob", "ask", { at: "2026-10-09T11:00:00Z" });
  const reached = w.u.limitsReached({ viewer: "ann", at: AT }).reached;
  const [it] = items("ann", "ai-limit-reached");
  assert.equal(it.id, `FINDING::ai-limit-reached::${reached[0].key}`, "the source's own key, as given");
  const expected = say("ai.queue.limitreached", { account: say("ai.account.project", { project: "Project P" }), period: say("ai.period.day"),
    use: say("ai.use.ask.inline"), date: dayOn(9, "october"), when: say("ai.until.day") });
  assert.equal(it.detail, expected);
  assert.equal(it.word, "ai.queue.limitreached");
  /* negative control (K874): not the overall limit's sentence, nor the per-member limit's */
  for (const other of ["ai.queue.limitreached.overall", "ai.queue.limitreached.member"])
    assert.notEqual(it.detail, say(other, { account: say("ai.account.project", { project: "Project P" }), period: say("ai.period.day"),
      date: dayOn(9, "october"), when: say("ai.until.day") }), other);
  assert.equal(it.class, "FINDING");
  assert.equal(NOTICE_KINDS[it.kind], "FINDING");
  assert.equal(it.label, NOTICED_LABEL);
  assert.equal(it.summary, it.detail);
  assert.deepEqual(it.recipients, ["ann"]);
  assert.deepEqual(namesNoMember(it), []);
  assert.ok(!/\{/.test(it.detail), "every placeholder filled");
  assert.deepEqual(it.case.ancestors.map((a) => a.id), ["P"], "homed under the project whose account it is");
  for (const m of ["bob", "second", "cy"]) assert.deepEqual(items(m, "ai-limit-reached"), [], `not an owner: ${m}`);
  assert.deepEqual(items("ann", "ai-limit-reached", "2026-10-10T12:00:00Z"), [], "the day's limit is gone in the next period");
});

test("R16 the overall limit reads ai.queue.limitreached.overall and the per-member limit ai.queue.limitreached.member, each by key and naming no member; each scope's sentence differs from the other two (K874)", async () => {
  const { w, items } = await setup();
  w.u.aiLimitSet({ owner: "project:P", scope: "overall", unit: "calls", period: "day", amount: 2, by: "ann" });
  w.u.aiLimitSet({ owner: "project:P", scope: "per_member", unit: "calls", period: "day", amount: 1, by: "ann" });
  w.count("project:P", "bob", "run", { at: "2026-10-09T10:00:00Z" });
  const once = items("ann", "ai-limit-reached");
  assert.deepEqual(once.map((i) => i.subject.scope), ["per_member"], "one member's one call: only the per-member limit");
  w.count("project:P", "bob", "run", { at: "2026-10-09T11:00:00Z" });
  const got = Object.fromEntries(items("ann", "ai-limit-reached").map((i) => [i.subject.scope, i]));
  const fills = { account: say("ai.account.project", { project: "Project P" }), period: say("ai.period.day"),
                  date: dayOn(9, "october"), when: say("ai.until.day") };
  assert.equal(got.overall.detail, say("ai.queue.limitreached.overall", fills));
  assert.equal(got.overall.word, "ai.queue.limitreached.overall");
  assert.equal(got.per_member.detail, say("ai.queue.limitreached.member", fills));
  assert.equal(got.per_member.word, "ai.queue.limitreached.member");
  /* negative controls: each scope's item says none of the other scopes' sentences */
  for (const [scope, own] of [["overall", "ai.queue.limitreached.overall"], ["per_member", "ai.queue.limitreached.member"]])
    for (const k of LIMIT_KEYS.filter((x) => x !== own))
      assert.notEqual(got[scope].detail, say(k, { ...fills, use: say("ai.use.run.inline") }), `${scope} is not ${k}`);
  for (const it of Object.values(got)) assert.deepEqual(namesNoMember(it), [], it.id);
  assert.deepEqual(items("bob", "ai-limit-reached"), [], "the member who reached it owns no account: told nothing here");
});

test("R16 a month's limit on a member's own account: {account} from ai.account.own, {period} ai.period.month, {when} after \"until\" from ai.until.month with the next period's month from date.month.*; the group's limit from ai.account.group, to its administrators only", async () => {
  const { w, items } = await setup();
  w.u.aiLimitSet({ owner: "member:ann", scope: "ask", unit: "calls", period: "month", amount: 1, by: "ann" });
  w.count("member:ann", "ann", "ask", { at: "2026-10-09T11:45:00Z" });
  const [own] = items("ann", "ai-limit-reached");
  assert.equal(own.subject.id, "own");
  assert.equal(own.detail, say("ai.queue.limitreached", { account: say("ai.account.own"), period: say("ai.period.month"), use: say("ai.use.ask.inline"),
    date: dayOn(9, "october"), when: say("ai.until.month", { month: say("date.month.november") }) }));
  assert.ok(own.detail.includes(say("ai.until.month", { month: say("date.month.november") }) + ";"), "ai.until.month: \"… pause until November 1\" (DEC-192 (5))");
  assert.doesNotMatch(own.detail, /until on |December|1 October\b/, "negative control: not the refusals' words (\"on 1 November\"), nor this period's month or a later one");
  assert.deepEqual(namesNoMember(own), []);
  /* a December period ends on January 1 */
  w.u.aiLimitSet({ owner: "member:ann", scope: "draft", unit: "calls", period: "month", amount: 1, by: "ann", at: "2026-12-02T00:00:00Z" });
  w.count("member:ann", "ann", "draft", { at: "2026-12-03T09:00:00Z" });
  const dec = items("ann", "ai-limit-reached", "2026-12-03T10:00:00Z").find((i) => i.subject.scope === "draft");
  assert.ok(dec, "December's draft limit reached");
  assert.ok(dec.detail.includes(` on ${dayOn(3, "december")}. `) && dec.detail.includes(say("ai.until.month", { month: say("date.month.january") }) + ";"), "a December period ends on 1 January");
  /* the group's account, to its administrators */
  w.count("group", "bob", "ask", { calls: 3 });
  w.u.aiLimitSet({ owner: "group", scope: "ask", unit: "calls", period: "day", amount: 2, by: "admin", at: AT });
  const [g] = items("second", "ai-limit-reached");
  assert.equal(g.detail, say("ai.queue.limitreached", { account: say("ai.account.group"), period: say("ai.period.day"), use: say("ai.use.ask.inline"),
    date: dayOn(9, "october"), when: say("ai.until.day") }));
  assert.deepEqual(items("ann", "ai-limit-reached").filter((i) => i.subject.id === "group"), [], "negative control: ann is no administrator");
});

test("R16 a limit's {date} is the profile's local day reached_at falls on, never the UTC day; every use of ai-use's nine reads its ai.use.<use>.inline (DEC-191 (2)), a scope with no such key the overall limit's sentence (J1 (3)); an entry whose period or day cannot be read is no item", async () => {
  const { w } = await setup();
  const at = "2026-10-10T02:00:00Z";                        /* 9 October, 19:00, in Los Angeles */
  const entry = (x) => ({ key: "ai-limit:group:ask:calls:day:2026-10-09", owner: "group", scope: "ask", unit: "calls", period: "day",
    period_start: "2026-10-09", reached_at: at, ...x });
  const run = (reached, view = () => ({ time_zone: { value: "America/Los_Angeles" } })) => ofKind(reader(fresh(w.ctx, { membership: w.m, aiAccounts: w.a, view,
    aiUse: { ...NONE.aiUse, exploreAsksPending: () => ({ ok: true, asks: [] }), limitsReached: () => ({ ok: true, reached }) } })).read("second", { now: AT }), "ai-limit-reached");
  assert.ok(run([entry()])[0].detail.includes(` on ${dayOn(9, "october")}.`), "the local day in the profile's zone");
  assert.ok(run([entry()], UTC)[0].detail.includes(` on ${dayOn(10, "october")}.`), "negative control: in UTC it is the 10th");
  for (const use of ["ask", "draft", "run", "standing", "transcribe", "explore", "enquire", "read", "account"]) {
    const [u] = run([entry({ scope: use, key: `ai-limit:group:${use}:calls:day:2026-10-09` })]);
    assert.equal(u.word, "ai.queue.limitreached", use);
    assert.equal(u.detail, say("ai.queue.limitreached", { account: say("ai.account.group"), period: say("ai.period.day"),
      use: say(`ai.use.${use}.inline`), date: dayOn(9, "october"), when: say("ai.until.day") }), use);
  }
  assert.equal(WORDS["ai.use.nosuchuse.inline"], undefined);
  const [q] = run([entry({ scope: "nosuchuse", key: "ai-limit:group:nosuchuse:calls:day:2026-10-09" })]);
  assert.equal(q.word, "ai.queue.limitreached.overall", "negative control: a scope words.json names no use for");
  assert.equal(q.detail, say("ai.queue.limitreached.overall", { account: say("ai.account.group"), period: say("ai.period.day"),
    date: dayOn(9, "october"), when: say("ai.until.day") }));
  for (const bad of [{ period: "week" }, { period: null }, { reached_at: "not an instant" }, { period: "month", period_start: null, reached_at: null }])
    assert.deepEqual(run([entry(bad)]), [], JSON.stringify(bad));
});

test("R16 one Ask item per entry of ai-use.exploreAsksPending, keyed by its own key, in ai.queue.exploreask's words: {scope} the project's name, or ai.scope.group / ai.scope.own; {account} from ai.account.<kind>.inline; offering act.exploreapprove; to the account's owners only; gone once approved", async () => {
  const { w, items } = await setup();
  w.bundle("INQ-1", "inquiry");
  w.cite("P", "INQ-1");
  /* (ai-use:105, T53) the explore switch and the ask are the account's, named by its id */
  assert.equal(w.explore(w.acct.P, "ask", "ann").ok, true);
  assert.deepEqual(items("ann", "explore-ask"), [], "negative control: nothing asked");
  assert.equal(w.u.exploreAsk({ owner: "project:P", account_id: w.acct.P, at: AT, what: ["What did the council vote?"] }).minted, true);
  const [it] = items("ann", "explore-ask");
  assert.equal(it.id, "FINDING::explore-ask::explore-ask:project:P:2026-10-09");
  assert.equal(it.class, "FINDING");
  assert.equal(it.label, ASK_LABEL);
  assert.equal(it.word, "ai.queue.exploreask");
  assert.equal(it.detail, say("ai.queue.exploreask", { scope: "Project P", what: "What did the council vote?", account: say("ai.account.project.inline") }));
  assert.notEqual(it.detail, say("ai.queue.exploreask", { scope: say("ai.scope.group"), what: "What did the council vote?", account: say("ai.account.group.inline") }),
    "negative control: not the group's words");
  assert.deepEqual(it.subject.questions, ["What did the council vote?"]);
  /* (ai-use:105, its R10) the rough cost is now `{low, high, unit, basis}`, carried as ai-use answers it, never restated */
  const [pending] = w.u.exploreAsksPending({ viewer: "ann", at: AT }).asks;
  assert.deepEqual(it.basis.estimate, pending.estimate, "R10's rough cost, as ai-use states it");
  assert.deepEqual(Object.keys(it.basis.estimate).sort(), ["basis", "high", "low", "unit"]);
  assert.deepEqual(it.options[0], EXPLORE_APPROVE);
  assert.equal(EXPLORE_APPROVE.label, WORDS["act.exploreapprove.label.queue"]);
  assert.deepEqual(it.recipients, ["ann"]);
  assert.deepEqual(namesNoMember(it), []);
  for (const m of ["bob", "second", "cy"]) assert.deepEqual(items(m, "explore-ask"), [], `not an owner: ${m}`);
  w.u.exploreApprove({ owner: "project:P", day: "2026-10-09", by: "ann", at: AT });
  assert.deepEqual(items("ann", "explore-ask"), [], "approved: no longer asked");
  /* the group's and a member's own account (ai-use's entries, as it answers them) */
  const asks = (owner) => ofKind(reader(fresh(w.ctx, { membership: w.m, aiAccounts: w.a, view: UTC, aiUse: { ...NONE.aiUse, limitsReached: () => ({ ok: true, reached: [] }),
    exploreAsksPending: () => ({ ok: true, asks: [{ key: `explore-ask:${owner}:2026-10-09`, owner, day: "2026-10-09", what: ["Q?"], asked_at: AT }] }) } }))
    .read("ann", { now: AT }), "explore-ask")[0];
  assert.equal(asks("group").detail, say("ai.queue.exploreask", { scope: say("ai.scope.group"), what: "Q?", account: say("ai.account.group.inline") }));
  assert.equal(asks("member:ann").detail, say("ai.queue.exploreask", { scope: say("ai.scope.own"), what: "Q?", account: say("ai.account.own.inline") }));
  assert.deepEqual(namesNoMember(asks("member:ann")), [], "a member's own account names no member");
});

test("F1 (T53; K5571 (2)) project-account-suspended is retired: ai-accounts R13's projectAccountsSuspended is gone, so the read neither calls it nor fails on it, and no such item is raised, even where a provider still offers the read", async () => {
  const { w, read } = await setup();
  assert.equal(typeof w.a.projectAccountsSuspended, "undefined", "the T53 ai-accounts has no such read");
  assert.equal(w.join("S", "cy", "bob").ok, true);   /* what once suspended a project's sign-in */
  for (const m of ["cy", "ann", "bob", "second"]) {
    const r = read(m, { now: AT });
    assert.deepEqual(r.facts.failed, [], `${m}: no provider failed`);
    assert.equal("signin_suspended" in r.facts, false, `${m}: no bound stated for a producer that is gone`);
    assert.deepEqual(ofKind(r, "project-account-suspended"), [], m);
  }
  assert.equal("project-account-suspended" in NOTICE_KINDS, false, "the kind is no longer raised here");
  /* control: an ai-accounts that still answered the retired read is not read */
  let asked = 0;
  const old = reader(fresh(w.ctx, { membership: w.m, aiUse: w.u, view: UTC, aiAccounts: Object.assign(Object.create(NONE.aiAccounts), { projectAccountsSuspended: () => {
    asked += 1; return [{ project: "S", since: "2026-10-01T00:00:00Z", key: "S|cy|2026-10-01T00:00:00Z" }]; } }) })).read("cy", { now: AT });
  assert.equal(asked, 0);
  assert.deepEqual(ofKind(old, "project-account-suspended"), []);
  assert.deepEqual(old.facts.failed, []);
});

test("R16 R1 a read that does not answer is its provider's failure, named in facts.failed, never read as no item; the bound and truncated stated", async () => {
  const { w } = await setup();
  const run = (deps) => reader(fresh(w.ctx, { membership: w.m, aiUse: w.u, aiAccounts: w.a, view: UTC, ...deps })).read("ann", { now: AT });
  const boom = () => { throw new Error("down"); };
  for (const [deps, name] of [[{ aiUse: { ...NONE.aiUse, exploreAsksPending: () => ({ ok: true, asks: [], unreadable: true }), limitsReached: () => ({ ok: true, reached: [] }) } }, "ai-use"],
                              [{ aiUse: { ...NONE.aiUse, exploreAsksPending: () => ({ ok: true, asks: [] }), limitsReached: boom } }, "ai-use"]])
    assert.deepEqual(run(deps).facts.failed, [name], name);
  const many = Array.from({ length: ACCOUNT_ITEMS_MAX + 1 }, (_, i) => ({ key: `ai-limit:member:ann:ask:calls:day:k${i}`, owner: "member:ann",
    scope: "ask", unit: "calls", period: "day", period_start: "2026-10-09", reached_at: AT }));
  const r = run({ aiUse: { ...NONE.aiUse, exploreAsksPending: () => ({ ok: true, asks: [] }), limitsReached: () => ({ ok: true, reached: many }) } });
  assert.equal(ofKind(r, "ai-limit-reached").length, ACCOUNT_ITEMS_MAX);
  assert.deepEqual(r.facts.ai_limit, { bound: ACCOUNT_ITEMS_MAX, truncated: true });
  assert.deepEqual(run({}).facts.ai_limit, { bound: ACCOUNT_ITEMS_MAX, truncated: false }, "negative control: within the bound");
  const before = w.snapshot();
  run({});
  assert.equal(w.snapshot(), before, "the read writes nothing");
});


/* R16 (T44; N869, N876; DEC-191 (3), DEC-192 (3), (5)): `{date}` is `date.daymonth`, or `date.daymonthyear` when the local day
   reached_at falls on is not in the current local year; `{when}` after "until" is `ai.until.*`. Over ai-use R5's entries as
   it answers them, in a profile west of UTC. */
test("R16 (T44) {date}: reached_at on 7 October local reads \"7 October\" (date.daymonth, no leading zero); an instant that is the 6th locally and the 7th in UTC reads \"6 October\" (control); a day in another local year reads \"{day} {month} {year}\" (date.daymonthyear; control: this year's has no year); {when} reads \"1 November\" after \"until\"", async () => {
  const { w } = await setup();
  const LA = () => ({ time_zone: { value: "America/Los_Angeles" } });
  const entry = (x) => ({ key: "ai-limit:group:ask:calls:day:k", owner: "group", scope: "ask", unit: "calls", period: "day", ...x });
  const run = (reached, now, view = LA) => ofKind(reader(fresh(w.ctx, { membership: w.m, aiAccounts: w.a, view,
    aiUse: { ...NONE.aiUse, exploreAsksPending: () => ({ ok: true, asks: [] }), limitsReached: () => ({ ok: true, reached }) } })).read("second", { now }), "ai-limit-reached")[0];
  const fills = (date, when = say("ai.until.day")) => ({ account: say("ai.account.group"), period: say("ai.period.day"), use: say("ai.use.ask.inline"), date, when });
  /* 7 October, 08:00 local */
  const seventh = run([entry({ period_start: "2026-10-07", reached_at: "2026-10-07T15:00:00Z" })], "2026-10-07T20:00:00Z");
  assert.equal(seventh.detail, say("ai.queue.limitreached", fills(dayOn(7, "october"))));
  assert.ok(seventh.detail.includes(` on ${dayOn(7, "october")}. `));
  assert.ok(!seventh.detail.includes(dayOn(7, "october").replace(/\d+/, (d) => d.padStart(2, "0"))), "no leading zero");
  assert.doesNotMatch(seventh.detail, /2026/, "no year in the current year");
  /* 6 October, 20:00 local, the 7th in UTC: the local day */
  const sixth = run([entry({ period_start: "2026-10-06", reached_at: "2026-10-07T03:00:00Z" })], "2026-10-07T04:00:00Z");
  assert.ok(sixth.detail.includes(` on ${dayOn(6, "october")}. `));
  assert.ok(run([entry({ period_start: "2026-10-07", reached_at: "2026-10-07T03:00:00Z" })], "2026-10-07T04:00:00Z", UTC).detail.includes(` on ${dayOn(7, "october")}. `),
    "control: in UTC it is the 7th");
  assert.ok(run([entry({ period_start: "2026-10-06", reached_at: "2026-10-07T03:00:00.250Z" })], "2026-10-07T04:00:00Z").detail.includes(` on ${dayOn(6, "october")}. `),
    "an instant with a fraction of a second reads the same day");
  /* another local year: reached on 31 December 2025, read on 1 January 2026 (local) */
  const other = run([entry({ period_start: "2025-12-31", reached_at: "2025-12-31T20:00:00Z" })], "2026-01-01T20:00:00Z");
  assert.equal(other.detail, say("ai.queue.limitreached", fills(dayOn(31, "december", 2025))));
  assert.ok(other.detail.includes(` on ${dayOn(31, "december", 2025)}. `));
  /* control: the current local year is the profile's: at 05:00 UTC on 1 January it is still 31 December 2025 locally */
  const same = run([entry({ period_start: "2025-12-31", reached_at: "2025-12-31T20:00:00Z" })], "2026-01-01T05:00:00Z");
  assert.equal(same.detail, say("ai.queue.limitreached", fills(dayOn(31, "december"))));
  assert.doesNotMatch(same.detail, /2025/, "control: this year's day names no year");
  /* {when} after "until": a month's limit pauses until the 1st of the next month */
  const month = run([entry({ period: "month", period_start: "2026-10-01", reached_at: "2026-10-07T15:00:00Z", key: "ai-limit:group:ask:calls:month:k" })],
    "2026-10-07T20:00:00Z");
  assert.equal(month.detail, say("ai.queue.limitreached", { ...fills(dayOn(7, "october"), say("ai.until.month", { month: say("date.month.november") })),
    period: say("ai.period.month") }));
  assert.ok(month.detail.includes(say("ai.until.month", { month: say("date.month.november") }) + ";"));
  assert.doesNotMatch(month.detail, /until on/, "control: not the refusals' ai.when.month");
  assert.match(seventh.detail, / until tomorrow;/, "a day's limit: ai.until.day");
});
