/* op-declarations, BD-1 (corpus-export R17, R18; op-capabilities F1, PR 752): the whole-record export's two door ops are
   declared as `export` is: the founder's session alone. Their op names are read from corpus-export's own map
   (`wholeExportOps`), their NEEDS rows from op-capabilities' `needsRows()` (K3268): this module adds no row of its own. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { OPS, SESSION_OPS, NEEDS, ACT_GATE, UNATTENDED_BY_DECISION } from "../../../src/op-declarations/index.mjs";
import { wholeExportOps } from "../../../src/corpus-export/index.mjs";
import { needsRows } from "../../../src/op-capabilities/index.mjs";

const stub = new Proxy({}, { get: (_, k) => (k === "then" ? undefined : () => ({})) });
const WHOLE = Object.keys(wholeExportOps(stub, () => null));
const plain = (op) => ({ ...OPS[op], classes: [...OPS[op].classes] });

test("R2, R3, R6, F3 (BD-1): each whole-record export op corpus-export serves has a spec with export's classes (admin alone, no machineClasses), exportwhole mutating as export and exportwholepart a read as exportpage; each is in SESSION_OPS.admin and not SESSION_OPS.member, so the act gate answers admin-session; its NEEDS row is op-capabilities' present null (negative control: export's siblings exportlog and exportpage stay out of the founder's set)", () => {
  assert.equal(WHOLE.length, 2);
  const rows = needsRows();
  for (const op of WHOLE) {
    assert.ok(Object.hasOwn(OPS, op), `${op} has no spec`);
    assert.deepEqual(plain(op).classes, [...OPS.export.classes], `${op}: export's classes`);
    assert.ok(!("machineClasses" in OPS[op]), op);
    assert.ok(SESSION_OPS.admin.has(op), `${op}: not in the founder's set`);
    assert.ok(!SESSION_OPS.member.has(op), `${op}: in a member's set`);
    assert.equal(ACT_GATE.mode(op), "admin-session", op);
    assert.ok(!Object.hasOwn(UNATTENDED_BY_DECISION, op), op);
    assert.ok(Object.hasOwn(rows, op), `${op}: op-capabilities holds no row`);
    assert.equal(NEEDS[op], rows[op], `${op}: NEEDS is op-capabilities' row`);
    assert.equal(ACT_GATE.needs(op), null, op);
  }
  assert.equal(OPS.exportwhole.mutating, OPS.export.mutating);
  assert.equal(OPS.exportwholepart.mutating, false);
  for (const op of ["exportlog", "exportpage"]) assert.ok(!SESSION_OPS.member.has(op) || OPS[op].classes.includes("member"), op);
  assert.ok(!SESSION_OPS.admin.has("exportpage"));
});
