/* id-spaces — whether one identifier, appearing in two captured documents, is a shared identifier that
 * counts as a connection (`build/requirements/id-spaces.md`; `docs/architecture/BIO_Content_Framework_v0_10.md`
 * §8.3 "WHAT MAKES A SHARED IDENTIFIER COUNT", with BOB #34's amendment to rule 3, 2026-09-25).
 *
 * PURE: no store, no network, no clock (R23). It names no place (R24): every local fact (the spaces' forms,
 * the enactment kinds and their coverage floors, the publishing systems, the mixed hosts, the crosswalks)
 * comes from `view`, the combined view of the active jurisdiction profiles that `jurisdictions.combine`
 * gives. `view.conflicts` (or a whole `combine` result, `{ok, view, conflicts}`) carries the facts combine
 * withheld because the profiles disagree; a fact withheld is a fact this module does not have.
 *
 * THE RULE, as this file enforces it:
 *   1. A match COUNTS when the REFERENT agrees in two INDEPENDENT systems. Two publications of one source
 *      are ONE system: a republication is judged as the system it republishes. A fund code counts only
 *      when the fund NAME agrees too; a bare code never counts.
 *   2. A space may run in several FORMS AT ONCE, told apart by SHAPE, never by date. A value matches
 *      across forms only through a crosswalk the view supplies; otherwise the two stay UNJOINED.
 *   3. Below an enactment kind's coverage floor a number is OUTSIDE THE RECORD'S REACH, never absent. A
 *      parcel is RETIRED only where the assessor's own lineage records it; otherwise UNDETERMINED.
 *
 * WHAT IT CANNOT DO, stated: it cannot READ a referent. Agreement is either a determinate check (the fund
 * NAME, compared normalised) or a reading the caller supplies, returned labelled as theirs.
 *
 * It imports only `court-citations`' reporter data: the view's shape is `jurisdictions.combine`'s, which the caller makes. (R26, the
 * legacy adapter under the old names, is retired: entry N105, K143.)
 *
 * It also RECOGNISES court citations (R27–R29): volume, reporter, page, the reporter known only from the
 * reporter data `court-citations` holds (or the same data passed in). A citation recognised is a spelling
 * recognised, never a case resolved.
 *
 * And it RECOGNISES citations of a policy series' items and standard designations (R30–R33), every series,
 * issuer and pattern read from the view's `standard_sources` (`jurisdictions` R63). A citation read is never a
 * resolution, and an edition not written is never supplied. */

import * as CourtCitations from "../../court-citations/index.mjs";
import { word, localize } from "./setup-words/index.mjs";

/** @import { ViewSpaces, ViewSpace, ViewEnactmentKind, ViewStandardSource, Tagged, System, MixedHost, Crosswalk, Form, FormClean, Pattern, NormalPart, Conflict, StandardSourceKind } from "../../jurisdictions/index.mjs" */

/* ---------------------------------------------------------------- the kinds this module takes and hands back (S4) */

/**
 * The twelve identifier spaces, in R1's order.
 * @typedef {"enactment" | "project" | "fund" | "parcel" | "account" | "object" | "vendor" | "proceeding" | "person" | "body" | "office" | "institution"} IdSpace
 */
/**
 * The parts of the combined view this module reads (R1–R33), each as `jurisdictions.combine` gives it, with the
 * conflicts combine reported beside it. A view `combine` made, with or without its conflicts, is one; a value with a
 * `view` of its own is read as a whole `combine` answer.
 * @typedef {{ readonly view?: undefined, readonly spaces?: ViewSpaces, readonly systems?: readonly Tagged<System>[], readonly mixed_hosts?: readonly Tagged<MixedHost>[], readonly crosswalks?: readonly Tagged<Crosswalk>[], readonly standard_sources?: readonly ViewStandardSource[], readonly conflicts?: readonly Conflict[] }} IdView
 */
/**
 * A whole `combine` answer, read as its view with its conflicts.
 * @typedef {{ readonly ok: boolean, readonly view: IdView, readonly conflicts?: readonly Conflict[] }} CombinedView
 */
/**
 * What every service but `parcelStanding` and `recogniseCitations` takes as its view.
 * @typedef {CombinedView | IdView} ViewArg
 */
/**
 * One space as `spaces` lists it (R1, R2).
 * @typedef {Object} SpaceEntry
 * @property {IdSpace} space
 * @property {string} label
 * @property {"name" | "reading"} referent
 * @property {Tagged<Form>[]} forms
 */
/**
 * Whether an enactment number is inside the record's reach (R6–R9).
 * @typedef {Object} Reach
 * @property {"INSIDE" | "OUTSIDE_REACH" | "UNDETERMINED"} reach
 * @property {number} [floor]
 * @property {string} says
 */
/**
 * One value recognised in one space (R3–R5); `kind` and `reach` on an enactment only.
 * @typedef {Object} Recognised
 * @property {IdSpace} space
 * @property {string} value
 * @property {string} form
 * @property {string} normal
 * @property {string | null} [kind]
 * @property {Reach} [reach]
 */
/**
 * One retirement record of the assessor's lineage (R11).
 * @typedef {Object} LineageRecord
 * @property {number} roll_year
 * @property {readonly string[]} [children]
 */
/**
 * The keys in the assessor's current layer (R10).
 * @typedef {Set<string> | readonly string[]} ParcelCurrent
 */
/**
 * The assessor's own retirement records, by key (R11).
 * @typedef {Map<string, LineageRecord | readonly LineageRecord[]> | { readonly [key: string]: LineageRecord | readonly LineageRecord[] }} ParcelLineage
 */
/**
 * The assessor's evidence for a parcel key (R10–R12); every part may be missing.
 * @typedef {Object} ParcelEvidence
 * @property {ParcelCurrent} [current]
 * @property {ParcelLineage} [lineage]
 * @property {readonly string[]} [vintages] the names of the published vintages searched
 */
/**
 * A parcel key's standing (R10–R12); `between` on UNDETERMINED only.
 * @typedef {Object} ParcelStanding
 * @property {"CURRENT" | "RETIRED" | "UNDETERMINED"} standing
 * @property {number} [roll_year]
 * @property {string[]} [children]
 * @property {string[]} [between]
 * @property {string[]} vintages_searched
 * @property {string} says
 */
/**
 * One address's own answer, as `systemOf` lists it under `each`.
 * @typedef {{ address: string, origin: string, name: string, republication: boolean, provenance_stated: boolean, basis: string | null } | { address: string, origin: null, why: string }} SystemEach
 */
/**
 * The system a capture belongs to (R13–R15), or no system and why.
 * @typedef {{ origin: string, name: string, republication: boolean, provenance_stated: boolean, basis: string | null, addresses: string[] } | { origin: null, addresses: string[], why: string, each?: SystemEach[] }} SystemOf
 */
/**
 * One end of a pair (R16): the value recognised, the system that published it, and, for a fund, its name.
 * @typedef {Object} PairEnd
 * @property {Recognised | null} [rec]
 * @property {SystemOf} [system]
 * @property {unknown} [name] the fund's name as written; any value not a name reads as none
 */
/**
 * §8.3's verdict over one pair (R16–R22).
 * @typedef {"SHARED" | "FORMS_UNJOINED" | "VALUES_DIFFER" | "SYSTEM_UNDETERMINED" | "SAME_SYSTEM" | "FUND_NAME_ABSENT" | "REFERENT_UNREAD" | "REFERENT_DISAGREES"} Verdict
 */
/**
 * @typedef {Object} Judgement
 * @property {Verdict} verdict
 * @property {boolean} counts
 * @property {string} says
 * @property {boolean} [near_miss]
 * @property {{ by: string, agrees: boolean }} [referent]
 */
