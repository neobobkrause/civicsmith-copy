/* op-grades: T42's grade (R31, `pagetranscribe`) and T42's re-points (R1's `inboxresolve` to `doorbell` R13, R3; R30's
   `accountpropose` to `case-account` R1, R2), at the module's exports. `op-declarations` merges after this module in
   layer 11, so the totality is held here over a stand-in of the row it declares (op-declarations R47), by `affordances`
   R12's rule; the real totality runs again at its merge. */
import test from "node:test";
import assert from "node:assert/strict";
import { RUNGS, RUNG_ABSENT, NON_ACTS, MACHINE_REFUSALS, JUSTIFICATION_REFUSALS, CONSEQUENCE_STATEMENTS, IRREVERSIBLE_WEIGHT,
         LARGER_SCREEN_ACTS, OP_ALIASES, phoneOf } from "../../../src/op-grades/index.mjs";
import * as T42 from "../../../src/op-grades/t42.mjs";
import { declaredSentence } from "./declared.mjs";

const gradeOf = (op) => Object.hasOwn(RUNGS, op) ? RUNGS[op] : Object.hasOwn(RUNG_ABSENT, op) ? RUNG_ABSENT[op].ground : null;

const R31_REASON = declaredSentence("extraction", "pagetranscribe");

/* ---- R31 ----------------------------------------------------------------------------------------------------------- */
test("R31: pagetranscribe stated absent, ground `undetermined` as captureupload, with no rung; its NON_ACTS sentence "
   + "exactly, reading-directed and no capture act", () => {
  assert.equal(gradeOf("pagetranscribe"), "undetermined");
  assert.ok(!Object.hasOwn(RUNGS, "pagetranscribe"), "no rung beside the absence");
  assert.equal(gradeOf("pagetranscribe"), gradeOf("captureupload"), "as captureupload (R30)");
  assert.ok(RUNG_ABSENT.pagetranscribe.is.length > 40);
  assert.equal(NON_ACTS.pagetranscribe, R31_REASON);
  assert.ok(!NON_ACTS.pagetranscribe.startsWith("capture-directed:"), "R5 keeps that prefix for CAPTURE_ACTS");
  assert.ok(!NON_ACTS.pagetranscribe.startsWith("read: "), "a write, no read");
  /* `transcribe` (content R23's typing) keeps its own rung and sentence (K2613) */
  assert.equal(RUNGS.transcribe, "reasoned");
  assert.notEqual(NON_ACTS.transcribe, NON_ACTS.pagetranscribe);
  /* negative controls: another ground, or the typing's grade, would be seen */
  assert.notEqual(gradeOf("pagetranscribe"), gradeOf("transcribe"));
  assert.notDeepEqual({ ...RUNG_ABSENT.pagetranscribe, ground: "observational" }, RUNG_ABSENT.pagetranscribe);
  assert.notEqual(R31_REASON.replace("reading-directed", "capture-directed"), NON_ACTS.pagetranscribe);
});

test("R31 R5 R18: pagetranscribe is not in MACHINE_REFUSALS and answers phone true; no statement, weight, larger-screen "
   + "entry or alias is added", () => {
  assert.ok(!Object.hasOwn(MACHINE_REFUSALS, "pagetranscribe"));
  assert.equal(phoneOf("pagetranscribe"), true);
  assert.ok(!Object.hasOwn(CONSEQUENCE_STATEMENTS, "pagetranscribe"));
  assert.ok(!IRREVERSIBLE_WEIGHT.includes("pagetranscribe"));
  assert.ok(!LARGER_SCREEN_ACTS.includes("pagetranscribe"));
  assert.ok(!Object.hasOwn(OP_ALIASES, "pagetranscribe") && !Object.values(OP_ALIASES).includes("pagetranscribe"));
  /* negative control: a credential ground on the same table would answer false */
  assert.equal(phoneOf("keyedserviceset"), false);
});

