/* image-cover: `coverAreas` at its interface (R1, R2, R3, R5, R6, R7). The expectations are the reference's
 * (`fixtures/make-fixtures.py`: Pillow over libjpeg-turbo and zlib, with the cover's rectangles and block counts
 * computed there from the geometry), never this module's earlier output. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { crc32 } from "node:zlib";
import { coverAreas, COVER_MAX_BYTES, COVER_MAX_PIXELS, COVER_REFUSALS } from "../../../src/image-cover/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { pngDeclaring } from "./hostile.mjs";
import { CASES, fixture, jpegSegments, pngChunks, tiffIfd0, decodeJpegAnswer, decodePngAnswer, judge } from "./answers.mjs";

/** @import { Covered, Refused } from "../../../src/image-cover/index.mjs" */
/** @import { CoverCase, Ifd0 } from "./answers.mjs" */

/** @param {Uint8Array} b */
const sha = (b) => createHash("sha256").update(b).digest("hex");
/**
 * The answer, which must be a covered photo.
 * @param {Covered | Refused} a
 * @param {string} why
 * @returns {Covered}
 */
const covered = (a, why) => {
  if (!a.ok) assert.fail(`${why}: ${a.code} ${a.detail}`);
  return a;
};
/** @type {Map<string, Covered | Refused>} */
const answers = new Map([]);
/** @param {CoverCase} c @returns {Promise<Covered>} */
async function answer(c) {
  const had = answers.get(c.file);
  if (had) return covered(had, c.file);
  const a = await coverAreas(fixture(c.file), { areas: c.areas });
  answers.set(c.file, a);
  return covered(a, c.file);
}
/** The first case `which` picks. @param {(c: CoverCase) => boolean} which */
const caseWhere = (which) => {
  const c = CASES.cases.find(which);
  assert.ok(c, "the fixture is among the cases");
  return c;
};
/** @param {CoverCase} c @param {Covered} a */
const decode = (c, a) => (c.format === "jpeg" ? decodeJpegAnswer(a.bytes) : decodePngAnswer(a.bytes));
/** The Orientation tag an IFD0 holds. @param {Ifd0} ifd */
const orientationTag = (ifd) => {
  const t = ifd.tags[0x0112];
  assert.ok(t, "an Orientation tag");
  return t.value;
};
/** @param {CoverCase} c */
const orientationOf = (c) => {
  const d = fixture(c.file);
  if (c.format === "png") {
    const ex = pngChunks(d).chunks.find((k) => k.type === "eXIf");
    return ex ? tiffIfd0(ex.body).tags[0x0112]?.value ?? 1 : 1;
  }
  const app1 = jpegSegments(d).segs.find((s) => s.marker === 0xe1 && String.fromCharCode(...s.body.subarray(0, 4)) === "Exif");
  return app1 ? orientationTag(tiffIfd0(app1.body.subarray(6))) : 1;
};
/** @type {Array<"jpeg" | "png">} */
const FORMATS = ["jpeg", "png"];
/**
 * Each answer must be a refusal by `code` and nothing else.
 * @param {Covered | Refused} r @param {string} code @param {string} why @param {Set<string>} reached
 */
function refusedAs(r, code, why, reached) {
  assert.deepEqual(Object.keys(r).sort(), ["code", "detail", "ok"], why);
  if (r.ok) assert.fail(`${why}: answered, not refused`);
  assert.equal(r.code, code, `${why}: ${r.detail}`);
  assert.equal(typeof r.detail, "string");
  reached.add(r.code);
}
/** The refusal's words. @param {Covered | Refused} r */
const detailOf = (r) => (r.ok ? assert.fail("answered, not refused") : r.detail);

