/* Capture fidelity for HTML sources: the subresources a page needs to look
 * like itself, and the DERIVED companion that lets them be shown.
 *
 * The doctrine constraint that shapes every line here is that the RAW bytes as
 * served are the evidence. They are hashed at receipt, graded B, and never
 * rewritten. That rules out the obvious implementation, which would be to
 * inline the stylesheets and images into the captured HTML: doing that would
 * make the thing on disk something the source never served, and the record
 * would no longer hold what was fetched.
 *
 * So the split is: every fetched thing, primary and subresource alike, is its
 * own content-addressed capture holding exactly the bytes the source sent. A
 * SEPARATE derived artifact, the render companion, is the primary HTML with
 * every subresource reference rewritten to an `about:capture#<sha256>`
 * placeholder and every executable path removed. It carries its own hash, says
 * in its own first line that it is derived, and resolves to nothing at all
 * outside a viewer that knows how to substitute verified bytes for the
 * placeholders. A companion that leaked to a browser unaided renders blank
 * rather than reaching the network, which is the failure direction to want.
 *
 * The stylesheets are the reason the manifest carries a `rewrite` list rather
 * than the companion being self-sufficient. A stylesheet's own `url()`
 * references need substituting too, but the stylesheet capture is RAW and may
 * not be touched, so the substitution has to happen at render time against
 * bytes the viewer has already verified. The manifest tells it what to swap.
 *
 * No DOM: this runs in a Worker. The parser is a tag scanner over the source
 * text with an attribute sub-scanner, which is why the bounds below are not
 * optional. An unbounded parser pointed at an attacker-chosen page is a way to
 * make an instance fetch whatever the attacker likes, as many times as they
 * like, so depth, fanout, and bytes are all capped and the caps are reported
 * when they bite.
 */

import { makeMeter } from "./cpu.mjs";
import { localize } from "./setup-words/index.mjs";

/** OUR policy ceiling: how many fetches this instance is willing to spend on a
 *  single document. This is a choice about appetite, and it exists because an
 *  adversary-chosen page can name ten thousand addresses.
 *
 *  It is NOT the platform's limit and must never be set from one. An earlier
 *  version of this file carried 45 with a comment reading "50 on this account",
 *  which is a hardcoded guess about somebody else's infrastructure dressed up
 *  as a constant: Cloudflare can change that number on either plan tomorrow,
 *  every instance runs on a different account, and a number baked in here would
 *  then be silently wrong everywhere at once.
 *
 *  The platform's limit is DISCOVERED, recorded, and acted on. See
 *  `platformCeiling` below and docs/development/CAPTURE-SCALING.md. */
export const SUBRESOURCE_CAP = 400;
/** Bytes for any one subresource. A stylesheet or an image, not a video. */
export const SUBRESOURCE_MAX = 8 * 1024 * 1024;
/** Bytes across all subresources of one capture. */
export const SUBRESOURCE_BUDGET = 64 * 1024 * 1024;

/* Depth: the primary HTML is depth 0. Everything it names directly is depth 1.
 * A stylesheet at depth 1 has its own url() and @import targets followed once,
 * to depth 2, and there the following stops. That is the "one level deep" the
 * spec asks for, and it is what makes an @import chain terminate rather than
 * walk. A depth-2 stylesheet is still CAPTURED, it is just not READ. */
export const CSS_MAX_DEPTH = 2;

/* Elements whose whole subtree leaves the render companion. Scripts are
 * captured (they are part of what the source served that day and the record
 * should hold them) and then never referenced, which is the asymmetry the spec
 * asks for. The frame-bearing elements go for a different reason: an <iframe>
 * or <object> in a rendered companion is a live network fetch wearing the
 * page's clothes, and there is no placeholder that makes it safe. */
const STRIPPED_ELEMENTS = ["script", "iframe", "object", "embed", "applet", "frame", "frameset", "noembed"];

/** Schemes that are not fetched, recorded by name so the refusal is legible. */
const REFUSED_SCHEMES = ["javascript:", "data:", "blob:", "about:", "mailto:", "tel:", "file:", "ftp:", "ws:", "wss:", "chrome:", "chrome-extension:", "view-source:"];

const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const LONE_SURROGATE_RE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** The placeholder a rewritten reference becomes. */
export const placeholderFor = (sha) => `about:capture#${sha}`;
/** What a reference becomes when its bytes are not in the record. */
export const PLACEHOLDER_MISSING = "about:capture#unavailable";

/* ------------------------------------------------------------------ *
 * Linear scanners (R15)
 *
 * The page is adversary-chosen, and a pattern that reads to the end of the text
 * from every `<`, `url(` or `/*` it meets is quadratic on a page that repeats
 * its opening and never closes it: 240 KB of `<div` held the object for 27
 * seconds. So each scan here reads a stretch once. When a start fails because
 * the text holds no closer, no later start can succeed, and the scan stops;
 * when it fails at a delimiter, the starts before that delimiter fail the same
 * way and are not tried. The matches are those of the patterns they replace.
 * ------------------------------------------------------------------ */

const isWsCode = (c) => c === 32 || (c >= 9 && c <= 13) || c === 160 || c === 0x1680 || (c >= 0x2000 && c <= 0x200a)
  || c === 0x2028 || c === 0x2029 || c === 0x202f || c === 0x205f || c === 0x3000 || c === 0xfeff;
