/* office-readers, N26: a .docx `mc:AlternateContent` is read once, not twice
 * (R7, R10, R11, R16 over Markup Compatibility, ECMA-376 Part 3): the first
 * `mc:Choice` is read, every later `mc:Choice` and the `mc:Fallback` are not;
 * with no `mc:Choice` the `mc:Fallback` is. And `docxRenumbering`, the map
 * extraction's migration of stored ¶ references reads. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { docxEntry, docParaRef, docxRenumbering } from "../../../src/docx.mjs";
import { linkWrapper } from "../../../src/subresources.mjs";
import * as F from "./fixtures.mjs";
/** @import {DocLinkTarget} from "../../../src/docx.mjs" */

/** @param {string} s */
const sha = (s) => createHash("sha256").update(F.enc(s)).digest("hex");
/** @param {DocLinkTarget} target @param {string} url */
const targetsUrl = (target, url) => "url" in target && target.url === url;
const MC = 'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"';
/** @param {...string} branches */
const ac = (...branches) => `<mc:AlternateContent ${MC}>${branches.join("")}</mc:AlternateContent>`;
/** @param {string} inner @param {string} [req] */
const choice = (inner, req = "wps") => `<mc:Choice Requires="${req}">${inner}</mc:Choice>`;
/** @param {string} inner */
const fallback = (inner) => `<mc:Fallback>${inner}</mc:Fallback>`;
/* A text box as Word writes it: DrawingML in the Choice, its VML copy in the Fallback. */
/** @param {...string} paras */
const txbx = (...paras) => `<w:txbxContent>${paras.join("")}</w:txbxContent>`;
/** @param {string[]} paras @param {string[]} [fb] */
const box = (paras, fb = paras) => `<w:r>${ac(choice(`<w:drawing>${txbx(...paras)}</w:drawing>`), fallback(`<w:pict>${txbx(...fb)}</w:pict>`))}</w:r>`;
/** @param {string} body */
const texts = async (body) => {
  const t = await docxEntry.text(F.docx({ body }));
  assert(t.ok);
  return t.paragraphs.map((p) => [p.para, p.text]);
};

test("R11 docx text: a text box written as an mc:Choice and its mc:Fallback copy is read once; numbering after it is not shifted", async () => {
  const body = F.wp(F.wr("before "), box([F.wp(F.wr("boxed")), F.wp(F.wr("second"))]), F.wr("after")) + F.wp(F.wr("next"));
  const t = await docxEntry.text(F.docx({ body }));
  assert(t.ok);
  assert.deepEqual(t.paragraphs, [
    { para: 0, ref: "¶1", text: "before after" }, { para: 1, ref: "¶2", text: "boxed" },
    { para: 2, ref: "¶3", text: "second" }, { para: 3, ref: "¶4", text: "next" },
  ]);
  assert.equal(t.document, "before after\nboxed\nsecond\nnext");
  const st = await docxEntry.structure(F.docx({ body }));
  assert(st.ok);
  assert.equal(st.paragraphs, 4);
});

test("R11 docx text: the first mc:Choice is read and every later one is not; with no mc:Choice the mc:Fallback is read; any prefix", async () => {
  assert.deepEqual(await texts(F.wp(`<w:r>${ac(choice("<w:t>one</w:t>"), choice("<w:t>two</w:t>", "w14"), fallback("<w:t>three</w:t>"))}</w:r>`)),
    [[0, "one"]]);
  assert.deepEqual(await texts(F.wp(`<w:r>${ac(fallback("<w:t>only fallback</w:t>"))}</w:r>`)), [[0, "only fallback"]]);
  const alt = `<x:AlternateContent xmlns:x="http://schemas.openxmlformats.org/markup-compatibility/2006"><x:Choice Requires="a">${txbx(F.wp(F.wr("c")))}</x:Choice><x:Fallback>${txbx(F.wp(F.wr("f")))}</x:Fallback></x:AlternateContent>`;
  assert.deepEqual(await texts(F.wp(`<w:r>${alt}</w:r>`) + F.wp(F.wr("z"))), [[0, ""], [1, "c"], [2, "z"]]);
  // an empty, self-closed Choice is still the branch read
  assert.deepEqual(await texts(F.wp(F.wr("a"), `<w:r>${ac("<mc:Choice Requires=\"wps\"/>", fallback(txbx(F.wp(F.wr("f")))))}</w:r>`)), [[0, "a"]]);
});

