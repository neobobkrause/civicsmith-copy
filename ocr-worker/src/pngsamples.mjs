/* THE INVERSE OF `pagepixels.mjs`'s PNG WRITER, and nothing more general.
 *
 * ---- WHY THIS EXISTS, AND WHY IT IS NOT A SECOND DECODER --------------------
 *
 * CPDF-12's renderer answers with a CONTAINER — a PNG for every decoded route,
 * the publisher's own JPEG for the pass-through one. The engine wants RGBA
 * samples: `OCREngine.loadImage` refuses anything shorter than width*height*4
 * (CPDF-15 measured that refusal, and it is why the 33.6 MB frame is not
 * avoidable by sending less). So something has to turn the container back into
 * samples inside the isolate.
 *
 * The alternative was to widen `renderPageToPixels` to hand back its samples,
 * and it was NOT taken for one reason: that file is another member's committed
 * build input, and widening it would stale `pdf-worker`'s artifact for a caller
 * that member does not have. This is the cheaper seam. **It is the inverse of a
 * writer 20 lines long that lives one import away, not a rival implementation of
 * a solved problem (D-164's rule), and it is not believed on the strength of
 * being written**: the suite decodes the renderer's own output and compares the
 * result against `pixels_sha256`, which the renderer computed from ITS samples
 * BEFORE any container existed. Two producers, one expectation, and the
 * expectation is not derived from the thing under test.
 *
 * ---- WHAT IT READS, AND WHAT IT REFUSES BY NAME -----------------------------
 *
 * Exactly the shapes `pagepixels.mjs` writes: colour type 0 (greyscale) at bit
 * depth 1 or 8, and colour type 2 (RGB) at bit depth 8, every scanline filter
 * type 0, no interlacing, no ancillary chunk that matters. Everything else —
 * another filter type, an interlaced image, a bit depth nobody writes here — is
 * a STATED refusal carrying what it saw. This module must never hand back a
 * frame it guessed at: a wrong frame OCRs to fluent nonsense, which is the exact
 * hazard `textchain.mjs` exists for.
 */

import { localize } from "../../bio-plane/src/setup-words/index.mjs";

/**
 * The name of a reason this module refuses with (a key of `PNG_REFUSALS`).
 * @typedef {"NOT_A_PNG" | "PNG_TRUNCATED" | "PNG_NO_IHDR" | "PNG_NO_IDAT" | "PNG_INTERLACED" | "PNG_UNSUPPORTED_SHAPE"
 *   | "PNG_FILTER_UNSUPPORTED" | "PNG_SHORT_RASTER" | "PNG_CORRUPT_DATA"} PngRefusalCode
 */
/**
 * What a refusal saw, beside its reason: each member is present only on the refusals that state it.
 * @typedef {Object} PngRefusalDetail
 * @property {string} [chunk] the chunk that runs past the end
 * @property {number} [at] where that chunk starts
 * @property {number} [interlace]
 * @property {number} [colorType]
 * @property {number} [bitDepth]
 * @property {number} [width]
 * @property {number} [height]
 * @property {string} [error] the name of the error the inflater raised
 * @property {number} [have] the inflated raster's length
 * @property {number} [need] the length the header's dimensions require
 * @property {number} [row]
 * @property {number | undefined} [filter] the filter type the row names
 */
/**
 * A STATED refusal: `detail` is the reason's sentence, and what it saw is beside it.
 * @typedef {{ ok: false, reason: PngRefusalCode, detail: string } & PngRefusalDetail} PngRefusal
 */
/**
 * The samples of a PNG this estate wrote (`pngToSamples`).
 * @typedef {Object} PngSamples
 * @property {true} ok
 * @property {number} width
 * @property {number} height
 * @property {number} bitDepth 1 or 8
 * @property {number} comps 1 (greyscale) or 3 (RGB)
 * @property {Uint8Array} packed the raster with every scanline's filter byte removed
 * @property {number} rowBytes the length of one row of `packed`
 */
/**
 * The samples `samplesToRgba` turns into a frame.
 * @typedef {Readonly<{ width: number, height: number, bitDepth: number, comps: number, packed: Uint8Array, rowBytes: number }>} SampleFrame
 */

