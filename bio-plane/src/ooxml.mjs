/* The OOXML container reader (QUEUE COFF-2) — one container problem, three
 * part-maps.
 *
 * `.docx`, `.xlsx` and `.pptx` are OOXML: a ZIP archive of XML parts. This
 * module is the CONTAINER tier that all three formats (and ODF, which is the
 * same shape with different part names) share:
 *
 *   - the ZIP central-directory walk (never trusts local headers alone),
 *     ZIP64 included;
 *   - member inflate via DecompressionStream("deflate-raw") — MEASURED to
 *     round-trip in workerd (MEASUREMENTS.md 2026-08-03 backfill), so the
 *     whole module carries ZERO dependency, the same finding class that made
 *     PDF phase 1 dependency-free;
 *   - part lookup by name;
 *   - [Content_Types].xml parsing and FLAVOUR DISCRIMINATION — what separates
 *     a `.docx` from an arbitrary ZIP a public body might also publish.
 *     Magic bytes FIRST, then the container's own parts; a declared
 *     Content-Type or a filename extension NEVER decides (I7). TWO part-maps
 *     now live under that one rule: OPC's `[Content_Types].xml` (docx/xlsx/
 *     pptx) and OpenDocument's first-and-stored `mimetype` (odt/ods/odp);
 *   - the uniform `_rels/*.rels` walker (`TargetMode="External"` → outbound),
 *     shared by all three formats;
 *   - `docProps/core.xml` metadata extraction (creator, lastModifiedBy,
 *     revision count, created/modified instants) — evidentiary per DEC-5:
 *     provenance-adjacent facts the publisher's own software recorded;
 *   - size-guard plumbing: over the bound → a STATED text-undetermined with
 *     the reason, NEVER silent truncation; and every part inflated capped at
 *     `MEMBER_MAX` and counted against the file's `ARCHIVE_TOTAL_MAX` (F18);
 *   - plain ZIP ARCHIVES (N688): a validated listing of every entry with its
 *     verdict and a verified streaming cut of one member, under limits
 *     published by name (`listArchive`, `streamMember`, `ARCHIVE_LIMITS`);
 *   - an office file's VBA PROJECT, read for its module names, auto-run
 *     procedures and suspicious keywords, never run (`readVbaProject`, K1888).
 *
 * Doctrine, enforced structurally throughout: NEVER INVENT STRUCTURE. Every
 * function returns `{ ok:false, why:"<named reason>" }` for anything it cannot
 * read — a truncated central directory, an unsupported compression method, a
 * CRC mismatch, an unparseable XML part — and never throws on malformed input,
 * never silently returns a partial presented as whole.
 *
 * ODF IS NOW BUILT AT THIS TIER (COFF-9, 2026-09-14), and the sentence that
 * stood here for six weeks — "ODF is DESIGNED FOR, not built" — is CORRECTED
 * rather than deleted, because the claim it made was the design bet and the
 * bet paid: the flavour table really was a PARAMETER
 * (`discriminate(bytes, contentType, flavours)`), so the ODF part-map arrived
 * as `ODF_FLAVOURS` beside `OOXML_FLAVOURS` and a branch where the function
 * had ALREADY decided there is no `[Content_Types].xml` — not a rewrite.
 *
 * COFF-9 built the FLAVOUR only, and this paragraph used to end "there is
 * still no ODF registry entry, no `registerFormat` call and no I2 emission
 * (COFF-10's)". COFF-10 LANDED ON 2026-09-14 and that sentence is corrected
 * rather than deleted, the way COFF-9 corrected the one before it: the three
 * entries are in `odf.mjs`, registered by three `registerFormat` calls in
 * `formats.mjs`, each projecting ONE `content.xml` into the I2 shape and DEC-5
 * envelope of its OOXML sibling. I7 is CONFIRMED by them, not changed — no new
 * IC-1 union member was needed. NOTHING IN THIS FILE MOVED FOR THAT: the
 * entries dispatch on `partMap:"odf"` and read every media type and main-part
 * name out of `ODF_FLAVOURS` rather than spelling them again, which is the
 * whole point of the table being a parameter. This module ASSERTS nothing
 * about meaning (that stays FRAMEWORK's, through I2) and WRITES nothing.
 *
 * Registry entries (COFF-3/4/5) build their I7 `detect`/`parts`/`structure`/
 * `text` on top of these primitives; this module is below the registry and
 * imports nothing from it.
 */

import { boundOf } from "./read-bounds.mjs";

const UTF8 = new TextDecoder("utf-8", { fatal: false });
const LATIN1 = new TextDecoder("latin1");

/* Every service takes bytes as a Uint8Array, an ArrayBuffer, any typed-array
 * view or an array of byte values. Anything else reads as no bytes at all, so
 * a caller's wrong argument is a named refusal downstream, never a throw. */
function toBytes(x) {
  if (x instanceof Uint8Array) return x;
  if (ArrayBuffer.isView(x)) return new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
  try { return new Uint8Array(x ?? 0); } catch { return new Uint8Array(0); }
}

/* A container as `readContainer` returns it, or an empty one when the caller
 * passes something else: an unusable container holds no member. */
function entriesOf(container) {
  return Array.isArray(container?.entries) ? container.entries : [];
}
function findEntry(container, want) {
  const byName = container?.byName;
  return (byName instanceof Map ? byName.get(want) : undefined)
    ?? entriesOf(container).find((e) => normalizePartName(e?.name) === want);
}

/* ------------------------------------------------------------------ *
 * The size guard
 * ------------------------------------------------------------------ */

/* MEASURED — COFF-6 (MEASUREMENTS.md, 2026-08-03, the real Oakland office
 * corpus) replaced the provisional 32 MiB CONTAINER bound, and the METRIC
 * changed with the number: container size is a bad proxy in BOTH directions
 * (an 84.8 MB all-images deck carries 630 KB of text XML; a 9.1 MB workbook
 * inflates to 63.6 MB of sheet XML). What extraction actually costs is the
 * TEXT-BEARING PARTS' uncompressed size, and the ZIP central directory
 * DECLARES it before any inflation — so the guard reads the declared
 * uncompressed sizes of the text parts, summed by `declaredTextBytes` below,
 * costs one directory walk, and cannot be gamed by a compression bomb (a
 * LYING declared size surfaces later as readPart's `size_mismatch`, which
 * aborts into the same stated refusal, never a silent partial).
 *
 * 20 MiB passes 86 of the 88 measured Oakland documents with 28 % headroom
 * over the worst docx; the two excluded police stop-data workbooks are the
 * NAMED test cases for STREAMING-TO-64-MiB, which is DEFERRED (COFF-6's
 * landed line) and deliberately not built here.
 *
 * A document over this bound gets full central-directory and metadata
 * treatment but full text extraction is refused as a STATED
 * `text-undetermined`, never silently truncated. */
export const MEASURED_OOXML_TEXT_BOUND_BYTES = boundOf("office", "text_bytes"); // 20,971,520 (R6)

/** Sum the DECLARED UNCOMPRESSED sizes of the container's text-bearing parts
 *  (which parts are text-bearing is the format entry's knowledge, passed as a
 *  predicate over normalized part names) straight from the central directory —
 *  BEFORE any inflation, per the COFF-6 metric. Returns `{ total, parts }` so
 *  an over-bound refusal can name what it measured. */
export function declaredTextBytes(container, isTextPart) {
  let total = 0;
  const parts = [];
  if (typeof isTextPart !== "function") return { total, parts };
  for (const e of entriesOf(container)) {
    const name = normalizePartName(e.name);
    if (!isTextPart(name)) continue;
    total += e.uncompressedSize;
    parts.push({ name, declared: e.uncompressedSize });
  }
  return { total, parts };
}

/** The size-guard plumbing every format entry calls before full extraction.
 *  `declaredBytes` is the SUMMED DECLARED UNCOMPRESSED size of the document's
 *  text-bearing parts (from `declaredTextBytes`) — NOT the container size,
 *  which COFF-6 measured to be a bad proxy in both directions. Returns
 *  `{ ok:true }` under the bound; over it, a stated undetermined marker
 *  carrying WHY, the sizes, the metric and the bound's name — shaped so a
 *  format entry can carry it into its I2 text output verbatim. */
export function sizeGuard(declaredBytes, bound = MEASURED_OOXML_TEXT_BOUND_BYTES) {
  /* `<=`, not `!(>)`: a size that is not a number is never shown to be under
   * the bound, so it is refused rather than waved through. */
  let under = false;
  try { under = declaredBytes <= bound; } catch { /* not comparable: not under */ }
  if (under) return { ok: true };
  return {
    ok: false,
    text: "undetermined",
    why: "over_size_bound",
    size: declaredBytes,
    bound,
    boundName: "MEASURED_OOXML_TEXT_BOUND_BYTES",
    metric: "declared_uncompressed_text_part_bytes", // summed from the central directory, before inflation
  };
}

/* ------------------------------------------------------------------ *
 * Text read in pieces (F7; fix round 4b, K4487; R35)
 * ------------------------------------------------------------------ *
 *
 * The 20 MiB bound above is what a reader may HOLD in memory at once: one part
 * inflated whole, decoded whole and walked whole. A document whose declared
 * text is over it is no longer refused. Its text parts are inflated in
 * windows, decoded as they come and handed to the caller in PIECES (about
 * `TEXT_PIECE_CHARS` each, cut where the caller says a piece may end), so the
 * reader holds a piece, never the part. What the caller keeps of a piece is
 * its own business; the formats keep the text they return and no more.
 *
 * `STREAMED_TEXT_BOUND_BYTES` is the ceiling of the declared text a read in
 * pieces takes on: 32 MiB. It is set from what the readers MEASURED to hold,
 * not from a round number. A read in pieces holds the text it returns (the
 * document and each unit's own copy of it), so the heap it needs grows with the
 * text, about twice over for docx and pptx; the old-space limit at which each
 * format's read of its largest fixture (random letters and digits, one-byte
 * strings, the worst ratio of text to markup) first completed reliably,
 * node v26, MiB declared -> MB of heap, with the package's own bytes held beside
 * it (T51 job record, "Measurements"):
 *        30      45      63          package bytes at 30 / 45 / 63
 *   xlsx 80      64      80          20 / 30 / 42
 *   docx 96      120     160         21 / 32 / 45
 *   pptx 80      112     152         22 / 34 / 47
 *   csv  56      72      88          29 / 43 / 61
 * A Worker's object holds 128 MB of heap and buffers together, with the caller's
 * own work beside this one, and a read the object does not survive returns
 * nothing and is retried into the same end (F10). So the ceiling is where the
 * worst format (docx, pptx) still has room: 32 MiB. A text over it is not read,
 * and is STATED: its size, the ceiling, and `final: true` (the document's own
 * size, not a failure that a later try could mend). It is raised by measuring
 * on the plane, not by arguing here; xlsx and csv alone would take more. */
export const STREAMED_TEXT_BOUND_BYTES = boundOf("office", "streamed_text_bytes");
/* The decoded text a piece is cut at (when a cut point exists), and the most a
 * reader will carry waiting for one: a part with no cut point in this much text
 * cannot be read in pieces. */
const TEXT_PIECE_CHARS = 1 << 20;
const TEXT_PIECE_MAX_CHARS = boundOf("office", "piece_chars");
/* The window the deflated (or stored) bytes are fed through. */
const INFLATE_WINDOW = 1 << 20;

/** How a text read of `declaredBytes` DECLARED uncompressed text goes (R35):
 *    { read: "whole" }                      at or under MEASURED_OOXML_TEXT_BOUND_BYTES;
 *    { read: "pieces", piecewise }          over it, up to STREAMED_TEXT_BOUND_BYTES;
 *    { read: "none", guard }                over that: nothing is read, and `guard` states why.
 *  `piecewise` is what a text answer carries to say it was read in pieces
 *  (`declared`, `bound`, `boundName`, `metric`); `guard` is `sizeGuard`'s
 *  marker for the streamed ceiling, with `final: true`. A size that is not a
 *  number is never shown to be under a bound. Never throws. */
export function textPlan(declaredBytes) {
  const number = typeof declaredBytes === "number";
  if (number && declaredBytes <= MEASURED_OOXML_TEXT_BOUND_BYTES) return { read: "whole" };
  if (number && declaredBytes <= STREAMED_TEXT_BOUND_BYTES) {
    return { read: "pieces", piecewise: {
      declared: declaredBytes, bound: MEASURED_OOXML_TEXT_BOUND_BYTES,
      boundName: "MEASURED_OOXML_TEXT_BOUND_BYTES", metric: "declared_uncompressed_text_part_bytes",
    } };
  }
  return { read: "none", guard: {
    ok: false, text: "undetermined", why: "over_size_bound", size: declaredBytes, bound: STREAMED_TEXT_BOUND_BYTES,
    boundName: "STREAMED_TEXT_BOUND_BYTES", metric: "declared_uncompressed_text_part_bytes", final: true,
  } };
}

/** A cut for `readPartPieces`: the position after the last `>` in the buffer,
 *  for a reader that tokenises its own markup and carries an unfinished tag
 *  into the next piece. 0 when there is none. */
export const cutAfterTag = (buf) => buf.lastIndexOf(">") + 1;

/** A cut for `readPartPieces`: the position of the last match of `re` (a
 *  global expression for the START of an element the reader takes whole), so a
 *  piece ends between two such elements. 0 when there is none. */
export function cutBefore(re) {
  return (buf) => {
    re.lastIndex = 0;
    let at = 0, m;
    while ((m = re.exec(buf)) !== null) {
      if (m.index > 0) at = m.index;
      if (m[0].length === 0) re.lastIndex++;
    }
    return at;
  };
}

/** A refusal of `readPartPieces` as the readers state it. A member with no place
 *  to end a piece (`piece_unbounded`) is stated in the words every reader has
 *  always used for a text it did not read for its size, `over_size_bound`, with
 *  that size, `final: true` and the mechanism in `detail`; any other refusal is
 *  stated as it is. */
export function pieceWhy(read) {
  if (read?.why !== "piece_unbounded") return { why: read?.why };
  return { why: "over_size_bound", detail: "piece_unbounded", size: read.size, final: true };
}

/* ------------------------------------------------------------------ *
 * The archive limits (N688; K1844, K1852 (2), K1881, K1903), by name
 * ------------------------------------------------------------------ *
 *
 * Protective limits are BOB's (K1881) and each is published as a bound with
 * its name: a refusal on one names it exactly and carries its figure as
 * `limit`. This module keeps five of them itself (the entries, total, member
 * and ratio limits in `listArchive`/`streamMember`, and the member and total
 * limits on every part `readPart` inflates, F18). The depth and the two tree
 * limits are counted from the outermost archive across a whole unpack, which
 * only the unpack act (`acquisition`) sees; they are published here so the
 * figures live in one place. Every figure is a row of runtime-limits'
 * `READ_BOUNDS` taken through `boundOf` (fix round 9, G124g; R30): this module
 * writes no ceiling as a number. A refusal on a limit is `final`: the same
 * bytes refuse again. */
export const ARCHIVE_ENTRIES_MAX = boundOf("archive", "members");
export const ARCHIVE_TOTAL_MAX = boundOf("archive", "unpacked_bytes");
export const MEMBER_MAX = boundOf("archive", "member_bytes");
/* The entries of an office package (G125h), the central directory and one name
 * (G133e): the reader path's counterparts of the listing's limits. */
export const OFFICE_ENTRIES_MAX = boundOf("office", "entries");
export const ARCHIVE_DIRECTORY_MAX = boundOf("archive", "directory");
export const ARCHIVE_NAME_MAX = boundOf("archive", "name");
/* Above deflate's possible 1,032:1, so a larger declared ratio is malformed,
 * not merely large (Fifield, "A better zip bomb", WOOT '19). */
export const ARCHIVE_RATIO_MAX = boundOf("archive", "ratio");
export const ARCHIVE_DEPTH_MAX = boundOf("archive", "depth");
export const ARCHIVE_TREE_TOTAL_MAX = boundOf("archive", "unpacked_bytes");
export const ARCHIVE_TREE_ENTRIES_MAX = boundOf("archive", "members");
export const ARCHIVE_LIMITS = Object.freeze({
  ARCHIVE_ENTRIES_MAX, ARCHIVE_TOTAL_MAX, MEMBER_MAX, OFFICE_ENTRIES_MAX, ARCHIVE_DIRECTORY_MAX, ARCHIVE_NAME_MAX,
  ARCHIVE_RATIO_MAX, ARCHIVE_DEPTH_MAX, ARCHIVE_TREE_TOTAL_MAX, ARCHIVE_TREE_ENTRIES_MAX,
});
/* The XML parts this module decodes itself (`[Content_Types].xml`, `*.rels`,
 * `docProps/core.xml`, `mimetype`) are kilobytes in any real package; one
 * declared above this is refused before inflation (G125d: a 100 MiB `.rels`
 * passes the ratio check at about 1,000:1). */
