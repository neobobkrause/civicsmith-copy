/* The jurisdiction profiles: every local fact the product uses, held as data, each with the
 * measurement it rests on (`build/requirements/jurisdictions.md`; `build/layers.md`, "No jurisdiction
 * in the product"). This file names no place: only the data files under ./profiles/ do.
 *
 * PURE (R17): no store, no network, no clock. What `get` and `combine` return is the caller's own
 * copy (R18). No service treats a profile by its identity (R20): `id`, `name` and `covers` are read
 * only to be reported back.
 *
 * Services: list() · get(id) · validate(profile) · combine(list) · isLocale(value). */
import FIRST from "./profiles/oakland-alameda.mjs";
import TEST from "./profiles/test-port-ellery.mjs";
import { BASIS_GRADES } from "../bio-plane/src/record-grammar/index.mjs";
import { localize } from "../bio-plane/src/setup-words/index.mjs";

/* ------------------------------------------------------------------------------------------------ */
/* The profile's shape (R1–R7, R23–R26, R31–R33, R39–R44; `locale` and `systems[].links`, N77 and N96; T33's R46–R54, T34's
   R58–R60, T35's R63–R69, T37's R70, T45's R74–R87, T48's R89). */

export const SECTIONS = Object.freeze(["id", "name", "covers", "test", "spaces", "systems", "mixed_hosts",
  "crosswalks", "vocabulary", "practice", "search_terms", "records_laws", "standard_sources",
  "counterparties", "action_kinds", "deadlines", "legal_organisations", "holidays", "locale", "time_zone",
  /* T33 (R46–R54) */
  "weekend", "computation", "fiscal_year", "law_ranks", "instrument_key", "proceeding_kinds", "proceeding_flows",
  "identifier_schemes", "classification_schemes", "lawful_demands", "recurrences",
  /* T37 (R70) */
  "local_names",
  /* T45 (R79, R80, R86) */
  "legal_facts", "procedure_guides", "phrasings",
  /* T48 (R89) */
  "pointers",
  /* T50 (R93, R94) */
  "records_help", "forums"]);
/* R3: `account`, `object`, `vendor`, `proceeding` (K1452) and `person` (one form per person scheme) are T33's; `body` and
   `office` (a legislative system's body and office-record numbers, N569, N613) T34's, and `institution` (one form per
   institution scheme, N574, K1729). */
export const SPACES = Object.freeze(["enactment", "project", "fund", "parcel", "account", "object", "vendor", "proceeding", "person",
  "body", "office", "institution"]);
export const VOCABULARY = Object.freeze(["furniture", "bodies", "member_titles", "enactment_markers", "codes",
  "file_numbers", "report_titles", "report_sections", "recommendation_openers", "template_blanks",
  /* T33 (R6): LAW's amending clauses, Legistar's markers and body-variant map, the roster words */
  "amending", "meeting_markers", "body_variants", "roster_words", "roster_headers", "staff_titles",
  /* (K1513) the budget and financial-report readers' words */
  "financial_report_titles", "budget_book_titles", "financial_headings", "fiscal_year_forms", "budget_headers",
  /* T34 (R58, R60): the values a vote is recorded in, a response's reported statuses, the MemberType map. Data, not patterns. */
  "vote_values", "response_statuses", "member_types",
  /* T35 (R69): the labels a policy document prints in its header block */
  "policy_headers"]);
/* R58, R60: the vocabulary keys whose entries carry no pattern, with each entry's fields. */
const DATA_VOCABULARY = Object.freeze({ vote_values: ["value", "label", "citation", "basis"],
  response_statuses: ["status", "label", "citation", "applies_to", "basis"], member_types: ["member_type", "capacity", "organisation", "basis"] });
/* R60: the capacity a MemberType maps to. */
export const MEMBER_CAPACITIES = Object.freeze(["elected", "appointed"]);
/* R31: the one vocabulary of a law's level, for records laws, standard sources and an action's governing
   laws. An office's level (R24) is not a law's level and keeps its own. */
export const LAW_LEVELS = Object.freeze(["federal", "state", "county", "city"]);
/* R88 (T47; amends R24, R28): the one vocabulary of an office's level, which validate reads (outside it, LEVEL_UNKNOWN)
   and a caller offering an office's level imports (setup-page R5). Not a law's level (R31). */
export const COUNTERPARTY_LEVELS = Object.freeze(["state", "county", "city", "district"]);
/* R23: `SOURCE_KINDS` stays the six `standards` reads (its R1, R12); the seven, with T35's `standard`, are
   `STANDARD_SOURCE_KINDS`, which validate accepts and `standards` adopts in its own job (K1902 (1)). */
export const SOURCE_KINDS = Object.freeze(["statute", "regulation", "ordinance", "court", "policy", "commitment"]);
export const STANDARD_SOURCE_KINDS = Object.freeze([...SOURCE_KINDS, "standard"]);
/* R31 (T35-1): the kinds that always carry a law level; the others carry one only for a government issuer at one. */
const LEVELLED_KINDS = ["statute", "regulation", "ordinance", "court"];
/* R64: the one list of an issuer's sectors (K1453's closed list); `entities` reads it from here (K1902 (2)). */
export const SECTORS = Object.freeze(["government", "company", "nonprofit", "association", "political", "religious", "education", "other"]);
/* R69: the fields a policy header label names (doctypes R26). */
export const POLICY_HEADER_FIELDS = Object.freeze(["type", "number", "title", "effective", "supersedes", "reference", "coordinator",
  "review_due", "revision_cycle"]);
export const VENUE_HOW = Object.freeze(["portal", "mail", "email", "in_person", "court"]);
export const COUNTS = Object.freeze(["calendar", "business"]);
/* R26: the event a period runs from; `entered`, `served` and `hearing` are COURTS'. `received` is the counterparty's
   receipt of the group's request, counted from the group's own `sent` entry (§7 item 1). */
export const STARTS = Object.freeze(["received", "filed", "act", "known", "entered", "served", "hearing", "third_party"]);
/* R75 (T45): whose duty a deadline is; absent, undetermined. `third_party` (STARTS) names its `starter`, a counterparty. */
export const OWED_BY = Object.freeze(["body", "group"]);
/* R79 (T45): the moments a legal fact is shown at, frozen (a new trigger is a requirement change). Detecting one is the
   consumer's. */
export const LEGAL_FACT_TRIGGERS = Object.freeze(["paid_attendee", "recording", "threat_letter", "pending_measure_or_candidate",
  "serial_meeting"]);
/* R82, R87 (e) (T45): the facts a kind's venue may state, frozen; `delivery_point` is the venue's address or channel for
   delivery, never an addressee (v0.2 rule 7). */
export const VENUE_FACTS = Object.freeze(["how_to_submit", "anonymity", "publishes", "public_listing", "speaker_limit",
  "comment_cutoff", "page_limit", "interpreter_lead", "delivery_point"]);
/* R86 (T45): what a profile's phrasing adds to Civicsmith's own lists (`action-grammar`'s); a profile only adds. */
export const PHRASING_KINDS = Object.freeze(["assertion", "position", "own_benefit_ask"]);
/* R87 (a) (T45): the shapes an action kind may declare, frozen (a new shape is a requirement change). */
export const KIND_SHAPES = Object.freeze(["recognition"]);
export const UNITS = Object.freeze(["days", "hours", "business_hours", "months", "years"]);
export const DIRECTIONS = Object.freeze(["forward", "backward"]);
/* R46: how a day period is computed (CCP §12, Gov. Code §6800). */
export const COMPUTATION_RULES = Object.freeze(["exclude_first_include_last"]);
/* R48: the receipt conventions a sourced local rule may state (K1504 (3)). */
export const RECEIPT_RULES = Object.freeze(["next_business_day"]);
/* R6 (T33): a code's served copy (K1446), its subsection markers, an amending clause's relation, a meeting marker. */
export const CODE_COPIES = Object.freeze(["official", "codifier", "undetermined"]);
export const SECTION_MARKERS = Object.freeze(["letter", "numeral", "paren_letter", "paren_numeral", "roman"]);
export const AMENDING_RELATIONS = Object.freeze(["amends", "adds", "repeals", "renumbers", "recodifies"]);
export const MEETING_MARKERS = Object.freeze(["cancelled", "special", "concurrent"]);
/* R6 (K1513, K1517): what a roster word names, the role a roster header plays, the column a budget header heads. */
export const ROSTER_KINDS = Object.freeze(["roster", "chart"]);
export const ROSTER_ROLES = Object.freeze(["name", "title", "unit", "start", "end", "as_of", "employee_id", "contact"]);
export const BUDGET_COLUMNS = Object.freeze(["fund", "org", "department", "department_code", "program", "project", "account",
  "amount", "period", "phase"]);
/* R49: a fiscal year's name, and the placeholders its label template may use. */
export const FISCAL_NAMED_BY = Object.freeze(["start", "end"]);
const FISCAL_PLACEHOLDERS = ["{start}", "{end}", "{start2}", "{end2}"];
/* R51, R52, R53 */
export const FORUM_KINDS = Object.freeze(["court", "commission", "grand_jury", "auditor", "other"]);
export const CLASSIFICATION_KINDS = Object.freeze(["fund", "organisation", "account", "object", "program", "project", "function"]);
export const DEMAND_COVERS = Object.freeze(["home_address", "phone", "other"]);
/* R54: `civil-time`'s RFC 5545 subset (its R20). */
export const RRULE_PARTS = Object.freeze(["FREQ", "INTERVAL", "BYDAY", "BYMONTHDAY", "BYSETPOS", "UNTIL"]);
const RRULE_FREQS = ["WEEKLY", "MONTHLY", "YEARLY"];
/* R70: what an official local name names (DEC-157 (6)). */
export const LOCAL_NAME_KINDS = Object.freeze(["office", "law", "program", "place"]);
export const TIERS = Object.freeze([1, 2, 3]);
export const CONTACT_HOW = Object.freeze(["web", "email", "phone", "mail"]);
/* R89 (T48): the kinds of place outside Civicsmith a member is sent to, frozen (a new kind is a requirement change), and how
   a pointer is reached: R32's means, and a street address, for a pointer only. */
export const POINTER_KINDS = Object.freeze(["legalaid", "selfhelp", "service", "agency", "representative", "tipline"]);
const POINTER_HOW = Object.freeze([...CONTACT_HOW, "address"]);
const POINTER_NAME_MAX = 200, POINTER_DOES_MAX = 500;
/* R93 (T50): the ten sentences of the records-request help each cite their own section; `citations` holds one for each. */
export const RECORDS_HELP_CITATIONS = Object.freeze(["answer", "extend", "assist", "segregate", "refuse_in_writing", "electronic",
  "cost", "cost_electronic", "inspect_photograph", "purpose"]);
/* R39: a venue's evidence standard is named in at most this many characters; the grades it admits are
   letters of record-grammar's BASIS_GRADES (its R16; K624 (6)). */
