/* pdfgen: the seeded PDF generator (requirements/test-support.md R19, R20, R24; fix round 9, G123d; pdf-envelope 3.1).
 * Not product code; importing it has no side effect.
 *
 * Every text line carries `<seed>-p<page>-l<line>` and a word, so a unit is checkable against its page alone; the
 * truth is each page's lines, which pdf.js (the library the pdf-worker bundle carries) agrees with on the decodable
 * pages. Scan pages are rasterised by imggen from the same kind of lines; their truth is the lines, read by OCR.
 *
 * Recipe: `{kind: "pdf", seed, size: {pages = 3, lines = 20, bytes}, fonts: ["winansi"|"macroman"|"differences"|
 * "type0"|"type0-nounicode"|"type3", ...] (page p uses fonts[(p-1) % n]), kinds: ["text"|"scan"|"mixed"|"folio"|
 * "blank"|"vector", ...] (cycled), structure: "classic"|"xref-stream"|"object-streams"|"linearized"|"damaged-xref"|
 * "no-xref", revisions: n, truncate: fraction, encryption: {method: "rc4"|"aes", user: ""|"<password>"},
 * heavy: {page, lines}, huge: {page, box: [w, h]}, rotate: {every, angle}, scan: {dpi = 150, bits = 8},
 * declare: {length, count, image: [w, h]}, hostile: {pages, objects}, polyglot: "zip", compress: true, bound}.
 * Truth: `{kind, pages, page(n), units(), marks, encryption, refusal, declared, size}`; `page(n)` is
 * `{page, kind, font, lines, ocr, text, unread, rotate, box}`. */
import { createHash, createCipheriv } from "node:crypto";
import { deflateSync } from "node:zlib";
import { makeZip } from "./make-zip.mjs";
import { renderLines, pageSize, pageLines as scanLines } from "./imggen.mjs";
import { hash32, VOCAB, LATIN_VOCAB, ASCII_VOCAB } from "./seeded.mjs";

export const KINDS = Object.freeze(["pdf"]);

/* ---- fonts: how each writes a line, and the words it can carry ---- */

