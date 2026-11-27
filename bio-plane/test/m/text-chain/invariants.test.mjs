/* text-chain: requirement-named tests for the module's invariants (build/requirements/text-chain.md
 * R82-R86), driven over every exported service with well-formed and malformed inputs. */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as tc from "../../../src/textchain.mjs";
/** @import { Chain, Refusal, Step, TextChainCode } from "../../../src/textchain.mjs" */

const { TEXT_CHAIN_CHECKS } = tc;

/** An object read member by member, each as any value. @typedef {{ readonly [key: string]: unknown }} Members */
/** @param {unknown} v @returns {v is Members} */
const isMembers = (v) => v !== null && typeof v === "object";
/** A refusal of this module's (every check function's "no"), as a service may answer one. */
/** @param {unknown} r @returns {r is Refusal} */
const isRefusal = (r) => isMembers(r) && r.ok === false && Boolean(r.code);
/** @param {Chain | Refusal | null} r @returns {Refusal} */
const refusalOf = (r) => { assert.ok(r !== null && !Array.isArray(r), JSON.stringify(r)); return r; };

/** @type {readonly unknown[]} */
const JUNK = [undefined, null, 0, -1, 1.5, NaN, "", "x", "ocr", true, [], [null], [{}], {}, { page: -1 },
  { kind: "pages", pages: [] }, { step: "ocr" }, [{ step: "layer", extent: "x" }], Symbol("s"), () => 1,
  { __proto__: null }];
const CHAIN = [{ step: "layer", cap: null, extent: { kind: "pages", pages: [0] } }, { step: "pixels", extent: { kind: "pages", pages: [1] } },
  { step: "ocr", engine: "e", cap: "C", extent: { kind: "pages", pages: [1] } }, { step: "attested", member: "m", at: "d", extent: { kind: "document" } }];
/** @type {readonly unknown[]} */
const GOOD = [
  CHAIN,
  { page: 1, rect: [0, 0, 1, 1] }, { kind: "pdf-page", ref: "r", page: 0, rect: [0, 0, 5, 5] },
  { document: "a", pages: [{ page: 0, text: "a", undetermined: [{ count: 1 }] }] }, { basis: "engine", value: 0.5 },
];

/** A service of the module, called with two inputs and a third drawn from the same set. @typedef {(a: unknown, b: unknown, c: unknown) => unknown} Service */
/* Every exported function of the module, each called as the module states it takes its arguments. Where a function
 * types a parameter, the junk is passed on purpose, inside the doesNotThrow that R83 asserts of it. */
/** @type {readonly (readonly [string, Service])[]} */
const SERVICES = [
  ["a1ToRowCol", (a) => tc.a1ToRowCol(a)],
  ["appendStep", (a, b) => tc.appendStep(a, b)],
  ["applyConfidenceFloor", (a, b) => tc.applyConfidenceFloor(a, b)],
  ["calibrationsOf", (a) => tc.calibrationsOf(a)],
  ["canonicalExtent", (a) => tc.canonicalExtent(a)],
  ["canonicalRange", (a) => tc.canonicalRange(a)],
  ["captureBound", (a, b) => {
    /** @type {unknown} */
    let r = null;
    assert.doesNotThrow(() => { r = tc.captureBound(a, b); });
    return r;
  }],
  ["chainKindFor", (a, b) => tc.chainKindFor(a, b)],
  ["checkAnchor", (a) => tc.checkAnchor(a)],
  ["checkAttestation", (a) => tc.checkAttestation(a)],
  ["checkChain", (a) => tc.checkChain(a)],
  ["checkConfidence", (a) => tc.checkConfidence(a)],
  ["contentCitedAs", (a) => tc.contentCitedAs(a)],
  ["convertedChain", (a, b) => tc.convertedChain(a, b)],
  ["derivationCap", (a, b) => tc.derivationCap(a, b)],
  ["describeChain", (a) => tc.describeChain(a)],
  ["describeExtent", (a) => tc.describeExtent(a)],
  ["extentCovers", (a, b) => tc.extentCovers(a, b)],
  ["glyphCount", (a) => {
    /** @type {unknown} */
    let r = null;
    assert.doesNotThrow(() => { r = tc.glyphCount(a); });
    return r;
  }],
  ["gradeCeiling", (a, b, c) => tc.gradeCeiling(a, b, c)],
  ["isTranscribed", (a) => tc.isTranscribed(a)],
  ["layerChain", (a) => {
    /** @type {unknown} */
    let r = null;
    assert.doesNotThrow(() => { r = tc.layerChain(a); });
    return r;
  }],
  ["mergeTier2Text", (a, b) => {
    /** @type {unknown} */
    let r = null;
    assert.doesNotThrow(() => { r = tc.mergeTier2Text(a, b); });
    return r;
  }],
  ["mergedChain", (a) => tc.mergedChain(a)],
  ["perPageTierWinner", (a, b) => {
    /** @type {unknown} */
    let r = null;
    assert.doesNotThrow(() => { r = tc.perPageTierWinner(a, b); });
    return r;
  }],
  ["rangeCorners", (a) => tc.rangeCorners(a)],
  ["readingOccurrenceKey", (a) => tc.readingOccurrenceKey(a)],
  ["readingPositionInExtent", (a, b, c) => tc.readingPositionInExtent(a, b, c)],
  ["readingSource", (a) => tc.readingSource(a)],
  ["readingSourceFromColumns", (a, b, c) => tc.readingSourceFromColumns(a, b, c)],
  ["readingSourceJson", (a) => tc.readingSourceJson(a)],
  ["rectSpace", (a) => tc.rectSpace(a)],
  ["stepCovers", (a, b) => tc.stepCovers(a, b)],
  ["terminalStep", (a) => tc.terminalStep(a)],
  ["tier2Note", (a) => {
    /** @type {unknown} */
    let r = null;
    assert.doesNotThrow(() => { r = tc.tier2Note(a); });
    return r;
  }],
  ["tiersEvidenced", (a) => tc.tiersEvidenced(a)],
  ["weaker", (a, b) => tc.weaker(a, b)],
];
/* The module's exports that are not functions: with SERVICES, every name it exports, so a new function cannot be missed. */
const VALUES = ["CHAIN_KIND_MIXED", "CONFIDENCE_BASES", "CONTENT_EXTENT_A1_RE", "CONTENT_EXTENT_KINDS", "CONTENT_EXTENT_RANGE_RE",
  "MACHINE_READ_KINDS", "READING_POSITION_KINDS", "READING_POSITION_UNPRODUCED", "RECT_USER_SPACE", "STEP_KINDS",
  "TEXT_CHAIN_CHECKS", "TIER_RULE"];
