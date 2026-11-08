/* affordances: the requirements file's consolidation under the cap (T53) changed no requirement. The ids and the unmet marks
   below are those of build/requirements/affordances.md at the job's start commit (0ab969c4), read by the coverage check's
   rule (requirements README convention 5: `**Rn**` first on its line); the moved text lives in
   docs/requirements-notes/affordances.md. F1 (attempt 4, met when added: act help holds no op T53 retired) and F2 (attempt 6, met when added: act help explains reading-guides' guideoptout once declared) and F3 (attempt 7, met when added: the tests admit op-grades R55's register machine refusals and rowexpunge's irreversible weight) are the ids added since. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FILE = fileURLToPath(new URL("../../../../build/requirements/affordances.md", import.meta.url));
const CAP = 70000;

const START_IDS = ("R1 R2 R3 R27 R31 R4 R5 R28 R29 R6 R7 R30 R32 R33 R34 R35 R36 R37 R38 R39 R40 R42 R43 R44 R46 R47 R45 R41 " +
  "R48 R53 R49 R50 R51 R52 R54 R55 R8 R9 R10 R11 R12 R13 R14 R15 R16 R26 R17 R56 R57 R58 R59 R60 R61 R62 R63 R64 R65 R66 " +
  "R67 R68 R69 R70 R72 R73 R74 R75 R18 R19 R20 R21 R22 R23 R24 R25 R71 F1 F2 F3").split(" ");
/* attempt 8 met R72, R73 and R74 (t53.test.mjs) and struck their marks; R75's write half is entities' and the screen's */
const START_UNMET = { R75: "T53" };

const read = () => readFileSync(FILE, "utf8");
const idLines = (text) => text.split("\n").map((l) => l.match(/^\s*- \*\*([RF]\d+)\*\*(.*)$/)).filter(Boolean);

test("consolidation: the requirements file holds exactly the ids it held at the start commit, in the same order", () => {
  assert.deepEqual(idLines(read()).map((m) => m[1]), START_IDS);
});

test("consolidation: the unmet marks are those of the start commit, each on its own id's line", () => {
  const marks = {};
  for (const [, id, rest] of idLines(read())) {
    const m = rest.match(/\*\(not yet met: ([^)]*)\)\*/);
    if (m) marks[id] = m[1];
  }
  assert.deepEqual(marks, START_UNMET);
});

test("consolidation: the requirements file is under the cap", () => {
  assert.ok(Buffer.byteLength(read(), "utf8") <= CAP, `${Buffer.byteLength(read(), "utf8")} bytes`);
});
