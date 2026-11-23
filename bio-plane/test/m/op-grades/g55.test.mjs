/* op-grades, fix round 6 (T51; G55, K4562): `moneyingestread`, the read that pages a money ingest's stored lists and answers its
   state (`calculations` R14). It writes nothing, so it takes no rung and no ground: a hand row in `NON_ACTS` beside `moneyingest`'s,
   the reason its owner declares, keyed `calculations.declared.moneyingestread` (K4168: a read its owner words without the "read: "
   lead holds the owner's sentence). `calculations` comes after this module, so a scripted double of its declared row (a read,
   its description the owner's key) is registered and must agree (R49, R50). */
import test from "node:test";
import assert from "node:assert/strict";
import { RUNGS, RUNG_ABSENT, NON_ACTS, JUSTIFICATION_REFUSALS, MACHINE_REFUSALS, IRREVERSIBLE_WEIGHT, CONSEQUENCE_STATEMENTS, phoneOf } from "../../../src/op-grades/index.mjs";
import { registeredWith, ownerRow, declaredSentence } from "./declared.mjs";

/* the owner's row, scripted from `calculations` R14: a read, described by its key */
const OWNER = { calculations: { moneyingestread: ownerRow("read", "calculations.declared.moneyingestread") } };
const registered = () => registeredWith(OWNER);

test("R13 R53 G55 (calculations R14) moneyingestread is a read: its owner declares it `read`, not mutating, its NON_ACTS reason the owner's sentence; no rung, no ground, not a machine refusal, no consequence statement, phone true; control: moneyingest keeps its rung, reason and backing", async () => {
  assert.equal(typeof NON_ACTS.moneyingestread, "string");
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
