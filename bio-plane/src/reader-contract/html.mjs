/* reading-pipeline R51 (fix round 9, G131f, G131h; S-34, X31): the visible text of an HTML page by one streaming pass, linear in the
   page's bytes. R32's rules are unchanged (its furniture, its region, its skip links, its template tokens, an unclosed head); only how
   they are found changes. The page is cut into tokens once (text, start tag, end tag; a comment, a declaration, CDATA and a raw-text
   element are one gap token), the start and end tags of a name are paired once by a stack per name, and every stage that took an
   element out (navigation, landmark furniture, the furniture that goes wherever it sits, a skip link) is one walk over the tokens that
   skips the element's extent through the pairing. The judgement of a block (only links, only controls, a notice, a block holding prose) is
   made from the block's own summary, built bottom up in the same walk, so a block costs its tokens once and a nesting 8,000 deep costs
   no more than its size. The walks give the turn back every `stretch` tokens (a generator; the sync runner ignores the yields), and a
   count of tokens between yields is kept in `stats` for a test to assert (R-CLOCK). R51's two additions: a table keeps its rows and
   columns (a row is a paragraph, its cells separated by a tab), and a list or a table of links in the page's content is kept, only a
   link bar (a block of only links that is no list and holds none) being furniture. Pure. */
import { glyphCount } from "../textchain.mjs";

export const HTML_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", copy: "©", reg: "®",
  trade: "™", mdash: "—", ndash: "–", hellip: "…", lsquo: "‘", rsquo: "’", ldquo: "“",
  rdquo: "”", bull: "•", middot: "·", sect: "§", para: "¶", deg: "°", times: "×",
  laquo: "«", raquo: "»", eacute: "é", egrave: "è", aacute: "á", iacute: "í",
  oacute: "ó", uacute: "ú", ntilde: "ñ", uuml: "ü", ouml: "ö", auml: "ä", ccedil: "ç" };
export const decodeReferences = (s) => s.replace(/&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([A-Za-z][A-Za-z0-9]{1,8}));/g,
  (whole, dec, hex, name) => {
    if (name) return Object.prototype.hasOwnProperty.call(HTML_ENTITIES, name) ? HTML_ENTITIES[name] : whole;
    const cp = dec !== undefined ? Number(dec) : parseInt(hex, 16);
    if (!(cp > 0 && cp <= 0x10ffff) || (cp >= 0xd800 && cp <= 0xdfff)) return whole;
    const ch = String.fromCodePoint(cp);
    return /^\s$/.test(ch) ? " " : ch;   /* a referenced space or newline is a space, never a paragraph break */
  });

/* a block tag ends its paragraph; a cell (`td`, `th`) does not (R51: a table keeps its columns) */
const BLOCK = new Set(["address", "article", "aside", "blockquote", "body", "caption", "dd", "details", "div", "dl", "dt", "fieldset", "figcaption",
  "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "html", "li", "main", "nav", "ol", "p", "pre", "section", "table",
  "tbody", "tfoot", "thead", "tr", "ul"]);
const CELL = new Set(["td", "th"]);
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const RAW = new Set(["script", "style", "template", "head"]);
const FURNITURE_NAME = new Set(["header", "footer", "aside"]);
const FURNITURE_ROLE = new Set(["banner", "contentinfo", "complementary", "search"]);
const NEVER_BY_ATTRIBUTE = new Set(["html", "head", "body", "main", "article"]);
const BLOCK_CANDIDATE = new Set(["div", "section", "ul", "ol", "li", "p", "form", "fieldset", "menu", "dl", "dd", "dt", "span", "figure"]);
const NOTICE_CANDIDATE = new Set([...BLOCK_CANDIDATE, "h1", "h2", "h3", "h4", "h5", "h6", "figcaption", "blockquote"]);
/* a list or a table: its links are the page's content (R51), so a block of only links that is one, or holds one, is kept */
const LISTING = new Set(["ul", "ol", "dl", "li", "dd", "dt", "menu", "table", "thead", "tbody", "tfoot", "tr"]);
const CONTROL_TAG = new Set(["button", "select", "textarea", "option", "optgroup", "label", "datalist", "output"]);
const CARD_PART = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "div", "ul", "ol", "li", "section", "article", "figure", "blockquote", "table"]);
const NON_PROSE = new Set(["a", "h1", "h2", "h3", "h4", "h5", "h6", "label", "button", "select", "option", "textarea", "script", "style"]);
const NOTICE_TEXT_MAX = 400;
const NOTICE_TEXT = [/^skip (?:to|ahead|navigation|the|past)\b/i, /^jump to\b/i, /^exiting\s+[\w.-]+\.[a-z]{2,}\b/i,
  /^you (?:are|'re) (?:now )?(?:leaving|exiting)\b/i, /^you (?:are|'re) about to (?:leave|exit)\b/i, /^leaving (?:this|the|our)\b.*\b(?:site|website)\b/i];
const NAME_WORDS = new Set(["footer", "contact", "search", "breadcrumb", "breadcrumbs", "share", "social", "sidebar", "related", "explore", "promo", "promos", "gallery", "carousel"]);
const TEMPLATE_TOKEN = /\{[0-9]+\}|\{[A-Za-z_][A-Za-z0-9_]*\}|##LOC\[[^\]]*\]##/g;
const HEAD_CONTENT = new Set(["title", "meta", "link", "base", "style", "script", "noscript", "template"]);

