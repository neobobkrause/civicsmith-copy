/* extraction (layer 4): readings made from captured bytes, and what the record keeps of them. The store half
   (R19–R30, R36–R40, R61–R62) and the Durable Object's wiring of the reading (R1, R18 through `read`, handing
   `reading-pipeline` the store and the view; R31–R35 through `pdfStructure`), reached through `extractionOf(ctx)`
   (K61). Moved from `store.mjs` (the reading writer, the re-read, the history, the text-source and text-index writers,
   the reads, the term helpers, the drift reads) and `index.mjs` (`op=pdfstructure`, the acquire wire's reading block),
   with the rows this job applied named at their sites. The tier ladder and the reading's provenance moved on to
   `reading-pipeline` (N513, T25). The tables are this module's own (`schema.mjs`), declared to record-core's purge here (R49). T19 layer 4:
   the testimony path's index as a projection in `provenance`'s slot (R65), the figures through record-core's
   `registerCounts` and `textIndexOk` (R67), and N26's migration of stored `.docx` readings (R66). T20 layer 4: N439's
   migration of stored `.pptx` readings (R68), run by the same machine as N26's. T33 layer 4: every reading's commit
   calls its storage's `reading-pipeline.readHooksOf(ctx).afterRead` once (R69, T33-23a). T42 layer 4: `op=pagetranscribe`,
   the AI's reading of the pages Civicsmith could not read (R71), through the one transcriber the composition root
   registers (R72), so nothing above this layer is imported; R58's contract names `capture_text`. */
import { recordOf, stampInstant } from "../record-core/index.mjs";
import { membershipOf, viewerPredicate, listenerRefusal, MODULE_ORDER, noSuchProject, notAParticipant } from "../membership/index.mjs";
import { calibrationOf } from "../calibration/index.mjs";
import { provenanceOf } from "../provenance/index.mjs";
import { docxRenumbering } from "../docx.mjs";
import { pptxRenumbering } from "../pptx.mjs";
import { combine } from "../../../jurisdictions/index.mjs";
import { getFormat, detectFormat } from "../formats.mjs";
import { readText } from "../../../docprofile/registry.mjs";
import { checkChain, calibrationsOf, isTranscribed, terminalStep, derivationCap, describeChain, glyphCount,
         readingSource, readingSourceJson, readingOccurrenceKey, readingSourceFromColumns, chainKindFor, mergedChain,
         STEP_KINDS, canonicalExtent, describeExtent } from "../textchain.mjs";
import { sha256HexSync } from "../record-grammar/sha256.mjs";
import { contentMintState } from "../record-grammar/labels.mjs";
import { EXTRACTION_SCHEMA } from "./schema.mjs";
import { REEXTRACT_CHECKS, reextractRow, EXTRACTION_CHECKS, noSha, NO_SHA_DETAIL, TRANSCRIBE_WORDS, fillWords,
         pagesSaid, AGENT_WORKER_REASONS } from "./checks.mjs";
import { evidenceAbsent } from "../capture/ops.mjs";
import { readRange } from "../acquisition/index.mjs";
import { boundOf, READ_BOUNDS, levelOf } from "../read-bounds.mjs";
import { isMachineIdentity } from "../record-grammar/index.mjs";
import { INTERPRET_HOW, STANDING_RECORDED_MAX, RANGE_KINDS, normalPart, samePart, refusals, uncovered } from "./interpret.mjs";
import { PLATFORM_FIGURES } from "../byte-ledger.mjs";
import { say } from "./words.mjs";
import { driftObligations } from "./drift.mjs";
import { membershipBeside } from "./filemembership.mjs";
import * as pipeline from "../reading-pipeline/index.mjs";
import { read as readDocument, tier2Escalate, tier3Extend, tier3SeedFrom, needsTier3, textUnitsFor, layerChainFor,
         readingFromWire, decodeView, textCountsOf, textWordsFor, emittedFieldsOf, pageBoxesFrom, bytesOf, CAPTURE_TEXT_UNIT_CAP,
         compareProvenance, readingProvenance, PROVENANCE_SCHEME, tier4Extend, tier4Pages,
         AI_TRANSCRIPTION_SOURCE, TRANSCRIBE_USE, PAGE_KILLED_READER, OCR_INVOCATIONS_PER_REQUEST } from "../reading-pipeline/index.mjs";
import { localize, word } from "../setup-words/index.mjs";
import { SCREEN_WORDS } from "./screen-words.mjs";

export { REEXTRACT_CHECKS, reextractRow, EXTRACTION_CHECKS, noSha, NO_SHA_DETAIL, CAPTURE_TEXT_UNIT_CAP, TRANSCRIBE_WORDS, SCREEN_WORDS };

const safeJson = (s) => { try { return s == null ? null : JSON.parse(s); } catch { return null; } };

/** (G41; R96) The UTF-8 bytes of a string, counted in slices so a large string is never encoded whole (an 11 MB reading is not copied to count it). */
function utf8Bytes(s) {
  let n = 0;
  for (let at = 0; at < s.length;) {
    let end = Math.min(at + 65536, s.length);
    if (end < s.length) { const c = s.charCodeAt(end - 1); if (c >= 0xd800 && c <= 0xdbff) end++; }
    n += new TextEncoder().encode(s.slice(at, end)).length;
    at = end;
  }
  return n;
}
/** (G41; R98) A typed cell's place, `{row, col}` (both from 1), from its `source.cell` (`B7`), else the part of `source.ref` after the sheet's `!`;
 *  null for a cell that names none. */
export function cellAddress(c) {
  const src = c && typeof c === "object" && c.source && typeof c.source === "object" ? c.source : null;
  const text = src && typeof src.cell === "string" ? src.cell : src && typeof src.ref === "string" ? src.ref.slice(src.ref.lastIndexOf("!") + 1) : "";
  const m = /^\$?([A-Za-z]{1,4})\$?([1-9][0-9]*)$/.exec(text);
  if (!m) return null;
  let col = 0;
  for (const ch of m[1].toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { row: Number(m[2]), col };
}
/** (G41; R98) An answer of `cellsOf` from cells in row then column order: at most `max` of them, ending at a row's end when it can, and `next_row`
 *  naming the row a cut answer goes on from (the entry's own when it stopped itself). */
function cut(cells, interpreted, ats, max, entryNext = null) {
  let n = cells.length, next = entryNext;
  if (n > max) {
    const firstDropped = ats[max] ? ats[max].row : null;
    n = max;
    if (firstDropped !== null && ats[max - 1] && ats[max - 1].row === firstDropped) {
      let k = max; while (k > 0 && ats[k - 1] && ats[k - 1].row === firstDropped) k--;
      if (k > 0) n = k;
      /* a row wider than the cap is answered whole (no sheet has 20,000 columns): a row is never answered in part without saying so */
      else { n = ats.findIndex((a) => a && a.row !== firstDropped); if (n < 0) n = cells.length; }
    }
    next = firstDropped !== null && ats[n - 1] && ats[n - 1].row === firstDropped ? firstDropped + 1 : firstDropped;
  }
  const to = next !== null && interpreted ? Math.min(interpreted.to_row, next - 1) : interpreted ? interpreted.to_row : null;
  return { cells: n === cells.length ? cells : cells.slice(0, n), interpreted: interpreted ? { ...interpreted, to_row: to } : null, next_row: next };
}
/** (G41; R96) Whether a string is over `limit` UTF-8 bytes, answered without counting when its length decides it (a UTF-16 unit is at most three bytes). */
const overBytes = (s, limit) => typeof s === "string" && s.length > limit / 3 && (s.length > limit || utf8Bytes(s) > limit);

/* R22 (CONTENT-SEARCH-DESIGN §4.3, M-20): what one piece of a read asks the reader for (its `unitsBudget` and `maxUnits`, reading-pipeline R40) and
   what one page of `unitsOf` answers (R36). (fix round 9, G128f; R22, R99) Neither bounds a write any more: the writer cuts and drops no unit, and the
   index grows to the last line, in batches of LAND_BATCH_BYTES. */
export const CAPTURE_TEXT_CAPTURE_BOUND = 2 * 1024 * 1024;
export const CAPTURE_TEXT_CAPTURE_UNIT_BOUND = 4096;
/** (T53; R122; PLATFORM P-32, K5736) The most a run of `readHeld` for the owed-work ledger's `reading` job holds in memory before it writes and yields: units, and the UTF-8
 *  bytes of their text. A run offers the index at most this much and says `more`; the next tick resumes from the stored cursor, and the reading it lands is the same as one
 *  uninterrupted run's. A document within it is read in one run, as before. `runtime-limits` takes both as rows in the completion round. */
export const READ_RUN_UNITS_MAX = 4096;
export const READ_RUN_BYTES_MAX = 1024 * 1024;
/** (fix round 9, G128; R99; K4838 (4); R-GATE) The most UTF-8 bytes of unit text one batch lands in one transaction: runtime-limits' `PLATFORM_FIGURES`
 *  entry, 1 MiB until BOB records P-M9 (far below the 2,098,176-byte value bound; a 10,000-row write blocks the object about 2.8 s). A unit over it lands
 *  alone in its own batch, never cut. */
export const LAND_BATCH_BYTES = PLATFORM_FIGURES.LAND_BATCH_BYTES.value;
/** (fix round 10, cause 24 (b); R111; K5057) The most units one batch lands, beside LAND_BATCH_BYTES: a batch is one uninterrupted stretch that the next
 *  request waits behind, and on the platform a landed row costs about 0.28 ms (the same measurement as LAND_BATCH_BYTES: 10,000 rows block the object
 *  about 2.8 s), so 256 units are a stretch of about 70 ms, under R111's 100 ms for the 95th percentile. The tick lands its batches with a turn given back
 *  between each (`indexUnitsYielding`). */
export const LAND_BATCH_UNITS = 256;
/** The turn given back between two batches: a timer of 0 ms, which lets the requests queued on the object run before the next batch lands. */
const yieldNow = () => new Promise((resolve) => setTimeout(resolve, 0));
/** (fix round 9, G128j; R105 (b)) The shape of reading this module writes, stated on every reading it writes (`readings.reading_shape`): 9 is fix round
 *  9's (the units land whole in batches, every part with its kind, completeness from the counters, the stored PDF reading completed by its pieces). A
 *  reading stored with none, or an older one, was written by an older reader and is re-read by `migrateReadings` when it is in one of the old shapes. */
export const READING_SHAPE = 9;
/** (fix round 6, G38; R93, R94) what one answer of `op=reading` carries: a page of units holds about 1 MiB of unit text (a unit over it alone
 *  on its page), and a key of the stored reading over 256 KiB (a sheet's `cells`, 11.8 MB for a 1 MB CSV) is named, never carried. */
export const READING_PAGE_BYTES = 1048576;
export const READING_KEY_BYTES = 262144;
/** (fix round 6, G41; R96) The most a newly built value bound into `readings` or `reading_history` may weigh, by UTF-8 bytes: 1 MiB, half the
 *  platform's single-value limit (2,098,176 B passed, 2,252,800 B failed: record-core/schema.mjs:30-35), the margin that file keeps. A reading
 *  over it is not stored; a small stated reading is (R97). A protective bound, reported to Bob (K1881). */
export const READING_ROW_MAX_BYTES = 1048576;
/** (G41; R96) The first-write copy of a stored reading into the history (`#keepReading`) is exempt from that bound up to the platform's limit:
 *  a 1.5 MiB reading the code before G41 stored is re-read and kept as it was. */
export const PRIOR_READING_COPY_MAX_BYTES = 2098176;
/** (G41; R98) The most typed cells `cellsOf` answers a call: 20,000 cells in the extent asked for, so 20,000 cells per citation is the stated
 *  bound, the rest named by `next_row`. A protective bound, reported to Bob (K1881). */
export const CELLS_RANGE_MAX = 20000;
/** (fix round 9, R108) The most captures one `progressOf` call answers. */
export const PROGRESS_MAX = 500;
/** (fix round 9, G126e; R103; R-SILENT; K4901) The most of a capture a member's request loads whole: the `READ_BOUNDS` row `pdf.request_bytes` (2 MiB in
 *  all three columns, the figure the plan states and control-plane's inline gate holds). */
export const REQUEST_READ_MAX = boundOf("pdf", "request_bytes");
/** (fix round 9, G129c; R101) The one retry of a unit that killed its reader three times runs at half the budget: half the OCR calls a tick may make. */
export const HALF_OCR_INVOCATIONS = Math.floor(OCR_INVOCATIONS_PER_REQUEST / 2);
/* R29, R39, R48: the one pair of bounds for the text-source rows (REC-60/REC-70's ratchet). */
export const TEXT_SOURCE_LIMIT_DEFAULT = 200;
export const TEXT_SOURCE_LIMIT_MAX = 5000;
/* R27: the kept readings a reading's read answers, newest first. */
export const READING_HISTORY_SHOWN = 16;
/* D-454 (R19): past this many occurrences of one reference the rest are the one unplaced occurrence. */
export const OCCURRENCES_PER_REF = 256;

/* R49: the reading tables, keyed to their bundle by `bundle_id`; `capture_text_fts` (external content over
   `capture_text`, kept by triggers) and `composed_readings` (no bundle) whole-store only. `capture_text` is
   declared before its index so the triggers keep the index true on the per-bundle arm. */
export const EXTRACTION_TABLES = Object.freeze(["readings", "reading_refs", "reading_ref_terms", "reading_text_source",
  "reading_history", "capture_text", "capture_text_skipped", "capture_text_state", "reading_repairs",
  "interpretations", "interpretation_withdrawals", "interpreted_content"]);
export const EXTRACTION_WHOLE_ONLY = Object.freeze(["capture_text_fts", "composed_readings"]);
/* R66, R68 (T38; N786): exempt from both purges. A migration's row holds its cutoff; cleared by a whole-store purge, it
   would be taken again at the next start over the readings written since the purge (the history's rowids restart),
   and those, the fixed reader's, would read as made before the fix. After a purge every reading is the fixed reader's,
   so the row's `done` stays true. */
export const EXTRACTION_EXEMPT = Object.freeze(["reading_migrations"]);

/** Whether a purge declaration names one of this module's tables (record-core R21: each owner declares its own). */
export function extractionOwns(t) {
  const name = typeof t === "string" ? t : t && t.name;
  return EXTRACTION_TABLES.includes(name) || EXTRACTION_WHOLE_ONLY.includes(name) || EXTRACTION_EXEMPT.includes(name);
}

/* Columns added after a store was first written (additive, nullable; run before and after the schema, REC-143). */
const ADDITIVE_COLUMNS = [
  ["reading_text_source", "calibrations", "TEXT"],
  ["reading_refs", "pos_kind", "TEXT"], ["reading_refs", "pos", "TEXT"], ["reading_refs", "pos_ref", "TEXT"],
  ["readings", "capture_format", "TEXT"],
  ["readings", "origin", "TEXT"], ["readings", "asserted_by", "TEXT"], ["readings", "asserted_standing", "TEXT"],
  ["readings", "justification", "TEXT"],
  /* R82 (F12): the candidates a migration could not read yet, and the once-only scan again for a migration that finished before. */
  ["reading_migrations", "retry", "TEXT"], ["reading_migrations", "rescan", "INTEGER"],
  /* R110 (fix round 10, cause 39b): what each run found, by shape, kept across runs (JSON object of counts) so a read-only answer can state it. */
  ["reading_migrations", "counts", "TEXT"],
  /* R90 (fix round 6, G13): a text read in pieces states how far it has been read; a store that holds none of it states none. */
  ["capture_text_state", "more", "INTEGER NOT NULL DEFAULT 0"], ["capture_text_state", "cursor", "TEXT"],
  ["capture_text_state", "read_through", "INTEGER"], ["capture_text_state", "total", "INTEGER"],
  ["capture_text_state", "words_read", "INTEGER"],
  /* R101 (fix round 9, G129b): why a read in pieces ended before its last piece (a deterministic failure, a refused cursor), so it is never `partial`
     without a reason; null for a read that ended at its last piece or was never in pieces. */
  ["capture_text_state", "ended_why", "TEXT"],
  /* R101 (K4904 (1)): the windows stepped past because they killed their reader three times, `[{at, why}]` (JSON), stated by `completeness` */
  ["capture_text_state", "stated", "TEXT"],
  /* R107 (fix round 9, G134d, G128h): a unit's kind (reading-pipeline R47's closed list; null for a unit stored before, or one no reader named), a
     sheet block's row of each line (`lineRows`, JSON) and its cells' `undetermined` list (JSON); null when the unit carries none */
  ["capture_text", "kind", "TEXT"], ["capture_text", "line_rows", "TEXT"], ["capture_text", "undetermined", "TEXT"],
  /* R105 (b) (fix round 9, G128j): the shape of reading the writer that stored it wrote (READING_SHAPE); null for a reading stored before */
  ["readings", "reading_shape", "INTEGER"],
];
/* R99 (fix round 9, G128; plan 2c item 1): batch idempotence, `(sha, kind, batch)`, the table the plan names beside the job row. Created here, with the
   plan's columns, until plane-2's job table lands it (the same statement, IF NOT EXISTS). */
const JOB_BATCHES_DDL = `CREATE TABLE IF NOT EXISTS job_batches (sha TEXT NOT NULL, kind TEXT NOT NULL, batch TEXT NOT NULL, landed_at TEXT NOT NULL,
                                                         PRIMARY KEY (sha, kind, batch))`;

/* ---- REC-36 / REC-40: the name terms (R19, R37), and the term fold (R59, N108): `reading_ref_terms.term` is exactly
   `labelTerms` of its source string, so a module matching a name against it folds with these two. ---- */

/* R58 (N108): the read contract. `readings` (capture_sha, bundle_id, content_type), `reading_refs` (capture_sha,
   bundle_id, ref, ref_kind, ref_key, label, pos_kind, pos, pos_ref, occurrence, seq), `reading_ref_terms`
   (capture_sha, bundle_id, ref, src, term), `capture_text_skipped` (capture_sha, bundle_id, first_seq, last_seq,
   units, first_extent, first_ref, last_extent, last_ref, side), `reading_text_source` (capture_sha, chain) and (T42,
   N839) `capture_text` (capture_sha, bundle_id, extent, seq, text, truncated; `case-account` reads it) may be joined
   by a later module in its own SQL; their names and meaning change only with that requirement, and every write stays
   here. */

/* The case-folded, whitespace-collapsed form the alias reverse index keys on. `entities`' alias index must fold
   identically or the join between them silently stops matching, so it reads these through `labelTerms`. */
export function normAlias(s) {
  return String(s ?? "").trim().replace(/\s+/g, " ").toLowerCase().slice(0, 200);
}
/* The TERMS of a name or a label: split on non-letter/non-digit, diacritics NOT folded (a false fold puts a wrong
   subject on a document), capped at 24 (D-36's bound-variable ceiling; the measured maximum is 12). */
export function labelTerms(s) {
  return [...new Set(normAlias(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean))].slice(0, 24);
}
/* REC-40: the three strings a reference carries, strongest first (the recogniser's A, B, C tiers); `key` only
   when it folds to something other than the whole reference. */
export function refTermSources(rr) {
  const ref = rr && rr.ref == null ? "" : String(rr.ref);
  const key = rr && rr.ref_key == null ? "" : String(rr.ref_key);
  const label = rr && rr.label == null ? "" : String(rr.label);
  const out = [];
  if (ref) out.push(["ref", ref]);
  if (key && normAlias(key) !== normAlias(ref)) out.push(["key", key]);
  if (label) out.push(["label", label]);
  return out;
}

/* K104 (R21): the standing an author stamp carries. */
function standingOf(author) {
  const m = contentMintState(author);
  return m === "member_marked" ? "member" : m === "machine_marked" ? "machine" : "plane";
}

/* ---- N26 (R66): the pure half of the migration ---- */

/* The migration's name in `reading_migrations`, the mark its docx layer step carries, and one call's batch. */
export const N26_MIGRATION = "n26-docx";
export const N26_READER_MARK = "N26";
export const N26_BATCH = 50;

const isDocxLayer = (step) => !!step && step.step === "layer" && step.container === "docx";
/** R66: whether a reading's chain carries N26's reader mark on its docx layer step. */
export function n26Marked(reading) {
  const chain = reading && Array.isArray(reading.text_source) ? reading.text_source : null;
  return !!chain && chain.some((s) => isDocxLayer(s) && s.reader === N26_READER_MARK);
}

/** R66: whether `docxRenumbering`'s map (office-readers R28) moves anything: a paragraph, run or table whose number
 *  under N26 differs from the old walk's, or that N26 no longer reads. */
export function renumberingMoves(map) {
  if (!map) return false;
  const same = (a, b) => !!a && !!b && a.para === b.para && a.run === b.run;
  return (map.paragraphs || []).some((p) => p && p.new !== p.old)
      || (map.runs || []).some((r) => r && !same(r.old, r.new))
      || (map.tables || []).some((t) => t && t.new !== t.old);
}

/** R66: a reading made before N26, migrated. `map` is `docxRenumbering` over the stored `word/document.xml`, `text`
 *  the docx entry's N26 text over the same bytes (R1, reading-pipeline R2). Every reference the reading holds is moved: a `doc-para`
 *  `para` (and its `ref` `¶<n+1>`) to `paragraphs[old].new`, one in a branch not read to `paragraphs[old].outer` as
 *  a whole paragraph with no run, or unplaced (null) when `outer` is null; a `run` by `runs[i]` the same way; a
 *  `doc-table` `table` (and its `ref` `table <n+1>`) to `tables[old].new`, unplaced when null; a `#para=` anchor's
 *  target with its paragraph. The paragraph count and the table list follow the N26 walk (the tables N26 reads, in its
 *  order), and the text counts are the N26 text's (reading-pipeline R17): the duplicated branch is lost and nothing is gained. The
 *  docx layer step gains `reader: "N26"` and the reading `migrated.n26`, saying what moved. It re-grades nothing (R44)
 *  and resolves nothing (R46). Pure; the reading handed in is not changed. */
export function n26MigratedReading(reading, map, text, { at = null } = {}) {
  const moved = { paragraphs: 0, runs: 0, tables: 0, unplaced: 0 };
  const runAt = new Map((map.runs || []).map((r) => [`${r.old.para}:${r.old.run}`, r]));
  /* A whole paragraph, no run: `run` null where the position carried the key (`readingSource`'s shape), else absent. */
  const paraRef = (para, v) => ({ kind: "doc-para", ref: `¶${para + 1}`, para,
                                  ...(Object.prototype.hasOwnProperty.call(v, "run") ? { run: null } : {}) });
  const moveParaRef = (v) => {
    const p = map.paragraphs[v.para];
    if (!p) return v;
    if (Number.isInteger(v.run)) {
      const r = runAt.get(`${v.para}:${v.run}`);
      if (r && r.new) {
        if (r.new.para === v.para && r.new.run === v.run) return v;
        moved.runs++;
        return { ...v, para: r.new.para, run: r.new.run, ref: `¶${r.new.para + 1}` };
      }
      if (r) { moved.runs++; if (r.outer == null) { moved.unplaced++; return null; } return paraRef(r.outer, v); }
    }
    if (p.new != null) {
      if (p.new === v.para) return v;
      moved.paragraphs++;
      return { ...v, para: p.new, ref: `¶${p.new + 1}` };
    }
    moved.paragraphs++;
    if (p.outer == null) { moved.unplaced++; return null; }
    return paraRef(p.outer, v);
  };
  const moveTableRef = (v) => {
    const t = map.tables[v.table];
    if (!t || t.new === v.table) return v;
    moved.tables++;
    if (t.new == null) { moved.unplaced++; return null; }
    return { ...v, table: t.new, ref: `table ${t.new + 1}${typeof v.cell === "string" && v.cell ? `, ${v.cell}` : ""}` };
  };
  const isAnchor = (v) => !!v && typeof v === "object" && !Array.isArray(v) && typeof v.fragment === "string"
    && /^#para=[0-9]+$/.test(v.fragment) && Number.isInteger(v.para);
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk);
    if (!v || typeof v !== "object") return v;
    if (v.kind === "doc-para" && Number.isInteger(v.para)) return moveParaRef(v);
    if (v.kind === "doc-table" && Number.isInteger(v.table)) return moveTableRef(v);
    /* An internal link's target (docx R7's anchor partition): `{para, fragment: "#para=<n+1>"}`; the fragment moves
       with its paragraph, and so does the same fragment spelled in a string beside it (the link's `wrapper`). */
    const o = {}, renamed = [];
    for (const [k, x] of Object.entries(v)) {
      o[k] = walk(x);
      if (isAnchor(x) && o[k] && o[k].fragment !== x.fragment && o[k].fragment) renamed.push([x.fragment, o[k].fragment]);
    }
    if (isAnchor(o)) {
      const p = map.paragraphs[o.para];
      const to = !p ? o.para : p.new != null ? p.new : p.outer;
      if (to !== o.para) {
        moved.paragraphs++;
        if (to == null) moved.unplaced++;
        o.para = to ?? null;
        o.fragment = to == null ? null : `#para=${to + 1}`;
      }
    }
    for (const [from, to] of renamed)
      for (const [k, x] of Object.entries(o))
        if (typeof x === "string") o[k] = x.replace(new RegExp(`${from}(?![0-9])`, "g"), to);
    return o;
  };
  /* R70 (N724): a document table's cells, keyed by the table's `ref` (reading-pipeline R28). Each key follows its table
     to `tables[old].new` and each cell's `doc-table` source moves with it; a table N26 no longer reads takes its cells
     with it. The keys are listed in N26's table order. A cell is not a reference the reading names, so it is not
     counted in `moved`. `null` (the body not read) and `{}` (no tables) stay as stored. */
  const moveCells = (cells) => {
    if (!cells || typeof cells !== "object" || Array.isArray(cells)) return cells;
    const counted = { ...moved };
    const keyed = [];
    for (const [key, list] of Object.entries(cells)) {
      const m = /^table ([1-9][0-9]*)$/.exec(key);
      const old = m ? Number(m[1]) - 1 : null;
      const t = old == null ? null : map.tables[old];
      const to = old == null || !t ? old : t.new;
      if (old != null && to == null) continue;
      keyed.push([to, old == null ? key : `table ${to + 1}`, walk(list)]);
    }
    Object.assign(moved, counted);
    keyed.sort((a, b) => (a[0] == null ? (b[0] == null ? 0 : 1) : b[0] == null ? -1 : a[0] - b[0]));
    return Object.fromEntries(keyed.map(([, k, v]) => [k, v]));
  };
  const OWN = new Set(["text_source", "provenance", "container_extent", "basis", "migrated", "cells"]);
  const next = {};
  for (const [k, v] of Object.entries(reading)) next[k] = OWN.has(k) ? v : walk(v);
  if (Object.prototype.hasOwnProperty.call(reading, "cells")) next.cells = moveCells(reading.cells);
  next.text_source = reading.text_source.map((s) => (isDocxLayer(s) ? { ...s, reader: N26_READER_MARK } : s));
  const ce = reading.container_extent;
  if (ce && typeof ce === "object") {
    const paras = Array.isArray(text.paragraphs) ? text.paragraphs : [];
    const c = { ...ce };
    if (Object.prototype.hasOwnProperty.call(ce, "paragraphs")) c.paragraphs = paras.length ? paras.length : null;
    if (Array.isArray(ce.tables))
      c.tables = (map.tables || []).filter((t) => t && t.new != null).sort((a, b) => a.new - b.new)
        .map((t) => ce.tables[t.old]).filter((t) => t !== undefined);
    next.container_extent = c;
  }
  for (const k of ["text_chars", "text_glyphs", "text_undetermined"])
    if (Object.prototype.hasOwnProperty.call(reading, k)) { Object.assign(next, textCountsOf(text)); break; }
  if (Object.prototype.hasOwnProperty.call(reading, "words_total")) Object.assign(next, textWordsFor(text));
  next.migrated = { ...(reading.migrated && typeof reading.migrated === "object" ? reading.migrated : {}),
    n26: { at, moved,
           why: "this reading was made before N26, when every branch of an mc:AlternateContent was read, so its "
              + "paragraphs, runs and tables were numbered with the duplicated branch counted; it was read again "
              + "from the stored bytes and every reference it holds was moved to N26's numbering" } };
  return next;
}

/* ---- N439 (R68): the pure half of the pptx migration ---- */

/* The migration's name in `reading_migrations`, the mark its pptx layer step carries, and one call's batch. */
export const N439_MIGRATION = "n439-pptx";
export const N439_READER_MARK = "N439";
export const N439_BATCH = 50;

const isPptxLayer = (step) => !!step && step.step === "layer" && step.container === "pptx";
/** R68: whether a reading's chain carries N439's reader mark on its pptx layer step. */
export function n439Marked(reading) {
  const chain = reading && Array.isArray(reading.text_source) ? reading.text_source : null;
  return !!chain && chain.some((s) => isPptxLayer(s) && s.reader === N439_READER_MARK);
}

/** R68: whether `pptxRenumbering`'s map (office-readers R29) moves anything: a shape whose index under N439 differs
 *  from the old walk's, or that N439 no longer reads. */
export function pptxRenumberingMoves(map) {
  if (!map || !Array.isArray(map.slides)) return false;
  return map.slides.some((s) => s && Array.isArray(s.shapes) && s.shapes.some((x) => x && x.new !== x.old));
}

/** R68: a reading made before N439, migrated. `map` is `pptxRenumbering` over the stored parts, `text` the pptx
 *  entry's N439 text over the same bytes (R1, reading-pipeline R2). Every `slide-shape` reference carrying a `shape` is moved to its
 *  slide's `shapes[old].new`, unplaced (null) when that is null; one with no `shape` (the slide grain), on a slide
 *  the map does not list or past its shapes stays as it is. Slide numbers do not move. Each slide's shape count in
 *  the container extent follows the N439 walk, and the text counts are the N439 text's (reading-pipeline R17): the duplicated branch is
 *  lost and nothing is gained. The pptx layer step gains `reader: "N439"` and the reading `migrated.n439`, saying
 *  what moved. It re-grades nothing (R44) and resolves nothing (R46). Pure; the reading handed in is not changed. */
export function n439MigratedReading(reading, map, text, { at = null } = {}) {
  const moved = { shapes: 0, unplaced: 0 };
  const bySlide = new Map((map.slides || []).filter((s) => s && Number.isInteger(s.slide)).map((s) => [s.slide, s.shapes || []]));
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk);
    if (!v || typeof v !== "object") return v;
    if (v.kind === "slide-shape" && Number.isInteger(v.slide) && Number.isInteger(v.shape)) {
      const x = (bySlide.get(v.slide) || [])[v.shape];
      if (!x || x.new === v.shape) return v;
      moved.shapes++;
      if (x.new == null) { moved.unplaced++; return null; }
      return { ...v, shape: x.new };
    }
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = walk(x);
    return o;
  };
  const OWN = new Set(["text_source", "provenance", "container_extent", "basis", "migrated"]);
  const next = {};
  for (const [k, v] of Object.entries(reading)) next[k] = OWN.has(k) ? v : walk(v);
  next.text_source = reading.text_source.map((s) => (isPptxLayer(s) ? { ...s, reader: N439_READER_MARK } : s));
  const ce = reading.container_extent;
  if (ce && typeof ce === "object" && Array.isArray(ce.slides)) {
    const now = new Map((Array.isArray(text.slides) ? text.slides : [])
      .filter((s) => s && Number.isInteger(s.slide)).map((s) => [s.slide, s.shapes]));
    next.container_extent = { ...ce, slides: ce.slides.map((s, i) => (s && Number.isInteger(s.shapes) && now.has(i + 1)
      ? { ...s, shapes: Number.isInteger(now.get(i + 1)) ? now.get(i + 1) : null } : s)) };
  }
  for (const k of ["text_chars", "text_glyphs", "text_undetermined"])
    if (Object.prototype.hasOwnProperty.call(reading, k)) { Object.assign(next, textCountsOf(text)); break; }
  if (Object.prototype.hasOwnProperty.call(reading, "words_total")) Object.assign(next, textWordsFor(text));
  next.migrated = { ...(reading.migrated && typeof reading.migrated === "object" ? reading.migrated : {}),
    n439: { at, moved,
            why: "this reading was made before N439, when every branch of an mc:AlternateContent on a slide was read, "
               + "so its slide text was doubled and its shapes were numbered with the duplicated branch counted; it was "
               + "read again from the stored bytes and every shape reference it holds was moved to N439's numbering" } };
  return next;
}

/* R89 (fix round 6, G8): the repair of old "not read as text" readings, its row in `reading_migrations` and one call's batch. */
export const REPAIR_MIGRATION = "r89-repair-not-read";
export const REPAIR_BATCH = 200;
/* R92 (fix round 6, G33): the repair of readings the old press stored against a part's digest, its own row so a store whose R89 repair finished is scanned. */
export const PART_MIGRATION = "g33-part-readings";
/* R105 (a), (c) (fix round 9, G126a, G133a; K4811 (2)): stored readings that owe OCR pages or are an ODS stated too large, re-registered through the
   registrar; its own row, so a store whose R89 repair finished is scanned. */
export const OWED_MIGRATION = "r105-owed-work";
/* R105 (b) (fix round 9, G128j): stored readings in the old shapes, re-registered as reading jobs; its own row. */
export const SHAPE_MIGRATION = "r105-reading-shapes";
/* R120 (T53; N1266; RF10): the held-and-named readings a reader has since arrived for, owed once for each release: its row is named for the release (`r120-held-unread:<VERSION>`),
   so a release whose roster lists more types scans them again, and one that does not changes nothing. */
export const HELD_MIGRATION = "r120-held-unread";

/* R92: every table that keeps a reading against a capture, for the repair that takes a part's reading away. */
const PART_KEPT_IN = Object.freeze(["readings", "reading_history", "reading_refs", "reading_ref_terms", "reading_text_source", "capture_text",
  "capture_text_skipped", "capture_text_state", "reading_repairs"]);

/* R66, R68: the two migrations, run by one machine (`#migrate`): the format they read, how a reading is marked, the
   renumbering map over the entry's parts, whether it moves anything, whether the stored reading states the old walk's
   counts, and the pure migration. */
const MIGRATIONS = Object.freeze({
  [N26_MIGRATION]: Object.freeze({
    name: N26_MIGRATION, format: "docx", key: "n26", marked: n26Marked, isLayer: isDocxLayer,
    renumber: (parts) => docxRenumbering(parts.documentXml), moves: renumberingMoves,
    readable: (text) => Array.isArray(text.paragraphs),
    /* A reading of the old walk states the old walk's paragraph count; one that states the new count is N26's. */
    oldWalk: (reading, map) => {
      const ce = reading.container_extent;
      return !(ce && typeof ce === "object" && Number.isInteger(ce.paragraphs) && ce.paragraphs !== map.paragraphs.length)
        || localize("extraction.index.n26_not_old_walk", "its paragraph count is not the pre-N26 walk's, so it was not read by the old walk");
    },
    migrated: n26MigratedReading,
    after: localize("extraction.index.n26_read_after", "read after N26 (its reading was written after the migration's cutoff)"),
    noLayer: localize("extraction.index.n26_no_layer", "the reading carries no docx text layer to mark, so nothing it holds was read from the paragraphs") }),
  [N439_MIGRATION]: Object.freeze({
    name: N439_MIGRATION, format: "pptx", key: "n439", marked: n439Marked, isLayer: isPptxLayer,
    renumber: (parts) => pptxRenumbering(parts), moves: pptxRenumberingMoves,
    readable: (text) => Array.isArray(text.slides),
    /* A reading of the old walk states each slide's shape count as the old walk counted it. */
    oldWalk: (reading, map) => {
      const sl = reading.container_extent && typeof reading.container_extent === "object" ? reading.container_extent.slides : null;
      if (!Array.isArray(sl)) return true;
      const differs = map.slides.some((s) => Number.isInteger(s.slide) && sl[s.slide - 1]
        && Number.isInteger(sl[s.slide - 1].shapes) && sl[s.slide - 1].shapes !== s.shapes.length);
      return !differs || localize("extraction.index.n439_not_old_walk", "its slides' shape counts are not the pre-N439 walk's, so it was not read by the old walk");
    },
    migrated: n439MigratedReading,
    after: localize("extraction.index.n439_read_after", "read after N439 (its reading was written after the migration's cutoff)"),
    noLayer: localize("extraction.index.n439_no_layer", "the reading carries no pptx text layer to mark, so nothing it holds was read from the slides") }),
});