/**
 * One court citation recognised (R27).
 * @typedef {Object} Citation
 * @property {number} volume
 * @property {string} reporter
 * @property {string} variant
 * @property {number} page
 * @property {number} [pin]
 * @property {number} start
 * @property {number} end
 */
/**
 * A run of text with a citation's shape and no reporter recognised (R28).
 * @typedef {{ text: string, start: number, end: number }} CitationShape
 */
/**
 * A run whose spelling the data gives to more than one reporter (R27): listed with each.
 * @typedef {{ text: string, start: number, end: number, variant: string, reporters: string[] }} CitationAmbiguous
 */
/**
 * @typedef {Object} CitationsUndetermined
 * @property {string} why
 * @property {CitationShape[]} [unrecognised]
 * @property {CitationAmbiguous[]} [ambiguous]
 */
/**
 * The court citations in a text (R27–R29).
 * @typedef {{ citations: Citation[], undetermined?: CitationsUndetermined }} Citations
 */
/**
 * One citation of a series' item or a standard's designation (R30).
 * @typedef {Object} SeriesCitation
 * @property {string} key
 * @property {string} series
 * @property {string | null} label
 * @property {StandardSourceKind | null} kind
 * @property {string | null} issuer
 * @property {string} number
 * @property {string} normal
 * @property {string} [portion]
 * @property {string} [edition]
 * @property {number} start
 * @property {number} end
 * @property {string | null} basis
 * @property {string | null} profile
 */
/**
 * @typedef {{ text: string, start: number, end: number, readings: SeriesCitation[] }} SeriesAmbiguous
 */
/**
 * A family the view withholds (R31), named.
 * @typedef {{ key: string, series: string, at?: string[], says: string }} SeriesWithheld
 */
/**
 * A series the view holds and this module cannot read (R31).
 * @typedef {{ source: string | null, why: string } | { key: string, series: string, why: string }} SeriesUnreadable
 */
/**
 * @typedef {Object} SeriesUndetermined
 * @property {string} why
 * @property {SeriesAmbiguous[]} [ambiguous]
 * @property {SeriesWithheld[]} [conflicts]
 * @property {SeriesUnreadable[]} [unreadable]
 */
/**
 * The policy-series and standard citations in a text (R30–R33).
 * @typedef {{ citations: SeriesCitation[], undetermined?: SeriesUndetermined }} SeriesCitations
 */

/* ---------------------------------------------------------------- the spaces */

/** @typedef {{ label: string, referent: "name" | "reading" }} SpaceDef */
/* The twelve spaces, in R1's order, their generic labels (used only when the view gives none) and what their
   referent is. `account`, `object` and `vendor` are the money record's identifiers; `proceeding` a proceeding's
   number in its forum's forms (K1452); `person` one form per person scheme (B1b.3), so two schemes' numbers
   are two forms and never join without a crosswalk (R17); `body` a body's number in a legislative system and
   `office` an office record's number, one seat's holding (N569, N613); `institution` one form per institution
   scheme, as `person` (N574, K1729). */
/** @type {Readonly<{ enactment: SpaceDef, project: SpaceDef, fund: SpaceDef, parcel: SpaceDef, account: SpaceDef, object: SpaceDef, vendor: SpaceDef, proceeding: SpaceDef, person: SpaceDef, body: SpaceDef, office: SpaceDef, institution: SpaceDef }>} */
const SPACES = Object.freeze({
  enactment: { label: word("idspaces.label.enactment_number_ordinance"), referent: "reading" },
  project: { label: "project number", referent: "reading" },
  fund: { label: "fund code", referent: "name" },
  parcel: { label: "parcel number", referent: "reading" },
  account: { label: "account code", referent: "reading" },
  object: { label: "object code", referent: "reading" },
  vendor: { label: "vendor number", referent: "reading" },
  proceeding: { label: word("idspaces.label.proceeding_case_number"), referent: "reading" },
  person: { label: word("idspaces.label.person_identifier_form"), referent: "reading" },
  body: { label: word("idspaces.label.body_number_body"), referent: "reading" },
  office: { label: word("idspaces.label.office_record_number"), referent: "reading" },
  institution: { label: word("idspaces.label.institution_identifier_form"), referent: "reading" },
});
/** @type {readonly IdSpace[]} the keys of SPACES, in their order */
const SPACE_NAMES = ["enactment", "project", "fund", "parcel", "account", "object", "vendor", "proceeding", "person", "body", "office", "institution"];
/** @param {unknown} s @returns {boolean} */
const isSpaceName = (s) => SPACE_NAMES.some((n) => n === s);
/** @param {string} s @returns {s is IdSpace} */
const isSpace = (s) => isSpaceName(s);
/** @param {unknown} o @param {PropertyKey} k @returns {boolean} */
const has = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k);
/** A value whose members this module reads one by one, each as any value.
 *  @typedef {{ readonly [key: string]: unknown }} Fields */
/** A list whose entries this module reads one by one, each as any value.
 *  @typedef {readonly unknown[]} Entries */
/** @param {unknown} o @returns {o is Fields} */
const isObj = (o) => o != null && typeof o === "object";
/** @param {unknown} x @returns {x is Entries} */
const isList = (x) => Array.isArray(x);
/**
 * An empty map of the kinds its declared place names.
 * @template K, V
 * @param {readonly (readonly [K, V])[]} entries
 * @returns {Map<K, V>}
 */
const mapOf = (entries) => new Map(entries);
/** @returns {string[]} */
const noStrings = () => [];

/* ---------------------------------------------------------------- the view, read defensively (never throws) */

/** @param {ViewArg} v @returns {v is CombinedView} */
const isCombined = (v) => has(v, "view") && "view" in v && isObj(v.view) && has(v, "ok");

/**
 * @param {ViewArg | null | undefined} v
 * @returns {{ view: IdView, conflicts: readonly Conflict[] }}
 */
function viewOf(v) {
  if (v == null || !isObj(v)) return { view: {}, conflicts: [] };
  if (isCombined(v)) {
    const inner = v.view;
    const own = v.conflicts;
    if (own != null && isList(own)) return { view: inner, conflicts: own };
    const held = inner.conflicts;
    return { view: inner, conflicts: held != null && isList(held) ? held : [] };
  }
  const own = v.conflicts;
  return { view: v, conflicts: own != null && isList(own) ? own : [] };
}
/**
 * @template T
 * @param {readonly T[] | null | undefined} x
 * @returns {readonly T[]}
 */
const arr = (x) => (x != null && isList(x) ? x : []);
/** @param {IdView} view @param {IdSpace} space @returns {ViewSpace | null} */
function spaceOf(view, space) {
  const all = view.spaces;
  if (all == null || !isObj(all) || !has(all, space)) return null;
  const s = all[space];
  return s != null && isObj(s) ? s : null;
}
/** @param {IdView} view @param {IdSpace} space @returns {Tagged<Form>[]} */
const formsOf = (view, space) => { const s = spaceOf(view, space); return arr(s ? s.forms : undefined).filter(isObj); };
/** @param {IdView} view @returns {ViewEnactmentKind[]} */
const kindsOf = (view) => { const s = spaceOf(view, "enactment"); return arr(s ? s.kinds : undefined).filter(isObj); };

/* A pattern `{re, flags}` compiled, or null when it does not compile. `mode`: "whole" (the value's whole
   shape), "start" (a prefix to remove) or "find" (anywhere, as over an address's path). */
/** @typedef {"whole" | "start" | "find"} Mode */
/** @type {WeakMap<object, Map<Mode, RegExp | null>>} */
const COMPILED = new WeakMap();
/**
 * @param {Pattern | null | undefined} p
 * @param {Mode} mode
 * @returns {RegExp | null}
 */
