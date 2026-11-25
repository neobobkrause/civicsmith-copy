/* odf-reader: the .odt entry's structure() and text()
 * (build/requirements/odf-reader.md R6–R13). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { odtEntry } from "../../../src/odf.mjs";
import { sizeGuard } from "../../../src/ooxml.mjs";
import { linkWrapper } from "../../../src/subresources.mjs";
import { docParaRef, docTableRef } from "../../../src/docx.mjs";
import { buildZip, members, pkg, withCd, OVER_BOUND } from "./pkg.mjs";

const odt = (body, o = {}) => pkg("odt", { body, ...o });
const S = (b, o) => odtEntry.structure(odt(b, o));
const T = (b, o) => odtEntry.text(odt(b, o));
const items = (s, kind) => s.evidentiary.items.filter((i) => i.kind === kind);

const INFO = (creator, date) => `<office:change-info>${creator == null ? "" : `<dc:creator>${creator}</dc:creator>`}${date == null ? "" : `<dc:date>${date}</dc:date>`}</office:change-info>`;
const DELETED_TABLE = "<table:table table:name='gone'><table:table-row><table:table-cell><text:p>gone cell</text:p></table:table-cell></table:table-row></table:table>";

/* One body exercising every paragraph-level element: headings, a list, a
   table's cell paragraphs, a self-closing paragraph, an annotation's own
   paragraphs (excluded), and a deleted region's paragraphs (excluded). */
const RICH = `<text:tracked-changes>
  <text:changed-region text:id="del1"><text:deletion>${INFO("Del Author", "2026-01-02T03:04:05")}<text:p>gone one</text:p><text:p>gone two</text:p>${DELETED_TABLE}</text:deletion></text:changed-region>
  <text:changed-region text:id="ins1"><text:insertion>${INFO("Ins Author", "2026-02-03T04:05:06")}</text:insertion></text:changed-region>
  <text:changed-region text:id="bare"><text:insertion>${INFO(null, null)}</text:insertion></text:changed-region>
  <text:changed-region text:id="nowhere"><text:deletion>${INFO("N", "2026-03-04")}<text:p>never marked</text:p></text:deletion></text:changed-region>
</text:tracked-changes>
<text:h text:outline-level="1">Title</text:h>
<text:p>First <text:change text:change-id="del1"/>para<office:annotation office:name="c1"><dc:creator>Commenter</dc:creator><dc:date>2026-04-05T06:07:08</dc:date><meta:creator-initials>CM</meta:creator-initials><text:p>note line one</text:p><text:p>note line two</text:p></office:annotation> end</text:p>
<text:p>Before <text:change-start text:change-id='ins1'/>inserted words<text:change-end text:change-id='ins1'/> after</text:p>
<text:list><text:list-item><text:p>item <text:change-start text:change-id="bare"/>x<text:change-end text:change-id="bare"/></text:p></text:list-item></text:list>
<text:p/>
<table:table table:name="T1"><table:table-column table:number-columns-repeated="2"/><table:table-row><table:table-cell><text:p>c1</text:p></table:table-cell><table:table-cell><text:p>c2</text:p></table:table-cell></table:table-row></table:table>
<text:p>Spaces<text:s text:c="3"/>and<text:tab/>tab<text:line-break/>break &amp; &lt;ent&gt; &#65;</text:p>
<text:p><office:annotation><text:p>bare comment</text:p></office:annotation>host</text:p>`;

/* ------------------------------------------------------------------ R6 */

test("R6 paragraphs counts every <text:p>/<text:h> of the served body, tables included, deletions and annotations not", async () => {
  const s = await S(RICH);
  // h, p, p, list p, self-closed p, 2 table cell p, spaces p, host p
  assert.equal(s.paragraphs, 9);
  assert.equal((await S("")).paragraphs, 0);
  assert.equal((await S("<text:h>a</text:h><text:h/>")).paragraphs, 2);
  assert.equal((await odtEntry.structure(pkg("odt", { content: "<office:document-content/>" }))).paragraphs, null);
});

