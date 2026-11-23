/* op-declarations R80, R81 (T51 fix round; K4168, K4202) over two real owners' declarations, `queue`'s and `case-import`'s
   `DECLARED_OPS` (queue R92, case-import R33): registered with this module, each owner's row for an op the hand tables hold
   agrees with the hand row and keeps its fields, and changes no table; each new op is declared from its row alone; a row
   that disagrees with a hand row is refused naming the op. The same rows are accepted by op-grades (its R49, R50), which
   both owners' requirements name beside this module's. Each op-declarations instance is a fresh one (a query on the
   specifier), since a registration is once per instance and before its first read; op-grades keeps its registration in a
   file of its own, so it is registered once in this file, with both owners together. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DECLARED_OPS as QUEUE } from "../../../src/queue/index.mjs";
import { DECLARED_OPS as CASE_IMPORT } from "../../../src/case-import/index.mjs";
import * as G from "../../../src/op-grades/index.mjs";

let n = 0;
const fresh = () => import(`../../../src/op-declarations/index.mjs?owners=${++n}`);
/* every table an op's routing reads, as declared.test.mjs views them */
const view = (m) => JSON.stringify({ ops: m.OPS, needs: m.NEEDS, stamps: m.OP_STAMPS, member: [...m.SESSION_OPS.member],
  admin: [...m.SESSION_OPS.admin], families: m.OP_FAMILIES, lists: Object.entries(m).filter(([, v]) => Array.isArray(v)) });
const QUEUE_OPS = ["proposedispose", "queuemute", "queuesnooze"];
const CASE_IMPORT_HELD = ["caseimport", "importaccept", "importacceptwithdraw", "importflag", "importwatch"];
const CASE_IMPORT_NEW = ["importregrade", "rerunpair", "rerunread", "rerunstart"];

test("R80, R81 (queue R92): queue's three rows agree with their hand rows; each keeps its fields and no table changes", async () => {
  const m = await fresh();
  m.registerDeclaredOps({ queue: QUEUE });
  for (const op of QUEUE_OPS) assert.deepEqual(m.declaredFields(op), QUEUE[op].fields, op);
  assert.equal(view(m), view(await fresh()));
});

test("R80, R81 (case-import R33): case-import's five held rows agree with their hand rows and its four new ops are declared from their rows", async () => {
  const m = await fresh();
  m.registerDeclaredOps({ "case-import": CASE_IMPORT });
  /* the four new ops: in OPS, both session sets, their stamps and NEEDS rows, their fields */
  assert.deepEqual({ ...m.OPS.rerunread }, { classes: ["admin", "member"], machineClasses: [], mutating: false });
  assert.equal(m.OPS.rerunstart.mutating, true);
  assert.equal(m.NEEDS.rerunstart, "contribute");
  assert.equal(m.NEEDS.rerunread, null);
  assert.deepEqual([...m.OP_STAMPS.rerunpair], ["viewer", "by"]);
  for (const op of CASE_IMPORT_NEW) {
    assert.equal(m.SESSION_OPS.member.has(op) && m.SESSION_OPS.admin.has(op), true, op);
    assert.deepEqual(m.declaredFields(op), CASE_IMPORT[op].fields, op);
  }
  assert.deepEqual(m.declaredFields("rerunpair")?.requires, ["project", "source_finding", "own_finding"]);
  /* the five held ops keep their hand rows, and their fields are kept beside them */
  const before = await fresh();
  for (const op of CASE_IMPORT_HELD) {
    assert.deepEqual(m.OPS[op], before.OPS[op], op);
    assert.deepEqual(m.declaredFields(op), CASE_IMPORT[op].fields, op);
  }
  assert.equal(m.OPS.caseimport.mutating, true);
});

test("R81 control: a case-import row that disagrees with its hand row is refused naming the op and the field, and nothing is registered", async () => {
  const m = await fresh();
  const rows = { ...CASE_IMPORT, importaccept: { ...CASE_IMPORT.importaccept, mutating: false } };
  assert.throws(() => m.registerDeclaredOps({ "case-import": rows }),
    (e) => e instanceof TypeError && e.message.includes("importaccept") && e.message.includes("mutating"));
  assert.equal(Object.hasOwn(m.OPS, "rerunread"), false);
  assert.equal(m.declaredFields("importaccept"), undefined);
});

test("R80, R81 with op-grades R49, R50: both owners' rows are accepted by op-grades too, the held ops agreed and the new ones registered; a disagreeing weight is refused", () => {
  assert.throws(() => { const { refusal, ...row } = CASE_IMPORT.importaccept;
    G.registerDeclaredOps({ "case-import": { importaccept: { ...row, weight: "terminal" } } }); },
  (e) => /DECLARED_OP_DISAGREES: importaccept/.test(e.message));
  const r = G.registerDeclaredOps({ queue: QUEUE, "case-import": CASE_IMPORT });
  assert.deepEqual([...r.registered].sort(), CASE_IMPORT_NEW);
  assert.deepEqual([...r.agreed].sort(), [...CASE_IMPORT_HELD, ...QUEUE_OPS].sort());
});
