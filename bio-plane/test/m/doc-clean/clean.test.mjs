/* doc-clean: `cleanDocument` at its interface (R1, R2, R3, R6, R7, R8, R9). Every document is written by
 * `fixtures.mjs`; a copy is read back by pdf-reader (`openPdf`, `objects`), ooxml (`readContainer`, `readPart`,
 * `readCoreProperties`) and the fixtures' own ZIP walk, never by this module. */
import "../../sandbox.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateSync, gzipSync, gunzipSync } from "node:zlib";
import { cleanDocument, CLEAN_MAX_BYTES, CLEAN_MAX_PART_BYTES, CLEAN_REFUSALS } from "../../../src/doc-clean/index.mjs";
import { openPdf } from "../../../src/pdfstructure.mjs";
import { readContainer, readPart, readCoreProperties } from "../../../src/ooxml.mjs";
import { SECRETS, enc, latin, has, jpeg, jpegCoded, png, pngCoded, gif, jp2, pdf, incremental, objStm, makePdf, makeZip,
  docx, xlsx, pptx, odf, emf, jbig2Segment, jbig2Comment, unzipCopy } from "./fixtures.mjs";

const refused = (r, code, detail) => {
  assert.deepEqual(Object.keys(r).sort(), ["code", "detail", "ok"], "nothing answered but the refusal");
  assert.equal(r.ok, false);
  assert.equal(r.code, code, r.detail);
  if (detail) assert.match(r.detail, detail);
};
const secretsIn = (b) => SECRETS.filter((s) => has(b, s));
const partsOf = (b) => unzipCopy(b).parts;
const part = (b, name) => partsOf(b).find((p) => p.name === name);
const text = (b) => latin(b);
/** Every indirect object a PDF's bytes define, by number, and those its latest trailer reaches. */
async function pdfObjects(b) {
  const doc = await openPdf(b);
  const defined = [...latin(b).matchAll(/(?:^|\n)(\d+) 0 obj\b/g)].map((m) => Number(m[1]));
  return { doc, defined, read: doc.objects() };
}

// ---- R1 ----

test("R1 the format is judged from the bytes alone: pdf, docx, xlsx, pptx, a macro-enabled twin named by its plain twin, odt, ods, odp, html and text", async () => {
  const twin = makeZip(partsOf(docx()).map((p) => ({ name: p.name, data: p.name !== "[Content_Types].xml" ? p.data
    : latin(p.data).replace("application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml", "application/vnd.ms-word.document.macroEnabled.main+xml") })));
  const cases = [[pdf(), "pdf"], [docx(), "docx"], [xlsx(), "xlsx"], [pptx(), "pptx"], [twin, "docx"], [odf("odt"), "odt"], [odf("ods"), "ods"], [odf("odp"), "odp"],
    [enc("<!DOCTYPE html><html><body><p>Agenda</p></body></html>"), "html"], [enc("item,amount\nroads,125\n"), "text"], [enc("Plain minutes.\r\n"), "text"],
    [new Uint8Array([0xff, 0xfe, ...Buffer.from("<html><b>x</b></html>", "utf16le")]), "html"], [new Uint8Array(Buffer.from("caf\xe9, 1\n", "latin1")), "text"],
    [new Uint8Array([0x20, 0x20, ...enc("%PDF-1.4"), ...pdf().subarray(8)]), "pdf"]];
  for (const [bytes, format] of cases) {
    const r = await cleanDocument(bytes);
    assert.equal(r.ok, true, `${format}: ${r.detail}`);
    assert.equal(r.format, format);
  }
});

test("R1 CSV and plain text answer clean:true with nothing else; an HTML document without a data:image URI too", async () => {
  for (const [s, format] of [["a,b\n1,2\n", "text"], ["just words", "text"], ["", "text"], ["<html><img src=\"photo.jpg\"></html>", "html"]])
    assert.deepEqual(await cleanDocument(enc(s)), { ok: true, clean: true, format });
});

test("R1 a copy answers its bytes, its format and the counts of images stripped and left unchanged", async () => {
  const plain = makeZip(partsOf(docx()).map((p) => ({ name: p.name, data: p.name.endsWith(".png") ? png({ meta: false }) : p.data })));
  const r = await cleanDocument(plain);
  assert.deepEqual(Object.keys(r).sort(), ["bytes", "clean", "format", "images", "ok"]);
  assert.equal(r.clean, false);
  assert.ok(r.bytes instanceof Uint8Array);
  assert.deepEqual(r.images, { stripped: 1, unchanged: 1 });
  const p = await cleanDocument(pdf({ more: [{ dict: "<< /Subtype /Image /Width 2 /Height 2 /ColorSpace /DeviceGray /BitsPerComponent 8 >>", data: new Uint8Array(4) }],
    ops: "q 1 0 0 1 0 0 cm Q", page: "/Thumb 9 0 R" }));
  assert.deepEqual(p.images, { stripped: 1, unchanged: 1 });
});

test("R1 R6 a document carrying neither image metadata nor document metadata answers clean:true: a PDF, a .docx, an ODF package", async () => {
  const bare = makePdf(["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /XObject << /Im 5 0 R >> >> /Contents 4 0 R >>",
    { dict: "<< >>", data: enc("q 10 0 0 10 0 0 cm /Im Do Q") },
    { dict: "<< /Type /XObject /Subtype /Image /Width 8 /Height 8 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /DCTDecode >>", data: jpeg({ meta: false }) }]);
  assert.deepEqual(await cleanDocument(bare), { ok: true, clean: true, format: "pdf" });
  assert.deepEqual(await cleanDocument(docx({ meta: false })), { ok: true, clean: true, format: "docx" });
  const noMeta = makeZip(partsOf(odf("odt")).filter((p) => p.name !== "meta.xml").map((p) => ({ name: p.name, method: p.method,
    data: p.name === "content.xml" ? latin(p.data).replace(/<(dc:creator|dc:date|meta:creator-initials)>[^<]*<\/\1>/g, "")
      : p.name.endsWith(".jpg") ? jpeg({ meta: false }) : p.name.endsWith(".png") ? png({ meta: false }) : p.data })));
  assert.deepEqual(await cleanDocument(noMeta), { ok: true, clean: true, format: "odt" });
  const stamped = makeZip(partsOf(noMeta).map((p) => ({ name: p.name, method: p.method, data: p.data, dosDate: 0x5864, dosTime: 0x6000 })));
  assert.equal((await cleanDocument(stamped)).clean, false, "a ZIP time is removed by the copy");
});

