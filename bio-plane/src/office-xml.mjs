/* The XML plumbing the three office readers share (office-readers R40-R42; fix round 9, G133c, G133d, G131g).
 *
 * ONE scanner reads every part of a docx, pptx or xlsx: a single left-to-right pass that examines each byte a bounded
 * number of times (a tag is at most TAG_MAX bytes; a longer one is not a tag and its bytes are text; an unterminated
 * one is text to the part's end), so no shape of input, however hostile, costs more than a few passes (R42). It hands
 * the walkers local element names, raw attribute text, character data and CDATA, and counts what it examined.
 *
 * ONE decode reads every text part (R41): `decodePart` is ooxml's `decodeText` (its R36) where ooxml exports it, and
 * the same contract made locally until then. A numeric character reference that names no scalar value is found by
 * the scanner, never turned into a character: the part holding it is unreadable, stated, the same on every call (R40).
 *
 * Pure: no store, no network, no clock. Never throws. */

import * as OOXML from "./ooxml.mjs";
import { boundOf } from "./read-bounds.mjs";

/** A tag longer than this is not a tag (R42): its bytes are text and the part states `tag_over_bound`. */
export const TAG_MAX = boundOf("xml", "tag");
/* The window a part is fed in; two windows hold far fewer than 65,536 tokens, so a yield between windows is never
   more than that many tokens apart (R42). */
const WINDOW = 65536;
const YIELD_TOKENS = 32768;

