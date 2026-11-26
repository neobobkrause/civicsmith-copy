/* jurisdictions, T33 (T33-2): the widened rule data (R26), the calendar facts, closure lists and practice beside the
 * rule (R46–R48), fiscal years, law, proceedings, schemes, lawful demands and recurrences (R49–R54), how they combine
 * (R55), the first sourced rule set (R56) and the test profile and worked fixtures (R57); with the T33 amendments of
 * R3, R6, R7, R21, R28, R30 and R44. Tested at the module's interface: validate, combine, get. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validate, combine, SECTIONS } from "../index.mjs";
import { isObj, isList, listOr } from "../shared.mjs";
import { walkFacts, must, held, viewOf, combinedOf, loose, at, put, pick } from "./helpers.mjs";
import { FIXTURES, OMC_48, BROWN_72 } from "./fixtures/time-law.mjs";
import { FACTS } from "./fixtures/actions-law.mjs";
/** @import { Profile, View, Validation, SpaceName, Weekday, Pattern, Deadline, Holiday, Venue, ViewVenue, ViewDeadline, ViewMinutesDue } from "../index.mjs" */
/** @import { Fields, Value } from "../shared.mjs" */

const FIRST = "oakland-alameda";
const TEST = "test-port-ellery";
/** @param {Validation} r @param {string} code @param {string} [path] @returns {boolean} */
const hasError = (r, code, path) => r.errors.some((e) => e.code === code && (path == null || e.path === path));
/* The test profile carries every T33 section; a case breaks one field of a fresh copy. */
/** @param {(p: Fields) => void} fn @returns {Validation} */
const breakT = (fn) => { const p = loose(held(TEST)); fn(p); return validate(p); };
/** @param {(p: Fields) => void} fn @returns {Validation} */
const breakF = (fn) => { const p = loose(held(FIRST)); fn(p); return validate(p); };
/** @param {(p: Fields) => void} fn @returns {Fields} */
const other = (fn) => { const p = loose(held(TEST)); p.id = "test-other"; p.name = "Other (test)"; p.covers = ["Other"]; fn(p); return p; };
/** A loose copy's deadline with that rule. @param {Fields} p @param {string} rule @returns {Fields} */
const dl = (p, rule) => pick(p, "deadlines", "rule", rule);
/** A loose copy's records-request venue. @param {Fields} p @returns {Fields} */
const venue = (p) => at(pick(p, "action_kinds", "kind", "records_request"), "venue");
/** @param {object} o @param {string} k @returns {boolean} */
const own = (o, k) => Object.hasOwn(o, k);

/** A held profile's deadline with that rule. @param {Profile} p @param {string} rule @returns {Deadline} */
const ruleOf = (p, rule) => must(must(p.deadlines, "deadlines").find((d) => d.rule === rule), `deadline ${rule}`);
/** A held profile's records-request venue. @param {Profile} p @returns {Venue} */
const venueOf = (p) => must(must(must(p.action_kinds, "action_kinds").find((k) => k.kind === "records_request"), "records_request").venue, "records_request venue");
/** A view's deadline with that rule. @param {View} v @param {string} rule @returns {ViewDeadline} */
const viewRule = (v, rule) => must(must(v.deadlines, "deadlines").find((d) => d.rule === rule), `deadline ${rule}`);
/** A view's records-request venue. @param {View} v @returns {ViewVenue} */
const viewVenue = (v) => must(must(must(v.action_kinds, "action_kinds").find((k) => k.kind === "records_request"), "records_request").venue, "records_request venue");
/** A view's minutes-due value. @param {View} v @returns {ViewMinutesDue} */
const minutesDue = (v) => must(must(v.practice, "practice").minutes_due_days, "minutes_due_days");
/** Appends to the list at a member of a loose copy. @param {Fields} o @param {string} k @param {Value} v @returns {void} */
const append = (o, k, v) => { const l = o[k]; if (!isList(l)) throw new TypeError(`${k}: not a list`); l.push(v); };
/** Removes the last entry of the list at a member of a loose copy. @param {Fields} o @param {string} k @returns {void} */
const popOff = (o, k) => { const l = o[k]; if (!isList(l)) throw new TypeError(`${k}: not a list`); l.pop(); };

/** @typedef {"weekend" | "computation" | "fiscal_year" | "law_ranks" | "instrument_key" | "proceeding_kinds" | "proceeding_flows" | "identifier_schemes" | "classification_schemes" | "lawful_demands" | "recurrences"} T33Section */
/** @type {T33Section[]} */
const T33_SECTIONS = ["weekend", "computation", "fiscal_year", "law_ranks", "instrument_key", "proceeding_kinds", "proceeding_flows",
  "identifier_schemes", "classification_schemes", "lawful_demands", "recurrences"];
/** @type {("amending" | "meeting_markers" | "body_variants" | "roster_words" | "roster_headers" | "staff_titles")[]} */
const T33_VOCABULARY = ["amending", "meeting_markers", "body_variants", "roster_words", "roster_headers", "staff_titles"];
/** @type {SpaceName[]} */
const T33_SPACES = ["account", "object", "vendor", "proceeding", "person"];
/** @type {Weekday[]} */
const WEEKDAYS_FROM_SUNDAY = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
/** @param {Date} d @returns {Weekday} */
const dayName = (d) => must(WEEKDAYS_FROM_SUNDAY[d.getUTCDay()], "weekday");
/** @param {{ pattern: Pattern }} e @returns {RegExp} */
const rx = (e) => new RegExp(e.pattern.re, e.pattern.flags || "");

/* ============================================================================================== */
/* R3, R6, R7: the widened spaces, vocabulary and practice.                                        */

test("R3 T33 spaces: account, object, vendor, proceeding and person are known spaces with R3's forms", () => {
  const t = held(TEST);
  const spaces = must(t.spaces, "spaces");
  for (const sp of T33_SPACES) {
    const s = spaces[sp];
    assert.ok(s && s.forms.length, sp);
    assert.ok(hasError(breakT((p) => { at(p, `spaces.${sp}.forms[0]`).pattern = { re: "(" }; }), "PATTERN_INVALID", `spaces.${sp}.forms[0].pattern`), `${sp} is judged as a space`);
  }
  assert.ok(validate(t).ok);
  assert.ok(hasError(breakT((p) => { const s = at(p, "spaces"); s.licence = s.person; }), "UNKNOWN_SPACE", "spaces.licence"));
  assert.ok(hasError(breakT((p) => { at(p, "spaces.person").kinds = []; }), "UNKNOWN_SECTION", "spaces.person.kinds"), "kinds are enactment's only");
  /* one form per person scheme */
  assert.deepEqual(must(spaces.person, "person").forms.map((f) => f.form), ["minute-person", "bar-number"]);
  assert.deepEqual(must(must(held(FIRST).spaces, "spaces").person, "person").forms.map((f) => f.form), ["legistar-person"]);
  /* the view carries them */
  const v = viewOf(combine([TEST]));
  const vs = must(v.spaces, "view spaces");
  for (const sp of T33_SPACES) assert.ok(vs[sp], sp);
});

