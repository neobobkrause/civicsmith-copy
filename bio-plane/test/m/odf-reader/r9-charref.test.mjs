/* odf-reader R51 (fix round 9, G133c; X12): a numeric character reference that names no scalar value never makes a read
   throw; the part is stated unreadable, final, the same on every call, and the rest is read. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { odtEntry, odsEntry, odpEntry } from "../../../src/odf.mjs";
import { members, buildZip, contentXml, metaXml, manifestXml } from "./pkg.mjs";
import { cellOf, rowOf, tableOf } from "./r9.mjs";

const BAD = ["&#x110000;", "&#99999999999;", "&#xD800;", "&#0;", "&#12ab;", "&#xDFFF;", "&#;", "&#x;"];
const odtBody = (inner) => `<text:p>before</text:p><text:p>${inner}</text:p>`;

for (const ref of BAD) {
  test(`R51 ${ref} in content.xml: every operation answers, text() states content.xml unreadable and final, and it is the same twice`, async () => {
    const bytes = buildZip(members("odt", { body: odtBody(ref) }));
    const a = await odtEntry.text(bytes), b = await odtEntry.text(bytes);
    assert.equal(a.ok, true);
    assert.deepEqual(a.undetermined, [{ reason: "main_part_unreadable", part: "content.xml", why: "char_ref_invalid", final: true }]);
    assert.deepEqual(b, a);
    assert.equal(a.document, null);
    const s = await odtEntry.structure(bytes);
    assert.equal(s.ok, true);
    assert.equal(s.paragraphs, null);
    assert.deepEqual(s.evidentiary.undetermined.find((u) => u.part === "content.xml"), { part: "content.xml", why: "char_ref_invalid", final: true });
    const p = await odtEntry.parts(bytes);
    assert.equal(p.ok, true);
    assert.deepEqual(p.undetermined.find((u) => u.part === "content.xml"), { part: "content.xml", why: "char_ref_invalid", final: true });
  });
}

test("R51 a bad reference in meta.xml, the manifest or styles.xml states that part and reads the rest", async () => {
  const good = tableOf("T", rowOf(cellOf("fine")));
  for (const [name, patch] of [
    ["meta.xml", { meta: metaXml({ "dc:title": "t &#xD800; t" }) }],
    ["META-INF/manifest.xml", { manifest: manifestXml(["Object 1/content.xml"], "ods").replace("</manifest:manifest>", "<!-- &#x110000; --></manifest:manifest>") }],
  ]) {
    const bytes = buildZip(members("ods", { body: good, ...patch }));
    const s = await odsEntry.structure(bytes);
    assert.equal(s.ok, true);
    assert.deepEqual(s.evidentiary.undetermined.find((u) => u.part === name), { part: name, why: "char_ref_invalid", final: true }, name);
    const t = await odsEntry.text(bytes);
    assert.equal(t.sheets[0].text, "fine", name);
  }
  const styled = buildZip(members("ods", { body: good, extra: [{ name: "styles.xml", data: `<?xml version="1.0"?><office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"><x>&#0;</x></office:document-styles>` }] }));
  const st = await odsEntry.structure(styled);
  assert.deepEqual(st.active.find((a) => a.part === "styles.xml"), { kind: "unread", part: "styles.xml", why: "char_ref_invalid" });
  assert.equal((await odsEntry.text(styled)).sheets[0].text, "fine");
});

test("R51 valid references are read: decimal, hexadecimal, a supplementary plane character", async () => {
  const bytes = buildZip(members("odt", { body: odtBody("&#65;&#x42;&#x1F600;&#x10FFFF;&#9;") }));
  const t = await odtEntry.text(bytes);
  assert.equal(t.paragraphs[1].text, "AB\u{1F600}\u{10FFFF}\t");
});

test("R51 a hostile reference in every position of every entry never throws", async () => {
  for (const entry of [odtEntry, odsEntry, odpEntry]) {
    for (const ref of BAD) {
      const flavour = entry.format;
      const bytes = buildZip(members(flavour, { content: contentXml(flavour, "").replace("office:version", `office:foo="${ref}" office:version`), meta: metaXml({ "dc:title": ref }) }));
      for (const op of ["structure", "text"]) { const r = await entry[op](bytes); assert.equal(typeof r.ok, "boolean"); }
    }
  }
});
