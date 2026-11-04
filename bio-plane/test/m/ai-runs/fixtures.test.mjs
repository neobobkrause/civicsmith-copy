/* ai-runs' published fixtures (./fixtures.mjs), each called here and checked against the real answer. */
import test from "node:test";
import assert from "node:assert/strict";
import { airunDispatchRefusal, airunOpenRefusal, airunRefusal, tickStateTooLarge } from "./fixtures.mjs";
import { AI_RUNS_CHECKS } from "../../../src/run-rules/index.mjs";

const LIMIT = 262144;

test("R18: airunDispatchRefusal gives each dispatch refusal by its code, from the code that really gives it, and none for a code no dispatch gives", async () => {
  const mode = await airunDispatchRefusal("MEMBER_RUN_MODE_NOT_ADMITTED");
  assert.deepEqual([mode.dispatched, mode.code, mode.reason, mode.check, mode.mode],
                   [false, "MEMBER_RUN_MODE_NOT_ADMITTED", "MEMBER_RUN_MODE_NOT_ADMITTED", "C-22.30", "investigate"]);
  assert.equal(mode.translation, AI_RUNS_CHECKS.MEMBER_RUN_MODE_NOT_ADMITTED.translation);
  const principal = await airunDispatchRefusal("AI_RUN_NOT_PRINCIPAL");
  assert.deepEqual([principal.dispatched, principal.found, principal.code, principal.check], [false, true, "AI_RUN_NOT_PRINCIPAL", "C-22.12"]);
  const inactive = await airunDispatchRefusal("ACCOUNT_MEMBER_NOT_ACTIVE");
  assert.deepEqual([inactive.ok, inactive.code, inactive.reason], [false, "ACCOUNT_MEMBER_NOT_ACTIVE", "ACCOUNT_MEMBER_NOT_ACTIVE"]);
  assert.ok(inactive.check && inactive.translation);
  const malformed = await airunDispatchRefusal("AI_RUN_CREDENTIAL_MALFORMED");
  assert.deepEqual([malformed.ok, malformed.code, malformed.what], [false, "AI_RUN_CREDENTIAL_MALFORMED", "run"]);
  assert.ok(malformed.check && malformed.translation);
  await assert.rejects(() => airunDispatchRefusal("AI_RUN_NO_SUCH_THING"), /no dispatch refusal/);
});

test("R52 R78: airunOpenRefusal gives each open refusal by its code — the mode not deployed, no account, and ai-use's limit reached with the figures the screen draws", async () => {
  const mode = await airunOpenRefusal("AI_RUN_MODE_NOT_DEPLOYED");
  assert.deepEqual([mode.started, mode.code, mode.check, mode.mode, mode.deployed], [false, "AI_RUN_MODE_NOT_DEPLOYED", "C-109.1", "check", []]);
  const none = await airunOpenRefusal("AI_NO_ACCOUNT");
  assert.deepEqual([none.started, none.code, none.check], [false, "AI_NO_ACCOUNT", "C-109.10"]);
  const limit = await airunOpenRefusal("AI_LIMIT_REACHED");
  assert.deepEqual([limit.started, limit.code, limit.check], [false, "AI_LIMIT_REACHED", "C-143.1"]);
  for (const k of ["whose", "period", "use"]) assert.equal(typeof limit[k], "string", k);
  await assert.rejects(() => airunOpenRefusal("AI_RUN_NO_SUCH_THING"), /no open refusal/);
});

test("R5 R37: airunRefusal gives the refusal of a close and a tick by a caller who is not the principal, and a run the viewer cannot see read as one that is not there", async () => {
  const f = await airunRefusal();
  assert.deepEqual([f.notPrincipal.code, f.notPrincipal.check, f.notPrincipal.terminated], ["AI_RUN_NOT_PRINCIPAL", "C-22.12", false]);
  assert.deepEqual([f.tickNotPrincipal.code, f.tickNotPrincipal.check, f.tickNotPrincipal.ticked], ["AI_RUN_NOT_PRINCIPAL", "C-22.12", false]);
  assert.equal(f.notPrincipal.translation, AI_RUNS_CHECKS.AI_RUN_NOT_PRINCIPAL.translation);
  assert.deepEqual([f.unseenRead.found, f.unseenRead.session], [false, null]);
  assert.deepEqual([f.unseenLog.found, f.unseenLog.entries], [false, []]);
  assert.deepEqual(f.unseenRead, { ...f.unknownRead, run: f.hiddenRun }, "an unseen run is answered as an unknown one");
});

test("R45: tickStateTooLarge gives the tick's AI_RUN_STATE_TOO_LARGE with the bytes the state measures and the limit; a state at the limit is no fixture of it", async () => {
  const f = await tickStateTooLarge();
  const a = f.answer;
  assert.deepEqual([a.ticked, a.code, a.check, a.bytes, a.limit], [false, "AI_RUN_STATE_TOO_LARGE", "C-22.18", LIMIT + 1, LIMIT]);
  assert.equal(a.bytes, Buffer.byteLength(JSON.stringify(f.state), "utf8"));
  assert.equal(a.translation, AI_RUNS_CHECKS.AI_RUN_STATE_TOO_LARGE.translation);
  const wide = await tickStateTooLarge({ bytes: LIMIT + 1000 });
  assert.deepEqual([wide.answer.bytes, wide.answer.limit], [LIMIT + 1000, LIMIT]);
});
