/* The consolidation of build/requirements/control-plane.md (5 Nov 2026): its non-requirement text (status history,
   Size, the settled readings note, Uses, Satisfies, Suggestions, Open for Bob, Decided by BOB) moved word for word
   to docs/requirements-notes/control-plane.md. The set of requirement ids and the unmet marks are those of the start
   commit fc1494a3c, nothing added, dropped or struck by the move. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const req = (name) => readFileSync(new URL(`../../../../build/requirements/${name}.md`, import.meta.url), "utf8");
const PARENT = req("control-plane");
/* The split files (5 Nov 2026, coordinator rulings 17:20 and 18:05) hold their lines verbatim under the same
   numbers; the parent keeps one pointer line per run. The id set and unmet set are counted across all four. */
const SPLITS = ["control-plane-store-request", "control-plane-door-reading", "control-plane-door-pages"];
const FILE = [PARENT, ...SPLITS.map(req)].join("\n");
const NOTES = readFileSync(new URL("../../../../docs/requirements-notes/control-plane.md", import.meta.url), "utf8");
/* the R ids: found marks (F<n>) added after the move are not the move's */
const ID_LINE = /^- \*\*(R\d+)\*\*/;
const idLines = (s) => s.split("\n").filter((l) => ID_LINE.test(l));
const idOf = (l) => ID_LINE.exec(l)[1];
const unmetOf = (l) => (/\*\(not yet met:? ?([^)]*)\)\*/.exec(l) || [])[1] ?? null;
const byNumber = (a, b) => a.localeCompare(b, "en", { numeric: true });

/* At fc1494a3c (the start commit): R1 to R140 and these unmet marks. */
const START_IDS = Array.from({ length: 140 }, (_, i) => `R${i + 1}`);
const START_UNMET = {
  R29: "T52", R64: "T52", R72: "T52", R74: "T52", R100: "T52", R107: "T52", R120: "T52", R123: "T52", R124: "T52",
  R125: "T52", R128: "T52", R130: "T52", R133: "T52", R134: "T52", R135: "T52", R139: "T53", R140: "T53",
};

test("control-plane's requirement ids are the start commit's, each once: nothing added or dropped by the consolidation", () => {
  const ids = idLines(FILE).map(idOf);
  assert.equal(new Set(ids).size, ids.length, "no id twice");
  assert.deepEqual([...ids].sort(byNumber), START_IDS);
});

test("control-plane's unmet marks are the start commit's, none struck or added by the move", () => {
  const unmet = Object.fromEntries(idLines(FILE).filter((l) => unmetOf(l)).map((l) => [idOf(l), unmetOf(l)]));
  assert.deepEqual(unmet, START_UNMET);
});

test("the moved text holds no requirement line, and the requirements file keeps none of the moved sections", () => {
  assert.deepEqual(NOTES.split("\n").filter((l) => /^- \*\*[RF]\d+\*\*/.test(l)), []);
  for (const h of ["### Uses", "### Satisfies", "### Suggestions", "## Open for Bob", "## Decided by BOB", "**Size (P6).**"]) {
    assert.ok(!PARENT.split("\n").some((l) => l.startsWith(h)), `${h} moved out`);
    assert.ok(NOTES.includes(h.replace(/^### /, "## ")), `${h} in the notes`);
  }
});

test("the parent keeps no requirement line a split file holds: each is in exactly one file, and a pointer names it", () => {
  const parentIds = new Set(idLines(PARENT).map(idOf));
  for (const name of SPLITS) {
    for (const id of idLines(req(name)).map(idOf)) {
      assert.ok(!parentIds.has(id), `${id} left in control-plane.md though ${name}.md holds it`);
      assert.ok(PARENT.split("\n").some((l) => l.startsWith("Moved verbatim") && l.includes(`\`${name}.md\``) && new RegExp(`\\b${id}\\b`).test(l)),
        `a pointer names ${id} in ${name}.md`);
    }
  }
});
