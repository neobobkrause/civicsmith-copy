/* doc-clean's tests: every document they clean, written here (test-support's `makeZip` and `makePdf`), and the
 * walks that read an answer back independently of the module. Each image carries a known marker string in each
 * place metadata can hide, so a test can say exactly that none of it is left. */
import { deflateSync, inflateRawSync } from "node:zlib";
import { makeZip } from "../../make-zip.mjs";
import { makePdf } from "../../../../pdf-worker/test/make-pdf.mjs";
import { cleanDocument } from "../../../src/doc-clean/index.mjs";

export { makeZip, makePdf };
export const enc = (s) => new TextEncoder().encode(s);
export const latin = (b) => Buffer.from(b).toString("latin1");
export const has = (b, s) => Buffer.from(b).includes(Buffer.from(s, "latin1"));
const cat = (...parts) => new Uint8Array(Buffer.concat(parts.map((p) => Buffer.from(p))));
const be16 = (v) => [v >> 8, v & 255];
const be32 = (v) => [v >>> 24, (v >> 16) & 255, (v >> 8) & 255, v & 255];

/** The strings an image's or a document's metadata carries in these fixtures; none may survive in a copy. */
export const SECRETS = ["GPSSECRET", "XMPSECRET", "COMSECRET", "PNGSECRET", "AUTHORSECRET", "EDITORSECRET", "COMPANYSECRET",
  "MANAGERSECRET", "TEMPLATESECRET", "APPSECRET", "CUSTOMSECRET", "COMMENTERSECRET", "CHANGERSECRET", "SIGNERSECRET",
  "PRIVATESECRET", "JP2SECRET", "GIFSECRET", "PATHSECRET", "2019-03-04"];

const segment = (marker, body) => [0xff, marker, ...be16(body.length + 2), ...body];

/** A minimal EXIF block: IFD0 with one GPS IFD pointer, whose IFD holds GPSProcessingMethod = "GPSSECRET". */
function exifBody() {
  const t = [0x4d, 0x4d, 0, 42, ...be32(8), ...be16(1), ...be16(0x8825), ...be16(4), ...be32(1), ...be32(26), ...be32(0),
    ...be16(1), ...be16(0x001b), ...be16(7), ...be32(9), ...be32(44), ...be32(0), ...enc("GPSSECRET")];
  return [...enc("Exif\0\0"), ...t];
}

/** An 8x8 grey baseline JPEG (one DC-only block, one-code Huffman tables), with `meta` its EXIF (GPS), XMP and
 *  comment segments; `coded` is everything that decides its pixels, for comparing a copy's with the original's. */
export function jpeg({ meta = true } = {}) {
  const dqt = segment(0xdb, [0, ...new Array(64).fill(1)]);
  const sof = segment(0xc0, [8, 0, 8, 0, 8, 1, 1, 0x11, 0]);
  const dht = [...segment(0xc4, [0x00, 1, ...new Array(15).fill(0), 0]), ...segment(0xc4, [0x10, 1, ...new Array(15).fill(0), 0])];
  const sos = segment(0xda, [1, 1, 0x00, 0, 63, 0]);
  const coded = [...dqt, ...sof, ...dht, ...sos, 0x3f, 0xff, 0xd9];
  const app0 = segment(0xe0, [...enc("JFIF\0"), 1, 1, 0, 0, 1, 0, 1, 0, 0]);
  const extra = meta ? [...segment(0xe1, exifBody()), ...segment(0xe1, [...enc("http://ns.adobe.com/xap/1.0/\0"), ...enc("<x:xmpmeta>XMPSECRET</x:xmpmeta>")]),
    ...segment(0xfe, [...enc("COMSECRET")])] : [];
  return new Uint8Array([0xff, 0xd8, ...app0, ...extra, ...coded]);
}
export const jpegCoded = (d) => latin(d).slice(latin(d).indexOf("\xff\xdb"));

