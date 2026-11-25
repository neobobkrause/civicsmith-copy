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

/* The twelve spaces, in R1's order, their generic labels (used only when the view gives none) and what their
   referent is. `account`, `object` and `vendor` are the money record's identifiers; `proceeding` a proceeding's
   number in its forum's forms (K1452); `person` one form per person scheme (B1b.3), so two schemes' numbers
   are two forms and never join without a crosswalk (R17); `body` a body's number in a legislative system and
   `office` an office record's number, one seat's holding (N569, N613); `institution` one form per institution
   scheme, as `person` (N574, K1729). */
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
const SPACE_NAMES = Object.keys(SPACES);
const has = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k);
const isObj = (o) => o != null && typeof o === "object";

/* ---------------------------------------------------------------- the view, read defensively (never throws) */

function viewOf(v) {
  if (!isObj(v)) return { view: {}, conflicts: [] };
  if (has(v, "view") && isObj(v.view) && has(v, "ok")) {
    const conflicts = Array.isArray(v.conflicts) ? v.conflicts : Array.isArray(v.view.conflicts) ? v.view.conflicts : [];
    return { view: v.view, conflicts };
  }
  return { view: v, conflicts: Array.isArray(v.conflicts) ? v.conflicts : [] };
}
const arr = (x) => (Array.isArray(x) ? x : []);
function spaceOf(view, space) {
  if (!SPACE_NAMES.includes(space)) return null;
  const s = isObj(view.spaces) && has(view.spaces, space) && isObj(view.spaces[space]) ? view.spaces[space] : {};
  return s;
}
const formsOf = (view, space) => arr((spaceOf(view, space) || {}).forms).filter(isObj);
const kindsOf = (view) => arr((spaceOf(view, "enactment") || {}).kinds).filter(isObj);

/* A pattern `{re, flags}` compiled, or null when it does not compile. `mode`: "whole" (the value's whole
   shape), "start" (a prefix to remove) or "find" (anywhere, as over an address's path). */
const COMPILED = new WeakMap();
function compile(p, mode) {
  if (!isObj(p) || typeof p.re !== "string") return null;
  let byMode = COMPILED.get(p);
  if (!byMode) COMPILED.set(p, (byMode = {}));
  if (has(byMode, mode)) return byMode[mode];
  const flags = typeof p.flags === "string" ? p.flags.replace(/[^iu]/g, "") : "";
  let re = null;
  try {
    re = new RegExp(mode === "whole" ? `^(?:${p.re})$` : mode === "start" ? `^(?:${p.re})` : p.re, flags);
  } catch { re = null; }
  byMode[mode] = re;
  return re;
}

/* ---------------------------------------------------------------- spaces (R1, R2) */

/** The twelve spaces, each with the forms the view supplies (R1, R2). Never throws. */
export function spaces(v) {
  const { view } = viewOf(v);
  return SPACE_NAMES.map((space) => {
    const s = spaceOf(view, space);
    const label = typeof s.label === "string" && s.label ? s.label : SPACES[space].label;
    return { space, label, referent: SPACES[space].referent, forms: formsOf(view, space).map((f) => ({ ...f })) };
  });
}

/* ---------------------------------------------------------------- recognise (R3, R4, R5) */

