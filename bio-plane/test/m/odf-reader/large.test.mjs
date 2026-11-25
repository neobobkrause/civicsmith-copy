/* odf-reader R48 (fix round 4b, F7; K4487, BOB K4489): a content.xml over the 20 MiB bound is not read in pieces — this
   reader holds it as one string — and is stated with its size, as final, by every entry's text() and structure(). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { odtEntry, odsEntry, odpEntry } from "../../../src/odf.mjs";
import { MEASURED_OOXML_TEXT_BOUND_BYTES } from "../../../src/ooxml.mjs";
import { pkg } from "./pkg.mjs";

const BOUND = MEASURED_OOXML_TEXT_BOUND_BYTES;

/** A real package whose content.xml body is `kind` markup repeated to just over the bound. */
function bigPackage(flavour) {
  const unit = {
    odt: "<text:p>a paragraph of the body, repeated</text:p>",
    ods: "<table:table table:name=\"S\"><table:table-row><table:table-cell office:value-type=\"string\"><text:p>cell</text:p></table:table-cell></table:table-row></table:table>",
    odp: "<draw:page draw:name=\"p\"><draw:frame><draw:text-box><text:p>slide text</text:p></draw:text-box></draw:frame></draw:page>",
  }[flavour];
  return pkg(flavour, { body: unit.repeat(Math.ceil((BOUND + 4096) / unit.length)) });
}

for (const [flavour, entry] of [["odt", odtEntry], ["ods", odsEntry], ["odp", odpEntry]]) {
  test(`R48 ${flavour}: a content.xml over the bound is stated with its size, final, in text() and in structure()`, async () => {
    const bytes = bigPackage(flavour);
    const parts = await entry.parts(bytes);
    assert.equal(parts.ok, true);
    assert.equal(parts.contentXml, null);
    assert.equal(parts.declared.total > BOUND, true);
    const marker = {
      ok: false, text: "undetermined", why: "over_size_bound", size: parts.declared.total, bound: BOUND,
      boundName: "MEASURED_OOXML_TEXT_BOUND_BYTES", metric: "declared_uncompressed_text_part_bytes", final: true,
    };
    assert.deepEqual(parts.guard, marker);
    const t = await entry.text(parts);
    assert.equal(t.ok, true);
    assert.equal(t.document, null);
    assert.deepEqual(t.undetermined, [marker]);
    const s = await entry.structure(parts);
    assert.equal(s.ok, true);
    assert.deepEqual(s.evidentiary.undetermined.find((u) => u.why === "over_size_bound"), { part: "content.xml", why: "over_size_bound", guard: marker });
  });
}
