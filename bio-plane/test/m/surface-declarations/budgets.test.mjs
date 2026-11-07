/* surface-declarations R12 (T53; K4354, K5438, K5448 (7); PL2–PL4): every op and every screen declares a budget class of
   `runtime-limits`' time table; a missing class is a finding, an unknown one is refused, an override goes downward only.
   R16, R18 (K5571 (3)): the classes the beta's ops take where a requirement states one. The classes and their ceilings are
   read from `runtime-limits`' own `budgetOf`, never copied. */
import "../op-declarations/register-owners.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { opBudgets, moveBudgets, statedBudget, budgetRow, budgetFindings, screenBudget, declareScreenReads }
  from "../../../src/op-declarations/compose.mjs";
import { budgetOf } from "../../../src/read-bounds.mjs";
import { SCREEN_REGISTRY } from "../../../src/wizard-scripts/screen-registry.mjs";

const OP_BUDGETS = opBudgets();
const MOVE_BUDGETS = moveBudgets();

test("R12: a name with no class is reported, an unknown class is refused, an override above the class refused and below accepted", () => {
  assert.deepEqual([...budgetFindings(["heldat", "bundlehistory"], { heldat: "read_act" })], ["bundlehistory"]);
  assert.throws(() => budgetRow("heldat", "nosuchclass"), /heldat: BAD_BUDGET_CLASS/);
  assert.throws(() => budgetFindings(["heldat"], { heldat: "ai" }), /BAD_BUDGET_CLASS/);
  const ceiling = budgetOf("read_act").ceiling_ms;
  assert.throws(() => budgetRow("heldat", { class: "read_act", ceiling_ms: ceiling + 1 }), /heldat: BUDGET_ABOVE_CLASS/);
  assert.deepEqual({ ...budgetRow("heldat", { class: "read_act", ceiling_ms: ceiling - 1 }) },
    { budget_class: "read_act", ceiling_ms: ceiling - 1 });
  /* the default for an entry not stated is its class's ceiling */
  assert.equal(budgetRow("heldat", "read_act").ceiling_ms, ceiling);
  assert.throws(() => screenBudget("home", { class: "screen_load", ceiling_ms: budgetOf("screen_load").ceiling_ms + 1 }), /BUDGET_ABOVE_CLASS/);
});

test("R12 control: every op in OPS and every screen of the registry carries a class runtime-limits holds", () => {
  const ops = Object.keys(OPS);
  assert.deepEqual([...budgetFindings(ops, OP_BUDGETS)], []);
  for (const op of ops) assert.equal(budgetOf(OP_BUDGETS[op].budget_class).ceiling_ms >= OP_BUDGETS[op].ceiling_ms, true, op);
  for (const s of SCREEN_REGISTRY) assert.equal(screenBudget(s.id).budget_class, "screen_load", s.id);
  /* a write takes the write act's class, a read the read act's, where no row names one */
  assert.equal(OP_BUDGETS.promote.budget_class, OPS.promote.mutating ? "write_act" : "read_act");
  assert.equal(OP_BUDGETS.heldat.budget_class, "read_act");
  assert.ok(Object.isFrozen(OP_BUDGETS) && Object.isFrozen(OP_BUDGETS.heldat));
});

test("R16: followfrom takes the follow class, the explore reads the explore class, interpretation reads the read act's, partsOf a screen's load share", () => {
  assert.deepEqual({ ...budgetRow("followfrom", "follow") }, { budget_class: "follow", ceiling_ms: budgetOf("follow").ceiling_ms });
  for (const op of Object.keys(OPS).filter((o) => /^explore/.test(o) && !OPS[o].mutating))
    assert.equal(OP_BUDGETS[op].budget_class, "explore", op);
  /* the ops no owner serves yet keep their stated class for the op their owner will declare */
  for (const [op, cls] of [["followfrom", "follow"], ["proposeParts", "explore"], ["interpretationOf", "read_act"],
    ["interpretedFor", "read_act"], ["limitsByKind", "read_act"], ["partsOf", "screen_load"]])
    assert.equal((OP_BUDGETS[op] ?? budgetRowOf(op)).budget_class, cls, op);
});

test("R16: proposeParts is never a first-wave read of any screen", () => {
  const withProposeParts = Object.hasOwn(OPS, "proposeParts");
  if (withProposeParts) assert.throws(() => declareScreenReads("s", [{ name: "p", op: "proposeParts", wave: 1 }]), /NOT_FIRST_WAVE/);
  else assert.throws(() => declareScreenReads("s", [{ name: "p", op: "proposeParts", wave: 1 }]), /UNKNOWN_OP|NOT_FIRST_WAVE/);
  assert.equal(budgetRowOf("proposeParts").budget_class, "explore");
});

test("R16 control: an op with no class stated declares its own kind's", () => {
  assert.equal(OP_BUDGETS.bundlehistory.budget_class, "read_act");
});

test("R18: the ops that wait on the assistant's model declare ai_act, the capability test gate_run; an override goes downward only", () => {
  for (const op of ["ask", "writinghelp", "groupdescriptiondraft", "translationdraft", "textcheck", "infractiondraft", "bearingdraft"]) {
    assert.ok(Object.hasOwn(OPS, op), op);
    assert.equal(OP_BUDGETS[op].budget_class, "ai_act", op);
  }
  for (const [op, cls] of [["airunstart", "ai_act"], ["aiconnecttest", "ai_act"], ["aitestrun", "gate_run"]])
    assert.equal((OP_BUDGETS[op] ?? budgetRowOf(op)).budget_class, cls, op);
  const ceiling = budgetOf("ai_act").ceiling_ms;
  assert.throws(() => budgetRow("ask", { class: "ai_act", ceiling_ms: ceiling + 1 }), /BUDGET_ABOVE_CLASS/);
  assert.equal(budgetRow("ask", { class: "ai_act", ceiling_ms: ceiling - 1 }).ceiling_ms, ceiling - 1);
});

test("R18 control: the assistant's read ops declare neither class; no op declares a class ai", () => {
  for (const op of ["airesultsread", "airesultown", "aihealthpreview", "aiusebymember", "airunparts", "assistantreadiness", "aipathready"]) {
    const row = OP_BUDGETS[op] ?? budgetRowOf(op);
    assert.ok(!["ai_act", "gate_run"].includes(row.budget_class), op);
  }
  for (const [op, row] of Object.entries(OP_BUDGETS)) assert.notEqual(row.budget_class, "ai", op);
  /* R15's screen moves carry the in-app move class and have no spec */
  for (const [m, row] of Object.entries(MOVE_BUDGETS)) { assert.equal(row.budget_class, "screen_move"); assert.equal(Object.hasOwn(OPS, m), false, m); }
});

/* a stated row for an op no owner serves yet, read through the same check the built table uses */
function budgetRowOf(op) { const row = statedBudget(op); assert.ok(row, `${op} has no stated class`); return row; }

test("T53 still owed: R13 (screens' first waves), R14, R15, R17, R9", { todo: "R9, R13, R14, R15, R17: see docs/requirements-notes/surface-declarations.md" });
