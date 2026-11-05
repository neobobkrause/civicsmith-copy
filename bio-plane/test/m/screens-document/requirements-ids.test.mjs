/* screens-document: the requirements file's consolidation (T53) changed no requirement. The ids and the unmet marks below are
   those of build/requirements/screens-document.md at the job's start commit (946cfdde), read by the coverage check's rule
   (requirements README convention 5: `**Rn**` first on its line): R1–R75, each marked not yet met (T53). The non-requirement
   text (the long Status, Satisfies, Suggestions and the split map) moved, unchanged, to docs/requirements-notes/screens-document.md. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const at = (rel) => fileURLToPath(new URL(`../../../../${rel}`, import.meta.url));
const FILE = at("build/requirements/screens-document.md");
const NOTES = at("docs/requirements-notes/screens-document.md");

const START_IDS = Array.from({ length: 75 }, (_, i) => `R${i + 1}`);
const START_UNMET = Object.fromEntries(START_IDS.map((id) => [id, "T53"]));

const read = (f) => readFileSync(f, "utf8");
const idLines = (text) => text.split("\n").map((l) => l.match(/^\s*- \*\*([RF]\d+)\*\*(.*)$/)).filter(Boolean);

test("consolidation: the requirements file holds exactly the ids it held at the start commit, in order, each once", () => {
  assert.deepEqual(idLines(read(FILE)).map((m) => m[1]), START_IDS);
});

test("consolidation: every unmet mark is that of the start commit, on its own id's line", () => {
  const marks = {};
  for (const [, id, rest] of idLines(read(FILE))) {
    const m = rest.match(/not yet met: ([^)]*)\)\*/);
    if (m) marks[id] = m[1];
  }
  assert.deepEqual(marks, START_UNMET);
});

test("consolidation: the moved text is kept in the notes file and left the requirements file", () => {
  const notes = read(NOTES);
  const file = read(FILE);
  for (const lead of ["**Status** · New in T53 (K5564, plan \"Before R1\" (9)", "## Satisfies", "## Suggestions", "## Split map (K5564)",
    "**Moved, `screens-inquiry` old → `screens-document` new**"]) assert.ok(notes.includes(lead), lead);
  for (const gone of ["## Split map (K5564)", "### Satisfies", "### Suggestions"]) assert.ok(!file.includes(gone), gone);
  assert.ok(!idLines(notes).length, "no requirement line lives in the notes file");
});
