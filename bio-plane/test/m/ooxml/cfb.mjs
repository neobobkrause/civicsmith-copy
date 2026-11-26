/* A VBA project writer for the ooxml suite: an MS-CFB compound file (version
 * 3, 512-byte sectors, small streams in the mini stream), a `dir` stream of
 * MS-OVBA §2.3.4.2 records, and each module's source compressed by MS-OVBA
 * §2.4.1.3's algorithm. Written from the two specifications, independent of
 * the module under test; olevba reads what it writes (the suite checks that
 * where oletools is installed). Deterministic: no clock, no randomness. */

/**
 * A module of a project, as the writer takes it.
 * @typedef {Object} VbaModuleSpec
 * @property {string} name
 * @property {string | Uint8Array} [source]
 * @property {string | null} [stream] null writes no stream and no stream records
 * @property {Uint8Array} [cache] the performance cache before the compressed source
 * @property {boolean} [document]
 * @property {boolean} [unicodeName] false writes no MODULENAMEUNICODE record
 * @property {number | null} [offset] null writes no MODULEOFFSET record
 */
/** @typedef {{ [name: string]: Uint8Array | CfbTree | undefined }} CfbTree a Uint8Array is a stream, an object a storage */
/** @typedef {{ bytes: Uint8Array, fatOffset: number, dirSector: number, entries: string[] }} CfbFile */

const ENDOFCHAIN = 0xfffffffe, FREESECT = 0xffffffff, FATSECT = 0xfffffffd, NOSTREAM = 0xffffffff;

/** A directory entry as makeCfb lays it out: type 5 the root, 1 a storage,
 *  2 a stream (`data` and `start` are read for streams only).
 * @typedef {{ name: string, type: number, data: Uint8Array, children: number[], start: number }} CfbEntry */

class Out {
  constructor() {
    /** @type {Uint8Array[]} */
    this.parts = [];
    /** @type {number} */
    this.length = 0;
  }
  /** @param {Uint8Array} b @returns {Out} */
  bytes(b) { this.parts.push(b); this.length += b.length; return this; }
  /** @param {number} v @returns {Out} */
  u8(v) { return this.bytes(Uint8Array.of(v)); }
  /** @param {number} v @returns {Out} */
  u16(v) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v, true); return this.bytes(b); }
  /** @param {number} v @returns {Out} */
  u32(v) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v >>> 0, true); return this.bytes(b); }
  /** @returns {Uint8Array} */
  done() {
    const out = new Uint8Array(this.length);
    let at = 0;
    for (const p of this.parts) { out.set(p, at); at += p.length; }
    return out;
  }
}
/** @param {string} s @returns {Uint8Array} */
const utf16 = (s) => { const b = new Uint8Array(s.length * 2); for (let i = 0; i < s.length; i++) { b[2 * i] = s.charCodeAt(i) & 255; b[2 * i + 1] = s.charCodeAt(i) >> 8; } return b; };
/** @param {string} s @returns {Uint8Array} */
const latin1 = (s) => Uint8Array.from(s, (/** @type {string} */ c) => c.charCodeAt(0));
/** @param {Uint8Array} b @param {number} unit @returns {Uint8Array} */
const pad = (b, unit) => { const out = new Uint8Array(Math.ceil(b.length / unit) * unit); out.set(b); return out; };

/** MS-OVBA §2.4.1.3.6: a CompressedContainer over `data`. Each 4,096-byte
 *  chunk is compressed with the longest match the copy token's split allows;
 *  a full chunk that would not shrink is written raw (flag 0), as Office does.
 *  `literalOnly` writes no copy token at all. */
/**
 * @param {Uint8Array} data
 * @param {{ literalOnly?: boolean }} [o]
 * @returns {Uint8Array}
 */
