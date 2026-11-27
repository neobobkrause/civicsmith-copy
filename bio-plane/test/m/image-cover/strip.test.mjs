/* image-cover: `stripMetadata` at its interface (R8, R9; and R6, R7 over it). The expectations are the reference's
 * (`fixtures/make-strip-fixtures.py`: Pillow over libjpeg-turbo, zlib, libwebp and OpenJPEG, the coded data located
 * by walking the original there), never this module's earlier output.
 *
 * The reference decoder here: libvips through `sharp` (libjpeg, libpng, libnsgif, libwebp) for JPEG, PNG, GIF and
 * WebP, and image-codecs' `decodeJpx` (pixel-exact with OpenJPEG, its R4 and R6) for JPEG 2000. Each answer's
 * decode, as displayed, must reach the hash Pillow gave the ORIGINAL. The structure walks below are this test's
 * own, so the R8 tests can say exactly what an answer holds. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pngDeclaring } from "./hostile.mjs";
import { stripMetadata, STRIP_REFUSALS, COVER_MAX_BYTES } from "../../../src/image-cover/index.mjs";
import { decodeJpx } from "../../../../pdf-worker/src/jpxdecode.mjs";
import { fixture, tiffIfd0 } from "./answers.mjs";

/** @import { Stripped, Refused } from "../../../src/image-cover/index.mjs" */
/** @import { Ifd0 } from "./answers.mjs" */
/**
 * One image the reference stripped (`fixtures/make-strip-fixtures.py`), and what it found in the original.
 * @typedef {Object} StripCase
 * @property {string} file
 * @property {string} format
 * @property {string} mode
 * @property {number} width
 * @property {number} height
 * @property {string} pixels_sha256
 * @property {number} orientation
 * @property {Array<[number, number]>} coded
 * @property {string[]} secrets
 * @property {boolean} [keeps_adobe]
 * @property {boolean} [keeps_jfif]
 * @property {boolean} [no_thumbnail]
 * @property {boolean} [unchanged]
 */
/**
 * @typedef {Object} StripCases
 * @property {StripCase[]} cases
 * @property {Array<{file: string, code: string}>} refusals
 */
/** @typedef {{m: number, body: Uint8Array}} Segment */

const sharp = createRequire(import.meta.url)("sharp");
/* this module's own fixture list, decoded where it is read */
const STRIP = /** @type {StripCases} */ (JSON.parse(readFileSync(new URL("./fixtures/strip-cases.json", import.meta.url), "utf8")));
/** @param {Uint8Array} b */
const sha = (b) => createHash("sha256").update(b).digest("hex");
/** @param {Uint8Array} d @param {number} p @param {number} n */
const ascii = (d, p, n) => String.fromCharCode(...d.subarray(p, p + n));
/** @param {Uint8Array} d @param {number} p */
const u16 = (d, p) => ((d[p] ?? 0) << 8) | (d[p + 1] ?? 0);
/** @param {Uint8Array} d @param {number} p */
const u32 = (d, p) => (d[p] ?? NaN) * 0x1000000 + (((d[p + 1] ?? 0) << 16) | ((d[p + 2] ?? 0) << 8) | (d[p + 3] ?? 0));
/** @param {Uint8Array} d @param {number} p */
const le32 = (d, p) => ((d[p] ?? 0) | ((d[p + 1] ?? 0) << 8) | ((d[p + 2] ?? 0) << 16)) + (d[p + 3] ?? NaN) * 0x1000000;
/**
 * The answer, which must be a stripped image.
 * @param {Stripped | Refused} a @param {string} why
 * @returns {Stripped}
 */
