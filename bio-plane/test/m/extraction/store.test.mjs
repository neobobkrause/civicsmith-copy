/* extraction: the store half at the module's interface: the writer and its registrations (R19–R24), the reads
   (R27–R30, R36, R37), purge (R49) and the invariants they carry (R44–R46, R48). Each test names the requirement ids it
   checks in its title. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fresh, bundle, sha } from "./fixture.mjs";
import { compareProvenance, readingProvenance } from "../../../src/reading-pipeline/index.mjs";
import { canonicalExtent } from "../../../src/textchain.mjs";
import { CAPTURE_TEXT_UNIT_CAP, CAPTURE_TEXT_CAPTURE_UNIT_BOUND, CAPTURE_TEXT_CAPTURE_BOUND, OCCURRENCES_PER_REF,
         TEXT_SOURCE_LIMIT_MAX, labelTerms, extractionOps, noSha, LAND_BATCH_BYTES } from "../../../src/extraction/index.mjs";

const S1 = "1".repeat(64), S2 = "2".repeat(64), S3 = "3".repeat(64);
const layer = (tier = 1, extra = {}) => [{ step: "layer", tier, container: "pdf", cap: null, measured_by: "unmeasured", ...extra }];
const ocrChain = (cal = null) => [{ step: "pixels", cap: "C", measured_by: "M-1", calibration: cal },
                                  { step: "ocr", engine: "tess", version: "5.3", cap: "C", measured_by: "M-1", calibration: cal }];
async function reading(entities = [], extra = {}) {
  const r = { content_type: "t", reader_version: 1, read_from_text: true, found: entities.length > 0, entities, facts: {},
              at: "2026-09-27T00:00:00Z", basis: "b", text_source: layer(), text_tier: 1, text_container: "pdf", ...extra };
  if (!("provenance" in r)) r.provenance = await readingProvenance({ text: "some text", chain: r.text_source, tier: r.text_tier, container: "pdf" });
  return r;
}
const E = (kind, key, label = null, source = null, occurrences = undefined) =>
  ({ kind, key, label, facts: {}, ref: `${kind}:${key}`, source, ...(occurrences ? { occurrences } : {}) });
const page = (p) => ({ kind: "pdf-page", ref: `p${p}`, page: p, rect: null });
const provFile = (docs) => ({ path: "data/provenance.json", text: JSON.stringify({ documents: docs }) });

test("R19 R46: one writer replaces the reading row, one reference row per distinct place (source first, occurrences, capped, the rest one unplaced row), raw and unresolved, the name terms per source, the text-source row", async () => {
  const w = fresh();
  bundle(w.s, "B-1");
  const occ = Array.from({ length: OCCURRENCES_PER_REF + 5 }, (_, i) => ({ kind: "pdf-page", ref: `p${i + 1}`, page: i + 1, rect: null }));
  const r = await reading([E("meeting", "2101", "City Council Meeting", page(0), occ), E("person", "X-1", null, { kind: "bogus" })],
                          { text_source: ocrChain("CAL-1"), text_tier: 3 });
  const out = w.x.writeReading({ bundleId: "B-1", captureSha: S1, reading: r, profileFormat: "pdf", author: "member:m1" });
  const row = w.one(`SELECT * FROM readings WHERE capture_sha=?`, S1);
  assert.deepEqual([row.bundle_id, row.content_type, row.reader_version, row.found, row.entity_count, row.at, row.capture_format],
                   ["B-1", "t", 1, 1, 2, "2026-09-27T00:00:00Z", "pdf"]);
  assert.deepEqual(JSON.parse(row.reading), r);
  const refs = w.rows(`SELECT * FROM reading_refs WHERE capture_sha=? AND ref='meeting:2101' ORDER BY seq`, S1);
  assert.equal(refs.length, OCCURRENCES_PER_REF + 2, "source, then every listed occurrence, then one unplaced row");
  assert.equal(refs[0].pos_ref, "p0");
  assert.equal(refs[refs.length - 1].occurrence, "");
  assert.deepEqual([refs[0].ref_kind, refs[0].ref_key], ["meeting", "2101"]);
  const bogus = w.one(`SELECT * FROM reading_refs WHERE capture_sha=? AND ref='person:X-1'`, S1);
  assert.equal(bogus.pos_kind, null, "a position that does not normalise is stored as none");
  const terms = w.rows(`SELECT src, term FROM reading_ref_terms WHERE capture_sha=? AND ref='meeting:2101' ORDER BY src, term`, S1);
  assert.deepEqual(terms.filter((t) => t.src === "label").map((t) => t.term), labelTerms("City Council Meeting").sort());
  assert.ok(terms.some((t) => t.src === "ref") && terms.some((t) => t.src === "key"));
  const ts = w.one(`SELECT * FROM reading_text_source WHERE capture_sha=?`, S1);
  assert.deepEqual([ts.transcribed, ts.terminal_step, JSON.parse(ts.engines), ts.derivation_cap, ts.steps, JSON.parse(ts.calibrations)],
                   [1, "ocr", ["tess"], "C", 2, ["CAL-1"]]);
  assert.ok(out.indexed && out.kept);
  /* a replacement: no orphan references, a malformed chain writes no text-source row, the capture format kept when none is given */
  w.x.writeReading({ bundleId: "B-1", captureSha: S1, reading: await reading([E("meeting", "9")], { text_source: [{ step: "nonsense" }] }) });
  assert.deepEqual(w.rows(`SELECT ref FROM reading_refs WHERE capture_sha=?`, S1).map((x) => x.ref), ["meeting:9"]);
  assert.equal(w.one(`SELECT * FROM reading_text_source WHERE capture_sha=?`, S1), null);
  assert.equal(w.one(`SELECT capture_format FROM readings WHERE capture_sha=?`, S1).capture_format, "pdf");
});