test("R6 T33 vocabulary: a code's copy and sections; amending, meeting_markers, body_variants, roster words, headers and staff titles", () => {
  for (const key of T33_VOCABULARY) {
    assert.ok(must(must(held(TEST).vocabulary, "vocabulary")[key], key).length, key);
    assert.ok(!hasError(validate(held(TEST)), "UNKNOWN_VOCABULARY"), key);
    assert.ok(hasError(breakT((p) => { at(p, `vocabulary.${key}[0]`).pattern = { re: ")" }; }), "PATTERN_INVALID", `vocabulary.${key}[0].pattern`), key);
  }
  const C = "vocabulary.codes[0]";
  for (const copy of ["official", "codifier", "undetermined"]) assert.ok(breakT((p) => { at(p, C).copy = copy; }).ok, copy);
  for (const bad of ["unofficial", "", 1]) assert.ok(hasError(breakT((p) => { at(p, C).copy = bad; }), "COPY_UNKNOWN", `${C}.copy`), String(bad));
  assert.ok(breakT((p) => { const c = at(p, C); delete c.copy; delete c.sections; }).ok, "both optional");
  for (const markers of [["letter"], ["roman", "paren_numeral", "numeral", "paren_letter", "letter"]]) assert.ok(breakT((p) => { at(p, `${C}.sections`).markers = markers; }).ok);
  assert.ok(breakT((p) => { at(p, `${C}.sections`).markers = []; }).ok, "no markers");
  assert.ok(breakT((p) => { at(p, `${C}.sections`).markers = ["letter", "numeral", "letter", "roman", "paren_numeral"]; }).ok,
    "a kind recurs at a deeper level (K1521)");
  assert.ok(breakT((p) => { at(p, `${C}.sections`).separators = ""; }).ok, "a one-part number (K1521)");
  for (const markers of [["bullet"], "letter", ["letter", 1]])
    assert.ok(hasError(breakT((p) => { at(p, `${C}.sections`).markers = markers; }), "VALUE_INVALID", `${C}.sections.markers`), JSON.stringify(markers));
  assert.ok(hasError(breakT((p) => { at(p, `${C}.sections`).number = { re: "(" }; }), "PATTERN_INVALID", `${C}.sections.number`));
  for (const sep of [" ", "- ", 3]) assert.ok(hasError(breakT((p) => { at(p, `${C}.sections`).separators = sep; }), "VALUE_INVALID", `${C}.sections.separators`));
  assert.ok(hasError(breakT((p) => { at(p, `${C}.sections`).depth = 3; }), "UNKNOWN_SECTION", `${C}.sections.depth`));
  assert.ok(hasError(breakT((p) => { at(p, C).sections = "1.2.3"; }), "VALUE_INVALID", `${C}.sections`));
  for (const relation of ["amends", "adds", "repeals", "renumbers", "recodifies"]) assert.ok(breakT((p) => { at(p, "vocabulary.amending[0]").relation = relation; }).ok);
  for (const bad of ["supersedes", "", undefined]) assert.ok(hasError(breakT((p) => { at(p, "vocabulary.amending[0]").relation = bad; }), "VALUE_INVALID", "vocabulary.amending[0].relation"));
  for (const marker of ["cancelled", "special", "concurrent"]) assert.ok(breakT((p) => { at(p, "vocabulary.meeting_markers[0]").marker = marker; }).ok);
  for (const bad of ["postponed", "", undefined]) assert.ok(hasError(breakT((p) => { at(p, "vocabulary.meeting_markers[0]").marker = bad; }), "VALUE_INVALID", "vocabulary.meeting_markers[0].marker"));
  for (const bad of ["City Council", "", undefined, "1st"]) assert.ok(hasError(breakT((p) => { at(p, "vocabulary.body_variants[0]").organisation = bad; }), "VALUE_INVALID", "vocabulary.body_variants[0].organisation"));
  assert.ok(hasError(breakT((p) => { at(p, "vocabulary.roster_words[0]").organisation = "x"; }), "UNKNOWN_SECTION", "vocabulary.roster_words[0].organisation"));
  /* the first profile's Legistar markers and body variants read Legistar's own names (legistar-events §1, §5) */
  const f = must(held(FIRST).vocabulary, "vocabulary");
  /** @param {string} name @returns {string[]} */
  const marker = (name) => must(f.meeting_markers, "meeting_markers").filter((e) => rx(e).test(name)).map((e) => e.marker).sort();
  assert.deepEqual(marker("*Finance and Management Committee - CANCELLED"), ["cancelled"]);
  assert.deepEqual(marker("Meeting of the Oakland City Council  - CANCELLATION"), ["cancelled"]);
  assert.deepEqual(marker("*Special Concurrent Meeting of the Oakland Redevelopment Agency/City Council"), ["concurrent", "special"]);
  assert.deepEqual(marker("*Life Enrichment Committee"), []);
  /** @param {string} name @returns {string | undefined} */
  const org = (name) => { const b = must(f.body_variants, "body_variants").find((e) => rx(e).test(name)); return b ? b.organisation : undefined; };
  assert.equal(org("*Finance & Management Committee"), org("*Finance and Management Committee - CANCELLED"));
  assert.equal(org("*Rules & Legislation Committee"), "rules_committee");
  assert.equal(org("*Special Rules and Legislation Committee"), "rules_committee");
  assert.equal(org("* Public Works And Transportation Committee"), "public_works_committee");
  assert.equal(org("Meeting of the Oakland City Council  - CANCELLATION"), "city_council");
  assert.equal(org("Office of the Mayor Annual Recess Agenda"), undefined);
  const firstCodes = must(must(held(FIRST).vocabulary, "vocabulary").codes, "codes");
  const code0 = must(firstCodes[0], "codes[0]");
  assert.equal(code0.copy, "codifier", "the OMC is served by its codifier (time-law §4)");
  assert.ok(new RegExp(`^(?:${must(code0.sections, "sections").number.re})$`).test("2.20.070"));
  /* the printed orders doctypes measured (K1521) */
  /** @param {string} key */
  const codes = (key) => must(must(firstCodes.find((c) => c.key === key), key).sections, `${key} sections`);
  assert.deepEqual(codes("omc").markers, ["letter", "numeral", "letter", "roman", "paren_numeral"]);
  assert.deepEqual([codes("charter").separators, codes("charter").markers], ["", ["paren_letter", "paren_numeral", "paren_letter", "roman"]]);
  assert.ok(new RegExp(`^(?:${codes("charter").number.re})$`).test("200"));
});

test("R7 T33 practice: minutes_due_days with count calendar (absent) or business; the first profile's OMC 2.20.160", () => {
  const M = "practice.minutes_due_days";
  for (const count of ["calendar", "business"]) assert.ok(breakT((p) => { at(p, M).count = count; }).ok, count);
  assert.ok(breakT((p) => { delete at(p, M).count; }).ok, "count is optional: calendar");
  for (const bad of ["working", "", 1]) assert.ok(hasError(breakT((p) => { at(p, M).count = bad; }), "COUNT_UNKNOWN", "practice.minutes_due_days.count"));
  assert.deepEqual(must(held(FIRST).practice, "practice").minutes_due_days, { value: 10, count: "business", closures: "city", basis: "2026-10-05 time-law" });
  /* K1533: closures names one of the profile's closure lists */
  assert.ok(breakT((p) => { at(p, M).closures = "court"; }).ok);
  assert.ok(breakT((p) => { delete at(p, M).closures; }).ok, "absent: a business count's due is undetermined");
  for (const bad of ["nowhere", "", 3]) assert.ok(hasError(breakT((p) => { at(p, M).closures = bad; }), "VALUE_INVALID", "practice.minutes_due_days.closures"), String(bad));
  assert.ok(hasError(breakT((p) => { p.holidays = listOr(p.holidays).filter((h) => !isObj(h) || h.list !== "town"); }), "VALUE_INVALID", "practice.minutes_due_days.closures"));
  assert.equal(minutesDue(viewOf(combine([FIRST]))).closures, "city");
  const cl = combinedOf(combine([TEST, other((b) => { at(b, M).closures = "court"; })]));
  assert.ok(cl.conflicts.some((x) => x.at === "practice.minutes_due_days"), "one value, its closures part of it");
  /* one value, its count part of it */
  const c = combinedOf(combine([TEST, other((b) => { at(b, M).count = "business"; })]));
  assert.deepEqual(c.conflicts.map((x) => x.at), ["practice.minutes_due_days"]);
  assert.equal(must(c.view.practice, "practice").minutes_due_days, undefined);
  const same = combinedOf(combine([TEST, other((b) => { delete at(b, M).count; })]));
  assert.ok(!same.conflicts.some((x) => x.at === "practice.minutes_due_days"), "absent count is calendar");
  assert.deepEqual([minutesDue(viewOf(combine([FIRST]))).value, minutesDue(viewOf(combine([FIRST]))).count], [10, "business"]);
});

/* ============================================================================================== */
/* R26, R28, R44: the widened deadline.                                                            */

test("R26 T33 deadlines: units and amount (days: n read as days), count with days only, direction, the anchors, roll, closures, computation, extension, tolling, observed, status", () => {
  const t = held(TEST);
  assert.ok(validate(t).ok);
  const D = "deadlines[1]";
  for (const units of ["days", "hours", "business_hours", "months", "years"]) assert.ok(breakT((p) => { const d = at(p, D); d.units = units; delete d.count; }).ok, units);
  for (const bad of ["weeks", "", undefined]) assert.ok(hasError(breakT((p) => { at(p, D).units = bad; }), "UNIT_UNKNOWN", `${D}.units`), String(bad));
  for (const bad of [0, -2, 1.5, "90", undefined]) assert.ok(hasError(breakT((p) => { at(p, D).amount = bad; }), "VALUE_INVALID", `${D}.amount`), String(bad));
  assert.ok(hasError(breakT((p) => { at(p, D).units = "hours"; }), "UNIT_UNKNOWN", `${D}.count`), "count with units other than days");
  assert.ok(hasError(breakT((p) => { at(p, D).days = 90; }), "VALUE_INVALID", `${D}.days`), "both forms at once");
  /* the pre-T33 form stands */
  const tdl = must(t.deadlines, "deadlines");
  const t0 = must(tdl[0], "deadlines[0]");
  assert.equal(t0.days, 5);
  assert.ok(!own(t0, "units"));
  for (const direction of ["forward", "backward"]) assert.ok(breakT((p) => { at(p, D).direction = direction; }).ok);
  assert.ok(breakT((p) => { delete at(p, D).direction; }).ok, "forward when absent");
  assert.ok(hasError(breakT((p) => { at(p, D).direction = "back"; }), "DIRECTION_UNKNOWN", `${D}.direction`));
  for (const starts of ["received", "filed", "act", "known", "entered", "served", "hearing"]) assert.ok(breakT((p) => { at(p, D).starts = starts; }).ok, starts);
  for (const bad of ["sent", "accrual", "", undefined]) assert.ok(hasError(breakT((p) => { at(p, D).starts = bad; }), "ANCHOR_UNKNOWN", `${D}.starts`), String(bad));
  for (const bad of ["yes", 1, null]) assert.ok(hasError(breakT((p) => { at(p, D).roll = bad; }), "VALUE_INVALID", `${D}.roll`));
  assert.ok(hasError(breakT((p) => { at(p, D).closures = "harbour"; }), "CLOSURES_UNKNOWN", `${D}.closures`));
  assert.ok(hasError(breakT((p) => { p.holidays = listOr(p.holidays).filter((h) => !isObj(h) || h.list !== "court"); }), "CLOSURES_UNKNOWN", `${D}.closures`), "a list with no entry");
  assert.ok(hasError(breakT((p) => { at(p, D).computation = "ccp_12"; }), "COMPUTATION_UNKNOWN", `${D}.computation`));
  /* extension: computed by civil-time, its citation optional */
  assert.ok(breakT((p) => { delete at(p, "deadlines[0].extension").citation; }).ok);
  assert.ok(hasError(breakT((p) => { at(p, "deadlines[0].extension").citation = ""; }), "VALUE_INVALID", "deadlines[0].extension.citation"));
  assert.ok(hasError(breakT((p) => { at(p, "deadlines[0].extension").from = "day 10"; }), "UNKNOWN_SECTION", "deadlines[0].extension.from"));
  /* tolling: [{when, citation}] */
  assert.ok(hasError(breakT((p) => { at(p, D).tolling = [{ when: "x" }]; }), "VALUE_INVALID", `${D}.tolling[0].citation`));
  assert.ok(hasError(breakT((p) => { at(p, D).tolling = "minors"; }), "VALUE_INVALID", `${D}.tolling`));
  assert.ok(hasError(breakT((p) => { at(p, `${D}.tolling[0]`).days = 3; }), "UNKNOWN_SECTION", `${D}.tolling[0].days`));
  /* observed: a list beside the rule, with its own status */
  assert.ok(hasError(breakT((p) => { at(p, "deadlines[0].observed").closures = "nowhere"; }), "CLOSURES_UNKNOWN", "deadlines[0].observed.closures"));
  assert.ok(hasError(breakT((p) => { at(p, "deadlines[0]").observed = "town"; }), "VALUE_INVALID", "deadlines[0].observed"));
  assert.ok(hasError(breakT((p) => { delete at(p, "deadlines[0].observed").status; }), "BASIS_INVALID", "deadlines[0].observed.status"));
  /* every value the test profile gives is one R26 names */
  /** @type {{ units: Set<string>, starts: Set<string>, direction: Set<string> }} */
  const seen = { units: new Set(), starts: new Set(), direction: new Set() };
  for (const d of tdl) { seen.units.add(d.units || "days"); seen.starts.add(d.starts); seen.direction.add(d.direction || "forward"); }
  assert.deepEqual([...seen.units].sort(), ["business_hours", "days", "hours", "months", "years"]);
  /* R75 (T45) adds the start by a third party's act */
  assert.deepEqual([...seen.starts].sort(), ["act", "entered", "filed", "hearing", "known", "received", "served", "third_party"]);
  assert.deepEqual([...seen.direction].sort(), ["backward", "forward"]);
});