/** @type {readonly TextChainCode[]} */
const CODES = ["TEXT_CHAIN_COLLAPSED", "TEXT_CHAIN_EMPTY", "TEXT_CHAIN_STEP_SHAPE", "TEXT_CHAIN_STEP_UNKNOWN",
  "TEXT_CHAIN_STEP_UNNAMED", "TEXT_CHAIN_STRENGTHENS", "TEXT_CONFIDENCE_PSEUDO", "TEXT_CONFIDENCE_SHAPE", "TEXT_ANCHOR_MISSING",
  "TEXT_ATTEST_MACHINE", "TEXT_ATTEST_EXTENT", "TEXT_CHAIN_CAL_REF", "TEXT_CHAIN_LETTER_UNCALIBRATED", "TEXT_CHAIN_LETTER_ON_PERSON"];
const inputs = [...JUNK, ...GOOD];

/* Every service over every pair of inputs, plus a third drawn from the same set. */
/** @returns {Generator<readonly [string, Service, unknown, unknown], void, unknown>} */
function* calls() {
  assert.deepEqual(Object.keys(tc).sort(), [...SERVICES.map(([name]) => name), ...VALUES].sort());
  for (const [name, fn] of SERVICES)
    for (const a of inputs) for (const b of inputs) yield [name, fn, a, b];
}

test("R82: pure — the same inputs always give the same answer, with no clock, network or store reached", (t) => {
  /** @type {string[]} */
  const reached = [];
  t.mock.method(Date, "now", () => { reached.push("clock"); return 0; });
  t.mock.method(globalThis, "fetch", () => { reached.push("network"); return Promise.reject(new Error("no")); });
  t.mock.method(globalThis, "Date", new Proxy(Date, { construct: (T) => { reached.push("clock"); return new T(0); } }));
  try {
    for (const [name, fn, a, b] of calls()) {
      /** @type {unknown} */
      let one;
      /** @type {unknown} */
      let two;
      try { one = fn(a, b, CHAIN); } catch { continue; } // R83 is asserted below
      try { two = fn(a, b, CHAIN); } catch { continue; }
      assert.deepEqual(one, two, `${name} is not deterministic`);
    }
  } finally { t.mock.restoreAll(); }
  assert.deepEqual(reached, []);
});

test("R83: no service throws on any input, and a bad extent or position never reads as covering everything", () => {
  /** @type {string[]} */
  const thrown = [];
  for (const [name, fn, a, b] of calls()) {
    try { fn(a, b, CHAIN); } catch (e) {
      thrown.push(`${name}(${[a, b, CHAIN].map((x) => typeof x).join(",")}): ${String(e instanceof Error ? e.message : e)}`);
    }
  }
  assert.deepEqual(thrown, []);
  for (const bad of [{ kind: "pages", pages: [] }, { kind: "x" }, "all", 3])
    assert.equal(tc.derivationCap([{ step: "ocr", engine: "e", cap: "A", extent: bad }], { page: 0 }), null);
  for (const bad of JUNK) {
    assert.equal(tc.extentCovers(bad, { page: 0, rect: [0, 0, 1, 1] }), false);
    for (const k of ["pdf-page", "sheet-cell", "sheet-range", "doc-para", "slide-shape"])
      assert.equal(tc.readingPositionInExtent(bad, k, bad), false);
  }
});