test("R19 R24: the writer runs inside one record-core transaction and a listener that throws fails the whole write", async () => {
  const w = fresh();
  bundle(w.s, "B-1");
  w.x.writeReading({ bundleId: "B-1", captureSha: S1, reading: await reading([E("a", "1")]) });
  assert.equal(w.x.onReading("later", () => { throw new Error("no"); }).ok, true);
  const before = w.rows(`SELECT reading FROM readings`).map((r) => r.reading);
  const r2 = await reading([E("b", "2")]);
  assert.throws(() => w.x.writeReading({ bundleId: "B-1", captureSha: S1, reading: r2, textUnits: [{ extent: { kind: "pdf-page", page: 0, rect: null }, text: "x", seq: 0 }] }), /no/);
  assert.deepEqual(w.rows(`SELECT reading FROM readings`).map((r) => r.reading), before, "nothing of the failed write survives");
  assert.deepEqual(w.rows(`SELECT ref FROM reading_refs`).map((r) => r.ref), ["a:1"]);
  assert.equal(w.rows(`SELECT * FROM capture_text`).length, 0);
});

test("R24: a later module registers once (a second is LISTENER_DECLARED); listeners run after each write, in the order registered, with the write's facts", async () => {
  const w = fresh();
  bundle(w.s, "B-1");
  const seen = [];
  assert.equal(w.x.onReading("content", (e) => { seen.push(["content", e]); return { staled: 2 }; }).ok, true);
  assert.equal(w.x.onReading("observation-log", (e) => { seen.push(["observation-log", Object.keys(e).sort()]); return { observed: 1 }; }).ok, true);
  assert.equal(w.x.onReading("content", () => {}).reason, "LISTENER_DECLARED");
  const first = await reading([], { text_source: layer(1) });
  w.x.writeReading({ bundleId: "B-1", captureSha: S1, reading: first, author: "member:m1" });
  const r = await reading([], { text_source: ocrChain() });
  const out = w.x.writeReading({ bundleId: "B-1", captureSha: S1, reading: r, author: "member:m1" });
  assert.deepEqual(seen.map((s) => s[0]), ["content", "observation-log", "content", "observation-log"]);
  const e = seen[2][1];
  assert.deepEqual([e.bundleId, e.captureSha, e.author], ["B-1", S1, "member:m1"]);
  assert.deepEqual(e.chainBefore, layer(1));
  assert.deepEqual(e.chainAfter, ocrChain());
  assert.ok(e.indexed && "written" in e.indexed);
  assert.deepEqual(seen[1][1], ["author", "bundleId", "captureSha", "chainAfter", "chainBefore", "indexed", "reading", "unitsBefore"]);
  assert.deepEqual(seen[0][1].unitsBefore, null, "never indexed before the first write");
  assert.deepEqual(e.unitsBefore, [], "indexed, with no unit, before the second");
  const u = [{ extent: { kind: "pdf-page", page: 0, rect: null }, text: "old words", seq: 0 }];
  w.x.writeReading({ bundleId: "B-1", captureSha: S1, reading: r, textUnits: u });
  w.x.writeReading({ bundleId: "B-1", captureSha: S1, reading: r, textUnits: [{ ...u[0], text: "new words" }] });
  const last = seen[seen.length - 2][1];
  assert.deepEqual(last.unitsBefore.map((x) => [x.text, x.seq, x.truncated, x.extent.page]), [["old words", 0, false, 0]]);
  assert.deepEqual(out.listeners, { content: { staled: 2 }, "observation-log": { observed: 1 } });
});

