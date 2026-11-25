/* sheetgen: the seeded spreadsheet generator (requirements/test-support.md R19, R21, R24; fix round 9, G123d, G123e;
 * envelope-sheets 5.1). Not product code; importing it has no side effect.
 *
 * A cell is a pure function of (seed, sheet, row, column), so a 1,048,576-row truth is computed, never stored, and
 * the file is written as a lazy stream (a CSV or TSV a batch of rows at a time; an XLSX or ODS through
 * `zipChunks64`). The marks `<seed>-R<row>-C<col>` sit in a non-header cell of the first data row, a middle data row
 * and the last data row (G123e: a mark in the header row is in every unit of an index that repeats the header, so it
 * proves nothing). Every text cell carries `r<data row>c<col>`, so each data row is recognisable in any unit.
 *
 * Recipe: `{kind: "csv"|"tsv"|"xlsx"|"ods", seed, size: {rows = 20, cols = 6, bytes}, header: "one"|"none"|"title"|
 * {chars: n}, types: [text|integer|decimal|percent|currency|date|formula, ...] (by column, cycled), encoding:
 * "utf-8"|"utf-8-bom"|"utf-16le"|"utf-16be"|"utf-16le-bom"|"utf-16be-bom"|"windows-1252", eol: "crlf"|"lf"|"cr",
 * delimiter, quoting: [doubled|newline|tab|stray], empties: {leading, middle, last, row: every n, column: c},
 * ragged, long: {row, col, chars}, merged, annotations, strings: "shared"|"inline", sheets, hostile: "bomb"|
 * "lying-directory"|"lying-dimension"|"no-r"|"styled-empty", bound}. A cell's truth is `{type, value, text}`. */
import { zipChunks64, zipChunks64Sized } from "./make-zip.mjs";
import { hash32, VOCAB, LATIN_VOCAB } from "./seeded.mjs";

export const KINDS = Object.freeze(["csv", "tsv", "xlsx", "ods"]);
const TYPES = { csv: "text/csv", tsv: "text/tab-separated-values", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ods: "application/vnd.oasis.opendocument.spreadsheet" };
const CELL_TYPES = ["text", "integer", "decimal", "percent", "currency", "date", "formula"];
const ENCODINGS = ["utf-8", "utf-8-bom", "utf-16le", "utf-16be", "utf-16le-bom", "utf-16be-bom", "windows-1252"];
const EOL = { crlf: "\r\n", lf: "\n", cr: "\r" };
const DAY0 = Date.UTC(2015, 0, 1), EXCEL_EPOCH = Date.UTC(1899, 11, 30);

