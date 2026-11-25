/* docgen: the seeded document generator (requirements/test-support.md R19, R22, R24; fix round 9, G123d;
 * envelope-docs 5.1). Not product code; importing it has no side effect.
 *
 * Every unit (a paragraph, a slide's text, a cell, a note) carries `<seed>-u<n>-k<part>` and a word from a vocabulary
 * with accents, ligatures, CJK, RTL and a combining mark, so it is checkable alone. Packages are written through the
 * shared ZIP writer (`zipChunks64`, lazily, or `makeZip` for an encrypted member); a large main part is streamed.
 *
 * Recipe: `{kind: "docx"|"pptx"|"odt"|"odp"|"html"|"text"|"json"|"xml", seed, size: {units = 6, chars, bytes,
 * partBytes}, parts: [footnote|endnote|header|footer|comment|deleted|textbox|notes|master|hidden, ...], table: {rows,
 * cols}, ladder: "one-cell-tables"|"empty-paragraphs"|"tiny-paragraphs"|"hyperlinks"|"nested-tables", flavour:
 * "template"|"macro", encryptedMember: <member name> (or true: the main part), declares: {member, more},
 * encoding: "utf-8"|"utf-8-bom"|"utf-16le-bom"|"utf-16be-bom"|"latin-1"|"windows-1252"|"bad-byte", charset:
 * "meta"|"xml"|"header"|"none", markup: {depth, unterminated}, main, clientRendered, bound}.
 * Truth: `{kind, units, unit(n), all(), parts, marks, unread, refusal, contentType, oracleOmits, hostile, size}`. */
import { zipChunks64, zipChunks64Sized, makeZip } from "./make-zip.mjs";
import { hash32, VOCAB, LATIN_VOCAB } from "./seeded.mjs";

export const KINDS = Object.freeze(["docx", "pptx", "odt", "odp", "html", "text", "json", "xml"]);
const PACKAGES = ["docx", "pptx", "odt", "odp"];
const PARTS = {
  docx: ["body", "table", "footnote", "endnote", "header", "footer", "comment", "deleted", "textbox"],
  odt: ["body", "table", "footnote", "endnote", "header", "footer", "comment", "deleted", "textbox"],
  pptx: ["body", "table", "notes", "master", "hidden", "textbox"],
  odp: ["body", "notes", "master", "hidden", "textbox"],
  html: ["body", "table", "header", "footer"], text: ["body"], json: ["body"], xml: ["body"],
};
const LADDERS = ["one-cell-tables", "empty-paragraphs", "tiny-paragraphs", "hyperlinks", "nested-tables"];
const ENCODINGS = ["utf-8", "utf-8-bom", "utf-16le-bom", "utf-16be-bom", "latin-1", "windows-1252", "bad-byte"];
const MIME = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text", odp: "application/vnd.oasis.opendocument.presentation",
  html: "text/html", text: "text/plain", json: "application/json", xml: "application/xml",
};
const EXT = { docx: { template: "dotx", macro: "docm" }, pptx: { template: "potx", macro: "pptm" }, odt: { template: "ott" }, odp: { template: "otp" } };
const CHARSET = { "utf-8": "utf-8", "utf-8-bom": "utf-8", "utf-16le-bom": "utf-16le", "utf-16be-bom": "utf-16be", "latin-1": "iso-8859-1", "windows-1252": "windows-1252", "bad-byte": "utf-8" };
/* The parts LibreOffice's text export (docx, odt) or PDF export (pptx, odp) leaves out: the reader reads them, so they are
   listed here rather than dropped from the truth (envelope-docs 5.1, the cases where the reader is stricter). */