export const STRUCTURAL_PART_MAX = boundOf("office", "structural_part_bytes");

/* A refusal on a limit: it names the limit, carries its figure and is final. */
const overLimit = (why, limit, extra = {}) => ({ ok: false, why, ...extra, limit, final: true });

/* The declared uncompressed total of a container's entries, the per-file
 * total every part read counts against (F18). Remembered per entries array,
 * so a walk over thousands of parts sums once. */
const DECLARED_TOTALS = new WeakMap();
function declaredTotal(container) {
  const entries = entriesOf(container);
  let total = DECLARED_TOTALS.get(entries);
  if (total === undefined) {
    total = 0;
    for (const e of entries) total += e?.uncompressedSize;
    DECLARED_TOTALS.set(entries, total);
  }
  return total;
}

/* ------------------------------------------------------------------ *
 * CRC-32 (ZIP polynomial) — for verifying a member actually round-trips
 * ------------------------------------------------------------------ */

/* The byte table, built on the first CRC computed and kept (R34, N1039):
 * evaluating the module computes no derived table, because the plane's global
 * scope carries every module's import-time work against its start-up budget
 * (bundler R31, K3147). */
let crcTable = null;
function crcTableOf() {
  if (crcTable) return crcTable;
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return (crcTable = t);
}

/* The running register, so a streamed member is checked as it passes:
 * start at 0xffffffff, feed each chunk, finish with `^ 0xffffffff`. */
function crcUpdate(c, u8) {
  const t = crcTableOf();
  for (let i = 0; i < u8.length; i++) c = t[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
  return c;
}

export function crc32(bytes) {
  return (crcUpdate(0xffffffff, toBytes(bytes)) ^ 0xffffffff) >>> 0;
}

/* ------------------------------------------------------------------ *
 * The central-directory walk
 * ------------------------------------------------------------------ */

const u16 = (b, p) => b[p] | (b[p + 1] << 8);
const u32 = (b, p) => (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)) >>> 0;

/* A 64-bit little-endian field as a Number, or NaN when it would not be one
 * exactly (above 2^53 - 1): a value the module cannot hold is never rounded. */
const u64 = (b, p) => {
  const hi = u32(b, p + 4);
  return hi >= 0x200000 ? NaN : hi * 0x100000000 + u32(b, p);
};

const SIG_LOCAL = 0x04034b50; // PK\x03\x04
const SIG_CENTRAL = 0x02014b50; // PK\x01\x02
const SIG_EOCD = 0x06054b50; // PK\x05\x06
const SIG_ZIP64_EOCD = 0x06064b50; // PK\x06\x06
const SIG_ZIP64_LOCATOR = 0x07064b50; // PK\x06\x07
const SIG_DESCRIPTOR = 0x08074b50; // PK\x07\x08

/* The end-of-central-directory record's fields (APPNOTE §4.3.16). */
function parseEocd(b, p) {
  return {
    diskEntries: u16(b, p + 8), totalEntries: u16(b, p + 10),
    cdSize: u32(b, p + 12), cdOffset: u32(b, p + 16), commentLen: u16(b, p + 20),
  };
}
const ZIP64_SENTINELS = { diskEntries: 0xffff, totalEntries: 0xffff, cdSize: 0xffffffff, cdOffset: 0xffffffff };
const needsZip64 = (e) => Object.keys(ZIP64_SENTINELS).some((k) => e[k] === ZIP64_SENTINELS[k]);

/* ZIP64 (APPNOTE §4.3.14, §4.3.15). `loc` is the 20-byte locator read directly
 * before the EOCD, `rec` the first 56 bytes at the offset it names. Answers the
 * end record's values, or null when either is absent, malformed or out of
 * range: the locator must name disk 0 of at most one disk, and the end record
 * (its own declared size included) must end exactly where the locator starts,
 * so nothing unread lies between them. */
function zip64End(loc, locOffset, rec, recOffset) {
  if (!loc || loc.length < 20 || u32(loc, 0) !== SIG_ZIP64_LOCATOR) return null;
  if (u32(loc, 4) !== 0 || u32(loc, 16) > 1 || u64(loc, 8) !== recOffset) return null;
  if (!rec || rec.length < 56 || u32(rec, 0) !== SIG_ZIP64_EOCD) return null;
  const size = u64(rec, 4);
  if (!(size >= 44) || recOffset + 12 + size !== locOffset) return null;
  if (u32(rec, 16) !== 0 || u32(rec, 20) !== 0) return null;
  const z = {
    recordOffset: recOffset, diskEntries: u64(rec, 24), totalEntries: u64(rec, 32),
    cdSize: u64(rec, 40), cdOffset: u64(rec, 48),
  };
  return [z.diskEntries, z.totalEntries, z.cdSize, z.cdOffset].every(Number.isFinite) ? z : null;
}
/* The locator's offset field, or NaN: where the end record should be read. */
const zip64RecordOffset = (loc) =>
  (loc && loc.length >= 20 && u32(loc, 0) === SIG_ZIP64_LOCATOR ? u64(loc, 8) : NaN);

/* A central-directory record's ZIP64 extra field (0x0001): the 64-bit values
 * of exactly the fields its fixed record holds as sentinels, in APPNOTE's
 * order (uncompressed, compressed, local-header offset, disk). `want` names
 * which; null when the field is absent, short or holds a value over 2^53. */
function zip64Extra(extra, want) {
  for (let p = 0; p + 4 <= extra.length;) {
    const id = u16(extra, p);
    const size = u16(extra, p + 2);
    if (p + 4 + size > extra.length) return null;
    if (id === 0x0001) {
      const out = {};
      let q = p + 4;
      const end = q + size;
      for (const k of ["uncompressed", "compressed", "offset"]) {
        if (!want[k]) continue;
        if (q + 8 > end) return null;
        out[k] = u64(extra, q);
        if (!Number.isFinite(out[k])) return null;
        q += 8;
      }
      if (want.disk && q + 4 > end) return null;
      return out;
    }
    p += 4 + size;
  }
  return null;
}

/* One central-directory record's 64-bit values: its 32-bit fields, or, where
 * a field holds 0xffffffff (the disk number 0xffff), the ZIP64 extra field's.
 * null when a sentinel's value is missing from that field (R3). */
function centralValues(b, p, extra) {
  const v = { compressed: u32(b, p + 20), uncompressed: u32(b, p + 24), offset: u32(b, p + 42) };
  const want = {
    uncompressed: v.uncompressed === 0xffffffff, compressed: v.compressed === 0xffffffff,
    offset: v.offset === 0xffffffff, disk: u16(b, p + 34) === 0xffff,
  };
  if (!want.uncompressed && !want.compressed && !want.offset && !want.disk) return v;
  const z = zip64Extra(extra, want);
  return z ? { ...v, ...z } : null;
}

/** True iff the bytes open with the ZIP local-file magic `PK\x03\x04` — the
 *  FIRST discriminator (I7: magic bytes first, content type second). An empty
 *  ZIP (bare EOCD) does not carry it and cannot be an OOXML package anyway,
 *  since OOXML requires parts. */
export function hasZipMagic(bytes) {
  const b = toBytes(bytes);
  return b.length >= 4 && u32(b, 0) === SIG_LOCAL;
}

/* OPC part names in [Content_Types].xml overrides start with "/", ZIP entry
 * names do not. One normal form so the two always meet. */
export function normalizePartName(name) {
  try { return String(name ?? "").replace(/^\/+/, ""); } catch { return ""; }
}

/* A container's structures are read through a WALK: a generator that yields
 * `[offset, length]` for the bytes it needs next and is handed them. One walk
 * serves both callers, so they cannot drift: `runSync` hands it ranges of a
 * buffer the caller holds (`readContainer`, `readPart`), `runAsync` ranges of
 * a range source (R11, G130c: a file of any size is judged from its end
 * record, its central directory and the small parts it names). */
function runSync(walk, b) {
  let step = walk.next();
  while (!step.done) {
    const [at, length] = step.value;
    step = walk.next(b.subarray(at, at + length));
  }
  return step.value;
}
async function runAsync(walk, src) {
  let step = walk.next();
  while (!step.done) {
    const [at, length] = step.value;
    step = walk.next(await src.read(at, length));
  }
  return step.value;
}

/** `bytes` of a ZIP given as a range source `{size, read(offset, length)}`
 *  (R27) rather than as bytes. */
const isRangeSource = (x) => !!x && typeof x === "object" && typeof x.read === "function"
  && !ArrayBuffer.isView(x) && !(x instanceof ArrayBuffer);

