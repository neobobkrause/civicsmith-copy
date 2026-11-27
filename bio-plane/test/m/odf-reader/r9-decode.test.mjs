/* odf-reader R54 (fix round 9, G131g; X9) and R55 (G126d): the parts decoded through the one decode, and the text-part
   predicate. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { odtEntry, odsEntry, odfEvidentiaryDigest, isOdfTextPart } from "../../../src/odf.mjs";
import { readContainer, declaredTextBytes } from "../../../src/ooxml.mjs";
import { members, buildZip, contentXml, metaXml, sha256Hex } from "./pkg.mjs";

/** @param {string} s */
const latin1 = (s) => Uint8Array.from([...s].map((c) => c.charCodeAt(0)));
/** @param {string} s @param {boolean} [be] @param {boolean} [bom] @returns {Uint8Array} */
function utf16(s, be = false, bom = true) {
  const out = new Uint8Array((s.length + (bom ? 1 : 0)) * 2);
  const v = new DataView(out.buffer);
  let at = 0;
  if (bom) { v.setUint16(at, 0xfeff, !be); at += 2; }
  for (let i = 0; i < s.length; i++, at += 2) v.setUint16(at, s.charCodeAt(i), !be);
  return out;
}
/** @param {string | Uint8Array} content */
const pack = (content) => buildZip(members("odt", { content }));

test("R54 a UTF-16 content.xml (with a BOM, either order) is read", async () => {
  const xml = contentXml("odt", "<text:p>Café déjà vu — ünï</text:p>").replace("UTF-8", "UTF-16");
  for (const be of [false, true]) {
    const t = await odtEntry.text(pack(utf16(xml, be)));
    assert.equal(t.ok, true);
    assert.equal(t.paragraphs[0]?.text, "Café déjà vu — ünï", be ? "UTF-16BE" : "UTF-16LE");
    assert.deepEqual(t.undetermined, []);
  }
});

test("R54 a part in a declared legacy charset is not decoded as UTF-8", async () => {
  const xml = contentXml("odt", "<text:p>Caf\xe9 r\xe9sum\xe9</text:p>").replace('encoding="UTF-8"', 'encoding="ISO-8859-1"');
  const t = await odtEntry.text(pack(latin1(xml)));
  assert.ok(t.ok);
  assert.equal(t.paragraphs[0]?.text, "Café résumé");
  const w = contentXml("odt", "<text:p>It\x92s 5\x80</text:p>").replace('encoding="UTF-8"', 'encoding="windows-1252"');
  const tw = await odtEntry.text(pack(latin1(w)));
  assert.ok(tw.ok);
  assert.equal(tw.paragraphs[0]?.text, "It’s 5€");
});

test("R54 meta.xml is decoded the same way: a UTF-16 meta.xml gives its core properties", async () => {
  const meta = metaXml({ "dc:title": "Título único" }).replace("UTF-8", "UTF-16");
  const bytes = buildZip(members("odt", { body: "<text:p>x</text:p>", meta: utf16(meta) }));
  const s = await odtEntry.structure(bytes);
  assert.ok(s.ok);
  const core = s.evidentiary.items.find((i) => i.kind === "core-properties");
  assert.ok(core?.kind === "core-properties");
  assert.equal(core.title, "Título único");
});

test("R54 a part with more than 0.5 % replacement characters is stated partial with the count; under it, none", async () => {
  /** @param {number} n @param {number} total */
  const bad = (n, total) => {
    const text = "a".repeat(total - n);
    const body = latin1(contentXml("odt", `<text:p>${text}</text:p>`));
    const at = body.length - 60;
    const out = new Uint8Array(body.length + n);
    out.set(body.subarray(0, at)); out.fill(0xff, at, at + n); out.set(body.subarray(at), at + n);
    return out;
  };
  const many = await odtEntry.text(pack(bad(40, 2000)));
  assert.equal(many.ok, true);
  const p = many.undetermined.find((u) => "reason" in u && u.reason === "partial");
  assert.ok(p && "reason" in p);
  assert.deepEqual({ part: p.part, replaced: p.replaced }, { part: "content.xml", replaced: 40 });
  assert.equal(many.counts.undetermined, many.undetermined.length);
  const few = await odtEntry.text(pack(bad(2, 20000)));
  assert.ok(few.ok);
  assert.equal(few.undetermined.some((u) => "reason" in u && u.reason === "partial"), false);
});

test("R54 the evidentiary digest stays over UTF-8 bytes and refuses anything else", async () => {
  const xml = contentXml("ods", "").replace("UTF-8", "UTF-16");
  const d = await odfEvidentiaryDigest(buildZip(members("ods", { content: utf16(xml) })), sha256Hex);
  assert.equal(d.determined, false);
  const ok = await odfEvidentiaryDigest(buildZip(members("ods", {})), sha256Hex);
  assert.equal(ok.determined, true);
});

test("R55 isOdfTextPart: true exactly for content.xml, styles.xml and meta.xml, whatever the spelling of the path, and never throws", () => {
  for (const n of ["content.xml", "styles.xml", "meta.xml", "/content.xml", "//meta.xml", "CONTENT.XML".toLowerCase()]) assert.equal(isOdfTextPart(n), true, n);
  for (const n of ["mimetype", "settings.xml", "META-INF/manifest.xml", "Pictures/a.png", "Object 1/content.xml", "content.xml.bak", "", "styles", "Thumbnails/thumbnail.png"]) assert.equal(isOdfTextPart(n), false, n);
  for (const junk of [null, undefined, 7, {}, [], Symbol("x"), () => 1]) assert.equal(isOdfTextPart(junk), false);
});

test("R55 a caller sums ooxml's declaredTextBytes over an ODF container with it", () => {
  const bytes = buildZip(members("odt", { body: "<text:p>x</text:p>", meta: metaXml({}), extra: [{ name: "styles.xml", data: "<a/>".repeat(100) }, { name: "Pictures/p.png", data: "x".repeat(5000) }] }));
  const c = readContainer(bytes);
  const d = declaredTextBytes(c, isOdfTextPart);
  const sizes = Object.fromEntries(c.entries.map((e) => [e.name, e.uncompressedSize]));
  assert.equal(d.total, sizes["content.xml"] + sizes["styles.xml"] + sizes["meta.xml"]);
});