const instances = new WeakMap();

/* R82 (F4): reading-pipeline R37's mark. A failed reading that carries it failed for a cause outside the document. */
const failedTransiently = (r) => !!r && r.found === false && r.failure === "transient"
  && !(Array.isArray(r.entities) && r.entities.length);
/* (fix round 5, E1) reading-pipeline's sentence for a document it did not read as text, in either of its two causes. */
const notReadAsText = (r) => !!r && r.found === false && r.failure === "final" && typeof r.basis === "string"
  && !(Array.isArray(r.entities) && r.entities.length)
  && [localize("reading-pipeline.index.multipart", "multipart"),
      localize("reading-pipeline.index.non_textual_large", "non-textual or too large")]
       .some((why) => r.basis === localize("reading-pipeline.index.document_not_read_text", "the document was not read as text ({why}), so no reading was attempted", { why }));
/* (fix round 6, G13; R90) reading-pipeline's R40 answer of a piece, as the index state keeps it: `more` while pieces follow, the `cursor` of
   the next (its own object, kept as JSON), how far the text is read (`chars_through` of `chars_total`) and the piece's words; null for a read
   that is not in pieces (every other read). */
const pieceOf = (out) => (out && typeof out.more === "boolean"
  ? { more: out.more, cursor: typeof out.cursor === "string" ? out.cursor : typeof out.next === "string" ? out.next : null, read_through: out.read_through ?? null,
      total: out.total ?? null, words: out.piece && Number.isFinite(out.piece.words) ? out.piece.words : 0 } : null);
/* (fix round 6, G13; R90) a reading whose units came from a text (reading-pipeline R32, R33): the only kind read in pieces. */
const textReading = (r) => !!r && typeof r === "object";
/* R82 (F9): the author the ledger's own continuation of a re-read is stamped with. */
const PLANE_AUTHOR = "plane:pending-work";

/* A Durable Object's own state (the composition root's `ctx`), as against a test's `{storage}` stand-in: what the
   object composes, `provenance` (R65) and the N26 and N439 migrations' background run (R66, R68), is reached only on one. */
const isObjectState = (ctx) => !!ctx && typeof ctx.blockConcurrencyWhile === "function";

/** K61: the one Extraction for this object's storage. `opts` is read on the first call only: `env` (the object's
 *  bindings: PDF_WORKER, OCR_WORKER, VERSION), `record` (`recordOf(ctx)`), `membership` (`membershipOf(ctx)`),
 *  `calibration` (`calibrationOf(ctx)`: its R10–R12), `promotion` (whose `registerStep`
 *  this module's projection joins, R20), `provenance` (whose testimony slot its index joins, R65: `provenanceOf(ctx)`
 *  on a Durable Object's state, which composes provenance before this module) and `host` (the state whose
 *  `waitUntil` carries R66's and R68's run). A test may pass its own. The first call registers this module's figures (R67). */
export function extractionOf(ctx, opts = {}) {
  const storage = ctx && ctx.storage ? ctx.storage : ctx;
  let x = instances.get(storage);
  if (!x) {
    const record = opts.record ?? recordOf(ctx);
    x = new Extraction(storage, { ...opts, record, membership: opts.membership ?? membershipOf(ctx, { record }),
                                  calibration: opts.calibration ?? calibrationOf(ctx, { record }),
                                  provenance: opts.provenance ?? (isObjectState(ctx) ? provenanceOf(ctx) : null),
                                  host: opts.host ?? (isObjectState(ctx) ? ctx : null) });
    instances.set(storage, x);
    x.registerFigures();
  }
  return x;
}

export class Extraction {
  #sql; #storage; #listeners = []; #indexListeners = []; #declared = false; #stepped = false; #calListening = false;
  #testified = false; #counted = false; #host = null; #provenance = null; #migrationRun = null; #readHooks = null; #transcriber = null; #serials = new WeakMap();
  #owe = null; #repairRun = null; #reader = readDocument; #interpreter = null; #ceiling; #heldAs = null;

  constructor(storage, { record, membership = null, calibration = null, promotion = null, provenance = null, host = null,
                         env = {}, readHooks = null, reader = null, interpreter = null, interpretationCeiling = undefined } = {}) {
    /* the reader (reading-pipeline's `read`); a test hands a stand-in of its contract where the real one has not merged (R-SEAM) */
    this.#reader = typeof reader === "function" ? reader : readDocument;
    /* R114, R119: reading-pipeline's `interpretUnits` (a test hands a stand-in of its contract where the real one has not merged, as `reader` is) and the
       team's interpretation ceiling (a number, or a function answering one; absent, the service level's, which is none until PLATFORM records it) */
    this.#interpreter = typeof interpreter === "function" ? interpreter : null;
    this.#ceiling = interpretationCeiling;
    this.#storage = storage;
    this.#sql = storage.sql;
    this.#host = host;
    this.#readHooks = readHooks && typeof readHooks.afterRead === "function" ? readHooks : null;
    this.core = record;
    this.membership = membership;
    this.calibration = calibration;
    this.env = env || {};
    this.#provenance = provenance;
    if (promotion) this.joinPromotion(promotion);
    if (calibration) this.listenToCalibration(calibration);
    if (provenance) this.joinTestimony(provenance);
  }

  #rows(q, ...a) { return [...this.#sql.exec(q, ...a)]; }
  #one(q, ...a) { const r = this.#rows(q, ...a); return r.length ? r[0] : null; }
  #cols(t) { return this.#rows(`PRAGMA table_info(${t})`).map((r) => r.name); }

