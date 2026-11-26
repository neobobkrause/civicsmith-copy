/* court-citations: Free Law Project's reporters-db and courts-db as versioned data (build/requirements/court-citations.md).
 * The data is the generated `court-data.mjs` (build.mjs), one JSON text; this file reads it on first use and adds the
 * variant index and two lookups. Pure: no store, no network, no clock (R8). A reporter recognised is a spelling
 * recognised, never a citation verified (R10). */
import { DATA } from "./court-data.mjs";

/**
 * One edition of a reporter (R1): its abbreviation, its date range as the package gives it, and its patterns translated.
 * @typedef {Object} Edition
 * @property {string} key
 * @property {string | null} start
 * @property {string | null} end
 * @property {string[]} patterns
 */
/**
 * One reporter entry of reporters-db (R1).
 * @typedef {Object} Reporter
 * @property {string} key the standard abbreviation
 * @property {string} name
 * @property {string} cite_type
 * @property {Edition[]} editions
 * @property {{[spelling: string]: string}} variations each variant spelling, to the edition it stands for
 * @property {string[]} examples
 */
/**
 * One of a court's date ranges as courts-db gives it (R2).
 * @typedef {Object} CourtDate
 * @property {string | null} start
 * @property {string | null} end
 * @property {string} [name]
 * @property {string} [reason]
 * @property {string} [notes]
 * @property {string | string[]} [reorganization]
 * @property {string[]} [reorg]
 * @property {string[]} [reorganization_dates]
 */
/**
 * One court of courts-db (R2).
 * @typedef {Object} Court
 * @property {string} id
 * @property {string} name
 * @property {string | null} citation_string
 * @property {string | null} type
 * @property {string | null} level
 * @property {string | null} system
 * @property {string | null} jurisdiction
 * @property {CourtDate[]} dates
 * @property {string[]} patterns the court's name patterns, translated (R4)
 * @property {string | null} name_pattern the court's name, as courts-db matches it, translated
 * @property {string[]} examples
 */
/**
 * A source file the build read, with its SHA-256 (R3).
 * @typedef {Object} SourceFile
 * @property {string} name
 * @property {string} sha256
 */
/**
 * The counts the build found (R3): reporters-db's reporters, entries, editions, variations and patterns; courts-db's
 * courts, patterns and patterns shipped.
 * @typedef {Object} SourceCounts
 * @property {number} [reporters]
 * @property {number} [entries]
 * @property {number} [editions]
 * @property {number} [variations]
 * @property {number} [courts]
 * @property {number} [patterns]
 * @property {number} [patterns_shipped]
 */
/**
 * The wheel a package's files came from.
 * @typedef {Object} Wheel
 * @property {string} url
 * @property {string} sha256
 */
/**
 * One package the data came from (R3).
 * @typedef {Object} Source
 * @property {string} package
 * @property {string} version
 * @property {string} licence
 * @property {string} url
 * @property {string} project
 * @property {Wheel | null} wheel
 * @property {SourceFile[]} files
 * @property {SourceCounts} counts
 * @property {string} pattern_flags the JavaScript flags its patterns are compiled with
 * @property {string | null} copyright
 * @property {string} licence_text the package's licence, whole
 */
/**
 * The generated data file's one JSON text, parsed (R11).
 * @typedef {Object} CourtData
 * @property {Source[]} SOURCES
 * @property {Reporter[]} REPORTERS
 * @property {Court[]} COURTS
 */
/**
 * A reporter and edition a spelling stands for (R1).
 * @typedef {Object} VariantEntry
 * @property {string} reporter
 * @property {string} edition
 */
/** @typedef {{readonly [spelling: string]: readonly VariantEntry[]}} Variants every spelling, to each entry it stands for */

/* R11: evaluating this module builds none of the data. Each export is a plain binding to a proxy over an empty target
 * of the right kind; the first operation on any of them parses the JSON text once, fills every target with its data
 * and freezes it, and every operation after is forwarded to the filled target, so each reads exactly as the frozen
 * data would (its entries, length, prototype, frozenness; `Array.isArray` holds of the arrays). */
