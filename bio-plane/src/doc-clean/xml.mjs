/* doc-clean: R6's edits to one XML part, made in one pass over its bytes (R4: a part is never held as a string, and
 * the copy is never larger than the part, so a 32 MiB `document.xml` costs twice its size and no more).
 *
 * The pass is linear (R11): every search is bounded by the tag limit (`boundOf("xml", "tag")`) or runs forward from where
 * the last one ended, so the bytes scanned are at most 4n for a part of n bytes, however the markup is built. They are
 * counted in `scan.scanned`, a count and not a time (R-CLOCK); every 2^16 tokens the pass awaits `scan.yieldNow()`. A
 * tag longer than the limit refuses the document `DOCUMENT_UNREADABLE`, naming the part.
 *
 * `await editXml(bytes, rules, {inPlace, where, scan})` answers the part's bytes with the rules applied, or the same
 * `bytes` when nothing changed. `where` names the part in a refusal; `scan` is `newScan()`'s counters.
 * `rules` names elements and attributes as `[ns, local]`, `ns` a key of `NS` (resolved through the prefixes the part
 * declares, never assumed) or `""` for an unqualified attribute:
 *   remove: elements removed, content and all;     empty: elements whose content is removed;
 *   attrs:  `{el, attr, value, when}`: the attribute `attr` (on the element `el`, or on any; whose value `when`
 *           accepts, when given) set to `""`, or removed when `value` is null;
 *   drop:   `{el, when}`: elements removed whose attributes (a map of name to value) `when` accepts;
 *   removeNs: namespaces whose every element (content and all) and attribute is removed.
 * Every byte outside an edited tag or a removed content is copied as it was. A part in UTF-16 is edited as UTF-8 and
 * written back as UTF-16. Edits only shorten, so a part can be edited in its own buffer. */
import { boundOf } from "../read-bounds.mjs";
import { CleanRefusal } from "./refusal.mjs";
import { localize } from "../setup-words/index.mjs";

/** @typedef {"dc" | "dcterms" | "cp" | "ep" | "w" | "w15" | "w16cex" | "p" | "p188" | "x" | "xtc" | "x15ac" | "rel" | "ct" | "meta" | "r" | "editor" | "manifest"} NsKey
 *  a key of `NS` */
/** An element's or attribute's name in a rule: `[ns, local]`, `ns` a key of `NS`, or `""` for an unqualified attribute.
 *  @typedef {[string, string]} RuleName */
/** A name as the part spells it, resolved: its namespace's key (`null` when the prefix names none of `NS`), its local name.
 *  @typedef {[string | null, string]} SeenName */
/** @typedef {{ el?: RuleName, attr: RuleName, value: string | null, when?: (value: string) => boolean }} AttrRule
 *  the attribute `attr` (on `el`, or on any; whose value `when` accepts) set to `""`, or removed when `value` is null */
/** @typedef {(attrs: Map<string, string>) => boolean} DropWhen
 *  whether an element with these attributes (name to value; a repeated name its last value) is removed */
/** @typedef {{ el: RuleName, when: DropWhen }} DropRule  elements `el` removed whose attributes `when` accepts */
/** @typedef {{ remove?: RuleName[], empty?: RuleName[], attrs?: AttrRule[], drop?: DropRule[], removeNs?: string[] }} XmlRules */
/** The counters of one clean (R11).
 *  @typedef {{ scanned: number, tokens: number, yields: number, yieldNow: () => Promise<unknown> }} Scan */
/** @typedef {{ inPlace?: boolean, where?: string, scan?: Scan | undefined }} EditOptions */
/** One attribute of a start tag: where its name starts, the name, the quote, where its value starts and ends.
 *  @typedef {{ ns: number, name: string, q: number, vs: number, ve: number }} Attr */
/** @typedef {{ name: string, attrs: Attr[], end: number, self: boolean }} StartTag */
/** @typedef {{ name: string, depth: number, keepEnd: boolean }} Skip */

