/* One bounded pass over a document's text, for every stack recogniser (R20).
 *
 * A recogniser's `detect` used to run its own patterns over the whole text, several of
 * them of the shape `<tag[^>]*...`, which re-scan to the end of the text from every
 * opening they meet: 240 KB of `<div` with no `>` took 18 s. This module reads the text
 * with a hand-written tag walker whose position only moves forward, and once more with
 * one pattern that holds every literal marker, so each character is examined a constant
 * number of times whatever its shape: the walk (once), the markers (once), each tag's own
 * test (once, by its name), and at most one failed search for a closing quote.
 *
 * The facts are collected once per `ctx` (a WeakMap keyed by the ctx object), so the four
 * recognisers of one `identify` share them; the characters examined are added to
 * `ctx.work.chars` when `ctx.work` is an object, once, where the facts are computed. The
 * count is at most 4 times the text. Nothing here copies the text: a tag is a view
 * (`slice`) of the text and no longer than it.
 */

/** @import { StackContext } from "./region.mjs" */

/**
 * What one pass over a text found, for the four stack recognisers.
 * @typedef {Object} Facts
 * @property {number} chars the characters examined
 * @property {number} anchors `<a>` tags with an `href`
 * @property {number} paras `<p>` openings
 * @property {number} tags tags closed by their `>`
 * @property {boolean} htmlOrBody an `<html>` or `<body>` opens
 * @property {number} bodyStart where `<body` opens, or -1
 * @property {number} bodyEnd just after `</body>`, or -1
 * @property {boolean} mount an empty mount point
 * @property {boolean} viewstate
 * @property {boolean} eventvalidation
 * @property {string | null} generator a WordPress generator's content
 * @property {boolean} ogArticle
 * @property {boolean} ogWebsite
 * @property {Set<string>} marks the literal markers found, by key
 * @property {number} length the text's length
 * @property {number} bodyLen the body's length, or the text's when the body is not closed
 */

const MOUNT_ID = /\bid="(?:root|app|__next|ember-basic-dropdown-wormhole)"/i;
const SPACE = /\s/;
const INPUT_NAME = /\bname="(__VIEWSTATE|__EVENTVALIDATION)"/gi;
const META_KEY = /\b(?:name="generator"|property="og:type")/i;
const CONTENT = /\bcontent="([^"]*)"/i;
const HREF = /\bhref=/i;

/* The literal markers of all four recognisers in one alternation. The pattern ignores
   case; the table below confirms the case-sensitive ones on the matched text. */
