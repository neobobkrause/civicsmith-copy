/* notice answers:197 (with ai-use:105) for R4: a standing question's AI half now names the account `accountFor` chose to
   ai-use's `useCheck`, so a provider limit standing on that account holds the run back as `limit`, with ai-use's own code
   and translation. R4's item states what held the AI half back in those words, as answers holds them, and never the
   "could not be checked" words a limit unread would draw. Over the real answers, ai-accounts and ai-use (answers' own
   test world), as answers' own notice test drives them. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { answersWorld, answer, V } from "../answers/fixture.mjs";
import { producers, reader, ofKind } from "./fixture.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const BOB = V("bob"), ALICE = V("alice");

test("notice answers:197 (R4) a standing run held back by a provider limit on bob's chosen account: his item states ai-use's provider-limit words, as answers holds them; control: a provider limit on another account holds nothing back", async () => {
  const w = answersWorld();
  const q = w.a.standingQuestionSet({ author: BOB, question: "Anything new on the budget?", query: "title:budget", cadence: "daily", ends: "2026-12-31" });
  assert.equal(q.ok, true, JSON.stringify(q));
  await w.a.standingTick(w.clock.now);
  assert.equal(w.a.standingAiSwitch({ on: true, by: ALICE }).ok, true);
  assert.equal(w.a.registerStandingAnswerer("agent-worker", async () => answer()).ok, true);
  const own = await w.ownAccount("bob", { secret: "sk-bob" });
  assert.equal(w.uses(own, "standing", true, BOB).ok, true);
  let n = 0;
  const step = async () => {
    w.document(`budget ${++n}`, { title: `Budget ${n}` });
    w.at(new Date(Date.parse("2026-10-07T15:00:00.000Z") + (n - 1) * 86400000).toISOString());
    await w.a.standingTick(w.clock.now);
  };
  const limit = (account_id) => assert.equal(w.aiUse.recordProviderLimit({ owner: "member:bob", account_id, entry_id: null, kind: "quota",
    scope: "account", resets_at: "2026-12-01T00:00:00Z", at: w.clock.now }).ok, true);
  const { read } = reader(producers(w.host, { membership: w.membership, answers: w.a }));
  const item = () => ofKind(read("bob", { now: w.clock.now }), "standing-answer").at(-1);
  /* control: a provider limit on some other account bears on nothing */
  limit("acct-elsewhere");
  await step();
  assert.equal(item().basis.held_back, null, "answered: nothing held back");
  limit(own);
  await step();
  const it = item();
  const refusal = w.aiUse.useCheck({ owner: "member:bob", member: "bob", use: "standing", at: w.clock.now, account_id: own });
  assert.deepEqual([refusal.code, refusal.source], ["AI_LIMIT_REACHED", "provider"]);
  assert.deepEqual(it.basis.held_back, { condition: "limit", code: "AI_LIMIT_REACHED", translation: refusal.translation });
  assert.ok(it.detail.includes(refusal.translation.replace(/\.$/, "")), "ai-use's provider-limit words, as answers carries them");
  assert.ok(!it.detail.includes(word("notice-producers.limits_account_pay")), "not the words of a limit that could not be read");
  assert.deepEqual(it.recipients, ["bob"]);
});