  /* The viewer gate (membership R43): whether a viewer may see a bundle, and a redactor that withholds the ids a
     viewer may not see (K57: the small helper copied, the predicate membership's). */
  #sees(bundleId, viewer) {
    if (this.membership && typeof this.membership.inSight === "function") return this.membership.inSight(bundleId, viewer);
    const g = viewerPredicate(viewer);
    return !!bundleId && !!this.#one(`SELECT 1 AS x FROM bundles b WHERE b.bundle_id=? AND (${g.sql})`, bundleId, ...g.args);
  }
  #redactor(viewer) {
    const gate = viewerPredicate(viewer);
    if (gate.scope === "member") return (id) => id ?? null;
    if (gate.scope === "DENY") return (id) => (id ? null : id ?? null);
    const memo = new Map();
    return (id) => {
      if (!id) return id ?? null;
      if (!memo.has(id))
        memo.set(id, !!this.#one(`SELECT 1 AS x FROM bundles b WHERE b.bundle_id=? AND (${gate.sql})`, id, ...gate.args));
      return memo.get(id) ? id : null;
    };
  }

  /* ---- boot (layers.md ruling 3) ---- */

  /** This module's tables at every boot, idempotent and in the order the legacy store ran them: the derived
   *  `reading_ref_terms` dropped when it lacks `src` (REC-40: its key changed); `reading_refs` renamed out of the
   *  way when it lacks `occurrence` (D-454: every row kept, copied forward after the schema), its two indexes
   *  dropped with it; the additive columns before and after the schema (REC-143); the full-text index and its
   *  triggers; the purge declaration (R49); and the bounded name-term backfill (R37). */
  migrate() {
    { const c = this.#cols("reading_ref_terms"); if (c.length && !c.includes("src")) this.#sql.exec(`DROP TABLE reading_ref_terms`); }
    {
      const c = this.#cols("reading_refs");
      if (c.length && !c.includes("occurrence")) {
        this.#sql.exec(`ALTER TABLE reading_refs RENAME TO reading_refs_preoccurrence`);
        this.#sql.exec(`DROP INDEX IF EXISTS reading_refs_ref`);
        this.#sql.exec(`DROP INDEX IF EXISTS reading_refs_bundle`);
      }
    }
    const addColumns = () => {
      for (const [table, column, decl] of ADDITIVE_COLUMNS) {
        const have = this.#cols(table);
        if (have.length && !have.includes(column)) this.#sql.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
      }
    };
    addColumns();
    const bare = EXTRACTION_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    for (const st of bare.split(";")) { const t = st.trim(); if (t) this.#sql.exec(t); }
    {
      const old = this.#cols("reading_refs_preoccurrence");
      if (old.length) {
        const col = (c) => (old.includes(c) ? c : "NULL");
        this.#sql.exec(
          `INSERT OR IGNORE INTO reading_refs
             (capture_sha,bundle_id,ref,ref_kind,ref_key,label,pos_kind,pos,pos_ref,occurrence,seq)
           SELECT capture_sha, bundle_id, ref, ${col("ref_kind")}, ${col("ref_key")}, ${col("label")},
                  ${col("pos_kind")}, ${col("pos")}, ${col("pos_ref")},
                  CASE WHEN ${col("pos_kind")} IS NOT NULL AND ${col("pos")} IS NOT NULL
                       THEN ${col("pos_kind")} || ':' || ${col("pos")} ELSE '' END, 0
             FROM reading_refs_preoccurrence`);
        this.#sql.exec(`DROP TABLE reading_refs_preoccurrence`);
      }
    }
    addColumns();
    this.#sql.exec(JOB_BATCHES_DDL);
    /* REC-91: the text index is EXTERNAL CONTENT over `capture_text`, rowid aligned, kept by triggers (a plain
       `DELETE FROM capture_text_fts` answers SQLITE_CORRUPT_VTAB on workerd, measured). `INSERT OR REPLACE` into
       `capture_text` fires no delete trigger, so the writer deletes and plainly inserts (R22). Here and not in the
       schema text because a trigger carries `;` inside BEGIN/END. */
    this.#sql.exec(
      `CREATE VIRTUAL TABLE IF NOT EXISTS capture_text_fts USING fts5(
         text, content='capture_text', content_rowid='rowid', tokenize='unicode61')`);
    this.#sql.exec(
      `CREATE TRIGGER IF NOT EXISTS capture_text_ai AFTER INSERT ON capture_text BEGIN
         INSERT INTO capture_text_fts(rowid, text) VALUES (new.rowid, new.text);
       END`);
    this.#sql.exec(
      `CREATE TRIGGER IF NOT EXISTS capture_text_ad AFTER DELETE ON capture_text BEGIN
         INSERT INTO capture_text_fts(capture_text_fts, rowid, text)
           VALUES ('delete', old.rowid, old.text);
       END`);
    this.#sql.exec(
      `CREATE TRIGGER IF NOT EXISTS capture_text_au AFTER UPDATE ON capture_text BEGIN
         INSERT INTO capture_text_fts(capture_text_fts, rowid, text)
           VALUES ('delete', old.rowid, old.text);
         INSERT INTO capture_text_fts(rowid, text) VALUES (new.rowid, new.text);
       END`);
    this.declareTables();
    this.#backfillRefTerms(500);
    this.startMigrations();
  }

  /** R49: the reading tables declared to record-core's purge, keyed to their bundle; two whole-store only; the
   *  migrations' row exempt (R66, R68). */
  declareTables() {
    if (this.#declared || !this.core || typeof this.core.declarePurge !== "function") return false;
    const answer = this.core.declarePurge("extraction",
      [...EXTRACTION_TABLES, ...EXTRACTION_WHOLE_ONLY.map((name) => ({ name, keys: [] }))], { exempt: [...EXTRACTION_EXEMPT] });
    if (answer && answer.ok === false)
      throw new Error(`extraction: record-core refused its purge declaration: ${answer.reason} (${answer.table})`);
    this.#declared = true;
    return true;
  }

  /* ---- registrations (R20, R24, R40) ---- */

  /** R20 (K31): joins every promotion through promotion's `registerStep` (its R39): the projection below runs in
   *  the promotion's transaction, in the modules' order. */
  joinPromotion(promotion) {
    if (this.#stepped || !promotion || typeof promotion.registerStep !== "function") return false;
    const r = promotion.registerStep("extraction", { project: (c) => this.projectPromotion(c) });
    this.#stepped = !(r && r.ok === false);
    return this.#stepped;
  }

  /** R65 (provenance R52, K763): the testimony path's index, registered once in provenance's testimony slot as a
   *  projection. The slot runs it inside the promotion's transaction, in the modules' order, over the path's own
   *  fields: `indexTestimony` (R61) over the words, answering `{indexed}`, R61's `written`. Its R62 notice runs as R61
   *  states, and a throw from it is not caught, so the whole promotion rolls back. */
  joinTestimony(provenance) {
    if (this.#testified || !provenance || typeof provenance.onTestimony !== "function") return false;
    const r = provenance.onTestimony("extraction", {
      project: (t) => ({ indexed: this.indexTestimony({ bundleId: t.bundleId, captureSha: t.captureSha, words: t.words,
                                                        author: t.author }).written }) });
    this.#testified = !(r && r.ok === false);
    return this.#testified;
  }

  /** R67 (record-core R63): this module's figures for `op=stats` and purge's proof, registered once per storage. A
   *  record with no seam (a test's stand-in) is left alone; a refusal (another module reporting `textUnits`, or this
   *  module registering twice) is a defect of the wiring and throws, as the purge declaration's does. */
  registerFigures() {
    if (this.#counted || !this.core || typeof this.core.registerCounts !== "function") return false;
    const answer = this.core.registerCounts("extraction", [...Extraction.COUNT_KEYS], (hid) => this.counts(hid));
    if (answer && answer.ok === false)
      throw new Error(`extraction: record-core refused its figures: ${answer.reason}${answer.heldBy ? ` (held by ${answer.heldBy})` : ""}`);
    this.#counted = true;
    return true;
  }

  /** R40: registered with `calibration.onCalibration` (R12 there). */
  listenToCalibration(calibration) {
    this.calibration = calibration || this.calibration;
    if (this.#calListening || !calibration || typeof calibration.onCalibration !== "function") return false;
    const r = calibration.onCalibration("extraction", (e) => this.obligationsFor(e));
    this.#calListening = !(r && r.ok === false);
    return this.#calListening;
  }

  /** R24: a later module registers once, a malformed or repeated registration refused by membership's
   *  `listenerRefusal` (its R81, N202: the one site of LISTENER_MALFORMED and LISTENER_DECLARED); its function runs
   *  after each write, in the same transaction, in `MODULE_ORDER` (membership R83) whatever order they registered
   *  in, with `unitsBefore` (the capture's indexed units before the write, null when never indexed), and a throw
   *  fails the whole write. */
  onReading(module, fn) { return this.#register(this.#listeners, module, fn); }

  /** R62 (N294): the index notice, registered as R24's are, raised after each `indexTestimony` write (R61) and
   *  never by R19's writer, whose index outcome reaches its listeners as R24's `indexed`. */
  onIndexed(module, fn) { return this.#register(this.#indexListeners, module, fn); }

  #register(list, module, fn) {
    const refused = listenerRefusal(list, module, fn);
    if (refused) return refused;
    const i = MODULE_ORDER.indexOf(module);
    list.push({ module, fn, rank: i === -1 ? Infinity : i, seq: list.length });
    list.sort((a, b) => (a.rank - b.rank) || (a.seq - b.seq));
    return { ok: true, module };
  }

  /* ---- reading (R1, R18) ---- */

  /** R1, R18: reads a stored capture (`reading-pipeline.read`, its R24) with this object's evidence store, bindings and the
   *  instance's jurisdiction view (R18), and records the digest of the reading it composed (R21). */
  async read(document, { storeName = "bio", env = null, budget = undefined, pieces = undefined, ocrInvocations = 0, registrar = null, killedPages = null,
                         skipKilled = false, stampUnit = null, run = false } = {}) {
    const e = env || this.env || {};
    /* R122: a ledger run is held to READ_RUN_UNITS_MAX units and READ_RUN_BYTES_MAX bytes of text, the rest being the next tick's */
    if (run === true && pieces !== undefined) budget = READ_RUN_BYTES_MAX;
    /* R113: a register segment is handed to no reader and no reading is made */
    const asRegister = this.#heldAsRegister(document && document.capture && document.capture.sha256);
    if (asRegister) return { reading: null, held_as_register: asRegister };
    const out = await this.#reader(document, {
      /* (fix round 9, K4904 (1); plan 2c item 8) the window at this cursor killed its reader three times: the reader steps past it, stated */
      ...(skipKilled === true ? { skipKilled: true } : {}),
      /* (fix round 9, G126b; R103; reading-pipeline R55; K4811 (6)) a member's request makes no OCR call: the pages are left, owed below; only the
         ledger's tick (`readHeld` with a kind) hands `null`, the pipeline's own budget */
      ...(Number.isInteger(ocrInvocations) ? { ocrInvocations } : {}),
      /* (fix round 9, G129c; R101) the pages the ledger states killed their reader three times: not asked, stated `PAGE_KILLED_READER` */
      ...(Array.isArray(killedPages) && killedPages.length ? { killedPages } : {}),
      /* (fix round 9, G165; R109) the plane's `stampUnit`, handed to the reader as it was given */
      ...(typeof stampUnit === "function" ? { stampUnit } : {}),
      evidence: this.#evidenceOf(document && document.capture && document.capture.sha256),
      env: e, storeName, view: this.view(), planeVersion: e.VERSION || null,
      liveCalibration: (q) => this.#liveCalibration(q), ...(budget === undefined ? {} : { unitsBudget: budget }),
      ...(pieces === undefined ? {} : { cursor: pieces.cursor ?? null,
        /* (fix round 10, cause 24 (b); R111) the first piece lands inside the reading's own transaction, which cannot give the turn back between batches:
           of a capture past the first tick's budget (it cannot be read at once) it offers one batch, and the pieces that follow, landed by
           `indexUnitsYielding`, read the rest; a capture within the budget is read at once, as R90 states */
        maxUnits: (pieces.cursor ?? null) === null && (this.#sizeOf(document) ?? 0) > CAPTURE_TEXT_CAPTURE_BOUND ? LAND_BATCH_UNITS
          : run === true ? READ_RUN_UNITS_MAX : CAPTURE_TEXT_CAPTURE_UNIT_BOUND }) });
    /* (fix round 9, G128c; reading-pipeline R57) the first piece of a PDF read in ranges states what the whole file's reading states, so far as its pieces
       can: the glyphs of the text it carries, and, when it is also the last, the document's words; a later piece completes them (`#continueText`) */
    if (pieces !== undefined && out && out.reading && typeof out.reading === "object") completeFirstPiece(out);
    this.recordComposed(out.reading, document && document.capture && document.capture.sha256);
    /* (fix round 9, G126a; R102) the OCR pages this read left are owed before it answers, through the registrar (`registrar` false: the caller owes
       them in its own write, as `readHeld` does) */
    if (registrar !== false) {
      const entry = this.#ocrEntry(document && document.capture && document.capture.sha256, out.reading, null, out.text_units);
      if (entry) {
        const via = this.#oweVia(registrar);
        const a = await via.owe(entry);
        await via.arm();
        out.owed = owedAnswer(entry, a);
      }
    }
    return out;
  }

  /** (fix round 9, G126a; R102) The `ocr` job a reading owes: `{kind: "ocr", sha, cursor, pages_left}` from its `ocr_left` (reading-pipeline R37: the first
   *  page owed and how many), only while pages remain; null when none does or the digest is no digest. */
  #ocrEntry(sha, reading, units = null, piece = null) {
    const left = reading && typeof reading === "object" ? reading.ocr_left : null;
    if (typeof sha !== "string" || !/^[0-9a-f]{64}$/.test(sha)) return null;
    if (left && Number.isInteger(left.pages) && left.pages > 0)
      return { kind: "ocr", sha, cursor: Number.isInteger(left.cursor) ? left.cursor : null, pages_left: this.#documentUnread(sha, reading, piece, left.pages) };
    /* (fix round 9, R100, R102) a reading still wanting OCR (`tier3_candidate`) that states no `ocr_left` (a member that answered some of the pages asked and
       named no rest) owes the pages its units leave without a glyph, less those refused: never left unowed while completeness counts them owed */
    const n = reading && reading.tier3_candidate === true && Number.isInteger(reading.page_count) && reading.page_count > 0 ? reading.page_count : 0;
    if (!n || !Array.isArray(units)) return null;
    const read = new Set(units.filter((u) => u && u.extent && u.extent.kind === "pdf-page" && glyphCount(u.text || "") > 0).map((u) => u.extent.page));
    const refused = new Set((Array.isArray(reading.ocr_refused) ? reading.ocr_refused : []).map((r) => r && r.page));
    const pages = Array.from({ length: n }, (_, p) => p).filter((p) => !read.has(p) && !refused.has(p));
    return pages.length ? { kind: "ocr", sha, cursor: pages[0], pages_left: pages.length } : null;
  }

  /** (fix round 10, cause 10; R102) The document's unread page count: its pages not yet in the text index, whatever piece is being read (`ocr_left.pages` is
   *  the piece's count, reading-pipeline R37). The stored index's pages with a glyph and the pages of the piece about to land (`piece`, its units) are read;
   *  the pages refused are not owed. It is the figure `#pagesLeft` gives the press. `fallback` (the piece's own count) stands when the reading names no
   *  page count. */
  #documentUnread(sha, reading, piece, fallback) {
    /* a later piece's facts reading states no page count: the stored reading's stands */
    const stored = reading && Number.isInteger(reading.page_count) ? null : this.#one(`SELECT json_extract(reading, '$.page_count') AS pc FROM readings WHERE capture_sha=? AND json_valid(reading)`, sha);
    const count = reading && Number.isInteger(reading.page_count) ? reading.page_count : stored ? stored.pc : null;
    const n = Number.isInteger(count) && count > 0 ? count : null;
    if (n === null) return fallback;
    const landing = new Set((Array.isArray(piece) ? piece : []).filter((u) => u && u.extent && u.extent.kind === "pdf-page" && glyphCount(u.text || "") > 0).map((u) => u.extent.page));
    const refused = new Set((Array.isArray(reading.ocr_refused) ? reading.ocr_refused : []).map((r) => r && r.page));
    const unread = this.#unreadPagesOf(sha, n).filter((p) => !landing.has(p) && !refused.has(p)).length;
    return Math.max(unread, fallback);
  }

  /** (fix round 9, G126a; R102; BOB's K4898) The registrar a write owes work through: the `registerJob` the ledger's call hands (`call.registerJob`,
   *  synchronous, its row written in the caller's transaction, `call.armJobs` after the commit), else the composition's `registerOwe` hook (which the
   *  plane hands `pending.registerJob`). `owe(entry)` answers the registrar's `{ok, ...}` (a promise only when the hook is asynchronous) and never
   *  throws: a throw is `{ok: false, reason}`, no registrar `{ok: false, reason: "NO_REGISTRAR"}`, so a refusal is reported and never swallowed. */
  #oweVia(call = null) {
    const fn = call && typeof call.registerJob === "function" ? call.registerJob : typeof this.#owe === "function" ? this.#owe : null;
    let wrote = false;
    const fail = (e) => ({ ok: false, reason: String(e && e.message ? e.message : e).slice(0, 120) || "REGISTRAR_THREW" });
    const settle = (a) => { if (a && a.ok === true) wrote = true; return a && typeof a === "object" ? a : { ok: false, reason: "REGISTRAR_NO_ANSWER" }; };
    const owe = (entry) => {
      if (!fn) return { ok: false, reason: "NO_REGISTRAR" };
      let a;
      try { a = fn(entry); } catch (e) { return fail(e); }
      return a && typeof a.then === "function" ? a.then(settle, fail) : settle(a);
    };
    const arm = async () => { if (wrote && call && typeof call.armJobs === "function") { try { await call.armJobs(); } catch { /* the next alarm arms it */ } } };
    return { owe, arm };
  }

  /** R18: `jurisdictions.combine` of record-core's `jurisdiction_profiles`, never a default. An instance that names
   *  no profile, or profiles that do not combine, reads under the empty view (`combine([])`), which is a view: handed
   *  none, docprofile's readers would fall back to every held profile (K39), a default R18 forbids. */
  view() {
    const ids = this.core && typeof this.core.getSetting === "function" ? this.core.getSetting("jurisdiction_profiles") : null;
    const c = Array.isArray(ids) ? combine(ids) : null;
    return c && c.ok ? c.view : combine([]).view;
  }

  async #liveCalibration(q) {
    const c = this.calibration;
    if (!c || typeof c.liveCalibration !== "function") return null;
    try { return await c.liveCalibration(q); } catch { return null; }
  }

  /** R21: this instance composed the reading whose JSON digests to this. (fix round 6, G40; R95) The JSON and its digest are made here once and
   *  kept for this object, so `writeReading` of the same object (the write of `readHeld`) takes them for the row, the history and both digests
   *  instead of making them again. */
  recordComposed(reading, captureSha) {
    if (!reading || typeof reading !== "object") return null;
    const { digest } = this.#serialOf(reading);
    this.#sql.exec(`INSERT OR IGNORE INTO composed_readings (reading_sha256, capture_sha, at) VALUES (?,?,?)`,
                   digest, typeof captureSha === "string" ? captureSha : "", stampInstant("second"));
    return digest;
  }
  #composedHere(digest) {
    return !!this.#one(`SELECT 1 AS x FROM composed_readings WHERE reading_sha256=?`, digest);
  }

  /** (fix round 6, G40; R95) `{json, digest}` of a reading object: what `JSON.stringify` makes of it and the digest of that text. With `take`, an
   *  entry `recordComposed` made for this very object is used once and forgotten (the writer consumes it before any listener can touch the
   *  object, so it is never reused after the object could have changed); a reading nobody recorded is serialised once for the write. A
   *  reading the caller changed between `recordComposed` and the write is not a case here: the write of `readHeld` hands on `out.reading`
   *  untouched, and `projectPromotion`'s parsed documents are never recorded. */
  #serialOf(reading, { take = false } = {}) {
    const kept = this.#serials.get(reading);
    if (kept) { if (take) this.#serials.delete(reading); return kept; }
    const json = JSON.stringify(reading);
    const made = { json, digest: sha256HexSync(json) };
    if (!take) this.#serials.set(reading, made);
    return made;
  }

  /* ---- reading a held home (R80) ---- */

  /** R80 (T51 fix round 3, C5; K4356, K4358; amends R20, R27; provenance R4; control-plane R117): an in-process act the
   *  door calls, and (fix round 4, N5; K4429) `op=readheld`. A home the register names (`provenance.homeOf`) that has no
   *  `readings` row is read once the evidence store holds the object under the digest, whole: the stored document is read
   *  as R1 and `read` do, and the reading written for that bundle by R19's writer, in one transaction with the history and
   *  the index, as a composed reading of this instance. Otherwise nothing is written and the answer is
   *  `{ok: true, read: false, why}`, `why` a stable code: `NO_HOME` (neither the register nor a reading held for the digest names a home bundle, the digest is no digest, or
   *  `viewer` is given and may not see the home bundle: an absent record), `READING_HELD` (a reading is already held) or
   *  `NO_WHOLE_OBJECT` (the store holds no object under the digest). It writes no bundle, no register row and no
   *  promotion, and replaces no reading but two kinds (fix round 4, C5b; K4429; fix round 4b, F4; K4487; R82): a failed
   *  reading that failed for want of the whole bytes (`#wantedTheWhole`: a capture of several parts the reader could not
   *  assemble), and a failed reading that carries `failure: "transient"` (reading-pipeline R37: the store, a member or an
   *  entry failed, not the document), are replaced, in the same transaction, when the stored reading is still the one
   *  examined. A reading with text, a failed reading marked `final` and one with no mark are never replaced, so a second
   *  call changes nothing. `viewer` is the door's stamp for the member's op; a caller that gives none (the door's own call
   *  after a capture) is not a viewer and is not gated. A reading that finds nothing is a failed reading, recorded (R45).
   *  (R82, F8) Every unit the text holds is offered to the index, which keeps its own bound (R22); only the acquire answer
   *  carries the wire's budget. The answer carries `owed: true` when work remains for the digest: the reading just written
   *  failed transiently, or pages of a scan are still unread and an OCR member is bound to read them. (R82, F9) With
   *  `kind: "ocr"` the stored reading's unread pages are asked of the OCR member, those the stored units do not hold, and the
   *  re-read is written as a composed reading; a member that is down leaves the entry owed, pages it declines end it. */
  async readHeld({ sha = null, storeName = "bio", env = null, viewer = undefined, kind = null, defer = false, registerJob = null, armJobs = null,
                   killedPages = null, killedCursor = null, detail = null, halfBudgetPages = null, stampUnit = null } = {}) {
    /* (fix round 9, G165; R109; plan 2c item 10) the pages the plane names killed twice are read at half the budget (plane R97's `halfBudgetPages`); the
       plane's `stampUnit` goes to the reader unchanged, which calls it before each unit's member call */
    const halved = Array.isArray(halfBudgetPages) && halfBudgetPages.length > 0;
    const stamp = typeof stampUnit === "function" ? stampUnit : null;
    /* (fix round 9, G126b; R103; K4898) the ledger's tick names its job's kind (and hands the registrar); a call with neither is inside a member's
       request (`op=readheld`, the door's own read after a capture), which makes no OCR call */
    const call = typeof registerJob === "function" ? { registerJob, armJobs } : null;
    const ledger = kind === "reading" || kind === "ocr" || call !== null;
    const digest = typeof sha === "string" ? sha.trim().toLowerCase() : "";
    /* (fix round 9, G127a; R104; K4833) the whole digest is the only key: the register names a capture by its whole, held whole or in parts
       (provenance R74), so `homeOf` of the whole is its home and no part is resolved here. */
    let home = /^[0-9a-f]{64}$/.test(digest) && this.#provenance && typeof this.#provenance.homeOf === "function"
      ? this.#provenance.homeOf(digest) : null;
    /* (fix round 4, C5b; K4440) a reading already held for the digest names its bundle, the home of a capture the register does not yet hold */
    if ((!home || typeof home.bundleId !== "string" || !home.bundleId) && /^[0-9a-f]{64}$/.test(digest)) {
      const mine = this.#one(`SELECT bundle_id FROM readings WHERE capture_sha=?`, digest);
      home = mine && typeof mine.bundle_id === "string" && mine.bundle_id ? { bundleId: mine.bundle_id } : null;
    }
    /* (fix round 9, G168; R80) a held reading answers its own counters `{written, skipped}` (never `owed`: the OCR row's), so the job row learns the units
       the door's read and the passes wrote */
    const left = (why, more = {}) => {
      const c = why === "READING_HELD" ? this.#completenessOf(digest).counters : null;
      return { ok: true, read: false, why, ...(c ? { counters: { written: c.written, skipped: c.skipped } } : {}), ...more };
    };
    if (!home || typeof home.bundleId !== "string" || !home.bundleId) return left("NO_HOME");
    if (viewer !== undefined && !this.#sees(home.bundleId, viewer)) return left("NO_HOME");
    /* R113: a register segment is not read; nothing is written */
    { const reg = this.#heldAsRegister(digest); if (reg) return left("HELD_AS_REGISTER", { held_as_register: reg }); }
    const stored = this.#storedDocument(home.bundleId, digest);
    let document = stored || { capture: { sha256: digest } };
    const held = this.#one(`SELECT reading FROM readings WHERE capture_sha=?`, digest);
    /* (fix round 6, G40; R95) only the stored reading's own facts are read, by SQL: a large stored reading is not parsed to ask whether it failed */
    const heldReading = held ? this.#readingFacts(digest) : null;
    const ocr = kind === "ocr";
    const ev = this.#evidenceOf(digest);
    /* (fix round 5, E1; R-OLD: new data only, older records are repaired by the press) a `final` reading that says the
       document was not read as text is read again once the held bytes now say what they are. */
    const fmt0 = document.profile && document.profile.format && typeof document.profile.format.format === "string"
      ? document.profile.format.format : null;
    /* (T53; R120) a held-and-named reading is read again when its held bytes now detect a LISTED type: the reader has arrived */
    const heldUnread = !!held && !ocr && !!ev && this.#heldUnread(digest, heldReading);
    const repair = heldUnread ? await this.#nowListed(digest)
      : ev && !ocr && (held ? notReadAsText(heldReading) : !fmt0 || fmt0 === "undetermined")
      ? await this.#nowDetected(document, digest, ev) : null;
    /* (T53; R120) a held-and-named reading whose type is still on no list is left as it is, and not owed again under this release (as R89's `reading_repairs`) */
    if (heldUnread && !repair) {
      this.#markRepairTried(home.bundleId, digest, "unlisted");
      return left("READING_HELD", { held_unread: true });
    }
    /* (fix round 6, G13; R90) a held reading of a text read in pieces that has more to read is not held: the next piece is read. */
    if (held && !ocr && stored && this.#moreOf(digest)) {
      if (defer === true) return left("READING_PENDING");
      return this.#continueText({ digest, document, bundleId: home.bundleId, storeName, env: env || this.env || {}, left, call, ledger, killedPages, killedCursor, halved, stamp });
    }
    /* (fix round 6, G8; R89) a "not read as text" reading whose held bytes detect nothing is tried: it stops stating itself repairable. */
    if (held && !ocr && ev && !repair && notReadAsText(heldReading)) this.#markRepairTried(home.bundleId, digest, "undetected");
    if (held && !ocr && !(repair && (notReadAsText(heldReading) || heldUnread)) && !this.#wantedTheWhole(heldReading, document) && !failedTransiently(heldReading)
        && !(heldReading && heldReading.odsTooLarge === true) && !this.#oldShapeOf(digest))
      return left("READING_HELD");
    /* (fix round 6, G6; R88) a digest that no stored document names (a bare stub) is read as no document: it has no parts, size or
       capture instant to read it by, and the reading it would write is stored against a digest that is no document. */
    if (!stored && !ocr) {
      /* a home whose provenance document states none of this digest (the register names it) is given the size the store holds the object
         at, so the reader is handed a document that states its object, never a digest alone (BOB, K4577); with none held it is no document */
      let size = null;
      try { const h = ev ? await ev.head(digest) : null; size = h && Number.isFinite(h.size) && h.size > 0 ? h.size : null; } catch { size = null; }
      if (size === null) return left("NO_DOCUMENT");
      document = { capture: { sha256: digest, bytes: size } };
    }
    /* (fix round 5, E3) a capture over the reading ceiling is stated from its size alone (reading-pipeline R37), so no
       whole is needed to write the statement; one at or under it still needs its whole. */
    const size = this.#sizeOf(document);
    const overCeiling = !ocr && size !== null && size > pipeline.WHOLE_READ_MAX;
    /* (fix round 9, G127d; R104) a capture held in parts is read through `readRange` without waiting for its whole to be kept: `NO_WHOLE_OBJECT` is for
       a capture held neither whole nor in parts (its first byte not readable by its whole digest). */
    if (!overCeiling && !(await this.#heldByWhole(digest))) return left("NO_WHOLE_OBJECT");
    /* (fix round 5, E2/E6; B18) the door's `defer`: after every gate above, a read that will not fit the request is left to
       the ledger, which the door writes; nothing is read. */
    if (defer === true) return left("READING_PENDING");
    const e = env || this.env || {};
    if (ocr) return this.#continueOcr({ digest, heldReading, bundleId: home.bundleId, storeName, env: e, left, call, killedPages, detail, halved, stamp });
    /* (fix round 5, E2) the text units built are those the index keeps: the budget is the index's bound, never `Infinity`. */
    const reader = repair ? { ...document, profile: { ...(document.profile || {}), format: repair } } : document;
    const out = await this.read(reader, { storeName, env, budget: CAPTURE_TEXT_CAPTURE_BOUND, pieces: { cursor: null }, run: ledger,
                                          ocrInvocations: ledger ? (halved === true ? HALF_OCR_INVOCATIONS : null) : 0, registrar: false, killedPages, stampUnit: stamp });
    if (out.refused) return left(out.refused.code);
    if (repair && held && (notReadAsText(out.reading) || (heldUnread && out.reading && out.reading.found === false && out.reading.held_unread))) { this.#markRepairTried(home.bundleId, digest, "still"); return left("READING_HELD"); }
    const prof = reader.profile && typeof reader.profile === "object" ? reader.profile : null;
    /* (fix round 9, G126a; R102) the OCR pages the read left are owed in the same transaction as the reading (the registrar's row commits or rolls back
       with it), before the answer */
    const via = this.#oweVia(call);
    const entry = this.#ocrEntry(digest, out.reading, out.more === true ? null : out.text_units, out.text_units);
    let owing = null;
    const wrote = this.core.transact(() => {
      const now = this.#one(`SELECT reading FROM readings WHERE capture_sha=?`, digest);
      if (now && (!held || now.reading !== held.reading)) return null;
      if (!now && held) return null;
      const w = this.writeReading({ bundleId: home.bundleId, captureSha: digest, reading: out.reading,
        textUnits: Array.isArray(out.text_units) ? out.text_units : null,
        textUnitsOverBound: out.text_units_over_bound, textUnitsSkipped: out.text_units_skipped,
        profileFormat: prof && prof.format && typeof prof.format.format === "string" ? prof.format.format : null,
        composed: true, more: pieceOf(out) });
      if (entry && !w.stated) owing = via.owe(entry);
      return w;
    });
    if (!wrote) return left("READING_HELD");
    const oweAnswer = owing ? owedAnswer(entry, await owing) : null;
    await via.arm();
    await wrote.afterRead;
    /* (fix round 6, G41; R97) a reading too large to keep whole was stored as its small statement: final, owing nothing, and no piece follows */
    if (wrote.stated) return { ok: true, read: true, bundle_id: home.bundleId, found: false, stated: true };
    /* (fix round 9, G172; R82) a reading that ended final (the member refused its page from the header) owes nothing, an OCR member bound or not */
    const owed = failedTransiently(out.reading) || !!entry || (out.reading.tier3_candidate === true && !!e.OCR_WORKER && out.reading.failure !== "final");
    const ow = oweAnswer ? { registration: oweAnswer } : {};
    /* (fix round 6, G13; R90) the first piece of a text that has more: the ledger goes on at once (plane R77: `more`) */
    if (out.more === true) return { ok: true, read: true, bundle_id: home.bundleId, found: out.reading.found === true, more: true,
      detail: { read_through: out.read_through ?? null, total: out.total ?? null }, ...(entry ? { owed: true } : {}), ...ow, ...killedOf(out.reading) };
    return { ok: true, read: true, bundle_id: home.bundleId, found: out.reading.found === true, ...(owed ? { owed: true } : {}), ...ow, ...killedOf(out.reading) };
  }

  /** (fix round 9, G128c; reading-pipeline R57) A later piece's completion of the stored reading of a PDF read in ranges, by SQL (the stored reading is never
   *  parsed whole): `text_glyphs` gains the glyphs of the piece's units; `container_extent.images` gains the placements the piece's answer carries
   *  (`reading.container_extent.images`), `images_why` cleared once one is added; at the last piece `words_total`, when the reading states none, is the
   *  words the pieces read (the index state's `words_read`). A reading that is not a PDF's, or not an object, is left as it is. */
  #completeStored(digest, units, pieceReading, last) {
    const f = this.#one(`SELECT json_extract(reading, '$.text_container') AS tc, json_type(reading, '$.text_glyphs') AS gt, json_type(reading, '$.words_total') AS wt
                           FROM readings WHERE capture_sha=? AND json_valid(reading) AND json_type(reading)='object'`, digest);
    if (!f || f.tc !== "pdf") return;
    const glyphs = (units || []).reduce((n, u) => n + (u && typeof u.text === "string" ? glyphCount(u.text) : 0), 0);
    if (glyphs) this.#sql.exec(`UPDATE readings SET reading=json_set(reading, '$.text_glyphs', COALESCE(json_extract(reading, '$.text_glyphs'), 0) + ?) WHERE capture_sha=?`, glyphs, digest);
    const imgs = pieceReading && pieceReading.container_extent && Array.isArray(pieceReading.container_extent.images) ? pieceReading.container_extent.images : null;
    if (imgs && imgs.length) {
      const had = safeJson((this.#one(`SELECT json_extract(reading, '$.container_extent.images') AS i FROM readings WHERE capture_sha=?`, digest) || {}).i);
      this.#sql.exec(`UPDATE readings SET reading=json_remove(json_set(reading, '$.container_extent.images', json(?)), '$.container_extent.images_why') WHERE capture_sha=?`,
                     JSON.stringify([...(Array.isArray(had) ? had : []), ...imgs]), digest);
    }
    if (last && f.wt !== "integer") {
      const st = this.#one(`SELECT words_read FROM capture_text_state WHERE capture_sha=?`, digest);
      if (st && Number.isInteger(st.words_read)) this.#sql.exec(`UPDATE readings SET reading=json_set(reading, '$.words_total', ?) WHERE capture_sha=?`, st.words_read, digest);
    }
  }

  /** (fix round 6, G13; R90) Whether the capture's text is read in pieces and has more to read: its index state says so. */
  #moreOf(digest) {
    const st = this.#one(`SELECT 1 AS x FROM capture_text_state WHERE capture_sha=? AND more=1`, digest);
    return !!st;
  }

  /** (fix round 6, G13; R90; Bob, K4571: a large text is read whole, in the background, never silently partial) The next piece
   *  of a text read in pieces: reading-pipeline reads from the cursor the index state holds, the piece's units are added to the
   *  capture's (the bound of R22 applying to the piece), and the state moves to the cursor the piece answers. Answers
   *  `{ok: true, read: true, more: true, detail}` while more follows, which the ledger continues at once, one piece a tick;
   *  `{ok: true, read: true}` for the last; `{final: true, why}` when the reader refuses the cursor (the bytes it was made
   *  from are no longer the ones held), which states it and ends the entry. Nothing else about the capture's reading changes. */
  async #continueText({ digest, document, bundleId, storeName, env, left, call = null, ledger = false, killedPages = null, killedCursor = null, halved = false, stamp = null }) {
    const st = this.#one(`SELECT cursor, read_through, total FROM capture_text_state WHERE capture_sha=? AND more=1`, digest);
    if (!st) return left("READING_HELD");
    /* a state with more to read and no cursor is a text read before pieces existed that the index holds only in part: it is read again
       from its start as the first piece, which replaces what the wire left (the reading itself stands) */
    const restart = st.cursor == null;
    /* (fix round 9, G129c; K4904 (1); R101) the window at the stored cursor that killed its reader three times (the ledger's `killedCursor`) is stepped
       past, stated, and the read goes on from the next */
    const skip = !restart && typeof killedCursor === "string" && killedCursor === st.cursor;
    const out = await this.read(document, { storeName, env, budget: CAPTURE_TEXT_CAPTURE_BOUND, pieces: { cursor: restart ? null : st.cursor }, run: ledger,
                                            ocrInvocations: ledger ? (halved === true ? HALF_OCR_INVOCATIONS : null) : 0, registrar: false, skipKilled: skip, stampUnit: stamp });
    /* (fix round 9, G129b; R101) a piece that failed for a cause outside the document (the store, a member: `transient`) is no end: the state keeps its
       cursor, nothing is indexed, and the entry stays owed, to be retried by the ledger with its back-off; never `more` 0 with no reason */
    const rd = out.reading && typeof out.reading === "object" ? out.reading : null;
    if (!out.refused && rd && rd.failure === "transient")
      return { ok: true, read: false, owed: true, why: "TRANSIENT", detail: { read_through: st.read_through ?? null, total: st.total ?? null,
               reason: String(rd.basis || "transient").slice(0, 160) } };
    /* a read that ends before its last piece ends stated, with its reason (`ended_why`): a refused cursor, a format not read by cursor, a failure on
       the document's own bytes (`final`) */
    const endStated = (why) => {
      this.#sql.exec(`UPDATE capture_text_state SET more=0, cursor=NULL, state='partial', ended_why=? WHERE capture_sha=?`, String(why).slice(0, 160), digest);
    };
    if (out.refused && out.refused.code === "NOT_PIECEWISE") {
      /* (G14) a format the reader cannot continue by a cursor: its index is stated as partial, with the runs it skipped named, once */
      endStated("NOT_PIECEWISE");
      return left("READING_HELD");
    }
    if (out.refused) { endStated(out.refused.code || "REFUSED"); return { ok: true, read: false, final: true, why: String(out.refused.why || out.refused.code).slice(0, 160) }; }
    if (typeof out.more !== "boolean" || (rd && rd.failure === "final" && !(Array.isArray(out.text_units) && out.text_units.length))) {
      /* not a text the reader reads in pieces (a PDF over the index's bound), or a piece the document's own bytes failed: stated as it is, once */
      const why = rd && rd.failure === "final" ? (rd.reason || rd.basis || "FINAL") : "NOT_PIECEWISE";
      endStated(why);
      return rd && rd.failure === "final" ? { ok: true, read: false, final: true, why: String(why).slice(0, 160) } : left("READING_HELD");
    }
    const units = Array.isArray(out.text_units) ? out.text_units : [];
    /* (fix round 9, G126a; R102) a continuation piece that leaves OCR pages owes them, in the piece's own transaction */
    const via = this.#oweVia(call);
    const entry = this.#ocrEntry(digest, out.reading, null, units);
    let owing = null;
    const stated = skip && out.stated && typeof out.stated === "object" ? { at: st.read_through ?? null, why: String(out.stated.why || "UNIT_KILLED_READER").slice(0, 80) } : null;
    /* (fix round 9, G128f; R99) the piece's units land in batches, each in its own transaction keyed by the piece's cursor, so a kill between two batches
       resumes from the next; the state moves to the piece's cursor last, only while it still stands at the one this piece was read from */
    const cursorStands = () => { const now = this.#one(`SELECT cursor FROM capture_text_state WHERE capture_sha=? AND more=1`, digest); return !!now && now.cursor === st.cursor; };
    if (!cursorStands()) return left("READING_HELD");
    /* (fix round 9, S25; K4911) a later page range's units are indexed under the chain of its own pages (`reading.piece_chain`, reading-pipeline's half),
       else under the stored reading's chain (a facts-only piece reading carries none), and the piece's pages are folded into the stored chain below */
    const storedChain = (() => { const r = this.#one(`SELECT CASE WHEN json_valid(reading) THEN json_extract(reading, '$.text_source') END AS ts FROM readings WHERE capture_sha=?`, digest);
                                 return r ? safeJson(r.ts) : null; })();
    const pieceChain = rd && Array.isArray(rd.piece_chain) && !checkChain(rd.piece_chain) ? rd.piece_chain : null;
    const unitChain = pieceChain || (rd && Array.isArray(rd.text_source) ? rd.text_source : storedChain);
    const folded = pieceChain && !restart ? foldPieceChain(storedChain, pieceChain, piecePagesOf(out, units)) : null;
    const wrote = await this.indexUnitsYielding(bundleId, digest, units, unitChain ?? null,
      { append: !restart, more: pieceOf(out), batchKey: `p:${restart ? "start" : st.cursor}`, guard: cursorStands,
        after: () => {
          /* (fix round 9, G128c; reading-pipeline R57) the stored reading is completed, never rewritten, by what the piece adds: its glyphs, the image placements
             its pages hold (when its answer carries them), and at the last piece the document's words (the words the pieces read) */
          this.#completeStored(digest, units, rd, out.more !== true);
          /* (S25) the stored reading's chain names every page as a whole read's does: the piece's pages folded in, its projection rewritten with it */
          if (folded) {
            this.#sql.exec(`UPDATE readings SET reading=json_set(reading, '$.text_source', json(?)) WHERE capture_sha=? AND json_valid(reading)`, JSON.stringify(folded), digest);
            this.#sql.exec(`DELETE FROM reading_text_source WHERE capture_sha=?`, digest);
            this.#writeTextSource(bundleId, digest, folded);
          }
          /* the stated window is kept with the index state (R-SILENT: `completeness` says it), counted skipped */
          if (stated) {
            const had = safeJson((this.#one(`SELECT stated FROM capture_text_state WHERE capture_sha=?`, digest) || {}).stated);
            this.#sql.exec(`UPDATE capture_text_state SET stated=?, state='partial', skipped_named=skipped_named+1 WHERE capture_sha=?`,
                           JSON.stringify([...(Array.isArray(had) ? had : []), stated]), digest);
          }
          if (entry) owing = via.owe(entry);
        } });
    if (!wrote) return left("READING_HELD");
    if (stated) {
      const st2 = { stated };
      if (out.more === true) return { ok: true, read: true, bundle_id: bundleId, found: true, more: true,
                                      detail: { read_through: out.read_through ?? null, total: out.total ?? null }, ...st2 };
      return { ok: true, read: true, bundle_id: bundleId, found: true, ...st2 };
    }
    const ow = owing ? { owed: true, registration: owedAnswer(entry, await owing) } : {};
    await via.arm();
    if (out.more === true) return { ok: true, read: true, bundle_id: bundleId, found: true, more: true,
                                    detail: { read_through: out.read_through ?? null, total: out.total ?? null }, ...ow };
    return { ok: true, read: true, bundle_id: bundleId, found: true, ...ow };
  }

  /** R82 (F9), R106, G132k (fix round 9): one pass of the OCR member over the pages a stored reading still leaves unread, a PDF's or a picture's one
   *  page (G129d: no PDF-only structure read), written as a composed re-read by R34's rule. The pass loads no object and parses nothing: the pages are
   *  the stored units (`#storedPages`), and the OCR member reads each page it is asked for from the store itself. `owed` says whether the digest still
   *  has work: pages left after a pass that read some (re-registered with the first of them as the cursor), or a pass that read none because the
   *  member was down or answered an error (the row stands: never `UNREADABLE`, never finished while the page stays unread). Pages the member declines
   *  in a 200 answer are the document's own, so that ends the entry (`OCR_NO_PROGRESS`). A stored reading that changed while the pass ran is not
   *  written over: the entry stays owed and is read again. */
  async #continueOcr({ digest, heldReading, bundleId, storeName, env, left, call = null, killedPages = null, detail = null, halved = false, stamp = null }) {
    if (!heldReading) return left("NO_READING");
    const basis = this.reextractBasis({ captureSha: digest, ungated: true });
    if (!basis.held) return left("NO_READING");
    /* the pages left are judged as the press judges them: by the stored units (a page with no glyph that no earlier pass read) */
    if (!this.#pagesLeft(digest, basis).length) return left("NO_PAGES_LEFT");
    if (!env.OCR_WORKER) return left("NO_OCR_MEMBER");
    /* the press's job carries who asked and by which act (`detail`, R34's `by` and `via`); the ledger's own continuation is the plane's */
    const d = detail && typeof detail === "object" ? detail : {};
    const author = typeof d.by === "string" && d.by ? d.by : PLANE_AUTHOR;
    const via = d.via === "op=pdfstructure&ocr=1" ? d.via : "ledger";
    const pass = await this.#ocrPass({ digest, basis, env, storeName, author, via, killedPages, call, halved, stamp });
    const killed = pass.killed && pass.killed.length ? { killed: pass.killed } : {};
    if (pass.changed) return left("BASIS_CHANGED", { owed: true });
    /* (R101) a pass that answered pages holding no glyph read nothing: the end is stated `final`, so the ledger's row ends on this tick and never tries it again */
    if (!pass.filled.length && !pass.stated) return left(pass.why || "OCR_NO_PROGRESS", { ...(pass.transient ? { owed: true } : {}), ...(pass.why === "NO_PROGRESS" ? { final: true } : {}), ...killed });
    return { ok: true, read: true, bundle_id: bundleId, found: true, reextraction: pass.summary,
             ...(pass.stated ? { stated: pass.stated } : {}), ...(pass.entry ? { owed: true, registration: pass.registration } : {}), ...killed };
  }

  /** (fix round 9, G126e, G132k pass half) The stored reading's pages as the I2 text tier 3 and tier 4 take (`{document, pages, undetermined}`), built
   *  from the capture's stored `pdf-page` units, so no object is loaded and nothing is parsed: a page with a glyph keeps its text; a page with none, and a
   *  page an earlier OCR or AI pass read (`tier3SeedFrom`'s kept pages, re-marked so they are kept under their own chain and never asked again), is
   *  marked `no_text_layer`; a page the member refused (`ocr_refused`) is marked `ocr_refused`, which selects nothing. `pages` is the stored
   *  `page_count`, a picture's one page when it states none; null when the reading names no pages. */
  #storedPages(basis, fmt) {
    const stored = basis.reading || {};
    const n = Number.isInteger(stored.page_count) && stored.page_count > 0 ? stored.page_count : PICTURE_FORMATS.includes(fmt) ? 1 : null;
    if (n === null) return null;
    const seed = tier3SeedFrom(stored, basis.units);
    const text = new Map(basis.units.map((u) => [u.page, u.text]));
    const refused = new Set((Array.isArray(stored.ocr_refused) ? stored.ocr_refused : []).map((r) => r && r.page).filter(Number.isInteger));
    /* (fix round 9, K4904 (2); plan 2c item 9) a folio page (a page number's few glyphs over a picture, reading-pipeline's `folio_pages`) keeps its glyphs
       and is routed `image_content_unread`, so tier 3 appends its OCR (D-635); absent, none (new data only) */
    const folios = new Set((Array.isArray(stored.folio_pages) ? stored.folio_pages : []).filter(Number.isInteger));
    const pages = [], undetermined = [];
    for (let p = 0; p < n; p++) {
      const t = text.get(p) ?? "";
      const seeded = !!(seed && seed.text.has(p));
      if (!seeded && folios.has(p) && !refused.has(p)) {
        const mark = { page: p, reason: "image_content_unread", font: null, codes: null, count: 0 };
        pages.push({ page: p, text: t, undetermined: [mark] });
        undetermined.push(mark);
        continue;
      }
      if (!seeded && glyphCount(t) > 0) { pages.push({ page: p, text: t, undetermined: [] }); continue; }
      const mark = { page: p, reason: refused.has(p) && !seeded ? "ocr_refused" : "no_text_layer", font: null, codes: null, count: 1 };
      pages.push({ page: p, text: "", undetermined: [mark] });
      undetermined.push(mark);
    }
    const document = pages.map((x) => x.text).filter((t) => t.length).join("\n");
    return { pages: n, seed, i2text: { document, pages, undetermined, counts: { chars: document.length, undetermined: undetermined.length } } };
  }

  /** The pages a stored reading still leaves for OCR (`#storedPages`' `no_text_layer` marks, less the pages an earlier pass read), ascending. */
  #pagesLeft(sha, basis) {
    const fmt = (this.#one(`SELECT capture_format FROM readings WHERE capture_sha=?`, sha) || {}).capture_format || basis.reading.text_container || "pdf";
    const built = this.#storedPages(basis, fmt);
    const seeded = built && built.seed ? built.seed.text : new Map();
    return built ? built.i2text.undetermined.filter((m) => (m.reason === "no_text_layer" || m.reason === "image_content_unread") && !seeded.has(m.page)).map((m) => m.page) : [];
  }

  /** The tier the stored reading's text layer was read at (its chain's first `layer` step), 1 when it names none. */
  static #layerTier(stored) {
    const chain = stored && Array.isArray(stored.text_source) ? stored.text_source : [];
    const l = chain.find((x) => x && x.step === "layer" && Number.isInteger(x.tier));
    return l ? l.tier : 1;
  }

  /** (fix round 9, G126e, G132k, R106) One OCR pass over a stored reading (the ledger's), composed and written by R34's rule: tier 3 over
   *  `#storedPages` (the OCR member asked for the pages left, within the call's budget), the reading composed as the press composed it, written by
   *  `#writeReread` only while the stored reading is still `basis` (R103), and the pages still left re-registered. Answers `{filled, transient, why,
   *  changed?, entry?, registration?}`. */
  async #ocrPass({ digest, basis, env, storeName, author, via, killedPages = null, call = null, halved = false, stamp = null }) {
    const stored = basis.reading || {};
    const fmt = (this.#one(`SELECT capture_format FROM readings WHERE capture_sha=?`, digest) || {}).capture_format || stored.text_container || "pdf";
    const built = this.#storedPages(basis, fmt);
    if (!built) return { filled: [], transient: false, why: "NO_PAGES" };
    const baseTier = Extraction.#layerTier(stored);
    const t3 = await tier3Extend(env, { sha: digest, storeName, i2text: built.i2text, wiredTier: baseTier, tier2PerPage: null, fmt,
      seed: built.seed, liveCalibration: (q) => this.#liveCalibration(q), ...(Array.isArray(killedPages) ? { killedPages } : {}),
      /* (G129c; R101) the one retry after three kills, at half the budget */
      ...(halved === true ? { invocations: HALF_OCR_INVOCATIONS } : {}),
      /* (G165; R109) the plane's unit stamp, called with `p<page>` before each page's member call */
      ...(stamp ? { stampUnit: stamp } : {}) });
    /* (G129c; R101) a page killed three times is stated for that page alone (`PAGE_KILLED_READER`, written so it is never asked again) and the read
       goes on; the pages whose call died this pass are answered (`killed`) for the ledger's attempt stamps */
    const statedNow = (Array.isArray(t3.refused) ? t3.refused : []).filter((r) => r && r.reason === PAGE_KILLED_READER).map((r) => r.page);
    const alreadyStated = new Set((Array.isArray(stored.ocr_refused) ? stored.ocr_refused : []).map((r) => r && r.page));
    const newlyStated = statedNow.filter((pg) => !alreadyStated.has(pg));
    if (!t3.filled.length && !newlyStated.length)
      return { filled: [], transient: t3.transient === true, why: t3.transient ? "OCR_MEMBER_DOWN" : "OCR_NO_PROGRESS", killed: t3.killed };
    const chain = (t3.chainSet ? t3.chain : null) || layerChainFor(t3.i2text, { tier: t3.wiredTier, container: fmt });
    const reading = await this.#composedReread({ stored, basis, i2text: t3.i2text, chain, wiredTier: t3.wiredTier, fmt, pages: built.pages, env,
      ocrNote: t3.ocrNote, tier3Candidate: t3.stillWanting, t3 });
    reading.reextracted = { at: stampInstant("second"), by: author, engine: t3.engine ? t3.engine.engine : null, version: t3.engine ? t3.engine.version : null,
      calibration: t3.engine ? t3.engine.calibration ?? null : null, pages: t3.filled, via };
    /* the pages still owed after this pass: those left before it, less the pages it filled with text and the pages now stated (a member that answers
       some pages and names no rest leaves the others owed, as one that defers them does) */
    const doneNow = new Set([...t3.filled.filter((pg) => { const x = (t3.i2text && Array.isArray(t3.i2text.pages) ? t3.i2text.pages : []).find((q) => q && q.page === pg); return !!x && glyphCount(x.text || "") > 0; }),
                             ...(Array.isArray(t3.refused) ? t3.refused.map((r) => r && r.page) : [])]);
    const stillLeft = this.#pagesLeft(digest, basis).filter((pg) => !doneNow.has(pg));
    const entry = stillLeft.length ? { kind: "ocr", sha: digest, cursor: stillLeft[0], pages_left: stillLeft.length } : null;
    if (entry) reading.ocr_left = { cursor: entry.cursor, pages: entry.pages_left }; else delete reading.ocr_left;
    /* (R101: progress only forward) a pass whose filled pages hold no glyph has read nothing: it ends, stated, and re-registers nothing, so a member
       answer that merges to empty pages never loops the job */
    const glyphsIn = (pg) => { const x = (t3.i2text && Array.isArray(t3.i2text.pages) ? t3.i2text.pages : []).find((q) => q && q.page === pg); return !!x && glyphCount(x.text || "") > 0; };
    if (!newlyStated.length && !t3.filled.some(glyphsIn)) return { filled: [], transient: false, why: "NO_PROGRESS", killed: t3.killed };
    const w = await this.#writeReread({ basis, sha: digest, reading, text: t3.i2text, author, ungated: true, job: entry, call });
    if (w.changed) return { filled: [], transient: true, changed: true, killed: t3.killed };
    /* R34: what the pass did and what the listeners and the index reported, as the press answered it */
    const summary = { performed: true, written: w.ok === true, ...unwrittenWhy(w, "re-read"), pages: t3.filled, engine: t3.engine,
      text_source: chain, chain: describeChain(chain), via,
      reading: { content_type: reading.content_type, read_from_text: reading.read_from_text, found: reading.found,
                 entities: Array.isArray(reading.entities) ? reading.entities.length : 0, text_tier: reading.text_tier },
      staled: w.staled ?? 0, units: w.indexed ?? null, observed: w.observed ?? null, compared: w.compared ?? null, after_read: w.afterRead ?? null,
      candidates: localize("extraction.index.reread_candidates_frontier", "the content-axis frontier (op=frontier&level=content) lists the captures still below what your team's Civicsmith can read; this one is re-read now") };
    return { filled: t3.filled, transient: false, w, summary, killed: t3.killed, ...(newlyStated.length ? { stated: newlyStated } : {}),
             ...(entry ? { entry, registration: w.registration } : {}) };
  }

  /** R34, R71 (fix round 9: from the stored pages, no structure): the reading a re-read or a transcription writes, by reading-pipeline R11's rule with
   *  the stored reading's type, `at` the capture instant, the stored page count, page boxes and container extent carried (G128c: the boxes are the
   *  stored rows'), reading-pipeline R18's provenance, the read's own counts and emitted fields, what tier 3 left (`ocr_left`, `ocr_refused`), and the
   *  stored test-instance label kept (R74). */
  async #composedReread({ stored, basis, i2text, chain, wiredTier, fmt, pages, env, ocrNote = null, tier3Candidate = false, t3 = null, tier2note = null }) {
    const vw = this.view();
    const wired = readText(decodeView(i2text), { headers: null, locator: basis.locator || null, content_type: null, at: stored.at ?? null, ...(vw ? { view: vw } : {}) });
    const reading = readingFromWire({ wired, docType: { type: { key: stored.content_type ?? null, version: stored.reader_version ?? null } },
      chain, wiredTier, fmt, retrieved: stored.at ?? null, tier2note, ocrNote, tier3Candidate });
    reading.page_count = pages;
    if (Object.prototype.hasOwnProperty.call(stored, "page_boxes")) reading.page_boxes = stored.page_boxes;
    if (Object.prototype.hasOwnProperty.call(stored, "container_extent")) reading.container_extent = stored.container_extent;
    reading.provenance = await readingProvenance({ text: i2text, chain, tier: wiredTier, container: fmt, planeVersion: (env && env.VERSION) || null });
    { const n = textCountsOf(i2text); if (n) Object.assign(reading, n); }
    { const n = textWordsFor(i2text); if (n) Object.assign(reading, n); }
    Object.assign(reading, emittedFieldsOf(i2text));
    /* reading-pipeline R28: what the entry emitted beside the text is the stored reading's (nothing is parsed here) */
    if (Object.prototype.hasOwnProperty.call(stored, "metadata")) reading.metadata = stored.metadata;
    if (t3 && t3.left) reading.ocr_left = { cursor: t3.left.cursor, pages: t3.left.pages.length };
    /* (K4904 (2)) the folio pages a pass has not yet read stay listed */
    if (Array.isArray(stored.folio_pages)) {
      const still = stored.folio_pages.filter((pg) => Number.isInteger(pg) && !(t3 && Array.isArray(t3.filled) && t3.filled.includes(pg)));
      if (still.length) reading.folio_pages = still;
    }
    const refused = [...(Array.isArray(stored.ocr_refused) ? stored.ocr_refused : []), ...((t3 && Array.isArray(t3.refused)) ? t3.refused : [])]
      .filter((r) => r && Number.isInteger(r.page) && !(t3 && t3.filled.includes(r.page)));
    if (refused.length) reading.ocr_refused = [...new Map(refused.map((r) => [r.page, { page: r.page, reason: r.reason }])).values()].sort((x, y) => x.page - y.page);
    keepUntested(reading, stored, null);
    return reading;
  }

  /** (fix round 5, E3) The capture's size from its own document: its parts' sizes, else its stated size; null when the
   *  document states none (reading-pipeline then asks the store). */
  #sizeOf(document) {
    const parts = document && Array.isArray(document.parts) ? document.parts : null;
    if (parts) return parts.reduce((n, p) => n + (Number.isFinite(p && p.bytes) ? p.bytes : 0), 0);
    const b = document && document.capture ? document.capture.bytes : null;
    return Number.isFinite(b) && b > 0 ? b : null;
  }

  /** The first KiB of the object held under `digest` (a range), or null when none is held or it is empty. */
  async #heldHead(digest) {
    const head = await readRange(this.#rangeStore(), digest, 0, 1024);
    return head instanceof Uint8Array && head.length ? head : null;
  }

  /** (fix round 9, G127d; R104) What `acquisition.readRange` is handed: this object's evidence store (record-core's) and its register (provenance's
   *  `partsOf`), so a capture is read by its whole digest whether it is held whole or only in parts, and no part is resolved here. */
  #rangeStore() { return { core: this.core, provenance: this.#provenance }; }

  /** (fix round 9, G127d; R104) Whether the capture is held by its whole digest: the whole object (its `head`), else its first byte read through
   *  `readRange` from the parts the register names. A store that fails is held by nothing now. */
  async #heldByWhole(digest) {
    const ev = this.core && typeof this.core.evidenceStore === "function" ? this.core.evidenceStore() : null;
    try { if (ev && await ev.head(digest)) return true; } catch { return false; }
    /* not held whole: held in parts when its first byte reads through `readRange` (the register's parts, in the store) */
    const b = await readRange(this.#rangeStore(), digest, 0, 1);
    return b instanceof Uint8Array && b.length > 0;
  }

  /** (fix round 9, G127d; R104; K4833) The evidence store a read of the capture `digest` is handed: record-core's own, except that the whole digest of a
   *  capture held only in parts is answered through `acquisition.readRange` (its `head` the parts' total, its `get` the bytes asked, by range or whole),
   *  so the reader is handed the capture by its whole and never resolves a part. Every other key is the store's own. Null with no store. */
  #evidenceOf(digest) {
    const ev = this.core && typeof this.core.evidenceStore === "function" ? this.core.evidenceStore() : null;
    if (!ev || typeof digest !== "string" || !/^[0-9a-f]{64}$/.test(digest)) return ev;
    const parts = () => (this.#provenance && typeof this.#provenance.partsOf === "function" ? this.#provenance.partsOf(digest) : null);
    const total = (ps) => (Array.isArray(ps) && ps.length ? ps.reduce((n, p) => n + (Number.isFinite(p && p.bytes) ? p.bytes : 0), 0) : null);
    const store = this.#rangeStore();
    const object = (bytes, size) => ({ size, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
    const own = {
      head: async (key, ...a) => {
        const h = await ev.head(key, ...a);
        if (h || key !== digest) return h;
        const size = total(parts());
        return size === null ? h : { key, size };
      },
      get: async (key, opts, ...a) => {
        const o = await ev.get(key, opts, ...a);
        if (o || key !== digest) return o;
        const size = total(parts());
        if (size === null) return o;
        const r = opts && opts.range && typeof opts.range === "object" ? opts.range : null;
        const offset = r && Number.isSafeInteger(r.offset) ? r.offset : 0;
        const length = r && Number.isSafeInteger(r.length) ? r.length : size - offset;
        const b = await readRange(store, digest, offset, Math.max(0, length));
        return b instanceof Uint8Array ? object(b, size) : null;
      },
    };
    return new Proxy(ev, { get: (t, k) => (Object.hasOwn(own, k) ? own[k] : typeof t[k] === "function" ? t[k].bind(t) : t[k]) });
  }

  /** (fix round 6, G41 follow-up; R98; K4664, K4669) The format key `cellsOf` hands `reading-pipeline.cellsInRange` for a held sheet. A named
   *  `capture_format` is used as it is. One that is `undetermined`, empty or absent (an upload over one part, or a capture made before it was
   *  profiled) is replaced, never guessed: by the reading's own `text_container` when the format registry has an entry for it with a `cellsIn` slot
   *  (the entry the pipeline chose from the bytes, R73, and wrote the reading by), else by the format detected again over the held head and the
   *  declared type, as the pipeline detects it (`detectFormat(bytes, source_content_type || content_type)`) when that format has the slot. The
   *  head is only the first KiB, so a workbook (which needs its central directory to be recognised) is named by its declared type, as in the
   *  pipeline, and a sheet that neither names is left unnamed (`null`: `cells_not_interpretable`). */
  async #cellsFormat(recorded, container, document, digest, ev) {
    if (typeof recorded === "string" && recorded && recorded !== "undetermined") return recorded;
    const slot = (key) => (typeof key === "string" && key && key !== "undetermined" && typeof (getFormat(key) || {}).cellsIn === "function" ? key : null);
    const named = slot(container);
    if (named) return named;
    const head = await this.#heldHead(digest);
    if (!head) return null;
    const profile = document && document.profile && typeof document.profile === "object" ? document.profile : {};
    const ct = profile.source_content_type || (document && document.capture && document.capture.content_type) || null;
    const seen = detectFormat(head, ct);
    return slot(seen && seen.format);
  }

  /** (fix round 5, E1) The format the held bytes now detect (`format-registry.detectFormat` over the first KiB of the
   *  object, a range), as the `profile.format` a read hands the pipeline; null when they detect none. UTF-8 without NUL
   *  under a declared text type is not a format: that case is the pipeline's own (reading-pipeline R2), which the
   *  caller's read then tries, so it answers the profile's recorded format unchanged. */
  async #nowDetected(document, digest, ev) {
    const head = await this.#heldHead(digest);
    if (!head) return null;
    const f = detectFormat(head, null);
    if (f && f.format && f.format !== "undetermined") return f;
    const declared = document && document.profile && typeof document.profile.source_content_type === "string"
      ? document.profile.source_content_type.toLowerCase() : "";
    if (!declared.startsWith("text/") || head.includes(0)) return null;
    try { new TextDecoder("utf-8", { fatal: true }).decode(head, { stream: true }); } catch { return null; }
    return document.profile.format ?? { format: "undetermined", confidence: "none", signals: [] };
  }

  /** R92 (fix round 6, G33; R-OLD, a repair only): the whole a reading the old press stored against a part's digest stands for, in the bundle
   *  `bundleId`: the digest of the document in that bundle's own provenance document whose `parts` name `part`; null when none does. Read by the R92
   *  repair alone, over readings stored before the whole digest was the only key (R104): no read or lookup of a capture resolves a part. */
  #oldPartOwner(bundleId, part) {
    let docText = null;
    try {
      const f = this.core && typeof this.core.readFile === "function" ? this.core.readFile(bundleId, "data/provenance.json") : null;
      docText = f && typeof f === "object" ? (f.text ?? f.content ?? null) : (typeof f === "string" ? f : null);
    } catch { docText = null; }
    const docs = (safeJson(docText) || {}).documents;
    const hit = Array.isArray(docs) ? docs.find((d) => d && d.capture && typeof d.capture.sha256 === "string" && d.capture.sha256 !== part
      && Array.isArray(d.parts) && d.parts.some((p) => p && p.sha256 === part)) : null;
    return hit ? hit.capture.sha256 : null;
  }

  /** (fix round 6, G40; R95) The facts of a stored reading that `readHeld` asks (`found`, `failure`, `basis`, `tier3_candidate`, and `entities` as a
   *  list only as long as it is, its items never read), read by SQL so the stored JSON, which for a sheet is megabytes, is not loaded and parsed
   *  to ask whether it failed. Null for a capture with no reading, a reading that is no JSON object, as a parse of it would answer. */
  #readingFacts(sha) {
    const r = this.#one(
      `SELECT json_type(reading, '$.found') AS ft, json_type(reading, '$.failure') AS ut, json_extract(reading, '$.failure') AS failure,
              json_type(reading, '$.basis') AS bt, json_extract(reading, '$.basis') AS basis,
              json_type(reading, '$.entities') AS et, json_array_length(reading, '$.entities') AS en,
              json_type(reading, '$.tier3_candidate') AS tt, json_extract(reading, '$.too_large.key') AS tlk,
              json_extract(reading, '$.text_container') AS tc, capture_format AS cf, json_extract(reading, '$.held_unread') AS hu
         FROM readings WHERE capture_sha=? AND json_valid(reading) AND json_type(reading)='object'`, sha);
    if (!r) return null;
    const heldUnread = r.hu ? safeJson(r.hu) : null;
    return { found: r.ft === "true" ? true : r.ft === "false" ? false : undefined,
             failure: r.ut === "text" ? r.failure : undefined, basis: r.bt === "text" ? r.basis : undefined,
             entities: r.et === "array" ? new Array(r.en) : undefined,
             tier3_candidate: r.tt === "true" ? true : r.tt === "false" ? false : undefined,
             /* (fix round 9, R105 (c)) an ODS reading stated too large for its cells, which odf-reader R49 now holds: read again once */
             ...(r.tlk === "cells" && (r.cf === "ods" || r.tc === "ods") ? { odsTooLarge: true } : {}),
             /* (T53; R120) a held-and-named reading states `held_unread` (reading-pipeline R67): the type's plain name, no units, no failure */
             ...(heldUnread && typeof heldUnread === "object" && !Array.isArray(heldUnread) ? { held_unread: heldUnread } : {}) };
  }

  /** R120 (T53; N1266; RF10): whether the stored reading of a capture is a held-and-named one still: it found nothing, states `held_unread` (a type on no
   *  list, reading-pipeline R67) and no unit of it is indexed. A reading with units is never one, whatever else it says. */
  #heldUnread(sha, facts = null) {
    const f = facts ?? this.#readingFacts(sha);
    return !!f && f.found === false && !!f.held_unread && !this.#one(`SELECT 1 AS x FROM capture_text WHERE capture_sha=? LIMIT 1`, sha);
  }

  /** R120: the format the held bytes now detect when it is a LISTED one (a reader is registered for it): judged by the bytes' head alone, never by the name or the declared
   *  type (`detectFormat(head, null)`); null for `unlisted`, `undetermined`, `refused` and for bytes not held. */
  async #nowListed(digest) {
    const head = await this.#heldHead(digest);
    if (!head) return null;
    const f = detectFormat(head, null);
    return f && typeof f.format === "string" && !["unlisted", "undetermined", "refused"].includes(f.format) ? f : null;
  }

  /** R80 (fix round 4, C5b): whether a stored reading is a failed one that failed for want of the whole bytes: it found
   *  nothing, its document is a capture of several parts, and its basis is one of the three reasons
   *  `reading-pipeline.bytesOf` gives when it could not assemble the parts (over the reader's size, a part not held, the
   *  parts not adding up). A reading made from the whole bytes states none of them, so it is not read again. */
  #wantedTheWhole(reading, document) {
    if (!reading || reading.found !== false || typeof reading.basis !== "string") return false;
    if (Array.isArray(reading.entities) && reading.entities.length) return false;
    const parts = document && Array.isArray(document.parts) ? document.parts : null;
    if (!parts) return false;
    const total = parts.reduce((n, p) => n + (Number.isFinite(p && p.bytes) ? p.bytes : 0), 0);
    const reasons = [word("reading-pipeline.why.capture_bytes_parts", { total: String(total), parts: String(parts.length),
                                                                          multipart_read_max: String(pipeline.MULTIPART_READ_MAX) }),
                     word("reading-pipeline.why.parts_held_add")];
    for (let i = 1; i <= parts.length; i++)
      reasons.push(word("reading-pipeline.why.part_held_evidence", { index_of: String(i), parts: String(parts.length) }));
    return reasons.includes(reading.basis);
  }

  /* ---- writing (R19–R24) ---- */

  /** R20: promotion's projection. For each document in `data/provenance.json` with a capture digest and a reading
   *  object, R19 runs, except that a stored re-read is not replaced by a reading that is not one and carries the
   *  same `at` (CPDF-19: an ordinary revision re-submits the acquire-time reading, which must not undo the re-read),
   *  and a stored N26- or N439-migrated reading is not replaced by one without that mark carrying the same `at`. */
  projectPromotion(c) {
    const { bundleId, files, author } = c || {};
    const prov = (Array.isArray(files) ? files : []).find((f) => f && f.path === "data/provenance.json");
    if (!prov || typeof prov.text !== "string") return null;
    let docs;
    try { docs = JSON.parse(prov.text).documents; } catch { return null; }
    if (!Array.isArray(docs)) return null;
    for (const doc of docs) {
      const sha = doc && doc.capture && doc.capture.sha256;
      const reading = doc && doc.reading;
      if (typeof sha !== "string" || !sha || !reading || typeof reading !== "object") continue;
      if (this.#heldByReextraction(sha, reading) || this.#historyHolds(sha, reading)) continue;
      const prof = doc.profile && typeof doc.profile === "object" ? doc.profile : null;
      this.writeReading({ bundleId, captureSha: sha, reading,
        textUnits: Array.isArray(doc.text_units) ? doc.text_units : null,
        textUnitsOverBound: doc.text_units_over_bound, textUnitsSkipped: doc.text_units_skipped,
        profileFormat: prof && prof.format && typeof prof.format.format === "string" ? prof.format.format : null,
        author, justification: doc.reading_justification });
    }
    return null;
  }

  /* R66 (J1 2.), R68: a stored N26- or N439-migrated reading is held the same way. An ordinary revision re-submits the
     acquire-time reading `data/provenance.json` still carries, made before the fix: written back, it would undo the
     migration (the old numbering, the chain without the mark) and move every cited paragraph or shape back unseen. */
  #heldByReextraction(sha, reading) {
    const row = this.#one(`SELECT reading FROM readings WHERE capture_sha=?`, sha);
    const prior = row ? safeJson(row.reading) : null;
    const sameAt = !!(prior && typeof prior.at === "string" && typeof reading.at === "string" && prior.at === reading.at);
    if (sameAt && n26Marked(prior) && !n26Marked(reading)) return true;
    if (sameAt && n439Marked(prior) && !n439Marked(reading)) return true;
    if (reading && reading.reextracted) return false;
    return !!(prior && prior.reextracted && sameAt);
  }

  /** (T51 fix round 10, walk C C-M1; R112) The capture's `reading_history` already holds this very reading (its digest): an ordinary revision, a vouching
   *  that re-promotes the bundle, re-submits the acquire-time reading `data/provenance.json` carries, which `#heldByReextraction` held only while the stored
   *  reading's `at` equalled it as a string. A re-submitted kept reading writes nothing; a new acquire's reading has a new digest and is kept as before. */
  #historyHolds(sha, reading) {
    const { digest } = this.#serialOf(reading);
    return !!this.#one(`SELECT 1 AS x FROM reading_history WHERE capture_sha=? AND reading_sha256=?`, sha, digest);
  }

  /** R19: the one writer promote and the re-read share, in one `record-core.transact`: the history (R23); the
   *  `readings` row; the references, one row per distinct place; the name terms per source; the text-source row;
   *  the text index (R22); then the listeners (R24). R21: a reading this instance did not compose is recorded as
   *  the caller's assertion, with the caller's standing and justification. */
  writeReading({ bundleId, captureSha, reading, textUnits = null, textUnitsOverBound = 0, textUnitsSkipped = null,
                 profileFormat = null, author = null, justification = null, composed = null, more = null } = {}) {
    const sha = captureSha;
    return this.core.transact(() => {
      let ser = this.#serialOf(reading, { take: true });
      /* (fix round 6, G41; R96, R97) the row guard: a value built here that would pass READING_ROW_MAX_BYTES is not bound. The reading is
         replaced, whole, by a small stated one (the size and the largest key in its `basis`, no cells, no units, no references), so the
         platform's single-value limit is never met as a thrown SQLITE_TOOBIG and the read does not follow itself (`more` is dropped). */
      let stated = null, omitted = null;
      if (overBytes(ser.json, READING_ROW_MAX_BYTES)) {
        /* (fix round 9, G128e; R97) an optional part (a sheet's cells, the page boxes, the image placements) is omitted first, with a statement, and the
           reading, its entities, references and units stay */
        const lean = this.#withoutOptional(reading);
        const leanSer = lean ? this.#serialOf(lean.reading) : null;
        if (lean && !overBytes(leanSer.json, READING_ROW_MAX_BYTES)) { omitted = lean.omitted; reading = lean.reading; ser = leanSer; }
        else {
          /* still over with every optional part omitted: the small stated reading stands in, and the units it was read with are still indexed (a reading
             over 1 MiB is never replaced by a statement without units, reading-pipeline R47); no piece follows a statement */
          stated = this.#statedTooLarge(reading, ser.json);
          reading = stated.reading; ser = this.#serialOf(reading); composed = true; more = null;
        }
      }
      /* (G40; R95) the stored reading's chain by SQL: a large stored reading is never loaded and parsed to read one field */
      const before = this.#one(`SELECT CASE WHEN json_valid(reading) AND json_type(reading)='object'
                                            THEN json_extract(reading, '$.text_source') END AS ts
                                   FROM readings WHERE capture_sha=?`, sha);
      const chainBefore = before ? safeJson(before.ts) ?? null : null;
      /* R24 (content REPORT 4): the capture's indexed units as they stood before this write, so a listener can
         weigh the old text against the new; null when the capture was never indexed. (fix round 9, G128f; R24 amended) The whole old set, never
         cut at the first 4,096: read page by page (each page at most CAPTURE_TEXT_CAPTURE_UNIT_BOUND units), handed as the list of every unit in
         `seq` order, which also carries `pages` (those pages), `units` (itself) and `state` (the index's state before the write), so a listener that
         reads R36's shape (`{units, state}`) reads it too. Read only when a listener is registered. */
      const stBefore = this.#one(`SELECT state FROM capture_text_state WHERE capture_sha=?`, sha);
      let unitsBefore = null;
      if (stBefore && this.#listeners.length) {
        const pages = [];
        for (let at = -1; ;) {
          const page = this.#rows(`SELECT extent, ref, text, truncated, seq FROM capture_text WHERE capture_sha=? AND seq > ? ORDER BY seq LIMIT ?`,
                                  sha, at, CAPTURE_TEXT_CAPTURE_UNIT_BOUND)
            .map((u) => ({ extent: safeJson(u.extent), ref: u.ref, text: u.text, truncated: !!u.truncated, seq: u.seq }));
          if (page.length) pages.push(page);
          if (page.length < CAPTURE_TEXT_CAPTURE_UNIT_BOUND) break;
          at = page[page.length - 1].seq;
        }
        unitsBefore = pages.flat();
        Object.defineProperties(unitsBefore, { pages: { value: pages }, units: { value: unitsBefore }, state: { value: stBefore.state } });
      }
      const entities = Array.isArray(reading.entities) ? reading.entities : [];
      const kept = this.#keepReading(bundleId, sha, reading, ser);
      const own = composed === true || (composed == null && this.#composedHere(ser.digest));
      const asserted = !own;
      const just = asserted && justification != null
        ? (typeof justification === "string" ? justification : JSON.stringify(justification)) : null;
      this.#sql.exec(
        `INSERT OR REPLACE INTO readings (capture_sha,bundle_id,content_type,reader_version,found,entity_count,reading,at,
                                          capture_format,origin,asserted_by,asserted_standing,justification,reading_shape)
         VALUES (?,?,?,?,?,?,?,?,COALESCE(?, (SELECT capture_format FROM readings WHERE capture_sha=?)),?,?,?,?,${READING_SHAPE})`,
        sha, bundleId,
        typeof reading.content_type === "string" ? reading.content_type : null,
        Number.isInteger(reading.reader_version) ? reading.reader_version : null,
        reading.found ? 1 : 0, entities.length,
        ser.json, typeof reading.at === "string" ? reading.at : null,
        typeof profileFormat === "string" && profileFormat.trim() ? profileFormat.trim() : null, sha,
        asserted ? "asserted" : "composed", asserted ? (author ?? null) : null,
        asserted ? standingOf(author) : null, just);
      this.#sql.exec(`DELETE FROM reading_refs WHERE capture_sha=?`, sha);
      this.#sql.exec(`DELETE FROM reading_ref_terms WHERE capture_sha=?`, sha);
      for (const e of entities) {
        if (!e || (e.key == null && e.kind == null)) continue;
        const ref = typeof e.ref === "string" && e.ref ? e.ref : `${e.kind == null ? "" : e.kind}:${e.key == null ? "" : e.key}`;
        /* D-454: every occurrence, `source` first, at most OCCURRENCES_PER_REF, the rest one unplaced row; each
           position re-normalised (a provenance document is something a caller can author). */
        const all = Array.isArray(e.occurrences) ? e.occurrences : [];
        const listed = all.slice(0, OCCURRENCES_PER_REF);
        const places = (e.source || !listed.length ? [e.source] : []).concat(listed).map(readingSource);
        if (all.length > listed.length) places.push(null);
        const wrote = new Set();
        for (const pos of places) {
          const occ = readingOccurrenceKey(pos);
          if (wrote.has(occ)) continue;
          this.#sql.exec(
            `INSERT OR REPLACE INTO reading_refs (capture_sha,bundle_id,ref,ref_kind,ref_key,label,pos_kind,pos,pos_ref,occurrence,seq)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            sha, bundleId, ref, e.kind == null ? null : String(e.kind), e.key == null ? null : String(e.key),
            e.label == null ? null : String(e.label),
            pos ? pos.kind : null, pos ? readingSourceJson(pos) : null, pos ? pos.ref : null, occ, wrote.size);
          wrote.add(occ);
        }
        for (const [src, text] of refTermSources({ ref, ref_key: e.key == null ? null : String(e.key),
                                                   label: e.label == null ? null : String(e.label) }))
          for (const term of labelTerms(text))
            this.#sql.exec(`INSERT OR REPLACE INTO reading_ref_terms (capture_sha,bundle_id,ref,src,term) VALUES (?,?,?,?,?)`,
                           sha, bundleId, ref, src, term);
      }
      this.#sql.exec(`DELETE FROM reading_text_source WHERE capture_sha=?`, sha);
      this.#writeTextSource(bundleId, sha, reading.text_source);
      const indexed = this.indexUnits(bundleId, sha, textUnits, reading.text_source,
        { wireOverBound: textUnitsOverBound, wireSkipped: textUnitsSkipped, more });
      /* (fix round 6, G13; R90) a text whose units the index holds only in part, written by a read that was not in pieces (the acquire wire,
         a promotion): it is read in pieces from its start, so no text is left silently partial. The reading itself stands. */
      if (!more && textReading(reading) && indexed.over_bound > 0) {
        this.#sql.exec(`UPDATE capture_text_state SET more=1, cursor=NULL WHERE capture_sha=?`, sha);
        this.#oweAfterCommit(sha);
      }
      const chainAfter = Array.isArray(reading.text_source) ? reading.text_source : null;
      const listeners = {};
      for (const l of this.#listeners)
        listeners[l.module] = l.fn({ bundleId, captureSha: sha, reading, chainBefore, chainAfter, unitsBefore, indexed, author });
      const afterRead = this.#holdAfterRead(sha, reading, ser.json);
      return { kept, indexed, listeners, origin: asserted ? "asserted" : "composed", afterRead,
               ...(stated ? { stated: stated.facts, reading } : {}), ...(omitted ? { omitted } : {}) };
    });
  }

  /** (fix round 9, G128e; R97, R94) A reading with its optional parts omitted, in this order until it is under READING_ROW_MAX_BYTES: a sheet's or a
   *  table's `cells` (a sheet format whose entry makes cells for a range keeps them held: `cells_held` names its sheets, R98), the `page_boxes`, the
   *  `container_extent.images` placements (null, with `images_why` the statement). Each omission is stated in `omitted`, `[{key, bytes, limit, why}]`
   *  (`why` read by key; the row owed: `extraction.index.part_omitted`). Null when the reading holds none of them. Pure: the reading handed in is unchanged. */
  #withoutOptional(reading) {
    if (!reading || typeof reading !== "object") return null;
    const sizeOf = (v) => { let j; try { j = JSON.stringify(v); } catch { j = null; } return typeof j === "string" ? utf8Bytes(j) : 0; };
    const out = { ...reading }, omitted = [];
    const note = (key, bytes) => (out.omitted = omitted).push({ key, bytes, limit: READING_ROW_MAX_BYTES,
      why: localize("extraction.index.part_omitted", "this document's {key} ({bytes} bytes) is not kept with its reading, which would pass {limit} bytes; its text is kept whole and every line can be searched", { key, bytes: String(bytes), limit: String(READING_ROW_MAX_BYTES) }) });
    const fits = () => !overBytes(JSON.stringify(out), READING_ROW_MAX_BYTES);
    if (out.cells && typeof out.cells === "object" && !Array.isArray(out.cells)) {
      note("cells", sizeOf(out.cells));
      const fmt = typeof out.text_container === "string" ? out.text_container : null;
      const held = fmt && typeof (getFormat(fmt) || {}).cellsIn === "function" ? Object.keys(out.cells) : [];
      out.cells = Object.fromEntries(Object.keys(out.cells).map((k) => [k, null]));
      if (held.length) out.cells_held = [...new Set([...(Array.isArray(out.cells_held) ? out.cells_held : []), ...held])];
      if (fits()) return { reading: out, omitted };
    }
    if (Object.prototype.hasOwnProperty.call(out, "page_boxes") && out.page_boxes) {
      note("page_boxes", sizeOf(out.page_boxes));
      delete out.page_boxes;
      if (fits()) return { reading: out, omitted };
    }
    const ce = out.container_extent;
    if (ce && typeof ce === "object" && Array.isArray(ce.images)) {
      note("container_extent.images", sizeOf(ce.images));
      out.container_extent = { ...ce, images: null, images_why: omitted[omitted.length - 1].why };
    }
    return omitted.length ? { reading: out, omitted } : null;
  }

  /** (fix round 6, G41; R97) The small stated reading that stands in for one too large to keep whole, in the form of reading-pipeline R38's
   *  refusals: a failed reading marked `final` (nothing later changes the size), no entities, no cells, whose `basis` states the size and the largest
   *  key by words, and `too_large` {bytes, key, key_bytes, limit} as data a screen can state. It keeps the reading's content type, reader
   *  version and instant, so the row still says what was read and when. The sizes are counted in slices; only the largest key is stringified again. */
  #statedTooLarge(reading, json) {
    const bytes = utf8Bytes(json);
    let key = null, keyBytes = 0;
    for (const [k, v] of Object.entries(reading && typeof reading === "object" ? reading : {})) {
      let s; try { s = JSON.stringify(v); } catch { s = null; }
      const n = typeof s === "string" ? utf8Bytes(s) : 0;
      if (n > keyBytes) { key = k; keyBytes = n; }
    }
    const size = localize("extraction.index.reading_size", "{mib} MiB ({bytes} bytes)", { mib: (bytes / 1048576).toFixed(1), bytes: String(bytes) });
    const facts = { bytes, key, key_bytes: keyBytes, limit: READING_ROW_MAX_BYTES };
    const basis = localize("extraction.index.reading_too_large",
      "this document's reading is too large to keep whole: {size}; the largest part is {key}", { size, key: key ?? "none" });
    return { facts, reading: {
      content_type: reading && typeof reading.content_type === "string" ? reading.content_type : null,
      reader_version: reading && Number.isInteger(reading.reader_version) ? reading.reader_version : null,
      read_from_text: false, found: false, entities: [], facts: {},
      at: reading && typeof reading.at === "string" ? reading.at : null,
      basis, failure: "final", too_large: facts } };
  }

  /** R69 (T33-23a, K1521, K1555; reading-pipeline R26, record-core R66): held with `afterCommit`, so it runs once, just
   *  after the outermost transaction holding this write has committed (the promotion's, for R20), and never when it
   *  rolls back. This storage's hook registry (`reading-pipeline.readHooksOf`, keyed by the storage as `extractionOf`
   *  keys this module, or the one handed in) has its `afterRead` called with the capture class, the reading's
   *  content-type key (null when it names none, so no hook runs), and the reading as written; the hooks run in
   *  `MODULE_ORDER` there. Answers a promise of `{ran, failed}`, the refusals reported with the reading: a hook's
   *  failure, or `afterRead`'s own, never undoes the committed reading. The run is handed to the object's
   *  `waitUntil`, so a hook finishes. Null when no registry is reachable. */
  #holdAfterRead(captureSha, reading, json) {
    const hooks = this.#readHooks
      || (typeof pipeline.readHooksOf === "function" ? pipeline.readHooksOf(this.#storage) : null);
    if (!hooks || typeof hooks.afterRead !== "function" || !this.core || typeof this.core.afterCommit !== "function") return null;
    const captureClass = typeof reading.content_type === "string" && reading.content_type ? reading.content_type : null;
    let settle;
    const answer = new Promise((r) => { settle = r; });
    this.core.afterCommit(() => {
      const run = (async () => {
        try {
          /* (fix round 6, G40; R95) the hooks are handed their own copy of the reading as written, made here from its JSON, after the commit and
             only when a hook can run for its class (a hook registry that cannot say is asked as before): a large reading is never parsed inside
             the transaction, nor at all when no hook wants it. Never the string itself, which a hook would read as no reading. */
          const wanted = typeof hooks.wants === "function" ? hooks.wants(captureClass) === true : captureClass !== null;
          const a = await hooks.afterRead({ captureSha, captureClass, reading: wanted ? JSON.parse(json) : null, committed: true });
          return { ran: Array.isArray(a && a.ran) ? a.ran : [], failed: Array.isArray(a && a.failed) ? a.failed : [] };
        } catch (e) {
          return { ran: [], failed: [{ module: "reading-pipeline", error: String(e && e.message ? e.message : e) }] };
        }
      })();
      if (this.#host && typeof this.#host.waitUntil === "function") this.#host.waitUntil(run);
      settle(run);
    });
    return answer;
  }

  /* D-536 (R23): every distinct reading kept in arrival order, keyed by the digest of its JSON, before the row is
     replaced; one equal to the latest kept is not kept again; a capture whose one reading predates the history has
     it kept first; each kept reading stores `compareProvenance` against the one before (reading-pipeline R19). */
  #keepReading(bundleId, sha, reading, { json, digest }) {
    const provOf = (r) => (r && typeof r === "object" && r.provenance && typeof r.provenance === "object"
                           && r.provenance.scheme === PROVENANCE_SCHEME ? r.provenance : null);
    const textShaOf = (p) => (p && typeof p.text_sha256 === "string" ? p.text_sha256 : null);
    const now = stampInstant("second");
    let last = this.#one(`SELECT seq, reading_sha256, provenance FROM reading_history WHERE capture_sha=? ORDER BY seq DESC LIMIT 1`, sha);
    if (!last) {
      const prior = this.#one(`SELECT bundle_id, reading,
                                      CASE WHEN json_valid(reading) AND json_type(reading)='object' THEN json_extract(reading, '$.provenance') END AS prov
                                 FROM readings WHERE capture_sha=?`, sha);
      if (prior) {
        const pp = provOf(safeJson(prior.prov));
        const pd = sha256HexSync(prior.reading);
        this.#sql.exec(
          `INSERT INTO reading_history (capture_sha,seq,bundle_id,reading_sha256,reading,provenance,text_sha256,compared,kept_at)
           VALUES (?,?,?,?,?,?,?,NULL,?)`,
          sha, 1, prior.bundle_id, pd, prior.reading, pp ? JSON.stringify(pp) : null, textShaOf(pp), now);
        last = { seq: 1, reading_sha256: pd, provenance: pp ? JSON.stringify(pp) : null };
      }
    }
    if (last && last.reading_sha256 === digest) return { seq: last.seq, added: false, compared: null };
    const np = provOf(reading);
    const compared = last ? compareProvenance(safeJson(last.provenance), np) : null;
    const seq = last ? last.seq + 1 : 1;
    /* (fix round 6, G41; R96) the history row's other new values are measured as the reading is: `provenance` is part of `json`, which the writer
       has already held under the bound, and a comparison of two provenances that passes it is named, never bound. */
    const comparedJson = compared ? JSON.stringify(compared) : null;
    this.#sql.exec(
      `INSERT INTO reading_history (capture_sha,seq,bundle_id,reading_sha256,reading,provenance,text_sha256,compared,kept_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      sha, seq, bundleId, digest, json, np ? JSON.stringify(np) : null, textShaOf(np),
      overBytes(comparedJson, READING_ROW_MAX_BYTES) ? JSON.stringify({ omitted: "too large", bytes: utf8Bytes(comparedJson) }) : comparedJson, now);
    return { seq, added: true, compared };
  }

  #readingHistoryOf(captureSha, cap = READING_HISTORY_SHOWN) {
    const page = this.#rows(
      `SELECT seq, reading_sha256, provenance, text_sha256, compared, kept_at FROM reading_history
        WHERE capture_sha=? ORDER BY seq DESC LIMIT ?`, captureSha, cap + 1);
    const n = this.#one(`SELECT count(*) c FROM reading_history WHERE capture_sha=?`, captureSha).c;
    return { kept: n, limit: cap, truncated: page.length > cap,
             readings: page.slice(0, cap).map((r) => ({
               seq: r.seq, kept_at: r.kept_at, reading_sha256: r.reading_sha256, text_sha256: r.text_sha256,
               provenance: safeJson(r.provenance) || { state: "undetermined",
                 why: "this reading carries no reading provenance (it was written before D-536, or by a "
                    + "caller that did not carry it), so the tier, the member and the text it classified "
                    + "are UNDETERMINED and are not inferred" },
               compared: safeJson(r.compared) })) };
  }

  /* CPDF-10 (R19): the chain projected into columns; no row for an absent or malformed chain (no row and
     `transcribed: 0` are different facts). */
  #writeTextSource(bundleId, sha, chain) {
    if (checkChain(chain)) return;
    const engines = [...new Set(chain.filter((s) => typeof s.engine === "string" && s.engine).map((s) => s.engine))];
    const cals = calibrationsOf(chain);
    this.#sql.exec(
      `INSERT OR REPLACE INTO reading_text_source
         (capture_sha,bundle_id,transcribed,terminal_step,engines,derivation_cap,steps,chain,calibrations)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      sha, bundleId, isTranscribed(chain) ? 1 : 0, terminalStep(chain),
      JSON.stringify(engines), derivationCap(chain), chain.length, JSON.stringify(chain),
      cals.length ? JSON.stringify(cals) : null);
  }

  /** R22, R99, R107: the text index. The capture's rows (and its named gaps, state and landed batches) are deleted first, even when no unit is offered;
   *  blank units dropped (D-531); the rest ordered by `seq` (a caller's order is not the record's) and stored whole: (fix round 9, G128d, G128f) no unit
   *  is cut and no bound of units or bytes drops one, a unit over CAPTURE_TEXT_UNIT_CAP having been chunked into consecutive units by the reader
   *  (reading-pipeline R47); `truncated` is only the wire's own cut (D-685), counted, never made here. A unit with no extent kind, or an address already
   *  written, counted unaddressable. (R99) The units land in batches of at most LAND_BATCH_BYTES of text (a unit over it alone), each batch in its own
   *  `record-core.transact` with its `job_batches` row `(sha, "reading", <batchKey>:<k>)`: a batch landed already is not landed again, so a retried or
   *  re-entered piece leaves each unit once, and a kill between two batches resumes from the next (inside a caller's transaction the batches are its
   *  savepoints and commit with it). (R107) Each unit's `kind` (reading-pipeline R47: `body`, `footnote`, ...; null when the producer names none), a
   *  sheet block's `lineRows` and its cells' `undetermined` list are stored beside its extent. N28: each unit's chain kind is `text-chain.chainKindFor`
   *  for its page (text-chain R81), the document's last step for a unit with no page grain, `undetermined` when neither can be said. D-724: the runs the
   *  wire skipped are named. The state row is written last, in one transaction with the caller's `guard` (asked first: false writes no state and the
   *  answer is null, the batches landed staying, keyed) and `after` (the caller's writes beside the state). The answer gives `offered`, `written`, `truncated`, `over_bound` (the wire's own count), `unaddressable`, the chain kind,
   *  `skipped` and `batches` (landed, and already landed). */
  indexUnits(bundleId, captureSha, units, chain, opts = {}) {
    const run = this.#landSteps(bundleId, captureSha, units, chain, opts);
    for (let r = run.next(); ; r = run.next()) if (r.done) return r.value;
  }

  /** (fix round 10, cause 24 (b); R111) `indexUnits` for a caller that can wait (a tick of the ledger outside any transaction): the turn is given back
   *  (`yieldNow`) after each batch landed, so a request to the object while a large text is landing is answered between two batches, not after all of
   *  them. The units landed, the state and the answer are `indexUnits`'. */
  async indexUnitsYielding(bundleId, captureSha, units, chain, opts = {}) {
    /* the turn is also given before the first batch: the piece was just read, and the requests queued behind that stretch run before it lands */
    await yieldNow();
    const run = this.#landSteps(bundleId, captureSha, units, chain, opts);
    for (let r = run.next(); ; r = run.next()) {
      if (r.done) return r.value;
      await yieldNow();
    }
  }

  /** The body of `indexUnits`, a generator that yields after each batch landed (the synchronous runner ignores it). */
  *#landSteps(bundleId, captureSha, units, chain, { wireOverBound = 0, wireSkipped = null, more = null, append = false, batchKey = "w", guard = null,
                                                    after = null } = {}) {
    /* (fix round 6, G13; R90) `append`: the next piece of a text read in pieces. The capture's earlier units, named gaps and counts stay and this
       piece's are added to them. */
    const before = append ? this.#one(`SELECT * FROM capture_text_state WHERE capture_sha=?`, captureSha) : null;
    if (!append) {
      this.#sql.exec(`DELETE FROM capture_text WHERE capture_sha=?`, captureSha);
      this.#sql.exec(`DELETE FROM capture_text_skipped WHERE capture_sha=?`, captureSha);
      this.#sql.exec(`DELETE FROM job_batches WHERE sha=? AND kind='reading'`, captureSha);
    }
    const list = Array.isArray(units) ? units : [];
    const ordered = list
      .filter((u) => u && typeof u === "object" && typeof u.text === "string" && glyphCount(u.text) > 0)
      .map((u, i) => ({ extent: u.extent, text: u.text, seq: Number.isInteger(u.seq) ? u.seq : i, wireCut: u.truncated === true,
                        kind: typeof u.kind === "string" && u.kind ? u.kind : null,
                        lineRows: Array.isArray(u.lineRows) && u.lineRows.every(Number.isInteger) ? u.lineRows : null,
                        undetermined: Array.isArray(u.undetermined) && u.undetermined.length ? u.undetermined : null }))
      .sort((a, b) => a.seq - b.seq);
    const docKind = checkChain(chain) ? null : terminalStep(chain);
    const kindOf = (extent) => {
      const k = extent && extent.kind === "pdf-page" && Number.isInteger(extent.page)
        ? chainKindFor(chain, extent.page) : (docKind && !chain.some((s) => s && s.extent) ? docKind : null);
      return k || "undetermined";
    };
    let bytes = 0, written = 0, truncatedUnits = 0, unaddressable = 0;
    const kinds = new Set(), unaddressed = [];
    /* the addresses to write, in order, each checked against this write and (appending) the capture's earlier units */
    const seen = new Set(), rows = [];
    for (const u of ordered) {
      const kind = u.extent && typeof u.extent === "object" && typeof u.extent.kind === "string" ? u.extent.kind : null;
      if (!kind) { unaddressable++; unaddressed.push({ seq: u.seq, why: say("extraction.why.unit_names_extent") }); continue; }
      const extent = canonicalExtent(u.extent);
      if (seen.has(extent)) { unaddressable++; unaddressed.push({ seq: u.seq, extent: u.extent, why: say("extraction.why.earlier_unit_holds") }); continue; }
      seen.add(extent);
      rows.push({ u, kind, extent, size: utf8Bytes(u.text) });
    }
    /* R99: whole units, in order, at most LAND_BATCH_BYTES of text a batch */
    const batches = [];
    for (const r of rows) {
      const last = batches[batches.length - 1];
      if (last && last.size + r.size <= LAND_BATCH_BYTES && last.rows.length < LAND_BATCH_UNITS) { last.rows.push(r); last.size += r.size; }
      else batches.push({ rows: [r], size: r.size });
    }
    let landed = 0, already = 0, stopped = false;
    const held = new Set();
    for (let k = 0; k < batches.length && !stopped; k++) {
      const b = batches[k], id = `${batchKey}:${k}`;
      this.core.transact(() => {
        /* a piece read while the state moved lands nothing more (the caller's guard, asked in each batch) */
        if (typeof guard === "function" && guard() === false) { stopped = true; return; }
        if (this.#one(`SELECT 1 AS x FROM job_batches WHERE sha=? AND kind='reading' AND batch=?`, captureSha, id)) { already++; return; }
        for (const { u, kind, extent } of b.rows) {
          if (append && this.#one(`SELECT 1 AS x FROM capture_text WHERE capture_sha=? AND extent_kind=? AND extent=?`, captureSha, kind, extent)) {
            unaddressable++; held.add(u); unaddressed.push({ seq: u.seq, extent: u.extent, why: say("extraction.why.earlier_unit_holds") }); continue;
          }
          const chainKind = kindOf(u.extent);
          this.#sql.exec(
            `INSERT INTO capture_text (capture_sha,bundle_id,extent_kind,extent,ref,seq,text,truncated,chain_kind,kind,line_rows,undetermined)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
            captureSha, bundleId, kind, extent, describeExtent(u.extent), u.seq, u.text, u.wireCut ? 1 : 0, chainKind, u.kind,
            u.lineRows ? JSON.stringify(u.lineRows) : null, u.undetermined ? JSON.stringify(u.undetermined) : null);
        }
        this.#sql.exec(`INSERT INTO job_batches (sha, kind, batch, landed_at) VALUES (?, 'reading', ?, ?)`, captureSha, id, stampInstant("second"));
        landed++;
      });
      if (k < batches.length - 1 && !stopped) yield k;
    }
    /* what the index holds of this write (a batch an earlier try landed counts as written: its units are in the index) */
    for (const { u, size } of rows) {
      if (held.has(u)) continue;
      bytes += size; written++; kinds.add(kindOf(u.extent)); if (u.wireCut) truncatedUnits++;
    }
    const runs = [];
    for (const w of (Array.isArray(wireSkipped) ? wireSkipped : [])) {
      const ok = (e) => e && typeof e === "object" && typeof e.kind === "string";
      if (!w || !ok(w.first) || !ok(w.last) || !Number.isInteger(w.first_seq) || !Number.isInteger(w.last_seq)
          || !Number.isInteger(w.units) || w.units < 1) continue;
      runs.push({ first: w.first, firstExtent: canonicalExtent(w.first), first_seq: w.first_seq,
                  last: w.last, lastExtent: canonicalExtent(w.last), last_seq: w.last_seq, units: w.units, side: "wire" });
    }
    const wire = Number.isInteger(wireOverBound) && wireOverBound > 0 ? wireOverBound : 0;
    const offered = ordered.length + wire;
    const over = wire;
    const chainKind = kinds.size === 1 ? [...kinds][0] : kinds.size ? "mixed" : (docKind || "undetermined");
    /* the state is the capture's, so a piece adds to what the earlier pieces counted; "whole" only when nothing is left over, skipped or
       unaddressable and nothing more follows (R36), so a capture read through its first piece alone is never stated whole */
    const sum = (k, now) => (before ? Number(before[k] || 0) : 0) + now;
    let skippedNamed = 0;
    const skipped = [];
    const wrote = this.core.transact(() => {
      if (typeof guard === "function" && guard() === false) return null;
      for (const r of runs) {
        const fromRef = describeExtent(r.first), toRef = describeExtent(r.last);
        this.#sql.exec(
          `INSERT INTO capture_text_skipped (capture_sha,bundle_id,first_seq,last_seq,units,first_extent,first_ref,last_extent,last_ref,side)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          captureSha, bundleId, r.first_seq, r.last_seq, r.units, r.firstExtent, fromRef, r.lastExtent, toRef, r.side);
        skippedNamed += r.units;
        skipped.push({ from: fromRef, to: toRef, units: r.units, side: r.side,
                       first: { extent: r.first, seq: r.first_seq }, last: { extent: r.last, seq: r.last_seq } });
      }
      const [offeredAll, writtenAll, overAll, unaddrAll, truncAll, skippedAll] = [sum("offered", offered), sum("written", written),
        sum("over_bound", over), sum("unaddressable", unaddressable), sum("truncated", truncatedUnits), sum("skipped_named", skippedNamed)];
      const followed = !!(more && typeof more === "object" && more.more === true && more.cursor != null);
      /* (R101, K4904 (1)) a window stepped past is kept across the pieces that follow, and the index is never whole while it stands */
      const statedKept = append && before && typeof before.stated === "string" && Array.isArray(safeJson(before.stated)) && safeJson(before.stated).length ? before.stated : null;
      const state = !offeredAll ? "none" : (overAll || unaddrAll || followed || statedKept) ? "partial" : "whole";
      const prog = more && typeof more === "object" ? more : null;
      const keptChain = before && before.chain_kind && before.chain_kind !== chainKind ? "mixed" : chainKind;
      this.#sql.exec(
        `INSERT OR REPLACE INTO capture_text_state (capture_sha,bundle_id,state,offered,written,over_bound,unaddressable,
                                                    truncated,skipped_named,chain_kind,at,more,cursor,read_through,total,words_read,stated)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        captureSha, bundleId, state, offeredAll, writtenAll, overAll, unaddrAll, truncAll, skippedAll, keptChain,
        stampInstant("second"), followed ? 1 : 0, followed ? String(prog.cursor) : null,
        prog && Number.isFinite(prog.read_through) ? prog.read_through : null, prog && Number.isFinite(prog.total) ? prog.total : null,
        prog ? (before && Number.isFinite(before.words_read) ? before.words_read : 0) + (Number.isFinite(prog.words) ? prog.words : 0) : null, statedKept);
      if (typeof after === "function") after();
      return state;
    });
    if (wrote === null) return null;
    return { offered, written, bytes, truncated: truncatedUnits, over_bound: over, wire_over_bound: wire,
             unaddressable, unaddressed, chain_kind: chainKind, skipped, skipped_named: skippedNamed, state: wrote,
             batches: { landed, already, bytes: LAND_BATCH_BYTES } };
  }

  /** R61 (N294, K337): a member's authored observation (provenance R28) indexed as its capture's own text, inside
   *  the caller's transaction (a nested `transact` joins it). The capture's index is replaced by R22's rule over one
   *  unit, the words whole at `{kind: "document"}`, `seq` 0, chain null; words holding no glyph are dropped by that
   *  rule and index nothing. No reading, history, reference, name term or text-source row is written, because no
   *  reader ran over the words, and R24's listeners are not called; R62's are, and a throw from one fails the write.
   *  A request naming no bundle or capture writes nothing and answers `written: 0`. */
  indexTestimony({ bundleId = null, captureSha = null, words = null, author = null } = {}) {
    if (typeof bundleId !== "string" || !bundleId || typeof captureSha !== "string" || !captureSha)
      return { offered: 0, written: 0, bytes: 0, truncated: 0, over_bound: 0, wire_over_bound: 0, unaddressable: 0,
               unaddressed: [], chain_kind: "undetermined", skipped: [], skipped_named: 0, state: null,
               why: say("extraction.why.authored_observation_indexed") };
    return this.core.transact(() => {
      const indexed = this.indexUnits(bundleId, captureSha, [{ extent: { kind: "document" }, text: words, seq: 0 }], null);
      for (const l of this.#indexListeners)
        l.fn({ bundleId, captureSha, indexed, author, container: "document" });
      return indexed;
    });
  }

  /* ---- reading the record (R27–R30, R36, R37) ---- */

  /** R27 (`op=reading`): a request naming no digest answers R63's `noSha`. */
  readingFor(captureSha, viewer = null, { after = null } = {}) {
    if (typeof captureSha !== "string" || !captureSha) return noSha("a reading is read by its capture sha256");
    const row = this.#one(
      `SELECT capture_sha, bundle_id, content_type, reader_version, found, entity_count, at,
              origin, asserted_by, asserted_standing, justification, capture_format
         FROM readings WHERE capture_sha=?`, captureSha);
    /* (fix round 9, G127a; R104, restating R88) a part's digest is no capture: it is answered as any digest whose reading is not held, and is never
       resolved to a whole (a part shared by two wholes names neither). */
    if (!row) {
      const reg = this.#heldAsRegister(captureSha);
      return { ok: true, found: false, capture_sha: captureSha, reading: null, ...(reg ? { held_as_register: reg } : {}) };
    }
    /* (fix round 6, G38; R94) the stored reading is read through SQL's JSON, so a bulky key never enters the object: it is named in
       `reading_omitted` and left out of `reading`. */
    const { reading: stored, omitted } = this.#readingBounded(row.capture_sha);
    let reading = stored;
    const ts = this.#one(
      `SELECT transcribed, terminal_step, engines, derivation_cap, steps FROM reading_text_source WHERE capture_sha=?`, captureSha);
    const chain = reading && reading.text_source !== undefined ? reading.text_source : null;
    /* R76 (T49; K3387): the capture's units as `unitsOf` (R36) answers them, withheld with the bundle (as R27's
       `unread_pages`); `[]` for a capture read and never indexed, absent only for a capture not read (R45). */
    const withheld = !!row.bundle_id && this.#redactor(viewer)(row.bundle_id) === null;
    /* (fix round 6, G13; R76 amended; BOB's K4577) at most 4,096 units an answer; `after` (a unit's `seq`) asks the page after it, and `next`
       is the `seq` to ask after this one, null at the end, so every unit of a capture read whole is reachable here. */
    const page = withheld ? null : this.unitsOf(row.capture_sha, { after: Number.isInteger(after) ? after : null, maxBytes: READING_PAGE_BYTES });
    /* (fix round 9, G134d; R107) each unit's kind (null for a unit stored before), and a sheet block's rows when stored */
    const text_units = page ? page.units.map((u) => ({ extent: u.extent, reference: u.ref, text: u.text, truncated: u.truncated, kind: u.kind,
                                                        ...(u.lineRows ? { lineRows: u.lineRows } : {}), ...(u.undetermined ? { undetermined: u.undetermined } : {}) })) : undefined;
    const next = page ? (page.next ?? null) : undefined;
    /* (G14; K4579) what the capture's text index holds of it, stated: never "full" for a text the bounds cut, never "none" for one
       refused whole. `units_total` is the units indexed so far. */
    const completeness = withheld ? undefined : this.#completenessOf(row.capture_sha);
    const unitsTotal = withheld ? undefined : this.#one(`SELECT count(*) c FROM capture_text WHERE capture_sha=?`, row.capture_sha).c;
    /* R77 (T51; K4103; amends R27): `bytes` is the stored size of the capture's original as the register holds it, absent
       when the register holds no row for it, and withheld with the bundle as `text_units` is (a bundle a viewer may not
       see names no size of its own). */
    const home = this.#provenance && typeof this.#provenance.homeOf === "function" ? this.#provenance.homeOf(row.capture_sha) : null;
    const bytes = home && this.#redactor(viewer)(home.bundleId) !== null ? home.bytes : undefined;
    /* R78 (T51; K4127; amends R77): `format` is the reading's own capture format, a format-registry id, absent when the
       reading holds none, and withheld with the bundle as `bytes` is. */
    const format = withheld || row.capture_format == null || row.capture_format === "" ? undefined : row.capture_format;
    /* R90 (fix round 6, G13): a text read in pieces states how far it has been read, and is never stated complete while more follows. */
    const piece = this.#one(`SELECT more, read_through, total, words_read FROM capture_text_state WHERE capture_sha=?`, row.capture_sha);
    const progress = piece && (piece.more || piece.total != null)
      ? { more: !!piece.more, read_through: piece.read_through ?? null, total: piece.total ?? null } : null;
    /* the first piece's reading counted the words of its own piece (reading-pipeline R40); the words read are the capture's so far. (fix round 7,
       G71; R90) For any piece-read state: a PDF read by page ranges answers `words_total` null, and its figure was the first piece's. The
       override reads the state, so an old reading's stale figure is repaired on read, with no write. */
    if (progress && reading && typeof reading === "object" && Number.isFinite(piece.words_read)) reading = { ...reading, words_read: piece.words_read };
    return { ok: true, found: true, capture_sha: row.capture_sha,
             bundle_id: this.#redactor(viewer)(row.bundle_id),
             content_type: row.content_type, reader_version: row.reader_version,
             reader_found: !!row.found, entity_count: row.entity_count, at: row.at, reading,
             /* R21 (K104): whose reading this is. */
             origin: row.origin == null
               ? { state: "undetermined", why: say("extraction.why.reading_recorded_record") }
               : row.origin === "asserted"
                 ? { state: "asserted", asserted_by: row.asserted_by, standing: row.asserted_standing,
                     justification: row.justification, why: say("extraction.why.group_civicsmith_did") }
                 : { state: "composed", why: say("extraction.why.group_civicsmith_read") },
             text_provenance: ts
               ? { transcribed: !!ts.transcribed, terminal_step: ts.terminal_step,
                   engines: safeJson(ts.engines) || [], derivation_cap: ts.derivation_cap,
                   steps: ts.steps, chain, says: describeChain(chain) }
               : { recorded: false,
                   why: localize("extraction.index.no_text_provenance_recorded", "this reading carries no text provenance, which is not the same as its text not having been transcribed -- nobody recorded how it was produced") },
             reading_history: this.#readingHistoryOf(row.capture_sha),
             ...this.#unreadOf(row.capture_sha, reading, viewer, row.bundle_id, row.capture_format),
             /* R89 (fix round 6, G8): a reading that says the document was not read as text, and that no read has found nothing to
                repair it by under this release, states it may be repaired (the member's press, "Read it", is offered for it). */
             ...(notReadAsText(reading) && !this.#repairTried(row.capture_sha) ? { repairable: true } : {}),
             /* R120 (T53; N1266): a reading held and named states it, with the type's name as the reading carries it (reading-pipeline R67), and whether a read under this
                release has found its type still on no list; absent for any other reading, and once a reading with units replaces it. */
             ...(reading && typeof reading.held_unread === "object" && reading.held_unread && this.#heldUnread(row.capture_sha)
                 ? { held_unread: { ...reading.held_unread, still_unlisted: this.#repairTried(row.capture_sha) } } : {}),
             ...(omitted.length ? { reading_omitted: omitted } : {}),
             ...(text_units ? { text_units, next } : {}),
             ...(completeness ? { completeness, units_total: unitsTotal } : {}),
             ...(bytes === undefined ? {} : { bytes }),
             ...(format === undefined ? {} : { format }),
             ...(progress && !withheld ? progress : {}) };
  }

  /** (G14; R91; fix round 9, G128a, G128b; R100) The reading's completeness, one fact: `reading-pipeline.completenessOf` (its R48) over the capture's
   *  counters and whether more follows, and nothing else (not the reading object's own words, not a screen's correction). `state` is `whole`, `partial`,
   *  `stated` (the document was not read whole and the reading says why: `failure`, `why`) or `none`; `counters` `{written, skipped, owed, failed}`;
   *  `owed` names what is owed (`pages`: the OCR pages left, `cursor` the first; `pictures`: unread pictures inside text pages); the runs skipped named.
   *  `unitsOf` answers the same `state` (R36 as R100 amends it). Null for a capture never indexed and not stated. */
  #completenessOf(sha) {
    const st = this.#one(`SELECT * FROM capture_text_state WHERE capture_sha=?`, sha);
    const f = this.#completenessFacts(sha);
    const failedFinal = !!f && f.found === false && f.failure === "final" && !f.entities;
    if (!st) return failedFinal ? { state: "stated", failure: "final", why: f.basis ?? null } : { state: "none" };
    const skipped = this.#rows(`SELECT first_seq, last_seq, units, first_ref, last_ref, side FROM capture_text_skipped WHERE capture_sha=? ORDER BY first_seq`, sha)
      .map((k) => ({ from: k.first_ref, to: k.last_ref, units: k.units, side: k.side, first_seq: k.first_seq, last_seq: k.last_seq }));
    const statedUnits = Array.isArray(safeJson(st.stated)) ? safeJson(st.stated) : [];
    const owed = this.#owedOf(sha, f);
    const counters = { written: st.written,
      /* stated unread: over the wire's bound, unaddressable, cut by the wire, a window stepped past, an OCR page refused or killed, the rest of a read
         that ended before its last piece */
      skipped: (() => { const n = st.over_bound + st.unaddressable + st.truncated + statedUnits.length + (f ? f.refusedPages : 0) + (st.ended_why ? 1 : 0);
        /* an index its writer stated partial with no cause counted (an older store's row) is never read as whole */
        return n || (st.state === "partial" && !st.more ? 1 : 0); })(),
      owed: owed.count, failed: f && f.found === false && f.failure === "transient" && !f.entities ? 1 : 0 };
    const state = pipeline.completenessOf(counters, { more: !!st.more, final: failedFinal, refused: !!(f && f.tooLarge), reading: f });
    const counts = { offered: st.offered, written: st.written, over_bound: st.over_bound, unaddressable: st.unaddressable,
                     truncated: st.truncated, skipped_named: st.skipped_named };
    return { state, counts, counters, skipped,
             ...(owed.count ? { owed: { ...(owed.pages ? { pages: owed.pages, cursor: owed.cursor } : {}), ...(owed.pictures ? { pictures: owed.pictures } : {}) } } : {}),
             ...(state === "stated" ? { failure: "final", why: f ? f.basis ?? null : null } : {}),
             /* R101 (G129b): a read in pieces that ended before its last piece says why */
             ...(state === "partial" && typeof st.ended_why === "string" && st.ended_why ? { why: st.ended_why } : {}),
             /* R101 (K4904 (1)): each window stepped past, stated (R-SILENT) */
             ...(statedUnits.length ? { stated_units: statedUnits } : {}) };
  }

  /** (R100) The stored reading's facts completeness reads, by SQL (a large reading is never parsed for them): `found`, `failure`, `basis`, whether it
   *  holds entities, `tooLarge` (R97's statement), `ocr_left`, `tier3_candidate`, `pictures_unread`, the OCR pages refused or killed (`refusedPages`) and the
   *  page count. Null for a capture with no reading. */
  #completenessFacts(sha) {
    const r = this.#one(
      `SELECT json_type(reading, '$.found') AS ft, json_extract(reading, '$.failure') AS failure, json_extract(reading, '$.basis') AS basis,
              json_array_length(reading, '$.entities') AS en, json_type(reading, '$.too_large') AS tl, json_extract(reading, '$.ocr_left') AS ol,
              json_type(reading, '$.tier3_candidate') AS t3, json_extract(reading, '$.pictures_unread') AS pu,
              json_array_length(reading, '$.ocr_refused') AS orf, json_extract(reading, '$.page_count') AS pc
         FROM readings WHERE capture_sha=? AND json_valid(reading) AND json_type(reading)='object'`, sha);
    if (!r) return null;
    return { found: r.ft === "true" ? true : r.ft === "false" ? false : undefined, failure: typeof r.failure === "string" ? r.failure : undefined,
             basis: typeof r.basis === "string" ? r.basis : undefined, entities: Number(r.en) > 0, tooLarge: r.tl === "object",
             ocrLeft: safeJson(r.ol), tier3: r.t3 === "true", pictures: Number.isInteger(r.pu) && r.pu > 0 ? r.pu : 0,
             refusedPages: Number.isInteger(r.orf) ? r.orf : 0, pageCount: Number.isInteger(r.pc) && r.pc > 0 ? r.pc : null };
  }

  /** (R100; G128a, G128b; reading-pipeline R48) What a capture still owes: the OCR pages `ocr_left` names (its count and cursor), else, for a reading still
   *  wanting OCR (`tier3_candidate`), the pages its index holds no glyph of less the pages refused; and each unread picture inside a text page. */
  #owedOf(sha, f) {
    if (!f) return { count: 0 };
    let pages = 0, cursor = null;
    if (f.ocrLeft && Number.isInteger(f.ocrLeft.pages) && f.ocrLeft.pages > 0) { pages = f.ocrLeft.pages; cursor = Number.isInteger(f.ocrLeft.cursor) ? f.ocrLeft.cursor : null; }
    else if (f.tier3 && f.pageCount) {
      const unread = this.#unreadPagesOf(sha, f.pageCount);
      pages = Math.max(0, unread.length - f.refusedPages);
      cursor = pages ? unread[0] : null;
    }
    return { count: pages + f.pictures, pages, cursor, pictures: f.pictures };
  }

  /** R27 (T43; N862; DEC-190 (1), (2)): the pages a reading with pages could not make out, ascending: those holding no
   *  glyph after every tier, which are the pages `reading-pipeline.tier4Pages` would ask for (the index holds a page's
   *  unit exactly when it holds a glyph, reading-pipeline R15; a page the index skipped over its bound is not unread).
   *  `[]` when none; absent for a reading with no pages (R45). With pages, `unread_says` is `document.unread.pages`
   *  filled. Both withheld with the bundle. (T44; N869, N876; DEC-191 (5), DEC-192 (6)) A photographed page, a reading
   *  of a `jpeg` or `png` capture with its one page unread, says `capture.picture.unread` instead. The capture format
   *  is the one the reading was written with (R30's `captureFormat`), else, when that names no picture format (a photo
   *  profiled before its entry was registered), the reading's own `text_container`. */
  #unreadOf(captureSha, reading, viewer, bundleId, captureFormat = null) {
    const n = reading && reading.page_count;
    if (!(Number.isInteger(n) && n > 0)) return {};
    if (bundleId && this.#redactor(viewer)(bundleId) === null) return {};
    const read = new Set();
    /* (fix round 6, G38) a few units at a time (by `seq`), never the capture's whole text at once: a 1,354-page volume's pages are 14 MB,
       and holding them beside the answer's own page killed the object at its limit. */
    for (let at = -1, more = true; more;) {
      const chunk = this.#rows(
        `SELECT seq, extent, text FROM capture_text WHERE capture_sha=? AND extent_kind='pdf-page' AND seq > ? ORDER BY seq LIMIT 32`, captureSha, at);
      for (const u of chunk) {
        const e = safeJson(u.extent);
        if (e && Number.isInteger(e.page) && glyphCount(u.text) > 0) read.add(e.page);
      }
      more = chunk.length === 32;
      if (chunk.length) at = chunk[chunk.length - 1].seq;
    }
    const pages = Array.from({ length: n }, (_, p) => p).filter((p) => !read.has(p));
    const picture = PICTURE_FORMATS.includes(captureFormat) || PICTURE_FORMATS.includes(reading.text_container);
    const says = picture && pages.length === 1 && pages[0] === 0 && n === 1
      ? fillWords("capture.picture.unread") : fillWords("document.unread.pages", { pages: pagesSaid(pages) });
    return { unread_pages: pages, ...(pages.length ? { unread_says: says } : {}) };
  }

  /** R28 (`op=readingref`): every captured document whose reading carries `ref` exactly, one entry per document
   *  with its first position and, read at several places, every occurrence in reading order; R48: bounded. */
  documentsByReference(ref, viewer = null, limit = null) {
    if (typeof ref !== "string" || !ref)
      return { ok: true, ref: typeof ref === "string" ? ref : null, count: 0, documents: [] };
    const cap = Math.max(1, Math.min(Math.floor(Number(limit) || TEXT_SOURCE_LIMIT_DEFAULT), TEXT_SOURCE_LIMIT_MAX));
    const docs = this.#rows(
      `SELECT DISTINCT capture_sha, bundle_id FROM reading_refs WHERE ref=? ORDER BY bundle_id, capture_sha LIMIT ?`,
      ref, cap + 1);
    const truncated = docs.length > cap;
    const keep = this.#redactor(viewer);
    const documents = [];
    for (const d of docs.slice(0, cap)) {
      const rows = this.#rows(
        `SELECT rr.capture_sha, rr.bundle_id, rr.ref, rr.ref_kind, rr.ref_key, rr.label, rr.pos_kind, rr.pos, rr.pos_ref,
                r.content_type
           FROM reading_refs rr LEFT JOIN readings r ON r.capture_sha = rr.capture_sha
          WHERE rr.ref=? AND rr.capture_sha=? ORDER BY rr.seq`, ref, d.capture_sha);
      if (!rows.length) continue;
      const r0 = rows[0];
      const position = readingSourceFromColumns(r0.pos_kind, r0.pos, r0.pos_ref);
      documents.push({ capture_sha: r0.capture_sha, bundle_id: keep(r0.bundle_id), ref: r0.ref, kind: r0.ref_kind,
        key: r0.ref_key, label: r0.label, content_type: r0.content_type, position,
        ...(rows.length > 1 ? { occurrences: rows.map((r) => readingSourceFromColumns(r.pos_kind, r.pos, r.pos_ref)) } : {}) });
    }
    return { ok: true, ref, count: documents.length, limit: cap, truncated, documents };
  }

  /** R29 (`op=textprovenance`). */
  transcribedDocuments({ terminalStep: step = null, transcribed = null, limit = null, viewer = null } = {}) {
    const where = [], args = [];
    if (transcribed !== null) { where.push(`transcribed=?`); args.push(transcribed ? 1 : 0); }
    if (typeof step === "string" && step) { where.push(`terminal_step=?`); args.push(step); }
    const cap = Math.max(1, Math.min(Math.floor(Number(limit) || TEXT_SOURCE_LIMIT_DEFAULT), TEXT_SOURCE_LIMIT_MAX));
    const page = this.#rows(
      `SELECT capture_sha, bundle_id, transcribed, terminal_step, engines, derivation_cap, steps
         FROM reading_text_source${where.length ? ` WHERE ${where.join(" AND ")}` : ""}
        ORDER BY bundle_id, capture_sha LIMIT ?`, ...args, cap + 1);
    const keep = this.#redactor(viewer);
    return { ok: true, count: Math.min(page.length, cap), limit: cap, truncated: page.length > cap,
             kinds: Object.keys(STEP_KINDS),
             documents: page.slice(0, cap).map((r) => ({
               capture_sha: r.capture_sha, bundle_id: keep(r.bundle_id),
               transcribed: !!r.transcribed, terminal_step: r.terminal_step,
               engines: safeJson(r.engines) || [], derivation_cap: r.derivation_cap, steps: r.steps })) };
  }

  /** R30: the persisted reading's facts `content` bounds a citation by. Withholds nothing. */
  readingOf(captureSha) {
    const row = typeof captureSha === "string" && captureSha
      ? this.#one(`SELECT reading, capture_format FROM readings WHERE capture_sha=?`, captureSha) : null;
    if (!row) return null;
    const reading = safeJson(row.reading) || null;
    const chain = reading && Array.isArray(reading.text_source) ? reading.text_source : null;
    const pc = reading && reading.page_count;
    return { reading, chain,
             pageCount: Number.isInteger(pc) && pc > 0 ? pc : null,
             ...(reading && Object.prototype.hasOwnProperty.call(reading, "container_extent")
               ? { containerExtent: reading.container_extent } : {}),
             /* N100: the boxes as reading-pipeline R12 states them, as stored: absent never stored, null stored null. */
             ...(reading && Object.prototype.hasOwnProperty.call(reading, "page_boxes")
               ? { pageBoxes: reading.page_boxes } : {}),
             textContainer: reading && typeof reading.text_container === "string" ? reading.text_container : null,
             captureFormat: typeof row.capture_format === "string" ? row.capture_format : null };
  }

  /* ---- interpretation (R114-R119; T53; N1272; K4636, K5445, K5496) ---- */

  /** R119: the most interpretation rows a team may hold live: `opts.interpretationCeiling` (a number, or a function answering one or null) when
   *  handed, else the service level's `interpretation_rows` (`runtime-limits`, null until PLATFORM records it); null is no ceiling yet. */
  #interpretationCeiling() {
    let v = this.#ceiling;
    try { if (typeof v === "function") v = v(); } catch { v = null; }
    if (v === undefined) {
      const names = ["team", "institution", "enterprise"];
      try { v = READ_BOUNDS.level[names[levelOf({ design_stage: this.env.DESIGN_STAGE, cf_plan: this.env.CF_PLAN }) - 1]].interpretation_rows; } catch { v = null; }
    }
    return Number.isInteger(v) && v >= 0 ? v : null;
  }

  /** R114: the member a stamp names, or null for none or a machine identity. */
  static #memberOf(by) {
    const id = typeof by === "string" ? by.replace(/^member:/, "").trim() : "";
    return id && !isMachineIdentity(by) ? id : null;
  }

  /* R114: an interpretation row as it is answered. */
  static #interpretationOut(r, withdrawn = false) {
    return { id: r.id, capture: r.capture_sha, part: safeJson(r.part), project: r.project, by: r.by, at: r.at, how: r.how, basis: r.basis,
             ...(r.proposal ? { proposal: r.proposal } : {}), ...(r.matched ? { matched: safeJson(r.matched) } : {}),
             ...(r.began_from ? { began_from: r.began_from } : {}), withdrawn };
  }

  #liveRow(sha, partKey, project) {
    return this.#one(
      `SELECT i.* FROM interpretations i LEFT JOIN interpretation_withdrawals w ON w.interpretation_id = i.id
        WHERE i.capture_sha=? AND i.part_key=? AND i.project=? AND w.interpretation_id IS NULL ORDER BY i.seq LIMIT 1`, sha, partKey, project);
  }

  /** R114, R117 (T53; N1272): `interpretPart({capture, part, project, how, by, proposal?, standing?, began_from?, viewer?, content?, env?})`, the one recorded act of
   *  interpreting: one part of a held capture, for one project, by a signed-in member. `how` is `opened`, `cited`, `marked` or `accepted_proposal`; with
   *  `accepted_proposal`, `proposal` names (its id, and what it matched) a proposal in `standing`, the proposals standing for the project and capture at
   *  this instant as the caller (`investigation`, a layer above) lists them: one not in it is refused `PROPOSAL_NOT_STANDING`, one whose part is not
   *  this part is recorded `unaided` with `began_from`, never `accepted`. Written once for `(capture, part, project)`: a second act on a part with a live
   *  row records nothing and answers that row (`recorded: false`). The part's facts are made once for `(capture, part)` (`reading-pipeline.interpretUnits`,
   *  or the `content` the caller already made, `cellsOf`'s), the second project reusing them. A team at its ceiling (R119) is refused, nothing recorded.
   *  Never throws. Nothing here is called by `read`, intake or any batch path (K4636). */
  async interpretPart({ capture = null, part = null, project = null, how = null, by = null, proposal = null, standing = null, began_from = null,
                        viewer = null, content = null, env = null } = {}) {
    try {
      return await this.#interpretPart({ capture, part, project, how, by, proposal, standing, began_from, viewer, content, env });
    } catch (e) {
      return refusals.failed(e && e.message ? e.message : "an unexpected error");
    }
  }

  async #interpretPart({ capture, part, project, how, by, proposal, standing, began_from, viewer, content, env }) {
    const memberId = Extraction.#memberOf(by);
    if (!memberId) return refusals.memberSession();
    const asViewer = typeof viewer === "string" ? viewer : `member:${memberId}`;
    const sha = typeof capture === "string" ? capture.trim().toLowerCase() : "";
    const held = /^[0-9a-f]{64}$/.test(sha) ? this.#one(`SELECT bundle_id FROM readings WHERE capture_sha=?`, sha) : null;
    if (!held || !this.#sees(held.bundle_id, asViewer)) return refusals.notFound();
    if (typeof project !== "string" || !project.trim()) return refusals.noProject();
    if (!this.membership || !this.membership.inSight(project, asViewer)) return noSuchProject(project);
    const mine = this.membership.participation(project, memberId);
    if (!mine || !(mine.state === "joined" || mine.state === "leaving")) return notAParticipant(project, by);
    if (!INTERPRET_HOW.includes(how)) return refusals.badHow();
    const p = normalPart(part);
    if (!p) return refusals.badPart();

    /* R117: the basis. An accepted proposal must stand; the member's own part, or a changed one, is unaided (a changed one remembers what it began from). */
    const named = proposal && typeof proposal === "object" && !Array.isArray(proposal) ? proposal : typeof proposal === "string" && proposal ? { id: proposal } : null;
    let basis = "unaided", proposalId = null, matched = null, from = typeof began_from === "string" && began_from ? began_from : null, actHow = how;
    const list = Array.isArray(standing) ? standing.filter((s) => s && typeof s === "object" && typeof s.id === "string") : [];
    if (how === "accepted_proposal") {
      if (!named || typeof named.id !== "string" || !named.id) return refusals.notStanding(named && named.id ? named.id : null);
      const live = this.#liveRow(sha, p.key, project);
      if (live) return { ok: true, recorded: false, id: live.id, interpretation: Extraction.#interpretationOut(live) };
      const s = list.find((x) => x.id === named.id && (x.capture === undefined || x.capture === sha));
      if (!s) return refusals.notStanding(named.id);
      if (samePart(s.part, p.part)) { basis = "accepted"; proposalId = s.id; matched = named.matched ?? s.why ?? null; }
      else { actHow = "marked"; from = s.id; }
    }

    const live = this.#liveRow(sha, p.key, project);
    if (live) return { ok: true, recorded: false, id: live.id, interpretation: Extraction.#interpretationOut(live) };

    /* R119: a mark that would pass the team's ceiling is refused with the figure and the number held. */
    const ceiling = this.#interpretationCeiling();
    const heldNow = this.#one(
      `SELECT count(*) AS n FROM interpretations i LEFT JOIN interpretation_withdrawals w ON w.interpretation_id = i.id WHERE w.interpretation_id IS NULL`).n;
    if (ceiling !== null && heldNow + 1 > ceiling) return refusals.limit(ceiling, heldNow);

    /* the part's facts, made once for (capture, part) */
    const kept = this.#one(`SELECT content_bytes FROM interpreted_content WHERE capture_sha=? AND part_key=?`, sha, p.key);
    let json = null, bytes = 0;
    if (!kept) {
      let made = content;
      if (made === null || made === undefined) {
        const interpreter = this.#interpreter ?? (typeof pipeline.interpretUnits === "function" ? pipeline.interpretUnits : null);
        const ev = this.core && typeof this.core.evidenceStore === "function" ? this.core.evidenceStore() : null;
        if (!interpreter) return refusals.notRead();
        const document = this.#storedDocument(held.bundle_id, sha) || { capture: { sha256: sha } };
        let got;
        try { got = await interpreter(document, p.part, { evidence: ev, env: env || this.env, view: this.view() }); }
        catch (e) { return refusals.failed(e && e.message ? e.message : "the reader stopped", { transient: true }); }
        if (!got || got.ok === false) return refusals.failed(got && got.reason ? got.reason : "no facts were made", { transient: !!(got && got.transient) });
        made = got;
      }
      json = JSON.stringify(made);
      bytes = utf8Bytes(json);
      if (bytes > READING_ROW_MAX_BYTES) json = null;
    }

    const at = stampInstant("second");
    const recorded = this.core.transact(() => {
      const again = this.#liveRow(sha, p.key, project);
      if (again) return { row: again, wrote: false };
      const seq = this.#one(`SELECT COALESCE(MAX(seq), 0) + 1 AS n FROM interpretations`).n;
      const id = `INT-${sha256HexSync(`${seq}|${sha}|${p.key}|${project}|${at}`).slice(0, 12)}`;
      const row = { id, seq, capture_sha: sha, bundle_id: held.bundle_id, part_key: p.key, part: p.key, project, by: memberId, at, how: actHow, basis,
                    proposal: proposalId, matched: matched === null ? null : JSON.stringify(matched), began_from: from,
                    standing: list.length ? JSON.stringify(list.slice(0, STANDING_RECORDED_MAX).map((s) => s.id)) : null };
      this.#sql.exec(
        `INSERT INTO interpretations (id,seq,capture_sha,bundle_id,part_key,part,project,by,at,how,basis,proposal,matched,began_from,standing)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        row.id, row.seq, row.capture_sha, row.bundle_id, row.part_key, row.part, row.project, row.by, row.at, row.how, row.basis, row.proposal,
        row.matched, row.began_from, row.standing);
      if (!kept) this.#sql.exec(
        `INSERT OR IGNORE INTO interpreted_content (capture_sha,bundle_id,part_key,content,content_bytes,made_at) VALUES (?,?,?,?,?,?)`,
        sha, held.bundle_id, p.key, json, bytes, at);
      return { row, wrote: true };
    });
    return { ok: true, recorded: recorded.wrote, id: recorded.row.id, interpretation: Extraction.#interpretationOut(recorded.row) };
  }

  /** R118 (T53; N1272; K5445 B): `interpretationWithdraw({id, by, viewer?})` appends a withdrawal for an interpretation row of a project the member
   *  is in; the row stays in the log, "interpreted for" is no longer stated for the part while no live row stands for it, and the part's facts go only when
   *  no live row of any project uses them (they are derived, and made again). A citation already made is not touched here. A second withdrawal changes
   *  nothing. Never throws. */
  interpretationWithdraw({ id = null, by = null, viewer = null } = {}) {
    try {
      const memberId = Extraction.#memberOf(by);
      if (!memberId) return refusals.memberSession();
      const asViewer = typeof viewer === "string" ? viewer : `member:${memberId}`;
      const row = typeof id === "string" && id ? this.#one(`SELECT * FROM interpretations WHERE id=?`, id) : null;
      if (!row || !this.#sees(row.bundle_id, asViewer) || !this.membership || !this.membership.inSight(row.project, asViewer)) return refusals.noRow();
      const mine = this.membership.participation(row.project, memberId);
      if (!mine || !(mine.state === "joined" || mine.state === "leaving")) return notAParticipant(row.project, by);
      const at = stampInstant("second");
      return this.core.transact(() => {
        if (this.#one(`SELECT 1 AS x FROM interpretation_withdrawals WHERE interpretation_id=?`, id))
          return { ok: true, withdrawn: true, already: true, id };
        this.#sql.exec(`INSERT INTO interpretation_withdrawals (interpretation_id,capture_sha,bundle_id,project,by,at) VALUES (?,?,?,?,?,?)`,
          id, row.capture_sha, row.bundle_id, row.project, memberId, at);
        const used = this.#one(
          `SELECT 1 AS x FROM interpretations i LEFT JOIN interpretation_withdrawals w ON w.interpretation_id = i.id
            WHERE i.capture_sha=? AND i.part_key=? AND w.interpretation_id IS NULL LIMIT 1`, row.capture_sha, row.part_key);
        if (!used) this.#sql.exec(`DELETE FROM interpreted_content WHERE capture_sha=? AND part_key=?`, row.capture_sha, row.part_key);
        return { ok: true, withdrawn: true, already: false, id, content_kept: !!used };
      });
    } catch (e) {
      return refusals.failed(e && e.message ? e.message : "an unexpected error");
    }
  }

  /** R116: the capture's extent, from the reading's own units, as `{kind, ...range}` universes in the extent's numbering: PDF pages (0-based, to the
   *  stored page count when it is a whole number), paragraphs (0-based), slides (from 1) and each sheet's rows (from 1). Counted by SQL; no unit's
   *  text is loaded. */
  #extentOf(sha) {
    const out = [];
    const pages = this.#one(`SELECT MAX(CAST(json_extract(extent,'$.page') AS INTEGER)) AS hi FROM capture_text WHERE capture_sha=? AND extent_kind='pdf-page'`, sha);
    const pc = this.#one(`SELECT CASE WHEN json_valid(reading) AND json_type(reading)='object' THEN json_extract(reading,'$.page_count') END AS n FROM readings WHERE capture_sha=?`, sha);
    const pageTop = Math.max(Number.isInteger(pages && pages.hi) ? pages.hi : -1, Number.isInteger(pc && pc.n) && pc.n > 0 ? pc.n - 1 : -1);
    if (pageTop >= 0) out.push({ kind: "pdf-page", from: 0, to: pageTop });
    const paras = this.#one(`SELECT MAX(CAST(json_extract(extent,'$.para') AS INTEGER)) AS hi FROM capture_text WHERE capture_sha=? AND extent_kind='doc-para'`, sha);
    if (paras && Number.isInteger(paras.hi)) out.push({ kind: "doc-para", from: 0, to: paras.hi });
    const slides = this.#one(`SELECT MAX(CAST(json_extract(extent,'$.slide') AS INTEGER)) AS hi FROM capture_text WHERE capture_sha=? AND extent_kind='slide-shape'`, sha);
    if (slides && Number.isInteger(slides.hi) && slides.hi >= 1) out.push({ kind: "slide", from: 1, to: slides.hi });
    const seen = new Map();
    for (const r of this.#rows(`SELECT json_extract(extent,'$.sheet') AS sheet, json_extract(extent,'$.range') AS range FROM capture_text WHERE capture_sha=? AND extent_kind='sheet-range'`, sha)) {
      if (typeof r.sheet !== "string" || typeof r.range !== "string") continue;
      const rows = [...r.range.matchAll(/[A-Za-z]*\$?([1-9][0-9]*)/g)].map((m) => Number(m[1]));
      if (!rows.length) continue;
      const cur = seen.get(r.sheet) ?? { lo: Infinity, hi: 0 };
      seen.set(r.sheet, { lo: Math.min(cur.lo, ...rows), hi: Math.max(cur.hi, ...rows) });
    }
    for (const [sheet, v] of [...seen].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) out.push({ kind: "sheet-range", sheet, from_row: 1, to_row: v.hi });
    return out;
  }

  /** R116 (T53; N1272; K4571; K5495): `interpretationOf({capture, project?, viewer})` answers what was and was not interpreted, so it is always answerable:
   *  `read` (`progressOf`'s state for the capture, so a reading still being read says so), `parts` (every live row of a project the viewer may see),
   *  `for_this` (the rows of `project`) and `for_others` (the others), and `not_interpreted`, the capture's extent less the parts (`project`'s own when
   *  one is named, else every visible one) as ranges of the reading's own extent, never the word "rest". A project the viewer may not see is never
   *  answered, not even that it holds a row. Interpretation narrows nothing: every unit stays indexed and found by search. Read-only; never throws. */
  interpretationOf({ capture = null, project = null, viewer = null } = {}) {
    const sha = typeof capture === "string" ? capture.trim().toLowerCase() : "";
    const held = /^[0-9a-f]{64}$/.test(sha) ? this.#one(`SELECT bundle_id FROM readings WHERE capture_sha=?`, sha) : null;
    if (!held || !this.#sees(held.bundle_id, viewer)) return refusals.notFound();
    const sees = new Map();
    const visible = (p) => { if (!sees.has(p)) sees.set(p, !!this.membership && this.membership.inSight(p, viewer)); return sees.get(p); };
    const rows = this.#rows(
      `SELECT i.* FROM interpretations i LEFT JOIN interpretation_withdrawals w ON w.interpretation_id = i.id
        WHERE i.capture_sha=? AND w.interpretation_id IS NULL ORDER BY i.seq`, sha).filter((r) => visible(r.project));
    const out = rows.map((r) => Extraction.#interpretationOut(r));
    const mineRows = typeof project === "string" && project ? rows.filter((r) => r.project === project) : null;
    const counted = (mineRows ?? rows).map((r) => safeJson(r.part)).filter(Boolean);
    const notInterpreted = [];
    for (const u of this.#extentOf(sha)) {
      const r = RANGE_KINDS[u.kind];
      const ranges = counted.filter((q) => q.kind === u.kind && (u.kind !== "sheet-range" || q.sheet === u.sheet)).map((q) => [q[r.from], q[r.to]]);
      for (const [a, b] of uncovered([[u[r.from], u[r.to]]], ranges))
        notInterpreted.push({ kind: u.kind, ...(u.kind === "sheet-range" ? { sheet: u.sheet } : {}), [r.from]: a, [r.to]: b });
    }
    return { ok: true, capture: sha, read: this.progressOf([sha])[sha], parts: out,
             for_this: mineRows ? out.filter((r) => r.project === project) : [], for_others: mineRows ? out.filter((r) => r.project !== project) : out,
             not_interpreted: notInterpreted, not_interpreted_for: mineRows ? project : null };
  }

  /** (fix round 6, G41; R98; Bob, K4636, K4639) The typed cells of rows of one sheet, in row then column order, made when a member opens or cites a
   *  range. `{cells, interpreted, next_row}`: `interpreted` is `{sheet, from_row, to_row}`, the rows these cells cover, or null when the cells are
   *  the reading's own (a sheet small enough to be listed in it); `next_row` the row to ask from when the answer stopped before `toRow`, else null.
   *  A sheet the reading lists is answered from the reading; a sheet its `cells_held` names is made from the held file through
   *  `reading-pipeline.cellsInRange` (the format the reading was written with, the stored document, the evidence store), at most CELLS_RANGE_MAX
   *  cells in the extent a call, `fromCol`/`toCol` and the cap passed to the entry. Never throws and never answers a shorter list without saying so:
   *  `{cells: null, reason, why}` for a capture with no reading, a sheet that is not named, a sheet whose cells are neither listed nor held, bytes
   *  not held (`transient: true`) and a format that cannot make them. Nothing reads a whole stored cell array: the reading's cells are read only as
   *  the one small key they are when a sheet is listed. */
  async cellsOf(captureSha, sheet, { fromRow = null, toRow = null, fromCol = null, toCol = null, env = null, interpret = null } = {}) {
    const made = await this.#cellsMade(captureSha, sheet, { fromRow, toRow, fromCol, toCol, env });
    if (!interpret || typeof interpret !== "object" || !Array.isArray(made.cells)) return made;
    /* R115 (T53; N1272; K5445 A): a member who opens or cites a range of a sheet interprets exactly the block answered, `interpret` naming `{project, by, how,
       viewer?}` (`how` `opened` unless `cited`): the part is the rows returned (never the range asked, a cut answer's `next_row` ending it), and its cells are
       the content, so they are made once. A refusal is answered in place of the cells; a read that made none records nothing (R98's `{cells: null}`). */
    const rowsOf = made.cells.map(cellAddress).filter(Boolean).map((a) => a.row);
    const asked = (v) => (Number.isInteger(v) && v >= 1 ? v : null);
    const from = made.interpreted ? made.interpreted.from_row : (asked(fromRow) !== null && asked(toRow) !== null ? Math.min(asked(fromRow), asked(toRow)) : asked(fromRow) ?? (rowsOf.length ? Math.min(...rowsOf) : 1));
    const toWanted = made.interpreted ? made.interpreted.to_row : (asked(fromRow) !== null && asked(toRow) !== null ? Math.max(asked(fromRow), asked(toRow)) : asked(toRow) ?? (rowsOf.length ? Math.max(...rowsOf) : from));
    const to = Number.isInteger(made.next_row) ? Math.max(from, Math.min(toWanted, made.next_row - 1)) : toWanted;
    const how = interpret.how === "cited" ? "cited" : "opened";
    const act = await this.interpretPart({ capture: captureSha, part: { kind: "sheet-range", sheet, from_row: from, to_row: to }, project: interpret.project, how,
      by: interpret.by, viewer: interpret.viewer ?? null, content: { sheet, from_row: from, to_row: to, cells: made.cells }, env });
    if (act.ok !== true) return { cells: null, ...act };
    return { ...made, interpreted: { sheet, from_row: from, to_row: to, interpretation: act.id }, interpretation: { id: act.id, recorded: act.recorded, how: act.interpretation.how } };
  }

  async #cellsMade(captureSha, sheet, { fromRow = null, toRow = null, fromCol = null, toCol = null, env = null } = {}) {
    const none = (reason, why, more = {}) => ({ cells: null, reason, why, ...more });
    const sha = typeof captureSha === "string" ? captureSha.trim().toLowerCase() : "";
    const row = sha ? this.#one(`SELECT bundle_id, capture_format FROM readings WHERE capture_sha=?`, sha) : null;
    if (!row) return none("no_reading", localize("extraction.index.cells_no_reading", "no reading of this document is held, so none of its cells are"));
    if (typeof sheet !== "string" || !sheet)
      return none("sheet_not_named", localize("extraction.index.cells_sheet_not_named", "no sheet was named, so no cells could be made"));
    const int = (v) => (Number.isInteger(v) && v >= 1 ? v : null);
    let [r0, r1, c0, c1] = [int(fromRow), int(toRow), int(fromCol), int(toCol)];
    if (r0 !== null && r1 !== null && r0 > r1) [r0, r1] = [r1, r0];
    if (c0 !== null && c1 !== null && c0 > c1) [c0, c1] = [c1, c0];
    const facts = this.#one(
      `SELECT CASE WHEN json_valid(reading) AND json_type(reading)='object' THEN json_extract(reading, '$.cells_held') END AS held,
              CASE WHEN json_valid(reading) AND json_type(reading)='object' THEN json_extract(reading, '$.cells') END AS cells,
              CASE WHEN json_valid(reading) AND json_type(reading)='object' THEN json_extract(reading, '$.text_container') END AS container
         FROM readings WHERE capture_sha=?`, sha);
    const heldSheets = Array.isArray(safeJson(facts && facts.held)) ? safeJson(facts.held) : [];
    const listed = safeJson(facts && facts.cells);
    const listing = listed && typeof listed === "object" && !Array.isArray(listed) && Array.isArray(listed[sheet]) ? listed[sheet] : null;
    if (listing) {
      const mine = [];
      for (const c of listing) {
        const at = cellAddress(c);
        if (!at) continue;
        if ((r0 !== null && at.row < r0) || (r1 !== null && at.row > r1) || (c0 !== null && at.col < c0) || (c1 !== null && at.col > c1)) continue;
        mine.push([at, c]);
      }
      mine.sort((a, b) => (a[0].row - b[0].row) || (a[0].col - b[0].col));
      return cut(mine.map((m) => m[1]), null, mine.map((m) => m[0]), CELLS_RANGE_MAX);
    }
    if (!heldSheets.includes(sheet)) {
      const named = listed && typeof listed === "object" && Object.hasOwn(listed, sheet);
      return named
        ? none("sheet_not_held", localize("extraction.index.cells_sheet_not_held", "this sheet's cells were not made when it was read, and its file does not hold them to make now"))
        : none("sheet_not_named", localize("extraction.index.cells_sheet_not_named_in", "the reading names no sheet called {sheet}", { sheet }));
    }
    const ev = this.core && typeof this.core.evidenceStore === "function" ? this.core.evidenceStore() : null;
    if (!ev || typeof pipeline.cellsInRange !== "function")
      return none("cells_not_interpretable", localize("extraction.index.cells_not_interpretable", "this document's cells cannot be made from its file here"));
    const document = (row.bundle_id && this.#storedDocument(row.bundle_id, sha)) || { capture: { sha256: sha } };
    const format = await this.#cellsFormat(row.capture_format, facts && facts.container, document, sha, ev);
    let got;
    try {
      got = await pipeline.cellsInRange(ev, document, { format, sheet, fromRow: r0 ?? 1, toRow: r1 ?? undefined,
        fromCol: c0 ?? undefined, toCol: c1 ?? undefined, maxCells: CELLS_RANGE_MAX });
    } catch (e) {
      return none("bytes_not_held", localize("extraction.index.cells_bytes_not_held", "the file this document was read from could not be read just now, so its cells could not be made; try again"), { transient: true });
    }
    if (!got || got.ok === false || !Array.isArray(got.cells)) {
      const reason = got && typeof got.reason === "string" ? got.reason : "cells_not_interpretable";
      return none(reason, localize("extraction.index.cells_not_made", "this document's cells could not be made ({reason})", { reason }),
        reason === "bytes_not_held" ? { transient: true } : {});
    }
    const ats = got.cells.map(cellAddress);
    const asked = { from: r0 ?? 1, to: r1 };
    return cut(got.cells, { sheet, from_row: got.rows && Number.isInteger(got.rows.from) ? got.rows.from : asked.from,
                            to_row: got.rows && Number.isInteger(got.rows.to) ? got.rows.to : (asked.to ?? (ats.filter(Boolean).pop() || {}).row ?? asked.from) },
      ats, CELLS_RANGE_MAX, Number.isInteger(got.next_row) ? got.next_row : null);
  }

  /** (fix round 6, G38; R94) the stored reading of a capture without its bulky keys: a top-level key whose JSON is over READING_KEY_BYTES is
   *  removed by SQL (so it is never loaded) and named in `omitted` as `{key, bytes}`. A reading that is no object, or no valid JSON, is
   *  parsed as it stands. */
  #readingBounded(captureSha) {
    const whole = () => ({ reading: safeJson(this.#one(`SELECT reading FROM readings WHERE capture_sha=?`, captureSha).reading), omitted: [] });
    let big = [];
    try {
      big = this.#rows(
        `SELECT j.key AS key, length(CAST(j.value AS BLOB)) AS n FROM readings r, json_each(r.reading) j
          WHERE r.capture_sha=? AND length(CAST(r.reading AS BLOB)) > ? AND json_valid(r.reading) AND json_type(r.reading)='object'
            AND length(CAST(j.value AS BLOB)) > ? ORDER BY j.key`, captureSha, READING_KEY_BYTES, READING_KEY_BYTES)
        .filter((k) => typeof k.key === "string" && !k.key.includes('"'));
    } catch { return whole(); }
    if (!big.length) return whole();
    const cut = this.#one(
      `SELECT json_remove(reading, ${big.map(() => "?").join(", ")}) AS reading FROM readings WHERE capture_sha=?`,
      ...big.map((k) => `$."${k.key}"`), captureSha);
    return { reading: safeJson(cut.reading), omitted: big.map((k) => ({ key: k.key, bytes: k.n })) };
  }

  /** R36: the capture's indexed units in `seq` order, at most the unit bound, and the index's own state from its
   *  last write: `whole`, `partial` (with its counts and the named gaps), `none`, or null (never indexed). */
  unitsOf(captureSha, { after = null, maxBytes = null } = {}) {
    const st = this.#one(`SELECT * FROM capture_text_state WHERE capture_sha=?`, captureSha);
    /* (fix round 6, G13; R76 amended) a page of at most CAPTURE_TEXT_CAPTURE_UNIT_BOUND units after the unit `after` (its `seq`; none:
       from the first), and `next`, the `seq` to ask after the page when more units follow it. A text read whole in pieces holds more
       than one page, and every unit of it is reachable by asking page by page. */
    const from = Number.isInteger(after) ? after : -1;
    /* (G38; R93) `maxBytes`: the page also ends where its unit text would pass that many bytes (a unit over it alone on its page). The sizes
       are read first, so the text of the units a page leaves out is never loaded. */
    let page, more;
    if (Number.isInteger(maxBytes) && maxBytes > 0) {
      const sizes = this.#rows(
        `SELECT seq, length(CAST(text AS BLOB)) AS n FROM capture_text WHERE capture_sha=? AND seq > ? ORDER BY seq LIMIT ?`,
        captureSha, from, CAPTURE_TEXT_CAPTURE_UNIT_BOUND + 1);
      let used = 0, kept = 0;
      for (const z of sizes.slice(0, CAPTURE_TEXT_CAPTURE_UNIT_BOUND)) {
        if (kept > 0 && used + z.n > maxBytes) break;
        used += z.n; kept++;
      }
      more = sizes.length > kept;
      page = kept === 0 ? [] : this.#rows(
        `SELECT extent, ref, text, truncated, seq, chain_kind, kind, line_rows, undetermined FROM capture_text WHERE capture_sha=? AND seq > ? AND seq <= ? ORDER BY seq`,
        captureSha, from, sizes[kept - 1].seq);
    } else {
      page = this.#rows(
        `SELECT extent, ref, text, truncated, seq, chain_kind, kind, line_rows, undetermined FROM capture_text WHERE capture_sha=? AND seq > ? ORDER BY seq LIMIT ?`,
        captureSha, from, CAPTURE_TEXT_CAPTURE_UNIT_BOUND + 1);
      more = page.length > CAPTURE_TEXT_CAPTURE_UNIT_BOUND;
    }
    const units = page.slice(0, CAPTURE_TEXT_CAPTURE_UNIT_BOUND)
      .map((u) => ({ extent: safeJson(u.extent), ref: u.ref, text: u.text, truncated: !!u.truncated, seq: u.seq,
                     chain_kind: u.chain_kind, kind: u.kind ?? null,
                     /* (R107, G128h) a sheet block's row of each line and its cells' undetermined list, when stored */
                     ...(u.line_rows ? { lineRows: safeJson(u.line_rows) } : {}), ...(u.undetermined ? { undetermined: safeJson(u.undetermined) } : {}) }));
    const skipped = st ? this.#rows(
      `SELECT first_seq, last_seq, units, first_extent, first_ref, last_extent, last_ref, side
         FROM capture_text_skipped WHERE capture_sha=? ORDER BY first_seq`, captureSha)
      .map((k) => ({ from: k.first_ref, to: k.last_ref, units: k.units, side: k.side,
                     first: { extent: safeJson(k.first_extent), seq: k.first_seq },
                     last: { extent: safeJson(k.last_extent), seq: k.last_seq } })) : [];
    /* (fix round 9, R100) the state is the capture's completeness, the one fact `op=reading` answers too; null for a capture never indexed */
    const completeness = st ? this.#completenessOf(captureSha) : null;
    return { capture_sha: captureSha, units,
             ...(more ? { next: units[units.length - 1].seq } : {}),
             state: completeness ? completeness.state : null,
             ...(completeness ? { counters: completeness.counters, ...(completeness.owed ? { owed: completeness.owed } : {}) } : {}),
             /* (R107, K4914) how far a text read in pieces has been read (R90's figures) while more follows */
             ...(st && st.more ? { read_through: st.read_through ?? null, total: st.total ?? null } : {}),
             ...(st ? { counts: { offered: st.offered, written: st.written, over_bound: st.over_bound,
                                  unaddressable: st.unaddressable, truncated: st.truncated,
                                  skipped_named: st.skipped_named }, chain_kind: st.chain_kind, at: st.at,
                        skipped } : {}) };
  }

  /** R108 (fix round 9, G135f; K4922; retrieval R97): how far each reading is read, without its units. `{[sha]: {state, read_through, total, owed}}` for
   *  each capture asked, at most PROGRESS_MAX a call (the first asked, each once): `state` `whole`, `partial` or `none` (no index), never `whole` while
   *  anything is owed or more follows; `read_through` and `total` R90's figures while more follows, else null; `owed` R100's owed count (the OCR pages or
   *  pictures still owed). Only counts and the reading's facts are read, by SQL; no unit's text is loaded. */
  progressOf(shas) {
    const list = [...new Set((Array.isArray(shas) ? shas : []).filter((x) => typeof x === "string" && x))].slice(0, PROGRESS_MAX);
    const out = {};
    for (const sha of list) {
      const st = this.#one(`SELECT state, more, read_through, total, over_bound, unaddressable, truncated, stated, ended_why FROM capture_text_state WHERE capture_sha=?`, sha);
      if (!st) { out[sha] = { state: "none", read_through: null, total: null, owed: 0 }; continue; }
      const f = this.#completenessFacts(sha);
      let owed = 0;
      if (f) {
        if (f.ocrLeft && Number.isInteger(f.ocrLeft.pages) && f.ocrLeft.pages > 0) owed = f.ocrLeft.pages;
        else if (f.tier3 && f.pageCount) {
          /* the pages holding a glyph, counted by SQL over the units' lengths, never their text */
          const read = this.#one(`SELECT count(DISTINCT json_extract(extent, '$.page')) n FROM capture_text WHERE capture_sha=? AND extent_kind='pdf-page' AND length(trim(text)) > 0`, sha).n;
          owed = Math.max(0, f.pageCount - read - f.refusedPages);
        }
        owed += f.pictures;
      }
      const whole = st.state === "whole" && !st.more && !owed && !(f && f.found === false && f.failure === "transient" && !f.entities);
      out[sha] = { state: whole ? "whole" : "partial", read_through: st.more ? st.read_through ?? null : null, total: st.more ? st.total ?? null : null, owed };
    }
    return out;
  }

  /** R51 (K138): the capture digests the bundle's stored readings carry, each with the instant it was read (the
   *  reading's `at`, the retrieval it is a reading of), earliest first, ties on the digest; an undated reading
   *  last. A list, empty for none, bounded as R48 (`limit`, `truncated` on the list). Read-only; never throws. */
  capturesReadFor(bundleId, { limit = null } = {}) {
    const cap = Math.max(1, Math.min(Math.floor(Number(limit) || TEXT_SOURCE_LIMIT_DEFAULT), TEXT_SOURCE_LIMIT_MAX));
    let page = [];
    try {
      page = typeof bundleId === "string" && bundleId
        ? this.#rows(`SELECT capture_sha, at FROM readings WHERE bundle_id=? ORDER BY at IS NULL, at, capture_sha LIMIT ?`,
                     bundleId, cap + 1)
        : [];
    } catch { page = []; }
    return Object.assign(page.slice(0, cap).map((r) => ({ capture_sha: r.capture_sha, at: r.at ?? null })),
                         { limit: cap, truncated: page.length > cap });
  }

  /* ---- the figures (R67) ---- */

  /** R67: the figures `registerCounts` asks for, in this order. */
  static COUNT_KEYS = Object.freeze(["textUnits"]);

  /** R67 (D-464's subtraction, as the retired `store.mjs`' `#counts` took it): `textUnits`, the `capture_text` rows, leaving out
   *  the rows whose bundle is in `hid` (`{sql, args}`, the bundles the caller may not see; null counts whole). A row
   *  whose `bundle_id` is null names no bundle and is counted (`COALESCE`: `NULL NOT IN (…)` is NULL). Writes nothing. */
  counts(hid = null) {
    const h = hid && typeof hid.sql === "string" ? hid : null;
    const r = this.#one(`SELECT count(*) c FROM capture_text${h ? ` WHERE COALESCE(bundle_id, '') NOT IN ${h.sql}` : ""}`,
                        ...(h ? h.args || [] : []));
    return { textUnits: r ? r.c : null };
  }

  /** R67 (REC-91 / D-113): whether the content-grain text index agrees with its content table: FTS5's
   *  `integrity-check` AT RANK 1 verifies the index AGAINST `capture_text` and throws `SQLITE_CORRUPT_VTAB` when they
   *  disagree (measured, and measured to catch an orphan plain `integrity-check`, rank 0, passes over), so the answer
   *  is `true` when it passes and `false` when it throws. NOT A COUNT, AND THAT IS A CORRECTION ITS NEGATIVE CONTROL
   *  FORCED: an FTS5 external-content table answers `count(*)` out of its content table, so a parity count beside
   *  `textUnits` read the base count a second time and stayed green over a planted orphan that still MATCHED. It walks
   *  the index, so it belongs on an admin read taken deliberately. A yes or no, so it is a separate service, read under
   *  today's key by the statistics source, and not one of R63's numbers. */
  textIndexOk() {
    try { this.#sql.exec(`INSERT INTO capture_text_fts(capture_text_fts, rank) VALUES('integrity-check', 1)`); return true; }
    catch { return false; }
  }

  /* REC-36 / REC-40 (R37): the bounded backfill of the name terms for stored references that have none. */
  #backfillRefTerms(limit) {
    limit = Math.max(1, Math.min(Math.floor(Number(limit) || 500), 5000));
    const stale = this.#rows(
      `SELECT rr.capture_sha, rr.bundle_id, rr.ref, rr.ref_key, rr.label FROM reading_refs rr
        WHERE rr.seq = 0 AND NOT EXISTS (SELECT 1 FROM reading_ref_terms t
                           WHERE t.capture_sha = rr.capture_sha AND t.ref = rr.ref)
        ORDER BY rr.capture_sha, rr.ref LIMIT ?`, limit);
    let n = 0;
    for (const r of stale) {
      let wrote = 0;
      for (const [src, text] of refTermSources(r))
        for (const term of labelTerms(text)) {
          this.#sql.exec(`INSERT OR REPLACE INTO reading_ref_terms (capture_sha,bundle_id,ref,src,term) VALUES (?,?,?,?,?)`,
                         r.capture_sha, r.bundle_id, r.ref, src, term);
          wrote++;
        }
      if (wrote) n++;
    }
    return { indexed: n, examined: stale.length, limit,
             remaining: this.#one(
               `SELECT count(*) c FROM reading_refs rr WHERE rr.seq = 0 AND NOT EXISTS (SELECT 1 FROM reading_ref_terms t
                  WHERE t.capture_sha = rr.capture_sha AND t.ref = rr.ref)`).c };
  }
  reindexNames({ limit = 500 } = {}) { return { ok: true, ...this.#backfillRefTerms(limit) }; }
  /** R37: test seams, reached by no op. */
  readingTermsClear({ captureSha = null } = {}) {
    if (captureSha) this.#sql.exec(`DELETE FROM reading_ref_terms WHERE capture_sha=?`, captureSha);
    else this.#sql.exec(`DELETE FROM reading_ref_terms`);
    return { ok: true, cleared: captureSha || "ALL", remaining: this.#one(`SELECT count(*) c FROM reading_ref_terms`).c };
  }
  readingHistoryClear({ captureSha = null } = {}) {
    if (captureSha) this.#sql.exec(`DELETE FROM reading_history WHERE capture_sha=?`, captureSha);
    else this.#sql.exec(`DELETE FROM reading_history`);
    return { ok: true, cleared: captureSha || "ALL", remaining: this.#one(`SELECT count(*) c FROM reading_history`).c };
  }

  /* ---- N26 and N439: moving stored references after a reader fix (R66: ¶ and tables, office-readers R11, R16, R28;
     R68: slide shapes, office-readers R11's pptx arm, R29; K747, K755, K763, K795 (6)) ---- */

  /** R66, R68: a migration's own row (`reading_migrations`), created on its first run with the cutoff that decides
   *  "made before" the reader fix: the last `reading_history` row (R23) held when this code first ran on this store.
   *  Every write of a reading keeps it there first, so a reading whose last kept row is after the cutoff was written by
   *  the fixed reader; one at or before it, or with no history at all, was not. A row, not an instant, so a reading
   *  written in the second the migration started is never mistaken for an old one. */
  #migrationState(name) {
    let row = this.#one(`SELECT * FROM reading_migrations WHERE migration=?`, name);
    if (!row) {
      const last = this.#one(`SELECT COALESCE(max(rowid), 0) AS n FROM reading_history`);
      this.#sql.exec(`INSERT OR IGNORE INTO reading_migrations (migration, cutoff, after, done, examined, migrated, at, rescan)
                      VALUES (?,?,?,0,0,0,?,1)`, name, last ? last.n : 0, "", stampInstant("second"));
      row = this.#one(`SELECT * FROM reading_migrations WHERE migration=?`, name);
    } else if (row.rescan == null) {
      /* R82 (F12, R-OLD): a migration that ran before candidates were re-queued passed any whose bytes were not held; it
         scans again, once, from the start (a reading already migrated or read after the cutoff costs no read). */
      this.#sql.exec(`UPDATE reading_migrations SET after='', done=0, rescan=1 WHERE migration=?`, name);
      row = this.#one(`SELECT * FROM reading_migrations WHERE migration=?`, name);
    }
    return row;
  }

  /** R110 (fix round 10, cause 39b): add what a run found to its migration's row (`counts`, a JSON object of numbers), so the answer of `migrationCounts` still
   *  states it after the run's own answer is gone. A zero adds nothing. */
  #bumpCounts(name, found) {
    const add = Object.entries(found).filter(([, n]) => Number.isFinite(n) && n > 0);
    if (!add.length) return;
    const row = this.#one(`SELECT counts FROM reading_migrations WHERE migration=?`, name);
    const had = row ? safeJson(row.counts) : null;
    const counts = had && typeof had === "object" && !Array.isArray(had) ? { ...had } : {};
    for (const [k, n] of add) counts[k] = (Number.isFinite(counts[k]) ? counts[k] : 0) + n;
    this.#sql.exec(`UPDATE reading_migrations SET counts=? WHERE migration=?`, JSON.stringify(counts), name);
  }

  /** R110 (fix round 10, cause 39b; K5055; amends R105): what each migration has done, read-only, for an administrator's answer (the plane's `selftest`, whose
   *  Worker arm checks the viewer and hands nothing else in). One entry for each of R66, R68, R89, R92 and R105's migrations, in that order:
   *  `{migration, examined, migrated, done, at, retry, counts}`: the readings examined and migrated, whether it is done, when it last ran (null for one that
   *  has not), whether it will retry (not done, or candidates waiting for their bytes: R82), and the counts of the shapes it found (R105 (b)'s
   *  `first_range`, `cut_units`, `pages_unread`, `stated_bare`, with `registered` and `existed`; R105 (a), (c)'s `ocr`, `ods` and `existed`; R92's
   *  `superseded`). It writes nothing and creates no row: a migration that has not run states zeros. Never throws. */
  migrationCounts() {
    const names = [N26_MIGRATION, N439_MIGRATION, REPAIR_MIGRATION, PART_MIGRATION, OWED_MIGRATION, SHAPE_MIGRATION, `${HELD_MIGRATION}:${String(this.env.VERSION ?? "")}`];
    const shapes = { first_range: 0, cut_units: 0, pages_unread: 0, stated_bare: 0, registered: 0, existed: 0 };
    return {
      ok: true,
      migrations: names.map((migration) => {
        let row = null;
        try { row = this.#one(`SELECT done, examined, migrated, at, retry, counts FROM reading_migrations WHERE migration=?`, migration); } catch { row = null; }
        const counts = row ? safeJson(row.counts) : null;
        const waiting = row ? safeJson(row.retry) : null;
        return { migration, examined: row ? Number(row.examined) || 0 : 0, migrated: row ? Number(row.migrated) || 0 : 0, done: !!(row && row.done),
                 at: row && typeof row.at === "string" ? row.at : null,
                 retry: !(row && row.done) || (Array.isArray(waiting) && waiting.length > 0),
                 counts: { ...(migration === SHAPE_MIGRATION ? shapes : {}), ...(counts && typeof counts === "object" && !Array.isArray(counts) ? counts : {}) } };
      }),
    };
  }

  /** R66, R68: started by `migrate()` on a Durable Object (its `waitUntil` carries both, docx then pptx, in batches,
   *  until done), so each cutoff is taken inside the boot, before any request can write a reading; a store with no such
   *  host (a test) runs `migrateDocxReadings` and `migratePptxReadings` itself. Never throws: a failed run is retried
   *  at the next start, from its cursor. */
  startMigrations() {
    const host = this.#host;
    if (this.#migrationRun || !host || typeof host.waitUntil !== "function") return null;
    this.#migrationState(N26_MIGRATION);
    this.#migrationState(N439_MIGRATION);
    const drain = async (step) => {
      for (let n = 0; n < 10_000; n++) {
        const r = await step();
        if (!r || r.done || !r.examined) break;
      }
    };
    this.#migrationRun = (async () => {
      await drain(() => this.migrateDocxReadings()).catch(() => null);
      await drain(() => this.migratePptxReadings()).catch(() => null);
      await drain(() => this.migrateRepairs()).catch(() => null);
      await drain(() => this.migratePartReadings()).catch(() => null);
    })().catch(() => null);
    host.waitUntil(this.#migrationRun);
    return this.#migrationRun;
  }

  /** R66: once per stored reading, a `.docx` reading made before N26 whose `word/document.xml` holds an
   *  `mc:AlternateContent` branch N26 no longer reads is migrated; every other reading is left as it is. Each is
   *  re-read from its stored bytes (R1, reading-pipeline R2) and its references moved by `docxRenumbering` (`n26MigratedReading`). */
  migrateDocxReadings({ limit = N26_BATCH } = {}) { return this.#migrate(MIGRATIONS[N26_MIGRATION], limit); }

  /** R68: once per stored reading, a `.pptx` reading made before N439 whose slides hold an `mc:AlternateContent`
   *  branch N439 no longer reads is migrated; every other reading is left as it is. Each is re-read from its stored
   *  bytes (R1, reading-pipeline R2) and its `slide-shape` references moved by `pptxRenumbering` (`n439MigratedReading`). */
  migratePptxReadings({ limit = N439_BATCH } = {}) { return this.#migrate(MIGRATIONS[N439_MIGRATION], limit); }

  /* R66, R68: one migration's batch. Up to `limit` candidates per call, in digest order after the cursor, so a restart
     resumes and a capture is examined once. Each migrated reading is written through R19's writer with its layer step
     marked, so the capture's chain differs from the old reading's: content's R22 marks its rows stale and R41 grades
     and notifies (K763). A capture whose renumbering moves nothing gets no mark and no re-read. Answers what it
     examined and did. Writes only through R19. */
  async #migrate(m, limit) {
    const st = this.#migrationState(m.name);
    const waiting = new Set(Array.isArray(safeJson(st.retry)) ? safeJson(st.retry) : []);
    const out = { ok: true, migration: m.name, cutoff: st.cutoff, done: !!st.done && !waiting.size, examined: 0, migrated: [],
                  unmoved: 0, skipped: [] };
    if (st.done && !waiting.size) return out;
    const cap = Math.max(1, Math.min(Math.floor(Number(limit) || 50), 5000));
    const ev = this.core && typeof this.core.evidenceStore === "function" ? this.core.evidenceStore() : null;
    const COLS = `capture_sha, bundle_id, reading, origin, asserted_by, justification`;
    const settle = async (row) => {
      const why = await this.#migrateOne(m, row, st.cutoff, ev);
      if (why && why.migrated) { waiting.delete(row.capture_sha); out.migrated.push({ capture_sha: row.capture_sha, moved: why.moved }); }
      else if (why && why.waiting) { waiting.add(row.capture_sha); out.skipped.push({ capture_sha: row.capture_sha, why: why.waiting }); }
      else {
        waiting.delete(row.capture_sha);
        if (why === "unmoved") out.unmoved++;
        else if (why) out.skipped.push({ capture_sha: row.capture_sha, why });
      }
      return why;
    };
    /* R82 (F12): the candidates a run could not read yet come first, and stay queued while their cause lasts. */
    for (const sha of [...waiting].slice(0, cap)) {
      const row = this.#one(`SELECT ${COLS} FROM readings WHERE capture_sha=?`, sha);
      if (row) await settle(row); else waiting.delete(sha);
    }
    let finished = !!st.done;
    if (!st.done) {
      const page = this.#rows(
        `SELECT ${COLS} FROM readings
          WHERE capture_sha > ? AND (capture_format = ?
                OR (capture_format IS NULL AND json_extract(reading, '$.text_container') = ?))
          ORDER BY capture_sha LIMIT ?`, st.after || "", m.format, m.format, cap + 1);
      for (const row of page.slice(0, cap)) {
        const why = await settle(row);
        out.examined++;
        this.#sql.exec(`UPDATE reading_migrations SET after=?, examined=examined+1, migrated=migrated+?, at=? WHERE migration=?`,
                       row.capture_sha, why && why.migrated ? 1 : 0, stampInstant("second"), m.name);
      }
      if (page.length <= cap) {
        this.#sql.exec(`UPDATE reading_migrations SET done=1, at=? WHERE migration=?`, stampInstant("second"), m.name);
        finished = true;
      }
    }
    this.#sql.exec(`UPDATE reading_migrations SET retry=? WHERE migration=?`, waiting.size ? JSON.stringify([...waiting].sort()) : null, m.name);
    out.done = finished && !waiting.size;
    return out;
  }

  /** R89 (fix round 6, G8; plane R77): the composition hands in the owed-work ledger's registration, once, as it hands capture its
   *  `owedLater` (this module is below the plane and cannot reach it): an async `owe({kind, sha}) -> {ok: true}` that never throws.
   *  Every later repair is owed through it; on an object it also starts the repair that waits for it. */
  registerOwe(fn) {
    if (typeof fn !== "function") return { ok: false, reason: "LISTENER_MALFORMED" };
    if (this.#owe) return { ok: false, reason: "LISTENER_DECLARED" };
    this.#owe = fn;
    const host = this.#host;
    if (host && typeof host.waitUntil === "function" && !this.#repairRun) {
      this.#repairRun = (async () => {
        for (let n = 0; n < 10_000; n++) { const r = await this.migrateRepairs(); if (!r || r.done || !r.examined) break; }
        for (let n = 0; n < 10_000; n++) { const r = await this.migratePartReadings(); if (!r || r.done || !r.examined) break; }
        for (let n = 0; n < 10_000; n++) { const r = await this.migrateHeldUnread(); if (!r || r.done || !r.examined) break; }
      })().catch(() => null);
      host.waitUntil(this.#repairRun);
    }
    return { ok: true };
  }

  /** R89 (fix round 6, G8; R-OLD, a repair): once per store, each held `final` reading that says the document was not read as text
   *  (R85) and has not been tried under this release is owed to the ledger as a `reading` entry (cheap: the ledger runs one heavy
   *  entry a tick), so an old record is repaired with no press. In digest order from a cursor, so a restart resumes; with no
   *  registration handed in (R89's `registerOwe`) it owes nothing and stays undone, and answers that it examined nothing. */
  async migrateRepairs({ limit = REPAIR_BATCH } = {}) {
    const st = this.#migrationState(REPAIR_MIGRATION);
    const out = { ok: true, migration: REPAIR_MIGRATION, done: !!st.done, examined: 0, owed: [] };
    if (!this.#owe) return out;
    /* (fix round 9, R105) the old shapes' step runs once R89's has finished, in the same call; the repair is done when both are */
    if (st.done) {
      const more = await this.#migrateOwedWork(limit);
      if (!more.done) return { ...out, done: false, examined: more.examined, r105: more };
      /* (fix round 9, R105 (b)) then the readings in old shapes, re-registered as reading jobs */
      const shapes = await this.migrateReadings({ limit });
      return { ...out, done: shapes.done, examined: more.examined + shapes.examined, r105: more, r105b: shapes };
    }
    const cap = Math.max(1, Math.min(Math.floor(Number(limit) || REPAIR_BATCH), 5000));
    /* what may need owing: a failed reading (R89), a text read in pieces with more to read, and a text whose index holds only part of it
       with no piece state (R90): old data, which the first piece restarts */
    const page = this.#rows(
      `SELECT r.capture_sha AS capture_sha, r.bundle_id AS bundle_id, r.reading AS reading, s.more AS more, s.state AS state,
              s.over_bound AS over_bound, s.total AS total
         FROM readings r LEFT JOIN capture_text_state s ON s.capture_sha = r.capture_sha
        WHERE r.capture_sha > ? AND (r.found = 0 OR s.more = 1 OR (s.state = 'partial' AND s.over_bound > 0 AND s.total IS NULL))
        ORDER BY r.capture_sha LIMIT ?`, st.after || "", cap + 1);
    for (const r of page.slice(0, cap)) {
      const reading = safeJson(r.reading);
      let owed = 0;
      const repair = notReadAsText(reading) && !this.#repairTried(r.capture_sha);
      const restart = !repair && r.more !== 1 && r.state === "partial" && r.over_bound > 0 && r.total == null && textReading(reading);
      if (repair || r.more === 1 || restart) {
        let a = null;
        try { a = await this.#owe({ kind: "reading", sha: r.capture_sha }); } catch { a = null; }
        if (!a || a.ok !== true) return out;
        if (restart) this.#sql.exec(`UPDATE capture_text_state SET more=1, cursor=NULL WHERE capture_sha=?`, r.capture_sha);
        out.owed.push(r.capture_sha);
        owed = 1;
      }
      this.#sql.exec(`UPDATE reading_migrations SET after=?, examined=examined+1, migrated=migrated+?, at=? WHERE migration=?`,
                     r.capture_sha, owed, stampInstant("second"), REPAIR_MIGRATION);
      out.examined++;
    }
    if (page.length <= cap) {
      this.#sql.exec(`UPDATE reading_migrations SET done=1, at=? WHERE migration=?`, stampInstant("second"), REPAIR_MIGRATION);
      /* (fix round 9, R105) and the old shapes' step, in the same call */
      const more = await this.#migrateOwedWork(limit);
      out.r105 = more;
      out.done = more.done;
      /* (fix round 10, R110) and, once that is done, the readings in old shapes, as the branch above does: a run that stopped here would leave them to the
         next start */
      if (more.done) {
        const shapes = await this.migrateReadings({ limit });
        out.r105b = shapes;
        out.done = shapes.done;
        out.examined += shapes.examined;
      }
    }
    return out;
  }

  /** R120 (T53; N1266, N1267; RF10): once for each release, each stored reading that is held and named (`held_unread`, no unit) whose held bytes now detect a LISTED type (a
   *  reader has arrived: `detectFormat` over the bytes' head, never the name or the declared type) is owed to the ledger as a `reading` entry, so `readHeld` replaces it with the
   *  new reading. A reading whose type is still on no list is not owed, and its release's `reading_repairs` row says so, so it is not looked at again under the same release; a
   *  reading whose bytes are not held is left for the next call. In digest order from the release's own cursor (its row, `r120-held-unread:<VERSION>`), in batches; counted
   *  (`owed`, `unlisted`, `existed`, `not_held`), idempotent (a second run in the same release changes nothing); with no registrar handed in it owes nothing and stays undone;
   *  a refusing registrar stops it where it was. It writes no bundle, register row, promotion or upload. */
  async migrateHeldUnread({ limit = REPAIR_BATCH } = {}) {
    const name = `${HELD_MIGRATION}:${String(this.env.VERSION ?? "")}`;
    const st = this.#migrationState(name);
    const out = { migration: name, done: !!st.done, examined: 0, owed: 0, unlisted: 0, existed: 0, not_held: 0, refused: null };
    if (st.done || !this.#owe) return out;
    const cap = Math.max(1, Math.min(Math.floor(Number(limit) || REPAIR_BATCH), 5000));
    const page = this.#rows(
      `SELECT capture_sha, bundle_id FROM readings WHERE capture_sha > ? AND found = 0 AND json_valid(reading) AND json_type(reading, '$.held_unread') = 'object'
        ORDER BY capture_sha LIMIT ?`, st.after || "", cap + 1);
    for (const r of page.slice(0, cap)) {
      let moved = 0;
      if (this.#heldUnread(r.capture_sha) && !this.#repairTried(r.capture_sha)) {
        const head = await this.#heldHead(r.capture_sha).catch(() => null);
        if (!head) { out.not_held++; this.#bumpCounts(name, { not_held: 1 }); }
        else if (await this.#nowListed(r.capture_sha)) {
          const a = await this.#oweVia(null).owe({ kind: "reading", sha: r.capture_sha });
          if (!a || a.ok !== true) { out.refused = (a && a.reason) || "REGISTRAR_REFUSED"; return out; }
          out.owed++; moved = 1;
          if (a.existed === true) out.existed++;
          this.#bumpCounts(name, { owed: 1, existed: a.existed === true ? 1 : 0 });
        } else {
          this.#markRepairTried(r.bundle_id, r.capture_sha, "unlisted");
          out.unlisted++; this.#bumpCounts(name, { unlisted: 1 });
        }
      }
      this.#sql.exec(`UPDATE reading_migrations SET after=?, examined=examined+1, migrated=migrated+?, at=? WHERE migration=?`,
                     r.capture_sha, moved, stampInstant("second"), name);
      out.examined++;
    }
    if (page.length <= cap) {
      this.#sql.exec(`UPDATE reading_migrations SET done=1, at=? WHERE migration=?`, stampInstant("second"), name);
      out.done = true;
    }
    return out;
  }

  /** R105 (b) (fix round 9, G128j; R-OLD, a repair; BOB schedules the live run): once per store, in digest order from its cursor and in batches, each stored
   *  reading written by an older reader (its `reading_shape` null or under READING_SHAPE) that is in one of the old shapes (`#oldShapeOf`: the first range
   *  only, N3; cut units, N15; `whole` with pages unread, S2; a statement without units, N22) is re-registered as a `reading` job through the registrar,
   *  so the ledger re-reads it (`readHeld` reads an old shape again, once) to the new shape, units and completeness of a fresh read. Counted by shape
   *  (`first_range`, `cut_units`, `pages_unread`, `stated_bare`; `existed`: rows the registrar already held), idempotent (its own `reading_migrations` row;
   *  a second run changes nothing), stopped where it was when the registrar refuses (`refused`). With no registrar handed in it owes nothing and stays
   *  undone. */
  async migrateReadings({ limit = REPAIR_BATCH } = {}) {
    const st = this.#migrationState(SHAPE_MIGRATION);
    const out = { migration: SHAPE_MIGRATION, done: !!st.done, examined: 0, registered: 0, existed: 0, refused: null,
                  shapes: { first_range: 0, cut_units: 0, pages_unread: 0, stated_bare: 0 } };
    if (st.done || !this.#owe) return out;
    const cap = Math.max(1, Math.min(Math.floor(Number(limit) || REPAIR_BATCH), 5000));
    const page = this.#rows(`SELECT capture_sha FROM readings WHERE capture_sha > ? AND (reading_shape IS NULL OR reading_shape < ?) ORDER BY capture_sha LIMIT ?`,
                            st.after || "", READING_SHAPE, cap + 1);
    for (const r of page.slice(0, cap)) {
      const shape = this.#oldShapeOf(r.capture_sha);
      if (shape) {
        const a = await this.#oweVia(null).owe({ kind: "reading", sha: r.capture_sha });
        if (!a || a.ok !== true) { out.refused = (a && a.reason) || "REGISTRAR_REFUSED"; return out; }
        out.registered++; out.shapes[shape]++;
        if (a.existed === true) out.existed++;
        this.#bumpCounts(SHAPE_MIGRATION, { registered: 1, [shape]: 1, existed: a.existed === true ? 1 : 0 });
      }
      this.#sql.exec(`UPDATE reading_migrations SET after=?, examined=examined+1, migrated=migrated+?, at=? WHERE migration=?`,
                     r.capture_sha, shape ? 1 : 0, stampInstant("second"), SHAPE_MIGRATION);
      out.examined++;
    }
    if (page.length <= cap) {
      this.#sql.exec(`UPDATE reading_migrations SET done=1, at=? WHERE migration=?`, stampInstant("second"), SHAPE_MIGRATION);
      out.done = true;
    }
    return out;
  }

  /** R105 (b): the old shape a stored reading is in, when an older reader wrote it (its `reading_shape` null or under READING_SHAPE), else null: `stated_bare`
   *  (a statement too large to keep, R97, standing without units: N22), `cut_units` (a unit the old writer cut: N15), `first_range` (a PDF read in ranges whose
   *  stored reading lacks the whole file's glyphs or words: N3), `pages_unread` (a reading still owing OCR, stated `whole` by the old completeness: S2). Read
   *  by SQL. */
  #oldShapeOf(sha) {
    const r = this.#one(
      `SELECT reading_shape AS v, json_type(reading, '$.too_large') AS tl, json_extract(reading, '$.text_container') AS tc,
              json_type(reading, '$.provenance.text_scope.pages') AS ts, json_type(reading, '$.text_glyphs') AS gt, json_type(reading, '$.words_total') AS wt,
              json_type(reading, '$.tier3_candidate') AS t3, json_type(reading, '$.ocr_left') AS ol,
              EXISTS (SELECT 1 FROM capture_text t WHERE t.capture_sha = r.capture_sha) AS units,
              EXISTS (SELECT 1 FROM capture_text t WHERE t.capture_sha = r.capture_sha AND t.truncated = 1) AS cut
         FROM readings r WHERE capture_sha=? AND json_valid(reading) AND json_type(reading)='object'`, sha);
    if (!r || (Number.isInteger(r.v) && r.v >= READING_SHAPE)) return null;
    if (r.tl === "object" && !r.units) return "stated_bare";
    if (r.cut) return "cut_units";
    if (r.t3 === "true" || r.ol === "object") return "pages_unread";
    if (r.tc === "pdf" && r.ts === "array" && (r.gt !== "integer" || r.wt !== "integer")) return "first_range";
    return null;
  }

  /** R105 (a), (c) (fix round 9, G126a, G133a; R-OLD, a repair; K4811 (2)): once per store, in digest order from its cursor, (a) each stored reading
   *  that holds `tier3_candidate` or `ocr_left` is registered as an `ocr` job (`{kind: "ocr", sha, cursor, pages_left}`: from `ocr_left`, else the
   *  pages its units leave unread), so the walker's scan, read before the registrar existed, is read to its end; (c) each stored ODS reading stated too
   *  large (`too_large.key` `cells`) is registered as a `reading` job, which `readHeld` reads again once (odf-reader R49 holds the cells, so the new
   *  reading is kept whole). Counted (`ocr`, `ods`, `existed`: rows the registrar already held), idempotent (its row's cursor; a second run changes
   *  nothing), and stopped where it was when the registrar refuses. */
  async #migrateOwedWork(limit = REPAIR_BATCH) {
    const st = this.#migrationState(OWED_MIGRATION);
    const out = { migration: OWED_MIGRATION, done: !!st.done, examined: 0, ocr: 0, ods: 0, existed: 0, refused: null };
    if (st.done || !this.#owe) return out;
    const cap = Math.max(1, Math.min(Math.floor(Number(limit) || REPAIR_BATCH), 5000));
    const page = this.#rows(
      `SELECT capture_sha, bundle_id, capture_format,
              json_extract(reading, '$.tier3_candidate') AS t3, json_extract(reading, '$.ocr_left') AS ol,
              json_extract(reading, '$.too_large.key') AS tlk, json_extract(reading, '$.text_container') AS tc,
              json_extract(reading, '$.page_count') AS pc
         FROM readings WHERE capture_sha > ? AND json_valid(reading) ORDER BY capture_sha LIMIT ?`, st.after || "", cap + 1);
    for (const r of page.slice(0, cap)) {
      let entry = null;
      const left = safeJson(r.ol);
      if (left && Number.isInteger(left.pages) && left.pages > 0) entry = this.#ocrEntry(r.capture_sha, { ocr_left: left, page_count: r.pc });
      else if (r.t3 === 1 || r.t3 === true) {
        const unread = this.#unreadPagesOf(r.capture_sha, Number.isInteger(r.pc) && r.pc > 0 ? r.pc : 1);
        if (unread.length) entry = { kind: "ocr", sha: r.capture_sha, cursor: unread[0], pages_left: unread.length };
      } else if (r.tlk === "cells" && (r.capture_format === "ods" || r.tc === "ods")) entry = { kind: "reading", sha: r.capture_sha };
      if (entry) {
        const a = await this.#oweVia(null).owe(entry);
        if (!a || a.ok !== true) { out.refused = (a && a.reason) || "REGISTRAR_REFUSED"; return out; }
        if (entry.kind === "ocr") out.ocr++; else out.ods++;
        if (a.existed === true) out.existed++;
        this.#bumpCounts(OWED_MIGRATION, { [entry.kind === "ocr" ? "ocr" : "ods"]: 1, existed: a.existed === true ? 1 : 0 });
      }
      this.#sql.exec(`UPDATE reading_migrations SET after=?, examined=examined+1, migrated=migrated+?, at=? WHERE migration=?`,
                     r.capture_sha, entry ? 1 : 0, stampInstant("second"), OWED_MIGRATION);
      out.examined++;
    }
    if (page.length <= cap) {
      this.#sql.exec(`UPDATE reading_migrations SET done=1, at=? WHERE migration=?`, stampInstant("second"), OWED_MIGRATION);
      out.done = true;
    }
    return out;
  }

  /** The pages `[0, pageCount)` the capture's index holds no glyph of (a page read is a `pdf-page` unit with a glyph), ascending, read a few units at a
   *  time so a large capture's text is never held whole. */
  #unreadPagesOf(sha, pageCount) {
    const read = new Set();
    for (let at = -1, more = true; more;) {
      const chunk = this.#rows(`SELECT seq, extent, text FROM capture_text WHERE capture_sha=? AND extent_kind='pdf-page' AND seq > ? ORDER BY seq LIMIT 32`, sha, at);
      for (const u of chunk) { const e = safeJson(u.extent); if (e && Number.isInteger(e.page) && glyphCount(u.text) > 0) read.add(e.page); }
      more = chunk.length === 32;
      if (chunk.length) at = chunk[chunk.length - 1].seq;
    }
    return Array.from({ length: pageCount }, (_, p) => p).filter((p) => !read.has(p));
  }

  /** R92 (fix round 6, G33; R-OLD, a repair): once per store, a failed reading the old press stored against the digest of a PART of a
   *  document (the register named the lowest-sorting part of a multipart capture; `readHeld` then found no document and wrote its
   *  stub against the part) is superseded by the whole's reading. Per reading: the whole is owed to the ledger as a `reading` entry
   *  first (unless it holds a reading already), then every row kept against the part is deleted, so the document counts one capture
   *  and the tick writes the whole's sized statement. A reading with text, a digest that is also a document of its bundle and a digest
   *  its bundle names as no part are left. In digest order from a cursor; with no ledger handed in (`registerOwe`) it deletes nothing
   *  and stays undone, and a refusing ledger stops it with the part's reading kept. */
  async migratePartReadings({ limit = REPAIR_BATCH } = {}) {
    const st = this.#migrationState(PART_MIGRATION);
    const out = { ok: true, migration: PART_MIGRATION, done: !!st.done, examined: 0, owed: [], superseded: [] };
    if (st.done || !this.#owe) return out;
    const cap = Math.max(1, Math.min(Math.floor(Number(limit) || REPAIR_BATCH), 5000));
    const page = this.#rows(`SELECT capture_sha, bundle_id FROM readings WHERE found = 0 AND capture_sha > ? ORDER BY capture_sha LIMIT ?`,
                            st.after || "", cap + 1);
    for (const r of page.slice(0, cap)) {
      const whole = typeof r.bundle_id === "string" && r.bundle_id && !this.#storedDocument(r.bundle_id, r.capture_sha)
        ? this.#oldPartOwner(r.bundle_id, r.capture_sha) : null;
      if (whole) {
        if (!out.owed.includes(whole) && !this.#one(`SELECT 1 AS x FROM readings WHERE capture_sha=?`, whole)) {
          let a = null;
          try { a = await this.#owe({ kind: "reading", sha: whole }); } catch { a = null; }
          if (!a || a.ok !== true) return out;
          out.owed.push(whole);
        }
        this.core.transact(() => { for (const t of PART_KEPT_IN) this.#sql.exec(`DELETE FROM ${t} WHERE capture_sha=?`, r.capture_sha); });
        out.superseded.push(r.capture_sha);
      }
      this.#sql.exec(`UPDATE reading_migrations SET after=?, examined=examined+1, migrated=migrated+?, at=? WHERE migration=?`,
                     r.capture_sha, whole ? 1 : 0, stampInstant("second"), PART_MIGRATION);
      out.examined++;
    }
    if (page.length <= cap) {
      this.#sql.exec(`UPDATE reading_migrations SET done=1, at=? WHERE migration=?`, stampInstant("second"), PART_MIGRATION);
      out.done = true;
    }
    return out;
  }

  /* R89, R90: owed to the ledger once the write that needs it has committed (the registration may not be handed in yet; the start-up
     repair finds what it missed). Never throws. */
  #oweAfterCommit(sha) {
    if (!this.#owe || !this.core || typeof this.core.afterCommit !== "function") return;
    this.core.afterCommit(() => { try { Promise.resolve(this.#owe({ kind: "reading", sha })).catch(() => {}); } catch { /* the repair finds it */ } });
  }

  /* R89: whether a read has looked at this capture's held bytes under this release and found nothing to read them by. */
  #repairTried(sha) {
    const r = this.#one(`SELECT version FROM reading_repairs WHERE capture_sha=?`, sha);
    return !!r && r.version === String(this.env.VERSION ?? "");
  }
  #markRepairTried(bundleId, sha, outcome) {
    this.#sql.exec(`INSERT OR REPLACE INTO reading_repairs (capture_sha, bundle_id, version, outcome, at) VALUES (?,?,?,?,?)`,
                   sha, bundleId, String(this.env.VERSION ?? ""), outcome, stampInstant("second"));
  }

  /* One candidate: "unmoved", a reason it was left as it is, or `{migrated, moved}`. */
  async #migrateOne(m, row, cutoff, ev) {
    const sha = row.capture_sha;
    const reading = safeJson(row.reading);
    if (!reading || typeof reading !== "object") return "the stored reading is not readable JSON";
    if (m.marked(reading)) return "already migrated";
    if (checkChain(reading.text_source) || !reading.text_source.some(m.isLayer)) return m.noLayer;
    const last = this.#one(`SELECT rowid AS n FROM reading_history WHERE capture_sha=? ORDER BY seq DESC LIMIT 1`, sha);
    if (last && Number(last.n) > Number(cutoff)) return m.after;
    if (!ev) return { waiting: localize("extraction.index.no_evidence_store_set_up", "your team's Civicsmith has no evidence store set up, so the stored bytes cannot be read again") };
    /* (fix round 6, G6; R39 there) a digest alone is no document: a bundle that holds none for this capture is given at least the size the
       store holds the object at, as `readHeld` would give it, before the bytes are asked for. */
    let doc = this.#storedDocument(row.bundle_id, sha);
    if (!doc) {
      let size = null;
      try { const h = await ev.head(sha); size = h && Number.isFinite(h.size) && h.size > 0 ? h.size : null; } catch { size = null; }
      doc = { capture: { sha256: sha, ...(size === null ? {} : { bytes: size }) } };
    }
    const got = await bytesOf(this.#evidenceOf(sha), doc).catch(() => ({ bytes: null }));
    if (!got.bytes) return { waiting: localize("extraction.index.migrate_bytes_not_held", "the capture's bytes are not held in the evidence store") };
    const entry = getFormat(m.format);
    if (!entry || typeof entry.parts !== "function" || typeof entry.text !== "function")
      return `no ${m.format} entry is registered`;
    let parts, text;
    try { parts = await entry.parts(got.bytes); text = parts && parts.ok ? await entry.text(parts) : null; }
    catch { return `the ${m.format} entry could not read the stored bytes`; }
    const map = parts && parts.ok ? m.renumber(parts) : null;
    if (!map || !text || text.ok === false || !m.readable(text)) return "unmoved";
    if (!m.moves(map)) return "unmoved";
    const oldWalk = m.oldWalk(reading, map);
    if (oldWalk !== true) return oldWalk;
    const next = m.migrated(reading, map, text, { at: stampInstant("second") });
    if (Object.prototype.hasOwnProperty.call(reading, "provenance"))
      next.provenance = await readingProvenance({ text, chain: next.text_source,
        tier: Number.isInteger(next.text_tier) ? next.text_tier : null, container: m.format,
        planeVersion: this.env.VERSION || null, member: null });
    const u = textUnitsFor(text, { budget: Infinity });
    const composed = row.origin === "composed" ? true : row.origin === "asserted" ? false : this.#composedHere(this.#serialOf(reading, { take: true }).digest);
    /* The stored reading must still be the one examined: a promotion or re-read that landed meanwhile wins. */
    const wrote = this.core.transact(() => {
      const now = this.#one(`SELECT reading FROM readings WHERE capture_sha=?`, sha);
      if (!now || now.reading !== row.reading) return null;
      return this.writeReading({ bundleId: row.bundle_id, captureSha: sha, reading: next, textUnits: u.textUnits,
        textUnitsOverBound: u.textUnitsOverBound, textUnitsSkipped: u.textUnitsSkipped,
        author: composed ? null : row.asserted_by ?? null, justification: composed ? null : safeJson(row.justification) ?? row.justification,
        composed });
    });
    if (!wrote) return localize("extraction.index.migrate_reading_changed", "the stored reading changed while it was being read again, and the newer one stands");
    if (composed) this.recordComposed(next, sha);
    return { migrated: true, moved: next.migrated[m.key].moved };
  }

  /* The capture's document in the bundle's own provenance document (record-core `readFile`), or null. */
  #storedDocument(bundleId, sha) {
    let docText = null;
    try {
      const f = this.core && typeof this.core.readFile === "function" ? this.core.readFile(bundleId, "data/provenance.json") : null;
      docText = f && typeof f === "object" ? (f.text ?? f.content ?? null) : (typeof f === "string" ? f : null);
    } catch { docText = null; }
    const docs = (safeJson(docText) || {}).documents;
    return Array.isArray(docs) ? docs.find((d) => d && d.capture && d.capture.sha256 === sha) || null : null;
  }

  /* ---- re-reading, `op=pdfstructure` (R31–R35) ---- */

  /** What a re-read needs of the stored reading (D-15: a capture whose bundle the viewer may not see answers as
   *  one never read): the reading, the locator the acquire read under (from the bundle's own provenance document,
   *  record-core's `readFile`), and the capture's whole per-page units (D-616: a truncated unit is not the page). */
  reextractBasis({ captureSha = null, viewer = null, ungated = false } = {}) {
    const sha = typeof captureSha === "string" ? captureSha.trim().toLowerCase() : "";
    const row = sha ? this.#one(`SELECT bundle_id, reading FROM readings WHERE capture_sha=?`, sha) : null;
    if (!row || !(ungated || this.#sees(row.bundle_id, viewer))) return { held: false };
    const doc = this.#storedDocument(row.bundle_id, sha);
    /* (fix round 9, G126e, G132k) a page's units in reading order, joined: a page over the unit cap is stored as consecutive runs (reading-pipeline R47) */
    const byPage = new Map();
    for (const u of this.#rows(
      `SELECT extent, text FROM capture_text WHERE capture_sha=? AND extent_kind='pdf-page' AND truncated=0 ORDER BY seq`, sha)) {
      const e = safeJson(u.extent);
      if (e && Number.isInteger(e.page) && typeof u.text === "string") byPage.set(e.page, (byPage.get(e.page) ?? "") + u.text);
    }
    const units = [...byPage].sort((a, b) => a[0] - b[0]).map(([page, text]) => ({ page, text }));
    return { held: true, bundleId: row.bundle_id, reading: safeJson(row.reading) || {}, json: row.reading,
             locator: doc && typeof doc.locator === "string" ? doc.locator : null, units };
  }

  /** R31–R35: `op=pdfstructure`'s Durable Object half. The control plane has refused a malformed digest and an
   *  instance with no evidence storage, and stamps `cls`, `session` (a member session), `caps`, `viewer` and
   *  `author`. Answers `{status, body}`. Without `ocr` it is a read, byte-identical to the read before `ocr=1`
   *  existed; with it, every refusal comes before any byte is read or engine called (C-51), then the re-read. */
  async pdfStructure({ sha, ocr = null, cls = null, session = false, caps = [], viewer = null, author = null,
                       storeName = "bio", env = null, ungated = false } = {}) {
    const e = env || this.env || {};
    const op = "pdfstructure";
    const ocrAsked = ocr !== null && ocr !== undefined;
    let reBasis = null;
    /* DEC-49 REGION is-reextract */
    if (ocrAsked) {
      if (ocr !== "1")
        return { status: 400, body: { ok: false, reason: "REEXTRACT_FLAG_MALFORMED", ...reextractRow("REEXTRACT_FLAG_MALFORMED"),
          op, detail: localize("extraction.index.ocr_stringify_is_not_a", "ocr={stringify} is not a value this op reads. Send ocr=1 to re-read the document with the OCR member, or leave the parameter off for the ordinary read.", { stringify: String(JSON.stringify(String(ocr).slice(0, 40))) }) } };
      if (cls === "ai")
        return { status: 403, body: { ok: false, reason: "REEXTRACT_AGENT_REFUSED", ...reextractRow("REEXTRACT_AGENT_REFUSED"),
          op, detail: `op=pdfstructure is declared a read, so no agent task scope can name it as a write, `
                    + `and ocr=1 writes this capture's reading. An agent is confined to the writes its `
                    + `member declared (D-199).` } };
      const held = new Set(Array.isArray(caps) ? caps : []);
      if (session && !held.has("contribute"))
        return { status: 403, body: { ok: false, reason: "REEXTRACT_NOT_CAPABLE", ...reextractRow("REEXTRACT_NOT_CAPABLE"),
          op, needs: "contribute", held: [...held].sort(),
          detail: localize("extraction.index.a_re_read_replaces_this", "a re-read replaces this capture's reading, its text units and the standing of content rows cited under the old one, which is a write to the record and asks the capability a promotion asks.") } };
      if (!e.OCR_WORKER)
        return { status: 501, body: { ok: false, reason: "REEXTRACT_NO_OCR_MEMBER", ...reextractRow("REEXTRACT_NO_OCR_MEMBER"),
          op, sha256: sha,
          detail: localize("extraction.index.no_ocr_member_is_bound", "no OCR member is bound to this instance (the OCR_WORKER service binding is absent), so there is no tier 3 to reach. Nothing was read, called or written. An instance that installs the member later can re-read this capture then (D-115, D-319).") } };
      reBasis = this.reextractBasis({ captureSha: sha, viewer, ungated });
      if (!reBasis.held)
        return { status: 409, body: { ok: false, reason: "REEXTRACT_NOT_READ", ...reextractRow("REEXTRACT_NOT_READ"),
          op, sha256: sha,
          detail: localize("extraction.index.this_record_holds_no_reading", "this record holds no reading of that capture that you can see, so there is nothing for a re-read to replace. A capture is read when a record carrying it is promoted; a capture in a project you are not part of answers exactly as one never filed.") } };
    }
    /* END DEC-49 REGION is-reextract */
    /* (fix round 9, G126b, G126e; R103) the press makes no OCR call and loads nothing in the request: it owes the pages left, "Read it" */
    if (ocrAsked) {
      /* R31 (N285): an absent object is capture's one answer for it, asked of the store's `head` (no byte is read) */
      if (!(await this.#heldByWhole(sha))) return evidenceAbsent(sha, storeName, { tokenClass: cls });
      return this.#pressOwes({ sha, basis: reBasis, op, author });
    }
    const got = await this.#requestBytes(sha);
    /* R31 (N285): an absent object is capture's one answer for it (its R63), byte-identical to op=capture's own. */
    if (got.absent) return evidenceAbsent(sha, storeName, { tokenClass: cls });
    if (got.over) return { status: 200, body: await this.#overRequest(op, sha, got.size) };
    const bytes = got.bytes;
    const pdfEntry = getFormat("pdf");
    if (!pdfEntry || typeof pdfEntry.structure !== "function")
      return { status: 501, body: { ok: false, reason: "FORMAT_UNREGISTERED", format: "pdf",
        error: 'format "pdf" is not registered in the format registry (formats.mjs), so op=pdfstructure has no extractor to dispatch to' } };
    const structure = await pdfEntry.structure(bytes);
    if (!structure.ok) return { status: 422, body: structure };

    /*__REC98_TIER2_WIRE_STRUCTURE_START__*/
    /* R31 (reading-pipeline R3): tier 2 by the one escalation both paths run; the member's notes carried, deduped; `tier` the merge's
       own verdict; `tier2_no_improvement` / `tier2_unavailable` when the member could not help. */
    let structureTier = 1, readT2PerPage = null, readT2Note = null;
    const t2 = await tier2Escalate(e, { sha, storeName, text: structure.text });
    if (t2.outcome === "no_improvement") structure.notes = [...structure.notes, "tier2_no_improvement"];
    else if (t2.outcome === "unavailable") structure.notes = [...structure.notes, "tier2_unavailable"];
    else if (t2.outcome === "merged" || t2.outcome === "refused") {
      for (const n of t2.memberNotes) if (!structure.notes.includes(n)) structure.notes = [...structure.notes, n];
      if (t2.outcome === "merged") {
        structure.text = t2.text;
        structureTier = t2.replaced.length ? 2 : 1;
        if (t2.note) structure.notes = [...structure.notes, t2.note];
        readT2PerPage = t2.perPage; readT2Note = t2.note;
      } else {
        structure.notes = [...structure.notes, t2.note];
        readT2Note = t2.note;
      }
    }
    structure.tier = structureTier;
    /*__REC98_TIER2_WIRE_STRUCTURE_END__*/

    const structureChain = null;
    /* R52 (N48, K135, K138): the item-to-file membership derived from containment, beside `links[]` and never inside it,
       under the link shapes the active profiles state; null with its reason when none applies. */
    Object.assign(structure, membershipBeside(structure, this.view()));
    /* D-536: the served text's provenance, by the one rule a reading's is composed by. */
    structure.provenance = await readingProvenance({ text: structure.text || null, chain: structureChain,
      tier: Number.isInteger(structure.tier) ? structure.tier : null, container: "pdf", planeVersion: e.VERSION || null });
    return { status: 200, body: structure };
  }

  /** (fix round 9, G126e; R103) The bytes of a capture a member's request may load whole: read by its whole digest through `readRange` when it is at most
   *  REQUEST_READ_MAX; `{absent}` when nothing is held under it, `{over, size}` past the bound (nothing read). */
  async #requestBytes(sha) {
    let size = null;
    try { const h = await this.#evidenceOf(sha).head(sha); size = h && Number.isFinite(h.size) ? h.size : (h ? null : -1); } catch { size = -1; }
    if (size === -1) return { absent: true };
    if (size !== null && size > REQUEST_READ_MAX) return { over: true, size };
    const b = await readRange(this.#rangeStore(), sha, 0, size ?? REQUEST_READ_MAX + 1);
    if (!(b instanceof Uint8Array)) return { absent: true };
    if (b.length > REQUEST_READ_MAX) return { over: true, size: b.length };
    return { bytes: b };
  }

  /** (fix round 9, G126e; R103; R-SILENT; K4901 (2)) `op=pdfstructure` of a PDF over REQUEST_READ_MAX: nothing is read in the request; a raised `reading`
   *  job is registered (the ledger reads it in pieces) and the answer states the file's size and the bound. Stand-in until T52 (K4269); the row owed:
   *  `extraction.why.request_too_large`. */
  async #overRequest(op, sha, size) {
    const entry = { kind: "reading", sha, priority: "raised" };
    const registration = owedAnswer(entry, await this.#oweVia(null).owe(entry));
    return { ok: true, op, sha256: sha, size, limit: REQUEST_READ_MAX,
             reextraction: { performed: false, written: false, owed: true, registration,
               why: localize("extraction.why.request_too_large", "this file is {size} bytes, more than a request reads whole here ({limit} bytes), so it is read in the background", { size: String(size), limit: String(REQUEST_READ_MAX) }) } };
  }

  /** (fix round 9, G126b, G126e; R103; R33, R35) The press, `op=pdfstructure&ocr=1`, after its refusals: no byte is loaded and no OCR call is made in the
   *  request. The pages the stored reading leaves unread (its stored units, as `#storedPages` reads them) are registered as one `ocr` job, raised ("Read
   *  it"), which the ledger reads by R34's rule; the answer's `reextraction` says nothing was performed or written here, which pages are owed and whether
   *  the registrar holds them. A reading with no page left owes nothing (R33). */
  async #pressOwes({ sha, basis, op, author = null }) {
    const cost = localize("extraction.index.press_cost", "about 10 s per image-only page on the deployed OCR member (CPDF-10's measurement, the MEASUREMENTS ledger)");
    const pages = this.#pagesLeft(sha, basis);
    if (!pages.length)
      return { status: 200, body: { ok: true, op, sha256: sha, reextraction: { performed: false, written: false, cost, candidate: [],
        why: say("extraction.why.page_document_lacks") } } };
    const entry = { kind: "ocr", sha, cursor: pages[0], pages_left: pages.length, priority: "raised",
                    detail: { via: "op=pdfstructure&ocr=1", ...(typeof author === "string" && author ? { by: author } : {}) } };
    const via = this.#oweVia(null);
    const registration = owedAnswer(entry, await via.owe(entry));
    return { status: 200, body: { ok: true, op, sha256: sha, reextraction: { performed: false, written: false, owed: true, cost, candidate: pages, registration,
      /* stand-in until T52 (K4269); the row owed: `extraction.why.press_owed` */
      why: localize("extraction.why.press_owed", "your team's Civicsmith reads {count} page(s) with its text recognition in the background, and the reading shows them as each is read", { count: String(pages.length) }) } } };
  }

  /** R34, R71: a composed reading written by R19's writer while the capture is still in the caller's sight, then
   *  recorded as composed here (R21), with R69's after-read outcome and what the listeners and index reported. Answers
   *  `{ok: true, staled, observed, compared, afterRead, indexed}`, `{ok: false}` when the capture left the caller's
   *  sight, or `{ok: false, rolledBack: true}` when the write was refused while it ran and nothing of it was kept. */
  async #writeReread({ basis, sha, reading, text, author, viewer, ungated = false, job = null, call = null }) {
    const u = textUnitsFor(text, { budget: Infinity });
    let w = { ok: false };
    const via = this.#oweVia(call);
    let owing = null;
    try {
      /* (fix round 9, G126e; R103) compare-and-set: the stored reading is written over only while it is still the one this reading was composed from;
         a changed basis is never overwritten (`changed`: the caller reads it again) */
      const out = ungated || this.#sees(basis.bundleId, viewer)
        ? this.core.transact(() => {
            const now = this.#one(`SELECT reading FROM readings WHERE capture_sha=?`, sha);
            if (typeof basis.json === "string" && (!now || now.reading !== basis.json)) return { changed: true };
            const wr = this.writeReading({ bundleId: basis.bundleId, captureSha: sha, reading, textUnits: u.textUnits,
                                           textUnitsOverBound: u.textUnitsOverBound, textUnitsSkipped: u.textUnitsSkipped,
                                           author, composed: true });
            if (job) owing = via.owe(job);
            return wr;
          })
        : null;
      if (out && out.changed) return { ok: false, changed: true };
      if (out) {
        this.recordComposed(reading, sha);
        /* R69: the after-read hooks' outcome, reported with the reading. */
        const afterRead = out.afterRead ? await out.afterRead : null;
        const ls = Object.values(out.listeners || {});
        const staled = ls.reduce((n, l) => n + (l && Number.isInteger(l.staled) ? l.staled : 0), 0);
        const observed = (ls.find((l) => l && l.observed) || {}).observed ?? null;
        w = { ok: true, staled, observed, compared: out.kept ? out.kept.compared : null, afterRead,
              indexed: { written: out.indexed.written, offered: out.indexed.offered, over_bound: out.indexed.over_bound },
              ...(owing ? { registration: owedAnswer(job, await owing) } : {}) };
        await via.arm();
      }
    } catch { w = { ok: false, rolledBack: true }; }
    return w;
  }

  /* ---- transcribing the pages Civicsmith could not read, `op=pagetranscribe` (R71, R72) ---- */

  /** R72 (K31's pattern; plane R36): the composition root registers one transcriber, once, at start. `t` is
   *  `{deployable(), keptAway({project, use}), transcription({member, project, at, trace?, memberRef?})}`, `transcription` answering
   *  reading-pipeline R29's `{member, project?, credentials, useCheck, transcribe, at, act}`. A malformed registration
   *  is refused LISTENER_MALFORMED and a second, by any module, LISTENER_DECLARED (membership's `listenerRefusal`, its
   *  R81: the slot takes one registration whoever makes it). Everything above this layer arrives through it. */
  /** R113 (T53; N1259; K4403 (2), (5)): `registerHeldAs(module, provider)`, once (a second is refused `LISTENER_DECLARED`, a malformed one `LISTENER_MALFORMED`):
   *  `provider.holds(sha)` answers `{register, import}` (or `true`) for a capture it holds, a register segment. Such a capture is handed to no reading-pipeline and no
   *  reading is written: `read`, `readHeld` and `readingFor` state its reading as `held_as_register`, never a failure and never "unread". With no provider every
   *  capture is read as before. */
  registerHeldAs(module, provider) {
    const refused = listenerRefusal(this.#heldAs, module, provider && typeof provider.holds === "function" ? provider.holds : null);
    if (refused) return refused;
    this.#heldAs = { module, provider };
    return { ok: true, module };
  }

  /* R113: what the provider says of a capture it holds, `{register, import}`; null for none, for no provider, and for a provider that throws. */
  #heldAsRegister(sha) {
    if (!this.#heldAs || typeof sha !== "string" || !sha) return null;
    try {
      const h = this.#heldAs.provider.holds(sha);
      if (!h) return null;
      return h === true ? { register: null, import: null } : { register: h.register ?? null, import: h.import ?? null };
    } catch { return null; }
  }

  registerTranscriber(module, t) {
    const refused = listenerRefusal(this.#transcriber, module, isTranscriber(t) ? t.transcription : null);
    if (refused) return refused;
    this.#transcriber = { module, t };
    return { ok: true, module };
  }

  /* R71: the project whose "no AI" limit judges the capture: its reading's own bundle's, by membership's rule over
     record-core's `bundles` (its R37): the bundle itself when it is a project, else the project it is filed in; null
     for a bundle in none. */
  #projectOfBundle(bundleId) {
    const r = this.#one(`SELECT CASE WHEN object_type = 'project' THEN bundle_id ELSE project END AS p
                           FROM bundles WHERE bundle_id=?`, bundleId);
    return r && typeof r.p === "string" && r.p ? r.p : null;
  }

  /** R71 (`op=pagetranscribe`; N832, D21): a member's act, the AI's reading of the pages of a stored reading (a PDF's,
   *  or a picture file's one page, R73) that Civicsmith's own text recognition could not read (reading-pipeline R29),
   *  on the account that pays for that act.
   *  The control plane has refused a malformed digest and an instance with no evidence storage, and stamps `cls`,
   *  `session`, `caps`, `viewer` and `by`. Every refusal comes before any byte is read, any account is read or any page
   *  is rendered (C-51.2, C-51.3, C-51.7, C-51.5, then the transcriber's keep-away refusal relayed as given). Then the
   *  text as R33–R35 compose it (tier 2; tier 3 seeded with the pages the stored reading holds, the OCR member asked
   *  only when bound), `reading-pipeline.tier4Extend`, and R34's write. Answers `{status, body}`. (T44) With nothing
   *  filled, `says` is read by key by what the AI path answered (`unfilledOutcome`); a refusal says
   *  `transcribe.refused` beside its own fields. */
  async pageTranscribe({ captureSha = null, project = null, cls = null, session = false, caps = [], viewer = null,
                         by = null, trace = null, memberRef = null, storeName = "bio", env = null } = {}) {
    const e = env || this.env || {};
    const op = "pagetranscribe";
    const sha = typeof captureSha === "string" ? captureSha.trim().toLowerCase() : "";
    const reg = this.#transcriber;
    /* DEC-49 REGION is-transcribe */
    if (cls === "ai")
      return { status: 403, body: { ok: false, reason: "REEXTRACT_AGENT_REFUSED", ...reextractRow("REEXTRACT_AGENT_REFUSED"),
        op, detail: localize("extraction.index.op_pagetranscribe_writes_this_captures", "op=pagetranscribe writes this capture's reading and spends the account that pays for it, and an agent credential cannot declare that as one of its writes. A member can ask for it (D-199).") } };
    const held = new Set(Array.isArray(caps) ? caps : []);
    if (session && !held.has("contribute"))
      return { status: 403, body: { ok: false, reason: "REEXTRACT_NOT_CAPABLE", ...reextractRow("REEXTRACT_NOT_CAPABLE"),
        op, needs: "contribute", held: [...held].sort(),
        detail: localize("extraction.index.a_transcription_replaces_this_captures", "a transcription replaces this capture's reading, its text units and the standing of content rows cited under the old one, which is a write to the record and asks the capability a promotion asks.") } };
    let deployable = false;
    try { deployable = !!reg && reg.t.deployable() === true; } catch { deployable = false; }
    if (!deployable)
      return { status: 501, body: { ok: false, reason: "TRANSCRIBE_NOT_DEPLOYED", ...reextractRow("TRANSCRIBE_NOT_DEPLOYED"),
        op, sha256: sha,
        detail: localize("extraction.index.the_ais_part_for_transcribing", "the AI's part for transcribing pages has not passed its test bar here (run-rules R19), so it is not switched on. Nothing was read, rendered, sent or written, and no account was looked at.") } };
    const basis = this.reextractBasis({ captureSha: sha, viewer });
    if (!basis.held)
      return { status: 409, body: { ok: false, reason: "REEXTRACT_NOT_READ", ...reextractRow("REEXTRACT_NOT_READ"),
        op, sha256: sha,
        detail: localize("extraction.index.this_record_holds_no_reading_2", "this record holds no reading of that capture that you can see, so there are no pages for the AI to transcribe. A capture is read when a record carrying it is promoted; a capture in a project you are not part of answers exactly as one never filed.") } };
    /* `ai-accounts.aiKeptAway` (its R7, as its R22 and R34 amend it), the one site of both codes, relayed as given; it
       fails closed itself, and a transcriber that throws here fails the request, nothing read or sent (no code is
       minted here for it). */
    const away = reg.t.keptAway({ project: this.#projectOfBundle(basis.bundleId), use: TRANSCRIBE_USE });
    if (away) return { status: refusalStatus(away), body: withRefusedSays(away) };
    /* END DEC-49 REGION is-transcribe */
    /* (fix round 9, G126e; R103) nothing is loaded whole in the request: the format from the first KiB through `readRange`, the pages from the stored units */
    const head = await this.#heldHead(sha);
    if (!head) return evidenceAbsent(sha, storeName, { tokenClass: cls });
    /* R73 (N853b): the format as the stored bytes answer it now, never the profile recorded at capture (a photo
       captured before its entry was registered was profiled `undetermined`), read through that format's entry. A
       format with no `structure`, or whose entry cannot read these bytes, is no refusal: nothing is read or written. */
    const fmt = detectFormat(head, null).format;
    const entry = getFormat(fmt);
    const unread = (why) => ({ status: 200, body: { ok: true, op, sha256: sha, format: fmt,
      transcription: { performed: false, written: false, why } } });
    if (!entry || typeof entry.structure !== "function")
      return unread(say("extraction.unread.stored_bytes_read", {
        fmt: fmt === "undetermined" ? say("extraction.unread.format_group_civicsmith") : `"${fmt}"` }));
    const built = this.#storedPages(basis, fmt);
    if (!built) return unread(say("extraction.unread.stored_bytes_read_reader", { format: fmt, reason: " (NO_PAGES)" }));
    const stored = basis.reading || {};
    const tier = Extraction.#layerTier(stored), t2Note = null, notes = [];
    /* R71, R35 (reading-pipeline R30): tier 3 seeded with the pages the stored reading holds, OCR's and the AI's, so none is asked of the AI again; no
       OCR call in the request (R103, reading-pipeline R55): the pages OCR has not read are left, and owed below */
    const t3 = await tier3Extend(e, { sha, storeName, i2text: built.i2text, wiredTier: tier, tier2PerPage: null, fmt,
      seed: built.seed, invocations: 0, liveCalibration: (q) => this.#liveCalibration(q) });
    const chain3 = (t3.chainSet ? t3.chain : null) || layerChainFor(t3.i2text, { tier: t3.wiredTier, container: fmt });
    const at = stampInstant("second");
    /* R72 (T50; N1082): the door's `trace` and `memberRef`, handed on only when each is a non-empty string, so a call
       with none passes neither key (plane R55). Neither is read, stored or answered here. */
    const door = {};
    if (typeof trace === "string" && trace) door.trace = trace;
    if (typeof memberRef === "string" && memberRef) door.memberRef = memberRef;
    let tx = null;
    try { tx = reg.t.transcription({ member: by, project, at, ...door }); } catch { tx = null; }
    /* R71 (N862, K2689): whether the AI path was asked, for which pages, and what it answered, so `transcribe.none`
       is said only when agent-worker was asked and filled nothing. */
    const asked = { pages: null, answer: null };
    const handed = tx && typeof tx === "object" && typeof tx.transcribe === "function"
      ? { ...tx, transcribe: async (q) => {
          asked.pages = Array.isArray(q && q.pages) ? [...q.pages] : [];
          asked.answer = await tx.transcribe(q);
          return asked.answer; } }
      : tx;
    const t4 = await tier4Extend(handed, { sha, storeName, i2text: t3.i2text, chain: chain3, wiredTier: t3.wiredTier });
    /* R71 (N853a, K2713): an account or limit refusal relayed by tier 4 is answered as that refusal, nothing written;
       (T44; N869, N876) it also says `transcribe.refused`. */
    const refusal = t4.aiRefusal && typeof t4.aiRefusal === "object" ? t4.aiRefusal : null;
    if (refusal && !t4.filled.length) return { status: refusalStatus(refusal), body: withRefusedSays(refusal) };
    if (!t4.filled.length) {
      const why = t4.aiNote || say("extraction.text.ai_asked_transcribe");
      const outcome = asked.pages === null ? null : unfilledOutcome(asked.answer, fmt);
      /* (T44) a refusal agent-worker answered after the post, carrying its row's translation, is that refusal too. */
      if (outcome && outcome.refusal) return { status: refusalStatus(outcome.refusal), body: withRefusedSays(outcome.refusal) };
      const says = !outcome ? null
        : outcome.none ? fillWords("transcribe.none", { pages: pagesSaid(asked.pages), why })
        : fillWords(outcome.key, { why: fillWords(outcome.why) });
      return { status: 200, body: { ok: true, op, sha256: sha,
        transcription: { performed: false, written: false, why }, ...(says ? { says } : {}) } };
    }
    /* R71 by R34's rule: the stored reading's type, `at` the capture instant, page count and container extent carried,
       reading-pipeline R18's provenance, the read's own counts and emitted fields, and `reextracted`. */
    const chain = t4.chain;
    /* the OCR pages tier 3 left that the AI did not fill stay owed (R103) */
    const ocrLeft = t3.left ? t3.left.pages.filter((pg) => !t4.filled.includes(pg)) : [];
    const reading = await this.#composedReread({ stored, basis, i2text: t4.i2text, chain, wiredTier: t4.wiredTier, fmt, pages: built.pages, env: e,
      ocrNote: t3.ocrNote, tier3Candidate: t3.stillWanting, t3: { ...t3, left: ocrLeft.length ? { cursor: ocrLeft[0], pages: ocrLeft } : null },
      tier2note: t2Note });
    /* R74 (T46; N897 (2)): the test-instance label the plane handed in for this act, recorded on the reading it writes;
       a label already stored stays, whatever this act was admitted by. */
    const untested = untestedOf(tx);
    if (!reading.untested) keepUntested(reading, stored, untested);
    const act = tx && typeof tx.act === "string" && tx.act ? tx.act : null;
    reading.reextracted = {
      at, by, engine: t3.engine ? t3.engine.engine : null, version: t3.engine ? t3.engine.version : null,
      calibration: t3.engine ? t3.engine.calibration ?? null : null, pages: t3.filled, via: "op=pagetranscribe",
      ai: { engine: t4.engine.engine, version: t4.engine.version, pages: t4.filled, act },
    };
    const owedOcr = ocrLeft.length ? { kind: "ocr", sha, cursor: ocrLeft[0], pages_left: ocrLeft.length } : null;
    const w = await this.#writeReread({ basis, sha, reading, text: t4.i2text, author: by, viewer, job: owedOcr });
    return { status: 200, body: { ok: true, op, sha256: sha, tier: t4.wiredTier, notes,
      transcription: {
        performed: true, written: w.ok === true, ...unwrittenWhy(w, "transcription"),
        pages: t4.filled, engine: t4.engine.engine, version: t4.engine.version, act,
        ...(untested ? { untested } : {}),
        text_source: chain, chain: describeChain(chain),
        label: TRANSCRIBE_WORDS["transcribe.label"], note: t4.aiNote, measured_by: AI_TRANSCRIPTION_SOURCE,
        ocr: t3.filled.length ? { pages: t3.filled, engine: t3.engine } : null,
        reading: { content_type: reading.content_type, read_from_text: reading.read_from_text, found: reading.found,
                   entities: Array.isArray(reading.entities) ? reading.entities.length : 0, text_tier: reading.text_tier },
        staled: w.staled ?? 0, units: w.indexed ?? null, observed: w.observed ?? null, compared: w.compared ?? null,
        after_read: w.afterRead ?? null,
      },
      /* (fix round 9, G126e; R71 as R103 amends it) the pages filled, never the pages asked */
      ...(w.ok === true ? { says: fillWords("transcribe.done", { pages: pagesSaid(t4.filled) }) } : {}),
      ...(w.registration ? { owed: w.registration } : {}) } };
  }

  /* ---- drift obligations (R38–R40) ---- */

  /** R39's derivation, unfiltered by viewer: calibration's worse supersessions (its R11) against the text-source rows
   *  naming a calibration, read at most TEXT_SOURCE_LIMIT_MAX with `truncated`. `supersededId` narrows it (R40). The
   *  content-axis frontier (`retrieval`'s `frontier.mjs`) reads it whole, and gates its own rows. */
  driftFor(supersededId = null) {
    const c = this.calibration;
    if (!c || typeof c.worseSupersessions !== "function")
      return Object.assign([], { unavailable: true, limit: TEXT_SOURCE_LIMIT_MAX, truncated: false });
    const s = c.worseSupersessions({ ...(supersededId ? { supersededId } : {}), limit: TEXT_SOURCE_LIMIT_MAX }) || {};
    const supers = Array.isArray(s.supersessions) ? s.supersessions : [];
    const out0 = (list) => Object.assign(list, { limit: TEXT_SOURCE_LIMIT_MAX, truncated: false,
                                                 supersessionsTruncated: !!s.truncated });
    if (!supers.length) return out0([]);
    const wanted = new Set(supers.map((x) => x && x.superseded && x.superseded.calibration_id).filter(Boolean));
    const cap = TEXT_SOURCE_LIMIT_MAX;
    const page = this.#rows(
      `SELECT capture_sha, bundle_id, derivation_cap, chain, calibrations
         FROM reading_text_source WHERE calibrations IS NOT NULL ORDER BY capture_sha LIMIT ?`, cap + 1);
    const bound = [];
    for (const r of page.slice(0, cap))
      for (const id of (safeJson(r.calibrations) || []))
        if (wanted.has(id))
          bound.push({ id: r.capture_sha, capture_sha: r.capture_sha, bundle_id: r.bundle_id,
                       calibration_id: id, derivation_cap_recorded: r.derivation_cap ?? null });
    const out = driftObligations(supers, bound);
    return Object.assign(out, { limit: cap, truncated: page.length > cap || !!s.truncated });
  }

  /** R39 (`op=calibrationdrift`): derived on read, never stored; rows in bundles the viewer may not see withheld
   *  whole; `regraded: 0`. */
  calibrationDrift({ engine = null, viewer = null } = {}) {
    const visible = this.#redactor(viewer);
    const raw = this.driftFor(null);
    const all = raw.filter((o) => (engine ? o.engine === engine : true)).filter((o) => visible(o.bundle_id) !== null);
    return { ok: true, ...(engine ? { engine } : {}), obligations: all, count: all.length,
             limit: raw.limit, truncated: !!raw.truncated, regraded: 0,
             ...(raw.unavailable ? { undetermined: say("extraction.undetermined.calibration_module_reachable") } : {}),
             why: all.length
               ? localize("extraction.index.length_transcription_s_were_graded", "{length} transcription(s) were graded under a measurement a later probe found WEAKER. NOTHING HAS BEEN RE-GRADED and nothing will be automatically: this names the work so a member can do it (DEC-4)", { length: String(all.length) })
               : say("extraction.why.transcription_store_rests") };
  }

  /** R40: `calibration.onCalibration`'s listener, answering `{obligations, truncated}` (K137, calibration R12).
   *  `worse`: R39's obligations for the superseded calibration alone, unfiltered by viewer, with `truncated`;
   *  otherwise an empty list. Writes nothing. */
  obligationsFor(e) {
    const verdict = e && e.drift && typeof e.drift === "object" ? e.drift.verdict ?? e.drift.drift : e && e.drift;
    const worse = verdict === "worse" || (e && e.drift && e.drift.raises_obligation === true);
    if (!worse || !e.supersedes) return { obligations: [], truncated: false };
    const out = this.driftFor(e.supersedes);
    return { obligations: [...out], truncated: !!out.truncated };
  }
}

/* (fix round 9, G128c; reading-pipeline R57) The first piece of a PDF read in ranges, completed so far as it can be: `text_glyphs` (null in a ranged reading)
   the glyphs of the units it carries, and, when it is also the last piece, `words_total` the words it read. Every other reading is left as it is. */
function completeFirstPiece(out) {
  const r = out.reading;
  if (r.text_container !== "pdf" || !out.piece || typeof out.more !== "boolean") return;
  const units = Array.isArray(out.text_units) ? out.text_units : [];
  if (r.text_glyphs == null && units.length) r.text_glyphs = units.reduce((n, u) => n + (u && typeof u.text === "string" ? glyphCount(u.text) : 0), 0);
  if (out.more === false && r.words_total == null && Number.isInteger(r.words_read)) r.words_total = r.words_read;
}

/* (fix round 9, S25; K4911) The pages a later piece carries: its `piece.pages` range `[from, to)` (reading-pipeline R40), else the pages of its units. */
function piecePagesOf(out, units) {
  const r = out && out.piece && Array.isArray(out.piece.pages) && out.piece.pages.length === 2 && out.piece.pages.every(Number.isInteger) ? out.piece.pages : null;
  if (r) return Array.from({ length: Math.max(0, r[1] - r[0]) }, (_, i) => r[0] + i);
  return [...new Set((units || []).map((u) => u && u.extent && u.extent.page).filter(Number.isInteger))].sort((a, b) => a - b);
}

/* (S25) A chain as page-scoped parts `[{pages, chain}]` (the steps without their stamp): an unscoped chain is one part over `pages`; a scoped one its parts
   as `text-chain.mergedChain` stamped them. Null when a part cannot be read back. */
function chainParts(chain, pages) {
  if (!Array.isArray(chain) || checkChain(chain)) return null;
  if (!chain.some((x) => x && x.extent != null)) return pages.length ? [{ pages: [...pages], chain }] : [];
  const parts = new Map();
  for (const step of chain) {
    const e = step.extent;
    if (e == null) { for (const p of parts.values()) p.chain.push(step); continue; }
    if (!(e && e.kind === "pages" && Array.isArray(e.pages))) return null;
    const key = Number.isInteger(e.part) ? `#${e.part}` : e.pages.join(",");
    const { extent, ...bare } = step;
    if (!parts.has(key)) parts.set(key, { pages: e.pages.slice(), chain: [] });
    parts.get(key).chain.push(bare);
  }
  return [...parts.values()];
}

/* (S25; K4911) The stored chain with a later piece's pages folded in: the stored parts lose the piece's pages, the piece's own parts (over its pages) are
   added, parts with the same steps are joined, and a chain whose parts all have the same steps stays unscoped, as a whole read's of one kind is. The
   stored chain's parts are taken over the pages before the piece (the pages earlier pieces carried). Null when either chain cannot be read back. */
function foldPieceChain(stored, piece, piecePages) {
  if (!piecePages.length) return null;
  const from = Math.min(...piecePages);
  const earlier = Array.from({ length: from }, (_, i) => i);
  const sp = chainParts(stored, earlier), pp = chainParts(piece, piecePages);
  if (!sp || !pp) return null;
  const inPiece = new Set(piecePages);
  const joined = new Map();
  for (const part of [...sp.map((x) => ({ ...x, pages: x.pages.filter((p) => !inPiece.has(p)) })), ...pp]) {
    if (!part.pages.length) continue;
    const key = JSON.stringify(part.chain);
    if (!joined.has(key)) joined.set(key, { pages: [], chain: part.chain });
    joined.get(key).pages.push(...part.pages);
  }
  const parts = [...joined.values()].map((x) => ({ ...x, pages: [...new Set(x.pages)].sort((a, b) => a - b) }));
  if (!parts.length) return null;
  if (parts.length === 1) return parts[0].chain;
  const merged = mergedChain(parts);
  return Array.isArray(merged) ? merged : null;
}

/* (fix round 9, G129c; R101) The pages whose OCR call died this tick (5xx or a throw, reading-pipeline R54's `ocr_killed`), answered for the ledger's
   attempt stamps; nothing when none died. */
function killedOf(reading) {
  const k = reading && Array.isArray(reading.ocr_killed) ? reading.ocr_killed.filter(Number.isInteger) : [];
  return k.length ? { killed: k } : {};
}

/* (fix round 9, G126a; R102) What an answer says of work it owed: the kind, the pages left, and whether the registrar holds it (`registered`), with its
   reason when it refused or none was handed in, never swallowed. */
function owedAnswer(entry, a) {
  const ok = !!(a && a.ok === true);
  return { kind: entry.kind, ...(Number.isInteger(entry.pages_left) ? { pages_left: entry.pages_left } : {}), registered: ok,
           ...(ok ? { existed: a.existed === true } : { reason: a && typeof a.reason === "string" ? a.reason : "REGISTRAR_REFUSED" }) };
}

/* R34, R71: why a composed re-read or transcription was not recorded. Two different facts, never answered alike: the
   capture left the caller's sight before the write, or the write ran and was rolled back whole (a listener refused it,
   R24), so nothing of it was kept. Nothing for a written one. */
function unwrittenWhy(w, act) {
  if (w.ok === true) return {};
  /* (fix round 9, R103) stand-in until T52 (K4269); the row owed: `extraction.why.basis_changed` */
  if (w.changed === true) return { why: localize("extraction.why.basis_changed", "the stored reading changed while this {act} was being made, so it was not written over; it can be asked again", { act }) };
  return w.rolledBack === true
    ? { why: say("extraction.why.record_reading_capture", { act }) }
    : { why: say("extraction.why.record_reading_capture_written") };
}

/* R71 (T44; N869, N876; DEC-191 (4), (5), DEC-192 (1), (2); K2689, K2713): the transcriber's reasons that posted
   nothing to agent-worker (plane R36), each with its `transcribe.why.*` key. */
const NOT_SENT_WHY = Object.freeze({ AGENT_WORKER_UNBOUND: "transcribe.why.unbound",
  EVIDENCE_ABSENT: "transcribe.why.evidenceabsent", NO_PAGE_RENDERED: "transcribe.why.norender" });
/* agent-worker R74's ending (R59's, spelled `MODEL_SILENT` or `MODEL_REFUSED` with `ending`): every page ended silent
   or refused at the provider. */
const ENDINGS = Object.freeze(["silent", "refused"]);
const ENDING_CODES = Object.freeze(["MODEL_SILENT", "MODEL_REFUSED"]);

/* R71 (T44): a photographed page's renderer refusal (plane R36's `refused`, `{page, reason, process?}`) that has its own
   words: one too large, or a JPEG in a progressive process. Null for any other, which is `transcribe.why.norender`. */
function pictureWhy(refused) {
  for (const r of Array.isArray(refused) ? refused : []) {
    if (!r || typeof r !== "object") continue;
    if (r.reason === "IMAGE_TOO_LARGE") return "transcribe.picture.why.toolarge";
    if (r.reason === "UNSUPPORTED_JPEG_PROCESS" && typeof r.process === "string" && r.process.includes("progressive"))
      return "transcribe.picture.why.progressive";
  }
  return null;
}

/* R71 (T44): what the AI path answered when it was called and nothing was filled, read from the transcriber's own
   answer (`tier4Extend` keeps only a sentence of it): `{key, why}` for a sentence with a `{why}` key, `{none: true}`
   for a post agent-worker answered `ok: true` filling nothing, `{refusal}` for a refusal agent-worker answered after
   the post with its row's translation, or with no row one of R72's six codes (R75, its DEC-193 reason), or null when no
   key says it (the transcriber threw, or another refusal with no row to translate it, which is reported, never given a
   sentence of this module's own). `fmt` is R73's detected format. */
function unfilledOutcome(a, fmt) {
  if (!a || typeof a !== "object") return null;
  if (a.ok === true) return { none: true };
  if (NOT_SENT_WHY[a.reason]) {
    const picture = a.reason === "NO_PAGE_RENDERED" && PICTURE_FORMATS.includes(fmt) ? pictureWhy(a.refused) : null;
    return picture ? { key: "transcribe.picture.unprepared", why: picture } : { key: "transcribe.notsent", why: NOT_SENT_WHY[a.reason] };
  }
  if (a.reason === "AGENT_WORKER_SILENT") return { key: "transcribe.failed", why: "transcribe.why.silent" };
  if (ENDINGS.includes(a.ending) || ENDING_CODES.includes(a.code) || ENDING_CODES.includes(a.reason))
    return { key: "transcribe.failed", why: "transcribe.why.ended" };
  if (typeof a.translation === "string" && a.translation) return { refusal: a };
  /* R75 (T46; N886; DEC-193): one of agent-worker R72's six codes, which carry no row, is that refusal with DEC-193's
     reason as its translation, read by key; its code and status as answered, no check of this module's own. */
  const code = typeof a.code === "string" && a.code ? a.code : a.reason;
  if (Object.prototype.hasOwnProperty.call(AGENT_WORKER_REASONS, code))
    return { refusal: { ...a, code, translation: fillWords(AGENT_WORKER_REASONS[code]) } };
  return null;
}

/* R71 (T44; DEC-192 (1)): a refusal as relayed, with `says` `transcribe.refused`, `{reason}` its translation exactly as
   relayed (its own placeholders left for the screen, its fields beside it); one with no translation says nothing. */
function withRefusedSays(r) {
  const t = r && typeof r.translation === "string" && r.translation ? r.translation : null;
  return t ? { ...r, says: fillWords("transcribe.refused", { reason: t }) } : r;
}

/* R27, R71 (T44; N853b, N869): the formats a photographed page is captured in (`format-registry` R29–R30). */
const PICTURE_FORMATS = Object.freeze(["jpeg", "png"]);

/* R71 (N853a): the status a relayed account or limit refusal carries: its own when it states one, else 403, as the
   keep-away refusal is relayed. */
const refusalStatus = (r) => (Number.isInteger(r.status) && r.status >= 400 && r.status < 500 ? r.status : 403);

/* R74 (T46; N897 (2); K2872): the label the plane hands in when the part `transcribe` runs on the test-instance
   exception (run-rules' `untestedLabel`, reached only as data through R72's registration), exactly as handed; null when
   the act carries none. */
function untestedOf(tx) {
  const u = tx && typeof tx === "object" ? tx.untested : null;
  return u && typeof u === "object" && !Array.isArray(u) ? u : null;
}

/* R74: the label a composed reading carries: the stored reading's unchanged when it holds one, so no later bar removes
   it; else this act's own; else none, absent and never null (R45). */
function keepUntested(reading, stored, untested) {
  const kept = untestedOf(stored);
  if (kept) reading.untested = kept;
  else if (untested) reading.untested = untested;
}

/* R72: a transcriber is `{deployable(), keptAway({project, use}), transcription({member, project, at, trace?, memberRef?})}`. */
const isTranscriber = (t) => !!t && typeof t === "object" && typeof t.deployable === "function"
  && typeof t.keptAway === "function" && typeof t.transcription === "function";

/* The Durable Object routes this module answers, as entries of the plane's one route map (plane R5: `routes` spreads
   them in, and control-plane's `dispatch` answers every store request over it). `url` carries the control plane's
   stamps; `body` the parsed body. */
export function extractionOps(x, url, body, env) {
  const q = (k) => url.searchParams.get(k);
  return {
    reading: () => x.readingFor(q("sha256"), q("viewer"), { after: q("after") !== null && /^(0|[1-9][0-9]*)$/.test(q("after")) ? Number(q("after")) : null }),
    readingref: () => x.documentsByReference(q("ref"), q("viewer"), q("limit")),
    textprovenance: () => x.transcribedDocuments({
      terminalStep: q("step"), transcribed: q("transcribed") == null ? null : q("transcribed") === "1",
      limit: q("limit"), viewer: q("viewer") }),
    readingtermsclear: () => x.readingTermsClear(body || {}),
    readinghistoryclear: () => x.readingHistoryClear(body || {}),
    reindexnames: () => x.reindexNames(body || {}),
    /* R39: a read; the viewer is the control plane's stamp (its rows name the bundles a capture is filed in). */
    calibrationdrift: () => x.calibrationDrift({ engine: q("engine"), viewer: q("viewer") }),
    /* R1 (K72 (8)): the acquire op's reading, over the document capture filed. */
    extractread: () => x.read(body && body.document, { storeName: q("store") || "bio", env }),
    /* R31–R35: the control plane's stamps in the query. */
    pdfstructure: () => x.pdfStructure({ sha: q("sha256"), ocr: url.searchParams.has("ocr") ? q("ocr") : null,
      cls: q("cls"), session: q("session") === "1", caps: (q("caps") || "").split(",").filter(Boolean),
      viewer: q("viewer"), author: q("author"), storeName: q("store") || "bio", env }),
    /* R80 (fix round 4, N5; K4429): the member's act, `sha` in the address or the body; an op that names no viewer is gated
       as a viewer who may see nothing, never as the door's own call. */
    readheld: () => {
      const sha = q("sha") ?? (body && body.sha);
      if (typeof sha !== "string" || !sha) return noSha(localize("extraction.index.readheld_no_sha", "a read of a held document is about one captured document, named by its fingerprint"));
      return x.readHeld({ sha, viewer: q("viewer") ?? "", storeName: q("store") || "bio", env, defer: q("defer") === "1" });
    },
    /* R71: the control plane's stamps in the query; `by` is its author stamp. */
    pagetranscribe: () => x.pageTranscribe({ captureSha: q("sha256"), project: q("project") || null, cls: q("cls"),
      session: q("session") === "1", caps: (q("caps") || "").split(",").filter(Boolean), viewer: q("viewer"),
      by: q("author") || null, trace: q("trace") || null, memberRef: q("memberRef") || null,
      storeName: q("store") || "bio", env }),
  };
}

/* R79 (T51; K4168; op-declarations R80, op-grades R49): the ops this module serves that the screens send, declared by their owner beside
   the ops map: each row's class, weight and description are the op's existing rows', its fields are what the arm reads. */
export const DECLARED_OPS = Object.freeze({
  pagetranscribe: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "undetermined", description: localize("extraction.declared.pagetranscribe", "reading-directed: keyed by a capture; at a member's act, the AI reads the pages Civicsmith could not, on the account that pays and within its limits; the text is labeled the AI's reading and undetermined; moves no bundle"),
    fields: { accepts: ["sha256","project"], requires: ["sha256"] } },
  /* R76 amended (fix round 6, G13; K4577; K4208): `reading` takes `after`, a unit's `seq`, to page a capture's units. */
  reading: { classes: ["admin","member","probe"], mutating: false, weight: "read", description: localize("extraction.declared.reading", "read: keyed by a capture's digest; its reading, how far a text read in pieces has been read, and its text units a page at a time; writes nothing"),
    fields: { accepts: ["sha256","after"], requires: ["sha256"] } },
  readheld: { classes: ["admin","member"], machineClasses: [], mutating: true, needs: null, weight: "reversible", description: localize("extraction.declared.readheld", "reading-directed: keyed by a capture's digest; at a member's act, Civicsmith reads a document its record holds whole and holds no reading of, or holds a reading of that found nothing for want of the whole; the reading is machine-made and undetermined, the earlier one kept in the history; moves no bundle"),
    fields: { accepts: ["sha","defer"], requires: ["sha"] } },
  pdfstructure: { classes: ["admin","member","probe"], mutating: false, weight: "read", description: "act.pdfstructure.label.document",
    fields: { accepts: ["sha256","ocr"], requires: ["sha256"] } },
  /* F1 (surface-declarations R17, F1; BOB's grade, coordinator ruling 5 Nov): `interpretPart` (R114, R117) and `interpretationWithdraw` (R118)
     under R17's names. Each is reversible (neither asks an authored reason; a mark is taken back by a withdrawal, a withdrawal by a new mark)
     and refused to a machine (R114's MEMBER_SESSION_REQUIRED). No door arm serves either yet; the fields are what the service reads, the
     stamps (`by`, `viewer`) aside. interpretmark's description is the design stream's word; interpretationwithdraw has none. */
  interpretmark: { classes: ["admin","member"], machineClasses: [], mutating: true, needs: null, stamps: ["by","viewer"], weight: "reversible", description: "act.owed_interpretmark.label.document",
    fields: { accepts: ["capture","part","project","how","proposal","began_from"], requires: ["capture","part","project","how"] } },
  interpretationwithdraw: { classes: ["admin","member"], machineClasses: [], mutating: true, needs: null, stamps: ["by","viewer"], weight: "reversible", description: localize("extraction.declared.interpretationwithdraw", "reversible: keyed by an interpretation row; at a member's act, the part is no longer stated as interpreted for that investigation; the row stays in the log and nothing is erased"),
    fields: { accepts: ["id"], requires: ["id"] } },
});
