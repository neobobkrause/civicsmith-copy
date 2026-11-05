/* op-declarations F2 (T53; op-grades R57, BOB's START 5 Nov): the alpha's AI ops are in none of this module's hand tables,
   with no alias. Read before any owner's rows are registered (this file imports no `register-owners.mjs`), so what is
   asserted is this module's own tables, never an op another owner still declares in its `DECLARED_OPS`. Control:
   `setpassword` keeps its spec and credentials' family, `memberadd` its REAUTH_ACTS row. */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as O from "../../../src/op-declarations/index.mjs";
import { REAUTH_ACTS } from "../../../src/op-declarations/t47.mjs";

const { OPS, NEEDS, OP_STAMPS, SESSION_OPS, OP_FAMILIES, OP_ALIASES } = O;

/* op-grades R57's list, as its line names them */
const ALPHA = ["groupkeyset", "groupkeyremove", "groupkeyswitch", "groupkeynoticeseen", "accountreferenceset",
  "accountreferenceremove", "subscriptiondisconnect", "projectkeyset", "projectsigninset", "projectaccountremove",
  "projectaccountswitch", "projectkeynoticeseen", "subscriptionsignin", "groupkeystate", "accountreference"];

const tablesOf = (op) => {
  const at = [];
  if (Object.hasOwn(OPS, op)) at.push("OPS");
  if (Object.hasOwn(NEEDS, op)) at.push("NEEDS");
  if (Object.hasOwn(OP_STAMPS, op)) at.push("OP_STAMPS");
  if (SESSION_OPS.member.has(op)) at.push("SESSION_OPS.member");
  if (SESSION_OPS.admin.has(op)) at.push("SESSION_OPS.admin");
  if (Object.hasOwn(REAUTH_ACTS, op)) at.push("REAUTH_ACTS");
  for (const [name, f] of Object.entries(OP_FAMILIES)) if (Object.hasOwn(f.kinds, op)) at.push(`OP_FAMILIES.${name}`);
  if (Object.hasOwn(OP_ALIASES, op) || Object.values(OP_ALIASES).includes(op)) at.push("OP_ALIASES");
  for (const [name, v] of Object.entries(O)) if (Array.isArray(v) && v.includes(op)) at.push(name);
  return at;
};

test("F2: op-grades R57's alpha AI ops, subscriptionsignin among them, are in none of this module's hand tables and no alias names them (control: setpassword and memberadd keep theirs)", () => {
  for (const op of ALPHA) assert.deepEqual(tablesOf(op), [], `${op} is still in this module's tables`);
  assert.ok(Object.hasOwn(OPS, "setpassword") && OP_FAMILIES.credentials.kinds.setpassword === "own");
  assert.ok(SESSION_OPS.member.has("setpassword"));
  assert.deepEqual(JSON.parse(JSON.stringify(REAUTH_ACTS.memberadd)), { field: "role", values: ["admin"] });
});
