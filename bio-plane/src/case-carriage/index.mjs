/* case-carriage — what a case edition carries at its commit (requirements: `build/requirements/case-carriage.md`;
 * DEC-112 (3), (4); BIO_Publication_v0_1.md §5C). `publication`'s commit calls it inside its own transaction: it holds,
 * by SHA-256, the materials the signed document includes, so `public-read` carries them in the case file from the
 * published projection alone (R1–R3), and it re-reads what the document rests on that may have changed since it was
 * prepared: what may be published of each source it states (R5; N364) and another group's work it accepted (R4; N522).
 * A document cut out of a captured archive is carried with its archive, its `container` record and the archive's tokens,
 * so an outsider re-derives it with stock tools (R8; N688, K1844).
 * (T37; N757, DEC-180) It holds the marks members make on a photo of who and what to obscure (R9, R10, R12) and derives
 * from the marks that stand, through `image-cover`, a copy carrying nothing of the original but its pixels, each marked
 * area covered (R11). (T38; N779, K2248) A published case carries every photo only as this copy (R1): never the original,
 * whole or inside an archive (R8). (T38; N788, DEC-183 (2)) A mark is withdrawn by a reasoned act recorded beside it,
 * never erased (R14). Inside the group every photo stays as taken. `marksLapsed` (R13) is publication's commit check.
 * The refusals those re-reads lead to, and every write to the published projection's other tables, are `publication`'s:
 * this module owns the two tables of held materials (`./schema.mjs`, exempt from purge, R6), the marks and the copies'
 * withdrawals and derivations (R12), and names no place (R7). Its own refusals (R9, R10, R14) are rows of C-141
 * (`./checks.mjs`).
 * (T39; N806, K2315, K2333) A member document, one this copy did not fetch (provenance R62), is carried only as its
 * cleaned copy from `doc-clean` (no picture or document metadata), or whole when it carries none (R1, R13): this
 * module queues it from each receipt that is not a fetch and from each miss (R15, R16), derives the copy on the
 * scheduler's wake (`copyBatch`, `copyWake`; R17 `onCopyWork` the arming notice) and answers its state synchronously
 * (`documentCopy`). Its archive is never carried (R8). Inside the group every document stays as it came.
 * (T46; N907, K2833, K2949) For `case-check` R2's latch, R4, R5 and R13 are each widened over the interval from a check's
 * `checked_at` through the read (`acceptedWorkLapsedSince`, `sourcesLapsedSince`, `marksLapsedSince`; R19–R21), as far as
 * accepted-work's withdrawals, sources at the two instants and this module's own append-only marks and copies answer it;
 * (T47; N947) and through accepted-work's flags' history (its R9) and the instants a source changed (sources R20), a flag
 * opened and cleared, or a consent withdrawn and restored, inside the interval. (T47; N953) The answers naming a copy
 * also answer the row's `obscured` object, its marker (`kind`) included, for the writer of a `materials:` row (R22).
 *
 * Split from `publication` by copy (K617, K624 (1), N532, K1332; seam map `build/extraction/publication-split-2.md`):
 * R57's holding (`#holdMaterials`, `#registered`, `#fileRow`, `#tokenFiles`, `heldMaterialsOf`,
 * `publishedMaterialText`), R59's re-read and R51's, with their comments, and the two tables. `publication`'s job
 * deletes its copy and creates this module. One change of shape at the seam: `holdMaterials` answers the `files` the
 * caller registers by hash, since every write to `published_shas` is `publication`'s.
 *
 * REACHED as `caseCarriageOf(host, deps)` (K61): one instance per host (the Durable Object's `ctx`), created on the first
 * call with `deps`, returned to every later caller. At creation it creates its two tables and declares them to
 * record-core's purge as exempt (R6).
 * `deps` (each reached through its factory on the same host unless given; a test passes its own):
 *   record, membership, promotion   layer 2: `readFile` (R13), `declarePurge` (R21); membership and promotion only to
 *                                   construct the three below.
 *   extraction     `unitsOf` (its R36), for R1's extracted text.
 *   sources        `publishableAt` (its R8), for R5.
 *   acceptedWork   `acceptedFinding`, `openFlagsOn` (its R2), for R4; (T46) `acceptanceWithdrawals` (its R2), for R19;
 *                  (T47) `flagHistoryOn` (its R9), for R19. `sources` (T47) also `sourceChangesSince` (its R20), for R21.
 *   now            the clock for the instants it writes when the caller gives none, an ISO string (default: the wall
 *                  clock).
 *   bucket, store  (T37; R11) the evidence bucket (the Worker's `CAPTURES` R2 binding) and the store's namespace (a
 *                  string or a function answering one; default "bio"): the obscured copy is held at
 *                  `<store>/obscured/<sha>` (`obscuredKey`), beside file-safety's `<store>/derived/`, outside
 *                  `captures/`. The original is read through record-core's `evidenceStore` (its R38). Unbound, no copy
 *                  is made (R11 then answers `copy: null`, so a case cannot carry the photo).
 *   cover          `image-cover`'s `coverAreas` (a test may pass its own).
 *   provenance     (T39; R15–R17) `fetchedByThisCopy` (its R62) and `onReceipt` (its R47); the listener is registered
 *                  once, at creation.
 *   clean          `doc-clean`'s `cleanDocument` (a test may pass its own).
 *
 * READ CONTRACTS it joins in its own SQL: provenance's `register` (its R48: `capture_sha`, `bundle_id`, `path`, `bytes`),
 * record-core's `bundles` (its R37), sources' `source_knocks` (its R15) and (T38; R8, K2291 (2); asked of BOB in J1)
 * acquisition's `archive_entries` (R38's record of an archive's listing: `archive_sha`, `idx`, `name`, `kind`, `state`,
 * `sha256`), to tell whether an archive holds an image. */

import { membershipOf, listenerRefusal } from "../membership/index.mjs";
import { promotionOf } from "../promotion/index.mjs";
import { recordOf, stampInstant, instantOrder } from "../record-core/index.mjs";
import { createSha256, canonicalJson, isMachineIdentity } from "../record-grammar/index.mjs";
import { coverAreas, COVER_MAX_BYTES } from "../image-cover/index.mjs";
import { cleanDocument, CLEAN_MAX_BYTES } from "../doc-clean/index.mjs";
import { provenanceOf, FETCHED_VIAS } from "../provenance/index.mjs";
import { sourcesOf } from "../sources/index.mjs";
import { extractionOf } from "../extraction/index.mjs";
import { acceptedWorkOf } from "../accepted-work/index.mjs";
import { materialsOf, extractedTextOf, acceptedWorkOf as acceptedWorkBlocksOf, caseDocumentBlocks,
         sourceRowsStanding } from "../case-grammar/index.mjs";
import { CASE_CARRIAGE_EXEMPT, CASE_CARRIAGE_MARK_TABLES, CASE_CARRIAGE_DOCUMENT_TABLES, migrateCaseCarriage } from "./schema.mjs";
import { CASE_CARRIAGE_CHECKS, OBSCURED_LABEL, PUBLISHED_LABEL, COPY_CLEANED_LABEL } from "./checks.mjs";
import { word, localize } from "../setup-words/index.mjs";
import { boundOf } from "../read-bounds.mjs";

export { CASE_CARRIAGE_SCHEMA, CASE_CARRIAGE_EXEMPT, CASE_CARRIAGE_MARK_TABLES, CASE_CARRIAGE_DOCUMENT_TABLES } from "./schema.mjs";
export { CASE_CARRIAGE_CHECKS, CASE_CARRIAGE_WORDS, OBSCURED_LABEL, PUBLISHED_LABEL, COPY_CLEANED_LABEL } from "./checks.mjs";

/** R1: the most items one `unheld` answer names. */
export const UNHELD_MAX = 1000;
/** R4: the most open flags one `undisclosed` answer names. */
export const UNDISCLOSED_MAX = 200;
/** R9: the most areas one mark holds. */
export const MARK_AREAS_MAX = 100;
/** R9: the kinds of area a member marks (DEC-180 (3), (5)). */
export const MARK_KINDS = Object.freeze(["person", "plate", "staff"]);
/** R9: the longest reason a `staff` area gives. */
export const STAFF_REASON_MAX = 2000;
/** R14: the longest reason a withdrawal gives. */
export const WITHDRAW_REASON_MAX = 2000;
/** R13: the most rows one `marksLapsed` answer names. */
export const MARKS_LAPSED_MAX = 200;
/** R11: where a photo's obscured copy is held, under its own digest, outside `captures/`; (T39; R15) a member
 *  document's cleaned copy too, so `ratification` R39 copies both one way. */
export const obscuredKey = (store, sha) => `${store}/obscured/${sha}`;
/** R15: the most queued documents one `copyBatch` derives: its default and its bound. */
export const DOCUMENT_COPY_BATCH_MAX = 10;
/** R15 (T51; K4570 G9): the most `copyNow` reads of one document, 2 MiB; a larger one is the alarm's. */
export const COPY_NOW_MAX_BYTES = boundOf("case", "copy_now_bytes");
/** R15 (T51; fix round 10, R24 b2; K5057): the size above which a document's bytes are digested by the platform's native
 *  SHA-256, not the one-shot pure-JS hash that holds the object's thread for the length of a large file. */
export const NATIVE_DIGEST_MIN_BYTES = 1024 * 1024;
/** R15: how long after a failed read of the evidence store a queued document is tried again. */
export const DOCUMENT_COPY_RETRY_MS = 300000;

/* R9, R10: a photo is told by the type recorded with its capture, else its register path's extension (synchronous). */
const IMAGE_FORMATS = new Set(["jpeg", "jpg", "png", "gif", "webp", "heic", "heif", "avif", "tiff", "tif", "bmp"]);
const IMAGE_EXT = /\.(jpe?g|jfif|png|gif|webp|heic|heif|avif|tiff?|bmp)$/i;
/* R8 (K2291 (2)): an entry of an archive's listing that is itself an archive never opened. */
const ARCHIVE_EXT = /\.zip$/i;
/* R1, R8 (T38; N779): why a photo, or an archive holding an image, is not carried. */
export const PHOTO_ONLY_AS_COPY = word("case-carriage.photo_only_as_copy");
export const ARCHIVE_HOLDS_IMAGE = word("case-carriage.archive_holds_image");
/* R1, R8, R13 (T39; N806, K2333): why a member document carried whole, or a member's archive, is not carried. */
export const MEMBER_DOCUMENT_ONLY_AS_COPY = word("case-carriage.member_document_only_as_copy");
export const ARCHIVE_SUPPLIED_BY_MEMBER = word("case-carriage.archive_supplied_by_member");
/* R13: why a member document's row lapses when its state cannot be read. */
const DOCUMENT_UNREAD = word("case-carriage.document_unread");
/* R13: why a photo's row lapses when its marks cannot be read. */
const MARKS_UNREAD = word("case-carriage.marks_unread");
/* R20 (T46; N907): why a row lapses over the interval since a check. */
export const COPY_CHANGED_SINCE = word("case-carriage.copy_changed_since");
const SINCE_UNREAD = word("case-carriage.since_unread");
const MARKS_HISTORY_UNREAD = word("case-carriage.marks_history_unread");
const DOCUMENT_HISTORY_UNREAD = word("case-carriage.document_history_unread");
/* R19: the page asked of accepted-work's withdrawals (case-import's bound), and the most pages one read walks. */
const WITHDRAWAL_PAGE = 1000, WITHDRAWAL_PAGES_MAX = 1000;
/* R21 (T47): the page asked of a source's changes (sources R20's bound), and the most pages one source's read walks. */
const CHANGE_PAGE = 1000, CHANGE_PAGES_MAX = 1000;
/* R19–R21: `since` is an instant as record-core stamps it (its R47), to the second or the millisecond. */
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
const isInstant = (s) => {
  try {
    if (typeof s !== "string" || !INSTANT.test(s)) return false;
    const ms = Date.parse(s);
    return Number.isFinite(ms) && stampInstant(s.includes(".") ? "millisecond" : "second", ms) === s;
  } catch { return false; }
};
/* R16: the answer when the tables or R62 cannot be read (fail closed). */
const UNDETERMINED = Object.freeze({ state: "undetermined", copy: null, refused: null });
/* R11: image-cover's refusals that leave a mark recorded with no copy (every one but the areas' own). */
const COVER_REFUSED = new Set(["NOT_A_COVERABLE_FORMAT", "UNSUPPORTED_JPEG_PROCESS", "PNG_INTERLACED", "PHOTO_TOO_LARGE",
                               "TRUNCATED_IMAGE_DATA", "IMAGE_DATA_CORRUPT"]);