const stripped = (a, why) => {
  if (!a.ok) assert.fail(`${why}: ${a.code} ${a.detail}`);
  return a;
};
/** @type {Map<string, Stripped | Refused>} */
const answers = new Map([]);
/** @param {string} file @returns {Stripped} */
const answer = (file) => {
  const had = answers.get(file);
  if (had) return stripped(had, file);
  const a = stripMetadata(fixture(file));
  answers.set(file, a);
  return stripped(a, file);
};
/** The refusal's words. @param {Stripped | Refused} r */
const detailOf = (r) => (r.ok ? assert.fail("answered, not refused") : r.detail);
/** The Orientation tag an IFD0 holds. @param {Ifd0} ifd */
const orientationTag = (ifd) => {
  const t = ifd.tags[0x0112];
  assert.ok(t, "an Orientation tag");
  return t.value;
};
/** The first of `list` that `which` picks, which must be there. @template T @param {T[]} list @param {(x: T) => boolean} which @returns {T} */
const pick = (list, which) => {
  const x = list.find(which);
  assert.ok(x !== undefined, "it is there");
  return x;
};

/* ── the reference's decode, hashed as the fixture script hashes Pillow's ── */
/** @param {string} mode @param {number} w @param {number} h @param {Uint8Array} bytes */
function canon(mode, w, h, bytes) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(w); head.writeUInt32BE(h, 4);
  if (mode === "RGBA") { bytes = Uint8Array.from(bytes); for (let i = 0; i < bytes.length; i += 4) if (bytes[i + 3] === 0) bytes.fill(0, i, i + 4); }
  return sha(Buffer.concat([Buffer.from(mode), head, Buffer.from(bytes)]));
}
/** @param {StripCase} c @param {Uint8Array} d @returns {Promise<string>} */
async function decodeHash(c, d) {
  if (c.format === "jp2" || c.format === "j2k") {
    const o = decodeJpx(d), samples = o.samples;
    assert.ok(samples, `${c.file}: the reference decoded it`);
    if (c.mode === "L") return canon("L", o.width, o.height, samples);
    const rgba = new Uint8Array(o.width * o.height * 4);
    for (let i = 0; i < o.width * o.height; i++) { rgba.set(samples.subarray(3 * i, 3 * i + 3), 4 * i); rgba[4 * i + 3] = 255; }
    return canon("RGBA", o.width, o.height, rgba);
  }
  const s = sharp(d, { ignoreIcc: true }).autoOrient();
  /** @param {any} x a sharp pipeline (the package states no kinds here) */
  const raw = async (x) => x.raw().toBuffer({ resolveWithObject: true });
  if (c.mode === "CMYK") { const { data, info } = await raw(s.pipelineColourspace("cmyk").toColourspace("cmyk")); return canon("CMYK", info.width, info.height, data); }
  if (c.mode === "L") { const { data, info } = await raw(s.toColourspace("b-w")); return canon("L", info.width, info.height, data); }
  if (c.mode === "I") {
    const { data, info } = await s.toColourspace("grey16").raw({ depth: "ushort" }).toBuffer({ resolveWithObject: true });
    const i32 = Int32Array.from(new Uint16Array(data.buffer, data.byteOffset, data.length / 2));
    return canon("I", info.width, info.height, new Uint8Array(i32.buffer));
  }
  const { data, info } = await raw(s.ensureAlpha().toColourspace("srgb"));
  return canon("RGBA", info.width, info.height, data);
}

