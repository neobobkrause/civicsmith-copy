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

/**
 * @typedef {Object} PdfSize
 * @property {number} [pages] absent is 3
 * @property {number} [lines] lines a page; absent is 20
 * @property {number} [bytes] the file's exact length, reached with comment padding (or the cut, with `truncate`)
 */
/**
 * @typedef {Object} PdfEncryption
 * @property {string} method "rc4" or "aes"
 * @property {string} [user] the user password; absent is "" (the file opens without one)
 * @property {string} [owner] absent is "owner"
 */
/**
 * @typedef {Object} PdfHeavy one page with many small lines
 * @property {number} page
 * @property {number} lines
 */
/**
 * @typedef {Object} PdfHuge one page with a box of its own
 * @property {number} page
 * @property {[number, number]} box width and height
 */
/**
 * @typedef {Object} PdfRotate every `every`th page turned by `angle`
 * @property {number} every
 * @property {number} angle
 */
/**
 * @typedef {Object} PdfScan
 * @property {number} [dpi] absent is 150
 * @property {number} [bits] 1 or 8; absent is 8
 */
/**
 * @typedef {Object} PdfDeclare what the file declares, beyond what it holds
 * @property {number} [length] bytes the first page's content stream /Length adds
 * @property {number} [count] the /Count of the page tree
 * @property {[number, number]} [image] the first image's declared width and height
 */
/**
 * @typedef {Object} PdfHostile
 * @property {number} [pages] empty pages added to the page tree
 * @property {number} [objects] empty objects added
 */
/**
 * @typedef {Object} PdfRecipe
 * @property {string} kind "pdf"
 * @property {string | number} [seed] letters, digits, _ . or - once written as text; required
 * @property {PdfSize} [size]
 * @property {readonly string[]} [fonts] each one of the font names; page p uses fonts[(p-1) % n]; absent is ["winansi"]
 * @property {readonly string[]} [kinds] each one of the page kinds, cycled; absent is ["text"]
 * @property {string} [structure] absent is "classic"
 * @property {number} [revisions]
 * @property {number} [truncate] a fraction between 0 and 1
 * @property {PdfEncryption} [encryption]
 * @property {PdfHeavy} [heavy]
 * @property {PdfHuge} [huge]
 * @property {PdfRotate} [rotate]
 * @property {PdfScan} [scan]
 * @property {PdfDeclare} [declare]
 * @property {PdfHostile} [hostile]
 * @property {string} [polyglot] "zip"
 * @property {boolean} [compress]
 * @property {number} [bound] the size a reader refuses beyond
 */
/** @typedef {"winansi" | "macroman" | "differences" | "type0" | "type0-nounicode" | "type3"} FontName */
/** @typedef {"text" | "scan" | "mixed" | "folio" | "blank" | "vector"} PageKind */
/**
 * @typedef {Object} PdfPageTruth
 * @property {number} page
 * @property {PageKind | undefined} kind undefined when the recipe's `kinds` is empty
 * @property {FontName | null | undefined} font null on a page with no text lines
 * @property {string[]} lines
 * @property {string[]} ocr
 * @property {string} text
 * @property {string | null} unread
 * @property {number} rotate
 * @property {[number, number]} box
 */
/**
 * @typedef {Object} PdfUnit
 * @property {number} page
 * @property {string} id
 * @property {string} text
 * @property {boolean} ocr
 */
/**
 * @typedef {Object} PdfMarks
 * @property {string | null} first
 * @property {string | null} middle
 * @property {string | null} last
 */
/**
 * @typedef {Object} PdfTruthEncryption
 * @property {string} method
 * @property {string} user
 */
/** @typedef {{code: "ENCRYPTED"}} PdfLockedRefusal the file opens only with a password */
/** @typedef {{code: "TOO_LARGE", size: number | null, bound: number}} PdfTooLargeRefusal */
/** @typedef {PdfLockedRefusal | PdfTooLargeRefusal} PdfRefusal */
/**
 * @typedef {Object} PdfTruth
 * @property {"pdf"} kind
 * @property {PdfRecipe} recipe
 * @property {number} pages
 * @property {(n: number) => PdfPageTruth | undefined} page
 * @property {() => Generator<PdfUnit, void, undefined>} units
 * @property {PdfMarks | null} marks
 * @property {PdfTruthEncryption | null} encryption
 * @property {string} structure
 * @property {number} revisions
 * @property {PdfDeclare | null} declared
 * @property {PdfHostile | null} hostile
 * @property {string | null} polyglot
 * @property {PdfRefusal | null} refusal
 * @property {number | null} size
 */
/**
 * @typedef {Object} PdfFile
 * @property {"pdf"} kind
 * @property {"pdf"} ext
 * @property {"application/pdf"} type
 * @property {number} size
 * @property {PdfTruth} truth
 * @property {() => AsyncGenerator<Uint8Array, void, undefined>} chunks
 * @property {() => Promise<Uint8Array>} bytes
 */

/** @type {readonly string[]} */
export const KINDS = Object.freeze(["pdf"]);

/**
 * An entry this file has just made (an object it added, a page it planned): never missing.
 * @template T
 * @param {T | undefined} v
 * @returns {T}
 */
function made(v) {
  if (v === undefined) throw new Error("pdfgen: an entry it made is missing");
  return v;
}

/* ---- fonts: how each writes a line, and the words it can carry ---- */

