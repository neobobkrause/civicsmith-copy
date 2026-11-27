/* Fixtures for the office-readers suite: a ZIP writer built on node:zlib
 * (deflate and CRC-32 independent of the module under test), and builders
 * for minimal DOCX, PPTX and XLSX packages. Every central-directory field a
 * reader trusts can be overridden per member (`cd: {usize, crc}`), so a
 * fixture can declare sizes it does not carry, or carry a corrupt member. */
import { deflateRawSync, crc32 as zcrc32 } from "node:zlib";
import { CONTENT_TYPES_PART, CORE_PROPERTIES_PART } from "../../../src/ooxml.mjs";

/** @typedef {string | Uint8Array} ZipData a member's content: text is written as UTF-8 */
/**
 * Central-directory fields a member declares instead of its own (its CRC-32, its uncompressed size).
 * @typedef {Object} ZipDeclared
 * @property {number} [usize]
 * @property {number} [crc]
 */
/**
 * The uncompressed size a member's local header declares instead of its own.
 * @typedef {Object} ZipLocalDeclared
 * @property {number} [usize]
 */
/**
 * One member of a ZIP `zip` writes: `data` absent is empty; `method` 8 (deflate, the default) or another, stored.
 * @typedef {Object} ZipMember
 * @property {string} name
 * @property {ZipData | null | undefined} [data]
 * @property {number} [method]
 * @property {ZipDeclared | undefined} [cd]
 * @property {ZipLocalDeclared | undefined} [ld]
 */

/** @param {ZipData} s @returns {Uint8Array} */
export const enc = (s) => (typeof s === "string" ? new TextEncoder().encode(s) : s);

/** @param {number} v @returns {Uint8Array} */
function u16(v) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v, true); return b; }
/** @param {number} v @returns {Uint8Array} */
function u32(v) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v >>> 0, true); return b; }
/** @param {Uint8Array[]} parts @returns {Uint8Array} */
function cat(parts) {
  const n = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(n);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

/** members: [{ name, data, method = 8, cd: {usize, crc}, ld: {usize} }] -> ZIP bytes (`ld` states the declared size in
 *  the local header too, so a member can claim a size both headers agree on).
 *  @param {ZipMember[]} members
 *  @returns {Uint8Array} */
export function zip(members) {
  /** @type {Uint8Array[]} */
  const out = [];
  let offset = 0;
  /** @type {Uint8Array[]} */
  const central = [];
  for (const m of members) {
    const data = enc(m.data ?? "");
    const method = m.method ?? 8;
    const comp = method === 8 ? new Uint8Array(deflateRawSync(data)) : data;
    const name = enc(m.name);
    const crc = zcrc32(data) >>> 0;
    const local = cat([u32(0x04034b50), u16(20), u16(0x0800), u16(method), u16(0), u16(0),
      u32(crc), u32(comp.length), u32(m.ld?.usize ?? data.length), u16(name.length), u16(0), name, comp]);
    out.push(local);
    const cd = { crc, usize: data.length, ...(m.cd ?? {}) };
    central.push(cat([u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(method), u16(0), u16(0),
      u32(cd.crc), u32(comp.length), u32(cd.usize), u16(name.length), u16(0), u16(0), u16(0), u16(0),
      u32(0), u32(offset), name]));
    offset += local.length;
  }
  const cd = cat(central);
  const eocd = cat([u32(0x06054b50), u16(0), u16(0), u16(members.length), u16(members.length),
    u32(cd.length), u32(offset), u16(0)]);
  return cat([...out, cd, eocd]);
}

const REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
/**
 * The relationship types the fixtures write.
 * @typedef {Object} RelTypes
 * @property {string} office
 * @property {string} hyperlink
 * @property {string} sheet
 * @property {string} table
 * @property {string} slide
 * @property {string} notes
 * @property {string} image
 * @property {string} oleObject
 * @property {string} drawing
 * @property {string} package
 */
/** @type {RelTypes} */
export const RT = {
  office: `${R}/officeDocument`, hyperlink: `${R}/hyperlink`, sheet: `${R}/worksheet`,
  table: `${R}/table`, slide: `${R}/slide`, notes: `${R}/notesSlide`, image: `${R}/image`,
  oleObject: `${R}/oleObject`, drawing: `${R}/drawing`, package: `${R}/package`,
};

/**
 * One relationship of a .rels part: `type` absent is a hyperlink; `external` writes TargetMode="External".
 * @typedef {Object} RelEntry
 * @property {string} id
 * @property {string | undefined} [type]
 * @property {string} target
 * @property {boolean | undefined} [external]
 */
/** A .rels part: [{id, type, target, external}]
 *  @param {RelEntry[]} list
 *  @returns {string} */
export function rels(list) {
  return `<?xml version="1.0"?><Relationships xmlns="${REL_NS}">`
    + list.map((r) => `<Relationship Id="${r.id}" Type="${r.type ?? RT.hyperlink}" Target="${r.target}"${r.external ? ' TargetMode="External"' : ""}/>`).join("")
    + `</Relationships>`;
}

/** @typedef {"docx" | "xlsx" | "pptx"} Flavour an OOXML package the fixtures build */
/**
 * One text per flavour.
 * @typedef {Object} ByFlavour
 * @property {string} docx
 * @property {string} xlsx
 * @property {string} pptx
 */
/** @type {ByFlavour} each flavour's main content type */
export const MAIN_TYPE = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
};
/** @type {ByFlavour} each flavour's main part */
export const MAIN_PART = { docx: "word/document.xml", xlsx: "xl/workbook.xml", pptx: "ppt/presentation.xml" };

