/* ZIP archives written in memory for the tests of every module that reads one:
 * conforming ones in APPNOTE 6.3's form, and hostile ones that say exactly what
 * a test asks them to (requirements/test-support.md R10–R14; N688, K1844,
 * K1852, F7). Not product code. Importing this module has no side effect; it
 * reads no clock, draws no random number and writes nothing to disk.
 *
 * An archive is built in two passes: each entry is first resolved to the
 * fields its local header, its data descriptor and its central-directory
 * record will state (true values, then the entry's overrides), and only then
 * laid out, so an override changes the field it names and nothing else. */
import { deflateRawSync } from "node:zlib";
import { localize } from "../src/setup-words/index.mjs";

const SIG = { local: 0x04034b50, central: 0x02014b50, descriptor: 0x08074b50, eocd: 0x06054b50, zip64Eocd: 0x06064b50, zip64Locator: 0x07064b50 };
const MAX16 = 0xffff, MAX32 = 0xffffffff;
/* The one MS-DOS time an entry carries when it names none: 1980-01-01 00:00:00. */
const DOS_DATE = (0 << 9) | (1 << 5) | 1, DOS_TIME = 0;
const ENCRYPTION = { traditional: 0x0001, strong: 0x0041, aes: 0x0001, directory: 0x2000 };

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32 as APPNOTE §4.4.7 defines it (the ISO 3309 polynomial). */
export function crc32(bytes) {
  let c = MAX32;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ MAX32) >>> 0;
}

const utf8 = (s) => new TextEncoder().encode(s);
const isBytes = (v) => v instanceof Uint8Array;
const isAscii = (s) => /^[\x00-\x7f]*$/.test(s);

/** Bytes from a string (UTF-8) or a Uint8Array; `field` names it in an error. */
function bytesOf(v, field) {
  if (typeof v === "string") return utf8(v);
  if (isBytes(v)) return v;
  throw new Error(`makeZip: ${field} must be a string or a Uint8Array`);
}

/** A little-endian writer over a growing list of byte chunks. */
class Out {
  constructor() { this.parts = []; this.length = 0; }
  bytes(b) { this.parts.push(b); this.length += b.length; }
  u(width, v, field) {
    const max = width === 8 ? Number.MAX_SAFE_INTEGER : 2 ** (width * 8) - 1;
    if (!Number.isInteger(v) || v < 0 || v > max) throw new Error(`makeZip: ${field} must be an integer from 0 to ${max}, got ${v}`);
    const b = new Uint8Array(width);
    for (let i = 0, x = v; i < width; i++, x = Math.floor(x / 256)) b[i] = x % 256;
    this.bytes(b);
  }
  u16(v, f) { this.u(2, v, f); }
  u32(v, f) { this.u(4, v, f); }
  u64(v, f) { this.u(8, v, f); }
  done() {
    const all = new Uint8Array(this.length);
    let o = 0;
    for (const p of this.parts) { all.set(p, o); o += p.length; }
    return all;
  }
}

/** One extra field (header id, then its body). */
function extra(id, write) {
  const body = new Out();
  write(body);
  const out = new Out();
  out.u16(id, "extra id");
  out.u16(body.length, "extra size");
  out.bytes(body.done());
  return out.done();
}

/* Override objects may set only these fields; any other key is a spec it
   cannot write, refused by name rather than ignored. */
const LOCAL_FIELDS = ["name", "method", "flags", "crc32", "compressedSize", "uncompressedSize"];
const FIELDS = {
  local: LOCAL_FIELDS,
  central: [...LOCAL_FIELDS, "localOffset"],
  descriptor: ["crc32", "compressedSize", "uncompressedSize", "signature"],
  eocd: ["entries", "diskEntries", "cdSize", "cdOffset"],
  zip64Record: ["entries", "diskEntries", "cdSize", "cdOffset"],
};
function checkOverride(kind, value, where) {
  if (value === undefined) return {};
  if (value === null || typeof value !== "object") throw new Error(`makeZip: ${where} must be an object`);
  for (const k of Object.keys(value)) {
    if (!FIELDS[kind].includes(k)) throw new Error(`makeZip: ${where}.${k} is not a field makeZip can override`);
  }
  return value;
}