/** The column name of 1-based column `c` (A, Z, AA, XFD, XFE). */
export function colName(c) {
  let s = "";
  for (let n = c; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/* ---- the plan and the cells ---- */

function plan(recipe) {
  if (!KINDS.includes(recipe.kind)) throw new Error(`sheetgen: kind must be one of ${KINDS.join(", ")}`);
  if (recipe.seed === undefined) throw new Error("sheetgen: recipe.seed is missing");
  const seed = String(recipe.seed), size = recipe.size ?? {}, cols = size.cols ?? 6;
  if (!Number.isInteger(cols) || cols < 1) throw new Error("sheetgen: size.cols must be a positive integer");
  const types = recipe.types ?? ["text", "integer", "decimal", "text", "date", "currency", "percent"];
  for (const t of types) if (!CELL_TYPES.includes(t)) throw new Error(`sheetgen: types has ${t}`);
  const encoding = recipe.encoding ?? "utf-8";
  if (!ENCODINGS.includes(encoding)) throw new Error(`sheetgen: encoding must be one of ${ENCODINGS.join(", ")}`);
  if (encoding !== "utf-8" && !["csv", "tsv"].includes(recipe.kind)) throw new Error("sheetgen: encoding is for csv and tsv");
  const eol = EOL[recipe.eol ?? "crlf"];
  if (!eol) throw new Error("sheetgen: eol must be crlf, lf or cr");
  const header = recipe.header ?? "one";
  const headerRows = header === "none" ? 0 : header === "title" ? 3 : 1;
  const empties = recipe.empties ?? {};
  const emptyCols = new Set([empties.leading && 1, empties.middle && Math.ceil(cols / 2), empties.last && cols, empties.column].filter(Boolean));
  let markCol = 0;
  for (let c = 1; c <= cols; c++) if (types[(c - 1) % types.length] === "text" && !emptyCols.has(c)) { markCol = c; break; }
  if (!markCol) throw new Error("sheetgen: the marks need a text column that is not emptied");
  if (recipe.merged && header !== "title") throw new Error("sheetgen: merged needs header title (the title row is merged)");
  const xlsxOnly = ["no-r", "styled-empty", "lying-dimension"];
  if (recipe.hostile && xlsxOnly.includes(recipe.hostile) && recipe.kind !== "xlsx") throw new Error(`sheetgen: hostile ${recipe.hostile} is for xlsx`);
  const vocab = encoding === "windows-1252" ? LATIN_VOCAB : VOCAB;
  return {
    kind: recipe.kind, seed, size, cols, types, encoding, eol, header, headerRows, empties, emptyCols, markCol, vocab,
    delimiter: recipe.delimiter ?? (recipe.kind === "tsv" ? "\t" : ","), quoting: new Set(recipe.quoting ?? []),
    sheets: recipe.sheets ?? 1, hostile: recipe.hostile ?? null, recipe,
  };
}

const money = (cents) => `$${String(Math.floor(cents / 100)).replace(/\B(?=(\d{3})+$)/g, ",")}.${String(cents % 100).padStart(2, "0")}`;
const isoDay = (days) => new Date(DAY0 + days * 86400000).toISOString().slice(0, 10);

/** The cell at data row `d`, column `c`, sheet `s` of a plan with `rows` data rows: `{type, value, text}` or null (empty). */
function cellOf(p, rows, d, c, s = 1) {
  if (c > rowLength(p, rows, d)) return null;
  const mark = markAt(p, rows, d, c, s);
  if (mark) return { type: "text", value: mark, text: mark, mark: true };
  if (p.emptyCols.has(c) || isEmptyRow(p, rows, d)) return null;
  /* a deflate bomb: every other cell the same 1,000 bytes, so the sheet unpacks hundreds of times its file */
  if (p.hostile === "bomb") { const t = "a".repeat(1000); return { type: "text", value: t, text: t }; }
  const type = p.types[(c - 1) % p.types.length];
  const h = hash32(p.seed, s, d, c);
  const L = p.recipe.long;
  if (L && L.row === d && L.col === c) {
    const w = p.vocab[h % p.vocab.length];
    const text = w.repeat(Math.ceil(L.chars / w.length)).slice(0, L.chars);
    return { type: "text", value: text, text };
  }
  switch (type) {
    case "text": {
      const w = p.vocab[h % p.vocab.length], tag = `r${d}c${c}`;
      let text = `${w}-${tag}`;
      const q = d % 5;
      if (p.quoting.has("doubled") && q === 1) text = `${w} "${tag}"`;
      else if (p.quoting.has("newline") && q === 2) text = `${w}\n${tag}`;
      else if (p.quoting.has("tab") && q === 3) text = `${w}\t${tag}`;
      else if (p.quoting.has("stray") && q === 4) text = `${w}"${tag}`;
      return { type, value: text, text, stray: p.quoting.has("stray") && q === 4 };
    }
    case "integer": { const v = h % 100000; return { type, value: v, text: String(v) }; }
    case "decimal": { const v = (h % 1000000) / 100; return { type, value: v, text: v.toFixed(2) }; }
    case "percent": { const v = (h % 10000) / 10000; return { type, value: v, text: `${(v * 100).toFixed(2)}%` }; }
    case "currency": { const cents = h % 100000000; return { type, value: cents / 100, text: money(cents) }; }
    case "date": { const days = h % 3650; return { type, value: isoDay(days), serial: Math.round((DAY0 - EXCEL_EPOCH) / 86400000) + days, text: isoDay(days) }; }
    case "formula": { const v = (p.headerRows + d) * 2; return { type, value: v, text: String(v), formula: "ROW()*2" }; }
  }
  return null;
}

/* the three mark rows of a sheet of `rows` rows; asked for every cell, so the last answer is kept */
let lastMarks = { rows: -1, list: [] };
function markRows(rows) {
  if (lastMarks.rows !== rows) lastMarks = { rows, list: [...new Set([1, Math.ceil(rows / 2), rows])] };
  return lastMarks.list;
}
function markAt(p, rows, d, c, s) {
  if (c !== p.markCol || !markRows(rows).includes(d)) return null;
  return `${p.seed}${s > 1 ? `-S${s}` : ""}-R${p.headerRows + d}-C${c}`;
}
const isEmptyRow = (p, rows, d) => !!p.empties.row && d % p.empties.row === 0 && !markRows(rows).includes(d);
function rowLength(p, rows, d) {
  if (!p.recipe.ragged || markRows(rows).includes(d)) return p.cols;
  return Math.max(p.markCol, p.cols - (hash32(p.seed, "ragged", d) % 3));
}

/** The header rows' cells (file rows 1..headerRows), as text. */
function headerOf(p) {
  if (p.header === "none") return [];
  const names = Array.from({ length: p.cols }, (_, i) => {
    const name = `${p.vocab[hash32(p.seed, "h", i + 1) % p.vocab.length]}_${i + 1}`;
    return typeof p.header === "object" && p.header.chars ? name.padEnd(p.header.chars, "_").slice(0, Math.max(p.header.chars, 1)) : name;
  });
  if (p.header === "title") return [[`${p.seed}-title`], [], names];
  return [names];
}

/* ---- CSV and TSV ---- */

function encoderOf(encoding) {
  const utf8 = new TextEncoder();
  if (encoding.startsWith("utf-8")) return { bom: encoding === "utf-8-bom" ? Uint8Array.of(0xef, 0xbb, 0xbf) : new Uint8Array(0), enc: (s) => utf8.encode(s), len: (s) => Buffer.byteLength(s), unit: 1 };
  if (encoding.startsWith("utf-16")) {
    const be = encoding.startsWith("utf-16be");
    return {
      bom: encoding.endsWith("-bom") ? (be ? Uint8Array.of(0xfe, 0xff) : Uint8Array.of(0xff, 0xfe)) : new Uint8Array(0), unit: 2, len: (s) => s.length * 2,
      enc: (s) => { const o = new Uint8Array(s.length * 2); for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); o[2 * i + (be ? 0 : 1)] = c >> 8; o[2 * i + (be ? 1 : 0)] = c & 255; } return o; },
    };
  }
  return {
    bom: new Uint8Array(0), unit: 1, len: (s) => s.length,
    enc: (s) => Uint8Array.from(s, (ch) => { const c = ch === "œ" ? 0x9c : ch.charCodeAt(0); if (c > 0xff) throw new Error(`sheetgen: windows-1252 cannot write ${JSON.stringify(ch)}`); return c; }),
  };
}