function chunk(type, body) {
  const b = Buffer.from(body), t = Buffer.from(type, "latin1");
  return [...be32(b.length), ...t, ...b, ...be32(crc(Buffer.concat([t, b])))];
}
function crc(b) {
  let c = ~0;
  for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; }
  return ~c >>> 0;
}
/** A 2x2 grey PNG with a tEXt chunk ("PNGSECRET") when `meta`. */
export function png({ meta = true } = {}) {
  const ihdr = chunk("IHDR", [...be32(2), ...be32(2), 8, 0, 0, 0, 0]);
  const idat = chunk("IDAT", deflateSync(Buffer.from([0, 10, 20, 0, 30, 40])));
  const text = meta ? chunk("tEXt", enc("Author\0PNGSECRET")) : [];
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...ihdr, ...text, ...idat, ...chunk("IEND", [])]);
}
export const pngCoded = (d) => { const s = latin(d); return s.slice(s.indexOf("IDAT") - 4, s.indexOf("IEND") - 4); };

/** A 1x1 GIF with a comment extension ("GIFSECRET"). */
export const gif = () => new Uint8Array([...enc("GIF89a"), 1, 0, 1, 0, 0x80, 0, 0, 0, 0, 0, 255, 255, 255,
  0x21, 0xfe, 9, ...enc("GIFSECRET"), 0, 0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 0x44, 1, 0, 0x3b]);

/** A JP2 whose header box is followed by an `xml ` box ("JP2SECRET"), around a minimal one-tile J2K codestream. */
export function jp2() {
  const box = (type, body) => [...be32(8 + body.length), ...enc(type), ...body];
  const siz = segment(0x51, [0, 0, ...be32(1), ...be32(1), ...be32(0), ...be32(0), ...be32(1), ...be32(1), ...be32(0), ...be32(0), ...be16(1), 7, 1, 1]);
  const cod = segment(0x52, [0, 0, ...be16(1), 0, 0, 4, 4, 0, 0]);
  const qcd = segment(0x5c, [0x40, 0x48]);
  const sot = segment(0x90, [...be16(0), ...be32(12 + 2 + 1), 0, 1]);
  const code = [0xff, 0x4f, ...siz, ...cod, ...qcd, ...sot, 0xff, 0x93, 0x00, 0xff, 0xd9];
  return new Uint8Array([...box("jP  ", [0x0d, 0x0a, 0x87, 0x0a]), ...box("ftyp", [...enc("jp2 "), 0, 0, 0, 0, ...enc("jp2 ")]),
    ...box("jp2h", [...box("ihdr", [...be32(1), ...be32(1), 0, 1, 7, 7, 0, 0]), ...box("colr", [1, 0, 0, ...be32(17)])]),
    ...box("xml ", [...enc("<x>JP2SECRET</x>")]), ...box("jp2c", code)]);
}

/** A minimal EMF: its header record (with `description`, UTF-16, when given) and EOF, holding `inner` (raw bytes
 *  in a comment record) when given. */
export function emf(inner = new Uint8Array(0), description = "") {
  const pad = (inner.length + 3) & ~3;
  const rec = (type, body) => { const b = Buffer.alloc(8 + body.length); b.writeUInt32LE(type, 0); b.writeUInt32LE(8 + body.length, 4); Buffer.from(body).copy(b, 8); return b; };
  const desc = Buffer.from(description, "utf16le");
  const head = Buffer.alloc(80 + ((desc.length + 3) & ~3));
  head.write(" EMF", 32, "latin1");
  head.writeUInt32LE(0x10000, 36);
  if (desc.length) { head.writeUInt32LE(description.length, 52); head.writeUInt32LE(88, 56); desc.copy(head, 80); }
  const comment = Buffer.alloc(4 + pad); comment.writeUInt32LE(inner.length, 0); Buffer.from(inner).copy(comment, 4);
  const records = [rec(1, head), ...(inner.length ? [rec(70, comment)] : []), rec(14, Buffer.alloc(12))];
  const all = Buffer.concat(records);
  all.writeUInt32LE(all.length, 48);
  return new Uint8Array(all);
}

/** A JBIG2 segment: number, type, data (no referred-to segments, a one-byte page association). */
export const jbig2Segment = (num, type, data) => new Uint8Array([...be32(num), type, 0, 1, ...be32(data.length), ...data]);
/** An extension segment holding an ASCII comment. */
export const jbig2Comment = (num, text) => jbig2Segment(num, 62, [0x20, 0, 0, 0, ...enc(text), 0]);

// ---- PDFs ----

const content = (ops) => ({ dict: "<< >>", data: enc(ops) });
const imageObj = (bytes, extra = "") => ({ dict: `<< /Type /XObject /Subtype /Image /Width 8 /Height 8 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /DCTDecode ${extra} >>`, data: bytes });

