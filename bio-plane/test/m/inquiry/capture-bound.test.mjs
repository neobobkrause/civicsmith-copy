/* The capture ceiling bounded by transcription fidelity as its weakest link, no third scale (DEC-4; REC-88, D-349): what
   the registry earns for a document whose text a machine derived (R13), the refusal of a leg claiming above it at the
   write (R6), and the leg read against it (R14, R15). Converted from `test/content-capture-bound.test.mjs` (N393, K573):
   the same corpus (four documents whose text has four different provenances, and one the record never read), each
   chain written as a reading through extraction's own projection, receipts through provenance's, legs through a real
   promotion. The old suite's negative-control arms (`nc-rec88.mjs`) and its baseline probe edited source and are
   dropped (P7).
   The earned registry's own tests (R13–R17 here before T33) moved with those requirements to `leg-earning`'s suite
   (K617, K1505); what stays is this module's own share. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, V, inquiryMd } from "./fixture.mjs";
import { legCapped } from "../../../src/inquiry/index.mjs";
import { EARNED_CAPTURE_CEILING, BASIS_GRADES } from "../../../src/record-grammar/index.mjs";

/* THE CHAINS, each a shape and not an engine: `cap` is a measurement handed in, never a calibration held here. */
const ocrChain = (cap) => [{ step: "pixels" },
  { step: "ocr", engine: "tesseract", version: "5.3.4", cap, confidence: { basis: "none" } }];
/* a derivation step carrying no measured cap: the general shape, whatever step kind later carries it */
const unmeasuredChain = () => [{ step: "pixels" },
  { step: "ocr", engine: "moondream", version: "2b", confidence: { basis: "none" } }];

const SUBJECT = "ENT-2026-0001";
const PLAIN = "INFO-2026-8800-plain", OCR_C = "INFO-2026-8800-ocr-c", OCR_A = "INFO-2026-8800-ocr-a",
      UNMEAS = "INFO-2026-8800-unmeasured", NEVER_READ = "INFO-2026-8800-never-read",
      PLAIN_UNROUTED = "INFO-2026-8801-plain-unrouted", MIXED = "INFO-2026-8802-mixed",
      MIXED_UNMEAS = "INFO-2026-8803-mixed-unmeasured";
const DOCS = [PLAIN, OCR_C, OCR_A, UNMEAS];

/* The corpus: each document fetched directly (a measured route, byte grade the ceiling), its capture read with the
   chain named; PLAIN read with no text source (publisher-typed), NEVER_READ never read at all. */
function corpus() {
  const w = world();
  w.entity(SUBJECT, "Sewer Fund Transfer Ordinance");
  w.doc(PLAIN, ["publisher-typed"], { chain: null });
  w.doc(OCR_C, ["ocr at C"], { chain: ocrChain("C") });
  w.doc(OCR_A, ["ocr at A"], { chain: ocrChain("A") });
  w.doc(UNMEAS, ["unmeasured"], { chain: unmeasuredChain() });
  w.doc(NEVER_READ, ["never read"]);
  return w;
}

/* A leg on `target` at `grade` on the capture axis (none: no grade stated), promoted as a fresh inquiry. */
let n = 0;
const legOn = (w, target, grade) => {
  const id = `INQ-2026-88${String(++n).padStart(2, "0")}-leg`;
  return w.promote(id, inquiryMdFor(id, target, grade), null);
};
const inquiryMdFor = (id, target, grade) => inquiryMd(id, { subject: SUBJECT,
  legs: [grade === undefined ? { target } : { target, grade, grade_axis: "capture", grade_source: "capture" }] });

const checks = (r) => [...new Set((r.findings || []).map((f) => f.check).filter(Boolean))].sort();
const details = (r) => (r.findings || []).map((f) => String(f.detail ?? ""));
const repairs = (r) => (r.findings || []).flatMap((f) => f.repairs || []).join(" || ");

test("R6 the write: a capture grade above the fidelity bound is refused by name, naming both letters and the doctrine; at or under it lands", () => {
  const w = corpus();
  const above = legOn(w, OCR_C, EARNED_CAPTURE_CEILING);
  assert.equal(above.ok, false); assert.equal(above.reason, "BASIS_REFUSED");
  assert.deepEqual(checks(above), ["C-2.8"]);
  assert.ok(details(above).some((d) => /STRONGER than the C/.test(d)), details(above).join(" | "));
  assert.ok(details(above).some((d) => /derivation is measured at C/.test(d)));
  assert.ok(details(above).some((d) => /weakest link of byte provenance and transcription fidelity/.test(d)));
  const at = legOn(w, OCR_C, "C");
  assert.equal(at.ok, true, JSON.stringify(at).slice(0, 400));
  const under = legOn(w, OCR_C, "D");
  assert.equal(under.ok, true, "a weaker letter is the member's own account of a poorer route and stays theirs");
  /* the pair: the letter the read reports is the letter the write accepts, and no stronger */
  const reported = w.k.earned(SUBJECT, [OCR_C]).earned.capture[OCR_C].grade;
  assert.deepEqual([reported, at.ok, above.ok], ["C", true, false]);
});

test("R6 fidelity never raises: a leg claiming the unreachable letter on a document measured at it is still refused", () => {
  const w = corpus();
  const r = legOn(w, OCR_A, BASIS_GRADES[0]);
  assert.equal(r.ok, false); assert.deepEqual(checks(r), ["C-2.8"]);
  assert.equal(legOn(w, OCR_A, EARNED_CAPTURE_CEILING).ok, true);
});

test("R6 R32 an unmeasured transcription: any letter refused for claiming, never for being unmeasured; no grade lands", () => {
  const w = corpus();
  for (const g of BASIS_GRADES) {
    const r = legOn(w, UNMEAS, g);
    assert.equal(r.ok, false, g); assert.deepEqual(checks(r), ["C-2.8"], g);
    assert.ok(details(r).some((d) => new RegExp(`UNDETERMINED, not ${g}`).test(d)), `${g}: ${details(r).join(" | ")}`);
    assert.equal(details(r).filter((d) => /holds no registered capture/.test(d)).length, 0, "never 'no capture held'");
  }
  const r = legOn(w, UNMEAS, EARNED_CAPTURE_CEILING);
  assert.match(repairs(r), /state NO capture grade/, "stating no grade is offered as the way through");
  assert.match(repairs(r), /have the transcription measured/);
  const none = legOn(w, UNMEAS, undefined);
  assert.equal(none.ok, true, JSON.stringify(none).slice(0, 400));
  const legs = w.k.basisFor(none.bundleId).legs;
  assert.deepEqual(legs.map((l) => [l.target_id, l.grade]), [[UNMEAS, null]], "the leg is named, ungraded, and inert");
});

test("R6 over-strictness: a leg claiming the byte ceiling on publisher-typed or never-read text lands as it always has", () => {
  const w = corpus();
  assert.equal(legOn(w, PLAIN, EARNED_CAPTURE_CEILING).ok, true);
  assert.equal(legOn(w, NEVER_READ, EARNED_CAPTURE_CEILING).ok, true);
});

