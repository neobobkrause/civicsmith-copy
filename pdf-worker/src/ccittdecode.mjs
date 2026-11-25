/* ccittdecode.mjs — CCITT Group 3 (one-dimensional) and Group 4 fax decoding:
 * a stream's bytes to packed 1-bit rows. Pure: no PDF, no PNG, no I/O, no state
 * between calls (image-codecs R2, R8). Moved out of `pagepixels.mjs` by K70/K115;
 * the rotation helpers (`getBit`/`setBit`) stay with the page code in `pdf-pixels`.
 */

import { localize } from "../../bio-plane/src/setup-words/index.mjs";
import { boundOf, statement } from "../../bio-plane/src/read-bounds.mjs";

/** The refusal of a size the decoder will not allocate for (image-codecs R12): the code is `IMAGE_TOO_LARGE`, the
 *  `detail` the declared size, the bound it was judged against and the sentence's key. A stream that merely cannot be
 *  read still throws a plain Error, as before. */
export class CcittRefusal extends Error {
  constructor(code, detail = {}) {
    super(`${code}${detail.note ? `: ${detail.note}` : ""}`);
    this.code = code;
    this.detail = detail;
  }
}

/* THE DECLARED SIZES (R12, fix round 9, G125a): the columns and rows a caller declares are judged against the table
 * before a row is allocated. The output is a bit a pixel, so the bound on pixels bounds the rows at `columns` wide. */
const PIXELS_MAX = boundOf("image", "pixels");
const EDGE_MAX = boundOf("image", "edge");
const tooLarge = (name, size, note, extra) => new CcittRefusal("IMAGE_TOO_LARGE", { note, bound_name: name, ...statement("image", name, size), ...extra });
const tooWide = (columns, rows) => tooLarge("edge", Math.max(columns, rows),
  localize("image-codecs.ccittdecode.the_picture_is_columns_wide", "the picture is {columns} wide and {rows} high, and the decoder reads an edge of at most {bound}", { columns: String(columns), rows: String(rows), bound: String(EDGE_MAX) }), { columns, rows });
const tooMany = (columns, rows) => tooLarge("pixels", columns * rows,
  localize("image-codecs.ccittdecode.the_picture_is_columns_wide_2", "the picture is {columns} wide and {rows} high, past the {bound} pixels the decoder reads", { columns: String(columns), rows: String(rows), bound: String(PIXELS_MAX) }), { columns, rows });

/* ── CCITT Group 3/4 ──────────────────────────────────────────────────────────
 * ITU-T T.4 / T.6. The tables below are the standard code books, written out in
 * full rather than generated, because a generated table is a second thing to be
 * wrong. Correctness is not argued from this comment: `pagepixels-corpus.probe`
 * checks the output PIXEL-EXACT against an independent decoder that shares no
 * code with this one, and refuses to report a figure without it.
 */