/* ── what an answer holds, walked here ── */
/** @param {Uint8Array} d @returns {{segs: Segment[], after: Uint8Array}} */
function jpegWalk(d) {
  assert.ok(d[0] === 0xff && d[1] === 0xd8, "SOI");
  /** @type {Segment[]} */
  const segs = [];
  let p = 2;
  for (;;) {
    assert.equal(d[p], 0xff, `a marker at ${p}`);
    const m = d[p + 1] ?? NaN;
    if (m === 0xd9) return { segs, after: d.subarray(p + 2) };
    if (m >= 0xd0 && m <= 0xd7) { segs.push({ m, body: d.subarray(p + 2, p + 2) }); p += 2; continue; }
    const end = p + 2 + u16(d, p + 2);
    segs.push({ m, body: d.subarray(p + 4, end) });
    p = end;
    if (m === 0xda) while (!(d[p] === 0xff && d[p + 1] !== 0 && !((d[p + 1] ?? NaN) >= 0xd0 && (d[p + 1] ?? NaN) <= 0xd7))) p++;
  }
}
/** @param {Uint8Array} d @returns {{chunks: Array<{type: string, body: Uint8Array}>, after: Uint8Array}} */
function pngWalk(d) {
  /** @type {Array<{type: string, body: Uint8Array}>} */
  const chunks = [];
  let p = 8;
  for (;;) {
    const len = u32(d, p), type = ascii(d, p + 4, 4);
    chunks.push({ type, body: d.subarray(p + 8, p + 8 + len) });
    p += 12 + len;
    if (type === "IEND") return { chunks, after: d.subarray(p) };
  }
}
/** @param {Uint8Array} d */
function gifWalk(d) {
  const gct = (d[10] ?? 0) & 0x80 ? 3 << (((d[10] ?? 0) & 7) + 1) : 0;
  /** @type {string[]} */
  const blocks = [];
  let p = 13 + gct;
  /** @param {number} q */
  const sub = (q) => { while (d[q]) q += 1 + (d[q] ?? 0); return q + 1; };
  while (d[p] !== 0x3b) {
    if (d[p] === 0x21) { const e = sub(p + 2); blocks.push(`ext${(d[p + 1] ?? NaN).toString(16)}`); p = e; continue; }
    assert.equal(d[p], 0x2c, `a block at ${p}`);
    const lct = (d[p + 9] ?? 0) & 0x80 ? 3 << (((d[p + 9] ?? 0) & 7) + 1) : 0;
    p = sub(p + 10 + lct + 1);
    blocks.push("image");
  }
  return { blocks, after: d.subarray(p + 1) };
}
/** @param {Uint8Array} d */
function webpWalk(d) {
  assert.equal(ascii(d, 0, 4), "RIFF"); assert.equal(ascii(d, 8, 4), "WEBP");
  const end = 8 + le32(d, 4);
  /** @type {Array<{type: string, body: Uint8Array}>} */
  const chunks = [];
  for (let p = 12; p < end;) { const n = le32(d, p + 4); chunks.push({ type: ascii(d, p, 4), body: d.subarray(p + 8, p + 8 + n) }); p += 8 + n + (n & 1); }
  return { chunks, after: d.subarray(end) };
}
/** @param {Uint8Array} d @param {number} [from] @param {number} [to] */
function boxWalk(d, from = 0, to = d.length) {
  let p = from;
  const end = to;
  /** @type {Array<{type: string, body: Uint8Array}>} */
  const out = [];
  while (p < end) {
    let len = u32(d, p), head = 8;
    if (len === 1) { len = u32(d, p + 8) * 2 ** 32 + u32(d, p + 12); head = 16; } else if (len === 0) len = end - p;
    out.push({ type: ascii(d, p + 4, 4), body: d.subarray(p + head, p + len) });
    p += len;
  }
  return out;
}
/**
 * A codestream's markers, and each tile-part's Psot against its true length, and the TLM's lengths.
 * @param {Uint8Array} cs
 */
function codestreamWalk(cs) {
  /** @type {number[]} */
  const markers = [];
  /** @type {number[]} */
  const tlm = [];
  /** @type {Array<{psot: number, length: number}>} */
  const parts = [];
  let p = 2;
  while (cs[p + 1] !== 0x90) {
    const m = cs[p + 1] ?? NaN, end = p + 2 + u16(cs, p + 2);
    markers.push(m);
    if (m === 0x55) { const st = ((cs[p + 5] ?? 0) >> 4) & 3, sp = ((cs[p + 5] ?? 0) >> 6) & 1; for (let e = p + 6; e < end; e += st + (sp ? 4 : 2)) tlm.push(sp ? u32(cs, e + st) : u16(cs, e + st)); }
    p = end;
  }
  while (cs[p + 1] === 0x90) {
    const psot = u32(cs, p + 6), start = p;
    p += 12;
    while (!(cs[p] === 0xff && cs[p + 1] === 0x93)) { markers.push(cs[p + 1] ?? NaN); p += 2 + u16(cs, p + 2); }
    const next = psot ? start + psot : cs.length - 2;
    parts.push({ psot, length: next - start });
    p = next;
  }
  assert.ok(cs[p] === 0xff && cs[p + 1] === 0xd9, "EOC where the tile-parts end");
  return { markers, parts, tlm, after: cs.subarray(p + 2) };
}

