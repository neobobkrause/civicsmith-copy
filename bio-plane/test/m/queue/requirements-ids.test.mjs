/* queue: the requirements file's consolidation under the cap (attempt 3, T53) changed no requirement. The ids and the unmet
   marks below are those of build/requirements/queue.md at the job's start commit (fea1fb04), read by the coverage check's
   rule (requirements README convention 5: `**Rn**` first on its line); the moved text lives in
   docs/requirements-notes/queue.md. A mark this job meets is struck and named in STRUCK; no other mark changes. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FILE = fileURLToPath(new URL("../../../../build/requirements/queue.md", import.meta.url));
const CAP = 70000;

const START_IDS = ("R1 R2 R3 R4 R5 R6 R48 R49 R7 R8 R51 R9 R10 R11 R12 R13 R14 R15 R39 R40 R16 R17 R18 R54 R53 R19 R20 " +
  "R21 R22 R23 R24 R25 R26 R27 R28 R29 R41 R42 R43 R44 R45 R46 R50 R52 R47 R55 R56 R57 R58 R59 R60 R61 R91 R92 R93 R94 " +
  "R95 R30 R31 R32 R33 R34 R35 R36 R37 R38 R96 R97 R98 R99").split(" ");
const START_UNMET = { R97: "T53", R99: "T53" };
const STRUCK = ["R97"];

const read = () => readFileSync(FILE, "utf8");
const idLines = (text) => text.split("\n").map((l) => l.match(/^\s*- \*\*([RF]\d+)\*\*(.*)$/)).filter(Boolean);

test("consolidation: the requirements file holds exactly the ids it held at the start commit, in the same order", () => {
  assert.deepEqual(idLines(read()).map((m) => m[1]), START_IDS);
});

test("consolidation: the unmet marks are those of the start commit less the ones this job struck", () => {
  const marks = {};
  for (const [, id, rest] of idLines(read())) {
    const m = rest.match(/\*\(not yet met: ([^)]*)\)\*/);
    if (m) marks[id] = m[1];
  }
  const want = Object.fromEntries(Object.entries(START_UNMET).filter(([id]) => !STRUCK.includes(id)));
  assert.deepEqual(marks, want);
});

test("consolidation: the requirements file is under the cap", () => {
  const n = Buffer.byteLength(read(), "utf8");
  assert.ok(n <= CAP, `${n} bytes`);
});