/** @param {string} s */
const OOXML = (s) => [`http://schemas.openxmlformats.org/${s}`];
export const NS = {
  dc: ["http://purl.org/dc/elements/1.1/"],
  dcterms: ["http://purl.org/dc/terms/"],
  cp: ["http://schemas.openxmlformats.org/package/2006/metadata/core-properties"],
  ep: [...OOXML("officeDocument/2006/extended-properties"), "http://purl.oclc.org/ooxml/officeDocument/extendedProperties"],
  w: [...OOXML("wordprocessingml/2006/main"), "http://purl.oclc.org/ooxml/wordprocessingml/main"],
  w15: ["http://schemas.microsoft.com/office/word/2012/wordml"],
  w16cex: ["http://schemas.microsoft.com/office/word/2018/wordml/cex"],
  p: [...OOXML("presentationml/2006/main"), "http://purl.oclc.org/ooxml/presentationml/main"],
  p188: ["http://schemas.microsoft.com/office/powerpoint/2018/8/main"],
  x: [...OOXML("spreadsheetml/2006/main"), "http://purl.oclc.org/ooxml/spreadsheetml/main"],
  xtc: ["http://schemas.microsoft.com/office/spreadsheetml/2018/threadedcomments"],
  x15ac: ["http://schemas.microsoft.com/office/spreadsheetml/2010/11/ac"],
  rel: ["http://schemas.openxmlformats.org/package/2006/relationships"],
  ct: ["http://schemas.openxmlformats.org/package/2006/content-types"],
  meta: ["urn:oasis:names:tc:opendocument:xmlns:meta:1.0"],
  r: [...OOXML("officeDocument/2006/relationships"), "http://purl.oclc.org/ooxml/officeDocument/relationships"],
  editor: ["http://www.inkscape.org/namespaces/inkscape", "http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd",
    ...["AdobeIllustrator/10.0", "AdobeSVGViewerExtensions/3.0", "Extensibility/1.0", "Graphs/1.0", "Variables/1.0", "SaveForWeb/1.0",
      "ImageReplacement/1.0", "Flows/1.0", "GenericCustomNamespace/1.0", "XPath/1.0"].map((n) => `http://ns.adobe.com/${n}/`)],
  manifest: ["urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"],
};
/** @type {NsKey[]} */
const NS_KEYS = ["dc", "dcterms", "cp", "ep", "w", "w15", "w16cex", "p", "p188", "x", "xtc", "x15ac", "rel", "ct", "meta", "r", "editor", "manifest"];
/** @type {Map<string, string>} */
const URI_NS = new Map(NS_KEYS.flatMap((k) => NS[k].map((u) => /** @type {[string, string]} */ ([u, k]))));

const LT = 0x3c, GT = 0x3e, SLASH = 0x2f, EQ = 0x3d, Q1 = 0x22, Q2 = 0x27, LBRACKET = 0x5b;
/** @param {number | undefined} c */
const isWs = (c) => c === 0x20 || c === 0x0a || c === 0x0d || c === 0x09;
/** @param {Uint8Array} d @param {number} a @param {number} b */
const str = (d, a, b) => String.fromCharCode(...d.subarray(a, b));

/** The longest a tag may be (R11). */
export const TAG_MAX = boundOf("xml", "tag");
/** The pass yields after this many tokens (R11). */
const YIELD_TOKENS = 1 << 16;

/** The counters of one clean: bytes scanned, tokens walked, yields made; `yieldNow` is what the caller lets the pass
 *  await (default: a turn of the microtask queue). */
/** @param {() => Promise<unknown>} [yieldNow]
 *  @returns {Scan} */
export const newScan = (yieldNow = () => Promise.resolve()) => ({ scanned: 0, tokens: 0, yields: 0, yieldNow });

/** @param {string} where */
const tooLong = (where) => new CleanRefusal("DOCUMENT_UNREADABLE",
  localize("doc-clean.xml.where_has_a_tag_of_more", "{where} has a tag of more than {max} bytes", { where: String(where), max: String(TAG_MAX) }));

/** A start tag at `lt`: its name, its attributes (`{ns, name, q, vs, ve}`: where the name starts, the name, the quote,
 *  where the value starts and ends), where it ends, whether it closes itself. `null` when it does not end. `stop` is
 *  where the tag must have ended by; running past it with bytes to spare throws `over`. */
/** @param {Uint8Array} d @param {number} lt @param {number} stop @param {() => CleanRefusal} over
 *  @returns {StartTag | null} */
function startTag(d, lt, stop, over) {
  const cap = stop < d.length ? over : null; // past `stop` the tag is too long only when the part goes on
  const end = Math.min(d.length, stop);
  const fail = () => { if (cap) throw cap(); return null; };
  let i = lt + 1;
  while (i < end && !isWs(d[i]) && d[i] !== GT && d[i] !== SLASH) i++;
  const name = str(d, lt + 1, i);
  /** @type {Attr[]} */
  const attrs = [];
  for (;;) {
    while (i < end && isWs(d[i])) i++;
    if (i >= end) return fail();
    if (d[i] === GT) return { name, attrs, end: i + 1, self: false };
    if (d[i] === SLASH && i + 1 < end && d[i + 1] === GT) return { name, attrs, end: i + 2, self: true };
    const ns = i;
    while (i < end && d[i] !== EQ && !isWs(d[i]) && d[i] !== GT) i++;
    const an = str(d, ns, i);
    while (i < end && isWs(d[i])) i++;
    if (i >= end) return fail();
    if (d[i] !== EQ) return null;
    i++;
    while (i < end && isWs(d[i])) i++;
    if (i >= end) return fail();
    const q = d[i];
    if (q !== Q1 && q !== Q2) return null;
    const ve = d.subarray(0, end).indexOf(q, i + 1);
    if (ve < 0) return fail();
    attrs.push({ ns, name: an, q, vs: i + 1, ve });
    i = ve + 1;
  }
}