test("R1 never throws: any value, empty, truncated or random bytes answer a refusal", async () => {
  const full = docx();
  const inputs = [undefined, null, 7, "text", {}, new Uint8Array(0).buffer, full.subarray(0, 200), full.subarray(0, full.length - 30), pdf().subarray(0, 300),
    new Uint8Array(4096).map((_, i) => (i * 7919) % 256), enc("%PDF-1.7\n1 0 obj\n<< /Type /Catalog"), new Uint8Array([0x50, 0x4b, 3, 4, 0, 0])];
  for (const x of inputs) {
    const r = await cleanDocument(x);
    assert.equal(typeof r, "object");
    if (!r.ok) assert.ok(r.code && typeof r.detail === "string");
  }
});

// ---- R2 ----

test("R2 a PDF copy: its JPEG carries no EXIF, XMP or comment, its coded data unchanged, and no image /Metadata", async () => {
  const r = await cleanDocument(pdf());
  assert.equal(r.ok, true);
  assert.deepEqual(secretsIn(r.bytes), []);
  const { doc, read } = await pdfObjects(r.bytes);
  const img = read.objects.find((o) => o.value.t === "stream" && o.value.dict.Subtype?.v === "Image");
  assert.equal(img.value.dict.Metadata, undefined);
  const bytes = doc.streamRawBytes(img.value);
  assert.equal(jpegCoded(bytes), jpegCoded(jpeg()));
  assert.ok(!text(bytes).includes("Exif") && !text(bytes).includes("http://ns.adobe.com/xap"));
});

test("R2 a PDF copy is the latest revision rewritten whole: an incrementally replaced image is gone, and every object it defines is reachable from its trailer", async () => {
  const updated = incremental(pdf(), jpeg({ meta: false }));
  assert.ok(has(updated, "GPSSECRET"), "the earlier revision still holds the old image");
  const r = await cleanDocument(updated);
  assert.deepEqual(secretsIn(r.bytes), []);
  const { defined, read } = await pdfObjects(r.bytes);
  assert.deepEqual(read.unresolved, []);
  assert.deepEqual(defined, read.objects.map((o) => o.num), "no object the trailer does not reach");
  assert.equal((text(r.bytes).match(/startxref/g) || []).length, 1);
  assert.deepEqual(Object.keys(read.trailer).sort(), ["Root", "Size"]);
});

test("R2 a PDF copy expands object streams and strips a page's /Thumb image", async () => {
  const src = makePdf(["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 6 0 R >> >> /Contents 4 0 R /Thumb 5 0 R >>",
    { dict: "<< >>", data: enc("BT /F1 12 Tf 20 150 Td (Thumbed) Tj ET") },
    { dict: "<< /Width 8 /Height 8 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /DCTDecode >>", data: jpeg() },
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]);
  const withStream = makePdf(["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R /Thumb 5 0 R >>",
    { dict: "<< >>", data: enc("BT /F1 12 Tf 20 150 Td (Thumbed) Tj ET") },
    { dict: "<< /Width 8 /Height 8 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /DCTDecode >>", data: jpeg() },
    objStm(7, ["<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"])]);
  for (const b of [src, withStream]) {
    const r = await cleanDocument(b);
    assert.equal(r.ok, true, r.detail);
    assert.deepEqual(secretsIn(r.bytes), []);
    assert.ok(!/\/ObjStm|\/XRef/.test(text(r.bytes)));
    const { read } = await pdfObjects(r.bytes);
    assert.ok(read.objects.some((o) => o.value.t === "dict" && o.value.map.BaseFont?.v === "Helvetica"));
    assert.equal(r.images.stripped, 1);
  }
});

test("R2 a JPEG 2000 image's xml box is stripped, in a PDF (JPXDecode) and in a package", async () => {
  const withJp2 = await cleanDocument(pdf({ more: [{ dict: "<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /Filter /JPXDecode >>", data: jp2() }], ops: "/Im2 Do", page: "/Resources << /XObject << /Im1 8 0 R /Im2 9 0 R >> /Font << /F1 5 0 R >> >>" }));
  assert.equal(withJp2.ok, true, withJp2.detail);
  assert.deepEqual(secretsIn(withJp2.bytes), []);
  const pkg = await cleanDocument(docx({ extra: [{ name: "word/media/image3.jp2", data: jp2() }] }));
  assert.equal(pkg.ok, true, pkg.detail);
  assert.ok(!has(part(pkg.bytes, "word/media/image3.jp2").data, "JP2SECRET"));
});

test("R2 a package copy is the same parts in the same order, only image and metadata parts changed, every part at the fixed time with no extra field and no comment", async () => {
  for (const original of [docx({ extra: [{ name: "word/media/image3.gif", data: gif() }] }), xlsx(), pptx(), odf("odt"), odf("ods"), odf("odp")]) {
    const r = await cleanDocument(original);
    assert.equal(r.ok, true, r.detail);
    const before = partsOf(original), after = unzipCopy(r.bytes);
    assert.equal(after.comment, 0);
    assert.deepEqual(after.parts.map((p) => p.name), before.map((p) => p.name).filter((n) => n !== "docProps/custom.xml"));
    const metaPart = /^(docProps\/|meta\.xml$|content\.xml$|styles\.xml$|\[Content_Types\]\.xml$|_rels\/\.rels$|word\/|ppt\/comment|xl\/comments|xl\/workbook\.xml$)/;
    for (const p of after.parts) {
      assert.deepEqual([p.time, p.date, p.extra, p.comment], [0, 0x21, 0, 0], p.name);
      const o = before.find((x) => x.name === p.name);
      assert.equal(p.method, o.method, p.name);
      if (!/\.(jpe?g|png|gif|jp2)$/.test(p.name) && !metaPart.test(p.name)) assert.deepEqual(p.data, o.data, `${p.name} unchanged`);
    }
    assert.deepEqual(secretsIn(r.bytes), []);
    for (const p of after.parts) assert.deepEqual(secretsIn(p.data), [], p.name);
    const odfMime = after.parts[0];
    if (odfMime.name === "mimetype") assert.equal(odfMime.method, 0, "mimetype first and stored");
  }
});