const ORACLE_OMITS = {
  docx: ["header", "footer", "comment", "textbox", "footnote", "endnote"], odt: ["header", "footer", "comment", "textbox", "footnote", "endnote"],
  /* odp master: LibreOffice 24.2 drops a master page's own text frame on import (measured: a round trip through it loses
     the frame), though the frame is in styles.xml for a reader to read */
  pptx: ["notes", "hidden"], odp: ["notes", "hidden", "master"], html: [], text: [], json: [], xml: [],
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

/* ---- the plan: every unit, by part ---- */

function plan(recipe) {
  const kind = recipe.kind;
  if (!KINDS.includes(kind)) throw new Error(`docgen: kind must be one of ${KINDS.join(", ")}`);
  if (recipe.seed === undefined) throw new Error("docgen: recipe.seed is missing");
  const seed = String(recipe.seed), size = recipe.size ?? {};
  const parts = recipe.parts ?? [];
  for (const p of parts) if (!PARTS[kind].includes(p) || p === "body" || p === "table") throw new Error(`docgen: a ${kind} has no part ${p}`);
  if (recipe.table && !PARTS[kind].includes("table")) throw new Error(`docgen: a ${kind} has no table`);
  if (recipe.ladder && !LADDERS.includes(recipe.ladder)) throw new Error(`docgen: ladder must be one of ${LADDERS.join(", ")}`);
  if (recipe.ladder && !["docx", "odt", "html"].includes(kind)) throw new Error("docgen: a ladder is for docx, odt and html");
  if (recipe.ladder && size.partBytes === undefined) throw new Error("docgen: a ladder needs size.partBytes (its rungs are equal bytes)");
  if (recipe.flavour && !EXT[kind]?.[recipe.flavour]) throw new Error(`docgen: a ${kind} has no ${recipe.flavour} flavour`);
  const encoding = recipe.encoding ?? "utf-8";
  if (!ENCODINGS.includes(encoding)) throw new Error(`docgen: encoding must be one of ${ENCODINGS.join(", ")}`);
  if (encoding !== "utf-8" && PACKAGES.includes(kind)) throw new Error("docgen: encoding is for html, text, json and xml");
  const vocab = encoding === "latin-1" || encoding === "windows-1252" ? LATIN_VOCAB : VOCAB;
  const body = recipe.ladder === "empty-paragraphs" ? 2 : size.units ?? 6;
  return { kind, seed, size, parts, encoding, vocab, body, recipe };
}

/** Unit text: its id, then words to `chars` characters (at least one word). */
function unitText(pl, n, part) {
  const id = `${pl.seed}-u${n}-k${part}`;
  const words = [];
  let len = id.length;
  for (let k = 0; len < (pl.size.chars ?? 0) || k === 0; k++) {
    const w = pl.vocab[hash32(pl.seed, n, k) % pl.vocab.length];
    words.push(w);
    len += 1 + w.length;
  }
  let text = `${id} ${words.join(" ")}`;
  if (pl.size.chars && text.length > pl.size.chars) text = text.slice(0, Math.max(pl.size.chars, id.length + 2)).trimEnd();
  return { n, id, part, text };
}

/** The units in document order: body (n = 1..body), then table cells, then each extra part's one unit. */
function unitsOf(pl) {
  const extra = [];
  let n = pl.body;
  const t = pl.recipe.table;
  if (t) for (let r = 1; r <= t.rows; r++) for (let c = 1; c <= t.cols; c++) extra.push({ ...unitText(pl, ++n, "table"), row: r, col: c });
  for (const part of pl.parts) extra.push(unitText(pl, ++n, part));
  return { count: n, extra, unit: (k) => (k <= pl.body ? unitText(pl, k, "body") : extra[k - pl.body - 1]) };
}

/* ---- DOCX ---- */

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"';
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const wp = (t) => `<w:p><w:r><w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`;

function docxParts(pl, U) {
  const has = (p) => pl.parts.includes(p);
  const part = (p) => U.extra.find((u) => u.part === p);
  const files = [];
  const main = pl.recipe.flavour === "template" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml"
    : pl.recipe.flavour === "macro" ? "application/vnd.ms-word.document.macroEnabled.main+xml" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml";
  const ct = [`<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="${main}"/>`];
  const rels = [];
  const add = (name, type, rel, xml) => {
    ct.push(`<Override PartName="/word/${name}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${type}+xml"/>`);
    rels.push(`<Relationship Id="rId${rels.length + 1}" Type="${R}/${rel}" Target="${name}"/>`);
    files.push({ name: `word/${name}`, data: XML + xml });
    return `rId${rels.length}`;
  };
  const note = (tag, sep, u) => `<w:${tag}s ${W}><w:${tag} w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:${tag}><w:${tag} w:type="continuationSeparator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:${tag}><w:${tag} w:id="1">${wp(u.text)}</w:${tag}></w:${tag}s>`;
  if (has("footnote")) add("footnotes.xml", "footnotes", "footnotes", note("footnote", "", part("footnote")));
  if (has("endnote")) add("endnotes.xml", "endnotes", "endnotes", note("endnote", "", part("endnote")));
  if (has("comment")) add("comments.xml", "comments", "comments", `<w:comments ${W}><w:comment w:id="0" w:author="bio" w:date="2026-01-01T00:00:00Z" w:initials="b">${wp(part("comment").text)}</w:comment></w:comments>`);
  const hdr = has("header") ? add("header1.xml", "header", "header", `<w:hdr ${W}>${wp(part("header").text)}</w:hdr>`) : null;
  const ftr = has("footer") ? add("footer1.xml", "footer", "footer", `<w:ftr ${W}>${wp(part("footer").text)}</w:ftr>`) : null;
  if (pl.recipe.flavour === "macro") {
    ct.push('<Default Extension="bin" ContentType="application/vnd.ms-office.vbaProject"/>');
    rels.push(`<Relationship Id="rId${rels.length + 1}" Type="http://schemas.microsoft.com/office/2006/relationships/vbaProject" Target="vbaProject.bin"/>`);
    files.push({ name: "word/vbaProject.bin", data: new Uint8Array(512).fill(0xd0) });
  }
  const body = async function* () {
    yield `${XML}<w:document ${W}><w:body>`;
    yield* mainBody(pl, U, {
      p: (u) => wp(u.text),
      empty: "<w:p/>",
      link: (u) => `<w:p><w:hyperlink w:anchor="u${u.n}"><w:r><w:t xml:space="preserve">${esc(u.text)}</w:t></w:r></w:hyperlink></w:p>`,
      table: (rows) => `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr>${rows.map((r) => `<w:tr>${r.map((cell) => `<w:tc>${cell}</w:tc>`).join("")}</w:tr>`).join("")}</w:tbl>`,
      after: "<w:p/>",
    });
    let tail = "";
    if (has("footnote")) tail += '<w:p><w:r><w:footnoteReference w:id="1"/></w:r></w:p>';
    if (has("endnote")) tail += '<w:p><w:r><w:endnoteReference w:id="1"/></w:r></w:p>';
    if (has("comment")) tail += `<w:p><w:commentRangeStart w:id="0"/><w:r><w:t>${esc(pl.seed)}</w:t></w:r><w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r></w:p>`;
    if (has("deleted")) tail += `<w:p><w:del w:id="10" w:author="bio" w:date="2026-01-01T00:00:00Z"><w:r><w:delText xml:space="preserve">${esc(part("deleted").text)}</w:delText></w:r></w:del></w:p>`;
    if (has("textbox")) tail += `<w:p><w:r><w:pict><v:shape id="tb1" style="width:400pt;height:40pt" type="#_x0000_t202"><v:textbox><w:txbxContent>${wp(part("textbox").text)}</w:txbxContent></v:textbox></v:shape></w:pict></w:r></w:p>`;
    const sect = `<w:sectPr>${hdr ? `<w:headerReference w:type="default" r:id="${hdr}"/>` : ""}${ftr ? `<w:footerReference w:type="default" r:id="${ftr}"/>` : ""}</w:sectPr>`;
    yield `${tail}${sect}</w:body></w:document>`;
  };
  return [
    { name: "[Content_Types].xml", data: `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${ct.join("")}</Types>` },
    { name: "_rels/.rels", data: `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/officeDocument" Target="word/document.xml"/></Relationships>` },
    { name: "word/document.xml", chunks: body, main: true },
    { name: "word/_rels/document.xml.rels", data: `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join("")}</Relationships>` },
    ...files,
  ];
}

/** The main part's body, in chunks: the body units (or the ladder), then the table. `w` writes each shape. A ladder's
 *  part is padded to exactly `size.partBytes` by a comment (`w.comment`) at its end, so the rungs are equal bytes. */
async function* mainBody(pl, U, w) {
  let batch = "";
  const ladder = pl.recipe.ladder;
  for (let n = 1; n <= pl.body; n++) {
    const u = U.unit(n);
    if (ladder === "one-cell-tables") batch += w.table([[w.p(u)]]) + (w.after ?? "");
    else if (ladder === "hyperlinks") batch += w.link(u);
    else if (ladder === "nested-tables") batch += nest(w, n % 8 + 1, w.p(u));
    else batch += w.p(u);
    if (ladder === "empty-paragraphs" && n === 1) batch += w.empty.repeat(ladderCount(pl, w));
    if (batch.length > 1 << 18) { yield batch; batch = ""; }
  }
  const t = pl.recipe.table;
  if (t) {
    const rows = [];
    for (let r = 0; r < t.rows; r++) rows.push(Array.from({ length: t.cols }, (_, c) => w.p(U.extra[r * t.cols + c])));
    batch += w.table(rows) + (w.after ?? "");
  }
  yield batch;
}
const nest = (w, depth, inner) => (depth <= 0 ? inner : w.table([[nest(w, depth - 1, inner)]]));

/** A ladder's rung count: as many units as fit `partBytes` (counted from the shape), for every rung but the empty one,
 *  whose count is the empty paragraphs between its two units. */
function ladderCount(pl, w) {
  const each = Buffer.byteLength(w.empty);
  return Math.max(0, Math.floor((pl.size.partBytes - 4096) / each));
}

/* ---- ODT and ODP ---- */

const ODF_NS = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:presentation="urn:oasis:names:tc:opendocument:xmlns:presentation:1.0" xmlns:xlink="http://www.w3.org/1999/xlink"';
const tp = (t) => `<text:p>${esc(t)}</text:p>`;
const GRAPHIC = '<style:style style:name="gr1" style:family="graphic"><style:graphic-properties draw:fill="solid" fo:background-color="#ffffcc"/></style:style><style:style style:name="P1" style:family="paragraph"><style:paragraph-properties/></style:style>';

function odfPackage(pl, mime, content, styles, padded) {
  const mediaType = pl.recipe.flavour === "template" ? mime.replace(/text$/, "text-template").replace(/presentation$/, "presentation-template") : mime;
  return [
    { name: "mimetype", data: mediaType, method: 0, zip64: false },
    { name: "META-INF/manifest.xml", data: `${XML}<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3"><manifest:file-entry manifest:full-path="/" manifest:media-type="${mediaType}"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>${padded ? '<manifest:file-entry manifest:full-path="bio-pad.bin" manifest:media-type="application/octet-stream"/>' : ""}</manifest:manifest>` },
    { name: "styles.xml", data: styles },
    { name: "content.xml", chunks: content, main: true },
  ];
}

function odtParts(pl, U) {
  const has = (p) => pl.parts.includes(p), part = (p) => U.extra.find((u) => u.part === p);
  const content = async function* () {
    yield `${XML}<office:document-content ${ODF_NS} office:version="1.3"><office:automatic-styles>${GRAPHIC}</office:automatic-styles><office:body><office:text>`;
    if (has("deleted")) yield `<text:tracked-changes><text:changed-region text:id="ct1"><text:deletion><office:change-info><dc:creator>bio</dc:creator><dc:date>2026-01-01T00:00:00</dc:date></office:change-info>${tp(part("deleted").text)}</text:deletion></text:changed-region></text:tracked-changes>`;
    yield* mainBody(pl, U, {
      p: (u) => tp(u.text),
      empty: "<text:p/>",
      link: (u) => `<text:p><text:a xlink:type="simple" xlink:href="#u${u.n}">${esc(u.text)}</text:a></text:p>`,
      table: (rows) => `<table:table><table:table-column table:number-columns-repeated="${rows[0].length}"/>${rows.map((r) => `<table:table-row>${r.map((c) => `<table:table-cell office:value-type="string">${c}</table:table-cell>`).join("")}</table:table-row>`).join("")}</table:table>`,
    });
    let tail = "";
    if (has("footnote")) tail += `<text:p>${esc(pl.seed)}<text:note text:id="ftn1" text:note-class="footnote"><text:note-citation>1</text:note-citation><text:note-body>${tp(part("footnote").text)}</text:note-body></text:note></text:p>`;
    if (has("endnote")) tail += `<text:p>${esc(pl.seed)}<text:note text:id="edn1" text:note-class="endnote"><text:note-citation>i</text:note-citation><text:note-body>${tp(part("endnote").text)}</text:note-body></text:note></text:p>`;
    if (has("comment")) tail += `<text:p><office:annotation><dc:creator>bio</dc:creator><dc:date>2026-01-01T00:00:00</dc:date>${tp(part("comment").text)}</office:annotation>${esc(pl.seed)}</text:p>`;
    if (has("deleted")) tail += '<text:p><text:change text:change-id="ct1"/></text:p>';
    if (has("textbox")) tail += `<text:p><draw:frame draw:name="f1" draw:style-name="gr1" text:anchor-type="paragraph" svg:width="15cm" svg:height="2cm"><draw:text-box>${tp(part("textbox").text)}</draw:text-box></draw:frame></text:p>`;
    yield `${tail}</office:text></office:body></office:document-content>`;
  };
  const hf = (tag, p) => (has(p) ? `<style:${tag}>${tp(part(p).text)}</style:${tag}>` : "");
  const styles = `${XML}<office:document-styles ${ODF_NS} office:version="1.3"><office:automatic-styles><style:page-layout style:name="pm1"><style:page-layout-properties fo:page-width="21cm" fo:page-height="29.7cm"/><style:header-style/><style:footer-style/></style:page-layout></office:automatic-styles><office:master-styles><style:master-page style:name="Standard" style:page-layout-name="pm1">${hf("header", "header")}${hf("footer", "footer")}</style:master-page></office:master-styles></office:document-styles>`;
  return odfPackage(pl, MIME.odt, content, styles, pl.size.bytes !== undefined);
}

function odpParts(pl, U) {
  const has = (p) => pl.parts.includes(p), part = (p) => U.extra.find((u) => u.part === p);
  const frame = (t, y, cls = "") => `<draw:frame${cls} svg:width="24cm" svg:height="3cm" svg:x="2cm" svg:y="${y}cm"><draw:text-box>${tp(t)}</draw:text-box></draw:frame>`;
  const content = async function* () {
    yield `${XML}<office:document-content ${ODF_NS} office:version="1.3"><office:automatic-styles><style:style style:name="dp1" style:family="drawing-page"><style:drawing-page-properties presentation:visibility="hidden"/></style:style></office:automatic-styles><office:body><office:presentation>`;
    let batch = "";
    const page = (k, body, hidden = false, extra = "") => `<draw:page draw:name="p${k}" draw:master-page-name="Default"${hidden ? ' draw:style-name="dp1"' : ""}>${body}${extra}</draw:page>`;
    for (let n = 1; n <= pl.body; n++) {
      let extra = "";
      if (n === 1 && has("notes")) extra = `<presentation:notes>${frame(part("notes").text, 12, ' presentation:class="notes"')}</presentation:notes>`;
      const tb = n === 1 && has("textbox") ? frame(part("textbox").text, 8) : "";
      batch += page(n, frame(U.unit(n).text, 2) + tb, false, extra);
      if (batch.length > 1 << 18) { yield batch; batch = ""; }
    }
    if (has("hidden")) batch += page(pl.body + 1, frame(part("hidden").text, 2), true);
    yield `${batch}</office:presentation></office:body></office:document-content>`;
  };
  /* a master page's own object sits on the background-objects layer, where LibreOffice draws it on every slide */
  const master = has("master") ? frame(part("master").text, 17, ' draw:layer="backgroundobjects"') : "";
  const styles = `${XML}<office:document-styles ${ODF_NS} office:version="1.3"><office:automatic-styles><style:page-layout style:name="PM1"><style:page-layout-properties fo:page-width="28cm" fo:page-height="21cm"/></style:page-layout></office:automatic-styles><office:master-styles><style:master-page style:name="Default" style:page-layout-name="PM1">${master}</style:master-page></office:master-styles></office:document-styles>`;
  return odfPackage(pl, MIME.odp, content, styles, pl.size.bytes !== undefined);
}

/* ---- PPTX ---- */

const P = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const GROUP = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>';
/* A body shape is a plain shape; only an inserted text box carries `txBox="1"`, as PowerPoint writes them (K4997). */
const shape = (id, t, y = 457200, ph = "", box = false) => `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="t${id}"/><p:cNvSpPr${box ? ' txBox="1"' : ""}/><p:nvPr>${ph}</p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="${y}"/><a:ext cx="8229600" cy="900000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>${esc(t)}</a:t></a:r></a:p></p:txBody></p:sp>`;
const relsXml = (list) => `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list.map(([id, type, target]) => `<Relationship Id="${id}" Type="${type}" Target="${target}"/>`).join("")}</Relationships>`;
const THEME = `${XML}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="bio"><a:themeElements><a:clrScheme name="bio"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F497D"/></a:dk2><a:lt2><a:srgbClr val="EEECE1"/></a:lt2><a:accent1><a:srgbClr val="4F81BD"/></a:accent1><a:accent2><a:srgbClr val="C0504D"/></a:accent2><a:accent3><a:srgbClr val="9BBB59"/></a:accent3><a:accent4><a:srgbClr val="8064A2"/></a:accent4><a:accent5><a:srgbClr val="4BACC6"/></a:accent5><a:accent6><a:srgbClr val="F79646"/></a:accent6><a:hlink><a:srgbClr val="0000FF"/></a:hlink><a:folHlink><a:srgbClr val="800080"/></a:folHlink></a:clrScheme><a:fontScheme name="bio"><a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="bio"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;

function pptxParts(pl, U) {
  const has = (p) => pl.parts.includes(p), part = (p) => U.extra.find((u) => u.part === p);
  const PR = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const slides = pl.body + (has("hidden") ? 1 : 0);
  const main = pl.recipe.flavour === "template" ? "application/vnd.openxmlformats-officedocument.presentationml.template.main+xml"
    : pl.recipe.flavour === "macro" ? "application/vnd.ms-powerpoint.presentation.macroEnabled.main+xml" : "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml";
  const pml = (t) => `application/vnd.openxmlformats-officedocument.presentationml.${t}+xml`;
  const ct = [`<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="${main}"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="${pml("slideMaster")}"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="${pml("slideLayout")}"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>`];
  const files = [];
  for (let k = 1; k <= slides; k++) ct.push(`<Override PartName="/ppt/slides/slide${k}.xml" ContentType="${pml("slide")}"/>`);
  if (has("notes")) ct.push(`<Override PartName="/ppt/notesSlides/notesSlide1.xml" ContentType="${pml("notesSlide")}"/>`);
  const presRels = [["rId1", `${PR}/slideMaster`, "slideMasters/slideMaster1.xml"], ["rId2", `${PR}/theme`, "theme/theme1.xml"]];
  for (let k = 1; k <= slides; k++) presRels.push([`rId${k + 2}`, `${PR}/slide`, `slides/slide${k}.xml`]);
  if (pl.recipe.flavour === "macro") {
    ct.push('<Default Extension="bin" ContentType="application/vnd.ms-office.vbaProject"/>');
    presRels.push([`rId${slides + 3}`, "http://schemas.microsoft.com/office/2006/relationships/vbaProject", "vbaProject.bin"]);
    files.push({ name: "ppt/vbaProject.bin", data: new Uint8Array(512).fill(0xd0) });
  }
  const slideXml = (t, extra = "", hidden = false) => `${XML}<p:sld ${P}${hidden ? ' show="0"' : ""}><p:cSld><p:spTree>${GROUP}${shape(2, t)}${extra}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
  const tableXml = () => {
    const t = pl.recipe.table;
    if (!t) return "";
    let rows = "";
    for (let r = 0; r < t.rows; r++) rows += `<a:tr h="370840">${Array.from({ length: t.cols }, (_, c) => `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${esc(U.extra[r * t.cols + c].text)}</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>`).join("")}</a:tr>`;
    return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="4" name="tbl"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="457200" y="2500000"/><a:ext cx="8229600" cy="${370840 * t.rows}"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr/><a:tblGrid>${`<a:gridCol w="${Math.floor(8229600 / t.cols)}"/>`.repeat(t.cols)}</a:tblGrid>${rows}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
  };
  for (let k = 1; k <= pl.body; k++) {
    const extra = (k === 1 && has("textbox") ? shape(3, part("textbox").text, 1500000, "", true) : "") + (k === 1 ? tableXml() : "");
    files.push({ name: `ppt/slides/slide${k}.xml`, data: slideXml(U.unit(k).text, extra) });
    const r = [["rId1", `${PR}/slideLayout`, "../slideLayouts/slideLayout1.xml"]];
    if (k === 1 && has("notes")) r.push(["rId2", `${PR}/notesSlide`, "../notesSlides/notesSlide1.xml"]);
    files.push({ name: `ppt/slides/_rels/slide${k}.xml.rels`, data: relsXml(r) });
  }
  if (has("hidden")) {
    files.push({ name: `ppt/slides/slide${slides}.xml`, data: slideXml(part("hidden").text, "", true) });
    files.push({ name: `ppt/slides/_rels/slide${slides}.xml.rels`, data: relsXml([["rId1", `${PR}/slideLayout`, "../slideLayouts/slideLayout1.xml"]]) });
  }
  if (has("notes")) {
    files.push({ name: "ppt/notesSlides/notesSlide1.xml", data: `${XML}<p:notes ${P}><p:cSld><p:spTree>${GROUP}${shape(2, part("notes").text, 457200, '<p:ph type="body" idx="1"/>')}</p:spTree></p:cSld></p:notes>` });
    files.push({ name: "ppt/notesSlides/_rels/notesSlide1.xml.rels", data: relsXml([["rId1", `${PR}/slide`, "../slides/slide1.xml"]]) });
  }
  const master = has("master") ? shape(2, part("master").text, 6000000) : "";
  return [
    { name: "[Content_Types].xml", data: `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${ct.join("")}</Types>` },
    { name: "_rels/.rels", data: relsXml([["rId1", `${PR}/officeDocument`, "ppt/presentation.xml"]]) },
    { name: "ppt/presentation.xml", data: `${XML}<p:presentation ${P}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${Array.from({ length: slides }, (_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 3}"/>`).join("")}</p:sldIdLst><p:sldSz cx="9144000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`, main: true },
    { name: "ppt/_rels/presentation.xml.rels", data: relsXml(presRels) },
    { name: "ppt/slideMasters/slideMaster1.xml", data: `${XML}<p:sldMaster ${P}><p:cSld><p:spTree>${GROUP}${master}</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>` },
    { name: "ppt/slideMasters/_rels/slideMaster1.xml.rels", data: relsXml([["rId1", `${PR}/slideLayout`, "../slideLayouts/slideLayout1.xml"], ["rId2", `${PR}/theme`, "../theme/theme1.xml"]]) },
    { name: "ppt/slideLayouts/slideLayout1.xml", data: `${XML}<p:sldLayout ${P}><p:cSld><p:spTree>${GROUP}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>` },
    { name: "ppt/slideLayouts/_rels/slideLayout1.xml.rels", data: relsXml([["rId1", `${PR}/slideMaster`, "../slideMasters/slideMaster1.xml"]]) },
    { name: "ppt/theme/theme1.xml", data: THEME },
    ...files,
  ];
}