function cleaned(form, value) {
  let v = value.trim();
  const c = isObj(form.clean) ? form.clean : {};
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
function normalOf(form, m) {
  const parts = Array.isArray(form.normal) && form.normal.length ? form.normal : [{ group: 0 }];
  let out = "";
  for (const part of parts) {
    if (typeof part === "string") { out += part; continue; }
    if (!isObj(part)) return null;
    const g = part.group;
    let s = typeof g === "number" ? m[g] : typeof g === "string" && m.groups ? m.groups[g] : undefined;
    if (s === undefined) s = typeof part.default === "string" ? part.default : "";
    if (part.unpad === true) s = s.replace(/^0+(?=.)/, "");
    if (part.upper === true) s = s.toUpperCase();
    out += s;
  }
  return out;
}

function matchForm(form, value) {
  const re = compile(form.pattern, "whole");
  if (!re) return null;
  const m = re.exec(cleaned(form, value));
  if (!m) return null;
  const normal = normalOf(form, m);
  return normal ? normal : null;
}

/* An enactment's kind, from the words naming it before the number, and the value with those words removed. */
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

/** One value recognised in one space, or null (R3). Never throws. */
export function recognise(v, space, value) {
  const { view } = viewOf(v);
  if (!SPACE_NAMES.includes(space)) return null;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value).trim();
  if (!raw) return null;
  let rest = raw, kind = null;
  if (space === "enactment") ({ kind, rest } = kindPrefix(view, raw));
  if (!rest) return null;
  for (const f of formsOf(view, space)) {
    if (typeof f.form !== "string") continue;
    const normal = matchForm(f, rest);
    if (normal == null) continue;
    const out = { space, value: raw, form: f.form, normal };
    if (space === "enactment") {
      out.kind = kind;
      out.reach = reach(v, normal, kind);
    }
    return out;
  }
  return null;
}

/* ---------------------------------------------------------------- reach (R6–R9) */

function systemName(view, origin) {
  const s = arr(view.systems).find((x) => isObj(x) && x.origin === origin);
  return s && typeof s.name === "string" ? s.name : origin;
}

/* The conflicts combine reported over a kind's floor. `at` names the fact; it is matched on the kind and
   the word "floor", so a report of the floor of that kind is found however the path is spelled. */
function floorConflicts(conflicts, kind) {
  return conflicts.filter((c) => {
    if (!isObj(c)) return false;
    const at = typeof c.at === "string" ? c.at : JSON.stringify(c.at ?? "");
    return /floor/i.test(at) && new RegExp(`(^|[^a-z0-9_])${kind.replace(/[^a-z0-9_]/gi, "\\$&")}([^a-z0-9_]|$)`, "i").test(at);
  });
}
function conflictSays(cs) {
  return cs.map((c) => arr(c.values).map((x) => isObj(x)
    ? `${x.profile ?? "a profile"} gives ${JSON.stringify(isObj(x.value) && has(x.value, "first") ? x.value.first : x.value)}`
    : String(x)).join(", ")).join("; ");
}

/* The floor of one kind: `{floor, system}`, or `{why}` naming which of R9's two causes applies. */
function floorOf(view, conflicts, kind) {
  const entries = kindsOf(view).filter((k) => k.kind === kind);
  const floors = entries.map((k) => k.floor).filter((f) => isObj(f) && Number.isFinite(f.first));
  const distinct = [...new Set(floors.map((f) => f.first))];
  if (distinct.length === 1) {
    const f = floors[0];
    return { floor: f.first, system: f.system, basis: f.basis };
  }
  const cs = floorConflicts(conflicts, kind);
  if (distinct.length > 1 || cs.length)
    return { conflict: true, why: word("idspaces.why.active_profiles_give", { kind: String(kind), distinct: String(cs.length ? conflictSays(cs) : distinct.join(", ")) }) };
  if (!entries.length) return { why: word("idspaces.why.active_profiles_name", { kind: String(kind) }) };
  return { why: word("idspaces.why.coverage_floor_measured", { kind: String(kind) }) };
}

const outsideSays = (view, kind, f) => word("idspaces.text.first_outside_record", { kind: String(kind), system: String(systemName(view, f.system)), floor: String(f.floor) });

/** Whether an enactment number is inside the record's reach (R6–R9). Never throws. */
export function reach(v, number, kind = null) {
  const { view, conflicts } = viewOf(v);
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
  const known = each.filter((e) => e.floor != null);
  const named = known.map((e) => `${e.kind} ${e.floor}`).join(", ");
  if (known.length && known.every((e) => n < e.floor) && known.length === each.length)
    return { reach: "OUTSIDE_REACH", says: word("idspaces.says.kind_coverage_floor", { named: String(named) }) };
  if (known.length === each.length && known.every((e) => n >= e.floor))
    return { reach: "INSIDE", says: word("idspaces.says.kind_coverage_floor_record", { named: String(named) }) };
  const unknown = each.filter((e) => e.floor == null).map((e) => e.why);
  return { reach: "UNDETERMINED", says: word("idspaces.says.kind_stated_inside", { boolean: String([
    known.length ? localize("id-spaces.idspaces.inside_reach_some_kinds", "{n} is inside the reach for some kinds and outside it for others (floors: {named})", { n: String(n), named }) : null,
    ...unknown].filter(Boolean).join("; ")) }) };
}