test("R1 R5 every fixture: the answer's decode equals the reference's decode of the original outside the cover, and is the cover colour inside it; the size is as displayed and `covered` counts the blocks or pixels the reference computed", async () => {
  assert.ok(CASES.cases.length >= 18);
  /** @type {{jpeg: Set<number>, png: Set<number>}} */
  const seen = { jpeg: new Set(), png: new Set() };
  for (const c of CASES.cases) {
    const a = await answer(c);
    assert.deepEqual([a.format, a.width, a.height, a.covered], [c.format, c.width, c.height, c.covered], c.file);
    const j = judge(decode(c, a), c);
    assert.deepEqual([j.width, j.height], [c.width, c.height], c.file);
    assert.equal(j.outside_sha256, c.outside_sha256, `${c.file}: outside the cover differs from the reference's decode of the original`);
    assert.equal(j.wrong, 0, `${c.file}: ${j.wrong} of ${j.inside} covered pixels are not the cover colour`);
    if (c.areas.length) assert.ok(j.inside > 0, c.file);
    seen[c.format].add(orientationOf(c));
  }
  /* every EXIF orientation, in both formats, met by at least one fixture */
  for (const f of FORMATS) for (let o = 1; o <= 8; o++) if (f === "jpeg" || [1, 2, 4, 6, 7].includes(o)) assert.ok(seen[f].has(o), `${f} orientation ${o}`);
});

test("R1 the cover is snapped outward, never inward: every pixel of every area is inside a covered rectangle, and the JPEG cover is whole MCUs", async () => {
  for (const c of CASES.cases) {
    for (const [x0, y0, x1, y1] of c.areas) {
      const cx0 = Math.max(0, x0), cy0 = Math.max(0, y0), cx1 = Math.min(c.width, x1), cy1 = Math.min(c.height, y1);
      for (let y = cy0; y < cy1; y++) for (let x = cx0; x < cx1; x++)
        assert.ok(c.cover_rects.some(([a, b, p, q]) => x >= a && x < p && y >= b && y < q), `${c.file} (${x},${y})`);
    }
    /* and the answer agrees: each area's pixels decode to the cover colour (shrunk by the bleed only at the MCU's edge) */
    const a = await answer(c), img = decode(c, a);
    for (const [x0, y0, x1, y1] of c.areas) {
      const x = Math.max(0, Math.min(c.width - 1, (x0 + x1) >> 1)), y = Math.max(0, Math.min(c.height - 1, (y0 + y1) >> 1));
      const o = (y * img.width + x) * img.comps;
      assert.deepEqual([...img.samples.subarray(o, o + img.comps)], c.cover, `${c.file}: an area's centre`);
    }
  }
});

test("R1 an empty `areas` answers a copy with nothing covered: the whole decode equals the reference's", async () => {
  const c = caseWhere((x) => x.areas.length === 0);
  const a = await answer(c);
  assert.equal(a.covered, 0);
  assert.equal(judge(decode(c, a), c).outside_sha256, c.outside_sha256);
});

test("R2 a JPEG answer holds SOI, at most a bare JFIF APP0 or Adobe APP14, at most an EXIF APP1 with Orientation alone and no next IFD (no thumbnail), the tables, one frame, one scan, EOI, and nothing after", async () => {
  for (const c of CASES.cases.filter((x) => x.format === "jpeg")) {
    const a = await answer(c);
    const { segs, after } = jpegSegments(a.bytes);
    assert.equal(after.length, 0, `${c.file}: bytes after EOI`);
    const kinds = segs.map((s) => s.marker);
    for (const m of kinds) assert.ok([0xe0, 0xee, 0xe1, 0xdb, 0xc4, 0xc0, 0xc1, 0xdd, 0xda].includes(m), `${c.file}: marker 0x${m.toString(16)}`);
    assert.equal(kinds.filter((m) => m === 0xc0 || m === 0xc1).length, 1);
    assert.equal(kinds.filter((m) => m === 0xda).length, 1);
    assert.ok(kinds.filter((m) => m === 0xe1).length <= 1 && kinds.filter((m) => m === 0xe0).length <= 1 && kinds.filter((m) => m === 0xee).length <= 1);
    for (const s of segs) {
      if (s.marker === 0xe0) assert.deepEqual([...s.body], [0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0], "a bare JFIF: no thumbnail");
      if (s.marker === 0xee) assert.equal(s.body.length, 12);
      if (s.marker === 0xe1) {
        assert.equal(String.fromCharCode(...s.body.subarray(0, 6)), "Exif\0\0");
        const ifd = tiffIfd0(s.body.subarray(6));
        assert.deepEqual(Object.keys(ifd.tags).map(Number), [0x0112]);
        assert.equal(ifd.next, 0, "no IFD1, so no thumbnail");
        assert.equal(s.body.length, 6 + 26);
        assert.equal(orientationTag(ifd), orientationOf(c), "the orientation is kept");
      }
    }
    if (orientationOf(c) === 1) assert.ok(!kinds.includes(0xe1));
  }
});

