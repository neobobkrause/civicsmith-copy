/* op-declarations R3 (T49; K3298, K3339): THE COMPOSITION OF `NEEDS`. The table is two parts that share no op: the
   hand-written rows, `op-capabilities.needsRows()` (its R1), and each family op's row from its kind (R19). A later key
   wins in a spread, so a family row for an op the hand-written part holds would silently replace its row: it is refused
   instead, by name. The result is a fresh table (the hand-written part is frozen) for the aliases (R21) to be applied
   over, and for `index.mjs` to freeze. Data in, data out: nothing here reads a request, a store or the environment (R7). */
export function composeNeeds(handRows, familyRows, founderRows = {}) {
  const composed = { ...handRows };
  for (const [op, row] of Object.entries(familyRows)) {
    if (Object.hasOwn(handRows, op)) throw new TypeError(`op-declarations: ${op}: a family row and a hand-written row (R3)`);
    composed[op] = row;
  }
  /* R83 (T51 fix round; K4237): the rows of the founder's session acts that are no family op and have no hand-written row
     (`export`), a third part that shares no op with the other two. */
  for (const [op, row] of Object.entries(founderRows)) {
    if (Object.hasOwn(composed, op)) throw new TypeError(`op-declarations: ${op}: a founder-session row and another row (R3)`);
    composed[op] = row;
  }
  return composed;
}

/* surface-declarations R10–R12, R15–R18 (T53; K4354, K4599, K5438, K5571 (3), N1264; PL2–PL4, PL10, PL11): THE SURFACE'S
   DECLARATIONS, composed over `OPS` as `NEEDS` is composed over the hand rows: every op's budget class, the screen moves',
   a screen's read waves checked against the ops `OPS` holds, its derived hop count, and `screenread`'s spec and answer.
   `OPS` is read only when one of these is first called (op-declarations R69: nothing is built at import), and the table is
   built once and frozen. Data in, data out (R7). */
import { OPS } from "./index.mjs";
import { BUDGET_CLASS_ROWS, SCREEN_MOVES, NOT_FIRST_WAVE, SCREENREAD_SPEC } from "./t51.mjs";
import { budgetRow, defaultBudgetClass, budgetFindings, screenReads, hopsOf, screenReadAnswer } from "./declared.mjs";

let OP_BUDGETS = null;
let MOVE_BUDGETS = null;
const freezeTable = (entries) => Object.freeze(Object.fromEntries(entries));
/* R12, R15–R18: `{op: {budget_class, ceiling_ms}}` for every op in `OPS`, from its row in `BUDGET_CLASS_ROWS` where one
   names it, else its kind's (`defaultBudgetClass`), each checked against `runtime-limits`' classes (`budgetRow`) */
export function opBudgets() {
  OP_BUDGETS ??= freezeTable(Object.keys(OPS).map((op) =>
    [op, budgetRow(op, Object.hasOwn(BUDGET_CLASS_ROWS, op) ? BUDGET_CLASS_ROWS[op] : defaultBudgetClass(OPS[op]))]));
  return OP_BUDGETS;
}
/* R15: the screen moves, which are no ops, each the in-app move class */
export function moveBudgets() {
  MOVE_BUDGETS ??= freezeTable(Object.entries(SCREEN_MOVES).map(([m, c]) => [m, budgetRow(m, c)]));
  return MOVE_BUDGETS;
}
/* R12: a stated class for an op no owner declares yet, checked as the built table's are; `undefined` with none */
export const statedBudget = (op) => (Object.hasOwn(BUDGET_CLASS_ROWS, op) ? budgetRow(op, BUDGET_CLASS_ROWS[op]) : undefined);
/* R12: a screen's budget, its row's class (an override downward only) or, with no row, the full load of a screen's */
export const screenBudget = (screen, row) => budgetRow(screen, row ?? "screen_load");
/* R10, R11, R16: a screen's read waves, checked against `OPS` (an unknown op, a write and a first-wave `proposeParts` refused) */
export const declareScreenReads = (screen, reads) => screenReads(screen, reads, { isOp: (op) => Object.hasOwn(OPS, op),
  isWrite: (op) => OPS[op].mutating === true, notFirstWave: NOT_FIRST_WAVE });
export const screenHops = hopsOf;
/* R11: `screenread`'s spec, and its answer with each read's bound its op's budget ceiling */
export const SCREENREAD = SCREENREAD_SPEC;
export const screenReadOf = (reads, outcomes, stamps) => screenReadAnswer(reads, outcomes, (op) => opBudgets()[op].ceiling_ms, stamps);
export { budgetRow, budgetFindings };