const field = (p, text, stray) => {
  if (stray || !(text.includes(p.delimiter) || text.includes('"') || text.includes("\n") || text.includes("\r"))) return text;
  return `"${text.replaceAll('"', '""')}"`;
};

/** The text of one record (without its line end): header row `-k` (k from 1) or data row `d`. */
function recordText(p, rows, headers, d, pad = null) {
  if (d <= 0) return (headers[-d - 1] ?? []).map((t) => field(p, t)).join(p.delimiter);
  const n = rowLength(p, rows, d), parts = [];
  for (let c = 1; c <= n; c++) {
    const cell = cellOf(p, rows, d, c);
    let text = cell ? cell.text : "";
    if (pad && pad.row === d && pad.col === c) text += "x".repeat(pad.chars);
    parts.push(field(p, text, cell?.stray));
  }
  return parts.join(p.delimiter);
}

/** The data row count and the padding that make a CSV exactly `size.bytes` (or the recipe's rows, unpadded). */
function csvLayout(p) {
  const headers = headerOf(p), E = encoderOf(p.encoding), eolBytes = E.enc(p.eol).length;
  const fixed = E.bom.length + headers.reduce((n, _, k) => n + E.len(recordText(p, 0, headers, -(k + 1))) + eolBytes, 0);
  const target = p.size.bytes;
  if (target === undefined) return { rows: p.size.rows ?? 20, pad: null, headers, E };
  if (p.cols < 2) throw new Error("sheetgen: size.bytes needs two columns or more (the padding goes in the last one)");
  const rowBytes = (rows, d) => E.len(recordText(p, rows, headers, d)) + eolBytes;
  const total = (rows, prefix) => {
    /* the rows' natural bytes, with the three mark rows as they stand for this row count */
    let t = fixed + prefix;
    for (const d of markRows(rows)) t += rowBytes(rows, d) - rowBytes(Infinity, d);
    return t;
  };
  let rows, prefix = 0;
  if (p.size.rows !== undefined) {
    rows = p.size.rows;
    for (let d = 1; d <= rows; d++) prefix += rowBytes(Infinity, d);
  } else {
    let best = 0, bestPrefix = 0;
    for (let d = 1; ; d++) {
      const next = prefix + rowBytes(Infinity, d);
      /* the exact total (the mark rows as they stand for d rows) only near the target; it differs by a few bytes */
      if (fixed + next > target - 4096 && total(d, next) > target) break;
      prefix = next; best = d; bestPrefix = next;
    }
    rows = best; prefix = bestPrefix;
    if (!rows) throw new Error(`sheetgen: size.bytes ${target} holds no data row`);
  }
  const left = target - total(rows, prefix);
  if (left < 0) throw new Error(`sheetgen: ${rows} rows are ${total(rows, prefix)} bytes, over size.bytes ${target}`);
  if (left % E.unit) throw new Error(`sheetgen: size.bytes ${target} is not a whole number of ${p.encoding} units`);
  return { rows, pad: left ? { row: rows, col: rowLength(p, rows, rows), chars: left / E.unit } : null, headers, E };
}