const MAC = new Map([["é", 0x8e], ["ï", 0x95], ["ß", 0xa7], ["ñ", 0x96], ["Æ", 0xae], ["ø", 0xbf], ["ü", 0x9f], ["ç", 0x8d], ["ﬁ", 0xde], ["ﬂ", 0xdf], ["œ", 0xcf]]);
const NAMES = new Map([["é", "eacute"], ["ï", "idieresis"], ["ß", "germandbls"], ["ñ", "ntilde"], ["Æ", "AE"], ["ø", "oslash"], ["ü", "udieresis"], ["ç", "ccedilla"], ["ﬁ", "fi"], ["ﬂ", "fl"], ["œ", "oe"]]);
const DIFF_CODE = new Map([...NAMES.keys()].map((ch, i) => [ch, 128 + i]));
const LIGATURE_VOCAB = Object.freeze([...LATIN_VOCAB, "ﬁnance", "ﬂoor", "œuvre"]);
const DIGIT_NAMES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
/** @type {Map<string, string>} */
const ASCII_NAMES = new Map([[" ", "space"], ["-", "hyphen"], [".", "period"], ["_", "underscore"]]);
DIGIT_NAMES.forEach((name, i) => ASCII_NAMES.set(String(i), name));

/** @typedef {(text: string) => Uint8Array} Encode */
/**
 * @param {(ch: string) => number | undefined} map
 * @returns {Encode}
 */
const single = (map) => (text) => Uint8Array.from([...text], (ch) => {
  const code = ch.charCodeAt(0) < 128 ? ch.charCodeAt(0) : map(ch);
  if (code === undefined) throw new Error(`pdfgen: the font cannot write ${JSON.stringify(ch)}`);
  return code;
});
/** @param {string} ch @returns {number | undefined} */
const CP1252 = (ch) => (ch === "œ" ? 0x9c : ch.charCodeAt(0) <= 0xff ? ch.charCodeAt(0) : undefined);

/**
 * @typedef {Object} SimpleFont a Type 1 font with a single-byte encoding
 * @property {readonly string[]} vocab
 * @property {Encode} encode
 * @property {() => string} dict
 * @property {never} [cid]
 * @property {never} [type3]
 * @property {never} [unread]
 */
/**
 * @typedef {Object} Type3Font
 * @property {readonly string[]} vocab
 * @property {Encode} encode
 * @property {true} type3
 * @property {never} [cid]
 * @property {never} [unread]
 */
/**
 * @typedef {Object} CidFont a Type 0 font over CIDs, with or without a ToUnicode map
 * @property {readonly string[]} vocab
 * @property {true} cid
 * @property {boolean} toUnicode
 * @property {string} [unread]
 * @property {never} [type3]
 */
/** @typedef {SimpleFont | Type3Font | CidFont} Font */
/** @typedef {{winansi: SimpleFont, macroman: SimpleFont, differences: SimpleFont, type0: CidFont, "type0-nounicode": CidFont, type3: Type3Font}} Fonts */

/** @type {Fonts} */
const FONTS = {
  winansi: { vocab: LATIN_VOCAB, encode: single(CP1252), dict: () => "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>" },
  macroman: { vocab: LIGATURE_VOCAB, encode: single((ch) => MAC.get(ch)), dict: () => "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /MacRomanEncoding >>" },
  differences: {
    vocab: LIGATURE_VOCAB, encode: single((ch) => DIFF_CODE.get(ch)),
    dict: () => `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding << /Type /Encoding /BaseEncoding /StandardEncoding /Differences [128 ${[...NAMES.values()].map((n) => `/${n}`).join(" ")}] >> >>`,
  },
  type0: { vocab: VOCAB, cid: true, toUnicode: true },
  "type0-nounicode": { vocab: VOCAB, cid: true, toUnicode: false, unread: "NO_TOUNICODE" },
  type3: { vocab: ASCII_VOCAB, encode: single(() => undefined), type3: true },
};

/** @param {Uint8Array | readonly number[]} bytes @returns {string} */
const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
/** @param {string} s @returns {Uint8Array} */
const latin1 = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);
/** @param {readonly Uint8Array[]} list @returns {Uint8Array} */
const concat = (list) => { let n = 0; for (const b of list) n += b.length; const o = new Uint8Array(n); let k = 0; for (const b of list) { o.set(b, k); k += b.length; } return o; };

/* ---- the plan of a recipe: every page's kind, font, lines and box ---- */

/** @type {readonly string[]} */
const PAGE_KINDS = ["text", "scan", "mixed", "folio", "blank", "vector"];
/** @param {string} f @returns {f is FontName} */
const isFontName = (f) => f in FONTS;
/** @param {string} k @returns {k is PageKind} */
const isPageKind = (k) => PAGE_KINDS.includes(k);
/** @param {FontName | undefined} name @returns {Font | undefined} */
const fontOf = (name) => (name === undefined ? undefined : FONTS[name]);
/**
 * A page's font, read for `member`; a page an empty `fonts` gave no font fails as reading a member of nothing does.
 * @param {Font | undefined} font
 * @param {string} member
 * @returns {Font}
 */
function fontOrFail(font, member) {
  if (font === undefined) throw new TypeError(`Cannot read properties of undefined (reading '${member}')`);
  return font;
}

