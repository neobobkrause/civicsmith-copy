/* odf-reader R45 and R48 quoted from the table (fix round 9, G124): the repeat bound and the text bound are READ_BOUNDS
   rows taken through boundOf, no numeric literal kept here. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ODF_REPEAT_EXPANSION_MAX, odsEntry, odtEntry } from "../../../src/odf.mjs";
import { boundOf } from "../../../src/read-bounds.mjs";
import { MEASURED_OOXML_TEXT_BOUND_BYTES } from "../../../src/ooxml.mjs";
import { ods, tableOf, rowOf } from "./r9.mjs";
import { buildZip, members } from "./pkg.mjs";

test("R45 the repeat bound is the READ_BOUNDS row ods.repeat_units, and the module keeps no literal for a ceiling", () => {
  assert.equal(ODF_REPEAT_EXPANSION_MAX, boundOf("ods", "repeat_units"));
  const src = readFileSync(fileURLToPath(new URL("../../../src/odf.mjs", import.meta.url)), "utf8")
    .split("\n").filter((l) => !/^\s*(\/\*|\*|\/\/)/.test(l)).join("\n");
  for (const literal of [/\b262144\b/, /\b262_144\b/, /\b20971520\b/, /\b20\s*\*\s*1024\s*\*\s*1024\b/, /\b2\s*\*\*\s*18\b/]) assert.equal(literal.test(src), false, String(literal));
});

test("R48 the text bound is 20 MiB and is the ods.content_xml row; a repeat's copied text is judged by the same figure", async () => {
  assert.equal(boundOf("ods", "content_xml"), MEASURED_OOXML_TEXT_BOUND_BYTES);
  const cell = `<table:table-cell office:value-type="string" table:number-columns-repeated="4"><text:p>${"x".repeat(9_000_000)}</text:p></table:table-cell>`;
  const t = await odsEntry.text(ods(tableOf("S", rowOf(cell))));
  assert.ok(t.ok);
  const u = t.undetermined[0];
  assert.ok(u && "bound" in u);
  assert.equal(u.why, "over_repeat_bound");
  assert.equal(u.bound, boundOf("ods", "content_xml"));
  assert.equal(u.boundName, "MEASURED_OOXML_TEXT_BOUND_BYTES");
});
