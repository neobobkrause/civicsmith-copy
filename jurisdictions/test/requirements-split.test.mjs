// The requirements file's consolidation under the cap (job jurisdictions,
// attempt 2): R61–R110 moved to jurisdictions-b and R111–R139 to
// jurisdictions-c (BOB's split, PR 474). Moving them changes no requirement:
// the set of ids and of unmet marks across the three files is the set
// build/requirements/jurisdictions.md held at the job's start commit
// (4eaf1b87), and this file stays under the requirements cap.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (name) =>
  fs.readFileSync(new URL(`../../build/requirements/${name}.md`, import.meta.url), "utf8");

const CAP = 70000;

// The ids and marks at the start commit, read from its file.
const START_IDS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27,
  28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51,
  52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75,
  76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99,
  100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118,
  119, 120, 121, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139,
].map((n) => `R${n}`);
const START_MARKS = { R109: "T53", R120: "T53", R124: "T53", R133: "T53", R137: "T53" };

function entries(text) {
  const out = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^(?:- )?\*\*([RF]\d+)\*\*(.*)$/);
    if (!m) continue;
    const retired = m[2].match(/^\s*\*\(retired: moved to (jurisdictions-[bc]) (R\d+), PR 474\)\*\s*$/);
    const mark = m[2].match(/^\s*\*\(not yet met: ([^)]*)\)\*/);
    out.push({ id: m[1], mark: mark ? mark[1] : null, movedTo: retired ? retired[1] : null, movedId: retired ? retired[2] : null });
  }
  return out;
}

const files = { jurisdictions: read("jurisdictions"), b: read("jurisdictions-b"), c: read("jurisdictions-c") };
// The moved ids keep a retired line in jurisdictions (BOB, bob-175); the requirements are the rest.
const all = Object.values(files).flatMap(entries).filter((e) => !e.movedTo);
const stubs = entries(files.jurisdictions).filter((e) => e.movedTo);

test("the split keeps every requirement id of the start commit, each in exactly one file", () => {
  const ids = all.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, "no id is in two files");
  const byNum = (a, b) => Number(a.slice(1)) - Number(b.slice(1));
  assert.deepEqual([...ids].sort(byNum), [...START_IDS].sort(byNum));
});

// The move adds no mark and changes none: every unmet mark now standing is one
// the start commit held, word for word. A mark may since have been struck by
// the module that now owns its file (jurisdictions-b met R109, jurisdictions-c
// met R124, after the split); striking is that module's act, not the move's.
test("the split keeps every unmet mark of the start commit unchanged", () => {
  const marks = Object.fromEntries(all.filter((e) => e.mark).map((e) => [e.id, e.mark]));
  for (const [id, mark] of Object.entries(marks)) {
    assert.equal(mark, START_MARKS[id], `${id}'s mark is the start commit's`);
  }
  // R1–R60 stay in this module's file; their marks are exactly the start commit's.
  const here = (o) =>
    Object.fromEntries(Object.entries(o).filter(([id]) => Number(id.slice(1)) <= 60));
  assert.deepEqual(here(marks), here(START_MARKS));
});

test("jurisdictions keeps R1–R60, and -b and -c hold R61–R110 and R111–R139", () => {
  const nums = (t) => entries(t).filter((e) => !e.movedTo).map((e) => Number(e.id.slice(1)));
  assert.ok(nums(files.jurisdictions).every((n) => n <= 60));
  assert.ok(nums(files.b).every((n) => n >= 61 && n <= 110));
  assert.ok(nums(files.c).every((n) => n >= 111 && n <= 139));
});

test("each moved id keeps one retired line in jurisdictions naming the file that now holds it", () => {
  const moved = START_IDS.filter((id) => Number(id.slice(1)) >= 61);
  assert.deepEqual(stubs.map((e) => e.id), moved);
  for (const e of stubs) {
    assert.equal(e.movedId, e.id);
    const there = entries(files[e.movedTo === "jurisdictions-b" ? "b" : "c"]).map((x) => x.id);
    assert.ok(there.includes(e.id), `${e.id} is in ${e.movedTo}`);
  }
});

test("build/requirements/jurisdictions.md is under the requirements cap", () => {
  assert.ok(Buffer.byteLength(files.jurisdictions) < CAP, `${Buffer.byteLength(files.jurisdictions)} bytes`);
});