/**
 * @typedef {Object} PageLayout
 * @property {number} size
 * @property {number} leading
 * @property {number} column
 * @property {number} width
 */
/**
 * @typedef {Object} PlannedPage
 * @property {number} page
 * @property {PageKind | undefined} kind
 * @property {FontName | undefined} fontName
 * @property {Font | undefined} font
 * @property {string[]} lines
 * @property {string[]} ocr
 * @property {number} rotate
 * @property {[number, number]} box
 * @property {PageLayout} layout
 */
/**
 * @typedef {Object} Plan
 * @property {string} seed
 * @property {PdfSize} size
 * @property {readonly string[]} fonts
 * @property {PlannedPage[]} pages
 * @property {number} count
 */

/** @param {PdfRecipe} recipe @returns {Plan} */
function plan(recipe) {
  if (recipe.kind !== "pdf") throw new Error("pdfgen: kind must be pdf");
  const givenSeed = recipe.seed;
  if (givenSeed === undefined) throw new Error("pdfgen: recipe.seed is missing");
  const seed = String(givenSeed);
  if (!/^[A-Za-z0-9_.-]+$/.test(seed)) throw new Error("pdfgen: recipe.seed must be letters, digits, _ . or -");
  const size = recipe.size ?? {};
  const fonts = recipe.fonts ?? ["winansi"];
  for (const f of fonts) if (!isFontName(f)) throw new Error(`pdfgen: fonts has ${f}, not one of ${Object.keys(FONTS).join(", ")}`);
  const kinds = recipe.kinds ?? ["text"];
  for (const k of kinds) if (!isPageKind(k)) throw new Error(`pdfgen: kinds has ${k}`);
  const count = size.pages ?? 3, perPage = size.lines ?? 20;
  const heavyAt = recipe.heavy, hugeAt = recipe.huge, rotation = recipe.rotate;
  /** @type {PlannedPage[]} */
  const pages = [];
  for (let p = 1; p <= count; p++) {
    /* every entry was checked above; the checks are made again only to name their kinds */
    const k = kinds[(p - 1) % kinds.length], f = fonts[(p - 1) % fonts.length];
    const kind = k !== undefined && isPageKind(k) ? k : undefined;
    const fontName = f !== undefined && isFontName(f) ? f : undefined, font = fontOf(fontName);
    const n = heavyAt?.page === p ? heavyAt.lines : perPage;
    /** @type {string[]} */
    let lines = [];
    /** @type {string[]} */
    let ocr = [];
    /** @param {number} l @returns {string} */
    const textLine = (l) => { const vocab = fontOrFail(font, "vocab").vocab; return `${seed}-p${p}-l${l} ${vocab[hash32(seed, p, l) % vocab.length]}`; };
    if (kind === "text") lines = Array.from({ length: n }, (_, i) => textLine(i + 1));
    else if (kind === "folio") lines = [`${seed}-p${p}-l1 ${p}`];
    else if (kind === "scan") ocr = scanLines(seed, p, n);
    else if (kind === "mixed") {
      const half = Math.ceil(n / 2);
      lines = Array.from({ length: half }, (_, i) => textLine(i + 1));
      ocr = scanLines(seed, p, n).slice(half);
    }
    const rotate = rotation && p % rotation.every === 0 ? rotation.angle : 0;
    const heavy = heavyAt?.page === p;
    const layout = heavy ? { size: 4, leading: 5, column: 150, width: 180 } : { size: 10, leading: 14, column: Infinity, width: 0 };
    const columns = Math.max(1, Math.ceil(lines.length / Math.min(layout.column, Math.max(1, lines.length))));
    const rows = Math.min(lines.length, layout.column);
    /** @type {[number, number]} */
    let box = [612, Math.max(792, 144 + rows * layout.leading)];
    if (heavy) box = [Math.max(612, 144 + columns * layout.width), box[1]];
    if (hugeAt?.page === p) box = hugeAt.box;
    pages.push({ page: p, kind, fontName, font, lines, ocr, rotate, box, layout });
  }
  return { seed, size, fonts, pages, count };
}

/* ---- the objects ---- */

/**
 * @typedef {Object} StreamBody
 * @property {string} dict
 * @property {Uint8Array} data
 */
/**
 * @typedef {Object} PdfObject
 * @property {number} num
 * @property {string | StreamBody} body
 * @property {number} [declareMore] bytes the stream's /Length declares beyond its data
 * @property {boolean} [plain] written unencrypted (the encryption dictionary)
 * @property {boolean} [revised]
 */
/**
 * @typedef {Object} Built
 * @property {PdfObject[]} objs
 * @property {number[]} pageNums
 * @property {number[]} contentNums
 * @property {number} catalog
 * @property {boolean} compress
 */

/**
 * A PDF object list: `{num, body}` with body a string, or `{dict, data}` for a stream (its /Length written for it).
 * @param {PdfRecipe} recipe
 * @param {Plan} pl
 * @returns {Built}
 */