/** @param {Flavour} flavour @param {string} [mainType] @returns {string} */
function contentTypes(flavour, mainType = MAIN_TYPE[flavour]) {
  return `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
    + `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`
    + `<Default Extension="xml" ContentType="application/xml"/>`
    + `<Override PartName="/${MAIN_PART[flavour]}" ContentType="${mainType}"/></Types>`;
}

/** The OPC skeleton of a flavour: content types and the package rels.
 *  `mainType` declares another main content type (a macro-enabled twin's).
 *  @param {Flavour} flavour
 *  @param {string} [mainType]
 *  @returns {ZipMember[]} */
export function skeleton(flavour, mainType = MAIN_TYPE[flavour]) {
  return [
    { name: CONTENT_TYPES_PART, data: contentTypes(flavour, mainType) },
    { name: "_rels/.rels", data: rels([{ id: "rId1", type: RT.office, target: MAIN_PART[flavour] }]) },
  ];
}

/** @typedef {string | number | null | undefined} CoreValue a core property's text; null or absent writes no element */
/**
 * The core properties `core` writes, each as given.
 * @typedef {Object} CoreOptions
 * @property {CoreValue} [creator]
 * @property {CoreValue} [lastModifiedBy]
 * @property {CoreValue} [revision]
 * @property {CoreValue} [created]
 * @property {CoreValue} [modified]
 * @property {CoreValue} [title]
 */
/** @param {CoreOptions} [o] @returns {string} a core-properties part */
export const core = (o = {}) => {
  const { creator, lastModifiedBy, revision, created, modified, title } = o;
  return `<?xml version="1.0"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/">`
  + (creator != null ? `<dc:creator>${creator}</dc:creator>` : "")
  + (lastModifiedBy != null ? `<cp:lastModifiedBy>${lastModifiedBy}</cp:lastModifiedBy>` : "")
  + (revision != null ? `<cp:revision>${revision}</cp:revision>` : "")
  + (created != null ? `<dcterms:created>${created}</dcterms:created>` : "")
  + (modified != null ? `<dcterms:modified>${modified}</dcterms:modified>` : "")
  + (title != null ? `<dc:title>${title}</dc:title>` : "")
  + `</cp:coreProperties>`;
};

/* ------------------------------------------------------------------ DOCX */

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
/** @param {string} body @returns {string} a document part */
export const wdoc = (body) => `<?xml version="1.0"?><w:document ${W}><w:body>${body}</w:body></w:document>`;
/** @param {...string} runs @returns {string} a paragraph */
export const wp = (...runs) => `<w:p>${runs.join("")}</w:p>`;
/** @param {string} t @returns {string} a run */
export const wr = (t) => `<w:r><w:t xml:space="preserve">${t}</w:t></w:r>`;

/**
 * What `docx` builds: `document` the whole main part, else `body` inside one (absent: one paragraph "Hello");
 * `mainCd`/`commentsCd` those parts' declared fields; `extra` further members.
 * @typedef {Object} DocxOptions
 * @property {string | undefined} [mainType]
 * @property {ZipData | null | undefined} [document]
 * @property {string | null | undefined} [body]
 * @property {ZipDeclared | undefined} [mainCd]
 * @property {ZipData | null | undefined} [rels]
 * @property {ZipData | null | undefined} [comments]
 * @property {ZipDeclared | undefined} [commentsCd]
 * @property {ZipData | null | undefined} [core]
 * @property {ZipMember[] | undefined} [extra]
 */