test("R11 docx text: nested mc:AlternateContent is selected the same way inside a read branch, and ignored whole inside a skipped one", async () => {
  const inner = ac(choice(txbx(F.wp(F.wr("inner choice")))), fallback(txbx(F.wp(F.wr("inner fallback")))));
  const body = F.wp(`<w:r>${ac(choice(txbx(F.wp(`<w:r>${inner}</w:r>`))), fallback(txbx(F.wp(`<w:r>${inner}</w:r>`), F.wp(F.wr("fb")))))}</w:r>`) + F.wp(F.wr("end"));
  assert.deepEqual(await texts(body), [[0, ""], [1, ""], [2, "inner choice"], [3, "end"]]);
  // a skipped Choice that itself nests a Choice: the depth is kept, the walk resumes after it
  const deep = F.wp(`<w:r>${ac(choice(txbx(F.wp(F.wr("A")))), choice(ac(choice(txbx(F.wp(F.wr("B"))))), "x"), fallback(txbx(F.wp(F.wr("C")))))}</w:r>`, F.wr("tail"));
  assert.deepEqual(await texts(deep), [[0, "tail"], [1, "A"]]);
});

test("R11 R16 docx tables: a table inside a branch not read is not a table of the reading, and later ordinals keep their numbers", async () => {
  /** @param {string} t */
  const tbl = (t) => `<w:tbl><w:tblGrid><w:gridCol/></w:tblGrid><w:tr><w:tc>${F.wp(F.wr(t))}</w:tc></w:tr></w:tbl>`;
  const body = F.wp(box([tbl("boxed")])) + tbl("after");
  const t = await docxEntry.text(F.docx({ body }));
  assert(t.ok);
  const tbls = t.tables;
  assert(tbls);
  assert.deepEqual(tbls.map(({ cells, ...x }) => x), [{ table: 0, ref: "table 1", rows: 1, cols: 1 }, { table: 1, ref: "table 2", rows: 1, cols: 1 }]);
  assert.deepEqual(tbls.map((x) => x.cells?.map((c) => [c.source.ref, c.value])), [[["table 1, A1", "boxed"]], [["table 2, A1", "after"]]]);
  assert.deepEqual(t.paragraphs.map((p) => p.text), ["", "boxed", "after"]);
});

test("R7 R10 docx: links, tracked changes, bookmarks and comment references in a branch not read are not emitted twice; the read branch's are", async () => {
  const rels = F.rels([{ id: "rIdH", target: "http://example.org/", external: true }, { id: "rIdE", type: F.RT.oleObject, target: "embeddings/e.bin" }]);
  /** @param {string} tag */
  const inBox = (tag) => F.wp(`<w:hyperlink r:id="rIdH">${F.wr("web")}</w:hyperlink>`, `<w:ins w:author="A">${F.wr("added")}</w:ins>`,
    `<w:bookmarkStart w:id="1" w:name="bm${tag}"/>`, '<w:r><w:commentReference w:id="7"/></w:r>');
  const body = F.wp(F.wr("x"), box([inBox("C")], [inBox("F")])) + F.wp(`<w:hyperlink w:anchor="bmF">${F.wr("j")}</w:hyperlink>`, `<w:hyperlink w:anchor="bmC">${F.wr("k")}</w:hyperlink>`);
  const comments = `<w:comments xmlns:w="w"><w:comment w:id="7"><w:p><w:r><w:t>c</w:t></w:r></w:p></w:comment></w:comments>`;
  const s = await docxEntry.structure(F.docx({ body, rels, comments }));
  assert(s.ok);
  assert.deepEqual(s.links.filter((l) => targetsUrl(l.target, "http://example.org/")).map((l) => l.source), [docParaRef(1, 0)]);
  assert.deepEqual(s.links.find((l) => {
    const target = l.target;
    return "bookmark" in target && target.bookmark === "bmF";
  }), { partition: "undetermined", wrapper: null, target: { why: "bookmark_unresolved", bookmark: "bmF" }, source: docParaRef(2, 0) });
  assert.deepEqual(s.links.find((l) => l.partition === "anchor")?.target, { para: 1, fragment: "#para=2", bookmark: "bmC" });
  assert.deepEqual(s.evidentiary.items.flatMap((i) => (i.kind === "tracked-change" ? [i.source] : [])), [docParaRef(1, 1)]);
  assert.deepEqual(s.evidentiary.items.flatMap((i) => (i.kind === "comment" ? [i] : []))[0]?.source, docParaRef(1, 2));
});

