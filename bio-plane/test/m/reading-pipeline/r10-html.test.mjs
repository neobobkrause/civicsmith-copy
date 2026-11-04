/* reading-pipeline R51 (fix round 9, job 40; G131f, G131h; S-34 = X31): the visible text of an HTML page is made by one streaming pass, linear in
   the page's bytes, with the turn given back after a counted stretch of tokens (R-CLOCK: counts, never a time); a table keeps its rows and columns;
   a list or table of links in the page's content is kept; the pieces after the first read nothing from the store and parse nothing. R32's rules
   are unchanged: the captured pages give the very text the pass before R51 gave (`html-oracle.mjs`, MOVE). Each test names the ids it checks. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { read } from "../../../src/reading-pipeline/index.mjs";
import { visibleTextOfHtml, visibleTextOfHtmlYielding, HTML_STRETCH } from "../../../src/reader-contract/html.mjs";
import { visibleTextOfHtmlOld } from "./html-oracle.mjs";
import { bucket, evidenceStore, hold, doc } from "./fixture.mjs";

const FIXTURES = ["acgov-org-home.html", "justice-gov-home.html", "nps-gov-grca-index.htm", "nps-gov-yose-index.htm"];
const fixture = (f) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");
const tags = (h) => (h.match(/</g) || []).length;

test("R51 R32 (control): a captured page with no table or link list gives the very text the pass before R51 gave, byte for byte", () => {
  for (const f of FIXTURES) assert.equal(visibleTextOfHtml(fixture(f)), visibleTextOfHtmlOld(fixture(f)), f);
  const page = "<html><head><title>T</title><style>p{}</style></head><body><nav><a href='/x'>Menu</a></nav><main><h1>Notice 2026-118</h1><p>The board met &amp; voted.</p><div class=\"footer-note\"><p>A paragraph of prose stays here.</p></div></main><footer>Contact</footer></body></html>";
  assert.equal(visibleTextOfHtml(page), visibleTextOfHtmlOld(page));
});

test("R51 (G131f, DOCS H4): closed nested div to depth 2,000, 4,000 and 8,000, 16,000 unclosed p and 20,000 unbalanced div titles are walked in a count of tokens linear in the page, the stretch between yields bounded", async () => {
  const shapes = {
    "div 2000": "<div>".repeat(2000) + "deep text here" + "</div>".repeat(2000),
    "div 4000": "<div>".repeat(4000) + "deep text here" + "</div>".repeat(4000),
    "div 8000": "<div>".repeat(8000) + "deep text here" + "</div>".repeat(8000),
    "p 16000": "<p>word ".repeat(16000),
    "title 20000": '<div title="'.repeat(20000),
    "main named 3000": "<main>" + '<div class="footer">'.repeat(3000) + "x" + "</div>".repeat(3000) + "</main>",
  };
  for (const [name, html] of Object.entries(shapes)) {
    const stats = {};
    const text = await visibleTextOfHtmlYielding(html, { yieldNow: async () => {}, stats });
    assert.ok(stats.total <= 20 * tags(html) + 64, `${name}: ${stats.total} tokens walked of ${tags(html)} tags`);
    assert.ok(stats.longest <= HTML_STRETCH + 1, `${name}: the longest stretch ${stats.longest}`);
    if (name.startsWith("div")) assert.match(text, /deep text here/);
    if (name === "p 16000") assert.equal(text.split("word").length - 1, 16000);
  }
});

test("R51 (G131f, DOCS H4): the yielding pass gives the turn back every stretch, and its text is the sync pass's", async () => {
  const html = "<div><p>alpha</p>".repeat(60000) + "</div>".repeat(60000);
  let yields = 0;
  const stats = {};
  const text = await visibleTextOfHtmlYielding(html, { yieldNow: async () => { yields++; }, stats, stretch: 5000 });
  assert.ok(yields >= stats.total / 5000 - 2, `${yields} yields for ${stats.total} tokens`);
  assert.ok(stats.longest <= 5001, `longest ${stats.longest}`);
  assert.equal(text, visibleTextOfHtml(html));
});

test("R51 (G131f): a link list is kept: 4,000 unclosed li with a link keep every link's words; a bar of links is still furniture; links inside navigation go", () => {
  const list = visibleTextOfHtml("<ul>" + Array.from({ length: 4000 }, (_, i) => `<li><a href="/p/${i}">Item ${i}</a>`).join("") + "</ul>");
  assert.equal(list.split("Item ").length - 1, 4000);
  assert.ok(list.includes("Item 3999"));
  assert.ok(visibleTextOfHtml('<div><ul><li><a href="/a">Minutes</a></li></ul></div>').includes("Minutes"), "a list in a div");
  assert.ok(visibleTextOfHtml('<div><table><tr><td><a href="/a">Agenda</a></td></tr></table></div>').includes("Agenda"), "a table of links in a div");
  assert.ok(!visibleTextOfHtml('<p>Body words here.</p><div><a href="/a">Facebook</a> <a href="/b">Twitter</a></div>').includes("Facebook"), "a bar of links goes");
  assert.ok(!visibleTextOfHtml('<p>Body words here.</p><nav><ul><li><a href="/a">Menu entry</a></li></ul></nav>').includes("Menu entry"), "navigation goes");
});

test("R51 R35 R15 (G131f, SHEET D02): a 500 x 20 table keeps its rows and columns: a row is one paragraph, its cells in order told apart by a tab, an empty cell keeps its place", async () => {
  const rows = Array.from({ length: 500 }, (_, r) => `<tr>${Array.from({ length: 20 }, (_, c) => (r === 7 && c === 3 ? "<td></td>" : `<td>r${r}c${c}</td>`)).join("")}</tr>`);
  const html = `<html><body><p>Before.</p><table>${rows.join("")}</table><p>After.</p></body></html>`;
  const b = bucket();
  const d = await hold(b, html);
  const out = await read(doc({ digest: d, bytes: Buffer.byteLength(html), ct: "text/html", format: "html", fromText: true }), { evidence: evidenceStore(b), env: {}, storeName: "bio", unitsBudget: Infinity });
  const units = out.text_units.map((u) => u.text);
  assert.equal(units.length, 502, "Before., 500 rows, After.");
  assert.equal(units[1], Array.from({ length: 20 }, (_, c) => `r0c${c}`).join("\t"));
  assert.equal(units[8], Array.from({ length: 20 }, (_, c) => (c === 3 ? "" : `r7c${c}`)).join("\t"), "the empty cell keeps its column");
  assert.equal(units[500].split("\t").at(-1), "r499c19", "the last cell of the last row");
  assert.equal(out.reading.words_total, 2 + 500 * 20 - 1);
});

test("R51 R40 (G131h, DOCS H2): the pieces of a 6 MB page of 90,000 paragraphs read the store about once (bytes served at most twice the file), equal the whole read, and a restart between ticks changes neither", async () => {
  const body = Array.from({ length: 90000 }, (_, i) => `<p>Paragraph number ${i} of the minutes.</p>`).join("");
  const html = `<html><body><main>${body}<p>ENDMARKER here.</p></main></body></html>`;
  const size = Buffer.byteLength(html);
  assert.ok(size > 3_000_000 && size < 24 * 1024 * 1024);
  const b = bucket();
  const d = await hold(b, html);
  const document = doc({ digest: d, bytes: size, ct: "text/html", format: "html", fromText: true });
  const other = await hold(b, "<html><body><p>Another page entirely, of a few words.</p></body></html>");
  const otherDoc = doc({ digest: other, bytes: 80, ct: "text/html", format: "html", fromText: true });
  const whole = await read(document, { evidence: evidenceStore(b), env: {}, storeName: "bio", unitsBudget: Infinity });
  const wholeUnits = whole.text_units.map((u) => [u.extent.para, u.seq, u.text]);
  for (const restartAt of [null, 3]) {
    b.served = 0;
    let cursor = null, n = 0;
    const got = [];
    for (; n < 400; n++) {
      if (restartAt === n) await read(otherDoc, { evidence: evidenceStore(b), env: {}, storeName: "bio", cursor: null, unitsBudget: 1 << 20 });   /* another page replaces the held one */
      const out = await read(document, { evidence: evidenceStore(b), env: {}, storeName: "bio", cursor, unitsBudget: 512 * 1024, maxUnits: 4096 });
      for (const u of out.text_units || []) got.push([u.extent.para, u.seq, u.text]);
      if (!out.more) break;
      cursor = out.cursor;
    }
    assert.ok(n > 8, `${n + 1} pieces`);
    assert.deepEqual(got, wholeUnits, "the pieces are the whole's units, each once, in order");
    assert.ok(got.at(-1)[2].includes("ENDMARKER"), "the last line is read");
    const limit = restartAt === null ? 2 * size : 3 * size;
    assert.ok(b.served <= (restartAt === null ? 1.2 * size : limit), `${b.served} bytes served for a ${size} B page${restartAt === null ? "" : " (a restart re-reads once)"}`);
  }
});