async function* csvChunks(p, L) {
  const { rows, pad, headers, E } = L;
  let batch = [];
  let n = 0;
  if (E.bom.length) yield E.bom;
  const flush = function* () { if (batch.length) { yield p.encoding.startsWith("utf-8") ? new Uint8Array(Buffer.from(batch.join(""))) : E.enc(batch.join("")); batch = []; n = 0; } };
  for (let k = 1; k <= headers.length; k++) { batch.push(recordText(p, rows, headers, -k) + p.eol); }
  for (let d = 1; d <= rows; d++) {
    const r = recordText(p, rows, headers, d, pad) + p.eol;
    batch.push(r); n += r.length;
    if (n > 1 << 18) yield* flush();
  }
  yield* flush();
}

/**
 * An RFC 4180 reading of `text` (the generator's own independent reader, sharing no code with csv-reader): records
 * split on CRLF, LF or CR outside quotes; a field opening with `"` runs to its closing quote, `""` inside it is one
 * quote; a quote inside a field that did not open with one is kept as it is. A last line end makes no empty record.
 */
export function rfc4180(text, delimiter = ",") {
  const out = [];
  let rec = [], f = "", i = 0, quoted = false, started = false;
  const endField = () => { rec.push(f); f = ""; quoted = false; started = false; };
  const endRecord = () => { endField(); out.push(rec); rec = []; };
  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i += 2; continue; } quoted = false; i++; continue; }
      f += ch; i++; continue;
    }
    if (ch === '"' && !started) { quoted = true; started = true; i++; continue; }
    if (ch === delimiter) { endField(); i++; continue; }
    if (ch === "\r" || ch === "\n") { endRecord(); i += ch === "\r" && text[i + 1] === "\n" ? 2 : 1; continue; }
    f += ch; started = true; i++;
  }
  if (started || f || rec.length) endRecord();
  return out;
}

/* ---- XLSX ---- */

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main", NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const STYLE = { decimal: 2, percent: 3, currency: 4, date: 5 };