test("R44 T33 every deadline and calendar fact carries status and a sourced basis; UNMEASURED is BASIS_INVALID there", () => {
  /** @type {[string, (p: Fields) => Fields][]} */
  const facts = [
    ["deadlines[1]", (p) => at(p, "deadlines[1]")], ["deadlines[0].observed", (p) => at(p, "deadlines[0].observed")], ["weekend", (p) => at(p, "weekend")],
    ["computation[0]", (p) => at(p, "computation[0]")], ["holidays[4]", (p) => at(p, "holidays[4]")],
    ["action_kinds[0].venue.cutoff", (p) => at(venue(p), "cutoff")], ["action_kinds[0].venue.outages[0]", (p) => at(venue(p), "outages[0]")],
    ["action_kinds[0].venue.receipt", (p) => at(venue(p), "receipt")], ["fiscal_year[0]", (p) => at(p, "fiscal_year[0]")],
    ["recurrences[0]", (p) => at(p, "recurrences[0]")], ["lawful_demands[0]", (p) => at(p, "lawful_demands[0]")],
  ];
  for (const [where, of] of facts) {
    for (const status of ["researched", "ruled"]) {
      assert.ok(breakT((p) => { of(p).status = status; }).ok, `${where} ${status} TEST`);
      assert.ok(hasError(breakT((p) => { of(p).status = status; of(p).basis = "UNMEASURED"; }), "BASIS_INVALID", `${where}.basis`), `${where} ${status} UNMEASURED`);
    }
    for (const bad of ["measured", "", undefined]) assert.ok(hasError(breakT((p) => { of(p).status = bad; }), "BASIS_INVALID", `${where}.status`), `${where} ${String(bad)}`);
    assert.ok(hasError(breakT((p) => { delete of(p).basis; }), "BASIS_MISSING", `${where}.basis`), `${where} no basis`);
  }
  /* outside a test profile: researched on a measurement, ruled on a ruling */
  /** @param {(p: Fields) => void} fn @returns {Validation} */
  const F = (fn) => breakF(fn);
  assert.ok(F((p) => { dl(p, "records_response").basis = "M-190"; }).ok);
  assert.ok(hasError(F((p) => { dl(p, "records_response").basis = "K1504"; }), "BASIS_INVALID", "deadlines[0].basis"));
  assert.ok(F((p) => { dl(p, "records_response").status = "ruled"; dl(p, "records_response").basis = "K1504"; }).ok);
  assert.ok(hasError(F((p) => { dl(p, "records_response").basis = "UNMEASURED"; }), "BASIS_INVALID", "deadlines[0].basis"));
  assert.ok(hasError(F((p) => { delete dl(p, "records_response").status; }), "BASIS_INVALID", "deadlines[0].status"));
  assert.ok(hasError(F((p) => { at(p, "weekend").basis = "TEST"; }), "BASIS_INVALID", "weekend.basis"));
});

test("R28 T33 codes: each new code is reported for its fault, and the new sections are known", () => {
  /** @type {{ [code: string]: [(p: Fields) => void, string] }} */
  const cases = {
    UNIT_UNKNOWN: [(p) => { at(p, "deadlines[1]").units = "fortnights"; }, "deadlines[1].units"],
    DIRECTION_UNKNOWN: [(p) => { at(p, "deadlines[1]").direction = "sideways"; }, "deadlines[1].direction"],
    ANCHOR_UNKNOWN: [(p) => { at(p, "deadlines[1]").starts = "mailed"; }, "deadlines[1].starts"],
    CLOSURES_UNKNOWN: [(p) => { at(p, "deadlines[1]").closures = "none"; }, "deadlines[1].closures"],
    COMPUTATION_UNKNOWN: [(p) => { at(p, "deadlines[1]").computation = "none"; }, "deadlines[1].computation"],
    WEEKEND_INVALID: [(p) => { at(p, "weekend").days = ["sunday"]; }, "weekend.days"],
    CHANNEL_INVALID: [(p) => { at(venue(p), "cutoff").time = "5pm"; }, "action_kinds[0].venue.cutoff.time"],
    FISCAL_YEAR_INVALID: [(p) => { at(p, "fiscal_year[0]").start = "13-01"; }, "fiscal_year[0].start"],
    RANK_INVALID: [(p) => { at(p, "law_ranks[0]").rank = 0; }, "law_ranks[0].rank"],
    COPY_UNKNOWN: [(p) => { at(p, "vocabulary.codes[0]").copy = "draft"; }, "vocabulary.codes[0].copy"],
    FLOW_INVALID: [(p) => { at(p, "proceeding_flows[0]").kind = "nothing"; }, "proceeding_flows[0].kind"],
    SCHEME_INVALID: [(p) => { at(p, "identifier_schemes[0]").space = "nowhere"; }, "identifier_schemes[0].space"],
    DEMAND_INVALID: [(p) => { at(p, "lawful_demands[0]").covers = ["email"]; }, "lawful_demands[0].covers"],
    RECURRENCE_INVALID: [(p) => { at(p, "recurrences[0]").rrule = "FREQ=DAILY"; }, "recurrences[0].rrule"],
  };
  for (const [code, [fn, path]] of Object.entries(cases)) assert.ok(hasError(breakT(fn), code, path), code);
  for (const sec of T33_SECTIONS) {
    assert.ok(SECTIONS.includes(sec), sec);
    assert.ok(own(held(TEST), sec), sec);
  }
  assert.ok(!validate(held(TEST)).errors.some((e) => e.code === "UNKNOWN_SECTION"));
});

/* ============================================================================================== */
/* R46–R54: T33's sections.                                                                        */

test("R46 weekend {days, citation, status, basis} and computation [{key, rule, citation, status, basis}]", () => {
  for (const days of [["sat", "sun"], ["sun"], ["fri", "sat"]]) assert.ok(breakT((p) => { at(p, "weekend").days = days; }).ok, days.join());
  for (const days of [[], ["sun", "sun"], ["Sun"], "sun", ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]])
    assert.ok(hasError(breakT((p) => { at(p, "weekend").days = days; }), "WEEKEND_INVALID", "weekend.days"), JSON.stringify(days));
  for (const bad of ["sat,sun", null, []]) assert.ok(hasError(breakT((p) => { p.weekend = bad; }), "WEEKEND_INVALID", "weekend"), JSON.stringify(bad));
  assert.ok(hasError(breakT((p) => { delete at(p, "weekend").citation; }), "VALUE_INVALID", "weekend.citation"));
  assert.ok(hasError(breakT((p) => { at(p, "weekend").from = "2026"; }), "UNKNOWN_SECTION", "weekend.from"));
  assert.ok(breakT((p) => { delete p.weekend; }).ok, "absent: a business count is undetermined (civil-time R9), never assumed");
  assert.equal(must(viewOf(combine([FIRST])).weekend, "weekend").days.join(), "sat,sun");
  assert.match(must(held(FIRST).weekend, "weekend").citation, /12a/);
  /* computation */
  assert.ok(hasError(breakT((p) => { at(p, "computation[0]").rule = "include_both"; }), "VALUE_INVALID", "computation[0].rule"));
  for (const bad of ["CCP-12", "", "1x"]) assert.ok(hasError(breakT((p) => { at(p, "computation[0]").key = bad; }), "VALUE_INVALID", "computation[0].key"));
  assert.ok(hasError(breakT((p) => { append(p, "computation", { ...at(p, "computation[0]") }); }), "VALUE_INVALID", "computation[1].key"), "a key twice");
  assert.ok(hasError(breakT((p) => { delete at(p, "computation[0]").citation; }), "VALUE_INVALID", "computation[0].citation"));
  /* the Monday safe harbour is a rule of its own (applies_on, due_at; K1514), never a computation */
  assert.ok(hasError(breakT((p) => { at(p, "computation[0]").rule = "monday_prior_friday_noon"; }), "VALUE_INVALID", "computation[0].rule"));
  assert.deepEqual(must(held(FIRST).computation, "computation").map((c) => [c.key, c.rule, c.citation]),
    [["ccp_12", "exclude_first_include_last", "Cal. Code Civ. Proc. § 12; Cal. Gov. Code § 6800"]]);
});

