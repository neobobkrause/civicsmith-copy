/* file-safety: the requirements file's consolidation under the cap (T53) changed no requirement. The ids and the unmet marks
   below are those of build/requirements/file-safety.md at the job's start commit (9df28aa2), read by the coverage check's
   rule (requirements README convention 5: `**Rn**` first on its line); the moved text (the Status line's change history and
   the Suggestions) lives in docs/requirements-notes/file-safety.md. The one mark struck since is R45's (`T53: R60`): R60 is
   met (picture.test.mjs), so a PNG or a JPEG answers a picture, as R45's control says. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FILE = fileURLToPath(new URL("../../../../build/requirements/file-safety.md", import.meta.url));
const CAP = 70000;

const START_IDS = ("R1 R2 R3 R4 R5 R46 R47 R49 R50 R51 R6 R7 R8 R9 R10 R11 R12 R43 R13 R14 R36 R15 R16 R17 R18 R19 R38 R20 " +
  "R27 R28 R29 R30 R31 R32 R33 R34 R41 R35 R39 R40 R42 R42a R21 R44 R45 R48 R52 R53 R54 R55 R56 R60 R61 R62 R63 R64 R65 " +
  "R66 R67 R68 R69 R70 R71 R22 R23 R24 R25 R26 R37 R57 R58 R59").split(" ");
const START_UNMET = { R11: "T53: R60, R66, R70", R45: "T53: R60", R66: "T53" };
const STRUCK = new Set(["R45"]);

const read = () => readFileSync(FILE, "utf8");
const idLines = (text) => text.split("\n").map((l) => l.match(/^\s*- \*\*([RF]\d+[a-z]?)\*\*(.*)$/)).filter(Boolean);

test("consolidation: the requirements file holds exactly the ids it held at the start commit, in the same order", () => {
  assert.deepEqual(idLines(read()).map((m) => m[1]), START_IDS);
});

test("consolidation: the unmet marks are those of the start commit, each on its own id's line, less only the one struck", () => {
  const marks = {};
  for (const [, id, rest] of idLines(read())) {
    const m = rest.match(/\*\(not yet met: ([^)]*)\)\*/);
    if (m) marks[id] = m[1];
  }
  const want = Object.fromEntries(Object.entries(START_UNMET).filter(([id]) => !STRUCK.has(id)));
  assert.deepEqual(marks, want);
});

test("consolidation: the requirements file is under the cap, and the moved text is in the notes", () => {
  const n = Buffer.byteLength(read(), "utf8");
  assert.ok(n <= CAP, `${n} bytes`);
  const notes = readFileSync(fileURLToPath(new URL("../../../../docs/requirements-notes/file-safety.md", import.meta.url)), "utf8");
  assert.match(notes, /Last changed T53 \(BOB #325/);
  assert.match(notes, /The structure check reuses the readers' `structure\(\)` answers/);
});