/** A DOCX: { body, rels:[...], comments, core, extra:[members], cd:{usize...} for the main part }
 *  @param {DocxOptions} [o]
 *  @returns {Uint8Array} */
export function docx(o = {}) {
  /** @type {ZipMember[]} */
  const members = [...skeleton("docx", o.mainType),
    { name: "word/document.xml", data: o.document ?? wdoc(o.body ?? wp(wr("Hello"))), cd: o.mainCd }];
  const relsPart = o.rels;
  if (relsPart) members.push({ name: "word/_rels/document.xml.rels", data: relsPart });
  const comments = o.comments;
  if (comments != null) members.push({ name: "word/comments.xml", data: comments, cd: o.commentsCd });
  const corePart = o.core;
  if (corePart != null) members.push({ name: CORE_PROPERTIES_PART, data: corePart });
  return zip([...members, ...(o.extra ?? [])]);
}

/* ------------------------------------------------------------------ PPTX */

const P = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
/** @typedef {{[shape: number]: string}} SlideHlinks the r:id each shape's first run clicks to, by the shape's index */
/**
 * A slide's `show` attribute (absent or null writes none) and its shapes' click links.
 * @typedef {Object} SlideOptions
 * @property {string | number | null | undefined} [show]
 * @property {SlideHlinks | undefined} [hlinks]
 */
/** One text shape per entry of `texts`; `hlink` puts an r:id click on the first run of that shape.
 *  @param {string[]} texts
 *  @param {SlideOptions} [opts]
 *  @returns {string} a slide part */
export const slideXml = (texts, { show = null, hlinks = {} } = {}) =>
  `<?xml version="1.0"?><p:sld ${P}${show != null ? ` show="${show}"` : ""}><p:cSld><p:spTree>`
  + texts.map((t, i) => `<p:sp><p:txBody><a:p><a:r>${hlinks[i] ? `<a:rPr><a:hlinkClick r:id="${hlinks[i]}"/></a:rPr>` : ""}<a:t>${t}</a:t></a:r></a:p></p:txBody></p:sp>`).join("")
  + `</p:spTree></p:cSld></p:sld>`;
/** @param {string} t @returns {string} a notes part */
export const notesXml = (t) => `<?xml version="1.0"?><p:notes ${P}><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>${t}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:notes>`;

/**
 * One slide of `pptx`: `xml` the whole part, else `texts` (with `show`, `hlinks`) through `slideXml`; `notes` a notes
 * slide `notesFile` (absent: notes_<file>) linked from the slide's rels; `sldIdShow` the deck list's `show`.
 * @typedef {Object} PptxSlide
 * @property {string} file
 * @property {string[] | undefined} [texts]
 * @property {string | number | null | undefined} [show]
 * @property {SlideHlinks | undefined} [hlinks]
 * @property {RelEntry[] | undefined} [rels]
 * @property {string | null | undefined} [notes]
 * @property {string | undefined} [notesFile]
 * @property {string | number | null | undefined} [sldIdShow]
 * @property {ZipData | null | undefined} [xml]
 * @property {ZipDeclared | undefined} [cd]
 */
/**
 * What `pptx` builds: `presentation` the whole main part, else one listing `slides`; `presRels` false writes no
 * presentation rels, a text writes that.
 * @typedef {Object} PptxOptions
 * @property {PptxSlide[] | undefined} [slides]
 * @property {ZipData | null | undefined} [presentation]
 * @property {string | undefined} [mainType]
 * @property {ZipDeclared | undefined} [mainCd]
 * @property {ZipData | false | null | undefined} [presRels]
 * @property {ZipData | null | undefined} [core]
 * @property {ZipMember[] | undefined} [extra]
 */
/** A PPTX. slides: [{ file, texts, show, hlinks, rels:[...], notes, sldIdShow }] listed in DECK order;
 *  their part names are `ppt/slides/<file>`, so a deck can be ordered unlike its filenames.
 *  @param {PptxOptions} [o]
 *  @returns {Uint8Array} */