test("R47 closure lists: a holiday entry's list and citation; a year once per list and offices; a rule's closures and observed name lists", () => {
  const t = held(TEST);
  assert.deepEqual(must(t.holidays, "holidays").filter((h) => h.list).map((h) => h.list), ["court", "town"]);
  for (const bad of ["Court", "", 3]) assert.ok(hasError(breakT((p) => { at(p, "holidays[4]").list = bad; }), "HOLIDAY_INVALID", "holidays[4].list"), String(bad));
  assert.ok(hasError(breakT((p) => { delete at(p, "holidays[4]").citation; }), "VALUE_INVALID", "holidays[4].citation"), "a list cites what makes it");
  /* a year once for each list and offices; the same year in two lists, or in a list and the office calendar, is fine */
  assert.ok(hasError(breakT((p) => { append(p, "holidays", { ...at(p, "holidays[4]") }); }), "HOLIDAY_INVALID", "holidays[6].year"));
  assert.ok(breakT((p) => { append(p, "holidays", { ...at(p, "holidays[4]"), list: "registry" }); }).ok);
  assert.ok(breakT((p) => { append(p, "holidays", { ...at(p, "holidays[4]"), offices: ["Town Clerk"] }); }).ok, "a list's year for one office");
  /* the rule counts on one list; the practice beside it on another, never as the rule */
  const r = ruleOf(t, "records_answer");
  assert.deepEqual([r.closures, must(r.observed, "observed").closures], ["town", "court"]);
  const f = held(FIRST);
  const cpra = ruleOf(f, "records_response");
  assert.deepEqual([cpra.closures, must(cpra.observed, "observed").closures], ["judicial", "city"], "K1504 (1): the law's list, the portal's beside it");
  /* the view keeps each list's year, with its list and citation */
  const v = viewOf(combine([FIRST]));
  const lists = must(v.holidays, "holidays").filter((h) => h.list).map((h) => ({ list: h.list, year: h.year, citation: h.citation }));
  /* R85 (T45, M-T45-1): 2027 only where a primary source states it, the federal list (OPM's schedule under 5 U.S.C. § 6103) */
  assert.deepEqual(lists.map((x) => `${x.list} ${x.year}`), ["judicial 2026", "city 2026", "federal 2026", "federal 2027", "judicial 2018", "judicial 2020"]);
  assert.ok(lists.every((x) => { const c = x.citation; return typeof c === "string" && c.length > 0; }));
  assert.deepEqual(must(viewRule(v, "records_response").observed, "observed").closures, "city");
});

test("R48 a venue's channel facts: cutoff {time, citation, status, basis}, outages [{from, to}], receipt {rule: next_business_day, citation}", () => {
  const V = "action_kinds[0].venue";
  for (const time of ["00:00", "16:30", "23:59"]) assert.ok(breakT((p) => { at(venue(p), "cutoff").time = time; }).ok, time);
  for (const time of ["24:00", "4:30", "", null]) assert.ok(hasError(breakT((p) => { at(venue(p), "cutoff").time = time; }), "CHANNEL_INVALID", `${V}.cutoff.time`), String(time));
  assert.ok(hasError(breakT((p) => { at(venue(p), "cutoff").citation = ""; }), "CHANNEL_INVALID", `${V}.cutoff.citation`));
  assert.ok(hasError(breakT((p) => { venue(p).cutoff = "16:30"; }), "CHANNEL_INVALID", `${V}.cutoff`));
  /** @type {[string, string][]} */
  const spans = [["2026-03-02T09:00:00Z", "2026-03-02T09:00:00Z"], ["2026-03-02T10:00Z", "2026-03-02T09:00Z"]];
  for (const [f, t] of spans)
    assert.ok(hasError(breakT((p) => { const o = at(venue(p), "outages[0]"); o.from = f; o.to = t; }), "CHANNEL_INVALID", `${V}.outages[0]`), `${f} ${t}`);
  for (const bad of ["2026-03-02", "2026-03-02T09:00", "2026-02-30T09:00Z", "yesterday"])
    assert.ok(hasError(breakT((p) => { at(venue(p), "outages[0]").from = bad; }), "CHANNEL_INVALID", `${V}.outages[0].from`), bad);
  assert.ok(breakT((p) => { at(venue(p), "outages[0]").to = "2026-03-02T17:30:00.5+00:00"; }).ok, "an offset other than the zone's");
  assert.ok(hasError(breakT((p) => { venue(p).outages = {}; }), "CHANNEL_INVALID", `${V}.outages`));
  for (const bad of ["actual_day", "", undefined]) assert.ok(hasError(breakT((p) => { at(venue(p), "receipt").rule = bad; }), "CHANNEL_INVALID", `${V}.receipt.rule`));
  assert.ok(hasError(breakT((p) => { delete at(venue(p), "receipt").citation; }), "CHANNEL_INVALID", `${V}.receipt.citation`));
  assert.ok(breakT((p) => { const v = venue(p); delete v.cutoff; delete v.outages; delete v.receipt; }).ok, "absent: the actual day and instant stand");
  /* the first profile: the City Attorney's guide on the records portal (K1504 (3)); no cutoff is sourced, so none */
  const fv = venueOf(held(FIRST));
  const receipt = must(fv.receipt, "receipt");
  assert.deepEqual([receipt.rule, receipt.status], ["next_business_day", "researched"]);
  assert.match(receipt.citation, /2025-04-29/);
  assert.equal(fv.cutoff, undefined);
  /* the view carries them on the venue, beside its hours */
  const tv = viewVenue(viewOf(combine([TEST])));
  assert.deepEqual([must(tv.cutoff, "cutoff").time, must(tv.receipt, "receipt").rule, must(tv.outages, "outages").length, tv.how], ["16:30", "next_business_day", 1, "email"]);
});

test("R49 fiscal_year: per body (a counterparty body or *), start MM-DD, named_by start or end, a label template", () => {
  assert.ok(validate(held(TEST)).ok);
  const FY = "fiscal_year[1]";
  for (const bad of ["Nowhere Board", "", undefined]) assert.ok(hasError(breakT((p) => { at(p, FY).body = bad; }), "FISCAL_YEAR_INVALID", `${FY}.body`), String(bad));
  assert.ok(hasError(breakT((p) => { at(p, FY).body = "*"; }), "FISCAL_YEAR_INVALID", `${FY}.body`), "a body keeps one fiscal year");
  for (const bad of ["02-30", "7-1", "07/01", "13-01", ""]) assert.ok(hasError(breakT((p) => { at(p, FY).start = bad; }), "FISCAL_YEAR_INVALID", `${FY}.start`), bad);
  assert.ok(breakT((p) => { at(p, FY).start = "02-29"; }).ok, "a day some year has");
  assert.ok(hasError(breakT((p) => { at(p, FY).named_by = "middle"; }), "FISCAL_YEAR_INVALID", `${FY}.named_by`));
  for (const bad of ["FY", "FY{year}", "", 2026]) assert.ok(hasError(breakT((p) => { at(p, FY).label = bad; }), "FISCAL_YEAR_INVALID", `${FY}.label`), String(bad));
  for (const good of ["FY{end}", "{start}-{end2}", "{start2}/{end2}"]) assert.ok(breakT((p) => { at(p, FY).label = good; }).ok, good);
});

test("R50 law_ranks, instrument_key and a standard source's key", () => {
  assert.ok(hasError(breakT((p) => { append(p, "law_ranks", { ...at(p, "law_ranks[0]"), rank: 4 }); }), "RANK_INVALID", "law_ranks[3]"), "a kind and level twice");
  assert.ok(breakT((p) => { append(p, "law_ranks", { ...at(p, "law_ranks[0]"), level: "federal" }); }).ok);
  /** @type {[string, string | number][]} */
  const wrong = [["kind", "custom"], ["level", "local"], ["rank", 1.5], ["rank", "1"]];
  for (const [f, bad] of wrong)
    assert.ok(hasError(breakT((p) => { at(p, "law_ranks[0]")[f] = bad; }), "RANK_INVALID", `law_ranks[0].${f}`), `${f} ${bad}`);
  for (const bad of ["XX-Port", "", "-x"]) assert.ok(hasError(breakT((p) => { at(p, "instrument_key").jurisdiction = bad; }), "VALUE_INVALID", "instrument_key.jurisdiction"));
  assert.ok(hasError(breakT((p) => { p.instrument_key = "xx"; }), "VALUE_INVALID", "instrument_key"));
  assert.ok(hasError(breakT((p) => { delete at(p, "instrument_key").basis; }), "BASIS_MISSING", "instrument_key.basis"));
  for (const bad of ["Selectboard", "", "a b"]) assert.ok(hasError(breakT((p) => { at(p, "standard_sources[0]").key = bad; }), "VALUE_INVALID", "standard_sources[0].key"));
  const v = viewOf(combine([TEST]));
  const key = must(v.instrument_key, "instrument_key");
  assert.deepEqual([key.jurisdiction, key.profile], ["xx-port-ellery", TEST]);
  assert.equal(must(must(v.standard_sources, "standard_sources")[0], "standard_sources[0]").key, "selectboard");
});

test("R51 proceeding_kinds and proceeding_flows: ordered stages, each reached by event kinds", () => {
  for (const fk of ["court", "commission", "grand_jury", "auditor", "other"]) assert.ok(breakT((p) => { at(p, "proceeding_kinds[0]").forum_kind = fk; }).ok);
  assert.ok(hasError(breakT((p) => { at(p, "proceeding_kinds[0]").forum_kind = "tribunal"; }), "VALUE_INVALID", "proceeding_kinds[0].forum_kind"));
  assert.ok(hasError(breakT((p) => { at(p, "proceeding_kinds[1]").kind = "commitment_suit"; }), "DUPLICATE_KIND", "proceeding_kinds[1].kind"));
  const F = "proceeding_flows[0]";
  assert.ok(hasError(breakT((p) => { append(p, "proceeding_flows", { ...at(p, F) }); }), "FLOW_INVALID", "proceeding_flows[1].kind"), "one flow per kind");
  assert.ok(hasError(breakT((p) => { at(p, `${F}.stages[2]`).stage = "filed"; }), "FLOW_INVALID", `${F}.stages[2].stage`), "a stage twice");
  assert.ok(hasError(breakT((p) => { at(p, F).stages = []; }), "FLOW_INVALID", `${F}.stages`));
  assert.ok(hasError(breakT((p) => { at(p, `${F}.stages[0]`).reached_by = []; }), "FLOW_INVALID", `${F}.stages[0].reached_by`));
  assert.ok(hasError(breakT((p) => { delete at(p, `${F}.stages[0]`).label; }), "FLOW_INVALID", `${F}.stages[0].label`));
  assert.ok(hasError(breakT((p) => { delete p.proceeding_kinds; }), "FLOW_INVALID", `${F}.kind`), "a flow for no kind");
  assert.deepEqual(must(must(viewOf(combine([TEST])).proceeding_flows, "proceeding_flows")[0], "proceeding_flows[0]").stages.map((s) => s.stage), ["filed", "heard", "decided"], "order kept");
});