const MARKERS = new RegExp([
  "\\/wp-content\\/", "\\/wp-includes\\/", "\\/wp-json\\/",
  "__NEXT_DATA__", "\\bng-version=", "\\bdata-reactroot\\b", "\\/reporting-classic-app\\/",
  "window\\.__(?:NUXT|INITIAL_STATE|PRELOADED_STATE)__",
  "\\bid=\"aspnetForm\"", "\\bid=\"wp-block-", "\\bclass=\"[^\"]*wp-block-",
].join("|"), "gi");
/** @type {Array<[RegExp, string]>} */
const MARKER_KEYS = [
  [/^\/wp-content\//i, "wp_content"], [/^\/wp-includes\//i, "wp_includes"],
  [/^\/wp-json\//i, "wp_json"], [/^__NEXT_DATA__$/, "next_data"],
  [/^ng-version=$/, "ng_version"], [/^data-reactroot$/, "react_root"],
  [/^\/reporting-classic-app\/$/, "opengov"],
  [/^window\.__(?:NUXT|INITIAL_STATE|PRELOADED_STATE)__$/, "hydration"],
  [/^id="aspnetForm"$/i, "aspnet_form"], [/^id="wp-block-/i, "wp_block"],
  [/^class="[^"]*wp-block-$/i, "wp_block"],
];

/** A tag name is `base` when the name ends there as `\b` would end it: `p` and `p-x`, not `pre`.
   @param {string} name @param {string} base @returns {boolean} */
const isTag = (name, base) => name.length >= base.length && name.startsWith(base)
  && !/[a-z0-9_]/.test(name.slice(base.length, base.length + 1));

/** An ASCII letter, and a character of a tag's name after its first: `[a-z]` and
   `[a-z0-9:-]` as a pattern that ignores case reads them.
   @param {number} c @returns {boolean} */
const isLetter = (c) => (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
/** @param {number} c @returns {boolean} */
const isNameChar = (c) => isLetter(c) || (c >= 48 && c <= 57) || c === 58 || c === 45;

/** The tag opening at `start` (a `<`): whether it closes (`</`) and its name, or null where
   no letter follows, as `<(\/?)([a-z][a-z0-9:-]*)` reads it there.
   @param {string} text @param {number} start
   @returns {{ closing: boolean, name: string } | null} */
function nameAt(text, start) {
  let k = start + 1;
  const closing = text.charCodeAt(k) === 47;
  if (closing) k++;
  if (!isLetter(text.charCodeAt(k))) return null;
  const from = k;
  while (k < text.length && isNameChar(text.charCodeAt(k))) k++;
  return { closing, name: text.slice(from, k) };
}

/** The first of `<`, `>`, `"` and `'` at or after `from`, or -1.
   @param {string} text @param {number} from @returns {number} */
function stopAt(text, from) {
  for (let k = from; k < text.length; k++) {
    const c = text.charCodeAt(k);
    if (c === 60 || c === 62 || c === 34 || c === 39) return k;
  }
  return -1;
}

/** The length of white space then `</div>` (in any case) at `from`, or -1, as `\s*<\/div>`
   reads it there.
   @param {string} text @param {number} from @returns {number} */
function mountCloseAt(text, from) {
  let k = from;
  while (k < text.length && SPACE.test(text.charAt(k))) k++;
  return text.slice(k, k + 6).toLowerCase() === "</div>" ? k + 6 - from : -1;
}

/** @type {WeakMap<object, { text: string, facts: Facts }>} */
const memo = new WeakMap();

/** @param {string} text @returns {Facts} */
function scan(text) {
  const n = text.length;
  /** @type {Facts} */
  const f = {
    chars: 2 * n, anchors: 0, paras: 0, tags: 0, htmlOrBody: false, bodyStart: -1, bodyEnd: -1,
    mount: false, viewstate: false, eventvalidation: false, generator: null, ogArticle: false,
    ogWebsite: false, marks: new Set(), length: n, bodyLen: n,
  };

  /* Pass 1: the tags. `i` only moves forward. A candidate tag runs to its `>`; a quote
     straight after `=` is skipped whole, so a `>` or `<` inside an attribute value does
     not end the tag; an opening `<` outside a quote abandons the candidate there and the
     walk goes on from that `<`. A quote with no closing quote after it is the last of its
     kind in the text: quotes are then ordinary characters. */
  let quotes = true, i = 0;
  while ((i = text.indexOf("<", i)) !== -1) {
    const start = i;
    const nm = nameAt(text, start);
    let j = start + 1, end = -1;
    for (;;) {
      const at = stopAt(text, j);
      if (at === -1) { j = n; break; }
      const c = text.charAt(at);
      if (c === ">") { end = at; j = end + 1; break; }
      if (c === "<") { j = at; break; }
      let b = at - 1;
      while (b > start && text.charCodeAt(b) <= 32) b--;
      if (!quotes || text[b] !== "=") { j = at + 1; continue; }
      const q = text.indexOf(c, at + 1);
      if (q === -1) { quotes = false; f.chars += n - at; j = at + 1; continue; }
      j = q + 1;
    }
    i = j;
    const closed = end !== -1;
    if (!nm) { if (closed && text[start + 1] === "!") f.tags++; continue; }
    const closing = nm.closing, name = nm.name.toLowerCase();
    if (closing) {
      if (closed) f.tags++;
      if (closed && isTag(name, "body")) f.bodyEnd = end + 1;
      continue;
    }
    if (isTag(name, "p")) f.paras++;
    if (isTag(name, "html") || isTag(name, "body")) f.htmlOrBody = true;
    if (isTag(name, "body") && f.bodyStart === -1) f.bodyStart = start;
    if (!closed) continue;
    f.tags++;
    const tag = text.slice(start, end + 1);
    f.chars += tag.length;
    if (isTag(name, "a")) { if (HREF.test(tag)) f.anchors++; }
    else if (isTag(name, "div")) {
      if (!f.mount && MOUNT_ID.test(tag)) {
        const c = mountCloseAt(text, end + 1);
        if (c !== -1) { f.mount = true; f.chars += c; }
      }
    } else if (name === "input") {
      for (const t of tag.matchAll(INPUT_NAME)) {
        if ((t[1] ?? "").toUpperCase() === "__VIEWSTATE") f.viewstate = true; else f.eventvalidation = true;
      }
    } else if (name === "meta" && (f.generator === null || !(f.ogArticle || f.ogWebsite))) {
      /* One test of the tag for either key, and one read of its content when it hits. */
      const hit = META_KEY.exec(tag);
      if (hit) {
        const c = CONTENT.exec(tag);
        const content = c ? c[1] ?? "" : "";
        if (c && /^name=/i.test(hit[0]) && content.includes("WordPress")) f.generator ??= content;
        else if (c && /^property=/i.test(hit[0])) {
          if (content.toLowerCase() === "article") f.ogArticle = true;
          if (content.toLowerCase() === "website") f.ogWebsite = true;
        }
      }
    }
  }

  /* Pass 2: every literal marker, in one pattern. */
  for (const m of text.matchAll(MARKERS)) {
    const hit = MARKER_KEYS.find(([re]) => re.test(m[0]));
    if (hit) f.marks.add(hit[1]);
  }
  return f;
}

const SINGLE = /\bclass="[^"]*\bsingle(?:-post)?\b/i;
/** @type {WeakMap<object, { text: string, value: boolean }>} */
const late = new WeakMap();

/** Whether any `class` attribute of `ctx.text` names a single post: asked only when the address and the
 *  page's own type did not decide (`wordpress.kind`), so it is a pass of its own, counted and kept.
 *  @param {StackContext} ctx
 *  @returns {boolean} */
export function hasSingleClass(ctx) {
  const given = ctx.text;
  const text = typeof given === "string" ? given : "";
  const hit = late.get(ctx);
  if (hit && hit.text === text) return hit.value;
  const value = SINGLE.test(text);
  const work = ctx.work;
  if (work && typeof work === "object") work.chars = (Number(work.chars) || 0) + text.length;
  late.set(ctx, { text, value });
  return value;
}

/** The facts about `ctx.text`, computed once per ctx and added to `ctx.work.chars`.
 *  @param {StackContext} ctx
 *  @returns {Facts} */
export function factsOf(ctx) {
  const given = ctx.text;
  const text = typeof given === "string" ? given : "";
  const hit = memo.get(ctx);
  if (hit && hit.text === text) return hit.facts;
  const facts = scan(text);
  facts.length = text.length;
  /* The body's length, as `<body ...</body>` measures it; the whole text when the body
     is not closed. */
  facts.bodyLen = facts.bodyStart !== -1 && facts.bodyEnd > facts.bodyStart
    ? facts.bodyEnd - facts.bodyStart : text.length;
  const work = ctx.work;
  if (work && typeof work === "object")
    work.chars = (Number(work.chars) || 0) + facts.chars;
  memo.set(ctx, { text, facts });
  return facts;
}
