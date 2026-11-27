/* format-registry: a small ZIP writer for this suite's fixtures (the zip entry, R23, R28). Plain, ZIP64 and
 * deliberately malformed archives, and office-shaped and OpenDocument-shaped ones, built in memory. */
import { deflateRawSync } from "node:zlib";

/**
 * One member of an archive `makeZip` writes, in order: its name, its data (a string is written as UTF-8), its method
 * (8 deflate, the default, or 0 stored) and whether its name is flagged UTF-8.
 * @typedef {{ name: string, data?: string | Uint8Array, method?: number, utf8?: boolean }} ZipMember
 */
/**
 * What `makeZip` may do beyond the plain archive (see makeZip).
 * @typedef {{ zip64?: boolean, comment?: string, truncateDirectory?: boolean }} ZipOptions
 */
/**
 * How `odfZip` may bend its `mimetype` member: written last, under another name, or with another method.
 * @typedef {{ mimetypeLast?: boolean, mimetypeName?: string, mimetypeMethod?: number }} OdfExtra
 */

/** @param {string | Uint8Array} s @returns {Uint8Array} */
const enc = (s) => (typeof s === "string" ? new TextEncoder().encode(s) : s);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
/** @param {Uint8Array} b @returns {number} */
function crc32(b) {
  let c = 0xffffffff;
  for (const x of b) c = (CRC_TABLE[(c ^ x) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

class Out {
  /** @type {Uint8Array[]} */
  parts = [];
  length = 0;
  /** @param {Uint8Array} b @returns {void} */
  bytes(b) { this.parts.push(b); this.length += b.length; }
  /** @param {number} v @returns {void} */
  u16(v) { this.bytes(Uint8Array.of(v & 0xff, (v >>> 8) & 0xff)); }
  /** @param {number} v @returns {void} */
  u32(v) { this.bytes(Uint8Array.of(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff)); }
  /** @param {number} v @returns {void} */
  u64(v) { this.u32(v % 2 ** 32); this.u32(Math.floor(v / 2 ** 32)); }
  /** @returns {Uint8Array} */
  done() {
    const r = new Uint8Array(this.length);
    let at = 0;
    for (const p of this.parts) { r.set(p, at); at += p.length; }
    return r;
  }
}

/** Builds a ZIP from `[{name, data, method = 8, utf8 = false}]` in order.
 *  opts: `zip64` (the EOCD carries sentinels and a ZIP64 end record and locator carry the values),
 *  `comment` (the EOCD comment), `truncateDirectory` (the EOCD declares one more entry than is written).
 * @param {ZipMember[]} entries
 * @param {ZipOptions} [opts]
 * @returns {Uint8Array} */
export function makeZip(entries, opts = {}) {
  const out = new Out();
  /** @type {Array<{ name: Uint8Array, flags: number, method: number, crc: number, csize: number, usize: number, offset: number }>} */
  const central = [];
  for (const e of entries) {
    const name = enc(e.name);
    const data = enc(e.data ?? "");
    const method = e.method ?? 8;
    const stored = method === 8 ? new Uint8Array(deflateRawSync(data)) : data;
    const flags = e.utf8 ? 0x0800 : 0;
    const crc = crc32(data);
    const offset = out.length;
    out.u32(0x04034b50); out.u16(20); out.u16(flags); out.u16(method); out.u16(0); out.u16(0x21);
    out.u32(crc); out.u32(stored.length); out.u32(data.length); out.u16(name.length); out.u16(0);
    out.bytes(name); out.bytes(stored);
    central.push({ name, flags, method, crc, csize: stored.length, usize: data.length, offset });
  }
  const cdOffset = out.length;
  for (const c of central) {
    out.u32(0x02014b50); out.u16(20); out.u16(20); out.u16(c.flags); out.u16(c.method); out.u16(0); out.u16(0x21);
    out.u32(c.crc); out.u32(c.csize); out.u32(c.usize); out.u16(c.name.length); out.u16(0); out.u16(0);
    out.u16(0); out.u16(0); out.u32(0); out.u32(c.offset); out.bytes(c.name);
  }
  const cdSize = out.length - cdOffset;
  const count = central.length + (opts.truncateDirectory ? 1 : 0);
  if (opts.zip64) {
    const recordAt = out.length;
    out.u32(0x06064b50); out.u64(44); out.u16(45); out.u16(45); out.u32(0); out.u32(0);
    out.u64(count); out.u64(count); out.u64(cdSize); out.u64(cdOffset);
    out.u32(0x07064b50); out.u32(0); out.u64(recordAt); out.u32(1);
  }
  const comment = enc(opts.comment ?? "");
  out.u32(0x06054b50); out.u16(0); out.u16(0);
  out.u16(opts.zip64 ? 0xffff : count); out.u16(opts.zip64 ? 0xffff : count);
  out.u32(opts.zip64 ? 0xffffffff : cdSize); out.u32(opts.zip64 ? 0xffffffff : cdOffset);
  out.u16(comment.length); out.bytes(comment);
  return out.done();
}

/** @param {string} main @param {string} part @returns {string} */
const types = (main, part) => `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
  + `<Default Extension="xml" ContentType="application/xml"/><Override PartName="/${part}" ContentType="${main}"/></Types>`;
const ODF_MANIFEST = `<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"/>`;

/** An office-shaped container: an OPC content-type map declaring `main` for `part`, and the part itself.
 * @param {string} main
 * @param {string} part
 * @returns {Uint8Array} */
export const officeZip = (main, part) => makeZip([
  { name: "[Content_Types].xml", data: types(main, part) },
  { name: "_rels/.rels", data: "<Relationships/>" },
  { name: part, data: "<x/>" },
]);

/** An OpenDocument-shaped container: `mimetype` first and stored, the manifest and content.xml.
 * @param {string} mimetype
 * @param {OdfExtra} [extra]
 * @returns {Uint8Array} */
export const odfZip = (mimetype, extra = {}) => {
  /** @type {ZipMember[]} */
  const first = extra.mimetypeLast ? [] : [{ name: extra.mimetypeName ?? "mimetype", data: mimetype, method: extra.mimetypeMethod ?? 0 }];
  /** @type {ZipMember[]} */
  const last = extra.mimetypeLast ? [{ name: "mimetype", data: mimetype, method: 0 }] : [];
  return makeZip([
    ...first,
    { name: "META-INF/manifest.xml", data: ODF_MANIFEST },
    { name: "content.xml", data: "<office:document-content/>" },
    ...last,
  ]);
};