/** @type {Source[]} */
const SOURCES_TARGET = [];
/** @type {Reporter[]} */
const REPORTERS_TARGET = [];
/** @type {Court[]} */
const COURTS_TARGET = [];
/** @type {{[spelling: string]: VariantEntry[]}} */
const VARIANTS_TARGET = {};
Reflect.setPrototypeOf(VARIANTS_TARGET, null);
let loaded = false;
/* Each datum frozen whole, its every part first, as the data's own shape gives them. */
/** @param {Source} s */
function freezeSource(s) {
  const wheel = s.wheel;
  if (wheel) Object.freeze(wheel);
  for (const f of s.files) Object.freeze(f);
  Object.freeze(s.files); Object.freeze(s.counts); Object.freeze(s);
}
/** @param {Reporter} r */
function freezeReporter(r) {
  for (const e of r.editions) { Object.freeze(e.patterns); Object.freeze(e); }
  Object.freeze(r.editions); Object.freeze(r.variations); Object.freeze(r.examples); Object.freeze(r);
}
/** @param {Court} c */
function freezeCourt(c) {
  for (const d of c.dates) {
    const reorganization = d.reorganization;
    if (Array.isArray(reorganization)) Object.freeze(reorganization);
    const reorg = d.reorg, dates = d.reorganization_dates;
    if (reorg) Object.freeze(reorg);
    if (dates) Object.freeze(dates);
    Object.freeze(d);
  }
  Object.freeze(c.dates); Object.freeze(c.patterns); Object.freeze(c.examples); Object.freeze(c);
}
function load() {
  if (loaded) return;
  loaded = true;
  const d = /** @type {CourtData} decodes this module's own data file */ (JSON.parse(DATA));
  for (const x of d.SOURCES) { freezeSource(x); SOURCES_TARGET.push(x); }
  Object.freeze(SOURCES_TARGET);
  for (const x of d.REPORTERS) { freezeReporter(x); REPORTERS_TARGET.push(x); }
  Object.freeze(REPORTERS_TARGET);
  for (const x of d.COURTS) { freezeCourt(x); COURTS_TARGET.push(x); }
  Object.freeze(COURTS_TARGET);
  variantIndex(REPORTERS_TARGET, VARIANTS_TARGET);
}
/** @type {ProxyHandler<object>} */
const LAZY = {
  get: (t, k, r) => { load(); return Reflect.get(t, k, r); },
  set: (t, k, v, r) => { load(); return Reflect.set(t, k, v, r); },
  has: (t, k) => { load(); return Reflect.has(t, k); },
  ownKeys: (t) => { load(); return Reflect.ownKeys(t); },
  getOwnPropertyDescriptor: (t, k) => { load(); return Reflect.getOwnPropertyDescriptor(t, k); },
  defineProperty: (t, k, a) => { load(); return Reflect.defineProperty(t, k, a); },
  deleteProperty: (t, k) => { load(); return Reflect.deleteProperty(t, k); },
  getPrototypeOf: (t) => { load(); return Reflect.getPrototypeOf(t); },
  setPrototypeOf: (t, p) => { load(); return Reflect.setPrototypeOf(t, p); },
  isExtensible: (t) => { load(); return Reflect.isExtensible(t); },
  preventExtensions: (t) => { load(); return Reflect.preventExtensions(t); },
};

/** @type {ProxyHandler<Source[]>} */
const LAZY_SOURCES = LAZY;
/** @type {ProxyHandler<Reporter[]>} */
const LAZY_REPORTERS = LAZY;
/** @type {ProxyHandler<Court[]>} */
const LAZY_COURTS = LAZY;
/** @type {ProxyHandler<{[spelling: string]: VariantEntry[]}>} */
const LAZY_VARIANTS = LAZY;

/** @type {readonly Source[]} R3 */
export const SOURCES = new Proxy(SOURCES_TARGET, LAZY_SOURCES);
/** @type {readonly Reporter[]} R1 */
export const REPORTERS = new Proxy(REPORTERS_TARGET, LAZY_REPORTERS);
/** @type {readonly Court[]} R2 */
export const COURTS = new Proxy(COURTS_TARGET, LAZY_COURTS);

