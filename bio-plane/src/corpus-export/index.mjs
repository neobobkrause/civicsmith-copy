/* corpus-export — the verified working-corpus export (requirements: `build/requirements/corpus-export.md`; Membership v2
 * §8.1 and §8's "What verified must mean"). A group that cannot leave can be held: this module exports the working
 * corpus verifiably (R1), records every export in an append-only log every administrator can read (R2, R4), and
 * verifies an import of an export, trusting nothing the export asserts (R3). It names no place (R5).
 *
 * Split from `publication` by copy (K617, K624 (1), K1024; seam map `build/extraction/corpus-export.md`): the export's
 * constants, the "section 8" comment with `exportManifest` and `exportLog`, and the `export_log` table (`./schema.mjs`),
 * with their comments. `publication`'s job deletes its copy and creates this module. The verifying import (R3) is new
 * here. Its route arms `export` and `exportlog` are `corpusExportOps` (R6; N483, K1122), moved from publication's ops
 * map; which credential reaches each op is op-declarations' and control-plane's, never this map's.
 *
 * REACHED as `corpusExportOf(host, deps)` (K61): one instance per host (the Durable Object's `ctx`), created on the
 * first call with `deps`, returned to every later caller. At creation it creates `export_log` and declares it to
 * record-core's purge as exempt (R4).
 * `deps` (each reached through its factory on the same host unless given; a test passes its own):
 *   record   record-core: `declarePurge` (R4).
 *   now      the clock for the instants it writes, an ISO string (default: the wall clock).
 *
 * READ CONTRACTS it joins in its own SQL (R1): record-core's `bundles`, `files`, `history` and `manifest`, provenance's
 * `register` and connections' `refs`. */

import { recordOf } from "../record-core/index.mjs";
import { provenanceOf } from "../provenance/index.mjs";
import { entitiesOf } from "../entities/index.mjs";
import { eventsOf } from "../events/index.mjs";
import { linesOf } from "../lines/index.mjs";
import { moneyOf } from "../money/index.mjs";
import { createSha256, sha256HexSync } from "../record-grammar/index.mjs";
import { CORPUS_EXPORT_EXEMPT, migrateCorpusExport } from "./schema.mjs";
import { TablePager, tableEntry, pageBytes, canonical, PAGE_ROWS, PAGE_BYTES } from "./tables.mjs";
import { render, itemsOf, FORMATS, STANDARDS } from "./render.mjs";
import { segmentsOf, isSegmentFile, registersOf, notCarriedOf, signInNotCarried, wholeLayout, readPart, sha256Of, verifyWholePart,
         WHOLE_PART_BYTES } from "./whole.mjs";
import { storeHint, storeJurisdiction, storeGeneration } from "../store-place.mjs";
import { word, localize } from "../setup-words/index.mjs";

export { CORPUS_EXPORT_SCHEMA, CORPUS_EXPORT_EXEMPT } from "./schema.mjs";
export { PAGE_ROWS, PAGE_BYTES, canonical, pageBytes } from "./tables.mjs";
export { FORMATS, STANDARDS, RENDER_MAX } from "./render.mjs";
export { WHOLE_PART_BYTES, WHOLE_PART_CEILING, verifyWholePart } from "./whole.mjs";

/* REC-57: `op=exportlog` read the append-only export log at a literal `LIMIT 200` with no parameter and no published
   bound — on the one op whose whole sentence is a completeness claim to administrators (R19). */
export const EXPORT_LOG_LIMIT_DEFAULT = 200;
export const EXPORT_LOG_LIMIT_MAX = 1000;
/** R18: the longest note an export's log row keeps. */
export const EXPORT_NOTE_MAX = 280;

/* R3: what a promotion that replaced nothing names as its base (promotion's creation entry; record-core R57). */
const CREATION_BASE = sha256HexSync("");
const HEX64 = /^[0-9a-f]{64}$/;
const te = new TextEncoder();

export class CorpusExport {
  constructor({ storage, record, now = null, entities = null, events = null, lines = null, money = null, provenance = null,
                env = null, placement = null, partBytes = null, ledger = null } = {}) {
    this.sql = storage.sql;
    this.record = record;
    /* R17: where the copy is placed, from the store's environment (`store-place`), or as given. */
    this.env = env;
    this.placementGiven = placement;
    /* R18: the part bound (a test may lower it; never above WHOLE_PART_BYTES), and a byte ledger counting the bytes a
       part holds while it is read (runtime-limits' `byteLedger`), when given. */
    const b = Number(partBytes);
    this.partBytes = Number.isSafeInteger(b) && b >= 1 ? Math.min(b, WHOLE_PART_BYTES) : WHOLE_PART_BYTES;
    this.ledger = ledger;
    /* R10's owners: each an instance, or a function answering it on first use. */
    this.owners = { entities, events, lines, money };
    this.dep = { provenance };
    this.now = typeof now === "function" ? now : () => new Date().toISOString();
    this.purgeDeclaration = null;
  }

  migrate() { migrateCorpusExport(this.sql); }

  #rows(q, ...a) { return [...this.sql.exec(q, ...a)]; }
  /* provenance, an instance or a function answering it on first use (R13's `partsNamed`) */
  #provenance() { const d = this.dep.provenance; return typeof d === "function" ? (this.dep.provenance = d()) : d; }
  #when() { const w = this.now(); return typeof w === "string" && w ? w : new Date().toISOString(); }