/** Resolves entry `i` to everything its records state (R10, then R12's overrides). */
function resolve(e, i, resolved) {
  const at = `entries[${i}]`;
  if (e === null || typeof e !== "object") throw new Error(`makeZip: ${at} must be an object`);
  if (e.name === undefined) throw new Error(`makeZip: ${at}.name is missing`);
  const name = bytesOf(e.name, `${at}.name`);
  if (e.sameDataAs !== undefined) {
    const j = e.sameDataAs;
    if (!Number.isInteger(j) || j < 0 || j >= i) throw new Error(`makeZip: ${at}.sameDataAs must name an earlier entry, got ${j}`);
    /* R12 overlap: this record points at entry j's local header and data, so it
       states what that record states, under its own name. */
    const target = resolved[j];
    const own = checkOverride("central", e.central, `${at}.central`);
    const central = { ...target.trueCentral, name };
    const utf8Name = e.utf8 ?? (typeof e.name === "string" && !isAscii(e.name));
    central.flags = utf8Name ? central.flags | 0x0800 : central.flags & ~0x0800;
    Object.assign(central, own);
    central.name = bytesOf(central.name, `${at}.central.name`);
    return { overlay: true, target: j, central, centralOverride: own, zip64: target.zip64, versionNeeded: target.versionNeeded };
  }
  if (e.data === undefined) throw new Error(`makeZip: ${at}.data is missing`);
  const data = bytesOf(e.data, `${at}.data`);
  const method = e.method ?? 8;
  if (!Number.isInteger(method) || method < 0 || method > MAX16) throw new Error(`makeZip: ${at}.method must be an integer from 0 to ${MAX16}`);
  if (e.encrypted !== undefined && !(e.encrypted in ENCRYPTION)) {
    throw new Error(`makeZip: ${at}.encrypted must be "traditional", "strong", "aes" or "directory", got ${JSON.stringify(e.encrypted)}`);
  }
  /* Deflate is the only method this writer performs; any other is written as
     declared over the data as given (R10), as is the data of an entry marked
     encrypted, which is never actually encrypted (R12). */
  const payload = method === 8 && !e.encrypted ? new Uint8Array(deflateRawSync(data)) : data;
  let flags = 0;
  const utf8Name = e.utf8 ?? (typeof e.name === "string" && !isAscii(e.name));
  if (utf8Name) flags |= 0x0800;
  if (e.dataDescriptor) flags |= 0x0008;
  if (e.encrypted) flags |= ENCRYPTION[e.encrypted];
  const zip64 = !!e.zip64;
  const aes = e.encrypted === "aes";
  const aesExtra = aes ? extra(0x9901, (o) => { o.u16(2, "AE version"); o.bytes(utf8("AE")); o.bytes(Uint8Array.of(3)); o.u16(method, `${at}.method`); }) : null;
  const versionNeeded = aes ? 51 : zip64 ? 45 : 20;
  const trueFields = { name, method: aes ? 99 : method, flags, crc32: crc32(data), compressedSize: payload.length, uncompressedSize: data.length };
  const dosDate = e.dosDate ?? DOS_DATE, dosTime = e.dosTime ?? DOS_TIME;
  const localOverride = checkOverride("local", e.local, `${at}.local`);
  const centralOverride = checkOverride("central", e.central, `${at}.central`);
  const local = { ...trueFields };
  if (e.dataDescriptor) Object.assign(local, { crc32: 0, compressedSize: 0, uncompressedSize: 0 });
  Object.assign(local, localOverride);
  local.name = bytesOf(local.name, `${at}.local.name`);
  const central = { ...trueFields, ...centralOverride };
  central.name = bytesOf(central.name, `${at}.central.name`);
  let descriptor = null;
  if (e.dataDescriptor) {
    descriptor = { crc32: trueFields.crc32, compressedSize: payload.length, uncompressedSize: data.length, signature: true, ...checkOverride("descriptor", e.descriptor, `${at}.descriptor`) };
  } else if (e.descriptor !== undefined) {
    throw new Error(`makeZip: ${at}.descriptor needs ${at}.dataDescriptor`);
  }
  return { overlay: false, payload, local, localOverride, central, centralOverride, trueCentral: trueFields, descriptor, zip64, aesExtra, versionNeeded, dosDate, dosTime };
}

/**
 * A ZIP archive (R10–R13). `entries`: `{name, data, method = 8}` plus R12's
 * overrides (`utf8`, `local`, `central`, `dataDescriptor`, `descriptor`,
 * `zip64`, `encrypted`, `sameDataAs`, and `dosDate`/`dosTime` for a time of
 * its own). `options`: `zip64`, `zip64Record`, `eocd`, `comment`, `secondEocd`.
 */