export function ovbaCompress(data, { literalOnly = false } = {}) {
  const out = new Out().u8(0x01);
  for (let start = 0; start < data.length; start += 4096) {
    const end = Math.min(start + 4096, data.length);
    const body = new Out();
    let p = start;
    while (p < end) {
      const tokens = new Out();
      let flags = 0;
      for (let bit = 0; bit < 8 && p < end; bit++) {
        const difference = p - start;
        let bitCount = 4;
        while ((1 << bitCount) < difference) bitCount++;
        const maxLength = (0xffff >>> bitCount) + 3;
        let best = 0, bestOffset = 0;
        if (!literalOnly) {
          for (let c = p - 1; c >= start; c--) {
            let len = 0;
            while (len < maxLength && p + len < end && data[c + len] === data[p + len]) len++;
            if (len > best) { best = len; bestOffset = p - c; }
          }
        }
        if (best >= 3) {
          tokens.u16(((bestOffset - 1) << (16 - bitCount)) | (best - 3));
          flags |= 1 << bit;
          p += best;
        } else {
          tokens.u8(data[p++] ?? 0);
        }
      }
      body.u8(flags).bytes(tokens.done());
    }
    const compressed = body.done();
    if (end - start === 4096 && compressed.length + 2 > 4098) {
      out.u16(0x3fff).bytes(data.subarray(start, end));
    } else {
      out.u16(0xb000 | (compressed.length + 2 - 3)).bytes(compressed);
    }
  }
  return out.done();
}

/** An MS-CFB file holding `tree` (an object: a Uint8Array is a stream, an
 *  object a storage). Answers the bytes and where the FAT and directory lie,
 *  so a test can break a chain. */
/**
 * @param {CfbTree} tree
 * @returns {CfbFile}
 */
export function makeCfb(tree) {
  /** @type {CfbEntry} */
  const root = { name: "Root Entry", type: 5, data: new Uint8Array(0), children: [], start: 0 };
  /** @type {CfbEntry[]} */
  const entries = [root];
  /** @param {CfbTree} obj @param {CfbEntry} parent */
  const add = (obj, parent) => {
    for (const [name, v] of Object.entries(obj)) {
      if (v instanceof Uint8Array) {
        entries.push({ name, type: 2, data: v, children: [], start: 0 });
        parent.children.push(entries.length - 1);
      } else {
        /** @type {CfbEntry} */
        const e = { name, type: 1, data: new Uint8Array(0), children: [], start: 0 };
        entries.push(e);
        parent.children.push(entries.length - 1);
        if (v === undefined) throw new TypeError(`makeCfb: ${name} is neither a stream nor a storage`);
        add(v, e);
      }
    }
  };
  add(tree, root);
  const streams = entries.filter((e) => e.type === 2);

  // The mini stream: every stream under 4,096 bytes, in 64-byte mini sectors.
  /** @type {number[]} */
  const miniFat = [];
  /** @type {Uint8Array[]} */
  const miniParts = [];
  for (const e of streams.filter((s) => s.data.length > 0 && s.data.length < 4096)) {
    const n = Math.ceil(e.data.length / 64);
    e.start = miniFat.length;
    for (let k = 0; k < n; k++) miniFat.push(k < n - 1 ? e.start + k + 1 : ENDOFCHAIN);
    miniParts.push(pad(e.data, 64));
  }
  const miniStream = new Out(); miniParts.forEach((p) => miniStream.bytes(p));
  const miniBytes = miniStream.done();
  for (const e of streams) if (e.data.length === 0) e.start = ENDOFCHAIN;

  // The regular sectors: FAT, directory, mini FAT, mini stream, big streams.
  const dirSecs = Math.ceil((entries.length * 128) / 512);
  const miniFatSecs = Math.ceil((miniFat.length * 4) / 512);
  const miniSecs = Math.ceil(miniBytes.length / 512);
  const big = streams.filter((s) => s.data.length >= 4096);
  const bigSecs = big.map((s) => Math.ceil(s.data.length / 512));
  const dataSecs = dirSecs + miniFatSecs + miniSecs + bigSecs.reduce((a, b) => a + b, 0);
  let fatSecs = 1;
  while (fatSecs * 128 < dataSecs + fatSecs) fatSecs++;
  if (fatSecs > 109) throw new Error("makeCfb: too large for a header-only DIFAT");
  const fat = new Uint32Array(fatSecs * 128).fill(FREESECT);
  for (let i = 0; i < fatSecs; i++) fat[i] = FATSECT;
  let next = fatSecs;
  /** @param {number} n @returns {number} */
  const run = (n) => { const start = n ? next : ENDOFCHAIN; for (let k = 0; k < n; k++) fat[next + k] = k < n - 1 ? next + k + 1 : ENDOFCHAIN; next += n; return start; };
  const dirStart = run(dirSecs);
  const miniFatStart = run(miniFatSecs);
  const miniStart = run(miniSecs);
  big.forEach((s, i) => { s.start = run(bigSecs[i] ?? 0); });

  // The directory: each storage's children chained by right siblings.
  const dir = new Out();
  entries.forEach((e, i) => {
    const name = new Uint8Array(64);
    name.set(utf16(e.name).subarray(0, 62));
    dir.bytes(name).u16((Math.min(e.name.length, 31) + 1) * 2).u8(e.type).u8(1);
    const parent = entries.find((p) => p.children.includes(i));
    /** @type {number[]} */
    const siblings = parent === undefined ? [] : parent.children;
    const right = siblings[siblings.indexOf(i) + 1] ?? NOSTREAM;
    dir.u32(NOSTREAM).u32(right).u32(e.children[0] ?? NOSTREAM);
    dir.bytes(new Uint8Array(16)).u32(0).bytes(new Uint8Array(16));
    if (e.type === 5) dir.u32(miniBytes.length ? miniStart : ENDOFCHAIN).u32(miniBytes.length).u32(0);
    else if (e.type === 2) dir.u32(e.start).u32(e.data.length).u32(0);
    else dir.u32(0).u32(0).u32(0);
  });
  for (let k = entries.length; k < dirSecs * 4; k++) {
    dir.bytes(new Uint8Array(64)).u16(0).u8(0).u8(0).u32(NOSTREAM).u32(NOSTREAM).u32(NOSTREAM).bytes(new Uint8Array(48));
  }

  const header = new Out();
  header.bytes(Uint8Array.of(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)).bytes(new Uint8Array(16));
  header.u16(0x3e).u16(3).u16(0xfffe).u16(9).u16(6).bytes(new Uint8Array(6));
  header.u32(0).u32(fatSecs).u32(dirStart).u32(0).u32(4096);
  header.u32(miniFat.length ? miniFatStart : ENDOFCHAIN).u32(miniFatSecs).u32(ENDOFCHAIN).u32(0);
  for (let i = 0; i < 109; i++) header.u32(i < fatSecs ? i : FREESECT);

  const fatBytes = new Out(); for (const v of fat) fatBytes.u32(v);
  const miniFatBytes = new Out(); for (const v of miniFat) miniFatBytes.u32(v);
  const file = new Out().bytes(header.done()).bytes(fatBytes.done()).bytes(pad(dir.done(), 512));
  file.bytes(pad(miniFatBytes.done(), 512)).bytes(pad(miniBytes, 512));
  for (const s of big) file.bytes(pad(s.data, 512));
  return { bytes: file.done(), fatOffset: 512, dirSector: dirStart, entries: entries.map((e) => e.name) };
}