function objectsOf(recipe, pl) {
  /** @type {PdfObject[]} */
  const objs = [];
  /** @param {string | StreamBody} body @returns {number} */
  const add = (body) => { objs.push({ num: objs.length + 1, body }); return objs.length; };
  /* the catalog's and the page tree's bodies are written last, when the pages are known */
  const catalog = add(""), pagesObj = add("");
  const compress = recipe.compress === true;
  /** @param {string} dict @param {string | Uint8Array} text @returns {StreamBody} */
  const stream = (dict, text) => {
    const data = typeof text === "string" ? latin1(text) : text;
    return compress ? { dict: `<< ${dict} /Filter /FlateDecode >>`, data: new Uint8Array(deflateSync(data)) } : { dict: `<< ${dict} >>`, data };
  };

  /* fonts, one object each, shared by the pages that use them */
  /** @type {Map<FontName | undefined, number>} */
  const fontRef = new Map([]);
  const cidTable = (() => {
    /** @type {Set<string>} */
    const chars = new Set();
    for (const pg of pl.pages) if (fontOrFail(pg.font, "cid").cid) for (const l of pg.lines) for (const ch of l) chars.add(ch);
    return [...chars].sort();
  })();
  const cidOf = new Map(cidTable.map((ch, i) => [ch, i + 1]));
  for (const name of new Set(pl.pages.filter((pg) => pg.lines.length).map((pg) => pg.fontName))) {
    const f = fontOrFail(fontOf(name), "cid");
    if (f.cid) {
      const desc = add(`<< /Type /FontDescriptor /FontName /BioGen /Flags 4 /FontBBox [0 -200 1000 900] /ItalicAngle 0 /Ascent 900 /Descent -200 /CapHeight 700 /StemV 80 >>`);
      const cidFont = add(`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /BioGen /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${desc} 0 R /DW 600 /CIDToGIDMap /Identity >>`);
      let tu = "";
      if (f.toUnicode) {
        const lines = ["/CIDInit /ProcSet findresource begin", "12 dict begin", "begincmap", "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
          "/CMapName /BioGen-UCS def", "/CMapType 2 def", "1 begincodespacerange", "<0000> <FFFF>", "endcodespacerange"];
        for (let i = 0; i < cidTable.length; i += 100) {
          const part = cidTable.slice(i, i + 100);
          /* a character's CID is its place in cidTable, plus one (cidOf) */
          lines.push(`${part.length} beginbfchar`, ...part.map((ch, j) => `<${(i + j + 1).toString(16).padStart(4, "0").toUpperCase()}> <${hex(utf16be(ch))}>`), "endbfchar");
        }
        lines.push("endcmap", "CMapName currentdict /CMap defineresource pop", "end", "end");
        tu = ` /ToUnicode ${add(stream("", lines.join("\n")))} 0 R`;
      }
      fontRef.set(name, add(`<< /Type /Font /Subtype /Type0 /BaseFont /BioGen /Encoding /Identity-H /DescendantFonts [${cidFont} 0 R]${tu} >>`));
    } else if (f.type3) {
      const glyph = add(stream("", "600 0 0 0 500 700 d1 50 0 400 700 re f"));
      const chars = [..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -._"];
      /** @param {string} ch @returns {string} */
      const nameOf = (ch) => ASCII_NAMES.get(ch) ?? ch;
      const procs = chars.map((ch) => `/${nameOf(ch)} ${glyph} 0 R`).join(" ");
      const diffs = chars.map((ch) => `${ch.charCodeAt(0)} /${nameOf(ch)}`).join(" ");
      fontRef.set(name, add(`<< /Type /Font /Subtype /Type3 /FontBBox [0 0 600 700] /FontMatrix [0.001 0 0 0.001 0 0] /CharProcs << ${procs} >> /Encoding << /Type /Encoding /Differences [${diffs}] >> /FirstChar 32 /LastChar 122 /Widths [${Array.from({ length: 91 }, () => 600).join(" ")}] /Resources << >> >>`));
    } else fontRef.set(name, add(f.dict()));
  }
  /* every character of a CID font's lines is in cidOf (undefined would shift and mask to 0, as 0 does) */
  /** @param {PlannedPage} pg @param {string} text @returns {Uint8Array} */
  const encodeLine = (pg, text) => { const font = fontOrFail(pg.font, "cid"); return font.cid ? Uint8Array.from([...text].flatMap((ch) => { const c = cidOf.get(ch) ?? 0; return [c >> 8, c & 255]; })) : font.encode(text); };

  /* pages */
  /** @type {number[]} */
  const pageNums = [];
  /** @type {number[]} */
  const contentNums = [];
  /** @type {number[]} */
  const imageNums = [];
  for (const pg of pl.pages) {
    const [w, h] = pg.box;
    let ops = "";
    /** @type {string[]} */
    const res = [];
    if (pg.lines.length) {
      const L = pg.layout;
      ops += `BT /F1 ${L.size} Tf\n`;
      pg.lines.forEach((line, i) => {
        const col = Math.floor(i / L.column), row = i % L.column;
        /* the marker and the word are two text items, so a right-to-left word is one run of its own direction */
        const x = 72 + col * L.width, y = h - 72 - L.size - row * L.leading, [marker = "", word] = line.split(" ");
        ops += `1 0 0 1 ${x} ${y} Tm <${hex(encodeLine(pg, marker))}> Tj`;
        ops += word === undefined ? "\n" : ` 1 0 0 1 ${x + (marker.length + 8) * L.size * 0.6} ${y} Tm <${hex(encodeLine(pg, word))}> Tj\n`;
      });
      ops += "ET\n";
      res.push(`/Font << /F1 ${fontRef.get(pg.fontName)} 0 R >>`);
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
        /* (an index outside data reads undefined, which is not >= 128, as 0 is not) */
        for (let y = 0; y < sz.height; y++) for (let x = 0; x < sz.width; x++) if ((data[y * sz.width + x] ?? 0) >= 128) { const at = y * rb + (x >> 3); samples[at] = (samples[at] ?? 0) | (0x80 >> (x & 7)); }
      }
      const declaredImage = recipe.declare?.image;
      const declared = declaredImage && !imageNums.length ? declaredImage : [sz.width, sz.height];
      const im = add({ dict: `<< /Type /XObject /Subtype /Image /Width ${declared[0]} /Height ${declared[1]} /ColorSpace /DeviceGray /BitsPerComponent ${bits} /Filter /FlateDecode >>`, data: new Uint8Array(deflateSync(samples)) });
      imageNums.push(im);
      const top = pg.kind === "mixed" ? h / 2 : h;
      const scale = Math.min(w / sz.width, top / sz.height);
      ops += `q ${(sz.width * scale).toFixed(2)} 0 0 ${(sz.height * scale).toFixed(2)} 0 ${(top - sz.height * scale).toFixed(2)} cm /Im1 Do Q\n`;
      res.push(`/XObject << /Im1 ${im} 0 R >>`);
    }
    if (pg.kind === "vector") ops += Array.from({ length: 20 }, (_, i) => `${50 + i * 20} ${100 + i * 15} 100 40 re S`).join("\n") + "\n0 0 m 612 792 l S\n";
    const content = add(stream("", ops));
    const declaredLength = recipe.declare?.length;
    if (declaredLength && pg.page === 1) made(objs[content - 1]).declareMore = declaredLength;
    contentNums.push(content);
    const rot = pg.rotate ? ` /Rotate ${pg.rotate}` : "";
    pageNums.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${w} ${h}] /Resources << ${res.join(" ")} >> /Contents ${content} 0 R${rot} >>`));
  }
  const hostilePages = recipe.hostile?.pages;
  if (hostilePages) {
    const empty = add(stream("", ""));
    for (let i = 0; i < hostilePages; i++) pageNums.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents ${empty} 0 R >>`));
  }
  for (let i = 0; i < (recipe.hostile?.objects ?? 0); i++) add("<< >>");
  made(objs[catalog - 1]).body = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  made(objs[pagesObj - 1]).body = `<< /Type /Pages /Kids [${pageNums.map((n) => `${n} 0 R`).join(" ")}] /Count ${recipe.declare?.count ?? pageNums.length} >>`;
  return { objs, pageNums, contentNums, catalog, compress };
}

