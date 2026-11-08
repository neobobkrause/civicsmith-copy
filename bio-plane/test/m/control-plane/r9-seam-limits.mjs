/* control-plane (fix round 9; K4837, K4842; R-SEAM, R-ONE, R-CLOCK, R-NOLOAD): SEAM SECTIONS 14 AND 15 of `t51-round9-seam.test.mjs`, THROUGH THE REAL PLANE (the Worker, object, alarm and R2 under
   Miniflare, a member's own acts; `makeKit` of `r8-kit.mjs`). The lead's one seam file calls `sections(kit, counting)`.

   14  a ceiling's sentence, the upload peak, the archive limits, and THE ALL-MODULES GREP (G124a, G124b, G124g, G124; R132, R125, R131, R130, R72)
         a  a PDF one byte over `boundOf("pdf","bytes")` uploaded is stated at once with its size, the limit and the key of the alpha sentence, owing nothing (no job row); one at
            the ceiling is not stated, its `reading` row is held and the alarm reads it (PDF A3 / A2);
         b  a 24 MiB text upload through the real door lands (the capture whole, a job row, no inline read) and, handed the door's own byte ledger, peaks at the file and at most two
            parts beyond it and is back to nothing held (the ledger's wiring is `owner-ops.mjs`, R72);
         g  the archive limits: a file declared one byte over the uploaded bound is refused by name with its size, the limit and the key, the bound itself accepted; an archive whose
            directory declares one byte over the unpacked bound is refused by name with its size and limit, the bound itself accepted (the lazy ZIP writer: nothing is materialised);
         G124 THE ALL-MODULES GREP (K3268: no hand-listing of another module's constants): every module's own source, from `build/modules.json`, is read for the ceiling constants it
            declares as numbers; each that does not resolve to `READ_BOUNDS` through `boundOf`/`statement` is reported with its module, file:line and name; the set outside ACCEPTED
            (constants that are no reading ceiling, each with its reason) must be empty.
   15  the press, transcribe and the no-cursor door (G126e, G126h; R131, R125, R130, R123)
         the OCR press `pdfstructure&ocr=1` and `pagetranscribe` on a PDF over 2 MiB and on a scan: the object is not loaded in the request (the counting door's count of R2 gets of
            the whole object: 0) and no OCR call is made inside it; `owedwork` lists what is left;
         the no-cursor door read of a 2 MB sheet/CSV: no inline read, the row exists, the last row is found by `op=search` after the ticks.
   Counts, values and fields at the door; never a wall time, never a sentence a member reads (R-CLOCK, R-WORDS). Where a provider has not merged, the test keeps its real assertion and its
   title says "(red until <module> <job> merges)". */
import "../../sandbox.mjs";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { READ_BOUNDS, boundOf, statement } from "../../../src/read-bounds.mjs";
import { capFor } from "../../../src/byte-ledger.mjs";
import { zipChunks64 } from "../../make-zip.mjs";
import { collect, generate } from "../../corpus.mjs";
import { CAPTURE_SCREEN } from "../../../src/screens-intake/capture.mjs";
import { READING_DEFER_OTHER_BYTES } from "../../../src/control-plane/reading-gate.mjs";
import { makeKit } from "./r8-kit.mjs";
import { wrapScript, readCalls } from "./wrap-entry.mjs";

const MiB = 1048576;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const sha256 = (b) => createHash("sha256").update(b).digest("hex");
const te = (t) => new TextEncoder().encode(t);

/* ============================================================================================================================================================
   G124 · THE ALL-MODULES GREP
   ============================================================================================================================================================ */

/* A ceiling constant, as the grep sees one: a top-level `const NAME = <numbers>` whose name says it is a limit (a `_MAX`, `_MIN`, `_BOUND`, `_LIMIT`, `_CEILING`, `_CAP`, `_BYTES`,
   `_SIZE` or `_BUDGET` suffix, or a `MAX_`/`MIN_`/`LIMIT_` prefix) and whose value is written as a number or an arithmetic of numbers and the unit names (KiB, MiB, GiB, KB, MB, GB), at
   64 KiB or more: the byte/MiB scale of the table's rows. A constant read through `boundOf`/`statement`, or derived from another constant, is not a number and is not seen. */
