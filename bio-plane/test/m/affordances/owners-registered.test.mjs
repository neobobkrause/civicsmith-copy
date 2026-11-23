/* affordances, R12 (K5159): the totality over the owners' op maps holds only if every owner's declared op reaches op-grades, so
   the registration `register-owners.mjs` makes is checked here against every module whose source exports a `DECLARED_OPS`,
   found by test-support's bounded collector (`declaredOpsOf`, R16) over the modules up to store-assembly, not against a list. */
import "./register-owners.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { declaredOpsOf } from "../../declared-ops.mjs";
import { REGISTERED } from "./register-owners.mjs";

const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

test("R12: every module that exports a DECLARED_OPS is registered, each with every op it declares and the row as the owner wrote it, so no declared op of any owner goes unseen (K5159)", async () => {
  const { ops, owners: ownerOf } = await declaredOpsOf(ROOT, "store-assembly");
  /** @type {Object<string, Object>} builds each owner's declared rows */
  const owners = {};
  for (const [op, row] of Object.entries(ops)) (owners[ownerOf[op]] ??= {})[op] = row;
  assert.ok(Object.keys(owners).length > 0, "no owner found");
  assert.deepEqual(Object.keys(REGISTERED).sort(), Object.keys(owners).sort(), "an owner that declares ops is not registered");
  for (const [owner, declared] of Object.entries(owners)) {
    assert.deepEqual(Object.keys(REGISTERED[owner]).sort(), Object.keys(declared).sort(), `${owner}: a declared op is not registered`);
    for (const [op, row] of Object.entries(declared)) assert.equal(REGISTERED[owner][op], row, `${op} (${owner}) is not registered with its owner's row`);
  }
});
