/* ai-accounts: the requirements file's consolidation (job ai-accounts, attempt 4) changed no requirement. The ids, the unmet
   marks and the digest below are those of build/requirements/ai-accounts.md at the job's start commit (4da7a52d), read by the
   coverage check's rule (requirements README convention 5: `**Rn**` first on its line). The non-requirement text moved to
   docs/requirements-notes/ai-accounts.md. The R and F lines alone were over the cap (72,661 bytes), so BOB split by copy
   (ruling 5 Nov 08:23, PR 463): R41, R46, R49, R50, R70, R72 and R77 live verbatim in build/requirements/ai-accounts-lists.md
   and this file keeps each as a retired stub where it stood. The start commit's lines are rebuilt from the two files, in its order. */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const at = (rel) => fileURLToPath(new URL(`../../../../${rel}`, import.meta.url));
const FILE = at("build/requirements/ai-accounts.md");
const NOTES = at("docs/requirements-notes/ai-accounts.md");
const LISTS = at("build/requirements/ai-accounts-lists.md");
const MOVED = ["R41", "R46", "R49", "R50", "R70", "R72", "R77"];
const stub = (id) => `- **${id}** *(retired: moved to ai-accounts-lists ${id}, PR 463)*`;

const START_IDS = ("R1 R2 R3 R4 R23 R5 R6 R7 R11 R9 R8 R10 R12 R13 R14 R15 R16 R17 R18 R19 R20 R21 R22 R24 R25 R26 R34 R38 R39 " +
  "R40 R41 R42 R43 R44 R45 R46 R47 R48 R49 R50 R51 R52 R53 R54 R55 R56 R57 R65 R66 R67 R68 R58 R59 R60 R61 R62 R69 R70 R71 R72 " +
  "R73 R74 R75 R76 R77 R27 R28 R63 R64 R29 R30 R31 R32 R33 R35 R36 R37 F1 F2 F4 F5").split(" ");
const START_UNMET = { F5: "coordinator ruling 5 Nov 04:19" };
/* sha-256 of the start commit's R and F lines, joined by newlines, each with its unmet mark taken out */
const START_DIGEST = "9d884983b7c217ddf115f71ed7e9debdc03149e4576ac9520d09783155fa2287";

const read = (f) => readFileSync(f, "utf8");
const idLines = (text) => text.split("\n").filter((l) => /^\s*- \*\*[RF]\d+\*\*/.test(l));
const idOf = (l) => l.match(/^\s*- \*\*([RF]\d+)\*\*/)[1];
const MARK = / ?\*\(not yet met: ([^)]*)\)\*/;
/* the start commit's R and F lines, in its order: each from this file, or from ai-accounts-lists for a moved id */
const startLines = () => {
  const here = new Map(idLines(read(FILE)).map((l) => [idOf(l), l]));
  const lists = new Map(idLines(read(LISTS)).map((l) => [idOf(l), l]));
  return START_IDS.map((id) => (MOVED.includes(id) ? lists : here).get(id));
};

test("consolidation: the requirements file holds the start commit's ids, in their order, the seven moved as stubs", () => {
  /* found marks the coordinator added on tranche after the job's start (F6, 5 Nov) follow the start's ids */
  const ids = idLines(read(FILE)).map(idOf);
  assert.deepEqual(ids.slice(0, START_IDS.length), START_IDS);
  for (const id of ids.slice(START_IDS.length)) assert.match(id, /^F\d+$/, `${id} after the start's ids`);
});

test("split: the seven moved ids are in ai-accounts-lists, and each is a retired stub here naming where it went", () => {
  assert.deepEqual(idLines(read(LISTS)).map(idOf), MOVED);
  const here = new Map(idLines(read(FILE)).map((l) => [idOf(l), l]));
  for (const id of MOVED) assert.equal(here.get(id), stub(id), id);
});

test("consolidation: every R and F line is the start commit's word for word, its mark aside", () => {
  /* a mark this job meets is struck as `(<its mark>; met <day>)`, which is taken out as the mark is */
  const struck = (l) => { const u = START_UNMET[idOf(l)]; return u ? l.replace(` (${u}; met 5 Nov)`, "") : l; };
  const lines = startLines().map((l) => struck(l.replace(MARK, "")));
  assert.equal(createHash("sha256").update(lines.join("\n")).digest("hex"), START_DIGEST);
});

test("consolidation: the unmet marks are the start commit's, a mark this job meets struck and none other changed", () => {
  const marks = {};
  for (const l of startLines()) { const m = l.match(MARK); if (m) marks[idOf(l)] = m[1]; }
  for (const [id, m] of Object.entries(marks)) assert.equal(m, START_UNMET[id], id);
});

test("consolidation: the moved text is in the notes file and no longer in the requirements file", () => {
  const notes = read(NOTES);
  const file = read(FILE);
  for (const lead of ["**Status** · New in T48 (T48-10;", "**Size (P6).** About 2,085 lines", "Codes (T40; K231):",
    "- K3148 (R34).", "- **The copy (K624; split map §2, §6).**", "- **Callers' obligations.**"]) {
    assert.ok(notes.includes(lead), `notes keep: ${lead}`);
    assert.ok(!file.includes(lead), `requirements file lost: ${lead}`);
  }
  assert.ok(!file.includes("### Satisfies"), "Satisfies left the requirements file");
});

test("the cap: the requirements file is under 70000 bytes", () => {
  const size = Buffer.byteLength(read(FILE));
  assert.ok(size < 70000, `ai-accounts.md is ${size} bytes`);
});