function* walkContainer(size) {
  if (size < 22) return { ok: false, why: "too_short_for_zip" };

  /* EOCD: fixed 22 bytes + a comment of up to 0xFFFF; scan back for the
   * signature over exactly that window and no further. */
  const scanFloor = Math.max(0, size - 22 - 0xffff);
  const win = yield [scanFloor, size - scanFloor];
  let eocd = -1;
  for (let p = size - 22; p >= scanFloor; p--) {
    if (u32(win, p - scanFloor) === SIG_EOCD) { eocd = p; break; }
  }
  if (eocd < 0) return { ok: false, why: "eocd_not_found" };

  let { diskEntries, totalEntries, cdSize, cdOffset } = parseEocd(win, eocd - scanFloor);
  let directoryEnd = eocd;

  /* ZIP64 (N688; K1844): a sentinel in the EOCD sends the reader to the
   * locator directly before it and the end record it names, whose 64-bit
   * values are used. A sentinel without a well-formed pair is refused by name,
   * never read as the 16- or 32-bit value it literally holds. */
  if (needsZip64({ diskEntries, totalEntries, cdSize, cdOffset })) {
    const locAt = eocd - 20;
    const loc = locAt >= 0 ? yield [locAt, 20] : null;
    const recAt = zip64RecordOffset(loc);
    const z = Number.isFinite(recAt) && recAt + 56 <= locAt
      ? zip64End(loc, locAt, yield [recAt, 56], recAt) : null;
    if (!z) return { ok: false, why: "zip64_record_invalid" };
    ({ diskEntries, totalEntries, cdSize, cdOffset } = z);
    directoryEnd = z.recordOffset;
  }
  if (diskEntries !== totalEntries) return { ok: false, why: "multi_disk_unsupported" };
  /* R3 (G125h, G133e): the declared count and the declared directory are
   * judged against their limits before a byte of the directory is read. */
  if (totalEntries > OFFICE_ENTRIES_MAX) return overLimit("OFFICE_ENTRIES_MAX", OFFICE_ENTRIES_MAX);
  if (cdSize > ARCHIVE_DIRECTORY_MAX) return overLimit("ARCHIVE_DIRECTORY_MAX", ARCHIVE_DIRECTORY_MAX);
  if (cdOffset + cdSize > directoryEnd) return { ok: false, why: "central_directory_truncated" };

  const cd = yield [cdOffset, cdSize];
  const entries = [];
  const byName = new Map();
  let p = 0;
  for (let i = 0; i < totalEntries; i++) {
    if (p + 46 > cd.length || u32(cd, p) !== SIG_CENTRAL) {
      return { ok: false, why: "central_directory_truncated" };
    }
    const flags = u16(cd, p + 8);
    const method = u16(cd, p + 10);
    const crc = u32(cd, p + 16);
    const nameLen = u16(cd, p + 28);
    const extraLen = u16(cd, p + 30);
    const commentLen = u16(cd, p + 32);
    if (nameLen > ARCHIVE_NAME_MAX) return overLimit("ARCHIVE_NAME_MAX", ARCHIVE_NAME_MAX);
    if (p + 46 + nameLen + extraLen + commentLen > cd.length) {
      return { ok: false, why: "central_directory_truncated" };
    }
    const values = centralValues(cd, p, cd.subarray(p + 46 + nameLen, p + 46 + nameLen + extraLen));
    if (!values) return { ok: false, why: "zip64_record_invalid" };
    const { compressed: compressedSize, uncompressed: uncompressedSize, offset: localHeaderOffset } = values;
    const nameBytes = cd.subarray(p + 46, p + 46 + nameLen);
    /* General-purpose bit 11 declares UTF-8 names; otherwise cp437, for which
     * latin1 is this walk's approximation (the listing, `listArchive`, decodes
     * cp437 itself; K1903 (3); OOXML part names are
     * ASCII, where the two agree exactly). */
    const name = (flags & 0x0800) ? UTF8.decode(nameBytes) : LATIN1.decode(nameBytes);
    const entry = { name, method, crc32: crc, compressedSize, uncompressedSize, localHeaderOffset };
    /* The general-purpose flags decide whether the member is encrypted (R5);
     * they are not part of the entry's published shape. */
    Object.defineProperty(entry, "flags", { value: flags, enumerable: false });
    entries.push(entry);
    if (!byName.has(name)) byName.set(name, entry);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return { ok: true, entries, byName, count: entries.length };
}

/** Walk the END OF CENTRAL DIRECTORY record and the central directory itself.
 *  The central directory is the authority on what the archive contains — a
 *  local header may lie (data-descriptor zeros), so sizes/CRC come from here.
 *
 *  Returns `{ ok:true, entries, byName, count }` where each entry is
 *  `{ name, method, crc32, compressedSize, uncompressedSize, localHeaderOffset }`,
 *  or `{ ok:false, why }` with a NAMED reason. A central directory that is cut
 *  short, inconsistent with the EOCD counts, or off the end of the buffer is
 *  `central_directory_truncated` — a stated undetermined, never the readable
 *  prefix silently presented as the whole archive. ZIP64's 64-bit values are
 *  read where a sentinel calls for them; a sentinel without them is
 *  `zip64_record_invalid`. A count, a directory or a name over its limit
 *  (R30) is refused by that limit's name, final, before the directory is
 *  walked or the name kept. */
export function readContainer(bytes) {
  const b = toBytes(bytes);
  return runSync(walkContainer(b.length), b);
}

/* The same walk over a range source (already `sourceOf`-wrapped). */
function readContainerFrom(src) {
  return runAsync(walkContainer(src.size), src);
}

/* ------------------------------------------------------------------ *
 * Member inflate — DecompressionStream("deflate-raw"), zero dependency
 * ------------------------------------------------------------------ */

/* Inflates at most `limit + 1` bytes. The central directory declares the
 * member's size, so output past it is already a `size_mismatch`: inflation
 * stops there rather than running a compression bomb to completion before
 * the length check refuses it. Returns `{ bytes }`, `{ over: n }` (stopped
 * after n bytes, n > limit) or null (the deflate stream did not complete). */
async function inflateRaw(u8, limit) {
  try {
    const reader = new Blob([u8]).stream()
      .pipeThrough(new DecompressionStream("deflate-raw")).getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > limit) {
        reader.cancel().catch(() => {});
        return { over: total };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let at = 0;
    for (const c of chunks) { bytes.set(c, at); at += c.length; }
    return { bytes };
  } catch {
    return null;
  }
}

/* The member's compressed bytes: the caps first (F18; G125d), judged on the
 * central directory's declared sizes before anything is read, then its local
 * header. `{ ok:true, entry, raw }` or the named refusal `readPart` and
 * `readPartPieces` both answer. `structural` is a part this module decodes to
 * text itself (R5, `STRUCTURAL_PART_MAX`). */
function* locate(size, container, want, structural) {
  const entry = findEntry(container, want);
  if (!entry) return { ok: false, why: "part_absent", name: want };

  /* F18 (K1881): capped BEFORE any inflation, on the central directory's
   * declared sizes: this member, then everything the file declares. A size
   * that is not a number is never shown to be under a limit. */
  const declared = entry.uncompressedSize;
  const name = { name: want };
  if (!(declared <= MEMBER_MAX)) return overLimit("MEMBER_MAX", MEMBER_MAX, { ...name, declared });
  const total = declaredTotal(container);
  if (!(total <= ARCHIVE_TOTAL_MAX)) return overLimit("ARCHIVE_TOTAL_MAX", ARCHIVE_TOTAL_MAX, { ...name, declared: total });
  /* G125d: a declared size over the ratio's reach of the compressed one is
   * malformed, not large; a zero compressed size with a non-zero declared
   * one included. */
  if (!(declared <= entry.compressedSize * ARCHIVE_RATIO_MAX)) {
    return overLimit("ARCHIVE_RATIO_MAX", ARCHIVE_RATIO_MAX, { ...name, declared });
  }
  if (structural && !(declared <= STRUCTURAL_PART_MAX)) {
    return overLimit("STRUCTURAL_PART_MAX", STRUCTURAL_PART_MAX, { ...name, declared });
  }

  const lh = entry.localHeaderOffset;
  if (!(lh + 30 <= size)) return { ok: false, why: "local_header_invalid", name: want };
  const head = yield [lh, 30];
  if (u32(head, 0) !== SIG_LOCAL) return { ok: false, why: "local_header_invalid", name: want };
  const nameLen = u16(head, 26);
  const extraLen = u16(head, 28);
  const dataStart = lh + 30 + nameLen + extraLen;
  const dataEnd = dataStart + entry.compressedSize;
  if (!(dataEnd <= size)) return { ok: false, why: "member_truncated", name: want };
  /* G130e: ZipCrypto (bit 0, 6, 13) and AES (method 99) members are stated
   * encrypted. The central directory's flags decide; an entry that carries
   * none (a container assembled by hand) is judged by its local header's. */
  const flags = entry.flags ?? u16(head, 6);
  if ((flags & 0x2041) !== 0 || entry.method === 99) return { ok: false, why: "MEMBER_ENCRYPTED", name: want };
  if (entry.method !== 0 && entry.method !== 8) {
    return { ok: false, why: "unsupported_compression_method", method: entry.method, name: want };
  }
  const raw = yield [dataStart, entry.compressedSize];
  return { ok: true, entry, raw };
}

/* `locate` over the bytes or the range source the caller gave. A range
 * source that cannot be read is `source_unreadable`, never a throw. */
async function locatePart(source, container, want, structural) {
  if (!isRangeSource(source)) {
    const b = toBytes(source);
    return runSync(locate(b.length, container, want, structural), b);
  }
  const src = sourceOf(source);
  if (!src) return { ok: false, why: "source_unreadable", name: want };
  try {
    return await runAsync(locate(src.size, container, want, structural), src);
  } catch {
    return { ok: false, why: "source_unreadable", name: want };
  }
}

/** Read ONE member's bytes, verified. Sizes and CRC come from the central
 *  directory (the authority), the data offset from the local header it points
 *  at. `bytes` may be a range source (R11). Every failure is a NAMED reason:
 *    part_absent · MEMBER_MAX · ARCHIVE_TOTAL_MAX · ARCHIVE_RATIO_MAX ·
 *    local_header_invalid · member_truncated · MEMBER_ENCRYPTED ·
 *    unsupported_compression_method · inflate_failed · size_mismatch ·
 *    crc_mismatch
 *  A success is `{ ok:true, bytes }` and the bytes are PROVEN to be the whole
 *  member (length AND CRC-32 against the central directory) — a partial
 *  inflate can never pass as whole. */
export function readPart(bytes, container, name) {
  return readPartOf(bytes, container, name, false);
}

async function readPartOf(source, container, name, structural) {
  const want = normalizePartName(name);
  const found = await locatePart(source, container, want, structural);
  if (!found.ok) return found;
  const { entry, raw } = found;

  let out;
  if (entry.method === 0) {
    out = raw.slice();
  } else {
    const got = await inflateRaw(raw, entry.uncompressedSize);
    if (got === null) return { ok: false, why: "inflate_failed", name: want };
    if (got.over !== undefined) {
      return { ok: false, why: "size_mismatch", name: want, expected: entry.uncompressedSize, got: got.over };
    }
    out = got.bytes;
  }
  if (out.length !== entry.uncompressedSize) {
    return { ok: false, why: "size_mismatch", name: want, expected: entry.uncompressedSize, got: out.length };
  }
  if (crc32(out) !== entry.crc32) {
    return { ok: false, why: "crc_mismatch", name: want };
  }
  return { ok: true, bytes: out };
}

/** Read ONE member as TEXT, in pieces (R35). `onPiece(text)` is called with
 *  each piece in order; a piece ends where `cut(buffer)` says (the position a
 *  piece may end at, 0 when the buffer holds none yet), so the caller is given
 *  whole elements, or whole tokens, as it asks. The member is inflated in
 *  windows (the host's `DecompressionStream`, or the stored bytes as they
 *  are), decoded as a stream by the part's own encoding (R36: UTF-8, or UTF-16
 *  by its BOM, its alternating NULs or its declaration; a declaration this
 *  module cannot decode is `ENCODING_UNSUPPORTED`) and never held whole: the
 *  reader carries a piece and the bytes of the window it is in.
 *
 *  Verification is `readPart`'s, with the same refusals (R5, R31), but it
 *  comes AFTER the pieces: the length and the CRC-32 are checked as the
 *  member ends, so a caller whose answer is `{ ok:false }` has been given
 *  pieces of a member that is not the member, and discards everything it
 *  built from them. Inflation stops one byte past the declared size
 *  (`size_mismatch`), as `readPart`'s does. A buffer of
 *  `TEXT_PIECE_MAX_CHARS` with no cut point in it is
 *  `{ ok:false, why:"piece_unbounded", name, size, final:true }`: the member
 *  cannot be read in pieces, and the answer states its size. Success is
 *  `{ ok:true, size }`. Async; never throws (`onPiece` throwing, or returning
 *  a promise that rejects, is `{ ok:false, why:"reader_failed" }`; a promise it
 *  returns is awaited before the next piece is made). */
export async function readPartPieces(bytes, container, name, cut, onPiece) {
  const want = normalizePartName(name);
  const found = await locatePart(bytes, container, want, false);
  if (!found.ok) return found;
  const { entry, raw } = found;
  const declared = entry.uncompressedSize;

  let decoder = null;
  let head = [], headLen = 0;
  let crc = 0xffffffff, size = 0, buf = "";
  let failure = null;

  /* One decoded chunk in; pieces out. Returns false to stop the member. */
  const text = async (chunk) => {
    buf += decoder.decode(chunk, { stream: true });
    while (buf.length >= TEXT_PIECE_CHARS) {
      const at = cut(buf);
      if (!(at > 0)) {
        if (buf.length > TEXT_PIECE_MAX_CHARS) {
          failure = { ok: false, why: "piece_unbounded", name: want, size: declared, final: true };
          return false;
        }
        break;
      }
      const piece = buf.slice(0, at);
      buf = buf.slice(at);
      if (!(await give(piece))) return false;
    }
    return true;
  };
  /* The encoding is read from the member's first bytes, once. */
  const open = async () => {
    const all = new Uint8Array(headLen);
    let at = 0;
    for (const c of head) { all.set(c, at); at += c.length; }
    head = [];
    const seen = sniffEncoding(all, { declared: null, kind: "xml", detect: false });
    if (!seen.ok) { failure = { ok: false, why: "ENCODING_UNSUPPORTED", name: want }; return false; }
    decoder = new TextDecoder(seen.encoding, { fatal: false });
    return await text(all);
  };
  const take = async (chunk) => {
    size += chunk.length;
    if (size > declared) { failure = { ok: false, why: "size_mismatch", name: want, expected: declared, got: size }; return false; }
    crc = crcUpdate(crc, chunk);
    if (decoder) return await text(chunk);
    head.push(chunk);
    headLen += chunk.length;
    return headLen >= SNIFF_BYTES ? await open() : true;
  };
  /* The caller may return a promise (a reader that yields between pieces): it
   * is awaited before the next piece is made (fix round 9, K4858). */
  const give = async (piece) => {
    try { await onPiece(piece); return true; } catch {
      failure = { ok: false, why: "reader_failed", name: want };
      return false;
    }
  };

  try {
    if (entry.method === 0) {
      for (let at = 0; at < raw.length; at += INFLATE_WINDOW) {
        if (!(await take(raw.subarray(at, at + INFLATE_WINDOW)))) break;
      }
    } else {
      let at = 0;
      const source = new ReadableStream({
        pull(controller) {
          if (at >= raw.length) { controller.close(); return; }
          controller.enqueue(raw.subarray(at, at + INFLATE_WINDOW));
          at += INFLATE_WINDOW;
        },
      });
      const reader = source.pipeThrough(new DecompressionStream("deflate-raw")).getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!(await take(value))) { reader.cancel().catch(() => {}); break; }
        }
      } catch {
        return failure ?? { ok: false, why: "inflate_failed", name: want };
      }
    }
    if (failure) return failure;
    if (!decoder && headLen && !(await open())) return failure;
    if (decoder) buf += decoder.decode();
    if (buf.length && !(await give(buf))) return failure;
  } catch {
    return failure ?? { ok: false, why: "reader_failed", name: want };
  }
  if (size !== declared) return { ok: false, why: "size_mismatch", name: want, expected: declared, got: size };
  if (((crc ^ 0xffffffff) >>> 0) !== entry.crc32) return { ok: false, why: "crc_mismatch", name: want };
  return { ok: true, size };
}

/* ------------------------------------------------------------------ *
 * Bytes to text: the one decode (R36; fix round 9, G131g; K4628 reversed)
 * ------------------------------------------------------------------ *
 *
 * Upload, fetch and the parts of a package are decoded by this one function.
 * The encoding is decided by the strongest evidence the bytes carry, in this
 * order: a byte-order mark; text laid out as UTF-16 (every other byte NUL, as
 * ASCII-range UTF-16 is); the encoding the caller declares (`declared`, a
 * header's `charset`: it wins over what the text says of itself); the text's
 * own declaration (`kind` "xml": the prolog; "html": a `meta`); and, when
 * nothing declares it, the text itself: valid UTF-8 is UTF-8, anything else
 * windows-1252. Only that last case is `assumed`. The encodings read are
 * UTF-8, UTF-16, windows-125x and ISO-8859-x; a declaration naming another is
 * refused by name, never decoded as if it named one of these. */

/* The bytes read for an in-text declaration and for the layout of UTF-16. */
const SNIFF_BYTES = 1024;
const PARITY_SAMPLE = 4096;
/* The bytes of one window whose detected encoding is compared with the
 * file's (`disagree`). */
const DETECT_WINDOW = 65536;

const ENCODING_LABEL = /^(?:utf-?8|unicode-1-1-utf-8|utf-?16(?:le|be)?|ucs-?2|unicode|us-ascii|ascii|iso[-_ ]?8859[-_ ]?\d{1,2}|latin[1-9]|l[1-9]|(?:windows|cp|x-cp)[-_ ]?125[0-8])$/;

/* The host's canonical name for a label this module reads, or null. */
function canonicalEncoding(label) {
  let l;
  try { l = String(label ?? "").trim().toLowerCase(); } catch { return null; }
  if (!ENCODING_LABEL.test(l)) return null;
  try { return new TextDecoder(l).encoding; } catch { return null; }
}

function bomOf(b) {
  if (b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return "utf-8";
  if (b.length >= 2 && b[0] === 0xff && b[1] === 0xfe) return "utf-16le";
  if (b.length >= 2 && b[0] === 0xfe && b[1] === 0xff) return "utf-16be";
  return null;
}

/* Text laid out as UTF-16 without a mark: one byte of each pair NUL, as the
 * ASCII range of UTF-16 is. "utf-16le", "utf-16be" or null. */
function utf16Layout(b) {
  const n = Math.min(b.length, PARITY_SAMPLE) & ~1;
  if (n < 2) return null;
  let even = 0, odd = 0;
  for (let i = 0; i < n; i += 2) { if (b[i] === 0) even++; if (b[i + 1] === 0) odd++; }
  const pairs = n / 2;
  if (odd >= pairs * 0.3 && even <= pairs * 0.02) return "utf-16le";
  if (even >= pairs * 0.3 && odd <= pairs * 0.02) return "utf-16be";
  return null;
}

/* Whether `b[from, to)` is valid UTF-8 (RFC 3629: no overlong form, no
 * surrogate, nothing above U+10FFFF); `multi` is whether it holds any
 * non-ASCII character. */
function utf8Check(b, from = 0, to = b.length) {
  let multi = false;
  for (let i = from; i < to;) {
    const c = b[i];
    if (c < 0x80) { i++; continue; }
    multi = true;
    let need, min;
    if (c >= 0xc2 && c <= 0xdf) { need = 1; min = 0x80; }
    else if (c >= 0xe0 && c <= 0xef) { need = 2; min = 0x800; }
    else if (c >= 0xf0 && c <= 0xf4) { need = 3; min = 0x10000; }
    else return { valid: false, multi };
    if (i + need >= to) return { valid: false, multi };
    let cp = c & (0x3f >> need);
    for (let k = 1; k <= need; k++) {
      const x = b[i + k];
      if ((x & 0xc0) !== 0x80) return { valid: false, multi };
      cp = (cp << 6) | (x & 0x3f);
    }
    if (cp < min || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return { valid: false, multi };
    i += need + 1;
  }
  return { valid: true, multi };
}

/* Whether `b`, not wholly valid UTF-8, is still UTF-8 with stray bytes (R36,
 * G169): its well-formed multi-byte sequences number at least four times its
 * invalid bytes (each byte that does not belong to a well-formed sequence counts
 * one, a sequence cut off at the end included). Real Latin-1 holds almost no valid sequence. */
function mostlyUtf8(b) {
  let valid = 0, invalid = 0;
  for (let i = 0; i < b.length;) {
    const c = b[i];
    if (c < 0x80) { i++; continue; }
    let need, min;
    if (c >= 0xc2 && c <= 0xdf) { need = 1; min = 0x80; }
    else if (c >= 0xe0 && c <= 0xef) { need = 2; min = 0x800; }
    else if (c >= 0xf0 && c <= 0xf4) { need = 3; min = 0x10000; }
    else { invalid++; i++; continue; }
    let ok = i + need < b.length;
    let cp = c & (0x3f >> need);
    for (let k = 1; ok && k <= need; k++) {
      const x = b[i + k];
      if ((x & 0xc0) !== 0x80) ok = false;
      else cp = (cp << 6) | (x & 0x3f);
    }
    if (ok && (cp < min || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff))) ok = false;
    if (ok) { valid++; i += need + 1; } else { invalid++; i++; }
  }
  return valid > 0 && invalid * 4 <= valid;
}

/* The encoding a text declares of itself: the XML prolog's `encoding`, an
 * HTML `meta` charset. null when it declares none. */
function declaredInText(b, kind) {
  if (kind !== "xml" && kind !== "html") return null;
  let head;
  try { head = LATIN1.decode(b.subarray(0, kind === "xml" ? SNIFF_BYTES : 4 * SNIFF_BYTES)); } catch { return null; }
  const m = kind === "xml"
    ? head.match(/^\s*<\?xml[^>]*?\bencoding\s*=\s*["']([^"']+)["']/i)
    : head.match(/<meta\b[^>]*?\bcharset\s*=\s*["']?\s*([^\s"';>/]+)/i);
  return m ? m[1] : null;
}

/* The encoding of `b`: `{ ok:true, encoding, assumed }` or `{ ok:false }` for
 * a declaration this module cannot decode. `detect` false leaves the text
 * itself out of the evidence (a member read in pieces is not held to be
 * judged whole: UTF-8 is then what nothing else declares). */
function sniffEncoding(b, { declared, kind, detect }) {
  const bom = bomOf(b);
  if (bom) return { ok: true, encoding: bom, assumed: false };
  const layout = utf16Layout(b);
  if (layout) return { ok: true, encoding: layout, assumed: kind !== "xml" };
  if (declared != null && declared !== "") {
    const encoding = canonicalEncoding(declared);
    return encoding ? { ok: true, encoding, assumed: false } : { ok: false };
  }
  const inText = declaredInText(b, kind);
  if (inText != null) {
    const encoding = canonicalEncoding(inText);
    if (!encoding) return { ok: false };
    /* UTF-16 in the text of an 8-bit-looking file is not UTF-16 (the layout
     * above is how UTF-16 without a mark shows itself). */
    return { ok: true, encoding: encoding.startsWith("utf-16") ? "utf-8" : encoding, assumed: false };
  }
  if (detect && !utf8Check(b).valid && !mostlyUtf8(b)) return { ok: true, encoding: "windows-1252", assumed: true };
  return { ok: true, encoding: "utf-8", assumed: true };
}

/* The windows of an 8-bit-compatible text whose own detection differs from
 * the file's: a window that is not UTF-8 in a file read as UTF-8, a window
 * that is UTF-8 with non-ASCII characters in a file read as a legacy charset.
 * A window cut inside a character is judged without the cut ends. */
function disagreeing(b, encoding) {
  const out = [];
  if (b.length <= DETECT_WINDOW || encoding.startsWith("utf-16")) return out;
  const asUtf8 = encoding === "utf-8";
  for (let at = 0; at < b.length; at += DETECT_WINDOW) {
    let from = at, to = Math.min(b.length, at + DETECT_WINDOW);
    if (at > 0) for (let k = 0; k < 3 && from < to && (b[from] & 0xc0) === 0x80; k++) from++;
    if (to < b.length) {
      for (let k = 1; k <= 3 && to - k >= from; k++) {
        const x = b[to - k];
        if ((x & 0xc0) === 0x80) continue;
        if (x >= 0xc0 && ((x >= 0xf0 ? 4 : x >= 0xe0 ? 3 : 2) > k)) to -= k;
        break;
      }
    }
    const seen = utf8Check(b, from, to);
    if (asUtf8 ? !seen.valid : seen.valid && seen.multi) out.push(at);
  }
  return out;
}

/** The one decode of bytes to text (R36). Synchronous and pure; never throws.
 *  `{ ok:true, text, encoding, assumed, replaced, replaced_ratio, disagree }`
 *  or `{ ok:false, why:"ENCODING_UNSUPPORTED", name }`. */
export function decodeText(bytes, options) {
  const o = options && typeof options === "object" ? options : {};
  const name = o.name ?? null;
  const unsupported = { ok: false, why: "ENCODING_UNSUPPORTED", name };
  try {
    const b = toBytes(bytes);
    const seen = sniffEncoding(b, { declared: o.declared, kind: o.kind, detect: true });
    if (!seen.ok) return unsupported;
    const text = new TextDecoder(seen.encoding, { fatal: false }).decode(b);
    let replaced = 0;
    for (let at = text.indexOf("�"); at >= 0; at = text.indexOf("�", at + 1)) replaced++;
    let characters = text.length;
    for (const _ of text.matchAll(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g)) characters--;
    return {
      ok: true, text, encoding: seen.encoding, assumed: seen.assumed, replaced,
      replaced_ratio: characters ? replaced / characters : 0, disagree: disagreeing(b, seen.encoding),
    };
  } catch {
    return unsupported;
  }
}


/* ------------------------------------------------------------------ *
 * Minimal XML attribute/element extraction — enough for OPC's three tiny
 * grammars ([Content_Types].xml, .rels, core.xml), dependency-free, and
 * honest about failure: a document these patterns cannot read yields a
 * stated `unparseable`, never a guessed structure.
 * ------------------------------------------------------------------ */

/* A numeric character reference is a complete `&#nn;` or `&#xhh;` naming a
 * Unicode scalar value: not U+0000, not a surrogate, not above U+10FFFF. */
const scalar = (code) => code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff);
const NUMERIC_REFERENCE = /&#(?:x([0-9a-fA-F]+)|([0-9]+));/y;
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/* R37 (G133c): whether the part holds an `&#` that is not a complete
 * reference to a scalar value (above U+10FFFF, a surrogate, U+0000, digits
 * that do not parse), or a lone surrogate. Such a part is not read: no value
 * is made of it, so nothing downstream (`String.fromCodePoint`,
 * `encodeURIComponent`) can throw on it. One pass, linear in the part. */
function malformedReferences(xml) {
  if (LONE_SURROGATE.test(xml)) return true;
  for (let at = xml.indexOf("&#"); at >= 0; at = xml.indexOf("&#", at + 2)) {
    NUMERIC_REFERENCE.lastIndex = at;
    const m = NUMERIC_REFERENCE.exec(xml);
    if (!m || !scalar(m[1] !== undefined ? parseInt(m[1], 16) : parseInt(m[2], 10))) return true;
  }
  return false;
}

function decodeXmlEntities(s) {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, e) => {
    if (e[0] === "#") {
      const code = e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return scalar(code) ? String.fromCodePoint(code) : m;
    }
    return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[e] ?? m;
  });
}

