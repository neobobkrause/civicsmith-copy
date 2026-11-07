/* content — the unit the record points at (requirements: `build/requirements/content.md`). A reference to a part of
 * a captured document, up to and including the whole: the extent grammar (`./extent.mjs`), the content address, the
 * content row minted over it and what it may claim on the transcription axis, a member's typed transcription of a
 * part and a second member's attestation of it, and, for one cited passage, whether a newer capture exists and
 * whether the passage is carried into it (`./notice.mjs`), or how it compares with a capture a caller found at
 * another address (R55), without moving anything. It never moves a reference: the record points where a member
 * pointed (R34).
 *
 * Extracted from the legacy modules (T5-3; K73, K102): `store.mjs` (the content writer REC-82, the reads REC-83,
 * transcription REC-87, the machine mint SK-7, the version notice's per-passage half D-394 / REC-221, and, by K73 (1),
 * the capture's text attestations CPDF-10 and the citation context `contentContextFor` with its readers),
 * `schema.mjs` (the four tables, now `./schema.mjs`) and `bio-checks.mjs` (the extent relation, the mint's
 * undetermined statement; in T19 the grammar's core, copied into `./extent-core.mjs`, R48). The legacy code's comments
 * moved with it, shortened where they only restated the code. Nothing in this module imports the catalogue: the
 * record's grammar is `record-grammar`'s, the extent algebra `text-chain`'s (see `./extent.mjs`).
 *
 * REACHED as `contentOf(host, deps)` (K61): one instance per host (the Durable Object's `ctx`), created on the first
 * call with `deps`, returned to every later caller. At creation it declares its tables explicitly to record-core (R54, R39).
 * `deps`:
 *   record, membership, provenance   the modules it uses, through their factories on the same host unless a test
 *                                    passes its own.
 *   extraction   `extractionOf(host)` unless a test passes its own: `readingOf` (its R30), `unitsOf` (R36),
 *                `capturesReadFor` (R51) and `onReading` (R24), with which this module registers its stale mark.
 *                `noSha` (its R63), the one `NO_SHA` answer, is imported from the module itself, never from `deps`.
 *   now          the module's clock, an ISO instant (default: the wall clock); a mint or act with no `at` reads it.
 * At creation it also registers its stale mark with extraction (R22), its check and mint on provenance's testimony
 * slot (R49) and its figures with record-core (R51). Its route arms are `./ops.mjs`' `contentOps` (R50).
 *
 * Its refusal rows are `./checks.mjs`' (R38): C-52 moved there from the catalogue and C-80.3 copied (T18), C-45 copied
 * with the extent core (T19, R48). */

import { isMachineIdentity } from "../record-grammar/actors.mjs";
import { normalizeType, OBJECT_TYPES } from "../record-grammar/types.mjs";
import { CONTENT_MINTED_BY_PLANE, CONTENT_MINT_STATES, contentMintState } from "../record-grammar/labels.mjs";
import { sha256HexSync } from "../record-grammar/sha256.mjs";
import { canonicalJson } from "../record-grammar/json.mjs";
import { TRANSCRIBE_CHECKS, VERSION_NOTICE_CHECKS } from "./checks.mjs";
import { checkChain, checkAttestation, derivationCap, gradeCeiling, extentCovers, describeChain, a1ToRowCol }
  from "../textchain.mjs";
import { getFormat } from "../formats.mjs";
import { cropImage } from "../../../pdf-worker/src/imagecrop.mjs";
import { recordOf } from "../record-core/index.mjs";
import { membershipOf, viewerPredicate, listenerRefusal, MODULE_ORDER } from "../membership/index.mjs";
import { provenanceOf } from "../provenance/index.mjs";
import { extractionOf, noSha } from "../extraction/index.mjs";
import { CONTENT_SCHEMA, CONTENT_TABLES, migrateContent } from "./schema.mjs";
import {
  CONTENT_EXTENT_CHECKS, CONTENT_EXTENT_KINDS, checkContentExtent, canonicalExtent, describeExtent, contentIdFor,
  contentCitedAs, citationExtent, citationContentId, legContentId, mintUndetermined, pdfPageBoxUndetermined, unitTargetOf,
  unitChainKind,
} from "./extent.mjs";
import { VERSION_NOTICE_ADDRESSES_MAX, VERSION_NOTICE_STATES, VERSION_NOTICE_GRADES, extentBoundUnheld, gradeAcross,
         affectsOf, heldTextAt, typedCellsAt, extentBox, normUnits, searchedOf, splitRun, kindAt } from "./notice.mjs";
import { readRange as acquisitionReadRange } from "../acquisition/index.mjs";
import { word, localize } from "../setup-words/index.mjs";
import { boundOf } from "../read-bounds.mjs";

export * from "./extent.mjs";
export { CONTENT_SCHEMA, CONTENT_TABLES } from "./schema.mjs";
export { VERSION_NOTICE_ADDRESSES_MAX, VERSION_NOTICE_STATES, VERSION_NOTICE_GRADES, VERSION_NOTICE_SIMILAR, typedCellsAt }
  from "./notice.mjs";
export { CONTENT_MINTED_BY_PLANE, CONTENT_MINT_STATES, contentMintState };
export { TRANSCRIBE_CHECKS, VERSION_NOTICE_CHECKS } from "./checks.mjs";
export { contentOps } from "./ops.mjs";

/** The one bound on a typing (R23, C-52.7): the per-unit cap one passage of the text index is stored to
 *  (`CAPTURE_TEXT_UNIT_CAP`, M-20's 131,072 B). Refused over it, never truncated. */
export const TRANSCRIPTION_MAX_BYTES = 128 * 1024;
/** C-52.10 (R25, R43; DEC-88): the longest note an attestation keeps, in characters (code points). */
export const ATTEST_NOTE_MAX = 2000;
/** The attestation reads' page bound (CPDF-10): enough to work with on a screen, far short of a dump. */
export const TEXT_SOURCE_LIMIT_DEFAULT = 200;
export const TEXT_SOURCE_LIMIT_MAX = 5000;
/** R17: `op=content` is FIXED-KEY; these are the only parameters it understands. R18 (D-675): the plane's own
 *  `store` parameter names which Durable Object the call reached and nothing inside it, so it is accepted. */
export const CONTENT_READ_PARAMS = new Set(["id", "viewer", "store"]);
/** R20: how many content rows one `standings` read resolves. */
export const CONTENT_EARNED_MAX = 200;
/** R41 (N117): how many of the rows one re-read stales are read back and graded, in ONE read, inside the writer's
 *  transaction. The rest are marked by the same one UPDATE, counted by the same read, and told as ungraded. */
export const STALE_GRADED_MAX = 200;
/** R57: how many typings one `transcriptions` read lists by default, and at most. */
export const TRANSCRIPTIONS_LIMIT_DEFAULT = 50;
export const TRANSCRIPTIONS_LIMIT_MAX = 200;
/** R46, R60: one page of a capture's units is read at most this many characters of text (extraction R93's page, about 1 MiB), the pages
 *  followed by `next` until the reading's last unit, so a reading of more than 4,096 units is read whole and never from its first page alone. */
export const UNITS_PAGE_CHARS = 1048576;
/** R46, R60: the most unit text one capture's held units are read to (32 MiB of characters, `READ_BOUNDS` content.held_text_chars). Past it the reading is held as
 *  `partial` with `searched` naming how far it was read, never as `whole`, so a document too large to hold in one object is stated and not graded
 *  as if it were all read. */
export const HELD_TEXT_CHARS_MAX = boundOf("content", "held_text_chars");
/** R58: how many pages of units a lookup of a unit's kind scans (one capture, 16 MiB of unit text) before it answers that the reading names none. */
export const KIND_SCAN_PAGES_MAX = boundOf("content", "kind_scan_pages");
/** R59: the bytes a crop reads from a capture at a time through `readRange`. */
const RANGE_BYTES = 8 * 1048576;
/** R51: the figures this module reports for `op=stats` and purge's proof, through record-core's `registerCounts`. */
export const CONTENT_COUNT_KEYS = Object.freeze(["content", "contentStale"]);

const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
/** C-52.10: what is wrong with an attestor's note, or null when it is one: a string with something other than white
 *  space in it, at most `ATTEST_NOTE_MAX` characters. */
const noteFault = (note) =>
  note === undefined || note === null ? word("content.text.carries_note")
  : typeof note !== "string" ? word("content.text.carries_note_text", { note: String(Array.isArray(note) ? "a list" : typeof note) })
  : !note.trim() ? word("content.text.carries_note_2")
  : [...note].length > ATTEST_NOTE_MAX ? word("content.text.carries_note_characters", { note: String([...note].length), attest_note_max: String(ATTEST_NOTE_MAX) })
  : null;
const safeJson = (s) => { try { return s == null ? null : JSON.parse(s); } catch { return null; } };
const ROW_COLS = `content_id, capture_sha, bundle_id, extent_kind, extent, ref, chain, derivation_cap, page_count,
                  minted_by, at, stale, cited_as, register`;

/** R16 — THE MINT LABEL, derived in ONE place and put on every surface that shows a content row (SK-7, Bob's 5.7).
 *  Present on EVERY row, not only machine-minted ones: a key that appears only when the answer is "machine" makes
 *  absence carry the meaning. `machine_work` is the plane's own answer and `says` the published sentence. */
export function mintLabel(mintedBy) {
  const state = contentMintState(mintedBy);
  return { by: mintedBy ?? null, state, machine_work: state === "machine_marked", says: CONTENT_MINT_STATES[state] };
}

/** THE TARGET a content row presents to `text-chain` (R21): `{}` for `document` (a page attestation does not cover
 *  a whole-document row, by `extentCovers`' own rule), the page and rect of a `pdf-page` or an image on a PDF page,
 *  and null for a kind whose coverage this module cannot evaluate, which is never answered with the whole
 *  document's ceiling. */
function contentTarget(kind, extent) {
  if (kind === "document") return {};
  if (kind === "pdf-page" || (kind === "image" && Number.isInteger(extent && extent.page)))
    return { page: Number.isInteger(extent && extent.page) ? extent.page : null,
             rect: Array.isArray(extent && extent.rect) ? extent.rect : null };
  return null;
}

/** THE ATTESTATION EXTENT OF A TRANSCRIPTION: exactly the portion the member typed, in `checkAttestation`'s grammar,
 *  so `extentCovers` answers the question it always answers. Null for a portion no attestation could scope (R23's
 *  C-52.5, refused before a typing of one can exist). */
function transcriptionAttestExtent(kind, extent) {
  const e = isObj(extent) ? extent : {};
  if (kind === "document") return { kind: "document" };
  if ((kind === "pdf-page" || kind === "image") && Number.isInteger(e.page) && e.page >= 0)
    return Array.isArray(e.rect) && e.rect.length === 4
      ? { kind: "region", source: { kind: "pdf-page", ref: `p${e.page}`, page: e.page, rect: e.rect } }
      : { kind: "page", page: e.page };
  return null;
}

/** The wire form of a stored text attestation row, in ONE place. */
function attestationShape(a) {
  return a.extent_kind === "document" ? { kind: "document" }
       : a.extent_kind === "page" ? { kind: "page", page: a.extent_page }
       : { kind: "region", source: { kind: "pdf-page", ref: `p${a.extent_page}`, page: a.extent_page,
                                     rect: safeJson(a.extent_rect) } };
}

/** R21/R25: what a transcription's attestations may raise — every attestation by somebody OTHER than the typist,
 *  scoped to the typed portion. Excluded here as well as refused at the act, so a row that somehow held one still
 *  could not rise on one member's word. */
function transcriptionCovering(tx, kind, extent) {
  const scope = transcriptionAttestExtent(kind, extent);
  if (!tx || !scope) return [];
  return tx.attestations.filter((a) => a.attestor !== tx.transcriber)
    .map((a) => ({ member: a.attestor, at: a.at, extent: scope }));
}

const staleSays = (extent) =>
  word("content.text.passage_cited_stood", { extent: String(describeExtent(extent)) });

/** R58 (`extraction` R107): the closed list of the kinds a unit names and the word a member reads for each; `body` is the unmarked one. */
export const PART_KIND_WORDS = Object.freeze({
  body: localize("content.part_kind.body", "body"),
  footnote: localize("content.part_kind.footnote", "footnote"),
  endnote: localize("content.part_kind.endnote", "endnote"),
  header: localize("content.part_kind.header", "header"),
  footer: localize("content.part_kind.footer", "footer"),
  comment: localize("content.part_kind.comment", "comment"),
  tracked_deletion: localize("content.part_kind.tracked_deletion", "tracked deletion"),
  text_box: localize("content.part_kind.text_box", "text box"),
  speaker_note: localize("content.part_kind.speaker_note", "speaker note"),
  master_text: localize("content.part_kind.master_text", "master text"),
  cell_note: localize("content.part_kind.cell_note", "cell note"),
});
/** R58: a row's human form with its part's kind beside the extent, for a kind other than `body`. */
/** A1 column letters of a 1-based column number (1 → A, 27 → AA). */
const a1Column = (n) => { let out = ""; for (let c = n; c > 0; c = Math.floor((c - 1) / 26)) out = String.fromCharCode(65 + ((c - 1) % 26)) + out; return out; };
const refWithKind = (ref, kind) => (kind && kind !== "body" && PART_KIND_WORDS[kind]
  ? localize("content.ref.with_part_kind", "{ref} ({kind})", { ref: String(ref), kind: String(PART_KIND_WORDS[kind]) }) : ref);

export class Content {
  constructor({ storage, record, membership, provenance, extraction = null, now = null, readRange = null, creditOf = null }) {
    this.storage = storage;
    this.sql = storage.sql;
    this.record = record;
    this.membership = membership;
    this.provenance = provenance;
    this.extraction = extraction;
    this.now = typeof now === "function" ? now : () => new Date().toISOString();
    /* R59: `acquisition.readRange` (its R113), handed in as `deps.readRange` (a test's own, or acquisition's): a capture's bytes by its whole digest */
    this.readRange = typeof readRange === "function" ? readRange : acquisitionReadRange;
    /* R64: `creditOf({member, row})` answers a DEC-102 credit level (`group`, `project`, `cover`, `name`); only `name` shows her name,
       and with no resolver or no level she is not named (the plane wires it, layer 11, T53-584) */
    this.creditOf = typeof creditOf === "function" ? creditOf : () => null;
    this.staleListeners = [];
    /* R65: the register provider (`holds(sha)`, `rowAt(sha, n)`), registered once by the module that holds register captures */
    this.rowContext = null;
  }

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  #one(q, ...a) { const r = this.#rows(q, ...a); return r.length ? r[0] : null; }

  /** The module's tables (R39), with the migrations an earlier store's shape needs. */
  migrate() { migrateContent(this.sql); }

  /** R37: may `viewer` see bundle `bundleId`? membership's one predicate (its R43) over record-core's `bundles` read
   *  contract (its R37). An absent or unrecognised viewer sees nothing (the predicate's deny arm). */
  sees(bundleId, viewer) {
    const gate = viewerPredicate(viewer);
    if (gate.scope === "DENY") return false;
    return !!this.#one(`SELECT 1 AS x FROM bundles b WHERE b.bundle_id=? AND (${gate.sql})`, bundleId, ...gate.args);
  }