/* ---- HTML, text, JSON, XML ---- */

function encoderOf(encoding) {
  const utf8 = new TextEncoder();
  if (encoding === "utf-8" || encoding === "bad-byte") return { bom: new Uint8Array(0), enc: (s) => utf8.encode(s), unit: 1 };
  if (encoding === "utf-8-bom") return { bom: Uint8Array.of(0xef, 0xbb, 0xbf), enc: (s) => utf8.encode(s), unit: 1 };
  if (encoding.startsWith("utf-16")) {
    const be = encoding === "utf-16be-bom";
    return {
      bom: be ? Uint8Array.of(0xfe, 0xff) : Uint8Array.of(0xff, 0xfe), unit: 2,
      enc: (s) => { const o = new Uint8Array(s.length * 2); for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); o[2 * i + (be ? 0 : 1)] = c >> 8; o[2 * i + (be ? 1 : 0)] = c & 255; } return o; },
    };
  }
  return { bom: new Uint8Array(0), unit: 1, enc: (s) => Uint8Array.from(s, (ch) => { const c = ch === "œ" && encoding === "windows-1252" ? 0x9c : ch.charCodeAt(0); if (c > 0xff) throw new Error(`docgen: ${encoding} cannot write ${JSON.stringify(ch)}`); return c; }) };
}