test("R31: T42's tables hold exactly pagetranscribe, and the module's tables carry those very entries", () => {
  assert.deepEqual(Object.keys(T42).sort(), ["T42_NON_ACTS", "T42_RUNG_ABSENT"]);
  assert.deepEqual(Object.keys(T42.T42_RUNG_ABSENT), ["pagetranscribe"]);
  assert.deepEqual(Object.keys(T42.T42_NON_ACTS), ["pagetranscribe"]);
  assert.equal(RUNG_ABSENT.pagetranscribe, T42.T42_RUNG_ABSENT.pagetranscribe);
  assert.equal(NON_ACTS.pagetranscribe, T42.T42_NON_ACTS.pagetranscribe);
  assert.deepEqual(Object.keys(RUNGS).filter((op) => Object.hasOwn(RUNG_ABSENT, op)), []);
});

/* `unaccounted`'s two totalities over a stand-in of op-declarations R47's row (`affordances` R12; t41.test.mjs' shape):
   `pagetranscribe` mutating and gated by its NEEDS row. */
const unaccountedOver = (rows) => {
  const mutating = new Set(rows.filter((r) => r.mutating).map((r) => r.op));
  const gated = new Set(rows.filter((r) => r.gated).map((r) => r.op));
  return {
    unpublished: [...gated].filter((op) => !Object.hasOwn(NON_ACTS, op)).sort(),
    unranked: [...mutating].filter((op) => !Object.hasOwn(RUNGS, op) && !Object.hasOwn(RUNG_ABSENT, op)).sort(),
    stale: rows.map((r) => r.op).filter((op) => !mutating.has(op) && (Object.hasOwn(RUNGS, op)
      || Object.hasOwn(RUNG_ABSENT, op)) || !gated.has(op) && Object.hasOwn(NON_ACTS, op)).sort(),
  };
};
test("R31: affordances R12's totality holds over a stand-in of op-declarations R47's row — not unpublished, unranked or "
   + "stale", () => {
  const STAND_IN = [{ op: "pagetranscribe", mutating: true, gated: true }];
  assert.deepEqual(unaccountedOver(STAND_IN), { unpublished: [], unranked: [], stale: [] });
  /* negative controls: declared as a read it is stale; an ungraded neighbour is unranked */
  assert.deepEqual(unaccountedOver([{ op: "pagetranscribe", mutating: false, gated: true }]).stale, ["pagetranscribe"]);
  assert.deepEqual(unaccountedOver([...STAND_IN, { op: "pagetranscribenew", mutating: true, gated: true }]).unranked,
    ["pagetranscribenew"]);
});

/* ---- R1, R30: T42's re-points (wording only; N826, N839; K2656) ----------------------------------------------------- */
test("R1 R35 (N826): inboxresolve stays `reasoned`, backed by RESOLVE_NO_REASON, its sentence citing doorbell R3 and R13 "
   + "and no retired capture id; inboxpull, `reversible` since R35, its sentence citing op=inboxpull's door", () => {
  assert.equal(RUNGS.inboxresolve, "reasoned");
  assert.ok(JUSTIFICATION_REFUSALS.includes("RESOLVE_NO_REASON"));
  assert.match(NON_ACTS.inboxresolve, /\(doorbell R3, RESOLVE_NO_REASON\)/);
  assert.match(NON_ACTS.inboxresolve, /\(doorbell R3, R13\)$/);
  assert.equal(gradeOf("inboxpull"), "reversible");
  assert.ok(!Object.hasOwn(RUNG_ABSENT, "inboxpull"));
  /* negative control: neither names capture's retired R32 or R65 */
  for (const s of [NON_ACTS.inboxresolve, NON_ACTS.inboxpull]) assert.doesNotMatch(s, /capture R(32|65)/);
});

test("R30 (N839): accountpropose stays `undetermined`, its statement naming case-account R1, R2 and never case-authoring",
  () => {
  assert.equal(gradeOf("accountpropose"), "undetermined");
  assert.match(RUNG_ABSENT.accountpropose.is, /\(case-account R1, R2\)$/);
  /* negative control */
  assert.doesNotMatch(RUNG_ABSENT.accountpropose.is, /case-authoring/);
});
