/* text-chain: requirement-named tests for the chain grammar, its builders and its readers
 * (build/requirements/text-chain.md R1-R39, R81), at the module's interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STEP_KINDS, checkChain, appendStep, layerChain, convertedChain, mergedChain, calibrationsOf,
  derivationCap, isTranscribed, terminalStep, tiersEvidenced, describeChain, chainKindFor, CHAIN_KIND_MIXED,
  MACHINE_READ_KINDS, TEXT_CHAIN_CHECKS,
} from "../../../src/textchain.mjs";
import { BASIS_GRADES } from "../../../src/record-grammar/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";
/** @import { Chain, Refusal, Step, PagesExtent, TextChainCode } from "../../../src/textchain.mjs" */

/** @typedef {"layer" | "pixels" | "ocr" | "ai" | "ai_transcription" | "attested" | "convert" | "typed"} KindName a key of `STEP_KINDS` */
/** @type {readonly KindName[]} */
const KIND_NAMES = ["layer", "pixels", "ocr", "ai", "ai_transcription", "attested", "convert", "typed"];
/** @param {string} k @returns {k is KindName} */
const isKindName = (k) => KIND_NAMES.some((n) => n === k);
/** The keys of `STEP_KINDS`, in its order. @type {KindName[]} */
const KINDS = Object.keys(STEP_KINDS).filter(isKindName);
/** @typedef {{ layer: Step, pixels: Step, ocr: Step, ai: Step, attested: Step, convert: Step, typed: Step, ai_transcription: Step }} OkSteps */
/* A minimal well-formed step of each kind. */
/** @type {OkSteps} */
const ok = {
  layer: { step: "layer" }, pixels: { step: "pixels" }, ocr: { step: "ocr", engine: "eng", version: "1" },
  ai: { step: "ai", engine: "model" }, attested: { step: "attested", member: "m1", at: "2026-01-01" },
  convert: { step: "convert", engine: "host-export", format: "odt" }, typed: { step: "typed", member: "m2" },
  ai_transcription: { step: "ai_transcription", engine: "vision-model", version: "3" },
};
/** @param {Chain | Refusal | null} r @param {TextChainCode} code @returns {void} */
const isRefusal = (r, code) => {
  assert.ok(r !== null && !Array.isArray(r), `expected a refusal ${code}, got ${JSON.stringify(r)}`);
  assert.equal(r.ok, false, `expected a refusal ${code}, got ${JSON.stringify(r)}`);
  assert.equal(r.code, code);
  assert.equal(r.check, TEXT_CHAIN_CHECKS[code].check);
  assert.equal(r.translation, TEXT_CHAIN_CHECKS[code].translation);
  assert.equal(typeof r.detail, "string");
  assert.ok(r.detail.length > 0);
};
/** @param {Chain | Refusal | null} r @returns {Chain} */
const chainOf = (r) => { assert.ok(Array.isArray(r), JSON.stringify(r)); return r; };
/** @typedef {{ extent?: PagesExtent, tier?: number }} Extra */
/** `step` with `extra`'s members laid on it. @param {Step} step @param {Extra} extra @returns {Step} */
const withExtra = (step, extra) => {
  const { extent, tier } = extra;
  if (extent !== undefined) step.extent = extent;
  if (tier !== undefined) step.tier = tier;
  return step;
};
/** @param {string | null} cap @param {Extra} [extra] @returns {Step} */
const L = (cap, extra = {}) => withExtra({ step: "layer", cap }, extra);
/** @param {string | null} cap @param {Extra} [extra] @returns {Step} */
const O = (cap, extra = {}) => withExtra({ step: "ocr", engine: "eng", cap }, extra);
/** @param {number[]} ps @param {number} [part] @returns {PagesExtent} */
const pages = (ps, part) => {
  /** @type {PagesExtent} */
  const extent = { kind: "pages", pages: ps };
  if (part !== undefined) extent.part = part;
  return extent;
};

