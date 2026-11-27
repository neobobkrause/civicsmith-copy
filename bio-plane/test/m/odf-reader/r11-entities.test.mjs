/* odf-reader R11 (an ODT paragraph's text, in the body's order) and R14 (an ODS sheet's name): text and attribute values
   decode the five entities XML predefines and leave every other named reference exactly as written, including a name
   that is also a member of every JavaScript object (`&constructor;`, `&toString;`, `&__proto__;`). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { odtEntry, odsEntry } from "../../../src/odf.mjs";
import { cellOf, rowOf, tableOf, odt, ods } from "./r9.mjs";

const NOT_ENTITIES = ["&constructor;", "&toString;", "&__proto__;", "&hasOwnProperty;", "&valueOf;", "&nbsp;"];

test("R11 a paragraph decodes the five XML entities and keeps every other named reference as written", async () => {
  const body = `<text:p>&amp;&lt;&gt;&quot;&apos;</text:p>` + NOT_ENTITIES.map((r) => `<text:p>a ${r} b</text:p>`).join("");
  const t = await odtEntry.text(odt(body));
  assert.equal(t.ok, true);
  assert.deepEqual(t.paragraphs.map((p) => p.text), [`&<>"'`, ...NOT_ENTITIES.map((r) => `a ${r} b`)]);
  assert.deepEqual(t.undetermined, []);
});

test("R14 a sheet name (an attribute value) keeps a reference named for an object member as written", async () => {
  const body = tableOf("Q&amp;A &constructor;", rowOf(cellOf("x"))) + tableOf("&toString;", rowOf(cellOf("y")));
  const s = await odsEntry.structure(ods(body));
  assert.equal(s.ok, true);
  assert.deepEqual(s.sheets.map((x) => x.name), ["Q&A &constructor;", "&toString;"]);
});
