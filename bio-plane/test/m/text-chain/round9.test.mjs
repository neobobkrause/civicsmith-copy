/* text-chain, fix round 9 (T51; G141, G131g, G124e): R39 (1-based page spelling), R73 (NUL and U+FFFD are no glyphs),
 * R105 (mergeTier2Text drops no page), R106 (appendStep in linear work), and R93/R95 at the width a sheet can have
 * (build/requirements/text-chain.md). No time is asserted: R106 counts steps inspected. */
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import {
  STEP_KINDS, appendStep, layerChain, convertedChain, mergedChain, derivationCap, describeChain, stepCovers,
  mergeTier2Text, tier2Note, glyphCount, canonicalRange, a1ToRowCol, rangeCorners, CONTENT_EXTENT_RANGE_RE,
} from "../../../src/textchain.mjs";
/** @import { Chain, PagesExtent, Refusal, Step, StepKind, TierMarker, TierMerge, TierPage, TierText } from "../../../src/textchain.mjs" */

/** @param {Chain | Refusal | null} r @returns {Chain} */
const chainOf = (r) => { assert.ok(Array.isArray(r), JSON.stringify(r)); return r; };
/** @param {Chain | Refusal} r @returns {Refusal} */
const refusalOf = (r) => { assert.ok(!Array.isArray(r), JSON.stringify(r)); return r; };
/** The entry at `i`, asserted present. @template T @param {readonly T[]} xs @param {number} i @returns {T} */
const nth = (xs, i) => { const x = xs[i]; assert.ok(x !== undefined, `no entry ${i}`); return x; };
/** The pages a step's extent names, where it is a pages extent. @param {Step} s @returns {number[] | undefined} */
const pagesOfStep = (s) => { const e = s.extent; return e && e.kind === "pages" ? e.pages : undefined; };
/** A merge's text, the merge asserted ok and the text present. @param {TierMerge} r @returns {TierText} */
const textOf = (r) => { assert.ok(r.ok, JSON.stringify(r)); const t = r.text; assert.ok(t, "the merge holds no text"); return t; };
/** A decode's pages, asserted present. @param {TierText} t @returns {TierPage[]} */
const pagesIn = (t) => { const p = t.pages; assert.ok(p, "the decode holds no pages"); return p; };

/** @param {"layer" | "ocr"} k */
const LABEL = (k) => STEP_KINDS[k].label;
/** @param {Step} step @param {number[]} pages @param {{ part?: number }} [extra] @returns {Step & { extent: PagesExtent }} */
const scoped = (step, pages, extra = {}) => ({ ...step, extent: { kind: "pages", pages, ...extra } });

/* ------------------------------------------------------------------ R39 */

test("R39 (G141): the chain sentence spells a page 1-based, as a reader counts, and the stored numbers stay 0-based", () => {
  const layer = scoped({ step: "layer" }, [0]);
  assert.equal(describeChain([layer]), `${LABEL("layer")} (page 1)`);
  assert.equal(describeChain([scoped({ step: "layer" }, [0, 1, 2])]), `${LABEL("layer")} (pages 1-3)`);
  assert.equal(describeChain([scoped({ step: "layer" }, [0, 2, 3, 9])]), `${LABEL("layer")} (pages 1, 3-4, 10)`);
  assert.equal(describeChain([scoped({ step: "ocr", engine: "e" }, [41])]), `${LABEL("ocr")} (e) (page 42)`);
  /* Storage is untouched: the extent is still the 0-based list, and it answers the 0-based page. */
  assert.deepEqual(layer.extent.pages, [0]);
  assert.equal(stepCovers(layer, 0), true);
  assert.equal(stepCovers(layer, 1), false);
  assert.equal(derivationCap([{ ...layer, cap: "C" }], { page: 0 }), "C");
  assert.equal(derivationCap([{ ...layer, cap: "C" }], { page: 1 }), null);
  /* A merged chain spells its parts' pages the same way, and its stored extents keep the 0-based numbers. */
  const m = chainOf(mergedChain([{ chain: layerChain({}), pages: [0, 1] }, { chain: appendStep(layerChain({}), { step: "ocr", engine: "e" }), pages: [2] }]));
  assert.deepEqual(m.map(pagesOfStep), [[0, 1], [2], [2]]);
  assert.match(describeChain(m), /\(pages 1-2\) -> .*\(page 3\) -> .*\(page 3\)$/);
});