test("R1: every step kind has role derivation|verification and a label; only attested verifies", () => {
  assert.deepEqual(Object.keys(STEP_KINDS).sort(), ["ai", "ai_transcription", "attested", "convert", "layer", "ocr", "pixels", "typed"]);
  for (const k of KINDS) {
    assert.ok(["derivation", "verification"].includes(STEP_KINDS[k].role), k);
    assert.equal(typeof STEP_KINDS[k].label, "string");
    assert.ok(STEP_KINDS[k].label.length > 0);
  }
  assert.deepEqual(KINDS.filter((k) => STEP_KINDS[k].role === "verification"), ["attested"]);
  /* A verification step neither lowers nor raises the derivation cap. */
  for (const cap of BASIS_GRADES) {
    assert.equal(derivationCap([O(cap), ok.attested]), cap);
    assert.equal(derivationCap([O(cap), { ...ok.attested, cap: "A" }]), cap);
  }
  assert.equal(derivationCap([L(null), ok.attested]), null);
});

test("R2: every kind declares tier: an integer, \"step\" or null", () => {
  for (const k of KINDS) {
    assert.ok(Object.hasOwn(STEP_KINDS[k], "tier"), k);
    const t = STEP_KINDS[k].tier;
    assert.ok(Number.isInteger(t) || t === "step" || t === null, `${k}: ${t}`);
  }
  assert.equal(STEP_KINDS.layer.tier, "step");
  assert.equal(STEP_KINDS.pixels.tier, 3);
  assert.equal(STEP_KINDS.ocr.tier, 3);
  assert.equal(STEP_KINDS.ai_transcription.tier, 4);
  /** @type {readonly KindName[]} */
  const untiered = ["ai", "attested", "typed", "convert"];
  for (const k of untiered) assert.equal(STEP_KINDS[k].tier, null);
});

test("R3: convert, typed and ai_transcription (R104) declare names, unmeasured and letter; no other kind declares them", () => {
  assert.deepEqual(STEP_KINDS.convert.names, ["engine", "format"]);
  assert.equal(STEP_KINDS.convert.unmeasured, "undetermined");
  assert.equal(STEP_KINDS.convert.letter, "calibrated");
  assert.deepEqual(STEP_KINDS.typed.names, ["member"]);
  assert.equal(STEP_KINDS.typed.unmeasured, "undetermined");
  assert.equal(STEP_KINDS.typed.letter, "never");
  assert.deepEqual(STEP_KINDS.ai_transcription.names, ["engine"]);
  assert.equal(STEP_KINDS.ai_transcription.unmeasured, "undetermined");
  assert.equal(STEP_KINDS.ai_transcription.letter, "calibrated");
  /** @type {readonly ("names" | "unmeasured" | "letter")[]} */
  const declared = ["names", "unmeasured", "letter"];
  for (const k of KINDS.filter((x) => !["convert", "typed", "ai_transcription"].includes(x)))
    for (const f of declared) assert.equal(STEP_KINDS[k][f], undefined, `${k}.${f}`);
  /* Plain object, never mutated by use. */
  const before = JSON.stringify(STEP_KINDS);
  for (const k of KINDS) { checkChain([ok[k]]); derivationCap([ok[k]]); describeChain([ok[k]]); tiersEvidenced([ok[k]]); }
  assert.equal(JSON.stringify(STEP_KINDS), before);
  assert.equal(Reflect.getPrototypeOf(STEP_KINDS), Object.prototype);
});

test("R4: a non-empty array of step objects each naming a known kind is well-formed", () => {
  for (const k of KINDS) assert.equal(checkChain([ok[k]]), null, k);
  assert.equal(checkChain(KINDS.map((k) => ok[k])), null);
  assert.equal(checkChain([L(null), O("C"), ok.attested]), null);
});

test("R5: a string chain refuses TEXT_CHAIN_COLLAPSED, before the shape complaint", () => {
  for (const s of ["ocr", "layer", "", "anything"]) isRefusal(checkChain(s), "TEXT_CHAIN_COLLAPSED");
});

test("R6: a non-array or empty chain refuses TEXT_CHAIN_EMPTY", () => {
  for (const c of [null, undefined, [], 0, 1, true, {}, { 0: ok.layer, length: 1 }]) isRefusal(checkChain(c), "TEXT_CHAIN_EMPTY");
});

test("R7: a non-object step refuses STEP_SHAPE; an unknown .step refuses STEP_UNKNOWN", () => {
  for (const s of [null, undefined, "layer", 3, [], [ok.layer], true]) isRefusal(checkChain([ok.layer, s]), "TEXT_CHAIN_STEP_SHAPE");
  for (const s of [{}, { step: "mixed" }, { step: "OCR" }, { step: "toString" }, { step: "__proto__" }, { step: 1 }])
    isRefusal(checkChain([s]), "TEXT_CHAIN_STEP_UNKNOWN");
});

