/* office-readers, N439: a .pptx slide's `mc:AlternateContent` is read once, not twice
 * (R11's pptx arm over Markup Compatibility, ECMA-376 Part 3): the first `mc:Choice` is
 * read, every later `mc:Choice` and the `mc:Fallback` are not; with no `mc:Choice` the
 * `mc:Fallback` is. Slide numbers and the slide-grain unit do not move. And
 * `pptxRenumbering` (R29), the map extraction's migration of stored `slide-shape`
 * references reads. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { pptxEntry, slideShapeRef, pptxRenumbering } from "../../../src/pptx.mjs";
import { linkWrapper } from "../../../src/subresources.mjs";
import * as F from "./fixtures.mjs";
/** @import {PptxLinkTarget, ShapeRenumbering, SlideRenumbering, SlideShapeRef} from "../../../src/pptx.mjs" */
/** @import {Link} from "../../../src/docx.mjs" */

/** @param {string} s */
const sha = (s) => createHash("sha256").update(F.enc(s)).digest("hex");
const P = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
/** @param {PptxLinkTarget} target @param {string} url */
const targetsUrl = (target, url) => "url" in target && target.url === url;
/** @param {Link<PptxLinkTarget, SlideShapeRef>} l @returns {[string, SlideShapeRef | null]} the embedding's name (as a key) and where it is */
const nameAt = (l) => {
  const target = l.target;
  return [String("name" in target ? target.name : undefined), l.source];
};
const MC = 'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"';
/** @param {string} tree */
const sld = (tree) => `<?xml version="1.0"?><p:sld ${P}><p:cSld><p:spTree>${tree}</p:spTree></p:cSld></p:sld>`;
/** @param {string} tree */
const notes = (tree) => `<?xml version="1.0"?><p:notes ${P}><p:cSld><p:spTree>${tree}</p:spTree></p:cSld></p:notes>`;
/** @param {string} t @param {string | null} [rid] */
const sp = (t, rid = null) => `<p:sp><p:txBody><a:p><a:r>${rid ? `<a:rPr><a:hlinkClick r:id="${rid}"/></a:rPr>` : ""}<a:t>${t}</a:t></a:r></a:p></p:txBody></p:sp>`;
/** @param {string} rid */
const pic = (rid) => `<p:pic><p:blipFill><a:blip r:embed="${rid}"/></p:blipFill></p:pic>`;
/** @param {...string} branches */
const ac = (...branches) => `<mc:AlternateContent ${MC}>${branches.join("")}</mc:AlternateContent>`;
/** @param {string} inner @param {string} [req] */
const choice = (inner, req = "p14") => `<mc:Choice Requires="${req}">${inner}</mc:Choice>`;
/** @param {string} inner */
const fallback = (inner) => `<mc:Fallback>${inner}</mc:Fallback>`;
/** @param {...string} inner */
const grp = (...inner) => `<p:grpSp>${inner.join("")}</p:grpSp>`;
/** @param {...string} slides */
const deck = (...slides) => F.pptx({ slides: slides.map((xml, i) => ({ file: `slide${i + 1}.xml`, xml })) });

/* ------------------------------------------------------------------ R11: one branch read */

test("R11 pptx text: a shape written as an mc:Choice and its mc:Fallback copy is read once; the slide's shape count and document count it once", async () => {
  const xml = sld(sp("before") + ac(choice(sp("equation")), fallback(sp("equation") + pic("rIdImg"))) + sp("after"));
  const t = await pptxEntry.text(deck(xml, sld(sp("next slide"))));
  assert(t.ok);
  assert.deepEqual(t.slides, [
    { slide: 1, ref: "slide 1", part: "ppt/slides/slide1.xml", hidden: false, shapes: 3, text: "before\nequation\nafter" },
    { slide: 2, ref: "slide 2", part: "ppt/slides/slide2.xml", hidden: false, shapes: 1, text: "next slide" },
  ]);
  const doc = t.document;
  assert.equal(doc, "before\nequation\nafter\nnext slide");
  assert.equal(t.counts.chars, doc.length);
  assert.equal(t.deckLength, 2, "slide numbers and the deck do not move");
  const st = await pptxEntry.structure(deck(xml));
  assert(st.ok);
  assert.equal(st.slides, 1);
});