  /* ---- section 8: secure verified export ----
   *
   * Export is the only real answer to a captured root of trust, because a group
   * that cannot leave is a group that can be held. It is also exactly the
   * capability an attacker wants most: a full working-corpus export is the
   * group's entire unpublished position, so if ANY administrator could take it,
   * one captured administrator exfiltrates everything and the feature becomes
   * the most efficient attack in the system.
   *
   * WHO MAY RUN IT is enforced in the control plane, not here, because that is
   * where the credential class is known. The rule is sharper than "an
   * administrator": section 8.1 says the ADMIN_TOKEN-class credential, which a
   * SESSION belonging to an administrator does not satisfy. A session is
   * password-derived; the root of trust is the token set in the hosting
   * dashboard. A stolen password must not reach this, and neither does the
   * founder's own signed-in browser.
   *
   * WHAT "VERIFIED" MEANS: the export carries its own manifest, every file
   * hashed on the way out, so the receiving side can re-derive everything and
   * trust nothing the sender asserts. */
  exportManifest({ note = null } = {}) {
    const m = this.#manifest();
    /* The module's clock (`now`), as every instant it writes, so the log row and the answer carry one instant. */
    const at = this.#when();
    this.sql.exec(
      `INSERT INTO export_log (at,scope,bundles,files,note,tables,rows) VALUES (?,'working-corpus',?,?,?,?,?)`,
      at, m.counts.bundles, m.counts.files, note ? String(note).slice(0, EXPORT_NOTE_MAX) : null, m.counts.tables, m.counts.rows);
    return { ok: true, at, scope: "working-corpus", ...m,
      recorded: word("corpus-export.recorded.export_append_export"),
      verify: word("corpus-export.verify") };
  }

