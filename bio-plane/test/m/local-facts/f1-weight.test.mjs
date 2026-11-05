/* local-facts F1 (surface-declarations R17; BOB's grade, PR 418): layerreportcarry is declared weight reversible, not undetermined;
   nothing else in its declaration changes. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DECLARED_OPS } from "../../../src/local-facts/index.mjs";

test("F1: layerreportcarry is declared weight reversible", () => {
  const d = DECLARED_OPS.layerreportcarry;
  assert.ok(d, "layerreportcarry is declared");
  assert.equal(d.weight, "reversible");
  assert.equal(d.mutating, true);
  assert.deepEqual(d.classes, ["admin", "member"]);
  assert.deepEqual(d.machineClasses, []);
  assert.deepEqual(d.fields, { accepts: ["report"], requires: ["report"] });
});