function compile(p, mode) {
  if (p == null || !isObj(p)) return null;
  const source = p.re;
  if (typeof source !== "string") return null;
  const known = COMPILED.get(p);
  /** @type {Map<Mode, RegExp | null>} */
  const byMode = known ?? mapOf([]);
  if (!known) COMPILED.set(p, byMode);
  if (byMode.has(mode)) return byMode.get(mode) ?? null;
  const given = p.flags;
  const flags = typeof given === "string" ? given.replace(/[^iu]/g, "") : "";
  /** @type {RegExp | null} */
  let re = null;
  try {
    re = new RegExp(mode === "whole" ? `^(?:${source})$` : mode === "start" ? `^(?:${source})` : source, flags);
  } catch { re = null; }
  byMode.set(mode, re);
  return re;
}

/* ---------------------------------------------------------------- spaces (R1, R2) */

/** @param {IdView} view @returns {SpaceEntry[]} */
function spacesIn(view) {
  return SPACE_NAMES.map((space) => {
    const s = spaceOf(view, space);
    const label = s && typeof s.label === "string" && s.label ? s.label : SPACES[space].label;
    return { space, label, referent: SPACES[space].referent, forms: formsOf(view, space).map((f) => ({ ...f })) };
  });
}

/**
 * The twelve spaces, each with the forms the view supplies (R1, R2). Never throws.
 * @param {ViewArg} v
 * @returns {SpaceEntry[]}
 */
export function spaces(v) {
  return spacesIn(viewOf(v).view);
}

/* ---------------------------------------------------------------- recognise (R3, R4, R5) */

/** @param {Form} form @param {string} value @returns {string} */
function cleaned(form, value) {
  let v = value.trim();
  const clean = form.clean;
  /** @type {FormClean} */
  const c = clean != null && isObj(clean) ? clean : {};
  for (const p of arr(c.strip)) {
    const re = compile(p, "start");
    if (re) v = v.replace(re, "").trim();
  }
  if (c.spaces === "remove") v = v.replace(/\s+/g, "");
  else v = v.replace(/\s+/g, " ");
  if (c.upper === true) v = v.toUpperCase();
  return v;
}

/* The normal form: the listed parts, each a literal or a capture group with its padding or case removed.
   Only formatting is removed; no transform here can change a digit (R4). */
/**
 * @param {readonly NormalPart[] | undefined} given
 * @param {RegExpExecArray} m
 * @returns {string | null}
 */
function normalOf(given, m) {
  /** @type {readonly NormalPart[]} */
  const parts = given != null && isList(given) && given.length ? given : [{ group: 0 }];
  let out = "";
  for (const part of parts) {
    if (typeof part === "string") { out += part; continue; }
    if (!isObj(part)) return null;
    /** @type {unknown} a group's number, or, in a view combine did not check, its name */
    const g = part.group;
    const groups = m.groups;
    const matched = typeof g === "number" ? m[g] : typeof g === "string" && groups ? groups[g] : undefined;
    const fallback = part.default;
    let s = matched === undefined ? (typeof fallback === "string" ? fallback : "") : matched;
    if (part.unpad === true) s = s.replace(/^0+(?=.)/, "");
    if (part.upper === true) s = s.toUpperCase();
    out += s;
  }
  return out;
}

/** @param {Form} form @param {string} value @returns {string | null} */
function matchForm(form, value) {
  const re = compile(form.pattern, "whole");
  if (!re) return null;
  const m = re.exec(cleaned(form, value));
  if (!m) return null;
  const normal = normalOf(form.normal, m);
  return normal ? normal : null;
}

/* An enactment's kind, from the words naming it before the number, and the value with those words removed. */
/** @param {IdView} view @param {string} value @returns {{ kind: string | null, rest: string }} */
function kindPrefix(view, value) {
  for (const k of kindsOf(view)) {
    if (typeof k.kind !== "string") continue;
    const re = compile(k.prefix, "start");
    if (!re) continue;
    const m = re.exec(value);
    if (m && m[0].length) return { kind: k.kind, rest: value.slice(m[0].length).trim() };
  }
  return { kind: null, rest: value };
}

/**
 * One value recognised in one space, or null (R3). Never throws.
 * @param {ViewArg} v
 * @param {unknown} space a space's name; any other value is an unknown space
 * @param {unknown} value a string or a number; any other value is no value
 * @returns {Recognised | null}
 */
export function recognise(v, space, value) {
  const { view, conflicts } = viewOf(v);
  if (typeof space !== "string" || !isSpace(space)) return null;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const { kind, rest } = space === "enactment" ? kindPrefix(view, raw) : { kind: null, rest: raw };
  if (!rest) return null;
  for (const f of formsOf(view, space)) {
    if (typeof f.form !== "string") continue;
    const normal = matchForm(f, rest);
    if (normal == null) continue;
    if (space === "enactment") return { space, value: raw, form: f.form, normal, kind, reach: reachIn(view, conflicts, normal, kind) };
    return { space, value: raw, form: f.form, normal };
  }
  return null;
}

/* ---------------------------------------------------------------- reach (R6–R9) */

/** @param {IdView} view @param {string} origin @returns {string} */
function systemName(view, origin) {
  const s = arr(view.systems).find((x) => isObj(x) && x.origin === origin);
  return s && typeof s.name === "string" ? s.name : origin;
}

/* The conflicts combine reported over a kind's floor. `at` names the fact; it is matched on the kind and
   the word "floor", so a report of the floor of that kind is found however the path is spelled. */
/** @param {readonly Conflict[]} conflicts @param {string} kind @returns {Conflict[]} */
function floorConflicts(conflicts, kind) {
  return conflicts.filter((c) => {
    if (!isObj(c)) return false;
    /** @type {unknown} */
    const where = c.at;
    const at = typeof where === "string" ? where : JSON.stringify(where ?? "");
    return /floor/i.test(at) && new RegExp(`(^|[^a-z0-9_])${kind.replace(/[^a-z0-9_]/gi, "\\$&")}([^a-z0-9_]|$)`, "i").test(at);
  });
}
/** @param {readonly Conflict[]} cs @returns {string} */
function conflictSays(cs) {
  return cs.map((c) => arr(c.values).map((x) => {
    if (!isObj(x)) return String(x);
    const value = x.value;
    const shown = typeof value === "object" && value !== null && has(value, "first") && "first" in value ? value.first : value;
    return `${x.profile ?? "a profile"} gives ${JSON.stringify(shown)}`;
  }).join(", ")).join("; ");
}

/* The floor of one kind: `{floor, system}`, or `{why}` naming which of R9's two causes applies. */
/** @typedef {{ floor: number, system: string, basis: string } | { floor?: undefined, conflict?: true, why: string }} FloorOf */
/** @param {IdView} view @param {readonly Conflict[]} conflicts @param {string} kind @returns {FloorOf} */
function floorOf(view, conflicts, kind) {
  const entries = kindsOf(view).filter((k) => k.kind === kind);
  const floors = entries.flatMap((k) => { const f = k.floor; return f != null && isObj(f) && Number.isFinite(f.first) ? [f] : []; });
  const distinct = [...new Set(floors.map((f) => f.first))];
  const f = floors[0];
  if (distinct.length === 1 && f) {
    return { floor: f.first, system: f.system, basis: f.basis };
  }
  const cs = floorConflicts(conflicts, kind);
  if (distinct.length > 1 || cs.length)
    return { conflict: true, why: word("idspaces.why.active_profiles_give", { kind: String(kind), distinct: String(cs.length ? conflictSays(cs) : distinct.join(", ")) }) };
  if (!entries.length) return { why: word("idspaces.why.active_profiles_name", { kind: String(kind) }) };
  return { why: word("idspaces.why.coverage_floor_measured", { kind: String(kind) }) };
}