/** A one-page PDF showing "Hello" and painting a JPEG with EXIF; `more` replaces or adds bodies from object 8. */
export function pdf({ catalog = "", page = "", trailer = "/Info 6 0 R", more = [], ops = "" } = {}) {
  return makePdf([
    `<< /Type /Catalog /Pages 2 0 R /Metadata 7 0 R ${catalog} >>`,
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 5 0 R >> /XObject << /Im1 8 0 R >> >> /Contents 4 0 R ${page} >>`,
    content(`BT /F1 12 Tf 20 150 Td (Hello) Tj ET q 40 0 0 40 20 20 cm /Im1 Do Q ${ops}`),
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Author (AUTHORSECRET) /Creator (APPSECRET) /CreationDate (D:20190304) >>",
    { dict: "<< /Type /Metadata /Subtype /XML >>", data: enc("<x:xmpmeta><dc:creator>AUTHORSECRET</dc:creator></x:xmpmeta>") },
    imageObj(jpeg(), "/Metadata 7 0 R"),
    ...more,
  ], { trailer });
}

/** The real answer doc-clean gives an encrypted file: a PDF whose trailer names an /Encrypt dictionary (a Standard
 *  security handler). Made by `cleanDocument` at call time, never stored (K4990, K4993): `{ok: false, code: "ENCRYPTED"}`. */
export const encryptedRefusal = () =>
  cleanDocument(pdf({ more: ["<< /Filter /Standard /V 2 /R 3 /O <00> /U <00> /P -4 >>"], trailer: "/Encrypt 9 0 R" }));

/** `base` with an incremental update appended: object 8 (the image) redefined, the old one left behind. */
export function incremental(base, newImage) {
  const s = latin(base);
  const prev = Number(/startxref\s+(\d+)/.exec(s.slice(s.lastIndexOf("startxref")))[1]);
  const head = Buffer.from(`8 0 obj\n<< /Type /XObject /Subtype /Image /Width 8 /Height 8 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /DCTDecode /Length ${newImage.length} >>\nstream\n`, "latin1");
  const obj = Buffer.concat([head, Buffer.from(newImage), Buffer.from("\nendstream\nendobj\n", "latin1")]);
  const at = base.length;
  const xref = `xref\n8 1\n${String(at).padStart(10, "0")} 00000 n \ntrailer\n<< /Size 9 /Root 1 0 R /Info 6 0 R /Prev ${prev} >>\nstartxref\n${at + obj.length}\n%%EOF\n`;
  return cat(base, obj, Buffer.from(xref, "latin1"));
}

/** Objects in a compressed object stream: `bodies` (dictionaries) numbered from `first`. */
export function objStm(first, bodies) {
  let head = "", body = "";
  bodies.forEach((b, i) => { head += `${first + i} ${body.length} `; body += b + "\n"; });
  const data = deflateSync(Buffer.from(head + body, "latin1"));
  return { dict: `<< /Type /ObjStm /N ${bodies.length} /First ${head.length} /Filter /FlateDecode >>`, data };
}

// ---- packages ----

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const CORE = `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Minutes</dc:title><dc:creator>AUTHORSECRET</dc:creator><cp:lastModifiedBy>EDITORSECRET</cp:lastModifiedBy><cp:revision>7</cp:revision><dcterms:created xsi:type="dcterms:W3CDTF">2019-03-04T00:00:00Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">2019-03-04T01:00:00Z</dcterms:modified></cp:coreProperties>`;
const APP = (app) => `${XML}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Template>TEMPLATESECRET.dotm</Template><TotalTime>42</TotalTime><Application>APPSECRET ${app}</Application><Company>COMPANYSECRET</Company><Manager>MANAGERSECRET</Manager><AppVersion>16.0000</AppVersion></Properties>`;
const CUSTOM = `${XML}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="Owner"><vt:lpwstr>CUSTOMSECRET</vt:lpwstr></property></Properties>`;
const RELS = (rels) => `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.map(([id, type, target, ext]) =>
  `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/${type}" Target="${target}"${ext ? ' TargetMode="External"' : ""}/>`).join("")}</Relationships>`;
const ROOT_RELS = (main, custom) => RELS([["rId1", "officeDocument/2006/relationships/officeDocument", main],
  ["rId2", "package/2006/relationships/metadata/core-properties", "docProps/core.xml"], ["rId3", "officeDocument/2006/relationships/extended-properties", "docProps/app.xml"],
  ...(custom ? [["rId4", "officeDocument/2006/relationships/custom-properties", "docProps/custom.xml"]] : [])]);
const TYPES = (overrides) => `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/>${
  [...overrides, ["/docProps/core.xml", "application/vnd.openxmlformats-package.core-properties+xml"], ["/docProps/app.xml", "application/vnd.openxmlformats-officedocument.extended-properties+xml"],
    ["/docProps/custom.xml", "application/vnd.openxmlformats-officedocument.custom-properties+xml"]].map(([p, t]) => `<Override PartName="${p}" ContentType="${t}"/>`).join("")}</Types>`;
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const DRAWING = 'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
const picture = (rid) => `<w:r><w:drawing><wp:inline><wp:extent cx="381000" cy="381000"/><wp:docPr id="1" name="Picture 1"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="p.jpeg"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="381000" cy="381000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;

const unnamed = (xml) => xml.replace(/ w:(author|initials)="[^"]*"/g, ' w:$1=""').replace(/ w:date="[^"]*"/g, "");

/** A .docx (`meta: false`, its parts carrying no metadata): two paragraphs (one with a tracked insertion and a deletion, one with a comment), a JPEG and a PNG
 *  with metadata, every metadata part R6 names, and `extra` entries appended. */
export function docx({ extra = [], images = true, meta = true } = {}) {
  const body = `${XML}<w:document ${W} ${DRAWING}><w:body><w:p><w:r><w:t xml:space="preserve">Budget item one </w:t></w:r><w:ins w:id="1" w:author="CHANGERSECRET" w:date="2019-03-04T00:00:00Z"><w:r><w:t>added</w:t></w:r></w:ins><w:del w:id="2" w:author="CHANGERSECRET" w:date="2019-03-04T00:00:00Z"><w:r><w:delText>removed</w:delText></w:r></w:del></w:p><w:p><w:commentRangeStart w:id="0"/><w:r><w:t>Second paragraph</w:t></w:r><w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r></w:p>${
    images ? `<w:p>${picture("rId2")}${picture("rId3")}</w:p>` : ""}</w:body></w:document>`;
  const comments = `${XML}<w:comments ${W}><w:comment w:id="0" w:author="COMMENTERSECRET" w:date="2019-03-04T00:00:00Z" w:initials="CS"><w:p><w:r><w:t>Check this figure</w:t></w:r></w:p></w:comment></w:comments>`;
  const docRels = RELS([["rId1", "officeDocument/2006/relationships/comments", "comments.xml"],
    ...(images ? [["rId2", "officeDocument/2006/relationships/image", "media/image1.jpeg"], ["rId3", "officeDocument/2006/relationships/image", "media/image2.png"]] : [])]);
  return makeZip([
    { name: "[Content_Types].xml", data: TYPES([["/word/document.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"], ["/word/comments.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"]]) },
    { name: "_rels/.rels", data: ROOT_RELS("word/document.xml", meta) },
    { name: "word/document.xml", data: meta ? body : unnamed(body) },
    { name: "word/_rels/document.xml.rels", data: docRels },
    { name: "word/comments.xml", data: meta ? comments : unnamed(comments) },
    ...(images ? [{ name: "word/media/image1.jpeg", data: jpeg({ meta }), method: 0 }, { name: "word/media/image2.png", data: png({ meta }) }] : []),
    { name: "docProps/core.xml", data: meta ? CORE : CORE.replace(/<dc:creator>.*<\/dcterms:modified>/, "") },
    { name: "docProps/app.xml", data: meta ? APP("Word") : `${XML}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Pages>1</Pages></Properties>` },
    ...(meta ? [{ name: "docProps/custom.xml", data: CUSTOM }] : []),
    ...extra,
  ]);
}

/** A .xlsx: one sheet with two text cells and a legacy comment by "COMMENTERSECRET", and a JPEG in xl/media. */
export function xlsx({ extra = [] } = {}) {
  const X = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  return makeZip([
    { name: "[Content_Types].xml", data: TYPES([["/xl/workbook.xml", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"], ["/xl/worksheets/sheet1.xml", "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"], ["/xl/comments1.xml", "application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml"]]) },
    { name: "_rels/.rels", data: ROOT_RELS("xl/workbook.xml", true) },
    { name: "xl/workbook.xml", data: `${XML}<workbook ${X} xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:x15ac="http://schemas.microsoft.com/office/spreadsheetml/2010/11/ac" mc:Ignorable="x15ac"><fileSharing userName="EDITORSECRET"/><mc:AlternateContent><mc:Choice Requires="x15"><x15ac:absPath url="C:\\Users\\PATHSECRET\\Documents\\"/></mc:Choice></mc:AlternateContent><sheets><sheet name="Budget" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", data: RELS([["rId1", "officeDocument/2006/relationships/worksheet", "worksheets/sheet1.xml"]]) },
    { name: "xl/worksheets/sheet1.xml", data: `${XML}<worksheet ${X}><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Line</t></is></c><c r="B1"><v>125</v></c></row></sheetData></worksheet>` },
    { name: "xl/worksheets/_rels/sheet1.xml.rels", data: RELS([["rId1", "officeDocument/2006/relationships/comments", "../comments1.xml"]]) },
    { name: "xl/comments1.xml", data: `${XML}<comments ${X}><authors><author>COMMENTERSECRET</author></authors><commentList><comment ref="A1" authorId="0"><text><r><rPr><b/><sz val="9"/></rPr><t>COMMENTERSECRET:</t></r><r><rPr><sz val="9"/></rPr><t xml:space="preserve">\nCheck the total</t></r></text></comment></commentList></comments>` },
    { name: "xl/media/image1.jpeg", data: jpeg() },
    { name: "docProps/core.xml", data: CORE },
    { name: "docProps/app.xml", data: APP("Excel") },
    { name: "docProps/custom.xml", data: CUSTOM },
    ...extra,
  ]);
}

