/* interface-shell's tests: a small document stand-in (draft-T46-interface §7 T2 (a): one shared stand-in, owned here and
   imported by the screen modules' tests; no new dependency). It parses the HTML the shell and the screens draw into a
   tree, answers the selectors they use (tags, `#id`, `.class`, `[attr]`, `[attr="v"]`, compounds, descendant and child
   combinators, comma lists), serializes `innerHTML` back, bubbles events, and reflects the form properties a page reads
   (`value`, `checked`, `files`, `hidden`). It runs no script and loads nothing. */

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const RAW = new Set(["script", "style", "textarea", "title"]);
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export const decode = (s) => String(s).replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) =>
  e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e] ?? m);
const escText = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const escAttr = (s) => String(s).replace(/[&"<>]/g, (c) => ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" }[c]));

class Node {
  constructor(doc) { this.ownerDocument = doc; this.parentNode = null; this.childNodes = []; this.listeners = {}; }
  get parentElement() { return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null; }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  removeEventListener(t, f) { this.listeners[t] = (this.listeners[t] || []).filter((x) => x !== f); }
  contains(n) { for (let x = n; x; x = x.parentNode) if (x === this) return true; return false; }
  get textContent() { return this.childNodes.map((c) => c.textContent).join(""); }
  set textContent(v) { this.childNodes.forEach((c) => (c.parentNode = null)); this.childNodes = []; if (v !== "") this.append(new Text(this.ownerDocument, String(v))); }
  append(...ns) { for (const n of ns) { if (n.parentNode) n.parentNode.removeChild(n); n.parentNode = this; this.childNodes.push(n); } }
  appendChild(n) { this.append(n); return n; }
  insertBefore(n, ref) {
    if (!ref) return this.appendChild(n);
    if (n.parentNode) n.parentNode.removeChild(n);
    n.parentNode = this;
    this.childNodes.splice(this.childNodes.indexOf(ref), 0, n);
    return n;
  }
  removeChild(n) { this.childNodes = this.childNodes.filter((c) => c !== n); n.parentNode = null; return n; }
  get children() { return this.childNodes.filter((c) => c.nodeType === 1); }
  get nextElementSibling() { const s = this.parentNode ? this.parentNode.children : []; return s[s.indexOf(this) + 1] || null; }
  get previousElementSibling() { const s = this.parentNode ? this.parentNode.children : []; return s[s.indexOf(this) - 1] || null; }
  *descendants() { for (const c of this.childNodes) { if (c.nodeType === 1) { yield c; yield* c.descendants(); } } }
  querySelectorAll(sel) { const m = compile(sel); return [...this.descendants()].filter((e) => m(e)); }
  querySelector(sel) { const m = compile(sel); for (const e of this.descendants()) if (m(e)) return e; return null; }
  dispatchEvent(ev) {
    ev.target ||= this;
    const path = [];
    for (let x = this; x; x = x.parentNode) path.push(x);
    if (this.ownerDocument && this.ownerDocument.defaultView && path[path.length - 1] === this.ownerDocument) path.push(this.ownerDocument.defaultView);
    const bubbles = ev.bubbles !== false;
    for (const x of bubbles ? path : [this]) {
      ev.currentTarget = x;
      for (const f of [...((x.listeners || {})[ev.type] || [])]) f.call(x, ev);
      if (ev._stop) break;
    }
    return !ev.defaultPrevented;
  }
}
class Text extends Node {
  constructor(doc, data) { super(doc); this.nodeType = 3; this.data = data; }
  get textContent() { return this.data; }
  set textContent(v) { this.data = String(v); }
  get nodeValue() { return this.data; }
}

