/* R19 (words by key), on the counsel screen `SCREENS` composes: the keys counsel draws are the keys its `words` list names,
   each one setup-words holds. The screen's source is read as text for the keys it names (U16's `screen.counsel.made.*`,
   `.sections.marking`, `.export.note`, and the filings' own sentences it draws for a prepared packet). */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SCREENS } from "../../../src/screens-action/index.mjs";
import { hasWord } from "../../../src/setup-words/index.mjs";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "../../../src/screens-action/counsel.mjs");
const KEY = /["'`]((?:screen|filings|state|shell|act|refusal|mark|stake|law|risk)\.[A-Za-z0-9_.\-]+)["'`]/g;

test("R19: counsel's words list holds every key counsel draws, each one setup-words holds", () => {
  const words = new Set(SCREENS.find((s) => s.id === "counsel").words);
  const drawn = [...new Set([...readFileSync(SRC, "utf8").matchAll(KEY)].map((m) => m[1]))];
  assert.ok(drawn.length > 40, "the source names its keys");
  const missing = drawn.filter((k) => !words.has(k));
  assert.deepEqual(missing, [], "every key counsel draws is in its words list");
  for (const k of drawn) assert.ok(hasWord(k), `${k} is a word of setup-words`);
  // U16's rows and the filings' sentences by name, so a lost key is named in the failure
  for (const k of ["screen.counsel.made.head", "screen.counsel.made.lead", "screen.counsel.made.by", "screen.counsel.made.by.noorg",
    "screen.counsel.made.by.nocounsel", "screen.counsel.made.changed", "screen.counsel.made.exported", "screen.counsel.made.exported.nocounsel",
    "screen.counsel.made.version", "screen.counsel.sections.marking", "screen.counsel.export.note", "filings.prepared_group_review",
    "filings.determination_superseded", "filings.determination_flagged", "filings.finding_later_edition", "filings.standard_superseded"]) {
    assert.ok(words.has(k), k);
  }
});

test("R19 control: counsel's words list holds each key at most once, and no other screen's own keys", () => {
  const list = SCREENS.find((s) => s.id === "counsel").words;
  assert.equal(new Set(list).size, list.length);
  assert.ok(!list.some((k) => k.startsWith("screen.matter.") || k.startsWith("screen.plan.")));
});
