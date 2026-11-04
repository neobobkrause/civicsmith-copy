/* reading-pipeline R51 (fix round 10; READING-PIPELINE #40; K4630, K5211): an HTML page past a whole read, within the text bound, is read by the one streaming pass in byte windows
 * with a carry; its units equal the same page read whole. Here the pass itself: `visibleTextOfHtmlStream` over decoded windows of every size makes exactly the text
 * `visibleTextOfHtml` makes of the whole, for the captured pages and for every shape that straddles a window's end: a tag, an attribute with a quote, a comment, a CDATA section, a
 * declaration, a raw-text element, an entity, an unclosed head, an unclosed script, an unclosed tag at the end of the page, a stray `<`. The read at the door is in r51-large.test.mjs. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { visibleTextOfHtml, visibleTextOfHtmlStream } from "../../../src/reader-contract/html.mjs";

async function* windows(s, w) { for (let at = 0; at < s.length; at += w) yield s.slice(at, at + w); }
const streamed = (s, w) => visibleTextOfHtmlStream(windows(s, w));

const SHAPES = {
  plain: "<!doctype html><html><head><title>T</title></head><body><main><p>First paragraph, with words.</p><p>Second &amp; third &#233; paragraph.</p></main></body></html>",
  nav: "<html><body><nav><a href='/a'>Home</a><nav><a>Nested</a></nav></nav><div role=\"navigation\"><a>Menu</a></div><article><p>The article text is here.</p></article><footer>Contact</footer></body></html>",
  skipAndTokens: "<body><a href=\"#main\" class=skip>Skip to main content</a><p>{1} and {name} and ##LOC[OK]## then real words follow here.</p></body>",
  table: "<table><tr><td><p>a</p></td><td><p>b</p><p>c</p></td></tr><tr><td>d</td><td>e</td></tr></table><ul><li><a href=x>One link</a></li><li><a href=y>Two links</a></li></ul>",
  comment: "<p>before</p><!-- a comment with <b>tags</b> and -- dashes and > signs --><p>after</p><![CDATA[ cdata <p>text</p> ]]><p>end</p>",
  commentEdge: "<p>a</p><!--><p>b</p>--><p>c</p><!---><p>d</p><!-- --><p>e</p>",
  declaration: "<!DOCTYPE html><?xml version=\"1.0\"?><p>one</p><!ELEMENT x><p>two</p>",
  scripts: "<p>a</p><script>var s = '</div>'; if (a < b) {}</script><style>p { color: red }</style><template><p>hidden</p></template><p>b</p><SCRIPT  >x</SCRIPT  ><p>c</p>",
  scriptEndWhitespace: "<p>a</p><script>x</script    ><p>b</p><script>y</script\n><p>c</p>",
  unclosedScript: "<p>kept</p><script>var x = 1; <p>swallowed to the end</p>",
  unclosedComment: "<p>kept</p><!-- never closed <p>swallowed</p>",
  unclosedTag: "<p>kept</p><div class=\"a",
  unclosedQuote: "<p>kept</p><a href=\"x>text that is swallowed</a> and the rest",
  strayLt: "<p>a < b and c <d and 1<2 and <3 and < 4</p><p>x<</p><p><</p>",
  entities: "<p>&amp;&lt;&gt;&quot;&nbsp;&copy; &#38; &#x26; &#xD800; &#0; &bogus; &amp</p>",
  head: "<html><head><title>Title</title><meta charset=utf-8><style>b{}</style><script>var a;</script></head><body><p>body text</p></body></html>",
  headUnclosed: "<html><head><title>Title</title><meta charset=utf-8><p>body text after an unclosed head</p>",
  headUnclosedScript: "<html><head><title>T</title><script>var a = '<p>';</script><p>body</p>",
  headComment: "<html><head><!-- c --><title>T</title><!-- d --><p>body</p>",
  headCommentOpen: "<head><!-- never closed <p>text</p>",
  headLater: "<p>before</p><div>x</div><head><title>late</title></head><p>after</p>",
  headCandidateFails: "<p>a</p><head a=\"b <head><title>x</title></head><p>after</p>",
  headWordBoundary: "<p>a</p><header>h</header><headline>l</headline><head>real</head><p>b</p>",
  headAtEnd: "<p>a</p><head",
  headMixedCase: "<HEAD><TITLE>x</TITLE></HEAD><P>body</P>",
  furniture: "<body><header><a>Logo</a></header><div class=\"cookie-banner\">We use cookies</div><main><p>Main words for the reading.</p><div class=\"footer-note\"><p>A note that holds a sentence of prose here.</p></div><div class=\"share\"><a>Facebook</a></div></main></body>",
  deep: "<div>".repeat(300) + "deep words" + "</div>".repeat(300),
  unclosedP: "<p>one<p>two<p>three<ul><li><a href=x>l1<li><a href=y>l2</ul>",
  empty: "",
  onlyText: "just text with no tags at all",
  textEndsLt: "text then <",
  cdataEdge: "<p>a</p><![CDATA[]]><p>b</p><![CDATA[x]]]><p>c</p><![CDATA[",
};
for (const f of ["acgov-org-home.html", "justice-gov-home.html", "nps-gov-grca-index.htm", "nps-gov-yose-index.htm"])
  SHAPES[f] = readFileSync(new URL(`../reading-pipeline/fixtures/${f}`, import.meta.url), "utf8");

test("R51: the visible text of a page that arrives in windows of any size is the text of the page read whole: every shape that straddles a window's end, at every window size from one character", async () => {
  for (const [name, page] of Object.entries(SHAPES)) {
    const whole = visibleTextOfHtml(page);
    const sizes = page.length > 5000 ? [97, 1024, 4099, 65536, page.length + 10] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 13, 17, 31, 64, page.length + 1];
    for (const w of sizes) assert.equal(await streamed(page, w), whole, `${name}, windows of ${w}`);
  }
});

test("R51: every cut of a page into two windows, at every position, reads as the whole (the straddled token is the carry)", async () => {
  for (const name of ["plain", "nav", "comment", "commentEdge", "declaration", "scripts", "scriptEndWhitespace", "unclosedTag", "unclosedQuote", "strayLt", "entities", "head", "headUnclosed",
                      "headCandidateFails", "headWordBoundary", "headAtEnd", "headCommentOpen", "cdataEdge", "unclosedScript", "textEndsLt"]) {
    const page = SHAPES[name], whole = visibleTextOfHtml(page);
    for (let cut = 0; cut <= page.length; cut++) {
      async function* two() { yield page.slice(0, cut); yield page.slice(cut); }
      assert.equal(await visibleTextOfHtmlStream(two()), whole, `${name}, cut at ${cut}`);
    }
  }
});

test("R51: pseudo-random pages of markup read in windows as they read whole: 400 pages, windows from 1 to 40 characters", async () => {
  const bits = ["<p>", "</p>", "<div class=\"x\">", "</div>", "<a href=\"#a\">", "</a>", "<a href='/p'>", "Skip to main content", "words and more words.", "<!--", "-->", "<![CDATA[", "]]>",
    "<script>", "</script>", "<style>", "</style>", "<head>", "</head>", "<title>", "</title>", "<nav>", "</nav>", "<main>", "</main>", "<table>", "<tr>", "<td>", "</td>", "</tr>", "</table>",
    "<ul>", "<li>", "</li>", "</ul>", "&amp;", "&#233;", "{1}", "<", ">", "\"", "'", "<br/>", "<img src=x>", " ", "\n\n", "<header>", "</header>", "<footer>", "</footer>", "<div role=\"dialog\">", "<span id=share>"];
  let seed = 12345;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  for (let t = 0; t < 400; t++) {
    let page = "";
    for (let j = 0, len = 5 + rnd(60); j < len; j++) page += bits[rnd(bits.length)];
    const whole = visibleTextOfHtml(page);
    for (const w of [1, 2, 3, 5, 8, 13, 40]) assert.equal(await streamed(page, w), whole, `page ${t} (${JSON.stringify(page)}), windows of ${w}`);
  }
});