/** @param {IdView} view @param {string} kind @param {{ floor: number, system: string }} f @returns {string} */
const outsideSays = (view, kind, f) => word("idspaces.text.first_outside_record", { kind: String(kind), system: String(systemName(view, f.system)), floor: String(f.floor) });

/** @param {IdView} view @param {readonly Conflict[]} conflicts @param {unknown} number @param {string | null} kind @returns {Reach} */
function reachIn(view, conflicts, number, kind) {
  const n = typeof number === "number" ? number
    : typeof number === "string" && /^\s*\d+\s*$/.test(number) ? Number(number) : NaN;
  if (!Number.isFinite(n))
    return { reach: "UNDETERMINED", says: word("idspaces.says.number_compared_coverage", { number: String(JSON.stringify(String(number))) }) };
  if (typeof kind === "string" && kind) {
    const f = floorOf(view, conflicts, kind);
    if (f.floor == null) return { reach: "UNDETERMINED", says: word("idspaces.says.inside_record_reach", { why: String(f.why), n: String(n) }) };
    return n >= f.floor
      ? { reach: "INSIDE", floor: f.floor, says: word("idspaces.says.first_record_look", { kind: String(kind), system: String(systemName(view, f.system)), floor: String(f.floor) }) }
      : { reach: "OUTSIDE_REACH", floor: f.floor, says: outsideSays(view, kind, f) };
  }
  const kinds = [...new Set(kindsOf(view).map((k) => k.kind).filter((k) => typeof k === "string" && k))];
  if (!kinds.length)
    return { reach: "UNDETERMINED", says: word("idspaces.says.active_profiles_name") };
  const each = kinds.map((k) => ({ kind: k, ...floorOf(view, conflicts, k) }));
  const known = each.flatMap((e) => (e.floor != null ? [{ kind: e.kind, floor: e.floor }] : []));
  const named = known.map((e) => `${e.kind} ${e.floor}`).join(", ");
  if (known.length && known.every((e) => n < e.floor) && known.length === each.length)
    return { reach: "OUTSIDE_REACH", says: word("idspaces.says.kind_coverage_floor", { named: String(named) }) };
  if (known.length === each.length && known.every((e) => n >= e.floor))
    return { reach: "INSIDE", says: word("idspaces.says.kind_coverage_floor_record", { named: String(named) }) };
  const unknown = each.flatMap((e) => (e.floor == null ? [e.why] : []));
  return { reach: "UNDETERMINED", says: word("idspaces.says.kind_stated_inside", { boolean: String([
    known.length ? localize("id-spaces.idspaces.inside_reach_some_kinds", "{n} is inside the reach for some kinds and outside it for others (floors: {named})", { n: String(n), named }) : null,
    ...unknown].filter(Boolean).join("; ")) }) };
}

/**
 * Whether an enactment number is inside the record's reach (R6–R9). Never throws.
 * @param {ViewArg} v
 * @param {unknown} number a number, or a string of digits; any other value is undetermined
 * @param {string | null} [kind]
 * @returns {Reach}
 */
export function reach(v, number, kind = null) {
  const { view, conflicts } = viewOf(v);
  return reachIn(view, conflicts, number, kind);
}

/* ---------------------------------------------------------------- parcelStanding (R10–R12) */

/** @param {ParcelCurrent | undefined} current @param {string} key @returns {boolean} */
function inCurrent(current, key) {
  if (current instanceof Set) return current.has(key);
  if (current != null && isList(current)) return current.includes(key);
  return false;
}
/** @param {ParcelLineage | undefined} lineage @param {string} key @returns {LineageRecord[]} */
function lineageOf(lineage, key) {
  const rec = lineage instanceof Map ? lineage.get(key)
    : lineage != null && isObj(lineage) && typeof key === "string" && has(lineage, key) ? lineage[key] : undefined;
  /** @type {LineageRecord[]} */
  const none = [];
  return none.concat(rec ?? []).filter((r) => isObj(r) && Number.isFinite(r.roll_year));
}

/**
 * A parcel key's standing from the assessor's own evidence (R10–R12). Never throws.
 * @param {string} key
 * @param {ParcelEvidence | null} [evidence] missing evidence is treated as empty
 * @returns {ParcelStanding}
 */
export function parcelStanding(key, evidence) {
  /** @type {ParcelEvidence} */
  const ev = evidence != null && isObj(evidence) ? evidence : {};
  const vintages = arr(ev.vintages).map(String);
  if (inCurrent(ev.current, key))
    return { standing: "CURRENT", vintages_searched: vintages, says: word("idspaces.says.assessor_current_parcel") };
  const rec = lineageOf(ev.lineage, key);
  if (rec.length) {
    const roll_year = Math.min(...rec.map((r) => r.roll_year));
    const children = [...new Set(rec.flatMap((r) => arr(r.children).map(String)))].sort();
    return { standing: "RETIRED", roll_year, children, vintages_searched: vintages,
             says: word("idspaces.says.retired_roll_year", { roll_year: String(roll_year) }) };
  }
  return {
    standing: "UNDETERMINED", between: [word("idspaces.between.retired_earliest_published"), word("idspaces.between.parcel")],
    vintages_searched: vintages,
    says: localize("id-spaces.idspaces.v1_undetermined_between_retired_before", "{v1}; undetermined between retired before the earliest published lineage and never a parcel — absence from what was searched decides neither", { v1: String(vintages.length
      ? localize("id-spaces.idspaces.in_none_of_the_published", "in none of the {count} published vintage(s) searched", { count: String(vintages.length) })
      : localize("id-spaces.idspaces.no_published_vintage_of", "no published vintage of the assessor's roll or lineage is held, so none was searched")) }),
  };
}

/* ---------------------------------------------------------------- systemOf (R13–R15) */

/**
 * @param {IdView} view
 * @param {string} address
 * @returns {{ origin: string, name: string, republication: boolean, provenance_stated: boolean, basis: string | null } | { origin: null, why: string }}
 */
function systemOfOne(view, address) {
  /** @type {URL} */
  let u;
  try { u = new URL(String(address)); } catch { return { origin: null, why: word("idspaces.why.parseable_address") }; }
  const host = u.hostname.toLowerCase();
  const path = u.pathname + u.search;
  for (const s of arr(view.systems)) {
    if (!isObj(s) || typeof s.origin !== "string" || !s.origin) continue;
    if (!arr(s.hosts).some((h) => typeof h === "string" && h.toLowerCase() === host)) continue;
    const within = s.path;
    if (within != null) {
      const re = compile(within, "find");
      if (!re || !re.test(path)) continue;
    }
    return { origin: s.origin, name: typeof s.name === "string" ? s.name : s.origin, republication: s.republishes === true,
             provenance_stated: s.provenance_stated !== false, basis: s.basis ?? null };
  }
  const mixed = arr(view.mixed_hosts).find((m) => isObj(m) && typeof m.host === "string" && m.host.toLowerCase() === host);
  if (mixed) return { origin: null, why: word("idspaces.why.serves_many_offices", { host: String(host), why: String(typeof mixed.why === "string" && mixed.why ? ` (${mixed.why})` : "") }) };
  return { origin: null, why: word("idspaces.why.system_active_profiles", { host: String(host) }) };
}

/**
 * The system a capture belongs to, from every address the record located it at (R13–R15). Never throws.
 * @param {ViewArg} v
 * @param {string | readonly (string | null | undefined)[] | null | undefined} addresses a list of addresses, or one address
 * @returns {SystemOf}
 */
