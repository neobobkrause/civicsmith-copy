/* ai-accounts F5 (coordinator ruling 5 Nov 04:19): the AI ops this module declares carry the grades `op-grades` R57 states,
   so op-grades' hand rows agree with the owner's row; registered with op-grades, the tables hold those grades. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DECLARED_OPS } from "../../../src/ai-accounts/index.mjs";
import { registerDeclaredOps, RUNGS, RUNG_ABSENT } from "../../../src/op-grades/index.mjs";

/* this module's own ops, by the grade op-grades R57 names for each */
const GRADES = {
  reversible: ["aiorderset", "aiaccountswitch", "aimemberallow", "aiprojectuse", "aiprojectorder", "aimineuse", "aitermsaccept",
    "aipersonalchoose", "aioptinset", "aitermswithdraw", "aiaccountadd", "aiownadd", "aicreditsclear", "aisend"],
  reasoned: ["aicheckset", "aiprojectcheckset", "aimycheckset"],
  terminal: ["aiaccountremove"],
};
const GROUNDS = { credential: ["aikeyenter", "aikeyseal", "aikeycloudflare"] };

test("F5: each AI op's declared weight is the grade op-grades R57 states", () => {
  for (const [w, ops] of Object.entries({ ...GRADES, ...GROUNDS })) {
    for (const op of ops) assert.equal(DECLARED_OPS[op]?.weight, w, op);
  }
});

test("F5: registered with op-grades, the rungs and grounds read as R57 states; control: the keep-away ops keep theirs", () => {
  registerDeclaredOps({ "ai-accounts": DECLARED_OPS });
  for (const [w, ops] of Object.entries(GRADES)) for (const op of ops) assert.equal(RUNGS[op], w, op);
  for (const [g, ops] of Object.entries(GROUNDS)) for (const op of ops) assert.equal(RUNG_ABSENT[op]?.ground, g, op);
  assert.equal(RUNGS.aikeepaway, "reasoned");
  assert.equal(RUNG_ABSENT.accountusesset?.ground ?? RUNGS.accountusesset, "substrate");
});