/* ---- attributes (read from a tag's own text, only when the tag could hold the one asked) ---- */
const ATTR_RE = new Map();
const attrOf = (attrs, name) => {
  let re = ATTR_RE.get(name);
  if (!re) ATTR_RE.set(name, re = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  const m = re.exec(attrs);
  return m ? (m[1] ?? m[2] ?? m[3]) : null;
};
const roleOf = (attrs) => (attrs.length > 4 && /role/i.test(attrs) ? (attrOf(attrs, "role") ?? "").trim().split(/\s+/)[0].toLowerCase() : "");
const wordsOfToken = (t) => t.toLowerCase().split(/[-_]+/).filter(Boolean);
const classTokens = (attrs) => (attrOf(attrs, "class") ?? "").split(/\s+/).filter(Boolean).concat(attrOf(attrs, "id") ?? []);
const isDialogToken = (t) => /^(?:modal|modal-dialog|dialog)$/i.test(t);
const isBannerToken = (t) => /(?:usa|gov|government|govt|official)[-_]?banner/i.test(t)
  || wordsOfToken(t).some((w) => w === "cookie" || w === "cookies" || w === "consent" || w === "gdpr" || w === "ccpa");
const isShareToken = (t) => wordsOfToken(t).some((w) => w === "share" || w === "shares" || w === "sharing" || w === "sharer")
  || /^(?:addthis|sharethis|a2a)/i.test(t)
  || /^social(?:[-_](?:share|sharing|links|media|icons|buttons|bar|nav|follow|networks|menu))?$/i.test(t);
const nameWords = (t) => t.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase().split(/[\s_-]+/).filter(Boolean);
const isNamedFurniture = (attrs) => attrs.length > 3 && /class|id/i.test(attrs) && classTokens(attrs).some((t) => nameWords(t).some((w) => NAME_WORDS.has(w)));
const isFurnitureByAttribute = (name, attrs) => {
  if (NEVER_BY_ATTRIBUTE.has(name)) return false;
  if (name === "dialog") return true;
  if (attrs.length < 3) return false;
  if (/role|aria-modal/i.test(attrs) && (["dialog", "alertdialog"].includes(roleOf(attrs)) || (attrOf(attrs, "aria-modal") ?? "").trim().toLowerCase() === "true")) return true;
  return /class|id/i.test(attrs) && classTokens(attrs).some((t) => isDialogToken(t) || isBannerToken(t) || isShareToken(t));
};

/* ---- the sentence (R32's holdsProse): a run of three or more words ending in a stop, outside a heading, a link, a label and a control ---- */
const SENTENCE = /(?:[\p{L}\p{N}'’-]+\s+){2,}[\p{L}\p{N}'’-]+[.!?](?=\s|$)/u;
const PROSE_SCAN_MAX = 1 << 20;   /* characters of one block's prose looked at: past this the block holds prose as far as this judgement goes (it is kept) */

/* ---- the tokens ---- */
const QUOTE_OR_GT = /[>"']/g;
const NAME_RE = /[A-Za-z][A-Za-z0-9:-]*/y;
/* the index of the `>` that ends the tag whose attributes begin at `from`, or -1 (a quote that never closes, or no `>`) */
function tagEnd(html, from) {
  let p = from;
  for (;;) {
    QUOTE_OR_GT.lastIndex = p;
    const m = QUOTE_OR_GT.exec(html);
    if (!m) return -1;
    if (m[0] === ">") return m.index;
    const q = html.indexOf(m[0], m.index + 1);
    if (q < 0) return -1;
    p = q + 1;
  }
}
const K_TEXT = 0, K_START = 1, K_END = 2, K_GAP = 3;
const GAP = -1, HR = -2;   /* the ids a stage's output uses for a space where an element was, and for the break between two regions */

/* G14: `<head>` may be left unclosed (HTML ends it at the first thing that cannot be in a head): what the head holds up to there goes, the
   rest is the body's. A closed head holds only head content in the usual page, and goes whole. */
function dropHead(html) {
  const open = /<head\b(?:"[^"]*"|'[^']*'|[^'">])*>/i.exec(html);
  if (!open) return html;
  const tag = /<(\/?)([A-Za-z][A-Za-z0-9:-]*)(?:"[^"]*"|'[^']*'|[^'">])*>/y;
  let at = open.index + open[0].length;
  for (;;) {
    const ws = /^\s*/.exec(html.slice(at, at + 1024))[0].length;
    at += ws;
    if (at >= html.length) break;
    if (html.startsWith("<!--", at)) { const e = html.indexOf("-->", at + 4); at = e < 0 ? html.length : e + 3; continue; }
    if (html[at] !== "<") break;   /* text: the body has begun */
    tag.lastIndex = at;
    const m = tag.exec(html);
    if (!m) break;
    const name = m[2].toLowerCase();
    if (m[1] && name === "head") { at = tag.lastIndex; break; }
    if (m[1] || !HEAD_CONTENT.has(name)) break;
    at = tag.lastIndex;
    if (["title", "style", "script", "noscript", "template"].includes(name) && !m[0].endsWith("/>")) {
      const end = new RegExp(`</${name}\\s*>`, "gi");
      end.lastIndex = at;
      const e = end.exec(html);
      at = e ? e.index + e[0].length : html.length;
    }
  }
  return html.slice(0, open.index) + " " + html.slice(at);
}

