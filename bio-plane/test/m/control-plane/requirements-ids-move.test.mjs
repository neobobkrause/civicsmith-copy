/* control-plane requirements (BOB's START, attempt 4: the consolidation under the requirements cap, REQ-6): moving text out of
   `build/requirements/control-plane.md` into `docs/requirements-notes/control-plane.md` changes no requirement. The set of
   ids (every `**R<n>**` and `**F<n>**` line) and each id's unmet mark are those the file held at this job's start commit
   (be9fe901), frozen below; the one mark this job strikes, F2 (met: the seam table names no deleted file), is the only
   difference. A retired id stays an id. Ids and marks only: wording is the notes file's to carry. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const FILE = new URL("../../../../build/requirements/control-plane.md", import.meta.url);

/** Each id of the file with the unmet marks on its line and the indented lines under it, in file order. */
export function idsAndMarks(text) {
  const out = new Map();
  let cur = null;
  for (const line of text.split("\n")) {
    const m = /^- \*\*([RF]\d+)\*\*/.exec(line);
    if (m) {
      cur = m[1];
      if (out.has(cur)) throw new Error(`${cur} is written twice`);
      out.set(cur, []);
    } else if (!/^  /.test(line)) cur = null;
    if (cur) for (const k of line.matchAll(/\*\(not yet met[^)]*(?:\([^)]*\)[^)]*)*\)\*/g)) out.get(cur).push(k[0]);
  }
  return out;
}

const START_IDS = Object.freeze([
  "F1", "F2", "R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10", "R11", "R12",
  "R13", "R14", "R15", "R16", "R17", "R18", "R19", "R20", "R21", "R22", "R23", "R24", "R25", "R26",
  "R27", "R28", "R29", "R30", "R31", "R32", "R33", "R34", "R35", "R36", "R37", "R38", "R39", "R40",
  "R41", "R42", "R43", "R44", "R45", "R46", "R47", "R48", "R49", "R50", "R51", "R52", "R53", "R54",
  "R55", "R56", "R57", "R58", "R59", "R60", "R61", "R62", "R63", "R64", "R65", "R66", "R67", "R68",
  "R69", "R70", "R71", "R72", "R73", "R74", "R75", "R76", "R77", "R78", "R79", "R80", "R81", "R82",
  "R83", "R84", "R85", "R86", "R87", "R88", "R89", "R90", "R91", "R92", "R93", "R94", "R95", "R96",
  "R97", "R98", "R99", "R100", "R101", "R102", "R103", "R104", "R105", "R106", "R107", "R108", "R109", "R110",
  "R111", "R112", "R113", "R114", "R115", "R116", "R117", "R118", "R119", "R120", "R121", "R122", "R123", "R124",
  "R125", "R126", "R127", "R128", "R129", "R130", "R131", "R132", "R133", "R134", "R135", "R136", "R137", "R138",
  "R139", "R140",
]);
const START_UNMET = Object.freeze({
  R64: "*(not yet met: T52)*",
  R72: "*(not yet met: T52)*",
  R74: "*(not yet met: T52)*",
  R100: "*(not yet met: T52)*",
  R107: "*(not yet met: T52)*",
  R123: "*(not yet met: T52)*",
  R124: "*(not yet met: T52)*",
  R125: "*(not yet met: T52)*",
  R120: "*(not yet met: T52)*",
  R128: "*(not yet met: T52)*",
  R130: "*(not yet met: T52)*",
  R133: "*(not yet met: T52)*",
  R134: "*(not yet met: T52)*",
  R135: "*(not yet met: T52)*",
  R139: "*(not yet met: T53)*",
  R140: "*(not yet met: T53)*",
  R29: "*(not yet met: T52)*",
});

test("requirements consolidation: build/requirements/control-plane.md holds exactly the ids it held at the job's start, each written once", () => {
  const ids = [...idsAndMarks(readFileSync(FILE, "utf8")).keys()];
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...ids].sort(), [...START_IDS].sort());
});

test("requirements consolidation: each id's unmet mark is the one it had at the job's start (F2 struck as met), verbatim", () => {
  const now = idsAndMarks(readFileSync(FILE, "utf8"));
  const unmet = Object.fromEntries([...now].filter(([, marks]) => marks.length).map(([id, marks]) => [id, marks.join(" ")]));
  assert.deepEqual(unmet, { ...START_UNMET });
});

test("requirements consolidation (control): the reader finds a dropped id, a second copy and a changed mark", () => {
  const text = readFileSync(FILE, "utf8");
  assert.equal(idsAndMarks(text.replace(/^- \*\*R140\*\*.*\n/m, "")).has("R140"), false);
  assert.throws(() => idsAndMarks(text + "\n- **R1** again\n"), /R1 is written twice/);
  assert.notDeepEqual(idsAndMarks(text.replace("*(not yet met: T53)*", "*(not yet met: T54)*")).get("R139"), idsAndMarks(text).get("R139"));
});