test("R2 the phone JPEG: its EXIF (make, GPS, sub-IFD), IFD1 thumbnail, XMP, ICC profile, comment, MPF index, the second image after EOI and the trailing bytes are all gone, and no byte run of any of them is in the answer", async () => {
  const c = caseWhere((x) => x.file === "phone-420-o6.jpg");
  const orig = fixture(c.file), a = (await answer(c)).bytes;
  const { segs, after } = jpegSegments(orig);
  assert.ok(after.length > 1000, "the fixture carries a second image and a trailer after EOI");
  /** @param {string} needle */
  const has = (needle) => Buffer.from(a).includes(Buffer.from(needle));
  for (const s of ["TestCam", "Phone One", "PhoneOS", "2026:10:08", "http://ns.adobe.com", "PersonInImage", "ICC_PROFILE", "MPF\0", "taken by member", "SEFH", "face-region"])
    assert.ok(!has(s), `the answer holds "${s}"`);
  /* the thumbnail, the second image and the ICC profile: no 64-byte run of any of them survives */
  const thumbAt = Buffer.from(orig).indexOf(Buffer.from([0xff, 0xd8, 0xff]), 4);
  const icc = segs.find((s) => s.marker === 0xe2);
  assert.ok(icc, "the fixture carries an ICC profile");
  const runs = [orig.subarray(thumbAt + 200, thumbAt + 264), after.subarray(300, 364), icc.body.subarray(100, 164)];
  for (const r of runs) assert.ok(!Buffer.from(a).includes(Buffer.from(r)));
  assert.ok(jpegSegments(a).segs.every((s) => s.marker !== 0xe2 && s.marker !== 0xfe));
});

test("R2 a PNG answer holds IHDR, at most an eXIf with Orientation alone, the palette and transparency it needs, IDAT and IEND, and nothing after; the screenshot's text, XMP, EXIF, ICC, APNG frames and trailing bytes are gone", async () => {
  for (const c of CASES.cases.filter((x) => x.format === "png")) {
    const a = await answer(c);
    const { chunks, after } = pngChunks(a.bytes);
    assert.equal(after.length, 0, `${c.file}: bytes after IEND`);
    const types = chunks.map((k) => k.type);
    assert.equal(types[0], "IHDR");
    assert.equal(types.at(-1), "IEND");
    for (const t of types) assert.ok(["IHDR", "eXIf", "PLTE", "tRNS", "IDAT", "IEND"].includes(t), `${c.file}: chunk ${t}`);
    const ex = chunks.find((k) => k.type === "eXIf");
    if (ex) {
      const ifd = tiffIfd0(ex.body);
      assert.deepEqual(Object.keys(ifd.tags).map(Number), [0x0112]);
      assert.equal(ifd.next, 0);
      assert.equal(orientationTag(ifd), orientationOf(c));
    } else assert.equal(orientationOf(c), 1);
  }
  const c = caseWhere((x) => x.file === "screenshot-rgba-o6.png");
  const orig = pngChunks(fixture(c.file));
  assert.ok(["tEXt", "zTXt", "iTXt", "iCCP", "acTL", "fdAT"].every((t) => orig.chunks.some((k) => k.type === t)) && orig.after.length > 100,
    "the fixture carries text, XMP, ICC, a second frame and trailing bytes");
  const a = Buffer.from((await answer(c)).bytes);
  for (const s of ["member 7", "TestCam", "PersonInImage", "XML:com.adobe.xmp", "acTL", "fcTL", "fdAT", "trailing"]) assert.ok(!a.includes(Buffer.from(s)), s);
});

