/* text-chain: requirement-named tests for confidence, the floor, the anchor, attestation, extents,
 * the grade ceiling and the capture bound (build/requirements/text-chain.md R40-R60). */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkConfidence, applyConfidenceFloor, checkAnchor, checkAttestation, extentCovers, gradeCeiling,
  captureBound, derivationCap, describeChain, convertedChain, layerChain, TEXT_CHAIN_CHECKS,
} from "../../../src/textchain.mjs";
import { BASIS_GRADES, EARNED_CAPTURE_CEILING } from "../../../src/record-grammar/index.mjs";

const isRefusal = (r, code) => {
  assert.equal(r && r.ok, false, `expected ${code}, got ${JSON.stringify(r)}`);
  assert.equal(r.code, code);
  assert.equal(r.check, TEXT_CHAIN_CHECKS[code].check);
  assert.equal(r.translation, TEXT_CHAIN_CHECKS[code].translation);
  assert.ok(typeof r.detail === "string" && r.detail.length > 0);
};
const anchor = (page = 0, rect = [0, 0, 100, 100]) => ({ kind: "pdf-page", ref: "p", page, rect });
const att = (extent, member = "alice", at = "2026-09-01") => ({ member, at, extent });
const O = (cap, extent) => ({ step: "ocr", engine: "eng", cap, ...(extent ? { extent } : {}) });

test("R40: the literal string \"none\" is a valid confidence", () => {
  assert.equal(checkConfidence("none"), null);
});

test("R41: a non-object that is not \"none\" refuses TEXT_CONFIDENCE_SHAPE", () => {
  for (const c of [undefined, null, "None", "", 0.9, 1, true, "engine"]) isRefusal(checkConfidence(c), "TEXT_CONFIDENCE_SHAPE");
});

test("R42: an object whose basis is not engine or none refuses TEXT_CONFIDENCE_PSEUDO, whatever its value", () => {
  for (const basis of [undefined, null, "model", "self", "ENGINE", "", 1])
    for (const value of [0, 0.5, 0.99, 1, undefined]) isRefusal(checkConfidence({ basis, value }), "TEXT_CONFIDENCE_PSEUDO");
  assert.equal(checkConfidence({ basis: "none" }), null);
  assert.equal(checkConfidence({ basis: "none", value: 7 }), null);
});

test("R43: basis engine with a value not a number in [0,1] refuses TEXT_CONFIDENCE_SHAPE", () => {
  for (const value of [undefined, null, -0.01, 1.01, "0.5", NaN, Infinity]) isRefusal(checkConfidence({ basis: "engine", value }), "TEXT_CONFIDENCE_SHAPE");
  for (const value of [0, 0.25, 1]) assert.equal(checkConfidence({ basis: "engine", value }), null);
});

test("R44: a refused or below-floor region is replaced by an undetermined one keeping every other field", () => {
  const src = anchor(2);
  const regions = [
    { text: "low", confidence: { basis: "engine", value: 0.4 }, source: src, id: 1 },
    { text: "pseudo", confidence: { basis: "model", value: 0.99 }, source: src, id: 2 },
    { text: "ok", confidence: { basis: "engine", value: 0.8 }, source: src, id: 3 },
    { text: "edge", confidence: { basis: "engine", value: 0.5 }, id: 4 },
    { text: "absent", id: 5 },
  ];
  const before = JSON.stringify(regions);
  const r = applyConfidenceFloor(regions, 0.5);
  assert.equal(JSON.stringify(regions), before);
  const und = (x) => ({ text: null, undetermined: true, confidence: "none" , ...x });
  assert.deepEqual({ ...r.regions[0], why: undefined }, { ...und({ source: src, id: 1 }), why: undefined });
  assert.match(r.regions[0].why, /0\.4/);
  assert.match(r.regions[0].why, /0\.5/);
  assert.equal(r.regions[1].why, checkConfidence(regions[1].confidence).detail);
  assert.deepEqual({ ...r.regions[1], why: undefined }, { ...und({ source: src, id: 2 }), why: undefined });
  assert.deepEqual(r.regions[2], regions[2]);
  assert.notEqual(r.regions[2], regions[2]);
  assert.deepEqual(r.regions[3], regions[3]);
  assert.equal(r.regions[4].why, checkConfidence(undefined).detail);
  assert.equal(r.regions[4].text, null);
  /* A floor that is not a number floors nothing on value. */
  for (const floor of [undefined, null, "0.9"]) assert.equal(applyConfidenceFloor([regions[0]], floor).floored, 0);
  /* Regions default to [] when not an array; each output region is a new object. */
  for (const x of [undefined, null, "x", {}]) assert.deepEqual(applyConfidenceFloor(x, 0.5), { regions: [], floored: 0, undetermined: 0 });
  const nonObj = applyConfidenceFloor([null, 3], 0.5);
  assert.equal(nonObj.regions.length, 2);
  for (const reg of nonObj.regions) assert.equal(reg.undetermined, true);
});

