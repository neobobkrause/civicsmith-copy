/* queue-producers: the requirements file's consolidation under the cap (T53) changed no requirement. The ids and the
   unmet marks below are those of build/requirements/queue-producers.md at the job's start commit (8a34b922), read by
   the coverage check's rule (requirements README convention 5: `**Rn**` first on its line); the moved text lives in
   docs/requirements-notes/queue-producers.md. A later job that strikes a mark adds it to STRUCK with the strike. F ids
   (found marks) may be added by a later job, so they are admitted, each once, never pinned. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FILE = fileURLToPath(new URL("../../../../build/requirements/queue-producers.md", import.meta.url));
const CAP = 70000;

const START_IDS = ("R8 R1 R2 R3 R9 R10 R14 R15 R16 R17 R18 R19 R29 R30 R31 R20 R21 R22 R23 R24 R25 R28 R26 R27 R4 R5 " +
  "R6 R7 R32 R33 R34 R35 R37 R38 R39 R40 R41 R42 R43 R44 R45 R46 R47 R48 R49 R50 R51 R52 R53 R54 R56 R57 R58 R59 R60 " +
  "R61 R36 R11 R12 R13 R55").split(" ");
const START_UNMET = Object.fromEntries("R56 R57 R58 R59 R60 R61".split(" ").map((id) => [id, "T53"]));
/* The marks this module's jobs have struck since the start commit. */
const STRUCK = ["R56", "R60", "R61", "R57"];
const START_RETIRED = "R3 R15 R16 R17 R18 R19 R29 R20 R21 R22 R26 R27".split(" ");

const read = () => readFileSync(FILE, "utf8");
const idLines = (text) => text.split("\n").map((l) => l.match(/^\s*- \*\*([RF]\d+)\*\*(.*)$/)).filter(Boolean);
const rLines = (text) => idLines(text).filter((m) => m[1].startsWith("R"));

test("consolidation: the requirements file holds exactly the ids it held at the start commit, in the same order", () => {
  assert.deepEqual(rLines(read()).map((m) => m[1]), START_IDS);
});

test("consolidation: the unmet marks are those of the start commit less those struck, each on its own id's line", () => {
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