test("R11 pptx text: the first mc:Choice is read and every later one is not; with no mc:Choice the mc:Fallback is read; any prefix; an empty Choice is still the branch read", async () => {
  /** @param {string} tree */
  const texts = async (tree) => {
    const r = await pptxEntry.text(deck(sld(tree)));
    assert(r.ok);
    return r.slides.map((s) => [s.shapes, s.text])[0];
  };
  assert.deepEqual(await texts(ac(choice(sp("one")), choice(sp("two"), "a14"), fallback(sp("three")))), [1, "one"]);
  assert.deepEqual(await texts(ac(fallback(sp("only fallback")))), [1, "only fallback"]);
  const alt = `<x:AlternateContent xmlns:x="http://schemas.openxmlformats.org/markup-compatibility/2006"><x:Choice Requires="p14">${sp("c")}</x:Choice><x:Fallback>${sp("f")}</x:Fallback></x:AlternateContent>`;
  assert.deepEqual(await texts(alt + sp("z")), [2, "c\nz"]);
  assert.deepEqual(await texts(sp("a") + ac('<mc:Choice Requires="p14"/>', fallback(sp("f")))), [1, "a"]);
  // inside a text body: an mc:AlternateContent around runs reads one branch's runs
  const runs = `<p:sp><p:txBody><a:p><a:r><a:t>x </a:t></a:r>${ac(choice("<a:r><a:t>math</a:t></a:r>", "a14"), fallback("<a:r><a:t>math (picture)</a:t></a:r>"))}</a:p></p:txBody></p:sp>`;
  assert.deepEqual(await texts(runs), [1, "x math"]);
});

test("R11 pptx text: nested mc:AlternateContent is selected the same way inside a read branch, and ignored whole inside a skipped one", async () => {
  const inner = ac(choice(sp("inner choice")), fallback(sp("inner fallback")));
  const t = await pptxEntry.text(deck(sld(ac(choice(grp(inner)), fallback(grp(inner, sp("fb")))) + sp("end"))));
  assert(t.ok);
  const t0 = t.slides[0];
  assert(t0);
  assert.deepEqual([t0.shapes, t0.text], [3, "inner choice\nend"]);
  // a skipped Choice that itself nests a Choice: the depth is kept, the walk resumes after it
  const deep = ac(choice(sp("A")), choice(ac(choice(sp("B"))), "x"), fallback(sp("C"))) + sp("tail");
  const d = await pptxEntry.text(deck(sld(deep)));
  assert(d.ok);
  const d0 = d.slides[0];
  assert(d0);
  assert.deepEqual([d0.shapes, d0.text], [2, "A\ntail"]);
});

test("R11 R7 pptx: a shape after an mc:AlternateContent takes the index the read branch leaves it, and so do its hlink and embedding; nothing from a branch not read is emitted at a shape", async () => {
  const xml = sld(sp("t0") + ac(choice(sp("eq", "rIdC")), fallback(pic("rIdImg") + sp("eq", "rIdF"))) + sp("web", "rIdH") + pic("rIdE") + sp("jump", "rIdJ"));
  const b = F.pptx({ slides: [
    { file: "slide1.xml", xml, rels: [
      { id: "rIdH", target: "https://example.org/", external: true },
      { id: "rIdC", target: "https://example.org/choice", external: true },
      { id: "rIdF", target: "https://example.org/fallback", external: true },
      { id: "rIdE", type: F.RT.oleObject, target: "../embeddings/e.bin" },
      { id: "rIdJ", type: F.RT.slide, target: "slide2.xml" },
    ] },
    { file: "slide2.xml", texts: ["two"] },
  ], extra: [{ name: "ppt/embeddings/e.bin", data: "E" }] });
  const s = await pptxEntry.structure(b);
  assert(s.ok);
  /** @param {string} url */
  const by = (url) => s.links.filter((l) => targetsUrl(l.target, url)).map((l) => l.source);
  assert.deepEqual(by("https://example.org/choice"), [slideShapeRef(1, 1)]);
  assert.deepEqual(by("https://example.org/"), [slideShapeRef(1, 2)], "not 4: the fallback's two shapes take no index");
  assert.deepEqual(by("https://example.org/fallback"), [slideShapeRef(1)], "used only in a branch not read: carried once, at the slide");
  assert.deepEqual(s.links.find((l) => l.partition === "intra"), { partition: "intra", wrapper: linkWrapper.intra(sha("E")), target: { sha256: sha("E"), name: "e.bin", bytes: 1 }, source: slideShapeRef(1, 3) });
  assert.deepEqual(s.links.find((l) => l.partition === "anchor"), { partition: "anchor", wrapper: "#slide=2", target: { slide: 2, fragment: "#slide=2", part: "ppt/slides/slide2.xml" }, source: slideShapeRef(1, 4) });
  assert.equal(s.links.length, 5);
});