test("R52 identifier_schemes name a space, form and systems of the profile; classification_schemes a kind and codes", () => {
  const I = "identifier_schemes[0]";
  assert.ok(hasError(breakT((p) => { at(p, I).form = "nothing"; }), "SCHEME_INVALID", `${I}.form`));
  assert.ok(hasError(breakT((p) => { at(p, I).systems = ["nowhere.record"]; }), "SCHEME_INVALID", `${I}.systems[0]`));
  assert.ok(hasError(breakT((p) => { at(p, I).entity_kinds = []; }), "SCHEME_INVALID", `${I}.entity_kinds`));
  assert.ok(hasError(breakT((p) => { at(p, "identifier_schemes[1]").scheme = "ellery_person"; }), "SCHEME_INVALID", "identifier_schemes[1].scheme"));
  assert.ok(breakT((p) => { const s = at(p, I); delete s.form; delete s.systems; }).ok);
  const C = "classification_schemes[0]";
  for (const kind of ["fund", "organisation", "account", "object", "program", "function"]) assert.ok(breakT((p) => { at(p, C).kind = kind; }).ok);
  assert.ok(hasError(breakT((p) => { at(p, C).kind = "department"; }), "SCHEME_INVALID", `${C}.kind`));
  assert.ok(hasError(breakT((p) => { append(at(p, C), "codes", { code: "100-01", label: "Again" }); }), "SCHEME_INVALID", `${C}.codes[2].code`));
  assert.ok(hasError(breakT((p) => { put(p, `${C}.codes[0]`, { code: "1" }); }), "SCHEME_INVALID", `${C}.codes[0]`));
  /* the first profile's Legistar person scheme: its PersonId form and its system (T34's body and office schemes follow, R61) */
  assert.deepEqual(must(held(FIRST).identifier_schemes, "identifier_schemes")[0], { scheme: "legistar_person_id", label: "Legistar PersonId", entity_kinds: ["person"],
    space: "person", form: "legistar-person", systems: ["oakland.legistar"], basis: "2026-10-05 legistar-events" });
});

test("R53 lawful_demands: kind, label, covers from home_address, phone, other, within in R26's units, citation", () => {
  const D = "lawful_demands[0]";
  for (const bad of [[], ["home_address", "home_address"], ["photo"]]) assert.ok(hasError(breakT((p) => { at(p, D).covers = bad; }), "DEMAND_INVALID", `${D}.covers`));
  for (const bad of [{ amount: 0, units: "days" }, { amount: 2, units: "weeks" }, { amount: 2 }, "48h", { amount: 2, units: "days", count: "business" }])
    assert.ok(hasError(breakT((p) => { at(p, D).within = bad; }), "DEMAND_INVALID", `${D}.within`), JSON.stringify(bad));
  assert.ok(hasError(breakT((p) => { append(p, "lawful_demands", { ...at(p, D) }); }), "DEMAND_INVALID", "lawful_demands[1].kind"));
  assert.ok(hasError(breakT((p) => { at(p, D).kind = "Officer"; }), "DEMAND_INVALID", `${D}.kind`));
  /* K1493: Gov. Code §7928.215, an official's home address or phone, within 48 hours */
  assert.deepEqual(must(held(FIRST).lawful_demands, "lawful_demands").map((d) => [d.citation, d.covers, d.within, d.status, d.basis]),
    [["Cal. Gov. Code § 7928.215", ["home_address", "phone"], { amount: 48, units: "hours" }, "ruled", "K1493"]]);
});

test("R54 recurrences: an RRULE in civil-time's subset, dtstart a local date-time, with citation and status", () => {
  const R = "recurrences[0]";
  for (const rr of ["FREQ=WEEKLY", "FREQ=MONTHLY;BYDAY=-1FR", "FREQ=MONTHLY;BYMONTHDAY=1,15", "FREQ=MONTHLY;BYDAY=MO,TU;BYSETPOS=1",
    "FREQ=YEARLY;INTERVAL=1;UNTIL=20270101T000000Z", "RRULE:FREQ=WEEKLY;BYDAY=TU"])
    assert.ok(breakT((p) => { at(p, R).rrule = rr; }).ok, rr);
  for (const rr of ["FREQ=DAILY", "FREQ=WEEKLY;COUNT=10", "FREQ=WEEKLY;BYHOUR=9", "FREQ=WEEKLY;BYMONTH=1", "BYDAY=TU", "FREQ=WEEKLY;FREQ=MONTHLY",
    "FREQ=WEEKLY;INTERVAL=0", "FREQ=WEEKLY;BYDAY=TUE", "FREQ=MONTHLY;BYMONTHDAY=32", "FREQ=WEEKLY;UNTIL=soon", "", "FREQ"])
    assert.ok(hasError(breakT((p) => { at(p, R).rrule = rr; }), "RECURRENCE_INVALID", `${R}.rrule`), rr);
  for (const bad of ["2026-01-13", "2026-01-13T19:00Z", "2026-02-30T19:00", "19:00"])
    assert.ok(hasError(breakT((p) => { at(p, R).dtstart = bad; }), "RECURRENCE_INVALID", `${R}.dtstart`), bad);
  assert.ok(hasError(breakT((p) => { delete at(p, R).citation; }), "VALUE_INVALID", `${R}.citation`));
});

/* ============================================================================================== */
/* R55: how T33's facts combine.                                                                   */

test("R55 combine: T33's one-value facts withheld and reported when profiles disagree, kept with every basis when they agree; the rest unioned", () => {
  const same = combinedOf(combine([TEST, other((b) => { at(b, "weekend").basis = "TEST"; })]));
  assert.deepEqual(same.conflicts, [], JSON.stringify(same.conflicts.map((c) => c.at)));
  assert.deepEqual(must(same.view.weekend, "weekend").bases.map((x) => x.profile), [TEST, "test-other"]);
  assert.equal(must(same.view.recurrences, "recurrences").length, must(held(TEST).recurrences, "recurrences").length, "equal entries kept once");
  /** @type {{ [at: string]: (b: Fields) => void }} */
  const changes = {
    weekend: (b) => { at(b, "weekend").days = ["sat", "sun"]; },
    "computation[clear_days]": (b) => { at(b, "computation[0]").citation = "Other § 1"; },
    "holidays[2026 list=court]": (b) => { popOff(at(b, "holidays[4]"), "days"); },
    "action_kinds[records_request].venue.cutoff": (b) => { at(venue(b), "cutoff").time = "17:00"; },
    "action_kinds[records_request].venue.receipt": (b) => { at(venue(b), "receipt").citation = "Other § 2"; },
    "fiscal_year[*]": (b) => { at(b, "fiscal_year[0]").start = "07-01"; },
    "law_ranks[statute/state]": (b) => { at(b, "law_ranks[0]").rank = 2; },
    instrument_key: (b) => { at(b, "instrument_key").jurisdiction = "xx-other"; },
    "proceeding_flows[commitment_suit]": (b) => { popOff(at(b, "proceeding_flows[0]"), "stages"); },
    "lawful_demands[officer_privacy]": (b) => { at(b, "lawful_demands[0].within").amount = 10; },
    "deadlines[claim_notice/claim].roll": (b) => { dl(b, "claim_notice").roll = false; },
    "deadlines[claim_notice/claim].closures": (b) => { dl(b, "claim_notice").closures = "town"; },
    "deadlines[claim_notice/claim].tolling": (b) => { dl(b, "claim_notice").tolling = []; },
    "deadlines[claim_notice/claim].units": (b) => { const d = dl(b, "claim_notice"); d.units = "months"; d.amount = 3; delete d.count; },
    "deadlines[records_answer/records_request].observed": (b) => { at(dl(b, "records_answer"), "observed").closures = "town"; },
    "deadlines[claim_notice/claim].status": (b) => { dl(b, "claim_notice").status = "researched"; },
  };
  for (const [where, fn] of Object.entries(changes)) {
    const c = combine([TEST, other(fn)]);
    assert.ok(c.ok, where);
    assert.ok(c.conflicts.some((x) => x.at === where), `${where}: ${c.conflicts.map((x) => x.at).join()}`);
    for (const x of c.conflicts) assert.ok(x.values.length >= 2 && typeof x.says === "string" && x.says.length > 20, x.at);
  }
  const w = viewOf(combine([TEST, other(must(changes.weekend, "weekend"))]));
  assert.equal(w.weekend, undefined);
  const f = viewOf(combine([TEST, other(must(changes["fiscal_year[*]"], "fiscal_year[*]"))]));
  assert.deepEqual(must(f.fiscal_year, "fiscal_year").map((x) => x.body), ["Port Ellery Harbour District"], "the other body's agreed year stands");
  const d = viewRule(viewOf(combine([TEST, other(must(changes["deadlines[claim_notice/claim].roll"], "roll"))])), "claim_notice");
  assert.equal(d.roll, undefined);
  assert.equal(d.amount, 90, "the rule's other facts stand");
  /* unioned: outages, proceeding kinds, schemes, recurrences, the new vocabulary keys */
  const u = combinedOf(combine([TEST, other((b) => {
    append(venue(b), "outages", { from: "2026-04-01T09:00Z", to: "2026-04-01T10:00Z", status: "researched", basis: "TEST" });
    append(b, "proceeding_kinds", { kind: "other_suit", label: "other", forum_kind: "other", basis: "TEST" });
    append(b, "identifier_schemes", { scheme: "other_scheme", label: "other", entity_kinds: ["person"], space: "person", basis: "TEST" });
    append(b, "classification_schemes", { scheme: "other_codes", label: "other", kind: "program", basis: "TEST" });
    append(b, "recurrences", { body: "Selectboard", rrule: "FREQ=YEARLY", dtstart: "2026-05-01T10:00", citation: "x", status: "ruled", basis: "TEST" });
    append(at(b, "vocabulary"), "roster_words", { pattern: { re: "Officers" }, basis: "TEST" });
  })]));
  assert.deepEqual(u.conflicts, []);
  const uv = u.view;
  assert.equal(must(viewVenue(uv).outages, "outages").length, 2);
  const t0 = held(TEST);
  /** @type {("proceeding_kinds" | "identifier_schemes" | "classification_schemes" | "recurrences")[]} */
  const unioned = ["proceeding_kinds", "identifier_schemes", "classification_schemes", "recurrences"];
  for (const sec of unioned)
    assert.equal(must(uv[sec], sec).length, must(t0[sec], sec).length + 1, sec);
  assert.equal(must(must(uv.vocabulary, "vocabulary").roster_words, "roster_words").length, must(must(held(TEST).vocabulary, "vocabulary").roster_words, "roster_words").length + 1);
  /* a deadline written `days: n` and one written `units: days, amount: n` agree (R26) */
  const legacy = combinedOf(combine([TEST, other((b) => { const r = dl(b, "records_answer"); delete r.days; r.units = "days"; r.amount = 5; })]));
  assert.ok(!legacy.conflicts.some((x) => x.at.startsWith("deadlines[records_answer")));
  const ra = viewRule(legacy.view, "records_answer");
  assert.deepEqual([ra.units, ra.amount, ra.days], ["days", 5, 5]);
  /* every T33 fact in the view carries its profile and bases (R13) */
  walkFacts(viewOf(combine([FIRST, TEST])), (fact, path) => assert.ok(fact.profile && isList(fact.bases), path));
});