function* tokenize(html, G) {
  const n = html.length;
  let lt = 0;
  for (let i = html.indexOf("<"); i >= 0; i = html.indexOf("<", i + 1)) lt++;
  const cap = 2 * lt + 4;
  const D = { html, n: 0, k: new Uint8Array(cap), s: new Int32Array(cap), e: new Int32Array(cap), nm: new Int32Array(cap), as: new Int32Array(cap),
              sc: new Uint8Array(cap), names: [], nameId: new Map(), isVoid: [], block: [], cell: [] };
  const intern = (name) => {
    let id = D.nameId.get(name);
    if (id === undefined) {
      id = D.names.length; D.names.push(name); D.nameId.set(name, id);
      const stem = /^[A-Za-z0-9_]*/.exec(name)[0];   /* `\b` after the name: `p-x` is a `p` */
      D.isVoid.push(VOID.has(name)); D.block.push(BLOCK.has(stem)); D.cell.push(CELL.has(stem));
    }
    return id;
  };
  D.intern = intern; D.HR = intern("hr");
  D.text = (id) => html.slice(D.s[id], D.e[id]);
  D.attr = (id) => (D.e[id] - 1 > D.as[id] ? html.slice(D.as[id], D.e[id] - 1) : "");
  const push = (k, s, e, nm = 0, as = 0, sc = 0) => { const i = D.n++; D.k[i] = k; D.s[i] = s; D.e[i] = e; D.nm[i] = nm; D.as[i] = as; D.sc[i] = sc; };
  let i = 0;
  while (i < n) {
    const at = html.indexOf("<", i);
    if (at < 0) { push(K_TEXT, i, n); break; }
    if (at > i) push(K_TEXT, i, at);
    G.tick(1);
    if (G.due()) yield;
    const c = html.charCodeAt(at + 1);
    if (c === 33) {                                                     /* <! */
      if (html.startsWith("<!--", at)) { const e = html.indexOf("-->", at + 4); const end = e < 0 ? n : e + 3; push(K_GAP, at, end); i = end; continue; }
      if (html.startsWith("<![CDATA[", at)) { const e = html.indexOf("]]>", at + 9); const end = e < 0 ? n : e + 3; push(K_GAP, at, end); i = end; continue; }
    }
    if (c === 33 || c === 63) {                                         /* a declaration or a processing instruction */
      const e = html.indexOf(">", at + 2);
      if (e >= 0) { push(K_GAP, at, e + 1); i = e + 1; continue; }
      push(K_TEXT, at, at + 1); i = at + 1; continue;
    }
    const closing = c === 47;
    NAME_RE.lastIndex = at + (closing ? 2 : 1);
    const m = (closing || (c >= 65 && c <= 90) || (c >= 97 && c <= 122)) ? NAME_RE.exec(html) : null;
    if (!m) { push(K_TEXT, at, at + 1); i = at + 1; continue; }
    const nameEnd = NAME_RE.lastIndex;
    const gt = tagEnd(html, nameEnd);
    if (gt < 0) { push(K_TEXT, at, n); i = n; break; }                  /* no end to the tag: the rest of the page is text */
    const name = m[0].toLowerCase();
    const nm = intern(name);
    const selfClosed = html.charCodeAt(gt - 1) === 47 && gt - 1 >= nameEnd ? 1 : 0;
    if (closing) { push(K_END, at, gt + 1, nm); i = gt + 1; continue; }
    if (RAW.has(name)) {                                                /* script, style, template, head: raw text to its end tag, or to the end */
      const re = new RegExp(`</${name}\\s*>`, "gi");
      re.lastIndex = gt + 1;
      const e = re.exec(html);
      const end = e ? e.index + e[0].length : n;
      push(K_GAP, at, end); i = end; continue;
    }
    push(K_START, at, gt + 1, nm, nameEnd, selfClosed);
    i = gt + 1;
  }
  return D;
}

/* ---- a stage's token list: ids into the page's tokens (>= 0), GAP and HR ---- */
const kindOf = (D, id) => (id >= 0 ? D.k[id] : id === GAP ? K_GAP : K_START);
const nameOf = (D, id) => (id >= 0 ? D.nm[id] : D.HR);
const attrsOf = (D, id) => (id >= 0 && D.k[id] === K_START ? D.attr(id) : "");
const isClosable = (D, id) => id >= 0 && D.k[id] === K_START && !D.sc[id] && !D.isVoid[D.nm[id]];

/* the pairing of the start and end tags of a name, by a stack per name: `match[i]` is the position of the end tag of a start tag (and the
   reverse), or -1 (a void or self-closing tag, an element never closed, an end tag with nothing to close) */
