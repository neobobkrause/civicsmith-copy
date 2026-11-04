/* ai-runs: the requirements file's consolidation under the cap (T53) changed no requirement. The ids and the unmet marks
   below are those of build/requirements/ai-runs.md at the job's start commit (9fa7b50f), read by the coverage check's
   rule (requirements README convention 5: `**Rn**` first on its line); the moved text lives in
   docs/requirements-notes/ai-runs.md. A later job that strikes a mark removes it from START_UNMET with the strike.
   (coordinator 23:05) The R ids, the retired block and the unmet R marks are pinned to the start; a found mark (`**Fn**`)
   may be added by a later job, so F ids and their marks are admitted, each once, never pinned. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FILE = fileURLToPath(new URL("../../../../build/requirements/ai-runs.md", import.meta.url));
const CAP = 70000;

const START_IDS = ("R1 R2 R3 R4 R5 R6 R7 R8 R9 R10 R40 R46 R47 R11 R12 R45 R13 R14 R15 R16 R17 R41 R18 R19 R20 R21 " +
  "R22 R23 R24 R25 R26 R27 R28 R29 R30 R42 R43 R44 R48 R49 R50 R51 R52 R72 R73 R74 R75 R76 R77 R78 R79 R80 R81 R82 " +
  "R83 R84 R85 R86 R87 R88 R89 R91 R92 R93 R94 R95 R96 R97 R98 R99 R100 R101 R102 R103 R104 R105 R106 R107 R31 R32 " +
  "R33 R34 R35 R36 R37 R38 R39 R54 R53 R90").split(" ");
const START_UNMET = Object.fromEntries(("R9 R10 R40 R12 R18 R19 R28 R52 R72 R75 R76 R78 R83 R84 R88 R91 R92 R93 R94 " +
  "R95 R96 R97 R98 R99 R100 R101 R102 R103 R104 R105 R106 R107 R54 R90").split(" ").map((id) => [id, "T53"]));
/* The marks this module's jobs have struck since the start commit (T53: ai-runs' T53 job), each removed from the unmet
   set the file must hold. */
const STRUCK = ("R9 R10 R12 R18 R19 R28 R78 R72 R88 R99 R100 R54 R76 " +
  "R52 R83 R84 R90 R91 R92 R93 R94 R95 R96 R97 R98 R101 R102 R103 R104 R105 R107").split(" ");
const START_RETIRED = "R1 R2 R3 R4 R5 R6 R7 R8 R44 R48 R49 R50 R51 R79 R80".split(" ");

const read = () => readFileSync(FILE, "utf8");
const idLines = (text) => text.split("\n").map((l) => l.match(/^\s*- \*\*([RF]\d+)\*\*(.*)$/)).filter(Boolean);
const rLines = (text) => idLines(text).filter((m) => m[1].startsWith("R"));

test("consolidation: the requirements file holds exactly the ids it held at the start commit, in the same order", () => {
  assert.deepEqual(rLines(read()).map((m) => m[1]), START_IDS);
});

test("consolidation: the unmet marks are those of the start commit, each on its own id's line", () => {
  const marks = {};
  for (const [, id, rest] of rLines(read())) {
    const m = rest.match(/\*\(not yet met: ([^)]*)\)\*/);
    if (m) marks[id] = m[1];
  }
  assert.deepEqual(marks, Object.fromEntries(Object.entries(START_UNMET).filter(([id]) => !STRUCK.includes(id))));
});

test("consolidation: the retired ids stay retired", () => {
  const retired = rLines(read()).filter(([, , rest]) => /^\s*\*\(retired/.test(rest)).map((m) => m[1]);
  assert.deepEqual(retired, START_RETIRED);
});

test("found marks: F ids are admitted beside the pinned R ids, each id once", () => {
  const fs = idLines(read()).map((m) => m[1]).filter((id) => id.startsWith("F"));
  assert.equal(new Set(fs).size, fs.length, `an F id repeats: ${fs.join(" ")}`);
});

test("consolidation: the requirements file is under the cap", () => {
  assert.ok(Buffer.byteLength(read(), "utf8") <= CAP, `${Buffer.byteLength(read(), "utf8")} bytes`);
});