/* ------------------------------------------------------------------ R7 */

test("R7 links: every <text:a xlink:href> in the body, located to its doc-para, partitioned as linkWrapper partitions it", async () => {
  const hrefs = [
    ["#bookmark", "anchor"], ["https://example.org/a?b=1", "deferred"], ["http://example.org", "deferred"],
    ["relative/page.html", "deferred"], ["mailto:someone@example.org", "refused"], ["javascript:alert(1)", "refused"],
    ["ftp://example.org/f", "refused"], ["file:///etc/passwd", "refused"], ["data:text/plain,x", "refused"],
  ];
  const body = `<text:p>none</text:p>` + hrefs.map(([h], i) => `<text:p>p${i} <text:a xlink:href="${h}">link</text:a></text:p>`).join("")
    + `<text:p><text:a xlink:href="#two">a</text:a><text:a xlink:href="https://two.example">b</text:a></text:p>`;
  const s = await S(body);
  const want = hrefs.map(([h, partition], i) => {
    const source = docParaRef(i + 1);
    if (partition === "anchor") return { partition, wrapper: linkWrapper.anchor(h), target: { fragment: h, name: h.slice(1) }, source };
    return { partition, wrapper: partition === "deferred" ? linkWrapper.deferred(h) : linkWrapper.refused(), target: { url: h }, source };
  });
  want.push(
    { partition: "anchor", wrapper: "#two", target: { fragment: "#two", name: "two" }, source: docParaRef(hrefs.length + 1) },
    { partition: "deferred", wrapper: linkWrapper.deferred("https://two.example"), target: { url: "https://two.example" }, source: docParaRef(hrefs.length + 1) },
  );
  assert.deepEqual(s.links, want);
  assert.deepEqual(s.counts, { anchor: 2, intra: 0, deferred: 4, refused: 5, undetermined: 0 });
});

/* ------------------------------------------------------------------ R8 */

test("R8 tracked changes: one item per changed region, with author, date, source, and the superseded or inserted wording", async () => {
  const s = await S(RICH);
  assert.deepEqual(items(s, "tracked-change"), [
    { kind: "tracked-change", change: "deletion", author: "Del Author", date: "2026-01-02T03:04:05", source: docParaRef(1), superseded: "gone one\ngone two\ngone cell" },
    { kind: "tracked-change", change: "insertion", author: "Ins Author", date: "2026-02-03T04:05:06", source: docParaRef(2), text: "inserted words" },
    { kind: "tracked-change", change: "insertion", author: null, date: null, source: docParaRef(3), text: "x" },
    { kind: "tracked-change", change: "deletion", author: "N", date: "2026-03-04", source: null, superseded: "never marked", why: "change_region_unmarked_in_body" },
  ]);
  // an insertion the body never marks: source null, text null, the reason stated
  const u = await S(`<text:tracked-changes><text:changed-region text:id="i9"><text:insertion>${INFO("A", "D")}</text:insertion></text:changed-region></text:tracked-changes><text:p>x</text:p>`);
  assert.deepEqual(items(u, "tracked-change"), [
    { kind: "tracked-change", change: "insertion", author: "A", date: "D", source: null, text: null, why: "change_region_unmarked_in_body" }]);
  // an insertion marked with a start and no end: located, its text null (absent, never "")
  const h = await S(`<text:tracked-changes><text:changed-region text:id="i8"><text:insertion>${INFO("A", "D")}</text:insertion></text:changed-region></text:tracked-changes><text:p>x<text:change-start text:change-id="i8"/>y</text:p>`);
  assert.deepEqual(items(h, "tracked-change")[0].text, null);
  assert.deepEqual(items(h, "tracked-change")[0].source, docParaRef(0));
  // the deleted region's own paragraphs and table are in no count, no text and no numbering
  const t = await T(RICH);
  assert.equal(t.paragraphs.length, 9);
  for (const gone of ["gone one", "gone two", "gone cell", "never marked"]) {
    assert.ok(!t.document.includes(gone), gone);
    assert.ok(t.paragraphs.every((p) => !p.text.includes(gone)), gone);
  }
  assert.deepEqual(t.tables.map((x) => x.table), [0]);
});