export function makeZip(entries, options = {}) {
  if (!Array.isArray(entries)) throw new Error("makeZip: entries must be an array");
  if (options === null || typeof options !== "object") throw new Error("makeZip: options must be an object");
  const resolved = [];
  entries.forEach((e, i) => resolved.push(resolve(e, i, resolved)));
  const eocdOverride = checkOverride("eocd", options.eocd, "options.eocd");
  const zip64RecordOverride = checkOverride("zip64Record", options.zip64Record, "options.zip64Record");
  if (options.zip64Record !== undefined && !options.zip64) throw new Error("makeZip: options.zip64Record needs options.zip64");

  const out = new Out();
  const offsets = [];
  /* Local headers and data, in order. */
  resolved.forEach((r, i) => {
    const at = `entries[${i}]`;
    if (r.overlay) { offsets.push(offsets[r.target]); return; }
    offsets.push(out.length);
    const l = r.local;
    const ext = [];
    if (r.zip64) ext.push(extra(0x0001, (o) => { o.u64(r.descriptor ? 0 : r.trueCentral.uncompressedSize, "zip64 size"); o.u64(r.descriptor ? 0 : r.trueCentral.compressedSize, "zip64 size"); }));
    if (r.aesExtra) ext.push(r.aesExtra);
    const extraBytes = concat(ext);
    out.u32(SIG.local);
    out.u16(r.versionNeeded, `${at} version`);
    out.u16(l.flags, `${at}.local.flags`);
    out.u16(l.method, `${at}.local.method`);
    out.u16(r.dosTime, `${at}.dosTime`);
    out.u16(r.dosDate, `${at}.dosDate`);
    out.u32(l.crc32, `${at}.local.crc32`);
    /* ZIP64: the sizes go to the extra field and the header says 0xFFFFFFFF,
       unless an override names what the header states. */
    const sentinel = (field) => (r.zip64 && r.localOverride[field] === undefined ? MAX32 : l[field]);
    out.u32(sentinel("compressedSize"), `${at}.local.compressedSize`);
    out.u32(sentinel("uncompressedSize"), `${at}.local.uncompressedSize`);
    out.u16(l.name.length, `${at}.local.name length`);
    out.u16(extraBytes.length, localize("test-support.make-zip.at_local_extra_length", "{at} local extra length", { at: String(at) }));
    out.bytes(l.name);
    out.bytes(extraBytes);
    r.dataOffset = out.length;
    out.bytes(r.payload);
    if (r.descriptor) {
      const d = r.descriptor;
      if (d.signature !== false) out.u32(d.signature === true ? SIG.descriptor : d.signature, `${at}.descriptor.signature`);
      out.u32(d.crc32, `${at}.descriptor.crc32`);
      const w = r.zip64 ? (v, f) => out.u64(v, f) : (v, f) => out.u32(v, f);
      w(d.compressedSize, `${at}.descriptor.compressedSize`);
      w(d.uncompressedSize, `${at}.descriptor.uncompressedSize`);
    }
  });

  /* The central directory. */
  const cdOffset = out.length;
  resolved.forEach((r, i) => {
    const at = `entries[${i}]`;
    const c = r.central;
    const own = r.centralOverride;
    const localOffset = own.localOffset ?? offsets[i];
    let extraBytes;
    if (r.overlay) extraBytes = resolved[r.target].extraCentral;
    else {
      const ext = [];
      if (r.zip64) ext.push(extra(0x0001, (o) => { o.u64(r.trueCentral.uncompressedSize, "zip64 size"); o.u64(r.trueCentral.compressedSize, "zip64 size"); o.u64(offsets[i], "zip64 offset"); }));
      if (r.aesExtra) ext.push(r.aesExtra);
      extraBytes = r.extraCentral = concat(ext);
    }
    const t = r.overlay ? resolved[r.target] : r;
    const sentinel = (field, v) => (r.zip64 && own[field] === undefined ? MAX32 : v);
    out.u32(SIG.central);
    out.u16(r.versionNeeded, localize("test-support.make-zip.at_version_made_by", "{at} version made by", { at: String(at) }));
    out.u16(r.versionNeeded, `${at} version`);
    out.u16(c.flags, `${at}.central.flags`);
    out.u16(c.method, `${at}.central.method`);
    out.u16(t.dosTime, `${at}.dosTime`);
    out.u16(t.dosDate, `${at}.dosDate`);
    out.u32(c.crc32, `${at}.central.crc32`);
    out.u32(sentinel("compressedSize", c.compressedSize), `${at}.central.compressedSize`);
    out.u32(sentinel("uncompressedSize", c.uncompressedSize), `${at}.central.uncompressedSize`);
    out.u16(c.name.length, `${at}.central.name length`);
    out.u16(extraBytes.length, localize("test-support.make-zip.at_central_extra_length", "{at} central extra length", { at: String(at) }));
    out.u16(0, "comment length");
    out.u16(0, "disk number");
    out.u16(0, "internal attributes");
    out.u32(0, "external attributes");
    out.u32(sentinel("localOffset", localOffset), `${at}.central.localOffset`);
    out.bytes(c.name);
    out.bytes(extraBytes);
  });
  const cdSize = out.length - cdOffset;
  const n = resolved.length;

  /* ZIP64's end record and its locator, then the end record. */
  if (options.zip64) {
    const recordOffset = out.length;
    const z = { entries: n, diskEntries: n, cdSize, cdOffset, ...zip64RecordOverride };
    out.u32(SIG.zip64Eocd);
    out.u64(44, "zip64 record size");
    out.u16(45, "zip64 version made by");
    out.u16(45, "zip64 version");
    out.u32(0, "zip64 disk");
    out.u32(0, "zip64 cd disk");
    out.u64(z.diskEntries, "options.zip64Record.diskEntries");
    out.u64(z.entries, "options.zip64Record.entries");
    out.u64(z.cdSize, "options.zip64Record.cdSize");
    out.u64(z.cdOffset, "options.zip64Record.cdOffset");
    out.u32(SIG.zip64Locator);
    out.u32(0, "locator disk");
    out.u64(recordOffset, "locator offset");
    out.u32(1, "locator disks");
  }
  const end = options.zip64
    ? { entries: MAX16, diskEntries: MAX16, cdSize: MAX32, cdOffset: MAX32, ...eocdOverride }
    : { entries: n, diskEntries: n, cdSize, cdOffset, ...eocdOverride };
  const writeEnd = (o, commentLength) => {
    o.u32(SIG.eocd);
    o.u16(0, "disk");
    o.u16(0, "cd disk");
    o.u16(end.diskEntries, "options.eocd.diskEntries");
    o.u16(end.entries, "options.eocd.entries");
    o.u32(end.cdSize, "options.eocd.cdSize");
    o.u32(end.cdOffset, "options.eocd.cdOffset");
    o.u16(commentLength, "options.comment length");
  };
  let comment = options.comment === undefined ? new Uint8Array(0) : bytesOf(options.comment, "options.comment");
  if (options.secondEocd) {
    /* A second candidate inside the comment, well formed and ending exactly at
       the archive's end, so a reader scanning back from the end meets it first. */
    const inner = new Out();
    writeEnd(inner, 0);
    comment = concat([comment, inner.done()]);
  }
  writeEnd(out, comment.length);
  out.bytes(comment);
  return out.done();
}

