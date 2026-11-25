/* Fix round 9 (T51; G140, G131g; K4835 (4)): the bounded detects (R20), the shell only when
 * CERTAIN (R2), the verdict never changing what is read (R21) and the one decode (R22).
 * Reached through `site-profiles/index.mjs`. Work is asserted as a count (`ctx.work.chars`),
 * never as a time (R-CLOCK).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as ooxml from "../../bio-plane/src/ooxml.mjs";
import {
  identify, handlers, digests, compare, profileRecord, CONFIDENCE, conservative, aspnetWebforms,
  wordpress, clientRendered,
} from "../index.mjs";
import { calendarHtml, wordpressArticle, shellHtml } from "./fixtures.mjs";

const enc = (s) => new TextEncoder().encode(s);
const sha256 = async (b) => createHash("sha256").update(b).digest("hex");
const STACKS = [clientRendered, aspnetWebforms, wordpress];
const paras = (n) => "<p>The harbor reopened today after the council voted.</p>".repeat(n);

/* ---------------------------------------------------------------- R2 */

test("R2 the kind shell and shell:true are given exactly to a client_rendered match at CERTAIN", () => {
  const certain = identify({ text: shellHtml() });
  assert.equal(certain.handler, clientRendered);
  assert.equal(certain.confidence, CONFIDENCE.CERTAIN);
  assert.equal(certain.kind, "shell");
  assert.equal(certain.shell, true);
  const server = `<html><body><script id="__NEXT_DATA__">{}</script>${paras(30)}</body></html>`;
  const mount = `<html><body><div id="root"></div><script>window.__INITIAL_STATE__={}</script>${paras(30)}</body></html>`;
  const lower = [
    ["POSSIBLE: one framework marker on a server-rendered page", server, CONFIDENCE.POSSIBLE],
    ["LIKELY: client-rendered markup plus 30 paragraphs of server text", mount, CONFIDENCE.LIKELY],
  ];
  for (const [what, text, confidence] of lower) {
    const id = identify({ text });
    assert.equal(id.handler, clientRendered, what);
    assert.equal(id.confidence, confidence, what);
    assert.ok(!("kind" in id), `${what}: no shell kind`);
    assert.ok(!("shell" in id), `${what}: no shell:true`);
    assert.equal(profileRecord(id, { now: "2026-03-20T12:00:00Z" }).document_kind, "unknown", what);
  }
  const ctxs = [{ text: shellHtml() }, { text: server }, { text: mount }, { text: calendarHtml([["1", "B", "3/3/2026"]]) },
    { text: wordpressArticle() }, { text: "plain" }, {}, { text: "<div id=\"app\"></div><p>x</p>", headers: { "x-powered-by": "ASP.NET" } }];
  for (const ctx of ctxs) {
    const id = identify(ctx);
    const isShell = id.handler === clientRendered && id.confidence === CONFIDENCE.CERTAIN;
    assert.equal(id.shell === true, isShell);
    assert.equal(id.kind === "shell", isShell);
  }
});

/* --------------------------------------------------------------- R20 */

const SHAPES = {
  "240 KB of <div with no closing": "<div".repeat(60000),
  "a run of <input": "<input ".repeat(40000),
  "a run of <meta": "<meta ".repeat(40000),
  "a run of <a href=": "<a href=".repeat(30000),
  "a run of <p": "<p".repeat(100000),
  "400 KB of a-a-a": "a-a-a".repeat(80000),
  "16,000 addresses on one line": Array.from({ length: 16000 }, (_, i) => `u${i}@x.org`).join(" "),
  "a long run of one marker": "/wp-content/".repeat(20000),
  "unclosed quotes": '<a x="'.repeat(40000),
  "one unclosed quote at the end": "<div id='".repeat(30000) + "'",
  "one tag holding a > in a value": '<input name="__VIEWSTATE" value="' + ">".repeat(200000) + '"/>',
  "a large ordinary page": "<html><body>" + "<p>hello <a href='/x'>x</a></p>\n".repeat(30000) + "</body></html>",
  "an empty text": "",
};