test("R3 every refusal by name, nothing answered but the refusal: each code is reached, and each answer is {ok:false, code, detail} alone", async () => {
  /** @type {Set<string>} */
  const reached = new Set();
  /** @param {Covered | Refused} r @param {string} code @param {string} why */
  const check = (r, code, why) => refusedAs(r, code, why, reached);
  for (const f of CASES.refusals) check(await coverAreas(fixture(f.file), { areas: f.areas }), f.code, f.file);
  const jpg = fixture("444-o3.jpg");
  for (const areas of [undefined, "x", [[0, 0, 10]], [[0, 0, 10, 10, 1]], [[0, 0, 0, 10]], [[5, 0, 4, 10]], [[0, 9, 10, 9]], [[0, 0, 1.5, 10]], [[0, 0, "10", 10]], [null], [[0, 0, 10, 10], [1, 2, 3]]])
    check(await coverAreas(jpg, { areas }), "AREA_MALFORMED", JSON.stringify(areas));
  check(await coverAreas(jpg), "AREA_MALFORMED", "no options");
  for (const areas of [[[150, 0, 200, 10]], [[0, 101, 10, 200]], [[-20, 0, 0, 10]], [[0, -9, 10, 0]]])
    check(await coverAreas(jpg, { areas }), "AREA_OUTSIDE", JSON.stringify(areas));
  /* PHOTO_TOO_LARGE: decided on the length alone, before the areas or a byte is read */
  const big = new Uint8Array(COVER_MAX_BYTES + 1);
  big.set(jpg);
  check(await coverAreas(big, { areas: "not even areas" }), "PHOTO_TOO_LARGE", "over the limit");
  assert.equal((await coverAreas(big.subarray(0, COVER_MAX_BYTES), { areas: [] })).ok, true, "at the limit, it is read (and the zeros after EOI are not carried)");
  for (const b of [new Uint8Array(0), Uint8Array.from([0xff, 0xd8]), "not bytes", null, Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])])
    check(await coverAreas(b, { areas: [] }), "NOT_A_COVERABLE_FORMAT", String(b));
  /* damaged data: a Huffman code that cannot be, a CRC that does not match (in the fixtures), a restart out of order */
  const phone = fixture("phone-420-o6.jpg");
  const sos = jpegSegments(phone).segs.find((s) => s.marker === 0xda);
  assert.ok(sos, "the photo has a scan");
  const scanAt = sos.body.byteOffset - phone.byteOffset + sos.body.length;     // the main image's data (not the thumbnail's)
  const bad = Uint8Array.from(phone); bad.fill(0xff, scanAt + 40, scanAt + 41); bad.fill(0xfe, scanAt + 41, scanAt + 42);
  check(await coverAreas(bad, { areas: [] }), "TRUNCATED_IMAGE_DATA", "a marker inside the scan's data: the data ends there");
  const rst = Uint8Array.from(phone), r0 = Buffer.from(phone).indexOf(Buffer.from([0xff, 0xd0]), scanAt);
  rst[r0 + 1] = 0xd3;
  check(await coverAreas(rst, { areas: [] }), "IMAGE_DATA_CORRUPT", "RST3 where RST0 belongs");
  /* a PNG whose IDAT is not zlib data, its CRC correct */
  const png = fixture("grey.png"), chunks = pngChunks(png).chunks, idat = chunks.find((k) => k.type === "IDAT");
  assert.ok(idat, "the PNG has IDAT");
  const at = idat.body.byteOffset - png.byteOffset, junk = Uint8Array.from(png);
  junk.fill(0x5a, at, at + idat.body.length);
  new DataView(junk.buffer).setUint32(at + idat.body.length, crc32(junk.subarray(at - 4, at + idat.body.length)));
  check(await coverAreas(junk, { areas: [] }), "IMAGE_DATA_CORRUPT", "IDAT not zlib");
  /* COVER_MAX_PIXELS: decided from the header, before anything is decoded; at the limit the photo is read */
  /** @param {number} w @param {number} h @param {string} kind */
  const sized = (w, h, kind) => {
    if (kind === "png") {
      const b = Uint8Array.from(png), dv = new DataView(b.buffer);
      dv.setUint32(16, w); dv.setUint32(20, h); dv.setUint32(29, crc32(b.subarray(12, 29)));
      return b;
    }
    const sof = jpegSegments(jpg).segs.find((x) => x.marker === 0xc0);
    assert.ok(sof, "the photo has a frame");
    const o = sof.body.byteOffset - jpg.byteOffset;  // the image's, not the thumbnail's
    const b = Uint8Array.from(jpg);
    b[o + 1] = h >> 8; b[o + 2] = h & 255; b[o + 3] = w >> 8; b[o + 4] = w & 255;
    return b;
  };
  assert.equal(COVER_MAX_PIXELS, 120_000_000);
  for (const kind of ["jpeg", "png"]) {
    check(await coverAreas(sized(12000, 10001, kind), { areas: [] }), "PHOTO_TOO_LARGE", `${kind} over the pixel limit`);
    check(await coverAreas(sized(12000, 10000, kind), { areas: [] }), "TRUNCATED_IMAGE_DATA", `${kind} at the pixel limit is read, and its data ends`);
  }
  /* IMAGE_TOO_LARGE (R10): a declared row over the bound, decided from the header */
  check(await coverAreas(pngDeclaring(30_000_000, 1), { areas: [] }), "IMAGE_TOO_LARGE", "a row over the stride bound");
  assert.deepEqual([...reached].sort(), Object.keys(COVER_REFUSALS).sort(), "every declared code reached, and no other");
});

