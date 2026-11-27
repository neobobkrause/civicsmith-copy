/* odf-reader R53 (fix round 9, G134a, G134b, G134d; X11, S-19): every part of a document is a unit with its kind, in
   `parts` on the three text() answers. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { odtEntry, odsEntry, odpEntry } from "../../../src/odf.mjs";
import { members, buildZip } from "./pkg.mjs";
import { ods, tableOf, rowOf, cellOf } from "./r9.mjs";

/** @typedef {import("../../../src/odf.mjs").TextUnit} TextUnit */
/** @typedef {import("./pkg.mjs").Flavour} Flavour */
/** @typedef {{ body: string, document: string, paras: number[], ref: string }} TextBoxCase */

const KINDS = ["body", "footnote", "endnote", "header", "footer", "comment", "tracked_deletion", "text_box", "speaker_note", "master_text", "cell_note"];
const STYLES_NS = `xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:presentation="urn:oasis:names:tc:opendocument:xmlns:presentation:1.0"`;
/** @param {string} master */
const styles = (master) => `<?xml version="1.0" encoding="UTF-8"?><office:document-styles ${STYLES_NS}><office:master-styles>${master}</office:master-styles></office:document-styles>`;
/** @param {Flavour} flavour @param {string} body @param {string} master */
const withStyles = (flavour, body, master) => buildZip(members(flavour, { body, extra: [{ name: "styles.xml", data: styles(master) }] }));
/** @param {{ parts: TextUnit[] }} t */
const kindsOf = (t) => t.parts.map((p) => p.kind);

test("R53 an ODT footnote and an endnote are their own units with their kind, never fused onto the host paragraph", async () => {
  const body = `<text:p>Pay is set<text:note text:id="ftn1" text:note-class="footnote"><text:note-citation>1</text:note-citation><text:note-body><text:p>The fee is $4,200 a year.</text:p></text:note-body></text:note> by the board<text:note text:id="edn1" text:note-class="endnote"><text:note-citation>i</text:note-citation><text:note-body><text:p>See annex B.</text:p><text:p>Second line.</text:p></text:note-body></text:note>.</text:p><text:p>Next.</text:p>`;
  const t = await odtEntry.text(buildZip(members("odt", { body })));
  assert.ok(t.ok);
  const para0 = t.paragraphs[0];
  assert.ok(para0);
  assert.equal(para0.text, "Pay is set by the board.");
  assert.equal(t.document, "Pay is set by the board.\nNext.");
  assert.deepEqual(t.parts, [
    { kind: "footnote", ref: "¶1", part: "content.xml", text: "The fee is $4,200 a year." },
    { kind: "endnote", ref: "¶1", part: "content.xml", text: "See annex B.\nSecond line." },
  ]);
});

test("R53 an ODT annotation, a tracked deletion and a text box are units; the annotation stays out of the paragraph", async () => {
  const body = `<text:tracked-changes><text:changed-region text:id="ct1"><text:deletion><office:change-info><dc:creator>A</dc:creator><dc:date>2026-01-01T00:00:00</dc:date></office:change-info><text:p>Removed clause.</text:p></text:deletion></text:changed-region></text:tracked-changes>`
    + `<text:p>Start<text:change text:change-id="ct1"/> <office:annotation office:name="c1"><dc:creator>B</dc:creator><text:p>Check this.</text:p></office:annotation>middle<draw:frame draw:name="f"><draw:text-box><text:p>Boxed words.</text:p></draw:text-box></draw:frame> end</text:p>`;
  const t = await odtEntry.text(buildZip(members("odt", { body })));
  assert.ok(t.ok);
  const para0 = t.paragraphs[0];
  assert.ok(para0);
  assert.equal(para0.text, "Start middle end");
  const parts = t.parts;
  assert.ok(parts);
  const by = new Map(/** @type {[string, TextUnit][]} */ ([]));
  for (const p of parts) by.set(p.kind, p);
  assert.deepEqual(by.get("comment"), { kind: "comment", ref: "¶1", part: "content.xml", text: "Check this." });
  assert.deepEqual(by.get("tracked_deletion"), { kind: "tracked_deletion", ref: "¶1", part: "content.xml", text: "Removed clause." });
  assert.deepEqual(by.get("text_box"), { kind: "text_box", ref: "¶1", part: "content.xml", text: "Boxed words.", paras: [] });
  const document = t.document;
  assert.ok(document !== null);
  assert.equal(document.includes("Removed clause"), false);
});

