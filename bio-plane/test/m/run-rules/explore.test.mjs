/* run-rules F1 (K5821, Bob's REC-11): an exploring run, origin `explore`, is judged by R18's `startAllowed` on the member
   who turned exploring on, at each run; that member is its accountable member. Gone or no longer allowed, it is refused
   with a sentence the screen shows and exploring off. Control: the same run with no enabling member is refused, and a
   run of another origin is judged as before. */
import test from "node:test";
import assert from "node:assert/strict";
import { startAllowed } from "../../../src/run-rules/index.mjs";
import { refusal } from "./helpers.mjs";

test("F1: an exploring run is admitted on the member who turned exploring on, while that member is allowed, and records that member as accountable; gone or no longer allowed, or no enabling member, it is AI_RUN_NOT_A_MEMBER_ACT with a detail the screen shows and exploring off; control: another origin is judged on startedBy as before", () => {
  /* the enabling member, still allowed: admitted whoever stamped the run (the system, the scheduler, nobody) */
  for (const startedBy of [null, "class:daemon", "scheduler", "member:zed"])
    for (const mode of ["investigate", "check"])
      assert.deepEqual(startAllowed({ startedBy, mode, origin: "explore", enabledBy: "member:ann", enablerAllowed: true }),
        { ok: true, origin: "explore", accountable: "member:ann" }, `${startedBy} ${mode}`);
  /* a credential the enabling member minted reduces to that member */
  assert.equal(startAllowed({ origin: " explore ", enabledBy: "member:ann/tok1", enablerAllowed: true }).accountable, "member:ann");

  /* the enabling member gone or no longer allowed: refused, fail closed on anything but exactly true */
  const gone = [];
  for (const enablerAllowed of [false, undefined, null, "true", 1, {}]) {
    const r = refusal(startAllowed({ startedBy: "member:zed", mode: "investigate", origin: "explore", enabledBy: "member:ann", enablerAllowed }),
      "AI_RUN_NOT_A_MEMBER_ACT");
    assert.equal(r.exploring, "off");
    assert.equal(typeof r.detail, "string");
    assert.ok(r.detail.length > 0);
    assert.equal(r.detail.includes("ann"), false, "the detail names nobody");
    gone.push(r.detail);
  }
  /* control: no enabling member recorded, refused even with a member's stamp and enablerAllowed true */
  for (const enabledBy of [null, undefined, "", "class:daemon", "ann", "member:", 3, {}]) {
    const r = refusal(startAllowed({ startedBy: "member:zed", mode: "investigate", origin: "explore", enabledBy, enablerAllowed: true }),
      "AI_RUN_NOT_A_MEMBER_ACT");
    assert.equal(r.exploring, "off");
    assert.notEqual(r.detail, gone[0], "no enabler is said apart from an enabler gone");
  }
  /* control: another origin is judged on startedBy, the enabler playing no part */
  assert.deepEqual(startAllowed({ startedBy: "member:zed", mode: "check", origin: "member" }), { ok: true });
  const r = refusal(startAllowed({ startedBy: "class:daemon", mode: "check", origin: "member", enabledBy: "member:ann", enablerAllowed: true }),
    "AI_RUN_NOT_A_MEMBER_ACT");
  assert.equal(r.exploring, undefined);
});