test("R6 pure: the same bytes and areas answer the same bytes, alone, repeated, or interleaved with other calls; the input is not changed", async () => {
  for (const c of CASES.cases) {
    const input = fixture(c.file), before = sha(input);
    const [x, y] = (await Promise.all([coverAreas(input, { areas: c.areas }), coverAreas(input, { areas: c.areas })])).map((a) => covered(a, c.file));
    const z = covered(await coverAreas(fixture(c.file), { areas: c.areas }), c.file);
    assert.ok(x && y, c.file);
    assert.equal(sha(x.bytes), sha(y.bytes), c.file);
    assert.equal(sha(x.bytes), sha(z.bytes), c.file);
    assert.equal(sha(input), before, `${c.file}: the input was changed`);
  }
  /* interleaving many different calls changes no answer */
  const first = await Promise.all(CASES.cases.map(async (c) => covered(await coverAreas(fixture(c.file), { areas: c.areas }), c.file)));
  const again = await Promise.all([...CASES.cases].reverse().map(async (c) => covered(await coverAreas(fixture(c.file), { areas: c.areas }), c.file)));
  again.reverse();
  first.forEach((a, i) => { const b = again[i]; assert.ok(b); assert.equal(sha(a.bytes), sha(b.bytes)); });
});

test("R7 no place is named in any refusal text or the module's exported words", async () => {
  const PLACE = /\b(oakland|alameda|berkeley|california|san francisco|county of|city of|state of)\b/i;
  const texts = [...Object.values(COVER_REFUSALS)];
  for (const f of CASES.refusals) texts.push(detailOf(await coverAreas(fixture(f.file), { areas: f.areas })));
  texts.push(detailOf(await coverAreas(fixture("444-o3.jpg"), { areas: [[0, 0, 1]] })));
  texts.push(detailOf(await coverAreas(new Uint8Array(COVER_MAX_BYTES + 1), { areas: [] })));
  assert.ok(texts.length >= 18);
  for (const t of texts) { assert.equal(typeof t, "string"); assert.doesNotMatch(t, PLACE); }
});

test("R3 words: each refusal code's English is the design's row for it, read by word, never a sentence held here", () => {
  for (const [code, words] of Object.entries(COVER_REFUSALS).filter(([c]) => c !== "IMAGE_TOO_LARGE")) assert.equal(words, word(`refusal.${code}`), code);
  /* the held row of IMAGE_TOO_LARGE speaks of a page to transcribe: this module's stand-in is its own until the design's row (owed) lands */
  assert.ok(COVER_REFUSALS.IMAGE_TOO_LARGE.length > 0);
});