/* R51 (fix round 10, cause 18b; walk C8): a block inside a table cell (a p, a div, a list item) does not end the row */
const unitsOfHtml = async (html) => {
  const b = bucket();
  const d = await hold(b, html);
  const out = await read(doc({ digest: d, bytes: Buffer.byteLength(html), ct: "text/html", format: "html", fromText: true }), { evidence: evidenceStore(b), env: {}, storeName: "bio", unitsBudget: Infinity });
  return (out.text_units || []).map((u) => u.text);
};

test("R51 (cause 18b; walk C8): a row whose cells hold a p each is one paragraph, the cells told apart by a tab", async () => {
  assert.deepEqual(await unitsOfHtml("<table><tr><td><p>a</p></td><td><p>b</p></td></tr></table>"), ["a\tb"]);
  assert.deepEqual(await unitsOfHtml("<table><tr><th><div>Name</div></th><th><div>Amount</div></th></tr><tr><td><div>Fire</div></td><td><div>12</div></td></tr></table>"), ["Name\tAmount", "Fire\t12"]);
  assert.deepEqual(await unitsOfHtml("<table><tr><td><ul><li>one</li><li>two</li></ul></td><td>three</td></tr></table>"), ["one two\tthree"]);
});

test("R51 (cause 18b): two blocks in one cell stay in that cell, their words apart; an empty cell keeps its place", async () => {
  assert.deepEqual(await unitsOfHtml("<table><tr><td><p>first</p><p>second</p></td><td><p>b</p></td></tr></table>"), ["first second\tb"]);
  assert.deepEqual(await unitsOfHtml("<table><tr><td><p>a</p></td><td><p></p></td><td><p>c</p></td></tr></table>"), ["a\t\tc"]);
});

