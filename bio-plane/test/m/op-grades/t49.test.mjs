/* op-grades: T49's grades (R43), at the module's exports. The two ops T49's owners add, graded by R5 and R3 with the
   grade read from each owner's requirement, each named here with a negative control (K874). R43 also reads green through
   older tests that name the same strings; these name it. The totality over the control plane's table runs in
   `affordances` (its R12) at its merge. */
import test from "node:test";
import assert from "node:assert/strict";
import { RUNGS, RUNG_ABSENT, NON_ACTS, MACHINE_REFUSALS, CONSEQUENCE_STATEMENTS, IRREVERSIBLE_WEIGHT, LARGER_SCREEN_ACTS,
         OP_ALIASES, phoneOf, MARKS } from "../../../src/op-grades/index.mjs";
import * as T49 from "../../../src/op-grades/t49.mjs";
import { declaredSentence } from "./declared.mjs";

const ground = (g) => Object.entries(RUNG_ABSENT).filter(([, v]) => v.ground === g).map(([k]) => k);

test("R43: founderhandleset is stated absent on the `caller-owned` ground, as handlechange and setpassword, and holds no rung", () => {
  assert.equal(RUNG_ABSENT.founderhandleset.ground, "caller-owned");
  assert.equal(RUNG_ABSENT.founderhandleset.ground, RUNG_ABSENT.handlechange.ground, "as handlechange (R29, R34)");
  assert.equal(RUNG_ABSENT.founderhandleset.ground, RUNG_ABSENT.setpassword.ground, "as setpassword (R27)");
  assert.ok(RUNG_ABSENT.founderhandleset.is.length > 40);
  assert.match(RUNG_ABSENT.founderhandleset.is, /HANDLE_FIXED/);
  assert.match(RUNG_ABSENT.founderhandleset.is, /membership R144, R129/);
  /* controls: not the plan's `reversible` (K3333), and by R3 neither `reversible` nor `reasoned`; not in the other table of grades */
  assert.ok(!Object.hasOwn(RUNGS, "founderhandleset"));
  assert.notEqual(RUNG_ABSENT.founderhandleset.ground, "undetermined");
  assert.notEqual(RUNG_ABSENT.founderhandleset.ground, "credential");
});

test("R43: founderhandleset's NON_ACTS sentence is the member-directed one R43 gives, naming HANDLE_FIXED and no record or bundle", () => {
  assert.equal(NON_ACTS.founderhandleset, declaredSentence("member-roster", "founderhandleset"));
  assert.equal(T49.T49_NON_ACTS.founderhandleset, NON_ACTS.founderhandleset);
  /* control: it is not handlechange's sentence, and it does not say a handle can be changed or shown as formerly */
  assert.notEqual(NON_ACTS.founderhandleset, NON_ACTS.handlechange);
  assert.doesNotMatch(NON_ACTS.founderhandleset, /formerly|changeable/);
});

test("R43 R18: founderhandleset carries phone true (a caller-owned absence); and it is no machine refusal, weight, consequence "
   + "statement, larger-screen act or alias", () => {
  assert.equal(phoneOf("founderhandleset"), true);
  assert.ok(!Object.hasOwn(MACHINE_REFUSALS, "founderhandleset"), "membership refuses a machine by FOUNDER_HANDLE_NOT_FOUNDER");
  assert.ok(!IRREVERSIBLE_WEIGHT.includes("founderhandleset"));
  assert.ok(!Object.hasOwn(CONSEQUENCE_STATEMENTS, "founderhandleset"));
  assert.ok(!LARGER_SCREEN_ACTS.includes("founderhandleset"));
  assert.ok(!Object.hasOwn(OP_ALIASES, "founderhandleset") && !Object.values(OP_ALIASES).includes("founderhandleset"));
  /* control: a credential-ground act answers false, so true is the ground's doing */
  assert.equal(phoneOf("signeradd"), false);
});

test("R43: projectownervotes is a read: its NON_ACTS sentence is R43's, and it has no rung, no absence and no machine refusal", () => {
  assert.equal(NON_ACTS.projectownervotes, "read: the owner changes of a project still waiting on agreement, who has agreed "
    + "and who is awaited, answered only to a viewer who sees the project whole");
  assert.equal(T49.T49_NON_ACTS.projectownervotes, NON_ACTS.projectownervotes);
  assert.ok(NON_ACTS.projectownervotes.startsWith("read: "));
  assert.ok(!Object.hasOwn(RUNGS, "projectownervotes"));
  assert.ok(!Object.hasOwn(RUNG_ABSENT, "projectownervotes"), "a read writes nothing, so it takes no ground");
  assert.ok(!Object.hasOwn(MACHINE_REFUSALS, "projectownervotes"));
  assert.ok(!Object.hasOwn(CONSEQUENCE_STATEMENTS, "projectownervotes"));
  assert.equal(phoneOf("projectownervotes"), true);
  /* control: a write of the same family is not a read */
  assert.ok(!NON_ACTS.projectowneradd?.startsWith("read: "));
});

test("R43 R3 (START measure): the `undetermined` tally is 109 after T50 (R45 adds actioninquiry, R47 takes planopen and "
   + "wizarddraft out) and T49 left it unchanged; the `caller-owned` set is 33 (37 less securitymap, a read since K4210, "
   + "groupdescriptiondraft, a read since K4247, and groupkeynoticeseen and projectkeynoticeseen, retired in T53, R57), founderhandleset its newest; T49's tables hold exactly these two ops", () => {
  assert.equal(ground("undetermined").length, 109);
  assert.ok(!ground("undetermined").includes("founderhandleset"));
  const caller = ground("caller-owned");
  assert.equal(caller.length, 33);
  assert.ok(caller.includes("founderhandleset") && caller.includes("handlechange") && caller.includes("setpassword"));
  assert.deepEqual(Object.keys(T49.T49_RUNG_ABSENT), ["founderhandleset"]);
  assert.deepEqual(Object.keys(T49.T49_NON_ACTS).sort(), ["founderhandleset", "projectownervotes"]);
  /* control: the set without it is 32, the count the module held before T49 less securitymap and groupdescriptiondraft,
     and less the two notice acts R57 retired */
  assert.equal(caller.filter((op) => op !== "founderhandleset").length, 32);
});

test("R43 R42: founderhandleset, a rungless act the registry lists as owed, is marked Reasoned by the kit's owed_ weight; "
   + "the mark moves no grade", () => {
  assert.equal(MARKS.founderhandleset, "Reasoned");
  assert.ok(!Object.hasOwn(RUNGS, "founderhandleset"));
  /* control: projectownervotes is no act on a screen, so it takes no mark */
  assert.ok(!Object.hasOwn(MARKS, "projectownervotes"));
});