/** A .pptx: one slide with a title and a picture, a comment by "COMMENTERSECRET". */
export function pptx() {
  const P = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
  const tree = (inner) => `<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${inner}</p:spTree></p:cSld>`;
  const title = '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="4000000" cy="800000"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:p><a:r><a:t>Council budget</a:t></a:r></a:p></p:txBody></p:sp>';
  const pic = '<p:pic><p:nvPicPr><p:cNvPr id="3" name="Picture"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="900000"/><a:ext cx="800000" cy="800000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>';
  const theme = `${XML}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="T"><a:themeElements><a:clrScheme name="C">${["dk1", "lt1", "dk2", "lt2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"].map((c) => `<a:${c}><a:srgbClr val="000000"/></a:${c}>`).join("")}</a:clrScheme><a:fontScheme name="F"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="S"><a:fillStyleLst>${'<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'.repeat(3)}</a:fillStyleLst><a:lnStyleLst>${'<a:ln><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>'.repeat(3)}</a:lnStyleLst><a:effectStyleLst>${"<a:effectStyle><a:effectLst/></a:effectStyle>".repeat(3)}</a:effectStyleLst><a:bgFillStyleLst>${'<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'.repeat(3)}</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;
  const ct = (p, t) => [p, `application/vnd.openxmlformats-officedocument.presentationml.${t}+xml`];
  return makeZip([
    { name: "[Content_Types].xml", data: TYPES([ct("/ppt/presentation.xml", "presentation.main"), ct("/ppt/slides/slide1.xml", "slide"), ct("/ppt/slideLayouts/slideLayout1.xml", "slideLayout"), ct("/ppt/slideMasters/slideMaster1.xml", "slideMaster"), ["/ppt/theme/theme1.xml", "application/vnd.openxmlformats-officedocument.theme+xml"], ct("/ppt/commentAuthors.xml", "commentAuthors"), ct("/ppt/comments/comment1.xml", "comments")]) },
    { name: "_rels/.rels", data: ROOT_RELS("ppt/presentation.xml", true) },
    { name: "ppt/presentation.xml", data: `${XML}<p:presentation ${P}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst><p:sldSz cx="9144000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>` },
    { name: "ppt/_rels/presentation.xml.rels", data: RELS([["rId1", "officeDocument/2006/relationships/slideMaster", "slideMasters/slideMaster1.xml"], ["rId2", "officeDocument/2006/relationships/slide", "slides/slide1.xml"], ["rId3", "officeDocument/2006/relationships/theme", "theme/theme1.xml"], ["rId4", "officeDocument/2006/relationships/commentAuthors", "commentAuthors.xml"]]) },
    { name: "ppt/slides/slide1.xml", data: `${XML}<p:sld ${P}>${tree(title + pic)}</p:sld>` },
    { name: "ppt/slides/_rels/slide1.xml.rels", data: RELS([["rId1", "officeDocument/2006/relationships/slideLayout", "../slideLayouts/slideLayout1.xml"], ["rId2", "officeDocument/2006/relationships/image", "../media/image1.jpeg"], ["rId3", "officeDocument/2006/relationships/comments", "../comments/comment1.xml"]]) },
    { name: "ppt/slideLayouts/slideLayout1.xml", data: `${XML}<p:sldLayout ${P}>${tree("")}</p:sldLayout>` },
    { name: "ppt/slideLayouts/_rels/slideLayout1.xml.rels", data: RELS([["rId1", "officeDocument/2006/relationships/slideMaster", "../slideMasters/slideMaster1.xml"]]) },
    { name: "ppt/slideMasters/slideMaster1.xml", data: `${XML}<p:sldMaster ${P}>${tree("")}<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>` },
    { name: "ppt/slideMasters/_rels/slideMaster1.xml.rels", data: RELS([["rId1", "officeDocument/2006/relationships/slideLayout", "../slideLayouts/slideLayout1.xml"], ["rId2", "officeDocument/2006/relationships/theme", "../theme/theme1.xml"]]) },
    { name: "ppt/theme/theme1.xml", data: theme },
    { name: "ppt/commentAuthors.xml", data: `${XML}<p:cmAuthorLst ${P}><p:cmAuthor id="1" name="COMMENTERSECRET" initials="CS" lastIdx="1" clrIdx="0"/></p:cmAuthorLst>` },
    { name: "ppt/comments/comment1.xml", data: `${XML}<p:cmLst ${P}><p:cm authorId="1" dt="2019-03-04T00:00:00.000" idx="1"><p:pos x="10" y="10"/><p:text>Check the slide</p:text></p:cm></p:cmLst>` },
    { name: "ppt/media/image1.jpeg", data: jpeg() },
    { name: "docProps/core.xml", data: CORE },
    { name: "docProps/app.xml", data: APP("PowerPoint") },
    { name: "docProps/custom.xml", data: CUSTOM },
  ]);
}

