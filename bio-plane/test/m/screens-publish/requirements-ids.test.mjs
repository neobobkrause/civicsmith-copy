/* screens-publish: the requirements file's consolidations change no requirement id.
   Attempt 1 (5 Nov 2026) moved the Status history, Size, Satisfies and Suggestions word for word to
   docs/requirements-notes/screens-publish.md (MOVED). Attempt 4 (7 Nov 2026) consolidated the file under the 70,000-byte
   cap: provenance moved to the notes and amended text folded, so the lines are no longer pinned by hash.
   START_IDS is every R and F id of build/requirements/screens-publish.md at attempt 1's start commit (48566a017fc):
   the set of ids must stay exactly that, with the ids added since (ADDED_IDS). START_UNMET is the "not yet met" marks at that commit: a line may lose
   its mark, never gain one it did not have. The file must stay under 70,000 bytes. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const ROOT = new URL("../../../../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");
const sha = (s) => createHash("sha256").update(s).digest("hex");
const MARK = / ?\*\(not yet met: ([^)]*)\)\*/;
const idLines = (text) => {
  const m = new Map();
  for (const l of text.split("\n")) {
    const x = /^- \*\*([RF]\d+)\*\*/.exec(l);
    if (x) { assert.ok(!m.has(x[1]), `id ${x[1]} appears twice`); m.set(x[1], l); }
  }
  return m;
};

const START_IDS = [
  "R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10", "R12", "R13",
  "R14", "R15", "R16", "R17", "R18", "R19", "R20", "R21", "R22", "R23", "R24", "R25",
  "R26", "R27", "R28", "R29", "R30", "R31", "R32", "R33", "R34", "R35", "R36", "R37",
  "R38", "R39", "R40", "R41", "R42", "R43", "R44", "R45", "R46", "R47", "R48", "R49",
  "R50", "R51", "R52", "R53", "R54", "R55", "R56", "R57", "R58", "R59", "R60", "R61",
  "R62", "R63", "R64", "R65", "R66", "R67", "R68", "R69", "R70", "R71", "R72", "R80",
  "R82", "R83", "R84", "R85", "R86", "R87", "R88", "R89", "R90", "R91", "R92", "R93",
  "R94", "R95", "R96", "R97", "R98", "R99", "R100", "R101", "R102", "R103", "R104", "R105",
  "R106", "R11", "R73", "R74", "R75", "R76", "R77", "R78", "R79", "R81",
];
const ADDED_IDS = ["F1"]; // ids added after that start commit (F1: BOB, 5 Nov 2026)
const START_UNMET = {"R82":"T53", "R83":"T53", "R84":"T53", "R85":"T53", "R86":"T53", "R87":"T53", "R88":"T53", "R89":"T53", "R90":"T53", "R91":"T53", "R92":"T53", "R93":"T53", "R94":"T53", "R95":"T53", "R96":"T53", "R97":"T53", "R98":"T53", "R99":"T53", "R100":"T53", "R101":"T53", "R102":"T53", "R103":"T53", "R104":"T53", "R105":"T53", "R106":"T53"};
const MOVED = ["444ff146155d060eb346504594bafd64e3668314efc68234fa4ccee36f50a3b4","d54f6cd7b37f0ffc9718f777c8f1820b1a1eea2393c347f0def9ed15d530c89a"]; // the Status and Size paragraphs at the start commit

test("consolidation: the set of R and F ids is the set at the start", () => {
  const now = [...idLines(read("build/requirements/screens-publish.md")).keys()];
  assert.deepEqual([...now].sort(), [...START_IDS, ...ADDED_IDS].sort());
});

test("consolidation: the requirements file is under the 70,000-byte cap", () => {
  const bytes = Buffer.byteLength(read("build/requirements/screens-publish.md"), "utf8");
  assert.ok(bytes < 70000, `${bytes} bytes`);
});

test("consolidation: no start line gained an unmet mark", () => {
  for (const [id, l] of idLines(read("build/requirements/screens-publish.md"))) {
    const m = MARK.exec(l);
    if (m && START_IDS.includes(id)) assert.equal(START_UNMET[id], m[1], id);
  }
});

test("consolidation: the moved notes are in docs/requirements-notes and no longer in the requirements file", () => {
  const req = read("build/requirements/screens-publish.md").split("\n").map(sha);
  const notes = read("docs/requirements-notes/screens-publish.md").split("\n").map(sha);
  for (const h of MOVED) { assert.ok(notes.includes(h)); assert.ok(!req.includes(h)); }
  assert.doesNotMatch(read("build/requirements/screens-publish.md"), /^### (Satisfies|Suggestions)$/m);
});
