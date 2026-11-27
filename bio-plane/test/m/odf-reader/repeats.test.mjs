/* odf-reader: repeats expanded within a bound, R45 (N30), tested at the bound
 * through the three entries' own interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { odtEntry, odsEntry, odpEntry, odfEvidentiaryDigest, ODF_REPEAT_EXPANSION_MAX } from "../../../src/odf.mjs";
import { MEASURED_OOXML_TEXT_BOUND_BYTES } from "../../../src/ooxml.mjs";
import { pkg, metaXml, sha256Hex } from "./pkg.mjs";

/** @typedef {import("../../../src/odf.mjs").Envelope} Envelope */
/** @typedef {import("../../../src/odf.mjs").RepeatMarker} RepeatMarker */
/** @typedef {import("../../../src/odf.mjs").OdtStructure} OdtStructure */
/** @typedef {import("../../../src/odf.mjs").OdtText} OdtText */
/** @typedef {import("../../../src/odf.mjs").OdpStructure} OdpStructure */
/** @typedef {import("../../../src/odf.mjs").OdpText} OdpText */
/** @typedef {import("../../../src/odf.mjs").OdfEntry<OdtStructure, OdtText>} OdtEntry */
/** @typedef {import("../../../src/odf.mjs").OdfEntry<OdpStructure, OdpText>} OdpEntry */
/** @typedef {import("./pkg.mjs").PackageOptions} PackageOptions */

const MAX = 262144;
const UNITS = { text: "undetermined", why: "over_repeat_bound", units: MAX + 1, bound: MAX,
  boundName: "ODF_REPEAT_EXPANSION_MAX", metric: "expanded_repeat_units", final: true };
const CHARS = { text: "undetermined", why: "over_repeat_bound", units: MEASURED_OOXML_TEXT_BOUND_BYTES + 1,
  bound: MEASURED_OOXML_TEXT_BOUND_BYTES, boundName: "MEASURED_OOXML_TEXT_BOUND_BYTES", metric: "repeated_text_chars", final: true };

/** @param {string} rows */
const table = (rows) => `<table:table table:name="S">${rows}</table:table>`;
/** @param {string} cells @param {string} [attrs] */
const row = (cells, attrs = "") => `<table:table-row${attrs ? " " + attrs : ""}>${cells}</table:table-row>`;
/** @param {string} inner @param {number} [cols] */
const cell = (inner, cols = 1) => `<table:table-cell office:value-type="string"${cols > 1 ? ` table:number-columns-repeated="${cols}"` : ""}><text:p>${inner}</text:p></table:table-cell>`;
/** @param {number} [cols] */
const empty = (cols = 1) => `<table:table-cell${cols > 1 ? ` table:number-columns-repeated="${cols}"` : ""}/>`;
/** @param {number} c */
const spaces = (c) => `<text:s text:c="${c}"/>`;
/** @param {string} h */
const link = (h) => `<text:a xlink:href="${h}">l</text:a>`;
/** @param {{ evidentiary: Envelope }} s @param {string} kind */
const items = (s, kind) => s.evidentiary.items.filter((i) => i.kind === kind);
/** @param {string} body @param {PackageOptions} [o] */
const ods = (body, o = {}) => pkg("ods", { body: table(body), ...o });

/** An .ods answered over the repeat bound, by both projections, with `marker`.
 * @param {Uint8Array} bytes @param {RepeatMarker} marker */
