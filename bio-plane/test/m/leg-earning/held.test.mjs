/* R8 and R9: what the earned registry answers for the two leg targets K1447 adds, a held standard (`STD-`) and a duty
   occurrence. Over the real standards and duties (their own test world, `../duties/fixture.mjs`, which composes
   standards' on one host) with this module created on the same host; an occurrence leg's target is spelled by
   `inquiry-grammar`'s `occurrenceRef` (its R15). */
import test from "node:test";
import assert from "node:assert/strict";
import { world as dutiesWorld } from "../duties/fixture.mjs";
import { legEarningOf, legCapped } from "../../../src/leg-earning/index.mjs";
import { EARNED_CAPTURE_CEILING } from "../../../src/record-grammar/index.mjs";
import { EXTRACTION_SCHEMA } from "../../../src/extraction/schema.mjs";
import { STANDARDS_CHECKS } from "../../../src/standards/index.mjs";
import { occurrenceRef } from "../../../src/inquiry-grammar/index.mjs";

const occ = (duty, key) => { const r = occurrenceRef(duty, key); if (!r) throw new Error(`no ref for ${duty}/${key}`); return r; };
const OCR_C = JSON.stringify([{ step: "pixels" }, { step: "ocr", engine: "tesseract", version: "5.3.4", cap: "C", confidence: { basis: "none" } }]);
const UNMEASURED = JSON.stringify([{ step: "pixels" }, { step: "ocr", engine: "moondream", version: "2b", confidence: { basis: "none" } }]);

function world() {
  const w = dutiesWorld();
  /* extraction's readings and text-source projection, under its read contract: the chain a capture's text was derived by */
  for (const t of ["reading_text_source", "readings"])
    w.st.db.exec(new RegExp(`CREATE TABLE IF NOT EXISTS ${t} \\([\\s\\S]*?\\n\\);`).exec(EXTRACTION_SCHEMA)[0].replace(/--[^\n]*/g, ""));
  w.le = legEarningOf(w.host, { record: w.record, membership: w.membership, promotion: w.promotion, content: w.content,
                                provenance: w.prov, standards: w.standards, duties: w.duties,
                                now: () => w.clock.now.replace(/\.\d{3}Z$/, "Z") });
  w.chain = (capSha, chain) => w.st.sql.exec(`INSERT INTO reading_text_source (capture_sha, bundle_id, transcribed, steps, chain)
                                               VALUES (?, 'INFO-x', 1, 2, ?)`, capSha, chain);
  w.std = (passages, extra = {}) => { const r = w.sw.declare({ text: passages.map((p) => p.contentId), ...extra });
    if (!r.ok) throw new Error(JSON.stringify(r).slice(0, 300)); return r.id; };
  return w;
}

test("R8 a held standard earns the capture ceiling of the capture holding its text, on the capture axis alone, and R2 caps a stated letter to it", () => {
  const w = world();
  const direct = w.passage("direct", { address: "https://example.org/code" });
  const S = w.std([direct]);
  const r = w.le.earned("ENT-2026-0001", [S]);
  const e = r.earned.capture[S];
  assert.deepEqual([e.mode, e.axis, e.standard, e.grade, e.captures], ["ceiling", "capture", S, EARNED_CAPTURE_CEILING, 1]);
  assert.match(e.why, /no more than/); assert.ok(e.ceiling);
  assert.equal(r.earned.connection[S], undefined, "a standard earns no connection grade, whatever the subject");
  assert.equal(r.earned.occurrence, undefined, "no occurrence asked about, no occurrence key");
  assert.equal(legCapped(EARNED_CAPTURE_CEILING, e, S), null);
  assert.equal(legCapped("A", e, S).grade, EARNED_CAPTURE_CEILING);
  /* the standard's text derived by a machine measured at C: the ceiling falls to C, bounded by fidelity */
  const ocr = w.passage("ocr", { address: "https://example.org/ocr" });
  w.chain(ocr.capSha, OCR_C);
  const T = w.std([ocr]);
  const t = w.le.earned(null, [T]).earned.capture[T];
  assert.deepEqual([t.grade, t.bounded_by], ["C", "CAPTURE_BOUNDED_BY_FIDELITY"]);
  assert.equal(legCapped(EARNED_CAPTURE_CEILING, t, T).grade, "C");
  /* text in two captures: the weakest of them, since a leg on the standard rests on all of its text */
  const both = w.std([direct, ocr]);
  assert.deepEqual([w.le.earned(null, [both]).earned.capture[both].grade, w.le.earned(null, [both]).earned.capture[both].captures], ["C", 2]);
  /* documents asked beside it answer as before: the standard joins neither of their reads */
  const mixed = w.le.earned(null, [S, direct.bundleId]);
  assert.deepEqual(mixed.earned.capture[direct.bundleId], w.le.earned(null, [direct.bundleId]).earned.capture[direct.bundleId]);
  assert.deepEqual(mixed.earned.capture[S], e);
});

