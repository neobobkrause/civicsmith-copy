/* store-request, notice instance-setup:99 (PR 99: instance-setup's lines that moved to instance-reports and instance-updates; retired
   lines, no behaviour change). Confirmed: every name this module's world and recipes import from instance-setup still resolves. */
import "../../sandbox.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import * as setup from "../../../src/setup.mjs";

test("notice instance-setup:99: this module's imports from instance-setup still resolve", () => {
  for (const name of ["bootstrapOp", "instanceSetupOp"]) assert.equal(typeof setup[name], "function", name);
  assert.equal(Array.isArray(setup.INSTANCE_SETUP_OPS) && setup.INSTANCE_SETUP_OPS.length > 0, true, "INSTANCE_SETUP_OPS");
  assert.equal(typeof setup.RELEASE_NOTICE_ADDRESS, "string", "RELEASE_NOTICE_ADDRESS");
});