async function refusedOds(bytes, marker) {
  const t = await odsEntry.text(bytes);
  assert.equal(t.ok, true);
  assert.deepEqual({ ...t, images: undefined }, {
    ok: true, container: "ods", document: null, sheets: [], rangeUnits: null, rangeUnitsSkipped: null, parts: null,
    undetermined: [marker], counts: { chars: 0, cells: 0, formulas: 0, undetermined: 1, scanned_bytes: t.counts.scanned_bytes }, images: undefined,
    active: [],   // R47: content.xml was read for its listeners; the repeat bound stops only the projection
  });
  const s = await odsEntry.structure(bytes);
  assert.equal(s.ok, true);
  assert.deepEqual(s.sheets, []);
  assert.ok(s.links.every((l) => l.partition === "intra" || l.partition === "undetermined"), "no link from the body");
  assert.ok(s.evidentiary.items.every((i) => i.kind === "core-properties"), "no item from the body");
  assert.deepEqual(s.evidentiary.undetermined.filter((u) => u.part === "content.xml"),
    [{ part: "content.xml", why: "over_repeat_bound", guard: marker }]);
  assert.ok(s.notes.some((n) => n.includes(marker.boundName)), JSON.stringify(s.notes));
}

test("R45 ODF_REPEAT_EXPANSION_MAX is exported as 262,144", () => {
  assert.equal(ODF_REPEAT_EXPANSION_MAX, MAX);
});

test("R45 a carrying cell repeated across 262,144 columns is read in full; across 262,145 the entry answers over_repeat_bound", async () => {
  const at = await odsEntry.text(ods(row(cell("v", MAX))));
  assert.equal(at.ok, true);
  const sheet0 = at.sheets[0];
  assert.ok(sheet0);
  assert.equal(sheet0.usedCols, MAX);
  assert.equal(at.counts.cells, MAX);
  assert.deepEqual(at.undetermined, []);
  const sAt = await odsEntry.structure(ods(row(cell(link("#x"), MAX / 2))));
  assert.ok(sAt.ok);
  assert.equal(sAt.links.length, MAX / 2, "links at every address, within the bound");
  await refusedOds(ods(row(cell("v", MAX + 1))), UNITS);
});

test("R45 rows × cells: 512 rows of 512 cells are read; 512 rows of 513 are refused", async () => {
  const at = await odsEntry.text(ods(row(cell("v").repeat(512), 'table:number-rows-repeated="512"')));
  assert.ok(at.ok);
  assert.equal(at.counts.cells, MAX);
  const sheet0 = at.sheets[0];
  assert.ok(sheet0);
  assert.deepEqual([sheet0.usedRows, sheet0.usedCols], [512, 512]);
  await refusedOds(ods(row(cell("v").repeat(513), 'table:number-rows-repeated="512"')), UNITS);
  // the same through one repeated cell element
  const viaCell = await odsEntry.text(ods(row(cell("v", 512), 'table:number-rows-repeated="512"')));
  assert.ok(viaCell.ok);
  assert.equal(viaCell.counts.cells, MAX);
  await refusedOds(ods(row(cell("v", 513), 'table:number-rows-repeated="512"')), UNITS);
});

test("R45 an empty run advanced over costs nothing, and a hidden row run is one unit however long", async () => {
  // 262,143 cells, a hidden empty run of a million rows (one range, one unit), padding of every size: exactly the bound
  const body = row(cell("v", MAX - 1) + empty(16384)) + row(empty(1024), 'table:visibility="collapse" table:number-rows-repeated="1000000"')
    + row(empty(1024), 'table:number-rows-repeated="1048000"');
  const at = await odsEntry.structure(ods(body));
  assert.ok(at.ok);
  assert.deepEqual(items(at, "hidden-rows"), [{ kind: "hidden-rows", sheet: "S",
    rows: [{ min: 2, max: 1000001, visibility: "collapse" }], count: 1, source: null }]);
  const text = await odsEntry.text(ods(body));
  assert.ok(text.ok);
  assert.equal(text.counts.cells, MAX - 1);
  // a second hidden range is one unit past the bound
  await refusedOds(ods(body + row(empty(), 'table:visibility="filter"')), UNITS);
});

