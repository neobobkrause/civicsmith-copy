/* case-authoring: the requirements file's consolidation (T53) changed no requirement. The ids, their order and the unmet
   marks below are those of build/requirements/case-authoring.md at the job's start commit (a1172241), read by the coverage
   check's rule (requirements README convention 5: `**Rn**` first on its line). The non-requirement text (the Status
   history, Size, Satisfies, Open for Bob, BOB's decisions, the old ids) moved word for word to
   docs/requirements-notes/case-authoring.md. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const at = (rel) => fileURLToPath(new URL(`../../../../${rel}`, import.meta.url));
const FILE = at("build/requirements/case-authoring.md");
const NOTES = at("docs/requirements-notes/case-authoring.md");
const CAP = 70000;

const START_IDS = ("R1 R2 R3 R4 R5 R6 R7 R8 R9 R10 R11 R12 R13 R14 R15 R16 R17 R18 R19 R20 R21 R31 R32 R34 R35 R36 R37 " +
  "R77 R78 R79 R80 R81 R82 R83 R84 R85 R86 R87 R88 R89 R90 R91 R22 R23 R24 R25 R26 R27 R28 R29 R30 R33 R38 R39 R40 " +
  "R41 R42 R43 R44 R45 R46 R47 R48 R49 R50 R51 R52 R53 R54 R55 R56 R57 R58 R59 R60 R61 R62 R63 R64 R65 R66 R67 R68 " +
  "R69 R70 R71 R74 R73 R75 R76 R72 F2").split(" ");
const START_UNMET = { R88: "T53", R89: "T53", R90: "T53" };
/* the marks this job meets, struck from their lines; no other mark changes */
const STRUCK = ["R88", "R89", "R90"];

const read = (f) => readFileSync(f, "utf8");
const idLines = (text) => text.split("\n").map((l) => l.match(/^\s*- \*\*([RF]\d+)\*\*(.*)$/)).filter(Boolean);
const marksOf = (text) => Object.fromEntries(idLines(text).map(([, id, rest]) => [id, rest.match(/not yet met: ([^)]*)\)\*/)])
  .filter(([, m]) => m).map(([id, m]) => [id, m[1]]));

test("consolidation: the requirements file holds exactly the ids it held at the start commit, each once, in their order", () => {
  assert.deepEqual(idLines(read(FILE)).map((m) => m[1]), START_IDS);
});

test("consolidation: the unmet marks are those of the start commit, the met ones struck, none added", () => {
  const marks = marksOf(read(FILE));
  for (const [id, m] of Object.entries(marks)) assert.equal(m, START_UNMET[id], id);
  for (const id of Object.keys(START_UNMET).filter((id) => !(id in marks))) assert.ok(STRUCK.includes(id), `${id} was struck`);
});

test("consolidation: the moved text is kept in the notes file and left the requirements file; no requirement line is in the notes", () => {
  const notes = read(NOTES), file = read(FILE);
  for (const lead of ["**Status** · In force: approved by Bob 2026-09-26 (K102)", "**Size (P6).** About 3,340 lines move",
                      "- DEC-101 (1)(2) and `BIO_Publication_v0_1.md` §5A", "None: answered by Bob 2026-09-26 (K102).",
                      "1. `searchedSection` and `SEARCHED_LEVEL_OUTCOMES`", "R1–R21 → R1–R21, unchanged; R52 → R22"]) {
    assert.ok(notes.includes(lead), lead);
    assert.ok(!file.includes(lead), `left the requirements file: ${lead}`);
  }
  assert.deepEqual(idLines(notes), []);
});

test("the cap: the requirements file is under 70000 bytes", () => {
  assert.ok(Buffer.byteLength(read(FILE)) < CAP, String(Buffer.byteLength(read(FILE))));
});
