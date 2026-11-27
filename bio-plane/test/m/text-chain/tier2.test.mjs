/* text-chain: requirement-named tests for the page-wise tier-2 merge and its note
 * (build/requirements/text-chain.md R74-R80). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeTier2Text, tier2Note, glyphCount } from "../../../src/textchain.mjs";
/** @import { TierMerge, TierPage, TierText } from "../../../src/textchain.mjs" */

/**
 * A marker as a decode writes it: what the merge reads (count, reason, rect) and the fields it carries unread.
 * @typedef {{ page: number, reason: string, font: string | null, codes: string, count: number, rect?: number[] | null, image_share?: number, glyphs?: number, area_share?: number }} Marker
 */
/**
 * The other fields a page carries in these tests, which the merge keeps.
 * @typedef {{ tier?: 1 | 2, extra?: string, image_content_note?: string, other?: number, image_content_x?: number }} PageExtra
 */
/**
 * A page as a decode writes it.
 * @typedef {{ page: number, text: string, undetermined: Marker[], tier?: 1 | 2, extra?: string, image_content_note?: string, other?: number, image_content_x?: number }} Page
 */
/**
 * A decode as these tests write it.
 * @typedef {{ document: string, pages: Page[], undetermined: Marker[], counts: { chars?: number, undetermined?: number } }} Doc
 */

/** @param {number} page @param {string} text @param {Marker[]} [und] @param {PageExtra} [x] @returns {Page} */
const pg = (page, text, und = [], x = {}) => ({ page, text, undetermined: und, ...x });
/** @param {number} page @param {number} count @returns {Marker} */
const miss = (page, count) => ({ page, reason: "unmapped", font: "F1", codes: "", count });
/** @param {number} page @param {string} [reason] @returns {Marker} */
const img = (page, reason = "image_content_unread") => ({ page, reason, font: null, codes: "", count: 0, image_share: 0.5, glyphs: 2 });
/** @param {Page[]} pages @returns {Doc} */
const doc = (pages) => ({ document: pages.map((p) => p.text).join("\n"), pages, undetermined: pages.flatMap((p) => p.undetermined || []), counts: { chars: 0 } });
/** The merged text, where the merge answered one. @param {TierMerge} m @returns {TierText} */
const textOf = (m) => { assert.ok(m.ok === true, JSON.stringify(m)); const text = m.text; assert.ok(text); return text; };
/** The merged text's pages. @param {TierMerge} m @returns {TierPage[]} */
const pagesOf = (m) => { const pages = textOf(m).pages; assert.ok(pages); return pages; };
/** The merge's reason for refusing. @param {TierMerge} m @returns {string} */
const whyOf = (m) => { assert.ok(m.ok === false, JSON.stringify(m)); return m.why; };
/** A note, where there is one. @param {string | null} n @returns {string} */
const noted = (n) => { assert.ok(n !== null); return n; };

test("R74: no usable base pages and a base holding glyphs refuses, saying what was found", () => {
  const t2 = doc([pg(0, "tier two")]);
  /* A page numbered "0" and a document that is not text are wrong kinds on purpose: what a decode may hand over. */
  assert.doesNotThrow(() => {
    for (const base of [{ document: "x", pages: [] }, { document: " a ", pages: [{ page: "0" }] }, { document: "ab" }]) {
      const r = mergeTier2Text(base, t2);
      assert.equal(r.ok, false);
      assert.match(whyOf(r), new RegExp(`${glyphCount(base.document)} decoded glyph`));
      assert.match(whyOf(r), /page by page|page-wise|per-page/);
    }
    const r2 = mergeTier2Text({ document: 5, counts: { chars: 12 } }, t2);
    assert.equal(r2.ok, false);
    assert.match(whyOf(r2), /12 character/);
  });
});

test("R75: with nothing held, tier 2 is adopted whole", () => {
  /* A page numbered "x" and a document that is not text are wrong kinds on purpose: what a decode may hand over. */
  assert.doesNotThrow(() => {
    const t2 = doc([pg(0, "a"), pg(2, "b"), { page: "x", text: "c" }]);
    for (const base of [{ document: "  \n ", pages: [] }, { document: 7, counts: { chars: 0 } }, null, {}, { document: "", counts: { chars: 99 } }]) {
      assert.deepEqual(mergeTier2Text(base, t2), { ok: true, text: t2, wholesale: true, perPageTier: null, replaced: [0, 2], kept: [] });
    }
  });
  assert.deepEqual(mergeTier2Text(null, null).replaced, []);
});

