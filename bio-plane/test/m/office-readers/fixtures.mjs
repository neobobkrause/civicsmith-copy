/* Fixtures for the office-readers suite: a ZIP writer built on node:zlib
 * (deflate and CRC-32 independent of the module under test), and builders
 * for minimal DOCX, PPTX and XLSX packages. Every central-directory field a
 * reader trusts can be overridden per member (`cd: {usize, crc}`), so a
 * fixture can declare sizes it does not carry, or carry a corrupt member. */
import { deflateRawSync, crc32 as zcrc32 } from "node:zlib";

export const enc = (s) => (typeof s === "string" ? new TextEncoder().encode(s) : s);

function u16(v) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v, true); return b; }
function u32(v) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v >>> 0, true); return b; }
function cat(parts) {
  const n = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(n);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

/** members: [{ name, data, method = 8, cd: {usize, crc}, ld: {usize} }] -> ZIP bytes (`ld` states the declared size in
 *  the local header too, so a member can claim a size both headers agree on). */
export function zip(members) {
  const out = [];
  let offset = 0;
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
export const RT = {
  office: `${R}/officeDocument`, hyperlink: `${R}/hyperlink`, sheet: `${R}/worksheet`,
  table: `${R}/table`, slide: `${R}/slide`, notes: `${R}/notesSlide`, image: `${R}/image`,
  oleObject: `${R}/oleObject`, drawing: `${R}/drawing`, package: `${R}/package`,
};

/** A .rels part: [{id, type, target, external}] */
export function rels(list) {
  return `<?xml version="1.0"?><Relationships xmlns="${REL_NS}">`
    + list.map((r) => `<Relationship Id="${r.id}" Type="${r.type ?? RT.hyperlink}" Target="${r.target}"${r.external ? ' TargetMode="External"' : ""}/>`).join("")
    + `</Relationships>`;
}

export const MAIN_TYPE = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
};
export const MAIN_PART = { docx: "word/document.xml", xlsx: "xl/workbook.xml", pptx: "ppt/presentation.xml" };

function contentTypes(flavour, mainType = MAIN_TYPE[flavour]) {
  return `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
    + `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`
    + `<Default Extension="xml" ContentType="application/xml"/>`
    + `<Override PartName="/${MAIN_PART[flavour]}" ContentType="${mainType}"/></Types>`;
}

/** The OPC skeleton of a flavour: content types and the package rels.
 *  `mainType` declares another main content type (a macro-enabled twin's). */
export function skeleton(flavour, mainType = MAIN_TYPE[flavour]) {
  return [
    { name: "[Content_Types].xml", data: contentTypes(flavour, mainType) },
    { name: "_rels/.rels", data: rels([{ id: "rId1", type: RT.office, target: MAIN_PART[flavour] }]) },
  ];
}

export const core = (o = {}) =>
  `<?xml version="1.0"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/">`
  + (o.creator != null ? `<dc:creator>${o.creator}</dc:creator>` : "")
  + (o.lastModifiedBy != null ? `<cp:lastModifiedBy>${o.lastModifiedBy}</cp:lastModifiedBy>` : "")
  + (o.revision != null ? `<cp:revision>${o.revision}</cp:revision>` : "")
  + (o.created != null ? `<dcterms:created>${o.created}</dcterms:created>` : "")
  + (o.modified != null ? `<dcterms:modified>${o.modified}</dcterms:modified>` : "")
  + (o.title != null ? `<dc:title>${o.title}</dc:title>` : "")
  + `</cp:coreProperties>`;

/* ------------------------------------------------------------------ DOCX */

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
export const wdoc = (body) => `<?xml version="1.0"?><w:document ${W}><w:body>${body}</w:body></w:document>`;
export const wp = (...runs) => `<w:p>${runs.join("")}</w:p>`;
export const wr = (t) => `<w:r><w:t xml:space="preserve">${t}</w:t></w:r>`;

/** A DOCX: { body, rels:[...], comments, core, extra:[members], cd:{usize...} for the main part } */
export function docx(o = {}) {
  return zip([
    ...skeleton("docx", o.mainType),
    { name: "word/document.xml", data: o.document ?? wdoc(o.body ?? wp(wr("Hello"))), cd: o.mainCd },
    ...(o.rels ? [{ name: "word/_rels/document.xml.rels", data: o.rels }] : []),
    ...(o.comments != null ? [{ name: "word/comments.xml", data: o.comments, cd: o.commentsCd }] : []),
    ...(o.core != null ? [{ name: "docProps/core.xml", data: o.core }] : []),
    ...(o.extra ?? []),
  ]);
}

/* ------------------------------------------------------------------ PPTX */

const P = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
/** One text shape per entry of `texts`; `hlink` puts an r:id click on the first run of that shape. */
export const slideXml = (texts, { show = null, hlinks = {} } = {}) =>
  `<?xml version="1.0"?><p:sld ${P}${show != null ? ` show="${show}"` : ""}><p:cSld><p:spTree>`
  + texts.map((t, i) => `<p:sp><p:txBody><a:p><a:r>${hlinks[i] ? `<a:rPr><a:hlinkClick r:id="${hlinks[i]}"/></a:rPr>` : ""}<a:t>${t}</a:t></a:r></a:p></p:txBody></p:sp>`).join("")
  + `</p:spTree></p:cSld></p:sld>`;
export const notesXml = (t) => `<?xml version="1.0"?><p:notes ${P}><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>${t}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:notes>`;

/** A PPTX. slides: [{ file, texts, show, hlinks, rels:[...], notes, sldIdShow }] listed in DECK order;
 *  their part names are `ppt/slides/<file>`, so a deck can be ordered unlike its filenames. */
export function pptx(o = {}) {
  const slides = o.slides ?? [{ file: "slide1.xml", texts: ["Title"] }];
  const presRels = rels(slides.map((s, i) => ({ id: `rId${i + 10}`, type: RT.slide, target: `slides/${s.file}` })));
  const pres = o.presentation ?? (`<?xml version="1.0"?><p:presentation ${P}><p:sldIdLst>`
    + slides.map((s, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 10}"${s.sldIdShow != null ? ` show="${s.sldIdShow}"` : ""}/>`).join("")
    + `</p:sldIdLst></p:presentation>`);
  const members = [...skeleton("pptx", o.mainType), { name: "ppt/presentation.xml", data: pres, cd: o.mainCd }];
  if (o.presRels !== false) members.push({ name: "ppt/_rels/presentation.xml.rels", data: o.presRels ?? presRels });
  for (const s of slides) {
    members.push({ name: `ppt/slides/${s.file}`, data: s.xml ?? slideXml(s.texts ?? [], s), cd: s.cd });
    const r = [...(s.rels ?? [])];
    if (s.notes != null) {
      const nf = s.notesFile ?? `notes_${s.file}`;
      r.push({ id: "rIdN", type: RT.notes, target: `../notesSlides/${nf}` });
      members.push({ name: `ppt/notesSlides/${nf}`, data: notesXml(s.notes) });
    }
    if (r.length) members.push({ name: `ppt/slides/_rels/${s.file}.rels`, data: rels(r) });
  }
  if (o.core != null) members.push({ name: "docProps/core.xml", data: o.core });
  return zip([...members, ...(o.extra ?? [])]);
}

/* ------------------------------------------------------------------ XLSX */

const S = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
/** rows: [{ r, hidden, cells:[{ r:"A1", t, v, f, is }] }], cols: [{min,max,hidden}], hyperlinks: [{ref, id, location}] */
export function sheetXml({ rows = [], cols = [], hyperlinks = [] } = {}) {
  return `<?xml version="1.0"?><worksheet ${S}>`
    + (cols.length ? `<cols>${cols.map((c) => `<col min="${c.min}" max="${c.max}"${c.hidden ? ' hidden="1"' : ""}/>`).join("")}</cols>` : "")
    + `<sheetData>` + rows.map((row) => `<row r="${row.r}"${row.hidden ? ' hidden="1"' : ""}>`
      + row.cells.map((c) => `<c r="${c.r}"${c.t ? ` t="${c.t}"` : ""}>${c.f != null ? `<f>${c.f}</f>` : ""}${c.v != null ? `<v>${c.v}</v>` : ""}${c.is != null ? `<is><t>${c.is}</t></is>` : ""}</c>`).join("")
      + `</row>`).join("") + `</sheetData>`
    + (hyperlinks.length ? `<hyperlinks>${hyperlinks.map((h) => `<hyperlink ref="${h.ref}"${h.id ? ` r:id="${h.id}"` : ""}${h.location ? ` location="${h.location}"` : ""}/>`).join("")}</hyperlinks>` : "")
    + `</worksheet>`;
}

/** An XLSX. sheets: [{ name, state, data (sheetXml opts) | xml, rels:[...], cd }] in workbook order,
 *  stored as xl/worksheets/sheet<i+1>.xml. definedNames: [{name, ref, localSheetId, hidden}]. */
export function xlsx(o = {}) {
  const sheets = o.sheets ?? [{ name: "Sheet1", data: { rows: [{ r: 1, cells: [{ r: "A1", t: "inlineStr", is: "x" }] }] } }];
  const wb = o.workbook ?? (`<?xml version="1.0"?><workbook ${S}><sheets>`
    + sheets.map((s, i) => `<sheet${s.name != null ? ` name="${s.name}"` : ""} sheetId="${i + 1}"${s.state ? ` state="${s.state}"` : ""} r:id="rId${i + 1}"/>`).join("")
    + `</sheets>`
    + ((o.definedNames ?? []).length ? `<definedNames>${o.definedNames.map((d) => `<definedName name="${d.name}"${d.localSheetId != null ? ` localSheetId="${d.localSheetId}"` : ""}${d.hidden ? ' hidden="1"' : ""}>${d.ref}</definedName>`).join("")}</definedNames>` : "")
    + `</workbook>`);
  const members = [...skeleton("xlsx", o.mainType), { name: "xl/workbook.xml", data: wb, cd: o.workbookCd }];
  if (o.wbRels !== false) {
    members.push({ name: "xl/_rels/workbook.xml.rels", data: o.wbRels ?? rels(sheets.map((s, i) => ({ id: `rId${i + 1}`, type: RT.sheet, target: `worksheets/sheet${i + 1}.xml` }))) });
  }
  sheets.forEach((s, i) => {
    members.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: s.xml ?? sheetXml(s.data), cd: s.cd });
    if (s.rels) members.push({ name: `xl/worksheets/_rels/sheet${i + 1}.xml.rels`, data: typeof s.rels === "string" ? s.rels : rels(s.rels) });
  });
  if (o.sharedStrings != null) members.push({ name: "xl/sharedStrings.xml", data: o.sharedStrings, cd: o.sharedStringsCd });
  if (o.core != null) members.push({ name: "docProps/core.xml", data: o.core });
  return zip([...members, ...(o.extra ?? [])]);
}

export const sst = (strings) => `<?xml version="1.0"?><sst ${S}>${strings.map((t) => `<si><t>${t}</t></si>`).join("")}</sst>`;
export const tablePart = (name, ref) => `<?xml version="1.0"?><table ${S} id="1" name="${name}" displayName="${name}" ref="${ref}"/>`;

/** A member whose CRC is declared wrong, so readPart refuses it (crc_mismatch). */
export const CORRUPT = { crc: 0x12345678 };
/** A declared uncompressed size over the streamed ceiling, 32 MiB (R12, R35: the text is neither held nor read in
 *  pieces); the bytes themselves are small. */
export const OVER = { usize: 32 * 1024 * 1024 + 1 };
/** One over the 20 MiB bound a reader holds whole: such a part is read in pieces (R35). */
export const OVER_WHOLE = { usize: 20 * 1024 * 1024 + 1 };

/* ------------------------------------------------------------------ VBA (R32) */

/* MS-OVBA §2.4.1 compression, literal tokens only: a container is the
 * signature byte 0x01 and its chunks; each chunk's flag byte 0x00 says its
 * next eight tokens are literal bytes. Valid compressed data, written so the
 * fixture needs no compressor of its own to trust. A chunk here decompresses
 * to at most 3,584 bytes, so its compressed size (448 flag bytes + the
 * literals) stays inside a chunk's 4,096-byte payload. */
export function ovbaCompress(data) {
  const src = enc(data);
  const out = [0x01];
  for (let at = 0; at < src.length || at === 0; at += 3584) {
    const piece = src.subarray(at, at + 3584);
    const body = [];
    for (let i = 0; i < piece.length; i += 8) body.push(0x00, ...piece.subarray(i, i + 8));
    const size = body.length + 2;
    const header = ((size - 3) & 0x0fff) | 0x3000 | 0x8000;
    out.push(header & 255, header >> 8, ...body);
    if (!src.length) break;
  }
  return new Uint8Array(out);
}

const le16 = (v) => [v & 255, (v >> 8) & 255];
const le32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
const latin = (s) => Array.from(s, (c) => c.charCodeAt(0) & 255);
const utf16 = (s) => Array.from(s).flatMap((c) => le16(c.charCodeAt(0)));
const rec = (id, bytes) => [...le16(id), ...le32(bytes.length), ...bytes];

/* The decompressed `VBA/dir` stream (MS-OVBA §2.3.4.2): PROJECTINFORMATION,
 * no references, PROJECTMODULES with one MODULE record per module, each
 * module's source at TextOffset 0 of its own stream (no p-code). */
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

/* A minimal MS-CFB compound file (version 3, 512-byte sectors): one FAT
 * sector, the directory, the mini FAT and the mini stream, every stream in
 * the mini stream (all are under the 4,096-byte cutoff). `tree` is
 * { name: Uint8Array | { ...subtree } }; siblings are chained right-ward in
 * CFB name order (length, then upper case), a valid if unbalanced tree. */
export function cfb(tree) {
  const entries = [{ name: "Root Entry", type: 5, kids: [] }];
  const add = (obj, parent) => {
    for (const [name, v] of Object.entries(obj)) {
      const e = v instanceof Uint8Array ? { name, type: 2, data: v } : { name, type: 1, kids: [] };
      const id = entries.length;
      entries.push(e);
      parent.kids.push(id);
      if (e.type === 1) add(v, e);
    }
  };
  add(tree, entries[0]);
  const key = (n) => [n.length, n.toUpperCase()];
  for (const e of entries) if (e.kids) e.kids.sort((a, b) => {
    const [la, ua] = key(entries[a].name), [lb, ub] = key(entries[b].name);
    return la - lb || (ua < ub ? -1 : ua > ub ? 1 : 0);
  });
  /* the mini stream: each stream at a 64-byte mini-sector boundary */
  const mini = [];
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
  const fat = new Array(128).fill(0xffffffff);
  fat[0] = 0xfffffffd;
  const chain = (start, n) => { for (let i = 0; i < n; i++) fat[start + i] = i === n - 1 ? 0xfffffffe : start + i + 1; };
  chain(firstDir, dirSectors); chain(firstMiniFat, miniFatSectors); chain(firstMini, miniSectors);
  const header = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, ...new Array(16).fill(0),
    ...le16(0x003e), ...le16(0x0003), ...le16(0xfffe), ...le16(9), ...le16(6), ...new Array(6).fill(0),
    ...le32(0), ...le32(1), ...le32(firstDir), ...le32(0), ...le32(4096),
    ...le32(firstMiniFat), ...le32(miniFatSectors), ...le32(0xfffffffe), ...le32(0), ...le32(0)];
  while (header.length < 512) header.push(0xff);
  const dir = [];
  entries.forEach((e, id) => {
    const name = utf16(e.name).concat([0, 0]);
    const b = new Array(128).fill(0);
    name.forEach((x, i) => { b[i] = x; });
    b.splice(64, 2, ...le16(name.length));
    b[66] = e.type; b[67] = 1;
    const parent = entries.find((p) => p.kids && p.kids.includes(id));
    const sib = parent ? parent.kids[parent.kids.indexOf(id) + 1] : undefined;
    b.splice(68, 4, ...le32(0xffffffff));
    b.splice(72, 4, ...le32(sib ?? 0xffffffff));
    b.splice(76, 4, ...le32(e.kids && e.kids.length ? e.kids[0] : 0xffffffff));
    if (e.type === 5) { b.splice(116, 4, ...le32(miniSectors ? firstMini : 0xfffffffe)); b.splice(120, 4, ...le32(mini.length)); }
    if (e.type === 2) { b.splice(116, 4, ...le32(e.start)); b.splice(120, 4, ...le32(e.data.length)); }
    dir.push(...b);
  });
  while (dir.length < dirSectors * 512) {
    const empty = new Array(128).fill(0);
    empty.splice(68, 12, ...le32(0xffffffff), ...le32(0xffffffff), ...le32(0xffffffff));
    dir.push(...empty);
  }
  const mf = new Array(miniFatSectors * 128).fill(0xffffffff);
  miniFat.forEach((v, i) => { mf[i] = v; });
  const body = [...fat.flatMap(le32), ...dir, ...mf.flatMap(le32), ...mini];
  while (body.length < (total - 0) * 512) body.push(0);
  return new Uint8Array([...header, ...body]);
}

/** A vbaProject.bin: { project, modules:[{ name, source, stream?, document? }] }.
 *  `corrupt: [name]` writes those modules' streams as bytes that are no
 *  compressed container, so the module's source cannot be read. */
export function vbaProject({ project = "VBAProject", modules = [], corrupt = [] } = {}) {
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