test("R45 each space a text:c stands for is a unit, at each address its text is given", async () => {
  // one cell: 1 unit + 262,143 spaces
  const at = await odsEntry.text(ods(row(cell("a" + spaces(MAX - 1) + "b"))));
  assert.ok(at.ok);
  assert.equal(at.document, "a" + " ".repeat(MAX - 1) + "b");
  await refusedOds(ods(row(cell("a" + spaces(MAX) + "b"))), UNITS);
  // repeated over 2 columns: 2 cells + 2 × 131,071 spaces = 262,144
  const two = await odsEntry.text(ods(row(cell(spaces(131071), 2))));
  assert.ok(two.ok);
  assert.equal(two.counts.cells, 2);
  await refusedOds(ods(row(cell(spaces(131072), 2))), UNITS);
  // .odt and .odp text(): the same count
  const odtAt = await odtEntry.text(pkg("odt", { body: `<text:p>${spaces(MAX)}</text:p>` }));
  assert.ok(odtAt.ok);
  const para0 = odtAt.paragraphs[0];
  assert.ok(para0);
  const para0Text = para0.text;
  assert.ok(para0Text !== null);
  assert.equal(para0Text.length, MAX);
  const odtOver = await odtEntry.text(pkg("odt", { body: `<text:p>${spaces(MAX)}</text:p><text:p>${spaces(1)}</text:p>` }));
  assert.ok(odtOver.ok);
  assert.deepEqual([odtOver.document, odtOver.paragraphs, odtOver.tables, odtOver.undetermined, odtOver.counts],
    [null, [], null, [UNITS], { chars: 0, undetermined: 1, scanned_bytes: odtOver.counts.scanned_bytes }]);
  /** @param {string} inner */
  const frame = (inner) => `<draw:frame><draw:text-box><text:p>${inner}</text:p></draw:text-box></draw:frame>`;
  const odpAt = await odpEntry.text(pkg("odp", { body: `<draw:page>${frame(spaces(MAX))}</draw:page>` }));
  assert.ok(odpAt.ok);
  const odpAtDocument = odpAt.document;
  assert.ok(odpAtDocument !== null);
  assert.equal(odpAtDocument.length, MAX);
  const odpOver = await odpEntry.text(pkg("odp", { body: `<draw:page>${frame(spaces(MAX + 1))}</draw:page>` }));
  assert.ok(odpOver.ok);
  assert.deepEqual([odpOver.document, odpOver.slides, odpOver.speakerNotes, odpOver.deckLength, odpOver.undetermined],
    [null, [], [], null, [UNITS]]);
});

test("R45 text:c=\"2000000000\" answers over_repeat_bound on every entry, never reader_failed", async () => {
  const huge = spaces(2000000000);
  await refusedOds(ods(row(cell(huge))), UNITS);
  /** @param {string} t */
  const notes = (t) => `<presentation:notes><draw:frame><draw:text-box><text:p>${t}</text:p></draw:text-box></draw:frame></presentation:notes>`;
  /** @type {[OdtEntry | OdpEntry, string, "paragraphs" | "slides"][]} */
  const cases = [
    [odtEntry, `<text:p>x<office:annotation><text:p>${huge}</text:p></office:annotation></text:p><text:p>${huge}</text:p>`, "paragraphs"],
    [odpEntry, `<draw:page><draw:frame><draw:text-box><text:p>${huge}</text:p></draw:text-box></draw:frame>${notes(huge)}</draw:page>`, "slides"],
  ];
  for (const [entry, body, unit] of cases) {
    const f = entry.format;
    assert.ok(f === "odt" || f === "odp");
    const t = await entry.text(pkg(f, { body }));
    assert.equal(t.ok, true);
    assert.equal(t.document, null);
    assert.deepEqual(t.undetermined, [UNITS]);
    const s = await entry.structure(pkg(f, { body }));
    assert.equal(s.ok, true);
    assert.equal(unit === "paragraphs" ? ("paragraphs" in s ? s.paragraphs : undefined) : ("slides" in s ? s.slides : undefined), null);
    assert.deepEqual(s.links, []);
    assert.deepEqual(s.evidentiary.items, []);
    assert.deepEqual(s.evidentiary.undetermined.find((u) => u.part === "content.xml"), { part: "content.xml", why: "over_repeat_bound", guard: UNITS });
  }
  // structure() expands only what it emits: a paragraph's or a shape's own text is not read there
  const odtS = await odtEntry.structure(pkg("odt", { body: `<text:p>${huge}</text:p>` }));
  assert.ok(odtS.ok);
  assert.equal(odtS.paragraphs, 1);
  const odpS = await odpEntry.structure(pkg("odp", { body: `<draw:page><draw:frame><draw:text-box><text:p>${huge}</text:p></draw:text-box></draw:frame></draw:page>` }));
  assert.ok(odpS.ok);
  assert.equal(odpS.slides, 1);
});