/* R1: every variant and every standard abbreviation → each {reporter, edition} it stands for, in REPORTERS order. */
/**
 * @param {readonly Reporter[]} reporters
 * @param {{[spelling: string]: VariantEntry[]}} v
 * @returns {Variants}
 */
function variantIndex(reporters, v) {
  /** @type {(spelling: string, reporter: string, edition: string) => void} */
  const add = (spelling, reporter, edition) => {
    const list = (v[spelling] ??= []);
    if (!list.some((x) => x.reporter === reporter && x.edition === edition)) list.push({ reporter, edition });
  };
  for (const r of reporters) {
    for (const e of r.editions) add(e.key, r.key, e.key);
    for (const [spelling, edition] of Object.entries(r.variations)) add(spelling, r.key, edition);
  }
  for (const list of Object.values(v)) { for (const x of list) Object.freeze(x); Object.freeze(list); }
  Object.freeze(v);
  return v;
}
/** @type {Variants} R1 */
export const VARIANTS = new Proxy(VARIANTS_TARGET, LAZY_VARIANTS);

/* R7: white space and periods folded away, the only differences between many of the package's variants. */
/** @param {string} s */
const fold = (s) => s.replace(/[\s.]+/gu, "");
/** @type {Map<string, VariantEntry[]> | null} */
let folded = null;
function foldedIndex() {
  const done = folded;
  if (done) return done;
  /** @type {[string, VariantEntry[]][]} */
  const none = [];
  const index = new Map(none);
  folded = index;
  for (const [spelling, list] of Object.entries(VARIANTS)) {
    const k = fold(spelling), acc = index.get(k) ?? [];
    for (const x of list) if (!acc.some((y) => y.reporter === x.reporter && y.edition === x.edition)) acc.push(x);
    index.set(k, acc);
  }
  return index;
}

/* R7: VARIANTS' entries for a spelling as written, else after folding, else null. Never throws. */
/**
 * @param {unknown} spelling
 * @returns {readonly VariantEntry[] | null}
 */
export function reporterFor(spelling) {
  if (typeof spelling !== "string") return null;
  const asWritten = VARIANTS[spelling];
  if (Object.hasOwn(VARIANTS, spelling) && asWritten) return asWritten;
  const k = fold(spelling);
  if (k === "") return null;
  const hit = foldedIndex().get(k);
  return hit ? Object.freeze(hit.slice()) : null;
}

/* courts-db's strip_punc, with Python's white-space set: runs of two or more become one space; the ends trimmed. */
const PY_SPACE = "\\t\\n\\v\\f\\r\\x1c-\\x20\\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const RUNS = new RegExp(`[${PY_SPACE}]{2,}`, "gu"), ENDS = new RegExp(`^[${PY_SPACE}]+|[${PY_SPACE}]+$`, "gu");
function flags() {
  const courts = SOURCES.find((s) => s.package === "courts-db");
  if (!courts) throw new TypeError("courts-db is not among SOURCES");
  return courts.pattern_flags;
}
/** @typedef {{id: string, res: RegExp[]}} CourtMatcher */
/** @type {CourtMatcher[] | null} */
let compiled = null;
function courtMatchers() {
  const done = compiled;
  if (done) return done;
  const fl = flags();
  /** @type {CourtMatcher[]} */
  const matchers = COURTS.map((c) => {
    const name = c.name_pattern;
    return { id: c.id, res: [...c.patterns, ...(name ? [name] : [])].map((p) => new RegExp(`^(?:${p})$`, fl)) };
  });
  compiled = matchers;
  return matchers;
}

/* R7: the ids of every court one of whose patterns (or its name, as courts-db matches it) matches the whole text,
 * case-insensitively, after courts-db's white-space folding; in COURTS order, or []. Never throws. */
/**
 * @param {unknown} text
 * @returns {string[]}
 */
export function courtsNamed(text) {
  if (typeof text !== "string") return [];
  const s = text.replace(RUNS, " ").replace(ENDS, "");
  if (s === "") return [];
  return courtMatchers().filter((c) => c.res.some((r) => r.test(s))).map((c) => c.id);
}