function pair(D, ord, m) {
  const match = new Int32Array(m).fill(-1), up = new Int32Array(m), top = new Int32Array(D.names.length).fill(-1);
  for (let i = 0; i < m; i++) {
    const id = ord[i];
    if (id < 0) continue;
    const k = D.k[id];
    if (k === K_START) { if (!D.sc[id] && !D.isVoid[D.nm[id]]) { up[i] = top[D.nm[id]]; top[D.nm[id]] = i; } }
    else if (k === K_END) {
      const j = top[D.nm[id]];
      if (j >= 0) { top[D.nm[id]] = up[j]; match[i] = j; match[j] = i; }
    }
  }
  return match;
}

/* one walk: every start tag `drop(i)` says yes to goes with its extent, a space left in its place (an element never closed, or void, goes alone) */
function* dropStage(D, ord, m, match, drop, G) {
  const out = new Int32Array(m);
  let o = 0;
  for (let i = 0; i < m; i++) {
    G.tick(1); if (G.due()) yield;
    const id = ord[i];
    if (id >= 0 && D.k[id] === K_START && drop(i)) {
      out[o++] = GAP;
      if (match[i] > i) i = match[i];
      continue;
    }
    out[o++] = id;
  }
  return out.subarray(0, o);
}

/* the inner tokens of every outermost closed element of a name, a break between them; null when the page has none */
function* contentsOf(D, ord, m, match, nameId, G) {
  const out = []; let found = false;
  for (let i = 0; i < m; i++) {
    G.tick(1); if (G.due()) yield;
    const id = ord[i];
    if (id < 0 || D.k[id] !== K_START || D.nm[id] !== nameId || D.sc[id] || match[i] <= i) continue;
    if (found) out.push(HR);
    found = true;
    for (let j = i + 1; j < match[i]; j++) out.push(ord[j]);
    i = match[i];
  }
  return found ? Int32Array.from(out) : null;
}

/* ---- the summary of a block (R32's probeBlock and holdsProse), bottom up ---- */
const PAIRS = 16;   /* the (links open, controls open) a text sits under inside a block, each capped at 3, as a 16-bit mask */
const bit = (l, c) => 1 << (Math.min(l, 3) * 4 + Math.min(c, 3));
const shiftMask = (mask, dl, dc) => {
  if (!mask || (!dl && !dc)) return mask;
  let out = 0;
  for (let p = 0; p < PAIRS; p++) if (mask & (1 << p)) out |= bit((p >> 2) + dl, (p & 3) + dc);
  return out;
};
const F_GLYPH = 1, F_SEEN_LINK = 2, F_SEEN_CTL = 4, F_LISTING = 8, F_CARD_SEG = 16, F_CARD_INNER = 32, F_LONG = 64;

function* summarize(D, ord, m, match, G) {
  const mask = new Uint16Array(m), fl = new Uint8Array(m), said = new Array(m).fill(null), done = new Uint8Array(m);
  const stack = [];   /* frames of the closed elements being walked: {i, mask, fl, said, len, pl, pc} */
  const fresh = (i) => ({ i, mask: 0, fl: 0, said: "", len: 0, pl: 0, pc: 0 });
  stack.push(fresh(-1));
  const addText = (f, seg) => {
    f.fl |= F_GLYPH; f.mask |= bit(f.pl, f.pc);
    f.len += seg.length;
    if (f.len > NOTICE_TEXT_MAX) { f.fl |= F_LONG; f.said = ""; } else if (!(f.fl & F_LONG)) f.said += seg;
  };
  const merge = (p, c, name, nameStem) => {
    const isLink = name === "a", isCtl = CONTROL_TAG.has(name);
    const dl = p.pl + (isLink ? 1 : 0), dc = p.pc + (isCtl ? 1 : 0);
    p.mask |= shiftMask(c.mask, dl, dc);
    let f = c.fl & (F_GLYPH | F_SEEN_LINK | F_SEEN_CTL | F_LISTING | F_CARD_SEG);
    if (isLink) f |= F_SEEN_LINK;
    else if (isCtl && name !== "label") f |= F_SEEN_CTL;
    if (LISTING.has(nameStem)) f |= F_LISTING;
    /* a text under a card part (a link wrapping a heading or a paragraph is a card, not a menu entry) opened while a link is open is loose */
    if ((p.pl > 0 || isLink) && (c.fl & F_CARD_INNER)) f |= F_CARD_SEG;
    if (p.pl > 0 && CARD_PART.has(name) && (c.fl & F_GLYPH)) f |= F_CARD_SEG;
    p.fl |= f;
    if (CARD_PART.has(name) ? (c.fl & F_GLYPH) : (c.fl & F_CARD_INNER)) p.fl |= F_CARD_INNER;
    if (!(p.fl & F_LONG)) {
      p.len += c.len;
      if (c.fl & F_LONG || p.len > NOTICE_TEXT_MAX) { p.fl |= F_LONG; p.said = ""; } else p.said += c.said;
    }
  };
  for (let i = 0; i < m; i++) {
    G.tick(1); if (G.due()) yield;
    const id = ord[i], top = stack[stack.length - 1];
    if (id === HR) continue;
    if (id === GAP || D.k[id] === K_TEXT || D.k[id] === K_GAP) {   /* a run of text, the gaps in it spaces: one segment between two tags */
      let j = i, raw = "";
      while (j < m && (ord[j] === GAP || (ord[j] >= 0 && (D.k[ord[j]] === K_TEXT || D.k[ord[j]] === K_GAP)))) { raw += ord[j] >= 0 && D.k[ord[j]] === K_TEXT ? D.text(ord[j]) : " "; j++; }
      const seg = decodeReferences(raw.replace(/\s+/g, " "));
      if (glyphCount(seg) > 0) addText(top, seg);
      i = j - 1; continue;
    }
    const k = D.k[id];
    const name = D.names[D.nm[id]];
    if (k === K_START) {
      if (match[i] > i) { stack.push(fresh(i)); continue; }
      /* a start tag never closed (or void): its effect holds to the end of the element it stands in */
      if (name === "a") { top.pl++; top.fl |= F_SEEN_LINK; }
      else if (name === "input") top.fl |= F_SEEN_CTL;
      else if (CONTROL_TAG.has(name)) { top.pc++; if (name !== "label") top.fl |= F_SEEN_CTL; }
      continue;
    }
    if (k === K_END && match[i] >= 0) {
      const st = match[i];
      let f = stack[stack.length - 1];
      while (stack.length > 1 && f.i !== st) { stack.pop(); f = stack[stack.length - 1]; }   /* crossed elements: the ones inside are folded away */
      if (stack.length > 1 && f.i === st) {
        stack.pop();
        mask[st] = f.mask; fl[st] = f.fl; said[st] = f.fl & F_LONG ? null : f.said; done[st] = 1;
        const sid = ord[st];
        merge(stack[stack.length - 1], f, D.names[D.nm[sid]], /^[A-Za-z0-9_]*/.exec(D.names[D.nm[sid]])[0]);
      }
    }
  }
  return { mask, fl, said, done };
}