export function systemOf(v, addresses) {
  const { view } = viewOf(v);
  const given = typeof addresses === "string" ? [addresses] : arr(addresses);
  const list = [...new Set(given.flatMap((a) => (a != null ? [String(a)] : [])))];
  if (!list.length) return { origin: null, addresses: [], why: word("idspaces.why.addresses_record_holds") };
  /** @type {SystemEach[]} */
  const each = list.map((address) => ({ address, ...systemOfOne(view, address) }));
  const origins = [...new Set(each.map((e) => e.origin))];
  const first = each[0];
  if (origins.length === 1 && first && first.origin) {
    const { origin, name, republication, provenance_stated, basis } = first;
    return { origin, name, republication, provenance_stated, basis, addresses: list };
  }
  const why = list.length === 1 && first && first.origin === null ? first.why
    : each.every((e) => !e.origin) ? word("idspaces.text.unknown_systems_addresses", { list: String(list.length), why: String([...new Set(each.flatMap((e) => (e.origin === null ? [e.why] : [])))].join("; ")) })
    : each.some((e) => !e.origin) ? word("idspaces.text.unknown_systems_some")
    : word("idspaces.text.different_systems_record", { origins: String(origins.join(", ")) });
  return { origin: null, addresses: list, why, each: each.map((e) => ({ ...e })) };
}

/* ---------------------------------------------------------------- judgePair (R16–R22) */

/** An end's `why`, where its system answer carries one. @param {SystemOf | null} s @returns {unknown} */
const whyOf = (s) => (s && "why" in s ? s.why : undefined);

/** @param {unknown} n @returns {string} */
function normName(n) {
  return String(n == null ? "" : n).toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, " ").replace(/\bfund\b/gu, " ")
    .replace(/\s+/g, " ").trim();
}
/** @param {string} s @returns {string} */
const unpadAll = (s) => String(s).replace(/(^|\D)0+(?=\d)/g, "$1");

/* A crosswalk the view supplies between the two forms: whether it joins these two values. */
/**
 * @param {IdView} view
 * @param {IdSpace} space
 * @param {Recognised} ra
 * @param {Recognised} rb
 * @returns {{ sources: string[], partners: string[] } | null}
 */
function throughCrosswalk(view, space, ra, rb) {
  const walks = arr(view.crosswalks).filter((c) => isObj(c) && c.space === space && isList(c.forms)
    && ((c.forms[0] === ra.form && c.forms[1] === rb.form) || (c.forms[0] === rb.form && c.forms[1] === ra.form)));
  if (!walks.length) return null;
  const formByName = new Map(formsOf(view, space).map((f) => [f.form, f]));
  /** @param {string} form @param {unknown} value @returns {string | null} */
  const norm = (form, value) => {
    const f = formByName.get(form);
    return f && (typeof value === "string" || typeof value === "number") ? matchForm(f, String(value)) : null;
  };
  /** @type {Set<string>} */
  const partners = new Set();
  for (const c of walks) {
    const aFirst = c.forms[0] === ra.form;
    for (const p of arr(c.pairs)) {
      if (!isList(p) || p.length < 2) continue;
      const [x, y] = aFirst ? [norm(c.forms[0], p[0]), norm(c.forms[1], p[1])] : [norm(c.forms[1], p[1]), norm(c.forms[0], p[0])];
      if (x != null && x === ra.normal && y != null) partners.add(y);
    }
  }
  return { sources: walks.map((c) => c.source), partners: [...partners] };
}

/**
 * §8.3's counting rule over one pair (R16–R22). Throws TypeError only when an end is unrecognised or not in
 * `space`; the caller must recognise both values first.
 * @param {ViewArg} v
 * @param {unknown} space
 * @param {PairEnd} a
 * @param {PairEnd} b
 * @param {unknown} [reading] "agrees", "disagrees" or null; any other value is no reading
 * @returns {Judgement}
 * @throws {TypeError} when `a.rec` or `b.rec` is not a recognised value, or either is not in `space`
 */
export function judgePair(v, space, a, b, reading = null) {
  const ra = isObj(a) ? a.rec : null, rb = isObj(b) ? b.rec : null;
  if (ra == null || rb == null || !isObj(ra) || !isObj(rb)) throw new TypeError("judgePair: a.rec and b.rec must both be recognised values (recognise() first)");
  if (typeof space !== "string" || !isSpace(space) || ra.space !== space || rb.space !== space)
    throw new TypeError(`judgePair: both values must be recognised in the space "${String(space)}"`);
  const { view } = viewOf(v);
  const entry = spacesIn(view).find((s) => s.space === space);
  const label = entry ? entry.label : SPACES[space].label;
  /** @param {Verdict} vd @param {string} says @param {{ near_miss?: boolean, referent?: { by: string, agrees: boolean } }} [extra] @returns {Judgement} */
  const verdict = (vd, says, extra = {}) => ({ verdict: vd, counts: vd === "SHARED", says, ...extra });
  let via = "";

  /* 1. the form (R17) */
  if (ra.form !== rb.form) {
    const cw = throughCrosswalk(view, space, ra, rb);
    if (!cw)
      return verdict("FORMS_UNJOINED", localize("id-spaces.idspaces.the_values_are_in_different", "the values are in different forms of the {label} ({form}, {form_2}); two forms join only through a captured crosswalk, and none is captured between them in the active profiles, so the two stay unjoined: an unmade join, not a mismatch", { label: String(label), form: String(ra.form), form_2: String(rb.form) }));
    if (!cw.partners.length)
      return verdict("FORMS_UNJOINED", localize("id-spaces.idspaces.the_values_are_in_different_2", "the values are in different forms of the {label} ({form}, {form_2}), and the crosswalk between them ({sources}) lists no partner for {normal}: an unmade join, not a mismatch", { label: String(label), form: String(ra.form), form_2: String(rb.form), sources: String(cw.sources.join(", ")), normal: String(ra.normal) }));
    if (!cw.partners.includes(rb.normal))
      return verdict("VALUES_DIFFER", localize("id-spaces.idspaces.through_the_crosswalk_sources_normal", "through the crosswalk ({sources}), {normal} is {partners} in the form {form}, not {normal_2}", { sources: String(cw.sources.join(", ")), normal: String(ra.normal), partners: String(cw.partners.join(" or ")), form: String(rb.form), normal_2: String(rb.normal) }), { near_miss: false });
    via = localize("id-spaces.idspaces.the_forms_joined_through_the", " (the forms joined through the crosswalk {sources})", { sources: String(cw.sources.join(", ")) });
  } else if (ra.normal !== rb.normal) {
    /* 2. the value (R18) */
    const near = unpadAll(ra.normal) === unpadAll(rb.normal);
    return verdict("VALUES_DIFFER", near
      ? localize("id-spaces.idspaces.the_values_differ_only_by", "the values differ only by leading zeros ({normal}, {normal_2}): a near miss, never counted — a digit is never folded", { normal: String(ra.normal), normal_2: String(rb.normal) })
      : localize("id-spaces.idspaces.different_values_normal_normal_2", "different values ({normal}, {normal_2})", { normal: String(ra.normal), normal_2: String(rb.normal) }), { near_miss: near });
  }

  /* 3. the systems' independence (R19) */
  const systemA = a.system, systemB = b.system;
  const sa = systemA != null && isObj(systemA) ? systemA : null, sb = systemB != null && isObj(systemB) ? systemB : null;
  if (!sa || !sa.origin || !sb || !sb.origin) {
    const which = !sa || !sa.origin ? "first" : "second", s = !sa || !sa.origin ? sa : sb;
    const why = whyOf(s);
    return verdict("SYSTEM_UNDETERMINED", localize("id-spaces.idspaces.which_system_published_the_which", "which system published the {which} end is undetermined{v1}; a match counts only between two systems known to be independent", { which: String(which), v1: String(typeof why === "string" ? ` (${why})` : "") }));
  }
  if (sa.origin === sb.origin)
    return verdict("SAME_SYSTEM", localize("id-spaces.idspaces.both_ends_are_publications_of", "both ends are publications of one system ({origin}); two publications of one source are one system, however many documents carry the value", { origin: String(sa.origin) }));

  /* 4. the fund name (R20) */
  if (space === "fund") {
    const na = normName(a.name), nb = normName(b.name);
    if (!na || !nb)
      return verdict("FUND_NAME_ABSENT", localize("id-spaces.idspaces.a_fund_code_counts_only", "a fund code counts only when the fund name agrees too, and the {v1} end names no fund — a bare code is not counted", { v1: String(!na ? "first" : "second") }));
    if (na === nb)
      return verdict("SHARED", localize("id-spaces.idspaces.one_value_via_two_independent", "one value{via}, two independent systems ({origin}, {origin_2}), and the fund names agree", { via: String(via), origin: String(sa.origin), origin_2: String(sb.origin) }),
        { referent: { by: "the names, compared normalised", agrees: true } });
  }

  /* 5. the referent (R21) */
  if (reading !== "agrees" && reading !== "disagrees")
    return verdict("REFERENT_UNREAD", space === "fund"
      ? localize("id-spaces.idspaces.the_fund_names_differ_as", "the fund names differ as written ({name} / {name_2}); whether they name one fund is a reading nobody has supplied, so the match is not counted", { name: String(a.name), name_2: String(b.name) })
      : localize("id-spaces.idspaces.one_value_via_in_two", "one value{via} in two independent systems, but the referent has not been read: a match counts only when what the value names agrees in both, and that is read, never inferred from the string", { via: String(via) }));
  if (reading === "disagrees")
    return verdict("REFERENT_DISAGREES", localize("id-spaces.idspaces.same_value_names_different", "the same value names different things, on the caller's reading: not a match"),
      { referent: { by: word("idspaces.by.caller_reading"), agrees: false } });
  return verdict("SHARED", localize("id-spaces.idspaces.one_value_via_two_independent_2", "one value{via}, two independent systems ({origin}, {origin_2}), and the referent agrees on the caller's reading — a reading this module did not make and cannot check", { via: String(via), origin: String(sa.origin), origin_2: String(sb.origin) }),
    { referent: { by: word("idspaces.by.caller_reading"), agrees: true } });
}