/**
 * Everything the answer holds, judged against R2: answers the orientation it carries.
 * @param {{format: string, file: string}} c
 * @param {Uint8Array} a
 * @returns {number}
 */
function judgeStructure(c, a) {
  if (c.format === "jpeg") {
    const { segs, after } = jpegWalk(a);
    assert.equal(after.length, 0, `${c.file}: bytes after EOI`);
    let o = 1;
    for (const s of segs) {
      assert.ok(!(s.m >= 0xe0 && s.m <= 0xef) || [0xe0, 0xe1, 0xee].includes(s.m), `${c.file}: APP${s.m - 0xe0}`);
      assert.notEqual(s.m, 0xfe, `${c.file}: a comment`);
      if (s.m === 0xe0) assert.deepEqual([...s.body], [0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0], "a bare JFIF, no thumbnail");
      if (s.m === 0xee) assert.equal(s.body.length, 12);
      if (s.m === 0xe1) {
        assert.equal(ascii(s.body, 0, 6), "Exif\0\0");
        const ifd = tiffIfd0(s.body.subarray(6));
        assert.deepEqual(Object.keys(ifd.tags).map(Number), [0x0112]);
        assert.equal(ifd.next, 0, "no IFD1, so no thumbnail");
        o = orientationTag(ifd);
      }
    }
    assert.equal(segs.filter((s) => s.m >= 0xe0 && s.m <= 0xef).length, new Set(segs.filter((s) => s.m >= 0xe0 && s.m <= 0xef).map((s) => s.m)).size, "each kept APPn once");
    return o;
  }
  if (c.format === "png") {
    const { chunks, after } = pngWalk(a);
    assert.equal(after.length, 0, `${c.file}: bytes after IEND`);
    let o = 1;
    for (const k of chunks) {
      assert.ok(["IHDR", "PLTE", "tRNS", "IDAT", "IEND", "eXIf"].includes(k.type), `${c.file}: chunk ${k.type}`);
      if (k.type === "eXIf") { const ifd = tiffIfd0(k.body); assert.deepEqual(Object.keys(ifd.tags).map(Number), [0x0112]); assert.equal(ifd.next, 0); o = orientationTag(ifd); }
    }
    return o;
  }
  if (c.format === "gif") {
    const { blocks, after } = gifWalk(a);
    assert.equal(after.length, 0, `${c.file}: bytes after the trailer`);
    assert.deepEqual(blocks.filter((b) => b !== "extf9"), ["image"], `${c.file}: ${blocks}`);
    return 1;
  }
  if (c.format === "webp") {
    const { chunks, after } = webpWalk(a);
    assert.equal(after.length, 0, `${c.file}: bytes after the RIFF`);
    let o = 1;
    for (const k of chunks) {
      assert.ok(["VP8X", "ALPH", "VP8 ", "VP8L", "EXIF"].includes(k.type), `${c.file}: chunk ${k.type}`);
      if (k.type === "VP8X") assert.equal((k.body[0] ?? 0) & (0x20 | 0x04), 0, "no ICC or XMP flag");
      if (k.type === "EXIF") { const ifd = tiffIfd0(k.body); assert.deepEqual(Object.keys(ifd.tags).map(Number), [0x0112]); assert.equal(ifd.next, 0); o = orientationTag(ifd); }
    }
    const x = chunks.find((k) => k.type === "VP8X");
    if (x) assert.equal(!!((x.body[0] ?? 0) & 0x08), chunks.some((k) => k.type === "EXIF"), "the EXIF flag says whether an EXIF chunk is there");
    return o;
  }
  let cs = a;
  if (c.format === "jp2") {
    const top = boxWalk(a);
    assert.deepEqual(top.map((b) => b.type), ["jP  ", "ftyp", "jp2h", "jp2c"], c.file);
    const jp2h = top[2], jp2c = top[3];
    assert.ok(jp2h && jp2c, c.file);
    const kids = boxWalk(jp2h.body);
    for (const k of kids) assert.ok(["ihdr", "colr", "bpcc", "pclr", "cmap", "cdef"].includes(k.type), `${c.file}: jp2h holds ${k.type}`);
    const colr = kids.filter((k) => k.type === "colr");
    assert.equal(colr.length, 1);
    assert.equal(colr[0]?.body[0], 1, "an enumerated colour space, no ICC profile");
    cs = jp2c.body;
  }
  const w = codestreamWalk(cs);
  assert.equal(w.after.length, 0, `${c.file}: bytes after EOC`);
  assert.ok(!w.markers.includes(0x64), `${c.file}: a COM marker`);
  for (const t of w.parts) if (t.psot) assert.equal(t.psot, t.length, `${c.file}: a tile-part's Psot`);
  if (w.tlm.length) assert.deepEqual(w.tlm, w.parts.map((t) => t.length), `${c.file}: the TLM's lengths`);
  return 1;
}