test("R2 a package's JPEG and PNG keep their coded data byte for byte; an EMZ's gzip header loses its name and time", async () => {
  const named = new Uint8Array([0x1f, 0x8b, 8, 8, 1, 2, 3, 4, 0, 3, ...enc("PATHSECRET.emf"), 0, ...gzipSync(Buffer.from(emf())).subarray(10)]);
  const r = await cleanDocument(docx({ extra: [{ name: "word/media/image4.emz", data: named }] }));
  assert.equal(r.ok, true, r.detail);
  assert.equal(jpegCoded(part(r.bytes, "word/media/image1.jpeg").data), jpegCoded(jpeg()));
  assert.equal(pngCoded(part(r.bytes, "word/media/image2.png").data), pngCoded(png()));
  const emz = part(r.bytes, "word/media/image4.emz").data;
  assert.deepEqual([...emz.subarray(0, 10)], [0x1f, 0x8b, 8, 0, 0, 0, 0, 0, 0, 0xff]);
  assert.ok(!has(emz, "PATHSECRET"));
  assert.deepEqual(new Uint8Array(gunzipSync(emz)), emf());
});


// ---- R3 ----

test("R3 ENCRYPTED: a PDF with a Standard security handler, an encrypted OOXML compound file, an ODF manifest listing encrypted parts", async () => {
  refused(await cleanDocument(pdf({ more: ["<< /Filter /Standard /V 2 /R 3 /O <00> /U <00> /P -4 >>"], trailer: "/Encrypt 9 0 R" })), "ENCRYPTED", /security handler|Encrypt/);
  const cfb = new Uint8Array(1024);
  cfb.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  cfb.set(Buffer.from("EncryptedPackage", "utf16le"), 600);
  refused(await cleanDocument(cfb), "ENCRYPTED", /EncryptedPackage/);
  refused(await cleanDocument(odf("odt", { manifest: '<manifest:file-entry manifest:full-path="secret.xml" manifest:media-type="text/xml"><manifest:encryption-data manifest:checksum="x"/></manifest:file-entry>' })), "ENCRYPTED");
});

test("R3 EMBEDDED_FILE: a PDF attachment (name tree and annotation), an OOXML embeddings/ part, a vbaProject.bin, an ODF embedded Object, each named", async () => {
  refused(await cleanDocument(pdf({ catalog: "/Names << /EmbeddedFiles << /Names [(a.txt) 9 0 R] >> >>", more: ["<< /Type /Filespec /F (a.txt) /EF << /F 10 0 R >> >>", { dict: "<< /Type /EmbeddedFile >>", data: enc("attached") }] })), "EMBEDDED_FILE", /object 9/);
  refused(await cleanDocument(pdf({ page: "/Annots [9 0 R]", more: ["<< /Type /Annot /Subtype /FileAttachment /Rect [0 0 10 10] /FS << /F (b.txt) /EF << /F 10 0 R >> >> >>", { dict: "<< >>", data: enc("attached") }] })), "EMBEDDED_FILE", /object 9/);
  refused(await cleanDocument(docx({ extra: [{ name: "word/embeddings/Sheet1.xlsx", data: xlsx() }] })), "EMBEDDED_FILE", /word\/embeddings\/Sheet1\.xlsx/);
  refused(await cleanDocument(xlsx({ extra: [{ name: "xl/vbaProject.bin", data: new Uint8Array(16) }] })), "EMBEDDED_FILE", /xl\/vbaProject\.bin/);
  refused(await cleanDocument(odf("odt", { extra: [{ name: "Object 1/content.xml", data: "<x/>" }] })), "EMBEDDED_FILE", /Object 1\//);
  refused(await cleanDocument(odf("odt", { extra: [{ name: "Object 2", data: new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]) }] })), "EMBEDDED_FILE", /part Object 2 /);
  refused(await cleanDocument(odf("odt", { manifest: '<manifest:file-entry manifest:full-path="Chart/" manifest:media-type="application/vnd.oasis.opendocument.chart"/>' })), "EMBEDDED_FILE", /Chart\//);
});

test("R3 IMAGE_NOT_CLEANABLE: TIFF, HEIC, AVIF and JPEG XL images; EMF and WMF holding a JPEG or PNG; SVG with <image> or <metadata>; a PDF inline JPEG; a BMP with a colour profile", async () => {
  const ftyp = (brand) => new Uint8Array([0, 0, 0, 24, ...enc("ftyp"), ...enc(brand), 0, 0, 0, 0, ...enc("mif1"), ...enc(brand), 0, 0, 0, 8, ...enc("meta")]);
  const bmp = (v5cs) => { const b = Buffer.alloc(14 + 124 + 4); b.write("BM", 0, "latin1"); b.writeUInt32LE(b.length, 2); b.writeUInt32LE(138, 10); b.writeUInt32LE(124, 14); b.writeInt32LE(1, 18); b.writeInt32LE(1, 22); b.writeUInt16LE(1, 26); b.writeUInt16LE(24, 28); b.write(v5cs, 14 + 56, "latin1"); return new Uint8Array(b); };
  const wmf = (inner) => new Uint8Array([1, 0, 9, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...inner, 3, 0, 0, 0, 0, 0]);
  const cases = [
    ["word/media/a.tif", new Uint8Array([0x49, 0x49, 0x2a, 0, 8, 0, 0, 0, 0, 0]), /a TIFF/],
    ["word/media/a.heic", ftyp("heic"), /HEIC or AVIF/], ["word/media/a.avif", ftyp("avif"), /HEIC or AVIF/],
    ["word/media/a.jxl", new Uint8Array([0xff, 0x0a, 0, 0]), /JPEG XL/],
    ["word/media/a.emf", emf(jpeg()), /EMF image holding a JPEG/], ["word/media/a.wmf", wmf(png()), /WMF image holding a PNG/],
    ["word/media/a.svg", enc('<svg xmlns="http://www.w3.org/2000/svg"><image href="x.jpg"/></svg>'), /<image>/],
    ["word/media/b.svg", enc('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><metadata>x</metadata></svg>'), /<metadata>/],
    ["word/media/a.bmp", bmp("DEBM"), /colour profile/],
  ];
  for (const [name, data, why] of cases) refused(await cleanDocument(docx({ extra: [{ name, data }] })), "IMAGE_NOT_CLEANABLE", new RegExp(`part ${name.replace(/\./g, "\\.")}: .*${why.source}`));
  refused(await cleanDocument(pdf({ ops: "q 8 0 0 8 0 0 cm BI /W 8 /H 8 /CS /G /BPC 8 /F /DCT ID \xff\xd8\xff EI Q" })), "IMAGE_NOT_CLEANABLE", /object 4: an inline JPEG/);
  refused(await cleanDocument(pdf({ ops: "q BI /W 8 /H 8 /CS /G /BPC 8 /Filter [/AHx /DCTDecode] ID 00 EI Q" })), "IMAGE_NOT_CLEANABLE", /inline JPEG/);
  const ok = await cleanDocument(docx({ extra: [{ name: "word/media/c.svg", data: enc('<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>') }, { name: "word/media/c.bmp", data: bmp("BGRs") }, { name: "word/media/c.emf", data: emf() }] }));
  assert.equal(ok.ok, true, ok.detail);
  assert.equal(ok.images.unchanged, 3);
  assert.ok((await cleanDocument(pdf({ ops: "q BI /W 1 /H 1 /CS /G /BPC 8 ID \x01 EI Q" }))).ok, "an inline image of samples is no refusal");
});