/* Every element whose LOCAL name matches (any namespace prefix), with its
 * attributes decoded. Attribute lookup is by local name too. */
function xmlElements(xml, localName) {
  const out = [];
  /* The tag's end is found once per element (`indexOf`), so a part of
   * unterminated tags costs one pass, not one pass per tag. */
  const re = new RegExp(`<(?:[\\w.-]+:)?${localName}\\b`, "g");
  for (let m = re.exec(xml); m; m = re.exec(xml)) {
    const end = xml.indexOf(">", re.lastIndex);
    if (end < 0) break;
    const body = xml.slice(re.lastIndex, end);
    re.lastIndex = end + 1;
    const attrs = {};
    for (const a of body.matchAll(/([\w.-]+(?::[\w.-]+)?)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
      const local = a[1].includes(":") ? a[1].split(":").pop() : a[1];
      attrs[local] = decodeXmlEntities(a[3] ?? a[4] ?? "");
    }
    out.push(attrs);
  }
  return out;
}

/* The text content of the FIRST element with this local name, entity-decoded;
 * null when the element is absent or empty-by-self-closing. Absence is
 * absence, never invented into a value. */
function xmlElementText(xml, localName) {
  const re = new RegExp(
    `<((?:[\\w.-]+:)?${localName})\\b[^>]*?(/)?>(?:([\\s\\S]*?)</\\1>)?`,
  );
  const m = xml.match(re);
  if (!m || m[2]) return null; // absent, or self-closing (no content)
  return m[3] == null ? null : decodeXmlEntities(m[3]);
}

/* ------------------------------------------------------------------ *
 * [Content_Types].xml — the OPC content-type map
 * ------------------------------------------------------------------ */

export const CONTENT_TYPES_PART = "[Content_Types].xml";

/** Parse [Content_Types].xml text into
 *  `{ ok:true, defaults: Map(lowercased extension → content type),
 *              overrides: Map(normalized part name → content type) }`
 *  or `{ ok:false, why:"content_types_unparseable" }`. */
export function parseContentTypes(xml) {
  if (typeof xml !== "string" || !/<(?:[\w.-]+:)?Types\b/.test(xml)) {
    return { ok: false, why: "content_types_unparseable" };
  }
  if (malformedReferences(xml)) return { ok: false, why: "content_types_unparseable", final: true };
  const defaults = new Map();
  const overrides = new Map();
  for (const d of xmlElements(xml, "Default")) {
    if (d.Extension && d.ContentType) defaults.set(d.Extension.toLowerCase(), d.ContentType);
  }
  for (const o of xmlElements(xml, "Override")) {
    if (o.PartName && o.ContentType) overrides.set(normalizePartName(o.PartName), o.ContentType);
  }
  return { ok: true, defaults, overrides };
}

/** The content type of a part under a parsed map: Override first, Default by
 *  extension second, null when neither speaks (null, not a guess). */
export function partContentType(name, types) {
  const norm = normalizePartName(name);
  const o = types.overrides.get(norm);
  if (o) return o;
  const dot = norm.lastIndexOf(".");
  if (dot < 0) return null;
  return types.defaults.get(norm.slice(dot + 1).toLowerCase()) ?? null;
}

/* ------------------------------------------------------------------ *
 * Flavour discrimination — docx / xlsx / pptx / odt / ods / odp vs an
 * arbitrary ZIP
 * ------------------------------------------------------------------ */

/* THE TABLE IS THE PART-MAP PARAMETER, and as of COFF-9 it carries TWO kinds
 * of row. `partMap` says WHICH DECLARATION a row is read out of, because the
 * two families declare themselves in different places inside the identical
 * ZIP container:
 *
 *   partMap:"opc"  (docx/xlsx/pptx) — `[Content_Types].xml` declares the main
 *                  part's content type; the row names that type and where the
 *                  main part conventionally lives.
 *   partMap:"odf"  (odt/ods/odp)    — a first-and-stored `mimetype` member
 *                  carries the media type verbatim; the row names that media
 *                  type and the main part (`content.xml` for all three).
 *
 * A row with NO `partMap` is read as "opc". That is deliberate back-compat: a
 * caller-supplied table written against the pre-COFF-9 shape (one is in this
 * module's suite, discriminating a `.vsdx`) keeps working unchanged.
 *
 * `OOXML_FLAVOURS` remains EXACTLY the three OOXML rows — the ODF rows are a
 * separate table, and `CONTAINER_FLAVOURS` is the union `discriminate`
 * defaults to. Keeping them separate is what lets a caller ask a narrower
 * question (and lets the suite prove the pre-item OOXML outcomes are
 * reproducible byte-for-byte by passing `OOXML_FLAVOURS` explicitly). */
export const OOXML_FLAVOURS = [
  {
    partMap: "opc",
    flavour: "docx",
    mainContentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
    conventionalMainPart: "word/document.xml",
  },
  {
    partMap: "opc",
    flavour: "xlsx",
    mainContentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml",
    conventionalMainPart: "xl/workbook.xml",
  },
  {
    partMap: "opc",
    flavour: "pptx",
    mainContentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
    conventionalMainPart: "ppt/presentation.xml",
  },
];

/* ------------------------------------------------------------------ *
 * The OpenDocument part-map (COFF-9) — same container, other declaration
 * ------------------------------------------------------------------ */

/* WHY ODF IS BUILT HERE AT ALL, since COFF-6 measured ZERO native ODF assets
 * in a 43,282-key population and ruled DO NOT BUILD (MEASUREMENTS.md,
 * 2026-08-03). That measurement is UNREVISED and still true: native ODF is
 * absent from the wild we sampled. What changed is the SOURCE. Bob ruled on
 * 2026-09-14 that a Google Drive link KEEPS THE LINK and extracts from the
 * OpenDocument EXPORT, which makes ODF the HARVEST format rather than a
 * published one. The rows are warranted by the ruling, not by the census.
 *
 * ODF AS ACTUALLY BUILT (OpenDocument 1.2 part 3 §3.3, and MEASURED against a
 * real producer on 2026-09-14 — see MEASUREMENTS.md): the same ZIP container,
 * but
 *
 *   - the FIRST member of the archive is `mimetype`, STORED (method 0) with
 *     no extra field, whose bytes are EXACTLY the media type and nothing
 *     else. That placement is not decoration — it puts the media type at a
 *     fixed offset near the head of the file, which is the entire reason an
 *     ODF package is sniffable without a directory walk;
 *   - `META-INF/manifest.xml` lists the parts (ODF's answer to
 *     `[Content_Types].xml`);
 *   - `content.xml` is the main part, for all three flavours.
 *
 * THE MIMETYPE VALUE IS THE DISCRIMINATOR — NOT THE FILE LIST. A ZIP carrying
 * `META-INF/manifest.xml` and `content.xml` under any other media type is not
 * an odt/ods/odp and is said to be `undetermined`, never rounded into a
 * flavour because its part names look familiar. */
export const ODF_MIMETYPE_PART = "mimetype";
export const ODF_MANIFEST_PART = "META-INF/manifest.xml";

/* MEASURED 2026-09-14: the three conforming values are 39, 46 and 47 bytes
 * (LibreOffice 26.8.0.3 output, MEASUREMENTS.md). This bound — 2.7x the
 * longest — exists so a container declaring a 500 MB member named `mimetype`
 * cannot make us inflate and decode it to settle a 47-byte question. Over it
 * is a STATED undetermined naming the declared size, never a truncated value
 * silently compared. */
export const ODF_MIMETYPE_MAX_BYTES = 128;

export const ODF_FLAVOURS = [
  {
    partMap: "odf",
    flavour: "odt",
    mimetype: "application/vnd.oasis.opendocument.text",
    conventionalMainPart: "content.xml",
  },
  {
    partMap: "odf",
    flavour: "ods",
    mimetype: "application/vnd.oasis.opendocument.spreadsheet",
    conventionalMainPart: "content.xml",
  },
  {
    partMap: "odf",
    flavour: "odp",
    mimetype: "application/vnd.oasis.opendocument.presentation",
    conventionalMainPart: "content.xml",
  },
];

/* The macro-enabled OOXML flavours (K1888, K1903 (4)): each is read exactly
 * as its plain twin (the same part-map, the same main part, so the same
 * reader), and says which it is in `variant`, because the file carries active
 * content its twin cannot: a VBA project `office-readers` lists as `active`.
 * Each main content type is the one Office writes for that kind (Microsoft's
 * `vnd.ms-*.macroEnabled` types, as requirement R10 lists them); none is the
 * plain twin's, so a row can match only its own. */
/* The templates and the show (G130e; X32): read as their twin too, with their
 * variant: `dotx` as docx, `potx` and `ppsx` as pptx. */
/** The table `discriminate()` uses when a caller names none: both part-maps,
 *  OPC first (the plain rows, then the macro-enabled and the template and
 *  show ones). Order matters
 *  only in that a container carrying BOTH `[Content_Types].xml` and a
 *  `mimetype` member is read as OPC — see the precedence note in
 *  `discriminate`. Written out row by row, never spread or mapped, so
 *  evaluating the module builds nothing (R34); the plain and ODF rows are the
 *  very objects of `OOXML_FLAVOURS` and `ODF_FLAVOURS`, as they always were. */
export const CONTAINER_FLAVOURS = [
  OOXML_FLAVOURS[0], OOXML_FLAVOURS[1], OOXML_FLAVOURS[2],
  { partMap: "opc", flavour: "docx", variant: "docm", mainContentType: "application/vnd.ms-word.document.macroEnabled.main+xml", conventionalMainPart: "word/document.xml" },
  { partMap: "opc", flavour: "docx", variant: "dotm", mainContentType: "application/vnd.ms-word.template.macroEnabledTemplate.main+xml", conventionalMainPart: "word/document.xml" },
  { partMap: "opc", flavour: "xlsx", variant: "xlsm", mainContentType: "application/vnd.ms-excel.sheet.macroEnabled.main+xml", conventionalMainPart: "xl/workbook.xml" },
  { partMap: "opc", flavour: "xlsx", variant: "xltm", mainContentType: "application/vnd.ms-excel.template.macroEnabled.main+xml", conventionalMainPart: "xl/workbook.xml" },
  { partMap: "opc", flavour: "xlsx", variant: "xlam", mainContentType: "application/vnd.ms-excel.addin.macroEnabled.main+xml", conventionalMainPart: "xl/workbook.xml" },
  { partMap: "opc", flavour: "pptx", variant: "pptm", mainContentType: "application/vnd.ms-powerpoint.presentation.macroEnabled.main+xml", conventionalMainPart: "ppt/presentation.xml" },
  { partMap: "opc", flavour: "pptx", variant: "potm", mainContentType: "application/vnd.ms-powerpoint.template.macroEnabled.main+xml", conventionalMainPart: "ppt/presentation.xml" },
  { partMap: "opc", flavour: "pptx", variant: "ppsm", mainContentType: "application/vnd.ms-powerpoint.slideshow.macroEnabled.main+xml", conventionalMainPart: "ppt/presentation.xml" },
  { partMap: "opc", flavour: "pptx", variant: "ppam", mainContentType: "application/vnd.ms-powerpoint.addin.macroEnabled.main+xml", conventionalMainPart: "ppt/presentation.xml" },
  { partMap: "opc", flavour: "docx", variant: "dotx", mainContentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml", conventionalMainPart: "word/document.xml" },
  { partMap: "opc", flavour: "pptx", variant: "potx", mainContentType: "application/vnd.openxmlformats-officedocument.presentationml.template.main+xml", conventionalMainPart: "ppt/presentation.xml" },
  { partMap: "opc", flavour: "pptx", variant: "ppsx", mainContentType: "application/vnd.openxmlformats-officedocument.presentationml.slideshow.main+xml", conventionalMainPart: "ppt/presentation.xml" },
  ODF_FLAVOURS[0], ODF_FLAVOURS[1], ODF_FLAVOURS[2],
];

/** Which office flavour, if any, this container is — MAGIC BYTES PLUS PARTS,
 *  never the caller-declared content type and never a filename extension
 *  (neither is even an input to the determination; `contentType` is carried
 *  into `signals` purely as corroborating-or-contradicted context, I7).
 *
 *  Returns:
 *    { ok:true,  format:"docx"|"xlsx"|"pptx"|"odt"|"ods"|"odp",
 *                variant, mainPart, confidence:"high", signals }
 *        — `variant` the matched row's (a macro-enabled flavour such as
 *        "xlsm"), null for a plain row;
 *    { ok:true,  format:"zip",  signals }            — a real ZIP, NOT office
 *    { ok:true,  format:"undetermined", why, signals } — a ZIP whose flavour
 *        cannot be honestly discriminated (unreadable/absent-but-declared
 *        parts, an OPC package of an unrecognised type, an ODF-shaped package
 *        whose mimetype we do not know or whose placement is non-conforming).
 *        STATED, never guessed.
 *    { ok:false, why, signals }                      — not a readable ZIP at
 *        all (no magic, truncated central directory, a broken ZIP64
 *        record, …).
 *
 *  The discrimination requires BOTH halves, and that rule is the same on both
 *  part-maps: the DECLARATION (OPC's `[Content_Types].xml` entry for a
 *  flavour's main content type, or ODF's `mimetype` member) AND the declared
 *  part actually present in the central directory. A declaration whose part is
 *  missing is `undetermined: declared_main_part_absent` — bytes contradicting
 *  a claim are surfaced, not smoothed over.
 *
 *  A ZIP carrying NEITHER part map is `format:"zip"` — a POSITIVE
 *  determination, unchanged by COFF-9. (The COFF-9 queue row asks for
 *  "undetermined on a ZIP with neither part map"; what it is buying is "never
 *  a flavour", and `zip` already delivers that while saying MORE than
 *  undetermined does. Turning a determined answer into an undetermined one
 *  would make the record claim LESS than the bytes support and would move a
 *  pinned COFF-2 outcome, so the existing determination stands and the suite
 *  asserts both halves: still `zip`, and never an ODF flavour.) */
export async function discriminate(bytes, contentType = null, flavours = CONTAINER_FLAVOURS) {
  const signals = [];
  if (contentType) {
    let declared;
    try { declared = String(contentType); } catch { declared = "(not a string)"; }
    signals.push(`declared-content-type:${declared} (not used for the determination)`);
  }
  /* R11 (G130c): `bytes` is the file, or a range source standing for it, of
   * any size; the answer is the same either way. A range source that cannot
   * be read answers `source_unreadable`. */
  const range = isRangeSource(bytes) ? sourceOf(bytes) : null;
  if (isRangeSource(bytes) && !range) return { ok: false, why: "source_unreadable", signals };
  try {
    return await judge(range ? bytes : toBytes(bytes), range, signals, flavours);
  } catch (e) {
    if (e instanceof Unreadable) return { ok: false, why: "source_unreadable", signals };
    throw e;
  }
}

async function judge(bytes, range, signals, flavours) {
  const magic = range
    ? range.size >= 4 && u32(await range.read(0, 4), 0) === SIG_LOCAL
    : hasZipMagic(bytes);
  if (!magic) {
    signals.push("magic:absent (no PK\\x03\\x04)");
    return { ok: false, why: "not_a_zip", signals };
  }
  signals.push("magic:zip (PK\\x03\\x04)");

  const container = range ? await readContainerFrom(range) : readContainer(bytes);
  if (!container.ok) {
    /* A ZIP whose central directory cannot be read has NO honest flavour:
     * stated undetermined with the container's own reason, never the readable
     * prefix promoted to a verdict. A limit it was refused on is carried. */
    signals.push(`container:${container.why}`);
    return { ok: false, why: container.why, ...(container.limit !== undefined ? { limit: container.limit, final: true } : {}), signals };
  }
  signals.push(`container:zip entries=${container.count}`);

  /* The table is partitioned by part-map, never merged: the OPC loop below
   * sees only OPC rows and the ODF branch only ODF rows, so neither family
   * can borrow the other's evidence. A row with no `partMap` is OPC (the
   * pre-COFF-9 shape). */
  const opcRows = [];
  const odfRows = [];
  for (const f of Array.isArray(flavours) ? flavours : []) {
    if (f && typeof f === "object") ((f.partMap ?? "opc") === "odf" ? odfRows : opcRows).push(f);
  }

  const ctEntry = container.byName.get(CONTENT_TYPES_PART);
  if (!ctEntry) {
    /* No [Content_Types].xml → not an OPC package. Before that becomes a
     * plain-ZIP verdict, the OTHER part-map gets its turn: ODF declares
     * itself with a `mimetype` member, not with a content-type map.
     *
     * PRECEDENCE, pinned: OPC is tried FIRST and this branch is only reached
     * once `[Content_Types].xml` is known absent, so a container carrying
     * BOTH declarations is read as OPC. No conforming package carries both,
     * and doing it this way is what keeps every pre-COFF-9 OOXML outcome
     * byte-identical — `discriminateOdf` cannot run on, or push a signal
     * into, any container that has a content-type map.
     *
     * It returns null — pushing NOTHING — for a container with no `mimetype`
     * member at all, so a ZIP with neither part map reaches the plain-ZIP
     * determination below with exactly the result object it always had. */
    const odf = odfRows.length ? await discriminateOdf(bytes, container, odfRows, signals) : null;
    if (odf) return odf;
    signals.push(`part:${CONTENT_TYPES_PART} absent → plain ZIP`);
    return { ok: true, format: "zip", signals };
  }

  const ctBytes = await readPartOf(bytes, container, CONTENT_TYPES_PART, true);
  if (!ctBytes.ok) {
    signals.push(`part:${CONTENT_TYPES_PART} unreadable (${ctBytes.why})`);
    return { ok: true, format: "undetermined", why: `content_types_unreadable:${ctBytes.why}`, signals };
  }
  const ctText = decodeText(ctBytes.bytes, { name: CONTENT_TYPES_PART, kind: "xml" });
  const types = ctText.ok ? parseContentTypes(ctText.text) : { ok: false, why: "content_types_unparseable" };
  if (!types.ok) {
    signals.push(`part:${CONTENT_TYPES_PART} present but unparseable`);
    return { ok: true, format: "undetermined", why: "content_types_unparseable", ...(types.final ? { final: true } : {}), signals };
  }
  signals.push(`part:${CONTENT_TYPES_PART} parsed (${types.defaults.size} defaults, ${types.overrides.size} overrides)`);

  for (const f of opcRows) {
    /* The declaration half: any part whose computed content type is this
     * flavour's main type. Overrides carry it in practice; defaults are
     * checked too so a default-typed package is not missed. */
    let declared = null;
    for (const [part, ct] of types.overrides) {
      if (ct === f.mainContentType) { declared = part; break; }
    }
    if (!declared) {
      const conv = normalizePartName(f.conventionalMainPart);
      if (partContentType(conv, types) === f.mainContentType) declared = conv;
    }
    if (!declared) continue;

    /* The parts half: the declared main part must actually exist. */
    const present = container.byName.has(declared)
      || container.entries.some((e) => normalizePartName(e.name) === declared);
    if (!present) {
      signals.push(`ct:${f.mainContentType} declared for ${declared}, but the part is ABSENT`);
      return { ok: true, format: "undetermined", why: "declared_main_part_absent", flavourDeclared: f.flavour, signals };
    }
    signals.push(`ct:${f.mainContentType}`, `part:${declared} present`);
    return { ok: true, format: f.flavour, variant: f.variant ?? null, mainPart: declared, confidence: "high", signals };
  }

  /* An OPC package (it has a readable [Content_Types].xml) that is none of
   * the known flavours — e.g. .vsdx, or a future format. Undetermined and
   * SAID so, never rounded to "zip" (which would erase the OPC evidence) and
   * never guessed into a flavour. */
  signals.push("opc:no known main content type");
  return { ok: true, format: "undetermined", why: "opc_main_part_unrecognized", signals };
}

/** The ODF half of `discriminate` (COFF-9). Called ONLY where `discriminate`
 *  has already established there is no `[Content_Types].xml`.
 *
 *  Returns a `discriminate`-shaped result, or NULL when the container carries
 *  no ODF evidence whatsoever (no `mimetype` member) — in which case it has
 *  pushed no signal and the caller makes its own plain-ZIP determination,
 *  identical to the pre-COFF-9 one.
 *
 *  ---------------------------------------------------------------- PINNED
 *  THE DECISION THE COFF-9 ROW ASKS FOR, made here with its reason: a
 *  `mimetype` member that is PRESENT BUT NOT FIRST, or PRESENT BUT
 *  COMPRESSED, is REFUSED into a stated `undetermined`. It is never accepted
 *  as a flavour, and it is never silently ignored either — the container came
 *  in carrying ODF's own signature part, and saying nothing about that would
 *  be the silent outcome the row forbids.
 *
 *  WHY REFUSE rather than accept:
 *
 *   1. The rule is the FORMAT'S, not ours. OpenDocument 1.2 part 3 §3.3 says
 *      the `mimetype` stream SHALL be first and SHALL be stored uncompressed.
 *      A fence that matches the spec is not a fence tighter than its rule.
 *   2. FIRST-AND-STORED IS WHAT MAKES THE SIGNAL WORTH ANYTHING. It is the
 *      reason the media type sits at a fixed offset near the head of the file
 *      and the reason the format is sniffable at all. Drop the placement
 *      requirement and the determination rests on nothing but a filename
 *      occurring somewhere inside an archive — a weaker basis than the OPC
 *      side is held to, which demands a declaration AND the part it names.
 *   3. MEASURED, so the refusal is known to cost nothing observed: every one
 *      of the three real producer packages measured on 2026-09-14 has
 *      `mimetype` first, stored, at local-header offset 0, with a zero-length
 *      extra field (MEASUREMENTS.md). Google Drive's export — the source
 *      Bob's ruling actually points this at — is a conforming producer.
 *   4. It is the CHEAPLY REVERSIBLE direction. A refusal is stated, named and
 *      visible in `signals`; widening it later takes one measurement of a
 *      real non-conforming producer and a comment saying which one. Accepting
 *      first and discovering later that we flavoured something that was not
 *      an ODF document is the direction that puts an overclaim in the record.
 *
 *  WHAT THIS CHECK CANNOT SEE, stated rather than implied: it does not read
 *  the local header's EXTRA FIELD, which §3.3 also requires to be empty. The
 *  value is verified by length and CRC-32 through `readPart` either way, so
 *  an extra field cannot corrupt the comparison — it would only mean a
 *  package that is non-conforming in a way we accept. Named here so the next
 *  reader knows it is a deliberate gap and not an oversight.
 *  ------------------------------------------------------------------------
 */
async function discriminateOdf(bytes, container, rows, signals) {
  const mimeEntry = container.byName.get(ODF_MIMETYPE_PART)
    ?? container.entries.find((e) => normalizePartName(e.name) === ODF_MIMETYPE_PART);
  if (!mimeEntry) return null; // no ODF evidence at all — not this branch's business

  /* FIRST means first in the archive, checked two ways because the ZIP format
   * does not require the central directory's order to match the members'
   * physical order: the mimetype must head the central directory AND no other
   * member may lie earlier in the file. */
  let earliest = Infinity;
  for (const e of container.entries) if (e.localHeaderOffset < earliest) earliest = e.localHeaderOffset;
  if (container.entries[0] !== mimeEntry || mimeEntry.localHeaderOffset !== earliest) {
    signals.push(`odf:${ODF_MIMETYPE_PART} present but NOT the first archive member`
      + ` (central-directory index ${container.entries.indexOf(mimeEntry)},`
      + ` local-header offset ${mimeEntry.localHeaderOffset}, earliest ${earliest})`);
    return { ok: true, format: "undetermined", why: "odf_mimetype_not_first", signals };
  }
  if (mimeEntry.method !== 0) {
    signals.push(`odf:${ODF_MIMETYPE_PART} is first but COMPRESSED (method ${mimeEntry.method}, ODF requires stored)`);
    return { ok: true, format: "undetermined", why: "odf_mimetype_not_stored", signals };
  }
  if (mimeEntry.uncompressedSize > ODF_MIMETYPE_MAX_BYTES) {
    signals.push(`odf:${ODF_MIMETYPE_PART} declares ${mimeEntry.uncompressedSize} bytes,`
      + ` over ODF_MIMETYPE_MAX_BYTES=${ODF_MIMETYPE_MAX_BYTES}`);
    return { ok: true, format: "undetermined", why: "odf_mimetype_oversized", signals };
  }

  const read = await readPartOf(bytes, container, ODF_MIMETYPE_PART, true);
  if (!read.ok) {
    signals.push(`odf:${ODF_MIMETYPE_PART} unreadable (${read.why})`);
    return { ok: true, format: "undetermined", why: `odf_mimetype_unreadable:${read.why}`, signals };
  }

  /* EXACT comparison, never trimmed. §3.3 says the stream's content IS the
   * media type and nothing else, and the value is the whole discriminator —
   * so a trailing newline is a non-conforming producer to be NAMED, not a
   * difference to be absorbed. `undetermined` carries the value it actually
   * read, which is what makes such a producer diagnosable in one look. */
  const decoded = decodeText(read.bytes, { name: ODF_MIMETYPE_PART, kind: "text" });
  const declared = decoded.ok ? decoded.text : null;
  const row = declared === null ? undefined : rows.find((f) => f.mimetype === declared);
  if (!row) {
    /* The part names may look exactly like an ODF package's — this is the
     * negative control the row names — and it still is not one. Undetermined
     * rather than "zip", for the same reason .vsdx is: a first-and-stored
     * `mimetype` IS positive evidence of a media-type-declaring container
     * (an EPUB is the obvious other one), and rounding it to "zip" would
     * erase that evidence. */
    signals.push(`odf:${ODF_MIMETYPE_PART}=${JSON.stringify(declared)} is no known OpenDocument media type`);
    return { ok: true, format: "undetermined", why: "odf_mimetype_unrecognized", signals };
  }
  signals.push(`odf:${ODF_MIMETYPE_PART} ${declared} (first member, stored)`);

  /* The parts half — the same both-halves rule the OPC branch applies. */
  const manifestPresent = container.byName.has(ODF_MANIFEST_PART)
    || container.entries.some((e) => normalizePartName(e.name) === ODF_MANIFEST_PART);
  if (!manifestPresent) {
    signals.push(`odf:${ODF_MANIFEST_PART} ABSENT`);
    return { ok: true, format: "undetermined", why: "odf_manifest_absent", flavourDeclared: row.flavour, signals };
  }
  const main = normalizePartName(row.conventionalMainPart);
  const mainPresent = container.byName.has(main)
    || container.entries.some((e) => normalizePartName(e.name) === main);
  if (!mainPresent) {
    signals.push(`odf:mimetype declares ${row.flavour}, but ${main} is ABSENT`);
    return { ok: true, format: "undetermined", why: "declared_main_part_absent", flavourDeclared: row.flavour, signals };
  }

  signals.push(`part:${ODF_MANIFEST_PART} present`, `part:${main} present`);
  return { ok: true, format: row.flavour, variant: row.variant ?? null, mainPart: main, confidence: "high", signals };
}

/* ------------------------------------------------------------------ *
 * The uniform _rels walker — one relationship grammar for all three OPC
 * formats (ODF carries no `_rels/*.rels`; its manifest is its part list)
 * ------------------------------------------------------------------ */

/** The conventional .rels part for a part name (OPC): the package root's is
 *  `_rels/.rels`; a part `word/document.xml`'s is
 *  `word/_rels/document.xml.rels`. */
export function relsPartFor(partName = null) {
  if (partName == null || partName === "") return "_rels/.rels";
  const norm = normalizePartName(partName);
  const slash = norm.lastIndexOf("/");
  const dir = slash < 0 ? "" : norm.slice(0, slash + 1);
  const base = slash < 0 ? norm : norm.slice(slash + 1);
  return `${dir}_rels/${base}.rels`;
}

/** Every `_rels/*.rels` part in the container, in central-directory order. */
export function listRelsParts(container) {
  return entriesOf(container)
    .map((e) => normalizePartName(e.name))
    .filter((n) => /(^|\/)_rels\/[^/]*\.rels$/.test(n)); // [^/]* — the package root's is the bare `_rels/.rels`
}

/** Parse one .rels document. `TargetMode="External"` → OUTBOUND (the uniform
 *  property that makes office formats one registry entry rather than three
 *  parsers); anything else — absent TargetMode or "Internal" — targets a part
 *  inside the package. Returns
 *  `{ ok:true, relationships:[{id,type,target,targetMode,external}], outbound:[…external rels] }`
 *  or `{ ok:false, why:"rels_unparseable" }`. */
export function parseRels(xml) {
  if (typeof xml !== "string" || !/<(?:[\w.-]+:)?Relationships\b/.test(xml)) {
    return { ok: false, why: "rels_unparseable" };
  }
  if (malformedReferences(xml)) return { ok: false, why: "rels_unparseable", final: true };
  const relationships = xmlElements(xml, "Relationship")
    .filter((a) => a.Target != null)
    .map((a) => ({
      id: a.Id ?? null,
      type: a.Type ?? null,
      target: a.Target,
      targetMode: a.TargetMode ?? null,
      external: a.TargetMode === "External",
    }));
  return { ok: true, relationships, outbound: relationships.filter((r) => r.external) };
}

/** Walk EVERY .rels part in the container and aggregate, keeping per-part
 *  attribution and keeping unreadable parts STATED in `undetermined` rather
 *  than dropped:
 *  `{ ok:true, byPart:[{part, relationships, outbound}], outbound:[{part, …rel}], undetermined:[{part, why}] }` */
export async function walkRels(bytes, container) {
  const byPart = [];
  const outbound = [];
  const undetermined = [];
  for (const part of listRelsParts(container)) {
    const read = await readPartOf(bytes, container, part, true);
    if (!read.ok) { undetermined.push({ part, why: read.why }); continue; }
    const text = decodeText(read.bytes, { name: part, kind: "xml" });
    const parsed = text.ok ? parseRels(text.text) : { ok: false, why: "rels_unparseable" };
    if (!parsed.ok) { undetermined.push({ part, why: parsed.why, ...(parsed.final ? { final: true } : {}) }); continue; }
    byPart.push({ part, relationships: parsed.relationships, outbound: parsed.outbound });
    for (const r of parsed.outbound) outbound.push({ part, ...r });
  }
  return { ok: true, byPart, outbound, undetermined };
}

/* ------------------------------------------------------------------ *
 * docProps/core.xml — the metadata the publisher's own software recorded
 * (DEC-5: who edited a document and when IS evidence)
 * ------------------------------------------------------------------ */

export const CORE_PROPERTIES_PART = "docProps/core.xml";

/** Parse core.xml text. Fields the queue names as evidentiary: creator,
 *  lastModifiedBy, revision (count), created/modified (instants). Each is the
 *  string the file carries or null when ABSENT — absence recorded, never
 *  filled in. `revision` additionally carries `revisionNumber` when (and only
 *  when) the string is a plain integer. */
export function parseCoreProperties(xml) {
  if (typeof xml !== "string" || !/<(?:[\w.-]+:)?coreProperties\b/.test(xml)) {
    return { ok: false, why: "core_properties_unparseable" };
  }
  if (malformedReferences(xml)) return { ok: false, why: "core_properties_unparseable", final: true };
  const revision = xmlElementText(xml, "revision");
  const revisionNumber = revision != null && /^\d+$/.test(revision.trim())
    ? parseInt(revision.trim(), 10) : null;
  return {
    ok: true,
    creator: xmlElementText(xml, "creator"),
    lastModifiedBy: xmlElementText(xml, "lastModifiedBy"),
    revision,
    revisionNumber,
    created: xmlElementText(xml, "created"),
    modified: xmlElementText(xml, "modified"),
    title: xmlElementText(xml, "title"),
  };
}

/** Read and parse `docProps/core.xml` from a container. A package without one
 *  (it is optional in OPC) is `{ ok:false, why:"part_absent" }` — stated, and
 *  distinct from a package whose core.xml exists but cannot be read. */
export async function readCoreProperties(bytes, container) {
  const read = await readPartOf(bytes, container, CORE_PROPERTIES_PART, true);
  if (!read.ok) return { ok: false, why: read.why };
  const text = decodeText(read.bytes, { name: CORE_PROPERTIES_PART, kind: "xml" });
  return text.ok ? parseCoreProperties(text.text) : { ok: false, why: "core_properties_unparseable" };
}

/* ------------------------------------------------------------------ *
 * FW-19 / IC-124 — THE `image` REFERENCE (EXTRACTION-BREADTH §3.2)
 * ------------------------------------------------------------------ *
 *
 * An image cited AS ITSELF is bytes, not text (§3.1): a map, a signature, a
 * chart cited for what it shows. Its address inside a container is the
 * CONTENT HASH of the media part, never the part NAME — a name is the
 * producer's filing choice and two saves of one document may renumber
 * `image1.png`, while the bytes are the image. So the reference is
 *
 *   { kind:"image", ref:"image <first 12 hex of part>", part:<sha256>, mime, name }
 *
 * `ref` is DERIVED FROM THE ADDRESS and not from the name, and that is IC-1's
 * parity rule rather than taste: `describeExtent` in the checker composes the
 * human form a member's citation gets when they author none, it can see only
 * the address, and REC-85's rule is that the two strings are the same string.
 * The name rides beside it for a person to recognise.
 *
 * ONE ENUMERATOR FOR ALL SIX ENTRIES, living here beside `readPart` because
 * it is a CONTAINER fact: which members are images is a question about the
 * package, and each entry supplies only its media directory (`word/media/`,
 * `xl/media/`, `ppt/media/`, OpenDocument's `Pictures/`).
 *
 * THE LIST IS EXHAUSTIVE OR IT IS NULL, and that is the property the
 * out-of-range refusal rests on. The checker refuses a part the container
 * does not hold; if one media member could not be read and this returned the
 * others, a citation of the unread one (a member can hash the file themselves)
 * would be refused as absent when it is present — the record refusing a true
 * citation. So a single unreadable member, or media over the size bound, makes
 * the whole list NULL with the reason stated, and NULL is SKIPPED by the
 * checker rather than read as "no images". An EMPTY list is a real zero: the
 * directory was looked in and held no image.
 *
 * WHAT IS NOT ENUMERATED, stated: a media member whose extension is not an
 * image type (audio, video, an OLE blob) — it is not an image, and the
 * embedded-object path (`intra`) already content-addresses embeddings. */

/** Extension -> MIME for the image types office containers carry. A member
 *  whose extension is not here is not enumerated as an image. */
export const IMAGE_MIME_BY_EXT = Object.freeze({
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", jpe: "image/jpeg",
  gif: "image/gif", bmp: "image/bmp", tif: "image/tiff", tiff: "image/tiff",
  svg: "image/svg+xml", webp: "image/webp", emf: "image/emf", wmf: "image/wmf",
  emz: "image/x-emz", wmz: "image/x-wmz",
});

const IMAGE_HEX = "0123456789abcdef";
async function imageSha256(u8) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", u8));
  let out = "";
  for (let i = 0; i < d.length; i++) out += IMAGE_HEX[d[i] >> 4] + IMAGE_HEX[d[i] & 15];
  return out;
}

/** The IC-1 `image` reference for a container media part. */
export function imageRef(part, mime = null, name = null) {
  return { kind: "image", ref: `image ${String(part).slice(0, 12)}`, part, mime, name };
}

/** Every image member under `dir`, content-addressed, in central-directory
 *  order. Returns `{ images: [imageRef...], why: null }` or
 *  `{ images: null, why }` — never a partial list. */
export async function containerImages(bytes, container, dir) {
  const want = normalizePartName(dir);
  const members = [];
  let declared = 0;
  for (const e of entriesOf(container)) {
    const name = normalizePartName(e.name);
    if (!name.startsWith(want) || name === want || name.endsWith("/")) continue;
    const dot = name.lastIndexOf(".");
    const mime = dot > name.lastIndexOf("/") ? IMAGE_MIME_BY_EXT[name.slice(dot + 1).toLowerCase()] ?? null : null;
    if (!mime) continue;
    members.push({ name, mime });
    declared += e.uncompressedSize;
  }
  /* The same bound and the same metric as the text parts (declared
     uncompressed bytes, from the central directory, before inflation):
     hashing inflates every member, and an unbounded inflate on a Worker is
     what COFF-6 measured the bound for. Over it the list is NULL and SAYS SO
     — never a prefix of it. */
  const g = sizeGuard(declared);
  if (!g.ok) return { images: null, why: `media_over_size_bound:${declared}>${g.bound}` };
  const images = [];
  for (const m of members) {
    const read = await readPart(bytes, container, m.name);
    if (!read.ok) return { images: null, why: `media_part_unreadable:${m.name}:${read.why}` };
    images.push(imageRef(await imageSha256(read.bytes), m.mime,
      m.name.slice(m.name.lastIndexOf("/") + 1)));
  }
  return { images, why: null };
}

/** An entry's SUCCESSFUL `text()` output with `images` added — the one way
 *  all six entries attach it, so the key's meaning cannot drift per entry.
 *  A failed text() (`ok:false`) is returned untouched: no container was read,
 *  so there is no media directory to have looked in. On a successful read
 *  `images` is the exhaustive list or NULL, and a NULL carries `imagesWhy`. */
export async function withContainerImages(outOrPromise, parts, dir) {
  const out = await outOrPromise;
  if (!out || !out.ok || !parts || !parts.ok || !parts.container) return out;
  const got = await containerImages(parts.bytes, parts.container, dir);
  return got.images ? { ...out, images: got.images }
                    : { ...out, images: null, imagesWhy: got.why };
}

/* ------------------------------------------------------------------ *
 * ZIP ARCHIVES (N688; K1844, K1852): a validated listing and a verified cut
 * ------------------------------------------------------------------ *
 *
 * An archive is a capture; each member that can be cut out UNAMBIGUOUSLY is a
 * capture of its own carrying the archive's grade unchanged (Intake §3,
 * K1852). Everything here serves the one word "unambiguously": the listing
 * reads the archive the way the most careful tool would, cross-checks every
 * local header against the central directory, and names anything two honest
 * tools could read two ways, so nothing ambiguous is ever cut. The cut then
 * proves each member by its size, its CRC-32 and the end of its deflate
 * stream, hashing it as it passes. Nothing is ever written as a path: a name
 * is the archive's claim, stated, and a member is addressed by its index.
 *
 * Both take the archive as bytes or as a RANGE SOURCE `{size, read(offset,
 * length)}`, so a 256 MiB archive held in 8 MiB parts is listed by reading
 * only its structures and cut one window at a time. */

/* IBM code page 437's upper half (APPNOTE Appendix D), for names stored
 * without bit 11. The lower half is ASCII, as Python's `cp437` codec and
 * Info-ZIP read it (control codes stay control codes). */
const CP437_HIGH =
  "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐"
  + "└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ";
function cp437(bytes) {
  let s = "";
  for (const x of bytes) s += x < 0x80 ? String.fromCharCode(x) : CP437_HIGH[x - 0x80];
  return s;
}
const UTF8_STRICT = new TextDecoder("utf-8", { fatal: true });
const hex = (bytes) => Array.from(bytes, (x) => x.toString(16).padStart(2, "0")).join("");
const sameBytes = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/* The stated MS-DOS date and time (APPNOTE §4.4.6), no zone; null when the
 * fields name no real instant (month 0, February 30, second 60, …). */
function dosTime(time, date) {
  const y = 1980 + (date >>> 9), mo = (date >>> 5) & 15, d = date & 31;
  const h = time >>> 11, mi = (time >>> 5) & 63, s = (time & 31) * 2;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
  if (!days || d < 1 || d > days || h > 23 || mi > 59 || s > 59) return null;
  const p = (n) => String(n).padStart(2, "0");
  return `${y}-${p(mo)}-${p(d)}T${p(h)}:${p(mi)}:${p(s)}`;
}

/* A name that could reach outside a directory if anything used it as a path:
 * a `..` segment, a leading `/` or `\`, a drive letter, a `\` or a NUL. */
function pathUnsafe(name) {
  return /^[/\\]/.test(name) || /^[A-Za-z]:/.test(name) || /[\\\0]/.test(name)
    || name.split(/[/\\]/).includes("..");
}

class Unreadable extends Error {}

/* The two kinds of source behind one interface. A range source's answer must
 * hold `length` bytes; fewer, a rejection or a non-byte answer makes the whole
 * service answer `source_unreadable`, never a partial reading. */
function sourceOf(source) {
  if (!isRangeSource(source)) {
    const b = toBytes(source);
    return { size: b.length, read: async (offset, length) => b.subarray(offset, offset + length), whole: b };
  }
  const size = source.size;
  if (!Number.isSafeInteger(size) || size < 0) return null;
  return {
    size,
    async read(offset, length) {
      if (length === 0) return new Uint8Array(0);
      let got;
      try { got = await source.read(offset, length); } catch { throw new Unreadable(); }
      if (got instanceof ArrayBuffer) got = new Uint8Array(got);
      else if (ArrayBuffer.isView(got) && !(got instanceof Uint8Array)) got = new Uint8Array(got.buffer, got.byteOffset, got.byteLength);
      if (!(got instanceof Uint8Array) || got.length < length) throw new Unreadable();
      return got.length === length ? got : got.subarray(0, length);
    },
  };
}

/** List an archive: every central-directory entry with its verdict (R27,
 *  R28). Async; never throws. */
export async function listArchive(source) {
  try {
    const src = sourceOf(source);
    if (!src) return { ok: false, why: "source_unreadable", entries: null };
    return await listFrom(src);
  } catch {
    return { ok: false, why: "source_unreadable", entries: null };
  }
}

const refusal = (why, extra = {}) => ({ ok: false, why, ...extra, entries: null });
const ambiguous = (detail, entries) => ({ ok: false, why: "ARCHIVE_AMBIGUOUS", detail, entries });

async function listFrom(src) {
  const { size } = src;
  if (size < 22) return refusal("too_short_for_zip");

  /* THE END RECORD. R3's window (22 bytes plus a comment of up to 65,535),
   * but stricter than R3's backward scan: a candidate is an offset holding the
   * signature whose comment length reaches EXACTLY the archive's end. One
   * candidate is the end record; two are two archives in one file, which
   * different tools resolve differently, so the archive is not read as one. */
  const winStart = Math.max(0, size - 22 - 0xffff);
  const win = await src.read(winStart, size - winStart);
  const candidates = [];
  for (let p = win.length - 22; p >= 0; p--) {
    if (u32(win, p) === SIG_EOCD && p + 22 + u16(win, p + 20) === win.length) candidates.push(winStart + p);
  }
  if (candidates.length === 0) return refusal("eocd_not_found");
  if (candidates.length > 1) return ambiguous("several_eocd_candidates", null);
  const eocd = candidates[0];
  const end = parseEocd(win, eocd - winStart);
  let { diskEntries, totalEntries, cdSize, cdOffset } = end;
  let directoryEnd = eocd;
  let zip64 = false;

  /* ZIP64: read whenever its locator stands directly before the EOCD (some
   * writers emit it for small archives too), and required when the EOCD holds
   * a sentinel. Where both records state a field, they must agree. */
  const locAt = eocd - 20;
  const loc = locAt >= 0 ? await src.read(locAt, 20) : null;
  const hasLocator = !!loc && u32(loc, 0) === SIG_ZIP64_LOCATOR;
  if (needsZip64(end) || hasLocator) {
    const recAt = zip64RecordOffset(loc);
    const z = Number.isFinite(recAt) && recAt + 56 <= locAt
      ? zip64End(loc, locAt, await src.read(recAt, 56), recAt) : null;
    if (!z) return refusal("zip64_record_invalid");
    for (const k of Object.keys(ZIP64_SENTINELS)) {
      if (end[k] !== ZIP64_SENTINELS[k] && end[k] !== z[k]) return ambiguous("directory_disagrees_with_eocd", null);
    }
    ({ diskEntries, totalEntries, cdSize, cdOffset } = z);
    directoryEnd = z.recordOffset;
    zip64 = true;
  }
  if (diskEntries !== totalEntries) return refusal("multi_disk_unsupported");
  if (totalEntries > ARCHIVE_ENTRIES_MAX) return refusal("ARCHIVE_ENTRIES_MAX", { limit: ARCHIVE_ENTRIES_MAX, final: true });
  if (cdSize > ARCHIVE_DIRECTORY_MAX) return refusal("ARCHIVE_DIRECTORY_MAX", { limit: ARCHIVE_DIRECTORY_MAX, final: true });
  if (cdOffset + cdSize > directoryEnd) return refusal("central_directory_truncated");

  /* THE CENTRAL DIRECTORY, every record, the sole authority (R24). */
  const cd = await src.read(cdOffset, cdSize);
  const records = [];
  let p = 0;
  for (let i = 0; i < totalEntries; i++) {
    if (p + 46 > cd.length || u32(cd, p) !== SIG_CENTRAL) return refusal("central_directory_truncated");
    const nameLen = u16(cd, p + 28), extraLen = u16(cd, p + 30), commentLen = u16(cd, p + 32);
    if (nameLen > ARCHIVE_NAME_MAX) return refusal("ARCHIVE_NAME_MAX", { limit: ARCHIVE_NAME_MAX, final: true });
    if (p + 46 + nameLen + extraLen + commentLen > cd.length) return refusal("central_directory_truncated");
    const nameBytes = cd.subarray(p + 46, p + 46 + nameLen);
    const values = centralValues(cd, p, cd.subarray(p + 46 + nameLen, p + 46 + nameLen + extraLen));
    if (!values) return refusal("zip64_record_invalid");
    records.push({
      nameBytes, values, madeBy: u16(cd, p + 4), flags: u16(cd, p + 8), method: u16(cd, p + 10),
      time: u16(cd, p + 12), date: u16(cd, p + 14), crc: u32(cd, p + 16), external: u32(cd, p + 38),
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  /* The records must fill the declared directory exactly, and the directory
   * must end where the end records begin: bytes left between them are where
   * a prefixed or concatenated archive shows itself (Info-ZIP and Python shift
   * every offset by them; this reader would not). Two readings: refused, with
   * the rows as read. */
  const directoryFilled = p === cd.length && cdOffset + cdSize === directoryEnd;

  /* R38 (G133e): the directory is read once above; the local headers are
   * read in the order they lie in the file, whatever order the directory
   * lists the entries in, so a source that fetches parts of a file reads each
   * part once and not once per jump. The rows keep the directory's order. */
  const entries = records.map((r, index) => rowOf(index, r));
  const ranges = [];
  let outOfRange = false;
  const physical = entries.map((_, i) => i).sort((a, b) => entries[a].local_offset - entries[b].local_offset || a - b);
  for (const i of physical) {
    const row = entries[i];
    const local = await crossCheck(src, records[i], row, cdOffset);
    if (local.outOfRange) outOfRange = true;
    ranges.push(local.range);
    row.verdict = verdictOf(row, local.agrees);
    if (row.verdict === "MEMBER_MAX") Object.assign(row, { limit: MEMBER_MAX, final: true });
    if (row.verdict === "ARCHIVE_RATIO_MAX") Object.assign(row, { limit: ARCHIVE_RATIO_MAX, final: true });
  }
  const shared = new Map();
  for (const row of entries) shared.set(row.name_raw, (shared.get(row.name_raw) ?? 0) + 1);
  for (const row of entries) row.name_shared = shared.get(row.name_raw);

  if (!directoryFilled) return ambiguous("directory_disagrees_with_eocd", entries);
  if (outOfRange) return ambiguous("entry_out_of_range", entries);
  ranges.sort((a, b) => a[0] - b[0]);
  for (let i = 1, reach = ranges[0]?.[1]; i < ranges.length; i++) {
    if (ranges[i][0] < reach) return ambiguous("entries_overlap", entries);
    reach = Math.max(reach, ranges[i][1]);
  }

  let declared_total = 0;
  for (const row of entries) if (row.kind === "file") declared_total += row.uncompressed;
  const out = { ok: true, entries, count: entries.length, declared_total, zip64, verdict: "ok" };
  if (declared_total > ARCHIVE_TOTAL_MAX) { out.verdict = "ARCHIVE_TOTAL_MAX"; out.limit = ARCHIVE_TOTAL_MAX; out.final = true; }
  return out;
}

/* One row as the central directory states it (R27). */
function rowOf(index, r) {
  let name, name_encoding;
  if (r.flags & 0x0800) {
    try { name = UTF8_STRICT.decode(r.nameBytes); name_encoding = "utf-8"; } catch { name = null; name_encoding = "utf-8-invalid"; }
  } else {
    name = cp437(r.nameBytes);
    name_encoding = "cp437";
  }
  const asStated = name ?? LATIN1.decode(r.nameBytes);
  const unixType = (r.madeBy >>> 8) === 3 ? (r.external >>> 16) & 0o170000 : 0;
  return {
    index, name_raw: hex(r.nameBytes), name, name_encoding, name_shared: 1, path_unsafe: pathUnsafe(asStated),
    method: r.method, flags: r.flags, crc32: r.crc, compressed: r.values.compressed,
    uncompressed: r.values.uncompressed, local_offset: r.values.offset, data_offset: null,
    dos_time: dosTime(r.time, r.date),
    kind: r.nameBytes.length && r.nameBytes[r.nameBytes.length - 1] === 0x2f ? "dir" : unixType === 0o120000 ? "symlink" : "file",
    encrypted: (r.flags & 0x2041) !== 0 || r.method === 99,
    verdict: null,
  };
}

/* The local header (and, under bit 3, the data descriptor) against the
 * central directory. Answers whether they agree, the entry's byte range
 * (local header to the end of its data and descriptor) and whether any of it
 * runs past the archive's end or into the central directory. Reads only the
 * structures, never the member's data. */
async function crossCheck(src, r, row, cdOffset) {
  const lo = row.local_offset;
  if (lo + 30 > cdOffset) return { agrees: false, outOfRange: true, range: [lo, lo + 30] };
  const lh = await src.read(lo, 30);
  if (u32(lh, 0) !== SIG_LOCAL) return { agrees: false, outOfRange: false, range: [lo, lo + 30] };
  const nameLen = u16(lh, 26), extraLen = u16(lh, 28);
  const dataOffset = lo + 30 + nameLen + extraLen;
  if (dataOffset > cdOffset) return { agrees: false, outOfRange: true, range: [lo, dataOffset] };
  row.data_offset = dataOffset;
  const ne = await src.read(lo + 30, nameLen + extraLen);
  const localZip64 = zip64Extra(ne.subarray(nameLen), { uncompressed: true, compressed: true });
  let agrees = sameBytes(ne.subarray(0, nameLen), r.nameBytes)
    && u16(lh, 6) === r.flags && u16(lh, 8) === r.method;
  let end = dataOffset + row.compressed;
  if (end > cdOffset) return { agrees, outOfRange: true, range: [lo, end] };

  if (r.flags & 0x0008) {
    /* The descriptor follows the data: an optional signature, the CRC-32,
     * then both sizes, 8 bytes each when the local header carries ZIP64. */
    const width = localZip64 ? 8 : 4;
    const avail = Math.min(4 + 4 + 2 * width, cdOffset - end);
    const d = await src.read(end, avail);
    const signed = avail >= 4 && u32(d, 0) === SIG_DESCRIPTOR;
    const length = (signed ? 4 : 0) + 4 + 2 * width;
    if (length > avail) return { agrees, outOfRange: true, range: [lo, end + length] };
    const q = signed ? 4 : 0;
    const read = (at) => (width === 8 ? u64(d, at) : u32(d, at));
    agrees = agrees && u32(d, q) === row.crc32 && read(q + 4) === row.compressed && read(q + 4 + width) === row.uncompressed;
    end += length;
  } else {
    let compressed = u32(lh, 18), uncompressed = u32(lh, 22);
    if (compressed === 0xffffffff || uncompressed === 0xffffffff) {
      if (!localZip64) agrees = false;
      else ({ compressed, uncompressed } = localZip64);
    }
    agrees = agrees && u32(lh, 14) === row.crc32 && compressed === row.compressed && uncompressed === row.uncompressed;
  }
  return { agrees, outOfRange: false, range: [lo, end] };
}

/* R28's per-row verdict: the first that applies. */
function verdictOf(row, agrees) {
  if (row.kind === "dir") return "directory";
  if (row.kind === "symlink") return "symlink";
  if (row.encrypted) return "MEMBER_ENCRYPTED";
  if (row.method !== 0 && row.method !== 8) return "MEMBER_METHOD_UNSUPPORTED";
  if (!agrees) return "MEMBER_AMBIGUOUS";
  if (row.uncompressed > MEMBER_MAX) return "MEMBER_MAX";
  if (row.uncompressed > row.compressed * ARCHIVE_RATIO_MAX) return "ARCHIVE_RATIO_MAX";
  return "ok";
}

/* ------------------------------------------------------------------ *
 * SHA-256, streamed (R29)
 * ------------------------------------------------------------------ *
 *
 * `crypto.subtle.digest` takes a whole buffer, and a member may be 256 MiB in
 * a 128 MB Worker, so the cut hashes as the bytes pass: through the host's
 * own `crypto.DigestStream` where it has one (workerd), else through the
 * FIPS 180-4 compression function below. Both answer the same digest as
 * `crypto.subtle.digest` over the same bytes (the suite proves it). The round
 * constants become a table on the first digest this module computes itself,
 * and are kept (R34). */
let shaK = null;
const shaKOf = () => shaK ?? (shaK = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]));
function sha256Js() {
  const K = shaKOf();
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const W = new Uint32Array(64);
  const block = new Uint8Array(64);
  let filled = 0, length = 0;
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  const compress = (m, at) => {
    for (let t = 0; t < 16; t++) W[t] = (m[at + 4 * t] << 24) | (m[at + 4 * t + 1] << 16) | (m[at + 4 * t + 2] << 8) | m[at + 4 * t + 3];
    for (let t = 16; t < 64; t++) {
      const a = W[t - 15], b = W[t - 2];
      W[t] = (W[t - 16] + (rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3)) + W[t - 7] + (rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10))) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + W[t]) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  };
  return {
    update(u8) {
      length += u8.length;
      let i = 0;
      if (filled) {
        const take = Math.min(64 - filled, u8.length);
        block.set(u8.subarray(0, take), filled);
        filled += take; i = take;
        if (filled < 64) return;
        compress(block, 0); filled = 0;
      }
      for (; i + 64 <= u8.length; i += 64) compress(u8, i);
      block.set(u8.subarray(i), 0);
      filled = u8.length - i;
    },
    async finish() {
      const bits = length * 8;
      const tail = new Uint8Array(filled < 56 ? 64 : 128);
      tail.set(block.subarray(0, filled));
      tail[filled] = 0x80;
      const v = new DataView(tail.buffer);
      v.setUint32(tail.length - 8, Math.floor(bits / 0x100000000));
      v.setUint32(tail.length - 4, bits >>> 0);
      for (let at = 0; at < tail.length; at += 64) compress(tail, at);
      return Array.from(H, (x) => x.toString(16).padStart(8, "0")).join("");
    },
  };
}
function sha256Stream() {
  const DS = globalThis.crypto?.DigestStream;
  if (typeof DS !== "function") return sha256Js();
  const stream = new DS("SHA-256");
  const writer = stream.getWriter();
  return {
    update: (u8) => writer.write(u8.slice()),
    async finish() { await writer.close(); return hex(new Uint8Array(await stream.digest)); },
  };
}