/* ============================================================================================== */
/* R56, R57, R21, R30: the first sourced rule set and the fixtures.                                */

test("R56 the first profile's sourced rule set: each rule with its primary source, researched, on the dated measurement", () => {
  const f = held(FIRST);
  const rows = new Map(must(f.deadlines, "deadlines").map(/** @returns {[string, Deadline]} */ (d) => [d.rule, d]));
  /** @param {string} rule @returns {Deadline} */
  const row = (rule) => must(rows.get(rule), rule);
  /** @type {{ [rule: string]: [string, string, number, string | undefined, string, string, RegExp] }} */
  const want = {
    records_response: ["records_request", "days", 10, "calendar", "forward", "received", /7922\.535\(a\)/],
    immediate_disclosure: ["records_request", "days", 3, "business", "forward", "received", /2\.20\.230/],
    agenda_posting_regular: ["public_comment", "hours", 72, undefined, "backward", "act", /54954\.2\(a\)\(1\)/],
    special_meeting_notice: ["public_comment", "hours", 24, undefined, "backward", "act", /54956\(a\)/],
    omc_special_meeting_notice: ["public_comment", "business_hours", 48, undefined, "backward", "act", /2\.20\.070$/],
    omc_special_meeting_monday: ["public_comment", "days", 3, "calendar", "backward", "act", /2\.20\.070\(C\)/],
    claim_presentation_injury: ["claim", "months", 6, undefined, "forward", "act", /911\.2\(a\)/],
    claim_presentation_other: ["claim", "years", 1, undefined, "forward", "act", /911\.2\(a\)/],
    claim_suit_after_rejection: ["claim", "months", 6, undefined, "forward", "served", /945\.6\(a\)\(1\)/],
    foia_response: ["records_request", "days", 20, "business", "forward", "received", /552\(a\)\(6\)\(A\)\(i\)/],
  };
  /* R56's set, and beyond it only R85's (T45), each on its own measurement (R85's test, t45.test.mjs) */
  const T45_RULES = FACTS.filter((x) => x.at === "deadlines").map((x) => x.rule);
  assert.deepEqual([...rows.keys()].sort(), [...Object.keys(want), ...T45_RULES].sort());
  for (const [rule, [applies, units, amount, count, direction, starts, cite]] of Object.entries(want)) {
    const d = row(rule);
    assert.deepEqual([d.applies_to, d.units, d.amount, d.count, d.direction, d.starts], [applies, units, amount, count, direction, starts], rule);
    assert.match(d.citation, cite, rule);
    /* FOIA's stated consequence (R75) was read on T45's measurement, named beside time-law's */
    assert.deepEqual([d.status, d.basis], ["researched", rule === "foia_response" ? "2026-10-05 time-law, 2026-10-11 actions-law" : "2026-10-05 time-law"], rule);
  }
  /* CPRA: CCP §12, rolling on CCP §12a's closures (the §135 list), the 14-day extension by written notice, the
     portal's City list observed beside it (K1504 (1)) */
  const cpra = row("records_response");
  const cpraExtension = must(cpra.extension, "extension");
  assert.deepEqual([cpra.roll, cpra.closures, cpra.computation], [true, "judicial", "ccp_12"]);
  assert.deepEqual([cpraExtension.days, cpraExtension.count], [14, "calendar"]);
  assert.match(must(cpraExtension.citation, "extension citation"), /7922\.535\(b\)/);
  assert.equal(must(cpra.observed, "observed").closures, "city");
  assert.equal(row("omc_special_meeting_notice").closures, "city", "an Oakland ordinance's holidays are the City's list (K1504 (5))");
  /* its Monday safe harbour: its own entry, for a Monday meeting, due at noon (K1514) */
  assert.deepEqual([row("omc_special_meeting_monday").applies_on, row("omc_special_meeting_monday").due_at], [["mon"], "12:00"]);
  assert.equal(row("immediate_disclosure").closures, "city");
  const foia = row("foia_response");
  const foiaExtension = must(foia.extension, "extension");
  assert.deepEqual([foia.closures, foiaExtension.days, foiaExtension.count], ["federal", 10, "business"]);
  assert.equal(must(foia.tolling, "tolling").length, 2);
  for (const r of ["agenda_posting_regular", "special_meeting_notice"]) assert.equal(row(r).roll, undefined, `${r}: clock hours do not roll`);
  /* the closure lists, the weekend and the computation, each cited */
  const holidays = must(f.holidays, "holidays");
  const lists = new Map(holidays.filter((h) => h.list && h.year === 2026).map(/** @returns {[string, Holiday]} */ (h) => [must(h.list, "list"), h]));
  /** @param {string} name @returns {Holiday} */
  const list = (name) => must(lists.get(name), name);
  assert.match(must(list("judicial").citation, "citation"), /§ 135/);
  assert.match(must(list("federal").citation, "citation"), /6103\(a\)/);
  /** @param {Holiday} h @returns {string[]} */
  const dates = (h) => h.days.map((d) => d.date.slice(5));
  assert.ok(!dates(list("judicial")).includes("10-12"), "Columbus Day is no judicial holiday (AB 268)");
  assert.ok(dates(list("judicial")).includes("09-25"), "Native American Day is one");
  assert.ok(!dates(list("city")).includes("09-25") && !dates(list("city")).includes("10-12"), "the City's list has neither (M-190)");
  assert.ok(dates(list("federal")).includes("10-12") && dates(list("federal")).includes("11-11"));
  assert.deepEqual(dates(list("city")), dates(must(holidays.find((h) => h.basis === "M-190"), "M-190")), "the City list is M-190's days");
  /* records_response's five counterparties, re-based on their primary sources; the records venues sourced */
  /* each on its primary source; T34 adds the Legistar read its identifiers rest on (R61) */
  for (const c of must(f.counterparties, "counterparties")) assert.match(c.basis, /^2026-10-05 time-law(, 2026-10-05 legistar-events)?$/, c.role);
  for (const k of ["records_request", "records_petition"]) assert.equal(must(must(must(f.action_kinds, "action_kinds").find((x) => x.kind === k), k).venue, "venue").basis, "2026-10-05 time-law", k);
  assert.equal(must(venueOf(f).receipt, "receipt").rule, "next_business_day");
  /* nothing in a deadline or calendar fact rests on UNMEASURED (R44) */
  walkFacts(f, (fact, path) => { if (fact.status) assert.notEqual(fact.basis, "UNMEASURED", path); });
});

test("R57 the test profile supplies every T33 section and field, unlike the first profile's", () => {
  const t = held(TEST), f = held(FIRST);
  for (const sec of T33_SECTIONS) {
    assert.ok(own(t, sec), sec);
    if (own(f, sec)) assert.notDeepEqual(t[sec], f[sec], sec);
  }
  const vocabulary = must(t.vocabulary, "vocabulary");
  for (const key of T33_VOCABULARY) assert.ok(must(vocabulary[key], key).length, key);
  const deadlines = must(t.deadlines, "deadlines");
  for (const field of ["units", "amount", "count", "direction", "roll", "closures", "computation", "extension", "tolling", "observed"])
    assert.ok(deadlines.some((d) => own(d, field)), field);
  assert.ok(deadlines.some((d) => { const e = d.extension; return own(d, "extension") && e !== undefined && own(e, "citation"); }));
  assert.ok(must(t.holidays, "holidays").filter((h) => h.list).length >= 2, "two closure lists");
  assert.ok(deadlines.some((d) => { const c = d.closures, o = d.observed; return c && o && c !== o.closures; }), "a rule naming one list, observing the other");
  const v = venueOf(t);
  for (const f2 of ["cutoff", "outages", "receipt"]) assert.ok(own(v, f2), f2);
  assert.ok(must(t.lawful_demands, "lawful_demands").length >= 1);
  assert.ok(must(vocabulary.codes, "codes").some((c) => c.copy && c.sections));
  assert.ok(must(t.standard_sources, "standard_sources").some((s) => s.key));
  const spaces = must(t.spaces, "spaces");
  for (const sp of T33_SPACES) assert.ok(spaces[sp], sp);
  assert.notDeepEqual(must(t.weekend, "weekend").days, must(f.weekend, "weekend").days);
  walkFacts(t, (fact, path) => assert.equal(fact.basis, "TEST", path));
});

