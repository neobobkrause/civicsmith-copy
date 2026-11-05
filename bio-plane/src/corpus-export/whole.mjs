/* corpus-export — the whole-record export by parts, what an export does not carry, and a register's descriptors
 * (requirements: `build/requirements/corpus-export.md` R16-R20; K5441, K5443; PLATFORM PL50-PL53; N1259, K4403, K1493).
 *
 * THE FILES (R17). Every stored file is an entry: each bundle's live files (`files`) and every snapshot `history` keeps,
 * with its path, SHA-256, bytes, kind (`file`, `capture` when the register records it, or `snapshot`) and where it is
 * held (`inline` in the store, or `r2` in the evidence bucket by its blob digest).
 *
 * THE PARTS (R18). Each entry travels as one part, or, when it is larger than the part bound, as consecutive parts of at
 * most that many bytes. A part names its file by digest (`file`), its `offset` and `bytes`, so it is fetched alone
 * (`exportWholePart`) from the content that digest addresses, which a later write never changes: a part fetched after
 * the copy moved on is still the part the manifest names. A part that is a whole file carries the file's own digest; a
 * cut part is read and hashed when the manifest is made, one part held at a time. Nothing holds more than one part.
 *
 * WHAT IS NOT CARRIED (R19). Each declared table whose rows do not travel is named `not_carried` with its owner and the
 * reason: `never`, `derived` (it travels as its rule), or `expunged` (rows removed under record-core R79, their
 * tombstones carried in their place); and the export says that members' sign-in material is not carried.
 *
 * A REGISTER (R16). Each import travels as its descriptor and each tombstone of a registers table in its place; its
 * cells, index rows and segments never travel. A segment is filed as a capture in a bundle (registers R14), so the
 * capture is left out of R1's bundles and register and named only by its SHA-256 in its descriptor's `segment_shas`. */
import { createSha256 } from "../record-grammar/index.mjs";
import { PLATFORM_FIGURES } from "../byte-ledger.mjs";
import { localize } from "../setup-words/index.mjs";
import { tombstonesOf } from "./tables.mjs";

/** R18: the most bytes one part of a whole-record export holds: 8 MiB, under the plane's per-call memory (the isolate's
 *  memory less its idle figure, `PLATFORM_FIGURES`). */
export const WHOLE_PART_BYTES = 8 * 1024 * 1024;
export const WHOLE_PART_CEILING = PLATFORM_FIGURES.isolate_memory_bytes.value - PLATFORM_FIGURES.idle_bytes.value;
if (WHOLE_PART_BYTES > WHOLE_PART_CEILING) throw new Error("corpus-export: the part bound is above the plane's per-call memory");

const HEX64 = /^[0-9a-f]{64}$/;
const lower = (v) => (typeof v === "string" ? v.trim().toLowerCase() : "");
const u8 = (v) => (v instanceof Uint8Array ? v : v instanceof ArrayBuffer ? new Uint8Array(v)
  : typeof v === "string" ? new TextEncoder().encode(v) : null);