test("R45: a stated \"none\" confidence is never floored", () => {
  const r = applyConfidenceFloor([{ text: "t", confidence: "none" }], 1);
  assert.deepEqual(r, { regions: [{ text: "t", confidence: "none" }], floored: 0, undetermined: 0 });
});

test("R46: floored and undetermined both count every replaced region", () => {
  const regions = [
    { confidence: { basis: "engine", value: 0.1 } }, { confidence: "junk" }, { confidence: "none" },
    { confidence: { basis: "engine", value: 0.9 } }, { confidence: { basis: "model", value: 1 } },
  ];
  const r = applyConfidenceFloor(regions, 0.5);
  assert.equal(r.floored, 3);
  assert.equal(r.undetermined, 3);
  assert.equal(r.regions.filter((x) => x.undetermined).length, 3);
});

test("R47: a pdf-page anchor with a non-negative integer page and 4 finite numbers is accepted", () => {
  for (const a of [anchor(), anchor(7, [-1, 2.5, 3, 4]), { kind: "pdf-page", page: 0, rect: [1, 1, 0, 0] }]) assert.equal(checkAnchor(a), null);
});

test("R48: every other anchor shape refuses TEXT_ANCHOR_MISSING", () => {
  const bad = [undefined, null, "pdf-page", 3, {}, { ...anchor(), kind: "sheet-cell" }, { ...anchor(), page: -1 },
    { ...anchor(), page: 1.5 }, { ...anchor(), page: "0" }, { ...anchor(), page: undefined }, { ...anchor(), rect: undefined },
    { ...anchor(), rect: [0, 0, 1] }, { ...anchor(), rect: [0, 0, 1, 1, 1] }, { ...anchor(), rect: [0, 0, 1, NaN] },
    { ...anchor(), rect: [0, 0, 1, Infinity] }, { ...anchor(), rect: [0, 0, 1, "1"] }, { ...anchor(), rect: "0 0 1 1" }];
  for (const a of bad) isRefusal(checkAnchor(a), "TEXT_ANCHOR_MISSING");
});

test("R49: a machine credential, or no member, refuses TEXT_ATTEST_MACHINE before anything about the extent", () => {
  isRefusal(checkAttestation(att(null, "token:abc", null)), "TEXT_ATTEST_MACHINE");
  isRefusal(checkAttestation({ member: "token:abc" }), "TEXT_ATTEST_MACHINE");
  for (const member of [undefined, null, "", "   ", 5, {}]) isRefusal(checkAttestation({ member, at: "2026-09-01", extent: { kind: "document" } }), "TEXT_ATTEST_MACHINE");
  for (const a of [undefined, null, "x", 3]) isRefusal(checkAttestation(a), "TEXT_ATTEST_MACHINE");
});

test("R50: a missing or empty .at refuses TEXT_ATTEST_EXTENT", () => {
  for (const at of [undefined, null, "", "  ", 5]) isRefusal(checkAttestation({ member: "alice", at, extent: { kind: "document" } }), "TEXT_ATTEST_EXTENT");
});

