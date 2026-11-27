/* op-grades: R44, words by key (T49; K3366, K3368; DEC-257, DEC-258). This module holds no member-facing English: what it
   publishes beside a grade is a key, and a surface reads the sentence through `setup-words` `word(key, vars)`. Every key it
   publishes is asserted with `hasWord` (`setup-words` R12); no test here holds a sentence's English. The keys are the
   `reads` list for it in `words-reads.json` (DEC-258). */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as G from "../../../src/op-grades/index.mjs";
import { CONSEQUENCE_STATEMENTS, IRREVERSIBLE_CORRECTION_KEY, IRREVERSIBLE_WEIGHT, RUNGS } from "../../../src/op-grades/index.mjs";
import { word, hasWord } from "../../../src/setup-words/index.mjs";
/** @import { WordVars } from "../../../src/setup-words/index.mjs" */

const READS = JSON.parse(readFileSync(fileURLToPath(
  new URL("../../../../docs/development/ux-substrate/screens/words-reads.json", import.meta.url)), "utf8")).modules["op-grades"].reads;
const KEYS = [...Object.values(CONSEQUENCE_STATEMENTS).map((e) => e.key), IRREVERSIBLE_CORRECTION_KEY];
/* every string the module's maps hold: a consequence entry holds its key, a rung or a non-act its sentence (K3268: the
   test reads the list, never a written count, so the list may grow as its owners draw more words) */
const LEAVES = new Set([IRREVERSIBLE_CORRECTION_KEY]);
/**
 * @param {unknown} v
 * @returns {void}
 */
const walk = (v) => { if (typeof v === "string") LEAVES.add(v); else if (v && typeof v === "object") Object.values(v).forEach(walk); };
Object.values(G).forEach(walk);

test("R44: the keys this module publishes are exactly its `reads` list, each asserted with hasWord", () => {
  assert.ok(READS.length > 0);
  assert.deepEqual(KEYS.filter((k) => !READS.includes(k)), [], "every key a consequence entry names is in the list");
  assert.equal(new Set(KEYS).size, KEYS.length, "no key twice");
  for (const k of READS) assert.equal(hasWord(k), true, k);
  /* the list is what the module publishes: each key is held by a map, as itself or as the sentence it draws */
  for (const k of READS) assert.ok(LEAVES.has(k) || LEAVES.has(word(k)), k);
  /* and each word a map holds as a key is in the list */
  assert.deepEqual([...LEAVES].filter((s) => hasWord(s) && !READS.includes(s)), []);
  /* controls: a key the list does not hold, and a sentence in place of a key, are not words */
  assert.equal(hasWord("consequence.nosuchop"), false);
  assert.equal(hasWord("Publishing makes this edition permanent and public."), false);
});

test("R44: what a consequence entry draws for each of its keys equals word(key, vars): a plain key unchanged, personexpunge's {date} and {member} filled by the surface", () => {
  const date = "2026-10-14", member = "a member";
  /** @type {WordVars} */
  const vars = { date, member };
  for (const [op, e] of Object.entries(CONSEQUENCE_STATEMENTS)) {
    const drawn = word(e.key, vars);
    assert.equal(typeof drawn, "string", op);
    assert.ok(drawn.length > 40, op);
    assert.equal(drawn, word(e.key, vars), `${op}: the same key and vars give the same sentence`);
  }
  assert.equal(word(IRREVERSIBLE_CORRECTION_KEY), word("screen.ceremony.permanent"));
  /* the two placeholders of the expunge sentence are the surface's to fill */
  const filled = word(CONSEQUENCE_STATEMENTS.personexpunge.key, vars);
  assert.ok(filled.includes(date) && filled.includes(member));
  assert.doesNotMatch(filled, /\{date\}|\{member\}/);
  /* controls: a missing placeholder and an unknown key each throw their code, never a fallback */
  assert.throws(() => word(CONSEQUENCE_STATEMENTS.personexpunge.key, {}), /** @param {unknown} e */ (e) => e instanceof Error && /WORD_VAR_MISSING/.test(`${"code" in e ? e.code : undefined} ${e.message}`));
  assert.throws(() => word("consequence.nosuchop"), /** @param {unknown} e */ (e) => e instanceof Error && /UNKNOWN_WORD/.test(`${"code" in e ? e.code : undefined} ${e.message}`));
});

test("R44: every op that carries a consequence entry keeps its rung or ground, and the Irreversible weight names ops, never keys", () => {
  for (const op of Object.keys(CONSEQUENCE_STATEMENTS)) assert.ok(typeof op === "string" && !op.includes("."), op);
  for (const op of IRREVERSIBLE_WEIGHT) assert.ok(!op.includes("."), op);
  assert.equal(RUNGS.filingapprove, "terminal");
  assert.equal(RUNGS.attribute, "reasoned");
  assert.equal(RUNGS.workobjective, "reasoned");
  /* control: a key is not an op */
  assert.ok(!Object.hasOwn(CONSEQUENCE_STATEMENTS, "consequence.attribute"));
});
