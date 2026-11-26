/* Test helpers for jurisdictions: an independent reading of R3 (a value in a form), a system lookup as
 * id-spaces R13–R14 state it, a walk over every fact that carries a basis, and `legacy`: a fixed copy of
 * the local facts and recognisers in the code at `snapshot/pre-refactor-2026-09-25`, the oracle R21 and
 * R30 are judged against. The copy is frozen evidence, not product code.
 *
 * And the typed helpers the test files share: `must`, `held`, `viewOf`, `combinedOf`, `refusalOf` turn "not null" and
 * "combined" into a thrown failure; `loose`, `at`, `put`, `drop`, `pick` give a test a loose copy of a profile to break
 * on purpose and reach into it by the paths `validate` names. */

import { get } from "../index.mjs";
import { isObj, isList, listOr } from "../shared.mjs";
/** @import { Profile, View, Pattern, NormalPart, FormClean, SpaceName, CombineResult, Combined, CombineRefusal } from "../index.mjs" */
/** @import { Value, Fields } from "../shared.mjs" */

/* ---------------------------------------------------------------------------------------------- */
/* Typed shortcuts: a missing value or a refused combine is a failed test.                         */

/** `v`, or a thrown failure naming `what` when it is null or undefined.
 *  @template T
 *  @param {T | null | undefined} v
 *  @param {string} what
 *  @returns {T} */
export function must(v, what) {
  if (v === null || v === undefined) throw new Error(`${what}: missing`);
  return v;
}

/** The held profile with that id, as the caller's own copy; a thrown failure when none is held.
 *  @param {string} id
 *  @returns {Profile} */
export const held = (id) => must(get(id), `profile ${id}`);

/** The words of a refusal's errors, for a failure message.
 *  @param {CombineRefusal} r
 *  @returns {string} */
const refusalWords = (r) => r.errors.map((e) => `${e.code} at ${String(e.at)}: ${e.detail}`).join("; ");

/** What `combine` handed back when it combined; a thrown failure when it refused.
 *  @param {CombineResult} r
 *  @returns {Combined} */
export function combinedOf(r) {
  if (!r.ok) throw new Error(`combine refused: ${refusalWords(r)}`);
  return r;
}

/** The combined view; a thrown failure when `combine` refused.
 *  @param {CombineResult} r
 *  @returns {View} */
export const viewOf = (r) => combinedOf(r).view;

/** What `combine` handed back when it refused; a thrown failure when it combined.
 *  @param {CombineResult} r
 *  @returns {CombineRefusal} */
export function refusalOf(r) {
  if (r.ok) throw new Error("combine combined; a refusal was expected");
  return r;
}

/* ---------------------------------------------------------------------------------------------- */
/* A loose copy, for a test that breaks a profile on purpose.                                      */

/** A deep copy of a JSON-like value, read loosely: what `JSON.parse(JSON.stringify(v))` gives for a profile or a view
 *  (a member holding undefined is left out; undefined in a list becomes null).
 *  @param {Value} v
 *  @returns {object | string | number | bigint | boolean | symbol | null | undefined} */
function copy(v) {
  if (isList(v)) {
    /** @type {(object | string | number | bigint | boolean | symbol | null | undefined)[]} */
    const out = [];
    for (const x of v) { const c = copy(x); out.push(c === undefined ? null : c); }
    return out;
  }
  if (isObj(v)) {
    /** @type {Fields} */
    const out = {};
    for (const [k, x] of Object.entries(v)) { const c = copy(x); if (c !== undefined) out[k] = c; }
    return out;
  }
  return v;
}

/** A deep copy of a profile (or any plain object) a test may write anything into, to hand to `validate` or `combine`.
 *  @param {Value} v
 *  @returns {Fields} */
export function loose(v) {
  const c = copy(v);
  if (!isObj(c)) throw new Error("loose: not a plain object");
  return c;
}

/** The steps of a path as `validate` writes it: `a.b[2].c` is `a`, `b`, `2`, `c`.
 *  @param {string} path
 *  @returns {string[]} */
const steps = (path) => path.split(/\.|\[|\]\.?/).filter(Boolean);

/** One step down: a list's entry by its index, an object's member by its name.
 *  @param {Value} o
 *  @param {string} k
 *  @returns {Value} */
function step(o, k) {
  if (isList(o)) return o[Number(k)];
  if (isObj(o)) return o[k];
  throw new TypeError(`cannot read ${k} of ${String(o)}`);
}

