/* store-assembly: the split of its requirements (4 Nov 2026, K617, K624) into store-ask (R49-R59 -> R1-R11) and
   store-jobs (R60-R82, R102-R104 -> R1-R26) changed no requirement. The ids, the unmet marks and the retired ids below
   are those of build/requirements/store-assembly.md at the job's start commit (9b24775e), read by the coverage check's
   rule (requirements README convention 5); MOVED_LINE holds, for each moved id, the first 16 hex of the sha256 of its
   start-commit line after the id. A later job that strikes a mark removes it from START_UNMET with the strike. */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const REQ = (m) => fileURLToPath(new URL(`../../../../build/requirements/${m}.md`, import.meta.url));
const CAP = 70000;

const START_IDS = ("R1 R2 R3 R4 R5 R6 R7 R8 R9 R10 R99 R11 R12 R13 R14 R15 R16 R17 R18 R19 R20 R21 R22 R23 R24 R25 " +
  "R26 R27 R28 R29 R30 R31 R32 R33 R34 R35 R36 R37 R38 R39 R40 R41 R42 R43 R44 R45 R46 R47 R48 R49 R50 R51 R52 R53 " +
  "R54 R55 R56 R57 R58 R59 R60 R61 R62 R63 R64 R65 R66 R67 R68 R69 R70 R71 R72 R73 R74 R75 R76 R77 R78 R79 R80 R81 " +
  "R82 R83 R84 R85 R86 R87 R88 R89 R90 R91 R92 R93 R94 R95 R101 R102 R103 R104 R96 R97 R98 R100").split(" ");
/* R101 struck by attempt 3 (4 Nov): registers composed, compose-t53.test.mjs */
const START_UNMET = { R102: "T53", R103: "T53", R104: "T53" };
const START_RETIRED = ["R48"];
const MOVED = { "store-ask": "R49 R50 R51 R52 R53 R54 R55 R56 R57 R58 R59".split(" "),
  "store-jobs": ("R60 R61 R62 R63 R64 R65 R66 R67 R68 R69 R70 R71 R72 R73 R74 R75 R76 R77 R78 R79 R80 R81 R82 " +
    "R102 R103 R104").split(" ") };
const MOVED_LINE = {"R60":"74bd9387aeeaa219","R61":"cbb4116ca50a0420","R62":"69edc83e6dece76d","R63":"203455c0da4a76eb","R64":"61011d756c883558","R65":"6bf99280d1c969d0","R66":"6658472a60e7878b","R67":"96b7cbda762749fe","R68":"3b004d74aa07a437","R69":"75c0e21fd4d0674b","R70":"4dddd72c53bdc75f","R71":"cb5b04a82c5ff743","R72":"aac1377ea7f5d99d","R73":"b06bcade5a15af2a","R74":"64de0ee1b6e2b3e6","R75":"2b48239e4553024d","R76":"baa54c8facb914fb","R77":"71fdc438c5b18e57","R78":"58bdc10712da975e","R79":"15f55d590115edb3","R80":"5486f121d24333a6","R81":"282bad7ac96c6d27","R82":"4529c9a3f1706354","R102":"94c6e3be9e0b3bd4","R103":"4fc3821de6d3e41a","R104":"bb19fcffcba35aae","R49":"2dc34b4e4c0ada90","R50":"4576c76714506bfa","R51":"18598bb03fa85809","R52":"bf4bf55b28cd697f","R53":"f2c79bfab6076c3f","R54":"37a72d135420bd2e","R55":"a87e3182f32ea482","R56":"37e8eaa1c7949c14","R57":"288f154d5c50d865","R58":"81773df3bab72c93","R59":"77f4ec24a4e543e5"};

const read = (m) => readFileSync(REQ(m), "utf8");
const idLines = (text) => text.split("\n").map((l) => l.match(/^\s*- \*\*([RF]\d+)\*\*(.*)$/)).filter(Boolean);
const movedTo = (id) => Object.keys(MOVED).find((m) => MOVED[m].includes(id));
/* In a new module's file: its id -> {from, rest}, rest being the line after the id with the "moved from" note taken out. */
const copies = (m) => Object.fromEntries(idLines(read(m)).map(([, id, rest]) => {
  const x = rest.match(/^(.*?) \(moved from store-assembly:(R\d+)\)(.*)$/);
  return x ? [x[2], { id, rest: x[1] + x[3] }] : null;
}).filter(Boolean));

/* F1-F3 (attempt 10, 7 Nov): found items added after the split, each met; the R ids are the split's own. */
const FOUND = ["F1", "F2", "F3"];

test("split: the file holds every start-commit id, in the same order, none dropped or added", () => {
  const ids = idLines(read("store-assembly")).map((m) => m[1]);
  assert.deepEqual(ids.filter((id) => id.startsWith("R")), START_IDS);
  assert.deepEqual(ids.filter((id) => id.startsWith("F")), FOUND);
});

test("split: every moved id is retired here naming its new id, and only those besides R48", () => {
  const retired = {};
  for (const [, id, rest] of idLines(read("store-assembly"))) {
    if (!/^\s*\*\(retired/.test(rest)) continue;
    const m = rest.match(/^\s*\*\(retired: moved to (store-[a-z]+):(R\d+), K617\)\*\s*$/);
    retired[id] = m ? `${m[1]}:${m[2]}` : "retired";
  }
  const want = { R48: "retired" };
  for (const m of Object.keys(MOVED)) for (const id of MOVED[m]) want[id] = `${m}:${copies(m)[id]?.id}`;
  assert.deepEqual(retired, want);
  assert.deepEqual(START_RETIRED.filter((id) => !(id in retired)), []);
});

test("split: every moved id exists in its new module's file, its line verbatim from the start commit", () => {
  for (const m of Object.keys(MOVED)) {
    const c = copies(m);
    for (const id of MOVED[m]) {
      assert.ok(c[id], `${id} missing from ${m}`);
      const h = createHash("sha256").update(c[id].rest).digest("hex").slice(0, 16);
      assert.equal(h, MOVED_LINE[id], `${m}:${c[id].id} (was ${id}) differs from the start commit's line`);
    }
  }
});

test("split: the unmet marks are the start commit's, each on its own id's line here or in its new module", () => {
  const here = {}, moved = {};
  for (const [, id, rest] of idLines(read("store-assembly"))) {
    const u = rest.match(/\*\(not yet met: ([^)]*)\)\*/);
    if (u) here[id] = u[1];
  }
  for (const m of Object.keys(MOVED)) for (const [old, { rest }] of Object.entries(copies(m))) {
    const u = rest.match(/\*\(not yet met: ([^)]*)\)\*/);
    if (u) moved[old] = u[1];
  }
  assert.deepEqual(here, Object.fromEntries(Object.entries(START_UNMET).filter(([id]) => !movedTo(id))));
  assert.deepEqual(moved, Object.fromEntries(Object.entries(START_UNMET).filter(([id]) => movedTo(id))));
});

test("split: the requirements file is under the cap", () => {
  const n = Buffer.byteLength(read("store-assembly"), "utf8");
  assert.ok(n <= CAP, `${n} bytes`);
});