/** The bad byte: one 0xFF written into the middle body unit, after its id (`badByte` in the truth). */
const badUnit = (pl) => Math.ceil(pl.body / 2);

function* textChunks(pl, U) {
  const k = pl.kind, depth = pl.recipe.markup?.depth ?? 0, open = !!pl.recipe.markup?.unterminated;
  const cs = pl.recipe.charset ?? (k === "html" ? "meta" : k === "xml" ? "xml" : "none");
  const name = CHARSET[pl.encoding];
  let batch = [];
  const flush = function* () { if (batch.length) { yield batch.join(""); batch = []; } };
  if (k === "html") {
    const meta = cs === "meta" ? `<meta charset="${name}">` : "";
    yield `<!DOCTYPE html><html><head>${meta}<title>${esc(pl.seed)}</title></head><body>`;
    if (pl.parts.includes("header")) yield `<header><p>${esc(U.extra.find((u) => u.part === "header").text)}</p></header>`;
    if (pl.recipe.clientRendered) {
      const texts = [];
      for (let n = 1; n <= pl.body; n++) texts.push(U.unit(n).text);
      yield `<div id="app"></div><script>document.getElementById("app").innerHTML=${JSON.stringify(texts).replace(/</g, "\\u003c")}.map(function(t){var p=document.createElement("p");p.textContent=t;return p.outerHTML}).join("");</script>`;
    } else {
      if (pl.recipe.main) yield "<main>";
      const html = { p: (u) => `${"<div>".repeat(depth)}<p>${esc(u.text)}${open ? "" : "</p>"}${open ? "" : "</div>".repeat(depth)}`, empty: "<p></p>", link: (u) => `<p><a href="#u${u.n}">${esc(u.text)}</a></p>`, table: (rows) => `<table>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</table>` };
      yield* syncBody(pl, U, html);
      if (pl.recipe.main) yield "</main>";
    }
    if (pl.parts.includes("footer")) yield `<footer><p>${esc(U.extra.find((u) => u.part === "footer").text)}</p></footer>`;
    yield "</body></html>";
    return;
  }
  if (k === "xml") yield `${cs === "xml" ? `<?xml version="1.0" encoding="${name}"?>\n` : ""}<doc>`;
  if (k === "json") yield '{"units":[';
  for (let n = 1; n <= pl.body; n++) {
    const t = U.unit(n).text;
    if (k === "text") batch.push(`${t}\n`);
    else if (k === "json") batch.push(`${n > 1 ? "," : ""}${JSON.stringify({ id: U.unit(n).id, text: t })}`);
    else batch.push(`${"<div>".repeat(depth)}<unit n="${n}">${esc(t)}${open ? "" : "</unit>"}${"</div>".repeat(depth)}`);
    if (batch.length >= 4096) yield* flush();
  }
  yield* flush();
  if (k === "json") yield "]}";
  if (k === "xml") yield "</doc>";
}

