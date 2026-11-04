/* scheduler — the provider notice question-explorer:90 (question-explorer PR 90, T53): `exploreTick`, which this module's
   `question-explore` consumer calls (R26), now reads each owner's account once through ai-accounts' `accountUsesOf` and
   decides on its `account_id` (ai-use R6, R9). The consumer's due, wake and tick are unchanged; this checks, against the
   real question-explorer in its own test world, that a firing's tick decides on the owner's account and the answer
   under `explore` carries what it asked. No code of this module changed. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { Scheduler } from "../../../src/scheduler/index.mjs";
import { storage } from "./fixture.mjs";
import { world as explorerWorld } from "../question-explorer/fixture.mjs";

const Q = "INQ-2026-0001-q", P = "PROJ-2026-0001-p";

test("notice question-explorer:90, R26, R1: a firing's explore tick asks on the owner's own account — the Ask under explore names the project, and ai-use is asked with that project's account_id as ai-accounts answers it; control: an owner switched off is refused with no Ask", async () => {
  const w = await explorerWorld().standard();
  w.draw(Q, P);
  w.project(P, ["alice"], { owners: ["alice"] });
  await w.setExplore("group", "no");
  await w.setExplore(`project:${P}`, "ask");
  const T = Date.parse(w.clock.now);
  const s = new Scheduler({ storage: storage(), owners: { questionExplorer: () => w.p } });
  const r = await s.onAlarm(T);
  assert.deepEqual(r.explore.asked.map((a) => [a.owner, a.questions]), [[`project:${P}`, [Q]]], JSON.stringify(r.explore).slice(0, 300));
  const asks = w.calledAs("exploreAsk");
  assert.equal(asks.length, 1);
  const account = w.aiAccounts.accountUsesOf({ owner: `project:${P}` }).account_id;
  assert.equal(typeof account, "string");
  assert.equal(asks[0].account_id, account, "decided on the owner's own account (question-explorer PR 90)");
  /* Negative control: nothing asked of ai-use for an owner whose explore is off. */
  const off = await explorerWorld().standard();
  off.draw(Q, P);
  off.project(P, ["alice"], { owners: ["alice"] });
  await off.setExplore("group", "no");
  await off.setExplore(`project:${P}`, "no");
  const r2 = await new Scheduler({ storage: storage(), owners: { questionExplorer: () => off.p } }).onAlarm(T);
  assert.deepEqual(r2.explore?.asked ?? [], []);
  assert.equal(off.calledAs("exploreAsk").length, 0);
});
