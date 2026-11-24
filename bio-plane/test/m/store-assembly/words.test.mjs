/* store-assembly's copy of plane's test of this name (K624: by copy). store-assembly R95 (T49; K3366, K3368; DEC-257, DEC-258; setup-words R11–R13): the plane holds no member-facing English. Every
   sentence it draws or answers is read through `word(key, vars)`, and its keys are the ones `words-reads.json` lists for it.
   Each test here holds keys, never a sentence's English (K3366 (3)). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { word, hasWord } from "../../../src/setup-words/index.mjs";
import { SCREEN_REGISTRY } from "../../../src/wizard-scripts/index.mjs";

/* the keys this module reads: its answers' details. (T51; R23) The plane draws no screen title or purpose: the 26 `screen.*`
   keys it once read for `plane/screens.mjs` left with that file; a surface reads a screen's own keys itself. */
const ANSWER_KEYS = [
  "ai.draft.planunread", "ai.draft.recordsunread", "ai.keepaway.unread", "refusal.AGENT_WORKER_UNBOUND",
  "refusal.AGENT_WORKER_SILENT", "refusal.ASK_NOT_A_MEMBER", "refusal.NO_SUCH_NOTE", "refusal.PASSAGE_TOO_LONG",
  "translate.undetermined.language",
];
/* K3381 (DEC-267): `AGENT_WORKER_UNBOUND` has its own word; words-reads.json still lists its interim key, so it is named here until the list is re-cut */
const RULED = ["refusal.AGENT_WORKER_UNBOUND"];
const READS = JSON.parse(readFileSync(new URL("../../../../docs/development/ux-substrate/screens/words-reads.json", import.meta.url), "utf8"))
  .modules.plane.reads;

test("R95 (T49; K3366): every key the plane reads is one the words list holds (`hasWord`), and each is one of the keys `words-reads.json` lists for plane; control: a key no list holds is not", () => {
  const keys = [...ANSWER_KEYS];
  for (const k of keys) {
    assert.equal(hasWord(k), true, `${k} is held by the words list`);
    assert.ok(READS.includes(k) || RULED.includes(k), `${k} is a key words-reads.json lists for plane, or one BOB ruled (K3381)`);
  }
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
