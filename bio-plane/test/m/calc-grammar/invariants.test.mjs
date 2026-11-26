/* calc-grammar's invariants (R18, R19): no eval and no user code; pure and exact. The battery runs in a child process
   where code generation from strings is disallowed, every module load after start-up is recorded, and the clock,
   randomness and the network throw; its answers must equal an ordinary run's. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as c from "../../../src/calc-grammar/index.mjs";
import { isObject } from "../../../src/calc-grammar/decimal.mjs";
import { battery } from "./fixtures/battery.mjs";

/** @import { Data, Members } from "../../../src/calc-grammar/tables.mjs" */
/** @import { List } from "../../../src/calc-grammar/recipe.mjs" */

/** What the locked-down run prints: the battery's answers, the modules loaded late, and whether eval was blocked.
 *  @typedef {{ answers: Members, late: Data, evalBlocked: Data }} Locked */

/** @param {unknown} v @returns {v is List} */
const isList = (v) => Array.isArray(v);
/** A member of a value, as reading it off an object gives it. @param {Data} x @param {string} name @returns {Data} */
const member = (x, name) => (isObject(x) ? x[name] : undefined);
/** The child's printed JSON, read as what it prints. @param {string} text @returns {Locked} */
const lockedOf = (text) => {
  const parsed = JSON.parse(text);
  const out = isObject(parsed) ? parsed : assert.fail(`the locked run printed no object: ${text}`);
  const answers = out.answers;
  if (!isObject(answers)) return assert.fail(`the locked run printed no answers: ${text}`);
  return { answers, late: out.late, evalBlocked: out.evalBlocked };
};
const locked = () => lockedOf(execFileSync(process.execPath, ["--disallow-code-generation-from-strings",
  fileURLToPath(new URL("./fixtures/locked.mjs", import.meta.url))], { encoding: "utf8" }));

test("R18 no eval, no Function, no dynamic import: every service answers with code generation disallowed and no module loaded after start-up; a recipe is data only", () => {
  const { answers, late, evalBlocked } = locked();
  assert.equal(evalBlocked, true, "the child really disallows code generation");
  assert.deepEqual(late, [], "no module was imported while the services ran");
  assert.deepEqual(answers, JSON.parse(JSON.stringify(battery(c))));
  assert.equal(member(answers.check, "ok"), false);
  const code = { method: c.METHOD, inputs: [{ name: "t", kind: "table" }], steps: [{ op: "select", as: "s", from: "t", where: [{ field: "a", test: "eq", value: "x" }], expr: "process.exit(1)" }], output: "s" };
  const answer = c.evaluate(code, { t: { fields: [], rows: [] } });
  assert.equal("refused" in answer ? answer.refused : undefined, "RECIPE_INVALID");
});

test("R19 pure: no clock, no randomness and no network are read (they throw in the locked run), and the answers are the same; exact decimals throughout", () => {
  const { answers } = locked();
  const arith = answers.arith;
  if (!isList(arith)) return assert.fail("the battery's arithmetic is a list");
  assert.deepEqual(arith.map((f) => member(f, "value")), ["0.3", "2", "2.25", "0.66667", "2"]);
  assert.deepEqual(member(answers.z, "result"), { value: "0.90", sign: "-", precision: "exact" });
  assert.equal(member(member(answers.c, "result"), "value"), "2");
  assert.deepEqual(answers, JSON.parse(JSON.stringify(battery(c))));
});
