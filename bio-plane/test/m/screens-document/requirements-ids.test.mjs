/* screens-document: the requirements file's consolidation (T53) changed no requirement. The ids and the unmet marks below are
   those of build/requirements/screens-document.md at the job's start commit (946cfdde), read by the coverage check's rule
   (requirements README convention 5: `**Rn**` first on its line): R1–R75, each marked not yet met (T53). The non-requirement
   text (the long Status, Satisfies, Suggestions and the split map) moved, unchanged, to docs/requirements-notes/screens-document.md.
   BOB's split (PR 474) then moved R58–R75, verbatim and under the same numbers, to build/requirements/screens-document-beta.md;
   this file keeps R1–R57 and stays under the requirements cap. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const at = (rel) => fileURLToPath(new URL(`../../../../${rel}`, import.meta.url));
const FILE = at("build/requirements/screens-document.md");
const BETA = at("build/requirements/screens-document-beta.md");
const CAP = 70000;
const NOTES = at("docs/requirements-notes/screens-document.md");

const START_IDS = Array.from({ length: 75 }, (_, i) => `R${i + 1}`);
const KEPT_IDS = START_IDS.slice(0, 57);
const BETA_IDS = START_IDS.slice(57);
const START_UNMET = Object.fromEntries(START_IDS.map((id) => [id, "T53"]));

const read = (f) => readFileSync(f, "utf8");
const idLines = (text) => text.split("\n").map((l) => l.match(/^\s*- \*\*([RF]\d+)\*\*(.*)$/)).filter(Boolean);

test("split: the requirements file holds R1–R57 and the beta file R58–R75, in order, each once; together the start commit's ids", () => {
  assert.deepEqual(idLines(read(FILE)).map((m) => m[1]), KEPT_IDS);
  assert.deepEqual(idLines(read(BETA)).map((m) => m[1]), BETA_IDS);
});

test("split: the requirements file is under the cap", () => {
  assert.ok(Buffer.byteLength(read(FILE), "utf8") <= CAP, `${Buffer.byteLength(read(FILE), "utf8")} bytes`);
});

test("consolidation: every unmet mark is that of the start commit, on its own id's line", () => {
  const marks = {};
  for (const [, id, rest] of [...idLines(read(FILE)), ...idLines(read(BETA))]) {
    const m = rest.match(/not yet met: ([^)]*)\)\*/);
    if (m) marks[id] = m[1];
  }
  for (const id of Object.keys(marks)) assert.ok(id in START_UNMET, `${id} gained a mark`);
  for (const [id, m] of Object.entries(marks)) assert.equal(m, START_UNMET[id], id);
});

test("consolidation: the moved text is kept in the notes file and left the requirements file", () => {
  const notes = read(NOTES);
  const file = read(FILE);
  for (const lead of ["**Status** · New in T53 (K5564, plan \"Before R1\" (9)", "## Satisfies", "## Suggestions", "## Split map (K5564)",
    "**Moved, `screens-inquiry` old → `screens-document` new**"]) assert.ok(notes.includes(lead), lead);
  for (const gone of ["## Split map (K5564)", "### Satisfies", "### Suggestions"]) assert.ok(!file.includes(gone), gone);
  assert.ok(!idLines(notes).length, "no requirement line lives in the notes file");
});