test("R8: ocr/ai without a non-empty engine, or a names-declaring kind missing a named field, refuses STEP_UNNAMED", () => {
  for (const k of ["ocr", "ai"])
    for (const engine of [undefined, null, "", 5, {}]) isRefusal(checkChain([{ step: k, engine }]), "TEXT_CHAIN_STEP_UNNAMED");
  /** @type {readonly KindName[]} */
  const naming = ["convert", "typed", "ai_transcription"];
  for (const k of naming) {
    const names = STEP_KINDS[k].names;
    assert.ok(names, k);
    for (const f of names)
      for (const v of [undefined, "", "  ", 3]) isRefusal(checkChain([{ ...ok[k], [f]: v }]), "TEXT_CHAIN_STEP_UNNAMED");
  }
  /* Kinds that name nothing need nothing. */
  for (const k of ["layer", "pixels", "attested"]) assert.equal(checkChain([{ step: k }]), null);
});

test("R9: a present calibration that is not a non-empty string refuses CAL_REF; absent is legal on every kind", () => {
  for (const k of KINDS) {
    assert.equal(checkChain([ok[k]]), null);
    for (const c of ["", "  ", 5, {}, [], false]) isRefusal(checkChain([{ ...ok[k], calibration: c }]), "TEXT_CHAIN_CAL_REF");
    assert.equal(checkChain([{ ...ok[k], calibration: "cal-1" }]), null);
  }
});

test("R10: a calibrated-letter kind (convert, ai_transcription) with a cap and no calibration refuses LETTER_UNCALIBRATED", () => {
  /** @type {readonly KindName[]} */
  const calibrated = ["convert", "ai_transcription"];
  for (const k of calibrated) {
    for (const cap of [...BASIS_GRADES, "Z"]) {
      isRefusal(checkChain([{ ...ok[k], cap }]), "TEXT_CHAIN_LETTER_UNCALIBRATED");
      assert.equal(checkChain([{ ...ok[k], cap, calibration: "cal-1" }]), null);
    }
    assert.equal(checkChain([{ ...ok[k], cap: null }]), null);
  }
  /* Other kinds may carry a cap without a calibration. */
  /** @type {readonly KindName[]} */
  const others = ["layer", "pixels", "ocr", "ai"];
  for (const k of others) assert.equal(checkChain([{ ...ok[k], cap: "C" }]), null);
});

test("R11: a never-letter kind (typed) carrying a cap refuses LETTER_ON_PERSON", () => {
  for (const cap of [...BASIS_GRADES, "Z"]) {
    isRefusal(checkChain([{ ...ok.typed, cap }]), "TEXT_CHAIN_LETTER_ON_PERSON");
    isRefusal(checkChain([{ ...ok.typed, cap, calibration: "cal-1" }]), "TEXT_CHAIN_LETTER_ON_PERSON");
  }
});

test("R12: appendStep refuses what checkChain(chain) or checkChain([step]) refuses, in that order", () => {
  isRefusal(appendStep("ocr", { step: "nope" }), "TEXT_CHAIN_COLLAPSED");
  isRefusal(appendStep([], ok.layer), "TEXT_CHAIN_EMPTY");
  isRefusal(appendStep([ok.layer], { step: "nope" }), "TEXT_CHAIN_STEP_UNKNOWN");
  isRefusal(appendStep([ok.layer], null), "TEXT_CHAIN_STEP_SHAPE");
  isRefusal(appendStep([ok.layer], { step: "ocr" }), "TEXT_CHAIN_STEP_UNNAMED");
  isRefusal(appendStep([ok.layer], { ...ok.typed, cap: "C" }), "TEXT_CHAIN_LETTER_ON_PERSON");
});

test("R13: a derivation step stronger than the chain's cap refuses STRENGTHENS; equal or weaker appends", () => {
  for (const [i, have] of BASIS_GRADES.entries())
    for (const [j, cap] of BASIS_GRADES.entries()) {
      /** @type {readonly KindName[]} */
      const derivations = ["ocr", "ai", "layer", "pixels"];
      for (const k of derivations) {
        const chain = [O(have)], step = { ...ok[k], cap };
        const r = appendStep(chain, step);
        if (j < i) isRefusal(r, "TEXT_CHAIN_STRENGTHENS");
        else {
          const appended = chainOf(r);
          assert.deepEqual(appended, [...chain, step]);
          assert.notEqual(appended, chain);
          assert.notEqual(appended[1], step);
        }
      }
    }
  /* Never mutates either input. */
  const chain = [O("C")], step = O("D"), before = JSON.stringify([chain, step]);
  appendStep(chain, step); appendStep(chain, O("A"));
  assert.equal(JSON.stringify([chain, step]), before);
});

