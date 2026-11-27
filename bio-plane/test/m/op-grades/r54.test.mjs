/* op-grades R54 (T51 fix round 10; PUBLISH-SCHEDULE #6 J8; amends R49, R50): an owner's `irreversible` row is accepted only in
   agreement with its hand row. The module is exercised through its exports over fixture owner rows, no real module: the owner
   rows are built here from this module's own hand rows (their words are read from `NON_ACTS`, never typed), so each test
   checks the agreement the registration makes, not a copy of another module's answer. Each test loads fresh instances, so a
   registration in one never reaches the next, and `ref`, an untouched twin, is what the original tables are read from. */
import test from "node:test";
import assert from "node:assert/strict";
import { hasWord, word, WORD_ROWS } from "../../../src/setup-words/index.mjs";

/** @import { DeclaredRow } from "../../../src/op-grades/declared.mjs" */
/** @typedef {typeof import("../../../src/op-grades/index.mjs")} OpGrades */

const FIRST_ROW = WORD_ROWS[0];
assert.ok(FIRST_ROW, "the word list holds a row");
const KEY_A = FIRST_ROW[0];
const SENTENCE = "a fixture sentence that no list holds";

/**
 * @param {string} weight
 * @param {string | undefined} description
 * @param {DeclaredRow} [extra]
 */
const row = (weight, description, extra = {}) => ({
  classes: ["member"], mutating: weight !== "read", weight, description, fields: { accepts: [], requires: [] }, ...extra,
});

/**
 * The four tables and the family list as plain data (this reads them).
 * @param {OpGrades} m
 * @returns {unknown}
 */
const state = (m) => {
  /** @type {unknown} */
  const plain = JSON.parse(JSON.stringify({
    RUNGS: m.RUNGS, RUNG_ABSENT: m.RUNG_ABSENT, NON_ACTS: m.NON_ACTS, MACHINE_REFUSALS: m.MACHINE_REFUSALS, JUSTIFICATION_REFUSALS: m.JUSTIFICATION_REFUSALS,
  }));
  return plain;
};
/**
 * @param {string} code
 * @param {string} op
 */
const refused = (code, op) => ({ name: "Error", code, message: new RegExp(op) });

test("the fixture key is real (the owner rows below take their words from the hand rows, and this one only as a control)", () => {
  assert.ok(hasWord(KEY_A));
});

test("R54: an owner row weighted irreversible, for an op whose hand row is irreversible, registers and changes nothing", async () => {
  const m = await import("../../../src/op-grades/index.mjs?r54=1m");
  const ref = await import("../../../src/op-grades/index.mjs?r54=1ref");
  const answer = m.registerDeclaredOps({
    "publish-schedule": { publishatmove: row("irreversible", ref.NON_ACTS.publishatmove) },
  });
  assert.deepEqual(answer, { registered: [], agreed: ["publishatmove"] });
  assert.equal(m.RUNGS.publishatmove, "irreversible");
  assert.deepEqual(state(m), state(ref), "an agreeing irreversible row changes nothing");
});

test("R54: publishat (ratification's hand row, also irreversible) is accepted in agreement the same way", async () => {
  const m = await import("../../../src/op-grades/index.mjs?r54=2m");
  const ref = await import("../../../src/op-grades/index.mjs?r54=2ref");
  const answer = m.registerDeclaredOps({
    ratification: { publishat: row("irreversible", ref.NON_ACTS.publishat) },
  });
  assert.deepEqual(answer, { registered: [], agreed: ["publishat"] });
  assert.deepEqual(state(m), state(ref), "an agreeing irreversible row changes nothing");
});

test("R54: an irreversible row for an op with no hand row in RUNGS stays refused, naming it, and nothing changes", async () => {
  const m = await import("../../../src/op-grades/index.mjs?r54=3m");
  const ref = await import("../../../src/op-grades/index.mjs?r54=3ref");
  assert.throws(() => m.registerDeclaredOps({ fixture: { fxirreversible: row("irreversible", KEY_A) } }),
    refused("DECLARED_OP_BAD_WEIGHT", "fxirreversible"));
  assert.deepEqual(state(m), state(ref), "a refused registration changes nothing");
});

test("R54: an irreversible row for a hand row that holds an absence or a read (not a RUNGS irreversible) stays refused", async () => {
  const m = await import("../../../src/op-grades/index.mjs?r54=4m");
  const ref = await import("../../../src/op-grades/index.mjs?r54=4ref");
  assert.equal(Object.hasOwn(ref.RUNGS, "holdsdue"), false, "control: holdsdue is a read, held only in NON_ACTS");
  assert.throws(() => m.registerDeclaredOps({ fixture: { holdsdue: row("irreversible", ref.NON_ACTS.holdsdue) } }),
    refused("DECLARED_OP_BAD_WEIGHT", "holdsdue"));
  assert.deepEqual(state(m), state(ref));
});

test("R54: control: a reasoned hand row declared irreversible is refused DECLARED_OP_DISAGREES, naming it, and nothing changes", async () => {
  const m = await import("../../../src/op-grades/index.mjs?r54=5m");
  const ref = await import("../../../src/op-grades/index.mjs?r54=5ref");
  assert.equal(ref.RUNGS.standardinforcethrough, "reasoned", "control: the hand row is reasoned");
  assert.throws(() => m.registerDeclaredOps({
    standards: { standardinforcethrough: row("irreversible", ref.NON_ACTS.standardinforcethrough) },
  }), refused("DECLARED_OP_DISAGREES", "standardinforcethrough"));
  assert.deepEqual(state(m), state(ref), "a disagreeing registration changes nothing");
});

test("R54: control: a reversible hand row declared irreversible is refused DECLARED_OP_DISAGREES, and a registration that is refused whole adds none of its other rows", async () => {
  const m = await import("../../../src/op-grades/index.mjs?r54=6m");
  const ref = await import("../../../src/op-grades/index.mjs?r54=6ref");
  assert.equal(ref.RUNGS.cite, "reversible", "control: the hand row is reversible");
  assert.throws(() => m.registerDeclaredOps({
    fixture: { fxother: row("reversible", KEY_A), fxextra: row("reversible", KEY_A) },
    citer: { cite: row("irreversible", SENTENCE) },
  }), refused("DECLARED_OP_DISAGREES", "cite"));
  assert.deepEqual(state(m), state(ref), "the other ops of the call are not added either");
});
