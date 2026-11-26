/* The profile's shape and the readers `validate` and `combine` share (R1–R7, R23–R26, R31–R33, R39–R44 and the later
 * tranches' additions). Moved unchanged from `index.mjs`, the module's interface file, which re-exports what is public. */
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

export { DATA_VOCABULARY, LEVELLED_KINDS, FISCAL_PLACEHOLDERS, RRULE_FREQS, POINTER_HOW, POINTER_NAME_MAX, EVIDENCE_STANDARD_MAX, VENUE_FACT_MAX, TEMPLATE_NAME_MAX, PHRASE_MIN, REVIEW_REQUIRED, ID_RE, KIND_RE, HEX64, DATE_RE, TEMPLATE_ID_RE, HHMM_RE, MMDD_RE, INSTANT_RE, LOCAL_DT_RE, TZ_RE, BASIS_REF, MEASUREMENT_REF, RULING_REF, K_REF, DATED_REF, basisParts, isObj, isStr, isPosInt, own, isYear, isDate, isTimeZone, instant, isLocalDateTime, isMonthDay, minutes, localeKey, compile, groupCount, groupNames, applyForm, memberTypeKey, officeKey, listKey, officesKey, POINTER_DOES_MAX, PHRASE_MAX };