/** The value at a path.
 *  @param {Value} p
 *  @param {string[]} path
 *  @returns {Value} */
const valueAt = (p, path) => path.reduce(step, p);

/** The object at a path (a walkFacts path, or any path `validate` names), to read or write loosely; a thrown failure when
 *  there is none.
 *  @param {Value} p
 *  @param {string} path
 *  @returns {Fields} */
export function at(p, path) {
  const o = valueAt(p, steps(path));
  if (!isObj(o)) throw new TypeError(`no object at ${path}`);
  return o;
}

/** Writes `value` at a path: a member of an object, or an entry of a list.
 *  @param {Value} p
 *  @param {string} path
 *  @param {Value} value
 *  @returns {void} */
export function put(p, path, value) {
  const s = steps(path);
  const last = must(s.pop(), `the last step of ${path}`);
  const o = valueAt(p, s);
  if (isList(o)) o[Number(last)] = value;
  else if (isObj(o)) o[last] = value;
  else throw new TypeError(`cannot write ${path}`);
}

/** Deletes what is at a path, as `delete` does.
 *  @param {Value} p
 *  @param {string} path
 *  @returns {void} */
export function drop(p, path) {
  const s = steps(path);
  const last = must(s.pop(), `the last step of ${path}`);
  const o = valueAt(p, s);
  if (isList(o)) delete o[Number(last)];
  else if (isObj(o)) delete o[last];
  else throw new TypeError(`cannot delete ${path}`);
}

/** The first entry of the list at `path` whose `field` is `value`, to read or write loosely; a thrown failure when none is.
 *  @param {Value} p
 *  @param {string} path
 *  @param {string} field
 *  @param {Value} value
 *  @returns {Fields} */
export function pick(p, path, field, value) {
  for (const e of listOr(valueAt(p, steps(path)))) if (isObj(e) && e[field] === value) return e;
  throw new Error(`no entry of ${path} with ${field} ${String(value)}`);
}

/* ---------------------------------------------------------------------------------------------- */
/* R3, read independently of the module.                                                           */

/** What `applyForm` reads of a form: a profile's or a view's form, or one a test writes out.
 *  @typedef {Object} FormReading
 *  @property {Pattern} pattern
 *  @property {NormalPart[]} normal
 *  @property {FormClean} [clean]
 */

/** @param {Pattern} p
 *  @returns {RegExp} */
const rx = (p) => new RegExp(p.re, p.flags || "");
/** @param {Pattern} p
 *  @returns {RegExp} */
const atStart = (p) => new RegExp(`^(?:${p.re})`, p.flags || "");

/** A value read in a form, or null.
 *  @param {FormReading} form
 *  @param {Value} raw
 *  @param {Pattern[]} [prefixes]
 *  @returns {string | null} */
export function applyForm(form, raw, prefixes = []) {
  let v = String(raw == null ? "" : raw).trim();
  for (const p of prefixes) v = v.replace(atStart(p), "");
  /** @type {FormClean} */
  const c = form.clean || {};
  for (const p of c.strip || []) v = v.replace(atStart(p), "");
  v = c.spaces === "remove" ? v.replace(/\s+/g, "") : v.replace(/\s+/g, " ").trim();
  if (c.upper) v = v.toUpperCase();
  if (!v) return null;
  const m = rx(form.pattern).exec(v);
  if (!m) return null;
  return form.normal.map((part) => {
    if (typeof part === "string") return part;
    const g0 = m[part.group] ?? part.default ?? "";
    const g1 = part.unpad ? g0.replace(/^0+(?=.)/, "") : g0;
    return part.upper ? g1.toUpperCase() : g1;
  }).join("");
}

/** A value recognised in a space.
 *  @typedef {Object} Recognised
 *  @property {SpaceName} space
 *  @property {string} form
 *  @property {string} normal
 *  @property {string | null} kind
 */

/** A value in a space of a view or profile: the first form that reads it; for enactment, the kind whose
 *  prefix it opens with.
 *  @param {Profile | View} view
 *  @param {SpaceName} space
 *  @param {Value} raw
 *  @returns {Recognised | null} */