/** Every reason this module can refuse with. Exported so the caller branches on
 *  the set rather than on a string, and so a suite can assert nothing is emitted
 *  that is not declared here. */
export const PNG_REFUSALS = {
  NOT_A_PNG: "the bytes do not carry a PNG signature",
  PNG_TRUNCATED: "a PNG chunk runs past the end of the bytes",
  PNG_NO_IHDR: "the PNG carries no IHDR",
  PNG_NO_IDAT: "the PNG carries no image data",
  PNG_INTERLACED: "the PNG is interlaced; this reader reads only the non-interlaced form it writes",
  PNG_UNSUPPORTED_SHAPE: "the PNG's colour type / bit depth pair is not one this estate writes",
  PNG_FILTER_UNSUPPORTED: localize("ocr-worker.pngsamples.a_scanline_uses_a_filter", "a scanline uses a filter type this reader does not implement"),
  PNG_SHORT_RASTER: localize("ocr-worker.pngsamples.the_inflated_raster_is_shorter", "the inflated raster is shorter than the header's dimensions require"),
  /* R7.5 (fix round 9, G132j): image data that does not inflate is a stream this reader refuses, stated, not a throw. */
  PNG_CORRUPT_DATA: localize("ocr-worker.pngsamples.the_image_data_of_the_png_does_not_inflate", "the image data of the PNG does not inflate: it is not a valid compressed stream"),
};

/** @param {PngRefusalCode} code @param {PngRefusalDetail} [detail] @returns {PngRefusal} */
const refuse = (code, detail = {}) => ({ ok: false, reason: code, detail: PNG_REFUSALS[code], ...detail });

const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** @param {Uint8Array} bytes @returns {Promise<Uint8Array>} */
async function inflateZlib(bytes) {
  const ds = new DecompressionStream("deflate");   /* zlib-wrapped — what an IDAT holds */
  const w = ds.writable.getWriter();
  /* the reader below reports a stream that does not inflate; the writer's own rejection is the same failure, handled there */
  w.write(bytes).then(() => w.close()).catch(() => {});
  /** @type {Uint8Array[]} */
  const chunks = [];
  const rd = ds.readable.getReader();
  for (;;) { const { done, value } = await rd.read(); if (done) break; chunks.push(value); }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

/** Read a PNG this estate wrote back to its SAMPLES.
 *
 *  Returns `{ ok:true, width, height, bitDepth, comps, packed }` where `packed`
 *  is the raster with every scanline's filter byte removed and nothing else
 *  changed — for bit depth 1 that is byte-for-byte the representation
 *  `normalisePacked` produces and `pixels_sha256` is taken over, which is what
 *  makes the round-trip assertion possible at all.
 *  @param {Uint8Array | ArrayBuffer} bytes
 *  @returns {Promise<PngRefusal | PngSamples>} */
export async function pngToSamples(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length < 8 || SIG.some((v, i) => b[i] !== v)) return refuse("NOT_A_PNG");
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);

  let width = 0, height = 0, ihdrDepth = 0, colorType = -1, interlace = 0, sawIhdr = false;
  /** @type {Uint8Array[]} */
  const idats = [];
  let p = 8;
  while (p + 8 <= b.length) {
    const len = dv.getUint32(p);
    /* `p + 8 <= b.length`, so these four bytes are always there */
    const type = String.fromCharCode(b[p + 4] ?? 0, b[p + 5] ?? 0, b[p + 6] ?? 0, b[p + 7] ?? 0);
    const dataAt = p + 8;
    if (dataAt + len + 4 > b.length) return refuse("PNG_TRUNCATED", { chunk: type, at: p });
    if (type === "IHDR") {
      if (len < 13) return refuse("PNG_TRUNCATED", { chunk: "IHDR" });
      width = dv.getUint32(dataAt); height = dv.getUint32(dataAt + 4);
      /* inside the chunk, which the check above holds within the bytes */
      ihdrDepth = dv.getUint8(dataAt + 8); colorType = dv.getUint8(dataAt + 9); interlace = dv.getUint8(dataAt + 12);
      sawIhdr = true;
    } else if (type === "IDAT") {
      idats.push(b.subarray(dataAt, dataAt + len));
    } else if (type === "IEND") break;
    p = dataAt + len + 4;
  }
  const bitDepth = ihdrDepth;
  if (!sawIhdr) return refuse("PNG_NO_IHDR");
  if (!idats.length) return refuse("PNG_NO_IDAT");
  if (interlace !== 0) return refuse("PNG_INTERLACED", { interlace });

  const comps = colorType === 0 ? 1 : colorType === 2 ? 3 : null;
  if (comps == null || !(bitDepth === 8 || (bitDepth === 1 && comps === 1)))
    return refuse("PNG_UNSUPPORTED_SHAPE", { colorType, bitDepth });
  if (!width || !height) return refuse("PNG_UNSUPPORTED_SHAPE", { width, height });

  /** @type {Uint8Array} */
  let z;
  const only = idats[0];
  if (idats.length === 1 && only) z = only;
  else {
    z = new Uint8Array(idats.reduce((n, c) => n + c.length, 0));
    let o = 0;
    for (const c of idats) { z.set(c, o); o += c.length; }
  }
  /** @type {Uint8Array} */
  let raw;
  try { raw = await inflateZlib(z); } catch (e) { return refuse("PNG_CORRUPT_DATA", { error: String((e instanceof Error && e.name) || "Error") }); }

  const rowBytes = bitDepth === 1 ? Math.ceil(width / 8) : width * comps;
  if (raw.length < (rowBytes + 1) * height)
    return refuse("PNG_SHORT_RASTER", { have: raw.length, need: (rowBytes + 1) * height, width, height });

  const packed = new Uint8Array(rowBytes * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (rowBytes + 1)];
    /* FILTER 0 ONLY, and it is a refusal rather than a best effort. This estate
       writes 0 for every scanline it produces (`encodePng1`/`encodePng8`), so a
       non-zero filter means these are not our bytes — and reconstructing a
       filtered scanline wrongly produces a plausible-looking frame, which is the
       one outcome worth refusing over. */
    if (f !== 0) return refuse("PNG_FILTER_UNSUPPORTED", { row: y, filter: f });
    packed.set(raw.subarray(y * (rowBytes + 1) + 1, (y + 1) * (rowBytes + 1)), y * rowBytes);
  }
  return { ok: true, width, height, bitDepth, comps, packed, rowBytes };
}