test("R9 for every format, a progressive JPEG and an interlaced PNG among them: the reference decoder's pixels for the answer, as displayed, equal its pixels for the input (the hash Pillow gave the original)", async () => {
  /** @type {Set<string>} */
  const formats = new Set();
  for (const c of STRIP.cases) {
    const a = answer(c.file);
    assert.equal(await decodeHash(c, a.bytes), c.pixels_sha256, `${c.file}: the answer's pixels differ from the original's`);
    formats.add(c.format);
  }
  assert.deepEqual([...formats].sort(), ["gif", "j2k", "jp2", "jpeg", "png", "webp"]);
  const jpegs = STRIP.cases.filter((c) => c.format === "jpeg").map((c) => fixture(c.file));
  assert.ok(jpegs.some((d) => jpegWalk(d).segs.some((s) => s.m === 0xc2)), "a progressive JPEG is among them");
  assert.ok(STRIP.cases.some((c) => c.format === "png" && fixture(c.file)[28] === 1), "an interlaced PNG is among them");
  /* and the metadata R2 forbids is not in the answer: no byte run of any of the original's metadata survives */
  for (const c of STRIP.cases) {
    const a = Buffer.from(answer(c.file).bytes);
    for (const s of c.secrets) assert.ok(!a.includes(Buffer.from(s)), `${c.file}: the answer holds "${s}"`);
    assert.equal(judgeStructure(c, answer(c.file).bytes), c.orientation, `${c.file}: the orientation`);
  }
});

