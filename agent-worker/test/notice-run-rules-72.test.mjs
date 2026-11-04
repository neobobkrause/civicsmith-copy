/* agent-worker over run-rules PR 72 (R19, R29, R30, R36, R37): confirmed, no code change. This member takes from
 * run-rules the test-instance label (R79: `untested`, exactly `untestedLabel(part)`, its R29), which the door hands in
 * from what `partAdmittedOn` answered. PR 72 made `partAdmittedOn` take `{testInstance, entry_id}` and Gate 1 records:
 * an entry that passed Gate 1 for the part's gate part (`GATE_PART_OF`, R36) is admitted UNLABELLED, and only the
 * test-instance exception still labels. So: a label `partAdmittedOn` gives on a test instance is taken by `/ask` and
 * `/draft` unchanged; an admission by a Gate 1 record carries `untested: null`, which this member reads as no label;
 * a part refused (R30's `AI_PART_NOT_DEPLOYED`, R37's `PART_WITHDRAWN`) is the door's refusal and never reaches here.
 * The gate record is held input to run-rules, checked well-formed by its own `checkGateRecord`, not a run-rules answer.
 * Control: a label for another part's shape, or an altered label, is not one (`BAD_BODY`). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { partAdmittedOn, untestedLabel, checkGateRecord, GATE_PART_OF } from "../../bio-plane/src/run-rules/index.mjs";
import { untestedOf } from "../src/untested.mjs";

const EMPTY = undefined; // no real set: R19's standing measure withdraws nothing
const gate = (entry_id, part, verdict = "passes") => ({ part, entry_id, verdict, limits: [], grade: "A", at: "2026-11-01T00:00:00Z",
  suiteVersions: { bank: 1, scorer: 1, thresholds: 1, image: 1 } });

test("notice run-rules:72 (R29, R36 -> agent-worker R79): an ask admitted by a Gate 1 record off a test instance carries no label, read here as none; control: no record admits nothing there", () => {
  const record = gate("e1", GATE_PART_OF.ask);
  assert.equal(checkGateRecord(record), null, "well-formed by run-rules' own check");
  const admitted = partAdmittedOn(EMPTY, "ask", { gateRecords: [record] }, { entry_id: "e1", testInstance: false });
  assert.equal(admitted.admitted, true, "R29 as T53 amends it: Gate 1 admits the entry");
  assert.equal(admitted.untested, null);
  assert.deepEqual(untestedOf({ untested: admitted.untested }), { label: null }, "R79: no label");
  assert.equal(partAdmittedOn(EMPTY, "ask", { gateRecords: [] }, { entry_id: "e1", testInstance: false }).admitted, false);
});

test("notice run-rules:72 (R29 -> agent-worker R79): on a test instance without a Gate 1 record, the label partAdmittedOn gives for ask and a draft is taken here unchanged; control: an altered label is BAD_BODY", () => {
  for (const part of ["ask", "draft:own_words"]) {
    assert.ok(part in GATE_PART_OF, part);
    const a = partAdmittedOn(EMPTY, part, { gateRecords: [] }, { entry_id: "e1", testInstance: true });
    assert.equal(a.admitted, true, part);
    assert.deepEqual(a.untested, untestedLabel(part), part);
    const wire = JSON.parse(JSON.stringify(a.untested));
    assert.deepEqual(untestedOf({ untested: wire }), { label: untestedLabel(part) }, `${part}: taken unchanged`);
    assert.deepEqual(untestedOf({ untested: { ...wire, set_version: "other" } }), { bad: true }, `${part}: control`);
  }
});