export class Element extends Node {
  constructor(doc, tag) { super(doc); this.nodeType = 1; this.localName = tag.toLowerCase(); this.attrs = new Map(); this._props = {}; this.style = makeStyle(); }
  get tagName() { return this.localName.toUpperCase(); }
  getAttribute(n) { n = n.toLowerCase(); return this.attrs.has(n) ? this.attrs.get(n) : null; }
  setAttribute(n, v) { this.attrs.set(n.toLowerCase(), String(v)); }
  removeAttribute(n) { this.attrs.delete(n.toLowerCase()); }
  hasAttribute(n) { return this.attrs.has(n.toLowerCase()); }
  get id() { return this.getAttribute("id") || ""; }
  set id(v) { this.setAttribute("id", v); }
  get className() { return this.getAttribute("class") || ""; }
  set className(v) { this.setAttribute("class", v); }
  get classList() {
    const el = this;
    const list = () => el.className.split(/\s+/).filter(Boolean);
    return {
      contains: (c) => list().includes(c),
      add: (c) => { if (!list().includes(c)) el.className = [...list(), c].join(" "); },
      remove: (c) => { el.className = list().filter((x) => x !== c).join(" "); },
      toggle: (c, on) => { const has = list().includes(c); if (on ?? !has) { if (!has) el.className = [...list(), c].join(" "); } else el.className = list().filter((x) => x !== c).join(" "); },
    };
  }
  get dataset() {
    const el = this;
    return new Proxy({}, {
      get: (_, k) => el.getAttribute("data-" + String(k).replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())) ?? undefined,
      set: (_, k, v) => { el.setAttribute("data-" + String(k).replace(/[A-Z]/g, (c) => "-" + c.toLowerCase()), v); return true; },
      has: (_, k) => el.hasAttribute("data-" + String(k).replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())),
      ownKeys: () => [...el.attrs.keys()].filter((a) => a.startsWith("data-")).map((a) => a.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())),
      getOwnPropertyDescriptor: (_, k) => ({ enumerable: true, configurable: true, value: el.getAttribute("data-" + String(k).replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())) }),
    });
  }
  get hidden() { return this.hasAttribute("hidden"); }
  set hidden(v) { if (v) this.setAttribute("hidden", ""); else this.removeAttribute("hidden"); }
  get type() { return (this.getAttribute("type") || (this.localName === "input" ? "text" : this.localName === "button" ? "submit" : "")).toLowerCase(); }
  get value() {
    if ("value" in this._props) return this._props.value;
    if (this.localName === "textarea") return this.textContent;
    if (this.localName === "select") { const o = this.querySelector("option[selected]") || this.querySelector("option"); return o ? o.value : ""; }
    if (this.localName === "option") return this.getAttribute("value") ?? this.textContent;
    return this.getAttribute("value") ?? (this.type === "checkbox" || this.type === "radio" ? "on" : "");
  }
  set value(v) { this._props.value = String(v); }
  get checked() { return "checked" in this._props ? this._props.checked : this.hasAttribute("checked"); }
  set checked(v) { this._props.checked = !!v; }
  get files() { return this._props.files || []; }
  set files(v) { this._props.files = v; }
  get disabled() { return this.hasAttribute("disabled"); }
  get href() { return this.getAttribute("href") || ""; }
  get innerHTML() { return this.childNodes.map(serialize).join(""); }
  set innerHTML(h) { this.childNodes.forEach((c) => (c.parentNode = null)); this.childNodes = []; parseInto(this, String(h)); }
  get outerHTML() { return serialize(this); }
  matches(sel) { return compile(sel)(this); }
  closest(sel) { const m = compile(sel); for (let x = this; x && x.nodeType === 1; x = x.parentNode) if (m(x)) return x; return null; }
  /* a focus without `preventScroll` scrolls the element into view, as a browser's does (recorded as `scrolledTo`, like `scrollIntoView`) */
  focus(o) { const d = this.ownerDocument; const was = d.activeElement; if (!(o && o.preventScroll)) d.scrolledTo = this; if (was === this) return; d.activeElement = this;
    if (was && was !== d.body) was.dispatchEvent(new Event("focusout", { relatedTarget: this })); this.dispatchEvent(new Event("focusin")); }
  blur() { const d = this.ownerDocument; if (d.activeElement === this) { d.activeElement = d.body; this.dispatchEvent(new Event("focusout")); } }
  click() { this.dispatchEvent(new Event("click")); }
  getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }; }
  scrollTo() {}
  scrollIntoView() { this.ownerDocument.scrolledTo = this; }
}
function makeStyle() { const s = {}; Object.defineProperty(s, "setProperty", { value: (k, v) => { s[k] = v; } }); return s; }

