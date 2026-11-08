/* notice ai-use:105 (T53) for R16: `limitsReached` (its R5, R18) now also answers each provider limit standing on an account
   the viewer owns, `{key, owner, scope, kind, resets_at, reached_at, source: "provider"}`, with no period. R16 tells one item
   per entry of `limitsReached`; the words file now holds the queue sentences for it (`ai.queue.limitreached.provider`, and
   `.provider.unknown` when the provider named no time), so a provider limit is told by its own key, `{when}` the local day it
   lifts. Over the real ai-use, ai-accounts and membership, on ai-use's own test world (its fixture). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { standard } from "../ai-use/fixture.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { NONE, fresh, reader, ofKind } from "./fixture.mjs";

const AT = "2026-10-09T12:00:00Z";
const UTC = () => ({ time_zone: { value: "UTC" } });

async function setup() {
  const w = await standard();
  w.sql.exec(`CREATE TABLE IF NOT EXISTS duties (duty_id TEXT, obligor TEXT)`);
  const { read } = reader(fresh(w.ctx, { membership: w.m, aiUse: w.u, aiAccounts: w.a, view: UTC }));
  return { w, read };
}

test("notice ai-use:105 (R16) a provider limit standing on ann's account is one ai-limit-reached item to her, keyed by the entry's own key, its words ai.queue.limitreached.provider naming the day it lifts", async () => {
  const { w, read } = await setup();
  const rec = w.u.recordProviderLimit({ owner: "member:ann", account_id: w.acct.ann, entry_id: null, kind: "quota", scope: "account",
                                        resets_at: "2026-11-01T00:00:00Z", at: AT });
  assert.equal(rec.ok, true, JSON.stringify(rec));
  const reached = w.u.limitsReached({ viewer: "ann", at: AT }).reached;
  assert.deepEqual(reached.map((e) => e.source), ["provider"], "ai-use answers the provider limit to its owner");
  let r = read("ann", { now: AT });
  const items = ofKind(r, "ai-limit-reached");
  assert.deepEqual(items.map((i) => i.id), [`FINDING::ai-limit-reached::${reached[0].key}`]);
  assert.equal(items[0].word, "ai.queue.limitreached.provider");
  assert.equal(items[0].summary, word("ai.queue.limitreached.provider", { account: word("ai.account.own"), date: word("date.daymonth", { month: word("date.month.october"), day: "9" }),
    when: word("date.daymonth", { month: word("date.month.november"), day: "1" }) }));
  assert.equal(items[0].basis.limit_source, "provider");
  assert.deepEqual(r.facts.failed, []);
  /* told once: the same key on a second cycle */
  assert.deepEqual(ofKind(read("ann", { now: AT }), "ai-limit-reached").map((i) => i.id), items.map((i) => i.id));
  /* her own limit reached beside it is told too, by its own key */
  assert.equal(w.u.aiLimitSet({ owner: "member:ann", scope: "ask", unit: "calls", period: "day", amount: 1, by: "ann", at: AT }).ok, true);
  w.count("member:ann", "ann", "ask", { at: "2026-10-09T11:00:00Z" });
  const own = w.u.limitsReached({ viewer: "ann", at: AT }).reached.find((e) => e.source === "own");
  assert.ok(own, "ai-use answers her own limit too");
  r = read("ann", { now: AT });
  assert.deepEqual(ofKind(r, "ai-limit-reached").map((i) => i.id).sort(), [`FINDING::ai-limit-reached::${own.key}`, items[0].id].sort());
  /* control: nobody else is told of either */
  for (const m of ["bob", "cy", "second"]) assert.deepEqual(ofKind(read(m, { now: AT }), "ai-limit-reached"), [], m);
});

test("notice ai-use:105 (R16) a provider limit with no time it lifts reads ai.queue.limitreached.provider.unknown; the source, not the period, picks the words; no member is named", async () => {
  const { w } = await setup();
  const entry = { key: "ai-provider-limit:group:quota:none", owner: "group", scope: "account", kind: "quota", unit: null,
                  period: null, period_start: null, resets_at: null, reached_at: AT, source: "provider" };
  const run = (reached) => ofKind(reader(fresh(w.ctx, { membership: w.m, aiAccounts: w.a, view: UTC,
    aiUse: { ...NONE.aiUse, exploreAsksPending: () => ({ ok: true, asks: [] }), limitsReached: () => ({ ok: true, reached }) } })).read("second", { now: AT }), "ai-limit-reached");
  /* the entry is ai-use R5's provider shape, as its real `limitsReached` answers it in the test above */
  const unknown = run([entry]);
  assert.equal(unknown.length, 1);
  assert.equal(unknown[0].id, `FINDING::ai-limit-reached::${entry.key}`);
  assert.equal(unknown[0].word, "ai.queue.limitreached.provider.unknown");
  assert.equal(unknown[0].summary, word("ai.queue.limitreached.provider.unknown", { account: word("ai.account.group"),
    date: word("date.daymonth", { month: word("date.month.october"), day: "9" }) }));
  /* a provider entry carrying a period is still told by the provider's words */
  const withPeriod = run([{ ...entry, period: "day", period_start: "2026-10-09", resets_at: "2026-10-10T00:00:00Z" }]);
  assert.equal(withPeriod[0].word, "ai.queue.limitreached.provider");
  /* control: the same entry as the account's own limit reads the account's words */
  const own = run([{ ...entry, key: "ai-limit:group:ask:calls:day:2026-10-09", scope: "ask", unit: "calls", period: "day", period_start: "2026-10-09", source: "own" }]);
  assert.equal(own[0].word, "ai.queue.limitreached");
});
