/* court-citations: Free Law Project's reporters-db and courts-db as versioned data (build/requirements/court-citations.md).
 * The data is the generated `court-data.mjs` (build.mjs), one JSON text; this file reads it on first use and adds the
 * variant index and two lookups. Pure: no store, no network, no clock (R8). A reporter recognised is a spelling
 * recognised, never a citation verified (R10). */
import { DATA } from "./court-data.mjs";

/* R11: evaluating this module builds none of the data. Each export is a plain binding to a proxy over an empty target
 * of the right kind; the first operation on any of them parses the JSON text once, fills every target with its data
 * and freezes it, and every operation after is forwarded to the filled target, so each reads exactly as the frozen
 * data would (its entries, length, prototype, frozenness; `Array.isArray` holds of the arrays). */
const TARGETS = { SOURCES: [], REPORTERS: [], COURTS: [], VARIANTS: Object.create(null) };
let loaded = false;
const freeze = (o) => { if (o && typeof o === "object" && !Object.isFrozen(o)) { for (const v of Object.values(o)) freeze(v); Object.freeze(o); } return o; };
function load() {
  if (loaded) return;
  loaded = true;
  const d = JSON.parse(DATA);
  for (const k of ["SOURCES", "REPORTERS", "COURTS"]) { for (const x of d[k]) TARGETS[k].push(freeze(x)); Object.freeze(TARGETS[k]); }
  variantIndex(TARGETS.REPORTERS, TARGETS.VARIANTS);
}
const TRAPS = ["get", "set", "has", "ownKeys", "getOwnPropertyDescriptor", "defineProperty", "deleteProperty", "getPrototypeOf",
  "setPrototypeOf", "isExtensible", "preventExtensions"];
const lazy = (target) => new Proxy(target, Object.fromEntries(TRAPS.map((t) => [t, (_, ...a) => { load(); return Reflect[t](target, ...a); }])));

/**
 * @typedef {Object} Edition one edition of a reporter, as reporters-db gives it
 * @property {string} key the edition's abbreviation
 * @property {string | null} start the first date the edition covers, null where the package gives none
 * @property {string | null} end the last date the edition covers, null where the package gives none
 * @property {ReadonlyArray<string>} patterns the edition's citation patterns, translated to JavaScript (R4)
 */
/**
 * @typedef {Object} Reporter one reporter of the pinned reporters-db (R1)
 * @property {string} key the standard abbreviation
 * @property {string} name
 * @property {string} cite_type
 * @property {ReadonlyArray<Edition>} editions
 * @property {Readonly<Object<string, string>>} variations each variant spelling the package gives, to the edition it stands for
 * @property {ReadonlyArray<string>} examples the package's own example citations
 */
/**
 * @typedef {Object} Court one court of the pinned courts-db (R2)
 * @property {string} id
 * @property {string} name
 * @property {string} citation_string
 * @property {string | null} type
 * @property {string | null} level
 * @property {string} system
 * @property {string | null} jurisdiction
 * @property {ReadonlyArray<Readonly<{start: (string | null), end: (string | null), [field: string]: *}>>} dates as the package gives them
 * @property {ReadonlyArray<string>} patterns the court's name patterns, translated to JavaScript (R4)
 * @property {string} name_pattern the court's name as a pattern, as courts-db matches it
 * @property {ReadonlyArray<string>} examples the package's own example names
 */
/**
 * @typedef {Object} Source one pinned package the data was built from (R3)
 * @property {string} package
 * @property {string} version
 * @property {string} licence
 * @property {string} url
 * @property {string} project
 * @property {Readonly<{url: string, sha256: string}>} wheel
 * @property {ReadonlyArray<Readonly<{name: string, sha256: string}>>} files each source file the build read, with its SHA-256
 * @property {Readonly<Object<string, number>>} counts what the build found, by name
 * @property {string} pattern_flags the JavaScript flags every translated pattern of the package is compiled with
 * @property {string} copyright
 * @property {string} licence_text the package's licence, whole
 * @bound licence: "BSD-2-Clause"
 */
/**
 * @typedef {Object} Variant one edition a spelling stands for (R1)
 * @property {string} reporter a reporter's key
 * @property {string} edition an edition's key of that reporter
 */

