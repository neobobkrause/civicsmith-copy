/* DEC-149 (T34-86): every member-facing sentence the earned registry writes calls the group's Civicsmith "your group's
   Civicsmith", never "this instance", "this copy" or "this plane". Each changed string is driven here at the interface
   (R1's capture entries by every case that writes one, R8's standard ceiling) and checked whole. Each sentence is
   compared by its word key or its localize id, never by a copy of its text (K3810). */
import test from "node:test";
import assert from "node:assert/strict";
import { world } from "./fixture.mjs";
import { world as dutiesWorld } from "../duties/fixture.mjs";
import { legEarningOf } from "../../../src/leg-earning/index.mjs";
import { EXTRACTION_SCHEMA } from "../../../src/extraction/schema.mjs";
import { ARCHIVE_VIA } from "../../../src/provenance/index.mjs";
import { EARNED_CAPTURE_CEILING, UNREACHABLE_CAPTURE_GRADE, BASIS_GRADES } from "../../../src/record-grammar/index.mjs";
import { word, localize } from "../../../src/setup-words/index.mjs";

const FORBIDDEN = /\b(this|the) (instance|copy|plane)\b/i;
const captureWord = (id) => word("leg-earning.capture_word", { bundle_id: id, n: "1" });
const ocr = (cap) => [{ step: "pixels" }, { step: "ocr", engine: "tesseract", version: "5.3.4", cap, confidence: { basis: "none" } }];
const below = (g) => BASIS_GRADES[BASIS_GRADES.indexOf(g) + 1];
/* CR2-7 (BD-18): the route-bound sentence, filled with provenance's own answer for the route, compared by its id. */
const routeBound = (cw, bound, routeWhy) => localize("leg-earning.why.strongest_route_follows_provenance", "{captureWord}, and the strongest route by which your team's Civicsmith received them earns {bound} on the capture axis, as provenance answers for that route: {routeWhy}. So the strongest capture grade this document can earn is {bound}.", { captureWord: cw, bound: String(bound), routeWhy: String(routeWhy) });
const words = (e) => Object.values(e).filter((v) => typeof v === "string").join("\n");

test("R1 DEC-149: every capture entry names the group's Civicsmith as your group's Civicsmith, never this instance or this plane — the fetched ceiling, the byte-bound measured transcription, the route-bound replay, the fidelity-bound transcription, and the unreachable grade", () => {
  const w = world();
  const PLAIN = "INFO-2026-8900-plain", OCR_A = "INFO-2026-8901-ocr-a", REPLAY = "INFO-2026-8902-replay",
        OCR_C = "INFO-2026-8903-ocr-c";
  w.doc(PLAIN, ["publisher-typed"], { chain: null });
  w.doc(OCR_A, ["ocr at A"], { chain: ocr("A") });
  const [replaySha] = w.doc(REPLAY, ["replayed"], { via: ARCHIVE_VIA });
  w.doc(OCR_C, ["ocr at C"], { chain: ocr("C") });
  const cap = w.k.earned(null, [PLAIN, OCR_A, REPLAY, OCR_C]).earned.capture;
  const fetched = (id) => word("leg-earning.why.strongest_capture_grade", { capture_word: captureWord(id), earned_capture_ceiling: String(EARNED_CAPTURE_CEILING) });
  /* case 1, nothing transcribed; case 3, a measured transcription the bytes bound: the same sentence */
  assert.equal(cap[PLAIN].why, fetched(PLAIN));
  assert.equal(cap[OCR_A].why, fetched(OCR_A));
  /* the route binds: an archive replay, one rank below the ceiling */
  const R = below(EARNED_CAPTURE_CEILING);
  assert.deepEqual([cap[REPLAY].grade, cap[REPLAY].bounded_by], [R, "CAPTURE_BOUNDED_BY_ROUTE"]);
  assert.equal(cap[REPLAY].why, routeBound(captureWord(REPLAY), R, w.prov.captureGrade(replaySha).why));
  /* the fidelity binds */
  assert.equal(cap[OCR_C].bounded_by, "CAPTURE_BOUNDED_BY_FIDELITY");
  assert.equal(cap[OCR_C].why, localize("leg-earning.index.fidelity_bound_bytes_fetched", "{captureWord}, and the bytes as your team's Civicsmith fetched them would be worth {EARNED_CAPTURE_CEILING} — but this document's TEXT was derived by a machine and that derivation is measured at {bound}. The capture axis is bounded by the weakest link of byte provenance and transcription fidelity, with no third scale (DEC-4), so the strongest capture grade this document can earn is {bound}. Transcription never RAISES a capture grade, and it is not a separate measurement a member can cite instead.", { captureWord: captureWord(OCR_C), EARNED_CAPTURE_CEILING: String(EARNED_CAPTURE_CEILING), bound: "C" }));
  const ceiling = word("leg-earning.ceiling.grade_reachable_capture", { unreachable_capture_grade: String(UNREACHABLE_CAPTURE_GRADE) });
  for (const id of [PLAIN, OCR_A, REPLAY, OCR_C]) {
    assert.equal(cap[id].ceiling, ceiling, id);
    assert.doesNotMatch(words(cap[id]), FORBIDDEN, id);
  }
});