export function recogniseIn(view, space, raw) {
  const spaces = view.spaces;
  const s = spaces && spaces[space];
  if (!s) return null;
  const cleaned = String(raw == null ? "" : raw).trim().replace(/\s+/g, " ");
  const kinds = s.kinds || [];
  const opens = kinds.find((k) => atStart(k.prefix).test(cleaned) && cleaned.replace(atStart(k.prefix), ""));
  const kind = opens ? opens.kind : null;
  /** @type {Pattern[]} */
  const prefixes = kind ? [must(kinds.find((k) => k.kind === kind), `kind ${kind}`).prefix] : [];
  for (const f of s.forms) {
    const normal = applyForm(f, cleaned, prefixes);
    if (normal != null) return { space, form: f.form, normal, kind };
  }
  return null;
}

/** An address read as a URL, or null when it is none.
 *  @param {Value} address
 *  @returns {URL | null} */
function urlOf(address) {
  try { return new URL(String(address)); } catch { return null; }
}

/** The system an address names.
 *  @typedef {Object} SystemAnswer
 *  @property {string | null} origin
 *  @property {boolean} [republishes]
 *  @property {boolean} [provenance_stated]
 *  @property {true} [mixed]
 */

/** The system an address names in a view or profile (id-spaces R13–R14).
 *  @param {Profile | View} view
 *  @param {Value} address
 *  @returns {SystemAnswer} */
export function systemOf(view, address) {
  const u = urlOf(address);
  if (!u) return { origin: null };
  const host = u.hostname.toLowerCase();
  const path = u.pathname + u.search;
  for (const s of view.systems || []) {
    if (!s.hosts.includes(host)) continue;
    const sp = s.path;
    if (sp && !rx(sp).test(path)) continue;
    return { origin: s.origin, republishes: s.republishes === true, provenance_stated: s.provenance_stated !== false };
  }
  if ((view.mixed_hosts || []).some((m) => m.host === host)) return { origin: null, mixed: true };
  return { origin: null };
}

/* ---------------------------------------------------------------------------------------------- */
/* Every fact that carries a basis, with the path validate names it by.                            */

/** Each fact of a profile or a view (or a part of one, such as `{ local_names }`) that carries a basis, read loosely,
 *  with the path `validate` names it by.
 *  @param {Value} p
 *  @param {(fact: Fields, path: string) => void} fn
 *  @returns {void} */