test("R51: the extent must be region, page or document; page needs a page; region needs a passing anchor", () => {
  for (const e of [undefined, null, "document", {}, { kind: "pages" }, { kind: "all" }]) isRefusal(checkAttestation(att(e)), "TEXT_ATTEST_EXTENT");
  assert.equal(checkAttestation(att({ kind: "document" })), null);
  assert.equal(checkAttestation(att({ kind: "page", page: 0 })), null);
  for (const page of [undefined, -1, 1.2, "1"]) isRefusal(checkAttestation(att({ kind: "page", page })), "TEXT_ATTEST_EXTENT");
  assert.equal(checkAttestation(att({ kind: "region", source: anchor() })), null);
  for (const source of [undefined, { ...anchor(), rect: [0] }, { ...anchor(), kind: "doc-para" }]) {
    const r = checkAttestation(att({ kind: "region", source }));
    isRefusal(r, "TEXT_ATTEST_EXTENT");
    assert.ok(r.detail.includes(checkAnchor(source).detail), "the anchor's refusal is wrapped in the detail");
  }
});

test("R52: a document extent covers any target", () => {
  for (const t of [{ page: 0 }, { page: 9, rect: [0, 0, 1, 1] }, {}, { page: -1 }]) assert.equal(extentCovers({ kind: "document" }, t), true);
});

test("R53: a page extent covers exactly its page", () => {
  assert.equal(extentCovers({ kind: "page", page: 2 }, { page: 2 }), true);
  assert.equal(extentCovers({ kind: "page", page: 2 }, { page: 2, rect: [0, 0, 1, 1] }), true);
  assert.equal(extentCovers({ kind: "page", page: 2 }, { page: 3 }), false);
});

test("R54: a region extent covers a target rect inside it on the same page, both rects normalised", () => {
  const e = { kind: "region", source: anchor(1, [100, 100, 0, 0]) };
  assert.equal(extentCovers(e, { page: 1, rect: [10, 10, 20, 20] }), true);
  assert.equal(extentCovers(e, { page: 1, rect: [20, 20, 10, 10] }), true);
  assert.equal(extentCovers(e, { page: 1, rect: [0, 0, 100, 100] }), true);
  assert.equal(extentCovers(e, { page: 1, rect: [0, 0, 100, 101] }), false);
  assert.equal(extentCovers(e, { page: 1, rect: [-1, 0, 50, 50] }), false);
  assert.equal(extentCovers(e, { page: 0, rect: [10, 10, 20, 20] }), false);
});

test("R55: every other case answers false", () => {
  const cases = [
    [null, { page: 0 }], ["document", { page: 0 }], [{ kind: "pages" }, { page: 0 }], [{ kind: "document" }, null],
    [{ kind: "page", page: 0 }, {}], [{ kind: "page", page: 0 }, { page: "0" }], [{ kind: "page", page: 0 }, { page: -1 }],
    [{ kind: "region", source: anchor(0) }, { page: 0 }], [{ kind: "region", source: anchor(0) }, { page: 0, rect: [1, 1, 2] }],
    [{ kind: "region" }, { page: 0, rect: [1, 1, 2, 2] }], [{ kind: "region", source: anchor(0) }, { rect: [1, 1, 2, 2] }],
  ];
  for (const [e, t] of cases) assert.equal(extentCovers(e, t), false, JSON.stringify([e, t]));
});

test("R56: a valid attestation whose extent covers the target sets the ceiling to EARNED_CAPTURE_CEILING", () => {
  const chain = [O("D")];
  const good = [att({ kind: "page", page: 1 }, "alice"), att({ kind: "document" }, "bob"),
    att({ kind: "page", page: 2 }, "carol"), att({ kind: "document" }, "token:x"), att({ kind: "document" }, "dave", "")];
  const r = gradeCeiling(chain, { page: 1 }, good);
  assert.equal(r.ceiling, EARNED_CAPTURE_CEILING);
  assert.equal(r.determinant, "attestation");
  assert.deepEqual(r.by, ["alice", "bob"]);
  assert.ok(typeof r.why === "string" && r.why.length > 0);
});

