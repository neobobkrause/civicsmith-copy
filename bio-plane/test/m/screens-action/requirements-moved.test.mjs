/* screens-action -> screens-plan (PR 111, accepted by the coordinator 4 Nov 2026): every id moved exists in
   screens-plan's file, saying where it came from, and every id retired here names it. Ids stay traceable. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ROOT = new URL("../../../../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");
const line = (t, id) => t.split("\n").find((l) => new RegExp(`^\\s*- \\*\\*${id}\\*\\*`).test(l));

const MOVED = { R1: "R1", R13: "R2", R15: "R3", R18: "R4", R25: "R5", R44: "R6", R53: "R7", R67: "R8", R68: "R9", R69: "R10" };

test("split: each moved id is in screens-plan, saying it moved from screens-action", () => {
  const plan = read("build/requirements/screens-plan.md");
  for (const [old, now] of Object.entries(MOVED)) {
    const l = line(plan, now);
    assert.ok(l, `screens-plan ${now}`);
    assert.ok(l.includes(`(moved from screens-action:${old})`), `${now} names screens-action:${old}`);
  }
});

test("split: each moved id is retired here, naming its new id, and keeps no requirement text", () => {
  const t = read("build/requirements/screens-action.md");
  for (const [old, now] of Object.entries(MOVED)) {
    assert.equal(line(t, old), `- **${old}** *(retired: moved to screens-plan:${now})*`, old);
  }
});

test("split: only the moved ids are retired here", () => {
  const t = read("build/requirements/screens-action.md");
  const retired = t.split("\n").filter((l) => /^\s*- \*\*R\d+\*\* \*\(retired/.test(l)).map((l) => l.match(/\*\*(R\d+)\*\*/)[1]);
  assert.deepEqual(retired, Object.keys(MOVED));
});