test("R3 HTML_EMBEDS_IMAGE, ARCHIVE and NOT_A_CLEANABLE_FORMAT", async () => {
  for (const s of ['<html><img src="data:image/png;base64,AAAA"></html>', '<p style="background:url(DATA:Image/jpeg;base64,AA)">x</p>', '<html><img src="data&colon;image/png;base64,AA"></html>'])
    refused(await cleanDocument(enc(s)), "HTML_EMBEDS_IMAGE", /data:image URI at character \d+/);
  refused(await cleanDocument(makeZip([{ name: "photo.jpg", data: jpeg() }])), "ARCHIVE", /neither an OOXML nor an ODF/);
  const cfb = new Uint8Array(1024);
  cfb.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  for (const b of [cfb, enc("{\\rtf1\\ansi hello}"), enc('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>'), enc("%!PS-Adobe-3.0\n"),
    enc("MIME-Version: 1.0\nContent-Type: multipart/mixed\n\n"), jpeg(), new Uint8Array([0, 1, 2, 3, 255]),
    makeZip([{ name: "[Content_Types].xml", data: '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/x.xml" ContentType="application/vnd.ms-visio.drawing.main+xml"/></Types>' }, { name: "x.xml", data: "<x/>" }])])
    refused(await cleanDocument(b), "NOT_A_CLEANABLE_FORMAT");
});

test("R3 DOCUMENT_TOO_LARGE: a file over CLEAN_MAX_BYTES, nothing read; a part declaring more than CLEAN_MAX_PART_BYTES", async () => {
  assert.equal(CLEAN_MAX_BYTES, 16777216);
  const big = new Uint8Array(CLEAN_MAX_BYTES + 1);
  big.set(enc("%PDF-1.7"));
  refused(await cleanDocument(big), "DOCUMENT_TOO_LARGE", /16777217 bytes/);
  const parts = partsOf(docx());
  const z = makeZip(parts.map((p) => ({ name: p.name, data: p.data, ...(p.name === "word/document.xml" ? { central: { uncompressedSize: CLEAN_MAX_PART_BYTES + 1 } } : {}) })));
  refused(await cleanDocument(z), "DOCUMENT_TOO_LARGE", /part word\/document\.xml declares/);
});