test("R14: a verification step, or an unknown cap on either side, appends unconditionally", () => {
  for (const have of BASIS_GRADES) {
    const r = appendStep([O(have)], { ...ok.attested, cap: "A" });
    assert.equal(Array.isArray(r), true);
    assert.equal(chainOf(r).length, 2);
  }
  /* Chain cap unknown (unmeasured) → append. */
  assert.equal(chainOf(appendStep([L(null)], O("A"))).length, 2);
  /* Step cap unknown letter → append. */
  assert.equal(chainOf(appendStep([O("D")], O("Z"))).length, 2);
  assert.equal(chainOf(appendStep([O("D")], O(null))).length, 2);
});

test("R15: layerChain returns a one-step layer chain carrying every argument, defaulting to null", () => {
  assert.deepEqual(layerChain(), [{ step: "layer", tier: null, container: null, cap: null, measured_by: null, calibration: null }]);
  assert.deepEqual(layerChain({}), layerChain());
  for (const x of [null, 3, "cap"]) assert.doesNotThrow(() => assert.deepEqual(layerChain(x), layerChain()));
  assert.doesNotThrow(() => {
    const args = { tier: 2, container: "pdf", cap: "Q", measured_by: "M-1", calibration: 7 };
    assert.deepEqual(layerChain(args), [{ step: "layer", ...args }]);
  });
  assert.deepEqual(layerChain({ cap: "C" }), [{ step: "layer", tier: null, container: null, cap: "C", measured_by: null, calibration: null }]);
});

test("R16: convertedChain refuses what checkChain([step]) or checkChain(chain) refuses", () => {
  isRefusal(convertedChain({ step: "convert", engine: "x" }, [ok.layer]), "TEXT_CHAIN_STEP_UNNAMED");
  isRefusal(convertedChain(null, [ok.layer]), "TEXT_CHAIN_STEP_SHAPE");
  isRefusal(convertedChain(ok.convert, "layer"), "TEXT_CHAIN_COLLAPSED");
  isRefusal(convertedChain(ok.convert, []), "TEXT_CHAIN_EMPTY");
  isRefusal(convertedChain({ ...ok.convert, cap: "B" }, [ok.layer]), "TEXT_CHAIN_LETTER_UNCALIBRATED");
});

test("R17: convertedChain refuses STRENGTHENS when a derivation step in chain is stronger than the conversion", () => {
  /** @param {string} cap @returns {Step} */
  const conv = (cap) => ({ ...ok.convert, cap, calibration: "cal" });
  for (const [i, c] of BASIS_GRADES.entries())
    for (const [j, s] of BASIS_GRADES.entries()) {
      const r = convertedChain(conv(c), [L(null), O(s)]);
      if (j < i) isRefusal(r, "TEXT_CHAIN_STRENGTHENS"); else assert.ok(Array.isArray(r));
    }
  /* A verification step, however strong, is not compared. */
  assert.ok(Array.isArray(convertedChain(conv("D"), [L(null), { ...ok.attested, cap: "A" }])));
  /* An unmeasured conversion refuses nothing. */
  assert.ok(Array.isArray(convertedChain(ok.convert, [O("A")])));
});

test("R18: convertedChain puts copies of step then chain, a new array, neither input mutated", () => {
  const step = { ...ok.convert }, chain = [L(null, { tier: 1 }), O("C")];
  const before = JSON.stringify([step, chain]);
  const r = chainOf(convertedChain(step, chain));
  assert.deepEqual(r, [step, ...chain]);
  assert.notEqual(r[0], step);
  r.slice(1).forEach((s, i) => assert.notEqual(s, chain[i]));
  assert.equal(JSON.stringify([step, chain]), before);
});

test("R19: mergedChain of zero parts is null", () => {
  for (const p of [[], null, undefined, "x", {}]) assert.equal(mergedChain(p), null);
});

test("R20: one part answers its chain unscoped and unchanged, or its refusal", () => {
  const chain = [L(null), O("C")];
  assert.equal(mergedChain([{ chain, pages: [0, 1] }]), chain);
  assert.equal(mergedChain([{ chain }]), chain);
  isRefusal(mergedChain([{ chain: "ocr", pages: [0] }]), "TEXT_CHAIN_COLLAPSED");
});