const WHITE_CODES = {
  "8:00110101": 0, "6:000111": 1, "4:0111": 2, "4:1000": 3, "4:1011": 4, "4:1100": 5,
  "4:1110": 6, "4:1111": 7, "5:10011": 8, "5:10100": 9, "5:00111": 10, "5:01000": 11,
  "6:001000": 12, "6:000011": 13, "6:110100": 14, "6:110101": 15, "6:101010": 16,
  "6:101011": 17, "7:0100111": 18, "7:0001100": 19, "7:0001000": 20, "7:0010111": 21,
  "7:0000011": 22, "7:0000100": 23, "7:0101000": 24, "7:0101011": 25, "7:0010011": 26,
  "7:0100100": 27, "7:0011000": 28, "8:00000010": 29, "8:00000011": 30, "8:00011010": 31,
  "8:00011011": 32, "8:00010010": 33, "8:00010011": 34, "8:00010100": 35, "8:00010101": 36,
  "8:00010110": 37, "8:00010111": 38, "8:00101000": 39, "8:00101001": 40, "8:00101010": 41,
  "8:00101011": 42, "8:00101100": 43, "8:00101101": 44, "8:00000100": 45, "8:00000101": 46,
  "8:00001010": 47, "8:00001011": 48, "8:01010010": 49, "8:01010011": 50, "8:01010100": 51,
  "8:01010101": 52, "8:00100100": 53, "8:00100101": 54, "8:01011000": 55, "8:01011001": 56,
  "8:01011010": 57, "8:01011011": 58, "8:01001010": 59, "8:01001011": 60, "8:00110010": 61,
  "8:00110011": 62, "8:00110100": 63,
  "5:11011": 64, "5:10010": 128, "6:010111": 192, "7:0110111": 256, "8:00110110": 320,
  "8:00110111": 384, "8:01100100": 448, "8:01100101": 512, "8:01101000": 576,
  "8:01100111": 640, "9:011001100": 704, "9:011001101": 768, "9:011010010": 832,
  "9:011010011": 896, "9:011010100": 960, "9:011010101": 1024, "9:011010110": 1088,
  "9:011010111": 1152, "9:011011000": 1216, "9:011011001": 1280, "9:011011010": 1344,
  "9:011011011": 1408, "9:010011000": 1472, "9:010011001": 1536, "9:010011010": 1600,
  "6:011000": 1664, "9:010011011": 1728,
};

const BLACK_CODES = {
  "10:0000110111": 0, "3:010": 1, "2:11": 2, "2:10": 3, "3:011": 4, "4:0011": 5,
  "4:0010": 6, "5:00011": 7, "6:000101": 8, "6:000100": 9, "7:0000100": 10,
  "7:0000101": 11, "7:0000111": 12, "8:00000100": 13, "8:00000111": 14, "9:000011000": 15,
  "10:0000010111": 16, "10:0000011000": 17, "10:0000001000": 18, "11:00001100111": 19,
  "11:00001101000": 20, "11:00001101100": 21, "11:00000110111": 22, "11:00000101000": 23,
  "11:00000010111": 24, "11:00000011000": 25, "12:000011001010": 26, "12:000011001011": 27,
  "12:000011001100": 28, "12:000011001101": 29, "12:000001101000": 30, "12:000001101001": 31,
  "12:000001101010": 32, "12:000001101011": 33, "12:000011010010": 34, "12:000011010011": 35,
  "12:000011010100": 36, "12:000011010101": 37, "12:000011010110": 38, "12:000011010111": 39,
  "12:000001101100": 40, "12:000001101101": 41, "12:000011011010": 42, "12:000011011011": 43,
  "12:000001010100": 44, "12:000001010101": 45, "12:000001010110": 46, "12:000001010111": 47,
  "12:000001100100": 48, "12:000001100101": 49, "12:000001010010": 50, "12:000001010011": 51,
  "12:000000100100": 52, "12:000000110111": 53, "12:000000111000": 54, "12:000000100111": 55,
  "12:000000101000": 56, "12:000001011000": 57, "12:000001011001": 58, "12:000000101011": 59,
  "12:000000101100": 60, "12:000001011010": 61, "12:000001100110": 62, "12:000001100111": 63,
  "10:0000001111": 64, "12:000011001000": 128, "12:000011001001": 192, "12:000001011011": 256,
  "12:000000110011": 320, "12:000000110100": 384, "12:000000110101": 448,
  "13:0000001101100": 512, "13:0000001101101": 576, "13:0000001001010": 640,
  "13:0000001001011": 704, "13:0000001001100": 768, "13:0000001001101": 832,
  "13:0000001110010": 896, "13:0000001110011": 960, "13:0000001110100": 1024,
  "13:0000001110101": 1088, "13:0000001110110": 1152, "13:0000001110111": 1216,
  "13:0000001010010": 1280, "13:0000001010011": 1344, "13:0000001010100": 1408,
  "13:0000001010101": 1472, "13:0000001011010": 1536, "13:0000001011011": 1600,
  "13:0000001100100": 1664, "13:0000001100101": 1728,
};

