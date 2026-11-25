/* doc-clean: one embedded image, judged from its bytes and either stripped, left as it is, or refused (R2, R3).
 *
 * `cleanImage(bytes, where)` answers `{bytes, changed}` or throws a `CleanRefusal`; `where` names the image in a
 * refusal's detail (a part or an object). `imageKind(bytes)` names an image format from its leading bytes, or `null`
 * when the bytes are not an image this module knows. Nothing here reads a name or a declared type. */
import { stripMetadata } from "../image-cover/index.mjs";
import { editXml } from "./xml.mjs";
import { CleanRefusal } from "./refusal.mjs";
import { word, localize } from "../setup-words/index.mjs";

export { CleanRefusal };

const at = (d, o, ...b) => d.length >= o + b.length && b.every((x, i) => d[o + i] === x);
/** The bytes `d[o, o + n)` as a string of one character per byte. */
export function latin1(d, o = 0, n = d.length - o) {
  let s = "";
  for (let i = o, end = Math.min(d.length, o + n); i < end; i += 0x8000) s += String.fromCharCode.apply(null, d.subarray(i, Math.min(end, i + 0x8000)));
  return s;
}
const ascii = latin1;
const u32le = (d, o) => (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16) | (d[o + 3] << 24)) >>> 0;

/** The ISO-BMFF brands of HEIF and AVIF files. */
const HEIF_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1", "avif", "avis", "mif2"]);