/* ---------------------------------------------------------------- parcelStanding (R10–R12) */

function inCurrent(current, key) {
  if (current instanceof Set) return current.has(key);
  if (Array.isArray(current)) return current.includes(key);
  return false;
}
function lineageOf(lineage, key) {
  let rec;
  if (lineage instanceof Map) rec = lineage.get(key);
  else if (isObj(lineage) && typeof key === "string" && has(lineage, key)) rec = lineage[key];
  if (isObj(rec) && !Array.isArray(rec)) rec = [rec];
  return arr(rec).filter((r) => isObj(r) && Number.isFinite(r.roll_year));
}

/** A parcel key's standing from the assessor's own evidence (R10–R12). Never throws. */
export function parcelStanding(key, evidence) {
  const ev = isObj(evidence) ? evidence : {};
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

function systemOfOne(view, address) {
  let u;
  try { u = new URL(String(address)); } catch { return { origin: null, unknown: true, why: word("idspaces.why.parseable_address") }; }
  const host = u.hostname.toLowerCase();
  const path = u.pathname + u.search;
  for (const s of arr(view.systems)) {
    if (!isObj(s) || typeof s.origin !== "string" || !s.origin) continue;
    if (!arr(s.hosts).some((h) => typeof h === "string" && h.toLowerCase() === host)) continue;
    if (s.path != null) {
      const re = compile(s.path, "find");
      if (!re || !re.test(path)) continue;
    }
    return { origin: s.origin, name: typeof s.name === "string" ? s.name : s.origin, republication: s.republishes === true,
             provenance_stated: s.provenance_stated !== false, basis: s.basis ?? null };
  }
  const mixed = arr(view.mixed_hosts).find((m) => isObj(m) && typeof m.host === "string" && m.host.toLowerCase() === host);
  if (mixed) return { origin: null, unknown: true, why: word("idspaces.why.serves_many_offices", { host: String(host), why: String(typeof mixed.why === "string" && mixed.why ? ` (${mixed.why})` : "") }) };
  return { origin: null, unknown: true, why: word("idspaces.why.system_active_profiles", { host: String(host) }) };
}

/** The system a capture belongs to, from every address the record located it at (R13–R15). Never throws. */
export function systemOf(v, addresses) {
  const { view } = viewOf(v);
  const given = typeof addresses === "string" ? [addresses] : arr(addresses);
  const list = [...new Set(given.filter((a) => a != null).map(String))];
  if (!list.length) return { origin: null, addresses: [], why: word("idspaces.why.addresses_record_holds") };
  const each = list.map((address) => ({ address, ...systemOfOne(view, address) }));
  const origins = [...new Set(each.map((e) => e.origin))];
  if (origins.length === 1 && origins[0]) {
    const { origin, name, republication, provenance_stated, basis } = each[0];
    return { origin, name, republication, provenance_stated, basis, addresses: list };
  }
  const why = list.length === 1 ? each[0].why
    : each.every((e) => !e.origin) ? word("idspaces.text.unknown_systems_addresses", { list: String(list.length), why: String([...new Set(each.map((e) => e.why))].join("; ")) })
    : each.some((e) => !e.origin) ? word("idspaces.text.unknown_systems_some")
    : word("idspaces.text.different_systems_record", { origins: String(origins.join(", ")) });
  return { origin: null, addresses: list, why, each: each.map(({ unknown, ...e }) => e) };
}

/* ---------------------------------------------------------------- judgePair (R16–R22) */

function normName(n) {
  return String(n == null ? "" : n).toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, " ").replace(/\bfund\b/gu, " ")
    .replace(/\s+/g, " ").trim();
}
const unpadAll = (s) => String(s).replace(/(^|\D)0+(?=\d)/g, "$1");

