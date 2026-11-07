/* The consolidation of build/requirements/instance-setup.md (4 Nov 2026) and its two splits, instance-updates and
   instance-reports (both accepted by BOB 4 Nov 2026): the ids, their order and their unmet marks are those of the start
   commit 7e9de4af, every R line not moved is kept byte for byte, and each moved id is retired here naming its new id,
   which the new module's file holds, moved from it. */
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
  "R114","R115","F1","R26","R27","R28","R29","R30","R31","R41","R42","R75","R43","R105"];
const START_UNMET = { R107: "T53", R108: "T53", R109: "T53", R110: "T53", R111: "T53", R112: "T53", R113: "T53", R114: "T53", R115: "T53" };
/* Since the start commit (attempt 2, 5 Nov 2026): F1, the coordinator's found mark for screens-ai (17:24), added after R115
   and met with it; R115 and F1 are met by readiness.test.mjs, so neither carries a mark. */
const ADDED = new Set(["F1"]);
/* Attempt 4 (7 Nov 2026): R107-R109 and R111-R114 met by t53.test.mjs and seeds.test.mjs (R112), their marks struck. */
const MET_SINCE = new Set(["R115", "R107", "R108", "R109", "R111", "R112", "R113", "R114"]);
/* The moved ids and their new ids: instance-updates R1-R7 and instance-reports R1-R21, each in the order of the old ids. */
const MOVED = {
  R88: "instance-updates:R1", R89: "instance-updates:R2", R90: "instance-updates:R3", R91: "instance-updates:R4",
  R92: "instance-updates:R5", R106: "instance-updates:R6", R110: "instance-updates:R7",
  ...Object.fromEntries(["R17", "R18", "R19", "R33", "R34", "R35", "R36", "R37", "R38", "R39", "R40", "R41", "R42", "R80", "R81",
    "R82", "R95", "R102", "R103", "R104", "R105"].map((old, i) => [old, `instance-reports:R${i + 1}`])),
};
/* SHA-256 of the start commit's R lines not moved, joined by newlines, in order. */
const KEPT_SHA = "9b1d0e5d0daddc0763a8c42ff7fc389acc6db57101adc8ec333be7863d257c21";
const unmetOf = (l) => (/\*\(not yet met:? ?([^)]*)\)\*/.exec(l) || [])[1] ?? null;

test("instance-setup's requirement ids and their order are the start commit's, nothing added or dropped by the consolidation", () => {
  assert.deepEqual(idLines(FILE).map(idOf), START_IDS);
});

test("every R line not moved is kept byte for byte, and the unmet marks are the start commit's less the moved ones', which their new modules now carry (R110's)", () => {
  const kept = idLines(FILE).filter((l) => !MOVED[idOf(l)] && !ADDED.has(idOf(l)))
    .map((l) => (MET_SINCE.has(idOf(l)) ? `${l} *(not yet met: ${START_UNMET[idOf(l)]})*` : l));
  assert.equal(createHash("sha256").update(kept.join("\n")).digest("hex"), KEPT_SHA);
  const unmet = Object.fromEntries(idLines(FILE).filter((l) => unmetOf(l)).map((l) => [idOf(l), unmetOf(l)]));
  const expected = Object.fromEntries(Object.entries(START_UNMET).filter(([id]) => !MOVED[id] && !MET_SINCE.has(id)));
  assert.deepEqual(unmet, expected);
});

test("each moved id is retired here in one line naming its new id (<module>:R<n>), and the new module holds that id, moved from it, with the mark it had", () => {
  const files = {};
  for (const [old, to] of Object.entries(MOVED)) {
    const [mod, now] = to.split(":");
    files[mod] ??= idLines(read(mod));
    const here = idLines(FILE).filter((l) => idOf(l) === old);
    assert.equal(here.length, 1, old);
    assert.equal(here[0], `- **${old}** *(retired: moved to ${to})*`);
    const there = files[mod].filter((l) => idOf(l) === now);
    assert.equal(there.length, 1, to);
    assert.ok(there[0].startsWith(`- **${now}** (moved from instance-setup:${old}) `), `${to} names instance-setup:${old}`);
    assert.equal(unmetOf(there[0]), START_UNMET[old] ?? null, `${to} carries ${old}'s mark`);
  }
  /* the retired lines carry no indented text left behind */
  const L = FILE.split("\n");
  L.forEach((l, i) => { if (ID_LINE.test(l) && MOVED[idOf(l)]) assert.ok(!/^\s+\S/.test(L[i + 1] ?? ""), `${idOf(l)} has nothing under it`); });
});
