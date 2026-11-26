/* The held profiles (R8, R9, R19) and combine (R12–R16, R29, R34, R41–R44, R55, R66, R72, R74–R87, R90), with
 * governingZone (R98). Moved unchanged from `index.mjs`, the module's interface file, which re-exports them. */
import FIRST from "./profiles/oakland-alameda.mjs";
import TEST from "./profiles/test-port-ellery.mjs";
import { localize } from "../bio-plane/src/setup-words/index.mjs";
import { SECTIONS, SPACES, VOCABULARY, DATA_VOCABULARY, MEMBER_CAPACITIES, LAW_LEVELS, COUNTERPARTY_LEVELS, SOURCE_KINDS, STANDARD_SOURCE_KINDS, LEVELLED_KINDS, SECTORS, POLICY_HEADER_FIELDS, VENUE_HOW, COUNTS, STARTS, OWED_BY, LEGAL_FACT_TRIGGERS, VENUE_FACTS, PHRASING_KINDS, KIND_SHAPES, UNITS, DIRECTIONS, COMPUTATION_RULES, RECEIPT_RULES, CODE_COPIES, SECTION_MARKERS, AMENDING_RELATIONS, MEETING_MARKERS, ROSTER_KINDS, ROSTER_ROLES, BUDGET_COLUMNS, FISCAL_NAMED_BY, FISCAL_PLACEHOLDERS, FORUM_KINDS, CLASSIFICATION_KINDS, DEMAND_COVERS, RRULE_PARTS, RRULE_FREQS, LOCAL_NAME_KINDS, TIERS, CONTACT_HOW, POINTER_KINDS, POINTER_HOW, POINTER_NAME_MAX, RECORDS_HELP_CITATIONS, EVIDENCE_STANDARD_MAX, VENUE_FACT_MAX, TEMPLATE_NAME_MAX, PHRASE_MIN, TEMPLATE_FIELDS, TEMPLATE_USES, REVIEW_KINDS, REVIEW_OUTCOMES, REVIEW_REQUIRED, WEEKDAYS, FACT_STATUSES, ID_RE, KIND_RE, HEX64, DATE_RE, TEMPLATE_ID_RE, HHMM_RE, MMDD_RE, INSTANT_RE, LOCAL_DT_RE, TZ_RE, BASIS_REF, MEASUREMENT_REF, RULING_REF, K_REF, DATED_REF, basisParts, isObj, isStr, isPosInt, own, isYear, isDate, isTimeZone, instant, isLocalDateTime, isMonthDay, minutes, isLocale, localeKey, basisValid, compile, groupCount, groupNames, applyForm, memberTypeKey, officeKey, listKey, officesKey, POINTER_DOES_MAX, PHRASE_MAX } from "./shared.mjs";
import { validate } from "./validate.mjs";


/* ------------------------------------------------------------------------------------------------ */
/* The held profiles (R8, R9, R19).                                                                  */

const deepFreeze = (o) => { if (o && typeof o === "object") { Object.values(o).forEach(deepFreeze); Object.freeze(o); } return o; };
const clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
const HELD = new Map([FIRST, TEST].map((p) => [p.id, deepFreeze(clone(p))]));

/** Every profile held, sorted by id: `[{id, name, covers, test}]`. Never throws. */
export function list() {
  return [...HELD.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((p) => ({ id: p.id, name: p.name, covers: p.covers.slice(), test: p.test === true }));
}

/** The held profile with that id, as the caller's own copy, or null. Never throws. */
export function get(id) {
  if (typeof id !== "string" || !HELD.has(id)) return null;
  return copy(HELD.get(id));
}

/* ------------------------------------------------------------------------------------------------ */
/* combine (R12–R16, R29, R34, R41–R44, R55, R66, R72, R74–R87, R90).                                   */

/* A stable key for "equal in everything but its basis and profile". Object keys are sorted so the
   order a profile writes its fields in never makes two equal entries differ. */
function canon(v) {
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  if (isObj(v)) return `{${Object.keys(v).sort().filter((k) => k !== "basis" && k !== "profile" && k !== "bases")
    .map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}`;
  return JSON.stringify(v);
}
/* The whole value, basis included, with object keys sorted. */
function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (isObj(v)) return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
  return JSON.stringify(v);
}
const tag = (e, profile) => ({ ...clone(e), profile, bases: [{ profile, basis: e.basis }] });
/** Union in order; an entry equal to an earlier one but for basis and profile is kept once (R14). */
function union(into, entries, profile) {
  for (const e of entries || []) {
    const k = canon(e);
    const at = into.find((x) => x.__k === k);
    if (at) { if (!at.bases.some((b) => b.profile === profile && b.basis === e.basis)) at.bases.push({ profile, basis: e.basis }); }
    else into.push(Object.assign(tag(e, profile), { __k: k }));
  }
}
const strip = (arr) => arr.map((e) => { const { __k, ...rest } = e; return rest; });
/* A one-value fact that carries its own basis (a venue, evidence, a template, hours, the time zone), kept as
   the first giver wrote it, tagged with every giver's basis (R13, R14). `given` is `[{profile, value, basis}]`. */
