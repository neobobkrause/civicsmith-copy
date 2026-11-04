/* scheduler — the provider notice answers:197 (answers PR 197, T53): a standing question's AI half now names the account
   `accountFor` chose and its entry to `useCheck` (answers R19, R30; ai-use R3, R18), so a provider limit on that account
   holds the run back. This module's `standing-questions` consumer (R21) calls `standingTick(now)` with `standingDue` and
   `standingWake` and answers what it answered under `standingquestions` (R2); none of those changed shape. This checks,
   against the real answers in its own test world, that a firing's tick carries answers' held-back run as answers gave it
   and that the use was judged on the owner's own account. No code of this module changed. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { Scheduler } from "../../../src/scheduler/index.mjs";
import { storage } from "./fixture.mjs";
import { answersWorld, answer, V } from "../answers/fixture.mjs";

const BOB = V("bob"), ALICE = V("alice");

async function standingWorld({ limited }) {
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
  if (limited) {
    const r = w.aiUse.recordProviderLimit({ owner: "member:bob", account_id: own, entry_id: null, kind: "quota", scope: "account",
                                            resets_at: "2026-12-01T00:00:00Z", at: w.clock.now });
    assert.equal(r.ok, true, JSON.stringify(r));
  }
  w.document("budget 1", { title: "Budget 1" });
  w.at("2026-10-07T15:00:00.000Z");
  return { w, q, own, calls };
}

test("notice answers:197, R21, R2: a firing's standing-questions tick answers answers' own run under standingquestions — with a provider limit on the owner's account the run is held back as limit, judged on that account_id, no model called; control: without the limit the answerer is called", async () => {
  const { w, q, own, calls } = await standingWorld({ limited: true });
  const T = Date.parse(w.clock.now);
  const s = new Scheduler({ storage: storage(), owners: { answers: () => w.a } });
  const r = await s.onAlarm(T);
  const mine = r.standingquestions?.ran?.find((x) => x.id === q.id);
  assert.ok(mine, JSON.stringify(r.standingquestions).slice(0, 300));
  assert.equal(mine.new_found, true);
  const refusal = w.aiUse.useCheck({ owner: "member:bob", member: "bob", use: "standing", at: w.clock.now, account_id: own });
  assert.deepEqual(mine.held_back, { condition: "limit", code: "AI_LIMIT_REACHED", translation: refusal.translation });
  assert.equal(w.limit.asked.at(-1).account_id, own, "the use judged on the owner's own account (answers PR 197)");
  assert.equal(calls.length, 0, "no model called");
  /* Negative control: the same world with no provider limit runs the AI half through the scheduler's tick. */
  const c = await standingWorld({ limited: false });
  const r2 = await new Scheduler({ storage: storage(), owners: { answers: () => c.w.a } }).onAlarm(Date.parse(c.w.clock.now));
  const run2 = r2.standingquestions?.ran?.find((x) => x.id === c.q.id);
  assert.ok(run2, JSON.stringify(r2.standingquestions).slice(0, 300));
  assert.equal(run2.held_back ?? null, null, JSON.stringify(run2));
  assert.equal(c.calls.length, 1, "the answerer was called");
  assert.equal(c.w.limit.asked.at(-1).account_id, c.own);
});