test("R21: several parts concatenate in order; any refusing part stops the merge with its refusal", () => {
  const a = [L(null)], b = [{ step: "pixels" }, O("C")], c = [{ ...ok.ai, cap: "D" }];
  const r = chainOf(mergedChain([{ chain: a, pages: [0] }, { chain: b, pages: [1] }, { chain: c, pages: [2] }]));
  assert.deepEqual(r.map((s) => s.step), ["layer", "pixels", "ocr", "ai"]);
  isRefusal(mergedChain([{ chain: a, pages: [0] }, { chain: [{ step: "ocr" }], pages: [1] }]), "TEXT_CHAIN_STEP_UNNAMED");
  isRefusal(mergedChain([{ chain: a, pages: [0] }, { chain: [], pages: [1] }]), "TEXT_CHAIN_EMPTY");
  isRefusal(mergedChain([null, { chain: a, pages: [1] }]), "TEXT_CHAIN_EMPTY");
});

test("R22: each part's derivation steps are stamped with its pages (dedup, sorted, non-negative ints; [] otherwise); verification steps unscoped", () => {
  const att = { ...ok.attested, extent: { kind: "document" } };
  const r = chainOf(mergedChain([
    { chain: [L(null), att], pages: [3, 1, 1, -1, 2.5, "4", 2] },
    { chain: [O("C")], pages: "0-1" },
    { chain: [{ step: "pixels" }], pages: [] },
  ]));
  assert.deepEqual(r, [
    { step: "layer", cap: null, extent: pages([1, 2, 3]) },
    att,
    { ...O("C"), extent: pages([]) },
    { step: "pixels", extent: pages([]) },
  ]);
  assert.notEqual(r[1], att);
  /* [] reads as UNREADABLE to every reader, never "all the document". */
  assert.equal(derivationCap(r), null);
  assert.equal(derivationCap(r, { page: 1 }), null);
  assert.match(describeChain(r), /over an extent this record cannot read/);
  /* Parts that share a page are each stamped with their index as well (so R81 and R28 can tell them apart);
     partitioned parts carry no index. */
  const shared = chainOf(mergedChain([{ chain: [L(null)], pages: [0, 1] }, { chain: [{ step: "pixels" }, O("C")], pages: [1, 0] }]));
  assert.deepEqual(shared.map((s) => s.extent), [pages([0, 1], 0), pages([0, 1], 1), pages([0, 1], 1)]);
});

test("R23: calibrationsOf answers the de-duplicated non-empty calibrations of any step, in first-seen order", () => {
  const chain = [{ ...L(null), calibration: "b" }, { ...O("C"), calibration: "a" }, { ...ok.ai, calibration: "b" },
    { ...ok.attested, calibration: "c" }, { ...ok.pixels }];
  assert.deepEqual(calibrationsOf(chain), ["b", "a", "c"]);
  assert.deepEqual(calibrationsOf([ok.layer]), []);
});

test("R24: calibrationsOf of a malformed chain is []", () => {
  for (const c of ["x", [], null, [{ step: "nope", calibration: "a" }], [{ ...O("C"), calibration: "" }]]) assert.deepEqual(calibrationsOf(c), []);
});

test("R25: derivationCap of a malformed chain is null", () => {
  for (const c of ["x", [], null, [{ step: "nope", cap: "A" }], [{ step: "ocr", cap: "A" }]]) {
    assert.equal(derivationCap(c), null);
    assert.equal(derivationCap(c, { page: 0 }), null);
  }
});

test("R26: unscoped, no target: the weakest measured cap over derivation steps, null when none measures", () => {
  for (const a of BASIS_GRADES) for (const b of BASIS_GRADES) {
    const want = BASIS_GRADES[Math.max(BASIS_GRADES.indexOf(a), BASIS_GRADES.indexOf(b))];
    assert.equal(derivationCap([O(a), { ...ok.ai, cap: b }]), want);
    assert.equal(derivationCap([L(null), O(a), { ...ok.pixels }, { ...ok.ai, cap: b }, { ...ok.attested, cap: "A" }]), want);
  }
  assert.equal(derivationCap([L(null)]), null);
  assert.equal(derivationCap([L("Z"), ok.pixels]), null);
  assert.equal(derivationCap([ok.attested]), null);
});