const keep = (given) => ({ ...clone(given[0].value), profile: given[0].profile,
  bases: given.map((g) => ({ profile: g.profile, basis: g.basis })) });
/** The one value a keyed fact holds, or a conflict (R15). `given` is `[{profile, value, basis}]`. */
function agree(given) {
  const ks = [...new Set(given.map((g) => canon(g.value)))];
  return ks.length <= 1;
}

/* A deep copy of JSON data, what `clone` makes but without the text round trip. */
function copy(o) {
  if (Array.isArray(o)) { const r = new Array(o.length); for (let i = 0; i < o.length; i++) r[i] = o[i] === undefined ? null : copy(o[i]); return r; }
  if (o && typeof o === "object") { const r = {}; for (const k of Object.keys(o)) if (o[k] !== undefined) r[k] = copy(o[k]); return r; }
  return o;
}
/* The answers to lists of held ids, by the ids joined; at most COMBINED_MAX lists are held. */
const COMBINED = new Map();
const COMBINED_MAX = 64;

/**
 * Combine the active profiles, in order. `list` holds ids of held profiles or profile objects.
 * `{ok: true, view, conflicts}` or `{ok: false, errors}`. Never throws.
 */
export function combine(listIn) {
  /* A list of held ids is a pure function of frozen data (K5288): its answer is merged once and each caller gets
     its own copy of it (R18). Profile objects and ids not held are merged every time. */
  try {
    const key = Array.isArray(listIn) && listIn.every((x) => typeof x === "string" && HELD.has(x)) ? listIn.join("\u0001") : null;
    if (key !== null && COMBINED.has(key)) return copy(COMBINED.get(key));
    const r = combineInner(listIn);
    if (key !== null && r.ok) { if (COMBINED.size >= COMBINED_MAX) COMBINED.clear(); COMBINED.set(key, copy(r)); }
    return r;
  }
  catch (e) { return { ok: false, errors: [{ at: null, code: "INVALID_PROFILE", detail: `unreadable: ${String(e && e.message || e)}` }] }; }
}

/**
 * The team's governing time zone (R98, K5292): `teamZone` when it is an R41 value; else the `time_zone` of the view
 * `combine(profileIds)` gives; else `null`. The one site every module that needs the zone asks. Never throws.
 */
export function governingZone(profileIds, teamZone) {
  try {
    if (isTimeZone(teamZone)) return teamZone;
    if (!Array.isArray(profileIds) || profileIds.length === 0) return null;
    const r = combine(profileIds);
    const v = r && r.ok && r.view && r.view.time_zone ? r.view.time_zone.value : null;
    return isTimeZone(v) ? v : null;
  } catch { return null; }
}