/* ------------------------------------------------------------------ R9 */

test("R9 comments: one item per <office:annotation>, located to its paragraph, its text kept out of the host paragraph", async () => {
  const s = await S(RICH);
  assert.deepEqual(items(s, "comment"), [
    { kind: "comment", id: "c1", author: "Commenter", date: "2026-04-05T06:07:08", initials: "CM", text: "note line one\nnote line two", source: docParaRef(1) },
    { kind: "comment", id: null, author: null, date: null, initials: null, text: "bare comment", source: docParaRef(8) },
  ]);
  const t = await T(RICH);
  assert.equal(t.paragraphs[1].text, "First para end");
  assert.equal(t.paragraphs[8].text, "host");
  for (const w of ["note line", "bare comment", "Commenter"]) assert.ok(!t.document.includes(w), w);
  // the evidentiary text of the tracked change beside it excludes it too
  assert.ok(items(s, "tracked-change").every((c) => !(c.text ?? c.superseded).includes("note")));
});

/* ------------------------------------------------------------------ R10 */

test("R10 over the guard, or with no readable body: paragraphs null, no body links or items, notes say which", async () => {
  const over = await odtEntry.structure(buildZip(withCd(members("odt", { body: RICH }), "content.xml", { usize: OVER_BOUND })));
  const noBody = await odtEntry.structure(pkg("odt", { content: "<office:document-content><office:body><office:spreadsheet/></office:body></office:document-content>" }));
  const bad = await odtEntry.structure(buildZip(withCd(members("odt", { body: RICH }), "content.xml", { crc: 7 })));
  for (const [s, re] of [[over, /size bound/], [noBody, /no <office:text>/], [bad, /unreadable/]]) {
    assert.equal(s.ok, true);
    assert.equal(s.paragraphs, null);
    assert.deepEqual(s.links, []);
    assert.deepEqual(s.evidentiary.items, []);
    assert.ok(s.notes.some((n) => re.test(n)), JSON.stringify(s.notes));
  }
});

/* ------------------------------------------------------------------ R11 */

test("R11 text(): every body paragraph as {para, ref, text} in order; document is the non-empty ones newline-joined", async () => {
  const t = await T(RICH);
  assert.deepEqual(t.paragraphs, [
    "Title", "First para end", "Before inserted words after", "item x", "", "c1", "c2",
    "Spaces   and\ttab\nbreak & <ent> A", "host",
  ].map((text, para) => ({ para, ref: `¶${para + 1}`, text })));
  assert.equal(t.document, t.paragraphs.map((p) => p.text).filter(Boolean).join("\n"));
  assert.deepEqual({ ...t.counts, scanned_bytes: undefined }, { chars: t.document.length, undetermined: 0, scanned_bytes: undefined });
  assert.deepEqual(t.undetermined, []);
  // R51 (fix round 9): a character reference naming no character makes the part unreadable, stated and final, never a failed read;
  // an entity name that is no character reference (`&bogus;`) is kept as written
  const odd = await T("<text:p>a &#99999999; b &#x110000; c &bogus; d &#65;</text:p>");
  assert.equal(odd.ok, true);
  assert.equal(odd.document, null);
  assert.deepEqual(odd.undetermined, [{ reason: "main_part_unreadable", part: "content.xml", why: "char_ref_invalid", final: true }]);
  const named = await T("<text:p>c &bogus; d &#65;</text:p>");
  assert.equal(named.paragraphs[0].text, "c &bogus; d A");
  const empty = await T("");
  assert.deepEqual([empty.paragraphs, empty.document], [[], ""]);
});

/* ------------------------------------------------------------------ R12 */