/* R9: image-cover names an area by its place among every area covered; the answer names it in this mark, when it is. */
const areaOf = (detail, before) => {
  const m = /\barea (\d+)\b/.exec(String(detail ?? ""));
  return m && Number(m[1]) >= before ? { area: Number(m[1]) - before } : {};
};
/* DEC-49: a refusal from this module's own row. */
const refusal = (code, detail, extra = {}) => ({ ...extra, ok: false, reason: code, code,
  check: CASE_CARRIAGE_CHECKS[code].check, translation: CASE_CARRIAGE_CHECKS[code].translation, detail });

const safeJson = (s) => { try { return s == null ? null : JSON.parse(s); } catch { return null; } };
const HEX64 = /^[0-9a-f]{64}$/;
const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : "");
const te = new TextEncoder();
const digestOf = (v) => String(v ?? "").trim().replace(/^sha256:/i, "").toLowerCase();
/* R15 (T51; R24 b2): the platform's SHA-256 of `bytes` as lower-case hex; the same digest the pure-JS hash answers. */
const nativeSha256 = async (bytes) => {
  const d = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
};
const jsSha256 = (bytes) => createSha256().update(bytes).hex();
const shaOf = (text) => createSha256().update(te.encode(String(text))).hex();
/* R1, R13 (case-grammar R12): the `obscured` a row states, `{copy}` with the copy's digest read lower-case, or null. */
const obscuredOf = (m) => {
  const ob = m && m.obscured && typeof m.obscured === "object" ? m.obscured : null;
  return ob ? { copy: str(ob.copy).toLowerCase() } : null;
};

export class CaseCarriage {
  #deps;

  #chains = new Map();   // R11: one derivation at a time per capture
  #copyWork = [];        // R17: the modules told when a member document is queued
  #faults = [];          // R18: start-up faults, each `{notice, reason, detail}`

  constructor({ storage, record, membership = null, promotion = null, host = null, extraction = null, sources = null,
                acceptedWork = null, now = null, bucket = null, store = null, cover = null, provenance = null,
                clean = null, nativeDigest = null, jsDigest = null } = {}) {
    this.storage = storage;
    this.sql = storage.sql;
    this.bucket = bucket && typeof bucket.put === "function" ? bucket : null;
    this.store = store;
    this.cover = typeof cover === "function" ? cover : coverAreas;
    this.clean = typeof clean === "function" ? clean : cleanDocument;
    this.nativeDigest = typeof nativeDigest === "function" ? nativeDigest : nativeSha256;   // R15: a test counts the work
    this.jsDigest = typeof jsDigest === "function" ? jsDigest : jsSha256;
    this.provenance = provenance;
    this.record = record;
    this.membership = membership;
    this.promotion = promotion;
    this.#deps = { host, extraction, sources, acceptedWork };
    this.now = typeof now === "function" ? now : () => new Date().toISOString();
    this.purgeDeclaration = null;   // R6: record-core's answer to this module's purge declaration, set at creation
    this.marksDeclaration = null;   // R12: record-core's answer to the marks' declaration, set at creation
  }

