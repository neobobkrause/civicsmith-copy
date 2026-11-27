/* format-registry: requirement-named tests for the built-in picture entries (build/requirements/format-registry.md
 * R29 jpeg, R30 png) and their place in the roster (R23), at the module's interface, each with its negative controls
 * (K874): a PDF, a ZIP, an office file or HTML is never a picture, a picture is never a zip, and the order holds.
 * This file never changes the registry. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { getFormat, listFormats, detectFormat } from "../../../src/formats.mjs";
import { makeZip, officeZip, odfZip } from "./zipfix.mjs";
/** @import { FormatEntry, FormatDetection } from "../../../src/formats.mjs" */

/** @param {FormatDetection | Promise<FormatDetection>} d @returns {FormatDetection} */
const now = (d) => { if (d instanceof Promise) throw new Error("detectFormat answered later"); return d; };
/** @param {string} format @returns {FormatEntry} */
const entryOf = (format) => { const e = getFormat(format); if (!e) throw new Error(`no entry registered for ${format}`); return e; };
/** @param {string} s @returns {Uint8Array} */
const enc = (s) => new TextEncoder().encode(s);
/** @param {...(string | number[] | Uint8Array)} xs @returns {Uint8Array} */
const cat = (...xs) => Uint8Array.from(xs.flatMap((x) => [...(typeof x === "string" ? enc(x) : x)]));
const FALSY = [null, undefined, 0, "", false, NaN];

const JPEG_SIG = [0xff, 0xd8, 0xff];
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/* A JFIF-headed JPEG and an EXIF-headed one (a phone's), and a PNG with an IHDR: real file heads, though nothing here
   decodes them (R29: the entry decodes nothing, so the bytes after the head are never read). */