test("R3 DOCUMENT_UNREADABLE: a dangling PDF reference, a content stream that cannot be decoded, a part failing its CRC, a duplicated part", async () => {
  refused(await cleanDocument(pdf({ page: "/Annots [40 0 R]" })), "DOCUMENT_UNREADABLE", /object 40/);
  refused(await cleanDocument(makePdf(["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 9 9] /Contents 4 0 R >>",
    { dict: "<< /Filter /LZWDecode >>", data: new Uint8Array([0x80, 0x0b, 0x60, 0x50]) }])), "DOCUMENT_UNREADABLE", /object 4's content stream/);
  const parts = partsOf(docx());
  refused(await cleanDocument(makeZip(parts.map((p) => ({ name: p.name, data: p.data, ...(p.name === "word/comments.xml" ? { central: { crc32: 1 }, local: { crc32: 1 } } : {}) })))), "DOCUMENT_UNREADABLE", /word\/comments\.xml/);
  refused(await cleanDocument(makeZip([...parts.map((p) => ({ name: p.name, data: p.data })), { name: "word/comments.xml", data: "<x/>" }])), "DOCUMENT_UNREADABLE", /appears twice/);
});

test("R3 each refusal of image-cover's stripMetadata is relayed under its own code, naming the image", async () => {
  const cut = jpeg().subarray(0, 60);
  const r = await cleanDocument(docx({ extra: [{ name: "word/media/cut.jpeg", data: cut }] }));
  assert.equal(r.ok, false);
  assert.ok(["TRUNCATED_IMAGE_DATA", "IMAGE_DATA_CORRUPT"].includes(r.code), r.code);
  assert.match(r.detail, /part word\/media\/cut\.jpeg: /);
  const anim = new Uint8Array([...gif().subarray(0, gif().length - 1), 0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 0x44, 1, 0, 0x3b]);
  refused(await cleanDocument(docx({ extra: [{ name: "word/media/anim.gif", data: anim }] })), "ANIMATED_IMAGE", /part word\/media\/anim\.gif/);
  const p = await cleanDocument(pdf({ more: [{ dict: "<< /Subtype /Image /Width 8 /Height 8 /Filter /DCTDecode >>", data: cut }], ops: "/Im2 Do", page: "/Resources << /XObject << /Im1 8 0 R /Im2 9 0 R >> /Font << /F1 5 0 R >> >>" }));
  assert.equal(p.ok, false);
  assert.match(p.detail, /^object 9: /);
});

// ---- R6 ----

test("R6 a PDF copy: no trailer /Info, no catalog XMP, no annotation /T, /M or /CreationDate (a widget's field name kept), no signer's identity, the signature field unsigned", async () => {
  const r = await cleanDocument(pdf({
    page: "/Annots [9 0 R 10 0 R << /Type /Annot /Subtype /Text /Rect [0 0 5 5] /T (COMMENTERSECRET) /Contents (Check this) >>]",
    catalog: "/AcroForm << /Fields [10 0 R] /SigFlags 3 >> /Perms << /DocMDP 11 0 R >>",
    more: ["<< /Type /Annot /Subtype /Text /Rect [0 0 10 10] /T (COMMENTERSECRET) /M (D:20190304) /CreationDate (D:20190304) /Contents (Check this figure) >>",
      "<< /Type /Annot /Subtype /Widget /FT /Sig /T (Signature1) /Rect [0 0 10 10] /V 11 0 R /M (D:20190304) >>",
      "<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached /Name (SIGNERSECRET) /Location (SIGNERSECRET) /Reason (SIGNERSECRET) /ContactInfo (SIGNERSECRET) /M (D:20190304) /ByteRange [0 1 2 3] /Contents <5349474E45525345435245540000> >>"],
  }));
  assert.equal(r.ok, true, r.detail);
  assert.deepEqual(secretsIn(r.bytes), []);
  const { read } = await pdfObjects(r.bytes);
  assert.equal(read.trailer.Info, undefined);
  const dicts = read.objects.filter((o) => o.value.t === "dict").map((o) => o.value.map);
  const catalog = dicts.find((m) => m.Type?.v === "Catalog");
  assert.equal(catalog.Metadata, undefined);
  assert.equal(catalog.Perms, undefined);
  const widget = dicts.find((m) => m.Subtype?.v === "Widget");
  assert.equal(widget.T.v, "Signature1");
  assert.equal(widget.V, undefined);
  assert.equal(widget.M, undefined);
  const notes = dicts.filter((m) => m.Subtype?.v === "Text");
  assert.equal(notes.length, 1);
  assert.deepEqual(Object.keys(notes[0]).sort(), ["Contents", "Rect", "Subtype", "Type"]);
  assert.equal(notes[0].Contents.v, "Check this figure", "a comment's own text unchanged");
  assert.ok(!dicts.some((m) => m.Type?.v === "Sig"), "the signature dictionary is no longer reached");
  const page = dicts.find((m) => m.Type?.v === "Page");
  const direct = page.Annots.items.find((a) => a.t === "dict");
  assert.deepEqual(Object.keys(direct.map).sort(), ["Contents", "Rect", "Subtype", "Type"]);
});

test("R6 a .docx copy: core and app properties emptied of every named field and still valid, custom.xml removed with its relationship and override, comment and change authors, initials and dates emptied, their text kept", async () => {
  const original = docx();
  const r = await cleanDocument(original);
  const c = readContainer(r.bytes);
  assert.equal(c.ok, true);
  const core = await readCoreProperties(r.bytes, c);
  assert.deepEqual([core.ok, core.creator, core.lastModifiedBy, core.revision, core.created, core.modified, core.title], [true, null, null, null, null, null, "Minutes"]);
  const app = latin(part(r.bytes, "docProps/app.xml").data);
  assert.match(app, /^<\?xml[^>]*>\n<Properties xmlns="http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/extended-properties"><\/Properties>$/);
  assert.equal(part(r.bytes, "docProps/custom.xml"), undefined);
  assert.ok(!latin(part(r.bytes, "_rels/.rels").data).includes("custom"));
  assert.ok(!latin(part(r.bytes, "[Content_Types].xml").data).includes("custom.xml"));
  assert.ok(latin(part(r.bytes, "_rels/.rels").data).includes("docProps/core.xml"));
  const body = latin(part(r.bytes, "word/document.xml").data), comments = latin(part(r.bytes, "word/comments.xml").data);
  assert.ok(body.includes('<w:ins w:id="1" w:author="">') && body.includes('<w:del w:id="2" w:author="">'));
  assert.ok(body.includes("<w:t>added</w:t>") && body.includes("<w:delText>removed</w:delText>"), "the changes themselves kept");
  assert.ok(comments.includes('<w:comment w:id="0" w:author="" w:initials="">') && comments.includes("Check this figure"));
  assert.equal(latin(part(original, "word/document.xml").data).replace(/ w:author="[^"]*"| w:date="[^"]*"/g, ""), body.replace(/ w:author=""/g, ""));
});

test("R6 Word's people, settings template, PowerPoint's and Excel's comment authors, Excel's shared-workbook names and folder path are emptied", async () => {
  const W15 = 'xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"';
  const d = await cleanDocument(docx({ extra: [
    { name: "word/people.xml", data: `<w15:people ${W15}><w15:person w15:author="COMMENTERSECRET"><w15:presenceInfo w15:providerId="AD" w15:userId="COMMENTERSECRET@example.org"/></w15:person></w15:people>` },
    { name: "word/settings.xml", data: '<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:attachedTemplate r:id="rId1"/><w:zoom w:percent="100"/></w:settings>' },
    { name: "word/_rels/settings.xml.rels", data: '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/attachedTemplate" Target="file:///C:/Users/PATHSECRET/Normal.dotm" TargetMode="External"/></Relationships>' }] }));
  assert.equal(d.ok, true, d.detail);
  assert.deepEqual(secretsIn(d.bytes), []);
  for (const p of partsOf(d.bytes)) assert.deepEqual(secretsIn(p.data), [], p.name);
  assert.ok(latin(part(d.bytes, "word/settings.xml").data).includes('<w:zoom w:percent="100"/>'));
  const x = await cleanDocument(xlsx({ extra: [
    { name: "xl/persons/person.xml", data: '<personList xmlns="http://schemas.microsoft.com/office/spreadsheetml/2018/threadedcomments"><person displayName="COMMENTERSECRET" id="{1}" userId="COMMENTERSECRET" providerId="AD"/></personList>' },
    { name: "xl/revisions/userNames.xml", data: '<users xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="1"><userInfo guid="{1}" name="CHANGERSECRET" id="1" dateTime="2020-01-01T00:00:00"/></users>' },
    { name: "xl/revisions/revisionHeaders.xml", data: '<headers xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" guid="{1}"><header guid="{2}" dateTime="2020-01-01T00:00:00" maxSheetId="2" userName="CHANGERSECRET" r:id="rId1" xmlns:r="x"/></headers>' }] }));
  assert.equal(x.ok, true, x.detail);
  for (const p of partsOf(x.bytes)) assert.deepEqual(secretsIn(p.data), [], p.name);
  assert.ok(latin(part(x.bytes, "xl/comments1.xml").data).includes("<authors><author></author></authors>"));
  assert.ok(latin(part(x.bytes, "xl/comments1.xml").data).includes("Check the total"));
  const p = await cleanDocument(pptx());
  assert.ok(latin(part(p.bytes, "ppt/commentAuthors.xml").data).includes('<p:cmAuthor id="1" name="" initials="" lastIdx="1" clrIdx="0"/>'));
  assert.ok(latin(part(p.bytes, "ppt/comments/comment1.xml").data).includes('<p:cm authorId="1" idx="1"><p:pos x="10" y="10"/><p:text>Check the slide</p:text></p:cm>'));
});

test("R6 an ODF copy: meta.xml's named fields removed and the part kept valid, annotations' and tracked changes' creator and date emptied, their text kept", async () => {
  for (const flavour of ["odt", "ods", "odp"]) {
    const r = await cleanDocument(odf(flavour));
    const meta = latin(part(r.bytes, "meta.xml").data);
    assert.match(meta, /<office:meta><dc:title>Minutes<\/dc:title><meta:document-statistic meta:paragraph-count="2"\/><\/office:meta><\/office:document-meta>$/);
    const content = latin(part(r.bytes, "content.xml").data);
    assert.ok(content.includes("<dc:creator></dc:creator><dc:date></dc:date>"), flavour);
    assert.ok(/Check th(is figure|e total|e slide)/.test(content));
    if (flavour === "odt") assert.ok(content.includes("<meta:creator-initials></meta:creator-initials>") && content.includes("<office:change-info><dc:creator></dc:creator><dc:date></dc:date></office:change-info>"));
  }
});

test("R6 the edits find each namespace by the prefix the part declares, in either quote, in UTF-16 too, and leave comments, CDATA and every other byte as they were", async () => {
  const core = `<?xml version="1.0" encoding="UTF-16"?>\n<!-- kept <dc:creator>x</dc:creator> --><k:coreProperties xmlns:k='http://schemas.openxmlformats.org/package/2006/metadata/core-properties' xmlns:e="http://purl.org/dc/elements/1.1/" xmlns:t="http://purl.org/dc/terms/"><e:title><![CDATA[Minutes <b>]]></e:title><e:creator xml:lang='en'>AUTHORSECRET</e:creator><k:lastModifiedBy/><t:modified>2019-03-04</t:modified></k:coreProperties>`;
  const utf16 = new Uint8Array([0xff, 0xfe, ...Buffer.from(core, "utf16le")]);
  const doc = `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:q="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><q:p><q:ins q:id='1' q:author='CHANGERSECRET' q:date='2019-03-04'><q:r><q:t>kept w:author="x"</q:t></q:r></q:ins></q:p></w:body></w:document>`;
  const base = partsOf(docx()).filter((p) => !["docProps/core.xml", "word/document.xml"].includes(p.name));
  const r = await cleanDocument(makeZip([...base.map((p) => ({ name: p.name, data: p.data })), { name: "docProps/core.xml", data: utf16 }, { name: "word/document.xml", data: doc }]));
  assert.equal(r.ok, true, r.detail);
  const c = part(r.bytes, "docProps/core.xml").data;
  assert.deepEqual([...c.subarray(0, 2)], [0xff, 0xfe]);
  assert.equal(Buffer.from(c.subarray(2)).toString("utf16le"), core.replace("<e:creator xml:lang='en'>AUTHORSECRET</e:creator>", "").replace("<k:lastModifiedBy/>", "").replace("<t:modified>2019-03-04</t:modified>", ""));
  assert.equal(latin(part(r.bytes, "word/document.xml").data), doc.replace("q:author='CHANGERSECRET' q:date='2019-03-04'", "q:author=''"));
});

test("R3 EMBEDDED_MEDIA: a video or audio part (MP4, QuickTime, WAV, MP3, Ogg, WebM), a PDF RichMedia, 3D, screen or sound object, each named", async () => {
  const media = [["ppt/media/media1.mp4", new Uint8Array([0, 0, 0, 24, ...enc("ftypisom"), 0, 0, 2, 0, ...enc("isommp41"), 0, 0, 0, 8, ...enc("free")])],
    ["ppt/media/media2.mov", new Uint8Array([0, 0, 0, 20, ...enc("ftypqt  "), 0, 0, 2, 0, ...enc("qt  ")])],
    ["ppt/media/media3.wav", new Uint8Array([...enc("RIFF"), 36, 0, 0, 0, ...enc("WAVEfmt ")])], ["ppt/media/media4.mp3", new Uint8Array([...enc("ID3"), 4, 0, 0, 0, 0, 0, 0])],
    ["ppt/media/media5.ogg", enc("OggS\0\x02")], ["ppt/media/media6.webm", new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81])]];
  for (const [name, data] of media) refused(await cleanDocument(docx({ extra: [{ name, data }] })), "EMBEDDED_MEDIA", new RegExp(`part ${name.replace(/\./g, "\\.")}: `));
  refused(await cleanDocument(odf("odp", { extra: [{ name: "Media/clip.mp4", data: media[0][1] }] })), "EMBEDDED_MEDIA", /Media\/clip\.mp4/);
  for (const [annot, more] of [["/Subtype /RichMedia /RichMediaContent << >>", []], ["/Subtype /3D /3DD 10 0 R", [{ dict: "<< /Type /3D /Subtype /U3D >>", data: enc("U3D") }]],
    ["/Subtype /Screen /A << /S /Rendition >>", []], ["/Subtype /Sound /Sound 10 0 R", [{ dict: "<< /Type /Sound /R 8000 >>", data: new Uint8Array(8) }]]])
    refused(await cleanDocument(pdf({ page: "/Annots [9 0 R]", more: [`<< /Type /Annot ${annot} /Rect [0 0 9 9] >>`, ...more] })), "EMBEDDED_MEDIA", /object (9|10): /);
});