test("R27: with target.page, only steps covering that page bound the answer", () => {
  const chain = [L("B", { extent: pages([0, 1]) }), O("D", { extent: pages([2]) }), { ...ok.ai, cap: "C" }];
  assert.equal(derivationCap(chain, { page: 0 }), "C");
  assert.equal(derivationCap(chain, { page: 2 }), "D");
  assert.equal(derivationCap(chain, { page: 9 }), "C");
  const scopedOnly = [L("B", { extent: pages([0]) }), O(null, { extent: pages([1]) })];
  assert.equal(derivationCap(scopedOnly, { page: 0 }), "B");
  assert.equal(derivationCap(scopedOnly, { page: 1 }), null);
  assert.equal(derivationCap(scopedOnly, { page: 5 }), null);
});

test("R28: a mixed document's cap is the weakest over its distinct extents; one extent with no measured step makes it null", () => {
  assert.equal(derivationCap([L("B", { extent: pages([0]) }), O("C", { extent: pages([1]) })]), "C");
  assert.equal(derivationCap([L(null, { extent: pages([0]) }), { ...ok.pixels, extent: pages([1]) }, O("C", { extent: pages([1]) })]), null);
  assert.equal(derivationCap([L("A", { extent: pages([0]) }), { ...ok.pixels, extent: pages([1]) }, O("C", { extent: pages([1]) })]), "C");
  /* Two parts over the SAME pages are still two parts: a layer part with no measurement is never resolved by the OCR part's letter. */
  const shared = mergedChain([{ chain: [L(null)], pages: [0, 1] }, { chain: [ok.pixels, O("C")], pages: [0, 1] }]);
  assert.equal(derivationCap(shared), null);
  const sharedMeasured = mergedChain([{ chain: [L("B")], pages: [0, 1] }, { chain: [ok.pixels, O("C")], pages: [0, 1] }]);
  assert.equal(derivationCap(sharedMeasured), "C");
});

test("R29: an unmeasured convert step covering the target makes the answer null", () => {
  const conv = { ...ok.convert };
  assert.equal(derivationCap([conv, O("C")]), null);
  assert.equal(derivationCap([conv, O("C")], { page: 3 }), null);
  const scoped = [{ ...conv, extent: pages([0]) }, O("C", { extent: pages([1]) })];
  assert.equal(derivationCap(scoped, { page: 0 }), null);
  assert.equal(derivationCap(scoped, { page: 1 }), "C");
  assert.equal(derivationCap(scoped), null);
  /* typed declares the same property. */
  assert.equal(derivationCap([O("C"), ok.typed]), null);
  /* A measured (calibrated) conversion takes part like any step. */
  assert.equal(derivationCap([{ ...conv, cap: "B", calibration: "cal" }, O("C")]), "C");
});

test("R30: any step with an extent this module cannot read makes the answer null for every target and the whole document", () => {
  for (const bad of [pages([]), { kind: "pages", pages: [-1] }, { kind: "range" }, "0-1", { kind: "pages", pages: [0], part: -1 }, { kind: "pages", pages: [1.5] }]) {
    const chain = [O("C"), { ...ok.ai, cap: "D", extent: bad }];
    assert.equal(derivationCap(chain), null);
    for (const page of [0, 1, 7]) assert.equal(derivationCap(chain, { page }), null);
  }
});

test("R31: isTranscribed is true for a well-formed chain with a derivation step, false otherwise", () => {
  for (const k of KINDS) assert.equal(isTranscribed([ok[k]]), STEP_KINDS[k].role === "derivation", k);
  assert.equal(isTranscribed([ok.attested, ok.attested]), false);
  assert.equal(isTranscribed([ok.attested, ok.layer]), true);
  for (const c of ["layer", [], null, [{ step: "ocr" }]]) assert.equal(isTranscribed(c), false);
});

test("R32: terminalStep is the last entry's .step, null for a malformed chain, never mixed", () => {
  for (const k of KINDS) assert.equal(terminalStep([ok.layer, ok[k]]), k);
  for (const c of ["ocr", [], null, [{ step: "x" }]]) assert.equal(terminalStep(c), null);
  const shared = mergedChain([{ chain: [L(null)], pages: [0] }, { chain: [ok.pixels, O("C")], pages: [0] }]);
  assert.equal(terminalStep(shared), "ocr");
});