test("R8 each format's answer holds only what R2 allows (no EXIF beyond the orientation, no thumbnail, XMP, ICC, comment, text, second image or bytes after the end), keeps what decides the decode, and carries the coded data byte for byte", () => {
  for (const c of STRIP.cases) {
    const d = fixture(c.file), a = answer(c.file);
    assert.deepEqual(Object.keys(a).sort(), ["bytes", "changed", "format", "ok"]);
    assert.equal(a.format, c.format, c.file);
    assert.ok(a.bytes instanceof Uint8Array);
    judgeStructure(c, a.bytes);
    /* the coded data: every range the reference located in the original is in the answer, unchanged, in order */
    const b = Buffer.from(a.bytes);
    let from = 0;
    for (const [s, e] of c.coded) {
      const at = b.indexOf(Buffer.from(d.subarray(s, e)), from);
      assert.ok(at >= 0, `${c.file}: the coded data [${s}, ${e}) is not in the answer as it was`);
      from = at + (e - s);
    }
    assert.ok(c.coded.length > 0);
  }
  /* what decides the decode is kept: Adobe's transform flag, the JFIF marker (without its thumbnail), the palette and
     transparency, the WebP's alpha, and a JP2's ICC colour space as the enumerated space it describes (sRGB) */
  const adobe = pick(jpegWalk(answer("strip-cmyk-adobe.jpg").bytes).segs, (s) => s.m === 0xee);
  const adobeIn = pick(jpegWalk(fixture("strip-cmyk-adobe.jpg")).segs, (s) => s.m === 0xee);
  assert.equal(adobe.body[11], adobeIn.body[11], "the Adobe transform flag");
  assert.ok(jpegWalk(answer("strip-grey-jfif-thumb.jpg").bytes).segs.some((s) => s.m === 0xe0));
  const pal = pngWalk(answer("strip-palette-o8.png").bytes).chunks, palIn = pngWalk(fixture("strip-palette-o8.png")).chunks;
  for (const t of ["PLTE", "tRNS"]) assert.deepEqual([...pick(pal, (k) => k.type === t).body], [...pick(palIn, (k) => k.type === t).body], t);
  assert.ok(webpWalk(answer("strip-lossy-alpha-o6.webp").bytes).chunks.some((k) => k.type === "ALPH"));
  const jp2h = boxWalk(answer("strip-tiled-icc.jp2").bytes)[2];
  assert.ok(jp2h, "jp2h");
  const colr = pick(boxWalk(jp2h.body), (k) => k.type === "colr");
  assert.equal(u32(colr.body, 3), 16, "sRGB");
  /* a JPEG of any process: the frame and the data of an arithmetic-coded, a lossless and a 12-bit JPEG are kept */
  /** @type {Array<[string, number]>} */
  const processes = [["refuse-arithmetic.jpg", 0xc9], ["refuse-lossless.jpg", 0xc3], ["refuse-12bit.jpg", 0xc1], ["refuse-progressive.jpg", 0xc2]];
  for (const [file, sof] of processes) {
    const a = stripped(stripMetadata(fixture(file)), file);
    const w = jpegWalk(a.bytes);
    assert.ok(w.segs.some((s) => s.m === sof), file);
    judgeStructure({ format: "jpeg", file }, a.bytes);
  }
});

test("R8 `changed` is false exactly when nothing was removed, and then the bytes equal the input; an answer stripped again is unchanged", () => {
  for (const c of STRIP.cases) {
    const d = fixture(c.file), a = answer(c.file);
    assert.equal(a.changed, !c.unchanged, c.file);
    if (c.unchanged) assert.deepEqual(a.bytes, d);
    else assert.notDeepEqual(a.bytes, d);
    const again = stripped(stripMetadata(a.bytes), c.file);
    assert.equal(again.changed, false, `${c.file}: stripping the answer again removed something`);
    assert.equal(sha(again.bytes), sha(a.bytes));
    assert.notEqual(again.bytes, a.bytes, "a copy, not the caller's array");
  }
  /* an image whose only metadata is the orientation, as R2 keeps it, is unchanged */
  const o2 = fixture("o2.png"), a = stripped(stripMetadata(o2), "o2.png");
  assert.equal(a.changed, false);
  assert.equal(sha(a.bytes), sha(o2));
});