  /* R1's content, read and never written: the bundles, the declared tables, the register, and (R16, R19) the
     registers' descriptors and what is not carried. A register's segment (R16) is left out of the bundles and the
     register, and named by its digest in its import's descriptor. */
  #manifest() {
    const seg = segmentsOf(this.sql);
    const bundles = this.#rows(
      `SELECT bundle_id, object_type, title, current_state, bundle_sha, row_version, created, last_updated
       FROM bundles ORDER BY bundle_id`);
    let fileCount = 0;
    const hasRefs = this.#rows(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='refs'`).length > 0;
    const out = bundles.map((b) => {
      const files = this.#rows(
        `SELECT path, sha256, bytes, blob_sha, (content IS NOT NULL) AS inline
         FROM files WHERE bundle_id=? ORDER BY path`, b.bundle_id)
        .filter((f) => !isSegmentFile(seg, b.bundle_id, { sha256: f.sha256, blob_sha: f.blob_sha, inline: !!f.inline }));
      fileCount += files.length;
      return { ...b,
        files: files.map((f) => ({ path: f.path, sha256: f.sha256, bytes: f.bytes,
                                   blobSha: f.blob_sha ?? null, inline: !!f.inline })),
        /* The manifest chain and the base links, so the receiving side can
           re-derive the chain rather than believe it. `history` holds the
           snapshotted FILES; `manifest` holds the promotion records that link
           them, which is what a chain check actually walks. */
        /* REC-182: `created` is the document's own time and two promotions can tie on it; a tie is
           broken by `rowid`, the store's write order (D-171's precedent), never by the scan. */
        promotions: this.#rows(
          `SELECT snap_key, kind, base, author, created, writer, operation
           FROM manifest WHERE bundle_id=? ORDER BY created, rowid`, b.bundle_id),
        snapshots: this.#rows(
          `SELECT snap_key, path, sha256, created, blob_sha, (content IS NOT NULL) AS inline FROM history WHERE bundle_id=? ORDER BY snap_key, path`,
          b.bundle_id)
          .filter((s) => !isSegmentFile(seg, b.bundle_id, { sha256: s.sha256, blob_sha: s.blob_sha, inline: !!s.inline }))
          .map(({ blob_sha, inline, ...s }) => s),
        /* connections' refs (an instance whose store holds no `refs` table holds no reference) */
        refs: hasRefs ? this.#rows(`SELECT target_id, kind FROM refs WHERE bundle_id=?`, b.bundle_id) : [],
      };
    });
    /* R7–R9: every table record-core's declarations name, read fresh at each export, by class and paged. */
    const declared = this.#declared();
    const tables = declared.map((d) => tableEntry(this.sql, d, this.record));
    const rowCount = tables.reduce((n, t) => n + (t.rows || 0), 0);
    const registers = registersOf(this.sql, this.record, declared);
    return {
      bundles: out,
      tables,
      counts: { bundles: bundles.length, files: fileCount, tables: tables.length, rows: rowCount },
      register: this.#register(seg),
      ...(registers ? { registers } : {}),
      not_carried: notCarriedOf(tables, this.record),
      sign_in: signInNotCarried() };
  }

  /** R17-R20: the whole-record manifest. R1's content, every stored file as an entry (path, SHA-256, bytes, kind, and
   *  where it is held), the parts the files travel in (each with its index, byte count and SHA-256, fetched alone by
   *  `exportWholePart`), the copy's `placement` and the counts; one `export_log` row scoped `whole-record`. It is a
   *  read: the listing and the counts are taken at its instant `at`, before anything is awaited, so a write while
   *  the parts are hashed changes neither; it takes no lease and holds no more than one part. */
  async exportWhole({ note = null } = {}) {
    const at = this.#when();
    const m = this.#manifest();
    const captures = new Set(m.register.map((r) => String(r.capture_sha || "").toLowerCase()));
    const { entries, parts } = wholeLayout(this.sql, segmentsOf(this.sql), this.partBytes, captures);
    const fileBytes = entries.reduce((n, e) => n + (Number.isSafeInteger(e.bytes) ? e.bytes : 0), 0);
    const counts = { ...m.counts, stored_files: entries.length, parts: parts.length, bytes: fileBytes };
    const placement = this.#placement();
    this.sql.exec(
      `INSERT INTO export_log (at,scope,bundles,files,note,tables,rows) VALUES (?,'whole-record',?,?,?,?,?)`,
      at, counts.bundles, entries.length, note ? String(note).slice(0, EXPORT_NOTE_MAX) : null, counts.tables, counts.rows);
    /* A part cut from a larger file is read and hashed now, one at a time, from the content its file's digest
       addresses (which no later write changes). */
    const missing = [];
    for (const p of parts) {
      if (p.sha256 !== null) continue;
      const b = await this.#partBytes(p.file, p.offset, p.bytes);
      if (!b || b.length !== p.bytes) { missing.push(p.index); continue; }
      p.sha256 = sha256Of(b);
      this.#release(b);
    }
    return { ok: true, at, taken_at: at, scope: "whole-record", ...m, counts, placement,
             files: entries, part_bound: this.partBytes, parts,
             ...(missing.length ? { parts_unread: missing } : {}),
             recorded: word("corpus-export.recorded.export_append_export"),
             verify: word("corpus-export.verify") };
  }

  /** R18: one part of a whole-record export, fetched alone from the manifest's row for it: `bytes` (at most the part
   *  bound) from `offset` of the stored file whose digest is `file`, with their SHA-256. Writes nothing. Refused
   *  `EXPORT_PART_MALFORMED` (no digest, or an offset or size that is not a whole number) or `EXPORT_PART_UNKNOWN` (no
   *  stored file has that digest). */
  async exportWholePart({ file = null, offset = null, bytes = null } = {}) {
    const sha = typeof file === "string" ? file.trim().toLowerCase() : "";
    const at = offset === null || offset === undefined || offset === "" ? 0 : Number(offset);
    const want = bytes === null || bytes === undefined || bytes === "" ? this.partBytes : Number(bytes);
    if (!/^[0-9a-f]{64}$/.test(sha) || !Number.isSafeInteger(at) || at < 0 || !Number.isSafeInteger(want) || want < 0)
      return { ok: false, reason: "EXPORT_PART_MALFORMED", file,
               detail: localize("corpus-export.index.whole_part_named", "a part is named by its file's digest, a whole-number offset and its size; nothing was read") };
    const n = Math.min(want, this.partBytes);
    const b = await this.#partBytes(sha, at, n);
    if (!b) return { ok: false, reason: "EXPORT_PART_UNKNOWN", file: sha,
                     detail: localize("corpus-export.index.whole_part_unknown", "nothing stored has that digest; nothing was read") };
    const answer = { ok: true, file: sha, offset: at, bytes: b, size: b.length, sha256: sha256Of(b) };
    this.#release(b);
    return answer;
  }

  async #partBytes(file, offset, n) {
    const b = await readPart(this.sql, this.record, file, offset, n);
    if (b && this.ledger) this.ledger.hold(b.length, "whole-part");
    return b;
  }
  #release(b) { if (b && this.ledger) this.ledger.release(b.length, "whole-part"); }

  /* R17: the copy's region (its location hint), jurisdiction and generation, from the store's environment; each null,
     and `stated: false`, when this instance was given none. */
  #placement() {
    const g = typeof this.placementGiven === "function" ? this.placementGiven() : this.placementGiven;
    if (g && typeof g === "object") return { region: g.region ?? null, jurisdiction: g.jurisdiction ?? null, generation: g.generation ?? null, stated: true };
    if (this.env && typeof this.env === "object")
      return { region: storeHint(this.env), jurisdiction: storeJurisdiction(this.env), generation: storeGeneration(this.env), stated: true };
    return { region: null, jurisdiction: null, generation: null, stated: false };
  }

  /* R1, R13: the register. A capture held in parts has the row of its whole (provenance R72), an identity with no file of
     its bundle: it travels marked `whole` and naming its parts in order (`provenance.partsNamed`), so an import verifies
     it by the parts' concatenation. Every other row is as it was. */
  #register(seg) {
    return this.#rows(`SELECT bundle_id, path, capture_sha, bytes, whole FROM register ORDER BY bundle_id`)
      .filter((r) => !(seg.bundles.has(r.bundle_id) || seg.shas.has(String(r.capture_sha || "").toLowerCase())))
      .map(({ whole, ...r }) => {
      if (Number(whole) !== 1) return r;
      const named = this.#provenance()?.partsNamed(r.bundle_id, r.capture_sha);
      return { ...r, whole: 1, parts: named && named.state === "named" ? named.parts.map((p) => p.sha256) : null };
    });
  }

  #declared() {
    try { return this.record && typeof this.record.declaredTables === "function" ? this.record.declaredTables() : []; }
    catch { return []; }
  }

  /** R8: one page of a carried table, fetched alone: from the manifest's `index` and `after` for it, the page's rows and
   *  canonical bytes with their SHA-256, to check against the manifest and resume from. Writes nothing. Refused
   *  `EXPORT_TABLE_UNKNOWN` (no declared table by that name), `EXPORT_TABLE_NOT_CARRIED` (declared `never` or
   *  derived-rebuildable: its rows never travel) or `EXPORT_PAGE_MALFORMED` (an index that is not a whole number). */
  exportPage({ table = null, index = null, after = null } = {}) {
    const d = this.#declared().find((x) => x.name === table);
    if (!d) return { ok: false, reason: "EXPORT_TABLE_UNKNOWN", table, detail: localize("corpus-export.index.table_not_declared", "no declared table has that name") };
    if (d.export === "never" || d.derive === "derived-rebuildable")
      return { ok: false, reason: "EXPORT_TABLE_NOT_CARRIED", table,
               detail: d.derive === "derived-rebuildable"
                 ? localize("corpus-export.index.table_rebuilt_by_rule", "derived-rebuildable: it travels as its rule")
                 : localize("corpus-export.index.table_never_travels", "export never: its rows never travel") };
    const i = Number(index);
    if (!Number.isInteger(i) || i < 0)
      return { ok: false, reason: "EXPORT_PAGE_MALFORMED", table,
               detail: localize("corpus-export.index.page_named_by_index", "a page is named by its index, a whole number, and its after") };
    let from = after;
    if (typeof from === "string") { try { from = JSON.parse(from); } catch { /* a plain key */ } }
    const pager = new TablePager(this.sql, d);
    const p = pager.held ? pager.page(from ?? null) : { rows: [], last: null, more: false };
    const bytes = pageBytes({ table: d.name, owner: d.module, index: i, rows: p.rows });
    return { ok: true, table: d.name, owner: d.module, index: i, after: from ?? null, rows: p.rows, bytes,
             sha256: createSha256().update(bytes).hex(), next: p.more ? p.last : null };
  }

  /** R10, R14: one part of a rendering in an open standard, for `viewer`, from the rows R7 would carry to that viewer and
   *  no others. It adds no fact and writes nothing but one `export_log` row naming the format. A source of more than
   *  RENDER_MAX records is continued by `part` (1-based, default 1): the answer's `next` names the following part (null
   *  on the last) and the body states the cut itself. A `part` that is not a whole number from 1 is refused
   *  `EXPORT_PART_MALFORMED`. */
  exportRendering({ format = null, viewer = null, part = null } = {}) {
    if (!FORMATS.includes(format))
      return { ok: false, reason: "EXPORT_FORMAT_UNKNOWN", format, formats: [...FORMATS],
               detail: localize("corpus-export.index.a_rendering_is_one_of", "a rendering is one of {FORMATS}; nothing was rendered or logged", { FORMATS: String(FORMATS.join(", ")) }) };
    const n = part === null || part === undefined || part === "" ? 1 : Number(part);
    if (!Number.isInteger(n) || n < 1)
      return { ok: false, reason: "EXPORT_PART_MALFORMED", format,
               detail: localize("corpus-export.index.a_part_is_a_whole_number", "a part of a rendering is named by a whole number from 1; nothing was rendered or logged") };
    const at = this.#when();
    const { body, more } = render(format, { sql: this.sql, record: this.record, ...this.#ownerDeps() }, viewer, at, n);
    const items = itemsOf(format, body);
    this.sql.exec(`INSERT INTO export_log (at,scope,bundles,files,note,tables,rows,format) VALUES (?,'rendering',0,0,NULL,NULL,?,?)`,
                  at, items, format);
    return { ok: true, at, format, standard: STANDARDS[format], items, part: n, next: more ? n + 1 : null, truncated: more, rendering: body,
             recorded: word("corpus-export.recorded.rendering_append_export") };
  }

  #ownerDeps() { return { ...this.owners }; }

  /** The log, readable by in-app administrators who cannot run an export.
   *
   *  REC-57 — NOT NAMED IN THE ITEM, and the worst instance of its class on the
   *  roster. This op read the log at a literal `LIMIT 200` with no parameter at
   *  all, and published neither the bound nor a truncation flag: an
   *  administrator reading `exports` saw the newest 200 entries of an
   *  APPEND-ONLY log and had no way to tell that from the whole of it. The
   *  sentence the export manifest tells them is "this export is in the
   *  append-only export log and is visible to every administrator" — a
   *  completeness claim, which is exactly what UI-25 says an unstated bound
   *  reads as. On a store past 200 exports, the export that is being looked for
   *  is the one that has fallen off.
   *
   *  `limit` is now accepted (default 200, clamped to 1..1000) so a truncated
   *  reader can ask for more, and the answer carries the bound it applied and
   *  whether it bit. Ordering, columns and the `exports` key are unchanged, and
   *  a caller that passes nothing gets byte-identical rows. */
  exportLog({ limit = null } = {}) {
    const cap = Math.max(1, Math.min(Math.floor(Number(limit) || EXPORT_LOG_LIMIT_DEFAULT),
                                     EXPORT_LOG_LIMIT_MAX));
    /* cap + 1 asked for, cap delivered: the extra row is the whole difference
       between "there are 200 exports" and "here are the first 200". */
    const page = this.#rows(
      `SELECT seq, at, scope, bundles, files, note, tables, rows, format FROM export_log ORDER BY seq DESC LIMIT ?`, cap + 1);
    return { ok: true, exports: page.slice(0, cap), limit: cap, truncated: page.length > cap };
  }

  /** R3: the verifying import, as a pure check (K1072's START, R3's Suggestion; P17). */
  verifyCorpusExport(input) { return verifyCorpusExport(input); }
}

