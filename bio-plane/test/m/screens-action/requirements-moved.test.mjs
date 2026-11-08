/* screens-action -> screens-plan (PR 111) and -> screens-matter (PR 118), both accepted by the coordinator
   4 Nov 2026: every id moved exists in its new module's file, saying where it came from, with the unmet mark it
   had here, and every id retired here names it. Ids stay traceable. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ROOT = new URL("../../../../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");
const line = (t, id) => t.split("\n").find((l) => new RegExp(`^\\s*- \\*\\*${id}\\*\\*`).test(l));

const SPLITS = {
  "screens-plan": { R1: "R1", R13: "R2", R15: "R3", R18: "R4", R25: "R5", R44: "R6", R53: "R7", R67: "R8", R68: "R9", R69: "R10" },
  "screens-matter": { R6: "R1", R36: "R2", R45: "R3", R50: "R4", R51: "R5", R58: "R6", R71: "R7" },
};
const MOVED = Object.fromEntries(Object.entries(SPLITS).flatMap(([mod, ids]) => Object.entries(ids).map(([old, now]) => [old, `${mod}:${now}`])));
const ORDER = (ids) => ids.sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

for (const [mod, ids] of Object.entries(SPLITS)) {
  test(`split: each moved id is in ${mod}, saying it moved from screens-action`, () => {
    const there = read(`build/requirements/${mod}.md`);
    for (const [old, now] of Object.entries(ids)) {
      const l = line(there, now);
      assert.ok(l, `${mod} ${now}`);
      assert.ok(l.includes(`(moved from screens-action:${old})`), `${now} names screens-action:${old}`);
    }
  });
}

/* R71's mark travelled with it; screens-matter may since have met R7 and struck it (PR 863). A moved id's mark is the
   one it had here or none, never another. */
test("split: R71's unmet mark travelled with it to screens-matter:R7, or screens-matter struck it", () => {
  const marks = line(read("build/requirements/screens-matter.md"), "R7").match(/\*\(not yet met:[^)]*\)\*/g) ?? [];
  assert.ok(marks.length === 0 || (marks.length === 1 && marks[0] === "*(not yet met: T53)*"), `R7 marks: ${marks}`);
});

test("split: each moved id is retired here, naming its new id, and keeps no requirement text", () => {
  const t = read("build/requirements/screens-action.md");
  for (const [old, now] of Object.entries(MOVED)) {
    assert.equal(line(t, old), `- **${old}** *(retired: moved to ${now})*`, old);
  }
});

test("split: only the moved ids are retired here", () => {
  const t = read("build/requirements/screens-action.md");
  const retired = t.split("\n").filter((l) => /^\s*- \*\*R\d+\*\* \*\(retired/.test(l)).map((l) => l.match(/\*\*(R\d+)\*\*/)[1]);
  assert.deepEqual(retired, ORDER(Object.keys(MOVED)));
});