test("R20: registered with promotion, the projection writes each provenance document's reading; a stored re-read is not replaced by a non-re-read carrying the same `at`", async () => {
  const w = fresh();
  assert.equal(w.prom.steps.length, 1);
  assert.equal(w.prom.steps[0].module, "extraction");
  const project = w.prom.steps[0].project;
  bundle(w.s, "B-1");
  const r = await reading([E("meeting", "1")]);
  project({ bundleId: "B-1", author: "member:m1", files: [provFile([
    { capture: { sha256: S1 }, reading: r, profile: { format: { format: "pdf" } },
      text_units: [{ extent: { kind: "pdf-page", page: 0, rect: null }, text: "hello", seq: 0 }] },
    { capture: { sha256: S2 } },                         // no reading: skipped
    { capture: {}, reading: r },                          // no digest: skipped
  ])] });
  assert.equal(w.rows(`SELECT * FROM readings`).length, 1);
  assert.equal(w.one(`SELECT capture_format FROM readings`).capture_format, "pdf");
  assert.equal(w.rows(`SELECT * FROM capture_text`).length, 1);
  /* a re-read stored; an ordinary revision re-submitting the acquire-time reading (same `at`) does not undo it */
  const reread = await reading([E("meeting", "2")], { reextracted: { at: "later", pages: [0] } });
  w.x.writeReading({ bundleId: "B-1", captureSha: S1, reading: reread });
  project({ bundleId: "B-1", files: [provFile([{ capture: { sha256: S1 }, reading: r }])] });
  assert.deepEqual(w.rows(`SELECT ref FROM reading_refs`).map((x) => x.ref), ["meeting:2"]);
  /* a new acquire of the document (a new `at`) replaces it */
  project({ bundleId: "B-1", files: [provFile([{ capture: { sha256: S1 }, reading: { ...r, at: "2026-10-01T00:00:00Z" } }])] });
  assert.deepEqual(w.rows(`SELECT ref FROM reading_refs`).map((x) => x.ref), ["meeting:1"]);
  assert.equal(project({ bundleId: "B-1", files: [] }), null);
});

test("R21: a reading this instance did not compose is recorded as the caller's assertion, with the caller's standing and justification; one it composed is its own", async () => {
  const w = fresh();
  bundle(w.s, "B-1");
  const carried = await reading([E("meeting", "7")]);
  w.prom.steps[0].project({ bundleId: "B-1", author: "member:m1", files: [provFile([
    { capture: { sha256: S1 }, reading: carried, reading_justification: { interview: "recorded with the clerk, 2026-09-01" } }])] });
  const a = w.x.readingFor(S1, "member:m1");
  assert.equal(a.origin.state, "asserted");
  assert.equal(a.origin.asserted_by, "member:m1");
  assert.equal(a.origin.standing, "member");
  assert.deepEqual(JSON.parse(a.origin.justification), { interview: "recorded with the clerk, 2026-09-01" });
  w.prom.steps[0].project({ bundleId: "B-1", author: "token:daemon", files: [provFile([{ capture: { sha256: S2 }, reading: carried }])] });
  assert.equal(w.x.readingFor(S2).origin.standing, "machine");
  /* composed here: `read` records it, and the same reading carried back is this instance's own */
  const composed = await reading([E("meeting", "8")]);
  w.x.recordComposed(composed, S3);
  w.prom.steps[0].project({ bundleId: "B-1", author: "member:m1", files: [provFile([{ capture: { sha256: S3 }, reading: composed }])] });
  const c = w.x.readingFor(S3);
  assert.equal(c.origin.state, "composed");
  assert.equal(w.one(`SELECT asserted_by FROM readings WHERE capture_sha=?`, S3).asserted_by, null);
});