const ODF_NS = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:presentation="urn:oasis:names:tc:opendocument:xmlns:presentation:1.0" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.3"';
const ODF_META = `${XML}<office:document-meta ${ODF_NS}><office:meta><meta:initial-creator>AUTHORSECRET</meta:initial-creator><dc:creator>EDITORSECRET</dc:creator><meta:generator>APPSECRET/7.6</meta:generator><meta:template xlink:type="simple" xlink:href="TEMPLATESECRET.ott" xlink:title="TEMPLATESECRET"/><meta:creation-date>2019-03-04T00:00:00</meta:creation-date><dc:date>2019-03-04T01:00:00</dc:date><meta:editing-cycles>7</meta:editing-cycles><meta:editing-duration>PT42M</meta:editing-duration><meta:printed-by>EDITORSECRET</meta:printed-by><meta:user-defined meta:name="Owner">CUSTOMSECRET</meta:user-defined><dc:title>Minutes</dc:title><meta:document-statistic meta:paragraph-count="2"/></office:meta></office:document-meta>`;
const pic = (w = "1cm") => `<draw:frame draw:name="P" svg:width="${w}" svg:height="${w}"><draw:image xlink:href="Pictures/image1.jpg" xlink:type="simple"/></draw:frame>`;
const ODF_BODY = {
  odt: `<office:text><text:tracked-changes><text:changed-region text:id="c1"><text:insertion><office:change-info><dc:creator>CHANGERSECRET</dc:creator><dc:date>2019-03-04T00:00:00</dc:date></office:change-info></text:insertion></text:changed-region></text:tracked-changes><text:p>Budget item one <text:change-start text:change-id="c1"/>added<text:change-end text:change-id="c1"/></text:p><text:p><office:annotation><dc:creator>COMMENTERSECRET</dc:creator><dc:date>2019-03-04T00:00:00</dc:date><meta:creator-initials>CS</meta:creator-initials><text:p>Check this figure</text:p></office:annotation>Second paragraph</text:p><text:p>${pic()}</text:p></office:text>`,
  ods: `<office:spreadsheet><table:table table:name="Budget"><table:table-row><table:table-cell office:value-type="string"><office:annotation><dc:creator>COMMENTERSECRET</dc:creator><dc:date>2019-03-04T00:00:00</dc:date><text:p>Check the total</text:p></office:annotation><text:p>Line</text:p></table:table-cell><table:table-cell office:value-type="float" office:value="125"><text:p>125</text:p></table:table-cell></table:table-row></table:table></office:spreadsheet>`,
  odp: `<office:presentation><draw:page draw:name="page1"><draw:frame svg:width="10cm" svg:height="2cm" svg:x="1cm" svg:y="1cm"><draw:text-box><text:p>Council budget</text:p></draw:text-box></draw:frame>${pic("3cm")}<office:annotation><dc:creator>COMMENTERSECRET</dc:creator><dc:date>2019-03-04T00:00:00</dc:date><text:p>Check the slide</text:p></office:annotation></draw:page></office:presentation>`,
};
const MIME = { odt: "text", ods: "spreadsheet", odp: "presentation" };

