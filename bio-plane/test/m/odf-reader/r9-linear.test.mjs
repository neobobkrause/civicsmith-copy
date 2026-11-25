/* odf-reader R52 (fix round 9, G133d; X6): the work of reading a part is linear in its size: counts.scanned_bytes is at
   most 4 times the part's bytes for any shape, a tag over 64 KiB is stated as text with tag_over_bound, and yieldNow is
   awaited at least every 65,536 tokens. The counts are the assertion; no time is read from the object. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { odtEntry, odsEntry, odpEntry } from "../../../src/odf.mjs";
import { members, buildZip, contentXml } from "./pkg.mjs";
import { cellOf, rowOf, tableOf, ods } from "./r9.mjs";

const SHAPES = {
  "an unterminated <a  (96 KB)": () => "<text:p>ok</text:p>" + "<a ".repeat(32768),
  "40,000 copies of <a b=\"": () => "<text:p>ok</text:p>" + "<a b=\"".repeat(40000),
  "20,000 unclosed comments": () => "<text:p>ok</text:p>" + "<!-- x ".repeat(20000),
  "<!x> x 200,000": () => "<text:p>ok</text:p>" + "<!x>".repeat(200000),
  "20,000 unclosed CDATA": () => "<text:p>ok</text:p>" + "<![CDATA[ x ".repeat(20000),
  "deep repeated markup": () => "<text:span>".repeat(60000) + "x",
};

for (const [shape, make] of Object.entries(SHAPES)) {
  test(`R52 ${shape}: scanned_bytes is at most 4 times the part and the read answers`, async () => {
    const xml = contentXml("odt", make());
    const bytes = buildZip(members("odt", { content: xml }));
    const size = new TextEncoder().encode(xml).length;
    const t = await odtEntry.text(bytes);
    assert.equal(t.ok, true);
    assert.equal(typeof t.counts.scanned_bytes, "number", "scanned_bytes is stated");
    assert.equal(t.counts.scanned_bytes <= 4 * size, true, `${t.counts.scanned_bytes} > 4 * ${size}`);
    assert.equal(t.counts.scanned_bytes > 0, true);
    for (const op of ["structure"]) assert.equal((await odtEntry[op](bytes)).ok, true);
  });
}

test("R52 the same shapes inside a cell and a slide", async () => {
  const junk = "<a b=\"".repeat(40000);
  const sheet = contentXml("ods", `<table:table table:name="S"><table:table-row><table:table-cell office:value-type="string"><text:p>v</text:p></table:table-cell></table:table-row></table:table>${junk}`);
  const deck = contentXml("odp", `<draw:page draw:name="p"><draw:frame><draw:text-box><text:p>s</text:p></draw:text-box></draw:frame></draw:page>${junk}`);
  for (const [entry, xml] of [[odsEntry, sheet], [odpEntry, deck]]) {
    const bytes = buildZip(members(entry.format, { content: xml }));
    const t = await entry.text(bytes);
    assert.equal(t.ok, true);
    assert.equal(t.counts.scanned_bytes <= 4 * new TextEncoder().encode(xml).length, true);
  }
});

test("R52 a tag longer than 64 KiB is stated as text with tag_over_bound, and the text around it is read", async () => {
  const long = `<text:p text:style-name="${"x".repeat(70000)}">inside</text:p>`;
  const bytes = buildZip(members("odt", { body: `<text:p>one</text:p>${long}<text:p>two</text:p>` }));
  const t = await odtEntry.text(bytes);
  assert.equal(t.ok, true);
  const stated = t.undetermined.find((u) => u.reason === "tag_over_bound");
  assert.equal(stated.part, "content.xml");
  assert.equal(stated.count >= 1, true);
  assert.equal(t.counts.undetermined, t.undetermined.length);
  assert.equal(t.paragraphs.some((p) => p.text === "one"), true);
  assert.equal(t.paragraphs.some((p) => p.text === "two"), true);
  const ok = await odtEntry.text(buildZip(members("odt", { body: `<text:p text:style-name="${"x".repeat(60000)}">fits</text:p>` })));
  assert.deepEqual(ok.undetermined, []);
});

test("R52 yieldNow is awaited at least once for every 65,536 tokens", async () => {
  const rows = 40000; // 40,000 rows x 4 tags a row of markup, well over 65,536 tokens a pass
  let body = "";
  for (let r = 0; r < rows; r++) body += `<table:table-row><table:table-cell office:value-type="string"><text:p>v${r}</text:p></table:table-cell></table:table-row>`;
  const bytes = ods(tableOf("Long", body));
  let calls = 0;
  const t = await odsEntry.text(bytes, { yieldNow: async () => { calls++; } });
  assert.equal(t.sheets[0].usedRows, rows);
  const tokens = rows * 6; // row, cell, p open and close, cell and row close
  assert.equal(calls >= Math.floor(tokens / 65536), true, `${calls} yields for ${tokens} tokens`);
  let paras = "";
  for (let p = 0; p < 200000; p++) paras += `<text:p>p${p}</text:p>`;
  let callsOdt = 0;
  const o = await odtEntry.text(buildZip(members("odt", { body: paras })), { yieldNow: async () => { callsOdt++; } });
  assert.equal(o.paragraphs.length, 200000);
  assert.equal(callsOdt >= Math.floor(400000 / 65536), true, `${callsOdt}`);
});