/** @param {string} ch @returns {number[]} */
function utf16be(ch) {
  /** @type {number[]} */
  const out = [];
  for (let i = 0; i < ch.length; i++) { const c = ch.charCodeAt(i); out.push(c >> 8, c & 255); }
  return out;
}

/* ---- encryption: the Standard security handler, R3 (RC4 128) and R4 (AESV2) ---- */

const PAD = Uint8Array.from(Buffer.from("28BF4E5E4E758A4164004E56FFFA01082E2E00B6D0683E802F0CA9FE6453697A", "hex"));
/** @param {...(string | Uint8Array)} parts @returns {Uint8Array} */
const md5 = (...parts) => new Uint8Array(createHash("md5").update(concat(parts.map((p) => (typeof p === "string" ? latin1(p) : p)))).digest());
/**
 * RC4 of `data` under `key` (here always a 16-byte key, so every index read below is inside its array).
 * @param {Uint8Array} key
 * @param {Uint8Array} data
 * @returns {Uint8Array}
 */
function rc4(key, data) {
  const s = Uint8Array.from({ length: 256 }, (_, i) => i);
  /** @param {Uint8Array} a @param {number} i @returns {number} */
  const at = (a, i) => a[i] ?? 0;
  /** @param {number} i @param {number} j @returns {void} */
  const swap = (i, j) => { const t = at(s, i); s[i] = at(s, j); s[j] = t; };
  for (let i = 0, j = 0; i < 256; i++) { j = (j + at(s, i) + at(key, i % key.length)) & 255; swap(i, j); }
  const out = new Uint8Array(data.length);
  for (let k = 0, i = 0, j = 0; k < data.length; k++) { i = (i + 1) & 255; j = (j + at(s, i)) & 255; swap(i, j); out[k] = at(data, k) ^ at(s, (at(s, i) + at(s, j)) & 255); }
  return out;
}
/** @param {string} pw @returns {Uint8Array} */
const padded = (pw) => concat([latin1(pw), PAD]).subarray(0, 32);
/** @param {Uint8Array} key @param {number} i @returns {Uint8Array} */
const xorKey = (key, i) => key.map((b) => b ^ i);

/**
 * @typedef {Object} Security
 * @property {string} dict the encryption dictionary
 * @property {Uint8Array} id the file identifier
 * @property {(num: number, data: Uint8Array) => Uint8Array} encrypt a stream's data, encrypted for its object
 */
/** @param {PdfEncryption} enc @param {string} seed @returns {Security} */
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
  /** @param {number} num @param {Uint8Array} data @returns {Uint8Array} */
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

/** @typedef {Uint8Array | {pad: number}} Part */
/** A part list: Uint8Arrays, and `{pad: n}` for n bytes of comment padding written lazily. @param {Part} p @returns {number} */
const partBytes = (p) => (p instanceof Uint8Array ? p.length : p.pad);