/** @param {Out} out @param {number} id @param {Uint8Array} data @returns {Out} */
const rec = (out, id, data) => out.u16(id).u32(data.length).bytes(data);
/** @param {number} v @returns {Uint8Array} */
const u16le = (v) => Uint8Array.of(v & 255, v >> 8);
/** @param {number} v @returns {Uint8Array} */
const u32le = (v) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v, true); return b; };

/** The decompressed `dir` stream (MS-OVBA §2.3.4.2) for a project and its
 *  modules, every record a real project carries, a reference included. */
/**
 * @param {{ project?: string | undefined, codePage?: number | undefined, modules?: VbaModuleSpec[] }} o
 * @returns {Uint8Array}
 */
export function vbaDir({ project = "VBAProject", codePage = 1252, modules = [] }) {
  const d = new Out();
  rec(d, 0x0001, u32le(1)); // SYSKIND: Win32
  rec(d, 0x004a, u32le(3)); // COMPATVERSION
  rec(d, 0x0002, u32le(0x409)); // LCID
  rec(d, 0x0014, u32le(0x409)); // LCIDINVOKE
  rec(d, 0x0003, u16le(codePage)); // CODEPAGE
  rec(d, 0x0004, latin1(project)); // NAME
  rec(d, 0x0005, new Uint8Array(0)); rec(d, 0x0040, new Uint8Array(0)); // DOCSTRING
  rec(d, 0x0006, new Uint8Array(0)); rec(d, 0x003d, new Uint8Array(0)); // HELPFILEPATH
  rec(d, 0x0007, u32le(0)); // HELPCONTEXT
  rec(d, 0x0008, u32le(0)); // LIBFLAGS
  d.u16(0x0009).u32(4).u32(0x5a5a5a5a).u16(17); // VERSION: size 4, then 6 bytes
  rec(d, 0x000c, new Uint8Array(0)); rec(d, 0x003c, new Uint8Array(0)); // CONSTANTS
  const libid = latin1("*\\G{000204EF-0000-0000-C000-000000000046}#4.2#9#C:\\VBE7.DLL#Visual Basic For Applications");
  rec(d, 0x0016, latin1("VBA")); rec(d, 0x003e, utf16("VBA")); // REFERENCENAME
  d.u16(0x000d).u32(4 + libid.length + 6).u32(libid.length).bytes(libid).u32(0).u16(0); // REFERENCEREGISTERED
  rec(d, 0x000f, u16le(modules.length)); // PROJECTMODULES
  rec(d, 0x0013, u16le(0xffff)); // PROJECTCOOKIE
  for (const m of modules) {
    rec(d, 0x0019, latin1(m.name));
    if (m.unicodeName !== false) rec(d, 0x0047, utf16(m.name));
    const stream = m.stream;
    if (stream !== null) { rec(d, 0x001a, latin1(stream ?? m.name)); rec(d, 0x0032, utf16(stream ?? m.name)); }
    rec(d, 0x001c, new Uint8Array(0)); rec(d, 0x0048, new Uint8Array(0)); // DOCSTRING
    const offset = m.offset;
    if (offset !== null) rec(d, 0x0031, u32le(offset ?? m.cache?.length ?? 0)); // OFFSET
    rec(d, 0x001e, u32le(0)); // HELPCONTEXT
    rec(d, 0x002c, u16le(0xffff)); // COOKIE
    rec(d, m.document ? 0x0022 : 0x0021, new Uint8Array(0)); // TYPE
    rec(d, 0x002b, new Uint8Array(0)); // terminator
  }
  d.u16(0x0010).u32(0); // the dir stream's terminator
  return d.done();
}