function concat(list) {
  const out = new Out();
  for (const b of list) out.bytes(b);
  return out.done();
}

function positiveInteger(v, field) {
  if (!Number.isInteger(v) || v < 1) throw new Error(`${field} must be a positive integer, got ${v}`);
  return v;
}

/**
 * A ZIP bomb (R14): one deflated kernel of `kernel` zero bytes, written once,
 * and `entries` central-directory entries that all point at it, each declaring
 * `kernel` uncompressed bytes.
 */
export function zipBomb({ kernel, entries } = {}) {
  positiveInteger(kernel, "zipBomb: kernel");
  positiveInteger(entries, "zipBomb: entries");
  const list = [{ name: "0.bin", data: new Uint8Array(kernel) }];
  for (let i = 1; i < entries; i++) list.push({ name: `${i}.bin`, sameDataAs: 0 });
  return makeZip(list);
}

/**
 * Nested archives (R14): `depth` levels (1 is a plain archive of leaves), each
 * level holding `fanout` entries, each the next level's archive; the deepest
 * holds `fanout` copies of `leaf`, written with `method` (R10).
 */
export function nestedZip({ depth, fanout, leaf, method = 8 } = {}) {
  positiveInteger(depth, "nestedZip: depth");
  positiveInteger(fanout, "nestedZip: fanout");
  if (leaf === undefined) throw new Error("nestedZip: leaf is missing");
  let level = makeZip(Array.from({ length: fanout }, (_, i) => ({ name: `leaf-${i}.bin`, data: leaf, method })));
  for (let d = 2; d <= depth; d++) {
    const inner = level;
    level = makeZip(Array.from({ length: fanout }, (_, i) => ({ name: `level-${d - 1}-${i}.zip`, data: inner })));
  }
  return level;
}

