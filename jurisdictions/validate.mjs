/* validate (R10, R11, R28, R35): judging a profile against its form. Moved unchanged from `index.mjs`, the module's
 * interface file, which re-exports `validate`. */
import { BASIS_GRADES } from "../bio-plane/src/record-grammar/index.mjs";
import { localize } from "../bio-plane/src/setup-words/index.mjs";
import { SECTIONS, SPACES, VOCABULARY, DATA_VOCABULARY, MEMBER_CAPACITIES, LAW_LEVELS, COUNTERPARTY_LEVELS, SOURCE_KINDS, STANDARD_SOURCE_KINDS, LEVELLED_KINDS, SECTORS, POLICY_HEADER_FIELDS, VENUE_HOW, COUNTS, STARTS, OWED_BY, LEGAL_FACT_TRIGGERS, VENUE_FACTS, PHRASING_KINDS, KIND_SHAPES, UNITS, DIRECTIONS, COMPUTATION_RULES, RECEIPT_RULES, CODE_COPIES, SECTION_MARKERS, AMENDING_RELATIONS, MEETING_MARKERS, ROSTER_KINDS, ROSTER_ROLES, BUDGET_COLUMNS, FISCAL_NAMED_BY, FISCAL_PLACEHOLDERS, FORUM_KINDS, CLASSIFICATION_KINDS, DEMAND_COVERS, RRULE_PARTS, RRULE_FREQS, LOCAL_NAME_KINDS, TIERS, CONTACT_HOW, POINTER_KINDS, POINTER_HOW, POINTER_NAME_MAX, RECORDS_HELP_CITATIONS, EVIDENCE_STANDARD_MAX, VENUE_FACT_MAX, TEMPLATE_NAME_MAX, PHRASE_MIN, TEMPLATE_FIELDS, TEMPLATE_USES, REVIEW_KINDS, REVIEW_OUTCOMES, REVIEW_REQUIRED, WEEKDAYS, FACT_STATUSES, ID_RE, KIND_RE, HEX64, DATE_RE, TEMPLATE_ID_RE, HHMM_RE, MMDD_RE, INSTANT_RE, LOCAL_DT_RE, TZ_RE, BASIS_REF, MEASUREMENT_REF, RULING_REF, K_REF, DATED_REF, basisParts, isObj, isList, listOr, isStr, oneOf, oneOfNumbers, isPosInt, own, isYear, isDate, isTimeZone, instant, isLocalDateTime, isMonthDay, minutes, isLocale, localeKey, basisValid, compile, groupCount, groupNames, applyForm, memberTypeKey, officeKey, listKey, officesKey, POINTER_DOES_MAX, PHRASE_MAX } from "./shared.mjs";

/* ------------------------------------------------------------------------------------------------ */
/* validate (R10, R11, R28, R35).                                                                   */

/** Whether `v` is a key matching ^[a-z][a-z0-9_]*$.
 *  @param {Value} v
 *  @returns {boolean} */
const isKindKey = (v) => typeof v === "string" && KIND_RE.test(v);
/** Whether `v` is a string.
 *  @param {Value} v
 *  @returns {boolean} */
const isText = (v) => typeof v === "string";
/** `v` written as a template literal writes it (`${v}`): a symbol throws, as it did in the template.
 *  @param {unknown} v
 *  @returns {string} */
const asTemplate = (v) => `${v}`;
/** An identifier scheme and the entity kinds it identifies, as a map entry.
 *  @param {Value} scheme
 *  @param {Entries} kinds
 *  @returns {[Value, Entries]} */
const schemeEntry = (scheme, kinds) => [scheme, kinds];

/** @import { Value, Fields, Entries } from "./shared.mjs" */

/** One fault `validate` finds: where in the profile (a path like `systems[0].origin`, "" for the whole), its code, and
 *  what is wrong, in words.
 *  @typedef {{ path: string, code: string, detail: string }} ProfileError */
/** What `validate` hands back: whether the profile is whole, and every fault found, in the order found.
 *  @typedef {{ ok: boolean, errors: ProfileError[] }} Validation */

/** Whether a thrown value is an object or a function, whose `message` field the NOT_A_PROFILE detail reads (as
 *  `e && e.message || e` did). A profile from a caller may throw any value from a getter, so the thrown value is not
 *  only the language's own errors.
 *  @param {unknown} v
 *  @returns {v is Fields} */
const hasFields = (v) => v !== null && (typeof v === "object" || typeof v === "function");

/** Judge a profile against R1–R7, R23–R26, R31–R33, R37–R44 and the later tranches' additions (R46–R90). `{ok, errors}`,
 *  every error found. Never throws.
 *  @param {unknown} profile
 *  @returns {Validation} */
export function validate(profile) {
  /** @type {ProfileError[]} */
  const errors = [];
  try {
    const p = isObj(profile) ? profile : null;
    if (!p) errors.push({ path: "", code: "NOT_A_PROFILE", detail: "a profile is a plain object" });
    else validateInto(p, errors);
  }
  catch (e) { const t = hasFields(e) ? e : null; errors.push({ path: "", code: "NOT_A_PROFILE", detail: `unreadable: ${String(t ? t.message || t : e)}` }); }
  return { ok: errors.length === 0, errors };
}

/** Judge a profile that is a plain object, pushing every fault into `errors` in the order found. A value no profile
 *  holds (a getter that throws) may throw; `validate` reads that as NOT_A_PROFILE.
 *  @param {Fields} p
 *  @param {ProfileError[]} errors
 *  @returns {void} */
