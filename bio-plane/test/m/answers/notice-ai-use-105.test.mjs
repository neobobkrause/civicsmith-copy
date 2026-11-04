/* notice ai-use:105 (T53): `useCheck` takes `account_id` and `entry_id` and judges a provider limit standing on the account
   or its entry (ai-use R3, R18) beside the paying account's own limits. An ask (R30) and a standing question's AI half (R19,
   R30) name the account `accountFor` chose and its entry, so a provider limit on it holds the use back, with ai-use's
   refusal unchanged; a provider limit on another account does not. Over the real ai-accounts and ai-use (fixture.mjs). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { answersWorld, answer, V } from "./fixture.mjs";

const BOB = V("bob"), ALICE = V("alice");

const providerLimit = (w, account_id, over = {}) => {
  const r = w.aiUse.recordProviderLimit({ owner: "member:bob", account_id, entry_id: null, kind: "quota", scope: "account",
                                          resets_at: "2026-12-01T00:00:00Z", at: w.clock.now, ...over });
  assert.equal(r.ok, true, JSON.stringify(r));
  return r;
};

test("notice ai-use:105 (R30) an ask names the chosen account and its entry to useCheck, so a provider limit standing on that account refuses it AI_LIMIT_REACHED source provider, unchanged; one on another account does not", async () => {
  const w = answersWorld();
  const own = await w.ownAccount("bob", { secret: "sk-bob" });
  const ok = await w.a.askAccount({ member: BOB });
  assert.equal(ok.ok, true, JSON.stringify(ok));
  const asked = w.limit.asked.at(-1);
  assert.equal(asked.account_id, own, "the account accountFor chose is named");
  assert.equal(asked.entry_id, ok.account.entry_id, "and its entry");
  /* control: a provider limit on some other account bears on nothing here */
  providerLimit(w, "acct-elsewhere");
  assert.equal((await w.a.askAccount({ member: BOB })).ok, true);
  providerLimit(w, own);
  const r = await w.a.askAccount({ member: BOB });
  assert.equal(r.ok, false);
  assert.deepEqual([r.code, r.source, r.walkable], ["AI_LIMIT_REACHED", "provider", true], JSON.stringify(r));
  assert.deepEqual(r, w.aiUse.useCheck({ owner: "member:bob", member: "bob", use: "ask", at: w.clock.now, account_id: own }),
                   "ai-use's refusal, unchanged");
});

test("notice ai-use:105 (R19, R30) a standing question's AI half names the chosen account to useCheck: a provider limit standing on it holds the run back as limit, with ai-use's code and translation; no grant, no model called", async () => {
  const w = answersWorld();
  const calls = [];
  const q = w.a.standingQuestionSet({ author: BOB, question: "Anything new on the budget?", query: "title:budget",
                                      cadence: "daily", ends: "2026-12-31" });
  assert.equal(q.ok, true, JSON.stringify(q));
  await w.a.standingTick(w.clock.now);
  assert.equal(w.a.standingAiSwitch({ on: true, by: ALICE }).ok, true);
  assert.equal(w.a.registerStandingAnswerer("agent-worker", async () => { calls.push(1); return answer(); }).ok, true);
  const own = await w.ownAccount("bob", { secret: "sk-bob" });
  assert.equal(w.uses(own, "standing", true, BOB).ok, true);
  let n = 0;
  const step = async () => {
    w.document(`budget ${++n}`, { title: `Budget ${n}` });
    w.at(new Date(Date.parse("2026-10-07T15:00:00.000Z") + (n - 1) * 86400000).toISOString());
    const t = await w.a.standingTick(w.clock.now);
    const mine = t.ran.find((x) => x.id === q.id);
    assert.equal(mine.new_found, true);
    return mine.held_back;
  };
  providerLimit(w, own);
  const held = await step();
  const refusal = w.aiUse.useCheck({ owner: "member:bob", member: "bob", use: "standing", at: w.clock.now, account_id: own });
  assert.equal(refusal.code, "AI_LIMIT_REACHED");
  assert.deepEqual(held, { condition: "limit", code: "AI_LIMIT_REACHED", translation: refusal.translation });
  assert.equal(w.limit.asked.at(-1).account_id, own);
  assert.equal(calls.length, 0, "no model called");
  assert.equal(w.rows(`SELECT * FROM ai_grants`).length, 0, "no grant minted");
});
