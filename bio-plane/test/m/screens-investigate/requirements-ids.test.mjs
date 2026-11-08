/* screens-investigate: the consolidation of build/requirements/screens-investigate.md toward the 70,000-byte cap
   moves no requirement. Every id at the start commit (99d10a2f, before the move) is still an id here, in order,
   and the unmet marks are the start's; the moved-out text is in docs/requirements-notes/screens-investigate.md. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ROOT = new URL("../../../../", import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), "utf8");
const lines = (t) => t.split("\n").filter((l) => /^\s*- \*\*[RF]\d+\*\*/.test(l));
const idOf = (l) => l.match(/\*\*([RF]\d+)\*\*/)[1];
const REQ = "build/requirements/screens-investigate.md";
const NOTES = "docs/requirements-notes/screens-investigate.md";

const START_IDS = Array.from({ length: 93 }, (_, i) => `R${i + 1}`);
const START_UNMET = Array.from({ length: 27 }, (_, i) => `R${i + 67}`);

test("consolidation: the ids are the start commit's, in order, each once", () => {
  assert.deepEqual(lines(read(REQ)).map(idOf), START_IDS);
});

test("consolidation: the unmet marks are the start's", () => {
  const unmet = lines(read(REQ)).filter((l) => /\*\(not yet met/.test(l)).map(idOf);
  assert.deepEqual(unmet, START_UNMET);
});

test("consolidation: the moved-out text is in the notes, not the requirements", () => {
  const t = read(REQ);
  const notes = read(NOTES);
  for (const s of ["**Size (P6).**", "### Uses", "### Satisfies", "### Suggestions", "New in T47 (T47-62"]) assert.ok(!t.includes(s), s);
  for (const s of ["**Size (P6).**", "## Uses", "## Satisfies", "## Suggestions", "New in T47 (T47-62"]) assert.ok(notes.includes(s), s);
});

test("consolidation: the requirements file is under the 70,000-byte cap, its sources kept in the notes", () => {
  const t = readFileSync(new URL(REQ, ROOT));
  assert.ok(t.length <= 70000, `${REQ} is ${t.length} bytes`);
  const notes = read(NOTES);
  assert.ok(notes.includes("## Sources by requirement"));
  for (const s of ["(T48; N1050; K3177, K3178; `people` R38; amends R12, R13)", "(T53; N1260; DEC-410 (1); DEC-447 (1)-(3); R12, R13, R18 there)"]) {
    assert.ok(notes.includes(s), s);
    assert.ok(!read(REQ).includes(s), s);
  }
});