export function walkFacts(p, fn) {
  /** @param {Value} v @param {string} path */
  const one = (v, path) => { if (isObj(v)) fn(v, path); };
  /** @param {Value} arr @param {string} path */
  const each = (arr, path) => listOr(arr).forEach((e, i) => one(e, `${path}[${i}]`));
  /** @param {Value} v @returns {Fields} */
  const fields = (v) => (isObj(v) ? v : {});
  const q = fields(p);
  for (const [name, sv] of Object.entries(fields(q.spaces))) {
    const s = fields(sv);
    listOr(s.forms).forEach((f, i) => one(f, `spaces.${name}.forms[${i}]`));
    listOr(s.kinds).forEach((kv, i) => {
      one(kv, `spaces.${name}.kinds[${i}]`);
      const k = fields(kv);
      if (k.floor) one(k.floor, `spaces.${name}.kinds[${i}].floor`);
    });
  }
  each(q.systems, "systems"); each(q.mixed_hosts, "mixed_hosts"); each(q.crosswalks, "crosswalks");
  for (const [key, entries] of Object.entries(fields(q.vocabulary))) each(entries, `vocabulary.${key}`);
  const practice = fields(q.practice);
  if (practice.minutes_due_days) one(practice.minutes_due_days, "practice.minutes_due_days");
  if (q.locale) one(q.locale, "locale");
  if (q.time_zone) one(q.time_zone, "time_zone");
  each(q.search_terms, "search_terms"); each(q.records_laws, "records_laws"); each(q.standard_sources, "standard_sources");
  each(q.counterparties, "counterparties"); each(q.deadlines, "deadlines"); each(q.legal_organisations, "legal_organisations");
  each(q.holidays, "holidays");
  listOr(q.counterparties).forEach((cv, i) => { const c = fields(cv); if (c.hours) one(c.hours, `counterparties[${i}].hours`); });
  listOr(q.action_kinds).forEach((kv, i) => {
    one(kv, `action_kinds[${i}]`);
    const k = fields(kv);
    const venue = fields(k.venue);
    if (k.venue) one(k.venue, `action_kinds[${i}].venue`);
    if (k.venue && venue.hours) one(venue.hours, `action_kinds[${i}].venue.hours`);
    if (k.evidence) one(k.evidence, `action_kinds[${i}].evidence`);
    if (k.template && typeof k.template === "object") one(k.template, `action_kinds[${i}].template`);
    /* T33 (R48): the venue's channel facts */
    if (k.venue && venue.cutoff) one(venue.cutoff, `action_kinds[${i}].venue.cutoff`);
    if (k.venue && venue.receipt) one(venue.receipt, `action_kinds[${i}].venue.receipt`);
    if (k.venue) each(venue.outages, `action_kinds[${i}].venue.outages`);
  });
  /* T33 (R46–R54) */
  listOr(q.deadlines).forEach((dv, i) => { const d = fields(dv); if (d.observed) one(d.observed, `deadlines[${i}].observed`); });
  if (q.weekend) one(q.weekend, "weekend");
  if (q.instrument_key) one(q.instrument_key, "instrument_key");
  each(q.computation, "computation"); each(q.fiscal_year, "fiscal_year"); each(q.law_ranks, "law_ranks");
  each(q.proceeding_kinds, "proceeding_kinds"); each(q.proceeding_flows, "proceeding_flows");
  each(q.identifier_schemes, "identifier_schemes"); each(q.classification_schemes, "classification_schemes");
  each(q.lawful_demands, "lawful_demands"); each(q.recurrences, "recurrences");
  /* T37 (R70) */
  listOr(q.local_names).forEach((nv, i) => {
    one(nv, `local_names[${i}]`);
    const n = fields(nv);
    each(n.explanations, `local_names[${i}].explanations`); each(n.translations, `local_names[${i}].translations`);
  });
  /* T45 (R74, R76, R79–R82, R86): an office's and a venue's own zone, who may request, a kind's templates and venue
     facts, the legal facts, the procedure guides and the phrasings */
  listOr(q.counterparties).forEach((cv, i) => { const c = fields(cv); if (c.time_zone) one(c.time_zone, `counterparties[${i}].time_zone`); });
  listOr(q.records_laws).forEach((lv, i) => { const l = fields(lv); if (l.requesters) one(l.requesters, `records_laws[${i}].requesters`); });
  listOr(q.action_kinds).forEach((kv, i) => {
    const k = fields(kv);
    const venue = fields(k.venue);
    each(k.templates, `action_kinds[${i}].templates`);
    if (k.venue && venue.time_zone) one(venue.time_zone, `action_kinds[${i}].venue.time_zone`);
    if (k.venue) each(venue.facts, `action_kinds[${i}].venue.facts`);
  });
  each(q.legal_facts, "legal_facts"); each(q.procedure_guides, "procedure_guides"); each(q.phrasings, "phrasings");
  /* T48 (R89): the pointers, and a pointer's hours */
  each(q.pointers, "pointers");
  listOr(q.pointers).forEach((xv, i) => { const x = fields(xv); if (x.hours) one(x.hours, `pointers[${i}].hours`); });
  /* T50 (R93, R94): the records-request help block and the forums */
  if (q.records_help) one(q.records_help, "records_help");
  each(q.forums, "forums");
}
/** The object at a walkFacts path: `at`, kept under the name the test files first used. */
walkFacts.at = at;

/* ---------------------------------------------------------------------------------------------- */
/* The snapshot's code (`snapshot/pre-refactor-2026-09-25`), copied as the oracle.                 */

/** A form of the snapshot's recogniser.
 *  @typedef {Object} LegacyForm
 *  @property {string} form
 *  @property {(v: string) => RegExpExecArray | null} test
 *  @property {(m: RegExpExecArray) => string} normal
 */
/** A space of the snapshot's recogniser.
 *  @typedef {Object} LegacySpace
 *  @property {string} label
 *  @property {LegacyForm[]} forms
 */
/** What the snapshot's recogniser hands back; `kind` on the cms space only.
 *  @typedef {Object} LegacyRecognised
 *  @property {string} space
 *  @property {string} form
 *  @property {string} normal
 *  @property {string | null} [kind]
 */
/** A system of the snapshot's lookup.
 *  @typedef {Object} LegacySystem
 *  @property {string[]} hosts
 *  @property {RegExp | null} path
 *  @property {string} origin
 *  @property {boolean} [republishes]
 *  @property {boolean} [stated]
 */