test("R33: tiers group by the kind's tier (or the step's own; \"unrecorded\" when absent), listing steps and the union of coverage", () => {
  const r = tiersEvidenced([
    { step: "layer", tier: 1, extent: pages([0, 2]) }, { step: "pixels", extent: pages([1]) }, O("C", { extent: pages([3]) }),
    { step: "layer", tier: 1, extent: pages([4]) }, { step: "layer" }, { step: "layer", tier: 2 },
  ]);
  assert.deepEqual(r, {
    tiers: [
      { tier: 1, steps: ["layer", "layer"], covers: [0, 2, 4] },
      { tier: 3, steps: ["pixels", "ocr"], covers: [1, 3] },
      { tier: null, steps: ["layer"], covers: "all" },
      { tier: 2, steps: ["layer"], covers: "all" },
    ],
    unclassified: [],
  });
  /* "all" absorbs everything; "unreadable" absorbs a page list. */
  assert.deepEqual(tiersEvidenced([{ step: "layer", tier: 1, extent: pages([0]) }, { step: "layer", tier: 1 }]).tiers[0]?.covers, "all");
  assert.deepEqual(tiersEvidenced([{ step: "layer", tier: 1, extent: pages([0]) }, { step: "layer", tier: 1, extent: pages([]) }]).tiers[0]?.covers, "unreadable");
  assert.deepEqual(tiersEvidenced([{ step: "layer", tier: 1, extent: pages([]) }, { step: "layer", tier: 1 }]).tiers[0]?.covers, "all");
});

test("R34: a kind missing the tier property is named once in unclassified", () => {
  const tier = STEP_KINDS.pixels.tier;
  delete STEP_KINDS.pixels.tier;
  try {
    const r = tiersEvidenced([ok.pixels, O("C"), ok.pixels]);
    assert.deepEqual(r.unclassified, ["pixels"]);
    assert.deepEqual(r.tiers, [{ tier: 3, steps: ["ocr"], covers: "all" }]);
  } finally {
    if (tier === undefined) delete STEP_KINDS.pixels.tier;
    else STEP_KINDS.pixels.tier = tier;
  }
});

test("R35: a kind declaring tier null is neither a tier entry nor unclassified", () => {
  assert.deepEqual(tiersEvidenced([ok.ai, ok.attested, ok.typed, ok.convert]), { tiers: [], unclassified: [] });
});

test("R36: tier entries come in the order their first step appeared, never sorted", () => {
  const r = tiersEvidenced([O("C"), { step: "layer", tier: 2 }, { step: "layer", tier: 1 }, ok.pixels]);
  assert.deepEqual(r.tiers.map((t) => t.tier), [3, 2, 1]);
});

test("R37: a malformed chain evidences nothing", () => {
  for (const c of ["x", [], null, [{ step: "ocr" }]]) assert.deepEqual(tiersEvidenced(c), { tiers: [], unclassified: [] });
});

test("R38: describeChain of a malformed chain is the unrecorded sentence", () => {
  for (const c of ["x", [], null, [{ step: "nope" }]]) assert.equal(describeChain(c), word("textchain.text.text_provenance_recorded"));
});

test("R39: describeChain joins one sentence per step with ' -> '", () => {
  /** @param {KindName} k @returns {string} */
  const lab = (k) => STEP_KINDS[k].label;
  assert.equal(describeChain([ok.layer]), lab("layer"));
  assert.equal(describeChain([{ step: "ocr", engine: "eng", version: "5.3" }]), `${lab("ocr")} (eng 5.3)`);
  assert.equal(describeChain([{ step: "ai", engine: "m" }]), `${lab("ai")} (m)`);
  assert.equal(describeChain([ok.convert]), `${lab("convert")} (host-export to odt)`);
  assert.equal(describeChain([{ step: "attested", member: "m1", at: "2026-01-01" }]), `${lab("attested")} (m1, 2026-01-01)`);
  assert.equal(describeChain([{ step: "typed", member: "m2" }]), `${lab("typed")} (m2)`);
  assert.equal(describeChain([L(null, { extent: pages([0, 1, 2, 5]) }), O("C", { extent: pages([3]) }), { ...ok.ai, extent: pages([]) }]),
    `${lab("layer")} (pages 1-3, 6) -> ${lab("ocr")} (eng) (page 4) -> ${lab("ai")} (model) (over an extent this record cannot read)`);
  /* A verification step is never given a page clause. */
  assert.equal(describeChain([ok.layer, { ...ok.attested, extent: pages([1]) }]), `${lab("layer")} -> ${lab("attested")} (m1, 2026-01-01)`);
});