/* A crosswalk the view supplies between the two forms: whether it joins these two values. */
function throughCrosswalk(view, space, ra, rb) {
  const walks = arr(view.crosswalks).filter((c) => isObj(c) && c.space === space && Array.isArray(c.forms)
    && ((c.forms[0] === ra.form && c.forms[1] === rb.form) || (c.forms[0] === rb.form && c.forms[1] === ra.form)));
  if (!walks.length) return null;
  const formByName = new Map(formsOf(view, space).map((f) => [f.form, f]));
  const norm = (form, value) => {
    const f = formByName.get(form);
    return f && (typeof value === "string" || typeof value === "number") ? matchForm(f, String(value)) : null;
  };
  const partners = new Set();
  for (const c of walks) {
    const aFirst = c.forms[0] === ra.form;
    for (const p of arr(c.pairs)) {
      if (!Array.isArray(p) || p.length < 2) continue;
      const [x, y] = aFirst ? [norm(c.forms[0], p[0]), norm(c.forms[1], p[1])] : [norm(c.forms[1], p[1]), norm(c.forms[0], p[0])];
      if (x != null && x === ra.normal && y != null) partners.add(y);
    }
  }
  return { sources: walks.map((c) => c.source), partners: [...partners] };
}

/** §8.3's counting rule over one pair (R16–R22). Throws TypeError only when an end is unrecognised or not in
 *  `space`; the caller must recognise both values first. */
