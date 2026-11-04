/* control-plane (job control-plane, attempt 1; the consolidation under the requirements cap): moving the non-requirement text of
   `build/requirements/control-plane.md` to `docs/requirements-notes/control-plane.md` changes no requirement. The ids and the
   unmet marks below are those of the file at the job's start commit (375755c2); where the checkout holds that commit, every
   R and F line is also compared with it verbatim. A mark struck by a later job removes its id from UNMET_AT_START here. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const FILE = "build/requirements/control-plane.md";
const START = "375755c2";
const IDS_AT_START = ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10", "R11", "R12", "R13", "R14", "R15", "R16", "R17", "R18", "R19", "R20", "R44", "R45", "R21", "R22", "R23", "R24", "R25", "R34", "R35", "R42", "R36", "R37", "R38", "R39", "R46", "R47", "R48", "R49", "R50", "R51", "R52", "R53", "R40", "R54", "R55", "R56", "R57", "R43", "R41", "R58", "R59", "R60", "R61", "R62", "R63", "R64", "R65", "R66", "R67", "R68", "R69", "R70", "R71", "R72", "R73", "R74", "R75", "R76", "R77", "R78", "R79", "R80", "R81", "R26", "R27", "R82", "R83", "R84", "R85", "R86", "R87", "R88", "R89", "R90", "R91", "R92", "R93", "R94", "R95", "R96", "R97", "R98", "R99", "R100", "R101", "R102", "R103", "R104", "R105", "R106", "R107", "R108", "R109", "R110", "R111", "R112", "R113", "R114", "R115", "R116", "R117", "R118", "R119", "R121", "R122", "R123", "R124", "R125", "R120", "R127", "R128", "R129", "R130", "R131", "R132", "R133", "R134", "R135", "R136", "R137", "R138", "R139", "R140", "R28", "R29", "R30", "R31", "R32", "R33", "R126"];
const UNMET_AT_START = ["R64", "R72", "R74", "R107", "R140", "R29"];

const LINE = /^- \*\*([RF]\d+)\*\*( \*\(not yet met[^*]*\)\*)?/;
const linesOf = (text) => text.split("\n").filter((l) => LINE.test(l));
const now = readFileSync(new URL(FILE, `file://${ROOT}`), "utf8");

test("consolidation: the requirement ids of control-plane.md are those at the start commit, in order", () => {
  assert.deepEqual(linesOf(now).map((l) => LINE.exec(l)[1]), IDS_AT_START);
});

test("consolidation: the unmet marks of control-plane.md are those at the start commit", () => {
  assert.deepEqual(linesOf(now).filter((l) => LINE.exec(l)[2]).map((l) => LINE.exec(l)[1]), UNMET_AT_START);
});

test("consolidation: every R/F line is verbatim as at the start commit (where the checkout holds it)", (t) => {
  let then;
  try { then = execFileSync("git", ["show", `${START}:${FILE}`], { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 26 }).toString(); }
  catch { t.skip(`${START} is not in this checkout`); return; }
  assert.deepEqual(linesOf(now), linesOf(then));
});
