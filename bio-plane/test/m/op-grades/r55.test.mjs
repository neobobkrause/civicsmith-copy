/* op-grades R55 (T53; N1259; BOB C13) and R56 (T53; K5562, K5563): the register ops and the founder's acts, graded from their
   owners' declarations, with the hand rows R55 keeps by hand. The grades are read from the proposal R55 names
   (`build/plan/beta/capabilities/N1259-e-needs-and-points.md` §1) and from this module's own requirement text, never typed
   here; the owners' rows are found by `collectDeclaredOps` and registered into a fresh instance (R49), no owner is imported. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as G from "../../../src/op-grades/index.mjs";
import { collectDeclaredOps, registeredOpGrades, reqText, between, tickedAll, tickedCodes } from "./declared.mjs";
import { hasWord, word } from "../../../src/setup-words/index.mjs";

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

/* R55's machine sentence: "`MACHINE_REFUSALS` gains every register WRITE op (BOB C13): `a` and `b` (`CODE`), `c` (`CODE`, new),
   ...; the reads (`x`, `y`, ...) stay open": each code in backticks follows the ops it refuses */
const MACHINE_TEXT = between(R55_TEXT, "`MACHINE_REFUSALS` gains every register WRITE op", "; the reads");
const R55_MACHINE = {};
for (const part of MACHINE_TEXT.split(/\)[,;]?/)) {
  const [code] = tickedCodes(part);
  if (code) for (const op of tickedAll(part.slice(0, part.lastIndexOf("(")))) R55_MACHINE[op] = code;
}
const R55_READS = tickedAll(between(R55_TEXT, "; the reads (", ")"));

test("R55: MACHINE_REFUSALS gains every register write and registerofficers, each with the code R55 names beside it; the "
   + "reads stay open to the assistant; the grade still comes from the owner's row; control: no other op's row changes", () => {
  assert.ok(Object.keys(R55_MACHINE).length >= 12 && R55_READS.length >= 8);
  for (const [op, code] of Object.entries(R55_MACHINE)) {
    assert.equal(OWNERS[op], "registers", `${op} is registers'`);
    assert.equal(G.MACHINE_REFUSALS[op], code, op);
    assert.equal(R.MACHINE_REFUSALS[op], code, `${op}, registered`);
    /* a machine hand row grades nothing (R50 (b)): the op takes its owner's grade still */
    assert.equal(gradeIn(R, op), PROPOSED[op] ?? DECLARED[op].weight, `${op} graded from its row`);
  }
  for (const op of R55_READS) {
    assert.equal(OWNERS[op], "registers", op);
    assert.equal(Object.hasOwn(R.MACHINE_REFUSALS, op), false, `${op} stays open`);
    assert.equal(gradeIn(R, op), "read", op);
  }
  /* control: every other row is the one an unregistered instance holds, and none is a register op */
  for (const [op, code] of Object.entries(G.MACHINE_REFUSALS))
    if (!Object.hasOwn(R55_MACHINE, op)) assert.notEqual(OWNERS[op], "registers", op);
  assert.deepEqual({ ...R.MACHINE_REFUSALS }, { ...G.MACHINE_REFUSALS });
});

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

test.todo("R55: rowexpunge joins IRREVERSIBLE_WEIGHT, phone false (held: affordances' t31 R36 phone test builds its op list from "
   + "the unregistered tables, so it does not see the registered op; affordances amends it, as its F3 intends)");
test.todo("R55: alertconnect is graded ground `credential` from credentials' row (credentials declares no alertconnect yet)");
test("R55: CONSEQUENCE_STATEMENTS gains rowexpunge, a dialog read by its key; control: no other register op has an entry", () => {
  assert.ok(R55_TEXT.includes("`CONSEQUENCE_STATEMENTS` gains `rowexpunge` `{friction: \"dialog\", statement}`"));
  const e = G.CONSEQUENCE_STATEMENTS.rowexpunge;
  assert.ok(Object.isFrozen(e));
  assert.deepEqual({ ...e }, { friction: "dialog", key: "consequence.rowexpunge" });
  assert.equal(hasWord(e.key), true);
  assert.ok(word(e.key).length > 40);
  for (const op of Object.keys(PROPOSED).filter((op) => OWNERS[op] === "registers" && op !== "rowexpunge"))
    assert.equal(Object.hasOwn(G.CONSEQUENCE_STATEMENTS, op), false, op);
});

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
