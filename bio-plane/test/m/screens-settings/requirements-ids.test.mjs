/* The consolidation of build/requirements/screens-settings.md (4 Nov 2026): non-requirement text (the Status history, the Size line, the bullets
   left under the retired R4 and R5, the Satisfies list) moved to docs/requirements-notes/screens-settings.md. The ids, their order and their
   unmet marks are those of the start commit d3580fbd, except R95's mark, struck by this branch (R95 met). Every R line is kept byte for byte,
   R95's apart from that struck mark. A found mark, F1 (attempt 7, the base-red contract test), follows the R lines; it is no R line. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const FILE = readFileSync(new URL("../../../../build/requirements/screens-settings.md", import.meta.url), "utf8");
const NOTES = readFileSync(new URL("../../../../docs/requirements-notes/screens-settings.md", import.meta.url), "utf8");
const ID_LINE = /^- \*\*([RF]\d+)\*\*/;
const idLines = (s) => s.split("\n").filter((l) => ID_LINE.test(l));
const idOf = (l) => ID_LINE.exec(l)[1];
const unmetOf = (l) => (/\*\(not yet met:? ?([^)]*)\)\*/.exec(l) || [])[1] ?? null;
const sha = (s) => createHash("sha256").update(s).digest("hex");

/* At d3580fbd (the start commit), in file order. */
const START_IDS = ["R1","R2","R3","R4","R5","R6","R7","R8","R9","R11","R12","R13","R14","R15","R16","R17","R18","R19","R20","R21","R22","R23",
  "R25","R26","R27","R24","R28","R29","R30","R31","R32","R33","R34","R35","R36","R37","R38","R39","R40","R41","R42","R43","R44","R45","R46","R47",
  "R80","R48","R49","R50","R51","R52","R53","R54","R55","R56","R57","R58","R59","R60","R61","R62","R63","R64","R65","R66","R67","R68","R69","R70",
  "R71","R72","R73","R74","R75","R76","R77","R78","R79","R81","R82","R83","R84","R85","R86","R87","R88","R89","R90","R91","R92","R93","R94","R95",
  "R96","R97","R98","R99","R100","R101","R102","R103","R104","R105","R10"];
/* the found marks this branch added after them, met */
const FOUND = ["F1"];
const START_UNMET = Object.fromEntries(["R1","R2","R3","R17","R26","R34","R37","R47","R57","R82","R83","R84","R85","R86","R87","R88","R89","R90",
  "R91","R92","R93","R94","R95","R96","R97","R98","R99","R100","R101","R102","R103","R104","R105"].map((id) => [id, "T53"]));
/* the marks this branch struck, each for a requirement it meets */
const STRUCK = ["R95"];
/* SHA-256 of the start commit's R lines other than R95, joined by newlines, in order; and of R95's line with its mark struck */
const KEPT_SHA = "379f3d67748b3afaad65099cfe9256c7a6d8fcbea0a0e38238e31a91aed897a9";
const R95_SHA = "e7c40cbe27e1f0a9f4b16991732a8d8ede0784375779a570bf0c9e0fddfed9f0";

test("screens-settings' requirement ids and their order are the start commit's: nothing added, dropped or moved by the consolidation", () => {
  assert.deepEqual(idLines(FILE).map(idOf), [...START_IDS, ...FOUND]);
});

test("every R line is kept byte for byte, R95's with its mark struck; the unmet marks are the start commit's less the struck ones", () => {
  const lines = idLines(FILE).filter((l) => !FOUND.includes(idOf(l)));
  assert.equal(sha(lines.filter((l) => idOf(l) !== "R95").join("\n")), KEPT_SHA);
  assert.equal(sha(lines.find((l) => idOf(l) === "R95")), R95_SHA);
  const unmet = Object.fromEntries(lines.filter((l) => unmetOf(l)).map((l) => [idOf(l), unmetOf(l)]));
  assert.deepEqual(unmet, Object.fromEntries(Object.entries(START_UNMET).filter(([id]) => !STRUCK.includes(id))));
});

test("the moved text is in the notes, and the notes hold no requirement line", () => {
  for (const s of ["**Status** · New in T46 (T46-55; K657, K1043)", "**Size (P6).** Estimated 2,400–3,000 lines", "  - **Subscription sign-in** (DEC-156; K2147; N897 (3))",
    "- Registry screens `members`, `account`, `connect`, `notes` (DEC-139)"]) {
    assert.ok(NOTES.includes(s), s);
    assert.ok(!FILE.includes(s), `${s} is no longer in the requirements file`);
  }
  assert.deepEqual(idLines(NOTES), [], "no R or F line in the notes");
});