test("R7 docx: a relationship used only inside a branch not read still locates its embedding, at the paragraph and run holding the mc:AlternateContent", async () => {
  const rels = F.rels([{ id: "rIdE", type: F.RT.oleObject, target: "embeddings/e.bin" }]);
  const body = F.wp(F.wr("a"), `<w:r>${ac(choice('<w:drawing><a:blip xmlns:a="a" r:embed="rIdX"/></w:drawing>'), fallback('<w:object><o:OLEObject xmlns:o="o" r:id="rIdE"/></w:object>'))}</w:r>`);
  const s = await docxEntry.structure(F.docx({ body, rels, extra: [{ name: "word/embeddings/e.bin", data: "E" }] }));
  assert(s.ok);
  assert.deepEqual(s.links.find((l) => l.partition === "intra"), { partition: "intra", wrapper: linkWrapper.intra(sha("E")), target: { sha256: sha("E"), name: "e.bin", bytes: 1 }, source: docParaRef(0, 1) });
});

test("R11 docx: an mc:AlternateContent wrapping runs at paragraph level reads one branch's runs; later run indices count only those", async () => {
  const rels = F.rels([{ id: "rIdH", target: "http://example.org/", external: true }]);
  const body = F.wp(F.wr("a"), ac(choice(F.wr("b")), fallback(F.wr("b") + F.wr("b2"))), `<w:hyperlink r:id="rIdH">${F.wr("c")}</w:hyperlink>`);
  assert.deepEqual(await texts(body), [[0, "abc"]]);
  const s = await docxEntry.structure(F.docx({ body, rels }));
  assert(s.ok);
  assert.deepEqual(s.links[0]?.source, docParaRef(0, 2));
});

/* ------------------------------------------------------------------ R28: N26's migration map */

/* The walk before N26, kept here as the oracle the map is checked against: every <w:p>, <w:r>, <w:tbl>,
   numbered as walkDocumentBody numbered them when every branch was read. */
/**
 * The old walk's place: the paragraph and run it is in, and the paragraphs a text box interrupted.
 * @typedef {Object} OldWalk
 * @property {number} para
 * @property {number} run
 * @property {boolean} inPara
 * @property {number} last
 * @property {{para: number, run: number}[]} outer
 */
/** @param {string} xml */
function oldNumbering(xml) {
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<\/?([\w.-]+(?::[\w.-]+)?)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
  /** @type {OldWalk} */
  const s = { para: -1, run: -1, inPara: false, last: -1, outer: [] };
  /** @type {number[]} */
  const paras = [];
  /** @type {[number, number][]} */
  const runs = [];
  let tables = 0;
  while (true) {
    const m = re.exec(xml);
    if (m === null) break;
    const tag = m[1];
    if (tag === undefined) continue;
    const name = tag.split(":").pop(), closing = m[0][1] === "/", self = m[3] === "/";
    if (closing) { if (name === "p") { const top = s.outer.pop(); if (top) ({ para: s.para, run: s.run } = top); else s.inPara = false; } continue; }
    if (name === "p") {
      if (!self) { if (s.inPara) s.outer.push({ para: s.para, run: s.run }); s.para = ++s.last; s.run = -1; s.inPara = true; paras.push(s.para); }
      else { paras.push(++s.last); if (!s.inPara) { s.para = s.last; s.run = -1; } }
    } else if (name === "r" && !self && s.inPara) runs.push([s.para, ++s.run]);
    else if (name === "tbl") tables++;
  }
  return { paras, runs, tables };
}