function validateInto(p, errors) {
  /** One fault.
   *  @param {string} path
   *  @param {string} code
   *  @param {string} detail
   *  @returns {number} */
  const err = (path, code, detail) => errors.push({ path, code, detail });
  const test = p.test === true;

  for (const k of Object.keys(p)) if (!oneOf(SECTIONS, k)) err(k, "UNKNOWN_SECTION", localize("jurisdictions.index.k_is_not_a_section", "'{k}' is not a section of a profile", { k: String(k) }));
  if (typeof p.id !== "string" || !ID_RE.test(p.id)) err("id", "ID_INVALID", "id matches ^[a-z0-9][a-z0-9-]*$");
  if (!isStr(p.name)) err("name", "NAME_MISSING", "a profile has a name");
  if (!isList(p.covers) || !p.covers.length || !p.covers.every(isStr))
    err("covers", "COVERS_MISSING", "covers is a non-empty list of names");
  if (own(p, "test") && typeof p.test !== "boolean") err("test", "VALUE_INVALID", "test is true or false");

  /** Whether the basis is present and of R2's form.
   *  @param {string} path
   *  @param {Fields} o
   *  @returns {boolean} */
  const basis = (path, o) => {
    if (!own(o, "basis") || o.basis === undefined || o.basis === null || o.basis === "") {
      err(`${path}.basis`, "BASIS_MISSING", "every fact names its basis"); return false;
    }
    if (!basisValid(o.basis, test)) {
      err(`${path}.basis`, "BASIS_INVALID", o.basis === "TEST"
        ? "TEST is a basis only in a test profile" : localize("jurisdictions.index.string_names_no_measurement_or", "'{String}' names no measurement or ruling", { String: String(String(o.basis)) }));
      return false;
    }
    return true;
  };
  /* R44: a calendar fact's status and the basis it rests on agree: `researched` on a measurement, `ruled` on a
     ruling; `UNMEASURED` is no basis for one (a fact without a source is not written). In a test profile, `TEST`
     stands for either. */
  /** @param {string} path
   *  @param {Fields} o
   *  @returns {void} */
  const statusBasis = (path, o) => {
    const ok = basis(path, o);
    if (!oneOf(FACT_STATUSES, o.status)) {
      err(`${path}.status`, "BASIS_INVALID", localize("jurisdictions.index.status_is_fact_statuses_naming", "status is {FACT_STATUSES}, naming what the fact rests on", { FACT_STATUSES: String(FACT_STATUSES.join(" or ")) }));
      return;
    }
    if (!ok || (test && o.basis === "TEST")) return;
    if (o.basis === "UNMEASURED")
      err(`${path}.basis`, "BASIS_INVALID", "a calendar fact without a source is not written: UNMEASURED is no basis for it");
    /* `ok`: basisValid read the basis as a string */
    else if (typeof o.basis === "string" && !basisParts(o.basis).every((x) => (o.status === "researched" ? MEASUREMENT_REF : RULING_REF).test(x)))
      err(`${path}.basis`, "BASIS_INVALID", o.status === "researched"
        ? "a researched fact rests on a measurement (M-<n> or a dated entry)" : "a ruled fact rests on a ruling (D-<n>, DEC-<n> or K<n>)");
  };
  /** R42: an office's or venue's weekly hours.
   *  @param {string} path
   *  @param {Value} h
   *  @returns {void} */
  const hours = (path, h) => {
    if (!isObj(h)) { err(path, "HOURS_INVALID", "hours is {weekly: [{day, open, close}], status, basis}"); return; }
    fields(path, h, ["weekly", "status", "basis"]);
    if (!isList(h.weekly)) err(`${path}.weekly`, "HOURS_INVALID", "weekly is a list of {day, open, close}");
    else {
      /** @type {Map<string, { o: number, c: number, at: string }[]>} */
      const spans = new Map([]);
      h.weekly.forEach((s, i) => {
        const at = `${path}.weekly[${i}]`;
        if (!isObj(s)) { err(at, "HOURS_INVALID", "a span is {day, open, close}"); return; }
        fields(at, s, ["day", "open", "close"]);
        const day = typeof s.day === "string" && oneOf(WEEKDAYS, s.day) ? s.day : null;
        if (!day) err(`${at}.day`, "HOURS_INVALID", localize("jurisdictions.index.day_is_one_of_weekdays", "day is one of {WEEKDAYS}", { WEEKDAYS: String(WEEKDAYS.join(", ")) }));
        const [o, c] = [minutes(s.open), minutes(s.close)];
        if (o === null) err(`${at}.open`, "HOURS_INVALID", "open is HH:MM, 24-hour");
        if (c === null) err(`${at}.close`, "HOURS_INVALID", "close is HH:MM, 24-hour");
        if (o === null || c === null) return;
        if (o >= c) { err(at, "HOURS_INVALID", "open is before close"); return; }
        if (!day) return;
        const prior = spans.get(day) || [];
        const clash = prior.find((p) => o < p.c && p.o < c);
        if (clash) err(at, "HOURS_INVALID", `${day} ${String(s.open)}–${String(s.close)} overlaps ${clash.at}`);
        spans.set(day, [...prior, { o, c, at }]);
      });
    }
    statusBasis(path, h);
  };
  /** R48: a venue's channel facts. A malformed one is CHANNEL_INVALID; its status and basis are R44's.
   *  @param {string} path
   *  @param {Fields} v
   *  @returns {void} */
  const channel = (path, v) => {
    if (own(v, "cutoff")) {
      const c = v.cutoff, ca = `${path}.cutoff`;
      if (!isObj(c)) err(ca, "CHANNEL_INVALID", "cutoff is {time, citation, status, basis}");
      else {
        fields(ca, c, ["time", "citation", "status", "basis"]);
        if (minutes(c.time) === null) err(`${ca}.time`, "CHANNEL_INVALID", "time is HH:MM, 24-hour");
        if (!isStr(c.citation)) err(`${ca}.citation`, "CHANNEL_INVALID", "a cutoff cites its source");
        statusBasis(ca, c);
      }
    }
    if (own(v, "outages")) {
      if (!isList(v.outages)) err(`${path}.outages`, "CHANNEL_INVALID", "outages is a list of {from, to, status, basis}");
      else v.outages.forEach((o, j) => {
        const oa = `${path}.outages[${j}]`;
        if (!isObj(o)) { err(oa, "CHANNEL_INVALID", "an outage is {from, to, status, basis}"); return; }
        fields(oa, o, ["from", "to", "status", "basis"]);
        const [f, t] = [instant(o.from), instant(o.to)];
        if (f === null) err(`${oa}.from`, "CHANNEL_INVALID", "from is an instant with its offset (YYYY-MM-DDTHH:MM[:SS]Z or ±HH:MM)");
        if (t === null) err(`${oa}.to`, "CHANNEL_INVALID", "to is an instant with its offset");
        if (f !== null && t !== null && !(f < t)) err(oa, "CHANNEL_INVALID", "an outage ends after it starts");
        statusBasis(oa, o);
      });
    }
    if (own(v, "receipt")) {
      const r = v.receipt, ra = `${path}.receipt`;
      if (!isObj(r)) err(ra, "CHANNEL_INVALID", "receipt is {rule, citation, status, basis}");
      else {
        fields(ra, r, ["rule", "citation", "status", "basis"]);
        if (!oneOf(RECEIPT_RULES, r.rule)) err(`${ra}.rule`, "CHANNEL_INVALID", localize("jurisdictions.index.rule_is_one_of_receipt", "rule is one of {RECEIPT_RULES}", { RECEIPT_RULES: String(RECEIPT_RULES.join(", ")) }));
        if (!isStr(r.citation)) err(`${ra}.citation`, "CHANNEL_INVALID", "a receipt rule cites the local rule that states it");
        statusBasis(ra, r);
      }
    }
  };
  /** R3: a normal form's parts, each a literal or {group, unpad?, upper?, default?} naming a group the pattern has.
   *  Whether every part is one.
   *  @param {string} path
   *  @param {Value} normal
   *  @param {number} groups
   *  @returns {boolean} */
  const normalParts = (path, normal, groups) => {
    if (!isList(normal) || !normal.length) { err(path, "NORMAL_INVALID", "normal is a non-empty list of parts"); return false; }
    let faults = 0;
    normal.forEach((part, j) => {
      if (typeof part === "string") return;
      if (!isObj(part) || !Number.isInteger(part.group) || typeof part.group !== "number" || part.group < 1 || part.group > groups
          || Object.keys(part).some((k) => !oneOf(["group", "unpad", "upper", "default"], k))
          || (own(part, "unpad") && typeof part.unpad !== "boolean")
          || (own(part, "upper") && typeof part.upper !== "boolean")
          || (own(part, "default") && typeof part.default !== "string")) {
        faults += 1;
        err(`${path}[${j}]`, "NORMAL_INVALID", "a part is a literal string or {group, unpad?, upper?, default?} naming a group the pattern has");
      }
    });
    return faults === 0;
  };
  /** @param {string} path
   *  @param {Value} v
   *  @returns {void} */
  const pattern = (path, v) => { if (!compile(v)) err(path, "PATTERN_INVALID", "a pattern is {re, flags?}: a regular expression that compiles, flags from i and u"); };
  /** Every field of `o` is one of `allowed`.
   *  @param {string} path
   *  @param {Fields} o
   *  @param {readonly string[]} allowed
   *  @returns {void} */
  const fields = (path, o, allowed) => {
    for (const k of Object.keys(o)) if (!allowed.includes(k)) err(`${path}.${k}`, "UNKNOWN_SECTION", localize("jurisdictions.index.k_is_not_a_field", "'{k}' is not a field here", { k: String(k) }));
  };
  /** @param {string} path
   *  @param {Value} v
   *  @param {string} what
   *  @returns {void} */
  const str = (path, v, what) => { if (!isStr(v)) err(path, "VALUE_INVALID", localize("jurisdictions.index.what_is_a_non_empty", "{what} is a non-empty string", { what: String(what) })); };
  /** `v` when it is a list, else an empty one, with a fault.
   *  @param {string} path
   *  @param {Value} v
   *  @returns {Entries} */
  const list = (path, v) => { if (!isList(v)) err(path, "VALUE_INVALID", "a list"); return listOr(v); };
  /** Whether `e` is an object; a fault when not.
   *  @param {string} path
   *  @param {unknown} e
   *  @returns {e is Fields} */
  const entry = (path, e) => { if (!isObj(e)) { err(path, "VALUE_INVALID", "an entry is an object"); return false; } return true; };

  /* systems first: floors and file numbers name their origins. */
  /** @type {Set<Value>} */
  const origins = new Set();
  /** @type {Map<string, string>} */
  const noPathHosts = new Map([]);
  if (own(p, "systems")) list("systems", p.systems).forEach((s, i) => {
    const at = `systems[${i}]`;
    if (!entry(at, s)) return;
    fields(at, s, ["origin", "name", "hosts", "path", "links", "republishes", "provenance_stated", "basis"]);
    str(`${at}.origin`, s.origin, "origin");
    if (isStr(s.origin)) origins.add(s.origin);
    str(`${at}.name`, s.name, "name");
    if (!isList(s.hosts) || !s.hosts.length || !s.hosts.every((h) => isStr(h) && typeof h === "string" && h === h.toLowerCase()))
      err(`${at}.hosts`, "VALUE_INVALID", "hosts is a non-empty list of lower-case host names");
    if (own(s, "path")) pattern(`${at}.path`, s.path);
    else if (isList(s.hosts)) for (const h of s.hosts) if (typeof h === "string") noPathHosts.set(h, at);
    /* N96: the shapes of the system's item and file links, over an address's path and query. They are
       part of the system entry, whose basis names their measurement. */
    if (own(s, "links")) {
      if (!isObj(s.links) || !own(s.links, "item") || !own(s.links, "file"))
        err(`${at}.links`, "VALUE_INVALID", "links is {item, file}, two patterns");
      else {
        fields(`${at}.links`, s.links, ["item", "file"]);
        pattern(`${at}.links.item`, s.links.item); pattern(`${at}.links.file`, s.links.file);
      }
    }
    if (own(s, "republishes") && typeof s.republishes !== "boolean") err(`${at}.republishes`, "VALUE_INVALID", "true or false");
    if (own(s, "provenance_stated") && typeof s.provenance_stated !== "boolean") err(`${at}.provenance_stated`, "VALUE_INVALID", "true or false");
    basis(at, s);
  });
  if (own(p, "mixed_hosts")) list("mixed_hosts", p.mixed_hosts).forEach((m, i) => {
    const at = `mixed_hosts[${i}]`;
    if (!entry(at, m)) return;
    fields(at, m, ["host", "why", "basis"]);
    if (!isStr(m.host) || typeof m.host !== "string" || m.host !== m.host.toLowerCase()) err(`${at}.host`, "VALUE_INVALID", "a lower-case host name");
    str(`${at}.why`, m.why, "why");
    if (typeof m.host === "string" && noPathHosts.has(m.host))
      err(`${at}.host`, "HOST_CONFLICT", localize("jurisdictions.index.host_is_mixed_and_also", "{host} is mixed and also in {get}, which has no path", { host: String(m.host), get: String(noPathHosts.get(m.host)) }));
    basis(at, m);
  });

  /* spaces: each space's judged forms by name. A plain object, read by any value as a key (as `spaceForms[x.space]` was):
     a key the language converts to a string, so `String(k)` reads the same member. */
  /** @type {{ [space: string]: Map<Value, Fields> }} */
  const spaceForms = {};
  if (own(p, "spaces")) {
    if (!isObj(p.spaces)) err("spaces", "VALUE_INVALID", "spaces is an object keyed by space");
    else for (const [name, s] of Object.entries(p.spaces)) {
      const at = `spaces.${name}`;
      if (!oneOf(SPACES, name)) { err(at, "UNKNOWN_SPACE", localize("jurisdictions.index.name_is_not_one_of", "'{name}' is not one of {SPACES}", { name: String(name), SPACES: String(SPACES.join(", ")) })); continue; }
      if (!entry(at, s)) continue;
      fields(at, s, name === "enactment" ? ["label", "forms", "kinds"] : ["label", "forms"]);
      str(`${at}.label`, s.label, "label");
      /** @type {Set<Value>} */
      const names = new Set();
      /** @type {Map<Value, Fields>} */
      const formsOf = new Map([]);
      spaceForms[name] = formsOf;
      list(`${at}.forms`, s.forms).forEach((f, i) => {
        const fa = `${at}.forms[${i}]`;
        if (!entry(fa, f)) return;
        fields(fa, f, ["form", "pattern", "normal", "clean", "basis"]);
        str(`${fa}.form`, f.form, "form");
        if (isStr(f.form)) {
          if (names.has(f.form)) err(`${fa}.form`, "DUPLICATE_FORM", localize("jurisdictions.index.form_is_named_twice_in", "'{form}' is named twice in {name}", { form: String(f.form), name: String(name) }));
          names.add(f.form);
        }
        const re = compile(f.pattern);
        if (!re) pattern(`${fa}.pattern`, f.pattern);
        const groups = re ? groupCount(re) : Infinity;
        let normalOk = normalParts(`${fa}.normal`, f.normal, groups);
        if (own(f, "clean")) {
          const c = f.clean;
          const bad = !isObj(c) || Object.keys(c).some((k) => !["strip", "spaces", "upper"].includes(k))
            || (own(c, "strip") && (!isList(c.strip) || !c.strip.every((x) => compile(x))))
            || (own(c, "spaces") && !oneOf(["remove", "collapse"], c.spaces))
            || (own(c, "upper") && c.upper !== true);
          if (bad) { normalOk = false; err(`${fa}.clean`, "NORMAL_INVALID", "clean is {strip?: [pattern], spaces?: remove|collapse, upper?: true}"); }
        }
        basis(fa, f);
        if (isStr(f.form) && re && normalOk) formsOf.set(f.form, f);
      });
      if (name === "enactment" && own(s, "kinds")) list(`${at}.kinds`, s.kinds).forEach((k, i) => {
        const ka = `${at}.kinds[${i}]`;
        if (!entry(ka, k)) return;
        fields(ka, k, ["kind", "prefix", "floor", "basis"]);
        str(`${ka}.kind`, k.kind, "kind");
        pattern(`${ka}.prefix`, k.prefix);
        if (own(k, "floor")) {
          const fl = k.floor;
          if (!isObj(fl)) err(`${ka}.floor`, "VALUE_INVALID", "a floor is {first, system, basis}");
          else {
            fields(`${ka}.floor`, fl, ["first", "system", "basis"]);
            if (!isPosInt(fl.first)) err(`${ka}.floor.first`, "VALUE_INVALID", "the first number is a positive integer");
            if (!isStr(fl.system) || !origins.has(fl.system)) err(`${ka}.floor.system`, "SYSTEM_UNKNOWN", localize("jurisdictions.index.no_system_of_this_profile", "no system of this profile has origin '{String}'", { String: String(String(fl.system)) }));
            basis(`${ka}.floor`, fl);
          }
        }
        basis(ka, k);
      });
    }
  }

  if (own(p, "crosswalks")) list("crosswalks", p.crosswalks).forEach((x, i) => {
    const at = `crosswalks[${i}]`;
    if (!entry(at, x)) return;
    fields(at, x, ["space", "forms", "pairs", "source", "basis"]);
    if (!oneOf(SPACES, x.space)) err(`${at}.space`, "UNKNOWN_SPACE", localize("jurisdictions.index.string_is_not_a_space", "'{String}' is not a space", { String: String(String(x.space)) }));
    if (!own(x, "source") || x.source === "" || x.source == null) err(`${at}.source`, "CROSSWALK_UNSOURCED", "a crosswalk names the content hash of its capture");
    else if (typeof x.source !== "string" || !HEX64.test(x.source)) err(`${at}.source`, "VALUE_INVALID", "source is 64 hexadecimal characters");
    /** @type {Map<Value, Fields>} */
    const known = spaceForms[String(x.space)] || new Map([]);
    const forms = isList(x.forms) && x.forms.length === 2 ? x.forms : null;
    if (!forms) err(`${at}.forms`, "VALUE_INVALID", "forms is [a, b]");
    else forms.forEach((f, j) => { if (!known.has(f)) err(`${at}.forms[${j}]`, "CROSSWALK_FORM_UNKNOWN", localize("jurisdictions.index.the_space_has_no_form", "the space has no form '{String}'", { String: String(String(f)) })); });
    list(`${at}.pairs`, x.pairs).forEach((pair, j) => {
      if (!isList(pair) || pair.length !== 2 || !pair.every(isText)) {
        err(`${at}.pairs[${j}]`, "VALUE_INVALID", "a pair is [value in form a, value in form b]"); return;
      }
      if (!forms) return;
      pair.forEach((v, n) => {
        const f = known.get(forms[n]);
        if (f && applyForm(f, v) == null) err(`${at}.pairs[${j}][${n}]`, "CROSSWALK_VALUE_INVALID", localize("jurisdictions.index.v_is_not_a_value", "'{v}' is not a value in form '{v1}'", { v: String(v), v1: String(forms[n]) }));
      });
    });
    basis(at, x);
  });

  /* R59, R60: the organisation keys the body-variant map names */
  /** @type {Set<Value>} */
  const variantOrgs = new Set(own(p, "vocabulary") && isObj(p.vocabulary) && isList(p.vocabulary.body_variants)
    ? p.vocabulary.body_variants.filter(isObj).map((v) => v.organisation).filter(isKindKey) : []);
  /** @param {Value} o
   *  @returns {boolean} */
  const variantOrg = (o) => typeof o === "string" && variantOrgs.has(o);
  /* The profile's action kinds, read first: a response status (R77), a legal fact (R79) and a procedure guide (R80) name
     them. */
  /** @type {Set<Value>} */
  const profileKinds = new Set(own(p, "action_kinds") && isList(p.action_kinds)
    ? p.action_kinds.flatMap((k) => (isObj(k) && typeof k.kind === "string" && KIND_RE.test(k.kind) ? [k.kind] : [])) : []);
  if (own(p, "vocabulary")) {
    if (!isObj(p.vocabulary)) err("vocabulary", "VALUE_INVALID", "vocabulary is an object keyed by vocabulary key");
    else for (const [key, entries] of Object.entries(p.vocabulary)) {
      const at = `vocabulary.${key}`;
      if (!oneOf(VOCABULARY, key)) { err(at, "UNKNOWN_VOCABULARY", localize("jurisdictions.index.key_is_not_one_of", "'{key}' is not one of {VOCABULARY}", { key: String(key), VOCABULARY: String(VOCABULARY.join(", ")) })); continue; }
      /** @type {Set<Value>} */
      const once = new Set(); /* R58, R60: a value, status or member type once in the profile */
      list(at, entries).forEach((e, i) => {
        const ea = `${at}[${i}]`;
        if (!entry(ea, e)) return;
        /* DATA_VOCABULARY's own keys are these three */
        const dataFields = key === "vote_values" ? DATA_VOCABULARY.vote_values : key === "response_statuses"
          ? DATA_VOCABULARY.response_statuses : key === "member_types" ? DATA_VOCABULARY.member_types : null;
        if (dataFields) {
          fields(ea, e, dataFields);
          const name = dataFields[0] ?? ""; /* each list names its key field first */
          const v = e[name];
          /* R60 (K1729): a MemberType once per body-variant organisation, and once for all bodies */
          const k = key === "member_types" ? memberTypeKey(e) : v;
          if (key === "member_types" ? !isStr(v) : (typeof v !== "string" || !KIND_RE.test(v)))
            err(`${ea}.${name}`, "VALUE_INVALID", key === "member_types" ? "member_type is the MemberType as written, non-empty" : `${name} matches ^[a-z][a-z0-9_]*$`);
          else if (once.has(k)) err(`${ea}.${name}`, "VALUE_INVALID", key === "member_types"
            ? localize("jurisdictions.index.v_is_given_twice_v1", "'{v}' is given twice {v1}", { v: String(v), v1: String(own(e, "organisation") ? `for ${String(e.organisation)}` : "for all bodies") }) : localize("jurisdictions.index.v_is_given_twice", "'{v}' is given twice", { v: String(v) }));
          else once.add(k);
          if (key === "member_types") {
            if (!oneOf(MEMBER_CAPACITIES, e.capacity)) err(`${ea}.capacity`, "VALUE_INVALID", `capacity is ${MEMBER_CAPACITIES.join(" or ")}`);
            if (own(e, "organisation") && !variantOrg(e.organisation))
              err(`${ea}.organisation`, "VALUE_INVALID", localize("jurisdictions.index.organisation_is_a_key_the", "organisation is a key the body-variant map names, not '{String}'", { String: String(String(e.organisation)) }));
          } else { str(`${ea}.label`, e.label, "label"); str(`${ea}.citation`, e.citation, "citation"); }
          /* R77 (T45): the statuses a venue of one kind reports in (a grand jury's required responses); absent, every kind */
          if (key === "response_statuses" && own(e, "applies_to") && !profileKinds.has(e.applies_to))
            err(`${ea}.applies_to`, "KIND_INVALID", localize("jurisdictions.index.string_is_no_kind_of", "'{String}' is no kind of this profile", { String: String(String(e.applies_to)) }));
          basis(ea, e);
          return;
        }
        if (key === "codes") {
          fields(ea, e, ["key", "label", "pattern", "copy", "sections", "basis"]);
          str(`${ea}.key`, e.key, "key"); str(`${ea}.label`, e.label, "label");
          /* T33 (K1446): which copy is served, and the shape of a section number and its subsection markers. */
          if (own(e, "copy") && !oneOf(CODE_COPIES, e.copy)) err(`${ea}.copy`, "COPY_UNKNOWN", localize("jurisdictions.index.copy_is_one_of_code", "copy is one of {CODE_COPIES}", { CODE_COPIES: String(CODE_COPIES.join(", ")) }));
          if (own(e, "sections")) {
            const sc = e.sections;
            if (!isObj(sc)) err(`${ea}.sections`, "VALUE_INVALID", "sections is {number, separators, markers}");
            else {
              fields(`${ea}.sections`, sc, ["number", "separators", "markers"]);
              pattern(`${ea}.sections.number`, sc.number);
              /* empty: a number of one part (a charter's `Section 200.`, K1521) */
              if (typeof sc.separators !== "string" || /\s/.test(sc.separators))
                err(`${ea}.sections.separators`, "VALUE_INVALID", "separators are the characters between a section number's parts, possibly none");
              /* the order of subsection levels; a kind may recur at a deeper level (`A.`, `1.`, `a.`: letter, numeral, letter; K1521) */
              if (!isList(sc.markers) || !sc.markers.every((m) => oneOf(SECTION_MARKERS, m)))
                err(`${ea}.sections.markers`, "VALUE_INVALID", localize("jurisdictions.index.markers_is_the_order_of", "markers is the order of subsection markers, from {SECTION_MARKERS}", { SECTION_MARKERS: String(SECTION_MARKERS.join(", ")) }));
            }
          }
        } else if (key === "amending") {
          fields(ea, e, ["pattern", "relation", "basis"]);
          if (!oneOf(AMENDING_RELATIONS, e.relation)) err(`${ea}.relation`, "VALUE_INVALID", localize("jurisdictions.index.relation_is_one_of_amending", "relation is one of {AMENDING_RELATIONS}", { AMENDING_RELATIONS: String(AMENDING_RELATIONS.join(", ")) }));
        } else if (key === "meeting_markers") {
          fields(ea, e, ["marker", "pattern", "basis"]);
          if (!oneOf(MEETING_MARKERS, e.marker)) err(`${ea}.marker`, "VALUE_INVALID", localize("jurisdictions.index.marker_is_one_of_meeting", "marker is one of {MEETING_MARKERS}", { MEETING_MARKERS: String(MEETING_MARKERS.join(", ")) }));
        } else if (key === "body_variants") {
          fields(ea, e, ["pattern", "organisation", "basis"]);
          if (typeof e.organisation !== "string" || !KIND_RE.test(e.organisation))
            err(`${ea}.organisation`, "VALUE_INVALID", "organisation is a key matching ^[a-z][a-z0-9_]*$");
        } else if (key === "roster_words") {
          fields(ea, e, ["pattern", "kind", "basis"]);
          if (own(e, "kind") && !oneOf(ROSTER_KINDS, e.kind)) err(`${ea}.kind`, "VALUE_INVALID", localize("jurisdictions.index.kind_is_roster_kinds_absent", "kind is {ROSTER_KINDS} (absent: both)", { ROSTER_KINDS: String(ROSTER_KINDS.join(" or ")) }));
        } else if (key === "roster_headers") {
          fields(ea, e, ["role", "pattern", "basis"]);
          if (!oneOf(ROSTER_ROLES, e.role)) err(`${ea}.role`, "VALUE_INVALID", localize("jurisdictions.index.role_is_one_of_roster", "role is one of {ROSTER_ROLES}", { ROSTER_ROLES: String(ROSTER_ROLES.join(", ")) }));
        } else if (key === "policy_headers") {
          /* R69: a label a policy document prints in its header block, and the field it names */
          fields(ea, e, ["field", "pattern", "basis"]);
          if (!oneOf(POLICY_HEADER_FIELDS, e.field)) err(`${ea}.field`, "VALUE_INVALID", localize("jurisdictions.index.field_is_one_of_policy", "field is one of {POLICY_HEADER_FIELDS}", { POLICY_HEADER_FIELDS: String(POLICY_HEADER_FIELDS.join(", ")) }));
        } else if (key === "budget_headers") {
          fields(ea, e, ["column", "pattern", "basis"]);
          if (!oneOf(BUDGET_COLUMNS, e.column)) err(`${ea}.column`, "VALUE_INVALID", localize("jurisdictions.index.column_is_one_of_budget", "column is one of {BUDGET_COLUMNS}", { BUDGET_COLUMNS: String(BUDGET_COLUMNS.join(", ")) }));
        } else if (key === "file_numbers") {
          fields(ea, e, ["pattern", "system", "basis"]);
          if (!isStr(e.system) || !origins.has(e.system)) err(`${ea}.system`, "SYSTEM_UNKNOWN", localize("jurisdictions.index.no_system_of_this_profile_2", "no system of this profile has origin '{String}'", { String: String(String(e.system)) }));
        } else fields(ea, e, ["pattern", "basis"]);
        pattern(`${ea}.pattern`, e.pattern);
        basis(ea, e);
      });
    }
  }

  if (own(p, "practice")) {
    if (!isObj(p.practice)) err("practice", "VALUE_INVALID", "practice is an object");
    else {
      fields("practice", p.practice, ["minutes_due_days"]);
      if (own(p.practice, "minutes_due_days")) {
        const m = p.practice.minutes_due_days;
        if (!isObj(m)) err("practice.minutes_due_days", "VALUE_INVALID", "{value, basis}");
        else {
          fields("practice.minutes_due_days", m, ["value", "count", "closures", "basis"]);
          /* K1533: the closure list a business count skips; with none, the due is undetermined */
          if (own(m, "closures") && !(own(p, "holidays") && isList(p.holidays) && p.holidays.some((h) => isObj(h) && h.list === m.closures)))
            err("practice.minutes_due_days.closures", "VALUE_INVALID", localize("jurisdictions.index.no_holidays_entry_of_this", "no holidays entry of this profile is in a list named '{String}'", { String: String(String(m.closures)) }));
          if (!isPosInt(m.value)) err("practice.minutes_due_days.value", "VALUE_INVALID", "a positive integer");
          if (own(m, "count") && !oneOf(COUNTS, m.count)) err("practice.minutes_due_days.count", "COUNT_UNKNOWN", "count is calendar or business");
          basis("practice.minutes_due_days", m);
        }
      }
    }
  }
  if (own(p, "search_terms")) list("search_terms", p.search_terms).forEach((t, i) => {
    const at = `search_terms[${i}]`;
    if (!entry(at, t)) return;
    fields(at, t, ["term", "basis"]);
    str(`${at}.term`, t.term, "term");
    basis(at, t);
  });
  /** @type {Set<Value>} */
  const lawNames = new Set();
  /** @type {{ at: string, rule: Value }[]} */
  const lawResponses = [];
  if (own(p, "records_laws")) list("records_laws", p.records_laws).forEach((l, i) => {
    const at = `records_laws[${i}]`;
    if (!entry(at, l)) return;
    fields(at, l, ["level", "name", "citation", "stages", "requesters", "response", "basis"]);
    if (!oneOf(LAW_LEVELS, l.level)) err(`${at}.level`, "LEVEL_UNKNOWN", localize("jurisdictions.index.level_is_one_of_law", "level is one of {LAW_LEVELS}", { LAW_LEVELS: String(LAW_LEVELS.join(", ")) }));
    str(`${at}.name`, l.name, "name"); str(`${at}.citation`, l.citation, "citation");
    /* R76 (T45): the stages the law has, in its order, each a product stage name with the law's own term; a stage the
       law lacks is absent. Whether action-grammar knows a stage is that module's check. */
    if (own(l, "stages")) {
      /** @type {Set<Value>} */
      const seen = new Set();
      if (!isList(l.stages) || !l.stages.length) err(`${at}.stages`, "VALUE_INVALID", "stages is a non-empty ordered list of {stage, label, citation}");
      else l.stages.forEach((st, j) => {
        const sa = `${at}.stages[${j}]`;
        if (!isObj(st)) { err(sa, "VALUE_INVALID", "a stage is {stage, label, citation}"); return; }
        fields(sa, st, ["stage", "label", "citation"]);
        if (typeof st.stage !== "string" || !KIND_RE.test(st.stage)) err(`${sa}.stage`, "VALUE_INVALID", "stage matches ^[a-z][a-z0-9_]*$");
        else if (seen.has(st.stage)) err(`${sa}.stage`, "VALUE_INVALID", localize("jurisdictions.index.the_stage_stage_is_given", "the stage {stage} is given twice", { stage: String(st.stage) }));
        else seen.add(st.stage);
        str(`${sa}.label`, st.label, "label"); str(`${sa}.citation`, st.citation, "citation");
      });
    }
    if (own(l, "requesters")) {
      const r = l.requesters, ra = `${at}.requesters`;
      if (!isObj(r)) err(ra, "VALUE_INVALID", "requesters is {text, citation, status, basis}");
      else {
        fields(ra, r, ["text", "citation", "status", "basis"]);
        str(`${ra}.text`, r.text, "text"); str(`${ra}.citation`, r.citation, "citation");
        statusBasis(ra, r);
      }
    }
    /* R96 (T51): the rule of the deadline that is the law's first-request window; checked once the deadlines are read */
    if (own(l, "response")) {
      if (!isStr(l.response)) err(`${at}.response`, "VALUE_INVALID", localize("jurisdictions.index.response_is_the_rule_of_a_deadline", "response is the rule of a deadline"));
      else lawResponses.push({ at: `${at}.response`, rule: l.response });
    }
    if (isStr(l.name)) lawNames.add(l.name);
    basis(at, l);
  });

  if (own(p, "locale")) {
    const l = p.locale;
    if (!isObj(l)) err("locale", "VALUE_INVALID", "locale is {value, basis}");
    else {
      fields("locale", l, ["value", "basis"]);
      if (!isLocale(l.value)) err("locale.value", "VALUE_INVALID", "the value is one well-formed BCP 47 language tag");
      basis("locale", l);
    }
  }
  /** R41; R74 (T45): a time zone, the profile's or an office's own.
   *  @param {string} path
   *  @param {Value} z
   *  @returns {void} */
  const zone = (path, z) => {
    if (!isObj(z)) { err(path, "VALUE_INVALID", "time_zone is {value, status, basis}"); return; }
    fields(path, z, ["value", "status", "basis"]);
    if (!isTimeZone(z.value)) err(`${path}.value`, "VALUE_INVALID", "the value is an IANA time-zone name (Area/Location, or UTC)");
    statusBasis(path, z);
  };
  if (own(p, "time_zone")) zone("time_zone", p.time_zone);
  /** R82: an amount in R26's units.
   *  @param {string} path
   *  @param {Value} a
   *  @returns {void} */
  const amountOf = (path, a) => {
    if (!isObj(a) || Object.keys(a).some((k) => k !== "amount" && k !== "units") || !isPosInt(a.amount) || !oneOf(UNITS, a.units))
      err(path, "VALUE_INVALID", localize("jurisdictions.index.amount_is_amount_and_units", "an amount is {amount, units}, a positive integer of one of {units_list}", { units_list: UNITS.join(", ") }));
  };

  /* R46: how a day period is computed; R47: the named closure lists. Read first: rules name them. */
  /** @type {Set<Value>} */
  const computationKeys = new Set();
  if (own(p, "computation")) list("computation", p.computation).forEach((c, i) => {
    const at = `computation[${i}]`;
    if (!entry(at, c)) return;
    fields(at, c, ["key", "rule", "citation", "status", "basis"]);
    if (typeof c.key !== "string" || !KIND_RE.test(c.key)) err(`${at}.key`, "VALUE_INVALID", "key matches ^[a-z][a-z0-9_]*$");
    else if (computationKeys.has(c.key)) err(`${at}.key`, "VALUE_INVALID", localize("jurisdictions.index.key_is_given_twice", "'{key}' is given twice", { key: String(c.key) }));
    else computationKeys.add(c.key);
    if (!oneOf(COMPUTATION_RULES, c.rule)) err(`${at}.rule`, "VALUE_INVALID", localize("jurisdictions.index.rule_is_one_of_computation", "rule is one of {COMPUTATION_RULES}", { COMPUTATION_RULES: String(COMPUTATION_RULES.join(", ")) }));
    str(`${at}.citation`, c.citation, "citation");
    statusBasis(at, c);
  });
  /** @type {Set<Value>} */
  const closureLists = new Set(own(p, "holidays") && isList(p.holidays)
    ? p.holidays.flatMap((h) => (isObj(h) && typeof h.list === "string" && KIND_RE.test(h.list) ? [h.list] : [])) : []);
  if (own(p, "weekend")) {
    const w = p.weekend;
    if (!isObj(w)) err("weekend", "WEEKEND_INVALID", "weekend is {days, citation, status, basis}");
    else {
      fields("weekend", w, ["days", "citation", "status", "basis"]);
      if (!isList(w.days) || !w.days.length || !w.days.every((d) => oneOf(WEEKDAYS, d)) || new Set(w.days).size !== w.days.length)
        err("weekend.days", "WEEKEND_INVALID", localize("jurisdictions.index.days_is_a_non_empty", "days is a non-empty list of {WEEKDAYS}, each once", { WEEKDAYS: String(WEEKDAYS.join(", ")) }));
      else if (w.days.length === WEEKDAYS.length) err("weekend.days", "WEEKEND_INVALID", "a weekend leaves some day open");
      str("weekend.citation", w.citation, "citation");
      statusBasis("weekend", w);
    }
  }

  /* The action sections (R23–R26, R28, R31–R33, R35, R39–R44). */
  /** @type {Set<Value>} */
  const codeKeys = new Set(own(p, "vocabulary") && isObj(p.vocabulary) && isList(p.vocabulary.codes)
    ? p.vocabulary.codes.filter(isObj).map((c) => c.key) : []);
  /** @type {Set<Value>} */
  const families = new Set(); /* R63: a key and series.key once in the profile */
  if (own(p, "standard_sources")) list("standard_sources", p.standard_sources).forEach((s, i) => {
    const at = `standard_sources[${i}]`;
    if (!entry(at, s)) return;
    fields(at, s, ["source", "kind", "issuer", "sector", "level", "cite", "code", "key", "series", "normal", "basis"]);
    if (own(s, "key") && (typeof s.key !== "string" || !ID_RE.test(s.key))) err(`${at}.key`, "VALUE_INVALID", "key is an issuer's segment, matching ^[a-z0-9][a-z0-9-]*$");
    str(`${at}.source`, s.source, "source"); str(`${at}.issuer`, s.issuer, "issuer");
    if (isStr(s.source)) lawNames.add(s.source);
    if (!oneOf(STANDARD_SOURCE_KINDS, s.kind)) err(`${at}.kind`, "SOURCE_KIND_UNKNOWN", localize("jurisdictions.index.kind_is_one_of_standard", "kind is one of {STANDARD_SOURCE_KINDS}", { STANDARD_SOURCE_KINDS: String(STANDARD_SOURCE_KINDS.join(", ")) }));
    /* R31, R64 (T35-1): a statute, regulation, ordinance or court entry carries a law level; a policy, commitment or
       standard carries one only when its issuer is a government at one of the four, and otherwise its sector. An entry
       with a level reads sector government; a level beside another sector is refused. */
    const levelled = !oneOf(["policy", "commitment", "standard"], s.kind);
    if (own(s, "level") || levelled) {
      if (!oneOf(LAW_LEVELS, s.level)) err(`${at}.level`, "LEVEL_UNKNOWN", levelled && !own(s, "level")
        ? localize("jurisdictions.index.a_v1_entry_carries_a", "a {v1} entry carries a level, one of {LAW_LEVELS}", { v1: String(oneOf(LEVELLED_KINDS, s.kind) ? s.kind : "source"), LAW_LEVELS: String(LAW_LEVELS.join(", ")) })
        : localize("jurisdictions.index.level_is_one_of_law_2", "level is one of {LAW_LEVELS}", { LAW_LEVELS: String(LAW_LEVELS.join(", ")) }));
    }
    if (own(s, "sector")) {
      if (!oneOf(SECTORS, s.sector)) err(`${at}.sector`, "SECTOR_UNKNOWN", localize("jurisdictions.index.sector_is_one_of_sectors", "sector is one of {SECTORS}", { SECTORS: String(SECTORS.join(", ")) }));
      else if (own(s, "level") && s.sector !== "government") err(`${at}.sector`, "VALUE_INVALID", "a law level is a government's: an entry with a level has sector government or none");
    } else if (!levelled && !own(s, "level")) err(`${at}.sector`, "SECTOR_UNKNOWN", localize("jurisdictions.index.an_entry_with_no_level", "an entry with no level names its issuer's sector, one of {SECTORS}", { SECTORS: String(SECTORS.join(", ")) }));
    const cite = compile(s.cite);
    pattern(`${at}.cite`, s.cite);
    if (own(s, "code") && !codeKeys.has(s.code)) err(`${at}.code`, "CODE_UNKNOWN", localize("jurisdictions.index.no_vocabulary_codes_entry_has", "no vocabulary.codes entry has key '{String}'", { String: String(String(s.code)) }));
    /* R63, R65: one numbered family of the issuer's documents; its cite recognises one item of it */
    if (own(s, "series")) {
      const sr = s.series, sa = `${at}.series`;
      if (!isObj(sr)) err(sa, "SERIES_INVALID", "series is {key, label}");
      else {
        fields(sa, sr, ["key", "label"]);
        if (typeof sr.key !== "string" || !KIND_RE.test(sr.key)) err(`${sa}.key`, "SERIES_INVALID", "series.key matches ^[a-z][a-z0-9_]*$");
        if (!isStr(sr.label)) err(`${sa}.label`, "SERIES_INVALID", "series.label is how the family's documents name it, non-empty");
        if (!own(s, "key")) err(sa, "SERIES_INVALID", "an entry with a series carries its issuer's key");
        else if (typeof s.key === "string" && typeof sr.key === "string") {
          const k = `${s.key}\u0000${sr.key}`;
          if (families.has(k)) err(sa, "SERIES_INVALID", localize("jurisdictions.index.the_family_key_key_2", "the family {key}/{key_2} is given twice", { key: String(s.key), key_2: String(sr.key) }));
          families.add(k);
        }
      }
      if (cite) {
        const names = groupNames(cite);
        if (!names.includes("number")) err(`${at}.cite`, "SERIES_INVALID", "a series' cite has a named group number, the item's number as written");
        if (names.includes("edition") && s.kind !== "standard") err(`${at}.cite`, "SERIES_INVALID", "an edition group is a standard's designation only");
      }
    }
    /* R63: the number's normal form, R3's parts over cite's groups */
    if (own(s, "normal")) {
      if (!own(s, "series")) err(`${at}.normal`, "SERIES_INVALID", "normal is a series' number's normal form: given with a series");
      normalParts(`${at}.normal`, s.normal, cite ? groupCount(cite) : Infinity);
    }
    basis(at, s);
  });
  /** @type {Set<Value>} */
  const roles = new Set();
  /** @type {Set<Value>} */
  const bodies = new Set();
  /** @type {Set<Value>} */
  const offices = new Set(); /* R75: a counterparty's role and body, a third party that starts a count */
  /* R59: the schemes an office's, a body's or its organisation's identifier may be in (R52's, read here: a scheme is
     judged where it is given). */
  /** @type {Map<Value, Entries>} */
  const schemeKinds = new Map(own(p, "identifier_schemes") && isList(p.identifier_schemes)
    ? p.identifier_schemes.flatMap((x) => (isObj(x) && isStr(x.scheme) && isList(x.entity_kinds) ? [schemeEntry(x.scheme, x.entity_kinds)] : [])) : []);
  /** @param {string} path
   *  @param {Value} x
   *  @param {Value} kind
   *  @returns {void} */
  const identifier = (path, x, kind) => {
    if (!isObj(x)) { err(path, "SCHEME_INVALID", "an identifier is {scheme, id}"); return; }
    fields(path, x, ["scheme", "id"]);
    const entityKinds = schemeKinds.get(x.scheme); /* each held value is a list */
    if (!entityKinds) err(`${path}.scheme`, "SCHEME_INVALID", localize("jurisdictions.index.no_identifier_scheme_of_this", "no identifier scheme of this profile is '{String}'", { String: String(String(x.scheme)) }));
    else if (!entityKinds.includes(kind)) err(`${path}.scheme`, "SCHEME_INVALID", localize("jurisdictions.index.the_scheme_scheme_identifies_no", "the scheme {scheme} identifies no {kind}", { scheme: String(x.scheme), kind: String(kind) }));
    if (!isStr(x.id)) err(`${path}.id`, "SCHEME_INVALID", "id is a non-empty string");
  };
  if (own(p, "counterparties")) list("counterparties", p.counterparties).forEach((c, i) => {
    const at = `counterparties[${i}]`;
    if (!entry(at, c)) return;
    fields(at, c, ["role", "body", "level", "elected", "oversight", "hours", "time_zone", "ids", "within", "organisation", "basis"]);
    if (own(c, "time_zone")) zone(`${at}.time_zone`, c.time_zone); /* R74 */
    /* R59: the office's and its body's identifiers, the organisation the body is part of, its body-variant key */
    if (own(c, "ids")) {
      if (!isObj(c.ids) || !Object.keys(c.ids).length) err(`${at}.ids`, "VALUE_INVALID", "ids is {office?, body?}, at least one");
      else { fields(`${at}.ids`, c.ids, ["office", "body"]); for (const k of ["office", "body"]) if (own(c.ids, k)) identifier(`${at}.ids.${k}`, c.ids[k], k); }
    }
    if (own(c, "within")) {
      const w = c.within, wa = `${at}.within`;
      if (!isObj(w)) err(wa, "VALUE_INVALID", "within is {label, kind, ids}");
      else {
        fields(wa, w, ["label", "kind", "ids"]);
        str(`${wa}.label`, w.label, "label");
        if (typeof w.kind !== "string" || !KIND_RE.test(w.kind)) err(`${wa}.kind`, "VALUE_INVALID", "kind is an entity kind");
        if (!isList(w.ids)) err(`${wa}.ids`, "VALUE_INVALID", "ids is a list of {scheme, id}, possibly empty");
        else w.ids.forEach((x, j) => identifier(`${wa}.ids[${j}]`, x, w.kind));
      }
    }
    if (own(c, "organisation")) {
      if (typeof c.organisation !== "string" || !KIND_RE.test(c.organisation)) err(`${at}.organisation`, "VALUE_INVALID", "organisation is a key matching ^[a-z][a-z0-9_]*$");
      else if (!variantOrg(c.organisation)) err(`${at}.organisation`, "VALUE_INVALID", localize("jurisdictions.index.the_body_variant_map_names", "the body-variant map names no organisation '{organisation}'", { organisation: String(c.organisation) }));
    }
    str(`${at}.role`, c.role, "role"); str(`${at}.body`, c.body, "body");
    if (isStr(c.role)) roles.add(c.role);
    if (isStr(c.body)) bodies.add(c.body);
    if (isStr(c.role) && isStr(c.body)) offices.add(`${String(c.role)}\u0000${String(c.body)}`);
    if (own(c, "hours")) hours(`${at}.hours`, c.hours);
    if (!oneOf(COUNTERPARTY_LEVELS, c.level)) err(`${at}.level`, "LEVEL_UNKNOWN", localize("jurisdictions.index.level_is_one_of_counterparty", "level is one of {COUNTERPARTY_LEVELS}", { COUNTERPARTY_LEVELS: String(COUNTERPARTY_LEVELS.join(", ")) }));
    if (typeof c.elected !== "boolean") err(`${at}.elected`, "VALUE_INVALID", "elected is true or false");
    if (own(c, "oversight") && typeof c.oversight !== "boolean") err(`${at}.oversight`, "VALUE_INVALID", "oversight is true or false");
    basis(at, c);
  });
  /** @type {Set<Value>} */
  const kinds = new Set();
  /** @type {Set<Value>} */
  const tier23 = new Set(); /* R78: the kinds a legal organisation may evaluate */
  /** @type {Set<Value>} */
  const venueKinds = new Set();
  /** @type {Set<Value>} */
  const templateIds = new Set();
  /* R40, R81, R87 (b): one template, attributed; in a kind's `templates` it also carries its purpose (judged by the
     caller), its name and the public sources it was written from. */
  /** @param {string} ta
   *  @param {Value} t
   *  @param {Fields} k
   *  @param {boolean} inList
   *  @returns {void} */
  const templateOf = (ta, t, k, inList) => {
    if (!isObj(t)) err(ta, "TEMPLATE_UNATTRIBUTED", localize("jurisdictions.index.a_template_is_fields_never_bare", "a template is {{fields}}, never bare text", { fields: TEMPLATE_FIELDS.join(", ") }));
    else {
      fields(ta, t, [...TEMPLATE_FIELDS, "name", "sources", ...(inList ? ["purpose"] : [])]);
      for (const f of TEMPLATE_FIELDS)
        if (!own(t, f) || t[f] === undefined || t[f] === null) err(`${ta}.${f}`, "TEMPLATE_UNATTRIBUTED", localize("jurisdictions.index.the_templates_f_is_missing", "the template's {f} is missing", { f: String(f) }));
      /** @param {string} f
       *  @param {string} why
       *  @returns {void} */
      const bad = (f, why) => { if (own(t, f) && t[f] !== undefined && t[f] !== null) err(`${ta}.${f}`, "VALUE_INVALID", why); };
      if (!(typeof t.id === "string" && TEMPLATE_ID_RE.test(t.id))) bad("id", "id matches ^TPL-[a-z0-9][a-z0-9-]*$");
      else if (templateIds.has(t.id)) err(`${ta}.id`, "VALUE_INVALID", localize("jurisdictions.index.id_is_given_twice_in", "'{id}' is given twice in the profile", { id: String(t.id) }));
      else templateIds.add(t.id);
      if (!isPosInt(t.version)) bad("version", "version is a positive integer");
      if (!oneOf(TEMPLATE_USES, t.use)) bad("use", `use is ${TEMPLATE_USES.join(" or ")}`);
      if (!isStr(t.text)) bad("text", "the text is non-empty");
      if (typeof t.notes !== "string") bad("notes", "notes are text, possibly empty");
      if (!isStr(t.authored_by)) bad("authored_by", "authored_by is a non-empty name");
      if (!isStr(t.approved_by)) bad("approved_by", "approved_by is a non-empty name");
      else if (isStr(t.authored_by) && String(t.approved_by).trim() === String(t.authored_by).trim())
        err(`${ta}.approved_by`, "VALUE_INVALID", "the approver is not the template's author");
      if (!isList(t.contributors) || !t.contributors.every(isStr)) bad("contributors", "contributors is a list of names");
      if (!isDate(t.approved_at)) bad("approved_at", "approved_at is a real YYYY-MM-DD");
      if (!isList(t.reviews)) bad("reviews", "reviews is a list of {reviewer, kind, organisation?, credential?, scope, outcome, at}");
      else t.reviews.forEach((r, j) => {
        const ra = `${ta}.reviews[${j}]`;
        if (!isObj(r)) { err(ra, "VALUE_INVALID", "a review is {reviewer, kind, organisation?, credential?, scope, outcome, at}"); return; }
        fields(ra, r, [...REVIEW_REQUIRED, "organisation", "credential"]);
        for (const f of REVIEW_REQUIRED)
          if (!own(r, f) || r[f] === undefined || r[f] === null) err(`${ra}.${f}`, "TEMPLATE_UNATTRIBUTED", localize("jurisdictions.index.the_reviews_f_is_missing", "the review's {f} is missing", { f: String(f) }));
        /** @param {string} f
         *  @param {boolean} ok
         *  @param {string} why
         *  @returns {void} */
        const rbad = (f, ok, why) => { if (own(r, f) && r[f] !== undefined && r[f] !== null && !ok) err(`${ra}.${f}`, "VALUE_INVALID", why); };
        rbad("reviewer", isStr(r.reviewer), "the reviewer is a non-empty name");
        rbad("kind", oneOf(REVIEW_KINDS, r.kind), `kind is ${REVIEW_KINDS.join(" or ")}`);
        rbad("scope", isStr(r.scope), "the scope is non-empty text");
        rbad("outcome", oneOf(REVIEW_OUTCOMES, r.outcome), localize("jurisdictions.index.outcome_is_one_of_review", "outcome is one of {REVIEW_OUTCOMES}", { REVIEW_OUTCOMES: String(REVIEW_OUTCOMES.join(", ")) }));
        rbad("at", isDate(r.at), "at is a real YYYY-MM-DD");
        rbad("organisation", isStr(r.organisation), "the organisation is a non-empty name");
        rbad("credential", isStr(r.credential), "the credential is non-empty text");
      });
      if (own(t, "basis") && t.basis !== undefined && t.basis !== null) {
        if (!(test && t.basis === "TEST") && !(typeof t.basis === "string" && t.basis !== "" && basisParts(t.basis).every((x) => K_REF.test(x))))
          err(`${ta}.basis`, "BASIS_INVALID", t.basis === "TEST" ? "TEST is a basis only in a test profile"
            : "a template rests on the ruling that approved it (K<n>)");
      }
      if (t.use === "file" && k.tier === 3) err(ta, "TEMPLATE_TIER3", "a Tier 3 kind has no use: file template; a brief may serve it");
    }
    if (isObj(t) && (inList || own(t, "name"))) {
      if (!isStr(t.name) || typeof t.name !== "string" || t.name.length > TEMPLATE_NAME_MAX || /[\r\n]/.test(t.name))
        err(`${ta}.name`, "VALUE_INVALID", localize("jurisdictions.index.name_is_a_title_of", "name is a title of at most {TEMPLATE_NAME_MAX} characters on one line", { TEMPLATE_NAME_MAX: String(TEMPLATE_NAME_MAX) }));
    }
    if (isObj(t) && (inList || own(t, "sources"))) {
      if (!isList(t.sources) || !t.sources.length) err(`${ta}.sources`, "VALUE_INVALID", localize("jurisdictions.index.sources_lists_one_public_source", "sources lists at least one public source, each with a citation"));
      else t.sources.forEach((x, j) => {
        if (!isObj(x) || Object.keys(x).some((f) => f !== "citation") || !isStr(x.citation))
          err(`${ta}.sources[${j}]`, "VALUE_INVALID", localize("jurisdictions.index.a_source_has_a_citation", "a source has one field, citation, which is non-empty"));
      });
    }
  };
  if (own(p, "action_kinds")) list("action_kinds", p.action_kinds).forEach((k, i) => {
    const at = `action_kinds[${i}]`;
    if (!entry(at, k)) return;
    fields(at, k, ["kind", "label", "tier", "laws", "venue", "template", "templates", "advisory", "evidence", "shape", "basis"]);
    if (typeof k.kind !== "string" || !KIND_RE.test(k.kind)) err(`${at}.kind`, "KIND_INVALID", "kind matches ^[a-z][a-z0-9_]*$");
    else if (kinds.has(k.kind)) err(`${at}.kind`, "DUPLICATE_KIND", localize("jurisdictions.index.kind_is_given_twice", "'{kind}' is given twice", { kind: String(k.kind) }));
    else { kinds.add(k.kind); if (k.tier === 2 || k.tier === 3) tier23.add(k.kind); }
    str(`${at}.label`, k.label, "label");
    if (own(k, "tier") && !oneOfNumbers(TIERS, k.tier)) err(`${at}.tier`, "TIER_INVALID", "tier is 1, 2 or 3");
    if (own(k, "laws")) list(`${at}.laws`, k.laws).forEach((l, j) => {
      if (!lawNames.has(l)) err(`${at}.laws[${j}]`, "LAW_UNKNOWN", localize("jurisdictions.index.no_records_laws_or_standard", "no records_laws or standard_sources entry is named '{String}'", { String: String(String(l)) }));
    });
    if (own(k, "venue")) {
      const v = k.venue;
      if (!isObj(v)) err(`${at}.venue`, "VALUE_INVALID", "a venue is {name, how, basis}");
      else {
        fields(`${at}.venue`, v, ["name", "how", "hours", "time_zone", "cutoff", "outages", "receipt", "facts", "basis"]);
        str(`${at}.venue.name`, v.name, "name");
        if (!oneOf(VENUE_HOW, v.how)) err(`${at}.venue.how`, "VALUE_INVALID", localize("jurisdictions.index.how_is_one_of_venue", "how is one of {VENUE_HOW}", { VENUE_HOW: String(VENUE_HOW.join(", ")) }));
        if (own(v, "hours")) hours(`${at}.venue.hours`, v.hours);
        if (own(v, "time_zone")) zone(`${at}.venue.time_zone`, v.time_zone); /* R74 */
        /* R82 (T45): the venue's sourced facts, each named once */
        if (own(v, "facts")) {
          /** @type {Set<Value>} */
          const named = new Set();
          list(`${at}.venue.facts`, v.facts).forEach((f, j) => {
            const fa = `${at}.venue.facts[${j}]`;
            if (!entry(fa, f)) return;
            fields(fa, f, ["fact", "value", "amount", "citation", "status", "basis"]);
            if (!oneOf(VENUE_FACTS, f.fact)) err(`${fa}.fact`, "VALUE_INVALID", localize("jurisdictions.index.fact_is_one_of_venue", "fact is one of {VENUE_FACTS}", { VENUE_FACTS: String(VENUE_FACTS.join(", ")) }));
            else if (named.has(f.fact)) err(`${fa}.fact`, "VALUE_INVALID", localize("jurisdictions.index.fact_is_given_twice_for", "{fact} is given twice for this venue", { fact: String(f.fact) }));
            else named.add(f.fact);
            if (!isStr(f.value) || typeof f.value !== "string" || f.value.length > VENUE_FACT_MAX) err(`${fa}.value`, "VALUE_INVALID", localize("jurisdictions.index.value_is_text_of_at", "value is text of at most {VENUE_FACT_MAX} characters", { VENUE_FACT_MAX: String(VENUE_FACT_MAX) }));
            if (own(f, "amount")) amountOf(`${fa}.amount`, f.amount);
            str(`${fa}.citation`, f.citation, "citation");
            statusBasis(fa, f);
          });
        }
        channel(`${at}.venue`, v);
        basis(`${at}.venue`, v);
        if (typeof k.kind === "string") venueKinds.add(k.kind);
      }
    }
    /* R40: a template carries its whole attribution; R28: a `file` template never on a Tier 3 kind (a `brief`
       may serve any tier, K921). Its blanks are filing-templates' to judge (its R15). R81 (T45): a kind may hold its set
       as `templates`, each with its `purpose`, `name` and `sources` (R87 (b)); its single `template` reads as that set
       of one, purpose `initial`, so a kind gives one form, not both. */
    if (own(k, "template")) templateOf(`${at}.template`, k.template, k, false);
    if (own(k, "templates")) {
      if (own(k, "template")) err(`${at}.templates`, "VALUE_INVALID", "a kind gives its single template or its templates, not both");
      if (!isList(k.templates) || !k.templates.length) err(`${at}.templates`, "VALUE_INVALID", "templates is a non-empty list of templates");
      else {
        /** @type {Set<Value>} */
        const purposes = new Set();
        k.templates.forEach((t, j) => {
          const ta = `${at}.templates[${j}]`;
          templateOf(ta, t, k, true);
          if (!isObj(t)) return;
          if (typeof t.purpose !== "string" || !KIND_RE.test(t.purpose)) err(`${ta}.purpose`, "VALUE_INVALID", "purpose matches ^[a-z][a-z0-9_]*$");
          else if (purposes.has(t.purpose)) err(`${ta}.purpose`, "VALUE_INVALID", localize("jurisdictions.index.the_purpose_purpose_is_given", "the purpose {purpose} is given twice in {String}", { purpose: String(t.purpose), String: String(String(k.kind)) }));
          else purposes.add(t.purpose);
        });
      }
    }
    /* R87 (a) (T45): the kind's shape */
    if (own(k, "shape") && !oneOf(KIND_SHAPES, k.shape)) err(`${at}.shape`, "KIND_INVALID", localize("jurisdictions.index.shape_is_one_of_kind", "shape is one of {KIND_SHAPES}", { KIND_SHAPES: String(KIND_SHAPES.join(", ")) }));
    if (own(k, "advisory")) {
      if (!isStr(k.advisory)) err(`${at}.advisory`, "VALUE_INVALID", "an advisory note is text");
      if (k.tier !== 2) err(`${at}.advisory`, "ADVISORY_NOT_TIER2", "an advisory note is given only on a Tier 2 kind");
    }
    /* R39: the venue's evidence standard, and the grades it admits and those the opposition may contest. */
    if (own(k, "evidence")) {
      const ev = k.evidence;
      const ea = `${at}.evidence`;
      if (!isObj(ev)) err(ea, "VALUE_INVALID", "evidence is {standard, accepts, contestable?, basis}");
      else {
        fields(ea, ev, ["standard", "accepts", "contestable", "basis"]);
        if (!own(ev, "standard") || ev.standard === undefined || ev.standard === null || ev.standard === "")
          err(`${ea}.standard`, "EVIDENCE_NO_STANDARD", "evidence names the venue's standard in words");
        else if (!isStr(ev.standard) || typeof ev.standard !== "string" || ev.standard.length > EVIDENCE_STANDARD_MAX)
          err(`${ea}.standard`, "VALUE_INVALID", localize("jurisdictions.index.the_standard_is_text_of", "the standard is text of at most {EVIDENCE_STANDARD_MAX} characters", { EVIDENCE_STANDARD_MAX: String(EVIDENCE_STANDARD_MAX) }));
        /** @param {string} path
         *  @param {Entries} v
         *  @returns {void} */
        const grades = (path, v) => v.forEach((g, j) => {
          const ga = `${path}[${j}]`;
          if (!isObj(g)) { err(ga, "VALUE_INVALID", "an admitted grade is {grade, coattested?}"); return; }
          fields(ga, g, ["grade", "coattested"]);
          if (!oneOf(BASIS_GRADES, g.grade)) err(`${ga}.grade`, "GRADE_UNKNOWN", localize("jurisdictions.index.grade_is_one_of_basis", "grade is one of {BASIS_GRADES}", { BASIS_GRADES: String(BASIS_GRADES.join(", ")) }));
          if (own(g, "coattested") && typeof g.coattested !== "boolean") err(`${ga}.coattested`, "VALUE_INVALID", "coattested is true or false");
        });
        if (!own(ev, "accepts") || (isList(ev.accepts) && !ev.accepts.length))
          err(`${ea}.accepts`, "EVIDENCE_NO_STANDARD", "accepts lists at least one grade the venue admits");
        else if (!isList(ev.accepts)) err(`${ea}.accepts`, "VALUE_INVALID", "accepts is a list of {grade, coattested?}");
        else grades(`${ea}.accepts`, ev.accepts);
        if (own(ev, "contestable")) grades(`${ea}.contestable`, list(`${ea}.contestable`, ev.contestable));
        basis(ea, ev);
      }
    }
    basis(at, k);
  });
  /* R26 (T33): a period as data only; civil-time counts it. An entry written `days: n` with no `units` reads as
     `units: "days", amount: n` (R26 before T33). Every entry carries `status` and a sourced basis (R44, K1445). */
  if (own(p, "deadlines")) list("deadlines", p.deadlines).forEach((d, i) => {
    const at = `deadlines[${i}]`;
    if (!entry(at, d)) return;
    fields(at, d, ["rule", "applies_to", "units", "amount", "days", "count", "direction", "starts", "starter", "roll", "closures",
      "computation", "extension", "tolling", "observed", "applies_on", "due_at", "owed_by", "consequence", "defends", "citation",
      "status", "label", "basis"]);
    str(`${at}.rule`, d.rule, "rule");
    /* R97 (T51): the rule's name in the profile's words */
    if (own(d, "label")) str(`${at}.label`, d.label, "label");
    if (d.applies_to !== "claim" && !kinds.has(d.applies_to))
      err(`${at}.applies_to`, "DEADLINE_KIND_UNKNOWN", localize("jurisdictions.index.string_is_neither_claim_nor", "'{String}' is neither claim nor a kind of this profile", { String: String(String(d.applies_to)) }));
    const legacy = own(d, "days") && !own(d, "units") && !own(d, "amount");
    if (legacy) { if (!isPosInt(d.days)) err(`${at}.days`, "VALUE_INVALID", "days is a positive integer"); }
    else {
      if (own(d, "days")) err(`${at}.days`, "VALUE_INVALID", "days is the pre-T33 form of units and amount; give one form, not both");
      if (!oneOf(UNITS, d.units)) err(`${at}.units`, "UNIT_UNKNOWN", localize("jurisdictions.index.units_is_one_of_units", "units is one of {UNITS}", { UNITS: String(UNITS.join(", ")) }));
      if (!isPosInt(d.amount)) err(`${at}.amount`, "VALUE_INVALID", "amount is a positive integer");
    }
    const units = legacy ? "days" : d.units;
    if (own(d, "count")) {
      if (!oneOf(COUNTS, d.count)) err(`${at}.count`, "COUNT_UNKNOWN", "count is calendar or business");
      else if (units !== "days") err(`${at}.count`, "UNIT_UNKNOWN", "count is given with units: days only");
    }
    if (own(d, "direction") && !oneOf(DIRECTIONS, d.direction)) err(`${at}.direction`, "DIRECTION_UNKNOWN", `direction is ${DIRECTIONS.join(" or ")}`);
    if (!oneOf(STARTS, d.starts)) err(`${at}.starts`, "ANCHOR_UNKNOWN", localize("jurisdictions.index.starts_is_one_of_starts", "starts is one of {STARTS}", { STARTS: String(STARTS.join(", ")) }));
    /* R75 (T45): a third party's act starts the count: the counterparty, by role and body, whose act it is */
    if (d.starts === "third_party") {
      const st = d.starter;
      if (!isObj(st) || Object.keys(st).some((k) => k !== "role" && k !== "body") || !offices.has(`${asTemplate(st.role)}\u0000${asTemplate(st.body)}`))
        err(`${at}.starter`, "ANCHOR_UNKNOWN", "a third_party start names its starter, {role, body} of a counterparty of this profile");
    } else if (own(d, "starter")) err(`${at}.starter`, "VALUE_INVALID", "a starter is given only with starts: third_party");
    /* R75: whose duty it is, and the law's stated consequence, quoted; R87 (c): a deadline the group meets in its own defence */
    if (own(d, "owed_by") && !oneOf(OWED_BY, d.owed_by)) err(`${at}.owed_by`, "VALUE_INVALID", `owed_by is ${OWED_BY.join(" or ")}`);
    if (own(d, "consequence")) {
      const c = d.consequence;
      if (!isObj(c)) err(`${at}.consequence`, "VALUE_INVALID", "consequence is {text, citation}");
      else {
        fields(`${at}.consequence`, c, ["text", "citation"]);
        str(`${at}.consequence.text`, c.text, "text"); str(`${at}.consequence.citation`, c.citation, "citation");
      }
    }
    if (own(d, "defends") && d.defends !== true) err(`${at}.defends`, "VALUE_INVALID", "defends is true, or absent");
    if (own(d, "roll") && typeof d.roll !== "boolean") err(`${at}.roll`, "VALUE_INVALID", "roll is true or false");
    if (own(d, "closures") && !closureLists.has(d.closures))
      err(`${at}.closures`, "CLOSURES_UNKNOWN", localize("jurisdictions.index.no_holidays_entry_of_this_2", "no holidays entry of this profile is in a list named '{String}'", { String: String(String(d.closures)) }));
    if (own(d, "computation") && !computationKeys.has(d.computation))
      err(`${at}.computation`, "COMPUTATION_UNKNOWN", localize("jurisdictions.index.no_computation_entry_of_this", "no computation entry of this profile has key '{String}'", { String: String(String(d.computation)) }));
    if (own(d, "extension")) {
      const x = d.extension;
      if (!isObj(x)) err(`${at}.extension`, "VALUE_INVALID", "an extension is {days, count, when, citation?}");
      else {
        fields(`${at}.extension`, x, ["days", "count", "when", "citation"]);
        if (!isPosInt(x.days)) err(`${at}.extension.days`, "VALUE_INVALID", "days is a positive integer");
        if (!oneOf(COUNTS, x.count)) err(`${at}.extension.count`, "COUNT_UNKNOWN", "count is calendar or business");
        str(`${at}.extension.when`, x.when, "when");
        if (own(x, "citation")) str(`${at}.extension.citation`, x.citation, "citation");
      }
    }
    if (own(d, "tolling")) list(`${at}.tolling`, d.tolling).forEach((t, j) => {
      const ta = `${at}.tolling[${j}]`;
      if (!entry(ta, t)) return;
      fields(ta, t, ["when", "citation"]);
      str(`${ta}.when`, t.when, "when"); str(`${ta}.citation`, t.citation, "citation");
    });
    /* R47: a body's observed practice, held beside the rule and never as it (K1504 (1)). */
    if (own(d, "observed")) {
      const o = d.observed;
      if (!isObj(o)) err(`${at}.observed`, "VALUE_INVALID", "observed is {closures, status, basis}");
      else {
        fields(`${at}.observed`, o, ["closures", "status", "basis"]);
        if (!closureLists.has(o.closures))
          err(`${at}.observed.closures`, "CLOSURES_UNKNOWN", localize("jurisdictions.index.no_holidays_entry_of_this_3", "no holidays entry of this profile is in a list named '{String}'", { String: String(String(o.closures)) }));
        statusBasis(`${at}.observed`, o);
      }
    }
    /* K1514: the anchor's weekdays a rule applies to, and the time of day it is due at */
    if (own(d, "applies_on") && (!isList(d.applies_on) || !d.applies_on.length
        || !d.applies_on.every((x) => oneOf(WEEKDAYS, x)) || new Set(d.applies_on).size !== d.applies_on.length))
      err(`${at}.applies_on`, "VALUE_INVALID", localize("jurisdictions.index.applies_on_is_a_non", "applies_on is a non-empty list of {WEEKDAYS}, each once", { WEEKDAYS: String(WEEKDAYS.join(", ")) }));
    if (own(d, "due_at") && d.due_at !== "close_of_business" && minutes(d.due_at) === null)
      err(`${at}.due_at`, "VALUE_INVALID", "due_at is close_of_business or HH:MM");
    str(`${at}.citation`, d.citation, "citation");
    statusBasis(at, d);
  });
  /* R96 (T51): a law's `response` is a deadline of this profile that applies to a records request */
  for (const r of lawResponses) {
    const hit = isList(p.deadlines) ? p.deadlines.find((d) => isObj(d) && d.rule === r.rule && d.applies_to === "records_request") : null;
    if (!hit) err(r.at, "VALUE_INVALID", localize("jurisdictions.index.response_names_no_records_deadline", "response '{rule}' is no rule of a deadline that applies to records_request", { rule: String(r.rule).slice(0, 80) }));
  }

  if (own(p, "legal_organisations")) list("legal_organisations", p.legal_organisations).forEach((o, i) => {
    const at = `legal_organisations[${i}]`;
    if (!entry(at, o)) return;
    fields(at, o, ["name", "evaluates", "defends", "contacts", "basis"]);
    str(`${at}.name`, o.name, "name");
    /* R78 (T45, amends R32): it evaluates kinds of Tier 2 or 3, or advises a group facing legal pressure against itself
       (`defends: true`), or both; an entry with neither has no purpose here. */
    if (own(o, "defends") && typeof o.defends !== "boolean") err(`${at}.defends`, "VALUE_INVALID", "defends is true or false");
    if (own(o, "evaluates") && !isList(o.evaluates)) err(`${at}.evaluates`, "VALUE_INVALID", "evaluates is a list of Tier 2 or 3 kinds");
    else if (isList(o.evaluates)) o.evaluates.forEach((k, j) => {
      if (!tier23.has(k)) err(`${at}.evaluates[${j}]`, "ORG_KIND_UNKNOWN", localize("jurisdictions.index.string_is_not_a_tier", "'{String}' is not a Tier 2 or 3 kind of this profile", { String: String(String(k)) }));
    });
    if (!(isList(o.evaluates) && o.evaluates.length) && o.defends !== true)
      err(`${at}.evaluates`, "ORG_PURPOSE_MISSING", "a legal organisation evaluates at least one Tier 2 or 3 kind, or defends a group (defends: true)");
    if (!isList(o.contacts) || !o.contacts.length) err(`${at}.contacts`, "CONTACT_INVALID", "contacts is a non-empty list of {how, value}");
    else o.contacts.forEach((c, j) => {
      const ca = `${at}.contacts[${j}]`;
      if (!isObj(c)) { err(ca, "CONTACT_INVALID", "a contact is {how, value}"); return; }
      fields(ca, c, ["how", "value"]);
      if (!oneOf(CONTACT_HOW, c.how)) err(`${ca}.how`, "CONTACT_INVALID", localize("jurisdictions.index.how_is_one_of_contact", "how is one of {CONTACT_HOW}", { CONTACT_HOW: String(CONTACT_HOW.join(", ")) }));
      if (!isStr(c.value)) err(`${ca}.value`, "CONTACT_INVALID", "the value is a non-empty string");
    });
    basis(at, o);
  });

  /* R33, R43: a year once for all offices and once for each distinct `offices` list. */
  if (own(p, "holidays")) {
    /** @type {Set<Value>} */
    const years = new Set();
    list("holidays", p.holidays).forEach((h, i) => {
      const at = `holidays[${i}]`;
      if (!entry(at, h)) return;
      fields(at, h, ["year", "list", "citation", "offices", "days", "status", "basis"]);
      /* R47: the closure list the entry belongs to, with the provision that makes it. */
      let key = "";
      if (own(h, "list")) {
        if (typeof h.list !== "string" || !KIND_RE.test(h.list)) err(`${at}.list`, "HOLIDAY_INVALID", "list is a name matching ^[a-z][a-z0-9_]*$");
        str(`${at}.citation`, h.citation, "citation");
      } else if (own(h, "citation")) str(`${at}.citation`, h.citation, "citation");
      if (own(h, "offices")) {
        if (!isList(h.offices) || !h.offices.length) {
          err(`${at}.offices`, "HOLIDAY_INVALID", "offices is a non-empty list of roles or {venue: <kind>}");
          key = `\u0002${i}`; /* no list to key by: judged on its own */
        }
        else {
          /** @type {Set<Value>} */
          const seenOffices = new Set();
          h.offices.forEach((o, j) => {
            const oa = `${at}.offices[${j}]`;
            const k = officeKey(o);
            if (typeof o === "string") { if (!roles.has(o)) err(oa, "HOLIDAY_INVALID", localize("jurisdictions.index.no_counterparty_of_this_profile", "no counterparty of this profile has role '{o}'", { o: String(o) })); }
            else if (isObj(o) && Object.keys(o).length === 1 && typeof o.venue === "string") {
              if (!venueKinds.has(o.venue)) err(oa, "HOLIDAY_INVALID", localize("jurisdictions.index.no_kind_of_this_profile", "no kind of this profile with a venue is '{venue}'", { venue: String(o.venue) }));
            } else { err(oa, "HOLIDAY_INVALID", "an office is a counterparty role or {venue: <kind>}"); return; }
            if (seenOffices.has(k)) err(oa, "HOLIDAY_INVALID", "an office is named twice in one entry");
            seenOffices.add(k);
          });
          key = officesKey(h.offices);
        }
      }
      key = `${listKey(h)}\u0003${key}`;
      if (!isYear(h.year)) err(`${at}.year`, "HOLIDAY_INVALID", "year is a four-digit year");
      else if (years.has(`${String(h.year)}\u0000${key}`)) err(`${at}.year`, "HOLIDAY_INVALID",
        own(h, "list")
          ? (own(h, "offices")
            ? localize("jurisdictions.index.year_listed_twice_for_list_and_the_same_offices", "{year} is listed twice for the list {list} and the same offices", { year: String(h.year), list: String(h.list) })
            : localize("jurisdictions.index.year_listed_twice_for_list_and_all_offices", "{year} is listed twice for the list {list} and all offices", { year: String(h.year), list: String(h.list) }))
          : own(h, "offices")
            ? localize("jurisdictions.index.year_listed_twice_for_the_same_offices", "{year} is listed twice for the same offices", { year: String(h.year) })
            : localize("jurisdictions.index.year_listed_twice_for_all_offices", "{year} is listed twice for all offices", { year: String(h.year) }));
      else years.add(`${String(h.year)}\u0000${key}`);
      /** @type {Set<Value>} */
      const dates = new Set();
      list(`${at}.days`, h.days).forEach((d, j) => {
        const da = `${at}.days[${j}]`;
        if (!entry(da, d)) return;
        fields(da, d, ["date", "name"]);
        if (!isDate(d.date)) err(`${da}.date`, "HOLIDAY_INVALID", "a date is a real YYYY-MM-DD");
        else if (isYear(h.year) && Number(String(d.date).slice(0, 4)) !== h.year) err(`${da}.date`, "HOLIDAY_INVALID", `${String(d.date)} is outside ${String(h.year)}`);
        else if (dates.has(d.date)) err(`${da}.date`, "HOLIDAY_INVALID", localize("jurisdictions.index.date_is_given_twice", "{date} is given twice", { date: String(d.date) }));
        else dates.add(d.date);
        str(`${da}.name`, d.name, "name");
      });
      statusBasis(at, h);
    });
  }

  /* R49: a fiscal year per body that keeps one. */
  if (own(p, "fiscal_year")) {
    /** @type {Set<Value>} */
    const seen = new Set();
    list("fiscal_year", p.fiscal_year).forEach((f, i) => {
      const at = `fiscal_year[${i}]`;
      if (!entry(at, f)) return;
      fields(at, f, ["body", "start", "named_by", "label", "status", "basis"]);
      if (f.body !== "*" && !bodies.has(f.body)) err(`${at}.body`, "FISCAL_YEAR_INVALID", `body is a counterparty body of this profile, or * for every body`);
      else if (seen.has(f.body)) err(`${at}.body`, "FISCAL_YEAR_INVALID", localize("jurisdictions.index.body_keeps_one_fiscal_year", "{body} keeps one fiscal year", { body: String(f.body) }));
      else seen.add(f.body);
      if (!isMonthDay(f.start)) err(`${at}.start`, "FISCAL_YEAR_INVALID", "start is the first day, MM-DD");
      if (!oneOf(FISCAL_NAMED_BY, f.named_by)) err(`${at}.named_by`, "FISCAL_YEAR_INVALID", `named_by is ${FISCAL_NAMED_BY.join(" or ")}`);
      const label = isStr(f.label) && typeof f.label === "string" ? f.label : null;
      if (label === null || !FISCAL_PLACEHOLDERS.some((x) => label.includes(x))
          || (label.match(/\{[^}]*\}/g) || []).some((x) => !oneOf(FISCAL_PLACEHOLDERS, x)))
        err(`${at}.label`, "FISCAL_YEAR_INVALID", localize("jurisdictions.index.label_is_a_template_using", "label is a template using {FISCAL_PLACEHOLDERS}", { FISCAL_PLACEHOLDERS: String(FISCAL_PLACEHOLDERS.join(", ")) }));
      statusBasis(at, f);
    });
  }

  /* R50: the rank of a source kind at a law level, and the instrument key's first segment. */
  if (own(p, "law_ranks")) {
    /** @type {Set<Value>} */
    const seen = new Set();
    list("law_ranks", p.law_ranks).forEach((r, i) => {
      const at = `law_ranks[${i}]`;
      if (!entry(at, r)) return;
      fields(at, r, ["kind", "level", "rank", "basis"]);
      if (!oneOf(STANDARD_SOURCE_KINDS, r.kind)) err(`${at}.kind`, "RANK_INVALID", localize("jurisdictions.index.kind_is_one_of_standard_2", "kind is one of {STANDARD_SOURCE_KINDS}", { STANDARD_SOURCE_KINDS: String(STANDARD_SOURCE_KINDS.join(", ")) }));
      if (!oneOf(LAW_LEVELS, r.level)) err(`${at}.level`, "RANK_INVALID", localize("jurisdictions.index.level_is_one_of_law_3", "level is one of {LAW_LEVELS}", { LAW_LEVELS: String(LAW_LEVELS.join(", ")) }));
      if (!isPosInt(r.rank)) err(`${at}.rank`, "RANK_INVALID", "rank is a positive integer, 1 the highest");
      const k = `${asTemplate(r.kind)}\u0000${asTemplate(r.level)}`;
      if (seen.has(k)) err(at, "RANK_INVALID", localize("jurisdictions.index.kind_at_level_is_ranked", "{kind} at {level} is ranked twice", { kind: String(r.kind), level: String(r.level) }));
      seen.add(k);
      basis(at, r);
    });
  }
  if (own(p, "instrument_key")) {
    const k = p.instrument_key;
    if (!isObj(k)) err("instrument_key", "VALUE_INVALID", "instrument_key is {jurisdiction, basis}");
    else {
      fields("instrument_key", k, ["jurisdiction", "basis"]);
      if (typeof k.jurisdiction !== "string" || !ID_RE.test(k.jurisdiction))
        err("instrument_key.jurisdiction", "VALUE_INVALID", "jurisdiction is a segment matching ^[a-z0-9][a-z0-9-]*$");
      basis("instrument_key", k);
    }
  }

  /* R51: the kinds of proceeding the forums hold, and each kind's ordered stages. */
  /** @type {Set<Value>} */
  const proceedingKinds = new Set();
  if (own(p, "proceeding_kinds")) list("proceeding_kinds", p.proceeding_kinds).forEach((k, i) => {
    const at = `proceeding_kinds[${i}]`;
    if (!entry(at, k)) return;
    fields(at, k, ["kind", "label", "forum_kind", "basis"]);
    if (typeof k.kind !== "string" || !KIND_RE.test(k.kind)) err(`${at}.kind`, "KIND_INVALID", "kind matches ^[a-z][a-z0-9_]*$");
    else if (proceedingKinds.has(k.kind)) err(`${at}.kind`, "DUPLICATE_KIND", localize("jurisdictions.index.kind_is_given_twice_2", "'{kind}' is given twice", { kind: String(k.kind) }));
    else proceedingKinds.add(k.kind);
    str(`${at}.label`, k.label, "label");
    if (!oneOf(FORUM_KINDS, k.forum_kind)) err(`${at}.forum_kind`, "VALUE_INVALID", localize("jurisdictions.index.forum_kind_is_one_of", "forum_kind is one of {FORUM_KINDS}", { FORUM_KINDS: String(FORUM_KINDS.join(", ")) }));
    basis(at, k);
  });
  if (own(p, "proceeding_flows")) {
    /** @type {Set<Value>} */
    const flowed = new Set();
    list("proceeding_flows", p.proceeding_flows).forEach((f, i) => {
      const at = `proceeding_flows[${i}]`;
      if (!entry(at, f)) return;
      fields(at, f, ["kind", "stages", "citation", "basis"]);
      if (!proceedingKinds.has(f.kind)) err(`${at}.kind`, "FLOW_INVALID", localize("jurisdictions.index.string_is_no_kind_of_2", "'{String}' is no kind of proceeding_kinds", { String: String(String(f.kind)) }));
      else if (flowed.has(f.kind)) err(`${at}.kind`, "FLOW_INVALID", localize("jurisdictions.index.kind_has_one_flow", "{kind} has one flow", { kind: String(f.kind) }));
      else flowed.add(f.kind);
      if (!isList(f.stages) || !f.stages.length) err(`${at}.stages`, "FLOW_INVALID", "stages is a non-empty ordered list of {stage, label, reached_by}");
      else {
        /** @type {Set<Value>} */
        const stages = new Set();
        f.stages.forEach((st, j) => {
          const sa = `${at}.stages[${j}]`;
          if (!isObj(st)) { err(sa, "FLOW_INVALID", "a stage is {stage, label, reached_by}"); return; }
          fields(sa, st, ["stage", "label", "reached_by"]);
          if (typeof st.stage !== "string" || !KIND_RE.test(st.stage)) err(`${sa}.stage`, "FLOW_INVALID", "stage matches ^[a-z][a-z0-9_]*$");
          else if (stages.has(st.stage)) err(`${sa}.stage`, "FLOW_INVALID", localize("jurisdictions.index.the_stage_stage_is_given_2", "the stage {stage} is given twice", { stage: String(st.stage) }));
          else stages.add(st.stage);
          if (!isStr(st.label)) err(`${sa}.label`, "FLOW_INVALID", "a stage has a label");
          if (!isList(st.reached_by) || !st.reached_by.length || !st.reached_by.every((e) => typeof e === "string" && KIND_RE.test(e)))
            err(`${sa}.reached_by`, "FLOW_INVALID", "reached_by is a non-empty list of event kinds");
        });
      }
      str(`${at}.citation`, f.citation, "citation");
      basis(at, f);
    });
  }

  /* R52: the schemes a registry identifier is in, and the codes a budget or ledger classifies by. */
  if (own(p, "identifier_schemes")) {
    /** @type {Set<Value>} */
    const seen = new Set();
    list("identifier_schemes", p.identifier_schemes).forEach((x, i) => {
      const at = `identifier_schemes[${i}]`;
      if (!entry(at, x)) return;
      fields(at, x, ["scheme", "label", "entity_kinds", "space", "form", "systems", "basis"]);
      if (!isStr(x.scheme)) err(`${at}.scheme`, "SCHEME_INVALID", "scheme is a non-empty name");
      else if (seen.has(x.scheme)) err(`${at}.scheme`, "SCHEME_INVALID", localize("jurisdictions.index.scheme_is_given_twice", "{scheme} is given twice", { scheme: String(x.scheme) }));
      else seen.add(x.scheme);
      str(`${at}.label`, x.label, "label");
      if (!isList(x.entity_kinds) || !x.entity_kinds.length || !x.entity_kinds.every((k) => typeof k === "string" && KIND_RE.test(k)))
        err(`${at}.entity_kinds`, "SCHEME_INVALID", "entity_kinds is a non-empty list of entity kinds");
      const formsOfSpace = spaceForms[String(x.space)];
      if (!formsOfSpace) err(`${at}.space`, "SCHEME_INVALID", localize("jurisdictions.index.this_profile_has_no_space", "this profile has no space '{String}'", { String: String(String(x.space)) }));
      else if (own(x, "form") && !formsOfSpace.has(x.form)) err(`${at}.form`, "SCHEME_INVALID", localize("jurisdictions.index.the_space_space_has_no", "the space {space} has no form '{String}'", { space: String(x.space), String: String(String(x.form)) }));
      if (own(x, "systems")) {
        if (!isList(x.systems)) err(`${at}.systems`, "SCHEME_INVALID", "systems is a list of origins");
        else x.systems.forEach((o, j) => { if (!origins.has(o)) err(`${at}.systems[${j}]`, "SCHEME_INVALID", localize("jurisdictions.index.no_system_of_this_profile_3", "no system of this profile has origin '{String}'", { String: String(String(o)) })); });
      }
      basis(at, x);
    });
  }
  if (own(p, "classification_schemes")) {
    /** @type {Set<Value>} */
    const seen = new Set();
    list("classification_schemes", p.classification_schemes).forEach((x, i) => {
      const at = `classification_schemes[${i}]`;
      if (!entry(at, x)) return;
      fields(at, x, ["scheme", "label", "kind", "codes", "forms", "basis"]);
      if (own(x, "forms")) {
        if (!isList(x.forms) || !x.forms.length) err(`${at}.forms`, "SCHEME_INVALID", "forms is a non-empty list of patterns");
        else x.forms.forEach((f, j) => { if (!compile(f)) err(`${at}.forms[${j}]`, "SCHEME_INVALID", "a form is a pattern {re, flags?}"); });
      }
      if (!isStr(x.scheme)) err(`${at}.scheme`, "SCHEME_INVALID", "scheme is a non-empty name");
      else if (seen.has(x.scheme)) err(`${at}.scheme`, "SCHEME_INVALID", localize("jurisdictions.index.scheme_is_given_twice_2", "{scheme} is given twice", { scheme: String(x.scheme) }));
      else seen.add(x.scheme);
      str(`${at}.label`, x.label, "label");
      if (!oneOf(CLASSIFICATION_KINDS, x.kind)) err(`${at}.kind`, "SCHEME_INVALID", localize("jurisdictions.index.kind_is_one_of_classification", "kind is one of {CLASSIFICATION_KINDS}", { CLASSIFICATION_KINDS: String(CLASSIFICATION_KINDS.join(", ")) }));
      if (own(x, "codes")) {
        if (!isList(x.codes)) err(`${at}.codes`, "SCHEME_INVALID", "codes is a list of {code, label}");
        else {
          /** @type {Set<Value>} */
          const cs = new Set();
          x.codes.forEach((c, j) => {
            const ca = `${at}.codes[${j}]`;
            if (!isObj(c) || !isStr(c.code) || !isStr(c.label) || Object.keys(c).some((k) => k !== "code" && k !== "label"))
              { err(ca, "SCHEME_INVALID", "a code is {code, label}"); return; }
            if (cs.has(c.code)) err(`${ca}.code`, "SCHEME_INVALID", localize("jurisdictions.index.code_is_given_twice", "{code} is given twice", { code: String(c.code) }));
            cs.add(c.code);
          });
        }
      }
      basis(at, x);
    });
  }

  /* R53: the lawful demands to remove a personal fact (K1493). */
  if (own(p, "lawful_demands")) {
    /** @type {Set<Value>} */
    const seen = new Set();
    list("lawful_demands", p.lawful_demands).forEach((d, i) => {
      const at = `lawful_demands[${i}]`;
      if (!entry(at, d)) return;
      fields(at, d, ["kind", "label", "covers", "within", "citation", "status", "basis"]);
      if (typeof d.kind !== "string" || !KIND_RE.test(d.kind)) err(`${at}.kind`, "DEMAND_INVALID", "kind matches ^[a-z][a-z0-9_]*$");
      else if (seen.has(d.kind)) err(`${at}.kind`, "DEMAND_INVALID", localize("jurisdictions.index.kind_is_given_twice_3", "'{kind}' is given twice", { kind: String(d.kind) }));
      else seen.add(d.kind);
      str(`${at}.label`, d.label, "label");
      if (!isList(d.covers) || !d.covers.length || !d.covers.every((c) => oneOf(DEMAND_COVERS, c)) || new Set(d.covers).size !== d.covers.length)
        err(`${at}.covers`, "DEMAND_INVALID", localize("jurisdictions.index.covers_is_a_non_empty", "covers is a non-empty list from {DEMAND_COVERS}", { DEMAND_COVERS: String(DEMAND_COVERS.join(", ")) }));
      const w = d.within;
      if (!isObj(w) || Object.keys(w).some((k) => k !== "amount" && k !== "units") || !isPosInt(w.amount) || !oneOf(UNITS, w.units))
        err(`${at}.within`, "DEMAND_INVALID", localize("jurisdictions.index.within_is_amount_and_units", "within is {amount, units}, units one of {units_list}", { units_list: UNITS.join(", ") }));
      str(`${at}.citation`, d.citation, "citation");
      statusBasis(at, d);
    });
  }

  /* R54: a body's stated meeting schedule, in civil-time's RFC 5545 subset (its R20). */
  if (own(p, "recurrences")) list("recurrences", p.recurrences).forEach((r, i) => {
    const at = `recurrences[${i}]`;
    if (!entry(at, r)) return;
    fields(at, r, ["body", "rrule", "dtstart", "citation", "status", "basis"]);
    str(`${at}.body`, r.body, "body");
    const why = rruleFault(r.rrule);
    if (why) err(`${at}.rrule`, "RECURRENCE_INVALID", why);
    if (!isLocalDateTime(r.dtstart)) err(`${at}.dtstart`, "RECURRENCE_INVALID", "dtstart is a local date-time YYYY-MM-DDTHH:MM[:SS], read in the profile's time_zone");
    str(`${at}.citation`, r.citation, "citation");
    statusBasis(at, r);
  });

  /* R79 (T45): the legal facts shown, with their citations, at the moment they matter; detecting a trigger is the
     consumer's. */
  if (own(p, "legal_facts")) {
    /** @type {Set<Value>} */
    const seen = new Set();
    list("legal_facts", p.legal_facts).forEach((f, i) => {
      const at = `legal_facts[${i}]`;
      if (!entry(at, f)) return;
      fields(at, f, ["key", "trigger", "statement", "citation", "threshold", "applies_to", "status", "basis"]);
      if (typeof f.key !== "string" || !KIND_RE.test(f.key)) err(`${at}.key`, "VALUE_INVALID", "key matches ^[a-z][a-z0-9_]*$");
      else if (seen.has(f.key)) err(`${at}.key`, "VALUE_INVALID", localize("jurisdictions.index.key_is_given_twice_2", "'{key}' is given twice", { key: String(f.key) }));
      else seen.add(f.key);
      if (!oneOf(LEGAL_FACT_TRIGGERS, f.trigger)) err(`${at}.trigger`, "TRIGGER_UNKNOWN", localize("jurisdictions.index.trigger_is_one_of_legal", "trigger is one of {LEGAL_FACT_TRIGGERS}", { LEGAL_FACT_TRIGGERS: String(LEGAL_FACT_TRIGGERS.join(", ")) }));
      str(`${at}.statement`, f.statement, "statement"); str(`${at}.citation`, f.citation, "citation");
      if (own(f, "threshold")) {
        const t = f.threshold;
        if (!isObj(t) || Object.keys(t).some((k) => k !== "amount" && k !== "unit") || typeof t.amount !== "number"
            || !Number.isFinite(t.amount) || t.amount <= 0 || !isStr(t.unit))
          err(`${at}.threshold`, "VALUE_INVALID", "threshold is {amount, unit}, a positive amount and its unit");
      }
      if (own(f, "applies_to")) {
        if (!isList(f.applies_to) || !f.applies_to.length) err(`${at}.applies_to`, "VALUE_INVALID", "applies_to is a non-empty list of kinds");
        else f.applies_to.forEach((k, j) => { if (!profileKinds.has(k)) err(`${at}.applies_to[${j}]`, "VALUE_INVALID", localize("jurisdictions.index.string_is_no_kind_of_3", "'{String}' is no kind of this profile", { String: String(String(k)) })); });
      }
      statusBasis(at, f);
    });
  }

  /* R80 (T45): one sourced procedure guide per kind, its items in the profile's order and never ranked; R87 (d): an item
     may name the correspondence outcomes after which its route applies. */
  if (own(p, "procedure_guides")) {
    /** @type {Set<Value>} */
    const guided = new Set();
    list("procedure_guides", p.procedure_guides).forEach((g, i) => {
      const at = `procedure_guides[${i}]`;
      if (!entry(at, g)) return;
      fields(at, g, ["kind", "items", "status", "basis"]);
      if (!profileKinds.has(g.kind)) err(`${at}.kind`, "KIND_INVALID", localize("jurisdictions.index.string_is_no_kind_of_4", "'{String}' is no kind of this profile", { String: String(String(g.kind)) }));
      else if (guided.has(g.kind)) err(`${at}.kind`, "VALUE_INVALID", localize("jurisdictions.index.kind_has_one_guide", "{kind} has one guide", { kind: String(g.kind) }));
      else guided.add(g.kind);
      if (!isList(g.items) || !g.items.length) err(`${at}.items`, "VALUE_INVALID", "items is a non-empty list of {route, expect?, citation, after?}");
      else g.items.forEach((it, j) => {
        const ia = `${at}.items[${j}]`;
        if (!entry(ia, it)) return;
        fields(ia, it, ["route", "expect", "citation", "after"]);
        str(`${ia}.route`, it.route, "route");
        if (own(it, "expect")) str(`${ia}.expect`, it.expect, "expect");
        str(`${ia}.citation`, it.citation, "citation");
        if (own(it, "after") && (!isList(it.after) || !it.after.length
            || !it.after.every((o) => typeof o === "string" && KIND_RE.test(o)) || new Set(it.after).size !== it.after.length))
          err(`${ia}.after`, "VALUE_INVALID", "after is a non-empty list of outcomes, each matching ^[a-z][a-z0-9_]*$, once");
      });
      statusBasis(at, g);
    });
  }

  /* R86 (T45): phrasings a profile adds to Civicsmith's own lists; it never removes or overrides one (that list is
     action-grammar's). */
  if (own(p, "phrasings")) list("phrasings", p.phrasings).forEach((x, i) => {
    const at = `phrasings[${i}]`;
    if (!entry(at, x)) return;
    fields(at, x, ["locale", "kind", "phrase", "basis"]);
    if (!isLocale(x.locale)) err(`${at}.locale`, "LOCALE_INVALID", "locale is one well-formed BCP 47 language tag");
    if (!oneOf(PHRASING_KINDS, x.kind)) err(`${at}.kind`, "KIND_INVALID", localize("jurisdictions.index.kind_is_one_of_phrasing", "kind is one of {PHRASING_KINDS}", { PHRASING_KINDS: String(PHRASING_KINDS.join(", ")) }));
    if (typeof x.phrase !== "string" || x.phrase.trim().length < PHRASE_MIN || x.phrase.length > PHRASE_MAX || /[\r\n]/.test(x.phrase))
      err(`${at}.phrase`, "VALUE_INVALID", localize("jurisdictions.index.phrase_is_phrase_min_phrase", "phrase is {PHRASE_MIN}–{PHRASE_MAX} characters on one line", { PHRASE_MIN: String(PHRASE_MIN), PHRASE_MAX: String(PHRASE_MAX) }));
    basis(at, x);
  });

  /* R89, R90 (T48): the places outside Civicsmith a member is sent to, each read on the body's own page: its address or
     citation is the source, and the day read is the dated basis. A pointer without a source is not written (R44). */
  if (own(p, "pointers")) list("pointers", p.pointers).forEach((x, i) => {
    const at = `pointers[${i}]`;
    if (!entry(at, x)) return;
    fields(at, x, ["kind", "name", "does", "contacts", "hours", "languages", "source", "status", "basis"]);
    if (!oneOf(POINTER_KINDS, x.kind)) err(`${at}.kind`, "KIND_INVALID", localize("jurisdictions.index.kind_is_one_of_pointer", "kind is one of {POINTER_KINDS}", { POINTER_KINDS: String(POINTER_KINDS.join(", ")) }));
    if (!isStr(x.name) || typeof x.name !== "string" || x.name.length > POINTER_NAME_MAX || /[\r\n]/.test(x.name))
      err(`${at}.name`, "VALUE_INVALID", localize("jurisdictions.index.name_is_the_bodys_own", "name is the body's own name, 1 to {POINTER_NAME_MAX} characters on one line", { POINTER_NAME_MAX: String(POINTER_NAME_MAX) }));
    if (!isStr(x.does) || typeof x.does !== "string" || x.does.length > POINTER_DOES_MAX)
      err(`${at}.does`, "VALUE_INVALID", localize("jurisdictions.index.does_says_what_the_body", "does says what the body does and for whom, 1 to {POINTER_DOES_MAX} characters", { POINTER_DOES_MAX: String(POINTER_DOES_MAX) }));
    if (!isList(x.contacts) || !x.contacts.length) err(`${at}.contacts`, "CONTACT_INVALID", "contacts is a non-empty list of {how, value}");
    else x.contacts.forEach((c, j) => {
      const ca = `${at}.contacts[${j}]`;
      if (!isObj(c)) { err(ca, "CONTACT_INVALID", "a contact is {how, value}"); return; }
      fields(ca, c, ["how", "value"]);
      if (!oneOf(POINTER_HOW, c.how)) err(`${ca}.how`, "CONTACT_INVALID", localize("jurisdictions.index.how_is_one_of_pointer", "how is one of {POINTER_HOW}", { POINTER_HOW: String(POINTER_HOW.join(", ")) }));
      if (!isStr(c.value)) err(`${ca}.value`, "CONTACT_INVALID", "the value is a non-empty string");
    });
    if (own(x, "hours")) hours(`${at}.hours`, x.hours);
    if (own(x, "languages")) {
      if (!isList(x.languages) || !x.languages.length) err(`${at}.languages`, "LOCALE_INVALID", "languages is a non-empty list of language tags");
      else x.languages.forEach((l, j) => { if (!isLocale(l)) err(`${at}.languages[${j}]`, "LOCALE_INVALID", "a language is one well-formed BCP 47 tag"); });
    }
    if (!own(x, "source") || x.source === undefined || x.source === null || x.source === "")
      err(`${at}.source`, "SOURCE_MISSING", "a pointer names the page it was read from, by address or citation");
    else str(`${at}.source`, x.source, "source");
    if (x.status !== "researched") err(`${at}.status`, "BASIS_INVALID", "a pointer's status is researched: it is read on the body's own page");
    if (basis(at, x) && !(test && x.basis === "TEST")
        && typeof x.basis === "string" && !basisParts(x.basis).every((b) => { const m = DATED_REF.exec(b); return !!m && isDate(m[1]); }))
      err(`${at}.basis`, "BASIS_INVALID", "a pointer rests on the day its page was read, a dated entry YYYY-MM-DD");
  });

  /* R93 (T50): what the place's public-records law obliges an office to do, so the help page fills its sentences from data.
     Every field is required but `portal` and `faster`; it rests on the day the statute's text was read (R44). */
  if (own(p, "records_help")) {
    const h = p.records_help, at = "records_help";
    if (!isObj(h)) err(at, "VALUE_INVALID", "records_help is {law, days, extra_days, extension_reasons, portal?, faster?, citations, status, basis}");
    else {
      fields(at, h, ["law", "days", "extra_days", "extension_reasons", "portal", "faster", "citations", "status", "basis"]);
      str(`${at}.law`, h.law, "law");
      if (!isPosInt(h.days)) err(`${at}.days`, "VALUE_INVALID", "days is a positive integer");
      if (!isPosInt(h.extra_days)) err(`${at}.extra_days`, "VALUE_INVALID", "extra_days is a positive integer");
      if (!isList(h.extension_reasons) || !h.extension_reasons.length) err(`${at}.extension_reasons`, "VALUE_INVALID", "extension_reasons is a non-empty list of {reason, citation}");
      else h.extension_reasons.forEach((r, j) => {
        const ra = `${at}.extension_reasons[${j}]`;
        if (!entry(ra, r)) return;
        fields(ra, r, ["reason", "citation"]);
        str(`${ra}.reason`, r.reason, "reason"); str(`${ra}.citation`, r.citation, "citation");
      });
      if (own(h, "portal")) {
        if (!isObj(h.portal)) err(`${at}.portal`, "VALUE_INVALID", "portal is {name, url}");
        else {
          fields(`${at}.portal`, h.portal, ["name", "url"]);
          str(`${at}.portal.name`, h.portal.name, "name");
          if (typeof h.portal.url !== "string" || !/^https?:\/\/[^\s/]+\S*$/.test(h.portal.url)) err(`${at}.portal.url`, "VALUE_INVALID", "url is an http(s) address");
        }
      }
      if (own(h, "faster")) {
        if (!isObj(h.faster)) err(`${at}.faster`, "VALUE_INVALID", "faster is {ordinance, window, request, citation}");
        else {
          fields(`${at}.faster`, h.faster, ["ordinance", "window", "request", "citation"]);
          for (const f of ["ordinance", "window", "request", "citation"]) str(`${at}.faster.${f}`, h.faster[f], f);
        }
      }
      if (!isObj(h.citations)) err(`${at}.citations`, "VALUE_INVALID", `citations is {${RECORDS_HELP_CITATIONS.join(", ")}}`);
      else {
        fields(`${at}.citations`, h.citations, RECORDS_HELP_CITATIONS);
        for (const f of RECORDS_HELP_CITATIONS) str(`${at}.citations.${f}`, h.citations[f], "the citation");
      }
      if (h.status !== "researched") err(`${at}.status`, "BASIS_INVALID", "records_help is researched: it is read from the statute's own text");
      if (basis(at, h) && !(test && h.basis === "TEST") && typeof h.basis === "string" && !basisParts(h.basis).every((b) => { const m = DATED_REF.exec(b); return !!m && isDate(m[1]); }))
        err(`${at}.basis`, "BASIS_INVALID", "records_help rests on the day the text was read, a dated entry YYYY-MM-DD");
    }
  }

  /* R94 (T50): the courts and other forums of the place, each once. `ids` are its identifiers in a scheme of the profile. */
  if (own(p, "forums")) {
    /** @type {Set<Value>} */
    const seen = new Set();
    list("forums", p.forums).forEach((f, i) => {
      const at = `forums[${i}]`;
      if (!entry(at, f)) return;
      fields(at, f, ["label", "forum_kind", "ids", "basis"]);
      str(`${at}.label`, f.label, "label");
      if (!oneOf(FORUM_KINDS, f.forum_kind)) err(`${at}.forum_kind`, "VALUE_INVALID", localize("jurisdictions.index.forum_kind_is_one_of_2", "forum_kind is one of {FORUM_KINDS}", { FORUM_KINDS: String(FORUM_KINDS.join(", ")) }));
      if (isStr(f.label)) {
        const k = `${asTemplate(f.forum_kind)}\u0000${asTemplate(f.label)}`;
        if (seen.has(k)) err(`${at}.label`, "VALUE_INVALID", localize("jurisdictions.index.the_forum_label_is_given", "the forum '{label}' is given twice", { label: String(f.label) }));
        seen.add(k);
      }
      if (own(f, "ids")) {
        if (!isList(f.ids) || !f.ids.length) err(`${at}.ids`, "VALUE_INVALID", "ids is a non-empty list of {scheme, id}");
        else f.ids.forEach((x, j) => identifier(`${at}.ids[${j}]`, x, "forum"));
      }
      basis(at, f);
    });
  }

  /* R70, R71: official local names (DEC-157 (6)), never translated as ordinary words. An explanation says what the
     name is, in a language; a translation is one an office publishes, with its source, resting on a measurement of
     that publication. One name of one kind once in the profile, and one explanation and one translation per
     language under it (R72's keys). */
  if (own(p, "local_names")) {
    /** @type {Set<Value>} */
    const seen = new Set();
    list("local_names", p.local_names).forEach((n, i) => {
      const at = `local_names[${i}]`;
      if (!entry(at, n)) return;
      fields(at, n, ["name", "kind", "explanations", "translations", "basis"]);
      str(`${at}.name`, n.name, "name");
      if (!oneOf(LOCAL_NAME_KINDS, n.kind)) err(`${at}.kind`, "KIND_INVALID", localize("jurisdictions.index.kind_is_one_of_local", "kind is one of {LOCAL_NAME_KINDS}", { LOCAL_NAME_KINDS: String(LOCAL_NAME_KINDS.join(", ")) }));
      else if (isStr(n.name)) {
        const k = `${String(n.name)}\u0000${String(n.kind)}`;
        if (seen.has(k)) err(`${at}.name`, "VALUE_INVALID", localize("jurisdictions.index.the_kind_name_is_given", "the {kind} '{name}' is given twice", { kind: String(n.kind), name: String(n.name) }));
        seen.add(k);
      }
      /** @type {[string, string[]][]} */
      const texts = [["explanations", []], ["translations", ["source"]]];
      for (const [f, extra] of texts) {
        if (!own(n, f)) continue;
        /** @type {Set<Value>} */
        const locales = new Set();
        list(`${at}.${f}`, n[f]).forEach((x, j) => {
          const xa = `${at}.${f}[${j}]`;
          if (!entry(xa, x)) return;
          fields(xa, x, ["locale", "text", ...extra, "basis"]);
          if (!isLocale(x.locale)) err(`${xa}.locale`, "LOCALE_INVALID", "locale is one well-formed BCP 47 language tag");
          else if (locales.has(localeKey(x.locale))) err(`${xa}.locale`, "VALUE_INVALID", localize("jurisdictions.index.v1_in_locale_is_given", "{v1} in {locale} is given twice", { v1: String(f === "explanations" ? "an explanation" : "a translation"), locale: String(x.locale) }));
          else locales.add(localeKey(x.locale));
          str(`${xa}.text`, x.text, "text");
          if (f === "translations") {
            if (!own(x, "source") || x.source === undefined || x.source === null || x.source === "")
              err(`${xa}.source`, "SOURCE_MISSING", "an official translation names the publication it is read from, by address or citation");
            else str(`${xa}.source`, x.source, "source");
            /* R70: a translation rests on a measurement of its publication (R73: none invented) */
            if (basis(xa, x) && !(test && x.basis === "TEST") && typeof x.basis === "string" && !basisParts(x.basis).every((b) => MEASUREMENT_REF.test(b)))
              err(`${xa}.basis`, "BASIS_INVALID", "an official translation rests on a measurement of its publication (M-<n> or a dated entry)");
          } else basis(xa, x);
        });
      }
      basis(at, n);
    });
  }
}