test("R8 undetermined, never a letter: an unmeasured derivation, an ungraded route, a standard not held, and one holding no captured text (STANDARD_NO_TEXT); R2 caps every stated letter against each", () => {
  const w = world();
  const unm = w.passage("unmeasured", { address: "https://example.org/u" });
  w.chain(unm.capSha, UNMEASURED);
  const U = w.std([unm]);
  const route = w.passage("pigeon");
  w.prov.recordReceipt({ address: "https://example.org/p", addressNorm: "example.org/p", captureSha: route.capSha,
                         retrieved: "2026-09-01T00:00:00Z", via: "carrier-pigeon" });
  const P = w.std([route]);
  const absent = "STD-2026-0099";
  /* a standard whose text row is not held by content: no captured text at this version */
  const gone = w.passage("gone");
  const G = w.std([gone]);
  w.st.sql.exec(`DELETE FROM content WHERE content_id=?`, gone.contentId);
  const cap = w.le.earned(null, [U, P, absent, G]).earned.capture;
  assert.deepEqual([cap[U].grade, cap[U].determined, cap[U].undetermined_because], [null, false, "CAPTURE_FIDELITY_UNMEASURED"]);
  assert.deepEqual([cap[P].grade, cap[P].undetermined_because], [null, "CAPTURE_GRADE_VIA_UNRULED"]);
  assert.deepEqual([cap[absent].grade, cap[absent].undetermined_because], [null, "NO_SUCH_STANDARD"]);
  assert.deepEqual([cap[G].grade, cap[G].undetermined_because], [null, "STANDARD_NO_TEXT"]);
  assert.deepEqual([cap[G].check, cap[G].translation], [STANDARDS_CHECKS.STANDARD_NO_TEXT.check, STANDARDS_CHECKS.STANDARD_NO_TEXT.translation],
    "STANDARD_NO_TEXT's row travels with it");
  assert.match(cap[G].why, /holds no captured text/);
  for (const id of [U, P, absent, G]) {
    assert.equal(cap[id].mode, "ceiling", id); assert.equal(cap[id].axis, "capture", id);
    for (const g of ["A", "B", "C", "D"]) assert.deepEqual(legCapped(g, cap[id], id), { grade: null, why: cap[id].why }, `${id} ${g}`);
  }
});

test("R9 a duty occurrence earns its derivation as duties states it — the source in force, the trigger date, the due date, the level searched — and no grade; R2 answers null against it", () => {
  const w = world();
  const d = w.declare();
  assert.equal(d.ok, true, JSON.stringify(d).slice(0, 300));
  const asOf = w.clock.now.replace(/\.\d{3}Z$/, "Z");
  const read = w.duties.occurrencesOf({ dutyId: d.duty_id, asOf, viewer: "admin" });
  assert.equal(read.ok, true, JSON.stringify(read).slice(0, 300));
  const o = read.occurrences[0];
  const ref = occ(d.duty_id, o.key);
  const r = w.le.earned(null, [ref]);
  const e = r.earned.occurrence[ref];
  assert.deepEqual([e.mode, e.grade, e.duty, e.key, e.determined, e.as_of], ["derived", null, d.duty_id, o.key, true, asOf]);
  assert.deepEqual(e.derivation, o.derivation, "the derivation exactly as duties states it");
  for (const k of ["source_in_force", "trigger_date", "due_date", "level_searched"]) assert.ok(k in e.derivation, k);
  assert.deepEqual([e.state, e.trigger, e.due], [o.state, o.trigger, o.due]);
  assert.match(e.why, /no grade of its/);
  assert.equal(r.earned.connection[ref], undefined); assert.equal(r.earned.capture[ref], undefined);
  assert.equal(legCapped("A", e, ref), null);
  assert.equal(legCapped("D", e, ref), null);
});

test("R9 an occurrence duties cannot derive is earned as undetermined with the reason: a duty not held, a key not derived, a state duties answers undetermined", () => {
  const w = world();
  const d = w.declare();
  const missing = occ("DUT-2026-9999", `OCC-${"0".repeat(32)}`);
  const unknownKey = occ(d.duty_id, `OCC-${"f".repeat(32)}`);
  /* a trigger with no due rule held: duties answers the occurrence undetermined */
  const u = w.declare({ time: { basis: "rule", rule: "no_such_rule", applies_to: "records_request" } });
  assert.equal(u.ok, true, JSON.stringify(u).slice(0, 300));
  const asOf = w.clock.now.replace(/\.\d{3}Z$/, "Z");
  const uo = w.duties.occurrencesOf({ dutyId: u.duty_id, asOf, viewer: "admin" }).occurrences[0];
  assert.equal(uo.state, "undetermined");
  const und = occ(u.duty_id, uo.key);
  const r = w.le.earned(null, [missing, unknownKey, und]).earned.occurrence;
  assert.deepEqual([r[missing].determined, r[missing].grade, r[missing].undetermined_because], [false, null, "NO_SUCH_DUTY"]);
  assert.deepEqual([r[unknownKey].determined, r[unknownKey].undetermined_because], [false, "OCCURRENCE_NOT_DERIVED"]);
  assert.match(r[unknownKey].why, /derives no occurrence/);
  assert.deepEqual([r[und].determined, r[und].grade, r[und].undetermined_because], [false, null, "OCCURRENCE_UNDETERMINED"]);
  assert.equal(r[und].why, `duties answers ${und} undetermined: ${uo.why}`);
  assert.deepEqual(r[und].derivation, uo.derivation);
  for (const ref of [missing, unknownKey, und]) assert.equal(legCapped("C", r[ref], ref), null, ref);
  /* a string that is not an occurrence reference is a target like any other: no occurrence entry */
  assert.equal(w.le.earned(null, [`occurrence:${d.duty_id}`]).earned.occurrence, undefined);
});
