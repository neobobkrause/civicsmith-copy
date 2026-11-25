/* image-cover: an image's metadata stripped without re-encoding it (R8; N806, K2315, K2333).
 *
 * Each format's container is walked and what R2 allows is copied byte for byte: the structures that decide how the
 * coded data decodes, and the coded data itself; everything else (EXIF, XMP, IPTC, comments, colour profiles,
 * thumbnails, second images, anything after the image's end) is left behind. The only things written fresh are
 * the ones R2 writes fresh: a bare JFIF APP0 and Adobe APP14 (the colour transform flag), and the orientation as
 * a minimal EXIF holding Orientation alone. A structure kept unchanged keeps its own bytes, so an image that holds
 * nothing to remove is answered as it came (`changed: false`).
 *
 *   JPEG (any process)  the marker segments up to and between the scans (frame, tables, restart interval, DNL,
 *                       hierarchical markers, JPEG-LS's SOF55 and LSE), each scan's entropy-coded data, EOI.
 *   PNG                 IHDR, PLTE, tRNS, IDAT (as chunked), IEND; interlaced or not, any bit depth.
 *   GIF                 the header, the screen descriptor and global table, the image's graphic control
 *                       extension, its descriptor, local table and LZW data, the trailer.
 *   WebP                VP8X (its ICC, EXIF and XMP flags cleared), ALPH, VP8 or VP8L.
 *   JP2                 the signature, ftyp, jp2h (ihdr, bpcc, pclr, cmap, cdef and an enumerated colr; an ICC
 *                       colr is replaced by the enumerated space it describes), the first jp2c, its codestream's
 *                       COM markers removed.
 *   J2K codestream      every marker but COM, the tile-part lengths (SOT's Psot, TLM) adjusted for the bytes
 *                       removed; the packet data copied whole.
 *
 * The walk is pure (R6): it reads the bytes once and writes the answer once; nothing is decoded. */
import { CoverRefusal, orientationOf, orientationTiff, checkCount, checkStride } from "./geometry.mjs";
import { exifOrientation, checkMarkers } from "./jpeg.mjs";
import { crc32 } from "./png.mjs";
import { localize } from "../setup-words/index.mjs";

const truncated = (fmt, why) => new CoverRefusal("TRUNCATED_IMAGE_DATA", localize("image-cover.strip.the_fmt_data_ends_before", "the {fmt} data ends before the image does: {why}", { fmt: String(fmt), why: String(why) }));
const corrupt = (fmt, why) => new CoverRefusal("IMAGE_DATA_CORRUPT", localize("image-cover.strip.the_fmt_s_structure_cannot", "the {fmt}'s structure cannot be walked: {why}", { fmt: String(fmt), why: String(why) }));
const notStrippable = (why) => new CoverRefusal("NOT_A_STRIPPABLE_FORMAT", why);
const animated = (why) => new CoverRefusal("ANIMATED_IMAGE", why);

const u16 = (d, p) => (d[p] << 8) | d[p + 1];
const u32 = (d, p) => d[p] * 0x1000000 + ((d[p + 1] << 16) | (d[p + 2] << 8) | d[p + 3]);
const le32 = (d, p) => (d[p] | (d[p + 1] << 8) | (d[p + 2] << 16)) + d[p + 3] * 0x1000000;
const ascii = (d, p, n) => String.fromCharCode(...d.subarray(p, p + n));
const hex = (v) => `0x${v.toString(16).padStart(2, "0")}`;
const be16 = (v) => [v >> 8, v & 0xff];
const be32 = (v) => [v >>> 24, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];

/** Pieces of the answer (byte ranges of the input, or fresh bytes) joined once. */
function join(pieces) {
  const n = pieces.reduce((k, b) => k + b.length, 0);
  const out = new Uint8Array(n);
  let o = 0;
  for (const b of pieces) { out.set(b, o); o += b.length; }
  return out;
}

/* ── JPEG ─────────────────────────────────────────────────────────────────── */