/* ---- R3: the verifying import ----
 *
 * WHAT IT IS HANDED: R1's answer (`manifest`) and the bytes that answer names, keyed by their SHA-256 (`bytes`: a Map
 * or a plain object, each value a Uint8Array, an ArrayBuffer or a string read as UTF-8): the files' contents, the
 * snapshots' contents and the registered captures. R1 carries hashes, never bytes, so the bytes travel beside it.
 *
 * WHAT IT TRUSTS: nothing the manifest asserts (Membership v2 §8, "What verified must mean"). Every digest is
 * re-derived from the bytes handed under it, every size measured, and every link the manifest states is checked
 * against the parts of the manifest those bytes have just verified:
 *   - each file's bytes hash to its `sha256` and measure its `bytes` (FILE_HASH_MISMATCH, FILE_SIZE_MISMATCH);
 *   - each bundle's `bundle_sha` is its live `bundle.md`'s digest (record-core's commit; BUNDLE_SHA_MISMATCH);
 *   - the history chain, walked in R1's write order: the first promotion replaced nothing, so its base is the
 *     creation base and no snapshot is filed under its key (CHAIN_START_UNANCHORED); every later promotion's base is
 *     the digest of the `bundle.md` it replaced, which commit filed under that promotion's key (BASE_UNLINKED); every
 *     snapshot is filed under a promotion's key (SNAPSHOT_UNLINKED) and its bytes hash to its `sha256`
 *     (SNAPSHOT_HASH_MISMATCH);
 *   - each registered capture's bytes hash to its digest and measure the register's size (CAPTURE_HASH_MISMATCH,
 *     CAPTURE_SIZE_MISMATCH): a byte comparison against what the register recorded;
 *   - the stated counts are the counts of what the manifest lists (COUNTS_MISMATCH);
 *   - every digest named has its bytes (BYTES_MISSING).
 * A digest is held to whatever names it: bytes a file and a registered capture share are checked at both, and a
 * tamper with them is named at both.
 *
 * WHAT IT ANSWERS: `{ok: true, verified: true, counts}`, or `{ok: false, verified: false, failures, counts}`, each
 * failure `{reason, bundle, path | snap_key | capture, expected, found}`: which record, which part, what the check
 * expected and what it found. It writes nothing, reads no table and never throws; writing a verified corpus into a
 * receiving store is not stated (R3's Suggestion), so it is not here. */
