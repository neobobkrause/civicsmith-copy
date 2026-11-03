/* format-registry: requirement-named tests for the built-in picture entries (build/requirements/format-registry.md
 * R29 jpeg, R30 png) and their place in the roster (R23), at the module's interface, each with its negative controls
 * (K874): a PDF, a ZIP, an office file or HTML is never a picture, a picture is never a zip, and the order holds.
 * This file never changes the registry. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { getFormat, listFormats, detectFormat } from "../../../src/formats.mjs";
import { makeZip, officeZip, odfZip } from "./zipfix.mjs";

const enc = (s) => new TextEncoder().encode(s);
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
const OTHERS = [["pdf", PDF], ["html", HTML], ["zip", ZIP], ["docx", DOCX], ["odt", ODT], ["text", enc("plain words")],
  ["a GIF", enc("GIF89a\x01\0\x01\0")], ["a TIFF", Uint8Array.of(0x49, 0x49, 0x2a, 0)], ["a HEIC", cat([0, 0, 0, 24], "ftypheic")],
  ["a WebP", enc("RIFF\0\0\0\0WEBPVP8 ")]];

const PICTURES = [
  { format: "jpeg", ct: "image/jpeg", refusal: "NOT_A_JPEG", sig: JPEG_SIG, good: [JPEG_JFIF, JPEG_EXIF, JPEG_BARE], other: PNG,
    hex: "FF D8 FF", near: [[0xff, 0xd8], [0xff, 0xd8, 0xfe], [0xfe, 0xd8, 0xff], [0xff, 0xd9, 0xff], [0x00, 0xff, 0xd8, 0xff]],
    nearTypes: ["image/jpg", "image/pjpeg", "IMAGE/JPEG", "Image/Jpeg", "image/jpeg; charset=binary", " image/jpeg", "image/jpeg ",
      "image/png", "application/octet-stream"] },
  { format: "png", ct: "image/png", refusal: "NOT_A_PNG", sig: PNG_SIG, good: [PNG, PNG_BARE], other: JPEG_JFIF,
    hex: "89 50 4E 47 0D 0A 1A 0A", near: [PNG_SIG.slice(0, 7), [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x00],
      [0x88, ...PNG_SIG.slice(1)], [0x00, ...PNG_SIG], [...enc("PNG"), 0x0d, 0x0a]],
    nearTypes: ["image/x-png", "IMAGE/PNG", "Image/Png", "image/png; charset=binary", " image/png", "image/png ", "image/apng",
      "image/jpeg", "application/octet-stream"] },
];

const isHit = (r, format, confidence) => {
  assert.equal(r.format, format);
  assert.equal(r.confidence, confidence);
  assert.ok(Array.isArray(r.signals) && r.signals.length > 0 && r.signals.every((s) => typeof s === "string"));
  assert.deepEqual(Object.keys(r), ["format", "confidence", "signals"]);
};

const onePage = () => {
  const m = { page: 0, reason: "no_text_layer", font: null, codes: "", count: 0 };
  return { ok: true, pages: 1, text: { document: "", pages: [{ page: 0, text: "", undetermined: [m] }], undetermined: [m],
    counts: { chars: 0, undetermined: 1 } } };
};

test("R23: the roster, jpeg and png first; a picture is read as a picture whatever its first KiB carries (G130a; S14)", () => {
  const order = listFormats();
  assert.deepEqual(order, ["jpeg", "png", "gif", "tiff", "webp", "bmp", "jp2", "heic", "heif", "avif", "html", "mhtml", "pdf", "rtf", "docx", "xlsx", "pptx", "odt", "ods", "odp", "csv", "doc", "xls", "ppt", "json", "ndjson", "xml", "svg", "kml", "kmz", "geojson", "ics", "vcf", "srt", "vtt", "eml", "msg", "mbox", "tar", "gz", "7z", "zip", "text"]);
  assert.equal(order.indexOf("jpeg"), 0);
  assert.equal(order.indexOf("png"), 1);
  assert.equal(order.indexOf("zip"), order.length - 2, "zip last of the signature entries, `text` (a fallback) after it");
  // pass 1 asks the pictures before html and pdf: a marker inside a picture does not make it a PDF or a page
  assert.equal(detectFormat(cat(JPEG_SIG, [0xfe, 0, 12], "%PDF-1.4"), null).format, "jpeg");
  assert.equal(detectFormat(cat(JPEG_SIG, [0xe1, 0, 20], "Exif\0\0<html><body>"), null).format, "jpeg");
  assert.equal(detectFormat(cat(PNG_SIG, "tEXt%PDF-1.7"), null).format, "png");
  assert.equal(detectFormat(cat(PNG_SIG, "<!doctype html><html>"), null).format, "png");
  // the picture entries answer before zip in pass 2 too: a declared picture type is never a zip
  assert.equal(detectFormat(null, "image/jpeg").format, "jpeg");
  assert.equal(detectFormat(null, "image/png").format, "png");
});

for (const P of PICTURES) {
  const R = P.format === "jpeg" ? "R29" : "R30";
  const entry = getFormat(P.format);

  test(`${R}: ${P.format} detect with bytes — the signature ${P.hex} at offset 0 is certain; anything else null; content type unconsulted`, () => {
    for (const b of P.good) {
      isHit(entry.detect(b, null), P.format, "certain");
      assert.ok(entry.detect(b, null).signals.some((s) => s.includes(P.hex)));
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
  });

  test(`${R}: ${P.format} detect without bytes — exactly ${P.ct} is likely; anything else null`, () => {
    for (const b of FALSY) {
      const r = entry.detect(b, P.ct);
      isHit(r, P.format, "likely");
      assert.ok(r.signals.some((s) => s.includes(P.ct)));
      for (const ct of [...P.nearTypes, "", null, undefined, 0, {}]) assert.equal(entry.detect(b, ct), null, `${String(b)} / ${String(ct)}`);
    }
  });

  test(`${R}: through the registry — bytes outrank a declared type, and no other format's bytes are read as ${P.format}`, () => {
    for (const b of P.good) {
      assert.deepEqual(detectFormat(b, null), entry.detect(b, null));
      for (const ct of ["application/pdf", "application/zip", "text/html", "text/csv", P.ct]) assert.deepEqual(detectFormat(b, ct), entry.detect(b, null));
      // a picture is never zip
      assert.equal(getFormat("zip").detect(b, null), null);
      for (const ct of ["application/zip", "application/x-zip-compressed"]) assert.notEqual(detectFormat(b, ct).format, "zip");
    }
    // a PDF, a ZIP, an office or ODF file and HTML keep their own format, even declared as a picture
    for (const [label, b] of OTHERS.slice(0, 5)) assert.equal(detectFormat(b, P.ct).format, label, `${label} declared ${P.ct}`);
    // bytes no entry claims fall to the declared picture type in pass 2, as likely
    assert.deepEqual(detectFormat(enc("plain words"), P.ct), entry.detect(null, P.ct));
    assert.deepEqual(detectFormat(null, P.ct), entry.detect(null, P.ct));
    // the other picture kinds (R33) answer as their own format, never as this one
    for (const [label, b] of OTHERS.slice(6)) assert.equal(detectFormat(b, null).format, { "a GIF": "gif", "a TIFF": "tiff", "a HEIC": "heic", "a WebP": "webp" }[label], label);
  });

  test(`${R}: ${P.format} structure — one page 0 with no text and one no_text_layer marker; ${P.refusal} without the signature; decodes nothing`, async () => {
    assert.equal(entry.parts, null);
    assert.equal(entry.text, null);
    assert.equal(typeof entry.structure, "function");
    for (const b of P.good) {
      const r = await entry.structure(b);
      assert.deepEqual(r, onePage());
      assert.deepEqual(Object.keys(r), ["ok", "pages", "text"]);
      assert.deepEqual(Object.keys(r.text), ["document", "pages", "undetermined", "counts"]);
      assert.deepEqual(Object.keys(r.text.undetermined[0]), ["page", "reason", "font", "codes", "count"]);
      // a fresh answer each call: a caller that changes one cannot change the next
      r.text.pages[0].text = "changed"; r.text.undetermined.push("x");
      assert.deepEqual(await entry.structure(b), onePage());
    }
    // the bytes after the signature are never read: garbage, or a megabyte of it, answers the same
    const big = new Uint8Array(1 << 20).fill(0xab); big.set(P.sig);
    assert.deepEqual(await entry.structure(big), onePage());
    // it is what the registry's detect→structure path reaches
    assert.deepEqual(await getFormat(detectFormat(P.good[0], null).format).structure(P.good[0]), onePage());
    const no = { ok: false, container: P.format, reason: P.refusal };
    for (const b of [P.other, ...P.near.map((n) => Uint8Array.from(n)), ...OTHERS.map(([, x]) => x), new Uint8Array(0),
      null, undefined, "", 0, P.sig, String.fromCharCode(...P.sig), {}]) {
      assert.deepEqual(await entry.structure(b), no, String(b));
    }
  });
}