export function pptx(o = {}) {
  /** @type {PptxSlide[]} */
  const slides = o.slides ?? [{ file: "slide1.xml", texts: ["Title"] }];
  const presRels = rels(slides.map((s, i) => ({ id: `rId${i + 10}`, type: RT.slide, target: `slides/${s.file}` })));
  const pres = o.presentation ?? (`<?xml version="1.0"?><p:presentation ${P}><p:sldIdLst>`
    + slides.map((s, i) => {
      const sldIdShow = s.sldIdShow;
      return `<p:sldId id="${256 + i}" r:id="rId${i + 10}"${sldIdShow != null ? ` show="${sldIdShow}"` : ""}/>`;
    }).join("")
    + `</p:sldIdLst></p:presentation>`);
  /** @type {ZipMember[]} */
  const members = [...skeleton("pptx", o.mainType), { name: "ppt/presentation.xml", data: pres, cd: o.mainCd }];
  const presRelsGiven = o.presRels;
  if (presRelsGiven !== false) members.push({ name: "ppt/_rels/presentation.xml.rels", data: presRelsGiven ?? presRels });
  for (const s of slides) {
    members.push({ name: `ppt/slides/${s.file}`, data: s.xml ?? slideXml(s.texts ?? [], s), cd: s.cd });
    const r = [...(s.rels ?? [])];
    const notes = s.notes;
    if (notes != null) {
      const nf = s.notesFile ?? `notes_${s.file}`;
      r.push({ id: "rIdN", type: RT.notes, target: `../notesSlides/${nf}` });
      members.push({ name: `ppt/notesSlides/${nf}`, data: notesXml(notes) });
    }
    if (r.length) members.push({ name: `ppt/slides/_rels/${s.file}.rels`, data: rels(r) });
  }
  const corePart = o.core;
  if (corePart != null) members.push({ name: CORE_PROPERTIES_PART, data: corePart });
  return zip([...members, ...(o.extra ?? [])]);
}

/* ------------------------------------------------------------------ XLSX */

const S = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
/**
 * One cell of `sheetXml`: `t` its type attribute, `f` its formula, `v` its value, `is` its inline string, each
 * written only where given.
 * @typedef {Object} SheetCell
 * @property {string} r
 * @property {string | null | undefined} [t]
 * @property {string | number | null | undefined} [v]
 * @property {string | null | undefined} [f]
 * @property {string | number | null | undefined} [is]
 */
/**
 * One row of `sheetXml`.
 * @typedef {Object} SheetRow
 * @property {string | number} r
 * @property {boolean | undefined} [hidden]
 * @property {SheetCell[]} cells
 */
/**
 * One `<col>` of `sheetXml`.
 * @typedef {Object} SheetCol
 * @property {number} min
 * @property {number} max
 * @property {boolean | undefined} [hidden]
 */
/**
 * One `<hyperlink>` of `sheetXml`: `id` its relationship, `location` its place in the workbook.
 * @typedef {Object} SheetHyperlink
 * @property {string} ref
 * @property {string | null | undefined} [id]
 * @property {string | null | undefined} [location]
 */
/**
 * What `sheetXml` writes.
 * @typedef {Object} SheetOptions
 * @property {SheetRow[] | undefined} [rows]
 * @property {SheetCol[] | undefined} [cols]
 * @property {SheetHyperlink[] | undefined} [hyperlinks]
 */
/** rows: [{ r, hidden, cells:[{ r:"A1", t, v, f, is }] }], cols: [{min,max,hidden}], hyperlinks: [{ref, id, location}]
 *  @param {SheetOptions} [o]
 *  @returns {string} a worksheet part */
export function sheetXml({ rows = [], cols = [], hyperlinks = [] } = {}) {
  return `<?xml version="1.0"?><worksheet ${S}>`
    + (cols.length ? `<cols>${cols.map((c) => `<col min="${c.min}" max="${c.max}"${c.hidden ? ' hidden="1"' : ""}/>`).join("")}</cols>` : "")
    + `<sheetData>` + rows.map((row) => `<row r="${row.r}"${row.hidden ? ' hidden="1"' : ""}>`
      + row.cells.map((c) => {
        const { t, f, v, is } = c;
        return `<c r="${c.r}"${t ? ` t="${t}"` : ""}>${f != null ? `<f>${f}</f>` : ""}${v != null ? `<v>${v}</v>` : ""}${is != null ? `<is><t>${is}</t></is>` : ""}</c>`;
      }).join("")
      + `</row>`).join("") + `</sheetData>`
    + (hyperlinks.length ? `<hyperlinks>${hyperlinks.map((h) => {
      const { id, location } = h;
      return `<hyperlink ref="${h.ref}"${id ? ` r:id="${id}"` : ""}${location ? ` location="${location}"` : ""}/>`;
    }).join("")}</hyperlinks>` : "")
    + `</worksheet>`;
}