test("R22 R45 R48 R99 (fix round 9, G128d, G128f): the text index deletes the capture's rows first even with no unit; blank units dropped; ordered by seq; every unit stored whole (none cut, none dropped by a bound of units or bytes), in batches of at most LAND_BATCH_BYTES; unaddressable counted; the wire's skipped units named; the answer states each", async () => {
  const w = fresh();
  bundle(w.s, "B-1");
  const u = (p, text, seq = p, extra = {}) => ({ extent: { kind: "pdf-page", page: p, rect: null }, text, seq, ...extra });
  const x = w.x.indexUnits("B-1", S1, [u(2, "two", 2), u(0, "zero", 0), u(1, "   ", 1), u(0, "dup", 5), { text: "no extent", seq: 6 },
                                       u(3, "c".repeat(CAPTURE_TEXT_UNIT_CAP + 5), 3), u(4, "wire cut", 4, { truncated: true })], layer(1));
  assert.deepEqual(w.rows(`SELECT seq FROM capture_text WHERE capture_sha=? ORDER BY seq`, S1).map((r) => r.seq), [0, 2, 3, 4]);
  assert.deepEqual([x.offered, x.written, x.truncated, x.over_bound, x.unaddressable], [6, 4, 1, 0, 2]);
  assert.equal(x.unaddressed.length, 2);
  assert.deepEqual({ ...w.one(`SELECT length(text) n, truncated FROM capture_text WHERE seq=3`) }, { n: CAPTURE_TEXT_UNIT_CAP + 5, truncated: 0 }, "a unit over the cap is stored whole, never cut here");
  assert.equal(w.one(`SELECT truncated FROM capture_text WHERE seq=4`).truncated, 1, "the wire's cut is kept");
  assert.equal(w.one(`SELECT extent FROM capture_text WHERE seq=0`).extent, canonicalExtent({ kind: "pdf-page", page: 0, rect: null }));
  assert.equal(w.rows(`SELECT rowid FROM capture_text_fts WHERE capture_text_fts MATCH 'zero'`).length, 1);
  /* the delete even when nothing is offered */
  const none = w.x.indexUnits("B-1", S1, null, layer(1));
  assert.equal(w.rows(`SELECT * FROM capture_text WHERE capture_sha=?`, S1).length, 0);
  assert.equal(w.rows(`SELECT rowid FROM capture_text_fts WHERE capture_text_fts MATCH 'zero'`).length, 0, "the index follows the delete");
  assert.equal(none.state, "none");
  /* no unit bound: every unit past the old 4,096 is written; only the wire's own count and runs are over bound */
  const many = Array.from({ length: CAPTURE_TEXT_CAPTURE_UNIT_BOUND + 3 }, (_, i) => u(i, `t${i}`));
  const wireRun = { first: { kind: "pdf-page", page: 9000, rect: null }, first_seq: 9000, last: { kind: "pdf-page", page: 9001, rect: null }, last_seq: 9001, units: 2 };
  const b = w.x.indexUnits("B-1", S1, many, layer(1), { wireOverBound: 2, wireSkipped: [wireRun, { first: null }] });
  assert.deepEqual([b.written, b.over_bound, b.wire_over_bound, b.offered], [CAPTURE_TEXT_CAPTURE_UNIT_BOUND + 3, 2, 2, CAPTURE_TEXT_CAPTURE_UNIT_BOUND + 5]);
  assert.deepEqual(b.skipped.map((s) => [s.side, s.units, s.first.seq, s.last.seq]), [["wire", 2, 9000, 9001]]);
  assert.equal(b.skipped_named, 2);
  assert.equal(b.state, "partial", "the wire's own skipped units leave the index partial");
  assert.equal(w.rows(`SELECT rowid FROM capture_text_fts WHERE capture_text_fts MATCH ?`, `t${CAPTURE_TEXT_CAPTURE_UNIT_BOUND + 2}`).length, 1, "the last unit is found");
  /* no byte bound: 2.5 MiB of units, all written, in batches of at most LAND_BATCH_BYTES (8 units of 128 KiB each), one job_batches row a batch */
  const fat = Array.from({ length: 20 }, (_, i) => u(i, "y".repeat(CAPTURE_TEXT_UNIT_CAP)));
  const f = w.x.indexUnits("B-1", S1, fat, layer(1));
  assert.deepEqual([f.written, f.over_bound, f.state], [20, 0, "whole"]);
  assert.equal(LAND_BATCH_BYTES, 1048576);
  assert.deepEqual([f.batches.landed, f.batches.already], [Math.ceil(20 * CAPTURE_TEXT_UNIT_CAP / LAND_BATCH_BYTES), 0]);
  assert.equal(w.rows(`SELECT batch FROM job_batches WHERE sha=? AND kind='reading'`, S1).length, 3);
  void CAPTURE_TEXT_CAPTURE_BOUND;
});

test("R22: the chain kind is text-chain's chainKindFor per page, the document's last step for a unit with no page grain, never a `layer` default", async () => {
  const w = fresh();
  bundle(w.s, "B-1");
  const mixed = [{ step: "layer", tier: 1, container: "pdf", cap: null, measured_by: "u", extent: { kind: "pages", pages: [0] } },
                 { step: "pixels", cap: "C", measured_by: "M", calibration: null, extent: { kind: "pages", pages: [1] } },
                 { step: "ocr", engine: "tess", version: "5", cap: "C", measured_by: "M", calibration: null, extent: { kind: "pages", pages: [1] } }];
  const r = w.x.indexUnits("B-1", S1, [{ extent: { kind: "pdf-page", page: 0, rect: null }, text: "a", seq: 0 },
                                       { extent: { kind: "pdf-page", page: 1, rect: null }, text: "b", seq: 1 }], mixed);
  assert.deepEqual(w.rows(`SELECT chain_kind FROM capture_text ORDER BY seq`).map((x) => x.chain_kind), ["layer", "ocr"]);
  assert.equal(r.chain_kind, "mixed");
  w.x.indexUnits("B-1", S2, [{ extent: { kind: "doc-para", para: 0, run: null }, text: "p", seq: 0 }], layer(1));
  assert.equal(w.one(`SELECT chain_kind FROM capture_text WHERE capture_sha=?`, S2).chain_kind, "layer");
  w.x.indexUnits("B-1", S3, [{ extent: { kind: "document" }, text: "words", seq: 0 }], null);
  assert.equal(w.one(`SELECT chain_kind FROM capture_text WHERE capture_sha=?`, S3).chain_kind, "undetermined");
});

