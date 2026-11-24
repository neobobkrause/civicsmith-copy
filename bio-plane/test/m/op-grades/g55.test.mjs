/* op-grades, fix round 6 (T51; G55, K4562): `moneyingestread`, the read that pages a money ingest's stored lists and answers its
   state (`calculations` R14). It writes nothing, so it takes no rung and no ground: a hand row in `NON_ACTS` beside `moneyingest`'s,
   the reason its owner declares, keyed `calculations.declared.moneyingestread` (K4168: a read its owner words without the "read: "
   lead holds the owner's sentence). Until `calculations` merges its declaration, a scripted double of its declared row stands in
   (word for word); once it has, the owner's own row is read and must agree (R49, R50). */
import test from "node:test";
import assert from "node:assert/strict";
import { RUNGS, RUNG_ABSENT, NON_ACTS, JUSTIFICATION_REFUSALS, MACHINE_REFUSALS, IRREVERSIBLE_WEIGHT, CONSEQUENCE_STATEMENTS, phoneOf } from "../../../src/op-grades/index.mjs";
import { collectDeclaredOps, declaredSentence } from "./declared.mjs";

const here = new URL("../../../../", import.meta.url).pathname;
const owners = await collectDeclaredOps(here);
async function registered() {
  const m = await import(`../../../src/op-grades/index.mjs?g55=${Math.random()}`);
  const byOwner = {};
  for (const [op, row] of Object.entries(owners.ops)) (byOwner[owners.owners[op]] ??= {})[op] = row;
  if (!("moneyingestread" in owners.ops)) {
    (byOwner.calculations ??= {}).moneyingestread = { classes: ["admin", "member"], mutating: false, weight: "read", description: NON_ACTS.moneyingestread };
  }
  m.registerDeclaredOps(byOwner);
  return m;
}

test("R13 R53 G55 (calculations R14) moneyingestread is a read: its owner declares it `read`, not mutating, its NON_ACTS reason the owner's sentence; no rung, no ground, not a machine refusal, no consequence statement, phone true; control: moneyingest keeps its rung, reason and backing", async () => {
  assert.equal(typeof NON_ACTS.moneyingestread, "string");
  assert.equal(owners.ops.moneyingestread?.weight, "read");
  assert.equal(owners.ops.moneyingestread.mutating, false);
  assert.equal(NON_ACTS.moneyingestread, declaredSentence("calculations", "moneyingestread"));
  assert.equal(RUNGS.moneyingestread, undefined);
  assert.equal(RUNG_ABSENT.moneyingestread, undefined);
  assert.equal(MACHINE_REFUSALS.moneyingestread, undefined);
  assert.equal(CONSEQUENCE_STATEMENTS.moneyingestread, undefined);
  assert.equal(IRREVERSIBLE_WEIGHT.includes("moneyingestread"), false);
  assert.equal(phoneOf("moneyingestread"), true);
  /* control: the act beside it is unchanged */
  assert.equal(RUNGS.moneyingest, "reasoned");
  assert.ok(NON_ACTS.moneyingest.startsWith("binding-directed: "));
  assert.ok(JUSTIFICATION_REFUSALS.includes("NO_REASON"));
  /* the owner's row agrees with the hand row (a disagreement refuses the registration) */
  const m = await registered();
  assert.equal(m.NON_ACTS.moneyingestread, NON_ACTS.moneyingestread);
  assert.equal(m.RUNGS.moneyingestread, undefined);
  assert.equal(m.RUNG_ABSENT.moneyingestread, undefined);
  assert.equal(m.RUNGS.moneyingest, "reasoned");
});