function xlsxParts(p, rows) {
  const headers = headerOf(p), shared = p.recipe.strings === "shared";
  const sheetName = (s) => `Sheet${s}`;
  const files = [];
  const ct = ['<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>',
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'];
  if (shared) ct.push('<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>');
  for (let s = 1; s <= p.sheets; s++) ct.push(`<Override PartName="/xl/worksheets/sheet${s}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
  if (p.recipe.annotations) ct.push('<Override PartName="/xl/comments1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml"/>');
  files.push({ name: "[Content_Types].xml", data: `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${ct.join("")}</Types>` });
  files.push({ name: "_rels/.rels", data: `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${NS_R}/officeDocument" Target="xl/workbook.xml"/></Relationships>` });
  files.push({ name: "xl/workbook.xml", data: `${XML}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_R}"><sheets>${Array.from({ length: p.sheets }, (_, i) => `<sheet name="${sheetName(i + 1)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>` });
  const wbRels = Array.from({ length: p.sheets }, (_, i) => `<Relationship Id="rId${i + 1}" Type="${NS_R}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`);
  wbRels.push(`<Relationship Id="rId${p.sheets + 1}" Type="${NS_R}/styles" Target="styles.xml"/>`);
  if (shared) wbRels.push(`<Relationship Id="rId${p.sheets + 2}" Type="${NS_R}/sharedStrings" Target="sharedStrings.xml"/>`);
  files.push({ name: "xl/_rels/workbook.xml.rels", data: `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${wbRels.join("")}</Relationships>` });
  files.push({ name: "xl/styles.xml", data: `${XML}<styleSheet xmlns="${NS_MAIN}"><numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00"/><numFmt numFmtId="165" formatCode="yyyy\\-mm\\-dd"/></numFmts><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="1" borderId="0" xfId="0" applyFill="1"/><xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>` });

  /* every text of the workbook in order (header, then cells by sheet, row and column): the shared-string order */
  function* texts() {
    for (let s = 1; s <= p.sheets; s++) {
      for (const h of headers) for (const t of h) yield t;
      for (let d = 1; d <= rows; d++) for (let c = 1; c <= p.cols; c++) { const cell = cellOf(p, rows, d, c, s); if (cell?.type === "text") yield cell.text; }
    }
  }
  if (shared) {
    files.push({
      name: "xl/sharedStrings.xml",
      chunks: async function* () {
        yield `${XML}<sst xmlns="${NS_MAIN}">`;
        let batch = "";
        for (const t of texts()) { batch += `<si><t xml:space="preserve">${esc(t)}</t></si>`; if (batch.length > 1 << 18) { yield batch; batch = ""; } }
        yield `${batch}</sst>`;
      },
    });
  }
  /* a sheet's first shared-string index: the texts of every sheet before it. Computed, never carried over from a
     previous pass, so the archive is the same bytes each time it is streamed (zipChunks64Sized counts it first). */
  const startOf = (s) => {
    let n = 0;
    for (let k = 1; k < s; k++) {
      n += headers.flat().length;
      for (let d = 1; d <= rows; d++) for (let c = 1; c <= p.cols; c++) if (cellOf(p, rows, d, c, k)?.type === "text") n++;
    }
    return n;
  };
  let sstIndex = 0;
  const noR = p.hostile === "no-r", styled = p.hostile === "styled-empty";
  const textCell = (ref, t) => (shared ? `<c${ref} t="s"><v>${sstIndex++}</v></c>` : `<c${ref} t="inlineStr"><is><t xml:space="preserve">${esc(t)}</t></is></c>`);
  const lastCol = colName(p.cols), lastRow = p.headerRows + rows;
  for (let s = 1; s <= p.sheets; s++) {
    const comments = [];
    files.push({
      name: `xl/worksheets/sheet${s}.xml`,
      chunks: async function* () {
        sstIndex = startOf(s);
        const dim = p.hostile === "lying-dimension" ? "A1:XFD1048576" : `A1:${lastCol}${Math.max(lastRow, 1)}`;
        yield `${XML}<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_R}"><dimension ref="${dim}"/><sheetData>`;
        let batch = "";
        const ref = (c, r) => (noR ? "" : ` r="${colName(c)}${r}"`);
        headers.forEach((h, k) => {
          const r = k + 1;
          batch += `<row${noR ? "" : ` r="${r}"`}>${h.map((t, i) => textCell(ref(i + 1, r), t)).join("")}</row>`;
        });
        for (let d = 1; d <= rows; d++) {
          const r = p.headerRows + d;
          let row = `<row${noR ? "" : ` r="${r}"`}>`;
          for (let c = 1; c <= p.cols; c++) {
            const cell = cellOf(p, rows, d, c, s);
            if (!cell) { if (styled || noR) row += `<c${ref(c, r)}${styled ? ' s="3"' : ""}/>`; continue; }
            if (cell.type === "text") row += textCell(ref(c, r), cell.text);
            else if (cell.type === "formula") row += `<c${ref(c, r)}><f>${cell.formula}</f><v>${cell.value}</v></c>`;
            else if (cell.type === "date") row += `<c${ref(c, r)} s="${STYLE.date}"><v>${cell.serial}</v></c>`;
            else row += `<c${ref(c, r)}${STYLE[cell.type] ? ` s="${STYLE[cell.type]}"` : ""}><v>${cell.value}</v></c>`;
            if (cell.mark && p.recipe.annotations && s === 1) comments.push(`${colName(c)}${r}`);
          }
          batch += `${row}</row>`;
          if (batch.length > 1 << 18) { yield batch; batch = ""; }
        }
        let tail = "</sheetData>";
        if (p.recipe.merged) tail += `<mergeCells count="1"><mergeCell ref="A1:${lastCol}1"/></mergeCells>`;
        if (p.recipe.annotations && s === 1) tail += '<legacyDrawing r:id="rId2"/>';
        yield `${batch}${tail}</worksheet>`;
      },
    });
    if (p.recipe.annotations && s === 1) {
      files.push({ name: "xl/worksheets/_rels/sheet1.xml.rels", data: `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${NS_R}/comments" Target="../comments1.xml"/><Relationship Id="rId2" Type="${NS_R}/vmlDrawing" Target="../drawings/vmlDrawing1.vml"/></Relationships>` });
      files.push({ name: "xl/comments1.xml", chunks: async function* () { yield `${XML}<comments xmlns="${NS_MAIN}"><authors><author>bio</author></authors><commentList>${annotationsOf(p, rows).map((a) => `<comment ref="${a.ref}" authorId="0"><text><r><t>${esc(a.text)}</t></r></text></comment>`).join("")}</commentList></comments>`; } });
      files.push({ name: "xl/drawings/vmlDrawing1.vml", data: `<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">${annotationsOf(p, rows).map((a) => `<v:shape type="#_x0000_t202"><x:ClientData ObjectType="Note"><x:Row>${a.row - 1}</x:Row><x:Column>${a.col - 1}</x:Column></x:ClientData></v:shape>`).join("")}</xml>` });
    }
  }
  return files;
}

/** The annotations: one on each mark of sheet 1, `<mark>-note`. */
function annotationsOf(p, rows) {
  if (!p.recipe.annotations) return [];
  return markRows(rows).map((d) => { const r = p.headerRows + d, mark = markAt(p, rows, d, p.markCol, 1); return { ref: `${colName(p.markCol)}${r}`, row: r, col: p.markCol, text: `${mark}-note` }; });
}

/* ---- ODS ---- */

const ODS_NS = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:of="urn:oasis:names:tc:opendocument:xmlns:of:1.2" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"';
/* An annotation's frame and text styles: LibreOffice (24.2) fails to load an annotation that names none. */
const ODS_STYLES = '<office:automatic-styles><style:style style:name="gr1" style:family="graphic"><style:graphic-properties draw:fill="solid" fo:background-color="#ffffcc"/></style:style><style:style style:name="P1" style:family="paragraph"><style:paragraph-properties/></style:style></office:automatic-styles>';

function odsParts(p, rows) {
  const headers = headerOf(p);
  const notes = new Map(annotationsOf(p, rows).map((a) => [a.ref, a.text]));
  const textCell = (t, extra = "", note = "") => `<table:table-cell office:value-type="string"${extra}>${note ? `<office:annotation draw:style-name="gr1" draw:text-style-name="P1" svg:width="30mm" svg:height="10mm" svg:x="10mm" svg:y="10mm"><dc:creator>bio</dc:creator><dc:date>2026-01-01T00:00:00</dc:date><text:p>${esc(note)}</text:p></office:annotation>` : ""}${t.split("\n").map((l) => `<text:p>${esc(l).replace(/\t/g, "<text:tab/>")}</text:p>`).join("")}</table:table-cell>`;
  const valueCell = (cell) => {
    if (cell.type === "date") return `<table:table-cell office:value-type="date" office:date-value="${cell.value}"><text:p>${cell.text}</text:p></table:table-cell>`;
    if (cell.type === "percent") return `<table:table-cell office:value-type="percentage" office:value="${cell.value}"><text:p>${cell.text}</text:p></table:table-cell>`;
    if (cell.type === "currency") return `<table:table-cell office:value-type="currency" office:currency="USD" office:value="${cell.value}"><text:p>${esc(cell.text)}</text:p></table:table-cell>`;
    if (cell.type === "formula") return `<table:table-cell table:formula="of:=ROW()*2" office:value-type="float" office:value="${cell.value}"><text:p>${cell.text}</text:p></table:table-cell>`;
    return `<table:table-cell office:value-type="float" office:value="${cell.value}"><text:p>${cell.text}</text:p></table:table-cell>`;
  };
  return [
    { name: "mimetype", data: TYPES.ods, method: 0, zip64: false },
    { name: "META-INF/manifest.xml", data: `${XML}<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3"><manifest:file-entry manifest:full-path="/" manifest:media-type="${TYPES.ods}"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>${p.size.bytes !== undefined ? '<manifest:file-entry manifest:full-path="bio-pad.bin" manifest:media-type="application/octet-stream"/>' : ""}</manifest:manifest>` },
    { name: "styles.xml", data: `${XML}<office:document-styles ${ODS_NS} office:version="1.3"/>` },
    {
      name: "content.xml",
      chunks: async function* () {
        yield `${XML}<office:document-content ${ODS_NS} office:version="1.3">${ODS_STYLES}<office:body><office:spreadsheet>`;
        for (let s = 1; s <= p.sheets; s++) {
          let batch = `<table:table table:name="Sheet${s}"><table:table-column table:number-columns-repeated="${p.cols}"/>`;
          headers.forEach((h, k) => {
            if (k === 0 && p.header === "title" && p.recipe.merged) batch += `<table:table-row>${textCell(h[0], ` table:number-columns-spanned="${p.cols}"`)}${"<table:covered-table-cell/>".repeat(p.cols - 1)}</table:table-row>`;
            else batch += `<table:table-row>${h.length ? h.map((t) => textCell(t)).join("") : "<table:table-cell/>"}</table:table-row>`;
          });
          for (let d = 1; d <= rows; d++) {
            const r = p.headerRows + d;
            let row = "<table:table-row>";
            const n = rowLength(p, rows, d);
            for (let c = 1; c <= n; c++) {
              const cell = cellOf(p, rows, d, c, s);
              if (!cell) row += "<table:table-cell/>";
              else if (cell.type === "text") row += textCell(cell.text, "", s === 1 ? notes.get(`${colName(c)}${r}`) : "");
              else row += valueCell(cell);
            }
            batch += `${row}</table:table-row>`;
            if (batch.length > 1 << 18) { yield batch; batch = ""; }
          }
          yield `${batch}</table:table>`;
        }
        yield "</office:spreadsheet></office:body></office:document-content>";
      },
    },
  ];
}

/* ---- the file ---- */

/** The ZIP entries of an XLSX or ODS with `rows` data rows, the hostile directory applied. */
function packageEntries(p, rows) {
  const entries = p.kind === "xlsx" ? xlsxParts(p, rows) : odsParts(p, rows);
  if (p.hostile === "lying-directory") {
    const sheet = entries.find((e) => e.name === "xl/worksheets/sheet1.xml" || e.name === "content.xml");
    sheet.central = { uncompressedSize: 1 };
  }
  return entries;
}

const encodeChunks = (entries) => entries.map((e) => (e.chunks ? { ...e, chunks: async function* () { const t = new TextEncoder(); for await (const c of e.chunks()) yield t.encode(c); } } : e));


function truthFrom(p, rows, extra = {}) {
  const headers = headerOf(p);
  const marks = [];
  for (let s = 1; s <= p.sheets; s++) for (const d of markRows(rows)) marks.push({ sheet: s, dataRow: d, row: p.headerRows + d, col: p.markCol, text: markAt(p, rows, d, p.markCol, s) });
  const rowKey = (d, s = 1) => {
    for (let c = 1; c <= p.cols; c++) { const cell = cellOf(p, rows, d, c, s); if (cell?.type === "text") return cell.text; }
    return null;
  };
  return {
    kind: p.kind, recipe: p.recipe, rows, cols: p.cols, sheets: p.sheets, headerRows: p.headerRows, fileRows: p.headerRows + rows,
    header: headers, encoding: p.encoding, eol: p.eol, delimiter: p.delimiter,
    /** the cell at data row d, column c (1-based), sheet s: `{type, value, text}`, or null when empty */
    cell: (d, c, s = 1) => cellOf(p, rows, d, c, s),
    /** the texts of data row d as the file writes them (a CSV record; the padding in its last cell) */
    row: (d, s = 1) => Array.from({ length: rowLength(p, rows, d) }, (_, i) => {
      const c = cellOf(p, rows, d, i + 1, s);
      return (c ? c.text : "") + (extra.pad && extra.pad.row === d && extra.pad.col === i + 1 ? "x".repeat(extra.pad.chars) : "");
    }),
    rowLength: (d) => rowLength(p, rows, d),
    marks, rowKey,
    /**
     * The J-1 check of an index (G123e): `units` is a list of unit texts; each non-empty data row must be in exactly one
     * unit, judged by its key (its first text cell, which carries `r<row>c<col>` or a mark). Answers `{ok, missing, repeated}`.
     */
    checkUnits(units, s = 1) {
      const missing = [], repeated = [];
      for (let d = 1; d <= rows; d++) {
        const key = rowKey(d, s);
        if (key === null) continue;
        const re = new RegExp(`${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![0-9])`);
        const n = units.filter((u) => re.test(u)).length;
        if (n === 0) missing.push(d); else if (n > 1) repeated.push(d);
      }
      return { ok: !missing.length && !repeated.length, missing, repeated };
    },
    merged: p.recipe.merged ? [`A1:${colName(p.cols)}1`] : [],
    annotations: annotationsOf(p, rows),
    pad: extra.pad ?? null, hostile: p.hostile,
    refusal: p.recipe.bound && extra.size > p.recipe.bound ? { code: "TOO_LARGE", size: extra.size, bound: p.recipe.bound } : null,
    size: extra.size ?? null,
  };
}

/** The sheet of a recipe (R19, R21): `{kind, ext, type, size, truth, chunks(), bytes()}`; `size` is null for a package
 *  whose size is not named (it is known once streamed). */
export function generate(recipe) {
  const p = plan(recipe);
  if (p.kind === "csv" || p.kind === "tsv") {
    if (p.sheets !== 1) throw new Error("sheetgen: a csv or tsv has one sheet");
    const L = csvLayout(p);
    const size = p.size.bytes ?? null;
    const truth = truthFrom(p, L.rows, { pad: L.pad, size });
    const chunks = () => csvChunks(p, L);
    return { kind: p.kind, ext: p.kind, type: TYPES[p.kind], size, truth, chunks, bytes: () => collect(chunks()) };
  }
  const rows = p.size.rows ?? 20;
  const size = p.size.bytes ?? null;
  const truth = truthFrom(p, rows, { size });
  const chunks = () => (size === null ? zipChunks64(encodeChunks(packageEntries(p, rows))) : zipChunks64Sized(encodeChunks(packageEntries(p, rows)), size, { member: p.kind === "ods" }));
  return { kind: p.kind, ext: p.kind, type: TYPES[p.kind], size, truth, chunks, bytes: () => collect(chunks()) };
}

async function collect(it) {
  const parts = [];
  let n = 0;
  for await (const c of it) { parts.push(c); n += c.length; }
  const out = new Uint8Array(n);
  let o = 0;
  for (const c of parts) { out.set(c, o); o += c.length; }
  return out;
}

/** The truth of a recipe without building its file (R24): for a CSV sized by bytes the row count comes from a
 *  counting pass over the rows' lengths, which holds nothing. */
export function truthOf(recipe) {
  const p = plan(recipe);
  if (p.kind === "csv" || p.kind === "tsv") { const L = csvLayout(p); return truthFrom(p, L.rows, { pad: L.pad, size: p.size.bytes ?? null }); }
  return truthFrom(p, p.size.rows ?? 20, { size: p.size.bytes ?? null });
}
