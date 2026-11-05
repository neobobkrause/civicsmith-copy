/* op-grades R55 (T53; N1259; BOB C13) and R56 (T53; K5562, K5563): the register ops and the founder's acts, graded from their
   owners' declarations, with the hand rows R55 keeps by hand. The grades are read from the proposal R55 names
   (`build/plan/beta/capabilities/N1259-e-needs-and-points.md` §1) and from this module's own requirement text, never typed
   here; the owners' rows are found by `collectDeclaredOps` and registered into a fresh instance (R49), no owner is imported. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as G from "../../../src/op-grades/index.mjs";
import { collectDeclaredOps, registeredOpGrades, reqText } from "./declared.mjs";

const ROOT = new URL("../../../../", import.meta.url).pathname;
const R = await registeredOpGrades();
const { ops: DECLARED, owners: OWNERS } = await collectDeclaredOps(ROOT);

/* §1's table: `op` | module | what | grade | ... ; the grade's first word is a rung, `ground <g>` or `read` */
const N1259 = readFileSync(join(ROOT, "build/plan/beta/capabilities/N1259-e-needs-and-points.md"), "utf8");
const PROPOSED = Object.fromEntries(N1259.slice(N1259.indexOf("## 1."), N1259.indexOf("## 2.")).split("\n")
  .map((l) => l.match(/^\| `([a-z]+)` \| ([a-z-]+) \| [^|]* \| ([^|]+) \|/)).filter(Boolean)
  .map(([, op, , grade]) => [op, grade.trim().replace(/^ground /, "").replace(/`/g, "").split(/[ ;(]/)[0]]));

const gradeIn = (m, op) => Object.hasOwn(m.RUNGS, op) ? m.RUNGS[op] : Object.hasOwn(m.RUNG_ABSENT, op) ? m.RUNG_ABSENT[op].ground
  : Object.hasOwn(m.NON_ACTS, op) ? "read" : null;
const tablesOf = (m, op) => ["RUNGS", "RUNG_ABSENT"].filter((t) => Object.hasOwn(m[t], op))
  .concat(!Object.hasOwn(m.RUNGS, op) && !Object.hasOwn(m.RUNG_ABSENT, op) && Object.hasOwn(m.NON_ACTS, op) ? ["NON_ACTS"] : []);

const R55_TEXT = reqText(55);

test("R55: with the owners' rows registered, every register op the proposal lists that an owner declares is in exactly one "
   + "table with the proposal's grade; control: the unregistered tables hold none of them", () => {
  const declared = Object.keys(PROPOSED).filter((op) => Object.hasOwn(DECLARED, op));
  assert.ok(Object.keys(PROPOSED).length >= 20 && declared.length >= 20, "the proposal's ops are found");
  for (const op of declared) {
    assert.equal(tablesOf(R, op).length, 1, `${op}: one table`);
    assert.equal(gradeIn(R, op), PROPOSED[op], op);
    /* control: no hand row grades it (R49: the owner's declaration is its grade) */
    assert.equal(Object.hasOwn(G.RUNGS, op) || Object.hasOwn(G.RUNG_ABSENT, op), false, `${op} has no hand grade`);
  }
});

test.todo("R55: MACHINE_REFUSALS gains every register write and registerofficers, each with the code registers' method answers "
   + "(held: affordances R20 and its t33 test hold MACHINE_REFUSALS to ACTS rows only, and these are not ACTS)");

test("R55: rowexpunge's rung is its owner's `reasoned`; every other register op is a phone act; REGISTER_NO_TERMS and "
   + "ROW_EXPUNGE_NO_REASON back their reasoned acts; control: a bad ground's code does not", () => {
  assert.equal(R.RUNGS.rowexpunge, "reasoned");
  for (const op of Object.keys(PROPOSED).filter((op) => OWNERS[op] === "registers" && op !== "rowexpunge"))
    assert.equal(R.phoneOf(op), true, op);
  for (const c of ["REGISTER_NO_TERMS", "ROW_EXPUNGE_NO_REASON"]) {
    assert.ok(R55_TEXT.includes(`\`${c}\``), c);
    assert.ok(R.JUSTIFICATION_REFUSALS.includes(c), c);
    assert.ok(G.JUSTIFICATION_REFUSALS.includes(c), `${c} is held by hand: registers' rows carry no refusal yet`);
  }
  assert.ok(R55_TEXT.includes("`EXPUNGE_GROUND_REFUSED`"));
  assert.equal(R.JUSTIFICATION_REFUSALS.includes("EXPUNGE_GROUND_REFUSED"), false);
});

test.todo("R55: rowexpunge joins IRREVERSIBLE_WEIGHT, phone false (held: affordances' t31 R36 phone test does not see the "
   + "registered op and must change with it, as R55 says)");
test.todo("R55: alertconnect is graded ground `credential` from credentials' row (credentials declares no alertconnect yet)");
test.todo("R55: CONSEQUENCE_STATEMENTS gains rowexpunge, {friction: \"dialog\", key} (the design's words.json holds no consequence.rowexpunge yet)");

test("R56: adminproposalcancel is `credential` and phone false as invitewithdraw; adminremovals a read; adminremove stays "
   + "`reasoned` and adminendorse its grade; each in exactly one table; control: a hand row grades none of them", () => {
  const T = reqText(56);
  for (const op of ["adminproposalcancel", "adminremovals", "adminremove", "adminendorse", "invitewithdraw"]) assert.ok(T.includes(`\`${op}\``), op);
  assert.equal(R.RUNG_ABSENT.adminproposalcancel?.ground, "credential");
  assert.equal(R.phoneOf("adminproposalcancel"), R.phoneOf("invitewithdraw"));
  assert.equal(R.phoneOf("adminproposalcancel"), false);
  assert.equal(gradeIn(R, "adminremovals"), "read");
  assert.match(R.NON_ACTS.adminremovals, /\S/);
  assert.equal(R.RUNGS.adminremove, "reasoned");
  assert.equal(gradeIn(R, "adminendorse"), DECLARED.adminendorse.weight);
  for (const op of ["adminproposalcancel", "adminremovals", "adminremove", "adminendorse"]) assert.equal(tablesOf(R, op).length, 1, op);
  /* R56's ops are member-roster's, graded from its rows */
  for (const op of ["adminproposalcancel", "adminremovals"]) {
    assert.equal(OWNERS[op], "member-roster", op);
    assert.equal(gradeIn(G, op), null, `${op} has no hand row`);
  }
});