export const CEILING_MIN = 65536;
const NAME = /(?:_MAX|_MIN|_BOUND|_BOUNDS|_LIMIT|_CEILING|_CAP|_BYTES|_SIZE|_BUDGET)$|^(?:MAX|MIN|LIMIT)_/;
const UNITS = Object.freeze({ KiB: 1024, MiB: 1048576, GiB: 1073741824, KB: 1024, MB: 1048576, GB: 1073741824 });
function arithmetic(src) {
  const toks = src.match(/[A-Za-z_][A-Za-z0-9_]*|\d[\d_]*|\*\*|<<|>>|[-+*/()]/g);
  if (!toks || toks.join("") !== src.replace(/\s+/g, "")) return null;
  let expr = "";
  for (const t of toks) {
    if (/^[A-Za-z_]/.test(t)) { if (!Object.hasOwn(UNITS, t)) return null; expr += UNITS[t]; } else expr += t.replace(/_/g, "");
  }
  try { const v = Function(`"use strict";return (${expr})`)(); return typeof v === "number" && Number.isFinite(v) ? v : null; } catch { return null; }
}
export function ceilingConstantsIn(text, { min = CEILING_MIN } = {}) {
  const out = [];
  String(text).split("\n").forEach((line, i) => {
    const m = /^(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*;?\s*(?:\/\/.*|\/\*.*)?$/.exec(line);
    if (!m || !NAME.test(m[1])) return;
    const rhs = m[2].replace(/;\s*$/, "");
    const value = arithmetic(rhs);
    if (value !== null && value >= min) out.push({ name: m[1], line: i + 1, rhs, value });
  });
  return out;
}

/* Every module's own source: `build/modules.json`'s `paths` (a directory, or a file), the tracked files under them that are code (`.mjs`, `.js`, `.cjs`), not a test, not a built
   bundle. `git ls-files` names them; a tree with no git is walked. */
function trackedFiles() {
  try { return execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, maxBuffer: 1 << 28 }).toString().split("\0").filter(Boolean); } catch {
    const out = [];
    const walk = (dir) => { for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name === ".git") continue;
      const p = dir ? `${dir}/${e.name}` : e.name;
      if (e.isDirectory()) walk(p); else out.push(p);
    } };
    walk("");
    return out;
  }
}
export function moduleSources() {
  const modules = JSON.parse(readFileSync(join(ROOT, "build/modules.json"), "utf8")).modules;
  const files = trackedFiles().filter((f) => /\.(?:mjs|js|cjs)$/.test(f) && !/(?:^|\/)(?:test|dist|node_modules)\//.test(f));
  const owner = new Map();
  for (const m of modules) for (const f of files) {
    if (!owner.has(f) && (m.paths || []).some((p) => (p.endsWith("/") ? f.startsWith(p) : f === p))) owner.set(f, m.id);
  }
  return { modules, sources: [...owner].map(([file, module]) => ({ module, file })) };
}
export function ceilingConstantsOfModules() {
  const { modules, sources } = moduleSources();
  const found = [];
  for (const { module, file } of sources) {
    const path = join(ROOT, file);
    try { if (statSync(path).size > 8 * MiB) continue; } catch { continue; }
    for (const c of ceilingConstantsIn(readFileSync(path, "utf8"))) found.push({ module, file, ...c });
  }
  return { found, scanned: sources.length, modules: new Set(sources.map((s) => s.module)), declared: modules.length };
}
/* the digits of a bound a refusal states, whichever field a module names it by */
const sizeOf = (r) => r.size ?? r.declared ?? r.declared_total ?? r.bytes;
const limitOf = (r) => r.bound ?? r.limit ?? r.maxBytes;

/* THE ACCEPTED NAMES: a constant the grep finds that is no reading ceiling. Keyed `<file>::<NAME>` so a same-named constant elsewhere is not accepted by this one; each holds its one-line
   reason. A constant is accepted only when it bounds something other than the size a file may be for a reading to be made, stated or owed. None is accepted to make the grep green: a
   reading ceiling with no `READ_BOUNDS` row is reported (to BOB, who carries it to runtime-limits: K4842 (1)), and the grep stays red until its module quotes the table. */
export const ACCEPTED = Object.freeze({
  /* B75 (e): accepted by BOB's ruling, each for what it bounds */
  "bio-plane/src/extraction/index.mjs::CAPTURE_TEXT_CAPTURE_BOUND": "what one piece of a read asks of the reader and one page of `unitsOf` answers (a paging figure, R22); it bounds no write and no file's reading",
  "bio-plane/src/calculations/index.mjs::INGEST_ROWS_MAX": "the ROWS one ingest act reads, set by the object's memory at the real shape (a count of rows, not a file's bytes)",
  "bio-plane/src/content/index.mjs::RANGE_BYTES": "the bytes a crop reads from a capture at a time through `readRange` (R59), a read's chunk and never a size a file may be",
  "sheet-worker/src/enginelib.mjs::MAX_SAFARI_DECODE_BYTES": "wasm-bindgen's generated TextDecoder guard for Safari, a platform quirk of the engine glue, no file bound",
  "sheet-worker/src/contract.mjs::WASM_BYTES": "the byte length of the vendored engine asset, an integrity pin, not a limit",
  "ocr-worker/src/tessengine.mjs::WASM_BYTES": "the byte length of the vendored engine asset, an integrity pin, not a limit",
  "ocr-worker/src/tessengine.mjs::MODEL_BYTES": "the byte length of the vendored language model, an integrity pin, not a limit",
  "newgroup/src/ready.mjs::WORKER_SIZE_LIMIT": "Cloudflare's uncompressed Worker size limit, checked against the release before an install (installer R6); a deploy limit, no file's reading (K5000)",
  "ocr-worker/scripts/embed-tesslib.mjs::VENDOR_BYTES": "a build script's expected size of a vendored library, an integrity pin",
  "agent-model/src/model.mjs::DEFAULT_MAX_SEGMENT_BYTES": "how much agent transcript one re-serialising segment holds (a CPU pacing figure), no file's reading",
  /* F2: `agent-runner/src/ws.mjs::MAX_MESSAGE` removed with the file (agent-runner PR 610 deleted `ws.mjs`) */
  "agent-worker/src/ops.mjs::TRANSCRIBE_IMAGE_MAX_BYTES": "the AI provider's per-image request limit (5 MB), a provider fact about what is sent, not a reading ceiling",
  "bio-plane/src/store-assembly/transcribe.mjs::TRANSCRIBE_IMAGE_MAX_BYTES": "the same provider per-image limit, held equal to agent-worker's by its test (the plane's copy moved to the assembly with the transcription)",
  "bio-plane/src/case-carriage/index.mjs::NATIVE_DIGEST_MIN_BYTES": "the size from which a document's bytes are digested by the platform's native SHA-256 and not the pure-JS hash, a policy threshold of the digest (case-carriage R15)",
  "agent-worker/src/transcribe.mjs::PAGE_MAX": "the characters of one page of the AI's answer a transcription accepts, an answer bound",
  "agent-worker/src/action-drafts.mjs::RECORD_MAX": "the characters of JSON of a matter's record handed to a drafting task, a task input bound",
  "bio-plane/src/acquisition/unpack.mjs::UNPACK_CALL_BYTES": "one unpack call's share of declared bytes (work pacing: the next call resumes), never a refusal of a file",
  "bio-plane/src/acquisition/unpack.mjs::UNPACK_DAILY_BYTES": "the day's budget for AUTOMATIC unpacking (a quota of work; a member's own request is not counted)",
  "bio-plane/src/acquisition/keyed.mjs::KEYED_ANSWER_MAX": "the most of a keyed citation service's answer read, a service answer and no member's file",
  "bio-plane/src/acquisition/index.mjs::RENDER_ANSWER_MAX": "the JSON of a render's answer written back to the capture session, a stored-value bound",
  "bio-plane/src/subresources.mjs::SUBRESOURCE_MAX": "bytes fetched for one page asset of a captured page, a fetch budget of the capture and no reading",
  "bio-plane/src/subresources.mjs::SUBRESOURCE_BUDGET": "bytes fetched across a captured page's assets, a fetch budget of the capture and no reading",
  "bio-plane/src/capture/index.mjs::PARTED_PART_BYTES": "the CHOSEN size of each part of a file sent in parts (R2's part is at least 5 MiB), a size and not a limit on any file",
  "bio-plane/src/pdfstructure.mjs::INNER_CACHE_BYTES": "bytes of decoded object streams the PDF opener keeps for reuse, a cache size",
  "bio-plane/src/pdfstructure.mjs::INNER_CHECK_BYTES": "the compressed size from which an inflate is pre-checked, a policy threshold of the opener",
  "bio-plane/src/pdfstructure.mjs::LARGE_RAW_BYTES": "the compressed size from which a Flate stream is decoded by `inflateChecked` first, a policy threshold",
  "bio-plane/src/pdfstructure.mjs::SLICE_BYTES": "bytes scanned in one step of an opening before the thread is given back, work pacing",
  "bio-plane/src/ratification/casefile.mjs::CASEFILE_SWEEP_BYTES": "bytes one sweep of a case's published files reads, a sweep budget over published output",
  "bio-plane/src/public-read/casefile.mjs::CASEFILE_BLIND_PUT_MAX": "the size below which a published object is written without asking after it first, a write strategy",
  "bio-plane/src/container.mjs::CONTAINER_MAX_BYTES": "the size of a published case's container, an output bound on what is published and no reading of a member's file",
  "bio-plane/src/case-import/index.mjs::PART_MAX": "public-read's bound of one part of a case container (R5), the published form and no member's file",
  "bio-plane/src/publication/index.mjs::CASE_DOCUMENT_BYTES_MAX": "the UTF-8 bytes of an authored case document, a bound on what a member writes",
  "bio-plane/src/promotion/index.mjs::INLINE_MAX": "the inline bound of a file held as text in a bundle (1 MiB), a storage bound of the record's bundles",
  "bio-plane/src/extraction/index.mjs::READING_PAGE_BYTES": "what one answer of `op=reading` carries (about 1 MiB of unit text), an answer's size",
  "bio-plane/src/extraction/index.mjs::READING_ROW_MAX_BYTES": "the most a stored reading row may weigh (half the platform's single-value limit), a stored-value bound",
  "bio-plane/src/extraction/index.mjs::PRIOR_READING_COPY_MAX_BYTES": "the stored-value limit up to which a prior reading is copied into the history, a stored-value bound",
  "bio-plane/src/extraction/index.mjs::READING_KEY_BYTES": "the size over which a key of a stored reading is named and not carried in an answer, an answer's size",
  "bio-plane/src/reader-contract/index.mjs::INLINE_CELLS_MAX_BYTES": "the JSON of a sheet's cells kept inline in a reading row (else held in the file), a stored-value bound",
  "bio-plane/src/reader-contract/index.mjs::ACQUIRE_TEXT_UNITS_BUDGET": "how much unit text the acquire answer carries (half the promotion's inline bound), an answer's size",
  "bio-plane/src/reader-contract/index.mjs::CAPTURE_TEXT_UNIT_CAP": "the characters of one indexed unit (a unit's size, chunked beyond it), not a bound on a file",
  "bio-plane/src/reader-contract/index.mjs::PDF_RANGE_BYTES": "the byte sizing of a PDF piece (work pacing), not a bound on a file",
  "bio-plane/src/reader-contract/index.mjs::WINDOW_BYTES": "the window a text or CSV is read in (work pacing), not a bound on a file",
  "bio-plane/src/reader-contract/index.mjs::CSV_HEAD_BYTES": "the head a CSV's dialect is judged from, a read window",
  "bio-plane/src/reader-contract/index.mjs::CSV_SLACK_BYTES": "the read-ahead to the next record boundary when a chunk is cut, a read window",
  "bio-plane/src/reader-contract/html.mjs::PROSE_SCAN_MAX": "the characters of one block looked at to judge whether it holds prose (a scan window; past it the block is kept)",
  "bio-plane/src/csv-reader/index.mjs::CSV_WINDOW_BYTES": "the window a large CSV is decoded and walked in, work pacing",
  "bio-plane/src/csv-reader/index.mjs::HEAD_MAX_BYTES": "the head read to recognise a delimited file, a read window",
  "bio-plane/src/csv-reader/index.mjs::SHEET_WINDOW_MIN_BYTES": "the size from which a body is walked in windows with no record list kept, a policy threshold",
  "bio-plane/src/formats.mjs::HEAD_MAX": "the head read to recognise a format, a read window",
  "bio-plane/src/file-safety/formats.mjs::SAFE_VIEW_INLINE_CELLS_MAX_BYTES": "the JSON of a safe view's cells kept inline, a stored-value bound of the view",
  "bio-plane/src/file-safety/formats.mjs::SAFE_VIEW_TEXT_MAX": "the characters of a plain text a safe view SHOWS, a display bound (the preview's file bound is the `render.safe_view_bytes` row)",
  "bio-plane/src/calculations/index.mjs::INGEST_INLINE_MAX": "a value of an ingest's record kept inline in its row before it is chunked, a stored-value bound",
  "bio-plane/src/following/snapshot.mjs::PORTAL_ROWS_INLINE_MAX": "a portal snapshot's rows JSON kept inline before it is chunked, a stored-value bound",
  "bio-plane/src/provenance/index.mjs::TESTIMONY_MAX_BYTES": "the bytes of one testimony a member types, an authored text's bound",
  "bio-plane/src/content/index.mjs::TRANSCRIPTION_MAX_BYTES": "the bytes of one transcription a member types, an authored text's bound",
  "bio-plane/src/query.mjs::TEXT_CAP": "the characters of a text column the query index holds per bundle, an index bound",
  "bio-plane/src/investigation/index.mjs::WATCH_CAPTURES_MAX": "a count of captures a project's watch carries, no file size",
  "bio-plane/src/civil-time/zone.mjs::CACHE_LIMIT": "entries of a time-zone offset cache, no file size",
  "bio-plane/src/corpus-export/tables.mjs::PAGE_BYTES": "the page size of an export's rows, an output paging figure",
  "bio-plane/src/hypotheses/index.mjs::NOTE_MAX_BYTES": "the bytes of a note a member writes, an authored text's bound",
  "bio-plane/src/review/index.mjs::REVIEW_DRAFT_MAX": "the characters of a review draft, an authored text's bound",
  "bio-plane/src/filing-templates/blanks.mjs::FILING_TEXT_MAX": "the characters of a filing blank's text, an authored text's bound",
  "bio-plane/src/setup.mjs::RELEASE_NOTICE_MAX_BYTES": "the bytes of a release notice the instance shows, an authored text's bound",
  "bio-plane/src/setup.mjs::GROUP_LOGO_MAX_BYTES": "the bytes of the group's logo (200 KB), an upload of the setup screen and no reading",
  "bio-plane/src/run-rules/rules.mjs::AI_RUN_STATE_MAX_BYTES": "the bytes of an AI run's state row, a stored-value bound",
});
const acceptedKey = (c) => `${c.file}::${c.name}`;

/* ============================================================================================================================================================
   the sections
   ============================================================================================================================================================ */

export function sections(kit, counting) {
  void counting;
  const R = kit.R;
  const pdfExact = (words, n) => { const a = kit.pdfOf(words, n); return kit.pdfOf(words, n + (n - a.length)); };
  const upload = (auth, bytes, { type = "application/pdf", name = "n", statement: s = "a file the clerk handed me" } = {}) =>
    kit.plane(`/api/?${new URLSearchParams({ op: "captureupload", statement: s, name, type })}`, { method: "POST", headers: auth, body: bytes });
  const adminOwed = async (sha) => { const q = await kit.get(await kit.founder(), { op: "owedwork", sha }); return (R(q).owed ?? []); };

  /* ---------------------------------------------------------------------------------------------------------------------------------------------------- 14a */
  /* the over-ceiling PDF is made once: its upload is the member's act, the statement and the job table are what the other tests read of it */
  let overDoc = null;
  const overCeiling = () => (overDoc ??= (async () => {
    const { auth } = await kit.ownerOf("r9lim-a");
    const ceiling = boundOf("pdf", "bytes");
    const bytes = pdfExact("R132 over the ceiling one byte", ceiling + 1);
    assert.equal(bytes.length, ceiling + 1);
    const res = await upload(auth, bytes);
    const body = await res.json();
    return { auth, ceiling, bytes, sha: sha256(bytes), status: res.status, body, r: R(body) };
  })());

  test("R9 seam §14a (G124a; R132, R125 (a); PDF A3): a PDF one byte over the alpha ceiling is STATED at once, held whole, with its size, the limit and the key of the alpha sentence, and the answer promises no reading", { timeout: 900000 }, async () => {
    const d = await overCeiling();
    assert.equal(d.status, 200, JSON.stringify(d.body).slice(0, 300));
    assert.equal(d.r.ok, true);
    assert.equal(d.r.capture.bytes, d.ceiling + 1, "the capture is held, whole");
    const reading = d.r.document.reading;
    assert.ok(reading, "the answer carries the statement as the document's reading");
    assert.deepEqual([reading.failure, reading.reason, reading.size, reading.bound, reading.key],
      ["final", "TOO_LARGE", d.ceiling + 1, d.ceiling, statement("pdf", "bytes", d.ceiling + 1).key], "the size, the limit and the key of the alpha sentence");
    assert.ok(String(reading.basis).includes(String(d.ceiling + 1)) && String(reading.basis).includes(String(d.ceiling)), "its sentence holds the file's size and the limit");
    assert.equal(d.r.reading_pending, undefined, "stated, never promised");
    assert.equal(R(await kit.get(await kit.founder(), { op: "reading", sha256: d.sha })).job.state, null, "and the digest has no job state");
  });

  test("R9 seam §14a (G124a; R132, R125 (a); PDF A3) (red until capture stops registering a `reading` row for a file over the whole-read ceiling: capture R109 registers one always): a file stated over the ceiling owes nothing: `owedwork` lists no job row for it", { timeout: 900000 }, async () => {
    const d = await overCeiling();
    assert.deepEqual(await adminOwed(d.sha), [], "nothing is owed: no job row of any kind");
  });

  test("R9 seam §14a (G124a; R132, R125, R131, R130; PDF A2): a PDF AT the alpha ceiling is not stated: its `reading` row is held, the answer says `reading_pending`, and a PDF between the inline ceiling and the alpha ceiling is deferred as a row and not stated (control)", { timeout: 900000 }, async () => {
    const { auth } = await kit.ownerOf("r9lim-a2");
    const ceiling = boundOf("pdf", "bytes");
    const at = pdfExact("R132 at the ceiling exactly", ceiling);
    assert.equal(at.length, ceiling);
    const ok = R(await (await upload(auth, at)).json());
    assert.equal(ok.ok, true);
    assert.equal(ok.document.reading, undefined, "no statement at the ceiling");
    assert.equal(ok.reading_pending, true, "the reading follows by the job table (R131: over the inline ceiling, under the alpha ceiling)");
    const rows = await adminOwed(sha256(at));
    assert.ok(rows.some((x) => x.kind === "reading"), `a reading row is held for it: ${JSON.stringify(rows).slice(0, 300)}`);
    assert.ok(!rows.some((x) => x.state === "final"), "and none ended for a reason");
    /* A2: and it is read: filed as the capture screen files it, the alarm's ticks make the reading and its words are in `text_units` (R-STOP) */
    const made = await CAPTURE_SCREEN.parts.promoteDocument(kit.screenCall(auth), { doc: ok.document, title: "at the ceiling", locator: ok.document.locator, project: "" });
    assert.equal(made.refused, undefined, "filed: " + JSON.stringify(made).slice(0, 300));
    const read = await kit.until(async () => { const r = R(await kit.get(auth, { op: "reading", sha256: sha256(at) })); return r.found && r.reading && JSON.stringify(r.text_units ?? []).includes("at the ceiling exactly") ? r : null; }, 420000, 3000);
    assert.ok(read, "the ticks read the PDF at the ceiling: its words are in text_units");
    assert.notEqual(read.reading.failure, "final", "and it is not stated");
    const mid = pdfExact("R132 between the two ceilings", 5 * MiB);
    const m = R(await (await upload(auth, mid)).json());
    assert.deepEqual([m.reading_pending, m.document.reading], [true, undefined], "control: 5 MiB is owed as a row, not stated");
    assert.ok((await adminOwed(sha256(mid))).some((x) => x.kind === "reading"));
  });

  /* ---------------------------------------------------------------------------------------------------------------------------------------------------- 14b */
  test("R9 seam §14b (G124b; R72, R111, R130): a 24 MiB text uploaded through the real door lands whole and is not read inline; its job row is held", { timeout: 900000 }, async () => {
    const { auth } = await kit.ownerOf("r9lim-b");
    const size = 24 * MiB;
    const text = new Uint8Array(size).map((_, i) => (i % 61 === 60 ? 10 : 97 + ((i + 7) % 26)));
    text.set(te("R72 the clerk filed the twenty-four mebibyte notice "), 0);
    const res = await upload(auth, text, { type: "text/plain" });
    const body = await res.json();
    assert.equal(res.status, 200, JSON.stringify(body).slice(0, 300));
    const r = R(body);
    assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
    assert.deepEqual([r.capture.bytes, r.capture.sha256], [size, sha256(text)], "held whole under its own digest");
    assert.equal(r.reading_pending, true, "text over the 3 MiB inline ceiling is owed, not read in the request");
    assert.equal(r.document.reading, undefined, "unread");
    assert.ok((await adminOwed(sha256(text))).some((x) => x.kind === "reading"), "its reading row is held");
  });

  test("R9 seam §14b (G124b; R72, R111): the door hands `uploadCapture` its own byte ledger and the request's declared length: a 24 MiB text peaks at the file and at most two parts beyond it, and nothing is held once it is answered", { timeout: 900000 }, async () => {
    const { ownerOps: controlPlaneOwnerOps } = await import("../../../src/store-assembly/owner-ops.mjs");
    const { fresh, bucket } = await import("../capture/fixture.mjs");
    const { store } = await import("../store-assembly/fixture.mjs");
    const { pendingOf } = await import("../../../src/store-assembly/pending.mjs");
    const PART = 8 * MiB;
    const b = bucket();
    b.createMultipartUpload = async (key) => { const ps = []; return { uploadPart: async (n, bytes) => { ps[n - 1] = new Uint8Array(bytes); return { partNumber: n }; },
      complete: async () => { b.held.set(key, new Uint8Array(Buffer.concat(ps))); }, abort: async () => {} }; };
    const w = fresh({ evidence: b, env: { INSTANCE_NAME: "inst", VERSION: "9.9.9" } });
    w.c.evidenceKey = (d) => `bio/captures/${d}`;
    /* the job registrar is store-assembly's: the assembled store's real one, on the store's own storage */
    const x = await store({});
    const j = pendingOf(x.ctx);
    w.c.registerJob = (e) => j.registerJob(e); w.c.armJobs = () => j.armJobs();
    const real = w.core.transact.bind(w.core);
    w.core.transact = (fn) => { try { return real(() => x.ctx.storage.transactionSync(() => { const out = fn(); if (out && typeof out === "object" && out.ok === false) throw Object.assign(new Error("refused"), { refused: out }); return out; })); } catch (e) { if (e && e.refused) return e.refused; throw e; } };
    /* the ledger the door builds is the one capture is handed: seen through a spy on the method the owner-ops map calls */
    let seen = null, declared = null;
    const of = { capture: () => ({ uploadCapture: (a) => { seen = a.ledger; declared = a.declared; return w.c.uploadCapture(a); } }) };
    const size = 24 * MiB;
    const text = new Uint8Array(size).map((_, i) => (i % 61 === 60 ? 10 : 97 + (i % 26)));
    let at = 0;
    const stream = new ReadableStream({ pull(c) { if (at >= size) c.close(); else { c.enqueue(text.subarray(at, Math.min(at + MiB, size))); at += MiB; } } }, { highWaterMark: 0 });
    const u = new URL("http://do/captureupload");
    for (const [k, v] of Object.entries({ by: "member:ann", statement: "a text the clerk handed me", type: "text/plain", declared: String(size) })) u.searchParams.set(k, v);
    const out = await controlPlaneOwnerOps(of, u, stream).captureupload();
    assert.equal(out.ok, true, JSON.stringify(out).slice(0, 300));
    assert.equal(declared, size, "the declared length reached capture as a number");
    assert.ok(seen && typeof seen.hold === "function" && typeof seen.peak === "function", "a byte ledger was handed to capture");
    assert.ok(seen.peak() >= size, `the ledger counted the bytes held (${seen.peak()})`);
    assert.ok(seen.peak() <= size + 2 * PART, `no more than the file and two parts beyond it (${seen.peak()})`);
    assert.ok(seen.peak() <= capFor(0) * MiB, "and under the isolate's memory less its idle figure (the one cap convention)");
    assert.equal(seen.held(), 0, "released once answered");
    /* control: a ledger the door was not handed (a direct call) counts nothing, and the ledger of another request is another ledger */
    const again = [];
    const of2 = { capture: () => ({ uploadCapture: (a) => { again.push(a.ledger); return { ok: true }; } }) };
    controlPlaneOwnerOps(of2, u, new ReadableStream()).captureupload();
    controlPlaneOwnerOps(of2, u, new ReadableStream()).captureupload();
    assert.notEqual(again[0], again[1], "one ledger a request");
  });

  /* ---------------------------------------------------------------------------------------------------------------------------------------------------- 14g */
  test("R9 seam §14g (G124g; R72, R111, capture R113): the archive limit as uploaded: a file declared one byte over `archive.uploaded_bytes` is refused by name with its size, the limit and the key, nothing written; the bound itself is accepted", { timeout: 900000 }, async () => {
    const { auth } = await kit.ownerOf("r9lim-g1");
    const bound = boundOf("archive", "uploaded_bytes");
    const begin = (bytes, sha) => kit.post(auth, "captureuploadbegin", { sha256: sha, bytes, statement: "an archive the clerk handed me", name: "a.zip", type: "application/zip" });
    const over = await begin(bound + 1, "c".repeat(64));
    const o = R(over.body);
    assert.equal(o.status, 413, JSON.stringify(over.body).slice(0, 300));
    assert.equal(o.ok, false);
    assert.equal(o.reason, "TOO_LARGE");
    assert.deepEqual([sizeOf(o), limitOf(o), o.key], [bound + 1, bound, statement("archive", "uploaded_bytes", bound + 1).key], "refused with its size, the limit and the key");
    const at = await begin(bound, "d".repeat(64));
    assert.equal(R(at.body).ok, true, `the bound itself is accepted: ${JSON.stringify(at.body).slice(0, 300)}`);
    assert.ok(R(at.body).upload, "an upload was begun");
    const ab = await kit.post(auth, "captureuploadabort", { upload: R(at.body).upload });
    assert.equal(R(ab.body).ok, true, "and aborted, nothing left held");
  });

  /* the archive with one member per `unpacked` byte declared: a lazy writer's directory states what the members unpack to, the real bytes are a few */
  async function archiveDeclaring(total) {
    const half = Math.floor(total / 2);
    const entries = [
      { name: "notes/a.txt", data: te("the first member of the archive"), method: 0, central: { uncompressedSize: half } },
      { name: "notes/b.txt", data: te("the second member of the archive"), method: 0, central: { uncompressedSize: total - half } },
    ];
    return collect(zipChunks64(entries));
  }
  const unpackOf = async (auth, total) => {
    const zip = await archiveDeclaring(total);
    const up = R(await (await upload(auth, zip, { type: "application/zip", name: `a${total}.zip` })).json());
    assert.equal(up.ok, true, JSON.stringify(up).slice(0, 300));
    return R((await kit.post(auth, "unpack", { archiveSha: up.capture.sha256 })).body);
  };
  test("R9 seam §14g (G124g; R134, R111, acquisition R38): an archive whose directory declares one byte over `archive.unpacked_bytes` is refused by name `ARCHIVE_TOTAL_MAX` with the limit; the bound itself is not refused for its total", { timeout: 900000 }, async () => {
    const { auth } = await kit.ownerOf("r9lim-g2");
    const bound = boundOf("archive", "unpacked_bytes");
    const o = await unpackOf(auth, bound + 1);
    assert.equal(o.ok, false, JSON.stringify(o).slice(0, 400));
    assert.equal(o.reason, "ARCHIVE_TOTAL_MAX", "refused by name");
    assert.equal(limitOf(o), bound, "with the limit");
    const a = await unpackOf(auth, bound);
    assert.notEqual(a.reason, "ARCHIVE_TOTAL_MAX", `the bound itself is not refused for its total: ${JSON.stringify(a).slice(0, 400)}`);
  });
  test("R9 seam §14g (G124g; R134, R111, R-SILENT) (red until acquisition's refusal states the size the directory declares): the refusal of an archive over `archive.unpacked_bytes` carries the declared total beside the limit", { timeout: 900000 }, async () => {
    const { auth } = await kit.ownerOf("r9lim-g3");
    const bound = boundOf("archive", "unpacked_bytes");
    const o = await unpackOf(auth, bound + 1);
    assert.equal(o.reason, "ARCHIVE_TOTAL_MAX");
    assert.equal(sizeOf(o), bound + 1, `the size the directory declares (the refusal's fields: ${Object.keys(o).join(", ")})`);
  });

  /* ======================================================================================================================================================== 15 */

  /* THE PRESS KIT: the counting door (`wrap-entry`) with R2 gets told apart, the OCR member bound as a service that counts its calls, and the AI part admitted on the test-instance
     exception. // MOVE: the ranged/whole split of `CAPTURES.get` belongs in `wrap-entry.worker.txt` (test-support's); here the worker's text is patched where it names an R2 call. */
  const ocr = { down: true, calls: [], pages: [] };
  const OCR_WORKER = async (req) => {
    const b = await req.json();
    const pages = (b.pages || []).slice(0, 24);
    ocr.calls.push(pages.length);
    ocr.pages.push(...pages);
    if (ocr.down) return new Response("down", { status: 503 });
    return new Response(JSON.stringify({ ok: true, engine: "tess", version: "5.3", cap: "C", measured_by: "M-1", confidence_floor: null,
      pages: pages.map((p) => ({ page: p, regions: [{ text: `ocr scan page ${p} words`, source: { kind: "pdf-page", ref: `p${p}`, page: p, rect: [0, 0, 10, 10] }, confidence: "none" }] })) }),
      { headers: { "content-type": "application/json" } });
  };
  const TAGP = "r9limp";
  const press = makeKit({ tag: TAGP, counting: true, serviceBindings: { OCR_WORKER }, bindings: { CIVICSMITH_TEST_INSTANCE: `${TAGP}-town` } });
  const ready = (async () => {
    const entry = wrapScript();
    const must = (text, from, to, what) => { if (!text.includes(from)) throw new Error(`wrap-entry.worker.txt no longer has ${what} as the press kit expects; update r9-seam-limits.mjs`); return text.split(from).join(to); };
    let script = entry.script;
    /* a ranged get is told from a whole one */
    script = must(script, "`${name}.${String(key)}`", "`${name}.${String(key)}${key === \"get\" && args[1] && args[1].range ? \".ranged\" : \"\"}`", "the R2 call's key");
    /* a call to the OCR member made inside a request (by the Worker or by the object serving it) is counted as `OCR_WORKER.fetch`; the alarm's ticks belong to no request and are not */
    script = must(script, "const wrappers = new WeakMap();",
      `const wrappers = new WeakMap();
const serviceWrappers = new WeakMap();
const countedService = (svc, sinkOf, kind) => { if (!svc || typeof svc.fetch !== "function") return svc;
  const own = serviceWrappers.get(svc) ?? new Map(); serviceWrappers.set(svc, own);
  if (!own.has(kind)) own.set(kind, new Proxy(svc, { get(t, k) { const v = t[k];
    if (k === "fetch" && typeof v === "function") return (...a) => { const s = sinkOf(); if (s) add(s, "r2", "OCR_WORKER.fetch", 0); return v.apply(t, a); };
    return typeof v === "function" ? v.bind(t) : v; } }));
  return own.get(kind); };`, "the wrapper table");
    script = must(script, 'if (key === "CAPTURES" || key === "PUBLISHED") return bucket(target[key], String(key), sinkOf, "r2", true);',
      'if (key === "OCR_WORKER") return countedService(target[key], sinkOf, "object");\n        if (key === "CAPTURES" || key === "PUBLISHED") return bucket(target[key], String(key), sinkOf, "r2", true);', "the object's environment");
    script = must(script, 'if (key === "CAPTURES" || key === "PUBLISHED") return bucket(target[key], String(key), () => sink, "r2");',
      'if (key === "OCR_WORKER") return countedService(target[key], () => sink, "worker");\n      if (key === "CAPTURES" || key === "PUBLISHED") return bucket(target[key], String(key), () => sink, "r2");', "the Worker's environment");
    await press.mf.setOptions({ ...press.OPTIONS, scriptPath: entry.scriptPath, script });
  })();
  after(() => press.mf.dispose());

  /* the whole objects an answer's request loaded: the R2 gets with no range, by the Worker and inside the object (a ranged get is `CAPTURES.get.ranged` and a head is `.head`) */
  const wholeGets = (calls) => (calls.r2["CAPTURES.get"]?.n ?? 0) + (calls.object["CAPTURES.get"]?.n ?? 0);
  /* the calls to the OCR member made INSIDE the request (the alarm's own ticks are no request's) */
  const ocrIn = (calls) => (calls.r2["OCR_WORKER.fetch"]?.n ?? 0) + (calls.object["OCR_WORKER.fetch"]?.n ?? 0);
  const writesOf = (calls) => Object.keys({ ...calls.r2, ...calls.object }).filter((k) => /\.(?:put|delete)$/.test(k));
  const owedOf = async (sha) => { const q = await press.get(await press.founder(), { op: "owedwork", sha }); return R(q).owed ?? []; };
  const readingOf = async (auth, sha) => R(await press.get(auth, { op: "reading", sha256: sha }));
  const uploadTo = async (auth, bytes, { type, name }) => {
    const res = await press.plane(`/api/?${new URLSearchParams({ op: "captureupload", statement: "a file the clerk handed me", name, type })}`, { method: "POST", headers: auth, body: bytes });
    return { res, status: res.status, body: R(await res.json()), calls: readCalls(res) };
  };
  const fileIt = async (auth, up, title) => {
    const made = await CAPTURE_SCREEN.parts.promoteDocument(press.screenCall(auth), { doc: up.document, title, locator: up.document.locator, project: "" });
    assert.equal(made.refused, undefined, "filed: " + JSON.stringify(made).slice(0, 300));
    return made.bundleId;
  };
  const MARK = (n) => `zzmark${n}`;
  const csvOf = (rows, tag) => {
    const lines = ["id,payee,amount,note"];
    for (let i = 1; i <= rows; i++) {
      const mark = i === 1 ? MARK(`first${tag}`) : i === Math.floor(rows / 2) ? MARK(`mid${tag}`) : i === rows ? MARK(`last${tag}`) : `n${i}`;
      lines.push(`R${String(i).padStart(6, "0")},payee ${i % 97},${i % 1000}.${i % 100},note ${mark} for row ${i}`);
    }
    return te(lines.join("\n") + "\n");
  };
  const hitsFor = async (auth, q) => (R(await press.get(auth, { op: "search", q: `passage:${q}`, limit: "5" })).hits ?? []);

  /* one PDF over 2 MiB filed with its reading made by the ticks, and one scan over 2 MiB whose OCR member is down (its pages stay owed), each made once */
  let textDoc = null, scanDoc = null;
  const textPdf = () => (textDoc ??= (async () => {
    await ready;
    const { auth } = await press.ownerOf("r9lim-p1");
    const words = `R131 the council adopted the budget resolution ${Date.now()}`;
    const bytes = press.pdfOf(words, 3 * MiB);
    const up = await uploadTo(auth, bytes, { type: "application/pdf", name: "text.pdf" });
    assert.equal(up.status, 200, JSON.stringify(up.body).slice(0, 300));
    await fileIt(auth, up.body, "text.pdf");
    const sha = sha256(bytes);
    const read = await press.until(async () => { const r = await readingOf(auth, sha); return r.found && r.reading && JSON.stringify(r.text_units ?? []).includes("the council adopted") ? r : null; }, 240000, 3000);
    assert.ok(read, "the text PDF over 2 MiB is read by the ticks");
    return { auth, sha, up, size: bytes.length };
  })());
  const scanPdf = () => (scanDoc ??= (async () => {
    await ready;
    const { auth } = await press.ownerOf("r9lim-p2");
    const bytes = await generate({ kind: "pdf", seed: "r9lim", size: { pages: 3, lines: 6, bytes: 3 * MiB }, kinds: ["scan"] }).bytes();
    const up = await uploadTo(auth, bytes, { type: "application/pdf", name: "scan.pdf" });
    assert.equal(up.status, 200, JSON.stringify(up.body).slice(0, 300));
    const inRequest = ocrIn(up.calls);
    await fileIt(auth, up.body, "scan.pdf");
    const sha = sha256(bytes);
    const read = await press.until(async () => { const r = await readingOf(auth, sha); return r.found && r.reading && r.reading.tier3_candidate === true ? r : null; }, 240000, 3000);
    assert.ok(read, "the scan is read by the ticks and its pages stay owed while the OCR member is down");
    return { auth, sha, up, inRequest, size: bytes.length };
  })());

  test("R9 seam §15 (G126e, G126b; R131, R125, R130; SCAN E4): the OCR press `pdfstructure&ocr=1` on a scan over 2 MiB loads no byte of it in the request and makes no OCR call there; the pages left are an `ocr` row, `owedwork` lists them", { timeout: 900000 }, async () => {
    const d = await scanPdf();
    assert.equal(d.inRequest, 0, "R131: the upload of the scan made no OCR call");
    assert.equal(d.up.body.reading_pending, true, "and owed its reading to the job table");
    const res = await press.plane(`/api/?op=pdfstructure&ocr=1&sha256=${d.sha}`, { headers: d.auth });
    const body = R(await res.json());
    const calls = readCalls(res);
    assert.equal(res.status, 200, JSON.stringify(body).slice(0, 300));
    assert.equal(wholeGets(calls), 0, `the object was not loaded in the request: ${JSON.stringify({ r2: calls.r2, object: calls.object })}`);
    assert.deepEqual(writesOf(calls), [], "and nothing was written to R2");
    assert.equal(ocrIn(calls), 0, "no OCR call was made inside the press");
    assert.equal(body.ocr_pending, true, "the press answers at once, the pages owed");
    assert.equal(body.reading_pending, true);
    const rows = await owedOf(d.sha);
    const row = rows.find((x) => x.kind === "ocr");
    assert.ok(row, `owedwork lists the ocr row: ${JSON.stringify(rows.map((x) => [x.kind, x.state])).slice(0, 300)}`);
    assert.notEqual(row.state, "final", "and it is not ended");
  });

  test("R9 seam §15 (G126e; R131, R125; K4901 (2)): the plain `op=pdfstructure` of that scan (over the request bound) reads nothing in the request: it states the file's size and the bound and owes a raised `reading` job; no OCR call, no whole get", { timeout: 900000 }, async () => {
    const d = await scanPdf();
    const res = await press.plane(`/api/?op=pdfstructure&sha256=${d.sha}`, { headers: d.auth });
    const body = await res.json();
    const calls = readCalls(res);
    assert.equal(res.status, 200, JSON.stringify(body).slice(0, 300));
    assert.equal(wholeGets(calls), 0, `no whole get: ${JSON.stringify(calls.object)}`);
    assert.equal(ocrIn(calls), 0);
    assert.deepEqual([body.size, body.limit], [d.size, boundOf("pdf", "request_bytes")], "the size and the bound it was over");
    assert.equal(body.reextraction.owed, true);
    assert.equal(body.reextraction.performed, false);
    assert.equal(body.reextraction.registration.registered, true, "the row is held");
  });

  test("R9 seam §15 (G126e, R103; R131, R125; SCAN E4): `op=pagetranscribe` on that scan is answered without loading the object (no whole get; the first KiB by a ranged get at most), makes no OCR call, writes nothing to R2, and leaves its `ocr` row standing", { timeout: 900000 }, async () => {
    const d = await scanPdf();
    const res = await press.plane(`/api/?op=pagetranscribe&sha256=${d.sha}`, { method: "POST", headers: { ...d.auth, "content-type": "application/json" }, body: "{}" });
    const body = await res.json();
    const calls = readCalls(res);
    assert.ok(res.status < 500, `stated, never a failure of the door: ${res.status} ${JSON.stringify(body).slice(0, 300)}`);
    assert.equal(wholeGets(calls), 0, `the object was not loaded in the request: ${JSON.stringify(calls.object)}`);
    assert.deepEqual(writesOf(calls), []);
    assert.equal(ocrIn(calls), 0, "no OCR call inside the request");
    assert.ok(body.ok === true || typeof body.reason === "string", "an answer or a refusal by name");
    if (body.ok === true && body.transcription && body.transcription.performed === true)
      assert.equal(typeof body.says, "string", "what was filled is said (the pages filled, never the pages asked: extraction's R103 pins the words)");
    assert.ok((await owedOf(d.sha)).some((x) => x.kind === "ocr" && x.state !== "final"), "the pages the act did not fill stay owed");
  });

  test("R9 seam §15 (G126e; R131, R125; PDF E11): the press, the plain read and `pagetranscribe` on a TEXT PDF over 2 MiB load no byte of it in the request: no whole get, no OCR call; the press owes nothing (no page lacks a text layer) and the plain read owes a raised `reading`", { timeout: 900000 }, async () => {
    const d = await textPdf();
    const pressed = await press.plane(`/api/?op=pdfstructure&ocr=1&sha256=${d.sha}`, { headers: d.auth });
    const pb = await pressed.json();
    assert.equal(pressed.status, 200, JSON.stringify(pb).slice(0, 300));
    assert.equal(wholeGets(readCalls(pressed)), 0, `press: ${JSON.stringify(readCalls(pressed).object)}`);
    assert.notEqual(R(pb).reextraction?.performed, true, "the press performs nothing in the request");
    assert.deepEqual(R(pb).reextraction?.candidate ?? [], [], "no page is left for OCR");
    const plain = await press.plane(`/api/?op=pdfstructure&sha256=${d.sha}`, { headers: d.auth });
    const lb = await plain.json();
    assert.equal(wholeGets(readCalls(plain)), 0, `plain: ${JSON.stringify(readCalls(plain).object)}`);
    assert.deepEqual([lb.size, lb.limit, lb.reextraction.owed, lb.reextraction.registration.registered], [d.size, boundOf("pdf", "request_bytes"), true, true]);
    const tr = await press.plane(`/api/?op=pagetranscribe&sha256=${d.sha}`, { method: "POST", headers: { ...d.auth, "content-type": "application/json" }, body: "{}" });
    const tb = await tr.json();
    assert.ok(tr.status < 500, `pagetranscribe: ${tr.status} ${JSON.stringify(tb).slice(0, 200)}`);
    assert.equal(wholeGets(readCalls(tr)), 0, `pagetranscribe: ${JSON.stringify(readCalls(tr).object)}`);
    assert.equal(ocrIn(readCalls(pressed)) + ocrIn(readCalls(plain)) + ocrIn(readCalls(tr)), 0, "and no OCR call inside any of the three");
  });

  test("R9 seam §15 (G126a, G126e; R130, R125; SCAN C1, E3): with the OCR member back, the ticks fill the pages the press owed: their words are in `text_units` and no `ocr` row stands", { timeout: 900000 }, async () => {
    const d = await scanPdf();
    ocr.down = false;
    const done = await press.until(async () => {
      const r = await readingOf(d.auth, d.sha);
      const rows = await owedOf(d.sha);
      return r.found && r.reading && r.reading.tier3_candidate !== true && !rows.some((x) => x.kind === "ocr") ? r : null;
    }, 420000, 3000);
    assert.ok(done, "the pages are read and the ocr row ended");
    const text = JSON.stringify(done.text_units ?? []);
    const asked = [...new Set(ocr.pages)];
    assert.ok(asked.length >= 1);
    for (const p of asked) assert.ok(text.includes(`ocr scan page ${p} words`), `page ${p}'s words are in text_units (R-STOP)`);
    assert.equal(done.reading.ocr_left ?? null, null, "and none is left");
  });

  /* ---------------------------------------------------------------------------------------------------------------------------------------------------- 15 · G126h */
  test("R9 seam §15 (G126h; R131, R123, R130; SHEET C-family; B75 (d)): a 2 MB CSV through the no-cursor door is read inline, as `text.request_bytes` (3 MiB) governs: the `extractread` of the request is present and the answer owes no reading; control: a CSV over 3 MiB is deferred with its row", { timeout: 900000 }, async () => {
    await ready;
    const { auth } = await press.ownerOf("r9lim-s1");
    const csv = csvOf(46000, "a");
    assert.ok(csv.length > 2 * MiB && csv.length < 3 * MiB, `the file is about 2 MB (${csv.length})`);
    const up = await uploadTo(auth, csv, { type: "text/csv", name: "sheet-a.csv" });
    assert.equal(up.status, 200, JSON.stringify(up.body).slice(0, 300));
    assert.ok(up.calls.do.extractread !== undefined, `read inline inside the upload: ${JSON.stringify(up.calls.do)}`);
    assert.notEqual(up.body.reading_pending, true, "no reading is owed");
    const big = csvOf(70000, "b");
    assert.ok(big.length > READING_DEFER_OTHER_BYTES, `the control is over 3 MiB (${big.length})`);
    const over = await uploadTo(auth, big, { type: "text/csv", name: "sheet-b.csv" });
    assert.equal(over.status, 200, JSON.stringify(over.body).slice(0, 300));
    assert.equal(over.calls.do.extractread, undefined, `no inline read of the larger file: ${JSON.stringify(over.calls.do)}`);
    assert.equal(over.body.reading_pending, true, "its reading is owed");
    assert.ok((await owedOf(sha256(big))).some((x) => x.kind === "reading"), "the row exists");
  });

  test("R9 seam §15 (G126h; R131, R123, R125; SHEET J-9, J-10): a 4 MiB CSV (over the inline ceiling) is not read at the door, its row exists, and after the ticks the first, a middle and the LAST row are found by `op=search`, the reading whole and cut nowhere", { timeout: 900000 }, async () => {
    await ready;
    const { auth } = await press.ownerOf("r9lim-s2");
    const csv = csvOf(96000, "b");
    assert.ok(csv.length > READING_DEFER_OTHER_BYTES, `over the inline ceiling (${csv.length})`);
    const up = await uploadTo(auth, csv, { type: "text/csv", name: "sheet-b.csv" });
    assert.equal(up.status, 200, JSON.stringify(up.body).slice(0, 300));
    assert.equal(up.calls.do.extractread, undefined, "no inline read inside the upload");
    assert.equal(up.body.reading_pending, true);
    assert.ok((await owedOf(sha256(csv))).some((x) => x.kind === "reading"), "the row exists before any filing");
    const bundle = await fileIt(auth, up.body, "sheet-b.csv");
    const sha = sha256(csv);
    const whole = await press.until(async () => { const r = await readingOf(auth, sha); return r.found && r.completeness?.state === "whole" ? r : null; }, 360000, 3000);
    assert.ok(whole, "the ticks read the whole file");
    assert.deepEqual([whole.completeness.counts.truncated, whole.completeness.counts.over_bound, whole.completeness.counts.skipped_named], [0, 0, 0], "no unit cut, none left out of the index");
    for (const m of ["firstb", "midb", "lastb"]) {
      const hits = await hitsFor(auth, MARK(m));
      assert.ok(hits.some((h) => h.bundle_id === bundle), `the ${m} row's mark is found by op=search`);
    }
  });

  test("R9 seam §15 (G126h, S-23; R100, R123; SHEET J-9, J-10): the 2 MB CSV that the door reads at once is whole after the ticks and its last row is found by `op=search`, never indexed `whole` with a cut", { timeout: 900000 }, async () => {
    await ready;
    const { auth } = await press.ownerOf("r9lim-s3");
    const csv = csvOf(46000, "c");
    const up = await uploadTo(auth, csv, { type: "text/csv", name: "sheet-c.csv" });
    assert.equal(up.status, 200, JSON.stringify(up.body).slice(0, 300));
    const bundle = await fileIt(auth, up.body, "sheet-c.csv");
    const sha = sha256(csv);
    const whole = await press.until(async () => { const r = await readingOf(auth, sha); return r.found && r.completeness?.state === "whole" && (r.job?.state ?? null) !== "reading" ? r : null; }, 360000, 3000);
    assert.ok(whole, "the read is whole once the ticks are done");
    assert.deepEqual([whole.completeness.counts.truncated, whole.completeness.counts.over_bound, whole.completeness.counts.skipped_named], [0, 0, 0]);
    for (const m of ["firstc", "midc", "lastc"]) assert.ok((await hitsFor(auth, MARK(m))).some((h) => h.bundle_id === bundle), `the ${m} mark is found`);
  });

  /* ---------------------------------------------------------------------------------------------------------------------------------------------------- G124 */
  test("R9 seam §14 (G124, R132; K3268) (red until each quoting job below merges and runtime-limits records the rows its constants need): THE ALL-MODULES GREP: no module declares a reading ceiling as a number that `READ_BOUNDS` does not hold: every ceiling constant of every module resolves to the table through boundOf/statement or is an accepted non-ceiling", () => {
    const { found, scanned, modules, declared } = ceilingConstantsOfModules();
    assert.ok(scanned > 500, `the walk read the modules' source (${scanned} files of ${modules.size} of ${declared} modules)`);
    const loose = found.filter((c) => !Object.hasOwn(ACCEPTED, acceptedKey(c)));
    const line = (c) => `${c.module} ${c.file}:${c.line} ${c.name} = ${c.rhs} (${c.value})`;
    assert.deepEqual(loose.map(line), [], `${loose.length} ceiling constant(s) written as numbers that resolve to no READ_BOUNDS row, by module, file:line and name:\n  ${loose.map(line).join("\n  ")}`);
  });

  test("R9 seam §14 (G124): every name in ACCEPTED is still declared as a number where it says (an accepted name that no longer exists is removed, not left to hide the next constant)", () => {
    const { found } = ceilingConstantsOfModules();
    const have = new Set(found.map(acceptedKey));
    const stale = Object.keys(ACCEPTED).filter((k) => !have.has(k));
    assert.deepEqual(stale, [], `accepted names the walk no longer finds: ${stale.join(", ")}`);
    for (const [k, why] of Object.entries(ACCEPTED)) assert.ok(typeof why === "string" && why.length > 10 && !/\n/.test(why), `${k} carries its one-line reason`);
  });

  test("R9 seam §14 (G124): every module's own `boundOf`/`statement` call that names a table row by two string literals names a row that exists (a quote of a row the table does not hold throws at load)", () => {
    const { sources } = moduleSources();
    const call = /\b(?:boundOf|statement|boundStatement)\(\s*["']([a-z_]+)["']\s*,\s*["']([a-z_]+)["']/g;
    const missing = [];
    let quoted = 0;
    for (const { module, file } of sources) {
      let text;
      try { text = readFileSync(join(ROOT, file), "utf8"); } catch { continue; }
      text.split("\n").forEach((l, i) => {
        if (/^\s*(?:\/\/|\/\*|\*)/.test(l)) return;
        for (const m of l.matchAll(call)) {
          quoted++;
          if (!(Object.hasOwn(READ_BOUNDS, m[1]) && Object.hasOwn(READ_BOUNDS[m[1]], m[2]))) missing.push(`${module} ${file}:${i + 1} ${m[1]}.${m[2]}`);
        }
      });
    }
    assert.ok(quoted > 40, `the walk found the modules' quotes (${quoted})`);
    assert.deepEqual(missing, [], "quotes of rows the table does not hold");
  });
}
