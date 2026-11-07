/* screens-action: the consolidation of build/requirements/screens-action.md (REQ-6) moves no requirement.
   Every id at the start commit (3937a229, before the move) is still an id here, and the unmet marks are the
   start's less those of the lines retired to screens-plan and screens-matter, which carry their marks with them there. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ROOT = new URL("../../../../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");
const lines = (t) => t.split("\n").filter((l) => /^\s*- \*\*[RF]\d+\*\*/.test(l));
const idOf = (l) => l.match(/\*\*([RF]\d+)\*\*/)[1];

const START_IDS = Array.from({ length: 81 }, (_, i) => `R${i + 1}`);
const START_UNMET = ["R60", "R61", "R62", "R63", "R64", "R65", "R66", "R67", "R68", "R69", "R70", "R71", "R72", "R73", "R74", "R75", "R76", "R77", "R78", "R79", "R80", "R81"];
const RETIRED = ["R1", "R13", "R15", "R18", "R25", "R44", "R53", "R67", "R68", "R69", "R6", "R36", "R45", "R50", "R51", "R58", "R71"];
/* attempt 4 (T53): the marks this attempt met and struck, each with its test (t53-action, t53-request, t53-hold-dash-new) */
const MET_T53 = ["R60", "R61", "R63", "R64", "R65", "R66", "R70", "R72", "R73", "R74", "R76", "R77", "R79", "R80", "R81"];

test("consolidation: the ids are the start commit's, in order, each once", () => {
  const ids = lines(read("build/requirements/screens-action.md")).map(idOf);
  // F1 (found, attempt 3: action-grammar R31's shape) follows the start's R ids
  assert.deepEqual(ids, [...START_IDS, "F1"]);
});

test("consolidation: the unmet marks are the start's, less the lines retired to screens-plan and screens-matter and those attempt 4 met", () => {
  const t = read("build/requirements/screens-action.md");
  const unmet = lines(t).filter((l) => /\*\(not yet met/.test(l)).map(idOf);
  assert.deepEqual(unmet, START_UNMET.filter((id) => !RETIRED.includes(id) && !MET_T53.includes(id)));
});

test("consolidation: the moved-out text is in the notes, not the requirements", () => {
  const t = read("build/requirements/screens-action.md");
  const notes = read("docs/requirements-notes/screens-action.md");
  for (const s of ["**Size (P6).**", "Rules for the block.", "### Suggestions", "### Satisfies"]) assert.ok(!t.includes(s), s);
  for (const s of ["**Size (P6).**", "Rules for the block.", "## Suggestions", "## Satisfies", "New in T47 (T47-64"]) assert.ok(notes.includes(s), s);
});