/** @param {string} qn @returns {[string, string]} */
const split = (qn) => { const c = qn.indexOf(":"); return c < 0 ? ["", qn] : [qn.slice(0, c), qn.slice(c + 1)]; };
/** @param {RuleName | SeenName} name */
const key = ([ns, local]) => `${ns} ${local}`;

/** Apply `rules` to an XML part's bytes; with `inPlace`, into the same buffer (the copy is never longer than what it
 *  has read, so it never overtakes it). */
/** @param {Uint8Array} bytes @param {XmlRules} rules @param {EditOptions} [options]
 *  @returns {Promise<Uint8Array>} */
export async function editXml(bytes, rules, { inPlace = false, where = "?", scan = newScan() } = {}) {
  const le = bytes[0] === 0xff && bytes[1] === 0xfe, be = bytes[0] === 0xfe && bytes[1] === 0xff;
  if (le || be) {
    const utf8 = new TextEncoder().encode(new TextDecoder(le ? "utf-16le" : "utf-16be").decode(bytes.subarray(2)));
    const out = await edit(utf8, rules, true, where, scan);
    if (out === utf8) return bytes;
    const s = new TextDecoder().decode(out), w = new Uint8Array(2 + 2 * s.length);
    w.set(bytes.subarray(0, 2));
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      w[2 + 2 * i + (le ? 0 : 1)] = c & 255;
      w[2 + 2 * i + (le ? 1 : 0)] = c >> 8;
    }
    return w;
  }
  return edit(bytes, rules, inPlace, where, scan);
}

/** @param {Uint8Array} d @param {XmlRules} rules @param {boolean} inPlace @param {string} where @param {Scan} scan
 *  @returns {Promise<Uint8Array>} */