/* ---------------------------------------------------------------- recogniseCitations (R27–R29) */

/* The reporter data this module reads when the caller passes none: `court-citations`' exports (R27; K1513,
   K1518). Data, never code: no reporter is named here (R29). */
/** @type {unknown} */
const HELD_REPORTERS = CourtCitations;

/* A spelling's folded key: white space removed, so "F. Supp." and "F.Supp." meet (as `court-citations` R7
   folds them). Letter case and every other character are kept. A spelling is looked up as written first, and
   folded only when no spelling is held as written, so two reporters' spellings that differ only by spacing
   ("B.R.", "B. R.") stay apart. */
/** @param {string} s @returns {string} */
const spellingKey = (s) => String(s).replace(/\s+/g, "");

/* The reporter data compiled once per data object: the lookups (as written, and folded; each → the reporters
   and editions a spelling stands for) and the most words a spelling can be written in. Data in neither of
   court-citations' shapes (`VARIANTS`, `REPORTERS`) compiles to null. */
/** @typedef {{ reporter: string, edition: string | null }} Entry */
/** @typedef {{ exact: Map<string, Map<string, Entry>>, lookup: Map<string, Map<string, Entry>>, words: number }} Compiled */
/** @type {WeakMap<object, Compiled | null>} */
const DATA = new WeakMap();
/** @param {unknown} data @returns {Compiled | null} */
function compileReporters(data) {
  if (!isObj(data)) return null;
  const held = DATA.get(data);
  if (held !== undefined) return held;
  /** @type {Map<string, Map<string, Entry>>} */
  const exact = mapOf([]);
  /** @type {Map<string, Map<string, Entry>>} */
  const lookup = mapOf([]);
  let words = 1;
  /** @param {Map<string, Map<string, Entry>>} map @param {string} k @param {string} reporter @param {unknown} edition */
  const put = (map, k, reporter, edition) => {
    const known = map.get(k);
    /** @type {Map<string, Entry>} */
    const at = known ?? mapOf([]);
    if (!known) map.set(k, at);
    at.set(`${reporter}\u0000${edition ?? ""}`, { reporter, edition: typeof edition === "string" ? edition : null });
  };
  /** @param {unknown} spelling @param {unknown} reporter @param {unknown} edition */
  const add = (spelling, reporter, edition) => {
    if (typeof spelling !== "string" || !spelling.trim() || typeof reporter !== "string" || !reporter) return;
    put(exact, spelling.trim(), reporter, edition);
    put(lookup, spellingKey(spelling), reporter, edition);
    /* written with a space after every period, a spelling has at most this many words */
    words = Math.max(words, spelling.trim().replace(/\.(?=\S)/g, ". ").split(/\s+/).length);
  };
  try {
    const givenVariants = data.VARIANTS, givenReporters = data.REPORTERS;
    const variants = isObj(givenVariants) ? givenVariants : isList(givenReporters) ? null : data;
    const reporters = isList(givenReporters) ? givenReporters : null;
    if (variants != null && !isList(variants))
      for (const spelling of Object.keys(variants)) {
        const v = variants[spelling];
        for (const x of isList(v) ? v : [v]) if (isObj(x)) add(spelling, x.reporter, x.edition);
      }
    for (const r of reporters ?? []) {
      if (!isObj(r)) continue;
      const key = r.key;
      if (typeof key !== "string") continue;
      add(key, key, key);
      const editions = r.editions;
      for (const ed of isList(editions) ? editions : []) if (isObj(ed)) add(ed.key, key, ed.key);
      const variations = r.variations;
      if (isObj(variations)) for (const sp of Object.keys(variations)) add(sp, key, variations[sp]);
    }
  } catch { lookup.clear(); }
  const out = lookup.size ? { exact, lookup, words } : null;
  DATA.set(data, out);
  return out;
}

/* A citation is a volume, the reporter as written, and a page, in that order: so the reporter is exactly the
   words between the volume and the page, and is found by looking those words up, the most words first. */
const VOLUME = /(?<![\p{L}\p{N}.])\d{1,5}(?=\s)/gu;
const WORD = /\s+(\S+)/y;
const PAGE = /^\d{1,7}(?![\p{L}\p{N}])/u;
const PIN = /^\s*,\s*(\d{1,7})(?![\p{L}\p{N}])(?!\s+\p{Lu})/u;
/** @typedef {{ volume: number, variant: string, page: number, entries: Entry[], start: number, end: number, pin?: number }} Found */
/** @param {string} t @param {Compiled} data @returns {Found[]} */
function findCitations(t, data) {
  /** @type {Found[]} */
  const found = [];
  VOLUME.lastIndex = 0;
  for (;;) {
    const m = VOLUME.exec(t);
    if (!m) break;
    /** @type {{ start: number, end: number, s: string }[]} */
    const words = [];
    WORD.lastIndex = m.index + m[0].length;
    while (words.length <= data.words) {
      const w = WORD.exec(t);
      if (!w) break;
      const s = w[1] ?? "";
      words.push({ start: w.index + w[0].length - s.length, end: WORD.lastIndex, s });
    }
    for (let k = Math.min(data.words, words.length - 1); k >= 1; k--) {
      const wk = words[k], w0 = words[0], wb = words[k - 1];
      if (!wk || !w0 || !wb) continue;
      const page = PAGE.exec(wk.s);
      if (!page) continue;
      const variant = t.slice(w0.start, wb.end);
      const hit = data.exact.get(variant) ?? data.lookup.get(spellingKey(variant));
      if (!hit) continue;
      const pageEnd = wk.start + page[0].length;
      const pin = PIN.exec(t.slice(pageEnd, pageEnd + 32));
      const end = pin ? pageEnd + pin[0].length : pageEnd;
      if (pin) found.push({ volume: Number(m[0]), variant, page: Number(page[0]), entries: [...hit.values()], start: m.index, pin: Number(pin[1]), end });
      else found.push({ volume: Number(m[0]), variant, page: Number(page[0]), entries: [...hit.values()], start: m.index, end });
      VOLUME.lastIndex = end;
      break;
    }
  }
  return found;
}