const skipWs = (t, i) => { while (i < t.length && isWsCode(t.charCodeAt(i))) i++; return i; };
const isAlphaCode = (c) => (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
const isNameCode = (c) => isAlphaCode(c) || (c >= 48 && c <= 57) || c === 58 || c === 45;

/** `s` without every `open … close` span that has a closer; an opener with none
 *  after it is left, as is everything after it. */
function dropSpans(s, open, close) {
  let out = "", last = 0, i;
  while ((i = s.indexOf(open, last)) !== -1) {
    const e = s.indexOf(close, i + open.length);
    if (e === -1) break;
    out += s.slice(last, i);
    last = e + close.length;
  }
  return last ? out + s.slice(last) : s;
}

/** Each tag of `src` in order, `next(from)` giving the first at or after `from`
 *  as `{start, end, name, blob, selfClose}`: `<`, an optional `/`, a name, then
 *  attributes up to the first `>` that is not inside a quoted value, where a
 *  `/` just before that `>` is the self-closing mark. A `<` that opens no such
 *  tag is skipped. */
function tagScanner(src) {
  const n = src.length;
  let deadBefore = 0;           // a `<` before this fails: a failed walk from an earlier one passed it unquoted
  const deadAt = new Set();     // a quote opened (from outside a value) at these positions leads to no `>`
  const walk = (s, from) => {
    let i = from, firstQuote = -1;
    const chain = [];
    for (;;) {
      let j = i, c = 0;
      while (j < n && (c = src.charCodeAt(j)) !== 62 && c !== 34 && c !== 39) j++;
      if (j >= n) { fail(firstQuote, chain); return -1; }
      if (c === 62) return j;
      if (firstQuote < 0) firstQuote = j;
      if (deadAt.has(j)) { fail(firstQuote, chain); return -1; }
      chain.push(j);
      const close = src.indexOf(c === 34 ? '"' : "'", j + 1);
      if (close === -1) { fail(firstQuote, chain); return -1; }
      i = close + 1;
    }
  };
  const fail = (firstQuote, chain) => {
    for (const q of chain) deadAt.add(q);
    deadBefore = firstQuote < 0 ? n : firstQuote;
  };
  return {
    next(from) {
      let p = Math.max(from, deadBefore);
      for (;;) {
        p = src.indexOf("<", p);
        if (p === -1) return null;
        if (p < deadBefore) { p = deadBefore; continue; }
        let q = p + 1;
        if (src.charCodeAt(q) === 47) q++;
        if (!isAlphaCode(src.charCodeAt(q))) { p++; continue; }
        let r = q + 1;
        while (isNameCode(src.charCodeAt(r))) r++;
        const gt = walk(p, r);
        if (gt === -1) { p++; continue; }
        const selfClose = gt - 1 >= r && src.charCodeAt(gt - 1) === 47;
        return { start: p, end: gt + 1, name: src.slice(p + 1, r), blob: src.slice(r, selfClose ? gt - 1 : gt), selfClose: selfClose ? "/" : "" };
      }
    },
  };
}

/** `src` with each tag replaced by `fn(tag)` (the tag's own text, kept, if `fn` returns null). */
function mapTags(src, fn) {
  const tags = tagScanner(src);
  let out = "", last = 0;
  for (let t; (t = tags.next(last)); last = t.end) {
    const whole = src.slice(t.start, t.end);
    const r = fn(whole, t);
    out += src.slice(last, t.start) + (r === null ? whole : r);
  }
  return out + src.slice(last);
}

/** Each `<name …> … </name>` of `s`, the text between the `>` and the closer given to `fn(whole, attrs, body)`. */
function mapElements(s, name, fn) {
  const open = new RegExp(`<${name}\\b`, "gi"), close = new RegExp(`<\\/${name}\\s*>`, "gi");
  let out = "", last = 0;
  for (let m; (m = open.exec(s)); ) {
    const gt = s.indexOf(">", m.index + m[0].length);
    if (gt === -1) break;
    close.lastIndex = gt + 1;
    const c = close.exec(s);
    if (!c) break;
    const end = c.index + c[0].length;
    out += s.slice(last, m.index) + fn(s.slice(m.index, end), s.slice(m.index + m[0].length, gt), s.slice(gt + 1, c.index));
    last = open.lastIndex = end;
  }
  return out + s.slice(last);
}

/** `s` without each opening `<name …>` (to its first `>`) for which `keep(span)` is false. */
function dropOpenTags(s, name, drop = () => true) {
  const open = new RegExp(`<${name}\\b`, "gi");
  let out = "", last = 0;
  for (let m; (m = open.exec(s)); ) {
    const gt = s.indexOf(">", m.index + m[0].length);
    if (gt === -1) break;
    if (drop(s.slice(m.index, gt + 1))) { out += s.slice(last, m.index); last = gt + 1; }
    open.lastIndex = gt + 1;
  }
  return last ? out + s.slice(last) : s;
}

/** The body of a `url(` whose `(` ends just before `i`: `{end, g}` with `g` the
 *  three groups (double-quoted, single-quoted, bare), or `{skip}` with where to
 *  look next. */
function cssUrlBody(t, i) {
  i = skipWs(t, i);
  const c = t.charCodeAt(i);
  if (c === 34 || c === 39) {
    const e = t.indexOf(c === 34 ? '"' : "'", i + 1);
    if (e !== -1) {
      const k = skipWs(t, e + 1);
      if (t.charCodeAt(k) === 41) return { end: k + 1, g: c === 34 ? [t.slice(i + 1, e), undefined, undefined] : [undefined, t.slice(i + 1, e), undefined] };
    }
    return { skip: i };
  }
  let j = i;
  while (j < t.length) {
    const d = t.charCodeAt(j);
    if (d === 41 || d === 39 || d === 34 || isWsCode(d)) break;
    j++;
  }
  const k = skipWs(t, j);
  return t.charCodeAt(k) === 41 ? { end: k + 1, g: [undefined, undefined, t.slice(i, j)] } : { skip: j };
}

/** Every `url( … )` of `t`: `{index, end, g}`. */
function cssUrls(t) {
  const re = /url\(/gi, out = [];
  for (let m; (m = re.exec(t)); ) {
    const b = cssUrlBody(t, m.index + 4);
    /* A `url(` ending inside the run that failed fails alike; one ending at its delimiter may not. */
    if (b.end === undefined) { re.lastIndex = Math.max(m.index + 1, b.skip - 4); continue; }
    out.push({ index: m.index, end: b.end, g: b.g });
    re.lastIndex = b.end;
  }
  return out;
}

/** Every `@import` of `t` with its target, `url( … )` or a quoted string: `{index, end, g}`, `g` the five groups. */
function cssImports(t) {
  const re = /@import\s+/gi, out = [];
  for (let m; (m = re.exec(t)); ) {
    const i = m.index + m[0].length, c = t.charCodeAt(i);
    let hit = null;
    if (t.slice(i, i + 4).toLowerCase() === "url(") {
      const b = cssUrlBody(t, i + 4);
      if (b.end !== undefined) hit = { end: b.end, g: [...b.g, undefined, undefined] };
    } else if (c === 34 || c === 39) {
      const e = t.indexOf(c === 34 ? '"' : "'", i + 1);
      if (e !== -1) hit = { end: e + 1, g: c === 34 ? [undefined, undefined, undefined, t.slice(i + 1, e), undefined] : [undefined, undefined, undefined, undefined, t.slice(i + 1, e)] };
    }
    if (!hit) continue;
    out.push({ index: m.index, end: hit.end, g: hit.g });
    re.lastIndex = hit.end;
  }
  return out;
}

/** `t` with each match of `found` (from `cssUrls` or `cssImports`) replaced by `fn(whole, ...groups)`. */
function replaceCss(t, found, fn) {
  let out = "", last = 0;
  for (const m of found) {
    out += t.slice(last, m.index) + fn(t.slice(m.index, m.end), ...m.g);
    last = m.end;
  }
  return out + t.slice(last);
}

function attrsOf(blob) {
  const out = [];
  ATTR_RE.lastIndex = 0;
  let m;
  while ((m = ATTR_RE.exec(blob))) {
    if (!m[0].trim()) { if (ATTR_RE.lastIndex <= m.index) ATTR_RE.lastIndex = m.index + 1; continue; }
    out.push({
      name: m[1].toLowerCase(),
      raw: m[0],
      value: m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : m[5] !== undefined ? m[5] : null,
      quote: m[3] !== undefined ? '"' : m[4] !== undefined ? "'" : "",
      present: m[2] !== undefined,
    });
  }
  return out;
}

const attr = (as, n) => { const a = as.find((x) => x.name === n); return a ? a.value : null; };

/** srcset candidates, by HTML's own algorithm rather than by splitting on
 *  commas.
 *
 *  Splitting on commas is the obvious implementation and it is wrong, because a
 *  URL is allowed to contain commas: `data:image/gif;base64,AAA,BBB 1x` is ONE
 *  candidate and comma-splitting turns it into three references to addresses
 *  that do not exist. HTML's rule is that the URL is the run up to the next
 *  whitespace, and only the DESCRIPTOR that follows is comma-terminated. A URL
 *  with trailing commas and no descriptor ends the candidate itself.
 *
 *  Getting this wrong is not cosmetic here: every invented reference is a fetch
 *  this instance makes at an address the page never named. */
export function srcsetUrls(v) {
  return srcsetCandidates(v).map((c) => c.url);
}

/** The same parse, keeping each candidate's descriptor beside its URL. Pairing
 *  them by splitting the attribute on commas a second time misaligned every
 *  descriptor after a URL that itself contains a comma. */
export function srcsetCandidates(v) {
  const out = [];
  const s = String(v);
  let i = 0;
  const isWs = (c) => c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\f";
  while (i < s.length) {
    while (i < s.length && (isWs(s[i]) || s[i] === ",")) i++;
    if (i >= s.length) break;
    const start = i;
    while (i < s.length && !isWs(s[i])) i++;
    let url = s.slice(start, i);
    if (url.endsWith(",")) {
      let e = url.length;
      while (e > 0 && url.charCodeAt(e - 1) === 44) e--;
      out.push({ url: url.slice(0, e), descriptor: "" });
      continue;
    }
    /* Descriptors run to the next comma that is not inside parentheses. */
    const dstart = i;
    let depth = 0, dend = s.length;
    while (i < s.length) {
      if (s[i] === "(") depth++;
      else if (s[i] === ")" && depth) depth--;
      else if (s[i] === "," && !depth) { dend = i; i++; break; }
      i++;
    }
    out.push({ url, descriptor: s.slice(dstart, Math.min(dend, i)).replace(/,$/, "").trim() });
  }
  return out.filter((c) => c.url);
}

/* A commented-out rule was not served to the renderer as a rule, so its url()
   is not a request the browser would make. */

/** A stylesheet's own references, each `{url, kind}`: an @import target is a
 *  stylesheet (it ranks, and is read, as one); a url() is a css-asset. */
function cssRefList(css) {
  const out = [];
  const text = dropSpans(String(css), "/*", "*/");
  const imports = cssImports(text);
  for (const m of imports) {
    const u = m.g[0] ?? m.g[1] ?? m.g[2] ?? m.g[3] ?? m.g[4] ?? "";
    if (u.trim()) out.push({ url: u.trim(), kind: "stylesheet" });
  }
  const rest = replaceCss(text, imports, () => "");
  for (const m of cssUrls(rest)) {
    const u = m.g[0] ?? m.g[1] ?? m.g[2] ?? "";
    if (u.trim()) out.push({ url: u.trim(), kind: "css-asset" });
  }
  return out;
}

/* Where in the page a reference was found. This is the mechanical half of the
 * document-boundary question: which elements TOGETHER make up the document, and
 * which sit outside it belonging to the site rather than to this document.
 *
 *   body      inside <article>/<main>, or in no furniture region at all
 *   furniture inside <nav>/<footer>/<header>/<aside>, or an ARIA landmark
 *             saying the same thing: the site's, not this document's
 *
 * Declared beats inferred, so an explicit role= is trusted over element name,
 * and the basis is recorded rather than only the conclusion. */
const FURNITURE_TAGS = new Set(["nav", "footer", "header", "aside"]);
const FURNITURE_ROLES = new Set(["navigation", "banner", "contentinfo", "complementary", "search"]);
const BODY_TAGS = new Set(["article", "main"]);
/* Elements with no end tag, which therefore never open a region. */
const VOID_ELEMENTS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

/** srcset families: one picture served at eight widths is ONE reference to the
 *  record, not eight. The largest candidate is kept, because a capture should
 *  hold the best rendition the source offered; the rest are recorded as seen
 *  and not fetched, so the page's own responsive set is still described and
 *  nothing is silently dropped.
 *
 *  A responsive family is also a WEAK SIGNAL AGAINST evidentiary value. A
 *  scanned document or a photograph entered as evidence is served at one size;
 *  a CMS generating eight widths is managing presentation. Recorded as a prior
 *  on the reference, never as a verdict about it. */
function pickSrcsetCandidate(cands) {
  const score = (descriptor) => {
    const d = /(?:^|\s)(\d+(?:\.\d+)?)[wx](?:\s|$)/i.exec(descriptor || "");
    return d ? Number(d[1]) : 1;
  };
  /* Array sort is stable, so equal scores keep discovery order. */
  const sorted = [...cands].sort((a, b) => score(b.descriptor) - score(a.descriptor));
  return { pick: sorted[0], rest: sorted.slice(1) };
}

/** The region stack both walkers share (R8), so a reference and a link found in
 *  the same place are classified by ONE rule. A stack, not a flag, and body WINS
 *  OVER furniture anywhere on it. <footer> inside <article> is the article's
 *  byline, not the site's footer: HTML scopes <footer> to its nearest sectioning
 *  ancestor, so once inside <article> or <main> everything is the document's.
 *  Erring toward inclusion is also the safe direction, since the cost of keeping
 *  a logo is bytes and the cost of dropping a figure is evidence.
 *  An entry opened by role= on a generic element (<div role="navigation">)
 *  closes on that element's own end tag, so same-name elements opened inside it
 *  are counted (`nest`) and the entry is not closed by the first </div>. */
function regionStack() {
  const region = [];
  return {
    here() {
      const body = region.find((r) => r.region === "body");
      if (body) return body;
      const furn = region[region.length - 1];
      return furn || { region: "body", basis: "default" };
    },
    close(tag) {
      for (let i = region.length - 1; i >= 0; i--)
        if (region[i].tag === tag) {
          if (region[i].nest > 0) region[i].nest--;
          else region.splice(i, 1);
          break;
        }
    },
    open(tag, as, selfClosing) {
      if (VOID_ELEMENTS.has(tag) || selfClosing) return;
      const role = (attr(as, "role") || "").toLowerCase().trim().split(/\s+/)[0];
      let entry = null;
      if (FURNITURE_ROLES.has(role)) entry = { tag, region: "furniture", basis: `role=${role}` };
      else if (role === "main" || role === "article") entry = { tag, region: "body", basis: `role=${role}` };
      else if (FURNITURE_TAGS.has(tag)) entry = { tag, region: "furniture", basis: `<${tag}>` };
      else if (BODY_TAGS.has(tag)) entry = { tag, region: "body", basis: `<${tag}>` };
      if (entry) region.push({ ...entry, nest: 0 });
      else for (let i = region.length - 1; i >= 0; i--)
        if (region[i].tag === tag) { region[i].nest++; break; }
    },
  };
}

/** Every reference an HTML document makes to something it needs in order to
 *  look like itself, in document order, each carrying what kind of thing it is
 *  and where in the source it was found. Comments are stripped first: a
 *  commented-out stylesheet was not served to the reader and fetching it would
 *  be inventing a request the browser never made. */
export function parseHtmlRefs(html) {
  return scanHtml(html).refs;
}

/** One walk over the page, giving its references (`refs`) and, for N79, the
 *  containment of its links (`linkChrome`): each <a>/<area> href, as written and
 *  trimmed, that sits in a FURNITURE region anywhere on the page, mapped to the
 *  basis of the first such region met (`<nav>`, `role=navigation`, ...). An href
 *  the site's navigation carried is contained even when the body links it too:
 *  that is the fact capture's R28 counts across pages. A classification, never a
 *  filter: the link is recorded either way. */
function scanHtml(html) {
  const src = dropSpans(String(html), "<!--", "-->");
  const refs = [];
  const linkChrome = new Map();
  const region = regionStack();
  const add = (ref, kind, where, extra) => {
    if (!ref || !ref.trim()) return;
    /* A bare #fragment names a part of this same document (an SVG <use>, a
       url(#gradient)), not a resource: resolving it would re-fetch the page. */
    if (ref.trim().startsWith("#")) return;
    const r = region.here();
    refs.push({ ref: ref.trim(), kind, where, region: r.region, region_basis: r.basis, ...(extra || {}) });
  };
  const addFamily = (cands, kind, where) => {
    const { pick, rest } = pickSrcsetCandidate(cands);
    const meta = { family: "srcset", family_size: cands.length, evidentiary_prior: "weak_against" };
    if (pick) add(pick.url, kind, where, meta);
    for (const r of rest) add(r.url, kind, where, { ...meta, collapsed: true });
  };
  /* The text of a raw-text element (<script>, <style>) is not markup: a tag
     inside a script's string literal is not a reference the page makes. */
  const skipTo = (tag, from) => {
    const re = new RegExp(`<\\/${tag}\\s*>`, "gi");
    re.lastIndex = from;
    const e = re.exec(src);
    return e ? { body: src.slice(from, e.index), end: e.index + e[0].length } : { body: src.slice(from), end: src.length };
  };

  const tags = tagScanner(src);
  let pos = 0;
  for (let m; (m = tags.next(pos)); ) {
    pos = m.end;
    const raw = m.name;
    const closing = raw.startsWith("/");
    const tag = (closing ? raw.slice(1) : raw).toLowerCase();
    if (closing) { region.close(tag); continue; }
    const as = attrsOf(m.blob);
    region.open(tag, as, m.selfClose === "/");
    if (tag === "a" || tag === "area") {
      const href = (attr(as, "href") || "").trim();
      const r = region.here();
      if (href && r.region === "furniture" && !linkChrome.has(href)) linkChrome.set(href, r.basis);
    }
    const inlineStyle = attr(as, "style");
    if (inlineStyle) for (const c of cssRefList(inlineStyle)) add(c.url, c.kind, `${tag}[style]`);

    if (tag === "style") {
      const { body, end } = skipTo("style", pos);
      for (const c of cssRefList(body)) add(c.url, c.kind, "style");
      pos = end;
      continue;
    }
    if (tag === "link") {
      const rel = (attr(as, "rel") || "").toLowerCase().split(/\s+/).filter(Boolean);
      const href = attr(as, "href");
      if (rel.includes("stylesheet")) add(href, "stylesheet", "link[rel=stylesheet]");
      else if (rel.some((r) => r === "icon" || r === "shortcut" || r === "apple-touch-icon" || r === "mask-icon" || r === "apple-touch-icon-precomposed"))
        add(href, "icon", `link[rel=${rel.join(" ")}]`);
      else if (rel.includes("preload")) {
        const as_ = (attr(as, "as") || "").toLowerCase();
        const iss = attr(as, "imagesrcset");
        if (as_ === "style") add(href, "stylesheet", "link[rel=preload][as=style]");
        else if (as_ === "image" && iss) {
          const cands = srcsetCandidates(iss);
          if (href && !cands.some((c) => c.url === href)) cands.push({ url: href, descriptor: "" });
          addFamily(cands, "image", "link[imagesrcset]");
        }
        else if (as_ === "image") add(href, "image", "link[rel=preload][as=image]");
        else if (as_ === "font") add(href, "font", "link[rel=preload][as=font]");
      }
      continue;
    }
    if (tag === "img" || tag === "input" || tag === "source" || tag === "video" || tag === "audio" || tag === "track" || tag === "image" || tag === "use") {
      if (tag === "input" && (attr(as, "type") || "").toLowerCase() !== "image") continue;
      /* <source src> is a video's or audio's rendition; <source srcset> is a
         <picture>'s. HTML allows each only in its own parent. */
      const kind = tag === "video" || tag === "audio" || tag === "track" || (tag === "source" && !attr(as, "srcset")) ? "media" : "image";
      const ss = attr(as, "srcset");
      /* src is a MEMBER of the family when srcset is present: it is the
         fallback rendition of the same picture, and treating it separately
         fetches the small one alongside the large one, which is the exact
         duplication collapsing exists to prevent. */
      if (ss) {
        const cands = srcsetCandidates(ss);
        const fb = attr(as, "src");
        if (fb && !cands.some((c) => c.url === fb)) cands.push({ url: fb, descriptor: "" });
        addFamily(cands, kind, `${tag}[srcset]`);
        const po = attr(as, "poster");
        if (po) add(po, "image", `${tag}[poster]`);
        continue;
      }
      for (const n of ["src", "poster", "href", "xlink:href"]) {
        const v = attr(as, n);
        if (v) add(v, n === "poster" ? "image" : kind, `${tag}[${n}]`);
      }
      continue;
    }
    if (tag === "script") {
      const s = attr(as, "src");
      /* Captured because it is part of what was served, never referenced by the
         companion. The kind is what makes the companion able to tell them
         apart without re-deciding the policy. */
      if (s) add(s, "script", "script[src]");
      pos = skipTo("script", pos).end;
      continue;
    }
  }

  return { refs, linkChrome };
}

/** Resolve a reference against the page's address and decide whether this
 *  instance will fetch it. The fence is the caller's isPublicHttpsLocator, the
 *  same one guarding the primary locator and the gathering queue, so a
 *  subresource can never reach an address the primary could not. */
export function classifyRef(ref, base, isPublic) {
  const lower = ref.toLowerCase();
  for (const s of REFUSED_SCHEMES) {
    if (lower.startsWith(s)) return { ok: false, reason: "REFUSED_SCHEME", scheme: s, url: ref };
  }
  let abs;
  try { abs = new URL(ref, base).toString(); }
  /* R36: the same bytes fail the same way on every call, so the record says it is final. */
  catch { return { ok: false, reason: "UNRESOLVABLE", final: true, url: ref }; }
  const clean = abs.split("#")[0];
  if (!isPublic(clean)) return { ok: false, reason: "REFUSED_LOCATOR", url: clean };
  return { ok: true, url: clean };
}

/* ------------------------------------------------------------------ *
 * The render companion
 * ------------------------------------------------------------------ */

const CSP = "default-src 'none'; img-src blob: about:; style-src blob: about: 'unsafe-inline'; "
          + "font-src blob: about:; media-src blob: about:; script-src 'none'; frame-src 'none'; "
          + "object-src 'none'; form-action 'none'; base-uri 'none'";

const BANNER = (primarySha, when) =>
  localize("subresources.subresources.derived_banner", "<!-- DERIVED ARTIFACT, not evidence. Generated by bio-plane from the capture\n     {primarySha}\n     at {when}. The raw bytes as served are the evidence and are stored\n     separately, unmodified. This file has had scripts and frames removed and\n     every subresource reference replaced with an about:capture#<sha256>\n     placeholder resolved from data/snapshot-manifest.json. Opened without a\n     resolving viewer it renders blank, on purpose. -->\n", { primarySha: String(primarySha), when: String(when) });

function stripElements(html) {
  let out = html;
  for (const el of STRIPPED_ELEMENTS) {
    out = mapElements(out, el, () => "");
    out = dropOpenTags(out, el);
    out = out.replace(new RegExp(`<\\/${el}\\s*>`, "gi"), "");
  }
  /* A <base href> would repoint every relative reference at the live site,
     which is the one thing a self-contained companion must not do. */
  out = dropOpenTags(out, "base");
  /* meta refresh is navigation by another name. Ours goes back in below. */
  out = dropOpenTags(out, "meta", (tag) => /http-equiv\s*=\s*["']?\s*refresh/i.test(tag));
  return out;
}

function rewriteCssText(css, resolve) {
  const one = (whole, u) => {
    const t = resolve(u);
    return t === null ? whole : whole.replace(/url\(\s*(?:"[^"]*"|'[^']*'|[^)'"\s]*)\s*\)/i, `url("${t}")`);
  };
  let out = replaceCss(css, cssUrls(css), (whole, a, b, c) => one(whole, (a ?? b ?? c ?? "").trim()));
  out = replaceCss(out, cssImports(out), (whole, a, b, c, d, e) => {
    const u = (a ?? b ?? c ?? d ?? e ?? "").trim();
    const t = resolve(u);
    return t === null ? whole : `@import url("${t}")`;
  });
  return out;
}

/** The companion. `resolve(ref, kind)` returns the placeholder a subresource
 *  reference becomes, or null to leave it alone. `classifyLink(ref)` returns
 *  `{type, wrapper, address}` for an <a> or <area> href: the address is kept as
 *  a data attribute so what the page pointed at is never lost, while the href
 *  itself becomes a wrapper that cannot navigate anywhere on its own. */
export function renderCompanion(html, { resolve, classifyLink, primarySha, when }) {
  let src = stripElements(String(html));

  src = mapElements(src, "style", (whole, attrsBlob, body) =>
    `<style${attrsBlob}>${rewriteCssText(body, (u) => resolve(u, "css-asset"))}</style>`);

  src = mapTags(src, (whole, { name, blob, selfClose }) => {
    const tag = name.toLowerCase();
    const as = attrsOf(blob);
    if (!as.length) return whole;
    const kept = [];
    for (const a of as) {
      /* Event handlers are executable and go, whatever else happens. */
      if (/^on[a-z]+$/.test(a.name)) continue;
      /* Subresource integrity over bytes the viewer will substitute would fail
         by construction; the record's own hash is the stronger check anyway. */
      if (a.name === "integrity" || a.name === "nonce") continue;
      if (!a.present || a.value === null) { kept.push(a.raw); continue; }

      const q = a.quote || '"';
      const put = (v) => kept.push(`${a.name}=${q}${v}${q}`);

      if (a.name === "style") { put(rewriteCssText(a.value, (u) => resolve(u, "css-asset"))); continue; }

      if (a.name === "srcset" || a.name === "imagesrcset") {
        /* Collapsing a responsive family leaves the other candidates without
           bytes. Leaving them in the srcset as dead placeholders is worse than
           useless: the browser picks by viewport and pixel density, so at 1x it
           would choose the candidate we deliberately did NOT capture and render
           nothing. So the survivors are the ones we hold, and if exactly one
           survives its descriptor goes too, making it unconditional. */
        const live = [];
        let anyDead = false;
        for (const cand of srcsetCandidates(a.value)) {
          const t = resolve(cand.url, "image");
          if (t === PLACEHOLDER_MISSING) { anyDead = true; continue; }
          live.push({ url: t === null ? cand.url : t, descriptor: cand.descriptor });
        }
        if (!live.length) { put(PLACEHOLDER_MISSING); continue; }
        put(live.length === 1 && anyDead ? live[0].url
          : live.map((c) => (c.descriptor ? `${c.url} ${c.descriptor}` : c.url)).join(", "));
        continue;
      }

      if (a.name === "href" || a.name === "src" || a.name === "poster" || a.name === "xlink:href" || a.name === "data") {
        if (tag === "a" || tag === "area") {
          const L = classifyLink(a.value);
          kept.push(`data-bio-link="${L.type}"`);
          if (L.address) kept.push(`data-bio-href="${L.address.replace(/"/g, "&quot;")}"`);
          put(L.wrapper);
          continue;
        }
        const t = resolve(a.value, tag === "script" ? "script" : "asset");
        put(t === null ? a.value : t);
        continue;
      }
      kept.push(a.raw);
    }
    return `<${name}${kept.length ? " " + kept.join(" ") : ""}${selfClose}>`;
  });

  const head = BANNER(primarySha, when) + `<meta http-equiv="Content-Security-Policy" content="${CSP}">\n`;
  /* After <head> when there is one, so the policy governs everything that
     follows it, and at the top otherwise. */
  const headAt = /<head\b/i.exec(src);
  const at = headAt && src.indexOf(">", headAt.index) !== -1 ? headAt.index : -1;
  if (at !== -1) {
    const end = src.indexOf(">", at) + 1;
    return src.slice(0, end) + "\n" + head + src.slice(end);
  }
  return head + src;
}

/* ------------------------------------------------------------------ *
 * What the document needs, and what merely surrounds it
 * ------------------------------------------------------------------ */

/** same_host / same_site / third_party, recorded on every reference and every
 *  link. Cheap, mechanical, and the first useful cut at advertising, analytics,
 *  and social widgets, which are overwhelmingly cross-origin.
 *
 *  same_site is approximate: with no public suffix list it compares the last
 *  two labels, so it is right for oaklandca.gov and wrong for a .co.uk. It is
 *  recorded AS an approximation, and the host is kept beside it, so a better
 *  rule can be applied later without the input having been destroyed. */
export function originOf(url, baseHost) {
  let h;
  try { h = new URL(url).hostname.toLowerCase(); } catch { return { origin: "unknown", host: null }; }
  const b = String(baseHost || "").toLowerCase();
  if (h === b) return { origin: "same_host", host: h };
  const tail = (x) => x.split(".").slice(-2).join(".");
  if (b && tail(h) === tail(b)) return { origin: "same_site", host: h, approximate: true };
  return { origin: "third_party", host: h };
}

/** Whether a reference is fetched, and why not when it is not.
 *
 *  The rule: support content is limited to what a faithful RENDITION of the
 *  document needs. That is not the same as everything the page requested.
 *
 *  Stylesheets and anything a stylesheet names are kept unconditionally, and
 *  this is the one place the region test is deliberately NOT applied. One
 *  stylesheet lays out the navigation and the article together, and deciding
 *  which rules serve which region needs a layout engine rather than a parser.
 *  Dropping a sprite for being "only" chrome collapses the article's layout with
 *  it. They are also cheap: on the pages measured, CSS assets are icons and
 *  backgrounds while the megabytes are content images.
 *
 *  Images are where the region test earns its place. An image inside the
 *  document is explanatory or evidentiary and is kept. An image in the site's
 *  navigation or footer is a logo or a social icon, and its absence costs
 *  nothing a reader of THIS DOCUMENT would notice.
 *
 *  Third-party scripts, images, and media go. That is the advertising and
 *  analytics cut, and it is the same test rather than a special case: an ad is
 *  by definition not part of the document. */
/* When the ceiling is 45 and the page wants 300, WHICH 45 decides whether the
 * capture renders as the page or as a pile of unstyled text. Measured on a
 * Legistar calendar: document order spent nine of the fifty on scripts that are
 * never rendered, and then ran out before the stylesheets' own sprites.
 *
 * So the work is taken in rendering-necessity order, not document order.
 * Stylesheets first because nothing else matters without them, then the assets
 * those stylesheets name, then the document's own images, and scripts last
 * because they are held as evidence and never rendered at all. Truncation then
 * costs the least important thing rather than an arbitrary one. */
export const FETCH_PRIORITY = { stylesheet: 0, "css-asset": 1, font: 1, icon: 2, image: 3, media: 4, script: 5 };
export const priorityOf = (ref) =>
  (FETCH_PRIORITY[ref.kind] ?? 3) * 2 + (ref.region === "furniture" ? 1 : 0);

/** The work list in fetch-priority order, lowest value first and, within one
 *  value, in the order the items were added. One list per value, so taking the
 *  next item does not read the whole list (a page naming sixty thousand
 *  references would otherwise make taking them quadratic). */
function makeQueue(items) {
  const lists = new Map();
  let size = 0;
  const push = (item) => {
    const p = priorityOf(item);
    let l = lists.get(p);
    if (!l) lists.set(p, l = { items: [], head: 0 });
    l.items.push(item);
    size++;
  };
  items.forEach(push);
  return {
    push,
    get length() { return size; },
    shift() {
      let best = null, at = Infinity;
      for (const [p, l] of lists) if (l.head < l.items.length && p < at) { at = p; best = l; }
      size--;
      const item = best.items[best.head];
      best.items[best.head++] = undefined;
      return item;
    },
  };
}

/** The form two references are compared in when deciding whether they name the
 *  same resource. Stored ALONGSIDE the raw address and never instead of it, so
 *  a rule that later proves wrong can be re-derived rather than having destroyed
 *  its input.
 *
 *  What it does: lowercases scheme and host, drops the default port, drops the
 *  fragment (which the server never sees), and sorts query parameters.
 *
 *  What it deliberately does NOT do: strip trailing slashes, since /a and /a/
 *  are genuinely different resources on plenty of servers; drop cache-busting
 *  parameters, since one server's v=3 is another's content selector; or touch
 *  case in the path, since paths are case-sensitive outside Windows. Each would
 *  be a guess, and a normalisation MISS looks exactly like "not captured",
 *  which is the failure hardest to notice.
 *
 *  Sorting query parameters is the one liberty taken, because Legistar's
 *  View.ashx?M=F&ID=..&GUID=.. is the shape most of this record's material
 *  arrives in and parameter order there carries no meaning. */
export function normalizeAddress(url) {
  let u;
  try { u = new URL(url); } catch { return String(url).trim(); }
  u.hash = "";
  u.protocol = u.protocol.toLowerCase();
  u.hostname = u.hostname.toLowerCase();
  if ((u.protocol === "https:" && u.port === "443") || (u.protocol === "http:" && u.port === "80")) u.port = "";
  /* The parameters are reordered as the source wrote them, never re-encoded:
     `a+b` and `a%20b` stay what they were, so sorting is the only change. */
  const q = u.search.slice(1);
  if (q) {
    const dec = (x) => { try { return decodeURIComponent(x.replace(/\+/g, " ")); } catch { return x; } };
    const parts = q.split("&").map((p) => {
      const i = p.indexOf("=");
      return { p, k: dec(i === -1 ? p : p.slice(0, i)), v: dec(i === -1 ? "" : p.slice(i + 1)) };
    });
    const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
    parts.sort((x, y) => cmp(x.k, y.k) || cmp(x.v, y.v));
    u.search = "?" + parts.map((x) => x.p).join("&");
  }
  return u.toString();
}

/** Kinds whose bytes may be reused from an earlier capture of the same host.
 *
 *  Furniture is reusable; evidence is not. A stylesheet is how the site looked
 *  and is shared by every document on it. An image INSIDE the document is what
 *  that document showed, and handing a reader a copy fetched last Tuesday while
 *  they believe they are looking at this capture is exactly the confusion the
 *  grading scheme exists to prevent.
 *
 *  Scripts are excluded for a reason easy to miss: a script is captured as
 *  evidence of WHAT WAS SERVED that day, never to be run. Reusing an older copy
 *  would put a false statement about the source into the record, the same class
 *  of error as reporting a platform limit as a source failure. */
/** The form a CITATION is compared in, which is not the form a RESOURCE is.
 *
 *  normalizeAddress above drops the fragment, and for its purpose that is
 *  right: the server never sees a fragment, so two references differing only
 *  after the # are one fetch and one stored object.
 *
 *  A citation is a different claim. Scientific and legal practice both cite
 *  ELEMENTS, not just documents: a section, a page, a table. BIO citations
 *  support element references, so the fragment is part of what was cited and
 *  dropping it silently discards the most specific thing the citation said.
 *  Two links into different sections of one report are two citations.
 *
 *  So both keys are kept on every link. The resource key resolves the link
 *  against what the store has captured; the citation key is the identity of the
 *  citation itself. Collapsing them, which the first cut did, made a link to
 *  #findings and a link to #methodology indistinguishable. */
export function normalizeCitation(url) {
  const raw = String(url || "").trim();
  const hash = raw.indexOf("#");
  if (hash === -1) return normalizeAddress(raw);
  const frag = raw.slice(hash + 1).trim();
  return normalizeAddress(raw.slice(0, hash)) + (frag ? "#" + frag : "");
}

/** The element a citation names, or null when it names the whole document. */
export function fragmentOf(url) {
  const raw = String(url || "").trim();
  const hash = raw.indexOf("#");
  if (hash === -1) return null;
  const frag = raw.slice(hash + 1).trim();
  return frag || null;
}

export const REUSABLE_KINDS = new Set(["stylesheet", "css-asset", "font", "icon"]);

/** Whether an earlier capture's bytes may stand in for a fetch now.
 *
 *  The first version of this gated on how long the asset had been STABLE, which
 *  was backwards and measured live as reusing nothing at all: a fresh instance
 *  has no stability history, so nothing could ever be reused until it had sat in
 *  the record for a week, and the ceiling hurts most in exactly that first week.
 *
 *  The load-bearing question is not "has this been stable for a long time" but
 *  "when did we last actually see the source serve these bytes". A stylesheet
 *  fetched and verified twenty minutes ago is a far better bet than one that was
 *  unchanged for three months and last looked at in April. Stability is a
 *  secondary confidence signal; RECENCY OF FETCH is the condition.
 *
 *  Three requirements, each doing work. The kind must be furniture rather than
 *  evidence. The bytes must have been seen served within the freshness window.
 *  And it must appear across more than one document, because an asset referenced
 *  by exactly one page is that page's own whatever directory it sits in — a
 *  document being a PAGE (its address), not a capture of it (CAP-13). */
export function reuseDecision(ref, known, { now, freshWindowMs = 24 * 3600 * 1000, minDocuments = 2 } = {}) {
  if (!known || !known.sha256) return { reuse: false, why: "not_seen_before" };
  if (!REUSABLE_KINDS.has(ref.kind)) return { reuse: false, why: "evidence_is_always_fetched" };
  /* CAP-13: `documents` counts distinct PAGES (document addresses), not primary
     captures, so one page re-captured with changed bytes stays one. A capture
     whose page the record does not name (`documents_undetermined`) is never
     counted toward the floor, and when only those could lift an asset over it
     the refusal says so by name instead of calling the asset unshared. */
  const pages = known.documents || 0;
  if (pages < minDocuments)
    return { reuse: false, why: pages + (known.documents_undetermined || 0) >= minDocuments
      ? "shared_across_documents_undetermined" : "not_yet_shared_across_documents" };
  const seen = Date.parse(known.last_fetched || "");
  if (!Number.isFinite(seen)) return { reuse: false, why: "no_fetch_record" };
  const age = now - seen;
  if (age > freshWindowMs) return { reuse: false, why: "last_seen_served_too_long_ago", age_ms: age };
  const stable = Date.parse(known.stable_since || "");
  return { reuse: true, fetched_age_ms: age,
           stable_for_ms: Number.isFinite(stable) ? now - stable : null,
           changes: known.changes || 0 };
}

/** D-191: the TEMPORAL SPREAD of a composite capture — the earliest and latest
 *  instants at which its parts were fetched (CAPTURE-SCALING.md §Checking that a
 *  reused asset is still the same; §Re-fetch at ratification is mandatory). A
 *  capture assembled partly from reused bytes is a page as the source served it
 *  across a SPAN of time, not at one instant, and the record says so.
 *
 *  The instants are on TWO CLOCKS and are never compared as one (the class of
 *  D-580):
 *  - `capture`: a part fetched during THIS capture carries `fetched_at`, stamped by
 *    the capturing Worker's own clock (`now`) as the request was issued.
 *  - `record`: a reused part carries `reused_from_fetched_at`, which is
 *    `site_assets.last_fetched` — stamped by the Store Durable Object when an
 *    EARLIER capture's observations were FILED, after that fetch completed. It is a
 *    different process's clock marking a different event, so it is not ordered
 *    against the capture clock: when both clocks hold parts the composite-wide
 *    earliest and latest are stated per clock and the cross-clock order is
 *    `two_clocks_not_compared`, never guessed.
 *  A part is a record the capture HOLDS bytes for (`ok`). A reused part whose
 *  instant is absent or unreadable is counted `undetermined`, never placed. The
 *  primary is not a part here: its retrieval is the document's own. */
export const SPREAD_CLOCKS = {
  capture: { instant: "fetched_at", clock: localize("subresources.subresources.the_capturing_worker_s_clock", "the capturing Worker's clock, stamped as this capture issued the request") },
  record: { instant: "reused_from_fetched_at", clock: "the Store's clock (site_assets.last_fetched), stamped when an earlier capture's fetch was filed" },
};
export function partFetchSpread(records) {
  const acc = { capture: [], record: [] };
  let undetermined = 0, parts = 0;
  for (const r of records || []) {
    if (!r || !r.ok) continue;
    parts++;
    const clock = r.fetched_this_capture === false ? "record" : "capture";
    const at = r[SPREAD_CLOCKS[clock].instant];
    const ms = typeof at === "string" ? Date.parse(at) : NaN;
    if (!Number.isFinite(ms)) { undetermined++; continue; }
    acc[clock].push([ms, at]);
  }
  const clocks = {};
  for (const k of Object.keys(acc)) {
    if (!acc[k].length) continue;
    const s = acc[k].sort((a, b) => a[0] - b[0]);
    clocks[k] = { ...SPREAD_CLOCKS[k], parts: s.length, earliest: s[0][1], latest: s[s.length - 1][1],
                  span_ms: s[s.length - 1][0] - s[0][0] };
  }
  const named = Object.keys(clocks);
  const one = named.length === 1 ? clocks[named[0]] : null;
  return {
    parts, undetermined, clocks,
    state: named.length === 0 ? "no_instants" : one ? "one_clock" : "two_clocks_not_compared",
    clock: one ? named[0] : null,
    earliest: one ? one.earliest : null,
    latest: one ? one.latest : null,
    note: localize("subresources.subresources.the_earliest_and_latest_instants", "the earliest and latest instants at which this composite's parts were fetched, per clock. `capture` instants were stamped by this capture; `record` instants are when an earlier capture's fetch of a reused part was filed, on the Store's clock. The two are never ordered against each other, so a composite holding both states each and leaves the composite-wide earliest and latest null. undetermined counts held parts whose instant the record does not give."),
  };
}

export function fetchPolicy(ref, origin) {
  if (ref.collapsed)
    return { fetch: false, reason: "COLLAPSED_SRCSET_FAMILY",
             detail: localize("subresources.subresources.one_of_family_size_responsive", "one of {family_size} responsive candidates for one picture; the largest is captured", { family_size: String(ref.family_size) }) };
  if (ref.kind === "stylesheet" || ref.kind === "css-asset" || ref.kind === "font" || ref.kind === "icon")
    return { fetch: true, why: "layout" };
  if (origin === "third_party" && (ref.kind === "script" || ref.kind === "image" || ref.kind === "media"))
    return { fetch: false, reason: "THIRD_PARTY",
             detail: localize("subresources.subresources.cross_origin_script_image_or_media", "cross-origin script, image, or media: advertising, analytics, and social widgets are not part of the document") };
  if (ref.kind === "script") return { fetch: true, why: "served_with_the_page" };
  if (ref.region === "furniture")
    return { fetch: false, reason: "OUTSIDE_THE_DOCUMENT",
             detail: localize("subresources.subresources.found_in_region_basis_which", "found in {region_basis}, which belongs to the site rather than to this document", { region_basis: String(ref.region_basis) }) };
  return { fetch: true, why: "in_the_document" };
}

/* ------------------------------------------------------------------ *
 * Links, and the three partitions
 * ------------------------------------------------------------------ */

/* A captured page's outbound links are not decoration. BIO's whole method is
 * making and following connections, and a connection someone ELSE made and
 * published is exactly the kind the record wants to hold. So a link is
 * characterised, not blanked and not left live.
 *
 * The partitions, in Bob's terms:
 *
 *   anchor   somewhere inside this very document (a #fragment). Decided here,
 *            permanently, and it needs no wrapper beyond staying itself.
 *   intra    another file in THIS record, whose bytes are captured alongside.
 *            Decided at capture and cannot change afterwards.
 *   linked   an address the store may hold a capture of, in some other record.
 *   offsite  an address the store holds nothing for.
 *   refused  executable or otherwise not an address this system will carry.
 *
 * The load-bearing observation is that `linked` and `offsite` ARE THE SAME
 * WRAPPER HERE. Which one a given address is depends on what the store holds,
 * and the store changes: page B is uncaptured on Tuesday and captured on
 * Friday, and every already-captured page that pointed at it moves partition
 * without any of their bytes changing. The companion is content-addressed and
 * immutable, so a companion that hardcoded `offsite` would be asserting a fact
 * with a shelf life inside an artifact that can never be corrected.
 *
 * So the companion emits ONE deferred wrapper carrying the address, and the
 * resolution to linked-or-offsite happens at read time against the store. What
 * the capture-time classification was is still worth keeping, because "the
 * record held nothing for this address on the day we captured the page" is a
 * fact about the record's coverage, so it goes in the manifest, dated, where it
 * can be superseded without rewriting anything.
 */
export const LINK_TYPES = ["anchor", "intra", "deferred", "refused"];

/** The wrapper each partition renders as. `deferred` is resolved by the viewer
 *  into linked-or-offsite; the other three are final at capture. */
export const linkWrapper = {
  anchor: (frag) => frag,
  intra: (sha) => `about:capture#${sha}`,
  /* R24: a lone surrogate would make encodeURIComponent throw; it is U+FFFD, as a URL makes it. */
  deferred: (url) => `about:link#${encodeURIComponent(String(url).replace(LONE_SURROGATE_RE, "\uFFFD"))}`,
  refused: () => "about:link#refused",
};

/** Read a wrapper back. The viewer needs this and so does anything auditing a
 *  companion, so it lives beside the writer rather than being re-derived. */
export function readLinkWrapper(v) {
  const s = String(v || "");
  if (s === "about:link#refused") return { type: "refused" };
  if (s.startsWith("about:link#")) {
    try { return { type: "deferred", url: decodeURIComponent(s.slice("about:link#".length)) }; }
    catch { return { type: "refused" }; }
  }
  if (s.startsWith("about:capture#")) return { type: "intra", sha256: s.slice("about:capture#".length) };
  if (s.startsWith("#")) return { type: "anchor", fragment: s };
  return null;
}



/** Fetch, hash, and store every subresource of one captured HTML page, then
 *  build the companion and the manifest.
 *
 *  Injected rather than imported, so this whole module is testable with no
 *  Worker and no network:
 *    fetchOne(url)     -> { ok, status, bytes: Uint8Array, contentType } | { ok:false, ... }
 *    put(sha, bytes)   -> { existed: boolean }
 *    sha256(bytes)     -> hex string
 *    isPublic(url)     -> boolean
 */
export async function captureSubresources({
  html, base, primarySha, primaryFile, fetchOne, put, sha256, isPublic,
  cap = SUBRESOURCE_CAP, perMax = SUBRESOURCE_MAX, budget = SUBRESOURCE_BUDGET, now = () => new Date(),
  /* What this runtime was last OBSERVED to allow, passed in by the caller from
     whatever it recorded last time, or null the first time anything runs here.
     Never a constant in this file: the number belongs to the platform, changes
     without notice, and differs per account, so the only honest source for it
     is having hit it. */
  platformCeiling = null, platformMargin = 5, subrequestsAlreadySpent = 1,
  /* What this host has served before. `siteLookup(addressNorm)` returns the
     stored record or null; absent, nothing is ever reused and behaviour is
     exactly what it was before reuse existed. */
  siteLookup = null, reuseFreshWindowMs = 24 * 3600 * 1000, reuseMinDocuments = 2,
  /* Reads a stored capture back as text, so a REUSED stylesheet can have its own
     url() targets followed just as a freshly fetched one does. Without it a
     reused stylesheet would render without its sprites. */
  readBack = null,
  /* Resuming a capture that ran out of budget. `resume` carries what an earlier
     tick accumulated and what it had left to do. Nothing is re-fetched and
     nothing is re-parsed: the queue is restored rather than rediscovered,
     because rediscovering it means reading every stylesheet back out of R2 to
     re-derive its url() targets, and on a Legistar page that is thirty storage
     reads spent to learn what one row already knew. */
  resume = null,
  /* Measured, not assumed. Every synchronous compute segment in here is timed so
     the record can say what a capture actually costs against whatever ceiling
     the runtime has. Network waits are never inside a segment. */
  meter = makeMeter(),
}) {
  /* The four callbacks have no default. Checked here, before anything else, so
     a missing one fails the same way whether or not this page happens to have
     a reference that would have called it. */
  for (const [name, fn] of [["fetchOne", fetchOne], ["put", put], ["sha256", sha256], ["isPublic", isPublic]])
    if (typeof fn !== "function") throw new TypeError(`captureSubresources: ${name} must be a function`);
  /* Why an asset the host has served before was fetched anyway. Recorded so a
     reuse rate that quietly falls to zero is visible rather than mysterious. */
  const noReuse = [];
  const rec_noreuse = (stem, dec) => noReuse.push({ url: stem.url, kind: stem.kind, why: dec.why });
  const stamp = () => now().toISOString().split(".")[0] + "Z";
  const records = [];            // every reference, in the order discovered
  const bySha = new Map();       // sha -> record, for the manifest
  const byUrl = new Map();       // absolute url -> record, for dedup
  const refToUrl = new Map();    // raw ref text -> absolute url or null
  let attempted = 0, discovered = 0, spent = 0, truncated = false, budgetHit = false, platformHit = false;
  /* Two different stopping conditions that must not be confused. `cap` is what
     we are willing to spend. `ceilingBudget` is what the runtime will let us
     spend, known only if a previous run hit it. */
  let observedCeiling = null, deferred = 0, reused = 0;
  /* Everything this run saw of this host, for the caller to file afterwards.
     Written out here rather than inside the loop so that a capture which fails
     partway still reports what it did learn. */
  const siteObservations = [];
  /* Declared HERE, beside the other accumulators, rather than down with the
     link classifier that fills it. It was declared there, and the resume block
     above restores into it, which put it in a temporal dead zone that only
     fired on a page that actually has <a> elements. A fixture without links
     never evaluated the loop body and the suite stayed green. */
  const links = [];
  /* What the next tick has to do. Built as the deferrals happen so it is
     correct even if this tick ends unexpectedly. */
  const outstanding = [];
  const ceilingBudget = platformCeiling == null ? Infinity
    : Math.max(0, platformCeiling - platformMargin - subrequestsAlreadySpent);

  /* A work list rather than recursion: depth is data, so the bound is visible
     and a cycle in an @import graph cannot become a stack. */
  /* Each item carries the address it is relative TO. This is not a detail: a
     stylesheet at /css/main.css writing `url(img/bg.png)` means /css/img/bg.png,
     and resolving it against the PAGE instead silently captures a different
     file, or nothing, while every count still looks right. */
  let baseHost = null;
  try { baseHost = new URL(base).hostname; } catch { baseHost = null; }
  let queue;
  /* N79: which link hrefs sat in furniture, from the same walk that finds the
     references. A resumed tick restores its queue rather than re-walking for it,
     but a link can change partition between ticks (deferred, then intra once its
     bytes are held), and that new entry needs its containment, so the walk is
     made again there for the links alone. */
  let linkChrome;
  if (resume) {
    /* cssOwner is a live reference into `records`, so it travels as an INDEX
       and is reattached here. Serialising the object itself would duplicate the
       record and the rewrite list would then be built on a copy nobody reads. */
    for (const r of resume.records || []) {
      records.push(r);
      if (r.url) byUrl.set(r.url, r);
      if (r.ok && r.sha256 && !bySha.has(r.sha256)) bySha.set(r.sha256, r);
    }
    for (const l of resume.links || []) links.push(l);
    linkChrome = meter.sync("link_containment", () => scanHtml(html).linkChrome, html.length);
    for (const [k, v] of Object.entries(resume.refToUrl || {})) refToUrl.set(k, v);
    for (const o of resume.siteObservations || []) siteObservations.push(o);
    discovered = resume.discovered || records.length;
    spent = resume.spent || 0;
    const queued = (resume.queue || []).map((q) => ({
      ...q, cssOwner: q.cssOwnerIdx == null ? undefined : records[q.cssOwnerIdx] }));
    queue = makeQueue(queued);
    /* A resumed item was DEFERRED last tick and is being tried again, so its
       earlier row goes: leaving it would double-count and would leave a
       "deferred" row beside the real outcome. */
    const retry = new Set(queued.map((q) => q.retryUrl).filter(Boolean));
    for (let i = records.length - 1; i >= 0; i--)
      if ((records[i].reason === "DEFERRED" || records[i].reason === "PLATFORM_LIMIT") && retry.has(records[i].url)) {
        byUrl.delete(records[i].url);
        records.splice(i, 1);
        discovered--;
      }
  } else {
    const scan = meter.sync("parse_html", () => scanHtml(html), html.length);
    linkChrome = scan.linkChrome;
    queue = makeQueue(scan.refs.map((r) => ({ ...r, depth: 1, from: primaryFile, against: base })));
  }

  /* Every path out of the loop lands here, so a reference is recorded once and
     its owning stylesheet's rewrite list is updated once, whatever happened to
     it. The first version of this had the bookkeeping on the success path only
     and a 404 background image silently kept its live URL in the CSS. */
  const recIdx = new Map();
  records.forEach((r, i) => { if (!recIdx.has(r)) recIdx.set(r, i); });
  const settle = (item, rec) => {
    if (rec) { recIdx.set(rec, records.length); records.push(rec); }
    if (item.cssOwner)
      item.cssOwner.rewrite.push({ ref: item.ref, sha256: rec && rec.ok ? rec.sha256 : null });
  };

  while (queue.length) {
    /* Lowest priority value first, ties by discovery order, which keeps the
       result deterministic for a given page. */
    const item = queue.shift();
    discovered++;
    const cls = classifyRef(item.ref, item.against, isPublic);
    /* Only the page's OWN references go in this map. A relative ref inside a
       stylesheet resolves against the stylesheet, not the page, and letting the
       two share a key would make the companion substitute the wrong bytes. */
    if (item.depth === 1 && !refToUrl.has(item.ref)) refToUrl.set(item.ref, cls.ok ? cls.url : null);

    /* R17 (D-603): when THIS run decided about the reference. `fetched_at` is
       added only where a fetch was actually issued, below; a reused, skipped,
       deferred, capped or refused record never claims a fetch instant. */
    const at = stamp();
    const org = cls.ok ? originOf(cls.url, baseHost) : { origin: "unknown", host: null };
    const stem = { url: cls.ok ? cls.url : item.ref, kind: item.kind, via: item.where,
                   from: item.from, depth: item.depth,
                   region: item.region || "body", region_basis: item.region_basis || "default",
                   ...org,
                   ...(item.family ? { family: item.family, family_size: item.family_size } : {}),
                   ...(item.evidentiary_prior ? { evidentiary_prior: item.evidentiary_prior } : {}),
                   considered_at: at };

    if (!cls.ok) {
      settle(item, { ...stem, ok: false, status: null, reason: cls.reason,
        ...(cls.final ? { final: true } : {}),
        ...(cls.scheme ? { scheme: cls.scheme } : {}),
        detail: cls.reason === "REFUSED_SCHEME"
          ? localize("subresources.subresources.a_scheme_reference_is_not", "a {scheme} reference is not something this surface fetches", { scheme: String(cls.scheme) })
          : localize("subresources.subresources.the_address_is_not_public_https", "the address is not public https, and the fence that guards the primary locator guards this one") });
      continue;
    }

    /* The document boundary, applied. A reference the document does not need is
       RECORDED and not fetched: the record still says the page asked for it and
       why this capture did not, which is the difference between a bounded
       capture and a lossy one. */
    const pol = fetchPolicy(item, org.origin);
    if (!pol.fetch) {
      settle(item, { ...stem, ok: false, status: null, fetched: false,
                     reason: pol.reason, detail: pol.detail });
      continue;
    }

    const already = byUrl.get(cls.url);
    /* The same address referenced twice is one fetch and one record, but both
       references still have to resolve, so the second one maps to the bytes the
       first one already stored. */
    if (already) {
      if (item.cssOwner)
        item.cssOwner.rewrite.push({ ref: item.ref, sha256: already.ok ? already.sha256 : null });
      continue;
    }
    /* Once the runtime has refused, every further attempt is another refusal.
       0.37.0 kept trying and wrote 85 identical PLATFORM_LIMIT rows, which
       spends time to record the same fact repeatedly and buries the one row
       that actually discovered the ceiling. Stop, and say the rest is
       outstanding rather than failed. */
    if (platformHit || attempted >= ceilingBudget) {
      deferred++;
      outstanding.push({ ...({ ...item, cssOwner: undefined }),
        cssOwnerIdx: item.cssOwner ? (recIdx.get(item.cssOwner) ?? -1) : null,
        retryUrl: cls.url });
      settle(item, { ...stem, ok: false, status: null, reason: "DEFERRED",
        detail: platformHit
          ? localize("subresources.subresources.this_invocation_reached_the_runtime", "this invocation reached the runtime's outbound request limit; the reference is outstanding, not failed, and a continuation can fetch it")
          : localize("subresources.subresources.held_back_from_a_previously_observed", "held back from a previously observed runtime limit so the invocation ends on our terms rather than mid-fetch") });
      continue;
    }
    if (attempted >= cap) {
      truncated = true;
      settle(item, { ...stem, ok: false, status: null, reason: "CAP_REACHED", cap,
        detail: localize("subresources.subresources.the_fanout_cap_was_reached", "the fanout cap was reached before this reference; it is recorded rather than dropped so the truncation is visible") });
      continue;
    }
    if (spent >= budget) {
      budgetHit = true;
      settle(item, { ...stem, ok: false, status: null, reason: "BUDGET_EXHAUSTED", budgetBytes: budget });
      continue;
    }
    /* Reuse, before spending a subrequest. The stored bytes are already in the
       content-addressed store, so this costs nothing at all: no request, no
       byte transfer, no draw on the ceiling. On a Legistar page roughly forty
       of the forty-five available fetches are site-wide chrome, so this is the
       difference between a second capture of a host completing and not. */
    if (siteLookup) {
      const known = await siteLookup(normalizeAddress(cls.url));
      const dec = reuseDecision(item, known, { now: now().getTime(), freshWindowMs: reuseFreshWindowMs, minDocuments: reuseMinDocuments });
      if (dec.reuse) {
        reused++;
        const rec = { ...stem, ok: true, status: null, sha256: known.sha256, bytes: known.bytes,
          ...(known.content_type ? { content_type: known.content_type } : {}),
          existed: true,
          /* The honesty fields. A reader must never be led to believe a byte was
             verified against the source during THIS capture when it was not. */
          fetched_this_capture: false,
          /* CAP-14 (CAPTURE-SCALING.md §Job one, RULED 2026-09-21 by BOB #21): the
             capture whose FETCH served these bytes, so a reader can follow them to
             the fetch that saw them served. null when the record names none (a
             fetch recorded before the build): UNDETERMINED as to source, never
             inferred from timestamps. */
          reused_from: known.last_fetched_by || null,
          reused_from_fetched_at: known.last_fetched,
          reused_stable_since: known.stable_since,
          reused_seen_in_documents: known.documents,
          detail: localize("subresources.subresources.not_fetched_during_this_capture", "not fetched during this capture: the source was seen serving these exact bytes at {last_fetched}{v1}, across {documents} documents on this host{v2}, and they are reused from the record rather than requested again", { last_fetched: String(known.last_fetched), v1: known.last_fetched_by
                    ? localize("subresources.subresources.by_capture", " by capture {capture}", { capture: String(known.last_fetched_by) })
                    : localize("subresources.subresources.by_a_capture_undetermined", " by a capture the record does not name (undetermined)"), documents: String(known.documents), v2: known.documents_undetermined
                    ? (known.documents_undetermined === 1
                      ? localize("subresources.subresources.and_earlier_capture_undetermined", " (and {count} earlier capture whose page the record does not name, counted as undetermined)", { count: String(known.documents_undetermined) })
                      : localize("subresources.subresources.and_earlier_captures_undetermined", " (and {count} earlier captures whose page the record does not name, counted as undetermined)", { count: String(known.documents_undetermined) }))
                    : "" }) };
        byUrl.set(cls.url, rec);
        if (!bySha.has(known.sha256)) bySha.set(known.sha256, rec);
        siteObservations.push({ address: cls.url, address_norm: normalizeAddress(cls.url),
                                sha256: known.sha256, kind: item.kind, reused: true,
                                reused_from: known.last_fetched_by || null });
        /* A reused stylesheet still needs its own url() targets resolved, so the
           bytes are read back and followed exactly as a fetched one would be. */
        if ((item.kind === "stylesheet" || known.content_type === "text/css") && item.depth < CSS_MAX_DEPTH && readBack) {
          const text = await readBack(known.sha256);
          if (text != null) {
            rec.css = true; rec.rewrite = [];
            for (const c of cssRefList(text))
              queue.push({ ref: c.url, kind: c.kind, where: `url() in ${cls.url}`,
                           depth: item.depth + 1, from: cls.url, against: cls.url, cssOwner: rec,
                           region: rec.region, region_basis: rec.region_basis });
          }
        }
        settle(item, rec);
        continue;
      }
      if (known) rec_noreuse(stem, dec);
    }

    attempted++;

    /* The instant this reference was taken up, which for a fetch is the moment
       it was issued: nothing between the two reads a clock or waits on the net
       except siteLookup, and a reused record never carries it. */
    const fetchedAt = at;
    let r, limited = false;
    try { r = await fetchOne(cls.url); }
    catch (e) {
      const msg = String((e && e.message) || e);
      /* "we ran out of budget" and "the source did not serve it" are different
         facts and the record must not confuse them. Reporting a platform
         subrequest limit as FETCH_FAILED would put a false statement about the
         SOURCE into the manifest, which is the one kind of error this system
         exists to prevent. */
      const platform = /too many subrequests|subrequest limit|exceeded.*limit/i.test(msg);
      r = { ok: false, status: 0, reason: platform ? "PLATFORM_LIMIT" : "FETCH_FAILED",
            detail: platform
              ? localize("subresources.subresources.the_runtime_refused_another", "the runtime refused another outbound request in this invocation; the source was never asked, and this says nothing about whether it would have answered")
              : msg };
      limited = platform;
      if (platform && !platformHit) {
        platformHit = true;
        /* The count reached WHEN THE RUNTIME SAID NO. This is the observation,
           and it is worth more than any documented figure because it came from
           this account, on this plan, at this moment. The caller records it and
           passes it back next time. */
        observedCeiling = attempted + subrequestsAlreadySpent;
      }
    }

    if (limited) {
      /* The runtime refused before the request left, so no fetch instant, and
         the reference is outstanding like the ones after it: a continuation
         retries it rather than losing it. */
      outstanding.push({ ...({ ...item, cssOwner: undefined }),
        cssOwnerIdx: item.cssOwner ? (recIdx.get(item.cssOwner) ?? -1) : null,
        retryUrl: cls.url });
      const rec = { ...stem, ok: false, status: 0, reason: "PLATFORM_LIMIT", detail: r.detail };
      byUrl.set(cls.url, rec); settle(item, rec);
      continue;
    }
    if (!r || !r.ok) {
      /* The failed bucket is closed (R16, R33). A reason the caller names that
         is not one of its two fetch outcomes (a governor's HOST_COOLING_OFF, say)
         is not the source refusing, so it is FETCH_FAILED with the caller's
         word kept beside it; an unexplained non-ok answer is the source's. */
      const named = r?.reason;
      const reason = named === "SOURCE_REFUSED" || named === "FETCH_FAILED" ? named
        : named ? "FETCH_FAILED" : "SOURCE_REFUSED";
      const rec = { ...stem, ok: false, status: r ? (r.status ?? null) : null, reason,
                    ...(named && named !== reason ? { fetch_reason: named } : {}),
                    fetched_at: fetchedAt,
                    ...(r?.detail ? { detail: r.detail } : {}) };
      byUrl.set(cls.url, rec); settle(item, rec);
      continue;
    }
    const bytes = r.bytes || new Uint8Array(0);
    if (bytes.length > perMax) {
      const rec = { ...stem, ok: false, status: r.status ?? 200, reason: "TOO_LARGE",
                    bytes: bytes.length, maxBytes: perMax, fetched_at: fetchedAt };
      byUrl.set(cls.url, rec); settle(item, rec);
      continue;
    }
    spent += bytes.length;
    const sha = await meter.cpuAwait("hash_subresource", () => sha256(bytes), bytes.length);
    const { existed } = await put(sha, bytes);
    const ct = (r.contentType || "").split(";")[0].trim();
    const rec = { ...stem, ok: true, status: r.status ?? 200, sha256: sha, bytes: bytes.length,
                  ...(ct ? { content_type: ct } : {}), existed: !!existed, fetched_at: fetchedAt };
    rec.fetched_this_capture = true;
    byUrl.set(cls.url, rec);
    if (!bySha.has(sha)) bySha.set(sha, rec);
    siteObservations.push({ address: cls.url, address_norm: normalizeAddress(cls.url),
                            sha256: sha, kind: item.kind, bytes: bytes.length,
                            content_type: ct || null, reused: false });

    /* One level of following, and only through stylesheets. A stylesheet's own
       references are how a page's background images and fonts arrive, so not
       following them at all would leave the common case looking broken. */
    const isCss = item.kind === "stylesheet" || ct === "text/css";
    if (isCss && item.depth < CSS_MAX_DEPTH) {
      let text = "";
      try { text = meter.sync("decode_css", () => new TextDecoder("utf-8", { fatal: false }).decode(bytes), bytes.length); } catch { text = ""; }
      rec.css = true;
      rec.rewrite = [];
      for (const c of meter.sync("parse_css", () => cssRefList(text)))
        queue.push({ ref: c.url, kind: c.kind, where: `url() in ${cls.url}`,
                     depth: item.depth + 1, from: cls.url, against: cls.url, cssOwner: rec,
                     /* A stylesheet's own assets carry the stylesheet's region,
                        not the region of whatever tag happened to be open. */
                     region: rec.region, region_basis: rec.region_basis });
    }
    settle(item, rec);
  }

  /* The companion resolves a reference by the same route the parser found it:
     raw text -> absolute url -> record. Scripts resolve to the dead
     placeholder even though their bytes are held, which is the whole point of
     capturing them without referencing them. */
  const resolve = (ref, kind) => {
    const trimmed = String(ref || "").trim();
    if (!trimmed) return null;
    if (kind === "script") return PLACEHOLDER_MISSING;
    const abs = refToUrl.has(trimmed) ? refToUrl.get(trimmed) : (() => {
      const c = classifyRef(trimmed, base, isPublic);
      return c.ok ? c.url : null;
    })();
    if (abs === null) return PLACEHOLDER_MISSING;
    const rec = byUrl.get(abs);
    if (!rec) return PLACEHOLDER_MISSING;
    if (rec.kind === "script") return PLACEHOLDER_MISSING;
    return rec.ok ? placeholderFor(rec.sha256) : PLACEHOLDER_MISSING;
  };

  const when0 = resume && resume.when0 ? resume.when0 : stamp();
  /* Links. Every <a href> the page carries is characterised into a partition
     and recorded, because a connection the source itself asserted is material
     the record wants, not noise to be stripped. */
  /* Seeded from whatever a previous tick already recorded, using the same key
     note() builds, so a resumed capture does not re-append every link each time
     it rebuilds the companion. */
  const seenLink = new Map(links.map((l) => [`${l.type}\u0000${l.citation || l.address || l.ref}`, l]));
  /* N79: every link says whether it sat in a chrome region, with that region's
     basis, and says so explicitly when it did not, so the field is never read as
     absent. Whether it IS the site's chrome (it recurs across the host's pages)
     is capture's to decide (its R28), never this page's. */
  const contain = (l, basis) => {
    if (basis) { if (l.chrome !== true) { l.chrome = true; l.chrome_basis = basis; } }
    else if (l.chrome !== true) { l.chrome = false; l.chrome_basis = null; }
  };
  /* A link restored from an earlier tick that predates the field. */
  for (const l of links) contain(l, linkChrome.get(String(l.ref || "").trim()) || null);
  const classifyLink = (ref) => {
    const raw = String(ref || "").trim();
    const basis = linkChrome.get(raw) || null;
    const note = (type, address, extra = {}) => {
      /* Keyed on the CITATION, so a link to #findings and a link to
         #methodology in the same report are two records rather than one. */
      const key = `${type}\u0000${extra.citation || address || raw}`;
      if (!seenLink.has(key)) {
        const l = { ref: raw, type, address: address || null, as_of: when0,
                    ...(address ? originOf(address, baseHost) : {}), ...extra };
        contain(l, basis);
        seenLink.set(key, l);
        links.push(l);
      } else {
        /* The same citation written a second way ("/x" in the body, the absolute
           address in the nav) is still one link, and the nav carried it. */
        contain(seenLink.get(key), basis);
      }
      return { type, address, ...extra };
    };
    if (!raw) return { type: "refused", wrapper: linkWrapper.refused(), address: null };

    /* An in-page anchor points at this very document and is decided forever. */
    if (raw.startsWith("#")) {
      /* An in-page anchor is an element reference into THIS document, which
         Bob's ruling makes a component reference rather than noise. The
         document it points into is the primary, so the address is the primary's
         own locator and the element is the fragment. */
      note("anchor", base, { fragment: fragmentOf(raw), citation: normalizeCitation(base + raw) });
      return { type: "anchor", wrapper: linkWrapper.anchor(raw), address: null };
    }
    const cls = classifyRef(raw, base, isPublic);
    if (!cls.ok) {
      note("refused", cls.url, { reason: cls.reason, ...(cls.scheme ? { scheme: cls.scheme } : {}) });
      return { type: "refused", wrapper: linkWrapper.refused(), address: null };
    }
    /* Intra-record: the link's address is one this capture already holds bytes
       for, so it resolves inside the record and can never become anything
       else. */
    const held = byUrl.get(cls.url);
    if (held && held.ok) {
      note("intra", cls.url, { sha256: held.sha256, fragment: fragmentOf(raw),
                               citation: normalizeCitation(new URL(raw, base).toString()) });
      return { type: "intra", wrapper: linkWrapper.intra(held.sha256), address: cls.url };
    }
    /* Everything else is deferred: whether the store holds a capture of this
       address is a question about the store, and the store changes. */
    note("deferred", cls.url, { held_at_capture: false, fragment: fragmentOf(raw),
                                citation: normalizeCitation(new URL(raw, base).toString()) });
    return { type: "deferred", wrapper: linkWrapper.deferred(cls.url), address: cls.url };
  };

  const when = when0;
  const companionText = meter.sync("render_companion", () => renderCompanion(html, { resolve, classifyLink, primarySha, when }), html.length);
  const companionBytes = meter.sync("encode_companion", () => new TextEncoder().encode(companionText), companionText.length);
  const companionSha = await meter.cpuAwait("hash_companion", () => sha256(companionBytes));
  await put(companionSha, companionBytes);

  const fetched = records.filter((r) => r.ok);
  const manifest = {
    version: 1,
    derived: true,
    of: primaryFile,
    of_sha256: primarySha,
    base,
    generated: when,
    render: `${primaryFile}.render.html`,
    render_sha256: companionSha,
    placeholder_scheme: "about:capture#<sha256>",
    unavailable: PLACEHOLDER_MISSING,
    limits: { cap, per_max_bytes: perMax, budget_bytes: budget, css_max_depth: CSS_MAX_DEPTH },
    discovered, attempted, truncated, budget_exhausted: budgetHit,
    complete: !platformHit && !truncated && !budgetHit && deferred === 0,
    compute: meter.report(),
    reuse: { reused, fetched: fetched.length - reused, not_reused: noReuse,
             fresh_window_ms: reuseFreshWindowMs, min_documents: reuseMinDocuments,
             note: localize("subresources.subresources.entries_with_fetched_this_capture", "entries with fetched_this_capture:false were NOT fetched during this capture; their bytes come from an earlier fetch of the same address on this host, made by the capture named in reused_from (null: not recorded, undetermined) at reused_from_fetched_at. A capture ratified as evidence must re-fetch them.") },
    /* D-191: when the parts this composite holds were fetched, per clock. */
    part_fetch_spread: partFetchSpread(records),
    outstanding: outstanding.length,
    platform: {
      limited: platformHit,
      /* Discovered, never declared. null means this run never found the edge,
         which tells the caller only that the ceiling is AT LEAST what was spent,
         not what it is. */
      observed_ceiling: observedCeiling,
      ceiling_used: platformCeiling,
      spent_this_invocation: attempted + subrequestsAlreadySpent,
      note: observedCeiling
        ? localize("subresources.subresources.the_runtime_refused_an_outbound", "the runtime refused an outbound request at this count; record it and pass it back as platformCeiling")
        : localize("subresources.subresources.no_limit_was_reached", "no limit was reached, so the ceiling is at least spent_this_invocation and its true value is unknown"),
    },
    counts: {
      fetched: fetched.length,
      failed: records.filter((r) => !r.ok && (r.reason === "SOURCE_REFUSED" || r.reason === "FETCH_FAILED" || r.reason === "TOO_LARGE")).length,
      platform_limited: records.filter((r) => r.reason === "PLATFORM_LIMIT").length,
      deferred: records.filter((r) => r.reason === "DEFERRED").length,
      refused: records.filter((r) => !r.ok && (r.reason === "REFUSED_SCHEME" || r.reason === "REFUSED_LOCATOR" || r.reason === "UNRESOLVABLE")).length,
      /* Deliberately not fetched: policy skips, plus the two bounds. Every
         record lands in exactly one of fetched/failed/refused/skipped, and this
         module's R16 test asserts that identity, so a new reason that forgets
         to name a bucket fails rather than quietly vanishing from the totals. */
      skipped: records.filter((r) => !r.ok && (r.reason === "OUTSIDE_THE_DOCUMENT" || r.reason === "THIRD_PARTY"
                || r.reason === "COLLAPSED_SRCSET_FAMILY" || r.reason === "CAP_REACHED" || r.reason === "BUDGET_EXHAUSTED"
                || r.reason === "PLATFORM_LIMIT" || r.reason === "DEFERRED")).length,
      scripts_held_unreferenced: fetched.filter((r) => r.kind === "script").length,
      bytes: spent,
      not_fetched: {
        outside_the_document: records.filter((r) => r.reason === "OUTSIDE_THE_DOCUMENT").length,
        third_party: records.filter((r) => r.reason === "THIRD_PARTY").length,
        collapsed_srcset: records.filter((r) => r.reason === "COLLAPSED_SRCSET_FAMILY").length,
      },
      by_origin: {
        same_host: records.filter((r) => r.origin === "same_host").length,
        same_site: records.filter((r) => r.origin === "same_site").length,
        third_party: records.filter((r) => r.origin === "third_party").length,
      },
      links: {
        anchor: links.filter((l) => l.type === "anchor").length,
        intra: links.filter((l) => l.type === "intra").length,
        deferred: links.filter((l) => l.type === "deferred").length,
        refused: links.filter((l) => l.type === "refused").length,
      },
    },
    subresources: records,
    links,
    link_note: localize("subresources.subresources.every_a_the_page_carried", "Every <a> the page carried, characterised. `intra` resolves inside this record and is final. `deferred` is an address whose partition depends on what the store holds and is therefore NOT final: held_at_capture records only what was true when this page was captured, and a viewer must re-resolve it against the store at read time. A deferred link that later resolves to a capture in another record is a link to THAT VERSION of the target only if the target's capture can be shown to be the version the source was pointing at on this page's retrieval date. Until that is established the link is unconfirmed, and unconfirmed is a third answer rather than a synonym for either of the other two."),
    note: localize("subresources.subresources.every_entry_the_viewer_renders", "Every entry the viewer renders must be fetched by sha256 through op=capture and verified against that sha before use. Entries with ok:false are recorded because a stylesheet the source failed to serve is part of what the source served that day. Script entries hold bytes and are never referenced by the render companion."),
  };
  const manifestBytes = meter.sync("serialise_manifest", () => new TextEncoder().encode(JSON.stringify(manifest, null, 1)), records.length);
  const manifestSha = await meter.cpuAwait("hash_manifest", () => sha256(manifestBytes));
  await put(manifestSha, manifestBytes);

  return {
    subresources: records,
    links, siteObservations, reused, meter,
    /* Everything the next tick needs, and nothing it does not. The primary HTML
       is NOT in here: it is already in the store under primarySha, and carrying
       a copy in session state would be a second, unverified copy of evidence. */
    resumeState: outstanding.length ? {
      when0, discovered, spent, queue: outstanding,
      records, links, siteObservations,
      refToUrl: Object.fromEntries(refToUrl),
    } : null,
    manifest, manifestSha, manifestBytes,
    companionText, companionSha, companionBytes,
    truncated, discovered, attempted,
    /* `renditions`, not `derived`. C-18.1 already spends `derived` on a
       different claim: that THIS document is itself a derivation of something
       else, with a transform and a reason. What is being named here is the
       opposite direction, artifacts derived FROM this document, so it needs its
       own key. It borrows the transform/reason vocabulary because the honesty
       requirement is identical: a rendering that does not say what was done to
       it and why is indistinguishable from evidence. */
    renditions: [
      { file: `${primaryFile}.render.html`, kind: "render_companion", from_file: primaryFile,
        sha256: companionSha, bytes: companionBytes.length, content_type: "text/html",
        transform: "scripts and frames removed; subresource references replaced with about:capture#<sha256> placeholders; a content security policy added",
        reason: localize("subresources.subresources.the_raw_capture_is_the", "the raw capture is the evidence and is never rewritten, so showing the page as it was needs a separate artifact that says it is one") },
      { file: "data/snapshot-manifest.json", kind: "snapshot_manifest", from_file: primaryFile,
        sha256: manifestSha, bytes: manifestBytes.length, content_type: "application/json",
        transform: localize("subresources.subresources.index_of_the_render_companion", "index of the render companion's placeholders to the content-addressed captures they resolve to"),
        reason: localize("subresources.subresources.a_viewer_must_be_able", "a viewer must be able to verify every byte it substitutes against the record before showing it") },
    ],
  };
}
