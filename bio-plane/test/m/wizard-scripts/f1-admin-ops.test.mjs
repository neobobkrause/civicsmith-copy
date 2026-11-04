/* wizard-scripts F1 (T53; store-assembly PR 242, interface-shell PR 172; amends R51; corrected by attempt 4): every name in
   ADMIN_ACTS is an op the assembled registration declares, op-declarations' OPS or an owner's DECLARED_OPS (store-assembly R83's
   OWNERS). It named the retired group-key acts (ai-accounts R35, R36), which store-assembly hands on to the registration
   unchanged; scanmirror and officeconfirm, owner-declared administrator's acts (file-safety R49, entities R64), stay. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { OWNERS } from "../../../src/store-assembly/declarations.mjs";
import { ADMIN_ACTS } from "../../../src/wizard-scripts/index.mjs";
import { RETIRED_ACTS } from "../../../src/wizard-scripts/data.mjs";

/* the ops the assembled registration declares: the hand rows and every owner's rows, as assembleDeclaredOps hands them */
const DECLARED = new Set([...Object.keys(OPS), ...Object.values(OWNERS).flatMap((ops) => Object.keys(ops ?? {}))]);
const undeclared = (acts) => [...acts].filter((op) => !DECLARED.has(op));

test("F1 every ADMIN_ACTS name is an op the assembled registration declares (owner rows included), and no retired op; control: a retired name added is seen", () => {
  assert.deepEqual(undeclared(ADMIN_ACTS), [], "every administrator act is declared");
  assert.deepEqual([...ADMIN_ACTS].filter((op) => Object.hasOwn(RETIRED_ACTS, op)), [], "no retired act");
  /* the T53 acts that replace the retired ones are a member's too, so they are not administrators' acts */
  assert.deepEqual([...ADMIN_ACTS].filter((op) => Object.values(RETIRED_ACTS).includes(op)), [], "no T53 replacement");
  assert.deepEqual(undeclared(new Set([...ADMIN_ACTS, "groupkeyset"])), ["groupkeyset"]);
});

test("F1 scanmirror and officeconfirm, declared by their owners and not by the hand rows, are administrator's acts", () => {
  assert.ok(ADMIN_ACTS.has("scanmirror"), "scanmirror (file-safety R49)");
  assert.ok(ADMIN_ACTS.has("officeconfirm"), "officeconfirm (entities R64)");
  assert.ok(Object.hasOwn(OWNERS["file-safety"], "scanmirror") && Object.hasOwn(OWNERS.entities, "officeconfirm"), "their owners declare them");
  for (const op of ["scanmirror", "officeconfirm"]) assert.ok(DECLARED.has(op), op);
});