export function judgePair(v, space, a, b, reading = null) {
  const ra = isObj(a) ? a.rec : null, rb = isObj(b) ? b.rec : null;
  if (!isObj(ra) || !isObj(rb)) throw new TypeError("judgePair: a.rec and b.rec must both be recognised values (recognise() first)");
  if (!SPACE_NAMES.includes(space) || ra.space !== space || rb.space !== space)
    throw new TypeError(`judgePair: both values must be recognised in the space "${space}"`);
  const { view } = viewOf(v);
  const label = spaces(view).find((s) => s.space === space).label;
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
  const sa = isObj(a.system) ? a.system : {}, sb = isObj(b.system) ? b.system : {};
  if (!sa.origin || !sb.origin) {
    const which = !sa.origin ? "first" : "second", s = !sa.origin ? sa : sb;
    return verdict("SYSTEM_UNDETERMINED", localize("id-spaces.idspaces.which_system_published_the_which", "which system published the {which} end is undetermined{v1}; a match counts only between two systems known to be independent", { which: String(which), v1: String(typeof s.why === "string" ? ` (${s.why})` : "") }));
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
const HELD_REPORTERS = CourtCitations;

/* A spelling's folded key: white space removed, so "F. Supp." and "F.Supp." meet (as `court-citations` R7
   folds them). Letter case and every other character are kept. A spelling is looked up as written first, and
   folded only when no spelling is held as written, so two reporters' spellings that differ only by spacing
   ("B.R.", "B. R.") stay apart. */
const spellingKey = (s) => String(s).replace(/\s+/g, "");

/* The reporter data compiled once per data object: the lookups (as written, and folded; each → the reporters
   and editions a spelling stands for) and the most words a spelling can be written in. Data in neither of
   court-citations' shapes (`VARIANTS`, `REPORTERS`) compiles to null. */
const DATA = new WeakMap();
function compileReporters(data) {
  if (!isObj(data)) return null;
  if (DATA.has(data)) return DATA.get(data);
  const exact = new Map(), lookup = new Map();
  let words = 1;
  const put = (map, k, reporter, edition) => {
    if (!map.has(k)) map.set(k, new Map());
    map.get(k).set(`${reporter}\u0000${edition ?? ""}`, { reporter, edition: typeof edition === "string" ? edition : null });
  };
  const add = (spelling, reporter, edition) => {
    if (typeof spelling !== "string" || !spelling.trim() || typeof reporter !== "string" || !reporter) return;
    put(exact, spelling.trim(), reporter, edition);
    put(lookup, spellingKey(spelling), reporter, edition);
    /* written with a space after every period, a spelling has at most this many words */
    words = Math.max(words, spelling.trim().replace(/\.(?=\S)/g, ". ").split(/\s+/).length);
  };
  try {
    const variants = isObj(data.VARIANTS) ? data.VARIANTS : Array.isArray(data.REPORTERS) ? null : data;
    const reporters = Array.isArray(data.REPORTERS) ? data.REPORTERS : null;
    if (isObj(variants) && !Array.isArray(variants))
      for (const spelling of Object.keys(variants)) {
        const v = variants[spelling];
        for (const x of Array.isArray(v) ? v : [v]) if (isObj(x)) add(spelling, x.reporter, x.edition);
      }
    for (const r of arr(reporters)) {
      if (!isObj(r) || typeof r.key !== "string") continue;
      add(r.key, r.key, r.key);
      for (const ed of arr(r.editions)) if (isObj(ed)) add(ed.key, r.key, ed.key);
      if (isObj(r.variations)) for (const sp of Object.keys(r.variations)) add(sp, r.key, r.variations[sp]);
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
function findCitations(t, data) {
  const found = [];
  VOLUME.lastIndex = 0;
  for (let m; (m = VOLUME.exec(t)); ) {
    const words = [];
    WORD.lastIndex = m.index + m[0].length;
    for (let w; words.length <= data.words && (w = WORD.exec(t)); ) words.push({ start: w.index + w[0].length - w[1].length, end: WORD.lastIndex, s: w[1] });
    for (let k = Math.min(data.words, words.length - 1); k >= 1; k--) {
      const page = PAGE.exec(words[k].s);
      if (!page) continue;
      const variant = t.slice(words[0].start, words[k - 1].end);
      const hit = data.exact.get(variant) ?? data.lookup.get(spellingKey(variant));
      if (!hit) continue;
      let end = words[k].start + page[0].length;
      const pin = PIN.exec(t.slice(end, end + 32));
      const c = { volume: Number(m[0]), variant, page: Number(page[0]), entries: [...hit.values()], start: m.index };
      if (pin) { c.pin = Number(pin[1]); end += pin[0].length; }
      c.end = end;
      found.push(c);
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
const looksLikeReporter = (r) => /\./.test(r) || /^[\p{Lu}&\s]{2,}$/u.test(r);

function shapes(text) {
  const out = [];
  for (const m of text.matchAll(SHAPE)) if (looksLikeReporter(m[2])) out.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  return out;
}

/** The court citations in `text`, each volume, reporter and page (R27–R29). `reporters` is court-citations'
 *  data (its exports, or its `VARIANTS` map alone), taking precedence over the data this module holds.
 *  Never throws. */
export function recogniseCitations(text, reporters = undefined) {
  try {
    const t = typeof text === "string" ? text : "";
    const passed = reporters !== undefined && reporters !== null;
    const data = passed ? compileReporters(reporters) : compileReporters(HELD_REPORTERS);
    if (typeof text !== "string")
      return { citations: [], undetermined: { why: word("idspaces.why.text_given_string") } };
    if (!data) {
      const why = passed
        ? localize("id-spaces.idspaces.no_reporter_data_held_for", "no reporter data is held for this reading: the data passed is in neither of court-citations' shapes (VARIANTS or REPORTERS)")
        : localize("id-spaces.idspaces.no_reporter_data_held", "no reporter data is held (court-citations' data is not readable here, and none was passed)");
      const unrecognised = shapes(t);
      return { citations: [], undetermined: { why: localize("id-spaces.idspaces.why_no_citation_can_be", "{why}: no citation can be recognised, and finding none says nothing about what the text cites", { why: String(why) }), ...(unrecognised.length ? { unrecognised } : {}) } };
    }
    const citations = [], ambiguous = [], taken = [];
    for (const f of findCitations(t, data)) {
      const { start, end, variant } = f;
      taken.push([start, end]);
      const named = [...new Set(f.entries.map((e) => e.reporter))].sort();
      if (named.length !== 1) {
        ambiguous.push({ text: t.slice(start, end), start, end, variant, reporters: named });
        continue;
      }
      const c = { volume: f.volume, reporter: named[0], variant, page: f.page };
      if (f.pin !== undefined) c.pin = f.pin;
      citations.push({ ...c, start, end });
    }
    /* both lists are in reading order, so one sweep finds the shapes no citation found overlaps */
    let i = 0;
    const unrecognised = shapes(t).filter((s) => {
      while (i < taken.length && taken[i][1] <= s.start) i++;
      return !(i < taken.length && taken[i][0] < s.end);
    });
    if (!unrecognised.length && !ambiguous.length) return { citations };
    const undetermined = {};
    if (unrecognised.length) {
      undetermined.unrecognised = unrecognised;
      undetermined.why = word("idspaces.why.run_text_volume", { unrecognized: String(unrecognised.length) });
    }
    if (ambiguous.length) {
      undetermined.ambiguous = ambiguous;
      undetermined.why = [undetermined.why, word("idspaces.why.citation_written_spelling", { ambiguous: String(ambiguous.length) })].filter(Boolean).join("; ");
    }
    return { citations, undetermined };
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
const famKey = (key, series) => `${key}\u0000${series}`;
function conflictFamily(c) {
  const at = typeof c.at === "string" ? c.at : "";
  const m = /^standard_sources\[([^\]]*)\]/.exec(at);
  if (!m) return null;
  const parts = m[1].split("/");
  return parts.length === 2 && parts[0] && parts[1] ? { key: parts[0], series: parts[1] } : null;
}
function seriesOf(view, conflicts) {
  const withheld = new Map(), readable = [], unreadable = [], byFam = new Map();
  for (const c of conflicts) {
    if (!isObj(c)) continue;
    const f = conflictFamily(c);
    if (!f) continue;
    const k = famKey(f.key, f.series);
    if (!withheld.has(k)) withheld.set(k, { key: f.key, series: f.series, at: [], says: [] });
    withheld.get(k).at.push(c.at);
    if (typeof c.says === "string" && c.says) withheld.get(k).says.push(c.says);
  }
  for (const s of arr(view.standard_sources)) {
    if (!isObj(s) || !isObj(s.series)) continue;
    if (typeof s.key !== "string" || !s.key || typeof s.series.key !== "string" || !s.series.key) {
      unreadable.push({ source: typeof s.source === "string" ? s.source : null, why: word("idspaces.why.series_issuer_key") });
      continue;
    }
    const k = famKey(s.key, s.series.key);
    if (!byFam.has(k)) byFam.set(k, []);
    byFam.get(k).push(s);
  }
  const sig = (s) => JSON.stringify([s.series.label ?? null, s.cite ?? null, s.normal ?? null]);
  for (const [k, list] of byFam) {
    const { key, series } = { key: list[0].key, series: list[0].series.key };
    const withheldHere = (why) => {
      if (!withheld.has(k)) withheld.set(k, { key, series, at: [], says: [] });
      withheld.get(k).says.push(why);
    };
    if (withheld.has(k)) continue;
    if (new Set(list.map(sig)).size > 1) { withheldHere(word("idspaces.withheld_here.view_entries_family")); continue; }
    const s = list[0];
    if (!isObj(s.cite)) { withheldHere(word("idspaces.withheld_here.view_holds_family")); continue; }
    const re = compileFind(s.cite);
    if (!re) { unreadable.push({ key, series, why: word("idspaces.why.citation_pattern_compile") }); continue; }
    readable.push({ entry: s, re });
  }
  return { readable, withheld: [...withheld.values()], unreadable, held: byFam.size + withheld.size };
}

/* A citation pattern compiled to search a whole text, or null when it does not compile. */
const FINDS = new WeakMap();
function compileFind(p) {
  if (!isObj(p) || typeof p.re !== "string") return null;
  if (FINDS.has(p)) return FINDS.get(p);
  let re = null;
  try { re = new RegExp(p.re, `g${typeof p.flags === "string" ? p.flags.replace(/[^iu]/g, "") : ""}`); } catch { re = null; }
  FINDS.set(p, re);
  return re;
}

/* One match read as the entry says: the number, portion and edition as written, the normal form from the
   entry's normal parts (R3 there: formatting removed only, R4 here), or the number as matched. */
function readMatch(s, m) {
  const g = m.groups || {};
  const number = typeof g.number === "string" ? g.number : "";
  if (!number) return null;
  let normal = number;
  if (Array.isArray(s.normal) && s.normal.length) {
    normal = normalOf({ normal: s.normal }, m);
    if (!normal) return null;
  }
  const out = { key: s.key, series: s.series.key, label: typeof s.series.label === "string" ? s.series.label : null,
                kind: s.kind ?? null, issuer: s.issuer ?? null, number, normal };
  if (typeof g.portion === "string" && g.portion) out.portion = g.portion;
  if (s.kind === "standard" && typeof g.edition === "string" && g.edition) out.edition = g.edition;
  out.start = m.index; out.end = m.index + m[0].length;
  out.basis = s.basis ?? null; out.profile = s.profile ?? null;
  return out;
}

const noSeries = (why, extra = {}) => ({ citations: [], undetermined: { why, ...extra } });

/** The policy-series and standard citations in `text`, read from the view's series (R30–R33). Never throws. */
export function recogniseSeries(v, text) {
  try {
    const { view, conflicts } = viewOf(v);
    if (typeof text !== "string")
      return noSeries(word("idspaces.no_series.text_given_string"));
    const { readable, withheld, unreadable, held } = seriesOf(view, conflicts);
    const named = withheld.map(({ key, series, at, says }) => ({ key, series, ...(at.length ? { at } : {}),
      says: says.length ? says.join("; ") : word("idspaces.says.active_profiles_disagree") }));
    const extra = { ...(named.length ? { conflicts: named } : {}), ...(unreadable.length ? { unreadable } : {}) };
    if (!held)
      return noSeries(localize("id-spaces.idspaces.active_profiles_supply_no", "the active profiles supply no policy series or standard designation, so no citation of one can be recognised: finding none says nothing about whether the text cites a policy or a standard"), extra);
    /* every entry's matches, then grouped where they overlap */
    const found = [];
    for (const { entry, re } of readable) {
      re.lastIndex = 0;
      for (let m; (m = re.exec(text)); ) {
        if (m[0].length === 0) { re.lastIndex++; continue; }
        const r = readMatch(entry, m);
        if (r) found.push(r);
      }
    }
    found.sort((a, b) => a.start - b.start || b.end - a.end);
    const groups = [];
    for (const f of found) {
      const g = groups[groups.length - 1];
      if (g && f.start < g.end) { g.items.push(f); g.end = Math.max(g.end, f.end); }
      else groups.push({ start: f.start, end: f.end, items: [f] });
    }
    const citations = [], ambiguous = [];
    for (const g of groups) {
      const readings = new Map();
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
    const why = [];
    if (ambiguous.length) why.push(word("idspaces.push.run_text_read", { ambiguous: String(ambiguous.length) }));
    if (named.length) why.push(word("idspaces.push.famil_ies_withheld", { named: String(named.length) }));
    if (unreadable.length) why.push(localize("id-spaces.idspaces.length_series_cannot_be_read", "{length} series cannot be read from the view, so a citation of one is not recognised", { length: String(unreadable.length) }));
    if (!readable.length && !why.length) why.push(word("idspaces.push.series_view_read"));
    if (!why.length) return { citations };
    return { citations, undetermined: { why: why.join("; "), ...(ambiguous.length ? { ambiguous } : {}), ...extra } };
  } catch {
    return noSeries(word("idspaces.no_series.text_read_policy"));
  }
}