/* Kept as they are: every frame header (SOF0–3, 5–7, 9–11, 13–15), DHT, DAC, DNL, DQT, DRI, DHP, EXP, and
 * JPEG-LS's SOF55 and LSE (T.87), which decide how the data decodes. Every APPn and COM is left behind. */
const JPEG_SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf, 0xf7]);
const JPEG_KEEP = new Set([...JPEG_SOF, 0xc4, 0xcc, 0xdb, 0xdc, 0xdd, 0xde, 0xdf, 0xf8]);
const JFIF_FRESH = Uint8Array.from([0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);

function segment(marker, body) { return Uint8Array.from([0xff, marker, ...be16(body.length + 2), ...body]); }

function stripJpeg(d) {
  checkMarkers(d);
  const kept = [];
  let p = 2, frame = false, hierarchical = false, scans = 0, jfif = false, adobe = null;
  for (;;) {
    if (p >= d.length) throw truncated("JPEG", "the file ends before EOI");
    if (d[p] !== 0xff) throw corrupt("JPEG", localize("image-cover.strip.no_marker_at_byte_p", "no marker at byte {p}", { p: String(p) }));
    while (p + 1 < d.length && d[p + 1] === 0xff) p++;                // fill bytes
    if (p + 1 >= d.length) throw truncated("JPEG", localize("image-cover.strip.the_file_ends_inside_a_marker", "the file ends inside a marker"));
    const m = d[p + 1];
    if (m === 0xd9) { kept.push(d.subarray(p, p + 2)); break; }
    if (m === 0xd8) throw corrupt("JPEG", localize("image-cover.strip.a_second_soi_at_byte", "a second SOI at byte {p}", { p: String(p) }));
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { kept.push(d.subarray(p, p + 2)); p += 2; continue; }
    if (p + 4 > d.length) throw truncated("JPEG", localize("image-cover.strip.marker_hex_s_length_runs", "marker {hex}'s length runs past the end of the file", { hex: String(hex(m)) }));
    const len = u16(d, p + 2), end = p + 2 + len;
    if (len < 2) throw corrupt("JPEG", localize("image-cover.strip.marker_hex_declares_length_len", "marker {hex} declares length {len}", { hex: String(hex(m)), len: String(len) }));
    if (end > d.length) throw truncated("JPEG", localize("image-cover.strip.marker_hex_runs_past_the", "marker {hex} runs past the end of the file", { hex: String(hex(m)) }));
    const body = d.subarray(p + 4, end);
    if (m >= 0xe0 && m <= 0xef) {
      /* left behind; before the first scan, JFIF's and Adobe's presence decide the colour transform */
      if (!scans && m === 0xe0 && body.length >= 5 && ascii(body, 0, 5) === "JFIF\0") jfif = true;
      if (!scans && m === 0xee && adobe === null && body.length >= 12 && ascii(body, 0, 5) === "Adobe") adobe = body[11];
    } else if (m === 0xfe) {
      /* a comment: left behind */
    } else if (m === 0xda) {
      if (!frame) throw corrupt("JPEG", localize("image-cover.strip.a_scan_before_the_frame_header", "a scan before the frame header"));
      scans++;
      let q = end;
      for (;;) {
        if (q >= d.length) throw truncated("JPEG", localize("image-cover.strip.the_file_ends_inside_scan", "the file ends inside scan {scans}'s data", { scans: String(scans) }));
        if (d[q] !== 0xff) { q++; continue; }
        if (q + 1 >= d.length) throw truncated("JPEG", localize("image-cover.strip.the_file_ends_inside_scan_2", "the file ends inside scan {scans}'s data", { scans: String(scans) }));
        const n = d[q + 1];
        if (n === 0 || (n >= 0xd0 && n <= 0xd7)) { q += 2; continue; }
        if (n === 0xff) { q++; continue; }
        break;
      }
      kept.push(d.subarray(p, q));
      p = q;
      continue;
    } else if (JPEG_KEEP.has(m)) {
      if (m === 0xde) hierarchical = true;
      if (JPEG_SOF.has(m)) {
        if (frame && !hierarchical) throw corrupt("JPEG", localize("image-cover.strip.a_second_frame_header_hex", "a second frame header {hex} outside a hierarchical image", { hex: String(hex(m)) }));
        frame = true;
      }
      kept.push(d.subarray(p, end));
    } else if (m >= 0xf0 && m <= 0xfd) {
      throw notStrippable(`the JPEG holds extension marker ${hex(m)}, which this module cannot judge`);
    } else if (m === 0xc8) {
      throw notStrippable("the JPEG holds the reserved JPG marker 0xc8, which this module cannot judge");
    } else {
      throw corrupt("JPEG", localize("image-cover.strip.reserved_marker_hex_at_byte", "reserved marker {hex} at byte {p}", { hex: String(hex(m)), p: String(p) }));
    }
    p = end;
  }
  if (!scans) throw corrupt("JPEG", "EOI before any scan");
  const o = exifOrientation(d);
  const head = [d.subarray(0, 2)];
  if (jfif) head.push(segment(0xe0, JFIF_FRESH));
  if (adobe !== null) head.push(segment(0xee, Uint8Array.from([0x41, 0x64, 0x6f, 0x62, 0x65, 0, 100, 0, 0, 0, 0, adobe])));
  if (o !== 1) head.push(segment(0xe1, Uint8Array.from([0x45, 0x78, 0x69, 0x66, 0, 0, ...orientationTiff(o)])));
  return join([...head, ...kept]);
}

/* ── PNG ──────────────────────────────────────────────────────────────────── */

const PNG_CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const PNG_KEEP = new Set(["IHDR", "PLTE", "tRNS", "IDAT", "IEND"]);

function stripPng(d) {
  const kept = [];
  let p = 8, first = true, idat = false, orientation = 0, exifAt = -1, count = 0;
  for (;;) {
    checkCount(++count, "chunks");
    if (p + 12 > d.length) throw truncated("PNG", localize("image-cover.strip.a_chunk_runs_past_the_end_of_the_file", "a chunk runs past the end of the file"));
    const len = u32(d, p), type = ascii(d, p + 4, 4);
    if (!/^[A-Za-z]{4}$/.test(type)) throw corrupt("PNG", localize("image-cover.strip.a_chunk_type_that_is", "a chunk type that is not four letters at byte {p}", { p: String(p) }));
    if (len > 0x7fffffff) throw corrupt("PNG", localize("image-cover.strip.chunk_type_declares_length_len", "chunk {type} declares length {len}", { type: String(type), len: String(len) }));
    const end = p + 12 + len;
    if (end > d.length) throw truncated("PNG", localize("image-cover.strip.chunk_type_runs_past_the_end_of_the_file", "chunk {type} runs past the end of the file", { type: String(type) }));
    if (first && type !== "IHDR") throw corrupt("PNG", "the first chunk is not IHDR");
    if (!first && type === "IHDR") throw corrupt("PNG", "a second IHDR");
    first = false;
    if (PNG_KEEP.has(type)) {
      if (crc32(d.subarray(p + 4, p + 8 + len)) !== u32(d, p + 8 + len)) throw corrupt("PNG", `chunk ${type} fails its CRC`);
      if (type === "IHDR" && len !== 13) throw corrupt("PNG", "IHDR is not 13 bytes");
      if (type === "IHDR") {
        const channels = PNG_CHANNELS[d[p + 17]];
        if (channels) checkStride(Math.ceil((u32(d, p + 8) * channels * d[p + 16]) / 8));
      }
      if (type === "IDAT") {
        if (idat === "done") throw corrupt("PNG", "IDAT chunks are not consecutive");
        idat = true;
      } else if (idat) idat = "done";
      kept.push(d.subarray(p, end));
      if (type === "IEND") break;
    } else {
      if (idat) idat = "done";
      if (type.charCodeAt(0) < 0x61) throw notStrippable(`the PNG holds critical chunk ${type}, which this module cannot judge`);
      if (type === "acTL" && len >= 4 && u32(d, p + 8) > 1) throw animated(`an animated PNG of ${u32(d, p + 8)} frames`);
      if (type === "eXIf" && !orientation) {
        orientation = orientationOf(d.subarray(p + 8, p + 8 + len));
        if (!idat) exifAt = kept.length;
      }
    }
    p = end;
  }
  if (!idat) throw corrupt("PNG", "no IDAT chunk");
  if (orientation > 1) {
    const body = orientationTiff(orientation);
    const t = Uint8Array.from("eXIf", (c) => c.charCodeAt(0));
    const chunk = Uint8Array.from([...be32(body.length), ...t, ...body, ...be32(crc32(join([t, body])))]);
    const at = exifAt >= 0 ? exifAt : kept.findIndex((k) => ascii(k, 4, 4) === "IDAT");
    kept.splice(at, 0, chunk);
  }
  return join([d.subarray(0, 8), ...kept]);
}

/* ── GIF ──────────────────────────────────────────────────────────────────── */

/** The end of the data sub-blocks starting at `q` (past the zero-length terminator). */
function subBlocks(d, q, what) {
  for (;;) {
    if (q >= d.length) throw truncated("GIF", localize("image-cover.strip.the_file_ends_inside_what", "the file ends inside {what}", { what: String(what) }));
    const n = d[q];
    q += 1 + n;
    if (n === 0) return q;
  }
}

function stripGif(d) {
  if (d.length < 13) throw truncated("GIF", localize("image-cover.strip.the_file_ends_inside_the_screen_descriptor", "the file ends inside the screen descriptor"));
  const gct = d[10] & 0x80 ? 3 << ((d[10] & 7) + 1) : 0;
  let p = 13 + gct;
  if (p > d.length) throw truncated("GIF", localize("image-cover.strip.the_file_ends_inside_the_global_colour_table", "the file ends inside the global colour table"));
  const kept = [d.subarray(0, p)];
  let gce = null, image = false;
  for (;;) {
    if (p >= d.length) throw truncated("GIF", localize("image-cover.strip.the_file_ends_before_the_trailer", "the file ends before the trailer"));
    const b = d[p];
    if (b === 0x3b) { kept.push(d.subarray(p, p + 1)); break; }
    if (b === 0x21) {
      if (p + 2 > d.length) throw truncated("GIF", localize("image-cover.strip.the_file_ends_inside_an_extension", "the file ends inside an extension"));
      const label = d[p + 1], end = subBlocks(d, p + 2, `extension ${hex(label)}`);
      if (label === 0xf9) gce = d.subarray(p, end);                    // the last before the image is the image's
      p = end;
      continue;
    }
    if (b === 0x2c) {
      if (image) throw animated("a GIF of more than one frame");
      if (p + 10 > d.length) throw truncated("GIF", localize("image-cover.strip.the_file_ends_inside_the_image_descriptor", "the file ends inside the image descriptor"));
      const lct = d[p + 9] & 0x80 ? 3 << ((d[p + 9] & 7) + 1) : 0;
      const at = p + 10 + lct;
      if (at + 1 > d.length) throw truncated("GIF", localize("image-cover.strip.the_file_ends_before_the_image_data", "the file ends before the image data"));
      if (d[at] < 1 || d[at] > 11) throw corrupt("GIF", localize("image-cover.strip.an_lzw_minimum_code_size", "an LZW minimum code size of {v1}", { v1: String(d[at]) }));
      const end = subBlocks(d, at + 1, "the image data");
      if (gce) kept.push(gce);
      kept.push(d.subarray(p, end));
      image = true;
      gce = null;
      p = end;
      continue;
    }
    throw corrupt("GIF", localize("image-cover.strip.block_hex_at_byte_p", "block {hex} at byte {p} is neither an extension, an image nor the trailer", { hex: String(hex(b)), p: String(p) }));
  }
  if (!image) throw corrupt("GIF", localize("image-cover.strip.the_trailer_before_any_image", "the trailer before any image"));
  return join(kept);
}

/* ── WebP ─────────────────────────────────────────────────────────────────── */

const VP8X_ICC = 0x20, VP8X_EXIF = 0x08, VP8X_XMP = 0x04, VP8X_ANIM = 0x02;

function riffChunk(fourcc, body) {
  const n = body.length;
  return join([Uint8Array.from(fourcc, (c) => c.charCodeAt(0)), Uint8Array.from([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, n >>> 24]),
    body, n & 1 ? new Uint8Array(1) : new Uint8Array(0)]);
}

function stripWebp(d) {
  if (d.length < 12) throw truncated("WebP", "the file ends inside the RIFF header");
  const riffEnd = 8 + le32(d, 4);
  if (riffEnd > d.length) throw truncated("WebP", "the RIFF size runs past the end of the file");
  const kept = [];
  let p = 12, vp8x = -1, image = false, orientation = 0;
  while (p < riffEnd) {
    if (p + 8 > riffEnd) throw truncated("WebP", "a chunk header runs past the RIFF's end");
    const fourcc = ascii(d, p, 4), n = le32(d, p + 4), end = p + 8 + n + (n & 1);
    if (p + 8 + n > riffEnd) throw truncated("WebP", localize("image-cover.strip.chunk_fourcc_runs_past_the", "chunk {fourcc} runs past the RIFF's end", { fourcc: String(fourcc.trim()) }));
    const body = d.subarray(p + 8, p + 8 + n);
    if (fourcc === "VP8X") {
      if (p !== 12 || n < 10) throw corrupt("WebP", localize("image-cover.strip.a_vp8x_chunk_out_of_place_or_short", "a VP8X chunk out of place or short"));
      if (body[0] & VP8X_ANIM) throw animated("an animated WebP");
      vp8x = kept.length;
      kept.push(d.subarray(p, Math.min(end, riffEnd)));
    } else if (fourcc === "ANIM" || fourcc === "ANMF") {
      throw animated("an animated WebP");
    } else if (fourcc === "VP8 " || fourcc === "VP8L" || fourcc === "ALPH") {
      if (!image) kept.push(d.subarray(p, Math.min(end, riffEnd)));         // a second image is left behind
      if (fourcc !== "ALPH") image = true;
    } else if (fourcc === "EXIF" && !orientation) {
      const t = n >= 6 && ascii(body, 0, 6) === "Exif\0\0" ? body.subarray(6) : body;
      orientation = orientationOf(t);
    }
    p = end;
  }
  if (!image) throw corrupt("WebP", "no VP8 or VP8L image chunk");
  if (vp8x >= 0) {
    const old = kept[vp8x], flags = old[8];
    let next = flags & ~(VP8X_ICC | VP8X_EXIF | VP8X_XMP);
    if (orientation > 1) next |= VP8X_EXIF;
    if (next !== flags) { const x = Uint8Array.from(old); x[8] = next; kept[vp8x] = x; }
    if (orientation > 1) kept.push(riffChunk("EXIF", orientationTiff(orientation)));
  }
  const size = kept.reduce((k, b) => k + b.length, 4);
  return join([Uint8Array.from([0x52, 0x49, 0x46, 0x46, size & 0xff, (size >> 8) & 0xff, (size >> 16) & 0xff, size >>> 24, 0x57, 0x45, 0x42, 0x50]), ...kept]);
}

/* ── JPEG 2000 ────────────────────────────────────────────────────────────── */

/** A J2K codestream with its COM markers removed and the tile-part lengths (Psot, TLM's Ptlm) adjusted. Answers
 *  the input's own subarray when it held no COM. Everything after EOC is left behind. */
function stripCodestream(d, fmt) {
  if (d.length < 4 || d[0] !== 0xff || d[1] !== 0x4f || d[2] !== 0xff || d[3] !== 0x51) throw corrupt(fmt, "the codestream does not open with SOC and SIZ");
  const out = [d.subarray(0, 2)];
  const tlms = [];                 // {piece index, body offset in that piece} of each TLM segment
  const parts = [];                // each tile-part: {sot piece index, old Psot, removed bytes}
  let p = 2, removed = 0, markers = 0;
  const marker = (at) => {
    checkCount(++markers, "markers");
    if (at + 4 > d.length) throw truncated(fmt, localize("image-cover.strip.a_marker_runs_past_the_end_of_the_codestream", "a marker runs past the end of the codestream"));
    if (d[at] !== 0xff) throw corrupt(fmt, localize("image-cover.strip.no_marker_at_byte_at", "no marker at byte {at}", { at: String(at) }));
    const len = u16(d, at + 2);
    if (len < 2) throw corrupt(fmt, localize("image-cover.strip.marker_hex_declares_length_len_2", "marker {hex} declares length {len}", { hex: String(hex(d[at + 1])), len: String(len) }));
    if (at + 2 + len > d.length) throw truncated(fmt, localize("image-cover.strip.marker_hex_runs_past_the_2", "marker {hex} runs past the end of the codestream", { hex: String(hex(d[at + 1])) }));
    return { m: d[at + 1], end: at + 2 + len };
  };
  /* the main header, to the first SOT */
  for (;;) {
    if (p + 2 <= d.length && d[p] === 0xff && (d[p + 1] === 0x90 || d[p + 1] === 0xd9)) break;
    const { m, end } = marker(p);
    if (m === 0x64) removed += end - p;
    else {
      if (m === 0x55) tlms.push(out.length);
      out.push(d.subarray(p, end));
    }
    p = end;
  }
  /* the tile-parts */
  while (!(d[p] === 0xff && d[p + 1] === 0xd9)) {
    const { m, end: sotEnd } = marker(p);
    if (m !== 0x90 || sotEnd - p !== 12) throw corrupt(fmt, localize("image-cover.strip.expected_sot_at_byte_p", "expected SOT at byte {p}", { p: String(p) }));
    const psot = u32(d, p + 6), start = p;
    const last = psot === 0;
    const partEnd = last ? d.length - 2 : start + psot;
    if (!last && psot < 14) throw corrupt(fmt, localize("image-cover.strip.a_tile_part_length_of", "a tile-part length of {psot}", { psot: String(psot) }));
    if (partEnd > d.length || (last && !(d[d.length - 2] === 0xff && d[d.length - 1] === 0xd9)))
      throw truncated(fmt, localize("image-cover.strip.a_tile_part_runs_past_the_end_of_the_codestream", "a tile-part runs past the end of the codestream"));
    const sotAt = out.length;
    out.push(d.subarray(p, sotEnd));
    p = sotEnd;
    let cut = 0;
    for (;;) {
      if (p + 2 > partEnd) throw truncated(fmt, localize("image-cover.strip.a_tile_part_header_runs_past_its_tile_part", "a tile-part header runs past its tile-part"));
      if (d[p] === 0xff && d[p + 1] === 0x93) break;                         // SOD
      const { m: tm, end } = marker(p);
      if (end > partEnd) throw corrupt(fmt, localize("image-cover.strip.a_tile_part_header_marker_runs_past_its_tile_part", "a tile-part header marker runs past its tile-part"));
      if (tm === 0x64) cut += end - p;
      else out.push(d.subarray(p, end));
      p = end;
    }
    out.push(d.subarray(p, partEnd));                                       // SOD and the packet data
    parts.push({ sotAt, psot, cut });
    removed += cut;
    p = partEnd;
    if (p + 2 > d.length) throw truncated(fmt, "the codestream ends before EOC");
  }
  out.push(d.subarray(p, p + 2));
  if (!removed) return { bytes: d.subarray(0, p + 2), changed: false };
  /* the lengths the removal changed */
  for (const t of parts) {
    if (!t.cut || t.psot === 0) continue;
    const sot = Uint8Array.from(out[t.sotAt]);
    sot.set(be32(t.psot - t.cut), 6);
    out[t.sotAt] = sot;
  }
  if (parts.some((t) => t.cut && t.psot)) {
    const lengths = parts.map((t) => (t.psot ? t.psot - t.cut : 0));
    let k = 0;
    for (const at of tlms) {
      const seg = Uint8Array.from(out[at]), st = (seg[5] >> 4) & 3, sp = (seg[5] >> 6) & 1;
      const entry = st + (sp ? 4 : 2);
      if (st === 3 || (seg.length - 6) % entry) throw corrupt(fmt, "a TLM marker that cannot be read");
      for (let e = 6; e < seg.length; e += entry, k++) {
        if (k >= lengths.length) throw corrupt(fmt, "a TLM marker naming more tile-parts than the codestream holds");
        const v = lengths[k], q = e + st;
        if (!parts[k].cut) continue;
        if (sp) seg.set(be32(v), q);
        else { if (v > 0xffff) throw corrupt(fmt, "a TLM length that no longer fits"); seg.set(be16(v), q); }
      }
      out[at] = seg;
    }
  }
  return { bytes: join(out), changed: true };
}

const JP2_SIGNATURE = [0, 0, 0, 12, 0x6a, 0x50, 0x20, 0x20, 0x0d, 0x0a, 0x87, 0x0a];
const JP2H_KEEP = new Set(["ihdr", "bpcc", "pclr", "cmap", "cdef"]);

/** The boxes from `p` to `end`: `{type, at, head, end, xl, zero}`. */
function boxes(d, p, end) {
  const out = [];
  while (p < end) {
    checkCount(out.length + 1, "boxes");
    if (p + 8 > end) throw truncated("JP2", localize("image-cover.strip.a_box_header_runs_past_its_container", "a box header runs past its container"));
    let len = u32(d, p), head = 8;
    const type = ascii(d, p + 4, 4), xl = len === 1, zero = len === 0;
    if (xl) {
      if (p + 16 > end) throw truncated("JP2", localize("image-cover.strip.box_type_s_length_runs", "box {type}'s length runs past its container", { type: String(type) }));
      len = u32(d, p + 8) * 0x100000000 + u32(d, p + 12);
      head = 16;
    } else if (zero) len = end - p;
    if (len < head) throw corrupt("JP2", localize("image-cover.strip.box_type_declares_length_len", "box {type} declares length {len}", { type: String(type), len: String(len) }));
    if (p + len > end) throw truncated("JP2", localize("image-cover.strip.box_type_runs_past_its", "box {type} runs past its container", { type: String(type) }));
    out.push({ type, at: p, head, end: p + len, xl, zero });
    p += len;
  }
  return out;
}

/** A box of `type` around `body`, its length written in the form the original used. */
function box(b, type, body) {
  const t = Uint8Array.from(type, (c) => c.charCodeAt(0)), n = body.length;
  if (b?.zero) return join([Uint8Array.from([0, 0, 0, 0]), t, body]);
  if (b?.xl || n + 8 > 0xffffffff) {
    const total = n + 16;
    return join([Uint8Array.from([0, 0, 0, 1]), t, Uint8Array.from([...be32(Math.floor(total / 0x100000000)), ...be32(total >>> 0)]), body]);
  }
  return join([Uint8Array.from(be32(n + 8)), t, body]);
}

function stripJp2(d) {
  const top = boxes(d, 12, d.length);
  const ftyp = top[0];
  if (!ftyp || ftyp.type !== "ftyp") throw corrupt("JP2", localize("image-cover.strip.the_box_after_the_signature_is_not_ftyp", "the box after the signature is not ftyp"));
  const fb = d.subarray(ftyp.at + ftyp.head, ftyp.end);
  const brands = [ascii(fb, 0, 4)];
  for (let q = 8; q + 4 <= fb.length; q += 4) brands.push(ascii(fb, q, 4));
  if (!brands.includes("jp2 ")) throw notStrippable(`a JPEG 2000 file of brand "${brands[0].trim()}" that is not JP2-compatible`);
  const kept = [d.subarray(0, 12)];
  let header = false, stream = false;
  for (const b of top) {
    const body = d.subarray(b.at + b.head, b.end);
    if (b.type === "ftyp") kept.push(d.subarray(b.at, b.end));
    else if (b.type === "jp2h" && !header) {
      header = true;
      const kids = boxes(d, b.at + b.head, b.end);
      const ihdr = kids.find((k) => k.type === "ihdr");
      if (!ihdr || ihdr.end - ihdr.at - ihdr.head < 14) throw corrupt("JP2", "jp2h holds no ihdr");
      const nc = u16(d, ihdr.at + ihdr.head + 8), palette = kids.some((k) => k.type === "pclr");
      const inner = [];
      let colr = false, dropped = false;
      for (const k of kids) {
        if (JP2H_KEEP.has(k.type)) inner.push(d.subarray(k.at, k.end));
        else if (k.type === "colr" && !colr && d[k.at + k.head] === 1) { colr = true; inner.push(d.subarray(k.at, k.end)); }
        else dropped = true;
      }
      if (!colr) {
        /* an ICC profile (or none) in place of an enumerated space: the space it describes, enumerated */
        const cs = nc >= 3 || palette ? 16 : 17;                              // sRGB, or greyscale
        const at = inner.findIndex((x) => ascii(x, 4, 4) !== "ihdr" && ascii(x, 4, 4) !== "bpcc");
        inner.splice(at < 0 ? inner.length : at, 0, box(null, "colr", Uint8Array.from([1, 0, 0, ...be32(cs)])));
      }
      kept.push(dropped || !colr ? box(b, "jp2h", join(inner)) : d.subarray(b.at, b.end));
    } else if (b.type === "jp2c" && !stream) {
      if (!header) throw corrupt("JP2", "the codestream box before jp2h");
      stream = true;
      const cs = stripCodestream(body, "JP2");
      kept.push(cs.changed || cs.bytes.length !== body.length ? box(b, "jp2c", cs.bytes) : d.subarray(b.at, b.end));
    } else if (b.type === "ftbl") {
      throw notStrippable("a JPEG 2000 file whose codestream is held in fragments (ftbl)");
    }
    /* everything else (xml, uuid, uinf, jp2i, rreq, res, asoc, a second codestream) is left behind */
  }
  if (!header) throw corrupt("JP2", "no jp2h box");
  if (!stream) throw corrupt("JP2", "no jp2c codestream box");
  return join(kept);
}

/* ── the formats ──────────────────────────────────────────────────────────── */

const FORMATS = [
  ["jpeg", (d) => d.length >= 3 && d[0] === 0xff && d[1] === 0xd8 && d[2] === 0xff, stripJpeg],
  ["png", (d) => d.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => d[i] === v), stripPng],
  ["gif", (d) => d.length >= 6 && (ascii(d, 0, 6) === "GIF87a" || ascii(d, 0, 6) === "GIF89a"), stripGif],
  ["webp", (d) => d.length >= 12 && ascii(d, 0, 4) === "RIFF" && ascii(d, 8, 4) === "WEBP", stripWebp],
  ["jp2", (d) => d.length >= 12 && JP2_SIGNATURE.every((v, i) => d[i] === v), stripJp2],
  ["j2k", (d) => d.length >= 4 && d[0] === 0xff && d[1] === 0x4f && d[2] === 0xff && d[3] === 0x51, (d) => stripCodestream(d, "J2K").bytes],
];

/** Strip `d` (a byte array, size already checked): `{bytes, format, changed}`, or throws a CoverRefusal. */
export function stripImage(d) {
  const f = FORMATS.find(([, is]) => is(d));
  if (!f) throw notStrippable("the image is none of JPEG, PNG, GIF, WebP, JP2 or a J2K codestream");
  const [format, , strip] = f;
  const out = strip(d);
  const same = out.length === d.length && out.every((v, i) => v === d[i]);
  return { bytes: same ? Uint8Array.from(d) : out, format, changed: !same };
}