test("R23 (reading-pipeline R19): every distinct reading is kept in arrival order before the row is replaced; an equal one is not kept again; a pre-history reading is kept first; each stores compareProvenance against the one before", async () => {
  const w = fresh();
  bundle(w.s, "B-1");
  const legacy = { content_type: "t", entities: [], at: "a", found: false };
  w.s.sql.exec(`INSERT INTO readings (capture_sha,bundle_id,found,entity_count,reading) VALUES (?,?,0,0,?)`, S1, "B-1", JSON.stringify(legacy));
  const r1 = await reading([E("a", "1")]);
  w.x.writeReading({ bundleId: "B-1", captureSha: S1, reading: r1 });
  w.x.writeReading({ bundleId: "B-1", captureSha: S1, reading: r1 });
  const r2 = await reading([E("a", "2")], { provenance: await readingProvenance({ text: "other text", chain: layer(), tier: 1, container: "pdf" }) });
  const out = w.x.writeReading({ bundleId: "B-1", captureSha: S1, reading: r2 });
  const h = w.rows(`SELECT seq, reading_sha256, compared FROM reading_history WHERE capture_sha=? ORDER BY seq`, S1);
  assert.equal(h.length, 3);
  assert.equal(h[0].reading_sha256, sha(JSON.stringify(legacy)));
  assert.equal(JSON.parse(h[1].compared).state, "undetermined");
  assert.deepEqual(JSON.parse(h[2].compared), compareProvenance(r1.provenance, r2.provenance));
  assert.equal(out.kept.compared.state, "differs");
});

test("R27 R45: readingFor refuses NO_SHA, answers found:false for a capture not read, and otherwise the reading, the bundle withheld from a viewer who may not see it, the text provenance or its absence, and at most 16 kept readings", async () => {
  const w = fresh();
  assert.deepEqual(w.x.readingFor(""), noSha("a reading is read by its capture sha256"), "R63's one answer");
  assert.deepEqual(w.x.readingFor(S1), { ok: true, found: false, capture_sha: S1, reading: null });
  bundle(w.s, "PROJ-1", { type: "project" });
  for (let i = 0; i < 18; i++) w.x.writeReading({ bundleId: "PROJ-1", captureSha: S1, reading: await reading([E("a", String(i))]) });
  const seen = w.x.readingFor(S1, "class:admin");
  assert.equal(seen.bundle_id, "PROJ-1");
  assert.equal(seen.text_provenance.terminal_step, "layer");
  assert.match(seen.text_provenance.says, /layer/);
  assert.deepEqual([seen.reading_history.kept, seen.reading_history.readings.length, seen.reading_history.truncated, seen.reading_history.limit], [18, 16, true, 16]);
  assert.equal(seen.reading_history.readings[0].seq, 18, "newest first");
  const hidden = w.x.readingFor(S1, "member:outsider");
  assert.equal(hidden.bundle_id, null, "withheld from a viewer who may not see it");
  w.x.writeReading({ bundleId: "PROJ-1", captureSha: S2, reading: await reading([], { text_source: null, provenance: undefined }) });
  const nop = w.x.readingFor(S2, "class:admin");
  assert.equal(nop.text_provenance.recorded, false);
  assert.equal(nop.reading_history.readings[0].provenance.state, "undetermined");
});

test("R28 R48: documentsByReference answers every document whose reading carries the reference, one entry each, every occurrence in reading order when read at several places, withheld as R27, bounded, empty ref count 0", async () => {
  const w = fresh();
  bundle(w.s, "B-1"); bundle(w.s, "PROJ-1", { type: "project" });
  w.x.writeReading({ bundleId: "B-1", captureSha: S1, reading: await reading([E("m", "1", null, page(0), [page(2), page(4)])]) });
  w.x.writeReading({ bundleId: "PROJ-1", captureSha: S2, reading: await reading([E("m", "1")]) });
  assert.deepEqual(w.x.documentsByReference("", "class:admin"), { ok: true, ref: "", count: 0, documents: [] });
  const all = w.x.documentsByReference("m:1", "member:outsider");
  assert.equal(all.count, 2);
  const one = all.documents.find((d) => d.capture_sha === S1);
  assert.equal(one.position.page, 0);
  assert.deepEqual(one.occurrences.map((o) => o.page), [0, 2, 4]);
  assert.equal(all.documents.find((d) => d.capture_sha === S2).bundle_id, null);
  assert.equal(all.documents.find((d) => d.capture_sha === S2).occurrences, undefined);
  const cut = w.x.documentsByReference("m:1", "class:admin", 1);
  assert.deepEqual([cut.count, cut.limit, cut.truncated], [1, 1, true]);
});

