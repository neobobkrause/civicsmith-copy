/* Bounded reading of a large text (doctypes R37): the types' `detect`, `parse` and `assess` read a text a line at a
 * time, or in windows of its flattened form, and never build a whole-text copy (a flatten, a `split`, a global `match`
 * over all of it). Every answer is the answer the whole-text reading gave.
 *
 * A WINDOW is a piece of `flatten(text)` (every white-space run one space): the text is cut into chunks of about
 * `chunk` characters, each cut moved to the end of a white-space run so the pieces joined are exactly the whole
 * flatten, and each piece is handed with `pad` flattened characters of what came before and of what comes after, so a
 * phrase that crosses a cut is seen whole. A match belongs to the window its first character is in (`from` to `to`),
 * and a scan resumes where the last match of the whole text would have ended, so a count, a first match and a
 * boolean are the whole-text ones. A pattern here never matches more than `pad` characters (the types' phrases are
 * tens to hundreds). Offsets named `abs` are offsets into the flattened text; `scanFlat*` give them, and a reader that
 * needs an offset into the RAW text (for `ctx.locate`) reads raw lines (`eachLine`, `lineTable`), as it always did. */
import { allMatches, entity, readAgain } from "../docprofile/doctypes/index.mjs";
import { localize } from "../bio-plane/src/setup-words/index.mjs";
import { CLASSIFY_WHOLE_MAX_CHARS } from "../docprofile/classify-view.mjs";
/** @import { DoctypeContext, Entity, EntityFacts, TaggedPattern, TaggedMatch } from "../docprofile/doctypes/index.mjs" */
/** @import { ReadingPosition } from "../bio-plane/src/textchain.mjs" */

/**
 * A text the readers here are handed: what a type has as `ctx.text`, or none (read as the empty text).
 * @typedef {string | null | undefined} GivenText
 */
/**
 * Where the text is cut into windows: about `chunk` characters a piece, each handed with `pad` characters of what comes
 * before and after. Absent, the default cut (`WINDOW_CHARS`, `WINDOW_PAD`).
 * @typedef {Object} WindowCut
 * @property {number | undefined} [chunk]
 * @property {number | undefined} [pad]
 */
/**
 * A cut, and the flat offset before which a scan skips matches (absent, 0).
 * @typedef {Object} ScanCut
 * @property {number | undefined} [chunk]
 * @property {number | undefined} [pad]
 * @property {number | undefined} [fromAbs]
 */
/**
 * A window of flatten(text): `buf` holds the piece between `from` and `to` with the flattened characters before and after
 * it, `base` is the offset of `buf[0]` in the whole flatten, and `last` says no piece follows.
 * @typedef {Object} FlatWindow
 * @property {string} buf
 * @property {number} from
 * @property {number} to
 * @property {number} base
 * @property {boolean} last
 */
/**
 * One pattern of a `scanFlatMany`: `on(m, abs, w)` is called for each match of `re` (`m.index` relative to `w.buf`, `abs`
 * its flat offset) and stops that pattern by answering `true`; any other answer goes on.
 * @typedef {Object} FlatSpec
 * @property {RegExp} re
 * @property {(m: RegExpExecArray, abs: number, w: FlatWindow) => unknown} on
 */
/**
 * The first match of a pattern in flatten(text): the match's text and groups as a list, its named groups (or null), and its
 * flat offset.
 * @typedef {Object} FlatHit
 * @property {string[]} m
 * @property {{ [name: string]: string } | null} groups
 * @property {number} abs
 */
/**
 * A work counter: the characters examined so far.
 * @typedef {Object} WorkCounter
 * @property {number} chars
 */
/**
 * The text a `detect` or `parse` now running was handed, and its flatten once it is made.
 * @typedef {Object} FlatView
 * @property {string | undefined} text
 * @property {string | null} flat
 */
/**
 * A type's `detect` or `parse` as `counted` wraps it: called with the type as `this` and the context first.
 * @typedef {(this: unknown, ctx: DoctypeContext, ...rest: unknown[]) => unknown} TypeAnswer
 */
/**
 * What `counted` takes: a type whose `detect` and `parse`, where it has them, are answers of a context.
 * @typedef {Object} Countable
 * @property {TypeAnswer | undefined} [detect]
 * @property {TypeAnswer | undefined} [parse]
 */

export const WINDOW_CHARS = 1 << 18;
export const WINDOW_PAD = 4096;

