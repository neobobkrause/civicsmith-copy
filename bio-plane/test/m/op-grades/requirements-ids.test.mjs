/* op-grades: the requirements file's consolidation and split (T53) changed no requirement. The ids and the unmet marks below
   are those of build/requirements/op-grades.md at the job's start commit (d6358257), read by the coverage check's rule
   (requirements README convention 5: `**Rn**` first on its line). The non-requirement text moved to
   docs/requirements-notes/op-grades.md; R13, R17, R21–R25, R27–R41, R43, R45, R47 and R48 moved, verbatim and under the same
   numbers, to build/requirements/op-grades-folds.md (BOB's phase A, PR 369). Both files are under the cap. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const at = (rel) => fileURLToPath(new URL(`../../../../${rel}`, import.meta.url));
const FILE = at("build/requirements/op-grades.md");
const FOLDS = at("build/requirements/op-grades-folds.md");
const CAP = 70000;

const START_IDS = ("R1 R2 R3 R4 R5 R6 R7 R8 R9 R10 R11 R12 R13 R14 R15 R16 R17 R18 R21 R22 R23 R24 R25 R26 R27 R28 R29 " +
  "R30 R31 R32 R33 R34 R35 R36 R37 R38 R39 R40 R41 R42 R43 R44 R45 R46 R47 R48 R49 R50 R51 R54 R55 R56 R57 R58 R19 R20 " +
  "R52 R53").split(" ");
const START_UNMET = {
  R46: "T52", R55: "T53", R56: "T53", R57: "T53", R58: "T53; R92's grades are BOB's recommendations",
};
const MOVED = ("R13 R17 R21 R22 R23 R24 R25 R27 R28 R29 R30 R31 R32 R33 R34 R35 R36 R37 R38 R39 R40 R41 R43 R45 R47 R48").split(" ");

const read = (f) => readFileSync(f, "utf8");
const idLines = (text) => text.split("\n").map((l) => l.match(/^\s*- \*\*([RF]\d+)\*\*(.*)$/)).filter(Boolean);
const marksOf = (texts) => {
  const marks = {};
  for (const t of texts) for (const [, id, rest] of idLines(t)) {
    const m = rest.match(/not yet met: ([^)]*)\)\*/);
    if (m) marks[id] = m[1];
  }
  return marks;
};
const numeric = (ids) => [...ids].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

test("split: the two files hold together exactly the ids op-grades held at the start commit, each once", () => {
  const here = idLines(read(FILE)).map((m) => m[1]);
  const folds = idLines(read(FOLDS)).map((m) => m[1]);
  assert.deepEqual(numeric([...here, ...folds]), numeric(START_IDS));
  assert.deepEqual(folds, MOVED, "the folds hold the moved ids, in their order");
  assert.deepEqual(here, START_IDS.filter((id) => !MOVED.includes(id)), "op-grades keeps the rest, in their order");
});

test("split: the unmet marks across the two files are those of the start commit, each on its own id's line, the met ones struck", () => {
  const marks = marksOf([read(FILE), read(FOLDS)]);
  /* a mark this job meets is struck from op-grades' line (R55–R58); none other changes */
  for (const [id, m] of Object.entries(marks)) assert.equal(m, START_UNMET[id], id);
  for (const id of Object.keys(START_UNMET).filter((id) => !(id in marks))) assert.match(id, /^R5[5-8]$/, `${id} was struck`);
});

test("consolidation: the moved text is kept in the notes file", () => {
  const notes = read(at("docs/requirements-notes/op-grades.md"));
  for (const lead of ["**Status** · In force: split from `affordances`", "## Satisfies", "**N891 (T45-38;"]) assert.ok(notes.includes(lead), lead);
  assert.ok(!read(FILE).includes("**N891 (T45-38;"), "N891 left the requirements file");
});

test("the cap: both requirement files are under 70000 bytes", () => {
  for (const f of [FILE, FOLDS]) assert.ok(Buffer.byteLength(read(f)) < CAP, `${f}: ${Buffer.byteLength(read(f))}`);
});