test("R11 R7 pptx: a relationship used only inside a branch not read still locates its embedding, at the shape holding the mc:AlternateContent, or at the slide when none holds it", async () => {
  const rels = [{ id: "rIdE", type: F.RT.oleObject, target: "../embeddings/e.bin" }, { id: "rIdG", type: F.RT.oleObject, target: "../embeddings/g.bin" }];
  const xml = sld(sp("a") + ac(choice(sp("ole")), fallback(pic("rIdE"))) + grp(sp("in group"), ac(choice(sp("ole2")), fallback(pic("rIdG")))));
  const s = await pptxEntry.structure(F.pptx({ slides: [{ file: "slide1.xml", xml, rels }], extra: [{ name: "ppt/embeddings/e.bin", data: "E" }, { name: "ppt/embeddings/g.bin", data: "G" }] }));
  assert(s.ok);
  const at = Object.fromEntries(s.links.filter((l) => l.partition === "intra").map(nameAt));
  assert.deepEqual(at, { "e.bin": slideShapeRef(1), "g.bin": slideShapeRef(1, 2) });
});

test("R11 R10 pptx: speaker notes read one branch the same way; hidden slides, slide numbers and the slide unit are unchanged", async () => {
  const b = F.pptx({ slides: [{ file: "slide1.xml", xml: sld(ac(choice(sp("s")), fallback(sp("s")))), rels: [{ id: "rIdN", type: F.RT.notes, target: "../notesSlides/n1.xml" }] }],
    extra: [{ name: "ppt/notesSlides/n1.xml", data: notes(ac(choice(sp("candid")), fallback(sp("candid")))) }] });
  const t = await pptxEntry.text(b);
  assert(t.ok);
  assert.deepEqual(t.speakerNotes, [{ slide: 1, ref: "slide 1 (notes)", part: "ppt/notesSlides/n1.xml", hidden: false, text: "candid" }]);
  assert.equal(t.counts.notesChars, "candid".length);
  assert.deepEqual(t.slides.map((x) => [x.slide, x.ref, x.shapes, x.text]), [[1, "slide 1", 1, "s"]]);
  const s = await pptxEntry.structure(b);
  assert(s.ok);
  assert.deepEqual(s.evidentiary.items.flatMap((i) => (i.kind === "speaker-notes" ? [i] : [])), [{ kind: "speaker-notes", slide: 1, part: "ppt/notesSlides/n1.xml", text: "candid", source: slideShapeRef(1) }]);
});

/* ------------------------------------------------------------------ R29: N439's migration map */

/* The walk before N439, kept here as the oracle: every shape open, every branch counted. */
/** @param {string} xml @returns {number} */
function oldShapes(xml) {
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<\/?([\w.-]+(?::[\w.-]+)?)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
  let n = 0;
  while (true) {
    const m = re.exec(xml);
    if (m === null) break;
    const name = m[1];
    if (name === undefined || m[0][1] === "/") continue;
    const local = name.split(":").pop();
    if (local !== undefined && ["sp", "pic", "graphicFrame", "cxnSp", "grpSp"].includes(local)) n++;
  }
  return n;
}

/** @param {number} n a count @returns {number[]} 0 to n - 1, as the keys of an array of n */
const indices = (n) => {
  /** @type {number[]} */
  const out = [];
  for (let i = 0; i < n; i++) out.push(i);
  return out;
};