test("R6 K2351 OOXML printer settings and custom XML parts are removed with their relationships, overrides and r:id references", async () => {
  const x = partsOf(xlsx()).map((p) => ({ name: p.name, data: p.name === "xl/worksheets/sheet1.xml" ? latin(p.data).replace("</sheetData>", '</sheetData><pageSetup orientation="portrait" r:id="rId2"/>')
    : p.name === "xl/worksheets/_rels/sheet1.xml.rels" ? latin(p.data).replace("</Relationships>", '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/printerSettings" Target="../printerSettings/printerSettings1.bin"/></Relationships>')
    : p.name === "xl/_rels/workbook.xml.rels" ? latin(p.data).replace("</Relationships>", '<Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXml" Target="../customXml/item1.xml"/></Relationships>')
    : p.name === "[Content_Types].xml" ? latin(p.data).replace("</Types>", '<Default Extension="bin" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.printerSettings"/><Override PartName="/customXml/itemProps1.xml" ContentType="application/vnd.openxmlformats-officedocument.customXmlProperties+xml"/></Types>')
    : p.data }));
  const r = await cleanDocument(makeZip([...x, { name: "xl/printerSettings/printerSettings1.bin", data: Buffer.from("\\\\PRINTER\\PATHSECRET\0", "utf16le") },
    { name: "customXml/item1.xml", data: "<p:properties xmlns:p='x'><Owner>CUSTOMSECRET</Owner></p:properties>" }, { name: "customXml/itemProps1.xml", data: "<ds:datastoreItem xmlns:ds='y'/>" },
    { name: "customXml/_rels/item1.xml.rels", data: '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="t" Target="itemProps1.xml"/></Relationships>' }]));
  assert.equal(r.ok, true, r.detail);
  const names = partsOf(r.bytes).map((p) => p.name);
  assert.ok(!names.some((n) => /printerSettings|customXml/.test(n)), names.join());
  assert.ok(!latin(part(r.bytes, "xl/worksheets/_rels/sheet1.xml.rels").data).includes("printerSettings"));
  assert.ok(latin(part(r.bytes, "xl/worksheets/_rels/sheet1.xml.rels").data).includes("comments1.xml"));
  assert.ok(latin(part(r.bytes, "xl/worksheets/sheet1.xml").data).includes('<pageSetup orientation="portrait"/>'));
  assert.ok(!latin(part(r.bytes, "xl/_rels/workbook.xml.rels").data).includes("customXml"));
  assert.ok(!latin(part(r.bytes, "[Content_Types].xml").data).includes("itemProps1") && latin(part(r.bytes, "[Content_Types].xml").data).includes('Extension="bin"'));
  for (const p of partsOf(r.bytes)) assert.deepEqual(secretsIn(p.data), [], p.name);
});