/** The image format of `d`, from its leading bytes, or `null`. */
export function imageKind(d) {
  if (at(d, 0, 0xff, 0xd8, 0xff)) return "jpeg";
  if (at(d, 0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "png";
  if (at(d, 0, 0x47, 0x49, 0x46, 0x38) && (d[4] === 0x37 || d[4] === 0x39) && d[5] === 0x61) return "gif";
  if (d.length >= 12 && ascii(d, 0, 4) === "RIFF" && ascii(d, 8, 4) === "WEBP") return "webp";
  if (at(d, 0, 0, 0, 0, 0x0c, 0x6a, 0x50, 0x20, 0x20)) return "jp2";
  if (at(d, 0, 0xff, 0x4f, 0xff, 0x51)) return "j2k";
  if (at(d, 0, 0x49, 0x49, 0x2a, 0) || at(d, 0, 0x4d, 0x4d, 0, 0x2a) || at(d, 0, 0x49, 0x49, 0x2b, 0) || at(d, 0, 0x4d, 0x4d, 0, 0x2b)) return "tiff";
  if (at(d, 0, 0xff, 0x0a) || at(d, 0, 0, 0, 0, 0x0c, 0x4a, 0x58, 0x4c, 0x20)) return "jxl";
  if (d.length >= 12 && ascii(d, 4, 4) === "ftyp") {
    const n = Math.min(d.length, (d[0] << 24 | d[1] << 16 | d[2] << 8 | d[3]) >>> 0);
    for (let o = 8; o + 4 <= n; o += 4) if (o !== 12 && HEIF_BRANDS.has(ascii(d, o, 4))) return "heif";
    return null;
  }
  if (at(d, 0, 0x42, 0x4d) && d.length >= 18 && [12, 40, 52, 56, 64, 108, 124].includes(u32le(d, 14))) return "bmp";
  if (d.length >= 44 && u32le(d, 0) === 1 && ascii(d, 40, 4) === " EMF") return "emf";
  if (at(d, 0, 0xd7, 0xcd, 0xc6, 0x9a) || ((at(d, 0, 1, 0, 9, 0) || at(d, 0, 2, 0, 9, 0)) && (d[4] === 0 && (d[5] === 1 || d[5] === 3)))) return "wmf";
  if (d.length >= 6 && ascii(d, 0, 6) === "VCLMTF") return "svm";
  if (at(d, 0, 0x1f, 0x8b, 0x08)) return "gzip";
  if (rootElement(d) === "svg") return "svg";
  return null;
}

/** What kind of video or audio `d` is, from its leading bytes, or `null` (R3 `EMBEDDED_MEDIA`, K2351). */
export function mediaKind(d) {
  if (d.length >= 12 && ascii(d, 4, 4) === "ftyp" && !imageKind(d)) return word("doc-clean.text.video_audio_file");
  if (d.length >= 12 && ascii(d, 0, 4) === "RIFF" && ["AVI ", "WAVE", "RMID", "CDXA"].includes(ascii(d, 8, 4))) return `a ${ascii(d, 8, 4).trim()} file`;
  if (d.length >= 12 && ascii(d, 0, 4) === "FORM" && ["AIFF", "AIFC"].includes(ascii(d, 8, 4))) return "an AIFF file";
  if (at(d, 0, 0x1a, 0x45, 0xdf, 0xa3)) return word("doc-clean.text.matroska_webm_file");
  if (at(d, 0, 0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11)) return word("doc-clean.text.windows_media_file");
  if (at(d, 0, 0x49, 0x44, 0x33) || (d[0] === 0xff && (d[1] & 0xe0) === 0xe0 && d[1] < 0xfe && (d[1] & 0x06) !== 0 && d[2] >> 4 !== 15 && ((d[2] >> 2) & 3) !== 3)) return word("doc-clean.text.mpeg_audio_file");
  if (d.length >= 4 && ["OggS", "fLaC", "MThd", ".snd", "FLV\x01"].includes(ascii(d, 0, 4))) return word("doc-clean.text.audio_video_file");
  if (at(d, 0, 0, 0, 1, 0xba) || at(d, 0, 0, 0, 1, 0xb3) || (d[0] === 0x47 && d[188] === 0x47 && d.length > 376 && d[376] === 0x47)) return word("doc-clean.text.mpeg_video_file");
  if (at(d, 0, 0x23, 0x21, 0x41, 0x4d, 0x52)) return word("doc-clean.text.amr_audio_file");
  return null;
}

/** The local name of an XML document's first element (after a BOM, the declaration, comments, processing
 *  instructions and a doctype), lower-cased, read from at most its first 4 KB; `null` when it does not start as XML. */
export function rootElement(d) {
  const s = ascii(d, d[0] === 0xef && d[1] === 0xbb && d[2] === 0xbf ? 3 : 0, Math.min(d.length, 4096));
  const m = /^\s*(?:(?:<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!DOCTYPE[^>[]*(?:\[[\s\S]*?\])?\s*>)\s*)*<([A-Za-z_][\w.-]*:)?([A-Za-z_][\w.-]*)/.exec(s);
  return m ? m[2].toLowerCase() : null;
}

/** Whether `d` holds a whole JPEG or PNG inside it (a metafile's embedded bitmap). */
function holdsRaster(d) {
  for (let i = 0; i + 8 <= d.length; i++) {
    if (d[i] === 0xff && d[i + 1] === 0xd8 && d[i + 2] === 0xff) return "a JPEG";
    if (d[i] === 0x89 && d[i + 1] === 0x50 && d[i + 2] === 0x4e && d[i + 3] === 0x47 && d[i + 4] === 0x0d && d[i + 5] === 0x0a) return "a PNG";
  }
  return null;
}

const NAMES = {
  tiff: localize("doc-clean.images.name_tiff", "a TIFF"),
  heif: localize("doc-clean.images.name_heif", "a HEIC or AVIF"),
  jxl: localize("doc-clean.images.name_jxl", "a JPEG XL"),
  emf: localize("doc-clean.images.name_emf", "an EMF"),
  wmf: localize("doc-clean.images.name_wmf", "a WMF"),
  svm: localize("doc-clean.images.name_svm", "an SVM"),
};

/** Gunzip `d` whole, capped at `max` bytes out; `null` when it cannot be read or runs over. */
async function gunzip(d, max) {
  try {
    const reader = new Blob([d]).stream().pipeThrough(new DecompressionStream("gzip")).getReader();
    const parts = [];
    let n = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      n += value.length;
      if (n > max) { await reader.cancel(); return null; }
      parts.push(value);
    }
    const out = new Uint8Array(n);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  } catch {
    return null;
  }
}

/** Gzip `d` afresh (no name, comment or time in its header). */
async function gzip(d) {
  const reader = new Blob([d]).stream().pipeThrough(new CompressionStream("gzip")).getReader();
  const parts = [];
  let n = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(value); n += value.length; }
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  out[4] = out[5] = out[6] = out[7] = 0;
  out[9] = 0xff;
  return out;
}

/** An EMF with its header's description string (the producing application and the picture's name) emptied: its
 *  characters zeroed and its length and offset set to 0 (R6, K2351). */
function emfWithoutDescription(d) {
  const n = u32le(d, 60), off = u32le(d, 64);
  if (d.length < 68 || u32le(d, 4) < 88 || (n === 0 && off === 0)) return { bytes: d, changed: false };
  const out = d.slice();
  if (off >= 88 && off + 2 * n <= Math.min(out.length, u32le(d, 4))) out.fill(0, off, off + 2 * n);
  out.fill(0, 60, 68);
  return { bytes: out, changed: true };
}

/** An SVG's editor-namespace elements and attributes (Inkscape, Sodipodi, Adobe) removed (R6, K2351). */
const SVG_RULES = { removeNs: ["editor"] };

/** A JBIG2 segment stream (as a PDF embeds it, without a file header) with its comment extension segments
 *  dropped, every other segment copied as it is (R6, K2351). Throws a refusal when its segments cannot be walked. */
export function jbig2WithoutComments(d, where) {
  const keep = [];
  let o = 0, changed = false;
  const bad = (why) => new CleanRefusal("IMAGE_NOT_CLEANABLE", localize("doc-clean.images.where_a_jbig2_stream_whose", "{where}: a JBIG2 stream whose segments cannot be walked ({why})", { where: String(where), why: String(why) }));
  while (o < d.length) {
    const start = o;
    if (o + 6 > d.length) throw bad(localize("doc-clean.images.a_truncated_segment_header", "a truncated segment header"));
    const num = ((d[o] << 24) | (d[o + 1] << 16) | (d[o + 2] << 8) | d[o + 3]) >>> 0, flags = d[o + 4];
    o += 5;
    let count = d[o] >> 5;
    if (count === 7) { count = ((d[o] & 0x1f) << 24 | d[o + 1] << 16 | d[o + 2] << 8 | d[o + 3]) >>> 0; o += 4 + Math.ceil((count + 1) / 8); }
    else if (count > 4) throw bad(localize("doc-clean.images.a_malformed_referred_to_count", "a malformed referred-to count"));
    else o += 1;
    o += count * (num <= 256 ? 1 : num <= 0x10000 ? 2 : 4) + (flags & 0x40 ? 4 : 1);
    if (o + 4 > d.length) throw bad(localize("doc-clean.images.a_truncated_segment_header", "a truncated segment header"));
    const len = ((d[o] << 24) | (d[o + 1] << 16) | (d[o + 2] << 8) | d[o + 3]) >>> 0;
    o += 4;
    if (len === 0xffffffff) throw bad(localize("doc-clean.images.a_segment_of_unstated_length", "a segment of unstated length"));
    if (o + len > d.length) throw bad(localize("doc-clean.images.a_segment_longer_than_the_stream", "a segment longer than the stream"));
    const ext = (flags & 0x3f) === 62 && len >= 4 ? (((d[o] << 24) | (d[o + 1] << 16) | (d[o + 2] << 8) | d[o + 3]) >>> 0) & 0x7fffffff : null;
    o += len;
    if (ext === 0x20000000 || ext === 0x20000002) { changed = true; continue; }
    keep.push(d.subarray(start, o));
  }
  if (!changed) return { bytes: d, changed: false };
  const out = new Uint8Array(keep.reduce((k, x) => k + x.length, 0));
  let w = 0;
  for (const x of keep) { out.set(x, w); w += x.length; }
  return { bytes: out, changed: true };
}

/** A gzip member's header rewritten to carry no name, comment, extra field or time; the deflate data and trailer
 *  unchanged. `null` when the header cannot be walked. */
function bareGzip(d) {
  const flg = d[3];
  let o = 10;
  if (flg & 4) { if (o + 2 > d.length) return null; o += 2 + (d[o] | (d[o + 1] << 8)); }
  for (const bit of [8, 16]) if (flg & bit) { while (o < d.length && d[o] !== 0) o++; o++; }
  if (flg & 2) o += 2;
  if (o > d.length) return null;
  if (o === 10 && (flg & 0x1e) === 0 && d[4] === 0 && d[5] === 0 && d[6] === 0 && d[7] === 0) return d;
  const out = new Uint8Array(10 + d.length - o);
  out.set([0x1f, 0x8b, 0x08, 0, 0, 0, 0, 0, d[8], 0xff]);
  out.set(d.subarray(o), 10);
  return out;
}

/** Strip, keep or refuse one image (R2, R3). `kind` is `imageKind(bytes)`, never `null`. */
export async function cleanImage(bytes, kind, where, maxInflated, scan) {
  switch (kind) {
    case "jpeg": case "png": case "gif": case "webp": case "jp2": case "j2k": {
      const r = stripMetadata(bytes);
      if (!r || !r.ok) throw new CleanRefusal(r?.code ?? "IMAGE_NOT_CLEANABLE", `${where}: ${r?.detail ?? localize("doc-clean.images.the_image_could_not_be_stripped", "the image could not be stripped")}`);
      return { bytes: r.bytes, changed: r.changed };
    }
    case "tiff": case "heif": case "jxl":
      throw new CleanRefusal("IMAGE_NOT_CLEANABLE", localize("doc-clean.images.where_v1_image_whose_metadata", "{where}: {v1} image, whose metadata this module cannot strip", { where: String(where), v1: String(NAMES[kind]) }));
    case "bmp": {
      const header = u32le(bytes, 14), compression = bytes.length >= 34 ? u32le(bytes, 30) : 0;
      if (header >= 40 && (compression === 4 || compression === 5))
        throw new CleanRefusal("IMAGE_NOT_CLEANABLE", localize("doc-clean.images.where_a_bmp_image_holding", "{where}: a BMP image holding {v1} image", { where: String(where), v1: String(compression === 4 ? "a JPEG" : "a PNG") }));
      const cs = header >= 108 && bytes.length >= 14 + 60 ? ascii(bytes, 14 + 56, 4) : "";
      if (cs === "DEBM" || cs === "KNIL")
        throw new CleanRefusal("IMAGE_NOT_CLEANABLE", localize("doc-clean.images.where_a_bmp_image_carrying", "{where}: a BMP image carrying a colour profile", { where: String(where) }));
      return { bytes, changed: false };
    }
    case "emf": case "wmf": case "svm": {
      const held = holdsRaster(bytes);
      if (held) throw new CleanRefusal("IMAGE_NOT_CLEANABLE", localize("doc-clean.images.where_v1_image_holding_held", "{where}: {v1} image holding {held} image", { where: String(where), v1: String(NAMES[kind]), held: String(held) }));
      return kind === "emf" ? emfWithoutDescription(bytes) : { bytes, changed: false };
    }
    case "svg": {
      const s = ascii(bytes, 0, bytes.length);
      const m = /<([\w.-]+:)?(image|metadata)(?=[\s/>])/i.exec(s);
      if (m) throw new CleanRefusal("IMAGE_NOT_CLEANABLE", localize("doc-clean.images.where_an_svg_image_with_an", "{where}: an SVG image with an <{tag}> element", { where: String(where), tag: m[2].toLowerCase() }));
      const out = await editXml(bytes, SVG_RULES, { where, scan });
      return { bytes: out, changed: out !== bytes };
    }
    case "gzip": {
      const inner = await gunzip(bytes, maxInflated);
      if (!inner) throw new CleanRefusal("IMAGE_NOT_CLEANABLE", localize("doc-clean.images.where_a_compressed_image_that", "{where}: a compressed image that cannot be read whole", { where: String(where) }));
      const k = imageKind(inner);
      const media = k ? null : mediaKind(inner);
      if (media) throw new CleanRefusal("EMBEDDED_MEDIA", localize("doc-clean.images.where_media_compressed", "{where}: {media}, compressed", { where: String(where), media: String(media) }));
      if (k && k !== "gzip") {
        const r = await cleanImage(inner, k, where, maxInflated, scan);
        if (r.changed) return { bytes: await gzip(r.bytes), changed: true };
      }
      const bare = bareGzip(bytes);
      if (!bare) throw new CleanRefusal("IMAGE_NOT_CLEANABLE", localize("doc-clean.images.where_a_compressed_image_whose", "{where}: a compressed image whose header cannot be read", { where: String(where) }));
      return { bytes: bare, changed: bare !== bytes };
    }
  }
  throw new CleanRefusal("IMAGE_NOT_CLEANABLE", localize("doc-clean.images.where_an_image_of_no", "{where}: an image of no format this module knows", { where: String(where) }));
}