const MAC = { "é": 0x8e, "ï": 0x95, "ß": 0xa7, "ñ": 0x96, "Æ": 0xae, "ø": 0xbf, "ü": 0x9f, "ç": 0x8d, "ﬁ": 0xde, "ﬂ": 0xdf, "œ": 0xcf };
const NAMES = { "é": "eacute", "ï": "idieresis", "ß": "germandbls", "ñ": "ntilde", "Æ": "AE", "ø": "oslash", "ü": "udieresis", "ç": "ccedilla", "ﬁ": "fi", "ﬂ": "fl", "œ": "oe" };
const DIFF_CODE = Object.fromEntries(Object.keys(NAMES).map((ch, i) => [ch, 128 + i]));
const LIGATURE_VOCAB = Object.freeze([...LATIN_VOCAB, "ﬁnance", "ﬂoor", "œuvre"]);
const ASCII_NAMES = { " ": "space", "-": "hyphen", ".": "period", _: "underscore", ...Object.fromEntries("0123456789".split("").map((d, i) => [d, ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"][i]])) };

const single = (map) => (text) => Uint8Array.from([...text], (ch) => {
  const code = ch.charCodeAt(0) < 128 ? ch.charCodeAt(0) : map(ch);
  if (code === undefined) throw new Error(`pdfgen: the font cannot write ${JSON.stringify(ch)}`);
  return code;
});
const CP1252 = (ch) => (ch === "œ" ? 0x9c : ch.charCodeAt(0) <= 0xff ? ch.charCodeAt(0) : undefined);

const FONTS = {
  winansi: { vocab: LATIN_VOCAB, encode: single(CP1252), dict: () => "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>" },
  macroman: { vocab: LIGATURE_VOCAB, encode: single((ch) => MAC[ch]), dict: () => "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /MacRomanEncoding >>" },
  differences: {
    vocab: LIGATURE_VOCAB, encode: single((ch) => DIFF_CODE[ch]),
    dict: () => `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding << /Type /Encoding /BaseEncoding /StandardEncoding /Differences [128 ${Object.values(NAMES).map((n) => `/${n}`).join(" ")}] >> >>`,
  },
  type0: { vocab: VOCAB, cid: true, toUnicode: true },
  "type0-nounicode": { vocab: VOCAB, cid: true, toUnicode: false, unread: "NO_TOUNICODE" },
  type3: { vocab: ASCII_VOCAB, encode: single(() => undefined), type3: true },
};

const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
const latin1 = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);
const concat = (list) => { let n = 0; for (const b of list) n += b.length; const o = new Uint8Array(n); let k = 0; for (const b of list) { o.set(b, k); k += b.length; } return o; };

/* ---- the plan of a recipe: every page's kind, font, lines and box ---- */

function plan(recipe) {
  if (recipe.kind !== "pdf") throw new Error("pdfgen: kind must be pdf");
  if (recipe.seed === undefined) throw new Error("pdfgen: recipe.seed is missing");
  const seed = String(recipe.seed);
  if (!/^[A-Za-z0-9_.-]+$/.test(seed)) throw new Error("pdfgen: recipe.seed must be letters, digits, _ . or -");
  const size = recipe.size ?? {};
  const fonts = recipe.fonts ?? ["winansi"];
  for (const f of fonts) if (!FONTS[f]) throw new Error(`pdfgen: fonts has ${f}, not one of ${Object.keys(FONTS).join(", ")}`);
  const kinds = recipe.kinds ?? ["text"];
  for (const k of kinds) if (!["text", "scan", "mixed", "folio", "blank", "vector"].includes(k)) throw new Error(`pdfgen: kinds has ${k}`);
  const count = size.pages ?? 3, perPage = size.lines ?? 20;
  const pages = [];
  for (let p = 1; p <= count; p++) {
    const kind = kinds[(p - 1) % kinds.length];
    const fontName = fonts[(p - 1) % fonts.length], font = FONTS[fontName];
    const n = recipe.heavy?.page === p ? recipe.heavy.lines : perPage;
    let lines = [], ocr = [];
    const textLine = (l) => `${seed}-p${p}-l${l} ${font.vocab[hash32(seed, p, l) % font.vocab.length]}`;
    if (kind === "text") lines = Array.from({ length: n }, (_, i) => textLine(i + 1));
    else if (kind === "folio") lines = [`${seed}-p${p}-l1 ${p}`];
    else if (kind === "scan") ocr = scanLines(seed, p, n);
    else if (kind === "mixed") {
      const half = Math.ceil(n / 2);
      lines = Array.from({ length: half }, (_, i) => textLine(i + 1));
      ocr = scanLines(seed, p, n).slice(half);
    }
    const rotate = recipe.rotate && p % recipe.rotate.every === 0 ? recipe.rotate.angle : 0;
    const heavy = recipe.heavy?.page === p;
    const layout = heavy ? { size: 4, leading: 5, column: 150, width: 180 } : { size: 10, leading: 14, column: Infinity, width: 0 };
    const columns = Math.max(1, Math.ceil(lines.length / Math.min(layout.column, Math.max(1, lines.length))));
    const rows = Math.min(lines.length, layout.column);
    let box = [612, Math.max(792, 144 + rows * layout.leading)];
    if (heavy) box = [Math.max(612, 144 + columns * layout.width), box[1]];
    if (recipe.huge?.page === p) box = recipe.huge.box;
    pages.push({ page: p, kind, fontName, font, lines, ocr, rotate, box, layout });
  }
  return { seed, size, fonts, pages, count };
}

/* ---- the objects ---- */

/** A PDF object list: `{num, body}` with body a string, or `{dict, data}` for a stream (its /Length written for it). */
function objectsOf(recipe, pl) {
  const objs = [];
  const add = (body) => { objs.push({ num: objs.length + 1, body }); return objs.length; };
  const catalog = add(null), pagesObj = add(null);
  const compress = recipe.compress === true;
  const stream = (dict, text) => {
    const data = typeof text === "string" ? latin1(text) : text;
    return compress ? { dict: `<< ${dict} /Filter /FlateDecode >>`, data: new Uint8Array(deflateSync(data)) } : { dict: `<< ${dict} >>`, data };
  };

  /* fonts, one object each, shared by the pages that use them */
  const fontRef = {};
  const cidTable = (() => {
    const chars = new Set();
    for (const pg of pl.pages) if (pg.font.cid) for (const l of pg.lines) for (const ch of l) chars.add(ch);
    return [...chars].sort();
  })();
  const cidOf = new Map(cidTable.map((ch, i) => [ch, i + 1]));
  for (const name of new Set(pl.pages.filter((pg) => pg.lines.length).map((pg) => pg.fontName))) {
    const f = FONTS[name];
    if (f.cid) {
      const desc = add(`<< /Type /FontDescriptor /FontName /BioGen /Flags 4 /FontBBox [0 -200 1000 900] /ItalicAngle 0 /Ascent 900 /Descent -200 /CapHeight 700 /StemV 80 >>`);
      const cidFont = add(`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /BioGen /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${desc} 0 R /DW 600 /CIDToGIDMap /Identity >>`);
      let tu = "";
      if (f.toUnicode) {
        const lines = ["/CIDInit /ProcSet findresource begin", "12 dict begin", "begincmap", "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
          "/CMapName /BioGen-UCS def", "/CMapType 2 def", "1 begincodespacerange", "<0000> <FFFF>", "endcodespacerange"];
        for (let i = 0; i < cidTable.length; i += 100) {
          const part = cidTable.slice(i, i + 100);
          lines.push(`${part.length} beginbfchar`, ...part.map((ch) => `<${(cidOf.get(ch)).toString(16).padStart(4, "0").toUpperCase()}> <${hex(utf16be(ch))}>`), "endbfchar");
        }
        lines.push("endcmap", "CMapName currentdict /CMap defineresource pop", "end", "end");
        tu = ` /ToUnicode ${add(stream("", lines.join("\n")))} 0 R`;
      }
      fontRef[name] = add(`<< /Type /Font /Subtype /Type0 /BaseFont /BioGen /Encoding /Identity-H /DescendantFonts [${cidFont} 0 R]${tu} >>`);
    } else if (f.type3) {
      const glyph = add(stream("", "600 0 0 0 500 700 d1 50 0 400 700 re f"));
      const chars = [..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -._"];
      const nameOf = (ch) => ASCII_NAMES[ch] ?? ch;
      const procs = chars.map((ch) => `/${nameOf(ch)} ${glyph} 0 R`).join(" ");
      const diffs = chars.map((ch) => `${ch.charCodeAt(0)} /${nameOf(ch)}`).join(" ");
      fontRef[name] = add(`<< /Type /Font /Subtype /Type3 /FontBBox [0 0 600 700] /FontMatrix [0.001 0 0 0.001 0 0] /CharProcs << ${procs} >> /Encoding << /Type /Encoding /Differences [${diffs}] >> /FirstChar 32 /LastChar 122 /Widths [${Array(91).fill(600).join(" ")}] /Resources << >> >>`);
    } else fontRef[name] = add(f.dict());
  }
  const encodeLine = (pg, text) => (pg.font.cid ? Uint8Array.from([...text].flatMap((ch) => { const c = cidOf.get(ch); return [c >> 8, c & 255]; })) : pg.font.encode(text));

  /* pages */
  const pageNums = [], contentNums = [], imageNums = [];
  for (const pg of pl.pages) {
    const [w, h] = pg.box;
    let ops = "";
    const res = [];
    if (pg.lines.length) {
      const L = pg.layout;
      ops += `BT /F1 ${L.size} Tf\n`;
      pg.lines.forEach((line, i) => {
        const col = Math.floor(i / L.column), row = i % L.column;
        /* the marker and the word are two text items, so a right-to-left word is one run of its own direction */
        const x = 72 + col * L.width, y = h - 72 - L.size - row * L.leading, [marker, word] = line.split(" ");
        ops += `1 0 0 1 ${x} ${y} Tm <${hex(encodeLine(pg, marker))}> Tj`;
        ops += word === undefined ? "\n" : ` 1 0 0 1 ${x + (marker.length + 8) * L.size * 0.6} ${y} Tm <${hex(encodeLine(pg, word))}> Tj\n`;
      });
      ops += "ET\n";
      res.push(`/Font << /F1 ${fontRef[pg.fontName]} 0 R >>`);
    }
    if (pg.ocr.length) {
      const dpi = recipe.scan?.dpi ?? 150, bits = recipe.scan?.bits ?? 8;
      const all = scanLines(pl.seed, pg.page, pg.ocr.length + (pg.kind === "mixed" ? pg.lines.length : 0));
      const mine = pg.kind === "mixed" ? all.slice(pg.lines.length) : all;
      const sz = pageSize(mine, dpi);
      const { data } = renderLines(mine, { width: sz.width, height: sz.height, dpi });
      let samples = data;
      if (bits === 1) {
        const rb = Math.ceil(sz.width / 8);
        samples = new Uint8Array(rb * sz.height);
        for (let y = 0; y < sz.height; y++) for (let x = 0; x < sz.width; x++) if (data[y * sz.width + x] >= 128) samples[y * rb + (x >> 3)] |= 0x80 >> (x & 7);
      }
      const declared = recipe.declare?.image && !imageNums.length ? recipe.declare.image : [sz.width, sz.height];
      const im = add({ dict: `<< /Type /XObject /Subtype /Image /Width ${declared[0]} /Height ${declared[1]} /ColorSpace /DeviceGray /BitsPerComponent ${bits} /Filter /FlateDecode >>`, data: new Uint8Array(deflateSync(samples)) });
      imageNums.push(im);
      const top = pg.kind === "mixed" ? h / 2 : h;
      const scale = Math.min(w / sz.width, top / sz.height);
      ops += `q ${(sz.width * scale).toFixed(2)} 0 0 ${(sz.height * scale).toFixed(2)} 0 ${(top - sz.height * scale).toFixed(2)} cm /Im1 Do Q\n`;
      res.push(`/XObject << /Im1 ${im} 0 R >>`);
    }
    if (pg.kind === "vector") ops += Array.from({ length: 20 }, (_, i) => `${50 + i * 20} ${100 + i * 15} 100 40 re S`).join("\n") + "\n0 0 m 612 792 l S\n";
    const content = add(stream("", ops));
    if (recipe.declare?.length && pg.page === 1) objs[content - 1].declareMore = recipe.declare.length;
    contentNums.push(content);
    const rot = pg.rotate ? ` /Rotate ${pg.rotate}` : "";
    pageNums.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${w} ${h}] /Resources << ${res.join(" ")} >> /Contents ${content} 0 R${rot} >>`));
  }
  if (recipe.hostile?.pages) {
    const empty = add(stream("", ""));
    for (let i = 0; i < recipe.hostile.pages; i++) pageNums.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents ${empty} 0 R >>`));
  }
  for (let i = 0; i < (recipe.hostile?.objects ?? 0); i++) add("<< >>");
  objs[catalog - 1].body = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objs[pagesObj - 1].body = `<< /Type /Pages /Kids [${pageNums.map((n) => `${n} 0 R`).join(" ")}] /Count ${recipe.declare?.count ?? pageNums.length} >>`;
  return { objs, pageNums, contentNums, catalog, compress };
}

function utf16be(ch) {
  const out = [];
  for (let i = 0; i < ch.length; i++) { const c = ch.charCodeAt(i); out.push(c >> 8, c & 255); }
  return out;
}

/* ---- encryption: the Standard security handler, R3 (RC4 128) and R4 (AESV2) ---- */

const PAD = Uint8Array.from(Buffer.from("28BF4E5E4E758A4164004E56FFFA01082E2E00B6D0683E802F0CA9FE6453697A", "hex"));
const md5 = (...parts) => new Uint8Array(createHash("md5").update(concat(parts.map((p) => (typeof p === "string" ? latin1(p) : p)))).digest());
function rc4(key, data) {
  const s = Uint8Array.from({ length: 256 }, (_, i) => i);
  for (let i = 0, j = 0; i < 256; i++) { j = (j + s[i] + key[i % key.length]) & 255; [s[i], s[j]] = [s[j], s[i]]; }
  const out = new Uint8Array(data.length);
  for (let k = 0, i = 0, j = 0; k < data.length; k++) { i = (i + 1) & 255; j = (j + s[i]) & 255; [s[i], s[j]] = [s[j], s[i]]; out[k] = data[k] ^ s[(s[i] + s[j]) & 255]; }
  return out;
}
const padded = (pw) => concat([latin1(pw), PAD]).subarray(0, 32);
const xorKey = (key, i) => key.map((b) => b ^ i);

function securityOf(enc, seed) {
  if (!["rc4", "aes"].includes(enc.method)) throw new Error("pdfgen: encryption.method must be rc4 or aes");
  const user = enc.user ?? "", owner = enc.owner ?? "owner";
  const id = md5("bio-pdfgen", seed);
  const P = Uint8Array.of(0xfc, 0xff, 0xff, 0xff);
  let ok = md5(padded(owner));
  for (let i = 0; i < 50; i++) ok = md5(ok);
  let O = rc4(ok, padded(user));
  for (let i = 1; i <= 19; i++) O = rc4(xorKey(ok, i), O);
  let key = md5(padded(user), O, P, id);
  for (let i = 0; i < 50; i++) key = md5(key);
  let U = rc4(key, md5(PAD, id));
  for (let i = 1; i <= 19; i++) U = rc4(xorKey(key, i), U);
  U = concat([U, new Uint8Array(16)]);
  const aes = enc.method === "aes";
  const dict = aes
    ? `<< /Filter /Standard /V 4 /R 4 /Length 128 /CF << /StdCF << /CFM /AESV2 /AuthEvent /DocOpen /Length 16 >> >> /StmF /StdCF /StrF /StdCF /O <${hex(O)}> /U <${hex(U)}> /P -4 >>`
    : `<< /Filter /Standard /V 2 /R 3 /Length 128 /O <${hex(O)}> /U <${hex(U)}> /P -4 >>`;
  const encrypt = (num, data) => {
    const k = md5(key, Uint8Array.of(num & 255, (num >> 8) & 255, (num >> 16) & 255, 0, 0), aes ? "sAlT" : new Uint8Array(0));
    if (!aes) return rc4(k, data);
    const iv = md5("iv", seed, String(num));
    const c = createCipheriv("aes-128-cbc", k, iv);
    return concat([iv, new Uint8Array(c.update(data)), new Uint8Array(c.final())]);
  };
  return { dict, id, encrypt };
}

/* ---- serialising: the structures ---- */

/** A part list: Uint8Arrays, and `{pad: n}` for n bytes of comment padding written lazily. */
const partBytes = (p) => (p instanceof Uint8Array ? p.length : p.pad);

function objBytes(o, sec) {
  if (typeof o.body === "string") return latin1(`${o.num} 0 obj\n${o.body}\nendobj\n`);
  const data = sec ? sec.encrypt(o.num, o.body.data) : o.body.data;
  const length = data.length + (o.declareMore ?? 0);
  const dict = o.body.dict.replace(/>>\s*$/, ` /Length ${length} >>`);
  return concat([latin1(`${o.num} 0 obj\n${dict}\nstream\n`), data, latin1("\nendstream\nendobj\n")]);
}

const HEADER = latin1("%PDF-1.7\n%\xe2\xe3\xcf\xd3\n");
const xrefTable = (entries, from = 0) => latin1(`xref\n${from} ${entries.length}\n${entries.map((e) => (e === null ? "0000000000 65535 f \n" : `${String(e).padStart(10, "0")} 00000 n \n`)).join("")}`);

function serialise(recipe, pl, built, pad) {
  const { objs } = built;
  const structure = recipe.structure ?? "classic";
  const sec = recipe.encryption ? securityOf(recipe.encryption, pl.seed) : null;
  const parts = [HEADER];
  let at = HEADER.length;
  const offsets = new Map();
  const push = (b) => { parts.push(b); at += partBytes(b); };
  const trailerKeys = (size) => `/Size ${size} /Root ${built.catalog} 0 R${sec ? ` /Encrypt ${size - 1} 0 R /ID [<${hex(sec.id)}> <${hex(sec.id)}>]` : ""}`;
  let all = objs;
  if (sec) all = [...objs, { num: objs.length + 1, body: sec.dict, plain: true }];
  const write = (o) => { offsets.set(o.num, at); push(objBytes(o, o.plain ? null : sec)); };

  if (structure === "classic" || structure === "damaged-xref" || structure === "no-xref") {
    all.forEach(write);
    if (pad) push({ pad });
    const size = all.length + 1;
    if (structure === "no-xref") { push(latin1(`trailer\n<< ${trailerKeys(size)} >>\n%%EOF\n`)); return { parts, offsets }; }
    const xrefAt = at;
    const shift = structure === "damaged-xref" ? 7 : 0;
    push(xrefTable([null, ...all.map((o) => offsets.get(o.num) + shift)]));
    push(latin1(`trailer\n<< ${trailerKeys(size)} >>\nstartxref\n${xrefAt}\n%%EOF\n`));
    let last = xrefAt;
    const current = new Map();
    for (let k = 1; k <= (recipe.revisions ?? 0); k++) {
      const rev = revision(recipe, pl, built, k, current);
      current.set(rev.num, rev);
      offsets.set(rev.num, at);
      push(objBytes(rev, sec));
      const xa = at;
      push(latin1(`xref\n0 1\n0000000000 65535 f \n${rev.num} 1\n${String(offsets.get(rev.num)).padStart(10, "0")} 00000 n \n`));
      push(latin1(`trailer\n<< ${trailerKeys(size)} /Prev ${last} >>\nstartxref\n${xa}\n%%EOF\n`));
      last = xa;
    }
    return { parts, offsets };
  }
  if (structure === "xref-stream" || structure === "object-streams") {
    let packed = [];
    if (structure === "object-streams") {
      packed = all.filter((o) => typeof o.body === "string" && !o.plain);
      all.filter((o) => !packed.includes(o)).forEach(write);
      const header = [], bodies = [];
      let off = 0;
      for (const o of packed) { const b = `${o.body}\n`; header.push(`${o.num} ${off}`); bodies.push(b); off += b.length; }
      const head = `${header.join(" ")}\n`;
      const num = all.length + 1;
      const data = new Uint8Array(deflateSync(latin1(head + bodies.join(""))));
      write({ num, body: { dict: `<< /Type /ObjStm /N ${packed.length} /First ${head.length} /Filter /FlateDecode >>`, data } });
      packed.forEach((o, i) => offsets.set(o.num, { stream: num, index: i }));
    } else all.forEach(write);
    if (pad) push({ pad });
    const size = Math.max(...offsets.keys()) + 2, xnum = size - 1;
    offsets.set(xnum, at);
    const rows = [];
    for (let n = 0; n < size; n++) {
      const v = offsets.get(n);
      const r = new Uint8Array(7);
      if (n === 0) { r[0] = 0; r[5] = 0xff; r[6] = 0xff; }
      else if (v && typeof v === "object") { r[0] = 2; r.set([v.stream >>> 24, (v.stream >>> 16) & 255, (v.stream >>> 8) & 255, v.stream & 255], 1); r[6] = v.index; }
      else { r[0] = 1; r.set([v >>> 24, (v >>> 16) & 255, (v >>> 8) & 255, v & 255], 1); }
      rows.push(r);
    }
    const keys = trailerKeys(size).replace(/\/Encrypt \d+ 0 R/, sec ? `/Encrypt ${all.length} 0 R` : "");
    const xref = { num: xnum, body: { dict: `<< /Type /XRef ${keys} /W [1 4 2] >>`, data: concat(rows) } };
    const xa = at;
    push(objBytes(xref, null));
    push(latin1(`startxref\n${xa}\n%%EOF\n`));
    return { parts, offsets };
  }
  if (structure === "linearized") return linearized(recipe, pl, built, all, sec, pad);
  throw new Error(`pdfgen: structure must be classic, xref-stream, object-streams, linearized, damaged-xref or no-xref, got ${structure}`);
}

/** The page revision k rewrites: the text pages in a single-byte font, in turn (an ASCII line is the same bytes in each). */
function revisedPage(pl, k) {
  const pages = pl.pages.filter((pg) => pg.lines.length && !pg.font.cid);
  if (!pages.length) throw new Error("pdfgen: revisions need a text page in a single-byte font");
  return pages[(k - 1) % pages.length];
}

/** Revision k: a page's content stream written again, with one line more. */
function revision(recipe, pl, built, k, current) {
  const pg = revisedPage(pl, k);
  const num = built.contentNums[pg.page - 1];
  const o = current.get(num) ?? built.objs[num - 1];
  const text = new TextDecoder("latin1").decode(o.body.data);
  const added = revisionLine(pl, pg, k);
  const line = `BT /F1 10 Tf 1 0 0 1 72 ${Math.max(8, 200 - 12 * k)} Tm <${hex(FONTS.winansi.encode(added))}> Tj ET\n`;
  return { num, body: { dict: o.body.dict, data: latin1(text + line) }, revised: true };
}
const revisionLine = (pl, pg, k) => `${pl.seed}-p${pg.page}-r${k} ${ASCII_VOCAB[hash32(pl.seed, "r", k) % ASCII_VOCAB.length]}`;

function linearized(recipe, pl, built, all, sec, pad) {
  /* The linearization dictionary first, a first-page xref section after it, then every object, the main xref and a
     trailer whose startxref names the first-page section. /L, /T, /E and /Prev name offsets that depend on their own
     digits, so the layout is repeated until it stops moving. */
  const linNum = all.length + 1, size = linNum + 1;
  let guess = { L: 1000, T: 1000, E: 1000, main: 1000 };
  for (let round = 0; round < 12; round++) {
    const parts = [HEADER];
    let at = HEADER.length;
    const offsets = new Map();
    const push = (b) => { parts.push(b); at += partBytes(b); };
    offsets.set(linNum, at);
    push(latin1(`${linNum} 0 obj\n<< /Linearized 1 /L ${guess.L} /H [${HEADER.length} 1] /O ${built.pageNums[0]} /E ${guess.E} /N ${built.pageNums.length} /T ${guess.T} >>\nendobj\n`));
    const firstXref = at;
    const keys = `/Size ${size} /Root ${built.catalog} 0 R${sec ? ` /Encrypt ${all.length} 0 R /ID [<${hex(sec.id)}> <${hex(sec.id)}>]` : ""}`;
    push(latin1(`xref\n${linNum} 1\n${String(offsets.get(linNum)).padStart(10, "0")} 00000 n \ntrailer\n<< ${keys} /Prev ${guess.main} >>\n`));
    for (const o of all) { offsets.set(o.num, at); push(objBytes(o, o.plain ? null : sec)); }
    const E = at;
    if (pad) push({ pad });
    const main = at;
    push(xrefTable([null, ...all.map((o) => offsets.get(o.num))]));
    push(latin1(`trailer\n<< ${keys} >>\nstartxref\n${firstXref}\n%%EOF\n`));
    const next = { L: at + polyglotBytes(recipe).length, T: main + 1, E, main };
    if (next.L === guess.L && next.T === guess.T && next.E === guess.E && next.main === guess.main) return { parts, offsets };
    guess = next;
  }
  throw new Error("pdfgen: the linearized layout did not settle");
}

const polyglotBytes = (recipe) => {
  if (!recipe.polyglot) return new Uint8Array(0);
  if (recipe.polyglot !== "zip") throw new Error("pdfgen: polyglot must be zip");
  return makeZip([{ name: "polyglot.txt", data: "polyglot" }]);
};

/* ---- the file and its truth ---- */

function layout(recipe) {
  const pl = plan(recipe);
  const built = objectsOf(recipe, pl);
  const tail = polyglotBytes(recipe);
  let out = serialise(recipe, pl, built, 0);
  const total = (o) => o.parts.reduce((n, p) => n + partBytes(p), 0) + tail.length;
  const target = pl.size.bytes;
  if (target !== undefined && recipe.truncate === undefined) {
    let pad = target - total(out);
    if (pad < 0) throw new Error(`pdfgen: the file is ${total(out)} bytes before padding, over size.bytes ${target}`);
    for (let i = 0; pad && i < 8; i++) {
      out = serialise(recipe, pl, built, pad);
      const d = target - total(out);
      if (!d) break;
      pad += d;
      if (pad < 0) throw new Error(`pdfgen: size.bytes ${target} cannot be reached exactly`);
    }
    if (total(out) !== target) throw new Error(`pdfgen: size.bytes ${target} cannot be reached exactly`);
  }
  out.parts.push(tail);
  return { pl, built, ...out, size: total({ parts: out.parts }) - tail.length };
}

/** Comment padding of exactly n bytes: lines of 1,000 bytes (`%` and P), the rest one short line (a lone byte is a space). */
function* padChunks(n) {
  const line = latin1(`%${"P".repeat(998)}\n`);
  let left = n;
  while (left >= 1000 + 2 || left === 1000) { yield line; left -= 1000; }
  if (left === 1) yield latin1(" ");
  else if (left > 1) yield latin1(`%${"P".repeat(left - 2)}\n`);
}

function truthFrom(recipe, pl, info = {}) {
  const enc = recipe.encryption ? { method: recipe.encryption.method, user: recipe.encryption.user ?? "" } : null;
  const locked = enc && enc.user !== "";
  const pages = pl.pages.map((pg) => {
    let lines = pg.lines.slice();
    const k = recipe.revisions ?? 0;
    for (let r = 1; r <= k; r++) if (revisedPage(pl, r) === pg) lines.push(revisionLine(pl, pg, r));
    let unread = locked ? "ENCRYPTED" : pg.lines.length && pg.font.unread ? pg.font.unread : null;
    if (info.cutPages?.has(pg.page)) unread = "TRUNCATED";
    return {
      page: pg.page, kind: pg.kind, font: pg.lines.length ? pg.fontName : null, lines, ocr: pg.ocr,
      text: lines.join("\n"), unread, rotate: pg.rotate, box: pg.box,
    };
  });
  const extra = recipe.hostile?.pages ?? 0;
  const markOf = (pg, at) => { const all = [...pg.lines, ...pg.ocr]; const l = all[at === "first" ? 0 : at === "last" ? all.length - 1 : Math.floor((all.length - 1) / 2)]; return l ? l.split(" ")[0] : null; };
  const withText = pages.filter((p) => p.lines.length || p.ocr.length);
  const mid = withText[Math.floor((withText.length - 1) / 2)];
  return {
    kind: "pdf", recipe, pages: pages.length + extra,
    page: (n) => pages[n - 1] ?? (n <= pages.length + extra ? { page: n, kind: "blank", font: null, lines: [], ocr: [], text: "", unread: null, rotate: 0, box: [612, 792] } : undefined),
    *units() { for (const p of pages) for (const l of [...p.lines, ...p.ocr]) yield { page: p.page, id: l.split(" ")[0], text: l, ocr: p.ocr.includes(l) }; },
    marks: withText.length ? { first: markOf(withText[0], "first"), middle: markOf(mid, "middle"), last: markOf(withText[withText.length - 1], "last") } : null,
    encryption: enc, structure: recipe.structure ?? "classic", revisions: recipe.revisions ?? 0,
    declared: recipe.declare ?? null, hostile: recipe.hostile ?? null, polyglot: recipe.polyglot ?? null,
    refusal: locked ? { code: "ENCRYPTED" } : recipe.bound && info.size > recipe.bound ? { code: "TOO_LARGE", size: info.size, bound: recipe.bound } : null,
    size: info.size ?? null,
  };
}

/** The PDF of a recipe (R19, R20): `{kind, ext, type, size, truth, chunks(), bytes()}`. */
export function generate(recipe) {
  const L = layout(recipe);
  let size = L.parts.reduce((n, p) => n + partBytes(p), 0);
  let cut = null, cutPages = null;
  if (recipe.truncate !== undefined) {
    if (!(recipe.truncate > 0 && recipe.truncate < 1)) throw new Error("pdfgen: truncate must be a fraction between 0 and 1");
    cut = recipe.size?.bytes ?? Math.floor(size * recipe.truncate);
    if (recipe.size?.bytes !== undefined) cut = recipe.size.bytes;
    cutPages = new Set();
    for (const pg of L.pl.pages) {
      const ends = [L.built.pageNums[pg.page - 1], L.built.contentNums[pg.page - 1]].map((n) => L.offsets.get(n));
      if (ends.some((o) => typeof o === "number" && o + 64 > cut)) cutPages.add(pg.page);
    }
    size = cut;
  }
  const truth = truthFrom(recipe, L.pl, { size, cutPages });
  const parts = L.parts;
  async function* chunks() {
    let left = cut ?? Infinity;
    for (const p of parts) {
      if (left <= 0) return;
      const pieces = p instanceof Uint8Array ? [p] : padChunks(p.pad);
      for (const c of pieces) {
        if (left <= 0) return;
        const piece = c.length > left ? c.subarray(0, left) : c;
        left -= piece.length;
        yield piece;
      }
    }
  }
  return {
    kind: "pdf", ext: "pdf", type: "application/pdf", size, truth, chunks,
    bytes: async () => { const list = []; for await (const c of chunks()) list.push(c); return concat(list); },
  };
}

/** The truth of a recipe without building its file (R24); `size` is the recipe's `size.bytes` when it names one. */
export function truthOf(recipe) {
  /* which pages a cut loses depends on where their objects lie: lay the file out (in memory, nothing written) */
  if (recipe.truncate !== undefined) return generate(recipe).truth;
  const pl = plan(recipe);
  return truthFrom(recipe, pl, { size: recipe.size?.bytes ?? null });
}