test("R29 R48: transcribedDocuments filters as asked, ordered by bundle and capture, at most limit (default 200, maximum 5,000) with truncated measured by reading one more, bundles withheld", async () => {
  const w = fresh();
  bundle(w.s, "B-1"); bundle(w.s, "PROJ-1", { type: "project" });
  w.x.writeReading({ bundleId: "B-1", captureSha: S2, reading: await reading([], { text_source: ocrChain() }) });
  w.x.writeReading({ bundleId: "B-1", captureSha: S1, reading: await reading([]) });
  w.x.writeReading({ bundleId: "PROJ-1", captureSha: S3, reading: await reading([], { text_source: ocrChain() }) });
  const all = w.x.transcribedDocuments({ viewer: "member:x" });
  assert.deepEqual(all.documents.map((d) => [d.bundle_id, d.capture_sha]), [["B-1", S1], ["B-1", S2], [null, S3]]);
  assert.deepEqual([all.limit, all.truncated], [200, false]);
  assert.deepEqual(w.x.transcribedDocuments({ terminalStep: "ocr", viewer: "class:admin" }).documents.map((d) => d.capture_sha), [S2, S3]);
  const cut = w.x.transcribedDocuments({ limit: 1, viewer: "class:admin" });
  assert.deepEqual([cut.count, cut.truncated], [1, true]);
  assert.equal(w.x.transcribedDocuments({ limit: 10 ** 9 }).limit, TEXT_SOURCE_LIMIT_MAX);
});

test("R30 R45: readingOf answers the persisted reading's facts: page count positive or null, container extent absent, null or as stored, the capture format; null for a capture not read", async () => {
  const w = fresh();
  bundle(w.s, "B-1");
  assert.equal(w.x.readingOf(S1), null);
  w.x.writeReading({ bundleId: "B-1", captureSha: S1, reading: await reading([], { page_count: 0, container_extent: null }), profileFormat: "pdf" });
  const a = w.x.readingOf(S1);
  assert.deepEqual([a.pageCount, a.containerExtent, a.captureFormat, a.textContainer], [null, null, "pdf", "pdf"]);
  assert.deepEqual(a.chain, layer());
  w.x.writeReading({ bundleId: "B-1", captureSha: S2, reading: await reading([], { page_count: 4 }) });
  const b = w.x.readingOf(S2);
  assert.equal(b.pageCount, 4);
  assert.equal("containerExtent" in b, false, "absent when never stored");
});

test("R36: unitsOf answers the indexed units in seq order and the index's own state from its last write: whole, partial with its counts, none, or null when never indexed", async () => {
  const w = fresh();
  bundle(w.s, "B-1");
  assert.equal(w.x.unitsOf(S1).state, null);
  w.x.indexUnits("B-1", S1, [{ extent: { kind: "pdf-page", page: 1, rect: null }, text: "b", seq: 1 },
                             { extent: { kind: "pdf-page", page: 0, rect: null }, text: "a", seq: 0 }], layer());
  const whole = w.x.unitsOf(S1);
  assert.equal(whole.state, "whole");
  assert.deepEqual(whole.units.map((u) => u.text), ["a", "b"]);
  w.x.indexUnits("B-1", S1, [], layer());
  assert.equal(w.x.unitsOf(S1).state, "none");
  w.x.indexUnits("B-1", S1, [{ extent: { kind: "pdf-page", page: 0, rect: null }, text: "a", seq: 0 }], layer(), { wireOverBound: 3 });
  const p = w.x.unitsOf(S1);
  assert.equal(p.state, "partial");
  assert.equal(p.counts.over_bound, 3);
  assert.deepEqual(p.skipped, []);
});

test("R37: reindexNames writes the name terms for up to limit references that have none and answers how many and how many remain; the clears are seams no op reaches", async () => {
  const w = fresh();
  bundle(w.s, "B-1");
  for (const s of [S1, S2, S3]) w.x.writeReading({ bundleId: "B-1", captureSha: s, reading: await reading([E("m", s.slice(0, 2), "A Label")]) });
  w.x.readingTermsClear({});
  const one = w.x.reindexNames({ limit: 1 });
  assert.deepEqual([one.ok, one.indexed, one.remaining], [true, 1, 2]);
  assert.equal(w.x.reindexNames({ limit: 500 }).remaining, 0);
  assert.equal(w.x.readingHistoryClear({ captureSha: S1 }).ok, true);
  assert.equal(w.rows(`SELECT * FROM reading_history WHERE capture_sha=?`, S1).length, 0);
  const url = new URL("http://x/");
  const ops = Object.keys(extractionOps(w.x, url, {}, {}));
  for (const k of ["readingtermsclear", "readinghistoryclear", "reindexnames"]) assert.ok(ops.includes(k), `${k} is a Durable Object route only`);
  /* the boot backfill: a store whose references hold no terms gets them at migrate */
  w.x.readingTermsClear({});
  w.x.migrate();
  assert.ok(w.rows(`SELECT * FROM reading_ref_terms`).length > 0);
});