/** Cut one member (R29): `{chunks, done}`. Never throws; `done` never
 *  rejects. `done` settles when `chunks` has been iterated to its end, or at
 *  once when the row is refused before anything is read. A consumer that
 *  stops early leaves the rest to be read and verified, unyielded, so `done`
 *  still states whether the member was whole. */
export function streamMember(source, row) {
  let settle;
  const done = new Promise((resolve) => { settle = resolve; });
  const valid = row && typeof row === "object"
    && Number.isSafeInteger(row.index) && Number.isSafeInteger(row.data_offset) && row.data_offset >= 0
    && Number.isSafeInteger(row.compressed) && row.compressed >= 0
    && Number.isSafeInteger(row.uncompressed) && row.uncompressed >= 0
    && Number.isInteger(row.crc32) && (row.method === 0 || row.method === 8);
  let early = null;
  if (row?.verdict !== "ok") {
    early = { ok: false, why: typeof row?.verdict === "string" ? row.verdict : "row_invalid", index: row?.index ?? null };
    const limit = ARCHIVE_LIMITS[early.why];
    if (limit !== undefined) { early.limit = limit; early.final = true; }
  } else if (!valid) {
    early = { ok: false, why: "row_invalid", index: row?.index ?? null };
  }
  if (early) settle(early);

  let started = false;
  const chunks = {
    [Symbol.asyncIterator]() {
      if (started || early) return (async function* () {})();
      started = true;
      return relay(cut(source, row), settle, row.index);
    },
  };
  return { chunks, done };
}