test("R8 DEC-149: a held standard's capture ceiling names the group's Civicsmith as your group's Civicsmith, never this plane", () => {
  const w = dutiesWorld();
  /* extraction's readings and text-source projection, under its read contract, as `held.test.mjs` composes them */
  for (const t of ["reading_text_source", "readings"])
    w.st.db.exec(new RegExp(`CREATE TABLE IF NOT EXISTS ${t} \\([\\s\\S]*?\\n\\);`).exec(EXTRACTION_SCHEMA)[0].replace(/--[^\n]*/g, ""));
  const le = legEarningOf(w.host, { record: w.record, membership: w.membership, promotion: w.promotion, content: w.content,
                                    provenance: w.prov, standards: w.standards, duties: w.duties,
                                    now: () => w.clock.now.replace(/\.\d{3}Z$/, "Z") });
  const p = w.passage("direct", { address: "https://example.org/code" });
  const d = w.sw.declare({ text: [p.contentId] });
  assert.equal(d.ok, true, JSON.stringify(d).slice(0, 300));
  const held = le.earned(null, [d.id]).earned.capture[d.id];
  const absent = le.earned(null, ["STD-2026-0099"]).earned.capture["STD-2026-0099"];
  assert.equal(held.grade, EARNED_CAPTURE_CEILING);
  assert.equal(absent.undetermined_because, "NO_SUCH_STANDARD");
  const ceiling = word("leg-earning.ceiling.grade_reachable_capture", { unreachable_capture_grade: String(UNREACHABLE_CAPTURE_GRADE) });
  for (const e of [held, absent]) {
    assert.equal(e.ceiling, ceiling);
    assert.doesNotMatch(words(e), FORBIDDEN);
  }
});

test("R1 CR2-7 (BD-18): a ceiling the route binds states provenance's own answer for that route, never a fixed account of an archive replay — the replay's letter and sentence are provenance's, the document's sentence follows them", () => {
  const w = world();
  const REPLAY = "INFO-2026-8910-replay", BOTH = "INFO-2026-8911-both";
  const [replaySha] = w.doc(REPLAY, ["replayed only"], { via: ARCHIVE_VIA });
  const cg = w.prov.captureGrade(replaySha);
  assert.equal(typeof cg.why, "string");
  const cap = w.k.earned(null, [REPLAY]).earned.capture[REPLAY];
  assert.deepEqual([cap.grade, cap.bounded_by], [cg.grade, "CAPTURE_BOUNDED_BY_ROUTE"]);
  assert.equal(cap.why, routeBound(captureWord(REPLAY), cg.grade, cg.why));
  assert.ok(cap.why.includes(cg.why), "the document's sentence carries provenance's sentence for the route");
  /* control: a document also fetched direct earns the ceiling, and the route-bound sentence is not used */
  w.doc(BOTH, ["fetched direct"]);
  const direct = w.k.earned(null, [BOTH]).earned.capture[BOTH];
  assert.equal(direct.grade, EARNED_CAPTURE_CEILING);
  assert.equal(direct.bounded_by, undefined);
  assert.equal(direct.why, word("leg-earning.why.strongest_capture_grade", { capture_word: captureWord(BOTH), earned_capture_ceiling: String(EARNED_CAPTURE_CEILING) }));
});
