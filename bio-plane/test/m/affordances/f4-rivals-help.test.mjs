/* affordances F4 (layer 12, CR2-16; hypotheses F1, BD-17; the ux lane's DEC-502, DEC-504): act help for the rival explanations' three
   ops and the docket's signed edition entry, and the provider notices of this attempt, confirmed at this module's interface.
   - hypotheses:1005: `hypothesisRivals`, `exploreNext` and `rivalsOf` are the services behind `op=hypothesisrivals`, `op=explorenext`
     and `op=rivals`; this module holds each op's help (R48, R62) and grades none (their owner's declared rows, op-grades R49).
   - inquiry:1006: `onBarJudged` and `rivalStanding` add no vocabulary; the inquiry vocabularies this module publishes stay the very objects.
   - ai-runs:1004: `ANSWER_MARKS` is no vocabulary this module publishes, and no act; nothing here reads ai-runs.
   Texts are read from the word table and from the design's file, never copied here (K3810). */
import "./register-owners.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { word, hasWord } from "../../../src/setup-words/index.mjs";
import * as A from "../../../src/affordances.mjs";
import { ACT_HELP, ACT_HELP_KEYS, ACT_HELP_OPS, CR2_DESIGN_OPS, CR2_RIVAL_OPS } from "../../../src/affordances/act-help.mjs";
import { Hypotheses } from "../../../src/hypotheses/index.mjs";
import * as INQUIRY from "../../../src/inquiry/index.mjs";
import * as AI_RUNS from "../../../src/ai-runs/index.mjs";

const ROOT = new URL("../../../../", import.meta.url);
const READS = JSON.parse(readFileSync(new URL("docs/development/ux-substrate/screens/words-reads.json", ROOT), "utf8"));
const MOCK_ACTS = readFileSync(new URL("docs/development/ux-substrate/screens/mock-acts.js", ROOT), "utf8");
const readsOfThisModule = new Set(READS.modules?.affordances?.reads ?? []);

test("F4: hypothesisrivals, explorenext, rivals and docketrecordedition are each held in ACT_HELP under their own name, read from act.<op>.does", () => {
  assert.deepEqual([...CR2_DESIGN_OPS].sort(), ["docketrecordedition", "explorenext", "hypothesisrivals", "rivals"]);
  for (const op of CR2_DESIGN_OPS) {
    const key = `act.${op}.does`;
    assert.ok(hasWord(key), `${key} is a word`);
    assert.ok(readsOfThisModule.has(key), `${key} is in this module's reads list`);
    assert.ok(ACT_HELP_OPS.includes(op), `${op} is held`);
    assert.equal(ACT_HELP_KEYS[op], key, op);
    assert.equal(ACT_HELP[op], word(key), op);
  }
  /* the design's text, word for word: each held text is the ux lane's `mock-acts.js` entry for the op (BOB's note, DEC-502, DEC-504) */
  for (const op of CR2_DESIGN_OPS) {
    const m = new RegExp(`\\n\\s*${op}: '((?:[^'\\\\]|\\\\.)*)'`).exec(MOCK_ACTS);
    assert.ok(m, `${op} has a text in mock-acts.js`);
    assert.equal(ACT_HELP[op], m[1].replace(/\\'/g, "'"), op);
  }
});

test("F4, notice hypotheses:1005: the three rival ops are hypotheses' services, explained here and published as no act of this module", () => {
  for (const m of ["hypothesisRivals", "exploreNext", "rivalsOf"]) assert.equal(typeof Hypotheses.prototype[m], "function", m);
  const published = new Set([...A.ACTS, ...A.CAPTURE_ACTS, ...A.PER_ITEM_ACTS].map((a) => a.id));
  for (const op of CR2_RIVAL_OPS) {
    assert.ok(!published.has(op), `${op} is no act of this module (its grade is its owner's declared row, op-grades R49)`);
    assert.equal(typeof ACT_HELP[op], "string", op);
    assert.ok(ACT_HELP[op].length > 0, op);
  }
});

test("F4, notices inquiry:1006 and ai-runs:1004: the vocabularies this module publishes are unchanged and carry neither provider's new exports", () => {
  assert.equal(typeof INQUIRY.Inquiry.prototype.rivalStanding, "function");
  assert.equal(A.DISPOSITIONS, INQUIRY.DISPOSITIONS, "dispositions stay inquiry's very object (R6)");
  assert.ok(AI_RUNS.ANSWER_MARKS !== undefined, "ai-runs exports ANSWER_MARKS");
  const values = Object.values(A.VOCABULARIES);
  assert.ok(!values.includes(AI_RUNS.ANSWER_MARKS), "ANSWER_MARKS is no vocabulary of this module");
});