test("R51 R35 (cause 18b; walk C8): a 500 x 20 table whose cells hold a p reads as 500 rows, each row one unit of its 20 cells", async () => {
  const rows = Array.from({ length: 500 }, (_, r) => `<tr>${Array.from({ length: 20 }, (_, c) => `<td><p>r${r}c${c}</p></td>`).join("")}</tr>`);
  const units = await unitsOfHtml(`<html><body><p>Before.</p><table>${rows.join("")}</table><p>After.</p></body></html>`);
  assert.equal(units.length, 502, "Before., 500 rows, After.");
  assert.equal(units[1], Array.from({ length: 20 }, (_, c) => `r0c${c}`).join("\t"));
  assert.equal(units[500].split("\t").at(-1), "r499c19");
});

test("R51 (cause 18b): controls: blocks outside a table still end their paragraph; a block after the table ends the row; a nested table's rows are rows", async () => {
  assert.deepEqual(await unitsOfHtml("<p>one</p><div>two</div>"), ["one", "two"]);
  assert.deepEqual(await unitsOfHtml("<table><tr><td>a</td><td>b</td></tr></table><p>after</p>"), ["a\tb", "after"]);
  assert.deepEqual((await unitsOfHtml("<table><tr><td>a</td><td><table><tr><td>x</td></tr><tr><td>y</td></tr></table></td></tr></table>")).map((t) => t.trim()), ["a", "x", "y"], "a nested table's rows are rows of their own");
});
