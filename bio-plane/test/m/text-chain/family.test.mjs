/* text-chain: requirement-named tests for the module's refusal family, C-35 `TEXT_CHAIN_CHECKS`
 * (build/requirements/text-chain.md, Errors summary and R86), held in this module since T18 (K629). */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TEXT_CHAIN_CHECKS, checkChain, appendStep, convertedChain, checkConfidence, checkAnchor, checkAttestation,
} from "../../../src/textchain.mjs";

/* Each C-35 condition driven through the service that refuses it: the row is read off the refusal the code
   path produced, never off the table beside it. */
const DRIVEN = [
  ["TEXT_CHAIN_COLLAPSED", "C-35.1", () => checkChain("ocr")],
  ["TEXT_CHAIN_EMPTY", "C-35.2", () => checkChain([])],
  ["TEXT_CHAIN_STEP_SHAPE", "C-35.3", () => checkChain([["not", "a", "step"]])],
  ["TEXT_CHAIN_STEP_UNKNOWN", "C-35.4", () => checkChain([{ step: "transcribed-somehow" }])],
  ["TEXT_CHAIN_STEP_UNNAMED", "C-35.5", () => checkChain([{ step: "ocr", cap: "C" }])],
  ["TEXT_CHAIN_STRENGTHENS", "C-35.6", () => appendStep([{ step: "ocr", engine: "e", cap: "D" }], { step: "ai", engine: "f", cap: "A" })],
  ["TEXT_CONFIDENCE_PSEUDO", "C-35.7", () => checkConfidence({ value: 0.99, basis: "how sure I feel" })],
  ["TEXT_CONFIDENCE_SHAPE", "C-35.8", () => checkConfidence({ basis: "engine" })],
  ["TEXT_ANCHOR_MISSING", "C-35.9", () => checkAnchor({ kind: "pdf-page", page: 0 })],
  ["TEXT_ATTEST_MACHINE", "C-35.10", () => checkAttestation({ member: "token:member", at: "2026-09-30", extent: { kind: "document" } })],
  ["TEXT_ATTEST_EXTENT", "C-35.11", () => checkAttestation({ member: "m", at: "2026-09-30", extent: { kind: "the whole thing" } })],
  ["TEXT_CHAIN_CAL_REF", "C-35.12", () => checkChain([{ step: "layer", cap: "C", calibration: { id: "CAL-1" } }])],
  ["TEXT_CHAIN_LETTER_UNCALIBRATED", "C-35.13", () => checkChain([{ step: "convert", engine: "host-export", format: "odt", cap: "B" }])],
  ["TEXT_CHAIN_LETTER_ON_PERSON", "C-35.14", () => checkChain([{ step: "typed", member: "m", cap: "A" }])],
];
/* Which service holds each region, as its row's `where` names it. */
const REGION_OF = {
  "is-text-chain-shape": "checkChain", "is-text-chain-monotone": "appendStep", "is-text-region-confidence": "checkConfidence",
  "is-text-anchor": "checkAnchor", "is-text-attestation": "checkAttestation",
};

test("R86 (Errors summary): the family is exactly the fourteen C-35 rows, C-35.1 to C-35.14, one per code", () => {
  assert.equal(Object.getPrototypeOf(TEXT_CHAIN_CHECKS), Object.prototype);
  assert.deepEqual(Object.keys(TEXT_CHAIN_CHECKS).sort(), DRIVEN.map(([code]) => code).sort());
  assert.deepEqual(Object.values(TEXT_CHAIN_CHECKS).map((r) => r.check).sort((a, b) => a.split(".")[1] - b.split(".")[1]),
    Array.from({ length: 14 }, (_, i) => `C-35.${i + 1}`));
  for (const [code, row] of Object.entries(TEXT_CHAIN_CHECKS)) {
    assert.deepEqual(Object.keys(row).sort(), ["check", "translation", "where"], code);
    /* Every code is in the module's refusal namespaces, TEXT_CHAIN_*, TEXT_CONFIDENCE_*, TEXT_ANCHOR_*, TEXT_ATTEST_*. */
    assert.match(code, /^TEXT_(CHAIN|CONFIDENCE|ANCHOR|ATTEST)_[A-Z_]+$/);
  }
});

test("R86: every row names the smallest span, a region of this module's service that refuses it, never a whole file", () => {
  for (const [code, row] of Object.entries(TEXT_CHAIN_CHECKS)) {
    const m = /^src\/textchain\.mjs (\w+) > (is-text-[a-z-]+)$/.exec(row.where);
    assert.ok(m, `${code}: ${row.where}`);
    assert.equal(REGION_OF[m[2]], m[1], `${code}: region ${m[2]} is ${REGION_OF[m[2]]}'s`);
  }
});

test("R86: every row carries a member-facing translation that says which kind of no", () => {
  for (const [code, row] of Object.entries(TEXT_CHAIN_CHECKS)) {
    assert.equal(typeof row.translation, "string", code);
    assert.ok(row.translation.trim().length >= 40, code);
    assert.equal(row.translation, row.translation.trim(), code);
  }
  /* Fourteen conditions, fourteen different sentences. */
  assert.equal(new Set(Object.values(TEXT_CHAIN_CHECKS).map((r) => r.translation)).size, 14);
});

test("R86: each C-35 row is carried by the refusal its own condition produces, every row driven", () => {
  for (const [code, check, drive] of DRIVEN) {
    const r = drive();
    assert.equal(r && r.ok, false, code);
    assert.equal(r.code, code);
    assert.equal(r.check, check);
    assert.equal(r.check, TEXT_CHAIN_CHECKS[code].check);
    assert.equal(r.translation, TEXT_CHAIN_CHECKS[code].translation);
    assert.ok(typeof r.detail === "string" && r.detail.trim().length > 0, code);
    /* The refusal carries the row's two fields and its own detail, nothing of the row's `where`. */
    assert.deepEqual(Object.keys(r).sort(), ["check", "code", "detail", "ok", "translation"]);
  }
  /* The same rows reach a refusal relayed through a builder (convertedChain refuses what checkChain refuses, R16). */
  assert.equal(convertedChain({ step: "convert", engine: "x" }, [{ step: "layer" }]).check, TEXT_CHAIN_CHECKS.TEXT_CHAIN_STEP_UNNAMED.check);
});
