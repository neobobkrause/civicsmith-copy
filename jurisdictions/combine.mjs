/* The held profiles (R8, R9, R19) and combine (R12–R16, R29, R34, R41–R44, R55, R66, R72, R74–R87, R90), with
 * governingZone (R98). Moved unchanged from `index.mjs`, the module's interface file, which re-exports them. */
import FIRST from "./profiles/oakland-alameda.mjs";
import TEST from "./profiles/test-port-ellery.mjs";
import { localize } from "../bio-plane/src/setup-words/index.mjs";
import { isObj, isList, listOr, own, isTimeZone, localeKey, thrownWords, keyOf, memberTypeKey, listKey, officesKey, officesWords } from "./shared.mjs";
import { validate } from "./validate.mjs";

/** @import { Value, Fields } from "./shared.mjs" */
/** @import { Profile, ProfileSummary, SpaceName, Space, Form, FormRule, EnactmentKind, EnactmentKindFacts, Floor, FloorRule, System, MixedHost, Crosswalk, Vocabulary, Hours, TimeZone, Pointer, RecordsLawFacts, LawStage, Requesters, StandardSourceFacts, CounterpartyFacts, CounterpartyIds, Within, ActionKind, ActionKindFacts, Venue, VenueFacts, VenueFact, Outage, Template, Deadline, DeadlineFacts, HolidayDay, HolidayOffice, Status, LocalName, LocalNameFacts, Explanation, Computation, FiscalYear, LawRank, ProceedingFlow, LawfulDemand, LegalFact, ProcedureGuide, Tagged, View, ViewSpace, ViewSpaces, ViewVocabulary, ViewPractice, ViewMinutesDue, ViewPointer, ViewActionKind, ViewTemplate, ViewDeadline, ViewHoliday, ViewLocalName, Conflict, ConflictValue, ConflictFact, CombineError, Combined, CombineResult } from "./types.mjs" */

/** A value one profile gives for a fact, with the basis it gives it on.
 *  @template T
 *  @typedef {{ profile: string, value: T, basis: string }} Given */
/** An entry of a list being unioned (R14): its key (`canon`) and the entry as the view will hold it.
 *  @template T
 *  @typedef {{ k: string, e: Tagged<T> }} Slot */
/** A group of values, never empty: it is made with its first member.
 *  @template T
 *  @typedef {[T, ...T[]]} Group */

/* ------------------------------------------------------------------------------------------------ */
/* Copies.                                                                                          */

/** A deep copy of JSON data: lists stay lists (a missing entry becomes null), an object keeps the fields that are not
 *  undefined.
 *  @param {Value} o
 *  @returns {Value} */
function copyValue(o) {
  if (isList(o)) {
    const r = listOr(null); /* a new, empty list */
    for (let i = 0; i < o.length; i++) { const x = o[i]; r.push(x === undefined ? null : copyValue(x)); }
    return r;
  }
  if (isObj(o)) {
    /** @type {Fields} */
    const r = {};
    for (const k of Object.keys(o)) { const x = o[k]; if (x !== undefined) r[k] = copyValue(x); }
    return r;
  }
  return o;
}
/** A deep copy of JSON data, of the kind it copies: `copyValue` rebuilds every list and object member for member.
 *  @template {Value} T
 *  @param {T} o
 *  @returns {T} */
const copy = (o) => /** @type {T} */ (copyValue(o));
/** A copy of JSON data by its text, of the kind it copies.
 *  @template {Value} T
 *  @param {T} o
 *  @returns {T} */
const clone = (o) => /** @type {T} */ (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));

/* ------------------------------------------------------------------------------------------------ */
/* The held profiles (R8, R9, R19).                                                                  */

/** Freeze a value and everything in it.
 *  @param {Value} o
 *  @returns {void} */
function deepFreeze(o) {
  if (isList(o)) { o.forEach(deepFreeze); Object.freeze(o); }
  else if (isObj(o)) { Object.values(o).forEach(deepFreeze); Object.freeze(o); }
}
/** @type {Map<string, Profile>} */
const HELD = emptyMap();
/* Each held profile is read as its text, a copy of it, and is a Profile because `validate` finds no fault in it. Every
   held profile passes `validate` (R19), as the tests prove, so none is left out. */
for (const p of [FIRST, TEST]) {
  const text = JSON.parse(JSON.stringify(p));
  const held = isProfile(text) ? text : null;
  if (!held) continue;
  deepFreeze(held);
  HELD.set(held.id, held);
}

/** Every profile held, sorted by id: `[{id, name, covers, test}]`. Never throws.
 *  @returns {ProfileSummary[]} */