/**
 * One sheet of `xlsx`: `name` absent or null writes no name; `xml` the whole part, else `data` through `sheetXml`;
 * `rels` its rels part, as text or as relationships.
 * @typedef {Object} XlsxSheetFixture
 * @property {string | null | undefined} [name]
 * @property {string | null | undefined} [state]
 * @property {SheetOptions | undefined} [data]
 * @property {ZipData | null | undefined} [xml]
 * @property {string | RelEntry[] | null | undefined} [rels]
 * @property {ZipDeclared | undefined} [cd]
 */
/**
 * One defined name of `xlsx`.
 * @typedef {Object} DefinedNameFixture
 * @property {string} name
 * @property {string} ref
 * @property {number | string | null | undefined} [localSheetId]
 * @property {boolean | undefined} [hidden]
 */
/**
 * What `xlsx` builds: `workbook` the whole main part, else one listing `sheets` and `definedNames`; `wbRels` false
 * writes no workbook rels, a text writes that.
 * @typedef {Object} XlsxOptions
 * @property {XlsxSheetFixture[] | undefined} [sheets]
 * @property {ZipData | null | undefined} [workbook]
 * @property {DefinedNameFixture[] | undefined} [definedNames]
 * @property {string | undefined} [mainType]
 * @property {ZipDeclared | undefined} [workbookCd]
 * @property {ZipData | false | null | undefined} [wbRels]
 * @property {ZipData | null | undefined} [sharedStrings]
 * @property {ZipDeclared | undefined} [sharedStringsCd]
 * @property {ZipData | null | undefined} [core]
 * @property {ZipMember[] | undefined} [extra]
 */
/** An XLSX. sheets: [{ name, state, data (sheetXml opts) | xml, rels:[...], cd }] in workbook order,
 *  stored as xl/worksheets/sheet<i+1>.xml. definedNames: [{name, ref, localSheetId, hidden}].
 *  @param {XlsxOptions} [o]
 *  @returns {Uint8Array} */
export function xlsx(o = {}) {
  /** @type {XlsxSheetFixture[]} */
  const sheets = o.sheets ?? [{ name: "Sheet1", data: { rows: [{ r: 1, cells: [{ r: "A1", t: "inlineStr", is: "x" }] }] } }];
  const definedNames = o.definedNames ?? [];
  const wb = o.workbook ?? (`<?xml version="1.0"?><workbook ${S}><sheets>`
    + sheets.map((s, i) => {
      const { name, state } = s;
      return `<sheet${name != null ? ` name="${name}"` : ""} sheetId="${i + 1}"${state ? ` state="${state}"` : ""} r:id="rId${i + 1}"/>`;
    }).join("")
    + `</sheets>`
    + (definedNames.length ? `<definedNames>${definedNames.map((d) => {
      const localSheetId = d.localSheetId;
      return `<definedName name="${d.name}"${localSheetId != null ? ` localSheetId="${localSheetId}"` : ""}${d.hidden ? ' hidden="1"' : ""}>${d.ref}</definedName>`;
    }).join("")}</definedNames>` : "")
    + `</workbook>`);
  /** @type {ZipMember[]} */
  const members = [...skeleton("xlsx", o.mainType), { name: "xl/workbook.xml", data: wb, cd: o.workbookCd }];
  const wbRels = o.wbRels;
  if (wbRels !== false) {
    members.push({ name: "xl/_rels/workbook.xml.rels", data: wbRels ?? rels(sheets.map((s, i) => ({ id: `rId${i + 1}`, type: RT.sheet, target: `worksheets/sheet${i + 1}.xml` }))) });
  }
  sheets.forEach((s, i) => {
    members.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: s.xml ?? sheetXml(s.data), cd: s.cd });
    const sheetRels = s.rels;
    if (sheetRels) members.push({ name: `xl/worksheets/_rels/sheet${i + 1}.xml.rels`, data: typeof sheetRels === "string" ? sheetRels : rels(sheetRels) });
  });
  const sharedStrings = o.sharedStrings;
  if (sharedStrings != null) members.push({ name: "xl/sharedStrings.xml", data: sharedStrings, cd: o.sharedStringsCd });
  const corePart = o.core;
  if (corePart != null) members.push({ name: CORE_PROPERTIES_PART, data: corePart });
  return zip([...members, ...(o.extra ?? [])]);
}