test("R6 K2351 an EMF's description, an SVG's editor-namespace markup and a legacy Excel comment's leading author run are removed; the pictures and the comment's own text kept", async () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns:i="http://ns.adobe.com/AdobeIllustrator/10.0/" inkscape:export-filename="/home/PATHSECRET/a.png" width="2" height="2"><sodipodi:namedview id="n" inkscape:current-layer="l"><inkscape:grid/></sodipodi:namedview><i:pgf>PRIVATESECRET</i:pgf><rect width="1" height="1" inkscape:label="APPSECRET"/></svg>';
  const r = await cleanDocument(docx({ extra: [{ name: "word/media/d.emf", data: emf(new Uint8Array(0), "APPSECRET 1.0\0PATHSECRET\0\0") }, { name: "word/media/e.svg", data: svg },
    { name: "word/media/f.emz", data: gzipSync(Buffer.from(emf(new Uint8Array(0), "APPSECRET\0\0"))) }] }));
  assert.equal(r.ok, true, r.detail);
  assert.deepEqual(r.images, { stripped: 5, unchanged: 0 });
  const e = part(r.bytes, "word/media/d.emf").data;
  assert.equal(e.length, emf(new Uint8Array(0), "APPSECRET 1.0\0PATHSECRET\0\0").length);
  assert.deepEqual([...e.subarray(60, 68)], new Array(8).fill(0));
  assert.equal(latin(part(r.bytes, "word/media/e.svg").data), '<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns:i="http://ns.adobe.com/AdobeIllustrator/10.0/" width="2" height="2"><rect width="1" height="1"/></svg>');
  assert.deepEqual([...gunzipSync(part(r.bytes, "word/media/f.emz").data).subarray(60, 68)], new Array(8).fill(0));
  for (const p of partsOf(r.bytes)) assert.deepEqual(secretsIn(p.data), [], p.name);
  const x = await cleanDocument(xlsx());
  assert.ok(latin(part(x.bytes, "xl/comments1.xml").data).includes('<text><r><rPr><sz val="9"/></rPr><t xml:space="preserve">\nCheck the total</t></r></text>'));
  const kept = await cleanDocument(makeZip(partsOf(xlsx()).map((p) => ({ name: p.name, data: p.name === "xl/comments1.xml" ? latin(p.data).replace("COMMENTERSECRET:</t>", "Note:</t>") : p.data }))));
  assert.ok(latin(part(kept.bytes, "xl/comments1.xml").data).includes("<b/><sz val=\"9\"/></rPr><t>Note:</t>"), "a bold run that names no author is the comment's own text");
});

test("R6 K2351 a JBIG2 image's and its globals' comment segments are dropped, every other segment kept byte for byte", async () => {
  const info = jbig2Segment(1, 48, [0, 0, 0, 8, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0]), end = jbig2Segment(3, 49, []);
  const image = new Uint8Array([...info, ...jbig2Comment(2, "COMSECRET"), ...end]);
  const globals = deflateSync(Buffer.from([...jbig2Comment(0, "XMPSECRET"), ...jbig2Segment(4, 53, [1, 2])]));
  const r = await cleanDocument(pdf({ more: [{ dict: "<< /Type /XObject /Subtype /Image /Width 8 /Height 8 /BitsPerComponent 1 /ImageMask true /Filter /JBIG2Decode /DecodeParms << /JBIG2Globals 10 0 R >> >>", data: image },
    { dict: "<< /Filter /FlateDecode >>", data: globals }], ops: "/Im2 Do", page: "/Resources << /XObject << /Im1 8 0 R /Im2 9 0 R >> /Font << /F1 5 0 R >> >>" }));
  assert.equal(r.ok, true, r.detail);
  assert.deepEqual(secretsIn(r.bytes), []);
  const { doc, read } = await pdfObjects(r.bytes);
  const jb = read.objects.find((o) => o.value.t === "stream" && o.value.dict.Filter?.v === "JBIG2Decode");
  assert.deepEqual(doc.streamRawBytes(jb.value), new Uint8Array([...info, ...end]));
  const g = read.objects.find((o) => o.num === jb.value.dict.DecodeParms.map.JBIG2Globals.n).value;
  assert.equal(g.dict.Filter, undefined);
  assert.deepEqual(doc.streamRawBytes(g), jbig2Segment(4, 53, [1, 2]));
  assert.equal(r.images.stripped, 2);
  refused(await cleanDocument(pdf({ more: [{ dict: "<< /Subtype /Image /Width 8 /Height 8 /Filter /JBIG2Decode >>", data: new Uint8Array([0, 0, 0, 1, 48, 0, 1, 255, 255, 255, 255]) }], ops: "/Im2 Do", page: "/Resources << /XObject << /Im1 8 0 R /Im2 9 0 R >> /Font << /F1 5 0 R >> >>" })), "IMAGE_NOT_CLEANABLE", /object 9: a JBIG2 stream/);
});

// ---- R7, R8, R9 ----

test("R7 pure and deterministic: the same bytes answer the same bytes, alone, repeated or interleaved, and the input is not changed", async () => {
  const inputs = [pdf(), incremental(pdf(), jpeg()), docx(), xlsx(), pptx(), odf("odt"), odf("ods"), odf("odp")];
  const copies = inputs.map((b) => new Uint8Array(b));
  const first = [];
  for (const b of inputs) first.push(await cleanDocument(b));
  const again = await Promise.all([...inputs].reverse().map((b) => cleanDocument(b)));
  again.reverse();
  first.forEach((a, i) => { assert.equal(a.ok, true); assert.deepEqual(a, again[i]); assert.deepEqual(inputs[i], copies[i]); });
});