/* Yields what `inner` yields; when it ends, or the consumer stops, drains
 * the rest unyielded and settles with its answer. `cut` answers every
 * failure itself; should it ever throw, the cut is stated unread rather than
 * left unsettled. */
async function* relay(inner, settle, index) {
  const unread = { ok: false, why: "source_unreadable", index };
  let result = null;
  try {
    for (;;) {
      const { value, done } = await inner.next();
      if (done) { result = value ?? unread; break; }
      yield value;
    }
  } catch {
    result = unread;
  } finally {
    try {
      while (!result) {
        const { value, done } = await inner.next();
        if (done) result = value ?? unread;
      }
    } catch {
      result = unread;
    }
    settle(result);
  }
}

const CUT_WINDOW = 1 << 20;

async function* cut(source, row) {
  const corrupt = (detail) => ({ ok: false, why: "MEMBER_CORRUPT", detail, index: row.index });
  const unreadable = { ok: false, why: "source_unreadable", index: row.index };
  const src = sourceOf(source);
  if (!src) return unreadable;
  const declared = row.uncompressed;
  let crc = 0xffffffff, size = 0;
  const sha = sha256Stream();
  const take = async (u8) => { crc = crcUpdate(crc, u8); size += u8.length; await sha.update(u8); };
  async function* windows() {
    for (let off = 0; off < row.compressed; off += CUT_WINDOW) {
      const at = row.data_offset + off, length = Math.min(CUT_WINDOW, row.compressed - off);
      if (at + length > src.size) throw new Unreadable();
      yield await src.read(at, length);
    }
  }
  const finish = async () => {
    if (size !== declared) return corrupt("size_mismatch");
    if (((crc ^ 0xffffffff) >>> 0) !== row.crc32) return corrupt("crc_mismatch");
    return { ok: true, sha256: await sha.finish(), crc32: row.crc32, size };
  };

  if (row.method === 0) {
    try {
      for await (const w of windows()) {
        if (size + w.length > declared) return corrupt("over_declared_size");
        const piece = w.slice();
        await take(piece);
        yield piece;
      }
    } catch {
      return unreadable;
    }
    return finish();
  }

  /* Deflate: the windows are written into the host's inflater while its
   * output is read, so one window and one output chunk are held at a time.
   * Output past the declared size stops the cut there. An inflater error
   * after the whole declared member came out whole is the deflate stream not
   * ending exactly at the end of the data (trailing bytes, or no final
   * block): `stream_end_mismatch`; before, `inflate_failed`. */
  let ds;
  try { ds = new DecompressionStream("deflate-raw"); } catch { return corrupt("inflate_failed"); }
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  let sourceFailed = false, fedAll = false;
  const feeding = (async () => {
    try {
      for await (const w of windows()) await writer.write(w);
      await writer.close();
      fedAll = true;
    } catch (e) {
      if (e instanceof Unreadable) sourceFailed = true;
      writer.abort().catch(() => {});
    }
  })();
  let inflateError = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (size + value.length > declared) {
        reader.cancel().catch(() => {});
        await feeding;
        return corrupt("over_declared_size");
      }
      await take(value);
      yield value;
    }
  } catch {
    inflateError = true;
  }
  await feeding;
  if (sourceFailed) return unreadable;
  if (inflateError || !fedAll) {
    const whole = size === declared && ((crc ^ 0xffffffff) >>> 0) === row.crc32;
    return corrupt(whole ? "stream_end_mismatch" : "inflate_failed");
  }
  return finish();
}