export function verifyCorpusExport(input) {
  const { manifest = null, bytes = null, declared = null } = input && typeof input === "object" ? input : {};
  const failures = [];
  const counts = { bundles: 0, files: 0, promotions: 0, snapshots: 0, captures: 0, tables: 0, pages: 0 };
  try {
    if (!manifest || typeof manifest !== "object" || !Array.isArray(manifest.bundles))
      return refused([{ reason: "MANIFEST_MALFORMED", expected: localize("corpus-export.index.manifest_object_listing_records", "an export's manifest: an object listing its records"),
                        found: describe(manifest) }], counts);
    const held = bytesOf(bytes);
    const digests = new Map();
    /* The bytes under `sha`, re-hashed once however many places name it; null when none were handed over. */
    const derive = (sha) => {
      const key = lower(sha);
      if (!digests.has(key)) {
        const b = held(key);
        digests.set(key, b ? { hex: createSha256().update(b).hex(), size: b.length } : null);
      }
      return digests.get(key);
    };
    /* One part named by a digest: its bytes are present, hash to it, and (when a size is stated) measure it. */
    const part = (where, sha, size, hashReason, sizeReason) => {
      const want = lower(sha);
      if (!HEX64.test(want)) {
        failures.push({ reason: hashReason, ...where, expected: "a SHA-256 digest", found: describe(sha) });
        return false;
      }
      const got = derive(want);
      if (!got) { failures.push({ reason: "BYTES_MISSING", ...where, expected: want, found: null }); return false; }
      if (got.hex !== want) { failures.push({ reason: hashReason, ...where, expected: want, found: got.hex }); return false; }
      if (sizeReason && size != null && Number(size) !== got.size)
        failures.push({ reason: sizeReason, ...where, expected: size, found: got.size });
      return true;
    };

    let fileTotal = 0;
    for (const b of manifest.bundles) {
      const bundle = b && typeof b.bundle_id === "string" ? b.bundle_id : null;
      const files = b && Array.isArray(b.files) ? b.files : [];
      const promotions = b && Array.isArray(b.promotions) ? b.promotions : [];
      const snapshots = b && Array.isArray(b.snapshots) ? b.snapshots : [];
      counts.bundles++;
      fileTotal += files.length;
      for (const f of files) {
        counts.files++;
        part({ bundle, path: f ? f.path ?? null : null }, f && f.sha256, f ? f.bytes : null,
             "FILE_HASH_MISMATCH", "FILE_SIZE_MISMATCH");
      }
      /* bundle_sha is the live bundle.md's digest (the first file when there is none), as record-core's commit sets it. */
      const head = files.find((f) => f && f.path === "bundle.md") || files[0] || null;
      if (head && lower(b.bundle_sha) !== lower(head.sha256))
        failures.push({ reason: "BUNDLE_SHA_MISMATCH", bundle, path: head.path ?? null, expected: lower(head.sha256),
                        found: b.bundle_sha ?? null });
      /* The snapshots filed under each key, and each snapshot's own bytes. */
      const filed = new Map();
      for (const s of snapshots) {
        counts.snapshots++;
        const key = s ? s.snap_key ?? null : null;
        if (!filed.has(key)) filed.set(key, []);
        filed.get(key).push(s);
        part({ bundle, snap_key: key, path: s ? s.path ?? null : null }, s && s.sha256, null, "SNAPSHOT_HASH_MISMATCH");
      }
      const keys = new Set();
      promotions.forEach((p, i) => {
        counts.promotions++;
        const key = p ? p.snap_key ?? null : null;
        keys.add(key);
        const base = p ? p.base ?? null : null;
        const under = filed.get(key) || [];
        if (i === 0) {
          if ((base !== null && lower(base) !== CREATION_BASE) || under.length)
            failures.push({ reason: "CHAIN_START_UNANCHORED", bundle, snap_key: key,
                            expected: localize("corpus-export.index.the_creation_base_creation_base", "the creation base {CREATION_BASE}, with nothing filed under this key", { CREATION_BASE: String(CREATION_BASE) }),
                            found: under.length ? localize("corpus-export.index.describe_with_length_snapshot_s", "{describe}, with {length} snapshot(s) filed", { describe: String(describe(base)), length: String(under.length) }) : describe(base) });
          return;
        }
        /* The bundle.md this promotion replaced, which commit filed under its key (the first file when there is none). */
        const replaced = under.find((s) => s && s.path === "bundle.md") || under[0] || null;
        if (!replaced || lower(base) !== lower(replaced.sha256))
          failures.push({ reason: "BASE_UNLINKED", bundle, snap_key: key,
                          expected: replaced ? lower(replaced.sha256) : localize("corpus-export.index.snapshot_filed_under_key", "a snapshot filed under this key"),
                          found: describe(base) });
      });
      for (const [key, rows] of filed)
        if (!keys.has(key))
          for (const s of rows)
            failures.push({ reason: "SNAPSHOT_UNLINKED", bundle, snap_key: key, path: s ? s.path ?? null : null,
                            expected: localize("corpus-export.index.promotion_filed_under_key", "a promotion filed under this key"), found: null });
    }
    for (const r of Array.isArray(manifest.register) ? manifest.register : []) {
      counts.captures++;
      const where = { bundle: r ? r.bundle_id ?? null : null, path: r ? r.path ?? null : null, capture: r ? r.capture_sha ?? null : null };
      /* R13: the row of a whole held in parts is an identity, verified by the concatenation of its parts' bytes unless the
         concatenation itself was handed over (as it was before provenance R72). */
      const pieces = r && Number(r.whole) === 1 && Array.isArray(r.parts) && r.parts.length && HEX64.test(lower(r.capture_sha))
        && !derive(lower(r.capture_sha)) ? r.parts.map((p) => (typeof p === "string" ? held(lower(p)) : null)) : null;
      if (!pieces) {
        part(where, r && r.capture_sha, r ? r.bytes : null, "CAPTURE_HASH_MISMATCH", "CAPTURE_SIZE_MISMATCH");
        continue;
      }
      if (pieces.some((b) => !b)) { failures.push({ reason: "BYTES_MISSING", ...where, expected: lower(r.capture_sha), found: null }); continue; }
      const digest = createSha256();
      let size = 0;
      for (const b of pieces) { digest.update(b); size += b.length; }
      const got = digest.hex();
      if (got !== lower(r.capture_sha)) failures.push({ reason: "CAPTURE_HASH_MISMATCH", ...where, expected: lower(r.capture_sha), found: got });
      else if (r.bytes != null && Number(r.bytes) !== size) failures.push({ reason: "CAPTURE_SIZE_MISMATCH", ...where, expected: r.bytes, found: size });
    }
    if (!Array.isArray(manifest.register))
      failures.push({ reason: "MANIFEST_MALFORMED", expected: "the register, a list", found: describe(manifest.register) });
    const rowTotal = verifyTables(manifest, held, failures, counts, declared);
    const stated = manifest.counts && typeof manifest.counts === "object" ? manifest.counts : {};
    for (const [k, n] of [["bundles", counts.bundles], ["files", fileTotal],
                          ...(Array.isArray(manifest.tables) ? [["tables", counts.tables], ...(rowTotal === null ? [] : [["rows", rowTotal]])] : [])])
      if (stated[k] !== n) failures.push({ reason: "COUNTS_MISMATCH", path: `counts.${k}`, expected: n, found: stated[k] ?? null });
    /* R16: a register comes back as its descriptors and the places of its removals, never a row: shown as the manifest
       lists them, with the statement that the rows are brought in again from the source. */
    const shown = registersShown(manifest.registers);
    if (shown && shown.carried_rows) failures.push({ reason: "REGISTER_ROWS_CARRIED", path: "registers", expected: localize("corpus-export.index.register_no_row", "no register row, cell or segment"), found: shown.carried_rows });
    const extra = shown ? { registers: shown.view } : {};
    return failures.length ? { ...refused(failures, counts), ...extra } : { ok: true, verified: true, counts, ...extra };
  } catch (e) {
    /* Never a throw: an export this cannot read is not verified, and says why. */
    return refused([...failures, { reason: "MANIFEST_MALFORMED", expected: "a readable export",
                                   found: String(e && e.message || e).slice(0, 160) }], counts);
  }
}