test("R81: chainKindFor answers the one kind covering a page, mixed when parts of different kinds share it, null when undetermined", () => {
  assert.equal(CHAIN_KIND_MIXED, "mixed");
  /* One provenance: the last derivation step, whatever the page. */
  for (const k of KINDS.filter((x) => STEP_KINDS[x].role === "derivation"))
    assert.equal(chainKindFor([ok.layer, ok[k], ok.attested], { page: 4 }), k);
  /* A partitioned mixed document: each page its own part's last step; a part's pixels→ocr is one reading, ocr. */
  const part = chainOf(mergedChain([{ chain: [L(null)], pages: [0, 2] }, { chain: [ok.pixels, O("C")], pages: [1] }]));
  assert.equal(chainKindFor(part, { page: 0 }), "layer");
  assert.equal(chainKindFor(part, 2), "layer");
  assert.equal(chainKindFor(part, { page: 1 }), "ocr");
  assert.equal(chainKindFor(part, { page: 3 }), null);
  /* Two parts sharing pages (a folio from the layer, an OCR transcription appended): mixed on the shared pages. */
  for (const shared of [[0, 1], [1]]) {
    const c = mergedChain([{ chain: [L(null)], pages: [0, 1] }, { chain: [ok.pixels, O("C")], pages: shared }]);
    assert.equal(chainKindFor(c, { page: 1 }), CHAIN_KIND_MIXED);
    assert.equal(chainKindFor(c, { page: 0 }), shared.includes(0) ? CHAIN_KIND_MIXED : "layer");
  }
  /* Two parts of the SAME kind sharing a page read that kind. */
  assert.equal(chainKindFor(mergedChain([{ chain: [L(null)], pages: [0] }, { chain: [L(null)], pages: [0] }]), 0), "layer");
  /* An unscoped step met first from the end answers alone; one before the parts is history. */
  assert.equal(chainKindFor([...part, ok.ai], { page: 1 }), "ai");
  assert.equal(chainKindFor([ok.convert, ...part], { page: 0 }), "layer");
  assert.equal(chainKindFor([ok.convert, ...part], { page: 7 }), "convert");
  /* A verification step is never the answer. */
  assert.equal(chainKindFor([...part, ok.attested], { page: 1 }), "ocr");
  assert.equal(chainKindFor([ok.attested], { page: 0 }), null);
  /* Unreadable extent anywhere (R30's rule), malformed chain, or no page asked: null. */
  assert.equal(chainKindFor([...part, { ...ok.ai, extent: pages([]) }], { page: 0 }), null);
  assert.equal(chainKindFor([{ ...ok.ai, extent: pages([]) }, ...part], { page: 0 }), null);
  for (const t of [null, undefined, {}, { page: -1 }, { page: 1.5 }, -1, "0"]) assert.equal(chainKindFor(part, t), null);
  for (const c of ["ocr", [], null, [{ step: "ocr" }]]) assert.equal(chainKindFor(c, { page: 0 }), null);
  /* terminalStep is unchanged and document-level. */
  assert.equal(terminalStep(mergedChain([{ chain: [L(null)], pages: [0] }, { chain: [ok.pixels, O("C")], pages: [0] }])), "ocr");
});

test("R91: the machine readings are the kinds declaring machine: true, ocr, ai and ai_transcription only, and MACHINE_READ_KINDS lists them in STEP_KINDS order", () => {
  const kinds = Object.keys(STEP_KINDS);
  for (const k of kinds) {
    assert.ok(isKindName(k), k);
    assert.ok([true, undefined].includes(STEP_KINDS[k].machine), k);
  }
  assert.deepEqual(kinds.filter((k) => isKindName(k) && STEP_KINDS[k].machine === true), ["ocr", "ai", "ai_transcription"]);
  assert.deepEqual(MACHINE_READ_KINDS, ["ocr", "ai", "ai_transcription"]);
  assert.ok(Object.isFrozen(MACHINE_READ_KINDS));
  assert.throws(() => { "use strict"; MACHINE_READ_KINDS.push("layer"); });
  /* Every one is a derivation: an engine read or rewrote the text. */
  for (const k of MACHINE_READ_KINDS) {
    assert.ok(isKindName(k), k);
    assert.equal(STEP_KINDS[k].role, "derivation");
  }
});