  /* The modules reached lazily: each is created on the same host on first use, unless a test passed its own. */
  get acceptedWork() { return this.#deps.acceptedWork ||= acceptedWorkOf(this.#deps.host, { record: this.record, promotion: this.promotion }); }
  get extraction() { return this.#deps.extraction ||= extractionOf(this.#deps.host, { record: this.record, membership: this.membership }); }
  get sources() { return this.#deps.sources ||= sourcesOf(this.#deps.host, { record: this.record, membership: this.membership }); }

  migrate() { migrateCaseCarriage(this.sql, this.storage); }

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  #one(q, ...a) { for (const r of this.sql.exec(q, ...a)) return r; return null; }
  #when(at) {
    if (typeof at === "string" && at.trim()) return at.trim();
    const w = this.now();
    return typeof w === "string" && w ? w : new Date().toISOString();
  }

  /* A live file's inline text as `{content}` (record-core R13), or null when it is not held inline. */
  #fileText(bundleId, path) {
    const f = this.#fileRow(bundleId, path);
    return f && typeof f.text === "string" ? { content: f.text } : null;
  }

  /** R1 (DEC-112 (3)(4); K1315, K1316): hold, by SHA-256, each `included: true` material of the signed document's
   *  `materials:` block, inside the caller's transaction (it opens none of its own): an observation's whole text and a
   *  document's captured bytes where the register holds them as inline text (verified against the stated digest), a
   *  document's extracted text (`extractedTextOf` over extraction's units, only when the index is whole and no unit was
   *  cut, verified against `text_sha`), and the timestamp tokens its home's provenance names, as text where inline.
   *  Bytes held only in the evidence store are answered `held: "evidence"`, for ratification R39 to copy. (T37; N757) A
   *  row listed `included: false` whose `obscured` names a copy carries that copy alone, `held: "derived"`, kind
   *  `obscured`, nothing of the original. (T38; N779) A row listed `included: true` whose capture is a photo, or is an
   *  archive holding an image, is not held but answered unheld, so no original photo's bytes leave. (T39; N806) Nor is
   *  a member document (R15) whose copy state (R16) is not `clean`; one carried whole carries none of R8's files. A
   *  member document's copy is carried as a photo's is. Each SHA-256 is held
   *  once per call and named in `files` once for each ref that carries it (R8; N768). Answers `{materials, unheld, files}`, `files` for the caller to register by hash; a material
   *  it cannot hold is answered, never refused. Never throws. */
  holdMaterials(fm, { caseId = null, edition = null, at = null } = {}) {
    const materials = [], unheld = [], files = [], texts = [];
    let when;
    try { when = this.#when(at); } catch { when = new Date().toISOString(); }
    let rows = null;
    try { const m = materialsOf(fm); rows = m && Array.isArray(m.materials) ? m.materials : null; } catch { rows = null; }
    rows = Array.isArray(rows) ? rows.filter((m) => m && typeof m === "object") : [];
    const seen = new Set(), named = new Map(), stamped = new Map();
    let capture = null;   // G47t: the capture the material being held is for (an archive's tokens: the member's)
    const hold = (ref, kind, sha, text, bytes, derived = false) => {
      const inline = typeof text === "string";
      const size = inline ? te.encode(text).length : Number.isInteger(bytes) ? bytes : null;
      const key = `${sha}\u0000${ref}`;
      if (!named.has(key)) {
        const entry = { sha256: sha, ref, path: `materials/${sha}`, kind, bytes: size };
        if (kind === "attestation") { entry.capture_sha = capture; stamped.set(key, new Set([capture])); }
        named.set(key, entry);
        files.push(entry);
      } else if (kind === "attestation") {
        /* G47t: a token two different captures name is shared (null), whatever the order they name it in */
        const by = stamped.get(key);
        if (by) { by.add(capture); if (by.size > 1) named.get(key).capture_sha = null; }
      }
      if (seen.has(sha)) return;
      seen.add(sha);
      if (inline) texts.push([sha, kind, text, size]);
      materials.push({ sha, held: derived ? "derived" : inline ? "inline" : "evidence" });
    };
    const images = new Map();   // R8: archive → whether it holds an image, judged once per call
    for (const m of rows) {
      const ref = str(m.ref), sha = str(m.sha).toLowerCase(), kind = m.kind;
      capture = sha;
      if (!(m.included === true || m.included === "true")) {
        const ob = obscuredOf(m);
        if (ob) this.#holdCopy(ref, sha, ob, hold, unheld);
        continue;
      }
      const miss = (what, why) => unheld.push({ ref: ref || null, kind: what,
        sha256: what === "extracted_text" ? str(m.text_sha).toLowerCase() || null : sha || null, why });
      if (!HEX64.test(sha)) { miss(kind === "observation" ? "observation" : "document", "the row names no SHA-256"); continue; }
      /* (T38; N779, K2291 (2)) a photo, or an archive holding an image, is never carried whole */
      if (kind !== "observation" && this.#isPhoto(sha)) { miss("document", PHOTO_ONLY_AS_COPY); continue; }
      if (kind !== "observation" && this.#isArchive(sha) && this.#holdsImage(sha, images)) { miss("document", ARCHIVE_HOLDS_IMAGE); continue; }
      const home = this.#registered(sha);
      const inline = home ? this.#fileText(home.bundle_id, home.path) : null;
      const inlineOk = !!inline && shaOf(inline.content) === sha;
      if (kind === "observation") {
        if (inlineOk) hold(ref, "observation", sha, inline.content);
        else miss("observation", word("case-carriage.miss.group_civicsmith_holds"));
        continue;
      }
      if (!inlineOk && !(home && !inline)) { miss("document", word("case-carriage.miss.group_civicsmith_holds_bytes")); continue; }
      /* (T39; N806, K2333) a member document is carried whole only when it carries nothing doc-clean removes */
      const member = this.#memberOf(sha);
      if (member && member.state !== "clean") { miss("document", MEMBER_DOCUMENT_ONLY_AS_COPY); continue; }
      if (inlineOk) hold(ref, "document", sha, inline.content);
      else hold(ref, "document", sha, null, Number(home.bytes));
      /* its extracted text */
      const textSha = str(m.text_sha).toLowerCase();
      let text = null;
      try {
        const u = this.extraction.unitsOf(sha);
        if (u && u.state === "whole" && Array.isArray(u.units) && u.units.length && !u.units.some((x) => !x || x.truncated))
          text = extractedTextOf(u.units);
      } catch { text = null; }
      if (typeof text === "string" && HEX64.test(textSha) && shaOf(text) === textSha) hold(ref, "extracted_text", textSha, text);
      else miss("extracted_text", word("case-carriage.miss.group_civicsmith_holds_whole"));
      /* its timestamp tokens, as the capture's home provenance names them (K1315, K1322) */
      this.#holdTokens(ref, home, sha, hold, unheld);
      /* R8 (N688; K1844): a member of a captured archive, carried with its archive, outward to the outermost; (T39) a
         member document carries none of R8's files */
      if (!member) this.#holdArchives(ref, home, sha, hold, unheld, images);
    }
    /* The writes, after every read: each text once, and the edition's list once (a second call writes nothing new). */
    try {
      for (const [sha, kind, text, size] of texts)
        this.sql.exec(`INSERT INTO published_material_texts (sha256,kind,text,bytes,published) VALUES (?,?,?,?,?)
                       ON CONFLICT(sha256) DO NOTHING`, sha, kind, text, size, when);
      const id = str(caseId), ed = Number(edition);
      if (id && Number.isInteger(ed) && ed >= 1 && materials.length
          && !this.#one(`SELECT 1 AS x FROM published_case_materials WHERE case_id=? AND edition=? LIMIT 1`, id, ed))
        materials.forEach((m, i) => this.sql.exec(
          `INSERT INTO published_case_materials (case_id,edition,ord,sha256,held) VALUES (?,?,?,?,?)
           ON CONFLICT(case_id,edition,ord) DO NOTHING`, id, ed, i, m.sha, m.held));
    } catch {
      /* Nothing written can be answered as held: every item is named unheld instead, never refused. */
      return { materials: [], files: [], unheld: [...files.map((f) => ({ ref: f.ref || null, kind: f.kind, sha256: f.sha256,
        why: word("case-carriage.why.group_civicsmith_record") })), ...unheld].slice(0, UNHELD_MAX) };
    }
    return { materials, unheld: unheld.slice(0, UNHELD_MAX), files };
  }

  /* R1: each timestamp token the home's provenance names for capture `sha`: inline as text, blob-backed as evidence
     under its blob digest, else named unheld under `sha`. */
  #holdTokens(ref, home, sha, hold, unheld) {
    for (const t of this.#tokenFiles(home, sha)) {
      const f = this.#fileRow(home.bundle_id, t);
      if (f && typeof f.text === "string") hold(ref, "attestation", shaOf(f.text), f.text);
      else if (f && typeof f.blobSha === "string" && HEX64.test(f.blobSha)) hold(ref, "attestation", f.blobSha, null, f.bytes);
      else unheld.push({ ref: ref || null, kind: "attestation", sha256: sha, why: word("case-carriage.why.timestamp_token_held", { t: String(t) }) });
    }
  }

  /** R8 (N688; K1844, K1852 (1); Intake §3b): a document is a member when the entry its home's `data/provenance.json`
   *  states for it has `capture.method` `unpacked` and a `container` block. Its `container` record (canonical JSON,
   *  kind `container`), its archive (as a document's captured bytes, kind `archive`) and the archive's tokens are held,
   *  and the same for the archive when it is itself a member, up to the outermost. A block that does not name this
   *  document, an archive not held, or a token not held is named unheld and never refused; the first two stop the walk,
   *  since nothing further out can be checked against them. An archive already walked in this call ends it (a cycle).
   *  (T37; N757; T38: N779, K2291 (2)) An archive that holds any image would carry the original: it is named unheld for
   *  this material and ends the walk (`images` keeps each archive's verdict for the call). (T39; N806, K2333) So does an
   *  archive this copy did not fetch (provenance R62): a member's file leaves only as its copy. */
  #holdArchives(ref, home, sha, hold, unheld, images = new Map()) {
    const walked = new Set([sha]);
    let cur = sha, at = home;
    for (;;) {
      const entry = this.#entriesFor(at, cur).find((d) => d.capture && d.capture.method === "unpacked"
        && d.container && typeof d.container === "object" && !Array.isArray(d.container));
      if (!entry) return;
      const c = entry.container;
      const archive = str(c.archive_sha256).toLowerCase();
      if (digestOf(c.member_sha256) !== cur || !HEX64.test(archive)) {
        unheld.push({ ref: ref || null, kind: "container", sha256: cur, why: word("case-carriage.why.container_record_name") });
        return;
      }
      const record = canonicalJson(c);
      hold(ref, "container", shaOf(record), record);
      if (walked.has(archive)) return;
      walked.add(archive);
      const aHome = this.#registered(archive);
      const inline = aHome ? this.#fileText(aHome.bundle_id, aHome.path) : null;
      const inlineOk = !!inline && shaOf(inline.content) === archive;
      if (!inlineOk && !(aHome && !inline)) {
        unheld.push({ ref: ref || null, kind: "archive", sha256: archive, why: word("case-carriage.why.archive_held") });
        return;
      }
      if (this.#fetched(archive) !== true) {
        unheld.push({ ref: ref || null, kind: "archive", sha256: archive, why: ARCHIVE_SUPPLIED_BY_MEMBER });
        return;
      }
      if (this.#holdsImage(archive, images)) {
        unheld.push({ ref: ref || null, kind: "archive", sha256: archive, why: ARCHIVE_HOLDS_IMAGE });
        return;
      }
      if (inlineOk) hold(ref, "archive", archive, inline.content);
      else hold(ref, "archive", archive, null, Number(aHome.bytes));
      this.#holdTokens(ref, aHome, archive, hold, unheld);
      cur = archive;
      at = aHome;
    }
  }

  /* R1: the register row homing a capture on a bundle that exists, or null (provenance's read contract, R48). */
  #registered(sha) {
    try {
      return this.#one(`SELECT r.bundle_id, r.path, r.bytes FROM register r JOIN bundles b ON b.bundle_id=r.bundle_id
                         WHERE r.capture_sha=? LIMIT 1`, sha);
    } catch { return null; }
  }

  /* R1: a live file's record-core read (R13): inline text, or its blob reference. */
  #fileRow(bundleId, path) { try { return this.record.readFile(bundleId, path); } catch { return null; } }

  /* R1 (K1315, K1322): the timestamp token files the home's `data/provenance.json` names for one capture. */
  #tokenFiles(home, sha) {
    const out = new Set();
    for (const d of this.#entriesFor(home, sha)) {
      if (d.timestamp && typeof d.timestamp.token_file === "string" && d.timestamp.token_file) out.add(d.timestamp.token_file);
      for (const t of Array.isArray(d.attestations) ? d.attestations : [])
        if (t && t.kind === "rfc3161" && typeof t.file === "string" && t.file) out.add(t.file);
    }
    return [...out];
  }

  /* R1, R8: the entries the home's `data/provenance.json` states for capture `sha` (its `capture.sha256`). */
  #entriesFor(home, sha) {
    const f = home ? this.#fileText(home.bundle_id, "data/provenance.json") : null;
    const reg = f ? safeJson(f.content) : null;
    return (reg && Array.isArray(reg.documents) ? reg.documents : [])
      .filter((d) => d && typeof d === "object" && d.capture && digestOf(d.capture.sha256) === sha);
  }

  /** R2 (K1317): what a committed case edition held, `[{sha, held}]` in the order held, `held` `inline`, `evidence` or
   *  (T37) `derived`, as R1 wrote it, so a retried ratification copies what is left (ratification R39); `[]` for an edition that held
   *  nothing or was never committed. Writes nothing; never throws. */
  heldMaterialsOf(caseId, edition) {
    try {
      return this.#rows(`SELECT sha256, held FROM published_case_materials WHERE case_id=? AND edition=? ORDER BY ord`,
                        str(caseId), Number(edition)).map((r) => ({ sha: r.sha256, held: r.held }));
    } catch { return []; }
  }

  /** R3 (K1316): a held material's text by its SHA-256 (read case-insensitively), for `public-read`'s case file:
   *  `{found, sha256, kind, text}`, or `{found: false}`. Answered only for a text a commit held, so working material is
   *  unreachable here. Writes nothing. */
  publishedMaterialText(sha) {
    try {
      const r = this.#one(`SELECT sha256, kind, text FROM published_material_texts WHERE sha256=?`,
                          String(sha ?? "").trim().toLowerCase());
      return r ? { found: true, sha256: r.sha256, kind: r.kind, text: r.text } : { found: false };
    } catch { return { found: false }; }
  }

  /** R4 (DEC-96 items 1, 4; N522; K1316 (3), (4)): the rows of a document's `accepted_work:` block whose acceptance is
   *  no longer in force, and the open flags on their editions its `accepted_work_flags:` block does not disclose, or
   *  null when every row stands. Read through `accepted-work` (its R2) once per distinct `(ref, edition)`, as the signer
   *  (`member:<signer>`). A read that answers absent, unreadable, null, or (for flags) not complete counts as not in
   *  force, and so does one that throws. Writes nothing. */
  acceptedWorkLapsed(fm, signer) {
    let blocks = null;
    try { blocks = acceptedWorkBlocksOf(fm); } catch { blocks = null; }
    const rows = blocks && Array.isArray(blocks.rows) ? blocks.rows : [];
    if (!rows.length) return null;
    const disclosed = new Set((Array.isArray(blocks.flags) ? blocks.flags : [])
      .filter((f) => f && typeof f === "object").map((f) => `${f.ref}\u0000${Number(f.edition)}\u0000${f.flag}`));
    const viewer = str(signer) ? `member:${str(signer).replace(/^member:/, "")}` : null;
    const ask = (fn, args) => { try { return this.acceptedWork[fn](args); } catch { return null; } };
    const withdrawn = [], undisclosed = [];
    const asked = new Set();
    for (const r of rows) {
      if (!r || typeof r !== "object") continue;
      const ref = str(r.ref), edition = Number(r.edition);
      const key = `${ref}\u0000${edition}`;
      if (asked.has(key)) continue;
      asked.add(key);
      const named = { ref: ref || null, edition: Number.isInteger(edition) ? edition : null };
      const f = ask("acceptedFinding", { ref, edition, viewer });
      const inForce = !!f && typeof f === "object" && !f.absent && !f.unreadable && !!f.acceptance
        && typeof f.acceptance === "object" && (f.edition === undefined || Number(f.edition) === edition);
      if (!inForce) { withdrawn.push(named); continue; }
      const o = ask("openFlagsOn", { ref, edition, viewer });
      if (!o || typeof o !== "object" || o.absent || o.unreadable || o.complete !== true || !Array.isArray(o.flags)) {
        withdrawn.push(named);
        continue;
      }
      for (const fl of o.flags)
        if (fl && !disclosed.has(`${ref}\u0000${edition}\u0000${fl.flag}`))
          undisclosed.push({ ...named, flag: fl.flag ?? null, issue: typeof fl.issue === "string" ? fl.issue : null });
    }
    return withdrawn.length || undisclosed.length ? { withdrawn, undisclosed: undisclosed.slice(0, UNDISCLOSED_MAX) } : null;
  }

  /** R5 (DEC-78 item 5(d); N364): the `sources:` rows of one case document that no longer hold at `at`
   *  (`sourceRowsStanding`). The sources behind a capture are the pulled knocks `sources` minted for it (its
   *  `source_knocks` read contract, R15), first received first, each asked what the public may be told at `at`; a
   *  capture with no knock, or a source that cannot be read, answers nothing, so its rows lapse (fail closed). A document
   *  stating no `sources:` row has nothing to re-read. Writes nothing. */
  sourcesLapsed(text, at) {
    const rows = CaseCarriage.#sourceRows(text);
    return rows.length ? sourceRowsStanding(rows, this.#publishable(at)) : [];
  }

  /* R5, R21: a case document's `sources:` rows (case-grammar R27), `[]` when it states none or cannot be read. */
  static #sourceRows(text) {
    let rows = null;
    try { rows = caseDocumentBlocks(text).sources; } catch { rows = null; }
    return Array.isArray(rows) ? rows : [];
  }

  /* R5, R21: case-grammar R28's `publishable` at `at`: for one capture, what the public may be told at `at` of every
     source behind it (its pulled knocks, first received first), or null when no knock stands behind it or a source
     cannot be read (fail closed). Each capture is asked once per function made. */
  #publishable(at) {
    const asked = new Map();
    return (capture) => {
      if (asked.has(capture)) return asked.get(capture);
      let knocks = [];
      try {
        knocks = this.#rows(`SELECT source_id, received FROM source_knocks WHERE capture_sha=?
                             ORDER BY received, knock_id`, capture);
      } catch { knocks = []; }
      let answer = null;
      if (knocks.length) {
        const entries = [];
        answer = { entries, received: knocks[0].received };
        for (const s of [...new Set(knocks.map((k) => k.source_id))]) {
          let r = null;
          try { r = this.sources.publishableAt({ source: s, audience: "public", at }); } catch { r = null; }
          if (!r || r.ok !== true || !Array.isArray(r.entries)) { answer = null; break; }
          entries.push(...r.entries);
        }
      }
      asked.set(capture, answer);
      return answer;
    };
  }

  /* ---- what lapsed since an instant (R19–R21; T46, N907, K2833, K2949), for `case-check` R2's latch ---- */

  /** R19 (T46; N907; K2833, K2949): R4's answer over the interval from `since` through the read, as far as
   *  `accepted-work` answers it. A row is withdrawn when R4 reads it withdrawn now, or when an acceptance withdrawal
   *  (`acceptanceWithdrawals`, its R2) at or after `since` names its `(ref, edition)`, though an acceptance stands again
   *  now; the undisclosed flags are R4's, those open at the read. Null when no row lapsed, else `{withdrawn,
   *  undisclosed}` in R4's bounds. A withdrawal history that cannot be read whole, or a `since` that is not record-core's
   *  instant, answers every row withdrawn. (T47; N947) A flag the flags block does not state is also undisclosed when
   *  `accepted-work.flagHistoryOn` (its R9) answers it open at any instant from `since` through the read, cleared since
   *  or not; each distinct `(ref, edition)` still in force is asked once, as the signer, and a history that cannot be
   *  read (absent, unreadable, not complete, flags not a list) answers that row withdrawn. Synchronous; writes nothing;
   *  never throws. */
  acceptedWorkLapsedSince(fm, signer, since) {
    let blocks = null;
    try { blocks = acceptedWorkBlocksOf(fm); } catch { blocks = null; }
    const rows = [];
    const keys = new Set();
    for (const r of blocks && Array.isArray(blocks.rows) ? blocks.rows : []) {
      if (!r || typeof r !== "object") continue;
      const ref = str(r.ref), edition = Number(r.edition), key = `${ref}\u0000${edition}`;
      if (keys.has(key)) continue;
      keys.add(key);
      rows.push({ key, named: { ref: ref || null, edition: Number.isInteger(edition) ? edition : null } });
    }
    if (!rows.length) return null;
    let now = null;
    try { now = this.acceptedWorkLapsed(fm, signer); } catch { now = null; }
    const valid = isInstant(since);
    const gone = valid ? this.#withdrawnSince(since) : null;
    const isNow = new Set((now ? now.withdrawn : []).map((x) => `${x.ref ?? ""}\u0000${x.edition}`));
    const lapsed = (r) => gone === null || gone.has(r.key) || isNow.has(`${r.named.ref ?? ""}\u0000${r.named.edition}`);
    const undisclosed = now ? [...now.undisclosed] : [];
    /* (T47; N947; accepted-work R9) each flag open at any instant of the interval, cleared since or not; a history that
       cannot be read whole withdraws its row (fail closed) */
    const failed = new Set();
    if (valid && gone !== null) {
      const disclosed = new Set((Array.isArray(blocks.flags) ? blocks.flags : [])
        .filter((f) => f && typeof f === "object").map((f) => `${f.ref}\u0000${Number(f.edition)}\u0000${f.flag}`));
      const listed = new Set(undisclosed.map((u) => `${u.ref ?? ""}\u0000${u.edition}\u0000${u.flag}`));
      const viewer = str(signer) ? `member:${str(signer).replace(/^member:/, "")}` : null;
      for (const r of rows) {
        if (lapsed(r)) continue;
        const { ref, edition } = r.named;
        let h = null;
        try { h = this.acceptedWork.flagHistoryOn({ ref: ref ?? "", edition, since, viewer }); } catch { h = null; }
        if (!h || typeof h !== "object" || h.absent || h.unreadable || h.complete !== true || !Array.isArray(h.flags)) {
          failed.add(r.key);
          continue;
        }
        for (const fl of h.flags) {
          if (!fl || typeof fl !== "object") continue;
          const k = `${ref ?? ""}\u0000${edition}\u0000${fl.flag}`;
          if (disclosed.has(`${ref ?? ""}\u0000${Number(edition)}\u0000${fl.flag}`) || listed.has(k)) continue;
          listed.add(k);
          undisclosed.push({ ...r.named, flag: fl.flag ?? null, issue: typeof fl.issue === "string" ? fl.issue : null });
        }
      }
    }
    const withdrawn = rows.filter((r) => lapsed(r) || failed.has(r.key)).map((r) => ({ ...r.named }));
    const shown = undisclosed.filter((u) => !failed.has(`${u.ref ?? ""}\u0000${u.edition}`));
    return withdrawn.length || shown.length ? { withdrawn, undisclosed: shown.slice(0, UNDISCLOSED_MAX) } : null;
  }

  /* R19: the `(ref, edition)` keys an acceptance withdrawal recorded at or after `since` names (a withdrawal whose
     instant cannot be read counts as after it), read page by page through accepted-work R2; null when the history
     cannot be read whole (absent, unreadable, a malformed page, a cursor that does not move, or past the bound). */
  #withdrawnSince(since) {
    const keys = new Set();
    let after = null;
    for (let page = 0; page < WITHDRAWAL_PAGES_MAX; page++) {
      let p = null;
      try { p = this.acceptedWork.acceptanceWithdrawals({ after, limit: WITHDRAWAL_PAGE }); } catch { p = null; }
      if (!p || typeof p !== "object" || p.absent || p.unreadable || !Array.isArray(p.withdrawals)) return null;
      for (const w of p.withdrawals) {
        if (!w || typeof w !== "object" || !Array.isArray(w.refs)) return null;
        const order = instantOrder(w.at, since);
        if (order < 0) continue;
        for (const ref of w.refs) keys.add(`${str(ref)}\u0000${Number(w.edition)}`);
      }
      if (p.cursor === null || p.cursor === undefined) return keys;
      if (p.cursor === after || !p.withdrawals.length) return null;
      after = p.cursor;
    }
    return null;
  }

  /** R20 (T46; N907; K2833): R13's rows over the interval from `since` through the read: each row R13 answers now, and
   *  each row stating `obscured` whose photo's copy (R11) or member document's copy (R16) was, at any instant at or
   *  after `since`, other than the copy it states, read from this module's append-only marks, withdrawals and copies
   *  (R12), even when the stated copy was derived again since. A history that cannot be read, or a `since` that is not
   *  record-core's instant, answers the row lapsed. At most 200, in row order; `[]` when none. Synchronous; writes
   *  nothing; never throws. */
  marksLapsedSince(fm, since) {
    const valid = isInstant(since);
    const out = [];
    for (const m of this.#materialRows(fm)) {
      let e = null;
      try { e = this.#lapsedNow(m); } catch { e = { ref: str(m.ref) || null, sha: str(m.sha).toLowerCase() || null, kind: "photo", why: MARKS_UNREAD }; }
      if (!e) {
        const ob = obscuredOf(m);
        if (ob) e = this.#changedSince(m, ob, valid ? since : null);
      }
      if (e) out.push(e);
      if (out.length >= MARKS_LAPSED_MAX) break;
    }
    return out;
  }

  /* R20: one row stating `obscured` when its copy was other than the stated one at an instant at or after `since`
     (null: not an instant, so lapsed), else null. A photo's copy after each act is the derivation that act wrote (a
     mark's, or a withdrawal's that left a mark standing), or none after a withdrawal that left none; a member document's
     is each outcome recorded. An act whose instant cannot be read counts as after `since`. */
  #changedSince(m, ob, since) {
    const ref = str(m.ref) || null, sha = str(m.sha).toLowerCase();
    const document = HEX64.test(sha) && (() => { try { return !this.#isPhoto(sha); } catch { return false; } })();
    const kind = document ? "document" : "photo";
    if (since === null) return { ref, sha: sha || null, kind, why: SINCE_UNREAD };
    if (!HEX64.test(sha)) return null;
    const after = (at) => !(instantOrder(at, since) < 0);
    try {
      let copies;
      if (document) {
        copies = this.#rows(`SELECT state, sha256, at FROM document_copies WHERE capture=? ORDER BY seq`, sha)
          .filter((d) => after(d.at)).map((d) => (d.state === "copy" ? d.sha256 : null));
      } else {
        const derived = this.#rows(`SELECT through, withdrawal, sha256 FROM photo_copies WHERE capture=? ORDER BY seq`, sha);
        const ofMark = (mark) => derived.find((d) => d.through === mark && d.withdrawal === null);
        const ofWithdrawal = (w) => derived.find((d) => d.withdrawal === w);
        copies = [
          ...this.#rows(`SELECT mark, at FROM photo_marks WHERE capture=?`, sha).filter((r) => after(r.at))
            .map((r) => { const d = ofMark(r.mark); return d ? d.sha256 : null; }),
          ...this.#rows(`SELECT withdrawal, at FROM photo_mark_withdrawals WHERE capture=?`, sha).filter((r) => after(r.at))
            .map((r) => { const d = ofWithdrawal(r.withdrawal); return d ? d.sha256 : null; }),
        ];
      }
      return copies.some((c) => c !== ob.copy) ? { ref, sha, kind, why: COPY_CHANGED_SINCE } : null;
    } catch {
      return { ref, sha, kind, why: document ? DOCUMENT_HISTORY_UNREAD : MARKS_HISTORY_UNREAD };
    }
  }

  /** R21 (T46; N907; K2833, K2949): R5's rows over the interval, as far as `sources` answers it: each `sources:` row
   *  that did not hold, judged as R5 judges it, at `since` or at the read, in row order (the read's answer where both
   *  fail). A source that cannot be read answers its rows lapsed (R5); a `since` that is not record-core's instant
   *  answers every row lapsed. A document stating no `sources:` row answers `[]`. (T47; N947; sources R20) A row that
   *  holds at both is also judged at each instant between them at which a source behind its capture changed
   *  (`sourceChangesSince`, paged through `next`), so a consent withdrawn and given again inside the interval answers it;
   *  a source whose changes cannot be read whole answers its rows lapsed. Synchronous; writes nothing; never throws. */
  sourcesLapsedSince(text, since) {
    try {
      const rows = CaseCarriage.#sourceRows(text);
      if (!rows.length) return [];
      if (!isInstant(since)) return sourceRowsStanding(rows, () => null);
      const atRead = this.#publishable(this.#when(null)), atSince = this.#publishable(since);
      const at = new Map(), instants = new Map();
      const atInstant = (t) => { if (!at.has(t)) at.set(t, this.#publishable(t)); return at.get(t); };
      const out = [];
      for (const r of rows) {
        const now = sourceRowsStanding([r], atRead);
        let lapsed = now.length ? now : sourceRowsStanding([r], atSince);
        if (!lapsed.length) {
          const capture = r && typeof r.capture === "string" ? r.capture : null;
          if (!instants.has(capture)) instants.set(capture, this.#changedAt(capture, since));
          const list = instants.get(capture);
          if (list === null) lapsed = sourceRowsStanding([r], () => null);
          else for (const t of list) { lapsed = sourceRowsStanding([r], atInstant(t)); if (lapsed.length) break; }
        }
        if (lapsed.length) out.push(lapsed[0]);
      }
      return out;
    } catch {
      try { return sourceRowsStanding(CaseCarriage.#sourceRows(text), () => null); } catch { return []; }
    }
  }

  /* R21 (T47; N947; sources R20): the instants after `since` at which a source behind `capture` (its pulled knocks)
     changed, in order, read whole through each source's pages; null when a source's changes cannot be read whole
     (NO_SUCH_SOURCE, an answer not `ok`, `changes: null`, `since_invalid`, a malformed page, a cursor that does not move,
     past the bound, or a read that throws), so its rows lapse (fail closed). */
  #changedAt(capture, since) {
    let ids = [];
    try {
      ids = [...new Set(this.#rows(`SELECT source_id FROM source_knocks WHERE capture_sha=? ORDER BY received, knock_id`, capture)
        .map((k) => k.source_id))];
    } catch { return null; }
    const out = new Set();
    for (const source of ids) {
      let after = null, whole = false;
      for (let page = 0; page < CHANGE_PAGES_MAX; page++) {
        let p = null;
        try { p = this.sources.sourceChangesSince({ source, since, ...(after === null ? {} : { after }), limit: CHANGE_PAGE }); }
        catch { p = null; }
        if (!p || typeof p !== "object" || p.ok !== true || p.since_invalid || !Array.isArray(p.changes)) return null;
        for (const c of p.changes) {
          if (!c || typeof c !== "object" || !isInstant(c.at)) return null;
          out.add(c.at);
        }
        if (p.truncated !== true) { whole = true; break; }
        if (typeof p.next !== "string" || p.next === after || !p.changes.length) return null;
        after = p.next;
      }
      if (!whole) return null;
    }
    return [...out].sort((a, b) => instantOrder(a, b));
  }

  /* R1 (T37; N757; DEC-180 (4)): a photo carried as its copy holds the copy alone, `derived`, kind `obscured`, when
     R11 holds it under that digest for that original; (T39; N806) a member document's copy likewise, where R15 holds
     it; else it is named unheld. */
  #holdCopy(ref, sha, ob, hold, unheld) {
    let r = null;
    try {
      if (HEX64.test(ob.copy) && HEX64.test(sha))
        r = this.#one(`SELECT bytes FROM photo_copies WHERE capture=? AND sha256=? LIMIT 1`, sha, ob.copy)
          || this.#one(`SELECT bytes FROM document_copies WHERE capture=? AND sha256=? AND state='copy' LIMIT 1`, sha, ob.copy);
    } catch { r = null; }
    if (r) hold(ref, "obscured", ob.copy, null, Number.isInteger(r.bytes) ? r.bytes : null, true);
    else unheld.push({ ref: ref || null, kind: "obscured", sha256: ob.copy || null, why: word("case-carriage.why.obscured_copy_held") });
  }

  /* R1, R8, R13 (T38; N779): whether a capture is a photo (R9's term), judged over every home the record holds it on,
     fail closed: an image when any home's provenance records an image type for it, else when none records a type and
     any home's register path has an image's extension. */
  #isPhoto(sha) {
    const homes = this.#homes(sha);
    return this.#judgePhoto(homes.flatMap((h) => this.#entriesFor(h, sha)), homes.map((h) => h.path));
  }

  /* R1 (K5148): the one rule for a photo, over the provenance documents of a capture and its register paths. An image
     when a document's `capture.content_type` is an image type; else when its `profile.format.format` names an image
     (an upload records no content type, only the profile of its bytes), or, with no format, its
     `profile.source_content_type` is an image type; else, when nothing states a type or a format, by the path's
     extension. A format or a type that is not an image wins over the extension. */
  #judgePhoto(docs, paths) {
    const types = docs.map((d) => str(d.capture?.content_type).toLowerCase()).filter(Boolean);
    if (types.some((t) => t.startsWith("image/"))) return true;
    let stated = types.length > 0;
    for (const d of docs) {
      /* format-registry R38 (K5436): bytes no signature names are `unlisted` with no `named`, which states no format; an
         `unlisted` kind it does name is that kind. */
      const f = d.profile?.format, raw = str(f?.format).toLowerCase();
      const fmt = raw === "unlisted" ? str(f?.named).toLowerCase() : raw === "undetermined" ? "" : raw;
      const declared = str(d.profile?.source_content_type).toLowerCase();
      if (IMAGE_FORMATS.has(fmt)) return true;
      if (fmt) stated = true;
      else if (declared) { if (declared.startsWith("image/")) return true; stated = true; }
    }
    return !stated && paths.some((x) => IMAGE_EXT.test(String(x || "")));
  }

  /* R1, R8: every register row homing a capture on a bundle that exists (provenance R48, record-core R37). */
  #homes(sha) {
    try {
      return this.#rows(`SELECT r.bundle_id, r.path, r.bytes FROM register r JOIN bundles b ON b.bundle_id=r.bundle_id
                         WHERE r.capture_sha=? ORDER BY r.bundle_id`, sha);
    } catch { return []; }
  }

  /* R13: whether the register homes a capture on a bundle that exists: true, false, or null when it cannot be read. */
  #held(sha) {
    try {
      return !!this.#one(`SELECT 1 AS x FROM register r JOIN bundles b ON b.bundle_id=r.bundle_id WHERE r.capture_sha=? LIMIT 1`, sha);
    } catch { return null; }
  }

  /* R1, R8: whether acquisition recorded a listing for this capture (it was opened as an archive). */
  #isArchive(sha) {
    try { return !!this.#one(`SELECT 1 AS x FROM archive_entries WHERE archive_sha=? AND idx=-1 LIMIT 1`, sha); }
    catch { return false; }
  }

  /** R8 (T38; N779, K2291 (2); BOB's reading asked in J1): whether an archive holds an image, judged from acquisition's
   *  record of its listing (R38), fail closed. It does when its listing is not recorded or cannot be read; when an
   *  entry that is a file has no name, a name with an image's extension, or a filed capture that is a photo; or when
   *  an entry is itself an archive that holds one (recursively), or is named as an archive and was never opened.
   *  Folders and links hold no bytes of their own. `memo` keeps each archive's verdict for one call. */
  #holdsImage(archive, memo = new Map(), path = new Set()) {
    if (memo.has(archive)) return memo.get(archive);
    if (path.has(archive)) return false;   // a cycle in the records: judged where it began
    path.add(archive);
    let verdict = true;
    try {
      const rows = this.#rows(`SELECT idx, name, kind, state, sha256 FROM archive_entries WHERE archive_sha=? ORDER BY idx`, archive);
      if (rows.some((r) => r.idx === -1)) {
        verdict = rows.filter((r) => r.idx >= 0 && r.kind !== "dir" && r.kind !== "symlink").some((r) => {
          const name = typeof r.name === "string" ? r.name : "";
          if (!name || IMAGE_EXT.test(name)) return true;
          const s = HEX64.test(str(r.sha256).toLowerCase()) ? str(r.sha256).toLowerCase() : null;
          if (s && this.#isPhoto(s)) return true;
          if (s && this.#isArchive(s)) return this.#holdsImage(s, memo, path);
          return ARCHIVE_EXT.test(name);
        });
      }
    } catch { verdict = true; }
    path.delete(archive);
    memo.set(archive, verdict);
    return verdict;
  }

  /* ---- the marks on a photo and its copy (R9–R13; T37, N757, DEC-180 (2)–(5), K2108, K2206) ---- */

  /* R9, R10: the photo `sha` as `viewer` may see it: `{ok: true, sha, photo}` or NO_SUCH_PHOTO. Held means a register
     row homes it on a bundle that exists; seen means membership's sight admits `viewer` to one such bundle. A photo is
     told as R1 tells it (`#judgePhoto`). */
  #photo(captureSha, viewer) {
    const sha = digestOf(captureSha);
    const none = () => refusal("NO_SUCH_PHOTO", localize("case-carriage.index.no_photo_you_can_see", "no photo you can see is held under that digest"), { capture: HEX64.test(sha) ? sha : null });
    if (!HEX64.test(sha) || typeof viewer !== "string" || !viewer.trim()) return none();
    let homes = [];
    try {
      homes = this.#rows(`SELECT r.bundle_id, r.path FROM register r JOIN bundles b ON b.bundle_id=r.bundle_id
                          WHERE r.capture_sha=? ORDER BY r.bundle_id`, sha);
    } catch { homes = []; }
    let seen = null;
    for (const h of homes) {
      let ok = false;
      try { ok = !!this.membership && this.membership.inSight(h.bundle_id, viewer.trim()) === true; } catch { ok = false; }
      if (ok) { seen = h; break; }
    }
    if (!seen) return none();
    const photo = this.#judgePhoto(this.#entriesFor(seen, sha), [seen.path]);
    return { ok: true, sha, photo };
  }

  /* R10: the marks a photo holds, oldest first, each with its withdrawal or null, and its latest derivation. Throws when
     they cannot be read (each caller fails closed). */
  #marksOf(sha) {
    const out = this.#rows(`SELECT mark, areas, by, at FROM photo_marks WHERE capture=? ORDER BY mark`, sha);
    const gone = new Map(this.#rows(`SELECT mark, reason, by, at FROM photo_mark_withdrawals WHERE capture=?`, sha)
      .map((w) => [w.mark, { by: w.by, at: w.at, reason: w.reason }]));
    const marks = out.map((r) => ({ mark: r.mark, areas: JSON.parse(r.areas), by: r.by, at: r.at, withdrawn: gone.get(r.mark) ?? null }));
    const last = this.#one(`SELECT * FROM photo_copies WHERE capture=? ORDER BY seq DESC LIMIT 1`, sha);
    return { marks, last };
  }

  /* R10, R11 (T38; DEC-183 (2)): a photo's state over the marks that stand, and its copy and refusal from the latest
     derivation, which follows the latest act while any mark stands; with none standing, no copy. */
  static #view(marks, last) {
    const standing = marks.filter((m) => !m.withdrawn);
    const marked = standing.some((m) => Array.isArray(m.areas) && m.areas.length);
    const state = marked ? "marked" : standing.length ? "nothing_to_obscure" : "unchecked";
    const derived = standing.length && last ? last : null;
    const copy = derived && derived.sha256
      ? { sha256: derived.sha256, covered: derived.covered, width: derived.width, height: derived.height } : null;
    const refused = derived && derived.refused_code ? { code: derived.refused_code, detail: derived.refused_detail ?? null } : null;
    /* R22 (T47; N953; case-grammar R12, R31): the row's `obscured` object, marker included, whole for the writer */
    const obscured = copy ? { copy: copy.sha256, label: marked ? OBSCURED_LABEL : PUBLISHED_LABEL, marked, kind: "photo" } : null;
    return { state, copy, refused, ...(obscured ? { obscured } : {}) };
  }

  /** R10 (`op=photomarks`): a photo's marks and its copy, to a member who may see it: `{ok: true, capture, photo: true,
   *  state, marks, copy, refused}`, each mark `{mark, areas, by, at, withdrawn}` (`withdrawn` `{by, at, reason}` or
   *  null; T38); `{ok: true, capture, photo: false}` for a capture that is not an image; NO_SUCH_PHOTO for one not held
   *  or not seen. Synchronous; reads only this module's and the record's tables; writes nothing; never throws. */
  photoMarks({ captureSha, viewer } = {}) {
    try {
      const p = this.#photo(captureSha, viewer);
      if (!p.ok) return p;
      if (!p.photo) return { ok: true, capture: p.sha, photo: false };
      const { marks, last } = this.#marksOf(p.sha);
      return { ok: true, capture: p.sha, photo: true, ...CaseCarriage.#view(marks, last), marks };
    } catch {
      return refusal("NO_SUCH_PHOTO", localize("case-carriage.index.no_photo_you_can_see", "no photo you can see is held under that digest"), { capture: null });
    }
  }

  /** R9 (`op=obscuremark`): records one mark on a photo, then derives its copy from the marks that stand (R11), and
   *  answers as R10 does after the act, with `mark`. Refusals, in order, each writing nothing: MACHINE_CANNOT_MARK_PHOTO
   *  (N790), NO_SUCH_PHOTO, NOT_A_PHOTO, MARK_MALFORMED (naming the area), STAFF_MARK_NO_REASON, image-cover's
   *  AREA_OUTSIDE (its detail relayed). No act changes or erases a mark (R12). Answers a Promise (image-cover's cover is
   *  asynchronous); never rejects. */
  async obscureMark({ captureSha, areas, by } = {}) {
    try {
      if (typeof by !== "string" || !by.trim() || isMachineIdentity(by))
        return refusal("MACHINE_CANNOT_MARK_PHOTO", localize("case-carriage.index.a_mark_is_made_by", "a mark is made by a member; an assistant's proposal of areas is not a mark"));
      const p = this.#photo(captureSha, by);
      if (!p.ok) return p;
      if (!p.photo) return refusal("NOT_A_PHOTO", localize("case-carriage.index.that_capture_is_not", "that capture is not an image"), { capture: p.sha });
      const bad = (area, detail) => refusal("MARK_MALFORMED", detail, { capture: p.sha, area });
      if (!Array.isArray(areas)) return bad(null, localize("case-carriage.index.areas_is_not_a_list", "areas is not a list"));
      if (areas.length > MARK_AREAS_MAX) return bad(null, localize("case-carriage.index.a_mark_holds_at_most", "a mark holds at most {MARK_AREAS_MAX} areas", { MARK_AREAS_MAX: String(MARK_AREAS_MAX) }));
      const clean = [];
      for (const [i, a] of areas.entries()) {
        if (!a || typeof a !== "object" || Array.isArray(a)) return bad(i, localize("case-carriage.index.area_i_is_not_an", "area {i} is not an object {rect, kind, reason?}", { i: String(i) }));
        const r = a.rect;
        if (!Array.isArray(r) || r.length !== 4 || !r.every((v) => Number.isSafeInteger(v)) || !(r[0] < r[2] && r[1] < r[3]))
          return bad(i, `area ${i}'s rect is not four integers [x0, y0, x1, y1] with x0 < x1 and y0 < y1`);
        if (!MARK_KINDS.includes(a.kind)) return bad(i, localize("case-carriage.index.area_i_s_kind_is", "area {i}'s kind is not one of {MARK_KINDS}", { i: String(i), MARK_KINDS: String(MARK_KINDS.join(", ")) }));
        clean.push({ rect: [...r], kind: a.kind, ...(a.reason !== undefined ? { reason: a.reason } : {}) });
      }
      for (const [i, a] of clean.entries())
        if (a.kind === "staff" && !(typeof a.reason === "string" && a.reason.trim() && a.reason.length <= STAFF_REASON_MAX))
          return refusal("STAFF_MARK_NO_REASON", localize("case-carriage.index.area_i_obscures_a_staff", "area {i} obscures a staff member with no reason of 1 to {STAFF_REASON_MAX} characters", { i: String(i), STAFF_REASON_MAX: String(STAFF_REASON_MAX) }),
                         { capture: p.sha, area: i });
      for (const a of clean) if (a.kind !== "staff") delete a.reason;
      return await this.#serially(p.sha, () => this.#mark(p.sha, clean, by.trim()));
    } catch {
      return refusal("NO_SUCH_PHOTO", localize("case-carriage.index.no_photo_you_can_see", "no photo you can see is held under that digest"), { capture: null });
    }
  }

  /** R14 (`op=obscuremarkwithdraw`; T38, N788, DEC-183 (2)): withdraws one mark on a photo, by its maker or any member
   *  who may see the photo, records the withdrawal beside the mark (R12), re-derives the copy from the marks that stand
   *  (R11) and answers as R10 does after the act, with `mark` and `withdrawal`. Refusals, in order, each writing
   *  nothing: MACHINE_CANNOT_WITHDRAW_MARK, NO_SUCH_PHOTO, NO_SUCH_MARK, MARK_ALREADY_WITHDRAWN (naming when and by
   *  whom), WITHDRAW_NO_REASON. Answers a Promise; never rejects. */
  async obscureMarkWithdraw({ captureSha, mark, reason, by } = {}) {
    try {
      if (typeof by !== "string" || !by.trim() || isMachineIdentity(by))
        return refusal("MACHINE_CANNOT_WITHDRAW_MARK", localize("case-carriage.index.a_mark_is_withdrawn", "a mark is withdrawn by a member, never by an assistant or the daemon"));
      const p = this.#photo(captureSha, by);
      if (!p.ok) return p;
      const id = typeof mark === "string" && /^\d+$/.test(mark.trim()) ? Number(mark.trim()) : mark;
      return await this.#serially(p.sha, () => this.#withdraw(p.sha, id, reason, by.trim()));
    } catch {
      return refusal("NO_SUCH_PHOTO", localize("case-carriage.index.no_photo_you_can_see", "no photo you can see is held under that digest"), { capture: null });
    }
  }

  /* R14: the checks that read the marks, and the act, inside the capture's chain, so two withdrawals of one mark
     cannot both be recorded. */
  async #withdraw(sha, id, reason, by) {
    const own = Number.isSafeInteger(id) && id > 0
      ? this.#one(`SELECT mark FROM photo_marks WHERE capture=? AND mark=?`, sha, id) : null;
    /* (T40; DEC-187 (3)) the words' `{photo}` is the photo named, carried beside them */
    if (!own) return refusal("NO_SUCH_MARK", localize("case-carriage.index.no_mark_of_that", "no mark of that number is on that photo"),
                             { capture: sha, mark: Number.isSafeInteger(id) ? id : null, photo: sha });
    const prior = this.#one(`SELECT withdrawal, by, at FROM photo_mark_withdrawals WHERE mark=?`, id);
    if (prior) return refusal("MARK_ALREADY_WITHDRAWN", localize("case-carriage.index.mark_id_was_withdrawn_at", "mark {id} was withdrawn at {at} by {by}", { id: String(id), at: String(prior.at), by: String(prior.by) }),
                              { capture: sha, mark: id, withdrawn: { by: prior.by, at: prior.at }, member: prior.by, date: prior.at });
    if (!(typeof reason === "string" && reason.trim() && reason.length <= WITHDRAW_REASON_MAX))
      return refusal("WITHDRAW_NO_REASON", localize("case-carriage.index.a_withdrawal_gives_a_reason", "a withdrawal gives a reason of 1 to {WITHDRAW_REASON_MAX} characters", { WITHDRAW_REASON_MAX: String(WITHDRAW_REASON_MAX) }), { capture: sha, mark: id });
    const { marks } = this.#marksOf(sha);
    const standing = marks.filter((m) => !m.withdrawn && m.mark !== id);
    const derivation = standing.length ? await this.#derive(sha, standing.flatMap((m) => m.areas).map((a) => a.rect), Infinity) : null;
    const at = this.#instant();
    let withdrawal = null;
    this.record.transact(() => {
      this.sql.exec(`INSERT INTO photo_mark_withdrawals (mark, capture, reason, by, at) VALUES (?,?,?,?,?)`, id, sha, reason, by, at);
      withdrawal = this.#one(`SELECT last_insert_rowid() AS id`).id;
      if (derivation) this.#writeDerivation(sha, standing.at(-1).mark, withdrawal, derivation.row, at);
    });
    const after = this.#marksOf(sha);
    return { ok: true, mark: id, withdrawal, capture: sha, photo: true, ...CaseCarriage.#view(after.marks, after.last), marks: after.marks };
  }

  /* R11: one derivation at a time per capture, so each act's copy covers exactly the marks standing after it. */
  #serially(sha, fn) {
    const prev = this.#chains.get(sha) || Promise.resolve();
    const run = prev.then(fn, fn);
    const tail = run.then(() => {}, () => {});
    this.#chains.set(sha, tail);
    tail.then(() => { if (this.#chains.get(sha) === tail) this.#chains.delete(sha); });
    return run;
  }

  /* R9, R11: derive the copy over every area of the marks that stand with this mark's added (none: a copy with nothing
     covered), then record the mark and the derivation together. AREA_OUTSIDE records nothing; another refusal of
     image-cover's records the mark and names it; no bytes to read, or no bucket to hold the copy in, records the mark
     with no copy (fail closed). */
  async #mark(sha, areas, by) {
    const { marks } = this.#marksOf(sha);
    const before = marks.filter((m) => !m.withdrawn).flatMap((m) => (Array.isArray(m.areas) ? m.areas : [])).map((a) => a.rect);
    const d = await this.#derive(sha, [...before, ...areas.map((a) => a.rect)], before.length);
    if (d.refusal) return d.refusal;
    const at = this.#instant();
    let mark = null;
    this.record.transact(() => {
      this.sql.exec(`INSERT INTO photo_marks (capture, areas, by, at) VALUES (?,?,?,?)`, sha, JSON.stringify(areas), by, at);
      mark = this.#one(`SELECT last_insert_rowid() AS id`).id;
      this.#writeDerivation(sha, mark, null, d.row, at);
    });
    const after = this.#marksOf(sha);
    return { ok: true, mark, capture: sha, photo: true, ...CaseCarriage.#view(after.marks, after.last), marks: after.marks };
  }

  /* R11: the copy over `rects` (`[]` covers nothing): `{row}` to record, or `{refusal}` for image-cover's AREA_OUTSIDE,
     naming the area among the act's own (those after the first `before`). */
  async #derive(sha, rects, before) {
    const row = { sha256: null, bytes: null, covered: null, width: null, height: null, refused_code: null, refused_detail: null };
    const original = await this.#original(sha);
    if (original && original.tooLarge) {
      row.refused_code = "PHOTO_TOO_LARGE";
      row.refused_detail = `the photo is ${original.size} bytes, over the ${COVER_MAX_BYTES} a copy is made from`;
    } else if (original) {
      let c = null;
      try { c = await this.cover(original.bytes, { areas: rects }); } catch { c = null; }
      if (c && c.ok === false && c.code === "AREA_OUTSIDE" && rects.length > before)
        return { refusal: refusal("AREA_OUTSIDE", typeof c.detail === "string" ? c.detail : localize("case-carriage.index.an_area_lies_wholly", "an area lies wholly outside the picture"),
                                  { capture: sha, ...areaOf(c.detail, before) }) };
      if (c && c.ok === false && COVER_REFUSED.has(c.code)) {
        row.refused_code = c.code;
        row.refused_detail = typeof c.detail === "string" ? c.detail : null;
      } else if (c && c.ok === true && c.bytes instanceof Uint8Array) {
        const copySha = await this.#digest(c.bytes);
        if (await this.#holdCopyBytes(copySha, c.bytes, sha, rects.length > 0))
          Object.assign(row, { sha256: copySha, bytes: c.bytes.length, covered: c.covered, width: c.width, height: c.height });
      }
    }
    return { row };
  }

  /* R11: one derivation row, inside the act's transaction. */
  #writeDerivation(sha, through, withdrawal, d, at) {
    this.sql.exec(`INSERT INTO photo_copies (capture, through, withdrawal, sha256, bytes, covered, width, height, refused_code,
                   refused_detail, at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`, sha, through, withdrawal, d.sha256, d.bytes, d.covered,
                  d.width, d.height, d.refused_code, d.refused_detail, at);
  }

  /* R11: the original's bytes, from the evidence store by digest (record-core R38): `{bytes}`, `{tooLarge, size}` when
     the store states more than image-cover covers (nothing over the bound is fetched), or null when none can be read. */
  async #original(sha) {
    let ev = null;
    try { ev = this.record.evidenceStore(); } catch { ev = null; }
    if (!ev) return null;
    try {
      const h = await ev.head(sha);
      if (h && Number.isFinite(h.size) && h.size > COVER_MAX_BYTES) return { tooLarge: true, size: h.size };
      const o = await ev.get(sha);
      if (!o || typeof o.arrayBuffer !== "function") return null;
      const bytes = new Uint8Array(await o.arrayBuffer());
      if (bytes.length > COVER_MAX_BYTES) return { tooLarge: true, size: bytes.length };
      return (await this.#digest(bytes)) === sha ? { bytes } : null;
    } catch { return null; }
  }

  /* R11: the copy, held under its own digest at `<store>/obscured/<sha>`, labelled derived and naming its original,
     its stored label OBSCURED_LABEL when it covers an area, else (T40; DEC-185 (1), K2248) PUBLISHED_LABEL; never
     registered, never a capture. True when held. */
  async #holdCopyBytes(copySha, bytes, original, covers) {
    return this.#putDerived(copySha, bytes, { derived: "obscured", original, label: covers ? OBSCURED_LABEL : PUBLISHED_LABEL });
  }

  /* R11, R15: a derived copy's bytes at `<store>/obscured/<sha>` with its labels; true when held. */
  async #putDerived(copySha, bytes, customMetadata) {
    if (!this.bucket) return false;
    let ns = "bio";
    try { const s = typeof this.store === "function" ? this.store() : this.store; if (str(s)) ns = str(s); } catch { ns = "bio"; }
    try {
      await this.bucket.put(obscuredKey(ns, copySha), bytes, { sha256: copySha, customMetadata });
      return true;
    } catch { return false; }
  }