/* ---- the whole pass ---- */
function* pass(html0, G) {
  const html = dropHead(html0);
  const D = yield* tokenize(html, G);
  return yield* stages(D, G);
}
function* stages(D, G) {
  const ordAll = (n) => { const o = new Int32Array(n); for (let i = 0; i < n; i++) o[i] = i; return o; };
  let ord = ordAll(D.n), m = D.n;
  /* navigation goes with its contents */
  let match = pair(D, ord, m);
  const isNav = (i) => { const id = ord[i]; const name = D.names[D.nm[id]]; return name === "nav" || roleOf(attrsOf(D, id)) === "navigation"; };
  ord = yield* dropStage(D, ord, m, match, isNav, G); m = ord.length;
  /* the page's region: its main, else its article, else its landmark furniture is taken out */
  match = pair(D, ord, m);
  const mainId = D.nameId.get("main"), articleId = D.nameId.get("article");
  const roleMain = (() => { for (let i = 0; i < m; i++) { const id = ord[i]; if (id >= 0 && D.k[id] === K_START) { const a = attrsOf(D, id); if (a.length > 4 && /\srole\s*=\s*["']?main\b/i.test(a)) return true; } } return false; })();
  let region = null;
  if (mainId !== undefined) region = yield* contentsOf(D, ord, m, match, mainId, G);
  if (!region && articleId !== undefined) region = yield* contentsOf(D, ord, m, match, articleId, G);
  const hasRegion = region !== null || roleMain;
  if (!region) {
    const isFurn = (i) => { const id = ord[i]; const name = D.names[D.nm[id]]; return FURNITURE_NAME.has(name) || FURNITURE_ROLE.has(roleOf(attrsOf(D, id))); };
    region = yield* dropStage(D, ord, m, match, isFurn, G);
  }
  ord = region; m = ord.length;
  /* the furniture that goes wherever it sits, judged from each block's own summary */
  match = pair(D, ord, m);
  const sum = yield* summarize(D, ord, m, match, G);
  const needProse = hasRegion;
  const holds = needProse ? makeHolds(D, ord, match, 16 * m + 4096) : null;
  const kept = (i) => {
    const id = ord[i], name = D.names[D.nm[id]], attrs = attrsOf(D, id);
    if (isFurnitureByAttribute(name, attrs)) return true;
    if (NOTICE_CANDIDATE.has(name) && !D.sc[id] && match[i] > i && sum.done[i]) {
      const f = sum.fl[i], loose = (sum.mask[i] & 1) !== 0 || (f & F_CARD_SEG) !== 0, long = (f & F_LONG) !== 0;
      if (!(loose && long)) {
        const listed = LISTING.has(name) || (f & F_LISTING) !== 0;
        const linksOnly = (f & F_SEEN_LINK) !== 0 && (f & F_SEEN_CTL) === 0;
        if (!loose && (f & (F_SEEN_LINK | F_SEEN_CTL)) !== 0 && BLOCK_CANDIDATE.has(name) && !(linksOnly && listed)) return true;
        const text = sum.said[i] === null ? null : sum.said[i].replace(/\s+/g, " ").trim();
        if (!long && text && NOTICE_TEXT.some((re) => re.test(text))) return true;
      }
    }
    if (hasRegion && !NEVER_BY_ATTRIBUTE.has(name) && roleOf(attrs) !== "main" && !D.isVoid[D.nm[id]] && !D.sc[id] && isNamedFurniture(attrs)
        && match[i] > i && !holds(i)) return true;
    return false;
  };
  ord = yield* dropStage(D, ord, m, match, kept, G); m = ord.length;
  /* a skip link goes */
  match = pair(D, ord, m);
  const isSkip = (i) => {
    const id = ord[i];
    if (D.names[D.nm[id]] !== "a" || match[i] <= i) return false;
    const href = attrOf(attrsOf(D, id), "href");
    if (href === null || !href.trim().startsWith("#")) return false;
    let said = "";
    for (let j = i + 1; j < match[i] && j < i + 64 && said.length < 24; j++) {
      const t = ord[j];
      if (t === GAP) said += " ";
      else if (t >= 0 && (D.k[t] === K_TEXT)) said += D.text(t);
    }
    return /^skip to/i.test(decodeReferences(said).replace(/\s+/g, " ").trim());
  };
  ord = yield* dropStage(D, ord, m, match, isSkip, G); m = ord.length;
  /* the text: a block tag ends a paragraph, a break a line, a row's cells are told apart by a tab. R51 (fix round 10, cause 18b): a block inside a
     table cell (a `p`, a `div`, a list item) does not end the row; it is a gap between the cell's words, so a row stays one paragraph. */
  const out = [];
  let run = "", cells = 0, inCell = 0, cellWords = false;
  const flush = () => { if (run) { out.push(run.replace(/\s+/g, " ")); run = ""; } };
  for (let i = 0; i < m; i++) {
    G.tick(1); if (G.due()) yield;
    const id = ord[i];
    if (id === GAP) { run += " "; continue; }
    if (id === HR) { flush(); out.push("\n\n"); continue; }
    const k = D.k[id];
    if (k === K_TEXT) { const chunk = D.text(id); if (inCell > 0 && !cellWords && /\S/.test(chunk)) cellWords = true; run += chunk; continue; }
    if (k === K_GAP) { run += " "; continue; }
    const nm = D.nm[id], name = D.names[nm];
    const rowPart = name === "table" || name === "tr" || name === "thead" || name === "tbody" || name === "tfoot";
    if (inCell > 0 && D.block[nm] && !rowPart) { if (cellWords && run && !/\s$/.test(run)) run += " "; else if (cellWords && !run) run = " "; continue; }
    if (D.cell[nm]) run = run.replace(/\s+$/, "");
    flush();
    if (D.block[nm]) { out.push("\n\n"); if (name === "tr" || name === "table") { cells = 0; inCell = 0; } }
    else if (D.cell[nm]) { if (k === K_START) { inCell++; cellWords = false; if (cells++ > 0) out.push("\t"); } else if (inCell > 0) inCell--; }
    else if (k === K_START && name === "br") out.push("\n");
  }
  flush();
  return decodeReferences(out.join("")).replace(TEMPLATE_TOKEN, " ");
}

/* holdsProse for a block: the text of its own contents (its non-prose descendants out, its own tag no part of it) holds a sentence. A block costs its
   own tokens; the work of all the blocks asked is held to a count (a nesting of named blocks cannot make it quadratic), past which a block is kept. */
function makeHolds(D, ord, match, budget) {
  let spent = 0;
  return (i) => {
    const j = match[i];
    if (j <= i) return false;
    if (spent > budget) return true;
    let text = "";
    for (let q = i + 1; q < j; q++) {
      spent++;
      const id = ord[q];
      if (id < 0) { text += " "; continue; }
      const k = D.k[id];
      if (k === K_TEXT) text += D.text(id);
      else if (k === K_START && match[q] > q && NON_PROSE.has(D.names[D.nm[id]])) { q = match[q]; text += " "; }
      else text += " ";
      if (text.length > PROSE_SCAN_MAX) return true;
    }
    return SENTENCE.test(decodeReferences(text).replace(/\s+/g, " "));
  };
}

/* ---- the page in windows (R51, fix round 10; K5211) ---- */
/* A page past a whole read is never held as one string: it arrives as decoded windows (strings), and the same pass makes the same visible text from them.
   Two stages are fed window by window with a carry, and the rest (`stages`) is the whole pass over the tokens they leave:
   - `dropHeadStream`: R32's unclosed-head rule (`dropHead`) over the stream. The text before the first `<head` goes on at once; from the first `<head` the page's rest is held
     until `dropHeadStep` can say where the head ends (it answers NEED while the window ends inside what decides it), then goes on whole, the head cut as `dropHead` cuts it.
   - `streamTokenizer`: `tokenize` over the stream. A token is made only when its end is in hand (a text run ends at a `<`, a tag at its `>`, a comment at its `-->`); what is not
     finished is the carry, and a comment, a CDATA section or a raw-text element still open keeps only the few characters its end could straddle, its content being no token's. At
     the end of the page what is unfinished is read as `tokenize` reads the end (an unclosed tag is text, an unclosed comment or raw element runs to the end). The tokens carry their
     text and attributes as strings (`D.text`, `D.attr`), since the page is not there to slice. */
const NEED = Symbol("NEED_MORE");

function dropHeadStep(html, final) {
  const open = /<head\b(?:"[^"]*"|'[^']*'|[^'">])*>/i.exec(html);
  /* the text starts at the first candidate: a match elsewhere means the first did not (yet) match, and more of the page may make it */
  if (!open) return final ? html : NEED;
  if (!final && open.index > 0) return NEED;
  let at = open.index + open[0].length;
  const tag = /<(\/?)([A-Za-z][A-Za-z0-9:-]*)(?:"[^"]*"|'[^']*'|[^'">])*>/y;
  for (;;) {
    const ws = /^\s*/.exec(html.slice(at, at + 1024))[0].length;
    at += ws;
    if (at >= html.length) { if (!final) return NEED; break; }
    if (!final && html.length - at < 4 && "<!--".startsWith(html.slice(at))) return NEED;
    if (html.startsWith("<!--", at)) {
      const e = html.indexOf("-->", at + 4);
      if (e < 0) { if (!final) return NEED; at = html.length; continue; }
      at = e + 3; continue;
    }
    if (html[at] !== "<") break;
    tag.lastIndex = at;
    const m = tag.exec(html);
    if (!m) {
      if (!final) {
        const c = html.charCodeAt(at + 1), letter = (x) => (x >= 65 && x <= 90) || (x >= 97 && x <= 122);
        const definite = at + 1 < html.length && !(c === 47 || letter(c)) || (c === 47 && at + 2 < html.length && !letter(html.charCodeAt(at + 2)));
        if (!definite) return NEED;
      }
      break;
    }
    const name = m[2].toLowerCase();
    if (m[1] && name === "head") { at = tag.lastIndex; break; }
    if (m[1] || !HEAD_CONTENT.has(name)) break;
    at = tag.lastIndex;
    if (["title", "style", "script", "noscript", "template"].includes(name) && !m[0].endsWith("/>")) {
      const end = new RegExp(`</${name}\\s*>`, "gi");
      end.lastIndex = at;
      const e = end.exec(html);
      if (!e) { if (!final) return NEED; at = html.length; }
      else at = e.index + e[0].length;
    }
  }
  return html.slice(0, open.index) + " " + html.slice(at);
}

async function* dropHeadStream(chunks) {
  let state = "scan", carry = "", h = "";
  for await (const chunk of chunks) {
    if (state === "pass") { yield chunk; continue; }
    if (state === "scan") {
      const s = carry + chunk;
      carry = "";
      const re = /<head/gi;
      let p = -1, undecided = -1;
      for (let m = re.exec(s); m; m = re.exec(s)) {
        const next = s[m.index + 5];
        if (next === undefined) { undecided = m.index; break; }
        if (!/[A-Za-z0-9_]/.test(next)) { p = m.index; break; }
      }
      if (p < 0) {
        const keep = undecided >= 0 ? undecided : Math.max(0, s.length - 4);   /* a `<head` may straddle the window's end */
        if (keep > 0) yield s.slice(0, keep);
        carry = s.slice(keep);
        continue;
      }
      if (p > 0) yield s.slice(0, p);
      h = s.slice(p); state = "head";
    } else h += chunk;
    const r = dropHeadStep(h, false);
    if (r !== NEED) { yield r; state = "pass"; h = ""; }
  }
  if (state === "scan" && carry) yield carry;
  else if (state === "head") yield dropHeadStep(h, true);
}

function streamTokenizer() {
  let cap = 4096;
  const D = { n: 0, k: new Uint8Array(cap), nm: new Int32Array(cap), sc: new Uint8Array(cap), names: [], nameId: new Map(), isVoid: [], block: [], cell: [],
              tx: [], at: [] };
  const intern = (name) => {
    let id = D.nameId.get(name);
    if (id === undefined) {
      id = D.names.length; D.names.push(name); D.nameId.set(name, id);
      const stem = /^[A-Za-z0-9_]*/.exec(name)[0];
      D.isVoid.push(VOID.has(name)); D.block.push(BLOCK.has(stem)); D.cell.push(CELL.has(stem));
    }
    return id;
  };
  D.intern = intern; D.HR = intern("hr");
  D.text = (id) => D.tx[id];
  D.attr = (id) => D.at[id] ?? "";
  const push = (k, nm = 0, sc = 0, text = null, attrs = null) => {
    if (D.n === cap) {
      cap *= 2;
      const k2 = new Uint8Array(cap), nm2 = new Int32Array(cap), sc2 = new Uint8Array(cap);
      k2.set(D.k); nm2.set(D.nm); sc2.set(D.sc); D.k = k2; D.nm = nm2; D.sc = sc2;
    }
    const i = D.n++;
    D.k[i] = k; D.nm[i] = nm; D.sc[i] = sc;
    if (text !== null) D.tx[i] = text;
    if (attrs) D.at[i] = attrs;
  };
  let carry = "", gap = null;
  const pushGap = () => push(K_GAP);
  const pushText = (t) => push(K_TEXT, 0, 0, t);
  function feed(chunk, final) {
    let buf;
    if (gap) {
      const s = gap.tail + chunk;
      let p = -1, len = 0;
      if (gap.raw) { gap.raw.lastIndex = 0; const e = gap.raw.exec(s); if (e) { p = e.index; len = e[0].length; } }
      else { p = s.indexOf(gap.end); len = gap.end.length; }
      if (p < 0) {
        if (final) { pushGap(); gap = null; return; }
        gap.tail = gap.raw ? (s.lastIndexOf("<") >= 0 ? s.slice(s.lastIndexOf("<")) : "") : s.slice(Math.max(0, s.length - (gap.end.length - 1)));
        return;
      }
      pushGap(); gap = null;
      buf = s.slice(p + len);
    } else buf = carry + chunk;
    carry = "";
    const n = buf.length;
    let i = 0;
    while (i < n) {
      const at = buf.indexOf("<", i);
      if (at < 0) { if (final) pushText(buf.slice(i)); else carry = buf.slice(i); break; }
      if (at > i) pushText(buf.slice(i, at));
      const c = buf.charCodeAt(at + 1);
      if (!final && (at + 1 >= n || (c === 33 && n - at < 9))) { carry = buf.slice(at); break; }
      if (c === 33) {
        const comment = buf.startsWith("<!--", at), cdata = !comment && buf.startsWith("<![CDATA[", at);
        if (comment || cdata) {
          const end = comment ? "-->" : "]]>", from = at + (comment ? 4 : 9);
          const e = buf.indexOf(end, from);
          if (e >= 0) { pushGap(); i = e + 3; continue; }
          if (final) { pushGap(); break; }
          gap = { end, tail: buf.slice(Math.max(from, n - 2)) };
          break;
        }
      }
      if (c === 33 || c === 63) {
        const e = buf.indexOf(">", at + 2);
        if (e >= 0) { pushGap(); i = e + 1; continue; }
        if (!final) { carry = buf.slice(at); break; }
        pushText("<"); i = at + 1; continue;
      }
      const closing = c === 47;
      NAME_RE.lastIndex = at + (closing ? 2 : 1);
      const m = (closing || (c >= 65 && c <= 90) || (c >= 97 && c <= 122)) ? NAME_RE.exec(buf) : null;
      if (!final && ((m && NAME_RE.lastIndex >= n) || (!m && closing && at + 2 >= n))) { carry = buf.slice(at); break; }
      if (!m) { pushText("<"); i = at + 1; continue; }
      const nameEnd = NAME_RE.lastIndex;
      const gt = tagEnd(buf, nameEnd);
      if (gt < 0) { if (final) pushText(buf.slice(at)); else carry = buf.slice(at); break; }
      const name = m[0].toLowerCase();
      const nm = intern(name);
      const selfClosed = buf.charCodeAt(gt - 1) === 47 && gt - 1 >= nameEnd ? 1 : 0;
      if (closing) { push(K_END, nm); i = gt + 1; continue; }
      if (RAW.has(name)) {
        const re = new RegExp(`</${name}\\s*>`, "gi");
        re.lastIndex = gt + 1;
        const e = re.exec(buf);
        if (e) { pushGap(); i = e.index + e[0].length; continue; }
        if (final) { pushGap(); break; }
        const lt = buf.lastIndexOf("<");
        gap = { raw: new RegExp(`</${name}\\s*>`, "i"), tail: lt > gt ? buf.slice(lt) : "" };
        break;
      }
      push(K_START, nm, selfClosed, null, gt > nameEnd ? buf.slice(nameEnd, gt) : null);
      i = gt + 1;
    }
  }
  return { feed, doc: () => D };
}

/* the visible text of a page that arrives as decoded windows (an async iterable of strings), the same text `visibleTextOfHtml` makes of the whole */
export async function visibleTextOfHtmlStream(chunks, { yieldNow, stretch = HTML_STRETCH, stats = null } = {}) {
  const T = streamTokenizer();
  for await (const c of dropHeadStream(chunks)) {
    T.feed(c, false);
    if (typeof yieldNow === "function") await yieldNow();
  }
  T.feed("", true);
  const G = guard(stretch, stats);
  const it = stages(T.doc(), G);
  let r = it.next();
  while (!r.done) { if (typeof yieldNow === "function") await yieldNow(); r = it.next(); }
  G.close();
  return r.value;
}

/* ---- runners ---- */
const guard = (stretch, stats) => {
  let since = 0, total = 0;
  return { tick(n) { since += n; total += n; }, due() { if (since < stretch) return false; if (stats) stats.longest = Math.max(stats.longest || 0, since); since = 0; return true; },
           close() { if (stats) { stats.longest = Math.max(stats.longest || 0, since); stats.total = total; } } };
};
export const HTML_STRETCH = 65536;
/* the visible text of an HTML page, synchronously */
export function visibleTextOfHtml(html, { stats = null } = {}) {
  const G = guard(Infinity, stats);
  const it = pass(String(html), G);
  let r = it.next();
  while (!r.done) r = it.next();
  G.close();
  return r.value;
}
/* the same, the turn given back (`yieldNow`) after every `stretch` tokens walked; `stats.longest` is the most tokens walked between two yields */
export async function visibleTextOfHtmlYielding(html, { yieldNow, stretch = HTML_STRETCH, stats = null } = {}) {
  const G = guard(stretch, stats);
  const it = pass(String(html), G);
  let r = it.next();
  while (!r.done) { if (typeof yieldNow === "function") await yieldNow(); r = it.next(); }
  G.close();
  return r.value;
}
