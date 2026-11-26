/* Readers of a registry read's answer for the tests of the neighbours contract (R6-R8, R19, R20): its answer where it
   answers, or its refusal where it refuses. */
import assert from "node:assert/strict";
/** @import { Refusal, PassedRefusal, ReadFailure, NeighboursAnswer } from "../../../../src/connection-grammar/shape.mjs" */

/**
 * What a registry's read answers.
 * @typedef {Refusal | PassedRefusal | (Refusal & {failures: ReadFailure[]}) | NeighboursAnswer} ReadAnswer
 */
/**
 * A refusal as these tests read it: the kind of no, why, and the failed checks (none where it names none).
 * @typedef {{refused: string, why: string, failures: ReadFailure[], items: boolean}} ReadRefusal
 */
/**
 * The fields a test changes in a read.
 * @typedef {{node?: string, kinds?: string[], viewer?: unknown, scope?: unknown, page?: unknown}} ReadExtra
 */

/**
 * A read's answer, where it answers and does not refuse.
 * @param {ReadAnswer} a
 * @returns {NeighboursAnswer}
 */
export const answerOf = (a) => {
  assert.ok(!("refused" in a), JSON.stringify(a).slice(0, 200));
  return a;
};
/**
 * A read's refusal, `items` saying whether it carries any items; null where it answers.
 * @param {ReadAnswer} a
 * @returns {ReadRefusal | null}
 */
export const refusalOf = (a) => {
  if (!("refused" in a)) return null;
  const why = a.why;
  return { refused: a.refused, why: typeof why === "string" ? why : "", failures: "failures" in a ? a.failures : [], items: "items" in a };
};