/* THE WORK COUNT (R40). docprofile hands a type's `detect` and `parse` a counter, `ctx.work = {chars}`; a type adds to it
 * the characters it examines. `counted(type)` makes that so for a type: while its `detect` or `parse` runs, every
 * primitive here that walks a text adds the characters it walks to the counter, and `spend` adds a pass a type makes
 * by hand (a `test` or a `match` over the text). With no `ctx.work` nothing is counted and nothing changes. */
/** @type {WorkCounter | null} */
let WORK = null;
/* THE FLAT VIEW (R37, K4892). A text no longer than `CLASSIFY_WHOLE_MAX_CHARS` is what docprofile hands a `detect` (the whole
 * text, or the classification view of a longer one), and a type scans it in several passes. A pass that cut it into windows
 * made, per window, a flattened piece and a third string with the padding, and a type of six passes left 38 MB of large-object
 * strings that only a major collection frees (found over a 1.5 M-character view in one tick of the plane's isolate). So while a
 * `detect` or `parse` runs on a text of that size, it flattens the text ONCE, here, and every pass is one window over the one
 * flat string; the string is dropped when the call ends. A longer text (a `parse` of a whole reading) is still read a window
 * at a time. The answers are the same: a window is a piece of the flatten and one window holds it all. */
/** @type {FlatView | null} */
let FLAT = null;
/** Adds `n` characters to the work counter now running, if one is.
 *  @param {number} n
 *  @returns {void} */
export function spend(n) {
  const work = WORK;
  if (work !== null && n > 0) work.chars += n;
}
/** `type` with its `detect` and `parse` counting into `ctx.work` (R40). A `detect` is handed one window of the text and is
 *  charged that window once however many passes it makes over it (docprofile's budget is a number of windows examined, one
 *  for each type asked); a `parse` is charged every pass it makes.
 *  @template {Countable} T
 *  @param {T} type
 *  @returns {T} */
export function counted(type) {
  /** @param {TypeAnswer} fn @param {boolean} once @returns {TypeAnswer} */
  const run = (fn, once) => /** @this {unknown} @param {DoctypeContext} ctx @param {unknown[]} rest @returns {unknown} */ function (ctx, ...rest) {
    const w = ctx && ctx.work;
    const counting = !!w && typeof w === "object" && typeof w.chars === "number";
    const prev = WORK, prevFlat = FLAT;
    const mine = once ? { chars: 0 } : w;
    if (counting && mine) WORK = mine;
    FLAT = { text: ctx && ctx.text, flat: null };
    try { return fn.call(this, ctx, ...rest); } finally {
      WORK = prev;
      FLAT = prevFlat;
      if (counting && once && w && mine) w.chars += Math.min(mine.chars, String((ctx && ctx.text) || "").length);
    }
  };
  /** @type {TypeAnswer | undefined} */
  const detect = type.detect;
  /** @type {TypeAnswer | undefined} */
  const parse = type.parse;
  const out = {
    ...type,
    ...(typeof detect === "function" ? { detect: run(detect, true) } : {}),
    ...(typeof parse === "function" ? { parse: run(parse, false) } : {}),
  };
  return out;
}

const WS = /\s/;

/* `text.slice(a, b).replace(/\s+/g, " ")` without the replace: a global replace over a text of 150,000 white-space runs leaves
   about 13 MB of garbage (V8 holds every match while it builds the result, and a collection frees it late), so the characters
   are copied by hand, a run of white space (the characters `\s` matches) as one space, through one small scratch array. */
const SCRATCH = new Uint16Array(8192);
/** @param {number} c @returns {boolean} */
function isSpace(c) {
  return c === 32 || (c >= 9 && c <= 13) || c === 160 || c === 0x1680 || (c >= 0x2000 && c <= 0x200a) || c === 0x2028 || c === 0x2029
    || c === 0x202f || c === 0x205f || c === 0x3000 || c === 0xfeff;
}
/** @param {string} text @param {number} a @param {number} b @returns {string} */
function flatSlice(text, a, b) {
  /** @type {string[]} */
  const parts = [];
  let k = 0, space = false;
  for (let i = a; i < b; i++) {
    const c = text.charCodeAt(i);
    if (isSpace(c)) { if (space) continue; space = true; SCRATCH[k++] = 32; }
    else { space = false; SCRATCH[k++] = c; }
    if (k === SCRATCH.length) { parts.push(String.fromCharCode(...SCRATCH)); k = 0; }
  }
  if (k) parts.push(String.fromCharCode(...SCRATCH.subarray(0, k)));
  const only = parts[0];
  return parts.length === 1 && only !== undefined ? only : parts.join("");
}

