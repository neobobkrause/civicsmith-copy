/* office-readers R38 (fix round 10, cause 16; K5053): a deck of N texts gives N units, the hidden slide's text held once and marked. */
import test from "node:test";
import assert from "node:assert/strict";
import { pptxEntry } from "../../../src/pptx.mjs";
import { generate } from "../../docgen.mjs";
/** @import { PptxText } from "../../../src/pptx.mjs" */

/* the units a reading-pipeline arm makes from the entry: one per slide with text (its `hidden` copied), one per part */
/** @type {(t: PptxText) => {text: string, hidden: boolean}[]} */
const unitsOf = (t) => {
  const parts = t.parts;
  if (parts === undefined) assert.fail("the entry carries its parts");
  return [
    ...t.slides.filter((s) => s.text).map((s) => ({ text: s.text, hidden: s.hidden === true })),
    ...parts.filter((p) => p.text).map((p) => ({ text: p.text, hidden: p.hidden === true })),
  ];
};

test("R38 pptx (cause 16): a deck of six slides with notes and a hidden slide, 8 texts give 8 units, and the hidden slide's is marked", async () => {
  const g = generate({ kind: "pptx", seed: "rw9-C-3p", size: { units: 6 }, parts: ["notes", "hidden"] });
  assert.equal(g.truth.units, 8);
  const t = await pptxEntry.text(await g.bytes());
  assert.equal(t.ok, true);
  const units = unitsOf(t);
  assert.equal(units.length, 8);
  assert.equal(new Set(units.map((u) => u.text)).size, 8, "no text is held twice");
  const hidden = units.filter((u) => u.hidden);
  assert.equal(hidden.length, 1);
  const [first] = hidden;
  if (first === undefined) assert.fail("one unit is hidden");
  assert.match(first.text, /khidden/);
  const document = t.document;
  if (document === null) assert.fail("the document is read");
  assert.ok(document.includes("khidden"), "R23: a hidden slide's text stays in the document");
});
