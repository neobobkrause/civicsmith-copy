/* op-grades: the requirements file's consolidation (T53) changed no requirement. The ids and the unmet marks below are
   those of build/requirements/op-grades.md at the job's start commit (d6358257), read by the coverage check's rule
   (requirements README convention 5: `**Rn**` first on its line); the moved text lives in docs/requirements-notes/op-grades.md.
   The file is still over the cap after the move (its requirement lines alone are about 86 KB), so the cap is a todo until
   BOB's split lands. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FILE = fileURLToPath(new URL("../../../../build/requirements/op-grades.md", import.meta.url));

const START_IDS = ("R1 R2 R3 R4 R5 R6 R7 R8 R9 R10 R11 R12 R13 R14 R15 R16 R17 R18 R21 R22 R23 R24 R25 R26 R27 R28 R29 " +
  "R30 R31 R32 R33 R34 R35 R36 R37 R38 R39 R40 R41 R42 R43 R44 R45 R46 R47 R48 R49 R50 R51 R54 R55 R56 R57 R58 R19 R20 " +
  "R52 R53").split(" ");
const START_UNMET = {
  R46: "T52", R55: "T53", R56: "T53", R57: "T53", R58: "T53; R92's grades are BOB's recommendations",
};

const read = () => readFileSync(FILE, "utf8");
const idLines = (text) => text.split("\n").map((l) => l.match(/^\s*- \*\*([RF]\d+)\*\*(.*)$/)).filter(Boolean);

test("consolidation: the requirements file holds exactly the ids it held at the start commit, in the same order", () => {
  assert.deepEqual(idLines(read()).map((m) => m[1]), START_IDS);
});

test("consolidation: the unmet marks are those of the start commit, each on its own id's line", () => {
  const marks = {};
  for (const [, id, rest] of idLines(read())) {
    const m = rest.match(/not yet met: ([^)]*)\)\*/);
    if (m) marks[id] = m[1];
  }
  assert.deepEqual(marks, START_UNMET);
});

test("consolidation: the moved text is kept in the notes file", () => {
  const notes = readFileSync(fileURLToPath(new URL("../../../../docs/requirements-notes/op-grades.md", import.meta.url)), "utf8");
  for (const lead of ["**Status** · In force: split from `affordances`", "## Satisfies", "**N891 (T45-38;"]) assert.ok(notes.includes(lead), lead);
  assert.ok(!read().includes("**N891 (T45-38;"), "N891 left the requirements file");
});

test.todo("the requirements file is under the 70000-byte cap (needs BOB's split; consolidation alone leaves about 91 KB)");