function* syncBody(pl, U, w) {
  /* mainBody without the async: the same shapes */
  const ladder = pl.recipe.ladder;
  let batch = "";
  for (let n = 1; n <= pl.body; n++) {
    const u = U.unit(n);
    if (ladder === "one-cell-tables") batch += w.table([[w.p(u)]]);
    else if (ladder === "hyperlinks") batch += w.link(u);
    else if (ladder === "nested-tables") batch += nest(w, n % 8 + 1, w.p(u));
    else batch += w.p(u);
    if (ladder === "empty-paragraphs" && n === 1) batch += w.empty.repeat(ladderCount(pl, w));
    if (batch.length > 1 << 18) { yield batch; batch = ""; }
  }
  const t = pl.recipe.table;
  if (t) {
    const rows = [];
    for (let r = 0; r < t.rows; r++) rows.push(Array.from({ length: t.cols }, (_, c) => w.p(U.extra[r * t.cols + c])));
    batch += w.table(rows);
  }
  yield batch;
}

/* ---- the file ---- */

/** A main part's chunks, the ladder's part padded to exactly `size.partBytes` with a trailing comment before its last
 *  closing tag, so a ladder's rungs are equal bytes. */
async function* sizedPart(chunks, pl, comment) {
  const target = pl.size.partBytes;
  if (target === undefined) { yield* chunks(); return; }
  const enc = new TextEncoder();
  let n = 0;
  const all = [];
  for await (const c of chunks()) { all.push(c); n += enc.encode(c).length; }
  const last = all.pop();
  const close = last.slice(last.lastIndexOf("</"));
  const before = last.slice(0, last.length - close.length);
  const fill = target - n - comment("").length;
  if (fill < 0) throw new Error(`docgen: the part is ${n} bytes, over size.partBytes ${target}`);
  yield* all;
  yield before + comment(" ".repeat(fill)) + close;
}