/* R3 (T33-61): every table page re-derived. Each carried table's pages run 0..n-1 with none missing; each page's bytes
   are present, hash to its digest and measure its size; its bytes parse as the canonical page of that table and index,
   holding the rows it states; the rows of the pages sum to the table's stated rows. A table declared `never` carries no
   page. Every table the manifest names, or that the importer's own `declared` list names (a list of names, or of
   `declaredTables()` entries), is carried or named (TABLE_NOT_CARRIED). Answers the rows re-derived. */
function verifyTables(manifest, held, failures, counts, declared) {
  const tables = manifest.tables;
  if (tables === undefined) {
    if (declared != null) failures.push({ reason: "MANIFEST_MALFORMED", expected: localize("corpus-export.index.declared_tables_list", "the declared tables, a list"), found: null });
    return 0;
  }
  if (!Array.isArray(tables)) {
    failures.push({ reason: "MANIFEST_MALFORMED", expected: localize("corpus-export.index.declared_tables_list", "the declared tables, a list"), found: describe(tables) });
    return 0;
  }
  const td = new TextDecoder("utf-8", { fatal: true });
  const named = new Set();
  let total = 0, sound = true;
  for (const t of tables) {
    counts.tables++;
    const table = t && typeof t.table === "string" ? t.table : null;
    named.add(table);
    const pages = t && Array.isArray(t.pages) ? t.pages : [];
    const where = { table };
    if (t && t.classes && t.classes.export === "never" && (pages.length || t.rows))
      failures.push({ reason: "TABLE_NEVER_CARRIED", ...where, expected: localize("corpus-export.index.never_table_no_row", "no row of a table declared export never"),
                      found: `${pages.length} page(s)` });
    if (!t || t.carried !== "rows") continue;
    let rows = 0;
    const before = failures.length;
    const byIndex = new Map(pages.map((p) => [p && p.index, p]));
    for (let i = 0; i < pages.length; i++)
      if (!byIndex.has(i))
        failures.push({ reason: "PAGE_MISSING", ...where, page: i, expected: `pages 0 to ${pages.length - 1}`, found: null });
    for (const p of pages) {
      counts.pages++;
      const at = { ...where, page: p ? p.index ?? null : null };
      const want = lower(p && p.sha256);
      if (!HEX64.test(want)) { failures.push({ reason: "PAGE_HASH_MISMATCH", ...at, expected: "a SHA-256 digest", found: describe(p && p.sha256) }); continue; }
      const b = held(want);
      if (!b) { failures.push({ reason: "BYTES_MISSING", ...at, expected: want, found: null }); continue; }
      const got = createSha256().update(b).hex();
      if (got !== want) { failures.push({ reason: "PAGE_HASH_MISMATCH", ...at, expected: want, found: got }); continue; }
      if (p.bytes != null && Number(p.bytes) !== b.length)
        failures.push({ reason: "PAGE_SIZE_MISMATCH", ...at, expected: p.bytes, found: b.length });
      let page = null;
      try { page = JSON.parse(td.decode(b)); } catch { page = null; }
      if (!page || !Array.isArray(page.rows) || canonical(page) !== td.decode(b)) {
        failures.push({ reason: "PAGE_MALFORMED", ...at, expected: localize("corpus-export.index.canonical_page_of_rows", "a canonical page of rows"), found: null });
        continue;
      }
      if (page.table !== table || page.index !== p.index || page.owner !== t.owner)
        failures.push({ reason: "PAGE_MISPLACED", ...at, expected: `${t.owner}/${table} page ${p.index}`,
                        found: `${describe(page.owner)}/${describe(page.table)} page ${describe(page.index)}` });
      if (page.rows.length !== Number(p.rows))
        failures.push({ reason: "PAGE_ROWS_MISMATCH", ...at, expected: p.rows, found: page.rows.length });
      rows += page.rows.length;
    }
    total += rows;
    /* A page already refused is named there; its table's sum is not named again for it. */
    if (failures.length !== before) { sound = false; continue; }
    if (rows !== t.rows) failures.push({ reason: "TABLE_ROWS_MISMATCH", ...where, expected: rows, found: t.rows ?? null });
  }
  const must = Array.isArray(declared) ? declared.map((d) => (typeof d === "string" ? d : d && d.name)).filter(Boolean) : [];
  for (const name of must)
    if (!named.has(name))
      failures.push({ reason: "TABLE_NOT_CARRIED", table: name, expected: localize("corpus-export.index.declared_table_carried_or_named", "every declared table carried or named"), found: null });
  return sound ? total : null;
}

