/* A ZIP builder for the ooxml suite: local headers, central directory and
 * EOCD written byte by byte, compressed with node:zlib and checksummed with
 * node:zlib's crc32, both independent of the module under test. Every field
 * the module reads can be overridden, so a fixture can make the central
 * directory, a local header or the EOCD say something the bytes do not. */
import { deflateRawSync, crc32 as zcrc32 } from "node:zlib";

/* node:zlib, as this builder uses it. */
/** @type {(data: Uint8Array) => Uint8Array} */
const deflate = (data) => new Uint8Array(deflateRawSync(data));
/** @type {(data: Uint8Array) => number} */
const crcOf = (data) => zcrc32(data) >>> 0;

/** @type {(s: string | Uint8Array) => Uint8Array} */
const enc = (s) => (typeof s === "string" ? new TextEncoder().encode(s) : s);

class Out {
  constructor() {
    /** @type {Uint8Array[]} */
    this.parts = [];
    /** @type {number} */
    this.length = 0;
  }
  /** @param {number} v */
  u16(v) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v, true); this.bytes(b); }
  /** @param {number} v */
  u32(v) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v >>> 0, true); this.bytes(b); }
  /** @param {Uint8Array} b */
  bytes(b) { this.parts.push(b); this.length += b.length; }
  done() {
    const out = new Uint8Array(this.length);
    let at = 0;
    for (const p of this.parts) { out.set(p, at); at += p.length; }
    return out;
  }
}

/** members: [{ name, data, method=8, flags, nameBytes, compressed,
 *   local:{method, crc, csize, usize, sig}, cd:{method, crc, csize, usize, lhOffset, sig} }]
 *  o: { cdOrder:[indices], eocd:{diskEntries, totalEntries, cdSize, cdOffset},
 *       comment, afterCd:Uint8Array, gapBeforeCd:Uint8Array } */
/**
 * What a header may be made to say instead of the bytes.
 * @typedef {Object} HeaderSays
 * @property {number} [method]
 * @property {number} [flags]
 * @property {number} [crc]
 * @property {number} [csize]
 * @property {number} [usize]
 * @property {number} [sig]
 * @property {number} [lhOffset]
 */
/**
 * @typedef {Object} ZipMember
 * @property {string} [name]
 * @property {string | Uint8Array} [data]
 * @property {number} [method]
 * @property {number} [flags]
 * @property {Uint8Array} [nameBytes]
 * @property {Uint8Array} [compressed]
 * @property {HeaderSays} [local]
 * @property {HeaderSays} [cd]
 */
/**
 * @typedef {Object} ZipOptions
 * @property {number[]} [cdOrder]
 * @property {{ diskEntries?: number, totalEntries?: number, cdSize?: number, cdOffset?: number }} [eocd]
 * @property {string | Uint8Array} [comment]
 * @property {number} [commentLen]
 * @property {Uint8Array} [afterCd]
 * @property {Uint8Array} [gapBeforeCd]
 */
/**
 * @param {ZipMember[]} members
 * @param {ZipOptions} [o]
 * @returns {Uint8Array}
 */
export function buildZip(members, o = {}) {
  const out = new Out();
  const recs = members.map((m) => {
    const data = enc(m.data ?? "");
    const method = m.method ?? 8;
    const comp = m.compressed ?? (method === 8 ? deflate(data) : data);
    const nameBytes = m.nameBytes ?? enc(m.name ?? "");
    const r = {
      nameBytes, method, flags: m.flags ?? 0, crc: crcOf(data),
      csize: comp.length, usize: data.length, offset: out.length,
    };
    const l = { ...r, sig: 0x04034b50, ...(m.local ?? {}) };
    out.u32(l.sig); out.u16(20); out.u16(l.flags); out.u16(l.method); out.u16(0); out.u16(0);
    out.u32(l.crc); out.u32(l.csize); out.u32(l.usize);
    out.u16(nameBytes.length); out.u16(0); out.bytes(nameBytes); out.bytes(comp);
    return { ...r, sig: 0x02014b50, lhOffset: r.offset, ...(m.cd ?? {}) };
  });
  const gap = o.gapBeforeCd;
  if (gap) out.bytes(gap);
  const cdOffset = out.length;
  for (const i of o.cdOrder ?? recs.map((_, i) => i)) {
    const c = recs[i];
    if (!c) throw new TypeError(`cdOrder names no member ${i}`);
    out.u32(c.sig); out.u16(20); out.u16(20); out.u16(c.flags); out.u16(c.method); out.u16(0); out.u16(0);
    out.u32(c.crc); out.u32(c.csize); out.u32(c.usize);
    out.u16(c.nameBytes.length); out.u16(0); out.u16(0); out.u16(0); out.u16(0); out.u32(0);
    out.u32(c.lhOffset); out.bytes(c.nameBytes);
  }
  const cdSize = out.length - cdOffset;
  const after = o.afterCd;
  if (after) out.bytes(after);
  const n = (o.cdOrder ?? recs).length;
  const e = { diskEntries: n, totalEntries: n, cdSize, cdOffset, ...(o.eocd ?? {}) };
  const comment = enc(o.comment ?? "");
  out.u32(0x06054b50); out.u16(0); out.u16(0);
  out.u16(e.diskEntries); out.u16(e.totalEntries); out.u32(e.cdSize); out.u32(e.cdOffset);
  out.u16(o.commentLen ?? comment.length); out.bytes(comment);
  return out.done();
}

/** @typedef {"docx" | "xlsx" | "pptx"} OpcFlavour */
/** @typedef {"odt" | "ods" | "odp"} OdfFlavour */
export const TYPES = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
};
export const MAIN = { docx: "word/document.xml", xlsx: "xl/workbook.xml", pptx: "ppt/presentation.xml" };

/** @type {(overrides?: Record<string, string>, defaults?: Record<string, string>) => string} */
export const contentTypes = (overrides = {}, defaults = {}) =>
  `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
  + Object.entries(defaults).map(([e, t]) => `<Default Extension="${e}" ContentType="${t}"/>`).join("")
  + Object.entries(overrides).map(([p, t]) => `<Override PartName="${p}" ContentType="${t}"/>`).join("")
  + `</Types>`;

/** A minimal OPC package of the flavour, plus any extra members. */
/**
 * @param {OpcFlavour} flavour
 * @param {ZipMember[]} [extra]
 * @returns {ZipMember[]}
 */
export function opc(flavour, extra = []) {
  return [
    { name: "[Content_Types].xml", data: contentTypes({ [`/${MAIN[flavour]}`]: TYPES[flavour] }, { rels: "application/vnd.openxmlformats-package.relationships+xml", xml: "application/xml" }) },
    { name: "_rels/.rels", data: `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="${MAIN[flavour]}"/></Relationships>` },
    { name: MAIN[flavour], data: `<main flavour="${flavour}"/>` },
    ...extra,
  ];
}

/** A conforming ODF package: mimetype first and stored, then the manifest and content.xml. */
/**
 * @param {OdfFlavour} flavour
 * @param {{ mimetype?: string, manifest?: boolean, content?: boolean, extra?: ZipMember[] }} [o]
 * @returns {ZipMember[]}
 */
export function odf(flavour, { mimetype = TYPES[flavour], manifest = true, content = true, extra = [] } = {}) {
  /** @type {ZipMember[]} */
  const members = [{ name: "mimetype", data: mimetype, method: 0 }];
  if (manifest) members.push({ name: "META-INF/manifest.xml", data: `<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"/>` });
  if (content) members.push({ name: "content.xml", data: `<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"/>` });
  members.push(...extra);
  return members;
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