/* ---- The lazy ZIP64 writer (R23; fix round 9, G123d) ----
 *
 * `zipChunks64` writes an archive as an async stream of chunks, so a member of
 * hundreds of megabytes, or 65,536 members and more, is never held whole: a
 * member given as `chunks` is deflated as it goes, its CRC and sizes written in
 * a data descriptor after it (bit 3), and only the central directory's records
 * are kept until the end. Every entry carries the ZIP64 extra field and the
 * archive ends with the ZIP64 end record and its locator, so no declared size,
 * offset or count is bounded by 32 bits. `makeZip` (R10-R14) stays the
 * whole-archive writer. */

const MAX64 = Number.MAX_SAFE_INTEGER;
const le = (width, v) => {
  const b = new Uint8Array(width);
  for (let i = 0, x = v; i < width; i++, x = Math.floor(x / 256)) b[i] = x % 256;
  return b;
};
const cat = (...list) => concat(list);

/** A running CRC-32 over chunks (the same table as `crc32`). */
function crcUpdate(c, bytes) {
  c = (c ^ MAX32) >>> 0;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ MAX32) >>> 0;
}

async function* asChunks(source) {
  if (typeof source === "function") source = source();
  for await (const c of source) yield typeof c === "string" ? utf8(c) : c;
}

/** Deflates an async source of chunks as it goes (raw deflate, as method 8 stores it). */
async function* deflateStream(source, onRaw) {
  const { createDeflateRaw } = await import("node:zlib");
  const z = createDeflateRaw();
  const out = [];
  let wake = null, ended = false, failed = null;
  z.on("data", (d) => { out.push(new Uint8Array(d)); wake?.(); });
  z.on("end", () => { ended = true; wake?.(); });
  z.on("error", (e) => { failed = e; wake?.(); });
  const feed = (async () => {
    for await (const c of source) {
      onRaw(c);
      if (!z.write(c)) await new Promise((r) => z.once("drain", r));
    }
    z.end();
  })().catch((e) => { failed = e; wake?.(); });
  while (true) {
    while (out.length) yield out.shift();
    if (failed) throw failed;
    if (ended) break;
    await new Promise((r) => { wake = r; });
    wake = null;
  }
  await feed;
}

/**
 * A ZIP written lazily (R23). `entries` is an array or an (async) iterable of
 * `{name, data}` (bytes or a string, compressed whole) or `{name, chunks}` (an
 * iterable, an async iterable or a function answering one, deflated as it
 * goes), with `method` 8 (default) or 0. An entry's `central: {crc32,
 * compressedSize, uncompressedSize}` (any subset) is what its central record
 * states in place of the truth, so a member can declare more than it holds.
 * `options.comment` is the archive comment. Answers an async iterable of
 * Uint8Array chunks.
 */
