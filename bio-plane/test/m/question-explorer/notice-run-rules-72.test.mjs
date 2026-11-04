/* question-explorer over run-rules PR 72 (R19, R29 as T53 amends them; R30, R37): the gate (R7, R16) asks ai-runs'
   `partAdmitted` (its R78, over run-rules' `partAdmittedOn`) and opens only on what it admits. Civicsmith's own test
   investigations (ai-runs R75) no longer admit a part; a part not admitted shuts the gate whatever R75 records hold, and
   R5 then answers nothing and counts nothing; the test-instance exception still opens it labelled (K874 controls). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { untestedLabel } from "../../../src/run-rules/index.mjs";
import { world, bar, VERIFIED_CHECK } from "./fixture.mjs";

const SHUT = (w) => ({ open: false, why: w.p.gate().why, false_alarm_rate: null, gold_set: null, untested: null });

test("notice run-rules:72 (R7, R16): passed R75 records for investigate and explore no longer open the gate off a test instance (no Gate 1 record admits them), so findsFor answers nothing and no member is offered exploring; control: the same record on a test instance opens it labelled", async () => {
  const w = world();
  w.verifications = [VERIFIED_CHECK];
  w.testBars = [bar("investigate"), bar("explore")];
  w.testInstance = false;
  assert.deepEqual(w.p.gate(), SHUT(w), "R7: not admitted is shut, whatever R75 holds");
  assert.deepEqual(w.calledAs("partAdmitted").slice(-2).map((a) => a.part), ["investigate", "explore"], "ai-runs R78, the one gate");
  assert.deepEqual(w.p.findsFor({ viewer: "member:alice" }), { ok: true, finds: [], truncated: false }, "nothing, no count");
  assert.equal(await w.p.exploreDue(w.clock.now), 0);
  /* Control: the exception lifts the bar alone, so a test instance opens it, every find labelled. */
  w.testInstance = true;
  assert.deepEqual(w.p.gate(), { open: true, why: null, false_alarm_rate: null, gold_set: null, untested: { ...untestedLabel("explore") } });
});

test("notice run-rules:72 (R7, R16): a part ai-runs refuses (withdrawn, R37, or not deployed, R30) shuts the gate even on a test instance, and no label is carried; control: admitted again, it opens", () => {
  const w = world();
  w.verifications = [VERIFIED_CHECK];
  w.testInstance = true;
  const real = w.aiRuns.partAdmitted;
  for (const refused of ["explore", "investigate"]) {
    w.aiRuns.partAdmitted = (part) => (part === refused ? { admitted: false, untested: null } : real(part));
    assert.deepEqual(w.p.gate(), SHUT(w), `${refused} refused`);
    assert.deepEqual(w.p.findsFor({ viewer: "member:alice" }).finds, []);
  }
  w.aiRuns.partAdmitted = real;
  assert.equal(w.p.gate().open, true, "control");
});
