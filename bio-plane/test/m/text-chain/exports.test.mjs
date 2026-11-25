/* text-chain: requirement-named tests for the exports N416 found named by no requirement (build/requirements/text-chain.md
 * R99-R103): each driven at the interface over its whole domain. `EXTENT_KINDS` was made internal instead. */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as tc from "../../../src/textchain.mjs";
import { BASIS_GRADES } from "../../../src/record-grammar/index.mjs";

const {
  weaker, stepCovers, CONFIDENCE_BASES, checkConfidence, perPageTierWinner, mergeTier2Text, TIER_RULE,
  READING_POSITION_KINDS, READING_POSITION_UNPRODUCED, readingSource,
} = tc;
const NOT_GRADES = [undefined, null, "", "a", "E", "Z", "AB", 0, 1, {}, ["A"]];

test("R99: weaker answers the weaker of two grade letters, null when either is not a BASIS_GRADES letter", () => {
  for (const [i, a] of BASIS_GRADES.entries())
    for (const [j, b] of BASIS_GRADES.entries()) assert.equal(weaker(a, b), BASIS_GRADES[Math.max(i, j)], `${a} ${b}`);
  for (const x of NOT_GRADES) for (const g of BASIS_GRADES) {
    assert.equal(weaker(x, g), null);
    assert.equal(weaker(g, x), null);
  }
});

test("R100: stepCovers — an unscoped step covers every page, an unreadable extent none, a page list its own pages", () => {
  for (const s of [undefined, null, "layer", 3, true]) assert.equal(stepCovers(s, 0), false);
  for (const page of [0, 5, -1, 1.5, "0", undefined]) assert.equal(stepCovers({ step: "ocr" }, page), true);
  assert.equal(stepCovers({ step: "ocr", extent: null }, 0), true);
  const scoped = { step: "ocr", extent: { kind: "pages", pages: [1, 3] } };
  for (const [page, want] of [[1, true], [3, true], [0, false], [2, false], ["1", false], [1.0, true], [undefined, false]])
    assert.equal(stepCovers(scoped, page), want, String(page));
  assert.equal(stepCovers({ extent: { kind: "pages", pages: [0], part: 1 } }, 0), true);
  /* Every extent this module cannot read (R22's [], R30) covers no page. */
  for (const bad of [{ kind: "pages", pages: [] }, { kind: "pages", pages: [-1] }, { kind: "pages", pages: [0.5] }, { kind: "range", pages: [0] },
    { kind: "pages", pages: [0], part: -1 }, { kind: "pages", pages: [0], part: "0" }, "all", [0], 0, { kind: "pages" }])
    for (const page of [0, 1]) assert.equal(stepCovers({ step: "ocr", extent: bad }, page), false, JSON.stringify(bad));
});

test("R101: CONFIDENCE_BASES is exactly engine and none, the bases checkConfidence admits", () => {
  assert.equal(Object.getPrototypeOf(CONFIDENCE_BASES), Object.prototype);
  assert.deepEqual(Object.keys(CONFIDENCE_BASES), ["engine", "none"]);
  for (const basis of Object.keys(CONFIDENCE_BASES))
    assert.notEqual(checkConfidence({ basis, value: 0.5 })?.code, "TEXT_CONFIDENCE_PSEUDO", basis);
  for (const basis of ["model", "self", "Engine", "", "toString", "__proto__"])
    assert.equal(checkConfidence({ basis, value: 0.5 }).code, "TEXT_CONFIDENCE_PSEUDO", basis);
});

test("R102: perPageTierWinner is R76's award for one page, and TIER_RULE states it", () => {
  const pg = (text, count = 0) => ({ page: 0, text, undetermined: count ? [{ count }] : [] });
  for (const p1 of [undefined, null, pg("a", 1)]) assert.equal(perPageTierWinner(p1, null), "tier1");
  assert.equal(perPageTierWinner(null, pg("")), "tier2");
  assert.equal(perPageTierWinner(undefined, pg("abc", 5)), "tier2");
  /* Both conditions, each strict, over a grid of undetermined counts and glyph counts. */
  for (const u1 of [0, 1, 3]) for (const u2 of [0, 1, 3]) for (const g1 of [0, 2, 4]) for (const g2 of [0, 2, 4]) {
    const p1 = pg(" x".repeat(g1), u1), p2 = pg("y\n".repeat(g2), u2);
    const want = u2 < u1 && g2 > g1 ? "tier2" : "tier1";
    assert.equal(perPageTierWinner(p1, p2), want, JSON.stringify([u1, u2, g1, g2]));
    /* The merge awards each page by the same rule. */
    const m = mergeTier2Text({ document: p1.text, pages: [p1] }, { pages: [p2] });
    assert.deepEqual(m.replaced, want === "tier2" ? [0] : []);
  }
  /* Whitespace never moves the award; a non-string text holds no glyph. */
  assert.equal(perPageTierWinner(pg("ab", 1), pg(" a \n b ", 0)), "tier1");
  assert.equal(perPageTierWinner(pg(null, 1), pg("a", 0)), "tier2");
  assert.equal(typeof TIER_RULE, "string");
  for (const said of [/tier 2 replaces tier 1/, /strictly fewer undetermined/, /strictly more decoded GLYPHS/, /keeps tier 1/]) assert.match(TIER_RULE, said);
});

test("R103: READING_POSITION_KINDS is exactly R61's four arms; READING_POSITION_UNPRODUCED is dom, which readingSource refuses", () => {
  assert.equal(Object.getPrototypeOf(READING_POSITION_KINDS), Object.prototype);
  assert.deepEqual(Object.keys(READING_POSITION_KINDS), ["pdf-page", "sheet-cell", "slide-shape", "doc-para"]);
  assert.equal(READING_POSITION_UNPRODUCED, "dom");
  assert.equal(readingSource({ kind: READING_POSITION_UNPRODUCED, ref: "x" }), null);
  const full = { ref: "r", page: 0, sheet: "S", cell: "A1", slide: 1, shape: 0, para: 0 };
  for (const kind of Object.keys(READING_POSITION_KINDS)) assert.equal(readingSource({ ...full, kind }).kind, kind);
});

test("N416: EXTENT_KINDS is internal, not exported", () => {
  assert.equal(Object.hasOwn(tc, "EXTENT_KINDS"), false);
});
