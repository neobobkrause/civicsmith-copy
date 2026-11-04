/* The consolidation of build/requirements/instance-setup.md (4 Nov 2026) and the instance-updates split (accepted by BOB
   4 Nov 2026): the ids, their order and their unmet marks are those of the start commit 7e9de4af, every R line not moved is
   kept byte for byte, and each moved id is retired here naming its new id, which instance-updates' file holds. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const read = (m) => readFileSync(new URL(`../../../../build/requirements/${m}.md`, import.meta.url), "utf8");
const FILE = read("instance-setup");
const ID_LINE = /^- \*\*([RF]\d+)\*\*/;
const idLines = (s) => s.split("\n").filter((l) => ID_LINE.test(l));
const idOf = (l) => ID_LINE.exec(l)[1];

/* At 7e9de4af (the start commit), in file order. */
const START_IDS = ["R1","R2","R3","R4","R5","R6","R7","R8","R9","R10","R11","R77","R78","R12","R13","R14","R15","R16","R76","R17",
  "R80","R81","R82","R18","R19","R33","R34","R35","R36","R37","R38","R39","R40","R20","R21","R22","R47","R56","R57","R58","R23",
  "R24","R44","R45","R46","R48","R49","R25","R32","R50","R51","R52","R53","R54","R55","R59","R60","R61","R62","R63","R64","R79",
  "R65","R66","R67","R68","R69","R70","R71","R72","R73","R74","R83","R84","R85","R86","R87","R88","R89","R90","R91","R92","R93",
  "R94","R95","R96","R97","R98","R99","R100","R101","R102","R103","R104","R106","R107","R108","R109","R110","R111","R112","R113",
  "R114","R115","R26","R27","R28","R29","R30","R31","R41","R42","R75","R43","R105"];
const START_UNMET = { R107: "T53", R108: "T53", R109: "T53", R110: "T53", R111: "T53", R112: "T53", R113: "T53", R114: "T53", R115: "T53" };
/* The moved ids and their new ids in instance-updates (its R1-R7). */
const MOVED = { R88: "R1", R89: "R2", R90: "R3", R91: "R4", R92: "R5", R106: "R6", R110: "R7" };
/* SHA-256 of the start commit's R lines not moved, joined by newlines, in order. */
const KEPT_SHA = "4b2a0e8e4f8584e7c59b17a0629632dbdd13f2fc7d9c85fded2dee5545b3777b";
const unmetOf = (l) => (/\*\(not yet met:? ?([^)]*)\)\*/.exec(l) || [])[1] ?? null;

test("instance-setup's requirement ids and their order are the start commit's, nothing added or dropped by the consolidation", () => {
  assert.deepEqual(idLines(FILE).map(idOf), START_IDS);
});

test("every R line not moved is kept byte for byte, and the unmet marks are the start commit's less the moved R110's, which instance-updates now carries", () => {
  const kept = idLines(FILE).filter((l) => !MOVED[idOf(l)]);
  assert.equal(createHash("sha256").update(kept.join("\n")).digest("hex"), KEPT_SHA);
  const unmet = Object.fromEntries(idLines(FILE).filter((l) => unmetOf(l)).map((l) => [idOf(l), unmetOf(l)]));
  const expected = Object.fromEntries(Object.entries(START_UNMET).filter(([id]) => !MOVED[id]));
  assert.deepEqual(unmet, expected);
});

test("each moved id is retired here in one line naming its new id (instance-updates:R<n>), and instance-updates holds that id, moved from it, with the mark it had", () => {
  const upd = idLines(read("instance-updates"));
  for (const [old, now] of Object.entries(MOVED)) {
    const here = idLines(FILE).filter((l) => idOf(l) === old);
    assert.equal(here.length, 1, old);
    assert.equal(here[0], `- **${old}** *(retired: moved to instance-updates:${now}, 4 Nov 2026)*`);
    const there = upd.filter((l) => idOf(l) === now);
    assert.equal(there.length, 1, now);
    assert.ok(there[0].startsWith(`- **${now}** (moved from instance-setup:${old}) `), `${now} names instance-setup:${old}`);
    assert.equal(unmetOf(there[0]), START_UNMET[old] ?? null, `${now} carries ${old}'s mark`);
  }
  /* the retired lines carry no indented text left behind */
  const L = FILE.split("\n");
  L.forEach((l, i) => { if (ID_LINE.test(l) && MOVED[idOf(l)]) assert.ok(!/^\s+\S/.test(L[i + 1] ?? ""), `${idOf(l)} has nothing under it`); });
});