test("R53 ODT headers and footers come from the master pages of styles.xml, with the package part named", async () => {
  const master = `<style:master-page style:name="Standard"><style:header><text:p>Header words</text:p></style:header><style:footer><text:p>Page <text:page-number/> footer</text:p></style:footer></style:master-page>`;
  const t = await odtEntry.text(withStyles("odt", `<text:p>body</text:p>`, master));
  assert.ok(t.ok);
  const parts = t.parts;
  assert.ok(parts);
  assert.deepEqual(parts.map((p) => [p.kind, p.part, p.text]), [["header", "styles.xml", "Header words"], ["footer", "styles.xml", "Page  footer"]]);
  assert.equal(parts.every((p) => typeof p.ref === "string" && p.ref.length > 0), true);
  assert.equal(t.document, "body");
});

test("R53 ODP speaker notes, master-page text and free text boxes are units, a hidden page's marked hidden", async () => {
  /** @param {string} name @param {boolean} hidden @param {string} notes */
  const page = (name, hidden, notes) => `<draw:page draw:name="${name}"${hidden ? ' presentation:visibility="hidden"' : ""}><draw:frame presentation:class="title"><draw:text-box><text:p>${name} title</text:p></draw:text-box></draw:frame><draw:frame><draw:text-box><text:p>${name} loose box</text:p></draw:text-box></draw:frame>`
    + `<presentation:notes><draw:frame><draw:text-box><text:p>${notes}</text:p></draw:text-box></draw:frame></presentation:notes></draw:page>`;
  const master = `<style:master-page style:name="Default"><draw:frame><draw:text-box><text:p>Master footer text</text:p></draw:text-box></draw:frame></style:master-page>`;
  const t = await odpEntry.text(withStyles("odp", page("one", false, "say hello") + page("two", true, "secret"), master));
  assert.ok(t.ok);
  const parts = t.parts;
  assert.ok(parts);
  const view = parts.map((p) => [p.kind, p.text, p.hidden ?? false]);
  assert.deepEqual(view, [
    ["text_box", "one loose box", false], ["speaker_note", "say hello", false],
    ["text_box", "two loose box", true], ["speaker_note", "secret", true],
    ["master_text", "Master footer text", false],
  ]);
  const note = parts.find((p) => p.kind === "speaker_note");
  assert.ok(note);
  assert.equal(note.ref, "slide 1 (notes)");
  assert.equal(parts.every((p) => KINDS.includes(p.kind) && typeof p.part === "string"), true);
  assert.equal(t.document, "one title\none loose box\ntwo title\ntwo loose box");
});

test("R53 an ODS cell note is a cell_note unit at the cell, and the cell shows its own value, not the note", async () => {
  const noted = `<table:table-cell office:value-type="float" office:value="5"><office:annotation office:name="n1"><dc:creator>Z</dc:creator><text:p>note text</text:p></office:annotation><text:p>5</text:p></table:table-cell>`;
  const t = await odsEntry.text(ods(tableOf("N", rowOf(cellOf("a") + noted))));
  assert.ok(t.ok);
  const s = t.sheets[0];
  assert.ok(s);
  assert.equal(s.text, "a\t5");
  const cells = s.cells;
  assert.ok(cells);
  assert.deepEqual(cells.map((c) => c.value), ["a", "5"]);
  assert.deepEqual(t.parts, [{ kind: "cell_note", ref: "N!B1", part: "content.xml", text: "note text" }]);
});