/** An ODF package of `flavour` with every R6 field in meta.xml, an annotation (and in odt a tracked change), a JPEG
 *  in Pictures/ and a PNG thumbnail, each with metadata; `extra` entries and `manifest` lines appended. */
export function odf(flavour, { extra = [], manifest = "" } = {}) {
  const mime = `application/vnd.oasis.opendocument.${MIME[flavour]}`;
  const files = [["/", mime], ["content.xml", "text/xml"], ["styles.xml", "text/xml"], ["meta.xml", "text/xml"], ["Pictures/image1.jpg", "image/jpeg"], ["Thumbnails/thumbnail.png", "image/png"]];
  return makeZip([
    { name: "mimetype", data: mime, method: 0 },
    { name: "META-INF/manifest.xml", data: `${XML}<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">${files.map(([p, t]) => `<manifest:file-entry manifest:full-path="${p}" manifest:media-type="${t}"/>`).join("")}${manifest}</manifest:manifest>` },
    { name: "content.xml", data: `${XML}<office:document-content ${ODF_NS}><office:body>${ODF_BODY[flavour]}</office:body></office:document-content>` },
    { name: "styles.xml", data: `${XML}<office:document-styles ${ODF_NS}><office:styles/></office:document-styles>` },
    { name: "meta.xml", data: ODF_META },
    { name: "Pictures/image1.jpg", data: jpeg() },
    { name: "Thumbnails/thumbnail.png", data: png() },
    ...extra,
  ]);
}