async function edit(d, { remove = [], empty = [], attrs = [], drop = [], removeNs = [] }, inPlace, where, scan) {
  /** @type {Set<string | null>} */
  const wholeNs = new Set(removeNs);
  const removeSet = new Set(remove.map(key)), emptySet = new Set(empty.map(key));
  const dropBy = new Map(drop.map((r) => /** @type {[string, DropWhen]} */ ([key(r.el), r.when])));
  const locals = new Set([...remove, ...empty, ...drop.map((r) => r.el), ...attrs.flatMap((r) => { const el = r.el; return el ? [el] : []; })].map((x) => x[1]));
  const attrLocals = new Set(attrs.map((r) => r.attr[1]));
  /** @type {Map<string, string>} */
  const prefixes = new Map(null);
  /** @param {string} prefix @returns {string | null} */
  const nsOf = (prefix) => { const uri = prefixes.get(prefix); return (uri === undefined ? undefined : URI_NS.get(uri)) ?? null; };
  const out = inPlace ? d : new Uint8Array(d.length);
  let w = 0, i = 0, changed = false;
  /** @type {Skip | null} */
  let skip = null;
  const over = () => tooLong(where);
  /** @param {number} a @param {number} b */
  const copy = (a, b) => {
    if (skip || b <= a) return;
    if (inPlace) { if (w !== a) d.copyWithin(w, a, b); } else out.set(d.subarray(a, b), w);
    w += b - a;
  };
  /** @param {string} s */
  const put = (s) => { for (let k = 0; k < s.length; k++) out[w++] = s.charCodeAt(k); };
  /* every search below is counted: `from` to where it stopped */
  /** @param {number} byte @param {number} from @param {number} [to] */
  const idx = (byte, from, to = d.length) => {
    const at = d.subarray(from, to).indexOf(byte);
    scan.scanned += at < 0 ? to - from : at + 1;
    return at < 0 ? -1 : from + at;
  };
  /* the end of the first `pat` at or after `from`, or -1 */
  /** @param {string} pat @param {number} from */
  const until = (pat, from) => {
    const first = pat.charCodeAt(0);
    for (let at = idx(first, from); at >= 0; at = idx(first, at + 1)) {
      let k = 1;
      while (k < pat.length && d[at + k] === pat.charCodeAt(k)) k++;
      if (k === pat.length) return at + pat.length;
    }
    return -1;
  };
  while (i < d.length) {
    const lt = idx(LT, i);
    if (lt < 0) { copy(i, d.length); break; }
    copy(i, lt);
    if (++scan.tokens % YIELD_TOKENS === 0) { scan.yields++; await scan.yieldNow(); }
    const stop = lt + TAG_MAX; // a tag that has not ended by here is too long
    const c1 = d[lt + 1];
    let end = 0;
    if (c1 === 0x21 && d[lt + 2] === 0x2d && d[lt + 3] === 0x2d) end = until("-->", lt + 4);
    else if (c1 === 0x21 && d[lt + 2] === LBRACKET) end = until("]]>", lt + 3);
    else if (c1 === 0x3f) end = until("?>", lt + 2);
    else if (c1 === 0x21) {
      const room = Math.min(d.length, stop), gt = idx(GT, lt, room), sub = idx(LBRACKET, lt, gt >= 0 ? gt : room);
      if (sub >= 0) end = until("]>", sub);
      else if (gt >= 0) end = gt + 1;
      else if (room < d.length) throw over();
      else end = -1;
    } else if (c1 === SLASH) {
      const room = Math.min(d.length, stop), gt = idx(GT, lt, room);
      if (gt < 0 && room < d.length) throw over();
      end = gt < 0 ? -1 : gt + 1;
      const sk = skip;
      if (end > 0 && sk && str(d, lt + 2, gt).trim() === sk.name && --sk.depth === 0) {
        const keep = sk.keepEnd;
        skip = null;
        if (!keep) { i = end; continue; }
      }
    } else {
      const t = startTag(d, lt, stop, over);
      if (!t) { copy(lt, d.length); break; }
      scan.scanned += t.end - lt;
      i = t.end;
      const sk = skip;
      if (sk) { if (t.name === sk.name && !t.self) sk.depth++; continue; }
      for (const a of t.attrs) if (a.name === "xmlns" || a.name.startsWith("xmlns:")) prefixes.set(a.name === "xmlns" ? "" : a.name.slice(6), str(d, a.vs, a.ve));
      const [prefix, local] = split(t.name);
      const el = locals.has(local) ? key([nsOf(prefix), local]) : null;
      if ((wholeNs.size && wholeNs.has(nsOf(prefix))) || el && (removeSet.has(el) || dropBy.get(el)?.(new Map(t.attrs.map((a) => /** @type {[string, string]} */ ([a.name, str(d, a.vs, a.ve)])))))) {
        changed = true;
        if (!t.self) skip = { name: t.name, depth: 1, keepEnd: false };
        continue;
      }
      /** @type {Map<Attr, string | null> | null} */
      let edits = null;
      if (wholeNs.size)
        for (const a of t.attrs) { const ap = split(a.name)[0]; if (ap && ap !== "xmlns" && wholeNs.has(nsOf(ap))) { const m = edits ?? (edits = new Map(null)); m.set(a, null); } }
      if (attrLocals.size)
        for (const a of t.attrs) {
          const [ap, al] = split(a.name);
          if (!attrLocals.has(al)) continue;
          const ans = ap ? nsOf(ap) : "";
          const rule = attrs.find((r) => {
            const el = r.el, when = r.when;
            return r.attr[1] === al && r.attr[0] === ans && (!el || (el[1] === local && el[0] === nsOf(prefix))) &&
              (!when || when(str(d, a.vs, a.ve)));
          });
          if (rule && (rule.value === null || a.ve > a.vs)) { const m = edits ?? (edits = new Map(null)); m.set(a, rule.value); }
        }
      const ed = edits;
      if (!ed) copy(lt, t.end);
      else {
        changed = true;
        put(`<${t.name}`);
        for (const a of t.attrs) {
          if (!ed.has(a)) { put(" "); copy(a.ns, a.ve + 1); }
          else if (ed.get(a) !== null) put(` ${a.name}=${String.fromCharCode(a.q, a.q)}`);
        }
        put(t.self ? "/>" : ">");
      }
      if (el && emptySet.has(el) && !t.self) {
        const next = idx(LT, t.end), room = next < 0 ? 0 : Math.min(d.length, next + TAG_MAX), gt = next < 0 ? -1 : idx(GT, next, room);
        if (next !== t.end || d[next + 1] !== SLASH || gt < 0 || str(d, next + 2, gt).trim() !== t.name) {
          changed = true;
          skip = { name: t.name, depth: 1, keepEnd: true };
        }
      }
      continue;
    }
    if (end < 0) { copy(lt, d.length); break; }
    copy(lt, end);
    i = end;
  }
  return changed ? out.subarray(0, w) : d;
}
