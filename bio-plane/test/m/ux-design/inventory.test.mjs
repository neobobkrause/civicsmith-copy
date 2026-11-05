/* ux-design R1: the lane's words inventory (docs/requirements-notes/ux-design.md) agrees with the design stream's
   word list (docs/development/ux-substrate/screens/words.json) as it stands in the tree. Each blocking row names its
   keys and says whether they are in W; every fully written key a row says is in W must be there, and every one a row
   says is not must be absent. Control: a copy of the word list with one listed key removed fails the check. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const NOTES = join(ROOT, "docs/requirements-notes/ux-design.md");
const WORDS = join(ROOT, "docs/development/ux-substrate/screens/words.json");

const KEY = /^[a-z][a-z0-9_-]*(\.[a-z0-9_-]+)+$/i;

// The blocking table's rows: { mark, keys, inW } where inW is "yes", "no" or null (n/a).
export function inventoryRows(text) {
  const section = text.split(/^## /m).find((s) => s.startsWith("Blocking requirements"));
  assert.ok(section, "the notes hold a 'Blocking requirements' section");
  const rows = [];
  for (const line of section.split("\n")) {
    if (!line.startsWith("|") || /^\|\s*-/.test(line) || /^\|\s*module\s*\|/.test(line)) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 6) continue;
    const [module, mark, keyCell, , inWCell] = cells;
    const inW = /^yes/i.test(inWCell) ? "yes" : /^no/i.test(inWCell) ? "no" : null;
    const keys = keyCell.split(",").map((k) => k.trim().split(/\s/)[0]).filter((k) => KEY.test(k));
    rows.push({ module, mark, keys, inW });
  }
  return rows;
}

export function mismatches(rows, keySet) {
  const out = [];
  for (const r of rows) {
    if (!r.inW) continue;
    for (const k of r.keys) {
      if (r.inW === "yes" && !keySet.has(k)) out.push(`${r.module} ${r.mark}: ${k} listed in words.json but absent`);
      if (r.inW === "no" && keySet.has(k)) out.push(`${r.module} ${r.mark}: ${k} listed as not in words.json but present`);
    }
  }
  return out;
}

const rows = inventoryRows(readFileSync(NOTES, "utf8"));
const list = JSON.parse(readFileSync(WORDS, "utf8")).words;
const keySet = new Set(list.map((w) => w.key));

test("R1 every key the inventory places in or out of words.json is where it says", () => {
  assert.ok(rows.filter((r) => r.inW && r.keys.length).length > 0, "the inventory names keys");
  assert.deepEqual(mismatches(rows, keySet), []);
});

test("R1 control: a word list with one key the inventory places in it removed fails the check", () => {
  const listed = rows.find((r) => r.inW === "yes" && r.keys.length);
  assert.ok(listed, "a row places a key in words.json");
  const copy = new Set(keySet);
  copy.delete(listed.keys[0]);
  assert.equal(mismatches(rows, copy).length, 1);
});

test("R1 control: a row that places a present key outside words.json fails the check", () => {
  // once every listed key is settled no row may say "no", so the control adds one: a key words.json holds, listed as absent
  const listed = rows.find((r) => r.inW === "yes" && r.keys.length);
  assert.ok(listed, "a row places a key in words.json");
  const withAbsent = [...rows, { module: "control", mark: "R0", keys: [listed.keys[0]], inW: "no" }];
  assert.equal(mismatches(withAbsent, keySet).length, 1);
});

/* ux-design R3: every key a blocking row places in words.json is settled: it resolves through setup-words (built from
   words.json by bio-plane/src/setup-words/build.mjs) to non-empty English, and words-unreviewed.json no longer drafts it. */
const UNREVIEWED = join(ROOT, "bio-plane/src/setup-words/words-unreviewed.json");

test("R3 every key the inventory settles has non-empty English and is no longer drafted in words-unreviewed", async () => {
  const { hasWord, WORD_ROWS } = await import("../../../src/setup-words/index.mjs");
  const en = new Map(WORD_ROWS.map((r) => [r[0], r[1]]));
  const drafted = new Set(JSON.parse(readFileSync(UNREVIEWED, "utf8")).unreviewed.map((u) => u.id));
  const settled = rows.filter((r) => r.inW === "yes").flatMap((r) => r.keys.map((k) => [r, k]));
  assert.ok(settled.length > 0, "the inventory settles keys");
  // R3 settles ai-use R13's keys first: every ai-use R13 row with keys is settled
  const r13 = rows.filter((r) => r.module === "ai-use" && /^R13\b/.test(r.mark) && r.keys.length);
  assert.ok(r13.length > 0 && r13.every((r) => r.inW === "yes"), "every ai-use R13 row is settled in words.json");
  const bad = [];
  for (const [r, k] of settled) {
    if (!hasWord(k) || !String(en.get(k) ?? "").trim()) bad.push(`${r.module} ${r.mark}: ${k} has no English in setup-words`);
    if (drafted.has(k)) bad.push(`${r.module} ${r.mark}: ${k} is still drafted in words-unreviewed`);
  }
  assert.deepEqual(bad, []);
});