/* R16: what an import shows of a register: each descriptor, each tombstone (table, key, ground, instant), no row. A
   descriptor or tombstone that carries a cell, a row or a segment's bytes is counted, so the import refuses it. */
function registersShown(r) {
  if (!r || typeof r !== "object") return null;
  const descriptors = Array.isArray(r.descriptors) ? r.descriptors : [];
  const tombstones = (Array.isArray(r.tombstones) ? r.tombstones : []).map((t) => ({ table: t?.table ?? null, key: t?.key ?? null, ground: t?.ground ?? null, at: t?.at ?? null }));
  const carried_rows = descriptors.filter((d) => d && ("cells" in d || "rows" in d || "segments" in d)).length;
  return { carried_rows, view: { descriptors, tombstones, rows_restored: 0,
    said: localize("corpus-export.registers.rows_not_carried", "Rows not carried: bring them in again from the source. Each import is carried as its description, and each removal as where it was.") } };
}

function refused(failures, counts) { return { ok: false, verified: false, failures, counts }; }
function lower(v) { return typeof v === "string" ? v.trim().toLowerCase() : ""; }
function describe(v) {
  if (v === null || v === undefined) return null;
  const s = typeof v === "string" ? v : (() => { try { return JSON.stringify(v); } catch { return String(v); } })();
  return String(s).slice(0, 80);
}
/* The bytes handed over, looked up by lowercase digest: a Map or a plain object; a value that is neither bytes nor a
   string holds nothing. */