/** @param {PdfObject} o @param {Security | null} sec @returns {Uint8Array} */
function objBytes(o, sec) {
  const body = o.body;
  if (typeof body === "string") return latin1(`${o.num} 0 obj\n${body}\nendobj\n`);
  const data = sec ? sec.encrypt(o.num, body.data) : body.data;
  const length = data.length + (o.declareMore ?? 0);
  const dict = body.dict.replace(/>>\s*$/, ` /Length ${length} >>`);
  return concat([latin1(`${o.num} 0 obj\n${dict}\nstream\n`), data, latin1("\nendstream\nendobj\n")]);
}

const HEADER = latin1("%PDF-1.7\n%\xe2\xe3\xcf\xd3\n");
/** @param {readonly (number | null | undefined)[]} entries @param {number} [from] @returns {Uint8Array} */
const xrefTable = (entries, from = 0) => latin1(`xref\n${from} ${entries.length}\n${entries.map((e) => (e === null ? "0000000000 65535 f \n" : `${String(e).padStart(10, "0")} 00000 n \n`)).join("")}`);

/**
 * @typedef {Object} Serialised
 * @property {Part[]} parts
 * @property {Map<number, number>} offsets each object's byte offset (an object packed in an object stream has none)
 */
/**
 * @param {PdfRecipe} recipe
 * @param {Plan} pl
 * @param {Built} built
 * @param {number} pad
 * @returns {Serialised}
 */
function serialise(recipe, pl, built, pad) {
  const { objs } = built;
  const structure = recipe.structure ?? "classic";
  const encryption = recipe.encryption;
  const sec = encryption ? securityOf(encryption, pl.seed) : null;
  /** @type {Part[]} */
  const parts = [HEADER];
  let at = HEADER.length;
  /** @type {Map<number, number>} */
  const offsets = new Map([]);
  /** @param {Part} b @returns {void} */
  const push = (b) => { parts.push(b); at += partBytes(b); };
  /** @param {number} size @returns {string} */
  const trailerKeys = (size) => `/Size ${size} /Root ${built.catalog} 0 R${sec ? ` /Encrypt ${size - 1} 0 R /ID [<${hex(sec.id)}> <${hex(sec.id)}>]` : ""}`;
  let all = objs;
  if (sec) all = [...objs, { num: objs.length + 1, body: sec.dict, plain: true }];
  /** @param {PdfObject} o @returns {void} */
  const write = (o) => { offsets.set(o.num, at); push(objBytes(o, o.plain ? null : sec)); };

  if (structure === "classic" || structure === "damaged-xref" || structure === "no-xref") {
    all.forEach(write);
    if (pad) push({ pad });
    const size = all.length + 1;
    if (structure === "no-xref") { push(latin1(`trailer\n<< ${trailerKeys(size)} >>\n%%EOF\n`)); return { parts, offsets }; }
    const xrefAt = at;
    const shift = structure === "damaged-xref" ? 7 : 0;
    push(xrefTable([null, ...all.map((o) => made(offsets.get(o.num)) + shift)]));
    push(latin1(`trailer\n<< ${trailerKeys(size)} >>\nstartxref\n${xrefAt}\n%%EOF\n`));
    let last = xrefAt;
    /** @type {Map<number, PdfObject>} */
    const current = new Map([]);
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
    /** @type {PdfObject[]} */
    let packed = [];
    /** where each packed object lies: its object stream and its index there */
    /** @type {Map<number, {stream: number, index: number}>} */
    const inStream = new Map([]);
    if (structure === "object-streams") {
      packed = all.filter((o) => typeof o.body === "string" && !o.plain);
      all.filter((o) => !packed.includes(o)).forEach(write);
      /** @type {string[]} */
      const header = [];
      /** @type {string[]} */
      const bodies = [];
      let off = 0;
      for (const o of packed) { const b = `${o.body}\n`; header.push(`${o.num} ${off}`); bodies.push(b); off += b.length; }
      const head = `${header.join(" ")}\n`;
      const num = all.length + 1;
      const data = new Uint8Array(deflateSync(latin1(head + bodies.join(""))));
      write({ num, body: { dict: `<< /Type /ObjStm /N ${packed.length} /First ${head.length} /Filter /FlateDecode >>`, data } });
      packed.forEach((o, i) => inStream.set(o.num, { stream: num, index: i }));
    } else all.forEach(write);
    if (pad) push({ pad });
    const size = Math.max(...offsets.keys(), ...inStream.keys()) + 2, xnum = size - 1;
    offsets.set(xnum, at);
    /** @type {Uint8Array[]} */
    const rows = [];
    for (let n = 0; n < size; n++) {
      const packedAt = inStream.get(n);
      /* (every number below size has an offset or a place in the stream; undefined would shift and mask to 0, as 0 does) */
      const v = offsets.get(n) ?? 0;
      const r = new Uint8Array(7);
      if (n === 0) { r[0] = 0; r[5] = 0xff; r[6] = 0xff; }
      else if (packedAt) { r[0] = 2; r.set([packedAt.stream >>> 24, (packedAt.stream >>> 16) & 255, (packedAt.stream >>> 8) & 255, packedAt.stream & 255], 1); r[6] = packedAt.index; }
      else { r[0] = 1; r.set([v >>> 24, (v >>> 16) & 255, (v >>> 8) & 255, v & 255], 1); }
      rows.push(r);
    }
    const keys = trailerKeys(size).replace(/\/Encrypt \d+ 0 R/, sec ? `/Encrypt ${all.length} 0 R` : "");
    /** @type {PdfObject} */
    const xref = { num: xnum, body: { dict: `<< /Type /XRef ${keys} /W [1 4 2] >>`, data: concat(rows) } };
    const xa = at;
    push(objBytes(xref, null));
    push(latin1(`startxref\n${xa}\n%%EOF\n`));
    return { parts, offsets };
  }
  if (structure === "linearized") return linearized(recipe, pl, built, all, sec, pad);
  throw new Error(`pdfgen: structure must be classic, xref-stream, object-streams, linearized, damaged-xref or no-xref, got ${structure}`);
}

