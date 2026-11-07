/* op-declarations, provider notice instance-setup:948 (layer 11, attempt 10; instance-setup F2). instance-setup changed
   how `memberVersions` reads agent-runner from agent-worker's `/version` (served without `runner`, the runner is
   agent-worker's part, SERVING), which changes `op=bootstrap`'s answer with `members=1` and its `part_signin`. It added,
   renamed and retired no op. Confirmed with no change here: R6 holds over instance-setup's own declarations and ops map,
   read from its code (K3268): every op it declares has a spec, and every route its map serves is either specified or a
   store-internal route in no table, never half declared; and `bootstrap`'s spec is unchanged: public, not mutating,
   naming no answer field, so a changed answer needs nothing in OPS. */
import "./register-owners.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { OPS, SESSION_OPS, NEEDS, OP_STAMPS } from "../../../src/op-declarations/index.mjs";
import { instanceSetupOps, DECLARED_OPS as SETUP_DECLARED } from "../../../src/setup.mjs";

const svc = () => new Proxy({}, { get: (_, k) => (k === "then" ? undefined : () => ({ ok: true })) });
const served = Object.keys(instanceSetupOps(svc(), new URL("http://plane/"), {}));

const inSession = (op) => SESSION_OPS.member.has(op) || SESSION_OPS.admin.has(op);
const inNoTable = (op) => !Object.hasOwn(OPS, op) && !Object.hasOwn(NEEDS, op) && !inSession(op) && !Object.hasOwn(OP_STAMPS, op);

test("notice instance-setup:948 (R6): after F2 every op instance-setup declares has a spec in OPS, and every route its map serves is specified or a store-internal route in no table (negative control: an op no provider serves has none)", () => {
  assert.ok(served.length > 0, "instance-setup's map serves no op");
  assert.ok(Object.keys(SETUP_DECLARED).length > 0, "instance-setup declares no op");
  for (const op of Object.keys(SETUP_DECLARED)) assert.ok(OPS[op], `instance-setup declares ${op}, which has no spec`);
  for (const op of served) assert.ok(OPS[op] || inNoTable(op), `instance-setup serves ${op}: no spec, yet in a table`);
  assert.ok(served.some((op) => OPS[op]), "none of instance-setup's routes is specified");
  assert.equal(OPS["nosuchop-l11-948"], undefined);
});

test("notice instance-setup:948 (R6): bootstrap's spec is unchanged by F2: public (classes null), not mutating, and it names none of the answer's fields (runner, ai_path_ready, part_signin, memberVersions)", () => {
  const spec = OPS.bootstrap;
  assert.ok(spec, "bootstrap has no spec");
  assert.equal(spec.classes, null);
  assert.equal(spec.mutating, false);
  for (const k of ["runner", "ai_path_ready", "part_signin", "memberVersions", "members"]) assert.equal(k in spec, false, k);
});