test("R20 each stack detect adds at most 4 times its window to ctx.work.chars, whatever the shape of the text", () => {
  for (const [what, text] of Object.entries(SHAPES)) {
    for (const h of STACKS) {
      const work = { chars: 0 };
      const d = h.detect({ text, work });
      assert.ok(work.chars <= 4 * text.length, `${h.key} on ${what}: ${work.chars} of ${text.length}`);
      /* K4920: the count is the work done, not a ceiling met by counting nothing: a detect that reads the text counts it at least once */
      if (text.length) assert.ok(work.chars >= text.length, `${h.key} on ${what} counted ${work.chars} of ${text.length}: the reading is not metered`);
      assert.ok(["certain", "likely", "possible", "none"].includes(d.confidence));
    }
    // the four recognisers of one identify share one reading of the text
    const work = { chars: 0 };
    identify({ text, work });
    assert.ok(work.chars <= 4 * text.length, `identify on ${what}: ${work.chars} of ${text.length}`);
    if (text.length) assert.ok(work.chars >= text.length, `identify on ${what} counted ${work.chars} of ${text.length}`);
  }
  // the count grows with the window and not faster: doubling the text at most doubles it (plus a constant)
  const count = (t) => { const w = { chars: 0 }; clientRendered.detect({ text: t, work: w }); return w.chars; };
  assert.ok(count("<div".repeat(120000)) <= 2 * count("<div".repeat(60000)) + 16);
  // a ctx with no work object is answered the same
  assert.equal(clientRendered.detect({ text: shellHtml() }).confidence, CONFIDENCE.CERTAIN);
});

test("R20 the bounded detects give the signals and confidence the patterns gave on ordinary pages", () => {
  const sig = (h, text, extra) => { const d = h.detect({ text, ...extra }); return [d.confidence, d.signals || []]; };
  const shell = sig(clientRendered, shellHtml());
  assert.equal(shell[0], "certain");
  assert.equal(shell[1].length, 3);
  assert.deepEqual(shell[1].slice(0, 2), ["an empty mount point", "a hydration payload"]);
  assert.deepEqual(sig(clientRendered, '<div id="app"></div><p>x</p>'), ["possible", ["an empty mount point"]]);
  assert.deepEqual(sig(clientRendered, '<div id="root"> \n </div> ng-version="1" data-reactroot').slice(0, 1), ["likely"]);
  assert.equal(clientRendered.detect({ text: '<div id="root">x</div>' }).match, false);
  assert.deepEqual(sig(clientRendered, "__next_data__ NG-VERSION= DATA-REACTROOT"), ["none", []]);
  const cal = sig(aspnetWebforms, calendarHtml([["1", "B", "3/3/2026"]]));
  assert.deepEqual(cal, ["certain", ["__VIEWSTATE field", "aspnetForm"]]);
  assert.deepEqual(sig(aspnetWebforms, '<input name="__EVENTVALIDATION" value="a>b"/>'), ["likely", ["__EVENTVALIDATION field"]]);
  assert.deepEqual(sig(aspnetWebforms, '<input value="a>b" name="__VIEWSTATE"/>'), ["certain", ["__VIEWSTATE field"]]);
  assert.deepEqual(sig(aspnetWebforms, '<input name="__VIEWSTATEGENERATOR" value="x"/>'), ["none", []]);
  assert.deepEqual(sig(aspnetWebforms, "x", { headers: { server: "Microsoft-IIS/10" } }), ["likely", ["server: Microsoft-IIS/10"]]);
  const wp = sig(wordpress, wordpressArticle());
  assert.deepEqual(wp, ["certain", ["wp-content asset paths", "generator: WordPress 6.5"]]);
  assert.deepEqual(sig(wordpress, '<link href="/wp-json/x">'), ["likely", ["wp-json API link"]]);
  assert.deepEqual(sig(wordpress, '<div class="a wp-block-group"></div>'), ["likely", ["block editor markup"]]);
  assert.deepEqual(sig(wordpress, '<meta name="generator" content="Hugo">'), ["none", []]);
  assert.deepEqual(sig(wordpress, '<meta name="description" content="x"><meta name="generator" content="WordPress 6">')[0], "certain");
  // kind still reads the page's own type and class
  assert.equal(wordpress.kind({ text: '<meta property="og:type" content="article">' }), "article");
  assert.equal(wordpress.kind({ text: '<meta property="og:type" content="article"><meta property="og:type" content="website">' }), "page");
  assert.equal(wordpress.kind({ text: '<body class="post single-post">' }), "article");
  assert.equal(wordpress.kind({ text: "<body>" }), "page");
  // a hand-built multi-line, quoted-attribute tag is walked past its inner > and <
  assert.equal(aspnetWebforms.detect({ text: '<input title="a>b<c"\n name="__VIEWSTATE" />' }).confidence, "certain");
});

/* --------------------------------------------------------------- R21 */