test("R76: tier 2 wins a page only with strictly fewer undetermined AND strictly more glyphs; otherwise tier 1 is kept plus tier:1", () => {
  /** @type {readonly (readonly [string, number, string, number, boolean])[]} */
  const cases = [
    // [t1 text, t1 undetermined count, t2 text, t2 undetermined count, tier 2 wins?]
    ["ab", 3, "abc", 0, true],
    ["ab", 3, "a b", 0, false],      // equal glyphs (whitespace does not count)
    ["ab", 3, "a", 0, false],        // fewer glyphs
    ["ab", 0, "abcdef", 0, false],   // tier 1 admitted nothing
    ["ab", 2, "abcdef", 2, false],   // equal undetermined
    ["ab", 2, "abcdef", 3, false],
    ["", 1, "x", 0, true],
  ];
  for (const [t1, u1, t2, u2, win] of cases) {
    const b = pg(0, t1, u1 ? [miss(0, u1)] : [], { extra: "kept" });
    const c = pg(0, t2, u2 ? [miss(0, u2)] : []);
    const r = mergeTier2Text(doc([b]), doc([c]));
    assert.equal(r.ok, true);
    assert.deepEqual(pagesOf(r)[0], win ? { page: 0, text: t2, undetermined: c.undetermined, tier: 2 } : { ...b, tier: 1 },
      JSON.stringify([t1, u1, t2, u2]));
  }
  /* A page tier 2 does not offer keeps tier 1. */
  const r = mergeTier2Text(doc([pg(0, "a", [miss(0, 1)]), pg(1, "b", [miss(1, 1)])]), doc([pg(1, "bbbb")]));
  assert.deepEqual(pagesOf(r).map((p) => p.tier), [1, 2]);
});

test("R77: a page tier 2 wins keeps the base page's image_content_* markers and fields, unchanged", () => {
  const b = pg(0, "7", [miss(0, 3), img(0)], { image_content_note: "n", other: 1 });
  const c = pg(0, "seven words of text", []);
  const r = mergeTier2Text(doc([b]), doc([c]));
  assert.deepEqual(pagesOf(r)[0], { image_content_note: "n", page: 0, text: c.text, undetermined: [img(0)], tier: 2 });
  assert.deepEqual(textOf(r).undetermined, [img(0)]);
  /* Carried after tier 2's own markers; both kinds carried. */
  const b2 = pg(1, "", [miss(1, 5), img(1, "image_content_undetermined")]);
  const c2 = pg(1, "text", [miss(1, 1)]);
  assert.deepEqual(pagesOf(mergeTier2Text(doc([b2]), doc([c2])))[0]?.undetermined, [miss(1, 1), img(1, "image_content_undetermined")]);
  /* A page where tier 2 already states an image marker gets no second one. */
  const c3 = pg(1, "text", [img(1)]);
  assert.deepEqual(pagesOf(mergeTier2Text(doc([b2]), doc([c3])))[0]?.undetermined, [img(1)]);
  /* The carried marker counts 0 undetermined characters: the award is unmoved by it. */
  const lose = mergeTier2Text(doc([pg(0, "ab", [img(0)])]), doc([pg(0, "abcdef")]));
  assert.deepEqual(lose.kept, [0]);
  /* A page tier 1 keeps is unchanged, markers and all. */
  const kept = pg(2, "abcdef", [img(2)], { image_content_x: 1 });
  assert.deepEqual(pagesOf(mergeTier2Text(doc([kept]), doc([pg(2, "a")])))[0], { ...kept, tier: 1 });
});

test("R78: the page-wise result carries the merged text, counts and the per-page tiers", () => {
  const base = { ...doc([pg(0, "one", []), pg(1, "tw", [miss(1, 2)]), pg(2, "", [miss(2, 1)])]), source: "kept", counts: { chars: 1, undetermined: 9 } };
  const t2 = doc([pg(0, "one!!"), pg(1, "two two"), pg(2, "", [])]);
  const r = mergeTier2Text(base, t2);
  const { pages: held, ...rest } = base;
  /** @type {TierPage[]} */
  const pages = [{ ...held[0], tier: 1 }, { page: 1, text: "two two", undetermined: [], tier: 2 }, { ...held[2], tier: 1 }];
  const document = "one\ntwo two";
  assert.deepEqual(r, {
    ok: true, wholesale: false, replaced: [1], kept: [0, 2], perPageTier: { tier1: [0, 2], tier2: [1] },
    text: { ...rest, document, pages, undetermined: [miss(2, 1)], counts: { chars: document.length, undetermined: 1 } },
  });
});