export class Event {
  constructor(type, init = {}) { Object.assign(this, init); this.type = type; this.defaultPrevented = false; this._stop = false; }
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() { this._stop = true; }
}

function serialize(n) {
  if (n.nodeType === 3) return n.parentNode && RAW.has(n.parentNode.localName) ? n.data : escText(n.data);
  const attrs = [...n.attrs].map(([k, v]) => (v === "" && /^(hidden|checked|selected|disabled|data-nav|multiple|required)$/.test(k) ? " " + k : ` ${k}="${escAttr(v)}"`)).join("");
  return `<${n.localName}${attrs}>` + (VOID.has(n.localName) ? "" : n.childNodes.map(serialize).join("") + `</${n.localName}>`);
}

/* HTML as the shell writes it: well-formed tags, quoted or bare attributes, entities, void and raw-text elements. */
export function parseInto(parent, html) {
  const doc = parent.ownerDocument;
  const stack = [parent];
  const top = () => stack[stack.length - 1];
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt < 0) { top().append(new Text(doc, decode(html.slice(i)))); break; }
    if (lt > i) top().append(new Text(doc, decode(html.slice(i, lt))));
    if (html.startsWith("<!--", lt)) { const e = html.indexOf("-->", lt); i = e < 0 ? html.length : e + 3; continue; }
    if (html.startsWith("<!", lt)) { i = html.indexOf(">", lt) + 1; continue; }
    if (html[lt + 1] === "/") {
      const gt = html.indexOf(">", lt);
      const tag = html.slice(lt + 2, gt).trim().toLowerCase();
      for (let k = stack.length - 1; k > 0; k--) if (stack[k].localName === tag) { stack.length = k; break; }
      i = gt + 1;
      continue;
    }
    const m = /^<([a-zA-Z][\w-]*)/.exec(html.slice(lt));
    if (!m) { top().append(new Text(doc, "<")); i = lt + 1; continue; }
    const el = new Element(doc, m[1]);
    let j = lt + m[0].length;
    for (;;) {
      const a = /^\s*([^\s=/>"']+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/.exec(html.slice(j));
      if (!a || !a[1]) break;
      el.setAttribute(a[1], decode(a[3] ?? a[4] ?? a[5] ?? ""));
      j += a[0].length;
    }
    const gt = html.indexOf(">", j);
    const selfClose = html[gt - 1] === "/";
    i = gt + 1;
    top().append(el);
    if (RAW.has(el.localName)) {
      const end = html.toLowerCase().indexOf("</" + el.localName, i);
      const raw = html.slice(i, end < 0 ? html.length : end);
      if (raw) el.append(new Text(doc, el.localName === "textarea" || el.localName === "title" ? decode(raw) : raw));
      i = end < 0 ? html.length : html.indexOf(">", end) + 1;
      continue;
    }
    if (!VOID.has(el.localName) && !selfClose) stack.push(el);
  }
}