/* ------------------------------------------------------------------ *
 * A VBA PROJECT, READ AND NEVER RUN (K1888; study-virus-scanning §3 A)
 * ------------------------------------------------------------------ *
 *
 * An office file's macros live in one member, `vbaProject.bin`: an MS-CFB
 * compound file whose `VBA` storage holds a `dir` stream (the project's
 * records, MS-OVBA §2.3.4.2) and one stream per module, each module's source
 * compressed (MS-OVBA §2.4.1) from the offset `dir` records. This reads the
 * names out and matches two tables against each module's source, as olevba
 * does. Nothing is run, evaluated or compiled, and the compiled p-code beside
 * the source is not read: a project whose source was replaced while its
 * p-code was kept ("VBA stomping") reads as its source says.
 *
 * The tables are olevba's (oletools 0.60.2, `olevba.py`): `AUTOEXEC_KEYWORDS`
 * and `SUSPICIOUS_KEYWORDS`, their plain-string entries in their own order
 * (the regex entries and olevba's temporary `Auto_Ope` are left out), then the
 * four names requirement R33 adds that olevba spells differently (`XMLHTTP`,
 * `WinHttpRequest`, `URLDownloadToFile`, `RegWrite`). A name is found as
 * olevba finds it: `(?i)\b<name>\b` over the source. */
