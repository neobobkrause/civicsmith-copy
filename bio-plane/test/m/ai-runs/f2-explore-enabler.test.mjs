/* ai-runs F2 (K5821, Bob's REC-11; run-rules R18): an exploring run (origin `explore`) is accountable to the member who
   turned exploring on; `open` judges run-rules R18's `startAllowed` on that member at each run and records her as the
   run's accountable member (`principal_ai_ref`). */
import test from "node:test";
import assert from "node:assert/strict";
import { stepsWorld } from "../steps/fixtures.mjs";
import { world, OPEN, INQ, T0 } from "./world.mjs";

/** A world whose `investigate` may deploy (check verified live, the world holding its test bar), so an exploring run
 *  reaches R18's judgement; and an exploring run's open as `question-explorer` makes it: a machine stamp, no actor. */
async function exploring() {
  const f = stepsWorld();
  const w = world({ steps: f.steps });
  await w.group("ann", "bob"); w.bundle(INQ);
  await w.runs.open(OPEN({ run: "V" }));
  assert.equal(w.runs.verificationRecord({ mode: "check", run: "V", evidence: ["seen live"], by: "member:ann", at: T0 }).ok, true);
  const open = (over) => w.runs.open(OPEN({ run: "X", origin: "explore", place: f.place, work: "find the fee schedule",
                                             actor: null, ...over }));
  return { w, open };
}

test("F2: an exploring run is refused when run-rules R18 refuses the member who turned exploring on — none named, one who is no member, one no longer active — with exploring off and nothing written", async () => {
  const { w, open } = await exploring();
  w.membership.memberSet({ memberId: "bob", status: "revoked", by: "admin" });
  const before = w.dump();
  for (const [over, why] of [[{}, "no enabling member, and no member's act"],
                             [{ enabledBy: "member:nobody" }, "no such member"],
                             [{ enabledBy: "member:bob" }, "her membership was revoked"],
                             [{ enabledBy: "bob" }, "the bare id alike"],
                             [{ enabledBy: "class:ai/tok-org" }, "a machine is no member"]]) {
    const r = await open(over);
    assert.deepEqual([r.started, r.code, r.exploring], [false, "AI_RUN_NOT_A_MEMBER_ACT", "off"], `${why}: ${JSON.stringify(r)}`);
  }
  assert.equal(w.dump(), before, "no refusal wrote anything");
});

test("F2 control: an exploring run whose enabling member is active opens, recording her as its accountable member", async () => {
  const { w, open } = await exploring();
  const x = await open({ enabledBy: "member:bob" });
  assert.deepEqual([x.started, x.origin], [true, "explore"], JSON.stringify(x));
  const row = w.rows(`SELECT principal_ai_ref, origin FROM ai_runs WHERE run = 'X'`)[0];
  assert.deepEqual([row.principal_ai_ref, row.origin], ["member:bob", "explore"]);
  const y = await open({ run: "Y", enabledBy: "ann", work: "read the council minutes" });
  assert.equal(y.started, true, JSON.stringify(y));
  assert.equal(w.rows(`SELECT principal_ai_ref FROM ai_runs WHERE run = 'Y'`)[0].principal_ai_ref, "member:ann");
});