/* The pieces of flatten(text), each cut at the end of a white-space run so that no run is split between two pieces. */
/** @param {string} text @param {number} chunk @returns {Generator<string, void, void>} */
function* flatPieces(text, chunk) {
  const n = text.length;
  let at = 0;
  while (at < n) {
    let cut = Math.min(n, at + chunk);
    if (cut < n && WS.test(text.charAt(cut - 1))) while (cut < n && WS.test(text.charAt(cut))) cut++;
    yield flatSlice(text, at, cut);
    at = cut;
  }
}

/* flatten(text), made once for the `detect` or `parse` now running when `text` is the text it was handed and is no longer
   than `CLASSIFY_WHOLE_MAX_CHARS`; else null. Only the default cut asks (a caller that sets `chunk` or `pad` is testing the cut). */
/** @param {GivenText} text @param {number} chunk @param {number} pad @returns {string | null} */
function flatOnce(text, chunk, pad) {
  const view = FLAT;
  if (view === null || chunk !== WINDOW_CHARS || pad !== WINDOW_PAD) return null;
  if (typeof text !== "string" || text !== view.text || text.length > CLASSIFY_WHOLE_MAX_CHARS) return null;
  const made = view.flat;
  if (made !== null) return made;
  const flat = flatSlice(text, 0, text.length);
  view.flat = flat;
  return flat;
}

/** The windows of flatten(text): `{buf, from, to, base, last}`; `buf` holds the piece between `from` and `to` with
 *  the flattened characters before and after it, and `base` is the offset of `buf[0]` in the whole flatten.
 *  @param {GivenText} text
 *  @param {WindowCut} [cut]
 *  @returns {Generator<FlatWindow, void, void>} */
export function* flatWindows(text, { chunk = WINDOW_CHARS, pad = WINDOW_PAD } = {}) {
  const whole = flatOnce(text, chunk, pad);
  if (whole !== null) { spend(whole.length); yield { buf: whole, from: 0, to: whole.length, base: 0, last: true }; return; }
  const pieces = flatPieces(String(text || ""), chunk);
  /** @type {string[]} */
  const ahead = [];
  let aheadLen = 0;
  const pull = () => { const r = pieces.next(); if (r.done) return false; ahead.push(r.value); aheadLen += r.value.length; return true; };
  let tail = "", pos = 0;
  if (!pull()) return;
  while (ahead.length) {
    const cur = ahead.shift();
    if (cur === undefined) break;
    aheadLen -= cur.length;
    spend(cur.length);
    while (aheadLen < pad && pull());
    const last = ahead.length === 0;
    let head = "";
    for (const next of ahead) { if (head.length >= pad) break; head += next.slice(0, pad - head.length); }
    yield { buf: tail + cur + head, from: tail.length, to: tail.length + cur.length, base: pos - tail.length, last };
    tail = cur.length >= pad ? cur.slice(-pad) : (tail + cur).slice(-pad);
    pos += cur.length;
  }
}

/** @type {WeakMap<RegExp, RegExp>} */
const GLOBAL = new WeakMap();
/** A private global copy of a pattern, so a scan never touches the lastIndex of one a caller holds.
 *  @param {RegExp} re @returns {RegExp} */
function globalOf(re) {
  const held = GLOBAL.get(re);
  if (held) return held;
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  GLOBAL.set(re, g);
  return g;
}

/** Scans flatten(text) for several patterns in one pass. `specs` is `[{re, on(m, abs, w)}]`; `on` is called for each
 *  match of `re`, in order, as a scan of the whole flatten would find them (`m.index` is relative to `w.buf`), and
 *  returns true to stop that pattern. `fromAbs` skips matches starting before that flat offset.
 *  @param {GivenText} text
 *  @param {ReadonlyArray<FlatSpec>} specs
 *  @param {ScanCut} [cut]
 *  @returns {void} */