test("R45 a link at a repeated address after its cell's first costs a unit; the first rides on the cell", async () => {
  // 131,072 cells + 131,071 link copies = 262,143
  const s = await odsEntry.structure(ods(row(cell(link("https://example.org/r"), 131072))));
  assert.ok(s.ok);
  assert.equal(s.counts.deferred, 131072);
  await refusedOds(ods(row(cell(link("https://example.org/r") + link("#two"), 87383))), UNITS);   // 87,383 + 2 × 87,382 = 262,147
  const exact = await odsEntry.structure(ods(row(cell(link("https://example.org/r") + link("#two"), 87382))));
  assert.ok(exact.ok);
  assert.equal(exact.links.length, 2 * 87382);   // 262,144 exactly
  // across rows too: 131,072 cells + 131,071 link copies = 262,143
  const rows = await odsEntry.structure(ods(row(cell(link("#a"), 65536), 'table:number-rows-repeated="2"')));
  assert.ok(rows.ok);
  assert.equal(rows.counts.anchor, 131072);
});

test("R45 the text a repeat copies is bounded by the size guard's own figure", async () => {
  const big = "x".repeat(10000);
  // 2,097 copies of 10,000 characters = 20,970,000, under 20,971,520
  const at = await odsEntry.text(ods(row(cell(big, 2098))));
  assert.ok(at.ok);
  assert.equal(at.counts.cells, 2098);
  const atDocument = at.document;
  assert.ok(atDocument !== null);
  assert.equal(atDocument.length, 2098 * 10000 + 2097);
  await refusedOds(ods(row(cell(big, 2099))), CHARS);
  // copies made by a row repeat count the same way
  await refusedOds(ods(row(cell(big, 2), 'table:number-rows-repeated="1050"')), CHARS);
  // a cell holding 20 MB repeated across 27 columns (27 units) is refused, never a RangeError
  await refusedOds(ods(row(cell("y".repeat(MEASURED_OOXML_TEXT_BOUND_BYTES - 4096), 27))), CHARS);
});

test("R45 outside content.xml is still answered, and the digest, which expands nothing, is unaffected", async () => {
  const bytes = ods(row(cell("v", MAX + 1)), {
    meta: metaXml({ "dc:title": "kept" }), manifestEntries: ["blob.bin"], extra: [{ name: "blob.bin", data: "embedded" }, { name: "Pictures/p.png", data: "png" }],
  });
  const s = await odsEntry.structure(bytes);
  assert.ok(s.ok);
  assert.deepEqual(items(s, "core-properties").map((i) => ("title" in i ? i.title : undefined)), ["kept"]);
  assert.deepEqual(s.links.map((l) => { const target = l.target; return [l.partition, "name" in target ? target.name : undefined]; }), [["intra", "blob.bin"]]);
  const t = await odsEntry.text(bytes);
  assert.ok(t.ok);
  const images = t.images;
  assert.ok(images);
  assert.equal(images.length, 1);
  const d = await odfEvidentiaryDigest(bytes, sha256Hex);
  assert.equal(d.determined, true, d.basis);
  // meta.xml is expanded on its own meter: a hostile one is stated, and content.xml still reads
  const m = await odsEntry.structure(ods(row(cell("v")), { meta: metaXml({ "dc:title": spaces(2000000000) }) }));
  assert.ok(m.ok);
  assert.deepEqual(m.evidentiary.undetermined, [{ part: "meta.xml", why: "over_repeat_bound" }]);
  assert.deepEqual(m.sheets.map((x) => x.name), ["S"]);
});