  #redactor(viewer) {
    const gate = viewerPredicate(viewer);
    if (gate.scope === "member") return (id) => id ?? null;
    if (gate.scope === "DENY") return (id) => (id ? null : id ?? null);
    const memo = new Map();
    return (id) => {
      if (!id) return id ?? null;
      if (!memo.has(id)) memo.set(id, this.sees(id, viewer));
      return memo.get(id) ? id : null;
    };
  }

  #typeOf(bundleId) {
    const b = this.record.bundleInfo(bundleId);
    return b ? normalizeType(b.type) : null;
  }

  /* ===================================================================== *
   * THE CAPTURE A CITATION ADDRESSES (R11; D-580, K49).
   * ===================================================================== */

  /** R11: a non-empty `authored` capture held for the bundle wins, and one NOT held answers null — never replaced by a
   *  resolved one, which would mint a row against bytes the member did not name. Otherwise the bundle's FIRST-HELD
   *  capture by `provenance.capturesOf` (this instance's own clock, never a document's stated date), never the newest:
   *  the answer must be stable under later captures, or a resolver would re-point an authored citation at bytes the
   *  member never read (Bob, 2026-09-14, 5.8). A document intaken with a provenance document and no register row has
   *  its captures only on its readings; those are asked only when provenance holds none, in the readings' own order
   *  (never compared with the register's clock, D-580). No capture held answers null, stated by the caller. */
  captureFor(bundleId, authored = null) {
    if (typeof bundleId !== "string" || !bundleId) return null;
    const held = this.provenance.capturesOf(bundleId).map((c) => c.capture_sha);
    const read = () => (this.extraction.capturesReadFor(bundleId) || []).map((c) => (typeof c === "string" ? c : c.capture_sha));
    if (typeof authored === "string" && authored.trim()) {
      const a = authored.trim();
      return held.includes(a) || read().includes(a) ? a : null;
    }
    if (held.length) return held[0];
    const r = read();
    return r.length ? r[0] : null;
  }

  /* ===================================================================== *
   * A CAPTURE'S HELD UNITS (R46, R60; extraction R36, R93, R107).
   * ===================================================================== */

  /** Every unit of a capture, read page by page (extraction's `unitsOf` answers at most a page and `next` when more follows; a reading of more
   *  than 4,096 units is read whole by following it), with the index's own state and counters from the first page. Followed no further than
   *  `HELD_TEXT_CHARS_MAX` characters of text, or while a page makes progress: a reading stopped there is held `partial` (never `whole`) with
   *  `read_through` the units read and `total` the units written, so the answer says how far it was read. Throws what `unitsOf` throws. */
  #rawUnits(captureSha) {
    let page = this.extraction.unitsOf(captureSha, { maxBytes: UNITS_PAGE_CHARS });
    const head = page && typeof page === "object" ? page : { units: [], state: null };
    const units = [];
    let chars = 0, cut = false;
    for (;;) {
      const us = page && Array.isArray(page.units) ? page.units : [];
      for (const u of us) { units.push(u); chars += u && typeof u.text === "string" ? u.text.length : 0; }
      const next = page && Number.isInteger(page.next) ? page.next : null;
      if (next === null) break;
      if (chars > HELD_TEXT_CHARS_MAX) { cut = true; break; }
      page = this.extraction.unitsOf(captureSha, { after: next, maxBytes: UNITS_PAGE_CHARS });
      if (!page || !Array.isArray(page.units) || !page.units.length) { cut = true; break; }
    }
    return { ...head, units,
             ...(cut ? { state: "partial", read_through: units.length,
                         total: Number.isInteger(head.counts && head.counts.written) ? head.counts.written : null } : {}) };
  }

  /** R58: the kind of the unit stored at exactly each of `rows`' extents (`{capture_sha, extent_kind, extent}`, `extent` JSON or object), read through
   *  `unitsOf` page by page until every one is found or `KIND_SCAN_PAGES_MAX` pages are read: a Map keyed `<sha>\u0000<canonical extent>` to the
   *  kind in the closed list, or `null` where the unit names none or none is held there (a reading stored before the kind: undetermined, never `body`).
   *  A document, a PDF page and an image carry no kind and are not looked up. An element carried as chunks is its first chunk's. Never throws. */
  #partKinds(rows, memo = null) {
    const out = new Map();
    const want = new Map();
    for (const r of rows) {
      if (!r || r.extent_kind === "document" || r.extent_kind === "pdf-page" || r.extent_kind === "image") continue;
      const ext = typeof r.extent === "string" ? safeJson(r.extent) : r.extent;
      if (!isObj(ext)) continue;
      const full = { ...ext, kind: r.extent_kind };
      const key = `${r.capture_sha}\u0000${canonicalExtent(full)}`;
      if (memo && memo.has(`kind\u0000${key}`)) { out.set(key, memo.get(`kind\u0000${key}`)); continue; }
      if (!want.has(r.capture_sha)) want.set(r.capture_sha, new Map());
      want.get(r.capture_sha).set(key, splitRun(full));
      out.set(key, null);
    }
    for (const [sha, wanted] of want) {
      try {
        let after = null;
        for (let pages = 0; pages < KIND_SCAN_PAGES_MAX && wanted.size; pages++) {
          const page = this.extraction.unitsOf(sha, after === null ? { maxBytes: UNITS_PAGE_CHARS } : { after, maxBytes: UNITS_PAGE_CHARS });
          for (const u of page && Array.isArray(page.units) ? page.units : []) {
            if (!u || typeof u !== "object") continue;
            const at = splitRun(u.extent);
            const named = typeof u.kind === "string" && PART_KIND_WORDS[u.kind] ? u.kind : null;
            for (const [key, w] of wanted)
              if (w.extent === at.extent && (w.run === null ? at.run === null || at.run === 0 : at.run === w.run)) { out.set(key, named); wanted.delete(key); }
          }
          after = page && Number.isInteger(page.next) ? page.next : null;
          if (after === null) break;
        }
      } catch { /* a reading that cannot be read names no kind */ }
    }
    if (memo) for (const [key, kind] of out) memo.set(`kind\u0000${key}`, kind);
    return out;
  }

  /* ===================================================================== *
   * THE CAPTURE'S CONTEXT (K73 (1); R7, R12, R30): everything the checker needs about a capture, from ONE read of the
   * persisted reading (extraction R30), so the write path and every later caller ask the same question the same way.
   * ===================================================================== */

  contentContextFor(captureSha, { searched: withSearched = true } = {}) {
    /* R65: a register segment is not read; the provider stands in for a reading, chain null */
    if (this.#registerHolds(captureSha))
      return { chain: null, pageCount: null, pageBoxes: null, register: { sha: captureSha },
               container: { sheets: null, paragraphs: null, slides: null, tables: null, images: null, container_name: null,
                            page_images_why: null, held: false, empty_level: null, why: null, office: null } };
    const r = this.extraction.readingOf(captureSha);
    const held = !!r;
    const reading = r ? { text_source: r.chain ?? null, page_count: r.pageCount ?? null,
                          ...(r.containerExtent !== undefined ? { container_extent: r.containerExtent } : {}),
                          text_container: r.textContainer ?? null,
                          page_boxes: r.pageBoxes ?? (isObj(r.reading) ? r.reading.page_boxes ?? null : null) } : null;
    const container = this.#containerExtentFor(captureSha, reading);
    Object.assign(container, containerKindOf(reading, r ? r.captureFormat ?? null : null, held));
    const searched = held && withSearched ? this.#searchedFor(captureSha) : null;
    return { chain: chainOfReading(reading), pageCount: this.#pageSetFor(captureSha, reading),
             pageBoxes: reading ? reading.page_boxes ?? null : null, container, ...(searched ? { searched } : {}) };
  }

  /** R60: `{through, total}` for a capture whose reading is not whole (`searchedOf`), asked of the index's state alone (a page past every unit, so no
   *  text is read), else null. Never throws. */
  #searchedFor(captureSha) {
    try { return searchedOf(normUnits(this.extraction.unitsOf(captureSha, { after: Number.MAX_SAFE_INTEGER }))); } catch { return null; }
  }

  /** THE CAPTURE'S PAGE SET (CAP-9 / D-345): the reading's own page count wins outright where it exists. Where there
   *  is none it answers from what the record actually holds: the pages the chain's scoped steps name, unioned with the
   *  pages any attestation covers (aggregated in SQL, never walked: attestations per capture are unbounded), as the
   *  highest page seen plus one. None is NULL: undetermined and stated, never a refusal (a fence tighter than its rule
   *  would push a member toward citing the whole document, which claims MORE). */
  #pageSetFor(captureSha, reading) {
    const stored = reading && typeof reading === "object" ? reading.page_count : undefined;
    if (Number.isInteger(stored) && stored > 0) return stored;
    let max = -1;
    const chain = chainOfReading(reading);
    for (const step of Array.isArray(chain) ? chain : []) {
      const e = step && typeof step === "object" ? step.extent : null;
      if (!e || e.kind !== "pages" || !Array.isArray(e.pages)) continue;
      for (const p of e.pages) if (Number.isInteger(p) && p > max) max = p;
    }
    const m = this.#one(`SELECT max(extent_page) AS hi FROM text_attestations WHERE capture_sha=? AND extent_page IS NOT NULL`,
                        captureSha);
    if (m && Number.isInteger(m.hi) && m.hi > max) max = m.hi;
    return max < 0 ? null : max + 1;
  }

  /** REC-85 / CAP-12 / FW-19 / D-420 — THE CONTAINER'S OWN EXTENT, as the reading holds it: the sheets, the paragraph
   *  count, the slide list, the table and image lists. The stored figure or nothing: nothing in the record names a
   *  sheet, paragraph or shape except a member's own citation, and deriving a container from what was cited would let
   *  the first citation define the workbook. EVERY ABSENCE IS STATED WITH THE EMPTY LEVEL NAMED, and a level the
   *  container has no notion of is not reported as a gap. An empty `tables` or `images` list is a MEASURED ZERO. */
  #containerExtentFor(captureSha, reading) {
    const held = reading && typeof reading === "object" && reading.container_extent
      && typeof reading.container_extent === "object" ? reading.container_extent : null;
    const sheets = held && Array.isArray(held.sheets) && held.sheets.length ? held.sheets : null;
    const paragraphs = held && Number.isInteger(held.paragraphs) && held.paragraphs > 0 ? held.paragraphs : null;
    const slides = held && Array.isArray(held.slides) && held.slides.length ? held.slides : null;
    const tables = held && Array.isArray(held.tables) ? held.tables : null;
    const images = held && Array.isArray(held.images) ? held.images : null;
    const notion = held && Array.isArray(held.levels) ? held.levels : [];
    const missing = [];
    if (notion.includes("sheets") && !sheets) missing.push(word("content.push.workbook_sheet_list"));
    if (notion.includes("paragraphs") && paragraphs === null) missing.push(word("content.push.paragraph_count"));
    if (notion.includes("slides") && !slides) missing.push(word("content.push.deck_slide_list"));
    if (notion.includes("tables") && !tables) missing.push(word("content.push.document_table_list"));
    if (notion.includes("images") && !images) missing.push(word("content.push.container_image_list"));
    if (held && notion.includes("paragraphs") && !notion.includes("tables"))
      missing.push(localize("content.index.document_table_list_before_wire", "the document's table list (this capture was acquired before the wire carried it — FW-19)"));
    if (held && notion.length && !notion.includes("images"))
      missing.push(localize("content.index.container_image_list_before_wire", "the container's image list (this capture was acquired before the wire carried it — FW-19)"));
    if (sheets && !sheets.some((s) => Number.isInteger(s && s.rows) || Number.isInteger(s && s.cols)))
      missing.push(localize("content.index.every_sheet_row_column_extent", "every sheet's row and column extent (this capture was acquired before the wire read that figure, or its format fixes no grid — OpenDocument sets no maximum table size, so a .ods workbook states a NULL bound rather than borrowing one — D-359), so an unknown SHEET is bounded and a cell within a known sheet is not"));
    if (slides && !slides.some((s) => Number.isInteger(s && s.shapes)))
      missing.push(localize("content.index.every_slide_shape_count", "every slide's shape count (this capture was acquired before the wire read that figure, no slide's part in it could be read, or the deck was over the text size bound and only its length was read — D-359, COFF-13), so a slide past the deck is bounded and a shape within a known slide is not"));
    if (!held) missing.push(localize("content.index.container_own_extent_absent", "the container's own extent — no sheet list, paragraph count or slide list was persisted for this capture, and, if it is a PDF, no list of the images its pages paint (a PDF acquired before D-420 carries none)"));
    const containerName = held && typeof held.container === "string" ? held.container : null;
    const pdfImages = containerName === "pdf" && images ? images : null;
    const short = `${String(captureSha).slice(0, 12)}…`;
    const pageImagesWhy = pdfImages ? null
      : containerName === "pdf"
        ? word("content.text.record_holds_list", { short: String(short), recorded: String(held && typeof held.images_why === "string" ? held.images_why.slice(0, 120) : "no reason recorded") })
        : held
          ? localize("content.index.capture_short_is_itemised_as", "capture {short} is itemised as a {v1} and not as a PDF, so this record holds no list of images painted on its pages and whether an image is painted at this address is UNDETERMINED and stated, not refused", { short: String(short), v1: String(containerName || "container") })
          : localize("content.index.this_record_holds_no_list", "this record holds no list of the images the pages of capture {short} paint — a PDF acquired before D-420 persisted none, and nothing was persisted at all for a capture no format entry itemised — so whether an image is painted at this address is UNDETERMINED and stated, not refused. Re-acquiring the document records the list", { short: String(short) });
    return {
      sheets, paragraphs, slides, tables, images,
      container_name: containerName, page_images_why: pageImagesWhy,
      held: !!(sheets || paragraphs !== null || slides || tables || images),
      empty_level: missing.length ? missing.join("; ") : null,
      why: missing.length
        ? word("content.why.record_hold_capture", { missing: String(missing.join("; ")), short: String(short) })
        : localize("content.index.container_extent_format_entry", "the record holds this capture's container extent as the format entry itemised it at acquire (CAP-12), so an address outside it is refused by name and one inside it mints"),
    };
  }

  /* ===================================================================== *
   * THE CAPTURE'S TEXT ATTESTATIONS (CPDF-10; K73 (1)). A member's testimony that a document's text matches the image
   * of the page over a stated extent. Its refusals are `text-chain.checkAttestation`'s (C-35.10, C-35.11), `NO_READING`,
   * then the attestor's note (C-52.10, R43; DEC-88), all before anything is written. The chain is SNAPSHOTTED: an attestation is testimony about text AS IT STOOD, so a later re-read makes it `stale`, never
   * deleted — a member's testimony is not ours to remove.
   * ===================================================================== */

  attestText(pkg = {}) {
    const sha = typeof pkg.captureSha === "string" ? pkg.captureSha : "";
    const att = { member: pkg.member, at: pkg.at || this.now(), extent: pkg.extent };
    const bad = checkAttestation(att);
    if (bad) return bad;
    const r = sha ? this.extraction.readingOf(sha) : null;
    const bundleId = r ? this.#readingBundle(sha) : null;
    if (!r)
      return { ok: false, reason: "NO_READING",
               detail: localize("content.index.nothing_in_this_store_has", "nothing in this store has been read at that capture hash, so there is no text to attest to. Attesting is about what a document SAYS, and this record does not yet hold what this one says") };
    /* The viewer is the control plane's stamp and it is asked (K134): a capture filed in a bundle the viewer may not
       see answers exactly as one never read; an absent stamp sees nothing. */
    if (!bundleId || !this.sees(bundleId, pkg.viewer))
      return { ok: false, reason: "NO_READING",
               detail: localize("content.index.nothing_in_this_store_has_2", "nothing in this store has been read at that capture hash, so there is no text to attest to. Attesting is about what a document SAYS, and this record does not yet hold what this one says") };
    /* DEC-49 REGION is-text-attest */
    const fault = noteFault(pkg.note);
    if (fault)
      return this.#transcribeRefusal("ATTEST_NO_NOTE",
        localize("content.index.this_attestation_fault_the_note", "this attestation {fault}. The note is the attestor's own words on what they compared — the page or passage read, and against what — and it is kept with the attestation, so a later reader can weigh it", { fault: String(fault) }),
        { capture_sha: sha, max_chars: ATTEST_NOTE_MAX });
    /* END DEC-49 REGION is-text-attest */
    const chain = r.chain ?? null;
    const e = att.extent;
    const page = e.kind === "page" ? e.page : (e.kind === "region" ? e.source.page : null);
    const rect = e.kind === "region" ? JSON.stringify(e.source.rect) : null;
    return this.record.transact(() => {
      /* ONE PER (capture, attestor, extent), A REPEAT REPLACING IT (R43). The table's key holds the page and rect, which
         are NULL for a document or page extent, and SQLite keys every NULL apart, so `INSERT OR REPLACE` alone would
         keep both: the held one is removed first, matched with `IS`. */
      this.sql.exec(
        `DELETE FROM text_attestations
          WHERE capture_sha=? AND attestor=? AND extent_kind=? AND extent_page IS ? AND extent_rect IS ?`,
        sha, att.member, e.kind, page, rect);
      this.sql.exec(
        `INSERT INTO text_attestations
           (capture_sha,bundle_id,attestor,at,extent_kind,extent_page,extent_rect,note,chain)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        sha, bundleId, att.member, att.at, e.kind, page, rect,
        pkg.note,
        chain == null ? null : JSON.stringify(chain));
      return { ok: true, capture_sha: sha, attestor: att.member, at: att.at, extent: e,
               chain_at_attestation: chain,
               why: word("content.why.checked_text_against", { member: String(att.member), page: String(e.kind === "document"
                       ? word("content.why.whole_document") : e.kind === "page" ? `page ${e.page}` : localize("content.index.a_region_of_page", "a region of page {page}", { page: String(e.source.page) })) }) };
    });
  }

  /** The bundle a capture is filed in: its register home (provenance R48's read contract), else the reading's. */
  #readingBundle(captureSha) {
    const reg = this.#one(`SELECT bundle_id FROM register WHERE capture_sha=?`, captureSha);
    if (reg) return reg.bundle_id;
    const has = this.#one(`SELECT name FROM sqlite_master WHERE type='table' AND name='readings'`);
    const rd = has ? this.#one(`SELECT bundle_id FROM readings WHERE capture_sha=?`, captureSha) : null;
    return rd ? rd.bundle_id : null;
  }

  /** Every attestation over a capture, bounded (a diligent group can produce hundreds over one scanned book), plus
   *  what they mean for a target region (`gradeCeiling`). A null chain on either side is not staleness. No digest is
   *  extraction's one `NO_SHA` answer (its R63; N285, K275): the code is minted there, never here. */
  attestationsFor(captureSha, target = null, viewer = null, limit = null) {
    if (typeof captureSha !== "string" || !captureSha) return noSha("attestations are read by a capture sha256");
    const r = this.extraction.readingOf(captureSha);
    const chain = r ? r.chain ?? null : null;
    const live = chain == null ? null : JSON.stringify(chain);
    const keep = this.#redactor(viewer);
    const cap = Math.max(1, Math.min(Math.floor(Number(limit) || TEXT_SOURCE_LIMIT_DEFAULT), TEXT_SOURCE_LIMIT_MAX));
    const page = this.#rows(
      `SELECT capture_sha, bundle_id, attestor, at, extent_kind, extent_page, extent_rect, note, chain
         FROM text_attestations WHERE capture_sha=? ORDER BY at, attestor LIMIT ?`, captureSha, cap + 1);
    const attestations = page.slice(0, cap).map((a) => ({
      bundle_id: keep(a.bundle_id), attestor: a.attestor, at: a.at, extent: attestationShape(a), note: a.note,
      stale: (a.chain != null && live != null && a.chain !== live),
      chain_at_attestation: safeJson(a.chain),
    }));
    const ceiling = gradeCeiling(chain, target,
      attestations.filter((a) => !a.stale).map((a) => ({ member: a.attestor, at: a.at, extent: a.extent })));
    return { ok: true, capture_sha: captureSha, count: attestations.length, limit: cap, truncated: page.length > cap,
             chain, chain_says: describeChain(chain), attestations, ceiling };
  }

  /* ===================================================================== *
   * MINT OR FIND (R12–R14; REC-82 / IC-83 / DEC-23 / D-164). Every write is `INSERT OR IGNORE`: an edge depends on
   * the row, so a re-promotion finds exactly what it found last time, and two members citing one passage land on ONE
   * row, whose `minted_by` and `at` record who FIRST cited it and when.
   * ===================================================================== */

  mint({ bundleId, captureSha, extent, mintedBy = CONTENT_MINTED_BY_PLANE, at = null, context = null, ctx = null }) {
    const c = context || ctx || this.contentContextFor(captureSha, { searched: false });
    const bad = this.#checkExtent(extent, c);
    if (bad) return bad;
    /* R65–R67: a `sheet-range` over a register capture is a register row: the human form by key, the reduction remembered */
    const register = c.register && isObj(extent) && extent.kind === "sheet-range" ? this.#registerOf(captureSha, extent) : null;
    /* FW-19 / IC-125: a `bytes` row has no chain and no cap, both written NULL with `cited_as` saying why; the chain
       is also left out of its address, so a re-read never moves it and never stales it. */
    const citedAs = contentCitedAs(extent);
    const chain = citedAs === "bytes" ? null : c.chain;
    const id = contentIdFor(captureSha, extent, chain);
    const before = this.#one(`SELECT content_id FROM content WHERE content_id=?`, id);
    if (!before) {
      const target = unitTargetOf(extent);
      this.sql.exec(
        `INSERT OR IGNORE INTO content
           (content_id,capture_sha,bundle_id,extent_kind,extent,ref,chain,derivation_cap,
            page_count,minted_by,at,stale,cited_as,chain_kind,register)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,0,?,?,?)`,
        id, captureSha, bundleId, extent.kind, canonicalExtent(extent),
        register ? localize("content.ref.register_row", "row {n} of {file}", { n: String(extentBox(extent).r0), file: String(extent.sheet) }) : describeExtent(extent),
        chain == null ? null : JSON.stringify(chain),
        /* THE CAP IS ASKED ABOUT THE EXTENT, not about the document (D-252); NULL is undetermined and STATED. */
        citedAs === "bytes" ? null : derivationCap(chain, target),
        c.pageCount ?? null, mintedBy, at || this.now(), citedAs,
        /* R14 (D-686, D-710): how THIS unit was read, asked of the same target as the cap. */
        citedAs === "bytes" ? null : unitChainKind(chain, target),
        register ? canonicalJson(register) : null);
    }
    const undetermined = c.register ? null : mintUndetermined(extent, c);
    return { ok: true, content_id: id, minted: !before, ...(undetermined ? { undetermined } : {}) };
  }

  /** R15 — SK-7 (Bob's 5.7): MARKING A PASSAGE AS CITABLE, as an act a credential performs. It writes no edge and
   *  grants nothing about the text (attesting stays C-35.10's). `mintedBy` is the control plane's stamp and an absent
   *  one is refused rather than defaulted. The viewer gate runs BEFORE the object type, so the two refusals cannot be
   *  told apart by a caller guessing ids. The answer comes back through `contentRow`, labelled by the one helper. */
  contentMint({ bundleId, extent, mintedBy, viewer = null, at = null }) {
    if (typeof mintedBy !== "string" || !mintedBy.trim())
      return { ok: false, reason: "NO_MINTER",
               detail: localize("content.index.no_minter_names_who", "a content row records WHO marked the passage as citable, and this call carries nobody. The plane stamps that from the credential that asked, so an empty one means the act arrived by a route that does not attribute it — which is refused rather than filled in") };
    if (typeof bundleId !== "string" || !bundleId.trim())
      return { ok: false, reason: "NO_TARGET", detail: localize("content.index.marking_passage_citable", "marking a passage citable names the document the passage is in") };
    const kind = this.#typeOf(bundleId);
    if (!kind || !this.sees(bundleId, viewer))
      return { ok: false, reason: "NO_SUCH_BUNDLE", target: bundleId,
               detail: localize("content.index.no_document_is_addressed_by", "no document is addressed by {bundleId} in this record", { bundleId: String(bundleId) }) };
    if (kind !== "information")
      return { ok: false, reason: "NOT_A_DOCUMENT", target: bundleId, target_type: kind ?? null,
               detail: localize("content.index.bundleid_is_not_a_document", "{bundleId} is not a document, so it has no part to point at. The content axis ranges over documents (DEC-21): an inquiry rests on things, it is not a thing with pages. This is stated rather than met with a document-extent row invented for it (IC-83 AMENDMENT 2)", { bundleId: String(bundleId) }) };
    const sha = this.captureFor(bundleId);
    if (!sha)
      return { ok: false, reason: "NO_BYTES_HELD", target: bundleId,
               detail: localize("content.index.this_record_holds_no_capture", "this record holds no capture of {bundleId}, so there are no bytes for a content row to address. A content id is hash(capture, extent, chain) and there is no capture to hash. Absence here is a fact about what was captured and never evidence about what the document says", { bundleId: String(bundleId) }) };
    const out = this.record.transact(() => this.mint({ bundleId, captureSha: sha,
      extent: isObj(extent) ? extent : { kind: "document" }, mintedBy: mintedBy.trim(), at }));
    if (!out.ok) return out;
    return { ok: true, minted: out.minted, capture_sha: sha, ...this.contentRow(out.content_id),
             ...(out.undetermined ? { undetermined: out.undetermined } : {}) };
  }

  /* ===================================================================== *
   * CITATIONS (R27, R28), for the modules whose edges cite.
   * ===================================================================== */

  /** THE WHOLE SET OF CITATIONS, RESOLVED ONCE: for each, the capture it is about and that capture's context,
   *  memoised per target and per capture so a basis citing one document for four legs pays for one resolution. */
  citationPlan(citations) {
    const list = Array.isArray(citations) ? citations : [];
    const plan = new Map(), byTarget = new Map(), byCapture = new Map();
    for (let i = 0; i < list.length; i++) {
      const cit = list[i];
      if (!cit || typeof cit.target !== "string") continue;
      const isInfo = normalizeType(OBJECT_TYPES[cit.target.split("-")[0]]) === "information";
      const authored = typeof cit.extent_capture === "string" ? cit.extent_capture : null;
      const key = `${cit.target}\u0000${authored || ""}`;
      if (!byTarget.has(key)) byTarget.set(key, isInfo ? this.captureFor(cit.target, authored) : null);
      const sha = byTarget.get(key);
      if (sha != null && !byCapture.has(sha)) byCapture.set(sha, this.contentContextFor(sha, { searched: false }));
      plan.set(i, { target: cit.target, isInfo, authored, captureSha: sha,
                    ctx: sha == null ? { chain: null, pageCount: null, container: null } : byCapture.get(sha),
                    extent: citationExtent(cit) });
    }
    return plan;
  }

  /** C-45.5 / C-45.6: the row a citation names outright, resolved or refused by name. The capture is deliberately not
   *  compared: a member may name a row minted against an earlier capture of the same document (5.8). */
  #rowFor(contentId, targetId, label) {
    /* DEC-49 REGION is-content-row */
    const id = typeof contentId === "string" ? contentId.trim() : "";
    const row = this.#one(`SELECT content_id, bundle_id, extent_kind, ref, stale FROM content WHERE content_id=?`, id);
    if (!row)
      return { ok: false, check: CONTENT_EXTENT_CHECKS.CONTENT_ROW_UNKNOWN.check,
               code: "CONTENT_ROW_UNKNOWN",
               translation: CONTENT_EXTENT_CHECKS.CONTENT_ROW_UNKNOWN.translation,
               detail: localize("content.index.label_names_content_id_id", "{label} names content_id '{id}…', and this record holds no such part. The id is an address taken over the document, the passage and the transcription chain, so nothing can be found for one nothing minted", { label: String(label), id: String(id.slice(0, 16)) }) };
    if (row.bundle_id !== targetId)
      return { ok: false, check: CONTENT_EXTENT_CHECKS.CONTENT_ROW_NOT_THIS_TARGET.check,
               code: "CONTENT_ROW_NOT_THIS_TARGET",
               translation: CONTENT_EXTENT_CHECKS.CONTENT_ROW_NOT_THIS_TARGET.translation,
               detail: localize("content.index.label_rests_on_targetid_and", "{label} rests on '{targetId}' and names a part of '{bundle_id}' ({ref}): the leg and the part it points at are about two different documents", { label: String(label), targetId: String(targetId), bundle_id: String(row.bundle_id), ref: String(row.ref) }) };
    /* END DEC-49 REGION is-content-row */
    return { ok: true, content_id: row.content_id };
  }

  /** R27: every refusal a set of citations earns, one context per capture per call, never thrown. In the checker's
   *  order: a named row first (a citation naming one has no extent to judge); then the target class; then the
   *  capture; then the extent. `label(i)` names a citation in the finding. */
  citationRefusals(citations, label = (i) => `citation[${i}]`, plan = null) {
    const list = Array.isArray(citations) ? citations : [];
    const p0 = plan || this.citationPlan(list);
    const lab = typeof label === "function" ? label : (i) => `${label}[${i}]`;
    const errs = [];
    for (let i = 0; i < list.length; i++) {
      const cit = list[i];
      if (!cit || typeof cit.target !== "string") continue;
      const p = p0.get(i);
      if (!p) continue;
      const named = legContentId(cit);
      if (!p.isInfo) {
        const e0 = p.extent;
        if (e0.kind !== "document" || named)
          errs.push({ check: CONTENT_EXTENT_CHECKS.CONTENT_EXTENT_UNREADABLE.check, code: "CONTENT_EXTENT_UNREADABLE",
            translation: CONTENT_EXTENT_CHECKS.CONTENT_EXTENT_UNREADABLE.translation,
            detail: localize("content.index.lab_names_v1_on_target", "{lab} names {v1} on '{target}', which is an inquiry rather than a document. An inquiry has no bytes and no pages, so there is no part of it to point at (DEC-21)", { lab: String(lab(i)), v1: String(named ? `content_id '${named.slice(0, 16)}…'` : `extent '${String(e0.kind).slice(0, 40)}'`), target: String(cit.target) }) });
        continue;
      }
      if (named) {
        const got = this.#rowFor(named, cit.target, lab(i));
        if (!got.ok) errs.push({ check: got.check, code: got.code, translation: got.translation, detail: got.detail });
        continue;
      }
      const sha = p.captureSha, ext = p.extent;
      if (!sha) {
        if (ext.kind !== "document")
          errs.push({ check: CONTENT_EXTENT_CHECKS.CONTENT_EXTENT_NO_CHAIN.check, code: "CONTENT_EXTENT_NO_CHAIN",
            translation: CONTENT_EXTENT_CHECKS.CONTENT_EXTENT_NO_CHAIN.translation,
            detail: localize("content.index.lab_cites_describeextent_of_target", "{lab} cites {describeExtent} of '{target}', and this record holds no capture of that document at all{v1}", { lab: String(lab(i)), describeExtent: String(describeExtent(ext)), target: String(cit.target), v1: String(typeof cit.extent_capture === "string" && cit.extent_capture.trim()
                      ? localize("content.index.under_the_capture_the_leg", " under the capture the leg names ({capture}…)", { capture: cit.extent_capture.trim().slice(0, 16) }) : ``) }) });
        continue;
      }
      const bad = this.#checkExtent(ext, p.ctx);
      if (bad) errs.push({ check: bad.check, code: bad.code, translation: bad.translation, detail: `${lab(i)}: ${bad.detail}` });
    }
    return errs;
  }

  /** The retired legacy store's order of the same pass (`#contentLegRefusals(legs, plan, label)`), kept for
   *  `basis-versions`, which calls it so. */
  legRefusals(legs, plan, label) { return this.citationRefusals(legs, label, plan); }

  /** R28: the row a citation resolves to. A named content id is used as it is; otherwise the plane mints R5's extent
   *  over R11's capture. The two legitimate nulls come back as themselves, never collapsed (IC-83 AMENDMENT 2): a
   *  non-document target (`INQUIRY_TARGET`) and no capture held (`NO_BYTES_HELD`), each with its reason. */
  resolveCitation(citation) {
    const cit = isObj(citation) ? citation : {};
    const target = typeof cit.target === "string" ? cit.target : "";
    const named = citationContentId(cit);
    if (named) return { content_id: named, minted: false };
    const isInfo = normalizeType(OBJECT_TYPES[target.split("-")[0]]) === "information";
    if (!isInfo)
      return { content_id: null, null_case: "INQUIRY_TARGET",
               why: localize("content.index.v1_is_an_inquiry_rather", "{v1} is an inquiry rather than a document. An inquiry has no capture and therefore no part to point at — the content axis ranges over documents (DEC-21), and this is undetermined and stated rather than a document-extent row invented for it", { v1: String(target || "this target") }) };
    const sha = this.captureFor(target, typeof cit.extent_capture === "string" ? cit.extent_capture : null);
    if (!sha)
      return { content_id: null, null_case: "NO_BYTES_HELD",
               why: word("content.why.record_holds_capture", { target: String(target) }) };
    const out = this.mint({ bundleId: target, captureSha: sha, extent: citationExtent(cit),
                            mintedBy: CONTENT_MINTED_BY_PLANE, at: cit.at || null });
    if (!out.ok) return { content_id: null, null_case: "REFUSED", why: out.detail || out.code, refusal: out };
    return { content_id: out.content_id, minted: out.minted, ...(out.undetermined ? { undetermined: out.undetermined } : {}) };
  }

  /* ===================================================================== *
   * THE TESTIMONY PATH'S MINT (R49; provenance R28, R52). A member's firsthand observation (`op=testify`) is promoted
   * with its words as the bundle's one capture; this module's share of that promotion runs in provenance's testimony
   * slot, at the place the legacy store's promotion step ran it: the extent check before anything is written, so the
   * mint after it cannot refuse, and the mint inside the same transaction, so an authored bundle never exists without
   * the content row its readers expect.
   * ===================================================================== */

  /** R49, the check: the `document` extent over the path's capture, against the context the mint will see (R7, R42).
   *  A refusal refuses the promotion as it came; nothing is written. */
  testimonyCheck({ captureSha } = {}) {
    return checkContentExtent({ kind: "document" }, this.contentContextFor(captureSha, { searched: false }));
  }

  /** R49, the projection: the row at the `document` extent over the path's capture, under the same (null) chain as the
   *  words' passage index, so a `passage:` hit and a citation address one passage under one id; minted by the path's
   *  author at its recording instant (R12, R13). A refused mint throws, naming its code, so the whole promotion rolls
   *  back rather than leave an authored bundle without its content row. */
  testimonyProject({ bundleId, captureSha, author, recordedAt } = {}) {
    const m = this.mint({ bundleId, captureSha, extent: { kind: "document" }, mintedBy: author, at: recordedAt });
    if (!m.ok) throw new Error(`MK-1: the observation's content row was refused after the extent was checked: ${m.code || m.reason}`);
    return { content_id: m.content_id };
  }

  /* ===================================================================== *
   * ITS FIGURES (R51; record-core R63), for `op=stats` and purge's proof.
   * ===================================================================== */

  /** R51: `content` (every row) and `contentStale` (the rows marked stale), each keyed on `bundle_id`, as the legacy
   *  store's `#counts` took them: with `hid` (`{sql, args}`, the bundles the caller may not see) a row whose bundle is
   *  in it is left out, and a row naming no bundle is counted; with none, every row. Synchronous; writes nothing. */
  counts(hid = null) {
    const hidden = isObj(hid) && typeof hid.sql === "string";
    const args = hidden && Array.isArray(hid.args) ? hid.args : [];
    const n = (where) => {
      const conds = [...(where ? [where] : []), ...(hidden ? [`COALESCE(bundle_id, '') NOT IN ${hid.sql}`] : [])];
      return this.#one(`SELECT count(*) AS c FROM content${conds.length ? ` WHERE ${conds.join(" AND ")}` : ""}`,
                       ...(hidden ? args : [])).c;
    };
    return { content: n(null), contentStale: n("stale=1") };
  }

  /* ===================================================================== *
   * THE ROW AND ITS STANDING (R16, R17–R21).
   * ===================================================================== */

  /** R16: the row behind an id, with its mint label and the one sentence a reader needs about its standing, or null.
   *  What makes "a stale row still resolves, saying so" a behaviour rather than a claim. */
  contentRow(contentId) {
    const r = this.#one(`SELECT ${ROW_COLS} FROM content WHERE content_id=?`, contentId);
    if (!r) return null;
    const ext = { kind: r.extent_kind, ...(safeJson(r.extent) || {}) };
    const { register, ...plain } = r;
    return { ...plain, ...(register ? { register: safeJson(register) } : {}),
             extent: safeJson(r.extent), chain: safeJson(r.chain), stale: !!r.stale, resolves: true,
             mint: mintLabel(r.minted_by),
             says: r.stale ? staleSays(ext) : word("content.says.record_holds", { ext: String(describeExtent(ext)) }) };
  }

  /** Fill in each projected referent's standing, in ONE query over the ids, mutating the rows in place (`inquiry`'s
   *  promote projection, the retired legacy store's until T19: a leg that carried its referent finds a row a machine
   *  may have minted, and the label says so). */
  projectStandings(rows) {
    const ids = [...new Set(rows.map((r) => r.content_id))];
    const by = new Map();
    for (const r of this.#rows(`SELECT content_id, extent_kind, extent, minted_by, stale FROM content
                                  WHERE content_id IN (SELECT value FROM json_each(?))`, JSON.stringify(ids)))
      by.set(r.content_id, r);
    for (const r of rows) {
      const row = by.get(r.content_id);
      if (!row) { r.stale = false; r.says = null; r.mint = null; continue; }
      r.extent_kind = row.extent_kind;
      r.stale = !!row.stale;
      r.minted_by = row.minted_by;
      r.mint = mintLabel(row.minted_by);
      const ext = { kind: row.extent_kind, ...(safeJson(row.extent) || {}) };
      r.says = row.stale ? staleSays(ext) : word("content.says.record_holds", { ext: String(describeExtent(ext)) });
    }
  }

  /** The capture's text attestations over a set of captures, in ONE bounded read; truncation stated. */
  #attestationsOver(captures) {
    const ids = [...new Set((Array.isArray(captures) ? captures : []).filter((c) => typeof c === "string" && c))];
    const by = new Map();
    if (!ids.length) return { by, truncated: false };
    const cap = Math.min(TEXT_SOURCE_LIMIT_DEFAULT * ids.length, TEXT_SOURCE_LIMIT_MAX);
    const page = this.#rows(
      `SELECT capture_sha, attestor, at, extent_kind, extent_page, extent_rect, chain
         FROM text_attestations WHERE capture_sha IN (SELECT value FROM json_each(?))
        ORDER BY capture_sha, at, attestor LIMIT ?`, JSON.stringify(ids), cap + 1);
    for (const a of page.slice(0, cap)) {
      if (!by.has(a.capture_sha)) by.set(a.capture_sha, []);
      by.get(a.capture_sha).push(a);
    }
    return { by, truncated: page.length > cap };
  }

  /** The transcriptions among a set of rows, with their own attestations, in two bounded reads. */
  #transcriptionsOver(contentIds) {
    const ids = [...new Set((Array.isArray(contentIds) ? contentIds : []).filter((c) => typeof c === "string" && c))];
    const by = new Map();
    if (!ids.length) return { by, truncated: false };
    const rows = this.#rows(
      `SELECT content_id, transcriber, at, text_sha256 FROM transcriptions
        WHERE content_id IN (SELECT value FROM json_each(?)) LIMIT ?`, JSON.stringify(ids), ids.length);
    if (!rows.length) return { by, truncated: false };
    for (const r of rows) by.set(r.content_id, { ...r, attestations: [] });
    const cap = Math.min(TEXT_SOURCE_LIMIT_DEFAULT * rows.length, TEXT_SOURCE_LIMIT_MAX);
    const page = this.#rows(
      `SELECT content_id, attestor, at, note FROM transcription_attestations
        WHERE content_id IN (SELECT value FROM json_each(?)) ORDER BY content_id, at, attestor LIMIT ?`,
      JSON.stringify(rows.map((r) => r.content_id)), cap + 1);
    for (const a of page.slice(0, cap)) by.get(a.content_id).attestations.push(a);
    return { by, truncated: page.length > cap };
  }

  /** R64: who typed a typing and who checked it, as the credit level in force allows; `label_key` is
   *  `content.typed.unchecked` or `content.typed.checked`. Only members other than the typist are checkers, in time order. */
  #typedBlock(r, tx) {
    const credited = (member) => {
      const level = this.creditOf({ member, row: r });
      return { name: level === "name" ? member : null, credit: typeof level === "string" && level ? level : null };
    };
    const said = (c) => (c.name ?? localize("content.typed.anonymous_member", "a member of the team"));
    const typist = credited(tx.transcriber);
    const checkers = tx.attestations.filter((a) => a.attestor !== tx.transcriber)
      .map((a) => ({ ...credited(a.attestor), at: a.at }));
    const checked = checkers.length > 0;
    const label = checked
      ? localize("content.typed.checked", "typed by {typist}, checked by {checkers}", { typist: said(typist), checkers: checkers.map(said).join(", ") })
      : localize("content.typed.unchecked", "typed by {typist}, not yet checked", { typist: said(typist) });
    return { typist, at: tx.at, checkers, checked, label_key: checked ? "content.typed.checked" : "content.typed.unchecked", label };
  }

  /** ONE ROW'S STANDING: its ceiling on the transcription axis (R21) and the sentence that says which. The capture's
   *  attestations are judged against the ROW's own chain (an attestation made against a transcription the citation
   *  never saw did not check the text it points at); a TYPING is raised only by attestations of that typing, by
   *  members other than the typist (REC-87). `connectionByBundle`, when a caller hands it, adds the earned read's
   *  connection axis (see `standings`). */
  #standing(r, atts, txs = null, connectionByBundle = null, kinds = null) {
    const extent = { kind: r.extent_kind, ...(safeJson(r.extent) || {}) };
    /* R58: where a caller asked the units' kinds, the part's kind beside the extent (`null`: the unit names none) and in the row's human form */
    const partKind = kinds ? kinds.get(`${r.capture_sha}\u0000${canonicalExtent(extent)}`) ?? null : null;
    const chain = safeJson(r.chain);
    const target = contentTarget(r.extent_kind, extent);
    const tx = txs && txs.by ? txs.by.get(r.content_id) : null;
    const covering = tx ? transcriptionCovering(tx, r.extent_kind, extent)
      : (atts.by.get(r.capture_sha) || [])
        .filter((a) => !(a.chain != null && r.chain != null && a.chain !== r.chain))
        .map((a) => ({ member: a.attestor, at: a.at, extent: attestationShape(a) }));
    const register = r.register ? safeJson(r.register) : null;
    const transcription = register
      ? { ceiling: null, determinant: null, by: [], applies: false,
          why: localize("content.why.register_row_as_filed", "not applicable: bytes as filed") }
      : r.cited_as === "bytes"
      ? { ceiling: null, determinant: null, by: [], applies: false,
          why: word("content.why.row_cites_itself", { extent: String(describeExtent(extent)) }) }
      : target == null
      ? { ceiling: null, determinant: null, by: [],
          why: word("content.why.extent_covers_evaluated", { extent_kind: String(r.extent_kind) }) }
      : gradeCeiling(chain, target, covering);
    const out = {
      content_id: r.content_id, bundle_id: r.bundle_id, capture_sha: r.capture_sha,
      extent_kind: r.extent_kind, extent, ref: kinds ? refWithKind(r.ref, partKind) : r.ref, chain,
      ...(kinds ? { part_kind: partKind } : {}),
      derivation_cap: r.derivation_cap, page_count: r.page_count,
      minted_by: r.minted_by, at: r.at, stale: !!r.stale,
      cited_as: r.cited_as ?? "text",
      mint: mintLabel(r.minted_by),
      transcription,
      ...(register ? { register } : {}),
      ...(tx ? { typed: this.#typedBlock(r, tx) } : {}),
      /* The capture axis is the DOCUMENT's (DEC-4): one value, keyed by bundle, never a per-portion copy (R19, R35). */
      capture: { grain: "document", from: `earned.capture[${r.bundle_id}]`,
        why: localize("content.index.capture_axis_answered_once", "the capture axis is answered once, for the DOCUMENT, and never per portion: there is no per-portion capture grade in this record and inventing one would be a third scale (DEC-4). What that one answer states is the weakest link of how the BYTES arrived and what any machine transcription of this document's text is measured at — so a portion of an OCR'd document is bounded exactly as the document is, under earned.capture") },
      ...(atts.truncated || (tx && txs.truncated) ? { attestations_truncated: true } : {}),
      says: r.stale ? staleSays(extent) : word("content.says.record_holds", { ext: String(describeExtent(extent)) }),
    };
    if (connectionByBundle) out.connection = legacyConnectionAxis(r, extent, connectionByBundle);
    return out;
  }

  /** R20: what each row earns, for at most 200 ids, in a fixed number of set-based reads (the rows, the attestations
   *  over their captures, the typings among them), each without a connection axis. A caller that still owns the
   *  connection axis (`inquiry`'s earned read, the legacy store's earned registry until T19, until `connections` takes
   *  it) hands its per-bundle map as `connectionByBundle` and gets that axis back beside each standing. */
  standings(contentIds, connectionByBundle = null) {
    const ids = [...new Set((Array.isArray(contentIds) ? contentIds : [])
      .filter((c) => typeof c === "string" && c))].slice(0, CONTENT_EARNED_MAX);
    const out = {};
    if (!ids.length) return out;
    const rows = this.#rows(`SELECT ${ROW_COLS} FROM content WHERE content_id IN (SELECT value FROM json_each(?)) LIMIT ?`,
                            JSON.stringify(ids), ids.length);
    if (!rows.length) return out;
    const atts = this.#attestationsOver(rows.map((r) => r.capture_sha));
    const txs = this.#transcriptionsOver(rows.map((r) => r.content_id));
    const kinds = this.#partKinds(rows);
    for (const r of rows) out[r.content_id] = this.#standing(r, atts, txs, connectionByBundle, kinds);
    return out;
  }

  /** R17–R19: THE FIXED-KEY `content` READ. One key, one row, nothing else accepted: every other parameter is
   *  refused BY NAME (declared as the accepted set, never a denylist of predicate spellings). Absent and invisible are
   *  ONE answer: the id is a hash, so an answer that told them apart would confirm a passage exists in a project the
   *  caller was never invited to. */
  contentRead({ id, viewer = null, extras = [] } = {}) {
    const unknown = [...new Set((Array.isArray(extras) ? extras : []).filter((k) => !CONTENT_READ_PARAMS.has(k)))].sort();
    if (unknown.length)
      return { ok: false, reason: "FIXED_KEY_ONLY", rejected: unknown,
               detail: localize("content.index.the_content_read_is_fixed", "the content read is FIXED-KEY: it resolves ONE row by content_id and takes no predicate and no paging (D-222 puts the content-grain query arm in stage C, behind D-225's caps). This call carried {unknown}, which it refuses rather than ignores — a parameter silently dropped is a filter the caller believes was applied", { unknown: String(unknown.join(", ")) }) };
    if (typeof id !== "string" || !id) return { ok: false, reason: "NO_ID", detail: localize("content.index.content_requires_id", "content requires ?id=<content_id>") };
    const r = this.#one(`SELECT ${ROW_COLS} FROM content WHERE content_id=?`, id);
    if (!r || !this.sees(r.bundle_id, viewer))
      return { ok: false, reason: "NO_SUCH_CONTENT", target: id,
               detail: localize("content.index.no_content_row_addressed", "no content row is addressed by this id in this record. A content id is hash(capture, canonical extent, chain) — it is minted when a leg first cites the passage, so an id nothing has cited does not exist yet") };
    const txs = this.#transcriptionsOver([r.content_id]);
    const tx = txs.by.get(r.content_id) || null;
    const atts = tx ? { by: new Map(), truncated: false } : this.#attestationsOver([r.capture_sha]);
    const standing = this.#standing(r, atts, txs, null, this.#partKinds([r]));
    const target = contentTarget(r.extent_kind, standing.extent);
    const txScope = tx ? transcriptionAttestExtent(r.extent_kind, standing.extent) : null;
    const all = tx
      ? tx.attestations.map((a) => ({ attestor: a.attestor, at: a.at, extent: txScope, stale: false }))
      : (atts.by.get(r.capture_sha) || []).map((a) => ({
          attestor: a.attestor, at: a.at, extent: attestationShape(a),
          stale: (a.chain != null && r.chain != null && a.chain !== r.chain) }));
    const covering = target == null ? []
      : all.filter((a) => !a.stale && extentCovers(a.extent, target) && !(tx && a.attestor === tx.transcriber));
    const { capture, ...row } = standing;
    return {
      ok: true, ...row,
      /* THE CONNECTION AXIS IS NAMED AS ABSENT RATHER THAN OMITTED: it is a fact about an inquiry's subject, and this
         read names no inquiry. */
      connection: { determined: false, grain: r.extent_kind === "document" ? "document" : "portion",
        grade: null, undetermined_because: "NO_SUBJECT_IN_THIS_READ",
        empty_level: localize("content.index.connection_empty_level_question", "the question — a connection grade is earned against an inquiry's subject entity, and this read resolves a ROW rather than a LEG"),
        why: localize("content.index.connection_ask_earnedbasis", "ask op=earnedbasis with the inquiry whose leg cites this row: a connection is what the record earns between THIS document and THAT question's subject, and it has no value independent of a question") },
      capture,
      attestations: { covering, all, count: all.length,
        ...(atts.truncated || txs.truncated ? { truncated: true } : {}),
        why: tx
          ? localize("content.index.this_row_is_a_members", "this row is a member's TYPING (op=transcription reads its text). Only an attestation OF THAT TYPING, by a member other than {transcriber} who typed it, raises its ceiling. Attestations of the capture's machine text are about different text and are not listed", { transcriber: String(tx.transcriber) })
          : localize("content.index.attestation_raises_ceiling", "an attestation raises this row's ceiling only if its extent COVERS this row's extent (textchain's extentCovers) AND it was made against the transcription this row was minted under. A page attestation does not cover a whole-document row, and an attestation over another page does not cover this one") },
    };
  }

  /* ===================================================================== *
   * STALE (R22, R41).
   * ===================================================================== */

  /** R65: the one registration by the module that holds register captures: `holds(sha)` says whether a capture is a
   *  register segment, `rowAt(sha, n)` answers `{cells, reduced}` of the reduced file's row `n` (the header is row 1),
   *  or null past the end. Offered once at start, as `onStale`'s rules; a second registration is `LISTENER_DECLARED`,
   *  a provider without both functions `LISTENER_MALFORMED`. */
  registerRowContext(provider) {
    if (!provider || typeof provider.holds !== "function" || typeof provider.rowAt !== "function")
      return { ok: false, reason: "LISTENER_MALFORMED" };
    if (this.rowContext) return { ok: false, reason: "LISTENER_DECLARED" };
    this.rowContext = provider;
    return { ok: true };
  }

  /** R65: whether the provider holds `sha` as a register segment; a provider that throws holds nothing. */
  #registerHolds(sha) {
    if (!this.rowContext || typeof sha !== "string" || !sha) return false;
    try { return this.rowContext.holds(sha) === true; } catch { return false; }
  }

  /** F1 (citation R28, registers R30): whether the provider says any row of the cited cells' box was removed from the
   *  segment `sha`; a provider without `removed`, or one that throws, removes nothing. */
  #registerRemoved(sha, kind, extentJson) {
    const removed = this.rowContext && typeof this.rowContext.removed === "function" ? this.rowContext.removed : null;
    if (!removed || typeof sha !== "string" || !sha) return false;
    const e = safeJson(extentJson);
    const box = extentBox({ ...(isObj(e) ? e : {}), kind });
    if (!box) return false;
    for (let n = Math.min(box.r0, box.r1); n <= Math.max(box.r0, box.r1); n++) {
      let gone = false;
      try { gone = removed.call(this.rowContext, sha, n) === true; } catch { gone = false; }
      if (gone) return true;
    }
    return false;
  }

  #registerRow(sha, n) {
    try { const r = this.rowContext.rowAt(sha, n); return isObj(r) ? r : null; } catch { return null; }
  }

  /** R65: R7's check of a `sheet-range` over a register capture, against the provider's rows in place of a reading
   *  (chain null is no refusal); any other extent, and a capture the provider does not hold, is checked as before. */
  #checkExtent(extent, ctx) {
    if (!(ctx && ctx.register) || !isObj(extent) || extent.kind !== "sheet-range") return checkContentExtent(extent, ctx);
    const box = typeof extent.sheet === "string" && extent.sheet.trim() ? extentBox(extent) : null;
    if (!box) {
      /* a malformed sheet or range: R7's own refusal of its shape, asked as if a chain were held */
      const bad = checkContentExtent(extent, { ...ctx, register: null, chain: [] });
      if (bad) return bad;
      const row = CONTENT_EXTENT_CHECKS.CONTENT_EXTENT_UNREADABLE;
      return { ok: false, check: row.check, code: "CONTENT_EXTENT_UNREADABLE", translation: row.translation,
               detail: localize("content.index.register_range_unreadable", "a register row names its file and a range of cells, and this one names neither as written") };
    }
    if (box.r0 >= 1 && this.#registerRow(ctx.register.sha, box.r1)) return null;
    const row = CONTENT_EXTENT_CHECKS.CONTENT_EXTENT_OUT_OF_RANGE;
    return { ok: false, check: row.check, code: "CONTENT_EXTENT_OUT_OF_RANGE", translation: row.translation,
             detail: localize("content.index.register_row_past_end", "row {row} is past the last row of this register file", { row: String(box.r1) }) };
  }

  /** R67: the reduction a register row points into, from the provider's `reduced` block at the range's first row. */
  #registerOf(sha, extent) {
    const box = extentBox(extent);
    const got = box ? this.#registerRow(sha, box.r0) : null;
    const red = got && isObj(got.reduced) ? got.reduced : {};
    return { segment_sha: red.segment_sha ?? sha, original_sha256: red.original_sha256 ?? null,
             original_covers: red.original_covers ?? null, dropped_columns: red.dropped_columns ?? null,
             src_row: red.src_row ?? null, import: red.import ?? null };
  }

  /** R41: a module that tells members what they cite (inquiry, K31's pattern) registers once; on each re-read that
   *  stales a row whose passage the new text affects or cannot be told, `fn` is called ONCE with the re-read's notice
   *  (`markStale`): the graded rows it must tell, and the count of rows past the bound, ungraded and so undetermined.
   *  N202: a malformed or repeated registration is refused by membership's `listenerRefusal` (its R81), the one site
   *  of LISTENER_MALFORMED and LISTENER_DECLARED; the listeners run in the modules' total order (`MODULE_ORDER`, its
   *  R83; an unknown module last, in the order it registered). */
  onStale(module, fn) {
    const refused = listenerRefusal(this.staleListeners, module, fn);
    if (refused) return refused;
    this.staleListeners.push({ module, fn, seq: this.staleListeners.length });
    const rank = (m) => { const i = MODULE_ORDER.indexOf(m); return i === -1 ? Infinity : i; };
    this.staleListeners.sort((a, b) => (rank(a.module) - rank(b.module)) || (a.seq - b.seq));
    return { ok: true };
  }

  /** R22: RE-EXTRACTION MOVED THE CHAIN — mark, never delete. Every row over the capture whose recorded chain differs
   *  from the new non-null chain becomes `stale`, one way (un-staling would be the record deciding an old citation is
   *  current again); nothing is deleted or moved; a null chain marks nothing (an unrecorded chain is not one that
   *  moved). A member's TYPING is never staled: its chain is `typed(member)` over the BYTES, which cannot change under
   *  a row that names them. Returns the count.
   *  THE BOUND (N117; the store's REC-66 / D-227 shape): this runs inside the writer's transaction (extraction R24), so
   *  a re-read costs ONE read and ONE update however many rows it stales. The read returns at most `STALE_GRADED_MAX`
   *  rows, in content-id order, each carrying the total in the same statement; the UPDATE marks them all.
   *  R41: with a listener registered, each row read is graded old text against new — `unitsBefore`, the capture's units
   *  as they stood, and `unitsAfter`, as the replacing reading wrote them (default: the index as it stands at the call,
   *  which is the new one only when the call follows the write, as extraction's R24 listener does); without the old
   *  units the grade is UNDETERMINED and says so. Every listener is then called ONCE for the re-read, never per row,
   *  with the rows whose grade is affected or undetermined, and the rows past the bound counted as ungraded, which is
   *  undetermined and told as such. */
  markStale(captureSha, chain, { unitsBefore = null, unitsAfter = null } = {}) {
    const live = Array.isArray(chain) ? JSON.stringify(chain) : null;
    if (live == null) return 0;
    const where = `capture_sha=? AND chain IS NOT NULL AND chain<>? AND stale=0
                   AND content_id NOT IN (SELECT content_id FROM transcriptions WHERE capture_sha=?)`;
    const hit = this.#rows(
      `SELECT content_id, capture_sha, bundle_id, extent_kind, extent, ref, cited_as, count(*) OVER () AS n
         FROM content WHERE ${where} ORDER BY content_id LIMIT ?`, captureSha, live, captureSha, STALE_GRADED_MAX);
    const n = hit.length ? hit[0].n : 0;
    if (!n) return 0;
    this.sql.exec(`UPDATE content SET stale=1 WHERE ${where}`, captureSha, live, captureSha);
    if (!this.staleListeners.length) return n;
    const before = normUnits(unitsBefore);
    const after = normUnits(unitsAfter && Array.isArray(unitsAfter.units) ? unitsAfter : this.#rawUnits(captureSha));
    const searched = searchedOf(after);
    const rows = [];
    for (const row of hit) {
      const extent = safeJson(row.extent) ? { kind: row.extent_kind, ...safeJson(row.extent) } : null;
      const g = before.units.length ? gradeAcross(row, extent, before, after)
        : { grade: "UNDETERMINED", affects: "undetermined", reason: "cited_text_not_held",
            why: localize("content.index.cited_text_no_longer_held", "the text this row was cited under is no longer held beside the new reading, so whether the re-read changed the passage cannot be told") };
      if (g.affects === "unaffected") continue;
      rows.push({ content_id: row.content_id, bundle_id: row.bundle_id, capture_sha: row.capture_sha, ref: row.ref,
                  grade: g.grade, affects: g.affects, reason: g.reason, why: g.why,
                  found_at: g.found_at ?? null, similarity: g.similarity ?? null, stale: true,
                  ...(searched ? { searched } : {}) });
    }
    const ungraded = n - hit.length;
    if (!rows.length && !ungraded) return n;
    const notice = {
      capture_sha: captureSha, chain, staled: n, graded: hit.length, rows, ungraded,
      ungraded_after: ungraded ? hit[hit.length - 1].content_id : null,
      ungraded_affects: ungraded ? "undetermined" : null,
      ungraded_why: ungraded
        ? localize("content.index.this_re_read_staled_n", "this re-read staled {n} rows and {STALE_GRADED_MAX} were graded; the other {ungraded} (the capture's stale rows whose content_id sorts after ungraded_after) were marked stale and not graded, so whether the re-read changed their passages is UNDETERMINED", { n: String(n), STALE_GRADED_MAX: String(STALE_GRADED_MAX), ungraded: String(ungraded) })
        : null,
      says: localize("content.index.document_reread_text_under", "the document was re-read and the text under your citation may have changed. Nothing moved: keep the citation as it stands, or adopt the passage under the new reading"),
    };
    for (const l of this.staleListeners) l.fn(notice);
    return n;
  }

  /* ===================================================================== *
   * TRANSCRIBE (R23–R26; REC-87 / IC-127 / IC-128, Bob's 5.2). A member selects a portion of a document and types what
   * it says: AUTHORED text, its cap UNDETERMINED and STATED, raised only by a SECOND member's attestation. The portion
   * is a content row minted through `mint` under the chain `[typed(member)]`; the text lives in `transcriptions`.
   * ===================================================================== */

  #transcribeRefusal(code, detail, extra) {
    const row = TRANSCRIBE_CHECKS[code];
    return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail, ...(extra || {}) };
  }

  transcribe({ bundleId = null, extent = null, text = null, transcriber = null, viewer = null, at = null } = {}) {
    const refusal = (code, detail, extra) => this.#transcribeRefusal(code, detail, extra);
    const who = typeof transcriber === "string" ? transcriber.trim() : "";
    const target = typeof bundleId === "string" ? bundleId.trim() : "";
    /* DEC-49 REGION is-transcribe-act */
    if (!who || isMachineIdentity(who))
      return refusal("TRANSCRIBE_NOT_A_MEMBER",
        who ? localize("content.index.who_is_a_machine_credential", "'{who}' is a machine credential. Typing what a page says is a person's act in their own name; a machine's reading of a page is OCR, a different step kind", { who: String(who.slice(0, 60)) })
            : localize("content.index.transcriber_nobody", "this call carries nobody. The plane stamps the transcriber from the credential that asked, so an empty one means the act arrived by a route that does not attribute it"));
    const kind = target ? this.#typeOf(target) : null;
    const seen = kind ? this.sees(target, viewer) : false;
    if (!kind || !seen || kind !== "information")
      return refusal("TRANSCRIBE_NO_DOCUMENT",
        !target ? localize("content.index.pass_bundleid_info_document", "pass bundleId=<INFO-…>: the document whose page you transcribed")
        : kind && seen ? localize("content.index.target_is_not_a_document", "{target} is not a document, so it has no page to transcribe (DEC-21)", { target: String(target) })
          : localize("content.index.no_document_is_addressed_by_2", "no document is addressed by {target} in this record", { target: String(target.slice(0, 60)) }),
        { target: target || null });
    const sha = this.captureFor(target);
    if (!sha)
      return refusal("TRANSCRIBE_NO_BYTES",
        localize("content.index.this_record_holds_no_capture_2", "this record holds no capture of {target}, so there is no copy to have typed from. Absence here is a fact about what was captured, never about what the document says", { target: String(target) }), { target });
    const bare = extent == null || (isObj(extent) && Object.keys(extent).length === 0);
    if (bare)
      return refusal("TRANSCRIBE_NO_PORTION",
        localize("content.index.no_portion_was_selected", "no portion was selected. A transcription is of a PART the member read — a page or a region of one, or the whole document NAMED as such — and a typing with no stated part would be read as covering all of it"),
        { target });
    /* END DEC-49 REGION is-transcribe-act */
    const typed = typeof text === "string" ? text : "";
    const bytes = new TextEncoder().encode(typed).length;
    const digest = sha256HexSync(typed);
    const chain = [{ step: "typed", member: who, text_sha256: digest }];
    /* THE EXTENT GRAMMAR IS ASKED UNDER THE TYPING'S OWN CHAIN, NOT THE CAPTURE'S: a scanned title no engine could
       read is a capture with no chain, and the member's typing IS the transcription over the portion. */
    const ctx = { ...this.contentContextFor(sha, { searched: false }), chain };
    const bad = checkContentExtent(isObj(extent) ? extent : null, ctx);
    if (bad) return bad;
    const ekind = extent.kind;
    /* DEC-49 REGION is-transcribe-portion */
    if (contentCitedAs(extent) === "bytes" || transcriptionAttestExtent(ekind, extent) == null)
      return refusal("TRANSCRIBE_PORTION_UNREADABLE",
        localize("content.index.describeextent_is_a_part_no", "{describeExtent} is a part no typing can be checked against — a second member's attestation needs a document, a page or a region of a page to scope to, and a transcription nobody could ever attest would stand undetermined for good", { describeExtent: String(describeExtent(extent)) }), { target, extent_kind: ekind ?? null });
    if (!typed.trim())
      return refusal("TRANSCRIBE_NO_TEXT",
        localize("content.index.the_typed_text_is_empty", "the typed text is empty. Nothing is prefilled: the text is what the member read off {describeExtent}, typed by them", { describeExtent: String(describeExtent(extent)) }), { target });
    if (bytes > TRANSCRIPTION_MAX_BYTES)
      return refusal("TRANSCRIBE_TEXT_TOO_LONG",
        localize("content.index.bytes_b_typed_over_the", "{bytes} B typed, over the {TRANSCRIPTION_MAX_BYTES} B one passage is stored to (CAPTURE_TEXT_UNIT_CAP). Refused rather than cut: a typing silently truncated would be text the member did not type, standing in their name", { bytes: String(bytes), TRANSCRIPTION_MAX_BYTES: String(TRANSCRIPTION_MAX_BYTES) }), { target, bytes, limit: TRANSCRIPTION_MAX_BYTES });
    /* END DEC-49 REGION is-transcribe-portion */
    const chainBad = checkChain(chain);
    if (chainBad) return chainBad;
    const when = typeof at === "string" && at.trim() ? at.trim() : this.now();
    const out = this.record.transact(() => {
      const m = this.mint({ bundleId: target, captureSha: sha, extent, mintedBy: who, at: when, context: ctx });
      if (!m.ok) return m;
      this.sql.exec(
        `INSERT OR IGNORE INTO transcriptions (content_id,capture_sha,bundle_id,transcriber,text,text_sha256,at)
         VALUES (?,?,?,?,?,?,?)`, m.content_id, sha, target, who, typed, digest, when);
      return m;
    });
    if (!out.ok) return out;
    const standing = this.#transcriptionStanding(out.content_id);
    return {
      ok: true, minted: out.minted, content_id: out.content_id, bundle_id: target, capture_sha: sha,
      extent_kind: ekind, extent: standing ? standing.extent : extent, ref: describeExtent(extent),
      transcriber: who, text_sha256: digest, bytes, chain, chain_says: describeChain(chain),
      derivation_cap: standing ? standing.derivation_cap : null,
      transcription: standing ? standing.transcription : null,
      typed: standing ? standing.typed : null,
      says: localize("content.index.who_typed_describeextent_graded", "{who} typed {describeExtent}. What a member types is graded as the typist's word until a DIFFERENT member checks it against the page and attests it (op=transcriptionattest), which raises it one step. The typist's own attestation is refused{v1}", { who: String(who), describeExtent: String(describeExtent(extent)), v1: String(out.minted ? `` : localize("content.index.exact_typing_already_recorded", ". This exact typing by {who} was already recorded, and is found rather than written again", { who: String(who) })) }),
    };
  }

  #transcriptionStanding(contentId) {
    const r = this.#one(`SELECT ${ROW_COLS} FROM content WHERE content_id=?`, contentId);
    if (!r) return null;
    return this.#standing(r, { by: new Map(), truncated: false }, this.#transcriptionsOver([contentId]));
  }

  /** The transcription a content id names, or C-52.8. Absent, invisible and not-a-typing are ONE answer. */
  #transcriptionOf(contentId, viewer) {
    const id = typeof contentId === "string" ? contentId.trim() : "";
    /* DEC-49 REGION is-transcription-source */
    const t = id ? this.#one(`SELECT content_id, capture_sha, bundle_id, transcriber, text, text_sha256, at
                                FROM transcriptions WHERE content_id=?`, id) : null;
    if (!t || !this.sees(t.bundle_id, viewer))
      return this.#transcribeRefusal("TRANSCRIPTION_NOT_FOUND",
        id ? localize("content.index.no_transcription_readable_here_is", "no transcription readable here is addressed by content_id '{id}…'", { id: String(id.slice(0, 16)) })
           : localize("content.index.pass_contentid_content_id", "pass contentId=<the content id op=transcribe returned>"), { content_id: id || null });
    /* END DEC-49 REGION is-transcription-source */
    return { ok: true, t };
  }

  /** R25: A SECOND MEMBER ATTESTS A TYPING. `checkAttestation` (C-35.10, C-35.11) unchanged, the scope DERIVED from the
   *  typed portion and never taken from the caller; the typist is refused BY NAME (C-52.9); then the attestor's note,
   *  their words on what they compared (C-52.10; DEC-88), before anything is written. One attestation per (row,
   *  attestor), a repeat replacing it and kept with its note; the typing itself is unchanged. */
  transcriptionAttest({ contentId = null, attestor = null, viewer = null, at = null, note = null } = {}) {
    const src = this.#transcriptionOf(contentId, viewer);
    if (!src.ok) return src;
    const { t } = src;
    const row = this.#one(`SELECT extent_kind, extent FROM content WHERE content_id=?`, t.content_id);
    const scope = row ? transcriptionAttestExtent(row.extent_kind, safeJson(row.extent)) : null;
    const att = { member: attestor, at: typeof at === "string" && at.trim() ? at.trim() : this.now(), extent: scope };
    const bad = checkAttestation(att);
    if (bad) return bad;
    const who = String(attestor).trim();
    /* DEC-49 REGION is-transcription-attest */
    if (who === t.transcriber)
      return this.#transcribeRefusal("TRANSCRIPTION_SELF_ATTEST",
        localize("content.index.who_typed_this_transcription_at", "{who} typed this transcription ({at}). An attestation is a SECOND member checking it against the page; the typist's own is not evidence and would raise the ceiling on one member's word", { who: String(who), at: String(t.at) }),
        { content_id: t.content_id, transcriber: t.transcriber });
    const fault = noteFault(note);
    if (fault)
      return this.#transcribeRefusal("ATTEST_NO_NOTE",
        localize("content.index.this_attestation_of_transcriber_s", "this attestation of {transcriber}'s typing {fault}. The note is the attestor's own words on what they compared — the typed text against which page or region — and it is kept with the attestation", { transcriber: String(t.transcriber), fault: String(fault) }),
        { content_id: t.content_id, max_chars: ATTEST_NOTE_MAX });
    /* END DEC-49 REGION is-transcription-attest */
    const before = this.#transcriptionStanding(t.content_id);
    this.sql.exec(`INSERT OR REPLACE INTO transcription_attestations (content_id,bundle_id,attestor,at,note) VALUES (?,?,?,?,?)`,
      t.content_id, t.bundle_id, who, att.at, note);
    const after = this.#transcriptionStanding(t.content_id);
    return {
      ok: true, content_id: t.content_id, transcriber: t.transcriber, attestor: who, at: att.at, extent: scope,
      ceiling_before: before ? before.transcription : null,
      transcription: after ? after.transcription : null,
      typed: after ? after.typed : null,
      says: word("content.says.checked_typing_against", { who: String(who), transcriber: String(t.transcriber) }),
    };
  }

  /** R26: one typing, its text, who typed it, who has attested it (the typist's own `counts: false`), and what a leg
   *  citing it may claim. */
  transcriptionRead({ id = null, viewer = null } = {}) {
    const src = this.#transcriptionOf(id, viewer);
    if (!src.ok) return src;
    const { t } = src;
    const standing = this.#transcriptionStanding(t.content_id);
    const txs = this.#transcriptionsOver([t.content_id]);
    const tx = txs.by.get(t.content_id);
    return {
      ok: true, content_id: t.content_id, bundle_id: t.bundle_id, capture_sha: t.capture_sha,
      extent_kind: standing ? standing.extent_kind : null, extent: standing ? standing.extent : null,
      ref: standing ? standing.ref : null,
      transcriber: t.transcriber, at: t.at, text: t.text, text_sha256: t.text_sha256,
      chain: standing ? standing.chain : null,
      chain_says: describeChain(standing ? standing.chain : null),
      derivation_cap: standing ? standing.derivation_cap : null,
      transcription: standing ? standing.transcription : null,
      typed: standing ? standing.typed : null,
      attestations: (tx ? tx.attestations : []).map((a) => ({ attestor: a.attestor, at: a.at, note: a.note,
                                                              counts: a.attestor !== t.transcriber })),
      ...(txs.truncated ? { attestations_truncated: true } : {}),
      says: standing && standing.typed ? standing.typed.label : "",
    };
  }

  /** R57: THE TYPINGS OF ONE DOCUMENT, listed (`op=transcriptions`), in content-id order, a page at a time: each portion
   *  typed (its row's extent and `ref`), who typed it, when, the digest of the text (the text itself is
   *  `transcriptionRead`'s) and the attestations of it, each with `counts` false for the typist's own as R26 says. A
   *  document the viewer may not see answers exactly as an absent one (R37); one that is not a document is refused by
   *  name, after sight. `cursor` is the last content id listed when more remain, else null. Writes nothing. */
  transcriptionsOf({ bundleId = null, limit = null, after = null, viewer = null } = {}) {
    const target = typeof bundleId === "string" ? bundleId.trim() : "";
    if (!target)
      return { ok: false, reason: "NO_TARGET",
               detail: localize("content.index.listing_typings_names_document", "listing a document's typings names the document: pass bundleId=<INFO-…>") };
    const kind = this.#typeOf(target);
    if (!kind || !this.sees(target, viewer))
      return { ok: false, reason: "NO_SUCH_BUNDLE", target,
               detail: localize("content.index.no_document_is_addressed_by_3", "no document is addressed by {target} in this record", { target: String(target.slice(0, 60)) }) };
    if (kind !== "information")
      return { ok: false, reason: "NOT_A_DOCUMENT", target, target_type: kind,
               detail: localize("content.index.target_has_no_typings", "{target} is not a document, so nobody has typed any page of it (DEC-21)", { target: String(target.slice(0, 60)) }) };
    const want = Math.floor(Number(limit));
    const cap = want >= 1 ? Math.min(want, TRANSCRIPTIONS_LIMIT_MAX) : TRANSCRIPTIONS_LIMIT_DEFAULT;
    const from = typeof after === "string" ? after : "";
    const page = this.#rows(
      `SELECT t.content_id, t.bundle_id, t.capture_sha, t.transcriber, t.at, t.text_sha256, c.extent_kind, c.extent, c.ref
         FROM transcriptions t JOIN content c ON c.content_id = t.content_id
        WHERE t.bundle_id=? AND t.content_id>? ORDER BY t.content_id LIMIT ?`, target, from, cap + 1);
    const truncated = page.length > cap;
    const rows = page.slice(0, cap);
    const txs = this.#transcriptionsOver(rows.map((r) => r.content_id));
    const held = new Map(this.#rows(`SELECT ${ROW_COLS} FROM content WHERE content_id IN (SELECT value FROM json_each(?))`,
      JSON.stringify(rows.map((r) => r.content_id))).map((c) => [c.content_id, c]));
    const transcriptions = rows.map((r) => {
      const tx = txs.by.get(r.content_id);
      const standing = this.#standing(held.get(r.content_id), { by: new Map(), truncated: false }, txs);
      return { transcription: standing.transcription, typed: standing.typed, content_id: r.content_id, bundle_id: r.bundle_id, capture_sha: r.capture_sha,
               extent_kind: r.extent_kind, extent: safeJson(r.extent), ref: r.ref,
               transcriber: r.transcriber, at: r.at, text_sha256: r.text_sha256,
               attestations: (tx ? tx.attestations : []).map((a) => ({ attestor: a.attestor, at: a.at,
                                                                      counts: a.attestor !== r.transcriber })) };
    });
    return { ok: true, bundle_id: target, transcriptions, count: transcriptions.length, limit: cap, after: from || null,
             truncated, cursor: truncated ? rows[rows.length - 1].content_id : null,
             ...(txs.truncated ? { attestations_truncated: true } : {}) };
  }

  /* ===================================================================== *
   * THE NOTICE FOR ONE CITED PASSAGE (R29–R31; D-394 / REC-221). Writes nothing: §18.1's strongest guarantee that a
   * proposal is never mistaken for a re-pointing is to make it impossible to persist one.
   * ===================================================================== */

  /** R30: the extent test asked of the NEWER capture. `holds` only on a positive test; an existing row at that extent
   *  of the newer capture is FOUND and named, never minted. */
  #extentTestAcross(extent, newerSha) {
    const existing = (e) => this.#one(`SELECT content_id FROM content WHERE capture_sha=? AND extent=? ORDER BY content_id LIMIT 1`,
                                      newerSha, canonicalExtent(e))?.content_id ?? null;
    if (!isObj(extent) || typeof extent.kind !== "string")
      return { holds: false, reason: "extent_unreadable", existing_content_id: null,
               why: word("content.why.cited_passage_extent") };
    if (extent.kind === "document")
      return { holds: true, reason: "whole_document", existing_content_id: existing(extent),
               why: word("content.why.citation_whole_document") };
    const ctx = this.contentContextFor(newerSha, { searched: false });
    const bad = checkContentExtent(extent, ctx);
    const said = bad ? String(bad.detail || bad.code).slice(0, 240) : "";
    if (bad && bad.code === "CONTENT_EXTENT_OUT_OF_RANGE")
      return { holds: false, reason: "outside_newer_capture", existing_content_id: null,
               why: word("content.why.newer_capture_hold", { said: String(said) }) };
    if (bad && bad.code === "CONTENT_EXTENT_NO_CHAIN")
      return { holds: false, reason: "newer_capture_unread", existing_content_id: null,
               why: localize("content.index.nobody_has_read_newer", "nobody has read the newer capture yet, so the record holds no text of it at any extent to test against — that is a fact about this record, not about the document") };
    if (bad)
      return { holds: false, reason: "not_testable", existing_content_id: null,
               why: word("content.why.extent_test_asked", { code: String(bad.code), said: String(said) }) };
    const unheld = extentBoundUnheld(extent, ctx, pdfPageBoxUndetermined);
    if (unheld)
      return { holds: false, reason: "bound_not_held", existing_content_id: null,
               why: word("content.why.extent_exists_tested", { unheld: String(unheld) }) };
    return { holds: true, reason: "extent_in_newer_capture", existing_content_id: existing(extent),
             why: word("content.why.exists_newer_capture", { extent: String(describeExtent(extent)) }) };
  }

  #unitsOf(captureSha, memo) {
    if (!memo.has(captureSha))
      memo.set(captureSha, { ...normUnits(this.#rawUnits(captureSha)), cells: this.#officeOf(captureSha).cells });
    return memo.get(captureSha);
  }

  /** N161: the notice for ONE row a caller has read from `content` through R45's read contract (`{content_id,
   *  capture_sha, bundle_id, extent_kind, extent, ref, cited_as}`, `extent` as stored), for `viewer`'s version chains.
   *  No sight gate and no C-80.3: the caller gates the row (R37). Reevaluation calls it per passage with one `memo` for
   *  its read, because one newer capture is usually asked about by every leg citing it. Writes nothing; never throws:
   *  a row that is not an object, or a read that fails, answers null. */
  noticeForRow(row, viewer, memo = new Map()) {
    if (!isObj(row)) return null;
    try { return this.#noticeForRow(row, viewer, memo instanceof Map ? memo : new Map()); } catch { return null; }
  }

  #noticeForRow(row, viewer, memo) {
    const extent = safeJson(row.extent);
    const cap = VERSION_NOTICE_ADDRESSES_MAX;
    /* The addresses the capture was retrieved from: provenance's `captured_locators` (its R48 read contract). */
    const addrRows = this.#rows(
      `SELECT DISTINCT address_norm FROM captured_locators WHERE capture_sha=? ORDER BY address_norm LIMIT ?`,
      row.capture_sha, cap + 1);
    const addresses = addrRows.slice(0, cap).map((r) => r.address_norm);
    const chains = [];
    const newerBySha = new Map();
    for (const addr of addresses) {
      const at = this.provenance.versionChain({ addressNorm: addr, at: row.capture_sha, limit: 1, viewer });
      if (!at.ok) {
        chains.push({ address_norm: addr, read: false, reason: at.reason,
                      why: word("content.why.capture_version_chain") });
        continue;
      }
      const after = at.total - 1 - at.at_index;
      let newest = null;
      if (after > 0) {
        const last = this.provenance.versionChain({ addressNorm: addr, limit: 1, offset: at.total - 1, viewer });
        newest = last.ok && last.versions[0] ? last.versions[0] : null;
      }
      chains.push({ address_norm: addr, read: true, versions: at.total, position: at.at_index, newer_count: after,
                    newest: newest && { capture_sha: newest.capture_sha, bundle_id: newest.bundle_id,
                                        first_retrieved: newest.first_retrieved } });
      if (newest && !newerBySha.has(newest.capture_sha)) newerBySha.set(newest.capture_sha, newest);
    }
    const read = chains.filter((c) => c.read);
    const allRead = addresses.length > 0 && read.length === addresses.length && addrRows.length <= cap;
    const newer = newerBySha.size > 0 ? true : allRead ? false : null;
    const fullExtent = extent ? { kind: row.extent_kind, ...extent } : null;
    const candidates = [...newerBySha.values()].map((v) => ({
      bundle_id: v.bundle_id, first_retrieved: v.first_retrieved,
      ...this.#candidateAt(row, fullExtent, v.capture_sha, memo,
        localize("content.index.candidate_same_extent_newer", "a CANDIDATE: a passage at the same extent of the newer capture. It is not established to be the same passage; extent-match is a sufficient signal for a candidate and never evidence of identity")) }));
    const state = newer === true
      ? (candidates.length && candidates.every((c) => c.matched) ? "newer_capture_matched" : "newer_capture_undetermined")
      : newer === false ? "no_newer_capture" : "chain_unread";
    const unread = !addresses.length
      ? word("content.text.record_holds_address")
      : addrRows.length > cap
        ? word("content.text.capture_seen_addresses", { cap: String(cap) })
        : word("content.text.least_address_version");
    /* R58: the kind of the passage's own part, read from the unit at exactly the row's extent */
    const own = fullExtent ? kindAt(this.#unitsOf(row.capture_sha, memo), fullExtent) : null;
    const partKind = own && PART_KIND_WORDS[own] ? own : null;
    return {
      content_id: row.content_id, capture_sha: row.capture_sha, bundle_id: row.bundle_id,
      extent_kind: row.extent_kind, ref: refWithKind(row.ref, partKind), part_kind: partKind,
      state, newer, chain_read: newer === false ? true : read.length > 0, affects: affectsOf(state, candidates),
      chains, addresses_asked: addresses.length, addresses_truncated: addrRows.length > cap,
      candidates,
      says: state === "no_newer_capture" ? null : VERSION_NOTICE_STATES[state],
      why: state === "no_newer_capture"
        ? word("content.why.version_chain_capture")
        : state === "chain_unread" ? unread : null,
    };
  }

  /** ONE CANDIDATE (R30, R31), the shape R47's `candidates` and R55's answer share: the extent test asked of capture
   *  `sha` (nothing minted) and the grade read from both captures' units, `memo` carrying them between calls. `held`
   *  is the sentence a candidate whose extent holds says. */
  #candidateAt(row, fullExtent, sha, memo, held) {
    const test = this.#extentTestAcross(fullExtent, sha);
    const older = this.#unitsOf(row.capture_sha, memo), newer = this.#unitsOf(sha, memo);
    const g = gradeAcross(row, fullExtent, older, newer);
    /* R60: a reading not held whole says how far it was searched, the newer capture's first (its text is what the passage is looked for in) */
    const searched = searchedOf(newer) || searchedOf(older);
    return { capture_sha: sha,
             extent: test.holds ? fullExtent : null, matched: test.holds, reason: test.reason, why: test.why,
             existing_content_id: test.existing_content_id,
             grade: g.grade, affects: g.affects, grade_reason: g.reason, grade_why: g.why,
             found_at: g.found_at, similarity: g.similarity, ...(searched ? { searched } : {}),
             candidate_only: true, identity: "not_established",
             says: test.holds ? held : "UNDETERMINED: " + test.why };
  }

  /** R55 (N589, K1624): the passage of a row read through R45's contract (R47's `row`) compared with ONE capture the
   *  caller found itself, held at another address (reevaluation R36), exactly as R30 and R31 compare it with a newer
   *  capture on its own chain: one candidate in R47's shape, or null. It reads no version chain and decides neither
   *  that the capture is newer nor that it holds the same work or portion (the caller does), and asks no sight (the
   *  caller gates the row and the capture, R37). Null for a row that is not an object, a capture that is not 64
   *  lowercase hex or is the row's own (a candidate is never the same passage), or a read that fails. Writes nothing;
   *  never throws. */
  passageAcross(row, captureSha, memo = new Map()) {
    if (!isObj(row) || typeof captureSha !== "string" || !/^[0-9a-f]{64}$/.test(captureSha)
        || captureSha === row.capture_sha) return null;
    try {
      const extent = safeJson(row.extent);
      return this.#candidateAt(row, extent ? { kind: row.extent_kind, ...extent } : null, captureSha,
        memo instanceof Map ? memo : new Map(),
        localize("content.index.candidate_same_extent_compared", "a CANDIDATE: a passage at the same extent of the capture compared, held at another address. It is not established to be the same passage, nor that capture the same work; extent-match is a sufficient signal for a candidate and never evidence of identity"));
    } catch { return null; }
  }

  /** R29–R31: one cited passage against the newer captures of its document, for a viewer. An absent or invisible
   *  passage is C-80.3. The chains are the ones this viewer sees, and the answer says so. */
  passageNotice({ contentId = null, viewer = null } = {}) {
    const cid = String(contentId ?? "").trim();
    const r = cid ? this.#one(`SELECT content_id, capture_sha, bundle_id, extent_kind, extent, ref, cited_as
                                 FROM content WHERE content_id=?`, cid) : null;
    /* DEC-49 REGION is-passage-notice */
    if (!r || !this.sees(r.bundle_id, viewer)) {
      const row = VERSION_NOTICE_CHECKS.VERSION_NOTICE_NO_CONTENT;
      return { ok: false, reason: "VERSION_NOTICE_NO_CONTENT", code: "VERSION_NOTICE_NO_CONTENT", check: row.check,
               translation: row.translation, detail: localize("content.index.no_cited_passage_by_the", "no cited passage by the id '{cid}' is readable here.", { cid: String(cid.slice(0, 80)) }),
               content: cid };
    }
    /* END DEC-49 REGION is-passage-notice */
    return { ok: true, ...this.#noticeForRow(r, viewer, new Map()), states: VERSION_NOTICE_STATES, grades: VERSION_NOTICE_GRADES,
             wrote: false, proposal_only: true,
             visible_to: localize("content.index.version_chains_visible_to", "the version chains here are the ones visible to you; a version filed in a project you were not invited to is not in them") };
  }

  /* ===================================================================== *
   * THE PASSAGE'S TEXT (R46; N215, K249), for a later module that reads what a cited passage says (consequences R2).
   * ===================================================================== */

  /** R46: the text of a held row's passage, or null. A typing (R24) answers its text byte for byte; any other row the
   *  text the capture's index holds at exactly the row's extent, by the one rule R31 grades a cited passage by
   *  (`heldTextAt`). Null for a row not held, one marked stale (R22: the index now holds the newer reading's text at
   *  that extent, which may not be the text cited; N264), one cited as `bytes` (R4), or text not held whole there: a
   *  caller reads null as the passage held in a form not read, never as empty text. No viewer: a caller that shows the
   *  text asks sight first (R37). Writes nothing; never throws. */
  passageText(contentId) {
    const held = this.passageHeld(contentId);
    return held && typeof held.text === "string" ? held.text : null;
  }

  /** R46, R60: `passageText` with what it could not say. `{text}` for a passage held (a typing's text, or the text at its extent; `searched` too where
   *  the reading it is read from is not whole), `{text: null, reason, why}` otherwise (`not_held`, `stale`, `cited_as_bytes`, or `heldTextAt`'s own
   *  reason), and `searched: {through, total}` beside a text read from a reading that is not whole or a null owed to one. Never throws. */
  passageHeld(contentId) {
    const no = (reason, why, more = {}) => ({ text: null, reason, why, ...more });
    try {
      const id = typeof contentId === "string" ? contentId.trim() : "";
      const r = id ? this.#one(`SELECT content_id, capture_sha, extent_kind, extent, cited_as, stale FROM content
                                  WHERE content_id=?`, id) : null;
      if (!r) return no("not_held", localize("content.index.no_content_row_by_that", "this record holds no content row by that id"));
      if (r.stale)
        return no("stale", localize("content.index.passage_cited_under_earlier", "the row was cited under an earlier reading of its document, and the text held now is the newer reading's, which may not be the text cited"));
      if (r.cited_as === "bytes") return no("cited_as_bytes", localize("content.index.image_cited_as_bytes", "the passage is an image cited as its bytes, so it has no text"));
      const typed = this.#one(`SELECT text FROM transcriptions WHERE content_id=?`, r.content_id);
      if (typed) return typeof typed.text === "string" ? { text: typed.text } : no("not_held", localize("content.index.no_content_row_by_that", "this record holds no content row by that id"));
      const e = safeJson(r.extent);
      if (!isObj(e)) return no("extent_unreadable", localize("content.notice.cited_extent_unreadable", "the cited passage's extent could not be read back from its row"));
      const units = normUnits(this.#rawUnits(r.capture_sha));
      const searched = searchedOf(units);
      const held = heldTextAt({ ...e, kind: r.extent_kind }, { ...units, cells: this.#officeOf(r.capture_sha).cells });
      return typeof held.text === "string" ? { text: held.text, ...(searched ? { searched } : {}) }
        : no(held.reason, held.why, searched ? { searched } : {});
    } catch { return no("not_read", localize("content.index.passage_could_not_be_read", "the row's text could not be read")); }
  }

  /* ===================================================================== *
   * WHAT AN OFFICE CAPTURE'S READING STATES ABOUT ITSELF (R52, R53; T33-24, C:A-5, K1448, K1505 (11)). Read, never
   * computed: a cell's value is the file's stored lexical value and a formula's cached value the file's statement
   * (nothing here recalculates); the metadata is what the file says of its own authorship, and this module asserts no
   * act over it.
   * ===================================================================== */

  /** THE ONE READER of the typed cells and the metadata a capture's reading holds (`extraction.readingOf`'s `reading`):
   *  `cells` the per-sheet map `{<sheet name>: cells list | null}` (null when the reading holds none; `null` for a sheet
   *  whose cells are held, not listed), `held` the sheet names the reading says are held, not listed (`cells_held`),
   *  `metadata` the office readers' object (null when none), `read` whether the capture was read at all. Never throws. */
  #officeOf(captureSha) {
    let r = null;
    try { r = typeof captureSha === "string" && captureSha ? this.extraction.readingOf(captureSha) : null; } catch { r = null; }
    const reading = r && isObj(r.reading) ? r.reading : null;
    return { read: !!r, cells: reading && isObj(reading.cells) ? reading.cells : null,
             held: reading && Array.isArray(reading.cells_held) ? reading.cells_held.filter((n) => typeof n === "string") : [],
             metadata: reading && isObj(reading.metadata) ? reading.metadata : null };
  }

  /** R52: the typed cells of a held `sheet-cell` or `sheet-range` row's capture inside its extent, as the reader states
   *  them (`office-readers` R30), in row then column order: `{content_id, capture_sha, extent_kind, extent, cells}`, or
   *  `{cells: null, reason, why}` for a row not held, stale (R22), of another extent kind, or whose reading holds no
   *  typed cells for that sheet. A sheet the reading says it holds without listing (`cells_held`: its text is read whole,
   *  its cells are not all interpreted at intake) has the extent's cells made from the held file by `extraction.cellsOf`
   *  and the answer adds `interpreted: {sheet, from_row, to_row}`, the rows the cells were made for; a range over the
   *  call's bound adds `cells_truncated: true` and `next_row`, never a silently shorter list; a failure to make them is
   *  `reason: "not_read"`. No viewer (R46's terms): a caller that shows them asks sight first (R37). Writes nothing in
   *  the record; never throws. */
  async cellsAt(contentId, opts = null) {
    const fromRow = opts && typeof opts === "object" ? opts.fromRow : null;
    const no = (reason, why) => ({ cells: null, reason, why });
    try {
      const id = typeof contentId === "string" ? contentId.trim() : "";
      const r = id ? this.#one(`SELECT content_id, capture_sha, extent_kind, extent, stale, register FROM content WHERE content_id=?`, id)
        : null;
      if (!r) return no("not_held", localize("content.index.no_content_row_by_that", "this record holds no content row by that id"));
      /* F1 (citation R28, registers R30): a register row an expunge removed is answered removed, never its cells */
      if (r.register && this.#registerRemoved(r.capture_sha, r.extent_kind, r.extent))
        return no("removed", localize("content.index.register_row_removed", "this row was removed from the register, so its cells are no longer shown"));
      if (r.stale)
        return no("stale", localize("content.index.row_cited_under_earlier", "the row was cited under an earlier reading of its document, and the cells held now are the newer reading's, which may not be the cells cited"));
      const e = safeJson(r.extent);
      if (r.extent_kind !== "sheet-cell" && r.extent_kind !== "sheet-range")
        return no("not_a_sheet_extent", localize("content.index.the_row_cites_a_extent", "the row cites a {extent_kind} extent, which names no cells of a sheet", { extent_kind: String(r.extent_kind) }));
      const extent = { ...(isObj(e) ? e : {}), kind: r.extent_kind };
      /* K4922: a window of a range over the call's bound is read call after call, each from the row the last named `next_row`; the row is inside the extent */
      let from = null;
      if (fromRow !== null && fromRow !== undefined) {
        const box = extentBox(extent);
        if (!Number.isInteger(fromRow) || fromRow < 1 || !box || fromRow < box.r0 || fromRow > box.r1)
          return no("from_row_outside_extent", localize("content.index.from_row_outside_extent", "row {fromRow} is not a row of the cited cells, so there is nothing to read from it", { fromRow: String(typeof fromRow === "number" || typeof fromRow === "string" ? String(fromRow).slice(0, 20) : typeof fromRow) }));
        from = fromRow;
      }
      /* R65: a register row's cells are the provider's, the row's kept cells, never a reading's */
      if (r.register && this.#registerHolds(r.capture_sha)) {
        const box = extentBox(extent);
        if (!box) return no("not_read", localize("content.index.row_cells_could_not", "the row's cells could not be read"));
        const cells = [];
        for (let n = Math.max(box.r0, from ?? box.r0); n <= box.r1; n++) {
          const got = this.#registerRow(r.capture_sha, n);
          if (!got) break;
          const kept = Array.isArray(got.cells) ? got.cells : [];
          for (let col = box.c0; col <= box.c1 && col <= kept.length; col++) {
            const cell = kept[col - 1];
            const typed = isObj(cell) ? cell : { value: cell };
            cells.push({ source: { sheet: extent.sheet, cell: `${a1Column(col)}${n}` }, value: typed.value ?? null,
                         type: typed.type ?? (typeof typed.value === "number" ? "number" : "string"),
                         declared: typed.declared ?? null, cached: typed.cached ?? null, formula: typed.formula ?? null });
          }
        }
        return { content_id: r.content_id, capture_sha: r.capture_sha, extent_kind: r.extent_kind, extent: e, cells };
      }
      const office = this.#officeOf(r.capture_sha);
      const sheet = typeof extent.sheet === "string" ? extent.sheet.trim() : "";
      if (office.held.includes(sheet) && !(office.cells && Array.isArray(office.cells[sheet])))
        return await this.#heldCellsAt(r, e, extent, sheet, from);
      const got = typedCellsAt(extent, office.cells);
      if (!got.cells) return no(got.reason, got.why);
      if (from !== null) got.cells = got.cells.filter((c) => (a1ToRowCol(c.source.cell) || { row: 0 }).row >= from);
      return { content_id: r.content_id, capture_sha: r.capture_sha, extent_kind: r.extent_kind, extent: e, cells: got.cells };
    } catch {
      return no("not_read", localize("content.index.row_cells_could_not", "the row's cells could not be read"));
    }
  }

  /** R52's held arm: the extent's rows and columns asked of `extraction.cellsOf` (its ranged read of the held file),
   *  its rows passed through `typedCellsAt` so the column box and reversed corners are honoured exactly as for a listed
   *  sheet. Never throws: a read that fails is `not_read`. */
  async #heldCellsAt(r, e, extent, sheet, from = null) {
    const no = (reason, why) => ({ cells: null, reason, why });
    const notRead = () => no("not_read", localize("content.index.row_cells_could_not", "the row's cells could not be read"));
    const box = extentBox(extent);
    if (!box) { const bad = typedCellsAt(extent, { [sheet]: [] }); return no(bad.reason, bad.why); }
    if (typeof this.extraction.cellsOf !== "function") return notRead();
    let got = null;
    try { got = await this.extraction.cellsOf(r.capture_sha, sheet, { fromRow: from ?? box.r0, toRow: box.r1, fromCol: box.c0, toCol: box.c1 }); }
    catch { return notRead(); }
    if (!got || !Array.isArray(got.cells))
      return got && typeof got.reason === "string" && got.reason !== "bytes_not_held"
        ? no(got.reason, typeof got.why === "string" ? got.why : localize("content.index.row_cells_could_not", "the row's cells could not be read"))
        : notRead();
    const inside = typedCellsAt(extent, { [sheet]: got.cells });
    if (!inside.cells) return no(inside.reason, inside.why);
    const next = Number.isInteger(got.next_row) ? got.next_row : null;
    const rows = isObj(got.interpreted) ? got.interpreted : { sheet, from_row: from ?? box.r0, to_row: next === null ? box.r1 : next - 1 };
    return { content_id: r.content_id, capture_sha: r.capture_sha, extent_kind: r.extent_kind, extent: e, cells: inside.cells,
             interpreted: { sheet: rows.sheet ?? sheet, from_row: rows.from_row, to_row: rows.to_row },
             ...(next === null ? {} : { cells_truncated: true, next_row: next }) };
  }

  /** R53: the metadata an office capture's reading holds (`office-readers` R31), `{capture_sha, metadata: {author,
   *  lastModifiedBy, created, modified, source}}` each as the file writes it, or `{metadata: null, reason, why}` when
   *  the capture was never read, is not an office document, or its reading holds none. What the file states about
   *  itself, read by `events` for an edit act; it is never a fact here. Writes nothing; never throws. */
  officeMetadataOf(captureSha) {
    const no = (reason, why) => ({ metadata: null, reason, why });
    try {
      const sha = typeof captureSha === "string" ? captureSha.trim() : "";
      const held = this.#officeOf(sha);
      if (!held.read) return no("never_read", localize("content.index.no_reading_of_that", "this record holds no reading of that capture"));
      const m = held.metadata;
      if (m) {
        const v = (k) => (m[k] === undefined ? null : m[k]);
        return { capture_sha: sha, metadata: { author: v("author"), lastModifiedBy: v("lastModifiedBy"),
                                               created: v("created"), modified: v("modified"), source: v("source") } };
      }
      const kind = this.contentContextFor(sha, { searched: false }).container;
      if (kind && kind.office === false)
        return no("not_office", localize("content.index.v1_so_it_states_no", "{v1}, so it states no office metadata", { v1: String(kind.kind_why || localize("content.index.capture_not_office_document", "the capture is not an office document")) }));
      return no("none_held", localize("content.index.reading_holds_no_office", "the capture's reading holds no office metadata (its file has no readable core-properties part, or it was read before readings carried it)"));
    } catch {
      return no("not_read", localize("content.index.capture_metadata_could_not", "the capture's metadata could not be read"));
    }
  }

  /* ===================================================================== *
   * THE CROP (R32; D-419, K70).
   * ===================================================================== */

  /** R59: the whole bytes of a capture by its whole digest, read through `readRange` in ranges of `RANGE_BYTES` to the end, or null when the record holds
   *  none (the first range refused) or a range fails. Never throws. */
  async #capturedBytes(captureSha) {
    const store = { core: this.record, provenance: this.provenance };
    const chunks = [];
    let total = 0;
    try {
      for (;;) {
        const got = await this.readRange(store, captureSha, total, RANGE_BYTES);
        if (!(got instanceof Uint8Array)) return null;
        if (got.length) { chunks.push(got); total += got.length; }
        if (got.length < RANGE_BYTES) break;
      }
    } catch { return null; }
    if (!total) return null;
    if (chunks.length === 1) return chunks[0];
    const all = new Uint8Array(total);
    let at = 0;
    for (const c of chunks) { all.set(c, at); at += c.length; }
    return all;
  }

  /** R32: the crop of an image cited by page and rectangle, cut through `pdf-pixels` from the capture's own bytes in
   *  the evidence store, its file as `bytes_base64` (N119), and served as a DERIVED RENDITION that says so
   *  (EXTRACTION-BREADTH §3.4: "the viewer shows the crop; the crop is not the evidence"). Writes nothing. A crop from bytes whose digest is not the row's capture is
   *  refused rather than shown. */
  async cropOf({ contentId = null, viewer = null } = {}) {
    const id = typeof contentId === "string" ? contentId.trim() : "";
    const r = id ? this.#one(`SELECT content_id, capture_sha, bundle_id, extent_kind, extent FROM content WHERE content_id=?`, id)
      : null;
    if (!r || !this.sees(r.bundle_id, viewer))
      return { ok: false, reason: "NO_SUCH_CONTENT", target: id || null,
               detail: localize("content.index.no_content_row_addressed_2", "no content row is addressed by this id in this record") };
    const e = safeJson(r.extent) || {};
    if (r.extent_kind !== "image" || e.part != null || !Number.isInteger(e.page))
      return { ok: false, reason: "CROP_NOT_A_PAGE_IMAGE", content_id: r.content_id, extent_kind: r.extent_kind,
               detail: r.extent_kind !== "image"
                 ? localize("content.index.this_row_cites_a_extent", "this row cites a {extent_kind} extent, and only an image on a PDF page has a crop", { extent_kind: String(r.extent_kind) })
                 : localize("content.index.image_member_of_container", "this row cites an image that is a member of a container (an embedded part), whose bytes are the image itself rather than a rectangle of a page; there is nothing to cut out of it") };
    const store = this.record.evidenceStore();
    if (!store)
      return { ok: false, reason: "CROP_NO_EVIDENCE_STORE", content_id: r.content_id,
               detail: localize("content.index.no_evidence_store_set_up", "your team's Civicsmith has no evidence store set up, so the capture's bytes cannot be read and no crop was made. That is a fact about how your team's Civicsmith is set up, not about the image") };
    /* R59: the capture's bytes by its WHOLE digest through `acquisition.readRange` (its R113), whether it is held whole or in parts: a range at a time
       to the end (a range reaching past it answers the bytes that exist, one at or past it an empty array), never by resolving a part */
    const bytes = await this.#capturedBytes(r.capture_sha);
    if (!bytes)
      return { ok: false, reason: "CROP_CAPTURE_NOT_HELD", content_id: r.content_id, capture_sha: r.capture_sha,
               detail: localize("content.index.evidence_store_holds_no", "the evidence store holds no object under this row's capture, so no crop was made") };
    const out = await cropImage(bytes, { kind: "image", page: e.page, rect: Array.isArray(e.rect) ? e.rect : null });
    if (!out || out.ok !== true)
      return { ok: false, reason: "CROP_NOT_DERIVABLE", content_id: r.content_id, derived: true,
               pdf_pixels_reason: out && typeof out.reason === "string" ? out.reason : null,
               pdf_pixels_why: out && typeof out.why === "string" ? out.why : null,
               detail: localize("content.index.image_could_not_be_cut", "the image this row's extent names could not be cut out of its document; pdf-pixels' own reason is beside this one") };
    if (out.capture_sha256 !== r.capture_sha)
      return { ok: false, reason: "CROP_CAPTURE_MISMATCH", content_id: r.content_id, capture_sha: r.capture_sha,
               cropped_from: out.capture_sha256 ?? null,
               detail: localize("content.index.crop_taken_from_bytes", "the crop was taken from bytes whose sha256 is not the capture this row names, so it is not handed back") };
    /* N119: the wire form is the module's, so every route hands back one encoding: the rendition's file as standard
       base64 (`bytes_base64`, D-419), whose `file_sha256` the answer states. Raw octets would reach JSON as an object
       keyed by index. */
    const { bytes: file, ...rest } = out;
    return { ...rest, bytes_base64: base64Of(file), ok: true, derived: true, content_id: r.content_id,
             capture_sha: r.capture_sha,
             says: localize("content.index.derived_rendition_for_display", "a derived rendition for display: the evidence is the capture's bytes plus the extent, and this crop is not itself evidence") };
  }
}

/* ======================================================================= *
 * PURE HELPERS.
 * ======================================================================= */

/** Standard base64 of a byte array, in chunks (a crop can be megabytes; one spread would overflow the call stack). */
function base64Of(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  let bin = "";
  for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(bin);
}

function chainOfReading(reading) {
  const chain = reading && typeof reading === "object" ? reading.text_source ?? null : null;
  return Array.isArray(chain) ? chain : null;
}

/** D-440 — IS THIS CAPTURE AN OFFICE CONTAINER, whose own bytes can hold an embedded media part? THREE-VALUED: `true`
 *  (the format registry's entry for the capture's format walks parts), `false` (a registered format with no parts
 *  walk), `null` (the record does not hold which format, STATED in `kind_why`). A property of the registry, never a
 *  list of slugs. The format comes from the capture's provenance profile, else the reading's own `text_container`. */
function containerKindOf(reading, captureFormat, held) {
  const fromReading = reading && typeof reading === "object" && typeof reading.text_container === "string"
    && reading.text_container.trim() ? reading.text_container.trim() : null;
  const format = captureFormat || fromReading;
  const source = captureFormat ? word("content.text.capture_provenance_profile") : word("content.text.capture_reading");
  if (format && format !== "undetermined") {
    const entry = getFormat(format);
    if (entry) {
      const office = typeof entry.parts === "function";
      return { format, office,
               kind_why: word("content.kind_why.records_capture_format", { source: String(source), format: String(format), office_clause: String(office ? word("content.kind_why.office_container_bytes") : word("content.kind_why.office_container_bytes_hold")) }) };
    }
    return { format, office: null,
             kind_why: word("content.kind_why.records_capture_format_build", { source: String(source), format: String(format.slice(0, 40)) }) };
  }
  const ext = reading && typeof reading === "object" && reading.container_extent
    && typeof reading.container_extent === "object" ? reading.container_extent : null;
  if (ext && Array.isArray(ext.levels) && ext.levels.length)
    return { format: null, office: true,
             kind_why: localize("content.index.reading_carries_container_extent", "the capture's reading carries a container extent an office entry itemised, so it is an office container, though no format key was recorded") };
  return { format: null, office: null,
           kind_why: !held
             ? word("content.kind_why.record_holds_reading")
             : format === "undetermined"
               ? localize("content.index.format_registry_could_not", "the format registry could not determine this capture's format at acquire, so whether it is a container is UNDETERMINED")
               : localize("content.index.record_does_not_hold_format", "this record does not hold this capture's format (it was promoted before the format was projected, and its reading names no container), so whether it is a container is UNDETERMINED") };
}

/** THE LEGACY CONNECTION AXIS on a standing, for the earned registry that still composes it (`standings`'
 *  `connectionByBundle`), until `connections` takes a portion's connection grade (R20, the Suggestions). A `document`
 *  row earns exactly what the document earns; a portion is undetermined and stated, never borrowed from the document
 *  (Bob, 2026-09-14, 5.1). */
function legacyConnectionAxis(r, extent, connectionByBundle) {
  const doc = connectionByBundle && connectionByBundle[r.bundle_id] ? connectionByBundle[r.bundle_id] : null;
  if (r.extent_kind === "document")
    return doc ? { determined: true, grain: "document", ...doc }
      : { determined: false, grain: "document", grade: null, undetermined_because: "NO_RESOLUTION",
          empty_level: localize("content.index.connection_no_captured_resolution", "connection — no captured resolution of this document to the subject"),
          why: localize("content.index.no_capture_resolves_subject", "no capture of this document resolves to this inquiry's subject at A, B or C, so this row earns nothing on the connection axis. The honest leg is testimony (grade D, with an author and a date) or no grade at all. Absence here is a fact about what the recogniser matched, never evidence about what the document says") };
  return { determined: false, grain: "portion", grade: null, undetermined_because: "READING_POSITION_ABSENT",
           empty_level: localize("content.index.position_within_reading", "position within the reading — reading_refs records THAT a reference was read in this document and not WHERE it was read (I2, FW-17)"),
           why: localize("content.index.this_leg_cites_describeextent_and", "this leg cites {describeExtent} and refers only to that portion (Bob, 2026-09-14). Whether any resolution of this document to the subject was established inside it is undetermined and stated, never borrowed from the whole document. The document-grain answer is under earned.connection for {bundle_id}, and it is the DOCUMENT's, not this portion's", { describeExtent: String(describeExtent(extent)), bundle_id: String(r.bundle_id) }) };
}

const instances = new WeakMap();

/** The one content instance for `host` (the Durable Object's `ctx`, with its `storage`); `deps` are read on the first
 *  call only. At creation it declares its tables explicitly (R54, R39; record-core R21). */
export function contentOf(host, deps) {
  let c = instances.get(host);
  if (!c) {
    const d = deps || {};
    const record = d.record || recordOf(host);
    const membership = d.membership || membershipOf(host, { record });
    const provenance = d.provenance || provenanceOf(host);
    const extraction = d.extraction || extractionOf(host);
    c = new Content({ ...d, storage: d.storage || host.storage, record, membership, provenance, extraction });
    instances.set(host, c);
    declareTables(record);
    /* R22 (REC-82): the stale mark on every replaced reading, registered with extraction (its R24; K31's pattern). */
    /* R41: the capture's units as they stood before the write (extraction R24's `unitsBefore`, K141) are graded against
       the units the write left, which the index holds at this call (the listener runs after the write). */
    c.extraction.onReading("content", (e) => ({ staled: c.markStale(e.captureSha, e.chainAfter, { unitsBefore: e.unitsBefore ?? null }) }));
    joinTestimony(c);
    registerFigures(c);
  }
  return c;
}

/** R54 (plan T33, Rules (6)), R39: the four tables declared explicitly through record-core's `declareTable` (its R21),
 *  each keyed to its bundle by `bundle_id` and cleared by purge, seen as that bundle is seen (R37), and every other
 *  class as `declarePurge`'s default form gives it. A refusal (another module holding one of them, or content
 *  declaring twice) is a defect of the wiring and throws. */
export const CONTENT_TABLE_CLASSES = Object.freeze({
  purge: "clear", expunge: "none", export: "admin-only", sight: "bundle", derive: "stored", version_chain: false,
});
function declareTables(record) {
  const answer = record.declareTable("content", CONTENT_TABLES.map((name) => ({ name, ...CONTENT_TABLE_CLASSES })));
  if (answer && answer.ok === false)
    throw new Error(`content: record-core refused its tables: ${answer.code || answer.reason}${answer.table ? ` (${answer.table})` : ""}`);
}

/** R49: the testimony path's check and mint, registered once on provenance's testimony slot (its R52), which
 *  control-plane's promotion step runs (its R42, `src/control-plane/step.mjs`) where the retired legacy store's step
 *  ran them. A provenance with no slot (a test's
 *  stand-in) is left alone; a refusal (content registering twice) is a defect of the wiring and throws. */
function joinTestimony(c) {
  const p = c.provenance;
  if (!p || typeof p.onTestimony !== "function") return;
  const answer = p.onTestimony("content", { check: (t) => c.testimonyCheck(t), project: (t) => c.testimonyProject(t) });
  if (answer && answer.ok === false) throw new Error(`content: provenance refused its testimony registration: ${answer.code || answer.reason}`);
}

/** R51: this module's figures, registered with record-core's `registerCounts` (its R63) once per storage, when the
 *  instance is first made. A record with no seam (a test's stand-in) is left alone; a refusal (another module reporting
 *  one of these figures, or content registering twice) is a defect of the wiring and throws. */
function registerFigures(c) {
  const record = c.record;
  if (!record || typeof record.registerCounts !== "function") return;
  const answer = record.registerCounts("content", [...CONTENT_COUNT_KEYS], (hid) => c.counts(hid));
  if (answer && answer.ok === false)
    throw new Error(`content: record-core refused its figures: ${answer.reason}${answer.heldBy ? ` (held by ${answer.heldBy})` : ""}`);
}