/* The volume-reporter-page shape with no data: a number, one to six words each beginning with a capital
   letter or an ordinal series mark (2d, 4th), at least one of them holding a period or written all in
   capitals, then a page number. */
const SHAPE = /(?<![\p{L}\p{N}.])(\d{1,5})\s+((?:\p{Lu}[\p{L}\p{N}.'&]*|\d+(?:d|st|nd|rd|th)\.?)(?:\s(?:\p{Lu}[\p{L}\p{N}.'&]*|\d+(?:d|st|nd|rd|th)\.?|&)){0,5})\s+(\d{1,7})(?![\p{L}\p{N}])/gu;
/** @param {string} r @returns {boolean} */
const looksLikeReporter = (r) => /\./.test(r) || /^[\p{Lu}&\s]{2,}$/u.test(r);

/** @param {string} text @returns {CitationShape[]} */
function shapes(text) {
  /** @type {CitationShape[]} */
  const out = [];
  for (const m of text.matchAll(SHAPE)) if (looksLikeReporter(m[2] ?? "")) out.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  return out;
}

/**
 * The court citations in `text`, each volume, reporter and page (R27–R29). `reporters` is court-citations'
 * data (its exports, or its `VARIANTS` map alone), taking precedence over the data this module holds.
 * Never throws.
 * @param {unknown} text a string; any other value is no text
 * @param {unknown} [reporters] court-citations' data; null or absent reads the data this module holds
 * @returns {Citations}
 */
export function recogniseCitations(text, reporters = undefined) {
  try {
    const t = typeof text === "string" ? text : "";
    const passed = reporters !== undefined && reporters !== null;
    const data = passed ? compileReporters(reporters) : compileReporters(HELD_REPORTERS);
    if (typeof text !== "string")
      return { citations: [], undetermined: { why: word("idspaces.why.text_given_string") } };
    if (!data) {
      const reason = passed
        ? localize("id-spaces.idspaces.no_reporter_data_held_for", "no reporter data is held for this reading: the data passed is in neither of court-citations' shapes (VARIANTS or REPORTERS)")
        : localize("id-spaces.idspaces.no_reporter_data_held", "no reporter data is held (court-citations' data is not readable here, and none was passed)");
      const unrecognised = shapes(t);
      const why = localize("id-spaces.idspaces.why_no_citation_can_be", "{why}: no citation can be recognised, and finding none says nothing about what the text cites", { why: String(reason) });
      if (unrecognised.length) return { citations: [], undetermined: { why, unrecognised } };
      return { citations: [], undetermined: { why } };
    }
    /** @type {Citation[]} */
    const citations = [];
    /** @type {CitationAmbiguous[]} */
    const ambiguous = [];
    /** @type {[number, number][]} */
    const taken = [];
    for (const f of findCitations(t, data)) {
      const { start, end, variant, pin } = f;
      taken.push([start, end]);
      const named = [...new Set(f.entries.map((e) => e.reporter))].sort();
      const only = named[0];
      if (named.length !== 1 || only === undefined) {
        ambiguous.push({ text: t.slice(start, end), start, end, variant, reporters: named });
        continue;
      }
      if (pin !== undefined) citations.push({ volume: f.volume, reporter: only, variant, page: f.page, pin, start, end });
      else citations.push({ volume: f.volume, reporter: only, variant, page: f.page, start, end });
    }
    /* both lists are in reading order, so one sweep finds the shapes no citation found overlaps */
    let i = 0;
    const unrecognised = shapes(t).filter((s) => {
      for (;;) {
        const before = taken[i];
        if (!before || before[1] > s.start) break;
        i++;
      }
      const ti = taken[i];
      return !(ti && ti[0] < s.end);
    });
    if (!unrecognised.length && !ambiguous.length) return { citations };
    const whyUnrecognised = unrecognised.length ? word("idspaces.why.run_text_volume", { unrecognized: String(unrecognised.length) }) : null;
    if (!ambiguous.length) return { citations, undetermined: { unrecognised, why: whyUnrecognised ?? "" } };
    const why = [whyUnrecognised, word("idspaces.why.citation_written_spelling", { ambiguous: String(ambiguous.length) })].filter(Boolean).join("; ");
    if (unrecognised.length) return { citations, undetermined: { unrecognised, why, ambiguous } };
    return { citations, undetermined: { ambiguous, why } };
  } catch {
    return { citations: [], undetermined: { why: word("idspaces.why.text_read_citations") } };
  }
}

/* ---------------------------------------------------------------- recogniseSeries (R30–R33) */

/* The view's numbered families: each `standard_sources` entry with `series` (`jurisdictions` R63), keyed by its
   issuer's `key` and its `series.key`. A family the view withholds (`jurisdictions` R66) is not read: combine
   reports it in `conflicts` at `standard_sources[<key>/<series.key>]…`; a view whose entries of one family
   disagree, or one that kept a family without its `cite`, is read the same way. Data only: no family, issuer
   or designation is named here (R33). */
/** @param {string} key @param {string} series @returns {string} */
const famKey = (key, series) => `${key}\u0000${series}`;
/** @param {Conflict} c @returns {{ key: string, series: string } | null} */
function conflictFamily(c) {
  /** @type {unknown} */
  const where = c.at;
  const at = typeof where === "string" ? where : "";
  const m = /^standard_sources\[([^\]]*)\]/.exec(at);
  if (!m) return null;
  const parts = (m[1] ?? "").split("/");
  const [key, series] = parts;
  return parts.length === 2 && key && series ? { key, series } : null;
}
/** One family's entry as read: its issuer's key, its series and the entry. @typedef {{ key: string, series: { key: string, label?: string }, entry: ViewStandardSource }} FamEntry */
/** @typedef {{ key: string, series: string, at: string[], says: string[] }} Withheld */
/** @param {string} key @param {string} series @returns {Withheld} */
const withheldOf = (key, series) => ({ key, series, at: noStrings(), says: noStrings() });
/**
 * @param {IdView} view
 * @param {readonly Conflict[]} conflicts
 * @returns {{ readable: { fam: FamEntry, re: RegExp }[], withheld: Withheld[], unreadable: SeriesUnreadable[], held: number }}
 */
function seriesOf(view, conflicts) {
  /** @type {Map<string, Withheld>} */
  const withheld = mapOf([]);
  /** @type {{ fam: FamEntry, re: RegExp }[]} */
  const readable = [];
  /** @type {SeriesUnreadable[]} */
  const unreadable = [];
  /** @type {Map<string, FamEntry[]>} */
  const byFam = mapOf([]);
  for (const c of conflicts) {
    if (!isObj(c)) continue;
    const f = conflictFamily(c);
    if (!f) continue;
    const k = famKey(f.key, f.series);
    const known = withheld.get(k);
    const w = known ?? withheldOf(f.key, f.series);
    if (!known) withheld.set(k, w);
    w.at.push(c.at);
    if (typeof c.says === "string" && c.says) w.says.push(c.says);
  }
  for (const s of arr(view.standard_sources)) {
    if (!isObj(s)) continue;
    const series = s.series;
    if (series == null || !isObj(series)) continue;
    const key = s.key;
    if (typeof key !== "string" || !key || typeof series.key !== "string" || !series.key) {
      unreadable.push({ source: typeof s.source === "string" ? s.source : null, why: word("idspaces.why.series_issuer_key") });
      continue;
    }
    const k = famKey(key, series.key);
    const known = byFam.get(k);
    /** @type {FamEntry[]} */
    const list = known ?? [];
    if (!known) byFam.set(k, list);
    list.push({ key, series, entry: s });
  }
  /** @param {FamEntry} f @returns {string} */
  const sig = (f) => JSON.stringify([f.series.label ?? null, f.entry.cite ?? null, f.entry.normal ?? null]);
  for (const [k, list] of byFam) {
    const first = list[0];
    if (!first) continue;
    const { key, series } = { key: first.key, series: first.series.key };
    /** @param {string} why */
    const withheldHere = (why) => {
      const known = withheld.get(k);
      const w = known ?? withheldOf(key, series);
      if (!known) withheld.set(k, w);
      w.says.push(why);
    };
    if (withheld.has(k)) continue;
    if (new Set(list.map(sig)).size > 1) { withheldHere(word("idspaces.withheld_here.view_entries_family")); continue; }
    const cite = first.entry.cite;
    if (cite == null || !isObj(cite)) { withheldHere(word("idspaces.withheld_here.view_holds_family")); continue; }
    const re = compileFind(cite);
    if (!re) { unreadable.push({ key, series, why: word("idspaces.why.citation_pattern_compile") }); continue; }
    readable.push({ fam: first, re });
  }
  return { readable, withheld: [...withheld.values()], unreadable, held: byFam.size + withheld.size };
}