/** @param {string[]} strings @returns {string} a shared-strings part */
export const sst = (strings) => `<?xml version="1.0"?><sst ${S}>${strings.map((t) => `<si><t>${t}</t></si>`).join("")}</sst>`;
/** @param {string} name @param {string} ref @returns {string} a table part */
export const tablePart = (name, ref) => `<?xml version="1.0"?><table ${S} id="1" name="${name}" displayName="${name}" ref="${ref}"/>`;

/** A member whose CRC is declared wrong, so readPart refuses it (crc_mismatch).
 *  @type {ZipDeclared} */
export const CORRUPT = { crc: 0x12345678 };
/** A declared uncompressed size over the streamed ceiling, 32 MiB (R12, R35: the text is neither held nor read in
 *  pieces); the bytes themselves are small.
 *  @type {ZipDeclared} */
export const OVER = { usize: 32 * 1024 * 1024 + 1 };
/** One over the 20 MiB bound a reader holds whole: such a part is read in pieces (R35).
 *  @type {ZipDeclared} */
export const OVER_WHOLE = { usize: 20 * 1024 * 1024 + 1 };

/* ------------------------------------------------------------------ VBA (R32) */

/* MS-OVBA §2.4.1 compression, literal tokens only: a container is the
 * signature byte 0x01 and its chunks; each chunk's flag byte 0x00 says its
 * next eight tokens are literal bytes. Valid compressed data, written so the
 * fixture needs no compressor of its own to trust. A chunk here decompresses
 * to at most 3,584 bytes, so its compressed size (448 flag bytes + the
 * literals) stays inside a chunk's 4,096-byte payload. */
/** @param {ZipData} data @returns {Uint8Array} */
export function ovbaCompress(data) {
  const src = enc(data);
  const out = [0x01];
  for (let at = 0; at < src.length || at === 0; at += 3584) {
    const piece = src.subarray(at, at + 3584);
    /** @type {number[]} */
    const body = [];
    for (let i = 0; i < piece.length; i += 8) body.push(0x00, ...piece.subarray(i, i + 8));
    const size = body.length + 2;
    const header = ((size - 3) & 0x0fff) | 0x3000 | 0x8000;
    out.push(header & 255, header >> 8, ...body);
    if (!src.length) break;
  }
  return new Uint8Array(out);
}

/** @param {number} v @returns {number[]} */
const le16 = (v) => [v & 255, (v >> 8) & 255];
/** @param {number} v @returns {number[]} */
const le32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
/** @param {string} s @returns {number[]} */
const latin = (s) => Array.from(s, (c) => c.charCodeAt(0) & 255);
/** @param {string} s @returns {number[]} */
const utf16 = (s) => Array.from(s).flatMap((c) => le16(c.charCodeAt(0)));
/** @param {number} id @param {number[]} bytes @returns {number[]} */
const rec = (id, bytes) => [...le16(id), ...le32(bytes.length), ...bytes];
/** @param {number} n @param {number} v @returns {number[]} `n` entries, each `v` */
const filled = (n, v) => Array.from({ length: n }, () => v);

/**
 * One VBA module of `vbaProject`: `source` its code (absent: empty), `stream` its stream's name (absent: its name),
 * `document` a document module rather than a standard one.
 * @typedef {Object} VbaModule
 * @property {string} name
 * @property {ZipData | null | undefined} [source]
 * @property {string | null | undefined} [stream]
 * @property {boolean | undefined} [document]
 */

/* The decompressed `VBA/dir` stream (MS-OVBA §2.3.4.2): PROJECTINFORMATION,
 * no references, PROJECTMODULES with one MODULE record per module, each
 * module's source at TextOffset 0 of its own stream (no p-code). */