/**
 * The page revision k rewrites: the text pages in a single-byte font, in turn (an ASCII line is the same bytes in each).
 * @param {Plan} pl
 * @param {number} k
 * @returns {PlannedPage}
 */
function revisedPage(pl, k) {
  const pages = pl.pages.filter((pg) => pg.lines.length && !fontOrFail(pg.font, "cid").cid);
  if (!pages.length) throw new Error("pdfgen: revisions need a text page in a single-byte font");
  return made(pages[(k - 1) % pages.length]);
}

/**
 * Revision k: a page's content stream written again, with one line more.
 * @param {PdfRecipe} recipe
 * @param {Plan} pl
 * @param {Built} built
 * @param {number} k
 * @param {Map<number, PdfObject>} current
 * @returns {PdfObject}
 */
function revision(recipe, pl, built, k, current) {
  const pg = revisedPage(pl, k);
  const num = made(built.contentNums[pg.page - 1]);
  const body = made(current.get(num) ?? built.objs[num - 1]).body;
  if (typeof body === "string") throw new Error("pdfgen: a page's content is a stream it made");
  const text = new TextDecoder("latin1").decode(body.data);
  const added = revisionLine(pl, pg, k);
  const line = `BT /F1 10 Tf 1 0 0 1 72 ${Math.max(8, 200 - 12 * k)} Tm <${hex(FONTS.winansi.encode(added))}> Tj ET\n`;
  return { num, body: { dict: body.dict, data: latin1(text + line) }, revised: true };
}
/** @param {Plan} pl @param {PlannedPage} pg @param {number} k @returns {string} */
const revisionLine = (pl, pg, k) => `${pl.seed}-p${pg.page}-r${k} ${ASCII_VOCAB[hash32(pl.seed, "r", k) % ASCII_VOCAB.length]}`;

/**
 * @param {PdfRecipe} recipe
 * @param {Plan} pl
 * @param {Built} built
 * @param {PdfObject[]} all
 * @param {Security | null} sec
 * @param {number} pad
 * @returns {Serialised}
 */
