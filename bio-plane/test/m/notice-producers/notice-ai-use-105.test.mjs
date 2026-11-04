/* notice ai-use:105 (T53) for R16: `limitsReached` (its R5, R18) now also answers each provider limit standing on an account
   the viewer owns, `{key, owner, scope, kind, resets_at, reached_at, source: "provider"}`, with no period. The words file
   holds no queue sentence for it (only the refusals' `ai.refused.limit.provider*`), and R16 writes none of its own, so a
   provider limit is told by no item here and is no failure; the account's own limits are told as before. Over the real
   ai-use, ai-accounts and membership, on ai-use's own test world (its fixture). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { standard } from "../ai-use/fixture.mjs";
import { fresh, reader, ofKind } from "./fixture.mjs";

const AT = "2026-10-09T12:00:00Z";
const UTC = () => ({ time_zone: { value: "UTC" } });

async function setup() {
  const w = await standard();
  w.sql.exec(`CREATE TABLE IF NOT EXISTS duties (duty_id TEXT, obligor TEXT)`);
  const { read } = reader(fresh(w.ctx, { membership: w.m, aiUse: w.u, aiAccounts: w.a, view: UTC }));
  return { w, read };
}

test("notice ai-use:105 (R16) a provider limit standing on ann's account is in limitsReached (source provider) but is told by no ai-limit-reached item and fails nothing; her own limit reached beside it is told as before", async () => {
  const { w, read } = await setup();
  const rec = w.u.recordProviderLimit({ owner: "member:ann", account_id: w.acct.ann, entry_id: null, kind: "quota", scope: "account",
                                        resets_at: "2026-11-01T00:00:00Z", at: AT });
  assert.equal(rec.ok, true, JSON.stringify(rec));
  const reached = w.u.limitsReached({ viewer: "ann", at: AT }).reached;
  assert.deepEqual(reached.map((e) => e.source), ["provider"], "ai-use answers the provider limit to its owner");
  assert.equal(reached[0].period, null);
  let r = read("ann", { now: AT });
  assert.deepEqual(ofKind(r, "ai-limit-reached"), [], "no queue words for a provider limit: no item");
  assert.deepEqual(r.facts.failed, [], "and no failure");
  /* control: her own limit reached in the same period is told, keyed by its own key */
  assert.equal(w.u.aiLimitSet({ owner: "member:ann", scope: "ask", unit: "calls", period: "day", amount: 1, by: "ann", at: AT }).ok, true);
  w.count("member:ann", "ann", "ask", { at: "2026-10-09T11:00:00Z" });
  const own = w.u.limitsReached({ viewer: "ann", at: AT }).reached.find((e) => e.source === "own");
  assert.ok(own, "ai-use answers her own limit too");
  r = read("ann", { now: AT });
  assert.deepEqual(ofKind(r, "ai-limit-reached").map((i) => i.id), [`FINDING::ai-limit-reached::${own.key}`]);
  assert.deepEqual(r.facts.failed, []);
  /* control: nobody else is told of either */
  for (const m of ["bob", "cy", "second"]) assert.deepEqual(ofKind(read(m, { now: AT }), "ai-limit-reached"), [], m);
});

test("notice ai-use:105 (R16) an entry answering source provider is told by no item even when it carries a period: the source, not the period, decides", async () => {
  const { w } = await setup();
  const entry = { key: "ai-provider-limit:group:quota:2026-11-01T00:00:00Z", owner: "group", scope: "account", kind: "quota", unit: null,
                  period: "day", period_start: "2026-10-09", resets_at: "2026-11-01T00:00:00Z", reached_at: AT, source: "provider" };
  const run = (reached) => ofKind(reader(fresh(w.ctx, { membership: w.m, aiAccounts: w.a, view: UTC,
    aiUse: { exploreAsksPending: () => ({ ok: true, asks: [] }), limitsReached: () => ({ ok: true, reached }) } })).read("second", { now: AT }), "ai-limit-reached");
  assert.deepEqual(run([entry]), []);
  /* control: the same entry as the account's own limit is told */
  assert.equal(run([{ ...entry, key: "ai-limit:group:ask:calls:day:2026-10-09", scope: "ask", unit: "calls", source: "own" }]).length, 1);
});