test("R49: the reading tables are declared to purge keyed to their bundle; capture_text_fts whole-store only", async () => {
  const w = fresh();
  bundle(w.s, "B-1"); bundle(w.s, "B-2");
  const u = [{ extent: { kind: "pdf-page", page: 0, rect: null }, text: "purgeable words", seq: 0 }];
  w.x.writeReading({ bundleId: "B-1", captureSha: S1, reading: await reading([E("m", "1", "Label")]), textUnits: u });
  w.x.writeReading({ bundleId: "B-2", captureSha: S2, reading: await reading([E("m", "2", "Label")]), textUnits: u });
  const one = w.core.purge({ bundleId: "B-1" });
  for (const t of ["readings", "reading_refs", "reading_ref_terms", "reading_text_source", "reading_history", "capture_text", "capture_text_state"])
    assert.ok(one.removed[t] >= 1, t);
  assert.equal(one.removed.capture_text_fts, 0, "the index is whole-store only");
  assert.equal(w.rows(`SELECT * FROM readings`).length, 1);
  assert.equal(w.rows(`SELECT rowid FROM capture_text_fts WHERE capture_text_fts MATCH 'purgeable'`).length, 1, "the triggers kept the index true");
  w.core.purge({});
  for (const t of ["readings", "reading_refs", "capture_text", "reading_history", "composed_readings"]) assert.equal(w.rows(`SELECT * FROM ${t}`).length, 0, t);
});

test("R44 R46: nothing here raises a grade or resolves a reference: a written reading's references stay raw and the text-source cap is the chain's own", async () => {
  const w = fresh();
  bundle(w.s, "B-1");
  w.x.writeReading({ bundleId: "B-1", captureSha: S1, reading: await reading([E("meeting", "2101", "Council")], { text_source: layer() }) });
  assert.equal(w.one(`SELECT derivation_cap FROM reading_text_source`).derivation_cap, null, "an unmeasured layer stays undetermined");
  const ref = w.one(`SELECT ref, ref_kind, ref_key FROM reading_refs`);
  assert.deepEqual([ref.ref, ref.ref_kind, ref.ref_key], ["meeting:2101", "meeting", "2101"]);
  const tables = w.rows(`SELECT name FROM sqlite_master WHERE type='table'`).map((t) => t.name);
  assert.ok(!tables.some((t) => /grade/.test(t)));
});

test("R51 R48: capturesReadFor answers the captures the bundle's stored readings carry, each with the instant read, earliest first, empty for none, bounded, never throwing", async () => {
  const w = fresh();
  bundle(w.s, "B-1"); bundle(w.s, "B-2");
  w.x.writeReading({ bundleId: "B-1", captureSha: S2, reading: await reading([], { at: "2026-09-02T00:00:00Z" }) });
  w.x.writeReading({ bundleId: "B-1", captureSha: S1, reading: await reading([], { at: "2026-09-03T00:00:00Z" }) });
  w.x.writeReading({ bundleId: "B-1", captureSha: S3, reading: await reading([], { at: undefined }) });
  const all = w.x.capturesReadFor("B-1");
  assert.deepEqual([...all], [{ capture_sha: S2, at: "2026-09-02T00:00:00Z" }, { capture_sha: S1, at: "2026-09-03T00:00:00Z" }, { capture_sha: S3, at: null }]);
  assert.deepEqual([all.limit, all.truncated], [200, false]);
  assert.deepEqual([...w.x.capturesReadFor("B-2")], []);
  assert.deepEqual([...w.x.capturesReadFor(null)], []);
  const cut = w.x.capturesReadFor("B-1", { limit: 2 });
  assert.deepEqual([cut.length, cut.truncated], [2, true]);
  w.s.sql.exec(`DROP TABLE reading_history`);
  w.s.db.exec(`ALTER TABLE readings RENAME TO readings_gone`);
  assert.deepEqual([...w.x.capturesReadFor("B-1")], [], "a store that cannot be read answers empty, never a throw");
});