export function scanFlatMany(text, specs, { fromAbs = 0, ...opts } = {}) {
  const st = specs.map((s) => ({ g: globalOf(s.re), on: s.on, carry: fromAbs, done: false }));
  for (const w of flatWindows(text, opts)) {
    let live = false;
    for (const s of st) {
      if (s.done) continue;
      live = true;
      s.g.lastIndex = Math.max(w.from, s.carry - w.base);
      for (;;) {
        const m = s.g.exec(w.buf);
        if (m === null) break;
        if (m.index >= w.to) break;
        const abs = w.base + m.index;
        s.carry = abs + m[0].length;
        if (m[0].length === 0) s.g.lastIndex++;
        if (s.on(m, abs, w) === true) { s.done = true; break; }
      }
    }
    if (!live) break;
  }
}

/** Does flatten(text) hold a match of `re`?
 *  @param {GivenText} text @param {RegExp} re @param {ScanCut} [opts] @returns {boolean} */
export function flatHas(text, re, opts) {
  const seen = { found: false };
  scanFlatMany(text, [{ re, on: () => (seen.found = true) }], opts);
  return seen.found;
}

/** How many matches of `re` flatten(text) holds (as a global `match` over it would count), counting no further than
 *  `upTo` when that is given.
 *  @param {GivenText} text @param {RegExp} re @param {number} [upTo] @param {ScanCut} [opts] @returns {number} */
export function flatCount(text, re, upTo = Infinity, opts) {
  let n = 0;
  scanFlatMany(text, [{ re, on: () => ++n >= upTo }], opts);
  return n;
}

/** The first match of `re` in flatten(text): `{text, groups, abs}`, or null.
 *  @param {GivenText} text @param {RegExp} re @param {ScanCut} [opts] @returns {FlatHit | null} */
export function flatFirst(text, re, opts) {
  /** @type {{ hit: FlatHit | null }} */
  const first = { hit: null };
  scanFlatMany(text, [{ re, on: (m, abs) => { first.hit = { m: [...m], groups: m.groups || null, abs }; return true; } }], opts);
  return first.hit;
}

/** The first `n` characters of flatten(text) (fewer when the text is shorter).
 *  @param {GivenText} text @param {number} n @returns {string} */
export function flatPrefix(text, n) {
  let out = "";
  for (const piece of flatPieces(String(text || ""), Math.max(n, 1024))) {
    out += piece;
    spend(piece.length);
    if (out.length >= n) break;
  }
  return out.slice(0, n);
}

/** The matches `allMatches` would keep over all of flatten(text) for these tagged global patterns, in order, one at a
 *  time: `each(hit, abs, w)` with `hit = {m, tag}` (`m.index` relative to `w.buf`; `w.buf` holds `pad` characters
 *  before and after). Returns true from `each` to stop.
 *  @template T
 *  @param {GivenText} text
 *  @param {ReadonlyArray<TaggedPattern<T>>} tagged
 *  @param {(hit: TaggedMatch<T>, abs: number, w: FlatWindow) => unknown} each
 *  @param {WindowCut} [opts]
 *  @returns {boolean} */
export function mergedHits(text, tagged, each, opts) {
  let carry = 0;
  for (const w of flatWindows(text, opts)) {
    for (const hit of allMatches(tagged, w.buf)) {
      const abs = w.base + hit.m.index;
      if (abs < carry || hit.m.index < w.from) continue;
      if (hit.m.index >= w.to) break;
      carry = abs + hit.m[0].length;
      if (each(hit, abs, w) === true) return true;
    }
  }
  return false;
}

/** The matches `allMatches` would keep over all of the RAW text for these tagged global patterns, in order, one at a
 *  time, without the list of them (R40): `each(hit)` with `hit = {m, tag}` and `m.index` the offset in `text` (what
 *  `ctx.locate` is given). The text is read in windows of `chunk` characters with `pad` characters of what comes before
 *  and after, so a match that crosses a cut is seen whole; a match belongs to the window its first character is in. A
 *  pattern here never matches more than `pad` characters. Returns true from `each` to stop.
 *  @template T
 *  @param {GivenText} given
 *  @param {ReadonlyArray<TaggedPattern<T>>} tagged
 *  @param {(hit: TaggedMatch<T>) => unknown} each
 *  @param {WindowCut} [cut]
 *  @returns {boolean} */