/* Extended make-up codes, shared by both colours (T.4 table 3). */
const EXT_CODES = {
  "11:00000001000": 1792, "11:00000001100": 1856, "11:00000001101": 1920,
  "12:000000010010": 1984, "12:000000010011": 2048, "12:000000010100": 2112,
  "12:000000010101": 2176, "12:000000010110": 2240, "12:000000010111": 2304,
  "12:000000011100": 2368, "12:000000011101": 2432, "12:000000011110": 2496,
  "12:000000011111": 2560,
};

const WHITE_ALL = { ...WHITE_CODES, ...EXT_CODES };
const BLACK_ALL = { ...BLACK_CODES, ...EXT_CODES };
const MAX_CODE_BITS = 14;

class BitReader {
  constructor(data) { this.d = data; this.pos = 0; }
  get eof() { return this.pos >= this.d.length * 8; }
  peek(n) {
    let v = "";
    for (let i = 0; i < n; i++) {
      const p = this.pos + i;
      const byte = this.d[p >> 3];
      v += byte === undefined ? "0" : ((byte >> (7 - (p & 7))) & 1) ? "1" : "0";
    }
    return v;
  }
  skip(n) { this.pos += n; }
  align() { this.pos = (this.pos + 7) & ~7; }
}

function readRun(br, table) {
  let total = 0;
  for (;;) {
    let hit = null;
    const window = br.peek(MAX_CODE_BITS);
    for (let len = 2; len <= MAX_CODE_BITS; len++) {
      const key = `${len}:${window.slice(0, len)}`;
      if (key in table) { hit = { len, run: table[key] }; break; }
    }
    if (!hit) return null;
    br.skip(hit.len);
    total += hit.run;
    if (hit.run < 64) return total;      // terminating code ends the run
    if (br.eof) return total;
  }
}

/**
 * Decode CCITT G3/G4 into packed 1-bit rows where a SET bit is WHITE.
 * Returns { packed, rowsDecoded }. Throws only on a structurally impossible
 * stream; a stream that simply ends early returns fewer rows, and the caller
 * turns that into TRUNCATED_IMAGE_DATA rather than padding it with white.
 */