test("R53 a file with no further parts answers parts [] on all three entries, never absent", async () => {
  const odt = await odtEntry.text(buildZip(members("odt", { body: "<text:p>x</text:p>" })));
  assert.ok(odt.ok);
  assert.deepEqual(odt.parts, []);
  const odsT = await odsEntry.text(ods(tableOf("T", rowOf(cellOf("x")))));
  assert.ok(odsT.ok);
  assert.deepEqual(odsT.parts, []);
  const odp = await odpEntry.text(buildZip(members("odp", { body: `<draw:page draw:name="p"><draw:frame presentation:class="title"><draw:text-box><text:p>t</text:p></draw:text-box></draw:frame></draw:page>` })));
  assert.ok(odp.ok);
  assert.deepEqual(odp.parts, []);
});

test("R53 an ODT text box's words are answered once, as a text_box naming its paragraphs (G166); a paragraph outside a box stays body", async () => {
  /** @param {string} words */
  const box = (words) => `<draw:frame text:anchor-type="page"><draw:text-box><text:p>${words}</text:p></draw:text-box></draw:frame>`;
  /** @type {{ page_anchored: TextBoxCase, in_table_cell: TextBoxCase, in_paragraph: TextBoxCase }} */
  const cases = {
    page_anchored: { body: `<text:p>Before</text:p>${box("Boxed words.")}<text:p>After</text:p>`, document: "Before\nAfter", paras: [1], ref: "¶2" },
    in_table_cell: { body: `<table:table table:name="T"><table:table-row><table:table-cell>${box("Boxed words.")}</table:table-cell></table:table-row></table:table><text:p>After</text:p>`, document: "After", paras: [0], ref: "¶1" },
    in_paragraph: { body: `<text:p>Before <draw:frame><draw:text-box><text:p>Boxed words.</text:p></draw:text-box></draw:frame>after</text:p><text:p>After</text:p>`, document: "Before after\nAfter", paras: [], ref: "¶1" },
  };
  for (const [name, c] of Object.entries(cases)) {
    const t = await odtEntry.text(buildZip(members("odt", { body: c.body })));
    assert.ok(t.ok);
    const parts = t.parts;
    assert.ok(parts);
    const boxes = parts.filter((p) => p.kind === "text_box");
    assert.deepEqual(boxes, [{ kind: "text_box", ref: c.ref, part: "content.xml", text: "Boxed words.", paras: c.paras }], name);
    assert.equal(t.document, c.document, name);
    assert.equal(JSON.stringify(t.paragraphs).includes("Boxed words"), false, name);
    const paragraphs = t.paragraphs;
    for (const i of c.paras) {
      const para = paragraphs[i];
      assert.ok(para);
      assert.equal(para.text, "", name);
    }      // the slot is the file's, the words are the unit's
    assert.equal(t.paragraphs.find((p) => p.text === "After")?.ref !== undefined, true, name);   // control: body stays body
  }
});

test("R53 R6 R7 a text box's paragraphs keep their slots in structure() and its links stay the body's", async () => {
  const body = `<text:p>Before</text:p><draw:frame><draw:text-box><text:p>Box <text:a xlink:href="https://example.org/x">link</text:a></text:p><text:p>Second</text:p></draw:text-box></draw:frame><text:p>After</text:p>`;
  const bytes = buildZip(members("odt", { body }));
  const s = await odtEntry.structure(bytes);
  const t = await odtEntry.text(bytes);
  assert.ok(s.ok);
  assert.ok(t.ok);
  assert.equal(s.paragraphs, 4);
  assert.equal(t.paragraphs.length, 4);
  assert.equal(s.links.filter((l) => { const target = l.target; return (target != null && "url" in target ? target.url : undefined) === "https://example.org/x"; }).length, 1);
  const parts = t.parts;
  assert.ok(parts);
  const textBox = parts.find((p) => p.kind === "text_box");
  assert.ok(textBox);
  assert.deepEqual(textBox.paras, [1, 2]);
});
