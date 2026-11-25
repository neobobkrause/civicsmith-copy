/* text-chain: requirement-named tests for the AI's reading of a page that is only a picture (N820, D21;
 * build/requirements/text-chain.md R104): the step kind `ai_transcription`, whose derivation cap is undetermined until
 * its accuracy is measured, so `captureBound` answers undetermined for text it produced. Each arm carries a negative
 * control: the same chain without the new step keeps the bound an existing kind gives it. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STEP_KINDS, MACHINE_READ_KINDS, TEXT_CHAIN_CHECKS, checkChain, appendStep, mergedChain, derivationCap, captureBound,
  gradeCeiling, tiersEvidenced, describeChain, chainKindFor, isTranscribed, calibrationsOf, layerChain,
} from "../../../src/textchain.mjs";
import { BASIS_GRADES, EARNED_CAPTURE_CEILING } from "../../../src/record-grammar/index.mjs";

const AIT = (x = {}) => ({ step: "ai_transcription", engine: "vision-model", version: "3", ...x });
const PIX = { step: "pixels" };
const O = (cap, x = {}) => ({ step: "ocr", engine: "eng", cap, ...x });
const pages = (ps) => ({ kind: "pages", pages: ps });
const weakest = (...gs) => BASIS_GRADES[Math.max(...gs.map((g) => BASIS_GRADES.indexOf(g)))];
const BYTE_GRADES = [...BASIS_GRADES, EARNED_CAPTURE_CEILING];

test("R104: ai_transcription is a derivation step kind, the AI's reading, a machine reading on tier 4", () => {
  const k = STEP_KINDS.ai_transcription;
  assert.ok(k, "the kind exists");
  assert.equal(k.role, "derivation");
  assert.match(k.label, /AI's reading/);
  assert.equal(k.tier, 4);
  assert.equal(k.machine, true);
  assert.ok(MACHINE_READ_KINDS.includes("ai_transcription"));
  assert.equal(checkChain([AIT()]), null);
  assert.equal(isTranscribed([AIT()]), true);
  /* It is not `ai`, the rewrite of text another step produced. */
  assert.notEqual(k.label, STEP_KINDS.ai.label);
  assert.equal(STEP_KINDS.ai.tier, null);
});

test("R104: the step names the model that read the page", () => {
  for (const engine of [undefined, null, "", "  ", 5]) {
    const r = checkChain([AIT({ engine })]);
    assert.equal(r.code, "TEXT_CHAIN_STEP_UNNAMED", JSON.stringify(engine));
    assert.equal(r.check, TEXT_CHAIN_CHECKS.TEXT_CHAIN_STEP_UNNAMED.check);
  }
});

test("R104: unmeasured, captureBound is undetermined for its text, for every byte grade, whatever else the chain measured", () => {
  for (const g of BYTE_GRADES) {
    assert.equal(captureBound([PIX, AIT()], g), null, g);
    assert.equal(captureBound([layerChain({ cap: "B" })[0], PIX, AIT()], g), null, g);
  }
  assert.equal(captureBound([PIX, AIT()]), null);
  for (const c of BASIS_GRADES) {
    const ocr = [PIX, O(c)];
    /* Appended after a measured OCR pass (R14: an unknown cap appends unconditionally). */
    const chain = appendStep(ocr, AIT());
    assert.ok(Array.isArray(chain), c);
    assert.equal(derivationCap(chain), null, c);
    for (const g of BYTE_GRADES) assert.equal(captureBound(chain, g), null, `${c} ${g}`);
    /* Negative control: the same chain without the AI's reading keeps the OCR pass's bound (R60, unchanged). */
    assert.equal(derivationCap(ocr), c);
    for (const g of BASIS_GRADES) assert.equal(captureBound(ocr, g), weakest(g, c), `${c} ${g}`);
    /* Negative control: an unmeasured `ai` rewrite stays sequence-neutral, as before R104. */
    assert.equal(derivationCap([...ocr, { step: "ai", engine: "m" }]), c);
    /* And every existing kind's unmeasured step keeps the bound it gave before R104. */
    for (const s of [{ step: "layer" }, PIX, O(null), { step: "attested", member: "m", at: "d" }])
      assert.equal(derivationCap([...ocr, s]), c, `${c} ${s.step}`);
  }
});

