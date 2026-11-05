/* screens-inquiry: the requirements file's consolidation (job screens-inquiry, 4 Nov 2026) changed no requirement. The
   ids, the unmet marks and the retired ids below are those of build/requirements/screens-inquiry.md at the job's start
   commit (125a6b13), read by the coverage check's rule (requirements README convention 5: `**Rn**` first on its line);
   the moved text lives in docs/requirements-notes/screens-inquiry.md. A job that strikes a mark adds its id to STRUCK. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const FILE = fileURLToPath(new URL("../../../../build/requirements/screens-inquiry.md", import.meta.url));
const NOTES = fileURLToPath(new URL("../../../../docs/requirements-notes/screens-inquiry.md", import.meta.url));
const CAP = 70000;

const START_IDS = ("R1 R2 R3 R4 R6 R7 R5 R8 R9 R10 R11 R12 R13 R14 R15 R16 R17 R18 R19 R20 R21 R22 R23 R24 R25 R26 R27 R28 " +
  "R29 R30 R31 R32 R33 R34 R35 R36 R37 R38 R39 R40 R41 R42 R43 R44 R45 R46 R47 R48 R49 R50 R51 R52 R53 R54 R55 R56 R57 R58 " +
  "R59 R60 R61 R62 R63 R64 R65 R66 R67 R68 R69 R70 R71 R72 R73 R74 R75 R76 R77 R78 R79 R80 R81 R82 R83 R84 R85 R86 R87 R88 " +
  "R89 R90 R91 R92 R93 R94 R95 R96 R97 R98 R99 R100 R101 R102 R103 R104 R105 R106 R107 R108 R109 R110 R111 R112 R113 R114 " +
  "R115 R116 R117 R118 R119 R120 R121 R122 R123 R124 R125 R126 R127 R128 R129 R130 R131 R132 R133 R134 R135 R136 R137 R138 " +
  "R139 R140 R141 R142 R143 R144 R145 R146 R147 R148 R149 R150 R151 R152 R153").split(" ");
const START_UNMET = Object.fromEntries("R140 R141 R142 R143 R144 R145 R146 R147 R148 R149 R150 R151 R152 R153".split(" ").map((id) => [id, "T53"]));
/* the found marks this module's jobs have added since the start commit, after the start's ids (F1: attempt 5's base-red R10 test) */
const FOUND = ["F1"];
/* the marks this module's jobs have struck since the start commit */
const STRUCK = ["R153"];
const START_RETIRED = ("R3 R14 R15 R22 R32 R37 R49 R55 R61 R65 R66 R67 R68 R69 R80 R81 R82 R83 R84 R85 R86 R92 R93 R95 R96 " +
  "R97 R98 R99 R100 R108 R111 R112 R113 R118 R119 R123 R124 R125 R126 R127 R129 R130 R131 R132 R133 R134 R135 R136 R137 R138").split(" ");
/* sha256 over every id's block (its line and its indented text), unmet marks taken out, at the start commit */
const START_BLOCKS = "79bcd15ece8db80eb5a6ec1e9f3e0bf04d4398dbb90326f6cdfd0ecd83595f84";

const read = () => readFileSync(FILE, "utf8");
function parse(text) {
  const ids = [], unmet = {}, retired = [], blocks = {};
  let cur = null;
  for (const l of text.split("\n")) {
    const m = /^- \*\*([RF]\d+)\*\*(.*)$/.exec(l);
    if (m) {
      cur = m[1]; ids.push(cur); blocks[cur] = [l];
      const u = /\*\(not yet met: ([^)]*)\)\*/.exec(m[2]);
      if (u) unmet[cur] = u[1];
      if (/^\s*\*\(retired|\(retired\)\*\s*$/.test(m[2])) retired.push(cur);
      continue;
    }
    if (cur && (/^\s+\S/.test(l) || l === "")) { blocks[cur].push(l); continue; }
    cur = null;
  }
  const h = createHash("sha256");
  for (const id of ids.filter((x) => !FOUND.includes(x))) h.update(id + "\n" + blocks[id].join("\n").replace(/ ?\*\(not yet met: [^)]*\)\*/g, "").trimEnd() + "\n\0");
  return { ids, unmet, retired, hash: h.digest("hex") };
}

test("consolidation: the requirements file holds exactly the ids it held at the start commit, in the same order", () => {
  assert.deepEqual(parse(read()).ids, [...START_IDS, ...FOUND]);
});

test("consolidation: the unmet marks are those of the start commit less the ones struck, each on its own id's line", () => {
  assert.deepEqual(parse(read()).unmet, Object.fromEntries(Object.entries(START_UNMET).filter(([id]) => !STRUCK.includes(id))));
});

test("consolidation: the retired ids stay retired", () => {
  assert.deepEqual(parse(read()).retired, START_RETIRED);
});

test("consolidation: every requirement's line and indented text is word for word the start commit's (marks aside)", () => {
  assert.equal(parse(read()).hash, START_BLOCKS);
});

test("consolidation: the whole-block rules keep their T52 mark, and the moved text is in the notes", () => {
  assert.match(read(), /^Rules for the whole block\. Every request an act below sends .*\*\(not yet met: T52\)\* applies to each line below\.$/m);
  const notes = readFileSync(NOTES, "utf8");
  for (const head of ["## Status", "## Size (P6)", "## Uses (from Private)", "## Satisfies", "## Suggestions"]) assert.ok(notes.includes(head), head);
  assert.doesNotMatch(notes, /^- \*\*[RF]\d+\*\*/m, "no requirement lives in the notes");
});

/* The requirement blocks alone are about 108 KB, so no move of other text brings the file under the cap: a split is
   proposed to BOB in docs/requirements-notes/screens-inquiry.md. */
test.todo(`consolidation: the requirements file is under the cap (${CAP} bytes): owed a split, BOB's`);