function packageEntries(pl, U) {
  const entries = pl.kind === "docx" ? docxParts(pl, U) : pl.kind === "pptx" ? pptxParts(pl, U) : pl.kind === "odt" ? odtParts(pl, U) : odpParts(pl, U);
  const enc = new TextEncoder();
  return entries.map((e) => {
    if (!e.chunks) return e;
    const src = e.chunks;
    return { ...e, chunks: async function* () { for await (const c of sizedPart(src, pl, (f) => `<!--${f}-->`)) yield enc.encode(c); } };
  });
}

function hostileOf(pl, entries) {
  const mainName = entries.find((e) => e.main).name;
  const em = pl.recipe.encryptedMember === true ? mainName : pl.recipe.encryptedMember;
  if (em && !entries.some((e) => e.name === em)) throw new Error(`docgen: encryptedMember ${em} is not a member`);
  const d = pl.recipe.declares;
  if (d && !entries.some((e) => e.name === d.member)) throw new Error(`docgen: declares.member ${d.member} is not a member`);
  return { mainName, encrypted: em ?? null, declares: d ?? null };
}

async function* packageChunks(pl, U) {
  const entries = packageEntries(pl, U);
  const h = hostileOf(pl, entries);
  if (h.encrypted) {
    /* an encrypted member: the whole archive through makeZip, which writes the flag (the data is not encrypted, R12) */
    const list = [];
    for (const e of entries) {
      let data = e.data;
      if (e.chunks) { const parts = []; for await (const c of e.chunks()) parts.push(c); data = Buffer.concat(parts); }
      list.push({ name: e.name, data, method: e.method ?? 8, ...(e.name === h.encrypted ? { encrypted: "traditional" } : {}) });
    }
    yield makeZip(list);
    return;
  }
  const list = entries.map((e) => (h.declares && e.name === h.declares.member ? { ...e, central: { uncompressedSize: declaredSize(e, h.declares) } } : e));
  if (pl.size.bytes !== undefined) yield* zipChunks64Sized(list, pl.size.bytes, { member: pl.kind === "odt" || pl.kind === "odp" });
  else yield* zipChunks64(list);
}