/** What the snapshot's lookup hands back.
 *  @typedef {Object} LegacySystemAnswer
 *  @property {string | null} origin
 *  @property {boolean} [republication]
 *  @property {boolean} [provenance_stated]
 *  @property {true} [mixed]
 */
/** REC-206's shapes of a membership link.
 *  @typedef {Object} MembershipShape
 *  @property {string} shape
 *  @property {RegExp} item
 *  @property {RegExp} file
 */

/** A capture group of a match, "" when it did not take part.
 *  @param {RegExpExecArray} m
 *  @param {number} i
 *  @returns {string} */
const grp = (m, i) => m[i] ?? "";

/* bio-plane/src/idspaces.mjs */
const CMS_FLOOR = Object.freeze({ ordinance: 12274, resolution: 75950 });
const CMS_SHAPE = /^(?:C\.?\s?M\.?\s?S\.?\s*)?(\d{4,5})(?:\s*C\.?\s?M\.?\s?S\b\.?)?$/i;
const CMS_KIND = /^(ordinance|resolution)\s+(?:no\.?\s*|number\s+)?(.+)$/i;
const APN_SHAPE = /^0*(\d{1,3}[A-Z]?|[A-Z])-0*(\d{1,4})-0*(\d{1,3}[A-Z]?)(?:-0*(\d{1,2}))?$/;
/** @type {{ [space: string]: LegacySpace }} */
const ID_SPACES = {
  cms: { label: "resolution or ordinance number (C.M.S.)",
    forms: [{ form: "cms", test: (v) => CMS_SHAPE.exec(v.replace(/^(ordinance|resolution)\s+(no\.?\s*|number\s+)?/i, "")), normal: (m) => grp(m, 1) }] },
  project: { label: "project or capital improvement number",
    forms: [
      { form: "C#####", test: (v) => /^(C\d{5,6})$/.exec(v), normal: (m) => grp(m, 1) },
      { form: "P#####", test: (v) => /^(P\d{5,6})$/.exec(v), normal: (m) => grp(m, 1) },
      { form: "100xxxx", test: (v) => /^(100\d{4})$/.exec(v), normal: (m) => grp(m, 1) },
      { form: "100xxxx+suffix", test: (v) => /^(100\d{4}[A-Z])$/.exec(v), normal: (m) => grp(m, 1) },
    ] },
  fund: { label: "fund code", forms: [{ form: "####", test: (v) => /^(\d{4})$/.exec(v), normal: (m) => grp(m, 1) }] },
  apn: { label: "assessor's parcel number (APN)",
    forms: [{ form: "alameda-apn", test: (v) => APN_SHAPE.exec(v),
      normal: (m) => `${grp(m, 1).replace(/^0+(?=.)/, "")}-${Number(grp(m, 2))}-${grp(m, 3).replace(/^0+(?=.)/, "")}-${Number(m[4] || 0)}` }] },
};
/** @param {string} space
 *  @param {Value} raw
 *  @returns {string} */