test("R84: no place is named in anything the module answers", () => {
  const PLACES = /oakland|alameda|california|berkeley|san francisco/i;
  /** @type {string[]} */
  const said = [];
  /** @param {unknown} v @param {number} [depth] */
  const collect = (v, depth = 0) => {
    if (typeof v === "string") said.push(v);
    else if (isMembers(v) && depth < 6) for (const x of Object.values(v)) collect(x, depth + 1);
  };
  collect(tc.STEP_KINDS); collect(tc.TIER_RULE);
  for (const [, fn, a, b] of calls()) { try { collect(fn(a, b, CHAIN)); } catch { /* R83 */ } }
  assert.deepEqual(Object.keys(TEXT_CHAIN_CHECKS).sort(), [...CODES].sort());
  for (const code of CODES) {
    const row = TEXT_CHAIN_CHECKS[code];
    said.push(code, row.check, row.where, row.translation);
  }
  assert.ok(said.length > 1000);
  assert.deepEqual(said.filter((s) => PLACES.test(s)), []);
});

test("R85: rule 2 is computed from the chain, never taken from a caller's claim", () => {
  /** @type {Step[]} */
  const chain = [{ step: "ocr", engine: "e", cap: "C" }];
  /* A caller-supplied claim anywhere on the chain or the step changes nothing. */
  const claims = { derivation_cap: "A", chainCap: "A", strengthens: false, allow: true, verified: true };
  /** The chain, carrying the same claims about itself. @extends {Array<Step>} */
  class Claimed extends Array {
    derivation_cap = "A"; chainCap = "A"; strengthens = false; allow = true; verified = true;
  }
  const claimed = new Claimed();
  claimed.push(...chain);
  const r = refusalOf(tc.appendStep(claimed, { step: "ai", engine: "m", cap: "A", ...claims }));
  assert.equal(r.code, "TEXT_CHAIN_STRENGTHENS");
  const c = refusalOf(tc.convertedChain({ step: "convert", engine: "h", format: "odt", cap: "D", calibration: "k", ...claims }, [{ step: "layer", cap: "B", ...claims }]));
  assert.equal(c.code, "TEXT_CHAIN_STRENGTHENS");
  /* The cap is the chain's weakest link, whatever a step says of itself beyond its own cap. */
  assert.equal(tc.derivationCap([{ step: "ocr", engine: "e", cap: "C" }, { step: "ai", engine: "m", cap: "D", chain_cap: "A" }]), "D");
});

test("R86: every refusal says which kind of no, with its catalogue check and translation", () => {
  /** @type {Refusal[]} */
  const refusals = [];
  for (const [, fn, a, b] of calls()) {
    /** @type {unknown} */
    let r;
    try { r = fn(a, b, CHAIN); } catch { continue; }
    const answer = r;
    if (isRefusal(answer)) refusals.push(answer);
  }
  const codes = new Set(refusals.map((r) => r.code));
  /** @type {readonly TextChainCode[]} */
  const seen = ["TEXT_CHAIN_COLLAPSED", "TEXT_CHAIN_EMPTY", "TEXT_CHAIN_STEP_SHAPE", "TEXT_CHAIN_STEP_UNNAMED",
    "TEXT_CONFIDENCE_SHAPE", "TEXT_ANCHOR_MISSING", "TEXT_ATTEST_MACHINE"];
  for (const code of seen) assert.ok(codes.has(code), code);
  for (const r of refusals) {
    assert.ok(Object.hasOwn(TEXT_CHAIN_CHECKS, r.code), r.code);
    assert.equal(r.check, TEXT_CHAIN_CHECKS[r.code].check);
    assert.match(r.check, /^C-35\.\d+$/);
    assert.equal(r.translation, TEXT_CHAIN_CHECKS[r.code].translation);
    const detail = r.detail;
    assert.ok(typeof detail === "string" && detail.trim().length > 0);
  }
  /* The undetermined region says why; the tier-2 refusal says why. */
  const fl = tc.applyConfidenceFloor([{ confidence: { basis: "engine", value: 0 } }], 0.5).regions[0];
  const why = fl?.why;
  assert.ok(fl !== undefined && fl.undetermined === true && typeof why === "string" && why.length > 0);
  const m = tc.mergeTier2Text({ document: "held" }, {});
  assert.ok(m.ok === false && typeof m.why === "string" && m.why.length > 0);
});