test("R8 never a partial copy: one image that cannot be stripped among good ones refuses the whole document, with no bytes", async () => {
  for (const b of [docx({ extra: [{ name: "word/media/z.tif", data: new Uint8Array([0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8]) }] }),
    odf("odt", { extra: [{ name: "Pictures/z.tif", data: new Uint8Array([0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8]) }] }),
    pdf({ more: [{ dict: "<< /Subtype /Image /Width 1 /Height 1 /Filter [/FlateDecode /DCTDecode] >>", data: deflateSync(Buffer.from(jpeg())) }], ops: "/Im2 Do", page: "/Resources << /XObject << /Im1 8 0 R /Im2 9 0 R >> /Font << /F1 5 0 R >> >>" })]) {
    const r = await cleanDocument(b);
    refused(r, "IMAGE_NOT_CLEANABLE");
  }
});

test("R9 no place is named in any refusal text or the module's exported words", async () => {
  const PLACE = /\b(oakland|alameda|berkeley|california|san francisco|county of|city of|state of)\b/i;
  const texts = [...Object.values(CLEAN_REFUSALS)];
  for (const b of [enc('<img src="data:image/png;base64,">'), makeZip([{ name: "a", data: "b" }]), enc("{\\rtf1}"), new Uint8Array(CLEAN_MAX_BYTES + 1),
    pdf({ page: "/Annots [40 0 R]" }), pdf({ trailer: "/Encrypt << /Filter /Standard /R 3 >>" }), docx({ extra: [{ name: "word/embeddings/a.bin", data: "x" }] }),
    docx({ extra: [{ name: "word/media/z.tif", data: new Uint8Array([0x4d, 0x4d, 0, 0x2a]) }] }), null])
    texts.push((await cleanDocument(b)).detail);
  assert.ok(texts.length >= 17);
  for (const t of texts) { assert.equal(typeof t, "string"); assert.doesNotMatch(t, PLACE); }
});

test("K3957 the refusal sentences are read by id, each refusal answering its code and a text: doc-clean.index.an_embedded_image_is_of_a_kind, doc-clean.index.the_document_carries_a_video_audio, doc-clean.index.the_file_is_of_no_format, doc-clean.index.the_document_or_one_of, doc-clean.index.the_document_s_structure_cannot, doc-clean.index.the_document_s_bytes_are_not, doc-clean.index.an_encrypted_office_document_an, doc-clean.index.a_compound_file_a_legacy, doc-clean.index.a_postscript_document_not, doc-clean.package.the_package_s_manifest_lists_encrypted, doc-clean.pdf.the_trailer_s_root_is_not", async () => {
  for (const k of ["IMAGE_NOT_CLEANABLE", "EMBEDDED_MEDIA", "NOT_A_CLEANABLE_FORMAT", "DOCUMENT_TOO_LARGE", "DOCUMENT_UNREADABLE"])
    assert.equal(typeof CLEAN_REFUSALS[k], "string", k);
  const cfb = (extra) => {
    const b = new Uint8Array(1024);
    b.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    if (extra) b.set(Buffer.from(extra, "utf16le"), 600);
    return b;
  };
  const answered = async (b, code) => {
    const r = await cleanDocument(b);
    refused(r, code);
    assert.equal(typeof r.detail, "string");
    assert.notEqual(r.detail, "");
  };
  await answered("not a byte array", "NOT_A_CLEANABLE_FORMAT");
  await answered(cfb("EncryptedPackage"), "ENCRYPTED");
  await answered(cfb(""), "NOT_A_CLEANABLE_FORMAT");
  await answered(enc("%!PS-Adobe-3.0\n%%EOF\n"), "NOT_A_CLEANABLE_FORMAT");
  await answered(odf("odt", { manifest: '<manifest:file-entry manifest:full-path="secret.xml" manifest:media-type="text/xml"><manifest:encryption-data manifest:checksum="x"/></manifest:file-entry>' }), "ENCRYPTED");
  await answered(makePdf(["42"], { trailer: "/Root 1 0 R" }), "DOCUMENT_UNREADABLE");
});

test("K3964 every member-readable refusal sentence is read by id, each refusal answering its code and a text: doc-clean.index.the_document_is_encrypted, doc-clean.index.the_document_carries_an_embedded, doc-clean.index.the_html_document_embeds_an, doc-clean.index.the_file_is_a_zip_archive, doc-clean.index.a_zip_archive_that_is_neither, doc-clean.index.the_file_is_neither_a_pdf, doc-clean.index.an_rtf_document_not_a_format, doc-clean.index.a_mime_message_not_a, doc-clean.index.an_xml_or_svg_document, doc-clean.images.a_truncated_segment_header, doc-clean.images.a_malformed_referred_to_count, doc-clean.images.a_segment_of_unstated_length, doc-clean.images.a_segment_longer_than_the_stream, doc-clean.images.the_image_could_not_be_stripped, doc-clean.images.where_an_svg_image_with_an, doc-clean.images.where_media_compressed, doc-clean.images.name_tiff, doc-clean.images.name_heif, doc-clean.images.name_jxl, doc-clean.images.name_emf, doc-clean.images.name_wmf, doc-clean.images.name_svm, doc-clean.package.part_cannot_be_read_why, doc-clean.package.part_n_media, doc-clean.pdf.the_pdf_cannot_be_opened, doc-clean.pdf.the_pdf_is_encrypted_a, doc-clean.pdf.the_pdf_has_no_readable, doc-clean.pdf.the_pdf_s_trailer_names_an, doc-clean.pdf.a_number_the_pdf_writer, doc-clean.pdf.a_string_the_pdf_reader, doc-clean.pdf.a_value_the_pdf_writer_cannot", async () => {
  const answered = async (b, code) => {
    const r = await cleanDocument(b);
    refused(r, code);
    assert.equal(typeof r.detail, "string");
    assert.notEqual(r.detail, "");
  };
  await answered(enc("{\\rtf1 hello}"), "NOT_A_CLEANABLE_FORMAT");
  await answered(enc("MIME-Version: 1.0\nSubject: a\n"), "NOT_A_CLEANABLE_FORMAT");
  await answered(enc('<?xml version="1.0"?><a/>'), "NOT_A_CLEANABLE_FORMAT");
  await answered(new Uint8Array([0x41, 0x00, 0x01, 0x42]), "NOT_A_CLEANABLE_FORMAT");
  await answered(makeZip([{ name: "a", data: "b" }]), "ARCHIVE");
  await answered(enc('<img src="data:image/png;base64,">'), "HTML_EMBEDS_IMAGE");
  for (const k of ["ENCRYPTED", "EMBEDDED_FILE", "HTML_EMBEDS_IMAGE", "ARCHIVE", "IMAGE_NOT_CLEANABLE", "EMBEDDED_MEDIA", "NOT_A_CLEANABLE_FORMAT", "DOCUMENT_TOO_LARGE", "DOCUMENT_UNREADABLE"])
    assert.equal(typeof CLEAN_REFUSALS[k], "string", k);
});