/* ------------------------------------------------------------------ R73 */

test("R73 (G131g): NUL and the replacement character are no glyphs; every other non-whitespace code point still is", () => {
  assert.equal(glyphCount("\u0000"), 0);
  assert.equal(glyphCount("�"), 0);
  assert.equal(glyphCount("��\u0000 \u0000�"), 0);
  assert.equal(glyphCount("Caf� r�sum�"), 7);
  assert.equal(glyphCount("a\u0000b�c"), 3);
  assert.equal(glyphCount("ab��"), 2);
  /* An astral character beside the failures counts once; a lone surrogate (a failure of another kind) still counts. */
  assert.equal(glyphCount("\u{1F600}�"), 1);
  assert.equal(glyphCount("\ud800\u0000"), 1);
  /* A whole page of failures holds nothing: it neither refuses a tier-2 merge by its glyphs (R74) ... */
  /** @type {TierText} */
  const failed = { document: "�".repeat(50), pages: [] };
  const whole = mergeTier2Text(failed, { document: "ok", pages: [{ page: 0, text: "ok" }] });
  assert.ok(whole.ok, JSON.stringify(whole));
  assert.deepEqual(whole.wholesale, true);
  /* ... nor wins a page by them (R76): tier 2's U+FFFD run offers no glyph tier 1 lacks. */
  const win = mergeTier2Text(
    { document: "ab", pages: [{ page: 0, text: "ab", undetermined: [{ count: 3 }] }] },
    { document: "", pages: [{ page: 0, text: "����", undetermined: [] }] });
  assert.deepEqual(win.kept, [0]);
  assert.deepEqual(win.replaced, []);
});

/* ------------------------------------------------------------------ R105 */

/** @param {number} page @param {string} text @param {TierMarker[]} [und] @param {TierPage} [x] @returns {TierPage} */
const pg = (page, text, und = [], x = {}) => ({ page, text, undetermined: und, ...x });
/** @param {number} page @param {number} count @returns {TierMarker & { page: number, font: string, codes: string }} */
const miss = (page, count) => ({ page, reason: "unmapped", font: "F1", codes: "", count });
/** @param {TierPage[]} pages @param {TierText} [extra] @returns {TierText & { pages: TierPage[] }} */
const doc = (pages, extra = {}) => ({ document: pages.map((p) => p.text).join("\n"), pages, undetermined: [], counts: { chars: 0 }, ...extra });

test("R105 (G141): a base page with no integer page is kept as tier 1, after the numbered pages, listed in kept", () => {
  /** @type {TierPage} */
  const loose = { text: "loose", undetermined: [] }, loose2 = { page: "7", text: "seven", undetermined: [miss(7, 2)] };
  /* loose2's page is a string on purpose (a page with no integer page), so the merge is made inside doesNotThrow. */
  /** @type {{ r: TierMerge | null }} */
  const out = { r: null };
  assert.doesNotThrow(() => {
    const base = doc([loose, pg(0, "zero", [miss(0, 1)]), loose2, pg(1, "one")]);
    out.r = mergeTier2Text(base, doc([pg(0, "zero!!"), pg(1, "one")]));
  });
  const r = out.r;
  assert.ok(r !== null);
  assert.equal(r.ok, true);
  const text = textOf(r);
  assert.deepEqual(text.pages, [
    { page: 0, text: "zero!!", undetermined: [], tier: 2 },
    { ...pg(1, "one"), tier: 1 },
    { ...loose, tier: 1 },
    { ...loose2, tier: 1 },
  ]);
  assert.deepEqual(r.replaced, [0]);
  assert.deepEqual(r.kept, [1, null, null]);
  assert.deepEqual(r.perPageTier, { tier1: [1, null, null], tier2: [0] });
  const document = text.document, counts = text.counts;
  assert.equal(document, "zero!!\none\nloose\nseven");
  assert.deepEqual(text.undetermined, [miss(7, 2)]);
  assert.ok(counts, "the merge counts nothing");
  assert.equal(counts.chars, document.length);
  assert.equal(counts.undetermined, 1);
});