const JPEG_JFIF = cat(JPEG_SIG, [0xe0, 0x00, 0x10], "JFIF\0", [1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
const JPEG_EXIF = cat(JPEG_SIG, [0xe1, 0x00, 0x16], "Exif\0\0MM\0*", [0, 0, 0, 8, 0, 0, 0xff, 0xd9]);
const JPEG_BARE = Uint8Array.from(JPEG_SIG);
const PNG = cat(PNG_SIG, [0, 0, 0, 13], "IHDR", [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0, 0x90, 0x77, 0x53, 0xde]);
const PNG_BARE = Uint8Array.from(PNG_SIG);

const PDF = enc("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n");
const HTML = enc("<!doctype html><html></html>");
const ZIP = makeZip([{ name: "a.txt", data: "a" }]);
const DOCX = officeZip("application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml", "word/document.xml");
const ODT = odfZip("application/vnd.oasis.opendocument.text");
/** @type {Array<[string, Uint8Array]>} */
const OTHERS = [["pdf", PDF], ["html", HTML], ["zip", ZIP], ["docx", DOCX], ["odt", ODT], ["text", enc("plain words")],
  ["a GIF", enc("GIF89a\x01\0\x01\0")], ["a TIFF", Uint8Array.of(0x49, 0x49, 0x2a, 0)], ["a HEIC", cat([0, 0, 0, 24], "ftypheic")],
  ["a WebP", enc("RIFF\0\0\0\0WEBPVP8 ")]];

const JPEG_PICTURE = { format: "jpeg", ct: "image/jpeg", refusal: "NOT_A_JPEG", sig: JPEG_SIG, good: [JPEG_JFIF, JPEG_EXIF, JPEG_BARE], other: PNG,
    hex: "FF D8 FF", near: [[0xff, 0xd8], [0xff, 0xd8, 0xfe], [0xfe, 0xd8, 0xff], [0xff, 0xd9, 0xff], [0x00, 0xff, 0xd8, 0xff]],
    nearTypes: ["image/jpg", "image/pjpeg", "IMAGE/JPEG", "Image/Jpeg", "image/jpeg; charset=binary", " image/jpeg", "image/jpeg ",
      "image/png", "application/octet-stream"] };
const PNG_PICTURE = { format: "png", ct: "image/png", refusal: "NOT_A_PNG", sig: PNG_SIG, good: [PNG, PNG_BARE], other: JPEG_JFIF,
    hex: "89 50 4E 47 0D 0A 1A 0A", near: [PNG_SIG.slice(0, 7), [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x00],
      [0x88, ...PNG_SIG.slice(1)], [0x00, ...PNG_SIG], [...enc("PNG"), 0x0d, 0x0a]],
    nearTypes: ["image/x-png", "IMAGE/PNG", "Image/Png", "image/png; charset=binary", " image/png", "image/png ", "image/apng",
      "image/jpeg", "application/octet-stream"] };

/**
 * @param {FormatDetection | null} r
 * @param {string} format
 * @param {string} confidence
 * @returns {asserts r is FormatDetection}
 */
function isHit(r, format, confidence) {
  assert.ok(r);
  assert.equal(r.format, format);
  assert.equal(r.confidence, confidence);
  assert.ok(Array.isArray(r.signals) && r.signals.length > 0 && r.signals.every((s) => typeof s === "string"));
  assert.deepEqual(Object.keys(r), ["format", "confidence", "signals"]);
}

/** @typedef {{ page: number, reason: string, font: null, codes: string, count: number }} PageMarker */
/** @typedef {{ page: number, text: string, undetermined: PageMarker[] }} OnePageText */
/**
 * @typedef {{ ok: boolean, pages: number, text: { document: string, pages: OnePageText[], undetermined: PageMarker[],
 *   counts: { chars: number, undetermined: number } } }} OnePage
 */

/** @returns {OnePage} */
const onePage = () => {
  const m = { page: 0, reason: "no_text_layer", font: null, codes: "", count: 0 };
  return { ok: true, pages: 1, text: { document: "", pages: [{ page: 0, text: "", undetermined: [m] }], undetermined: [m],
    counts: { chars: 0, undetermined: 1 } } };
};

test("R23: twelve entries, jpeg and png first; a picture is read as a picture whatever its first KiB carries (G130a; S14)", () => {
  const order = listFormats();
  assert.deepEqual(order, ["jpeg", "png", "html", "pdf", "docx", "xlsx", "pptx", "odt", "ods", "odp", "csv", "zip"]);
  assert.equal(order.indexOf("jpeg"), 0);
  assert.equal(order.indexOf("png"), 1);
  assert.equal(order.indexOf("zip"), order.length - 1);
  // pass 1 asks the pictures before html and pdf: a marker inside a picture does not make it a PDF or a page
  assert.equal(now(detectFormat(cat(JPEG_SIG, [0xfe, 0, 12], "%PDF-1.4"), null)).format, "jpeg");
  assert.equal(now(detectFormat(cat(JPEG_SIG, [0xe1, 0, 20], "Exif\0\0<html><body>"), null)).format, "jpeg");
  assert.equal(now(detectFormat(cat(PNG_SIG, "tEXt%PDF-1.7"), null)).format, "png");
  assert.equal(now(detectFormat(cat(PNG_SIG, "<!doctype html><html>"), null)).format, "png");
  // the picture entries answer before zip in pass 2 too: a declared picture type is never a zip
  assert.equal(now(detectFormat(null, "image/jpeg")).format, "jpeg");
  assert.equal(now(detectFormat(null, "image/png")).format, "png");
});

/**
 * The four tests of one picture entry, R29 for jpeg and R30 for png.
 * @param {typeof JPEG_PICTURE} P
 */
function pictureCases(P) {
  const R = P.format === "jpeg" ? "R29" : "R30";
  const entry = entryOf(P.format);

  const withBytes = () => {
    for (const b of P.good) {
      isHit(entry.detect(b, null), P.format, "certain");
      const hit = entry.detect(b, null);
      assert.ok(hit);
      assert.ok(hit.signals.some((s) => s.includes(P.hex)));
      for (const ct of [P.ct, "application/pdf", "application/zip", "text/html"]) isHit(entry.detect(b, ct), P.format, "certain");
      isHit(entry.detect(Buffer.from(b), null), P.format, "certain");
    }
    for (const near of P.near) assert.equal(entry.detect(Uint8Array.from(near), null), null, String(near));
    assert.equal(entry.detect(P.other, null), null);
    for (const [label, b] of OTHERS) assert.equal(entry.detect(b, null), null, `${label} is not a ${P.format}`);
    // content type is not consulted while bytes are truthy, even an empty Uint8Array
    assert.equal(entry.detect(enc("plain"), P.ct), null);
    assert.equal(entry.detect(new Uint8Array(0), P.ct), null);
    assert.equal(entry.detect(PDF, P.ct), null);
  };

  const withoutBytes = () => {
    for (const b of FALSY) {
      const r = entry.detect(b, P.ct);
      isHit(r, P.format, "likely");
      assert.ok(r.signals.some((s) => s.includes(P.ct)));
      for (const ct of [...P.nearTypes, "", null, undefined, 0, {}]) assert.equal(entry.detect(b, ct), null, `${String(b)} / ${String(ct)}`);
    }
  };

  const throughRegistry = () => {
    for (const b of P.good) {
      assert.deepEqual(detectFormat(b, null), entry.detect(b, null));
      for (const ct of ["application/pdf", "application/zip", "text/html", "text/csv", P.ct]) assert.deepEqual(detectFormat(b, ct), entry.detect(b, null));
      // a picture is never zip
      assert.equal(entryOf("zip").detect(b, null), null);
      for (const ct of ["application/zip", "application/x-zip-compressed"]) assert.notEqual(now(detectFormat(b, ct)).format, "zip");
    }
    // a PDF, a ZIP, an office or ODF file and HTML keep their own format, even declared as a picture
    for (const [label, b] of OTHERS.slice(0, 5)) assert.equal(now(detectFormat(b, P.ct)).format, label, `${label} declared ${P.ct}`);
    // bytes no entry claims fall to the declared picture type in pass 2, as likely
    assert.deepEqual(detectFormat(enc("plain words"), P.ct), entry.detect(null, P.ct));
    assert.deepEqual(detectFormat(null, P.ct), entry.detect(null, P.ct));
    // an image format left unregistered stays undetermined
    for (const [label, b] of OTHERS.slice(6)) assert.equal(now(detectFormat(b, null)).format, "undetermined", label);
  };

  const structure = async () => {
    assert.equal(entry.parts, null);
    assert.equal(entry.text, null);
    assert.equal(typeof entry.structure, "function");
    assert.ok(entry.structure);
    for (const b of P.good) {
      const r = await entry.structure(b);
      assert.deepEqual(r, onePage());
      assert.deepEqual(Object.keys(r), ["ok", "pages", "text"]);
      assert.deepEqual(Object.keys(r.text), ["document", "pages", "undetermined", "counts"]);
      /** @type {PageMarker[]} */
      const marks = r.text.undetermined;
      /** @type {PageMarker | undefined} */
      const firstMark = marks[0];
      assert.ok(firstMark);
      assert.deepEqual(Object.keys(firstMark), ["page", "reason", "font", "codes", "count"]);
      // a fresh answer each call: a caller that changes one cannot change the next
      /** @type {OnePageText | undefined} */
      const firstPage = r.text.pages[0];
      assert.ok(firstPage);
      firstPage.text = "changed"; /** @type {unknown[]} */ (r.text.undetermined).push("x");
      assert.deepEqual(await entry.structure(b), onePage());
    }
    // the bytes after the signature are never read: garbage, or a megabyte of it, answers the same
    const big = new Uint8Array(1 << 20).fill(0xab); big.set(P.sig);
    assert.deepEqual(await entry.structure(big), onePage());
    // it is what the registry's detect→structure path reaches
    const good = P.good[0];
    assert.ok(good);
    const reached = entryOf(now(detectFormat(good, null)).format);
    assert.ok(reached.structure);
    assert.deepEqual(await reached.structure(good), onePage());
    const no = { ok: false, container: P.format, reason: P.refusal };
    for (const b of [P.other, ...P.near.map((n) => Uint8Array.from(n)), ...OTHERS.map(([, x]) => x), new Uint8Array(0),
      null, undefined, "", 0, P.sig, String.fromCharCode(...P.sig), {}]) {
      assert.deepEqual(await entry.structure(b), no, String(b));
    }
  };
  return { withBytes, withoutBytes, throughRegistry, structure };
}

const JPEG_CASES = pictureCases(JPEG_PICTURE);
test("R29: jpeg detect with bytes — the signature FF D8 FF at offset 0 is certain; anything else null; content type unconsulted", JPEG_CASES.withBytes);
test("R29: jpeg detect without bytes — exactly image/jpeg is likely; anything else null", JPEG_CASES.withoutBytes);
test("R29: through the registry — bytes outrank a declared type, and no other format's bytes are read as jpeg", JPEG_CASES.throughRegistry);
test("R29: jpeg structure — one page 0 with no text and one no_text_layer marker; NOT_A_JPEG without the signature; decodes nothing", JPEG_CASES.structure);
const PNG_CASES = pictureCases(PNG_PICTURE);
test("R30: png detect with bytes — the signature 89 50 4E 47 0D 0A 1A 0A at offset 0 is certain; anything else null; content type unconsulted", PNG_CASES.withBytes);
test("R30: png detect without bytes — exactly image/png is likely; anything else null", PNG_CASES.withoutBytes);
test("R30: through the registry — bytes outrank a declared type, and no other format's bytes are read as png", PNG_CASES.throughRegistry);
test("R30: png structure — one page 0 with no text and one no_text_layer marker; NOT_A_PNG without the signature; decodes nothing", PNG_CASES.structure);