export function ccittDecode(data, { K = 0, columns = 1728, rows = 0, byteAlign = false }) {
  const declared = rows && rows > 0;
  if (columns > EDGE_MAX || (declared && rows > EDGE_MAX)) throw tooWide(columns, rows || 0);
  if (declared && columns * rows > PIXELS_MAX) throw tooMany(columns, rows);
  /* rows not declared: the data may give as many as keep the output within the bound; one more is refused */
  const rowCap = Math.floor(PIXELS_MAX / Math.max(1, columns));
  const br = new BitReader(data);
  const rowBytes = Math.ceil(columns / 8);
  const out = [];
  let ref = [columns, columns];       // reference line: changing elements
  const maxRows = declared ? rows : rowCap + 1;

  const eol = () => br.peek(12) === "000000000001";

  if (K > 0) throw new Error("mixed-mode (K>0) CCITT is not decoded here");

  for (let r = 0; r < maxRows; r++) {
    if (byteAlign) br.align();
    while (eol()) {
      br.skip(12);
      if (K > 0) br.skip(1);           // mixed mode: the 1D/2D tag bit
    }
    if (br.eof) break;
    if (!declared && r >= rowCap) throw tooMany(columns, r + 1);

    /* K < 0 is pure 2D (G4); K == 0 is pure 1D (G3). MIXED mode (K > 0) carries
     * a per-row tag bit after each EOL, and a stream without EOLs gives no way
     * to read it — so it is REFUSED above rather than decoded as whichever mode
     * happened to be guessed. */
    const twoD = K < 0;

    const cur = [];
    let a0 = -1;
    let color = 0;                     // 0 = white
    let guard = 0;
    /* A row the data does not finish — the stream ends, or a code no table holds
     * — is NOT kept: decoding stops before it, so the caller sees fewer rows and
     * answers TRUNCATED_IMAGE_DATA. Before this, an unknown code ended the row as
     * white without consuming a bit, and every remaining row was minted white. */
    let broken = false;

    while (a0 < columns) {
      if (++guard > columns * 4 + 64) throw new Error("row did not terminate");
      if (br.eof) { broken = true; break; }

      if (twoD) {
        const w = br.peek(7);
        let a1;
        if (w[0] === "1") {                       // V0
          br.skip(1); a1 = b1(ref, a0, color);
        } else if (w.startsWith("011")) {         // VR1
          br.skip(3); a1 = b1(ref, a0, color) + 1;
        } else if (w.startsWith("010")) {         // VL1
          br.skip(3); a1 = b1(ref, a0, color) - 1;
        } else if (w.startsWith("001")) {         // Horizontal
          br.skip(3);
          const s = a0 < 0 ? 0 : a0;
          const r1 = readRun(br, color === 0 ? WHITE_ALL : BLACK_ALL);
          const r2 = readRun(br, color === 0 ? BLACK_ALL : WHITE_ALL);
          if (r1 == null || r2 == null) { broken = true; break; }
          const m1 = Math.min(columns, s + r1);
          const m2 = Math.min(columns, m1 + r2);
          cur.push(m1, m2);
          a0 = m2;
          continue;
        } else if (w.startsWith("0001")) {        // Pass
          br.skip(4);
          a0 = b2(ref, a0, color);
          continue;
        } else if (w.startsWith("000011")) {      // VR2
          br.skip(6); a1 = b1(ref, a0, color) + 2;
        } else if (w.startsWith("000010")) {      // VL2
          br.skip(6); a1 = b1(ref, a0, color) - 2;
        } else if (w.startsWith("0000011")) {     // VR3
          br.skip(7); a1 = b1(ref, a0, color) + 3;
        } else if (w.startsWith("0000010")) {     // VL3
          br.skip(7); a1 = b1(ref, a0, color) - 3;
        } else {
          broken = true; break;                   // EOFB / unknown: the data ends here
        }
        a1 = Math.max(0, Math.min(columns, a1));
        cur.push(a1);
        a0 = a1;
        color ^= 1;
      } else {
        const s = a0 < 0 ? 0 : a0;
        const run = readRun(br, color === 0 ? WHITE_ALL : BLACK_ALL);
        if (run == null) { broken = true; break; }
        const m = Math.min(columns, s + run);
        cur.push(m);
        a0 = m;
        color ^= 1;
      }
    }

    if (broken) break;

    const row = new Uint8Array(rowBytes).fill(0xff);   // start all white
    let pos = 0, c = 0;
    for (const t of cur) {
      if (c === 1) for (let x = pos; x < t && x < columns; x++) row[x >> 3] &= ~(0x80 >> (x & 7));
      pos = t; c ^= 1;
      if (pos >= columns) break;
    }
    if (c === 1 && pos < columns) {
      for (let x = pos; x < columns; x++) row[x >> 3] &= ~(0x80 >> (x & 7));
    }
    out.push(row);

    ref = cur.length ? cur.concat([columns, columns]) : [columns, columns];
  }

  const packed = new Uint8Array(out.length * rowBytes);
  out.forEach((row, i) => packed.set(row, i * rowBytes));
  return { packed, rowsDecoded: out.length };
}

/** b1: first changing element on the reference line strictly right of a0 whose
 *  colour is opposite to `color`. Reference transitions alternate, ref[even]
 *  being a white->black change. */
function b1(ref, a0, color) {
  let i = 0;
  while (i < ref.length && ref[i] <= a0) i++;
  // parity must match: white run -> we want a white->black transition (even)
  while (i < ref.length && (i & 1) !== color) i++;
  return i < ref.length ? ref[i] : ref[ref.length - 1];
}
function b2(ref, a0, color) {
  let i = 0;
  while (i < ref.length && ref[i] <= a0) i++;
  while (i < ref.length && (i & 1) !== color) i++;
  return i + 1 < ref.length ? ref[i + 1] : ref[ref.length - 1];
}