function bytesOf(given) {
  const get = given instanceof Map ? (k) => given.get(k)
    : given && typeof given === "object" ? (k) => (Object.prototype.hasOwnProperty.call(given, k) ? given[k] : undefined)
    : () => undefined;
  const index = new Map();
  if (given instanceof Map) for (const k of given.keys()) index.set(lower(k), k);
  else if (given && typeof given === "object") for (const k of Object.keys(given)) index.set(lower(k), k);
  return (key) => {
    const v = index.has(key) ? get(index.get(key)) : undefined;
    if (v instanceof Uint8Array) return v;
    if (v instanceof ArrayBuffer) return new Uint8Array(v);
    if (typeof v === "string") return te.encode(v);
    return null;
  };
}

/** R6: the route arms, keyed by op name, each a function of no arguments (escalation's `escalationOps` form): `export`
 *  answers R1 with the query's `note`, `exportlog` answers R2 with its `limit`, as publication's arms did. `ce` is the
 *  host's instance (`corpusExportOf`), `q` reads one query parameter. The plane spreads the map into its own. */
export function corpusExportOps(ce, q) {
  return {
    export: () => ce.exportManifest({ note: q("note") }),
    exportlog: () => ce.exportLog({ limit: q("limit") }),
    /* T33-61 (J1 (3), (4)): one page of a carried table (R8), and a part of a rendering for the stamped viewer (R10, R14). */
    exportpage: () => ce.exportPage({ table: q("table"), index: q("index"), after: q("after") }),
    exportrender: () => ce.exportRendering({ format: q("format"), viewer: q("viewer"), part: q("part") }),
  };
}

/** R17, R18 (T53; K5441, K5443): the whole-record arms, `exportwhole` (administrator only, as `export`) and
 *  `exportwholepart`, in the form of `corpusExportOps`. Kept apart from that map until op-declarations holds their rows
 *  (its spec check refuses an arm with none; a declared row would join the member session set): the plane spreads
 *  this map once their rows are there. */
export function wholeExportOps(ce, q) {
  return {
    exportwhole: () => ce.exportWhole({ note: q("note") }),
    exportwholepart: () => ce.exportWholePart({ file: q("file"), offset: q("offset"), bytes: q("bytes") }),
  };
}

/* R11 (T51; K4168; op-declarations R80, op-grades R49): the ops this module serves that the screens send, declared by their owner beside
   the ops map: each row's class, weight and description are the op's existing rows', its fields are what the arm reads. */
export const DECLARED_OPS = Object.freeze({
  export: { classes: ["admin"], mutating: true, weight: "substrate", description: localize("corpus-export.declared.export", "writes an export manifest of what is already there"),
    fields: { accepts: ["note"], requires: [] } },
  exportlog: { classes: ["admin","member","probe"], mutating: false, weight: "read", description: "act.exportlog.label.group",
    fields: { accepts: ["limit"], requires: [] } },
  /* R15 (fix round 6 G22): `part` joins the keys the arm reads; `viewer` is the door's stamp. */
  exportrender: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "substrate",
    description: localize("corpus-export.declared.exportrender", "export: keyed by (viewer, format); renders what the viewer would be carried and logs who took it"),
    fields: { accepts: ["format","part"], requires: ["format"] } },
});

const instances = new WeakMap();

/** The one instance for a host (K61). The first call creates it with `deps` (a test passes its own), creates
 *  `export_log`, and declares it to record-core's purge as exempt (R4); the declaration's answer is kept as
 *  `purgeDeclaration`. */
export function corpusExportOf(host, deps) {
  let c = instances.get(host);
  if (!c) {
    const d = deps || {};
    const storage = d.storage || host.storage;
    const record = d.record || recordOf(host);
    /* R10's owners, each reached through its factory on this host on first use unless given. */
    const owners = { entities: d.entities ?? (() => entitiesOf(host, { record })), events: d.events ?? (() => eventsOf(host, { record })),
                     lines: d.lines ?? (() => linesOf(host, { record })), money: d.money ?? (() => moneyOf(host, { record })) };
    c = new CorpusExport({ ...d, ...owners, provenance: d.provenance ?? (() => provenanceOf(host, { record })), storage, record });
    instances.set(host, c);
    c.migrate();
    c.purgeDeclaration = record.declarePurge("corpus-export", [], { exempt: [...CORPUS_EXPORT_EXEMPT] });
  }
  return c;
}