test("R12 tables: one per <table:table> as it opens, nested included, rows and cols accumulated through repeats, addressed by docTableRef", async () => {
  const body = `<table:table table:name="A">
      <table:table-column table:number-columns-repeated="3"/><table:table-column/>
      <table:table-row table:number-rows-repeated="2"><table:table-cell><text:p>x</text:p>
        <table:table table:name="A.inner"><table:table-column/><table:table-row><table:table-cell/></table:table-row></table:table>
      </table:table-cell></table:table-row>
      <table:table-header-rows><table:table-row><table:table-cell/></table:table-row></table:table-header-rows>
    </table:table>
    <text:p>between</text:p>
    <table:table table:name="NoColumns"><table:table-row><table:table-cell/></table:table-row></table:table>`;
  const t = await T(body);
  assert.deepEqual(t.tables, [
    { table: 0, ref: docTableRef(0).ref, rows: 3, cols: 4 },
    { table: 1, ref: docTableRef(1).ref, rows: 1, cols: 1 },
    { table: 2, ref: docTableRef(2).ref, rows: 1, cols: null },
  ]);
  assert.deepEqual((await T("<text:p>no tables</text:p>")).tables, []);
  // a deleted table is never counted, and the one after it keeps number 0
  const del = await T(`<text:tracked-changes><text:changed-region text:id="d"><text:deletion>${INFO("a", "b")}${DELETED_TABLE}</text:deletion></text:changed-region></text:tracked-changes>` + body);
  assert.deepEqual(del.tables.map((x) => [x.table, x.ref]), [[0, "table 1"], [1, "table 2"], [2, "table 3"]]);
  // not read: null, never []
  const over = await odtEntry.text(buildZip(withCd(members("odt", { body }), "content.xml", { usize: OVER_BOUND })));
  assert.equal(over.tables, null);
  const noBody = await odtEntry.text(pkg("odt", { content: "<office:document-content/>" }));
  assert.equal(noBody.tables, null);
});

/* ------------------------------------------------------------------ R13 */

test("R13 text() over the guard carries the guard marker verbatim; with no readable body, main_part_unreadable naming why", async () => {
  const over = await odtEntry.text(buildZip(withCd(members("odt", { body: RICH }), "content.xml", { usize: OVER_BOUND })));
  assert.deepEqual({ ...over, images: undefined, imagesWhy: undefined, counts: { ...over.counts, scanned_bytes: undefined } }, {
    ok: true, container: "odt", document: null, paragraphs: [], tables: null, parts: null,
    undetermined: [{ ...sizeGuard(OVER_BOUND), final: true }], counts: { chars: 0, undetermined: 1, scanned_bytes: undefined }, images: undefined, imagesWhy: undefined,
    active: [{ kind: "unread", part: "content.xml", why: "over_size_bound" }],
  });
  assert.deepEqual(over.undetermined[0], { ok: false, text: "undetermined", why: "over_size_bound", size: OVER_BOUND,
    bound: 20 * 1024 * 1024, boundName: "MEASURED_OOXML_TEXT_BOUND_BYTES", metric: "declared_uncompressed_text_part_bytes", final: true });
  for (const [bytes, why] of [
    [buildZip(withCd(members("odt"), "content.xml", { crc: 3 })), "crc_mismatch"],
    [pkg("odt", { content: "<office:document-content><office:body/></office:document-content>" }), "no_office_text_body"],
    [pkg("odt", { content: "not xml at all" }), "no_office_text_body"],
  ]) {
    const t = await odtEntry.text(bytes);
    assert.equal(t.ok, true);
    assert.equal(t.document, null);
    assert.deepEqual(t.paragraphs, []);
    assert.equal(t.tables, null);
    assert.deepEqual(t.undetermined, [{ reason: "main_part_unreadable", part: "content.xml", why }]);
    assert.deepEqual({ ...t.counts, scanned_bytes: undefined }, { chars: 0, undetermined: 1, scanned_bytes: undefined });
  }
});