const isWs = (c) => c === 32 || c === 9 || c === 10 || c === 13;
const isNameStart = (c) => (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95 || c === 58;
const localOf = (name) => { const i = name.lastIndexOf(":"); return i < 0 ? name : name.slice(i + 1); };

/* ------------------------------------------------------------------ *
 * Character references (R40)
 * ------------------------------------------------------------------ */

const REF_RE = /&#([^;&<\s]*);/g;
const NUM_RE = /^(?:[xX]([0-9A-Fa-f]{1,8})|([0-9]{1,9}))$/;

/** The scalar value a numeric reference's text names, or null when it names none (above U+10FFFF, a surrogate, U+0000,
 *  digits that do not parse). `body` is what lies between `&#` and `;`. */
function scalarOf(body) {
  const m = NUM_RE.exec(body);
  if (!m) return null;
  const cp = m[1] != null ? parseInt(m[1], 16) : parseInt(m[2], 10);
  if (!(cp > 0) || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return null;
  return cp;
}

/** True when `s` holds a numeric character reference that names no scalar value. */
export function hasBadRef(s) {
  if (s.indexOf("&#") < 0) return false;
  REF_RE.lastIndex = 0;
  let m;
  while ((m = REF_RE.exec(s)) !== null) if (scalarOf(m[1]) == null) return true;
  return false;
}

const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const ENT_RE = /&(#[xX][0-9A-Fa-f]+|#[0-9]+|[a-zA-Z]+);/g;
/** Entities and character references decoded; a reference that names no character stays as written (the scanner has
 *  already made its part unreadable, R40). */
export function unescape(s) {
  if (s.indexOf("&") < 0) return s;
  return s.replace(ENT_RE, (m, e) => {
    if (e[0] === "#") {
      const cp = scalarOf(e.slice(1));
      return cp == null ? m : String.fromCodePoint(cp);
    }
    return NAMED[e] ?? m;
  });
}

/** Attributes by LOCAL name, entity-decoded; one pass, quoted or bare values. */
export function parseAttrs(raw) {
  const out = {};
  if (!raw) return out;
  const n = raw.length;
  let i = 0;
  while (i < n) {
    while (i < n && isWs(raw.charCodeAt(i))) i++;
    if (i >= n) break;
    let s = i;
    while (i < n) { const c = raw.charCodeAt(i); if (c === 61 || isWs(c)) break; i++; }
    const name = raw.slice(s, i);
    while (i < n && isWs(raw.charCodeAt(i))) i++;
    if (raw.charCodeAt(i) !== 61) continue;
    i++;
    while (i < n && isWs(raw.charCodeAt(i))) i++;
    let val;
    const q = raw.charCodeAt(i);
    if (q === 34 || q === 39) {
      const e = raw.indexOf(raw[i], i + 1);
      if (e < 0) { val = raw.slice(i + 1); i = n; } else { val = raw.slice(i + 1, e); i = e + 1; }
    } else {
      s = i;
      while (i < n && !isWs(raw.charCodeAt(i))) i++;
      val = raw.slice(s, i);
    }
    const local = localOf(name);
    const v = unescape(val);
    if (local) out[local] = v;
    if (local !== name) out[name] = v; // the qualified name too, for a reader that must tell `r:id` from `id`
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * The scanner
 * ------------------------------------------------------------------ */

/** `new Scanner({text, cdata, open, close})`. `open(local, rawAttrs, selfClosed)`, `close(local)`, `text(chars)` (raw,
 *  not decoded) and `cdata(chars)` are called in document order; a handler that sets `scanner.stopped = true` ends the
 *  scan. `push(piece, final)` takes the part whole or in pieces that end anywhere; what a piece leaves unfinished is
 *  carried into the next. Counts: `scanned` (bytes examined), `tokens`, `overBound` (tags over TAG_MAX), `unterminated`
 *  (a tag, comment or section never closed), `badRef` (a numeric reference naming no scalar value). */
export class Scanner {
  constructor(h) {
    this.h = h;
    if (h && typeof h === "object") h.scanner = this; // a handler may ask where it is (`scanner.at`)
    this.carry = "";
    this.scanned = 0;
    this.tokens = 0;
    this.overBound = 0;
    this.unterminated = 0;
    this.badRef = false;
    this._stopped = false;
    this.yielded = 0;
    this.carryAt = 0; // the absolute offset of the first character of `carry`
    this.at = 0;      // the absolute offset of the start of the tag being handed to the handler
  }

  /* a handler (or its owner) may end the scan early: set `stopped` on either */
  get stopped() { return this._stopped || this.h.stopped === true; }
  set stopped(v) { this._stopped = v; }

  #text(s) {
    if (!s) return;
    this.tokens++;
    this.scanned += s.length;
    if (!this.badRef && s.indexOf("&#") >= 0 && hasBadRef(s)) this.badRef = true;
    this.h.text(s);
  }

  push(chunk, final = false) {
    if (this.stopped) return;
    const xml = this.carry ? this.carry + chunk : chunk;
    this.carry = "";
    const n = xml.length;
    const abs0 = this.carryAt;
    let i = 0;
    while (i < n && !this.stopped) {
      const lt = xml.indexOf("<", i);
      if (lt < 0) {
        if (final) { this.#text(xml.slice(i)); i = n; }
        break;
      }
      if (lt > i) this.#text(xml.slice(i, lt));
      if (this.stopped) return;
      i = lt;
      if (!final && n - lt < 10) break; // too little to classify: carried
      const c1 = lt + 1 < n ? xml.charCodeAt(lt + 1) : -1;
      if (c1 === 33) { // <!
        let end, openLen, kind;
        if (xml.startsWith("<!--", lt)) { kind = "comment"; openLen = 4; end = xml.indexOf("-->", lt + 4); }
        else if (xml.startsWith("<![CDATA[", lt)) { kind = "cdata"; openLen = 9; end = xml.indexOf("]]>", lt + 9); }
        else { kind = "decl"; openLen = 2; end = xml.indexOf(">", lt + 2); }
        if (end < 0) {
          if (!final) break;
          this.unterminated++;
          this.scanned += n - lt;
          this.#text(xml.slice(lt));
          i = n;
          break;
        }
        const close = kind === "decl" ? end + 1 : end + 3;
        this.scanned += close - lt;
        this.tokens++;
        if (kind === "cdata") this.h.cdata(xml.slice(lt + openLen, end));
        i = close;
        continue;
      }
      if (c1 === 63) { // <?
        const end = xml.indexOf("?>", lt + 2);
        if (end < 0) {
          if (!final) break;
          this.unterminated++;
          this.scanned += n - lt;
          this.#text(xml.slice(lt));
          i = n;
          break;
        }
        this.scanned += end + 2 - lt;
        this.tokens++;
        i = end + 2;
        continue;
      }
      const closing = c1 === 47;
      const c2 = xml.charCodeAt(lt + (closing ? 2 : 1));
      if (!isNameStart(c2)) { this.#text("<"); i = lt + 1; continue; }
      const lim = Math.min(n, lt + TAG_MAX + 1);
      let q = 0, k = lt + 1, end = -1;
      for (; k < lim; k++) {
        const c = xml.charCodeAt(k);
        if (q) { if (c === q) q = 0; }
        else if (c === 34 || c === 39) q = c;
        else if (c === 62) { end = k; break; }
      }
      this.scanned += (end >= 0 ? end : k) - lt;
      if (end < 0) {
        if (lim - lt > TAG_MAX) { // over the bound: not a tag, its bytes are text
          this.overBound++;
          this.#text(xml.slice(lt, lt + TAG_MAX));
          i = lt + TAG_MAX;
          continue;
        }
        if (!final) break;
        this.unterminated++;
        this.#text(xml.slice(lt));
        i = n;
        break;
      }
      let raw = xml.slice(lt + (closing ? 2 : 1), end);
      i = end + 1;
      this.tokens++;
      let self = false;
      if (!closing && raw.charCodeAt(raw.length - 1) === 47) { self = true; raw = raw.slice(0, -1); }
      let s = 0;
      while (s < raw.length && !isWs(raw.charCodeAt(s))) s++;
      const local = localOf(raw.slice(0, s));
      const attrs = s < raw.length ? raw.slice(s + 1) : "";
      if (attrs && !this.badRef && attrs.indexOf("&#") >= 0 && hasBadRef(attrs)) this.badRef = true;
      this.at = abs0 + lt;
      if (closing) this.h.close(local);
      else this.h.open(local, attrs, self);
    }
    if (!final && !this.stopped && i < n) this.carry = xml.slice(i);
    this.carryAt = abs0 + (this.carry ? i : n);
  }
}

/** Let the caller's turn pass; a `yieldNow` that is not a function is no yield, one that fails is no yield. */
export async function letPass(yieldNow) {
  if (typeof yieldNow !== "function") return;
  try { await yieldNow(); } catch { /* a yield that fails is no yield */ }
}

/** Feed a part held whole through `scanner` in windows, awaiting `yieldNow` between windows once 32,768 tokens have
 *  passed since the last (never more than 65,536 apart, R42). */
export async function scanWhole(scanner, xml, yieldNow) {
  for (let at = 0; at < xml.length && !scanner.stopped; at += WINDOW) {
    scanner.push(xml.slice(at, at + WINDOW), false);
    if (typeof yieldNow === "function" && scanner.tokens - scanner.yielded >= YIELD_TOKENS) {
      scanner.yielded = scanner.tokens;
      await letPass(yieldNow);
    }
  }
  scanner.push("", true);
}

/** Synchronously, for a small part or a caller that cannot wait. */
export function scanSync(scanner, xml) {
  scanner.push(xml, true);
}

/* ------------------------------------------------------------------ *
 * Elements of a small part, in one pass
 * ------------------------------------------------------------------ */

/** Every element whose local name is in `names`, in document order: `{name, attrs, text}`, `text` being the character
 *  data (CDATA included, entities decoded) inside it; a name is not nested in itself. One pass. */
export function collectElements(xml, names) {
  const out = [];
  let cur = null;
  const set = names instanceof Set ? names : new Set(names);
  const sc = new Scanner({
    text(s) { if (cur) cur.text += unescape(s); },
    cdata(s) { if (cur) cur.text += s; },
    open(name, raw, self) {
      if (cur || !set.has(name)) return;
      const e = { name, attrs: parseAttrs(raw), text: "" };
      out.push(e);
      if (!self) cur = e;
    },
    close(name) { if (cur && cur.name === name) cur = null; },
  });
  scanSync(sc, xml);
  return { elements: out, badRef: sc.badRef, stats: stats(sc) };
}

export const stats = (sc) => ({ scanned: sc.scanned, tokens: sc.tokens, overBound: sc.overBound, unterminated: sc.unterminated });

/** The statements a scanner's counts owe `undetermined` for one part (R42). */
export function scanNotes(part, sc) {
  const out = [];
  if (sc.overBound) out.push({ part, why: "tag_over_bound", n: sc.overBound });
  if (sc.unterminated) out.push({ part, why: "tag_unterminated", n: sc.unterminated });
  return out;
}

/* ------------------------------------------------------------------ *
 * The one decode (R41)
 * ------------------------------------------------------------------ */

/** A text with more replacement characters than this share of its characters is `partial` (ooxml R36). */
export const REPLACED_RATIO_MAX = 0.005;

/** A text part's bytes as text: ooxml's `decodeText` when it is there, else the local one of the same contract. */
export function decodePart(bytes, part, declared = null) {
  try {
    return OOXML.decodeText(bytes, { declared, name: part, kind: "xml" });
  } catch {
    return { ok: false, why: "ENCODING_UNSUPPORTED", name: part };
  }
}

/** Read one part whole and decode it: `{ok:true, text, partial?}` or `{ok:false, why, ...}` (a part the cap refuses, a
 *  read that failed, an encoding this function cannot decode). `partial` is `{part, why:"partial", replaced}` when the
 *  text holds more than 0.5 % replacement characters (R41). */
export async function readText(bytes, container, name) {
  const r = await OOXML.readPart(bytes, container, name);
  if (!r.ok) return { ok: false, why: r.why, ...(r.size != null ? { size: r.size } : {}), ...(r.final ? { final: true } : {}) };
  const d = decodePart(r.bytes, name);
  if (!d.ok) return { ok: false, why: d.why, name: d.name ?? name, final: true };
  const out = { ok: true, text: d.text };
  if (d.replaced > 0 && d.replaced_ratio > REPLACED_RATIO_MAX) out.partial = { part: name, why: "partial", replaced: d.replaced };
  return out;
}

/** A copy of `s` that keeps nothing else alive. A slice of 13 characters or more is a view into the string it was cut from,
 *  so a paragraph's text held by the answer would hold the whole window (and, for a part read whole, the part) it came out
 *  of for as long as the answer lives (R44's margin); a short one is copied by the engine already. */
export const owned = (s) => (s.length < 13 ? s : (" " + s).slice(1));

/** R44 (fix round 10, cause 11a): the same read as `readText`, but the part is kept as its bytes and its encoding, not as a
 *  string: a large part decoded whole is a string of up to two bytes a character beside the answer it makes. The decode is
 *  made once here, whole, as `readText` makes it, for its encoding and its share of replaced characters (R41) and let go;
 *  `scanBytes` decodes it again a window at a time with that same encoding, which gives the same text. */
export async function readTextBytes(bytes, container, name) {
  const r = await OOXML.readPart(bytes, container, name);
  if (!r.ok) return { ok: false, why: r.why, ...(r.size != null ? { size: r.size } : {}), ...(r.final ? { final: true } : {}) };
  const d = decodePart(r.bytes, name);
  if (!d.ok) return { ok: false, why: d.why, name: d.name ?? name, final: true };
  const out = { ok: true, data: r.bytes, encoding: d.encoding };
  if (d.replaced > 0 && d.replaced_ratio > REPLACED_RATIO_MAX) out.partial = { part: name, why: "partial", replaced: d.replaced };
  return out;
}

/** Feed a part kept as bytes through `scanner`, decoding a window of it at a time (`readTextBytes`), awaiting `yieldNow` as
 *  `scanWhole` does. */
export async function scanBytes(scanner, data, encoding, yieldNow) {
  const decoder = new TextDecoder(encoding, { fatal: false });
  for (let at = 0; at < data.length && !scanner.stopped; at += WINDOW) {
    const end = Math.min(at + WINDOW, data.length);
    scanner.push(decoder.decode(data.subarray(at, end), { stream: end < data.length }), false);
    if (typeof yieldNow === "function" && scanner.tokens - scanner.yielded >= YIELD_TOKENS) {
      scanner.yielded = scanner.tokens;
      await letPass(yieldNow);
    }
  }
  scanner.push("", true);
}

/* ------------------------------------------------------------------ *
 * One part, scanned
 * ------------------------------------------------------------------ */

/** Read a part and run `handler` over it. `mode` is `"whole"` (read whole, decoded, fed in windows) or `"pieces"` (read in
 *  pieces by ooxml, a part over the whole-read bound). Answers `{ok:true, scanner, partial?}` or `{ok:false, why, ...}`;
 *  a part holding a character reference that names no scalar value answers `{ok:false, why:"char_ref_invalid",
 *  final:true}` (R40), and one a handler stopped answers `ok:true` with `scanner.stopped` set. */
export async function scanPart(bytes, container, name, handler, { mode = "whole", cut = OOXML.cutAfterTag, yieldNow = null, onPiece = null } = {}) {
  const scanner = new Scanner(handler);
  let partial = null;
  if (mode === "pieces") {
    const read = await OOXML.readPartPieces(bytes, container, name, cut, (piece) => {
      /* G178 (R46): a piece is fed in windows, so what a window carries over is joined to a window and never to the whole piece (a copy of it) */
      for (let at = 0; at < piece.length && !scanner.stopped; at += WINDOW) scanner.push(piece.slice(at, at + WINDOW), false);
      /* `onPiece` may answer a promise (work it started on the piece): the next piece is not read before it settles */
      const held = onPiece ? onPiece(piece) : undefined;
      if (typeof yieldNow === "function" && scanner.tokens - scanner.yielded >= YIELD_TOKENS) {
        scanner.yielded = scanner.tokens;
        return held ? Promise.all([held, letPass(yieldNow)]) : letPass(yieldNow);
      }
      return held;
    });
    if (!read.ok) return { ok: false, ...OOXML.pieceWhy(read) };
    scanner.push("", true);
  } else {
    const r = await readText(bytes, container, name);
    if (!r.ok) return r;
    partial = r.partial ?? null;
    await scanWhole(scanner, r.text, yieldNow);
  }
  if (scanner.badRef) return { ok: false, why: "char_ref_invalid", final: true };
  return { ok: true, scanner, ...(partial ? { partial } : {}) };
}

/** The least bytes of a part that can hold more than `max` retained objects: the shortest object is an empty `<p/>`, 4 bytes
 *  (a prefix only lengthens it), so a part under `4 * max` is never counted before it is read. */
export const precountFloor = (max) => 4 * max;

/** R44 (fix round 10, cause 11a): the objects a walk would retain, counted BEFORE the part is held whole. `parts` are
 *  names read in pieces by ooxml one after the other, never held; `counted` is the set of local element names the walk
 *  counts (one object per open of such an element), `skipper` makes the per-part test for a branch the walk does not read
 *  (`mceSkipper`, so the same elements are counted as are retained). The count carries across the parts. Answers
 *  `{n, exceeded}`: `exceeded` is `{why:"TOO_MANY_OBJECTS", n, bound, final:true}` at the first object past `max` (the
 *  scan stops, the rest of the part is let go piece by piece), else null; `scanned` the bytes examined. A part this
 *  cannot read adds nothing: the walk states its own failure. */
export async function countObjects(bytes, container, parts, counted, { skipper, max, startAt = 0 }) {
  let n = startAt, scanned = 0, exceeded = null;
  for (const name of parts) {
    if (exceeded) break;
    const skipped = skipper();
    const handler = {
      stopped: false,
      text() {}, cdata() {},
      close(local) { skipped(local, true, false); },
      open(local, raw, selfClosed) {
        if (skipped(local, false, selfClosed)) return;
        if (counted.has(local) && ++n > max && !exceeded) { exceeded = { why: "TOO_MANY_OBJECTS", n, bound: max, final: true }; handler.stopped = true; }
      },
    };
    const r = await scanPart(bytes, container, name, handler, { mode: "pieces" });
    scanned += r.scanner?.scanned ?? 0;
  }
  return { n, exceeded, scanned };
}

/** G178 (R46): text made a piece at a time and kept as UTF-8 bytes (a growing buffer, not one string per row), made one
 *  string once, at the end. `chars` counts the UTF-16 units added, so the string's offsets are known as it is made; `mark`
 *  and `reset` take back what a sheet that could not be read to its end added. The pieces added hold no lone surrogate
 *  (every text is decoded from bytes or made of whole references), so the bytes are the text. */
const SINK_ENC = new TextEncoder();
const SINK_DEC = new TextDecoder("utf-8", { ignoreBOM: true });
export function textSink(expected = 0) {
  /* `expected`: about how many bytes the text will take; a buffer that starts near it is grown once, not many times */
  let buf = new Uint8Array(Math.min(Math.max(Math.floor(expected) || 0, 1 << 16), 8 << 20)), n = 0, chars = 0;
  const room = (need) => {
    if (n + need <= buf.length) return;
    let size = buf.length;
    while (size < n + need) size *= 2;
    const next = new Uint8Array(size);
    next.set(buf.subarray(0, n));
    buf = next;
  };
  return {
    get chars() { return chars; },
    add(s) { if (!s.length) return; room(s.length * 3); n += SINK_ENC.encodeInto(s, buf.subarray(n)).written; chars += s.length; },
    newline() { room(1); buf[n++] = 10; chars++; },
    mark() { return { n, chars }; },
    reset(m) { n = m.n; chars = m.chars; },
    text() { const t = SINK_DEC.decode(buf.subarray(0, n)); buf = null; return t; },
  };
}

/** The UTF-8 bytes of a value's JSON. */
const ENC = new TextEncoder();
export function jsonBytes(v) {
  const j = JSON.stringify(v);
  return /[^\x00-\x7f]/.test(j) ? ENC.encode(j).length : j.length;
}

/* ------------------------------------------------------------------ *
 * An embedded part's identity (R43)
 * ------------------------------------------------------------------ */

/** The sha256 and size of the members named by `names`, each taken as the member streams through ooxml's `streamMember`
 *  and never held whole: the most held for one is a read window and an inflate chunk. A member over `MEMBER_MAX` or
 *  `ARCHIVE_RATIO_MAX`, or any other that ooxml's listing refuses, is refused before inflation and answers its limit's
 *  name. `Map(name -> {ok:true, sha256, size} | {ok:false, why, limit?})`; a listing that cannot be made answers every
 *  name with its reason. Never throws. */
export async function memberIdentities(bytes, names) {
  const out = new Map();
  if (!names.length) return out;
  const listing = await OOXML.listArchive(bytes);
  if (!listing.ok || !Array.isArray(listing.entries)) {
    for (const n of names) out.set(n, { ok: false, why: listing.why ?? "source_unreadable" });
    return out;
  }
  const rows = new Map();
  for (const r of listing.entries) {
    const key = OOXML.normalizePartName(r.name ?? "");
    if (key && !rows.has(key)) rows.set(key, r);
  }
  for (const n of names) {
    const row = rows.get(n);
    if (!row) { out.set(n, { ok: false, why: "part_absent" }); continue; }
    try {
      const m = OOXML.streamMember(bytes, row);
      for await (const chunk of m.chunks) void chunk; // passes through; nothing is kept
      const d = await m.done;
      out.set(n, d.ok
        ? { ok: true, sha256: d.sha256, size: d.size }
        : { ok: false, why: d.why, ...(d.detail ? { detail: d.detail } : {}), ...(d.limit != null ? { limit: d.limit } : {}) });
    } catch {
      out.set(n, { ok: false, why: "source_unreadable" });
    }
  }
  return out;
}

/** R38 (K4924): the units of `parts` addressed. Each unit's `ref` becomes a non-empty STRING that addresses it alone
 *  within its `part`: an id the caller already wrote as a string stays; an anchor's element reference (R15-R19) is
 *  written as its `ref` text with its run or shape where it has one, and kept beside as `anchor`; a unit with no anchor
 *  is addressed by its part. Where two units of one part still share a string, the later ones take ` #<k>` (k from 2),
 *  in the units' own order. These strings are addresses, never sentences. */
export function addressParts(units) {
  const seen = new Map();
  return units.map((u) => {
    const a = u.ref != null && typeof u.ref === "object" ? u.ref : null;
    let ref = typeof u.ref === "string" && u.ref !== "" ? u.ref : a ? String(a.ref ?? "") : "";
    if (a && Number.isInteger(a.run)) ref += ` run ${a.run + 1}`;
    else if (a && Number.isInteger(a.shape)) ref += ` shape ${a.shape + 1}`;
    if (ref === "") ref = u.part;
    const key = `${u.part}\u0000${ref}`;
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    const out = n === 1 ? ref : `${ref} #${n}`;
    const { ref: _drop, ...rest } = u;
    return { ...rest, ref: out, ...(a ? { anchor: a } : {}) };
  });
}
