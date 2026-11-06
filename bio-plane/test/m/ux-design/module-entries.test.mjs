/* ux-design R2: for each inventory row whose keys are all in the stream (screens-document-beta R60, R61, R62's held.kind,
   R63, R64 to R68, R72), the lane's module entry (docs/development/ux-substrate/screens/words-reads-requirements.mjs, read
   by words-reads.src.mjs) lists the row's keys for the module, and each key resolves through setup-words' word() to
   non-empty text. When words-reads.json has been built, the module's reads hold every key. */
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { REQUIREMENT_READS_BY_MARK } from "../../../../docs/development/ux-substrate/screens/words-reads-requirements.mjs";
import { word, hasWord, WORD_ROWS } from "../../../src/setup-words/index.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const READS = join(ROOT, "docs/development/ux-substrate/screens/words-reads.json");
const MODULE = "screens-document-beta";
const MARKS = ["R60", "R61", "R62", "R63", "R64", "R65", "R66", "R67", "R68", "R72"];
const entry = REQUIREMENT_READS_BY_MARK[MODULE] ?? {};
const textOf = new Map(WORD_ROWS.map((r) => [r[0], r[1]]));

// word() with each of the row's placeholders filled, so the key resolves as the module would draw it.
const resolve = (key) => {
  const vars = Object.fromEntries([...(textOf.get(key) ?? "").matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => [m[1], "x"]));
  return word(key, vars);
};

test("R2 each screens-document-beta row's module entry names its keys and each resolves to non-empty text", () => {
  for (const mark of MARKS) {
    const keys = entry[mark];
    assert.ok(Array.isArray(keys) && keys.length > 0, `${mark} has a module entry`);
    for (const k of keys) {
      assert.ok(hasWord(k), `${mark}: ${k} is in the stream's words`);
      assert.ok(resolve(k).trim().length > 0, `${mark}: ${k} resolves to non-empty text`);
    }
  }
});

test("R2 control: a key the stream lacks does not resolve", () => {
  assert.equal(hasWord("screen.document.ux-design.no-such-key"), false);
  assert.throws(() => word("screen.document.ux-design.no-such-key"), { code: "UNKNOWN_WORD" });
});

test(`R2 words-reads.json lists every entry key among ${MODULE}'s reads`, { skip: !existsSync(READS) && "words-reads.json not built" }, () => {
  const reads = new Set(JSON.parse(readFileSync(READS, "utf8")).modules?.[MODULE]?.reads ?? []);
  for (const mark of MARKS) for (const k of entry[mark] ?? []) assert.ok(reads.has(k), `${MODULE} reads ${k}`);
});