/** @param {string} project @param {VbaModule[]} modules @returns {Uint8Array} */
function vbaDir(project, modules) {
  const out = [
    ...rec(0x0001, le32(1)), ...rec(0x0002, le32(0x409)), ...rec(0x0014, le32(0x409)), ...rec(0x0003, le16(1252)),
    ...rec(0x0004, latin(project)),
    ...rec(0x0005, []), ...rec(0x0040, []),
    ...rec(0x0006, []), ...rec(0x003d, []),
    ...rec(0x0007, le32(0)), ...rec(0x0008, le32(0)),
    ...le16(0x0009), ...le32(4), ...le32(1), ...le16(0),
    ...rec(0x000c, []), ...rec(0x003c, []),
    ...le16(0x000f), ...le32(2), ...le16(modules.length),
    ...rec(0x0013, le16(0xffff)),
  ];
  for (const m of modules) {
    out.push(...rec(0x0019, latin(m.name)), ...rec(0x0047, utf16(m.name)),
      ...rec(0x001a, latin(m.stream ?? m.name)), ...rec(0x0032, utf16(m.stream ?? m.name)),
      ...rec(0x001c, []), ...rec(0x0048, []),
      ...rec(0x0031, le32(0)), ...rec(0x001e, le32(0)), ...rec(0x002c, le16(0xffff)),
      ...le16(m.document ? 0x0022 : 0x0021), ...le32(0),
      ...le16(0x002b), ...le32(0));
  }
  out.push(...le16(0x0010), ...le32(0));
  return new Uint8Array(out);
}

/** @typedef {{[name: string]: Uint8Array | CfbTree}} CfbTree a compound file's storages (objects) and streams (bytes), by name */
/**
 * A storage (type 1) or the root (type 5) in `cfb`'s directory: `kids` its children's entry numbers.
 * @typedef {Object} CfbStorageEntry
 * @property {string} name
 * @property {1 | 5} type
 * @property {number[]} kids
 */
/**
 * A stream (type 2) in `cfb`'s directory: `start` its first mini sector, once placed.
 * @typedef {Object} CfbStreamEntry
 * @property {string} name
 * @property {2} type
 * @property {Uint8Array} data
 * @property {number} [start]
 */
/** @typedef {CfbStorageEntry | CfbStreamEntry} CfbEntry */

/* A minimal MS-CFB compound file (version 3, 512-byte sectors): one FAT
 * sector, the directory, the mini FAT and the mini stream, every stream in
 * the mini stream (all are under the 4,096-byte cutoff). `tree` is
 * { name: Uint8Array | { ...subtree } }; siblings are chained right-ward in
 * CFB name order (length, then upper case), a valid if unbalanced tree. */