/** A whole `vbaProject.bin`: `modules` is `[{name, source, stream?, cache?,
 *  document?}]`; `cache` is the performance cache before the compressed
 *  source (its length is the module's offset). `dir` replaces the compressed
 *  dir stream; `streams` replaces or adds VBA-storage streams by name. */
/**
 * @param {{ project?: string, codePage?: number, modules?: VbaModuleSpec[], dir?: Uint8Array, streams?: Record<string, Uint8Array | undefined>, extra?: CfbTree }} [o]
 * @returns {CfbFile}
 */
export function makeVbaProject({ project, codePage, modules = [], dir, streams = {}, extra = {} } = {}) {
  // The VBA storage's streams in the order an object would hold them; one
  // set to undefined in `streams` is left out.
  /** @type {Map<string, Uint8Array | undefined>} */
  const named = new Map(null);
  named.set("_VBA_PROJECT", Uint8Array.of(0xcc, 0x61, 0xff, 0xff, 0x00, 0x00, 0x00));
  named.set("dir", dir ?? ovbaCompress(vbaDir({ project, codePage, modules })));
  for (const m of modules) {
    const stream = m.stream;
    if (stream === null) continue;
    const cache = m.cache ?? new Uint8Array(0);
    const source = m.source;
    const src = typeof source === "string" ? latin1(source) : source;
    if (src === undefined) throw new TypeError(`makeVbaProject: module ${m.name} has no source`);
    named.set(stream ?? m.name, new Out().bytes(cache).bytes(ovbaCompress(src)).done());
  }
  for (const [k, v] of Object.entries(streams)) named.set(k, v);
  /** @type {CfbTree} */
  const vba = Object.fromEntries([...named].filter(([, v]) => v !== undefined));
  return makeCfb({ PROJECT: latin1(`ID="{00000000-0000-0000-0000-000000000000}"\r\n`), VBA: vba, ...extra });
}