export const VBA_AUTORUN_NAMES = Object.freeze([
  "AutoExec", "AutoOpen", "DocumentOpen", "AutoExit", "AutoClose", "Document_Close", "DocumentBeforeClose",
  "DocumentChange", "AutoNew", "Document_New", "NewDocument", "Document_Open", "Document_BeforeClose",
  "Auto_Open", "Workbook_Open", "Workbook_Activate", "Auto_Close", "Workbook_Close", "Workbook_BeforeClose",
  "Worksheet_Calculate",
]);
export const VBA_SUSPICIOUS_KEYWORDS = Object.freeze([
  "Environ", "Win32_Environment", "Environment", "ExpandEnvironmentStrings", "HKCU\\Environment",
  "HKEY_CURRENT_USER\\Environment", "Open", "Write", "Put", "Output", "Print #", "Binary",
  "FileCopy", "CopyFile", "CopyHere", "CopyFolder", "MoveHere", "MoveFile", "MoveFolder", "Kill",
  "CreateTextFile", "ADODB.Stream", "WriteText", "SaveToFile",
  "Shell", "vbNormal", "vbNormalFocus", "vbHide", "vbMinimizedFocus", "vbMaximizedFocus", "vbNormalNoFocus",
  "vbMinimizedNoFocus", "WScript.Shell", "Run", "ShellExecute", "ShellExecuteA", "shell32", "InvokeVerb",
  "InvokeVerbEx", "DoIt", "ControlPanelItem", "Create", "MacScript", "AppleScript",
  "PowerShell", "noexit", "ExecutionPolicy", "noprofile", "command", "EncodedCommand", "invoke-command",
  "scriptblock", "Invoke-Expression", "AuthorizationManager", "Start-Process", "CALL",
  "Application.Visible", "ShowWindow", "SW_HIDE", "MkDir", "ActiveWorkbook.SaveAs", "Application.AltStartupPath",
  "CreateObject", "GetObject", "New-Object", "Shell.Application", "ExecuteExcel4Macro", "Windows", "FindWindow",
  "Lib", "libc.dylib", "dylib",
  "CreateThread", "CreateUserThread", "VirtualAlloc", "VirtualAllocEx", "RtlMoveMemory", "WriteProcessMemory",
  "SetContextThread", "QueueApcThread", "WriteVirtualMemory", "VirtualProtect", "SetTimer",
  "URLDownloadToFileA", "Msxml2.XMLHTTP", "Microsoft.XMLHTTP", "MSXML2.ServerXMLHTTP", "User-Agent",
  "Net.WebClient", "DownloadFile", "DownloadString", "SendKeys", "AppActivate", "CallByName",
  "Chr", "ChrB", "ChrW", "StrReverse", "Xor", "RegOpenKeyExA", "RegOpenKeyEx", "RegCloseKey",
  "RegQueryValueExA", "RegQueryValueEx", "RegRead",
  "SYSTEM\\ControlSet001\\Services\\Disk\\Enum", "VIRTUAL", "VMWARE", "VBOX",
  "GetVolumeInformationA", "GetVolumeInformation", "1824245000",
  "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\ProductId",
  "76487-337-8429955-22614", "andy", "C:\\exec\\exec.exe", "popupkiller", "SbieDll.dll", "SandboxieControlWndClass",
  "C:\\file.exe", "currentuser", "Schmidti", "Afx:400000:0",
  "AccessVBOM", "VBAWarnings", "ProtectedView", "DisableAttachementsInPV", "DisableInternetFilesInPV",
  "DisableUnsafeLocationsInPV", "blockcontentexecutionfrominternet",
  "VBProject", "VBComponents", "CodeModule", "AddFromString", "FORMULA.FILL",
  "XMLHTTP", "WinHttpRequest", "URLDownloadToFile", "RegWrite",
]);

/* Python's `\b` on either side of a name, written out: a boundary is a change
 * between a word character (a letter, a digit or `_`, as Python's Unicode
 * `\w`) and anything else, so the side condition depends on whether the name
 * itself starts or ends with one. */
const WORD = "[\\p{L}\\p{N}_]";
const WORD_CHAR = /^[\p{L}\p{N}_]$/u;
const nameMatcher = (name) => {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const before = WORD_CHAR.test(name[0]) ? `(?<!${WORD})` : `(?<=${WORD})`;
  const after = WORD_CHAR.test(name[name.length - 1]) ? `(?!${WORD})` : `(?=${WORD})`;
  return new RegExp(before + esc + after, "iu");
};
/* Each table's matchers, compiled on the first project read and kept (R34):
 * some 160 expressions the module's evaluation no longer pays for. */
const MATCHERS = new Map();
function matchersOf(table) {
  let m = MATCHERS.get(table);
  if (!m) MATCHERS.set(table, (m = table.map((n) => [n, nameMatcher(n)])));
  return m;
}
const found = (table, source) => matchersOf(table).filter(([, re]) => re.test(source)).map(([n]) => n);

/* MS-OVBA §2.4.1.3: a CompressedContainer from `start` to the end of `buf`,
 * or null when it is not one. Every copy token is checked against the chunk
 * it copies within, every chunk against 4,096 decompressed bytes, and the
 * whole output against `MEMBER_MAX` (the cap every inflated part carries). */
function decompressOvba(buf, start) {
  if (!(start < buf.length) || buf[start] !== 0x01) return null;
  let out = new Uint8Array(4096);
  let n = 0;
  const grow = (need) => {
    if (n + need <= out.length) return true;
    if (n + need > MEMBER_MAX) return false;
    const next = new Uint8Array(Math.min(MEMBER_MAX, Math.max(out.length * 2, n + need)));
    next.set(out.subarray(0, n));
    out = next;
    return true;
  };
  let p = start + 1;
  while (p < buf.length) {
    if (p + 2 > buf.length) return null;
    const header = u16(buf, p);
    if (((header >>> 12) & 7) !== 3) return null;
    const chunkEnd = Math.min(p + (header & 0x0fff) + 3, buf.length);
    const chunkStart = n;
    let q = p + 2;
    if ((header & 0x8000) === 0) {
      if (q + 4096 > buf.length || !grow(4096)) return null;
      out.set(buf.subarray(q, q + 4096), n);
      n += 4096;
      p = q + 4096;
      continue;
    }
    while (q < chunkEnd) {
      const flags = buf[q++];
      for (let bit = 0; bit < 8 && q < chunkEnd; bit++) {
        if (((flags >>> bit) & 1) === 0) {
          if (!grow(1)) return null;
          out[n++] = buf[q++];
          continue;
        }
        if (q + 2 > chunkEnd) return null;
        const token = u16(buf, q);
        q += 2;
        const difference = n - chunkStart;
        let bitCount = 4;
        while ((1 << bitCount) < difference) bitCount++;
        const lengthMask = 0xffff >>> bitCount;
        const length = (token & lengthMask) + 3;
        const offset = (token >>> (16 - bitCount)) + 1;
        if (offset > difference || difference + length > 4096 || !grow(length)) return null;
        for (let k = 0; k < length; k++, n++) out[n] = out[n - offset];
      }
    }
    if (n - chunkStart > 4096) return null;
    p = chunkEnd;
  }
  return out.slice(0, n);
}

/* MS-CFB: the compound file's directory and a reader for each stream, or
 * null when it is not one: a bad header, a FAT, DIFAT, mini FAT or stream
 * chain that leaves the file, loops or ends early, or a directory tree that
 * loops. Every stream's chain is walked here, so a stream read never fails. */
function readCfb(b) {
  const MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  if (b.length < 512 || MAGIC.some((x, i) => b[i] !== x) || u16(b, 0x1c) !== 0xfffe) return null;
  const major = u16(b, 0x1a), shift = u16(b, 0x1e);
  if (!((major === 3 && shift === 9) || (major === 4 && shift === 12)) || u16(b, 0x20) !== 6) return null;
  const ss = 1 << shift;
  if (b.length < ss) return null;
  const nSectors = Math.floor((b.length - ss) / ss);
  const sector = (n) => b.subarray(ss * (n + 1), ss * (n + 2));
  const ids = (s) => Array.from({ length: s.length / 4 }, (_, i) => u32(s, 4 * i));
  const nFat = u32(b, 0x2c), cutoff = u32(b, 0x38);
  if (nFat > nSectors || cutoff !== 4096) return null;

  const fatSectors = ids(b.subarray(0x4c, 0x200)).slice(0, Math.min(nFat, 109));
  const seen = new Set();
  for (let s = u32(b, 0x44), k = u32(b, 0x48); fatSectors.length < nFat; k--) {
    if (k <= 0 || s >= nSectors || seen.has(s)) return null;
    seen.add(s);
    const list = ids(sector(s));
    fatSectors.push(...list.slice(0, -1).slice(0, nFat - fatSectors.length));
    s = list[list.length - 1];
  }
  if (fatSectors.some((s) => s >= nSectors)) return null;
  const fat = fatSectors.flatMap((s) => ids(sector(s)));

  const chain = (table, start, limit) => {
    const out = [];
    const visited = new Set();
    for (let s = start; s !== 0xfffffffe; s = table[s]) {
      if (s >= limit || s >= table.length || visited.has(s)) return null;
      visited.add(s);
      out.push(s);
    }
    return out;
  };
  const gather = (list, read, unit, size) => {
    if (list.length * unit < size) return null;
    const out = new Uint8Array(list.length * unit);
    list.forEach((s, i) => out.set(read(s), i * unit));
    return out.subarray(0, size);
  };

  const dirChain = chain(fat, u32(b, 0x30), nSectors);
  if (!dirChain || !dirChain.length) return null;
  const dirBytes = gather(dirChain, sector, ss, dirChain.length * ss);
  const entries = [];
  const utf16 = new TextDecoder("utf-16le");
  for (let at = 0; at + 128 <= dirBytes.length; at += 128) {
    const e = dirBytes.subarray(at, at + 128);
    const nameLen = u16(e, 0x40);
    const name = nameLen >= 2 && nameLen <= 64 && nameLen % 2 === 0
      ? utf16.decode(e.subarray(0, nameLen - 2)) : "";
    const high = u32(e, 0x7c);
    entries.push({
      name, type: e[0x42], left: u32(e, 0x44), right: u32(e, 0x48), child: u32(e, 0x4c),
      start: u32(e, 0x74), size: major === 3 ? u32(e, 0x78) : high >= 0x200000 ? NaN : high * 0x100000000 + u32(e, 0x78),
    });
  }
  const root = entries[0];
  if (!root || root.type !== 5) return null;

  const miniChain = root.size > 0 ? chain(fat, root.start, nSectors) : [];
  const miniStream = miniChain && gather(miniChain, sector, ss, root.size);
  const miniFatChain = u32(b, 0x40) > 0 ? chain(fat, u32(b, 0x3c), nSectors) : [];
  if (!miniStream || !miniFatChain) return null;
  const miniFat = miniFatChain.flatMap((s) => ids(sector(s)));
  const nMini = Math.floor(miniStream.length / 64);
  const data = new Map();
  for (const e of entries) {
    if (e.type !== 2) continue;
    if (!Number.isFinite(e.size)) return null;
    const bytes = e.size === 0 ? new Uint8Array(0) : e.size < cutoff
      ? gather(chain(miniFat, e.start, nMini) ?? [], (s) => miniStream.subarray(64 * s, 64 * s + 64), 64, e.size)
      : gather(chain(fat, e.start, nSectors) ?? [], sector, ss, e.size);
    if (!bytes) return null;
    data.set(e, bytes);
  }

  /* A storage's children: its child's red-black tree, walked by the
   * siblings. A loop or a reference past the directory is not a tree. */
  const children = (parent) => {
    const out = [];
    const stack = [parent.child];
    const visited = new Set();
    while (stack.length) {
      const i = stack.pop();
      if (i === 0xffffffff) continue;
      if (i >= entries.length || visited.has(i)) return null;
      visited.add(i);
      out.push(entries[i]);
      stack.push(entries[i].left, entries[i].right);
    }
    return out;
  };
  return { root, children, data };
}

/* A storage's child of one name and type; CFB names compare case-blind. */
function childNamed(cfb, parent, name, type) {
  const list = cfb.children(parent);
  if (!list) return undefined;
  return list.find((e) => e.type === type && e.name.toUpperCase() === name.toUpperCase()) ?? null;
}

/* Text in the project's code page (PROJECTCODEPAGE) where the host decodes
 * it, else Windows-1252: names and source are matched, never run. */
function codePageDecoder(cp) {
  const label = cp === 65001 ? "utf-8" : cp === 10000 ? "macintosh" : cp === 932 ? "shift_jis"
    : cp === 936 ? "gbk" : cp === 949 ? "euc-kr" : cp === 950 ? "big5" : `windows-${cp}`;
  try { return new TextDecoder(label); } catch { return new TextDecoder("windows-1252"); }
}

/* The `dir` stream's records (MS-OVBA §2.3.4.2): the project's name and code
 * page, and each module's names and source offset. Every record is an id, a
 * 32-bit size and that many bytes, except PROJECTVERSION (0x0009), whose size
 * field is a fixed 4 followed by 6 bytes. null when a record runs past the
 * stream. */
function parseVbaDir(d) {
  let codePage = 1252, projectRaw = null;
  const modules = [];
  let cur = null;
  for (let p = 0; p < d.length;) {
    if (p + 6 > d.length) return null;
    const id = u16(d, p);
    const size = id === 0x0009 ? 6 : u32(d, p + 2);
    if (p + 6 + size > d.length) return null;
    const data = d.subarray(p + 6, p + 6 + size);
    p += 6 + size;
    if (id === 0x0010) break; // the dir stream's terminator
    else if (id === 0x0003 && size >= 2) codePage = u16(data, 0);
    else if (id === 0x0004) projectRaw = data;
    else if (id === 0x0019) { cur = { nameRaw: data }; modules.push(cur); }
    else if (cur && id === 0x0047) cur.nameUnicode = data;
    else if (cur && id === 0x001a) cur.streamRaw = data;
    else if (cur && id === 0x0032) cur.streamUnicode = data;
    else if (cur && id === 0x0031 && size >= 4) cur.offset = u32(data, 0);
    else if (id === 0x002b) cur = null;
  }
  const text = codePageDecoder(codePage);
  const utf16 = new TextDecoder("utf-16le");
  const pick = (uni, raw) => (uni && uni.length ? utf16.decode(uni) : raw ? text.decode(raw) : null);
  return {
    text,
    project: projectRaw ? text.decode(projectRaw) : null,
    modules: modules.map((m) => ({
      name: pick(m.nameUnicode, m.nameRaw), stream: pick(m.streamUnicode, m.streamRaw), offset: m.offset,
    })),
  };
}

/** Read an office file's VBA project for its module names, auto-run
 *  procedures and suspicious keywords, without running anything (R32).
 *  Async; never throws. */
export async function readVbaProject(bytes, container, partName) {
  const part = normalizePartName(partName);
  try {
    const read = await readPart(bytes, container, part);
    if (!read.ok) return { ok: false, why: read.why, part };
    const cfb = readCfb(read.bytes);
    if (!cfb) return { ok: false, why: "cfb_invalid", part };
    const vba = childNamed(cfb, cfb.root, "VBA", 1);
    const dirEntry = vba ? childNamed(cfb, vba, "dir", 2) : vba;
    if (vba === undefined || dirEntry === undefined) return { ok: false, why: "cfb_invalid", part };
    if (!dirEntry) return { ok: false, why: "vba_dir_absent", part };
    const dirBytes = decompressOvba(cfb.data.get(dirEntry), 0);
    const dir = dirBytes && parseVbaDir(dirBytes);
    if (!dir) return { ok: false, why: "vba_dir_unreadable", part };

    const modules = [];
    const undetermined = [];
    for (const m of dir.modules) {
      const entry = m.stream == null ? null : childNamed(cfb, vba, m.stream, 2);
      const source = entry && Number.isSafeInteger(m.offset) ? decompressOvba(cfb.data.get(entry), m.offset) : null;
      if (!source) {
        const why = entry ? "module_source_undecompressable" : "module_stream_absent";
        modules.push({ name: m.name, stream: m.stream, read: false, why, autoRun: [], suspicious: [] });
        undetermined.push({ module: m.name, why });
        continue;
      }
      const code = dir.text.decode(source);
      modules.push({
        name: m.name, stream: m.stream, read: true, why: null,
        autoRun: found(VBA_AUTORUN_NAMES, code), suspicious: found(VBA_SUSPICIOUS_KEYWORDS, code),
      });
    }
    const union = (table, key) => table.filter((n) => modules.some((m) => m[key].includes(n)));
    return {
      ok: true, part, project: dir.project, modules,
      autoRun: union(VBA_AUTORUN_NAMES, "autoRun"), suspicious: union(VBA_SUSPICIOUS_KEYWORDS, "suspicious"),
      undetermined,
    };
  } catch {
    return { ok: false, why: "cfb_invalid", part };
  }
}