test("R57 the worked fixtures: held with their sources; the first profile supplies, with a citation, every fact each needs", () => {
  /* the 15 usable rows, N6 as the law-against-practice pair, E1 and E2 negative only, F1–F3 derived */
  const ids = FIXTURES.map((x) => x.id);
  assert.deepEqual(ids, ["P1", "P2", "P3", "P4", "P5", "P6", "E1", "E2", "R1", "C1", "O1", "O2", "O3", "O4", "O5", "O6", "N6", "F1", "F2", "F3"]);
  for (const x of FIXTURES) {
    assert.ok(typeof x.source === "string" && x.source.length > 5, x.id);
    if (x.kind === "E") assert.equal(x.expected, null, `${x.id} is a negative only`);
    else assert.ok(x.expected, x.id);
    if (x.id !== "O6") assert.ok(x.negative && x.negative !== x.expected && x.negative !== x.statutory, `${x.id} has its negative control`);
    if (/^F/.test(x.id)) assert.equal(x.derived, true, `${x.id} is labelled derived`);
  }
  const o6 = must(FIXTURES.find((x) => x.id === "O6"), "O6"), n6 = must(FIXTURES.find((x) => x.id === "N6"), "N6");
  assert.equal(o6.practice, true);
  assert.equal(n6.negative, o6.expected, "the practice answer is the law's negative");
  const f = held(FIRST);
  const view = viewOf(combine([FIRST]));
  const viewHolidays = must(view.holidays, "holidays");
  /** @param {string} name @returns {number[]} */
  const listYears = (name) => viewHolidays.filter((h) => h.list === name).map((h) => h.year);
  /** @type {string[]} */
  const gaps = [];
  for (const x of [...FIXTURES, OMC_48, BROWN_72]) {
    const found = x.rule ? must(view.deadlines, "deadlines").find((d) => d.rule === x.rule) : undefined;
    /* a row's court rule and needs differ in shape from row to row: read loosely */
    const courtRule = loose(x).court_rule;
    const rule = x.rule ? found : (isObj(courtRule) ? courtRule : undefined);
    assert.ok(rule && rule.citation, `${x.id}: its rule, cited`);
    const n = loose(x.needs);
    const needsClosures = n.closures, needsComputation = n.computation;
    const closures = typeof needsClosures === "string" ? needsClosures : undefined;
    const observed = n.observed;
    const computation = typeof needsComputation === "string" ? needsComputation : undefined;
    const years = listOr(n.years);
    const viewWeekend = view.weekend;
    if (n.weekend) assert.ok(viewWeekend && viewWeekend.citation, `${x.id}: the weekend`);
    if (computation) assert.ok(must(view.computation, "computation").some((c) => c.key === computation && c.citation), `${x.id}: ${computation}`);
    if (x.rule && closures && !(observed && x.kind !== "D" && must(found, x.id).closures !== closures)) {
      const r = must(found, x.id);
      const o = r.observed;
      assert.ok([r.closures, o && o.closures].includes(closures), `${x.id}: its rule names ${closures}`);
    }
    if (observed) assert.equal(must(must(found, x.id).observed, `${x.id} observed`).closures, closures, `${x.id}: the portal's practice is held beside the rule`);
    if (closures) {
      const list = viewHolidays.find((h) => h.list === closures);
      assert.ok(list && list.citation, `${x.id}: the ${closures} list, cited`);
      /* a year no source gives is not held: the count there is undetermined, never a year with no holidays (R33) */
      for (const y of years) if (!listYears(closures).some((year) => year === y)) gaps.push(`${x.id} ${closures} ${String(y)}`);
    }
  }
  /* 2018 and 2020 are held from the courts' published lists (holidays-extra; K1514); 2024 is not yet measured */
  assert.deepEqual(gaps, ["R1 judicial 2024"], "the year still to be measured (reported to BOB); every other fact is held");
  /* the records venue's receipt rule, for a request arriving on a closed day (K1504 (3)) */
  assert.equal(must(venueOf(f).receipt, "receipt").rule, "next_business_day");
});

test("R57 the OMC 48-business-hour fixture, re-derived from the code's text and the City's list (K1505 (16))", () => {
  const f = held(FIRST);
  const rule = ruleOf(f, OMC_48.rule);
  assert.match(OMC_48.text, /excluding Saturdays, Sundays and holidays/);
  assert.deepEqual([rule.units, rule.amount, rule.direction, rule.closures], ["business_hours", 48, "backward", "city"]);
  const city = new Set(must(must(f.holidays, "holidays").find((h) => h.list === "city" && h.year === 2026), "city 2026").days.map((d) => d.date));
  assert.equal(city.has("2026-10-12"), false, "2026-10-12 checked against the City list: not a closure");
  /* an oracle over the profile's facts (not the module's count, which is civil-time's): the open hours between the
     expected notice and the meeting are exactly 48, and each negative differs */
  const weekend = new Set(must(f.weekend, "weekend").days);
  /** @param {string} from @param {string} to @returns {number} */
  const openHours = (from, to) => {
    let h = 0;
    for (let t = Date.parse(`${from}Z`); t < Date.parse(`${to}Z`); t += 60000) {
      const d = new Date(t);
      if (!weekend.has(dayName(d)) && !city.has(d.toISOString().slice(0, 10))) h += 1 / 60;
    }
    return Math.round(h * 1000) / 1000;
  };
  assert.equal(openHours(OMC_48.expected, OMC_48.start), 48);
  for (const n of OMC_48.negatives) assert.notEqual(openHours(n.at, OMC_48.start), 48, n.why);
  /* had 10-12 been a holiday, time-law's Friday would follow: the difference is that one day */
  city.add("2026-10-12");
  assert.equal(openHours(must(OMC_48.negatives[0], "negatives[0]").at, OMC_48.start), 48);
});

/* ============================================================================================== */
/* K1513, K1514, K1517: the clarifications BOB folded during the job.                              */

test("R26 K1514 applies_on (the anchor's weekdays) and due_at (close_of_business or HH:MM); one value per key in combine", () => {
  const i = must(held(TEST).deadlines, "deadlines").findIndex((d) => d.rule === "notice_of_sitting_friday");
  const D = `deadlines[${i}]`;
  for (const on of [["mon"], ["sat", "sun"], ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]]) assert.ok(breakT((p) => { at(p, D).applies_on = on; }).ok, on.join());
  for (const bad of [[], ["Mon"], ["mon", "mon"], "mon", null])
    assert.ok(hasError(breakT((p) => { at(p, D).applies_on = bad; }), "VALUE_INVALID", `${D}.applies_on`), JSON.stringify(bad));
  for (const due of ["close_of_business", "00:00", "12:00", "23:59"]) assert.ok(breakT((p) => { at(p, D).due_at = due; }).ok, due);
  for (const bad of ["noon", "12", "24:00", "close of business", 12, null])
    assert.ok(hasError(breakT((p) => { at(p, D).due_at = bad; }), "VALUE_INVALID", `${D}.due_at`), String(bad));
  assert.ok(breakT((p) => { const d = at(p, D); delete d.applies_on; delete d.due_at; }).ok, "both optional");
  /** @type {["applies_on" | "due_at", string[] | string][]} */
  const keys = [["applies_on", ["fri"]], ["due_at", "16:00"]];
  for (const [f, v] of keys) {
    const c = combinedOf(combine([TEST, other((b) => { dl(b, "notice_of_sitting_friday")[f] = v; })]));
    assert.ok(c.conflicts.some((x) => x.at === `deadlines[notice_of_sitting_friday/bylaw_complaint].${f}`), f);
    assert.equal(viewRule(c.view, "notice_of_sitting_friday")[f], undefined, f);
  }
  /* OMC 2.20.070(C) held as its own entry beside the general rule; C1 counts on it */
  const f = held(FIRST);
  const mon = ruleOf(f, "omc_special_meeting_monday");
  assert.deepEqual([mon.units, mon.amount, mon.count, mon.direction, mon.applies_on, mon.due_at], ["days", 3, "calendar", "backward", ["mon"], "12:00"]);
  assert.ok(must(f.deadlines, "deadlines").find((d) => d.rule === "omc_special_meeting_notice"), "the general rule stands beside it");
  assert.equal(must(FIXTURES.find((x) => x.id === "C1"), "C1").rule, "omc_special_meeting_monday");
});