/** Every part of a ZIP the module wrote, read by a walk of its own: `{name, method, flags, time, date, extra, data}`
 *  (data inflated), with the archive comment's length. */
export function unzipCopy(z) {
  const b = Buffer.from(z);
  const e = b.length - 22;
  if (b.readUInt32LE(e) !== 0x06054b50) throw new Error("no end record at the end");
  const n = b.readUInt16LE(e + 10);
  let c = b.readUInt32LE(e + 16);
  const parts = [];
  for (let i = 0; i < n; i++) {
    const nameLen = b.readUInt16LE(c + 28), extraLen = b.readUInt16LE(c + 30), commentLen = b.readUInt16LE(c + 32);
    const name = b.toString("utf8", c + 46, c + 46 + nameLen), at = b.readUInt32LE(c + 42);
    const method = b.readUInt16LE(at + 8), size = b.readUInt32LE(at + 18), lnl = b.readUInt16LE(at + 26), lel = b.readUInt16LE(at + 28);
    const raw = b.subarray(at + 30 + lnl + lel, at + 30 + lnl + lel + size);
    parts.push({ name, method, flags: b.readUInt16LE(at + 6), time: b.readUInt16LE(at + 10), date: b.readUInt16LE(at + 12),
      extra: lel + extraLen, comment: commentLen, data: new Uint8Array(method === 8 ? inflateRawSync(raw) : raw) });
    c += 46 + nameLen + extraLen + commentLen;
  }
  return { parts, comment: b.readUInt16LE(e + 20) };
}