test("R105 (G141): a tier-2 page the base lacks is adopted as tier 2 at its page number, listed in replaced", () => {
  const r = mergeTier2Text(doc([pg(0, "a"), pg(3, "d")]), doc([pg(1, "bb", [miss(1, 1)]), pg(5, "ee"), pg(2, "cc")]));
  assert.deepEqual(pagesIn(textOf(r)).map((p) => [p.page, p.tier]), [[0, 1], [1, 2], [2, 2], [3, 1], [5, 2]]);
  assert.deepEqual(pagesIn(textOf(r))[1], { page: 1, text: "bb", undetermined: [miss(1, 1)], tier: 2 });
  assert.deepEqual(r.replaced, [1, 2, 5]);
  assert.deepEqual(r.kept, [0, 3]);
  assert.deepEqual(r.perPageTier, { tier1: [0, 3], tier2: [1, 2, 5] });
  assert.equal(textOf(r).document, "a\nbb\ncc\nd\nee");
  assert.deepEqual(textOf(r).undetermined, [miss(1, 1)]);
  /* A tier-2 page of the base's own pages is still the award of R76, not an adoption. */
  const own = mergeTier2Text(doc([pg(0, "ab", [miss(0, 3)])]), doc([pg(0, "abc"), pg(1, "x")]));
  assert.deepEqual(pagesIn(textOf(own)).map((p) => [p.page, p.tier]), [[0, 2], [1, 2]]);
  /* Of two tier-2 pages with one number, absent from the base, the later is the page: once, never twice. */
  const dup = mergeTier2Text(doc([pg(0, "a")]), doc([pg(4, "first"), pg(4, "second")]));
  assert.deepEqual(pagesIn(textOf(dup)).filter((p) => p.page === 4), [{ page: 4, text: "second", undetermined: [], tier: 2 }]);
  assert.deepEqual(dup.replaced, [4]);
});

test("R105 (G141): a tier-2 page with no integer page is adopted as tier 2 after the numbered pages, in its own order", () => {
  const r = mergeTier2Text(
    doc([{ text: "base loose" }, pg(0, "a")]),
    doc([{ text: "t2 loose 1", undetermined: [miss(0, 1)] }, pg(2, "c"), { page: null, text: "t2 loose 2" }]));
  assert.deepEqual(pagesIn(textOf(r)).map((p) => [p.page ?? null, p.tier, p.text]), [
    [0, 1, "a"], [2, 2, "c"], [null, 1, "base loose"], [null, 2, "t2 loose 1"], [null, 2, "t2 loose 2"],
  ]);
  assert.deepEqual(nth(pagesIn(textOf(r)), 3).undetermined, [miss(0, 1)]);
  assert.deepEqual(r.kept, [0, null]);
  assert.deepEqual(r.replaced, [2, null, null]);
  assert.equal(textOf(r).document, "a\nc\nbase loose\nt2 loose 1\nt2 loose 2");
});

test("R105 (G141): every page of both inputs is in the merge exactly once, and the note counts them", () => {
  const base = doc([pg(0, "a"), pg(2, "c"), { text: "x" }, pg(4, "e")]);
  const t2 = doc([pg(2, "cc"), pg(3, "d"), pg(9, "i"), { text: "y" }]);
  const r = mergeTier2Text(base, t2);
  const pages = pagesIn(textOf(r));
  assert.equal(pages.length, 4 + 2 + 1); // 4 base pages + t2's pages 3 and 9 + t2's unnumbered one
  assert.equal(r.replaced.length + r.kept.length, pages.length);
  assert.deepEqual(pages.filter((p) => Number.isInteger(p.page)).map((p) => p.page), [0, 2, 3, 4, 9]);
  const note = tier2Note(r) ?? "";
  assert.match(note, new RegExp(`^${r.replaced.length} page\\(s\\) `));
  assert.match(note, new RegExp(`the other ${r.kept.length} page\\(s\\)`));
  /* The input documents are not mutated. */
  assert.deepEqual(base.pages.map((p) => p.tier), [undefined, undefined, undefined, undefined]);
  assert.deepEqual(t2.pages.map((p) => p.tier), [undefined, undefined, undefined, undefined]);
  /* A merge in which every page is a base page with a number reads as before (R76, R78). */
  const plain = mergeTier2Text(doc([pg(0, "a"), pg(1, "b")]), doc([pg(0, "a"), pg(1, "b")]));
  assert.deepEqual(pagesIn(textOf(plain)).map((p) => p.tier), [1, 1]);
  assert.deepEqual(plain.replaced, []);
});