const SAMPLE = F.wdoc(
  F.wp(F.wr("before "), box([F.wp(F.wr("boxed")), F.wp(F.wr("two"))], [F.wp(F.wr("boxed")), F.wp(F.wr("two"))]), F.wr("after"))
  + F.wp(F.wr("a"), ac(choice(F.wr("b")), fallback(F.wr("b") + F.wr("b2"))), F.wr("c"))
  + `<w:tbl><w:tr><w:tc>${F.wp(box([F.wp(F.wr("in cell"))], [`<w:tbl><w:tr><w:tc>${F.wp(F.wr("fb tbl"))}</w:tc></w:tr></w:tbl>`]))}</w:tc></w:tr></w:tbl>`
  + "<w:p/>" + F.wp(F.wr("last")));

test("R28 R11 docxRenumbering: one entry per paragraph, run and table the old walk numbered; kept ones carry the new walk's numbers exactly", async () => {
  const map = docxRenumbering(SAMPLE);
  assert(map);
  const old = oldNumbering(SAMPLE);
  assert.deepEqual(map.paragraphs.map((p) => p.old), old.paras);
  assert.deepEqual(map.runs.map((r) => [r.old.para, r.old.run]), old.runs);
  assert.equal(map.tables.length, old.tables);
  const nowText = await docxEntry.text(F.docx({ document: SAMPLE }));
  assert(nowText.ok);
  const now = nowText.paragraphs;
  const kept = map.paragraphs.filter((p) => p.new != null);
  assert.deepEqual(kept.map((p) => p.new), now.map((p) => p.para), "kept paragraphs are the new walk's, in order, none missing");
  assert.deepEqual(map.paragraphs.map((p) => [p.old, p.new, p.outer]), [
    [0, 0, null], [1, 1, null], [2, 2, null], [3, null, 0], [4, null, 0],
    [5, 3, null], [6, 4, null], [7, 5, null], [8, null, 4], [9, 6, null], [10, 7, null],
  ]);
  assert.deepEqual(map.runs.filter((r) => r.old.para === 5).map((r) => [r.old.run, r.new, r.outer]), [[0, { para: 3, run: 0 }, null], [1, { para: 3, run: 1 }, null], [2, null, 3], [3, null, 3], [4, { para: 3, run: 2 }, null]]);
  assert.deepEqual(map.tables, [{ old: 0, new: 0 }, { old: 1, new: null }]);
  const again = await docxEntry.text(F.docx({ document: SAMPLE }));
  assert(again.ok);
  assert.deepEqual(again.tables?.map((t) => t.table), [0]);
});

test("R28 R11 docxRenumbering: without mc:AlternateContent every number is its own; a non-string is null, never a throw", async () => {
  const xml = F.wdoc(F.wp(F.wr("a"), F.wr("b")) + "<w:p/>" + `<w:tbl><w:tr><w:tc>${F.wp(F.wr("c"))}</w:tc></w:tr></w:tbl>`);
  const map = docxRenumbering(xml);
  assert(map);
  assert.ok(map.paragraphs.every((p) => p.new === p.old && p.outer === null));
  assert.ok(map.runs.every((r) => {
    const now = r.new;
    return now?.para === r.old.para && now?.run === r.old.run && r.outer === null;
  }));
  assert.deepEqual(map.tables, [{ old: 0, new: 0 }]);
  for (const x of [undefined, null, 5, {}, new Uint8Array(2)]) assert.equal(docxRenumbering(x), null);
});