/* selectors: a comma list of compounds joined by descendant (" ") or child (">") combinators */
const cache = new Map();
function compile(sel) {
  if (cache.has(sel)) return cache.get(sel);
  const alts = splitTop(sel, ",").map((s) => s.trim()).filter(Boolean).map(chain);
  const f = (el) => alts.some((m) => m(el));
  cache.set(sel, f);
  return f;
}
function splitTop(s, ch) {
  const out = []; let depth = 0, q = null, cur = "";
  for (const c of s) {
    if (q) { if (c === q) q = null; cur += c; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === "[") depth++; else if (c === "]") depth--;
    if (c === ch && depth === 0) { out.push(cur); cur = ""; } else cur += c;
  }
  out.push(cur);
  return out;
}
function chain(sel) {
  const parts = [];
  let cur = "", depth = 0, q = null;
  for (const c of sel.replace(/\s*>\s*/g, " > ")) {
    if (q) { if (c === q) q = null; cur += c; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === "[") depth++; else if (c === "]") depth--;
    if (/\s/.test(c) && depth === 0) { if (cur) parts.push(cur); cur = ""; } else cur += c;
  }
  if (cur) parts.push(cur);
  const steps = [];
  let comb = " ";
  for (const p of parts) { if (p === ">") { comb = ">"; continue; } steps.push({ comb, m: compound(p) }); comb = " "; }
  return (el) => {
    const match = (e, k) => {
      if (!steps[k].m(e)) return false;
      if (k === 0) return true;
      if (steps[k].comb === ">") return !!e.parentElement && match(e.parentElement, k - 1);
      for (let p = e.parentElement; p; p = p.parentElement) if (match(p, k - 1)) return true;
      return false;
    };
    return match(el, steps.length - 1);
  };
}
function compound(s) {
  const tests = [];
  const re = /([a-zA-Z][\w-]*|\*)|#([\w-]+)|\.([\w-]+)|\[\s*([\w-]+)\s*(?:([~^$*|]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+)))?\s*\]|:not\(([^)]*)\)|:(checked|disabled)/g;
  let m;
  while ((m = re.exec(s))) {
    if (m[1]) { const t = m[1].toLowerCase(); if (t !== "*") tests.push((e) => e.localName === t); }
    else if (m[2]) { const id = m[2]; tests.push((e) => e.getAttribute("id") === id); }
    else if (m[3]) { const c = m[3]; tests.push((e) => e.classList.contains(c)); }
    else if (m[4]) {
      const a = m[4], op = m[5], v = m[6] ?? m[7] ?? m[8];
      tests.push((e) => { const x = e.getAttribute(a); if (x === null) return false; if (!op) return true;
        return op === "=" ? x === v : op === "^=" ? x.startsWith(v) : op === "$=" ? x.endsWith(v) : op === "*=" ? x.includes(v) : op === "~=" ? x.split(/\s+/).includes(v) : x === v || x.startsWith(v + "-"); });
    } else if (m[9]) { const inner = compile(m[9]); tests.push((e) => !inner(e)); }
    else if (m[10] === "checked") tests.push((e) => e.checked);
    else if (m[10] === "disabled") tests.push((e) => e.disabled);
  }
  return (e) => tests.every((t) => t(e));
}

export class Document extends Node {
  constructor() {
    super(null);
    this.ownerDocument = this;
    this.nodeType = 9;
    this.documentElement = new Element(this, "html");
    this.append(this.documentElement);
    this.head = new Element(this, "head");
    this.body = new Element(this, "body");
    this.documentElement.append(this.head, this.body);
    this.activeElement = this.body;
    this.title = "";
    this.defaultView = null;
  }
  getElementById(id) { for (const e of this.descendants()) if (e.getAttribute("id") === String(id)) return e; return null; }
  createElement(t) { return new Element(this, t); }
  createTextNode(t) { return new Text(this, t); }
}

/** A document holding `html`'s body (the served page), with its scripts kept as text. */
export function documentOf(html) {
  const d = new Document();
  const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html);
  const lang = /<html[^>]*\blang="([^"]*)"/i.exec(html);
  if (lang) d.documentElement.setAttribute("lang", lang[1]);
  /* the page's version, named in its head (R5, fix round 3) */
  const meta = /<meta\s+name="cs-version"\s+content="([^"]*)"/i.exec(html);
  if (meta) { const m = d.createElement("meta"); m.setAttribute("name", "cs-version"); m.setAttribute("content", meta[1]); d.head.append(m); }
  d.body.innerHTML = body ? body[1] : html;
  return d;
}

/** Every text node under `root`, with the element it sits in. */
export function textNodes(root) {
  const out = [];
  const walk = (n) => { for (const c of n.childNodes) { if (c.nodeType === 3) out.push(c); else if (c.nodeType === 1 && !["script", "style"].includes(c.localName)) walk(c); } };
  walk(root);
  return out;
}
