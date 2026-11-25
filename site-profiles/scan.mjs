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

const MOUNT_ID = /\bid="(?:root|app|__next|ember-basic-dropdown-wormhole)"/i;
const MOUNT_CLOSE = /\s*<\/div>/iy;
const INPUT_NAME = /\bname="(__VIEWSTATE|__EVENTVALIDATION)"/gi;
const META_KEY = /\b(?:name="generator"|property="og:type")/gi;
const CONTENT = /\bcontent="([^"]*)"/i;
const HREF = /\bhref=/i;
const NAME = /<(\/?)([a-z][a-z0-9:-]*)/iy;
const STOP = /[<>"']/g;

/* The literal markers of all four recognisers in one alternation. The pattern ignores
   case; the table below confirms the case-sensitive ones on the matched text. */
const MARKERS = new RegExp([
  "\\/wp-content\\/", "\\/wp-includes\\/", "\\/wp-json\\/",
  "__NEXT_DATA__", "\\bng-version=", "\\bdata-reactroot\\b", "\\/reporting-classic-app\\/",
  "window\\.__(?:NUXT|INITIAL_STATE|PRELOADED_STATE)__",
  "\\bid=\"aspnetForm\"", "\\bid=\"wp-block-", "\\bclass=\"[^\"]*wp-block-",
].join("|"), "gi");
const MARKER_KEYS = [
  [/^\/wp-content\//i, "wp_content"], [/^\/wp-includes\//i, "wp_includes"],
  [/^\/wp-json\//i, "wp_json"], [/^__NEXT_DATA__$/, "next_data"],
  [/^ng-version=$/, "ng_version"], [/^data-reactroot$/, "react_root"],
  [/^\/reporting-classic-app\/$/, "opengov"],
  [/^window\.__(?:NUXT|INITIAL_STATE|PRELOADED_STATE)__$/, "hydration"],
  [/^id="aspnetForm"$/i, "aspnet_form"], [/^id="wp-block-/i, "wp_block"],
  [/^class="[^"]*wp-block-$/i, "wp_block"],
];

/* A tag name is `base` when the name ends there as `\b` would end it: `p` and `p-x`, not `pre`. */
const isTag = (name, base) => name.length >= base.length && name.startsWith(base)
  && !/[a-z0-9_]/.test(name.slice(base.length, base.length + 1));

const memo = new WeakMap();

function scan(text) {
  const n = text.length;
  const f = {
    chars: 2 * n, anchors: 0, paras: 0, tags: 0, htmlOrBody: false, bodyStart: -1, bodyEnd: -1,
    mount: false, viewstate: false, eventvalidation: false, generator: null, ogArticle: false,
    ogWebsite: false, marks: new Set(),
  };

  /* Pass 1: the tags. `i` only moves forward. A candidate tag runs to its `>`; a quote
     straight after `=` is skipped whole, so a `>` or `<` inside an attribute value does
     not end the tag; an opening `<` outside a quote abandons the candidate there and the
     walk goes on from that `<`. A quote with no closing quote after it is the last of its
     kind in the text: quotes are then ordinary characters. */
  let quotes = true, i = 0;
  while ((i = text.indexOf("<", i)) !== -1) {
    const start = i;
    NAME.lastIndex = start;
    const nm = NAME.exec(text);
    let j = start + 1, end = -1;
    for (;;) {
      STOP.lastIndex = j;
      const m = STOP.exec(text);
      if (!m) { j = n; break; }
      const c = m[0];
      if (c === ">") { end = m.index; j = end + 1; break; }
      if (c === "<") { j = m.index; break; }
      let b = m.index - 1;
      while (b > start && text.charCodeAt(b) <= 32) b--;
      if (!quotes || text[b] !== "=") { j = m.index + 1; continue; }
      const q = text.indexOf(c, m.index + 1);
      if (q === -1) { quotes = false; f.chars += n - m.index; j = m.index + 1; continue; }
      j = q + 1;
    }
    i = j;
    const closed = end !== -1;
    if (!nm) { if (closed && text[start + 1] === "!") f.tags++; continue; }
    const closing = nm[1] === "/", name = nm[2].toLowerCase();
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
        MOUNT_CLOSE.lastIndex = end + 1;
        const c = MOUNT_CLOSE.exec(text);
        if (c) { f.mount = true; f.chars += c[0].length; }
      }
    } else if (name === "input") {
      INPUT_NAME.lastIndex = 0;
      let t;
      while ((t = INPUT_NAME.exec(tag))) {
        if (t[1].toUpperCase() === "__VIEWSTATE") f.viewstate = true; else f.eventvalidation = true;
      }
    } else if (name === "meta" && (f.generator === null || !(f.ogArticle || f.ogWebsite))) {
      /* One test of the tag for either key, and one read of its content when it hits. */
      META_KEY.lastIndex = 0;
      const hit = META_KEY.exec(tag);
      if (hit) {
        const c = CONTENT.exec(tag);
        if (c && /^name=/i.test(hit[0]) && c[1].includes("WordPress")) f.generator ??= c[1];
        else if (c && /^property=/i.test(hit[0])) {
          if (c[1].toLowerCase() === "article") f.ogArticle = true;
          if (c[1].toLowerCase() === "website") f.ogWebsite = true;
        }
      }
    }
  }

  /* Pass 2: every literal marker, in one pattern. */
  MARKERS.lastIndex = 0;
  let m;
  while ((m = MARKERS.exec(text))) {
    const hit = MARKER_KEYS.find(([re]) => re.test(m[0]));
    if (hit) f.marks.add(hit[1]);
  }
  return f;
}

const SINGLE = /\bclass="[^"]*\bsingle(?:-post)?\b/i;
const late = new WeakMap();

/** Whether any `class` attribute of `ctx.text` names a single post: asked only when the address and the
 *  page's own type did not decide (`wordpress.kind`), so it is a pass of its own, counted and kept. */
export function hasSingleClass(ctx) {
  const text = typeof ctx.text === "string" ? ctx.text : "";
  const hit = late.get(ctx);
  if (hit && hit.text === text) return hit.value;
  const value = SINGLE.test(text);
  if (ctx.work && typeof ctx.work === "object") ctx.work.chars = (Number(ctx.work.chars) || 0) + text.length;
  late.set(ctx, { text, value });
  return value;
}

/** The facts about `ctx.text`, computed once per ctx and added to `ctx.work.chars`. */
export function factsOf(ctx) {
  const text = typeof ctx.text === "string" ? ctx.text : "";
  const hit = memo.get(ctx);
  if (hit && hit.text === text) return hit.facts;
  const facts = scan(text);
  facts.length = text.length;
  /* The body's length, as `<body ...</body>` measures it; the whole text when the body
     is not closed. */
  facts.bodyLen = facts.bodyStart !== -1 && facts.bodyEnd > facts.bodyStart
    ? facts.bodyEnd - facts.bodyStart : text.length;
  if (ctx.work && typeof ctx.work === "object")
    ctx.work.chars = (Number(ctx.work.chars) || 0) + facts.chars;
  memo.set(ctx, { text, facts });
  return facts;
}