/**
 * R3: each pinned package, deeply frozen; built on first read (R11).
 * @type {ReadonlyArray<Source>}
 */
export const SOURCES = lazy(TARGETS.SOURCES);
/**
 * R1: every reporter of the pinned reporters-db, in the package's order, deeply frozen; built on first read (R11).
 * @type {ReadonlyArray<Reporter>}
 */
export const REPORTERS = lazy(TARGETS.REPORTERS);
/**
 * R2: every court of the pinned courts-db, in the package's order, deeply frozen; built on first read (R11).
 * @type {ReadonlyArray<Court>}
 */
export const COURTS = lazy(TARGETS.COURTS);

/* R1: every variant and every standard abbreviation → each {reporter, edition} it stands for, in REPORTERS order. */
function variantIndex(reporters, v) {
  const add = (spelling, reporter, edition) => {
    const list = (v[spelling] ??= []);
    if (!list.some((x) => x.reporter === reporter && x.edition === edition)) list.push({ reporter, edition });
  };
  for (const r of reporters) {
    for (const e of r.editions) add(e.key, r.key, e.key);
    for (const [spelling, edition] of Object.entries(r.variations)) add(spelling, r.key, edition);
  }
  for (const list of Object.values(v)) { for (const x of list) Object.freeze(x); Object.freeze(list); }
  return Object.freeze(v);
}
/**
 * R1: every variant and every standard abbreviation, to each edition it stands for, deeply frozen; built on first read (R11).
 * @type {Readonly<Object<string, ReadonlyArray<Readonly<Variant>>>>}
 * @bound a spelling the package maps to more than one edition maps to each, never to one chosen
 */
export const VARIANTS = lazy(TARGETS.VARIANTS);

/* R7: white space and periods folded away, the only differences between many of the package's variants. */
const fold = (s) => s.replace(/[\s.]+/gu, "");
let folded = null;
function foldedIndex() {
  if (folded) return folded;
  folded = new Map();
  for (const [spelling, list] of Object.entries(VARIANTS)) {
    const k = fold(spelling), acc = folded.get(k) ?? [];
    for (const x of list) if (!acc.some((y) => y.reporter === x.reporter && y.edition === x.edition)) acc.push(x);
    folded.set(k, acc);
  }
  return folded;
}

/**
 * R7: VARIANTS' entries for a spelling as written, else after folding white space and periods, else null.
 * @param {*} spelling
 * @returns {ReadonlyArray<Readonly<Variant>> | null}
 * @bound never throws, for any input; not a string, or nothing left after folding, is null
 */
export function reporterFor(spelling) {
  if (typeof spelling !== "string") return null;
  if (Object.hasOwn(VARIANTS, spelling)) return VARIANTS[spelling];
  const k = fold(spelling);
  if (k === "") return null;
  const hit = foldedIndex().get(k);
  return hit ? Object.freeze(hit.slice()) : null;
}

/* courts-db's strip_punc, with Python's white-space set: runs of two or more become one space; the ends trimmed. */
const PY_SPACE = "\\t\\n\\v\\f\\r\\x1c-\\x20\\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const RUNS = new RegExp(`[${PY_SPACE}]{2,}`, "gu"), ENDS = new RegExp(`^[${PY_SPACE}]+|[${PY_SPACE}]+$`, "gu");
const flags = () => SOURCES.find((s) => s.package === "courts-db").pattern_flags;
let compiled = null;
function courtMatchers() {
  if (compiled) return compiled;
  const fl = flags();
  compiled = COURTS.map((c) => ({ id: c.id, res: [...c.patterns, ...(c.name_pattern ? [c.name_pattern] : [])].map((p) => new RegExp(`^(?:${p})$`, fl)) }));
  return compiled;
}

/**
 * R7: the ids of every court one of whose patterns (or its name, as courts-db matches it) matches the whole text,
 * case-insensitively, after courts-db's white-space folding; in COURTS order, or [].
 * @param {*} text
 * @returns {string[]}
 * @bound never throws, for any input; not a string, or only white space, is []
 */
export function courtsNamed(text) {
  if (typeof text !== "string") return [];
  const s = text.replace(RUNS, " ").replace(ENDS, "");
  if (s === "") return [];
  return courtMatchers().filter((c) => c.res.some((r) => r.test(s))).map((c) => c.id);
}