  /* R11, R15 (T51; R24 b2, K5057): the SHA-256 of a read file's bytes: the platform's native digest over
     NATIVE_DIGEST_MIN_BYTES, the pure-JS hash for a smaller input or when the native digest fails or answers no digest.
     Both answer the same lower-case hex; an identifier, so nothing stored changes. */
  async #digest(bytes) {
    if (bytes.length > NATIVE_DIGEST_MIN_BYTES) {
      try { const h = await this.nativeDigest(bytes); if (typeof h === "string" && HEX64.test(h)) return h; } catch { /* the JS hash decides */ }
    }
    return this.jsDigest(bytes);
  }

  /* R9: record-core's instant, from the module's clock. */
  #instant() {
    let ms = NaN;
    try { ms = Date.parse(this.now()); } catch { ms = NaN; }
    return stampInstant("millisecond", Number.isFinite(ms) ? ms : Date.now());
  }

  /** R13 (T37; N757; K2206; T38: N779, DEC-183 (2)): the `materials:` rows whose photo's marks no longer match what the
   *  row states: a row stating `obscured` whose copy is not the photo's current copy (so a withdrawal since preparation
   *  is a lapse), and a photo row carried whole (`included: true`), always; each `{ref, sha, why}`, at most 200; `[]`
   *  when none; a document this copy fetched, carried whole, never lapses here (B3, K2308; T39). Marks that cannot be read
   *  answer the row lapsed (fail closed). Each `why` names its cause: a mark added or withdrawn since preparation, a
   *  photo carried whole, or marks unreadable. (T39; N806, K2333) Each row names its `kind`, `photo` or `document`: a
   *  member document's row lapses when it states a copy that is not the document's current copy (R16), when it carries
   *  the document whole and its state is not `clean`, and when its state cannot be read (fail closed). Synchronous;
   *  writes nothing; never throws. */
  marksLapsed(fm) {
    const out = [];
    for (const m of this.#materialRows(fm)) {
      let e = null;
      try { e = this.#lapsedNow(m); } catch { e = { ref: str(m.ref) || null, sha: str(m.sha).toLowerCase() || null, kind: "photo", why: MARKS_UNREAD }; }
      if (e) out.push(e);
      if (out.length >= MARKS_LAPSED_MAX) break;
    }
    return out;
  }

  /* R13, R20: the `materials:` rows that may lapse here: every row but an observation's, stating `obscured` or
     carried whole. */
  #materialRows(fm) {
    let rows = null;
    try { const m = materialsOf(fm); rows = m && Array.isArray(m.materials) ? m.materials : null; } catch { rows = null; }
    return (Array.isArray(rows) ? rows : []).filter((m) => m && typeof m === "object" && m.kind !== "observation"
      && (obscuredOf(m) || m.included === true || m.included === "true"));
  }

  /* R13: one row's lapse at the read, `{ref, sha, kind, why}`, or null when it stands. */
  #lapsedNow(m) {
    const ob = obscuredOf(m);
    const ref = str(m.ref) || null, sha = str(m.sha).toLowerCase();
    if (!ob) {
      if (!HEX64.test(sha)) return null;
      if (this.#isPhoto(sha)) return { ref, sha, kind: "photo", why: PHOTO_ONLY_AS_COPY };
      /* (T39; N806) a member document carried whole stands only while its state is `clean`; a digest the record
         holds no capture under is no member document (R1 answers it unheld, never refused) */
      const held = this.#held(sha);
      const member = held === false ? null : held === null ? UNDETERMINED : this.#memberOf(sha);
      if (member && member.state === "undetermined") return { ref, sha, kind: "document", why: DOCUMENT_UNREAD };
      if (member && member.state !== "clean") return { ref, sha, kind: "document", why: MEMBER_DOCUMENT_ONLY_AS_COPY };
      return null;
    }
    /* (T39; N806) a row carrying a member document's copy: it stands while that copy is the document's current one */
    if (HEX64.test(sha) && !this.#isPhoto(sha)) {
      let s = UNDETERMINED;
      try { s = this.#documentState(sha); } catch { s = UNDETERMINED; }
      if (s.state === "undetermined") return { ref, sha, kind: "document", why: DOCUMENT_UNREAD };
      if (!(s.state === "copy" && s.copy === ob.copy))
        return { ref, sha, kind: "document", why: word("case-carriage.why.document_copy_longer") };
      return null;
    }
    let view = null;
    try {
      const { marks, last } = this.#marksOf(sha);
      view = CaseCarriage.#view(marks, last);
    } catch { view = null; }
    if (!view) return { ref, sha: sha || null, kind: "photo", why: MARKS_UNREAD };
    if (!(view.copy && view.copy.sha256 === ob.copy))
      return { ref, sha, kind: "photo", why: word("case-carriage.why.mark_photo_added") };
    return null;
  }

  /* ---- a member document and its copy (R15–R17; T39, N806, K2315, K2333) ---- */

  /* R15, R16: provenance R62 for one capture: true when this copy fetched it, false when not, null when it cannot be
     asked (fail closed: never read as fetched). */
  #fetched(sha) {
    try {
      const p = this.provenance;
      const a = p && typeof p.fetchedByThisCopy === "function" ? p.fetchedByThisCopy(sha) : null;
      return a && typeof a === "object" && typeof a.fetched === "boolean" ? a.fetched : null;
    } catch { return null; }
  }

  /* R16: a capture's state from this module's tables and R62 alone, writing nothing: `{state, copy, refused}`, with
     `missing` when it is a member document neither queued nor derived. Throws when the tables cannot be read. */
  #documentState(sha) {
    if (this.#isPhoto(sha)) return { state: "photo", copy: null, refused: null };
    const fetched = this.#fetched(sha);
    if (fetched === null) return UNDETERMINED;
    if (fetched) return { state: "public", copy: null, refused: null };
    const last = this.#one(`SELECT state, sha256, refused_code, refused_detail FROM document_copies WHERE capture=?
                            ORDER BY seq DESC LIMIT 1`, sha);
    if (last && last.state === "clean") return { state: "clean", copy: null, refused: null };
    if (last && last.state === "copy" && HEX64.test(String(last.sha256 ?? ""))) return { state: "copy", copy: last.sha256, refused: null };
    if (last && last.state === "refused")
      return { state: "refused", copy: null, refused: { code: last.refused_code ?? null, detail: last.refused_detail ?? null } };
    const queued = !!this.#one(`SELECT 1 AS x FROM document_copy_queue WHERE capture=?`, sha);
    return queued ? { state: "pending", copy: null, refused: null } : { state: "pending", copy: null, refused: null, missing: true };
  }

  /* R1, R13: a capture's state when it is a member document (R15's term), else null (fetched, or a photo); its state
     `undetermined` when it cannot be read. Writes nothing. */
  #memberOf(sha) {
    let s = UNDETERMINED;
    try { s = this.#documentState(sha); } catch { s = UNDETERMINED; }
    return s.state === "public" || s.state === "photo" ? null : s;
  }

  /** R16 (T39; N806, K2333): a capture's copy state, synchronously, from this module's tables and provenance R62 alone
   *  (no bucket read), for `case-disclosures` R6 inside a preparation's transaction: `{state, copy, refused}`, `state`
   *  `public` (fetched by this copy: carried as captured), `clean` (carried whole), `copy` (`copy` the cleaned copy's
   *  SHA-256), `refused` (`refused` doc-clean's `{code, detail}`), `pending` (queued), `undetermined` (its tables or
   *  R62 could not be read: fail closed) or `photo` (its copy is R10's). A member document neither queued nor derived
   *  is queued (R15) and answered `pending`: the one write it makes. Never throws. */
  documentCopy(captureSha) {
    try {
      const sha = digestOf(captureSha);
      if (!HEX64.test(sha)) return { ...UNDETERMINED };
      const s = this.#documentState(sha);
      if (s.missing) this.#enqueue(sha);
      /* R22 (T47; N953; case-grammar R12, R31): a copy's row object, its marker `document` */
      return { state: s.state, copy: s.copy, refused: s.refused,
               ...(s.state === "copy" ? { obscured: { copy: s.copy, label: COPY_CLEANED_LABEL, kind: "document" } } : {}) };
    } catch { return { ...UNDETERMINED }; }
  }

  /* R15: one queue row for `sha`, inside whatever transaction is open (the act's); when it is new, R17's listeners are
     told after the act commits. Throws when the row cannot be written. */
  #enqueue(sha) {
    this.sql.exec(`INSERT OR IGNORE INTO document_copy_queue (capture, queued) VALUES (?, ?)`, sha, this.#when(null));
    const added = Number((this.#one(`SELECT changes() AS n`) || {}).n) > 0;
    if (added) this.#armCopyWork();
    return added;
  }

  /* R17: after the act commits (record-core R66), every registered listener is called once with `{at}`, R15's
     `copyWake` as it then stands; one that throws or rejects changes nothing of the act. No call names a member or a
     file. */
  #armCopyWork() {
    if (!this.#copyWork.length) return;
    const notify = () => {
      let at = null;
      try { at = this.copyWake(this.#nowMs()); } catch { at = null; }
      for (const l of this.#copyWork) {
        try { const r = l.fn({ at }); if (r && typeof r.catch === "function") r.catch(() => {}); } catch { /* R17: nothing of the act */ }
      }
    };
    try { if (this.record && typeof this.record.afterCommit === "function") this.record.afterCommit(notify); else notify(); } catch { /* never the act's */ }
  }

  /* The module's clock, in milliseconds. */
  #nowMs() {
    let ms = NaN;
    try { ms = Date.parse(this.now()); } catch { ms = NaN; }
    return Number.isFinite(ms) ? ms : Date.now();
  }

  /** R15 (T39), R18 (T40; N818, K2383): registers the receipt listener with provenance (its R47), once; the factory
   *  calls it at creation. A refused registration (an answer that is not `{ok: true}`, one that throws, or no `onReceipt`
   *  to ask) is a start-up fault: kept, answered by `faults()`, and logged, as `scheduler`'s are (its R23), never
   *  ignored. Answers the registration's answer, or the refusal it stood for. */
  start() {
    let r;
    try {
      const p = this.provenance;
      r = p && typeof p.onReceipt === "function" ? p.onReceipt("case-carriage", (e) => this.#onReceipt(e))
        : { ok: false, reason: "NO_RECEIPT_NOTICE", detail: localize("case-carriage.index.no_provenance_onreceipt", "no provenance onReceipt to register the receipt listener with") };
    } catch (e) {
      r = { ok: false, reason: "REGISTRATION_THREW", detail: String((e && e.message) || e) };
    }
    if (!(r && typeof r === "object" && r.ok === true)) {
      const refused = r && typeof r === "object" ? r : { ok: false, reason: "REGISTRATION_UNANSWERED", detail: localize("case-carriage.index.the_registration_answered_string", "the registration answered {String}", { String: String(String(r)) }) };
      this.#fault("onReceipt", refused);
      return refused;
    }
    return r;
  }

  /* R18: a refused registration kept as a start-up fault and logged (as `scheduler` R23). */
  #fault(notice, r) {
    const fault = { notice, reason: r.reason ?? r.code ?? null, detail: typeof r.detail === "string" ? r.detail : r.detail ?? null };
    this.#faults.push(fault);
    try { console.error(`case-carriage: the ${notice} notice refused its registration`, JSON.stringify(fault)); } catch { /* logged where it can be */ }
  }

  /** R18 (T40; N818, K2383): the start-up faults, each `{notice: "onReceipt", reason, detail}`. Writes nothing; never
   *  throws. */
  faults() {
    try { return this.#faults.map((f) => ({ ...f })); } catch { return []; }
  }

  /** R17 (T39; N806): a later module (`scheduler`, its R25) registers once at start to be told when a member document
   *  is queued; a second registration by one module, or a `fn` that is not a function, is refused through membership's
   *  `listenerRefusal` (its R81). */
  onCopyWork(module, fn) {
    const refused = listenerRefusal(this.#copyWork, module, fn);
    if (refused) return refused;
    this.#copyWork.push({ module, fn });
    return { ok: true, module };
  }

  /* R15: provenance R47's listener: a receipt that is not a fetch (its `via` not in FETCHED_VIAS, R62) queues its
     capture, once per digest, inside the receipt's transaction; one already derived is not queued again. It never
     refuses, delays or fails the receipt. */
  #onReceipt(event) {
    try {
      const via = String((event && event.via) || "direct");
      const sha = digestOf(event && event.capture_sha);
      if (FETCHED_VIAS.includes(via) || !HEX64.test(sha)) return { ok: true, queued: false };
      if (this.#one(`SELECT 1 AS x FROM document_copies WHERE capture=? LIMIT 1`, sha)) return { ok: true, queued: false };
      return { ok: true, queued: this.#enqueue(sha) };
    } catch { return { ok: true, queued: false }; }
  }

  /** R15 (T39; N806, K2333; the scheduler's wake, no route): derives the copies of queued member documents, oldest
   *  first, at most `limit` (default and bound DOCUMENT_COPY_BATCH_MAX), skipping one whose failed read is not yet
   *  DOCUMENT_COPY_RETRY_MS old. Each is asked R62 again (fetched since: recorded `public`, no copy); one whose
   *  register byte count is over doc-clean's CLEAN_MAX_BYTES is recorded refused `DOCUMENT_TOO_LARGE` unread; else its
   *  bytes are read from the evidence store by digest and cleaned: `clean` recorded with no copy, a copy held at
   *  `<store>/obscured/<sha>` (labelled derived, naming its original; never registered, never a capture) and recorded,
   *  a refusal recorded with doc-clean's `{code, detail}`. A read that fails, or a copy that cannot be held, leaves the
   *  document queued and stamps the try. A photo found queued leaves the queue (its copy is R11's). Answers
   *  `{ok: true, copied, clean, public, refused, failed, remaining}`, or DOCUMENT_COPY_NO_STORE (deriving nothing)
   *  with no evidence store or bucket bound. No act changes, replaces or hides the original. Never rejects. */
  copyBatch({ limit = null } = {}) {
    return this.#serially("\u0000copyBatch", () => this.#copyBatch(limit)).catch(() =>
      ({ ok: true, copied: 0, clean: 0, public: 0, refused: 0, failed: 0, remaining: this.#queued() }));
  }

  async #copyBatch(limit) {
    let ev = null;
    try { ev = this.record.evidenceStore(); } catch { ev = null; }
    if (!ev || !this.bucket)
      return refusal("DOCUMENT_COPY_NO_STORE", localize("case-carriage.index.no_evidence_store_is", "no evidence store is bound to read a member's document from and hold its copy in"));
    const n = Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, DOCUMENT_COPY_BATCH_MAX) : DOCUMENT_COPY_BATCH_MAX;
    const now = this.#nowMs();
    const due = this.#rows(`SELECT capture, queued, tried FROM document_copy_queue ORDER BY queued, capture`)
      .filter((q) => q.tried == null || !(Date.parse(q.tried) + DOCUMENT_COPY_RETRY_MS > now)).slice(0, n);
    const { skipped, ...out } = await this.#copyRows(due, ev, Infinity);   // nothing is skipped without a bound
    return { ...out, remaining: this.#queued() };
  }

  /* R15: the outcomes of `due`, each recorded as it is made: `{ok, copied, clean, public, refused, failed, skipped}`.
     A document over `maxBytes` (its register count, or the store's size) is `skipped`, left queued and untouched. */
  async #copyRows(due, ev, maxBytes) {
    const out = { ok: true, copied: 0, clean: 0, public: 0, refused: 0, failed: 0, skipped: 0 };
    for (const q of due) {
      let r = null;
      try { r = await this.#copyOne(q.capture, ev, maxBytes); } catch { r = null; }
      try {
        const at = this.#when(null);
        if (r && r.skipped) out.skipped++;
        else if (!r || r.failed) {
          this.sql.exec(`UPDATE document_copy_queue SET tried=? WHERE capture=?`, at, q.capture);
          out.failed++;
        } else this.record.transact(() => {
          if (!r.photo)
            this.sql.exec(`INSERT INTO document_copies (capture, state, sha256, bytes, format, refused_code, refused_detail, at)
                           VALUES (?,?,?,?,?,?,?,?)`, q.capture, r.state, r.sha256 ?? null, r.bytes ?? null, r.format ?? null,
                          r.code ?? null, r.detail ?? null, at);
          this.sql.exec(`DELETE FROM document_copy_queue WHERE capture=?`, q.capture);
          if (!r.photo) out[r.state === "copy" ? "copied" : r.state]++;
        });
      } catch { out.failed++; }
    }
    return out;
  }

  /** R15 (T51; K4570 G9): the awaited, bounded `copyBatch` for named documents, for an act that must not answer
   *  `pending` for a small file (`case-authoring`'s prepare). Of `shas` it takes those queued (R15, R16), each as
   *  `copyBatch` makes it, except a document over `maxBytes` (default and bound COPY_NOW_MAX_BYTES), by its register
   *  byte count or the store's size: that is answered `skipped`, not read, and stays queued for the alarm. It ignores
   *  the retry delay (the act asked) and is serial with `copyBatch`. Answers `{ok: true, copied, clean, public, refused,
   *  failed, skipped, remaining}`, or DOCUMENT_COPY_NO_STORE as `copyBatch` does. Never rejects; `documentCopy` stays
   *  synchronous. */
  copyNow(args) {
    const { shas = [], maxBytes = COPY_NOW_MAX_BYTES } = args && typeof args === "object" ? args : {};
    return this.#serially("\u0000copyBatch", () => this.#copyNow(shas, maxBytes)).catch(() =>
      ({ ok: true, copied: 0, clean: 0, public: 0, refused: 0, failed: 0, skipped: 0, remaining: this.#queued() }));
  }

  async #copyNow(shas, maxBytes) {
    let ev = null;
    try { ev = this.record.evidenceStore(); } catch { ev = null; }
    if (!ev || !this.bucket)
      return refusal("DOCUMENT_COPY_NO_STORE", localize("case-carriage.index.no_evidence_store_is", "no evidence store is bound to read a member's document from and hold its copy in"));
    const bound = Number.isFinite(maxBytes) && maxBytes > 0 ? Math.min(maxBytes, COPY_NOW_MAX_BYTES) : COPY_NOW_MAX_BYTES;
    const named = new Set((Array.isArray(shas) ? shas : []).map(digestOf).filter((d) => HEX64.test(d)));
    const due = this.#rows(`SELECT capture, queued, tried FROM document_copy_queue ORDER BY queued, capture`)
      .filter((q) => named.has(q.capture));
    return { ...(await this.#copyRows(due, ev, bound)), remaining: this.#queued() };
  }

  /* R15: the count of documents still queued (null when it cannot be read). */
  #queued() {
    try { return Number(this.#one(`SELECT COUNT(*) AS n FROM document_copy_queue`).n); } catch { return null; }
  }

  /* R15: one queued capture's outcome: `{photo}`, `{state, ...}` to record, or `{failed}` to try again later. */
  async #copyOne(sha, ev, maxBytes = Infinity) {
    if (this.#isPhoto(sha)) return { photo: true };
    const fetched = this.#fetched(sha);
    if (fetched === null) return { failed: true };
    if (fetched) return { state: "public" };
    const tooLarge = (size) => ({ state: "refused", code: "DOCUMENT_TOO_LARGE",
      detail: localize("case-carriage.index.the_document_is_size_bytes", "the document is {size} bytes, over the {CLEAN_MAX_BYTES} a copy is made from", { size: String(size), CLEAN_MAX_BYTES: String(CLEAN_MAX_BYTES) }) });
    const stated = Math.max(-1, ...this.#homes(sha).map((h) => Number(h.bytes)).filter(Number.isFinite));
    if (stated > maxBytes) return { skipped: true };   // `copyNow`'s bound: left queued, for the alarm
    if (stated > CLEAN_MAX_BYTES) return tooLarge(stated);
    let bytes = null;
    try {
      const h = await ev.head(sha);
      if (h && Number.isFinite(h.size) && h.size > maxBytes) return { skipped: true };
      if (h && Number.isFinite(h.size) && h.size > CLEAN_MAX_BYTES) return tooLarge(h.size);
      const o = await ev.get(sha);
      if (o && typeof o.arrayBuffer === "function") bytes = new Uint8Array(await o.arrayBuffer());
    } catch { bytes = null; }
    if (!bytes || (await this.#digest(bytes)) !== sha) return { failed: true };
    if (bytes.length > maxBytes) return { skipped: true };
    if (bytes.length > CLEAN_MAX_BYTES) return tooLarge(bytes.length);
    /* G136c (X21): the attempt is stamped BEFORE the clean, so a cleaner that dies mid-clean is not re-run on every wake;
       the back-off (DOCUMENT_COPY_RETRY_MS) then applies to it as to a failed read. */
    try { this.sql.exec(`UPDATE document_copy_queue SET tried=? WHERE capture=?`, this.#when(null), sha); } catch { return { failed: true }; }
    const c = await this.clean(bytes);
    if (!c || typeof c !== "object") return { failed: true };
    if (c.ok === false)
      return { state: "refused", code: String(c.code ?? "DOCUMENT_UNREADABLE"), detail: typeof c.detail === "string" ? c.detail : null };
    const format = typeof c.format === "string" ? c.format : null;
    if (c.ok === true && c.clean === true) return { state: "clean", format };
    if (!(c.ok === true && c.bytes instanceof Uint8Array)) return { failed: true };
    const copySha = await this.#digest(c.bytes);
    if (!(await this.#putDerived(copySha, c.bytes, { derived: "cleaned", original: sha, label: COPY_CLEANED_LABEL })))
      return { failed: true };
    return { state: "copy", sha256: copySha, bytes: c.bytes.length, format };
  }

  /** R15 (T39; N806): when `copyBatch` next has work, as `file-safety` R39's wakes answer: null while nothing is queued;
   *  `now` while a queued document has not been tried since it was queued; else the earliest retry instant (its last
   *  try plus DOCUMENT_COPY_RETRY_MS), never before `now`. In the form `now` was given (milliseconds, or an ISO
   *  string). The instants live in this module's tables, so the answer survives a restart. (T40; N816, K2380) While no
   *  evidence store or bucket is bound it answers null, whatever is queued, as `copyBatch` would refuse
   *  DOCUMENT_COPY_NO_STORE (as `file-safety` R39 answers no scan wake with no scanner bound); the next `onCopyWork`
   *  notice (R17) or the instance's start reads it again. Writes nothing; never throws (null when the queue cannot be
   *  read). */
  copyWake(now) {
    try {
      if (!this.bucket) return null;
      let ev = null;
      try { ev = this.record.evidenceStore(); } catch { ev = null; }
      if (!ev) return null;
      const n = typeof now === "number" ? now : typeof now === "string" ? Date.parse(now) : NaN;
      if (!Number.isFinite(n)) return null;
      const form = (ms) => (typeof now === "number" ? ms : new Date(ms).toISOString());
      const rows = this.#rows(`SELECT tried FROM document_copy_queue`);
      if (!rows.length) return null;
      let at = Infinity;
      for (const r of rows) {
        const t = r.tried == null ? NaN : Date.parse(r.tried);
        if (!Number.isFinite(t)) return now;
        at = Math.min(at, t + DOCUMENT_COPY_RETRY_MS);
      }
      return at <= n ? now : form(at);
    } catch { return null; }
  }
}

const instances = new WeakMap();

/** The one instance for a host (K61). The first call creates it with `deps` (a test passes its own), creates its
 *  tables, and declares them to record-core in one call: the two of held materials exempt from purge (R6), the marks
 *  and their withdrawals and copies with their classes (R12), and (T39) the queue and record of member documents'
 *  copies; the answer is kept as `purgeDeclaration` and `marksDeclaration`. It registers R15's receipt listener with
 *  provenance (its R47). */
export function caseCarriageOf(host, deps) {
  let c = instances.get(host);
  if (!c) {
    const d = deps || {};
    const storage = d.storage || host.storage;
    const record = d.record || recordOf(host);
    const membership = d.membership || membershipOf(host, { record });
    const promotion = d.promotion || promotionOf(host, { record, membership });
    const provenance = d.provenance || provenanceOf(host, { record, membership, promotion });
    c = new CaseCarriage({ ...d, host, storage, record, membership, promotion, provenance });
    instances.set(host, c);
    c.migrate();
    /* One declaration, so the module holds one place in record-core's order: the two published tables with the classes
       `declarePurge`'s default form gave them (exempt, R6), and the marks, withdrawals and copies with theirs (R12). */
    const declared = record.declareTable("case-carriage", [...CASE_CARRIAGE_EXEMPT.map((name) => ({ name, purge: "exempt",
      expunge: "none", export: "admin-only", sight: "group", derive: "stored", version_chain: false })),
      ...CASE_CARRIAGE_MARK_TABLES.map((t) => ({ ...t })), ...CASE_CARRIAGE_DOCUMENT_TABLES.map((t) => ({ ...t }))]);
    c.purgeDeclaration = declared;
    c.marksDeclaration = declared;
    c.start();   // R15 (T39): the receipt listener, registered once, at creation
  }
  return c;
}

/** R9, R10, R14: this module's route arms, keyed by op name, each a function of no arguments answering what its service
 *  answers (the `recordCoreOps` pattern). The control plane stamps `by` and `viewer` in `url`'s query, never the body;
 *  the capture is `capture` in the query or `captureSha` in the body, the areas the body's `areas`, and (R14) the mark
 *  and the reason the body's `mark` and `reason`. Which credential
 *  reaches each op is `op-declarations`' and `control-plane`'s; the routes come in layer 11. */
export function caseCarriageOps(cc, url, body) {
  const q = (k) => url.searchParams.get(k);
  const b = body && typeof body === "object" ? body : {};
  const sha = () => q("capture") ?? b.captureSha ?? null;
  return {
    obscuremark: () => cc.obscureMark({ captureSha: sha(), areas: b.areas, by: q("by") }),
    photomarks: () => cc.photoMarks({ captureSha: sha(), viewer: url.searchParams.has("viewer") ? q("viewer") : "" }),
    obscuremarkwithdraw: () => cc.obscureMarkWithdraw({ captureSha: sha(), mark: b.mark, reason: b.reason, by: q("by") }),
  };
}

/* R23 (T51; K4168; op-declarations R80, op-grades R49): the ops this module serves that the screens send, declared by their owner beside
   the ops map: each row's class, weight and description are the op's existing rows', its fields are what the arm reads. */
export const DECLARED_OPS = Object.freeze({
  obscuremark: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "reversible", description: localize("case-carriage.declared.obscuremark", "photo-directed: keyed by a photo's capture, reached from the Photos step; a member's mark of areas to obscure in the published copy; withdrawn only by a reasoned act, never erased (R28); moves no bundle"),
    fields: { accepts: ["captureSha","capture","areas"], requires: [["captureSha","capture"],"areas"] } },
  obscuremarkwithdraw: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "reasoned", description: localize("case-carriage.declared.obscuremarkwithdraw", "photo-directed: keyed by a photo's capture and one mark, reached from the Photos step; a member's reasoned withdrawal of a mark, recorded beside it, never erased; moves no bundle"),
    fields: { accepts: ["captureSha","capture","mark","reason"], requires: [["captureSha","capture"],"mark","reason"] } },
});