const S1 = sld(sp("a") + ac(choice(`<p:graphicFrame/>`), fallback(pic("rIdX") + sp("fb"))) + grp(sp("g1"), ac(choice(sp("c")), choice(sp("c2"), "a14"), fallback(sp("f")))) + `<p:cxnSp/>` + sp("z"));
const S2 = sld(sp("plain") + pic("rIdY"));
const S3 = sld(ac(fallback(sp("only fallback"))) + sp("after"));

test("R29 R11 pptxRenumbering: per slide in deck order, one entry per shape the old walk numbered; kept ones carry the new walk's indices exactly, a branch not read null", async () => {
  // deck order: slide3.xml, slide1.xml, slide2.xml — the filenames say otherwise
  const b = F.pptx({ slides: [{ file: "slide3.xml", xml: S3 }, { file: "slide1.xml", xml: S1 }, { file: "slide2.xml", xml: S2 }] });
  const map = pptxRenumbering(await pptxEntry.parts(b));
  assert(map);
  assert.deepEqual(map.slides.map((s) => s.slide), [1, 2, 3]);
  const nowText = await pptxEntry.text(b);
  assert(nowText.ok);
  const now = nowText.slides;
  for (const [i, xml] of [S3, S1, S2].entries()) {
    /** @type {SlideRenumbering | undefined} */
    const slideMap = map.slides[i];
    assert(slideMap);
    const nowSlide = now[i];
    assert(nowSlide);
    /** @type {ShapeRenumbering[]} */
    const shapes = slideMap.shapes;
    assert.deepEqual(shapes.map((x) => x.old), indices(oldShapes(xml)), "every old index, once, in order");
    assert.deepEqual(shapes.filter((x) => x.new != null).map((x) => x.new), indices(nowSlide.shapes), "the kept shapes are the new walk's, in order, none missing");
  }
  const [m0, m1, m2] = map.slides;
  assert(m0 && m1 && m2);
  assert.deepEqual(m1.shapes, [
    { old: 0, new: 0 }, { old: 1, new: 1 }, { old: 2, new: null }, { old: 3, new: null },
    { old: 4, new: 2 }, { old: 5, new: 3 }, { old: 6, new: 4 }, { old: 7, new: null }, { old: 8, new: null },
    { old: 9, new: 5 }, { old: 10, new: 6 },
  ]);
  assert.deepEqual(m0.shapes, [{ old: 0, new: 0 }, { old: 1, new: 1 }]);
  assert.deepEqual(m2.shapes, [{ old: 0, new: 0 }, { old: 1, new: 1 }], "without mc:AlternateContent every index is its own");
  // a link at old shape 10 ("z") is cited now at shape 6
  const s = await pptxEntry.structure(F.pptx({ slides: [{ file: "slide1.xml", xml: S1.replace(sp("z"), sp("z", "rIdH")), rels: [{ id: "rIdH", target: "http://e.org/", external: true }] }] }));
  assert(s.ok);
  const shape10 = m1.shapes[10];
  assert(shape10);
  assert.deepEqual(s.links.find((l) => targetsUrl(l.target, "http://e.org/"))?.source, slideShapeRef(1, shape10.new));
});

test("R29 pptxRenumbering: an unnumbered slide is listed with slide null; an unread slide or a deck over the guard lists nothing to move; anything but an ok parts result is null, never a throw", async () => {
  const unnumbered = pptxRenumbering(await pptxEntry.parts(F.pptx({ presRels: false, slides: [{ file: "slide1.xml", xml: S3 }] })));
  assert.deepEqual(unnumbered, { slides: [{ slide: null, shapes: [{ old: 0, new: 0 }, { old: 1, new: 1 }] }] });
  const unread = pptxRenumbering(await pptxEntry.parts(F.pptx({ slides: [{ file: "a.xml", xml: S2 }, { file: "b.xml", xml: S1, cd: F.CORRUPT }] })));
  assert(unread);
  assert.deepEqual(unread.slides.map((s) => s.slide), [1]);
  const over = pptxRenumbering(await pptxEntry.parts(F.pptx({ slides: [{ file: "slide1.xml", xml: S1, cd: F.OVER }] })));
  assert.deepEqual(over, { slides: [] });
  for (const x of [undefined, null, 5, "x", {}, { ok: true }, new Uint8Array(2), await pptxEntry.parts(F.enc("junk"))]) assert.equal(pptxRenumbering(x), null);
});