test("R6 K1513 K1517 roster words with a kind, roster headers with a role, and the budget readers' keys", () => {
  for (const kind of ["roster", "chart"]) assert.ok(breakT((p) => { at(p, "vocabulary.roster_words[0]").kind = kind; }).ok, kind);
  assert.ok(breakT((p) => { delete at(p, "vocabulary.roster_words[0]").kind; }).ok, "absent: both");
  assert.ok(hasError(breakT((p) => { at(p, "vocabulary.roster_words[0]").kind = "list"; }), "VALUE_INVALID", "vocabulary.roster_words[0].kind"));
  for (const role of ["name", "title", "unit", "start", "end", "as_of", "employee_id", "contact"]) assert.ok(breakT((p) => { at(p, "vocabulary.roster_headers[0]").role = role; }).ok, role);
  for (const bad of ["term", "", undefined]) assert.ok(hasError(breakT((p) => { at(p, "vocabulary.roster_headers[0]").role = bad; }), "VALUE_INVALID", "vocabulary.roster_headers[0].role"));
  for (const col of ["fund", "org", "department", "department_code", "program", "project", "account", "amount", "period", "phase"])
    assert.ok(breakT((p) => { at(p, "vocabulary.budget_headers[0]").column = col; }).ok, col);
  for (const bad of ["total", "", undefined]) assert.ok(hasError(breakT((p) => { at(p, "vocabulary.budget_headers[0]").column = bad; }), "VALUE_INVALID", "vocabulary.budget_headers[0].column"));
  /** @type {("financial_report_titles" | "budget_book_titles" | "financial_headings" | "fiscal_year_forms" | "budget_headers")[]} */
  const budgetKeys = ["financial_report_titles", "budget_book_titles", "financial_headings", "fiscal_year_forms", "budget_headers"];
  for (const key of budgetKeys) {
    assert.ok(must(must(held(TEST).vocabulary, "vocabulary")[key], key).length && must(must(held(FIRST).vocabulary, "vocabulary")[key], key).length, key);
    assert.ok(hasError(breakT((p) => { at(p, `vocabulary.${key}[0]`).pattern = { re: "(" }; }), "PATTERN_INVALID", `vocabulary.${key}[0].pattern`), key);
  }
  assert.deepEqual([...new Set(must(must(held(TEST).vocabulary, "vocabulary").roster_headers, "roster_headers").map((h) => h.role))].sort(), ["as_of", "contact", "employee_id", "end", "name", "start", "title", "unit"]);
  /* the first profile reads the City's own documents (K1513, K1517) */
  const v = must(held(FIRST).vocabulary, "vocabulary");
  /** @param {"roster_words" | "staff_titles" | "financial_report_titles" | "budget_book_titles" | "financial_headings" | "fiscal_year_forms"} key @param {string} line */
  const any = (key, line) => must(v[key], key).filter((e) => rx(e).test(line));
  assert.deepEqual(any("roster_words", "COMMITTEE MEMBER ROSTER AND ASSIGNED STAFF").map((e) => ("kind" in e ? e.kind : undefined)), ["roster"]);
  assert.deepEqual(any("roster_words", "Organizational Chart").map((e) => ("kind" in e ? e.kind : undefined)), ["chart"]);
  for (const t of ["Vice Chair", "Co-Chair", "Assistant City Administrator", "City Clerk", "Parliamentarians", "Intern"]) assert.ok(any("staff_titles", t).length, t);
  assert.equal(any("staff_titles", "Councilmember").length, 0);
  /** @param {string} h @returns {string | undefined} */
  const role = (h) => { const e = must(v.roster_headers, "roster_headers").find((x) => rx(x).test(h)); return e ? e.role : undefined; };
  assert.deepEqual(["Full Name", "Job Title", "Division", "Employee ID", "Email", "Term"].map(role), ["name", "title", "unit", "employee_id", "contact", undefined]);
  assert.ok(any("financial_report_titles", "2024 Annual Comprehensive Financial Report").length);
  assert.ok(any("financial_report_titles", "Comprehensive Annual Financial Report 2012").length);
  assert.ok(any("budget_book_titles", "FY 2023-25 Adopted Policy Budget").length);
  assert.ok(any("financial_headings", "Primary Gove rnme nt Statement of Ne t Position").length, "letter-spaced headings");
  assert.ok(any("fiscal_year_forms", "FY13-15").length && any("fiscal_year_forms", "FY2024").length);
  /* the measured Socrata line items' headers, three cycles (B8; money-people §2, legistar-events §3) */
  /** @param {string} h @returns {string | undefined} */
  const column = (h) => { const e = must(v.budget_headers, "budget_headers").find((x) => rx(x).test(h)); return e ? e.column : undefined; };
  /** @type {{ [cycle: string]: [string, string][] }} */
  const cycles = {
    "FY2013-15": [["budget", "period"], ["department", "department"], ["org_code", "org"], ["fund_code", "fund"], ["project_code", "project"],
      ["program_code", "program"], ["account_code", "account"], ["amount", "amount"]],
    "FY2015-17": [["budget_year_name", "period"], ["org", "org"], ["fund", "fund"], ["project", "project"], ["program", "program"],
      ["account", "account"], ["amt", "amount"]],
    "FY2019-21": [["fund", "fund"], ["prog", "program"], ["acct", "account"], ["fy17_18_actuals_final_year", "amount"],
      ["fy18_19_midcycle_adopted", "amount"], ["fy19_20_biennial_working", "amount"]],
  };
  for (const [cycle, rows] of Object.entries(cycles)) for (const [h, want] of rows) assert.equal(column(h), want, `${cycle} ${h}`);
  for (const h of ["description", "fund_name", "fy2019", "budgets"]) assert.equal(column(h), undefined, h);
  for (const h of ["General Purpose Fund Revenue", "Expenditures By Fund"]) assert.ok(any("financial_headings", h).length, h);
});

test("R52 K1513 classification_schemes: forms and the project kind; the first profile's fund, org, department, program, account and project codes", () => {
  const i = must(held(TEST).classification_schemes, "classification_schemes").findIndex((x) => x.kind === "project");
  assert.ok(i >= 0, "a project scheme");
  const C = `classification_schemes[${i}]`;
  /** @type {[string | { re: string }[], string][]} */
  const wrong = [[[], `${C}.forms`], [[{ re: "(" }], `${C}.forms[0]`], ["WO", `${C}.forms`]];
  for (const [bad, where] of wrong) assert.ok(hasError(breakT((p) => { at(p, C).forms = bad; }), "SCHEME_INVALID", where), JSON.stringify(bad));
  assert.ok(hasError(breakT((p) => { at(p, C).forms = [{ re: "(" }]; }), "SCHEME_INVALID", `${C}.forms[0]`));
  const f = must(held(FIRST).classification_schemes, "classification_schemes");
  assert.deepEqual(f.map((x) => x.kind), ["fund", "organisation", "organisation", "program", "account", "project"]);
  /** @param {string} scheme @param {string} value @returns {boolean} */
  const reads = (scheme, value) => must(must(f.find((x) => x.scheme === scheme), scheme).forms, `${scheme} forms`).some((p) => new RegExp(p.re, p.flags || "").test(value));
  assert.ok(reads("oakland_fund", "FD_1010") && reads("oakland_fund", "1010"));
  assert.ok(reads("oakland_org", "OR_01111") && reads("oakland_program", "PG_IP01") && reads("oakland_account", "51111"));
  assert.ok(reads("oakland_org", "11") && reads("oakland_org", "1111") && !reads("oakland_org", "1") && !reads("oakland_org", "OR_1"), "FY2013-15's bare org codes");
  assert.ok(reads("oakland_project", "PJ_1000001") && reads("oakland_project", "1003439"));
  assert.ok(reads("oakland_department", "DP1000") && reads("oakland_department", "DPCC0") && !reads("oakland_department", "DP1"));
  assert.equal(must(must(must(f[0], "classification_schemes[0]").codes, "codes").find((c) => c.code === "1010"), "1010").label, "General Purpose Fund");
});

test("R4 R3 K1514 the court registers as systems, with their proceeding number forms, in both profiles", () => {
  for (const id of [FIRST, TEST]) {
    const p = held(id);
    const systems = must(p.systems, "systems");
    assert.deepEqual(["courtlistener_docket", "cpuc_proceeding", "ecourt_roa"].filter((o) => systems.some((s) => s.origin === o)),
      ["courtlistener_docket", "cpuc_proceeding", "ecourt_roa"], id);
    assert.ok(must(must(p.spaces, "spaces").proceeding, "proceeding").forms.length >= 3, id);
  }
  const view = viewOf(combine([FIRST]));
  const viewSystems = must(view.systems, "systems");
  /** @param {string} url @returns {string | undefined} */
  const sys = (url) => {
    const u = new URL(url);
    const s = viewSystems.find((x) => { const sp = x.path; return x.hosts.includes(u.hostname) && (!sp || new RegExp(sp.re, sp.flags || "").test(u.pathname + u.search)); });
    return s ? s.origin : undefined;
  };
  assert.equal(sys("https://www.courtlistener.com/docket/4214664/some-case/"), "courtlistener_docket");
  assert.equal(sys("https://www.courtlistener.com/opinion/1/x/"), undefined);
  assert.equal(sys("https://apps.cpuc.ca.gov/apex/f?p=401:56:0::NO:RP,57,RIR:P5_PROCEEDING_SELECT:A2106021"), "cpuc_proceeding");
  assert.equal(sys("https://eportal.alameda.courts.ca.gov/?q=node/388"), "ecourt_roa");
  const forms = must(must(view.spaces, "spaces").proceeding, "proceeding").forms;
  /** @param {string} value @returns {string | null} */
  const read = (value) => { const f = forms.find((x) => new RegExp(x.pattern.re, x.pattern.flags || "").test(value)); return (f ? f.form : undefined) || null; };
  assert.equal(read("22CV013018"), "alameda-civil");
  assert.equal(read("RG21105389"), "alameda-legacy");
  assert.equal(read("3:20-cv-05640-EMC"), "federal-district");
  assert.equal(read("A2106021"), "cpuc");
  assert.equal(read("A.21-06-021"), "cpuc");
  assert.equal(read("CV013018"), null);
});

test("R47 R57 K1514 the judicial lists of 2018 and 2020 (courts' published lists): Columbus Day then a judicial holiday", () => {
  const f = held(FIRST);
  const holidays = must(f.holidays, "holidays");
  /** @param {number} y @returns {Holiday | undefined} */
  const year = (y) => holidays.find((h) => h.list === "judicial" && h.year === y);
  for (const y of [2018, 2020]) {
    const h = year(y);
    assert.ok(h, String(y));
    assert.match(must(h.citation, "citation"), /§ 135/);
    assert.deepEqual([h.status, h.basis], ["researched", "2026-10-05 holidays-extra"]);
  }
  /** @param {number} y @returns {Set<string>} */
  const dates = (y) => new Set(must(year(y), String(y)).days.map((d) => d.date));
  assert.ok(dates(2018).has("2018-05-28"), "P1's Memorial Day");
  assert.ok(dates(2020).has("2020-10-12"), "P6: Columbus Day 2020");
  assert.ok(!dates(2026).has("2026-10-12"));
  /* P1 and P6 against the held lists: an oracle over the profile's facts, not the module's count (civil-time's) */
  const weekend = new Set(must(f.weekend, "weekend").days);
  /** @param {string} from @param {number} n @param {number} y @returns {string} */
  const back = (from, n, y) => {
    let d = new Date(`${from}T00:00Z`), k = 0;
    while (k < n) { d = new Date(d.getTime() - 864e5); const iso = d.toISOString().slice(0, 10);
      if (!weekend.has(dayName(d)) && !dates(y).has(iso)) k++; }
    return d.toISOString().slice(0, 10);
  };
  for (const id of ["P1", "P6"]) {
    const x = must(FIXTURES.find((r) => r.id === id), id);
    assert.equal(back(x.start, 16, Number(x.start.slice(0, 4))), x.expected, id);
  }
  /* the federal 2026 list: Independence Day falls on Saturday and is observed Friday (5 U.S.C. § 6103(b)) */
  const fed = new Set(must(holidays.find((h) => h.list === "federal"), "federal").days.map((d) => d.date));
  assert.ok(fed.has("2026-07-03") && fed.has("2026-10-12") && fed.has("2026-11-11"));
});
