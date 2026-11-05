/* op-declarations, notice affordances:374 (PR 374). affordances exports `T53_STANDIN_OPS`, the member ops their owner
   declares whose design text is not yet given, held in `ACT_HELP` by the owner's own description (affordances F2).
   Confirmed with no code change here: each such op has a spec in this module's tables (through its owner's
   DECLARED_OPS, R80), and, explained now, it is named under no ground of `ACT_HELP_ABSENT` (R34: explained or named,
   never both). The ops are read from affordances' export, never a hand list (K3268). */
import "./register-owners.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { OPS, SESSION_OPS, ACT_HELP_ABSENT } from "../../../src/op-declarations/index.mjs";
import { T53_STANDIN_OPS } from "../../../src/affordances/act-help.mjs";
import { explained } from "./help.mjs";

const grounds = (op) => Object.entries(ACT_HELP_ABSENT).filter(([, g]) => g.ops.includes(op)).map(([k]) => k);

test("notice affordances:374 (R34, R80): each of affordances' T53 stand-in ops is a declared member op, explained, and named under no ground (negative control: an undeclared name has no spec)", () => {
  assert.ok(Array.isArray(T53_STANDIN_OPS));
  for (const op of T53_STANDIN_OPS) {
    assert.ok(Object.hasOwn(OPS, op), `${op}: no spec`);
    assert.ok(SESSION_OPS.member.has(op), `${op}: not a member op`);
    assert.ok(explained(op), `${op}: no ACT_HELP text`);
    assert.deepEqual(grounds(op), [], `${op}: explained and named under a ground`);
  }
  assert.equal(Object.hasOwn(OPS, "guideoptoutx"), false);
});
