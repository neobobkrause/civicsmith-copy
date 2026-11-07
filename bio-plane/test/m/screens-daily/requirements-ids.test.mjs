/* screens-daily: the consolidation of build/requirements/screens-daily.md (REQ-6) moves no requirement. Every id at the start
   commit (84d87b4b, before the move) is still an id here, in order, each once, and the unmet marks are the start's; the
   moved text is in docs/requirements-notes/screens-daily.md. A mark struck later is taken out of START_UNMET with its test. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ROOT = new URL("../../../../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");
// The process's requirement line (util.mjs REQ_LINE): an id first on its line, after any indent and one list marker.
const lines = (t) => t.split("\n").filter((l) => /^[ \t]*(?:[-*+][ \t]+|\d+\.[ \t]+)?\*\*[RF][\w.-]+\*\*/.test(l));
const idOf = (l) => l.match(/\*\*([RF][\w.-]+)\*\*/)[1];

const START_IDS = [...Array.from({ length: 35 }, (_, i) => `R${i + 1}`), ...Array.from({ length: 116 - 37 }, (_, i) => `R${i + 38}`), "F2", "F3"];
const START_UNMET = ["R108", "R109", "R110", "R111", "R112", "R113", "R114", "R115", "R116", "F2"];
// Marks this job struck, each with its own test (F2: ops-held.test.mjs). F3 (attempt 3) was added met, with its tests in routed.test.mjs.
const STRUCK = ["F2"];

test("consolidation: the ids are the start commit's, in order, each once", () => {
  assert.deepEqual(lines(read("build/requirements/screens-daily.md")).map(idOf), START_IDS);
});

test("consolidation: the unmet marks are the start's, less those this job struck", () => {
  const unmet = lines(read("build/requirements/screens-daily.md")).filter((l) => l.includes("*(not yet met")).map(idOf);
  assert.deepEqual(unmet, START_UNMET.filter((id) => !STRUCK.includes(id)));
});

test("consolidation: the moved-out text is in the notes, not the requirements", () => {
  const t = read("build/requirements/screens-daily.md");
  const notes = read("docs/requirements-notes/screens-daily.md");
  for (const s of ["**Size (P6).**", "New in T46 (T46-57", "### Uses", "### Satisfies", "### Suggestions", "R36 and R37 were withdrawn", "Words rule (R34) stands"]) assert.ok(!t.includes(s), s);
  for (const s of ["**Size (P6).**", "New in T46 (T46-57", "### Uses", "### Satisfies", "### Suggestions", "R36 and R37 were withdrawn", "Words rule (R34) stands"]) assert.ok(notes.includes(s), s);
});