function linearized(recipe, pl, built, all, sec, pad) {
  /* The linearization dictionary first, a first-page xref section after it, then every object, the main xref and a
     trailer whose startxref names the first-page section. /L, /T, /E and /Prev name offsets that depend on their own
     digits, so the layout is repeated until it stops moving. */
  const linNum = all.length + 1, size = linNum + 1;
  let guess = { L: 1000, T: 1000, E: 1000, main: 1000 };
  for (let round = 0; round < 12; round++) {
    /** @type {Part[]} */
    const parts = [HEADER];
    let at = HEADER.length;
    /** @type {Map<number, number>} */
    const offsets = new Map([]);
    /** @param {Part} b @returns {void} */
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

/** @param {PdfRecipe} recipe @returns {Uint8Array} */
const polyglotBytes = (recipe) => {
  const polyglot = recipe.polyglot;
  if (!polyglot) return new Uint8Array(0);
  if (polyglot !== "zip") throw new Error("pdfgen: polyglot must be zip");
  return makeZip([{ name: "polyglot.txt", data: "polyglot" }]);
};

/* ---- the file and its truth ---- */

/**
 * @typedef {Object} Layout
 * @property {Plan} pl
 * @property {Built} built
 * @property {Part[]} parts
 * @property {Map<number, number>} offsets
 * @property {number} size
 */
/** @param {PdfRecipe} recipe @returns {Layout} */
function layout(recipe) {
  const pl = plan(recipe);
  const built = objectsOf(recipe, pl);
  const tail = polyglotBytes(recipe);
  let out = serialise(recipe, pl, built, 0);
  /** @param {{parts: Part[]}} o @returns {number} */
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

/**
 * Comment padding of exactly n bytes: lines of 1,000 bytes (`%` and P), the rest one short line (a lone byte is a space).
 * @param {number} n
 * @returns {Generator<Uint8Array, void, undefined>}
 */
function* padChunks(n) {
  const line = latin1(`%${"P".repeat(998)}\n`);
  let left = n;
  while (left >= 1000 + 2 || left === 1000) { yield line; left -= 1000; }
  if (left === 1) yield latin1(" ");
  else if (left > 1) yield latin1(`%${"P".repeat(left - 2)}\n`);
}

/**
 * @typedef {Object} TruthInfo
 * @property {number | null} size
 * @property {Set<number> | null} [cutPages] the pages a cut loses
 */
/**
 * @param {PdfRecipe} recipe
 * @param {Plan} pl
 * @param {TruthInfo} info
 * @returns {PdfTruth}
 */
function truthFrom(recipe, pl, info) {
  const encryption = recipe.encryption;
  const enc = encryption ? { method: encryption.method, user: encryption.user ?? "" } : null;
  const locked = enc && enc.user !== "";
  const pages = pl.pages.map((pg) => {
    let lines = pg.lines.slice();
    const k = recipe.revisions ?? 0;
    for (let r = 1; r <= k; r++) if (revisedPage(pl, r) === pg) lines.push(revisionLine(pl, pg, r));
    /** @type {string | null} */
    let unread = null;
    if (locked) unread = "ENCRYPTED";
    else if (pg.lines.length) unread = fontOrFail(pg.font, "unread").unread || null;
    if (info.cutPages?.has(pg.page)) unread = "TRUNCATED";
    return {
      page: pg.page, kind: pg.kind, font: pg.lines.length ? pg.fontName : null, lines, ocr: pg.ocr,
      text: lines.join("\n"), unread, rotate: pg.rotate, box: pg.box,
    };
  });
  const extra = recipe.hostile?.pages ?? 0;
  /** @param {string} l @returns {string} */
  const idOf = (l) => l.split(" ")[0] ?? l;
  /** @param {PdfPageTruth} pg @param {"first" | "middle" | "last"} at @returns {string | null} */
  const markOf = (pg, at) => { const all = [...pg.lines, ...pg.ocr]; const l = all[at === "first" ? 0 : at === "last" ? all.length - 1 : Math.floor((all.length - 1) / 2)]; return l ? idOf(l) : null; };
  const withText = pages.filter((p) => p.lines.length || p.ocr.length);
  const mid = withText[Math.floor((withText.length - 1) / 2)];
  /* withText is empty exactly when these three are undefined */
  const firstPage = withText[0], lastPage = withText[withText.length - 1];
  const bound = recipe.bound;
  /** @type {PdfRefusal | null} */
  const refusal = locked ? { code: "ENCRYPTED" }
    /* (null compares as 0, as it does in `>`) */
    : bound && (info.size ?? 0) > bound ? { code: "TOO_LARGE", size: info.size, bound } : null;
  return {
    kind: "pdf", recipe, pages: pages.length + extra,
    page: (n) => pages[n - 1] ?? (n <= pages.length + extra ? { page: n, kind: "blank", font: null, lines: [], ocr: [], text: "", unread: null, rotate: 0, box: [612, 792] } : undefined),
    *units() { for (const p of pages) for (const l of [...p.lines, ...p.ocr]) yield { page: p.page, id: idOf(l), text: l, ocr: p.ocr.includes(l) }; },
    marks: firstPage && mid && lastPage ? { first: markOf(firstPage, "first"), middle: markOf(mid, "middle"), last: markOf(lastPage, "last") } : null,
    encryption: enc, structure: recipe.structure ?? "classic", revisions: recipe.revisions ?? 0,
    declared: recipe.declare ?? null, hostile: recipe.hostile ?? null, polyglot: recipe.polyglot ?? null,
    refusal,
    size: info.size ?? null,
  };
}

/**
 * The PDF of a recipe (R19, R20): `{kind, ext, type, size, truth, chunks(), bytes()}`.
 * @param {PdfRecipe} recipe
 * @returns {PdfFile}
 */
export function generate(recipe) {
  const L = layout(recipe);
  let size = L.parts.reduce((n, p) => n + partBytes(p), 0);
  /** @type {number | null} */
  let cut = null;
  /** @type {Set<number> | null} */
  let cutPages = null;
  const truncate = recipe.truncate;
  if (truncate !== undefined) {
    if (!(truncate > 0 && truncate < 1)) throw new Error("pdfgen: truncate must be a fraction between 0 and 1");
    /* size.bytes when the recipe names it, else the fraction of the whole */
    const bytes = recipe.size?.bytes;
    const at = bytes !== undefined ? bytes : Math.floor(size * truncate);
    cut = at;
    /** @type {Set<number>} */
    const lost = new Set();
    cutPages = lost;
    for (const pg of L.pl.pages) {
      const ends = [L.built.pageNums[pg.page - 1], L.built.contentNums[pg.page - 1]].map((n) => (n === undefined ? undefined : L.offsets.get(n)));
      if (ends.some((o) => typeof o === "number" && o + 64 > at)) lost.add(pg.page);
    }
    size = at;
  }
  const truth = truthFrom(recipe, L.pl, { size, cutPages });
  const parts = L.parts;
  /** @returns {AsyncGenerator<Uint8Array, void, undefined>} */
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
    bytes: async () => {
      /** @type {Uint8Array[]} */
      const list = [];
      for await (const c of chunks()) list.push(c);
      return concat(list);
    },
  };
}

/**
 * The truth of a recipe without building its file (R24); `size` is the recipe's `size.bytes` when it names one.
 * @param {PdfRecipe} recipe
 * @returns {PdfTruth}
 */
export function truthOf(recipe) {
  /* which pages a cut loses depends on where their objects lie: lay the file out (in memory, nothing written) */
  if (recipe.truncate !== undefined) return generate(recipe).truth;
  const pl = plan(recipe);
  return truthFrom(recipe, pl, { size: recipe.size?.bytes ?? null });
}
