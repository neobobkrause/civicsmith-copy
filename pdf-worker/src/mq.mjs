/* mq.mjs — the MQ arithmetic decoder, shared by `jbig2decode.mjs` (ITU-T T.88
 * Annex E) and `jpxdecode.mjs` (ITU-T T.800 Annex C). The two standards define
 * the same coder with the same 47-state probability table, so there is ONE
 * implementation here rather than two that could drift apart.
 *
 * The register convention is T.800 C.3's: C is not inverted, BYTEIN adds the
 * next byte at bit 8 (bit 9 after a stuffed 0xFF), and a marker (0xFF followed
 * by a byte above 0x8F) feeds 1-bits for ever without advancing. The LPS test
 * is `Chigh < Qe`, taken before the interval is renormalised, which is the form
 * both reference decoders use (jbig2dec's software convention and OpenJPEG's
 * `opj_mqc_decode`) and which gives the same decisions as T.88's Figure E.15.
 *
 * WHAT THE DATA RUNNING OUT MEANS differs between the two callers, so it is
 * COUNTED here and judged by the caller. A JPEG 2000 code-block's terminated
 * segment may legitimately be read past its end (OpenJPEG appends an artificial
 * 0xFFFF marker for exactly that). A JBIG2 segment may not: jbig2dec treats a
 * read beyond the segment's data as fatal, and a stream cut short would
 * otherwise decode to a plausible picture made of the 1-bits the coder invents.
 * `overrun` counts the bytes the decoder needed and did not have.
 *
 * AS THE BYTES ARE CONSUMED (fix round 9, G132l (d)). A caller that may not read past
 * its data passes `onShort`, which is called, with the decoder, each time the decode
 * finds the data short; it throws the codec's own short-data refusal, so a region
 * taller than its data stops where the data runs out and not after every row has
 * been invented from 1-bits. The data ending in its 0xFFAC marker (T.88 E.2.9's
 * FLUSH) is the usual end, and the coder reads that marker for the 1-bits it
 * still owes its look-ahead: INITDEC reads two bytes ahead, and a whole stream
 * measured over 148 reference decodes feeds on the marker once or twice. Feeding
 * on it more than `MARKER_FEEDS` times (the look-ahead and slack for an encoder
 * that drops its trailing 0xFF bytes) is data the stream does not hold, and counts
 * as the bytes missing, exactly as a byte past a stream with no marker does.
 */

/* The marker byte-ins a whole stream may need beyond its data; see above. */
const MARKER_FEEDS = 4;

/* [Qe, NMPS, NLPS, SWITCH] — T.88 Table E.1 / T.800 Table C.2. */
const QE = [
  [0x5601, 1, 1, 1], [0x3401, 2, 6, 0], [0x1801, 3, 9, 0], [0x0ac1, 4, 12, 0],
  [0x0521, 5, 29, 0], [0x0221, 38, 33, 0], [0x5601, 7, 6, 1], [0x5401, 8, 14, 0],
  [0x4801, 9, 14, 0], [0x3801, 10, 14, 0], [0x3001, 11, 17, 0], [0x2401, 12, 18, 0],
  [0x1c01, 13, 20, 0], [0x1601, 29, 21, 0], [0x5601, 15, 14, 1], [0x5401, 16, 14, 0],
  [0x5101, 17, 15, 0], [0x4801, 18, 16, 0], [0x3801, 19, 17, 0], [0x3401, 20, 18, 0],
  [0x3001, 21, 19, 0], [0x2801, 22, 19, 0], [0x2401, 23, 20, 0], [0x2201, 24, 21, 0],
  [0x1c01, 25, 22, 0], [0x1801, 26, 23, 0], [0x1601, 27, 24, 0], [0x1401, 28, 25, 0],
  [0x1201, 29, 26, 0], [0x1101, 30, 27, 0], [0x0ac1, 31, 28, 0], [0x09c1, 32, 29, 0],
  [0x08a1, 33, 30, 0], [0x0521, 34, 31, 0], [0x0441, 35, 32, 0], [0x02a1, 36, 33, 0],
  [0x0221, 37, 34, 0], [0x0141, 38, 35, 0], [0x0111, 39, 36, 0], [0x0085, 40, 37, 0],
  [0x0049, 41, 38, 0], [0x0025, 42, 39, 0], [0x0015, 43, 40, 0], [0x0009, 44, 41, 0],
  [0x0005, 45, 42, 0], [0x0001, 45, 43, 0], [0x5601, 46, 46, 0],
];
const Q_E = Int32Array.from(QE, (r) => r[0]);
const Q_NMPS = Uint8Array.from(QE, (r) => r[1]);
const Q_NLPS = Uint8Array.from(QE, (r) => r[2]);
const Q_SWITCH = Uint8Array.from(QE, (r) => r[3]);

/** Probability states for `n` contexts, each `(index << 1) | mps`, all zero:
 *  index 0, MPS 0, the initial state both standards give every context. */
export const mqContexts = (n) => new Uint8Array(n);

export class MqDecoder {
  /** Decode `data[start, end)`. `onShort(decoder)`, if given, is called each time the data is found short. */
  constructor(data, start = 0, end = data.length, { onShort = null } = {}) {
    this.d = data;
    this.bp = start;
    this.end = end;
    this.overrun = 0;
    this.fed = 0;
    this.onShort = onShort;
    this.C = (start < end ? data[start] : 0xff) * 65536;
    this.byteIn();
    this.C = (this.C << 7) >>> 0;
    this.ct -= 7;
    this.A = 0x8000;
  }

  byteIn() {
    const d = this.d, bp = this.bp;
    const b = bp < this.end ? d[bp] : 0xff;
    if (b === 0xff) {
      const b1 = bp + 1 < this.end ? d[bp + 1] : 0xff;
      if (b1 > 0x8f) {                 // a marker: 1-bits, and the pointer stays
        this.C += 0xff00;
        this.ct = 8;
        if (bp + 1 >= this.end || ++this.fed > MARKER_FEEDS) this.short();
      } else {
        this.bp = bp + 1;
        this.C += b1 << 9;
        this.ct = 7;
      }
    } else {
      this.bp = bp + 1;
      if (bp + 1 < this.end) this.C += d[bp + 1] << 8;
      else { this.C += 0xff00; this.short(); }
      this.ct = 8;
    }
  }

  /** The data is short by a byte: count it, and let the caller stop the decode here. */
  short() {
    this.overrun++;
    if (this.onShort) this.onShort(this);
  }

  /** One binary decision in context `cx` of `ctx` (a `mqContexts` array). */
  decode(ctx, cx) {
    const s = ctx[cx];
    let i = s >> 1, mps = s & 1;
    const qe = Q_E[i];
    let a = this.A - qe;
    let d;
    if (this.C / 65536 < qe) {
      /* LPS sub-interval, with the conditional exchange. */
      if (a < qe) { a = qe; d = mps; i = Q_NMPS[i]; }
      else { a = qe; d = 1 - mps; if (Q_SWITCH[i]) mps = d; i = Q_NLPS[i]; }
    } else {
      this.C -= qe * 65536;
      if (a & 0x8000) { this.A = a; return mps; }
      if (a < qe) { d = 1 - mps; if (Q_SWITCH[i]) mps = d; i = Q_NLPS[i]; }
      else { d = mps; i = Q_NMPS[i]; }
    }
    do {
      if (this.ct === 0) this.byteIn();
      a <<= 1;
      this.C = (this.C << 1) >>> 0;
      this.ct--;
    } while ((a & 0x8000) === 0);
    this.A = a;
    ctx[cx] = (i << 1) | mps;
    return d;
  }
}