export function list() {
  return [...HELD.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((p) => ({ id: p.id, name: p.name, covers: p.covers.slice(), test: p.test === true }));
}

/** The held profile with that id, as the caller's own copy, or null. Never throws.
 *  @param {unknown} id
 *  @returns {Profile | null} */
export function get(id) {
  const held = typeof id === "string" ? HELD.get(id) : undefined;
  if (held === undefined) return null;
  return copy(held);
}

/* ------------------------------------------------------------------------------------------------ */
/* combine (R12–R16, R29, R34, R41–R44, R55, R66, R72, R74–R87, R90).                                   */

/* A stable key for "equal in everything but its basis and profile". Object keys are sorted so the
   order a profile writes its fields in never makes two equal entries differ. */
/** @param {Value} v
 *  @returns {string} */
function canon(v) {
  if (isList(v)) return `[${v.map(canon).join(",")}]`;
  if (isObj(v)) return `{${Object.keys(v).sort().filter((k) => k !== "basis" && k !== "profile" && k !== "bases")
    .map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}`;
  return JSON.stringify(v);
}
/* The whole value, basis included, with object keys sorted. */
/** @param {Value} v
 *  @returns {string} */
function stable(v) {
  if (isList(v)) return `[${v.map(stable).join(",")}]`;
  if (isObj(v)) return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
  return JSON.stringify(v);
}
/** An entry as the view holds it: copied, with its giver and its giver's basis (R13, R14).
 *  @template {{ basis: string }} T
 *  @param {T} e
 *  @param {string} profile
 *  @returns {Tagged<T>} */
const tag = (e, profile) => ({ ...clone(e), profile, bases: [{ profile, basis: e.basis }] });
/** Union in order; an entry equal to an earlier one but for basis and profile is kept once (R14).
 *  @template {{ basis: string }} T
 *  @param {Slot<T>[]} into
 *  @param {readonly T[] | undefined} entries
 *  @param {string} profile
 *  @returns {void} */
function union(into, entries, profile) {
  for (const e of entries || []) {
    const k = canon(e);
    const at = into.find((x) => x.k === k);
    if (at) { if (!at.e.bases.some((b) => b.profile === profile && b.basis === e.basis)) at.e.bases.push({ profile, basis: e.basis }); }
    else into.push({ k, e: tag(e, profile) });
  }
}
/** The entries of a union, as the view holds them.
 *  @template T
 *  @param {Slot<T>[]} arr
 *  @returns {Tagged<T>[]} */
const strip = (arr) => arr.map((s) => s.e);
/** The first member of a group.
 *  @template T
 *  @param {readonly [T, ...T[]]} xs
 *  @returns {T} */
const head = (xs) => xs[0];
/** `xs` as a group, or null when it is empty. Where a fact is read, some profile gives it, so its list of givers is
 *  never empty.
 *  @template T
 *  @param {T[]} xs
 *  @returns {Group<T> | null} */
function nonEmpty(xs) {
  const [x, ...rest] = xs;
  return x === undefined ? null : [x, ...rest];
}
/** A group's members, each mapped, in order.
 *  @template T, U
 *  @param {Group<T>} g
 *  @param {(x: T) => U} f
 *  @returns {Group<U>} */
function mapGroup(g, f) {
  const [x, ...rest] = g;
  return [f(x), ...rest.map((y) => f(y))];
}
/* A one-value fact that carries its own basis (a venue, evidence, a template, hours, the time zone), kept as
   the first giver wrote it, tagged with every giver's basis (R13, R14). `given` is `[{profile, value, basis}]`. */
/** @template {object} T
 *  @param {readonly [Given<T>, ...Given<T>[]]} given
 *  @returns {Tagged<T>} */
const keep = (given) => {
  const g0 = given[0];
  return { ...clone(g0.value), profile: g0.profile, bases: given.map((g) => ({ profile: g.profile, basis: g.basis })) };
};
/** The one value a keyed fact holds, or a conflict (R15). `given` is `[{profile, value, basis}]`.
 *  @param {readonly { value: Value }[]} given
 *  @returns {boolean} */
function agree(given) {
  const ks = [...new Set(given.map((g) => canon(g.value)))];
  return ks.length <= 1;
}
/** Add `x` to the group `k` of `m`, making the group when it is the first.
 *  @template K, V
 *  @param {Map<K, Group<V>>} m
 *  @param {K} k
 *  @param {V} x
 *  @returns {void} */
function pushTo(m, k, x) {
  const xs = m.get(k);
  if (xs) xs.push(x);
  else m.set(k, [x]);
}

/** An empty map of the stated kinds.
 *  @template K, V
 *  @returns {Map<K, V>} */
function emptyMap() {
  /** @type {[K, V][]} */
  const none = [];
  return new Map(none);
}
/** An empty set of the stated kind.
 *  @template T
 *  @returns {Set<T>} */
function emptySet() {
  /** @type {T[]} */
  const none = [];
  return new Set(none);
}

/** Whether `v` is a profile: `validate` finds no fault in it (R10).
 *  @param {unknown} v
 *  @returns {v is Profile} */
function isProfile(v) { return validate(v).ok; }

/* The answers to lists of held ids, by the ids joined; at most COMBINED_MAX lists are held. */
/** @type {Map<string, Combined>} */
const COMBINED = emptyMap();
const COMBINED_MAX = 64;

/**
 * Combine the active profiles, in order. `list` holds ids of held profiles or profile objects.
 * `{ok: true, view, conflicts}` or `{ok: false, errors}`. Never throws.
 * @param {unknown} listIn
 * @returns {CombineResult}
 */
export function combine(listIn) {
  /* A list of held ids is a pure function of frozen data (K5288): its answer is merged once and each caller gets
     its own copy of it (R18). Profile objects and ids not held are merged every time. */
  try {
    const items = isList(listIn) ? listIn : null;
    const key = items && items.every((x) => typeof x === "string" && HELD.has(x)) ? keyOf(...items) : null;
    const cached = key !== null ? COMBINED.get(key) : undefined;
    if (cached !== undefined) return copy(cached);
    /** @type {CombineResult} */
    const r = items ? combineInner(items)
      : { ok: false, errors: [{ at: null, code: "NOT_A_LIST", detail: "combine takes a list of profile ids or profiles" }] };
    if (key === null || !r.ok) return r;
    /* the first answer is a copy of the one held, as every later one is, so no answer differs from another by a
       member that holds undefined */
    const kept = copy(r);
    if (COMBINED.size >= COMBINED_MAX) COMBINED.clear();
    COMBINED.set(key, kept);
    return copy(kept);
  }
  catch (e) {
    return { ok: false, errors: [{ at: null, code: "INVALID_PROFILE", detail: `unreadable: ${thrownWords(e)}` }] };
  }
}

/**
 * The team's governing time zone (R98, K5292): `teamZone` when it is an R41 value; else the `time_zone` of the view
 * `combine(profileIds)` gives; else `null`. The one site every module that needs the zone asks. Never throws.
 * @param {unknown} profileIds
 * @param {unknown} teamZone
 * @returns {string | null}
 */
export function governingZone(profileIds, teamZone) {
  try {
    if (typeof teamZone === "string" && isTimeZone(teamZone)) return teamZone;
    if (!isList(profileIds) || profileIds.length === 0) return null;
    const r = combine(profileIds);
    const zone = r.ok ? r.view.time_zone : undefined;
    const v = zone ? zone.value : null;
    return isTimeZone(v) ? v : null;
  } catch { return null; }
}

/** Combine a list (R12): every item a held id or a profile, else the errors.
 *  @param {Value[]} listIn
 *  @returns {CombineResult} */
function combineInner(listIn) {
  /** @type {CombineError[]} */
  const errors = [];
  /** @type {Profile[]} */
  const profiles = [];
  /** @type {Map<string, Profile>} */
  const seen = emptyMap();
  listIn.forEach((item, i) => {
    /** @type {Profile} */
    let p;
    if (typeof item === "string") {
      const held = get(item);
      if (!held) { errors.push({ at: i, code: "UNKNOWN_PROFILE", detail: localize("jurisdictions.index.no_profile_item_is_held", "no profile '{item}' is held", { item: String(item) }) }); return; }
      p = held;
    } else {
      /* validate is pure (R17): the errors read again are the ones it found */
      if (!isProfile(item)) { errors.push({ at: i, code: "INVALID_PROFILE", detail: "the profile fails validate", errors: validate(item).errors }); return; }
      p = clone(item);
    }
    /* A profile given twice is combined once. Two different profiles under one id cannot be told
       apart in the view's `profile` tags, so that is refused rather than one of them chosen. */
    if (seen.has(p.id)) {
      if (stable(seen.get(p.id)) !== stable(p))
        errors.push({ at: i, code: "INVALID_PROFILE", detail: localize("jurisdictions.index.a_different_profile_with_id", "a different profile with id '{id}' was given earlier", { id: String(p.id) }), errors: [] });
      return;
    }
    seen.set(p.id, p);
    profiles.push(p);
  });
  if (errors.length) return { ok: false, errors };
  return { ok: true, ...merge(profiles) };
}

/* The spaces, in SPACES's order (R3), as their kind. */
/** @type {readonly SpaceName[]} */
const SPACE_NAMES = ["enactment", "project", "fund", "parcel", "account", "object", "vendor", "proceeding", "person",
  "body", "office", "institution"];

/** An enactment kind without its floor, which is one value per kind (R15).
 *  @param {EnactmentKind} k
 *  @returns {EnactmentKindFacts} */
function kindFacts(k) {
  /** @type {EnactmentKindFacts} */
  const r = { ...k, floor: undefined };
  delete r.floor;
  return r;
}
/** A venue without the facts that are one value each under its kind (R42, R48, R74, R82).
 *  @param {Venue} v
 *  @returns {VenueFacts} */
function venueFacts(v) {
  /** @type {VenueFacts} */
  const r = { ...v, hours: undefined, time_zone: undefined, cutoff: undefined, receipt: undefined, outages: undefined, facts: undefined };
  delete r.hours; delete r.time_zone; delete r.cutoff; delete r.receipt; delete r.outages; delete r.facts;
  return r;
}

/** Merge profiles that each passed validate, in order (R13–R16 and the sections' own rules).
 *  @param {Profile[]} profiles
 *  @returns {{ view: View, conflicts: Conflict[] }} */
function merge(profiles) {
  /** @type {Conflict[]} */
  const conflicts = [];
  /** @param {string} at
   *  @param {ConflictValue[]} values
   *  @param {string} says
   *  @returns {number} */
  const conflict = (at, values, says) => conflicts.push({ at, values, says });
  /** @type {View} */
  const view = {
    id: profiles.map((p) => p.id).join("+"),
    name: profiles.map((p) => p.name).join("; "),
    covers: [...new Set(profiles.flatMap((p) => p.covers))],
    test: profiles.some((p) => p.test === true),
    profiles: profiles.map((p) => p.id),
  };
  /** @param {string} sec
   *  @returns {boolean} */
  const has = (sec) => profiles.some((p) => own(p, sec));
  /** Every profile's entries of one list section, unioned (R14).
   *  @template {{ basis: string }} T
   *  @param {(p: Profile) => T[] | undefined} read
   *  @returns {Tagged<T>[]} */
  const unionAll = (read) => {
    /** @type {Slot<T>[]} */
    const v = [];
    for (const p of profiles) union(v, read(p), p.id);
    return strip(v);
  };

  /* spaces: labels joined, forms keyed by name (one definition per name), kinds unioned with one
     floor per kind. */
  if (has("spaces")) {
    /** @type {ViewSpaces} */
    const spaces = {};
    view.spaces = spaces;
    for (const space of SPACE_NAMES) {
      /** @type {{ id: string, s: Space }[]} */
      const givers = [];
      for (const p of profiles) { const sp = p.spaces; const s = sp ? sp[space] : undefined; if (s) givers.push({ id: p.id, s }); }
      if (!givers.length) continue;
      /** @type {ViewSpace} */
      const s = { label: [...new Set(givers.map((g) => g.s.label))].join("; "), forms: [] };
      /** @type {Map<string, Group<{ profile: string, value: Form }>>} */
      const byForm = emptyMap();
      for (const g of givers) for (const f of g.s.forms || []) pushTo(byForm, f.form, { profile: g.id, value: f });
      for (const [form, given] of byForm) {
        /** @type {Given<FormRule>[]} */
        const vals = given.map((g) => ({ profile: g.profile, value: (({ basis, ...rest }) => rest)(g.value), basis: g.value.basis }));
        if (!agree(vals)) {
          conflict(`spaces.${space}.forms[${form}]`, vals,
            localize("jurisdictions.index.the_active_profiles_define_the", "the active profiles define the {space} form '{form}' differently, so it is withheld: a value in it is recognised by no profile until they agree", { space: String(space), form: String(form) }));
          continue;
        }
        /** @type {Slot<Form>[]} */
        const merged = [];
        for (const g of given) union(merged, [g.value], g.profile);
        s.forms.push(...strip(merged));
      }
      if (space === "enactment" && givers.some((g) => own(g.s, "kinds"))) {
        /** @type {Slot<EnactmentKindFacts>[]} */
        const kinds = [];
        for (const g of givers) union(kinds, (g.s.kinds || []).map(kindFacts), g.id);
        /** @type {Map<string, Group<Given<FloorRule>>>} */
        const floors = emptyMap();
        for (const g of givers) for (const k of g.s.kinds || []) {
          const fl = k.floor;
          if (fl) pushTo(floors, k.kind, { profile: g.id, value: (({ basis, ...rest }) => rest)(fl), basis: fl.basis });
        }
        for (const [kind, given] of floors) {
          if (!agree(given)) {
            conflict(`spaces.enactment.kinds[${kind}].floor`, given,
              localize("jurisdictions.index.the_active_profiles_give_different", "the active profiles give different coverage floors for {kind}, so no floor is given: whether a number is inside the record's reach is undetermined", { kind: String(kind) }));
            continue;
          }
          const g0 = head(given);
          /** @type {Tagged<Floor>} */
          const floor = { ...g0.value, basis: g0.basis, profile: g0.profile, bases: given.map((g) => ({ profile: g.profile, basis: g.basis })) };
          for (const k of kinds) if (k.e.kind === kind) k.e.floor = clone(floor);
        }
        s.kinds = strip(kinds);
      }
      spaces[space] = s;
    }
  }

  /* systems and mixed hosts: a host and path name one origin, or none (R15). */
  if (has("systems") || has("mixed_hosts")) {
    /** @type {Slot<System>[]} */
    const systems = [];
    for (const p of profiles) union(systems, p.systems || [], p.id);
    /** @type {Slot<MixedHost>[]} */
    const mixed = [];
    for (const p of profiles) union(mixed, p.mixed_hosts || [], p.id);
    /** @param {System} s
     *  @returns {string} */
    const pathKey = (s) => { const path = s.path; return path ? canon(path) : ""; };
    /** @type {Map<string, Group<Tagged<System>>>} */
    const byHostPath = emptyMap();
    /** @type {Map<string, string>} */
    const hostOf = emptyMap(); /* each key's host */
    for (const slot of systems) {
      const s = slot.e;
      for (const h of s.hosts) { const k = keyOf(h, pathKey(s)); pushTo(byHostPath, k, s); hostOf.set(k, h); }
    }
    /** @type {Set<string>} */
    const withheld = emptySet(); /* `${host}\0${pathKey}` */
    for (const [k, ss] of byHostPath) {
      const origins = [...new Set(ss.map((s) => s.origin))];
      if (origins.length < 2) continue;
      const host = hostOf.get(k) ?? "";
      withheld.add(k);
      const path0 = head(ss).path;
      conflict(`systems[host=${host}${path0 ? ` path=${path0.re}` : ""}]`,
        ss.flatMap((s) => s.bases.map((b) => ({ profile: b.profile, value: s.origin, basis: b.basis }))),
        localize("jurisdictions.index.the_active_profiles_say_host", "the active profiles say {host} publishes different systems' material ({origins}), so an address there names no system", { host: String(host), origins: String(origins.join(", ")) }));
    }
    /** @type {Set<string>} */
    const mixedWithheld = emptySet();
    for (const slot of mixed) {
      const m = slot.e;
      const k = keyOf(m.host, "");
      /* validate refuses this inside one profile (HOST_CONFLICT), so here it is always two profiles. */
      const others = (byHostPath.get(k) || []).filter((s) => !s.path);
      if (!others.length) continue;
      withheld.add(k);
      mixedWithheld.add(m.host);
      conflict(`mixed_hosts[${m.host}]`,
        [...m.bases.map((b) => ({ profile: b.profile, value: "mixed", basis: b.basis })),
         ...others.flatMap((s) => s.bases.map((b) => ({ profile: b.profile, value: s.origin, basis: b.basis })))],
        localize("jurisdictions.index.one_active_profile_says_host", "one active profile says {host} serves many offices' publications and another names a system for it, so an address there names no system", { host: String(m.host) }));
    }
    if (has("systems")) view.systems = strip(systems)
      .map((s) => ({ ...s, hosts: s.hosts.filter((h) => !withheld.has(keyOf(h, pathKey(s)))) }))
      .filter((s) => s.hosts.length);
    if (has("mixed_hosts")) view.mixed_hosts = strip(mixed).filter((m) => !mixedWithheld.has(m.host));
  }

  if (has("crosswalks")) {
    /** @type {Slot<Crosswalk>[]} */
    const x = [];
    for (const p of profiles) union(x, p.crosswalks, p.id);
    view.crosswalks = strip(x);
  }

  if (has("vocabulary")) {
    /** @type {ViewVocabulary} */
    const vv = {};
    view.vocabulary = vv;
    /** One vocabulary key's entries, unioned (R14), or null when no profile gives the key.
     *  @template {{ basis: string }} T
     *  @param {string} key
     *  @param {(v: Vocabulary) => T[] | undefined} read
     *  @returns {Slot<T>[] | null} */
    const gather = (key, read) => {
      if (!profiles.some((p) => { const pv = p.vocabulary; return pv && own(pv, key); })) return null;
      /** @type {Slot<T>[]} */
      const v = [];
      for (const p of profiles) { const pv = p.vocabulary; union(v, pv ? read(pv) : undefined, p.id); }
      return v;
    };
    /* the keys in VOCABULARY's order */
    const furniture = gather("furniture", (v) => v.furniture); if (furniture) vv.furniture = strip(furniture);
    const bodies = gather("bodies", (v) => v.bodies); if (bodies) vv.bodies = strip(bodies);
    const memberTitles = gather("member_titles", (v) => v.member_titles); if (memberTitles) vv.member_titles = strip(memberTitles);
    const enactmentMarkers = gather("enactment_markers", (v) => v.enactment_markers); if (enactmentMarkers) vv.enactment_markers = strip(enactmentMarkers);
    const codes = gather("codes", (v) => v.codes); if (codes) vv.codes = strip(codes);
    const fileNumbers = gather("file_numbers", (v) => v.file_numbers); if (fileNumbers) vv.file_numbers = strip(fileNumbers);
    const reportTitles = gather("report_titles", (v) => v.report_titles); if (reportTitles) vv.report_titles = strip(reportTitles);
    const reportSections = gather("report_sections", (v) => v.report_sections); if (reportSections) vv.report_sections = strip(reportSections);
    const openers = gather("recommendation_openers", (v) => v.recommendation_openers); if (openers) vv.recommendation_openers = strip(openers);
    const blanks = gather("template_blanks", (v) => v.template_blanks); if (blanks) vv.template_blanks = strip(blanks);
    const amending = gather("amending", (v) => v.amending); if (amending) vv.amending = strip(amending);
    const meetingMarkers = gather("meeting_markers", (v) => v.meeting_markers); if (meetingMarkers) vv.meeting_markers = strip(meetingMarkers);
    const bodyVariants = gather("body_variants", (v) => v.body_variants); if (bodyVariants) vv.body_variants = strip(bodyVariants);
    const rosterWords = gather("roster_words", (v) => v.roster_words); if (rosterWords) vv.roster_words = strip(rosterWords);
    const rosterHeaders = gather("roster_headers", (v) => v.roster_headers); if (rosterHeaders) vv.roster_headers = strip(rosterHeaders);
    const staffTitles = gather("staff_titles", (v) => v.staff_titles); if (staffTitles) vv.staff_titles = strip(staffTitles);
    const financialReportTitles = gather("financial_report_titles", (v) => v.financial_report_titles); if (financialReportTitles) vv.financial_report_titles = strip(financialReportTitles);
    const budgetBookTitles = gather("budget_book_titles", (v) => v.budget_book_titles); if (budgetBookTitles) vv.budget_book_titles = strip(budgetBookTitles);
    const financialHeadings = gather("financial_headings", (v) => v.financial_headings); if (financialHeadings) vv.financial_headings = strip(financialHeadings);
    const fiscalYearForms = gather("fiscal_year_forms", (v) => v.fiscal_year_forms); if (fiscalYearForms) vv.fiscal_year_forms = strip(fiscalYearForms);
    const budgetHeaders = gather("budget_headers", (v) => v.budget_headers); if (budgetHeaders) vv.budget_headers = strip(budgetHeaders);
    const voteValues = gather("vote_values", (v) => v.vote_values); if (voteValues) vv.vote_values = strip(voteValues);
    const responseStatuses = gather("response_statuses", (v) => v.response_statuses); if (responseStatuses) vv.response_statuses = strip(responseStatuses);
    /* R60: a MemberType's capacity, for one body or for all (K1729), is one value per key; profiles that disagree have
       it withheld */
    const memberTypes = gather("member_types", (v) => v.member_types);
    if (memberTypes) {
      for (const k of [...new Set(memberTypes.map((s) => memberTypeKey(s.e)))]) {
        const given = memberTypes.filter((s) => memberTypeKey(s.e) === k);
        const [first] = given;
        if (given.length < 2 || !first) continue;
        const t = first.e.member_type, o = first.e.organisation;
        conflict(`vocabulary.member_types[${t}${o ? `/${o}` : ""}]`, given.flatMap((s) => s.e.bases.map((b) => ({ profile: b.profile, value: s.e.capacity, basis: b.basis }))),
          localize("jurisdictions.index.the_active_profiles_map_the", "the active profiles map the MemberType '{t}'{v1} to different capacities, so it maps to none there: a seat's capacity is undetermined", { t: String(t), v1: String(o ? ` on ${o}` : "") }));
        for (const s of given) memberTypes.splice(memberTypes.indexOf(s), 1);
      }
      vv.member_types = strip(memberTypes);
    }
    const policyHeaders = gather("policy_headers", (v) => v.policy_headers); if (policyHeaders) vv.policy_headers = strip(policyHeaders);
  }

  if (has("practice")) {
    /** @type {ViewPractice} */
    const practice = {};
    view.practice = practice;
    /* the value and its count (calendar when absent, R7) are one fact */
    const given = profiles.flatMap((p) => {
      const pr = p.practice;
      const m = pr ? pr.minutes_due_days : undefined;
      return m ? [{ profile: p.id, value: m.value, count: m.count || "calendar", closures: m.closures, written: m, basis: m.basis }] : [];
    });
    const g0 = given[0];
    if (g0 && agree(given.map((g) => ({ value: [g.value, g.count, g.closures ?? null] })))) {
      /** @type {ViewMinutesDue} */
      const m = { value: g0.value, count: g0.count, closures: g0.closures, basis: g0.basis, profile: g0.profile,
        bases: given.map((g) => ({ profile: g.profile, basis: g.basis })) };
      if (!own(g0.written, "count")) delete m.count;
      if (!own(g0.written, "closures")) delete m.closures;
      practice.minutes_due_days = m;
    }
    else if (given.length)
      conflict("practice.minutes_due_days", given.map(({ written, ...g }) => g),
        localize("jurisdictions.index.minutes_due_conflict", "the active profiles give different periods after which absent minutes raise a question, so none is given"));
  }

  /* locale: one value (N77), as practice's. */
  if (has("locale")) {
    const given = profiles.flatMap((p) => { const l = p.locale; return l ? [{ profile: p.id, value: l.value, basis: l.basis }] : []; });
    if (agree(given)) {
      const [g0] = given;
      if (g0) view.locale = { value: g0.value, basis: g0.basis, profile: g0.profile,
        bases: given.map((g) => ({ profile: g.profile, basis: g.basis })) };
    }
    else conflict("locale", given, localize("jurisdictions.index.locale_conflict", "the active profiles name different locales, so none is given: a render asks for its fallback"));
  }

  /* time_zone: one value (R41), its status part of it (R44). */
  if (has("time_zone")) {
    const given = nonEmpty(profiles.flatMap((p) => { const z = p.time_zone; return z ? [{ profile: p.id, value: z, basis: z.basis }] : []; }));
    if (given && agree(given)) view.time_zone = keep(given);
    else if (given) conflict("time_zone", given, localize("jurisdictions.index.time_zone_conflict", "the active profiles name different time zones, so none is given: a time of day there is undetermined"));
  }

  if (has("search_terms")) view.search_terms = unionAll((p) => p.search_terms);
  if (has("legal_organisations")) view.legal_organisations = unionAll((p) => p.legal_organisations);
  if (has("phrasings")) view.phrasings = unionAll((p) => p.phrasings);
  /* R90 (T48): pointers are unioned in the order given, as R14's lists are; a pointer's hours carry their own basis, so
     the hours kept are tagged with every giver's (R13), as an office's are. */
  /* R93 (T50): the records-help block is one value (R15): kept only when every profile that gives it gives the same. */
  if (has("records_help")) {
    const given = nonEmpty(profiles.flatMap((p) => { const h = p.records_help; return h ? [{ profile: p.id, value: h, basis: h.basis }] : []; }));
    if (given && agree(given)) view.records_help = keep(given);
    else if (given) conflict("records_help", given, localize("jurisdictions.index.records_help_conflict", "the active profiles give different records-request help, so none is given: the page has no figure to show"));
  }
  /* R94 (T50): forums are unioned (R14), a forum given twice once. */
  if (has("forums")) view.forums = unionAll((p) => p.forums);
  if (has("pointers")) {
    /** @type {Slot<Pointer>[]} */
    const v = [];
    /** @type {Map<string, Group<Given<Hours>>>} */
    const hoursOf = emptyMap();
    for (const p of profiles) for (const x of p.pointers || []) {
      union(v, [x], p.id);
      const h = own(x, "hours") ? x.hours : undefined;
      if (!h) continue;
      pushTo(hoursOf, canon(x), { profile: p.id, value: h, basis: h.basis });
    }
    view.pointers = v.map((s) => {
      const hs = hoursOf.get(s.k);
      /** @type {ViewPointer} */
      const e = { ...s.e, hours: hs ? keep(hs) : undefined };
      if (!hs) delete e.hours;
      return e;
    });
  }

  /* records laws are unioned (R14); a law's stages and who may request under it are one value each under its name
     (R76): profiles that disagree have it withheld, so which stages the law has is undetermined. */
  if (has("records_laws")) {
    /** @type {Slot<RecordsLawFacts>[]} */
    const v = [];
    /** @type {Map<string, Group<Given<LawStage[]>>>} */
    const stagesBy = emptyMap();
    /** @type {Map<string, Group<Given<Requesters>>>} */
    const requestersBy = emptyMap();
    /** @type {Map<string, Group<Given<string>>>} */
    const responseBy = emptyMap();
    for (const p of profiles) for (const l of p.records_laws || []) {
      /** @type {RecordsLawFacts} */
      const rest = { ...l, stages: undefined, requesters: undefined, response: undefined };
      delete rest.stages; delete rest.requesters; delete rest.response;
      union(v, [rest], p.id);
      const { stages, requesters, response } = l;
      if (own(l, "stages") && stages) pushTo(stagesBy, l.name, { profile: p.id, value: stages, basis: l.basis });
      if (own(l, "requesters") && requesters) pushTo(requestersBy, l.name, { profile: p.id, value: requesters, basis: requesters.basis });
      if (own(l, "response") && response !== undefined) pushTo(responseBy, l.name, { profile: p.id, value: response, basis: l.basis });
    }
    /** @param {string} name
     *  @param {(l: Tagged<RecordsLawFacts>) => void} fn
     *  @returns {void} */
    const eachLaw = (name, fn) => { for (const s of v) if (s.e.name === name) fn(s.e); };
    for (const [name, given] of stagesBy) {
      if (!agree(given)) {
        conflict(`records_laws[${name}].stages`, given,
          localize("jurisdictions.index.the_active_profiles_give_name", "the active profiles give {name} different stages, so which stages it has is undetermined", { name: String(name) }));
        continue;
      }
      eachLaw(name, (l) => { l.stages = clone(head(given).value); });
    }
    for (const [name, given] of requestersBy) {
      if (!agree(given)) {
        conflict(`records_laws[${name}].requesters`, given,
          localize("jurisdictions.index.the_active_profiles_say_differently", "the active profiles say differently who may request under {name}, so it is undetermined", { name: String(name) }));
        continue;
      }
      eachLaw(name, (l) => { l.requesters = keep(given); });
    }
    for (const [name, given] of responseBy) {
      if (!agree(given)) {
        conflict(`records_laws[${name}].response`, given,
          localize("jurisdictions.index.the_active_profiles_give_name_different_windows", "the active profiles give {name} different first-request windows, so which one it has is undetermined", { name: String(name) }));
        continue;
      }
      eachLaw(name, (l) => { l.response = clone(head(given).value); });
    }
    view.records_laws = strip(v);
  }

  /* standard sources are unioned (R14); a family's label, cite and normal under its key and series key, and an
     entry's level and sector under its source and issuer, are one value per key (R66): profiles that disagree have it
     withheld. A family withheld is dropped from the view whole, so a citation of it is recognised by no profile's
     choice (K1916 (2)); a level or sector withheld leaves its entry without that field. */
  if (has("standard_sources")) {
    const FAMILY = "a family of documents";
    /** @type {{ profile: string, e: StandardSourceFacts, dropped: boolean }[]} */
    const given = profiles.flatMap((p) => (p.standard_sources || []).map((e) => ({ profile: p.id, e: clone(e), dropped: false })));
    /** @typedef {[string, (e: StandardSourceFacts) => ConflictFact, (e: StandardSourceFacts) => void]} SourceFact */
    /** @type {[(e: StandardSourceFacts) => string[] | null, SourceFact[], string, string][]} */
    const ONE = [
      [(e) => { const sr = e.series, key = e.key; return sr && key !== undefined ? [key, sr.key] : null; }, [
        ["series.label", (e) => { const sr = e.series; const label = sr ? sr.label : undefined; return label === undefined ? null : label; },
          (e) => { const sr = e.series; if (sr) delete sr.label; }],
        ["cite", (e) => e.cite ?? null, (e) => { delete e.cite; }],
        ["normal", (e) => e.normal ?? null, (e) => { delete e.normal; }]],
        FAMILY, localize("jurisdictions.index.family_dropped_from_view", "the family is dropped from the view: a citation of it is recognised by no profile until they agree")],
      [(e) => [e.source, e.issuer], [
        ["level", (e) => e.level ?? null, (e) => { delete e.level; }],
        /* an entry with a level reads sector government when it gives none (R64) */
        ["sector", (e) => e.sector ?? (own(e, "level") ? "government" : null), (e) => { delete e.sector; }]],
        "a standard source", localize("jurisdictions.index.who_issues_undetermined", "who issues it is undetermined")],
    ];
    for (const [partsOf, facts, what, says] of ONE) {
      /** @type {Map<string, Group<{ profile: string, e: StandardSourceFacts, dropped: boolean }>>} */
      const groups = emptyMap();
      /** @type {Map<string, string[]>} */
      const partsBy = emptyMap(); /* each key's parts, for the conflict's place and words */
      for (const g of given) {
        const parts = partsOf(g.e);
        if (parts === null) continue;
        const k = keyOf(...parts);
        pushTo(groups, k, g);
        partsBy.set(k, parts);
      }
      for (const [k, gs] of groups) {
        if (new Set(gs.map((g) => g.profile)).size < 2) continue;
        const parts = partsBy.get(k) ?? [];
        /* every fact is read before any is withheld: a sector reads government from the level the entry gives (R64),
           whether or not that level is then withheld */
        const read = facts.map(([f, readFact, drop]) => ({ f, drop, vals: gs.map((g) => ({ profile: g.profile, value: readFact(g.e), basis: g.e.basis })) }));
        /** @type {Set<string>} */
        const withheld = emptySet();
        for (const { f, drop, vals } of read) {
          if (agree(vals)) continue;
          withheld.add(f);
          conflict(`standard_sources[${parts.join("/")}].${f}`, vals,
            localize("jurisdictions.index.the_active_profiles_give_what", "the active profiles give {what} ({replace}) different {v1}, so it is withheld: {says}", { what: String(what), replace: String(parts.join(", ")), v1: String(f === "series.label" ? "labels" : `${f}s`), says: String(says) }));
          for (const g of gs) drop(g.e);
          if (what === FAMILY) for (const g of gs) g.dropped = true;
        }
        /* a level withheld leaves its entry no level to read government from, so the sector every giver agreed on is
           written (R64, R66) */
        if (withheld.has("level") && !withheld.has("sector")) for (const g of gs) if (!own(g.e, "sector")) g.e.sector = "government";
      }
    }
    /** @type {Slot<StandardSourceFacts>[]} */
    const v = [];
    for (const g of given) if (!g.dropped) union(v, [g.e], g.profile);
    view.standard_sources = strip(v);
  }

  /* counterparties are unioned; an office's oversight marker and its hours are one value per role and body (R29,
     R42). */
  if (has("counterparties")) {
    /** @type {Slot<CounterpartyFacts>[]} */
    const v = [];
    /** @type {Map<string, Group<Given<boolean>>>} */
    const marks = emptyMap();
    /** @type {Map<string, Group<Given<Hours>>>} */
    const hoursOf = emptyMap();
    /** @type {Map<string, Group<Given<TimeZone>>>} */
    const zones = emptyMap(); /* R74 */
    /* R59 */
    /** @type {Map<string, Group<Given<CounterpartyIds>>>} */
    const idsOf = emptyMap();
    /** @type {Map<string, Group<Given<Within>>>} */
    const withinOf = emptyMap();
    /** @type {Map<string, Group<Given<string>>>} */
    const organisationOf = emptyMap();
    /** @type {Map<string, [string, string]>} */
    const officeOf = emptyMap(); /* each key's role and body */
    for (const p of profiles) for (const c of p.counterparties || []) {
      /** @type {CounterpartyFacts} */
      const rest = { ...c, oversight: undefined, hours: undefined, time_zone: undefined, ids: undefined, within: undefined, organisation: undefined };
      delete rest.oversight; delete rest.hours; delete rest.time_zone; delete rest.ids; delete rest.within; delete rest.organisation;
      union(v, [rest], p.id);
      const k = keyOf(c.role, c.body);
      officeOf.set(k, [c.role, c.body]);
      const { oversight, hours, time_zone, ids, within, organisation } = c;
      if (own(c, "oversight") && oversight !== undefined) pushTo(marks, k, { profile: p.id, value: oversight, basis: c.basis });
      if (own(c, "hours") && hours) pushTo(hoursOf, k, { profile: p.id, value: hours, basis: hours.basis });
      if (own(c, "time_zone") && time_zone) pushTo(zones, k, { profile: p.id, value: time_zone, basis: time_zone.basis });
      if (own(c, "ids") && ids) pushTo(idsOf, k, { profile: p.id, value: ids, basis: c.basis });
      if (own(c, "within") && within) pushTo(withinOf, k, { profile: p.id, value: within, basis: c.basis });
      if (own(c, "organisation") && organisation !== undefined) pushTo(organisationOf, k, { profile: p.id, value: organisation, basis: c.basis });
    }
    /** @param {string} k
     *  @param {(c: Tagged<CounterpartyFacts>) => void} fn
     *  @returns {void} */
    const each = (k, fn) => { for (const s of v) if (keyOf(s.e.role, s.e.body) === k) fn(s.e); };
    /** The role and body a key names.
     *  @param {string} k
     *  @returns {[string, string]} */
    const officeAt = (k) => officeOf.get(k) ?? ["", ""];
    for (const [k, given] of marks) {
      if (agree(given)) { each(k, (c) => { c.oversight = head(given).value; }); continue; }
      const [role, body] = officeAt(k);
      conflict(`counterparties[${role}/${body}].oversight`, given,
        localize("jurisdictions.index.the_active_profiles_disagree_on", "the active profiles disagree on whether {role} ({body}) is an oversight or audit body, so it is undetermined", { role: String(role), body: String(body) }));
    }
    for (const [k, given] of hoursOf) {
      if (agree(given)) { each(k, (c) => { c.hours = keep(given); }); continue; }
      const [role, body] = officeAt(k);
      conflict(`counterparties[${role}/${body}].hours`, given,
        localize("jurisdictions.index.the_active_profiles_give_different_2", "the active profiles give different hours for {role} ({body}), so its hours are undetermined", { role: String(role), body: String(body) }));
    }
    for (const [k, given] of zones) {
      if (agree(given)) { each(k, (c) => { c.time_zone = keep(given); }); continue; }
      const [role, body] = officeAt(k);
      conflict(`counterparties[${role}/${body}].time_zone`, given,
        localize("jurisdictions.index.the_active_profiles_give_different_3", "the active profiles give different time zones for {role} ({body}), so its local day is undetermined", { role: String(role), body: String(body) }));
    }
    const NAMED = { ids: localize("jurisdictions.index.named_identifiers", "identifiers"), within: localize("jurisdictions.index.named_within", "organisations it is part of"), organisation: localize("jurisdictions.index.named_body_variants", "body-variant keys") };
    /** A conflict on one of R59's facts.
     *  @param {"ids" | "within" | "organisation"} f
     *  @param {string} k
     *  @param {ConflictValue[]} given
     *  @returns {void} */
    const namedConflict = (f, k, given) => {
      const [role, body] = officeAt(k);
      conflict(`counterparties[${role}/${body}].${f}`, given,
        localize("jurisdictions.index.the_active_profiles_give_different_4", "the active profiles give different {v1} for {role} ({body}), so none is given: it is undetermined", { v1: String(NAMED[f]), role: String(role), body: String(body) }));
    };
    for (const [k, given] of idsOf) {
      if (agree(given)) { each(k, (c) => { c.ids = clone(head(given).value); }); continue; }
      namedConflict("ids", k, given);
    }
    for (const [k, given] of withinOf) {
      if (agree(given)) { each(k, (c) => { c.within = clone(head(given).value); }); continue; }
      namedConflict("within", k, given);
    }
    for (const [k, given] of organisationOf) {
      if (agree(given)) { each(k, (c) => { c.organisation = clone(head(given).value); }); continue; }
      namedConflict("organisation", k, given);
    }
    view.counterparties = strip(v);
  }

  /* action kinds, keyed by kind: tier, venue, template, advisory and evidence are one value each (R29). */
  if (has("action_kinds")) {
    /** @type {Map<string, Group<{ profile: string, k: ActionKind }>>} */
    const byKind = emptyMap();
    for (const p of profiles) for (const k of p.action_kinds || []) pushTo(byKind, k.kind, { profile: p.id, k });
    /** @type {ViewActionKind[]} */
    const kindsOut = [];
    view.action_kinds = kindsOut;
    for (const [kind, given] of byKind) {
      /** @type {ActionKindFacts} */
      const e = { kind, label: [...new Set(given.map((g) => g.k.label))].join("; ") };
      const laws = [...new Set(given.flatMap((g) => g.k.laws || []))];
      if (given.some((g) => own(g.k, "laws"))) e.laws = laws;
      /* venue, template and evidence carry their own basis: the fact kept names every giver's (R13, R14). A
         venue's hours are one value of their own (R29, R42); a template is one value, its whole attribution
         included (R40). */
      const WHAT = { tier: "risk tiers", venue: "venues", template: "templates", advisory: "advisory notes", evidence: "evidence standards",
        shape: "shapes" };
      /** Each giver's value of one of the kind's one-value facts, with the basis it rests on: the fact's own where it
       *  carries one (venue, template, evidence), else the kind's.
       *  @template V
       *  @param {"tier" | "venue" | "template" | "advisory" | "evidence" | "shape"} f
       *  @param {(k: ActionKind) => { value: V, basis: string } | null} read
       *  @returns {Given<V>[]} */
      const valsOf = (f, read) => given.flatMap((g) => {
        if (!own(g.k, f)) return [];
        const r = read(g.k);
        return r ? [{ profile: g.profile, value: r.value, basis: r.basis }] : [];
      });
      /** @param {"tier" | "venue" | "template" | "advisory" | "evidence" | "shape"} f
       *  @param {ConflictValue[]} vals
       *  @returns {void} */
      const differ = (f, vals) => {
        conflict(`action_kinds[${kind}].${f}`, vals, localize("jurisdictions.index.the_active_profiles_give_different_5", "the active profiles give different {v1} for {kind}, so none is given{v2}", { v1: String(WHAT[f]), kind: String(kind), v2: String(f === "evidence" ? ": the venue's standard is undetermined" : "") }));
      };
      const tiers = nonEmpty(valsOf("tier", (k) => { const t = k.tier; return t === undefined ? null : { value: clone(t), basis: k.basis }; }));
      if (tiers) { if (agree(tiers)) e.tier = head(tiers).value; else differ("tier", tiers); }
      const venues = nonEmpty(valsOf("venue", (k) => { const v = k.venue; return v === undefined ? null : { value: venueFacts(clone(v)), basis: v.basis }; }));
      if (venues) { if (agree(venues)) e.venue = keep(venues); else differ("venue", venues); }
      const singles = nonEmpty(valsOf("template", (k) => { const t = k.template; return t === undefined ? null : { value: clone(t), basis: t.basis }; }));
      if (singles) { if (agree(singles)) e.template = keep(singles); else differ("template", singles); }
      const advisories = nonEmpty(valsOf("advisory", (k) => { const a = k.advisory; return a === undefined ? null : { value: clone(a), basis: k.basis }; }));
      if (advisories) { if (agree(advisories)) e.advisory = head(advisories).value; else differ("advisory", advisories); }
      const evidence = nonEmpty(valsOf("evidence", (k) => { const ev = k.evidence; return ev === undefined ? null : { value: clone(ev), basis: ev.basis }; }));
      if (evidence) { if (agree(evidence)) e.evidence = keep(evidence); else differ("evidence", evidence); }
      const shapes = nonEmpty(valsOf("shape", (k) => { const sh = k.shape; return sh === undefined ? null : { value: clone(sh), basis: k.basis }; }));
      if (shapes) { if (agree(shapes)) e.shape = head(shapes).value; else differ("shape", shapes); }
      const venue = e.venue;
      if (venue) {
        /* hours (R42), and the channel's cutoff and receipt rule (R48, R55), are one value each; outages are unioned. */
        const SAYS = { hours: "its hours are undetermined", cutoff: "its cutoff is undetermined",
          receipt: localize("jurisdictions.index.receipt_on_closed_day", "receipt on a closed day stays the actual day only where no profile states otherwise; here it is undetermined"),
          time_zone: localize("jurisdictions.index.local_day_undetermined", "its local day is undetermined") };
        const PLURAL = { hours: "hours", cutoff: "cutoffs", receipt: "receipt rules", time_zone: "time zones" };
        /** One of the venue's one-value facts, kept where every giver agrees, else a conflict.
         *  @template {{ basis: string }} V
         *  @param {"hours" | "cutoff" | "receipt" | "time_zone"} f
         *  @param {(v: Venue) => V | undefined} read
         *  @param {(x: Tagged<V>) => void} put
         *  @param {(vs: Given<V>[]) => ConflictValue[]} values
         *  @returns {void} */
        const sub = (f, read, put, values) => {
          const vs = nonEmpty(given.flatMap((g) => {
            const gv = g.k.venue;
            const x = gv && own(gv, f) ? read(gv) : undefined;
            return x ? [{ profile: g.profile, value: x, basis: x.basis }] : [];
          }));
          if (vs && agree(vs)) put(keep(vs));
          else if (vs) conflict(`action_kinds[${kind}].venue.${f}`, values(vs),
            localize("jurisdictions.index.the_active_profiles_give_different_6", "the active profiles give different {v1} for {kind}'s venue, so {v2}", { v1: String(PLURAL[f]), kind: String(kind), v2: String(SAYS[f]) }));
        };
        sub("hours", (x) => x.hours, (x) => { venue.hours = x; }, (vs) => vs);
        sub("cutoff", (x) => x.cutoff, (x) => { venue.cutoff = x; }, (vs) => vs);
        sub("receipt", (x) => x.receipt, (x) => { venue.receipt = x; }, (vs) => vs);
        sub("time_zone", (x) => x.time_zone, (x) => { venue.time_zone = x; }, (vs) => vs);
        if (given.some((g) => { const gv = g.k.venue; return gv !== undefined && own(gv, "outages"); })) {
          /** @type {Slot<Outage>[]} */
          const o = [];
          for (const g of given) { const gv = g.k.venue; if (gv) union(o, gv.outages, g.profile); }
          venue.outages = strip(o);
        }
        /* R82: a venue fact is one value per kind and fact */
        if (given.some((g) => { const gv = g.k.venue; return gv !== undefined && own(gv, "facts"); })) {
          /** @type {Map<string, Group<Given<VenueFact>>>} */
          const byFact = emptyMap();
          for (const g of given) { const gv = g.k.venue; if (gv) for (const x of gv.facts || []) pushTo(byFact, x.fact, { profile: g.profile, value: x, basis: x.basis }); }
          /** @type {Tagged<VenueFact>[]} */
          const facts = [];
          venue.facts = facts;
          for (const [fact, vs] of byFact) {
            if (agree(vs)) facts.push(keep(vs));
            else conflict(`action_kinds[${kind}].venue.facts[${fact}]`, vs, localize("jurisdictions.index.the_active_profiles_state_kind", "the active profiles state {kind}'s venue's {fact} differently, so it is undetermined", { kind: String(kind), fact: String(fact) }));
          }
        }
      }
      /* R81: a kind's templates, one value per purpose; its single template reads as the set of one, purpose initial */
      /** @param {ActionKind} k
       *  @returns {(Template & { purpose: string })[] | null} */
      const setOf = (k) => {
        const set = k.templates, single = k.template;
        return own(k, "templates") && set ? set : own(k, "template") && single ? [{ ...single, purpose: "initial" }] : null;
      };
      if (!given.some((g) => own(g.k, "templates"))) { const t = e.template; if (t) e.templates = [{ ...clone(t), purpose: "initial" }]; }
      /* only single templates: their one value (R29) is the set's, its conflict already reported once */
      else if (given.some((g) => setOf(g.k))) {
        /** @type {Map<string, Group<Given<Template & { purpose: string }>>>} */
        const byPurpose = emptyMap();
        for (const g of given) for (const t of setOf(g.k) || []) pushTo(byPurpose, t.purpose, { profile: g.profile, value: t, basis: t.basis });
        /** @type {ViewTemplate[]} */
        const templates = [];
        e.templates = templates;
        for (const [purpose, vs] of byPurpose) {
          if (agree(vs)) templates.push(keep(vs));
          else conflict(`action_kinds[${kind}].templates[${purpose}]`, vs, localize("jurisdictions.index.the_active_profiles_give_different_7", "the active profiles give different {purpose} templates for {kind}, so none is given", { purpose: String(purpose), kind: String(kind) }));
        }
      }
      const g0 = head(given);
      kindsOut.push({ ...e, basis: g0.k.basis, profile: g0.profile, bases: given.map((g) => ({ profile: g.profile, basis: g.k.basis })) });
    }
  }

  /* deadlines, keyed by rule and what they apply to: every field but the citation is one value each (R29, R55). An
     entry written `days: n` reads as `units: "days", amount: n` (R26); the view gives both forms for a day period. */
  if (has("deadlines")) {
    /** @type {Map<string, Group<{ profile: string, d: Deadline }>>} */
    const byRule = emptyMap();
    for (const p of profiles) for (const d of p.deadlines || []) pushTo(byRule, keyOf(d.rule, d.applies_to), { profile: p.id, d: normalDeadline(d) });
    /** @type {ViewDeadline[]} */
    const deadlines = [];
    view.deadlines = deadlines;
    for (const given of byRule.values()) {
      const g0 = head(given);
      const { rule, applies_to } = g0.d;
      /** @type {DeadlineFacts} */
      const e = { rule, applies_to };
      /** One of R29's and R55's one-value fields (DEADLINE_ONE_VALUE, in its order): kept where every giver agrees.
       *  @template {ConflictFact} V
       *  @param {string} f
       *  @param {(d: Deadline) => V | undefined} read
       *  @param {(vals: Group<Given<V>>) => void} put
       *  @returns {void} */
      const one = (f, read, put) => {
        const vals = nonEmpty(given.flatMap((g) => {
          if (!own(g.d, f)) return [];
          const x = read(g.d);
          return x === undefined ? [] : [{ profile: g.profile, value: clone(x), basis: g.d.basis }];
        }));
        if (!vals) return;
        if (!agree(vals)) {
          conflict(`deadlines[${rule}/${applies_to}].${f}`, vals, localize("jurisdictions.index.the_active_profiles_disagree_on_2", "the active profiles disagree on the {f} of {rule} for {applies_to}, so it is withheld: the deadline is undetermined", { f: String(f), rule: String(rule), applies_to: String(applies_to) }));
          return;
        }
        put(vals);
      };
      one("units", (d) => d.units, (vals) => { e.units = head(vals).value; });
      one("amount", (d) => d.amount, (vals) => { e.amount = head(vals).value; });
      one("count", (d) => d.count, (vals) => { e.count = head(vals).value; });
      one("direction", (d) => d.direction, (vals) => { e.direction = head(vals).value; });
      one("starts", (d) => d.starts, (vals) => { e.starts = head(vals).value; });
      one("starter", (d) => d.starter, (vals) => { e.starter = head(vals).value; });
      one("roll", (d) => d.roll, (vals) => { e.roll = head(vals).value; });
      one("closures", (d) => d.closures, (vals) => { e.closures = head(vals).value; });
      one("computation", (d) => d.computation, (vals) => { e.computation = head(vals).value; });
      one("extension", (d) => d.extension, (vals) => { e.extension = head(vals).value; });
      one("tolling", (d) => d.tolling, (vals) => { e.tolling = head(vals).value; });
      one("observed", (d) => d.observed, (vals) => { e.observed = keep(mapGroup(vals, (v) => ({ ...v, basis: v.value.basis }))); });
      one("applies_on", (d) => d.applies_on, (vals) => { e.applies_on = head(vals).value; });
      one("due_at", (d) => d.due_at, (vals) => { e.due_at = head(vals).value; });
      one("owed_by", (d) => d.owed_by, (vals) => { e.owed_by = head(vals).value; });
      one("consequence", (d) => d.consequence, (vals) => { e.consequence = head(vals).value; });
      one("defends", (d) => d.defends, (vals) => { e.defends = head(vals).value; });
      one("status", (d) => d.status, (vals) => { e.status = head(vals).value; });
      one("label", (d) => d.label, (vals) => { e.label = head(vals).value; });
      const amount = e.amount;
      if (e.units === "days" && own(e, "amount") && amount !== undefined) e.days = amount;
      deadlines.push({ ...e, citation: [...new Set(given.map((g) => g.d.citation))].join("; "), basis: g0.d.basis, profile: g0.profile,
        bases: given.map((g) => ({ profile: g.profile, basis: g.d.basis })) });
    }
  }

  /* holidays: a year's days, keyed by the year and its offices (R34, R43), are one value, their status part of
     it (R44); the order a profile lists the days or the offices in is no disagreement. */
  if (has("holidays")) {
    /** @type {Map<string, Group<{ profile: string, year: number, named: string | undefined, offices: HolidayOffice[] | undefined, value: HolidayDay[], status: Status, citation: string | undefined, basis: string }>>} */
    const byKey = emptyMap();
    /** @param {HolidayDay} a
     *  @param {HolidayDay} b
     *  @returns {number} */
    const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    for (const p of profiles) for (const h of p.holidays || []) {
      const k = keyOf(h.year, listKey(h), officesKey(h.offices));
      pushTo(byKey, k, { profile: p.id, year: h.year, named: h.list, offices: h.offices, value: h.days.slice().sort(byDate), status: h.status, citation: h.citation, basis: h.basis });
    }
    /** @type {ViewHoliday[]} */
    const holidays = [];
    view.holidays = holidays;
    for (const given of byKey.values()) {
      const g0 = head(given);
      const { year, offices, named } = g0;
      if (!agree(given.map((g) => ({ value: { days: g.value, status: g.status, citation: g.citation } })))) {
        const whose = offices ? ` for ${offices.map((o) => (typeof o === "string" ? o : `${o.venue}'s venue`)).join(", ")}` : "";
        conflict(`holidays[${year}${named ? ` list=${named}` : ""}${offices ? ` offices=${officesWords(offices)}` : ""}]`,
          given.map((g) => ({ profile: g.profile, value: g.value, status: g.status, basis: g.basis })),
          localize("jurisdictions.index.the_active_profiles_list_different", "the active profiles list different closure days for {year}{whose}, so the year is withheld there: a business-day count reaching into it is undetermined", { year: String(year), whose: String(whose) }));
        continue;
      }
      /** @type {ViewHoliday} */
      const kept = { year, list: named, citation: g0.citation, offices: offices ? clone(offices) : undefined, days: clone(g0.value),
        status: g0.status, basis: g0.basis, profile: g0.profile, bases: given.map((g) => ({ profile: g.profile, basis: g.basis })) };
      if (!named) delete kept.list;
      if (!named && !g0.citation) delete kept.citation;
      if (!offices) delete kept.offices;
      holidays.push(kept);
    }
  }

  /* T33's sections (R55). One value: the weekend and the instrument key; one value per key: a computation, a
     fiscal year, a law rank, a proceeding flow and a lawful demand. Unioned: proceeding kinds, the schemes and the
     recurrences. Each one-value fact is kept whole as its first giver wrote it, tagged with every giver's basis. */
  if (has("weekend")) {
    const given = nonEmpty(profiles.flatMap((p) => { const w = p.weekend; return w ? [{ profile: p.id, value: w, basis: w.basis }] : []; }));
    if (given && agree(given)) view.weekend = keep(given);
    else if (given) conflict("weekend", given, localize("jurisdictions.index.weekend_conflict", "the active profiles name different weekends, so none is given: a business-day count or a roll is undetermined"));
  }
  if (has("instrument_key")) {
    const given = nonEmpty(profiles.flatMap((p) => { const k = p.instrument_key; return k ? [{ profile: p.id, value: k, basis: k.basis }] : []; }));
    if (given && agree(given)) view.instrument_key = keep(given);
    else if (given) conflict("instrument_key", given, localize("jurisdictions.index.instrument_key_conflict", "the active profiles give different instrument-key segments, so no key is composed"));
  }
  /* R55: the sections whose entries are one value per key, with the key and how a conflict names what differs (R79,
     R80: legal facts and procedure guides, T45). */
  /** @template {Computation | FiscalYear | LawRank | ProceedingFlow | LawfulDemand | LegalFact | ProcedureGuide} T
   *  @param {string} sec
   *  @param {(p: Profile) => T[] | undefined} read
   *  @param {(e: T) => string[]} partsOf
   *  @param {string} what
   *  @param {(xs: Tagged<T>[]) => void} put
   *  @returns {void} */
  const perKey = (sec, read, partsOf, what, put) => {
    if (!has(sec)) return;
    /** @type {Map<string, Group<Given<T>>>} */
    const byKey = emptyMap();
    /** @type {Map<string, string[]>} */
    const partsBy = emptyMap(); /* each key's parts, for the conflict's place and words */
    for (const p of profiles) for (const e of read(p) || []) {
      const parts = partsOf(e);
      const k = keyOf(...parts);
      pushTo(byKey, k, { profile: p.id, value: e, basis: e.basis });
      partsBy.set(k, parts);
    }
    /** @type {Tagged<T>[]} */
    const kept = [];
    put(kept);
    for (const [k, given] of byKey) {
      if (agree(given)) kept.push(keep(given));
      else {
        const parts = partsBy.get(k) ?? [];
        conflict(`${sec}[${parts.join("/")}]`, given, localize("jurisdictions.index.the_active_profiles_give_different_8", "the active profiles give different {what} for {replace}, so it is withheld: it is undetermined", { what: String(what), replace: String(parts.join(" at ")) }));
      }
    }
  };
  perKey("computation", (p) => p.computation, (e) => [e.key], "computations", (xs) => { view.computation = xs; });
  perKey("fiscal_year", (p) => p.fiscal_year, (e) => [e.body], "fiscal years", (xs) => { view.fiscal_year = xs; });
  perKey("law_ranks", (p) => p.law_ranks, (e) => [e.kind, e.level], "ranks", (xs) => { view.law_ranks = xs; });
  perKey("proceeding_flows", (p) => p.proceeding_flows, (e) => [e.kind], "proceeding flows", (xs) => { view.proceeding_flows = xs; });
  perKey("lawful_demands", (p) => p.lawful_demands, (e) => [e.kind], "lawful demands", (xs) => { view.lawful_demands = xs; });
  perKey("legal_facts", (p) => p.legal_facts, (e) => [e.key], "legal facts", (xs) => { view.legal_facts = xs; });
  perKey("procedure_guides", (p) => p.procedure_guides, (e) => [e.kind], "procedure guides", (xs) => { view.procedure_guides = xs; });
  if (has("proceeding_kinds")) view.proceeding_kinds = unionAll((p) => p.proceeding_kinds);
  if (has("identifier_schemes")) view.identifier_schemes = unionAll((p) => p.identifier_schemes);
  if (has("classification_schemes")) view.classification_schemes = unionAll((p) => p.classification_schemes);
  if (has("recurrences")) view.recurrences = unionAll((p) => p.recurrences);

  /* local names (R72): unioned under their name and kind; under one name and kind, an explanation or a translation in
     one language is one value per key, so two different official translations of one name in one language are a
     conflict and neither is kept. A translation's text is its value; the sources of one text are joined, as a
     deadline's citations are (R29). */
  if (has("local_names")) {
    /** @type {Map<string, Group<{ profile: string, n: LocalName }>>} */
    const byName = emptyMap();
    for (const p of profiles) for (const n of p.local_names || []) pushTo(byName, keyOf(n.name, n.kind), { profile: p.id, n });
    /** @type {ViewLocalName[]} */
    const names = [];
    view.local_names = names;
    for (const given of byName.values()) {
      const g0 = head(given);
      const { name, kind } = g0.n;
      /** @type {LocalNameFacts} */
      const e = { name, kind };
      /** One language's explanation or translation per key, kept where every giver agrees.
       *  @template {Explanation} X
       *  @param {"explanations" | "translations"} f
       *  @param {(n: LocalName) => X[] | undefined} read
       *  @param {(kept: Tagged<X>, xs: X[]) => void} finish
       *  @returns {Tagged<X>[] | null} */
      const perLocale = (f, read, finish) => {
        if (!given.some((g) => own(g.n, f))) return null;
        /** @type {Map<string | undefined, Group<{ profile: string, value: string, x: X, basis: string }>>} */
        const byLocale = emptyMap();
        for (const g of given) for (const x of read(g.n) || []) pushTo(byLocale, localeKey(x.locale), { profile: g.profile, value: x.text, x, basis: x.basis });
        /** @type {Tagged<X>[]} */
        const kept = [];
        for (const [l, vals] of byLocale) {
          if (!agree(vals)) {
            conflict(`local_names[${name}/${kind}].${f}[${l}]`, vals.map(({ x, ...v }) => v), f === "translations"
              ? localize("jurisdictions.index.the_active_profiles_give_different_9", "the active profiles give different official translations of {name} in {l}, so none is given: the name is shown as it is", { name: String(name), l: String(l) })
              : localize("jurisdictions.index.the_active_profiles_explain_name", "the active profiles explain {name} differently in {l}, so no explanation is given there", { name: String(name), l: String(l) }));
            continue;
          }
          const one = keep(mapGroup(vals, (v) => ({ ...v, value: v.x })));
          finish(one, vals.map((v) => v.x));
          kept.push(one);
        }
        return kept;
      };
      const explanations = perLocale("explanations", (n) => n.explanations, () => {});
      if (explanations) e.explanations = explanations;
      const translations = perLocale("translations", (n) => n.translations, (one, xs) => { one.source = [...new Set(xs.map((x) => x.source))].join("; "); });
      if (translations) e.translations = translations;
      names.push({ ...e, basis: g0.n.basis, profile: g0.profile, bases: given.map((g) => ({ profile: g.profile, basis: g.n.basis })) });
    }
  }

  return { view, conflicts };
}

/** A deadline as R26 reads it: `days: n` with no units is `units: "days", amount: n`.
 *  @param {Deadline} d
 *  @returns {Deadline} */
function normalDeadline(d) {
  const days = d.days;
  if (!own(d, "days") || own(d, "units") || days === undefined) return d;
  /** @type {Deadline} */
  const r = { ...d, units: "days", amount: days };
  delete r.days;
  return r;
}