test("R104: in a mixed document, only the pages the AI read are undetermined, and so is the whole document", () => {
  const doc = mergedChain([{ chain: [PIX, O("C")], pages: [0, 1] }, { chain: [PIX, AIT()], pages: [2] }]);
  assert.equal(derivationCap(doc, { page: 2 }), null);
  assert.equal(gradeCeiling(doc, { page: 2 }).ceiling, null);
  assert.equal(derivationCap(doc), null);
  for (const g of BYTE_GRADES) assert.equal(captureBound(doc, g), null);
  /* Negative control: the OCR pages keep their letter. */
  assert.equal(derivationCap(doc, { page: 0 }), "C");
  assert.equal(gradeCeiling(doc, { page: 1 }).ceiling, "C");
  /* Negative control: the same document with OCR on page 2 instead is measured throughout. */
  const ocrOnly = mergedChain([{ chain: [PIX, O("C")], pages: [0, 1] }, { chain: [PIX, O("D")], pages: [2] }]);
  assert.equal(derivationCap(ocrOnly), "D");
  assert.equal(captureBound(ocrOnly, "B"), "D");
});

test("R104: a letter comes only from a measurement, its calibration named; once measured it bounds like any step", () => {
  for (const cap of BASIS_GRADES) {
    const r = checkChain([AIT({ cap })]);
    assert.equal(r.code, "TEXT_CHAIN_LETTER_UNCALIBRATED", cap);
    assert.equal(r.check, TEXT_CHAIN_CHECKS.TEXT_CHAIN_LETTER_UNCALIBRATED.check);
    const measured = [PIX, AIT({ cap, calibration: "CAL-AIT-1" })];
    assert.equal(checkChain(measured), null);
    assert.deepEqual(calibrationsOf(measured), ["CAL-AIT-1"]);
    assert.equal(derivationCap(measured), cap);
    for (const g of BASIS_GRADES) assert.equal(captureBound(measured, g), weakest(g, cap), `${cap} ${g}`);
  }
  /* The member-facing words (C-35.13, K2428) name both cases the refusal is for: a conversion, and an AI's reading. */
  const words = checkChain([AIT({ cap: "C" })]).translation;
  assert.equal(words, checkChain([{ step: "convert", engine: "host-export", format: "odt", cap: "C" }]).translation);
  assert.match(words, /a conversion of the document, or an AI's reading of a page/);
  assert.match(words, /an AI reads a scan/);
  assert.match(words, /"not yet determined"/);
  assert.match(checkChain([AIT({ cap: "C" })]).detail, /ai_transcription step claims fidelity "C"/);
  /* Rule 2 holds: a measured reading stronger than the chain it extends is refused. */
  assert.equal(appendStep([PIX, O("D")], AIT({ cap: "B", calibration: "CAL-AIT-1" })).code, "TEXT_CHAIN_STRENGTHENS");
});

test("R104: a member who checks a passage against the page raises it through gradeCeiling; the chain stays undetermined", () => {
  const chain = [PIX, AIT()];
  const att = { member: "member:ruth", at: "2026-10-09", extent: { kind: "page", page: 0 } };
  const r = gradeCeiling(chain, { page: 0 }, [att]);
  assert.equal(r.ceiling, EARNED_CAPTURE_CEILING);
  assert.equal(r.determinant, "attestation");
  /* Not at a page the member did not check, and never in the derivation cap itself. */
  assert.equal(gradeCeiling(chain, { page: 1 }, [att]).ceiling, null);
  assert.equal(derivationCap([...chain, { step: "attested", ...att }]), null);
});

test("R104: the chain says what happened: tier 4 evidenced, the AI's reading named, the page read that way", () => {
  assert.deepEqual(tiersEvidenced([PIX, AIT({ extent: pages([2]) })]).tiers.map((t) => [t.tier, t.steps, t.covers]),
    [[3, ["pixels"], "all"], [4, ["ai_transcription"], [2]]]);
  assert.equal(describeChain([PIX, AIT()]), `${STEP_KINDS.pixels.label} -> ${STEP_KINDS.ai_transcription.label} (vision-model 3)`);
  const doc = mergedChain([{ chain: [PIX, O("C")], pages: [0] }, { chain: [PIX, AIT()], pages: [1] }]);
  assert.equal(chainKindFor(doc, 1), "ai_transcription");
  assert.equal(chainKindFor(doc, 0), "ocr");
});
