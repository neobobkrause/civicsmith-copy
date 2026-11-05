/* op-declarations F2, R34 (T53; BOB 5 Nov): acceptproposals (investigation, PR 425), interpretmark and
   interpretationwithdraw (extraction, PR 432) are member acts their owners declare in their own DECLARED_OPS, with no
   design text yet. Each is named under R34's last ground once an owner's row for it is registered, and not before:
   ACT_HELP_ABSENT never names an op OPS does not hold. Driven on fresh copies of this module, as declared.test.mjs is,
   with a fixture owner's rows (registerDeclaredOps' own input shape, R80). Control: an unregistered copy names none. */
import { test } from "node:test";
import assert from "node:assert/strict";

let n = 0;
const fresh = () => import(`../../../src/op-declarations/index.mjs?unexplained=${++n}`);
const THREE = ["acceptproposals", "interpretationwithdraw", "interpretmark"];
const ACT = { classes: ["admin", "member"], machineClasses: [], mutating: true, stamps: ["by", "viewer"], needs: null };
const groundsOf = (m, op) => Object.entries(m.ACT_HELP_ABSENT).filter(([, g]) => g.ops.includes(op)).map(([k]) => k);

test("F2, R34: once an owner's row for acceptproposals, interpretmark or interpretationwithdraw is registered, it is a member op named under the last ground alone, the list still sorted; unregistered, none is named (control)", async () => {
  const m = await fresh();
  m.registerDeclaredOps({ owner1: Object.fromEntries(THREE.map((op) => [op, ACT])) });
  for (const op of THREE) {
    assert.ok(Object.hasOwn(m.OPS, op) && m.SESSION_OPS.member.has(op), `${op}: not a declared member op`);
    assert.deepEqual(groundsOf(m, op), ["unexplained"], op);
  }
  const ops = [...m.ACT_HELP_ABSENT.unexplained.ops];
  assert.deepEqual(ops, [...ops].sort());
  const none = await fresh();
  none.registerDeclaredOps({});
  for (const op of THREE) assert.deepEqual(groundsOf(none, op), [], `${op}: named with no spec`);
});

test("F2, R34: one owner's row admits only its own op (acceptproposals without extraction's two)", async () => {
  const m = await fresh();
  m.registerDeclaredOps({ owner1: { acceptproposals: ACT } });
  assert.deepEqual(groundsOf(m, "acceptproposals"), ["unexplained"]);
  for (const op of ["interpretmark", "interpretationwithdraw"]) assert.deepEqual(groundsOf(m, op), [], op);
});
