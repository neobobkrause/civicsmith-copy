/* store-door R17 (T51 fix round; K4206; op-declarations R80, op-grades R49): the op this door's map serves and declares in
   DECLARED_OPS is held true against the op as the door runs it (test-support R15): its requires alone raise no refusal
   naming a declared field, a call without each required one is refused naming it, and a field outside accepts is dropped
   or refused naming it. Driven at the record store's door over a real fixture: an administrator, a member, and a group
   key the assistant serves from, so the draft reaches its own handler's refusals. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { D } from "./harness.mjs";
import { declaredOpHolds } from "../../declared-ops.mjs";
const { record } = await import("./record.mjs");
const { credentialsOf } = await import("../../../src/credentials/index.mjs");
const { aiAccountsOf } = await import("../../../src/ai-accounts/index.mjs");
const { membershipOf } = await import("../../../src/membership/index.mjs");

const ANSWERS = [{ question: "Who are you?", text: "Tenants" }];

/* a record with an administrator `ann` and a member `bea`, the assistant on, and the group's key serving */
async function drafting() {
  const r = await record({ sealSecret: "store-door-test-seal-secret-00017" });
  const C = credentialsOf(r.ctx), mb = membershipOf(r.ctx);
  await C.claim({ password: "founder-passphrase-1", tokenFp: "fp-1" });
  for (const [id, role] of [["ann", "admin"], ["bea", "member"]]) {
    const a = await mb.memberAdd({ memberId: id, cover: `cover of ${id}`, role, capabilities: null, by: "admin" });
    assert.equal(a.ok, true, JSON.stringify(a));
    await mb.enroll({ invite: a.invite, handle: id, password: `${id}-passphrase-x` });
  }
  assert.equal(C.aiKeepAwaySet({ on: false, by: "ann" }).ok, true);
  assert.equal((await aiAccountsOf(r.ctx).groupKeySet({ key: "sk-group-key-17", by: "admin" })).ok, true);
  assert.equal(aiAccountsOf(r.ctx).groupKeySwitch({ on: true, by: "admin" }).ok, true);
  assert.equal(aiAccountsOf(r.ctx).groupKeyNoticeSeen({ member: "member:ann", by: "member:ann" }).ok, true);
  return r;
}

/* the call as the door runs it: the op's route in the door's own map, the stamps in the address (`by` as the Worker stamps
   it, the bare member id) and the fields as the body; the route's answer as the door wraps it, unwrapped */
const askedOf = (r) => async (fields) => D.controlPlaneRoutes(r.ctx,
  new URL("http://do/groupdescriptiondraft?by=ann&viewer=ann"), fields).groupdescriptiondraft();

test("R17 (K4206; op-declarations R80): `groupdescriptiondraft` is declared in DECLARED_OPS, its description the localized id `store-door.declared.groupdescriptiondraft`, and the declaration holds against the op as the door runs it — its requires alone raise no refusal naming a field, a call without `answers` is refused naming it, and `assistant` (resolved by the door, never read from the body) and `viewer` are dropped", async () => {
  const r = await drafting();
  await declaredOpHolds({ op: "groupdescriptiondraft", declaration: D.DECLARED_OPS.groupdescriptiondraft, call: askedOf(r),
    values: { answers: ANSWERS }, outside: ["assistant", "viewer"] });
});

test("R17 control (K4206): the declared row reads as a read that writes nothing — `mutating` false, classes admin and member, both stamps read, and a description — so the declaration describes the arm rather than a default", () => {
  const row = D.DECLARED_OPS.groupdescriptiondraft;
  assert.deepEqual(row.classes, ["admin", "member"]);
  assert.deepEqual(row.machineClasses, []);
  assert.equal(row.mutating, false);
  assert.equal(row.weight, "read");
  assert.deepEqual(row.stamps, ["viewer", "by"]);
  assert.deepEqual(row.fields, { accepts: ["answers"], requires: ["answers"] });
  assert.equal(typeof row.description, "string");
  assert.ok(row.description.length > 0);
});

test("R17 control (K4206): the holds check is live — a declaration that requires `viewer` of the body, which the arm never reads, is refused, so the passing test above is not vacuous", async () => {
  const r = await drafting();
  await assert.rejects(declaredOpHolds({ op: "groupdescriptiondraft",
    declaration: { ...D.DECLARED_OPS.groupdescriptiondraft, fields: { accepts: ["answers", "viewer"], requires: ["answers", "viewer"] } },
    call: askedOf(r), values: { answers: ANSWERS }, outside: [] }), /"viewer"/);
});

/* R17 (K4247; op-grades R49): the row is a read, so op-grades takes it into its tables with no refusal; a rung on the same
   row (a read cannot carry one, op-grades R49 `rung-on-read`) is refused naming the op. Each registration is a fresh op-grades
   instance, so one test's registration never reaches the other. */
let grades = 0;
const freshGrades = () => import(`../../../src/op-grades/index.mjs?instance=store-door-r17-${grades++}`);

test("R17 (K4247; op-grades R49): `groupdescriptiondraft`, declared as a read, registers through op-grades without refusal — it enters NON_ACTS with its declared description, and no rung or absence is added for it", async () => {
  const G = await freshGrades();
  const answer = G.registerDeclaredOps({ "store-door": D.DECLARED_OPS });
  /* op-grades holds a hand NON_ACTS row for the op whose sentence is this module's word (its R51), so the owner's row is
     either taken in or found in agreement with it; a disagreement or a bad weight throws (the control below) */
  assert.deepEqual([...answer.registered, ...answer.agreed], ["groupdescriptiondraft"]);
  assert.equal(G.NON_ACTS.groupdescriptiondraft, D.DECLARED_OPS.groupdescriptiondraft.description);
  assert.equal(Object.hasOwn(G.RUNGS, "groupdescriptiondraft"), false, "a read is no rung");
});

test("R17 control (K4247): the same row declared with a rung is refused by op-grades, naming the op and `rung-on-read`, so the registration above is not vacuous", async () => {
  const G = await freshGrades();
  const reasoned = { ...D.DECLARED_OPS.groupdescriptiondraft, weight: "reasoned" };
  assert.throws(() => G.registerDeclaredOps({ "store-door": { groupdescriptiondraft: reasoned } }),
    (e) => e.code === "DECLARED_OP_BAD_WEIGHT" && e.message.includes("groupdescriptiondraft") && e.message.includes("rung-on-read"));
});