test("R79: tier2Note is m.why (or null) when not ok, null when wholesale, null when nothing replaced", () => {
  assert.equal(tier2Note({ ok: false, why: "because" }), "because");
  assert.equal(tier2Note({ ok: false }), null);
  assert.equal(tier2Note(null), null);
  assert.equal(tier2Note(undefined), null);
  assert.equal(tier2Note({ ok: true, wholesale: true, replaced: [0], kept: [] }), null);
  assert.equal(tier2Note({ ok: true, wholesale: false, replaced: [], kept: [0, 1] }), null);
});

test("R80: otherwise a sentence of pages recovered and kept, plus the per-page clause when both are non-empty", () => {
  const both = noted(tier2Note({ ok: true, wholesale: false, replaced: [1, 3], kept: [0] }));
  assert.match(both, /^2 page\(s\) .*tier-2.* the other 1 page\(s\) kept tier 1's reading; .*chain names the tier per page$/);
  const only = noted(tier2Note({ ok: true, wholesale: false, replaced: [0, 1, 2], kept: [] }));
  assert.match(only, /^3 page\(s\) /);
  assert.doesNotMatch(only, /per page/);
  /* Consistent with a real merge. */
  const m = mergeTier2Text(doc([pg(0, "a", [miss(0, 1)]), pg(1, "bbbb")]), doc([pg(0, "aaaa"), pg(1, "b")]));
  assert.match(noted(tier2Note(m)), /^1 page\(s\) .*other 1 page\(s\)/);
});

test("R90: a page tier 2 wins keeps each of the base page's image_unread markers, after tier 2's own, unless tier 2 states the same one", () => {
  /** @param {number} page @param {number[] | null} rect @returns {Marker} */
  const unread = (page, rect) => ({ page, reason: "image_unread", font: null, codes: "", count: 0, rect, area_share: 0.5 });
  const A = unread(0, [0, 0, 100, 100]), B = unread(0, [0, 200, 100, 300]);
  const b = pg(0, "7", [miss(0, 3), A, B]);
  /* Both carried, in the base's order, after tier 2's own markers. */
  const r = mergeTier2Text(doc([b]), doc([pg(0, "seven words", [miss(0, 1)])]));
  assert.deepEqual(r.replaced, [0]);
  assert.deepEqual(pagesOf(r)[0]?.undetermined, [miss(0, 1), A, B]);
  assert.deepEqual(textOf(r).undetermined, [miss(0, 1), A, B]);
  assert.equal(textOf(r).counts?.undetermined, 3);
  /* One tier 2 already states (same reason and rect) is not duplicated; another rect is still carried. */
  const r2 = mergeTier2Text(doc([b]), doc([pg(0, "seven words", [{ ...A, font: "x" }])]));
  assert.deepEqual(pagesOf(r2)[0]?.undetermined, [{ ...A, font: "x" }, B]);
  /* A rectless marker matches only a rectless one. */
  /* Its rect stated undefined, as a decode copying an absent rect writes it: a wrong kind on purpose. */
  assert.doesNotThrow(() => {
    const C = unread(0, undefined);
    const r3 = mergeTier2Text(doc([pg(0, "7", [miss(0, 3), C])]), doc([pg(0, "seven words", [unread(0, [1, 1, 2, 2])])]));
    assert.deepEqual(pagesOf(r3)[0]?.undetermined, [unread(0, [1, 1, 2, 2]), C]);
    assert.deepEqual(pagesOf(mergeTier2Text(doc([pg(0, "7", [miss(0, 3), C])]), doc([pg(0, "seven words", [unread(0, null)])])))[0]?.undetermined,
      [unread(0, null)]);
  });
  /* Carried beside image_content_* markers, each by its own rule, in the base's order. */
  const r4 = mergeTier2Text(doc([pg(0, "7", [A, miss(0, 3), img(0)])]), doc([pg(0, "seven words")]));
  assert.deepEqual(pagesOf(r4)[0]?.undetermined, [A, img(0)]);
  /* It counts 0 undetermined characters: a base whose only markers are image_unread never loses the page. */
  assert.deepEqual(mergeTier2Text(doc([pg(0, "ab", [A, B])]), doc([pg(0, "abcdef")])).kept, [0]);
  /* A page tier 1 keeps is unchanged, markers and all; other reasons are never carried. */
  const kept = pg(1, "abcdef", [A]);
  assert.deepEqual(pagesOf(mergeTier2Text(doc([kept]), doc([pg(1, "a")])))[0], { ...kept, tier: 1 });
  const other = mergeTier2Text(doc([pg(0, "7", [miss(0, 3), { ...A, reason: "image_unreadable" }])]), doc([pg(0, "seven words")]));
  assert.deepEqual(pagesOf(other)[0]?.undetermined, []);
});
