/* provenance: the requirements file's consolidation under the cap (T53) changed no requirement. The ids and the unmet marks
   below are those of build/requirements/provenance.md at the job's start commit (0f7f5235), read by the coverage check's
   rule (requirements README convention 5: `**Rn**` first on its line); the moved text lives in
   docs/requirements-notes/provenance.md. At the start commit no id carried a `(not yet met: …)` mark. R85 (CR2-6,
   BD-18) was added after, by the reopen that met it. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as provenance from "../../../src/provenance/index.mjs";
import { EARNED_CAPTURE_CEILING } from "../../../src/record-grammar/index.mjs";

const FILE = fileURLToPath(new URL("../../../../build/requirements/provenance.md", import.meta.url));
const CAP = 70000;

const START_IDS = ("R1 R2 R3 R4 R5 R6 R7 R8 R9 R10 R11 R12 R13 R14 R15 R47 R16 R60 R61 R17 R18 R19 R20 R21 R22 R23 " +
  "R24 R25 R26 R27 R51 R59 R28 R52 R29 R30 R64 R70 R80 R81 R65 R66 R67 R31 R32 R33 R34 R56 R57 R48 R53 R68 R69 R54 " +
  "R49 R50 R55 R58 R62 R63 R73 R74 R75 R76 R77 R78 R79 R82 R83 R84 R85 R35 R36 R37 R38 R39 R40 R41 R42 R43 R44 R45 R46 " +
  "R71 R72").split(" ");
const START_UNMET = {};

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

test("R85 (added after the start, CR2-6): each name it says the module exports is exported, and ARCHIVE_CAPTURE_GRADE is the ceiling as it states", () => {
  const line = idLines(read()).find((m) => m[1] === "R85");
  assert.ok(line, "R85 is in the file");
  for (const name of ["ARCHIVE_CAPTURE_GRADE", "REWRITTEN_REPLAY_GRADE", "rawReplayOf"]) {
    assert.match(line[2], new RegExp(`\x60${name}[\x60(]`), `R85 names ${name}`);
    assert.notEqual(provenance[name], undefined, `the module exports ${name}`);
  }
  assert.equal(provenance.ARCHIVE_CAPTURE_GRADE, EARNED_CAPTURE_CEILING);
});