function declaredSize(e, d) {
  if (e.data === undefined) throw new Error("docgen: declares.member must be a member written whole");
  return (typeof e.data === "string" ? Buffer.byteLength(e.data) : e.data.length) + d.more;
}

async function* plainChunks(pl, U) {
  const E = encoderOf(pl.encoding);
  if (E.bom.length) yield E.bom;
  let n = E.bom.length;
  const bad = pl.encoding === "bad-byte" ? U.unit(badUnit(pl)).id : null;
  for (const c of textChunks(pl, U)) {
    let b = E.enc(c);
    /* after the id where the unit's text has it (the id then a space: in JSON the id field comes first, unspaced) */
    if (bad && c.includes(`${bad} `)) {
      const at = Buffer.from(b).indexOf(Buffer.from(`${bad} `)) + Buffer.byteLength(bad);
      b = Buffer.concat([b.subarray(0, at), Buffer.of(0xff), b.subarray(at)]);
    }
    n += b.length;
    yield b;
  }
  if (pl.size.bytes !== undefined) {
    const left = pl.size.bytes - n;
    if (left < 0 || left % E.unit) throw new Error(`docgen: the file is ${n} bytes, size.bytes ${pl.size.bytes} cannot be reached`);
    for (let i = 0; i < left; i += 1 << 20) yield E.enc(" ".repeat(Math.min(1 << 20, left - i) / E.unit));
  }
}