export async function* zipChunks64(entries, options = {}) {
  if (options === null || typeof options !== "object") throw new Error("zipChunks64: options must be an object");
  const central = [];
  let offset = 0, i = 0;
  for await (const e of entries) {
    const at = `zipChunks64: entries[${i++}]`;
    if (e === null || typeof e !== "object") throw new Error(`${at} must be an object`);
    if (e.name === undefined) throw new Error(`${at}.name is missing`);
    if (e.data === undefined && e.chunks === undefined) throw new Error(`${at}.data or chunks is missing`);
    const name = bytesOf(e.name, `${at}.name`);
    const method = e.method ?? 8;
    if (method !== 0 && method !== 8) throw new Error(`${at}.method must be 0 or 8`);
    const own = checkOverride("central", e.central, `${at}.central`);
    let flags = typeof e.name === "string" && !isAscii(e.name) ? 0x0800 : 0;
    const start = offset;
    let crc, csize, usize;
    if (e.data !== undefined) {
      /* Known bytes: sizes in the ZIP64 extra field of the local header, no descriptor. */
      const raw = bytesOf(e.data, `${at}.data`);
      const payload = method === 8 ? new Uint8Array(deflateRawSync(raw)) : raw;
      crc = crc32(raw); csize = payload.length; usize = raw.length;
      if (e.zip64 === false) {
        /* A classic member (an ODF package's stored `mimetype` must sit at offset 38 with no extra field). */
        if (usize >= MAX32 || offset >= MAX32) throw new Error(`${at} is too large for zip64: false`);
        const head = cat(le(4, SIG.local), le(2, 20), le(2, flags), le(2, method), le(2, DOS_TIME), le(2, DOS_DATE),
          le(4, crc), le(4, csize), le(4, usize), le(2, name.length), le(2, 0), name);
        offset += head.length + payload.length;
        yield head;
        if (payload.length) yield payload;
        const c = { crc32: crc, compressedSize: csize, uncompressedSize: usize, ...own };
        central.push(cat(le(4, SIG.central), le(2, 20), le(2, 20), le(2, flags), le(2, method), le(2, DOS_TIME), le(2, DOS_DATE),
          le(4, c.crc32), le(4, c.compressedSize), le(4, c.uncompressedSize), le(2, name.length), le(2, 0), le(2, 0), le(2, 0), le(2, 0), le(4, 0), le(4, start), name));
        continue;
      }
      const head = cat(le(4, SIG.local), le(2, 45), le(2, flags), le(2, method), le(2, DOS_TIME), le(2, DOS_DATE),
        le(4, crc), le(4, MAX32), le(4, MAX32), le(2, name.length), le(2, 20), name,
        le(2, 0x0001), le(2, 16), le(8, usize), le(8, csize));
      offset += head.length + payload.length;
      yield head;
      if (payload.length) yield payload;
    } else if (method === 0 && e.size !== undefined && e.crc32 !== undefined) {
      /* Streamed, stored, its size and CRC known before: written in the local header's ZIP64 extra field, no descriptor
         (a reader that cannot take a stored member with bit 3, LibreOffice's, still opens it). */
      crc = e.crc32; csize = usize = e.size;
      const head = cat(le(4, SIG.local), le(2, 45), le(2, flags), le(2, 0), le(2, DOS_TIME), le(2, DOS_DATE),
        le(4, crc), le(4, MAX32), le(4, MAX32), le(2, name.length), le(2, 20), name,
        le(2, 0x0001), le(2, 16), le(8, usize), le(8, csize));
      offset += head.length;
      yield head;
      let n = 0, c2 = 0;
      for await (const c of asChunks(e.chunks)) { n += c.length; c2 = crcUpdate(c2, c); offset += c.length; yield c; }
      if (n !== e.size || c2 !== e.crc32) throw new Error(`${at} holds ${n} bytes of CRC ${c2}, not the size and crc32 it gave`);
    } else {
      /* Streamed: bit 3, the truth after the data in a 64-bit descriptor. */
      flags |= 0x0008;
      const head = cat(le(4, SIG.local), le(2, 45), le(2, flags), le(2, method), le(2, DOS_TIME), le(2, DOS_DATE),
        le(4, 0), le(4, MAX32), le(4, MAX32), le(2, name.length), le(2, 20), name,
        le(2, 0x0001), le(2, 16), le(8, 0), le(8, 0));
      offset += head.length;
      yield head;
      crc = 0; csize = 0; usize = 0;
      const onRaw = (c) => { crc = crcUpdate(crc, c); usize += c.length; };
      if (method === 8) {
        for await (const z of deflateStream(asChunks(e.chunks), onRaw)) { csize += z.length; offset += z.length; yield z; }
      } else {
        for await (const c of asChunks(e.chunks)) { onRaw(c); csize += c.length; offset += c.length; yield c; }
      }
      const tail = cat(le(4, SIG.descriptor), le(4, crc), le(8, csize), le(8, usize));
      offset += tail.length;
      yield tail;
    }
    const c = { crc32: crc, compressedSize: csize, uncompressedSize: usize, ...own };
    for (const f of ["crc32", "compressedSize", "uncompressedSize"]) {
      const max = f === "crc32" ? MAX32 : MAX64;
      if (!Number.isInteger(c[f]) || c[f] < 0 || c[f] > max) throw new Error(`${at}.central.${f} must be an integer from 0 to ${max}`);
    }
    central.push(cat(le(4, SIG.central), le(2, 45), le(2, 45), le(2, flags), le(2, method), le(2, DOS_TIME), le(2, DOS_DATE),
      le(4, c.crc32), le(4, MAX32), le(4, MAX32), le(2, name.length), le(2, 28), le(2, 0), le(2, 0), le(2, 0), le(4, 0), le(4, MAX32), name,
      le(2, 0x0001), le(2, 24), le(8, c.uncompressedSize), le(8, c.compressedSize), le(8, start)));
  }
  const cdOffset = offset;
  let cdSize = 0;
  for (const r of central) { cdSize += r.length; yield r; }
  const n = central.length;
  const comment = options.comment === undefined ? new Uint8Array(0) : bytesOf(options.comment, "zipChunks64: options.comment");
  if (comment.length > MAX16) throw new Error(`zipChunks64: options.comment must be at most ${MAX16} bytes`);
  const recordOffset = cdOffset + cdSize;
  const fit16 = (v) => (v > MAX16 - 1 ? MAX16 : v), fit32 = (v) => (v > MAX32 - 1 ? MAX32 : v);
  yield cat(
    le(4, SIG.zip64Eocd), le(8, 44), le(2, 45), le(2, 45), le(4, 0), le(4, 0), le(8, n), le(8, n), le(8, cdSize), le(8, cdOffset),
    le(4, SIG.zip64Locator), le(4, 0), le(8, recordOffset), le(4, 1),
    le(4, SIG.eocd), le(2, 0), le(2, 0), le(2, fit16(n)), le(2, fit16(n)), le(4, fit32(cdSize)), le(4, fit32(cdOffset)), le(2, comment.length), comment);
}

