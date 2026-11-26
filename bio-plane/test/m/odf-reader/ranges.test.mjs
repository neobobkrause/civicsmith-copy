/* odf-reader: the .ods entry's named units, D-415's `.ods` half (N27)
 * (build/requirements/odf-reader.md R44; K278). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { odsEntry } from "../../../src/odf.mjs";
import { sheetRangeRef } from "../../../src/formats-xlsx.mjs";
import { buildZip, members, pkg, withCd, OVER_BOUND } from "./pkg.mjs";

/** @param {string} text */
const cell = (text) => `<table:table-cell office:value-type="string"><text:p>${text}</text:p></table:table-cell>`;
/** @param {string} name @param {string} [inner] */
const table = (name, inner = "") => `<table:table table:name="${name}"><table:table-row>${cell("x")}</table:table-row>${inner}</table:table>`;
/** @param {string} name @param {string | null} addr */
const nr = (name, addr) => `<table:named-range table:name="${name}" table:base-cell-address="$Data.$A$1"${addr == null ? "" : ` table:cell-range-address="${addr}"`}/>`;
/** @param {string} name @param {string} expr */
const ne = (name, expr) => `<table:named-expression table:name="${name}" table:base-cell-address="$Data.$A$1" table:expression="${expr}"/>`;
/** @param {string} name @param {string} addr */
const dr = (name, addr) => `<table:database-range table:name="${name}" table:target-range-address="${addr}"/>`;
/** @param {string} body */
const T = (body) => odsEntry.text(pkg("ods", { body }));

/* ------------------------------------------------------------------ R44 */

test("R44 named ranges and database ranges naming one rectangle on one sheet are sheet-range units, in document order, scoped and never hidden", async () => {
  const body = [
    table("Data", `<table:named-expressions>${nr("Local", "$Data.$C$3:.$A$1")}</table:named-expressions>`),
    table("My 'Q' Sheet"),
    `<table:named-expressions>`,
    nr("Block", "$Data.$A$1:.$B$4"),
    nr("OneCell", "$Data.$D$9"),
    nr("BothSheets", "$Data.A1:$Data.C2"),
    nr("Quoted", "$'My ''Q'' Sheet'.$B$2:$'My ''Q'' Sheet'.$C$3"),
    nr("CaseFolded", "$data.$A$1:.$A$2"),
    ne("Formula", "of:=1+1"),
    `</table:named-expressions>`,
    `<table:database-ranges>${dr("Db", "Data.A1:Data.B3")}${dr("DbQuoted", "'My ''Q'' Sheet'.A1:.A5")}</table:database-ranges>`,
  ].join("");
  const t = await T(body);
  assert.ok(t.ok);
  /** @param {string} source @param {string} name @param {string | null} scope @param {string} sheet @param {string} range */
  const u = (source, name, scope, sheet, range) => ({ source, name, scope, hidden: false, unit: sheetRangeRef(sheet, range) });
  assert.deepEqual(t.rangeUnits, [
    u("named-range", "Local", "Data", "Data", "A1:C3"),
    u("named-range", "Block", null, "Data", "A1:B4"),
    u("named-range", "OneCell", null, "Data", "D9:D9"),
    u("named-range", "BothSheets", null, "Data", "A1:C2"),
    u("named-range", "Quoted", null, "My 'Q' Sheet", "B2:C3"),
    u("named-range", "CaseFolded", null, "Data", "A1:A2"),
    u("database-range", "Db", "Data", "Data", "A1:B3"),
    u("database-range", "DbQuoted", "My 'Q' Sheet", "My 'Q' Sheet", "A1:A5"),
  ]);
  assert.deepEqual(t.rangeUnitsSkipped, [
    { source: "named-expression", name: "Formula", ref: "of:=1+1", why: "not_a_range_reference" },
  ]);
  for (const x of t.rangeUnits) assert.deepEqual(Object.keys(x.unit).sort(), ["kind", "range", "ref", "sheet"]);
});

test("R44 every other name is skipped with its reason and its reference verbatim, each accounted for once", async () => {
  /** @type {[string, string | null, string][]} */
  const cases = [
    ["Empty", "", "empty_reference"],
    ["Missing", null, "empty_reference"],
    ["Broken", "$#REF!.$A$1:.$B$2", "broken_reference"],
    ["TwoAreas", "$Data.$A$1:.$A$2 $Data.$C$1:.$C$2", "multi_area"],
    ["External", "'file:///x.ods'#$Data.$A$1", "external_workbook"],
    ["ThreeEnds", "$Data.A1:.B2:.C3", "not_a_range_reference"],
    ["NoSheet", ".A1:.B2", "not_a_range_reference"],
    ["Garbage", "hello", "not_a_range_reference"],
    ["TwoSheets", "$Data.A1:$Other.B2", "multi_sheet_reference"],
    ["WholeColumn", "$Data.$A:.$A", "whole_row_or_column"],
    ["WholeRow", "$Data.$3:.$5", "whole_row_or_column"],
    ["Gone", "$Nope.$A$1:.$B$2", "no_such_sheet"],
  ];
  const body = table("Data") + table("Other")
    + `<table:named-expressions>${cases.map(([n, a]) => nr(n, a)).join("")}</table:named-expressions>`
    + `<table:database-ranges>${dr("DbGone", "Nope.A1:Nope.B2")}${dr("DbBroken", "#REF!")}</table:database-ranges>`;
  const t = await T(body);
  assert.ok(t.ok);
  assert.deepEqual(t.rangeUnits, []);
  assert.deepEqual(t.rangeUnitsSkipped, [
    ...cases.map(([name, ref, why]) => ({ source: "named-range", name, ref, why })),
    { source: "database-range", name: "DbGone", ref: "Nope.A1:Nope.B2", why: "no_such_sheet" },
    { source: "database-range", name: "DbBroken", ref: "#REF!", why: "broken_reference" },
  ]);
});

test("R44 a document naming nothing carries two empty lists; one whose content.xml was not read carries null for both", async () => {
  const none = await T(table("Data"));
  assert.ok(none.ok);
  assert.deepEqual([none.rangeUnits, none.rangeUnitsSkipped], [[], []]);
  const body = table("Data") + `<table:named-expressions>${nr("Block", "$Data.$A$1:.$B$4")}</table:named-expressions>`;
  const over = await odsEntry.text(buildZip(withCd(members("ods", { body }), "content.xml", { usize: OVER_BOUND })));
  assert.equal(over.ok, true);
  assert.deepEqual([over.rangeUnits, over.rangeUnitsSkipped], [null, null]);
  for (const bytes of [
    buildZip(withCd(members("ods", { body }), "content.xml", { crc: 9 })),
    pkg("ods", { content: "<office:document-content><office:body><office:text/></office:body></office:document-content>" }),
  ]) {
    const t = await odsEntry.text(bytes);
    assert.ok(t.ok);
    assert.deepEqual([t.rangeUnits, t.rangeUnitsSkipped], [null, null]);
  }
});