test("R8 refusals by name, nothing answered but the refusal, and never a throw: each code is reached; damaged bytes of every fixture answer a copy or a named refusal", () => {
  /** @type {Set<string>} */
  const reached = new Set();
  /** @param {Stripped | Refused} r @param {string} code @param {string} why */
  const check = (r, code, why) => {
    assert.deepEqual(Object.keys(r).sort(), ["code", "detail", "ok"], why);
    if (r.ok) assert.fail(`${why}: answered, not refused`);
    assert.equal(r.code, code, `${why}: ${r.detail}`);
    assert.equal(typeof r.detail, "string");
    reached.add(r.code);
  };
  for (const f of STRIP.refusals) check(stripMetadata(fixture(f.file)), f.code, f.file);
  check(stripMetadata(fixture("screenshot-rgba-o6.png")), "ANIMATED_IMAGE", "an APNG of two frames");
  for (const b of [new Uint8Array(0), "not bytes", null, undefined, [0xff, 0xd8, 0xff], fixture("refuse-heic.heic"), Uint8Array.from([0x42, 0x4d])])
    check(stripMetadata(b), "NOT_A_STRIPPABLE_FORMAT", String(b));
  /* PHOTO_TOO_LARGE on the length alone; at the limit the image is read (and the zeros after its end left behind) */
  const big = new Uint8Array(COVER_MAX_BYTES + 1), j = fixture("strip-baseline-o6.jpg");
  big.set(j);
  check(stripMetadata(big), "PHOTO_TOO_LARGE", "over the limit");
  const at = stripped(stripMetadata(big.subarray(0, COVER_MAX_BYTES)), "at the limit");
  assert.equal(sha(at.bytes), sha(answer("strip-baseline-o6.jpg").bytes));
  /* an ArrayBuffer is read as its bytes */
  assert.equal(sha(stripped(stripMetadata(j.slice().buffer), "an ArrayBuffer").bytes), sha(answer("strip-baseline-o6.jpg").bytes));
  /* a JPEG extension marker this module cannot judge; a reserved marker; a PNG critical chunk it does not know */
  const ext = Buffer.concat([j.subarray(0, 2), Buffer.from([0xff, 0xf0, 0, 4, 1, 2]), j.subarray(2)]);
  check(stripMetadata(ext), "NOT_A_STRIPPABLE_FORMAT", "JPG0");
  const res = Buffer.concat([j.subarray(0, 2), Buffer.from([0xff, 0x02, 0, 4, 1, 2]), j.subarray(2)]);
  check(stripMetadata(res), "IMAGE_DATA_CORRUPT", "a reserved marker");
  const png = fixture("strip-clean.png");
  const crit = Buffer.concat([png.subarray(0, 33), Buffer.from([0, 0, 0, 0, 0x43, 0x67, 0x42, 0x49, 0, 0, 0, 0]), png.subarray(33)]);
  check(stripMetadata(crit), "NOT_A_STRIPPABLE_FORMAT", "an unknown critical chunk (CgBI)");
  check(stripMetadata(pngDeclaring(30_000_000, 1)), "IMAGE_TOO_LARGE", "a row over the stride bound (R10)");
  assert.deepEqual([...reached].sort(), Object.keys(STRIP_REFUSALS).sort(), "every declared code reached, and no other");
  /* never throws: every fixture cut short at many points and with bytes flipped answers ok or a declared refusal */
  const files = [...STRIP.cases.map((c) => c.file), "refuse-arithmetic.jpg", "phone-420-o6.jpg", "screenshot-rgba-o6.png"];
  let n = 0;
  for (const f of files) {
    const d = fixture(f);
    for (let k = 1; k < 40; k++) {
      const cut = d.subarray(0, Math.floor((d.length * k) / 40));
      const flip = Uint8Array.from(d), f1 = Math.floor((d.length * k) / 41), f2 = (k * 7919) % d.length;
      flip[f1] = (flip[f1] ?? 0) ^ 0x5a; flip[f2] = (flip[f2] ?? 0) ^ 0xff;
      for (const x of [cut, flip]) {
        const r = stripMetadata(x);
        n++;
        if (r.ok) assert.ok(r.bytes instanceof Uint8Array);
        else assert.ok(r.code in STRIP_REFUSALS, `${f}: ${r.code}`);
      }
    }
  }
  assert.ok(n > 1000);
});

test("R6 R7 strip: the same bytes answer the same bytes, the input unchanged; no place in any refusal's words", () => {
  for (const c of STRIP.cases) {
    const d = fixture(c.file), before = sha(d);
    assert.equal(sha(stripped(stripMetadata(d), c.file).bytes), sha(stripped(stripMetadata(Uint8Array.from(d)), c.file).bytes), c.file);
    assert.equal(sha(d), before, `${c.file}: the input was changed`);
  }
  const PLACE = /\b(oakland|alameda|berkeley|california|san francisco|county of|city of|state of)\b/i;
  const texts = [...Object.values(STRIP_REFUSALS), ...STRIP.refusals.map((f) => detailOf(stripMetadata(fixture(f.file))))];
  for (const t of texts) assert.doesNotMatch(t, PLACE);
});