export function rawMergedHits(given, tagged, each, { chunk = WINDOW_CHARS, pad = WINDOW_PAD } = {}) {
  const text = String(given || "");
  let carry = 0;
  for (let from = 0; from < text.length; from += chunk) {
    const to = Math.min(text.length, from + chunk);
    const base = Math.max(0, from - pad);
    const buf = text.slice(base, Math.min(text.length, to + pad));
    spend(to - from);
    for (const hit of allMatches(tagged, buf)) {
      const abs = base + hit.m.index;
      if (abs < carry || abs < from) continue;
      if (abs >= to) break;
      hit.m.index = abs;
      carry = abs + hit.m[0].length;
      if (each(hit) === true) return true;
    }
  }
  return false;
}

/* ------------------------------------------------------------------------------------------- the references */

/* The most distinct references (instruments, file numbers, code sections) one reading keeps, and the most repeat
 * sightings of them it records (R40; protective, BOB's, K4868): the memory a reading holds is then a number of references
 * and sightings and never the number a text of any size cites. Past either, a sighting is counted and not kept, and the
 * answer says so (`references_cut`, `references_skipped`). */
export const REFERENCES_MAX = 20_000;
export const SIGHTINGS_MAX = 50_000;

/**
 * What a reading past the bounds adds to its answer: that it was cut, how many sightings were counted and not kept, the two
 * bounds, and why, in words; an uncut reading adds none of these.
 * @typedef {Object} ReferencesState
 * @property {true} [references_cut]
 * @property {number} [references_skipped]
 * @property {number} [references_limit]
 * @property {number} [sightings_limit]
 * @property {string} [references_why]
 */
/**
 * A reading's book of references: the entities kept, in the order first met; `take(key, kind, label, facts, offset)`
 * records a sighting; `state()` is what a cut reading adds to its answer.
 * @typedef {Object} ReferenceBook
 * @property {Entity[]} entities
 * @property {(key: string, kind: string, label: string, facts: EntityFacts | null | undefined, offset: number) => void} take
 * @property {() => ReferencesState} state
 */

/** The entities of a reading that cites references, one per key, kept in the order they are first met (D-454: a repeat
 *  is another occurrence of the one reference, `readAgain`). `take(key, kind, label, facts, offset)`; `locate(offset)` is
 *  asked only for a sighting that is kept. `state()` is what a cut reading adds to its answer, or `{}`.
 *  @param {(offset: number) => ReadingPosition | null} locate
 *  @returns {ReferenceBook} */
export function referenceBook(locate) {
  /** @type {Entity[]} */
  const entities = [];
  /** @type {Map<string, Entity>} */
  const seen = new Map(/** @type {Array<[string, Entity]>} */ ([]));
  let sightings = 0, skipped = 0;
  return {
    entities,
    /** @param {string} key @param {string} kind @param {string} label @param {EntityFacts | null | undefined} facts @param {number} offset @returns {void} */
    take(key, kind, label, facts, offset) {
      const known = seen.get(key);
      if (known) {
        if (sightings >= SIGHTINGS_MAX) { skipped++; return; }
        sightings++;
        readAgain(known, locate(offset));
        return;
      }
      if (seen.size >= REFERENCES_MAX) { skipped++; return; }
      const e = entity(key, kind, label, facts, locate(offset));
      seen.set(key, e);
      entities.push(e);
    },
    state: () => {
      /** @type {ReferencesState} what an uncut reading adds: nothing */
      const uncut = {};
      return skipped ? { references_cut: true, references_skipped: skipped, references_limit: REFERENCES_MAX, sightings_limit: SIGHTINGS_MAX,
      references_why: localize("doctypes.windows.references_cut", "this text cites more than the {references} different references, or the {sightings} repeat citations, a reading keeps: {skipped} citation(s) were counted and not kept", { references: String(REFERENCES_MAX), sightings: String(SIGHTINGS_MAX), skipped: String(skipped) }) } : uncut;
    },
  };
}

/* ------------------------------------------------------------------------------------------------ the lines */

/**
 * The lines of a text held as offsets (`lineTable`): how many, where line `i` starts, and line `i` trimmed (`get`) or as it
 * stands (`raw`); an `i` outside the lines has no start and no line.
 * @typedef {Object} LineTable
 * @property {number} length
 * @property {(i: number) => number | undefined} start
 * @property {(i: number) => string | undefined} get
 * @property {(i: number) => string | undefined} raw
 */
/**
 * A line cut from the text: where it starts and ends, and its text.
 * @typedef {Object} LineAt
 * @property {number | undefined} start
 * @property {number} end
 * @property {string} text
 */