const BYDAY_RE = /^(?:[+-]?(?:[1-9]|[1-4]\d|5[0-3]))?(?:MO|TU|WE|TH|FR|SA|SU)$/;
/** Why an RRULE is outside civil-time's subset (its R20), or null. `EXDATE` is a property of its own, not a part.
 *  @param {Value} v
 *  @returns {string | null} */
function rruleFault(v) {
  if (typeof v !== "string" || !v.trim()) return "rrule is a non-empty RFC 5545 rule";
  /** @type {Map<string, string>} */
  const parts = new Map([]);
  for (const kv of v.replace(/^RRULE:/, "").split(";")) {
    const m = /^([A-Z]+)=(.+)$/.exec(kv);
    if (!m) return `'${kv}' is not NAME=value`;
    const name = m[1] ?? "", value = m[2] ?? ""; /* both groups take part in every match */
    if (!oneOf(RRULE_PARTS, name)) return localize("jurisdictions.index.v1_is_outside_civil_times", "{v1} is outside civil-time's subset ({RRULE_PARTS})", { v1: String(name), RRULE_PARTS: String(RRULE_PARTS.join(", ")) });
    if (parts.has(name)) return localize("jurisdictions.index.v1_is_given_twice", "{v1} is given twice", { v1: String(name) });
    parts.set(name, value);
  }
  if (!oneOf(RRULE_FREQS, parts.get("FREQ"))) return localize("jurisdictions.index.freq_is_one_of_rrule", "FREQ is one of {RRULE_FREQS}", { RRULE_FREQS: String(RRULE_FREQS.join(", ")) });
  /** @param {string} x
   *  @param {number} lo
   *  @param {number} hi
   *  @returns {boolean} */
  const ints = (x, lo, hi) => x.split(",").every((n) => /^[+-]?\d+$/.test(n) && Math.abs(Number(n)) >= lo && Math.abs(Number(n)) <= hi);
  /* each `get` below follows its `has` */
  if (parts.has("INTERVAL") && !/^[1-9]\d*$/.test(parts.get("INTERVAL") ?? "")) return "INTERVAL is a positive integer";
  if (parts.has("BYDAY") && !(parts.get("BYDAY") ?? "").split(",").every((d) => BYDAY_RE.test(d))) return "BYDAY lists days, each with an optional ordinal";
  if (parts.has("BYMONTHDAY") && !ints(parts.get("BYMONTHDAY") ?? "", 1, 31)) return "BYMONTHDAY lists days of the month";
  if (parts.has("BYSETPOS") && !ints(parts.get("BYSETPOS") ?? "", 1, 366)) return "BYSETPOS lists positions";
  if (parts.has("UNTIL") && !/^\d{8}(?:T\d{6}Z?)?$/.test(parts.get("UNTIL") ?? "")) return "UNTIL is a date or date-time";
  return null;
}