test("R21 identify's verdict, at any confidence, changes neither the text nor what a digest reads", async () => {
  const pages = [shellHtml(), `<html><body><script id="__NEXT_DATA__">{}</script>${paras(30)}</body></html>`,
    `<html><body><div id="root"></div><script>window.__INITIAL_STATE__={}</script>${paras(30)}</body></html>`];
  const seen = new Set();
  for (const text of pages) {
    const ctx = Object.freeze({ text, locator: "https://r.test/p", headers: Object.freeze({}) });
    const id = identify(ctx);
    seen.add(id.confidence);
    assert.equal(ctx.text, text);
    assert.deepEqual(Object.keys(id).filter((k) => !["handler", "confidence", "signals", "considered", "kind", "shell", "why"].includes(k)), []);
    // the digests read the whole text under the verdict's handler, whichever it was
    const d = await digests(enc(text), id.handler, { sha256 });
    assert.equal(d.rendition, await sha256(enc(text)));
    assert.equal(d.evidentiary, await sha256(enc(text)));
    assert.equal(d.textual, true);
    // a change in the text is compared whatever the verdict was: the verdict decides trust, not reading
    const cmp = await compare(enc(text), enc(text + " "), id.handler, { sha256, confidence: id.confidence });
    assert.equal(cmp.digests.after.evidentiary === cmp.digests.before.evidentiary, false);
  }
  assert.ok(seen.size >= 3, "the pages cover three confidences");
});

/* --------------------------------------------------------------- R22 */

test("R22 seam: ooxml's decodeText is merged and digests reads text through it", () => {
  assert.equal(typeof ooxml.decodeText, "function");
});

test("R22 the same page in UTF-8, UTF-8 with a BOM, windows-1252 and UTF-16 has the same rendition and evidentiary digest", async () => {
  const html = "<html><head><title>Café</title></head><body><p>Café résumé</p></body></html>";
  const w1252 = new Uint8Array([...html].map((c) => c.charCodeAt(0)));
  const u16 = (le) => { const b = new Uint8Array(2 + html.length * 2); b[le ? 0 : 1] = 0xff; b[le ? 1 : 0] = 0xfe;
    [...html].forEach((c, i) => { const v = c.charCodeAt(0); b[2 + 2 * i + (le ? 0 : 1)] = v & 255; b[2 + 2 * i + (le ? 1 : 0)] = v >> 8; }); return b; };
  const want = await sha256(enc(html));
  const cases = [
    ["utf-8", enc(html), {}],
    ["utf-8 with a BOM", new Uint8Array([0xef, 0xbb, 0xbf, ...enc(html)]), {}],
    ["windows-1252 by the content type", w1252, { content_type: "text/html; charset=windows-1252" }],
    ["windows-1252 by its meta", new Uint8Array([...enc("<meta charset=windows-1252>"), ...w1252]), null],
    ["utf-16le with a BOM", u16(true), {}],
    ["utf-16be with a BOM", u16(false), {}],
  ];
  for (const [what, bytes, ctx] of cases) {
    if (ctx === null) continue;
    const d = await digests(bytes, conservative, { sha256, ...ctx });
    assert.equal(d.textual, true, what);
    assert.equal(d.rendition, want, what);
    assert.equal(d.evidentiary, want, what);
    assert.equal(d.identity, await sha256(bytes), what);
    assert.equal(d.encoding.replaced, 0, what);
  }
  const meta = await digests(cases[3][1], conservative, { sha256 });
  assert.equal(meta.encoding.replaced, 0);
  assert.ok(meta.rendition !== await sha256(cases[3][1]));
});

test("R22 a page's machinery is normalised after decoding, in any encoding", async () => {
  const page = (state) => calendarHtml([["1", "B", "3/3/2026"]], { state });
  const u16 = (s) => { const b = new Uint8Array(2 + s.length * 2); b[0] = 0xff; b[1] = 0xfe;
    [...s].forEach((c, i) => { const v = c.charCodeAt(0); b[2 + 2 * i] = v & 255; b[3 + 2 * i] = v >> 8; }); return b; };
  const a = await digests(u16(page("one")), aspnetWebforms, { sha256 });
  const b = await digests(u16(page("two")), aspnetWebforms, { sha256 });
  assert.notEqual(a.identity, b.identity);
  assert.equal(a.rendition, b.rendition, "the page state is found and normalised in a UTF-16 page");
  assert.ok(a.applied.some((x) => x.rule === "webforms_page_state"));
});

test("R22 a declared encoding decodeText cannot decode makes the document not textual, stated, never decoded lossily", async () => {
  const bytes = enc("<html>abc</html>");
  for (const ctx of [{ charset: "x-no-such-encoding-9" }, { content_type: "text/html; charset=x-no-such-encoding-9" }]) {
    const d = await digests(bytes, conservative, { sha256, ...ctx });
    assert.equal(d.textual, false);
    assert.equal(d.rendition, d.identity);
    assert.equal(d.evidentiary, d.identity);
    assert.equal(d.undecodable.why, "ENCODING_UNSUPPORTED");
    assert.equal(typeof d.undecodable.name, "string");
    assert.equal(typeof d.why, "string");
  }
  const cmp = await compare(bytes, enc("<html>abd</html>"), conservative, { sha256, charset: "x-no-such-encoding-9", confidence: "none" });
  assert.equal(cmp.verdict, "changed", "byte for byte: any difference is reported");
});
