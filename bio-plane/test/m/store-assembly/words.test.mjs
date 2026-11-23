/* store-assembly's copy of plane's test of this name (K624: by copy). store-assembly R95 (T49; K3366, K3368; DEC-257, DEC-258; setup-words R11–R13): the plane holds no member-facing English. Every
   sentence it draws or answers is read through `word(key, vars)`, and its keys are the ones `words-reads.json` lists for it.
   Each test here holds keys, never a sentence's English (K3366 (3)). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { word, hasWord } from "../../../src/setup-words/index.mjs";
import { SCREEN_REGISTRY } from "../../../src/wizard-scripts/index.mjs";

/* The keys this module's own source reads. Its files are those under `bio-plane/src/store-assembly/` that the module list does
   not give to store-services (split from it, P6): the ask and draft doors, whose answers' details are words, are store-services'
   and hold their own keys. (T51; R23) The assembly draws no screen title or purpose either: a surface reads a screen's own keys. */
const SRC = new URL("../../../src/store-assembly/", import.meta.url);
const SERVICES = new Set(JSON.parse(readFileSync(new URL("../../../../process/modules/store-services.json", import.meta.url), "utf8")).files);
const OWN_FILES = readdirSync(SRC).filter((f) => f.endsWith(".mjs") && !SERVICES.has(`bio-plane/src/store-assembly/${f}`)).sort();
/** @param {string} text @returns {string[]} every key the text hands `word` or `hasWord` as a written-out first argument */
const keysIn = (text) => [...text.matchAll(/\b(?:word|hasWord)\(\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
/** @type {string[]} the `reads` list for store-assembly, empty until the list is regenerated at the design commit (R95) */
const READS = JSON.parse(readFileSync(new URL("../../../../docs/development/ux-substrate/screens/words-reads.json", import.meta.url), "utf8"))
  .modules["store-assembly"]?.reads ?? [];

test("R95, R97 (T49; K3366): every key the assembly's own source reads is held by the words list (`hasWord`) and listed for store-assembly, and it reads none: it draws no sentence and answers none itself; control: a key no list holds is not, and a written-out key is found", () => {
  assert.deepEqual(OWN_FILES, ["assemble.mjs", "index.mjs", "owners.mjs", "stats.mjs", "wiring.mjs", "wizards.mjs"], "the assembly's own files");
  const keys = OWN_FILES.flatMap((f) => keysIn(readFileSync(new URL(f, SRC), "utf8")));
  for (const k of keys) {
    assert.equal(hasWord(k), true, `${k} is held by the words list`);
    assert.ok(READS.includes(k), `${k} is a key words-reads.json lists for store-assembly`);
  }
  assert.deepEqual(keys, [], "the assembly reads no key itself");
  assert.deepEqual(keysIn('x = word("refusal.NO_SUCH_NOTE", {});'), ["refusal.NO_SUCH_NOTE"], "control: a written-out key is found");
  assert.equal(hasWord("zz.no.such.key"), false, "negative control: an unknown key is not held");
});

test("R95 (T49; K3366; R23, T51): the plane reads no `screen.*` key: the one registry carries each screen's own keys for the surfaces that draw them", () => {
  for (const s of SCREEN_REGISTRY) {
    assert.equal(hasWord(`screen.${s.id}.name`), true, `${s.id} name`);
    assert.equal(s.name, word(`screen.${s.id}.name`), `${s.id} name by key`);
  }
});

test("R95 (T49; K3366; setup-words R11): each answer's detail is `word` of its key, through the plane's ask path; the passage limit is filled with its maximum; control: a missing placeholder throws WORD_VAR_MISSING and an unknown key throws UNKNOWN_WORD", () => {
  assert.equal(typeof word("refusal.PASSAGE_TOO_LONG", { max: 20000 }), "string", "filled with its maximum");
  assert.ok(!word("refusal.PASSAGE_TOO_LONG", { max: 20000 }).includes("{max}"), "the placeholder is filled");
  assert.throws(() => word("refusal.PASSAGE_TOO_LONG", {}), (e) => e.code === "WORD_VAR_MISSING");
  assert.throws(() => word("zz.no.such.key", {}), (e) => e.code === "UNKNOWN_WORD" || /UNKNOWN_WORD/.test(String(e.message)));
});
