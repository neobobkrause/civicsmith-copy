/* Fixtures for the odf-reader suite: a ZIP writer (local headers, central
 * directory and EOCD written byte by byte, compressed and checksummed with
 * node:zlib, independent of the module under test) and OpenDocument package
 * builders. Every central-directory field the module reads can be
 * overridden, so a fixture can make the directory say what the bytes do not. */
import { deflateRawSync, crc32 as zcrc32 } from "node:zlib";
import { createHash } from "node:crypto";

/** @param {string | Uint8Array} s @returns {Uint8Array} */
export const enc = (s) => (typeof s === "string" ? new TextEncoder().encode(s) : s);
/** @param {string | Uint8Array} b @returns {string} */
export const sha256 = (b) => createHash("sha256").update(b).digest("hex");
/** @param {Uint8Array} b @returns {Promise<string>} */
export const sha256Hex = async (b) => sha256(b);

/** @typedef {"odt" | "ods" | "odp"} Flavour */
/** @type {{ odt: string, ods: string, odp: string }} */
export const TYPES = {
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
};
/** @type {{ odt: string, ods: string, odp: string }} */
export const BODY = { odt: "text", ods: "spreadsheet", odp: "presentation" };

/**
 * @typedef {Object} Member one member of a ZIP fixture
 * @property {string} name
 * @property {string | Uint8Array} [data]
 * @property {number} [method] 8 (deflated, the default) or 0 (stored)
 * @property {{ crc?: number, usize?: number, csize?: number, lhOffset?: number }} [cd] central-directory fields to write instead
 */
/** members: [{ name, data, method=8, cd:{crc, usize, csize, lhOffset} }];
 *  o: { cdOrder: [indices] }
 * @param {Member[]} members
 * @param {{ cdOrder?: number[] }} [o]
 * @returns {Uint8Array}
 */
export function buildZip(members, o = {}) {
  /** @type {Uint8Array[]} */
  const chunks = [];
  let length = 0;
  /** @param {Uint8Array} b */
  const put = (b) => { chunks.push(b); length += b.length; };
  /** @param {number} v */
  const u16 = (v) => { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v, true); put(b); };
  /** @param {number} v */
  const u32 = (v) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v >>> 0, true); put(b); };
  const recs = members.map((m) => {
    const data = enc(m.data ?? "");
    const method = m.method ?? 8;
    const comp = method === 8 ? new Uint8Array(deflateRawSync(data)) : data;
    const name = enc(m.name);
    const r = { name, method, crc: zcrc32(data) >>> 0, csize: comp.length, usize: data.length, lhOffset: length };
    u32(0x04034b50); u16(20); u16(0); u16(method); u16(0); u16(0);
    u32(r.crc); u32(r.csize); u32(r.usize); u16(name.length); u16(0); put(name); put(comp);
    return { ...r, ...(m.cd ?? {}) };
  });
  const cdOffset = length;
  const order = o.cdOrder ?? recs.map((_, i) => i);
  for (const i of order) {
    const c = recs[i];
    if (c === undefined) throw new RangeError(`cdOrder names no member ${i}`);
    u32(0x02014b50); u16(20); u16(20); u16(0); u16(c.method); u16(0); u16(0);
    u32(c.crc); u32(c.csize); u32(c.usize);
    u16(c.name.length); u16(0); u16(0); u16(0); u16(0); u32(0); u32(c.lhOffset); put(c.name);
  }
  const cdSize = length - cdOffset;
  u32(0x06054b50); u16(0); u16(0); u16(order.length); u16(order.length); u32(cdSize); u32(cdOffset); u16(0);
  const out = new Uint8Array(length);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

const NS = [
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"',
  'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"',
  'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"',
  'xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"',
  'xmlns:presentation="urn:oasis:names:tc:opendocument:xmlns:presentation:1.0"',
  'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"',
  'xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0"',
  'xmlns:xlink="http://www.w3.org/1999/xlink"',
  'xmlns:dc="http://purl.org/dc/elements/1.1/"',
  'xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"',
].join(" ");

/** content.xml for a flavour: `body` is the markup inside `<office:text>` /
 *  `<office:spreadsheet>` / `<office:presentation>`; `styles` the automatic
 *  styles; `fonts` the font-face declarations. */
/**
 * @param {Flavour} flavour
 * @param {string} [body]
 * @param {{ styles?: string, fonts?: string }} [o]
 * @returns {string}
 */