/** A running CRC-32: `crc32Update(crc32Update(0, a), b)` is the CRC of a then b. */
export const crc32Update = (c, bytes) => crcUpdate(c, bytes);

/** The longest archive comment `zipChunks64Sized` writes: LibreOffice finds no end record behind a comment of 600
 *  bytes (measured, LibreOffice 24.2; 400 opened). */
const SIZED_COMMENT_MAX = 256;

/**
 * `zipChunks64` padded to exactly `size` bytes (R19's boundary sizes): the archive comment takes up to 256 bytes of
 * padding and a stored member `bio-pad.bin` of zeros (size and CRC known, no descriptor) the rest. `entries` is an
 * array whose `chunks` are functions, since the archive is counted by a pass that holds nothing before it is written.
 * `member: true` always writes the padding member (named `padName`), for a package that lists its members (an ODF
 * manifest must name it).
 */
export async function* zipChunks64Sized(entries, size, { padName = "bio-pad.bin", member = false } = {}) {
  if (!Array.isArray(entries)) throw new Error("zipChunks64Sized: entries must be an array");
  for (const e of entries) if (e.chunks !== undefined && typeof e.chunks !== "function") throw new Error(`zipChunks64Sized: ${e.name}'s chunks must be a function`);
  let natural = 0;
  for await (const c of zipChunks64(entries)) natural += c.length;
  let left = size - natural;
  if (left < 0) throw new Error(`zipChunks64Sized: the archive is ${natural} bytes, over size ${size}`);
  const list = entries.slice();
  if (left > SIZED_COMMENT_MAX || member) {
    const name = padName, fill = left - ZIP64_OVERHEAD.local - ZIP64_OVERHEAD.central - 2 * name.length;
    const zeros = new Uint8Array(1 << 20);
    let crc = 0;
    for (let i = 0; i < fill; i += zeros.length) crc = crcUpdate(crc, zeros.subarray(0, Math.min(zeros.length, fill - i)));
    list.push({ name, method: 0, size: fill, crc32: crc, chunks: function* () { for (let i = 0; i < fill; i += zeros.length) yield zeros.subarray(0, Math.min(zeros.length, fill - i)); } });
    if (fill < 0) throw new Error(`zipChunks64Sized: size ${size} is ${left} bytes over the archive, too few for the padding member`);
    left = 0;
  }
  yield* zipChunks64(list, { comment: new Uint8Array(left).fill(0x20) });
}

/** The fixed bytes `zipChunks64` adds around an archive's members: per member
 *  its local header (30 + name + 20) and central record (46 + name + 28), plus
 *  a descriptor of 24 for a streamed member, and 98 bytes of end records. */
export const ZIP64_OVERHEAD = { local: 50, central: 74, descriptor: 24, end: 98, classicLocal: 30, classicCentral: 46 };