function clean(space, raw) {
  let v = String(raw == null ? "" : raw).trim().replace(/\s+/g, " ");
  if (space === "project") v = v.replace(/^#\s*/, "").replace(/\s+/g, "").toUpperCase();
  if (space === "apn") v = v.replace(/^APN\s*/i, "").replace(/\s+/g, "").toUpperCase();
  return v;
}
/** @param {string} space
 *  @param {Value} raw
 *  @returns {LegacyRecognised | null} */
function recognise(space, raw) {
  const S = ID_SPACES[space];
  const v = clean(space, raw);
  if (!v) return null;
  for (const f of must(S, `legacy space ${space}`).forms) {
    const m = f.test(v);
    if (m) {
      /** @type {LegacyRecognised} */
      const out = { space, form: f.form, normal: f.normal(m) };
      if (space === "cms") { const k = CMS_KIND.exec(v); out.kind = k ? grp(k, 1).toLowerCase() : null; }
      return out;
    }
  }
  return null;
}
/** @type {LegacySystem[]} */
const ID_SYSTEMS = [
  { hosts: ["webapi.legistar.com"], path: /^\/v1\/oakland(\/|$)/i, origin: "oakland.legistar" },
  { hosts: ["oakland.legistar.com", "oakland.legistar1.com"], path: null, origin: "oakland.legistar" },
  { hosts: ["data.oaklandca.gov"], path: /vmzx-e5fe/i, origin: "oakland.budget" },
  { hosts: ["data.oaklandca.gov"], path: /c3xp-qcgn/i, republishes: true, stated: false, origin: "alameda.assessor" },
  { hosts: ["services5.arcgis.com", "data.acgov.org"], path: /(ROBnTHSNjoZ2Wm1P\/.*(Parcel|Assessor_Office))/i, origin: "alameda.assessor" },
  { hosts: ["aca-prod.accela.com"], path: /\/OAKLAND\//i, origin: "oakland.permits" },
  { hosts: ["www.oaklandauditor.com"], path: null, origin: "oakland.auditor" },
];
/** @type {{ [host: string]: string }} */
const MIXED_HOSTS = { "www.oaklandca.gov": "", "cao-94612.s3.us-west-2.amazonaws.com": "" };
/** @param {Value} address
 *  @returns {LegacySystemAnswer} */
function systemOfAddress(address) {
  const u = urlOf(address);
  if (!u) return { origin: null };
  const host = u.hostname.toLowerCase();
  const path = u.pathname + u.search;
  for (const s of ID_SYSTEMS) {
    if (!s.hosts.includes(host)) continue;
    const sp = s.path;
    if (sp && !sp.test(path)) continue;
    return { origin: s.origin, republication: !!s.republishes, provenance_stated: s.stated !== false };
  }
  if (Object.prototype.hasOwnProperty.call(MIXED_HOSTS, host)) return { origin: null, mixed: true };
  return { origin: null };
}

/** A deterministic corpus of values: the measured shapes, their formatting variants, and near misses.
 *  @returns {(string | null | undefined)[]} */
function corpus() {
  let seed = 20260926;
  /** @param {number} n
   *  @returns {number} */
  const rand = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  /** @type {Set<string | null | undefined>} */
  const out = new Set();
  const nums = ["1", "07", "123", "1234", "12274", "12273", "75950", "75949", "99999", "123456", "0012345", "00001"];
  const cmsPre = ["", "C.M.S. ", "CMS ", "C. M. S.", "c.m.s.", "ordinance ", "Ordinance No. ", "ORDINANCE NUMBER ",
    "resolution no.", "Resolution  No ", "resolution number ", "ordinance no. C.M.S. ", "motion no. "];
  const cmsSuf = ["", " C.M.S.", "C.M.S.", " CMS", " c.m.s", " C.M.S.X", " no"];
  for (const p of cmsPre) for (const n of nums) for (const s of cmsSuf) out.add(`${p}${n}${s}`);
  const projPre = ["", "#", "# ", "  #", "c", "C", "P", "p", "100", "Q"];
  const projBody = ["12345", "123456", "1234", "1234567", "0001", "3439", "3439A", "3439a", "1003439A", "C12345", "12 345"];
  for (const p of projPre) for (const b of projBody) out.add(`${p}${b}`);
  for (const f of ["1010", "2211", "7780", "123", "12345", " 1010 ", "10 10", "fund 1010", "2019"]) out.add(f);
  /** @type {(string | null)[][]} */
  const apnParts = [["8", "008", "0", "000", "12A", "012a", "A", "Z", "1234", "AB"],
    ["649", "0649", "1", "0", "12345", "00001"], ["12", "012", "1A", "001b", "1234", "0"], [null, "0", "00", "3", "03", "123"]];
  for (let i = 0; i < 1500; i++) {
    const [b, pg, pc, sub] = apnParts.map((a) => a[rand(a.length)]);
    const pre = ["", "APN ", "apn", "APN  ", " "][rand(5)];
    const sep = ["-", "-", "-", " - ", "/"][rand(5)];
    out.add(`${pre}${b}${sep}${pg}${sep}${pc}${sub == null ? "" : `${sep}${sub}`}`);
  }
  for (let i = 0; i < 600; i++) {
    const chars = "0123456789-CPMS.# ACPZ";
    let s = ""; const len = 1 + rand(10);
    for (let j = 0; j < len; j++) s += chars.charAt(rand(chars.length));
    out.add(s);
  }
  for (const s of ["", " ", null, undefined]) out.add(s);
  return [...out];
}

/** @returns {string[]} */
function addresses() {
  const hosts = [...new Set([...ID_SYSTEMS.flatMap((s) => s.hosts), ...Object.keys(MIXED_HOSTS), "example.com", "legistar.com"])];
  const paths = ["/", "/v1/oakland", "/v1/oakland/matters/1", "/v1/oaklandx/matters", "/v1/berkeley/matters", "/V1/OAKLAND/x",
    "/resource/vmzx-e5fe.json", "/resource/c3xp-qcgn.json", "/Resource/C3XP-QCGN", "/resource/abcd-1234.json",
    "/ROBnTHSNjoZ2Wm1P/arcgis/rest/services/Parcels/FeatureServer", "/robnthsnjoz2wm1p/x/Assessor_Office/y",
    "/ROBnTHSNjoZ2Wm1P/arcgis/rest/services/Roads", "/Welcome.aspx", "/CitizenAccess/OAKLAND/Cap", "/citizenaccess/oakland/", "/x?id=vmzx-e5fe"];
  /** @type {string[]} */
  const out = [];
  for (const h of hosts) for (const p of paths) out.push(`https://${h}${p}`);
  out.push("https://OAKLAND.LEGISTAR.COM/View.ashx", "not a url", "", "https://www.oaklandca.gov/documents/x.pdf");
  return out;
}

/** docprofile/doctypes/*: each local pattern, with lines it must and must not match.
 *  @returns {{ [key: string]: [string, boolean][] }} */
function vocabularySamples() {
  /** @type {{ [key: string]: RegExp[] }} */
  const oracle = {
    furniture: [/^City of Oakland$/i, /^Office of the City Clerk$/i, /^View Report$/i, /^View Legislation$/i,
      /^View (Attachment|Supplemental)\b/i, /^Attachments:$/i, /^Sponsors:$/i],
    bodies: [/(Committee|City Council|Commission|Board|Authority)\s*$/,
      /\b(?:CITY\s+COUNCIL|COUNCIL\s+OF\s+THE\s+CITY|BOARD\s+OF\s+[A-Z]+|COMMISSION|AUTHORITY|CITY\s+OF\s+[A-Z]+)\b/],
    member_titles: [/^Councilmember/i],
    enactment_markers: [/C\.?\s?M\.?\s?S\.?/i],
    codes: [/O\.?M\.?C\.?|Oakland\s+Municipal\s+Code/i],
    file_numbers: [/\d{2}-\d{4}/],
    report_titles: [/^(AGENDA|STAFF|INFORMATIONAL|CITY\s+ADMINISTRATOR'?S?)\s+REPORT\b/i],
    report_sections: [/^RECOMMENDATION\b/i, /^EXECUTIVE\s+SUMMARY\b/i, /^(BACKGROUND|LEGISLATIVE\s+HISTORY|BACKGROUND\s*\/\s*LEGISLATIVE\s+HISTORY)\b/i,
      /^ANALYSIS(\s+AND\s+POLICY\s+ALTERNATIVES)?\b/i, /^FISCAL\s+IMPACT\b/i, /^PUBLIC\s+OUTREACH\b/i, /^COORDINATION\b/i,
      /^SUSTAINABLE\s+OPPORTUNITIES\b/i, /^ACTION\s+REQUESTED\b/i, /^REASON\s+FOR\b/i],
    recommendation_openers: [/\bStaff\s+Recommends\s+That\b/i],
    template_blanks: [/^\s*INTRODUCED\s+BY\b[^\]]*\]\s*/i],
  };
  /** @type {{ [key: string]: string[] }} */
  const lines = {
    furniture: ["City of Oakland", "city of oakland", "City of Oakland Council", "Office of the City Clerk", "View Report", "view report",
      "View Legislation", "View Attachment A", "View Supplemental Report", "View Attachments", "Attachments:", "Sponsors:", "Page 3",
      "Printed on 7/15/2026", "Agenda - SUPPLEMENTAL", "Office of the City Auditor"],
    bodies: ["*Rules & Legislation Committee", "Concurrent Meeting of the Oakland", "and the City Council", "OAKLAND CITY COUNCIL",
      "Public Works Committee", "Planning Commission", "the council met", "BOARD OF PORT COMMISSIONERS", "Port Authority",
      "CITY OF OAKLAND", "Board", "board", "Councilmember Wang"],
    member_titles: ["Councilmember Wang", "councilmember fife", "Council President", "Mayor Barbara"],
    enactment_markers: ["C.M.S.", "CMS", "C. M. S.", "c.m.s", "CBS", "C.M."],
    codes: ["O.M.C. Section 8.28", "OMC Chapter 2", "Oakland Municipal Code", "Berkeley Municipal Code", "the code"],
    file_numbers: ["26-0910", "26-091", "2026-07", "file 25-1234 and", "abc"],
    report_titles: ["AGENDA REPORT", "Staff Report", "INFORMATIONAL REPORT", "CITY ADMINISTRATOR'S REPORT", "City Administrators Report",
      "ANNUAL REPORT", "the agenda report"],
    report_sections: ["RECOMMENDATION", "RECOMMENDATIONS", "EXECUTIVE SUMMARY", "BACKGROUND / LEGISLATIVE HISTORY", "LEGISLATIVE HISTORY",
      "ANALYSIS AND POLICY ALTERNATIVES", "ANALYSIS", "FISCAL IMPACT", "PUBLIC OUTREACH / INTEREST", "COORDINATION", "SUSTAINABLE OPPORTUNITIES",
      "ACTION REQUESTED OF THE CITY COUNCIL", "REASON FOR SUPPLEMENTAL", "CONCLUSION", "the fiscal impact"],
    recommendation_openers: ["Staff Recommends That The City Council", "staff recommends that", "Staff recommend that", "The Mayor Recommends That"],
    template_blanks: ["INTRODUCED BY COUNCILMEMBER [IF APPLICABLE]", "  introduced by [NAME]", "INTRODUCED BY THE MAYOR", "AN ORDINANCE INTRODUCED BY [X]"],
  };
  /** @type {{ [key: string]: [string, boolean][] }} */
  const out = {};
  for (const [k, ls] of Object.entries(lines)) {
    const res = must(oracle[k], `oracle ${k}`);
    /** @type {[string, boolean][]} */
    const samples = [];
    for (const l of ls) samples.push([l, res.some((re) => re.test(l))]);
    out[k] = samples;
  }
  return out;
}

/* REC-206's address shapes (`bio-plane/src/membership.mjs` on `land/worker/REC-206`, `MEMBERSHIP_SHAPES`),
   tested there against a link's whole URL. */
/** @type {MembershipShape[]} */
const MEMBERSHIP_SHAPES = [{
  shape: "legistar-gateway",
  item: /^https?:\/\/[a-z0-9-]+\.legistar\.com\/gateway\.aspx\?m=l&id=\/matter\.aspx\?key=\d+/i,
  file: /^https?:\/\/[a-z0-9-]+\.legistar\.com\/gateway\.aspx\?m=f&id=[^&#]+/i,
}];
/** @returns {string[]} */
function linkSamples() {
  const hosts = ["oakland.legistar.com", "oakland.legistar1.com", "OAKLAND.LEGISTAR.COM"];
  const rest = ["/gateway.aspx?M=L&ID=/matter.aspx?key=12345", "/Gateway.aspx?m=l&id=/Matter.aspx?key=7&x=1",
    "/gateway.aspx?M=L&ID=/matter.aspx?key=", "/gateway.aspx?M=L&ID=/meeting.aspx?key=1", "/gateway.aspx?M=F&ID=abc123.pdf",
    "/gateway.aspx?M=F&ID=", "/gateway.aspx?M=F&ID=#x", "/gateway.aspx?M=X&ID=1", "/View.ashx?M=F&ID=1", "/x/gateway.aspx?M=F&ID=1",
    "/LegislationDetail.aspx?ID=1", "/"];
  /** @type {string[]} */
  const out = [];
  for (const h of hosts) for (const r of rest) for (const scheme of ["https", "http"]) out.push(`${scheme}://${h}${r}`);
  return out;
}

/* bio-plane/checks/bio-checks.mjs, docprofile/doctypes/meeting-calendar.mjs, bio-plane/src/store.mjs */
const ACTION_KINDS = ["cpra_request", "grand_jury", "controller_referral", "public_comment", "media", "litigation_support", "request_for_comment", "other"];
const MINUTES_DUE_DAYS = 21;
const SEARCH_TERMS = ["oakland", "police"];

export const legacy = Object.freeze({ ID_SPACES, CMS_FLOOR, ID_SYSTEMS, MIXED_HOSTS, recognise, systemOfAddress,
  corpus, addresses, vocabularySamples, ACTION_KINDS, MINUTES_DUE_DAYS, SEARCH_TERMS, MEMBERSHIP_SHAPES, linkSamples });
