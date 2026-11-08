/* op-declarations, reopened (attempt 15): re-tested against the new interfaces of membership (land 6316509c05, its F1,
   CR2-28: `isAdministrator` answers a `member:<id>` viewer spelling) and hypotheses (land 7c906cfdfc, its F1, CR2-19:
   `hypothesisrivals`, `explorenext` and `rivals` declared in its own `DECLARED_OPS`). Confirmed with no code change here:
   membership's change adds, renames or retires no op, so R6 holds over every op its map serves and its owners declare;
   hypotheses now declares the three rival ops, so F4's "until declared" case is closed and each is in OPS from its
   declared row alone (R80), with that row's spec, NEEDS and stamps, in both session sets. Negative controls beside each. */
import { REGISTERED } from "./register-owners.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { OPS, SESSION_OPS, NEEDS, OP_STAMPS, OP_FAMILIES } from "../../../src/op-declarations/index.mjs";
import { membershipOps } from "../../../src/membership/index.mjs";
import { hypothesesOps } from "../../../src/hypotheses/index.mjs";

const stub = () => new Proxy({}, { get: (_, k) => (k === "then" ? undefined : () => ({ ok: true })) });
const served = (map) => Object.keys(map(stub(), new URL("http://plane/"), {}, stub(), stub()));

test("reopen, hypotheses 7c906cfdfc (F4, R80): hypotheses declares hypothesisrivals, explorenext and rivals, and each is in OPS from that row alone — its spec, NEEDS, stamps and both session sets — with no hand row in hypotheses' family (negative control: an undeclared rival op has no spec)", () => {
  const declared = REGISTERED.hypotheses ?? {};
  for (const op of ["hypothesisrivals", "explorenext", "rivals"]) {
    const row = declared[op];
    assert.ok(row, `${op}: hypotheses does not declare it`);
    assert.equal(Object.hasOwn(OP_FAMILIES.hypotheses.kinds, op), false, `${op}: a hand row`);
    assert.ok(Object.hasOwn(OPS, op), `${op}: no spec`);
    assert.equal(OPS[op].mutating, row.mutating, `${op}: mutating`);
    assert.deepEqual([...OPS[op].classes].sort(), [...row.classes].sort(), `${op}: classes`);
    assert.deepEqual(OPS[op].machineClasses ?? [], row.machineClasses ?? [], `${op}: machineClasses`);
    assert.ok(SESSION_OPS.member.has(op) && SESSION_OPS.admin.has(op), `${op}: not in both session sets`);
    assert.equal(NEEDS[op] ?? null, row.mutating ? row.needs : null, `${op}: NEEDS`);
    assert.deepEqual([...OP_STAMPS[op]].sort(), [...(row.stamps ?? ["viewer"])].sort(), `${op}: stamps`);
  }
  assert.equal(OPS.hypothesisrivals.mutating && OPS.explorenext.mutating && !OPS.rivals.mutating, true);
  assert.equal(Object.hasOwn(OPS, "rivalsunmark"), false);
});

test("reopen, hypotheses 7c906cfdfc and membership 6316509c05 (R6, R81): every op each provider serves or declares has a spec, and each declared row agrees with it (negative control: an op no provider serves has none)", () => {
  const PROVIDERS = {
    hypotheses: [served(hypothesesOps), REGISTERED.hypotheses ?? {}],
    membership: [served(membershipOps), { ...(REGISTERED.membership ?? {}), ...(REGISTERED["member-roster"] ?? {}) }],
  };
  /* R6: the store-internal routes membership serves (its R106's checkaddressees; projectclaimowner, K1864) have no spec */
  const INTERNAL = { membership: ["checkaddressees", "projectclaimowner"] };
  for (const [who, [ops, declared]] of Object.entries(PROVIDERS)) {
    assert.ok(ops.length > 0, `${who}: its map serves no op`);
    const internal = INTERNAL[who] ?? [];
    for (const op of internal) assert.ok(ops.includes(op) && !Object.hasOwn(OPS, op), `${who}: ${op} is specced or not served`);
    for (const op of new Set([...ops, ...Object.keys(declared)])) if (!internal.includes(op)) assert.ok(Object.hasOwn(OPS, op), `${who}: ${op} has no spec`);
    for (const [op, row] of Object.entries(declared)) assert.equal(OPS[op].mutating, row.mutating, `${who}: ${op}: mutating`);
  }
  assert.equal(Object.hasOwn(OPS, "nosuchop-reopen15"), false);
});