/* ------------------------------------------------------------------ R106 */

/* Reads of `STEP_KINDS.layer.role` are the module asking what a step of that kind is: one per step inspected.
   node:test's property mock counts them, keeps the value, and puts the property back. */
/** @param {() => void} run @returns {number} */
function countingRoleReads(run) {
  const entry = STEP_KINDS.layer;
  const role = mock.property(entry, "role", entry.role);
  try { run(); } finally { role.mock.restore(); }
  return role.mock.accesses.filter((a) => a.type === "get").length;
}

test("R106 (G141): 5,000 appendStep calls inspect at most 4 times 5,000 steps in all", () => {
  /** @type {number} */
  const N = 5000;
  /** @type {Chain[]} */
  const built = [];
  const reads = countingRoleReads(() => {
    let chain = layerChain({ cap: "D" });
    for (let i = 1; i < N; i++) {
      const r = appendStep(chain, i % 3 ? { step: "layer", cap: "D" } : { step: "ocr", engine: "e", cap: "D" });
      assert.ok(Array.isArray(r), JSON.stringify(r));
      chain = r;
    }
    built.push(chain);
  });
  const chain = nth(built, 0);
  assert.equal(chain.length, N);
  assert.ok(reads <= 4 * N, `${reads} steps inspected`);
  /* The control: the whole check a chain built by hand gets inspects every layer step of it (3,334 of the 5,000)
     for ONE append, so the same 5,000 appends, each checked whole, would inspect millions. */
  const byHand = chain.map((s) => ({ ...s }));
  const whole = countingRoleReads(() => { assert.ok(Array.isArray(appendStep(byHand, { step: "layer", cap: "D" }))); });
  assert.ok(whole >= 3334, `${whole} steps inspected by the whole check`);
  /* The refusal comes at the end of a long chain exactly as at the start of one (R13). */
  const refused = refusalOf(appendStep(chain, { step: "layer", cap: "A" }));
  assert.equal(refused.code, "TEXT_CHAIN_STRENGTHENS");
  assert.deepEqual(refused, appendStep(byHand, { step: "layer", cap: "A" }));
  assert.equal(chain.length, N);
});

/* mulberry32: a fixed seed, so the sequence is the same on every run. */
/** @param {number} seed @returns {() => number} */
function prng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