const has = (sql, table) => [...sql.exec(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`, table)].length > 0;
const parse = (s) => { if (typeof s !== "string") return s ?? null; try { return JSON.parse(s); } catch { return null; } };

/* ---- R16: a register's segments, descriptors and tombstones ---- */

/** R16: the bundles that hold a register's segments, and the segments' digests: every bundle `register_segments`
 *  names, and every bundle whose provenance document states that it came from a register import. */
export function segmentsOf(sql) {
  const bundles = new Set(), shas = new Set();
  if (has(sql, "register_segments"))
    for (const r of sql.exec(`SELECT sha256, bundle_id FROM register_segments`)) {
      if (r.bundle_id) bundles.add(r.bundle_id);
      if (r.sha256) shas.add(lower(r.sha256));
    }
  for (const r of sql.exec(`SELECT bundle_id, content FROM files WHERE path='data/provenance.json' AND content IS NOT NULL`)) {
    const docs = parse(r.content)?.documents;
    if (Array.isArray(docs) && docs.some(fromImport)) bundles.add(r.bundle_id);
  }
  return { bundles, shas };
}
const fromImport = (d) => !!d && (d.origin === "register_import" || (d.origin && typeof d.origin === "object" && d.origin.kind === "register_import"));

/** R16: is this file of a bundle a register segment's capture (or its shell or parts)? A segment bundle's own record
 *  (its `bundle.md` and provenance document, held inline) travels; its bytes do not. */
export function isSegmentFile(seg, bundle, f) {
  if (seg.shas.has(lower(f.sha256)) || (f.blob_sha && seg.shas.has(lower(f.blob_sha)))) return true;
  return seg.bundles.has(bundle) && !f.inline;
}

/** R16: each import as its descriptor (no cell, no index row, no segment), each tombstone a registers table lists, and
 *  the plain statement that the rows are not carried. Null when the store holds no register. */
export function registersOf(sql, record, declared) {
  if (!has(sql, "register_imports")) return null;
  const segs = has(sql, "register_segments") ? [...sql.exec(`SELECT import_id, piece, n, sha256, address, original_sha256, original_bytes, covers FROM register_segments ORDER BY import_id, piece, n`)] : [];
  const descriptors = [...sql.exec(`SELECT * FROM register_imports ORDER BY import_id`)].map((i) => {
    const mine = segs.filter((s) => Number(s.import_id) === Number(i.import_id));
    const reduction = parse(i.reduction);
    const pieces = parse(i.pieces);
    const sources = [...new Set([...(Array.isArray(pieces) ? pieces.map((p) => p && p.address) : []),
                                 ...mine.map((s) => String(s.address || "").replace(/#segment:\d+$/, ""))].filter(Boolean))];
    const fingerprints = reduction && Array.isArray(reduction.original_fingerprints) ? reduction.original_fingerprints
      : [...new Map(mine.filter((s) => s.original_sha256).map((s) => [s.original_sha256, { piece: s.piece, sha256: s.original_sha256, bytes: s.original_bytes, covers: s.covers }])).values()];
    return { import: i.import_id, register: i.register, scope: i.scope, ...(i.project ? { project: i.project } : {}), filter: parse(i.filter),
             filter_fingerprint: i.filter_fp, source: sources, source_date: i.source_date ?? "not_stated", imported_at: i.imported_at ?? null,
             counts: { rows_in: i.rows_in ?? null, rows_out: i.rows_out ?? null, rows_undetermined: i.rows_undetermined ?? null,
                       rows_new: i.rows_new ?? 0, rows_unchanged: i.rows_unchanged ?? 0, rows_tombstoned: i.rows_tombstoned ?? 0 },
             segment_shas: mine.map((s) => s.sha256), original_fingerprints: fingerprints, reduction };
  });
  const tables = declared.filter((d) => d.module === "registers").map((d) => d.name);
  const tombstones = tables.flatMap((t) => tombstonesOf(record, t));
  return { descriptors, tombstones, rows: "not_carried",
           said: localize("corpus-export.registers.rows_not_carried", "Rows not carried: bring them in again from the source. Each import is carried as its description, and each removal as where it was.") };
}

/* ---- R19: what the export does not carry ---- */

/** R19: each declared table whose rows do not travel, by owner and reason, and the sentence on sign-in material. */
export function notCarriedOf(tables, record) {
  const out = [];
  for (const t of tables) {
    if (t.carried === "named") out.push({ owner: t.owner, table: t.table, reason: "never" });
    else if (t.carried === "rule") out.push({ owner: t.owner, table: t.table, reason: "derived" });
    /* a carried table's tombstones travel on its entry (R9); a withheld table's are read here */
    const gone = (Array.isArray(t.tombstones) ? t.tombstones : tombstonesOf(record, t.table)).length;
    if (gone) out.push({ owner: t.owner, table: t.table, reason: "expunged", rows: gone });
  }
  return out;
}
export const signInNotCarried = () => localize("corpus-export.not_carried.sign_in",
  "Members' sign-in material is not carried: their sessions, passwords and keys stay with this copy, and members sign in again at the new one.");

/* ---- R17, R18: the files and their parts ---- */

/** R17, R18: every stored file as an entry, and the parts they travel in. Synchronous: the listing is taken at one
 *  instant. `bound` is the part bound in bytes. A part cut from a larger file has `sha256: null` until it is read. */
export function wholeLayout(sql, seg, bound, captures) {
  const files = [];
  for (const f of sql.exec(`SELECT bundle_id, path, sha256, bytes, blob_sha, (content IS NOT NULL) AS inline FROM files ORDER BY bundle_id, path`)) {
    const e = { bundle: f.bundle_id, path: f.path, sha256: f.sha256, bytes: Number(f.bytes), inline: !!f.inline, blob_sha: f.blob_sha ?? null };
    if (isSegmentFile(seg, f.bundle_id, e)) continue;
    files.push({ ...e, kind: captures.has(lower(f.sha256)) ? "capture" : "file" });
  }
  for (const h of sql.exec(`SELECT bundle_id, snap_key, path, sha256, blob_sha, (content IS NOT NULL) AS inline,
                             CASE WHEN content IS NOT NULL THEN length(CAST(content AS BLOB)) END AS size
                             FROM history ORDER BY bundle_id, snap_key, path`)) {
    const e = { bundle: h.bundle_id, snap_key: h.snap_key, path: h.path, sha256: h.sha256, inline: !!h.inline, blob_sha: h.blob_sha ?? null };
    if (isSegmentFile(seg, h.bundle_id, e)) continue;
    let bytes = h.size == null ? null : Number(h.size);
    if (bytes == null) {
      const live = [...sql.exec(`SELECT bytes FROM files WHERE (blob_sha=? OR sha256=?) LIMIT 1`, h.blob_sha ?? h.sha256, h.sha256)][0];
      bytes = live ? Number(live.bytes) : null;
    }
    files.push({ ...e, bytes, kind: "snapshot" });
  }
  const entries = files.map(({ inline, blob_sha, ...e }) => ({ ...e, held: inline ? "inline" : "r2" }));
  const parts = [];
  entries.forEach((e, i) => {
    const size = Number.isSafeInteger(e.bytes) && e.bytes > 0 ? e.bytes : 0;
    const first = parts.length;
    if (size <= bound) parts.push({ index: parts.length, entry: i, file: e.sha256, offset: 0, bytes: size, sha256: e.sha256 });
    else for (let at = 0; at < size; at += bound)
      parts.push({ index: parts.length, entry: i, file: e.sha256, offset: at, bytes: Math.min(bound, size - at), sha256: null });
    e.parts = { first, count: parts.length - first };
  });
  return { entries, parts };
}

/** R18: the bytes of one part: `bytes` bytes from `offset` of the content the digest `file` addresses (inline in
 *  `files` or `history`, or in the evidence bucket by its blob digest). Null when no stored file has that digest. */
export async function readPart(sql, record, file, offset, bytes) {
  const want = lower(file);
  if (!HEX64.test(want)) return null;
  for (const table of ["files", "history"]) {
    const r = [...sql.exec(`SELECT substr(CAST(content AS BLOB), ?, ?) AS b FROM ${table} WHERE lower(sha256)=? AND content IS NOT NULL LIMIT 1`,
                           offset + 1, bytes, want)][0];
    if (r) return u8(r.b) ?? new Uint8Array(0);
  }
  let blob = null;
  for (const table of ["files", "history"]) {
    const r = [...sql.exec(`SELECT blob_sha FROM ${table} WHERE lower(sha256)=? AND content IS NULL AND blob_sha IS NOT NULL LIMIT 1`, want)][0];
    if (r) { blob = r.blob_sha; break; }
  }
  const store = blob && record && typeof record.evidenceStore === "function" ? record.evidenceStore() : null;
  if (!store) return null;
  const obj = await store.get(blob, { range: { offset, length: bytes } });
  if (!obj) return null;
  return new Uint8Array(await obj.arrayBuffer());
}

export const sha256Of = (b) => createSha256().update(b).hex();

/** R18: a part fetched alone checks against the manifest's row for it: its bytes measure the row's `bytes` and hash to
 *  its `sha256`. Answers `{ok: true}` or `{ok: false, reason}` (`PART_SIZE_MISMATCH`, `PART_HASH_MISMATCH`,
 *  `BYTES_MISSING`); never throws. */
export function verifyWholePart({ part = null, bytes = null } = {}) {
  try {
    const b = u8(bytes);
    if (!part || typeof part !== "object") return { ok: false, reason: "MANIFEST_MALFORMED" };
    if (!b) return { ok: false, reason: "BYTES_MISSING", index: part.index ?? null };
    if (Number(part.bytes) !== b.length) return { ok: false, reason: "PART_SIZE_MISMATCH", index: part.index ?? null, expected: part.bytes, found: b.length };
    const got = sha256Of(b);
    if (got !== lower(part.sha256)) return { ok: false, reason: "PART_HASH_MISMATCH", index: part.index ?? null, expected: lower(part.sha256), found: got };
    return { ok: true, index: part.index ?? null };
  } catch (e) { return { ok: false, reason: "MANIFEST_MALFORMED", found: String(e && e.message || e).slice(0, 160) }; }
}