/** Samples -> the RGBA frame the engine will accept.
 *
 *  THE FRAME IS THE MEMORY, AND THE CALLER IS EXPECTED TO HAVE CHECKED ITS SIZE
 *  BEFORE CALLING (`member.mjs` does, against a bound CPDF-15 established BY
 *  REFUSAL). This function allocates it; it does not judge whether it should.
 *
 *  Bit depth 1: sample 1 is WHITE in PNG greyscale, which is what
 *  `pagepixels.mjs` writes and what the CCITT route normalises to. The padding
 *  bits at the end of a scanline are outside `width` and are never read here,
 *  so a frame is unaffected by them whether they were zeroed or not.
 *  @param {SampleFrame} samples
 *  @returns {Uint8Array} */
export function samplesToRgba({ width, height, bitDepth, comps, packed, rowBytes }) {
  const rgba = new Uint8Array(width * height * 4);
  let j = 0;
  if (bitDepth === 1) {
    for (let y = 0; y < height; y++) {
      const row = y * rowBytes;
      for (let x = 0; x < width; x++) {
        const v = ((packed[row + (x >> 3)] ?? 0) >> (7 - (x & 7))) & 1 ? 255 : 0;
        rgba[j] = v; rgba[j + 1] = v; rgba[j + 2] = v; rgba[j + 3] = 255; j += 4;
      }
    }
    return rgba;
  }
  for (let y = 0; y < height; y++) {
    const row = y * rowBytes;
    for (let x = 0; x < width; x++) {
      const s = row + x * comps;
      /* a sample outside `packed` reads as 0, as the typed array stores an absent one */
      const r = packed[s] ?? 0, g = comps === 3 ? packed[s + 1] ?? 0 : r, bl = comps === 3 ? packed[s + 2] ?? 0 : r;
      rgba[j] = r; rgba[j + 1] = g; rgba[j + 2] = bl; rgba[j + 3] = 255; j += 4;
    }
  }
  return rgba;
}