const EVIDENCE_STANDARD_MAX = 200;
/* R82: a venue fact's text; R87 (b): a template's name, on one line; R86: a phrasing, on one line. */
const VENUE_FACT_MAX = 500;
const TEMPLATE_NAME_MAX = 120;
const PHRASE_MIN = 2, PHRASE_MAX = 100;
/* R40: a profile template's attribution, every field required; its use is filing-templates' (K921). */
export const TEMPLATE_FIELDS = Object.freeze(["id", "version", "use", "text", "notes", "authored_by", "contributors",
  "reviews", "approved_by", "approved_at", "basis"]);
export const TEMPLATE_USES = Object.freeze(["file", "brief"]);
export const REVIEW_KINDS = Object.freeze(["member", "professional"]);
export const REVIEW_OUTCOMES = Object.freeze(["no_concerns", "concerns", "changes_requested"]);
const REVIEW_REQUIRED = ["reviewer", "kind", "scope", "outcome", "at"];
/* R42: an office's weekly hours; a day not listed is closed. */
export const WEEKDAYS = Object.freeze(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
/* R44: what a calendar fact (a holiday entry, hours, the time zone) rests on: a measurement or a ruling. */
export const FACT_STATUSES = Object.freeze(["researched", "ruled"]);

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const KIND_RE = /^[a-z][a-z0-9_]*$/;
const HEX64 = /^[0-9a-f]{64}$/i;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TEMPLATE_ID_RE = /^TPL-[a-z0-9][a-z0-9-]*$/;
const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MMDD_RE = /^(\d{2})-(\d{2})$/;
/* An instant: a date, a time, and an offset or Z (R48's outages). */
const INSTANT_RE = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
/* A local date-time with no zone (R54's dtstart, read in the profile's time_zone). */
const LOCAL_DT_RE = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
/* R41: an IANA name, `Area/Location` (possibly deeper) or `UTC`. */
const TZ_RE = /^(?:UTC|[A-Z][A-Za-z_-]*(?:\/[A-Za-z0-9_+-]+)+)$/;
/* R2: a basis names a measurement (`M-157`, or a dated entry `2026-07-30`) or a ruling (`D-149`,
   `DEC-13`, `K4`); several are joined by ", " or "; ", each optionally followed by one word that
   says which part of it (`M-119 LEG`, `M-157 (4)`). `UNMEASURED` stands alone (K44). */
const BASIS_REF = /^(?:M-\d+|\d{4}-\d{2}-\d{2}|D-\d+|DEC-\d+|K\d+)(?: [^\s,;]+)?$/;
/* R44 and R40: the measurement and ruling forms of a basis part. */
const MEASUREMENT_REF = /^(?:M-\d+|\d{4}-\d{2}-\d{2})(?: [^\s,;]+)?$/;
const RULING_REF = /^(?:D-\d+|DEC-\d+|K\d+)(?: [^\s,;]+)?$/;
const K_REF = /^K\d+(?: [^\s,;]+)?$/;
/* R89: a dated measurement entry, so the day read can be shown with the pointer. */
const DATED_REF = /^(\d{4}-\d{2}-\d{2})(?: [^\s,;]+)?$/;
const basisParts = (b) => b.split(/[,;]\s*/).map((x) => x.trim());

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isStr = (v) => typeof v === "string" && v.trim().length > 0;
const isPosInt = (v) => Number.isInteger(v) && v > 0;
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
/** A four-digit year. */
const isYear = (v) => Number.isInteger(v) && v >= 1000 && v <= 9999;
/** A real calendar date written `YYYY-MM-DD` (R33). */
function isDate(v) {
  const m = typeof v === "string" && DATE_RE.exec(v);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
  return days !== undefined && d >= 1 && d <= days;
}
/** An IANA time-zone name the runtime's zone database knows (R41). `Intl` reads no clock, store or network. */
function isTimeZone(v) {
  if (typeof v !== "string" || !TZ_RE.test(v)) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: v }); return true; } catch { return false; }
}
/** The epoch milliseconds of an instant written with its offset, or null (R48). Reads no clock. */
function instant(v) {
  const m = typeof v === "string" && INSTANT_RE.exec(v);
  if (!m || !isDate(m[1])) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
}
/** A local date-time with no zone, on a real date (R54). */
const isLocalDateTime = (v) => { const m = typeof v === "string" && LOCAL_DT_RE.exec(v); return !!m && isDate(m[1]); };
/** A month and day `MM-DD` that some year has (R49). */
const isMonthDay = (v) => { const m = typeof v === "string" && MMDD_RE.exec(v); return !!m && isDate(`2000-${m[1]}-${m[2]}`); };
/** Minutes since midnight of an `HH:MM`, or null (R42). */
function minutes(v) {
  const m = typeof v === "string" && HHMM_RE.exec(v);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
/** One well-formed BCP 47 language tag (R37, N77): the one reading `validate` gives `locale.value`, exported for its
 *  callers (instance-setup R64; N700). `Intl` reads no clock, store or network. Never throws. */
export function isLocale(v) {
  try {
    if (!isStr(v) || /\s|,/.test(v)) return false;
    return Intl.getCanonicalLocales(v).length === 1;
  } catch { return false; }
}
/** A locale's canonical form, so `es-mx` and `es-MX` name one language (R72's key). */
const localeKey = (v) => { try { return Intl.getCanonicalLocales(v)[0]; } catch { return String(v); } };

/** Whether `b` is a basis a profile may carry. `TEST` only in a test profile (R2). */
export function basisValid(b, test = false) {
  if (typeof b !== "string") return false;
  if (b === "UNMEASURED") return true;
  if (b === "TEST") return test === true;
  const parts = b.split(/[,;]\s*/);
  return parts.length > 0 && parts.every((p) => BASIS_REF.test(p.trim()));
}

/** A pattern `{re, flags?}` compiled, or null when it is not one (R2). */
function compile(p) {
  if (!isObj(p) || typeof p.re !== "string") return null;
  for (const k of Object.keys(p)) if (k !== "re" && k !== "flags") return null;
  const flags = own(p, "flags") ? p.flags : "";
  if (typeof flags !== "string" || !/^[iu]*$/.test(flags) || new Set(flags).size !== flags.length) return null;
  try { return new RegExp(p.re, flags); } catch { return null; }
}
/** How many capture groups a compiled pattern has. */
const groupCount = (re) => new RegExp(`${re.source}|`, re.flags).exec("").length - 1;
/** The names of a compiled pattern's named groups (R63). */
const groupNames = (re) => Object.keys(new RegExp(`${re.source}|`, re.flags).exec("").groups || {});

/* ------------------------------------------------------------------------------------------------ */
/* Reading a value in a form (R3): used by validate to judge a crosswalk's pairs. The same meaning   */
/* `id-spaces` gives it: clean, then the pattern, then the normal form from the parts.              */

function applyForm(form, raw, prefixes = []) {
  const re = compile(form.pattern);
  if (!re) return null;
  let v = String(raw == null ? "" : raw).trim();
  const c = isObj(form.clean) ? form.clean : {};
  for (const p of prefixes) { const r = compile(p); if (r) v = v.replace(new RegExp(`^(?:${r.source})`, r.flags), ""); }
  for (const p of Array.isArray(c.strip) ? c.strip : []) {
    const r = compile(p);
    if (r) v = v.replace(new RegExp(`^(?:${r.source})`, r.flags), "");
  }
  if (c.spaces === "remove") v = v.replace(/\s+/g, "");
  else v = v.replace(/\s+/g, " ").trim();
  if (c.upper === true) v = v.toUpperCase();
  if (!v) return null;
  const m = re.exec(v);
  if (!m) return null;
  let out = "";
  for (const part of form.normal) {
    if (typeof part === "string") { out += part; continue; }
    let g = m[part.group];
    if (g == null) g = own(part, "default") ? part.default : "";
    if (part.unpad) g = g.replace(/^0+(?=.)/, "");
    if (part.upper) g = g.toUpperCase();
    out += g;
  }
  return out;
}

/* ------------------------------------------------------------------------------------------------ */
/* validate (R10, R11, R28, R35).                                                                   */

/** Judge a profile against R1–R7, R23–R26, R31–R33, R37–R44 and the later tranches' additions (R46–R90). `{ok, errors}`,
 *  every error found. Never throws. */
export function validate(profile) {
  const errors = [];
  try { validateInto(profile, errors); }
  catch (e) { errors.push({ path: "", code: "NOT_A_PROFILE", detail: `unreadable: ${String(e && e.message || e)}` }); }
  return { ok: errors.length === 0, errors };
}

function validateInto(p, errors) {
  const err = (path, code, detail) => errors.push({ path, code, detail });
  if (!isObj(p)) { err("", "NOT_A_PROFILE", "a profile is a plain object"); return; }
  const test = p.test === true;

  for (const k of Object.keys(p)) if (!SECTIONS.includes(k)) err(k, "UNKNOWN_SECTION", localize("jurisdictions.index.k_is_not_a_section", "'{k}' is not a section of a profile", { k: String(k) }));
  if (typeof p.id !== "string" || !ID_RE.test(p.id)) err("id", "ID_INVALID", "id matches ^[a-z0-9][a-z0-9-]*$");
  if (!isStr(p.name)) err("name", "NAME_MISSING", "a profile has a name");
  if (!Array.isArray(p.covers) || !p.covers.length || !p.covers.every(isStr))
    err("covers", "COVERS_MISSING", "covers is a non-empty list of names");
  if (own(p, "test") && typeof p.test !== "boolean") err("test", "VALUE_INVALID", "test is true or false");

  /* Returns whether the basis is present and of R2's form. */
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
  const statusBasis = (path, o) => {
    const ok = basis(path, o);
    if (!FACT_STATUSES.includes(o.status)) {
      err(`${path}.status`, "BASIS_INVALID", localize("jurisdictions.index.status_is_fact_statuses_naming", "status is {FACT_STATUSES}, naming what the fact rests on", { FACT_STATUSES: String(FACT_STATUSES.join(" or ")) }));
      return;
    }
    if (!ok || (test && o.basis === "TEST")) return;
    if (o.basis === "UNMEASURED")
      err(`${path}.basis`, "BASIS_INVALID", "a calendar fact without a source is not written: UNMEASURED is no basis for it");
    else if (!basisParts(o.basis).every((x) => (o.status === "researched" ? MEASUREMENT_REF : RULING_REF).test(x)))
      err(`${path}.basis`, "BASIS_INVALID", o.status === "researched"
        ? "a researched fact rests on a measurement (M-<n> or a dated entry)" : "a ruled fact rests on a ruling (D-<n>, DEC-<n> or K<n>)");
  };
  /* R42: an office's or venue's weekly hours. */
  const hours = (path, h) => {
    if (!isObj(h)) { err(path, "HOURS_INVALID", "hours is {weekly: [{day, open, close}], status, basis}"); return; }
    fields(path, h, ["weekly", "status", "basis"]);
    if (!Array.isArray(h.weekly)) err(`${path}.weekly`, "HOURS_INVALID", "weekly is a list of {day, open, close}");
    else {
      const spans = new Map();
      h.weekly.forEach((s, i) => {
        const at = `${path}.weekly[${i}]`;
        if (!isObj(s)) { err(at, "HOURS_INVALID", "a span is {day, open, close}"); return; }
        fields(at, s, ["day", "open", "close"]);
        const day = WEEKDAYS.includes(s.day) ? s.day : null;
        if (!day) err(`${at}.day`, "HOURS_INVALID", localize("jurisdictions.index.day_is_one_of_weekdays", "day is one of {WEEKDAYS}", { WEEKDAYS: String(WEEKDAYS.join(", ")) }));
        const [o, c] = [minutes(s.open), minutes(s.close)];
        if (o === null) err(`${at}.open`, "HOURS_INVALID", "open is HH:MM, 24-hour");
        if (c === null) err(`${at}.close`, "HOURS_INVALID", "close is HH:MM, 24-hour");
        if (o === null || c === null) return;
        if (o >= c) { err(at, "HOURS_INVALID", "open is before close"); return; }
        if (!day) return;
        const prior = spans.get(day) || [];
        const clash = prior.find((p) => o < p.c && p.o < c);
        if (clash) err(at, "HOURS_INVALID", `${day} ${s.open}–${s.close} overlaps ${clash.at}`);
        spans.set(day, [...prior, { o, c, at }]);
      });
    }
    statusBasis(path, h);
  };
  /* R48: a venue's channel facts. A malformed one is CHANNEL_INVALID; its status and basis are R44's. */
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
      if (!Array.isArray(v.outages)) err(`${path}.outages`, "CHANNEL_INVALID", "outages is a list of {from, to, status, basis}");
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
        if (!RECEIPT_RULES.includes(r.rule)) err(`${ra}.rule`, "CHANNEL_INVALID", localize("jurisdictions.index.rule_is_one_of_receipt", "rule is one of {RECEIPT_RULES}", { RECEIPT_RULES: String(RECEIPT_RULES.join(", ")) }));
        if (!isStr(r.citation)) err(`${ra}.citation`, "CHANNEL_INVALID", "a receipt rule cites the local rule that states it");
        statusBasis(ra, r);
      }
    }
  };
  /* R3: a normal form's parts, each a literal or {group, unpad?, upper?, default?} naming a group the pattern has. */
  const normalParts = (path, normal, groups) => {
    if (!Array.isArray(normal) || !normal.length) { err(path, "NORMAL_INVALID", "normal is a non-empty list of parts"); return false; }
    let ok = true;
    normal.forEach((part, j) => {
      if (typeof part === "string") return;
      if (!isObj(part) || !Number.isInteger(part.group) || part.group < 1 || part.group > groups
          || Object.keys(part).some((k) => !["group", "unpad", "upper", "default"].includes(k))
          || (own(part, "unpad") && typeof part.unpad !== "boolean")
          || (own(part, "upper") && typeof part.upper !== "boolean")
          || (own(part, "default") && typeof part.default !== "string")) {
        ok = false;
        err(`${path}[${j}]`, "NORMAL_INVALID", "a part is a literal string or {group, unpad?, upper?, default?} naming a group the pattern has");
      }
    });
    return ok;
  };
  const pattern = (path, v) => { if (!compile(v)) err(path, "PATTERN_INVALID", "a pattern is {re, flags?}: a regular expression that compiles, flags from i and u"); };
  const fields = (path, o, allowed) => {
    for (const k of Object.keys(o)) if (!allowed.includes(k)) err(`${path}.${k}`, "UNKNOWN_SECTION", localize("jurisdictions.index.k_is_not_a_field", "'{k}' is not a field here", { k: String(k) }));
  };
  const str = (path, v, what) => { if (!isStr(v)) err(path, "VALUE_INVALID", localize("jurisdictions.index.what_is_a_non_empty", "{what} is a non-empty string", { what: String(what) })); };
  const list = (path, v) => { if (!Array.isArray(v)) { err(path, "VALUE_INVALID", "a list"); return []; } return v; };
  const entry = (path, e) => { if (!isObj(e)) { err(path, "VALUE_INVALID", "an entry is an object"); return false; } return true; };

  /* systems first: floors and file numbers name their origins. */
  const origins = new Set();
  const noPathHosts = new Map();
  if (own(p, "systems")) list("systems", p.systems).forEach((s, i) => {
    const at = `systems[${i}]`;
    if (!entry(at, s)) return;
    fields(at, s, ["origin", "name", "hosts", "path", "links", "republishes", "provenance_stated", "basis"]);
    str(`${at}.origin`, s.origin, "origin");
    if (isStr(s.origin)) origins.add(s.origin);
    str(`${at}.name`, s.name, "name");
    if (!Array.isArray(s.hosts) || !s.hosts.length || !s.hosts.every((h) => isStr(h) && h === h.toLowerCase()))
      err(`${at}.hosts`, "VALUE_INVALID", "hosts is a non-empty list of lower-case host names");
    if (own(s, "path")) pattern(`${at}.path`, s.path);
    else if (Array.isArray(s.hosts)) for (const h of s.hosts) if (typeof h === "string") noPathHosts.set(h, at);
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
    if (!isStr(m.host) || m.host !== m.host.toLowerCase()) err(`${at}.host`, "VALUE_INVALID", "a lower-case host name");
    str(`${at}.why`, m.why, "why");
    if (typeof m.host === "string" && noPathHosts.has(m.host))
      err(`${at}.host`, "HOST_CONFLICT", localize("jurisdictions.index.host_is_mixed_and_also", "{host} is mixed and also in {get}, which has no path", { host: String(m.host), get: String(noPathHosts.get(m.host)) }));
    basis(at, m);
  });

  /* spaces */
  const spaceForms = {};
  if (own(p, "spaces")) {
    if (!isObj(p.spaces)) err("spaces", "VALUE_INVALID", "spaces is an object keyed by space");
    else for (const [name, s] of Object.entries(p.spaces)) {
      const at = `spaces.${name}`;
      if (!SPACES.includes(name)) { err(at, "UNKNOWN_SPACE", localize("jurisdictions.index.name_is_not_one_of", "'{name}' is not one of {SPACES}", { name: String(name), SPACES: String(SPACES.join(", ")) })); continue; }
      if (!entry(at, s)) continue;
      fields(at, s, name === "enactment" ? ["label", "forms", "kinds"] : ["label", "forms"]);
      str(`${at}.label`, s.label, "label");
      const names = new Set();
      spaceForms[name] = new Map();
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
            || (own(c, "strip") && (!Array.isArray(c.strip) || !c.strip.every((x) => compile(x))))
            || (own(c, "spaces") && !["remove", "collapse"].includes(c.spaces))
            || (own(c, "upper") && c.upper !== true);
          if (bad) { normalOk = false; err(`${fa}.clean`, "NORMAL_INVALID", "clean is {strip?: [pattern], spaces?: remove|collapse, upper?: true}"); }
        }
        basis(fa, f);
        if (isStr(f.form) && re && normalOk) spaceForms[name].set(f.form, f);
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
    if (!SPACES.includes(x.space)) err(`${at}.space`, "UNKNOWN_SPACE", localize("jurisdictions.index.string_is_not_a_space", "'{String}' is not a space", { String: String(String(x.space)) }));
    if (!own(x, "source") || x.source === "" || x.source == null) err(`${at}.source`, "CROSSWALK_UNSOURCED", "a crosswalk names the content hash of its capture");
    else if (typeof x.source !== "string" || !HEX64.test(x.source)) err(`${at}.source`, "VALUE_INVALID", "source is 64 hexadecimal characters");
    const known = spaceForms[x.space] || new Map();
    const forms = Array.isArray(x.forms) && x.forms.length === 2 ? x.forms : null;
    if (!forms) err(`${at}.forms`, "VALUE_INVALID", "forms is [a, b]");
    else forms.forEach((f, j) => { if (!known.has(f)) err(`${at}.forms[${j}]`, "CROSSWALK_FORM_UNKNOWN", localize("jurisdictions.index.the_space_has_no_form", "the space has no form '{String}'", { String: String(String(f)) })); });
    list(`${at}.pairs`, x.pairs).forEach((pair, j) => {
      if (!Array.isArray(pair) || pair.length !== 2 || !pair.every((v) => typeof v === "string")) {
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
  const variantOrgs = new Set(own(p, "vocabulary") && isObj(p.vocabulary) && Array.isArray(p.vocabulary.body_variants)
    ? p.vocabulary.body_variants.filter(isObj).map((v) => v.organisation).filter((o) => typeof o === "string" && KIND_RE.test(o)) : []);
  const variantOrg = (o) => typeof o === "string" && variantOrgs.has(o);
  /* The profile's action kinds, read first: a response status (R77), a legal fact (R79) and a procedure guide (R80) name
     them. */
  const profileKinds = new Set(own(p, "action_kinds") && Array.isArray(p.action_kinds)
    ? p.action_kinds.filter((k) => isObj(k) && typeof k.kind === "string" && KIND_RE.test(k.kind)).map((k) => k.kind) : []);
  if (own(p, "vocabulary")) {
    if (!isObj(p.vocabulary)) err("vocabulary", "VALUE_INVALID", "vocabulary is an object keyed by vocabulary key");
    else for (const [key, entries] of Object.entries(p.vocabulary)) {
      const at = `vocabulary.${key}`;
      if (!VOCABULARY.includes(key)) { err(at, "UNKNOWN_VOCABULARY", localize("jurisdictions.index.key_is_not_one_of", "'{key}' is not one of {VOCABULARY}", { key: String(key), VOCABULARY: String(VOCABULARY.join(", ")) })); continue; }
      const once = new Set(); /* R58, R60: a value, status or member type once in the profile */
      list(at, entries).forEach((e, i) => {
        const ea = `${at}[${i}]`;
        if (!entry(ea, e)) return;
        if (own(DATA_VOCABULARY, key)) {
          fields(ea, e, DATA_VOCABULARY[key]);
          const name = DATA_VOCABULARY[key][0];
          const v = e[name];
          /* R60 (K1729): a MemberType once per body-variant organisation, and once for all bodies */
          const k = key === "member_types" ? memberTypeKey(e) : v;
          if (key === "member_types" ? !isStr(v) : (typeof v !== "string" || !KIND_RE.test(v)))
            err(`${ea}.${name}`, "VALUE_INVALID", key === "member_types" ? "member_type is the MemberType as written, non-empty" : `${name} matches ^[a-z][a-z0-9_]*$`);
          else if (once.has(k)) err(`${ea}.${name}`, "VALUE_INVALID", key === "member_types"
            ? localize("jurisdictions.index.v_is_given_twice_v1", "'{v}' is given twice {v1}", { v: String(v), v1: String(own(e, "organisation") ? `for ${String(e.organisation)}` : "for all bodies") }) : localize("jurisdictions.index.v_is_given_twice", "'{v}' is given twice", { v: String(v) }));
          else once.add(k);
          if (key === "member_types") {
            if (!MEMBER_CAPACITIES.includes(e.capacity)) err(`${ea}.capacity`, "VALUE_INVALID", `capacity is ${MEMBER_CAPACITIES.join(" or ")}`);
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
          if (own(e, "copy") && !CODE_COPIES.includes(e.copy)) err(`${ea}.copy`, "COPY_UNKNOWN", localize("jurisdictions.index.copy_is_one_of_code", "copy is one of {CODE_COPIES}", { CODE_COPIES: String(CODE_COPIES.join(", ")) }));
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
              if (!Array.isArray(sc.markers) || !sc.markers.every((m) => SECTION_MARKERS.includes(m)))
                err(`${ea}.sections.markers`, "VALUE_INVALID", localize("jurisdictions.index.markers_is_the_order_of", "markers is the order of subsection markers, from {SECTION_MARKERS}", { SECTION_MARKERS: String(SECTION_MARKERS.join(", ")) }));
            }
          }
        } else if (key === "amending") {
          fields(ea, e, ["pattern", "relation", "basis"]);
          if (!AMENDING_RELATIONS.includes(e.relation)) err(`${ea}.relation`, "VALUE_INVALID", localize("jurisdictions.index.relation_is_one_of_amending", "relation is one of {AMENDING_RELATIONS}", { AMENDING_RELATIONS: String(AMENDING_RELATIONS.join(", ")) }));
        } else if (key === "meeting_markers") {
          fields(ea, e, ["marker", "pattern", "basis"]);
          if (!MEETING_MARKERS.includes(e.marker)) err(`${ea}.marker`, "VALUE_INVALID", localize("jurisdictions.index.marker_is_one_of_meeting", "marker is one of {MEETING_MARKERS}", { MEETING_MARKERS: String(MEETING_MARKERS.join(", ")) }));
        } else if (key === "body_variants") {
          fields(ea, e, ["pattern", "organisation", "basis"]);
          if (typeof e.organisation !== "string" || !KIND_RE.test(e.organisation))
            err(`${ea}.organisation`, "VALUE_INVALID", "organisation is a key matching ^[a-z][a-z0-9_]*$");
        } else if (key === "roster_words") {
          fields(ea, e, ["pattern", "kind", "basis"]);
          if (own(e, "kind") && !ROSTER_KINDS.includes(e.kind)) err(`${ea}.kind`, "VALUE_INVALID", localize("jurisdictions.index.kind_is_roster_kinds_absent", "kind is {ROSTER_KINDS} (absent: both)", { ROSTER_KINDS: String(ROSTER_KINDS.join(" or ")) }));
        } else if (key === "roster_headers") {
          fields(ea, e, ["role", "pattern", "basis"]);
          if (!ROSTER_ROLES.includes(e.role)) err(`${ea}.role`, "VALUE_INVALID", localize("jurisdictions.index.role_is_one_of_roster", "role is one of {ROSTER_ROLES}", { ROSTER_ROLES: String(ROSTER_ROLES.join(", ")) }));
        } else if (key === "policy_headers") {
          /* R69: a label a policy document prints in its header block, and the field it names */
          fields(ea, e, ["field", "pattern", "basis"]);
          if (!POLICY_HEADER_FIELDS.includes(e.field)) err(`${ea}.field`, "VALUE_INVALID", localize("jurisdictions.index.field_is_one_of_policy", "field is one of {POLICY_HEADER_FIELDS}", { POLICY_HEADER_FIELDS: String(POLICY_HEADER_FIELDS.join(", ")) }));
        } else if (key === "budget_headers") {
          fields(ea, e, ["column", "pattern", "basis"]);
          if (!BUDGET_COLUMNS.includes(e.column)) err(`${ea}.column`, "VALUE_INVALID", localize("jurisdictions.index.column_is_one_of_budget", "column is one of {BUDGET_COLUMNS}", { BUDGET_COLUMNS: String(BUDGET_COLUMNS.join(", ")) }));
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
          if (own(m, "closures") && !(own(p, "holidays") && Array.isArray(p.holidays) && p.holidays.some((h) => isObj(h) && h.list === m.closures)))
            err("practice.minutes_due_days.closures", "VALUE_INVALID", localize("jurisdictions.index.no_holidays_entry_of_this", "no holidays entry of this profile is in a list named '{String}'", { String: String(String(m.closures)) }));
          if (!isPosInt(m.value)) err("practice.minutes_due_days.value", "VALUE_INVALID", "a positive integer");
          if (own(m, "count") && !COUNTS.includes(m.count)) err("practice.minutes_due_days.count", "COUNT_UNKNOWN", "count is calendar or business");
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
  const lawNames = new Set();
  const lawResponses = [];
  if (own(p, "records_laws")) list("records_laws", p.records_laws).forEach((l, i) => {
    const at = `records_laws[${i}]`;
    if (!entry(at, l)) return;
    fields(at, l, ["level", "name", "citation", "stages", "requesters", "response", "basis"]);
    if (!LAW_LEVELS.includes(l.level)) err(`${at}.level`, "LEVEL_UNKNOWN", localize("jurisdictions.index.level_is_one_of_law", "level is one of {LAW_LEVELS}", { LAW_LEVELS: String(LAW_LEVELS.join(", ")) }));
    str(`${at}.name`, l.name, "name"); str(`${at}.citation`, l.citation, "citation");
    /* R76 (T45): the stages the law has, in its order, each a product stage name with the law's own term; a stage the
       law lacks is absent. Whether action-grammar knows a stage is that module's check. */
    if (own(l, "stages")) {
      const seen = new Set();
      if (!Array.isArray(l.stages) || !l.stages.length) err(`${at}.stages`, "VALUE_INVALID", "stages is a non-empty ordered list of {stage, label, citation}");
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
  /* R41; R74 (T45): a time zone, the profile's or an office's own. */
  const zone = (path, z) => {
    if (!isObj(z)) { err(path, "VALUE_INVALID", "time_zone is {value, status, basis}"); return; }
    fields(path, z, ["value", "status", "basis"]);
    if (!isTimeZone(z.value)) err(`${path}.value`, "VALUE_INVALID", "the value is an IANA time-zone name (Area/Location, or UTC)");
    statusBasis(path, z);
  };
  if (own(p, "time_zone")) zone("time_zone", p.time_zone);
  /* R82: an amount in R26's units */
  const amountOf = (path, a) => {
    if (!isObj(a) || Object.keys(a).some((k) => k !== "amount" && k !== "units") || !isPosInt(a.amount) || !UNITS.includes(a.units))
      err(path, "VALUE_INVALID", localize("jurisdictions.index.amount_is_amount_and_units", "an amount is {amount, units}, a positive integer of one of {units_list}", { units_list: UNITS.join(", ") }));
  };

  /* R46: how a day period is computed; R47: the named closure lists. Read first: rules name them. */
  const computationKeys = new Set();
  if (own(p, "computation")) list("computation", p.computation).forEach((c, i) => {
    const at = `computation[${i}]`;
    if (!entry(at, c)) return;
    fields(at, c, ["key", "rule", "citation", "status", "basis"]);
    if (typeof c.key !== "string" || !KIND_RE.test(c.key)) err(`${at}.key`, "VALUE_INVALID", "key matches ^[a-z][a-z0-9_]*$");
    else if (computationKeys.has(c.key)) err(`${at}.key`, "VALUE_INVALID", localize("jurisdictions.index.key_is_given_twice", "'{key}' is given twice", { key: String(c.key) }));
    else computationKeys.add(c.key);
    if (!COMPUTATION_RULES.includes(c.rule)) err(`${at}.rule`, "VALUE_INVALID", localize("jurisdictions.index.rule_is_one_of_computation", "rule is one of {COMPUTATION_RULES}", { COMPUTATION_RULES: String(COMPUTATION_RULES.join(", ")) }));
    str(`${at}.citation`, c.citation, "citation");
    statusBasis(at, c);
  });
  const closureLists = new Set(own(p, "holidays") && Array.isArray(p.holidays)
    ? p.holidays.filter((h) => isObj(h) && typeof h.list === "string" && KIND_RE.test(h.list)).map((h) => h.list) : []);
  if (own(p, "weekend")) {
    const w = p.weekend;
    if (!isObj(w)) err("weekend", "WEEKEND_INVALID", "weekend is {days, citation, status, basis}");
    else {
      fields("weekend", w, ["days", "citation", "status", "basis"]);
      if (!Array.isArray(w.days) || !w.days.length || !w.days.every((d) => WEEKDAYS.includes(d)) || new Set(w.days).size !== w.days.length)
        err("weekend.days", "WEEKEND_INVALID", localize("jurisdictions.index.days_is_a_non_empty", "days is a non-empty list of {WEEKDAYS}, each once", { WEEKDAYS: String(WEEKDAYS.join(", ")) }));
      else if (w.days.length === WEEKDAYS.length) err("weekend.days", "WEEKEND_INVALID", "a weekend leaves some day open");
      str("weekend.citation", w.citation, "citation");
      statusBasis("weekend", w);
    }
  }

  /* The action sections (R23–R26, R28, R31–R33, R35, R39–R44). */
  const codeKeys = new Set(own(p, "vocabulary") && isObj(p.vocabulary) && Array.isArray(p.vocabulary.codes)
    ? p.vocabulary.codes.filter(isObj).map((c) => c.key) : []);
  const families = new Set(); /* R63: a key and series.key once in the profile */
  if (own(p, "standard_sources")) list("standard_sources", p.standard_sources).forEach((s, i) => {
    const at = `standard_sources[${i}]`;
    if (!entry(at, s)) return;
    fields(at, s, ["source", "kind", "issuer", "sector", "level", "cite", "code", "key", "series", "normal", "basis"]);
    if (own(s, "key") && (typeof s.key !== "string" || !ID_RE.test(s.key))) err(`${at}.key`, "VALUE_INVALID", "key is an issuer's segment, matching ^[a-z0-9][a-z0-9-]*$");
    str(`${at}.source`, s.source, "source"); str(`${at}.issuer`, s.issuer, "issuer");
    if (isStr(s.source)) lawNames.add(s.source);
    if (!STANDARD_SOURCE_KINDS.includes(s.kind)) err(`${at}.kind`, "SOURCE_KIND_UNKNOWN", localize("jurisdictions.index.kind_is_one_of_standard", "kind is one of {STANDARD_SOURCE_KINDS}", { STANDARD_SOURCE_KINDS: String(STANDARD_SOURCE_KINDS.join(", ")) }));
    /* R31, R64 (T35-1): a statute, regulation, ordinance or court entry carries a law level; a policy, commitment or
       standard carries one only when its issuer is a government at one of the four, and otherwise its sector. An entry
       with a level reads sector government; a level beside another sector is refused. */
    const levelled = !["policy", "commitment", "standard"].includes(s.kind);
    if (own(s, "level") || levelled) {
      if (!LAW_LEVELS.includes(s.level)) err(`${at}.level`, "LEVEL_UNKNOWN", levelled && !own(s, "level")
        ? localize("jurisdictions.index.a_v1_entry_carries_a", "a {v1} entry carries a level, one of {LAW_LEVELS}", { v1: String(LEVELLED_KINDS.includes(s.kind) ? s.kind : "source"), LAW_LEVELS: String(LAW_LEVELS.join(", ")) })
        : localize("jurisdictions.index.level_is_one_of_law_2", "level is one of {LAW_LEVELS}", { LAW_LEVELS: String(LAW_LEVELS.join(", ")) }));
    }
    if (own(s, "sector")) {
      if (!SECTORS.includes(s.sector)) err(`${at}.sector`, "SECTOR_UNKNOWN", localize("jurisdictions.index.sector_is_one_of_sectors", "sector is one of {SECTORS}", { SECTORS: String(SECTORS.join(", ")) }));
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
  const roles = new Set();
  const bodies = new Set();
  const offices = new Set(); /* R75: a counterparty's role and body, a third party that starts a count */
  /* R59: the schemes an office's, a body's or its organisation's identifier may be in (R52's, read here: a scheme is
     judged where it is given). */
  const schemeKinds = new Map(own(p, "identifier_schemes") && Array.isArray(p.identifier_schemes)
    ? p.identifier_schemes.filter((x) => isObj(x) && isStr(x.scheme) && Array.isArray(x.entity_kinds)).map((x) => [x.scheme, x.entity_kinds]) : []);
  const identifier = (path, x, kind) => {
    if (!isObj(x)) { err(path, "SCHEME_INVALID", "an identifier is {scheme, id}"); return; }
    fields(path, x, ["scheme", "id"]);
    if (!schemeKinds.has(x.scheme)) err(`${path}.scheme`, "SCHEME_INVALID", localize("jurisdictions.index.no_identifier_scheme_of_this", "no identifier scheme of this profile is '{String}'", { String: String(String(x.scheme)) }));
    else if (!schemeKinds.get(x.scheme).includes(kind)) err(`${path}.scheme`, "SCHEME_INVALID", localize("jurisdictions.index.the_scheme_scheme_identifies_no", "the scheme {scheme} identifies no {kind}", { scheme: String(x.scheme), kind: String(kind) }));
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
        if (!Array.isArray(w.ids)) err(`${wa}.ids`, "VALUE_INVALID", "ids is a list of {scheme, id}, possibly empty");
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
    if (isStr(c.role) && isStr(c.body)) offices.add(`${c.role}\u0000${c.body}`);
    if (own(c, "hours")) hours(`${at}.hours`, c.hours);
    if (!COUNTERPARTY_LEVELS.includes(c.level)) err(`${at}.level`, "LEVEL_UNKNOWN", localize("jurisdictions.index.level_is_one_of_counterparty", "level is one of {COUNTERPARTY_LEVELS}", { COUNTERPARTY_LEVELS: String(COUNTERPARTY_LEVELS.join(", ")) }));
    if (typeof c.elected !== "boolean") err(`${at}.elected`, "VALUE_INVALID", "elected is true or false");
    if (own(c, "oversight") && typeof c.oversight !== "boolean") err(`${at}.oversight`, "VALUE_INVALID", "oversight is true or false");
    basis(at, c);
  });
  const kinds = new Set();
  const tier23 = new Set(); /* R78: the kinds a legal organisation may evaluate */
  const venueKinds = new Set();
  const templateIds = new Set();
  /* R40, R81, R87 (b): one template, attributed; in a kind's `templates` it also carries its purpose (judged by the
     caller), its name and the public sources it was written from. */
  const templateOf = (ta, t, k, inList) => {
    if (!isObj(t)) err(ta, "TEMPLATE_UNATTRIBUTED", localize("jurisdictions.index.a_template_is_fields_never_bare", "a template is {{fields}}, never bare text", { fields: TEMPLATE_FIELDS.join(", ") }));
    else {
      fields(ta, t, [...TEMPLATE_FIELDS, "name", "sources", ...(inList ? ["purpose"] : [])]);
      for (const f of TEMPLATE_FIELDS)
        if (!own(t, f) || t[f] === undefined || t[f] === null) err(`${ta}.${f}`, "TEMPLATE_UNATTRIBUTED", localize("jurisdictions.index.the_templates_f_is_missing", "the template's {f} is missing", { f: String(f) }));
      const bad = (f, why) => { if (own(t, f) && t[f] !== undefined && t[f] !== null) err(`${ta}.${f}`, "VALUE_INVALID", why); };
      if (!(typeof t.id === "string" && TEMPLATE_ID_RE.test(t.id))) bad("id", "id matches ^TPL-[a-z0-9][a-z0-9-]*$");
      else if (templateIds.has(t.id)) err(`${ta}.id`, "VALUE_INVALID", localize("jurisdictions.index.id_is_given_twice_in", "'{id}' is given twice in the profile", { id: String(t.id) }));
      else templateIds.add(t.id);
      if (!isPosInt(t.version)) bad("version", "version is a positive integer");
      if (!TEMPLATE_USES.includes(t.use)) bad("use", `use is ${TEMPLATE_USES.join(" or ")}`);
      if (!isStr(t.text)) bad("text", "the text is non-empty");
      if (typeof t.notes !== "string") bad("notes", "notes are text, possibly empty");
      if (!isStr(t.authored_by)) bad("authored_by", "authored_by is a non-empty name");
      if (!isStr(t.approved_by)) bad("approved_by", "approved_by is a non-empty name");
      else if (isStr(t.authored_by) && t.approved_by.trim() === t.authored_by.trim())
        err(`${ta}.approved_by`, "VALUE_INVALID", "the approver is not the template's author");
      if (!Array.isArray(t.contributors) || !t.contributors.every(isStr)) bad("contributors", "contributors is a list of names");
      if (!isDate(t.approved_at)) bad("approved_at", "approved_at is a real YYYY-MM-DD");
      if (!Array.isArray(t.reviews)) bad("reviews", "reviews is a list of {reviewer, kind, organisation?, credential?, scope, outcome, at}");
      else t.reviews.forEach((r, j) => {
        const ra = `${ta}.reviews[${j}]`;
        if (!isObj(r)) { err(ra, "VALUE_INVALID", "a review is {reviewer, kind, organisation?, credential?, scope, outcome, at}"); return; }
        fields(ra, r, [...REVIEW_REQUIRED, "organisation", "credential"]);
        for (const f of REVIEW_REQUIRED)
          if (!own(r, f) || r[f] === undefined || r[f] === null) err(`${ra}.${f}`, "TEMPLATE_UNATTRIBUTED", localize("jurisdictions.index.the_reviews_f_is_missing", "the review's {f} is missing", { f: String(f) }));
        const rbad = (f, ok, why) => { if (own(r, f) && r[f] !== undefined && r[f] !== null && !ok) err(`${ra}.${f}`, "VALUE_INVALID", why); };
        rbad("reviewer", isStr(r.reviewer), "the reviewer is a non-empty name");
        rbad("kind", REVIEW_KINDS.includes(r.kind), `kind is ${REVIEW_KINDS.join(" or ")}`);
        rbad("scope", isStr(r.scope), "the scope is non-empty text");
        rbad("outcome", REVIEW_OUTCOMES.includes(r.outcome), localize("jurisdictions.index.outcome_is_one_of_review", "outcome is one of {REVIEW_OUTCOMES}", { REVIEW_OUTCOMES: String(REVIEW_OUTCOMES.join(", ")) }));
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
      if (!isStr(t.name) || t.name.length > TEMPLATE_NAME_MAX || /[\r\n]/.test(t.name))
        err(`${ta}.name`, "VALUE_INVALID", localize("jurisdictions.index.name_is_a_title_of", "name is a title of at most {TEMPLATE_NAME_MAX} characters on one line", { TEMPLATE_NAME_MAX: String(TEMPLATE_NAME_MAX) }));
    }
    if (isObj(t) && (inList || own(t, "sources"))) {
      if (!Array.isArray(t.sources) || !t.sources.length) err(`${ta}.sources`, "VALUE_INVALID", localize("jurisdictions.index.sources_lists_one_public_source", "sources lists at least one public source, each with a citation"));
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
    if (own(k, "tier") && !TIERS.includes(k.tier)) err(`${at}.tier`, "TIER_INVALID", "tier is 1, 2 or 3");
    if (own(k, "laws")) list(`${at}.laws`, k.laws).forEach((l, j) => {
      if (!lawNames.has(l)) err(`${at}.laws[${j}]`, "LAW_UNKNOWN", localize("jurisdictions.index.no_records_laws_or_standard", "no records_laws or standard_sources entry is named '{String}'", { String: String(String(l)) }));
    });
    if (own(k, "venue")) {
      const v = k.venue;
      if (!isObj(v)) err(`${at}.venue`, "VALUE_INVALID", "a venue is {name, how, basis}");
      else {
        fields(`${at}.venue`, v, ["name", "how", "hours", "time_zone", "cutoff", "outages", "receipt", "facts", "basis"]);
        str(`${at}.venue.name`, v.name, "name");
        if (!VENUE_HOW.includes(v.how)) err(`${at}.venue.how`, "VALUE_INVALID", localize("jurisdictions.index.how_is_one_of_venue", "how is one of {VENUE_HOW}", { VENUE_HOW: String(VENUE_HOW.join(", ")) }));
        if (own(v, "hours")) hours(`${at}.venue.hours`, v.hours);
        if (own(v, "time_zone")) zone(`${at}.venue.time_zone`, v.time_zone); /* R74 */
        /* R82 (T45): the venue's sourced facts, each named once */
        if (own(v, "facts")) {
          const named = new Set();
          list(`${at}.venue.facts`, v.facts).forEach((f, j) => {
            const fa = `${at}.venue.facts[${j}]`;
            if (!entry(fa, f)) return;
            fields(fa, f, ["fact", "value", "amount", "citation", "status", "basis"]);
            if (!VENUE_FACTS.includes(f.fact)) err(`${fa}.fact`, "VALUE_INVALID", localize("jurisdictions.index.fact_is_one_of_venue", "fact is one of {VENUE_FACTS}", { VENUE_FACTS: String(VENUE_FACTS.join(", ")) }));
            else if (named.has(f.fact)) err(`${fa}.fact`, "VALUE_INVALID", localize("jurisdictions.index.fact_is_given_twice_for", "{fact} is given twice for this venue", { fact: String(f.fact) }));
            else named.add(f.fact);
            if (!isStr(f.value) || f.value.length > VENUE_FACT_MAX) err(`${fa}.value`, "VALUE_INVALID", localize("jurisdictions.index.value_is_text_of_at", "value is text of at most {VENUE_FACT_MAX} characters", { VENUE_FACT_MAX: String(VENUE_FACT_MAX) }));
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
      if (!Array.isArray(k.templates) || !k.templates.length) err(`${at}.templates`, "VALUE_INVALID", "templates is a non-empty list of templates");
      else {
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
    if (own(k, "shape") && !KIND_SHAPES.includes(k.shape)) err(`${at}.shape`, "KIND_INVALID", localize("jurisdictions.index.shape_is_one_of_kind", "shape is one of {KIND_SHAPES}", { KIND_SHAPES: String(KIND_SHAPES.join(", ")) }));
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
        else if (!isStr(ev.standard) || ev.standard.length > EVIDENCE_STANDARD_MAX)
          err(`${ea}.standard`, "VALUE_INVALID", localize("jurisdictions.index.the_standard_is_text_of", "the standard is text of at most {EVIDENCE_STANDARD_MAX} characters", { EVIDENCE_STANDARD_MAX: String(EVIDENCE_STANDARD_MAX) }));
        const grades = (path, v) => v.forEach((g, j) => {
          const ga = `${path}[${j}]`;
          if (!isObj(g)) { err(ga, "VALUE_INVALID", "an admitted grade is {grade, coattested?}"); return; }
          fields(ga, g, ["grade", "coattested"]);
          if (!BASIS_GRADES.includes(g.grade)) err(`${ga}.grade`, "GRADE_UNKNOWN", localize("jurisdictions.index.grade_is_one_of_basis", "grade is one of {BASIS_GRADES}", { BASIS_GRADES: String(BASIS_GRADES.join(", ")) }));
          if (own(g, "coattested") && typeof g.coattested !== "boolean") err(`${ga}.coattested`, "VALUE_INVALID", "coattested is true or false");
        });
        if (!own(ev, "accepts") || (Array.isArray(ev.accepts) && !ev.accepts.length))
          err(`${ea}.accepts`, "EVIDENCE_NO_STANDARD", "accepts lists at least one grade the venue admits");
        else if (!Array.isArray(ev.accepts)) err(`${ea}.accepts`, "VALUE_INVALID", "accepts is a list of {grade, coattested?}");
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
      if (!UNITS.includes(d.units)) err(`${at}.units`, "UNIT_UNKNOWN", localize("jurisdictions.index.units_is_one_of_units", "units is one of {UNITS}", { UNITS: String(UNITS.join(", ")) }));
      if (!isPosInt(d.amount)) err(`${at}.amount`, "VALUE_INVALID", "amount is a positive integer");
    }
    const units = legacy ? "days" : d.units;
    if (own(d, "count")) {
      if (!COUNTS.includes(d.count)) err(`${at}.count`, "COUNT_UNKNOWN", "count is calendar or business");
      else if (units !== "days") err(`${at}.count`, "UNIT_UNKNOWN", "count is given with units: days only");
    }
    if (own(d, "direction") && !DIRECTIONS.includes(d.direction)) err(`${at}.direction`, "DIRECTION_UNKNOWN", `direction is ${DIRECTIONS.join(" or ")}`);
    if (!STARTS.includes(d.starts)) err(`${at}.starts`, "ANCHOR_UNKNOWN", localize("jurisdictions.index.starts_is_one_of_starts", "starts is one of {STARTS}", { STARTS: String(STARTS.join(", ")) }));
    /* R75 (T45): a third party's act starts the count: the counterparty, by role and body, whose act it is */
    if (d.starts === "third_party") {
      const st = d.starter;
      if (!isObj(st) || Object.keys(st).some((k) => k !== "role" && k !== "body") || !offices.has(`${st.role}\u0000${st.body}`))
        err(`${at}.starter`, "ANCHOR_UNKNOWN", "a third_party start names its starter, {role, body} of a counterparty of this profile");
    } else if (own(d, "starter")) err(`${at}.starter`, "VALUE_INVALID", "a starter is given only with starts: third_party");
    /* R75: whose duty it is, and the law's stated consequence, quoted; R87 (c): a deadline the group meets in its own defence */
    if (own(d, "owed_by") && !OWED_BY.includes(d.owed_by)) err(`${at}.owed_by`, "VALUE_INVALID", `owed_by is ${OWED_BY.join(" or ")}`);
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
        if (!COUNTS.includes(x.count)) err(`${at}.extension.count`, "COUNT_UNKNOWN", "count is calendar or business");
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
    if (own(d, "applies_on") && (!Array.isArray(d.applies_on) || !d.applies_on.length
        || !d.applies_on.every((x) => WEEKDAYS.includes(x)) || new Set(d.applies_on).size !== d.applies_on.length))
      err(`${at}.applies_on`, "VALUE_INVALID", localize("jurisdictions.index.applies_on_is_a_non", "applies_on is a non-empty list of {WEEKDAYS}, each once", { WEEKDAYS: String(WEEKDAYS.join(", ")) }));
    if (own(d, "due_at") && d.due_at !== "close_of_business" && minutes(d.due_at) === null)
      err(`${at}.due_at`, "VALUE_INVALID", "due_at is close_of_business or HH:MM");
    str(`${at}.citation`, d.citation, "citation");
    statusBasis(at, d);
  });
  /* R96 (T51): a law's `response` is a deadline of this profile that applies to a records request */
  for (const r of lawResponses) {
    const hit = Array.isArray(p.deadlines) ? p.deadlines.find((d) => isObj(d) && d.rule === r.rule && d.applies_to === "records_request") : null;
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
    if (own(o, "evaluates") && !Array.isArray(o.evaluates)) err(`${at}.evaluates`, "VALUE_INVALID", "evaluates is a list of Tier 2 or 3 kinds");
    else if (Array.isArray(o.evaluates)) o.evaluates.forEach((k, j) => {
      if (!tier23.has(k)) err(`${at}.evaluates[${j}]`, "ORG_KIND_UNKNOWN", localize("jurisdictions.index.string_is_not_a_tier", "'{String}' is not a Tier 2 or 3 kind of this profile", { String: String(String(k)) }));
    });
    if (!(Array.isArray(o.evaluates) && o.evaluates.length) && o.defends !== true)
      err(`${at}.evaluates`, "ORG_PURPOSE_MISSING", "a legal organisation evaluates at least one Tier 2 or 3 kind, or defends a group (defends: true)");
    if (!Array.isArray(o.contacts) || !o.contacts.length) err(`${at}.contacts`, "CONTACT_INVALID", "contacts is a non-empty list of {how, value}");
    else o.contacts.forEach((c, j) => {
      const ca = `${at}.contacts[${j}]`;
      if (!isObj(c)) { err(ca, "CONTACT_INVALID", "a contact is {how, value}"); return; }
      fields(ca, c, ["how", "value"]);
      if (!CONTACT_HOW.includes(c.how)) err(`${ca}.how`, "CONTACT_INVALID", localize("jurisdictions.index.how_is_one_of_contact", "how is one of {CONTACT_HOW}", { CONTACT_HOW: String(CONTACT_HOW.join(", ")) }));
      if (!isStr(c.value)) err(`${ca}.value`, "CONTACT_INVALID", "the value is a non-empty string");
    });
    basis(at, o);
  });

  /* R33, R43: a year once for all offices and once for each distinct `offices` list. */
  if (own(p, "holidays")) {
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
        if (!Array.isArray(h.offices) || !h.offices.length) {
          err(`${at}.offices`, "HOLIDAY_INVALID", "offices is a non-empty list of roles or {venue: <kind>}");
          key = `\u0002${i}`; /* no list to key by: judged on its own */
        }
        else {
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
      else if (years.has(`${h.year}\u0000${key}`)) err(`${at}.year`, "HOLIDAY_INVALID",
        own(h, "list")
          ? (own(h, "offices")
            ? localize("jurisdictions.index.year_listed_twice_for_list_and_the_same_offices", "{year} is listed twice for the list {list} and the same offices", { year: String(h.year), list: String(h.list) })
            : localize("jurisdictions.index.year_listed_twice_for_list_and_all_offices", "{year} is listed twice for the list {list} and all offices", { year: String(h.year), list: String(h.list) }))
          : own(h, "offices")
            ? localize("jurisdictions.index.year_listed_twice_for_the_same_offices", "{year} is listed twice for the same offices", { year: String(h.year) })
            : localize("jurisdictions.index.year_listed_twice_for_all_offices", "{year} is listed twice for all offices", { year: String(h.year) }));
      else years.add(`${h.year}\u0000${key}`);
      const dates = new Set();
      list(`${at}.days`, h.days).forEach((d, j) => {
        const da = `${at}.days[${j}]`;
        if (!entry(da, d)) return;
        fields(da, d, ["date", "name"]);
        if (!isDate(d.date)) err(`${da}.date`, "HOLIDAY_INVALID", "a date is a real YYYY-MM-DD");
        else if (isYear(h.year) && Number(d.date.slice(0, 4)) !== h.year) err(`${da}.date`, "HOLIDAY_INVALID", `${d.date} is outside ${h.year}`);
        else if (dates.has(d.date)) err(`${da}.date`, "HOLIDAY_INVALID", localize("jurisdictions.index.date_is_given_twice", "{date} is given twice", { date: String(d.date) }));
        else dates.add(d.date);
        str(`${da}.name`, d.name, "name");
      });
      statusBasis(at, h);
    });
  }

  /* R49: a fiscal year per body that keeps one. */
  if (own(p, "fiscal_year")) {
    const seen = new Set();
    list("fiscal_year", p.fiscal_year).forEach((f, i) => {
      const at = `fiscal_year[${i}]`;
      if (!entry(at, f)) return;
      fields(at, f, ["body", "start", "named_by", "label", "status", "basis"]);
      if (f.body !== "*" && !bodies.has(f.body)) err(`${at}.body`, "FISCAL_YEAR_INVALID", `body is a counterparty body of this profile, or * for every body`);
      else if (seen.has(f.body)) err(`${at}.body`, "FISCAL_YEAR_INVALID", localize("jurisdictions.index.body_keeps_one_fiscal_year", "{body} keeps one fiscal year", { body: String(f.body) }));
      else seen.add(f.body);
      if (!isMonthDay(f.start)) err(`${at}.start`, "FISCAL_YEAR_INVALID", "start is the first day, MM-DD");
      if (!FISCAL_NAMED_BY.includes(f.named_by)) err(`${at}.named_by`, "FISCAL_YEAR_INVALID", `named_by is ${FISCAL_NAMED_BY.join(" or ")}`);
      if (!isStr(f.label) || !FISCAL_PLACEHOLDERS.some((x) => f.label.includes(x))
          || (f.label.match(/\{[^}]*\}/g) || []).some((x) => !FISCAL_PLACEHOLDERS.includes(x)))
        err(`${at}.label`, "FISCAL_YEAR_INVALID", localize("jurisdictions.index.label_is_a_template_using", "label is a template using {FISCAL_PLACEHOLDERS}", { FISCAL_PLACEHOLDERS: String(FISCAL_PLACEHOLDERS.join(", ")) }));
      statusBasis(at, f);
    });
  }

  /* R50: the rank of a source kind at a law level, and the instrument key's first segment. */
  if (own(p, "law_ranks")) {
    const seen = new Set();
    list("law_ranks", p.law_ranks).forEach((r, i) => {
      const at = `law_ranks[${i}]`;
      if (!entry(at, r)) return;
      fields(at, r, ["kind", "level", "rank", "basis"]);
      if (!STANDARD_SOURCE_KINDS.includes(r.kind)) err(`${at}.kind`, "RANK_INVALID", localize("jurisdictions.index.kind_is_one_of_standard_2", "kind is one of {STANDARD_SOURCE_KINDS}", { STANDARD_SOURCE_KINDS: String(STANDARD_SOURCE_KINDS.join(", ")) }));
      if (!LAW_LEVELS.includes(r.level)) err(`${at}.level`, "RANK_INVALID", localize("jurisdictions.index.level_is_one_of_law_3", "level is one of {LAW_LEVELS}", { LAW_LEVELS: String(LAW_LEVELS.join(", ")) }));
      if (!isPosInt(r.rank)) err(`${at}.rank`, "RANK_INVALID", "rank is a positive integer, 1 the highest");
      const k = `${r.kind}\u0000${r.level}`;
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
  const proceedingKinds = new Set();
  if (own(p, "proceeding_kinds")) list("proceeding_kinds", p.proceeding_kinds).forEach((k, i) => {
    const at = `proceeding_kinds[${i}]`;
    if (!entry(at, k)) return;
    fields(at, k, ["kind", "label", "forum_kind", "basis"]);
    if (typeof k.kind !== "string" || !KIND_RE.test(k.kind)) err(`${at}.kind`, "KIND_INVALID", "kind matches ^[a-z][a-z0-9_]*$");
    else if (proceedingKinds.has(k.kind)) err(`${at}.kind`, "DUPLICATE_KIND", localize("jurisdictions.index.kind_is_given_twice_2", "'{kind}' is given twice", { kind: String(k.kind) }));
    else proceedingKinds.add(k.kind);
    str(`${at}.label`, k.label, "label");
    if (!FORUM_KINDS.includes(k.forum_kind)) err(`${at}.forum_kind`, "VALUE_INVALID", localize("jurisdictions.index.forum_kind_is_one_of", "forum_kind is one of {FORUM_KINDS}", { FORUM_KINDS: String(FORUM_KINDS.join(", ")) }));
    basis(at, k);
  });
  if (own(p, "proceeding_flows")) {
    const flowed = new Set();
    list("proceeding_flows", p.proceeding_flows).forEach((f, i) => {
      const at = `proceeding_flows[${i}]`;
      if (!entry(at, f)) return;
      fields(at, f, ["kind", "stages", "citation", "basis"]);
      if (!proceedingKinds.has(f.kind)) err(`${at}.kind`, "FLOW_INVALID", localize("jurisdictions.index.string_is_no_kind_of_2", "'{String}' is no kind of proceeding_kinds", { String: String(String(f.kind)) }));
      else if (flowed.has(f.kind)) err(`${at}.kind`, "FLOW_INVALID", localize("jurisdictions.index.kind_has_one_flow", "{kind} has one flow", { kind: String(f.kind) }));
      else flowed.add(f.kind);
      if (!Array.isArray(f.stages) || !f.stages.length) err(`${at}.stages`, "FLOW_INVALID", "stages is a non-empty ordered list of {stage, label, reached_by}");
      else {
        const stages = new Set();
        f.stages.forEach((st, j) => {
          const sa = `${at}.stages[${j}]`;
          if (!isObj(st)) { err(sa, "FLOW_INVALID", "a stage is {stage, label, reached_by}"); return; }
          fields(sa, st, ["stage", "label", "reached_by"]);
          if (typeof st.stage !== "string" || !KIND_RE.test(st.stage)) err(`${sa}.stage`, "FLOW_INVALID", "stage matches ^[a-z][a-z0-9_]*$");
          else if (stages.has(st.stage)) err(`${sa}.stage`, "FLOW_INVALID", localize("jurisdictions.index.the_stage_stage_is_given_2", "the stage {stage} is given twice", { stage: String(st.stage) }));
          else stages.add(st.stage);
          if (!isStr(st.label)) err(`${sa}.label`, "FLOW_INVALID", "a stage has a label");
          if (!Array.isArray(st.reached_by) || !st.reached_by.length || !st.reached_by.every((e) => typeof e === "string" && KIND_RE.test(e)))
            err(`${sa}.reached_by`, "FLOW_INVALID", "reached_by is a non-empty list of event kinds");
        });
      }
      str(`${at}.citation`, f.citation, "citation");
      basis(at, f);
    });
  }

  /* R52: the schemes a registry identifier is in, and the codes a budget or ledger classifies by. */
  if (own(p, "identifier_schemes")) {
    const seen = new Set();
    list("identifier_schemes", p.identifier_schemes).forEach((x, i) => {
      const at = `identifier_schemes[${i}]`;
      if (!entry(at, x)) return;
      fields(at, x, ["scheme", "label", "entity_kinds", "space", "form", "systems", "basis"]);
      if (!isStr(x.scheme)) err(`${at}.scheme`, "SCHEME_INVALID", "scheme is a non-empty name");
      else if (seen.has(x.scheme)) err(`${at}.scheme`, "SCHEME_INVALID", localize("jurisdictions.index.scheme_is_given_twice", "{scheme} is given twice", { scheme: String(x.scheme) }));
      else seen.add(x.scheme);
      str(`${at}.label`, x.label, "label");
      if (!Array.isArray(x.entity_kinds) || !x.entity_kinds.length || !x.entity_kinds.every((k) => typeof k === "string" && KIND_RE.test(k)))
        err(`${at}.entity_kinds`, "SCHEME_INVALID", "entity_kinds is a non-empty list of entity kinds");
      if (!spaceForms[x.space]) err(`${at}.space`, "SCHEME_INVALID", localize("jurisdictions.index.this_profile_has_no_space", "this profile has no space '{String}'", { String: String(String(x.space)) }));
      else if (own(x, "form") && !spaceForms[x.space].has(x.form)) err(`${at}.form`, "SCHEME_INVALID", localize("jurisdictions.index.the_space_space_has_no", "the space {space} has no form '{String}'", { space: String(x.space), String: String(String(x.form)) }));
      if (own(x, "systems")) {
        if (!Array.isArray(x.systems)) err(`${at}.systems`, "SCHEME_INVALID", "systems is a list of origins");
        else x.systems.forEach((o, j) => { if (!origins.has(o)) err(`${at}.systems[${j}]`, "SCHEME_INVALID", localize("jurisdictions.index.no_system_of_this_profile_3", "no system of this profile has origin '{String}'", { String: String(String(o)) })); });
      }
      basis(at, x);
    });
  }
  if (own(p, "classification_schemes")) {
    const seen = new Set();
    list("classification_schemes", p.classification_schemes).forEach((x, i) => {
      const at = `classification_schemes[${i}]`;
      if (!entry(at, x)) return;
      fields(at, x, ["scheme", "label", "kind", "codes", "forms", "basis"]);
      if (own(x, "forms")) {
        if (!Array.isArray(x.forms) || !x.forms.length) err(`${at}.forms`, "SCHEME_INVALID", "forms is a non-empty list of patterns");
        else x.forms.forEach((f, j) => { if (!compile(f)) err(`${at}.forms[${j}]`, "SCHEME_INVALID", "a form is a pattern {re, flags?}"); });
      }
      if (!isStr(x.scheme)) err(`${at}.scheme`, "SCHEME_INVALID", "scheme is a non-empty name");
      else if (seen.has(x.scheme)) err(`${at}.scheme`, "SCHEME_INVALID", localize("jurisdictions.index.scheme_is_given_twice_2", "{scheme} is given twice", { scheme: String(x.scheme) }));
      else seen.add(x.scheme);
      str(`${at}.label`, x.label, "label");
      if (!CLASSIFICATION_KINDS.includes(x.kind)) err(`${at}.kind`, "SCHEME_INVALID", localize("jurisdictions.index.kind_is_one_of_classification", "kind is one of {CLASSIFICATION_KINDS}", { CLASSIFICATION_KINDS: String(CLASSIFICATION_KINDS.join(", ")) }));
      if (own(x, "codes")) {
        if (!Array.isArray(x.codes)) err(`${at}.codes`, "SCHEME_INVALID", "codes is a list of {code, label}");
        else {
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
    const seen = new Set();
    list("lawful_demands", p.lawful_demands).forEach((d, i) => {
      const at = `lawful_demands[${i}]`;
      if (!entry(at, d)) return;
      fields(at, d, ["kind", "label", "covers", "within", "citation", "status", "basis"]);
      if (typeof d.kind !== "string" || !KIND_RE.test(d.kind)) err(`${at}.kind`, "DEMAND_INVALID", "kind matches ^[a-z][a-z0-9_]*$");
      else if (seen.has(d.kind)) err(`${at}.kind`, "DEMAND_INVALID", localize("jurisdictions.index.kind_is_given_twice_3", "'{kind}' is given twice", { kind: String(d.kind) }));
      else seen.add(d.kind);
      str(`${at}.label`, d.label, "label");
      if (!Array.isArray(d.covers) || !d.covers.length || !d.covers.every((c) => DEMAND_COVERS.includes(c)) || new Set(d.covers).size !== d.covers.length)
        err(`${at}.covers`, "DEMAND_INVALID", localize("jurisdictions.index.covers_is_a_non_empty", "covers is a non-empty list from {DEMAND_COVERS}", { DEMAND_COVERS: String(DEMAND_COVERS.join(", ")) }));
      const w = d.within;
      if (!isObj(w) || Object.keys(w).some((k) => k !== "amount" && k !== "units") || !isPosInt(w.amount) || !UNITS.includes(w.units))
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
    const seen = new Set();
    list("legal_facts", p.legal_facts).forEach((f, i) => {
      const at = `legal_facts[${i}]`;
      if (!entry(at, f)) return;
      fields(at, f, ["key", "trigger", "statement", "citation", "threshold", "applies_to", "status", "basis"]);
      if (typeof f.key !== "string" || !KIND_RE.test(f.key)) err(`${at}.key`, "VALUE_INVALID", "key matches ^[a-z][a-z0-9_]*$");
      else if (seen.has(f.key)) err(`${at}.key`, "VALUE_INVALID", localize("jurisdictions.index.key_is_given_twice_2", "'{key}' is given twice", { key: String(f.key) }));
      else seen.add(f.key);
      if (!LEGAL_FACT_TRIGGERS.includes(f.trigger)) err(`${at}.trigger`, "TRIGGER_UNKNOWN", localize("jurisdictions.index.trigger_is_one_of_legal", "trigger is one of {LEGAL_FACT_TRIGGERS}", { LEGAL_FACT_TRIGGERS: String(LEGAL_FACT_TRIGGERS.join(", ")) }));
      str(`${at}.statement`, f.statement, "statement"); str(`${at}.citation`, f.citation, "citation");
      if (own(f, "threshold")) {
        const t = f.threshold;
        if (!isObj(t) || Object.keys(t).some((k) => k !== "amount" && k !== "unit") || typeof t.amount !== "number"
            || !Number.isFinite(t.amount) || t.amount <= 0 || !isStr(t.unit))
          err(`${at}.threshold`, "VALUE_INVALID", "threshold is {amount, unit}, a positive amount and its unit");
      }
      if (own(f, "applies_to")) {
        if (!Array.isArray(f.applies_to) || !f.applies_to.length) err(`${at}.applies_to`, "VALUE_INVALID", "applies_to is a non-empty list of kinds");
        else f.applies_to.forEach((k, j) => { if (!profileKinds.has(k)) err(`${at}.applies_to[${j}]`, "VALUE_INVALID", localize("jurisdictions.index.string_is_no_kind_of_3", "'{String}' is no kind of this profile", { String: String(String(k)) })); });
      }
      statusBasis(at, f);
    });
  }

  /* R80 (T45): one sourced procedure guide per kind, its items in the profile's order and never ranked; R87 (d): an item
     may name the correspondence outcomes after which its route applies. */
  if (own(p, "procedure_guides")) {
    const guided = new Set();
    list("procedure_guides", p.procedure_guides).forEach((g, i) => {
      const at = `procedure_guides[${i}]`;
      if (!entry(at, g)) return;
      fields(at, g, ["kind", "items", "status", "basis"]);
      if (!profileKinds.has(g.kind)) err(`${at}.kind`, "KIND_INVALID", localize("jurisdictions.index.string_is_no_kind_of_4", "'{String}' is no kind of this profile", { String: String(String(g.kind)) }));
      else if (guided.has(g.kind)) err(`${at}.kind`, "VALUE_INVALID", localize("jurisdictions.index.kind_has_one_guide", "{kind} has one guide", { kind: String(g.kind) }));
      else guided.add(g.kind);
      if (!Array.isArray(g.items) || !g.items.length) err(`${at}.items`, "VALUE_INVALID", "items is a non-empty list of {route, expect?, citation, after?}");
      else g.items.forEach((it, j) => {
        const ia = `${at}.items[${j}]`;
        if (!entry(ia, it)) return;
        fields(ia, it, ["route", "expect", "citation", "after"]);
        str(`${ia}.route`, it.route, "route");
        if (own(it, "expect")) str(`${ia}.expect`, it.expect, "expect");
        str(`${ia}.citation`, it.citation, "citation");
        if (own(it, "after") && (!Array.isArray(it.after) || !it.after.length
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
    if (!PHRASING_KINDS.includes(x.kind)) err(`${at}.kind`, "KIND_INVALID", localize("jurisdictions.index.kind_is_one_of_phrasing", "kind is one of {PHRASING_KINDS}", { PHRASING_KINDS: String(PHRASING_KINDS.join(", ")) }));
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
    if (!POINTER_KINDS.includes(x.kind)) err(`${at}.kind`, "KIND_INVALID", localize("jurisdictions.index.kind_is_one_of_pointer", "kind is one of {POINTER_KINDS}", { POINTER_KINDS: String(POINTER_KINDS.join(", ")) }));
    if (!isStr(x.name) || x.name.length > POINTER_NAME_MAX || /[\r\n]/.test(x.name))
      err(`${at}.name`, "VALUE_INVALID", localize("jurisdictions.index.name_is_the_bodys_own", "name is the body's own name, 1 to {POINTER_NAME_MAX} characters on one line", { POINTER_NAME_MAX: String(POINTER_NAME_MAX) }));
    if (!isStr(x.does) || x.does.length > POINTER_DOES_MAX)
      err(`${at}.does`, "VALUE_INVALID", localize("jurisdictions.index.does_says_what_the_body", "does says what the body does and for whom, 1 to {POINTER_DOES_MAX} characters", { POINTER_DOES_MAX: String(POINTER_DOES_MAX) }));
    if (!Array.isArray(x.contacts) || !x.contacts.length) err(`${at}.contacts`, "CONTACT_INVALID", "contacts is a non-empty list of {how, value}");
    else x.contacts.forEach((c, j) => {
      const ca = `${at}.contacts[${j}]`;
      if (!isObj(c)) { err(ca, "CONTACT_INVALID", "a contact is {how, value}"); return; }
      fields(ca, c, ["how", "value"]);
      if (!POINTER_HOW.includes(c.how)) err(`${ca}.how`, "CONTACT_INVALID", localize("jurisdictions.index.how_is_one_of_pointer", "how is one of {POINTER_HOW}", { POINTER_HOW: String(POINTER_HOW.join(", ")) }));
      if (!isStr(c.value)) err(`${ca}.value`, "CONTACT_INVALID", "the value is a non-empty string");
    });
    if (own(x, "hours")) hours(`${at}.hours`, x.hours);
    if (own(x, "languages")) {
      if (!Array.isArray(x.languages) || !x.languages.length) err(`${at}.languages`, "LOCALE_INVALID", "languages is a non-empty list of language tags");
      else x.languages.forEach((l, j) => { if (!isLocale(l)) err(`${at}.languages[${j}]`, "LOCALE_INVALID", "a language is one well-formed BCP 47 tag"); });
    }
    if (!own(x, "source") || x.source === undefined || x.source === null || x.source === "")
      err(`${at}.source`, "SOURCE_MISSING", "a pointer names the page it was read from, by address or citation");
    else str(`${at}.source`, x.source, "source");
    if (x.status !== "researched") err(`${at}.status`, "BASIS_INVALID", "a pointer's status is researched: it is read on the body's own page");
    if (basis(at, x) && !(test && x.basis === "TEST")
        && !basisParts(x.basis).every((b) => { const m = DATED_REF.exec(b); return !!m && isDate(m[1]); }))
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
      if (!Array.isArray(h.extension_reasons) || !h.extension_reasons.length) err(`${at}.extension_reasons`, "VALUE_INVALID", "extension_reasons is a non-empty list of {reason, citation}");
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
      if (basis(at, h) && !(test && h.basis === "TEST") && !basisParts(h.basis).every((b) => { const m = DATED_REF.exec(b); return !!m && isDate(m[1]); }))
        err(`${at}.basis`, "BASIS_INVALID", "records_help rests on the day the text was read, a dated entry YYYY-MM-DD");
    }
  }

  /* R94 (T50): the courts and other forums of the place, each once. `ids` are its identifiers in a scheme of the profile. */
  if (own(p, "forums")) {
    const seen = new Set();
    list("forums", p.forums).forEach((f, i) => {
      const at = `forums[${i}]`;
      if (!entry(at, f)) return;
      fields(at, f, ["label", "forum_kind", "ids", "basis"]);
      str(`${at}.label`, f.label, "label");
      if (!FORUM_KINDS.includes(f.forum_kind)) err(`${at}.forum_kind`, "VALUE_INVALID", localize("jurisdictions.index.forum_kind_is_one_of_2", "forum_kind is one of {FORUM_KINDS}", { FORUM_KINDS: String(FORUM_KINDS.join(", ")) }));
      if (isStr(f.label)) {
        const k = `${f.forum_kind}\u0000${f.label}`;
        if (seen.has(k)) err(`${at}.label`, "VALUE_INVALID", localize("jurisdictions.index.the_forum_label_is_given", "the forum '{label}' is given twice", { label: String(f.label) }));
        seen.add(k);
      }
      if (own(f, "ids")) {
        if (!Array.isArray(f.ids) || !f.ids.length) err(`${at}.ids`, "VALUE_INVALID", "ids is a non-empty list of {scheme, id}");
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
    const seen = new Set();
    list("local_names", p.local_names).forEach((n, i) => {
      const at = `local_names[${i}]`;
      if (!entry(at, n)) return;
      fields(at, n, ["name", "kind", "explanations", "translations", "basis"]);
      str(`${at}.name`, n.name, "name");
      if (!LOCAL_NAME_KINDS.includes(n.kind)) err(`${at}.kind`, "KIND_INVALID", localize("jurisdictions.index.kind_is_one_of_local", "kind is one of {LOCAL_NAME_KINDS}", { LOCAL_NAME_KINDS: String(LOCAL_NAME_KINDS.join(", ")) }));
      else if (isStr(n.name)) {
        const k = `${n.name}\u0000${n.kind}`;
        if (seen.has(k)) err(`${at}.name`, "VALUE_INVALID", localize("jurisdictions.index.the_kind_name_is_given", "the {kind} '{name}' is given twice", { kind: String(n.kind), name: String(n.name) }));
        seen.add(k);
      }
      for (const [f, extra] of [["explanations", []], ["translations", ["source"]]]) {
        if (!own(n, f)) continue;
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
            if (basis(xa, x) && !(test && x.basis === "TEST") && !basisParts(x.basis).every((b) => MEASUREMENT_REF.test(b)))
              err(`${xa}.basis`, "BASIS_INVALID", "an official translation rests on a measurement of its publication (M-<n> or a dated entry)");
          } else basis(xa, x);
        });
      }
      basis(at, n);
    });
  }
}

/* Why an RRULE is outside civil-time's subset (its R20), or null. `EXDATE` is a property of its own, not a part. */
const BYDAY_RE = /^(?:[+-]?(?:[1-9]|[1-4]\d|5[0-3]))?(?:MO|TU|WE|TH|FR|SA|SU)$/;
function rruleFault(v) {
  if (typeof v !== "string" || !v.trim()) return "rrule is a non-empty RFC 5545 rule";
  const parts = new Map();
  for (const kv of v.replace(/^RRULE:/, "").split(";")) {
    const m = /^([A-Z]+)=(.+)$/.exec(kv);
    if (!m) return `'${kv}' is not NAME=value`;
    if (!RRULE_PARTS.includes(m[1])) return localize("jurisdictions.index.v1_is_outside_civil_times", "{v1} is outside civil-time's subset ({RRULE_PARTS})", { v1: String(m[1]), RRULE_PARTS: String(RRULE_PARTS.join(", ")) });
    if (parts.has(m[1])) return localize("jurisdictions.index.v1_is_given_twice", "{v1} is given twice", { v1: String(m[1]) });
    parts.set(m[1], m[2]);
  }
  if (!RRULE_FREQS.includes(parts.get("FREQ"))) return localize("jurisdictions.index.freq_is_one_of_rrule", "FREQ is one of {RRULE_FREQS}", { RRULE_FREQS: String(RRULE_FREQS.join(", ")) });
  const ints = (x, lo, hi) => x.split(",").every((n) => /^[+-]?\d+$/.test(n) && Math.abs(Number(n)) >= lo && Math.abs(Number(n)) <= hi);
  if (parts.has("INTERVAL") && !/^[1-9]\d*$/.test(parts.get("INTERVAL"))) return "INTERVAL is a positive integer";
  if (parts.has("BYDAY") && !parts.get("BYDAY").split(",").every((d) => BYDAY_RE.test(d))) return "BYDAY lists days, each with an optional ordinal";
  if (parts.has("BYMONTHDAY") && !ints(parts.get("BYMONTHDAY"), 1, 31)) return "BYMONTHDAY lists days of the month";
  if (parts.has("BYSETPOS") && !ints(parts.get("BYSETPOS"), 1, 366)) return "BYSETPOS lists positions";
  if (parts.has("UNTIL") && !/^\d{8}(?:T\d{6}Z?)?$/.test(parts.get("UNTIL"))) return "UNTIL is a date or date-time";
  return null;
}

/* R60: a MemberType entry's key, its type and the body it is for ("" for all bodies). */
const memberTypeKey = (e) => `${isObj(e) ? String(e.member_type) : ""}\u0000${isObj(e) && typeof e.organisation === "string" ? e.organisation : ""}`;

/* An office a holiday entry names, as a key: a counterparty role or a kind's venue (R43). */
function officeKey(o) {
  if (typeof o === "string") return `role:${o}`;
  if (isObj(o) && typeof o.venue === "string") return `venue:${o.venue}`;
  return `?:${JSON.stringify(o)}`;
}
/* The closure list a holiday entry belongs to ("" for the office calendar, R47). */
const listKey = (h) => (isObj(h) && typeof h.list === "string" ? h.list : "");
/* The key of an `offices` list: its offices, in no order ("" for every office). */
const officesKey = (offices) => (Array.isArray(offices) ? [...new Set(offices.map(officeKey))].sort().join("\u0001") : "");

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