/* A citation pattern compiled to search a whole text, or null when it does not compile. */
/** @type {WeakMap<object, RegExp | null>} */
const FINDS = new WeakMap();
/** @param {Pattern} p @returns {RegExp | null} */
function compileFind(p) {
  if (!isObj(p)) return null;
  const source = p.re;
  if (typeof source !== "string") return null;
  const held = FINDS.get(p);
  if (held !== undefined) return held;
  const given = p.flags;
  /** @type {RegExp | null} */
  let re = null;
  try { re = new RegExp(source, `g${typeof given === "string" ? given.replace(/[^iu]/g, "") : ""}`); } catch { re = null; }
  FINDS.set(p, re);
  return re;
}

/* One match read as the entry says: the number, portion and edition as written, the normal form from the
   entry's normal parts (R3 there: formatting removed only, R4 here), or the number as matched. */
/** @param {FamEntry} fam @param {RegExpExecArray} m @returns {SeriesCitation | null} */
function readMatch(fam, m) {
  const s = fam.entry;
  const g = m.groups || {};
  const written = g.number;
  const number = typeof written === "string" ? written : "";
  if (!number) return null;
  const parts = s.normal;
  const normal = parts != null && isList(parts) && parts.length ? normalOf(parts, m) : number;
  if (!normal) return null;
  const given = fam.series.label;
  const label = typeof given === "string" ? given : null;
  const portionGiven = g.portion, editionGiven = g.edition;
  const portion = typeof portionGiven === "string" && portionGiven ? portionGiven : null;
  const edition = s.kind === "standard" && typeof editionGiven === "string" && editionGiven ? editionGiven : null;
  const key = fam.key, series = fam.series.key, kind = s.kind ?? null, issuer = s.issuer ?? null;
  const start = m.index, end = m.index + m[0].length, basis = s.basis ?? null, profile = s.profile ?? null;
  if (portion !== null && edition !== null) return { key, series, label, kind, issuer, number, normal, portion, edition, start, end, basis, profile };
  if (portion !== null) return { key, series, label, kind, issuer, number, normal, portion, start, end, basis, profile };
  if (edition !== null) return { key, series, label, kind, issuer, number, normal, edition, start, end, basis, profile };
  return { key, series, label, kind, issuer, number, normal, start, end, basis, profile };
}

/** A family withheld, named (R31). @param {Withheld} w @returns {SeriesWithheld} */
function withheldNamed({ key, series, at, says }) {
  const said = says.length ? says.join("; ") : word("idspaces.says.active_profiles_disagree");
  if (at.length) return { key, series, at, says: said };
  return { key, series, says: said };
}

/**
 * What stays undetermined, its parts in their order.
 * @param {string} why
 * @param {SeriesAmbiguous[]} ambiguous
 * @param {SeriesWithheld[]} named
 * @param {SeriesUnreadable[]} unreadable
 * @returns {SeriesUndetermined}
 */
function seriesUndetermined(why, ambiguous, named, unreadable) {
  /** @type {SeriesUndetermined} */
  const out = { why };
  if (ambiguous.length) out.ambiguous = ambiguous;
  if (named.length) out.conflicts = named;
  if (unreadable.length) out.unreadable = unreadable;
  return out;
}

/**
 * The policy-series and standard citations in `text`, read from the view's series (R30–R33). Never throws.
 * @param {ViewArg} v
 * @param {unknown} text a string; any other value is no text
 * @returns {SeriesCitations}
 */
export function recogniseSeries(v, text) {
  try {
    const { view, conflicts } = viewOf(v);
    if (typeof text !== "string")
      return { citations: [], undetermined: { why: word("idspaces.no_series.text_given_string") } };
    const { readable, withheld, unreadable, held } = seriesOf(view, conflicts);
    const named = withheld.map(withheldNamed);
    if (!held)
      return { citations: [], undetermined: seriesUndetermined(localize("id-spaces.idspaces.active_profiles_supply_no", "the active profiles supply no policy series or standard designation, so no citation of one can be recognised: finding none says nothing about whether the text cites a policy or a standard"), [], named, unreadable) };
    /* every entry's matches, then grouped where they overlap */
    /** @type {SeriesCitation[]} */
    const found = [];
    for (const { fam, re } of readable) {
      re.lastIndex = 0;
      for (;;) {
        const m = re.exec(text);
        if (!m) break;
        if (m[0].length === 0) { re.lastIndex++; continue; }
        const r = readMatch(fam, m);
        if (r) found.push(r);
      }
    }
    found.sort((a, b) => a.start - b.start || b.end - a.end);
    /** @type {{ start: number, end: number, items: SeriesCitation[] }[]} */
    const groups = [];
    for (const f of found) {
      const g = groups[groups.length - 1];
      if (g && f.start < g.end) { g.items.push(f); g.end = Math.max(g.end, f.end); }
      else groups.push({ start: f.start, end: f.end, items: [f] });
    }
    /** @type {SeriesCitation[]} */
    const citations = [];
    /** @type {SeriesAmbiguous[]} */
    const ambiguous = [];
    for (const g of groups) {
      /** @type {Map<string, SeriesCitation>} */
      const readings = mapOf([]);
      for (const f of g.items) {
        const k = JSON.stringify([f.key, f.series, f.normal]);
        if (!readings.has(k)) readings.set(k, f);
      }
      if (readings.size === 1) {
        /* one family and number, however many entries or spellings read it: the widest reading is the citation */
        citations.push(g.items.reduce((best, f) => (f.end - f.start > best.end - best.start ? f : best)));
        continue;
      }
      ambiguous.push({ text: text.slice(g.start, g.end), start: g.start, end: g.end, readings: [...readings.values()] });
    }
    /** @type {string[]} */
    const why = [];
    if (ambiguous.length) why.push(word("idspaces.push.run_text_read", { ambiguous: String(ambiguous.length) }));
    if (named.length) why.push(word("idspaces.push.famil_ies_withheld", { named: String(named.length) }));
    if (unreadable.length) why.push(localize("id-spaces.idspaces.length_series_cannot_be_read", "{length} series cannot be read from the view, so a citation of one is not recognised", { length: String(unreadable.length) }));
    if (!readable.length && !why.length) why.push(word("idspaces.push.series_view_read"));
    if (!why.length) return { citations };
    return { citations, undetermined: seriesUndetermined(why.join("; "), ambiguous, named, unreadable) };
  } catch {
    return { citations: [], undetermined: { why: word("idspaces.no_series.text_read_policy") } };
  }
}