/** @param {CfbTree} tree @returns {Uint8Array} */
export function cfb(tree) {
  /** @type {CfbStorageEntry} */
  const root = { name: "Root Entry", type: 5, kids: [] };
  /** @type {CfbEntry[]} */
  const entries = [root];
  /** @param {CfbTree} obj @param {CfbStorageEntry} parent @returns {void} */
  const add = (obj, parent) => {
    for (const [name, v] of Object.entries(obj)) {
      const id = entries.length;
      if (v instanceof Uint8Array) {
        entries.push({ name, type: 2, data: v });
        parent.kids.push(id);
      } else {
        /** @type {CfbStorageEntry} */
        const e = { name, type: 1, kids: [] };
        entries.push(e);
        parent.kids.push(id);
        add(v, e);
      }
    }
  };
  add(tree, root);
  /** @param {string} n @returns {[number, string]} */
  const key = (n) => [n.length, n.toUpperCase()];
  /** @param {number} i @returns {CfbEntry} */
  const entryAt = (i) => {
    const e = entries[i];
    if (!e) throw new TypeError(`no directory entry ${i}`);
    return e;
  };
  for (const e of entries) if ("kids" in e) e.kids.sort((a, b) => {
    const [la, ua] = key(entryAt(a).name), [lb, ub] = key(entryAt(b).name);
    return la - lb || (ua < ub ? -1 : ua > ub ? 1 : 0);
  });
  /* the mini stream: each stream at a 64-byte mini-sector boundary */
  /** @type {number[]} */
  const mini = [];
  /** @type {number[]} */
  const miniFat = [];
  for (const e of entries) {
    if (e.type !== 2) continue;
    const n = Math.max(1, Math.ceil(e.data.length / 64));
    e.start = e.data.length ? miniFat.length : 0xfffffffe;
    if (!e.data.length) continue;
    for (let i = 0; i < n; i++) miniFat.push(i === n - 1 ? 0xfffffffe : miniFat.length + 1);
    const padded = new Uint8Array(n * 64); padded.set(e.data);
    mini.push(...padded);
  }
  const dirSectors = Math.ceil(entries.length / 4);
  const miniFatSectors = Math.max(1, Math.ceil(miniFat.length / 128));
  const miniSectors = Math.ceil(mini.length / 512);
  const firstDir = 1, firstMiniFat = firstDir + dirSectors, firstMini = firstMiniFat + miniFatSectors;
  const total = firstMini + miniSectors;
  const fat = filled(128, 0xffffffff);
  fat[0] = 0xfffffffd;
  /** @param {number} start @param {number} n @returns {void} */
  const chain = (start, n) => { for (let i = 0; i < n; i++) fat[start + i] = i === n - 1 ? 0xfffffffe : start + i + 1; };
  chain(firstDir, dirSectors); chain(firstMiniFat, miniFatSectors); chain(firstMini, miniSectors);
  const header = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, ...filled(16, 0),
    ...le16(0x003e), ...le16(0x0003), ...le16(0xfffe), ...le16(9), ...le16(6), ...filled(6, 0),
    ...le32(0), ...le32(1), ...le32(firstDir), ...le32(0), ...le32(4096),
    ...le32(firstMiniFat), ...le32(miniFatSectors), ...le32(0xfffffffe), ...le32(0), ...le32(0)];
  while (header.length < 512) header.push(0xff);
  /** @type {number[]} */
  const dir = [];
  entries.forEach((e, id) => {
    const name = utf16(e.name).concat([0, 0]);
    const b = filled(128, 0);
    name.forEach((x, i) => { b[i] = x; });
    b.splice(64, 2, ...le16(name.length));
    b[66] = e.type; b[67] = 1;
    const parent = entries.find((p) => "kids" in p && p.kids.includes(id));
    const sib = parent && "kids" in parent ? parent.kids[parent.kids.indexOf(id) + 1] : undefined;
    b.splice(68, 4, ...le32(0xffffffff));
    b.splice(72, 4, ...le32(sib ?? 0xffffffff));
    b.splice(76, 4, ...le32("kids" in e && e.kids.length ? e.kids[0] ?? 0xffffffff : 0xffffffff));
    if (e.type === 5) { b.splice(116, 4, ...le32(miniSectors ? firstMini : 0xfffffffe)); b.splice(120, 4, ...le32(mini.length)); }
    /* `start ?? 0`: every stream is placed above; le32 of nothing would have written the same zeros */
    if (e.type === 2) { b.splice(116, 4, ...le32(e.start ?? 0)); b.splice(120, 4, ...le32(e.data.length)); }
    dir.push(...b);
  });
  while (dir.length < dirSectors * 512) {
    const empty = filled(128, 0);
    empty.splice(68, 12, ...le32(0xffffffff), ...le32(0xffffffff), ...le32(0xffffffff));
    dir.push(...empty);
  }
  const mf = filled(miniFatSectors * 128, 0xffffffff);
  miniFat.forEach((v, i) => { mf[i] = v; });
  const body = [...fat.flatMap(le32), ...dir, ...mf.flatMap(le32), ...mini];
  while (body.length < (total - 0) * 512) body.push(0);
  return new Uint8Array([...header, ...body]);
}

/**
 * What `vbaProject` writes: `corrupt` the names of modules whose streams are written as no compressed container.
 * @typedef {Object} VbaProjectOptions
 * @property {string | undefined} [project]
 * @property {VbaModule[] | undefined} [modules]
 * @property {string[] | undefined} [corrupt]
 */
/** A vbaProject.bin: { project, modules:[{ name, source, stream?, document? }] }.
 *  `corrupt: [name]` writes those modules' streams as bytes that are no
 *  compressed container, so the module's source cannot be read.
 *  @param {VbaProjectOptions} [o]
 *  @returns {Uint8Array} */
export function vbaProject({ project = "VBAProject", modules = [], corrupt = [] } = {}) {
  /** @type {CfbTree} */
  const vba = {
    _VBA_PROJECT: new Uint8Array([0xcc, 0x61, 0xff, 0xff, 0x00, 0x00, 0x00]),
    dir: ovbaCompress(vbaDir(project, modules)),
  };
  for (const m of modules) vba[m.stream ?? m.name] = corrupt.includes(m.name) ? new Uint8Array([0x07, 0x07, 0x07]) : ovbaCompress(m.source ?? "");
  const projectText = `ID="{00000000-0000-0000-0000-000000000000}"\r\n`
    + modules.map((m) => (m.document ? `Document=${m.name}/&H00000000` : `Module=${m.name}`)).join("\r\n")
    + `\r\nName="${project}"\r\n`;
  return cfb({ PROJECT: enc(projectText), VBA: vba });
}