test("R106 (G141): an append to a chain this module returned answers exactly what the whole check answers, branches and refusals included", () => {
  const rnd = prng(106);
  /** @template T @param {readonly T[]} xs @returns {T | undefined} */
  const pick = (xs) => xs[Math.floor(rnd() * xs.length)];
  const caps = [null, null, "A", "B", "C", "D"];
  const extents = [undefined, undefined, undefined, { kind: "pages", pages: [0] }, { kind: "pages", pages: [0, 1] }, { kind: "pages", pages: [2] },
    { kind: "pages", pages: [] }, { kind: "nope" }, { kind: "pages", pages: [1], part: 1 }];
  const makers = [
    () => ({ step: "layer", cap: pick(caps) }),
    () => ({ step: "pixels" }),
    () => ({ step: "ocr", engine: "e", cap: pick(caps) }),
    () => ({ step: "ai", engine: "m", cap: pick(caps) }),
    () => ({ step: "attested", member: "m", at: "t" }),
    () => ({ step: "typed", member: "m" }),
    () => ({ step: "convert", engine: "h", format: "odt", ...(rnd() < 0.5 ? { cap: pick(caps), calibration: "CAL-1" } : {}) }),
    () => ({ step: "ai_transcription", engine: "v" }),
    () => ({ step: "nope" }),
    () => ({ step: "ocr" }),
  ];
  /** The kind a step names, read from `STEP_KINDS` by its written-out keys; undefined for a name that is none.
   *  @param {string} name @returns {StepKind | undefined} */
  const kindNamed = (name) => {
    switch (name) {
      case "layer": return STEP_KINDS.layer;
      case "pixels": return STEP_KINDS.pixels;
      case "ocr": return STEP_KINDS.ocr;
      case "ai": return STEP_KINDS.ai;
      case "ai_transcription": return STEP_KINDS.ai_transcription;
      case "attested": return STEP_KINDS.attested;
      case "convert": return STEP_KINDS.convert;
      case "typed": return STEP_KINDS.typed;
      default: return undefined;
    }
  };
  const stepOf = () => {
    const s = nth(makers, Math.floor(rnd() * makers.length))(); const e = pick(extents); const kind = kindNamed(s.step);
    return e && kind && kind.role === "derivation" ? { ...s, extent: e } : s;
  };
  /** @type {Chain[]} */
  const pool = [layerChain({ cap: "C" }), layerChain({}), chainOf(convertedChain({ step: "convert", engine: "h", format: "odt" }, layerChain({ cap: "D" }))),
    chainOf(mergedChain([{ chain: layerChain({ cap: "B" }), pages: [0, 1] }, { chain: [{ step: "ocr", engine: "e", cap: "D" }], pages: [1, 2] }]))];
  let appended = 0, refused = 0;
  for (let i = 0; i < 1500; i++) {
    const chain = nth(pool, Math.floor(rnd() * pool.length)), step = stepOf();
    const byHand = chain.map((s) => { const c = { ...s }; const e = s.extent; if (e) c.extent = { ...e }; return c; });
    const got = appendStep(chain, step), want = appendStep(byHand, step);
    assert.deepEqual(got, want, JSON.stringify([chain, step]));
    assert.equal(derivationCap(chain), derivationCap(byHand));
    if (Array.isArray(got)) {
      appended++;
      assert.equal(derivationCap(got), derivationCap(got.map((s) => ({ ...s }))));
      assert.equal(describeChain(got), describeChain(got.map((s) => ({ ...s }))));
      pool.push(got);
    } else refused++;
  }
  assert.ok(appended > 300 && refused > 100, `${appended} appended, ${refused} refused`);
  /* A chain pushed to after it was returned is checked whole again: the bad step is not skipped over. */
  const base = layerChain({});
  base.push({ step: "nope" });
  assert.equal(refusalOf(appendStep(base, { step: "layer" })).code, "TEXT_CHAIN_STEP_UNKNOWN");
});

/* ------------------------------------------------------------------ G124e */

test("R93 R95 (G124e): the A1 shape holds to the last column a sheet can have (XFD, 16,384) and past it stays kept at three letters", () => {
  assert.equal(a1ToRowCol("XFD1")?.col, 16384);
  assert.equal(a1ToRowCol("ZZZ1")?.col, 18278);
  assert.deepEqual(rangeCorners("A1:XFD200"), { r0: 1, c0: 1, r1: 200, c1: 16384 });
  assert.equal(canonicalRange("a1:$XFD$200"), "A1:XFD200");
  assert.equal(canonicalRange("XFD200:A1"), "A1:XFD200");
  assert.equal(canonicalRange("ZZZ1"), "ZZZ1:ZZZ1");
  /* The four-letter form is kept as it is: not a cell, not a range. */
  for (const s of ["AAAA1", "AAAA1:B2", "A1:AAAA2"]) {
    assert.equal(CONTENT_EXTENT_RANGE_RE.test(s), false, s);
    assert.equal(canonicalRange(s), null, s);
    assert.equal(rangeCorners(s), null, s);
  }
  assert.equal(a1ToRowCol("AAAA1"), null);
});