/**
 * The lines of a text held as their start offsets (`lineIndex`): how many, where line `i` starts and ends, line `i` cut
 * from the text, and the line an offset is in (-1 past the text).
 * @typedef {Object} LineIndex
 * @property {number} length
 * @property {(i: number) => number | undefined} start
 * @property {(i: number) => number} end
 * @property {(i: number) => LineAt} at
 * @property {(offset: number) => number} lineOf
 */

/** Calls `fn(line, offset, index)` for each line of `text` as `text.split(/\r?\n/)` gives them (a CR before the LF
 *  is not part of the line), without building the list; `offset` is where the line starts in `text`. A `true` from
 *  `fn` stops the walk and is returned.
 *  @param {GivenText} given
 *  @param {(line: string, offset: number, index: number) => unknown} fn
 *  @param {number} [from]
 *  @returns {boolean} */
export function eachLine(given, fn, from = 0) {
  const text = String(given || "");
  let start = from, index = 0;
  for (;;) {
    const nl = text.indexOf("\n", start);
    const end = nl < 0 ? text.length : (nl > start && text.charCodeAt(nl - 1) === 13 ? nl - 1 : nl);
    spend((nl < 0 ? text.length : nl + 1) - start);
    if (fn(text.slice(start, end), start, index++) === true) return true;
    if (nl < 0) return false;
    start = nl + 1;
  }
}

/** How many lines of `text`, trimmed, match `re` (what `selfNaming` counts).
 *  @param {GivenText} text @param {RegExp} re @returns {number} */
export function countLines(text, re) {
  let n = 0;
  eachLine(text, (l) => { if (re.test(l.trim())) n++; });
  return n;
}

/** The first `n` non-blank lines of `text`, trimmed.
 *  @param {GivenText} text @param {number} n @returns {string[]} */
export function firstLines(text, n) {
  /** @type {string[]} */
  const out = [];
  eachLine(text, (l) => { const t = l.trim(); if (t) out.push(t); return out.length >= n; });
  return out;
}

/** The lines of `text` as `text.split(/\r?\n/)` gives them, held as offsets only: `length`, `start(i)`, and `get(i)`,
 *  the line trimmed (a line is cut from the text when it is asked for).
 *  @param {GivenText} given
 *  @returns {LineTable} */
export function lineTable(given) {
  const text = String(given || "");
  let starts = new Uint32Array(1024), ends = new Uint32Array(1024), n = 0;
  eachLine(text, (l, at) => {
    if (n === starts.length) {
      const s = new Uint32Array(n * 2); s.set(starts); starts = s;
      const e = new Uint32Array(n * 2); e.set(ends); ends = e;
    }
    starts[n] = at; ends[n] = at + l.length; n++;
  });
  return {
    length: n,
    start: (i) => starts[i],
    get: (i) => (i >= 0 && i < n ? text.slice(starts[i], ends[i]).trim() : undefined),
    raw: (i) => (i >= 0 && i < n ? text.slice(starts[i], ends[i]) : undefined),
  };
}

/** The lines of `text` as `text.split("\n")` gives them (a CR stays in its line, which `lineTable` drops), held as
 *  their start offsets only (R38): `length`, `start(i)`, `end(i)`, `at(i)` (`{start, end, text}`, the line cut from the
 *  text when it is asked for) and `lineOf(offset)`, the index of the line whose start is at or before `offset` and whose
 *  end is at or after it (-1 past the text).
 *  @param {GivenText} given
 *  @returns {LineIndex} */
export function lineIndex(given) {
  const text = String(given || "");
  spend(text.length);
  let starts = new Uint32Array(1024), n = 0;
  for (let at = 0; ;) {
    if (n === starts.length) { const s = new Uint32Array(n * 2); s.set(starts); starts = s; }
    starts[n++] = at;
    const nl = text.indexOf("\n", at);
    if (nl < 0) break;
    at = nl + 1;
  }
  /** @param {number} i @returns {number} */
  const end = (i) => (i + 1 < n ? (starts[i + 1] ?? NaN) - 1 : text.length);
  return {
    length: n,
    start: (i) => starts[i],
    end,
    at: (i) => ({ start: starts[i], end: end(i), text: text.slice(starts[i], end(i)) }),
    lineOf(offset) {
      if (offset < 0 || offset > text.length) return -1;
      let lo = 0, hi = n - 1;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; const at = starts[mid]; if (at !== undefined && at <= offset) lo = mid; else hi = mid - 1; }
      return lo;
    },
  };
}