export function contentXml(flavour, body = "", { styles = "", fonts = "" } = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?><office:document-content ${NS} office:version="1.3">`
    + `<office:font-face-decls>${fonts}</office:font-face-decls>`
    + `<office:automatic-styles>${styles}</office:automatic-styles>`
    + `<office:body><office:${BODY[flavour]}>${body}</office:${BODY[flavour]}></office:body></office:document-content>`;
}

/** META-INF/manifest.xml listing each entry: a path string, or
 *  `{ path, type, encrypted }`. */
/**
 * @param {(string | { path: string, type?: string, encrypted?: boolean })[]} [entries]
 * @param {Flavour} [flavour]
 * @returns {string}
 */
export function manifestXml(entries = [], flavour = "odt") {
  return `<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">`
    + `<manifest:file-entry manifest:full-path="/" manifest:media-type="${TYPES[flavour]}"/>`
    + entries.map((e) => {
      const { path, type = "application/octet-stream", encrypted = false } = typeof e === "string" ? { path: e } : e;
      return encrypted
        ? `<manifest:file-entry manifest:full-path="${path}" manifest:media-type="${type}"><manifest:encryption-data manifest:checksum-type="SHA1/1K" manifest:checksum="x"/></manifest:file-entry>`
        : `<manifest:file-entry manifest:full-path="${path}" manifest:media-type="${type}"/>`;
    }).join("")
    + `</manifest:manifest>`;
}

/** meta.xml carrying the given `<office:meta>` children, e.g.
 *  `{ "meta:initial-creator": "A" }`. */
/**
 * @param {{ [element: string]: string }} [fields]
 * @returns {string}
 */
export function metaXml(fields = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?><office:document-meta ${NS} office:version="1.3"><office:meta>`
    + Object.entries(fields).map(([k, v]) => `<${k}>${v}</${k}>`).join("")
    + `</office:meta></office:document-meta>`;
}

/** The members of a conforming package: mimetype first and stored, the
 *  manifest, content.xml, then meta.xml when given, then `extra`. */
/**
 * @typedef {Object} PackageOptions
 * @property {string} [body]
 * @property {string} [styles]
 * @property {string} [fonts]
 * @property {string | Uint8Array | false} [content] content.xml whole, or false for none
 * @property {string | Uint8Array | null} [meta]
 * @property {string | Uint8Array | false} [manifest] the manifest whole, or false for none
 * @property {(string | { path: string, type?: string, encrypted?: boolean })[]} [manifestEntries]
 * @property {Member[]} [extra]
 * @property {string} [mimetype]
 */
/**
 * @param {Flavour} flavour
 * @param {PackageOptions} [o]
 * @returns {Member[]}
 */
export function members(flavour, { body = "", styles = "", fonts = "", content, meta = null,
  manifest, manifestEntries = [], extra = [], mimetype = TYPES[flavour] } = {}) {
  return [
    { name: "mimetype", data: mimetype, method: 0 },
    ...(manifest === false ? [] : [{ name: "META-INF/manifest.xml", data: manifest ?? manifestXml(manifestEntries, flavour) }]),
    ...(content === false ? [] : [{ name: "content.xml", data: content ?? contentXml(flavour, body, { styles, fonts }) }]),
    ...(meta == null ? [] : [{ name: "meta.xml", data: meta }]),
    ...extra,
  ];
}

/**
 * @param {Flavour} flavour
 * @param {PackageOptions} [o]
 * @param {{ cdOrder?: number[] }} [zo]
 */
export const pkg = (flavour, o = {}, zo = {}) => buildZip(members(flavour, o), zo);

/** Replace the named member's central-directory fields. */
/**
 * @param {Member[]} list
 * @param {string} name
 * @param {{ crc?: number, usize?: number, csize?: number, lhOffset?: number }} cd
 * @returns {Member[]}
 */
export function withCd(list, name, cd) {
  return list.map((m) => (m.name === name ? { ...m, cd: { ...(m.cd ?? {}), ...cd } } : m));
}

/** A deterministic PRNG (mulberry32), so the adversarial cases are reproducible. */
/**
 * @param {number} seed
 * @returns {() => number}
 */
export function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The COFF-6 bound plus one: a central-directory size that trips the guard
 *  without writing 20 MiB. */
export const OVER_BOUND = 20 * 1024 * 1024 + 1;