test("R57: otherwise the ceiling is derivationCap(chain, target), why naming the page or describing the chain", () => {
  const chain = [{ step: "layer", cap: null, extent: { kind: "pages", pages: [0] } }, O("C", { kind: "pages", pages: [1] })];
  for (const atts of [undefined, [], "x", [att({ kind: "page", page: 5 })]]) {
    const r0 = gradeCeiling(chain, { page: 0 }, atts);
    assert.deepEqual({ ...r0, why: undefined }, { ceiling: null, determinant: "derivation", by: [], why: undefined });
    /* R57, BOB's K4863: the page is spelled 1-based, as the chain sentence's is (R39); the stored page is 0. */
    assert.match(r0.why, /page 1(?!\d)/);
    assert.doesNotMatch(r0.why, /page 0/);
    assert.match(gradeCeiling(chain, { page: 4 }, atts).why, /page 5(?!\d)/);
    const r1 = gradeCeiling(chain, { page: 1 }, atts);
    assert.equal(r1.ceiling, derivationCap(chain, { page: 1 }));
    assert.equal(r1.ceiling, "C");
    assert.ok(r1.why.includes(describeChain(chain)));
  }
});

test("R58: a chain that is not a transcription returns byteGrade unchanged", () => {
  for (const c of [null, undefined, "ocr", [], [{ step: "attested", member: "m", at: "x" }]]) {
    for (const g of [...BASIS_GRADES, null, "Z"]) assert.equal(captureBound(c, g), g);
    assert.equal(captureBound(c), EARNED_CAPTURE_CEILING);
  }
});

test("R59: a transcription with no measured cap returns null", () => {
  for (const g of BASIS_GRADES) assert.equal(captureBound([{ step: "layer" }], g), null);
  assert.equal(captureBound([{ step: "layer" }]), null);
});

test("R59: a host's conversion ahead of a text layer (convert then layer) bounds the capture axis to undetermined, whatever the layer measures", () => {
  /* The shape a Drive export's reading carries (drive-convert's share, K619): the conversion unmeasured at the head. */
  const convert = { step: "convert", engine: "google-export", format: "odt", cap: null, calibration: null,
    measured_by: "unmeasured: a calibration row raises it" };
  const layer = { step: "layer", tier: 1, container: "odt" };
  for (const layerCap of [null, ...BASIS_GRADES]) {
    const measuredLayer = layerChain({ ...layer, cap: layerCap, calibration: layerCap ? "CAL-9001" : null });
    const chain = convertedChain(convert, measuredLayer);
    assert.deepEqual(chain.map((s) => s.step), ["convert", "layer"]);
    /* R29: the unmeasured head makes the cap undetermined; R59: so the capture axis is bounded to null, for every byte grade. */
    assert.equal(derivationCap(chain), null);
    for (const g of [...BASIS_GRADES, EARNED_CAPTURE_CEILING]) assert.equal(captureBound(chain, g), null, `${layerCap} ${g}`);
    assert.equal(captureBound(chain), null);
    /* The control: the layer alone reads its own letter (R26), and bounds by it (R60). */
    assert.equal(derivationCap(measuredLayer), layerCap);
    if (layerCap) assert.equal(captureBound(measuredLayer, "B"), BASIS_GRADES[Math.max(BASIS_GRADES.indexOf("B"), BASIS_GRADES.indexOf(layerCap))]);
  }
  /* R39: the sentence states both steps in the order they happened. */
  assert.equal(describeChain(convertedChain(convert, layerChain(layer))),
    "the document as converted by the host that served it (google-export to odt) -> the document's own text layer");
  /* A calibrated conversion takes part like any step (R29's measured case). */
  const calibrated = convertedChain({ ...convert, cap: "C", calibration: "CAL-7" }, layerChain({ cap: "D" }));
  assert.equal(captureBound(calibrated, "B"), "D");
});

test("R60: a measured transcription returns the weaker of byteGrade and its cap, never stronger than either", () => {
  for (const [i, g] of BASIS_GRADES.entries())
    for (const [j, c] of BASIS_GRADES.entries()) assert.equal(captureBound([O(c)], g), BASIS_GRADES[Math.max(i, j)]);
  assert.equal(captureBound([O("A")]), EARNED_CAPTURE_CEILING);
  assert.equal(captureBound([O("C")], "Z"), null);
});