test("R24 (N202): registration refuses through membership's listenerRefusal, the one site of LISTENER_MALFORMED and LISTENER_DECLARED; listeners run in MODULE_ORDER whatever order they registered in", async () => {
  const { listenerRefusal, MODULE_ORDER } = await import("../../../src/membership/index.mjs");
  const w = fresh();
  bundle(w.s, "B-1");
  const ran = [];
  const f = (m) => () => { ran.push(m); return null; };
  assert.equal(w.x.onReading("retrieval", f("retrieval")).ok, true);
  assert.equal(w.x.onReading("observation-log", f("observation-log")).ok, true);
  assert.equal(w.x.onReading("content", f("content")).ok, true);
  assert.equal(w.x.onReading("zz-unlisted", f("zz-unlisted")).ok, true);
  for (const [m, fn] of [["", f("x")], ["content", null], [7, f("x")]])
    assert.deepEqual(w.x.onReading(m, fn), listenerRefusal([], m, fn), "malformed: membership's own answer");
  const again = w.x.onReading("content", f("again"));
  assert.deepEqual(again, listenerRefusal([{ module: "content" }], "content", f("again")));
  assert.deepEqual([again.reason, again.code, again.module], ["LISTENER_DECLARED", "LISTENER_DECLARED", "content"]);
  w.x.writeReading({ bundleId: "B-1", captureSha: S1, reading: await reading([]) });
  const known = ["content", "observation-log", "retrieval"].sort((a, b) => MODULE_ORDER.indexOf(a) - MODULE_ORDER.indexOf(b));
  assert.deepEqual(ran, [...known, "zz-unlisted"]);
});

test("R30 R45 (N100): readingOf answers pageBoxes as the reading stored them: absent when never stored, null when stored null, else the boxes", async () => {
  const w = fresh();
  bundle(w.s, "B-1");
  const pb = { boxes: [{ media_box: [0, 0, 612, 792], w: 612, h: 792, rotate: 0 }], of_page: [0, null] };
  w.x.writeReading({ bundleId: "B-1", captureSha: S1, reading: await reading([], { page_count: 2, page_boxes: pb }) });
  w.x.writeReading({ bundleId: "B-1", captureSha: S2, reading: await reading([], { page_count: null, page_boxes: null }) });
  w.x.writeReading({ bundleId: "B-1", captureSha: S3, reading: await reading([]) });
  assert.deepEqual(w.x.readingOf(S1).pageBoxes, pb);
  assert.equal(w.x.readingOf(S2).pageBoxes, null);
  assert.equal("pageBoxes" in w.x.readingOf(S2), true);
  assert.equal("pageBoxes" in w.x.readingOf(S3), false);
});

test("R76 R27 R36 (T49; K3387): op=reading answers text_units, the capture's units as unitsOf answers them (extent, reference, text, truncated, in seq order); [] for a capture read and never indexed; withheld from a viewer refused the bundle; absent for a capture not read", async () => {
  const w = fresh();
  bundle(w.s, "PROJ-1", { type: "project" });
  const html = (i, text, extra = {}) => ({ extent: { kind: "doc-para", para: i, run: null }, reference: `¶${i + 1}`, text, seq: i, ...extra });
  const units = [html(1, "second", { truncated: true }), html(0, "first")];
  w.x.writeReading({ bundleId: "PROJ-1", captureSha: S1, reading: await reading([]), textUnits: units });
  const mine = w.x.readingFor(S1, "class:admin");
  const stored = w.x.unitsOf(S1).units;
  assert.deepEqual(mine.text_units, stored.map((u) => ({ extent: u.extent, reference: u.ref, text: u.text, truncated: u.truncated, kind: u.kind })));
  assert.deepEqual(mine.text_units.map((u) => [u.text, u.truncated, u.extent.para]), [["first", false, 0], ["second", true, 1]], "seq order");
  /* (fix round 9, G134d; R107) each unit answers its kind, null for one whose producer named none */
  assert.deepEqual(Object.keys(mine.text_units[0]).sort(), ["extent", "kind", "reference", "text", "truncated"]);
  assert.equal(mine.text_units[0].kind, null);
  /* control: the viewer refused the bundle receives none, and the bundle is withheld as before */
  const hidden = w.x.readingFor(S1, "member:outsider");
  assert.equal(hidden.bundle_id, null);
  assert.equal("text_units" in hidden, false);
  /* a read capture with no unit indexed answers an empty list; a capture not read answers none */
  w.x.writeReading({ bundleId: "PROJ-1", captureSha: S2, reading: await reading([]) });
  assert.deepEqual(w.x.readingFor(S2, "class:admin").text_units, []);
  assert.equal("text_units" in w.x.readingFor(S3, "class:admin"), false);
  /* the bound: no more than 4,096 */
  const many = Array.from({ length: CAPTURE_TEXT_CAPTURE_UNIT_BOUND + 3 }, (_, i) => html(i, `t${i}`));
  w.x.writeReading({ bundleId: "PROJ-1", captureSha: S3, reading: await reading([]), textUnits: many });
  assert.equal(w.x.readingFor(S3, "class:admin").text_units.length, CAPTURE_TEXT_CAPTURE_UNIT_BOUND);
});