function truthFrom(pl, U, size) {
  const unread = [];
  let refusal = null, hostile = null;
  if (PACKAGES.includes(pl.kind)) {
    const names = { docx: "word/document.xml", pptx: "ppt/presentation.xml", odt: "content.xml", odp: "content.xml" };
    const em = pl.recipe.encryptedMember === true ? names[pl.kind] : pl.recipe.encryptedMember;
    if (em) {
      hostile = { encryptedMember: em };
      if (em === names[pl.kind]) refusal = { code: "ENCRYPTED" };
      else for (const u of U.extra) if (memberOf(pl.kind, u.part) === em) unread.push({ n: u.n, reason: "ENCRYPTED" });
    }
    if (pl.recipe.declares) hostile = { ...hostile, declares: pl.recipe.declares };
  }
  if (pl.recipe.markup?.unterminated && pl.kind === "xml") refusal = { code: "MALFORMED" };
  if (pl.recipe.bound && size > pl.recipe.bound) refusal = { code: "TOO_LARGE", size, bound: pl.recipe.bound };
  const bodyMarks = { first: U.unit(1).id, middle: U.unit(Math.ceil(pl.body / 2)).id, last: U.unit(pl.body).id };
  const byPart = {};
  for (let n = 1; n <= U.count; n++) (byPart[U.unit(n).part] ??= []).push(n);
  return {
    kind: pl.kind, recipe: pl.recipe, units: U.count, unit: U.unit,
    *all() { for (let n = 1; n <= U.count; n++) yield U.unit(n); },
    parts: byPart, marks: bodyMarks, unread, refusal, hostile,
    contentType: PACKAGES.includes(pl.kind) ? MIME[pl.kind] : `${MIME[pl.kind]}${(pl.recipe.charset ?? "") === "header" || pl.kind === "text" ? `; charset=${CHARSET[pl.encoding]}` : ""}`,
    encoding: PACKAGES.includes(pl.kind) ? null : pl.encoding,
    badByte: pl.encoding === "bad-byte" ? { n: badUnit(pl), after: U.unit(badUnit(pl)).id } : null,
    clientRendered: !!pl.recipe.clientRendered,
    oracleOmits: ORACLE_OMITS[pl.kind], ext: extOf(pl), size: size ?? null,
  };
}

const memberOf = (kind, part) => ({
  docx: { footnote: "word/footnotes.xml", endnote: "word/endnotes.xml", comment: "word/comments.xml", header: "word/header1.xml", footer: "word/footer1.xml" },
  odt: { header: "styles.xml", footer: "styles.xml" }, odp: { master: "styles.xml" },
  pptx: { notes: "ppt/notesSlides/notesSlide1.xml", master: "ppt/slideMasters/slideMaster1.xml" },
}[kind]?.[part]);

const extOf = (pl) => (pl.recipe.flavour ? EXT[pl.kind][pl.recipe.flavour] : { text: "txt" }[pl.kind] ?? pl.kind);

/** The document of a recipe (R19, R22): `{kind, ext, type, size, truth, chunks(), bytes()}`; `size` is null for a
 *  package whose size is not named (known once streamed). */
export function generate(recipe) {
  const pl = plan(recipe), U = unitsOf(pl);
  const size = pl.size.bytes ?? null;
  const truth = truthFrom(pl, U, size);
  const chunks = () => (PACKAGES.includes(pl.kind) ? packageChunks(pl, U) : plainChunks(pl, U));
  return {
    kind: pl.kind, ext: extOf(pl), type: truth.contentType, size, truth, chunks,
    bytes: async () => { const parts = []; for await (const c of chunks()) parts.push(c); return new Uint8Array(Buffer.concat(parts)); },
  };
}

/** The truth of a recipe without building its file (R24). */
export function truthOf(recipe) {
  const pl = plan(recipe);
  return truthFrom(pl, unitsOf(pl), pl.size.bytes ?? null);
}