function combineInner(listIn) {
  if (!Array.isArray(listIn)) return { ok: false, errors: [{ at: null, code: "NOT_A_LIST", detail: "combine takes a list of profile ids or profiles" }] };
  const errors = [];
  const profiles = [];
  const seen = new Map();
  listIn.forEach((item, i) => {
    let p;
    if (typeof item === "string") {
      p = get(item);
      if (!p) { errors.push({ at: i, code: "UNKNOWN_PROFILE", detail: localize("jurisdictions.index.no_profile_item_is_held", "no profile '{item}' is held", { item: String(item) }) }); return; }
    } else {
      const v = validate(item);
      if (!v.ok) { errors.push({ at: i, code: "INVALID_PROFILE", detail: "the profile fails validate", errors: v.errors }); return; }
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

function merge(profiles) {
  const conflicts = [];
  const conflict = (at, values, says) => conflicts.push({ at, values, says });
  const view = {
    id: profiles.map((p) => p.id).join("+"),
    name: profiles.map((p) => p.name).join("; "),
    covers: [...new Set(profiles.flatMap((p) => p.covers))],
    test: profiles.some((p) => p.test === true),
    profiles: profiles.map((p) => p.id),
  };
  const has = (sec) => profiles.some((p) => own(p, sec));

  /* spaces: labels joined, forms keyed by name (one definition per name), kinds unioned with one
     floor per kind. */
  if (has("spaces")) {
    view.spaces = {};
    for (const space of SPACES) {
      const givers = profiles.filter((p) => p.spaces && p.spaces[space]);
      if (!givers.length) continue;
      const s = { label: [...new Set(givers.map((p) => p.spaces[space].label))].join("; "), forms: [] };
      const byForm = new Map();
      for (const p of givers) for (const f of p.spaces[space].forms || []) {
        if (!byForm.has(f.form)) byForm.set(f.form, []);
        byForm.get(f.form).push({ profile: p.id, value: f });
      }
      for (const [form, given] of byForm) {
        const vals = given.map((g) => ({ profile: g.profile, value: (({ basis, ...rest }) => rest)(g.value), basis: g.value.basis }));
        if (!agree(vals)) {
          conflict(`spaces.${space}.forms[${form}]`, vals,
            localize("jurisdictions.index.the_active_profiles_define_the", "the active profiles define the {space} form '{form}' differently, so it is withheld: a value in it is recognised by no profile until they agree", { space: String(space), form: String(form) }));
          continue;
        }
        const merged = [];
        for (const g of given) union(merged, [g.value], g.profile);
        s.forms.push(...strip(merged));
      }
      if (space === "enactment" && givers.some((p) => own(p.spaces[space], "kinds"))) {
        const kinds = [];
        for (const p of givers) union(kinds, (p.spaces[space].kinds || []).map((k) => (({ floor, ...rest }) => rest)(k)), p.id);
        const floors = new Map();
        for (const p of givers) for (const k of p.spaces[space].kinds || [])
          if (k.floor) { if (!floors.has(k.kind)) floors.set(k.kind, []); floors.get(k.kind).push({ profile: p.id, value: (({ basis, ...rest }) => rest)(k.floor), basis: k.floor.basis }); }
        for (const [kind, given] of floors) {
          if (!agree(given)) {
            conflict(`spaces.enactment.kinds[${kind}].floor`, given,
              localize("jurisdictions.index.the_active_profiles_give_different", "the active profiles give different coverage floors for {kind}, so no floor is given: whether a number is inside the record's reach is undetermined", { kind: String(kind) }));
            continue;
          }
          const floor = { ...given[0].value, basis: given[0].basis, profile: given[0].profile, bases: given.map((g) => ({ profile: g.profile, basis: g.basis })) };
          for (const k of kinds) if (k.kind === kind) k.floor = clone(floor);
        }
        s.kinds = strip(kinds);
      }
      view.spaces[space] = s;
    }
  }

  /* systems and mixed hosts: a host and path name one origin, or none (R15). */
  if (has("systems") || has("mixed_hosts")) {
    const systems = [];
    for (const p of profiles) union(systems, p.systems || [], p.id);
    const mixed = [];
    for (const p of profiles) union(mixed, p.mixed_hosts || [], p.id);
    const pathKey = (s) => (s.path ? canon(s.path) : "");
    const byHostPath = new Map();
    for (const s of systems) for (const h of s.hosts) {
      const k = `${h}\u0000${pathKey(s)}`;
      if (!byHostPath.has(k)) byHostPath.set(k, []);
      byHostPath.get(k).push(s);
    }
    const withheld = new Set(); /* `${host}\0${pathKey}` */
    for (const [k, ss] of byHostPath) {
      const origins = [...new Set(ss.map((s) => s.origin))];
      if (origins.length < 2) continue;
      const [host] = k.split("\u0000");
      withheld.add(k);
      conflict(`systems[host=${host}${ss[0].path ? ` path=${ss[0].path.re}` : ""}]`,
        ss.flatMap((s) => s.bases.map((b) => ({ profile: b.profile, value: s.origin, basis: b.basis }))),
        localize("jurisdictions.index.the_active_profiles_say_host", "the active profiles say {host} publishes different systems' material ({origins}), so an address there names no system", { host: String(host), origins: String(origins.join(", ")) }));
    }
    const mixedWithheld = new Set();
    for (const m of mixed) {
      const k = `${m.host}\u0000`;
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
      .map((s) => ({ ...s, hosts: s.hosts.filter((h) => !withheld.has(`${h}\u0000${pathKey(s)}`)) }))
      .filter((s) => s.hosts.length);
    if (has("mixed_hosts")) view.mixed_hosts = strip(mixed).filter((m) => !mixedWithheld.has(m.host));
  }

  if (has("crosswalks")) { const x = []; for (const p of profiles) union(x, p.crosswalks, p.id); view.crosswalks = strip(x); }

  if (has("vocabulary")) {
    view.vocabulary = {};
    for (const key of VOCABULARY) {
      if (!profiles.some((p) => p.vocabulary && own(p.vocabulary, key))) continue;
      const v = [];
      for (const p of profiles) union(v, p.vocabulary && p.vocabulary[key], p.id);
      /* R60: a MemberType's capacity, for one body or for all (K1729), is one value per key; profiles that disagree have
         it withheld */
      if (key === "member_types") for (const k of [...new Set(v.map(memberTypeKey))]) {
        const given = v.filter((e) => memberTypeKey(e) === k);
        if (given.length < 2) continue;
        const { member_type: t, organisation: o } = given[0];
        conflict(`vocabulary.member_types[${t}${o ? `/${o}` : ""}]`, given.flatMap((e) => e.bases.map((b) => ({ profile: b.profile, value: e.capacity, basis: b.basis }))),
          localize("jurisdictions.index.the_active_profiles_map_the", "the active profiles map the MemberType '{t}'{v1} to different capacities, so it maps to none there: a seat's capacity is undetermined", { t: String(t), v1: String(o ? ` on ${o}` : "") }));
        for (const e of given) v.splice(v.indexOf(e), 1);
      }
      view.vocabulary[key] = strip(v);
    }
  }

  if (has("practice")) {
    view.practice = {};
    /* the value and its count (calendar when absent, R7) are one fact */
    const given = profiles.filter((p) => p.practice && p.practice.minutes_due_days)
      .map((p) => ({ profile: p.id, value: p.practice.minutes_due_days.value, count: p.practice.minutes_due_days.count || "calendar",
        closures: p.practice.minutes_due_days.closures, written: p.practice.minutes_due_days, basis: p.practice.minutes_due_days.basis }));
    if (given.length && agree(given.map((g) => ({ value: [g.value, g.count, g.closures ?? null] }))))
      view.practice.minutes_due_days = { value: given[0].value, ...(own(given[0].written, "count") ? { count: given[0].count } : {}),
        ...(own(given[0].written, "closures") ? { closures: given[0].closures } : {}),
        basis: given[0].basis, profile: given[0].profile, bases: given.map((g) => ({ profile: g.profile, basis: g.basis })) };
    else if (given.length)
      conflict("practice.minutes_due_days", given.map(({ written, ...g }) => g),
        localize("jurisdictions.index.minutes_due_conflict", "the active profiles give different periods after which absent minutes raise a question, so none is given"));
  }

  /* locale: one value (N77), as practice's. */
  if (has("locale")) {
    const given = profiles.filter((p) => p.locale).map((p) => ({ profile: p.id, value: p.locale.value, basis: p.locale.basis }));
    if (agree(given))
      view.locale = { value: given[0].value, basis: given[0].basis, profile: given[0].profile,
        bases: given.map((g) => ({ profile: g.profile, basis: g.basis })) };
    else conflict("locale", given, localize("jurisdictions.index.locale_conflict", "the active profiles name different locales, so none is given: a render asks for its fallback"));
  }

  /* time_zone: one value (R41), its status part of it (R44). */
  if (has("time_zone")) {
    const given = profiles.filter((p) => p.time_zone).map((p) => ({ profile: p.id, value: p.time_zone, basis: p.time_zone.basis }));
    if (agree(given)) view.time_zone = keep(given);
    else conflict("time_zone", given, localize("jurisdictions.index.time_zone_conflict", "the active profiles name different time zones, so none is given: a time of day there is undetermined"));
  }

  for (const sec of ["search_terms", "legal_organisations", "phrasings"])
    if (has(sec)) { const v = []; for (const p of profiles) union(v, p[sec], p.id); view[sec] = strip(v); }
  /* R90 (T48): pointers are unioned in the order given, as R14's lists are; a pointer's hours carry their own basis, so
     the hours kept are tagged with every giver's (R13), as an office's are. */
  /* R93 (T50): the records-help block is one value (R15): kept only when every profile that gives it gives the same. */
  if (has("records_help")) {
    const given = profiles.filter((p) => p.records_help).map((p) => ({ profile: p.id, value: p.records_help, basis: p.records_help.basis }));
    if (agree(given)) view.records_help = keep(given);
    else conflict("records_help", given, localize("jurisdictions.index.records_help_conflict", "the active profiles give different records-request help, so none is given: the page has no figure to show"));
  }
  /* R94 (T50): forums are unioned (R14), a forum given twice once. */
  if (has("forums")) { const v = []; for (const p of profiles) union(v, p.forums, p.id); view.forums = strip(v); }
  if (has("pointers")) {
    const v = [];
    const hoursOf = new Map();
    for (const p of profiles) for (const x of p.pointers || []) {
      union(v, [x], p.id);
      if (!own(x, "hours")) continue;
      const k = canon(x);
      if (!hoursOf.has(k)) hoursOf.set(k, []);
      hoursOf.get(k).push({ profile: p.id, value: x.hours, basis: x.hours.basis });
    }
    for (const e of v) if (hoursOf.has(e.__k)) e.hours = keep(hoursOf.get(e.__k));
    view.pointers = strip(v);
  }

  /* records laws are unioned (R14); a law's stages and who may request under it are one value each under its name
     (R76): profiles that disagree have it withheld, so which stages the law has is undetermined. */
  if (has("records_laws")) {
    const v = [];
    const byName = { stages: new Map(), requesters: new Map(), response: new Map() };
    for (const p of profiles) for (const l of p.records_laws || []) {
      const { stages, requesters, response, ...rest } = l;
      union(v, [rest], p.id);
      for (const f of Object.keys(byName)) if (own(l, f)) {
        if (!byName[f].has(l.name)) byName[f].set(l.name, []);
        byName[f].get(l.name).push({ profile: p.id, value: l[f], basis: f === "requesters" ? l[f].basis : l.basis });
      }
    }
    for (const [f, m] of Object.entries(byName)) for (const [name, given] of m) {
      if (!agree(given)) {
        conflict(`records_laws[${name}].${f}`, given, f === "stages"
          ? localize("jurisdictions.index.the_active_profiles_give_name", "the active profiles give {name} different stages, so which stages it has is undetermined", { name: String(name) })
          : f === "response" ? localize("jurisdictions.index.the_active_profiles_give_name_different_windows", "the active profiles give {name} different first-request windows, so which one it has is undetermined", { name: String(name) })
          : localize("jurisdictions.index.the_active_profiles_say_differently", "the active profiles say differently who may request under {name}, so it is undetermined", { name: String(name) }));
        continue;
      }
      for (const l of v) if (l.name === name) l[f] = f === "requesters" ? keep(given) : clone(given[0].value);
    }
    view.records_laws = strip(v);
  }

  /* standard sources are unioned (R14); a family's label, cite and normal under its key and series key, and an
     entry's level and sector under its source and issuer, are one value per key (R66): profiles that disagree have it
     withheld. A family withheld is dropped from the view whole, so a citation of it is recognised by no profile's
     choice (K1916 (2)); a level or sector withheld leaves its entry without that field. */
  if (has("standard_sources")) {
    const FAMILY = "a family of documents";
    const given = profiles.flatMap((p) => (p.standard_sources || []).map((e) => ({ profile: p.id, e: clone(e) })));
    const ONE = [
      [(e) => (isObj(e.series) ? `${e.key}\u0000${e.series.key}` : null), [
        ["series.label", (e) => e.series.label, (e) => { delete e.series.label; }],
        ["cite", (e) => e.cite, (e) => { delete e.cite; }],
        ["normal", (e) => e.normal ?? null, (e) => { delete e.normal; }]],
        FAMILY, localize("jurisdictions.index.family_dropped_from_view", "the family is dropped from the view: a citation of it is recognised by no profile until they agree")],
      [(e) => `${e.source}\u0000${e.issuer}`, [
        ["level", (e) => e.level ?? null, (e) => { delete e.level; }],
        /* an entry with a level reads sector government when it gives none (R64) */
        ["sector", (e) => e.sector ?? (own(e, "level") ? "government" : null), (e) => { delete e.sector; }]],
        "a standard source", localize("jurisdictions.index.who_issues_undetermined", "who issues it is undetermined")],
    ];
    for (const [keyOf, facts, what, says] of ONE) {
      const groups = new Map();
      for (const g of given) { const k = keyOf(g.e); if (k === null) continue; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(g); }
      for (const [k, gs] of groups) {
        if (new Set(gs.map((g) => g.profile)).size < 2) continue;
        for (const [f, read, drop] of facts) {
          const vals = gs.map((g) => ({ profile: g.profile, value: read(g.e), basis: g.e.basis }));
          if (agree(vals)) continue;
          conflict(`standard_sources[${k.replace("\u0000", "/")}].${f}`, vals,
            localize("jurisdictions.index.the_active_profiles_give_what", "the active profiles give {what} ({replace}) different {v1}, so it is withheld: {says}", { what: String(what), replace: String(k.replace("\u0000", ", ")), v1: String(f === "series.label" ? "labels" : `${f}s`), says: String(says) }));
          for (const g of gs) drop(g.e);
          if (what === FAMILY) for (const g of gs) g.dropped = true;
        }
      }
    }
    const v = [];
    for (const g of given) if (!g.dropped) union(v, [g.e], g.profile);
    view.standard_sources = strip(v);
  }

  /* counterparties are unioned; an office's oversight marker and its hours are one value per role and body (R29,
     R42). */
  if (has("counterparties")) {
    const v = [];
    const marks = new Map();
    const hoursOf = new Map();
    const zones = new Map(); /* R74 */
    const named = { ids: new Map(), within: new Map(), organisation: new Map() }; /* R59 */
    const push = (m, k, g) => { if (!m.has(k)) m.set(k, []); m.get(k).push(g); };
    for (const p of profiles) for (const c of p.counterparties || []) {
      const { oversight, hours, time_zone, ids, within, organisation, ...rest } = c;
      union(v, [rest], p.id);
      const k = `${c.role}\u0000${c.body}`;
      if (own(c, "oversight")) push(marks, k, { profile: p.id, value: oversight, basis: c.basis });
      if (own(c, "hours")) push(hoursOf, k, { profile: p.id, value: hours, basis: hours.basis });
      if (own(c, "time_zone")) push(zones, k, { profile: p.id, value: time_zone, basis: time_zone.basis });
      for (const f of Object.keys(named)) if (own(c, f)) push(named[f], k, { profile: p.id, value: c[f], basis: c.basis });
    }
    const each = (k, fn) => { const [role, body] = k.split("\u0000"); for (const c of v) if (c.role === role && c.body === body) fn(c); };
    for (const [k, given] of marks) {
      if (agree(given)) { each(k, (c) => { c.oversight = given[0].value; }); continue; }
      const [role, body] = k.split("\u0000");
      conflict(`counterparties[${role}/${body}].oversight`, given,
        localize("jurisdictions.index.the_active_profiles_disagree_on", "the active profiles disagree on whether {role} ({body}) is an oversight or audit body, so it is undetermined", { role: String(role), body: String(body) }));
    }
    for (const [k, given] of hoursOf) {
      if (agree(given)) { each(k, (c) => { c.hours = keep(given); }); continue; }
      const [role, body] = k.split("\u0000");
      conflict(`counterparties[${role}/${body}].hours`, given,
        localize("jurisdictions.index.the_active_profiles_give_different_2", "the active profiles give different hours for {role} ({body}), so its hours are undetermined", { role: String(role), body: String(body) }));
    }
    for (const [k, given] of zones) {
      if (agree(given)) { each(k, (c) => { c.time_zone = keep(given); }); continue; }
      const [role, body] = k.split("\u0000");
      conflict(`counterparties[${role}/${body}].time_zone`, given,
        localize("jurisdictions.index.the_active_profiles_give_different_3", "the active profiles give different time zones for {role} ({body}), so its local day is undetermined", { role: String(role), body: String(body) }));
    }
    const NAMED = { ids: localize("jurisdictions.index.named_identifiers", "identifiers"), within: localize("jurisdictions.index.named_within", "organisations it is part of"), organisation: localize("jurisdictions.index.named_body_variants", "body-variant keys") };
    for (const [f, m] of Object.entries(named)) for (const [k, given] of m) {
      if (agree(given)) { each(k, (c) => { c[f] = clone(given[0].value); }); continue; }
      const [role, body] = k.split("\u0000");
      conflict(`counterparties[${role}/${body}].${f}`, given,
        localize("jurisdictions.index.the_active_profiles_give_different_4", "the active profiles give different {v1} for {role} ({body}), so none is given: it is undetermined", { v1: String(NAMED[f]), role: String(role), body: String(body) }));
    }
    view.counterparties = strip(v);
  }

  /* action kinds, keyed by kind: tier, venue, template, advisory and evidence are one value each (R29). */
  if (has("action_kinds")) {
    const byKind = new Map();
    for (const p of profiles) for (const k of p.action_kinds || []) {
      if (!byKind.has(k.kind)) byKind.set(k.kind, []);
      byKind.get(k.kind).push({ profile: p.id, k });
    }
    view.action_kinds = [];
    for (const [kind, given] of byKind) {
      const e = { kind, label: [...new Set(given.map((g) => g.k.label))].join("; ") };
      const laws = [...new Set(given.flatMap((g) => g.k.laws || []))];
      if (given.some((g) => own(g.k, "laws"))) e.laws = laws;
      /* venue, template and evidence carry their own basis: the fact kept names every giver's (R13, R14). A
         venue's hours are one value of their own (R29, R42); a template is one value, its whole attribution
         included (R40). */
      const WHAT = { tier: "risk tiers", venue: "venues", template: "templates", advisory: "advisory notes", evidence: "evidence standards",
        shape: "shapes" };
      for (const f of ["tier", "venue", "template", "advisory", "evidence", "shape"]) {
        const carriesBasis = f === "venue" || f === "evidence" || f === "template";
        const vals = given.filter((g) => own(g.k, f)).map((g) => {
          let value = clone(g.k[f]);
          if (f === "venue" && isObj(value)) { const { hours, time_zone, cutoff, receipt, outages, facts, ...rest } = value; value = rest; }
          return { profile: g.profile, value, basis: carriesBasis ? g.k[f].basis : g.k.basis };
        });
        if (!vals.length) continue;
        if (agree(vals)) e[f] = !carriesBasis ? vals[0].value : keep(vals);
        else conflict(`action_kinds[${kind}].${f}`, vals, localize("jurisdictions.index.the_active_profiles_give_different_5", "the active profiles give different {v1} for {kind}, so none is given{v2}", { v1: String(WHAT[f]), kind: String(kind), v2: String(f === "evidence" ? ": the venue's standard is undetermined" : "") }));
      }
      if (e.venue) {
        /* hours (R42), and the channel's cutoff and receipt rule (R48, R55), are one value each; outages are unioned. */
        const SAYS = { hours: "its hours are undetermined", cutoff: "its cutoff is undetermined",
          receipt: localize("jurisdictions.index.receipt_on_closed_day", "receipt on a closed day stays the actual day only where no profile states otherwise; here it is undetermined"),
          time_zone: localize("jurisdictions.index.local_day_undetermined", "its local day is undetermined") };
        for (const f of ["hours", "cutoff", "receipt", "time_zone"]) {
          const vs = given.filter((g) => isObj(g.k.venue) && own(g.k.venue, f))
            .map((g) => ({ profile: g.profile, value: g.k.venue[f], basis: g.k.venue[f].basis }));
          if (vs.length && agree(vs)) e.venue[f] = keep(vs);
          else if (vs.length) conflict(`action_kinds[${kind}].venue.${f}`, vs,
            localize("jurisdictions.index.the_active_profiles_give_different_6", "the active profiles give different {v1} for {kind}'s venue, so {v2}", { v1: String({ hours: "hours", cutoff: "cutoffs", receipt: "receipt rules", time_zone: "time zones" }[f]), kind: String(kind), v2: String(SAYS[f]) }));
        }
        if (given.some((g) => isObj(g.k.venue) && own(g.k.venue, "outages"))) {
          const o = [];
          for (const g of given) if (isObj(g.k.venue)) union(o, g.k.venue.outages, g.profile);
          e.venue.outages = strip(o);
        }
        /* R82: a venue fact is one value per kind and fact */
        if (given.some((g) => isObj(g.k.venue) && own(g.k.venue, "facts"))) {
          const byFact = new Map();
          for (const g of given) if (isObj(g.k.venue)) for (const x of g.k.venue.facts || []) {
            if (!byFact.has(x.fact)) byFact.set(x.fact, []);
            byFact.get(x.fact).push({ profile: g.profile, value: x, basis: x.basis });
          }
          e.venue.facts = [];
          for (const [fact, vs] of byFact) {
            if (agree(vs)) e.venue.facts.push(keep(vs));
            else conflict(`action_kinds[${kind}].venue.facts[${fact}]`, vs, localize("jurisdictions.index.the_active_profiles_state_kind", "the active profiles state {kind}'s venue's {fact} differently, so it is undetermined", { kind: String(kind), fact: String(fact) }));
          }
        }
      }
      /* R81: a kind's templates, one value per purpose; its single template reads as the set of one, purpose initial */
      const setOf = (k) => (own(k, "templates") ? k.templates : own(k, "template") ? [{ ...k.template, purpose: "initial" }] : null);
      if (!given.some((g) => own(g.k, "templates"))) { if (e.template) e.templates = [{ ...clone(e.template), purpose: "initial" }]; }
      /* only single templates: their one value (R29) is the set's, its conflict already reported once */
      else if (given.some((g) => setOf(g.k))) {
        const byPurpose = new Map();
        for (const g of given) for (const t of setOf(g.k) || []) {
          if (!byPurpose.has(t.purpose)) byPurpose.set(t.purpose, []);
          byPurpose.get(t.purpose).push({ profile: g.profile, value: t, basis: t.basis });
        }
        e.templates = [];
        for (const [purpose, vs] of byPurpose) {
          if (agree(vs)) e.templates.push(keep(vs));
          else conflict(`action_kinds[${kind}].templates[${purpose}]`, vs, localize("jurisdictions.index.the_active_profiles_give_different_7", "the active profiles give different {purpose} templates for {kind}, so none is given", { purpose: String(purpose), kind: String(kind) }));
        }
      }
      e.basis = given[0].k.basis;
      e.profile = given[0].profile;
      e.bases = given.map((g) => ({ profile: g.profile, basis: g.k.basis }));
      view.action_kinds.push(e);
    }
  }

  /* deadlines, keyed by rule and what they apply to: every field but the citation is one value each (R29, R55). An
     entry written `days: n` reads as `units: "days", amount: n` (R26); the view gives both forms for a day period. */
  if (has("deadlines")) {
    const byRule = new Map();
    for (const p of profiles) for (const d of p.deadlines || []) {
      const k = `${d.rule}\u0000${d.applies_to}`;
      if (!byRule.has(k)) byRule.set(k, []);
      byRule.get(k).push({ profile: p.id, d: normalDeadline(d) });
    }
    view.deadlines = [];
    for (const given of byRule.values()) {
      const { rule, applies_to } = given[0].d;
      const e = { rule, applies_to };
      for (const f of DEADLINE_ONE_VALUE) {
        const vals = given.filter((g) => own(g.d, f)).map((g) => ({ profile: g.profile, value: clone(g.d[f]), basis: g.d.basis }));
        if (!vals.length) continue;
        if (!agree(vals)) {
          conflict(`deadlines[${rule}/${applies_to}].${f}`, vals, localize("jurisdictions.index.the_active_profiles_disagree_on_2", "the active profiles disagree on the {f} of {rule} for {applies_to}, so it is withheld: the deadline is undetermined", { f: String(f), rule: String(rule), applies_to: String(applies_to) }));
          continue;
        }
        e[f] = f === "observed" ? keep(vals.map((v) => ({ ...v, basis: v.value.basis }))) : vals[0].value;
      }
      if (e.units === "days" && own(e, "amount")) e.days = e.amount;
      e.citation = [...new Set(given.map((g) => g.d.citation))].join("; ");
      e.basis = given[0].d.basis;
      e.profile = given[0].profile;
      e.bases = given.map((g) => ({ profile: g.profile, basis: g.d.basis }));
      view.deadlines.push(e);
    }
  }

  /* holidays: a year's days, keyed by the year and its offices (R34, R43), are one value, their status part of
     it (R44); the order a profile lists the days or the offices in is no disagreement. */
  if (has("holidays")) {
    const byKey = new Map();
    const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    for (const p of profiles) for (const h of p.holidays || []) {
      const k = `${h.year}\u0000${listKey(h)}\u0000${officesKey(h.offices)}`;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push({ profile: p.id, h, value: h.days.slice().sort(byDate), status: h.status, citation: h.citation, basis: h.basis });
    }
    view.holidays = [];
    for (const given of byKey.values()) {
      const { year, offices, list: named } = given[0].h;
      if (!agree(given.map((g) => ({ value: { days: g.value, status: g.status, citation: g.citation } })))) {
        const whose = offices ? ` for ${offices.map((o) => (typeof o === "string" ? o : `${o.venue}'s venue`)).join(", ")}` : "";
        conflict(`holidays[${year}${named ? ` list=${named}` : ""}${offices ? ` offices=${officesKey(offices).replace(/\u0001/g, ",")}` : ""}]`,
          given.map((g) => ({ profile: g.profile, value: g.value, status: g.status, basis: g.basis })),
          localize("jurisdictions.index.the_active_profiles_list_different", "the active profiles list different closure days for {year}{whose}, so the year is withheld there: a business-day count reaching into it is undetermined", { year: String(year), whose: String(whose) }));
        continue;
      }
      view.holidays.push({ year, ...(named ? { list: named, citation: given[0].citation } : given[0].citation ? { citation: given[0].citation } : {}),
        ...(offices ? { offices: clone(offices) } : {}), days: clone(given[0].value), status: given[0].status,
        basis: given[0].basis, profile: given[0].profile, bases: given.map((g) => ({ profile: g.profile, basis: g.basis })) });
    }
  }

  /* T33's sections (R55). One value: the weekend and the instrument key; one value per key: a computation, a
     fiscal year, a law rank, a proceeding flow and a lawful demand. Unioned: proceeding kinds, the schemes and the
     recurrences. Each one-value fact is kept whole as its first giver wrote it, tagged with every giver's basis. */
  for (const sec of ["weekend", "instrument_key"]) {
    if (!has(sec)) continue;
    const given = profiles.filter((p) => p[sec]).map((p) => ({ profile: p.id, value: p[sec], basis: p[sec].basis }));
    if (agree(given)) view[sec] = keep(given);
    else conflict(sec, given, sec === "weekend"
      ? localize("jurisdictions.index.weekend_conflict", "the active profiles name different weekends, so none is given: a business-day count or a roll is undetermined")
      : localize("jurisdictions.index.instrument_key_conflict", "the active profiles give different instrument-key segments, so no key is composed"));
  }
  for (const [sec, keyOf, what] of ONE_PER_KEY) {
    if (!has(sec)) continue;
    const byKey = new Map();
    for (const p of profiles) for (const e of p[sec] || []) {
      const k = keyOf(e);
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push({ profile: p.id, value: e, basis: e.basis });
    }
    view[sec] = [];
    for (const [k, given] of byKey) {
      if (agree(given)) view[sec].push(keep(given));
      else conflict(`${sec}[${k.replace(/\u0000/g, "/")}]`, given, localize("jurisdictions.index.the_active_profiles_give_different_8", "the active profiles give different {what} for {replace}, so it is withheld: it is undetermined", { what: String(what), replace: String(k.replace(/\u0000/g, " at ")) }));
    }
  }
  for (const sec of ["proceeding_kinds", "identifier_schemes", "classification_schemes", "recurrences"])
    if (has(sec)) { const v = []; for (const p of profiles) union(v, p[sec], p.id); view[sec] = strip(v); }

  /* local names (R72): unioned under their name and kind; under one name and kind, an explanation or a translation in
     one language is one value per key, so two different official translations of one name in one language are a
     conflict and neither is kept. A translation's text is its value; the sources of one text are joined, as a
     deadline's citations are (R29). */
  if (has("local_names")) {
    const byName = new Map();
    for (const p of profiles) for (const n of p.local_names || []) {
      const k = `${n.name}\u0000${n.kind}`;
      if (!byName.has(k)) byName.set(k, []);
      byName.get(k).push({ profile: p.id, n });
    }
    view.local_names = [];
    for (const given of byName.values()) {
      const { name, kind } = given[0].n;
      const e = { name, kind };
      for (const f of ["explanations", "translations"]) {
        if (!given.some((g) => own(g.n, f))) continue;
        const byLocale = new Map();
        for (const g of given) for (const x of g.n[f] || []) {
          const l = localeKey(x.locale);
          if (!byLocale.has(l)) byLocale.set(l, []);
          byLocale.get(l).push({ profile: g.profile, value: x.text, x, basis: x.basis });
        }
        e[f] = [];
        for (const [l, vals] of byLocale) {
          if (!agree(vals)) {
            conflict(`local_names[${name}/${kind}].${f}[${l}]`, vals.map(({ x, ...v }) => v), f === "translations"
              ? localize("jurisdictions.index.the_active_profiles_give_different_9", "the active profiles give different official translations of {name} in {l}, so none is given: the name is shown as it is", { name: String(name), l: String(l) })
              : localize("jurisdictions.index.the_active_profiles_explain_name", "the active profiles explain {name} differently in {l}, so no explanation is given there", { name: String(name), l: String(l) }));
            continue;
          }
          const kept = keep(vals.map((v) => ({ ...v, value: v.x })));
          if (f === "translations") kept.source = [...new Set(vals.map((v) => v.x.source))].join("; ");
          e[f].push(kept);
        }
      }
      e.basis = given[0].n.basis;
      e.profile = given[0].profile;
      e.bases = given.map((g) => ({ profile: g.profile, basis: g.n.basis }));
      view.local_names.push(e);
    }
  }

  return { view, conflicts };
}

/* R29, R55: a deadline's fields that hold one value under its rule and what it applies to. */
const DEADLINE_ONE_VALUE = ["units", "amount", "count", "direction", "starts", "starter", "roll", "closures", "computation",
  "extension", "tolling", "observed", "applies_on", "due_at", "owed_by", "consequence", "defends", "status", "label"];
/** A deadline as R26 reads it: `days: n` with no units is `units: "days", amount: n`. */
function normalDeadline(d) {
  if (!own(d, "days") || own(d, "units")) return d;
  const { days, ...rest } = d;
  return { ...rest, units: "days", amount: days };
}
/* R55: the sections whose entries are one value per key, with the key and how a conflict names what differs. */
const ONE_PER_KEY = [
  ["computation", (e) => e.key, "computations"],
  ["fiscal_year", (e) => e.body, "fiscal years"],
  ["law_ranks", (e) => `${e.kind}\u0000${e.level}`, "ranks"],
  ["proceeding_flows", (e) => e.kind, "proceeding flows"],
  ["lawful_demands", (e) => e.kind, "lawful demands"],
  /* R79, R80 (T45) */
  ["legal_facts", (e) => e.key, "legal facts"],
  ["procedure_guides", (e) => e.kind, "procedure guides"],
];
